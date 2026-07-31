import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildSmokingBasalt, COLONNADE, ORGAN } from "./SmokingBasalt";
import { buildSmokingCarpets } from "./SmokingCarpets";
import { buildSmokingChimneys } from "./SmokingChimneys";
import { buildSmokingDistance } from "./SmokingDistance";
import { buildSmokingFillLife } from "./SmokingFillLife";
import { buildSmokingFlora } from "./SmokingFlora";
import { buildSmokingGround } from "./SmokingGround";
import { KEEPER_SPECIES_ID, buildKeeper } from "./SmokingKeeper";
import { buildSmokingLife } from "./SmokingLife";
import { buildSmokingLight } from "./SmokingLight";
import { buildSmokingRocks } from "./SmokingRocks";
import { buildSmokingSprings } from "./SmokingSprings";
import {
  CENTER_X,
  CENTER_Z,
  KILN,
  SMOKING_SLOT,
  SPRINGS,
  gorgeChannelCenter,
  gorgeChannelHalf,
  gorgeFloor,
  smokingCeiling,
  smokingTerrainTarget,
  smokingWeight,
  spokeOf,
  tongueHalfWidth,
  worldOf,
} from "./SmokingTerrain";

/**
 * THE SMOULDER FIELDS — region `smoking-marches-1`, province The Smoking
 * Marches.
 *
 * The Vent Springs wing was a warm doorway; this is the volcanic country
 * beyond it — otherworldly, warm, alive with slow breath, never hostile.
 * A black-sand gorge winds out of the wing, the water warming visibly,
 * to a saddle lip that opens on the Ash Meadows' grey-violet quiet; the
 * Basalt Steps terrace up to the Organ Pipes' broken colonnades; the
 * Spring Terraces stack their pale-rimmed pools down a mineral stair;
 * the Chimney Forest stands its smokers tall as trees under slow columns
 * of ember-lit smoke; the Caldera holds a bowl of haze where thermal
 * jellies rise in single file from the Old Kiln — and the Kiln Keeper,
 * a salamander-newt spirit, patrols its seams. The far rim dissolves
 * into charcoal-and-amber painted distance.
 *
 * Pure half in `SmokingTerrain`; built half in the sibling modules.
 * Every stream is `SEEDS.regionSmoking1` or a `^` substream.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver the moment they reach weight = 0,
// so the domain's open edges are walled with spheres the pilot's way: a
// ring just inside the disc's rim (where the ceiling has already closed
// to 3.4 m), rows along the gorge's wall crests, and stacks at the
// doorway. The rim ring leaves a gate over the gorge's corridor, which
// the gorge rows themselves seal.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  // The rim ring, gated only over the gorge channel's own width.
  const rimR = 206;
  const count = 94;
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = CENTER_X + Math.cos(theta) * rimR;
    const z = CENTER_Z + Math.sin(theta) * rimR;
    const { u, v } = spokeOf(x, z);
    const uc = Math.min(u, 285);
    if (u < 310 && Math.abs(v - gorgeChannelCenter(uc)) < gorgeChannelHalf(uc) + 12) {
      continue;
    }
    seals.push({
      center: new Vector3(x, smokingTerrainTarget(x, z) + 1.5, z),
      radius: 9,
    });
  }

  // The mouth stacks: the seam tongue is 8.2 m wide, so the doorway takes
  // three small spheres per side per station under the 10 m ceiling.
  for (const u of [48, 54, 60, 66]) {
    const lateral = tongueHalfWidth(u) - 0.5;
    const floor = gorgeFloor(u);
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * lateral);
      for (const level of [2, 6.5, 11]) {
        seals.push({ center: new Vector3(x, floor + level, z), radius: 4.5 });
      }
    }
  }

  // The gorge's wall rows (inner, at the wall crest) and the shoulder's
  // outer rows (at the tongue edge) — overlapping by construction, so the
  // corridor is sealed wall to ring.
  for (let u = 66; u <= 292; u += 13) {
    const vc = gorgeChannelCenter(u);
    const floor = gorgeFloor(u);
    const inner = gorgeChannelHalf(u) + 9;
    const outer = tongueHalfWidth(u) - 6;
    for (const side of [-1, 1]) {
      const wall = worldOf(u, vc + side * inner);
      seals.push({ center: new Vector3(wall.x, floor + 7, wall.z), radius: 11 });
      if (outer > inner + Math.abs(vc) + 2) {
        const edge = worldOf(u, side * outer);
        seals.push({
          center: new Vector3(edge.x, smokingTerrainTarget(edge.x, edge.z) + 4, edge.z),
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
  /** Metres above the composed ground at the pose's own feet. */
  readonly lift: number;
  readonly atU: number;
  readonly atV: number;
  readonly pitch: number;
  readonly settle?: number;
}

