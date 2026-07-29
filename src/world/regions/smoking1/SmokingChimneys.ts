import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { EMBER, SINTER_PALE, applyVeinGlow, smoothstep01 } from "./SmokingShared";
import {
  CHIMNEYS,
  calderaWeight,
  chimneysWeight,
  gorgeChannelCenter,
  worldOf,
} from "./SmokingTerrain";

/**
 * The Chimney Forest: smokers tall as trees. The Vent Springs' chimney
 * idiom grown to geography and repainted (the texture mandate): the wing's
 * stacks were two metres of charcoal with amber veins; these are eight to
 * sixteen — trunks, effectively — so the paint gains what a trunk needs
 * to read as a column: four value stops up the shaft (violet-charcoal
 * foot, warm mid, sinter-dusted shoulder, pale crown lip), veins that
 * *widen* as they climb toward the throat, and an ember throat whose glow
 * rides the vein bake through the emissive.
 *
 * Over every crown: a slow column of smoke-puffs (one instanced draw for
 * the whole forest, additive, ember-warmed grey) rising, swelling and
 * dying — the forest breathes. At authored feet: ember vents, low cracked
 * domes whose crack-paint glows.
 */

const SEED = SEEDS.regionSmoking1;

export interface ChimneyStand {
  readonly u: number;
  readonly v: number;
  readonly height: number;
  readonly x: number;
  readonly z: number;
  readonly y: number;
}

export interface SmokingChimneysBuild {
  readonly meshes: (Mesh | InstancedMesh)[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** The stands, for the spiral shoal's thermal columns. */
  readonly stands: ChimneyStand[];
  /** The Twin Kings' seats, for poses and the shoal's path. */
  readonly kings: ChimneyStand[];
  update(dt: number, reducedMotion: boolean): void;
}

/** The Twin Kings: the two tallest smokers, the forest's own gate. */
const KINGS = [
  { u: 508, v: -44, height: 15.5 },
  { u: 516, v: -52, height: 16.5 },
] as const;

/** The First Breath: the lone gorge smoker where the water warms. */
const FIRST_BREATH = { u: 158, height: 6.4 } as const;

// Round 2: round 1's stacks read as one orange-brick mass — the veins
// flooded the stops. Greyer, cooler stone so the amber is an *event*.
const FOOT_TINT = new Color(0x4c4452);
const MID_TINT = new Color(0x5e544e);
const SHOULDER_TINT = new Color(0x847462);
const CROWN_TINT = new Color(0xb8a48e);

/** One smoker archetype: unit height, tree-tall proportions. */
function smokerGeometry(variant: number): BufferGeometry {
  const random = new Random(SEED ^ (0x51c0 + variant * 0x9e37));
  const wobble = (magnitude: number): number => 1 + random.signed(magnitude);

  // Authored outline, foot to crater: a buried root flare, a long shaft
  // with two mineral bulges, a shoulder, and a lip turning back in.
  const profile: readonly (readonly [number, number])[] = [
    [1.35, -0.04],
    [1.0, 0.06],
    [0.62, 0.16],
    [0.5, 0.3],
    [0.56, 0.42],
    [0.44, 0.55],
    [0.5, 0.68],
    [0.4, 0.8],
    [0.34, 0.9],
    [0.3, 0.97],
    [0.32, 1.0],
    [0.18, 1.0],
    [0.12, 0.92],
  ];
  const points: Vector2[] = [new Vector2(0, -0.12)];
  for (const [radius, y] of profile) {
    points.push(new Vector2(radius * wobble(0.1), y * wobble(0.03)));
  }
  points.push(new Vector2(0, 0.86));

  const geometry = new LatheGeometry(points, 12);
  roughSmoker(geometry, SEED ^ (0x0af0 + variant));
  bakeSmokerPaint(geometry, SEED ^ (0x0af0 + variant));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Seam-safe out-of-round, sampled by direction and height. */
function roughSmoker(geometry: BufferGeometry, seed: number): void {
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radius = Math.hypot(x, z);
    if (radius < 1e-4) {
      continue;
    }
    const t = Math.min(1, Math.max(0, (y + 0.12) / 1.12));
    const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    const lump = fbm(u, t * 2.4, { seed, period: 3, octaves: 2 }) - 0.5;
    const scale = 1 + lump * 0.22 * Math.sin(Math.PI * Math.min(1, t * 1.2));
    position.setX(i, x * scale);
    position.setZ(i, z * scale);
  }
  position.needsUpdate = true;
}

/**
 * The trunk paint: four value stops, widening veins, ember throat. The
 * whole bake multiplies the instance colour, so per-smoker weathering
 * drift stays free.
 */
function bakeSmokerPaint(geometry: BufferGeometry, seed: number): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const tint = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = Math.min(1, Math.max(0, (y + 0.12) / 1.12));
    const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    const r = Math.hypot(x, z);

