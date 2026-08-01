import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";

/**
 * THE LANTERN VIGIL — the pure half. Every function here is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 2.79) in metres from the
 * world origin; `v` is lateral, positive counterclockwise. The disc's
 * heart is at u = 1460, v = 0; the disc spans u 1240 → 1680. This is
 * the Smoking Marches' LAST chamber — the far side of the Forge Combs'
 * Night Door, and the answer to the province's whole arc. The Smoulder
 * Fields were the fire's doorstep; the Forge Combs its workshop; here
 * the darkness above finally arrives in full — the province's true
 * night — and the fire's purpose is revealed: it has been climbing all
 * this way to make LIGHT. Basalt-glass lantern spires (the forge's
 * work) stand in ranks along one last ember seam — THE LAST WICK —
 * which crosses the night country to THE MORNING VENT, the great
 * chimney at the world's end where the heat finally reaches the sky
 * and the province makes itself a dawn.
 *
 * The inbound connection is the depth-2 → depth-3 pass under the Forge
 * Combs' Night Door: their disc ends at u ≈ 1160, ours begins at 1240,
 * so the pass tongue starts at u = 1130 — thirty metres *inside* their
 * rim — and the two domains genuinely overlap (the Canopy Deep's
 * device, third use). Three bands:
 *
 * - **The Night Threshold** (u 1130 → 1245): a dark glass shelf at
 *   dune level under the Night Door's leaning fins. Our weight is a
 *   whisper (the threshold gate below): the Forge Combs still own the
 *   water and the terrain, we own only the bounds — and the gate hides
 *   the framework's depth-boundary reject circle (`RegionField`
 *   consults us only within 260 m of our centre, u ≥ ~1200): out there
 *   our target is held at dune level, so the step at the reject circle
 *   is centimetres. The corridor threads the Night Door pair at
 *   (1116, ±14): the channel keeps |v| < 5 through u 1100–1140, inside
 *   the clear lane their ledger reserved (|v| < 11, u 1080–1160).
 * - **The Nightfall Stair** (u 1252 → 1308): the pass is a place —
 *   five dark benches falling ~17 m out of the Combs' register into
 *   the night country, each riser seamed with the wick's first embers.
 * - **The country** (the disc): the Lantern Rows' plain at ≈ −17, the
 *   Ember Fens' pooled amber south at −19, the Ash Veil's pale raised
 *   drifts north at −9, the Cradle's warm garden basin at −22 (the
 *   deepest floor), and the Morning Vent's forecourt rising at the far
 *   pole.
 *
 * Vertical terrain range across the domain ≈ 22 m in the disc alone
 * (the Veil's drift crowns ≈ −4 down to the Cradle springs' −26; the
 * test holds ≥ 20, and the threshold's +0.2 sits besides) — and the built
 * lanterns and the Vent add 10–24 m of standing glass above their
 * floors.
 */

