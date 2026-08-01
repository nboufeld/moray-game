import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildParticulateField } from "../kit/ParticulateField";
import { B2_SEEDS } from "./Blue2Shared";
import { CURRENT_SPINE, FORD, SPILL, worldOf } from "./Blue2Terrain";

/**
 * THE OLD CURRENT, made visible — the region's moving centrepiece and
 * its road-as-place argument in one system: a river of clearer,
 * glinting water crossing the Current's Step bank to bank, born out of
 * the rim mist high on the west flank, threading the Weir at the Ford,
 * and pouring over the third riser at THE SPILL into the Round's edge.
 *
 * The river's body is particulate glass: a chain of drift volumes
 * riding the spine with a downstream bias, so the water itself streams
 * (closed-form; the kit wraps positions inside each volume). At the
 * Ford a slow glint swarm marks the crossing; at the Spill the glass
 * FALLS — a fall-mode column pouring down the riser with its own foot
 * of rising sparkles. The travellers (Blue2Life) ride the same spine,
 * so the river reads at every range: paint under it, glass in it,
 * silver through it.
 */

const SEED = SEEDS.regionBlue2;

export interface Blue2CurrentBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

export function buildBlue2Current(): Blue2CurrentBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  // ── The glass: drift volumes chained down the spine ──────────────────────
  for (let i = 0; i < CURRENT_SPINE.length - 1; i++) {
    const [au, av] = CURRENT_SPINE[i]!;
    const [bu, bv] = CURRENT_SPINE[i + 1]!;
    const mu = (au + bu) / 2;
    const mv = (av + bv) / 2;
    const { x, z } = worldOf(mu, mv);
    const floor = seabedHeight(x, z);
    // The downstream direction, in world space.
    const a = worldOf(au, av);
    const b = worldOf(bu, bv);
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const dir: [number, number, number] = [(b.x - a.x) / len, -0.02, (b.z - a.z) / len];
    const glass = buildParticulateField({
      seed: SEED ^ (B2_SEEDS.currentGlass + i * 17),
      tint: 0xd8f0e4,
      count: 150,
      mode: "drift",
      volume: { center: [x, floor + 1.6, z], size: [Math.min(44, len + 14), 2.8, Math.min(44, len + 14)] },
      // Round 2: sized and brightened up — the r1 glass was sub-pixel
      // past ~25 m and the river did not read as a river.
      size: 0.42,
      opacity: 0.5,
      bias: { dir, speed: 1.15 },
    });
    groups.push(glass.group);
    updaters.push((t) => glass.update(t));
  }

  // ── The Ford's glints: the crossing marked in slow sparks ────────────────
  const ford = worldOf(FORD.u, FORD.v);
  const fordFloor = seabedHeight(ford.x, ford.z);
  const glints = buildParticulateField({
    seed: SEED ^ B2_SEEDS.fordGlints,
    tint: 0xeafff4,
    count: 90,
    mode: "swarm",
    volume: { center: [ford.x, fordFloor + 1.4, ford.z], size: [22, 3, 22] },
    size: 0.15,
    opacity: 0.5,
  });
  groups.push(glints.group);
  updaters.push((t) => glints.update(t));

  // ── THE SPILL: the glass falls off the world's third step ────────────────
  const spill = worldOf(SPILL.u + 6, SPILL.v - 10);
  const spillFloor = seabedHeight(spill.x, spill.z);
  const fall = buildParticulateField({
    seed: SEED ^ B2_SEEDS.spillFall,
    tint: 0xdcf2e6,
    count: 260,
    mode: "fall",
    volume: { center: [spill.x, spillFloor + 8.5, spill.z], size: [14, 15, 14] },
    size: 0.26,
    opacity: 0.48,
  });
  groups.push(fall.group);
  updaters.push((t) => fall.update(t));

  // The fall's foot: a slow breath of sparks where the glass lands.
  const foot = buildParticulateField({
    seed: SEED ^ B2_SEEDS.spillPool,
    tint: 0xe6f6ec,
    count: 70,
    mode: "swarm",
    volume: { center: [spill.x, spillFloor + 1.2, spill.z], size: [14, 2.4, 14] },
    size: 0.16,
    opacity: 0.45,
  });
  groups.push(foot.group);
  updaters.push((t) => foot.update(t));

  return {
    groups,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}
