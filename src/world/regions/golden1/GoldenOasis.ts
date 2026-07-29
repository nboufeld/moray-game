import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  Vector3,
  type DataTexture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { OASIS_GREEN } from "./GoldenShared";
import {
  OASIS_A,
  OASIS_B,
  duneRank,
  flatsWeight,
  glassWeight,
  hourglassWeight,
  oasisWeight,
  worldOf,
} from "./GoldenTerrain";

/**
 * The Oasis Hollows' life — the region's tender counterpoint:
 *
 * - **The palms-of-the-sea**: kelp re-idiomed gold-green — a leaning
 *   trunk crowned with drooping straps, planted in the two hollows so
 *   each pocket garden has a canopy to shelter under. One instanced
 *   geometry; the lean and the crown droop are authored, the instances
 *   vary height and turn.
 * - **The gold seagrass**: the bowl meadow's blade wearing this desert's
 *   key — gold-green families dense in the hollows, thin tufts trailing
 *   up the dune troughs toward them, so the hollows advertise themselves
 *   the way real oases do: by the green creeping out to meet you.
 */

const SEED = SEEDS.regionGolden1;

const BLADE_HEIGHT = 1.25;

const GRASS_FAMILIES: readonly (readonly number[])[] = [
  [0xa8b45e, 0xc2c46a, 0x8a9a50],
  [0x9cb868, 0xb8c878, 0x7e9c54],
  [0xb4ac58, 0xc8bc6a, 0x96924c],
] as const;

const TRUNK_LOW = new Color(0x8a6a48);
const TRUNK_HIGH = new Color(0xb89468);
const STRAP_ROOT = new Color(0x7a9448);
const STRAP_TIP = new Color(0xd8c86a);

export interface GoldenOasisBuild {
  readonly meshes: InstancedMesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  update(dt: number, reducedMotion: boolean): void;
}

export function buildGoldenOasis(): GoldenOasisBuild {
  const sway = { value: 0 };
  const wind = { value: 1 };
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  const palms = buildPalms(colliders, contacts);
  const grass = buildGoldSeagrass(sway, wind);

  return {
    meshes: [palms, grass],
    colliders,
    contacts,
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

// ─── The palms-of-the-sea ────────────────────────────────────────────────────

/** One palm: a leaning tapered trunk and seven drooping crown straps. */
function palmGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];

  // The trunk: a bent tube of six stations, leaning as it rises.
  const stations = 6;
  const sides = 6;
  const height = 4.6;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const shade = new Color();
  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    const lean = 0.9 * t * t;
    const radius = 0.24 - t * 0.1;
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      positions.push(lean + Math.cos(a) * radius, t * height, Math.sin(a) * radius);
      shade.copy(TRUNK_LOW).lerp(TRUNK_HIGH, t);
      // Ring banding, a palm's own mark.
      if (i % 2 === 1) {
        shade.multiplyScalar(0.88);
      }
      colors.push(shade.r, shade.g, shade.b);
    }
  }
  for (let i = 0; i < stations; i++) {
    const a = i * sides;
    const b = a + sides;
    for (let k = 0; k < sides; k++) {
      const nk = (k + 1) % sides;
      indices.push(a + k, a + nk, b + k, a + nk, b + nk, b + k);
    }
  }
  const trunk = new BufferGeometry();
  trunk.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  trunk.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  trunk.setIndex(indices);
  trunk.computeVertexNormals();
  parts.push(trunk.toNonIndexed());
  trunk.dispose();

  // The crown: seven straps arching out and over from the trunk's head
  // — round 1's steep hang read as a broken tripod; a palm's crown is
  // an arc, rising before it falls.
  const crownX = 0.9;
  for (let s = 0; s < 7; s++) {
    const strap = new PlaneGeometry(0.42, 2.8, 1, 6);
    const position = strap.attributes.position!;
    const strapColors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const t = position.getY(i) / 2.8 + 0.5; // 0 at tip, 1 at root
      const reach = 1 - t;
      // The arc: out fast, up a little, then over and down at the tip.
      position.setXYZ(
        i,
        position.getX(i) * (0.45 + t * 0.75),
        0.55 * Math.sin(reach * Math.PI * 0.82) - reach * reach * 1.15,
        reach * 2.3,
      );
      shade.copy(STRAP_ROOT).lerp(STRAP_TIP, 1 - t);
      strapColors[i * 3] = shade.r;
      strapColors[i * 3 + 1] = shade.g;
      strapColors[i * 3 + 2] = shade.b;
    }
    strap.setAttribute("color", new BufferAttribute(strapColors, 3));
    // The trunk carries no UVs, and mergeGeometries refuses mixed
    // attribute sets — the straps drop theirs.
    strap.deleteAttribute("uv");
    strap.rotateY((s / 7) * Math.PI * 2 + 0.35);
    strap.translate(crownX, height, 0);
    parts.push(strap.toNonIndexed());
    strap.dispose();
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("hourglass palm parts could not be merged");
  }
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

/** The palms' authored seats, in spoke coordinates: hollows A and B. */
const PALM_SEATS: readonly { u: number; v: number; s: number }[] = [
  { u: 512, v: -68, s: 1.15 },
  { u: 519, v: -59, s: 0.95 },
  { u: 524, v: -70, s: 1.3 },
  { u: 510, v: -57, s: 0.8 },
  { u: 529, v: -62, s: 1.0 },
  { u: 540, v: -38, s: 1.1 },
  { u: 546, v: -32, s: 0.85 },
  { u: 543, v: -43, s: 0.95 },
] as const;

