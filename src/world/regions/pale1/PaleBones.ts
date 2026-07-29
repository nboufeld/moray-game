import {
  BufferAttribute,
  CapsuleGeometry,
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { archGeometry, slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { BONE_COOL, BONE_WARM, smoothstep01 } from "./PaleShared";
import {
  BONE_FOREST,
  QUIET_GALLERY,
  RAVINE_LIP_U,
  bloomWeight,
  galleryWeight,
  groveWeight,
  ravineChannelCenter,
  recovery,
  worldOf,
} from "./PaleTerrain";

/**
 * The Bone Meadows' white architecture: the Bone Forest's dead thickets,
 * the Bone Cathedral, the Quiet Gallery's monuments, and the Chalk
 * Ravine's dressing — gate jambs, plate ledges, the overlook slab, and
 * the Blush Arch where the first colour climbs.
 *
 * ## The paint (the texture mandate, in white)
 *
 * A dead coral is not grey: its value structure is a violet base — red
 * above green, the region's one shadow colour — rising to warm
 * paper-white tips where the light has bleached longest. The archetypes
 * bake that ramp into vertex colour; the instances spread warm against
 * cool bone in their tints. The monuments carry furrows as *geometry*
 * (a map cannot break a silhouette at forty metres) with the furrow
 * shade baked violet.
 *
 * Streams: trees `SEED ^ 0x0b0e`, monuments `^ 0x0b0f`, stones `^ 0x50c8`.
 */

const SEED = SEEDS.regionPale1;

const UP = new Vector3(0, 1, 0);

export interface PaleBonesBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** The Blush Arch's crown, where the bloom module hangs its first buds. */
  readonly archCrown: { x: number; y: number; z: number };
  /** Monument stations, for the light module's pale column. */
  readonly monuments: readonly { x: number; z: number; height: number }[];
}

// ─── One dead tree ───────────────────────────────────────────────────────────

/**
 * A bone-tree archetype: the staghorn recursion grown to thicket scale
 * and killed — no leaves, no polyps, just the branching skeleton. Built
 * once per archetype and instanced across the forest; unit-height so the
 * instance matrix owns the drawn size.
 */
function boneTreeGeometry(random: Random, depth: number, spread: number): BufferGeometry {
  const parts: BufferGeometry[] = [];

  const grow = (
    base: Vector3,
    direction: Vector3,
    length: number,
    radius: number,
    level: number,
  ): void => {
    const tip = base.clone().addScaledVector(direction, length);
    const segment = new CapsuleGeometry(radius, length, 1, 5);
    segment.applyMatrix4(
      new Matrix4().compose(
        base.clone().add(tip).multiplyScalar(0.5),
        new Quaternion().setFromUnitVectors(UP, direction),
        new Vector3(1, 1, 1),
      ),
    );
    parts.push(segment);
    if (level === 0) {
      return;
    }
    const kids = random.next() < 0.68 ? 2 : 3;
    for (let i = 0; i < kids; i++) {
      const yaw = random.range(0, Math.PI * 2);
      const tilt = random.range(0.5, 1.05) * spread;
      const child = new Vector3(
        direction.x + Math.cos(yaw) * tilt,
        direction.y + random.range(0.2, 0.62),
        direction.z + Math.sin(yaw) * tilt,
      ).normalize();
      grow(tip, child, length * random.range(0.6, 0.78), radius * 0.72, level - 1);
    }
  };

  const trunks = [depth, depth - 1];
  trunks.forEach((level, trunk) => {
    const around = (trunk / trunks.length) * Math.PI * 2 + random.signed(0.4);
    const lean = random.range(0.14, 0.36);
    grow(
      new Vector3(Math.cos(around) * 0.06, 0, Math.sin(around) * 0.06),
      new Vector3(Math.cos(around) * lean, 1, Math.sin(around) * lean).normalize(),
      level === depth ? 0.42 : 0.32,
      0.055,
      level,
    );
  });

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("pale bone tree: capsule merge failed");
  }

  // Unit height, foot on y = 0.
  merged.computeBoundingBox();
  const box = merged.boundingBox!;
  const scale = 1 / Math.max(1e-6, box.max.y - box.min.y);
  merged.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  merged.scale(scale, scale, scale);

  // The bone ramp: violet crotch to paper-white tip. The vertex colour
  // multiplies the instance's warm/cool bone, so the violet lives in the
  // ratio — blue held up, green cut hardest.
  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i)));
    const value = 0.58 + smoothstep01(t / 0.85) * 0.46;
    colors[i * 3] = value * (0.86 + t * 0.14);
    colors[i * 3 + 1] = value * (0.78 + t * 0.2);
    colors[i * 3 + 2] = value * (0.94 + t * 0.06);
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  merged.computeVertexNormals();
  smoothNormals(merged);
  merged.computeBoundingSphere();
  return merged;
}

