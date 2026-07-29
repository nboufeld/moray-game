import {
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  type DataTexture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { createSunViewUniform, injectLeafGlow, trackSunView } from "../../SeaGrass";
import { smoothstep01 } from "./VerdantShared";
import {
  SUNWELL,
  mazeWeight,
  sunwellWeight,
  worldOf,
} from "./VerdantTerrain";

/**
 * The Rolling Meadows' grass — and the Sunwell's, which is the same meadow
 * poured into the clearing where the light lands.
 *
 * The bowl meadow's idiom (a lanceolate, cupped, twisted blade; instanced;
 * swayed in the vertex shader off the instance's own position) with the
 * region's paint on it: three families — spring green on the swells, gold-
 * olive where the litter drifts, pale seafoam on the Sunwell floor — drawn
 * per patch so the hills read as drifts of related colour, never a lawn.
 * The blade map carries a root-to-tip gradient with brush fibre, and the
 * shared sun-through-leaf glow makes every swell a backlit field when a
 * pose looks into the light.
 */

const SEED = SEEDS.regionVerdant1;

const BLADE_WIDTH = 0.26;
const BLADE_HEIGHT = 1.7;
const TIP_BOW = 1.0;
const BLADE_TWIST = 0.55;
const BLADE_CUP = 0.4;

const PATCHES = 46;
const BLADES_PER_PATCH = 26;
const PATCH_RADIUS = 4.2;

const FAMILIES: readonly (readonly number[])[] = [
  [0x6cc084, 0x92d788, 0x50a771],
  [0x93b25b, 0xaec96e, 0x74984f],
  [0x74c79e, 0x97d8b0, 0x5aab86],
];
/** The Sunwell's floor family: the palest grass in the region. */
const SUNWELL_FAMILY: readonly number[] = [0xa8d98c, 0xc2e69a, 0x8cc47e];

export interface VerdantMeadowBuild {
  readonly mesh: InstancedMesh;
  update(dt: number, reducedMotion: boolean): void;
}

export function buildVerdantMeadow(): VerdantMeadowBuild {
  const random = new Random(SEED ^ 0x9ead);
  const paletteRandom = new Random(SEED ^ 0x9e37);
  const sway = { value: 0 };
  const wind = { value: 1 };
  const sunView = createSunViewUniform();

  const material = createToonMaterial({ side: DoubleSide, map: bladeTexture() });
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
         float tip = clamp(transformed.y / ${BLADE_HEIGHT.toFixed(2)}, 0.0, 1.0);
         float bend = sin(uSway * 1.2 + phase) * 0.5 + sin(uSway * 0.45 + phase * 1.7) * 0.5;
         transformed.x += bend * 0.16 * uWind * tip * tip;
         transformed.z += bend * 0.09 * uWind * tip * tip;`,
      );
    injectLeafGlow(
      shader,
      sunView,
      "vec3(0.14, 0.26, 0.20)",
      "vec3(0.36, 0.29, 0.10)",
      "clamp(vMapUv.y, 0.0, 1.0)",
    );
  };
  material.customProgramCacheKey = () => "verdant-meadow";

  const capacity = PATCHES * BLADES_PER_PATCH + 220;
  const mesh = new InstancedMesh(bladeGeometry(), material, capacity);
  mesh.name = "verdant-meadow";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  trackSunView(mesh, sunView);

  const dummy = new Object3D();
  const color = new Color();
  let placed = 0;

  const plant = (u: number, v: number, family: readonly number[], heightScale = 1): void => {
    if (placed >= capacity || mazeWeight(u, v) > 0.3) {
      return;
    }
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) - 0.05, z);
    dummy.rotation.set(random.signed(0.12), random.range(0, Math.PI * 2), random.signed(0.12));
    dummy.scale.set(
      random.range(0.75, 1.25),
      random.range(0.4, 1.05) * heightScale,
      1,
    );
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    color.setHex(family[Math.floor(random.next() * family.length)] ?? family[0]!);
    color.multiplyScalar(random.range(0.78, 1.15));
    mesh.setColorAt(placed, color);
    placed++;
  };

  // The rolling meadows: patches thickest over the swells of the entry
  // third, thinning through the forest's eaves.
  for (let patch = 0; patch < PATCHES; patch++) {
    const patchU = random.range(292, 470);
    const patchV = random.signed(88);
    const family = FAMILIES[Math.floor(paletteRandom.next() * FAMILIES.length)] ?? FAMILIES[0]!;
    const thin = smoothstep01((patchU - 380) / 80);
    const count = Math.round(BLADES_PER_PATCH * (1 - thin * 0.5));
    for (let blade = 0; blade < count; blade++) {
      const spread = PATCH_RADIUS * Math.sqrt(random.next());
      const angle = random.range(0, Math.PI * 2);
      plant(patchU + Math.cos(angle) * spread, patchV + Math.sin(angle) * spread, family);
    }
  }

  // The Sunwell's floor: its own pale family, dense at the pool of light.
  for (let i = 0; i < 220; i++) {
    const angle = random.range(0, Math.PI * 2);
    const spread = Math.sqrt(random.next()) * 26;
    const u = SUNWELL.u + Math.cos(angle) * spread;
    const v = SUNWELL.v + Math.sin(angle) * spread;
    if (sunwellWeight(u, v) < 0.2) {
      continue;
    }
    plant(u, v, SUNWELL_FAMILY, 0.85);
  }

  // Park anything unplanted far below the world.
  dummy.position.set(0, -300, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  for (let i = placed; i < capacity; i++) {
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();

  return {
    mesh,
    update(dt: number, reducedMotion: boolean): void {
      sway.value += dt * (reducedMotion ? 0.35 : 1);
      wind.value = reducedMotion ? 0.45 : 1;
    },
  };
}

/** Half-width along the blade: widest a quarter up, easing to a soft point. */
function lanceolate(t: number): number {
  const s = Math.min(1, Math.max(0, t));
  return Math.max(0.05, Math.sin(Math.PI * Math.pow(0.16 + s * 0.84, 0.72)) ** 0.8);
}

/** The bowl meadow's leaf: bowed, cupped, twisted — never a flat card. */
function bladeGeometry(): PlaneGeometry {
  const segments = 4;
  const geometry = new PlaneGeometry(BLADE_WIDTH, BLADE_HEIGHT, 2, segments);
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
    const cup = (1 - Math.abs(column)) * half * lanceolate(t) * BLADE_CUP;
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
  return geometry;
}

/** Root-to-tip gradient with lengthwise brush fibre, near hue-neutral. */
let bladeMap: DataTexture | undefined;
function bladeTexture(): DataTexture {
  bladeMap ??= buildColorTexture(32, (u, v) => {
    const fibre = 0.9 + fbm(u * 4, v, { seed: SEED ^ 0xb1ad, period: 12, octaves: 2 }) * 0.24;
    const across = 0.86 + Math.abs(u - 0.5) * 0.5;
    const shade = (0.5 + v * 0.74) * fibre * across;
    return [shade * 0.84, shade, shade * 0.64];
  });
  return bladeMap;
}
