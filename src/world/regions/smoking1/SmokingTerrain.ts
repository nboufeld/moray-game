import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";

/**
 * THE SMOULDER FIELDS — the pure half. Every function here is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object. The built half reads
 * these same functions, which keeps every chimney, column and capture
 * pose standing on the ground the collision field believes in.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 2.79) in metres from the
 * world origin; `v` is lateral, positive counterclockwise. The disc's
 * heart is at u = 445, v = 0.
 *
 * - **The Black-Sand Gorge** (u 48 → 285): a winding charcoal ravine out
 *   of the Vent Springs' opened end wall. The floor leaves the wing at its
 *   own −7.5, deepens to −9.2 through the narrows where the water warms,
 *   climbs to a +1.2 saddle lip at u ≈ 266 — the reveal — and falls into
 *   the ash flats.
 * - **The Ash Meadows** (the disc's resting ground): grey-violet flats at
 *   −2.4 ± 1.3, the quiet between the set pieces.
 * - **The Basalt Steps** (u 420, v +92, r 84): columnar-jointed country —
 *   terraces quantised into 1.6 m benches rising to +8 at the heart,
 *   where the colonnades stand.
 * - **The Spring Terraces** (u 385, v −72, r 60): stacked mineral pools
 *   stepping down from a +6.5 crown in 1.1 m rings, each pool floor flat,
 *   each rim pale.
 * - **The Chimney Forest** (u 512, v −52, r 66): a −12 hummocked basin
 *   where the smokers stand tall as trees.
 * - **The Caldera** (u 505, v +55, r 58): a great bowl of haze down to
 *   −20, ringed by a +2.5 rim — the Old Kiln rests at its centre.
 * - **The Ember Shore** (u > 555): a −2 shelf before the rim, where the
 *   charcoal-and-amber painted distance takes over.
 *
 * Everything dramatic lives inside the weight-1 core (rc ≤ 170 of the
 * disc's centre), so the composed ground *is* this function wherever the
 * diver can stand — which is what makes the bounds annex's
 * `terrainTarget + clearance` floor honest.
 */

