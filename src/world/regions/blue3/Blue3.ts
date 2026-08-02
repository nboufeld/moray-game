import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildBlue3Cover } from "./Blue3Cover";
import { buildBlue3Distance } from "./Blue3Distance";
import { buildBlue3Ground } from "./Blue3Ground";
import { buildBlue3Life } from "./Blue3Life";
import { buildBlue3Light } from "./Blue3Light";
import { buildBlue3Stones } from "./Blue3Stones";
import { buildBlue3Wellspring } from "./Blue3Wellspring";
import { MORNING_WHALE_SPECIES_ID, buildMorningWhale } from "./Blue3Whale";
import {
  BLUE3_SLOT,
  CENTER_X,
  CENTER_Z,
  blue3Ceiling,
  blue3TerrainTarget,
  blue3Weight,
  passGate,
  passHalfWidth,
  spokeOf,
  worldOf,
} from "./Blue3Terrain";

/**
 * THE FIRST SEA — region `great-blue-3`, province The Great Blue,
 * depth 3: the LAST region of the whole world, and the game's deepest
 * arrival. No gateway wing; the inbound connection crosses the Deep
 * Steps' own Worldwall between THE HORNS.
 *
 * The arc closes here. The Drop Plains fell over the World's Edge;
 * the Deep Steps was the violet night the fall was into, its dark
 * kept kind by the Gentle Dark; and at the bottom of the deepest
 * night the diver does not find a darker dark — they find the hour
 * before morning. Over the crest, THE MORNING SHELF; then THE
 * LONGFALL, the longest single slope in the game, pours the world's
 * last road down into THE FIRSTLIGHT MERE — the floor of the whole
 * ocean, strewn with the star-bloom, clear as glass, violet leaning
 * rose. THE CHAIN's five great stone links lead from the fall's foot
 * to THE ANCHOR — where the world was moored, the Mooring's other
 * end, three hundred metres below its posts. THE WELLHEAD's pale
 * crater births the sea's water under THE DAYBREAK, one colossal
 * beam standing in the world's deepest column; THE CRADLE, the young
 * river, leaves over THE OVERBRIM toward the rim mist (upstream,
 * mythically, it is the Old Current the diver followed two regions
 * ago). THE STARWATER PANS hold their still light; THE PEARL waits
 * in its fold; and THE SEA'S DOORSTEP — a bench slab between two
 * Watchers on the last rise — faces THE HEM, the world's outermost
 * wall, with the painted MORNING BANK warming the horizon beyond the
 * end of the sea. THE MORNING WHALE keeps it all, rising through the
 * Daybreak once a round: the sea carrying its own morning up to the
 * world.
 *
 * Pure half in `Blue3Terrain`; built half in the sibling modules.
 * Every stream is `SEEDS.regionBlue3` or a `^` substream. Built to
 * the full R12 standard from the first draft: no wedge era, no
 * separate fill pass — density, quality, light and life ARE the
 * build, and in this province the density is COMPOSED EMPTINESS.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver the moment they reach
// weight = 0, so the domain's open edges are walled with spheres: a
// ring just inside the disc's rim (where the ceiling has already
// closed to floor + 3), gated open over the inbound corridor only —
// there is no outbound corridor: this is the end of the sea — plus
// shoulder rows down the pass. The corridor's far end needs no seal
// of ours: past u ≈ 1160 the Deep Steps' own domain and walls take
// over (its rim seal ring at its rc 206 stands across the corridor
// until the orchestrator cuts it — flagged in the ledger).

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  // The rim ring, gated only over the inbound corridor.
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
      center: new Vector3(x, blue3TerrainTarget(x, z) + 1.5, z),
      radius: 9,
    });
  }

  // The pass shoulders: rows along the corridor from the wall band to
  // the Longfall's crest (invisible walls over open shelf — the
  // standing trade at every rim). The wall-band rows ride the mirror.
  for (let u = 1136; u <= 1288; u += 12) {
    const inner = passHalfWidth(u) - 4;
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * inner);
      const floor = blue3TerrainTarget(x, z);
      seals.push({ center: new Vector3(x, floor + 4, z), radius: 10.5 });
    }
  }

  // Gate posts where the rim ring's gap meets the corridor.
  for (const side of [-1, 1]) {
    const { x, z } = worldOf(1246, side * 34);
    const floor = blue3TerrainTarget(x, z);
    for (const level of [3.5, 9]) {
      seals.push({ center: new Vector3(x, floor + level, z), radius: 6 });
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
  /** Absolute y instead of ground-relative, for the midwater poses. */
  readonly absoluteY?: number;
}

