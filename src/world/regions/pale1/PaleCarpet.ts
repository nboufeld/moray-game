import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Object3D,
  OctahedronGeometry,
  type BufferGeometry,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildCarpetField, type CarpetFieldBuild } from "../kit/CarpetField";
import { buildGroundLitter } from "../kit/GroundLitter";
import type { GateFn, KitArea, KitBuild } from "../kit/KitTypes";
import { buildScreeApron } from "../kit/ScreeApron";
import type { PaleScreeAnchor } from "./PaleBones";
import { smoothstep01 } from "./PaleShared";
import { FILL_SEEDS, hushFree, t1Free } from "./PaleFillShared";
import {
  BLOOM_SHELF,
  BONE_FOREST,
  RAVINE_TO,
  SEED_GROVE,
  bloomWeight,
  boneForestWeight,
  groveWeight,
  paleWeight,
  ravineChannelCenter,
  ravineChannelHalf,
  recovery,
  spokeOf,
  worldOf,
} from "./PaleTerrain";

/**
 * The Bone Meadows' T1/T2 ground voice — BONE GRAVEL, NOT CLUTTER (fill
 * plan §3), spent as kit calls plus the region's exclusive shapes:
 *
 * - **bone-gravel runs** down the ravine channel (kit `groundLitter`,
 *   two bone tones), stopping dead through the Ravine Hush (u 130–210 —
 *   the registry rest; the dust bloom carries it).
 * - **chalk shard drifts** between the stairs slabs, tightening the
 *   reveal cadence from ~26 m to ~13 m.
 * - **the descent shard-field** (u ≈ 282): broken plates raked downslope
 *   from the lip, pointing at the forest.
 * - **the false-spring trace** (u 48–68, MASTER R6): a dying run of
 *   blush-tinted gravel out of the wing's returning colour, hush by 70.
 * - **THE OSSUARY CARPET** — the region's signature exclusive (MASTER
 *   R8): vertebra knuckles and branch fragments, custom geometry fed
 *   through kit `groundLitter`, carrying the violet-crotch → paper-tip
 *   ramp; dense under the Bone Forest's trees and the cathedral's crown,
 *   gated to `recovery < 0.3`.
 * - **bone grit** over the whole disc — the doctrine's "no square metre
 *   bare by accident" base floor, two bone tones.
 * - **bone stumps** — low hollow tube-coral stubs, the white half's
 *   standing layer (the verdant sweep's F-R3 lesson: a flank pose needs
 *   something that STANDS in its first 35 m, so the plan's forest-only
 *   60–90 grew into a disc-wide family).
 * - **blush gravel** across the First Blush (bone base, pink second
 *   tone), **rose-gold turf** on the Blooming Shelf, **rose turf** on
 *   the grove's rim, **bed-foot rubble** under the authored gardens.
 * - **scree aprons** (kit `screeApron`) seated at every stairs slab,
 *   jamb, ledge, arch leg and the cathedral: things grow FROM somewhere.
 *   (The Quiet Gallery's monuments get NO aprons — the pan is registry
 *   stillness; its fix is value and monument surface, plus the plan's
 *   sanctioned threshold-plate path, built in PaleBones.)
 *
 * Every call takes a fresh `SEEDS.regionPale1 ^ FILL_SEEDS.*` stream
 * (the reroll fence) and multiplies {@link t1Free} into its gate so the
 * Quiet Gallery, the Mother's Pool, the lip crest and the aisle stay
 * composed. Contact-free by construction: ankle scenery, no colliders.
 */

const SEED = SEEDS.regionPale1;

export interface PaleCarpetBuild {
  readonly groups: Group[];
  readonly meshes: InstancedMesh[];
  update(timeSec: number): void;
}

/** The ravine channel as a kit road area, stations every ~14 m of spoke. */
function channelArea(fromU: number, toU: number, width: number): KitArea {
  const polyline: [number, number][] = [];
  for (let u = fromU; u <= toU; u += 14) {
    const { x, z } = worldOf(u, ravineChannelCenter(u));
    polyline.push([x, z]);
  }
  return { polyline, width };
}

/** The blush band as a road up the spine. */
function blushArea(): KitArea {
  const polyline: [number, number][] = [];
  for (const u of [398, 436, 474, 512]) {
    const { x, z } = worldOf(u, 0);
    polyline.push([x, z]);
  }
  return { polyline, width: 170 };
}

