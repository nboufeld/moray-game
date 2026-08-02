import { SEEDS } from "../../../util/Random";
import { verdantTerrainTarget } from "../verdant1/VerdantTerrain";
import { buildRoadDressing, type RoadDressingBuild, type RoadFrame } from "../RoadDressing";
import {
  VERDANT2_SLOT,
  stairChannelCenter,
  verdant2TerrainTarget,
  worldOf,
} from "./Verdant2Terrain";

/**
 * ROADS-AND-AXES, verdant-line-2's serving (critic #2/#6/#10; ledger
 * roads-and-axes.md). Budget honesty: the region closed at 1,343,356
 * tris — ~6.6k under the R12 cap — so this is a measured serving.
 *
 * - **The pass-1→2 corridor** (the Emerald Stair, u 645–760): ONE
 *   reveal — a jade leaning pair on the threshold road's south
 *   shoulder, off the wandering stair channel (the swim-line test's
 *   own line); the companion shoal is the region's EXISTING threshold
 *   runner (35 silver-green fish confined to u 645–760 on a ~91 s
 *   loop — the saturation check forbids a second file); ONE light
 *   change — a celadon dapple pool on the threshold road (the
 *   milky→celadon palette story, laid on the floor; golden-1's
 *   measured dapple discipline).
 *
 * - **The mid-down interior** at the critic's stand (985, −60): a
 *   celadon dapple and a slow 12-fish under-shoal — the terrace
 *   country reads inhabited from mid-water. Clear of the Cistern, the
 *   Fern Vault's shadow and the basin pocket (MASTER §1.2).
 */

const CORRIDOR_SEED = (SEEDS.regionVerdant2 ^ 0x0ad5_0a11) >>> 0;
const MIDDOWN_SEED = (SEEDS.regionVerdant2 ^ 0x0ad5_0b22) >>> 0;

const corridorFrame: RoadFrame = {
  azimuth: VERDANT2_SLOT.azimuth,
  worldOf,
  ground: (x, z) => Math.max(verdantTerrainTarget(x, z), verdant2TerrainTarget(x, z)),
};

const interiorFrame: RoadFrame = {
  azimuth: VERDANT2_SLOT.azimuth,
  worldOf,
  ground: verdant2TerrainTarget,
};

export function buildVerdant2Roads(): RoadDressingBuild[] {
  const corridor = buildRoadDressing({
    seed: CORRIDOR_SEED,
    frame: corridorFrame,
    reveal: {
      kind: "leaning-pair",
      u: 692,
      v: stairChannelCenter(692) - 13,
      gap: 5,
      scale: 0.95,
      color: 0xa9bda0,
    },
    lights: [
      {
        kind: "dapple",
        tint: 0xd8f0c0,
        centerU: 700,
        centerV: stairChannelCenter(700),
        radius: 9,
        opacity: 0.08,
        tileMetres: 10,
      },
    ],
  });

  const midDown = buildRoadDressing({
    seed: MIDDOWN_SEED,
    frame: interiorFrame,
    loopShoals: [
      {
        centerU: 985,
        centerV: -58,
        radiusU: 16,
        radiusV: 10,
        lift: 6,
        count: 12,
        fish: { scale: 0.8, color: 0xc9ecd8, emissive: 0x35584c, profile: "fusilier" },
        periodSec: 160,
        braid: { lateral: 0.3, vertical: 0.2 },
      },
    ],
    lights: [
      {
        kind: "dapple",
        tint: 0xd8f0c0,
        centerU: 985,
        centerV: -60,
        radius: 9,
        opacity: 0.08,
        tileMetres: 10,
      },
    ],
  });

  return [corridor, midDown];
}