const POSE_SPECS: readonly PoseSpec[] = [
  // The gorge's descent: charcoal walls, the channel winding away.
  { name: "gorge-descent", u: 96, v: 0, lift: 2.4, atU: 140, atV: 3, pitch: -0.04 },
  // The First Breath: the lone smoker where the water warms.
  { name: "first-breath", u: 136, v: 0, lift: 2.2, atU: 158, atV: 9, pitch: 0.05, settle: 4 },
  // The reveal: standing at the lip, the Smoulder Fields opening below.
  { name: "gorge-lip", u: 252, v: 0, lift: 2.6, atU: 330, atV: 12, pitch: -0.08 },
  // The Ash Meadows: the quiet, the erratic, the basalt country ghosting.
  { name: "ash-flats", u: 310, v: -6, lift: 2.6, atU: 350, atV: 44, pitch: 0.0, settle: 4 },
  // The Broken Colonnade: the swim-through arcade.
  { name: "colonnade", u: 381, v: 40, lift: 2.4, atU: COLONNADE.u + 8, atV: COLONNADE.v + 6, pitch: 0.04 },
  // The Organ Steps: the crown's rank of pipes.
  { name: "organ-steps", u: 406, v: 74, lift: 3.2, atU: ORGAN.u, atV: ORGAN.v, pitch: 0.08, settle: 4 },
  // The Spring Terraces: oblique from above, so the stacked pools read
  // as pools (round 4's ground-level look up the slope saw only risers).
  { name: "spring-stair", u: 407, v: -98, lift: 7.5, atU: SPRINGS.u - 4, atV: SPRINGS.v + 2, pitch: -0.06 },
  // The Chimney Forest's eaves: smokers layered into the fog.
  { name: "chimney-forest", u: 484, v: -30, lift: 2.8, atU: 516, atV: -56, pitch: 0.06, settle: 5 },
  // The Twin Kings: looking up the smoke, the riders spiralling.
  { name: "twin-kings", u: 504, v: -38, lift: 1.8, atU: 512, atV: -48, pitch: 0.8, settle: 6 },
  // The caldera's rim: the bowl of haze, the kiln's breath, the
  // procession — stepped inside the lip so the centre is within the fog.
  { name: "caldera-rim", u: 472, v: 32, lift: 2.4, atU: KILN.u, atV: KILN.v, pitch: -0.14, settle: 6 },
  // On the caldera's floor: the Old Kiln and its Keeper. The aim rides a
  // step off the target so a settle-completed discovery plate never
  // covers the frame being judged.
  { name: "kiln-keeper", u: 498, v: 46, lift: 2.0, atU: KILN.u + 2, atV: KILN.v + 3, pitch: 0.02, settle: 6 },
  // The Ember Shore: the shelf, the stacks, the painted distance.
  { name: "ember-shore", u: 583, v: 12, lift: 3, atU: 645, atV: 0, pitch: 0.02 },
  // Fill poses (plan §7.9) — aimed at the former bare stretches so the
  // fixes stay photographed: mid-gorge looking back down the road, and
  // the springs→forest road at its emptiest former metre.
  { name: "gorge-road", u: 200, v: 2, lift: 2.2, atU: 150, atV: -2, pitch: 0.02 },
  { name: "forest-road", u: 450, v: -62, lift: 2.4, atU: 498, atV: -54, pitch: 0.03 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = smokingTerrainTarget(x, z) + spec.lift;
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

export const SMOKING_1: RegionDef = {
  slotId: SMOKING_SLOT.id,
  title: "The Smoulder Fields",
  emotion: "warm volcanic breath — strange, old, calm, never hostile",

  weight: smokingWeight,
  terrainTarget: smokingTerrainTarget,
  ceiling: smokingCeiling,
  floorClearance: 0.7,

  mood: {
    // Warm charcoal-amber water: red held highest, blue taken hardest.
    // Three rounds of measurement bought this scale: the hook multiplies
    // in LINEAR space, where the base water is (0.086, 0.443, 0.494) —
    // red is an eighth of green, so a "warm" scale below one is a
    // rounding error. 3.2 on red is what "red above green" costs here;
    // the product (0.28, 0.23, 0.18) is the warm grey the palette keys to.
    fog: { colorScale: [3.2, 0.52, 0.36], densityGain: 0.009, backdropFade: 0.5 },
    light: { sun: 0.22, hemisphere: 0.3, ambient: 0.16 },
  },
  moodSurface: 20,
  moodDescent: 9,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-smoking-marches-1";

    const basalt = buildSmokingBasalt();
    const chimneys = buildSmokingChimneys();
    const springs = buildSmokingSprings();
    const rocks = buildSmokingRocks();
    const keeper = buildKeeper();
    const flora = buildSmokingFlora();
    const life = buildSmokingLife(chimneys.kings);
    const light = buildSmokingLight();
    const distance = buildSmokingDistance();
    // The Phase 3 fill tiers (fresh substreams — nothing above re-rolls).
    const carpets = buildSmokingCarpets(chimneys.stands);
    const fillLife = buildSmokingFillLife(basalt.perchTops);
    const ground = buildSmokingGround([
      ...basalt.contacts,
      ...chimneys.contacts,
      ...springs.contacts,
      ...rocks.contacts,
      ...keeper.contacts,
    ]);

    for (const mesh of [
      ...ground,
      ...basalt.meshes,
      ...chimneys.meshes,
      ...springs.meshes,
      ...springs.instanced,
      ...rocks.meshes,
      ...keeper.meshes,
      ...flora.meshes,
      ...life.meshes,
      ...light.meshes,
      ...distance.meshes,
      ...carpets.groups,
      ...fillLife.groups,
    ]) {
      group.add(mesh);
    }

    const colliders = [
      ...basalt.colliders,
      ...chimneys.colliders,
      ...springs.colliders,
      ...rocks.colliders,
      ...keeper.colliders,
      ...buildSeals(),
    ];

    return {
      group,
      colliders,
      targets: [keeper.target],
      update(dt, ctx): void {
        chimneys.update(dt, ctx.reducedMotion);
        springs.update(dt);
        flora.update(dt, ctx.reducedMotion);
        life.update(dt, ctx.time, ctx.reducedMotion);
        keeper.update(ctx.time, ctx.reducedMotion);
        // The fill's motion is closed-form off simulated time (kit law 5).
        const calm = ctx.reducedMotion ? 0.45 : 1;
        carpets.update(ctx.time * calm);
        fillLife.update(ctx.time * calm);
        light.update(ctx.time * calm);
      },
    };
  },

  codexEntries: [
    {
      id: KEEPER_SPECIES_ID,
      commonName: "Kiln Keeper",
      scientificName: "Salamandra fornacis",
      fact:
        "A newt-bodied spirit that patrols the Old Kiln at the caldera's " +
        "heart, pressing its ember belly to the cooling seams. Where it " +
        "lingers, the vents keep their slow breath through the coldest " +
        "currents.",
      codexLine: "It tends a fire older than the sea above it, one seam at a time.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// region's collision contract and the tests read them back.
export { buildSeals };
