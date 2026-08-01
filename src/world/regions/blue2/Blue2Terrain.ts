import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";
import { blue1TerrainTarget, blue1Weight } from "../blue1/Blue1Terrain";
import { B2_SEEDS, smoothstep01 } from "./Blue2Shared";

/**
 * THE DEEP STEPS — the pure half. Every function here is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 5.31) in metres from the
 * world origin; `v` is lateral, positive counterclockwise. The disc's
 * heart is at u = 940, v = 0; the disc spans u 720 → 1160.
 *
 * This is the Great Blue's depth-2 region: no gateway wing. The inbound
 * connection crosses THE WORLD'S EDGE — the Drop Plains' far pole is
 * its great drop into the Under-Blue (deep floor −46.5), and past the
 * void its pure terrain climbs a 45 m violet rampart back to dune level
 * (its disc ends at u ≈ 665; the wall stands u ≈ 620–655). The pass
 * tongue starts at u = 635, thirty metres INSIDE the Drop Plains' rim,
 * so the two domains genuinely overlap. Three authored bands (the
 * Emerald Terraces' device, fourth use — bent around a void):
 *
 * - **The Far Wall** (u 635 → 668): the Under-Blue's far rampart. Our
 *   weight is a whisper for BOUNDS only, and — unlike every earlier
 *   depth-2 threshold, whose parent rim was already dune level — our
 *   terrain target must MIRROR the Drop Plains' own composed wall, or
 *   the bounds annex would claim a floor forty metres above the ground
 *   the diver is climbing (`resolveInAnnex` clamps to whichever
 *   containing annex is checked first, and attach order is history-
 *   dependent). The mirror reads blue-1's PURE half read-only:
 *   `blue1Weight · blue1TerrainTarget` — base dunes out here are ±0.6,
 *   so the product IS the composed ground to within centimetres. The
 *   framework's depth-boundary reject circle (`RegionField` consults us
 *   only within radius + 40 = 260 m of our centre, u ≥ ~680) means the
 *   mirror never feeds back into `seabedHeight`: blue-1's weight is 0
 *   past u 665, so wherever we ARE consulted the mirror term is 0.
 *   Nothing is dressed on the wall — the Under-Blue's law ("nothing
 *   clutters below the lip") is honoured by building nothing there.
 * - **The Othershore** (u 668 → 752): a bare milky saddle at dune
 *   level — the far lip of the World's Edge, sun again after the
 *   violet. Held at base level so the step at the reject circle is
 *   centimetres (asserted). Its heart is a registered rest.
 * - **The country** (the disc): THE DEEP STEPS — a nested amphitheatre
 *   of great violet shelves centred on the World's Edge itself (the
 *   hinge at spoke (610, 0)), each shelf a value deeper: the Stairfall
 *   (five 4.2 m risers off the Brink), the Strand at −21 with the
 *   Kings' Wrack, the Current's Step at −34 where the Old Current
 *   crosses under the Weir and past the Mooring, and the Round of the
 *   Gentle Dark at −47 under the Moon Well. The rim climbs back to
 *   dune level all around (the identity contract) and is authored as
 *   what it is: the Worldwall, the amphitheatre's far rampart, with
 *   the Horns framing the reserved depth-3 azimuth on its crest.
 *
 * Vertical terrain range ≈ 47 m (saddle crest ≈ +0.5 → Round ≈ −47);
 * the Mooring's posts carry built verticality to ≈ +4.
 */

