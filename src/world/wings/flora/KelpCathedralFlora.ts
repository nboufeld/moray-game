import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Camera,
  type DataTexture,
  type MeshToonMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { createSunViewUniform, injectLeafGlow, trackSunView } from "../../SeaGrass";
import { wedgeHalfAt } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";
import {
  addSwayAttributes,
  angleOffAxis,
  clampInsideWedge,
  injectWingSway,
  lateralOf,
  polarPoint,
  smoothstep01,
} from "./W1FloraShared";
import { mountGateVeil } from "./GateVeilMount";
import { buildCarpetField } from "../../regions/kit/CarpetField";
import { buildPercherColony } from "../../regions/kit/PercherColony";
import { buildWallDrapeBank, type DrapeAnchor } from "../../regions/kit/WallDrape";

/**
 * Wing 0 — the Kelp Cathedral. Awe and hush.
 *
 * The nave: fourteen giant columns in two staggered rows flanking an open
 * aisle down the wing's axis, plus two younger sentinels on the gate's jamb
 * slopes. Every column is the reef kelp's giant idiom stretched taller — 8
 * to 10.5 metres of S-curved stipe under the wing's 11 m vault — ending in a
 * crown of drooping straps and a ring of near-horizontal canopy pads, so the
 * vault overhead is a ceiling of leaf with light coming through rather than
 * open water. The aisle between the rows stays clear to swim: nothing but
 * low moss and outward-lying fronds comes within two metres of the axis.
 *
 * The light: four god-light shafts standing between the columns over the
 * aisle — additive crossed blades on the canyon's light-column pattern
 * (`fog: false`, a ground fade baked against `seabedHeight`, an edge-on fade
 * per frame), tinted warm-green because this water keeps its sun where the
 * canyon keeps its moon. The two brightest land in soft pools on the floor,
 * because a beam that brightens nothing it points at is a decal.
 *
 * The floor: moss pads and low fronds gather at the column feet — a
 * cathedral's floor is not bare — and the def's `paint` stains the wall feet
 * emerald to meet them.
 *
 * Streams: `SEEDS.wingKelpCathedral` for placement, `^ 0x1eaf` for straps,
 * `^ 0xca09` for crowns and pads, `^ 0x4d05` for moss, `^ 0x5af7` for the
 * shafts' yaw — so retuning any one layer re-rolls none of the others.
 * Everything is drawn up front; nothing here loads asynchronously.
 */

/** The column rows' radial stations, gate to apse. */
const COLUMN_STATIONS = [37, 38.75, 40.5, 42.25, 44, 45.75, 47.3] as const;
/** The aisle stays this far open either side of the axis, in metres. */
const AISLE_HALF = 3.0;
/** The furthest a column foot stands from the axis, in metres. */
const ROW_LATERAL_MAX = 3.7;

/** A column's drawn height range — the reef's giants (7.2–9.4) stretched. */
const HEIGHT_MIN = 8.0;
const HEIGHT_MAX = 10.5;
/** The gate sentinels are younger: tall enough to frame the doorway, no more. */
const SENTINEL_MIN = 5.4;
const SENTINEL_MAX = 6.8;

const STALK_RINGS = 12;
const STALK_SIDES = 7;

/** Straps, crown ribbons and canopy pads per column; a giant is mostly crown. */
const STRAPS_MIN = 16;
const STRAPS_MAX = 22;
const CROWN_MIN = 8;
const CROWN_MAX = 12;
const PADS_MIN = 5;
const PADS_MAX = 7;
const STRAP_FROM = 0.24;
const STRAP_TO = 0.97;

/**
 * The sway: slower and a touch narrower than the reef forest's — a vault
 * this tall moves like a nave, not a meadow. One direction for the whole
 * wing, because that is what a current is.
 */
const SWAY_REACH = 0.085;
const DRIFT_X = 0.91;
const DRIFT_Z = 0.42;

/** The columns' palette: a step deeper and cooler than the reef's forest. */
const LEAF_TONES = [0x5a8a4a, 0x6d9c56, 0x4a7a42];
const TIP_GOLD = new Color(0xc9b968);
const STALK_TINT = new Color(0x5d7a45);

/** The god-light shafts, aisle to apse; opacities stay far under the bloom. */
const SHAFTS: readonly {
  readonly r: number;
  readonly lateral: number;
  readonly top: number;
  readonly width: number;
  readonly opacity: number;
}[] = [
  { r: 38.6, lateral: -1.1, top: 7.2, width: 2.0, opacity: 0.11 },
  { r: 41.8, lateral: 0.8, top: 7.6, width: 2.4, opacity: 0.13 },
  { r: 44.6, lateral: -0.7, top: 7.0, width: 1.8, opacity: 0.1 },
  { r: 46.9, lateral: 0.5, top: 6.6, width: 1.6, opacity: 0.085 },
];

/** The moss palette: deep, cool, shaded greens for the floor of the nave. */
const MOSS_TONES = [0x465f38, 0x516e40, 0x3d5631];

/**
 * Connective-2 (MASTER Batch 2): the Tier A density uplift's one named
 * subtree, same idiom as the gate veil's — the wave-8 tests that pin the
 * ORIGINAL flora exclude this name from their draw caps and nothing else;
 * `tests/wingsConnective2.test.ts` measures what lives inside it against
 * R2's ceilings. The three uplifted wings share the literal.
 */
