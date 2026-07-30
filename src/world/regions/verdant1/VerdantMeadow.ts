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

const PATCHES = 42;
const BLADES_PER_PATCH = 38;
const PATCH_RADIUS = 3.4;

const FAMILIES: readonly (readonly number[])[] = [
  [0x7fd194, 0xa2e296, 0x62b981],
  [0xa5c46a, 0xbed67f, 0x86aa5e],
  [0x86d8ad, 0xa6e4be, 0x6cbd96],
];
/** The Sunwell's floor family: the palest grass in the region. */
const SUNWELL_FAMILY: readonly number[] = [0xb8e79a, 0xd0f2a8, 0x9cd48c];

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

  // Headroom covers the pilot's plantings AND the fill growth below
  // (patches 42 → 70, Sunwell ×1.3, Falling Edge ×1.5) — the capacity
  // check in `plant` sits before any stream draw, so it must never trip.
  const capacity = 70 * BLADES_PER_PATCH + 1900;
  const mesh = new InstancedMesh(bladeGeometry(), material, capacity);
  mesh.name = "verdant-meadow";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  trackSunView(mesh, sunView);

  const dummy = new Object3D();
  const color = new Color();
  let placed = 0;

  const plant = (
    u: number,
    v: number,
    family: readonly number[],
    heightScale = 1,
    stream: Random = random,
  ): void => {
    if (placed >= capacity || mazeWeight(u, v) > 0.3) {
      return;
    }
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) - 0.05, z);
    dummy.rotation.set(stream.signed(0.12), stream.range(0, Math.PI * 2), stream.signed(0.12));
    dummy.scale.set(
      stream.range(0.75, 1.25),
      stream.range(0.55, 1.15) * heightScale,
      1,
    );
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    color.setHex(family[Math.floor(stream.next() * family.length)] ?? family[0]!);
    color.multiplyScalar(stream.range(0.88, 1.18));
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

  // The Falling Edge's thin turf: the forest fades, the grass keeps going
  // a little further — sparse patches so the shelf is a place and not a
  // parking lot. The first three are authored into the falling-edge
  // pose's own foreground; the rest scatter.
  for (let patch = 0; patch < 11; patch++) {
    const authored: readonly [number, number][] = [
      [584, 8],
      [591, 22],
      [597, -5],
    ];
    const patchU = patch < 3 ? authored[patch]![0] : random.range(552, 612);
    const patchV = patch < 3 ? authored[patch]![1] : random.signed(60);
    const family = FAMILIES[Math.floor(paletteRandom.next() * FAMILIES.length)] ?? FAMILIES[0]!;
    for (let blade = 0; blade < 22; blade++) {
      const spread = 4.4 * Math.sqrt(random.next());
      const angle = random.range(0, Math.PI * 2);
      plant(patchU + Math.cos(angle) * spread, patchV + Math.sin(angle) * spread, family, 0.85);
    }
  }

  // The Sunwell's floor: its own pale family, dense at the pool of light —
  // the clearing is a meadow bowl, not a bare stage, and its lushness is
  // most of what "calmest place in the region" looks like.
  for (let i = 0; i < 520; i++) {
    const angle = random.range(0, Math.PI * 2);
    const spread = Math.sqrt(random.next()) * 27;
    const u = SUNWELL.u + Math.cos(angle) * spread;
    const v = SUNWELL.v + Math.sin(angle) * spread;
    if (sunwellWeight(u, v) < 0.15) {
      continue;
    }
    plant(u, v, SUNWELL_FAMILY, 1.0);
  }

  // ─── The fill growth (plan §7.6) ─────────────────────────────────────────
  // A fresh substream appended after every pilot draw (the reroll fence):
  // the pilot's patches keep their exact blades while the meadows thicken.
  const growth = new Random(SEED ^ 0xf171);

  // Patches 42 → 66: twenty-four more drifts, crest-biased the same way.
  // (The plan drew 70; the measured triangle budget trimmed the growth —
  // logged in the ledger's rework section.)
  for (let patch = 0; patch < 24; patch++) {
    const patchU = growth.range(292, 470);
    const patchV = growth.signed(88);
    const family = FAMILIES[Math.floor(growth.next() * FAMILIES.length)] ?? FAMILIES[0]!;
    const thin = smoothstep01((patchU - 380) / 80);
    const count = Math.round(BLADES_PER_PATCH * (1 - thin * 0.5));
    for (let blade = 0; blade < count; blade++) {
      const spread = PATCH_RADIUS * Math.sqrt(growth.next());
      const angle = growth.range(0, Math.PI * 2);
      plant(
        patchU + Math.cos(angle) * spread,
        patchV + Math.sin(angle) * spread,
        family,
        1,
        growth,
      );
    }
  }

  // The Sunwell's floor ×1.3: the light peak's bowl grows lusher still.
  for (let i = 0; i < 160; i++) {
    const angle = growth.range(0, Math.PI * 2);
    const spread = Math.sqrt(growth.next()) * 27;
    const u = SUNWELL.u + Math.cos(angle) * spread;
    const v = SUNWELL.v + Math.sin(angle) * spread;
    if (sunwellWeight(u, v) < 0.15) {
      continue;
    }
    plant(u, v, SUNWELL_FAMILY, 1.0, growth);
  }

  // The Falling Edge's turf ×1.5: five more sparse patches thinning out.
  // The mirror-calm shelf pocket at (585, −40) is a registered rest
  // (MASTER §1.2) — new growth keeps out of it.
  for (let patch = 0; patch < 5; patch++) {
    const patchU = growth.range(552, 612);
    const patchV = growth.signed(60);
    if (Math.hypot(patchU - 585, patchV + 40) < 13) {
      continue;
    }
    const family = FAMILIES[Math.floor(growth.next() * FAMILIES.length)] ?? FAMILIES[0]!;
    for (let blade = 0; blade < 22; blade++) {
      const spread = 4.4 * Math.sqrt(growth.next());
      const angle = growth.range(0, Math.PI * 2);
      plant(
        patchU + Math.cos(angle) * spread,
        patchV + Math.sin(angle) * spread,
        family,
        0.85,
        growth,
      );
    }
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
