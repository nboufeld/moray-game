import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildVerdant2Distance } from "./Verdant2Distance";
import { buildVerdant2Gardens } from "./Verdant2Gardens";
import { buildVerdant2Ground } from "./Verdant2Ground";
import { buildVerdant2Life } from "./Verdant2Life";
import { buildVerdant2Light } from "./Verdant2Light";
import { buildMistfall } from "./Verdant2Mistfall";
import { buildVerdant2Stone } from "./Verdant2Stone";
import { WARDEN_SPECIES_ID, buildWarden } from "./Verdant2Warden";
import {
  BALCONY,
  CISTERN,
  FERN_VAULT,
  MISTFALL,
  VERDANT2_SLOT,
  passGate,
  passHalfWidth,
  spokeOf,
  stairChannelCenter,
  verdant2Ceiling,
  verdant2TerrainTarget,
  verdant2Weight,
  worldOf,
} from "./Verdant2Terrain";

/**
 * THE EMERALD TERRACES — region `verdant-line-2`, province The Verdant
 * Line, the game's first depth-2 region.
 *
 * Deeper, older, stranger than the kelp sea. A drowned cliff country:
 * great stone terraces stepping down through green mist, hanging gardens
 * spilling over every ledge, water thicker and greener than the
 * forest's, light arriving in long diagonal blades. The Emerald Stair
 * descends from the Great Kelp Sea's far rim — the pass is a place, not
 * a corridor — into the Hanging Gardens; the Cistern holds its mirror
 * stillness inside a worked stone ring; the Fern Vault keeps its
 * half-light under a shelf of stone; the Mistfall pours a slow waterfall
 * of silt down the country's one great cliff into the basin; and the Far
 * Balcony juts over the deep to look at the painted cliff-lines that
 * promise depth 3.
 *
 * Pure half in `Verdant2Terrain`; built half in the sibling modules.
 * Every stream is `SEEDS.regionVerdant2` or a `^` substream.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver at weight = 0, so the open
// edges are walled: a rim ring of two-sphere stacks just inside the
// disc's edge (gated open over the pass corridor, which the flank rows
// seal), and rows along the pass tongue's shoulders from the kelp sea's
// rim down to the stair's foot. The threshold's mouth needs no seal of
// its own: behind it the Great Kelp Sea's domain and walls take over —
// that is the handover working.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  // The rim ring: stacks of two spheres so the taller near-rim columns
  // (the ceiling closes to 3.4 only by rc ≈ 212) are covered to the top.
  const rimR = 198;
  const count = 92;
  const center = worldOf(940, 0);
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = center.x + Math.cos(theta) * rimR;
    const z = center.z + Math.sin(theta) * rimR;
    const { u, v } = spokeOf(x, z);
    if (passGate(u, v) > 0.3) {
      continue;
    }
    const floor = verdant2TerrainTarget(x, z);
    seals.push(
      { center: new Vector3(x, floor + 1.5, z), radius: 9 },
      { center: new Vector3(x, floor + 8.5, z), radius: 7 },
    );
  }

  // The pass shoulders: rows down both flanks from the kelp sea's rim to
  // the stair's foot, standing just inside the tongue's edge where the
  // weight is still positive. Stacked to cover the vaulting ceiling.
  for (let u = 656; u <= 800; u += 13) {
    // Just inside the tongue's edge, but never pinching the corridor
    // tighter than ±20.5 at the narrow threshold end.
    const hw = passHalfWidth(u);
    const edge = Math.min(hw - 1.2, Math.max(hw - 4, 20.5));
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * edge);
      const floor = verdant2TerrainTarget(x, z);
      seals.push({ center: new Vector3(x, floor + 2, z), radius: 9 });
      seals.push({ center: new Vector3(x, floor + 9, z), radius: 8 });
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
  // From the kelp sea's side of the overlap, looking into the country —
  // the pass pose the handover is judged by.
  { name: "pass-threshold", u: 650, v: 0, lift: 1.8, atU: 720, atV: 2, pitch: 0.0 },
  // The Emerald Gate: the jambs, the first riser falling away.
  { name: "emerald-gate", u: 722, v: 0, lift: 2.2, atU: 748, atV: 2, pitch: -0.05 },
  // Mid-stair: steps and ledge gardens descending into thicker green.
  { name: "stair-descent", u: 764, v: 0, lift: 2.8, atU: 810, atV: 0, pitch: -0.12 },
  // The stair's foot: the Hanging Gardens opening in one breath.
  { name: "gardens-vista", u: 846, v: -4, lift: 3.4, atU: 905, atV: -18, pitch: -0.07 },
  // The Slab Bridge over the garden riser, swim-under in frame.
  { name: "slab-bridge", u: 862, v: -26, lift: 2.0, atU: 878, atV: -36, pitch: -0.03 },
  // The turtle procession grazing the terrace line.
  { name: "turtle-terraces", u: 886, v: -28, lift: 3.2, atU: 902, atV: -50, pitch: 0.0, settle: 8 },
  // The grotto behind the green curtain — the Warden's rounds. The aim
  // rides a step off the anchor so the settle does not complete a
  // discovery and drop the ceremony plate over the frame being judged.
  { name: "curtain-grotto", u: 882, v: 14, lift: 2.0, atU: 892, atV: 27, pitch: 0.04, settle: 6 },
  // The Cistern from its rim: the ring stones and the mirror floor.
  { name: "cistern", u: 897, v: 52, lift: 2.8, atU: CISTERN.u, atV: CISTERN.v, pitch: -0.16, settle: 4 },
  // Inside the Fern Vault's half-light, fronds against the stone sky.
  { name: "fern-vault", u: 918, v: -76, lift: 1.8, atU: FERN_VAULT.u - 4, atV: FERN_VAULT.v - 2, pitch: 0.05 },
  // The Mistfall from above: the lip, the pour, the basin far below.
  { name: "mistfall-above", u: 984, v: 10, lift: 2.8, atU: 1022, atV: 16, pitch: -0.3, settle: 4 },
  // The Mistfall from below: the whole cliff face and its falling milk.
  { name: "mistfall-below", u: 1030, v: 24, lift: 2.4, atU: MISTFALL.u, atV: MISTFALL.v, pitch: 0.32, settle: 4 },
  // The Far Balcony: balustrade, the deep, the painted cliff-lines.
  { name: "far-balcony", u: 1044, v: 38, lift: 2.2, atU: 1090, atV: 52, pitch: 0.06 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = verdant2TerrainTarget(x, z) + spec.lift;
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

export const VERDANT_2: RegionDef = {
  slotId: VERDANT2_SLOT.id,
  title: "The Emerald Terraces",
  emotion: "drowned garden country — descend, and be kept",

  weight: verdant2Weight,
  terrainTarget: verdant2TerrainTarget,
  ceiling: verdant2Ceiling,
  floorClearance: 0.7,

  mood: {
    // Thicker and greener than the kelp sea's water, by ratio — red is
    // held (the value key's first rule) so the green never turns
    // electric; the density gain closes the vistas a step sooner than
    // upstream, which is what "deeper country" feels like.
    fog: { colorScale: [0.74, 0.9, 0.66], densityGain: 0.0045, backdropFade: 0.4 },
    light: { sun: 0.2, hemisphere: 0.16, ambient: 0.02 },
  },
  // The country lives 22–46 m down; the mood is fully on well above the
  // terrace crowns and eases out toward the threshold's swim height, so
  // the climb back up the stair is a climb back toward the kelp sea's
  // brighter green.
  moodSurface: 14,
  moodDescent: 10,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-verdant-line-2";

    const stone = buildVerdant2Stone();
    const gardens = buildVerdant2Gardens();
    const life = buildVerdant2Life();
    const warden = buildWarden(stone.grotto);
    const light = buildVerdant2Light();
    const mistfall = buildMistfall();
    const distance = buildVerdant2Distance();
    const ground = buildVerdant2Ground([...stone.contacts, ...gardens.contacts]);

    for (const mesh of [
      ...ground,
      ...stone.meshes,
      ...gardens.meshes,
      ...life.meshes,
      warden.mesh,
      ...light.meshes,
      ...mistfall.meshes,
      ...distance.meshes,
    ]) {
      group.add(mesh);
    }

    const colliders = [...stone.colliders, ...buildSeals()];

    return {
      group,
      colliders,
      targets: [warden.target],
      update(dt, ctx): void {
        gardens.update(dt, ctx.reducedMotion);
        life.update(dt, ctx.time, ctx.reducedMotion);
        warden.update(ctx.time, ctx.reducedMotion);
        mistfall.update(dt, ctx.reducedMotion);
      },
    };
  },

  codexEntries: [
    {
      id: WARDEN_SPECIES_ID,
      commonName: "Terrace Warden",
      scientificName: "Custos pensilis",
      fact:
        "A newt-bodied spirit of the hanging gardens, old as the stones it " +
        "patrols. Where the current tears a ribbon loose, the Warden presses " +
        "it back into the rock with its brow — the terraces have not lost a " +
        "garden in a thousand years.",
      codexLine: "It keeps the gardens hanging — leaf by leaf, ledge by ledge.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// region's collision contract and the tests read them back.
export { buildSeals };

// Re-exported so the tests can reason about the landmark placements
// without re-deriving them.
export { BALCONY, CISTERN, FERN_VAULT, MISTFALL, stairChannelCenter };
