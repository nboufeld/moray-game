import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";

/**
 * THE LANTERN COMBS — the pure half. Every function here is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 3.87) in metres from the
 * world origin; `v` is lateral, positive counterclockwise. The disc's
 * heart is at u = 940, v = 0; the disc spans u 720 → 1160. This is the
 * Pale Passage's second chamber: past the Bone Meadows' colour-return
 * the white goes bright instead of bleached — the country BEHIND the
 * paper, where the lamp lives.
 *
 * The inbound connection is the depth-1 → depth-2 pass from the Bone
 * Meadows' far rim: their disc ends at u ≈ 665, ours begins at 720, so
 * the pass tongue starts at u = 635 — thirty metres *inside* their rim
 * — and the two domains genuinely overlap. Three bands:
 *
 * - **The Saddle Reach** (u 635 → 745): a milky crest shelf at dune
 *   level over the Bone Meadows' own rim. Our weight is a whisper (the
 *   threshold gate below): pale-1 still owns the water and the terrain,
 *   we own only the bounds — and the gate hides the framework's
 *   depth-boundary reject circle (`RegionField` consults us only within
 *   260 m of our centre, u ≥ ~680): out there our target is held at
 *   dune level, so the step at the reject circle is centimetres (the
 *   verdant-2/3 device, third use).
 * - **The Winnow** (u 748 → 812): the pass is a place — six chalk
 *   root-steps down ~20 m in a slot between the first great comb fins.
 * - **The country** (the disc): the Comb Galleries' rolling floor at
 *   ≈ −13 under ranks of curved chalk fins, the Moonmilk Pools'
 *   luminous bowls, the White Chapel's pearl pan, the Lamp Basin
 *   sinking to −27 under the Lamp, and the Pearl Steps rising toward
 *   the reserved depth-3 gate.
 *
 * Vertical range across the domain ≈ 27 m of terrain (threshold +0.2
 * down to the basin's −27); the combs stand up to 22 m over the
 * gallery floor on top of it.
 */

