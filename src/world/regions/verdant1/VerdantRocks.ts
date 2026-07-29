import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  Matrix4,
  Mesh,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { archGeometry, boulderGeometry, slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { mergedMesh, smoothstep01 } from "./VerdantShared";
import { ROOT_MAZE, VALE_LIP_U, valeChannelCenter, worldOf } from "./VerdantTerrain";

/**
 * The Great Kelp Sea's stone and dead wood: the vale's gate jambs, the
 * meadows' erratic, the Root Maze's whole tangle — gullied rock, holdfast
 * root hubs, two swim-through arches, the Wreck Rib and the grotto that
 * shelters the Kelp Weaver — and the Falling Edge's leaning stones.
 *
 * Every stone is a `RockShapes` lathe (the drawn-profile contract: the
 * silhouette is authored, the noise is tooth), finished by `weatherRock`'s
 * one implementation of the surface contract, wearing `createRockMaterial`
 * in near-neutral families so the wash carries the hue. The roots and the
 * wreck are this module's own tubes, painted in the maze's key: deep olive
 * and wine with a violet floor — red held above green, nothing near black.
 *
 * Everything solid returns sphere colliders; everything standing returns a
 * contact patch so the ground bake seats it.
 */

const SEED = SEEDS.regionVerdant1;

export interface VerdantRocksBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** The grotto's mouth, where the Kelp Weaver holds its haunt. */
  readonly grotto: { x: number; z: number; y: number; facing: number };
}

/**
 * Root tones: living holdfast wood, wine-dark to olive sapwood. Cooled in
 * round 4 — the warmer sapwood measured rust under the key, and rust is a
 * shipwreck's colour, not a living root's.
 */
const ROOT_DARK = new Color(0x453832);
const ROOT_LIGHT = new Color(0x74684c);
const ROOT_OLIVE = new Color(0x596b42);

