import {
  BoxGeometry,
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  Object3D,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { requestModel } from "../../../rendering/AssetLibrary";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { archGeometry, boulderGeometry, slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { FILL_SEEDS } from "./CalamityFillShared";
import { smoothstep01 } from "./CalamityShared";
import {
  GATE_U,
  WOUND,
  marchChannelCenter,
  worldOf,
} from "./CalamityTerrain";

/**
 * The Sunken Calamity's stone: what the blast did to the terrace-builders'
 * country, told in one module.
 *
 * - **The Fallen Processional** — three of the causeway's own columns
 *   lying in the march's mouth, the first omen: this was a paved country.
 * - **The blast road's thrown stones** — slabs and boulders scattered
 *   pointing *away* from the Wound, because that is what a blast does.
 * - **The Card House** — five pavement slabs fallen against each other
 *   like a collapsed hand, with swim-under shadows.
 * - **The ghost traps** — the builders' amphorae, broken where they fell,
 *   still sitting in the Suffocated Mile's violet pool.
 * - **The Wound Gate** — two monoliths of thrown ridge leaning into a
 *   rough arch over the channel, the pinch before the reveal.
 * - **The bank teeth** — small stacks standing off the banks every
 *   thirty-five metres, so the march's fog keeps its rhythm of reveals.
 * - **The Shatterfield causeway and the Great Slab** — the pavement's
 *   biggest pieces, one standing fourteen metres on edge.
 * - **The Quiet Rim pair** — the last stones, leaning toward the distance.
 *
 * Every stone is a `RockShapes` lathe finished by `weatherRock`; the
 * crater-facing sides carry a baked scorch tint, so the ruin reads as
 * *directional* — everything here was thrown from one heart. Everything
 * solid returns sphere colliders; everything standing returns a contact.
 */

const SEED = SEEDS.regionCalamity;

export interface CalamityRubbleBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
}

/**
 * Multiplies a scorch into the geometry's existing vertex colours on the
 * side facing `dir` (world XZ): the blast's signature — every stone in
 * the crater country is darker on the face that watched the Wound exhale.
 */
function scorchToward(geometry: BufferGeometry, dirX: number, dirZ: number, amount: number): void {
  const position = geometry.attributes.position!;
  const box = geometry.boundingBox;
  if (!box) {
    geometry.computeBoundingBox();
  }
  const cx = (geometry.boundingBox!.min.x + geometry.boundingBox!.max.x) / 2;
  const cz = (geometry.boundingBox!.min.z + geometry.boundingBox!.max.z) / 2;
  const len = Math.hypot(dirX, dirZ) || 1;
  const nx = dirX / len;
  const nz = dirZ / len;
  const existing = geometry.getAttribute("color") as BufferAttribute | undefined;
  const colors = existing ?? new BufferAttribute(new Float32Array(position.count * 3).fill(1), 3);
  for (let i = 0; i < position.count; i++) {
    const fx = position.getX(i) - cx;
    const fz = position.getZ(i) - cz;
    const fl = Math.hypot(fx, fz);
    if (fl < 1e-4) {
      continue;
    }
    const facing = Math.max(0, (fx / fl) * nx + (fz / fl) * nz);
    const scorch = 1 - amount * smoothstep01((facing - 0.15) / 0.7);
    colors.setXYZ(
      i,
      colors.getX(i) * scorch,
      colors.getY(i) * (scorch * 0.985 + 0.015),
      colors.getZ(i) * (scorch * 1.02),
    );
  }
  geometry.setAttribute("color", colors);
}

export function buildCalamityRubble(): CalamityRubbleBuild {
  const random = new Random(SEED ^ 0x50c7);
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  // Round 2 lifted both tints a step: against the ash-milk the first
  // draft's stones read near-black, and the darkest thing in the region
  // is a colour, not a cut-out.
  const paleStone = createRockMaterial(0x9a958a);
  const woundStone = createRockMaterial(0x76717e);

  /** Direction from a spoke point back toward the Wound, in world XZ. */
  const woundDir = (u: number, v: number): { x: number; z: number } => {
    const at = worldOf(u, v);
    const crater = worldOf(WOUND.u, WOUND.v);
    return { x: crater.x - at.x, z: crater.z - at.z };
  };

  const stand = (
    geometry: BufferGeometry,
    u: number,
    v: number,
    yaw: number,
    radius: number,
    height: number,
    material = woundStone,
    scorch = 0.12,
  ): { x: number; z: number; y: number } => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    geometry.computeBoundingBox();
    const dir = woundDir(u, v);
    scorchToward(geometry, dir.x, dir.z, scorch);
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, material);
    mesh.name = "calamity-stone";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
    contacts.push({ x, z, radius: radius * 1.3, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + height * 0.35, z), radius: radius * 0.85 });
    if (height > radius * 1.6) {
      colliders.push({ center: new Vector3(x, y + height * 0.75, z), radius: radius * 0.6 });
    }
    return { x, z, y };
  };

  // ─── The Fallen Processional ─────────────────────────────────────────────
  // Three column drums of the terrace country lying in the march's mouth:
  // the first thing past the seam says this was a built place, not a reef.
  const drum = (u: number, v: number, yaw: number, index: number): void => {
    const geometry = stackGeometry(
      [
        { radius: 0.95, rise: 0.4, stretch: 1.25, lean: 0 },
        { radius: 0.82, rise: 2.9, stretch: 1.2, lean: 0.12 },
      ],
      { seed: SEED ^ (0x0a10 + index) },
    );
    // Laid down: the lathe's axis turned onto the sand, crown pointing
    // back at the terrace it walked from.
    geometry.applyMatrix4(new Matrix4().makeRotationZ(Math.PI / 2 - 0.08));
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    geometry.translate(x, y + 0.55, z);
    geometry.computeBoundingBox();
    const dir = woundDir(u, v);
    scorchToward(geometry, dir.x, dir.z, 0.14);
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, paleStone);
    mesh.name = "calamity-fallen-column";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
    contacts.push({ x, z, radius: 2.6, strength: 0.42 });
    colliders.push({ center: new Vector3(x, y + 0.9, z), radius: 1.7 });
  };
  drum(62, -5.2, 0.5, 0);
  drum(74, 4.6, 2.8, 1);
  drum(88, -1.5, 1.35, 2);

  // ─── The blast road's thrown stones ──────────────────────────────────────
  // Eight tumbled stones down u 150–310, alternating off the channel,
  // each one's long axis laid pointing away from the Wound: the frozen
  // direction of the disaster, read at a glance.
  for (let i = 0; i < 8; i++) {
    const u = 150 + i * 23 + random.signed(6);
    const side = i % 2 === 0 ? -1 : 1;
    const vc = marchChannelCenter(u);
    const lateral = vc + side * random.range(5.5, 9.5);
    const flat = random.next() < 0.55;
    const radius = random.range(1.3, 2.4);
    const height = flat ? radius * random.range(0.5, 0.7) : radius * random.range(0.95, 1.35);
    // Yaw aligned so the stone's long axis points away from the crater.
    const dir = woundDir(u, lateral);
    const away = Math.atan2(dir.x, dir.z) + random.signed(0.5);
    stand(
      flat
        ? slabGeometry({ seed: SEED ^ (0x0aa0 + i), radius, height })
        : boulderGeometry({ seed: SEED ^ (0x0aa0 + i), radius, height }),
      u,
      lateral,
      away,
      radius,
      height,
      i % 3 === 0 ? paleStone : woundStone,
    );
  }

  // ─── The Drowned Gardener ────────────────────────────────────────────────
  // The region's hero set-piece: a toppled monumental statue of a
  // terrace-builder lying on the blast road — the one human-shaped thing
  // in the whole ruin, and therefore the saddest. The sculpted GLB swaps
  // onto the same transform when it arrives; the procedural stand-in is
  // the same figure in broader strokes, so the place exists either way.
  {
    const u = 252;
    const v = 5.5;
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    const mesh = new Mesh(gardenerFallbackGeometry(), gardenerMaterial());
    mesh.name = "calamity-drowned-gardener";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    // Fell walking home: head back toward the terrace, face to the sky.
    const axis = worldOf(1, 0);
    mesh.rotation.y = Math.atan2(axis.x, axis.z) + Math.PI + 0.22;
    mesh.rotation.z = 0.05;
    mesh.scale.setScalar(1.35);
    mesh.position.set(x, y, z);
    requestModel("models/calamity-drowned-gardener.glb", (geometry) => {
      mesh.geometry.dispose();
      mesh.geometry = geometry;
    });
    meshes.push(mesh);
    contacts.push({ x, z, radius: 3.6, strength: 0.46 });
    colliders.push(
      { center: new Vector3(x, y + 0.7, z), radius: 1.6 },
      {
        center: new Vector3(x - Math.sin(mesh.rotation.y) * 2.2, y + 0.5, z - Math.cos(mesh.rotation.y) * 2.2),
        radius: 1.3,
      },
      {
        center: new Vector3(x + Math.sin(mesh.rotation.y) * 1.4, y + 1.0, z + Math.cos(mesh.rotation.y) * 1.4),
        radius: 1.1,
      },
    );
  }

  // ─── The Card House ──────────────────────────────────────────────────────
  // Five pavement slabs fallen against each other over u 315–345: the
  // pavement's biggest jumble on the road, with real swim-under shadows.
  const cardSpecs: { u: number; v: number; yaw: number; tilt: number; radius: number }[] = [
    { u: 318, v: -6.5, yaw: 0.5, tilt: 0.42, radius: 3.4 },
    { u: 322, v: -1.5, yaw: 2.2, tilt: -0.38, radius: 3.8 },
    { u: 327, v: 4.5, yaw: 1.2, tilt: 0.46, radius: 3.2 },
    { u: 333, v: -4, yaw: 2.9, tilt: -0.44, radius: 3.6 },
    { u: 340, v: 2, yaw: 0.2, tilt: 0.36, radius: 2.9 },
  ];
  for (const [i, spec] of cardSpecs.entries()) {
    const geometry = slabGeometry({ seed: SEED ^ (0x0b00 + i), radius: spec.radius, height: spec.radius * 0.42 });
    // Heaved up on edge: the pavement slab's flat face turned toward the sky.
    geometry.applyMatrix4(new Matrix4().makeRotationX(spec.tilt));
    const at = stand(geometry, spec.u, spec.v, spec.yaw, spec.radius, spec.radius * 1.9, paleStone, 0.16);
    colliders.push({ center: new Vector3(at.x, at.y + spec.radius * 1.2, at.z), radius: spec.radius * 0.7 });
  }

  // ─── The ghost traps ─────────────────────────────────────────────────────
  // The builders' amphorae, broken where they stood, down the Suffocated
  // Mile: small everyday grief, instanced from one lathed pot.
  const amphora = amphoraGeometry();
  const amphoraMat = createToonMaterial({ vertexColors: true });
  const amphoraCount = 14;
  const amphoraMesh = new InstancedMesh(amphora, amphoraMat, amphoraCount);
  amphoraMesh.name = "calamity-amphorae";
  amphoraMesh.castShadow = false;
  amphoraMesh.receiveShadow = false;
  const dummy = new Object3D();
  const tint = new Color();
  for (let i = 0; i < amphoraCount; i++) {
    const u = 352 + i * 6.4 + random.signed(3);
    const vc = marchChannelCenter(u);
    const lateral = vc + random.signed(6.5);
    const { x, z } = worldOf(u, lateral);
    const y = seabedHeight(x, z);
    dummy.position.set(x, y + 0.12, z);
    dummy.rotation.set(random.signed(0.5), random.range(0, Math.PI * 2), random.signed(0.5));
    // ×1.7 (the fill's pot-read audit): at 0.6–0.95 the pots read as
    // pebbles from the suffocated-mile pose's own camera. The multiplier
    // scales the SAME stream draw, so no survivor moves (the fence).
    dummy.scale.setScalar(random.range(0.6, 0.95) * 1.7);
    dummy.updateMatrix();
    amphoraMesh.setMatrixAt(i, dummy.matrix);
    tint.setHex(i % 4 === 0 ? 0xa88a68 : 0x8f7d70).multiplyScalar(random.range(0.85, 1.1));
    amphoraMesh.setColorAt(i, tint);
    if (i % 3 === 0) {
      colliders.push({ center: new Vector3(x, y + 0.5, z), radius: 0.55 });
    }
    contacts.push({ x, z, radius: 0.8, strength: 0.3 });
  }
  amphoraMesh.instanceMatrix.needsUpdate = true;
  if (amphoraMesh.instanceColor) {
    amphoraMesh.instanceColor.needsUpdate = true;
  }
  amphoraMesh.computeBoundingSphere();
  meshes.push(amphoraMesh);

  // ─── The bank teeth ──────────────────────────────────────────────────────
  // Small stacks off the banks every ~35 m down the march — the fog's
  // rhythm of reveals on a five-hundred-metre road. One geometry,
  // instanced; every third tooth a pale terrace stone.
  const tooth = stackGeometry(
    [
      { radius: 1.1, rise: 0.5, stretch: 1.8, lean: 0.3 },
      { radius: 0.75, rise: 3.1, stretch: 1.6, lean: 0.8 },
    ],
    { seed: SEED ^ 0x0c01 },
  );
  const toothCount = 12;
  const toothMesh = new InstancedMesh(tooth, paleStone, toothCount);
  toothMesh.name = "calamity-bank-teeth";
  toothMesh.castShadow = false;
  toothMesh.receiveShadow = false;
  for (let i = 0; i < toothCount; i++) {
    const u = 112 + i * 29 + random.signed(6);
    const side = i % 2 === 0 ? 1 : -1;
    const vc = marchChannelCenter(u);
    const lateral = vc + side * random.range(8.5, 13);
    const { x, z } = worldOf(u, lateral);
    const y = seabedHeight(x, z);
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), random.signed(0.08));
    dummy.scale.setScalar(random.range(0.8, 1.5));
    dummy.updateMatrix();
    toothMesh.setMatrixAt(i, dummy.matrix);
    contacts.push({ x, z, radius: 1.7, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + 1.6, z), radius: 1.2 });
  }
  toothMesh.instanceMatrix.needsUpdate = true;
  toothMesh.computeBoundingSphere();
  meshes.push(toothMesh);

  // ─── The Wound Gate ──────────────────────────────────────────────────────
  // Two monoliths of thrown ridge leaning into a rough arch over the
  // channel at the crest — the pinch the reveal breathes through.
  const gateArch = archGeometry({
    seed: SEED ^ 0x0d01,
    span: 7.2,
    legHeight: 4.6,
    legRadius: 1.5,
    beamRadius: 1.1,
    rise: 1.6,
  });
  {
    const { x, z } = worldOf(GATE_U - 4, marchChannelCenter(GATE_U - 4));
    const y = seabedHeight(x, z);
    // The arch's passage runs along the channel: its plane faces the diver.
    const axis = worldOf(1, 0);
    const yaw = Math.atan2(axis.x, axis.z) + Math.PI / 2;
    gateArch.applyMatrix4(new Matrix4().makeRotationY(yaw));
    gateArch.translate(x, y, z);
    gateArch.computeBoundingBox();
    const dir = woundDir(GATE_U - 4, 0);
    scorchToward(gateArch, dir.x, dir.z, 0.18);
    gateArch.computeBoundingSphere();
    const mesh = new Mesh(gateArch, woundStone);
    mesh.name = "calamity-wound-gate";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
    const legOffset = new Vector3(3.6, 0, 0).applyMatrix4(new Matrix4().makeRotationY(yaw));
    for (const side of [-1, 1]) {
      colliders.push({
        center: new Vector3(x + side * legOffset.x, y + 1.8, z + side * legOffset.z),
        radius: 1.7,
      });
      contacts.push({
        x: x + side * legOffset.x,
        z: z + side * legOffset.z,
        radius: 2.1,
        strength: 0.42,
      });
    }
  }

  // ─── The Shatterfield causeway ───────────────────────────────────────────
  // The pavement's biggest pieces, fallen in a rough procession off the
  // road into the crater country — flat, heaved, tilted at every angle
  // the ground's fracture suggests.
  for (let i = 0; i < 12; i++) {
    const u = 498 + i * 6.5 + random.signed(3);
    const side = i % 2 === 0 ? -1 : 1;
    const lateral = side * random.range(7, 15) + random.signed(3);
    const radius = random.range(2.2, 4.2);
    const geometry = slabGeometry({ seed: SEED ^ (0x0e00 + i), radius, height: radius * random.range(0.35, 0.5) });
    geometry.applyMatrix4(new Matrix4().makeRotationX(random.signed(0.5)));
    const at = stand(
      geometry,
      u,
      lateral,
      random.range(0, Math.PI * 2),
      radius,
      radius * 1.4,
      i % 4 === 0 ? paleStone : woundStone,
      0.18,
    );
    if (i % 2 === 0) {
      colliders.push({ center: new Vector3(at.x, at.y + radius * 0.9, at.z), radius: radius * 0.6 });
    }
  }

  // ─── The Great Slab ──────────────────────────────────────────────────────
  // Fourteen metres of pavement standing on edge at the Ghost Forest's
  // eaves — the reveal's horizon mark, visible as a ghost from the Gate.
  stand(
    (() => {
      const geometry = slabGeometry({ seed: SEED ^ 0x0f01, radius: 4.6, height: 2.1 });
      geometry.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2 - 0.12));
      return geometry;
    })(),
    585,
    6,
    0.9,
    4.6,
    13.5,
    paleStone,
    0.2,
  );

  // ─── The crater lip's leaning watchers ───────────────────────────────────
  for (const [i, spot] of [
    { u: 648, v: -22, yaw: 1.8 },
    { u: 656, v: 18, yaw: 4.2 },
  ].entries()) {
    stand(
      stackGeometry(
        [
          { radius: 1.5, rise: 0.7, stretch: 1.9, lean: 0.5 },
          { radius: 1.0, rise: 3.6, stretch: 1.7, lean: 1.2 },
        ],
        { seed: SEED ^ (0x0f10 + i) },
      ),
      spot.u,
      spot.v,
      spot.yaw,
      1.5,
      5.4,
      woundStone,
      0.18,
    );
  }

  // ─── The Quiet Rim pair ──────────────────────────────────────────────────
  // The last handmade things, leaning toward the painted distance.
  stand(
    stackGeometry(
      [
        { radius: 1.6, rise: 0.8, stretch: 2.0, lean: 0.6 },
        { radius: 1.0, rise: 4.4, stretch: 1.8, lean: 1.4 },
      ],
      { seed: SEED ^ 0x0f21 },
    ),
    882,
    16,
    1.1,
    1.6,
    6.4,
    paleStone,
    0.2,
  );
  stand(
    stackGeometry(
      [
        { radius: 1.4, rise: 0.7, stretch: 1.9, lean: -0.5 },
        { radius: 0.9, rise: 3.8, stretch: 1.7, lean: -1.1 },
      ],
      { seed: SEED ^ 0x0f22 },
    ),
    876,
    -6,
    4.0,
    1.4,
    5.6,
    paleStone,
    0.2,
  );

  // ═══ THE PHASE 3 FILL — everything below draws from fresh streams,
  // appended after every pilot draw (the reroll fence): no existing stone,
  // pot or tooth moves. Ruin-density as story: masonry piles, the fallen
  // lintel, heaved flags, menhirs, the causeway grown 12 → 20, the teeth
  // 12 → 30, the amphorae 14 → 22 in four clusters. ═══

  /** A stone transformed into world space, scorched, for a merged mesh. */
  const bakeStone = (
    geometry: BufferGeometry,
    u: number,
    v: number,
    yaw: number,
    sink = 0,
  ): BufferGeometry => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z) - sink;
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    geometry.computeBoundingBox();
    const dir = woundDir(u, v);
    scorchToward(geometry, dir.x, dir.z, 0.14);
    return geometry;
  };

  {
    const fill = new Random(SEED ^ FILL_SEEDS.fillStones);
    const paleParts: BufferGeometry[] = [];
    const woundParts: BufferGeometry[] = [];

    // The fallen lintel at u 108 — the reveal cadence's first new beat.
    {
      const lintel = slabGeometry({ seed: SEED ^ 0x0f31, radius: 2.6, height: 1.0 });
      lintel.applyMatrix4(new Matrix4().makeRotationX(0.16));
      paleParts.push(bakeStone(lintel, 108, -8.5, 1.1, 0.3));
      contacts.push({ x: worldOf(108, -8.5).x, z: worldOf(108, -8.5).z, radius: 3.2, strength: 0.42 });
      const at = worldOf(108, -8.5);
      colliders.push({ center: new Vector3(at.x, seabedHeight(at.x, at.z) + 0.8, at.z), radius: 1.9 });
    }

    // Masonry piles: five on the march, four in the Shatterfield — a
    // handful of small terrace blocks jumbled where a wall came down.
    const pileSpots: { u: number; v: number }[] = [
      { u: 128, v: 7 },
      { u: 176, v: -9 },
      { u: 226, v: 8.5 },
      { u: 264, v: -8 },
      { u: 298, v: 9 },
      { u: 502, v: -18 },
      { u: 518, v: 13 },
      { u: 546, v: -24 },
      { u: 562, v: 20 },
    ];
    for (const [pileIndex, spot] of pileSpots.entries()) {
      const stones = 4 + (pileIndex % 3);
      for (let s = 0; s < stones; s++) {
        const angle = fill.range(0, Math.PI * 2);
        const r = fill.range(0, 1.6) * Math.sqrt(fill.next());
        const radius = fill.range(0.4, 0.85);
        const block = slabGeometry({
          seed: SEED ^ (0x0f40 + pileIndex * 8 + s),
          radius,
          height: radius * fill.range(0.5, 0.8),
        });
        block.applyMatrix4(new Matrix4().makeRotationX(fill.signed(0.4)));
        block.translate(Math.cos(angle) * r, s * 0.16, Math.sin(angle) * r);
        paleParts.push(bakeStone(block, spot.u, spot.v, fill.range(0, Math.PI * 2)));
      }
      const at = worldOf(spot.u, spot.v);
      contacts.push({ x: at.x, z: at.z, radius: 2.2, strength: 0.4 });
      colliders.push({
        center: new Vector3(at.x, seabedHeight(at.x, at.z) + 0.5, at.z),
        radius: 1.4,
      });
    }

    // Heaved-flag pavement patches: eight flags lying almost flush in the
    // Shatterfield's floor, one edge lifted — pavement remembering itself.
    for (let i = 0; i < 8; i++) {
      const u = 496 + fill.range(0, 84);
      const v = fill.signed(60);
      const radius = fill.range(1.5, 2.6);
      const flag = slabGeometry({ seed: SEED ^ (0x0f60 + i), radius, height: radius * 0.22 });
      flag.applyMatrix4(new Matrix4().makeRotationX(fill.signed(0.16)));
      paleParts.push(bakeStone(flag, u, v, fill.range(0, Math.PI * 2), radius * 0.12));
      const at = worldOf(u, v);
      contacts.push({ x: at.x, z: at.z, radius: radius * 1.1, strength: 0.32 });
    }

    // The menhir pair: two thrown slabs standing on edge at the
    // Shatterfield's south shoulder, leaning the way the blast left them.
    for (const [i, spot] of [
      { u: 540, v: 34, yaw: 0.7 },
      { u: 549, v: 40, yaw: 1.3 },
    ].entries()) {
      const menhir = slabGeometry({ seed: SEED ^ (0x0f70 + i), radius: 2.3, height: 1.1 });
      menhir.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2 - 0.18 + i * 0.1));
      woundParts.push(bakeStone(menhir, spot.u, spot.v, spot.yaw));
      const at = worldOf(spot.u, spot.v);
      contacts.push({ x: at.x, z: at.z, radius: 2.4, strength: 0.42 });
      colliders.push(
        { center: new Vector3(at.x, seabedHeight(at.x, at.z) + 1.4, at.z), radius: 1.5 },
        { center: new Vector3(at.x, seabedHeight(at.x, at.z) + 3.4, at.z), radius: 1.1 },
      );
    }

    // The causeway grown 12 → 20: eight more slabs threading the same
    // procession, from a fresh stream so the first twelve never move.
    for (let i = 0; i < 8; i++) {
      const u = 500 + i * 8.5 + fill.signed(3);
      const side = i % 2 === 0 ? 1 : -1;
      const lateral = side * fill.range(4, 12) + fill.signed(3);
      const radius = fill.range(1.8, 3.4);
      const slab = slabGeometry({
        seed: SEED ^ (0x0f80 + i),
        radius,
        height: radius * fill.range(0.32, 0.48),
      });
      slab.applyMatrix4(new Matrix4().makeRotationX(fill.signed(0.4)));
      woundParts.push(bakeStone(slab, u, lateral, fill.range(0, Math.PI * 2)));
      const at = worldOf(u, lateral);
      contacts.push({ x: at.x, z: at.z, radius: radius * 1.2, strength: 0.38 });
      if (i % 2 === 0) {
        colliders.push({
          center: new Vector3(at.x, seabedHeight(at.x, at.z) + radius * 0.7, at.z),
          radius: radius * 0.55,
        });
      }
    }

    // The Quiet Rim's two extra leaning stones, framing the relic pair.
    for (const [i, spot] of [
      { u: 866, v: -20, yaw: 2.2 },
      { u: 890, v: 26, yaw: 5.1 },
    ].entries()) {
      const stone = stackGeometry(
        [
          { radius: 1.2, rise: 0.6, stretch: 1.7, lean: 0.4 * (i === 0 ? 1 : -1) },
          { radius: 0.8, rise: 2.9, stretch: 1.5, lean: 0.9 * (i === 0 ? 1 : -1) },
        ],
        { seed: SEED ^ (0x0f90 + i) },
      );
      paleParts.push(bakeStone(stone, spot.u, spot.v, spot.yaw));
      const at = worldOf(spot.u, spot.v);
      contacts.push({ x: at.x, z: at.z, radius: 1.6, strength: 0.4 });
      colliders.push({
        center: new Vector3(at.x, seabedHeight(at.x, at.z) + 1.4, at.z),
        radius: 1.1,
      });
    }

    for (const [parts, material, name] of [
      [paleParts, paleStone, "calamity-fill-stones-pale"],
      [woundParts, woundStone, "calamity-fill-stones-wound"],
    ] as const) {
      const merged = mergeGeometries([...parts], false);
      for (const part of parts) {
        part.dispose();
      }
      if (!merged) {
        throw new Error(`calamity ${name} parts could not be merged`);
      }
      merged.computeBoundingSphere();
      const mesh = new Mesh(merged, material);
      mesh.name = name;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      meshes.push(mesh);
    }
  }

  // The teeth grown 12 → 30: eighteen more stacks interleaved down the
  // march (fresh stream, fresh geometry seed — the first twelve stand).
  {
    const fill = new Random(SEED ^ FILL_SEEDS.fillTeeth);
    const fillTooth = stackGeometry(
      [
        { radius: 1.0, rise: 0.5, stretch: 1.7, lean: 0.4 },
        { radius: 0.7, rise: 2.8, stretch: 1.5, lean: 0.9 },
      ],
      { seed: SEED ^ 0x0fa1 },
    );
    const count = 18;
    const mesh = new InstancedMesh(fillTooth, paleStone, count);
    mesh.name = "calamity-bank-teeth-fill";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    for (let i = 0; i < count; i++) {
      let u = 96 + i * 22.5 + fill.signed(5);
      const side = i % 2 === 0 ? -1 : 1;
      let vc = marchChannelCenter(u);
      let lateral = vc + side * fill.range(7.5, 12.5);
      // The Gardener's stage stays clear — not just the registry's bare
      // ten metres but the POSE's whole frame: round 1's tooth at
      // u ≈ 253 photobombed the statue like an unintended totem. Any
      // tooth drawn inside the stage steps 34 m down-road, keeping its
      // drawn bank offset (identical stream consumption either way).
      if (Math.hypot(u - 252, lateral - 5.5) < 18) {
        const offset = lateral - vc;
        u += 34;
        vc = marchChannelCenter(u);
        lateral = vc + offset;
      }
      const { x, z } = worldOf(u, lateral);
      const y = seabedHeight(x, z);
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, fill.range(0, Math.PI * 2), fill.signed(0.08));
      dummy.scale.setScalar(fill.range(0.7, 1.4));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      contacts.push({ x, z, radius: 1.5, strength: 0.38 });
      colliders.push({ center: new Vector3(x, y + 1.4, z), radius: 1.1 });
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
  }

  // The amphorae grown 14 → 22: four clusters at u 352/375/400/425 — the
  // Mile's ONLY fill (registry clause), pot-read scale against its pose.
  {
    const fill = new Random(SEED ^ FILL_SEEDS.fillAmphorae);
    const count = 8;
    const mesh = new InstancedMesh(amphora, amphoraMat, count);
    mesh.name = "calamity-amphorae-clusters";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const clusterU = [352, 375, 400, 425];
    for (let i = 0; i < count; i++) {
      const u = clusterU[i % 4]! + fill.signed(3.5);
      const vc = marchChannelCenter(u);
      const lateral = vc + fill.signed(5.5);
      const { x, z } = worldOf(u, lateral);
      const y = seabedHeight(x, z);
      dummy.position.set(x, y + 0.12, z);
      dummy.rotation.set(fill.signed(0.5), fill.range(0, Math.PI * 2), fill.signed(0.5));
      dummy.scale.setScalar(fill.range(1.1, 1.7));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tint.setHex(i % 3 === 0 ? 0xa88a68 : 0x8f7d70).multiplyScalar(fill.range(0.85, 1.1));
      mesh.setColorAt(i, tint);
      if (i % 4 === 0) {
        colliders.push({ center: new Vector3(x, y + 0.7, z), radius: 0.7 });
      }
      contacts.push({ x, z, radius: 1.1, strength: 0.3 });
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
    meshes.push(mesh);
  }

  return { meshes, colliders, contacts };
}

