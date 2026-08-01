import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildCarillon } from "./Golden2Carillon";
import { buildGolden2Cover } from "./Golden2Cover";
import { buildGolden2Distance } from "./Golden2Distance";
import { buildGolden2Ground } from "./Golden2Ground";
import { buildGolden2Life } from "./Golden2Life";
import { buildGolden2Light } from "./Golden2Light";
import { NAUTILUS_SPECIES_ID, buildNautilus } from "./Golden2Nautilus";
import { buildGolden2Rocks } from "./Golden2Rocks";
import { buildSeeps } from "./Golden2Seeps";
import { buildWindows } from "./Golden2Windows";
import {
  CENTER_X,
  CENTER_Z,
  GOLDEN2_SLOT,
  golden2Ceiling,
  golden2TerrainTarget,
  golden2Weight,
  gullyChannelCenter,
  gullyChannelHalf,
  passGate,
  passHalfWidth,
  spokeOf,
  worldOf,
} from "./Golden2Terrain";

/**
 * THE CARILLON WASTE — region `golden-waste-2`, province The Golden
 * Waste, depth 2. No gateway wing: the inbound connection is the pass
 * the Hourglass Sea's ledger reserved at its Gilded Shore stacks.
 *
 * The Hourglass Sea was the desert's sand; this is the desert's BONE —
 * the wind-carved honey sandstone country the dunes were milled from,
 * and the place the desert's wind LIVES: fluted spires the currents
 * ring like bells. The Shore Road runs out past the pilot's leaning
 * stacks into the Wind Gully's fluted descent; the Hoodoo Court ranks
 * its capped spires under long violet shadows; the Windows wall stands
 * pierced against the sky with the Great Arch as its door; the Ribbon
 * cuts the pavement to a violet slot-canyon deep with the Light Well
 * burning at its elbow and the Anchorite's Cell holding its stillness;
 * the Seep Terraces bench green-gold spring pools down travertine
 * steps; THE CARILLON raises five fluted towers over a swept pavement
 * where the Noon Bell falls and the Bell Ringer — an ancient chambered
 * nautilus — rises out of the Belfry's hollow crown on the hour; and
 * the Sunset Shelf's framing spires reserve the depth-3 pass, the way
 * the Gilded Shore once reserved this one.
 *
 * Pure half in `Golden2Terrain`; built half in the sibling modules.
 * Every stream is `SEEDS.regionGolden2` or a `^` substream. Built to
 * the full R12 standard from the first draft: no wedge era, no
 * separate fill pass — density, quality, light and life ARE the build.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver the moment they reach
// weight = 0, so the domain's open edges are walled with spheres: a
// ring just inside the disc's rim (where the ceiling has already
// closed to 3.4 m), gated open over the inbound pass corridor, and
// double rows along the pass's shoulders. The threshold's mouth needs
// no seal: behind it the Hourglass Sea's own domain and walls take
// over — that is the handover.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  // The rim ring, gated over the inbound pass corridor and — now that
  // the Vesper Strand exists to catch the diver — over the depth-3
  // corridor at the far pole too (R0.7 integration of its flagged
  // gate: the Strand's own shoulder seals stand at |v| = 15 over
  // u 1136–1248, so the flanks stay sealed the moment this opens).
  const rimR = 206;
  const count = 94;
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = CENTER_X + Math.cos(theta) * rimR;
    const z = CENTER_Z + Math.sin(theta) * rimR;
    const { u, v } = spokeOf(x, z);
    if (passGate(u, v) > 0.25) {
      continue;
    }
    if (u > 1130 && Math.abs(v) < 15) {
      continue;
    }
    seals.push({
      center: new Vector3(x, golden2TerrainTarget(x, z) + 1.5, z),
      radius: 9,
    });
  }

  // The pass shoulders: double rows down the shore road and the gully
  // (inner at the wall crest, outer at the tongue edge), overlapping
  // by construction so the corridor is sealed wall to ring.
  for (let u = 648; u <= 828; u += 13) {
    const vc = gullyChannelCenter(u);
    const inner = u < 744 ? 16 : gullyChannelHalf(u) + 9;
    const outer = passHalfWidth(u) - 5;
    for (const side of [-1, 1]) {
      const wall = worldOf(u, vc + side * inner);
      seals.push({
        center: new Vector3(wall.x, golden2TerrainTarget(wall.x, wall.z) + 5.5, wall.z),
        radius: 10.5,
      });
      if (outer > inner + Math.abs(vc) + 2) {
        const edge = worldOf(u, side * outer);
        seals.push({
          center: new Vector3(edge.x, golden2TerrainTarget(edge.x, edge.z) + 4, edge.z),
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
  // The Shore Road: waymark pairs pacing out of the Hourglass Sea's
  // milky shore; the Hourglass Sea's own distance rings stand between
  // this camera and everything of ours past u ≈ 731 — the Emerald Gate
  // lesson says that is CORRECT: from here the rings ARE the promise.
  // Round 3: walked forward a pace — from 658 the first waymark pair
  // sat behind the camera and the road read as one stack in a fog.
  // Then half a pace BACK with the horizon dropped: from 668 the 678
  // pair fell abeam and got cut at the frame's edge over a half-empty
  // sky (r3 capture).
  { name: "shore-road", u: 663, v: 4, lift: 2.4, atU: 706, atV: -4, pitch: -0.04 },
  // The Chime Gate: the fluted jambs framing the gully's descent. The
  // camera stands PAST the pilot's outermost ring (u ≈ 731).
  { name: "chime-gate", u: 735, v: 0, lift: 2.4, atU: 754, atV: 0, pitch: -0.04 },
  // The Wind Gully: the fluted walled descent, boulders and pockets.
  { name: "wind-gully", u: 762, v: 0, lift: 2.6, atU: 788, atV: -2, pitch: -0.07, settle: 3 },
  // The reveal: the gully's foot, the Hoodoo Court opening in one
  // breath — ranked capped spires into the fog, the reveal beam beside.
  { name: "court-reveal", u: 814, v: 1, lift: 3.4, atU: 856, atV: -10, pitch: -0.06, settle: 4 },
  // Among the ranks: hoodoos, long violet shadows, the road threading.
  { name: "hoodoo-court", u: 872, v: -30, lift: 2.7, atU: 910, atV: -4, pitch: 0.0, settle: 4 },
  // The Windows wall taken ALONG its own crest (round 2 — the r1
  // frontal stand met a smooth dune flank): fins overlapping into a
  // broken colonnade, windows of water between.
  { name: "windows-wall", u: 846, v: 14, lift: 4.5, atU: 872, atV: 66, pitch: 0.0 },
  // The Great Arch from the court side: the doorway of light with the
  // seep gardens' green through it (the r1 stand sat on the fin line).
  { name: "great-arch", u: 856, v: 46, lift: 2.4, atU: 866, atV: 60.5, pitch: 0.04, settle: 4 },
  // The Ribbon's mouth: the pavement cracking open, lip slabs pacing it.
  { name: "ribbon-mouth", u: 898, v: -20, lift: 2.8, atU: 924, atV: -46, pitch: -0.14 },
  // Inside the slot at the Light Well: amber blades falling between
  // violet walls — the region's vertical drama, composed from within.
  { name: "ribbon-depths", u: 946, v: -54, lift: 2.2, atU: 970, atV: -68, pitch: 0.12, settle: 4 },
  // The Anchorite's Cell: the registered rest, framed as composed
  // stillness from the chamber's BACK WALL looking out (round 3, twice
  // — the mouth stand cleared its sightline but a 19 m curved wall at
  // 12 m fills a 70° frame with featureless stone; a rest reads only
  // against its own door): the licensed thin blade falls centre-frame
  // over the bare floor, the mouth's sill and the slot's lit wall
  // stack behind it.
  { name: "anchorite-cell", u: 962, v: -81, lift: 2.2, atU: 964, atV: -71, pitch: 0.14, settle: 3 },
  // The Seep Terraces: travertine benches, pools, bubbles, gardens.
  // Round 3: up to the HIGH shoulder looking down the staircase — the
  // r2 stand framed sward with every pool out of shot left, and the
  // first r3 draft looked up a riser wall (caught by the sightline
  // probe, not a capture).
  { name: "seep-terraces", u: 962, v: 102, lift: 5.8, atU: 976, atV: 66, pitch: -0.09, settle: 4 },
  // The Carillon from the road: five fluted towers rising over the
  // court — the region's proof shot.
  { name: "carillon", u: 994, v: -20, lift: 3.6, atU: 1030, atV: -18, pitch: 0.06, settle: 4 },
  // The Pavement: the swept circle, the Noon Bell striking it, towers
  // all around — the rest, framed on purpose.
  { name: "noon-bell", u: 1032, v: -35, lift: 2.3, atU: 1030, atV: -14, pitch: 0.1, settle: 4 },
  // The Belfry: looking up the tallest tower at the bell mouth — the
  // Bell Ringer rises through this frame once a breath. Backed out in
  // round 2: at 10 m the whole frame was the shaft's shade side.
  { name: "belfry", u: 1018, v: -14, lift: 2.4, atU: 1033, atV: 1, pitch: 0.42, settle: 8 },
  // The swift wheel, watched from outside the towers: the whole
  // thermal fits the frame (a centrepiece that cannot leave the frame
  // needs no phase luck).
  { name: "swift-wheel", u: 1055, v: 14, lift: 6.0, atU: 1035, atV: -4, pitch: 0.1, settle: 6 },
  // The Sunset Shelf: the framing spires and the painted mesa lines —
  // the depth-3 promise. Re-aimed in round 2 OFF the outbound ring
  // gap; swung further in round 3 with the ring taper shortened (the
  // r2 sightline crossed the rings inside the old 1.1 rad taper, where
  // every column still topped out below ground).
  // …and lifted high off the court floor: the shelf RISES ~8 m between
  // the old stand and the rim, and a level sightline from lift 3 died
  // in the rise 43 m out (the probe again). The promise is a vista;
  // the camera swims up for it.
  // Round 4: the aim swung from 45° off the outbound axis to ~24° —
  // by ARITHMETIC the r3 aim crossed the mesa ring at ~146 m of
  // camera distance, inside its own 140–157 m self-dissolve, so the
  // promise dissolved itself out of its own shot; at 24° the ring sits
  // at ~129 m (opaque) and both framing spires bracket the reserved
  // gap.
  // Round 4b: …and the SAME arithmetic run for the taper showed the
  // 24° column still tapered to nothing (offOut 0.20, end ≈ 0.02) —
  // the taper (0.32 → 0.16, see Golden2Distance) and an ON-AXIS aim
  // finish it: the reservation looked at straight, mesa flanks
  // standing opaque both sides, both spires in frame.
  { name: "sunset-shelf", u: 1064, v: -10, lift: 10.0, atU: 1110, atV: 0, pitch: 0.04 },
  // ── The close-range set (R12's still-frame bar, judged at 2–4 m) ─────────
  { name: "close-court-garden", u: 858.5, v: 9.2, lift: 1.5, atU: 862.0, atV: 12.8, pitch: -0.22, settle: 3 },
  // Round 3: backed off the rim — the r2 lens stood ON it and cut the
  // pool out of its own shot.
  { name: "close-seep-rim", u: 963.5, v: 82.5, lift: 2.2, atU: 968.5, atV: 88.5, pitch: -0.28, settle: 3 },
  { name: "close-flute-foot", u: 1040.0, v: -27.0, lift: 1.6, atU: 1044.4, atV: -31.6, pitch: -0.1, settle: 3 },
  { name: "close-arch-shards", u: 871.5, v: 52.5, lift: 1.4, atU: 869.0, atV: 55.6, pitch: -0.2, settle: 3 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = golden2TerrainTarget(x, z) + spec.lift;
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

export const GOLDEN_2: RegionDef = {
  slotId: GOLDEN2_SLOT.id,
  title: "The Carillon Waste",
  emotion: "wonder in a carved place — the wind's own cathedral, warm and ringing",

  weight: golden2Weight,
  terrainTarget: golden2TerrainTarget,
  ceiling: golden2Ceiling,
  floorClearance: 0.7,

  mood: {
    // The province's honey water, one register deeper and stonier than
    // the Hourglass Sea's (the gradient map's Golden row binds the
    // doorstep: honey over violet continues, then becomes carved
    // amber). The pilot's measured numbers are the starting point —
    // red high in linear space, blue cut hard, density paid for the
    // warm sky (its rounds 1–4 proved 0.0045→0.007 leaves raw cyan).
    fog: { colorScale: [3.5, 0.6, 0.28], densityGain: 0.009, backdropFade: 0.65 },
    light: { sun: 0.25, hemisphere: 0.27, ambient: 0.14 },
  },
  moodSurface: 20,
  moodDescent: 9,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-golden-waste-2";

    const rocks = buildGolden2Rocks();
    const carillon = buildCarillon();
    const windows = buildWindows();
    const seeps = buildSeeps();
    const nautilus = buildNautilus(carillon);
    const life = buildGolden2Life();
    const light = buildGolden2Light();
    const distance = buildGolden2Distance();
    const cover = buildGolden2Cover(windows.finFeet);
    const ground = buildGolden2Ground([
      ...rocks.contacts,
      ...carillon.contacts,
      ...windows.contacts,
    ]);

    for (const child of [
      ...ground,
      ...rocks.meshes,
      ...carillon.meshes,
      ...windows.meshes,
      seeps.group,
      ...nautilus.meshes,
      ...life.groups,
      ...light.groups,
      ...distance.meshes,
      ...cover.groups,
    ]) {
      group.add(child);
    }

    const colliders = [
      ...rocks.colliders,
      ...carillon.colliders,
      ...windows.colliders,
      ...buildSeals(),
    ];

    return {
      group,
      colliders,
      targets: [nautilus.target],
      update(dt, ctx): void {
        const calm = ctx.reducedMotion ? 0.45 : 1;
        // Every subsystem's motion is closed-form off simulated time
        // (kit law 5) — captures settle deterministically.
        nautilus.update(ctx.time, ctx.reducedMotion);
        life.update(ctx.time * calm);
        seeps.update(ctx.time * calm);
        cover.update(ctx.time * calm);
        light.update(ctx.time * calm);
        void dt;
      },
    };
  },

  codexEntries: [
    {
      id: NAUTILUS_SPECIES_ID,
      commonName: "Bell Ringer",
      scientificName: "Nautilus tintinnabuli",
      fact:
        "An ancient chambered nautilus that keeps the Carillon's hours. " +
        "Once a breath it rises out of the Belfry's hollow crown, hangs " +
        "in the honey light like a struck note, and sinks home — and the " +
        "gold spiral on its shell is said to be the wind's own song, " +
        "written down one turn at a time.",
      codexLine: "It rings the desert's hours from a tower of carved stone.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// region's collision contract and the tests read them back.
export { buildSeals };
