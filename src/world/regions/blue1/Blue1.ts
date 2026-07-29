import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildBlue1Distance } from "./Blue1Distance";
import { FERRYMAN_SPECIES_ID, buildFerryman } from "./Blue1Ferryman";
import { buildBlue1Ground } from "./Blue1Ground";
import { buildBlue1Life } from "./Blue1Life";
import { buildBlue1Light } from "./Blue1Light";
import { buildBlue1Steppe } from "./Blue1Steppe";
import { buildBlue1Stones } from "./Blue1Stones";
import {
  BLUE1_SLOT,
  CENTER_X,
  CENTER_Z,
  SEAL_RC,
  SLOPE_TO,
  blue1Ceiling,
  blue1TerrainTarget,
  blue1Weight,
  slopeFloor,
  spokeOf,
  tongueHalfWidth,
  worldOf,
} from "./Blue1Terrain";

/**
 * THE DROP PLAINS — region `great-blue-1`, province The Great Blue.
 *
 * The Open Blue wing was the lip of vertigo; this is the country past it:
 * the great blue steppe before the true abyss. Its subject is space
 * itself — vastness composed, not emptiness neglected. The Long Slope
 * glides down out of the wing while the last reef colour falls away
 * behind; the Seagrass Steppe rolls its blue-green swells layer after
 * layer into the fog; the Standing Stones each hold their own hundred
 * metres of prairie, one of them keeping a secret at its foot; the
 * Migration Line crosses the whole region mid-water, a permanent river
 * of silver; the Terraces step the floor down a value at a time; and at
 * the World's Edge the floor simply ends — the drop past −46, the high
 * ceiling, the Ferryman working the void, the painted deep beyond.
 *
 * Pure half in `Blue1Terrain`; built half in the sibling modules. Every
 * stream is `SEEDS.regionBlue1` or a `^` substream.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver the moment they reach weight = 0,
// so every open edge is walled inside the weight-1 core, where the annex
// floor (`terrainTarget + clearance`) and the composed ground are the
// same function — the honesty that matters most here, forty-six metres
// down. The ring at rc = 164 seals the disc (the ceiling has closed to
// floor + 3 there); the slope's flanks take stacked rows because the
// glide's water column is up to twenty-five metres tall; the doorway and
// the ring's corridor gap take dense gate stacks.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  // The rim ring, gapped over the corridor's spine.
  const count = 92;
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = CENTER_X + Math.cos(theta) * SEAL_RC;
    const z = CENTER_Z + Math.sin(theta) * SEAL_RC;
    const { v } = spokeOf(x, z);
    if (Math.abs(v) < 20 && Math.cos(theta - (BLUE1_SLOT.azimuth + Math.PI)) > 0) {
      continue;
    }
    seals.push({
      center: new Vector3(x, blue1TerrainTarget(x, z) + 1.5, z),
      radius: 9,
    });
  }

  // The doorway stacks at the wing seam: a tight door is what a doorway
  // is, and the wing's own walls carry everything below r ≈ 50.
  for (const u of [50, 56, 62]) {
    const lateral = tongueHalfWidth(u) - 0.5;
    const floor = slopeFloor(u);
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * lateral);
      for (const level of [2, 8.5, 15, 21]) {
        seals.push({ center: new Vector3(x, floor + level, z), radius: 4.5 });
      }
    }
  }

  // The slope's flank rows: three levels per station because the glide's
  // ceiling starts high at the seam; levels above the local ceiling are
  // skipped as the glide takes the column down.
  for (let u = 62; u <= 296; u += 13) {
    const lateral = tongueHalfWidth(u) - 4;
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * lateral);
      const floor = blue1TerrainTarget(x, z);
      const ceiling = blue1Ceiling(x, z);
      for (const level of [4, 11.5, 19]) {
        if (floor + level - 6 > ceiling) {
          continue;
        }
        seals.push({ center: new Vector3(x, floor + level, z), radius: 6.2 });
      }
    }
  }

  // The gate posts where the ring's gap meets the corridor: the ceiling
  // is only half-closed across the gap's shoulders, so the posts carry
  // the upper half of those columns.
  for (const u of [276, 286, 296]) {
    for (const side of [-1, 1]) {
      for (const lateral of [21, 27.5]) {
        const { x, z } = worldOf(u, side * lateral);
        const floor = blue1TerrainTarget(x, z);
        for (const level of [4, 10]) {
          seals.push({ center: new Vector3(x, floor + level, z), radius: 5 });
        }
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
  /** Absolute y instead of ground-relative, for the deep-water poses. */
  readonly absoluteY?: number;
}

