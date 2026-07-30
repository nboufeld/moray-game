import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { CURATOR_SPECIES_ID, buildCurator } from "./CalamityCurator";
import { buildCalamityDistance } from "./CalamityDistance";
import { buildCalamityFillLife } from "./CalamityFillLife";
import { buildCalamityForest } from "./CalamityForest";
import { buildCalamityGround } from "./CalamityGround";
import { buildCalamityLife } from "./CalamityLife";
import { buildCalamityLight } from "./CalamityLight";
import { buildCalamityLitter } from "./CalamityLitter";
import { buildCalamityRubble } from "./CalamityRubble";
import { buildCalamitySeeps } from "./CalamitySeeps";
import {
  CALAMITY_SLOT,
  CENTER_X,
  CENTER_Z,
  LAST_GROVE,
  WOUND,
  calamityCeiling,
  calamityTerrainTarget,
  calamityWeight,
  marchChannelCenter,
  marchChannelHalf,
  marchFloor,
  spokeOf,
  tongueHalfWidth,
  worldOf,
} from "./CalamityTerrain";

/**
 * THE SUNKEN CALAMITY — region `sunken-calamity-1`, the sixteenth slot.
 *
 * The country past the Ruins Terrace was the terrace-builders' own: a
 * paved garden-country of shrines and kelp meadows — and the sea kept a
 * held breath under its pavement. One still night it exhaled. The
 * pavement rose as one slab and fell as ten thousand stones; the kelp sea
 * was laid down pointing away from the wound; the water turned to ash-milk
 * for a season, and everything that breathed it stopped.
 *
 * What remains is a ruin with a pulse: the Long Sorrow, a five-hundred-
 * metre march through the blast's staged annunciation; the Shatterfield's
 * fallen pavement; the Ghost Forest's clock-hand dead; the Wound itself,
 * still breathing cold silver up its terraced bowls; the Seep Gardens,
 * where life came back wrong; and, behind the ridge that took the blast's
 * edge, the Last Grove — one pocket of the old world's green, kept.
 *
 * Pure half here and in `CalamityTerrain`; built half in the sibling
 * modules. Every stream is `SEEDS.regionCalamity` or a `^` substream.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver the moment they reach weight = 0,
// so the domain's open edges are walled with spheres the way the pilot's
// are: a ring just inside the disc's rim (where the ceiling has already
// closed to 3.4 m, so one row seals floor to ceiling), and a row along
// each of the march's bank crests. The rim ring leaves a gate over the
// tongue's corridor, which the march rows themselves seal.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  // The rim ring. The gate over the march's corridor is cut to the
  // *channel's* width, not the tongue's — the tongue's wide shoulders at
  // the disc's edge must stay walled, or the wedge between the march rows
  // and the ring is an open door to weight-zero water.
  const rimR = 206;
  const count = 94;
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = CENTER_X + Math.cos(theta) * rimR;
    const z = CENTER_Z + Math.sin(theta) * rimR;
    const { u, v } = spokeOf(x, z);
    const uc = Math.min(u, 505);
    if (u < 525 && Math.abs(v - marchChannelCenter(uc)) < marchChannelHalf(uc) + 12) {
      continue;
    }
    seals.push({
      center: new Vector3(x, calamityTerrainTarget(x, z) + 1.5, z),
      radius: 9,
    });
  }

  // The mouth stacks: the seam tongue is only 8.2 m wide, so the doorway
  // takes three small spheres per side per station — a tight door is what
  // a doorway is, and the wing's own walls carry everything below r ≈ 50.
  for (const u of [48, 54, 60, 66]) {
    const lateral = tongueHalfWidth(u) - 0.5;
    const floor = marchFloor(u);
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * lateral);
      for (const level of [2, 7.5, 13]) {
        seals.push({ center: new Vector3(x, floor + level, z), radius: 4.5 });
      }
    }
  }

  // The march's bank rows (the "you cannot cross the bank" seal) and the
  // shoulder's outer rows (the domain-edge seal): the two overlap by
  // construction — inner covers the channel flank out to wch + 20, outer
  // covers hw − 18 out past hw — so the corridor is sealed wall to ring.
  for (let u = 66; u <= 512; u += 13) {
    const vc = marchChannelCenter(u);
    const floor = marchFloor(u);
    const inner = marchChannelHalf(u) + 9;
    const outer = tongueHalfWidth(u) - 6;
    for (const side of [-1, 1]) {
      const bank = worldOf(u, vc + side * inner);
      seals.push({ center: new Vector3(bank.x, floor + 7, bank.z), radius: 11 });
      if (outer > inner + Math.abs(vc) + 2) {
        const edge = worldOf(u, side * outer);
        seals.push({
          center: new Vector3(edge.x, calamityTerrainTarget(edge.x, edge.z) + 4, edge.z),
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
  /** Absolute y instead of ground-relative, for high poses. */
  readonly absoluteY?: number;
}

