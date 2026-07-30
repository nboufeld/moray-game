import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";

/**
 * THE HOURGLASS SEA — the pure half. Every function here is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object. The built half reads
 * these same functions, which keeps every monolith, palm and capture
 * pose standing on the ground the collision field believes in.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 6.39 ≈ 0.107 — almost due
 * +x) in metres from the world origin; `v` is lateral, positive
 * counterclockwise. The disc's heart is at u = 445, v = 0.
 *
 * - **The Dune Saddle** (u 48 → 285): a honey-warm dune corridor out of
 *   the Sandfall Dunes' opened end wall. The floor leaves the wing at its
 *   own −5.0, deepens to −6.8, climbs to a +1.8 saddle lip at u ≈ 268 —
 *   the reveal — and spills into the dune ocean. Its walls are soft dune
 *   shoulders, not cliffs, and the first crescent dunelings ripple its
 *   floor.
 * - **The Dune Ocean** (the disc's resting ground): ranks of migrating
 *   crescent dunes marching down-spoke — long windward rises, steep
 *   slip-faces — broken into barchans by a crescent field, amplitude up
 *   to ~5 m over a −3.2 base.
 * - **The Hourglass** (u 455, v +30, r 46): the region's heart — a great
 *   circular chasm the whole desert drains into. A raised sand-lip ring,
 *   then terraced ledges benched every 3 m falling to a −27.5 violet
 *   floor. Sandfalls pour over the lip all the way round.
 * - **The Glass Reach** (u 395, v −78, r 62): a trench field where old
 *   heat fused the sand — smooth glass-pale grooves and standing fins.
 * - **The Oasis Hollows** (u 517, v −64): pocket gardens in dune shadow —
 *   two sheltered bowls where the region's densest life gathers.
 * - **The Singing Flats** (u 528, v +84, r 74): wide ripple-plains where
 *   lone monoliths cast long violet shadows and the emptiness is
 *   composed.
 * - **The Gilded Shore** (u > 560): a −2.2 shelf before the rim, where
 *   the stacked gold-to-violet painted distance takes over.
 *
 * Everything dramatic lives inside the weight-1 core (rc ≤ 170 of the
 * disc's centre), so the composed ground *is* this function wherever the
 * diver can stand — which is what makes the bounds annex's
 * `terrainTarget + clearance` floor honest.
 */

