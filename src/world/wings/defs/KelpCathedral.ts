import type { WingDef } from "../WingTypes";

/**
 * Wing 0 — the Kelp Cathedral. Awe and reverence: giant kelp columns rising
 * the full height of a vault the ceiling barely lowers, god-light falling in
 * shafts between them, emerald water that keeps its sun. The diver should
 * feel the way a nave makes you lower your voice.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const KELP_CATHEDRAL: WingDef = {
  id: "kelp-cathedral",
  title: "Kelp Cathedral",
  emotion: "awe, hush, reverence",
  azimuth: 1.35,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -1.8,
    floorDepth: -5.5,
    shelfFrom: 36,
    shelfTo: 43,
    detailAmplitude: 0.3,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    fog: { colorScale: [0.62, 0.88, 0.66], densityGain: 0.01, backdropFade: 0.3 },
    light: { sun: 0.25, hemisphere: 0.3, ambient: 0.1 },
  },
  moodSurface: 12,
  moodDescent: 6,
  ceilingAtGate: 12,
  ceilingInside: 11,
  floorClearance: 0.7,
  seedKey: "wingKelpCathedral",
};