// ─── The Drowned Gardener's stand-in ─────────────────────────────────────────

/**
 * The procedural figure: the same statue in broader strokes — robed
 * lathe, hooded sphere, raised arm, broken plinth — authored in the
 * GLB's own local frame (figure lying along Z, head toward +Z, pivot at
 * the plinth's underside) so the sculpted swap never jumps. In Node and
 * in the no-assets build this IS the statue.
 */
function gardenerFallbackGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];

  const plinth = new BoxGeometry(1.7, 0.42, 2.3, 1, 1, 1);
  plinth.translate(0, 0.21, -0.35);
  parts.push(plinth);

  const profile: Vector2[] = [];
  for (const [radius, h] of [
    [0.8, 0],
    [0.74, 0.3],
    [0.64, 0.7],
    [0.58, 1.1],
    [0.66, 1.5],
    [0.63, 1.75],
    [0.34, 1.95],
    [0.23, 2.06],
  ] as const) {
    profile.push(new Vector2(radius, h));
  }
  const robe = new LatheGeometry(profile, 14);
  // Standing → lying along Z, hem toward −Z, shoulders toward +Z.
  robe.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2 + 0.08));
  robe.translate(0, 0.62, -0.42);
  parts.push(robe);

  const head = new SphereGeometry(0.36, 12, 9);
  head.scale(0.95, 0.9, 1.1);
  head.translate(0, 0.68, 0.92);
  parts.push(head);

  const arm = new TubeGeometry(
    new CatmullRomCurve3([
      new Vector3(0.34, 0.72, 0.28),
      new Vector3(0.52, 0.9, 0.05),
      new Vector3(0.48, 1.22, -0.12),
      new Vector3(0.4, 1.52, -0.16),
    ]),
    8,
    0.12,
    6,
    false,
  );
  parts.push(arm);
  const hand = new SphereGeometry(0.13, 8, 6);
  hand.scale(0.9, 1.15, 0.9);
  hand.translate(0.4, 1.6, -0.16);
  parts.push(hand);

  // The stand-in's paint: pale sage, moss on up-facing verts, a violet
  // hood shadow, value mapped over the same rules the sculpted piece is
  // painted by.
  const sage = new Color(0x99a08e);
  const moss = new Color(0x7a945f);
  const recess = new Color(0x756e8a);
  for (const part of parts) {
    part.computeVertexNormals();
    const position = part.attributes.position!;
    const normal = part.attributes.normal!;
    const colors = new Float32Array(position.count * 3);
    const shade = new Color();
    for (let i = 0; i < position.count; i++) {
      const up = smoothstep01((normal.getY(i) - 0.25) / 0.6);
      shade.copy(sage).lerp(moss, up * 0.5);
      // The moss-glimmer (fill plan §4): a hand-sized pale value lift on
      // the statue's up-facing moss — paint, not additive. The sculpted
      // GLB keeps its own paint; this is the stand-in's answer.
      shade.multiplyScalar(1 + up * 0.16);
      if (Math.hypot(position.getX(i) / 0.26, (position.getZ(i) - 1.05) / 0.3) < 1.1) {
        shade.lerp(recess, 0.6);
      }
      const down = smoothstep01((-normal.getY(i) - 0.3) / 0.6);
      shade.multiplyScalar(1 - down * 0.22);
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }
    part.setAttribute("color", new BufferAttribute(colors, 3));
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("calamity gardener stand-in parts could not be merged");
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  return merged;
}

