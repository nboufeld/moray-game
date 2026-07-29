import type { WingDef } from "../WingTypes";

/**
 * Wing 5 — the Moonlit Lagoon. Serenity: a still, silver-blue basin where
 * the key light dims to moonlight and the violet ambient rises, sparse
 * pale flora, slow sparkle motes, and the Moon Koi circling its pool.
 * The quietest place in the game — night without any of night's fear.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const MOONLIT_LAGOON: WingDef = {
  id: "moonlit-lagoon",
  title: "Moonlit Lagoon",
  emotion: "serenity, silver stillness",
  azimuth: 3.15,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -1.2,
    floorDepth: -3.2,
    shelfFrom: 35,
    shelfTo: 42,
    detailAmplitude: 0.25,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    fog: { colorScale: [0.62, 0.72, 0.98], densityGain: 0.008, backdropFade: 0.35 },
    light: { sun: 0.65, hemisphere: 0.3, ambient: -0.05 },
  },
  moodSurface: 12,
  moodDescent: 5,
  ceilingAtGate: 12,
  ceilingInside: 9,
  floorClearance: 0.7,
  seedKey: "wingMoonlitLagoon",
};