export function buildVerdantRocks(): VerdantRocksBuild {
  const random = new Random(SEED ^ 0x50c7);
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  const mazeStone = createRockMaterial(0x66705f);
  const paleStone = createRockMaterial(0x8a8474);

  const stand = (
    geometry: BufferGeometry,
    u: number,
    v: number,
    yaw: number,
    radius: number,
    height: number,
    material = mazeStone,
  ): { x: number; z: number; y: number } => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, material);
    mesh.name = "verdant-rock";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
    contacts.push({ x, z, radius: radius * 1.3, strength: 0.4 });
    // Sparse containment: one sphere at the belly, one at the crown for
    // anything tall enough to matter.
    colliders.push({ center: new Vector3(x, y + height * 0.35, z), radius: radius * 0.85 });
    if (height > radius * 1.6) {
      colliders.push({ center: new Vector3(x, y + height * 0.75, z), radius: radius * 0.6 });
    }
    return { x, z, y };
  };

  // ─── The Vale Gate ───────────────────────────────────────────────────────
  // Two jamb stones where the cathedral's end wall opens — the doorway the
  // whole province is entered through.
  stand(
    stackGeometry(
      [
        { radius: 1.5, rise: 0.6, stretch: 1.9, lean: 0.4 },
        { radius: 1.1, rise: 3.4, stretch: 1.7, lean: 0.9 },
      ],
      { seed: SEED ^ 0x0a01 },
    ),
    55,
    -7.4,
    0.4,
    1.5,
    5.2,
    paleStone,
  );
  stand(
    stackGeometry(
      [
        { radius: 1.3, rise: 0.5, stretch: 1.8, lean: -0.3 },
        { radius: 0.9, rise: 2.9, stretch: 1.6, lean: -0.8 },
      ],
      { seed: SEED ^ 0x0a02 },
    ),
    57,
    7.8,
    2.6,
    1.3,
    4.4,
    paleStone,
  );

  // ─── The vale's wall stones ──────────────────────────────────────────────
  // Six boulders seated on alternating wall feet down the channel: with
  // the ledge kelp they are what breaches the fog every thirty metres of
  // the approach, and each one is a place the eye can rest against the
  // walls' big soft masses.
  for (let i = 0; i < 6; i++) {
    const u = 88 + i * 32 + random.signed(6);
    const side = i % 2 === 0 ? -1 : 1;
    const lateral = valeChannelCenter(u) + side * random.range(4.6, 7);
    const radius = random.range(1.1, 2.2);
    const height = radius * random.range(0.9, 1.3);
    stand(
      boulderGeometry({ seed: SEED ^ (0x0aa0 + i), radius, height }),
      u,
      lateral,
      random.range(0, Math.PI * 2),
      radius,
      height,
      i % 3 === 0 ? paleStone : mazeStone,
    );
  }

  // ─── The Overlook stone ──────────────────────────────────────────────────
  // A slab beside the lip: something to hold the frame's edge while the
  // meadows open below.
  stand(
    slabGeometry({ seed: SEED ^ 0x0a03, radius: 2.6, height: 1.5 }),
    VALE_LIP_U - 4,
    valeChannelCenter(VALE_LIP_U - 4) - 7.5,
    random.range(0, Math.PI * 2),
    2.6,
    1.5,
    paleStone,
  );

  // ─── The Shoal Hills erratic ─────────────────────────────────────────────
  // One great boulder alone on a meadow swell, the meadows' scale-giver.
  stand(
    boulderGeometry({ seed: SEED ^ 0x0a04, radius: 3.1, height: 4.1 }),
    318,
    32,
    random.range(0, Math.PI * 2),
    3.1,
    4.1,
    paleStone,
  );
  stand(
    boulderGeometry({ seed: SEED ^ 0x0a05, radius: 1.3, height: 1.6 }),
    323,
    27,
    random.range(0, Math.PI * 2),
    1.3,
    1.6,
    paleStone,
  );

  // ─── The Root Maze's stones ──────────────────────────────────────────────
  // Gully-ridge boulders and slabs, scattered on the maze's own ridges so
  // the deep quarter reads as walls and passages rather than a pit.
  for (let i = 0; i < 9; i++) {
    const angle = random.range(0, Math.PI * 2);
    const spread = 14 + Math.sqrt(random.next()) * 40;
    const u = ROOT_MAZE.u + Math.cos(angle) * spread;
    const v = ROOT_MAZE.v + Math.sin(angle) * spread;
    const slab = random.next() < 0.4;
    const radius = random.range(1.4, 2.8);
    const height = slab ? radius * random.range(0.5, 0.7) : radius * random.range(1.0, 1.4);
    stand(
      slab
        ? slabGeometry({ seed: SEED ^ (0x0b00 + i), radius, height })
        : boulderGeometry({ seed: SEED ^ (0x0b00 + i), radius, height }),
      u,
      v,
      random.range(0, Math.PI * 2),
      radius,
      height,
    );
  }

  // ─── The Green Gates ─────────────────────────────────────────────────────
  // Two swim-through arches on the maze's approach line, root-wrapped
  // below: the doorways that make the maze a maze and not a hole.
  const archSpots: { u: number; v: number; yaw: number; span: number }[] = [
    { u: ROOT_MAZE.u - 30, v: ROOT_MAZE.v + 34, yaw: 2.4, span: 6.4 },
    { u: ROOT_MAZE.u + 14, v: ROOT_MAZE.v + 10, yaw: 1.1, span: 5.2 },
  ];
  for (const [i, spot] of archSpots.entries()) {
    const arch = archGeometry({
      seed: SEED ^ (0x0c01 + i),
      span: spot.span,
      legHeight: 3.4 + i * 0.5,
      legRadius: 1.0,
      beamRadius: 0.85,
      rise: 1.3,
    });
    const { x, z } = worldOf(spot.u, spot.v);
    const y = seabedHeight(x, z);
    arch.applyMatrix4(new Matrix4().makeRotationY(spot.yaw));
    arch.translate(x, y, z);
    arch.computeBoundingSphere();
    const mesh = new Mesh(arch, mazeStone);
    mesh.name = "verdant-arch";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
    // Leg colliders only — the beam stays clear at swim height by its rise.
    const legOffset = new Vector3(spot.span / 2, 0, 0).applyMatrix4(
      new Matrix4().makeRotationY(spot.yaw),
    );
    for (const side of [-1, 1]) {
      colliders.push({
        center: new Vector3(x + side * legOffset.x, y + 1.4, z + side * legOffset.z),
        radius: 1.15,
      });
      contacts.push({
        x: x + side * legOffset.x,
        z: z + side * legOffset.z,
        radius: 1.5,
        strength: 0.42,
      });
    }
  }

  // ─── The holdfast tangle ─────────────────────────────────────────────────
  // Root hubs: each a knuckle of arcing roots gripping the gully ridges —
  // the maze's own flora, dead giants' anchors grown into architecture.
  const rootParts: BufferGeometry[] = [];
  for (let hub = 0; hub < 11; hub++) {
    const angle = random.range(0, Math.PI * 2);
    const spread = 8 + Math.sqrt(random.next()) * 34;
    const u = ROOT_MAZE.u + Math.cos(angle) * spread;
    const v = ROOT_MAZE.v + Math.sin(angle) * spread;
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    const crown = y + random.range(1.6, 3.2);
    const legs = 5 + Math.floor(random.next() * 4);
    for (let leg = 0; leg < legs; leg++) {
      const heading = (leg / legs) * Math.PI * 2 + random.signed(0.5);
      const reach = random.range(1.4, 3.0);
      const fx = x + Math.cos(heading) * reach;
      const fz = z + Math.sin(heading) * reach;
      rootParts.push(
        rootTube(
          new Vector3(x + random.signed(0.3), crown, z + random.signed(0.3)),
          new Vector3(fx, seabedHeight(fx, fz) - 0.3, fz),
          random.range(0.1, 0.2),
          random,
        ),
      );
    }
    contacts.push({ x, z, radius: 2.4, strength: 0.5 });
    colliders.push({ center: new Vector3(x, y + 1.2, z), radius: 1.5 });
  }
  meshes.push(mergedMesh(rootParts, rootMaterial(), "verdant-roots"));

  // ─── The Wreck Rib ───────────────────────────────────────────────────────
  // Five ribs of an old hull, half-buried on the maze's floor: the region's
  // one human whisper, and the melancholy the deep quarter is keyed to.
  const wreck = buildWreck(random);
  meshes.push(wreck.mesh);
  colliders.push(...wreck.colliders);
  contacts.push(...wreck.contacts);

  // ─── The grotto ──────────────────────────────────────────────────────────
  // A slab leaning over two shoulders at the maze's deepest edge: the roof
  // the Kelp Weaver braids beneath.
  const grottoU = ROOT_MAZE.u + 8;
  const grottoV = ROOT_MAZE.v - 26;
  const grottoPos = worldOf(grottoU, grottoV);
  // The weaver's haunt sits at the grotto's *mouth*, a body-length out
  // from under the slab, so the braid crosses open water where a diver
  // standing off the grotto can actually watch it.
  const grottoMouth = worldOf(grottoU, grottoV + 2.6);
  const grottoY = seabedHeight(grottoPos.x, grottoPos.z);
  for (const [i, side] of [-1, 1].entries()) {
    stand(
      boulderGeometry({ seed: SEED ^ (0x0d01 + i), radius: 1.7, height: 2.6 }),
      grottoU + side * 2.6,
      grottoV - 0.8,
      random.range(0, Math.PI * 2),
      1.7,
      2.6,
    );
  }
  const roof = slabGeometry({ seed: SEED ^ 0x0d03, radius: 3.6, height: 1.4 });
  roof.applyMatrix4(new Matrix4().makeRotationZ(0.16));
  roof.applyMatrix4(new Matrix4().makeRotationY(0.9));
  roof.translate(grottoPos.x, grottoY + 2.5, grottoPos.z - 0.6);
  roof.computeBoundingSphere();
  const roofMesh = new Mesh(roof, mazeStone);
  roofMesh.name = "verdant-grotto-roof";
  roofMesh.castShadow = false;
  roofMesh.receiveShadow = false;
  meshes.push(roofMesh);
  colliders.push({ center: new Vector3(grottoPos.x, grottoY + 3.6, grottoPos.z - 0.6), radius: 2.4 });

  // ─── The Falling Edge pair ───────────────────────────────────────────────
  // Two leaning stones framing the far shelf's view into the painted
  // distance — the last handmade thing before the silhouettes.
  stand(
    stackGeometry(
      [
        { radius: 1.6, rise: 0.8, stretch: 2.0, lean: 0.7 },
        { radius: 1.0, rise: 4.2, stretch: 1.8, lean: 1.5 },
      ],
      { seed: SEED ^ 0x0e01 },
    ),
    600,
    24,
    1.2,
    1.6,
    6.2,
    paleStone,
  );
  stand(
    stackGeometry(
      [
        { radius: 1.4, rise: 0.7, stretch: 1.9, lean: -0.5 },
        { radius: 0.9, rise: 3.6, stretch: 1.7, lean: -1.2 },
      ],
      { seed: SEED ^ 0x0e02 },
    ),
    596,
    9,
    4.3,
    1.4,
    5.4,
    paleStone,
  );

  return {
    meshes,
    colliders,
    contacts,
    grotto: {
      x: grottoMouth.x,
      z: grottoMouth.z,
      y: seabedHeight(grottoMouth.x, grottoMouth.z) + 1.1,
      facing: Math.atan2(-grottoMouth.x, -grottoMouth.z),
    },
  };
}

