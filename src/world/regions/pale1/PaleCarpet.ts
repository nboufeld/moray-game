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

/** The blush band as a road up the spine. Round 3: width 170 → 340 and
 *  a fifth station — the r2 sweep's 04 stood at v −159, OUTSIDE the old
 *  corridor, over pink paint with not one stone on it. */
function blushArea(): KitArea {
  const polyline: [number, number][] = [];
  for (const u of [398, 436, 474, 512, 548]) {
    const { x, z } = worldOf(u, 0);
    polyline.push([x, z]);
  }
  return { polyline, width: 340 };
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

/** The ravine's high banks (round 3): the r2 sweep's 02 stood on the
 *  bank dune at u 250 and saw NOTHING in its first 35 m — every ravine
 *  family hugged the channel and the grit floor started at the lip
 *  (u ≥ 292). Chalk shards hold the bank tops; the lane below keeps the
 *  hush law by construction (only `away > half + 7` places at all). */
const bankShardGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 62 || u > 294) {
    return 0;
  }
  const away = Math.abs(v - ravineChannelCenter(u));
  const beyond = smoothstep01((away - ravineChannelHalf(u) - 7) / 5);
  const reach = 1 - smoothstep01((away - 88) / 40);
  return beyond * reach * t1Free(x, z);
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

/** Blush gravel: the freckle band drawn as stones, thinning both ways.
 *  Round 3: the high fade pushed from k 0.9 to ~0.96 — the coloured
 *  half's far flanks (r2 sweep 04, k 0.72) sat past the old band. */
const blushGravelGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const k = recovery(u, v);
  const band = smoothstep01((k - 0.04) / 0.1) * (1 - smoothstep01((k - 0.72) / 0.24));
  return band * (1 - bloomWeight(u, v) * 0.55) * paleWeight(x, z) * t1Free(x, z);
};

/** Petal-fall (round 3): the grove sheds. Fallen rose chips own the
 *  deep-recovery flanks the gravel band leaves (r2 sweep 09 stood at
 *  k = 1.0 over bare rose paint); dense toward the grove, never in the
 *  pool (t1Free), thinner where the bowl turf already answers. */
const petalFallGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const k = recovery(u, v);
  const deep = smoothstep01((k - 0.58) / 0.16);
  const grove = 1 - groveWeight(u, v) * 0.5;
  return deep * grove * paleWeight(x, z) * t1Free(x, z);
};

/** Pioneer sprigs (round 4): the coloured half's STANDING layer. The r3
 *  sweep's two remaining colour-side misses (04 at k 0.72, 09 at k 1.0)
 *  both stood on far flanks where the only fill was ankle-height chips —
 *  invisible past ten metres at eye height (the white half learned this
 *  in round 2 and got stumps; MASTER's field note asks for flank bands
 *  in the first 35 m). Knee-height rose tufts answer, dense in deep
 *  recovery, thinner where the shelf's own turf already speaks. */
const sprigGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const k = recovery(u, v);
  const deep = smoothstep01((k - 0.42) / 0.18);
  const shelfOwn = 1 - bloomWeight(u, v) * 0.6;
  const grove = 1 - groveWeight(u, v) * 0.4;
  return deep * shelfOwn * grove * Math.sqrt(paleWeight(x, z)) * t1Free(x, z);
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
 * nothing stood in the first 35 m (verdant's F-R3, again). Round 4:
 * count up again and the region-weight starvation fixed — sweep 03
 * stood at paleWeight 0.5 (the disc's far edge) and the multiplicative
 * keep halved an already-thin flank; the square root restores the edge
 * without touching the interior, and a |v|-flank lean joins the radial
 * one so BOTH kinds of outward pose meet something standing.
 */
function buildBoneStumps(): InstancedMesh {
  const random = new Random(SEED ^ FILL_SEEDS.stumps);
  const geometry = stumpGeometry();
  const material = createToonMaterial({ vertexColors: true });
  const count = 900;
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
      // Round 3: the ravine's bank tops may carry stumps too (r2 sweep
      // 02's first 35 m had nothing standing) — but never the lane.
      const away = Math.abs(v - ravineChannelCenter(u));
      if (u < 62 || away < ravineChannelHalf(u) + 9) {
        continue;
      }
    }
    const k = recovery(u, v);
    const rc = Math.hypot(x - discCenter.x, z - discCenter.z);
    const rimLean = 0.55 + 0.45 * smoothstep01((rc - 120) / 45);
    const flankLean = 0.55 + 0.45 * smoothstep01((Math.abs(v) - 70) / 45);
    const keep =
      Math.sqrt(paleWeight(x, z)) *
      Math.max(rimLean, flankLean) *
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

  // The ravine's bank tops (round 3): chalk shards over the shoulders'
  // dunes — the walls and the lane stay clean, the banks stop being the
  // accident the sweep kept finding.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.bankShards,
      palette: { base: 0xf4edda, accent: 0xb9a8cc, shade: 0x8d78ab },
      area: channelArea(62, 292, 190),
      gate: bankShardGate,
      ground: seabedHeight,
      count: 760,
      shapeSet: "shard",
      size: [0.12, 0.3],
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
      // Round 4: 3000 → 2400 — the grit's near-field job is done by the
      // ossuary and stumps now; the trim part-funds the pioneer sprigs.
      // Round 5: 2400 → 2050, funding the south-flank sprig patch.
      count: 2050,
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
      // Round 4: 2950 → 2800, part of the sprig funding.
      count: 2800,
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
      // Round 4: 2100 → 2000, part of the sprig funding.
      count: 2000,
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
      // Round 4: 1700 → 1500 — the shelf holds its lushness at this
      // density; the trim part-funds the flanks' new standing layer.
      count: 1500,
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
      // Round 4: 1200 → 1100, part of the sprig funding.
      count: 1100,
      profile: "tuft",
      size: [0.22, 0.44],
      swayAmp: 0.03,
    }),
  );

  // Petal-fall (round 3): the deep-recovery flanks wear the grove's
  // shed petals — rose chips with a cream second tone, the coloured
  // half's answer to the white half's grit floor. Round 4: grown a
  // size and a fifth — at 0.06 m the r3 chips vanished past arm's
  // reach, which is why sweeps 04 and 09 still read bare.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.petalFall,
      palette: { base: 0xf0b9c8, accent: 0xf7dcc9, shade: 0xa06888 },
      area: discAreaAt(SEED_GROVE.u - 42, SEED_GROVE.v, 130),
      gate: petalFallGate,
      ground: seabedHeight,
      // Round 5: 1100 → 1050, the last sliver of south-patch funding.
      count: 1050,
      shapeSet: "shard",
      size: [0.1, 0.22],
      twoTone: true,
    }),
  );

  // Pioneer sprigs (round 4): the coloured half's standing layer — see
  // `sprigGate`. The disc reaches the far flanks the petal-fall's tighter
  // circle leaves; rose-gold for the region's warm light, violet shade.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.pioneerSprigs,
      palette: { base: 0xe8a090, tip: 0xf6c9a8, shade: 0x96688c },
      area: discAreaAt(SEED_GROVE.u - 40, SEED_GROVE.v, 175),
      gate: sprigGate,
      ground: seabedHeight,
      count: 1250,
      profile: "tuft",
      size: [0.3, 0.55],
      swayAmp: 0.04,
    }),
  );

  // The south-flank sprig patch (round 5): the pa-filled sweep's last
  // miss (04, u 497 v −159, k 0.72) stood 198 m from the main sprig
  // disc's centre — the GATE was hot, the AREA never sampled there. The
  // deep-recovery band is a crescent no single disc covers without
  // thinning everything; a dedicated patch holds the south flank.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.sprigsSouth,
      palette: { base: 0xe8a090, tip: 0xf6c9a8, shade: 0x96688c },
      area: discAreaAt(SEED_GROVE.u - 55, SEED_GROVE.v - 178, 78),
      gate: sprigGate,
      ground: seabedHeight,
      count: 300,
      profile: "tuft",
      size: [0.3, 0.55],
      swayAmp: 0.04,
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
