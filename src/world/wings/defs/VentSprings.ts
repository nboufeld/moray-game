import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import type { WingDef } from "../WingTypes";

/**
 * Wing 4 — the Vent Springs. Otherworldly warmth: mineral chimneys on a
 * charcoal floor, columns of shimmer and slow bubbles, water gone
 * warm-grey with amber held in it, and the ember moray glowing in the
 * gloom. The one hot place in a cool game — strange, not hostile.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 *
 * The mood is the heat: the water warms channel by channel (red held
 * highest, blue taken hardest — the value key's rule run backwards into
 * warmth rather than violet), and the mood arrives at swim height so the
 * doorway itself is already warm. The floor's paint is the chimneys'
 * geology underfoot: charcoal-dark sand with amber staining pooled in the
 * mottle, so the ground glows faintly where the mineral does.
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
    fog: { colorScale: [0.8, 0.55, 0.42], densityGain: 0.018, backdropFade: 0.5 },
    light: { sun: 0.55, hemisphere: 0.55, ambient: 0.1 },
  },
  moodSurface: 6,
  moodDescent: 5,
  ceilingAtGate: 12,
  ceilingInside: 7,
  floorClearance: 0.7,
  seedKey: "wingVentSprings",
  paint: (x, z, y, blend) => {
    if (blend <= 0) {
      return null;
    }
    const s = smooth01(blend / 0.35);
    // Charcoal underfoot: a warm darkening strongest on the floor
    // (y ≈ −7.5) and easing off up the walls, with amber mineral staining
    // pooled in the same mottle field — the floor's share of the veins.
    const up = smooth01((y + 8) / 5);
    const mottle =
      (fbm(x * 0.13, z * 0.13, { seed: SEEDS.wingVentSprings ^ 0x44aa, period: 6, octaves: 3 }) -
        0.5) *
      2;
    const dark = 1 - up * 0.8;
    const r = 1 - 0.2 * dark;
    const g = 1 - 0.24 * dark;
    let b = 1 - 0.25 * dark;
    const amber = smooth01((mottle - 0.35) / 0.4) * dark;
    const rAmber = r + amber * 0.16;
    const gAmber = g + amber * 0.02;
    b -= amber * 0.1;
    return [
      1 + (rAmber - 1) * s,
      1 + (gAmber - 1) * s,
      1 + (Math.max(0.6, b) - 1) * s,
    ];
  },
};

function smooth01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}
