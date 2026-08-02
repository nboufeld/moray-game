import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { regionSlot, slotCenter } from "../RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight, type Tongue } from "../RegionShapes";

/**
 * THE DAYSPRING — the pure half. Every function here is a seeded
 * function of position: it runs inside `seabedHeight`, so it must be
 * deterministic, cheap, and reach no scene object.
 *
 * ## The geography, in spoke coordinates
 *
 * `u` runs along the province spoke (azimuth 3.87) in metres from the
 * world origin; `v` is lateral, positive counterclockwise. The disc's
 * heart is at u = 1460, v = 0; the disc spans u 1240 → 1680. This is
 * the Pale Passage's LAST chamber — the place the Lantern Combs'
 * painted DAYSPRING promised. The Bone Meadows answered "life returns";
 * the Combs answered "where the pale light comes from" (a kept flame,
 * tended); this region answers what the flame was kept FOR: the diver
 * comes out from behind the paper into the morning itself. Dawn at the
 * bottom of a pale sea: the far horizon lightens first, then colour
 * returns to the ground, and at the spoke's own bearing the light
 * RISES — a half-risen pearl sun cresting the last terraces.
 *
 * The inbound connection is the depth-2 → depth-3 pass from the
 * Lantern Combs' far rim: their disc ends at u ≈ 1160, ours begins at
 * 1240, so the pass tongue starts at u = 1130 — thirty metres *inside*
 * their rim, exactly where their ledger reserved it — and the two
 * domains genuinely overlap. Three bands:
 *
 * - **The Lantern Reach** (u 1130 → 1245): a milky crest shelf at dune
 *   level over the Combs' Pearl Rampart. Our weight is a whisper (the
 *   threshold gate below): the Combs still own the water and the
 *   terrain, we own only the bounds — and the gate hides the
 *   framework's depth-boundary reject circle (`RegionField` consults
 *   us only within 260 m of our centre, u ≥ ~1200): out there our
 *   target is held at dune level, so the step at the reject circle is
 *   centimetres (the verdant-2/3 device, fourth use).
 * - **The Matins** (u 1252 → 1312): the pass is a place — six chalk
 *   steps down ~22 m in a walled slot between the first font towers,
 *   landing in THE UNDAWN: the hour before morning, the region's own
 *   held-breath dark (a registered rest) — so the country past it
 *   opens as daybreak.
 * - **The country** (the disc): the Morning Vale's white floor at
 *   ≈ −25 under standing font towers (hollow chalk light-wells with
 *   swollen lantern crowns — the silhouette the Combs' distance cards
 *   promised), THE STILL MORNING's mirror mere, the Blushfields where
 *   dawn colour reaches the ground, the Dawn Steps' pearl terraces,
 *   and at the spoke's bearing THE DAYSPRING itself — the risen pearl.
 *
 * Vertical range across the domain ≈ 29 m of terrain (threshold +0.2
 * down to the mere's −29); the fonts stand up to 24 m over the vale
 * floor on top of it.
 */

export const PALE3_SLOT = regionSlot("pale-passage-3");
const CENTER = slotCenter(PALE3_SLOT);

export const CENTER_X = CENTER.x;
export const CENTER_Z = CENTER.z;

const AXIS_X = Math.cos(PALE3_SLOT.azimuth);
const AXIS_Z = Math.sin(PALE3_SLOT.azimuth);

const SEED = SEEDS.regionPale3;

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
 * Lantern Combs' rim (1160) so the bounds handover is an overlap,
 * never a gap — the exact run their ledger reserved (`farGate`: their
 * seals and distance rings already part over u ≥ ~1080, |v| ≤ ~22);
 * `toR: 1300` runs it well into our own disc so the max-combine with
 * the disc weight has no waist at the rim crossing.
 */
export const PASS_TONGUE: Tongue = approachTongue(PALE3_SLOT, {
  fromR: 1130,
  toR: 1300,
  halfWidthFrom: 16,
  halfWidthTo: 56,
});