const POSE_SPECS: readonly PoseSpec[] = [
  // The seam doorway: out of the terrace's gold into the first grey.
  { name: "sorrow-gate", u: 58, v: 0, lift: 2.4, atU: 100, atV: 2, pitch: -0.03 },
  // The First Dead One: a single grey giant in water still half gold.
  { name: "first-dead", u: 138, v: 2, lift: 2.4, atU: 168, atV: -2, pitch: 0.04 },
  // Mid-march, looking down-road: the fill pose over the old bare
  // stretch u 90–160 — shard carpets, relics and the lintel must carry it.
  { name: "mid-march", u: 118, v: -2, lift: 2.5, atU: 165, atV: 3, pitch: -0.04 },
  // The blast road: the shock rings standing in the sand.
  { name: "shock-rings", u: 218, v: 0, lift: 2.6, atU: 262, atV: 4, pitch: -0.06 },
  // The Drowned Gardener: the fallen guardian on the road it walked.
  { name: "the-gardener", u: 245, v: 1, lift: 2.4, atU: 253, atV: 5.5, pitch: -0.08, settle: 4 },
  // The Card House: the pavement slabs jumbled over the road.
  { name: "card-house", u: 296, v: -2, lift: 2.6, atU: 330, atV: 6, pitch: -0.02 },
  // The Suffocated Mile: the violet pool, the ghost traps. STILL ON
  // PURPOSE — the registry's grief clause (MASTER §1.2): no shoal, no
  // darts, no crabs, ash snow at an eighth, no new glow; the only fill
  // is the four amphora clusters and one bubble thread. A bare read
  // here is CORRECT.
  { name: "suffocated-mile", u: 366, v: 0, lift: 2.4, atU: 408, atV: -4, pitch: -0.04 },
  // The Wound Gate: the thrown ridge pinching the light.
  { name: "wound-gate", u: 438, v: 0, lift: 2.6, atU: 470, atV: 0, pitch: 0.02 },
  // The reveal: standing on the crest itself, the crater country opening
  // below — Shatterfield, the Great Slab, the first ghost ranks.
  { name: "the-reveal", u: 477, v: 0, lift: 4.2, atU: 585, atV: 6, pitch: -0.16 },
  // The Shatterfield causeway: swimming the fallen pavement.
  { name: "shatterfield", u: 528, v: -6, lift: 2.6, atU: 574, atV: 14, pitch: -0.03, settle: 4 },
  // The Ghost Forest: among the clock-hand dead.
  { name: "ghost-forest", u: 596, v: 8, lift: 2.8, atU: 650, atV: -12, pitch: 0.05, settle: 5 },
  // The Wound's rim: the terraced bowls falling away to the Cold Candle,
  // with the leaning watcher holding the frame's near edge.
  { name: "the-wound", u: 646, v: -26, lift: 2.6, atU: 696, atV: 0, pitch: -0.12, settle: 4 },
  // The Cold Candle: the plume, the gyre, the cold fire — close enough
  // for the chimney to fill the eye.
  { name: "cold-candle", u: 686, v: 6, lift: 5, atU: WOUND.u, atV: WOUND.v, pitch: 0.08, settle: 6 },
  // The Seep Gardens: life that came back wrong, down in the field.
  { name: "seep-gardens", u: 741, v: 47, lift: 2.2, atU: 760, atV: 60, pitch: -0.05, settle: 4 },
  // The Last Grove: green in the grey, behind the ridge.
  { name: "last-grove", u: 748, v: -60, lift: 2.8, atU: LAST_GROVE.u, atV: LAST_GROVE.v, pitch: 0.03, settle: 5 },
  // The grove lawn, looking up the survivor: standing on the inner
  // lawn (the registry rest — bare underfoot by design), the meadow and
  // the 17 m survivor climbing the green-gold fall above.
  { name: "grove-lawn", u: 774.5, v: -81, lift: 1.6, atU: 773, atV: -88, pitch: 0.28, settle: 5 },
  // The shrine: the Curator at the memorial, close enough to watch her
  // work. The aim rides a step off the anchor so the settle does not
  // complete a discovery and drop the ceremony plate over the frame.
  { name: "the-shrine", u: 767, v: -79, lift: 1.8, atU: 772, atV: -83, pitch: -0.1, settle: 6 },
  // The Quiet Rim: the far shelf, the leaning stacks, the painted distance.
  { name: "quiet-rim", u: 846, v: 10, lift: 3, atU: 905, atV: 0, pitch: 0.02 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = spec.absoluteY ?? calamityTerrainTarget(x, z) + spec.lift;
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

export const CALAMITY_1: RegionDef = {
  slotId: CALAMITY_SLOT.id,
  title: "The Sunken Calamity",
  emotion: "composed devastation — a ruin with a pulse, grief that keeps gardening",

  weight: calamityWeight,
  terrainTarget: calamityTerrainTarget,
  ceiling: calamityCeiling,
  floorClearance: 0.7,

  mood: {
    // Ash water: the gold drained out, and the milk came down a step in
    // round 2 — grey-teal that stays *under* the region's pale subjects
    // so bone, sinter and shell can ghost against it (the first draft's
    // near-white milk washed every subject into a dark cut-out). Red cut
    // hardest so the haze goes grey-cool, never electric; density keeps
    // the devastation's weather but lets the vistas breathe to ~65 m.
    fog: { colorScale: [0.66, 0.75, 0.82], densityGain: 0.0035, backdropFade: 0.35 },
    light: { sun: 0.16, hemisphere: 0.22, ambient: 0.08 },
  },
  // The mood fades out above 14 m: climbing the crater's open column back
  // toward the light is the region's one kindness, carried by the one
  // mechanism the def owns.
  moodSurface: 14,
  moodDescent: 8,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-sunken-calamity-1";

    const rubble = buildCalamityRubble();
    const forest = buildCalamityForest();
    const seeps = buildCalamitySeeps();
    const life = buildCalamityLife(seeps.plume);
    const litter = buildCalamityLitter();
    const fillLife = buildCalamityFillLife(forest.ghosts);
    const curator = buildCurator();
    const light = buildCalamityLight();
    const distance = buildCalamityDistance();
    const ground = buildCalamityGround([
      ...rubble.contacts,
      ...forest.contacts,
      ...seeps.contacts,
      ...curator.contacts,
    ]);

    for (const mesh of [
      ...ground,
      ...rubble.meshes,
      ...forest.meshes,
      ...seeps.meshes,
      ...life.meshes,
      ...litter.groups,
      ...fillLife.groups,
      ...curator.meshes,
      ...light.meshes,
      ...distance.meshes,
    ]) {
      group.add(mesh);
    }

    const colliders = [
      ...rubble.colliders,
      ...forest.colliders,
      ...seeps.colliders,
      ...curator.colliders,
      ...buildSeals(),
    ];

    return {
      group,
      colliders,
      targets: [curator.target],
      update(dt, ctx): void {
        forest.update(dt, ctx.reducedMotion);
        seeps.update(dt, ctx.time, ctx.reducedMotion);
        life.update(dt, ctx.time, ctx.reducedMotion);
        curator.update(ctx.time, ctx.reducedMotion);
        const calm = ctx.reducedMotion ? 0.45 : 1;
        litter.update(ctx.time * calm);
        fillLife.update(ctx.time * calm);
        light.update(ctx.time, ctx.reducedMotion);
      },
    };
  },

  codexEntries: [
    {
      id: CURATOR_SPECIES_ID,
      commonName: "Ashkeeper Octopus",
      scientificName: "Octopus cinerarius",
      fact:
        "Since the night the sea exhaled, this small grey octopus has gathered " +
        "the drowned country's bright little things — shells, beads, pot-glass — " +
        "into one shining pile behind the ridge, and it tends the pile every day. " +
        "Octopuses collect. Grief arranges.",
      codexLine: "It keeps what the sea took, one shell at a time, in the only green room left.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// region's collision contract and the tests read them back.
export { buildSeals };
