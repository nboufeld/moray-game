import {
  BufferAttribute,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Vector2,
  Vector3,
  type BufferGeometry,
  type MeshToonMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import {
  FAN_ALPHA_TEST,
  coralGeometry,
  coralSkin,
  fanTexture,
  type CoralKind,
} from "../../CoralShapes";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import {
  BLUSH_GOLD,
  BLUSH_PINK,
  mergedMesh,
  recoveryTint,
  smoothstep01,
} from "./PaleShared";
import {
  PALE_SLOT,
  SEED_GROVE,
  galleryWeight,
  groveWeight,
  recovery,
  worldOf,
} from "./PaleTerrain";

/**
 * The Bone Meadows' returning life: the bud freckles of the First Blush,
 * the Blooming Shelf's young gardens, the nursery rows, and the
 * Mother-Coral — the one colossal living thing the whole region flows
 * from.
 *
 * ## The gradient is the build's law
 *
 * Every garden piece draws its tint through `recoveryTint` at its own
 * spot's `recovery` — bone-white at 0, its colour family at 1 — and the
 * placement density runs on the same number. The region's tests read the
 * stands back and assert the saturation rises with `u`: the story is a
 * measurable property of the build, not a hope.
 *
 * ## Stillness, then movement
 *
 * The Ghost Reef's trick at region scale: the staghorns and fans sway
 * with an amplitude computed in the vertex shader from the instance's
 * own spoke distance, so the white half is dead still and the far
 * quarter breathes — one draw call either way, and the sway can never
 * drift out of sync with the tints.
 *
 * Streams: gardens `SEED ^ 0x0ec1`, buds `^ 0x0ec2`, mother `^ 0x0ec3`,
 * nursery `^ 0x0ec4`.
 */

const SEED = SEEDS.regionPale1;

const AXIS_X = Math.cos(PALE_SLOT.azimuth);
const AXIS_Z = Math.sin(PALE_SLOT.azimuth);

export interface PaleStand {
  readonly kind: CoralKind;
  readonly u: number;
  readonly v: number;
  readonly tint: Color;
  readonly scale: number;
  readonly yaw: number;
}

export interface PaleBloomBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** Every garden piece as planted — the tests read the story off this. */
  readonly stands: readonly PaleStand[];
  /** The Mother-Coral's crown, where the petal current is born. */
  readonly motherCrown: { x: number; y: number; z: number };
  update(dt: number, reducedMotion: boolean): void;
}

const KIND_WEIGHTS: readonly (readonly [CoralKind, number])[] = [
  ["branch", 0.3],
  ["tube", 0.18],
  ["plateStack", 0.16],
  ["staghorn", 0.1],
  ["brain", 0.08],
  ["fan", 0.18],
];

/**
 * Region-scaled: round 1 planted the wing's one-metre garden pieces into
 * a hundred-and-fifty-thousand-square-metre basin and they vanished. The
 * shelf's colonies are two to three metres — young gardens at the scale
 * the fog can actually deliver to the eye.
 */
const KIND_SCALE: Record<CoralKind, readonly [number, number]> = {
  staghorn: [2.0, 3.4],
  brain: [1.7, 2.9],
  plateStack: [1.2, 2.0],
  tube: [1.5, 2.6],
  fan: [1.9, 3.1],
  branch: [1.3, 2.5],
  boulder: [1, 1],
  polyp: [1, 1],
};

function drawKind(random: Random): CoralKind {
  const pick = random.next();
  let cumulative = 0;
  for (const [kind, weight] of KIND_WEIGHTS) {
    cumulative += weight;
    if (pick < cumulative) {
      return kind;
    }
  }
  return "branch";
}

