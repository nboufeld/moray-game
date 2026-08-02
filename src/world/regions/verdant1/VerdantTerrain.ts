import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";

/**
 * The Great Kelp Sea — the pure half. Everything in this file is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object. The built half
 * (`VerdantBuild`) reads the same functions, which is what keeps every
 * holdfast, rock and capture pose standing on the ground the collision
 * field believes in.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 1.35) in metres from the world
 * origin; `v` is lateral, positive counterclockwise. The disc's heart is at
 * u = 445, v = 0.
 *
 * - **The Long Vale** (u 48 → 285): a winding green canyon out of the Kelp
 *   Cathedral's opened end wall. The floor leaves the cathedral at its own
 *   −5.4, deepens to −7.2 through the narrows, then climbs to a +1.6 saddle
 *   lip at u ≈ 268 — the reveal — and falls into the meadows. Walls rise
 *   from 4 m at the mouth to 9 m past the narrows; the channel wanders and
 *   pinches just before the lip so the light narrows before it opens.
 * - **The Rolling Meadows** (the disc's near third): sunlit grass swells
 *   between −3.8 and +0.4, the gentle mouth of the region.
 * - **The High Forest** (the heart): a broad basin settling to ≈ −8.5,
 *   where the giants stand. Hillocks a metre high structure the floor.
 * - **The Sunwell** (u 475, v +58, r 34): a circular clearing sunk two
 *   metres below the forest floor with a soft raised rim — the canopy
 *   breaks over it and the light falls in.
 * - **The Root Maze** (u 495, v −82, r 62): the deepest quarter, down to
 *   ≈ −21, ridged with gullies for the holdfast tangle.
 * - **The Falling Edge** (u > 540): the forest thins onto a −2.4 shelf
 *   before the rim, where the painted distance takes over.
 *
 * Everything dramatic lives inside the weight-1 core (r ≤ 170 of the disc's
 * centre, |lateral| well inside the tongue), so the composed ground *is*
 * this function wherever the diver can stand — which is what makes the
 * bounds annex's `terrainTarget + clearance` floor honest.
 */

