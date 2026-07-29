import type { WingDef } from "../WingTypes";

/**
 * Wing 10 — the Mangrove Roots. Intimacy and shelter: the shallowest,
 * lowest-ceilinged wing, a maze of prop-root columns with amber light
 * dappling down between them, close warm water, small fish threading the
 * roots. The game's blanket fort.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const MANGROVE_ROOTS: WingDef = {
  id: "mangrove-roots",
  title: "Mangrove Roots",
  emotion: "intimacy, sheltered warmth",
  azimuth: 4.95,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -0.6,
    floorDepth: -1.4,
    shelfFrom: 34,
    shelfTo: 40,
    detailAmplitude: 0.2,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    // Close warm water, amber through a low roof: the backdrop dissolves
    // early (shelter has no horizon) and the sun dapples rather than blazes.
    fog: { colorScale: [1.05, 0.88, 0.58], densityGain: 0.016, backdropFade: 0.5 },
    light: { sun: 0.3, hemisphere: 0.32, ambient: 0.08 },
  },
  moodSurface: 12,
  moodDescent: 3,
  // Warm sand under the roots — the amber of the water written on the floor.
  paint: (_x, _z, _y, blend) => {
    const k = blend * blend * (3 - 2 * blend);
    return [1 + 0.07 * k, 1 + 0.02 * k, 1 - 0.08 * k];
  },
  ceilingAtGate: 12,
  ceilingInside: 6,
  floorClearance: 0.7,
  seedKey: "wingMangroveRoots",
};
