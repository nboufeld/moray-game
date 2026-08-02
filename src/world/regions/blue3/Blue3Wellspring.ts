import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildParticulateField } from "../kit/ParticulateField";
import { B3_SEEDS } from "./Blue3Shared";
import { CRADLE_SPINE, FORD, OVERBRIM, PANS, WELLHEAD, worldOf } from "./Blue3Terrain";

/**
 * THE WELLHEAD'S WATER, made visible — the region's one great event
 * as a living system: the sea's water is born at the bottom of the
 * world and starts its journey back up.
 *
 * - **THE BREATH**: a slow column of glass rising the full height of
 *   the Wellhead's bowl — the spring itself, upwelling through the
 *   Daybreak's beam (column mode, the one rising water in the whole
 *   province: this is not Smoulder's warm ember-rise — it is water,
 *   cool glass-green, and it rises because it is BORN, not because it
 *   burns).
 * - **THE OVERBRIM**: where the young river leaves the crater — a
 *   spill of glints over the rim notch, falling the few metres to the
 *   Mere.
 * - **THE CRADLE'S GLASS**: chained drift volumes streaming down the
 *   young river's spine toward the rim mist, with a slow glint swarm
 *   at the Shallows where the road wades it.
 * - **THE PANS' SHIMMER**: the faintest licensed motion inside the
 *   Starwater Pans' rest — starlight standing over still water.
 *
 * All closed-form off simulated time; captures settle deterministically.
 */

const SEED = SEEDS.regionBlue3;

export interface Blue3WellspringBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

export function buildBlue3Wellspring(): Blue3WellspringBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  // ── THE BREATH: the spring of the sea ────────────────────────────────────
  const well = worldOf(WELLHEAD.u, WELLHEAD.v);
  const breath = buildParticulateField({
    seed: SEED ^ B3_SEEDS.wellBreath,
    tint: 0xdef2e6,
    count: 320,
    mode: "column",
    volume: { center: [well.x, WELLHEAD.bowlFloor + 26, well.z], size: [11, 50, 11] },
    size: 0.32,
    opacity: 0.5,
  });
  groups.push(breath.group);
  updaters.push((t) => breath.update(t));

  // The bowl's own slow swarm: the water that has just arrived,
  // turning once before it leaves.
  const bowlSwarm = buildParticulateField({
    seed: SEED ^ (B3_SEEDS.wellBreath + 7),
    tint: 0xeafff4,
    count: 90,
    mode: "swarm",
    volume: { center: [well.x, WELLHEAD.bowlFloor + 3, well.z], size: [14, 4, 14] },
    size: 0.16,
    opacity: 0.5,
  });
  groups.push(bowlSwarm.group);
  updaters.push((t) => bowlSwarm.update(t));

  // ── THE OVERBRIM: the river leaves the crater ────────────────────────────
  const brim = worldOf(OVERBRIM.u, OVERBRIM.v);
  const brimFloor = seabedHeight(brim.x, brim.z);
  const spill = buildParticulateField({
    seed: SEED ^ B3_SEEDS.overbrim,
    tint: 0xdcf2e6,
    count: 160,
    mode: "fall",
    volume: { center: [brim.x, brimFloor + 4.5, brim.z], size: [10, 8, 10] },
    size: 0.24,
    opacity: 0.48,
  });
  groups.push(spill.group);
  updaters.push((t) => spill.update(t));

  // ── THE CRADLE'S GLASS: the young river, streaming ───────────────────────
  for (let i = 1; i < CRADLE_SPINE.length - 1; i++) {
    const [au, av] = CRADLE_SPINE[i]!;
    const [bu, bv] = CRADLE_SPINE[i + 1]!;
    const mu = (au + bu) / 2;
    const mv = (av + bv) / 2;
    const { x, z } = worldOf(mu, mv);
    const floor = seabedHeight(x, z);
    const a = worldOf(au, av);
    const b = worldOf(bu, bv);
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const dir: [number, number, number] = [(b.x - a.x) / len, -0.02, (b.z - a.z) / len];
    const glass = buildParticulateField({
      seed: SEED ^ (B3_SEEDS.cradleGlass + i * 17),
      tint: 0xd8f0e4,
      count: 120,
      mode: "drift",
      volume: {
        center: [x, floor + 1.4, z],
        size: [Math.min(40, len + 12), 2.6, Math.min(40, len + 12)],
      },
      size: 0.4,
      opacity: 0.5,
      bias: { dir, speed: 1.05 },
    });
    groups.push(glass.group);
    updaters.push((t) => glass.update(t));
  }

  // The Shallows' glints: the crossing marked in slow sparks.
  const ford = worldOf(FORD.u, FORD.v);
  const fordFloor = seabedHeight(ford.x, ford.z);
  const glints = buildParticulateField({
    seed: SEED ^ B3_SEEDS.fordGlints,
    tint: 0xeafff4,
    count: 70,
    mode: "swarm",
    volume: { center: [ford.x, fordFloor + 1.2, ford.z], size: [18, 2.6, 18] },
    size: 0.14,
    opacity: 0.5,
  });
  groups.push(glints.group);
  updaters.push((t) => glints.update(t));

  // ── THE PANS' SHIMMER (the rest's licensed motion) ───────────────────────
  const pan = PANS[0]!;
  const panAt = worldOf(pan.u, pan.v);
  const panFloor = seabedHeight(panAt.x, panAt.z);
  const shimmer = buildParticulateField({
    seed: SEED ^ B3_SEEDS.panShimmer,
    tint: 0xf2ece2,
    count: 60,
    mode: "swarm",
    volume: { center: [panAt.x, panFloor + 0.9, panAt.z], size: [26, 1.6, 26] },
    size: 0.11,
    opacity: 0.4,
  });
  groups.push(shimmer.group);
  updaters.push((t) => shimmer.update(t));

  return {
    groups,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}
