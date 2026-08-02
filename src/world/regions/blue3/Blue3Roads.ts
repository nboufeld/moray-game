import { SEEDS } from "../../../util/Random";
import { blue2TerrainTarget } from "../blue2/Blue2Terrain";
import { buildRoadDressing, type RoadDressingBuild, type RoadFrame } from "../RoadDressing";
import { restFree } from "./Blue3Beats";
import { STONE_DUSK, STONE_PALE } from "./Blue3Shared";
import { BLUE3_SLOT, blue3TerrainTarget, worldOf } from "./Blue3Terrain";

/**
 * ROADS-AND-AXES, great-blue-3's serving (critic #2/#6/#10 at the
 * `great-blue-09` cited crossing; ledger roads-and-axes.md). The First
 * Sea's registry binds hard: the Worldwall band u < 1178 builds
 * nothing; the Morning Shelf Hush u 1186–1236 (|v| ≤ 24) takes only
 * the Daymark's blade. The serving lives PAST the hush, where the
 * arrival beat looks:
 *
 * - ONE reveal — a drowned keel's rib set: the daybreak keel's kin,
 *   C5's anchoring silhouette for the last crossing. Round 2: moved
 *   from u 1244 into the registry's ONE legal sliver between the
 *   Worldwall band (< 1178) and the hush (1186–1236) — anchored at
 *   u 1185 and grown BACKWARD (turn π) so every rib stands in
 *   u ≈ 1178–1185; at ~39 m from the crossing pose it reads through
 *   the fog where the r1 stand at 98 m was a ghost.
 * - The companion shoal is the region's EXISTING buoy-fry commute
 *   (Blue3Life, u 1252–1340 on a 220 s loop) — the road past the sill
 *   is already one file's; a second would break the saturation check.
 * - ONE light change — two cool morning FLOOR POOLS past the sill
 *   (C7: light landing, no column; the hush keeps the Daymark as its
 *   only mark; no beams anywhere near the Wide Morning).
 *
 * - **The mid-down interior** at the critic's stand (1505, −60) —
 *   outside every rest — takes the quietest serving in the program: a
 *   pale scree drift-line and a 10-fish silver-lavender under-shoal.
 *   Quiet, not dead; the First Sea stays the First Sea.
 */

const CORRIDOR_SEED = (SEEDS.regionBlue3 ^ 0x0ad5_0a11) >>> 0;
const MIDDOWN_SEED = (SEEDS.regionBlue3 ^ 0x0ad5_0b22) >>> 0;

const corridorFrame: RoadFrame = {
  azimuth: BLUE3_SLOT.azimuth,
  worldOf,
  ground: (x, z) => Math.max(blue2TerrainTarget(x, z), blue3TerrainTarget(x, z)),
};

const interiorFrame: RoadFrame = {
  azimuth: BLUE3_SLOT.azimuth,
  worldOf,
  ground: blue3TerrainTarget,
};

export function buildBlue3Roads(): RoadDressingBuild[] {
  const corridor = buildRoadDressing({
    seed: CORRIDOR_SEED,
    frame: corridorFrame,
    reveal: {
      kind: "ribs",
      u: 1185,
      v: 9,
      gap: 7.5,
      scale: 1.4,
      color: 0xa8aac4,
      turn: Math.PI,
    },
    lights: [
      {
        kind: "pools",
        tint: 0xcfe2f2,
        pools: [
          { u: 1246, v: -4, radius: 3.4, opacity: 0.14 },
          { u: 1264, v: 5, radius: 3.0, opacity: 0.12 },
        ],
      },
    ],
  });

  const midDown = buildRoadDressing({
    seed: MIDDOWN_SEED,
    frame: interiorFrame,
    loopShoals: [
      {
        centerU: 1502,
        centerV: -58,
        radiusU: 16,
        radiusV: 10,
        lift: 6,
        count: 10,
        fish: { scale: 0.78, color: 0xded8f0, emissive: 0x3a3450, profile: "tetra" },
        periodSec: 170,
        braid: { lateral: 0.26, vertical: 0.18 },
      },
    ],
    ribbons: [
      {
        polyline: [
          [1478, -46],
          [1505, -58],
          [1532, -70],
        ],
        width: 4.5,
        count: 110,
        palette: { base: STONE_PALE, shade: STONE_DUSK },
        shapeSet: "pebble",
        twoTone: true,
        grade: 0.5,
        gate: restFree,
      },
    ],
  });

  return [corridor, midDown];
}
