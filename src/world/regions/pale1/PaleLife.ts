import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  Object3D,
  Points,
  PointsMaterial,
  Vector3,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createFishGeometry } from "../../../creatures/fish/FishGeometry";
import { buildColorTexture } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildParticulateField } from "../kit/ParticulateField";
import { buildPercherColony } from "../kit/PercherColony";
import { buildShoalRunner } from "../kit/ShoalRunner";
import type { KitBuild } from "../kit/KitTypes";
import { smoothstep01 } from "./PaleShared";
import {
  FILL_SEEDS,
  GALLERY_COLUMN_AT,
  RAVINE_DUST_U,
  aisleAt,
} from "./PaleFillShared";
import {
  BLOOM_SHELF,
  SEED_GROVE,
  ravineChannelCenter,
  recovery,
  worldOf,
} from "./PaleTerrain";

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
  readonly groups: Group[];
  update(dt: number, time: number, reducedMotion: boolean): void;
}

/**
 * The hush-fry's loop, as data: over the lip, up the forest aisle to the
 * gallery's EDGE and back down the aisle's far side. Deliberately
 * trimmed against the registry (MASTER R10 — stillness beats cadence):
 * the plan's "ravine mouth → lip" leg would cross THE RAVINE HUSH
 * (u 130–210), so the loop turns at u 214; and it skirts the Quiet
 * Gallery instead of entering it. Exported so the tests and the build
 * read one truth.
 */
export function hushFryStations(): [number, number, number][] {
  const spoke: [number, number, number][] = [
    [214, ravineChannelCenter(214), 2.2],
    [240, ravineChannelCenter(240), 2.6],
    [262, ravineChannelCenter(262) - 1, 2.4],
    [284, -2, 2.8],
    [308, aisleAt(308), 3.0],
    [340, aisleAt(340), 3.0],
    [372, 26, 3.2],
    [398, aisleAt(398), 2.8],
    [425, aisleAt(425), 2.6],
    [430, aisleAt(430) - 10, 2.4],
    [396, -20, 2.6],
    [358, -24, 2.8],
    [322, -14, 2.6],
    [294, -5, 2.4],
    [270, ravineChannelCenter(270) + 2, 2.2],
    [240, ravineChannelCenter(240) + 2.5, 2.8],
    [218, ravineChannelCenter(218) + 2, 2.5],
  ];
  return spoke.map(([u, v, lift]) => {
    const { x, z } = worldOf(u, v);
    return [x, seabedHeight(x, z) + lift, z];
  });
}

