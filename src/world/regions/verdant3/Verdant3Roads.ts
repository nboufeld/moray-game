import { SEEDS } from "../../../util/Random";
import { verdant2TerrainTarget } from "../verdant2/Verdant2Terrain";
import { buildRoadDressing, type RoadDressingBuild, type RoadFrame } from "../RoadDressing";
import {
  VERDANT3_SLOT,
  channelCenter,
  verdant3TerrainTarget,
  worldOf,
} from "./Verdant3Terrain";

/**
 * ROADS-AND-AXES, verdant-line-3's serving (critic #2/#6/#10; ledger
 * roads-and-axes.md). Budget honesty: closed at 1,344,208 — ~5.8k of
 * headroom — a measured serving.
 *
 * - **The pass-2→3 corridor** (u 1136–1268, into the Canopy Deep):
 *   ONE reveal — a jade SWIM-THROUGH ARCH straddling the corridor's
 *   own wandering channel (a hole is an invitation — the reveal that
 *   breaks the walk is the one you pass through); the companion shoal
 *   is the region's EXISTING traveller (40 silver-green fish confined
 *   to u 1136–1268 on a ~91 s loop); ONE light change — a canopy
 *   BACKLIGHT blade slanted behind the arch (C7: silhouette
 *   backlight, not the vertical god-shaft), with its floor pool.
 *
 * - **The mid-down interior** at the critic's stand (1505, −60): one
 *   soft leaf-light dapple — the canopy country's own down-look
 *   speaks mostly through its existing floor; the dapple gives the
 *   two-tone wash its third value.
 */

const CORRIDOR_SEED = (SEEDS.regionVerdant3 ^ 0x0ad5_0a11) >>> 0;
const MIDDOWN_SEED = (SEEDS.regionVerdant3 ^ 0x0ad5_0b22) >>> 0;

const corridorFrame: RoadFrame = {
  azimuth: VERDANT3_SLOT.azimuth,
  worldOf,
  ground: (x, z) => Math.max(verdant2TerrainTarget(x, z), verdant3TerrainTarget(x, z)),
};

const interiorFrame: RoadFrame = {
  azimuth: VERDANT3_SLOT.azimuth,
  worldOf,
  ground: verdant3TerrainTarget,
};

/** The backlight blade's head, metres over the corridor floor. */
const BACKLIGHT_RISE = 16;

export function buildVerdant3Roads(): RoadDressingBuild[] {
  const backlightAt = worldOf(1216, channelCenter(1216) + 4);
  const corridor = buildRoadDressing({
    seed: CORRIDOR_SEED,
    frame: corridorFrame,
    reveal: {
      kind: "arch",
      u: 1202,
      v: channelCenter(1202),
      gap: 6.5,
      scale: 1.0,
      color: 0x8fa189,
    },
    lights: [
      {
        kind: "shafts",
        tint: 0xd9f2b8,
        beams: [
          {
            u: 1216,
            v: channelCenter(1216) + 4,
            top:
              corridorFrame.ground(backlightAt.x, backlightAt.z) + BACKLIGHT_RISE,
            width: 4.2,
            opacity: 0.16,
            slant: [-0.4, 0.22],
          },
        ],
        pools: "auto",
      },
    ],
  });

  const midDown = buildRoadDressing({
    seed: MIDDOWN_SEED,
    frame: interiorFrame,
    lights: [
      {
        kind: "dapple",
        tint: 0xd8f0c0,
        centerU: 1505,
        centerV: -60,
        radius: 9,
        opacity: 0.08,
        tileMetres: 10,
      },
    ],
  });

  return [corridor, midDown];
}
