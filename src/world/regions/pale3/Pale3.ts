import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { CHORISTER_SPECIES_ID, buildChorister } from "./Pale3Angel";
import { buildPale3Cover } from "./Pale3Cover";
import { buildPale3Dayspring } from "./Pale3Dayspring";
import { buildPale3Distance } from "./Pale3Distance";
import { buildPale3Fonts } from "./Pale3Fonts";
import { buildPale3Gardens } from "./Pale3Gardens";
import { buildPale3Ground } from "./Pale3Ground";
import { buildPale3Life } from "./Pale3Life";
import { buildPale3Light } from "./Pale3Light";
import {
  PALE3_SLOT,
  channelCenter,
  pale3Ceiling,
  pale3TerrainTarget,
  pale3Weight,
  passGate,
  passHalfWidth,
  spokeOf,
  worldOf,
} from "./Pale3Terrain";

/**
 * THE DAYSPRING — region `pale-passage-3`, province The Pale Passage,
 * the province's LAST chamber and the spoke's terminus.
 *
 * The Bone Meadows answered "life returns"; the Lantern Combs answered
 * "where the pale light comes from" — a kept flame, tended by a
 * nautilus. This chamber answers what the flame was kept FOR: the
 * diver comes out from behind the paper into the morning. The pass
 * lands in THE UNDAWN — the hour before, the darkest breath of the
 * region — and then the country opens at daybreak: hollow font towers
 * welling light from their crowns, the Blushfields where the
 * province's long-forbidden colour finally reaches the ground, THE
 * STILL MORNING's mirror with one gold reflection lane painted across
 * its floor, the Dawn Steps' pearl terraces — and at the spoke's own
 * bearing THE DAYSPRING: a half-risen pearl sun cresting the last
 * terrace, the painted morning burning behind it, THE CHORISTER
 * rising and falling before it like a bird greeting the sun. Arrival,
 * not spectacle: the strictest-hush province ends on a held major
 * chord, not a fanfare.
 *
 * Pure half in `Pale3Terrain`; built half in the sibling modules.
 * Every stream is `SEEDS.regionPale3` or a `^` substream.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver at weight = 0, so the open
// edges are walled: a rim ring of two-sphere stacks just inside the
// disc's edge — gated open over the inbound pass corridor only (this
// is the spoke's terminus: no reservation parts the far rim) — and
// rows along the pass tongue's shoulders from the Combs' rim down to
// the Matins' foot. The threshold's mouth needs no seal of its own:
// behind it the Combs' domain and walls take over — the handover
// working, third boundary in a row.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  const rimR = 198;
  const count = 92;
  const center = worldOf(1460, 0);
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = center.x + Math.cos(theta) * rimR;
    const z = center.z + Math.sin(theta) * rimR;
    const { u, v } = spokeOf(x, z);
    if (passGate(u, v) > 0.3) {
      continue;
    }
    const floor = pale3TerrainTarget(x, z);
    seals.push(
      { center: new Vector3(x, floor + 1.5, z), radius: 9 },
      { center: new Vector3(x, floor + 8.5, z), radius: 7 },
    );
  }

  // The pass shoulders: rows down both flanks from the Combs' rim to
  // the Matins' foot, just inside the tongue's edge.
  for (let u = 1140; u <= 1306; u += 13) {
    const hw = passHalfWidth(u);
    const edge = Math.min(hw - 1.2, Math.max(hw - 4, 20.5));
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * edge);
      const floor = pale3TerrainTarget(x, z);
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
  // From the Combs' side of the overlap, looking in — the pass pose
  // the handover is judged by. (The Combs' Far Gate needles and their
  // Dayspring veil stand behind this camera; their distance rings are
  // already parted over the corridor — the reservation, spent.)
  { name: "pass-threshold", u: 1137, v: 0, lift: 1.6, atU: 1200, atV: 2, pitch: 0.0 },
  // The Matins Gate: the twin font towers framing the descent's mouth.
  // Round 2: backed off — at u 1233 the towers cropped at the frame.
  { name: "matins-gate", u: 1224, v: 2, lift: 2.6, atU: 1256, atV: 0, pitch: -0.04 },
  // On the descent itself, close and steep (the stair lesson: get ON
  // the road, subject inside 30 m). Round 2: lower and steeper — the
  // r1 pose floated over the slot and the staircase never read.
  { name: "vigil-steps", u: 1258, v: -2, lift: 2.6, atU: 1280, atV: 2, pitch: -0.3 },
  // In the Undawn, looking back up at the gate's light — the hour
  // before morning, read as a composed held breath.
  { name: "undawn-hush", u: 1297, v: 2, lift: 3.6, atU: 1270, atV: -4, pitch: 0.22, settle: 4 },
  // The descent's foot: daybreak — the country opens in one breath.
  { name: "daybreak", u: 1318, v: -4, lift: 5.0, atU: 1372, atV: -6, pitch: -0.1 },
  // The font country: towers welling light, the choir crossing.
  { name: "the-fonts", u: 1372, v: -30, lift: 4.2, atU: 1428, atV: 4, pitch: 0.1 },
  // THE BELFRY: the tallest font, portrait range.
  { name: "the-belfry", u: 1418, v: -30, lift: 3.6, atU: 1442, atV: -46, pitch: 0.16 },
  // At the Belfry's doorway, looking into the lit room.
  { name: "belfry-heart", u: 1442, v: -34, lift: 2.4, atU: 1442, atV: -46, pitch: 0.14, settle: 4 },
  // THE STILL MORNING from its lip: the mirror, the reflection lane.
  // Round 4: INTO the mirror — r2/r3 both skimmed the bowl and the
  // pearl floor never read; from the lip, pitched down, it must.
  { name: "still-morning", u: 1424, v: 58, lift: 6.5, atU: 1438, atV: 74, pitch: -0.55, settle: 4 },
  // The Blushfields: dawn colour on the ground, fonts behind.
  { name: "blushfields", u: 1444, v: -84, lift: 2.6, atU: 1496, atV: -68, pitch: -0.02 },
  // The Dawn Steps toward the pearl: the region's proof frame.
  // Round 2: stepped closer — at 60 m the terraces washed to fog.
  { name: "dawn-steps", u: 1572, v: 10, lift: 3.0, atU: 1618, atV: 2, pitch: 0.04 },
  // THE DAYSPRING: the risen pearl, the veil, the Chorister.
  { name: "the-dayspring", u: 1594, v: -14, lift: 2.8, atU: 1630, atV: 0, pitch: 0.08 },
  // On the Sun's Doorstep, the dome an EVENT with its ring and shaft
  // (round 4: the r2/r3 pose stood 15 m out and the dome was a wall
  // of skin — no gradient survives filling four-fifths of a frame).
  { name: "suns-doorstep", u: 1594, v: -8, lift: 5.0, atU: 1630, atV: 0, pitch: 0.02, settle: 5 },
  // Looking back the way we came: the font skyline over the road.
  { name: "dawn-lookback", u: 1560, v: 4, lift: 7.5, atU: 1460, atV: 0, pitch: 0.02 },
  // ── The close set (2–4 m, the owner's judged distance) ──
  // Round 2: backed out of the font's own skirt radius — the r1 pose
  // stood inside it and framed eight metres of flat wall.
  { name: "close-font-foot", u: 1390, v: -13, lift: 1.5, atU: 1383, atV: -7, pitch: -0.42 },
  { name: "close-blush-bed", u: 1470, v: -78, lift: 1.4, atU: 1474, atV: -82, pitch: -0.45 },
  { name: "close-road-shelf", u: 1190, v: 1, lift: 1.3, atU: 1194, atV: 3, pitch: -0.5 },
  { name: "close-terrace-lip", u: 1588, v: 8, lift: 1.5, atU: 1592, atV: 12, pitch: -0.45 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = pale3TerrainTarget(x, z) + spec.lift;
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

export const PALE_3: RegionDef = {
  slotId: PALE3_SLOT.id,
  title: "The Dayspring",
  emotion: "out from behind the paper, into the morning — the light the whole white world rises from",

  weight: pale3Weight,
  terrainTarget: pale3TerrainTarget,
  ceiling: pale3Ceiling,
  floorClearance: 0.7,

  mood: {
    // The province's milk at its brightest and warmest — the morning
    // side of the paper: red a breath over the Combs' 3.7, gold up,
    // blue down a step; density eased a hair so the long dawn views
    // keep their paint (the fonts must layer through ~60 m).
    // Round 2: density 0.0055 → 0.0065 and the scale milkier — r1's
    // upper third showed the dark backdrop through too-clear water
    // (teal, not morning milk); backdropFade up with it.
    fog: { colorScale: [4.2, 1.38, 1.16], densityGain: 0.0065, backdropFade: 0.36 },
    // Morning light flat from ahead and above, shadows violet: the
    // province's light grammar, warmed one more step because the
    // source is HERE. Round 2: sun and hemisphere up a breath — the
    // r1 ground read tan-in-shade instead of paper.
    light: { sun: 0.52, hemisphere: 0.34, ambient: -0.42 },
  },
  moodSurface: 16,
  moodDescent: 8,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-pale-passage-3";

    const fonts = buildPale3Fonts();
    const dayspring = buildPale3Dayspring();
    const gardens = buildPale3Gardens(fonts.crownSpots);
    const cover = buildPale3Cover(
      fonts.footSpots.map((spot) => ({
        pos: [spot.x, spot.z] as [number, number],
        facing: spot.facing,
        spread: 5,
      })),
    );
    const belfryMouth = fonts.crownSpots.find(
      (spot) =>
        Math.hypot(spot.mouth[0] - worldOf(1442, -46).x, spot.mouth[2] - worldOf(1442, -46).z) < 8,
    )!;
    const light = buildPale3Light({
      x: belfryMouth.mouth[0],
      y: belfryMouth.mouth[1],
      z: belfryMouth.mouth[2],
    });
    const life = buildPale3Life(fonts.footSpots, fonts.crownSpots, gardens.budSpots, dayspring.crest);
    const chorister = buildChorister(dayspring.crest.y);
    const distance = buildPale3Distance();
    const ground = buildPale3Ground([...fonts.contacts, ...dayspring.contacts]);

    for (const mesh of [
      ...ground,
      ...fonts.meshes,
      ...dayspring.meshes,
      ...gardens.meshes,
      ...cover.groups,
      ...light.groups,
      ...life.meshes,
      ...life.groups,
      chorister.group,
      ...distance.meshes,
    ]) {
      group.add(mesh);
    }

    const colliders = [...fonts.colliders, ...dayspring.colliders, ...buildSeals()];

    return {
      group,
      colliders,
      targets: [chorister.target],
      update(_dt, ctx): void {
        // Everything is a closed form of simulated seconds (capture-
        // safe, deterministic); reduced motion slows the clock.
        const kitTime = ctx.time * (ctx.reducedMotion ? 0.45 : 1);
        cover.update(kitTime);
        life.update(ctx.time, ctx.reducedMotion);
        chorister.update(ctx.time, ctx.reducedMotion);
      },
    };
  },

  codexEntries: [
    {
      id: CHORISTER_SPECIES_ID,
      commonName: "The Chorister",
      scientificName: "Clione aurorae",
      fact:
        "A great white sea-angel the length of an arm, wings of translucent " +
        "tissue tipped with dawn-rose, a small warm heart glowing through its " +
        "chest. It rises and falls on one slow ring before the risen pearl, " +
        "cresting above the light once every round — a bird greeting a sun " +
        "that never finishes rising.",
      codexLine: "It has sung the same first note of morning since the sea was young.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests.
export { buildSeals };
export { channelCenter };
