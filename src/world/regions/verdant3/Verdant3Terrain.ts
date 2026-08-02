import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";

/**
 * THE CANOPY DEEP — the pure half. Every function here is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 1.35) in metres from the
 * world origin; `v` is lateral, positive counterclockwise. The disc's
 * heart is at u = 1460, v = 0; the disc spans u 1240 → 1680. This is
 * the province's LAST chamber — the game's first depth-3 region — and
 * the primeval heart the kelp sea grew from: older than the terraces,
 * deeper than the forest, the green going toward blue-dark and the
 * light arriving in cathedral shafts from a canopy so high it reads as
 * sky.
 *
 * The inbound connection is the depth-2 → depth-3 pass from the Emerald
 * Terraces' far rim: their disc ends at u ≈ 1160, ours begins at 1240,
 * so the pass tongue starts at u = 1130 — thirty metres *inside* their
 * rim — and the two domains genuinely overlap. Three bands:
 *
 * - **The Last Rampart** (u 1130 → 1245): a milky crest shelf at dune
 *   level over the terraces' own rampart. Our weight is a whisper (the
 *   threshold gate below): the terraces still own the water and the
 *   terrain, we own only the bounds — and the gate hides the
 *   framework's depth-boundary reject circle (`RegionField` consults us
 *   only within 260 m of our centre, u ≥ ~1200): out there our target
 *   is held at dune level, so the step at the reject circle is
 *   centimetres (the verdant-2 device, reused at the next boundary out).
 * - **The Boughfall** (u 1252 → 1312): the pass is a place — a rooted
 *   descent under the first over-arching crowns, six great root-steps
 *   down ~25 m in a walled green cleft.
 * - **The country** (the disc): the Shade Meadows floor at ≈ −34, the
 *   Mesa Pillars rising 28–38 m to their hanging-garden crowns, the
 *   Wellsprings' cool pools at their roots, the Old Canopy overhead,
 *   and the Province's End rise looking into the painted distance that
 *   closes the Verdant Line.
 *
 * Vertical range across the domain ≈ 42 m (threshold +0.2 down to the
 * Clearwater's −40.5; the test holds ≥ 35).
 */

