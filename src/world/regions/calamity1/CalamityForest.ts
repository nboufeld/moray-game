import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  Object3D,
  PlaneGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type DataTexture,
  type MeshToonMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { createSunViewUniform, injectLeafGlow, trackSunView } from "../../SeaGrass";
import { FILL_SEEDS } from "./CalamityFillShared";
import {
  BONE_TONES,
  GROVE_TONES,
  SHADOW_VIOLET,
  TIP_ASH,
  bakeSwayAttributes,
  injectCalamitySway,
  mergedMesh,
  smoothstep01,
  type SwayUniforms,
} from "./CalamityShared";
import { GHOST_FOREST, LAST_GROVE, WOUND, worldOf } from "./CalamityTerrain";

/**
 * The Ghost Forest, and the Last Grove.
 *
 * The kelp sea that stood here died where it stood. Its giants still
 * stand — bleached to bone, stripped to stubs, and every one of them
 * raked *away* from the Wound like the hands of a clock, because that is
 * what a blast does. The stillness is authored: no sway shader touches
 * the dead, and in a game where everything green moves, the unmoving
 * columns are the loudest thing in the region.
 *
 * The Last Grove is the counter-argument: eight living plants in the
 * hollow the ridge defended, greener than anything in the province,
 * swaying in what little current is left, backlit by the grove's own
 * shaft of surviving light.
 *
 * ## The paint (the texture mandate, applied to death)
 *
 * - Dead stipes carry three stops like living trunks, but bleached:
 *   violet root-band (red above green), bone middle, a faint drowned-opal
 *   tip — nothing near black, nothing near white.
 * - The dead keep a few tattered straps, drooped hard and ragged at the
 *   margins; snapped giants end in a flared broken rim, paler inside.
 * - The grove's straps are the pilot's idiom *improved*: the ruffle bands
 *   stay, the greens go a step cleaner, and the tips take real gold.
 *
 * Streams: placement `SEED ^ 0x1e0f`, leaves `^ 0x51ab`, crowns `^ 0xca9e`
 * — the pilot's three-stream split, kept so a canopy tune can never move
 * a holdfast.
 */

const SEED = SEEDS.regionCalamity;

const GIANT_MIN = 13;
const GIANT_MAX = 21;
const STALK_SIDES = 6;
const GIANT_RINGS = 12;

const HOLDFAST_BONE = new Color(0x6e6558);
const STIPE_BONE = new Color(0x9a9382);
const STIPE_CROWN_BONE = new Color(0x8b8778);

const GROVE_TIP = new Color(0xc4b45e);

export interface GhostFoot {
  readonly x: number;
  readonly z: number;
  readonly u: number;
  readonly v: number;
  readonly height: number;
}

export interface CalamityForestBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** Dead giant feet, for the life systems' weave. */
  readonly ghosts: GhostFoot[];
  update(dt: number, reducedMotion: boolean): void;
}

interface Chunk {
  readonly stalks: BufferGeometry[];
  readonly leaves: BufferGeometry[];
}

