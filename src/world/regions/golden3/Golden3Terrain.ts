import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";
import { G3_SEEDS, smoothstep01 } from "./Golden3Shared";

/**
 * THE VESPER STRAND — the pure half. Every function here is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 6.39 ≈ 0.107 — almost due
 * +x) in metres from the world origin; `v` is lateral, positive
 * counterclockwise. The disc's heart is at u = 1460, v = 0; the disc
 * spans u 1240 → 1680. This is the Golden Waste's LAST chamber — the
 * province's depth 3 — and the desert's end is the end of the desert's
 * day: EVENING, made into a place. The last dunes pour over the
 * Sandfall Combe into a salt-pale basin where every stone leans toward
 * the sunset; the Mirror Pans hold the sky on the ground; the Afterglow
 * Garden lights its candles as the light goes; and at the far pole THE
 * SUN'S DOOR stands over the painted sun going down at the world's
 * edge — the horizon the whole spoke has been promising.
 *
 * The inbound connection is the depth-2 → depth-3 pass the Carillon
 * Waste reserved at its Sunset Spires: its disc ends at u ≈ 1160, ours
 * begins at 1240, so the pass tongue starts at u = 1130 — thirty metres
 * *inside* its rim — and the two domains genuinely overlap. Three bands:
 *
 * - **The Last Shelf** (u 1130 → 1245): the Carillon Waste's own Sunset
 *   Shelf carried to its end. Our weight is a whisper (the threshold
 *   gate below): golden-2 still owns the water and the terrain, we own
 *   only the bounds — and the gate hides the framework's depth-boundary
 *   reject circle (`RegionField` consults us only within 260 m of our
 *   centre, u ≥ ~1200): out there our target mirrors golden-2's shelf
 *   fade (−2.2 → 0 by u 1150, probed before authoring), so the step at
 *   the reject circle is centimetres (the verdant-3 device, reused at
 *   the province's last boundary).
 * - **The Sandfall Combe** (u 1252 → 1322): the pass is a place — the
 *   province's opening motif returned at its close: the last dunes pour
 *   over three carved lips in golden fall-sheets, and the diver
 *   descends ~26 m through the pouring light into the evening country.
 * - **The country** (the disc): the Vesper Flats at ≈ −30, the
 *   Procession's leaning stones, the Mirror Pans, the Dune Combs on
 *   both flanks, the Afterglow Garden, the Night Well, and the Sun's
 *   Door rise looking into the painted sunset that closes the province.
 *
 * Vertical range across the domain ≈ 40 m (threshold 0 down to the
 * Night Well's −40; the test holds ≥ 34).
 */

