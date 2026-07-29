import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  type DataTexture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { wedgeHalfAt } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";
import {
  addSwayAttributes,
  clampInsideWedge,
  injectWingSway,
  lateralOf,
  polarPoint,
  sampleWedgePoint,
} from "./W1FloraShared";

/**
 * Wing 2 — the Lumen Garden. Deep-night wonder.
 *
 * The mood tables take nearly all of the sun away down here (floor −10, the
 * deepest carve in the game), so the flora carries its own light: beds of
 * bioluminescent polyps whose glow is baked into vertex gradients and shaped
 * by per-dome tints, lantern-kelp strands with a glowing bulb at each tip,
 * and slow constellations of cyan and indigo motes drifting between them.
 * Every emissive and additive level is sized like the canyon's — peaks far
 * under the bloom pass's 0.82 threshold, because nothing in this water may
 * bloom; the glow must read as *living light*, not as a lamp.
 *
 * The heart stays clear: the Crown Jelly Sovereign (another worker's
 * creature) rises near r ≈ 42 on the axis, so no bed and no strand stands
 * within 0.065 rad of the axis for r 39–45, and the motes that roll into
 * that cylinder are folded out of it by construction.
 *
 * Streams: `SEEDS.wingLumenGarden` for the beds, `^ 0x1a7e` for the lantern
 * kelp, `^ 0x40e5` for the motes — so retuning any one re-rolls no other.
 * Everything is drawn up front; nothing here loads asynchronously.
 */

/** The heart's radial span and angular fence: the jelly's water stays open. */
const HEART_FROM = 39;
const HEART_TO = 45;
const HEART_FENCE = 0.065;

/** The beds and strands live in this radial band, off the gate's sill. */
const FLORA_FROM = 36;
const FLORA_TO = 47.5;

const BED_COUNT = 9;
const STRAND_COUNT_WALL = 10;

/** The dome and bulb glow: peaks under the bloom threshold, like the canyon. */
const DOME_GLOW_INTENSITY = 0.42;
const BULB_GLOW_INTENSITY = 0.5;
const HALO_OPACITY = 0.3;
const MOTE_OPACITY = 0.55;

/** The strands' sway: a shorter plant than the cathedral's, a quicker breath. */
const LANTERN_REACH = 0.14;
const DRIFT_X = 0.91;
const DRIFT_Z = 0.42;

/** The light's two families: cyan water-light and indigo night-light. */
const CYAN_FAMILY = [0x9fe8e0, 0x8ad8f0, 0xa8c8f8];
const INDIGO_FAMILY = [0xb0a0f0, 0x98a0e8, 0x8890e8];

/** The emissive chunk the canyon's polyps proved: the light wears the tint. */
const TINTED_EMISSIVE_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;

interface GlowDome {
  readonly x: number;
  readonly z: number;
  readonly scaleXZ: number;
  readonly scaleY: number;
  readonly yaw: number;
  readonly hex: number;
  readonly value: number;
}

interface Strand {
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly lean: number;
  readonly leanAzimuth: number;
  readonly phase: number;
  readonly hex: number;
  readonly value: number;
}