export function buildCalamityForest(): CalamityForestBuild {
  const random = new Random(SEED ^ 0x1e0f);
  const leafRandom = new Random(SEED ^ 0x51ab);

  const sway: SwayUniforms = { sway: { value: 0 }, wind: { value: 1 } };
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const ghosts: GhostFoot[] = [];

  const chunks: Record<string, Chunk> = {
    forestWest: { stalks: [], leaves: [] },
    forestEast: { stalks: [], leaves: [] },
    outriders: { stalks: [], leaves: [] },
    grove: { stalks: [], leaves: [] },
  };

  /** Direction away from the Wound at a spoke point — the blast's rake. */
  const blastYaw = (u: number, v: number): number => {
    const at = worldOf(u, v);
    const crater = worldOf(WOUND.u, WOUND.v);
    return Math.atan2(at.x - crater.x, at.z - crater.z);
  };

  // ─── The Ghost Forest ────────────────────────────────────────────────────
  // Scattered over the bench with a column spacing, all raked outward,
  // holding clear of the winding aisle a swimmer follows toward the Wound.
  const placed: { u: number; v: number }[] = [];
  const aisleAt = (u: number): number => -10 * smoothstep01((u - 520) / 150) + 7 * Math.sin(u * 0.045);
  let attempts = 0;
  while (placed.length < 70 && attempts < 800) {
    attempts++;
    const angle = random.range(0, Math.PI * 2);
    const spread = Math.sqrt(random.next()) * 1;
    const u = GHOST_FOREST.u + Math.cos(angle) * spread * GHOST_FOREST.ru;
    const v = GHOST_FOREST.v + Math.sin(angle) * spread * GHOST_FOREST.rv * 0.9;
    if (u < 548 || u > 712) {
      continue;
    }
    // The bench thins to nothing at the crater's own rim.
    if (Math.hypot(u - WOUND.u, v - WOUND.v) < 46) {
      continue;
    }
    if (Math.abs(v - aisleAt(u)) < 6) {
      continue;
    }
    if (placed.some((p) => Math.hypot(p.u - u, p.v - v) < 8.5)) {
      continue;
    }
    placed.push({ u, v });
    const chunk = v < 0 ? chunks.forestWest! : chunks.forestEast!;
    growGhost(chunk, u, v, random.range(GIANT_MIN, GIANT_MAX), blastYaw(u, v), "giant");
  }

  // The snapped: two dozen broken stumps among the standing.
  for (let i = 0; i < 22; i++) {
    const angle = random.range(0, Math.PI * 2);
    const spread = Math.sqrt(random.next());
    const u = GHOST_FOREST.u + Math.cos(angle) * spread * GHOST_FOREST.ru * 0.95;
    const v = GHOST_FOREST.v + Math.sin(angle) * spread * GHOST_FOREST.rv * 0.85;
    if (u < 552 || Math.hypot(u - WOUND.u, v - WOUND.v) < 42) {
      continue;
    }
    const chunk = v < 0 ? chunks.forestWest! : chunks.forestEast!;
    growGhost(chunk, u, v, random.range(1.6, 4.2), blastYaw(u, v), "snapped");
  }

  // The knocked-down: six trunks lying radial in the ash, pointing away.
  for (let i = 0; i < 6; i++) {
    const u = 586 + i * 18 + random.signed(6);
    const v = -34 + i * 13 + random.signed(6);
    if (Math.hypot(u - WOUND.u, v - WOUND.v) < 44) {
      continue;
    }
    const fallen = fallenGhost(u, v, random.range(9, 14), blastYaw(u, v) + random.signed(0.2), random);
    chunks.outriders!.stalks.push(fallen.geometry);
    colliders.push(...fallen.colliders);
    contacts.push(...fallen.contacts);
  }

  // ─── The First Dead One ──────────────────────────────────────────────────
  // A single grey giant standing in the march's still-gold water at
  // u 168 — the annunciation. Everything after it is an explanation.
  growGhost(chunks.outriders!, 168, -3, 13, 0.4, "giant");

  // ─── The mile's outriders ────────────────────────────────────────────────
  // Sparse dead at the Suffocated Mile's far end and the Shatterfield's
  // eaves, so the reveal from the Wound Gate has ranks layered into fog.
  growGhost(chunks.outriders!, 428, 8, 10, 0.3, "giant");
  growGhost(chunks.outriders!, 452, -10, 11.5, 0.35, "giant");
  growGhost(chunks.outriders!, 524, 16, 12, 0.4, "giant");
  growGhost(chunks.outriders!, 538, -18, 14, 0.45, "giant");
  growGhost(chunks.outriders!, 556, 2, 15, 0.5, "giant");

  function growGhost(
    chunk: Chunk,
    u: number,
    v: number,
    height: number,
    rakeYaw: number,
    kind: "giant" | "snapped",
  ): void {
    const { x, z } = worldOf(u, v);
    const foot = seabedHeight(x, z);
    const phase = random.range(0, Math.PI * 2);
    // The blast's rake: the clock-hand read is the region's signature, so
    // it is *committed* — every giant visibly laid over, hardest nearest
    // the Wound. Round 1's polite lean read as ordinary straight trunks.
    const craterD = Math.hypot(u - WOUND.u, v - WOUND.v);
    const rake =
      kind === "snapped"
        ? random.range(0.06, 0.2)
        : random.range(0.34, 0.58) * (1 + Math.max(0, 120 - craterD) / 300);
    const wander = random.signed(0.05);
    const curve = (t: number): number => (rake * t * t + wander * Math.sin(t * Math.PI * 1.4)) * height;

    const radius = random.range(0.85, 1.15) * (kind === "snapped" ? 0.32 : 0.3);
    const stalk = deadStalk(height, curve, radius, kind);
    stalk.applyMatrix4(new Matrix4().makeRotationY(rakeYaw + random.signed(0.3)));
    stalk.translate(x, foot, z);
    chunk.stalks.push(stalk);

    contacts.push({ x, z, radius: kind === "giant" ? 1.1 : 0.8, strength: 0.42 });
    if (kind === "giant") {
      ghosts.push({ x, z, u, v, height });
      colliders.push(
        { center: new Vector3(x, foot + 1.6, z), radius: 0.85 },
        { center: new Vector3(x, foot + 5.0, z), radius: 0.8 },
      );
    } else {
      colliders.push({ center: new Vector3(x, foot + height * 0.5, z), radius: 0.6 });
    }

    // The dead tree's skeleton: strap remains down the whole upper half,
    // plus a ring of longer crown-skeleton straps at the top — round 2's
    // sparse stubs read as poles; a dead kelp keeps its canopy's bones.
    // No sway — the dead stand still.
    const strapCount = kind === "giant" ? Math.round(leafRandom.range(5, 9)) : 0;
    for (let i = 0; i < strapCount; i++) {
      const t = leafRandom.range(0.5, 0.98);
      const around = phase + i * 2.6 + leafRandom.signed(0.4);
      const length = leafRandom.range(0.9, 1.9);
      const width = length * leafRandom.range(0.3, 0.44);
      const droop = leafRandom.range(1.2, 1.8);
      const strap = deadStrap(length, width, droop, leafRandom);
      const local = new Matrix4()
        .makeTranslation(curve(t), foot + t * height, 0)
        .multiply(new Matrix4().makeRotationY(around));
      strap.applyMatrix4(local);
      strap.translate(x, 0, z);
      chunk.leaves.push(strap);
    }
    if (kind === "giant") {
      const crownCount = Math.round(leafRandom.range(4, 6));
      for (let i = 0; i < crownCount; i++) {
        const t = leafRandom.range(0.9, 1.0);
        const around = phase + (i / crownCount) * Math.PI * 2 + leafRandom.signed(0.4);
        const length = leafRandom.range(1.8, 2.8);
        const width = length * leafRandom.range(0.26, 0.4);
        const droop = leafRandom.range(1.4, 1.9);
        const strap = deadStrap(length, width, droop, leafRandom);
        const local = new Matrix4()
          .makeTranslation(curve(t), foot + t * height, 0)
          .multiply(new Matrix4().makeRotationY(around));
        strap.applyMatrix4(local);
        strap.translate(x, 0, z);
        chunk.leaves.push(strap);
      }
    }
  }

  // ─── The Last Grove ──────────────────────────────────────────────────────
  // Two clumps of living plants and their young, in the hollow the ridge
  // defended — a grove is not a scatter: two held clusters with the
  // clearing of the shrine's approach between them.
  const groveAt = (du: number, dv: number, height: number): void => {
    const u = LAST_GROVE.u + du;
    const v = LAST_GROVE.v + dv;
    growLiving(chunks.grove!, u, v, height);
  };
  // The survivor: one tall hero at the grove's heart — the plant the
  // ridge saved, grown into the old forest's memory of itself.
  groveAt(-1, -2, 17);
  // The west clump.
  groveAt(-8, -5, 13.5);
  groveAt(-12, 1, 12);
  groveAt(-6, 4, 11);
  groveAt(-13, -7, 10);
  // The east clump, around the shrine's far shoulder.
  groveAt(9, -9, 14);
  groveAt(13, -3, 12.5);
  groveAt(8, 6, 11);
  groveAt(15, 3, 10.5);
  // The young ring around them.
  for (let i = 0; i < 7; i++) {
    const angle = random.range(0, Math.PI * 2);
    const r = random.range(16, 24);
    groveAt(Math.cos(angle) * r, Math.sin(angle) * r, random.range(4, 6.2));
  }

  function growLiving(chunk: Chunk, u: number, v: number, height: number): void {
    const { x, z } = worldOf(u, v);
    const foot = seabedHeight(x, z);
    const phase = random.range(0, Math.PI * 2);
    const yaw = random.range(0, Math.PI * 2);
    const lean = random.range(0.1, 0.3);
    const wave = random.signed(0.14);
    const curve = (t: number): number => (lean * t * t + wave * Math.sin(t * Math.PI * 1.35)) * height;

    const stalk = livingStalk(height, curve, random.range(0.09, 0.13));
    stalk.applyMatrix4(new Matrix4().makeRotationY(yaw));
    stalk.translate(x, foot, z);
    bakeSwayAttributes(stalk, phase, height * 0.09, (y) => (y - foot) / height);
    chunk.stalks.push(stalk);
    contacts.push({ x, z, radius: 0.9, strength: 0.42 });
    colliders.push(
      { center: new Vector3(x, foot + 1.5, z), radius: 0.7 },
      { center: new Vector3(x, foot + 4.4, z), radius: 0.65 },
    );

    // Full living crowns, greener than the pilot's — the region's one
    // pocket of the old world's colour, so it is *poured on*.
    const count = Math.round(leafRandom.range(16, 21));
    for (let i = 0; i < count; i++) {
      const t = 0.24 + Math.pow((i + leafRandom.range(0.1, 0.9)) / count, 0.62) * 0.72;
      const around = yaw + i * 2.4 + leafRandom.signed(0.5);
      const length = leafRandom.range(1.6, 2.9) * (0.62 + t * 0.5);
      const width = length * leafRandom.range(0.32, 0.46);
      const droop = leafRandom.range(0.25, 0.75) * (1.15 - t * 0.5) * (t > 0.75 ? 1.7 : 1);
      const strap = livingStrap(length, width, droop, leafRandom.range(0.2, 0.7), leafRandom, t > 0.72);
      const local = new Matrix4()
        .makeTranslation(curve(t), foot + t * height, 0)
        .multiply(new Matrix4().makeRotationY(around - yaw));
      strap.applyMatrix4(local);
      strap.applyMatrix4(new Matrix4().makeRotationY(yaw));
      strap.translate(x, 0, z);
      bakeSwayAttributes(strap, phase, height * 0.09, () => t);
      chunk.leaves.push(strap);
    }
  }

  // ═══ THE PHASE 3 FILL — appended after every pilot draw (the reroll
  // fence: the streams' existing consumption is untouched, so no giant,
  // stump or grove plant moves). ═══

  // Six dead sapling snags up the march's banks: the reveal cadence's
  // small dead, standing where the story's kelp meadows drowned.
  for (const spot of [
    { u: 146, v: 8, h: 4.6 },
    { u: 152, v: 10.5, h: 3.4 },
    { u: 206, v: -9, h: 5.2 },
    { u: 292, v: 8.5, h: 4.2 },
    { u: 306, v: -10, h: 3.8 },
    { u: 452, v: 9, h: 5.6 },
  ]) {
    growGhost(chunks.outriders!, spot.u, spot.v, spot.h, blastYaw(spot.u, spot.v), "snapped");
  }

  // The grove grown 8 → 14 (plus the survivor), with the shrine's
  // approach kept clear: three more on each clump's outer shoulder.
  groveAt(-16, -3, 9.5);
  groveAt(-10, 8, 8.5);
  groveAt(-4, -11, 10.5);
  groveAt(12, 8, 9);
  groveAt(18, -6, 9.5);
  groveAt(6, -13, 8);
  // And the juveniles grown 7 → 20: the regrowth the ridge still shelters.
  for (let i = 0; i < 13; i++) {
    const angle = random.range(0, Math.PI * 2);
    const r = random.range(13, 26);
    groveAt(Math.cos(angle) * r, Math.sin(angle) * r, random.range(3.2, 6));
  }

  // ─── The meshes ──────────────────────────────────────────────────────────
  const meshes: Mesh[] = [];
  const sunView = createSunViewUniform();
  const deadStalkMat = deadStalkMaterial();
  const deadLeafMat = deadLeafMaterial();
  const groveStalkMat = groveStalkMaterial(sway);
  const groveLeafMat = groveLeafMaterial(sway, sunView);

  for (const [name, chunk] of Object.entries(chunks)) {
    if (chunk.stalks.length === 0) {
      continue;
    }
    if (name === "grove") {
      meshes.push(mergedMesh(chunk.stalks, groveStalkMat, "calamity-grove-stalks"));
      const leaves = mergedMesh(chunk.leaves, groveLeafMat, "calamity-grove-leaves");
      trackSunView(leaves, sunView);
      meshes.push(leaves);
    } else {
      meshes.push(mergedMesh(chunk.stalks, deadStalkMat, `calamity-ghost-stalks-${name}`));
      if (chunk.leaves.length > 0) {
        meshes.push(mergedMesh(chunk.leaves, deadLeafMat, `calamity-ghost-straps-${name}`));
      }
    }
  }

  // Root-boss mounds (fill): the dead giants' swollen holdfast bosses,
  // one low dome at a share of the feet — the trunks grow FROM somewhere.
  {
    const fill = new Random(SEED ^ FILL_SEEDS.rootBosses);
    const boss = new IcosahedronGeometry(0.7, 1);
    boss.scale(1.2, 0.42, 1.2);
    const position = boss.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) < 0) {
        position.setY(i, position.getY(i) * 0.2);
      }
    }
    position.needsUpdate = true;
    boss.computeVertexNormals();
    const colors = new Float32Array(position.count * 3);
    const normal = boss.attributes.normal!;
    for (let i = 0; i < position.count; i++) {
      const up = Math.max(0, normal.getY(i));
      colors[i * 3] = 0.62 + up * 0.34;
      colors[i * 3 + 1] = 0.58 + up * 0.36;
      colors[i * 3 + 2] = 0.62 + up * 0.3;
    }
    boss.setAttribute("color", new BufferAttribute(colors, 3));
    const bossMaterial = createToonMaterial({
      color: 0x8a8478,
      vertexColors: true,
      emissive: 0x2e2c26,
      emissiveIntensity: 0.5,
    });
    const count = Math.min(26, ghosts.length);
    const bossMesh = new InstancedMesh(boss, bossMaterial, count);
    bossMesh.name = "calamity-root-bosses";
    bossMesh.castShadow = false;
    bossMesh.receiveShadow = false;
    const dummy = new Object3D();
    for (let i = 0; i < count; i++) {
      const foot = ghosts[Math.floor(fill.next() * ghosts.length)]!;
      dummy.position.set(foot.x, seabedHeight(foot.x, foot.z) + 0.04, foot.z);
      dummy.rotation.set(0, fill.range(0, Math.PI * 2), 0);
      const s = fill.range(0.8, 1.7);
      dummy.scale.set(s, s * fill.range(0.7, 1.1), s);
      dummy.updateMatrix();
      bossMesh.setMatrixAt(i, dummy.matrix);
    }
    bossMesh.instanceMatrix.needsUpdate = true;
    bossMesh.computeBoundingSphere();
    meshes.push(bossMesh);
  }

  return {
    meshes,
    colliders,
    contacts,
    ghosts,
    update(dt: number, reducedMotion: boolean): void {
      sway.sway.value += dt * (reducedMotion ? 0.3 : 1);
      sway.wind.value = reducedMotion ? 0.4 : 1;
    },
  };
}

