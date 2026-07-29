import type { WingDef } from "../WingTypes";

/**
 * Wing 8 — the Current Run. Exhilaration: a long clean channel where the
 * water itself is going somewhere — grass banners all bent one way,
 * streaming bubble lines, clear rushing turquoise, the one place in the
 * game built for speed instead of drift. The longest shelf ramp of any
 * wing, so the floor itself feels like a run.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const CURRENT_RUN: WingDef = {
  id: "current-run",
  title: "Current Run",
  emotion: "exhilaration, clean speed",
  azimuth: 4.23,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -1.8,
    floorDepth: -5.2,
    shelfFrom: 34,
    shelfTo: 46,
    detailAmplitude: 0.25,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    // Rushing turquoise, and the longest sightline of the three: the water
    // clears (negative density gain), barely any backdrop is given up —
    // speed needs somewhere to go, and somewhere to go needs a far end you
    // can see. Green-blue lifted, red held a step under per the value key.
    fog: { colorScale: [0.94, 1.06, 1.07], densityGain: -0.012, backdropFade: 0.08 },
    light: { sun: -0.05, hemisphere: -0.07, ambient: 0 },
  },
  moodSurface: 12,
  moodDescent: 6,
  ceilingAtGate: 12,
  ceilingInside: 8,
  floorClearance: 0.7,
  seedKey: "wingCurrentRun",
};