export function buildPaleLife(
  motherCrown: { x: number; y: number; z: number },
  archCrown: { x: number; y: number; z: number },
  treeSpots: readonly { x: number; z: number; height: number }[],
): PaleLifeBuild {
  const meshes: (Mesh | Points | InstancedMesh)[] = [];
  const groups: Group[] = [];
  const updaters: ((dt: number, time: number, calm: number) => void)[] = [];
  const keep = (build: KitBuild & { update?(timeSec: number): void }): void => {
    groups.push(build.group);
    if (build.update) {
      const update = build.update.bind(build);
      updaters.push((_dt, time, calm) => update(time * calm));
    }
  };

  const dust = buildMilkDust();
  meshes.push(dust.points);
  updaters.push(dust.update);

  const shoal = buildBlushDarters();
  meshes.push(shoal.mesh);
  updaters.push(shoal.update);

  const petals = buildPetalCurrent(motherCrown, archCrown);
  meshes.push(petals.mesh, petals.stream);
  updaters.push(petals.update);

  meshes.push(buildStars());

  // ─── The hush-fry (kit shoalRunner) — life as wayfinding ─────────────────
  // Bone-pale, tiny, a breath above the milk's value and deliberately
  // near-colourless: the white half's life is quiet. Meeting it head-on
  // at the lip or the aisle crossing tells the diver the road.
  keep(
    buildShoalRunner({
      seed: SEED ^ FILL_SEEDS.hushFry,
      route: { stations: hushFryStations(), closed: true },
      count: 40,
      fish: { scale: 0.55, color: 0xe8e6da, emissive: 0x4a4842, profile: "fry" },
      phaseSpeed: 0.009,
      braid: { lateral: 0.26, vertical: 0.18 },
    }),
  );

  // ─── The porcelain brittle-stars (kit percherColony, exclusive body) ─────
  // One geometry, two tints (fill plan §6b-4): bone-white perchers on the
  // dead trunks; a rose variant grazing the shelf's beds.
  {
    const anchorRandom = new Random(SEED ^ FILL_SEEDS.brittleWhite ^ 0x0a);
    const trunkAnchors: { pos: readonly [number, number, number] }[] = [];
    const stride = Math.max(1, Math.floor(treeSpots.length / 15));
    for (let i = 0; i < treeSpots.length && trunkAnchors.length < 15; i += stride) {
      const tree = treeSpots[i]!;
      const foot = seabedHeight(tree.x, tree.z);
      trunkAnchors.push({
        pos: [
          tree.x + anchorRandom.signed(0.4),
          foot + tree.height * anchorRandom.range(0.2, 0.45),
          tree.z + anchorRandom.signed(0.4),
        ],
      });
    }
    keep(
      buildPercherColony({
        seed: SEED ^ FILL_SEEDS.brittleWhite,
        palette: { base: 0xf3efe2, tip: 0xfdfbf2, shade: 0xa898b8 },
        anchors: trunkAnchors,
        perAnchor: 3,
        body: brittleStarGeometry(),
        motion: "seated",
      }),
    );
  }
  {
    const anchorRandom = new Random(SEED ^ FILL_SEEDS.brittleRose ^ 0x0a);
    const bedAnchors: { pos: readonly [number, number, number] }[] = [];
    for (const [bu, bv] of [
      [518, -48],
      [532, -62],
      [545, -45],
      [509, -30],
      [508, -6],
      [494, 30],
      [524, -40],
      [538, -54],
    ] as const) {
      const { x, z } = worldOf(bu + anchorRandom.signed(3), bv + anchorRandom.signed(3));
      bedAnchors.push({ pos: [x, seabedHeight(x, z) + 0.04, z] });
    }
    keep(
      buildPercherColony({
        seed: SEED ^ FILL_SEEDS.brittleRose,
        palette: { base: 0xecafc0, tip: 0xf8d8da, shade: 0xa8688c },
        anchors: bedAnchors,
        perAnchor: 3,
        body: brittleStarGeometry(),
        motion: "seated",
      }),
    );
  }

  // ─── The midges (kit particulateField) — small liveliness in colour ──────
  keep(
    buildParticulateField({
      seed: SEED ^ FILL_SEEDS.midgesBlush,
      tint: 0xe8cfa0,
      count: 60,
      mode: "drift",
      volume: (() => {
        const at = worldOf(465, -4);
        return {
          center: [at.x, seabedHeight(at.x, at.z) + 2.6, at.z] as const,
          size: [70, 4, 44] as const,
        };
      })(),
      size: 0.06,
      opacity: 0.4,
    }),
  );
  keep(
    buildParticulateField({
      seed: SEED ^ FILL_SEEDS.midgesNursery,
      tint: 0xf0d6c4,
      count: 44,
      mode: "drift",
      volume: (() => {
        const at = worldOf(SEED_GROVE.u + 6, SEED_GROVE.v - 6);
        return {
          center: [at.x, seabedHeight(at.x, at.z) + 3.2, at.z] as const,
          size: [36, 4, 36] as const,
        };
      })(),
      size: 0.06,
      opacity: 0.4,
    }),
  );

  // ─── The chalk dust blooms (kit particulateField, column mode) ───────────
  // The hush's one movement (plan ● 145) and the gallery column's body.
  keep(
    buildParticulateField({
      seed: SEED ^ FILL_SEEDS.dustRavine,
      tint: 0xf2efe6,
      count: 110,
      mode: "column",
      volume: (() => {
        const at = worldOf(RAVINE_DUST_U, ravineChannelCenter(RAVINE_DUST_U));
        return {
          center: [at.x, seabedHeight(at.x, at.z) + 4, at.z] as const,
          size: [4.5, 8, 4.5] as const,
        };
      })(),
      size: 0.09,
      opacity: 0.4,
    }),
  );
  keep(
    buildParticulateField({
      seed: SEED ^ FILL_SEEDS.dustGallery,
      tint: 0xf4f2ea,
      count: 130,
      mode: "column",
      volume: (() => {
        const at = worldOf(GALLERY_COLUMN_AT.u, GALLERY_COLUMN_AT.v);
        return {
          center: [at.x, seabedHeight(at.x, at.z) + 8, at.z] as const,
          size: [6, 15, 6] as const,
        };
      })(),
      size: 0.1,
      opacity: 0.32,
    }),
  );

  return {
    meshes,
    groups,
    update(dt: number, time: number, reducedMotion: boolean): void {
      const calm = reducedMotion ? 0.45 : 1;
      for (const update of updaters) {
        update(dt, time, calm);
      }
    },
  };
}

