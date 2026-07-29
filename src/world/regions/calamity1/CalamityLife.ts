import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  IcosahedronGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Points,
  PointsMaterial,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createFishGeometry } from "../../../creatures/fish/FishGeometry";
import { buildColorTexture } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { smoothstep01 } from "./CalamityShared";
import { SEEP_GARDENS, WOUND, worldOf } from "./CalamityTerrain";

/**
 * The Sunken Calamity's ambient life: the ash snow, the pallid survivors,
 * the crater gyre, and the floor fauna.
 *
 * - **The ash snow**: seven hundred pale motes falling forever through
 *   the whole region, march included — the sea snowing what the ground
 *   is still settling. The region's weather.
 * - **The silt darts**: a second, quicker cloud low over the ash — small
 *   dim lives, so the floor is not only weather.
 * - **The pallid shoal**: fifty silver-ash fish travelling the Ghost
 *   Forest's aisle — survivors, and the proof the water carries life
 *   again.
 * - **The crater gyre**: the moving centrepiece. Sixty-four bone-silver
 *   fish ride the Cold Candle's updraft — up the plume in a tight helix,
 *   spilling off the top, gliding down the wide outside — an endless
 *   slow wheel over the vent, the cold fire's own smoke made of fish.
 * - **Floor fauna**: bone stars and ghost urchins on the ash, white
 *   crabs at the seeps — scavengers, which is what a ruin feeds.
 *
 * Everything draws from `SEED ^` substreams at build; the update phase
 * spends no randomness at all, so a capture's settle is deterministic.
 */

const SEED = SEEDS.regionCalamity;

export interface CalamityLifeBuild {
  readonly meshes: (Mesh | Points | InstancedMesh)[];
  update(dt: number, time: number, reducedMotion: boolean): void;
}

export function buildCalamityLife(plume: { x: number; z: number; base: number; top: number }): CalamityLifeBuild {
  const meshes: (Mesh | Points | InstancedMesh)[] = [];
  const updaters: ((dt: number, time: number, calm: number) => void)[] = [];

  const snow = buildAshSnow();
  meshes.push(snow.points);
  updaters.push(snow.update);

  const darts = buildSiltDarts();
  meshes.push(darts.points);
  updaters.push(darts.update);

  const shoal = buildPallidShoal();
  meshes.push(shoal.mesh);
  updaters.push(shoal.update);

  const gyre = buildGyre(plume);
  meshes.push(gyre.mesh);
  updaters.push(gyre.update);

  meshes.push(buildStars());
  meshes.push(buildUrchins());
  meshes.push(buildCrabs());

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

// ─── The ash snow ────────────────────────────────────────────────────────────

let snowSprite: DataTexture | undefined;
function snowTexture(): DataTexture {
  snowSprite ??= buildColorTexture(32, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const halo = Math.pow(Math.max(0, 1 - d * d), 2.6);
    return [halo * 0.92, halo * 0.9, halo * 0.86];
  });
  return snowSprite;
}