    // Four stops up the stack.
    if (t < 0.3) {
      tint.copy(FOOT_TINT).lerp(MID_TINT, smoothstep01(t / 0.3));
    } else if (t < 0.75) {
      tint.copy(MID_TINT).lerp(SHOULDER_TINT, smoothstep01((t - 0.3) / 0.45));
    } else {
      tint.copy(SHOULDER_TINT).lerp(CROWN_TINT, smoothstep01((t - 0.75) / 0.25));
    }
    const ripple = 0.9 + fbm(u * 2, t * 4, { seed: seed ^ 0x6a31, period: 4, octaves: 2 }) * 0.2;
    tint.multiplyScalar(ripple);

    // The veins: born at the waist, widening toward the crown — cut the
    // rock out first, then lay the amber in, so the vein is an inclusion.
    // Threshold raised in round 2: at 0.62 the veins covered the stack.
    const field = fbm(u * 3, t * 1.3, { seed: seed ^ 0x4b17, period: 3, octaves: 2 });
    const width = 0.13 - t * 0.05;
    const vein = smoothstep01((field - (0.7 - t * 0.05)) / width) * smoothstep01((t - 0.24) / 0.3);
    tint.multiplyScalar(1 - vein * 0.5);
    tint.r += vein * EMBER.r * 0.8;
    tint.g += vein * EMBER.g * 0.72;
    tint.b += vein * EMBER.b * 0.6;

    // The throat: inside the crater lip everything leans ember.
    const throat = smoothstep01((t - 0.9) / 0.1) * (1 - smoothstep01((r - 0.2) / 0.16));
    tint.lerp(EMBER, throat * 0.85);

    // Sinter dust drifting down from the crown.
    const dust =
      smoothstep01((fbm(u * 5, t * 6, { seed: seed ^ 0x2f09, period: 3, octaves: 2 }) - 0.56) / 0.2) *
      smoothstep01((t - 0.5) / 0.3) *
      0.4;
    tint.lerp(SINTER_PALE, dust);