function discAreaAt(u: number, v: number, radius: number): KitArea {
  const { x, z } = worldOf(u, v);
  return { center: [x, z], radius };
}

// ─── The gates ───────────────────────────────────────────────────────────────

/** Gravel holds the channel floor and its low banks; the hush stays bare. */
const ravineGravelGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 64 || u > 290) {
    return 0;
  }
  const away = Math.abs(v - ravineChannelCenter(u));
  const inChannel = 1 - smoothstep01((away - ravineChannelHalf(u)) / 5);
  const start = smoothstep01((u - 66) / 6);
  return inChannel * start * hushFree(u) * t1Free(x, z);
};

/** The stairs drifts: chunkier plates on the channel's shoulders. */
const shardDriftGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 78 || u > 262) {
    return 0;
  }
  const away = Math.abs(v - ravineChannelCenter(u));
  const shoulder =
    smoothstep01((away - 2) / 2.5) * (1 - smoothstep01((away - ravineChannelHalf(u) - 6) / 4));
  return shoulder * hushFree(u) * t1Free(x, z);
};

/** The descent fan: over the lip, spilling toward the treeline. */
const descentGate: GateFn = (x, z) => {
  const { u } = spokeOf(x, z);
  return smoothstep01((u - 270) / 6) * (1 - smoothstep01((u - 298) / 8)) * t1Free(x, z);
};

/** The false spring dies by u 68 — colour tried to follow the diver in. */
const falseSpringGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 46 || u > 72) {
    return 0;
  }
  const away = Math.abs(v - ravineChannelCenter(u));
  const inChannel = 1 - smoothstep01((away - ravineChannelHalf(u) - 1) / 4);
  return inChannel * (1 - smoothstep01((u - 58) / 10)) * t1Free(x, z);
};

/** The base grit floor: the whole disc, leaning white, off the ravine. */
const gritGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < RAVINE_TO) {
    return 0;
  }
  const k = recovery(u, v);
  const whiteLean = 1 - smoothstep01((k - 0.35) / 0.45) * 0.75;
  return (
    paleWeight(x, z) *
    whiteLean *
    (1 - boneForestWeight(u, v) * 0.6) *
    (1 - groveWeight(u, v)) *
    t1Free(x, z)
  );
};

/** The ossuary: dense in the forest, dead past recovery 0.3. */
const ossuaryGate =
  (treeSpots: readonly { x: number; z: number; height: number }[]): GateFn =>
  (x, z) => {
    const { u, v } = spokeOf(x, z);
    const forest = boneForestWeight(u, v);
    if (forest <= 0.05) {
      return 0;
    }
    const k = recovery(u, v);
    const alive = 1 - smoothstep01((k - 0.18) / 0.12);
    // Root litter: the carpet crowds every tree's foot, so the thickets
    // read grown, not placed (the audit's bone-forest miss). Round 2:
    // reach and base floor both up — the r1 forest floor was too polite.
    let treeBoost = 0;
    for (const tree of treeSpots) {
      const d = Math.hypot(x - tree.x, z - tree.z);
      if (d < tree.height * 0.75) {
        treeBoost = Math.max(treeBoost, 1 - d / (tree.height * 0.75));
      }
    }
    // The cathedral's ossuary floor: a 10 m vertebra carpet (plan ● 352).
    const cathedral = worldOf(352, -34);
    const underCrown = 1 - smoothstep01((Math.hypot(x - cathedral.x, z - cathedral.z) - 5) / 8);
    return (
      forest * alive * Math.min(1, 0.45 + treeBoost * 0.55 + underCrown * 0.8) * t1Free(x, z)
    );
  };

/** Blush gravel: the freckle band drawn as stones, thinning both ways. */
const blushGravelGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const k = recovery(u, v);
  const band = smoothstep01((k - 0.04) / 0.1) * (1 - smoothstep01((k - 0.6) / 0.3));
  return band * (1 - bloomWeight(u, v) * 0.55) * paleWeight(x, z) * t1Free(x, z);
};

/** The shelf's rose-gold turf, thickening with the gardens. */
const shelfTurfGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const k = recovery(u, v);
  return bloomWeight(u, v) * smoothstep01((k - 0.3) / 0.35) * paleWeight(x, z) * t1Free(x, z);
};

