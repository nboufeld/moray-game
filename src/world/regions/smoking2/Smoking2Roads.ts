import { SEEDS } from "../../../util/Random";
import { smokingTerrainTarget } from "../smoking1/SmokingTerrain";
import { buildRoadDressing, type RoadDressingBuild, type RoadFrame } from "../RoadDressing";
import { restFree } from "./Smoking2Shared";
import { SMOKING2_SLOT, smoking2TerrainTarget, worldOf } from "./Smoking2Terrain";

/**
 * ROADS-AND-AXES, smoking-marches-2's serving (critic #2/#6/#10; the
 * critic's smoking verdict: "repeating tan plains with identical
 * dark-shard tufts" between the bookends). Ledger roads-and-axes.md.
 *
 * - **The pass-1→2 corridor** (u 630–780, the saddle road out of the
 *   caldera country): ONE reveal — a basalt gate whose lintel has
 *   slid (warm charcoal, the gorge's own stone); ONE companion shoal
 *   — the ember-dark warm-bellied file confined to the corridor; ONE
 *   light change — EMBER FLOOR POOLS (C7 + the province's own law:
 *   Smoulder light is WARM and RISING, from below — so the road's
 *   light lands on the floor, no column at all).
 *
 * - **The mid-down interior** at the critic's stand (985, −60): a
 *   dark-shard drift-line, two ember pools, a slow ember under-shoal.
 *   Ribbons gate on `restFree` (the Ladle, the Glass Hush, the
 *   Anvil's Shadow stay composed).
 */

const CORRIDOR_SEED = (SEEDS.regionSmoking2 ^ 0x0ad5_0a11) >>> 0;
const MIDDOWN_SEED = (SEEDS.regionSmoking2 ^ 0x0ad5_0b22) >>> 0;

const corridorFrame: RoadFrame = {
  azimuth: SMOKING2_SLOT.azimuth,
  worldOf,
  ground: (x, z) => Math.max(smokingTerrainTarget(x, z), smoking2TerrainTarget(x, z)),
};

const interiorFrame: RoadFrame = {
  azimuth: SMOKING2_SLOT.azimuth,
  worldOf,
  ground: smoking2TerrainTarget,
};

const EMBER_FISH = {
  scale: 0.84,
  color: 0x5a4038,
  emissive: 0x7a3a1a,
  profile: "fusilier",
} as const;

/** Shard families: warm charcoal over a violet-brown shade (never black). */
const SHARD_PALETTE = { base: 0x5a4a44, shade: 0x5c3a4a } as const;

export function buildSmoking2Roads(): RoadDressingBuild[] {
  const corridor = buildRoadDressing({
    seed: CORRIDOR_SEED,
    frame: corridorFrame,
    reveal: {
      kind: "fallen-lintel",
      u: 688,
      v: 9,
      gap: 6,
      scale: 1.1,
      color: 0x6a5a52,
    },
    corridorShoal: {
      u0: 645,
      u1: 755,
      sideV: 5.5,
      lift: 2.7,
      count: 24,
      fish: EMBER_FISH,
      periodSec: 115,
      braid: { lateral: 0.36, vertical: 0.26 },
    },
    lights: [
      {
        kind: "pools",
        tint: 0xffa860,
        pools: [
          { u: 664, v: -4, radius: 3.2, opacity: 0.2 },
          { u: 700, v: 4, radius: 2.8, opacity: 0.18 },
          { u: 736, v: -3, radius: 3.4, opacity: 0.2 },
        ],
      },
    ],
    ribbons: [-1, 1].map((side) => ({
      polyline: [
        [645, side * 3.6],
        [700, side * 4.4],
        [755, side * 3.2],
      ],
      width: 2.4,
      count: 130,
      palette: SHARD_PALETTE,
      shapeSet: "shard",
      grade: 0.6,
      gate: restFree,
    })),
  });

  const midDown = buildRoadDressing({
    seed: MIDDOWN_SEED,
    frame: interiorFrame,
    loopShoals: [
      {
        centerU: 985,
        centerV: -62,
        radiusU: 16,
        radiusV: 11,
        lift: 5.5,
        count: 14,
        fish: EMBER_FISH,
        periodSec: 150,
        braid: { lateral: 0.3, vertical: 0.22 },
      },
    ],
    lights: [
      {
        kind: "pools",
        tint: 0xff9a50,
        pools: [
          { u: 978, v: -68, radius: 2.6, opacity: 0.18 },
          { u: 994, v: -54, radius: 3.0, opacity: 0.2 },
        ],
      },
    ],
    ribbons: [
      {
        polyline: [
          [958, -48],
          [985, -60],
          [1014, -72],
        ],
        width: 5,
        count: 150,
        palette: SHARD_PALETTE,
        shapeSet: "shard",
        twoTone: true,
        grade: 0.5,
        gate: restFree,
      },
    ],
  });

  return [corridor, midDown];
}
