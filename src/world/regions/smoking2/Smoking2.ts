import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildSmoking2Combs } from "./Smoking2Combs";
import { buildSmoking2Distance } from "./Smoking2Distance";
import { buildSmoking2Flora } from "./Smoking2Flora";
import { buildSmoking2Ground } from "./Smoking2Ground";
import { buildSmoking2Life } from "./Smoking2Life";
import { buildSmoking2Light } from "./Smoking2Light";
import { SKATE_SPECIES_ID, buildSmoking2Skate } from "./Smoking2Skate";
import {
  ANVIL,
  HEARTH,
  NIGHT_DOOR,
  RESTS,
  SMOKING2_SLOT,
  passGate,
  passHalfWidth,
  smoking2Ceiling,
  smoking2TerrainTarget,
  smoking2Weight,
  spokeOf,
  washCenter,
  worldOf,
} from "./Smoking2Terrain";

/**
 * THE FORGE COMBS — region `smoking-marches-2`, province The Smoking
 * Marches.
 *
 * The Smoulder Fields were the province's warm doorstep; this is its
 * deep hearth. Past the Smoulder's Ember Shore the ground crests a milky
 * cinder saddle and falls down the Clinker Stair between the Doorcombs —
 * and the country opens: long black basalt walls standing in broken
 * ranks (the Combs), the Emberwash's glowing seams running the floor
 * between them like a road drawn in heat, the Anvil holding the heart,
 * the First Hearth's junction star burning in its basin, the Pillow
 * Meadows' milk-crusted mounds breathing to the north, and the Glass
 * Shore's obsidian hush running out to the Night Door — two fins leaning
 * together over the far pole, framing the pass the third region will
 * someday open. The Ember Skate glides its slow lantern circuit of the
 * wash. Nothing here is hostile; everything is old, warm and solemn.
 *
 * Pure half in `Smoking2Terrain`; built half in the sibling modules.
 * Every stream is `SEEDS.regionSmoking2` or a `^` substream.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver the moment they reach
// weight = 0, so the domain's open edges are walled with spheres: a ring
// just inside the disc's rim (where the ceiling has already closed to
// 3.4 m), gated over the pass corridor — whose flanks the shoulder rows
// seal, from the Smoulder overlap down to the stair's foot (the
// verdant-3 pattern). The far pole keeps its ring closed: the Night
// Door's corridor is reserved, not yet open.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  // The rim ring, gated only over the pass corridor's own width.
  const rimR = 206;
  const count = 94;
  const center = worldOf(940, 0);
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = center.x + Math.cos(theta) * rimR;
    const z = center.z + Math.sin(theta) * rimR;
    const { u, v } = spokeOf(x, z);
    if (u < 750 && Math.abs(v) < 27 && passGate(u, v) > 0.3) {
      continue;
    }
    const floor = smoking2TerrainTarget(x, z);
    seals.push(
      { center: new Vector3(x, floor + 1.5, z), radius: 9 },
      { center: new Vector3(x, floor + 8.5, z), radius: 7 },
    );
  }

  // The pass shoulders: rows down both flanks from the Smoulder overlap
  // to the stair's foot, just inside the tongue's edge.
  for (let u = 640; u <= 806; u += 13) {
    const hw = passHalfWidth(u);
    const edge = Math.min(hw - 1.2, Math.max(hw - 4, 21));
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * edge);
      const floor = smoking2TerrainTarget(x, z);
      seals.push({ center: new Vector3(x, floor + 2, z), radius: 9 });
      seals.push({ center: new Vector3(x, floor + 8.5, z), radius: 8 });
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
  /** Metres above the composed ground at the pose's own feet. */
  readonly lift: number;
  readonly atU: number;
  readonly atV: number;
  readonly pitch: number;
  readonly settle?: number;
}

