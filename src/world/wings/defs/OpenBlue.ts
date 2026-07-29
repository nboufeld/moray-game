import type { WingDef } from "../WingTypes";

/**
 * Wing 11 — the Open Blue. Vertigo and freedom: the drop-off. The deepest
 * floor in the game falling away under clear, vast, empty blue; the
 * backdrop dissolves, the ceiling stays high, and the space itself is the
 * subject. The Old Current patrols the middle water and the Gentle Dark
 * rises past the far curtain. Emptiness composed on purpose — nothing may
 * clutter this wing.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const OPEN_BLUE: WingDef = {
  id: "open-blue",
  title: "The Open Blue",
  emotion: "vertigo, freedom, vastness",
  azimuth: 5.31,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -2.6,
    floorDepth: -14,
    shelfFrom: 36,
    shelfTo: 46,
    detailAmplitude: 0.4,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    fog: { colorScale: [0.55, 0.68, 0.9], densityGain: -0.004, backdropFade: 0.55 },
    light: { sun: 0.35, hemisphere: 0.2, ambient: 0.05 },
  },
  moodSurface: 12,
  moodDescent: 9,
  ceilingAtGate: 12,
  ceilingInside: 11,
  floorClearance: 0.7,
  seedKey: "wingOpenBlue",
};