export const VERDANT3_SLOT = regionSlot("verdant-line-3");
const CENTER = slotCenter(VERDANT3_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(VERDANT3_SLOT.azimuth);
const AXIS_Z = Math.sin(VERDANT3_SLOT.azimuth);

const SEED = SEEDS.regionVerdant3;

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
 * The pass tongue. `fromR: 1130` reaches thirty metres inside the
 * Emerald Terraces' rim (1160) so the bounds handover is an overlap,
 * never a gap; `toR: 1300` runs it well into our own disc so the
 * max-combine with the disc weight has no waist at the rim crossing.
 */
export const PASS_TONGUE: Tongue = approachTongue(VERDANT3_SLOT, {
  fromR: 1130,
  toR: 1300,
  halfWidthFrom: 16,
  halfWidthTo: 56,
});

const DISC = slotDisc(VERDANT3_SLOT);

/**
 * The threshold gate: our ownership over the terraces' rim is a whisper
 * (0.14) so their terrain, mood and paint keep carrying the shelf,
 * rising to full only past u ≈ 1236 where the country is ours alone.
 */
function thresholdGate(u: number): number {
  return 0.14 + 0.86 * smoothstep01((u - 1206) / 30);
}

/** Ownership in [0, 1]; exactly 0 outside the disc and the pass tongue. */
export function verdant3Weight(x: number, z: number): number {
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
 * Boughfall's descent.
 */
export function passGate(u: number, v: number): number {
  const along = 1 - smoothstep01((u - 1306) / 26);
  const across = 1 - smoothstep01((Math.abs(v) - (passHalfWidth(Math.min(u, 1300)) + 2)) / 14);
  return along * across;
}

// ─── The Boughfall ──────────────────────────────────────────────────────────

export const DESCENT_FROM = 1252;
export const DESCENT_TO = 1312;
/** The six great root-steps: first riser, pitch between risers, drop each. */
const STEP_U0 = 1256;
const STEP_PITCH = 10;
const STEP_DROP = 4.1;
const STEP_COUNT = 6;
/** Metres of `u` a riser takes to fall — steep, root-laced (the verdant-2
 *  lesson: a run wider than ~3 m melts into a swell under the 2.2 m grid). */
const RISER_RUN = 3.0;

/** Total drop of the Boughfall, for the tests and the builders. */
export const DESCENT_TOTAL_DROP = STEP_DROP * STEP_COUNT;

/** The descent channel's lateral wander. */
export function channelCenter(u: number): number {
  const grow = smoothstep01((u - 1160) / 90);
  return grow * (6 * Math.sin(u * 0.043 + 2.1) + 3.2 * Math.sin(u * 0.019));
}

/** The descent channel's half-width: a broad processional way. */
export function channelHalf(u: number): number {
  return 9.5 + 6 * smoothstep01((u - DESCENT_FROM) / (DESCENT_TO - DESCENT_FROM));
}

/**
 * The rooted staircase along the spine: 0 above the first riser,
 * ≈ −24.6 below the last. Also reports how much of the point sits on a
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
  return 0.2 - 2.4 * smoothstep01((u - 1190) / 50);
}

/** Wall height above the descent channel, both flanks. */
function descentWallHeight(u: number): number {
  return 5 + 4.5 * smoothstep01((u - 1230) / 80);
}

/** The pass's own composed floor: threshold, descent, flanking walls. */
function passHeight(x: number, z: number, u: number, v: number): number {
  const drop = descentDrop(u);
  const away = Math.abs(v - channelCenter(u));
  const wall = smoothstep01((away - channelHalf(u)) / 9);
  const wallBand = smoothstep01((u - 1215) / 30);
  const detail =
    (fbm(x * 0.023, z * 0.023, { seed: SEED ^ 0x7e01, period: 8, octaves: 2 }) - 0.5) * 0.7;
  const h = thresholdLevel(u) + drop.level + wall * wallBand * descentWallHeight(u) + detail;
  // Beyond the tongue's own width the authored pass returns to dune
  // level: out there the weight is a whisper over zero.
  const inside = 1 - smoothstep01((Math.abs(v) - passHalfWidth(u)) / 16);
  return h * inside;
}

// ─── The disc's sub-biomes ──────────────────────────────────────────────────

/** The Shade Meadows' resting floor — the country's deep green plain. */
export const SHADE_FLOOR = -34;

/** The Mesa Pillars: foot position, column height, foot radius. The
 *  crowns carry the hanging gardens; the skyline is composed from every
 *  zone — this is the promise verdant-2's Far Balcony painted, kept. */
export interface MesaSpec {
  readonly name: string;
  readonly u: number;
  readonly v: number;
  readonly height: number;
  readonly footR: number;
  readonly hollow?: boolean;
}

export const MESAS: readonly MesaSpec[] = [
  { name: "doorwarden", u: 1332, v: 42, height: 30, footR: 7.2 },
  { name: "twin-west", u: 1448, v: -34, height: 34, footR: 8.2 },
  { name: "twin-east", u: 1478, v: 8, height: 33, footR: 7.6 },
  { name: "kingpillar", u: 1520, v: 66, height: 38, footR: 9.2 },
  { name: "hollow", u: 1418, v: -92, height: 30, footR: 8.0, hollow: true },
  { name: "south-watcher", u: 1552, v: -84, height: 28, footR: 6.8 },
  { name: "rimward", u: 1588, v: 44, height: 26, footR: 6.4 },
] as const;

/** The Wellsprings: upwelling pools at the mesa roots. The Kingpillar's
 *  pool is THE CLEARWATER — a registered rest (the shaft and its pool
 *  are the room's only light and motion). */
export interface WellspringSpec {
  readonly u: number;
  readonly v: number;
  readonly radius: number;
  readonly depth: number;
  readonly rest?: boolean;
}

export const WELLSPRINGS: readonly WellspringSpec[] = [
  { u: 1390, v: -18, radius: 9, depth: -39.5 },
  { u: 1408, v: 34, radius: 7, depth: -38.5 },
  { u: 1512, v: 58, radius: 10, depth: -40.5, rest: true },
] as const;

/** The Sunfall Well: the great canopy gap at the Twin Court where the
 *  region's largest shaft falls; the ceiling lifts inside it so the
 *  diver can rise into the light. */
export const SUNFALL = { u: 1462, v: -10, radius: 12 } as const;

/** The Fallen Mesa: a toppled pillar lying across the meadow — its body
 *  runs from tail to head; the head rests propped on a boulder with a
 *  swim-under beneath its chin. */
export const FALLEN = { tailU: 1544, tailV: -44, headU: 1568, headV: -26 } as const;

/** The Province's End rise: the balcony the Verdant Line ends on. */
export const WORLDS_END = { u: 1608, v: -8, radius: 14 } as const;
const WORLDS_END_FLOOR = -28.5;

/** The Hollow Mesa's interior — the secret. Registered rest: the glow
 *  colonies and the oculus beam are the room's own light; no fauna, no
 *  scatter. */
export const HOLLOW = MESAS[4]!;

/**
 * The protected stillness registry entries this region contributes to
 * MASTER §1.2 (see the ledger). Every instanced kit scatter, shoal
 * route and fauna anchor keeps out; the licensed exceptions are stated
 * per rest in the ledger.
 */
export const RESTS = {
  /** The Clearwater: the Kingpillar's wellspring pool — the shaft and
   *  its pool are the room's only light and motion. */
  clearwater: { u: 1512, v: 58, radius: 12 },
  /** The Hollow Mesa's shaft: glow colonies + the oculus beam only. */
  hollowShaft: { u: 1418, v: -92, radius: 7 },
  /** The Boughfall Shadow: the channel's dark passage — motes only. */
  boughfallShadow: { fromU: 1274, toU: 1300 },
  /** The Elder's Rest: a bare composed pocket on the far south flank. */
  eldersRest: { u: 1584, v: -64, radius: 12 },
} as const;

/** 1 outside every rest, easing to 0 inside — the shared stillness gate. */
export function stillnessGate(u: number, v: number): number {
  let gate = 1;
  for (const rest of [RESTS.clearwater, RESTS.hollowShaft, RESTS.eldersRest]) {
    const d = Math.hypot(u - rest.u, v - rest.v);
    gate *= smoothstep01((d - rest.radius) / 4);
  }
  if (u > RESTS.boughfallShadow.fromU - 3 && u < RESTS.boughfallShadow.toU + 3) {
    const inside =
      smoothstep01((u - (RESTS.boughfallShadow.fromU - 3)) / 4) *
      (1 - smoothstep01((u - RESTS.boughfallShadow.toU) / 4));
    const nearChannel = 1 - smoothstep01((Math.abs(v - channelCenter(u)) - channelHalf(u)) / 4);
    gate *= 1 - inside * nearChannel;
  }
  return gate;
}

export function mesaMound(u: number, v: number): number {
  let mound = 0;
  for (const mesa of MESAS) {
    const d = Math.hypot(u - mesa.u, v - mesa.v);
    if (d < 18) {
      mound = Math.max(mound, (1 - smoothstep01((d - mesa.footR * 0.7) / 11)) * 1.6);
    }
  }
  return mound;
}

function discHeight(x: number, z: number, u: number, v: number): number {
  // The Shade Meadows carry the disc: broad deep-green swells.
  let h =
    SHADE_FLOOR +
    (fbm(x * 0.014, z * 0.014, { seed: SEED ^ 0x7e02, period: 6, octaves: 2 }) - 0.5) * 2.6 +
    (fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x7e03, period: 9, octaves: 2 }) - 0.5) * 0.8;

  // The mesa roots rise in gentle mounds — the pillars grow FROM the
  // ground, not out of a plane.
  h += mesaMound(u, v);

  // The Wellsprings: cool clear pools sunk at the mesa roots, with a
  // soft raised lip so each pool reads as a held bowl.
  for (const spring of WELLSPRINGS) {
    const d = Math.hypot(u - spring.u, v - spring.v);
    if (d < spring.radius * 2.4) {
      const bowl = 1 - smoothstep01((d - spring.radius * 0.5) / (spring.radius * 0.8));
      h += bowl * (spring.depth - h);
      h += 0.5 * smoothstep01((d - spring.radius * 0.9) / 3) * (1 - smoothstep01((d - spring.radius * 1.6) / 4));
    }
  }

  // The Province's End rise: a low balcony over the far floor, facing
  // the painted distance that closes the province.
  const endD = Math.hypot(u - WORLDS_END.u, v - WORLDS_END.v);
  if (endD < 40) {
    h += (1 - smoothstep01((endD - WORLDS_END.radius * 0.7) / 24)) * (WORLDS_END_FLOOR - h);
  }

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. The threshold and
 * the Boughfall run the pass; the disc height takes over across the
 * descent's foot; and the whole answer eases back to dune level across
 * the disc's far feather (gated off the pass corridor) so the composed
 * ground and this target agree wherever the diver can be.
 */
export function verdant3TerrainTarget(x: number, z: number): number {
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
  // weight feather ends — except along the pass corridor, which crosses
  // the near rim and must not fade. The climb IS the Last Rampart, the
  // world's final wall, and the ground paint dresses it as one.
  const fade = 1 - smoothstep01((rc - 172) / 38) * (1 - passGate(u, v));
  return h * fade;
}

// ─── The ceiling ────────────────────────────────────────────────────────────

/** The Old Canopy's underside — the swim ceiling over the deep country.
 *  The crowns themselves stand above it: unreachable sky. */
export const CANOPY_CEILING = -6;

/**
 * Swim ceiling: 3.8 m over the threshold crest (meeting the terraces'
 * closed far rim), vaulting to ~12 down into the Boughfall, then diving
 * with the country under the Old Canopy to −6 (the floor lives at −34,
 * so that is still ~28 m of water), lifting inside the Sunfall Well and
 * the Hollow Mesa's shaft so both can be risen into, and closing to 3.4
 * at the disc's far rim (gated off the pass) so one ring of collider
 * stacks seals the world's edge floor to ceiling.
 */
export function verdant3Ceiling(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 3.8 + 8.2 * smoothstep01((u - 1180) / 70);

  // The dive under the Old Canopy.
  c += (CANOPY_CEILING - c) * smoothstep01((u - 1262) / 70);

  // The Sunfall Well: the canopy parts and the ceiling rises with it.
  const sunfallD = Math.hypot(u - SUNFALL.u, v - SUNFALL.v);
  if (sunfallD < SUNFALL.radius + 6) {
    c += (-1 - c) * smoothstep01((SUNFALL.radius - sunfallD) / 6);
  }

  // The Hollow Mesa's chimney: the shaft can be climbed toward the
  // oculus light.
  const hollowD = Math.hypot(u - HOLLOW.u, v - HOLLOW.v);
  if (hollowD < 8) {
    c += (-2 - c) * smoothstep01((5.5 - hollowD) / 3);
  }

  // The rim closure, gated off the pass corridor.
  c += (3.4 - c) * smoothstep01((rc - 186) / 26) * (1 - passGate(u, v));
  return c;
}