// ─── One monument ────────────────────────────────────────────────────────────

/**
 * A monument: a huge bleached boulder-coral, furrowed like a brain colony
 * a whole size class above the garden's. The furrows are vertices (the
 * silhouette is the read at gallery distance) and their shade is baked
 * violet — the darkest thing on the white pan is a colour.
 */
function monumentGeometry(seed: number, cycles: number): BufferGeometry {
  const geometry = new IcosahedronGeometry(1, 5);
  const position = geometry.attributes.position!;
  const foot = -0.3;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const length = Math.hypot(x, y, z) || 1;
    const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    const v = Math.asin(Math.max(-1, Math.min(1, y / length))) / Math.PI + 0.5;
    const warp = (fbm(u, v, { seed, period: 4, octaves: 2 }) - 0.5) * 2;
    const ridge = 0.5 + 0.5 * Math.sin((v * cycles + warp * 1.6 + u * 2.4) * Math.PI * 2);
    const cut = (1 - ridge) ** 2;
    const fade = smoothstep01((y / length - foot) / 0.45);
    const scale = 1 - 0.09 * cut * fade;
    position.setXYZ(
      i,
      (x / length) * scale,
      Math.max(foot, (y / length) * scale) * 0.82,
      (z / length) * scale,
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  smoothNormals(geometry);

  // Furrow shade, re-read where the vertices landed: ridge crowns warm
  // white, furrow floors violet.
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i) / 0.82;
    const z = position.getZ(i);
    const length = Math.hypot(x, y, z) || 1;
    const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    const v = Math.asin(Math.max(-1, Math.min(1, y / length))) / Math.PI + 0.5;
    const warp = (fbm(u, v, { seed, period: 4, octaves: 2 }) - 0.5) * 2;
    const ridge = 0.5 + 0.5 * Math.sin((v * cycles + warp * 1.6 + u * 2.4) * Math.PI * 2);
    const value = 0.66 + ridge * 0.38;
    colors[i * 3] = value * (0.9 + ridge * 0.1);
    colors[i * 3 + 1] = value * (0.84 + ridge * 0.16);
    colors[i * 3 + 2] = value * (0.97 + ridge * 0.03);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  // Foot on y = 0, unit height.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const scale = 1 / Math.max(1e-6, box.max.y - box.min.y);
  geometry.translate(0, -box.min.y, 0);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingSphere();
  return geometry;
}

// ─── The build ───────────────────────────────────────────────────────────────

