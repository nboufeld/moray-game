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
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
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
  ravineChannelHalf,
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

/**
 * The chalk skin: pale strata with a fine tooth. Round 1 used the shared
 * rock wash and every "chalk" plate rendered moss-green and violet — the
 * rock material's lichen mottle is the wrong story here, so the ravine's
 * stone carries its own map: paper value, faint cool strata, no lichen.
 */
let chalkMap: DataTexture | undefined;
function chalkTexture(): DataTexture {
  chalkMap ??= buildColorTexture(64, (u, v) => {
    const wobble = (fbm(u, v, { seed: SEED ^ 0xc4a7, period: 4, octaves: 2 }) - 0.5) * 0.8;
    const strata = 0.5 + 0.5 * Math.sin((v * 6 + wobble) * Math.PI * 2);
    const tooth = fbm(u * 3, v * 3, { seed: SEED ^ 0xc4a8, period: 9, octaves: 3 });
    const shade = 0.88 + strata * 0.1 + tooth * 0.1;
    return [shade, shade * 0.99, shade * 0.94 + strata * 0.03];
  });
  return chalkMap;
}

/** A scree seat the fill's kit aprons fan from (kit `ScreeAnchor` shape). */
export interface PaleScreeAnchor {
  readonly pos: readonly [number, number];
  readonly facing: number;
  readonly spread: number;
}

export interface PaleBonesBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** The Blush Arch's crown, where the bloom module hangs its first buds. */
  readonly archCrown: { x: number; y: number; z: number };
  /** Monument stations, for the light module's pale column. */
  readonly monuments: readonly { x: number; z: number; height: number }[];
  /** Every bone tree as planted (world space) — the fill's percher and
   *  root-litter anchors read these instead of re-rolling anything. */
  readonly treeSpots: readonly { x: number; z: number; height: number }[];
  /** Where the fill's scree aprons seat: the things that grow FROM
   *  somewhere — stairs slabs, jambs, ledges, the arch, the cathedral.
   *  (No monument anchors: the Quiet Gallery pan is registry stillness.) */
  readonly screeAnchors: {
    readonly ravine: readonly PaleScreeAnchor[];
    readonly blush: readonly PaleScreeAnchor[];
  };
}

// ─── One dead tree ───────────────────────────────────────────────────────────

/**
 * A bone-tree archetype: the staghorn recursion grown to thicket scale
 * and killed — no leaves, no polyps, just the branching skeleton. Built
 * once per archetype and instanced across the forest; unit-height so the
 * instance matrix owns the drawn size.
 */