const POSE_SPECS: readonly PoseSpec[] = [
  // From the Smoulder's side of the overlap, looking into the deep — the
  // pass pose the handover is judged by.
  { name: "saddle-crest", u: 668, v: 0, lift: 2.0, atU: 730, atV: 2, pitch: 0.0 },
  // The reveal: standing over the stair, the Forge Combs opening below.
  { name: "clinker-stair", u: 742, v: 2, lift: 2.6, atU: 800, atV: 0, pitch: -0.1 },
  // The Doorcombs: the gate pair framing the way in.
  { name: "doorcombs", u: 738, v: -4, lift: 2.2, atU: 772, atV: 6, pitch: 0.06 },
  // The Emberwash: the road drawn in heat, walls either side.
  { name: "emberwash-road", u: 806, v: washCenter(806) + 2, lift: 2.2, atU: 856, atV: washCenter(856), pitch: 0.0 },
  // The Broken Comb: the fallen lintel over the road, the swim-under.
  { name: "broken-comb", u: 838, v: washCenter(838) - 2, lift: 2.4, atU: 859, atV: -2, pitch: 0.06 },
  // Along the Long Gallery's face: wall, drapes, scree — the wall country.
  { name: "comb-gallery", u: 842, v: 20, lift: 2.6, atU: 862, atV: 44, pitch: 0.08 },
  // The Anvil, from the road: the heart's forge-glow and its shimmer.
  { name: "anvil", u: 914, v: washCenter(914), lift: 2.6, atU: ANVIL.u, atV: ANVIL.v, pitch: 0.06, settle: 4 },
  // The skate's court: aim rides the circuit's closest reach so the
  // lantern crosses the frame (settle carries a chunk of the loop).
  { name: "ember-skate", u: 952, v: washCenter(952) + 4, lift: 2.4, atU: ANVIL.u - 6, atV: ANVIL.v - 8, pitch: 0.08, settle: 8 },
  // The Kings' Run: looking up the tallest walls' aisle.
  { name: "kings-run", u: 908, v: 30, lift: 2.0, atU: 916, atV: 42, pitch: 0.55, settle: 4 },
  // The First Hearth: the junction star's basin, shimmer standing.
  { name: "first-hearth", u: 878, v: -66, lift: 3.0, atU: HEARTH.u, atV: HEARTH.v, pitch: -0.08, settle: 5 },
  // The Pillow Meadows: crusted mounds toward the Ladle's glimmer.
  { name: "pillow-meadows", u: 862, v: 76, lift: 2.8, atU: 892, atV: 112, pitch: 0.02, settle: 4 },
  // The Ladle itself: the rest read from its rim — composed stillness.
  { name: "the-ladle", u: 876, v: 108, lift: 6.0, atU: RESTS.ladle.u, atV: RESTS.ladle.v, pitch: -0.3 },
  // The Glass Shore: obsidian hush, the far country's cool note.
  { name: "glass-shore", u: 1032, v: -28, lift: 2.8, atU: 1080, atV: -44, pitch: 0.02 },
  // The Night Door: the reserved pass framed against parted distance.
  { name: "night-door", u: 1082, v: 2, lift: 2.6, atU: NIGHT_DOOR.u, atV: NIGHT_DOOR.v, pitch: 0.04 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = smoking2TerrainTarget(x, z) + spec.lift;
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

export const SMOKING_2: RegionDef = {
  slotId: SMOKING2_SLOT.id,
  title: "The Forge Combs",
  emotion: "the province's deep hearth — old walls, heat in the seams, solemn and calm",

  weight: smoking2Weight,
  terrainTarget: smoking2TerrainTarget,
  ceiling: smoking2Ceiling,
  floorClearance: 0.7,

  mood: {
    // A register deeper than the Smoulder: the same warm charcoal-amber
    // family (red held highest, blue taken hardest — the hook multiplies
    // in linear space, where 3.2 on red is what "red above green" costs),
    // slightly denser and dimmer, because this country's light comes off
    // its own ground.
    fog: { colorScale: [3.3, 0.49, 0.37], densityGain: 0.011, backdropFade: 0.52 },
    light: { sun: 0.19, hemisphere: 0.27, ambient: 0.15 },
  },
  moodSurface: 20,
  moodDescent: 10,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-smoking-marches-2";

    const combs = buildSmoking2Combs();
    const skate = buildSmoking2Skate();
    const light = buildSmoking2Light();
    const distance = buildSmoking2Distance();
    const flora = buildSmoking2Flora(combs);
    const life = buildSmoking2Life(combs.perchTops);
    const ground = buildSmoking2Ground(combs.contacts);

    for (const child of [
      ...ground,
      ...combs.meshes,
      ...skate.meshes,
      ...light.meshes,
      ...light.groups,
      ...distance.meshes,
      ...flora.groups,
      ...life.groups,
    ]) {
      group.add(child);
    }

    const colliders = [...combs.colliders, ...buildSeals()];

    return {
      group,
      colliders,
      targets: [skate.target],
      update(_dt, ctx): void {
        skate.update(ctx.time, ctx.reducedMotion);
        // Kit motion is closed-form off simulated seconds (capture-safe);
        // reduced motion slows the clock the same way the region's own
        // systems do.
        const kitTime = ctx.time * (ctx.reducedMotion ? 0.45 : 1);
        flora.update(kitTime);
        life.update(kitTime);
        light.update(kitTime);
      },
    };
  },

  codexEntries: [
    {
      id: SKATE_SPECIES_ID,
      commonName: "Ember Skate",
      scientificName: "Raja carbonaria",
      fact:
        "A broad-winged skate that rides the Emberwash's seams, belly to " +
        "the warm ground, its spine freckled with living embers. It never " +
        "leaves the road: where the seams glow, the Skate has passed, and " +
        "where the Skate passes, the seams stay warm.",
      codexLine: "The road's slow lantern, keeping the seams company.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// region's collision contract and the tests read them back.
export { buildSeals };