const POSE_SPECS: readonly PoseSpec[] = [
  // The glide: shoulders, waymarks, the blue opening ahead.
  { name: "slope-glide", u: 108, v: 2, lift: 2.6, atU: 168, atV: 6, pitch: -0.02 },
  // The reveal: the steppe opening, stones ghosting, the band glinting.
  { name: "slope-reveal", u: 288, v: 0, lift: 3.2, atU: 352, atV: 30, pitch: -0.04, settle: 4 },
  // The prairie: grass foreground, swell layers, a stone in the fog.
  { name: "steppe-sea", u: 352, v: -34, lift: 2.4, atU: 415, atV: 58, pitch: 0.03 },
  // The Gnomon, close and low: the tallest stone in the province.
  { name: "gnomon", u: 407, v: 50, lift: 2.2, atU: 416, atV: 58, pitch: 0.32 },
  // The Fallen King's secret: the ring, the beam, the toppled crown.
  { name: "fallen-king", u: 377, v: -104, lift: 2.0, atU: 383.5, atV: -100, pitch: -0.06, settle: 5 },
  // The Sisters framing the Wayline's run toward the Edge.
  { name: "sisters-frame", u: 461, v: -44, lift: 2.6, atU: 520, atV: -8, pitch: 0.02 },
  // Under the Migration Line, looking along the silver.
  { name: "migration-river", u: 442, v: 46, lift: 4.5, atU: 478, atV: 74, pitch: 0.14, settle: 6 },
  // The Terrace Stairs: three shelves stepping down into deeper value.
  { name: "terrace-stairs", u: 462, v: 18, lift: 3.4, atU: 540, atV: 0, pitch: -0.08 },
  // The Prow: the Friedrich overlook — the drop, the deep steps beyond.
  { name: "the-prow", u: 540, v: 4, lift: 2.2, atU: 600, atV: 0, pitch: -0.18, settle: 5 },
  // Down inside the void, against the cliff, the painted deep ahead.
  { name: "under-blue", u: 556, v: -20, lift: 0, absoluteY: -38, atU: 606, atV: -8, pitch: 0.06 },
  // The Ferryman working the edge; the aim rides beside the anchor so the
  // settle frames the patrol without completing the discovery plate.
  { name: "ferryman", u: 561, v: 30, lift: 0, absoluteY: -26, atU: 578, atV: -8, pitch: -0.04, settle: 8 },
  // From the lip, back across everything: terraces, stones, steppe.
  { name: "edge-lookback", u: 548, v: -8, lift: 2.4, atU: 445, atV: -14, pitch: 0.06 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = spec.absoluteY ?? blue1TerrainTarget(x, z) + spec.lift;
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

export const BLUE_1: RegionDef = {
  slotId: BLUE1_SLOT.id,
  title: "The Drop Plains",
  emotion: "vast blue calm — wander the prairie until the world ends",

  weight: blue1Weight,
  terrainTarget: blue1TerrainTarget,
  ceiling: blue1Ceiling,
  floorClearance: 0.7,

  mood: {
    // The whole blue register, keyed to its deep end: at full mood the
    // water goes violet-blue (red held above green) and *clears* — the
    // vastness argument wants long sightlines, not soup — while the
    // light steps down. The descent below makes depth itself the dimmer:
    // the steppe swims at roughly half of this, bright; the Under-Blue
    // takes all of it.
    fog: { colorScale: [0.68, 0.62, 1.02], densityGain: -0.0045, backdropFade: 0.5 },
    light: { sun: 0.38, hemisphere: 0.3, ambient: 0.06 },
  },
  moodSurface: 6,
  moodDescent: 36,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-great-blue-1";

    const stones = buildBlue1Stones();
    const steppe = buildBlue1Steppe();
    const life = buildBlue1Life();
    const ferryman = buildFerryman();
    const light = buildBlue1Light();
    const distance = buildBlue1Distance();
    const ground = buildBlue1Ground(stones.contacts);

    for (const mesh of [
      ...ground,
      ...stones.meshes,
      ...steppe.meshes,
      ...life.meshes,
      ferryman.mesh,
      ...light.meshes,
      ...distance.meshes,
    ]) {
      group.add(mesh);
    }

    const colliders = [...stones.colliders, ...buildSeals()];

    return {
      group,
      colliders,
      targets: [ferryman.target],
      update(dt, ctx): void {
        steppe.update(dt, ctx.reducedMotion);
        life.update(dt, ctx.time, ctx.reducedMotion);
        ferryman.update(ctx.time, ctx.reducedMotion);
      },
    };
  },

  codexEntries: [
    {
      id: FERRYMAN_SPECIES_ID,
      commonName: "The Ferryman",
      scientificName: "Mola traiectus",
      fact:
        "An ancient giant sunfish that patrols the World's Edge, crossing " +
        "and recrossing the lip of the drop like a boatman working a bank. " +
        "The pale ring on its flank is older than any diver's charts.",
      codexLine: "It keeps the border between the country of grass and the country of nothing.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// region's collision contract and the tests read them back.
export { buildSeals };

// Referenced by the tests to hold the slope's handoff constants honest.
export { SLOPE_TO };