// ─── The dead stipe ──────────────────────────────────────────────────────────

function deadStalk(
  height: number,
  curve: (t: number) => number,
  radius: number,
  kind: "giant" | "snapped",
): BufferGeometry {
  const points: Vector2[] = [new Vector2(0, -0.12)];
  const top = kind === "snapped" ? 1 : 1;
  for (let i = 0; i <= GIANT_RINGS; i++) {
    const t = (i / GIANT_RINGS) * top;
    const taper = (1.3 - t * 0.9) * (1 + Math.exp(-t * 9) * 0.5);
    // A snapped giant ends in a flared broken rim; a whole one tapers out.
    const broken = kind === "snapped" && i >= GIANT_RINGS - 1 ? 1.5 : 1;
    points.push(new Vector2(radius * taper * broken, t * height));
  }
  if (kind !== "snapped") {
    points.push(new Vector2(0, height));
  }

  const geometry = new LatheGeometry(points, STALK_SIDES);
  const position = geometry.attributes.position!;
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const t = Math.min(1, Math.max(0, y / height));
    position.setX(i, position.getX(i) + curve(t));
    // Three bleached stops: violet-rooted holdfast, bone body, a faint
    // drowned-opal crown — the darkest thing on the dead is a colour.
    if (t < 0.3) {
      shade.copy(HOLDFAST_BONE).lerp(STIPE_BONE, smoothstep01(t / 0.3));
    } else {
      shade.copy(STIPE_BONE).lerp(STIPE_CROWN_BONE, smoothstep01((t - 0.3) / 0.7));
    }
    shade.lerp(TIP_ASH, Math.pow(t, 3) * 0.35);
    shade.multiplyScalar(0.86 + t * 0.26);
    if (kind === "snapped" && t > 0.92) {
      // The break's raw face, paler — the one place the dead read fresh.
      shade.lerp(new Color(0xb5ac96), 0.5);
    }
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

// ─── The fallen trunks ───────────────────────────────────────────────────────

function fallenGhost(
  u: number,
  v: number,
  length: number,
  yaw: number,
  random: Random,
): { geometry: BufferGeometry; colliders: SphereCollider[]; contacts: ContactPatch[] } {
  const from = worldOf(u, v);
  const dir = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const to = { x: from.x + dir.x * length, z: from.z + dir.z * length };
  const fromY = seabedHeight(from.x, from.z) + 0.35;
  const toY = seabedHeight(to.x, to.z) + 0.3;
  const midX = (from.x + to.x) / 2 + random.signed(1.5);
  const midZ = (from.z + to.z) / 2 + random.signed(1.5);
  const midY = Math.max((fromY + toY) / 2 + 0.3, seabedHeight(midX, midZ) + 0.4);

  const path = new CatmullRomCurve3([
    new Vector3(from.x, fromY, from.z),
    new Vector3(midX, midY, midZ),
    new Vector3(to.x, toY, to.z),
  ]);
  const geometry = new TubeGeometry(path, 16, 0.42, 6, false);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  const worn = new Color(0x9a9382);
  const under = new Color(0x5c5462);
  for (let i = 0; i < position.count; i++) {
    // Bone above, violet where the trunk meets its own ash shadow.
    const t = Math.min(1, Math.max(0, (position.getY(i) - midY + 1.2) / 2.4));
    shade.copy(under).lerp(worn, t * t);
    const grain = fbm(position.getX(i) * 0.4, position.getZ(i) * 0.4, {
      seed: SEED ^ 0xfa77,
      period: 6,
      octaves: 2,
    });
    shade.multiplyScalar(0.84 + grain * 0.26);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const colliders: SphereCollider[] = [];
  for (let i = 0; i <= 3; i++) {
    const at = path.getPoint(i / 3);
    colliders.push({ center: at, radius: 0.8 });
  }
  return {
    geometry,
    colliders,
    contacts: [
      { x: from.x, z: from.z, radius: 1.4, strength: 0.42 },
      { x: to.x, z: to.z, radius: 1.2, strength: 0.4 },
    ],
  };
}

// ─── The straps ──────────────────────────────────────────────────────────────

function outline(v: number, peak: number): number {
  return Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, v)), peak)) ** 0.62;
}

