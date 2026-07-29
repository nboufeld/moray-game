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
  SphereGeometry,
  Vector3,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createFishGeometry } from "../../../creatures/fish/FishGeometry";
import { buildColorTexture } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { smoothstep01 } from "./Verdant2Shared";
import { CISTERN, worldOf } from "./Verdant2Terrain";

/**
 * The Emerald Terraces' ambient life.
 *
 * - **Spore-motes**: five hundred green-gold drifting points through the
 *   stair and the gardens — the light blades are made of them.
 * - **The spill shoal**: the region's signature behaviour — a shoal that
 *   pours over terrace lips like spilled water, riding one closed line
 *   that hugs a tread, slides over its lip, falls down the riser face
 *   and climbs back around.
 * - **The garden-dwellers**: a hover cloud of rose-gold fry living *in*
 *   the grotto's curtain — colour complementary to the green, value
 *   above the water's (the fish community's documented lesson).
 * - **The turtle procession**: the moving centrepiece — four great slow
 *   turtles grazing the gardens ledge by ledge on one closed circuit;
 *   following them tours the heart of the region.
 * - **Floor fauna**: violet-rose cushion stars on treads and the
 *   Cistern's rim.
 *
 * Everything draws from `SEED ^` substreams at build; the update phase
 * spends no randomness, so a capture's settle is deterministic.
 */

const SEED = SEEDS.regionVerdant2;

export interface Verdant2LifeBuild {
  readonly meshes: (Mesh | Points | InstancedMesh)[];
  update(dt: number, time: number, reducedMotion: boolean): void;
}

export function buildVerdant2Life(): Verdant2LifeBuild {
  const meshes: (Mesh | Points | InstancedMesh)[] = [];
  const updaters: ((dt: number, time: number, calm: number) => void)[] = [];

  const motes = buildSporeMotes();
  meshes.push(motes.points);
  updaters.push(motes.update);

  const spill = buildSpillShoal();
  meshes.push(spill.mesh);
  updaters.push(spill.update);

  const dwellers = buildGardenDwellers();
  meshes.push(dwellers.mesh);
  updaters.push(dwellers.update);

  const turtles = buildTurtleProcession();
  meshes.push(turtles.mesh);
  updaters.push(turtles.update);

  meshes.push(buildCushionStars());

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

// ─── The spore-motes ─────────────────────────────────────────────────────────

let moteSprite: DataTexture | undefined;
function moteTexture(): DataTexture {
  moteSprite ??= buildColorTexture(32, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const halo = Math.pow(Math.max(0, 1 - d * d), 2.2);
    return [halo * 0.86, halo, halo * 0.52];
  });
  return moteSprite;
}

