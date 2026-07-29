import type { WingDef } from "../WingTypes";

/**
 * Wing 2 — the Lumen Garden. Wonder and mystery: the deepest dark in the
 * game, an indigo night where the flora itself carries the light —
 * bioluminescent polyp beds, lantern kelp, drifting mote constellations,
 * and the Crown Jelly Sovereign rising slowly through its own glow. The
 * water closes in; the garden answers.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const LUMEN_GARDEN: WingDef = {
  id: "lumen-garden",
  title: "Lumen Garden",
  emotion: "wonder, deep-night mystery",
  azimuth: 2.07,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -2.5,
    floorDepth: -10,
    shelfFrom: 36,
    shelfTo: 44,
    detailAmplitude: 0.35,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    fog: { colorScale: [0.3, 0.24, 0.55], densityGain: 0.034, backdropFade: 0.7 },
    light: { sun: 0.85, hemisphere: 0.7, ambient: 0.25 },
  },
  moodSurface: 0.45,
  moodDescent: 5,
  ceilingAtGate: 12,
  ceilingInside: 6,
  floorClearance: 0.7,
  seedKey: "wingLumenGarden",
};
