import type { Group } from "three";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildParticulateField } from "../kit/ParticulateField";
import { buildPercherColony, type PercherAnchor } from "../kit/PercherColony";
import { buildShoalRunner } from "../kit/ShoalRunner";
import { SPINE_ROAD } from "./Blue2Beats";
import { WRACK_FRAGMENTS } from "./Blue2Stones";
import { B2_SEEDS } from "./Blue2Shared";
import {
  CURRENT_SPINE,
  MOORING_POSTS,
  SPILL,
  WEIR,
  FORD,
  worldOf,
} from "./Blue2Terrain";

/**
 * The Deep Steps' systemic life — a SYSTEM, short of saturation, in
 * the province where stillness is the voice:
 *
 * - **Marine snow** region-wide (the empty water needs something to
 *   measure itself against — the Drop Plains' own argument) and a
 *   **midwater plankton layer at the Terraces' PROVEN density** in two
 *   bands, one over the bright shelves and one in the deep, so random
 *   midwater frames keep a foreground at every floor.
 * - **THE TRAVELLERS**: the province's silver shoal riding the Old
 *   Current bank to bank and home — the river's life, and the proof
 *   the water moves. Life as wayfinding: follow the silver to the
 *   Ford, the Weir, the Spill.
 * - **The pilgrim fry**: a small school commuting the spine road from
 *   the Stairfall to the Chute's rim — and TURNING BACK there: the
 *   Round is the Gentle Dark's, by licence.
 * - **Perchers on every surface type**: cushion-star trios at the
 *   Mooring posts' feet, blennies on the Weir's shoulders, darting
 *   crabs among the Kings' Wrack, hover-fry in the Spill's breath.
 *
 * Every stream is `SEEDS.regionBlue2 ^` a fresh constant; updates are
 * closed-form off simulated time (the connective-3 traveller-phase
 * lesson pre-paid — captures settle deterministically).
 */

const SEED = SEEDS.regionBlue2;

export interface Blue2LifeBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

