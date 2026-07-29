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
import { VEIN_GLOW_CHUNK, smoothstep01 } from "./SmokingShared";
import {
  CHIMNEYS,
  GORGE_TO,
  basaltWeight,
  calderaWeight,
  chimneysWeight,
  gorgeChannelCenter,
  springsWeight,
  worldOf,
} from "./SmokingTerrain";

/**
 * The Smoulder Fields' flora, two idioms:
 *
 * - **Ash-grass**: the bowl meadow's blade (lanceolate, cupped, twisted,
 *   instanced, swayed off its own instance position) wearing this
 *   region's key — pale grey-violet families drawn per patch, a shade
 *   map with a *cooler* root and dust-pale tip (the meadow map ran
 *   green; this one runs bone), so the flats read as drifts of pale
 *   grass on grey ash, never a lawn.
 * - **Flame fronds**: the region's own plant. A short strap that stands
 *   near heat — maroon at the root, amber up the blade, an ember tip
 *   whose paint the vein-glow material reads as light. Clustered at the
 *   vents, the gorge's warm stains and the spring head, so everywhere
 *   the ground says heat, something alive agrees.
 */

const SEED = SEEDS.regionSmoking1;

const BLADE_HEIGHT = 1.25;

// Round 2 darkened the bone-pale blades that had vanished against the
// dunes; round 3 lifts them a small step back — a value below the ground
// but not a silhouette cut-out.
const ASH_FAMILIES: readonly (readonly number[])[] = [
  [0x9c90a6, 0xb0a4b0, 0x877b92],
  [0xa89a8a, 0xbaab96, 0x918378],
  [0x9488aa, 0xa79cb4, 0x7e738c],
] as const;

const FROND_ROOT = new Color(0x6b3a40);
const FROND_MID = new Color(0xc07840);
const FROND_TIP = new Color(0xffa050);

export interface SmokingFloraBuild {
  readonly meshes: InstancedMesh[];
  update(dt: number, reducedMotion: boolean): void;
}

export function buildSmokingFlora(): SmokingFloraBuild {
  const sway = { value: 0 };
  const wind = { value: 1 };

  const grass = buildAshGrass(sway, wind);
  const fronds = buildFlameFronds(sway, wind);

  return {
    meshes: [grass, fronds],
    update(dt: number, reducedMotion: boolean): void {
      sway.value += dt * (reducedMotion ? 0.35 : 1);
      wind.value = reducedMotion ? 0.45 : 1;
    },
  };
}

