import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";

/**
 * THE FORGE COMBS — the pure half. Every function here is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 2.79) in metres from the
 * world origin; `v` is lateral, positive counterclockwise. The disc's
 * heart is at u = 940, v = 0; the disc spans u 720 → 1160. This is the
 * Smoking Marches' second chamber — deeper, older and more solemn than
 * the Smoulder Fields: not another caldera but a drowned dike swarm,
 * long black basalt walls (the Combs) standing in broken ranks, and the
 * heat running in LINES — glowing ground seams, not bowls. Light comes
 * from below: the Emberwash's seams, the First Hearth's junction star,
 * the milk-bright crusts on the pillow crowns above.
 *
 * The inbound connection is the depth-1 → depth-2 pass off the Smoulder
 * Fields' far pole: their disc ends at u ≈ 665, ours begins at 720, so
 * the pass tongue starts at u = 635 — thirty metres *inside* their rim —
 * and the two domains genuinely overlap (the Canopy Deep's device). Three
 * bands:
 *
 * - **The Cinder Saddle** (u 635 → 745): a milky crest shelf at dune
 *   level over the Smoulder's Ember Shore. Our weight is a whisper (the
 *   threshold gate below): the Smoulder still owns the water and the
 *   terrain, we own only the bounds — and the gate hides the framework's
 *   depth-boundary reject circle (`RegionField` consults us only within
 *   260 m of our centre, u ≥ 680 on the spine): out there our target is
 *   held at dune level, so the step at the reject circle is centimetres.
 * - **The Clinker Stair** (u 745 → 800): the pass is a place — five
 *   cinder benches falling ~13 m between the Doorcombs, each riser
 *   seamed with ember.
 * - **The country** (the disc): the Comb Walls' gravel floors at ≈ −14,
 *   the Emberwash rift winding through them at −18, the First Hearth
 *   basin at −20, the Pillow Meadows' crusted mounds at −9, and the
 *   Glass Shore's obsidian shelf at −16 running to the Night Door.
 *
 * Vertical terrain range across the domain ≈ 21 m (threshold +0.2 down
 * to the Hearth's −20.5; the test holds ≥ 18) — and the built Combs add
 * 8–16 m of standing wall above their floors.
 */

