import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import type { WingDef } from "../WingTypes";

/**
 * Wing 11 — the Open Blue. Vertigo and freedom: the drop-off. The deepest
 * floor in the game falling away under clear, vast, empty blue; the
 * backdrop dissolves, the ceiling stays high, and the space itself is the
 * subject. The Old Current patrols the middle water and the Gentle Dark
 * rises past the far curtain. Emptiness composed on purpose — nothing may
 * clutter this wing.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const OPEN_BLUE: WingDef = {
  id: "open-blue",
  title: "The Open Blue",
  emotion: "vertigo, freedom, vastness",
  azimuth: 5.31,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -2.6,
    floorDepth: -14,
    shelfFrom: 36,
    shelfTo: 46,
    detailAmplitude: 0.4,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    // Vast, clear, bright blue: the water *clears* at full mood (negative
    // gain), the backdrop dissolves almost entirely, and the light stays —
    // vertigo is read in a bright frame, not a dark one.
    fog: { colorScale: [0.6, 0.72, 0.95], densityGain: -0.006, backdropFade: 0.6 },
    light: { sun: 0.2, hemisphere: 0.15, ambient: 0.05 },
  },
  moodSurface: 12,
  moodDescent: 8,
  // The floor tells the drop: pale warm sand at the lip, falling to a deep
  // blue-green as the ground lets go — the vertigo is painted on the sand.
  //
  // Hard-geometry purge (critic #1, the wing-door frame): a diver at
  // floor level faces the end wall from arm's length, and the deep wash
  // alone rendered it as a solid featureless blue wall edge-to-edge —
  // the province's identity beat read as a card. The deep face now
  // carries painted structure: a broad mottle and slow strata bands,
  // strongest exactly where the deep wash is strongest, so the wall
  // reads as painted rock under deep water instead of poster board.
  paint: (x, z, y, blend) => {
    const k = blend * blend * (3 - 2 * blend);
    const t = Math.min(1, Math.max(0, (-y - 3) / 9));
    const d = t * t * (3 - 2 * t);
    const mottle =
      (fbm(x * 0.11, z * 0.11 + y * 0.17, {
        seed: SEEDS.wingOpenBlue ^ 0x3d1c,
        period: 6,
        octaves: 2,
      }) -
        0.5) *
      2;
    const strata = Math.sin(y * 1.3 + mottle * 1.6);
    const relief = d * (mottle * 0.09 + strata * 0.06);
    return [
      (1 + (0.04 - 0.3 * d) * k) * (1 + relief * k),
      (1 + (0.01 - 0.07 * d) * k) * (1 + relief * 0.85 * k),
      (1 + (-0.02 + 0.08 * d) * k) * (1 + relief * 0.6 * k),
    ];
  },
  ceilingAtGate: 12,
  ceilingInside: 11,
  floorClearance: 0.7,
  seedKey: "wingOpenBlue",
};