export const GOLDEN3_SLOT = regionSlot("golden-waste-3");
const CENTER = slotCenter(GOLDEN3_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(GOLDEN3_SLOT.azimuth);
const AXIS_Z = Math.sin(GOLDEN3_SLOT.azimuth);

const SEED = SEEDS.regionGolden3;

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
 * The pass tongue — the Carillon Waste's ledgered reservation honoured
 * exactly: `fromR: 1130` reaches thirty metres inside its rim (1160) so
 * the bounds handover is an overlap, never a gap; `toR: 1300` runs it
 * well into our own disc so the max-combine with the disc weight has no
 * waist at the rim crossing. Its Sunset Spires (u ≈ 1098–1102, v
 * −12/+16) frame this azimuth — its own sunset-shelf pose looks
 * straight down this road.
 */
export const PASS_TONGUE: Tongue = approachTongue(GOLDEN3_SLOT, {
  fromR: 1130,
  toR: 1300,
  halfWidthFrom: 16,
  halfWidthTo: 56,
});

const DISC = slotDisc(GOLDEN3_SLOT);

/**
 * The threshold gate: our ownership over the Carillon Waste's rim is a
 * whisper (0.14) so its terrain, mood and paint keep carrying the
 * shelf. Golden-2's own domain ends at u 1160 and the framework's
 * reject circle hides us below u 1200 anyway, so the gate rises the
 * moment the circle admits us (round 2: the r1 gate held the whisper
 * to u ~1236 and the doorstep swam in base-blue water — the treaty
 * needs the whisper only over the OVERLAP; past the circle the honey
 * should arrive with the diver).
 */
function thresholdGate(u: number): number {
  return 0.14 + 0.86 * smoothstep01((u - 1200) / 22);
}

/** Ownership in [0, 1]; exactly 0 outside the disc and the pass tongue. */
export function golden3Weight(x: number, z: number): number {
  const disc = discWeight(DISC, x, z);
  const pass = tongueWeight(PASS_TONGUE, x, z);
  if (pass === 0) {
    return disc;
  }
  const { u } = spokeOf(x, z);
  return Math.max(disc, pass * thresholdGate(u));
}

/**
 * The tongue's raw geometric membership, for the FILL gates. The
 * threshold whisper (0.14) is a terrain-and-mood treaty with the
 * Carillon Waste, not a bareness licence (its own round-2 law, adopted
 * from draft one): the road's fill is ours the moment the bounds are.
 * Identical support to the weight, so containment is unchanged.
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
 * the smooth gate that keeps the rim fade and the rim ceiling-closure
 * off the combe's descent. This region is the province's terminus:
 * there is no outbound gate, and the far rim closes for good.
 */
export function passGate(u: number, v: number): number {
  const along = 1 - smoothstep01((u - 1316) / 26);
  const across = 1 - smoothstep01((Math.abs(v) - (passHalfWidth(Math.min(u, 1300)) + 2)) / 14);
  return along * across;
}

// ─── The Sandfall Combe ─────────────────────────────────────────────────────

export const COMBE_FROM = 1252;
export const COMBE_TO = 1322;

/** The three pour lips: where the dunes fall, and how far. */
export const POURS: readonly { u: number; drop: number }[] = [
  { u: 1258, drop: 9 },
  { u: 1282, drop: 9 },
  { u: 1306, drop: 8 },
] as const;
/** Metres of `u` a pour face takes to fall — steep, a poured-over lip. */
const POUR_RUN = 6;

/** Total drop of the combe, for tests and builders. */
export const COMBE_TOTAL_DROP = POURS.reduce((sum, pour) => sum + pour.drop, 0);

/** The combe channel's lateral wander — zero at the threshold so the
 *  corridor crosses golden-2's rim ring dead on the spoke (the
 *  orchestrator's cut is `|v| < 15`; the channel must honour it). */
export function combeChannelCenter(u: number): number {
  const grow = smoothstep01((u - 1235) / 55);
  return grow * (5 * Math.sin(u * 0.041 + 1.3) + 2.5 * Math.sin(u * 0.017 + 0.5));
}

/** The combe channel's half-width: a road, opening as it descends. */
export function combeChannelHalf(u: number): number {
  return 8 + 6 * smoothstep01((u - COMBE_FROM) / (COMBE_TO - COMBE_FROM));
}

/**
 * The poured staircase along the spine: 0 above the first lip, ≈ −26
 * below the last. Also reports how much of the point sits on a pour
 * face (0 tread, 1 mid-fall) so builders, paint and the fall sheets can
 * find the faces without re-deriving the geometry.
 */
export function combeDrop(u: number): { level: number; pour: number } {
  let level = 0;
  let pour = 0;
  for (const spec of POURS) {
    const t = (u - spec.u) / POUR_RUN;
    level -= spec.drop * smoothstep01(t);
    if (t > 0 && t < 1) {
      pour = Math.max(pour, 4 * t * (1 - t));
    }
  }
  return { level, pour };
}

/**
 * The threshold's floor: the Carillon Waste's Sunset Shelf mirrored to
 * its measured fade (composed −2.2 at u 1130 easing to 0 by 1150 — the
 * probe ran before authoring), so the 0.14 whisper never fights the
 * neighbour's ground and the reject-circle step stays centimetres.
 */
function thresholdLevel(u: number): number {
  return -2.4 * (1 - smoothstep01((u - 1126) / 26));
}

/** Wall height above the combe channel, both flanks — the last dunes. */
function combeWallHeight(u: number): number {
  return 4.5 + 4 * smoothstep01((u - 1240) / 60);
}

/** The pass's own composed floor: shelf, pours, dune-crest flanks. */
function passHeight(x: number, z: number, u: number, v: number): number {
  const drop = combeDrop(u);
  const away = Math.abs(v - combeChannelCenter(u));
  const wallT = smoothstep01((away - combeChannelHalf(u)) / 9);
  const wallBand = smoothstep01((u - 1228) / 26);
  // The comb flutes on the flanks: the wind's grain, carried down from
  // the Carillon Waste at a wavelength the 2.2 m grid can hold.
  const rib =
    Math.sin(v * 0.9 + u * 0.05) * 0.55 * wallT * wallBand * smoothstep01((u - 1244) / 30);
  const detail =
    (fbm(x * 0.022, z * 0.022, { seed: SEED ^ G3_SEEDS.terrainDetail, period: 8, octaves: 2 }) -
      0.5) *
    0.55;
  const h =
    thresholdLevel(u) + drop.level + wallT * wallBand * combeWallHeight(u) + rib + detail;
  // Beyond the tongue's own width the authored pass returns to base
  // level: out there the weight is a whisker over zero.
  const inside = 1 - smoothstep01((Math.abs(v) - passHalfWidth(u)) / 16);
  return h * inside;
}

// ─── The disc's sub-biomes ──────────────────────────────────────────────────

/** The Vesper Flats' resting floor — the evening basin. */
export const BASIN_FLOOR = -30;

/** The Mirror Pans: shallow mineral-glass dishes that hold the sky.
 *  The second is THE STILL MIRROR — a registered rest. */
export interface PanSpec {
  readonly u: number;
  readonly v: number;
  readonly radius: number;
  readonly rest?: boolean;
}

export const PANS: readonly PanSpec[] = [
  { u: 1372, v: 20, radius: 9.5 },
  { u: 1408, v: -26, radius: 13, rest: true },
  { u: 1452, v: 34, radius: 8.5 },
] as const;

export const STILL_MIRROR = PANS[1]!;

/** The Dune Combs: relic ridge fields combed across both flanks. */
export const COMB_A = { u: 1420, v: 118, ru: 110, rv: 52 } as const;
export const COMB_B = { u: 1435, v: -122, ru: 100, rv: 46 } as const;

/** The Afterglow Garden: the candle field and its spring. */
export const GARDEN = { u: 1524, v: 46, radius: 48 } as const;
export const GARDEN_SPRING = { u: 1528, v: 40, radius: 4 } as const;

/** The Night Well: where the desert's dark begins — the region's deep. */
export const WELL = { u: 1420, v: -92, radius: 12 } as const;
export const WELL_FLOOR = -40;

/** The Sun's Door: the rise and the arch at the province's last pole. */
export const DOOR = { u: 1600, v: -4 } as const;
export const DOOR_BALCONY = -22;

/** How much of a comb field owns a point, in [0, 1]. */
export function combWeight(u: number, v: number): number {
  let best = 0;
  for (const comb of [COMB_A, COMB_B]) {
    const d = Math.hypot((u - comb.u) / comb.ru, (v - comb.v) / comb.rv);
    best = Math.max(best, 1 - smoothstep01((d - 0.55) / 0.45));
  }
  return best;
}

/** The pan dish depth at a point, in metres (0 outside every pan). */
export function panDish(u: number, v: number): number {
  let dish = 0;
  for (const pan of PANS) {
    const d = Math.hypot(u - pan.u, v - pan.v);
    dish = Math.max(dish, (1 - smoothstep01((d - pan.radius * 0.45) / (pan.radius * 0.55))) * 1.0);
  }
  return dish;
}

/** The pans' raised salt rims, in metres. */
function panLip(u: number, v: number): number {
  let lip = 0;
  for (const pan of PANS) {
    const d = Math.hypot(u - pan.u, v - pan.v);
    lip = Math.max(
      lip,
      0.4 * smoothstep01((d - pan.radius * 0.8) / 2) * (1 - smoothstep01((d - pan.radius - 2.5) / 2.5)),
    );
  }
  return lip;
}

/** How much of the Afterglow Garden owns a point, in [0, 1]. */
export function gardenWeight(u: number, v: number): number {
  const d = Math.hypot(u - GARDEN.u, v - GARDEN.v);
  return 1 - smoothstep01((d / GARDEN.radius - 0.35) / 0.65);
}

/** How much of the Night Well owns a point, plus its bowl factor. */
export function wellCarve(u: number, v: number): { carve: number; lip: number } {
  const d = Math.hypot(u - WELL.u, v - WELL.v);
  if (d > WELL.radius * 2.2) {
    return { carve: 0, lip: 0 };
  }
  const bowl = 1 - smoothstep01((d - WELL.radius * 0.4) / (WELL.radius * 0.75));
  const lip =
    0.8 * smoothstep01((d - WELL.radius * 0.85) / 2.5) * (1 - smoothstep01((d - WELL.radius * 1.8) / 4));
  return { carve: (WELL_FLOOR - BASIN_FLOOR) * bowl, lip };
}

/** How much of the Sun's Door rise owns a point, in [0, 1]. */
export function doorRise(u: number, v: number): number {
  const d = Math.hypot(u - DOOR.u, v - DOOR.v);
  return 1 - smoothstep01((d - 14) / 30);
}

/**
 * The basin's broad evening swells — the flats are calm, not flat.
 * Exported so paint and cover read the same relief.
 */
export function basinSwell(x: number, z: number): number {
  return (
    (fbm(x * 0.013, z * 0.013, { seed: SEED ^ G3_SEEDS.terrainSwell, period: 6, octaves: 2 }) -
      0.5) *
    2.4
  );
}

/** The comb ridge relief: parallel crests at a grid-honest 17 m pitch.
 *  Round 2: amplitude up (2.8 → 4.2) with a half-pitch harmonic — the
 *  r1 combs read as soft noise, not ridge country. */
export function combRidge(u: number, v: number): number {
  const w = combWeight(u, v);
  if (w <= 0) {
    return 0;
  }
  const wander =
    (fbm(u * 0.01, v * 0.01, { seed: SEED ^ G3_SEEDS.terrainComb, period: 5, octaves: 2 }) - 0.5) *
    6;
  const phase = ((v + wander) * Math.PI * 2) / 17 + u * 0.035;
  const crest = 0.5 + 0.5 * Math.sin(phase);
  const brow = 0.5 + 0.5 * Math.sin(phase * 2 + 0.9);
  return w * (crest * crest * 4.2 + brow * brow * crest * 0.7);
}

function discHeight(x: number, z: number, u: number, v: number): number {
  // The Vesper Flats carry the disc.
  let h = BASIN_FLOOR + basinSwell(x, z);

  // The Dune Combs: relic ridges on both flanks.
  h += combRidge(u, v);

  // The Mirror Pans: shallow dishes with raised salt rims.
  h += panLip(u, v) - panDish(u, v);

  // The Afterglow Garden: a gently raised apron for the candle field,
  // its spring dished into the crown.
  const garden = gardenWeight(u, v);
  if (garden > 0) {
    const springD = Math.hypot(u - GARDEN_SPRING.u, v - GARDEN_SPRING.v);
    const spring =
      (1 - smoothstep01((springD - GARDEN_SPRING.radius * 0.5) / (GARDEN_SPRING.radius * 0.7))) *
      0.8;
    h += garden * (BASIN_FLOOR + 2.5 - h) - spring;
  }

  // The Night Well: the desert's dark, sunk below the flats.
  const well = wellCarve(u, v);
  if (well.carve !== 0 || well.lip !== 0) {
    h += well.carve + well.lip;
  }

  // The Sun's Door rise: the balcony the province ends on.
  const rise = doorRise(u, v);
  if (rise > 0) {
    h += rise * (DOOR_BALCONY - h);
  }

  // Ground life at the scale the sheets can carry.
  h +=
    (fbm(x * 0.027, z * 0.027, { seed: SEED ^ G3_SEEDS.terrainFine, period: 9, octaves: 2 }) -
      0.5) *
    0.5;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. The shelf and the
 * combe run the pass; the disc height takes over across the combe's
 * foot; and the whole answer eases back to base level across the disc's
 * far feather (gated off the inbound pass corridor) so the composed
 * ground and this target agree wherever the diver can be. The far climb
 * IS the world's last wall — the Vesper Rampart — and the ground paint
 * dresses it as one.
 */
export function golden3TerrainTarget(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

  let h: number;
  if (u < COMBE_TO - 16) {
    h = passHeight(x, z, u, v);
  } else if (u < COMBE_TO + 28) {
    const s = smoothstep01((u - (COMBE_TO - 16)) / 44);
    const pass = passHeight(x, z, u, v);
    h = pass + s * (discHeight(x, z, u, v) - pass);
  } else {
    h = discHeight(x, z, u, v);
  }

  // The rim fade: authored ground returns to base level before the
  // weight feather ends — except along the pass corridor, which crosses
  // the near rim and must not fade.
  const fade = 1 - smoothstep01((rc - 172) / 38) * (1 - passGate(u, v));
  return h * fade;
}

// ─── The ceiling ────────────────────────────────────────────────────────────

/**
 * Swim ceiling: 3.8 m over the Last Shelf (meeting the Carillon Waste's
 * closed far rim), vaulting to ~12 down the combe, opening to 6 over
 * the evening basin (the floor lives at −30: ~36 m of water), and
 * closing to 3.4 at the disc's far rim (gated off the inbound pass) so
 * one ring of collider stacks seals the world's edge floor to ceiling.
 * The province ends here: there is no outbound corridor to keep open.
 */
export function golden3Ceiling(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 3.8 + 8.2 * smoothstep01((u - 1180) / 70);
  c += (6 - c) * smoothstep01((u - 1310) / 60);
  c += (3.4 - c) * smoothstep01((rc - 186) / 26) * (1 - passGate(u, v));
  return c;
}