export const CONN2_GROUP_NAME = "wing-uplift-conn2";

/**
 * The nave floor's turf: the aisle's hard fence (the W1 aisle pin reads
 * every instance), the wedge's angular margin, and the radial band the
 * carve owns at full weight.
 */
const TURF_AISLE_FENCE = 1.78;
const TURF_R_MIN = 34.2;
const TURF_R_MAX = 47.2;

/** The turf palettes: the nave's own leaf tones under the TIP_GOLD kin.
 *  r2: a value step brighter across the board — under the emerald mood's
 *  light share the r1 turf read as near-black stubble at pose range. */
const TURF_BLADE = { base: 0x5d924f, tip: 0xa8c463, shade: 0x35522f } as const;
const TURF_FROND = { base: 0x4a7a42, tip: 0x7fae5c, shade: 0x2f4a30 } as const;

/** The drape bank on the wedge walls: deep emerald, gold at the tips. */
const DRAPE_PALETTE = { base: 0x557a48, tip: 0x9cb45e, shade: 0x2c4030, accent: 0x5f7f52 } as const;

/** The cushion stars at the column feet: leaf-green bodies, gilt arms. */
const STAR_PALETTE = { base: 0x5f7d3f, tip: 0xc9b968 } as const;

export function buildKelpCathedralFlora(def: WingDef): WingFlora {
  const group = new Group();
  group.name = "wing-flora-kelp-cathedral";

  const random = new Random(SEEDS.wingKelpCathedral);
  const leafRandom = new Random(SEEDS.wingKelpCathedral ^ 0x1eaf);
  const canopyRandom = new Random(SEEDS.wingKelpCathedral ^ 0xca09);
  const mossRandom = new Random(SEEDS.wingKelpCathedral ^ 0x4d05);
  const shaftRandom = new Random(SEEDS.wingKelpCathedral ^ 0x5af7);

  const sway = { value: 0 };
  const wind = { value: 1 };
  const sunView = createSunViewUniform();

  const contacts: ContactPatch[] = [];
  const stalks: BufferGeometry[] = [];
  const leaves: BufferGeometry[] = [];
  const columnFeet: { x: number; z: number; lateral: number; phase: number }[] = [];

  // ─── The nave ────────────────────────────────────────────────────────────
  // Two rows at the same seven stations, so the aisle reads as an aisle. The
  // lateral band keeps every foot where `wingBlend` is at least half: floor,
  // not wall.
  for (const r of COLUMN_STATIONS) {
    for (const side of [-1, 1]) {
      const lateralHigh = Math.min(
        ROW_LATERAL_MAX,
        (r * (def.wedge.floorHalf + wedgeHalfAt(def, r))) / 2 - 0.75,
      );
      const lateral = side * random.range(AISLE_HALF + 0.02, Math.max(AISLE_HALF + 0.06, lateralHigh));
      const { x, z } = polarPoint(def, r, lateral);
      const height = random.range(HEIGHT_MIN, HEIGHT_MAX);
      // The lean points up- or down-aisle, never across it: a nave's columns
      // bow along the nave, and no spine wander can carry a crown ribbon
      // through the wedge's wall. The two stations nearest the gate wear
      // shorter straps — the walls are closest there.
      const leanAzimuth =
        def.azimuth + (random.next() < 0.5 ? 0 : Math.PI) + random.signed(0.5);
      const strapScale = r < 40 ? 0.8 : 1;
      const phase = growColumn(
        stalks,
        leaves,
        leafRandom,
        canopyRandom,
        x,
        z,
        height,
        leanAzimuth,
        strapScale,
        false,
      );
      columnFeet.push({ x, z, lateral, phase });
      contacts.push({ x, z, radius: 0.85, strength: 0.4 });
    }
  }

  // ─── The gate sentinels ──────────────────────────────────────────────────
  // Two younger columns on the jamb slopes (blend 0.1–0.5, where wall
  // dressing belongs), flanking the doorway the swimmer passes through.
  for (const side of [-1, 1]) {
    const r = random.range(31.4, 32.6);
    const lateral = side * random.range(2.75, 3.1);
    const { x, z } = polarPoint(def, r, lateral);
    const height = random.range(SENTINEL_MIN, SENTINEL_MAX);
    const leanAzimuth = def.azimuth + (random.next() < 0.5 ? 0 : Math.PI) + random.signed(0.4);
    // A jamb sentinel's straps grow over the doorway, never into the wall —
    // a green arch above the corridor, and the wall angle stays uncrossed.
    const strapBias = -(def.azimuth - side * (Math.PI / 2));
    growColumn(stalks, leaves, leafRandom, canopyRandom, x, z, height, leanAzimuth, 1, true, strapBias);
    contacts.push({ x, z, radius: 0.7, strength: 0.35 });
  }

  // ─── The fronds at the feet ──────────────────────────────────────────────
  // Low straps lying outward from each column's holdfast: the nave's floor
  // cover. They hang *away* from the axis by construction, so the aisle is
  // never crossed by so much as a leaf.
  const axis = { x: Math.cos(def.azimuth), z: Math.sin(def.azimuth) };
  const perp = { x: -axis.z, z: axis.x };
  for (const foot of columnFeet) {
    const fronds = 2 + Math.floor(leafRandom.next() * 2);
    for (let i = 0; i < fronds; i++) {
      const outward = Math.sign(foot.lateral);
      const around = leafRandom.signed(0.55);
      const length = leafRandom.range(0.8, 1.35);
      const width = length * leafRandom.range(0.3, 0.44);
      const droop = leafRandom.range(1.15, 1.7);
      const rise = leafRandom.range(0.25, 0.5);
      const offset = leafRandom.range(0.28, 0.6);
      const jitter = leafRandom.signed(0.3);
      const raw = {
        x: foot.x + perp.x * outward * offset + axis.x * jitter,
        z: foot.z + perp.z * outward * offset + axis.z * jitter,
      };
      // A frond root over the wall angle would stand on rim rock metres
      // above its own column — fold it back inside.
      const { x: fx, z: fz } = clampInsideWedge(def, raw.x, raw.z, outward, 0.018);
      const strap = strapGeometry(length, width, droop, rise, LEAF_TONES[i % LEAF_TONES.length]!, leafRandom);
      // rotateY(θ) maps local +x to world azimuth −θ, so the yaw that points
      // a strap off-axis is minus the perp's own azimuth.
      const world = def.azimuth + (outward > 0 ? Math.PI / 2 : -Math.PI / 2) + around;
      strap.applyMatrix4(new Matrix4().makeRotationY(-world));
      strap.translate(fx, seabedHeight(fx, fz) + 0.04, fz);
      addSwayAttributes(strap, foot.phase + leafRandom.signed(0.6), 1, () => 0.55, SWAY_REACH);
      leaves.push(strap);
    }
  }

  group.add(buildMerged(stalks, stalkMaterial(sway, wind), "cathedral-stalks"));
  const leafMesh = buildMerged(leaves, leafMaterial(sway, wind, sunView), "cathedral-leaves");
  trackSunView(leafMesh, sunView);
  group.add(leafMesh);

  group.add(buildMoss(mossRandom, def, columnFeet));
  for (const shaft of buildShafts(shaftRandom, def)) {
    group.add(shaft);
  }
  group.add(buildPools(def));

  // ─── Connective-2: the Tier A uplift (MASTER Batch 2) ───────────────────
  // The nave's floor and walls, dressed: blade and frond turf through the
  // wedge floor (the R12 quality profiles, sun-through-leaf glow on the
  // blades), a drape bank hanging from the wall slopes, and cushion stars
  // seated at the column feet. Every piece rides its own fresh `^`
  // substream fed to a kit-private Random, appended after every existing
  // draw — nothing above re-rolls (the W1 aisle pins and the connective-1
  // sentinels hold) — and everything lives under one named group so the
  // wave-8 draw cap keeps pinning the original flora.
  const uplift = new Group();
  uplift.name = CONN2_GROUP_NAME;

  // The turf's fences, as a gate: the aisle stays open (the W1 pin reads
  // every instance at ≥ 1.65 m), the wedge's angular margin holds, and the
  // band is the carve's own floor.
  const turfGate = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    if (r < TURF_R_MIN || r > TURF_R_MAX) {
      return 0;
    }
    if (Math.abs(lateralOf(def, x, z)) < TURF_AISLE_FENCE) {
      return 0;
    }
    if (angleOffAxis(def, x, z) > wedgeHalfAt(def, r) - 0.012) {
      return 0;
    }
    return 1;
  };
  const flankRoad = {
    polyline: [
      [polarPoint(def, 34.6, 2.6).x, polarPoint(def, 34.6, 2.6).z],
      [polarPoint(def, 47, 2.9).x, polarPoint(def, 47, 2.9).z],
      [polarPoint(def, 47, -2.9).x, polarPoint(def, 47, -2.9).z],
      [polarPoint(def, 34.6, -2.6).x, polarPoint(def, 34.6, -2.6).z],
    ] as [number, number][],
    width: 3.2,
  };

  const bladeTurf = buildCarpetField({
    seed: (SEEDS.wingKelpCathedral ^ 0x2b1a) >>> 0,
    palette: TURF_BLADE,
    area: flankRoad,
    gate: turfGate,
    ground: seabedHeight,
    count: 380,
    profile: "blade",
    size: [0.38, 0.78],
    swayAmp: 0.045,
    sunGlow: true,
    looseShare: 0.45,
  });
  uplift.add(bladeTurf.group);

  const frondTurf = buildCarpetField({
    seed: (SEEDS.wingKelpCathedral ^ 0x2b2b) >>> 0,
    palette: TURF_FROND,
    area: flankRoad,
    gate: turfGate,
    ground: seabedHeight,
    count: 110,
    profile: "frond",
    swayAmp: 0.03,
    looseShare: 0.25,
  });
  uplift.add(frondTurf.group);

  // The wall drapes: eight holdfasts a body's height up the wedge walls,
  // alternating flanks down the nave — the "bare walls" answer.
  const drapeRandom = new Random(SEEDS.wingKelpCathedral ^ 0x2b3c);
  const drapeAnchors: DrapeAnchor[] = [];
  for (let i = 0; i < 8; i++) {
    const r = 35.2 + i * 1.5 + drapeRandom.signed(0.45);
    const side = i % 2 === 0 ? 1 : -1;
    // r2: holdfasts a full body's height and more up the wall — at r1's
    // 1.1–2.5 m the banks hid behind the columns' own feet.
    const lift = drapeRandom.range(1.8, 3.4);
    drapeAnchors.push(wallAnchor(def, r, side, lift));
  }
  const drapes = buildWallDrapeBank({
    seed: (SEEDS.wingKelpCathedral ^ 0x2b3c) >>> 0,
    palette: DRAPE_PALETTE,
    anchors: drapeAnchors,
    strandsPerAnchor: 6,
    length: 1.8,
    swayAmp: 0.05,
  });
  uplift.add(drapes.group);

  // The cushion stars: seated colonies at every other column's holdfast
  // (movers are banned in a wing — R2 keeps frustum culling on).
  const starAnchors = columnFeet
    .filter((_, index) => index % 2 === 0)
    .map((foot) => ({
      pos: [foot.x, seabedHeight(foot.x, foot.z) + 0.01, foot.z] as const,
    }));
  const stars = buildPercherColony({
    seed: (SEEDS.wingKelpCathedral ^ 0x2b4d) >>> 0,
    palette: STAR_PALETTE,
    anchors: starAnchors,
    perAnchor: 3,
    body: "star",
    motion: "seated",
  });
  uplift.add(stars.group);

  group.add(uplift);

  // ─── The gate veil (connective-1) ────────────────────────────────────────
  // The opened end wall dressed with the Great Kelp Sea's own inks — deep
  // spring greens receding behind the door, a soft leaf-lit column and a
  // drift of pollen-pale motes — so the nave's axis ends on a promise of
  // the country beyond instead of the backdrop's flat cut. Appended after
  // every existing draw, on its own `^` substream: nothing above re-rolls.
  const veil = mountGateVeil(def, {
    width: 7.5,
    height: 6,
    palette: [0x123526, 0x22553c, 0x3e7a58],
    column: { tint: 0xe4f0c0, opacity: 0.1 },
    particulate: { tint: 0xdce8a8, count: 90 },
  });
  group.add(veil.group);

  let upliftTime = 0;
  return {
    group,
    contacts,
    update(dt: number, reducedMotion: boolean): void {
      // The Kelp idiom: a vault this tall keeps breathing under reduced
      // motion, at a third of the rate and two fifths of the strength.
      sway.value += dt * (reducedMotion ? 0.3 : 1);
      wind.value = reducedMotion ? 0.4 : 1;
      // The uplift's sway rides the same becalmed clock (closed-form off
      // simulated seconds — the kit contract).
      upliftTime += dt * (reducedMotion ? 0.3 : 1);
      bladeTurf.update(upliftTime);
      frondTurf.update(upliftTime);
      drapes.update(upliftTime);
      veil.update(dt, reducedMotion);
    },
  };
}

