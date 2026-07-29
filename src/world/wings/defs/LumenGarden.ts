import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { wingTarget } from "../WingGeometry";
import type { WingDef } from "../WingTypes";

/**
 * Wing 2 — the Lumen Garden. Wonder and mystery: the deepest dark in the
 * game, an indigo night where the flora itself carries the light —
 * bioluminescent polyp beds, lantern kelp, drifting mote constellations,
 * and the Crown Jelly Sovereign rising slowly through its own glow. The
 * water closes in; the garden answers.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

export const LUMEN_GARDEN: WingDef = {
  id: "lumen-garden",
  title: "Lumen Garden",
  emotion: "wonder, deep-night mystery",
  azimuth: 2.07,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -2.5,
    floorDepth: -10,
    shelfFrom: 36,
    shelfTo: 44,
    detailAmplitude: 0.35,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    // The deepest night in the game: the rig is nearly gone down here, so
    // the garden's own glow is what the eye composes by. Red stays above
    // green through the indigo, per the value key.
    // Deepened at the wave-8 merge pass: the first capture read as a dim
    // afternoon rather than a night — the sun kept too much floor and the
    // backdrop stayed loud behind the carve.
    fog: { colorScale: [0.24, 0.19, 0.5], densityGain: 0.05, backdropFade: 0.88 },
    light: { sun: 0.94, hemisphere: 0.85, ambient: 0.32 },
  },
  moodSurface: 0.45,
  moodDescent: 5,
  ceilingAtGate: 12,
  ceilingInside: 6,
  floorClearance: 0.7,
  seedKey: "wingLumenGarden",
  paint: (x, z, y, blend) => {
    // The night's ground: cooled toward indigo, and faintly lifted cyan at
    // the floor where the beds' own light would pool — the flora's glow
    // answered on the sand it stands on. Red held above green throughout,
    // so the shade is a colour and never a hole. Identity at the edge.
    const above = y - wingTarget(LUMEN_GARDEN, x, z);
    const mottle =
      (fbm(x * 0.12, z * 0.12, { seed: SEEDS.wingLumenGarden ^ 0x77c1, period: 6, octaves: 2 }) -
        0.5) *
      2;
    const depth = 1 - smoothstep01((above - 0.8) / 2.6);
    const value = (1 - 0.16 * depth) * (1 + mottle * 0.05);
    const r = value * (1 - 0.06 * depth);
    const g = value * (1 - 0.09 * depth);
    const b = Math.min(1.06, value * (1 + 0.1 * depth));
    const s = smoothstep01(blend / 0.35);
    return [1 + (r - 1) * s, 1 + (g - 1) * s, 1 + (b - 1) * s];
  },
};