/** The grove's bowl turf: dense at the rim, bare at the pool's heart. */
const groveTurfGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const grove = groveWeight(u, v);
  if (grove <= 0.05) {
    return 0;
  }
  const d = Math.hypot(u - SEED_GROVE.u, v - SEED_GROVE.v);
  return grove * smoothstep01((d - 9) / 6) * (1 - smoothstep01((d - 36) / 8)) * t1Free(x, z);
};

/** Rubble hugs the authored beds' feet — gardens grow FROM the rubble. */
const AUTHORED_BEDS: readonly (readonly [number, number])[] = [
  [518, -48],
  [532, -62],
  [545, -45],
  [509, -30],
  [508, -6],
  [494, 30],
];
const bedRubbleGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  let near = 0;
  for (const [bu, bv] of AUTHORED_BEDS) {
    const d = Math.hypot(u - bu, v - bv);
    near = Math.max(near, 1 - smoothstep01((d - 4) / 5));
  }
  return near * t1Free(x, z);
};

// ─── The exclusive shapes ────────────────────────────────────────────────────

/** The bone ramp all ossuary shapes carry: violet crotch, paper tip —
 *  vertex colours darken below the instance hue only (kit law 3). */
function bakeBoneRamp(geometry: BufferGeometry, low: number, high: number): void {
  const position = geometry.attributes.position as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = smoothstep01((position.getY(i) - low) / (high - low));
    const value = 0.62 + t * 0.38;
    colors[i * 3] = value * (1 - (1 - t) * 0.1);
    colors[i * 3 + 1] = value * (1 - (1 - t) * 0.24);
    colors[i * 3 + 2] = value;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** A vertebra knuckle: a squat bipyramid pinched at the waist. 8 tris. */
function vertebraGeometry(): BufferGeometry {
  const geometry = new OctahedronGeometry(0.5, 0).toNonIndexed();
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (Math.abs(y) < 0.05) {
      // The waist between the two end plates.
      position.setXYZ(i, x * 0.72, y, z * 0.72);
    } else {
      position.setXYZ(i, x, y * 0.42, z);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  bakeBoneRamp(geometry, -0.22, 0.22);
  return geometry;
}

/** A branch fragment: an open four-sided tube, long axis on +x so a
 *  raked run shows its alignment. 8 tris. */
function branchFragmentGeometry(): BufferGeometry {
  const geometry = new CylinderGeometry(0.11, 0.16, 1.1, 4, 1, true).toNonIndexed();
  geometry.rotateZ(Math.PI / 2);
  geometry.computeVertexNormals();
  bakeBoneRamp(geometry, -0.16, 0.16);
  return geometry;
}

/** A standing stump: a broken hollow tube-coral stub, jagged rim. */
function stumpGeometry(): BufferGeometry {
  const geometry = new CylinderGeometry(0.16, 0.24, 1, 5, 2, true).toNonIndexed();
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    if (y > 0.45) {
      // The break: each rim vertex snaps to its own height.
      const angle = Math.atan2(position.getZ(i), position.getX(i));
      const snap = 0.5 - Math.abs(Math.sin(angle * 2.5)) * 0.22;
      position.setY(i, snap + Math.sin(angle * 3.1) * 0.06);
    }
  }
  position.needsUpdate = true;
  geometry.translate(0, 0.5, 0);
  geometry.computeVertexNormals();
  bakeBoneRamp(geometry, 0, 1);
  return geometry;
}

/**
 * The bone stumps: the white half's standing layer. Region-owned
 * instancing (the kit litter lies its shapes down; a stump stands), one
 * draw, gated like the grit but thinning as the colour returns. Round 2:
 * grown in count and height, and LEANED toward the disc's outer band —
 * the r1 sweep's rim-facing poses (02/03) stared across ground where
 * nothing stood in the first 35 m (verdant's F-R3, again).
 */
function buildBoneStumps(): InstancedMesh {
  const random = new Random(SEED ^ FILL_SEEDS.stumps);
  const geometry = stumpGeometry();
  const material = createToonMaterial({ vertexColors: true });
  const count = 520;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "pale-bone-stumps";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const warm = new Color(0xf1e9d8);
  const cool = new Color(0xe2e3ec);
  const dummy = new Object3D();
  const tint = new Color();
  const center = worldOf(430, 0);
  const discCenter = worldOf(445, 0);
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 40) {
    attempts++;
    const angle = random.range(0, Math.PI * 2);
    const spread = Math.sqrt(random.next()) * 205;
    const x = center.x + Math.cos(angle) * spread;
    const z = center.z + Math.sin(angle) * spread;
    const roll = random.next();
    const { u, v } = spokeOf(x, z);
    if (u < RAVINE_TO - 6) {
      continue;
    }
    const k = recovery(u, v);
    const rc = Math.hypot(x - discCenter.x, z - discCenter.z);
    const rimLean = 0.55 + 0.45 * smoothstep01((rc - 120) / 45);
    const keep =
      paleWeight(x, z) *
      rimLean *
      (1 - smoothstep01((k - 0.3) / 0.35)) *
      (1 - groveWeight(u, v)) *
      t1Free(x, z);
    if (roll >= keep) {
      continue;
    }
    const height = random.range(0.45, 1.2);
    dummy.position.set(x, seabedHeight(x, z) - 0.04, z);
    dummy.rotation.set(random.signed(0.12), random.range(0, Math.PI * 2), random.signed(0.12));
    dummy.scale.set(height * random.range(0.8, 1.15), height, height * random.range(0.8, 1.15));
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    tint.copy(warm).lerp(cool, random.next() * 0.6).multiplyScalar(random.range(0.94, 1.1));
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

// ─── The build ───────────────────────────────────────────────────────────────

export function buildPaleCarpet(
  treeSpots: readonly { x: number; z: number; height: number }[],
  screeAnchors: {
    readonly ravine: readonly PaleScreeAnchor[];
    readonly blush: readonly PaleScreeAnchor[];
  },
): PaleCarpetBuild {
  const groups: Group[] = [];
  const meshes: InstancedMesh[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (build: KitBuild | CarpetFieldBuild): void => {
    groups.push(build.group);
    if ("update" in build) {
      updaters.push((timeSec) => build.update(timeSec));
    }
  };

  // The two whites, as stone: warm paper base, cool bone second tone,
  // violet undersides — painted for THIS region's flat milk light
  // (verdant's round-3 lesson: never the kit demo's).
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.gravelRavine,
      palette: { base: 0xf2ead6, accent: 0xdfe1ee, shade: 0x8d78ab },
      area: channelArea(56, 290, 11),
      gate: ravineGravelGate,
      ground: seabedHeight,
      count: 1400,
      shapeSet: "shard",
      size: [0.07, 0.2],
      twoTone: true,
    }),
  );

  // The stairs drifts: bigger broken plates between the slab beats, so
  // the gap between reveals falls from ~26 m to ~13 m.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.shardDrifts,
      palette: { base: 0xf4eddc, shade: 0x8d78ab },
      area: channelArea(78, 262, 17),
      gate: shardDriftGate,
      ground: seabedHeight,
      count: 560,
      shapeSet: "shard",
      size: [0.14, 0.32],
    }),
  );

  // The descent shard-field: raked downslope from the lip, every plate
  // pointing at the forest (plan ● 282).
  {
    const lip = worldOf(266, ravineChannelCenter(266));
    keep(
      buildGroundLitter({
        seed: SEED ^ FILL_SEEDS.descentFan,
        palette: { base: 0xf0e9d8, shade: 0x8d78ab },
        area: discAreaAt(283, ravineChannelCenter(280), 15),
        gate: descentGate,
        ground: seabedHeight,
        count: 320,
        shapeSet: "shard",
        size: [0.12, 0.28],
        rake: { from: [lip.x, lip.z], strength: 0.75, jitter: 0.22 },
      }),
    );
  }

  // The false spring (MASTER R6): a dying trace of blush gravel in the
  // mouth's first metres — colour tried to follow the diver in and
  // failed; the hush earns its white.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.falseSpring,
      palette: { base: 0xecc9cc, accent: 0xe8d3b0, shade: 0x9a7890 },
      area: channelArea(46, 72, 9),
      gate: falseSpringGate,
      ground: seabedHeight,
      count: 170,
      shapeSet: "gravel",
      size: [0.05, 0.13],
      twoTone: true,
    }),
  );

  // The base grit floor: the whole disc carries a deliberate cover state.
  // Round 2: the r1 sweep's verdict — bone chips painted bone on bone
  // ground VANISH (verdant's round-7 camouflage lesson, pre-paid here):
  // the second tone family goes genuinely violet so half the run draws
  // against the paper, and the chips grow a size.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.gritDisc,
      palette: { base: 0xf6efdd, accent: 0xb9a8cc, shade: 0x8d78ab },
      area: discAreaAt(445, 0, 205),
      gate: gritGate,
      ground: seabedHeight,
      count: 3000,
      shapeSet: "shard",
      size: [0.1, 0.26],
      twoTone: true,
    }),
  );

  // THE OSSUARY CARPET — the signature exclusive (MASTER R8): region
  // shapes through the kit's litter door. Round 2: grown a size and the
  // second tone family taken to violet-bone — the r1 carpet was there
  // and INVISIBLE (bone on bone under the milk's flat light).
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.ossuary,
      palette: { base: 0xf6efdf, accent: 0xbdaed0, shade: 0x8d78ab },
      area: discAreaAt(BONE_FOREST.u, BONE_FOREST.v, 100),
      gate: ossuaryGate(treeSpots),
      ground: seabedHeight,
      count: 3200,
      shapeSet: [vertebraGeometry(), branchFragmentGeometry()],
      size: [0.13, 0.3],
      twoTone: true,
    }),
  );

  // The bone stumps: the standing layer (see the module header).
  meshes.push(buildBoneStumps());

  // Blush gravel: the First Blush's freckles drawn as stones — bone base
  // with a pink second family, the two-scale answer the paint pass pairs.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.blushGravel,
      palette: { base: 0xf0e6d6, accent: 0xf0b6c4, shade: 0x9a7890 },
      area: blushArea(),
      gate: blushGravelGate,
      ground: seabedHeight,
      count: 1800,
      shapeSet: "shard",
      size: [0.09, 0.22],
      twoTone: true,
    }),
  );

  // The Blooming Shelf's rose-gold turf: the coloured half goes lush.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.turfShelf,
      palette: { base: 0xe8a97c, tip: 0xf6cf8e, shade: 0xa06a80 },
      area: discAreaAt(BLOOM_SHELF.u, BLOOM_SHELF.v, 90),
      gate: shelfTurfGate,
      ground: seabedHeight,
      count: 2000,
      profile: "tuft",
      size: [0.3, 0.58],
      swayAmp: 0.03,
    }),
  );

  // The grove bowl's rim turf: dense at the rim, bare at the heart —
  // the Mother's Pool stays clean (registry).
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.turfGrove,
      palette: { base: 0xe89aa8, tip: 0xf6c2ba, shade: 0xa06888 },
      area: discAreaAt(SEED_GROVE.u, SEED_GROVE.v, 46),
      gate: groveTurfGate,
      ground: seabedHeight,
      count: 1200,
      profile: "tuft",
      size: [0.22, 0.44],
      swayAmp: 0.03,
    }),
  );

  // Rubble at the beds' feet: the gardens grew FROM somewhere.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.bedRubble,
      palette: { base: 0xe8d0be, accent: 0xdcab94, shade: 0x9a7890 },
      area: discAreaAt(BLOOM_SHELF.u, BLOOM_SHELF.v + 8, 70),
      gate: bedRubbleGate,
      ground: seabedHeight,
      count: 240,
      shapeSet: "pebble",
      size: [0.06, 0.16],
      twoTone: true,
    }),
  );

  // ─── The scree aprons (kit) ──────────────────────────────────────────────
  keep(
    buildScreeApron({
      seed: SEED ^ FILL_SEEDS.screeRavine,
      palette: { base: 0xf1ead9, shade: 0x8d78ab },
      ground: seabedHeight,
      anchors: screeAnchors.ravine,
      slabsPerAnchor: 11,
    }),
  );
  keep(
    buildScreeApron({
      seed: SEED ^ FILL_SEEDS.screeBones,
      palette: { base: 0xf0e5d2, shade: 0x9a7890 },
      ground: seabedHeight,
      anchors: screeAnchors.blush,
      slabsPerAnchor: 10,
    }),
  );

  return {
    groups,
    meshes,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}
