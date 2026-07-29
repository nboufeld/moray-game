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
    // Gold-green water like light through old glass — bright, never dim:
    // majesty without menace is a value story, so the sun is barely touched.
    fog: { colorScale: [0.86, 0.88, 0.64], densityGain: 0.01, backdropFade: 0.3 },
    light: { sun: 0.22, hemisphere: 0.22, ambient: 0.08 },
  },
  moodSurface: 8,
  moodDescent: 4.5,
  // The terrace floor wears the moss its monuments do: a gold-green wash
  // over the baked sand, easing to identity at the wedge's edges.
  paint: (_x, _z, _y, blend) => {
    const k = blend * blend * (3 - 2 * blend);
    return [1 + 0.05 * k, 1 + 0.035 * k, 1 - 0.1 * k];
  },
  ceilingAtGate: 12,
  ceilingInside: 9,
  floorClearance: 0.7,
  seedKey: "wingRuinsTerrace",
};