// ─── The roots' geometry and paint ───────────────────────────────────────────

function rootTube(from: Vector3, to: Vector3, radius: number, random: Random): BufferGeometry {
  const mid = from.clone().lerp(to, 0.5);
  mid.y += random.range(0.2, 0.7);
  mid.x += random.signed(0.5);
  mid.z += random.signed(0.5);
  const curve = new CatmullRomCurve3([from, mid, to]);
  const geometry = new TubeGeometry(curve, 6, radius, 5, false);

  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  const top = Math.max(from.y, to.y);
  const bottom = Math.min(from.y, to.y);
  for (let i = 0; i < position.count; i++) {
    // Sapwood pale at the crown, wine-dark toward the sand, an olive drift
    // along the grain: value first, and the dark end is a colour.
    const t = smoothstep01((position.getY(i) - bottom) / Math.max(0.5, top - bottom));
    shade.copy(ROOT_DARK).lerp(ROOT_LIGHT, t);
    const drift = fbm(position.getX(i) * 0.5, position.getZ(i) * 0.5, {
      seed: 0x5eed ^ 0x0077,
      period: 4,
      octaves: 2,
    });
    shade.lerp(ROOT_OLIVE, drift * 0.5);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

let rootMat: ReturnType<typeof createToonMaterial> | undefined;
function rootMaterial(): ReturnType<typeof createToonMaterial> {
  rootMat ??= createToonMaterial({ vertexColors: true });
  return rootMat;
}

// ─── The wreck ───────────────────────────────────────────────────────────────

function buildWreck(random: Random): {
  mesh: Mesh;
  colliders: SphereCollider[];
  contacts: ContactPatch[];
} {
  const u = ROOT_MAZE.u - 6;
  const v = ROOT_MAZE.v - 12;
  const { x, z } = worldOf(u, v);
  const y = seabedHeight(x, z);
  const yaw = 0.7;
  const parts: BufferGeometry[] = [];

  // Five ribs: half-hoops rising from a buried keel line, tallest amidships.
  for (let i = 0; i < 5; i++) {
    const along = (i - 2) * 1.7;
    const rise = 3.4 - Math.abs(i - 2) * 0.7 + random.signed(0.2);
    const half = 2.3 - Math.abs(i - 2) * 0.3;
    const from = new Vector3(along, -0.5, -half);
    const crown = new Vector3(along + random.signed(0.2), rise, 0);
    const to = new Vector3(along, -0.5, half);
    const rib = new TubeGeometry(new CatmullRomCurve3([from, crown, to]), 10, 0.16, 5, false);
    parts.push(rib);
  }
  // The keel beam, and one fallen rib leaning against it.
  const keel = new TubeGeometry(
    new CatmullRomCurve3([new Vector3(-4.2, 0.1, 0), new Vector3(0, 0.35, 0.2), new Vector3(4.2, 0.05, 0)]),
    8,
    0.24,
    5,
    false,
  );
  parts.push(keel);
  const fallenRib = new TubeGeometry(
    new CatmullRomCurve3([new Vector3(3.2, 0, 1.8), new Vector3(4.6, 1.1, 0.4), new Vector3(5.8, 0, -0.8)]),
    8,
    0.14,
    5,
    false,
  );
  parts.push(fallenRib);

  // Old wood: wine below, silvered drift-grey along the top edges where a
  // century of thin light has bleached it. Round 2 opened the spread —
  // at round 1's values the whole wreck read as one tan mass.
  const wine = new Color(0x54322c);
  const silver = new Color(0xb5b0a2);
  for (const part of parts) {
    const position = part.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    const shade = new Color();
    for (let i = 0; i < position.count; i++) {
      const t = smoothstep01((position.getY(i) - 0.4) / 2.6);
      shade.copy(wine).lerp(silver, t * t);
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }
    part.setAttribute("color", new BufferAttribute(colors, 3));
    part.applyMatrix4(new Matrix4().makeRotationY(yaw));
    part.translate(x, y + 0.2, z);
  }

  const mesh = mergedMesh(parts, rootMaterial(), "verdant-wreck");
  const alongDir = new Vector3(Math.cos(-yaw), 0, Math.sin(-yaw));
  const colliders: SphereCollider[] = [];
  for (const s of [-1.7, 0, 1.7]) {
    colliders.push({
      center: new Vector3(x + alongDir.x * s, y + 1.3, z + alongDir.z * s),
      radius: 1.3,
    });
  }
  return {
    mesh,
    colliders,
    contacts: [{ x, z, radius: 4.4, strength: 0.42 }],
  };
}
