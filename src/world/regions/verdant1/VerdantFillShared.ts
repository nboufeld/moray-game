import { smoothstep01 } from "./VerdantShared";
import {
  ROOT_MAZE,
  SUNWELL,
  spokeOf,
  valeChannelCenter,
} from "./VerdantTerrain";

/**
 * The Phase 3 fill's shared half: the protected-stillness gates and the
 * fresh seed substream constants every fill module draws from.
 *
 * ## The reroll fence
 *
 * Every fill stream is `SEEDS.regionVerdant1 ^` one of the constants
 * below — all new, none shared with the pilot's streams — and every fill
 * builder makes its own `Random` from one. Nothing here consumes from any
 * existing builder's stream, so the pilot's content (every landmark, every
 * trunk, the weaver's haunt) keeps its exact position; the region test
 * pins the first/last giants and the weaver target to prove it.
 *
 * ## The registry gates (MASTER §1.2 — inviolable)
 *
 * verdant-line-1's protected rests, as gates the fill builders multiply
 * into their kit `gate` callbacks:
 *
 * - **the lip saddle crest** (u ≈ 256–292 over the saddle's width) and
 *   **the shelf pocket** (585, −40) are unqualified rests: NO new object
 *   of any tier may stand in them — {@link restFree} is 0 there.
 * - **the Sunwell bowl interior** (`no fauna inside the ring`) and **the
 *   narrows shadow passage u 190–250** (`motes only, beam-free`) are
 *   qualified: ground cover and paint may enter (the plan itself carpets
 *   the Sunwell), but life may not — {@link faunaFree} adds them.
 * - Light keeps itself out of the narrows by authorship (the fill plan's
 *   §4 lists every beam landing; none lands in u 190–250).
 */

// ─── Fill seed substreams (all fresh — see the fence note above) ────────────

export const FILL_SEEDS = {
  carpetMoss: 0xf111,
  carpetSward: 0xf112,
  carpetLitterA: 0xf113,
  carpetLitterB: 0xf114,
  carpetSilt: 0xf115,
  carpetShell: 0xf116,
  carpetRingRim: 0xf117,
  carpetTurf: 0xf118,
  carpetTussock: 0xf119,
  carpetSaddle: 0xf11a,
  valePebbles: 0xf121,
  meadowPebbles: 0xf122,
  erraticSkirt: 0xf123,
  mazeRubble: 0xf124,
  wreckDebris: 0xf125,
  bushVale: 0xf131,
  bushMeadow: 0xf132,
  bushForest: 0xf133,
  bushMaze: 0xf134,
  bushEdge: 0xf135,
  bushSunwell: 0xf136,
  sponges: 0xf141,
  holdfastSkirts: 0xf151,
  fallenLimbs: 0xf152,
  deadSpars: 0xf153,
  canopyPads: 0xf154,
  crestStones: 0xf155,
  hubGrowth: 0xf156,
  kelpLedgeGrowth: 0xf161,
  kelpLeafGrowth: 0xf162,
  kelpCanopyGrowth: 0xf163,
  meadowGrowth: 0xf171,
  valeRunner: 0xf181,
  broodingShoal: 0xf182,
  farShoal: 0xf183,
  jellies: 0xf184,
  crabs: 0xf185,
  barkPerchers: 0xf186,
  glowMaze: 0xf187,
  glowAccents: 0xf188,
  glowJambs: 0xf189,
  lightMain: 0xf191,
  lightMaze: 0xf192,
  lightEdge: 0xf193,
  // ── R12.3 quality re-pass streams — all fresh, appended after every
  // fill draw above (the reroll fence's second fence line: profile swaps
  // may re-roll their OWN families' buffers, but nothing below reaches
  // into any stream above).
  carpetSkirtGrass: 0xf211,
  carpetFerns: 0xf212,
  carpetValeStands: 0xf213,
  carpetAisleStands: 0xf214,
  // 0xf215 is the meadow re-pass growth stream (VerdantMeadow).
  carpetShoulderStand: 0xf216,
  mazeSplitStones: 0xf221,
} as const;

// ─── The registry gates ──────────────────────────────────────────────────────

/** The two unqualified rests: nothing new stands inside them. 1 elsewhere. */
export function restFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  // The lip saddle crest, across the saddle's own width.
  const crest =
    smoothstep01((u - 250) / 6) *
    (1 - smoothstep01((u - 288) / 6)) *
    (1 - smoothstep01((Math.abs(v - valeChannelCenter(Math.min(u, 285))) - 10) / 5));
  // The mirror-calm shelf pocket at (585, −40).
  const pocket = 1 - smoothstep01((Math.hypot(u - 585, v + 40) - 7) / 4);
  return (1 - crest) * (1 - pocket);
}

/**
 * Where LIFE may stand: the unqualified rests plus the Sunwell bowl
 * interior and the narrows shadow passage. 1 where fauna is welcome.
 */
export function faunaFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const bowl =
    1 - smoothstep01((Math.hypot(u - SUNWELL.u, v - SUNWELL.v) - 30) / 6);
  const narrows =
    smoothstep01((u - 186) / 6) * (1 - smoothstep01((u - 250) / 6));
  return restFree(x, z) * (1 - bowl) * (1 - narrows);
}

/** The wandering forest aisle — re-stated from `VerdantKelp` so the fill
 *  modules can keep the swim line itself clear while dressing its wayside. */
export function aisleAt(u: number): number {
  return 58 * smoothstep01((u - 300) / 165) + 6 * Math.sin(u * 0.05);
}

/** How close a spoke point stands to the aisle's swim line, metres. */
export function aisleDistance(u: number, v: number): number {
  if (u < 296 || u > 484) {
    return Infinity;
  }
  return Math.abs(v - aisleAt(u));
}

/** Landmark spots the fill modules dress (authored once, here, so the
 *  builders and the ledger agree about where things are). */
export const WRECK_AT = { u: ROOT_MAZE.u - 6, v: ROOT_MAZE.v - 12 } as const;
export const GROTTO_MOUTH = { u: ROOT_MAZE.u + 8, v: ROOT_MAZE.v - 23.4 } as const;
export const GREEN_GATE_1 = { u: ROOT_MAZE.u - 30, v: ROOT_MAZE.v + 34 } as const;
export const ERRATIC = { u: 318, v: 32 } as const;
