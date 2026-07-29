import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  Object3D,
  TetrahedronGeometry,
  Vector2,
  Vector3,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { boulderGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { SHRINE_GLEAM, mergedMesh, smoothstep01 } from "./CalamityShared";
import { worldOf } from "./CalamityTerrain";

/**
 * The Curator — the Sunken Calamity's findable resident, and its heart.
 *
 * An Ashkeeper octopus, ash-lilac and freckled rust, who has spent thirty
 * years gathering the drowned country's small bright things — shells,
 * beads, pot-glass, coins of the oldCauseway — into one shining pile at
 * the Last Grove's edge. Octopuses collect; grief arranges. The shrine is
 * the memorial; the animal is its keeper, and the green behind it is what
 * the keeper kept.
 *
 * The body is a fixed-topology build (a mantle teardrop and eight arm
 * tubes) whose *positions* are rewritten each frame — the weaver's trick
 * without the skeleton: the mantle breathes, the arm tips curl and
 * uncurl over the pile in slow wandering, and one arm is always mid-turn
 * of some small treasure.
 *
 * The paint: pale silvery lilac (the brightest thing in the ruin's
 * quarter — a lantern to find, the pilot's rule), rust freckles, a plum
 * eye band whose red stays above its green. The discovery target sits at
 * the head, which never leaves the shrine.
 */

const SEED = SEEDS.regionCalamity;

export const CURATOR_SPECIES_ID = "ashkeeper-octopus";

const MANTLE_RINGS = 10;
const MANTLE_SIDES = 7;
const ARMS = 8;
const ARM_RINGS = 9;
const ARM_SIDES = 5;

export interface CuratorBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  readonly target: DiscoveryTarget;
  update(time: number, reducedMotion: boolean): void;
}

/** The shrine's site, at the Last Grove's sheltered edge. */
export const SHRINE = { u: 771, v: -82 } as const;

