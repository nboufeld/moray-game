import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBeamAndPool, type BeamSpec, type PoolSpec } from "../kit/BeamAndPool";
import { CHAPEL, LAMP, POOLS, worldOf } from "./Pale2Terrain";

/**
 * The light of the Lantern Combs — paper-light made into events. The
 * kit `beamAndPool` carries the whole four-part additive discipline
 * (fog:false, ground fade, edge-on fade, range fade by ~120 m):
 *
 * - slanted blades through the comb slots (the Winnow's and the
 *   galleries' — the fins comb the light, that is their name);
 * - a soft moon-pool over each lit moonmilk bowl;
 * - THE WHITE CHAPEL's single beam — the hush's only event, licensed
 *   by the rest's own registry line;
 * - THE LAMP's shaft — the named light peak, the brightest mark in
 *   the pale province, landing on the lantern's crown;
 * - a reveal beam at the Comb Gate.
 *
 * The Winnow Shadow (u 776–800) stays beam-free — the descent's held
 * breath; the blades stand before and after it.
 */

const SEED = SEEDS.regionPale2;

interface Slot {
  readonly u: number;
  readonly v: number;
  readonly top: number;
  readonly width: number;
  readonly opacity: number;
  readonly slantV?: number;
}

// The comb-slot blades: slanted like light through pickets. None land
// inside the Winnow Shadow (u 776–800) or the rests.
const SLOTS: readonly Slot[] = [
  // The gate's reveal beam, standing in the doorway.
  { u: 753, v: 2, top: 11, width: 2.6, opacity: 0.12, slantV: 1.6 },
  // The upper Winnow, before the shadow.
  { u: 766, v: -4, top: 9, width: 2.0, opacity: 0.09, slantV: 2.2 },
  // The descent's foot, past the shadow — arrival back into light.
  { u: 808, v: 3, top: 6, width: 2.4, opacity: 0.1, slantV: 2.0 },
  // The gallery slots.
  { u: 842, v: -12, top: 4, width: 2.8, opacity: 0.09, slantV: 2.6 },
  { u: 872, v: 16, top: 3, width: 2.4, opacity: 0.08, slantV: -2.2 },
  { u: 906, v: -18, top: 3, width: 3.0, opacity: 0.09, slantV: 2.4 },
  { u: 940, v: 24, top: 2, width: 2.2, opacity: 0.08, slantV: -2.0 },
  // The Pearl Steps' rising light toward the far gate.
  { u: 1096, v: 6, top: 4, width: 2.6, opacity: 0.09, slantV: 1.4 },
];

export function buildPale2Light(): { groups: Group[] } {
  const beams: BeamSpec[] = [];
  const pools: PoolSpec[] = [];

  for (const slot of SLOTS) {
    const { x, z } = worldOf(slot.u, slot.v);
    const slantTo = worldOf(slot.u, slot.v + (slot.slantV ?? 0));
    beams.push({
      pos: [x, z],
      top: slot.top,
      width: slot.width,
      opacity: slot.opacity,
      slant: [(slantTo.x - x) / 10, (slantTo.z - z) / 10],
    });
    // A dapple under every blade: a beam that brightens nothing is a
    // decal (the kit's own default, kept when listing pools by hand).
    pools.push({ pos: [x, z], radius: slot.width * 1.1, opacity: 0.1 });
  }

  // The moon-pools over the lit bowls (the Still Pool keeps darkness).
  for (const pool of POOLS) {
    if (pool.rest) {
      continue;
    }
    const { x, z } = worldOf(pool.u, pool.v);
    pools.push({ pos: [x, z], radius: pool.radius * 0.72, opacity: 0.12 });
  }

  // THE WHITE CHAPEL's one beam — the rest's licensed event; its
  // landing pool is the same mark, not a second one.
  {
    const { x, z } = worldOf(CHAPEL.u, CHAPEL.v);
    beams.push({ pos: [x, z], top: 8, width: 4.2, opacity: 0.1 });
    pools.push({ pos: [x, z], radius: 4.6, opacity: 0.1 });
  }

  // THE LAMP's shaft: the named light peak — the widest, warmest mark
  // in the province, falling onto the lantern's crown.
  {
    const { x, z } = worldOf(LAMP.u, LAMP.v);
    beams.push({ pos: [x, z], top: 9, width: 7.5, opacity: 0.22 });
    // Round 3: pulled in — at r 10 the pool sprite crossed the lamp-
    // heart pose's frustum edge-on as a floating bright ellipse.
    pools.push({ pos: [x, z], radius: 7, opacity: 0.12 });
  }

  const build = buildBeamAndPool({
    seed: SEED ^ 0x11f9,
    tint: 0xfff0d2,
    ground: (x, z) => seabedHeight(x, z),
    beams,
    pools,
  });

  return { groups: [build.group] };
}
