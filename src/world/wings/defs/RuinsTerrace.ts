import { fbm } from "../../../rendering/ProceduralTexture";
import type { WingDef } from "../WingTypes";

/**
 * Connective-3 (MASTER Batch 3, connective plan §2): one wall relief
 * carving as cheap vertex paint — a worked frieze band running along
 * both wedge walls at chest-to-eye height, the terrace-builders' hand
 * on the walls themselves. A repeating carved motif every ~3.2 m of
 * wall (the seabed grid runs ~0.94 m/vertex, so the motif stays
 * Nyquist-honest), wobbled by one seeded fbm so no edge is ruled, and
 * value-only (±6%): recesses shade, fillets catch the gold. Confined
 * to the wall slopes (never the shelf floor) and scaled by the carve
 * blend, so the paint contract's identity at the wedge edge holds.
 */
const FRIEZE_Y_CENTER = -3.3;
const FRIEZE_Y_HALF = 0.9;
const FRIEZE_WAVELENGTH = 3.2;
const FRIEZE_SEED = 0x5a4d_090a ^ 0xf1e2;

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/**
 * Wing 9 — the Ruins Terrace. Majesty and mystery: mossed stone arches and
 * fallen columns on stepped shelves, gold-green water like light through
 * old glass, and the Reef Kirin grazing between the stones. Ancient in
 * the storybook way — no menace, just scale and time.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const RUINS_TERRACE: WingDef = {
  id: "ruins-terrace",
  title: "Ruins Terrace",
  emotion: "majesty, ancient mystery",
  azimuth: 4.59,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -2.0,
    floorDepth: -6.6,
    shelfFrom: 35,
    shelfTo: 44,
    detailAmplitude: 0.3,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    // Gold-green water like light through old glass — bright, never dim:
    // majesty without menace is a value story, so the sun is barely touched.
    fog: { colorScale: [0.86, 0.88, 0.64], densityGain: 0.01, backdropFade: 0.3 },
    light: { sun: 0.22, hemisphere: 0.22, ambient: 0.08 },
  },
  moodSurface: 8,
  moodDescent: 4.5,
  // The terrace floor wears the moss its monuments do: a gold-green wash
  // over the baked sand, easing to identity at the wedge's edges — plus
  // the connective-3 frieze band on the wall slopes (see above).
  paint: (x, z, y, blend) => {
    const k = blend * blend * (3 - 2 * blend);
    let red = 1 + 0.05 * k;
    let green = 1 + 0.035 * k;
    let blue = 1 - 0.1 * k;

    // The frieze: only on the wall slopes (the carve blend eases from 1
    // on the floor band toward 0 up the walls, so mid-blend IS the wall)
    // and only in its height band.
    const wallness = smoothstep01((0.85 - blend) / 0.45) * smoothstep01((blend - 0.04) / 0.18);
    const bandY = smoothstep01(1 - Math.abs(y - FRIEZE_Y_CENTER) / FRIEZE_Y_HALF);
    const r = Math.hypot(x, z);
    // Kept off the gate ramp and the opened end wall: the frieze lives
    // on the terrace's own walls, not across the doorway's slope.
    const bandR = smoothstep01((r - 33.8) / 1.4) * (1 - smoothstep01((r - 44.6) / 1.2));
    if (wallness > 0 && bandY > 0 && bandR > 0) {
      // The motif runs ALONG the wall (the walls run radially): a
      // softened square wave in r, its phase wandered by seeded fbm so
      // the carving reads worked, not machined.
      const wander =
        (fbm(r * 0.31, y * 0.4, { seed: FRIEZE_SEED, period: 8, octaves: 2 }) - 0.5) * 1.6;
      const wave = Math.sin(((r / FRIEZE_WAVELENGTH) * Math.PI * 2) + wander);
      const motif = Math.sign(wave) * smoothstep01(Math.abs(wave) / 0.55);
      const carve = motif * bandY * bandR * wallness * 0.06;
      // Fillets catch the gold-green; recesses shade toward the violet
      // ambient (blue held up so the shadow stays a colour).
      red += carve * 1.0;
      green += carve * 0.85;
      blue += carve * 0.45;
    }
    return [red, green, blue];
  },
  ceilingAtGate: 12,
  ceilingInside: 9,
  floorClearance: 0.7,
  seedKey: "wingRuinsTerrace",
};
