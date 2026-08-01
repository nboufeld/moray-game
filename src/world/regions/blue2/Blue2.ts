import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildBlue2Cover } from "./Blue2Cover";
import { buildBlue2Current } from "./Blue2Current";
import { GENTLE_DARK_SPECIES_ID, buildGentleDark } from "./Blue2Dark";
import { buildBlue2Distance } from "./Blue2Distance";
import { buildBlue2Ground } from "./Blue2Ground";
import { buildBlue2Life } from "./Blue2Life";
import { buildBlue2Light } from "./Blue2Light";
import { buildMooring } from "./Blue2Mooring";
import { buildBlue2Stones } from "./Blue2Stones";
import {
  BLUE2_SLOT,
  CENTER_X,
  CENTER_Z,
  blue2Ceiling,
  blue2TerrainTarget,
  blue2Weight,
  passGate,
  passHalfWidth,
  spokeOf,
  worldOf,
} from "./Blue2Terrain";

/**
 * THE DEEP STEPS — region `great-blue-2`, province The Great Blue,
 * depth 2. No gateway wing: the inbound connection crosses THE WORLD'S
 * EDGE itself — the Drop Plains ends on a fall into violet, and this
 * is the country the fall was into.
 *
 * The Drop Plains' painted deep promised layered violet ridges beyond
 * the void; this region is that painting entered. The diver crosses
 * the Under-Blue, climbs the Far Wall out of the dark, and surfaces
 * onto the Othershore — a bare milky saddle, sun again — then the
 * world falls away a second time at the Brink, and THE DEEP STEPS
 * open: a nested amphitheatre of great violet shelves bowed around the
 * World's Edge, each one value deeper. The Stairfall descends to the
 * Strand and the KINGS' WRACK — the drift-line where everything the
 * world above sheds came to rest; THE MOORING's three colossal posts
 * carry the skyline; THE OLD CURRENT crosses the middle shelf as a
 * river of glass under THE WEIR, and pours over the third riser at THE
 * SPILL; and the lowest floor is THE ROUND OF THE GENTLE DARK —
 * composed emptiness at its purest, one colossal beam (THE MOON WELL)
 * standing in it like a spotlight on an empty stage, and the Gentle
 * Dark itself circling through the light once a round. The Worldwall
 * closes the amphitheatre, and THE HORNS on its crest frame the
 * reserved depth-3 azimuth.
 *
 * Pure half in `Blue2Terrain`; built half in the sibling modules.
 * Every stream is `SEEDS.regionBlue2` or a `^` substream. Built to the
 * full R12 standard from the first draft: no wedge era, no separate
 * fill pass — density, quality, light and life ARE the build, and in
 * this province the density is COMPOSED EMPTINESS.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver the moment they reach
// weight = 0, so the domain's open edges are walled with spheres: a
// ring just inside the disc's rim (where the ceiling has already
// closed to floor + 3), gated open over the inbound corridor only —
// the reserved depth-3 corridor stays SEALED until great-blue-3 opens
// it — plus shoulder rows down the pass. The corridor's far end needs
// no seal of ours: past u ≈ 665 the Drop Plains' own domain and walls
// take over (its rim seal ring at its rc 164 stands across the
// corridor until the orchestrator cuts it — flagged in the ledger).

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
      center: new Vector3(x, blue2TerrainTarget(x, z) + 1.5, z),
      radius: 9,
    });
  }

  // The pass shoulders: rows along the corridor from the wall band to
  // the Brink (invisible walls over open shelf — the standing trade at
  // every rim). The wall-band rows ride the mirrored wall floor.
  for (let u = 640; u <= 758; u += 12) {
    const inner = passHalfWidth(u) - 4;
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * inner);
      const floor = blue2TerrainTarget(x, z);
      seals.push({ center: new Vector3(x, floor + 4, z), radius: 10.5 });
    }
  }

  // Gate posts where the rim ring's gap meets the corridor: the ring
  // is cut across the crossing, and the posts carry the cut's
  // shoulders.
  for (const side of [-1, 1]) {
    const { x, z } = worldOf(734, side * 32);
    const floor = blue2TerrainTarget(x, z);
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
  /** Absolute y instead of ground-relative, for the deep-water poses. */
  readonly absoluteY?: number;
}