export const SMOKING3_SLOT = regionSlot("smoking-marches-3");
const CENTER = slotCenter(SMOKING3_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(SMOKING3_SLOT.azimuth);
const AXIS_Z = Math.sin(SMOKING3_SLOT.azimuth);

const SEED = SEEDS.regionSmoking3;

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
 * The pass tongue. `fromR: 1130` reaches thirty metres inside the Forge
 * Combs' rim (1160) so the bounds handover is an overlap, never a gap;
 * `toR: 1300` runs it well into our own disc so the max-combine with
 * the disc weight has no waist at the rim crossing. `halfWidthFrom: 12`
 * keeps the mouth narrow enough to thread the Night Door pair.
 */
export const PASS_TONGUE: Tongue = approachTongue(SMOKING3_SLOT, {
  fromR: 1130,
  toR: 1300,
  halfWidthFrom: 12,
  halfWidthTo: 52,
});

const DISC = slotDisc(SMOKING3_SLOT);

/**
 * The threshold gate: our ownership under the Night Door is a whisper
 * (0.14) so the Forge Combs' terrain, mood and paint keep carrying the
 * shelf, rising to full only past u ≈ 1236 where the night country is
 * ours alone.
 */
function thresholdGate(u: number): number {
  return 0.14 + 0.86 * smoothstep01((u - 1206) / 30);
}

/** Ownership in [0, 1]; exactly 0 outside the disc and the pass tongue. */
export function smoking3Weight(x: number, z: number): number {
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
 * Nightfall Stair's descent.
 */
export function passGate(u: number, v: number): number {
  const along = 1 - smoothstep01((u - 1312) / 26);
  const across = 1 - smoothstep01((Math.abs(v) - (passHalfWidth(Math.min(u, 1300)) + 2)) / 14);
  return along * across;
}

// ─── The Night Threshold and the Nightfall Stair ────────────────────────────

export const DESCENT_FROM = 1252;
export const DESCENT_TO = 1308;
/** The five night benches: first riser, pitch between risers, drop each. */
const STEP_U0 = 1256;
const STEP_PITCH = 10;
const STEP_DROP = 3.4;
const STEP_COUNT = 5;
/** Metres of `u` a riser takes to fall — steep, ember-seamed (the
 *  verdant-2 lesson: a run wider than ~3 m melts into a swell). */
const RISER_RUN = 3.0;

/** Total drop of the Nightfall Stair, for the tests and the builders. */
export const DESCENT_TOTAL_DROP = STEP_DROP * STEP_COUNT;

/**
 * The pass channel's lateral wander. Held near zero through the Night
 * Door's fins (u 1100–1140, clear lane |v| < 11) and gentle after —
 * this is a doorway, then a road.
 */
export function channelCenter(u: number): number {
  const grow = smoothstep01((u - 1150) / 80);
  return grow * (4.5 * Math.sin(u * 0.031 + 0.6) + 2.2 * Math.sin(u * 0.014));
}

/** The pass channel's half-width: a narrow door opening to a way. */
export function channelHalf(u: number): number {
  return 6 + 7 * smoothstep01((u - DESCENT_FROM) / (DESCENT_TO - DESCENT_FROM));
}

/**
 * The night staircase along the spine: 0 above the first riser,
 * ≈ −17 below the last. Also reports how much of the point sits on a
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

/** The threshold's gentle draw-in: dune level easing toward the stair.
 *  Held within ±1.2 m of dune below u 1200 (the reject-circle device). */
function thresholdLevel(u: number): number {
  return 0.2 - 2.0 * smoothstep01((u - 1210) / 44);
}

/** Wall height above the pass channel, both flanks. */
function channelWallHeight(u: number): number {
  return 4 + 4.5 * smoothstep01((u - 1235) / 60);
}

/** The pass's own composed floor: threshold, stair, flanking shoulders. */
function passHeight(x: number, z: number, u: number, v: number): number {
  const drop = descentDrop(u);
  const away = Math.abs(v - channelCenter(u));
  const wall = smoothstep01((away - channelHalf(u)) / 9);
  const wallBand = smoothstep01((u - 1222) / 32);
  const detail =
    (fbm(x * 0.023, z * 0.023, { seed: SEED ^ 0x3c01, period: 8, octaves: 2 }) - 0.5) * 0.7;
  const h = thresholdLevel(u) + drop.level + wall * wallBand * channelWallHeight(u) + detail;
  // Beyond the tongue's own width the authored pass returns to dune
  // level: out there the weight is a whisper over zero.
  const inside = 1 - smoothstep01((Math.abs(v) - passHalfWidth(u)) / 16);
  return h * inside;
}

// ─── The disc's sub-biomes ──────────────────────────────────────────────────

/** The Lantern Rows' resting plain — the night country's dark floor. */
export const ROWS_FLOOR = -17;

/** The Ember Fens: pooled amber south of the road — the province's
 *  signature at its strongest. */
export const FENS = { u: 1430, v: -95, radius: 78 } as const;
const FENS_FLOOR = -19;

/** The Ash Veil: pale raised drift country north of the road, under a
 *  slow fall of warm ash — the region's tender register. */
export const VEIL = { u: 1478, v: 105, radius: 88 } as const;
const VEIL_FLOOR = -8;

/** The Cradle: the warm garden basin the fire keeps — the deepest floor. */
export const CRADLE = { u: 1560, v: 42, radius: 56 } as const;
export const CRADLE_FLOOR = -22;

/** The Morning Vent: the great chimney at the far pole, and its
 *  forecourt rise — where the Last Wick ends and the light goes up. */
export const VENT = { u: 1612, v: -10 } as const;

/**
 * The Last Wick: the region's road — one final ember seam leaving the
 * stair's foot and crossing the whole country to the Vent. The centre
 * line, half-width and presence are the one truth the terrain, paint,
 * light, fills and tests all read.
 */
export const WICK_FROM = 1310;
export const WICK_TO = 1622;

export function wickCenter(u: number): number {
  const grow = smoothstep01((u - 1308) / 36);
  const base = grow * (9 * Math.sin((u - 1300) * 0.019) + 3.5 * Math.sin((u - 1300) * 0.0085 + 0.9));
  // The last reach bends to the Vent's forecourt.
  const pull = smoothstep01((u - 1560) / 55);
  return base * (1 - pull) + -9 * pull;
}

export function wickHalf(u: number): number {
  return 4.5 + 1.5 * smoothstep01((u - 1380) / 160);
}

/** How much a spoke point sits in the Last Wick's road band, in [0, 1]. */
export function wickWeight(u: number, v: number): number {
  if (u < WICK_FROM - 8 || u > WICK_TO + 14) {
    return 0;
  }
  const enter = smoothstep01((u - (WICK_FROM - 8)) / 20);
  const exit = 1 - smoothstep01((u - (WICK_TO - 8)) / 20);
  const across =
    1 - smoothstep01((Math.abs(v - wickCenter(u)) - wickHalf(u) * 0.5) / (wickHalf(u) * 0.85));
  return enter * exit * across;
}

/** How much of the Ember Fens owns a spoke point, in [0, 1]. */
export function fensWeight(u: number, v: number): number {
  const d = Math.hypot(u - FENS.u, v - FENS.v);
  return 1 - smoothstep01((d / FENS.radius - 0.25) / 0.75);
}

/** How much of the Ash Veil owns a spoke point, in [0, 1]. */
export function veilWeight(u: number, v: number): number {
  const d = Math.hypot(u - VEIL.u, v - VEIL.v);
  return 1 - smoothstep01((d / VEIL.radius - 0.25) / 0.75);
}

/** How much of the Cradle basin owns a spoke point, in [0, 1]. */
export function cradleWeight(u: number, v: number): number {
  const d = Math.hypot(u - CRADLE.u, v - CRADLE.v);
  return 1 - smoothstep01((d / CRADLE.radius - 0.25) / 0.75);
}

/**
 * The amber pools: sunk warm bowls where the mottle's heat gathers —
 * the Fens' chain plus the Cradle's two garden springs. One table read
 * by the terrain, the paint, the light and the tests.
 */
export interface PoolSpec {
  readonly u: number;
  readonly v: number;
  readonly radius: number;
  readonly depth: number;
  /** Cradle springs read warm-pale; fen pools read amber-dark. */
  readonly cradle?: boolean;
}

export const POOLS: readonly PoolSpec[] = [
  { u: 1408, v: -78, radius: 6, depth: -20.6 },
  { u: 1432, v: -102, radius: 7, depth: -21.2 },
  { u: 1454, v: -82, radius: 5.5, depth: -20.4 },
  { u: 1420, v: -124, radius: 5, depth: -20.6 },
  { u: 1446, v: -58, radius: 4.5, depth: -20.0 },
  { u: 1552, v: 32, radius: 5, depth: -25.8, cradle: true },
  { u: 1570, v: 52, radius: 6, depth: -26.0, cradle: true },
] as const;

/**
 * The lantern spires: the region's exclusive — hollow basalt-glass
 * lanterns the forge's heat grew and lit from inside. Feet welt the
 * terrain (the walls grow FROM the ground); the built half draws the
 * glass. `lit: false` is the Cold Lantern — the one the fire never
 * reached, standing in its own registered rest.
 */
export interface LanternSpec {
  readonly name: string;
  readonly u: number;
  readonly v: number;
  readonly height: number;
  readonly radius: number;
  readonly lit: boolean;
}

export const LANTERNS: readonly LanternSpec[] = [
  // The Watch Lantern: the first thing of ours the fog gives up.
  { name: "watch", u: 1330, v: -6, height: 11, radius: 2.0, lit: true },
  // The Lantern Rows, either side of the road.
  { name: "row-west", u: 1372, v: 25, height: 13, radius: 2.2, lit: true },
  { name: "row-east", u: 1394, v: -1, height: 15, radius: 2.4, lit: true },
  // The Choir: three lanterns around a court the road crosses.
  { name: "choir-north", u: 1418, v: 22, height: 14, radius: 2.2, lit: true },
  { name: "choir-south", u: 1428, v: -6, height: 17, radius: 2.5, lit: true },
  { name: "choir-east", u: 1444, v: 28, height: 12, radius: 2.0, lit: true },
  // The Evensong: the tallest lantern in the province.
  { name: "evensong", u: 1494, v: 34, height: 19, radius: 2.8, lit: true },
  // The flank sentinels: the fens' and the veil's own lights.
  { name: "fen-sentinel", u: 1462, v: -52, height: 13, radius: 2.3, lit: true },
  { name: "veil-lantern", u: 1452, v: 74, height: 12, radius: 2.1, lit: true },
  // The Cradle's pair, flanking the garden.
  { name: "cradle-west", u: 1540, v: 58, height: 10, radius: 1.9, lit: true },
  { name: "cradle-east", u: 1576, v: 30, height: 11, radius: 2.0, lit: true },
  // The Last Lantern, beside the Vent's forecourt.
  { name: "last", u: 1600, v: -24, height: 14, radius: 2.3, lit: true },
  // THE COLD LANTERN — unlit, alone in the ash; its rest is registered.
  { name: "cold", u: 1432, v: 130, height: 12, radius: 2.2, lit: false },
] as const;

/** The Spilt Light: the fallen lantern lying at the fens' north-east
 *  hem, its light pooled where the glass broke. */
export const SPILT = { tailU: 1512, tailV: -66, headU: 1526, headV: -54 } as const;

/** The terrain welt under every lantern foot and the Vent's seat. */
export function lanternMound(u: number, v: number): number {
  let mound = 0;
  for (const lantern of LANTERNS) {
    const d = Math.hypot(u - lantern.u, v - lantern.v);
    if (d < 9) {
      mound = Math.max(mound, (1 - smoothstep01((d - lantern.radius * 0.8) / 7)) * 1.5);
    }
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
  /** The Cold Lantern's ash circle: the unlit lantern is the room's
   *  whole composition; ash falls at a quarter density; nothing else. */
  coldLantern: { u: 1432, v: 130, radius: 11 },
  /** The Fen Hush: a bare dark mottle pocket at the fens' south rim. */
  fenHush: { u: 1402, v: -138, radius: 12 },
  /** The Morning Shadow: the lee floor behind the Vent, off the road. */
  morningShadow: { u: 1642, v: 14, radius: 10 },
} as const;

/** 1 outside every rest, easing to 0 inside — the shared stillness gate. */
export function stillnessGate(u: number, v: number): number {
  let gate = 1;
  for (const rest of [RESTS.coldLantern, RESTS.fenHush, RESTS.morningShadow]) {
    const d = Math.hypot(u - rest.u, v - rest.v);
    gate *= smoothstep01((d - rest.radius) / 4);
  }
  return gate;
}

function discHeight(x: number, z: number, u: number, v: number): number {
  // The Lantern Rows' plain carries the disc: dark night swells.
  let h =
    ROWS_FLOOR +
    (fbm(x * 0.013, z * 0.013, { seed: SEED ^ 0x3c02, period: 6, octaves: 2 }) - 0.5) * 2.4 +
    (fbm(x * 0.031, z * 0.031, { seed: SEED ^ 0x3c03, period: 9, octaves: 2 }) - 0.5) * 0.8;

  // The lantern-foot welts: the glass grows FROM the ground.
  h += lanternMound(u, v);

  // The Ember Fens: a slightly sunk warm mottle plain.
  const fens = fensWeight(u, v);
  if (fens > 0) {
    const floorDetail =
      (fbm(x * 0.026, z * 0.026, { seed: SEED ^ 0x3c04, period: 8, octaves: 2 }) - 0.5) * 1.2;
    h += fens * (FENS_FLOOR + floorDetail - h);
  }

  // The Ash Veil: raised pale drift country — long soft dunes of
  // settled ash, bosses drawn at the scale the sheets can carry.
  const veil = veilWeight(u, v);
  if (veil > 0) {
    const drift =
      Math.max(
        0,
        fbm(x * 0.041, z * 0.041, { seed: SEED ^ 0x3c05, period: 11, octaves: 2 }) - 0.36,
      ) * 5.5;
    h += veil * (VEIL_FLOOR + drift - h);
  }

  // The Cradle: the warm garden basin, the region's deep.
  const cradle = cradleWeight(u, v);
  if (cradle > 0) {
    const floorDetail =
      (fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x3c06, period: 10, octaves: 2 }) - 0.5) * 1.2;
    h += cradle * (CRADLE_FLOOR + floorDetail - h);
  }

  // The amber pools: sunk warm bowls with soft raised lips.
  for (const pool of POOLS) {
    const d = Math.hypot(u - pool.u, v - pool.v);
    if (d < pool.radius * 2.4) {
      const bowl = 1 - smoothstep01((d - pool.radius * 0.5) / (pool.radius * 0.8));
      h += bowl * (pool.depth - h);
      h +=
        0.5 *
        smoothstep01((d - pool.radius * 0.9) / 3) *
        (1 - smoothstep01((d - pool.radius * 1.6) / 4));
    }
  }

  // The Last Wick: a shallow seam channel — the road is drawn in heat,
  // one thread of it now, with soft raised lips.
  const wick = wickWeight(u, v);
  if (wick > 0) {
    h += wick * -1.8;
  }
  const wickD = Math.abs(v - wickCenter(u));
  if (u > WICK_FROM - 8 && u < WICK_TO + 14) {
    h +=
      0.45 *
      smoothstep01((wickD - wickHalf(u) * 0.9) / 2.2) *
      (1 - smoothstep01((wickD - wickHalf(u) * 1.7) / 4));
  }

  // The Morning Vent's forecourt: the ground gathers toward the chimney.
  const ventD = Math.hypot(u - VENT.u, v - VENT.v);
  if (ventD < 34) {
    h += (1 - smoothstep01((ventD - 9) / 22)) * 3.2;
  }

  // Ground life at the scale the sheets can carry.
  h += (fbm(x * 0.027, z * 0.027, { seed: SEED ^ 0x3c07, period: 9, octaves: 2 }) - 0.5) * 0.7;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. The threshold and
 * the Nightfall Stair run the pass; the disc height takes over across
 * the stair's foot; and the whole answer eases back to dune level
 * across the disc's far feather (gated off the pass corridor) so the
 * composed ground and this target agree wherever the diver can be.
 */
export function smoking3TerrainTarget(x: number, z: number): number {
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
 * Swim ceiling: 3.8 m over the Night Threshold (dipping under the Forge
 * Combs' closed far rim across the overlap — the verdant-3 precedent,
 * no reciprocal ceiling cut needed), vaulting to ~12 down the Nightfall
 * Stair, opening to 26 over the night country — the lantern crowns and
 * the Morning Column want the head-room — and closing to 3.4 at the
 * disc's far rim (gated off the pass) so one ring of collider stacks
 * seals the world's edge floor to ceiling. This is the spoke's
 * terminus: there is no outbound reservation.
 */
export function smoking3Ceiling(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 3.8 + 8.2 * smoothstep01((u - 1180) / 70);

  // The vault over the night country.
  c += (26 - c) * smoothstep01((u - 1316) / 70);

  // The rim closure, gated off the pass corridor.
  c += (3.4 - c) * smoothstep01((rc - 186) / 26) * (1 - passGate(u, v));
  return c;
}
