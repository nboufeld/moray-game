import { smoothstep01 } from "./GoldenShared";
import {
  HOURGLASS,
  goldenTerrainTarget,
  saddleChannelCenter,
  spokeOf,
  worldOf,
} from "./GoldenTerrain";

/**
 * The Phase 3 fill's shared half: the protected-stillness gates, the
 * authored beat tables and the fresh seed substream constants every fill
 * module draws from (plan docs/fill-plans/golden-waste-1.md, rebased on
 * the round-8 close per MASTER R9).
 *
 * ## The reroll fence
 *
 * Every fill stream is `SEEDS.regionGolden1 ^` one of the constants
 * below — all fresh, none shared with the pilot's substreams — and every
 * fill builder makes its own `Random` from one. Nothing here consumes
 * from any existing builder's stream, so the pilot's content (every
 * monolith, palm, fin, boulder, eel and veil) keeps its exact position;
 * the region test pins six of them to prove it.
 *
 * ## The registry gates (MASTER §1.2 — inviolable)
 *
 * golden-waste-1's two protected rests, as gates the fill builders
 * multiply into their kit `gate` callbacks:
 *
 * - **The Empty Quarter** — one deliberately bare dune passage between
 *   the Dune Ocean and the Gilded Shore. Full ripple T1 *paint* only
 *   (GoldenGround bakes it); no T2 instance, no T4 life may stand in it.
 * - **The Drain's Eye** — the Hourglass floor's centre. Still: one shaft
 *   of falling light and its cool pool (the plan's own §4 beat), the
 *   Keeper's circle the only motion. No cover, no life.
 */

// ─── Fill seed substreams (all fresh — see the fence note above) ────────────

export const FILL_SEEDS = {
  gritCarpet: 0xf601,
  shellDrift: 0xf602,
  saddlePebbles: 0xf603,
  duneWire: 0xf604,
  saddleWire: 0xf605,
  leeFronds: 0xf606,
  leeWrack: 0xf607,
  driftLines: 0xf608,
  saltLilies: 0xf609,
  oasisBushes: 0xf60a,
  fallenFronds: 0xf60b,
  shardAprons: 0xf60c,
  singingStones: 0xf60d,
  shorePebbles: 0xf60e,
  shoreWrack: 0xf60f,
  shoreTufts: 0xf610,
  sandRoses: 0xf611,
  lilyBench: 0xf612,
  crestStand: 0xf613,
  // Life & light.
  eelColonies: 0xf621,
  pilotFish: 0xf622,
  travellerShoal: 0xf623,
  saddleVeil: 0xf624,
  glintBreath: 0xf625,
  glintTease: 0xf626,
  dappleSaddle: 0xf631,
  dappleOasis: 0xf632,
  dappleFlats: 0xf633,
  roadBeams: 0xf634,
  hourglassBlades: 0xf635,
  drainPool: 0xf636,
} as const;

// ─── The protected rests ─────────────────────────────────────────────────────

/** The Empty Quarter's authored heart, spoke coordinates. */
export const EMPTY_QUARTER = { u: 535, v: -18, radius: 26 } as const;
/** The Drain's Eye: the Hourglass floor centre. */
export const DRAINS_EYE = { u: HOURGLASS.u, v: HOURGLASS.v, radius: 13 } as const;

/**
 * 1 everywhere a fill instance may stand, easing to exactly 0 inside the
 * two registered rests. Multiplied into every fill gate — cover AND life.
 */
export function restFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const quarter = smoothstep01(
    (Math.hypot(u - EMPTY_QUARTER.u, v - EMPTY_QUARTER.v) - EMPTY_QUARTER.radius) / 6,
  );
  const eye = smoothstep01(
    (Math.hypot(u - DRAINS_EYE.u, v - DRAINS_EYE.v) - DRAINS_EYE.radius) / 5,
  );
  return Math.min(quarter, eye);
}

/** Strictly-inside test for the region test's exclusion sweep. */
export function insideRest(u: number, v: number): boolean {
  return (
    Math.hypot(u - EMPTY_QUARTER.u, v - EMPTY_QUARTER.v) < EMPTY_QUARTER.radius ||
    Math.hypot(u - DRAINS_EYE.u, v - DRAINS_EYE.v) < DRAINS_EYE.radius
  );
}