export function buildBlue2Life(): Blue2LifeBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  // ── The air: snow + the two plankton bands ───────────────────────────────
  const heart = worldOf(940, 0);
  const snow = buildParticulateField({
    seed: SEED ^ B2_SEEDS.snow,
    tint: 0xd6daea,
    count: 750,
    mode: "fall",
    volume: { center: [heart.x, -16, heart.z], size: [420, 46, 420] },
    size: 0.11,
    opacity: 0.45,
  });
  groups.push(snow.group);
  updaters.push((t) => snow.update(t));

  // 1,600 is the Emerald Terraces' proven midwater density; split
  // across the two floors this region actually has.
  const shelfBand = buildParticulateField({
    seed: SEED ^ B2_SEEDS.plankton,
    tint: 0xdfe4ee,
    count: 950,
    mode: "drift",
    volume: { center: [heart.x, -13, heart.z], size: [400, 20, 400] },
    // Round 3: sized up a step — the shelf band is the only midwater
    // foreground the open flanks have, and at 0.4 it vanished from the
    // r2 sweep's flank frame.
    size: 0.46,
    opacity: 0.32,
    bias: { dir: [0.32, 0.04, -0.2], speed: 0.14 },
  });
  groups.push(shelfBand.group);
  updaters.push((t) => shelfBand.update(t));

  const deep = worldOf(985, -20);
  const deepBand = buildParticulateField({
    seed: SEED ^ B2_SEEDS.planktonDeep,
    tint: 0xd2d0e6,
    count: 700,
    mode: "drift",
    volume: { center: [deep.x, -38, deep.z], size: [300, 16, 300] },
    size: 0.42,
    opacity: 0.3,
    bias: { dir: [-0.2, 0.03, 0.3], speed: 0.12 },
  });
  groups.push(deepBand.group);
  updaters.push((t) => deepBand.update(t));

  // ── THE TRAVELLERS: the Old Current, ridden ──────────────────────────────
  const stations: (readonly [number, number, number])[] = [];
  const seat = (u: number, v: number, lift: number): void => {
    const { x, z } = worldOf(u, v);
    stations.push([x, seabedHeight(x, z) + lift, z] as const);
  };
  for (const [u, v] of CURRENT_SPINE) {
    seat(u, v, 1.9);
  }
  // The turn below the Spill, and home along the river's far bank.
  seat(SPILL.u + 16, SPILL.v - 26, 3.2);
  for (let i = CURRENT_SPINE.length - 1; i >= 0; i--) {
    seat(CURRENT_SPINE[i]![0] + 4, CURRENT_SPINE[i]![1] + 7, 4.2);
  }
  // Round 2, the phase rotation: the capture shutter lands ≈ 18 s after
  // attach (head ≈ 6% of the 300 s loop), so the loop STARTS one
  // station upstream of the Ford and the school is crossing under the
  // Weir when the canonical weir-ford frame fires — the Drop Plains'
  // "unmissable by timing" lesson, paid with arithmetic instead of a
  // second school.
  const rotated = [...stations.slice(3), ...stations.slice(0, 3)];
  stations.length = 0;
  stations.push(...rotated);
  const travellers = buildShoalRunner({
    seed: SEED ^ B2_SEEDS.travellers,
    route: { stations, closed: true },
    count: 60,
    fish: { scale: 0.95, color: 0xdcebf2, emissive: 0x5a7488, profile: "fusilier" },
    phaseSpeed: 1 / 300,
    braid: { lateral: 0.7, vertical: 0.4 },
    glint: { count: 30, size: 0.13 },
  });
  groups.push(travellers.group);
  updaters.push((t) => travellers.update(t));

  // ── The pilgrim fry: the road, swum — and the Round refused ──────────────
  const pilgrimStations: (readonly [number, number, number])[] = [];
  for (const [u, v] of SPINE_ROAD) {
    if (u < 756 || u > 958) {
      continue;
    }
    pilgrimStations.push((() => {
      const { x, z } = worldOf(u, v + 2);
      return [x, seabedHeight(x, z) + 2.2, z] as const;
    })());
  }
  for (const [u, v] of [...SPINE_ROAD].reverse()) {
    if (u < 756 || u > 958) {
      continue;
    }
    pilgrimStations.push((() => {
      const { x, z } = worldOf(u, v - 3);
      return [x, seabedHeight(x, z) + 3.4, z] as const;
    })());
  }
  const pilgrims = buildShoalRunner({
    seed: SEED ^ B2_SEEDS.pilgrims,
    route: { stations: pilgrimStations, closed: true },
    count: 26,
    fish: { scale: 0.62, color: 0xc8d8e6, emissive: 0x4c6478, profile: "fry" },
    phaseSpeed: 1 / 240,
    braid: { lateral: 0.5, vertical: 0.3 },
  });
  groups.push(pilgrims.group);
  updaters.push((t) => pilgrims.update(t));

  // ── The perchers ─────────────────────────────────────────────────────────
  const starAnchors: PercherAnchor[] = [];
  {
    const random = new Random(SEED ^ B2_SEEDS.postStars);
    for (const post of MOORING_POSTS) {
      const angle = random.range(0, Math.PI * 2);
      const { x, z } = worldOf(
        post.u + Math.cos(angle) * (post.radius + 1.6),
        post.v + Math.sin(angle) * (post.radius + 1.6),
      );
      starAnchors.push({ pos: [x, seabedHeight(x, z) + 0.05, z] });
    }
  }
  const postStars = buildPercherColony({
    seed: SEED ^ B2_SEEDS.postStars,
    palette: { base: 0x9a8ec2, tip: 0xc8c0e0, shade: 0x5c5484 },
    anchors: starAnchors,
    perAnchor: 3,
    body: "star",
    motion: "seated",
  });
  groups.push(postStars.group);

  const weirAt = worldOf(WEIR.u - 4, WEIR.v + 5);
  const fordAt = worldOf(FORD.u + 5, FORD.v - 6);
  const blennies = buildPercherColony({
    seed: SEED ^ B2_SEEDS.weirBlennies,
    palette: { base: 0xa8b2b6, tip: 0xd2dcd8, shade: 0x6a7288 },
    anchors: [
      { pos: [weirAt.x, seabedHeight(weirAt.x, weirAt.z) + 0.1, weirAt.z] },
      { pos: [fordAt.x, seabedHeight(fordAt.x, fordAt.z) + 0.1, fordAt.z] },
    ],
    perAnchor: 2,
    body: "blenny",
    motion: "seated",
  });
  groups.push(blennies.group);

  const crabAnchors: PercherAnchor[] = [];
  {
    const random = new Random(SEED ^ B2_SEEDS.strandCrabs);
    for (const fragment of WRACK_FRAGMENTS) {
      if (fragment.standing) {
        continue;
      }
      const { x, z } = worldOf(fragment.u + random.signed(3), fragment.v + random.signed(3));
      crabAnchors.push({ pos: [x, seabedHeight(x, z) + 0.06, z] });
    }
  }
  const crabs = buildPercherColony({
    seed: SEED ^ B2_SEEDS.strandCrabs,
    palette: { base: 0xa89ab2, tip: 0xd0c6d4, shade: 0x665e7c },
    anchors: crabAnchors,
    perAnchor: 2,
    body: "shrimp",
    motion: "dart",
  });
  groups.push(crabs.group);
  if (crabs.update) {
    updaters.push((t) => crabs.update!(t));
  }

  const spillFoot = worldOf(SPILL.u + 8, SPILL.v - 14);
  const spillFry = buildPercherColony({
    seed: SEED ^ B2_SEEDS.spillFry,
    palette: { base: 0xbcd4c8, tip: 0xe2f2e6, shade: 0x6e8a80 },
    anchors: [{ pos: [spillFoot.x, seabedHeight(spillFoot.x, spillFoot.z) + 1.3, spillFoot.z] }],
    perAnchor: 6,
    body: "fry",
    motion: "hover",
  });
  groups.push(spillFry.group);
  if (spillFry.update) {
    updaters.push((t) => spillFry.update!(t));
  }

  return {
    groups,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}