export const GOLDEN_SLOT = regionSlot("golden-waste-1");
const CENTER = slotCenter(GOLDEN_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(GOLDEN_SLOT.azimuth);
const AXIS_Z = Math.sin(GOLDEN_SLOT.azimuth);

const SEED = SEEDS.regionGolden1;

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
 * The seam tongue holds the doorway: the one close neighbour wing
 * (sargassum-sky at 6.03) sits 0.36 rad off this spoke with a 0.165 rad
 * end wedge, so its nearest edge is 0.195 rad away — at r = 44 an 8.2 m
 * half-width (atan 0.184) clears it with real margin. The next wing
 * upward (kelp-cathedral at 1.35 ≡ 7.63) is 1.24 rad away.
 *
 * The saddle tongue begins at r = 62 — past every wing's carve end — and
 * carries the width the dune corridor's shoulders actually need.
 */
export const GOLDEN_TONGUE: Tongue = approachTongue(GOLDEN_SLOT, {
  halfWidthFrom: 8.2,
  halfWidthTo: 34,
});

export const GOLDEN_TONGUE_WIDE: Tongue = approachTongue(GOLDEN_SLOT, {
  fromR: 62,
  halfWidthFrom: 20,
  halfWidthTo: 40,
});

const DISC = slotDisc(GOLDEN_SLOT);

/** Ownership in [0, 1]; exactly 0 outside the disc and the tongues. */
export function goldenWeight(x: number, z: number): number {
  return Math.max(
    discWeight(DISC, x, z),
    tongueWeight(GOLDEN_TONGUE, x, z),
    tongueWeight(GOLDEN_TONGUE_WIDE, x, z),
  );
}

function tongueWidthAt(tongue: Tongue, u: number): number {
  const along = Math.min(1, Math.max(0, (u - tongue.fromR) / (tongue.toR - tongue.fromR)));
  return tongue.halfWidthFrom + (tongue.halfWidthTo - tongue.halfWidthFrom) * along;
}

/** The combined half-width at a spoke distance, for builders and seals. */
export function tongueHalfWidth(u: number): number {
  const seam = tongueWidthAt(GOLDEN_TONGUE, u);
  if (u < GOLDEN_TONGUE_WIDE.fromR - 4) {
    return seam;
  }
  return Math.max(seam, tongueWidthAt(GOLDEN_TONGUE_WIDE, u));
}

// ─── The Dune Saddle ────────────────────────────────────────────────────────

export const SADDLE_FROM = 44;
export const SADDLE_TO = 292;
/** Where the saddle lip crests — the reveal pose stands just short of it. */
export const SADDLE_LIP_U = 268;

/**
 * The channel's lateral wander: lazier than the pilots' — dunes drift.
 * The wander returns to the spine before the lip, so the reveal, the
 * rim gate and the corridor's seals all agree where the doorway is.
 */
export function saddleChannelCenter(u: number): number {
  const grow =
    Math.min(1, (u - SADDLE_FROM) / 190) * (1 - smoothstep01((u - 225) / 45));
  return grow * (8 * Math.sin(u * 0.037 + 1.6) + 4 * Math.sin(u * 0.016 + 0.7));
}

/** Channel half-width: opens with distance, pinched just before the lip. */
export function saddleChannelHalf(u: number): number {
  const pinch = 3.4 * smoothstep01((u - 234) / 16) * (1 - smoothstep01((u - 258) / 16));
  return Math.max(3.0, 4.6 + (u - SADDLE_FROM) * 0.03 - pinch);
}

/** The channel floor along the spine — the saddle's whole story in one curve. */
export function saddleFloor(u: number): number {
  let f = -5.0;
  f += -1.8 * smoothstep01((u - 78) / 70); // deepening where the water warms
  f += 1.9 * smoothstep01((u - 150) / 55); // easing back up
  f += 6.7 * smoothstep01((u - 202) / 60); // the climb to the lip
  f += -4.6 * smoothstep01((u - SADDLE_LIP_U) / 26); // and over, into the dunes
  return f;
}

/**
 * Wall height above the channel floor: 3.5 m at the mouth, 8 past the
 * middle — capped so the wall's shoulder always stays a swimmable margin
 * under the saddle's ceiling (the annex floor reads this function, and a
 * shoulder above the ceiling is a phantom floor).
 */
function saddleWallHeight(u: number): number {
  const drawn = 3.5 + 4.5 * smoothstep01((u - 60) / 150);
  return Math.max(0, Math.min(drawn, 5.6 - saddleFloor(u)));
}

function saddleHeight(x: number, z: number, u: number, v: number): number {
  const floor = saddleFloor(u);
  const away = Math.abs(v - saddleChannelCenter(u));
  // Soft dune shoulders: the wall's rise spans 11 m, not the pilots' 8 —
  // this is sand, and sand rests at its angle.
  const wall = saddleWallHeight(u) * smoothstep01((away - saddleChannelHalf(u)) / 11);
  // Crescent dunelings ripple the corridor floor: the first sign of the
  // dune ocean, small enough for the sheets to carry.
  const duneling =
    Math.max(0, Math.sin(u * 0.21 + Math.sin(v * 0.18) * 1.3)) *
    0.9 *
    smoothstep01((u - 110) / 60);
  const detail =
    (fbm(x * 0.02, z * 0.02, { seed: SEED ^ 0xd0e1, period: 8, octaves: 2 }) - 0.5) * 0.6;
  // Beyond the tongue's own width the authored saddle returns to dune
  // level: out there the weight is a whisker over zero, and the annex
  // floor reads this function.
  const inside = 1 - smoothstep01((Math.abs(v) - tongueHalfWidth(u)) / 18);
  return (floor + wall + duneling + detail) * inside;
}

// ─── The disc's sub-biomes ──────────────────────────────────────────────────

export const HOURGLASS = { u: 455, v: 30, radius: 46 } as const;
export const GLASS = { u: 395, v: -78, radius: 62 } as const;
export const OASIS_A = { u: 517, v: -64, radius: 27 } as const;
export const OASIS_B = { u: 543, v: -36, radius: 18 } as const;
export const FLATS = { u: 528, v: 84, radius: 74 } as const;

/** The dune ocean's resting level, before the ranks. */
export const DUNE_FLOOR = -3.2;
/** The Hourglass's authored floor — the region's deepest breath. */
export const HOURGLASS_FLOOR = -27.5;
/**
 * The terrace step the chasm's ledges are benched to. Round 1 ran 3.0
 * and the ~3.5 m treads dissolved on the 2.2 m ground grid; 4.2 keeps
 * six ledges and lets each one survive sampling.
 */
export const TERRACE_STEP = 4.2;
/** Dune rank wavelength along the spoke. */
export const RANK_WAVELENGTH = 46;

/** How much of the Hourglass bowl owns a spoke point, in [0, 1]. */
export function hourglassWeight(u: number, v: number): number {
  const d = Math.hypot(u - HOURGLASS.u, v - HOURGLASS.v);
  return 1 - smoothstep01((d - 38) / 10);
}

/** How much of the Glass Reach owns a spoke point, in [0, 1]. */
export function glassWeight(u: number, v: number): number {
  const d = Math.hypot(u - GLASS.u, v - GLASS.v);
  return 1 - smoothstep01((d / GLASS.radius - 0.3) / 0.7);
}

/** How much of the Oasis Hollows own a spoke point, in [0, 1]. */
export function oasisWeight(u: number, v: number): number {
  const a = Math.hypot(u - OASIS_A.u, v - OASIS_A.v);
  const b = Math.hypot(u - OASIS_B.u, v - OASIS_B.v);
  return Math.max(
    1 - smoothstep01((a - OASIS_A.radius * 0.45) / (OASIS_A.radius * 0.55)),
    1 - smoothstep01((b - OASIS_B.radius * 0.45) / (OASIS_B.radius * 0.55)),
  );
}

/** How much of the Singing Flats own a spoke point, in [0, 1]. */
export function flatsWeight(u: number, v: number): number {
  const d = Math.hypot(u - FLATS.u, v - FLATS.v);
  return 1 - smoothstep01((d / FLATS.radius - 0.3) / 0.7);
}

/** How much of the Gilded Shore shelf owns a spoke point, in [0, 1]. */
export function shoreWeight(u: number): number {
  return smoothstep01((u - 560) / 65);
}

/**
 * Smooth bench quantisation: flat treads with short risers — the
 * Hourglass's terraced ledges are drawn from it.
 */
function bench(height: number, step: number, riser: number): number {
  const t = height / step;
  const whole = Math.floor(t);
  const frac = t - whole;
  return (whole + smoothstep01((frac - (1 - riser)) / riser)) * step;
}

/**
 * The dune ranks: crescent dunes marching down-spoke. The phase wanders
 * with `v` so the ranks bow like real barchan trains; the crescent field
 * breaks each rank into dunes and gaps. Returns the rank's rise above
 * the resting floor, plus how far into the slip-face the point sits
 * (0 windward, 1 at the slip-face's foot) for the painter.
 */
export function duneRank(u: number, v: number): { rise: number; slip: number } {
  const bow = 16 * Math.sin(v * 0.017 + 0.9) + 7 * Math.sin(v * 0.041 + 2.2);
  const phase = (u + bow) / RANK_WAVELENGTH;
  const s = phase - Math.floor(phase);
  // Long windward rise to a crest at 0.72; the slip-face falls in 0.2 —
  // steepened in round 2, where the ranks read as gentle swells.
  const rise = smoothstep01(s / 0.72);
  const fall = 1 - smoothstep01((s - 0.72) / 0.2);
  const crescent =
    0.3 +
    0.7 *
      smoothstep01(
        (fbm(u * 0.006, v * 0.013, { seed: SEED ^ 0xdca1, period: 5, octaves: 2 }) - 0.36) / 0.3,
      );
  // The slip term reaches 1 quickly past the crest (round 2's gentler
  // ramp painted the lee a timid mauve), and only half-follows the
  // crescent gaps so even low saddles keep their shadow.
  const slip = smoothstep01((s - 0.68) / 0.24) * (0.5 + 0.5 * crescent);
  return { rise: rise * fall * crescent, slip };
}

/**
 * The Hourglass's own profile at a chasm-distance `d`: the raised
 * sand-lip ring, and inside it the terraced descent to the violet floor.
 * Exported so the builders can seat falls and ledges exactly on it.
 */
export function hourglassProfile(d: number): number {
  const lip =
    2.2 * smoothstep01((d - 44) / 8) * (1 - smoothstep01((d - 60) / 14));
  if (d >= 46) {
    return lip;
  }
  const raw = HOURGLASS_FLOOR * smoothstep01((46 - d) / 32);
  return bench(raw, TERRACE_STEP, 0.2) + lip;
}

/**
 * The grand crescents: an amplitude boost over the sector the saddle
 * reveal actually sees (u 290–375, |v| ≤ ~45). Round 3's reveal opened
 * onto a flat horizon — 7 m ranks sit below a +4 m eye at the lip, so
 * the first ranks out of the gate are grown into real silhouettes.
 */
export function grandCrescent(u: number, v: number): number {
  return (
    smoothstep01((u - 288) / 16) *
    (1 - smoothstep01((u - 356) / 28)) *
    (1 - smoothstep01((Math.abs(v) - 34) / 24))
  );
}

function discHeight(x: number, z: number, u: number, v: number): number {
  // The dune ocean: the disc's resting ground under its crescent ranks.
  const swell =
    (fbm(x * 0.009, z * 0.009, { seed: SEED ^ 0x901d, period: 4, octaves: 2 }) - 0.5) * 2.6;
  let h = DUNE_FLOOR + swell;

  // The ranks stand where nothing quieter owns the floor.
  const hg = hourglassWeight(u, v);
  const glass = glassWeight(u, v);
  const oasis = oasisWeight(u, v);
  const flats = flatsWeight(u, v);
  const shore = shoreWeight(u);
  const calm = Math.max(hg, glass * 0.9, oasis, flats * 0.85, shore);
  const rank = duneRank(u, v);
  h += rank.rise * (7.0 + grandCrescent(u, v) * 3.2) * (1 - calm);

  // The Glass Reach: fused trench grooves, smooth and pale.
  if (glass > 0) {
    const groove = Math.sin((u * 0.42 + v * 0.91) * 0.34 + 1.1);
    const trench =
      -7.2 +
      groove * 1.9 +
      (fbm(x * 0.02, z * 0.02, { seed: SEED ^ 0x91a5, period: 6, octaves: 2 }) - 0.5) * 0.8;
    h += glass * (trench - h);
  }

  // The Singing Flats: wide ripple-plains, quiet on purpose. The ripples
  // are ≥ 9 m so the 2.2 m sheet grid samples them cleanly.
  if (flats > 0) {
    const ripple =
      0.32 * Math.sin(u * 0.62 + Math.sin(v * 0.11) * 2.0) +
      (fbm(x * 0.016, z * 0.016, { seed: SEED ^ 0xf1a7, period: 6, octaves: 2 }) - 0.5) * 0.5;
    h += flats * (-3.6 + ripple - h);
  }

  // The Oasis Hollows: sheltered bowls with soft raised rims.
  if (oasis > 0) {
    const a = Math.hypot(u - OASIS_A.u, v - OASIS_A.v);
    const b = Math.hypot(u - OASIS_B.u, v - OASIS_B.v);
    const bowlA = (1 - smoothstep01((a - 8) / 16)) * -4.6;
    const bowlB = (1 - smoothstep01((b - 5) / 12)) * -3.2;
    const rim =
      0.9 * smoothstep01((a - 20) / 6) * (1 - smoothstep01((a - 30) / 8)) +
      0.7 * smoothstep01((b - 14) / 5) * (1 - smoothstep01((b - 21) / 7));
    h += oasis * (-3.4 + bowlA + bowlB + rim - h);
  }

  // The Gilded Shore: the far shelf before the rim.
  if (shore > 0) {
    const shelf =
      -2.2 +
      (fbm(x * 0.013, z * 0.013, { seed: SEED ^ 0x5407, period: 5, octaves: 2 }) - 0.5) * 1.2;
    h += shore * (shelf - h);
  }

  // The Hourglass, last so the chasm wins its own heart: terraced
  // descent inside, the raised sand-lip ring outside.
  const d = Math.hypot(u - HOURGLASS.u, v - HOURGLASS.v);
  if (d < 74) {
    const bowl =
      hourglassProfile(d) +
      (fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x40a1, period: 9, octaves: 2 }) - 0.5) *
        0.35 *
        smoothstep01((46 - d) / 8);
    if (d < 46) {
      h += hg * (DUNE_FLOOR * (1 - smoothstep01((46 - d) / 10)) + bowl - h);
    } else {
      h += bowl; // just the lip ring, added over whatever rests there
    }
  }

  // Ground life at the scale the sheets can carry.
  h += (fbm(x * 0.026, z * 0.026, { seed: SEED ^ 0x9e0b, period: 9, octaves: 2 }) - 0.5) * 0.6;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. Pure and always live —
 * it runs inside `seabedHeight` for every sample anyone takes anywhere in
 * the province. The saddle and the disc cross-fade over u 250–292, and
 * the whole answer eases back to dune level across the disc's weight
 * feather so the composed ground and this target agree wherever the
 * diver can be.
 */