export const SMOKING2_SLOT = regionSlot("smoking-marches-2");
const CENTER = slotCenter(SMOKING2_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(SMOKING2_SLOT.azimuth);
const AXIS_Z = Math.sin(SMOKING2_SLOT.azimuth);

const SEED = SEEDS.regionSmoking2;

/** Spoke coordinates: `u` along the province axis, `v` lateral. */
export function spokeOf(x: number, z: number): { u: number; v: number } {
  return { u: x * AXIS_X + z * AXIS_Z, v: -x * AXIS_Z + z * AXIS_X };
}

/** World position from spoke coordinates — the builders' one placement door. */
export function worldOf(u: number, v: number): { x: number; z: number } {
  return { x: u * AXIS_X - v * AXIS_Z, z: u * AXIS_Z + v * AXIS_X };
}

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

// ─── The domain ─────────────────────────────────────────────────────────────

/**
 * The pass tongue. `fromR: 635` reaches thirty metres inside the
 * Smoulder Fields' rim (665) so the bounds handover is an overlap, never
 * a gap; `toR: 840` runs it well into our own disc so the max-combine
 * with the disc weight has no waist at the rim crossing.
 */
export const PASS_TONGUE: Tongue = approachTongue(SMOKING2_SLOT, {
  fromR: 635,
  toR: 840,
  halfWidthFrom: 14,
  halfWidthTo: 52,
});

const DISC = slotDisc(SMOKING2_SLOT);

/**
 * The threshold gate: our ownership over the Smoulder's shore is a
 * whisper (0.14) so their terrain, mood and paint keep carrying the
 * shelf, rising to full only past u ≈ 724 where the country is ours
 * alone.
 */
function thresholdGate(u: number): number {
  return 0.14 + 0.86 * smoothstep01((u - 690) / 34);
}

/** Ownership in [0, 1]; exactly 0 outside the disc and the pass tongue. */
export function smoking2Weight(x: number, z: number): number {
  const disc = discWeight(DISC, x, z);
  const pass = tongueWeight(PASS_TONGUE, x, z);
  if (pass === 0) {
    return disc;
  }
  const { u } = spokeOf(x, z);
  return Math.max(disc, pass * thresholdGate(u));
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
 * How much a point belongs to the pass corridor, in [0, 1] — the smooth
 * gate that keeps the rim fade and the rim ceiling-closure off the
 * Clinker Stair's descent.
 */
export function passGate(u: number, v: number): number {
  const along = 1 - smoothstep01((u - 806) / 26);
  const across = 1 - smoothstep01((Math.abs(v) - (passHalfWidth(Math.min(u, 840)) + 2)) / 14);
  return along * across;
}

// ─── The Cinder Saddle and the Clinker Stair ────────────────────────────────

export const DESCENT_FROM = 745;
export const DESCENT_TO = 800;
/** The five clinker benches: first riser, pitch between risers, drop each. */
const STEP_U0 = 748;
const STEP_PITCH = 10;
const STEP_DROP = 2.6;
const STEP_COUNT = 5;
/** Metres of `u` a riser takes to fall — steep, seamed with ember (the
 *  verdant-2 lesson: a run wider than ~3 m melts into a swell). */
const RISER_RUN = 3.0;

/** Total drop of the Clinker Stair, for the tests and the builders. */
export const DESCENT_TOTAL_DROP = STEP_DROP * STEP_COUNT;

/** The saddle channel's lateral wander — gentle; this is a road. */
export function saddleCenter(u: number): number {
  const grow = smoothstep01((u - 660) / 80);
  return grow * (5 * Math.sin(u * 0.037 + 1.2) + 2.6 * Math.sin(u * 0.016 + 0.4));
}

/** The saddle channel's half-width: a broad processional way. */
export function saddleHalf(u: number): number {
  return 8.5 + 5.5 * smoothstep01((u - DESCENT_FROM) / (DESCENT_TO - DESCENT_FROM));
}

/**
 * The clinker staircase along the spine: 0 above the first riser,
 * ≈ −13 below the last. Also reports how much of the point sits on a
 * riser (0 tread, 1 mid-riser) so builders and paint can find the step
 * faces without re-deriving the geometry.
 */
export function descentDrop(u: number): { level: number; riser: number } {
  let level = 0;
  let riser = 0;
  for (let i = 0; i < STEP_COUNT; i++) {
    const at = STEP_U0 + i * STEP_PITCH;
    const t = (u - at) / RISER_RUN;
    level -= STEP_DROP * smoothstep01(t);
    if (t > 0 && t < 1) {
      riser = Math.max(riser, 4 * t * (1 - t));
    }
  }
  return { level, riser };
}

/** The `u` of bench `i`'s riser foot, for builders placing ledge dressing. */
export function benchFootU(i: number): number {
  return STEP_U0 + i * STEP_PITCH + RISER_RUN;
}

/** The threshold's gentle draw-in: dune level easing toward the stair. */
function thresholdLevel(u: number): number {
  return 0.2 - 1.6 * smoothstep01((u - 700) / 42);
}

/** Wall height above the saddle channel, both flanks. */
function saddleWallHeight(u: number): number {
  return 4 + 4 * smoothstep01((u - 720) / 60);
}

/** The pass's own composed floor: threshold, stair, flanking shoulders. */
function passHeight(x: number, z: number, u: number, v: number): number {
  const drop = descentDrop(u);
  const away = Math.abs(v - saddleCenter(u));
  const wall = smoothstep01((away - saddleHalf(u)) / 9);
  const wallBand = smoothstep01((u - 705) / 32);
  const detail =
    (fbm(x * 0.023, z * 0.023, { seed: SEED ^ 0x2c01, period: 8, octaves: 2 }) - 0.5) * 0.7;
  const h = thresholdLevel(u) + drop.level + wall * wallBand * saddleWallHeight(u) + detail;
  // Beyond the tongue's own width the authored pass returns to dune
  // level: out there the weight is a whisper over zero.
  const inside = 1 - smoothstep01((Math.abs(v) - passHalfWidth(u)) / 16);
  return h * inside;
}

// ─── The disc's sub-biomes ──────────────────────────────────────────────────

/** The Comb Walls' resting gravel floor — the country's dark plain. */
export const COMB_FLOOR = -14;

/** The Pillow Meadows: crusted lava mounds north of the combs. */
export const PILLOWS = { u: 890, v: 128, radius: 92 } as const;
const PILLOW_FLOOR = -9;

/** The First Hearth: the fissure-junction basin south of the combs. */
export const HEARTH = { u: 905, v: -95, radius: 70 } as const;
export const HEARTH_FLOOR = -20;

/** The Glass Shore: the obsidian shelf before the far rim. */
export const GLASS_FROM = 1030;
const GLASS_FLOOR = -16;

/** The Anvil's seat: the flat-topped block the Emberwash splits around. */
export const ANVIL = { u: 938, v: -22 } as const;

/** The Night Door: the far-pole frame over the reserved depth-3 pass. */
export const NIGHT_DOOR = { u: 1122, v: 0 } as const;

/**
 * The Emberwash: the region's road — a shallow glowing rift entering at
 * the Doorcombs and winding south-east to the Glass Shore. The centre
 * line, half-width and rift depth are the one truth the terrain, paint,
 * seams, fills and tests all read.
 */
export const WASH_FROM = 762;
export const WASH_TO = 1075;

export function washCenter(u: number): number {
  const grow = smoothstep01((u - WASH_FROM) / 40);
  return grow * (14 * Math.sin((u - 760) * 0.016) - (u - 760) * 0.045);
}

export function washHalf(u: number): number {
  return 6 + 2.5 * smoothstep01((u - 840) / 120);
}

/** How much a spoke point sits in the Emberwash rift, in [0, 1]. */
export function washWeight(u: number, v: number): number {
  if (u < WASH_FROM - 10 || u > WASH_TO + 20) {
    return 0;
  }
  const enter = smoothstep01((u - (WASH_FROM - 10)) / 24);
  const exit = 1 - smoothstep01((u - (WASH_TO - 10)) / 30);
  const across = 1 - smoothstep01((Math.abs(v - washCenter(u)) - washHalf(u) * 0.55) / (washHalf(u) * 0.8));
  return enter * exit * across;
}

/** How much of the pillow country owns a spoke point, in [0, 1]. */
export function pillowsWeight(u: number, v: number): number {
  const d = Math.hypot(u - PILLOWS.u, v - PILLOWS.v);
  return 1 - smoothstep01((d / PILLOWS.radius - 0.25) / 0.75);
}

/** How much of the First Hearth basin owns a spoke point, in [0, 1]. */
export function hearthWeight(u: number, v: number): number {
  const d = Math.hypot(u - HEARTH.u, v - HEARTH.v);
  return 1 - smoothstep01((d / HEARTH.radius - 0.25) / 0.75);
}

/** How much of the Glass Shore shelf owns a spoke point, in [0, 1]. */
export function glassWeight(u: number): number {
  return smoothstep01((u - GLASS_FROM) / 55);
}

/**
 * The comb-foot ridges: the terrain's own welts under the built walls,
 * so the Combs grow FROM the ground instead of standing on a plane. One
 * table, read by the terrain, the builder and the paint.
 */
export interface CombSpec {
  readonly name: string;
  readonly u: number;
  readonly v: number;
  /** Heading in spoke-frame radians, measured from +u toward +v. */
  readonly heading: number;
  readonly halfLength: number;
  readonly height: number;
  readonly thickness: number;
}

// R2: heights up a third across the board — r1's walls barely cleared
// their own foot-welts and the country read as low plateaus, not combs.
export const COMBS: readonly CombSpec[] = [
  // The Doorcombs: the gate pair the Clinker Stair descends between.
  { name: "door-west", u: 758, v: -26, heading: 1.22, halfLength: 19, height: 14, thickness: 3.2 },
  { name: "door-east", u: 764, v: 24, heading: 1.36, halfLength: 17, height: 16, thickness: 3.4 },
  // The Long Gallery: the first rank, parted by the wash.
  { name: "gallery-north", u: 840, v: 38, heading: 1.3, halfLength: 26, height: 18, thickness: 4.2 },
  { name: "gallery-south", u: 828, v: -40, heading: 1.24, halfLength: 24, height: 17, thickness: 4.0 },
  // The Broken Comb's two stubs, parted by the wash (which runs v ≈ 9.5
  // here) — the fallen lintel is built, not terrain.
  { name: "broken-north", u: 863, v: 24, heading: 1.3, halfLength: 8, height: 10, thickness: 3.4 },
  { name: "broken-south", u: 855, v: -6, heading: 1.3, halfLength: 8, height: 9, thickness: 3.2 },
  // The Kings' Run: the tallest pair, the skyline's crown.
  { name: "king-west", u: 903, v: 40, heading: 1.4, halfLength: 30, height: 22, thickness: 5.0 },
  { name: "king-east", u: 934, v: 26, heading: 1.32, halfLength: 22, height: 20, thickness: 4.6 },
  // The Anvil Court's southern rank.
  { name: "court-south", u: 954, v: -54, heading: 1.2, halfLength: 28, height: 15, thickness: 4.2 },
  // The Far Comb: the last rank before the Glass Shore, parted by the wash.
  { name: "far-north", u: 1014, v: 26, heading: 1.34, halfLength: 22, height: 16, thickness: 4.0 },
  { name: "far-south", u: 1004, v: -52, heading: 1.28, halfLength: 18, height: 14, thickness: 3.8 },
  // The Hearth's two half-sunk fins, standing in the basin glow.
  { name: "hearth-west", u: 884, v: -82, heading: 1.1, halfLength: 12, height: 9, thickness: 3.0 },
  { name: "hearth-east", u: 926, v: -106, heading: 1.25, halfLength: 11, height: 8.5, thickness: 3.0 },
  // The Night Door: two narrow fins leaning together over the far pole,
  // framing the reserved depth-3 corridor.
  { name: "night-west", u: 1116, v: -14, heading: 0.28, halfLength: 9, height: 16, thickness: 2.6 },
  { name: "night-east", u: 1118, v: 14, heading: -0.24, halfLength: 9, height: 17, thickness: 2.6 },
] as const;

/** Signed distances to a comb's axis: `along` the wall, `across` it. */
export function combFrame(comb: CombSpec, u: number, v: number): { along: number; across: number } {
  const du = u - comb.u;
  const dv = v - comb.v;
  const cos = Math.cos(comb.heading);
  const sin = Math.sin(comb.heading);
  return { along: du * cos + dv * sin, across: -du * sin + dv * cos };
}

/** The terrain welt under the comb ranks. */
export function combMound(u: number, v: number): number {
  let mound = 0;
  for (const comb of COMBS) {
    const d = Math.hypot(u - comb.u, v - comb.v);
    if (d > comb.halfLength + 14) {
      continue;
    }
    const { along, across } = combFrame(comb, u, v);
    const endFade = 1 - smoothstep01((Math.abs(along) - comb.halfLength) / 8);
    const sideFade = 1 - smoothstep01((Math.abs(across) - comb.thickness * 0.5) / 6.5);
    mound = Math.max(mound, endFade * sideFade * 1.7);
  }
  return mound;
}

/**
 * The protected stillness registry entries this region contributes to
 * MASTER §1.2 (see the ledger). Every instanced kit scatter, shoal
 * route and fauna anchor keeps out; the licensed exceptions are stated
 * per rest in the ledger.
 */
export const RESTS = {
  /** The Ladle: a pillow-crown bowl holding a milk pool — its one dim
   *  glimmer is the room's only light; fauna-free, glow-free. */
  ladle: { u: 886, v: 122, radius: 12 },
  /** The Glass Hush: a bare obsidian pocket with one witness erratic. */
  glassHush: { u: 1058, v: -64, radius: 12 },
  /** The Anvil's Shadow: the lee floor south-east of the Anvil, off the
   *  wash (the road bends north past the heart; the shadow pools behind). */
  anvilShadow: { u: 949, v: -37, radius: 9 },
} as const;

/** 1 outside every rest, easing to 0 inside — the shared stillness gate. */
export function stillnessGate(u: number, v: number): number {
  let gate = 1;
  for (const rest of [RESTS.ladle, RESTS.glassHush, RESTS.anvilShadow]) {
    const d = Math.hypot(u - rest.u, v - rest.v);
    gate *= smoothstep01((d - rest.radius) / 4);
  }
  return gate;
}

function discHeight(x: number, z: number, u: number, v: number): number {
  // The Comb Walls' gravel plain carries the disc: dark swells.
  let h =
    COMB_FLOOR +
    (fbm(x * 0.013, z * 0.013, { seed: SEED ^ 0x2c02, period: 6, octaves: 2 }) - 0.5) * 2.4 +
    (fbm(x * 0.031, z * 0.031, { seed: SEED ^ 0x2c03, period: 9, octaves: 2 }) - 0.5) * 0.8;

  // The comb-foot welts: the walls grow FROM the ground.
  h += combMound(u, v);

  // The Pillow Meadows: a raised shelf of crusted mounds — the mounds
  // themselves are drawn at the scale the sheets can carry (~2.2 m grid),
  // round bosses 4–9 m across.
  const pillows = pillowsWeight(u, v);
  if (pillows > 0) {
    const boss =
      Math.max(
        0,
        fbm(x * 0.052, z * 0.052, { seed: SEED ^ 0x2c04, period: 12, octaves: 2 }) - 0.42,
      ) * 4.6;
    h += pillows * (PILLOW_FLOOR + boss - h);
  }

  // The First Hearth: the fissure-junction basin, the region's deep.
  const hearth = hearthWeight(u, v);
  if (hearth > 0) {
    const floorDetail =
      (fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x2c05, period: 10, octaves: 2 }) - 0.5) * 1.4;
    h += hearth * (HEARTH_FLOOR + floorDetail - h);
  }

  // The Glass Shore: the obsidian shelf running to the world's end.
  const glass = glassWeight(u);
  if (glass > 0) {
    const sheet =
      GLASS_FLOOR +
      (fbm(x * 0.017, z * 0.017, { seed: SEED ^ 0x2c06, period: 5, octaves: 2 }) - 0.5) * 1.2;
    h += glass * (sheet - h);
  }

  // The Emberwash rift, cut last so the road wins its own floor: a
  // 4-metre-deep channel with soft raised lips.
  const wash = washWeight(u, v);
  if (wash > 0) {
    h += wash * -4.2;
  }
  const washD = Math.abs(v - washCenter(u));
  if (u > WASH_FROM - 10 && u < WASH_TO + 20) {
    h +=
      0.6 *
      smoothstep01((washD - washHalf(u) * 0.9) / 2.5) *
      (1 - smoothstep01((washD - washHalf(u) * 1.7) / 4));
  }

  // The Anvil's seat: a low plinth swell under the built block.
  const anvilD = Math.hypot(u - ANVIL.u, v - ANVIL.v);
  if (anvilD < 26) {
    h += (1 - smoothstep01((anvilD - 8) / 16)) * 2.2;
  }

  // Ground life at the scale the sheets can carry.
  h += (fbm(x * 0.027, z * 0.027, { seed: SEED ^ 0x2c07, period: 9, octaves: 2 }) - 0.5) * 0.7;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. The threshold and the
 * Clinker Stair run the pass; the disc height takes over across the
 * stair's foot; and the whole answer eases back to dune level across the
 * disc's far feather (gated off the pass corridor) so the composed
 * ground and this target agree wherever the diver can be.
 */
export function smoking2TerrainTarget(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

  let h: number;
  if (u < DESCENT_TO - 18) {
    h = passHeight(x, z, u, v);
  } else if (u < DESCENT_TO + 24) {
    const s = smoothstep01((u - (DESCENT_TO - 18)) / 42);
    const pass = passHeight(x, z, u, v);
    h = pass + s * (discHeight(x, z, u, v) - pass);
  } else {
    h = discHeight(x, z, u, v);
  }

  // The rim fade: authored ground returns to dune level before the
  // weight feather ends — except along the pass corridor, which crosses
  // the near rim and must not fade.
  const fade = 1 - smoothstep01((rc - 172) / 38) * (1 - passGate(u, v));
  return h * fade;
}

// ─── The ceiling ────────────────────────────────────────────────────────────

/**
 * Swim ceiling: 3.8 m over the Cinder Saddle's crest (meeting the
 * Smoulder Fields' closed far rim), vaulting to ~12 down the Clinker
 * Stair, opening to 24 over the country — the Combs' crests and the
 * shimmer columns want the head-room — and closing to 3.4 at the disc's
 * far rim (gated off the pass) so one ring of collider stacks seals the
 * world's edge floor to ceiling. The Night Door's reserved corridor
 * stays under the closed rim for now: the depth-3 worker authors its own
 * threshold beneath it, the way this region did under the Smoulder's.
 */
export function smoking2Ceiling(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 3.8 + 8.2 * smoothstep01((u - 690) / 66);

  // The vault over the country.
  c += (24 - c) * smoothstep01((u - 756) / 70);

  // The rim closure, gated off the pass corridor.
  c += (3.4 - c) * smoothstep01((rc - 186) / 26) * (1 - passGate(u, v));
  return c;
}
