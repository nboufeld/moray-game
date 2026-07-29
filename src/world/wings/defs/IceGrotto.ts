import { MathUtils } from "three";
import type { WingDef } from "../WingTypes";

/**
 * Wing 12 — the Ice Grotto. Hushed crystalline calm: the lowest roof in
 * the game pressing the light down over pale blue-white water, crystal
 * spires and frost-pale flora, a cold that reads as stillness rather than
 * hostility, and the frost moray coiled in its blue den. Every sound here
 * would echo if sounds did.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const ICE_GROTTO: WingDef = {
  id: "ice-grotto",
  title: "Ice Grotto",
  emotion: "hushed crystalline calm",
  azimuth: 5.67,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -1.4,
    floorDepth: -4.4,
    shelfFrom: 35,
    shelfTo: 42,
    detailAmplitude: 0.3,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    // Pale and cold, never dark: the water lifts blue over green with red
    // nearly held, the key softens a touch, and the brightened fill is what
    // keeps the low roof from reading as a cave. Hush, not hostility.
    fog: { colorScale: [0.92, 1.02, 1.14], densityGain: 0.011, backdropFade: 0.36 },
    light: { sun: 0.14, hemisphere: -0.12, ambient: 0.16 },
  },
  moodSurface: 12,
  moodDescent: 4,
  ceilingAtGate: 12,
  ceilingInside: 5.5,
  floorClearance: 0.7,
  seedKey: "wingIceGrotto",
  /**
   * Frost dusting: a pale cool lift on the baked sand colours, strongest
   * low where frost settles and easing to nothing at the wedge's edges —
   * the identity-at-the-edge contract every paint keeps.
   */
  paint: (_x, _z, y, blend) => {
    if (blend < 0.02) {
      return null;
    }
    const low = MathUtils.smoothstep(-y, 1.6, 4.6);
    const w = blend * (0.3 + 0.7 * low);
    return [1 + 0.015 * w, 1 + 0.045 * w, 1 + 0.095 * w];
  },
};