export function goldenTerrainTarget(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

  let h: number;
  if (u < 250) {
    h = saddleHeight(x, z, u, v);
  } else if (u < SADDLE_TO) {
    const s = smoothstep01((u - 250) / (SADDLE_TO - 250));
    const saddle = saddleHeight(x, z, u, v);
    h = saddle + s * (discHeight(x, z, u, v) - saddle);
  } else {
    h = discHeight(x, z, u, v);
  }

  // The rim fade: authored ground returns to dune level before the weight
  // feather ends, so the annex floor stays honest at the edge of the
  // world. Gated on `u` as well as `rc`, because the saddle runs its
  // whole length farther than 172 m from the disc's centre and must not
  // fade.
  const fade = 1 - smoothstep01((rc - 172) / 38) * smoothstep01((u - 250) / 42);
  return h * fade;
}

// ─── The ceiling ────────────────────────────────────────────────────────────

/**
 * Swim ceiling: 10 m over the saddle mouth (meeting the Sandfall Dunes'
 * vault), easing to 8.5 through the pinch and over the lip, opening to
 * 30 over the disc — composing down into the Hourglass and up out of it
 * are two different awes, and both want head-room — and closing to 3.4
 * at the disc's rim so one ring of collider spheres seals the world's
 * edge floor to ceiling.
 */
export function goldenCeiling(x: number, z: number): number {
  const { u } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 10 - 1.5 * smoothstep01((u - 70) / 70) + 21.5 * smoothstep01((u - 272) / 50);
  c += (3.4 - c) * smoothstep01((rc - 186) / 26) * smoothstep01((u - 250) / 42);
  return c;
}
