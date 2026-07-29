import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildVerdantDistance } from "./VerdantDistance";
import { buildVerdantGround } from "./VerdantGround";
import { buildVerdantKelp } from "./VerdantKelp";
import { buildVerdantLife } from "./VerdantLife";
import { buildVerdantLight } from "./VerdantLight";
import { buildVerdantMeadow } from "./VerdantMeadow";
import { buildVerdantRocks } from "./VerdantRocks";
import { WEAVER_SPECIES_ID, buildWeaver } from "./VerdantWeaver";
import {
  CENTER_X,
  CENTER_Z,
  ROOT_MAZE,
  SUNWELL,
  VERDANT_SLOT,
  spokeOf,
  tongueHalfWidth,
  valeChannelCenter,
  valeChannelHalf,
  valeFloor,
  verdantCeiling,
  verdantTerrainTarget,
  verdantWeight,
  worldOf,
} from "./VerdantTerrain";

/**
 * THE GREAT KELP SEA — region `verdant-line-1`, province The Verdant Line.
 *
 * The Kelp Cathedral was the narthex; this is the sea it was praying
 * toward. A drowned green world the size of the whole original game: the
 * Long Vale winds down from the cathedral's vault to a saddle lip that
 * reveals the region in one breath; the Rolling Meadows open under shoals
 * and young kelp; the High Forest closes overhead — giants of eighteen to
 * twenty-five metres, canopy into moving light — around the Sunwell's
 * broken circle of open light; the Root Maze sinks the deepest quarter
 * into holdfast tangle, swim-through arches, a wreck and a grotto where
 * the Kelp Weaver braids; and the Falling Edge thins the forest onto a
 * shelf where the painted distance promises the deeper province.
 *
 * Pure half here and in `VerdantTerrain`; built half in the sibling
 * modules. Every stream is `SEEDS.regionVerdant1` or a `^` substream.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver the moment they reach weight = 0,
// so the domain's open edges are walled with spheres the way the canyon's
// wedge is: a ring just inside the disc's rim (where the ceiling has
// already closed to 3.4 m, so one row seals floor to ceiling), and a row
// along each of the vale's wall crests (where the ceiling holds 10–12 m
// and an 11 m sphere at mid-wall covers the column). The rim ring leaves a
// gate over the tongue's corridor, which the vale rows themselves seal.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  // The rim ring. The gate over the vale's corridor is cut to the
  // *channel's* width, not the tongue's — the tongue's wide shoulders at
  // the disc's edge must stay walled, or the wedge between the vale rows
  // and the ring is an open door to weight-zero water.
  const rimR = 206;
  const count = 94;
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = CENTER_X + Math.cos(theta) * rimR;
    const z = CENTER_Z + Math.sin(theta) * rimR;
    const { u, v } = spokeOf(x, z);
    const uc = Math.min(u, 285);
    if (u < 310 && Math.abs(v - valeChannelCenter(uc)) < valeChannelHalf(uc) + 12) {
      continue;
    }
    seals.push({
      center: new Vector3(x, verdantTerrainTarget(x, z) + 1.5, z),
      radius: 9,
    });
  }

  // The mouth stacks: the seam tongue is only 8.2 m wide, so the doorway
  // takes three small spheres per side per station — a tight door is what
  // a doorway is, and the wing's own walls carry everything below r ≈ 50.
  for (const u of [48, 54, 60, 66]) {
    const lateral = tongueHalfWidth(u) - 0.5;
    const floor = valeFloor(u);
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * lateral);
      for (const level of [2, 7.5, 13]) {
        seals.push({ center: new Vector3(x, floor + level, z), radius: 4.5 });
      }
    }
  }

  // The vale's wall rows (the "you cannot cross the wall" seal) and the
  // shoulder's outer rows (the domain-edge seal): the two overlap by
  // construction — inner covers the channel flank out to wch + 20, outer
  // covers hw − 18 out past hw — so the corridor is sealed wall to ring.
  for (let u = 66; u <= 292; u += 13) {
    const vc = valeChannelCenter(u);
    const floor = valeFloor(u);
    const inner = valeChannelHalf(u) + 9;
    const outer = tongueHalfWidth(u) - 6;
    for (const side of [-1, 1]) {
      const wall = worldOf(u, vc + side * inner);
      seals.push({ center: new Vector3(wall.x, floor + 7, wall.z), radius: 11 });
      if (outer > inner + Math.abs(vc) + 2) {
        const edge = worldOf(u, side * outer);
        seals.push({
          center: new Vector3(edge.x, verdantTerrainTarget(edge.x, edge.z) + 4, edge.z),
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
  /** Where the camera looks, in spoke coordinates. */
  readonly atU: number;
  readonly atV: number;
  readonly pitch: number;
  readonly settle?: number;
  /** Absolute y instead of ground-relative, for above-canopy poses. */
  readonly absoluteY?: number;
}

