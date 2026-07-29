import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { wingTarget } from "../WingGeometry";
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

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

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
    // Emerald water that keeps its sun: the fog goes green and a shade
    // deeper, but only a fifth of the light rig is taken — the vault is lit.
    fog: { colorScale: [0.6, 0.9, 0.68], densityGain: 0.012, backdropFade: 0.3 },
    light: { sun: 0.18, hemisphere: 0.26, ambient: 0.08 },
  },
  moodSurface: 12,
  moodDescent: 6,
  ceilingAtGate: 12,
  ceilingInside: 11,
  floorClearance: 0.7,
  seedKey: "wingKelpCathedral",
  paint: (x, z, y, blend) => {
    // The nave's stain: an emerald cast over the low ground, and moss
    // climbing a body's height up the wall feet to meet the moss pads the
    // flora plants there. The mottle keeps it growth, not a band. Identity
    // at the wedge's edge, by the strata's own contract.
    const above = y - wingTarget(KELP_CATHEDRAL, x, z);
    const mottle =
      (fbm(x * 0.11, z * 0.11, { seed: SEEDS.wingKelpCathedral ^ 0x3a11, period: 6, octaves: 2 }) -
        0.5) *
      2;
    const cast = 1 - smoothstep01((above - 0.6) / 2.2);
    const moss = smoothstep01((above - 0.6) / 0.5) * (1 - smoothstep01((above - 1.6) / 1.0));
    const value = 1 + mottle * 0.04;
    const r = (1 - 0.07 * cast) * (1 - 0.16 * moss) * value;
    const g = (1 - 0.015 * cast) * (1 - 0.06 * moss) * value;
    const b = (1 - 0.1 * cast) * (1 - 0.12 * moss) * value;
    const s = smoothstep01(blend / 0.35);
    return [1 + (r - 1) * s, 1 + (g - 1) * s, 1 + (b - 1) * s];
  },
};