const DISC = slotDisc(PALE3_SLOT);

/**
 * The threshold gate: our ownership over the Combs' rim is a whisper
 * (0.14) so their milk keeps carrying the shelf, rising to full only
 * past u ≈ 1236 where the country is ours alone.
 */
function thresholdGate(u: number): number {
  return 0.14 + 0.86 * smoothstep01((u - 1206) / 30);
}

/** Ownership in [0, 1]; exactly 0 outside the disc and the pass tongue. */
export function pale3Weight(x: number, z: number): number {
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
 * off the Matins' descent. This region is the spoke's TERMINUS: there
 * is no outbound corridor and no far gate — the far rim is the world's
 * last wall, and the morning stands painted beyond it.
 */
export function passGate(u: number, v: number): number {
  const along = 1 - smoothstep01((u - 1316) / 26);
  const across = 1 - smoothstep01((Math.abs(v) - (passHalfWidth(Math.min(u, 1300)) + 2)) / 14);
  return along * across;
}

// ─── The Matins ─────────────────────────────────────────────────────────────

export const DESCENT_FROM = 1252;
export const DESCENT_TO = 1312;
/** The six chalk steps: first riser, pitch between risers, drop each. */
const STEP_U0 = 1256;
const STEP_PITCH = 10;
const STEP_DROP = 3.6;
const STEP_COUNT = 6;
/** Metres of `u` a riser takes to fall — steep (the verdant-2 lesson:
 *  a run wider than ~3 m melts into a swell under the 2.2 m grid). */
const RISER_RUN = 3.0;

/** Total drop of the Matins, for the tests and the builders. */
export const DESCENT_TOTAL_DROP = STEP_DROP * STEP_COUNT;

/** The descent channel's lateral wander. */
export function channelCenter(u: number): number {
  const grow = smoothstep01((u - 1160) / 90);
  return grow * (6 * Math.sin(u * 0.039 + 0.9) + 3.2 * Math.sin(u * 0.016));
}

/** The descent channel's half-width: a slot that opens as it lands. */
export function channelHalf(u: number): number {
  return 9 + 6.5 * smoothstep01((u - DESCENT_FROM) / (DESCENT_TO - DESCENT_FROM));
}

/**
 * The chalk staircase along the spine: 0 above the first riser,
 * ≈ −21.6 below the last. Also reports how much of the point sits on a
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

/** The pass channel's own floor level at a spoke distance — the paint
 *  and the dressing read bank height against this. */
export function matinsFloor(u: number): number {
  return thresholdLevel(u) + descentDrop(u).level;
}

/** Wall height above the descent channel, both flanks. */
function descentWallHeight(u: number): number {
  return 5 + 4.5 * smoothstep01((u - 1230) / 80);
}

/** The pass's own composed floor: threshold, descent, flanking banks. */
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

/** The Morning Vale's resting floor — the country's white plain. */
export const VALE_FLOOR = -25;

/**
 * The font towers: the Dayspring's exclusive silhouette — hollow chalk
 * light-wells with a broad root skirt, a waisted shaft and a swollen
 * lantern crown (the shape the Combs' Dayspring distance cards
 * promised, made real). The lit ones well morning light from their
 * crowns. The built half raises the towers; the pure half only mounds
 * the ground at their roots.
 */
export interface FontSpec {
  readonly name: string;
  readonly u: number;
  readonly v: number;
  readonly height: number;
  readonly footR: number;
  /** Carries a crown garden, a rising light column and crown lamps. */
  readonly lit?: boolean;
  /** THE BELFRY: a doorway at the foot, an open chimney at the crown. */
  readonly hollow?: boolean;
}

export const FONTS: readonly FontSpec[] = [
  // The Matins Gate pair, flanking the descent's mouth.
  { name: "matins-west", u: 1254, v: -15, height: 13, footR: 3.4 },
  { name: "matins-east", u: 1257, v: 17, height: 14, footR: 3.6 },
  // The descent's bank sentinel, over the Undawn's shoulder.
  { name: "vigil", u: 1288, v: 21, height: 15, footR: 3.4 },
  // The daybreak rank, opening past the descent's foot.
  { name: "daybreak-west", u: 1336, v: -33, height: 17, footR: 4.0, lit: true },
  { name: "daybreak-east", u: 1350, v: 27, height: 15, footR: 3.6 },
  // The font country proper.
  { name: "font-first", u: 1382, v: -6, height: 19, footR: 4.2, lit: true },
  { name: "font-south", u: 1396, v: -64, height: 16, footR: 3.8 },
  { name: "font-north", u: 1414, v: 36, height: 18, footR: 4.0, lit: true },
  { name: "belfry", u: 1442, v: -46, height: 24, footR: 5.2, lit: true, hollow: true },
  { name: "font-mid", u: 1468, v: 12, height: 20, footR: 4.4, lit: true },
  { name: "font-far-south", u: 1488, v: -92, height: 14, footR: 3.4 },
  { name: "font-mere", u: 1502, v: 54, height: 17, footR: 3.8, lit: true },
  { name: "font-east", u: 1526, v: -24, height: 21, footR: 4.4, lit: true },
  { name: "font-low", u: 1548, v: -66, height: 13, footR: 3.2 },
  { name: "font-high", u: 1558, v: 32, height: 15, footR: 3.4 },
  // The steps pair, the last standing stones before the terraces.
  { name: "steps-south", u: 1588, v: -34, height: 12, footR: 3.0 },
  { name: "steps-north", u: 1584, v: 58, height: 11, footR: 2.8 },
] as const;

/** THE BELFRY, by name — the hollow great font (the secret). */
export const BELFRY = FONTS[8]!;

/** THE STILL MORNING: the mirror mere — a registered rest. */
export const MERE = { u: 1438, v: 74, radius: 24, depth: -29 } as const;

/** The Dawn Steps: three pearl terraces rising toward the morning. */
export const STEPS_FROM = 1576;
export const STEPS_TO = 1640;
const TERRACE_AT = [1584, 1602, 1620] as const;

/** THE DAYSPRING itself: the half-risen pearl sun on the last terrace. */
export const DAYSPRING = { u: 1630, v: 0, radius: 12 } as const;

/**
 * The protected stillness registry entries this region contributes to
 * MASTER §1.2 (see the ledger). Every instanced kit scatter, shoal
 * route and fauna anchor keeps out; the licensed exceptions are stated
 * per rest in the ledger.
 */
export const RESTS = {
  /** THE STILL MORNING: the mirror; nothing moves, no fauna, no
   *  scatter, no motes over its water — its one event is the painted
   *  reflection lane on its floor. */
  stillMorning: { u: MERE.u, v: MERE.v, radius: 26 },
  /** THE SUN'S DOORSTEP: the bare pearl apron before the Dayspring;
   *  no scatter, no shoal, no glow buds — the Chorister's rise and
   *  the Dayspring's own light are its only motion and light. */
  doorstep: { u: 1614, v: 0, radius: 13 },
  /** THE UNDAWN: the hour before morning — the descent's held-breath
   *  dark; motes only, beam-free, scatter-free. */
  undawn: { fromU: 1276, toU: 1302 },
} as const;

/** 1 outside every rest, easing to 0 inside — the shared stillness gate. */
export function stillnessGate(u: number, v: number): number {
  let gate = 1;
  for (const rest of [RESTS.stillMorning, RESTS.doorstep]) {
    const d = Math.hypot(u - rest.u, v - rest.v);
    gate *= smoothstep01((d - rest.radius) / 4);
  }
  if (u > RESTS.undawn.fromU - 3 && u < RESTS.undawn.toU + 3) {
    const inside =
      smoothstep01((u - (RESTS.undawn.fromU - 3)) / 4) *
      (1 - smoothstep01((u - RESTS.undawn.toU) / 4));
    const nearChannel = 1 - smoothstep01((Math.abs(v - channelCenter(u)) - channelHalf(u)) / 4);
    gate *= 1 - inside * nearChannel;
  }
  return gate;
}

/**
 * THE STORY, as one pure number: how much of the morning has reached
 * this point, in [0, 1] — 0 at the threshold (the Combs' lamp-warmth
 * handed over and fading), 1 at the Dayspring. Unlike the Combs'
 * `lumen` (a kept flame at a point) this is a SUNRISE gradient: it
 * arrives along the spoke, from ahead. Ground warmth, blush, garden
 * density and the water's own warmth all read this one number; the
 * mere is held a step cooler by hand (the mirror keeps the hour
 * before, so the reflection lane on its floor can carry the light).
 */
export function dawn(u: number, v: number): number {
  let k = smoothstep01((u - 1340) / 270);
  const orbD = Math.hypot(u - DAYSPRING.u, v - DAYSPRING.v);
  k = Math.min(1, k + (1 - smoothstep01((orbD - 14) / 40)) * 0.3);
  const mereD = Math.hypot(u - MERE.u, v - MERE.v);
  k *= 1 - (1 - smoothstep01((mereD - 22) / 30)) * 0.4;
  return k;
}

/**
 * The Blushfields' ownership, in [0, 1]: the south flank where dawn
 * colour reaches the GROUND — the province's blush, kept to accents
 * for two whole regions, finally allowed to be a field. It arrives
 * with `dawn` (colour returns with the morning).
 */
export function blushWeight(u: number, v: number): number {
  const band =
    smoothstep01((u - 1360) / 40) *
    (1 - smoothstep01((u - 1560) / 40)) *
    smoothstep01((-v - 34) / 24);
  return band * (0.3 + 0.7 * dawn(u, v));
}

/**
 * The road's spine, for builders and the walk-line paint: the channel
 * through the pass, then a gentle S through the font ranks, closing on
 * the spoke itself up the Dawn Steps — the SUN ROAD, the lane the
 * morning draws on the floor the way a low sun draws its lane on
 * water.
 */
export function roadCenter(u: number): number {
  if (u < 1330) {
    return channelCenter(u);
  }
  const s = smoothstep01((u - 1330) / 170);
  const wander = channelCenter(1330) * (1 - s) + (-3 + 8 * Math.sin((u - 1330) * 0.017)) * s;
  // The last reach closes on the spoke: the road walks straight into
  // the risen light.
  return wander * (1 - smoothstep01((u - 1560) / 50));
}

/** The root mounds under the font towers — towers grow FROM the ground. */
export function fontMound(u: number, v: number): number {
  let mound = 0;
  for (const font of FONTS) {
    const d = Math.hypot(u - font.u, v - font.v);
    if (d < font.footR + 12) {
      mound = Math.max(mound, (1 - smoothstep01((d - font.footR * 0.8) / 10)) * 1.4);
    }
  }
  return mound;
}

/** How much of the mere bowl owns a spoke point, in [0, 1]. */
export function mereWeight(u: number, v: number): number {
  const d = Math.hypot(u - MERE.u, v - MERE.v);
  return 1 - smoothstep01((d - MERE.radius * 0.5) / (MERE.radius * 0.8));
}

/** How much of the Sun's Doorstep pan owns a spoke point, in [0, 1]. */
export function doorstepWeight(u: number, v: number): number {
  const d = Math.hypot(u - 1614, v);
  return 1 - smoothstep01((d - 9) / 9);
}

/** The dawn slope: the vale floor climbing toward the morning. */
function dawnRise(u: number): number {
  return 16 * smoothstep01((u - 1440) / 150);
}

/** The Dawn Steps' terrace field at a spoke distance. */
export function terraceLevel(u: number): number {
  let terraces = 0;
  for (const at of TERRACE_AT) {
    terraces += 2.4 * smoothstep01((u - at) / 2.6);
  }
  return -9.2 + terraces;
}

function discHeight(x: number, z: number, u: number, v: number): number {
  // The Morning Vale carries the disc: pale rolling ground climbing
  // gently toward the far light — the whole country tilts at the dawn.
  let h =
    VALE_FLOOR +
    dawnRise(u) +
    (fbm(x * 0.013, z * 0.013, { seed: SEED ^ 0x7e02, period: 6, octaves: 2 }) - 0.5) * 3.0 +
    (fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x7e03, period: 9, octaves: 2 }) - 0.5) * 1.0;

  // The font roots rise in gentle mounds.
  h += fontMound(u, v);

  // THE STILL MORNING: the mirror mere — the region's deepest floor,
  // a wide bowl with a soft raised lip, glass-flat by paint.
  const mereD = Math.hypot(u - MERE.u, v - MERE.v);
  if (mereD < MERE.radius * 2.2) {
    const bowl = 1 - smoothstep01((mereD - MERE.radius * 0.5) / (MERE.radius * 0.8));
    h += bowl * (MERE.depth - h);
    h +=
      0.55 *
      smoothstep01((mereD - MERE.radius * 0.95) / 3) *
      (1 - smoothstep01((mereD - MERE.radius * 1.5) / 5));
  }

  // The Dawn Steps: three pearl terraces rising toward the far gate —
  // the stairs of the morning.
  if (u > STEPS_FROM - 10) {
    const rise = smoothstep01((u - STEPS_FROM) / (STEPS_TO - STEPS_FROM));
    const own = smoothstep01((u - (STEPS_FROM - 10)) / 18) * (1 - mereWeight(u, v));
    h += own * (terraceLevel(u) - h) * Math.max(rise, 0.35);
  }

  // THE SUN'S DOORSTEP: the bare pearl pan under the Dayspring,
  // flattened almost smooth — the last ten metres are silence.
  const doorstep = doorstepWeight(u, v);
  if (doorstep > 0) {
    const pan =
      -4.2 +
      (fbm(x * 0.013, z * 0.013, { seed: SEED ^ 0x7e04, period: 5, octaves: 2 }) - 0.5) * 0.4;
    h += doorstep * (pan - h);
  }

  // Ground life at the scale the sheets can carry.
  h += (fbm(x * 0.024, z * 0.024, { seed: SEED ^ 0x7e05, period: 9, octaves: 2 }) - 0.5) * 0.6;

  return h;
}

