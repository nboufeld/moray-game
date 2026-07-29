import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildPaleBloom } from "./PaleBloom";
import { buildPaleBones } from "./PaleBones";
import { buildPaleDistance } from "./PaleDistance";
import { GARDENER_SPECIES_ID, buildGardener } from "./PaleGardener";
import { buildPaleGround } from "./PaleGround";
import { buildPaleLife } from "./PaleLife";
import { buildPaleLight } from "./PaleLight";
import {
  CENTER_X,
  CENTER_Z,
  PALE_SLOT,
  paleCeiling,
  paleTerrainTarget,
  paleWeight,
  ravineChannelCenter,
  ravineChannelHalf,
  ravineFloor,
  spokeOf,
  tongueHalfWidth,
  worldOf,
} from "./PaleTerrain";

/**
 * THE BONE MEADOWS — region `pale-passage-1`, province The Pale Passage.
 *
 * The Ghost Reef told the sorrow in one room; this is the whole story,
 * and the diver swims the direction the life is returning. A chalk
 * ravine of stacked pale plates descends from the wing's opened end wall
 * to a saddle lip; the Bone Forest's dead thickets stand bone-white with
 * violet shadow in the milk; the Quiet Gallery raises its bleached
 * monuments over a bare white pan; across the First Blush, pink and gold
 * buds freckle the skeletons; the Blooming Shelf crowds with young
 * gardens under the region's one shoal; and at the far heart the
 * Mother-Coral — the one thing here that never died — stands over her
 * planted nursery rows while a slow river of spawn-petals flows back
 * down the diver's own path, hope running the wrong way up the story.
 *
 * Pure half in `PaleTerrain`; built half in the sibling modules. Every
 * stream is `SEEDS.regionPale1` or a `^` substream.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver at weight = 0, so the open edges
// are walled the pilot's way: a ring just inside the disc's rim (where
// the ceiling has closed to 3.4 m), double rows down the ravine (inner at
// the wall crest, outer at the tongue's edge), and stacks at the doorway.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  // The rim ring, gated only over the ravine corridor's own width.
  const rimR = 206;
  const count = 94;
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = CENTER_X + Math.cos(theta) * rimR;
    const z = CENTER_Z + Math.sin(theta) * rimR;
    const { u, v } = spokeOf(x, z);
    const uc = Math.min(u, 285);
    if (u < 310 && Math.abs(v - ravineChannelCenter(uc)) < ravineChannelHalf(uc) + 12) {
      continue;
    }
    seals.push({
      center: new Vector3(x, paleTerrainTarget(x, z) + 1.5, z),
      radius: 9,
    });
  }

  // The mouth stacks: the seam tongue is 8 m wide, so the doorway takes
  // three small spheres per side per station; the wing's own walls carry
  // everything below r ≈ 50.
  for (const u of [48, 54, 60, 66]) {
    const lateral = tongueHalfWidth(u) - 0.5;
    const floor = ravineFloor(u);
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * lateral);
      for (const level of [2, 6.5, 11]) {
        seals.push({ center: new Vector3(x, floor + level, z), radius: 4.5 });
      }
    }
  }

  // The ravine's wall rows and the shoulder's outer rows, overlapping by
  // construction so the corridor is sealed wall to ring.
  for (let u = 66; u <= 292; u += 13) {
    const vc = ravineChannelCenter(u);
    const floor = ravineFloor(u);
    const inner = ravineChannelHalf(u) + 9;
    const outer = tongueHalfWidth(u) - 6;
    for (const side of [-1, 1]) {
      const wall = worldOf(u, vc + side * inner);
      seals.push({ center: new Vector3(wall.x, floor + 6, wall.z), radius: 10.5 });
      if (outer > inner + Math.abs(vc) + 2) {
        const edge = worldOf(u, side * outer);
        seals.push({
          center: new Vector3(edge.x, paleTerrainTarget(edge.x, edge.z) + 4, edge.z),
          radius: 12,
        });
      }
    }
  }

  return seals;
}

// ─── The capture poses ───────────────────────────────────────────────────────

/** Camera yaw that looks from one point toward another (yaw 0 faces −z). */
function yawToward(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}

interface PoseSpec {
  readonly name: string;
  readonly u: number;
  readonly v: number;
  readonly lift: number;
  readonly atU: number;
  readonly atV: number;
  readonly pitch: number;
  readonly settle?: number;
}

