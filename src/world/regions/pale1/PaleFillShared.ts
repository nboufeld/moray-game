import { smoothstep01 } from "./PaleShared";
import {
  QUIET_GALLERY,
  RAVINE_LIP_U,
  SEED_GROVE,
  galleryWeight,
  ravineChannelCenter,
  ravineChannelHalf,
  spokeOf,
} from "./PaleTerrain";

/**
 * The Phase 3 fill's shared half: the protected-stillness gates and the
 * fresh seed substream constants every fill module draws from.
 *
 * ## The reroll fence
 *
 * Every fill stream is `SEEDS.regionPale1 ^` one of the constants below —
 * all new, none shared with the pilot's streams (ledger §Seeds) — and
 * every fill builder makes its own `Random` from one, appended after all
 * existing draws. Nothing here consumes from any existing builder's
 * stream, so the pilot's content (every bone tree, monument, the
 * cathedral, the Gardener's round) keeps its exact position; the region
 * test pins the first/last tree instances, the first monument and the
 * Gardener target to prove it.
 *
 * ## The registry gates (MASTER §1.2 — inviolable)
 *
 * pale-passage-1's protected rests, as gates the fill builders multiply
 * into their kit `gate` callbacks:
 *
 * - **THE QUIET GALLERY** — nothing moves but dust. No T1/T2 cover, no
 *   fauna on the pan; {@link t1Free} dies as the pan's weight rises.
 * - **THE RAVINE HUSH (u 130–210)** — the gravel runs stop; the dust
 *   bloom carries the hush. {@link hushFree} is the gravel gate's kill.
 * - **THE MOTHER'S POOL** — petals are born above it, nothing swims
 *   through it and nothing stands in it: the bowl heart stays clean.
 * - **the saddle lip crest** — the reveal's bare threshold stays bare.
 * - The forest **aisle** (the diver's swim line, `aisleAt` ± 2.5 m) is
 *   not a registry rest but a navigability contract from the pilot; the
 *   carpets keep it clear the way the trees always did.
 */

// ─── Fill seed substreams (all fresh — see the fence note above) ────────────

export const FILL_SEEDS = {
  gravelRavine: 0xfa01,
  shardDrifts: 0xfa02,
  descentFan: 0xfa03,
  falseSpring: 0xfa04,
  gritDisc: 0xfa05,
  ossuary: 0xfa06,
  stumps: 0xfa07,
  blushGravel: 0xfa08,
  bankShards: 0xfa0c,
  petalFall: 0xfa0d,
  pioneerSprigs: 0xfa0e,
  sprigsSouth: 0xfa0f,
  turfShelf: 0xfa09,
  turfGrove: 0xfa0a,
  bedRubble: 0xfa0b,
  screeRavine: 0xfa11,
  screeBones: 0xfa13,
  ledges: 0xfa21,
  garland: 0xfa31,
  sprigTrail: 0xfa32,
  rimGate: 0xfa33,
  hushFry: 0xfa41,
  brittleWhite: 0xfa42,
  brittleRose: 0xfa43,
  midgesBlush: 0xfa44,
  midgesNursery: 0xfa45,
  dustRavine: 0xfa46,
  dustGallery: 0xfa47,
  petalEddies: 0xfa48,
} as const;

// ─── The registry gates ──────────────────────────────────────────────────────

/** The forest aisle's wander — the pilot's own line (`PaleBones.aisleAt`),
 *  re-stated here so the carpets and the tests read one truth. */
export function aisleAt(u: number): number {
  return -4 + 7 * Math.sin(u * 0.045);
}

/** Distance from the aisle's swim line; Infinity outside the forest run. */
export function aisleDistance(u: number, v: number): number {
  if (u < 292 || u > 470) {
    return Infinity;
  }
  return Math.abs(v - aisleAt(u));
}

/**
 * Where T1/T2 cover may stand: the Quiet Gallery pan, the Mother's Pool,
 * the saddle lip crest and the aisle's swim line all gate to zero. The
 * hush is separate ({@link hushFree}) because only the ravine's gravel
 * families read it.
 */
export function t1Free(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  // The Quiet Gallery: composed stillness. Dead before weight 0.4 (the
  // region test's line) with margin.
  const gallery = 1 - smoothstep01((galleryWeight(u, v) - 0.12) / 0.16);
  // The Mother's Pool: the bowl heart under the crown stays clean.
  const pool = smoothstep01((Math.hypot(u - SEED_GROVE.u, v - SEED_GROVE.v) - 8) / 3);
  // The saddle lip crest: the reveal's threshold, composed bare.
  const crest =
    smoothstep01((u - (RAVINE_LIP_U - 8)) / 4) *
    (1 - smoothstep01((u - (RAVINE_LIP_U + 8)) / 4)) *
    (1 -
      smoothstep01(
        (Math.abs(v - ravineChannelCenter(Math.min(u, 285))) -
          ravineChannelHalf(Math.min(u, 285)) -
          4) /
          4,
      ));
  // The aisle: the swim line itself stays clear; its wayside is dressed.
  const aisle = smoothstep01((aisleDistance(u, v) - 2.5) / 2);
  return gallery * pool * (1 - crest) * aisle;
}

/** The Ravine Hush (u 130–210): the gravel runs stop, dust carries it.
 *  Zero across the registry's whole window, easing back in past it. */
export function hushFree(u: number): number {
  return 1 - smoothstep01((u - 122) / 8) * (1 - smoothstep01((u - 210) / 8));
}

/** Landmark spots the fill dresses (stated once so builders, light and
 *  the ledger agree about where things are). */
export const CATHEDRAL_AT = { u: 352, v: -34 } as const;
export const BLUSH_SKELETONS = [
  { u: 448, v: -16, height: 7.2 },
  { u: 463, v: 2, height: 6.1 },
] as const;
export const GALLERY_COLUMN_AT = { u: QUIET_GALLERY.u + 4, v: QUIET_GALLERY.v + 2 } as const;
export const RAVINE_DUST_U = 145;
