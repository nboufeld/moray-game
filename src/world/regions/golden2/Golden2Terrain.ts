import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";
import { G2_SEEDS, smoothstep01 } from "./Golden2Shared";

/**
 * THE CARILLON WASTE — the pure half. Every function here is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 6.39 ≈ 0.107 — almost due
 * +x) in metres from the world origin; `v` is lateral, positive
 * counterclockwise. The disc's heart is at u = 940, v = 0; the disc
 * spans u 720 → 1160.
 *
 * This is the Golden Waste's depth-2 region: no gateway wing. The
 * inbound connection is the inter-region pass the Hourglass Sea's
 * ledger reserved at its Gilded Shore stacks — its disc ends at
 * u ≈ 665, ours begins at 720 — so the pass tongue starts at u = 630,
 * thirty-five metres *inside* the Hourglass Sea's rim, and the two
 * domains genuinely overlap. The handover is authored in three bands
 * (the Emerald Terraces' device, third use):
 *
 * - **The Shore Road** (u 630 → 745): a milky-gold shelf at dune level
 *   past the Gilded Shore stacks. Our weight is a whisper (the
 *   threshold gate) so the Hourglass Sea keeps carrying water, mood
 *   and terrain across the overlap; we own only the bounds. The gate
 *   also hides the framework's depth-boundary reject circle
 *   (`RegionField` consults us only within radius + 40 = 260 m of our
 *   centre, u ≥ ~680): out there the target is held at the probed
 *   base level (≈ 0 ± 0.4 m), so the step at the reject circle is
 *   centimetres.
 * - **The Wind Gully** (u 748 → 818): the pass is a place — a walled
 *   gully ramping ~11 m down into the carved country, its flanks
 *   fluted by the same wind that cut everything here.
 * - **The country** (the disc): the Hoodoo Court's capped spires, the
 *   Windows wall and its Great Arch, the Ribbon slot canyon with the
 *   Anchorite's Cell, the Seep Terraces' benched pools, the Carillon's
 *   fluted towers over their swept Pavement, and the Sunset Shelf
 *   whose framing spires reserve the depth-3 pass.
 *
 * Vertical terrain range ≈ 34 m (Windows ridge crest ≈ +2 down to the
 * Ribbon's floor ≈ −32); the towers carry built verticality to ≈ +11.
 */

