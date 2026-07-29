import type { WingDef } from "../WingTypes";

/**
 * Wing 4 — the Vent Springs. Otherworldly warmth: mineral chimneys on a
 * charcoal floor, columns of shimmer and slow bubbles, water gone
 * warm-grey with amber held in it, and the ember moray glowing in the
 * gloom. The one hot place in a cool game — strange, not hostile.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const VENT_SPRINGS: WingDef = {
  id: "vent-springs",
  title: "Vent Springs",
  emotion: "otherworldly warmth, strangeness",
  azimuth: 2.79,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -2.2,
    floorDepth: -7.5,
    shelfFrom: 36,
    shelfTo: 43,
    detailAmplitude: 0.35,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    fog: { colorScale: [0.8, 0.55, 0.42], densityGain: 0.02, backdropFade: 0.5 },
    light: { sun: 0.55, hemisphere: 0.55, ambient: 0.1 },
  },
  moodSurface: 4,
  moodDescent: 5,
  ceilingAtGate: 12,
  ceilingInside: 7,
  floorClearance: 0.7,
  seedKey: "wingVentSprings",
};