export function buildLumenGardenFlora(def: WingDef): WingFlora {
  const group = new Group();
  group.name = "wing-flora-lumen-garden";

  const bedRandom = new Random(SEEDS.wingLumenGarden);
  const lanternRandom = new Random(SEEDS.wingLumenGarden ^ 0x1a7e);
  const moteRandom = new Random(SEEDS.wingLumenGarden ^ 0x40e5);

  const sway = { value: 0 };
  const wind = { value: 1 };

  const contacts: ContactPatch[] = [];
  const beds: { x: number; z: number; family: readonly number[] }[] = [];

  // ─── The polyp beds ──────────────────────────────────────────────────────
  // Nine beds in two colour families, hugging the walls and the wedge's
  // edges — open night water in the middle for the jelly. Each bed is one
  // family: a colony of light is one organism's brood, not a mixed string.
  const domes: GlowDome[] = [];
  for (let b = 0; b < BED_COUNT; b++) {
    const center = sampleWedgePoint(bedRandom, def, FLORA_FROM, FLORA_TO, gardenFence, 0.014);
    const family = b % 3 === 2 ? INDIGO_FAMILY : CYAN_FAMILY;
    const members = 9 + Math.floor(bedRandom.next() * 5);
    beds.push({ x: center.x, z: center.z, family });
    contacts.push({ x: center.x, z: center.z, radius: 1.3, strength: 0.32 });

    for (let m = 0; m < members; m++) {
      const spread = 1.15 * Math.sqrt(bedRandom.next());
      const around = bedRandom.range(0, Math.PI * 2);
      const raw = {
        x: center.x + Math.cos(around) * spread,
        z: center.z + Math.sin(around) * spread,
      };
      const side = Math.sign(center.angle) || 1;
      const inside = clampInsideWedge(def, raw.x, raw.z, side, 0.012);
      const { x, z } = clampOffHeart(def, inside.x, inside.z, side);
      domes.push({
        x,
        z,
        scaleXZ: bedRandom.range(0.5, 1.3),
        scaleY: bedRandom.range(0.6, 1.1),
        yaw: bedRandom.range(0, Math.PI * 2),
        hex: family[m % family.length]!,
        value: bedRandom.range(0.75, 1.2),
      });
    }
  }
  group.add(buildDomes(domes));
  group.add(buildHalos(domes));

  // ─── The lantern kelp ────────────────────────────────────────────────────
  // Short strands with a glowing bulb at the tip: four or five standing by
  // each bed, the rest along the wall bases where the wedge goes dark.
  const strands: Strand[] = [];
  for (const bed of beds) {
    const byBed = 1 + Math.floor(lanternRandom.next() * 2);
    for (let s = 0; s < byBed; s++) {
      const offset = lanternRandom.range(0.8, 2.0);
      const around = lanternRandom.range(0, Math.PI * 2);
      const raw = { x: bed.x + Math.cos(around) * offset, z: bed.z + Math.sin(around) * offset };
      const side = Math.sign(lateralOf(def, raw.x, raw.z)) || 1;
      const inside = clampInsideWedge(def, raw.x, raw.z, side, 0.012);
      const { x, z } = clampOffHeart(def, inside.x, inside.z, side);
      const r = Math.hypot(x, z);
      // In the heart's span the bow points away from the jelly's water, so
      // no ribbon tip ever leans back across the fence.
      const bias =
        r >= HEART_FROM && r <= HEART_TO
          ? def.azimuth + side * (Math.PI / 2)
          : undefined;
      strands.push(drawStrand(lanternRandom, x, z, bed.family, bias));
    }
  }
  for (let s = 0; s < STRAND_COUNT_WALL; s++) {
    const r = lanternRandom.range(FLORA_FROM, FLORA_TO);
    const side = lanternRandom.next() < 0.5 ? -1 : 1;
    const angle = side * lanternRandom.range(0.55, 0.92) * (wedgeHalfAt(def, r) - 0.012);
    const { x, z } = polarPoint(def, r, angle * r);
    const family = lanternRandom.next() < 0.7 ? CYAN_FAMILY : INDIGO_FAMILY;
    // Wall-side strands bow into open water, never into the wall.
    strands.push(
      drawStrand(lanternRandom, x, z, family, def.azimuth - side * (Math.PI / 2)),
    );
  }
  group.add(buildStrands(strands, sway, wind));
  group.add(buildBulbs(strands, sway, wind));

  const motes = buildMotes(moteRandom, def);
  group.add(motes.points);

  return {
    group,
    contacts,
    update(dt: number, reducedMotion: boolean): void {
      // The Kelp/Particles idiom: reduced motion slows the breath and the
      // drift to a third rather than freezing the garden mid-gesture.
      sway.value += dt * (reducedMotion ? 0.3 : 1);
      wind.value = reducedMotion ? 0.4 : 1;
      motes.update(dt, reducedMotion);
    },
  };
}

/** The angular fence at a radius: the heart's corridor, then the edge. */
function gardenFence(r: number): number {
  if (r >= HEART_FROM && r <= HEART_TO) {
    return HEART_FENCE + 0.005;
  }
  return 0.025;
}

