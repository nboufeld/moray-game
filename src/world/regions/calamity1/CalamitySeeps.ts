import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Vector2,
  Vector3,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import {
  ARTERY_RED,
  MAT_PALE,
  mergedMesh,
  smoothstep01,
} from "./CalamityShared";
import { WOUND, worldOf } from "./CalamityTerrain";

/**
 * The Cold Candle, and the Seep Gardens.
 *
 * The Wound still breathes: a mineral chimney at the crater's heart
 * drawing a twenty-metre column of silver bubbles up the terraced bowls —
 * the cold fire the catastrophe left burning. Around it, and around the
 * five lesser seeps of the Gardens' shelf, life has come back *wrong*:
 * bone-pale tube worms crowned arterial red, white mats of chemosynthetic
 * felt, rust shoulders where the mineral breath lands. These are the
 * region's saturated notes, spent carefully against the ash.
 *
 * The bubbles are one additive `Points` cloud (the pilot's twinkle trick:
 * under additive blending brightness and opacity are the same quantity,
 * so the swell rides in a per-point colour attribute). The worms are one
 * instanced draw. Everything mineral stands on a contact patch; the
 * chimneys return colliders.
 */

const SEED = SEEDS.regionCalamity;

export interface CalamitySeepsBuild {
  readonly meshes: (Mesh | Points | InstancedMesh)[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** Where the plume stands, for the gyre to ride and poses to aim at. */
  readonly plume: { x: number; z: number; top: number; base: number };
  update(dt: number, time: number, reducedMotion: boolean): void;
}

/** The lesser seeps of the Gardens' shelf, in spoke coordinates. */
const SEEP_SPOTS: readonly { u: number; v: number; scale: number }[] = [
  { u: 742, v: 50, scale: 1.2 },
  { u: 756, v: 62, scale: 1.0 },
  { u: 764, v: 52, scale: 0.8 },
  { u: 748, v: 70, scale: 0.9 },
  { u: 770, v: 64, scale: 0.7 },
  // Two trickles on the crater's own terraces, feeding the Wound's glow.
  { u: 688, v: 18, scale: 0.9 },
  { u: 712, v: -16, scale: 0.8 },
];

export function buildCalamitySeeps(): CalamitySeepsBuild {
  const random = new Random(SEED ^ 0x5eed);
  const meshes: (Mesh | Points | InstancedMesh)[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  // ─── The Cold Candle ─────────────────────────────────────────────────────
  const crater = worldOf(WOUND.u, WOUND.v);
  const craterFloor = seabedHeight(crater.x, crater.z);
  const chimney = chimneyGeometry(8.4, 1.7, SEED ^ 0xca01);
  chimney.translate(crater.x, craterFloor, crater.z);
  // The mineral crust catches what light the crater holds — a faint
  // emissive floor, so the Candle reads from the rim sixty metres out.
  const mineral = createToonMaterial({
    vertexColors: true,
    emissive: 0x211f1a,
    emissiveIntensity: 0.5,
  });
  const chimneyParts: BufferGeometry[] = [chimney];
  // Three lesser throats leaning against the main stack.
  for (const [i, spot] of [
    { du: 3.4, dv: 2.2, h: 4.2 },
    { du: -2.8, dv: 3.6, h: 3.1 },
    { du: 2.2, dv: -3.4, h: 2.4 },
  ].entries()) {
    const at = worldOf(WOUND.u + spot.du, WOUND.v + spot.dv);
    const lesser = chimneyGeometry(spot.h, 0.9, SEED ^ (0xca10 + i));
    lesser.translate(at.x, seabedHeight(at.x, at.z), at.z);
    chimneyParts.push(lesser);
    colliders.push({
      center: new Vector3(at.x, seabedHeight(at.x, at.z) + spot.h * 0.5, at.z),
      radius: 1.0,
    });
  }
  const chimneyMesh = mergedMesh(chimneyParts, mineral, "calamity-cold-candle");
  meshes.push(chimneyMesh);
  colliders.push(
    { center: new Vector3(crater.x, craterFloor + 2.6, crater.z), radius: 2.2 },
    { center: new Vector3(crater.x, craterFloor + 6.4, crater.z), radius: 1.6 },
  );
  contacts.push({ x: crater.x, z: crater.z, radius: 4.6, strength: 0.5 });

  const plume = { x: crater.x, z: crater.z, base: craterFloor + 8.2, top: craterFloor + 26 };

  // ─── The lesser seeps ────────────────────────────────────────────────────
  // Low mineral mounds with a rust throat, one merged mesh; each breathes
  // its own trickle into the shared bubble cloud below.
  const moundParts: BufferGeometry[] = [];
  for (const [i, spot] of SEEP_SPOTS.entries()) {
    const { x, z } = worldOf(spot.u, spot.v);
    const y = seabedHeight(x, z);
    const mound = chimneyGeometry(1.6 * spot.scale, 1.5 * spot.scale, SEED ^ (0xcb00 + i));
    mound.translate(x, y - 0.3, z);
    moundParts.push(mound);
    contacts.push({ x, z, radius: 2.4 * spot.scale, strength: 0.44 });
    colliders.push({ center: new Vector3(x, y + 0.6 * spot.scale, z), radius: 1.4 * spot.scale });
  }
  meshes.push(mergedMesh(moundParts, mineral, "calamity-seeps"));

  // ─── The bubble breath ───────────────────────────────────────────────────
  const bubbles = buildBubbles(plume, SEEP_SPOTS);
  meshes.push(bubbles.points);
  const bubbleUpdate = bubbles.update;

  // ─── The tube-worm gardens ───────────────────────────────────────────────
  const worms = buildWorms(random, SEEP_SPOTS);
  meshes.push(worms.mesh);
  contacts.push(...worms.contacts);

  // ─── The white mats ──────────────────────────────────────────────────────
  const mats = buildMats(random, SEEP_SPOTS);
  meshes.push(mats);

  return {
    meshes,
    colliders,
    contacts,
    plume,
    update(_dt: number, time: number, reducedMotion: boolean): void {
      bubbleUpdate(time, reducedMotion ? 0.4 : 1);
    },
  };
}

// ─── The chimney ─────────────────────────────────────────────────────────────

/**
 * A mineral throat: the drawn profile of a sinter stack — foot sunk,
 * shoulders bulging and narrowing as they climb, a flared lip at the
 * vent. Painted bone-pale with rust banding toward the throat and a
 * violet foot, red above green.
 */
function chimneyGeometry(height: number, radius: number, seed: number): BufferGeometry {
  const random = new Random(seed);
  const rings = 11;
  const points: Vector2[] = [new Vector2(0, -0.4)];
  const bulge = random.range(0.8, 1.3);
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const shoulder =
      Math.sin(Math.PI * Math.pow(t, 0.8)) ** 0.7 * (1 + 0.24 * Math.sin(t * 9 + bulge * 6));
    const r = radius * (0.45 + shoulder * 0.75) * (1 - t * 0.3);
    points.push(new Vector2(Math.max(0.08, r), t * height));
  }
  points.push(new Vector2(radius * 0.34, height + 0.15));
  const geometry = new LatheGeometry(points, 8);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const foot = new Color(0x6a6070);
  const bone = new Color(0xc9c2b0);
  const rust = new Color(0xa06a48);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i) / height));
    shade.copy(foot).lerp(bone, smoothstep01(t / 0.4));
    shade.lerp(rust, smoothstep01((t - 0.72) / 0.28) * 0.55);
    const crust = fbm(position.getX(i) * 0.8, position.getZ(i) * 0.8, {
      seed,
      period: 5,
      octaves: 2,
    });
    shade.multiplyScalar(0.8 + crust * 0.34);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// ─── The bubbles ─────────────────────────────────────────────────────────────