/**
 * A drape holdfast on the wedge wall at radius `r`: the wall's angle is
 * searched (never drawn from a stream) for the point standing `lift`
 * metres over the wing's own floor, so a bank hangs where the eye reads
 * "wall" whatever the slope does locally. The normal faces the axis —
 * strands droop into the nave, never through the wall.
 */
function wallAnchor(def: WingDef, r: number, side: number, lift: number): DrapeAnchor {
  const axisSpot = polarPoint(def, r, 0);
  const floorY = seabedHeight(axisSpot.x, axisSpot.z);
  // The angular window: never nearer the axis than the aisle plus a full
  // strand's reach (a holdfast may hang nothing over the nave's heart),
  // never nearer the wedge edge than a pad's slip.
  let lo = Math.max(def.wedge.floorHalf, 3.6 / r);
  let hi = wedgeHalfAt(def, r) - 0.015;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const spot = polarPoint(def, r, side * mid * r);
    if (seabedHeight(spot.x, spot.z) - floorY < lift) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const angle = (lo + hi) / 2;
  const { x, z } = polarPoint(def, r, side * angle * r);
  const perpX = -Math.sin(def.azimuth);
  const perpZ = Math.cos(def.azimuth);
  return {
    pos: [x, seabedHeight(x, z) + 0.04, z],
    normal: [-side * perpX, 0.12, -side * perpZ],
  };
}

