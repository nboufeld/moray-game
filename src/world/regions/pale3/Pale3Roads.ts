import { SEEDS } from "../../../util/Random";
import { pale2TerrainTarget } from "../pale2/Pale2Terrain";
import { buildRoadDressing, type RoadDressingBuild, type RoadFrame } from "../RoadDressing";
import { PALE3_SLOT, pale3TerrainTarget, worldOf } from "./Pale3Terrain";

/**
 * ROADS-AND-AXES, pale-passage-3's serving — the corridor the critic
 * cited BY NAME (`JOURNEY-pale-09`: "pass23 and the pale-3 threshold
 * are near-identical bare-sand compositions... the emptiest road in
 * the game"). Ledger roads-and-axes.md.
 *
 * Budget honesty: pale-3 closed its fill at 1,349,764 tris — 236 under
 * the R12 cap. This dressing is the ECONOMY serving (~3k tris: a
 * ten-ring dolmen, a 14-tetra file, three floor pools) and the small
 * overage it forces is taken under R12's own rule ("a region over a
 * cap that holds the [frame] gate may ship with the overage recorded")
 * — recorded in the ledger, asserted in the test at the new figure.
 *
 * - ONE reveal — a fallen bone dolmen (u 1198): the standing-stone
 *   sentence of sun's-doorstep, prefigured on the road as a ruin.
 * - ONE companion shoal — the pearl tetra file, confined u 1145–1262;
 *   it turns home before THE UNDAWN (u 1276–1302, held-breath dark —
 *   no shoal, no scatter, per the registry).
 * - ONE light change — a run of three mint-pearl FLOOR POOLS stepping
 *   toward daybreak (C7: light landing with no visible column; pale
 *   forbids dapple — upheld — and the Undawn stays beam-free).
 * - NO ribbons, no mid-down spend: the region has no headroom; its
 *   mid-down verdict is recorded honestly in the ledger instead.
 */

const CORRIDOR_SEED = (SEEDS.regionPale3 ^ 0x0ad5_0a11) >>> 0;

const corridorFrame: RoadFrame = {
  azimuth: PALE3_SLOT.azimuth,
  worldOf,
  ground: (x, z) => Math.max(pale2TerrainTarget(x, z), pale3TerrainTarget(x, z)),
};

const PEARL_FISH = {
  scale: 0.8,
  color: 0xeef2ea,
  emissive: 0x3c3e3a,
  profile: "tetra",
} as const;

export function buildPale3Roads(): RoadDressingBuild[] {
  const corridor = buildRoadDressing({
    seed: CORRIDOR_SEED,
    frame: corridorFrame,
    reveal: {
      kind: "fallen-lintel",
      u: 1198,
      v: 8,
      gap: 5,
      scale: 0.95,
      color: 0xe3e4f0,
    },
    corridorShoal: {
      u0: 1145,
      u1: 1262,
      sideV: 5,
      lift: 2.5,
      count: 14,
      fish: PEARL_FISH,
      periodSec: 110,
      braid: { lateral: 0.3, vertical: 0.2 },
    },
    lights: [
      {
        kind: "pools",
        tint: 0xdaf0dc,
        pools: [
          { u: 1176, v: -3, radius: 3.2, opacity: 0.16 },
          { u: 1214, v: 3, radius: 3.0, opacity: 0.15 },
          { u: 1250, v: -2, radius: 3.4, opacity: 0.17 },
        ],
      },
    ],
  });

  return [corridor];
}