let bubbleSprite: DataTexture | undefined;
function bubbleTexture(): DataTexture {
  bubbleSprite ??= buildColorTexture(32, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const halo = Math.pow(Math.max(0, 1 - d * d), 2.4);
    // A brighter rim: a bubble is a shell of water, not a ball of light.
    const rim = Math.exp(-((d - 0.62) ** 2) / 0.05) * 0.5;
    const value = Math.min(1, halo * 0.7 + rim);
    return [value * 0.88, value * 0.95, value];
  });
  return bubbleSprite;
}

function buildBubbles(
  plume: { x: number; z: number; base: number; top: number },
  seeps: readonly { u: number; v: number; scale: number }[],
): { points: Points; update: (time: number, calm: number) => void } {
  const random = new Random(SEED ^ 0xb0b1);
  const vents = [
    { x: plume.x, z: plume.z, base: plume.base, top: plume.top, count: 210, spread: 0.9 },
    ...seeps.map((spot) => {
      const { x, z } = worldOf(spot.u, spot.v);
      return {
        x,
        z,
        base: seabedHeight(x, z) + 1.2 * spot.scale,
        top: seabedHeight(x, z) + 7 * spot.scale,
        count: 16,
        spread: 0.5 * spot.scale,
      };
    }),
  ];
  const total = vents.reduce((sum, vent) => sum + vent.count, 0);
  const base = new Float32Array(total * 4); // x, z, y0, range
  const live = new Float32Array(total * 3);
  const phases = new Float32Array(total);
  const rates = new Float32Array(total);
  const swells = new Float32Array(total);
  let index = 0;
  for (const vent of vents) {
    for (let i = 0; i < vent.count; i++) {
      base[index * 4] = vent.x + random.signed(vent.spread);
      base[index * 4 + 1] = vent.z + random.signed(vent.spread);
      base[index * 4 + 2] = vent.base;
      base[index * 4 + 3] = vent.top - vent.base;
      phases[index] = random.next();
      rates[index] = random.range(0.028, 0.05);
      swells[index] = random.range(0.5, 1);
      index++;
    }
  }

  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(live, 3);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  const colorAttribute = new BufferAttribute(new Float32Array(total * 3), 3);
  colorAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("color", colorAttribute);
  geometry.computeBoundingSphere();
  // The plume is tall; one honest sphere over the whole breath.
  geometry.boundingSphere!.center.set(plume.x, (plume.base + plume.top) / 2, plume.z);
  geometry.boundingSphere!.radius = 40;

  const material = new PointsMaterial({
    size: 0.22,
    map: bubbleTexture(),
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: true,
  });
  const points = new Points(geometry, material);
  points.name = "calamity-bubbles";
  points.frustumCulled = false;

  const update = (time: number, calm: number): void => {
    const t = time * calm;
    for (let i = 0; i < total; i++) {
      const cycle = (phases[i]! + t * rates[i]!) % 1;
      const y0 = base[i * 4 + 2]!;
      const range = base[i * 4 + 3]!;
      const wobble = cycle * cycle * 2.2;
      live[i * 3] = base[i * 4]! + Math.sin(t * 0.9 + i * 1.7) * (0.2 + wobble);
      live[i * 3 + 1] = y0 + cycle * range;
      live[i * 3 + 2] = base[i * 4 + 1]! + Math.cos(t * 0.7 + i * 2.3) * (0.2 + wobble);
      // The twinkle: brighter as it climbs and opens.
      const glow = (0.35 + cycle * 0.65) * swells[i]!;
      colorAttribute.setXYZ(i, glow * 0.9, glow * 0.97, glow);
    }
    attribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
  };
  update(0, 1);
  return { points, update };
}

