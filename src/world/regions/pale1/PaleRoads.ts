import { SEEDS } from "../../../util/Random";
import { buildRoadDressing, type RoadDressingBuild, type RoadFrame } from "../RoadDressing";
import { t1Free } from "./PaleFillShared";
import { PALE_SLOT, paleTerrainTarget, worldOf } from "./PaleTerrain";

/**
 * ROADS-AND-AXES, pale-passage-1's serving — the MID-DOWN AXIS only
 * (critic #6; pale's off-road roadside was "a lone banded purple disc
 * on bare sand"). The vale road's file is the region's own (hushFry,
 * 111 s); the pass corridors belong to the deeper regions per R3.
 * Ledger roads-and-axes.md.
 *
 * At the critic's stand (spoke (490, −60), the bone flats' south
 * flank): a bone-gravel drift-line and a slow pearl under-shoal.
 * NO dapple in pale — upheld; the down-look reads through VALUE
 * (paper-warm gravel over violet shade) and one quiet motion.
 * The ribbon gates on `t1Free` (the Quiet Gallery, the Mother's Pool,
 * the saddle crest and the aisle's swim line all stay composed).
 *
 * Budget note: the fill closed at 449,997 of the OLD 450k cap; MASTER
 * R12 raised the canon caps to 260 / 1.35M ("regions already filled
 * under the old caps get a quality re-pass ... headroom spend"), and
 * the region test's figure moves to the R12 number with this serving.
 */

const MIDDOWN_SEED = (SEEDS.regionPale1 ^ 0x0ad5_0b22) >>> 0;

const frame: RoadFrame = {
  azimuth: PALE_SLOT.azimuth,
  worldOf,
  ground: paleTerrainTarget,
};

export function buildPaleRoads(): RoadDressingBuild[] {
  const midDown = buildRoadDressing({
    seed: MIDDOWN_SEED,
    frame,
    loopShoals: [
      {
        centerU: 488,
        centerV: -58,
        radiusU: 15,
        radiusV: 10,
        lift: 5.5,
        count: 10,
        fish: { scale: 0.8, color: 0xeef2ea, emissive: 0x3c3e3a, profile: "tetra" },
        periodSec: 165,
        braid: { lateral: 0.28, vertical: 0.18 },
      },
    ],
    ribbons: [
      {
        polyline: [
          [466, -46],
          [490, -58],
          [516, -70],
        ],
        width: 4.5,
        count: 130,
        palette: { base: 0xe6e2d4, shade: 0x6f5c88 },
        shapeSet: "gravel",
        twoTone: true,
        grade: 0.5,
        gate: t1Free,
      },
    ],
  });

  return [midDown];
}
