import { SEEDS } from "../../../util/Random";
import { golden2TerrainTarget } from "../golden2/Golden2Terrain";
import { buildRoadDressing, type RoadDressingBuild, type RoadFrame } from "../RoadDressing";
import { restFree } from "./Golden3Beats";
import { CARVED_PALE, DUSK_STONE, STONE_DUSK } from "./Golden3Shared";
import { GOLDEN3_SLOT, golden3TerrainTarget, worldOf } from "./Golden3Terrain";

/**
 * ROADS-AND-AXES, golden-waste-3's serving (critic #2/#6/#10 + #14's
 * "featureless dune face off the spine"; ledger roads-and-axes.md).
 *
 * - **The pass-2→3 corridor** (R3: this region owns the tongue,
 *   u 1130–1300): ONE reveal — a toppled tower drum (the noon-bell
 *   vocabulary, fallen: two jambs and the slid lintel in dusk stone);
 *   ONE companion shoal — the gold file on the corridor loop; ONE
 *   light change — evening SILHOUETTE BACKLIGHT (C7: not the vertical
 *   god-shaft — one wide amber blade slanted low behind the drum, so
 *   the reveal reads as a shape against light), plus wear-line ribbons.
 *
 * - **The mid-down interior** at the critic's stand (1505, −60): honey
 *   dapple, a grit drift-line, a slow gold under-shoal — the Vesper
 *   Strand's own quiet. Ribbons gate on `restFree` (the Still Mirror
 *   and the Door threshold stay composed).
 */

const CORRIDOR_SEED = (SEEDS.regionGolden3 ^ 0x0ad5_0a11) >>> 0;
const MIDDOWN_SEED = (SEEDS.regionGolden3 ^ 0x0ad5_0b22) >>> 0;

const corridorFrame: RoadFrame = {
  azimuth: GOLDEN3_SLOT.azimuth,
  worldOf,
  ground: (x, z) => Math.max(golden2TerrainTarget(x, z), golden3TerrainTarget(x, z)),
};

const interiorFrame: RoadFrame = {
  azimuth: GOLDEN3_SLOT.azimuth,
  worldOf,
  ground: golden3TerrainTarget,
};

const GOLD_FISH = { scale: 0.82, color: 0xf2da9a, emissive: 0x9a7a30 } as const;

/** The backlight blade's head, metres over the corridor floor at its foot. */
const BACKLIGHT_RISE = 15;

export function buildGolden3Roads(): RoadDressingBuild[] {
  const backlightAt = worldOf(1206, -9);
  const corridor = buildRoadDressing({
    seed: CORRIDOR_SEED,
    frame: corridorFrame,
    reveal: {
      kind: "fallen-lintel",
      u: 1196,
      v: -9,
      gap: 6,
      scale: 1.2,
      color: DUSK_STONE,
    },
    corridorShoal: {
      u0: 1145,
      u1: 1275,
      sideV: 5,
      lift: 2.6,
      count: 24,
      fish: { ...GOLD_FISH, profile: "fusilier" },
      periodSec: 120,
      braid: { lateral: 0.36, vertical: 0.22 },
      glint: { count: 14, size: 0.11 },
    },
    lights: [
      {
        kind: "shafts",
        tint: 0xf4c47a,
        beams: [
          {
            u: 1206,
            v: -9,
            top:
              corridorFrame.ground(backlightAt.x, backlightAt.z) + BACKLIGHT_RISE,
            width: 5.5,
            opacity: 0.18,
            // Evening light arrives low and from the province's sunset
            // pole: the head drifts hard back along the road and aside.
            slant: [-0.55, 0.18],
          },
        ],
        pools: "auto",
      },
    ],
    ribbons: [-1, 1].map((side) => ({
      polyline: [
        [1145, side * 3.6],
        [1210, side * 4.4],
        [1275, side * 3.2],
      ],
      width: 2.4,
      count: 120,
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
        centerU: 1502,
        centerV: -58,
        radiusU: 18,
        radiusV: 12,
        lift: 6,
        count: 14,
        fish: { ...GOLD_FISH, profile: "fusilier" },
        periodSec: 150,
        braid: { lateral: 0.3, vertical: 0.2 },
      },
    ],
    lights: [
      {
        kind: "dapple",
        tint: 0xffca6e,
        centerU: 1505,
        centerV: -60,
        radius: 18,
        opacity: 0.09,
        tileMetres: 12,
      },
    ],
    ribbons: [
      {
        polyline: [
          [1476, -46],
          [1505, -58],
          [1536, -70],
        ],
        width: 5,
        count: 160,
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
