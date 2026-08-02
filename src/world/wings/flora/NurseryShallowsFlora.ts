import {
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  type BufferGeometry,
  type DataTexture,
  type MeshToonMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { coralGeometry, coralSkin, type CoralKind } from "../../CoralShapes";
import { buildGroundLitter } from "../../regions/kit/GroundLitter";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { angleBetween, wedgeHalfAt } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";
import { mountGateVeil } from "./GateVeilMount";
import { TIERB_GROUP_NAME } from "./TierBUplift";
import { clampInsideWedge, polarPoint, sampleWedgePoint } from "./W1FloraShared";

/**
 * Wing 1 — the Nursery Shallows. Tenderness and morning.
 *
 * The floor here *rises* to +1.6, a sun-warmed sand terrace above the bowl's
 * own level, and everything growing on it is small: broods of baby corals at
 * a fifth to two fifths of the reef garden's size in pastel tints, and tiny
 * grass tufts barely taller than a hand. Nothing is a landmark; a nursery is
 * read in clusters, not monuments.
 *
 * The corridor contract (the wing hosts a moray den on its axis at r 40–43,
 * dressed by another worker): *every* piece of flora stands at least 0.06 rad
 * off the axis for r 30–46 — enforced once in {@link corridorFence}, applied
 * at sampling and re-clamped per instance in {@link clampToCorridor} — and
 * the r 30–34 gate corridor carries nothing at all but two small boulders on
 * the jamb slopes at the wedge's very edge. The test suite sweeps every
 * instance against both rules.
 *
 * Streams: `SEEDS.wingNurseryShallows` for placement, `^ 0x9a1e` for the
 * broods' pastel families, `^ 0x6a55` for the grass — so retuning the tufts
 * can never move a coral. Everything is drawn up front; nothing here loads
 * asynchronously.
 */

/** How far off the axis the den corridor keeps every piece of flora. */
const CORRIDOR_RAD = 0.06;
/** The corridor runs to r = 46; past it the wedge's own edge is the fence. */
const CORRIDOR_TO = 46;
/** Broods and tufts live in this radial band — the gate corridor stays bare. */
const FLORA_FROM = 35;
const FLORA_TO = 47.2;

/** The baby-coral scale range, as a fraction of the garden's own pieces. */
const BABY_MIN = 0.2;
const BABY_MAX = 0.45;

const BROOD_COUNT = 12;
const TUFT_COUNT = 24;

/**
 * The pastel families, one per brood: a nursery reads as patches of related
 * young, not confetti. Values stay high — this is the brightest water in the
 * game, and a baby coral in shade is an oxymoron.
 */
const PASTELS: readonly (readonly number[])[] = [
  [0xe8aab4, 0xf0c0c0, 0xdda0b0], // rose
  [0xf0c09a, 0xe8b088, 0xf2d0b0], // peach
  [0xf0e2c2, 0xe8d8b8, 0xf2e6cc], // cream
  [0xd0b4e0, 0xc4a8d8, 0xdcc4e8], // lilac
];

/** The jambs' warm sand-stone. */
const JAMB_TINT = 0xcfc2a8;

/** The tufts' morning greens, a shade brighter than the reef meadow's. */
const TUFT_TONES = [0x7fae5a, 0x93bd66, 0x6d9e52];

/** The angular fence at a radius: the corridor, then the wedge's own edge. */
function corridorFence(r: number): number {
  return r <= CORRIDOR_TO ? CORRIDOR_RAD + 0.008 : 0.03;
}

interface BabyCoral {
  readonly x: number;
  readonly z: number;
  readonly scale: number;
  readonly yaw: number;
  readonly squash: number;
  readonly hex: number;
  readonly value: number;
}

type BabyKind = "branch" | "boulder" | "polyp";

export function buildNurseryShallowsFlora(def: WingDef): WingFlora {
  const group = new Group();
  group.name = "wing-flora-nursery-shallows";

  const random = new Random(SEEDS.wingNurseryShallows);
  const paletteRandom = new Random(SEEDS.wingNurseryShallows ^ 0x9a1e);
  const grassRandom = new Random(SEEDS.wingNurseryShallows ^ 0x6a55);

  const sway = { value: 0 };
  const wind = { value: 1 };

  const contacts: ContactPatch[] = [];
  const babies: Record<BabyKind, BabyCoral[]> = { branch: [], boulder: [], polyp: [] };

  // ─── The broods ──────────────────────────────────────────────────────────
  // Each brood is one kind and one pastel family in a loose cluster — the way
  // a flat actually colonises, one spawn at a time. Kind and family are drawn
  // before the members, so a count or range tune re-rolls no sibling brood.
  for (let b = 0; b < BROOD_COUNT; b++) {
    const center = sampleWedgePoint(random, def, FLORA_FROM, FLORA_TO, corridorFence, 0.014);
    const kindRoll = random.next();
    const kind: BabyKind = kindRoll < 0.45 ? "branch" : kindRoll < 0.75 ? "boulder" : "polyp";
    const family = PASTELS[Math.floor(paletteRandom.next() * PASTELS.length)]!;
    const members = kind === "polyp" ? 8 + Math.floor(random.next() * 7) : 5 + Math.floor(random.next() * 5);
    contacts.push({ x: center.x, z: center.z, radius: 0.95, strength: 0.3 });

    for (let m = 0; m < members; m++) {
      const spread = 0.75 * Math.sqrt(random.next());
      const around = random.range(0, Math.PI * 2);
      const raw = {
        x: center.x + Math.cos(around) * spread,
        z: center.z + Math.sin(around) * spread,
      };
      const side = Math.sign(center.angle) || 1;
      const inside = clampInsideWedge(def, raw.x, raw.z, side, 0.012);
      const { x, z } = clampToCorridor(def, inside.x, inside.z, side);
      const scale = kind === "polyp" ? random.range(1.2, 2.2) : random.range(BABY_MIN, BABY_MAX);
      babies[kind].push({
        x,
        z,
        scale,
        yaw: random.range(0, Math.PI * 2),
        squash: random.range(0.85, 1.15),
        hex: family[m % family.length]!,
        value: random.range(0.9, 1.12) * paletteRandom.range(0.96, 1.04),
      });
    }
  }

  // ─── The gate jambs ──────────────────────────────────────────────────────
  // Two small warm boulders on the jamb slopes at the wedge's very edge —
  // the only dressing near the gate, and the corridor itself stays bare.
  for (const side of [-1, 1]) {
    const r = random.range(32.3, 33.2);
    const angle = side * (wedgeHalfAt(def, r) - 0.022);
    const { x, z } = polarPoint(def, r, angle * r);
    babies.boulder.push({
      x,
      z,
      scale: random.range(0.55, 0.75),
      yaw: random.range(0, Math.PI * 2),
      squash: random.range(0.9, 1.1),
      hex: JAMB_TINT,
      value: random.range(0.95, 1.05),
    });
    contacts.push({ x, z, radius: 0.65, strength: 0.35 });
  }

  for (const kind of ["branch", "boulder", "polyp"] as const) {
    group.add(buildKind(kind, babies[kind]));
  }

  group.add(buildTufts(grassRandom, def, sway, wind));

  // ── Batch 4: the Tier B uplift (MASTER §4 closure, R2 ≤ +6 / ≤ 20k) ──
  // The T1 statement in the nursery's own voice: a shell-grit drift — the
  // broods' spent shell, warm cream over a rosy underside — carpeting the
  // terrace between the pastel clusters. A fresh `^` substream fed to a
  // kit-private Random, appended after every wave-8 draw: nothing above
  // re-rolls (the sentinel pins in tests/wingsTierB.test.ts hold it). The
  // gate keeps the den corridor law (0.06 rad, held at 0.075 + footprint)
  // and stays out of the r 30–34 gate corridor entirely.
  const uplift = new Group();
  uplift.name = TIERB_GROUP_NAME;
  const shellDrift = buildGroundLitter({
    seed: (SEEDS.wingNurseryShallows ^ 0xb401) >>> 0,
    palette: { base: 0xead9bc, shade: 0xc09a90 },
    area: { center: [Math.cos(def.azimuth) * 41, Math.sin(def.azimuth) * 41], radius: 7.5 },
    gate: (x, z) => {
      const r = Math.hypot(x, z);
      if (r < 35 || r > 47) {
        return 0;
      }
      const away = angleBetween(Math.atan2(z, x), def.azimuth);
      if (away < 0.075 || away > wedgeHalfAt(def, r) - 0.02) {
        return 0;
      }
      return 1;
    },
    ground: seabedHeight,
    count: 420,
    shapeSet: "pebble",
    size: [0.04, 0.12],
    grade: 0.4,
  });
  uplift.add(shellDrift.group);
  group.add(uplift);

  // The doorway: a warm sand-rose veil — the terrace's morning promised to
  // the bowl — with a sun-pale column and a drift of shell-gold motes.
  const veil = mountGateVeil(def, {
    doorR: 32,
    width: 4.0,
    height: 3.4,
    sillLift: 0.7,
    palette: [0x6a5240, 0x94765a, 0xc0a482],
    column: { tint: 0xfff0cc, opacity: 0.09 },
    particulate: { tint: 0xf6e6c0, count: 55 },
  });
  group.add(veil.group);

  return {
    group,
    contacts,
    update(dt: number, reducedMotion: boolean): void {
      // The meadow's idiom: the tufts keep breathing under reduced motion,
      // at a third of the rate and two fifths of the strength.
      sway.value += dt * (reducedMotion ? 0.3 : 1);
      wind.value = reducedMotion ? 0.4 : 1;
      veil.update(dt, reducedMotion);
    },
  };
}

/**
 * Re-clamps a point outside the den corridor: for r ≤ 46 the angular offset
 * off the axis is lifted to the fence on the point's own side — a move,
 * never a re-draw, so the streams cannot shift under a fence retune.
 */
function clampToCorridor(
  def: WingDef,
  x: number,
  z: number,
  side: number,
): { x: number; z: number } {
  const r = Math.hypot(x, z);
  if (r > CORRIDOR_TO) {
    return { x, z };
  }
  const angle = angleBetween(Math.atan2(z, x), def.azimuth);
  if (angle >= CORRIDOR_RAD + 0.005) {
    return { x, z };
  }
  return polarPoint(def, r, side * (CORRIDOR_RAD + 0.008) * r);
}

/** One instanced mesh of a coral kind, in the garden's own skin. */
function buildKind(kind: CoralKind, babies: readonly BabyCoral[]): InstancedMesh {
  const skin = coralSkin(kind);
  const material = createToonMaterial({
    map: skin.map,
    normalMap: skin.normal,
    vertexColors: true,
  });
  const mesh = new InstancedMesh(coralGeometry(kind), material, babies.length);
  mesh.name = `nursery-${kind}`;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const color = new Color();
  for (const [i, baby] of babies.entries()) {
    dummy.position.set(baby.x, seabedHeight(baby.x, baby.z) + 0.01, baby.z);
    dummy.rotation.set(0, baby.yaw, 0);
    dummy.scale.set(baby.scale, baby.scale * baby.squash, baby.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHex(baby.hex).multiplyScalar(baby.value);
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
 * The grass tufts: an instanced bowed strip apiece, knee-high at most, on
 * the meadow's own shader sway — the phase rides the instance matrix, so a
 * whole terrace of tufts costs one uniform update per frame.
 */
function buildTufts(
  random: Random,
  def: WingDef,
  sway: { value: number },
  wind: { value: number },
): InstancedMesh {
  const material = tuftMaterial(sway, wind);

  const spots: { x: number; z: number; yaw: number; tall: number; wide: number; tone: number }[] =
    [];
  for (let t = 0; t < TUFT_COUNT; t++) {
    const center = sampleWedgePoint(random, def, FLORA_FROM, FLORA_TO, corridorFence, 0.016);
    const blades = 5 + Math.floor(random.next() * 4);
    for (let b = 0; b < blades; b++) {
      const spread = 0.28 * Math.sqrt(random.next());
      const around = random.range(0, Math.PI * 2);
      const raw = {
        x: center.x + Math.cos(around) * spread,
        z: center.z + Math.sin(around) * spread,
      };
      const side = Math.sign(center.angle) || 1;
      const inside = clampInsideWedge(def, raw.x, raw.z, side, 0.016);
      const { x, z } = clampToCorridor(def, inside.x, inside.z, side);
      spots.push({
        x,
        z,
        yaw: random.range(0, Math.PI * 2),
        tall: random.range(0.25, 0.55),
        wide: random.range(0.8, 1.2),
        tone: random.next(),
      });
    }
  }

  const mesh = new InstancedMesh(bladeGeometry(), material, spots.length);
  mesh.name = "nursery-tufts";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const dummy = new Object3D();
  const color = new Color();
  for (const [i, spot] of spots.entries()) {
    const tiltX = (spot.tone - 0.5) * 0.24;
    const tiltZ = ((spot.tone * 7.3) % 1 - 0.5) * 0.24;
    dummy.position.set(spot.x, seabedHeight(spot.x, spot.z) - 0.02, spot.z);
    dummy.rotation.set(tiltX, spot.yaw, tiltZ);
    dummy.scale.set(spot.wide, spot.tall, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHex(TUFT_TONES[Math.floor(spot.tone * TUFT_TONES.length) % TUFT_TONES.length]!);
    color.multiplyScalar(0.85 + spot.tone * 0.3);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

function tuftMaterial(sway: { value: number }, wind: { value: number }): MeshToonMaterial {
  const material = createToonMaterial({ side: DoubleSide, map: tuftTexture(), vertexColors: true });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uSway = sway;
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uSway;
         uniform float uWind;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         float phase = instanceMatrix[3][0] * 0.6 + instanceMatrix[3][2] * 0.43;
         float tip = clamp(transformed.y, 0.0, 1.0);
         float bend = sin(uSway * 1.3 + phase) * 0.5 + sin(uSway * 0.47 + phase * 1.7) * 0.5;
         transformed.x += bend * 0.12 * uWind * tip * tip;
         transformed.z += bend * 0.07 * uWind * tip * tip;`,
      );
  };
  return material;
}

/**
 * One blade: a tapered, gently bowed strip, root at y = 0 and tip at y = 1,
 * with the root-to-tip brightening baked in. Cones would read as conifers;
 * a blade is a strap that got narrow.
 */
function bladeGeometry(): BufferGeometry {
  const geometry = new PlaneGeometry(1, 1, 1, 3);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = position.getY(i) + 0.5;
    const edge = position.getX(i);
    const half = (1 - t * 0.72) * 0.5 * (t > 0.98 ? 0.12 : 1);
    position.setXYZ(i, edge * half * 0.12, t, 0.2 * t * t);
    const value = 0.7 + 0.45 * t;
    colors[i * 3] = value * 0.92;
    colors[i * 3 + 1] = value;
    colors[i * 3 + 2] = value * 0.7;
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/** The tufts' map: a root-to-tip gradient with lengthwise fibre. */
let tuftMap: DataTexture | undefined;
function tuftTexture(): DataTexture {
  tuftMap ??= buildColorTexture(32, (u, v) => {
    const fibre =
      0.9 +
      fbm(u * 4, v * 2, { seed: SEEDS.wingNurseryShallows ^ 0xb1, period: 8, octaves: 2 }) * 0.2;
    const shade = (0.62 + v * 0.5) * fibre;
    return [shade * 0.8, shade, shade * 0.5];
  });
  return tuftMap;
}