/** FNV-1a over the drawn floats — per-leaf character with no stream traffic. */
function strapDetailSeed(length: number, width: number, droop: number): number {
  let hash = 0x811c9dc5;
  for (const value of [length, width, droop]) {
    const bits = new Uint32Array(new Float32Array([value]).buffer)[0]!;
    hash = Math.imul(hash ^ bits, 0x01000193);
  }
  return hash >>> 0;
}

/** The dead's tattered strap: ragged margin, hard droop, bone paint. */
function deadStrap(length: number, width: number, droop: number, random: Random): BufferGeometry {
  const rows = 5;
  const geometry = new PlaneGeometry(1, 1, 2, rows);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(i, position.getX(i) * 2, position.getY(i) + 0.5, 0);
  }

  const detail = new Random(strapDetailSeed(length, width, droop));
  const peak = detail.range(0.6, 0.9);
  const margin = detail.range(0.2, 0.34);
  const marginFreq = detail.range(2.8, 4.4);
  const marginPhase = detail.range(0, Math.PI * 2);
  const cupBack = detail.range(0.12, 0.18);

  const tone = BONE_TONES[Math.floor(random.next() * BONE_TONES.length)]!;
  const tint = new Color(tone).multiplyScalar(random.range(0.85, 1.1));
  const rootShade = new Color(SHADOW_VIOLET).lerp(new Color(tone), 0.45);
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const v = position.getY(i);
    const edge = position.getX(i);
    const wave =
      1 -
      margin *
        (0.5 + 0.5 * Math.sin(v * marginFreq * Math.PI * 2 + marginPhase + (edge < 0 ? 2.1 : 0)));
    const half = Math.min(outline(v, peak), outline(v, 0.8)) * wave;
    const across = edge * half * 0.5 * width;
    const bent = arcAlong(v, droop, 0.1);
    const reach = bent.along * length;
    const fall = -bent.drop * length;
    const cup = Math.abs(across) * cupBack;
    position.setXYZ(i, reach - cup, fall, across);

    shade
      .copy(rootShade)
      .lerp(tint, smoothstep01(v / 0.3))
      .lerp(TIP_ASH, v * v * 0.3)
      .multiplyScalar(0.84 + v * 0.26);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/** The living strap: the pilot's idiom, greener, gold-tipped. */
