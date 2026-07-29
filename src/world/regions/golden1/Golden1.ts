import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildGoldenDistance } from "./GoldenDistance";
import { buildGoldenFalls } from "./GoldenFalls";
import { buildGoldenGlass } from "./GoldenGlass";
import { buildGoldenGround } from "./GoldenGround";
import { KEEPER_SPECIES_ID, buildKeeper } from "./GoldenKeeper";
import { buildGoldenLife } from "./GoldenLife";
import { buildGoldenLight } from "./GoldenLight";
import { buildGoldenOasis } from "./GoldenOasis";
import { buildGoldenRocks } from "./GoldenRocks";
import {
  CENTER_X,
  CENTER_Z,
  GLASS,
  GOLDEN_SLOT,
  HOURGLASS,
  OASIS_A,
  goldenCeiling,
  goldenTerrainTarget,
  goldenWeight,
  saddleChannelCenter,
  saddleChannelHalf,
  saddleFloor,
  spokeOf,
  tongueHalfWidth,
  worldOf,
} from "./GoldenTerrain";

/**
 * THE HOURGLASS SEA — region `golden-waste-1`, province The Golden Waste.
 *
 * The Sandfall Dunes wing was a quiet room of falling sand; this is the
 * desert it came from — a golden dune ocean where the sand itself is the
 * living element, and the mood is meditation at landscape scale: vast,
 * warm, slow, quietly surreal. A honey-warm dune saddle winds out of the
 * wing to a lip that opens on the Dune Ocean's ranked crescents; the
 * Hourglass — a vast circular chasm the whole desert drains into —
 * pours sandfalls over its lip all the way round, past terraced ledges
 * into a violet-warm deep where the Hourglass Keeper circles; the Glass
 * Reach stands its fused pale fins over old trenches; the Oasis Hollows
 * shelter sea-palms, gold seagrass and the region's densest life; the
 * Singing Flats spread ripple-plains under lone monoliths and their long
 * violet shadows, garden eels rising and drawing back, a caravan of
 * great rays crossing in single file; and the far rim dissolves into
 * stacked gold-to-violet dune lines.
 *
 * Pure half in `GoldenTerrain`; built half in the sibling modules.
 * Every stream is `SEEDS.regionGolden1` or a `^` substream.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver the moment they reach weight = 0,
// so the domain's open edges are walled with spheres the pilots' way: a
// ring just inside the disc's rim (where the ceiling has already closed
// to 3.4 m), rows along the saddle's shoulder crests, and stacks at the
// doorway. The rim ring leaves a gate over the saddle's corridor, which
// the saddle rows themselves seal.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  // The rim ring, gated only over the saddle channel's own width.
  const rimR = 206;
  const count = 94;
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = CENTER_X + Math.cos(theta) * rimR;
    const z = CENTER_Z + Math.sin(theta) * rimR;
    const { u, v } = spokeOf(x, z);
    const uc = Math.min(u, 285);
    if (u < 310 && Math.abs(v - saddleChannelCenter(uc)) < saddleChannelHalf(uc) + 12) {
      continue;
    }
    seals.push({
      center: new Vector3(x, goldenTerrainTarget(x, z) + 1.5, z),
      radius: 9,
    });
  }

  // The mouth stacks: the seam tongue is 8.2 m wide, so the doorway takes
  // three small spheres per side per station under the 10 m ceiling.
  for (const u of [48, 54, 60, 66]) {
    const lateral = tongueHalfWidth(u) - 0.5;
    const floor = saddleFloor(u);
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * lateral);
      for (const level of [2, 6.5, 11]) {
        seals.push({ center: new Vector3(x, floor + level, z), radius: 4.5 });
      }
    }
  }

  // The saddle's shoulder rows (inner, at the wall crest) and the outer
  // rows (at the tongue edge) — overlapping by construction, so the
  // corridor is sealed wall to ring.
  for (let u = 66; u <= 292; u += 13) {
    const vc = saddleChannelCenter(u);
    const floor = saddleFloor(u);
    const inner = saddleChannelHalf(u) + 10;
    const outer = tongueHalfWidth(u) - 6;
    for (const side of [-1, 1]) {
      const wall = worldOf(u, vc + side * inner);
      seals.push({ center: new Vector3(wall.x, floor + 6.5, wall.z), radius: 11 });
      if (outer > inner + Math.abs(vc) + 2) {
        const edge = worldOf(u, side * outer);
        seals.push({
          center: new Vector3(edge.x, goldenTerrainTarget(edge.x, edge.z) + 4, edge.z),
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
  // The saddle's descent: honey walls, the channel winding away.
  { name: "saddle-descent", u: 96, v: 0, lift: 2.4, atU: 140, atV: 3, pitch: -0.04 },
  // The first crescents and the second vale fall — the wing's idiom
  // continuing into open country.
  { name: "first-crescent", u: 146, v: 0, lift: 2.2, atU: 172, atV: 6, pitch: 0.02, settle: 4 },
  // The reveal: standing at the lip, the Dune Ocean opening below —
  // the first ribboned crescent smoking thirty metres out.
  { name: "saddle-reveal", u: 252, v: 0, lift: 2.6, atU: 300, atV: 10, pitch: -0.12 },
  // The Dune Ocean: ranked crescents layering gold into the fog.
  { name: "dune-ocean", u: 306, v: -8, lift: 2.8, atU: 352, atV: 18, pitch: 0.0, settle: 4 },
  // The slip-face: the shoal surfing the dune's steep lee. The stand
  // point is corrected at build time to the scanned crest (round 2's
  // authored guess stood buried in the dune's own windward slope).
  { name: "slip-face", u: 330, v: 30, lift: 3.0, atU: 344, atV: 12, pitch: 0.02, settle: 6 },
  // The Glass Reach: pale fins and the Fused Arch.
  { name: "glass-reach", u: 378, v: -56, lift: 2.6, atU: GLASS.u + 4, atV: GLASS.v - 2, pitch: 0.03 },
  // The Hourglass from its lip: composing DOWN into the chasm — the
  // ring of sandfalls, the terraces, the violet deep. The stand point
  // sits BETWEEN two falls (round 1 stood inside fall 7's own veil).
  { name: "hourglass-lip", u: 405, v: 17, lift: 3.0, atU: HOURGLASS.u, atV: HOURGLASS.v, pitch: -0.5, settle: 5 },
  // From a terrace inside: composing UP out of it — falls overhead,
  // the lip's ring of light.
  { name: "hourglass-deep", u: 437, v: 22, lift: 2.4, atU: 478, atV: 46, pitch: 0.65, settle: 6 },
  // The Keeper's water: the deep floor, the golden ring passing.
  { name: "keeper-deep", u: 448, v: 16, lift: 2.2, atU: 468, atV: 42, pitch: 0.3, settle: 8 },
  // The Oasis Hollows: palms, gold grass, the tender counterpoint.
  { name: "oasis", u: 502, v: -50, lift: 2.4, atU: OASIS_A.u, atV: OASIS_A.v, pitch: 0.02, settle: 5 },
  // The Singing Flats: monoliths, long violet shadows, garden eels.
  { name: "singing-flats", u: 512, v: 62, lift: 2.6, atU: 540, atV: 92, pitch: 0.02, settle: 5 },
  // The caravan's crossing: the file circles the flats, so from here
  // some of it is always inside the fog.
  { name: "ray-crossing", u: 496, v: 60, lift: 3.4, atU: 528, atV: 84, pitch: 0.1, settle: 6 },
  // The Gilded Shore: the shelf, the stacks, the painted distance.
  { name: "gilded-shore", u: 585, v: 30, lift: 3, atU: 645, atV: 20, pitch: 0.02 },
];

function buildPoses(): RegionCapturePose[] {
  // The slip-face pose rides the same crest scan the shoal and the
  // ribbons use, so all three always agree which dune is the subject.
  const laneV = 14;
  let crestU = 330;
  let crestY = -Infinity;
  for (let u = 330; u <= 330 + 46; u += 0.5) {
    const spot = worldOf(u, laneV);
    const y = goldenTerrainTarget(spot.x, spot.z);
    if (y > crestY) {
      crestY = y;
      crestU = u;
    }
  }

  return POSE_SPECS.map((spec) => {
    const resolved =
      spec.name === "slip-face"
        ? { ...spec, u: crestU - 13, v: laneV + 16, atU: crestU + 5, atV: laneV - 2 }
        : spec;
    const { x, z } = worldOf(resolved.u, resolved.v);
    const y = goldenTerrainTarget(x, z) + resolved.lift;
    const at = worldOf(resolved.atU, resolved.atV);
    return {
      name: resolved.name,
      position: [x, y, z] as const,
      yaw: yawToward(x, z, at.x, at.z),
      pitch: resolved.pitch,
      settle: resolved.settle ?? 2.5,
    };
  });
}

// ─── The def ─────────────────────────────────────────────────────────────────

export const GOLDEN_1: RegionDef = {
  slotId: GOLDEN_SLOT.id,
  title: "The Hourglass Sea",
  emotion: "meditation at landscape scale — vast, warm, slow, quietly surreal",

  weight: goldenWeight,
  terrainTarget: goldenTerrainTarget,
  ceiling: goldenCeiling,
  floorClearance: 0.7,

  mood: {
    // Honey-gold water: the hook multiplies in LINEAR space, where the
    // base water is (0.086, 0.443, 0.494) — the Smoulder's measured
    // lesson. Red 3.6 buys (0.31, …); green is held just under it and
    // blue cut hard, so the product (0.31, 0.257, 0.128) is the warm
    // gold the whole palette keys to. Round 1 ran density 0.0045 for
    // "vast" and learned the Smoulder's warm sky is mostly *fog*: at
    // low density the cyan backdrop dominates every frame above eye
    // level. 0.007 keeps ~70 m of vista and owns the sky.
    fog: { colorScale: [3.6, 0.58, 0.26], densityGain: 0.007, backdropFade: 0.5 },
    light: { sun: 0.26, hemisphere: 0.26, ambient: 0.13 },
  },
  moodSurface: 20,
  moodDescent: 9,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-golden-waste-1";

    const rocks = buildGoldenRocks();
    const glass = buildGoldenGlass();
    const oasis = buildGoldenOasis();
    const falls = buildGoldenFalls();
    const keeper = buildKeeper();
    const life = buildGoldenLife();
    const light = buildGoldenLight();
    const distance = buildGoldenDistance();
    const ground = buildGoldenGround([
      ...rocks.contacts,
      ...glass.contacts,
      ...oasis.contacts,
    ]);

    for (const mesh of [
      ...ground,
      ...rocks.meshes,
      ...glass.meshes,
      ...oasis.meshes,
      ...falls.meshes,
      ...keeper.meshes,
      ...life.meshes,
      ...light.meshes,
      ...distance.meshes,
    ]) {
      group.add(mesh);
    }

    const colliders = [
      ...rocks.colliders,
      ...glass.colliders,
      ...oasis.colliders,
      ...buildSeals(),
    ];

    return {
      group,
      colliders,
      targets: [keeper.target],
      update(dt, ctx): void {
        falls.update(dt, ctx.reducedMotion);
        oasis.update(dt, ctx.reducedMotion);
        life.update(dt, ctx.time, ctx.reducedMotion, ctx.diverPosition);
        keeper.update(ctx.time, ctx.reducedMotion);
      },
    };
  },

  codexEntries: [
    {
      id: KEEPER_SPECIES_ID,
      commonName: "Hourglass Keeper",
      scientificName: "Chelonia clepsydrae",
      fact:
        "An ancient turtle-spirit that circles the great chasm the way " +
        "sand circles a drain. The gold runnel spiralling its shell is " +
        "said to be the desert's own hour being kept — while it swims, " +
        "the sandfalls never run dry.",
      codexLine: "It keeps the desert's hour, one slow circle at a time.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// region's collision contract and the tests read them back.
export { buildSeals };