// ─── The tube worms ──────────────────────────────────────────────────────────

/** One worm: a bone tube and its arterial crown, merged, painted once. */
function wormGeometry(): BufferGeometry {
  const tubePoints: Vector2[] = [new Vector2(0, -0.1)];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    tubePoints.push(new Vector2(0.06 * (1 - t * 0.3) + 0.02 * Math.sin(t * 5), t * 0.9));
  }
  const tube = new LatheGeometry(tubePoints, 5);
  const crown = new ConeGeometry(0.16, 0.22, 7, 1, true);
  crown.translate(0, 1.0, 0);
  const merged = mergeGeometries([tube, crown], false);
  tube.dispose();
  crown.dispose();
  if (!merged) {
    throw new Error("calamity worm parts could not be merged");
  }

  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const tubeBone = new Color(0xd8d2c4);
  const tubeShade = new Color(0x8a8090);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    if (y > 0.92) {
      // The crown: arterial red, pale-gilled at its very lip.
      const lip = smoothstep01((y - 1.05) / 0.06);
      shade.copy(ARTERY_RED).lerp(new Color(0xd98a8e), lip * 0.4);
    } else {
      shade.copy(tubeShade).lerp(tubeBone, smoothstep01(y / 0.6));
    }
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  return merged;
}

function buildWorms(
  random: Random,
  seeps: readonly { u: number; v: number; scale: number }[],
): { mesh: InstancedMesh; contacts: ContactPatch[] } {
  const geometry = wormGeometry();
  // The same ghost-glow floor as the dead forest: round 1's worms read
  // as dark specks, when the gardens' whole argument is pale bone and
  // arterial red shining out of the ash.
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x2c2824,
    emissiveIntensity: 0.6,
  });
  const capacity = 150;
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.name = "calamity-tube-worms";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const contacts: ContactPatch[] = [];
  const dummy = new Object3D();
  const tint = new Color();
  let placed = 0;
  const plant = (u: number, v: number): void => {
    if (placed >= capacity) {
      return;
    }
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) - 0.04, z);
    dummy.rotation.set(random.signed(0.3), random.range(0, Math.PI * 2), random.signed(0.3));
    dummy.scale.setScalar(random.range(0.7, 2.1));
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    tint.setHex(0xffffff).multiplyScalar(random.range(0.8, 1.05));
    mesh.setColorAt(placed, tint);
    placed++;
  };

  // Rings of worms around every seep, densest at the mineral shoulder.
  for (const spot of seeps) {
    const count = Math.round(14 * spot.scale);
    for (let i = 0; i < count; i++) {
      const angle = random.range(0, Math.PI * 2);
      const r = random.range(1.2, 4.2) * spot.scale;
      plant(spot.u + Math.cos(angle) * r, spot.v + Math.sin(angle) * r);
    }
    contacts.push({ x: worldOf(spot.u, spot.v).x, z: worldOf(spot.u, spot.v).z, radius: 3.4 * spot.scale, strength: 0.3 });
  }
  // And a garden on the crater's second terrace, in the Candle's own light.
  for (let i = 0; i < 26; i++) {
    const angle = random.range(0, Math.PI * 2);
    const r = random.range(7, 14);
    plant(WOUND.u + Math.cos(angle) * r, WOUND.v + Math.sin(angle) * r);
  }

  mesh.count = placed;
  dummy.position.set(0, -300, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  for (let i = placed; i < capacity; i++) {
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return { mesh, contacts };
}

// ─── The white mats ──────────────────────────────────────────────────────────

/** Chemosynthetic felt: low pale discs lying on the seep shelf's skin. */
function buildMats(random: Random, seeps: readonly { u: number; v: number; scale: number }[]): InstancedMesh {
  const geometry = new PlaneGeometry(1, 1, 4, 4);
  geometry.rotateX(-Math.PI / 2);
  // A gentle domed centre, so the mat is a skin over the ground, not a card.
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const d = Math.hypot(position.getX(i), position.getZ(i)) * 2;
    position.setY(i, Math.max(0, 0.06 * (1 - d * d)));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();

  const material = createToonMaterial({ color: MAT_PALE });
  const mesh = new InstancedMesh(geometry, material, 26);
  mesh.name = "calamity-mats";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const dummy = new Object3D();
  const tint = new Color();
  for (let i = 0; i < 26; i++) {
    const spot = seeps[i % seeps.length]!;
    const angle = random.range(0, Math.PI * 2);
    const r = random.range(1.6, 6) * spot.scale;
    const { x, z } = worldOf(spot.u + Math.cos(angle) * r, spot.v + Math.sin(angle) * r);
    dummy.position.set(x, seabedHeight(x, z) + 0.03, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.set(random.range(1.2, 3.4), 1, random.range(1.2, 3.4));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tint.copy(MAT_PALE).multiplyScalar(random.range(0.85, 1.05));
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}