    colors[i * 3] = Math.min(1, tint.r);
    colors[i * 3 + 1] = Math.min(1, tint.g);
    colors[i * 3 + 2] = Math.min(1, tint.b);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** An ember vent: a low cracked dome whose crack paint glows. */
function ventGeometry(): BufferGeometry {
  const points: Vector2[] = [
    new Vector2(0, 0.34),
    new Vector2(0.22, 0.36),
    new Vector2(0.5, 0.28),
    new Vector2(0.78, 0.14),
    new Vector2(0.95, -0.08),
    new Vector2(0, -0.08),
  ];
  const geometry = new LatheGeometry(points, 10);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const tint = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const r = Math.hypot(x, z);
    const theta = Math.atan2(z, x);
    const crack = smoothstep01(
      (fbm(theta * 1.2, r * 2.2, { seed: SEED ^ 0xcaca, period: 4, octaves: 2 }) - 0.55) / 0.14,
    );
    const throat = 1 - smoothstep01((r - 0.12) / 0.3);
    tint.copy(FOOT_TINT).multiplyScalar(0.9);
    tint.lerp(EMBER, Math.min(1, crack * 0.9 + throat));
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

let smokeSprite: DataTexture | undefined;
function smokeTexture(): DataTexture {
  smokeSprite ??= buildColorTexture(64, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const wobble = fbm(u * 2, v * 2, { seed: SEED ^ 0x50f7, period: 3, octaves: 2 });
    const halo = Math.pow(Math.max(0, 1 - d * (0.9 + wobble * 0.35)), 1.9);
    return [halo, halo * 0.9, halo * 0.82];
  });
  return smokeSprite;
}

/** Crossed-quad puff card, unit size. */
function puffGeometry(): BufferGeometry {
  const a = new PlaneGeometry(1, 1);
  const b = new PlaneGeometry(1, 1);
  b.rotateY(Math.PI / 2);
  const merged = mergeGeometries([a, b], false);
  a.dispose();
  b.dispose();
  if (!merged) {
    throw new Error("smoulder puff quads could not be merged");
  }
  return merged;
}

export function buildSmokingChimneys(): SmokingChimneysBuild {
  const random = new Random(SEED ^ 0x51c7);
  const meshes: (Mesh | InstancedMesh)[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const stands: ChimneyStand[] = [];
  const kings: ChimneyStand[] = [];

  // ─── The smokers ─────────────────────────────────────────────────────────
  const seat = (u: number, v: number, height: number): ChimneyStand => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    return { u, v, height, x, z, y };
  };

  for (const king of KINGS) {
    kings.push(seat(king.u, king.v, king.height));
  }
  stands.push(...kings);

  let attempts = 0;
  while (stands.length < 20 && attempts < 400) {
    attempts++;
    const angle = random.range(0, Math.PI * 2);
    const spread = Math.sqrt(random.next()) * (CHIMNEYS.radius * 0.88);
    const u = CHIMNEYS.u + Math.cos(angle) * spread;
    const v = CHIMNEYS.v + Math.sin(angle) * spread;
    if (chimneysWeight(u, v) < 0.4 || calderaWeight(u, v) > 0.25) {
      continue;
    }
    if (stands.some((s) => Math.hypot(s.u - u, s.v - v) < 9)) {
      continue;
    }
    stands.push(seat(u, v, random.range(7.5, 13.5)));
  }

  // The First Breath, alone in the gorge where the water warms — the
  // approach's mid-way reveal. Seated on the channel's own shoulder.
  const breathV = gorgeChannelCenter(FIRST_BREATH.u) + 6;
  const firstBreath = seat(FIRST_BREATH.u, breathV, FIRST_BREATH.height);
  stands.push(firstBreath);

  // The Scout: one lone smoker on the ash flats past the lip, standing
  // where the reveal's fog can just reach it — the ghost that says the
  // forest is coming (the pilot's outrider lesson: 50–65 m is where a
  // ghost actually ghosts; round 4 measured 66 m as invisible).
  stands.push(seat(308, 14, 8));

  // Instanced across three archetypes.
  const archetypes = [0, 1, 2].map((variant) => smokerGeometry(variant));
  const smokerMaterial = createToonMaterial({
    vertexColors: true,
    emissive: 0xff8c3a,
    emissiveIntensity: 0.3,
  });
  applyVeinGlow(smokerMaterial, "smoulder-smoker");
  const perArchetype = Math.ceil(stands.length / archetypes.length) + 2;
  const smokerMeshes = archetypes.map((geometry) => {
    const mesh = new InstancedMesh(geometry, smokerMaterial, perArchetype);
    mesh.name = "smoulder-smokers";
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    return mesh;
  });
  const dummy = new Object3D();
  const tint = new Color();
  const counts = [0, 0, 0];
  for (const stand of stands) {
    const variant = Math.floor(random.next() * archetypes.length);
    const mesh = smokerMeshes[variant]!;
    // Girth up a step in round 2: at 0.10–0.13 the short smokers read as
    // poles, and a smoker is a mineral tree, not a mast.
    const girth = stand.height * random.range(0.13, 0.17);
    dummy.position.set(stand.x, stand.y - 0.2, stand.z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.set(girth, stand.height + 0.2, girth);
    dummy.updateMatrix();
    mesh.setMatrixAt(counts[variant]!, dummy.matrix);
    tint.setScalar(random.range(0.85, 1.1));
    mesh.setColorAt(counts[variant]!, tint);
    counts[variant]!++;

    colliders.push(
      { center: new Vector3(stand.x, stand.y + stand.height * 0.18, stand.z), radius: girth * 1.15 },
      { center: new Vector3(stand.x, stand.y + stand.height * 0.55, stand.z), radius: girth * 0.75 },
      { center: new Vector3(stand.x, stand.y + stand.height * 0.9, stand.z), radius: girth * 0.55 },
    );
    contacts.push({ x: stand.x, z: stand.z, radius: girth * 2.6, strength: 0.45 });
  }
  for (const [variant, mesh] of smokerMeshes.entries()) {
    mesh.count = counts[variant]!;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
    meshes.push(mesh);
  }

  // ─── The ember vents ─────────────────────────────────────────────────────
  const ventMaterial = createToonMaterial({
    vertexColors: true,
    emissive: 0xff7a38,
    emissiveIntensity: 0.5,
  });
  applyVeinGlow(ventMaterial, "smoulder-vent");
  const ventCount = 30;
  const vents = new InstancedMesh(ventGeometry(), ventMaterial, ventCount);
  vents.name = "smoulder-vents";
  vents.castShadow = false;
  vents.receiveShadow = false;
  let ventPlaced = 0;
  for (const stand of stands) {
    if (ventPlaced >= ventCount) {
      break;
    }
    const around = 1 + Math.floor(random.next() * 2);
    for (let i = 0; i < around && ventPlaced < ventCount; i++) {
      const theta = random.range(0, Math.PI * 2);
      const d = random.range(2.2, 4.4) * Math.max(0.6, stand.height / 12);
      const x = stand.x + Math.cos(theta) * d;
      const z = stand.z + Math.sin(theta) * d;
      dummy.position.set(x, seabedHeight(x, z) + 0.02, z);
      dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
      dummy.scale.setScalar(random.range(0.7, 1.6));
      dummy.updateMatrix();
      vents.setMatrixAt(ventPlaced, dummy.matrix);
      tint.setScalar(random.range(0.9, 1.1));
      vents.setColorAt(ventPlaced, tint);
      ventPlaced++;
    }
  }
  vents.count = ventPlaced;
  vents.instanceMatrix.needsUpdate = true;
  if (vents.instanceColor) {
    vents.instanceColor.needsUpdate = true;
  }
  vents.computeBoundingSphere();
  meshes.push(vents);

  // ─── The smoke columns ───────────────────────────────────────────────────
  // Six puffs per smoker, one instanced draw for the whole forest. Each
  // puff climbs its column, swells, and dies into the water — additive,
  // so brightness is its opacity, warm grey keyed to the ember throats.
  const puffsPer = 7;
  const puffCount = stands.length * puffsPer;
  const smokeMaterial = new MeshBasicMaterial({
    map: smokeTexture(),
    transparent: true,
    opacity: 0.26,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  });
  const smoke = new InstancedMesh(puffGeometry(), smokeMaterial, puffCount);
  smoke.name = "smoulder-smoke";
  smoke.castShadow = false;
  smoke.receiveShadow = false;
  smoke.frustumCulled = false;
  smoke.instanceMatrix.setUsage(DynamicDrawUsage);

  const puffHomes: { x: number; y: number; z: number; rise: number; phase: number; drift: number }[] =
    [];
  for (const stand of stands) {
    for (let i = 0; i < puffsPer; i++) {
      puffHomes.push({
        x: stand.x,
        y: stand.y + stand.height,
        z: stand.z,
        rise: 6 + stand.height * 0.6,
        phase: random.range(0, 1),
        drift: random.range(0, Math.PI * 2),
      });
    }
  }
  const smokeTint = new Color();
  const poseSmoke = (time: number): void => {
    for (const [i, puff] of puffHomes.entries()) {
      const cycle = (time * 0.045 + puff.phase) % 1;
      // Round 3: rounds 1–2 read the puffs as fairy lights — small and
      // bright is a spark, big and dim is smoke.
      const swell = 2.6 + cycle * 6;
      dummy.position.set(
        puff.x + Math.sin(time * 0.14 + puff.drift + cycle * 3) * (0.5 + cycle * 2.4),
        puff.y + cycle * puff.rise,
        puff.z + Math.cos(time * 0.11 + puff.drift + cycle * 2.4) * (0.5 + cycle * 2.4),
      );
      dummy.rotation.set(0, puff.drift + cycle * 1.8, 0);
      dummy.scale.setScalar(swell);
      dummy.updateMatrix();
      smoke.setMatrixAt(i, dummy.matrix);
      // Born dim, brightest a third up, gone at the top.
      const life = smoothstep01(cycle / 0.18) * (1 - smoothstep01((cycle - 0.55) / 0.45));
      smokeTint.setRGB(1, 0.86, 0.74).multiplyScalar(life * 0.55);
      smoke.setColorAt(i, smokeTint);
    }
    smoke.instanceMatrix.needsUpdate = true;
    if (smoke.instanceColor) {
      smoke.instanceColor.needsUpdate = true;
    }
  };
  poseSmoke(0);
  meshes.push(smoke);

  let time = 0;
  return {
    meshes,
    colliders,
    contacts,
    stands,
    kings,
    update(dt: number, reducedMotion: boolean): void {
      time += dt * (reducedMotion ? 0.35 : 1);
      poseSmoke(time);
    },
  };
}