export const VERDANT_SLOT = regionSlot("verdant-line-1");
const CENTER = slotCenter(VERDANT_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(VERDANT_SLOT.azimuth);
const AXIS_Z = Math.sin(VERDANT_SLOT.azimuth);

const SEED = SEEDS.regionVerdant1;

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
 * end, which is as wide as the map allows — the canyon's wedge reaches
 * azimuth 1.11 on one side and the Nursery Shallows' reaches 1.545 on the
 * other, and at r = 44 an 8.2 m half-width clears both with real margin
 * (weight exactly 0 in both neighbours' ground, held by their tests).
 *
 * The vale tongue begins at r = 62 — past every wing's carve end — and
 * carries the width the vale's walls and shoulders actually need. Beyond
 * the wings nothing else owns that water, so it can open to 40 m.
 */
export const VERDANT_TONGUE: Tongue = approachTongue(VERDANT_SLOT, {
  halfWidthFrom: 8.2,
  halfWidthTo: 34,
});

export const VERDANT_TONGUE_WIDE: Tongue = approachTongue(VERDANT_SLOT, {
  fromR: 62,
  halfWidthFrom: 20,
  halfWidthTo: 40,
});

const DISC = slotDisc(VERDANT_SLOT);

/** Ownership in [0, 1]; exactly 0 outside the disc and the tongues. */
export function verdantWeight(x: number, z: number): number {
  return Math.max(
    discWeight(DISC, x, z),
    tongueWeight(VERDANT_TONGUE, x, z),
    tongueWeight(VERDANT_TONGUE_WIDE, x, z),
  );
}

function tongueWidthAt(tongue: Tongue, u: number): number {
  const along = Math.min(1, Math.max(0, (u - tongue.fromR) / (tongue.toR - tongue.fromR)));
  return tongue.halfWidthFrom + (tongue.halfWidthTo - tongue.halfWidthFrom) * along;
}

/** The combined half-width at a spoke distance, for builders and seals. */
export function tongueHalfWidth(u: number): number {
  const seam = tongueWidthAt(VERDANT_TONGUE, u);
  if (u < VERDANT_TONGUE_WIDE.fromR - 4) {
    return seam;
  }
  return Math.max(seam, tongueWidthAt(VERDANT_TONGUE_WIDE, u));
}

// ─── The Long Vale ──────────────────────────────────────────────────────────

export const VALE_FROM = 44;
export const VALE_TO = 292;
/** Where the saddle lip crests — the reveal pose stands just short of it. */
export const VALE_LIP_U = 268;

/** The channel's lateral wander: the vale winds, growing bolder as it goes. */
export function valeChannelCenter(u: number): number {
  const grow = Math.min(1, (u - VALE_FROM) / 200);
  return grow * (8 * Math.sin(u * 0.045) + 4.5 * Math.sin(u * 0.019 + 2.1));
}

/** Channel half-width: opens with distance, pinched just before the lip. */
export function valeChannelHalf(u: number): number {
  const pinch = 4.0 * smoothstep01((u - 236) / 16) * (1 - smoothstep01((u - 260) / 16));
  return Math.max(2.8, 4.5 + (u - VALE_FROM) * 0.028 - pinch);
}

/** The channel floor along the spine — the vale's whole story in one curve. */
export function valeFloor(u: number): number {
  let f = -5.4;
  f += -1.8 * smoothstep01((u - 70) / 80); // deepening through the narrows
  f += 1.6 * smoothstep01((u - 150) / 55); // easing back up
  f += 7.4 * smoothstep01((u - 205) / 60); // the climb to the lip
  f += -3.6 * smoothstep01((u - VALE_LIP_U) / 24); // and over, into the meadows
  return f;
}

/**
 * Wall height above the channel floor: 4 m at the mouth, 9 past the
 * narrows — capped so the wall's plateau always stays a swimmable margin
 * under the vale's ceiling (the annex floor reads this function, and a
 * plateau above the ceiling is a phantom floor).
 */
function valeWallHeight(u: number): number {
  const drawn = 4 + 5 * smoothstep01((u - 60) / 160);
  return Math.max(0, Math.min(drawn, 7.4 - valeFloor(u)));
}

function valeHeight(x: number, z: number, u: number, v: number): number {
  const floor = valeFloor(u);
  const away = Math.abs(v - valeChannelCenter(u));
  const wall = valeWallHeight(u) * smoothstep01((away - valeChannelHalf(u)) / 9);
  const detail =
    (fbm(x * 0.021, z * 0.021, { seed: SEED ^ 0xd1a1, period: 8, octaves: 2 }) - 0.5) * 0.7;
  // Beyond the tongue's own width the authored vale returns to dune level:
  // out there the weight is a whisker over zero, and the annex floor reads
  // this function — a wall authored where the domain barely owns the point
  // would put a phantom floor above the composed ground.
  const inside = 1 - smoothstep01((Math.abs(v) - tongueHalfWidth(u)) / 18);
  return (floor + wall + detail) * inside;
}

// ─── The disc's sub-biomes ──────────────────────────────────────────────────

export const SUNWELL = { u: 475, v: 58, radius: 34 } as const;
export const ROOT_MAZE = { u: 495, v: -82, radius: 62 } as const;
export const FOREST_BASIN = { u: 450, v: -10, radius: 122 } as const;

/** Forest floor level in the basin's heart, before hillocks. */
export const FOREST_FLOOR = -8.5;

/** Deepest authored floor of the Root Maze, before its gullies. */
export const MAZE_FLOOR = -20.6;

/** How much of the forest basin owns a spoke point, in [0, 1]. */
export function forestWeight(u: number, v: number): number {
  const d = Math.hypot(u - FOREST_BASIN.u, v - FOREST_BASIN.v);
  return 1 - smoothstep01((d / FOREST_BASIN.radius - 0.3) / 0.7);
}

/** How much of the Sunwell's bowl owns a spoke point, in [0, 1]. */
export function sunwellWeight(u: number, v: number): number {
  const d = Math.hypot(u - SUNWELL.u, v - SUNWELL.v);
  return 1 - smoothstep01((d - 12) / 22);
}

/** How much of the Root Maze owns a spoke point, in [0, 1]. */
export function mazeWeight(u: number, v: number): number {
  const d = Math.hypot(u - ROOT_MAZE.u, v - ROOT_MAZE.v);
  return 1 - smoothstep01((d - 16) / 46);
}

/** How much of the Falling Edge shelf owns a spoke point, in [0, 1]. */
export function fallingEdgeWeight(u: number): number {
  return smoothstep01((u - 540) / 70);
}

function discHeight(x: number, z: number, u: number, v: number): number {
  // The Rolling Meadows: the disc's resting ground.
  const meadow =
    -1.7 + (fbm(x * 0.011, z * 0.011, { seed: SEED ^ 0x4e11, period: 5, octaves: 2 }) - 0.5) * 4.2;

  // The forest basin settles the heart down to its floor, hillocked.
  const basin = forestWeight(u, v);
  const hillocks =
    (fbm(x * 0.017, z * 0.017, { seed: SEED ^ 0x0f0e, period: 7, octaves: 2 }) - 0.5) * 2.2;
  let h = meadow + basin * (FOREST_FLOOR + hillocks - meadow);

  // The Sunwell: a bowl two metres below the forest floor, ringed by a
  // soft raised rim the light-ring giants stand on.
  const sunD = Math.hypot(u - SUNWELL.u, v - SUNWELL.v);
  h += sunwellWeight(u, v) * (FOREST_FLOOR - 2.1 - h);
  h += 1.0 * smoothstep01((sunD - 28) / 8) * (1 - smoothstep01((sunD - 42) / 12));

  // The Falling Edge: the far shelf before the rim.
  const shelf =
    -2.4 + (fbm(x * 0.013, z * 0.013, { seed: SEED ^ 0xfa11, period: 5, octaves: 2 }) - 0.5) * 1.6;
  h += fallingEdgeWeight(u) * (shelf - h);

  // The Root Maze, last so its depth wins its own quarter: gullies ridge
  // the floor for the holdfast tangle to grow through. Deepened in round
  // 2 — at ±2.3 the "maze" read as dunes with ornaments on it.
  const gullies =
    (fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x3a7e, period: 10, octaves: 3 }) - 0.5) * 6.4;
  h += mazeWeight(u, v) * (MAZE_FLOOR + gullies - h);

  // Ground life at the scale the sheets can carry.
  h += (fbm(x * 0.024, z * 0.024, { seed: SEED ^ 0x9d01, period: 9, octaves: 2 }) - 0.5) * 0.9;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. Pure and always live —
 * it runs inside `seabedHeight` for every sample anyone takes anywhere in
 * the province. The vale and the disc cross-fade over u 250–292, and the
 * whole answer eases back to dune level across the disc's weight feather so
 * the composed ground and this target agree wherever the diver can be.
 */
export function verdantTerrainTarget(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

  let h: number;
  if (u < 250) {
    h = valeHeight(x, z, u, v);
  } else if (u < VALE_TO) {
    const s = smoothstep01((u - 250) / (VALE_TO - 250));
    const vale = valeHeight(x, z, u, v);
    h = vale + s * (discHeight(x, z, u, v) - vale);
  } else {
    h = discHeight(x, z, u, v);
  }

  // The rim fade: authored ground returns to dune level before the weight
  // feather ends, so the annex floor stays honest at the edge of the world.
  // Gated on `u` as well as `rc`, because the vale runs its whole length
  // farther than 172 m from the disc's centre and must not fade — the gate
  // eases in over the same band the vale/disc cross-fade already spans.
  const fade = 1 - smoothstep01((rc - 172) / 38) * smoothstep01((u - 250) / 42);
  return h * fade;
}

// ─── The ceiling ────────────────────────────────────────────────────────────

/**
 * Swim ceiling: 12 m over the vale mouth (meeting the cathedral's vault),
 * squeezing to 10 through the narrows and over the lip, opening to 26 over
 * the forest so the canopy breach at ~+16 is a swim and not a bump — and
 * closing to 3.4 at the disc's rim so one ring of collider spheres seals
 * the world's edge floor to ceiling.
 */
export function verdantCeiling(x: number, z: number): number {
  const { u } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 12 - 2 * smoothstep01((u - 70) / 70) + 16 * smoothstep01((u - 272) / 50);
  // The rim closure is gated on `u` the same way the terrain fade is: the
  // vale's own walls stand farther than 186 m from the disc's centre, and
  // a ceiling slammed shut over a nine-metre wall is a floor above it.
  c += (3.4 - c) * smoothstep01((rc - 186) / 26) * smoothstep01((u - 250) / 42);
  return c;
}