/**
 * Re-clamps a point out of the jelly's water: inside the heart's radial span
 * its lateral offset is lifted to the fence on the point's own side — a
 * move, never a re-draw, so the streams cannot shift under a fence retune.
 */
function clampOffHeart(
  def: WingDef,
  x: number,
  z: number,
  side: number,
): { x: number; z: number } {
  const r = Math.hypot(x, z);
  if (r < HEART_FROM || r > HEART_TO) {
    return { x, z };
  }
  const lateral = lateralOf(def, x, z);
  const fence = HEART_FENCE * r;
  if (Math.abs(lateral) >= fence) {
    return { x, z };
  }
  return polarPoint(def, r, side * (fence + 0.15));
}

/**
 * One strand's drawn parameters, all streams spent in one place. `leanBias`
 * pins the bow's azimuth where clearance demands it: heart-side strands bow
 * away from the jelly's water, wall-side strands bow into open water.
 */
function drawStrand(
  random: Random,
  x: number,
  z: number,
  family: readonly number[],
  leanBias?: number,
): Strand {
  return {
    x,
    z,
    height: random.range(1.3, 2.3),
    lean: random.range(0.06, 0.2),
    leanAzimuth: leanBias !== undefined ? leanBias + random.signed(0.6) : random.range(0, Math.PI * 2),
    phase: random.range(0, Math.PI * 2),
    hex: family[Math.floor(random.next() * family.length)]!,
    value: random.range(0.8, 1.15),
  };
}

/**
 * The beds: instanced squashed domes with a baked form gradient, and the
 * canyon's own glow discipline — the emissive is multiplied by `vColor`, so
 * the per-dome tint shapes the light itself and nothing reads as a flat dot.
 */
