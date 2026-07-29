import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";

/**
 * THE SUNKEN CALAMITY — the pure half. Everything in this file is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object. The built half reads the
 * same functions, which is what keeps every thrown slab, ghost stipe and
 * capture pose standing on the ground the collision field believes in.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the spoke (azimuth 4.59) in metres from the world origin;
 * `v` is lateral, positive counterclockwise. The disc's heart — the crater
 * — is at u = 700, v = 0.
 *
 * - **The Long Sorrow** (u 48 → 530): the longest approach in the game,
 *   a winding march out of the Ruins Terrace's opened end wall through
 *   what the blast left: floor −6.6 at the seam, deepening to ≈ −8.6 down
 *   the blast road, then the climb to the Wound Gate — the thrown-up
 *   ejecta ridge cresting at +2.2 near u ≈ 470 — and over into the
 *   Shatterfield. Broken banks rise to ≈ 7 m, jagged where the pilot's
 *   vale was smooth.
 * - **The Shatterfield** (the disc's near third): the pavement that rose
 *   and fell — fractured benches at ≈ −5.2, ridged and tilted.
 * - **The Ghost Forest** (≈ u 560–690): the dead kelp sea's bench at
 *   ≈ −8.2, soft ash drifts.
 * - **The Wound** (u 700, v 0, r 58): the crater. Terraced bowls down to
 *   −30, a thrown-out lip ringing it at +1.3. The Cold Candle breathes
 *   at its heart.
 * - **The Seep Gardens** (u 752, v +58, r 46): a shelf at ≈ −11 where the
 *   small seeps keep their wrong-coloured gardens.
 * - **The Ridge and the Last Grove** (u 740, v −48 / u 774, v −86, r 42):
 *   the ejecta dike (+6.5) that took the blast's edge, and the sheltered
 *   hollow behind it (−13.4) where one grove never died.
 * - **The Quiet Rim** (u > 820): the far shelf at ≈ −3 where the
 *   devastation thins and the painted distance takes over.
 *
 * Everything dramatic lives inside the weight-1 core, so the composed
 * ground *is* this function wherever the diver can stand — which is what
 * makes the bounds annex's `terrainTarget + clearance` floor honest.
 */