export function buildPaleBones(): PaleBonesBuild {
  const treeRandom = new Random(SEED ^ 0x0b0e);
  const monumentRandom = new Random(SEED ^ 0x0b0f);
  const stoneRandom = new Random(SEED ^ 0x50c8);

  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  // ─── The Bone Forest's thickets ──────────────────────────────────────────
  // Three archetypes, instanced. Placement holds an aisle open along the
  // diver's line from the lip toward the blush, and thins as recovery
  // rises — the dead forest is the white half's geography, not the far
  // quarter's.
  const archetypes = [
    boneTreeGeometry(new Random(SEED ^ 0x0ba1), 3, 1.0),
    boneTreeGeometry(new Random(SEED ^ 0x0ba2), 3, 0.72),
    boneTreeGeometry(new Random(SEED ^ 0x0ba3), 2, 1.15),
  ];

  const boneMaterial = createToonMaterial({ vertexColors: true });

  interface TreeSpot {
    readonly u: number;
    readonly v: number;
    readonly height: number;
    readonly archetype: number;
  }
  const spots: TreeSpot[] = [];
  const aisleAt = (u: number): number => -4 + 7 * Math.sin(u * 0.045);
  let attempts = 0;
  while (spots.length < 44 && attempts < 500) {
    attempts++;
    const angle = treeRandom.range(0, Math.PI * 2);
    const spread = Math.sqrt(treeRandom.next()) * BONE_FOREST.radius;
    const u = BONE_FOREST.u + Math.cos(angle) * spread;
    const v = BONE_FOREST.v + Math.sin(angle) * spread * 0.9;
    if (u < 296 || u > 470) {
      continue;
    }
    if (galleryWeight(u, v) > 0.25 || groveWeight(u, v) > 0.1 || bloomWeight(u, v) > 0.5) {
      continue;
    }
    if (Math.abs(v - aisleAt(u)) < 5) {
      continue;
    }
    if (spots.some((p) => Math.hypot(p.u - u, p.v - v) < 6.5)) {
      continue;
    }
    // Thinning with the story: past the blush the skeletons are scattered
    // survivors between the beds, not a forest.
    if (treeRandom.next() < recovery(u, v) * 0.75) {
      continue;
    }
    spots.push({
      u,
      v,
      height: treeRandom.range(3.6, 8.4),
      archetype: Math.floor(treeRandom.next() * archetypes.length),
    });
  }

  // The outriders: two lone skeletons ahead of the treeline, 50–65 m from
  // the lip — the ghosts in the milk that say the bone forest is coming
  // (the pilot's round-3 lesson: farther than the fog is nowhere).
  spots.push({ u: 316, v: -9, height: 9.2, archetype: 0 });
  spots.push({ u: 329, v: 11, height: 7.6, archetype: 1 });
  // Two blush-band skeletons the buds climb, framing the arch.
  spots.push({ u: 448, v: -16, height: 7.2, archetype: 2 });
  spots.push({ u: 463, v: 2, height: 6.1, archetype: 0 });

  const byArchetype: TreeSpot[][] = archetypes.map(() => []);
  for (const spot of spots) {
    byArchetype[spot.archetype]!.push(spot);
  }
  const dummy = new Object3D();
  const tint = new Color();
  for (const [index, list] of byArchetype.entries()) {
    if (list.length === 0) {
      continue;
    }
    const mesh = new InstancedMesh(archetypes[index]!, boneMaterial, list.length);
    mesh.name = `pale-bone-trees-${index}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    for (const [i, spot] of list.entries()) {
      const { x, z } = worldOf(spot.u, spot.v);
      const foot = seabedHeight(x, z);
      dummy.position.set(x, foot - 0.08, z);
      dummy.rotation.set(0, treeRandom.range(0, Math.PI * 2), 0);
      dummy.scale.set(
        spot.height * treeRandom.range(0.8, 1.05),
        spot.height,
        spot.height * treeRandom.range(0.8, 1.05),
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tint.copy(BONE_WARM).lerp(BONE_COOL, treeRandom.next()).multiplyScalar(treeRandom.range(0.92, 1.06));
      mesh.setColorAt(i, tint);

      contacts.push({ x, z, radius: Math.min(2.4, spot.height * 0.3), strength: 0.42 });
      colliders.push({ center: new Vector3(x, foot + spot.height * 0.22, z), radius: spot.height * 0.16 });
      if (spot.height > 6) {
        colliders.push({
          center: new Vector3(x, foot + spot.height * 0.55, z),
          radius: spot.height * 0.13,
        });
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
    meshes.push(mesh);
  }

  // ─── The Bone Cathedral ──────────────────────────────────────────────────
  // The tallest skeleton in the province: a dead colossus whose crown
  // once shaded this whole quarter, alone on its hummock where the aisle
  // bends. Its own merged geometry — a landmark is not an instance.
  const cathedral = boneTreeGeometry(new Random(SEED ^ 0x0bca), 4, 0.88);
  const cathedralAt = worldOf(352, -34);
  const cathedralFoot = seabedHeight(cathedralAt.x, cathedralAt.z);
  {
    const height = 12.5;
    const geometry = cathedral.clone();
    geometry.scale(height * 0.95, height, height * 0.95);
    geometry.translate(cathedralAt.x, cathedralFoot - 0.1, cathedralAt.z);
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, boneMaterial);
    mesh.name = "pale-bone-cathedral";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
    contacts.push({ x: cathedralAt.x, z: cathedralAt.z, radius: 3.4, strength: 0.5 });
    for (const level of [0.16, 0.42, 0.68]) {
      colliders.push({
        center: new Vector3(cathedralAt.x, cathedralFoot + height * level, cathedralAt.z),
        radius: height * (0.2 - level * 0.1),
      });
    }
  }
  cathedral.dispose();

  // ─── The Quiet Gallery's monuments ───────────────────────────────────────
  // Five bleached colossi alone on the white pan, spaced like statues in
  // a hall — the region's most austere composition. Two furrow patterns,
  // instanced; each stands on its own contact ring and collider stack.
  const monumentShapes = [monumentGeometry(SEED ^ 0x0d01, 2.4), monumentGeometry(SEED ^ 0x0d02, 3.1)];
  const monumentMaterial = createToonMaterial({ vertexColors: true });
  const monumentSpots: { u: number; v: number; height: number; width: number }[] = [
    { u: QUIET_GALLERY.u - 18, v: QUIET_GALLERY.v - 14, height: 5.6, width: 1.15 },
    { u: QUIET_GALLERY.u + 6, v: QUIET_GALLERY.v + 2, height: 6.8, width: 0.95 },
    { u: QUIET_GALLERY.u + 24, v: QUIET_GALLERY.v - 20, height: 4.4, width: 1.3 },
    { u: QUIET_GALLERY.u - 4, v: QUIET_GALLERY.v + 26, height: 5.0, width: 1.05 },
    { u: QUIET_GALLERY.u + 30, v: QUIET_GALLERY.v + 18, height: 3.8, width: 1.2 },
  ];
  const monuments: { x: number; z: number; height: number }[] = [];
  for (const [index, spot] of monumentSpots.entries()) {
    const shape = monumentShapes[index % monumentShapes.length]!;
    const mesh = new InstancedMesh(shape, monumentMaterial, 1);
    mesh.name = `pale-monument-${index}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const { x, z } = worldOf(spot.u, spot.v);
    const foot = seabedHeight(x, z);
    dummy.position.set(x, foot - 0.12, z);
    dummy.rotation.set(0, monumentRandom.range(0, Math.PI * 2), 0);
    dummy.scale.set(spot.height * spot.width, spot.height, spot.height * spot.width);
    dummy.updateMatrix();
    mesh.setMatrixAt(0, dummy.matrix);
    tint.copy(BONE_WARM).lerp(BONE_COOL, monumentRandom.next()).multiplyScalar(1.0);
    mesh.setColorAt(0, tint);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
    meshes.push(mesh);
    monuments.push({ x, z, height: spot.height });
    contacts.push({ x, z, radius: spot.height * 0.72, strength: 0.46 });
    colliders.push({
      center: new Vector3(x, foot + spot.height * 0.4, z),
      radius: spot.height * 0.48,
    });
    if (spot.height > 5) {
      colliders.push({
        center: new Vector3(x, foot + spot.height * 0.78, z),
        radius: spot.height * 0.3,
      });
    }
  }

  // ─── The Chalk Ravine's dressing ─────────────────────────────────────────
  const chalk = createRockMaterial(0xc7c0b0);
  const coolChalk = createRockMaterial(0xb4b6bd);

  const stand = (
    geometry: BufferGeometry,
    u: number,
    v: number,
    yaw: number,
    radius: number,
    height: number,
    material = chalk,
  ): void => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, material);
    mesh.name = "pale-chalk";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
    contacts.push({ x, z, radius: radius * 1.3, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + height * 0.35, z), radius: radius * 0.85 });
    if (height > radius * 1.6) {
      colliders.push({ center: new Vector3(x, y + height * 0.75, z), radius: radius * 0.6 });
    }
  };

  // The Ravine Gate: two pale jamb stacks where the Ghost Reef's end wall
  // opens — the province's doorway.
  stand(
    stackGeometry(
      [
        { radius: 1.4, rise: 0.6, stretch: 1.9, lean: 0.4 },
        { radius: 1.0, rise: 3.2, stretch: 1.7, lean: 0.9 },
      ],
      { seed: SEED ^ 0x0a11 },
    ),
    55,
    -7.2,
    0.5,
    1.4,
    5.0,
  );
  stand(
    stackGeometry(
      [
        { radius: 1.2, rise: 0.5, stretch: 1.8, lean: -0.3 },
        { radius: 0.85, rise: 2.8, stretch: 1.6, lean: -0.8 },
      ],
      { seed: SEED ^ 0x0a12 },
    ),
    57,
    7.6,
    2.7,
    1.2,
    4.2,
    coolChalk,
  );

  // The Chalk Stairs: plate-slab ledges seated on alternating benches down
  // the ravine — with the lone skeletons below, the something that
  // breaches the milk every ~28 m of a 200 m approach.
  for (let i = 0; i < 8; i++) {
    const u = 84 + i * 26 + stoneRandom.signed(5);
    const side = i % 2 === 0 ? -1 : 1;
    const lateral = ravineChannelCenter(u) + side * stoneRandom.range(5.2, 7.6);
    const radius = stoneRandom.range(1.3, 2.4);
    const height = radius * stoneRandom.range(0.42, 0.6);
    stand(
      slabGeometry({ seed: SEED ^ (0x0aa0 + i), radius, height }),
      u,
      lateral,
      stoneRandom.range(0, Math.PI * 2),
      radius,
      height,
      i % 3 === 1 ? coolChalk : chalk,
    );
  }
  // Three lone ravine skeletons between the stairs — small dead trees in
  // the hush, the first hint of what the disc will open onto.
  for (const [i, at] of ([[118, 6.5], [172, -7], [226, 5]] as const).entries()) {
    const geometry = archetypes[i % archetypes.length]!.clone();
    const height = stoneRandom.range(2.4, 3.4);
    const { x, z } = worldOf(at[0], ravineChannelCenter(at[0]) + at[1]);
    const foot = seabedHeight(x, z);
    geometry.scale(height, height, height);
    geometry.applyMatrix4(new Matrix4().makeRotationY(stoneRandom.range(0, Math.PI * 2)));
    geometry.translate(x, foot - 0.06, z);
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, boneMaterial);
    mesh.name = "pale-ravine-skeleton";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
    contacts.push({ x, z, radius: 1.0, strength: 0.4 });
    colliders.push({ center: new Vector3(x, foot + height * 0.3, z), radius: height * 0.22 });
  }

  // The Overlook slab beside the lip: the frame's edge while the Bone
  // Forest opens below.
  stand(
    slabGeometry({ seed: SEED ^ 0x0a13, radius: 2.5, height: 1.3 }),
    RAVINE_LIP_U - 5,
    ravineChannelCenter(RAVINE_LIP_U - 5) - 7.2,
    stoneRandom.range(0, Math.PI * 2),
    2.5,
    1.3,
  );

  // ─── The Blush Arch ──────────────────────────────────────────────────────
  // A bleached arch over the aisle at the First Blush's edge: the doorway
  // between the white world and the coloured one, budded at its crown.
  const archAt = { u: 456, v: -7 };
  const archWorld = worldOf(archAt.u, archAt.v);
  const archFoot = seabedHeight(archWorld.x, archWorld.z);
  const arch = archGeometry({
    seed: SEED ^ 0x0c11,
    span: 6.8,
    legHeight: 3.6,
    legRadius: 1.0,
    beamRadius: 0.8,
    rise: 1.5,
  });
  const archYaw = 1.15;
  arch.applyMatrix4(new Matrix4().makeRotationY(archYaw));
  arch.translate(archWorld.x, archFoot, archWorld.z);
  arch.computeBoundingSphere();
  const archMesh = new Mesh(arch, chalk);
  archMesh.name = "pale-blush-arch";
  archMesh.castShadow = false;
  archMesh.receiveShadow = false;
  meshes.push(archMesh);
  const legOffset = new Vector3(3.4, 0, 0).applyMatrix4(new Matrix4().makeRotationY(archYaw));
  for (const side of [-1, 1]) {
    colliders.push({
      center: new Vector3(
        archWorld.x + side * legOffset.x,
        archFoot + 1.5,
        archWorld.z + side * legOffset.z,
      ),
      radius: 1.15,
    });
    contacts.push({
      x: archWorld.x + side * legOffset.x,
      z: archWorld.z + side * legOffset.z,
      radius: 1.5,
      strength: 0.42,
    });
  }
  const archCrown = { x: archWorld.x, y: archFoot + 5.2, z: archWorld.z };

  // ─── The Gallery's approach stones ───────────────────────────────────────
  // Two low plates on the pan's rim: the threshold the gallery pose looks
  // across, keeping the monuments' hall from starting mid-air.
  stand(
    slabGeometry({ seed: SEED ^ 0x0a14, radius: 2.0, height: 0.9 }),
    QUIET_GALLERY.u - 34,
    QUIET_GALLERY.v - 30,
    stoneRandom.range(0, Math.PI * 2),
    2.0,
    0.9,
    coolChalk,
  );
  stand(
    slabGeometry({ seed: SEED ^ 0x0a15, radius: 1.5, height: 0.7 }),
    QUIET_GALLERY.u - 28,
    QUIET_GALLERY.v - 22,
    stoneRandom.range(0, Math.PI * 2),
    1.5,
    0.7,
  );

  return { meshes, colliders, contacts, archCrown, monuments };
}