import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import type { WingDef } from "../WingTypes";

function smooth01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

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
    // The cove's water is the cove's toybox lid: the clearest of any wing's
    // (density gain negative and the largest of the three), sun and fill
    // both lifted so the pastel glass reads at ten metres. Red stays near
    // the base per the value key — bright nostalgia, not electric cyan.
    fog: { colorScale: [1.07, 1.05, 1.09], densityGain: -0.009, backdropFade: 0.04 },
    light: { sun: -0.1, hemisphere: -0.08, ambient: -0.03 },
  },
  moodSurface: 12,
  moodDescent: 4,
  ceilingAtGate: 12,
  ceilingInside: 9,
  floorClearance: 0.7,
  seedKey: "wingGlassCove",
  /**
   * Batch 4 wall paint (the cove's walls were the wave-8 bare wedge): a
   * seafoam wash pooled low where the glass-dust settles, and a rose
   * tide-line wandering along the jamb walls a body's height up — the
   * pastel story written on the stone the drifts lean against. All
   * effects scale by `blend`, so the multiplier is identity at the
   * wedge's edge by the paint contract.
   */
  paint: (x, z, y, blend) => {
    if (blend < 0.02) {
      return null;
    }
    const s = smooth01(blend / 0.35);
    const mottle =
      (fbm(x * 0.13, z * 0.13, { seed: SEEDS.wingGlassCove ^ 0x3355, period: 6, octaves: 2 }) -
        0.5) *
      2;
    const wander =
      fbm(x * 0.07, z * 0.07, { seed: SEEDS.wingGlassCove ^ 0x91a5, period: 5, octaves: 2 }) - 0.5;
    // The cove floor sits near −2.6; the wash pools below y ≈ −1.6 and the
    // tide-line rides the wall band above it, its height wandered.
    const wash = 1 - smooth01((y + 1.6 + wander) / 1.3);
    const lineAt = -0.2 + wander * 1.6;
    const tide = smooth01(1 - Math.abs(y - lineAt) / 0.7);
    const value = 1 + mottle * 0.03 * s;
    return [
      value * (1 + (0.012 * wash + 0.05 * tide) * s),
      value * (1 + (0.045 * wash + 0.012 * tide) * s),
      value * (1 + (0.04 * wash + 0.024 * tide) * s),
    ];
  },
};