// ─── The porcelain brittle-star (region body fed to the kit — MASTER R8) ────

/**
 * A thin five-armed brittle-star, nothing like the cushion stars: a small
 * central disc and slender tapered arms with lifted tips. ~80 tris. The
 * disc holds the tone; the arm tips catch the water light.
 */
function brittleStarGeometry(): BufferGeometry {
  const disc = new IcosahedronGeometry(0.05, 0);
  disc.scale(1, 0.42, 1);
  const parts: BufferGeometry[] = [disc.toNonIndexed()];
  disc.dispose();
  for (let arm = 0; arm < 5; arm++) {
    const angle = (arm / 5) * Math.PI * 2;
    const limb = new BoxGeometry(0.19, 0.014, 0.022).toNonIndexed();
    const position = limb.attributes.position as BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const t = Math.min(1, Math.max(0, (x + 0.095) / 0.19));
      // Taper toward the tip, wave sideways, lift the last third.
      position.setZ(i, position.getZ(i) * (1 - t * 0.6) + Math.sin(t * 5.2 + arm) * 0.016);
      position.setY(i, position.getY(i) + t * t * 0.028);
    }
    position.needsUpdate = true;
    limb.translate(0.12, 0.012, 0);
    limb.rotateY(angle);
    parts.push(limb);
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("pale brittle-star parts could not be merged");
  }
  smoothNormals(merged);
  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i)) / 0.28;
    const value = 0.7 + smoothstep01((r - 0.2) / 0.6) * 0.36;
    colors[i * 3] = value;
    colors[i * 3 + 1] = value * 0.96;
    colors[i * 3 + 2] = value;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  return merged;
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
  const count = 62;
  const geometry = createFishGeometry({
    width: 0.9,
    height: 1.0,
    length: 1.0,
    tailTaper: 0.5,
    dorsal: 0.55,
    pectoral: 0.9,
    tail: { reach: 1.45, lobe: 0.62, notch: 1.05 },
  });
  // Warm rose-gold with a real emissive: round 4's paler silver sat at
  // the milk's own value and the whole shoal dissolved — a fish the fog
  // can erase is a fish that is not there.
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x6b4438,
    emissiveIntensity: 0.6,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "pale-blush-darters";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const silver = new Color(0xefb992);
  const offsets: { a: number; r: number; h: number; phase: number; scale: number }[] = [];
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    offsets.push({
      a: random.range(0, Math.PI * 2),
      r: random.range(0, 1),
      h: random.signed(1),
      phase: random.range(0, Math.PI * 2),
      scale: random.range(1.2, 1.6),
    });
    tint.copy(silver).multiplyScalar(random.range(0.88, 1.06));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const dummy = new Object3D();
  // The Gardener's escort (fill plan §5): twelve fish detach from the
  // shoal each lap and circle the walking garden before rejoining —
  // the two coloured landmarks tied together by the life system.
  const gardenerAt = worldOf(492, 26);
  const escortSize = 12;
  const post = (
    o: { a: number; r: number; h: number; phase: number },
    index: number,
    time: number,
    calm: number,
    out: { x: number; y: number; z: number },
  ): void => {
    const angle = time * calm * 0.05 * Math.PI * 2;
    const a = angle + o.a * 0.24;
    const u = BLOOM_SHELF.u + Math.cos(a) * 38 * (0.8 + o.r * 0.26);
    const v = BLOOM_SHELF.v + Math.sin(a) * 28 * (0.8 + o.r * 0.26);
    const { x, z } = worldOf(u, v);
    let px = x;
    let pz = z;
    let py = seabedHeight(x, z) + 4.4 + Math.sin(time * calm * 0.5 + o.phase) * 1.0 + o.h * 1.2;
    if (index < escortSize) {
      // The detach: a smooth window of each lap spent on a tight ring
      // over the Gardener's round, closed-form off the same clock.
      const lap = (time * calm * 0.05 + o.phase / (Math.PI * 2)) % 1;
      const blend =
        smoothstep01((lap - 0.12) / 0.1) * (1 - smoothstep01((lap - 0.62) / 0.12));
      if (blend > 0) {
        const ring = time * calm * 0.4 + o.a;
        const gx = gardenerAt.x + Math.cos(ring) * 5.4;
        const gz = gardenerAt.z + Math.sin(ring) * 5.4;
        const gy = seabedHeight(gx, gz) + 2.6 + Math.sin(ring * 2) * 0.5;
        px += (gx - px) * blend;
        py += (gy - py) * blend;
        pz += (gz - pz) * blend;
      }
    }
    out.x = px;
    out.y = py;
    out.z = pz;
  };
  const here = { x: 0, y: 0, z: 0 };
  const next = { x: 0, y: 0, z: 0 };
  const update = (_dt: number, time: number, calm: number): void => {
    for (const [i, o] of offsets.entries()) {
      post(o, i, time, calm, here);
      post(o, i, time + 0.6, calm, next);
      dummy.position.set(here.x, here.y, here.z);
      dummy.rotation.set(0, Math.atan2(next.x - here.x, next.z - here.z), 0);
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
function buildPetalCurrent(
  motherCrown: { x: number; y: number; z: number },
  archCrown: { x: number; y: number; z: number },
): {
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

  // Fill round: 140 → 300 petals, wider and larger — the audit read the
  // centrepiece as "~12 pink flecks, not a river". The first 140 rides
  // draw exactly as before (appended draws only — the fence's idiom),
  // and two satellite eddies join on a fresh stream: a tight loop
  // through the Blush Arch's doorway and a slow circle at the grove's
  // rim gate.
  const riverCount = 300;
  const eddyCount = 20;
  const count = riverCount + eddyCount * 2;
  const petal = new CircleGeometry(0.2, 5);
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

  interface PetalRide {
    readonly mode: "river" | "arch" | "rim";
    readonly offset: number;
    readonly lateral: number;
    readonly phase: number;
    readonly spin: number;
    readonly scale: number;
  }

  const petalTints = [0xf6ccd6, 0xf2ddb6, 0xecb3c2, 0xf8ece2] as const;
  const tint = new Color();
  const rides: PetalRide[] = [];
  for (let i = 0; i < riverCount; i++) {
    rides.push({
      mode: "river",
      offset: random.next(),
      lateral: random.signed(2.4),
      phase: random.range(0, Math.PI * 2),
      spin: random.range(0.5, 1.3),
      scale: random.range(0.7, 1.3),
    });
    tint.setHex(petalTints[i % petalTints.length]!).multiplyScalar(random.range(0.9, 1.08));
    mesh.setColorAt(i, tint);
  }
  const eddyRandom = new Random(SEED ^ FILL_SEEDS.petalEddies);
  for (const mode of ["arch", "rim"] as const) {
    for (let i = 0; i < eddyCount; i++) {
      rides.push({
        mode,
        offset: eddyRandom.next(),
        lateral: eddyRandom.signed(0.5),
        phase: eddyRandom.range(0, Math.PI * 2),
        spin: eddyRandom.range(0.5, 1.3),
        scale: eddyRandom.range(0.6, 1.0),
      });
      tint
        .setHex(petalTints[rides.length % petalTints.length]!)
        .multiplyScalar(eddyRandom.range(0.9, 1.08));
      mesh.setColorAt(rides.length - 1, tint);
    }
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  // The eddy anchors: through the arch doorway (a vertical loop in the
  // plane crossing the gap) and a flat circle at the grove's rim gate.
  const archEddy = {
    x: archCrown.x,
    y: archCrown.y - 1.1,
    z: archCrown.z,
    dirX: 0.912,
    dirZ: 0.409,
    radius: 1.6,
  };
  const rimGate = (() => {
    const at = worldOf(548, 31);
    return { x: at.x, y: seabedHeight(at.x, at.z) + 2.2, z: at.z, radius: 1.9 };
  })();

  // The stream: a faint warm gauze of spawn-light along the same river,
  // so the current reads at forty metres before a single petal resolves.
  // Fill round: 220 → 420 — the gauze is most of the "visible warm
  // drift" read at range.
  const streamCount = 420;
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
    size: 0.15,
    map: warmSprite(),
    transparent: true,
    opacity: 0.55,
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
      let life = 1;
      if (ride.mode === "river") {
        const s = (head + ride.offset) % 1;
        path.getPointAt(s, at);
        path.getPointAt(Math.min(1, s + 0.01), ahead);
        side.subVectors(ahead, at).cross(up).normalize();
        at.addScaledVector(side, ride.lateral * (0.6 + s * 0.8));
        at.y += Math.sin(time * calm * 0.4 + ride.phase) * 0.5;
        // Petals are born small at the crown, ride full, and thin out at
        // the river's dying end over the bones.
        life = smoothstep01(s / 0.06) * (1 - smoothstep01((s - 0.86) / 0.14));
      } else if (ride.mode === "arch") {
        // The doorway eddy: a vertical circle crossing the arch's gap —
        // under the beam, over the crown, around again.
        const a = (head * 9 + ride.offset) * Math.PI * 2;
        at.set(
          archEddy.x + Math.cos(a) * archEddy.radius * archEddy.dirX + ride.lateral * 0.4,
          archEddy.y + Math.sin(a) * archEddy.radius,
          archEddy.z + Math.cos(a) * archEddy.radius * archEddy.dirZ + ride.lateral * 0.4,
        );
      } else {
        // The rim-gate eddy: a slow flat circle where the hedges frame
        // the bowl's entry.
        const a = (head * 7 + ride.offset) * Math.PI * 2;
        at.set(
          rimGate.x + Math.cos(a) * rimGate.radius,
          rimGate.y + Math.sin(a * 2 + ride.phase) * 0.4,
          rimGate.z + Math.sin(a) * rimGate.radius,
        );
      }
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
 * The stars are the gradient at ankle height: ten bleach-white loners
 * in the Bone Forest — survivors (fill round: four → ten) — and a
 * rose-gold-lavender crowd of forty through the gardens and the grove's
 * rim (fill round: twenty-two → forty; plan §5 "every surface type owns
 * one small liver").
 */
function buildStars(): InstancedMesh {
  const random = new Random(SEED ^ 0x57a9);
  const geometry = starGeometry();
  const material = createToonMaterial({ vertexColors: true });
  const count = 50;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "pale-stars";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const bloomPalette = [0xd9788f, 0xdcb066, 0x9f86c9];
  const dummy = new Object3D();
  const tint = new Color();
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < 600) {
    attempts++;
    const white = placed < 10;
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
