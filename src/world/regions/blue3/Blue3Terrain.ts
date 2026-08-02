import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";
import { blue2TerrainTarget, blue2Weight } from "../blue2/Blue2Terrain";
import { B3_SEEDS, smoothstep01 } from "./Blue3Shared";

/**
 * THE FIRST SEA — the pure half. Every function here is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 5.31) in metres from the
 * world origin; `v` is lateral, positive counterclockwise. The disc's
 * heart is at u = 1460, v = 0; the disc spans u 1240 → 1680. This is
 * the Great Blue's depth-3 region — the LAST region of the whole
 * world, and the game's deepest arrival.
 *
 * The inbound connection is the depth-2 → depth-3 pass over the Deep
 * Steps' own Worldwall: their disc ends at u ≈ 1160, THE HORNS frame
 * the corridor from their crest at u ≈ 1124–1128, and their pure
 * terrain climbs from the Round (−47) back to dune level between
 * u ≈ 1108 and 1146 (probed; the crossing is a ~3 m duck under the
 * world's lid at the crest, narrowing to ~2 m mid-climb). The pass
 * tongue starts at u = 1130 — thirty metres INSIDE their rim — so the
 * two domains genuinely overlap. Three authored bands:
 *
 * - **The Worldwall Crossing** (u 1130 → 1178): the Deep Steps' far
 *   rampart, climbed from their side. Our weight is a whisper for
 *   BOUNDS only, and — the blue-2 device, third use — our terrain
 *   target MIRRORS the parent's composed wall (`blue2Weight ·
 *   blue2TerrainTarget`; base dunes are ±0.6 out here, so the product
 *   IS the composed ground to within centimetres, probed at ≤ 0.3 m).
 *   The framework's depth-boundary reject circle (`RegionField`
 *   consults us only within radius + 40 = 260 m of our centre,
 *   u ≥ ~1200) means the mirror never feeds back into `seabedHeight`:
 *   blue-2's weight is 0 past u 1160, so wherever we ARE consulted the
 *   mirror term is 0. Nothing is built on the wall.
 * - **The Morning Shelf** (u 1178 → 1250): a bare milky saddle at dune
 *   level — the far lip of the Deep Steps' Worldwall, and the world's
 *   last threshold. Held at base level so the step at the reject
 *   circle is centimetres (asserted). Its heart is a registered rest;
 *   the Daymark stands at its far edge (u 1252) as the first thing of
 *   ours the fog gives up — past blue-2's parted distance rings at
 *   u ≤ 1228 (the Emerald Gate law, paid at authoring time).
 * - **The country** (the disc): THE LONGFALL — the longest single
 *   slope in the game, 52 m of fall over a hundred metres — pours the
 *   world's last road down into THE FIRSTLIGHT MERE, the floor of the
 *   whole ocean at −52, strewn with the star-bloom. THE WELLHEAD's
 *   pale crater (rim −42.5, bowl −58.5 — the deepest point in the
 *   game) births the sea's water under THE DAYBREAK; THE CRADLE, the
 *   young river, leaves it over THE OVERBRIM and dies into the rim
 *   mist; THE ANCHOR lies half-raised off the Longfall's foot with its
 *   CHAIN of great stone links; THE STARWATER PANS hold their still
 *   light on the south flank; and THE SEA'S DOORSTEP rise looks over
 *   THE HEM — the world's outermost wall — into the painted morning
 *   beyond the end of the sea.
 *
 * Vertical range ≈ 59 m (shelf crest ≈ +0.4 → bowl −58.5; the test
 * holds ≥ 50 and lowest ≤ −55) — the deepest country in the game.
 */