function livingStrap(
  length: number,
  width: number,
  droop: number,
  rise: number,
  random: Random,
  crown: boolean,
): BufferGeometry {
  const rows = 9;
  const geometry = new PlaneGeometry(1, 1, 2, rows);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(i, position.getX(i) * 2, position.getY(i) + 0.5, 0);
  }

  const detail = new Random(strapDetailSeed(length, width, droop));
  const peak = detail.range(0.7, 0.96);
  const margin = detail.range(0.06, 0.16);
  const marginFreq = detail.range(2.2, 3.6);
  const marginPhase = detail.range(0, Math.PI * 2);
  const ruffle = detail.range(0.02, 0.04) * length;
  const ruffleFreq = detail.range(1.6, 2.7);
  const rufflePhase = detail.range(0, Math.PI * 2);
  const cupBack = detail.range(0.12, 0.18);

  const tone = GROVE_TONES[Math.floor(random.next() * GROVE_TONES.length)]!;
  const tint = new Color(tone).multiplyScalar(random.range(1.0, 1.3));
  const rootShade = new Color(tone).multiplyScalar(0.62);
  rootShade.r = Math.min(1, rootShade.r * 1.18);
  rootShade.b = Math.min(1, rootShade.b * 1.3);
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const v = position.getY(i);
    const edge = position.getX(i);
    const wave =
      1 -
      margin *
        (0.5 + 0.5 * Math.sin(v * marginFreq * Math.PI * 2 + marginPhase + (edge < 0 ? 2.1 : 0)));
    const half = Math.min(outline(v, peak), outline(v, 0.82)) * wave;
    const across = edge * half * 0.5 * width;
    const bent = arcAlong(v, droop, rise);
    const reach = bent.along * length;
    const fall =
      -bent.drop * length + Math.sin(v * ruffleFreq * Math.PI * 2 + rufflePhase) * ruffle * v;
    const cup = Math.abs(across) * cupBack;
    position.setXYZ(i, reach - cup, fall, across);

    shade
      .copy(rootShade)
      .lerp(tint, smoothstep01(v / 0.3))
      .lerp(GROVE_TIP, v * v * (crown ? 0.55 : 0.32))
      .multiplyScalar(0.86 + v * 0.28);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/** The grove's stipe: the pilot's lathe, greener stops. */
