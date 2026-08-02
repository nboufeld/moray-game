import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import type { WingDef } from "../WingTypes";

/**
 * Wing 5 — the Moonlit Lagoon. Serenity: a still, silver-blue basin where
 * the key light dims to moonlight and the violet ambient rises, sparse
 * pale flora, slow sparkle motes, and the Moon Koi circling its pool.
 * The quietest place in the game — night without any of night's fear.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 *
 * The mood is the night arriving honestly: it is on at swim height (the
 * surface is the bowl's own ceiling of light), the sun gives up most of
 * itself to become moonlight, and the ambient rises a little against it —
 * violet shade is the place's floor, never black. The floor's paint is the
 * basin's silver: a cool lift on the flat ground, mottled like moonlight
 * through still water, easing off up the walls so the bowl's sand keeps
 * its own colour at the doorway.
 */
export const MOONLIT_LAGOON: WingDef = {
  id: "moonlit-lagoon",
  title: "Moonlit Lagoon",
  emotion: "serenity, silver stillness",
  azimuth: 3.15,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -1.2,
    floorDepth: -3.2,
    shelfFrom: 35,
    shelfTo: 42,
    detailAmplitude: 0.25,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    fog: { colorScale: [0.62, 0.72, 0.98], densityGain: 0.008, backdropFade: 0.35 },
    light: { sun: 0.65, hemisphere: 0.3, ambient: -0.05 },
  },
  moodSurface: 12,
  moodDescent: 5,
  ceilingAtGate: 12,
  ceilingInside: 9,
  floorClearance: 0.7,
  seedKey: "wingMoonlitLagoon",
  paint: (x, z, y, blend) => {
    if (blend <= 0) {
      return null;
    }
    const s = smooth01(blend / 0.35);
    // Silver underfoot: a cool lift strongest on the basin floor
    // (y ≈ −3.2), mottled like light through still water, fading up the
    // walls. Blue lifts hardest and red stays close behind — moonlit pale,
    // never electric.
    const up = smooth01((y + 4) / 3.5);
    const mottle =
      (fbm(x * 0.09, z * 0.09, { seed: SEEDS.wingMoonlitLagoon ^ 0x77c1, period: 6, octaves: 2 }) -
        0.5) *
      2;
    const lift = (1 - up * 0.7) * (0.9 + 0.2 * mottle);
    const r = 1 + 0.05 * lift;
    const g = 1 + 0.07 * lift;
    const b = 1 + 0.11 * lift;
    return [1 + (r - 1) * s, 1 + (g - 1) * s, 1 + (b - 1) * s];
  },
};

function smooth01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}
