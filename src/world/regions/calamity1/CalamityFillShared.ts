import { smoothstep01 } from "./CalamityShared";
import {
  GATE_U,
  LAST_GROVE,
  SEEP_GARDENS,
  WOUND,
  marchChannelCenter,
  marchChannelHalf,
  spokeOf,
} from "./CalamityTerrain";

/**
 * The Phase 3 fill's shared half: fresh seed substream constants (the
 * reroll fence) and the protected-stillness gates (MASTER §1.2 — the
 * registry is inviolable).
 *
 * ## The reroll fence
 *
 * Every fill stream is `SEEDS.regionCalamity ^` one of the constants
 * below — all new, none shared with the pilot's streams — and every fill
 * builder makes its own `Random` from one. Nothing here consumes from any
 * existing builder's stream, so the pilot's content (every drum, slab,
 * amphora, ghost giant and the Curator's shrine) keeps its exact
 * position; the region test pins a thrown stone, an amphora, a bank
 * tooth and the first ghost giant to prove it.
 *
 * ## The registry gates (MASTER §1.2 for sunken-calamity-1)
 *
 * - **the Suffocated Mile u 352–440** — THE grief clause: no shoal, no
 *   darts, no crabs, ash snow at ~an eighth density, no new glow. Its
 *   only fill is four amphora clusters and one bubble thread. T1 shard
 *   litter *thins to sparse singles* through it (the plan's own zone
 *   table), which {@link mileThin} carries.
 * - **the Gardener's ten metres of road** — object-free, the statue
 *   lies alone.
 * - **the crest after the reveal** (u ≈ 470–496 over the channel) — the
 *   breath before the crater country.
 * - **the grove's inner lawn** — the clearing between the two clumps.
 * - **the shrine** — the pile and its keeper; the gleam-crab pilgrims
 *   approach it but stand outside.
 * - **mid-Quiet-Rim** — a hundred metres of composed rest is not
 *   allowed, but its centre band is.
 */

// ─── Fill seed substreams (all fresh — see the fence note above) ────────────

export const FILL_SEEDS = {
  shardMarch: 0xf201,
  shardShatter: 0xf202,
  ashLap: 0xf203,
  strawLanes: 0xf204,
  ashBloom: 0xf205,
  groveMeadow: 0xf206,
  groveMeadowLit: 0xf207,
  fernRosettes: 0xf208,
  deadScrub: 0xf209,
  relicsMarch: 0xf20a,
  relicsRim: 0xf20b,
  boneKnuckles: 0xf20c,
  fillStones: 0xf211,
  fillTeeth: 0xf212,
  fillAmphorae: 0xf213,
  fillCauseway: 0xf214,
  rootBosses: 0xf215,
  fillWorms: 0xf221,
  feltMats: 0xf222,
  marchRunner: 0xf231,
  craterRunner: 0xf232,
  snailBeads: 0xf233,
  crabColony: 0xf234,
  gleamCrabs: 0xf235,
  wrassePair: 0xf236,
  ashMoths: 0xf237,
  ghostShrimp: 0xf238,
  pollenMotes: 0xf239,
  coldWisps: 0xf241,
  terraceSeams: 0xf242,
  skyCard: 0xf243,
  ejectaCrumbs: 0xf251,
  ejectaSlabs: 0xf252,
  flankStraw: 0xf253,
  flankScrub: 0xf254,
  flankKnuckles: 0xf255,
  rayCrumbs: 0xf256,
  raySlabs: 0xf257,
  rayStraw: 0xf258,
} as const;

// ─── The registry gates ──────────────────────────────────────────────────────

/** Where the Suffocated Mile owns a spoke point, in [0, 1]. */
export function mileWeight(u: number, v: number): number {
  const along = smoothstep01((u - 348) / 6) * (1 - smoothstep01((u - 442) / 6));
  const across = 1 - smoothstep01((Math.abs(v - marchChannelCenter(Math.min(u, 505))) - 16) / 10);
  return along * across;
}

/** T1 litter thins to sparse singles through the Mile (plan §3's own row). */
export function mileThin(u: number, v: number): number {
  return 1 - mileWeight(u, v) * 0.94;
}

/**
 * The unqualified rests: nothing new stands inside them. 1 elsewhere.
 * (The Mile is handled separately — its clause admits thinned T1.)
 */