export const BLUE3_SLOT = regionSlot("great-blue-3");
const CENTER = slotCenter(BLUE3_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(BLUE3_SLOT.azimuth);
const AXIS_Z = Math.sin(BLUE3_SLOT.azimuth);

const SEED = SEEDS.regionBlue3;

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
 * The pass tongue. `fromR: 1130` reaches thirty metres inside the Deep
 * Steps' rim (1160) so the bounds handover is an overlap, never a gap;
 * `toR: 1300` runs it well into our own disc so the max-combine with
 * the disc weight has no waist at the rim crossing. (Blue-2's ledger
 * recommended exactly this tongue; taken verbatim.)
 */
export const PASS_TONGUE: Tongue = approachTongue(BLUE3_SLOT, {
  fromR: 1130,
  toR: 1300,
  halfWidthFrom: 16,
  halfWidthTo: 56,
});

const DISC = slotDisc(BLUE3_SLOT);

/**
 * The threshold gate: our ownership over the Deep Steps' rim is a
 * whisper (0.14) so their terrain, mood and paint keep carrying the
 * crossing; full ownership arrives past the Daymark, where the country
 * is ours alone.
 */
function thresholdGate(u: number): number {
  return 0.14 + 0.86 * smoothstep01((u - 1216) / 30);
}

/** Ownership in [0, 1]; exactly 0 outside the disc and the pass tongue. */
export function blue3Weight(x: number, z: number): number {
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
 * the bounds are). Identical support to the weight.
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
 * rim ceiling-closure off the crossing and off the Longfall's breach
 * through our own hem.
 */
export function passGate(u: number, v: number): number {
  const along = 1 - smoothstep01((u - 1306) / 26);
  // Round 2: the corridor's flank walls WANDER — the unwobbled window
  // rendered them as two razor-straight fogged planes down the whole
  // Longfall.
  const wave = 4.5 * Math.sin(u * 0.045) + 2.5 * Math.sin(u * 0.019 + 2);
  const across =
    1 - smoothstep01((Math.abs(v) - (passHalfWidth(Math.min(u, 1300)) + 2 + wave)) / 14);
  return along * across;
}

// ─── The Worldwall mirror ───────────────────────────────────────────────────

/**
 * The Deep Steps' composed ground under our tongue, read from its pure
 * half (base dunes are ±0.6 out there, so weight × target is the
 * composed height to within the dunes' own noise — probed ≤ 0.3 m).
 * Zero past u ≈ 1160 by blue-2's own weight; the band gate keeps the
 * import from ever reaching our own country.
 */
function wallMirror(x: number, z: number, u: number): number {
  if (u >= 1178) {
    return 0;
  }
  const w = blue2Weight(x, z);
  if (w === 0) {
    return 0;
  }
  return w * blue2TerrainTarget(x, z);
}

// ─── The pass bands ─────────────────────────────────────────────────────────

/** The Morning Shelf's gentle profile: dune level, drawing down toward
 *  the Longfall's crest. */
function shelfHeight(x: number, z: number, u: number, v: number): number {
  const ramp = smoothstep01((u - 1150) / 16);
  const draw = 0.3 - 1.0 * smoothstep01((u - 1206) / 46);
  const detail =
    (fbm(x * 0.021, z * 0.021, { seed: SEED ^ B3_SEEDS.terrainShelf, period: 8, octaves: 2 }) -
      0.5) *
    0.5;
  const inside = 1 - smoothstep01((Math.abs(v) - passHalfWidth(u)) / 16);
  return ramp * (draw + detail) * inside;
}

// ─── The Longfall ───────────────────────────────────────────────────────────

/** Where the fall begins and ends along the spoke, and the Mere floor. */
export const FALL_FROM = 1252;
export const FALL_TO = 1356;
export const MERE_FLOOR = -52;

/** The Longfall's crest line wanders (round 2: a radially smooth crest
 *  silhouetted as one flat fogged band from the whole Mere). */
export function fallWobble(v: number): number {
  return 6 * Math.sin(v * 0.061) + 3 * Math.sin(v * 0.027 + 1.3);
}

/** The Longfall's drop: a true BRINK — fourteen metres over the first
 *  reach — then the long glide to the Mere floor. Exported so builders
 *  and paint share the profile. */
export function fallDrop(u: number, v: number): number {
  const head = u - FALL_FROM - fallWobble(v);
  return -14 * smoothstep01(head / 16) - 38 * smoothstep01((head - 18) / 86);
}

// ─── The landmarks the pure half must know ──────────────────────────────────

/** THE WELLHEAD: the spring of the sea — rim crest ≈ −42.5, bowl
 *  −58.5 (the deepest point in the game). */
export const WELLHEAD = { u: 1502, v: -28, rimR: 18, bowlFloor: -58.5 } as const;

/** THE OVERBRIM: the rim notch the young river leaves by — a bearing
 *  off the Wellhead's centre, toward the Cradle's first station. */
export const OVERBRIM = { u: 1489, v: -8 } as const;

/** THE ANCHOR: where the world was moored — half-raised off the
 *  Longfall's foot, crown breaking ~13 m above the Mere. The yaw
 *  points the shank's rise back along the Chain's bearing, so the
 *  ring crowns the line the links draw. */
export const ANCHOR = { u: 1392, v: 64, yaw: 3.33 } as const;

/** THE CHAIN: five great stone links trailing from the Longfall's foot
 *  to the Anchor's ring. */
export const CHAIN_LINKS: readonly { u: number; v: number }[] = [
  { u: 1336, v: 18 },
  { u: 1350, v: 30 },
  { u: 1364, v: 42 },
  { u: 1377, v: 52 },
  { u: 1387, v: 59 },
] as const;

/** THE DAYMARK: the lone pale waymark at the Longfall's crest — the
 *  first thing of ours past blue-2's parted rings (u ≤ 1228). */
export const DAYMARK = { u: 1252, v: 6 } as const;

/** THE STARWATER PANS: three still dishes of concentrated light. */
export const PANS: readonly { u: number; v: number; radius: number }[] = [
  { u: 1418, v: -114, radius: 8 },
  { u: 1430, v: -126, radius: 6 },
  { u: 1424, v: -102, radius: 5 },
] as const;

/** THE SEA'S DOORSTEP: the last balcony, facing the painted morning. */
export const DOORSTEP = { u: 1602, v: -4, radius: 14 } as const;
const DOORSTEP_FLOOR = -44;

/** THE PEARL: the secret in its fold on the north-east flank. */
export const PEARL = { u: 1548, v: 96 } as const;

// ─── The Cradle (the young river) ───────────────────────────────────────────

/**
 * The Cradle's bed: the sea's water, just born — rising in the
 * Wellhead's bowl, leaving over the Overbrim, crossing the Mere and
 * dying into the rim mist below the Hem (upstream, mythically, it is
 * the Old Current the diver followed two regions ago). Spoke-space
 * polyline, source → mist.
 */
export const CRADLE_SPINE: readonly (readonly [number, number])[] = [
  [1498, -20],
  [1489, -8],
  [1478, 6],
  [1464, 24],
  [1450, 38],
  [1436, 58],
  [1428, 84],
  [1422, 112],
  [1418, 140],
] as const;

/** Where the road crosses the Cradle: THE SHALLOWS. */
export const FORD = { u: 1444, v: 46 } as const;

/** Distance from the Cradle's spine, and how far along it (0–1). */
export function cradleDistance(u: number, v: number): { d: number; t: number } {
  let best = Number.POSITIVE_INFINITY;
  let bestT = 0;
  for (let i = 0; i < CRADLE_SPINE.length - 1; i++) {
    const [au, av] = CRADLE_SPINE[i]!;
    const [bu, bv] = CRADLE_SPINE[i + 1]!;
    const du = bu - au;
    const dv = bv - av;
    const len2 = du * du + dv * dv;
    const t = Math.max(0, Math.min(1, ((u - au) * du + (v - av) * dv) / len2));
    const d = Math.hypot(u - (au + du * t), v - (av + dv * t));
    if (d < best) {
      best = d;
      bestT = (i + t) / (CRADLE_SPINE.length - 1);
    }
  }
  return { d: best, t: bestT };
}

/** The Cradle's carve: a shallow dish with soft levees; the Shallows
 *  pave it where the road crosses; nothing carves inside the crater. */
export function cradleCarve(u: number, v: number): { dish: number; levee: number; bed: number } {
  const { d, t } = cradleDistance(u, v);
  if (d > 14 || t < 0.09) {
    return { dish: 0, levee: 0, bed: 0 };
  }
  const bed = 1 - smoothstep01((d - 4.5) / 3.4);
  const ford = 1 - smoothstep01((Math.hypot(u - FORD.u, v - FORD.v) - 5) / 4);
  const grow = smoothstep01((t - 0.09) / 0.1);
  const dish = -1.2 * bed * grow * (1 - ford * 0.6);
  const levee = 0.4 * grow * smoothstep01((d - 5) / 2) * (1 - smoothstep01((d - 11) / 3.5));
  return { dish, levee, bed: bed * grow };
}

// ─── The Wellhead's crater ──────────────────────────────────────────────────

/** Hinge distance from the Wellhead's centre. */
export function wellD(u: number, v: number): number {
  return Math.hypot(u - WELLHEAD.u, v - WELLHEAD.v);
}

/** How deep the Overbrim notch cuts the rim along its bearing (0–1). */
function overbrimNotch(u: number, v: number): number {
  const bearing = Math.atan2(OVERBRIM.v - WELLHEAD.v, OVERBRIM.u - WELLHEAD.u);
  const here = Math.atan2(v - WELLHEAD.v, u - WELLHEAD.u);
  let off = Math.abs(here - bearing) % (Math.PI * 2);
  if (off > Math.PI) {
    off = Math.PI * 2 - off;
  }
  return 1 - smoothstep01((off - 0.26) / 0.24);
}

/** The crater's shape: rim ring + bowl, relative to the Mere floor. */
function craterShape(u: number, v: number, base: number): number {
  const d = wellD(u, v);
  if (d > 46) {
    return base;
  }
  // The rim: a full ring bump, cut down over the Overbrim's bearing.
  const ring = smoothstep01((d - 8) / 8) * (1 - smoothstep01((d - 22) / 12));
  const notch = overbrimNotch(u, v);
  let h = base + ring * 9.5 * (1 - notch * 0.55);
  // The bowl: the deepest water in the game.
  const bowl = 1 - smoothstep01((d - 4) / 9);
  h += bowl * (WELLHEAD.bowlFloor - h);
  return h;
}

// ─── The disc ───────────────────────────────────────────────────────────────

function discHeight(x: number, z: number, u: number, v: number): number {
  // The Longfall carries the descent; the Mere floor takes over.
  let h = fallDrop(u, v);

  // Long low swells everywhere, and RIBS on the fall's face (round 2:
  // a smooth 50 m face fogged to one flat plane — the ribs give the
  // slope shoulders the light can find).
  const steep = smoothstep01((u - FALL_FROM - 10) / 30) * (1 - smoothstep01((u - FALL_TO) / 20));
  const swell =
    (fbm(x * 0.012, z * 0.012, { seed: SEED ^ B3_SEEDS.terrainMere, period: 5, octaves: 2 }) -
      0.5) *
    1.5 *
    (1 - steep * 0.45);
  h += swell;
  h += steep * 1.5 * Math.sin(v * 0.24 + fallWobble(v) * 0.3);

  // The Mere's heart calms: the deepest country is the smoothest (the
  // Wide Morning's floor is nearly still water made solid).
  const calm =
    (1 - smoothstep01((Math.hypot(u - 1374, v + 58) - 30) / 34)) *
    smoothstep01((u - FALL_TO + 12) / 18);
  h += calm * (MERE_FLOOR - h) * 0.6;

  // The Starwater Pans: still dishes with the faintest raised lips.
  for (const pan of PANS) {
    const d = Math.hypot(u - pan.u, v - pan.v);
    if (d < pan.radius * 2.2) {
      const dish = 1 - smoothstep01((d - pan.radius * 0.45) / (pan.radius * 0.65));
      h += dish * (MERE_FLOOR - 1.6 - h);
      h +=
        0.4 *
        smoothstep01((d - pan.radius * 0.85) / 2) *
        (1 - smoothstep01((d - pan.radius * 1.5) / 3));
    }
  }

  // The Pearl's fold: a soft hollow holding the secret.
  const pearlD = Math.hypot(u - PEARL.u, v - PEARL.v);
  if (pearlD < 14) {
    h += (1 - smoothstep01((pearlD - 2.5) / 8)) * -1.8;
  }

  // The Sea's Doorstep: the low rise the world ends on.
  const doorD = Math.hypot(u - DOORSTEP.u, v - DOORSTEP.v);
  if (doorD < 44) {
    h += (1 - smoothstep01((doorD - DOORSTEP.radius * 0.7) / 26)) * (DOORSTEP_FLOOR - h);
  }

  // The Wellhead's crater — applied last so its bowl owns its floor.
  h = craterShape(u, v, h);

  // The Cradle's carve, outside the crater.
  const cradle = cradleCarve(u, v);
  h += cradle.dish + cradle.levee;

  // Fine ground life at the scale the sheets can carry.
  h +=
    (fbm(x * 0.026, z * 0.026, { seed: SEED ^ B3_SEEDS.terrainDetail, period: 9, octaves: 2 }) -
      0.5) *
    0.45;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. The wall mirror and
 * the Morning Shelf run the pass; the disc takes over across the
 * Longfall's crest; and the whole answer eases back to dune level
 * across the disc's far feather (gated off the pass corridor, whose
 * breach IS the Longfall) so the composed ground and this target agree
 * wherever the diver can be. The far feather is THE HEM: the world's
 * outermost wall, 52 m of climb, painted milky with the morning
 * bleeding over its crest.
 */
export function blue3TerrainTarget(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

  let h: number;
  if (u < 1240) {
    h = wallMirror(x, z, u) + shelfHeight(x, z, u, v);
  } else if (u < 1284) {
    const s = smoothstep01((u - 1240) / 44);
    const pass = shelfHeight(x, z, u, v);
    h = pass + s * (discHeight(x, z, u, v) - pass);
  } else {
    h = discHeight(x, z, u, v);
  }

  // The Hem's crest line undulates (blue-2's round-2 lesson pre-paid:
  // a radially uniform crest reads as one flat fogged band).
  const theta = Math.atan2(z - CENTER_Z, x - CENTER_X);
  const crest = 172 + 5 * Math.sin(theta * 3 + 0.7) + 3 * Math.sin(theta * 7 + 2.1);
  const fade = 1 - smoothstep01((rc - crest) / 38) * (1 - passGate(u, v));
  return h * fade;
}

// ─── The ceiling ────────────────────────────────────────────────────────────

/**
 * Swim ceiling: the wall band hugs the Deep Steps' own pinched rim
 * (their closure is target + 3 at the crest — the crossing is a duck
 * under the world's lid, probed at ~2–3.5 m of water), holds ~3.2 m
 * over the Morning Shelf, then VAULTS as the Longfall pours away — to
 * +8 over the country (66.5 m of water over the Wellhead's bowl, the
 * deepest column in the game), closing to floor + 3 at the disc's far
 * rim, gated off the pass corridor only. There is no outbound corridor
 * to reserve: this is the end of the sea.
 */
export function blue3Ceiling(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 3.2 + 4.8 * smoothstep01((u - 1244) / 50);
  // The wall band: ride the mirror down so the annex agrees with the
  // Deep Steps' own pinched rim ceiling whichever annex resolves.
  const wall = wallMirror(x, z, u);
  if (wall < 0) {
    c = Math.min(c, wall + 3.4);
  }
  c += (blue3TerrainTarget(x, z) + 3.0 - c) * smoothstep01((rc - 184) / 26) * (1 - passGate(u, v));
  return c;
}
