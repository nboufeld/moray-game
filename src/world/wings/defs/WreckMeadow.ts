import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import type { WingDef } from "../WingTypes";

/**
 * Wing 3 — the Wreck Meadow. Melancholy and curiosity: the ribs of an old
 * hull half-swallowed by a seagrass meadow, rust-warm accents against
 * teal-grey water, light kept low and even like an overcast afternoon.
 * Nothing here is a threat; everything here is a story already over.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 *
 * The mood is the weather of the story: the key gives up half its light so
 * the rib cage stands in soft shadowless relief, while the fill keeps its
 * floor — overcast light is flat, not dark. The water is mixed a step
 * toward teal-grey (red held close behind green, never toward zero, so it
 * greys rather than going poster cyan), against which the wreck's rust
 * warms by contrast alone. The wall paint lays the same rust as silt
 * staining low on the ground the wreck lies on.
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
    fog: { colorScale: [0.72, 0.78, 0.8], densityGain: 0.014, backdropFade: 0.4 },
    light: { sun: 0.5, hemisphere: 0.25, ambient: 0.1 },
  },
  moodSurface: 6,
  moodDescent: 5,
  ceilingAtGate: 12,
  ceilingInside: 8,
  floorClearance: 0.7,
  seedKey: "wingWreckMeadow",
  paint: (x, z, y, blend) => {
    if (blend <= 0) {
      return null;
    }
    // Identity at the wedge edge; full weight where the wing owns the ground.
    const s = smooth01(blend / 0.35);
    // Rust silt: strongest on the floor the wreck lies on (y ≈ −6), faded
    // away well up the walls, and mottled so it pools like sediment rather
    // than ruling like a band.
    const up = smooth01((y + 6.8) / 4.5);
    const mottle =
      (fbm(x * 0.11, z * 0.11, { seed: SEEDS.wingWreckMeadow ^ 0x51de, period: 6, octaves: 2 }) -
        0.5) *
      2;
    const stain = (1 - up * 0.75) * (0.9 + 0.2 * mottle);
    const r = 1 + 0.06 * stain;
    const g = 1 + 0.005 * stain;
    const b = 1 - 0.04 * stain;
    return [1 + (r - 1) * s, 1 + (g - 1) * s, 1 + (b - 1) * s];
  },
};

function smooth01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}
