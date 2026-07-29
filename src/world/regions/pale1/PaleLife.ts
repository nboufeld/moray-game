import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  Object3D,
  Points,
  PointsMaterial,
  Vector3,
  type DataTexture,
} from "three";
import { createFishGeometry } from "../../../creatures/fish/FishGeometry";
import { buildColorTexture } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { smoothstep01 } from "./PaleShared";
import { BLOOM_SHELF, recovery, worldOf } from "./PaleTerrain";

/**
 * The Bone Meadows' ambient life — authored to the density gradient that
 * IS the region's story: hushed milk-dust is all the white half owns;
 * the coloured half gets the shoal, the stars, and the petal current.
 *
 * - **Milk dust**: four hundred pale motes over the whole region (one
 *   additive draw) — the white half's only movement, deliberately.
 * - **The blush darters**: a travelling shoal that lives over the
 *   Blooming Shelf and nowhere else — rose-silver held *above* the
 *   water's value (the pilot's round-7/8 lesson: a shaded fish under a
 *   pale key reads as its complement).
 * - **THE PETAL CURRENT** — the moving centrepiece: a slow warm river of
 *   spawn-petals born at the Mother-Coral's crown, flowing back down the
 *   diver's own path — through the Blush Arch's gap, out over the Bone
 *   Forest — hope running the wrong way up the story. Petal cards ride a
 *   seeded closed path; an additive mote stream rides the same curve.
 * - **Floor stars**: bleach-white cushions, four and alone, in the Bone
 *   Forest; rose, gold and lavender crowds in the gardens.
 *
 * Everything draws from `SEED ^` substreams at build; update spends no
 * randomness, so a capture's settle is deterministic.
 */

const SEED = SEEDS.regionPale1;

export interface PaleLifeBuild {
  readonly meshes: (Mesh | Points | InstancedMesh)[];
  update(dt: number, time: number, reducedMotion: boolean): void;
}

export function buildPaleLife(motherCrown: {
  x: number;
  y: number;
  z: number;
}): PaleLifeBuild {
  const meshes: (Mesh | Points | InstancedMesh)[] = [];
  const updaters: ((dt: number, time: number, calm: number) => void)[] = [];

  const dust = buildMilkDust();
  meshes.push(dust.points);
  updaters.push(dust.update);

  const shoal = buildBlushDarters();
  meshes.push(shoal.mesh);
  updaters.push(shoal.update);

  const petals = buildPetalCurrent(motherCrown);
  meshes.push(petals.mesh, petals.stream);
  updaters.push(petals.update);

  meshes.push(buildStars());

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

// ─── The milk dust ───────────────────────────────────────────────────────────

let dustSprite: DataTexture | undefined;
function dustTexture(): DataTexture {
  dustSprite ??= buildColorTexture(32, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const halo = Math.pow(Math.max(0, 1 - d * d), 2.4);
    return [halo * 0.96, halo * 0.97, halo];
  });
  return dustSprite;
}