// ─── The composed target ────────────────────────────────────────────────────

/**
 * The floor the region's terrain is carved toward. The threshold and
 * the Matins run the pass; the disc height takes over across the
 * descent's foot; and the whole answer eases back to dune level across
 * the disc's far feather (gated off the inbound pass corridor) so the
 * composed ground and this target agree wherever the diver can be.
 */
export function pale3TerrainTarget(x: number, z: number): number {
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
  // is the MORNINGLIP, the world's last wall: the terraces climb it
  // and the painted morning stands beyond. No corridor is reserved —
  // the spoke ends here.
  const fade = 1 - smoothstep01((rc - 172) / 38) * (1 - passGate(u, v));
  return h * fade;
}

// ─── The ceiling ────────────────────────────────────────────────────────────

/**
 * Swim ceiling: 3.8 m over the threshold crest (meeting the Combs'
 * closed far rim — the low crest crawl their ledger reserved),
 * vaulting to ~12 down into the Matins, easing to 9 over the country
 * (the vale floor lives at −25: ~34 m of water — dawn is an OPEN sky,
 * the one register the pale province has not yet played), and closing
 * to 3.4 at the disc's far rim (gated off the inbound pass only).
 */
export function pale3Ceiling(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  let c = 3.8 + 8.2 * smoothstep01((u - 1180) / 70);

  // The country's ease: the morning presses a step lower than the vault.
  c += (9 - c) * smoothstep01((u - 1320) / 60);

  // The rim closure, gated off the inbound pass corridor.
  c += (3.4 - c) * smoothstep01((rc - 186) / 26) * (1 - passGate(u, v));
  return c;
}