function buildPalms(colliders: SphereCollider[], contacts: ContactPatch[]): InstancedMesh {
  const random = new Random(SEED ^ 0x9a1e);
  const material = createToonMaterial({ vertexColors: true, side: DoubleSide });
  const mesh = new InstancedMesh(palmGeometry(), material, PALM_SEATS.length);
  mesh.name = "hourglass-sea-palms";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const tint = new Color();
  for (const [i, seat] of PALM_SEATS.entries()) {
    const { x, z } = worldOf(seat.u, seat.v);
    const y = seabedHeight(x, z);
    dummy.position.set(x, y - 0.15, z);
    dummy.rotation.set(random.signed(0.06), random.range(0, Math.PI * 2), random.signed(0.06));
    dummy.scale.setScalar(seat.s * random.range(0.92, 1.08));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tint.setScalar(random.range(0.88, 1.1));
    mesh.setColorAt(i, tint);
    contacts.push({ x, z, radius: 1.4 * seat.s, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + 2.2 * seat.s, z), radius: 0.7 * seat.s });
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

// ─── The gold seagrass ───────────────────────────────────────────────────────

function buildGoldSeagrass(sway: { value: number }, wind: { value: number }): InstancedMesh {
  const random = new Random(SEED ^ 0xa5a1);
  const paletteRandom = new Random(SEED ^ 0xa5a2);

  const material = createToonMaterial({ side: DoubleSide, map: goldBladeTexture() });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    injectSway(shader, sway, wind, "0.13");
  };
  material.customProgramCacheKey = () => "hourglass-gold-seagrass";

  const patches = 52;
  const bladesPerPatch = 34;
  const capacity = patches * bladesPerPatch;
  const mesh = new InstancedMesh(bladeGeometry(), material, capacity);
  mesh.name = "hourglass-gold-seagrass";
  mesh.castShadow = false;
  mesh.receiveShadow = true;

  const dummy = new Object3D();
  const color = new Color();
  let placed = 0;

  const plant = (u: number, v: number, family: readonly number[], heightScale = 1): void => {
    if (placed >= capacity) {
      return;
    }
    if (hourglassWeight(u, v) > 0.15 || glassWeight(u, v) > 0.55) {
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

  // The hollows: the densest life in the region — twenty patches over
  // the two gardens, taller than the drifting tufts outside.
  for (let patch = 0; patch < 20; patch++) {
    const seat = patch % 2 === 0 ? OASIS_A : OASIS_B;
    const angle = random.range(0, Math.PI * 2);
    const spread = Math.sqrt(random.next()) * seat.radius * 0.7;
    const u = seat.u + Math.cos(angle) * spread;
    const v = seat.v + Math.sin(angle) * spread;
    const family = GRASS_FAMILIES[Math.floor(paletteRandom.next() * GRASS_FAMILIES.length)]!;
    for (let blade = 0; blade < bladesPerPatch; blade++) {
      const s = 3.0 * Math.sqrt(random.next());
      const a = random.range(0, Math.PI * 2);
      plant(u + Math.cos(a) * s, v + Math.sin(a) * s, family, 1.1);
    }
  }

  // The saddle's own tufts: small dry-gold clumps along the corridor's
  // shoulders, so the 200 m approach is a place and not a hallway.
  for (let i = 0; i < 10; i++) {
    const u = 96 + i * 19 + random.signed(5);
    const side = i % 2 === 0 ? 1 : -1;
    const v = side * random.range(5, 10);
    const family = GRASS_FAMILIES[Math.floor(paletteRandom.next() * GRASS_FAMILIES.length)]!;
    for (let blade = 0; blade < 10; blade++) {
      const s = 1.8 * Math.sqrt(random.next());
      const a = random.range(0, Math.PI * 2);
      plant(u + Math.cos(a) * s, v + Math.sin(a) * s, family, 0.7);
    }
  }

  // The tufts: thin trails through the dune troughs and along the flats'
  // edge — the green creeping out to meet the wanderer.
  for (let patch = 20; patch < patches; patch++) {
    const u = random.range(295, 590);
    const v = random.signed(140);
    const rank = duneRank(u, v);
    // Tufts shelter in troughs and lee sides, never on bare crests.
    if (rank.rise > 0.45 && rank.slip < 0.3) {
      continue;
    }
    const family = GRASS_FAMILIES[Math.floor(paletteRandom.next() * GRASS_FAMILIES.length)]!;
    const near = Math.max(oasisWeight(u, v), flatsWeight(u, v) * 0.4);
    const count = Math.round(bladesPerPatch * (0.25 + near * 0.45));
    for (let blade = 0; blade < count; blade++) {
      const s = 3.4 * Math.sqrt(random.next());
      const a = random.range(0, Math.PI * 2);
      plant(u + Math.cos(a) * s, v + Math.sin(a) * s, family, 0.75 + near * 0.3);
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

/** Warm gold-green gradient with dry fibre — the oasis key. */
let goldMap: DataTexture | undefined;
function goldBladeTexture(): DataTexture {
  goldMap ??= buildColorTexture(32, (u, v) => {
    const fibre = 0.9 + fbm(u * 4, v, { seed: SEED ^ 0xb1ac, period: 12, octaves: 2 }) * 0.22;
    const across = 0.88 + Math.abs(u - 0.5) * 0.4;
    // Lifted in round 2: the round-1 roots read as black cutouts under
    // the quarter-strength sun — never black, not even by lighting.
    const shade = (0.78 + v * 0.5) * fibre * across;
    return [shade * OASIS_GREEN.r * 1.4, shade * OASIS_GREEN.g * 1.32, shade * OASIS_GREEN.b * 1.25];
  });
  return goldMap;
}
