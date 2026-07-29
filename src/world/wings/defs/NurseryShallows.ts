import type { WingDef } from "../WingTypes";

/**
 * Wing 1 — the Nursery Shallows. Tenderness and hope: the one wing whose
 * floor *rises* — a sun-warmed sand terrace above the bowl's own level,
 * water clearer and brighter than home, baby corals in neat scatters,
 * anemone patches, and the golden dwarf moray. Everything here is small,
 * gentle, and lit like ten in the morning.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const NURSERY_SHALLOWS: WingDef = {
  id: "nursery-shallows",
  title: "Nursery Shallows",
  emotion: "tenderness, hope, morning",
  azimuth: 1.71,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -0.6,
    floorDepth: 1.6,
    shelfFrom: 35,
    shelfTo: 42,
    detailAmplitude: 0.15,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    fog: { colorScale: [1.12, 1.1, 1.02], densityGain: -0.01, backdropFade: -0.08 },
    light: { sun: -0.12, hemisphere: -0.1, ambient: -0.05 },
  },
  moodSurface: 12,
  moodDescent: 4,
  ceilingAtGate: 12,
  ceilingInside: 9,
  floorClearance: 0.7,
  seedKey: "wingNurseryShallows",
};