export function buildCurator(): CuratorBuild {
  const random = new Random(SEED ^ 0xc1a7);
  const { x, z } = worldOf(SHRINE.u, SHRINE.v);
  const groundY = seabedHeight(x, z);

  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  // ─── The shrine ──────────────────────────────────────────────────────────
  // A low stone the pile is heaped against, and forty small bright things.
  const moundStone = boulderGeometry({ seed: SEED ^ 0xc1a8, radius: 1.35, height: 0.55 });
  moundStone.translate(x, groundY - 0.1, z);
  const stoneParts: BufferGeometry[] = [moundStone];
  const moundMesh = mergedMesh(stoneParts, createToonMaterial({ color: 0x8a8578 }), "calamity-shrine-stone");
  meshes.push(moundMesh);
  colliders.push({ center: new Vector3(x, groundY + 0.25, z), radius: 1.3 });
  contacts.push({ x, z, radius: 2.2, strength: 0.45 });

  const gleams = buildGleams(random, x, groundY, z);
  meshes.push(gleams);

  // ─── The animal ──────────────────────────────────────────────────────────
  // She sits on the pile's crest, arms draped over her collection, mantle
  // tipped toward the grove she keeps.
  const head = new Vector3(x, groundY + 0.62, z);
  const body = buildBody();
  const material = createToonMaterial({ vertexColors: true });
  const mesh = new Mesh(body.geometry, material);
  mesh.name = "calamity-curator";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  meshes.push(mesh);

  const target: DiscoveryTarget = {
    speciesId: CURATOR_SPECIES_ID,
    position: head.clone(),
  };

  const position = body.geometry.attributes.position as BufferAttribute;
  const frame = { side: new Vector3(), lift: new Vector3(), tangent: new Vector3() };

  // Each arm drapes from the head over the pile: direction, reach, and
  // the phase its slow curl wanders on.
  const arms: { angle: number; reach: number; phase: number; liftBias: number }[] = [];
  for (let i = 0; i < ARMS; i++) {
    arms.push({
      angle: (i / ARMS) * Math.PI * 2 + random.signed(0.3),
      reach: random.range(0.85, 1.5),
      phase: random.range(0, Math.PI * 2),
      liftBias: random.range(0.4, 1),
    });
  }

  const at = new Vector3();
  const prev = new Vector3();
  const up = new Vector3(0, 1, 0);

  /** Where arm `i` is at fraction `along` and time `time`, world space. */
  const armPoint = (
    arm: (typeof arms)[number],
    along: number,
    time: number,
    out: Vector3,
  ): Vector3 => {
    const dirX = Math.cos(arm.angle);
    const dirZ = Math.sin(arm.angle);
    // Down the pile's slope for the first third, then out along the sand.
    const slope = smoothstep01(along / 0.35);
    const wander = Math.sin(time * 0.11 + arm.phase + along * 2.4) * 0.12 * along;
    // The tip curls: the last third lifts and hooks inward, breathing.
    const curl = smoothstep01((along - 0.6) / 0.4);
    const lift =
      curl * (0.16 + 0.1 * Math.sin(time * 0.17 + arm.phase * 1.7)) * arm.liftBias;
    out.set(
      head.x + dirX * arm.reach * along - dirZ * wander,
      head.y - slope * 0.42 + lift,
      head.z + dirZ * arm.reach * along + dirX * wander,
    );
    return out;
  };

  const pose = (time: number): void => {
    // The mantle: a teardrop behind and above the head, breathing.
    const breathe = 1 + 0.07 * Math.sin(time * 1.15);
    const bob = Math.sin(time * 0.6) * 0.02;
    for (let ring = 0; ring < MANTLE_RINGS; ring++) {
      const t = ring / (MANTLE_RINGS - 1);
      // The teardrop rises from the head and tapers up-back.
      const cx = head.x - 0.12 * t;
      const cy = head.y + 0.02 + t * 0.34 + bob;
      const cz = head.z - 0.05 * t;
      const r =
        (0.16 * Math.sin(Math.PI * Math.pow(Math.min(1, t * 1.12 + 0.06), 0.75)) + 0.015) *
        breathe;
      for (let i = 0; i < MANTLE_SIDES; i++) {
        const a = (i / MANTLE_SIDES) * Math.PI * 2;
        const idx = ring * MANTLE_SIDES + i;
        position.setXYZ(
          idx,
          cx + Math.cos(a) * r,
          cy + Math.sin(a) * r * 1.15,
          cz + Math.sin(a + 0.6) * r * 0.4,
        );
      }
    }
    // The arms.
    for (let arm = 0; arm < ARMS; arm++) {
      const spec = arms[arm]!;
      const ringBase = MANTLE_RINGS * MANTLE_SIDES + arm * ARM_RINGS * ARM_SIDES;
      for (let ring = 0; ring < ARM_RINGS; ring++) {
        const along = ring / (ARM_RINGS - 1);
        armPoint(spec, along, time, at);
        armPoint(spec, Math.min(1, along + 0.08), time, prev);
        frame.tangent.subVectors(prev, at).normalize();
        frame.side.crossVectors(frame.tangent, up).normalize();
        if (frame.side.lengthSq() < 0.01) {
          frame.side.set(1, 0, 0);
        }
        frame.lift.crossVectors(frame.side, frame.tangent).normalize();
        const radius = 0.05 * (1 - along * 0.78) + 0.006;
        for (let i = 0; i < ARM_SIDES; i++) {
          const a = (i / ARM_SIDES) * Math.PI * 2;
          const idx = ringBase + ring * ARM_SIDES + i;
          position.setXYZ(
            idx,
            at.x + (frame.side.x * Math.cos(a) + frame.lift.x * Math.sin(a)) * radius,
            at.y + (frame.side.y * Math.cos(a) + frame.lift.y * Math.sin(a)) * radius,
            at.z + (frame.side.z * Math.cos(a) + frame.lift.z * Math.sin(a)) * radius,
          );
        }
      }
    }
    position.needsUpdate = true;
    body.geometry.computeVertexNormals();
  };

  pose(0);
  body.geometry.computeBoundingSphere();
  // She never leaves the shrine: one honest sphere, forever.
  body.geometry.boundingSphere!.center.copy(head);
  body.geometry.boundingSphere!.radius = 2.6;

  let slowTime = 0;
  let last = 0;
  return {
    meshes,
    colliders,
    contacts,
    target,
    update(time: number, reducedMotion: boolean): void {
      const dt = Math.max(0, time - last);
      last = time;
      slowTime += dt * (reducedMotion ? 0.5 : 1);
      pose(slowTime);
    },
  };
}

// ─── The gleams ──────────────────────────────────────────────────────────────

/**
 * The collection itself: forty small bright things — shells, pebbles,
 * shards — heaped against the mound's sheltered side. The warmest paint
 * in the region, because a memorial should catch the light.
 */
