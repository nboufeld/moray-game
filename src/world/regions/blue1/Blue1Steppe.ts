import {
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  type BufferGeometry,
  type DataTexture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { createSunViewUniform, injectLeafGlow, trackSunView } from "../../SeaGrass";
import { STEPPE_TONES, TIP_SILVER, WIND_X, WIND_Z, smoothstep01 } from "./Blue1Shared";
import {
  CENTER_X,
  CENTER_Z,
  blue1TerrainTarget,
  dropWeight,
  tongueHalfWidth,
  worldOf,
} from "./Blue1Terrain";

/**
 * THE SEAGRASS STEPPE — the prairie itself. A kilometre-feeling rolling
 * field of blue-green grass bending in one slow wind, in two instanced
 * draws:
 *
 * - **The near grass**: cupped, twisted, bowed single blades (the bowl
 *   meadow's drawn leaf) for everything a pose can stand in.
 * - **The far grass**: crossed two-blade tufts at half the triangle
 *   price, carrying the density out to the milky rim so the prairie
 *   never thins where the fog should be full of it.
 *
 * The blades grow where the ground paint's own sward field says turf
 * grows — one seeded field feeds both bakes, so the green ground and the
 * green blades are the same drawing. The wind is one world-space
 * direction for the whole steppe, phase scattered off each instance's
 * position, tips weighted quadratically: a prairie lives and dies by its
 * blade paint and its wind.
 */

const SEED = SEEDS.regionBlue1;

const BLADE_WIDTH = 0.3;
const BLADE_HEIGHT = 2.15;
const TIP_BOW = 0.9;
const BLADE_TWIST = 0.5;
const BLADE_CUP = 0.38;

const NEAR_COUNT = 1600;
const FAR_COUNT = 4200;

/** The sward field the ground paint draws with — one truth, two readers. */
export function swardAt(x: number, z: number): number {
  return smoothstep01(
    (fbm(x * 0.014, z * 0.014, { seed: SEED ^ 0x5aa2, period: 6, octaves: 3 }) - 0.4) / 0.28,
  );
}

export interface Blue1SteppeBuild {
  readonly meshes: InstancedMesh[];
  update(dt: number, reducedMotion: boolean): void;
}

interface WindUniforms {
  readonly sway: { value: number };
  readonly wind: { value: number };
}

function injectWind(
  shader: WebGLProgramParametersWithUniforms,
  uniforms: WindUniforms,
): void {
  shader.uniforms.uSway = uniforms.sway;
  shader.uniforms.uWind = uniforms.wind;
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
       float phase = instanceMatrix[3][0] * 0.11 + instanceMatrix[3][2] * 0.07;
       float tip = clamp(transformed.y / ${BLADE_HEIGHT.toFixed(2)}, 0.0, 1.0);
       float gust = sin(uSway * 0.5 + phase) * 0.62 + sin(uSway * 0.21 + phase * 1.7) * 0.38;
       float bend = (0.55 + 0.45 * gust) * uWind * tip * tip;
       transformed.x += bend * ${(WIND_X * 0.42).toFixed(3)};
       transformed.z += bend * ${(WIND_Z * 0.42).toFixed(3)};`,
    );
}

export function buildBlue1Steppe(): Blue1SteppeBuild {
  const sway = { value: 0 };
  const wind = { value: 1 };
  const meshes: InstancedMesh[] = [];

  meshes.push(
    plantField({
      name: "blue1-steppe-near",
      geometry: nearBladeGeometry(),
      count: NEAR_COUNT,
      seed: SEED ^ 0x9a55,
      minSward: 0.25,
      maxRc: 172,
      uniforms: { sway, wind },
    }),
  );
  meshes.push(
    plantField({
      name: "blue1-steppe-far",
      geometry: farTuftGeometry(),
      count: FAR_COUNT,
      seed: SEED ^ 0x9a56,
      minSward: 0.12,
      maxRc: 204,
      uniforms: { sway, wind },
    }),
  );

  return {
    meshes,
    update(dt: number, reducedMotion: boolean): void {
      sway.value += dt * (reducedMotion ? 0.35 : 1);
      wind.value = reducedMotion ? 0.45 : 1;
    },
  };
}

interface FieldOptions {
  readonly name: string;
  readonly geometry: BufferGeometry;
  readonly count: number;
  readonly seed: number;
  readonly minSward: number;
  readonly maxRc: number;
  readonly uniforms: WindUniforms;
}

function plantField(options: FieldOptions): InstancedMesh {
  const random = new Random(options.seed);
  const sunView = createSunViewUniform();
  const material = createToonMaterial({ side: DoubleSide, map: bladeTexture() });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    injectWind(shader, options.uniforms);
    injectLeafGlow(
      shader,
      sunView,
      "vec3(0.1, 0.2, 0.18)",
      "vec3(0.2, 0.24, 0.16)",
      "clamp(vMapUv.y, 0.0, 1.0)",
    );
  };
  material.customProgramCacheKey = () => options.name;

  const mesh = new InstancedMesh(options.geometry, material, options.count);
  mesh.name = options.name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  trackSunView(mesh, sunView);

  const dummy = new Object3D();
  const color = new Color();
  const tip = new Color();
  let placed = 0;
  let guard = 0;

  while (placed < options.count && guard++ < options.count * 30) {
    const u = random.range(196, 585);
    const v = random.signed(200);
    const { x, z } = worldOf(u, v);
    const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
    if (rc > options.maxRc && u > 290) {
      continue;
    }
    // The slope grows grass only on its outer shoulders, thickening as the
    // prairie nears — the glide's floor stays a clean sand road.
    if (u < 290) {
      const start = smoothstep01((u - 196) / 90);
      if (
        Math.abs(v) < 7 + 9 * (1 - start) ||
        Math.abs(v) > tongueHalfWidth(u) - 2 ||
        random.next() > start * 0.7
      ) {
        continue;
      }
    }
    const floor = blue1TerrainTarget(x, z);
    // Grass country ends where the terraces take the light away, and
    // nothing grows past the lip.
    if (floor < -23.5 || dropWeight(u - 445, v) > 0.05) {
      continue;
    }
    const sward = swardAt(x, z);
    if (sward < options.minSward && random.next() > 0.14) {
      continue;
    }

    dummy.position.set(x, seabedHeight(x, z) - 0.05, z);
    dummy.rotation.set(random.signed(0.1), random.range(0, Math.PI * 2), random.signed(0.1));
    const height = random.range(0.6, 1.2) * (0.82 + sward * 0.3);
    dummy.scale.set(random.range(0.8, 1.25), height, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);

    color.setHex(STEPPE_TONES[Math.floor(random.next() * STEPPE_TONES.length)]!);
    color.multiplyScalar(random.range(0.85, 1.16));
    // Taller blades lean paler — the wind-silver the steppe is keyed to.
    tip.copy(color).lerp(TIP_SILVER, smoothstep01((height - 0.85) / 0.35) * 0.35);
    mesh.setColorAt(placed, tip);
    placed++;
  }

  // Park anything unplanted far below the world.
  dummy.position.set(0, -300, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  for (let i = placed; i < options.count; i++) {
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

/** Half-width along the blade: widest a quarter up, easing to a soft point. */
function lanceolate(t: number): number {
  const s = Math.min(1, Math.max(0, t));
  return Math.max(0.05, Math.sin(Math.PI * Math.pow(0.16 + s * 0.84, 0.72)) ** 0.8);
}

/** The near blade: bowed, cupped, twisted — the drawn leaf, never a card. */
function nearBladeGeometry(): PlaneGeometry {
  const segments = 4;
  const geometry = new PlaneGeometry(BLADE_WIDTH, BLADE_HEIGHT, 2, segments);
  shapeBlade(geometry, segments, BLADE_CUP);
  return geometry;
}

/** The far tuft: two crossed low-cost blades sharing the near blade's arc. */
function farTuftGeometry(): BufferGeometry {
  const segments = 3;
  const parts: BufferGeometry[] = [];
  for (const spin of [0, Math.PI / 2 + 0.3]) {
    const blade = new PlaneGeometry(BLADE_WIDTH * 1.15, BLADE_HEIGHT, 1, segments);
    shapeBlade(blade, segments, 0);
    blade.rotateY(spin);
    blade.translate(Math.sin(spin) * 0.14, 0, Math.cos(spin) * 0.14);
    parts.push(blade);
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("blue1 far tuft blades could not be merged");
  }
  merged.computeBoundingSphere();
  return merged;
}

/** Bends a flat strip into the steppe's leaf: bow, twist, optional cup. */
function shapeBlade(geometry: PlaneGeometry, segments: number, cupAmount: number): void {
  const position = geometry.attributes.position as BufferAttribute;
  const rows = segments + 1;
  const arcY = new Float32Array(rows);
  const arcZ = new Float32Array(rows);
  const bendAt = new Float32Array(rows);
  const step = BLADE_HEIGHT / segments;
  let y = 0;
  let z = 0;
  for (let row = 0; row < rows; row++) {
    arcY[row] = y;
    arcZ[row] = z;
    bendAt[row] = TIP_BOW * Math.pow(row / segments, 1.7);
    const angle = TIP_BOW * Math.pow((row + 0.5) / segments, 1.7);
    y += Math.cos(angle) * step;
    z += Math.sin(angle) * step;
  }

  const half = BLADE_WIDTH / 2;
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) + BLADE_HEIGHT / 2) / BLADE_HEIGHT;
    const row = Math.round(t * segments);
    const column = position.getX(i) / half;
    const theta = bendAt[row] ?? 0;
    const twist = BLADE_TWIST * t;
    const normalY = -Math.sin(theta);
    const normalZ = Math.cos(theta);
    const across = column * half * lanceolate(t);
    const cup = (1 - Math.abs(column)) * half * lanceolate(t) * cupAmount;
    const offNormal = across * Math.sin(twist) + cup;
    position.setXYZ(
      i,
      across * Math.cos(twist),
      (arcY[row] ?? 0) + offNormal * normalY,
      (arcZ[row] ?? 0) + offNormal * normalZ,
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

/** Root-to-tip gradient with lengthwise brush fibre, blue-green keyed. */
let bladeMap: DataTexture | undefined;
function bladeTexture(): DataTexture {
  bladeMap ??= buildColorTexture(32, (u, v) => {
    const fibre = 0.9 + fbm(u * 4, v, { seed: SEED ^ 0xb1ee, period: 12, octaves: 2 }) * 0.22;
    const across = 0.88 + Math.abs(u - 0.5) * 0.44;
    const shade = (0.46 + v * 0.78) * fibre * across;
    return [shade * 0.72, shade, shade * 0.9];
  });
  return bladeMap;
}