export const PALE2_SLOT = regionSlot("pale-passage-2");
const CENTER = slotCenter(PALE2_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(PALE2_SLOT.azimuth);
const AXIS_Z = Math.sin(PALE2_SLOT.azimuth);

const SEED = SEEDS.regionPale2;

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
 * The pass tongue. `fromR: 635` reaches thirty metres inside the Bone
 * Meadows' rim (665) so the bounds handover is an overlap, never a gap;
 * `toR: 790` runs it well into our own disc so the max-combine with the
 * disc weight has no waist at the rim crossing.
 */
export const PASS_TONGUE: Tongue = approachTongue(PALE2_SLOT, {
  fromR: 635,
  toR: 790,
  halfWidthFrom: 16,
  halfWidthTo: 56,
});

const DISC = slotDisc(PALE2_SLOT);

/**
 * The threshold gate: our ownership over pale-1's rim is a whisper
 * (0.14) so their milk keeps carrying the shelf, rising to full only
 * past u ≈ 716 where the country is ours alone.
 */
function thresholdGate(u: number): number {
  return 0.14 + 0.86 * smoothstep01((u - 686) / 30);
}

/** Ownership in [0, 1]; exactly 0 outside the disc and the pass tongue. */
export function pale2Weight(x: number, z: number): number {
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
 * How much a point belongs to the inbound pass corridor, in [0, 1] —
 * the smooth gate that keeps the rim fade and the rim ceiling-closure
 * off the Winnow's descent.
 */
export function passGate(u: number, v: number): number {
  const along = 1 - smoothstep01((u - 816) / 26);
  const across = 1 - smoothstep01((Math.abs(v) - (passHalfWidth(Math.min(u, 790)) + 2)) / 14);
  return along * across;
}

/**
 * The depth-3 reservation: the far-rim corridor pale-passage-3's pass
 * tongue will one day occupy (fromR ≈ 1130, thirty metres inside OUR
 * rim, down the same spoke). Our far-rim seal ring and distance rings
 * part over it from draft one — the verdant-2 cut, pre-paid.
 */
export function farGate(u: number, v: number): number {
  const along = smoothstep01((u - 1080) / 30);
  const across = 1 - smoothstep01((Math.abs(v) - 22) / 12);
  return along * across;
}

// ─── The Winnow ─────────────────────────────────────────────────────────────

export const DESCENT_FROM = 748;
export const DESCENT_TO = 812;
/** The six chalk steps: first riser, pitch between risers, drop each. */
const STEP_U0 = 752;
const STEP_PITCH = 10;
const STEP_DROP = 3.3;
const STEP_COUNT = 6;
/** Metres of `u` a riser takes to fall — steep (the verdant-2 lesson:
 *  a run wider than ~3 m melts into a swell under the 2.2 m grid). */
const RISER_RUN = 3.0;

/** Total drop of the Winnow, for the tests and the builders. */
export const DESCENT_TOTAL_DROP = STEP_DROP * STEP_COUNT;

/** The descent channel's lateral wander. */
export function channelCenter(u: number): number {
  const grow = smoothstep01((u - 660) / 90);
  return grow * (6 * Math.sin(u * 0.041 + 1.7) + 3.2 * Math.sin(u * 0.017));
}

/** The descent channel's half-width: a slot that opens as it lands. */
export function channelHalf(u: number): number {
  return 9 + 6.5 * smoothstep01((u - DESCENT_FROM) / (DESCENT_TO - DESCENT_FROM));
}

/**
 * The chalk staircase along the spine: 0 above the first riser,
 * ≈ −19.8 below the last. Also reports how much of the point sits on a
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

/** The `u` of step `i`'s riser foot, for builders placing ledge dressing. */
export function stepFootU(i: number): number {
  return STEP_U0 + i * STEP_PITCH + RISER_RUN;
}

/** The threshold's gentle draw-in: dune level easing toward the descent. */
function thresholdLevel(u: number): number {
  return 0.2 - 2.4 * smoothstep01((u - 690) / 50);
}

/** The pass channel's own floor level at a spoke distance — the paint
 *  and the dressing read bank height against this. */
export function winnowFloor(u: number): number {
  return thresholdLevel(u) + descentDrop(u).level;
}

/** Wall height above the descent channel, both flanks. */
function descentWallHeight(u: number): number {
  return 5 + 4.5 * smoothstep01((u - 726) / 80);
}

/** The pass's own composed floor: threshold, descent, flanking banks. */
function passHeight(x: number, z: number, u: number, v: number): number {
  const drop = descentDrop(u);
  const away = Math.abs(v - channelCenter(u));
  const wall = smoothstep01((away - channelHalf(u)) / 9);
  const wallBand = smoothstep01((u - 711) / 30);
  const detail =
    (fbm(x * 0.023, z * 0.023, { seed: SEED ^ 0x7e01, period: 8, octaves: 2 }) - 0.5) * 0.7;
  const h = thresholdLevel(u) + drop.level + wall * wallBand * descentWallHeight(u) + detail;
  // Beyond the tongue's own width the authored pass returns to dune
  // level: out there the weight is a whisper over zero.
  const inside = 1 - smoothstep01((Math.abs(v) - passHalfWidth(u)) / 16);
  return h * inside;
}

// ─── The disc's sub-biomes ──────────────────────────────────────────────────

/** The Comb Galleries' resting floor — the country's rolling white plain. */
export const GALLERY_FLOOR = -13;

/**
 * The comb fins: swept arcs of standing chalk, the region's exclusive
 * silhouette. Each fin is an arc of `span` radians on a circle of
 * radius `arcR` centred at (u, v), rotated by `yaw`, standing `height`
 * metres over the local floor. The built half raises the walls; the
 * pure half only mounds the ground at their roots.
 */
export interface CombSpec {
  readonly name: string;
  readonly u: number;
  readonly v: number;
  readonly yaw: number;
  readonly arcR: number;
  readonly span: number;
  readonly height: number;
}

export const COMBS: readonly CombSpec[] = [
  // The Comb Gate pair, flanking the Winnow's first steps.
  { name: "gate-west", u: 754, v: -15, yaw: 0.5, arcR: 16, span: 1.15, height: 13 },
  { name: "gate-east", u: 757, v: 17, yaw: 3.7, arcR: 16, span: 1.1, height: 14 },
  // The Winnow's flanking fins, overlapping alternately down the slot.
  { name: "winnow-west", u: 782, v: -19, yaw: 0.35, arcR: 20, span: 1.0, height: 16 },
  { name: "winnow-east", u: 796, v: 21, yaw: 3.55, arcR: 20, span: 0.95, height: 17 },
  // The first gallery rank, opening past the descent's foot.
  { name: "crossing-west", u: 836, v: -34, yaw: 0.7, arcR: 24, span: 1.05, height: 17 },
  { name: "crossing-east", u: 846, v: 30, yaw: 3.9, arcR: 22, span: 0.95, height: 15 },
  { name: "rank1-mid", u: 866, v: -4, yaw: 2.2, arcR: 26, span: 0.9, height: 18 },
  // The second rank, the galleries proper.
  { name: "gallery-south", u: 892, v: -84, yaw: 1.0, arcR: 24, span: 1.0, height: 16 },
  { name: "great-comb", u: 902, v: 8, yaw: 2.5, arcR: 30, span: 1.15, height: 22 },
  { name: "gallery-north", u: 878, v: 46, yaw: 4.2, arcR: 22, span: 0.9, height: 14 },
  { name: "rank2-west", u: 928, v: -96, yaw: 0.8, arcR: 22, span: 0.95, height: 15 },
  // The third rank, leaning over the basin's approach.
  { name: "basin-west", u: 972, v: -52, yaw: 1.2, arcR: 26, span: 1.0, height: 18 },
  { name: "basin-north", u: 986, v: 52, yaw: 4.5, arcR: 24, span: 1.0, height: 17 },
  { name: "steps-comb", u: 1066, v: 40, yaw: 4.3, arcR: 22, span: 0.9, height: 13 },
  { name: "steps-south", u: 1058, v: -58, yaw: 1.1, arcR: 20, span: 0.85, height: 12 },
] as const;

/** The Moonmilk Pools: luminous sunken bowls. The Still Pool is the
 *  registered rest — glass-flat, silent. */
export interface PoolSpec {
  readonly u: number;
  readonly v: number;
  readonly radius: number;
  readonly depth: number;
  readonly rest?: boolean;
}

export const POOLS: readonly PoolSpec[] = [
  { u: 895, v: -55, radius: 10, depth: -18.5 },
  { u: 927, v: -34, radius: 7.5, depth: -17.5 },
  { u: 958, v: -64, radius: 12, depth: -19.5 },
  { u: 872, v: -84, radius: 9, depth: -17, rest: true },
] as const;

/** THE WHITE CHAPEL: the fin ring around the bare pearl pan — the
 *  strictest hush in the game. */
export const CHAPEL = { u: 905, v: 74, radius: 30 } as const;
export const CHAPEL_FLOOR = -9.5;

/** The Lamp Basin: the crater the Lamp stands in. */
export const LAMP_BASIN = { u: 1022, v: -4, radius: 52 } as const;
export const BASIN_FLOOR = -27;

/** THE LAMP itself: the hollow lantern-spire at the basin's heart. */
export const LAMP = { u: 1022, v: -4, height: 25 } as const;

/** The Pearl Steps: three chalk terraces rising toward the far gate. */
export const STEPS_FROM = 1075;
export const STEPS_TO = 1135;

/** The Far Gate needles framing the reserved depth-3 corridor. */
export const FAR_GATE = { u: 1128, v: 14 } as const;

/**
 * The protected stillness registry entries this region contributes to
 * MASTER §1.2 (see the ledger). Every instanced kit scatter, shoal
 * route and fauna anchor keeps out; the licensed exceptions are stated
 * per rest in the ledger.
 */
export const RESTS = {
  /** THE WHITE CHAPEL: nothing moves but its one beam; no fauna, no
   *  scatter, no motes inside the fin ring. */
  chapel: { u: CHAPEL.u, v: CHAPEL.v, radius: 26 },
  /** The Still Pool: a glass-flat pearl floor; nothing. Round 4: the
   *  gate radius widened past the bowl (9 → 12.5) — a legal sunGlow
   *  sprig stood at the lip and drew the eye in the hush. */
  stillPool: { u: 872, v: -84, radius: 12.5 },
  /** The Winnow Shadow: the slot's dark breath — motes only. */
  winnowShadow: { fromU: 776, toU: 800 },
} as const;

/** 1 outside every rest, easing to 0 inside — the shared stillness gate. */
export function stillnessGate(u: number, v: number): number {
  let gate = 1;
  for (const rest of [RESTS.chapel, RESTS.stillPool]) {
    const d = Math.hypot(u - rest.u, v - rest.v);
    gate *= smoothstep01((d - rest.radius) / 4);
  }
  if (u > RESTS.winnowShadow.fromU - 3 && u < RESTS.winnowShadow.toU + 3) {
    const inside =
      smoothstep01((u - (RESTS.winnowShadow.fromU - 3)) / 4) *
      (1 - smoothstep01((u - RESTS.winnowShadow.toU) / 4));
    const nearChannel = 1 - smoothstep01((Math.abs(v - channelCenter(u)) - channelHalf(u)) / 4);
    gate *= 1 - inside * nearChannel;
  }
  return gate;
}

/**
 * THE STORY, as one pure number: how near the Lamp the light feels.
 * 0 at the threshold (the Bone Meadows' milk carried across), 1 in the
 * Lamp Basin. Ground warmth, fan density, anemone glow and the tests
 * all read this single gradient; the White Chapel is held COOL by hand
 * — its austerity is authored, not an accident of the ramp.
 */
export function lumen(u: number, v: number): number {
  let k = smoothstep01((u - 820) / 180);
  const basinD = Math.hypot(u - LAMP_BASIN.u, v - LAMP_BASIN.v);
  k = Math.min(1, k + (1 - smoothstep01((basinD - 18) / 34)) * 0.3);
  const chapelD = Math.hypot(u - CHAPEL.u, v - CHAPEL.v);
  k *= 1 - (1 - smoothstep01((chapelD - 22) / 36)) * 0.6;
  return k;
}

/**
 * The road's spine, for builders and the walk-line paint: the channel
 * through the pass, then a gentle S through the gallery slots toward
 * the basin heart and the Pearl Steps.
 */
export function roadCenter(u: number): number {
  if (u < 830) {
    return channelCenter(u);
  }
  const s = smoothstep01((u - 830) / 170);
  return channelCenter(830) * (1 - s) + (-4 + 10 * Math.sin((u - 830) * 0.02)) * s;
}

/** The root mounds under the comb fins — pillars grow FROM the ground. */
export function combMound(u: number, v: number): number {
  let mound = 0;
  for (const comb of COMBS) {
    const d = Math.hypot(u - comb.u, v - comb.v) - comb.arcR;
    if (Math.abs(d) < 14) {
      mound = Math.max(mound, (1 - smoothstep01((Math.abs(d) - 2.5) / 10)) * 1.3);
    }
  }
  return mound;
}

/** How much of the chapel pan owns a spoke point, in [0, 1]. */
export function chapelWeight(u: number, v: number): number {
  const d = Math.hypot(u - CHAPEL.u, v - CHAPEL.v);
  return 1 - smoothstep01((d - 16) / 18);
}

/** How much of the Lamp Basin owns a spoke point, in [0, 1]. */
export function basinWeight(u: number, v: number): number {
  const d = Math.hypot(u - LAMP_BASIN.u, v - LAMP_BASIN.v);
  return 1 - smoothstep01((d - 14) / (LAMP_BASIN.radius - 10));
}

function discHeight(x: number, z: number, u: number, v: number): number {
  // The Comb Galleries carry the disc: pale rolling ground, a step
  // bolder than the Bone Meadows' so the fin roots read as country.
  let h =
    GALLERY_FLOOR +
    (fbm(x * 0.013, z * 0.013, { seed: SEED ^ 0x7e02, period: 6, octaves: 2 }) - 0.5) * 3.2 +
    (fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x7e03, period: 9, octaves: 2 }) - 0.5) * 1.0;

  // The fin roots rise in gentle mounds.
  h += combMound(u, v);

  // The Moonmilk Pools: luminous bowls with a soft raised lip.
  for (const pool of POOLS) {
    const d = Math.hypot(u - pool.u, v - pool.v);
    if (d < pool.radius * 2.4) {
      const bowl = 1 - smoothstep01((d - pool.radius * 0.5) / (pool.radius * 0.8));
      h += bowl * (pool.depth - h);
      h +=
        0.55 *
        smoothstep01((d - pool.radius * 0.9) / 3) *
        (1 - smoothstep01((d - pool.radius * 1.6) / 4));
    }
  }

  // The White Chapel: a raised pearl pan flattened almost smooth —
  // austerity is a value here, and flatness is most of it.
  const chapel = chapelWeight(u, v);
  if (chapel > 0) {
    const pan =
      CHAPEL_FLOOR +
      (fbm(x * 0.013, z * 0.013, { seed: SEED ^ 0x7e04, period: 5, octaves: 2 }) - 0.5) * 0.5;
    h += chapel * (pan - h);
  }

  // The Lamp Basin, last so its depth wins its own heart: a wide
  // crater with a soft rim lip, sinking to the region's deepest floor
  // under the Lamp.
  const basinD = Math.hypot(u - LAMP_BASIN.u, v - LAMP_BASIN.v);
  if (basinD < LAMP_BASIN.radius * 1.5) {
    const bowl = BASIN_FLOOR + 9 * smoothstep01((basinD - 10) / 34);
    const inside = 1 - smoothstep01((basinD - 14) / (LAMP_BASIN.radius - 12));
    h += inside * (bowl - h);
    // The rim lip the lantern gardens crest over.
    h += 0.9 * smoothstep01((basinD - 40) / 8) * (1 - smoothstep01((basinD - 54) / 10));
  }

  // The Pearl Steps: three low terraces rising toward the far gate.
  if (u > STEPS_FROM - 10) {
    const rise = smoothstep01((u - STEPS_FROM) / (STEPS_TO - STEPS_FROM));
    let terraces = 0;
    for (const at of [1084, 1102, 1120]) {
      terraces += 2.2 * smoothstep01((u - at) / 2.6);
    }
    const stepsLevel = GALLERY_FLOOR + 0.4 + terraces;
    const own = smoothstep01((u - (STEPS_FROM - 10)) / 18) * (1 - basinWeight(u, v));
    h += own * (stepsLevel - h) * Math.max(rise, 0.35);
  }

  // Ground life at the scale the sheets can carry.
  h += (fbm(x * 0.024, z * 0.024, { seed: SEED ^ 0x7e05, period: 9, octaves: 2 }) - 0.5) * 0.6;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. The threshold and
 * the Winnow run the pass; the disc height takes over across the
 * descent's foot; and the whole answer eases back to dune level across
 * the disc's far feather (gated off the inbound pass corridor) so the
 * composed ground and this target agree wherever the diver can be.
 */
export function pale2TerrainTarget(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

  let h: number;
  if (u < DESCENT_TO - 20) {
    h = passHeight(x, z, u, v);
  } else if (u < DESCENT_TO + 26) {
    const s = smoothstep01((u - (DESCENT_TO - 20)) / 46);
    const pass = passHeight(x, z, u, v);
    h = pass + s * (discHeight(x, z, u, v) - pass);
  } else {
    h = discHeight(x, z, u, v);
  }

  // The rim fade: authored ground returns to dune level before the
  // weight feather ends — except along the inbound pass corridor,
  // which crosses the near rim and must not fade. The far rim's climb
  // is the Pearl Rampart, the world's last white wall, and the ground
  // paint dresses it as one; the depth-3 corridor keeps the same
  // dune-level crest (the handover shape pale-1 gave us).
  const fade = 1 - smoothstep01((rc - 172) / 38) * (1 - passGate(u, v));
  return h * fade;
}

// ─── The ceiling ────────────────────────────────────────────────────────────

/**
 * Swim ceiling: 3.8 m over the threshold crest (meeting the Bone
 * Meadows' closed far rim), vaulting to ~12 down into the Winnow, then
 * easing to 10 over the country (the paper-light presses close — the
 * floor lives at −13 to −27, so that is still 23–37 m of water), and
 * closing to 3.4 at the disc's far rim (gated off the inbound pass
 * only; the reserved depth-3 corridor keeps the same low crest crawl
 * pale-1's rim gave us — the standard handover shape).
 */
export function pale2Ceiling(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 3.8 + 8.2 * smoothstep01((u - 690) / 70);

  // The country's ease: the milk presses a step lower than the pass vault.
  c += (10 - c) * smoothstep01((u - 800) / 60);

  // The rim closure, gated off the inbound pass corridor.
  c += (3.4 - c) * smoothstep01((rc - 186) / 26) * (1 - passGate(u, v));
  return c;
}