export const CALAMITY_SLOT = regionSlot("sunken-calamity-1");
const CENTER = slotCenter(CALAMITY_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(CALAMITY_SLOT.azimuth);
const AXIS_Z = Math.sin(CALAMITY_SLOT.azimuth);

const SEED = SEEDS.regionCalamity;

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
 * The approach, as two max-combined tongues.
 *
 * The seam tongue holds the doorway: 8.2 m of half-width at the wing's
 * end — the same width the pilot proved, because the map here is the same:
 * the Current Run and Mangrove Roots wedges both reach 0.195 rad of the
 * 4.59 spoke at r = 44, and 8.2 m clears both with real margin (weight
 * exactly 0 in both neighbours' ground, held by their tests).
 *
 * The wide tongue begins at r = 62 — past every wing's carve end — and
 * carries the broken banks and rubble shoulders the march needs.
 */
export const CALAMITY_TONGUE: Tongue = approachTongue(CALAMITY_SLOT, {
  halfWidthFrom: 8.2,
  halfWidthTo: 30,
});

export const CALAMITY_TONGUE_WIDE: Tongue = approachTongue(CALAMITY_SLOT, {
  fromR: 62,
  halfWidthFrom: 18,
  halfWidthTo: 38,
});

const DISC = slotDisc(CALAMITY_SLOT);

/** Ownership in [0, 1]; exactly 0 outside the disc and the tongues. */
export function calamityWeight(x: number, z: number): number {
  return Math.max(
    discWeight(DISC, x, z),
    tongueWeight(CALAMITY_TONGUE, x, z),
    tongueWeight(CALAMITY_TONGUE_WIDE, x, z),
  );
}

function tongueWidthAt(tongue: Tongue, u: number): number {
  const along = Math.min(1, Math.max(0, (u - tongue.fromR) / (tongue.toR - tongue.fromR)));
  return tongue.halfWidthFrom + (tongue.halfWidthTo - tongue.halfWidthFrom) * along;
}

/** The combined half-width at a spoke distance, for builders and seals. */
export function tongueHalfWidth(u: number): number {
  const seam = tongueWidthAt(CALAMITY_TONGUE, u);
  if (u < CALAMITY_TONGUE_WIDE.fromR - 4) {
    return seam;
  }
  return Math.max(seam, tongueWidthAt(CALAMITY_TONGUE_WIDE, u));
}

// ─── The Long Sorrow ─────────────────────────────────────────────────────────

export const MARCH_FROM = 44;
export const MARCH_TO = 540;
/** Where the Wound Gate's thrown ridge crests — the reveal stands past it. */
export const GATE_U = 470;

/** The channel's lateral wander: the march winds, growing bolder as it goes. */
export function marchChannelCenter(u: number): number {
  const grow = Math.min(1, (u - MARCH_FROM) / 260);
  return grow * (9 * Math.sin(u * 0.038) + 5 * Math.sin(u * 0.017 + 2.4));
}

/** Channel half-width: opens with distance, pinched just before the Gate. */
export function marchChannelHalf(u: number): number {
  const pinch = 3.2 * smoothstep01((u - 414) / 18) * (1 - smoothstep01((u - 448) / 18));
  return Math.max(2.6, 4.2 + (u - MARCH_FROM) * 0.014 - pinch);
}

/** The channel floor along the spine — the march's whole story in one curve. */
export function marchFloor(u: number): number {
  let f = -6.6; // leaves the Ruins Terrace at its own floor
  f += -2.0 * smoothstep01((u - 90) / 90); // the blast road deepens
  f += 1.2 * smoothstep01((u - 220) / 80); // easing through the shock rings
  f += -0.8 * smoothstep01((u - 300) / 60); // the Suffocated Mile settles
  f += 10.4 * smoothstep01((u - 428) / 40); // the climb to the Wound Gate
  f += -8.0 * smoothstep01((u - 480) / 30); // and over, into the Shatterfield
  return f;
}

/**
 * Bank height above the channel floor: 3.5 m at the mouth, ≈ 7 past the
 * blast road — capped so the bank's plateau always stays a swimmable
 * margin under the march's ceiling (the annex floor reads this function,
 * and a plateau above the ceiling is a phantom floor).
 */
function marchBankHeight(u: number): number {
  const drawn = 3.5 + 3.5 * smoothstep01((u - 70) / 180);
  // The bank's jagged multiplier reaches 1.3, so the cap is written
  // against it: no crest, even over the Wound Gate's thrown ridge, may
  // stand closer than a swim's margin under the pinch ceiling.
  return Math.max(0, Math.min(drawn, (4.6 - marchFloor(u)) / 1.3));
}

function marchHeight(x: number, z: number, u: number, v: number): number {
  const floor = marchFloor(u);
  const away = Math.abs(v - marchChannelCenter(u));
  // The broken banks: the pilot's smooth vale walls thrown and jumbled —
  // a ridged noise multiplies the rise so the crest is a ruin, not a dune.
  const jag =
    0.7 +
    0.6 *
      Math.abs(
        fbm(x * 0.045, z * 0.045, { seed: SEED ^ 0xba9e, period: 6, octaves: 2 }) - 0.5,
      ) *
      2;
  const bank = marchBankHeight(u) * smoothstep01((away - marchChannelHalf(u)) / 8) * jag;
  const detail =
    (fbm(x * 0.023, z * 0.023, { seed: SEED ^ 0xd1a1, period: 8, octaves: 2 }) - 0.5) * 0.8;
  // Beyond the tongue's own width the authored march returns to dune
  // level: out there the weight is a whisker over zero, and the annex
  // floor reads this function — a bank authored where the domain barely
  // owns the point would put a phantom floor above the composed ground.
  const inside = 1 - smoothstep01((Math.abs(v) - tongueHalfWidth(u)) / 18);
  return (floor + bank + detail) * inside;
}

// ─── The disc's sub-biomes ──────────────────────────────────────────────────

export const WOUND = { u: 700, v: 0, radius: 58 } as const;
export const SHATTERFIELD = { u: 532, v: 0, ru: 66, rv: 92 } as const;
export const GHOST_FOREST = { u: 626, v: -4, ru: 78, rv: 96 } as const;
export const SEEP_GARDENS = { u: 752, v: 58, radius: 46 } as const;
export const LAST_GROVE = { u: 774, v: -86, radius: 42 } as const;
export const GROVE_RIDGE = { u: 742, v: -48, ru: 40, rv: 22 } as const;

/** Ghost-forest bench level, before ash drifts. */
export const FOREST_FLOOR = -8.2;

/** Deepest authored floor of the Wound, before its terraces. */
export const WOUND_FLOOR = -30;

function ellipseWeight(u: number, v: number, c: { u: number; v: number; ru: number; rv: number }): number {
  const d = Math.hypot((u - c.u) / c.ru, (v - c.v) / c.rv);
  return 1 - smoothstep01((d - 0.55) / 0.45);
}

/** How much of the Shatterfield owns a spoke point, in [0, 1]. */
export function shatterWeight(u: number, v: number): number {
  return ellipseWeight(u, v, SHATTERFIELD);
}

/** How much of the Ghost Forest's bench owns a spoke point, in [0, 1]. */
export function forestWeight(u: number, v: number): number {
  return ellipseWeight(u, v, GHOST_FOREST);
}

/** How much of the Wound owns a spoke point, in [0, 1]. */
export function woundWeight(u: number, v: number): number {
  const d = Math.hypot(u - WOUND.u, v - WOUND.v);
  return 1 - smoothstep01((d - 30) / 28);
}

/** How much of the Seep Gardens owns a spoke point, in [0, 1]. */
export function gardensWeight(u: number, v: number): number {
  const d = Math.hypot(u - SEEP_GARDENS.u, v - SEEP_GARDENS.v);
  return 1 - smoothstep01((d - 16) / 30);
}

/** How much of the Last Grove's hollow owns a spoke point, in [0, 1]. */
export function groveWeight(u: number, v: number): number {
  const d = Math.hypot(u - LAST_GROVE.u, v - LAST_GROVE.v);
  return 1 - smoothstep01((d - 14) / 34);
}

/** How much of the sheltering ridge owns a spoke point, in [0, 1]. */
export function ridgeWeight(u: number, v: number): number {
  return ellipseWeight(u, v, GROVE_RIDGE);
}

/** How much of the Quiet Rim shelf owns a spoke point, in [0, 1]. */
export function quietRimWeight(u: number): number {
  return smoothstep01((u - 820) / 70);
}

function discHeight(x: number, z: number, u: number, v: number): number {
  // The resting ground of the crater country: broad ash swells.
  let h =
    -5.4 + (fbm(x * 0.011, z * 0.011, { seed: SEED ^ 0x4e11, period: 5, octaves: 2 }) - 0.5) * 3.6;

  // The Shatterfield: the pavement that rose as one slab and fell as ten
  // thousand stones — ridged noise, sharp side up, so the benches read as
  // fractured planes and fault steps rather than dunes.
  const shatter = shatterWeight(u, v);
  if (shatter > 0) {
    const n = fbm(x * 0.021, z * 0.021, { seed: SEED ^ 0x5ca7, period: 7, octaves: 3 });
    const ridge = 1 - Math.abs(n - 0.5) * 2;
    const benches = -5.0 + ridge * 3.4;
    h += shatter * (benches - h);
  }

  // The Ghost Forest's bench: settled and smoothed under its ash drifts.
  const forest = forestWeight(u, v);
  if (forest > 0) {
    const drift =
      (fbm(x * 0.016, z * 0.016, { seed: SEED ^ 0xa54, period: 6, octaves: 2 }) - 0.5) * 2.6;
    h += forest * (FOREST_FLOOR + drift - h);
  }

  // The Seep Gardens' shelf, mounded where the small seeps have built
  // their mineral shoulders.
  const gardens = gardensWeight(u, v);
  if (gardens > 0) {
    const mounds =
      (fbm(x * 0.028, z * 0.028, { seed: SEED ^ 0x9e2d, period: 8, octaves: 2 }) - 0.5) * 1.8;
    h += gardens * (-11 + mounds - h);
  }

  // The Wound: terraced bowls. A smooth profile mixed with its own
  // staircase, so the crater reads as stepped slumped rings — the ground
  // remembering how it fell — not a poured funnel.
  const woundD = Math.hypot(u - WOUND.u, v - WOUND.v);
  const woundT = smoothstep01((WOUND.radius - woundD) / 44);
  if (woundT > 0) {
    const levels = 4;
    const stepped = Math.floor(woundT * (levels - 0.001)) / (levels - 1);
    const terraced = woundT * 0.5 + stepped * 0.5;
    // The bench at the crater's rim sits at ≈ −5.2; the bowl sinks from
    // there to −30 in four slumped steps.
    const bowl = WOUND_FLOOR + (1 - terraced) * 24.8;
    h += woundWeight(u, v) * (bowl - h);
  }
  // The thrown-out lip ringing the crater.
  h += 1.3 * smoothstep01((woundD - 52) / 6) * (1 - smoothstep01((woundD - 66) / 10));

  // The sheltering ridge: the ejecta dike that took the blast's edge off
  // the hollow behind it.
  h += ridgeWeight(u, v) * 6.5;

  // The Last Grove's hollow, sunk behind the ridge.
  const grove = groveWeight(u, v);
  if (grove > 0) {
    h += grove * (-13.4 - h);
  }

  // The Quiet Rim: the far shelf where the devastation thins.
  const shelf =
    -3.0 + (fbm(x * 0.013, z * 0.013, { seed: SEED ^ 0xfa11, period: 5, octaves: 2 }) - 0.5) * 1.6;
  h += quietRimWeight(u) * (shelf - h);

  // Ground life at the scale the sheets can carry.
  h += (fbm(x * 0.026, z * 0.026, { seed: SEED ^ 0x9d01, period: 9, octaves: 2 }) - 0.5) * 0.9;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. Pure and always live —
 * it runs inside `seabedHeight` for every sample anyone takes anywhere in
 * the province. The march and the disc cross-fade over u 470–530, and the
 * whole answer eases back to dune level across the disc's weight feather so
 * the composed ground and this target agree wherever the diver can be.
 */
export function calamityTerrainTarget(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

  let h: number;
  if (u < GATE_U) {
    h = marchHeight(x, z, u, v);
  } else if (u < 530) {
    const s = smoothstep01((u - GATE_U) / (530 - GATE_U));
    const march = marchHeight(x, z, u, v);
    h = march + s * (discHeight(x, z, u, v) - march);
  } else {
    h = discHeight(x, z, u, v);
  }

  // The rim fade: authored ground returns to dune level before the weight
  // feather ends, so the annex floor stays honest at the edge of the world.
  // Gated on `u` as well as `rc`: the march runs its whole length farther
  // than 172 m from the disc's centre and must not fade — the gate eases
  // in over the same band the march/disc cross-fade already spans.
  const fade = 1 - smoothstep01((rc - 172) / 38) * smoothstep01((u - GATE_U) / 60);
  return h * fade;
}

// ─── The ceiling ────────────────────────────────────────────────────────────

/**
 * Swim ceiling: 11 m over the march's mouth (meeting the terrace's vault),
 * squeezing to 8.5 through the Suffocated Mile and 7 over the Wound Gate
 * so the light pinches before the reveal — then the sky of the crater
 * country opens to 26, rising to 28 over the Wound itself so the Cold
 * Candle's plume and gyre are a swim and not a bump — and closing to 3.4
 * at the disc's rim so one ring of collider spheres seals the world's edge
 * floor to ceiling.
 */
export function calamityCeiling(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 11 - 2.5 * smoothstep01((u - 70) / 120);
  // The pinch over the Gate.
  const pinch = smoothstep01((u - 408) / 30) * (1 - smoothstep01((u - 482) / 30));
  c += (7.6 - c) * pinch;
  // The crater country's open water.
  c += (26 - c) * smoothstep01((u - 500) / 90);
  c += 2 * smoothstep01((u - 640) / 60);
  // The Quiet Rim settles a little.
  c += (18 - c) * quietRimWeight(u) * 0.5;
  // The rim closure is gated on `u` the same way the terrain fade is: the
  // Shatterfield's own benches stand farther than 186 m from the disc's
  // centre on the near side, and a ceiling slammed shut over them is a
  // floor above the reveal.
  c += (3.4 - c) * smoothstep01((rc - 186) / 26) * smoothstep01((u - 500) / 40);
  // The Wound's own column stays open: never close above the crater.
  const wound = woundWeight(u, v);
  if (wound > 0) {
    c += (28 - c) * wound;
  }
  return c;
}
