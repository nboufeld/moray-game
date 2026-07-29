import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";

/**
 * THE BONE MEADOWS — the pure half. Every function here is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object. The built half reads
 * the same functions, which keeps every bone tree, monument and capture
 * pose standing on the ground the collision field believes in.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 3.87) in metres from the
 * world origin; `v` is lateral, positive counterclockwise. The disc's
 * heart is at u = 445, v = 0.
 *
 * - **The Chalk Ravine** (u 48 → 292): the approach out of the Ghost
 *   Reef's opened end wall. Walls of stacked pale plates; the floor
 *   leaves the wing at its own −4.2, deepens to ≈ −7 through the hush,
 *   climbs to a +2 saddle lip at u ≈ 266 — the reveal — and falls into
 *   the Bone Forest.
 * - **The Bone Forest** (the disc's near third, basin at (355, −16)):
 *   dead thickets on gently rolling white ground, −2 to −4.
 * - **The Quiet Gallery** ((385, 78), r 58): a raised white pan, +1.2 and
 *   nearly flat — the region's most austere and composed place, where the
 *   monument corals stand alone.
 * - **The First Blush** (the band u ≈ 400–500): the ground itself stays
 *   pale; the blush is paint and buds, not terrain.
 * - **The Blooming Shelf** ((525, −48), r 85): a basin settling to ≈ −9.5
 *   where the young gardens grow and the shoal lives.
 * - **The Seed Grove** ((558, 38), r 44): the far heart — a bowl sinking
 *   to −19.5 at its centre, rimmed softly, where the mother-coral stands
 *   over her planted rows.
 *
 * The recovery gradient — `recovery(u, v)` — is the region's whole story
 * in one number: 0 in the white world, 1 at the Seed Grove, held low over
 * the Quiet Gallery on purpose. Ground paint, flora tints, life density
 * and the tests all read this one truth.
 *
 * Everything dramatic lives inside the weight-1 core (rc ≤ 170), so the
 * composed ground IS this function wherever the diver can stand.
 */

