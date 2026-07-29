import type { WingDef } from "../WingTypes";

/**
 * The recovery ramp the whole wing walks, in metres of radius: bone at the
 * gate, colour returning past r 41, full (soft) colour by 46.5. The flora's
 * instance tints lerp on the same numbers, so the sand and the stands agree
 * about where the reef begins to heal.
 */
function recoveryAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const k = Math.min(1, Math.max(0, (r - 41) / 5.5));
  return k * k * (3 - 2 * k);
}

/**
 * Wing 7 — the Ghost Reef. Quiet sorrow turning to recovery: a bleached
 * coral stand, bone-pale and milky-watered, with patches of returning
 * colour scattered through it — the story told spatially, white at the
 * gate, colour deepening toward the far end where the pearl moray keeps
 * its den. Grief with a door out of it.
 *
 * GEOMETRY FROZEN (azimuth, carve, wedge) — see docs/WAVE8.md. Mood tables
 * and palette belong to this wing's owner.
 */
export const GHOST_REEF: WingDef = {
  id: "ghost-reef",
  title: "Ghost Reef",
  emotion: "quiet sorrow, recovery",
  azimuth: 3.87,
  carve: {
    carveFrom: 29.5,
    carveFull: 33.5,
    fadeFrom: 46,
    carveEnd: 50,
    sillDepth: -1.5,
    floorDepth: -4.2,
    shelfFrom: 35,
    shelfTo: 42,
    detailAmplitude: 0.3,
  },
  wedge: { floorHalf: 0.075, gateHalf: 0.115, endHalf: 0.165 },
  mood: {
    // The milk: denser, paler, lower-contrast water. Green and blue lift
    // most (a bright aqua haze, red held per the value key), the backdrop
    // gives up nearly half its level so the far end dissolves, and the key
    // softens while the fills brighten — grief lit flat, not dark.
    fog: { colorScale: [1.05, 1.13, 1.11], densityGain: 0.016, backdropFade: 0.42 },
    light: { sun: 0.12, hemisphere: -0.12, ambient: -0.04 },
  },
  moodSurface: 12,
  moodDescent: 5,
  paint: (x, z, _y, blend) => {
    // The sand tells the same story as the stands: a pale, faintly cool
    // lift where the bleaching is, a breath of warmth returning with the
    // radius. Everything scales by `blend`, so the multiplier is identity
    // at the wedge's edge by contract.
    const recovery = recoveryAt(x, z);
    const lift = 0.1 * (1 - recovery * 0.55) * blend;
    const warm = recovery * blend;
    return [
      1 + lift * 0.88 + warm * 0.045,
      1 + lift + warm * 0.015,
      1 + lift * 0.72 - warm * 0.03,
    ];
  },
  ceilingAtGate: 12,
  ceilingInside: 9,
  floorClearance: 0.7,
  seedKey: "wingGhostReef",
};
