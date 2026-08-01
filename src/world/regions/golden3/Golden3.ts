import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildGolden3Cover } from "./Golden3Cover";
import { buildGolden3Distance } from "./Golden3Distance";
import { buildDoor } from "./Golden3Door";
import { buildFalls } from "./Golden3Falls";
import { buildGarden } from "./Golden3Garden";
import { buildGolden3Ground } from "./Golden3Ground";
import { buildGolden3Life } from "./Golden3Life";
import { buildGolden3Light } from "./Golden3Light";
import { buildPans } from "./Golden3Pans";
import { PILGRIM_SPECIES_ID, buildPilgrim } from "./Golden3Pilgrim";
import { buildGolden3Rocks } from "./Golden3Rocks";
import {
  CENTER_X,
  CENTER_Z,
  GOLDEN3_SLOT,
  combeChannelCenter,
  combeChannelHalf,
  golden3Ceiling,
  golden3TerrainTarget,
  golden3Weight,
  passGate,
  passHalfWidth,
  spokeOf,
  worldOf,
} from "./Golden3Terrain";

/**
 * THE VESPER STRAND — region `golden-waste-3`, province The Golden
 * Waste, depth 3: the province's last chamber, and the desert's END.
 *
 * The Hourglass Sea was the desert's sand; the Carillon Waste was the
 * desert's bone; this is the desert's EVENING — the hour of sunset made
 * into a place. The Last Shelf runs out past the Carillon Waste's
 * framing spires to the Strand Gate, where the dunes pour over three
 * carved lips as golden sandfalls and the diver descends through
 * falling light into the Vesper Flats: a salt-pale evening basin where
 * THE PROCESSION's leaning stones all walk toward the sunset, throwing
 * their long violet shadows back up the road; the MIRROR PANS hold the
 * sky on the ground (the largest is THE STILL MIRROR, a registered
 * rest); the DUNE COMBS ridge both flanks; THE AFTERGLOW GARDEN lights
 * its candle-stones as the day goes; the NIGHT WELL sinks the desert's
 * first dark below the flats; and on the far rise THE SUN'S DOOR — a
 * great natural arch squared to the whole journey — frames the painted
 * sun going down at the world's edge, THE LANTERN CARAVAN pacing the
 * road below and THE EVENING PILGRIM, an ancient copper turtle,
 * circling through the door into the last light, forever.
 *
 * Pure half in `Golden3Terrain`; built half in the sibling modules.
 * Every stream is `SEEDS.regionGolden3` or a `^` substream. Built to
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
// no seal: behind it the Carillon Waste's own domain and walls take
// over — that is the handover. This is the province's terminus: the
// far pole never opens.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  // The rim ring, gated only over the inbound pass corridor.
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
    seals.push({
      center: new Vector3(x, golden3TerrainTarget(x, z) + 1.5, z),
      radius: 9,
    });
  }

  // The pass shoulders: double rows down the Last Shelf and the combe
  // (inner at the dune-wall crest, outer at the tongue edge),
  // overlapping by construction so the corridor is sealed wall to
  // ring. The inner rows at |v| ≈ 15 over the neighbour's rim are the
  // flank seals golden-2's rim-ring cut (u > 1130, |v| < 15) relies on.
  for (let u = 1136; u <= 1330; u += 13) {
    const vc = combeChannelCenter(u);
    const inner = u < 1248 ? 15 : combeChannelHalf(u) + 9;
    const outer = passHalfWidth(u) - 5;
    for (const side of [-1, 1]) {
      const wall = worldOf(u, vc + side * inner);
      seals.push({
        center: new Vector3(wall.x, golden3TerrainTarget(wall.x, wall.z) + 5.5, wall.z),
        radius: 10.5,
      });
      if (outer > inner + Math.abs(vc) + 2) {
        const edge = worldOf(u, side * outer);
        seals.push({
          center: new Vector3(edge.x, golden3TerrainTarget(edge.x, edge.z) + 4, edge.z),
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
  // The Last Shelf: waymark pairs pacing out of the Carillon Waste's
  // decrescendo; its far-side distance rings stand between this camera
  // and everything of ours past u ≈ 1226 — from here they ARE the
  // promise (the Emerald Gate lesson, honoured at authoring time).
  { name: "last-shelf", u: 1214, v: 2, lift: 2.5, atU: 1252, atV: 0, pitch: -0.03 },
  // The Strand Gate: the leaning slabs framing the first pour's lip.
  { name: "strand-gate", u: 1242, v: 1, lift: 2.4, atU: 1260, atV: 0, pitch: -0.05 },
  // Inside the combe: the sandfalls pouring over the second lip.
  { name: "sandfall-combe", u: 1266, v: 0, lift: 2.6, atU: 1292, atV: -2, pitch: -0.08, settle: 3 },
  // The reveal: the combe's foot, the Vesper Flats opening in one
  // breath — the Foremost kneeling, the Procession ranked into the fog.
  { name: "basin-reveal", u: 1324, v: 0, lift: 3.4, atU: 1368, atV: -8, pitch: -0.06, settle: 4 },
  // Among the pilgrim stones: long violet shadows, the road threading.
  { name: "procession", u: 1380, v: -34, lift: 2.7, atU: 1430, atV: -12, pitch: 0.0, settle: 4 },
  // The Mirror Pans from the road's shoulder: held sky, salt rims.
  { name: "mirror-pans", u: 1362, v: 26, lift: 3.2, atU: 1408, atV: -20, pitch: -0.1 },
  // THE STILL MIRROR: the rest, framed against its own door — the pan,
  // its sky-pool, the Procession's skyline behind.
  { name: "still-mirror", u: 1392, v: -42, lift: 2.4, atU: 1408, atV: -26, pitch: -0.12, settle: 3 },
  // The Dune Combs: ridge country, comb tufts in the lees.
  { name: "dune-combs", u: 1392, v: 82, lift: 3.0, atU: 1428, atV: 122, pitch: -0.04 },
  // The Night Well from its kneeling ring: the violet deep, the blade.
  { name: "night-well", u: 1406, v: -84, lift: 2.8, atU: 1420, atV: -93, pitch: -0.16 },
  // Inside the well, looking up at the last light reaching the first
  // dark — the region's vertical drama, composed from within.
  { name: "well-blade", u: 1424, v: -96, lift: 2.1, atU: 1416, atV: -88, pitch: 0.18, settle: 4 },
  // THE AFTERGLOW GARDEN: the candle field, crowns burning.
  { name: "afterglow-garden", u: 1496, v: 30, lift: 2.8, atU: 1526, atV: 48, pitch: 0.02, settle: 4 },
  // The road with the Lantern Caravan crossing — life as wayfinding.
  { name: "caravan-road", u: 1466, v: 20, lift: 3.4, atU: 1502, atV: 6, pitch: -0.04, settle: 6 },
  // THE SUN'S DOOR from the road: the arch on its rise over the basin,
  // the sunset standing in the window — the region's proof shot.
  { name: "suns-door", u: 1552, v: -18, lift: 4.5, atU: 1600, atV: -4, pitch: 0.04, settle: 4 },
  // On the balcony beside the door, looking straight into the painted
  // sunset: the province's last horizon, looked at on-axis.
  { name: "evening-horizon", u: 1596, v: 18, lift: 6.0, atU: 1650, atV: -4, pitch: 0.0, settle: 3 },
  // The window with the Pilgrim crossing — the resident's own frame
  // (a round that cannot leave the door needs little phase luck).
  { name: "pilgrim", u: 1586, v: -16, lift: 3.0, atU: 1600, atV: -2, pitch: 0.1, settle: 8 },
  // ── The close-range set (R12's still-frame bar, judged at 2–4 m) ─────────
  { name: "close-pan-rim", u: 1452.5, v: 39.5, lift: 1.8, atU: 1449.5, atV: 35.5, pitch: -0.24, settle: 3 },
  { name: "close-comb-tufts", u: 1400.0, v: 96.0, lift: 1.5, atU: 1403.2, atV: 99.4, pitch: -0.22, settle: 3 },
  { name: "close-garden-bed", u: 1514.5, v: 36.5, lift: 1.5, atU: 1518.2, atV: 40.4, pitch: -0.24, settle: 3 },
  { name: "close-door-foot", u: 1586.0, v: 4.0, lift: 1.6, atU: 1589.4, atV: 6.4, pitch: -0.18, settle: 3 },
] as const;

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = golden3TerrainTarget(x, z) + spec.lift;
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

export const GOLDEN_3: RegionDef = {
  slotId: GOLDEN3_SLOT.id,
  title: "The Vesper Strand",
  emotion: "arrival at the world's edge — the desert's evening, warm and immense",

  weight: golden3Weight,
  terrainTarget: golden3TerrainTarget,
  ceiling: golden3Ceiling,
  floorClearance: 0.7,

  mood: {
    // The province's honey water at its last hour: red held a step
    // over the Carillon Waste's (the register is later in the day),
    // blue kept low, density paid for the warm sky. The gradient map's
    // Golden row ends here — honey over violet, resolved into evening.
    fog: { colorScale: [3.6, 0.56, 0.3], densityGain: 0.009, backdropFade: 0.63 },
    light: { sun: 0.24, hemisphere: 0.26, ambient: 0.15 },
  },
  moodSurface: 20,
  moodDescent: 9,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-golden-waste-3";

    const rocks = buildGolden3Rocks();
    const door = buildDoor();
    const garden = buildGarden();
    const pans = buildPans();
    const falls = buildFalls();
    const pilgrim = buildPilgrim(door);
    const life = buildGolden3Life();
    const light = buildGolden3Light();
    const distance = buildGolden3Distance();
    const cover = buildGolden3Cover();
    const ground = buildGolden3Ground([
      ...rocks.contacts,
      ...door.contacts,
      ...garden.contacts,
    ]);

    for (const child of [
      ...ground,
      ...rocks.meshes,
      ...door.meshes,
      ...garden.meshes,
      ...garden.groups,
      pans.group,
      falls.group,
      ...pilgrim.meshes,
      ...life.groups,
      ...light.groups,
      ...distance.meshes,
      ...cover.groups,
    ]) {
      group.add(child);
    }

    const colliders = [
      ...rocks.colliders,
      ...door.colliders,
      ...garden.colliders,
      ...buildSeals(),
    ];

    return {
      group,
      colliders,
      targets: [pilgrim.target],
      update(dt, ctx): void {
        const calm = ctx.reducedMotion ? 0.45 : 1;
        // Every subsystem's motion is closed-form off simulated time
        // (kit law 5) — captures settle deterministically.
        pilgrim.update(ctx.time, ctx.reducedMotion);
        life.update(ctx.time * calm);
        garden.update(ctx.time * calm);
        falls.update(ctx.time * calm);
        cover.update(ctx.time * calm);
        light.update(ctx.time * calm);
        void dt;
      },
    };
  },

  codexEntries: [
    {
      id: PILGRIM_SPECIES_ID,
      commonName: "Evening Pilgrim",
      scientificName: "Chelonia vespertina",
      fact:
        "An ancient copper sea-turtle that has swum toward the sunset " +
        "for longer than the desert has had a name, and never once " +
        "arrived. Every evening it circles the Sun's Door and crosses " +
        "through the arch into the last light, and the gold seams of " +
        "its shell are said to record the voyages — one line for every " +
        "evening the sun set without it.",
      codexLine: "It has chased the sunset so long the sunset waits for it.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// region's collision contract and the tests read them back.
export { buildSeals };
