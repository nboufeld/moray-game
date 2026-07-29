import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";

/**
 * THE EMERALD TERRACES — the pure half. Every function here is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 1.35) in metres from the
 * world origin; `v` is lateral, positive counterclockwise. The disc's
 * heart is at u = 940, v = 0; the disc spans u 720 → 1160.
 *
 * This is the game's first depth-2 region: there is no gateway wing. The
 * inbound connection is an inter-region pass from the Great Kelp Sea's
 * far rim — its disc ends at u ≈ 665, ours begins at 720 — so the pass
 * tongue starts at u = 635, thirty metres *inside* the kelp sea's rim,
 * and the two domains genuinely overlap. The handover is authored in
 * three bands:
 *
 * - **The Threshold** (u 635 → 738): a milky crest shelf at dune level.
 *   Our weight is deliberately *small* here (the threshold gate below):
 *   the kelp sea still owns the water and the terrain, we own only the
 *   bounds — so the collision handover is seamless while the composed
 *   ground stays the pilot's own fading shelf. The gate also hides the
 *   framework's terrain-reject circle (`RegionField` consults us only
 *   within 260 m of our centre, u ≥ ~680): with weight ≈ 0.14 out there
 *   and a dune-level target, the step at the reject circle is
 *   centimetres.
 * - **The Emerald Stair** (u 738 → 845): the pass *is* a place — a
 *   monumental descending staircase of natural ledges cut into a walled
 *   cleft, eight great steps down ~25 m, gardens deepening step by step.
 * - **The country** (the disc): the Hanging Gardens terrace field, the
 *   Cistern, the Fern Vault, the Mistfall's great drop to the basin at
 *   ≈ −44, and the Far Balcony over the basin's rim.
 *
 * Vertical range across the disc ≈ 40 m (stair-flank crowns ≈ −4 down to
 * the Mistfall's foot at ≈ −44).
 */

