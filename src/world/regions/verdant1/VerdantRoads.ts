import { SEEDS } from "../../../util/Random";
import { buildRoadDressing, type RoadDressingBuild, type RoadFrame } from "../RoadDressing";
import { restFree } from "./VerdantFillShared";
import { VERDANT_SLOT, verdantTerrainTarget, worldOf } from "./VerdantTerrain";

/**
 * ROADS-AND-AXES, verdant-line-1's serving — the MID-DOWN AXIS only
 * (critic #6: "mid-water looking down is a featureless two-tone wash";
 * the critic's own off-spine verdant verdict: "a gradient wash with
 * sprigs"). The vale road and its runner are already this region's
 * (VerdantFillLife's 91 s vale file); the pass corridors belong to the
 * deeper regions per R3. Ledger roads-and-axes.md.
 *
 * At the critic's stand (spoke (490, −60), the meadow's south flank):
 * a spring-green dapple, a moss-litter drift-line, and a slow
 * silver-green under-shoal at mid-height — three values and one
 * motion where there were two values and none. Clear of the Sunwell
 * bowl (475, 58, r 34 — fauna-free) and every registered rest; the
 * ribbon gates on `restFree`.
 */

const MIDDOWN_SEED = (SEEDS.regionVerdant1 ^ 0x0ad5_0b22) >>> 0;

const frame: RoadFrame = {
  azimuth: VERDANT_SLOT.azimuth,
  worldOf,
  ground: verdantTerrainTarget,
};

export function buildVerdantRoads(): RoadDressingBuild[] {
  const midDown = buildRoadDressing({
    seed: MIDDOWN_SEED,
    frame,
    loopShoals: [
      {
        centerU: 488,
        centerV: -58,
        radiusU: 16,
        radiusV: 10,
        lift: 6,
        count: 12,
        fish: { scale: 0.8, color: 0xc2e2b6, profile: "fusilier" },
        periodSec: 160,
        braid: { lateral: 0.3, vertical: 0.2 },
      },
    ],
    lights: [
      {
        kind: "dapple",
        tint: 0xd8f0b8,
        centerU: 490,
        centerV: -60,
        radius: 12,
        opacity: 0.08,
        tileMetres: 10,
      },
    ],
    ribbons: [
      {
        polyline: [
          [464, -46],
          [490, -58],
          [518, -70],
        ],
        width: 4.5,
        count: 130,
        palette: { base: 0x7a8a4e, shade: 0x5c5a74 },
        shapeSet: "pebble",
        twoTone: true,
        grade: 0.5,
        gate: restFree,
      },
    ],
  });

  return [midDown];
}
