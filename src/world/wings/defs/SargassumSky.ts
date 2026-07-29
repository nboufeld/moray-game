import type { WingDef } from "../WingTypes";

/**
 * Wing 13 — the Sargassum Sky. Dreamlike inversion: a golden weed canopy
 * hung overhead like a second surface, amber light filtering through it
 * in moving patches, the floor kept simple so the ceiling is the scene.
 * The Island That Swims — the colossal turtle elder — drifts beneath its
 * own garden here. The one wing you are meant to look *up* in.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const SARGASSUM_SKY: WingDef = {
  id: "sargassum-sky",
  title: "Sargassum Sky",
  emotion: "dreamlike inversion, golden light",
  azimuth: 6.03,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -1.2,
    floorDepth: -3.4,
    shelfFrom: 35,
    shelfTo: 42,
    detailAmplitude: 0.25,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    fog: { colorScale: [1.04, 0.92, 0.58], densityGain: 0.012, backdropFade: 0.4 },
    light: { sun: 0.35, hemisphere: 0.2, ambient: -0.05 },
  },
  moodSurface: 12,
  moodDescent: 5,
  ceilingAtGate: 12,
  ceilingInside: 10,
  floorClearance: 0.7,
  seedKey: "wingSargassumSky",
};