const POSE_SPECS: readonly PoseSpec[] = [
  // Down the chalk ravine: plate walls, the first lone skeleton in the milk.
  { name: "ravine-descent", u: 92, v: 0, lift: 2.2, atU: 136, atV: 3, pitch: -0.02 },
  // The Chalk Stairs, benches stepping up both walls.
  { name: "chalk-stairs", u: 168, v: 0, lift: 2.4, atU: 212, atV: -4, pitch: 0.02 },
  // The reveal: the lip, the Bone Forest opening white below.
  { name: "lip-reveal", u: 256, v: 0, lift: 2.6, atU: 330, atV: 8, pitch: -0.08 },
  // Among the outriders, the dead thickets layering into the fog.
  { name: "bone-forest", u: 314, v: -2, lift: 2.6, atU: 358, atV: -22, pitch: 0.03, settle: 4 },
  // The Bone Cathedral, the tallest skeleton in the province.
  { name: "bone-cathedral", u: 334, v: -20, lift: 3.0, atU: 352, atV: -34, pitch: 0.14, settle: 4 },
  // The Quiet Gallery: down the monument avenue on the white pan.
  { name: "quiet-gallery", u: 351, v: 46, lift: 2.6, atU: 392, atV: 84, pitch: 0.02, settle: 4 },
  // The Blush Arch: the first colour climbing the white doorway.
  { name: "blush-arch", u: 441, v: -13, lift: 2.2, atU: 456, atV: -7, pitch: 0.05, settle: 4 },
  // The Gardener at its round, the walking garden.
  { name: "gardener", u: 483, v: 19, lift: 2.4, atU: 492, atV: 26, pitch: -0.03, settle: 6 },
  // The Blooming Shelf: young gardens at full colour, the shoal above.
  { name: "blooming-shelf", u: 504, v: -38, lift: 2.8, atU: 540, atV: -60, pitch: -0.02, settle: 5 },
  // The Seed Grove from its rim: the mother over her nursery rows.
  { name: "seed-grove", u: 530, v: 22, lift: 2.6, atU: 558, atV: 38, pitch: -0.1, settle: 5 },
  // Under the mother's crown, looking up through the petal river's birth.
  { name: "mother-crown", u: 553, v: 33, lift: 2.0, atU: 558, atV: 38, pitch: 0.85, settle: 4 },
  // Looking back the way we came: the petal current head-on, the white
  // horizon behind it — the whole story in one frame.
  { name: "white-lookback", u: 500, v: 2, lift: 3.2, atU: 420, atV: -8, pitch: 0.02, settle: 4 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = paleTerrainTarget(x, z) + spec.lift;
    const at = worldOf(spec.atU, spec.atV);
    return {
      name: spec.name,
      position: [x, y, z] as const,
      yaw: yawToward(x, z, at.x, at.z),
      pitch: spec.pitch,
      settle: spec.settle ?? 2.5,
    };
  });
}

// ─── The def ─────────────────────────────────────────────────────────────────

export const PALE_1: RegionDef = {
  slotId: PALE_SLOT.id,
  title: "The Bone Meadows",
  emotion: "a white world coming back to life — swim the way the colour returns",

  weight: paleWeight,
  terrainTarget: paleTerrainTarget,
  ceiling: paleCeiling,
  floorClearance: 0.7,

  mood: {
    // The milk, region-sized: paler and denser than open water but a
    // step clearer than the Ghost Reef's room, so the vistas breathe to
    // ~65 m. Rounds 1–2 both failed the value key's first read: the
    // scale multiplies the base fog (linear ≈ 0.09, 0.45, 0.50 — red
    // near nothing), so a polite red lift of 1.18 was arithmetic dust
    // and the milk rendered electric poster-cyan. Milk needs red raised
    // *fourfold* against that base before the ratio reads as paper.
    // The backdrop fade came down too: 0.45 dimmed the whole sky into a
    // dark teal slab pressing on every frame — the white world wants
    // its light kept on.
    // Density eased a step from round 2 so the shelf's authored beds
    // layer inside the fog instead of drowning at forty metres — the
    // reveal rhythm wants ~55 m of legible water.
    fog: { colorScale: [4.4, 1.3, 1.12], densityGain: 0.009, backdropFade: 0.22 },
    light: { sun: 0.1, hemisphere: -0.1, ambient: -0.03 },
  },
  moodSurface: 16,
  moodDescent: 8,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-pale-passage-1";

    const bones = buildPaleBones();
    const bloom = buildPaleBloom(bones.archCrown);
    const gardener = buildGardener();
    const life = buildPaleLife(bloom.motherCrown);
    const light = buildPaleLight();
    const distance = buildPaleDistance();
    const ground = buildPaleGround([...bones.contacts, ...bloom.contacts]);

    for (const mesh of [
      ...ground,
      ...bones.meshes,
      ...bloom.meshes,
      ...life.meshes,
      ...light.meshes,
      ...distance.meshes,
    ]) {
      group.add(mesh);
    }
    group.add(gardener.group);

    const colliders = [...bones.colliders, ...bloom.colliders, ...buildSeals()];

    return {
      group,
      colliders,
      targets: [gardener.target],
      update(dt, ctx): void {
        bloom.update(dt, ctx.reducedMotion);
        life.update(dt, ctx.time, ctx.reducedMotion);
        gardener.update(ctx.time, ctx.reducedMotion);
      },
    };
  },

  codexEntries: [
    {
      id: GARDENER_SPECIES_ID,
      commonName: "The Gardener",
      scientificName: "Coenobita hortulanus",
      fact:
        "An ancient hermit crab the size of a rowboat, whose borrowed shell " +
        "carries a living coral garden through the bleached meadows. It " +
        "plods one slow circle a day, pressing sprigs into the sand — the " +
        "nursery rows at the Seed Grove are its work.",
      codexLine: "It carries the reef's tomorrow on its back, and plants it one sprig at a time.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// collision contract and the tests read them back.
export { buildSeals };