function buildGleams(random: Random, x: number, y: number, z: number): Mesh {
  const parts: BufferGeometry[] = [];
  const tint = new Color();
  const dummy = new Object3D();

  // Little lathed shells.
  const shellProfile: Vector2[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    shellProfile.push(new Vector2(Math.sin(t * Math.PI) * 0.09 * (1 - t * 0.4), t * 0.16));
  }
  const palette = [0xd8bd8e, 0xc9a6a0, 0xd8d2c0, 0xbfa86e, 0xa8b8b0];

  for (let i = 0; i < 40; i++) {
    const kind = i % 5;
    let part: BufferGeometry;
    if (kind < 2) {
      // The lathe is indexed and the polyhedra are not; `mergeGeometries`
      // rejects mixed indexing (the fish-tail trap), so shells convert.
      part = new LatheGeometry(shellProfile, 6).toNonIndexed();
    } else if (kind < 4) {
      part = new IcosahedronGeometry(0.06, 0);
    } else {
      part = new TetrahedronGeometry(0.07);
    }
    const angle = random.range(0, Math.PI * 2);
    const r = random.range(0.15, 0.95);
    dummy.position.set(
      x + Math.cos(angle) * r * 1.15,
      y + 0.32 + Math.max(0, 0.3 - r * 0.28) + random.range(0, 0.12),
      z + Math.sin(angle) * r,
    );
    dummy.rotation.set(random.range(0, Math.PI * 2), random.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(random.range(0.8, 1.6));
    dummy.updateMatrix();
    part.applyMatrix4(dummy.matrix);
    // The gleam paint: warm at the crown of each little thing, shaded at
    // its foot — a pile of tiny lit lamps.
    const position = part.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    tint.setHex(palette[i % palette.length]!).multiplyScalar(random.range(0.9, 1.2));
    tint.lerp(SHRINE_GLEAM, 0.3);
    const shade = tint.clone().multiplyScalar(0.62);
    const box = part.boundingBox ?? (part.computeBoundingBox(), part.boundingBox)!;
    const span = Math.max(0.05, box.max.y - box.min.y);
    const hold = new Color();
    for (let v = 0; v < position.count; v++) {
      const t = (position.getY(v) - box.min.y) / span;
      hold.copy(shade).lerp(tint, 0.3 + t * 0.7);
      colors[v * 3] = hold.r;
      colors[v * 3 + 1] = hold.g;
      colors[v * 3 + 2] = hold.b;
    }
    part.setAttribute("color", new BufferAttribute(colors, 3));
    parts.push(part);
  }
  return mergedMesh(parts, createToonMaterial({ vertexColors: true }), "calamity-shrine-gleams");
}

// ─── The body ────────────────────────────────────────────────────────────────

function buildBody(): { geometry: BufferGeometry } {
  const geometry = new BufferGeometry();
  const vertexCount = MANTLE_RINGS * MANTLE_SIDES + ARMS * ARM_RINGS * ARM_SIDES;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  const lilac = new Color(0xb8aec0);
  const belly = new Color(0xd0c8d0);
  const rust = new Color(0xa06a58);
  const eyeBand = new Color(0x55404c);
  const shade = new Color();

  // The mantle's paint: silvery lilac, rust freckles banded by ring, a
  // plum mask across the head rings where the eyes sit.
  for (let ring = 0; ring < MANTLE_RINGS; ring++) {
    const t = ring / (MANTLE_RINGS - 1);
    const freckle = Math.max(0, Math.sin(t * Math.PI * 5)) ** 4 * 0.5;
    for (let i = 0; i < MANTLE_SIDES; i++) {
      const a = (i / MANTLE_SIDES) * Math.PI * 2;
      const bellyMix = smoothstep01((Math.sin(a) * -1 + 0.5) / 1.1);
      shade.copy(lilac).lerp(belly, bellyMix);
      shade.lerp(rust, freckle * (1 - bellyMix * 0.5));
      // The mask: the two rings nearest the head, on the front sides.
      if (ring <= 1 && Math.cos(a) > 0.2) {
        shade.lerp(eyeBand, 0.75 * Math.cos(a));
      }
      const idx = ring * MANTLE_SIDES + i;
      colors[idx * 3] = shade.r;
      colors[idx * 3 + 1] = shade.g;
      colors[idx * 3 + 2] = shade.b;
    }
  }
  // The arms: lilac fading to a paler sucker-side toward the tips.
  for (let arm = 0; arm < ARMS; arm++) {
    const ringBase = MANTLE_RINGS * MANTLE_SIDES + arm * ARM_RINGS * ARM_SIDES;
    for (let ring = 0; ring < ARM_RINGS; ring++) {
      const along = ring / (ARM_RINGS - 1);
      for (let i = 0; i < ARM_SIDES; i++) {
        const a = (i / ARM_SIDES) * Math.PI * 2;
        const sucker = smoothstep01((Math.sin(a) * -1 + 0.35) / 1.0);
        shade.copy(lilac).lerp(belly, sucker * (0.4 + along * 0.5));
        shade.lerp(rust, Math.max(0, Math.sin(along * Math.PI * 3 + arm)) ** 6 * 0.35);
        const idx = ringBase + ring * ARM_SIDES + i;
        colors[idx * 3] = shade.r;
        colors[idx * 3 + 1] = shade.g;
        colors[idx * 3 + 2] = shade.b;
      }
    }
  }

  // Mantle tube.
  for (let ring = 0; ring < MANTLE_RINGS - 1; ring++) {
    const a = ring * MANTLE_SIDES;
    const b = a + MANTLE_SIDES;
    for (let i = 0; i < MANTLE_SIDES; i++) {
      const next = (i + 1) % MANTLE_SIDES;
      indices.push(a + i, a + next, b + i);
      indices.push(a + next, b + next, b + i);
    }
  }
  // Arm tubes.
  for (let arm = 0; arm < ARMS; arm++) {
    const ringBase = MANTLE_RINGS * MANTLE_SIDES + arm * ARM_RINGS * ARM_SIDES;
    for (let ring = 0; ring < ARM_RINGS - 1; ring++) {
      const a = ringBase + ring * ARM_SIDES;
      const b = a + ARM_SIDES;
      for (let i = 0; i < ARM_SIDES; i++) {
        const next = (i + 1) % ARM_SIDES;
        indices.push(a + i, a + next, b + i);
        indices.push(a + next, b + next, b + i);
      }
    }
  }

  const positionAttribute = new BufferAttribute(positions, 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return { geometry };
}