export const PALE_SLOT = regionSlot("pale-passage-1");
const CENTER = slotCenter(PALE_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(PALE_SLOT.azimuth);
const AXIS_Z = Math.sin(PALE_SLOT.azimuth);

const SEED = SEEDS.regionPale1;

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
 * The approach, as two max-combined tongues (the pilot's audited shape).
 *
 * The seam tongue holds the doorway: 8.0 m of half-width at the wing's
 * end. The neighbours are Glass Cove (azimuth 3.51) and Current Run
 * (4.23), both with endHalf 0.165 — their wedge edges sit at 3.675 and
 * 4.065, so the widest clean half-angle off 3.87 is 0.195 rad; 8.0 m at
 * r = 44 is 0.182 rad, clearing both with margin that only grows with r.
 *
 * The ravine tongue begins at r = 62 — past every wing's carve end at 50
 * — and carries the width the ravine's walls and shoulders need.
 */
export const PALE_TONGUE: Tongue = approachTongue(PALE_SLOT, {
  halfWidthFrom: 8.0,
  halfWidthTo: 34,
});

export const PALE_TONGUE_WIDE: Tongue = approachTongue(PALE_SLOT, {
  fromR: 62,
  halfWidthFrom: 20,
  halfWidthTo: 40,
});

const DISC = slotDisc(PALE_SLOT);

/** Ownership in [0, 1]; exactly 0 outside the disc and the tongues. */
export function paleWeight(x: number, z: number): number {
  return Math.max(
    discWeight(DISC, x, z),
    tongueWeight(PALE_TONGUE, x, z),
    tongueWeight(PALE_TONGUE_WIDE, x, z),
  );
}

function tongueWidthAt(tongue: Tongue, u: number): number {
  const along = Math.min(1, Math.max(0, (u - tongue.fromR) / (tongue.toR - tongue.fromR)));
  return tongue.halfWidthFrom + (tongue.halfWidthTo - tongue.halfWidthFrom) * along;
}

/** The combined half-width at a spoke distance, for builders and seals. */
export function tongueHalfWidth(u: number): number {
  const seam = tongueWidthAt(PALE_TONGUE, u);
  if (u < PALE_TONGUE_WIDE.fromR - 4) {
    return seam;
  }
  return Math.max(seam, tongueWidthAt(PALE_TONGUE_WIDE, u));
}

// ─── The Chalk Ravine ───────────────────────────────────────────────────────

export const RAVINE_FROM = 44;
export const RAVINE_TO = 292;
/** Where the saddle lip crests — the reveal pose stands just short of it. */
export const RAVINE_LIP_U = 266;

/** The channel's lateral wander: bolder as it goes, like the pilot's vale. */
export function ravineChannelCenter(u: number): number {
  const grow = Math.min(1, (u - RAVINE_FROM) / 190);
  return grow * (7.5 * Math.sin(u * 0.043) + 4.2 * Math.sin(u * 0.017 + 1.3));
}

/** Channel half-width: opens with distance, pinched just before the lip. */
export function ravineChannelHalf(u: number): number {
  const pinch = 3.8 * smoothstep01((u - 230) / 16) * (1 - smoothstep01((u - 256) / 16));
  return Math.max(2.8, 4.2 + (u - RAVINE_FROM) * 0.03 - pinch);
}

/** The channel floor along the spine — hush, deepening, the climb, the fall. */
export function ravineFloor(u: number): number {
  let f = -4.2;
  f += -2.8 * smoothstep01((u - 66) / 78); // deepening into the hush
  f += 1.4 * smoothstep01((u - 150) / 50); // easing back up
  f += 7.6 * smoothstep01((u - 200) / 62); // the climb to the lip
  f += -4.6 * smoothstep01((u - RAVINE_LIP_U) / 24); // over, into the Bone Forest
  return f;
}

/**
 * Wall height above the channel floor: 4 m at the mouth, 10 past the
 * hush — capped so the crest always stays a swimmable margin under the
 * ravine's ceiling (the annex floor reads this function, and a plateau
 * above the ceiling is a phantom floor).
 */
function ravineWallHeight(u: number): number {
  const drawn = 4 + 6 * smoothstep01((u - 60) / 150);
  return Math.max(0, Math.min(drawn, 6.0 - ravineFloor(u)));
}

function ravineHeight(x: number, z: number, u: number, v: number): number {
  const floor = ravineFloor(u);
  const away = Math.abs(v - ravineChannelCenter(u));
  const wall = ravineWallHeight(u);
  // Two benches instead of one smooth bank: the stacked-plate read is in
  // the silhouette before it is in the paint.
  const bank =
    wall *
    (0.55 * smoothstep01((away - ravineChannelHalf(u)) / 4.5) +
      0.45 * smoothstep01((away - ravineChannelHalf(u) - 4.6) / 5));
  const detail =
    (fbm(x * 0.021, z * 0.021, { seed: SEED ^ 0xc4a1, period: 8, octaves: 2 }) - 0.5) * 0.6;
  // Beyond the tongue's own width the authored ravine returns to dune
  // level: out there the weight is a whisker over zero and the annex floor
  // reads this function — a wall authored where the domain barely owns the
  // point is a phantom floor.
  const inside = 1 - smoothstep01((Math.abs(v) - tongueHalfWidth(u)) / 18);
  return (floor + bank + detail) * inside;
}

// ─── The disc's sub-biomes ──────────────────────────────────────────────────

export const BONE_FOREST = { u: 355, v: -16, radius: 96 } as const;
export const QUIET_GALLERY = { u: 385, v: 78, radius: 58 } as const;
export const BLOOM_SHELF = { u: 525, v: -48, radius: 85 } as const;
export const SEED_GROVE = { u: 558, v: 38, radius: 44 } as const;

/** The gallery pan's level — the region's high white table. */
export const GALLERY_FLOOR = 1.2;
/** The grove's inner heart — the deepest authored floor. */
export const GROVE_FLOOR = -19.5;

/** How much of the Bone Forest basin owns a spoke point, in [0, 1]. */
export function boneForestWeight(u: number, v: number): number {
  const d = Math.hypot(u - BONE_FOREST.u, v - BONE_FOREST.v);
  return 1 - smoothstep01((d / BONE_FOREST.radius - 0.3) / 0.7);
}

/** How much of the Quiet Gallery pan owns a spoke point, in [0, 1]. */
export function galleryWeight(u: number, v: number): number {
  const d = Math.hypot(u - QUIET_GALLERY.u, v - QUIET_GALLERY.v);
  return 1 - smoothstep01((d - 22) / 36);
}

/** How much of the Blooming Shelf basin owns a spoke point, in [0, 1]. */
export function bloomWeight(u: number, v: number): number {
  const d = Math.hypot(u - BLOOM_SHELF.u, v - BLOOM_SHELF.v);
  return 1 - smoothstep01((d - 20) / 65);
}

/** How much of the Seed Grove bowl owns a spoke point, in [0, 1]. */
export function groveWeight(u: number, v: number): number {
  const d = Math.hypot(u - SEED_GROVE.u, v - SEED_GROVE.v);
  return 1 - smoothstep01((d - 12) / 32);
}

/**
 * THE STORY, as one pure number: how far life has returned at a point.
 * 0 in the white world near the gateway, 1 at the Seed Grove; the Quiet
 * Gallery is held pale on purpose — its austerity is authored, not an
 * accident of the ramp. Ground paint, flora tints, life density and the
 * region's tests all read this single gradient.
 */
export function recovery(u: number, v: number): number {
  let k = smoothstep01((u - 380) / 180);
  k = Math.min(1, k + groveWeight(u, v) * 0.25);
  k *= 1 - galleryWeight(u, v) * 0.85;
  return k;
}

function discHeight(x: number, z: number, u: number, v: number): number {
  // The bone meadows: pale rolling ground, gentler than the kelp sea's.
  const meadow =
    -2.2 + (fbm(x * 0.011, z * 0.011, { seed: SEED ^ 0x4e22, period: 5, octaves: 2 }) - 0.5) * 3.6;

  // The Bone Forest basin: a shallow settle so the thickets stand in a
  // hollow of milk, hummocked at the metre scale.
  const forest = boneForestWeight(u, v);
  const hummocks =
    (fbm(x * 0.017, z * 0.017, { seed: SEED ^ 0x0f1e, period: 7, octaves: 2 }) - 0.5) * 1.8;
  let h = meadow + forest * (-3.4 + hummocks - meadow);

  // The Quiet Gallery: a raised pan flattened almost smooth — austerity
  // is a *value* here, and flatness is most of it.
  const gallery = galleryWeight(u, v);
  if (gallery > 0) {
    const pan =
      GALLERY_FLOOR +
      (fbm(x * 0.013, z * 0.013, { seed: SEED ^ 0x9a11, period: 5, octaves: 2 }) - 0.5) * 0.5;
    h += gallery * (pan - h);
  }

  // The Blooming Shelf: the basin the gardens grow in, hummocked a step
  // bolder than the forest so the beds read as beds.
  const bloom = bloomWeight(u, v);
  if (bloom > 0) {
    const beds =
      (fbm(x * 0.019, z * 0.019, { seed: SEED ^ 0xb10a, period: 8, octaves: 2 }) - 0.5) * 2.4;
    h += bloom * (-9.5 + beds - h);
  }

  // The Seed Grove, last so its depth wins its own heart: a bowl with a
  // soft rim, sinking to the region's deepest floor under the mother.
  const grove = groveWeight(u, v);
  if (grove > 0) {
    const d = Math.hypot(u - SEED_GROVE.u, v - SEED_GROVE.v);
    const bowl = GROVE_FLOOR + 5.5 * smoothstep01((d - 8) / 26);
    h += grove * (bowl - h);
    // The rim: a raised lip at the bowl's edge the nursery rows crest over.
    h += 0.9 * smoothstep01((d - 28) / 8) * (1 - smoothstep01((d - 42) / 10));
  }

  // Ground life at the scale the sheets can carry.
  h += (fbm(x * 0.024, z * 0.024, { seed: SEED ^ 0x9d07, period: 9, octaves: 2 }) - 0.5) * 0.8;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. Pure and always live.
 * The ravine and the disc cross-fade over u 250–292, and the whole answer
 * eases back to dune level across the disc's weight feather so the
 * composed ground and this target agree wherever the diver can be.
 */
export function paleTerrainTarget(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

  let h: number;
  if (u < 250) {
    h = ravineHeight(x, z, u, v);
  } else if (u < RAVINE_TO) {
    const s = smoothstep01((u - 250) / (RAVINE_TO - 250));
    const ravine = ravineHeight(x, z, u, v);
    h = ravine + s * (discHeight(x, z, u, v) - ravine);
  } else {
    h = discHeight(x, z, u, v);
  }

  // The rim fade: authored ground returns to dune level before the weight
  // feather ends, gated on `u` as well as `rc` so the ravine (which runs
  // its whole length farther than 172 m from the disc's centre) never fades.
  const fade = 1 - smoothstep01((rc - 172) / 38) * smoothstep01((u - 250) / 42);
  return h * fade;
}

// ─── The ceiling ────────────────────────────────────────────────────────────

/**
 * Swim ceiling: 10 m at the ravine mouth (meeting the Ghost Reef's 9 m
 * vault), squeezing to 8.5 through the hush and over the lip — the white
 * world presses close — then opening to 24 over the disc, and closing to
 * 3.4 at the rim so one ring of collider spheres seals the world's edge
 * floor to ceiling.
 */
export function paleCeiling(x: number, z: number): number {
  const { u } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 10 - 1.5 * smoothstep01((u - 80) / 80) + 15.5 * smoothstep01((u - 270) / 50);
  c += (3.4 - c) * smoothstep01((rc - 186) / 26) * smoothstep01((u - 250) / 42);
  return c;
}
