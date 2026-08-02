import { SEEDS } from "../../../util/Random";
import { buildRoadDressing, type RoadDressingBuild, type RoadFrame } from "../RoadDressing";
import { CALAMITY_SLOT, calamityTerrainTarget, worldOf } from "./CalamityTerrain";

/**
 * ROADS-AND-AXES, sunken-calamity-1's serving — the 490 m MARCH is
 * this world's eleventh corridor (critic #2; also #13's "confetti"
 * note: the mid-march wanted a COMPOSED wreck, not more scatter).
 * Ledger roads-and-axes.md.
 *
 * - ONE reveal — a bent-spar rib pair breaking the sand at u 162,
 *   framed dead-centre by the authored mid-march pose (118 → 165):
 *   the first rib of the whale the province ends on, a promise in
 *   the region's own grey.
 * - The companion shoal is the region's EXISTING march runner
 *   (CalamityFillLife: 22 grey fish, u 96–308, 125 s) — sparse and
 *   slow per the melancholy row, and it already stops WELL before
 *   the Suffocated Mile (u 352–440), whose grief clause admits no
 *   shoal and no new glow. Nothing here enters the Mile, the
 *   Gardener's ten metres (u 253), or any registered rest.
 * - ONE light change — a single COLD slanted blade at u 208 (C7:
 *   broken shaft; Calamity light is cold and settling, so the blade
 *   arrives pale grey-green, low opacity, and lands on no pool).
 *
 * The mid-down axis here already holds (the critic: "the mid-down
 * actually has content — palm crowns, drifting debris, a dark hull
 * mass") — verdict recorded, nothing added; the grief register is
 * not decorated.
 */

const CORRIDOR_SEED = (SEEDS.regionCalamity ^ 0x0ad5_0a11) >>> 0;

const frame: RoadFrame = {
  azimuth: CALAMITY_SLOT.azimuth,
  worldOf,
  ground: calamityTerrainTarget,
};

/** The cold blade's head, metres over the march floor. */
const BLADE_RISE = 14;

export function buildCalamityRoads(): RoadDressingBuild[] {
  const bladeAt = worldOf(208, -7);
  const march = buildRoadDressing({
    seed: CORRIDOR_SEED,
    frame,
    reveal: {
      kind: "ribs",
      u: 162,
      v: 9,
      gap: 6,
      scale: 1.2,
      color: 0x8d887a,
    },
    lights: [
      {
        kind: "shafts",
        tint: 0xbcd2c8,
        beams: [
          {
            u: 208,
            v: -7,
            top: frame.ground(bladeAt.x, bladeAt.z) + BLADE_RISE,
            width: 3.0,
            opacity: 0.12,
            slant: [0.32, 0.16],
          },
        ],
        pools: "none",
      },
    ],
  });

  return [march];
}
