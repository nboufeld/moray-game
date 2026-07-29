import type { WingDef } from "../WingTypes";

/**
 * Wing 9 — the Ruins Terrace. Majesty and mystery: mossed stone arches and
 * fallen columns on stepped shelves, gold-green water like light through
 * old glass, and the Reef Kirin grazing between the stones. Ancient in
 * the storybook way — no menace, just scale and time.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const RUINS_TERRACE: WingDef = {
  id: "ruins-terrace",
  title: "Ruins Terrace",
  emotion: "majesty, ancient mystery",
  azimuth: 4.59,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -2.0,
    floorDepth: -6.6,
    shelfFrom: 35,
    shelfTo: 44,
    detailAmplitude: 0.3,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    fog: { colorScale: [0.82, 0.86, 0.62], densityGain: 0.012, backdropFade: 0.35 },
    light: { sun: 0.3, hemisphere: 0.25, ambient: 0.12 },
  },
  moodSurface: 8,
  moodDescent: 5,
  ceilingAtGate: 12,
  ceilingInside: 9,
  floorClearance: 0.7,
  seedKey: "wingRuinsTerrace",
};
