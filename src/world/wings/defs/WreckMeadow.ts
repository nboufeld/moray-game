import type { WingDef } from "../WingTypes";

/**
 * Wing 3 — the Wreck Meadow. Melancholy and curiosity: the ribs of an old
 * hull half-swallowed by a seagrass meadow, rust-warm accents against
 * teal-grey water, light kept low and even like an overcast afternoon.
 * Nothing here is a threat; everything here is a story already over.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const WRECK_MEADOW: WingDef = {
  id: "wreck-meadow",
  title: "Wreck Meadow",
  emotion: "melancholy, gentle curiosity",
  azimuth: 2.43,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -2.0,
    floorDepth: -6,
    shelfFrom: 36,
    shelfTo: 43,
    detailAmplitude: 0.3,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    fog: { colorScale: [0.74, 0.62, 0.55], densityGain: 0.012, backdropFade: 0.4 },
    light: { sun: 0.45, hemisphere: 0.4, ambient: 0.15 },
  },
  moodSurface: 6,
  moodDescent: 5,
  ceilingAtGate: 12,
  ceilingInside: 8,
  floorClearance: 0.7,
  seedKey: "wingWreckMeadow",
};