// ─── The journey's authored beats ────────────────────────────────────────────

/**
 * The lee-garden pockets (plan §2's named beats): small authored discs in
 * dune shadow where the T2 understory concentrates — the road's reveals,
 * spaced 20–40 m. Vale entries ride the channel's own wander (`dv` off
 * the channel centre); ocean entries are absolute spoke coordinates
 * chosen in trough/lee country clear of every landmark and both rests.
 */
export interface LeePocket {
  readonly u: number;
  readonly v: number;
  readonly radius: number;
}

function valePocket(u: number, dv: number, radius: number): LeePocket {
  return { u, v: saddleChannelCenter(u) + dv, radius };
}

export const LEE_GARDENS: readonly LeePocket[] = [
  // Down the vale: the first duneling lee-garden (u ~80, the T2 debut),
  // the boulder-trio apron, drift-line country, the eel-outpost fringe,
  // the pinch's last garden before the lip.
  valePocket(82, 4.5, 5),
  valePocket(104, -5.5, 4.5),
  valePocket(130, 4, 5),
  valePocket(152, -5, 5),
  valePocket(176, 5.5, 4),
  valePocket(206, -5.5, 4.5),
  valePocket(232, 4.5, 4.5),
  // The Dune Ocean rhythm: a pocket every crest-trough cycle (~35–45 m)
  // down the road, alternating flanks.
  { u: 312, v: 20, radius: 7 },
  { u: 338, v: -12, radius: 7 },
  { u: 365, v: 34, radius: 7 },
  { u: 352, v: -58, radius: 7 },
  { u: 398, v: -36, radius: 7 },
  { u: 415, v: -10, radius: 6 },
  { u: 440, v: -54, radius: 7 },
] as const;

/**
 * The slip-face crest scan (the pilot's own move, shared): the shoal, the
 * ribbons, the slip-face pose and the close-wire pose must all agree
 * which dune is the subject.
 */
export function slipCrestU(): number {
  const laneV = 14;
  let crestU = 330;
  let crestY = -Infinity;
  for (let u = 330; u <= 376; u += 0.5) {
    const spot = worldOf(u, laneV);
    const y = goldenTerrainTarget(spot.x, spot.z);
    if (y > crestY) {
      crestY = y;
      crestU = u;
    }
  }
  return crestU;
}

/**
 * The close poses' camera stations (2–4 m lenses). The cover gates carve
 * a small standing-free hole at each so no blade or frond ever grows
 * into a lens — asserted by the region test.
 */
export const CLOSE_LENSES: readonly { u: number; v: number }[] = [
  { u: 308.9, v: 16.4 }, // close-lee-garden
  { u: 432.5, v: 24.5 }, // close-salt-lily
  { u: 387.5, v: -66.5 }, // close-sand-rose
  { u: 521.5, v: -72.5 }, // close-palm-foot
  { u: slipCrestU() - 3, v: 14 - 2.5 }, // close-wire-crest
] as const;

/** 1 clear of every close lens, 0 within a metre of one. */
export function lensFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  let free = 1;
  for (const lens of CLOSE_LENSES) {
    free = Math.min(free, smoothstep01((Math.hypot(u - lens.u, v - lens.v) - 1.05) / 0.6));
  }
  return free;
}

/**
 * The drift-lines (plan §2, u ~130 beat and the ocean troughs): wrack and
 * shell runs angled across the road, in spoke coordinates. Each is a
 * short polyline the debris strands along.
 */
export const DRIFT_LINES: readonly (readonly (readonly [number, number])[])[] = [
  // Drift-line 1: angled across the saddle channel at the u ~130 beat.
  [
    [124, -8],
    [131, -1],
    [138, 7],
  ],
  // Two ocean trough lines, riding the inter-rank gaps.
  [
    [330, -30],
    [342, -20],
    [356, -14],
  ],
  [
    [385, 18],
    [398, 28],
    [412, 34],
  ],
] as const;