/**
 * One column: a lathed stipe on its own S, plus the straps it carries. The
 * whole plant's spine displaces along `leanAzimuth` (world) — the caller
 * points it along the aisle — which fixes the stalk's yaw, since a
 * `rotateY(θ)` maps local +x to world azimuth −θ.
 */
function growColumn(
  stalks: BufferGeometry[],
  leaves: BufferGeometry[],
  leafRandom: Random,
  canopyRandom: Random,
  x: number,
  z: number,
  height: number,
  leanAzimuth: number,
  strapScale: number,
  sentinel: boolean,
  strapBias?: number,
): number {
  const foot = seabedHeight(x, z);
  const phase = leafRandom.range(0, Math.PI * 2);
  const yaw = -leanAzimuth;
  // A cathedral column stands nearly straight: ten metres of stipe at a
  // grown kelp's lean would put the crown off its own clearances. The S is
  // still two harmonics — a spine settling through the water, not a pole.
  const lean = leafRandom.range(0.04, 0.1);
  const wave = leafRandom.signed(0.05);
  const wave2 = Math.sin(phase * 3.7) * 0.03;
  const curve = (t: number): number =>
    (lean * t * t + wave * Math.sin(t * Math.PI * 1.35) + wave2 * Math.sin(t * Math.PI * 2.6)) *
    height;

  const stalk = bendedStalk(height, curve, leafRandom.range(0.1, 0.14));
  stalk.applyMatrix4(new Matrix4().makeRotationY(yaw));
  stalk.translate(x, foot, z);
  addSwayAttributes(stalk, phase, height, (y) => (y - foot) / height, SWAY_REACH);
  stalks.push(stalk);

  const fullness = sentinel ? Math.min(1, Math.max(0.55, height / 8.5)) : 1;
  const attach = (
    t: number,
    around: number,
    length: number,
    width: number,
    droop: number,
    tone: number,
    rise: number,
  ): void => {
    const strap = strapGeometry(length, width, droop, rise, tone, leafRandom);
    const local = new Matrix4()
      .makeTranslation(curve(t), foot + t * height, 0)
      .multiply(new Matrix4().makeRotationY(around - yaw));
    strap.applyMatrix4(local);
    strap.applyMatrix4(new Matrix4().makeRotationY(yaw));
    strap.translate(x, 0, z);
    addSwayAttributes(strap, phase, height, () => t, SWAY_REACH);
    leaves.push(strap);
  };

  // The straps, spiralled up the stipe a golden angle apart and biased toward
  // the crown, where a frond's growth is. Length is capped so a ten-metre
  // column does not trail five-metre ribbons through its neighbours.
  const count = Math.round(leafRandom.range(STRAPS_MIN, STRAPS_MAX) * fullness);
  for (let i = 0; i < count; i++) {
    const t =
      STRAP_FROM +
      Math.pow((i + leafRandom.range(0.1, 0.9)) / count, 0.66) * (STRAP_TO - STRAP_FROM);
    // A biased column (the gate sentinels) points every strap one way — the
    // net rotation maps a strap's local +x to world azimuth −around.
    const around =
      strapBias !== undefined ? strapBias + leafRandom.signed(0.7) : yaw + i * 2.4 + leafRandom.signed(0.5);
    // Sentinels and gate-side stations wear shorter straps: the walls are
    // closest there, and a column's ribbons must stay inside them.
    const reach =
      Math.min(1.25, height / HEIGHT_MAX + 0.28) * strapScale * (sentinel ? 0.62 : 1);
    const length = leafRandom.range(1.3, 2.5) * (0.62 + t * 0.5) * reach;
    const width = length * leafRandom.range(0.34, 0.48);
    const droop = leafRandom.range(0.3, 0.8) * (1.15 - t * 0.5) * (t > 0.75 ? 1.6 : 1);
    const rise = leafRandom.range(0.2, 0.65);
    attach(t, around, length, width, droop, LEAF_TONES[i % LEAF_TONES.length]!, rise);
  }

  // The crown: a burst of trailing ribbons at the stipe's surface end. The
  // hard droop is also the confinement: a ribbon that turns over pulls its
  // horizontal reach in as it hangs, so the crown fills the vault overhead
  // without crossing the wall's angle.
  const crownCount = Math.round(canopyRandom.range(CROWN_MIN, CROWN_MAX) * fullness);
  const crownReach = Math.min(1, height / HEIGHT_MIN);
  for (let i = 0; i < crownCount; i++) {
    const t = canopyRandom.range(0.86, 1.0);
    const around =
      strapBias !== undefined
        ? strapBias + canopyRandom.signed(0.55)
        : yaw + canopyRandom.range(0, Math.PI * 2);
    const length = canopyRandom.range(1.9, 3.0) * crownReach;
    const width = length * canopyRandom.range(0.3, 0.44);
    const droop = canopyRandom.range(1.15, 1.7);
    const rise = canopyRandom.range(0.15, 0.42);
    attach(t, around, length, width, droop, LEAF_TONES[i % LEAF_TONES.length]!, rise);
  }

  // The canopy pads: a ring of broad, near-horizontal blades at the very top,
  // evenly fanned — the vault's ceiling of leaf. Kept off the sentinels:
  // a gate column wearing a full crown would crop the doorway's light.
  if (!sentinel) {
    const padCount = Math.round(canopyRandom.range(PADS_MIN, PADS_MAX));
    for (let i = 0; i < padCount; i++) {
      const t = canopyRandom.range(0.95, 1.0);
      const around = yaw + (i / padCount) * Math.PI * 2 + canopyRandom.signed(0.4);
      const length = canopyRandom.range(1.15, 1.7) * crownReach;
      const width = length * canopyRandom.range(0.5, 0.64);
      const droop = canopyRandom.range(0.18, 0.36);
      attach(t, around, length, width, droop, LEAF_TONES[(i + 1) % LEAF_TONES.length]!, 0);
    }
  }

  return phase;
}