export const BLUE2_SLOT = regionSlot("great-blue-2");
const CENTER = slotCenter(BLUE2_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(BLUE2_SLOT.azimuth);
const AXIS_Z = Math.sin(BLUE2_SLOT.azimuth);

const SEED = SEEDS.regionBlue2;

/** Spoke coordinates: `u` along the province axis, `v` lateral. */
export function spokeOf(x: number, z: number): { u: number; v: number } {
  return { u: x * AXIS_X + z * AXIS_Z, v: -x * AXIS_Z + z * AXIS_X };
}

/** World position from spoke coordinates — the builders' one placement door. */
export function worldOf(u: number, v: number): { x: number; z: number } {
  return { x: u * AXIS_X - v * AXIS_Z, z: u * AXIS_Z + v * AXIS_X };
}

// ─── The domain ─────────────────────────────────────────────────────────────

/**
 * The pass tongue. `fromR: 635` reaches thirty metres inside the Drop
 * Plains' rim (665) so the bounds handover is an overlap, never a gap;
 * `toR: 800` runs it well past the Brink so the max-combine with the
 * disc weight has no waist at the rim crossing.
 */
export const PASS_TONGUE: Tongue = approachTongue(BLUE2_SLOT, {
  fromR: 635,
  toR: 800,
  halfWidthFrom: 16,
  halfWidthTo: 56,
});

const DISC = slotDisc(BLUE2_SLOT);

/**
 * The threshold gate: our ownership over the World's Edge crossing is a
 * whisper (0.14) so the Drop Plains keeps carrying water, mood and
 * terrain across the overlap; we own only the bounds. Full ownership
 * arrives past the Brink, where the country is ours alone.
 */
function thresholdGate(u: number): number {
  return 0.14 + 0.86 * smoothstep01((u - 726) / 30);
}

/** Ownership in [0, 1]; exactly 0 outside the disc and the pass tongue. */
export function blue2Weight(x: number, z: number): number {
  const disc = discWeight(DISC, x, z);
  const pass = tongueWeight(PASS_TONGUE, x, z);
  if (pass === 0) {
    return disc;
  }
  const { u } = spokeOf(x, z);
  return Math.max(disc, pass * thresholdGate(u));
}

/**
 * The tongue's raw geometric membership, for the FILL gates (the
 * Carillon Waste's round-3 law: the 0.14 whisper is a terrain-and-mood
 * treaty, not a bareness licence — the road's fill is ours the moment
 * the bounds are). Identical support to the weight, so containment is
 * unchanged.
 */
export function passFillOwn(x: number, z: number): number {
  return tongueWeight(PASS_TONGUE, x, z);
}

/** The pass tongue's half-width at a spoke distance, for builders and seals. */
export function passHalfWidth(u: number): number {
  const along = Math.min(
    1,
    Math.max(0, (u - PASS_TONGUE.fromR) / (PASS_TONGUE.toR - PASS_TONGUE.fromR)),
  );
  return PASS_TONGUE.halfWidthFrom + (PASS_TONGUE.halfWidthTo - PASS_TONGUE.halfWidthFrom) * along;
}

/**
 * How much a point belongs to the inbound pass corridor, in [0, 1] —
 * the smooth gate that keeps the rim fade, the rim seal ring and the
 * rim ceiling-closure off the crossing.
 */
export function passGate(u: number, v: number): number {
  const along = 1 - smoothstep01((u - 768) / 26);
  const across = 1 - smoothstep01((Math.abs(v) - (passHalfWidth(Math.min(u, 760)) + 2)) / 14);
  return along * across;
}

// ─── The Far Wall mirror ────────────────────────────────────────────────────

/**
 * The Drop Plains' composed ground under our tongue, read from its pure
 * half (base dunes are ±0.6 out here, so weight × target is the
 * composed height to within the dunes' own noise). Zero past u ≈ 665
 * by blue-1's own weight; the band gate keeps the import from ever
 * reaching our own country.
 */
function wallMirror(x: number, z: number, u: number): number {
  if (u >= 672) {
    return 0;
  }
  const w = blue1Weight(x, z);
  if (w === 0) {
    return 0;
  }
  return w * blue1TerrainTarget(x, z);
}

// ─── The pass bands ─────────────────────────────────────────────────────────

/** Where the Brink's first riser stands (spoke distance from the hinge). */
export const BRINK_D = 150;

/** The saddle's gentle profile: dune level, dipping toward the Brink. */
function saddleHeight(x: number, z: number, u: number, v: number): number {
  const ramp = smoothstep01((u - 652) / 16);
  const draw = 0.3 - 1.1 * smoothstep01((u - 700) / 48);
  const detail =
    (fbm(x * 0.021, z * 0.021, { seed: SEED ^ B2_SEEDS.terrainSaddle, period: 8, octaves: 2 }) -
      0.5) *
    0.5;
  const inside = 1 - smoothstep01((Math.abs(v) - passHalfWidth(u)) / 16);
  return ramp * (draw + detail) * inside;
}

// ─── The steps ──────────────────────────────────────────────────────────────

/**
 * The amphitheatre's hinge: the steps are arcs centred on the World's
 * Edge itself, so every shelf bows around the void the diver crossed.
 */
export const HINGE_U = 610;

/** Spoke distance from the hinge — the steps' one coordinate. */
export function stepD(u: number, v: number): number {
  return Math.hypot(u - HINGE_U, v);
}

/** The three shelf floors. */
export const STRAND_FLOOR = -21;
export const CURRENT_FLOOR = -34;
export const ROUND_FLOOR = -47;

/** The Stairfall: five great risers off the Brink. */
const STAIR_D0 = BRINK_D;
const STAIR_PITCH = 8;
const STAIR_DROP = 4.2;
const STAIR_RUN = 3.2;
const STAIR_COUNT = 5;

/** The second and third shelf edges (hinge distance) and their falls. */
export const RISER2_D = 255;
export const RISER3_D = 345;
const RISER_DROP = 13;

/** The Chute: the road's notch down the third riser — the one place
 *  the 13 m cliff relaxes into a swimmable ramp. */
export const CHUTE = { u: 955, v: -34 } as const;

/**
 * The stepped drop at a hinge distance, plus how much of the point sits
 * on a riser face (0 tread, 1 mid-riser) so builders and paint find the
 * step faces without re-deriving the geometry.
 */
export function stepsDrop(u: number, v: number): { level: number; riser: number } {
  const d = stepD(u, v);
  let level = 0;
  let riser = 0;
  for (let i = 0; i < STAIR_COUNT; i++) {
    const t = (d - (STAIR_D0 + i * STAIR_PITCH)) / STAIR_RUN;
    level -= STAIR_DROP * smoothstep01(t);
    if (t > 0 && t < 1) {
      riser = Math.max(riser, 4 * t * (1 - t));
    }
  }
  const t2 = (d - RISER2_D) / 11;
  level -= RISER_DROP * smoothstep01(t2);
  if (t2 > 0 && t2 < 1) {
    riser = Math.max(riser, 4 * t2 * (1 - t2));
  }
  // The third riser carries the Chute: near the notch its run stretches
  // from a cliff into a ramp.
  const chute = 1 - smoothstep01((Math.hypot(u - CHUTE.u, v - CHUTE.v) - 9) / 12);
  const run3 = 12 + 30 * chute;
  const t3 = (d - RISER3_D) / run3;
  level -= RISER_DROP * smoothstep01(t3);
  if (t3 > 0 && t3 < 1) {
    riser = Math.max(riser, 4 * t3 * (1 - t3) * (1 - chute));
  }
  return { level, riser };
}

// ─── The Old Current ────────────────────────────────────────────────────────

/**
 * The Old Current's bed: the river of clear water that crosses the
 * Current's Step, born out of the rim mist high on the west flank,
 * threading the Weir at the Ford, and pouring over the third riser at
 * THE SPILL into the Round's edge. Spoke-coordinate polyline.
 */
export const CURRENT_SPINE: readonly (readonly [number, number])[] = [
  [846, 170],
  [866, 118],
  [882, 70],
  [893, 26],
  [899, -16],
  [909, -62],
  [925, -104],
  [946, -136],
  [960, -158],
] as const;

/** Where the road crosses the Current, under the Weir. */
export const FORD = { u: 899, v: -16 } as const;
/** Where the Current pours over the third riser. */
export const SPILL = { u: 946, v: -136 } as const;

/** Distance from the Current's spine, and how far along it (0–1). */
export function currentDistance(u: number, v: number): { d: number; t: number } {
  let best = Number.POSITIVE_INFINITY;
  let bestT = 0;
  for (let i = 0; i < CURRENT_SPINE.length - 1; i++) {
    const [au, av] = CURRENT_SPINE[i]!;
    const [bu, bv] = CURRENT_SPINE[i + 1]!;
    const du = bu - au;
    const dv = bv - av;
    const len2 = du * du + dv * dv;
    const t = Math.max(0, Math.min(1, ((u - au) * du + (v - av) * dv) / len2));
    const d = Math.hypot(u - (au + du * t), v - (av + dv * t));
    if (d < best) {
      best = d;
      bestT = (i + t) / (CURRENT_SPINE.length - 1);
    }
  }
  return { d: best, t: bestT };
}

/** The Current's carve: a shallow dish with soft levees; the Ford pave
 *  shallows it where the road crosses. */
export function currentCarve(u: number, v: number): { dish: number; levee: number; bed: number } {
  const { d } = currentDistance(u, v);
  if (d > 16) {
    return { dish: 0, levee: 0, bed: 0 };
  }
  const bed = 1 - smoothstep01((d - 5.5) / 4);
  const ford = 1 - smoothstep01((Math.hypot(u - FORD.u, v - FORD.v) - 5) / 4);
  const dish = -1.5 * bed * (1 - ford * 0.65);
  const levee = 0.45 * smoothstep01((d - 6) / 2) * (1 - smoothstep01((d - 12) / 4));
  return { dish, levee, bed };
}

// ─── The Round, the Well, the landmarks the pure half must know ─────────────

/** THE MOON WELL: the region's named light peak, at the Round's heart. */
export const MOON_WELL = { u: 1032, v: -8, radius: 9 } as const;

/** THE MOORING: three colossal posts on the Current's Step. */
export const MOORING_POSTS: readonly { u: number; v: number; height: number; radius: number }[] = [
  { u: 876, v: -40, height: 38, radius: 3.0 },
  { u: 906, v: 34, height: 34, radius: 2.7 },
  { u: 942, v: -4, height: 30, radius: 2.4 },
] as const;

/** THE WEIR: the arch the road and the river share, at the Ford. */
export const WEIR = { u: 899, v: -16, span: 11 } as const;

/** THE HORNS: paired crest spires framing the reserved depth-3 azimuth. */
export const HORNS: readonly { u: number; v: number }[] = [
  { u: 1128, v: 15 },
  { u: 1124, v: -12 },
] as const;

function discHeight(x: number, z: number, u: number, v: number): number {
  // The steps carry the disc: the saddle level falling shelf by shelf.
  const steps = stepsDrop(u, v);
  let h = steps.level;

  // Long silt swells on the treads (never on the risers), at a
  // wavelength the 2.2 m ground grid samples cleanly.
  const swell =
    (fbm(x * 0.012, z * 0.012, { seed: SEED ^ B2_SEEDS.terrainStep, period: 5, octaves: 2 }) -
      0.5) *
    1.7 *
    (1 - steps.riser);
  h += swell;

  // The Round's floor calms: the deepest country is the smoothest.
  const roundK = smoothstep01((stepD(u, v) - RISER3_D - 8) / 20);
  h += roundK * (ROUND_FLOOR - h) * 0.55;

  // The Old Current's bed and levees.
  const current = currentCarve(u, v);
  h += current.dish + current.levee;

  // Ground life at the scale the sheets can carry.
  h +=
    (fbm(x * 0.026, z * 0.026, { seed: SEED ^ B2_SEEDS.terrainRound, period: 9, octaves: 2 }) -
      0.5) *
    0.5;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. The wall mirror and
 * the saddle run the pass; the disc's steps take over across the Brink;
 * and the whole answer eases back to dune level across the disc's far
 * feather (gated off the inbound corridor) so the composed ground and
 * this target agree wherever the diver can be. The far feather IS the
 * Worldwall: the amphitheatre's rampart, painted as one.
 */
export function blue2TerrainTarget(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

  let h: number;
  if (u < 736) {
    h = wallMirror(x, z, u) + saddleHeight(x, z, u, v);
  } else if (u < 776) {
    const s = smoothstep01((u - 736) / 40);
    const pass = saddleHeight(x, z, u, v);
    h = pass + s * (discHeight(x, z, u, v) - pass);
  } else {
    h = discHeight(x, z, u, v);
  }

  // Round 2: the crest line undulates (a slow angular wobble on the
  // fade radius) so the Worldwall's silhouette reads as geography, not
  // as one flat fogged band.
  const theta = Math.atan2(z - CENTER_Z, x - CENTER_X);
  const crest = 172 + 5 * Math.sin(theta * 3 + 1.3) + 3 * Math.sin(theta * 7 + 0.4);
  const fade = 1 - smoothstep01((rc - crest) / 38) * (1 - passGate(u, v));
  return h * fade;
}

// ─── The ceiling ────────────────────────────────────────────────────────────

/**
 * Swim ceiling: the wall band hugs the Drop Plains' own closed rim
 * (its ceiling is floor + 3 out there — the crossing is a duck under
 * the world's lid), holds ~3.4 m over the Othershore, then VAULTS as
 * the floor falls away at the Brink — the second edge opens both ways
 * at once — to +7 over the amphitheatre (54 m of water over the
 * Round), closing to floor + 3 at the disc's far rim (gated off the
 * inbound corridor only; the reserved depth-3 corridor stays sealed
 * until great-blue-3 opens it — ledgered, not built).
 */
export function blue2Ceiling(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 3.4 + 3.6 * smoothstep01((u - 744) / 40);
  // The wall band: ride the mirror down so the annex agrees with the
  // Drop Plains' own pinched rim ceiling whichever annex resolves.
  const wall = wallMirror(x, z, u);
  if (wall < 0) {
    c = Math.min(c, wall + 3.2);
  }
  c += (blue2TerrainTarget(x, z) + 3.0 - c) * smoothstep01((rc - 184) / 26) * (1 - passGate(u, v));
  return c;
}