function boneTreeGeometry(random: Random, depth: number, spread: number, girth = 1): BufferGeometry {
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
      0.055 * girth,
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
  // ratio — blue held up, green cut hardest. Warmed a step in round 2:
  // round 1's whole trees read lilac, and the violet belongs only in the
  // lowest reach where the light never gets.
  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i)));
    const value = 0.62 + smoothstep01(t / 0.7) * 0.46;
    const crotch = 1 - smoothstep01(t / 0.3);
    colors[i * 3] = value * (1.0 - crotch * 0.08);
    colors[i * 3 + 1] = value * (1.0 - crotch * 0.18);
    colors[i * 3 + 2] = value * (1.0 - crotch * 0.02);
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
    // Fill round: 0.09 → 0.14 — the audit's "smooth balloons": the furrow
    // geometry did not survive to the gallery pose's distance.
    const scale = 1 - 0.14 * cut * fade;
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
  // white, furrow floors a violet held to the cuts alone — round 1's
  // whole-dome violet read as a lilac balloon.
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
    const cut = (1 - ridge) ** 2;
    // Fill round: ridge/furrow contrast up — the bake at 0.74–1.08 washed
    // out under the milk's flat light and the monuments read as balloons.
    const value = 0.66 + ridge * 0.46;
    colors[i * 3] = value * (1.0 - cut * 0.1);
    colors[i * 3 + 1] = value * (1.0 - cut * 0.26);
    colors[i * 3 + 2] = value * (1.0 - cut * 0.02);
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
  const treeWorld: { x: number; z: number; height: number }[] = [];
  const ravineAnchors: PaleScreeAnchor[] = [];
  const blushAnchors: PaleScreeAnchor[] = [];

  /** Facing from a spoke point toward the channel's own centre — the
   *  downslope a ravine apron spills along, in world atan2 terms. */
  const towardChannel = (u: number, v: number): number => {
    const from = worldOf(u, v);
    const to = worldOf(u, ravineChannelCenter(u));
    return Math.atan2(to.z - from.z, to.x - from.x);
  };

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
      tint
        .copy(BONE_WARM)
        .lerp(BONE_COOL, treeRandom.next() * 0.55)
        .multiplyScalar(treeRandom.range(0.94, 1.08));
      mesh.setColorAt(i, tint);

      treeWorld.push({ x, z, height: spot.height });
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
  // bends. Its own merged geometry — a landmark is not an instance — with
  // real girth (round 1's cathedral read as one more thicket).
  const cathedral = boneTreeGeometry(new Random(SEED ^ 0x0bca), 4, 0.82, 1.7);
  const cathedralAt = worldOf(352, -34);
  const cathedralFoot = seabedHeight(cathedralAt.x, cathedralAt.z);
  {
    const height = 14.5;
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
  // Five bleached colossi on the white pan, arranged as a loose *avenue*
  // the approach pose looks down — statues in a hall, alternating flanks,
  // the tallest at the heart (round 1 scattered them and the pose caught
  // one). Two furrow patterns, instanced; each stands on its own contact
  // ring and collider stack.
  const monumentShapes = [monumentGeometry(SEED ^ 0x0d01, 2.4), monumentGeometry(SEED ^ 0x0d02, 3.1)];
  const monumentMaterial = createToonMaterial({ vertexColors: true });
  const monumentSpots: { u: number; v: number; height: number; width: number }[] = [
    { u: 360.6, v: 66.9, height: 5.8, width: 1.15 },
    { u: 383.4, v: 62.0, height: 4.8, width: 1.3 },
    { u: 381.9, v: 85.0, height: 7.2, width: 0.98 },
    { u: 404.4, v: 79.8, height: 4.2, width: 1.25 },
    { u: 399.7, v: 102.6, height: 5.4, width: 1.05 },
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
  const chalk = createToonMaterial({ map: chalkTexture(), color: 0xf6efdd });
  const coolChalk = createToonMaterial({ map: chalkTexture(), color: 0xe3e5ee });

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
  for (const [ju, jv] of [
    [55, -7.2],
    [57, 7.6],
  ] as const) {
    const jamb = worldOf(ju, jv);
    ravineAnchors.push({
      pos: [jamb.x, jamb.z],
      facing: towardChannel(ju, jv),
      spread: 2.6,
    });
  }

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
    // Every stairs slab OUTSIDE the hush seats a fill apron: the slab
    // grew FROM the bench. Inside the Ravine Hush (u 130–210) the slabs
    // stay bare — the rest wins over the cadence (MASTER R10); the dust
    // bloom and the u-200 ledge carry that stretch.
    if (u < 126 || u > 214) {
      const slabWorld = worldOf(u, lateral);
      ravineAnchors.push({
        pos: [slabWorld.x, slabWorld.z],
        facing: towardChannel(u, lateral),
        spread: radius * 1.9,
      });
    }
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
  // (No apron at the overlook slab: it stands inside the saddle lip
  // crest, a registered rest — its bareness is the composition.)

  // ─── The strata ledges ───────────────────────────────────────────────────
  // Fill plan §2 (● 200) and §3: the wall becomes architecture — three
  // stacked-plate ledge stacks stepping out of the benches, one merged
  // draw. Fresh stream (`FILL_SEEDS`-class constant), appended after all
  // existing draws: the reroll fence holds.
  {
    const ledgeRandom = new Random(SEED ^ 0xfa21);
    const ledgeParts: BufferGeometry[] = [];
    const stations: readonly { u: number; side: number; plates: number }[] = [
      { u: 96, side: 1, plates: 3 },
      { u: 200, side: -1, plates: 4 },
      { u: 232, side: 1, plates: 3 },
    ];
    for (const [index, station] of stations.entries()) {
      const vc = ravineChannelCenter(station.u);
      const seatV = vc + station.side * (ravineChannelHalf(station.u) + 3.2);
      const seat = worldOf(station.u, seatV);
      const floor = seabedHeight(seat.x, seat.z);
      let level = floor + 0.2;
      for (let p = 0; p < station.plates; p++) {
        const radius = ledgeRandom.range(2.0, 3.0) * (1 - p * 0.14);
        const height = radius * ledgeRandom.range(0.22, 0.3);
        const plate = slabGeometry({ seed: SEED ^ (0xfb00 + index * 8 + p), radius, height });
        // Each plate steps a little toward the channel as it climbs — the
        // overhang that turns a bank into architecture.
        const reachV = seatV - station.side * (0.7 + p * 0.85);
        const at = worldOf(station.u + ledgeRandom.signed(0.8), reachV);
        plate.applyMatrix4(new Matrix4().makeRotationY(ledgeRandom.range(0, Math.PI * 2)));
        plate.translate(at.x, level, at.z);
        ledgeParts.push(plate);
        level += height * ledgeRandom.range(0.7, 0.95);
      }
      contacts.push({ x: seat.x, z: seat.z, radius: 2.8, strength: 0.4 });
      colliders.push({ center: new Vector3(seat.x, floor + 1.0, seat.z), radius: 2.4 });
      // The u-200 ledge stands inside the hush: its scree spills along
      // the wall, never onto the protected channel floor (MASTER R10).
      const ledgeInHush = station.u > 126 && station.u < 214;
      ravineAnchors.push({
        pos: [seat.x, seat.z],
        facing: towardChannel(station.u, seatV) + (ledgeInHush ? Math.PI : 0),
        spread: ledgeInHush ? 3.0 : 4.0,
      });
    }
    const merged = mergeGeometries(ledgeParts, false);
    for (const part of ledgeParts) {
      part.dispose();
    }
    if (!merged) {
      throw new Error("pale strata ledges could not be merged");
    }
    merged.computeBoundingSphere();
    const ledgeMesh = new Mesh(merged, coolChalk);
    ledgeMesh.name = "pale-strata-ledges";
    ledgeMesh.castShadow = false;
    ledgeMesh.receiveShadow = false;
    meshes.push(ledgeMesh);
  }

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
  for (const side of [-1, 1]) {
    blushAnchors.push({
      pos: [archWorld.x + side * legOffset.x, archWorld.z + side * legOffset.z],
      facing: Math.atan2(side * legOffset.z, side * legOffset.x),
      spread: 2.2,
    });
  }
  // The cathedral's foot: two apron seats under the crown, feeding the
  // ossuary-floor beat (fill plan §2, ● at u 352).
  for (const facing of [0.9, 3.6]) {
    blushAnchors.push({
      pos: [cathedralAt.x, cathedralAt.z],
      facing,
      spread: 4.2,
    });
  }

  // ─── The gallery loop's threshold path ───────────────────────────────────
  // The Quiet Gallery is registry stillness: NO T1/T2 cover on the pan
  // (the fix there is value and monument surface, not props — fill plan
  // §1). The ONE sanctioned exception is the plan's own zone table: paired
  // threshold plates marking the side loop (spine u 360 → pan → rejoin at
  // 410), a marked path, not clutter. One merged draw, fresh stream.
  {
    const pathRandom = new Random(SEED ^ 0xfa22);
    const pathParts: BufferGeometry[] = [];
    const stations: readonly (readonly [number, number, number])[] = [
      // Approach leg, then the exit leg — every ~14 m, heading given.
      [358, 40, 0.85],
      [368, 52, 0.85],
      [377, 63, 0.85],
      [393, 68, -0.6],
      [401, 57, -0.6],
      [409, 47, -0.6],
    ];
    for (const [index, [su, sv, heading]] of stations.entries()) {
      for (const side of [-1, 1]) {
        const across = 1.7 + pathRandom.range(0, 0.5);
        const pu = su - Math.sin(heading) * side * across;
        const pv = sv + Math.cos(heading) * side * across;
        const radius = pathRandom.range(0.7, 1.05);
        const plate = slabGeometry({
          seed: SEED ^ (0xfc00 + index * 4 + (side + 1)),
          radius,
          height: radius * 0.34,
        });
        const at = worldOf(pu, pv);
        plate.applyMatrix4(new Matrix4().makeRotationY(pathRandom.range(0, Math.PI * 2)));
        plate.translate(at.x, seabedHeight(at.x, at.z) - 0.02, at.z);
        pathParts.push(plate);
      }
    }
    const merged = mergeGeometries(pathParts, false);
    for (const part of pathParts) {
      part.dispose();
    }
    if (!merged) {
      throw new Error("pale gallery threshold plates could not be merged");
    }
    merged.computeBoundingSphere();
    const pathMesh = new Mesh(merged, chalk);
    pathMesh.name = "pale-gallery-thresholds";
    pathMesh.castShadow = false;
    pathMesh.receiveShadow = false;
    meshes.push(pathMesh);
  }

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

  return {
    meshes,
    colliders,
    contacts,
    archCrown,
    monuments,
    treeSpots: treeWorld,
    screeAnchors: {
      ravine: ravineAnchors,
      blush: blushAnchors,
    },
  };
}