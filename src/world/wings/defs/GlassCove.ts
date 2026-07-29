import type { WingDef } from "../WingTypes";

/**
 * Wing 6 — the Sea-Glass Cove. Playfulness and nostalgia: drifts of
 * tumbled glass pebbles in pastel aquas and pinks, bright clear water,
 * light glinting off the drifts, and the shy Kraken Hatchling peeking
 * from its pebble den. A tide-pool toybox at swimming size.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const GLASS_COVE: WingDef = {
  id: "glass-cove",
  title: "Sea-Glass Cove",
  emotion: "playfulness, bright nostalgia",
  azimuth: 3.51,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -0.9,
    floorDepth: -2.6,
    shelfFrom: 35,
    shelfTo: 41,
    detailAmplitude: 0.25,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    fog: { colorScale: [1.06, 1.04, 1.08], densityGain: -0.006, backdropFade: 0.05 },
    light: { sun: -0.06, hemisphere: -0.08, ambient: 0 },
  },
  moodSurface: 12,
  moodDescent: 4,
  ceilingAtGate: 12,
  ceilingInside: 9,
  floorClearance: 0.7,
  seedKey: "wingGlassCove",
};