function livingStalk(height: number, curve: (t: number) => number, radius: number): BufferGeometry {
  const rings = 10;
  const points: Vector2[] = [new Vector2(0, -0.12)];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const taper = (1.35 - t * 0.95) * (1 + Math.exp(-t * 9) * 0.5);
    points.push(new Vector2(radius * taper, t * height));
  }
  points.push(new Vector2(0, height));

  const holdfast = new Color(0x6b5442);
  const stipe = new Color(0x7e9855);
  const crown = new Color(0xa3b264);
  const geometry = new LatheGeometry(points, STALK_SIDES);
  const position = geometry.attributes.position!;
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const t = Math.min(1, Math.max(0, y / height));
    position.setX(i, position.getX(i) + curve(t));
    if (t < 0.3) {
      shade.copy(holdfast).lerp(stipe, smoothstep01(t / 0.3));
    } else {
      shade.copy(stipe).lerp(crown, smoothstep01((t - 0.3) / 0.7));
    }
    shade.multiplyScalar(0.84 + t * 0.32);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/** Integrated droop arc — arc length is exactly the strap's length. */
function arcAlong(v: number, droop: number, rise = 0): { along: number; drop: number } {
  const clamped = Math.min(1, Math.max(0, v));
  const steps = 12;
  const dv = clamped / steps;
  let along = 0;
  let drop = 0;
  for (let s = 0; s < steps; s++) {
    const angle = droop * Math.pow((s + 0.5) * dv, 1.4) - rise;
    along += Math.cos(angle) * dv;
    drop += Math.sin(angle) * dv;
  }
  return { along, drop };
}