export const SMOKING_SLOT = regionSlot("smoking-marches-1");
const CENTER = slotCenter(SMOKING_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(SMOKING_SLOT.azimuth);
const AXIS_Z = Math.sin(SMOKING_SLOT.azimuth);

const SEED = SEEDS.regionSmoking1;

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
 * The approach, as two max-combined tongues — the pilot's audited split.
 *
 * The seam tongue holds the doorway: the neighbouring wings (wreck-meadow
 * at 2.43, moonlit-lagoon at 3.15) sit 0.36 rad off this spoke with
 * 0.165 rad end wedges, so their nearest edges are 0.195 rad away — at
 * r = 44 an 8.2 m half-width (atan 0.184) clears both with real margin.
 *
 * The gorge tongue begins at r = 62 — past every wing's carve end — and
 * carries the width the gorge's walls and shoulders actually need.
 */
export const SMOKING_TONGUE: Tongue = approachTongue(SMOKING_SLOT, {
  halfWidthFrom: 8.2,
  halfWidthTo: 34,
});

export const SMOKING_TONGUE_WIDE: Tongue = approachTongue(SMOKING_SLOT, {
  fromR: 62,
  halfWidthFrom: 20,
  halfWidthTo: 40,
});

const DISC = slotDisc(SMOKING_SLOT);

/** Ownership in [0, 1]; exactly 0 outside the disc and the tongues. */
export function smokingWeight(x: number, z: number): number {
  return Math.max(
    discWeight(DISC, x, z),
    tongueWeight(SMOKING_TONGUE, x, z),
    tongueWeight(SMOKING_TONGUE_WIDE, x, z),
  );
}

function tongueWidthAt(tongue: Tongue, u: number): number {
  const along = Math.min(1, Math.max(0, (u - tongue.fromR) / (tongue.toR - tongue.fromR)));
  return tongue.halfWidthFrom + (tongue.halfWidthTo - tongue.halfWidthFrom) * along;
}

/** The combined half-width at a spoke distance, for builders and seals. */
export function tongueHalfWidth(u: number): number {
  const seam = tongueWidthAt(SMOKING_TONGUE, u);
  if (u < SMOKING_TONGUE_WIDE.fromR - 4) {
    return seam;
  }
  return Math.max(seam, tongueWidthAt(SMOKING_TONGUE_WIDE, u));
}

// ─── The Black-Sand Gorge ───────────────────────────────────────────────────

export const GORGE_FROM = 44;
export const GORGE_TO = 292;
/** Where the saddle lip crests — the reveal pose stands just short of it. */
export const GORGE_LIP_U = 266;

/** The channel's lateral wander: bolder as the gorge deepens. */
export function gorgeChannelCenter(u: number): number {
  const grow = Math.min(1, (u - GORGE_FROM) / 190);
  return grow * (7.5 * Math.sin(u * 0.041 + 0.8) + 4 * Math.sin(u * 0.017 + 3.4));
}

/** Channel half-width: opens with distance, pinched just before the lip. */
export function gorgeChannelHalf(u: number): number {
  const pinch = 3.6 * smoothstep01((u - 232) / 16) * (1 - smoothstep01((u - 258) / 16));
  return Math.max(2.8, 4.4 + (u - GORGE_FROM) * 0.03 - pinch);
}

/** The channel floor along the spine — the gorge's whole story in one curve. */
export function gorgeFloor(u: number): number {
  let f = -7.5;
  f += -1.7 * smoothstep01((u - 76) / 70); // deepening where the water warms
  f += 2.2 * smoothstep01((u - 150) / 55); // easing back up
  f += 8.2 * smoothstep01((u - 200) / 62); // the climb to the lip
  f += -3.7 * smoothstep01((u - GORGE_LIP_U) / 24); // and over, into the ash
  return f;
}

/**
 * Wall height above the channel floor: 4 m at the mouth, 10 past the
 * narrows — capped so the wall's plateau always stays a swimmable margin
 * under the gorge's ceiling (the annex floor reads this function, and a
 * plateau above the ceiling is a phantom floor).
 */
function gorgeWallHeight(u: number): number {
  const drawn = 4 + 6 * smoothstep01((u - 60) / 150);
  return Math.max(0, Math.min(drawn, 6.0 - gorgeFloor(u)));
}

function gorgeHeight(x: number, z: number, u: number, v: number): number {
  const floor = gorgeFloor(u);
  const away = Math.abs(v - gorgeChannelCenter(u));
  const wall = gorgeWallHeight(u) * smoothstep01((away - gorgeChannelHalf(u)) / 8);
  const detail =
    (fbm(x * 0.023, z * 0.023, { seed: SEED ^ 0xb1ac, period: 8, octaves: 2 }) - 0.5) * 0.8;
  // Beyond the tongue's own width the authored gorge returns to dune
  // level: out there the weight is a whisker over zero, and the annex
  // floor reads this function.
  const inside = 1 - smoothstep01((Math.abs(v) - tongueHalfWidth(u)) / 18);
  return (floor + wall + detail) * inside;
}

// ─── The disc's sub-biomes ──────────────────────────────────────────────────

export const BASALT = { u: 420, v: 92, radius: 84 } as const;
export const SPRINGS = { u: 385, v: -72, radius: 60 } as const;
export const CHIMNEYS = { u: 512, v: -52, radius: 66 } as const;
export const CALDERA = { u: 505, v: 55, radius: 58 } as const;

/** Ash flats level, before swells. */
export const ASH_FLOOR = -2.4;
/** The chimney forest's basin floor, before hummocks. */
export const FOREST_FLOOR = -12;
/** The caldera's authored floor. */
export const CALDERA_FLOOR = -20;
/** The Old Kiln's world seat, at the caldera's centre. */
export const KILN = { u: CALDERA.u, v: CALDERA.v } as const;

/** The basalt bench height and the springs' pool step. */
export const BASALT_STEP = 1.6;
export const SPRING_STEP = 1.1;

/** How much of the basalt country owns a spoke point, in [0, 1]. */
export function basaltWeight(u: number, v: number): number {
  const d = Math.hypot(u - BASALT.u, v - BASALT.v);
  return 1 - smoothstep01((d / BASALT.radius - 0.28) / 0.72);
}

/** How much of the spring terraces own a spoke point, in [0, 1]. */
export function springsWeight(u: number, v: number): number {
  const d = Math.hypot(u - SPRINGS.u, v - SPRINGS.v);
  return 1 - smoothstep01((d / SPRINGS.radius - 0.25) / 0.75);
}

/** How much of the chimney forest owns a spoke point, in [0, 1]. */
export function chimneysWeight(u: number, v: number): number {
  const d = Math.hypot(u - CHIMNEYS.u, v - CHIMNEYS.v);
  return 1 - smoothstep01((d / CHIMNEYS.radius - 0.3) / 0.7);
}

/** How much of the caldera owns a spoke point, in [0, 1]. */
export function calderaWeight(u: number, v: number): number {
  const d = Math.hypot(u - CALDERA.u, v - CALDERA.v);
  return 1 - smoothstep01((d - 30) / 34);
}

/** How much of the Ember Shore shelf owns a spoke point, in [0, 1]. */
export function shoreWeight(u: number): number {
  return smoothstep01((u - 555) / 65);
}

/**
 * Smooth bench quantisation: flat treads with short risers, the terraced
 * silhouette columnar country and mineral springs are both drawn from.
 */
function bench(height: number, step: number, riser: number): number {
  const t = height / step;
  const whole = Math.floor(t);
  const frac = t - whole;
  return (whole + smoothstep01((frac - (1 - riser)) / riser)) * step;
}

/**
 * The springs' terrace field: the raw (unbenched) height of the mineral
 * stair at a spoke point, and the benched pool height. Exported so the
 * builder can seat rims and water sheets exactly on the terrain's steps.
 */
export function springsStair(u: number, v: number): { raw: number; pooled: number } {
  const wobble =
    (fbm(u * 0.05, v * 0.05, { seed: SEED ^ 0x59a1, period: 6, octaves: 2 }) - 0.5) * 14;
  const d = Math.hypot(u - SPRINGS.u, v - SPRINGS.v) + wobble;
  const raw = 6.5 - d * 0.155;
  return { raw, pooled: bench(raw, SPRING_STEP, 0.16) };
}

function discHeight(x: number, z: number, u: number, v: number): number {
  // The Ash Meadows: the disc's resting ground.
  const ash =
    ASH_FLOOR +
    (fbm(x * 0.012, z * 0.012, { seed: SEED ^ 0xa5f1, period: 5, octaves: 2 }) - 0.5) * 2.6;
  let h = ash;

  // The Basalt Steps: benched terraces rising to the colonnade's crown.
  const basalt = basaltWeight(u, v);
  if (basalt > 0) {
    const rawRise =
      10.4 * basalt +
      (fbm(x * 0.016, z * 0.016, { seed: SEED ^ 0xba5a, period: 7, octaves: 2 }) - 0.5) * 3;
    const benched = bench(Math.max(0, rawRise), BASALT_STEP, 0.22);
    const tread =
      (fbm(x * 0.05, z * 0.05, { seed: SEED ^ 0xb0d1, period: 9, octaves: 2 }) - 0.5) * 0.3;
    h += basalt * (ASH_FLOOR + 0.6 + benched + tread - h);
  }

  // The Spring Terraces: the mineral stair, pools benched flat.
  const springs = springsWeight(u, v);
  if (springs > 0) {
    const { pooled } = springsStair(u, v);
    h += springs * (pooled - h);
  }

  // The Chimney Forest: a warm hummocked basin.
  const forest = chimneysWeight(u, v);
  if (forest > 0) {
    const hummocks =
      (fbm(x * 0.02, z * 0.02, { seed: SEED ^ 0xc41d, period: 7, octaves: 2 }) - 0.5) * 2.8;
    h += forest * (FOREST_FLOOR + hummocks - h);
  }

  // The Ember Shore: the far shelf before the rim.
  const shore =
    -2.0 + (fbm(x * 0.013, z * 0.013, { seed: SEED ^ 0x5407, period: 5, octaves: 2 }) - 0.5) * 1.4;
  h += shoreWeight(u) * (shore - h);

  // The Caldera, last so its bowl wins its own quarter: a deep haze bowl
  // with a raised rim ring.
  const caldera = calderaWeight(u, v);
  if (caldera > 0) {
    const floorDetail =
      (fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0xca1d, period: 10, octaves: 2 }) - 0.5) * 1.6;
    h += caldera * (CALDERA_FLOOR + floorDetail - h);
  }
  const calderaD = Math.hypot(u - CALDERA.u, v - CALDERA.v);
  h +=
    2.5 *
    smoothstep01((calderaD - 46) / 10) *
    (1 - smoothstep01((calderaD - 60) / 14));

  // Ground life at the scale the sheets can carry.
  h += (fbm(x * 0.026, z * 0.026, { seed: SEED ^ 0x9e0a, period: 9, octaves: 2 }) - 0.5) * 0.7;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. Pure and always live —
 * it runs inside `seabedHeight` for every sample anyone takes anywhere in
 * the province. The gorge and the disc cross-fade over u 250–292, and the
 * whole answer eases back to dune level across the disc's weight feather
 * so the composed ground and this target agree wherever the diver can be.
 */
