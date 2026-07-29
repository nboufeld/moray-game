import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { wingTarget } from "../WingGeometry";
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

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

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
    // Morning water: brighter, warmer and clearer than home. Negative shares
    // *give back* light — the one wing that lifts the rig instead of taking.
    fog: { colorScale: [1.13, 1.09, 0.99], densityGain: -0.012, backdropFade: -0.1 },
    light: { sun: -0.14, hemisphere: -0.1, ambient: -0.06 },
  },
  moodSurface: 12,
  moodDescent: 4,
  ceilingAtGate: 12,
  ceilingInside: 9,
  floorClearance: 0.7,
  seedKey: "wingNurseryShallows",
  paint: (x, z, y, blend) => {
    // Sun-warmed sand: a soft golden lift over the terrace, the wall slopes
    // falling back to neutral, and a faint rosy blush wandering through so
    // the flat reads hand-painted rather than graded. Identity at the edge.
    const above = y - wingTarget(NURSERY_SHALLOWS, x, z);
    const mottle =
      (fbm(x * 0.13, z * 0.13, { seed: SEEDS.wingNurseryShallows ^ 0x51c3, period: 5, octaves: 2 }) -
        0.5) *
      2;
    const blush = fbm(x * 0.05, z * 0.05, {
      seed: SEEDS.wingNurseryShallows ^ 0x2f,
      period: 3,
      octaves: 2,
    });
    const warm = 1 - smoothstep01((above - 0.5) / 2.0);
    const value = 1 + mottle * 0.035;
    const r = (1 + 0.05 * warm) * (1 + (blush - 0.5) * 0.06) * value;
    const g = (1 + 0.025 * warm) * value;
    const b = (1 - 0.05 * warm + 0.05 * (1 - warm)) * (1 + (blush - 0.5) * 0.04) * value;
    const s = smoothstep01(blend / 0.35);
    return [1 + (r - 1) * s, 1 + (g - 1) * s, 1 + (b - 1) * s];
  },
};