function buildAshSnow(): { points: Points; update: (dt: number, time: number, calm: number) => void } {
  const random = new Random(SEED ^ 0xa51e);
  const count = 700;
  const base = new Float32Array(count * 3);
  const live = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const falls = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Snow through the whole region and down the march: the devastation's
    // dandruff does not stop at the crater's rim.
    const u = random.range(70, 880);
    const v = u < 530 ? random.signed(20) : random.signed(150);
    const { x, z } = worldOf(u, v);
    const floor = seabedHeight(x, z);
    base[i * 3] = x;
    base[i * 3 + 1] = floor + random.range(0.5, 16);
    base[i * 3 + 2] = z;
    phases[i] = random.range(0, Math.PI * 2);
    falls[i] = random.range(0.14, 0.34);
  }
  live.set(base);

  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(live, 3);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius = 900;

  const material = new PointsMaterial({
    size: 0.1,
    map: snowTexture(),
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new Points(geometry, material);
  points.name = "calamity-ash-snow";
  points.frustumCulled = false;

  return {
    points,
    update(_dt: number, time: number, calm: number): void {
      const t = time * calm;
      for (let i = 0; i < count; i++) {
        const p = phases[i]!;
        // A slow fall, wrapped in a band above the floor, with a sideways
        // wander — snow, not rain.
        const span = 12;
        const drop = ((t * falls[i]! + p) % 1) * span;
        live[i * 3] = base[i * 3]! + Math.sin(t * 0.1 + p) * 1.8;
        live[i * 3 + 1] = base[i * 3 + 1]! + 4 - drop;
        live[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(t * 0.08 + p * 1.3) * 1.8;
      }
      attribute.needsUpdate = true;
    },
  };
}

/** Small dim quicker lives low over the ash — the floor is not only weather. */
function buildSiltDarts(): { points: Points; update: (dt: number, time: number, calm: number) => void } {
  const random = new Random(SEED ^ 0xdad7);
  const count = 180;
  const base = new Float32Array(count * 3);
  const live = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = random.range(540, 800);
    const v = random.signed(110);
    const { x, z } = worldOf(u, v);
    base[i * 3] = x;
    base[i * 3 + 1] = seabedHeight(x, z) + random.range(0.4, 3.2);
    base[i * 3 + 2] = z;
    phases[i] = random.range(0, Math.PI * 2);
  }
  live.set(base);

  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(live, 3);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius = 400;

  const material = new PointsMaterial({
    size: 0.07,
    map: snowTexture(),
    transparent: true,
    opacity: 0.4,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new Points(geometry, material);
  points.name = "calamity-silt-darts";
  points.frustumCulled = false;

  return {
    points,
    update(_dt: number, time: number, calm: number): void {
      const t = time * calm;
      for (let i = 0; i < count; i++) {
        const p = phases[i]!;
        live[i * 3] = base[i * 3]! + Math.sin(t * 0.6 + p) * 0.9;
        live[i * 3 + 1] = base[i * 3 + 1]! + Math.sin(t * 0.45 + p * 1.7) * 0.5;
        live[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(t * 0.5 + p) * 0.9;
      }
      attribute.needsUpdate = true;
    },
  };
}

// ─── The pallid shoal ────────────────────────────────────────────────────────

function buildPallidShoal(): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x5a01);
  const count = 50;
  const geometry = createFishGeometry({
    width: 0.9,
    height: 0.95,
    length: 1.05,
    tailTaper: 0.5,
    dorsal: 0.5,
    pectoral: 0.9,
    tail: { reach: 1.5, lobe: 0.62, notch: 1.05 },
  });
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x2a3234,
    emissiveIntensity: 0.5,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "calamity-pallid-shoal";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  // Silver-ash, *lifted*: the pilot's round-8 lesson — a small dark fish
  // on saturated water turns complement-warm, so the survivors ride above
  // the water's value, not below it.
  const silver = new Color(0xcfd8d2);
  const offsets: { a: number; r: number; h: number; phase: number; scale: number }[] = [];
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    offsets.push({
      a: random.range(0, Math.PI * 2),
      r: random.range(0, 1),
      h: random.signed(1),
      phase: random.range(0, Math.PI * 2),
      scale: random.range(0.85, 1.25),
    });
    tint.copy(silver).multiplyScalar(random.range(0.85, 1.08));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const dummy = new Object3D();
  const centre = { u: 618, v: 4 };
  const update = (_dt: number, time: number, calm: number): void => {
    const t = time * calm;
    const angle = t * 0.05 * Math.PI * 2;
    for (const [i, o] of offsets.entries()) {
      const a = angle + o.a * 0.22;
      const u = centre.u + Math.cos(a) * 56 * (0.82 + o.r * 0.24);
      const v = centre.v + Math.sin(a) * 44 * (0.82 + o.r * 0.24);
      const { x, z } = worldOf(u, v);
      const y = seabedHeight(x, z) + 3.2 + Math.sin(t * 0.5 + o.phase) * 1.1 + o.h * 1.3;
      dummy.position.set(x, y, z);
      const du = -Math.sin(a) * 56;
      const dv = Math.cos(a) * 44;
      const from = worldOf(u, v);
      const to = worldOf(u + du * 0.01, v + dv * 0.01);
      dummy.rotation.set(0, Math.atan2(to.x - from.x, to.z - from.z), 0);
      dummy.scale.setScalar(o.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1);
  return { mesh, update };
}

// ─── The crater gyre ─────────────────────────────────────────────────────────

/**
 * The cold fire's wheel. Each fish rides one closed toroidal circuit: up
 * the plume in a tight bright helix, a spill at the top, and a slow wide
 * glide back down the outside — so the column reads as *rising* even in a
 * still frame, and the wheel never visibly wraps.
 */
function buildGyre(plume: { x: number; z: number; base: number; top: number }): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x69fe);
  const count = 64;
  const geometry = createFishGeometry({
    width: 0.85,
    height: 0.95,
    length: 1.1,
    tailTaper: 0.52,
    dorsal: 0.4,
    pectoral: 0.85,
    tail: { reach: 1.5, lobe: 0.6, notch: 1.05 },
  });
  // A strong cool emissive: the wheel is the region's moving centrepiece
  // and reads at fifty metres down the crater's open column.
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x3a4a50,
    emissiveIntensity: 0.75,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "calamity-crater-gyre";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const silver = new Color(0xd8e2da);
  const offsets: { phase: number; radius: number; speed: number; scale: number; wobble: number }[] = [];
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    offsets.push({
      phase: random.next(),
      radius: random.range(0.8, 1.3),
      speed: random.range(0.85, 1.15),
      scale: random.range(1.0, 1.35),
      wobble: random.range(0, Math.PI * 2),
    });
    tint.copy(silver).multiplyScalar(random.range(0.85, 1.06));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const rise = plume.top - plume.base;
  const dummy = new Object3D();
  const update = (_dt: number, time: number, calm: number): void => {
    const t = time * calm;
    for (const [i, o] of offsets.entries()) {
      const s = (o.phase + t * 0.016 * o.speed) % 1;
      let x: number;
      let y: number;
      let z: number;
      let heading: number;
      if (s < 0.5) {
        // The up-leg: a tight bright helix around the plume.
        const k = s / 0.5;
        const angle = o.wobble + k * Math.PI * 5;
        const radius = 2.6 * o.radius * (1 + k * 0.4);
        x = plume.x + Math.cos(angle) * radius;
        z = plume.z + Math.sin(angle) * radius;
        y = plume.base + k * rise;
        heading = angle + Math.PI / 2;
      } else {
        // The down-leg: a slow wide glide back to the vent's foot.
        const k = (s - 0.5) / 0.5;
        const angle = o.wobble + Math.PI * 5 + k * Math.PI * 1.6;
        const radius = (3.6 + k * 8) * o.radius;
        x = plume.x + Math.cos(angle) * radius;
        z = plume.z + Math.sin(angle) * radius;
        y = plume.top - k * (rise + 2);
        heading = angle + Math.PI / 2 + 0.5;
      }
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, heading, 0);
      dummy.scale.setScalar(o.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1);
  return { mesh, update };
}

// ─── The floor fauna ─────────────────────────────────────────────────────────

/** A five-lobed cushion star, domed, tips lifted — one shared geometry. */
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

function buildStars(): InstancedMesh {
  const random = new Random(SEED ^ 0x57a5);
  const geometry = starGeometry();
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i)) / 0.5;
    const value = 0.72 + smoothstep01((r - 0.35) / 0.55) * 0.42;
    colors[i * 3] = value;
    colors[i * 3 + 1] = value;
    colors[i * 3 + 2] = value * 0.94;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const material = createToonMaterial({ vertexColors: true });
  const count = 26;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "calamity-stars";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  // Bone and ash-violet, with one arterial note in ten — scavengers wear
  // the ruin's colours, and the gardens' red leaks a little further.
  const palette = [0x8d887a, 0x6e6478, 0x9a8f7c, 0xa04a52];
  const dummy = new Object3D();
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    const nearGardens = random.next() < 0.35;
    const u = nearGardens ? SEEP_GARDENS.u + random.signed(30) : 560 + random.next() * 240;
    const v = nearGardens ? SEEP_GARDENS.v + random.signed(30) : random.signed(120);
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) + 0.02, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(random.range(0.7, 1.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tint.setHex(palette[i % palette.length]!).multiplyScalar(random.range(0.85, 1.12));
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

/** A ghost urchin: low dome and a whorl of spines, merged once. */
function urchinGeometry(): BufferGeometry {
  const body = new IcosahedronGeometry(0.14, 1);
  body.scale(1, 0.75, 1);
  const parts: BufferGeometry[] = [body];
  const spikeRandom = new Random(SEED ^ 0x0bc1);
  for (let i = 0; i < 14; i++) {
    const spike = new ConeGeometry(0.016, 0.28, 3).toNonIndexed();
    spike.translate(0, 0.14, 0);
    const theta = spikeRandom.range(0, Math.PI * 2);
    const tilt = spikeRandom.range(0.2, 1.25);
    spike.applyMatrix4(new Matrix4().makeRotationZ(tilt));
    spike.applyMatrix4(new Matrix4().makeRotationY(theta));
    parts.push(spike);
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("calamity urchin parts could not be merged");
  }
  return merged;
}

function buildUrchins(): InstancedMesh {
  const random = new Random(SEED ^ 0x0bc2);
  const geometry = urchinGeometry();
  const material = createToonMaterial({ color: 0x8a8494 });
  const count = 16;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "calamity-urchins";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    // On the crater's upper terraces and the bench around them.
    const { x, z } = worldOf(646 + random.next() * 70, -60 + random.next() * 110);
    dummy.position.set(x, seabedHeight(x, z) + 0.04, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(random.range(0.8, 1.6));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tint.setHex(i % 3 === 0 ? 0x9a8fa2 : 0x7e7890).multiplyScalar(random.range(0.85, 1.1));
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

/** A white crab: a low domed shell, two claw arms, six legs, merged once. */
function crabGeometry(): BufferGeometry {
  const shell = new IcosahedronGeometry(0.16, 1);
  shell.scale(1.25, 0.55, 1);
  const parts: BufferGeometry[] = [shell];
  const legRandom = new Random(SEED ^ 0xc4ab);
  for (let i = 0; i < 6; i++) {
    const leg = new ConeGeometry(0.02, 0.3, 3).toNonIndexed();
    leg.translate(0, -0.12, 0);
    const side = i < 3 ? 1 : -1;
    const k = (i % 3) / 2;
    leg.applyMatrix4(new Matrix4().makeRotationX(side * (1.1 + k * 0.3)));
    leg.applyMatrix4(new Matrix4().makeRotationY(legRandom.range(-0.4, 0.4) + (k - 0.5) * 0.9));
    leg.translate((k - 0.5) * 0.14, -0.02, side * 0.16);
    parts.push(leg);
  }
  for (const side of [-1, 1]) {
    const claw = new ConeGeometry(0.035, 0.24, 4).toNonIndexed();
    claw.translate(0, 0.1, 0);
    claw.applyMatrix4(new Matrix4().makeRotationX(-0.9));
    claw.applyMatrix4(new Matrix4().makeRotationZ(side * 0.5));
    claw.translate(side * 0.1, 0.02, -0.2);
    parts.push(claw);
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("calamity crab parts could not be merged");
  }
  return merged;
}

function buildCrabs(): InstancedMesh {
  const random = new Random(SEED ^ 0xc4a5);
  const geometry = crabGeometry();
  const material = createToonMaterial({ color: 0xd4cec0 });
  const count = 18;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "calamity-crabs";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    // At the seeps and on the crater's second terrace, among the worms.
    const atGardens = i % 3 !== 0;
    const u = atGardens ? SEEP_GARDENS.u + random.signed(24) : WOUND.u + random.signed(16);
    const v = atGardens ? SEEP_GARDENS.v + random.signed(24) : WOUND.v + random.signed(16);
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) + 0.06, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(random.range(0.9, 1.7));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tint.setHex(i % 4 === 0 ? 0xc9a898 : 0xd4cec0).multiplyScalar(random.range(0.85, 1.06));
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}