const POSE_SPECS: readonly PoseSpec[] = [
  // Past the Worldwall's crest, looking back down into the Deep
  // Steps' amphitheatre — the crossing, seen from inside the duck.
  // (Round 2: the r1 crest stand hid the drop behind the lid's own
  // horizon — the stand steps onto the wall's shoulder and the pitch
  // drops onto the amphitheatre. Pre-connection this frame carries
  // blue-2's rim seals and closed ceiling: the honest state.)
  { name: "wall-crossing", u: 1140, v: 0, lift: 1.4, atU: 1114, atV: -4, pitch: -0.45, settle: 4 },
  // THE HORNSGATE — round 5, the measured truth: the shelf rides at
  // ~0 and the Horns' TIPS at +1.5 / −5.9 (bases −14.5 / −18.9 on the
  // falling outer face) — from any shelf stand they are bumps on the
  // horizon line, and the inbound gaze is flat milk by construction
  // (the corridor is a drowned plain, not a slot). The gate's honest
  // portrait: from the crest's edge, the near Horn's whole MAST —
  // sixteen metres of violet-slate rising out of the void it guards —
  // against the deep teal of the amphitheatre's airspace, the milky
  // sill running under it.
  { name: "hornsgate", u: 1142, v: 4, lift: 1.6, atU: 1128, atV: 15, pitch: -0.16, settle: 3 },
  // The Morning Shelf: the world's last milky threshold, the Daymark
  // breaching the fog ahead (round 2: the r1 stand left it 68 m out;
  // round 4: in to 30 m — at 46 the shelf's own paint and pebbles all
  // lay past the fog's shoulder and the frame read bare tan).
  { name: "morning-shelf", u: 1222, v: -8, lift: 2.0, atU: 1252, atV: 4, pitch: 0.02 },
  // THE DAYMARK, close: the lone waymark and its thin blade.
  { name: "daymark", u: 1240, v: 0, lift: 2.0, atU: 1252, atV: 6, pitch: 0.08, settle: 3 },
  // THE LONGFALL'S BRINK: the deepest country opens in one breath —
  // the head-drop falling away underfoot, the landing beam far below
  // (round 2: the head steepened into a true brink; the Gatebuoys
  // flank the road; the stand backs onto the crest lip).
  { name: "longfall-brink", u: 1250, v: -4, lift: 2.4, atU: 1300, atV: 2, pitch: -0.22, settle: 4 },
  // Mid-fall: the world's longest road, buoy stones pacing it.
  { name: "longfall-road", u: 1296, v: 8, lift: 2.6, atU: 1334, atV: -8, pitch: -0.1, settle: 3 },
  // THE CHAIN: the links rising toward the Anchor in the fog (round
  // 3: in to 25 m — the r2 links vanished at forty).
  { name: "chain", u: 1352, v: 24, lift: 2.6, atU: 1377, atV: 52, pitch: 0.02, settle: 3 },
  // THE ANCHOR: the great shape, portrait.
  { name: "anchor", u: 1402, v: 42, lift: 2.8, atU: 1387, atV: 58, pitch: 0.12, settle: 4 },
  // The Anchor's ring against the open water, from midwater.
  { name: "anchor-eye", u: 1368, v: 40, lift: 0, absoluteY: -44, atU: 1381, atV: 53, pitch: 0.15, settle: 3 },
  // THE WIDE MORNING: composed emptiness — the star-bloom floor, the
  // Daybreak far, the Whale crossing. The region's Friedrich. (Round
  // 3: panned toward the Daybreak — the r2 frame missed the region's
  // one far event and read as blotches under bands.)
  { name: "wide-morning", u: 1352, v: -40, lift: 2.2, atU: 1470, atV: -38, pitch: 0.03 },
  // THE WELLHEAD: the spring of the sea, portrait — rim, crags,
  // breath and beam.
  { name: "wellhead", u: 1466, v: -52, lift: 3.0, atU: 1502, atV: -28, pitch: 0.06, settle: 4 },
  // THE DAYBREAK, from inside the bowl: up the world's deepest beam;
  // the Morning Whale arrives in the light as the shutter fires.
  { name: "daybreak", u: 1496, v: -36, lift: 0, absoluteY: -50, atU: 1502, atV: -28, pitch: 0.35, settle: 8 },
  // THE OVERBRIM: road and newborn river sharing one doorway.
  { name: "overbrim", u: 1481, v: 2, lift: 2.2, atU: 1489, atV: -8, pitch: 0.05, settle: 4 },
  // Riding the Cradle downstream, toward the rim mist — and (round 3)
  // the pitch lifts a hair so the rebuilt rings hold the far axis.
  { name: "cradle-run", u: 1436, v: 66, lift: 2.6, atU: 1424, atV: 100, pitch: 0.03, settle: 5 },
  // THE SHALLOWS: the road wades the young river; the dawn shoal
  // crosses on schedule.
  { name: "shallows-ford", u: 1436, v: 40, lift: 2.0, atU: 1446, atV: 47, pitch: 0.02, settle: 6 },
  // THE STARWATER PANS: still dishes of held light (round 2: closer —
  // the r1 pans were dim smears at thirty metres; round 5: the probe
  // put numbers on the dishes at last — 1.5–2 m deep, rims at eye
  // height from any low stand, so every low diagonal hides the far
  // pans behind the near rim. The stand goes NORTH-EAST and UP
  // (lift 4.2): the three dishes tier away down the diagonal, each
  // pool of held light open to the lens, the paint's new star-glow
  // in their centres).
  { name: "starwater-pans", u: 1428, v: -94, lift: 4.2, atU: 1421, atV: -114, pitch: -0.22, settle: 3 },
  // THE PEARL: the secret, found.
  { name: "pearl", u: 1541, v: 90, lift: 1.8, atU: 1548, atV: 96, pitch: -0.04, settle: 4 },
  // THE SEA'S DOORSTEP: the bench, the Watchers, the last horizon.
  { name: "doorstep", u: 1586, v: 6, lift: 2.2, atU: 1603, atV: -5, pitch: 0.04, settle: 3 },
  // ON THE DROWNED PLAIN, facing the Morning Bank — the end of the
  // sea, painted. Round 4's measured truth: the surface rides at +8,
  // the dune plain outside the disc at ~0, and from every stand
  // INSIDE the bowl the weight-feather's lip hides anything below the
  // plain line — three rounds of "flat band" were the lip itself, not
  // the rings. So the last frame is the last crossing: the diver
  // rises out of the deep onto the sea's last shallows (the ceiling
  // grants ~3 m of water here), the milky plain running out ahead,
  // and the Bank's rose heads surfacing on its horizon at 40–80 m.
  { name: "morning-horizon", u: 1668, v: -2, lift: 0, absoluteY: 2, atU: 1720, atV: -2, pitch: 0.0 },
  // Back across the country from the Mere's east edge (round 2: the
  // r1 stand at 165 m fogged everything out; the Anchor silhouette
  // needs ≤ ~90 m).
  { name: "hem-lookback", u: 1476, v: 44, lift: 0, absoluteY: -34, atU: 1394, atV: 58, pitch: 0.02 },
  // THE MORNING WHALE, met in its light.
  { name: "morning-whale", u: 1478, v: -44, lift: 0, absoluteY: -40, atU: 1502, atV: -28, pitch: 0.05, settle: 8 },
  // ── The close-range set (R12's still-frame bar, judged at 2–4 m) ─────────
  { name: "close-mere-grain", u: 1398.0, v: 10.0, lift: 1.4, atU: 1401.0, atV: 13.2, pitch: -0.15, settle: 3 },
  { name: "close-bank-blades", u: 1449.0, v: 33.0, lift: 1.4, atU: 1452.4, atV: 35.8, pitch: -0.14, settle: 3 },
  { name: "close-chain-link", u: 1358.0, v: 39.0, lift: 1.6, atU: 1363.0, atV: 42.5, pitch: -0.06, settle: 3 },
  { name: "close-well-rim", u: 1521.0, v: -43.0, lift: 1.5, atU: 1517.5, atV: -39.5, pitch: 0.05, settle: 3 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = spec.absoluteY ?? blue3TerrainTarget(x, z) + spec.lift;
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

export const BLUE_3: RegionDef = {
  slotId: BLUE3_SLOT.id,
  title: "The First Sea",
  emotion: "the deepest arrival — at the end of the sea, the hour before morning",

  weight: blue3Weight,
  terrainTarget: blue3TerrainTarget,
  ceiling: blue3Ceiling,
  floorClearance: 0.7,

  mood: {
    // The register the MASTER row binds, taken to its last word: the
    // deepest water in the game CLEARS (the vastness argument, held to
    // the end) and turns toward morning — red a full step above green,
    // blue held under the pilot's measured 0.86 cobalt ceiling. The
    // descent makes depth the dimmer, gently: the Mere carries its own
    // light. Sun a nose above the Deep Steps' — dawn, not night.
    fog: { colorScale: [0.7, 0.49, 0.82], densityGain: -0.004, backdropFade: 0.5 },
    light: { sun: 0.3, hemisphere: 0.22, ambient: 0.07 },
  },
  moodSurface: 6,
  moodDescent: 30,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-great-blue-3";

    const stones = buildBlue3Stones();
    const whale = buildMorningWhale();
    const life = buildBlue3Life();
    const wellspring = buildBlue3Wellspring();
    const light = buildBlue3Light();
    const distance = buildBlue3Distance();
    const cover = buildBlue3Cover();
    const ground = buildBlue3Ground(stones.contacts);

    for (const child of [
      ...ground,
      ...stones.meshes,
      whale.mesh,
      ...life.groups,
      ...wellspring.groups,
      ...light.groups,
      ...distance.meshes,
      ...cover.groups,
    ]) {
      group.add(child);
    }

    const colliders = [...stones.colliders, ...light.colliders, ...buildSeals()];

    return {
      group,
      colliders,
      targets: [whale.target],
      update(dt, ctx): void {
        const calm = ctx.reducedMotion ? 0.45 : 1;
        // Every subsystem's motion is closed-form off simulated time
        // (kit law 5) — captures settle deterministically.
        whale.update(ctx.time, ctx.reducedMotion);
        life.update(ctx.time * calm);
        wellspring.update(ctx.time * calm);
        cover.update(ctx.time * calm);
        void dt;
      },
    };
  },

  codexEntries: [
    {
      id: MORNING_WHALE_SPECIES_ID,
      commonName: "The Morning Whale",
      scientificName: "Cetus auroralis",
      fact:
        "A pale whale, fourteen metres, that keeps the floor of the whole " +
        "ocean — the First Sea, where the water is born. Its back is " +
        "speckled with the same star-bloom the Mere's floor wears, so a " +
        "diver watching from below sees a constellation swim. Once a " +
        "round it rises through the Daybreak's beam over the Wellhead, " +
        "carrying the sea's morning up toward the world.",
      codexLine: "At the end of the sea, the night was already over.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// region's collision contract and the tests read them back.
export { buildSeals };
