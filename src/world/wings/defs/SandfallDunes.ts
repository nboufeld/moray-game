import type { WingDef } from "../WingTypes";

/**
 * Wing 14 — the Sandfall Dunes. Meditation: tall dune walls in warm
 * neutrals, ribbons of sand spilling slowly over their lips like
 * waterfalls in no hurry, the palette of the bowl's own sand taken to
 * its quietest register. The place a player goes to think.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const SANDFALL_DUNES: WingDef = {
  id: "sandfall-dunes",
  title: "Sandfall Dunes",
  emotion: "meditation, warm quiet",
  azimuth: 6.39,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -1.6,
    floorDepth: -5.0,
    shelfFrom: 35,
    shelfTo: 43,
    detailAmplitude: 0.5,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    // Warm tan water, a hair thicker than the bowl's, the rig gently
    // lowered all round: the quietest register of the reef's own palette.
    fog: { colorScale: [1.0, 0.9, 0.72], densityGain: 0.009, backdropFade: 0.34 },
    light: { sun: 0.15, hemisphere: 0.1, ambient: 0.06 },
  },
  moodSurface: 10,
  moodDescent: 5,
  ceilingAtGate: 12,
  ceilingInside: 8,
  floorClearance: 0.7,
  seedKey: "wingSandfallDunes",
  /**
   * Warm cream lift: pale dunes in soft light — red and green up a touch,
   * blue down — identity at the wedge's edges per the paint contract.
   */
  paint: (_x, _z, _y, blend) => {
    if (blend < 0.02) {
      return null;
    }
    const w = blend;
    return [1 + 0.045 * w, 1 + 0.018 * w, 1 - 0.03 * w];
  },
};
