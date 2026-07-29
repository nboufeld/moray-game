import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";

/**
 * THE DROP PLAINS — the pure half. Everything here is a seeded function of
 * position: it runs inside `seabedHeight`, so it must be deterministic,
 * cheap, and reach no scene object. The built half reads these same
 * functions, which is what keeps every megalith, blade and capture pose
 * standing on the ground the collision field believes in.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 5.31) in metres from the world
 * origin; `v` is lateral, positive counterclockwise. The disc's heart is at
 * u = 445, v = 0. `s = u − 445` is the signed distance past the heart,
 * positive toward the world's far rim.
 *
 * - **The Long Slope** (u 48 → 300): a broad open glide out of the Open
 *   Blue's end wall. The floor leaves the wing at its own −14 and eases
 *   down to the steppe's −17; soft dune shoulders rise at the flanks. No
 *   canyon walls — the subject is space, and the approach is the first
 *   taste of it.
 * - **The Seagrass Steppe** (the disc's near two thirds): a rolling
 *   blue-green prairie at −17, structured by long directional swells
 *   (wavelength ≈ 42 m, amplitude ≈ ±2.4) that lie *across* the line of
 *   travel, so wandering outward keeps lifting new crests out of the fog.
 * - **The Standing Stones**: built objects on the steppe (no terrain of
 *   their own beyond seat pads) — see `Blue1Stones`.
 * - **The Terraces** (s 26 → 96, |v| < ~150): the floor steps down in
 *   three great shelves, −17 → −21.3 → −25.6 → −29.9, each step a value
 *   deeper, swells flattening as the ground lets go.
 * - **The World's Edge** (s > ~104, |v| < ~95): the last shelf ends at a
 *   true drop — the floor plunges past −30 to the Under-Blue at −46.5,
 *   and runs deep and flat until the fog and the painted distance take
 *   over. The overlook at the lip is the region's landmark.
 *
 * Everything the diver can reach lives inside the weight-1 core
 * (rc ≤ ~164 of the disc's centre, |lateral| inside the tongue), so the
 * composed ground *is* this function wherever the diver can stand — which
 * is what makes the bounds annex's `terrainTarget + clearance` floor
 * honest even forty-six metres down.
 */