const POSE_SPECS: readonly PoseSpec[] = [
  // The vale's descent: walls rising, channel winding away.
  { name: "vale-descent", u: 96, v: 0, lift: 2.4, atU: 140, atV: 4, pitch: -0.04 },
  // The narrows, where the light pinches before the reveal.
  { name: "vale-narrows", u: 196, v: 0, lift: 2.2, atU: 240, atV: 0, pitch: 0.02 },
  // The reveal: standing at the lip, the region opening below.
  { name: "vale-reveal", u: 256, v: 0, lift: 2.6, atU: 330, atV: 12, pitch: -0.1 },
  // The Rolling Meadows, shoal and erratic in frame.
  { name: "meadow-hills", u: 306, v: -10, lift: 2.6, atU: 340, atV: 26, pitch: -0.02, settle: 4 },
  // The forest's eaves: the treeline wall.
  { name: "forest-eaves", u: 372, v: 24, lift: 2.8, atU: 430, atV: -4, pitch: 0.05 },
  // Deep in the aisle: trunks layered into green silhouette.
  { name: "forest-aisle", u: 414, v: 8, lift: 3, atU: 470, atV: 46, pitch: 0.04, settle: 6 },
  // The Elder and the serpent that circles it.
  { name: "elder-serpent", u: 441, v: -32, lift: 4, atU: 430, atV: -21, pitch: 0.08, settle: 10 },
  // Up through the Elder's own crown: the light-dapple ceiling.
  { name: "canopy-up", u: 433, v: -25, lift: 1.6, atU: 430, atV: -22, pitch: 1.05 },
  // Breaching the canopy into the thin bright water.
  { name: "canopy-breach", u: 448, v: 12, lift: 0, absoluteY: 15, atU: 475, atV: 58, pitch: -0.14 },
  // The Sunwell: the clearing and its fall of light.
  { name: "sunwell", u: 452, v: 40, lift: 2.4, atU: SUNWELL.u, atV: SUNWELL.v, pitch: 0.06, settle: 5 },
  // The Root Maze's half-light: arch, roots, the fallen giant.
  { name: "root-maze", u: 468, v: -52, lift: 2.6, atU: ROOT_MAZE.u, atV: ROOT_MAZE.v, pitch: -0.12 },
  // The grotto: the Weaver braiding under the slab. The aim rides a step
  // off the anchor so the settle does not complete a discovery and drop
  // the ceremony plate over the frame being judged.
  { name: "weaver-grotto", u: 497, v: -97, lift: 2.2, atU: 507, atV: -104, pitch: -0.04, settle: 6 },
  // The Falling Edge: the shelf, the stones, the painted distance.
  { name: "falling-edge", u: 578, v: 14, lift: 3, atU: 640, atV: 0, pitch: 0.02 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = spec.absoluteY ?? verdantTerrainTarget(x, z) + spec.lift;
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

export const VERDANT_1: RegionDef = {
  slotId: VERDANT_SLOT.id,
  title: "The Great Kelp Sea",
  emotion: "green immensity — wander and be small among the giants",

  weight: verdantWeight,
  terrainTarget: verdantTerrainTarget,
  ceiling: verdantCeiling,
  floorClearance: 0.7,

  mood: {
    // Deep living green that keeps its sun. Round 1 measured red at 0.58
    // as electric emerald — the value key's "read the red channel first"
    // failure — so the green arrives by *ratio*, not by gutting red; the
    // density gain came down with it so the vistas breathe to ~70 m.
    fog: { colorScale: [0.72, 0.92, 0.66], densityGain: 0.0045, backdropFade: 0.32 },
    light: { sun: 0.12, hemisphere: 0.2, ambient: 0.05 },
  },
  // The mood fades out above 18 m, so climbing through the canopy into the
  // thin water over it is a climb back into the bright — the breach moment
  // is carried by the one mechanism the def owns.
  moodSurface: 18,
  moodDescent: 9,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-verdant-line-1";

    const kelp = buildVerdantKelp();
    const rocks = buildVerdantRocks();
    const meadow = buildVerdantMeadow();
    const life = buildVerdantLife(kelp.giants);
    const weaver = buildWeaver(rocks.grotto);
    const light = buildVerdantLight();
    const distance = buildVerdantDistance();
    const ground = buildVerdantGround([...kelp.contacts, ...rocks.contacts]);

    for (const mesh of [
      ...ground,
      ...kelp.meshes,
      ...rocks.meshes,
      meadow.mesh,
      ...life.meshes,
      weaver.mesh,
      ...light.meshes,
      ...distance.meshes,
    ]) {
      group.add(mesh);
    }

    const colliders = [...kelp.colliders, ...rocks.colliders, ...buildSeals()];

    return {
      group,
      colliders,
      targets: [weaver.target],
      update(dt, ctx): void {
        kelp.update(dt, ctx.reducedMotion);
        meadow.update(dt, ctx.reducedMotion);
        life.update(dt, ctx.time, ctx.reducedMotion);
        weaver.update(ctx.time, ctx.reducedMotion);
      },
    };
  },

  codexEntries: [
    {
      id: WEAVER_SPECIES_ID,
      commonName: "Kelp Weaver",
      scientificName: "Anguitextrix algarum",
      fact:
        "An eel-bodied spirit of the holdfast tangle. It braids loose roots " +
        "back into the rock in slow figure-eights, and the groves it keeps " +
        "never lose their grip in a storm.",
      codexLine: "It mends the forest's hold with its own body, one patient knot at a time.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// region's collision contract and the tests read them back.
export { buildSeals };
