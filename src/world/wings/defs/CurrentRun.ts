import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import type { WingDef } from "../WingTypes";

function smooth01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

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
  /**
   * Batch 4 wall paint (the run's walls were the wave-8 bare wedge):
   * flow streaks — the fbm sampled long along the axis and tight across
   * it, so the value grain COMBS down-channel the way the banners lean —
   * under a cool turquoise wash that deepens up the walls. All effects
   * scale by `blend`: identity at the wedge's edge by the paint contract.
   */
  paint: (x, z, y, blend) => {
    if (blend < 0.02) {
      return null;
    }
    const s = smooth01(blend / 0.35);
    const axisX = Math.cos(CURRENT_RUN.azimuth);
    const axisZ = Math.sin(CURRENT_RUN.azimuth);
    const along = x * axisX + z * axisZ;
    const across = x * -axisZ + z * axisX;
    const streak =
      (fbm(along * 0.05, across * 0.42, {
        seed: SEEDS.wingCurrentRun ^ 0x7f0e,
        period: 7,
        octaves: 2,
      }) -
        0.5) *
      2;
    // The wash cools the wall band harder than the floor: the channel's
    // rushing turquoise written on the stone it rushes past.
    const wall = smooth01((y + 4.2) / 3.4);
    const value = 1 + streak * 0.055 * s;
    return [
      value * (1 - (0.02 + 0.02 * wall) * s),
      value * (1 + (0.01 + 0.008 * wall) * s),
      value * (1 + (0.014 + 0.012 * wall) * s),
    ];
  },
};