export const BLUE1_SLOT = regionSlot("great-blue-1");
const CENTER = slotCenter(BLUE1_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(BLUE1_SLOT.azimuth);
const AXIS_Z = Math.sin(BLUE1_SLOT.azimuth);

const SEED = SEEDS.regionBlue1;

/** Spoke coordinates: `u` along the province axis, `v` lateral. */
export function spokeOf(x: number, z: number): { u: number; v: number } {
  return { u: x * AXIS_X + z * AXIS_Z, v: -x * AXIS_Z + z * AXIS_X };
}

/** World position from spoke coordinates — the builders' one placement door. */
export function worldOf(u: number, v: number): { x: number; z: number } {
  return { x: u * AXIS_X - v * AXIS_Z, z: u * AXIS_Z + v * AXIS_X };
}

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

// ─── The domain ─────────────────────────────────────────────────────────────

/**
 * The approach, as two max-combined tongues (the pilot's audited scheme).
 *
 * The seam tongue holds the doorway: 8.2 m of half-width at the wing's
 * end. The neighbouring wedges (Mangrove Roots to 5.115 rad, Ice Grotto
 * from 5.505) sit 0.195 rad off this spoke's 5.31, which at r = 44 is
 * 8.58 m of lateral clearance — 8.2 clears both with margin, and the gap
 * widens faster than the tongue until the wings' carves end at r = 50.
 *
 * The slope tongue begins at r = 62 — past every wing's carve end — and
 * opens to the width the glide actually breathes in.
 */
export const BLUE1_TONGUE: Tongue = approachTongue(BLUE1_SLOT, {
  halfWidthFrom: 8.2,
  halfWidthTo: 34,
});

export const BLUE1_TONGUE_WIDE: Tongue = approachTongue(BLUE1_SLOT, {
  fromR: 62,
  halfWidthFrom: 20,
  halfWidthTo: 40,
});

const DISC = slotDisc(BLUE1_SLOT);

/** Ownership in [0, 1]; exactly 0 outside the disc and the tongues. */
export function blue1Weight(x: number, z: number): number {
  return Math.max(
    discWeight(DISC, x, z),
    tongueWeight(BLUE1_TONGUE, x, z),
    tongueWeight(BLUE1_TONGUE_WIDE, x, z),
  );
}

function tongueWidthAt(tongue: Tongue, u: number): number {
  const along = Math.min(1, Math.max(0, (u - tongue.fromR) / (tongue.toR - tongue.fromR)));
  return tongue.halfWidthFrom + (tongue.halfWidthTo - tongue.halfWidthFrom) * along;
}

/** The combined half-width at a spoke distance, for builders and seals. */
export function tongueHalfWidth(u: number): number {
  const seam = tongueWidthAt(BLUE1_TONGUE, u);
  if (u < BLUE1_TONGUE_WIDE.fromR - 4) {
    return seam;
  }
  return Math.max(seam, tongueWidthAt(BLUE1_TONGUE_WIDE, u));
}

// ─── The Long Slope ─────────────────────────────────────────────────────────

export const SLOPE_FROM = 44;
export const SLOPE_TO = 300;

/** The glide's gentle lateral wander — a path, not a canyon. */
export function slopeChannelCenter(u: number): number {
  const grow = Math.min(1, (u - SLOPE_FROM) / 160);
  return grow * (6 * Math.sin(u * 0.021 + 1.2) + 3 * Math.sin(u * 0.009 + 0.4));
}

/** The open swim channel's half-width: 6 m at the seam, ~20 at the mouth. */
export function slopeChannelHalf(u: number): number {
  return 6 + Math.max(0, u - SLOPE_FROM) * 0.058;
}

/** The glide's floor along the spine: the wing's −14, easing to the steppe. */
export function slopeFloor(u: number): number {
  return -14 - 3.2 * smoothstep01((u - 76) / 180);
}

function slopeHeight(x: number, z: number, u: number, v: number): number {
  const floor = slopeFloor(u);
  const away = Math.abs(v - slopeChannelCenter(u));
  // Soft dune shoulders, not walls: the glide is bounded by swells the eye
  // reads as prairie beginning, and the colliders do the actual sealing.
  const shoulder = 4.5 * smoothstep01((away - slopeChannelHalf(u)) / 12);
  const detail =
    (fbm(x * 0.017, z * 0.017, { seed: SEED ^ 0x51de, period: 7, octaves: 2 }) - 0.5) * 1.1;
  // Beyond the tongue's own width the authored slope returns to dune level:
  // the annex floor reads this function, and a floor authored where the
  // domain barely owns the point is a phantom floor.
  const inside = 1 - smoothstep01((Math.abs(v) - tongueHalfWidth(u)) / 18);
  return (floor + shoulder + detail) * inside;
}

// ─── The disc's sub-biomes ──────────────────────────────────────────────────

/** The steppe's resting floor, before swells. */
export const STEPPE_FLOOR = -17;

/** The three terrace floors and where each shelf begins (in s = u − 445). */
export const TERRACE_STEPS: readonly { s: number; drop: number }[] = [
  { s: 30, drop: 4.3 },
  { s: 58, drop: 4.3 },
  { s: 84, drop: 4.3 },
];

/** Where the last shelf ends and the floor lets go (in s). */
export const DROP_LIP_S = 104;
/** The Under-Blue: the deep floor past the drop. */
export const DEEP_FLOOR = -46.5;

/** How much of the terrace band owns a spoke point, in [0, 1]. */
export function terraceWeight(v: number): number {
  return 1 - smoothstep01((Math.abs(v) - 138) / 42);
}

/** How much of the World's Edge drop owns a spoke point, in [0, 1]. */
export function dropWeight(s: number, v: number): number {
  return smoothstep01((s - DROP_LIP_S) / 13) * (1 - smoothstep01((Math.abs(v) - 92) / 28));
}

/** The steppe's long directional swells — the prairie's whole structure. */
export function steppeSwell(x: number, z: number, u: number): number {
  const roll =
    (fbm(x * 0.0085, z * 0.0085, { seed: SEED ^ 0x4011, period: 5, octaves: 2 }) - 0.5) * 3.4;
  // Crests lie across the line of travel (keyed on u), wavelength ~42 m,
  // wobbled by a slow field so they read as dunes and never as corduroy.
  const wobble = fbm(x * 0.006, z * 0.006, { seed: SEED ^ 0x4012, period: 4, octaves: 2 }) * 5;
  const ridge = 2.0 * Math.sin(u * 0.149 + wobble);
  return roll + ridge;
}

function discHeight(x: number, z: number, u: number, v: number): number {
  const s = u - 445;

  // The steppe, swelled.
  const swell = steppeSwell(x, z, u);
  let h = STEPPE_FLOOR + swell;

  // The terraces: three shelf steps, each a value deeper, the swells
  // flattening as the ground steps away.
  const tw = terraceWeight(v);
  if (tw > 0 && s > TERRACE_STEPS[0]!.s - 14) {
    let stepDown = 0;
    let flatten = 0;
    for (const step of TERRACE_STEPS) {
      const k = smoothstep01((s - step.s) / 8);
      stepDown += step.drop * k;
      flatten += 0.26 * k;
    }
    h += tw * (-stepDown - swell * Math.min(0.72, flatten));
  }

  // The World's Edge: the floor lets go. Applied last so the drop wins its
  // own quarter outright; a small fbm keeps the Under-Blue a seabed and
  // not a stage floor.
  const dw = dropWeight(s, v);
  if (dw > 0) {
    const deep =
      DEEP_FLOOR +
      (fbm(x * 0.013, z * 0.013, { seed: SEED ^ 0xdeeb, period: 6, octaves: 2 }) - 0.5) * 1.8;
    h += dw * (deep - h);
  }

  // Ground life at the scale the sheets can carry.
  h += (fbm(x * 0.026, z * 0.026, { seed: SEED ^ 0x9b01, period: 9, octaves: 2 }) - 0.5) * 0.7;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. Pure and always live.
 * The slope and the disc cross-fade over u 260–300, and the whole answer
 * eases back to dune level across the disc's weight feather (gated off
 * the approach corridor) so the composed ground and this target agree
 * wherever the diver can be.
 */
export function blue1TerrainTarget(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

  let h: number;
  if (u < 260) {
    h = slopeHeight(x, z, u, v);
  } else if (u < SLOPE_TO) {
    const t = smoothstep01((u - 260) / (SLOPE_TO - 260));
    const slope = slopeHeight(x, z, u, v);
    h = slope + t * (discHeight(x, z, u, v) - slope);
  } else {
    h = discHeight(x, z, u, v);
  }

  // The rim fade: authored ground returns to dune level before the weight
  // feather ends. Gated on `u` so the corridor never fades — the slope
  // runs its whole length farther than 164 m from the disc's centre.
  const fade = 1 - smoothstep01((rc - 172) / 36) * smoothstep01((u - 268) / 40);
  return h * fade;
}

// ─── The ceiling ────────────────────────────────────────────────────────────

/** Where the diver's world is sealed: the weight-1 core's own radius. */
export const SEAL_RC = 164;

/**
 * Swim ceiling: 11.5 m at the seam (meeting the Open Blue's own 11), then
 * the glide takes it down to −1.5 over the slope — descending with the
 * diver, the "long glide down" made physical — before it opens back to
 * +14 over the disc, and stays high over the drop so the vertigo has a
 * whole water column to happen in. At the seal radius the column pinches
 * to 3 m over the local floor so one ring of collider spheres closes the
 * world floor-to-ceiling.
 */
export function blue1Ceiling(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 11.5 - 13 * smoothstep01((u - 78) / 95) + 15.5 * smoothstep01((u - 268) / 60);
  // The rim closure is floor-relative (the floor out here spans −17 to
  // −46.5) and gated smoothly off the corridor, whose own low ceiling and
  // flank seals carry the approach.
  const corridorOpen =
    (1 - smoothstep01((u - 308) / 24)) * (1 - smoothstep01((Math.abs(v) - 18) / 12));
  const close = smoothstep01((rc - 140) / 24) * (1 - corridorOpen);
  if (close > 0) {
    c += (blue1TerrainTarget(x, z) + 3.0 - c) * close;
  }
  return c;
}