// ─── The materials ───────────────────────────────────────────────────────────

function deadStalkMaterial(): MeshToonMaterial {
  // The ghost glow: a faint emissive floor, the canyon ghost-kelp's
  // documented cure — round 1's unlit toon read the pale palette as
  // near-black poles against the ash-milk water. The dead must *shine*,
  // faintly, or they are not ghosts at all.
  return createToonMaterial({
    map: deadStalkTexture(),
    vertexColors: true,
    emissive: 0x383730,
    emissiveIntensity: 0.55,
  });
}

function deadLeafMaterial(): MeshToonMaterial {
  return createToonMaterial({
    side: DoubleSide,
    map: deadStrapTexture(),
    vertexColors: true,
    emissive: 0x32312b,
    emissiveIntensity: 0.55,
  });
}

function groveStalkMaterial(sway: SwayUniforms): MeshToonMaterial {
  const material = createToonMaterial({ map: groveStalkTexture(), vertexColors: true });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    injectCalamitySway(shader, sway);
  };
  material.customProgramCacheKey = () => "calamity-grove-stalk";
  return material;
}

function groveLeafMaterial(
  sway: SwayUniforms,
  sunView: ReturnType<typeof createSunViewUniform>,
): MeshToonMaterial {
  const material = createToonMaterial({
    side: DoubleSide,
    map: groveStrapTexture(),
    vertexColors: true,
    // A whisper of emissive so the grove's green survives its own
    // backlight — the Last Grove is the region's promise, it may not
    // read as black scrub against the ash.
    emissive: 0x24361e,
    emissiveIntensity: 0.65,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    injectCalamitySway(shader, sway);
    // The grove is the region's one backlit green — the sun-through-leaf
    // glow, tuned warm like the pilot's canopy.
    injectLeafGlow(
      shader,
      sunView,
      "vec3(0.10, 0.21, 0.16)",
      "vec3(0.42, 0.33, 0.11)",
      "clamp(vMapUv.y, 0.0, 1.0)",
    );
  };
  material.customProgramCacheKey = () => "calamity-grove-leaf";
  return material;
}

/** The dead stipe map: greyed lengthwise grain, cracked and peeling. */
let deadStalkMap: DataTexture | undefined;
function deadStalkTexture(): DataTexture {
  deadStalkMap ??= buildColorTexture(32, (u, v) => {
    const grain = 0.68 + fbm(u * 2, v * 6, { seed: SEED ^ 0x51ff, period: 8, octaves: 2 }) * 0.26;
    const crackle = 1 - Math.max(0, Math.sin(u * Math.PI * 14 + fbm(u, v * 2, { seed: SEED ^ 0xc7ac, period: 4, octaves: 2 }) * 6)) ** 2 * 0.16;
    return [grain * crackle * 0.92, grain * crackle * 0.9, grain * crackle * 0.82];
  });
  return deadStalkMap;
}

/** The dead strap map: brittle fibre, the ruffle bands gone sharp. */
let deadStrapMap: DataTexture | undefined;
function deadStrapTexture(): DataTexture {
  deadStrapMap ??= buildColorTexture(64, (u, v) => {
    const rib = 1 - Math.exp(-((u - 0.5) ** 2) / 0.004) * 0.2;
    const fibre = 0.9 + fbm(u * 3, v, { seed: SEED ^ 0x1e11, period: 10, octaves: 2 }) * 0.2;
    const bands = 1 - Math.max(0, Math.sin(v * Math.PI * 26 + Math.sin(u * 11) * 2.2)) ** 2 * 0.18;
    const shade = (0.6 + v * 0.5) * fibre * rib * bands;
    return [shade * 0.9, shade * 0.88, shade * 0.78];
  });
  return deadStrapMap;
}

let groveStalkMap: DataTexture | undefined;
function groveStalkTexture(): DataTexture {
  groveStalkMap ??= buildColorTexture(32, (u, v) => {
    const grain = 0.66 + fbm(u * 2, v * 6, { seed: SEED ^ 0x51ff, period: 8, octaves: 2 }) * 0.28;
    return [grain * 0.94, grain, grain * 0.72];
  });
  return groveStalkMap;
}

let groveStrapMap: DataTexture | undefined;
function groveStrapTexture(): DataTexture {
  groveStrapMap ??= buildColorTexture(64, (u, v) => {
    const rib = 1 - Math.exp(-((u - 0.5) ** 2) / 0.004) * 0.24;
    const fibre = 0.9 + fbm(u * 3, v, { seed: SEED ^ 0x1e11, period: 10, octaves: 2 }) * 0.2;
    const bands = 1 - Math.max(0, Math.sin(v * Math.PI * 18 + Math.sin(u * 9) * 1.4)) ** 2 * 0.14;
    const shade = (0.6 + v * 0.5) * fibre * rib * bands;
    return [shade * 0.86, shade, shade * 0.6];
  });
  return groveStrapMap;
}