function buildSporeMotes(): {
  points: Points;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x40e7);
  const count = 520;
  const base = new Float32Array(count * 3);
  const live = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Through the pass and the whole garden country.
    const u = random.range(680, 1050);
    const v = u < 800 ? random.signed(20) : random.signed(120);
    const { x, z } = worldOf(u, v);
    const floor = seabedHeight(x, z);
    base[i * 3] = x;
    base[i * 3 + 1] = floor + random.range(0.6, 11);
    base[i * 3 + 2] = z;
    phases[i] = random.range(0, Math.PI * 2);
  }
  live.set(base);

  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(live, 3);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  geometry.computeBoundingSphere();

  const material = new PointsMaterial({
    size: 0.09,
    map: moteTexture(),
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new Points(geometry, material);
  points.name = "verdant2-spore-motes";
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

// ─── The spill shoal ─────────────────────────────────────────────────────────

/**
 * One closed line that pours: it hugs the stair's sixth tread, slips
 * over the lip, falls down two riser faces nose-first, runs out along
 * the gardens' first terrace and climbs lazily back up the flank. The
 * fish ride it nose to tail, so the shoal reads as water finding its way
 * down — the terraces' own story, swimming.
 */
function buildSpillShoal(): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x5a03);
  // Stations: [u, v, lift]. Lifts hug the ground tight on the pours.
  const stations: [number, number, number][] = [
    [806, 4, 2.2],
    [816, 8, 1.4],
    [822, 6, 0.9],
    [828, 2, 0.9],
    [834, -2, 1.1],
    [842, -4, 1.3],
    [852, -2, 1.6],
    [864, 4, 2.4],
    [876, 10, 3.4],
    [872, 20, 5.2],
    [858, 24, 6.4],
    [842, 20, 6.2],
    [826, 16, 5.0],
    [814, 10, 3.4],
  ];
  const points: Vector3[] = [];
  for (const [u, v, lift] of stations) {
    const at = worldOf(u, v);
    points.push(new Vector3(at.x, seabedHeight(at.x, at.z) + lift + random.signed(0.3), at.z));
  }
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const count = 62;
  const geometry = createFishGeometry({
    width: 0.85,
    height: 0.9,
    length: 1.05,
    tailTaper: 0.5,
    dorsal: 0.45,
    pectoral: 0.85,
    tail: { reach: 1.45, lobe: 0.6, notch: 1.0 },
  });
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x35584c,
    emissiveIntensity: 0.65,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "verdant2-spill-shoal";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  // Pale green-silver, above the water's value — the pour must read as a
  // bright thread against the risers' shade.
  const silver = new Color(0xc9ecd8);
  const tint = new Color();
  const offsets: { lateral: number; phase: number; scale: number }[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push({
      lateral: random.signed(0.3),
      phase: random.range(0, Math.PI * 2),
      scale: random.range(0.9, 1.25),
    });
    tint.copy(silver).multiplyScalar(random.range(0.85, 1.05));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const bodySpan = 0.11;
  const dummy = new Object3D();
  const at = new Vector3();
  const ahead = new Vector3();
  const side = new Vector3();
  const up = new Vector3(0, 1, 0);

  const update = (_dt: number, time: number, calm: number): void => {
    const head = (time * calm * 0.013) % 1;
    for (const [i, o] of offsets.entries()) {
      const s = (((head - (i / count) * bodySpan) % 1) + 1) % 1;
      path.getPointAt(s, at);
      path.getPointAt((s + 0.004) % 1, ahead);
      side.subVectors(ahead, at).cross(up).normalize();
      const swing = Math.sin(time * calm * 1.6 + i * 0.34 + o.phase * 0.2) * 0.2;
      at.addScaledVector(side, o.lateral + swing);
      at.y += Math.sin(time * calm * 1.2 + i * 0.23) * 0.18;
      dummy.position.copy(at);
      const pitch = Math.atan2(
        ahead.y - at.y,
        Math.hypot(ahead.x - at.x, ahead.z - at.z) || 1e-4,
      );
      dummy.rotation.set(0, Math.atan2(ahead.x - at.x, ahead.z - at.z), 0);
      dummy.rotateX(-pitch * 0.8);
      dummy.scale.setScalar(o.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1);
  return { mesh, update };
}

// ─── The garden-dwellers ─────────────────────────────────────────────────────

/** Rose-gold fry living in the grotto's curtain — warm sparks in green. */
function buildGardenDwellers(): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x5a04);
  const count = 34;
  const geometry = createFishGeometry({
    width: 1.0,
    height: 1.25,
    length: 0.8,
    tailTaper: 0.5,
    dorsal: 0.85,
    pectoral: 1.05,
    tail: { reach: 1.3, lobe: 0.7, notch: 0.95 },
  });
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x4a3a2a,
    emissiveIntensity: 0.55,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "verdant2-garden-dwellers";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const center = worldOf(890, 21);
  const centerY = seabedHeight(center.x, center.z) + 2.6;
  const tint = new Color();
  const rose = new Color(0xe8c2a0);
  const offsets: { a: number; r: number; h: number; phase: number; scale: number }[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push({
      a: random.range(0, Math.PI * 2),
      r: random.range(0.3, 1),
      h: random.signed(1),
      phase: random.range(0, Math.PI * 2),
      scale: random.range(0.55, 0.85),
    });
    tint.copy(rose).multiplyScalar(random.range(0.85, 1.12));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const dummy = new Object3D();
  const update = (_dt: number, time: number, calm: number): void => {
    const t = time * calm;
    for (const [i, o] of offsets.entries()) {
      const a = o.a + t * 0.12 * (0.6 + o.r * 0.8);
      const r = 3.6 * (0.3 + o.r * 0.7);
      const x = center.x + Math.cos(a) * r + Math.sin(t * 0.9 + o.phase) * 0.3;
      const z = center.z + Math.sin(a) * r + Math.cos(t * 1.1 + o.phase) * 0.3;
      const y = centerY + o.h * 1.6 + Math.sin(t * 0.7 + o.phase) * 0.4;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, a + Math.PI / 2, 0);
      dummy.scale.setScalar(o.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1);
  return { mesh, update };
}

// ─── The turtle procession ───────────────────────────────────────────────────

/**
 * Four great slow turtles on one closed circuit through the gardens:
 * along the first terrace, down past the bridge, around the vault's
 * mouth, up the cistern side and back over the stair's foot. The line is
 * the region's tour; the turtles swim it in ~4 minutes, nose to tail a
 * quarter-loop apart.
 */
function buildTurtleProcession(): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x70b1);
  const stations: [number, number, number][] = [
    [850, -8, 4.5],
    [866, -24, 4.0],
    [882, -40, 4.5],
    [902, -52, 5.0],
    [920, -38, 5.5],
    [934, -16, 5.0],
    [944, 8, 5.5],
    [934, 34, 5.0],
    [914, 44, 4.5],
    [894, 38, 4.0],
    [874, 24, 4.0],
    [858, 8, 4.2],
  ];
  const points: Vector3[] = [];
  for (const [u, v, lift] of stations) {
    const { x, z } = worldOf(u, v);
    points.push(new Vector3(x, seabedHeight(x, z) + lift + random.signed(0.4), z));
  }
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const count = 4;
  const mesh = new InstancedMesh(turtleGeometry(), turtleMaterial(), count);
  mesh.name = "verdant2-turtle-procession";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const tint = new Color();
  const scales: number[] = [];
  for (let i = 0; i < count; i++) {
    scales.push(random.range(1.9, 2.5));
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
    const head = (time * calm * 0.004) % 1;
    for (let i = 0; i < count; i++) {
      const s = (((head - i * 0.25) % 1) + 1) % 1;
      // Grazing gait: the procession slows near the path's stations and
      // drifts between them — a wobble on s, deterministic.
      const graze = s + Math.sin(time * calm * 0.11 + i * 2.4) * 0.004;
      path.getPointAt(((graze % 1) + 1) % 1, at);
      path.getPointAt((graze + 0.01) % 1, ahead);
      at.y += Math.sin(time * calm * 0.23 + i * 1.8) * 0.5;
      dummy.position.copy(at);
      dummy.rotation.set(0, Math.atan2(ahead.x - at.x, ahead.z - at.z), 0);
      dummy.rotateX(Math.sin(time * calm * 0.19 + i) * 0.08 - 0.06);
      dummy.rotateZ(Math.sin(time * calm * 0.16 + i * 1.3) * 0.07);
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
 * One turtle, merged and painted: a domed moss-green shell with gold rim
 * scutes, a violet plastron shadow, a reaching head and four swept
 * flippers. ~2 m long before the instance scale.
 */
let turtleGeom: BufferGeometry | undefined;
function turtleGeometry(): BufferGeometry {
  if (turtleGeom) {
    return turtleGeom;
  }
  const parts: BufferGeometry[] = [];

  const shell = new IcosahedronGeometry(0.52, 2);
  shell.scale(0.92, 0.5, 1.15);
  paintPart(shell, (x, y, z, shade) => {
    const rim = smoothstep01((0.12 - Math.abs(y)) / 0.1);
    const top = smoothstep01((y + 0.05) / 0.2);
    // Moss shell above, gold rim band, violet plastron below.
    shade.setHex(0x4f7d4c).multiplyScalar(0.9 + top * 0.3);
    shade.lerp(new Color(0xc2a95c), rim * 0.7);
    if (y < -0.06) {
      shade.setHex(0x6a5d7c).multiplyScalar(0.95);
    }
    // Scute mottle: five-lobed value dapple over the dome.
    const dapple = Math.sin(x * 11) * Math.sin(z * 9);
    if (y > 0.05 && dapple > 0.25) {
      shade.multiplyScalar(0.86);
    }
  });
  parts.push(shell);

  const head = new SphereGeometry(0.16, 8, 6);
  head.scale(1, 0.85, 1.35);
  head.translate(0, 0.02, 0.62);
  paintPart(head, (_x, y, _z, shade) => {
    shade.setHex(0x7ba065).multiplyScalar(0.9 + Math.max(0, y) * 1.2);
  });
  parts.push(head.toNonIndexed());

  for (const [side, fore] of [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ] as const) {
    const flipper = new ConeGeometry(0.13, fore > 0 ? 0.72 : 0.5, 5);
    flipper.scale(1, 1, 0.32);
    flipper.applyMatrix4(new Matrix4().makeRotationZ((side * Math.PI) / 2));
    flipper.applyMatrix4(new Matrix4().makeRotationY(side * (fore > 0 ? -0.5 : -2.4)));
    flipper.translate(side * 0.42, -0.08, fore > 0 ? 0.3 : -0.34);
    paintPart(flipper, (_x, _y, _z, shade) => {
      shade.setHex(0x64905c).multiplyScalar(0.95);
    });
    parts.push(flipper.toNonIndexed());
  }

  const merged = mergeGeometries(
    parts.map((p) => (p.getIndex() ? p.toNonIndexed() : p)),
    false,
  );
  if (!merged) {
    throw new Error("verdant2 turtle parts could not be merged");
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  turtleGeom = merged;
  return turtleGeom;
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

let turtleMat: ReturnType<typeof createToonMaterial> | undefined;
function turtleMaterial(): ReturnType<typeof createToonMaterial> {
  turtleMat ??= createToonMaterial({
    vertexColors: true,
    emissive: 0x2a4438,
    emissiveIntensity: 0.4,
  });
  return turtleMat;
}

// ─── The floor fauna ─────────────────────────────────────────────────────────

/** A five-lobed cushion star, domed, tips lifted. */
function starGeometry(): BufferGeometry {
  const geometry = new IcosahedronGeometry(0.22, 1);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, x);
    const lobe = 0.62 + 0.38 * Math.pow(Math.abs(Math.cos(angle * 2.5)), 0.7);
    const r = Math.hypot(x, z);
    position.setX(i, x * lobe * (1 + r));
    position.setZ(i, z * lobe * (1 + r));
    position.setY(i, Math.max(0.005, position.getY(i) * 0.32 * (1 - r * 0.6)));
  }
  position.needsUpdate = true;
  smoothNormals(geometry);
  return geometry;
}

function buildCushionStars(): InstancedMesh {
  const random = new Random(SEED ^ 0x57a6);
  const geometry = starGeometry();
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i)) / 0.5;
    const value = 0.72 + smoothstep01((r - 0.35) / 0.55) * 0.42;
    colors[i * 3] = value;
    colors[i * 3 + 1] = value * 0.96;
    colors[i * 3 + 2] = value;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const material = createToonMaterial({ vertexColors: true });
  const count = 24;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "verdant2-cushion-stars";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const palette = [0x9e5f8a, 0x2e8a6a, 0xc07a5a];
  const dummy = new Object3D();
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    const nearCistern = random.next() < 0.4;
    const u = nearCistern ? CISTERN.u + random.signed(30) : 840 + random.next() * 120;
    const v = nearCistern ? CISTERN.v + random.signed(30) : -60 + random.next() * 100;
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) + 0.02, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(random.range(0.7, 1.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tint.setHex(palette[i % palette.length]!).multiplyScalar(random.range(0.85, 1.15));
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}