function buildMilkDust(): {
  points: Points;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x40d5);
  const count = 400;
  const base = new Float32Array(count * 3);
  const live = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const u = random.range(70, 610);
    const v = u < 292 ? random.signed(13) : random.signed(130);
    const { x, z } = worldOf(u, v);
    const floor = seabedHeight(x, z);
    base[i * 3] = x;
    base[i * 3 + 1] = floor + random.range(0.5, 9);
    base[i * 3 + 2] = z;
    phases[i] = random.range(0, Math.PI * 2);
  }
  live.set(base);

  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(live, 3);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  geometry.computeBoundingSphere();

  const material = new PointsMaterial({
    size: 0.07,
    map: dustTexture(),
    transparent: true,
    opacity: 0.42,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new Points(geometry, material);
  points.name = "pale-milk-dust";
  points.frustumCulled = false;

  return {
    points,
    update(_dt: number, time: number, calm: number): void {
      const t = time * calm;
      for (let i = 0; i < count; i++) {
        const p = phases[i]!;
        live[i * 3] = base[i * 3]! + Math.sin(t * 0.09 + p) * 1.3;
        live[i * 3 + 1] = base[i * 3 + 1]! + Math.sin(t * 0.06 + p * 1.7) * 0.8;
        live[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(t * 0.08 + p) * 1.3;
      }
      attribute.needsUpdate = true;
    },
  };
}

// ─── The blush darters ───────────────────────────────────────────────────────

/**
 * The shoal that only lives in the coloured half: fifty-four rose-silver
 * darters riding a seeded ellipse over the Blooming Shelf's beds. Their
 * whole existence is the story's proof — no fish crosses back into the
 * white.
 */
function buildBlushDarters(): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x5a11);
  const count = 54;
  const geometry = createFishGeometry({
    width: 0.9,
    height: 1.0,
    length: 1.0,
    tailTaper: 0.5,
    dorsal: 0.55,
    pectoral: 0.9,
    tail: { reach: 1.45, lobe: 0.62, notch: 1.05 },
  });
  // Bright and warm-rose, held above the milk's value; the emissive keeps
  // a shaded fish its own colour under the pale key.
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x5c4048,
    emissiveIntensity: 0.55,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "pale-blush-darters";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const silver = new Color(0xf2dcd6);
  const offsets: { a: number; r: number; h: number; phase: number; scale: number }[] = [];
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    offsets.push({
      a: random.range(0, Math.PI * 2),
      r: random.range(0, 1),
      h: random.signed(1),
      phase: random.range(0, Math.PI * 2),
      scale: random.range(1.0, 1.4),
    });
    tint.copy(silver).multiplyScalar(random.range(0.88, 1.06));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const dummy = new Object3D();
  const update = (_dt: number, time: number, calm: number): void => {
    const angle = time * calm * 0.05 * Math.PI * 2;
    for (const [i, o] of offsets.entries()) {
      const a = angle + o.a * 0.24;
      const u = BLOOM_SHELF.u + Math.cos(a) * 38 * (0.8 + o.r * 0.26);
      const v = BLOOM_SHELF.v + Math.sin(a) * 28 * (0.8 + o.r * 0.26);
      const { x, z } = worldOf(u, v);
      const y =
        seabedHeight(x, z) + 4.4 + Math.sin(time * calm * 0.5 + o.phase) * 1.0 + o.h * 1.2;
      dummy.position.set(x, y, z);
      const from = worldOf(u, v);
      const to = worldOf(u - Math.sin(a) * 0.46, v + Math.cos(a) * 0.34);
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

// ─── The petal current ───────────────────────────────────────────────────────

/**
 * The region's moving centrepiece: petals of coral spawn born at the
 * mother's crown, drifting one slow authored river back toward the white
 * world — through the blush, under the arch's shoulder, dying out over
 * the Bone Forest where the water is still too quiet for them. A diver
 * swimming the story meets the current head-on the whole way in.
 */
function buildPetalCurrent(motherCrown: { x: number; y: number; z: number }): {
  mesh: InstancedMesh;
  stream: Points;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x9e7a);

  // The river's stations, spoke → world, sagging toward the sand as it
  // goes — spawn settles where it will seed.
  const stations: [number, number, number][] = [
    [558, 38, 11.2],
    [540, 24, 8.6],
    [520, 8, 7.4],
    [498, -2, 6.2],
    [476, -6, 5.4],
    [456, -5, 5.0],
    [432, -8, 4.2],
    [404, -10, 3.4],
    [372, -12, 2.6],
    [344, -10, 1.8],
  ];
  const points: Vector3[] = [];
  for (const [i, [u, v, lift]] of stations.entries()) {
    const { x, z } = worldOf(u, v);
    const y = i === 0 ? motherCrown.y : seabedHeight(x, z) + lift;
    points.push(new Vector3(x, y, z));
  }
  const path = new CatmullRomCurve3(points, false, "centripetal", 0.5);

  const count = 140;
  const petal = new CircleGeometry(0.16, 5);
  petal.scale(1, 0.6, 1);
  // The whisper of emissive keeps a petal rose when the toon shade takes
  // its lit side away: round 1's petals fell under the water's value and
  // the eye read the complement — orange-red confetti instead of spawn.
  const material = createToonMaterial({
    color: 0xffffff,
    side: DoubleSide,
    emissive: 0x6b3b44,
    emissiveIntensity: 0.55,
  });
  const mesh = new InstancedMesh(petal, material, count);
  mesh.name = "pale-petal-current";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const petalTints = [0xf6ccd6, 0xf2ddb6, 0xecb3c2, 0xf8ece2] as const;
  const tint = new Color();
  const rides: { offset: number; lateral: number; phase: number; spin: number; scale: number }[] =
    [];
  for (let i = 0; i < count; i++) {
    rides.push({
      offset: random.next(),
      lateral: random.signed(1.6),
      phase: random.range(0, Math.PI * 2),
      spin: random.range(0.5, 1.3),
      scale: random.range(0.7, 1.3),
    });
    tint.setHex(petalTints[i % petalTints.length]!).multiplyScalar(random.range(0.9, 1.08));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  // The stream: a faint warm gauze of spawn-light along the same river,
  // so the current reads at forty metres before a single petal resolves.
  const streamCount = 220;
  const streamBase = new Float32Array(streamCount * 3);
  const streamLive = new Float32Array(streamCount * 3);
  const streamPhase = new Float32Array(streamCount);
  const at = new Vector3();
  const streamRandom = new Random(SEED ^ 0x9e7b);
  for (let i = 0; i < streamCount; i++) {
    path.getPointAt(streamRandom.next(), at);
    streamBase[i * 3] = at.x + streamRandom.signed(2.0);
    streamBase[i * 3 + 1] = at.y + streamRandom.signed(1.2);
    streamBase[i * 3 + 2] = at.z + streamRandom.signed(2.0);
    streamPhase[i] = streamRandom.range(0, Math.PI * 2);
  }
  streamLive.set(streamBase);
  const streamGeometry = new BufferGeometry();
  const streamAttribute = new BufferAttribute(streamLive, 3);
  streamAttribute.setUsage(DynamicDrawUsage);
  streamGeometry.setAttribute("position", streamAttribute);
  streamGeometry.computeBoundingSphere();
  const streamMaterial = new PointsMaterial({
    size: 0.12,
    map: warmSprite(),
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const stream = new Points(streamGeometry, streamMaterial);
  stream.name = "pale-petal-stream";
  stream.frustumCulled = false;

  const dummy = new Object3D();
  const ahead = new Vector3();
  const side = new Vector3();
  const up = new Vector3(0, 1, 0);

  const update = (_dt: number, time: number, calm: number): void => {
    const head = time * calm * 0.008;
    for (const [i, ride] of rides.entries()) {
      const s = (head + ride.offset) % 1;
      path.getPointAt(s, at);
      path.getPointAt(Math.min(1, s + 0.01), ahead);
      side.subVectors(ahead, at).cross(up).normalize();
      at.addScaledVector(side, ride.lateral * (0.6 + s * 0.8));
      at.y += Math.sin(time * calm * 0.4 + ride.phase) * 0.5;
      // Petals are born small at the crown, ride full, and thin out at
      // the river's dying end over the bones.
      const life = smoothstep01(s / 0.06) * (1 - smoothstep01((s - 0.86) / 0.14));
      dummy.position.copy(at);
      dummy.rotation.set(time * calm * ride.spin, ride.phase, time * calm * ride.spin * 0.6);
      dummy.scale.setScalar(Math.max(0.001, ride.scale * life));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const t = time * calm;
    for (let i = 0; i < streamCount; i++) {
      const p = streamPhase[i]!;
      streamLive[i * 3] = streamBase[i * 3]! + Math.sin(t * 0.12 + p) * 0.8;
      streamLive[i * 3 + 1] = streamBase[i * 3 + 1]! + Math.sin(t * 0.09 + p * 1.7) * 0.5;
      streamLive[i * 3 + 2] = streamBase[i * 3 + 2]! + Math.cos(t * 0.1 + p) * 0.8;
    }
    streamAttribute.needsUpdate = true;
  };
  update(0, 0, 1);
  return { mesh, stream, update };
}

let warmSpriteTexture: DataTexture | undefined;
function warmSprite(): DataTexture {
  warmSpriteTexture ??= buildColorTexture(32, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const halo = Math.pow(Math.max(0, 1 - d * d), 2.2);
    return [halo, halo * 0.78, halo * 0.7];
  });
  return warmSpriteTexture;
}

// ─── The floor stars ─────────────────────────────────────────────────────────

/** A five-lobed cushion star, domed, tips lifted — the pilot's idiom. */
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
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i)) / 0.5;
    const value = 0.72 + smoothstep01((r - 0.35) / 0.55) * 0.42;
    colors[i * 3] = value;
    colors[i * 3 + 1] = value;
    colors[i * 3 + 2] = value * 0.94;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/**
 * The stars are the gradient at ankle height: four bleach-white loners
 * in the Bone Forest — survivors — and a rose-gold-lavender crowd of
 * twenty-two through the gardens and the grove's rim.
 */
function buildStars(): InstancedMesh {
  const random = new Random(SEED ^ 0x57a9);
  const geometry = starGeometry();
  const material = createToonMaterial({ vertexColors: true });
  const count = 26;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "pale-stars";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const bloomPalette = [0xd9788f, 0xdcb066, 0x9f86c9];
  const dummy = new Object3D();
  const tint = new Color();
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < 300) {
    attempts++;
    const white = placed < 4;
    const u = white ? random.range(310, 400) : random.range(460, 610);
    const v = white ? -16 + random.signed(70) : random.signed(120);
    if (!white && recovery(u, v) < 0.3) {
      continue;
    }
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) + 0.02, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(random.range(0.7, 1.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    if (white) {
      tint.setHex(0xe9e6de).multiplyScalar(random.range(0.92, 1.05));
    } else {
      tint
        .setHex(bloomPalette[placed % bloomPalette.length]!)
        .multiplyScalar(random.range(0.85, 1.15));
    }
    mesh.setColorAt(placed, tint);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}
