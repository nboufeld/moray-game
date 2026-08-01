import type { Group } from "three";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildParticulateField } from "../kit/ParticulateField";
import { buildPercherColony, type PercherAnchor } from "../kit/PercherColony";
import { buildShoalRunner } from "../kit/ShoalRunner";
import { SPINE_ROAD } from "./Blue3Beats";
import { B3_SEEDS } from "./Blue3Shared";
import { ANCHOR, CHAIN_LINKS, CRADLE_SPINE, WELLHEAD, worldOf } from "./Blue3Terrain";

/**
 * THE FIRST SEA's systemic life — a SYSTEM, held far short of
 * saturation: this is the province of composed emptiness, and its last
 * room is its stillest. What life there is tells the one story: the
 * road is followed, the river is new, and the morning is kept.
 *
 * - **Marine snow** region-wide, plus a midwater plankton layer split
 *   across the region's two floors (the shelf light and the deep Mere)
 *   so random midwater frames keep a foreground at every depth.
 * - **THE DAWN SHOAL**: the province's silver shoal, arrived down the
 *   world's last road — over the Longfall, along the Chain to the
 *   Anchor, across the Shallows, round the Wellhead's rim and home.
 *   Life as wayfinding to the end.
 * - **The buoy fry**: a small school commuting the Longfall between
 *   the Daymark and the Chain's first link — and turning back there:
 *   the Mere beyond is the Morning Whale's.
 * - **Perchers on every surface type**: cushion-star trios at the
 *   chain links, blennies on the Anchor's arm, darting crabs on the
 *   Cradle's banks, hover-fry in the Wellhead's breath.
 *
 * Every stream is `SEEDS.regionBlue3 ^` a fresh constant; updates are
 * closed-form off simulated time — captures settle deterministically.
 */

const SEED = SEEDS.regionBlue3;

export interface Blue3LifeBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

