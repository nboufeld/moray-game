import { SEEDS } from "../../../util/Random";
import { paleTerrainTarget } from "../pale1/PaleTerrain";
import { buildRoadDressing, type RoadDressingBuild, type RoadFrame } from "../RoadDressing";
import {
  PALE2_SLOT,
  pale2TerrainTarget,
  spokeOf,
  stillnessGate,
  worldOf,
} from "./Pale2Terrain";

/**
 * ROADS-AND-AXES, pale-passage-2's serving (critic #2/#6/#10; the
 * pass23/pale-3-threshold family was cited as "the emptiest road in
 * the game" — this is the 1→2 half of the fix; ledger
 * roads-and-axes.md).
 *
 * - **The pass-1→2 corridor** (u 630–780): ONE reveal — a pair of bone
 *   menhirs bowed over the road (the standing-stone vocabulary the
 *   province ends on, cooled white); ONE companion shoal — the
 *   pearl-white tetra file confined to the corridor; ONE light change
 *   — TWO BROKEN SLANTED BLADES (C7: not the god-shaft; pale's paper
 *   light arrives sideways through milk), with their floor pools.
 *   NO dapple anywhere in pale — upheld. Bone-gravel wear lines carry
 *   the mid-down read.
 *
 * - **The mid-down interior** at the critic's stand (985, −60): a bone
 *   drift-line and a slow pearl under-shoal — colour restraint, milk
 *   register, quiet not dead. Everything gates on `stillnessGate`
 *   (the White Chapel, the Still Pool, the Winnow Shadow).
 */

const CORRIDOR_SEED = (SEEDS.regionPale2 ^ 0x0ad5_0a11) >>> 0;
const MIDDOWN_SEED = (SEEDS.regionPale2 ^ 0x0ad5_0b22) >>> 0;

const corridorFrame: RoadFrame = {
  azimuth: PALE2_SLOT.azimuth,
  worldOf,
  ground: (x, z) => Math.max(paleTerrainTarget(x, z), pale2TerrainTarget(x, z)),
};

const interiorFrame: RoadFrame = {
  azimuth: PALE2_SLOT.azimuth,
  worldOf,
  ground: pale2TerrainTarget,
};

const PEARL_FISH = {
  scale: 0.8,
  color: 0xeef2ea,
  emissive: 0x3c3e3a,
  profile: "tetra",
} as const;

/** Bone gravel families: paper-warm over violet shadow (the value key). */
const BONE_PALETTE = { base: 0xdcdce6, shade: 0x6f5c88 } as const;

const rests = (x: number, z: number): number => {
  const { u, v } = spokeOf(x, z);
  return stillnessGate(u, v);
};

/** The blades' heads, metres over the corridor floor at their feet. */
const BLADE_RISE = 13;

export function buildPale2Roads(): RoadDressingBuild[] {
  const bladeA = worldOf(676, 6);
  const bladeB = worldOf(716, -7);
  const corridor = buildRoadDressing({
    seed: CORRIDOR_SEED,
    frame: corridorFrame,
    reveal: {
      kind: "leaning-pair",
      u: 694,
      v: 8,
      gap: 5.5,
      scale: 1.0,
      color: 0xe1e2ef,
    },
    corridorShoal: {
      u0: 645,
      u1: 755,
      sideV: 5,
      lift: 2.5,
      count: 22,
      fish: PEARL_FISH,
      periodSec: 105,
      braid: { lateral: 0.32, vertical: 0.2 },
      glint: { count: 12, size: 0.1 },
    },
    lights: [
      {
        kind: "shafts",
        tint: 0xf0eee2,
        beams: [
          {
            u: 676,
            v: 6,
            top: corridorFrame.ground(bladeA.x, bladeA.z) + BLADE_RISE,
            width: 3.4,
            opacity: 0.15,
            slant: [0.3, 0.14],
          },
          {
            u: 716,
            v: -7,
            top: corridorFrame.ground(bladeB.x, bladeB.z) + BLADE_RISE,
            width: 2.8,
            opacity: 0.13,
            slant: [0.38, -0.1],
          },
        ],
        pools: "auto",
      },
    ],
    ribbons: [-1, 1].map((side) => ({
      polyline: [
        [645, side * 3.6],
        [700, side * 4.4],
        [755, side * 3.2],
      ],
      width: 2.4,
      count: 120,
      palette: BONE_PALETTE,
      shapeSet: "gravel",
      grade: 0.6,
      gate: rests,
    })),
  });

  const midDown = buildRoadDressing({
    seed: MIDDOWN_SEED,
    frame: interiorFrame,
    loopShoals: [
      {
        centerU: 982,
        centerV: -58,
        radiusU: 18,
        radiusV: 12,
        lift: 5.5,
        count: 12,
        fish: PEARL_FISH,
        periodSec: 160,
        braid: { lateral: 0.28, vertical: 0.18 },
      },
    ],
    ribbons: [
      {
        polyline: [
          [956, -46],
          [985, -58],
          [1014, -70],
        ],
        width: 5,
        count: 150,
        palette: BONE_PALETTE,
        shapeSet: "gravel",
        twoTone: true,
        grade: 0.5,
        gate: rests,
      },
    ],
  });

  return [corridor, midDown];
}
