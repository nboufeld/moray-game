import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Points,
  PointsMaterial,
  Vector3,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { smoothstep01 } from "./Verdant3Shared";
import { RESTS, worldOf } from "./Verdant3Terrain";

/**
 * The Canopy Deep's ambient life — the water itself, and the moving
 * centrepiece:
 *
 * - **Deep spore-motes** (1,300 points): green-gold drift through the
 *   whole country's water column — the shafts are made of them.
 * - **Drift plankton** (1,500 large soft sparks): the midwater
 *   foreground layer, sized off the verdant-2 sweep arithmetic — a
 *   random camera must EXPECT a near spark, not win one.
 * - **THE RAY WHEEL** — the moving centrepiece: four great moss-backed
 *   rays wheeling one slow closed circuit around the Twin Court and
 *   the Kingpillar, riding the wellspring updraft. Following the wheel
 *   is the tour of the deep heart.
 *
 * Everything draws from `SEED ^` substreams at build; the update phase
 * spends no randomness, so a capture's settle is deterministic. The
 * Clearwater's rest keeps its water clean: no mote or plankton spawn
 * inside its bowl.
 */

const SEED = SEEDS.regionVerdant3;

export interface Verdant3LifeBuild {
  readonly meshes: (Mesh | Points | InstancedMesh)[];
  update(dt: number, time: number, reducedMotion: boolean): void;
}

export function buildVerdant3Life(): Verdant3LifeBuild {
  const meshes: (Mesh | Points | InstancedMesh)[] = [];
  const updaters: ((dt: number, time: number, calm: number) => void)[] = [];

  const motes = buildSporeMotes();
  meshes.push(motes.points);
  updaters.push(motes.update);

  const plankton = buildDriftPlankton();
  meshes.push(plankton.points);
  updaters.push(plankton.update);

  const rays = buildRayWheel();
  meshes.push(rays.mesh);
  updaters.push(rays.update);

  return {
    meshes,
    update(dt: number, time: number, reducedMotion: boolean): void {
      const calm = reducedMotion ? 0.45 : 1;
      for (const update of updaters) {
        update(dt, time, calm);
      }
    },
  };
}

// ─── The water ───────────────────────────────────────────────────────────────

let moteSprite: DataTexture | undefined;
function moteTexture(): DataTexture {
  moteSprite ??= buildColorTexture(32, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const halo = Math.pow(Math.max(0, 1 - d * d), 2.2);
    return [halo * 0.82, halo, halo * 0.58];
  });
  return moteSprite;
}

/** True where the water must stay clean (the Clearwater's bowl). */
function inCleanWater(u: number, v: number): boolean {
  return Math.hypot(u - RESTS.clearwater.u, v - RESTS.clearwater.v) < RESTS.clearwater.radius + 2;
}

