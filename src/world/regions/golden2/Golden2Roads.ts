import { SEEDS } from "../../../util/Random";
import { goldenTerrainTarget } from "../golden1/GoldenTerrain";
import { buildRoadDressing, type RoadDressingBuild, type RoadFrame } from "../RoadDressing";
import { restFree } from "./Golden2Beats";
import { CAPROCK_STONE, CARVED_PALE, STONE_DUSK } from "./Golden2Shared";
import { GOLDEN2_SLOT, golden2TerrainTarget, worldOf } from "./Golden2Terrain";

/**
 * ROADS-AND-AXES, golden-waste-2's serving (critic #2/#6/#10; ledger
 * docs/region-ledger/roads-and-axes.md). Two calls on fresh substreams
 * of the region's own seed, appended after every existing module:
 *
 * - **The pass-1→2 corridor** (R3: this region owns the tongue,
 *   u 630–780): ONE reveal — a caprock waymark pair leaning over the
 *   shore road (the Gilded Shore's own stone, bowed by the current);
 *   ONE companion shoal — the Hourglass gold file confined to the
 *   corridor loop, so the road always has its witness; ONE light
 *   change — the province's honey dapple pooled on the road (golden's
 *   own light row; the sentence VARIED from the god-shaft per C7);
 *   plus two wear-line ribbons so the road reads as travelled from
 *   above (C3).
 *
 * - **The mid-down interior** (C3's `-02-mid-down` stand, spoke
 *   (985, −60)): a honey dapple pool, a drift ribbon of carved-pale
 *   grit angling across the pan, and a slow gold under-shoal ellipse —
 *   quiet, not dead. Placements hold clear of both registered rests
 *   (the Pavement, the Anchorite's Cell); ribbons gate on `restFree`.
 */

const CORRIDOR_SEED = (SEEDS.regionGolden2 ^ 0x0ad5_0a11) >>> 0;
const MIDDOWN_SEED = (SEEDS.regionGolden2 ^ 0x0ad5_0b22) >>> 0;

/** Corridor country is overlap country: the composed floor is the max. */
const corridorFrame: RoadFrame = {
  azimuth: GOLDEN2_SLOT.azimuth,
  worldOf,
  ground: (x, z) => Math.max(goldenTerrainTarget(x, z), golden2TerrainTarget(x, z)),
};

const interiorFrame: RoadFrame = {
  azimuth: GOLDEN2_SLOT.azimuth,
  worldOf,
  ground: golden2TerrainTarget,
};

const GOLD_FISH = { scale: 0.82, color: 0xf2da9a, emissive: 0x9a7a30 } as const;

export function buildGolden2Roads(): RoadDressingBuild[] {
  const corridor = buildRoadDressing({
    seed: CORRIDOR_SEED,
    frame: corridorFrame,
    reveal: {
      kind: "leaning-pair",
      u: 692,
      v: 8,
      gap: 6,
      scale: 1.15,
      color: CAPROCK_STONE,
    },
    corridorShoal: {
      u0: 645,
      u1: 755,
      sideV: 5,
      lift: 2.6,
      count: 26,
      fish: { ...GOLD_FISH, profile: "fusilier" },
      periodSec: 110,
      braid: { lateral: 0.36, vertical: 0.22 },
      glint: { count: 16, size: 0.11 },
    },
    lights: [
      {
        // Golden-1's own measured dapple discipline (opacity 0.06–0.09,
        // tile 12): hotter reads as a pale PLATE at grazing angles —
        // the C4 card sin this wave exists to avoid.
        kind: "dapple",
        tint: 0xffca6e,
        centerU: 700,
        centerV: 0,
        radius: 16,
        opacity: 0.08,
        tileMetres: 12,
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
      palette: { base: CARVED_PALE, shade: STONE_DUSK },
      shapeSet: "gravel",
      grade: 0.6,
    })),
  });

  const midDown = buildRoadDressing({
    seed: MIDDOWN_SEED,
    frame: interiorFrame,
    loopShoals: [
      {
        centerU: 982,
        centerV: -58,
        radiusU: 18,
        radiusV: 12,
        lift: 6,
        count: 16,
        fish: { ...GOLD_FISH, profile: "fusilier" },
        periodSec: 150,
        braid: { lateral: 0.3, vertical: 0.2 },
      },
    ],
    lights: [
      {
        kind: "dapple",
        tint: 0xffca6e,
        centerU: 985,
        centerV: -60,
        radius: 18,
        opacity: 0.09,
        tileMetres: 12,
      },
    ],
    ribbons: [
      {
        // A grit drift angling across the pan under the stand — the
        // wind's own wear-line, gated off both rests.
        polyline: [
          [955, -46],
          [985, -58],
          [1016, -68],
        ],
        width: 5,
        count: 170,
        palette: { base: CARVED_PALE, shade: STONE_DUSK },
        shapeSet: "grit",
        twoTone: true,
        grade: 0.5,
        gate: restFree,
      },
    ],
  });

  return [corridor, midDown];
}