const POSE_SPECS: readonly PoseSpec[] = [
  // Mid-climb on the Far Wall, looking back down into the Under-Blue —
  // the crossing, seen from inside it. (A true in-void stand is
  // impossible until the orchestrator's cuts: blue-1's rim ceiling is
  // floor+3 out there — ledgered. Pre-connection this frame carries
  // blue-1's deep-step arcs crossing the corridor: the honest state.)
  // Round 3: off-axis stand just under the crest (the wall is crested
  // by u ≈ 648, probed) — the r2 straight-down pitch framed empty teal
  // with the sheet's raw trim sawing the right edge; from the shoulder
  // the wall itself DROPS through frame into the void.
  // Round 4: the look ray swings a step onto the wall's own face (the
  // r3 frame still gave 60% to open teal) — the end trim now droops.
  { name: "wall-face", u: 641, v: -10, lift: 2.2, atU: 618, atV: -4, pitch: -0.32, settle: 4 },
  // The far lip: standing on the Othershore looking BACK over the void
  // toward the Drop Plains — the crossing, remembered. Round 2: pitch
  // steepened — the void's drama is DOWN, and −0.06 framed open water.
  { name: "wall-crest", u: 662, v: 0, lift: 2.1, atU: 616, atV: -10, pitch: -0.3 },
  // The Othershore: the bare milky saddle, the Pharos ahead.
  { name: "othershore", u: 680, v: -4, lift: 2.3, atU: 712, atV: 4, pitch: -0.03 },
  // The Pharos, close: the lone waymark and its thin blade.
  { name: "pharos", u: 684, v: 3, lift: 2.0, atU: 692, atV: 8, pitch: 0.12, settle: 3 },
  // THE BRINK: the second edge — the amphitheatre opens in one breath.
  { name: "brink", u: 742, v: 0, lift: 2.6, atU: 792, atV: -8, pitch: -0.1, settle: 4 },
  // The Stairfall: five great risers down toward the Strand.
  { name: "stairfall", u: 768, v: 6, lift: 2.8, atU: 802, atV: -6, pitch: -0.12, settle: 3 },
  // The Strand: the ripple field, the Mooring's masts in the fog.
  { name: "strand", u: 812, v: -20, lift: 2.6, atU: 876, atV: -40, pitch: 0.02 },
  // THE KINGS' WRACK: along the drift-line of fallen megaliths.
  // Round 2: re-staged onto the line's south run — the r1 stand's own
  // fragment was out of its frame and the landmark read as dirt.
  { name: "kings-wrack", u: 836, v: -52, lift: 2.6, atU: 826, atV: -18, pitch: -0.03, settle: 3 },
  // THE SKIFF: the secret at its berth, the lantern finding it.
  { name: "skiff", u: 812, v: 88, lift: 2.6, atU: 818.5, atV: 96, pitch: -0.06, settle: 4 },
  // THE MOORING: the three posts ranked into the violet. Round 2:
  // backed south-west — the r1 stand framed the Weir's leg at 13 m by
  // accident and the Weir stole the mooring's own portrait.
  { name: "mooring", u: 896, v: -52, lift: 3.4, atU: 908, atV: 20, pitch: 0.12, settle: 4 },
  // THE WEIR at the Ford: the arch over the river of glass, the
  // travellers threading it.
  { name: "weir-ford", u: 886, v: -26, lift: 2.4, atU: 899, atV: -14, pitch: 0.04, settle: 6 },
  // Riding the Current: looking down the glass band toward the Weir.
  { name: "current-glass", u: 878, v: 52, lift: 3.4, atU: 899, atV: -10, pitch: -0.04, settle: 5 },
  // THE SPILL from below: the river falling off the world's third step.
  { name: "spill", u: 964, v: -146, lift: 2.6, atU: 946, atV: -132, pitch: 0.16, settle: 5 },
  // The Chute: the road's notch, framed by its gate stones, the Well's
  // beam far ahead (round 2 restage — the r1 frame was a bare slope).
  { name: "chute", u: 938, v: -22, lift: 2.8, atU: 1005, atV: -16, pitch: -0.08, settle: 3 },
  // The Round: composed emptiness — the Friedrich, violet edition.
  { name: "round-hush", u: 996, v: 34, lift: 2.2, atU: 1054, atV: -16, pitch: 0.02 },
  // THE MOON WELL: the beam, the circle, the Dark's crossing.
  { name: "moon-well", u: 1046, v: -34, lift: 2.6, atU: 1032, atV: -8, pitch: 0.1, settle: 8 },
  // THE GENTLE DARK, met on its own floor.
  { name: "gentle-dark", u: 1014, v: -20, lift: 0, absoluteY: -34, atU: 1032, atV: -8, pitch: -0.08, settle: 8 },
  // The Horns: the depth-3 promise. Round 2, by arithmetic: from the
  // Round's floor the rim crest subtends 0.54 rad and hid everything —
  // the stand rises to y ≈ −17 (crest 0.25 rad; horn crowns 0.27–0.33;
  // raised ring bases behind at 0.28+).
  // Round 4: the stand closes to ~48 m (fog was eating the pale horns
  // at 62; they also join the slate family so the silhouettes stand).
  { name: "horns-promise", u: 1078, v: 2, lift: 29.0, atU: 1126, atV: 2, pitch: 0.3, settle: 3 },
  // From the Round's heart, back up every shelf at once.
  { name: "edge-lookback", u: 1008, v: -8, lift: 10.0, atU: 820, atV: 10, pitch: 0.12 },
  // ── The close-range set (R12's still-frame bar, judged at 2–4 m) ─────────
  { name: "close-strand-ripple", u: 816.0, v: -18.5, lift: 1.5, atU: 819.0, atV: -15.3, pitch: -0.15, settle: 3 },
  { name: "close-bank-blades", u: 887.0, v: 3.0, lift: 1.4, atU: 890.4, atV: 5.8, pitch: -0.14, settle: 3 },
  // Round 3: the crown lens goes 3/4 (the r2 stand stared down the
  // blade's sawn end face); the post lens backs to ~16 m (the foot
  // flare is 9 m wide and still owned the whole r2 frame at 9 m).
  { name: "close-wrack-crown", u: 832.0, v: -37.5, lift: 1.6, atU: 825.0, atV: -33.0, pitch: -0.06, settle: 3 },
  // Round 4: pitch drops onto the FOOT — the r3 up-pitch centred the
  // mid-shaft and left the splits and bed below frame.
  { name: "close-post-foot", u: 866.5, v: -27.5, lift: 1.7, atU: 874.5, atV: -38.0, pitch: -0.14, settle: 3 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = spec.absoluteY ?? blue2TerrainTarget(x, z) + spec.lift;
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

export const BLUE_2: RegionDef = {
  slotId: BLUE2_SLOT.id,
  title: "The Deep Steps",
  emotion: "awe below the world — emptiness composed, the last light kept",

  weight: blue2Weight,
  terrainTarget: blue2TerrainTarget,
  ceiling: blue2Ceiling,
  floorClearance: 0.7,

  mood: {
    // The register the MASTER row binds: past the World's Edge the
    // water goes deeper violet than the Drop Plains' and CLEARS — the
    // province's vastness argument wants long sightlines. Red held
    // above green so the violet never reads cobalt; blue's scale kept
    // under the pilot's measured 0.86 ceiling (its rounds 6–8: a fog
    // bluer than the backdrop it dissolves into IS the cobalt band).
    // The descent makes depth the dimmer: the saddle swims bright, the
    // Round takes all of it.
    // Round 2: red 0.62 → 0.66 — full-mood frames read teal; the deep
    // register leans a nose further violet (red still under blue).
    // Round 3 (the A/B the moon-well frame asked for): green 0.50 →
    // 0.49, blue 0.80 → 0.82 — the water column still sat teal at full
    // mood; the pair pushes the register off green toward violet-blue
    // while blue stays under the pilot's 0.86 cobalt ceiling.
    fog: { colorScale: [0.66, 0.49, 0.82], densityGain: -0.004, backdropFade: 0.5 },
    light: { sun: 0.28, hemisphere: 0.2, ambient: 0.06 },
  },
  moodSurface: 6,
  moodDescent: 30,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-great-blue-2";

    const stones = buildBlue2Stones();
    const mooring = buildMooring();
    const dark = buildGentleDark();
    const life = buildBlue2Life();
    const current = buildBlue2Current();
    const light = buildBlue2Light();
    const distance = buildBlue2Distance();
    const cover = buildBlue2Cover();
    const ground = buildBlue2Ground([...stones.contacts, ...mooring.contacts]);

    for (const child of [
      ...ground,
      ...stones.meshes,
      ...mooring.meshes,
      dark.mesh,
      ...life.groups,
      ...current.groups,
      ...light.groups,
      ...distance.meshes,
      ...cover.groups,
    ]) {
      group.add(child);
    }

    const colliders = [...stones.colliders, ...mooring.colliders, ...buildSeals()];

    return {
      group,
      colliders,
      targets: [dark.target],
      update(dt, ctx): void {
        const calm = ctx.reducedMotion ? 0.45 : 1;
        // Every subsystem's motion is closed-form off simulated time
        // (kit law 5) — captures settle deterministically.
        dark.update(ctx.time, ctx.reducedMotion);
        life.update(ctx.time * calm);
        current.update(ctx.time * calm);
        cover.update(ctx.time * calm);
        void dt;
      },
    };
  },

  codexEntries: [
    {
      id: GENTLE_DARK_SPECIES_ID,
      commonName: "The Gentle Dark",
      scientificName: "Umbra lenis",
      fact:
        "A vast winged shadow that keeps the lowest floor of the world, " +
        "below the World's Edge, circling the Round on one slow patient " +
        "loop. Once a round it passes through the Moon Well's beam — the " +
        "one light down there — and for a breath the dark can be seen: " +
        "eleven metres of wing and the pale crescent on its crown.",
      codexLine: "Divers fear no night here, because the night itself is kind.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// region's collision contract and the tests read them back.
export { buildSeals };
