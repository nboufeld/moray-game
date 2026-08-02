import { SEEDS } from "../../../util/Random";
import { smoking2TerrainTarget } from "../smoking2/Smoking2Terrain";
import { buildRoadDressing, type RoadDressingBuild, type RoadFrame } from "../RoadDressing";
import {
  SMOKING3_SLOT,
  channelCenter,
  smoking3TerrainTarget,
  worldOf,
} from "./Smoking3Terrain";

/**
 * ROADS-AND-AXES, smoking-marches-3's serving — the corridor into the
 * night country (the critic: "the night-threshold beat is emotionally
 * flat — a darker tan plain, not a threshold"). Ledger
 * roads-and-axes.md.
 *
 * Budget honesty: smoking-3 closed at 1,346,653 tris — 3.3k under the
 * R12 cap — so this is an ECONOMY serving (~2.9k): a low-ring leaning
 * pair, a 14-fish ember file, and a guide-line of three ember pools
 * stepping into the dark (the threshold's light change IS the light
 * dying — warm floor embers against deepening night; no column, per
 * the province's light-from-below law AND C7's variety rule).
 * No ribbons, no mid-down spend; the mid-down verdict is recorded in
 * the ledger.
 */

const CORRIDOR_SEED = (SEEDS.regionSmoking3 ^ 0x0ad5_0a11) >>> 0;

const corridorFrame: RoadFrame = {
  azimuth: SMOKING3_SLOT.azimuth,
  worldOf,
  ground: (x, z) => Math.max(smoking2TerrainTarget(x, z), smoking3TerrainTarget(x, z)),
};

const EMBER_FISH = {
  scale: 0.84,
  color: 0x5a4038,
  emissive: 0x7a3a1a,
  profile: "fusilier",
} as const;

export function buildSmoking3Roads(): RoadDressingBuild[] {
  const corridor = buildRoadDressing({
    seed: CORRIDOR_SEED,
    frame: corridorFrame,
    reveal: {
      // Centred on the corridor's own wandering swim-line, so the pair
      // straddles the road the diver actually swims (the channel test).
      kind: "leaning-pair",
      u: 1194,
      v: channelCenter(1194),
      gap: 5.5,
      scale: 1.1,
      color: 0x5c4a44,
    },
    corridorShoal: {
      u0: 1145,
      u1: 1270,
      sideV: 5,
      lift: 2.7,
      count: 14,
      fish: EMBER_FISH,
      periodSec: 120,
      braid: { lateral: 0.34, vertical: 0.24 },
    },
    lights: [
      {
        // The ember guide-line: three warm floor pools spaced INTO the
        // night threshold, dimming as they go — the walk's light story.
        kind: "pools",
        tint: 0xff9a50,
        pools: [
          { u: 1180, v: 3, radius: 3.2, opacity: 0.2 },
          { u: 1218, v: -4, radius: 2.8, opacity: 0.16 },
          { u: 1254, v: 2, radius: 2.4, opacity: 0.12 },
        ],
      },
    ],
  });

  return [corridor];
}
