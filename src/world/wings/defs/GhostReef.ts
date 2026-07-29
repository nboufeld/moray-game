import type { WingDef } from "../WingTypes";

/**
 * Wing 7 — the Ghost Reef. Quiet sorrow turning to recovery: a bleached
 * coral stand, bone-pale and milky-watered, with patches of returning
 * colour scattered through it — the story told spatially, white at the
 * gate, colour deepening toward the far end where the pearl moray keeps
 * its den. Grief with a door out of it.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const GHOST_REEF: WingDef = {
  id: "ghost-reef",
  title: "Ghost Reef",
  emotion: "quiet sorrow, recovery",
  azimuth: 3.87,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -1.5,
    floorDepth: -4.2,
    shelfFrom: 35,
    shelfTo: 42,
    detailAmplitude: 0.3,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    fog: { colorScale: [1.1, 1.06, 1.0], densityGain: 0.01, backdropFade: 0.25 },
    light: { sun: 0.15, hemisphere: -0.05, ambient: 0.1 },
  },
  moodSurface: 12,
  moodDescent: 5,
  ceilingAtGate: 12,
  ceilingInside: 9,
  floorClearance: 0.7,
  seedKey: "wingGhostReef",
};