let gardenerMat: ReturnType<typeof createToonMaterial> | undefined;
function gardenerMaterial(): ReturnType<typeof createToonMaterial> {
  gardenerMat ??= createToonMaterial({
    vertexColors: true,
    map: gardenerGrain(),
    emissive: 0x232019,
    emissiveIntensity: 0.5,
  });
  return gardenerMat;
}

let gardenerGrainMap: ReturnType<typeof buildColorTexture> | undefined;
function gardenerGrain(): ReturnType<typeof buildColorTexture> {
  gardenerGrainMap ??= buildColorTexture(32, (u, v) => {
    const grain = 0.72 + fbm(u * 3, v * 5, { seed: SEED ^ 0x9a17, period: 8, octaves: 2 }) * 0.26;
    return [grain * 0.96, grain * 0.97, grain * 0.92];
  });
  return gardenerGrainMap;
}

// ─── The amphora ─────────────────────────────────────────────────────────────

/** One broken pot: foot, belly, neck lost to the break, a chipped rim. */
function amphoraGeometry(): BufferGeometry {
  const points: Vector2[] = [];
  // The profile is the drawing: a small foot, a full belly, and the rim
  // opening where the neck broke — the pot is a ruin, not a vessel.
  points.push(new Vector2(0, -0.1));
  points.push(new Vector2(0.16, -0.06));
  points.push(new Vector2(0.2, 0.05));
  points.push(new Vector2(0.34, 0.3));
  points.push(new Vector2(0.38, 0.52));
  points.push(new Vector2(0.3, 0.72));
  points.push(new Vector2(0.19, 0.82));
  points.push(new Vector2(0.16, 0.88));
  const geometry = new LatheGeometry(points, 9);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const clay = new Color(0x9c8474);
  const rimShade = new Color(0x6e5f58);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i) / 0.88));
    shade.copy(clay).lerp(rimShade, smoothstep01((t - 0.6) / 0.4) * 0.7);
    shade.multiplyScalar(0.85 + t * 0.25);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