export function restFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  // The Gardener's ten metres of road: the statue lies alone.
  const gardener = 1 - smoothstep01((Math.hypot(u - 252, v - 5.5) - 5) / 3);
  // The crest after the reveal: the breath stays bare over the channel.
  const crest =
    smoothstep01((u - (GATE_U - 2)) / 4) *
    (1 - smoothstep01((u - 496) / 6)) *
    (1 - smoothstep01((Math.abs(v - marchChannelCenter(Math.min(u, 505))) - 8) / 5));
  // The grove's inner lawn: the clearing of the shrine's approach,
  // between the two clumps and beside the warm shaft's footprint.
  const lawn = 1 - smoothstep01((Math.hypot(u - (LAST_GROVE.u + 0.5), v - (LAST_GROVE.v + 5)) - 4.5) / 3);
  // The shrine: the pile, the Curator, and room to tend it.
  const shrine = 1 - smoothstep01((Math.hypot(u - 771, v - -82) - 3.5) / 2.5);
  // Mid-Quiet-Rim: the rest the far shelf keeps at its heart.
  const midRim =
    smoothstep01((u - 838) / 6) * (1 - smoothstep01((u - 868) / 6)) * (1 - smoothstep01((Math.abs(v) - 24) / 8));
  return (1 - gardener) * (1 - crest) * (1 - lawn) * (1 - shrine) * (1 - midRim);
}

/** Where LIFE may stand: the rests above plus the whole Suffocated Mile. */
export function faunaFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  return restFree(x, z) * (1 - mileWeight(u, v));
}

/**
 * The wrong-regrowth proximity: 1 at the seeps' shoulders and the grove's
 * eaves, dead by ~25 m out — the ash-bloom's licence (fill plan §6b) and
 * the pioneer worms' gradient share this shape.
 */
export function regrowthReach(u: number, v: number): number {
  const gardens = 1 - smoothstep01((Math.hypot(u - SEEP_GARDENS.u, v - SEEP_GARDENS.v) - 14) / 25);
  const grove = 1 - smoothstep01((Math.hypot(u - LAST_GROVE.u, v - LAST_GROVE.v) - 16) / 25);
  return Math.max(gardens, grove);
}

/**
 * The crater country's outer shoulders — MASTER's field note made
 * spatial: rim-facing zones need flank bands, and the round-1 sweep put
 * nine of twelve poses out here (|v| ≥ 60, u 548–819) over bare felt.
 * 0 on the spine, rising past |v| 46, full by |v| ~64, held to the
 * crater country (u ≥ 500 — the march has its own banks).
 */
export function flankReach(u: number, v: number): number {
  return smoothstep01((u - 500) / 30) * smoothstep01((Math.abs(v) - 46) / 18);
}

/**
 * The five ejecta rays' azimuths in the spoke frame (0° points down-spine,
 * +v is +90°). Craters do not blanket evenly — they throw debris in RAYS —
 * and round 3 proved a uniform blanket cannot buy a foreground read over
 * ~145,000 m² of crater country at any honest budget. The azimuths are
 * aimed the way the bank snags were: the sweep pose stream is
 * deterministic, so the rays lie along the failing and lean view lines
 * (poses 10, 05, 07, 06 and 09 in ray order).
 */
const RAY_AZIMUTHS = [51, 83, 119, 149.4, 225].map((deg) => (deg * Math.PI) / 180);

/**
 * Where an ejecta ray owns a spoke point, in [0, 1]: full within ~9 m of
 * a ray's spine, dead past ~20 m, running craterD 62 → 178 with soft
 * ends (inside 62 the blanket and the bowl's own scorch take over).
 */
export function ejectaRayReach(u: number, v: number): number {
  const du = u - WOUND.u;
  const dv = v - WOUND.v;
  const d = Math.hypot(du, dv);
  if (d < 55 || d > 215) {
    return 0;
  }
  const angle = Math.atan2(dv, du);
  let across = 0;
  for (const azimuth of RAY_AZIMUTHS) {
    let delta = Math.abs(angle - azimuth);
    if (delta > Math.PI) {
      delta = Math.PI * 2 - delta;
    }
    const lateral = delta * d;
    across = Math.max(across, 1 - smoothstep01((lateral - 9) / 11));
  }
  const along = smoothstep01((d - 62) / 18) * (1 - smoothstep01((d - 178) / 30));
  return across * along;
}

/** How close a spoke point stands to the march channel's swim line, metres.
 *  The centre is clamped at u 505 the way the seals clamp it — past the
 *  Gate the channel hands over to the disc and stops wandering. */
export function channelDistance(u: number, v: number): number {
  if (u < 44 || u > 540) {
    return Infinity;
  }
  return Math.abs(v - marchChannelCenter(Math.min(u, 505)));
}

/** The march's swim corridor half-width at a station (for clearances). */
export function swimHalf(u: number): number {
  return marchChannelHalf(Math.min(u, 505));
}