export function buildPaleBloom(archCrown: { x: number; y: number; z: number }): PaleBloomBuild {
  const gardenRandom = new Random(SEED ^ 0x0ec1);
  const budRandom = new Random(SEED ^ 0x0ec2);
  const motherRandom = new Random(SEED ^ 0x0ec3);
  const nurseryRandom = new Random(SEED ^ 0x0ec4);

  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const stands: PaleStand[] = [];
  const clock = { time: { value: 0 }, strength: { value: 1 } };

  const plant = (u: number, v: number, kind: CoralKind, random: Random, boost = 0): void => {
    const k = Math.min(1, recovery(u, v) + boost);
    const [scaleMin, scaleMax] = KIND_SCALE[kind];
    stands.push({
      kind,
      u,
      v,
      tint: recoveryTint(random, k),
      scale: random.range(scaleMin, scaleMax) * (0.7 + k * 0.5),
      yaw: random.range(0, Math.PI * 2),
    });
  };

  // ─── The gardens ─────────────────────────────────────────────────────────
  // Sites scattered over the disc's far half; each site's dice are thrown
  // against its own recovery, so the beds thicken exactly the way the
  // story says: scattered pioneers at the blush, crowded gardens on the
  // shelf, a full ring around the grove.
  let attempts = 0;
  let sites = 0;
  while (sites < 30 && attempts < 600) {
    attempts++;
    const u = gardenRandom.range(398, 620);
    const v = gardenRandom.signed(150);
    const k = recovery(u, v);
    if (k < 0.08) {
      continue;
    }
    if (galleryWeight(u, v) > 0.2 || groveWeight(u, v) > 0.75) {
      continue;
    }
    // The dice: pioneers are rare, gardens are dense.
    if (gardenRandom.next() > 0.18 + k * 0.82) {
      continue;
    }
    sites++;
    const pieces = 3 + Math.floor(gardenRandom.next() * (3 + k * 4));
    for (let p = 0; p < pieces; p++) {
      const du = gardenRandom.signed(3.2);
      const dv = gardenRandom.signed(3.2);
      let kind = drawKind(gardenRandom);
      // Every strong-recovery site shows lace: the fan is the read of life
      // coming back (the Ghost Reef's own rule, kept at region scale).
      if (p === pieces - 1 && k > 0.5 && !stands.slice(-p).some((s) => s.kind === "fan")) {
        kind = "fan";
      }
      plant(u + du, v + dv, kind, gardenRandom);
    }
  }

  // Authored garden beds framing the Blooming Shelf pose's view — the
  // shelf must read as *gardens* from its own canonical camera, so three
  // dense beds stand exactly where it looks, and one at the Gardener's
  // Round (the crab plants where it walks).
  for (const [su, sv, pieces] of [
    [518, -48, 12],
    [532, -62, 10],
    [545, -45, 10],
    [509, -30, 7],
    [494, 30, 5],
  ] as const) {
    for (let p = 0; p < pieces; p++) {
      plant(
        su + gardenRandom.signed(6),
        sv + gardenRandom.signed(6),
        drawKind(gardenRandom),
        gardenRandom,
        0.15,
      );
    }
  }

  // ─── The nursery rows ────────────────────────────────────────────────────
  // Planted rows of juveniles radiating from the Seed Grove's rim down
  // its bowl — *rows*, because someone (the Gardener) put them there.
  // Small, full-colour, evenly spaced: the most hopeful geometry in the
  // region is a tended garden.
  for (let row = 0; row < 6; row++) {
    const heading = (row / 6) * Math.PI * 2 + 0.35;
    for (let seat = 0; seat < 8; seat++) {
      const d = 13 + seat * 2.6;
      const u = SEED_GROVE.u + Math.cos(heading) * d + nurseryRandom.signed(0.4);
      const v = SEED_GROVE.v + Math.sin(heading) * d + nurseryRandom.signed(0.4);
      // Branch and fan alternating — the bright silhouettes; round 2's
      // tube juveniles read as dark specks on the bowl.
      const kind: CoralKind = seat % 2 === 0 ? "branch" : "fan";
      const [scaleMin] = KIND_SCALE[kind];
      // Juveniles: a third of a grown colony, but planted in rows dense
      // enough that the rows themselves read from the grove's rim.
      stands.push({
        kind,
        u,
        v,
        tint: recoveryTint(nurseryRandom, 1, 0.8),
        scale: scaleMin * nurseryRandom.range(0.38, 0.52),
        yaw: nurseryRandom.range(0, Math.PI * 2),
      });
    }
  }

  // ─── One instanced mesh per kind ─────────────────────────────────────────
  const byKind = new Map<CoralKind, PaleStand[]>();
  for (const stand of stands) {
    const list = byKind.get(stand.kind);
    if (list) {
      list.push(stand);
    } else {
      byKind.set(stand.kind, [stand]);
    }
  }

  const addSway = (material: MeshToonMaterial, amount: number): void => {
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uSway = clock.time;
      shader.uniforms.uWind = clock.strength;
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
           // Alive where the story says so: the recovery ramp read from the
           // instance's own spoke distance, so stillness and colour agree.
           float paleU = instanceMatrix[3][0] * ${AXIS_X.toFixed(5)} + instanceMatrix[3][2] * ${AXIS_Z.toFixed(5)};
           float alive = smoothstep(390.0, 560.0, paleU);
           float phase = instanceMatrix[3][0] * 0.6 + instanceMatrix[3][2] * 0.43;
           float tip = clamp(transformed.y, 0.0, 1.0);
           float bend = (sin(uSway * 1.1 + phase) * 0.5 + sin(uSway * 0.43 + phase * 1.7) * 0.5)
                      * alive * uWind;
           transformed.x += bend * ${amount.toFixed(3)} * tip * tip;
           transformed.z += bend * ${(amount * 0.55).toFixed(3)} * tip * tip;`,
        );
    };
    material.customProgramCacheKey = () => `pale-bloom-sway-${amount}`;
  };

  const dummy = new Object3D();
  for (const [kind, parts] of byKind) {
    const geometry = coralGeometry(kind);
    let material: MeshToonMaterial;
    // The emissive whisper on every kind: the milk's flat violet light
    // (round 4's sun cut) otherwise drops a saturated colony under the
    // water's value, and a colony below the water's value reads as its
    // complement — the fish community's documented failure, in coral.
    if (kind === "fan") {
      material = createToonMaterial({
        color: 0xffffff,
        map: fanTexture(),
        side: DoubleSide,
        emissive: 0x2a1d1c,
        emissiveIntensity: 0.5,
      });
      material.alphaTest = FAN_ALPHA_TEST;
      addSway(material, 0.055);
    } else {
      const skin = coralSkin(kind);
      material = createToonMaterial({
        color: 0xffffff,
        map: skin.map,
        normalMap: skin.normal,
        vertexColors: geometry.hasAttribute("color"),
        emissive: 0x2a1d1c,
        emissiveIntensity: 0.5,
      });
      if (kind === "staghorn") {
        addSway(material, 0.024);
      }
    }

    const mesh = new InstancedMesh(geometry, material, parts.length);
    mesh.name = `pale-bloom-${kind}`;
    mesh.userData.floorBound = kind === "branch" ? "rest" : "foot";
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    parts.forEach((part, index) => {
      const { x, z } = worldOf(part.u, part.v);
      const foot = seabedHeight(x, z);
      dummy.position.set(x, kind === "branch" ? foot + 0.55 * part.scale : foot - 0.02, z);
      dummy.rotation.set(0, part.yaw, 0);
      dummy.scale.setScalar(part.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, part.tint);
      if (kind === "staghorn" || kind === "brain") {
        contacts.push({ x, z, radius: 0.8 * part.scale, strength: 0.4 });
        colliders.push({
          center: new Vector3(x, foot + 0.5 * part.scale, z),
          radius: 0.55 * part.scale,
        });
      } else if (kind === "plateStack") {
        contacts.push({ x, z, radius: 0.5 * part.scale, strength: 0.3 });
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
    meshes.push(mesh);
  }

  // ─── The buds ────────────────────────────────────────────────────────────
  // Paint-on-paint: pink and gold polyp buds freckling the First Blush —
  // on the ground in drifts, climbing the two blush skeletons, and
  // crowding the Blush Arch's crown. The value stays pale; only the hue
  // arrives.
  const budGeometry = new IcosahedronGeometry(0.09, 1);
  budGeometry.scale(1, 1.35, 1);
  const budMaterial = createToonMaterial({ color: 0xffffff });
  const budSpots: { x: number; y: number; z: number; s: number }[] = [];

  // Ground drifts across the blush band.
  for (let drift = 0; drift < 26; drift++) {
    const u = budRandom.range(408, 512);
    const v = budRandom.signed(120);
    const k = recovery(u, v);
    if (k < 0.06 || k > 0.85 || galleryWeight(u, v) > 0.2) {
      continue;
    }
    const count = 3 + Math.floor(budRandom.next() * 5);
    for (let i = 0; i < count; i++) {
      const { x, z } = worldOf(u + budRandom.signed(2.4), v + budRandom.signed(2.4));
      budSpots.push({ x, y: seabedHeight(x, z) + 0.04, z, s: budRandom.range(0.6, 1.4) });
    }
  }
  // The arch's crown, hugging the beam's own curve — round 1 scattered
  // these in a loose box and they read as floating confetti.
  for (let i = 0; i < 16; i++) {
    const along = budRandom.signed(1.9);
    budSpots.push({
      x: archCrown.x + along * 0.42 + budRandom.signed(0.5),
      y: archCrown.y - along * along * 0.42 - budRandom.range(0.1, 0.6),
      z: archCrown.z - along * 0.9 + budRandom.signed(0.5),
      s: budRandom.range(0.8, 1.5),
    });
  }
  // Climbing the two blush skeletons (authored in PaleBones at (448,−16)
  // and (463, 2)).
  for (const [su, sv, height] of [
    [448, -16, 7.2],
    [463, 2, 6.1],
  ] as const) {
    const { x, z } = worldOf(su, sv);
    const foot = seabedHeight(x, z);
    for (let i = 0; i < 10; i++) {
      const t = budRandom.range(0.25, 0.9);
      budSpots.push({
        x: x + budRandom.signed(1.2) * (1 - t * 0.6),
        y: foot + height * t,
        z: z + budRandom.signed(1.2) * (1 - t * 0.6),
        s: budRandom.range(0.5, 1.1),
      });
    }
  }

  const buds = new InstancedMesh(budGeometry, budMaterial, budSpots.length);
  buds.name = "pale-blush-buds";
  buds.castShadow = false;
  buds.receiveShadow = false;
  const budTint = new Color();
  for (const [i, spot] of budSpots.entries()) {
    dummy.position.set(spot.x, spot.y, spot.z);
    dummy.rotation.set(budRandom.signed(0.4), budRandom.range(0, Math.PI * 2), budRandom.signed(0.4));
    dummy.scale.setScalar(spot.s);
    dummy.updateMatrix();
    buds.setMatrixAt(i, dummy.matrix);
    budTint
      .copy(budRandom.next() < 0.62 ? BLUSH_PINK : BLUSH_GOLD)
      .multiplyScalar(budRandom.range(0.9, 1.1));
    buds.setColorAt(i, budTint);
  }
  buds.instanceMatrix.needsUpdate = true;
  if (buds.instanceColor) {
    buds.instanceColor.needsUpdate = true;
  }
  buds.computeBoundingSphere();
  meshes.push(buds);

  // ─── The Mother-Coral ────────────────────────────────────────────────────
  const mother = buildMother(motherRandom);
  meshes.push(mother.mesh);
  colliders.push(...mother.colliders);
  contacts.push(...mother.contacts);

  return {
    meshes,
    colliders,
    contacts,
    stands,
    motherCrown: mother.crown,
    update(dt: number, reducedMotion: boolean): void {
      clock.time.value += dt * (reducedMotion ? 0.35 : 1);
      clock.strength.value = reducedMotion ? 0.4 : 1;
    },
  };
}

// ─── The Mother-Coral ────────────────────────────────────────────────────────

/**
 * The region's landmark: a rose-and-gold pagoda of living coral, twelve
 * metres of trunk and tiered plates standing in the Seed Grove's bowl,
 * the one thing in the province that was never bleached. Trunk warm
 * ochre-rose over a violet foot; each plate palest at its growing
 * margin; an antler crown reaching gold into the light.
 */
function buildMother(random: Random): {
  mesh: Mesh;
  colliders: SphereCollider[];
  contacts: ContactPatch[];
  crown: { x: number; y: number; z: number };
} {
  const at = worldOf(SEED_GROVE.u, SEED_GROVE.v);
  const foot = seabedHeight(at.x, at.z);
  const height = 12.5;
  const parts: BufferGeometry[] = [];

  const paint = (
    geometry: BufferGeometry,
    sample: (y: number, x: number, z: number) => readonly [number, number, number],
  ): void => {
    const position = geometry.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const [r, g, b] = sample(position.getY(i), position.getX(i), position.getZ(i));
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
  };

  // The trunk: a lathe with a swollen foot and two knuckles.
  const profile: Vector2[] = [new Vector2(0, -0.3)];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const swell =
      1.6 - t * 1.05 + Math.exp(-t * 7) * 0.9 + 0.22 * Math.sin(t * Math.PI * 3.2 + 0.6);
    profile.push(new Vector2(Math.max(0.28, swell * 0.55), t * height * 0.72));
  }
  profile.push(new Vector2(0.2, height * 0.74));
  const trunk = new LatheGeometry(profile, 9);
  const trunkBase = new Color(0x8a5570);
  const trunkTop = new Color(0xdf9a62);
  const trunkShade = new Color();
  paint(trunk, (y, x, z) => {
    const t = Math.min(1, Math.max(0, y / (height * 0.74)));
    trunkShade.copy(trunkBase).lerp(trunkTop, smoothstep01(t));
    const grain = fbm(x * 0.8, z * 0.8 + y * 0.4, { seed: SEED ^ 0x30a7, period: 5, octaves: 2 });
    trunkShade.multiplyScalar(0.82 + grain * 0.3);
    return [trunkShade.r, trunkShade.g, trunkShade.b];
  });
  parts.push(trunk);

  // The tiers: four wavy plates stepping in as they climb, rose deepening
  // at the centres, cream at the margins — the growth gradient the plate
  // corals wear, at monument scale.
  const tiers = [
    { radius: 4.6, at: 0.34, offset: 0.5 },
    { radius: 3.7, at: 0.52, offset: -0.7 },
    { radius: 2.9, at: 0.68, offset: 0.4 },
    { radius: 2.1, at: 0.82, offset: -0.3 },
  ];
  for (const [index, tier] of tiers.entries()) {
    const plate = new CylinderGeometry(tier.radius, tier.radius * 0.82, 0.24, 22);
    const position = plate.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const angle = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
      const radial = Math.min(1, Math.hypot(x, z) / tier.radius);
      // Deep lobing: round 1's near-circular plates read as parasols.
      const lobe =
        1 +
        (fbm(angle, 0.5, { seed: SEED ^ (0x31b0 + index), period: 4, octaves: 2 }) - 0.5) * 1.0;
      const warp =
        (fbm(angle, 0.31, { seed: SEED ^ (0x32c0 + index), period: 6, octaves: 2 }) - 0.5) *
        1.1 *
        radial;
      const crownLift = 0.24 * (1 - radial * radial);
      position.setXYZ(i, x * lobe, position.getY(i) + warp + crownLift, z * lobe);
    }
    position.needsUpdate = true;
    plate.computeVertexNormals();
    // Saturated rose deepening at the mature centre, cream only at the
    // growing margin — round 1's paler ramp washed to grey-mauve in the
    // milk.
    const rose = new Color(0xbe5578);
    const cream = new Color(0xf4ddc8);
    const plateShade = new Color();
    paint(plate, (_y, x, z) => {
      const radial = Math.min(1, Math.hypot(x, z) / (tier.radius * 1.2));
      plateShade.copy(rose).lerp(cream, smoothstep01((radial - 0.5) / 0.45));
      return [plateShade.r, plateShade.g, plateShade.b];
    });
    const around = random.range(0, Math.PI * 2);
    plate.applyMatrix4(
      new Matrix4().compose(
        new Vector3(
          Math.cos(around) * tier.offset,
          height * tier.at,
          Math.sin(around) * tier.offset,
        ),
        new Quaternion().setFromAxisAngle(
          new Vector3(-Math.sin(around), 0, Math.cos(around)),
          random.range(0.04, 0.1),
        ),
        new Vector3(1, 1, 1),
      ),
    );
    parts.push(plate);
  }

  // The crown: an antler reach above the last tier, gold at every tip.
  const antlerFrom = height * 0.74;
  const gold = new Color(0xecc153);
  const roseDeep = new Color(0xb35270);
  const antlerShade = new Color();
  const up = new Vector3(0, 1, 0);
  const grow = (base: Vector3, direction: Vector3, length: number, radius: number, level: number): void => {
    const tip = base.clone().addScaledVector(direction, length);
    const segment = new CapsuleGeometry(radius, length, 1, 5);
    segment.applyMatrix4(
      new Matrix4().compose(
        base.clone().add(tip).multiplyScalar(0.5),
        new Quaternion().setFromUnitVectors(up, direction.clone().normalize()),
        new Vector3(1, 1, 1),
      ),
    );
    paint(segment, (y) => {
      const t = Math.min(1, Math.max(0, (y - antlerFrom) / (height - antlerFrom)));
      antlerShade.copy(roseDeep).lerp(gold, t * t);
      return [antlerShade.r, antlerShade.g, antlerShade.b];
    });
    parts.push(segment);
    if (level === 0) {
      return;
    }
    const kids = 2 + (random.next() < 0.4 ? 1 : 0);
    for (let i = 0; i < kids; i++) {
      const yaw = random.range(0, Math.PI * 2);
      const tilt = random.range(0.45, 0.95);
      const child = new Vector3(
        direction.x + Math.cos(yaw) * tilt,
        direction.y + random.range(0.3, 0.7),
        direction.z + Math.sin(yaw) * tilt,
      ).normalize();
      grow(tip, child, length * random.range(0.62, 0.78), radius * 0.72, level - 1);
    }
  };
  for (let trunkArm = 0; trunkArm < 3; trunkArm++) {
    const around = (trunkArm / 3) * Math.PI * 2 + random.signed(0.3);
    grow(
      new Vector3(Math.cos(around) * 0.3, antlerFrom, Math.sin(around) * 0.3),
      new Vector3(Math.cos(around) * 0.5, 1, Math.sin(around) * 0.5).normalize(),
      height * 0.15,
      0.26,
      2,
    );
  }

  // The emissive whisper holds the rose against thirty metres of milk —
  // the mother is the one thing in the region allowed to glow a little.
  const mesh = mergedMesh(
    parts,
    createToonMaterial({ vertexColors: true, emissive: 0x3a1c22, emissiveIntensity: 0.6 }),
    "pale-mother-coral",
  );
  mesh.geometry.translate(at.x, foot, at.z);
  mesh.geometry.computeBoundingSphere();

  const colliders: SphereCollider[] = [];
  for (const level of [0.1, 0.3, 0.5, 0.7]) {
    colliders.push({
      center: new Vector3(at.x, foot + height * level, at.z),
      radius: level < 0.2 ? 1.6 : 1.0,
    });
  }
  for (const tier of tiers) {
    colliders.push({
      center: new Vector3(at.x, foot + height * tier.at + 0.2, at.z),
      radius: tier.radius * 0.6,
    });
  }

  return {
    mesh,
    colliders,
    contacts: [{ x: at.x, z: at.z, radius: 3.2, strength: 0.5 }],
    crown: { x: at.x, y: foot + height * 0.88, z: at.z },
  };
}