export function buildBlue3Life(): Blue3LifeBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  // ── The air: snow + the two plankton bands ───────────────────────────────
  const heart = worldOf(1460, 0);
  // Round 3: count and presence up a step — the sweep's open-water
  // frames (04/05) read near-empty at the high stations. Round 4: up
  // once more for the rim band's half-water grazes.
  const snow = buildParticulateField({
    seed: SEED ^ B3_SEEDS.snow,
    tint: 0xdcdaec,
    count: 1400,
    mode: "fall",
    volume: { center: [heart.x, -26, heart.z], size: [420, 52, 420] },
    size: 0.12,
    opacity: 0.5,
  });
  groups.push(snow.group);
  updaters.push((t) => snow.update(t));

  const shelf = worldOf(1240, 0);
  const shelfBand = buildParticulateField({
    seed: SEED ^ B3_SEEDS.plankton,
    tint: 0xe4e2ea,
    count: 420,
    mode: "drift",
    volume: { center: [shelf.x, -4, shelf.z], size: [180, 12, 180] },
    size: 0.4,
    opacity: 0.32,
    bias: { dir: [0.3, 0.04, -0.22], speed: 0.14 },
  });
  groups.push(shelfBand.group);
  updaters.push((t) => shelfBand.update(t));

  const deep = worldOf(1462, -10);
  const deepBand = buildParticulateField({
    seed: SEED ^ B3_SEEDS.planktonDeep,
    tint: 0xdcd4e6,
    count: 1250,
    mode: "drift",
    volume: { center: [deep.x, -43, deep.z], size: [380, 18, 380] },
    size: 0.42,
    opacity: 0.32,
    bias: { dir: [-0.22, 0.03, 0.3], speed: 0.12 },
  });
  groups.push(deepBand.group);
  updaters.push((t) => deepBand.update(t));

  // ── THE DAWN SHOAL: the world's last road, ridden ────────────────────────
  const stations: (readonly [number, number, number])[] = [];
  const seat = (u: number, v: number, lift: number): void => {
    const { x, z } = worldOf(u, v);
    stations.push([x, seabedHeight(x, z) + lift, z] as const);
  };
  // Down the road from the Daymark to the Wellhead's rim...
  for (const [u, v] of SPINE_ROAD) {
    if (u < 1252 || u > 1512) {
      continue;
    }
    seat(u, v + 2, 2.0);
  }
  // ...a turn around the crater's east rim...
  seat(1524, -32, 3.4);
  seat(1508, -52, 3.6);
  seat(1482, -46, 3.2);
  // ...and home along the Mere's open floor, higher in the water.
  for (const [u, v] of [...SPINE_ROAD].reverse()) {
    if (u < 1252 || u > 1470) {
      continue;
    }
    seat(u + 3, v - 6, 4.4);
  }
  // The phase rotation (blue-2's arithmetic, inherited): the capture
  // shutter lands ≈ 18 s after attach — the head ≈ 6% of the 300 s
  // loop, about 1.7 stations in — so the loop STARTS two stations
  // upstream of the Shallows and the school is wading the ford when
  // the canonical shallows-ford frame fires.
  const rotated = [...stations.slice(8), ...stations.slice(0, 8)];
  stations.length = 0;
  stations.push(...rotated);
  const shoal = buildShoalRunner({
    seed: SEED ^ B3_SEEDS.dawnShoal,
    route: { stations, closed: true },
    count: 58,
    fish: { scale: 0.95, color: 0xdcebf2, emissive: 0x5a7488, profile: "fusilier" },
    phaseSpeed: 1 / 300,
    braid: { lateral: 0.7, vertical: 0.4 },
    glint: { count: 28, size: 0.13 },
  });
  groups.push(shoal.group);
  updaters.push((t) => shoal.update(t));

  // ── The buoy fry: the Longfall, commuted — and the Mere refused ──────────
  const fryStations: (readonly [number, number, number])[] = [];
  const frySeat = (u: number, v: number, lift: number): void => {
    const { x, z } = worldOf(u, v);
    fryStations.push([x, seabedHeight(x, z) + lift, z] as const);
  };
  for (const [u, v] of SPINE_ROAD) {
    if (u < 1246 || u > 1342) {
      continue;
    }
    frySeat(u, v + 3, 2.2);
  }
  for (const [u, v] of [...SPINE_ROAD].reverse()) {
    if (u < 1246 || u > 1342) {
      continue;
    }
    frySeat(u, v - 3, 3.2);
  }
  const fry = buildShoalRunner({
    seed: SEED ^ B3_SEEDS.buoyFry,
    route: { stations: fryStations, closed: true },
    count: 24,
    fish: { scale: 0.62, color: 0xd0dce8, emissive: 0x4c6478, profile: "fry" },
    phaseSpeed: 1 / 220,
    braid: { lateral: 0.5, vertical: 0.3 },
  });
  groups.push(fry.group);
  updaters.push((t) => fry.update(t));

  // ── The perchers ─────────────────────────────────────────────────────────
  const starAnchors: PercherAnchor[] = [];
  {
    const random = new Random(SEED ^ B3_SEEDS.chainStars);
    for (const link of CHAIN_LINKS) {
      const angle = random.range(0, Math.PI * 2);
      const { x, z } = worldOf(
        link.u + Math.cos(angle) * 3.4,
        link.v + Math.sin(angle) * 3.4,
      );
      starAnchors.push({ pos: [x, seabedHeight(x, z) + 0.05, z] });
    }
  }
  const chainStars = buildPercherColony({
    seed: SEED ^ B3_SEEDS.chainStars,
    palette: { base: 0x9a8ec2, tip: 0xcac2e0, shade: 0x5c5484 },
    anchors: starAnchors,
    perAnchor: 3,
    body: "star",
    motion: "seated",
  });
  groups.push(chainStars.group);

  const armAt = worldOf(ANCHOR.u - 5, ANCHOR.v + 3);
  const eyeAt = worldOf(ANCHOR.u + 6, ANCHOR.v - 4);
  const blennies = buildPercherColony({
    seed: SEED ^ B3_SEEDS.anchorBlennies,
    palette: { base: 0xaab2b6, tip: 0xd4dcd8, shade: 0x6a7288 },
    anchors: [
      { pos: [armAt.x, seabedHeight(armAt.x, armAt.z) + 0.1, armAt.z] },
      { pos: [eyeAt.x, seabedHeight(eyeAt.x, eyeAt.z) + 0.1, eyeAt.z] },
    ],
    perAnchor: 2,
    body: "blenny",
    motion: "seated",
  });
  groups.push(blennies.group);

  const crabAnchors: PercherAnchor[] = [];
  {
    const random = new Random(SEED ^ B3_SEEDS.cradleCrabs);
    for (const [i, [u, v]] of CRADLE_SPINE.entries()) {
      if (i < 3 || i > 6) {
        continue;
      }
      const { x, z } = worldOf(u + random.signed(3) + 6, v + random.signed(3));
      crabAnchors.push({ pos: [x, seabedHeight(x, z) + 0.06, z] });
    }
  }
  const crabs = buildPercherColony({
    seed: SEED ^ B3_SEEDS.cradleCrabs,
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

  const breathAt = worldOf(WELLHEAD.u + 4, WELLHEAD.v + 10);
  const wellFry = buildPercherColony({
    seed: SEED ^ B3_SEEDS.wellFry,
    palette: { base: 0xbcd4c8, tip: 0xe2f2e6, shade: 0x6e8a80 },
    anchors: [
      { pos: [breathAt.x, seabedHeight(breathAt.x, breathAt.z) + 1.6, breathAt.z] },
    ],
    perAnchor: 6,
    body: "fry",
    motion: "hover",
  });
  groups.push(wellFry.group);
  if (wellFry.update) {
    updaters.push((t) => wellFry.update!(t));
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
