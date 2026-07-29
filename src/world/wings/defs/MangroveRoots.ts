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
    fog: { colorScale: [1.02, 0.88, 0.62], densityGain: 0.014, backdropFade: 0.45 },
    light: { sun: 0.25, hemisphere: 0.35, ambient: 0.05 },
  },
  moodSurface: 12,
  moodDescent: 3,
  ceilingAtGate: 12,
  ceilingInside: 6,
  floorClearance: 0.7,
  seedKey: "wingMangroveRoots",
};