export function smokingTerrainTarget(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

  let h: number;
  if (u < 250) {
    h = gorgeHeight(x, z, u, v);
  } else if (u < GORGE_TO) {
    const s = smoothstep01((u - 250) / (GORGE_TO - 250));
    const gorge = gorgeHeight(x, z, u, v);
    h = gorge + s * (discHeight(x, z, u, v) - gorge);
  } else {
    h = discHeight(x, z, u, v);
  }

  // The rim fade: authored ground returns to dune level before the weight
  // feather ends, so the annex floor stays honest at the edge of the
  // world. Gated on `u` as well as `rc`, because the gorge runs its whole
  // length farther than 172 m from the disc's centre and must not fade.
  const fade = 1 - smoothstep01((rc - 172) / 38) * smoothstep01((u - 250) / 42);
  return h * fade;
}

// ─── The ceiling ────────────────────────────────────────────────────────────

/**
 * Swim ceiling: 10 m over the gorge mouth (meeting the Vent Springs'
 * vault), easing to 8.5 through the narrows and over the lip, opening to
 * 28.5 over the disc — the caldera's haze column and the chimney forest's
 * risers want the head-room — and closing to 3.4 at the disc's rim so one
 * ring of collider spheres seals the world's edge floor to ceiling.
 */
export function smokingCeiling(x: number, z: number): number {
  const { u } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 10 - 1.5 * smoothstep01((u - 70) / 70) + 20 * smoothstep01((u - 270) / 50);
  c += (3.4 - c) * smoothstep01((rc - 186) / 26) * smoothstep01((u - 250) / 42);
  return c;
}
