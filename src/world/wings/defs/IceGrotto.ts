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
    fog: { colorScale: [0.92, 1.02, 1.14], densityGain: 0.01, backdropFade: 0.3 },
    light: { sun: 0.1, hemisphere: -0.12, ambient: 0.15 },
  },
  moodSurface: 12,
  moodDescent: 4,
  ceilingAtGate: 12,
  ceilingInside: 5.5,
  floorClearance: 0.7,
  seedKey: "wingIceGrotto",
};