export const VERDANT2_SLOT = regionSlot("verdant-line-2");
const CENTER = slotCenter(VERDANT2_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(VERDANT2_SLOT.azimuth);
const AXIS_Z = Math.sin(VERDANT2_SLOT.azimuth);

const SEED = SEEDS.regionVerdant2;

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
 * The pass tongue. `fromR: 635` reaches thirty metres inside the Great
 * Kelp Sea's rim (665) so the bounds handover is an overlap, never a
 * gap; `toR: 780` runs it well into our own disc so the max-combine with
 * the disc weight has no waist at the rim crossing. The half-widths look
 * generous because `tongueWeight`'s core (full weight) is only 55% of
 * the half-width — the stair's flanking wall crests at |v| ≈ 19–28 must
 * stand inside the core or the composed ground melts them.
 */
export const PASS_TONGUE: Tongue = approachTongue(VERDANT2_SLOT, {
  fromR: 635,
  toR: 780,
  halfWidthFrom: 16,
  halfWidthTo: 56,
});

const DISC = slotDisc(VERDANT2_SLOT);

/**
 * The threshold gate: our ownership over the kelp sea's rim is a whisper
 * (0.14) so the pilot's terrain, mood and paint keep carrying the shelf,
 * rising to full only past u ≈ 712 where the country is ours alone.
 */
function thresholdGate(u: number): number {
  return 0.14 + 0.86 * smoothstep01((u - 684) / 28);
}

/** Ownership in [0, 1]; exactly 0 outside the disc and the pass tongue. */
export function verdant2Weight(x: number, z: number): number {
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
 * stair. Wide enough to cover the walls, eased on both axes.
 */
export function passGate(u: number, v: number): number {
  const along = 1 - smoothstep01((u - 792) / 26);
  const across = 1 - smoothstep01((Math.abs(v) - (passHalfWidth(Math.min(u, 780)) + 2)) / 14);
  return along * across;
}

// ─── The Emerald Stair ──────────────────────────────────────────────────────

export const STAIR_FROM = 738;
export const STAIR_TO = 845;
/** The eight great steps: first riser, pitch between risers, drop each. */
const STEP_U0 = 742;
const STEP_PITCH = 13.2;
const STEP_DROP = 3.1;
const STEP_COUNT = 8;
/** Metres of `u` a riser takes to fall its drop — steep, garden-draped. */
const RISER_RUN = 4.6;

/** Total drop of the stair, for the tests and the builders. */
export const STAIR_TOTAL_DROP = STEP_DROP * STEP_COUNT;

/** The stair channel's lateral wander. */
export function stairChannelCenter(u: number): number {
  const grow = smoothstep01((u - 660) / 90);
  return grow * (7 * Math.sin(u * 0.041 + 1.2) + 3.5 * Math.sin(u * 0.017));
}

/** The stair channel's half-width: a broad processional way. */
export function stairChannelHalf(u: number): number {
  return 9.5 + 6.5 * smoothstep01((u - STAIR_FROM) / (STAIR_TO - STAIR_FROM));
}

/**
 * The descending staircase along the spine: 0 above the first riser,
 * ≈ −24.8 below the last. Also reports how much of the point sits on a
 * riser (0 tread, 1 mid-riser) so builders and paint can find the step
 * faces without re-deriving the geometry.
 */
export function stairDescent(u: number): { level: number; riser: number } {
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

/** The threshold's gentle draw-in: dune level easing toward the stair. */
function thresholdLevel(u: number): number {
  return 0.2 - 2.4 * smoothstep01((u - 690) / 48);
}

/** Wall height above the stair channel, both flanks. */
function stairWallHeight(u: number): number {
  return 5 + 4 * smoothstep01((u - 700) / 90);
}

/** The pass's own composed floor: threshold, stair, flanking walls. */
function passHeight(x: number, z: number, u: number, v: number): number {
  const stair = stairDescent(u);
  const away = Math.abs(v - stairChannelCenter(u));
  const wall = smoothstep01((away - stairChannelHalf(u)) / 9);
  const wallBand = smoothstep01((u - 694) / 30);
  const detail =
    (fbm(x * 0.023, z * 0.023, { seed: SEED ^ 0x7e01, period: 8, octaves: 2 }) - 0.5) * 0.7;
  const h = thresholdLevel(u) + stair.level + wall * wallBand * stairWallHeight(u) + detail;
  // Beyond the tongue's own width the authored pass returns to dune
  // level: out there the weight is a whisper over zero and the annex
  // floor reads this function.
  const inside = 1 - smoothstep01((Math.abs(v) - passHalfWidth(u)) / 16);
  return h * inside;
}

// ─── The disc's sub-biomes ──────────────────────────────────────────────────

export const GARDENS = { u: 905, v: -12, radius: 128 } as const;
export const CISTERN = { u: 925, v: 68, radius: 46 } as const;
export const FERN_VAULT = { u: 900, v: -85, radius: 48 } as const;
export const MISTFALL = { u: 998, v: 14 } as const;
export const BALCONY = { u: 1055, v: 42, radius: 30 } as const;

/** The gardens' resting level, before the terrace field steps it down. */
export const GARDENS_FLOOR = -22;
/** The Cistern's mirror floor. */
export const CISTERN_FLOOR = -34.2;
/** The Fern Vault's floor and its authored stone-shelf ceiling. */
export const VAULT_FLOOR = -30.2;
export const VAULT_CEILING = -22.6;
/** The Mistfall basin's deepest authored floor — a ~14.5 m fall. */
export const BASIN_FLOOR = -45.5;
/** The Far Balcony's worked terrace level. */
export const BALCONY_FLOOR = -26.5;

export function gardensWeight(u: number, v: number): number {
  const d = Math.hypot(u - GARDENS.u, v - GARDENS.v);
  return 1 - smoothstep01((d / GARDENS.radius - 0.25) / 0.75);
}

export function cisternWeight(u: number, v: number): number {
  const d = Math.hypot(u - CISTERN.u, v - CISTERN.v);
  return 1 - smoothstep01((d - 20) / 26);
}

export function vaultWeight(u: number, v: number): number {
  const d = Math.hypot(u - FERN_VAULT.u, v - FERN_VAULT.v);
  return 1 - smoothstep01((d - 18) / 30);
}

/** How far past the Mistfall's lip a point is, in [0, 1] over the drop. */
export function mistfallDrop(u: number, v: number): number {
  const lipU = MISTFALL.u + 9 * Math.sin(v * 0.021 + 0.7);
  return smoothstep01((u - lipU) / 16);
}

export function balconyWeight(u: number, v: number): number {
  const d = Math.hypot(u - BALCONY.u, v - BALCONY.v);
  return 1 - smoothstep01((d - 12) / 20);
}

/**
 * The Hanging Gardens terrace field: broad garden terraces stepping down
 * across the heart along curved contour lines. Reports the riser factor
 * the same way the stair does.
 */
export function gardenTerraces(u: number, v: number): { drop: number; riser: number } {
  // The terrace coordinate: distance "downhill" through the gardens,
  // curved so the contour lines bow like real terrace walls.
  const tc = (u - 830) * 0.92 + v * 0.22 + 13 * Math.sin(v * 0.024 + 1.4) + 6 * Math.sin(u * 0.017);
  let drop = 0;
  let riser = 0;
  const edges = [10, 44, 82] as const;
  for (const edge of edges) {
    const t = (tc - edge) / 6.5;
    drop -= 3.0 * smoothstep01(t);
    if (t > 0 && t < 1) {
      riser = Math.max(riser, 4 * t * (1 - t));
    }
  }
  return { drop, riser };
}

function discHeight(x: number, z: number, u: number, v: number): number {
  // The gardens' resting level carries the disc; the stair's own foot
  // hands over to it in `verdant2TerrainTarget`.
  const terraces = gardenTerraces(u, v);
  let h =
    GARDENS_FLOOR +
    terraces.drop +
    (fbm(x * 0.016, z * 0.016, { seed: SEED ^ 0x7e02, period: 6, octaves: 2 }) - 0.5) * 1.6;

  // The Cistern: a flooded stone bowl — raised worked rim, mirror floor.
  const cistern = cisternWeight(u, v);
  if (cistern > 0) {
    const d = Math.hypot(u - CISTERN.u, v - CISTERN.v);
    const still =
      CISTERN_FLOOR +
      (fbm(x * 0.05, z * 0.05, { seed: SEED ^ 0x7e03, period: 9, octaves: 1 }) - 0.5) * 0.12;
    h += cistern * (still - h);
    h += 1.6 * smoothstep01((d - 30) / 6) * (1 - smoothstep01((d - 42) / 8));
  }

  // The Fern Vault: the low tier under the stone shelf.
  const vault = vaultWeight(u, v);
  if (vault > 0) {
    const vaultH =
      VAULT_FLOOR +
      (fbm(x * 0.022, z * 0.022, { seed: SEED ^ 0x7e04, period: 7, octaves: 2 }) - 0.5) * 1.3;
    h += vault * (vaultH - h);
  }

  // The Mistfall: the country's great drop, one riser the height of a
  // church. The lip keeps the gardens' level; the basin takes the floor
  // to −44 and rolls it with slow swells.
  const drop = mistfallDrop(u, v);
  if (drop > 0) {
    const basin =
      BASIN_FLOOR +
      (fbm(x * 0.013, z * 0.013, { seed: SEED ^ 0x7e05, period: 5, octaves: 2 }) - 0.5) * 2.6;
    h += drop * (basin - h);
  }

  // The Far Balcony: a flat worked terrace riding proud of the basin rim.
  const balcony = balconyWeight(u, v);
  if (balcony > 0) {
    h += balcony * (BALCONY_FLOOR - h);
  }

  // Ground life at the scale the sheets can carry.
  h += (fbm(x * 0.026, z * 0.026, { seed: SEED ^ 0x7e06, period: 9, octaves: 2 }) - 0.5) * 0.8;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. The threshold and the
 * stair run the pass; the disc height takes over across the stair's
 * foot; and the whole answer eases back to dune level across the disc's
 * far feather (gated off the pass corridor) so the composed ground and
 * this target agree wherever the diver can be.
 */
export function verdant2TerrainTarget(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

  let h: number;
  if (u < STAIR_TO - 20) {
    h = passHeight(x, z, u, v);
  } else if (u < STAIR_TO + 26) {
    const s = smoothstep01((u - (STAIR_TO - 20)) / 46);
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
 * Swim ceiling: 3.8 m over the threshold crest (meeting the kelp sea's
 * own closed rim), vaulting open to 12 down the stair, easing to 6 over
 * the deep country (the terraces live 25–44 m down, so that is still
 * 30+ m of water), dipping to the Fern Vault's authored stone shelf, and
 * closing to 3.4 at the disc's far rim (gated off the pass) so one ring
 * of collider stacks seals the world's edge floor to ceiling.
 */
export function verdant2Ceiling(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 3.8 + 8.2 * smoothstep01((u - 668) / 60);
  c -= 6 * smoothstep01((u - 800) / 110);

  // The Fern Vault's shelf: a hard authored lid, well under the open sky.
  const vault = vaultWeight(u, v);
  if (vault > 0.55) {
    const lid = smoothstep01((vault - 0.55) / 0.3);
    c += lid * (VAULT_CEILING - c);
  }

  // The rim closure, gated off the pass corridor.
  c += (3.4 - c) * smoothstep01((rc - 186) / 26) * (1 - passGate(u, v));
  return c;
}
