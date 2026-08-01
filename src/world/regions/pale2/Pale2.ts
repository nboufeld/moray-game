import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildPale2Combs } from "./Pale2Combs";
import { buildPale2Cover } from "./Pale2Cover";
import { buildPale2Distance } from "./Pale2Distance";
import { buildPale2Gardens } from "./Pale2Gardens";
import { buildPale2Ground } from "./Pale2Ground";
import { buildPale2Lamp } from "./Pale2Lamp";
import { LAMPWRIGHT_SPECIES_ID, buildLampwright } from "./Pale2Lampwright";
import { buildPale2Life } from "./Pale2Life";
import { buildPale2Light } from "./Pale2Light";
import {
  PALE2_SLOT,
  channelCenter,
  farGate,
  pale2Ceiling,
  pale2TerrainTarget,
  pale2Weight,
  passGate,
  passHalfWidth,
  spokeOf,
  worldOf,
} from "./Pale2Terrain";

/**
 * THE LANTERN COMBS — region `pale-passage-2`, province The Pale
 * Passage, the province's second chamber.
 *
 * The Bone Meadows answered "life returns"; this chamber answers where
 * the pale light comes from. Past the Mother-Coral's colour-return the
 * white goes bright instead of bleached: ranks of wind-curved chalk
 * comb-fins standing over a rolling white country, translucent
 * paper-fan corals lit through their own tissue, sunken moonmilk pools
 * of luminous pearl water, the strictest hush in the game (THE WHITE
 * CHAPEL), and at the far heart THE LAMP — a hollow chalk lantern-
 * spire whose ribbed cage holds the warm light the whole province's
 * paper is held to, tended by the Lampwright on its slow rounds. The
 * far rim frames the reserved depth-3 gate and the painted DAYSPRING —
 * the promise that the light has a source further out.
 *
 * Pure half in `Pale2Terrain`; built half in the sibling modules.
 * Every stream is `SEEDS.regionPale2` or a `^` substream.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver at weight = 0, so the open
// edges are walled: a rim ring of two-sphere stacks just inside the
// disc's edge — gated open over the inbound pass corridor AND over the
// reserved depth-3 corridor (the verdant-2 cut, pre-paid) — and rows
// along the pass tongue's shoulders from the Bone Meadows' rim down to
// the Winnow's foot. The threshold's mouth needs no seal of its own:
// behind it pale-1's domain and walls take over — the handover working.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  const rimR = 198;
  const count = 92;
  const center = worldOf(940, 0);
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = center.x + Math.cos(theta) * rimR;
    const z = center.z + Math.sin(theta) * rimR;
    const { u, v } = spokeOf(x, z);
    if (passGate(u, v) > 0.3 || farGate(u, v) > 0.3) {
      continue;
    }
    const floor = pale2TerrainTarget(x, z);
    seals.push(
      { center: new Vector3(x, floor + 1.5, z), radius: 9 },
      { center: new Vector3(x, floor + 8.5, z), radius: 7 },
    );
  }

  // The pass shoulders: rows down both flanks from pale-1's rim to the
  // Winnow's foot, just inside the tongue's edge.
  for (let u = 640; u <= 806; u += 13) {
    const hw = passHalfWidth(u);
    const edge = Math.min(hw - 1.2, Math.max(hw - 4, 20.5));
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * edge);
      const floor = pale2TerrainTarget(x, z);
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
  // From the Bone Meadows' side of the overlap, looking in — the pass
  // pose the handover is judged by. (Pale-1's far distance rings stand
  // between here and the country: from this side they ARE the promise;
  // our gate composition lives past them at u ≥ 745.)
  { name: "pass-threshold", u: 642, v: 0, lift: 1.6, atU: 700, atV: 2, pitch: 0.0 },
  // The Comb Gate: the two curved fins framing the Winnow's mouth.
  { name: "comb-gate", u: 733, v: 2, lift: 2.4, atU: 756, atV: 0, pitch: -0.06 },
  // On the Winnow itself, close and steep (the stair lesson: get ON
  // the road, subject inside 30 m).
  { name: "the-winnow", u: 758, v: -3, lift: 3.4, atU: 780, atV: 2, pitch: -0.26 },
  // In the Winnow Shadow, looking back up at the light — the rest
  // read as a composed held breath.
  { name: "winnow-hush", u: 795, v: 2, lift: 2.0, atU: 770, atV: -2, pitch: 0.1, settle: 4 },
  // The descent's foot: the comb country opens in one breath.
  { name: "gallery-crossing", u: 816, v: -4, lift: 5.0, atU: 870, atV: -10, pitch: -0.1 },
  // The Great Comb: the tallest fin, its flank crowded with lit fans.
  { name: "great-comb", u: 874, v: -16, lift: 4.0, atU: 902, atV: 8, pitch: 0.16 },
  // The Moonmilk Pools: luminous bowls, pearl lips, frond gardens.
  { name: "moonmilk-pools", u: 878, v: -42, lift: 3.0, atU: 897, atV: -56, pitch: -0.12, settle: 4 },
  // The Still Pool: the rest, composed — glass water, bare lip.
  { name: "still-pool", u: 860, v: -74, lift: 2.2, atU: 872, atV: -84, pitch: -0.1, settle: 4 },
  // THE WHITE CHAPEL, through its ring's doorway: the pan, the beam.
  { name: "white-chapel", u: 876, v: 64, lift: 2.4, atU: 905, atV: 74, pitch: 0.02, settle: 4 },
  // THE LAMP from the basin rim: the whole lantern in one portrait.
  { name: "the-lamp", u: 984, v: -24, lift: 3.6, atU: 1022, atV: -4, pitch: 0.12 },
  // Inside the crater at the cage's foot, looking up through the ribs
  // to the heart — the Lampwright crosses on its rounds.
  { name: "lamp-heart", u: 1012, v: -2, lift: 3.0, atU: 1022, atV: -4, pitch: 0.5, settle: 8 },
  // The lantern gardens down the basin's slopes.
  { name: "lantern-gardens", u: 1042, v: -28, lift: 2.4, atU: 1024, atV: -8, pitch: 0.02, settle: 4 },
  // The Pearl Steps and the Far Gate: the Dayspring promise.
  { name: "pearl-steps", u: 1076, v: 6, lift: 3.2, atU: 1128, atV: 8, pitch: 0.06 },
  // Looking back the way we came: the comb skyline over the road.
  { name: "white-lookback", u: 1002, v: 12, lift: 5.0, atU: 900, atV: 0, pitch: 0.02 },
  // ── The close set (2–4 m, the owner's judged distance) ──
  { name: "close-gallery-floor", u: 856, v: -12, lift: 1.4, atU: 860, atV: -8, pitch: -0.5 },
  { name: "close-pool-rim", u: 904, v: -50, lift: 1.6, atU: 899, atV: -55, pitch: -0.44 },
  { name: "close-road-shelf", u: 690, v: 1, lift: 1.3, atU: 694, atV: 3, pitch: -0.5 },
  { name: "close-garden-bed", u: 1038, v: -16, lift: 1.4, atU: 1034, atV: -12, pitch: -0.45 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = pale2TerrainTarget(x, z) + spec.lift;
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

export const PALE_2: RegionDef = {
  slotId: PALE2_SLOT.id,
  title: "The Lantern Combs",
  emotion: "behind the paper, the lamp — swim toward the light the white world is held to",

  weight: pale2Weight,
  terrainTarget: pale2TerrainTarget,
  ceiling: pale2Ceiling,
  floorClearance: 0.7,

  mood: {
    // The province's milk, one step BRIGHTER and WARMER than the Bone
    // Meadows' (the lamp side of the paper): red raised the same
    // fourfold the pilot measured, a breath more gold, density eased
    // so the comb ranks layer through ~60 m of legible water.
    fog: { colorScale: [3.5, 1.3, 1.12], densityGain: 0.0075, backdropFade: 0.28 },
    // Paper lit flat from above, shadows violet: half the sun, the
    // level given back as violet ambient — the province's light
    // grammar, warmed a step because the lamp is near.
    light: { sun: 0.5, hemisphere: 0.22, ambient: -0.45 },
  },
  moodSurface: 16,
  moodDescent: 8,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-pale-passage-2";

    const combs = buildPale2Combs();
    const lamp = buildPale2Lamp();
    const gardens = buildPale2Gardens(combs.fanAnchors, lamp.fanAnchors);
    const cover = buildPale2Cover(
      combs.footSpots.map((spot) => ({
        pos: [spot.x, spot.z] as [number, number],
        facing: spot.facing,
        spread: 5,
      })),
    );
    const light = buildPale2Light();
    const life = buildPale2Life(combs.footSpots, lamp.glowAnchors, lamp.mouth, gardens.lanternSpots);
    const lampwright = buildLampwright(lamp.heart, lamp.mouth.facing);
    const distance = buildPale2Distance();
    const ground = buildPale2Ground([...combs.contacts, ...lamp.contacts]);

    for (const mesh of [
      ...ground,
      ...combs.meshes,
      ...lamp.meshes,
      ...gardens.meshes,
      ...cover.groups,
      ...light.groups,
      ...life.meshes,
      ...life.groups,
      lampwright.group,
      ...distance.meshes,
    ]) {
      group.add(mesh);
    }

    const colliders = [...combs.colliders, ...lamp.colliders, ...buildSeals()];

    return {
      group,
      colliders,
      targets: [lampwright.target],
      update(_dt, ctx): void {
        // Everything is a closed form of simulated seconds (capture-
        // safe, deterministic); reduced motion slows the clock.
        const kitTime = ctx.time * (ctx.reducedMotion ? 0.45 : 1);
        cover.update(kitTime);
        life.update(ctx.time, ctx.reducedMotion);
        lampwright.update(ctx.time, ctx.reducedMotion);
      },
    };
  },

  codexEntries: [
    {
      id: LAMPWRIGHT_SPECIES_ID,
      commonName: "The Lampwright",
      scientificName: "Nautilus lucernifer",
      fact:
        "An ancient nautilus the size of a shield, its chalk shell banded " +
        "like paper held over a flame. It circles the Lamp on one slow " +
        "round, threading the rib-cage without ever touching it — trimming " +
        "the reef's last light the way a keeper trims a wick.",
      codexLine: "It tends the lamp the whole white world is held to.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests.
export { buildSeals };
export { channelCenter };
