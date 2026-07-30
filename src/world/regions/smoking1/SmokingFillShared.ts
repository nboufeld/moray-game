import { smoothstep01 } from "./SmokingShared";
import { CALDERA, GORGE_LIP_U, SPRINGS, gorgeChannelCenter, spokeOf } from "./SmokingTerrain";

/**
 * The Phase 3 fill's shared half: the protected-stillness gates and the
 * fresh seed substream constants every fill module draws from.
 *
 * ## The reroll fence
 *
 * Every fill stream is `SEEDS.regionSmoking1 ^` one of the constants
 * below — all new, none shared with the pilot's streams — and every fill
 * builder makes its own `Random` from one (kit builders do this by
 * construction). Where a pilot module grows (grass patches, fronds,
 * stars, urchins, motes), growth is APPENDED after every existing draw
 * on the same stream, so the pilot's content keeps its exact bytes; the
 * region test pins smoker, rock, bead, star and urchin positions to
 * prove it.
 *
 * ## The registry gates (MASTER §1.2 — inviolable)
 *
 * smoking-marches-1's protected rests, as gates the fill builders
 * multiply into their kit `gate` callbacks. All six are kept EMPTY of
 * new fill of every tier — their bareness is composed:
 *
 * - **the lip's slab** (the sitting stone at the Overlook);
 * - **the erratic's shadow** (the quiet's one witness keeps its ground);
 * - **the Spring Head crown pool** (the stair's crown stays a mirror —
 *   the geyser event is the landmark's own breath above the throat, not
 *   a fill of the pool);
 * - **the caldera's north floor quadrant** (the bowl's quiet quarter:
 *   floor points d 12–46 from the kiln whose spoke bearing leans +v;
 *   the kiln, its patrol and its glow pool live inside d 12 and predate
 *   the registry);
 * - **mid-shore between stacks**;
 * - **the Ash Meadows centre** u 330–360, v −20..+20 minus the erratic
 *   (fauna-free AND glow-free per the registry; the fill keeps ALL new
 *   tiers out — the flats' quiet is the region's rest bar).
 */

// ─── Fill seed substreams (all fresh — see the fence note above) ────────────

export const FILL_SEEDS = {
  baseAshCarpet: 0x5f00,
  gorgeGravel: 0x5f01,
  flatsRipple: 0x5f02,
  shoreScoria: 0x5f03,
  springShards: 0x5f04,
  basaltJointLitter: 0x5f05,
  forestEmberGravel: 0x5f06,
  calderaCobbleRun: 0x5f07,
  matsSprings: 0x5f11,
  matsFlats: 0x5f12,
  matsGorgeSeeps: 0x5f13,
  matsKilnSeams: 0x5f14,
  screeColumns: 0x5f21,
  screeChimneys: 0x5f22,
  sulfurTufts: 0x5f31,
  smokeBushFlats: 0x5f32,
  smokeBushForest: 0x5f33,
  fillRocks: 0x5f41,
  fillBasalt: 0x5f42,
  fillChimneys: 0x5f43,
  fillVents: 0x5f44,
  fillSmoke: 0x5f45,
  spineShoal: 0x5f51,
  ventShrimpSprings: 0x5f52,
  ventShrimpForest: 0x5f53,
  perchFish: 0x5f54,
  siltHoppers: 0x5f55,
  hatchlings: 0x5f56,
  shimmer: 0x5f61,
  geyser: 0x5f62,
} as const;

// ─── The registry gates ──────────────────────────────────────────────────────

/** The Overlook slab's seat (mirrors `SmokingRocks`' authored placement). */
export const LIP_SLAB = { u: GORGE_LIP_U - 4, v: gorgeChannelCenter(GORGE_LIP_U - 4) - 7.5 } as const;
/** The Ash Erratic's seat (mirrors `SmokingRocks`). */
export const ERRATIC = { u: 322, v: 16 } as const;
/** Midpoint of the Ember Shore stacks (594,7)–(598,22). */
export const MID_SHORE = { u: 596, v: 14.5 } as const;
/** The two rest BARS the plan names (tested as exact rectangles/quadrant). */
export const FLATS_REST = { uFrom: 330, uTo: 360, vFrom: -20, vTo: 20 } as const;
export const CALDERA_REST = { dFrom: 12, dTo: 46 } as const;

/** True when a spoke point stands inside the caldera's north floor
 *  quadrant: bearing from the kiln within ±45° of +v, floor ring d 12–46. */
export function inCalderaNorthQuadrant(u: number, v: number): boolean {
  const du = u - CALDERA.u;
  const dv = v - CALDERA.v;
  const d = Math.hypot(du, dv);
  if (d < CALDERA_REST.dFrom || d > CALDERA_REST.dTo) {
    return false;
  }
  return dv > Math.abs(du);
}

/** True inside the Ash Meadows' rest bar (the erratic keeps its own disc). */
export function inFlatsRest(u: number, v: number): boolean {
  if (u < FLATS_REST.uFrom || u > FLATS_REST.uTo || v < FLATS_REST.vFrom || v > FLATS_REST.vTo) {
    return false;
  }
  return Math.hypot(u - ERRATIC.u, v - ERRATIC.v) > 7;
}

/**
 * The stillness gate: 0 inside every registered rest, 1 elsewhere, with a
 * short feather so density dies INTO a rest instead of at a ruled line.
 */
export function restFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);

  // The two rest bars (hard interiors, feathered approaches). The
  // registry's "minus the erratic" carve needs no counter-gate here:
  // the erratic's shadow is itself a rest, so the union already covers
  // its disc, and the erratic itself is pilot content, not new fill.
  const flats =
    smoothstep01((u - (FLATS_REST.uFrom - 4)) / 4) *
    (1 - smoothstep01((u - FLATS_REST.uTo) / 4)) *
    smoothstep01((v - (FLATS_REST.vFrom - 4)) / 4) *
    (1 - smoothstep01((v - FLATS_REST.vTo) / 4));
  const du = u - CALDERA.u;
  const dv = v - CALDERA.v;
  const d = Math.hypot(du, dv);
  const northRing =
    smoothstep01((d - (CALDERA_REST.dFrom - 3)) / 3) * (1 - smoothstep01((d - CALDERA_REST.dTo) / 3));
  const northBearing = d > 1e-6 ? smoothstep01((dv - Math.abs(du)) / 4 + 0.5) : 0;
  const north = northRing * northBearing;

  // The four point rests.
  const slab = 1 - smoothstep01((Math.hypot(u - LIP_SLAB.u, v - LIP_SLAB.v) - 4.5) / 2.5);
  const erratic = 1 - smoothstep01((Math.hypot(u - ERRATIC.u, v - ERRATIC.v) - 6.5) / 3);
  const crownPool = 1 - smoothstep01((Math.hypot(u - SPRINGS.u, v - SPRINGS.v) - 5) / 2.5);
  const midShore = 1 - smoothstep01((Math.hypot(u - MID_SHORE.u, v - MID_SHORE.v) - 7) / 3);

  return (
    (1 - flats) *
    (1 - north) *
    (1 - slab) *
    (1 - erratic) *
    (1 - crownPool) *
    (1 - midShore)
  );
}