function buildSporeMotes(): {
  points: Points;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x44a1);
  const count = 1300;
  const base = new Float32Array(count * 3);
  const live = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < count * 20) {
    const u = random.range(1140, 1650);
    const v = u < 1310 ? random.signed(24) : random.signed(165);
    if (inCleanWater(u, v)) {
      continue;
    }
    const { x, z } = worldOf(u, v);
    const floor = seabedHeight(x, z);
    base[placed * 3] = x;
    base[placed * 3 + 1] = floor + random.range(0.6, 12);
    base[placed * 3 + 2] = z;
    phases[placed] = random.range(0, Math.PI * 2);
    placed++;
  }
  live.set(base);

  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(live, 3);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  geometry.computeBoundingSphere();

  const material = new PointsMaterial({
    size: 0.15,
    map: moteTexture(),
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new Points(geometry, material);
  points.name = "verdant3-spore-motes";
  points.frustumCulled = false;

  return {
    points,
    update(_dt: number, time: number, calm: number): void {
      const t = time * calm;
      for (let i = 0; i < count; i++) {
        const p = phases[i]!;
        live[i * 3] = base[i * 3]! + Math.sin(t * 0.1 + p) * 1.7 + t * 0.05 * Math.sin(p);
        live[i * 3 + 1] = base[i * 3 + 1]! + Math.sin(t * 0.06 + p * 1.7) * 1.1;
        live[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(t * 0.085 + p) * 1.7;
      }
      attribute.needsUpdate = true;
    },
  };
}

/**
 * The drift plankton: 1,500 large soft sparks in the y +3..+14 column.
 * The count is the verdant-2 fill's measured answer (its round-10
 * arithmetic: at ~900 over one region's roads, the 15 m readable bubble
 * around a random midwater camera still lands empty a third of the
 * time; this domain is larger, so the layer starts at the density that
 * region ENDED at).
 */
function buildDriftPlankton(): {
  points: Points;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x44a2);
  const count = 1500;
  const base = new Float32Array(count * 3);
  const live = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < count * 20) {
    const u = random.range(1140, 1650);
    const v = u < 1310 ? random.signed(26) : random.signed(165);
    if (inCleanWater(u, v)) {
      continue;
    }
    const { x, z } = worldOf(u, v);
    const floor = seabedHeight(x, z);
    base[placed * 3] = x;
    base[placed * 3 + 1] = floor + random.range(3, 14);
    base[placed * 3 + 2] = z;
    phases[placed] = random.range(0, Math.PI * 2);
    placed++;
  }
  live.set(base);

  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(live, 3);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  geometry.computeBoundingSphere();

  const material = new PointsMaterial({
    size: 0.42,
    map: moteTexture(),
    transparent: true,
    opacity: 0.34,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new Points(geometry, material);
  points.name = "verdant3-drift-plankton";
  points.frustumCulled = false;

  return {
    points,
    update(_dt: number, time: number, calm: number): void {
      const t = time * calm;
      for (let i = 0; i < count; i++) {
        const p = phases[i]!;
        live[i * 3] = base[i * 3]! + Math.sin(t * 0.07 + p) * 2.2 + t * 0.04 * Math.sin(p);
        live[i * 3 + 1] = base[i * 3 + 1]! + Math.sin(t * 0.05 + p * 1.7) * 1.4;
        live[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(t * 0.06 + p) * 2.2;
      }
      attribute.needsUpdate = true;
    },
  };
}

// ─── The Ray Wheel ───────────────────────────────────────────────────────────

/**
 * Four great moss-backed rays on one slow closed wheel around the Twin
 * Court and the Kingpillar, ~10 m up — broad enough to silhouette
 * against the shafts, slow enough to follow. The circuit is the deep
 * heart's tour: Sunfall → Kingpillar → the fallen causeway's air → the
 * hollow's meadow and home.
 */
function buildRayWheel(): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x45a1);
  const stations: [number, number, number][] = [
    [1448, -22, 9],
    [1470, -6, 11],
    [1486, 22, 12],
    [1508, 48, 10],
    [1524, 40, 12],
    [1530, 12, 11],
    [1516, -16, 10],
    [1494, -40, 9],
    [1464, -48, 10],
    [1440, -40, 9],
  ];
  const points: Vector3[] = [];
  for (const [u, v, lift] of stations) {
    const { x, z } = worldOf(u, v);
    points.push(new Vector3(x, seabedHeight(x, z) + lift + random.signed(0.5), z));
  }
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const count = 4;
  const mesh = new InstancedMesh(rayGeometry(), rayMaterial(), count);
  mesh.name = "verdant3-ray-wheel";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const tint = new Color();
  const scales: number[] = [];
  for (let i = 0; i < count; i++) {
    scales.push(random.range(2.3, 3.0));
    tint.setHex(0xffffff).multiplyScalar(random.range(0.9, 1.05));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const dummy = new Object3D();
  const at = new Vector3();
  const ahead = new Vector3();

  const update = (_dt: number, time: number, calm: number): void => {
    const head = (time * calm * 0.0045) % 1;
    for (let i = 0; i < count; i++) {
      const s = (((head - i / count) % 1) + 1) % 1;
      const glide = s + Math.sin(time * calm * 0.13 + i * 2.1) * 0.003;
      path.getPointAt(((glide % 1) + 1) % 1, at);
      path.getPointAt((glide + 0.01) % 1, ahead);
      at.y += Math.sin(time * calm * 0.21 + i * 1.7) * 0.8;
      dummy.position.copy(at);
      dummy.rotation.set(0, Math.atan2(ahead.x - at.x, ahead.z - at.z), 0);
      // The wing-borne bank into the turn.
      dummy.rotateZ(Math.sin(time * calm * 0.17 + i * 1.3) * 0.12);
      dummy.rotateX(Math.sin(time * calm * 0.15 + i) * 0.06 - 0.03);
      dummy.scale.setScalar(scales[i]!);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1);
  return { mesh, update };
}

/**
 * One ray, merged and painted: a broad diamond disc with swept wing
 * tips, a moss-green back with gold-flecked wing rims, pale violet
 * belly, and a long thin tail. ~2.4 m across before the instance scale.
 */
let rayGeom: BufferGeometry | undefined;
function rayGeometry(): BufferGeometry {
  if (rayGeom) {
    return rayGeom;
  }
  const parts: BufferGeometry[] = [];

  const body = new IcosahedronGeometry(0.5, 2);
  body.scale(1.35, 0.22, 0.9);
  paintPart(body, (x, y, z, shade) => {
    const rim = smoothstep01((Math.abs(x) - 0.42) / 0.22);
    if (y > -0.02) {
      shade.setHex(0x5d9155).multiplyScalar(0.9 + Math.max(0, y) * 2.4);
      shade.lerp(new Color(0xc2a95c), rim * 0.6);
      const dapple = Math.sin(x * 9) * Math.sin(z * 11);
      if (dapple > 0.3) {
        shade.multiplyScalar(0.88);
      }
    } else {
      shade.setHex(0x9a8fb0).multiplyScalar(0.95);
    }
  });
  parts.push(body.toNonIndexed());

  // The swept wing tips: two flattened cones reaching out and back.
  for (const side of [-1, 1] as const) {
    const wing = new ConeGeometry(0.24, 0.8, 4);
    wing.scale(1, 1, 0.18);
    wing.applyMatrix4(new Matrix4().makeRotationZ((side * Math.PI) / 2));
    wing.applyMatrix4(new Matrix4().makeRotationY(side * 0.5));
    wing.translate(side * 0.8, 0.02, -0.14);
    paintPart(wing, (_x, y, _z, shade) => {
      shade.setHex(0x6aa578).multiplyScalar(0.9 + Math.max(0, y) * 1.4);
    });
    parts.push(wing.toNonIndexed());
  }

  // The tail: a thin trailing spike.
  const tail = new ConeGeometry(0.05, 1.1, 4);
  tail.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2 + 0.06));
  tail.translate(0, 0.02, -1.2);
  paintPart(tail, (_x, _y, _z, shade) => {
    shade.setHex(0x5c8a68).multiplyScalar(0.9);
  });
  parts.push(tail.toNonIndexed());

  const merged = mergeGeometries(
    parts.map((p) => (p.getIndex() ? p.toNonIndexed() : p)),
    false,
  );
  if (!merged) {
    throw new Error("verdant3 ray parts could not be merged");
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  rayGeom = merged;
  return rayGeom;
}

function paintPart(
  geometry: BufferGeometry,
  paint: (x: number, y: number, z: number, shade: Color) => void,
): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    paint(position.getX(i), position.getY(i), position.getZ(i), shade);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

let rayMat: ReturnType<typeof createToonMaterial> | undefined;
function rayMaterial(): ReturnType<typeof createToonMaterial> {
  rayMat ??= createToonMaterial({
    vertexColors: true,
    emissive: 0x2a4438,
    emissiveIntensity: 0.4,
  });
  return rayMat;
}