export const GOLDEN2_SLOT = regionSlot("golden-waste-2");
const CENTER = slotCenter(GOLDEN2_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(GOLDEN2_SLOT.azimuth);
const AXIS_Z = Math.sin(GOLDEN2_SLOT.azimuth);

const SEED = SEEDS.regionGolden2;

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
 * The pass tongue. `fromR: 630` reaches thirty-five metres inside the
 * Hourglass Sea's rim (665) so the bounds handover is an overlap, never
 * a gap; `toR: 780` runs it well into our own disc so the max-combine
 * with the disc weight has no waist at the rim crossing. The Gilded
 * Shore stacks (their spoke ≈ (596, 30)) frame this azimuth — the
 * pilot's own gilded-shore pose looks straight down this road.
 */
export const PASS_TONGUE: Tongue = approachTongue(GOLDEN2_SLOT, {
  fromR: 630,
  toR: 780,
  halfWidthFrom: 16,
  halfWidthTo: 56,
});

const DISC = slotDisc(GOLDEN2_SLOT);

/**
 * The threshold gate: our ownership over the Hourglass Sea's rim is a
 * whisper (0.14) so the pilot's terrain, mood and paint keep carrying
 * the shore across the overlap, rising to full only past u ≈ 724 where
 * the country is ours alone.
 */
function thresholdGate(u: number): number {
  return 0.14 + 0.86 * smoothstep01((u - 694) / 30);
}

/** Ownership in [0, 1]; exactly 0 outside the disc and the pass tongue. */
export function golden2Weight(x: number, z: number): number {
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
 * off the gully. Wide enough to cover the flanking walls.
 */
export function passGate(u: number, v: number): number {
  const along = 1 - smoothstep01((u - 806) / 26);
  const across = 1 - smoothstep01((Math.abs(v) - (passHalfWidth(Math.min(u, 780)) + 2)) / 14);
  return along * across;
}

// ─── The Wind Gully ─────────────────────────────────────────────────────────

export const GULLY_FROM = 748;
export const GULLY_TO = 818;

/** The gully channel's lateral wander — a wind-cut meander. */
export function gullyChannelCenter(u: number): number {
  const grow = smoothstep01((u - 700) / 60);
  return grow * (6 * Math.sin(u * 0.045 + 0.8) + 3 * Math.sin(u * 0.019 + 2.1));
}

/** The gully channel's half-width: a road, opening as it descends. */
export function gullyChannelHalf(u: number): number {
  return 5.5 + 5.5 * smoothstep01((u - GULLY_FROM) / (GULLY_TO - GULLY_FROM));
}

/**
 * The gully floor along the spine: dune level at the Chime Gate,
 * ramping ~11 m down in two chutes with a landing between (a straight
 * ramp is a corridor; a stair of two is a descent with a breath in it).
 */
export function gullyFloor(u: number): number {
  let f = -1.4 * smoothstep01((u - 700) / 46);
  f += -5.2 * smoothstep01((u - 752) / 22);
  f += -4.6 * smoothstep01((u - 790) / 22);
  return f;
}

/** Wall height above the gully floor, both flanks. */
function gullyWallHeight(u: number): number {
  return 3.5 + 3.5 * smoothstep01((u - 740) / 50);
}

/** The pass's own composed floor: shore road, gully, fluted flanks. */
function passHeight(x: number, z: number, u: number, v: number): number {
  const floor = gullyFloor(u);
  const away = Math.abs(v - gullyChannelCenter(u));
  const wallT = smoothstep01((away - gullyChannelHalf(u)) / 9);
  const wallBand = smoothstep01((u - 738) / 22);
  // The flutes: vertical ribs the wind cut into the flanks — a slow
  // lateral wave at a wavelength the 2.2 m ground grid can carry.
  const rib =
    Math.sin(v * 1.05 + u * 0.06) *
    0.5 *
    wallT *
    wallBand *
    smoothstep01((u - 745) / 30);
  const detail =
    (fbm(x * 0.021, z * 0.021, { seed: SEED ^ G2_SEEDS.terrainDetail, period: 8, octaves: 2 }) -
      0.5) *
    0.55;
  const h = floor + wallT * wallBand * gullyWallHeight(u) + rib + detail;
  // Beyond the tongue's own width the authored pass returns to base
  // level: out there the weight is a whisker over zero and the annex
  // floor reads this function.
  const inside = 1 - smoothstep01((Math.abs(v) - passHalfWidth(u)) / 16);
  return h * inside;
}

// ─── The disc's sub-biomes ──────────────────────────────────────────────────

/** The Hoodoo Court's resting carved-pavement level. */
export const COURT_FLOOR = -11;

/** The Windows wall: a pierced ridge from (838, 36) to (896, 84). */
export const WINDOWS_A = { u: 838, v: 36 } as const;
export const WINDOWS_B = { u: 896, v: 84 } as const;
/** Where the ridge dips to court level for the Great Arch. */
export const ARCH_AT = { u: 866, v: 60.5 } as const;

/** The Ribbon: the slot canyon's spine, and its authored depth. */
export const RIBBON_SPINE: readonly (readonly [number, number])[] = [
  [898, -30],
  [922, -44],
  [946, -52],
  [968, -66],
  [986, -84],
  [1004, -96],
] as const;
export const RIBBON_FLOOR = -32;

/** The Anchorite's Cell: a carved side-chamber off the Ribbon's elbow. */
export const CELL = { u: 962, v: -78, radius: 7 } as const;

/** The Seep Terraces: benched spring pools on a raised apron. */
export const SEEPS = { u: 975, v: 72, radius: 52 } as const;
/** The three authored pools (spoke coords, bench-local dishes). */
export const SEEP_POOLS: readonly { u: number; v: number; radius: number }[] = [
  { u: 968, v: 88, radius: 6.5 },
  { u: 984, v: 70, radius: 5 },
  { u: 962, v: 58, radius: 4 },
] as const;

/** The Carillon: the tower court and its swept pavement. */
export const CARILLON = { u: 1030, v: -18, radius: 42 } as const;
/** The Pavement rest: the swept circle at the towers' feet. */
export const PAVEMENT_RADIUS = 14;

/** The Sunset Shelf: the far rise where depth 3 is promised. */
export const SHELF_FROM = 1080;

/** How much of the Windows ridge owns a point, in [0, 1], plus its axis t. */
export function windowsRidge(u: number, v: number): { w: number; t: number } {
  const du = WINDOWS_B.u - WINDOWS_A.u;
  const dv = WINDOWS_B.v - WINDOWS_A.v;
  const len = Math.hypot(du, dv);
  const t = Math.max(0, Math.min(1, ((u - WINDOWS_A.u) * du + (v - WINDOWS_A.v) * dv) / (len * len)));
  const px = WINDOWS_A.u + du * t;
  const pz = WINDOWS_A.v + dv * t;
  const d = Math.hypot(u - px, v - pz);
  const end = smoothstep01(t / 0.12) * (1 - smoothstep01((t - 0.88) / 0.12));
  return { w: (1 - smoothstep01((d - 4) / 9)) * end, t };
}

/** Distance from the Ribbon's spine, and how far along it (0–1). */
export function ribbonDistance(u: number, v: number): { d: number; t: number } {
  let best = Number.POSITIVE_INFINITY;
  let bestT = 0;
  for (let i = 0; i < RIBBON_SPINE.length - 1; i++) {
    const [au, av] = RIBBON_SPINE[i]!;
    const [bu, bv] = RIBBON_SPINE[i + 1]!;
    const du = bu - au;
    const dv = bv - av;
    const len2 = du * du + dv * dv;
    const t = Math.max(0, Math.min(1, ((u - au) * du + (v - av) * dv) / len2));
    const d = Math.hypot(u - (au + du * t), v - (av + dv * t));
    if (d < best) {
      best = d;
      bestT = (i + t) / (RIBBON_SPINE.length - 1);
    }
  }
  return { d: best, t: bestT };
}

/**
 * The Ribbon's carve at a spine distance `d`: full depth inside ~3.5 m,
 * walls rising over 3.5–9 m, a raised wind-lip outside — the Hourglass
 * lip idiom, cut straight instead of round. The mouth (t < 0.1) and the
 * tail (t > 0.94) ramp the floor back up so the canyon is swimmable
 * end to end.
 */
export function ribbonCarve(u: number, v: number): { carve: number; lip: number; wall: number } {
  const { d, t } = ribbonDistance(u, v);
  if (d > 16) {
    return { carve: 0, lip: 0, wall: 0 };
  }
  const mouth = smoothstep01((t - 0.02) / 0.1);
  const tail = 1 - smoothstep01((t - 0.86) / 0.12);
  // The Cell: the chamber bulges the carve sideways off the elbow.
  const cellD = Math.hypot(u - CELL.u, v - CELL.v);
  const cell = (1 - smoothstep01((cellD - CELL.radius + 2) / 4)) * 0.92;
  const inside = Math.max(1 - smoothstep01((d - 3.5) / 5.5), cell);
  const depth = (COURT_FLOOR - RIBBON_FLOOR) * mouth * tail;
  const lip = 0.8 * smoothstep01((d - 8) / 3) * (1 - smoothstep01((d - 14) / 4)) * mouth * tail;
  return { carve: -depth * inside, lip, wall: inside };
}

/** How much of the Seep Terraces own a point, in [0, 1]. */
export function seepsWeight(u: number, v: number): number {
  const d = Math.hypot((u - SEEPS.u) * 1.05, v - SEEPS.v);
  return 1 - smoothstep01((d / SEEPS.radius - 0.3) / 0.7);
}

/**
 * The seep terrace benches: three travertine steps falling from the
 * high shoulder (v large) toward the court, each ~2.1 m. Reports the
 * riser factor so builders and paint can find the step faces.
 */
export function seepBenches(u: number, v: number): { drop: number; riser: number } {
  const tc = (SEEPS.v + 30 - v) * 0.9 + (u - SEEPS.u) * 0.2 + 5 * Math.sin(u * 0.05 + 1.2);
  let drop = 0;
  let riser = 0;
  for (const edge of [14, 34, 54]) {
    const t = (tc - edge) / 3.2;
    drop -= 2.1 * smoothstep01(t);
    if (t > 0 && t < 1) {
      riser = Math.max(riser, 4 * t * (1 - t));
    }
  }
  return { drop, riser };
}

/** The pool dishes: how deep a point sits inside an authored seep pool. */
export function seepPoolDish(u: number, v: number): number {
  let dish = 0;
  for (const pool of SEEP_POOLS) {
    const d = Math.hypot(u - pool.u, v - pool.v);
    dish = Math.max(dish, (1 - smoothstep01((d - pool.radius * 0.4) / (pool.radius * 0.6))) * 0.55);
  }
  return dish;
}

/** How much of the Carillon's plinth owns a point, in [0, 1]. */
export function carillonWeight(u: number, v: number): number {
  const d = Math.hypot(u - CARILLON.u, v - CARILLON.v);
  return 1 - smoothstep01((d - CARILLON.radius * 0.45) / (CARILLON.radius * 0.55));
}

/** How much of the Sunset Shelf owns a point, in [0, 1]. */
export function shelfWeight(u: number): number {
  return smoothstep01((u - SHELF_FROM) / 45);
}

/**
 * The court's carved swales: broad wind-cut hollows in the pavement,
 * at a wavelength the 2.2 m grid samples cleanly. Exported so paint
 * and cover read the same relief.
 */
export function courtSwale(x: number, z: number): number {
  return (
    (fbm(x * 0.011, z * 0.011, { seed: SEED ^ G2_SEEDS.terrainSwale, period: 5, octaves: 2 }) -
      0.5) *
    2.6
  );
}

function discHeight(x: number, z: number, u: number, v: number): number {
  // The Hoodoo Court: the disc's resting carved pavement.
  let h = COURT_FLOOR + courtSwale(x, z);

  // Long carved runnels: the wind's grain, read as gentle relief (the
  // calm zones below lerp over it where they own the floor).
  h += Math.sin(u * 0.11 + Math.sin(v * 0.06) * 1.8) * 0.5;

  // The Windows ridge: a stone rampart rising from the pavement,
  // dipping to a doorway around the Great Arch's stand. Round 2: 13 m
  // at the 2.2 m grid read as a smooth dune mountain — the rampart
  // comes down to 9 with a broken crest, and the WALL identity lives
  // in the built fins standing on it.
  const ridge = windowsRidge(u, v);
  if (ridge.w > 0) {
    const archD = Math.hypot(u - ARCH_AT.u, v - ARCH_AT.v);
    const doorway = 1 - smoothstep01((archD - 5) / 6);
    const crest =
      9 *
      ridge.w *
      (0.72 + 0.2 * Math.sin(ridge.t * 19 + 1.3) + 0.14 * Math.sin(ridge.t * 47 + 0.6)) *
      (1 - doorway);
    h += crest;
  }

  // The Seep Terraces: a raised apron benching down toward the court,
  // pool dishes sunk into the treads.
  const seeps = seepsWeight(u, v);
  if (seeps > 0) {
    const bench = seepBenches(u, v);
    const apron = -4.6 + bench.drop; // top bench ≈ −4.6, foot ≈ −11
    h += seeps * (apron - seepPoolDish(u, v) - h);
  }

  // The Carillon's plinth: a swept, gently dished plaza — calm ground
  // for the towers, the pavement's rings live in paint.
  const carillon = carillonWeight(u, v);
  if (carillon > 0) {
    const d = Math.hypot(u - CARILLON.u, v - CARILLON.v);
    const dish = -11.8 - 0.5 * (1 - smoothstep01(d / 26));
    h += carillon * (dish - h);
  }

  // The Sunset Shelf: the far rise where the painted distance and the
  // depth-3 promise take over.
  const shelf = shelfWeight(u);
  if (shelf > 0) {
    const rise =
      -6 +
      (fbm(x * 0.014, z * 0.014, { seed: SEED ^ G2_SEEDS.terrainShelf, period: 5, octaves: 2 }) -
        0.5) *
        1.4;
    h += shelf * (rise - h);
  }

  // The Ribbon, last so the slot wins its own heart: the carve, the
  // wind-lip, and a floor detail that keeps the deep from reading flat.
  const ribbon = ribbonCarve(u, v);
  if (ribbon.carve !== 0 || ribbon.lip !== 0) {
    h += ribbon.carve + ribbon.lip;
    h +=
      (fbm(x * 0.03, z * 0.03, { seed: SEED ^ G2_SEEDS.terrainRib, period: 9, octaves: 2 }) - 0.5) *
      0.5 *
      ribbon.wall;
  }

  // Ground life at the scale the sheets can carry.
  h +=
    (fbm(x * 0.026, z * 0.026, { seed: SEED ^ G2_SEEDS.terrainSeep, period: 9, octaves: 2 }) -
      0.5) *
    0.5;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. The shore road and
 * the gully run the pass; the disc height takes over across the gully's
 * foot; and the whole answer eases back to base level across the disc's
 * far feather (gated off the inbound pass corridor) so the composed
 * ground and this target agree wherever the diver can be.
 */
export function golden2TerrainTarget(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

  let h: number;
  if (u < GULLY_TO - 14) {
    h = passHeight(x, z, u, v);
  } else if (u < GULLY_TO + 26) {
    const s = smoothstep01((u - (GULLY_TO - 14)) / 40);
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
 * Swim ceiling: 3.8 m over the shore road (meeting the Hourglass Sea's
 * own closed rim), vaulting to ~13 down the gully, opening to 26 over
 * the carved country (the towers crown near +11 and want water over
 * them), and closing to 3.4 at the disc's far rim (gated off the
 * inbound pass) so one ring of collider stacks seals the world's edge
 * floor to ceiling. The reserved depth-3 corridor stays sealed until
 * golden-waste-3 opens it — that reservation is ledgered, not built.
 */
export function golden2Ceiling(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 3.8 + 9.2 * smoothstep01((u - 700) / 70) + 13 * smoothstep01((u - 800) / 60);
  c += (3.4 - c) * smoothstep01((rc - 186) / 26) * (1 - passGate(u, v));
  return c;
}