function buildDomes(domes: readonly GlowDome[]): InstancedMesh {
  const geometry = new IcosahedronGeometry(0.13, 1);
  geometry.scale(1, 0.62, 1);
  smoothNormals(geometry);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i) / 0.0806 * 0.5 + 0.5));
    const value = 0.42 + 0.58 * t;
    colors[i * 3] = value;
    colors[i * 3 + 1] = value;
    colors[i * 3 + 2] = Math.min(1, value + 0.08 * (1 - t));
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const material = createToonMaterial({
    color: 0x46508a,
    emissive: 0x86dce8,
    emissiveIntensity: DOME_GLOW_INTENSITY,
    vertexColors: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };

  const mesh = new InstancedMesh(geometry, material, domes.length);
  mesh.name = "lumen-polyp-beds";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const dummy = new Object3D();
  const color = new Color();
  for (const [i, dome] of domes.entries()) {
    dummy.position.set(dome.x, seabedHeight(dome.x, dome.z) + 0.03, dome.z);
    dummy.rotation.set(0, dome.yaw, 0);
    dummy.scale.set(dome.scaleXZ, dome.scaleY, dome.scaleXZ);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHex(dome.hex).multiplyScalar(dome.value);
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
 * One additive point per dome, hung just above its tip: the hot pinprick
 * core inside a soft skirt is what makes a bud read as *light* rather than
 * as a lit object — the canyon's halo arithmetic at the garden's own size.
 */
function buildHalos(domes: readonly GlowDome[]): Points {
  const positions = new Float32Array(domes.length * 3);
  const colors = new Float32Array(domes.length * 3);
  const color = new Color();
  for (const [i, dome] of domes.entries()) {
    positions[i * 3] = dome.x;
    positions[i * 3 + 1] = seabedHeight(dome.x, dome.z) + 0.03 + dome.scaleY * 0.1 + 0.04;
    positions[i * 3 + 2] = dome.z;
    color.setHex(dome.hex).multiplyScalar(dome.value);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new PointsMaterial({
    size: 0.32,
    map: haloSprite(),
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: HALO_OPACITY,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const points = new Points(geometry, material);
  points.name = "lumen-polyp-halos";
  return points;
}

/**
 * The strands: one merged ribbon per plant, bowed and tapered, dark against
 * the night with a faint emissive floor — the ghost kelp's rule, because a
 * toon surface under this mood renders pale palettes as near-black quills.
 */
function buildStrands(
  strands: readonly Strand[],
  sway: { value: number },
  wind: { value: number },
): Mesh {
  const parts: BufferGeometry[] = [];
  for (const strand of strands) {
    const foot = seabedHeight(strand.x, strand.z);
    const geometry = new PlaneGeometry(1, 1, 1, 5);
    const position = geometry.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    const root = new Color(0x24423c);
    const tip = new Color(0x3f6a5c);
    const shade = new Color();
    // The bow grows along local +x, so `rotateY(-leanAzimuth)` points it at
    // its own azimuth — and the bulb arithmetic below reads the same frame.
    for (let i = 0; i < position.count; i++) {
      const t = position.getY(i) + 0.5;
      const edge = position.getX(i);
      const half = (0.05 - t * 0.036) * (t > 0.98 ? 0.3 : 1);
      const bow = strand.lean * strand.height * t * t;
      position.setXYZ(i, bow, t * strand.height, edge * 2 * half);
      shade.copy(root).lerp(tip, t);
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.setAttribute("color", new BufferAttribute(colors, 3));

    geometry.rotateY(-strand.leanAzimuth);
    geometry.translate(strand.x, foot, strand.z);
    addSwayAttributes(
      geometry,
      strand.phase,
      strand.height,
      (y) => (y - foot) / strand.height,
      LANTERN_REACH,
    );
    parts.push(geometry);
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("lumen strands could not be merged");
  }
  merged.computeBoundingSphere();
  const material = createToonMaterial({
    side: DoubleSide,
    vertexColors: true,
    emissive: 0x3a6a5a,
    emissiveIntensity: 0.12,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    injectWingSway(shader, sway, wind, DRIFT_X, DRIFT_Z);
  };
  const mesh = new Mesh(merged, material);
  mesh.name = "lumen-lantern-strands";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * The bulbs: one small sphere per strand tip, carrying the strand's own sway
 * phase at full reach so the light never drifts off its stem. The glow is
 * the garden's brightest mark and still peaks far under the bloom threshold.
 */
function buildBulbs(
  strands: readonly Strand[],
  sway: { value: number },
  wind: { value: number },
): Mesh {
  const parts: BufferGeometry[] = [];
  const shade = new Color();
  for (const strand of strands) {
    const geometry = new IcosahedronGeometry(0.085, 1);
    const position = geometry.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const t = Math.min(1, Math.max(0, position.getY(i) / 0.085 * 0.5 + 0.5));
      const value = (0.55 + 0.45 * t) * strand.value;
      shade.setHex(strand.hex).multiplyScalar(value);
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }
    geometry.setAttribute("color", new BufferAttribute(colors, 3));

    const foot = seabedHeight(strand.x, strand.z);
    // The tip's world position: the bow carries it off the strand's root, in
    // the same `rotateY(-leanAzimuth)` frame the strand was built in.
    const bow = strand.lean * strand.height;
    const tipX = strand.x + bow * Math.cos(strand.leanAzimuth);
    const tipZ = strand.z + bow * Math.sin(strand.leanAzimuth);
    geometry.translate(tipX, foot + strand.height, tipZ);
    addSwayAttributes(geometry, strand.phase, strand.height, () => 1, LANTERN_REACH);
    parts.push(geometry);
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("lumen bulbs could not be merged");
  }
  merged.computeBoundingSphere();
  const material = createToonMaterial({
    color: 0x6f9a8a,
    emissive: 0xa8f0d8,
    emissiveIntensity: BULB_GLOW_INTENSITY,
    vertexColors: true,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    injectWingSway(shader, sway, wind, DRIFT_X, DRIFT_Z);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };
  const mesh = new Mesh(merged, material);
  mesh.name = "lumen-lantern-bulbs";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * The mote constellations: slow cyan and indigo specks drifting between the
 * beds, on the Particles idiom — per-point twinkle carried in the colour
 * attribute, drift read off the base field, the heart's water folded open.
 */
function buildMotes(
  random: Random,
  def: WingDef,
): { points: Points; update: (dt: number, reducedMotion: boolean) => void } {
  const count = 240;
  const basePositions = new Float32Array(count * 3);
  const tint = new Color();

  const geometry = new BufferGeometry();
  for (let i = 0; i < count; i++) {
    const r = random.range(34, 48.5);
    const side = random.next() < 0.5 ? -1 : 1;
    const angle = side * random.range(0.02, wedgeHalfAt(def, r) - 0.03);
    let lateral = angle * r;
    // The heart's water stays the jelly's: motes that roll into its cylinder
    // are folded out to its rim, a move rather than a re-draw.
    if (r >= HEART_FROM && r <= HEART_TO && Math.abs(lateral) < 2.9) {
      lateral = side * (2.9 + (Math.abs(lateral) / 2.9) * 1.7);
    }
    const { x, z } = polarPoint(def, r, lateral);
    const floor = seabedHeight(x, z);
    basePositions[i * 3] = x;
    basePositions[i * 3 + 1] = floor + random.range(0.4, 5.4);
    basePositions[i * 3 + 2] = z;
  }

  const twinklePhases = new Float32Array(count);
  const twinkleRates = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    twinklePhases[i] = random.range(0, Math.PI * 2);
    twinkleRates[i] = random.range(0.3, 0.9);
    const roll = random.next();
    tint.setHex(roll < 0.55 ? 0x9fd8f0 : roll < 0.9 ? 0x8a90e0 : 0xd8e8c0);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }

  geometry.setAttribute("position", new Float32BufferAttribute(basePositions.slice(), 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new PointsMaterial({
    size: 0.09,
    map: moteSprite(),
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: MOTE_OPACITY,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const points = new Points(geometry, material);
  points.name = "lumen-motes";

  let time = 0;
  const update = (dt: number, reducedMotion: boolean): void => {
    time += dt * (reducedMotion ? 0.3 : 1);
    const attribute = geometry.getAttribute("position") as Float32BufferAttribute;
    const shade = geometry.getAttribute("color") as Float32BufferAttribute;
    const array = attribute.array as Float32Array;
    const levels = shade.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const bx = basePositions[i * 3] ?? 0;
      const by = basePositions[i * 3 + 1] ?? 0;
      const bz = basePositions[i * 3 + 2] ?? 0;
      array[i * 3] = bx + Math.sin(time * 0.16 + i) * 0.3;
      array[i * 3 + 1] = by + Math.sin(time * 0.11 + i * 0.5) * 0.22;
      array[i * 3 + 2] = bz + Math.cos(time * 0.14 + i) * 0.3;

      // The twinkle multiplies the tint rather than replacing it, so a mote
      // keeps its colour while it breathes.
      const rate = twinkleRates[i] ?? 1;
      const phase = twinklePhases[i] ?? 0;
      const level = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(time * rate + phase));
      levels[i * 3] = colors[i * 3]! * level;
      levels[i * 3 + 1] = colors[i * 3 + 1]! * level;
      levels[i * 3 + 2] = colors[i * 3 + 2]! * level;
    }
    attribute.needsUpdate = true;
    shade.needsUpdate = true;
  };

  return { points, update };
}

/** The halos' sprite: a hot pinprick core inside a wide soft skirt. */
let haloSpriteTexture: DataTexture | undefined;
function haloSprite(): DataTexture {
  haloSpriteTexture ??= buildColorTexture(32, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    const core = Math.max(0, 1 - distance / 0.3);
    const skirt = Math.pow(Math.max(0, 1 - distance), 2.4) * 0.38;
    const value = Math.min(1, core * core + skirt);
    return [value, value, value];
  });
  return haloSpriteTexture;
}

/** The motes' sprite: a soft round falloff, no hard rim. */
let moteSpriteTexture: DataTexture | undefined;
function moteSprite(): DataTexture {
  moteSpriteTexture ??= buildColorTexture(32, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    const soft = Math.pow(Math.max(0, 1 - distance), 1.8);
    return [soft, soft, soft];
  });
  return moteSpriteTexture;
}