/**
 * A stipe: a lathe for the taper (thickest at the holdfast, with the small
 * swell where a kelp visibly anchors), then every ring slid onto the S-curve
 * — `Kelp.bendedStalk`'s move, safe because a ring moves as one and the
 * surface stays closed.
 */
function bendedStalk(height: number, curve: (t: number) => number, radius: number): BufferGeometry {
  const points: Vector2[] = [new Vector2(0, -0.12)];
  for (let i = 0; i <= STALK_RINGS; i++) {
    const t = i / STALK_RINGS;
    const taper = (1.35 - t * 0.95) * (1 + Math.exp(-t * 9) * 0.5);
    points.push(new Vector2(radius * taper, t * height));
  }
  points.push(new Vector2(0, height));

  const geometry = new LatheGeometry(points, STALK_SIDES);
  const position = geometry.attributes.position!;
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const t = Math.min(1, Math.max(0, y / height));
    position.setX(i, position.getX(i) + curve(t));
    shade.copy(STALK_TINT).multiplyScalar(0.7 + t * 0.55);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/** The lanceolate profile's baseline taper; `Kelp.outline`'s own shape. */
function outline(v: number, peak: number): number {
  return Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, v)), peak)) ** 0.62;
}

/** FNV-1a over a strap's drawn floats; see `Kelp.leafDetailSeed` for the why. */
function strapDetailSeed(length: number, width: number, droop: number, rise: number): number {
  let hash = 0x811c9dc5;
  for (const value of [length, width, droop, rise]) {
    const bits = new Uint32Array(new Float32Array([value]).buffer)[0]!;
    hash = Math.imul(hash ^ bits, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * One strap, shaped from a flat strip in edge coordinates: the silhouette in
 * the geometry, the margin wave cutting only inward, the droop integrated
 * along the arc so a hanging ribbon's reach shrinks as it turns over — the
 * kelp forest's `shapeLeaf`, at one tessellation for every strap.
 */
function strapGeometry(
  length: number,
  width: number,
  droop: number,
  rise: number,
  tone: number,
  random: Random,
): BufferGeometry {
  const rows = 5;
  const geometry = new PlaneGeometry(1, 1, 2, rows);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(i, position.getX(i) * 2, position.getY(i) + 0.5, 0);
  }

  const detail = new Random(strapDetailSeed(length, width, droop, rise));
  const peak = detail.range(0.7, 0.96);
  const margin = detail.range(0.06, 0.13);
  const marginFreq = detail.range(1.2, 2.2);
  const marginPhase = detail.range(0, Math.PI * 2);
  const ruffle = detail.range(0.012, 0.024) * length;
  const ruffleFreq = detail.range(1.0, 1.9);
  const rufflePhase = detail.range(0, Math.PI * 2);
  const cupBack = detail.range(0.12, 0.18);

  const tint = new Color(tone).multiplyScalar(random.range(0.86, 1.12));
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const v = position.getY(i);
    const edge = position.getX(i);
    const wave =
      1 -
      margin *
        (0.5 + 0.5 * Math.sin(v * marginFreq * Math.PI * 2 + marginPhase + (edge < 0 ? 2.1 : 0)));
    const half = Math.min(outline(v, peak), outline(v, 0.82)) * wave;
    const across = edge * half * 0.5 * width;
    const bent = arcAlong(v, droop, rise);
    const reach = bent.along * length;
    const fall =
      -bent.drop * length + Math.sin(v * ruffleFreq * Math.PI * 2 + rufflePhase) * ruffle * v;
    const cup = Math.abs(across) * cupBack;
    position.setXYZ(i, reach - cup, fall, across);

    shade
      .copy(tint)
      .lerp(TIP_GOLD, v * v * 0.38)
      .multiplyScalar(0.82 + v * 0.3);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/** `Kelp.arcAlong` unchanged: arc length is exactly the strap's length. */
function arcAlong(v: number, droop: number, rise: number): { along: number; drop: number } {
  const clamped = Math.min(1, Math.max(0, v));
  const steps = 12;
  const dv = clamped / steps;
  let along = 0;
  let drop = 0;
  for (let s = 0; s < steps; s++) {
    const angle = droop * Math.pow((s + 0.5) * dv, 1.4) - rise;
    along += Math.cos(angle) * dv;
    drop += Math.sin(angle) * dv;
  }
  return { along, drop };
}

function buildMerged(parts: BufferGeometry[], material: MeshToonMaterial, name: string): Mesh {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error(`cathedral ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  // The forest's own budget rule, kept: leaves in the shadow pass cost far
  // more than the stippling they would put on the sand, and these fronds
  // live in open water where a shadow sample buys almost nothing.
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function stalkMaterial(sway: { value: number }, wind: { value: number }): MeshToonMaterial {
  const material = createToonMaterial({ map: stalkTexture(), vertexColors: true });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    injectWingSway(shader, sway, wind, DRIFT_X, DRIFT_Z);
  };
  return material;
}

function leafMaterial(
  sway: { value: number },
  wind: { value: number },
  sunView: ReturnType<typeof createSunViewUniform>,
): MeshToonMaterial {
  const material = createToonMaterial({
    side: DoubleSide,
    map: strapTexture(),
    vertexColors: true,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    injectWingSway(shader, sway, wind, DRIFT_X, DRIFT_Z);
    // The forest's two translucency notes, tuned a shade deeper for the
    // nave: cool view-facing glow, and the warm term that puts light in the
    // crowns when a strap crosses the sun.
    injectLeafGlow(
      shader,
      sunView,
      "vec3(0.10, 0.20, 0.15)",
      "vec3(0.36, 0.30, 0.10)",
      "clamp(vMapUv.y, 0.0, 1.0)",
    );
  };
  return material;
}

/** The moss at the column feet: instanced shaded pads, darker at the rim. */
function buildMoss(
  random: Random,
  def: WingDef,
  feet: readonly { x: number; z: number; lateral: number }[],
): InstancedMesh {
  const geometry = new IcosahedronGeometry(0.16, 1);
  geometry.scale(1, 0.35, 1);
  smoothNormals(geometry);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i) / 0.056 * 0.5 + 0.5));
    const value = 0.55 + 0.45 * t;
    colors[i * 3] = value;
    colors[i * 3 + 1] = value;
    colors[i * 3 + 2] = value * 0.92;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const material = createToonMaterial({ vertexColors: true });

  const spots: { x: number; z: number; scale: number; tone: number }[] = [];
  for (const foot of feet) {
    const pads = 3 + Math.floor(random.next() * 3);
    for (let i = 0; i < pads; i++) {
      const angle = random.range(0, Math.PI * 2);
      const spread = random.range(0.3, 0.9);
      const x = foot.x + Math.cos(angle) * spread;
      const z = foot.z + Math.sin(angle) * spread;
      const scale = random.range(0.7, 1.5);
      const tone = random.next();
      // The aisle's heart stays open, and no pad roots on rim rock: pads
      // that rolled either way are folded back inside their fences rather
      // than re-drawn.
      const side = Math.sign(lateralOf(def, x, z) || foot.lateral) || 1;
      const inside = clampInsideWedge(def, x, z, side, 0.012);
      const lateral = lateralOf(def, inside.x, inside.z);
      if (Math.abs(lateral) < 1.7) {
        const fixed = polarPoint(def, Math.hypot(inside.x, inside.z), side * 1.75);
        spots.push({ x: fixed.x, z: fixed.z, scale, tone });
      } else {
        spots.push({ x: inside.x, z: inside.z, scale, tone });
      }
    }
  }
  // A handful between the rows, so the nave's floor is dressed end to end.
  for (let i = 0; i < 8; i++) {
    const r = random.range(37.5, 47);
    const side = random.next() < 0.5 ? -1 : 1;
    const lateral = side * random.range(1.8, 3.6);
    const { x, z } = polarPoint(def, r, lateral);
    spots.push({ x, z, scale: random.range(0.8, 1.6), tone: random.next() });
  }

  const mesh = new InstancedMesh(geometry, material, spots.length);
  mesh.name = "cathedral-moss";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const dummy = new Object3D();
  const color = new Color();
  for (const [i, spot] of spots.entries()) {
    dummy.position.set(spot.x, seabedHeight(spot.x, spot.z) + 0.02, spot.z);
    dummy.rotation.set(0, spot.tone * Math.PI * 2, 0);
    dummy.scale.set(spot.scale, spot.scale * (0.7 + spot.tone * 0.5), spot.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHex(MOSS_TONES[Math.floor(spot.tone * MOSS_TONES.length) % MOSS_TONES.length]!);
    color.multiplyScalar(0.82 + spot.tone * 0.33);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * The god-light shafts: crossed additive blades on the canyon's light-column
 * pattern, one mesh per shaft so the edge-on fade can fade the pair together
 * on the worse of the two facings. Warm-green: this water keeps its sun.
 */
function buildShafts(random: Random, def: WingDef): Mesh[] {
  const meshes: Mesh[] = [];
  const map = shaftSprite();
  for (const shaft of SHAFTS) {
    const { x, z } = polarPoint(def, shaft.r, shaft.lateral);
    const foot = seabedHeight(x, z) - 0.5;
    const length = shaft.top - foot;
    const centerY = (shaft.top + foot) / 2;
    const turn = random.range(0, Math.PI / 2);

    const blades: BufferGeometry[] = [];
    const normals: Vector3[] = [];
    for (const spin of [0, Math.PI / 2]) {
      const blade = new PlaneGeometry(shaft.width, length, 4, 20);
      const yaw = turn + spin + random.signed(0.12);
      blade.rotateY(yaw);
      blade.translate(x, centerY, z);
      blades.push(blade);
      normals.push(new Vector3(Math.sin(yaw), 0, Math.cos(yaw)));
    }
    const geometry = mergeGeometries(blades, false);
    for (const blade of blades) {
      blade.dispose();
    }
    if (!geometry) {
      throw new Error("cathedral shaft blades could not be merged");
    }
    bakeGroundFade(geometry);
    geometry.computeBoundingSphere();

    const material = new MeshBasicMaterial({
      map,
      transparent: true,
      opacity: shaft.opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      vertexColors: true,
      fog: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = "cathedral-shaft";
    mesh.renderOrder = 2;
    const center = new Vector3(x, centerY, z);
    mesh.onBeforeRender = (_renderer, _scene, camera: Camera) => {
      const view = new Vector3().subVectors(center, camera.position);
      const distance = view.length();
      if (distance < 1e-4) {
        return;
      }
      view.multiplyScalar(1 / distance);
      let facing = 1;
      for (const normal of normals) {
        facing = Math.min(facing, Math.abs(view.dot(normal)));
      }
      material.opacity = shaft.opacity * smoothstep01((facing - 0.06) / 0.24);
    };
    meshes.push(mesh);
  }
  return meshes;
}

/** The light pools where the two brightest shafts land; see `SHAFTS`. */
function buildPools(def: WingDef): Mesh {
  const rings: BufferGeometry[] = [];
  for (const shaft of [SHAFTS[0]!, SHAFTS[1]!]) {
    const { x, z } = polarPoint(def, shaft.r, shaft.lateral);
    const ring = new RingGeometry(0, shaft.width * 0.55, 24, 6);
    ring.rotateX(-Math.PI / 2);
    const position = ring.attributes.position!;
    const fade = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const lx = position.getX(i);
      const lz = position.getZ(i);
      position.setY(i, seabedHeight(x + lx, z + lz) + 0.06);
      const edge = 1 - smoothstep01((Math.hypot(lx, lz) / (shaft.width * 0.55) - 0.4) / 0.6);
      fade[i * 3] = edge;
      fade[i * 3 + 1] = edge;
      fade[i * 3 + 2] = edge;
    }
    position.needsUpdate = true;
    ring.setAttribute("color", new BufferAttribute(fade, 3));
    ring.translate(x, 0, z);
    rings.push(ring);
  }
  const geometry = mergeGeometries(rings, false);
  for (const ring of rings) {
    ring.dispose();
  }
  if (!geometry) {
    throw new Error("cathedral light pools could not be merged");
  }
  geometry.computeBoundingSphere();
  const material = new MeshBasicMaterial({
    map: poolSprite(),
    color: 0xd8e8b4,
    vertexColors: true,
    transparent: true,
    opacity: 0.2,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "cathedral-light-pools";
  mesh.renderOrder = 1;
  return mesh;
}

/** Writes a shaft's fade into the sand into its vertex colours. */
function bakeGroundFade(geometry: BufferGeometry): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const above = position.getY(i) - seabedHeight(position.getX(i), position.getZ(i));
    const fade = smoothstep01((above - 0.15) / 1.65);
    colors[i * 3] = fade;
    colors[i * 3 + 1] = fade;
    colors[i * 3 + 2] = fade;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** The straps' map: root-to-tip gradient with a midrib and lengthwise fibre. */
let strapMap: DataTexture | undefined;
function strapTexture(): DataTexture {
  strapMap ??= buildColorTexture(48, (u, v) => {
    const rib = 1 - Math.exp(-((u - 0.5) ** 2) / 0.004) * 0.22;
    const fibre =
      0.9 + fbm(u * 3, v, { seed: SEEDS.wingKelpCathedral ^ 0x1e, period: 10, octaves: 2 }) * 0.22;
    const shade = (0.6 + v * 0.52) * fibre * rib;
    return [shade * 0.84, shade, shade * 0.58];
  });
  return strapMap;
}

/** A stipe is a fibrous cord: lengthwise grain and nothing else. */
let stalkMap: DataTexture | undefined;
function stalkTexture(): DataTexture {
  stalkMap ??= buildColorTexture(32, (u, v) => {
    const grain =
      0.64 +
      fbm(u * 2, v * 6, { seed: SEEDS.wingKelpCathedral ^ 0x51, period: 8, octaves: 2 }) * 0.3;
    return [grain * 0.92, grain, grain * 0.72];
  });
  return stalkMap;
}

/**
 * The shafts' map: a soft bell across, brightest in the upper body.
 *
 * Atelier repaint: the bell widened (^1.5 → ^2.6) and both lengthwise fades
 * lengthened — at ^1.5 the blade still carried ~15% of its peak two texels
 * from the side edge, and against the milky end-of-wing water that residue
 * read as a hard quad boundary. A god shaft's whole job is to have no edge
 * anyone can point at.
 */
let shaftSpriteTexture: DataTexture | undefined;
function shaftSprite(): DataTexture {
  shaftSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 2.6);
    const along = Math.pow(v, 1.35) * Math.min(1, (1 - v) * 2.6);
    const value = bell * along;
    return [value * 0.78, value, value * 0.62];
  });
  return shaftSpriteTexture;
}

/** The pools' soft radial glow, wobbled so its rim is not a circle. */
let poolSpriteTexture: DataTexture | undefined;
function poolSprite(): DataTexture {
  poolSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const wobble = fbm(u, v, { seed: SEEDS.wingKelpCathedral ^ 0x90, period: 3, octaves: 2 });
    const rim = Math.hypot(u - 0.5, v - 0.5) * 2;
    const distance = Math.min(1, rim * (0.86 + 0.3 * wobble));
    const halo = Math.pow(Math.max(0, 1 - distance * distance), 2.4);
    return [halo, halo, halo];
  });
  return poolSpriteTexture;
}
