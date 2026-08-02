import { SEEDS } from "../../../util/Random";
import { blue1TerrainTarget } from "../blue1/Blue1Terrain";
import { buildRoadDressing, type RoadDressingBuild, type RoadFrame } from "../RoadDressing";
import { BLUE2_SLOT, blue2TerrainTarget, worldOf } from "./Blue2Terrain";

/**
 * ROADS-AND-AXES, great-blue-2's serving — the province the critic
 * scored "DOES NOT LAND ... 'vast' delivered as 'absent'", dressed in
 * ITS OWN register: composed emptiness is the voice, so the World's
 * Edge crossing takes C5's actual prescription — ONE LARGE ANCHORING
 * SILHOUETTE — not clutter. Ledger roads-and-axes.md.
 *
 * The registry is the licence and it is tight here (Blue2Beats): the
 * Far Wall band u < 668 builds NOTHING (the Under-Blue inheritance);
 * the Othershore Hush u 700–740, |v| ≤ 26 allows no fauna and no
 * scatter (the Pharos' blade is its one mark). So the whole serving
 * lives in the legal window u 668–700:
 *
 * - ONE reveal — a great wreck-rib set (u 676): the drowned-keel
 *   vocabulary the province's own daybreak beat proves, scaled LARGE
 *   so the crossing reads vast against it, off the swim line.
 * - ONE companion shoal — a small lavender file (r > g, the violet
 *   value key) on a short confined loop u 670–698, home before the
 *   hush line every phase of every loop.
 * - ONE light change — a single thin slanted blade over the wall
 *   crest, no pool (C7: the broken shaft, not the god-shaft; the hush
 *   keeps the Pharos as its only mark).
 * - NO mid-down serving: the critic's `-02-mid-down` stand (985, −60)
 *   lies INSIDE the Round of the Gentle Dark (r 78 at (1030, −10)) —
 *   MASTER §1.2: a frame that lands in a registered rest and reads
 *   bare is CORRECT. The verdict is recorded, not "fixed".
 */

const CORRIDOR_SEED = (SEEDS.regionBlue2 ^ 0x0ad5_0a11) >>> 0;

const corridorFrame: RoadFrame = {
  azimuth: BLUE2_SLOT.azimuth,
  worldOf,
  ground: (x, z) => Math.max(blue1TerrainTarget(x, z), blue2TerrainTarget(x, z)),
};

/** The blade's head, metres over the wall crest at its foot. */
const BLADE_RISE = 18;

export function buildBlue2Roads(): RoadDressingBuild[] {
  const bladeAt = worldOf(686, -9);
  const corridor = buildRoadDressing({
    seed: CORRIDOR_SEED,
    frame: corridorFrame,
    reveal: {
      kind: "ribs",
      u: 676,
      v: 11,
      gap: 7,
      scale: 1.6,
      color: 0xa8aac4,
    },
    corridorShoal: {
      u0: 670,
      u1: 698,
      sideV: 6,
      lift: 3.2,
      count: 14,
      fish: { scale: 0.78, color: 0xded8f0, emissive: 0x3a3450, profile: "tetra" },
      periodSec: 90,
      braid: { lateral: 0.3, vertical: 0.22 },
    },
    lights: [
      {
        kind: "shafts",
        tint: 0xdfe8f4,
        beams: [
          {
            u: 686,
            v: -9,
            top: corridorFrame.ground(bladeAt.x, bladeAt.z) + BLADE_RISE,
            width: 2.6,
            opacity: 0.12,
            slant: [0.24, 0.2],
          },
        ],
        pools: "none",
      },
    ],
  });

  return [corridor];
}
