import { smoothstep01 } from "./Blue1Shared";
import {
  dropWeight,
  slopeChannelCenter,
  slopeChannelHalf,
  spokeOf,
  steppeSwell,
  worldOf,
} from "./Blue1Terrain";

/**
 * THE DROP PLAINS' fill — shared gates and seed constants (Phase 3,
 * docs/fill-plans/great-blue-1.md, rebased on the rescued region).
 *
 * Every fill stream is `SEEDS.regionBlue1 ^ FILL_SEEDS.*` — fresh
 * constants appended after every existing draw, so the standing reroll
 * fence holds: the landmarks, the Ferryman and the deep-step arcs keep
 * their buffers byte-identical (the region test pins them).
 *
 * The registered rests (MASTER §1.2) are enforced here, once, as a
 * multiplicative gate every fill piece consumes: THE UNDER-BLUE (Ferryman
 * only — nothing below the lip, ever), the MID-GLIDE HUSH (the channel
 * lane kept clean for its whole length, the hush composed by its
 * shoulders), the FALLEN KING HOLLOW (stars and beam only), and the PROW
 * TIP. A random frame that lands in one of these and reads bare is
 * CORRECT (MASTER R10).
 */

export const FILL_SEEDS = {
  grassNear: 0xf301,
  grassMid: 0xf302,
  grassFar: 0xf303,
  crestGrass: 0xf304,
  crestLee: 0xf305,
  slopeGravel: 0xf306,
  collarAprons: 0xf307,
  calves: 0xf308,
  collarWhelks: 0xf309,
  blennies: 0xf30a,
  scree: 0xf30b,
  deepStars: 0xf30c,
  fryPods: 0xf30d,
  outriders: 0xf30e,
  jacks: 0xf30f,
  gateRubble: 0xf310,
  gateBushes: 0xf311,
  waylineGrit: 0xf312,
  cloudShadow: 0xf313,
  grassSeeds: 0xf314,
  cloudShadow2: 0xf315,
  shelfLitter: 0xf316,
  outriders2: 0xf317,
  roadSeat: 0xf318,
} as const;

/** The Fallen King's ring (the secret at the stump's foot) — the rest's
 *  centre; the hollow stays stars-and-beam only. */
const KING_RING = worldOf(383.8, -102.2);
const KING_REST_R = 9;

/** The Prow tip: the overlook's last metres stay object-free. */
const PROW_TIP = worldOf(551.4, 4);
const PROW_REST_R = 8;

/**
 * The registered-rest gate in [0, 1]: 0 inside a rest, easing to 1 just
 * outside it. Every fill piece multiplies this into its own gate.
 */
export function restFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);

  // THE UNDER-BLUE: nothing past the lip's grip, ever.
  if (dropWeight(u - 445, v) > 0.05) {
    return 0;
  }

  // The Fallen King hollow.
  const king = Math.hypot(x - KING_RING.x, z - KING_RING.z);
  const kingFree = smoothstep01((king - KING_REST_R) / 4);

  // The Prow tip.
  const prow = Math.hypot(x - PROW_TIP.x, z - PROW_TIP.z);
  const prowFree = smoothstep01((prow - PROW_REST_R) / 4);

  return kingFree * prowFree;
}

/**
 * The slope's clean sand road: 0 inside the channel lane, 1 on the
 * shoulders. The mid-glide hush (u 180–230) is composed BY this — the
 * channel stays clean for its whole length and the hush's shoulders
 * carry the composition.
 */
export function channelClear(u: number, v: number): number {
  if (u >= 300) {
    return 1;
  }
  const away = Math.abs(v - slopeChannelCenter(u));
  return smoothstep01((away - slopeChannelHalf(u) - 0.5) / 2.5);
}

/** Crest weight of the steppe swells in [0, 1] — the wind-combed beds' key. */
export function crestWeight(x: number, z: number): number {
  const { u } = spokeOf(x, z);
  return smoothstep01((steppeSwell(x, z, u) - 1.0) / 1.0);
}

/**
 * Lee weight: how sheltered a point is behind an upwind crest — where the
 * pale gravel collects. Sampled by finite difference along the wind.
 */
export function leeWeight(x: number, z: number, windX: number, windZ: number): number {
  const ux = x - windX * 7;
  const uz = z - windZ * 7;
  const here = steppeSwell(x, z, spokeOf(x, z).u);
  const upwind = steppeSwell(ux, uz, spokeOf(ux, uz).u);
  return smoothstep01((upwind - here - 0.7) / 1.1);
}