function injectSway(
  shader: WebGLProgramParametersWithUniforms,
  sway: { value: number },
  wind: { value: number },
  amplitude: string,
): void {
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
       float bend = sin(uSway * 1.1 + phase) * 0.5 + sin(uSway * 0.42 + phase * 1.7) * 0.5;
       transformed.x += bend * ${amplitude} * uWind * tip * tip;
       transformed.z += bend * ${amplitude} * 0.6 * uWind * tip * tip;`,
    );
}

// ─── The ash-grass ───────────────────────────────────────────────────────────

function buildAshGrass(sway: { value: number }, wind: { value: number }): InstancedMesh {
  const random = new Random(SEED ^ 0xa599);
  const paletteRandom = new Random(SEED ^ 0xa537);

  const material = createToonMaterial({ side: DoubleSide, map: ashBladeTexture() });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    injectSway(shader, sway, wind, "0.13");
  };
  material.customProgramCacheKey = () => "smoulder-ash-grass";

  const patches = 58;
  const bladesPerPatch = 34;
  const capacity = patches * bladesPerPatch;
  const mesh = new InstancedMesh(bladeGeometry(), material, capacity);
  mesh.name = "smoulder-ash-grass";
  mesh.castShadow = false;
  mesh.receiveShadow = true;

  const dummy = new Object3D();
  const color = new Color();
  let placed = 0;

  const plant = (u: number, v: number, family: readonly number[], heightScale = 1): void => {
    if (placed >= capacity) {
      return;
    }
    if (calderaWeight(u, v) > 0.3 || chimneysWeight(u, v) > 0.5 || springsWeight(u, v) > 0.5) {
      return;
    }
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) - 0.04, z);
    dummy.rotation.set(random.signed(0.12), random.range(0, Math.PI * 2), random.signed(0.12));
    dummy.scale.set(random.range(0.75, 1.2), random.range(0.55, 1.15) * heightScale, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    color.setHex(family[Math.floor(random.next() * family.length)] ?? family[0]!);
    color.multiplyScalar(random.range(0.86, 1.14));
    mesh.setColorAt(placed, color);
    placed++;
  };

  // The flats: patches drifting across the disc's resting ground, thick
  // where nothing else owns the floor, thinning into the basalt treads.
  // The first eight are authored into the ash-flats pose's own frame.
  const authored: readonly [number, number][] = [
    [306, -2], [314, 10], [322, 28], [330, 40], [318, -18], [336, 18], [346, 34], [300, 14],
  ];
  for (let patch = 0; patch < patches; patch++) {
    const u = patch < authored.length ? authored[patch]![0] : random.range(290, 560);
    const v = patch < authored.length ? authored[patch]![1] : random.signed(120);
    const family = ASH_FAMILIES[Math.floor(paletteRandom.next() * ASH_FAMILIES.length)]!;
    const thin = Math.max(basaltWeight(u, v) * 0.6, smoothstep01((u - 480) / 90) * 0.4);
    const count = Math.round(bladesPerPatch * (1 - thin));
    for (let blade = 0; blade < count; blade++) {
      const spread = 3.6 * Math.sqrt(random.next());
      const angle = random.range(0, Math.PI * 2);
      plant(u + Math.cos(angle) * spread, v + Math.sin(angle) * spread, family, 1 - thin * 0.3);
    }
  }

  // Park the rest far below the world.
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
  return mesh;
}

// ─── The flame fronds ────────────────────────────────────────────────────────

function buildFlameFronds(sway: { value: number }, wind: { value: number }): InstancedMesh {
  const random = new Random(SEED ^ 0xf70d);

  const geometry = bladeGeometry();
  bakeFrondPaint(geometry);
  const material = createToonMaterial({
    side: DoubleSide,
    vertexColors: true,
    emissive: 0xff8c3a,
    emissiveIntensity: 0.35,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      VEIN_GLOW_CHUNK,
    );
    injectSway(shader, sway, wind, "0.09");
  };
  material.customProgramCacheKey = () => "smoulder-flame-frond";

  const capacity = 230;
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.name = "smoulder-flame-fronds";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const color = new Color();
  let placed = 0;

  const plant = (u: number, v: number): void => {
    if (placed >= capacity) {
      return;
    }
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) - 0.03, z);
    dummy.rotation.set(random.signed(0.16), random.range(0, Math.PI * 2), random.signed(0.16));
    dummy.scale.set(random.range(0.5, 0.9), random.range(0.4, 0.85), 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    color.setScalar(random.range(0.85, 1.15));
    mesh.setColorAt(placed, color);
    placed++;
  };

  // Clusters through the chimney forest, where the heat is.
  for (let cluster = 0; cluster < 16; cluster++) {
    const angle = random.range(0, Math.PI * 2);
    const spread = Math.sqrt(random.next()) * (CHIMNEYS.radius * 0.8);
    const u = CHIMNEYS.u + Math.cos(angle) * spread;
    const v = CHIMNEYS.v + Math.sin(angle) * spread;
    if (chimneysWeight(u, v) < 0.4) {
      continue;
    }
    for (let i = 0; i < 8; i++) {
      plant(u + random.signed(2.2), v + random.signed(2.2));
    }
  }

  // Down the gorge's warm second half — the fronds are how the water
  // says it is warming before the fog colour fully does.
  for (let i = 0; i < 12; i++) {
    const u = 130 + i * 12 + random.signed(4);
    if (u > GORGE_TO - 20) {
      break;
    }
    const side = i % 2 === 0 ? 1 : -1;
    const v = gorgeChannelCenter(u) + side * random.range(4.5, 7);
    for (let k = 0; k < 3; k++) {
      plant(u + random.signed(1.4), v + random.signed(1.2));
    }
  }

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
  return mesh;
}

/** Root-to-tip: maroon, amber, ember — the tip is the glow the material reads. */
function bakeFrondPaint(geometry: PlaneGeometry): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i) / BLADE_HEIGHT));
    if (t < 0.5) {
      shade.copy(FROND_ROOT).lerp(FROND_MID, smoothstep01(t / 0.5));
    } else {
      shade.copy(FROND_MID).lerp(FROND_TIP, smoothstep01((t - 0.5) / 0.5));
    }
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

// ─── The blade (the bowl meadow's leaf, re-cut) ──────────────────────────────

const TIP_BOW = 0.9;
const BLADE_TWIST = 0.5;
const BLADE_CUP = 0.38;
const BLADE_WIDTH = 0.22;

function lanceolate(t: number): number {
  const s = Math.min(1, Math.max(0, t));
  return Math.max(0.05, Math.sin(Math.PI * Math.pow(0.16 + s * 0.84, 0.72)) ** 0.8);
}

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

/** Bone-pale gradient with dust fibre — the ash key, not the meadow's green. */
let ashMap: DataTexture | undefined;
function ashBladeTexture(): DataTexture {
  ashMap ??= buildColorTexture(32, (u, v) => {
    const fibre = 0.9 + fbm(u * 4, v, { seed: SEED ^ 0xb1ab, period: 12, octaves: 2 }) * 0.22;
    const across = 0.88 + Math.abs(u - 0.5) * 0.4;
    const shade = (0.52 + v * 0.68) * fibre * across;
    return [shade * 0.98, shade * 0.94, shade];
  });
  return ashMap;
}
