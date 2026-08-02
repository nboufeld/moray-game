import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildGlowColony } from "../kit/GlowColony";
import { buildParticulateField } from "../kit/ParticulateField";
import { buildPercherColony, type PercherAnchor } from "../kit/PercherColony";
import { buildShoalRunner } from "../kit/ShoalRunner";
import type { KitBuild } from "../kit/KitTypes";
import type { MesaCrown } from "./Verdant3Mesas";
import { FALLEN, HOLLOW, MESAS, WELLSPRINGS, WORLDS_END, spokeOf, worldOf } from "./Verdant3Terrain";

/**
 * The Canopy Deep's colonies — the doctrine's T4 systemic life and the
 * T5 light-life, all kit consumption:
 *
 * - **The traveller shoal** (kit `shoalRunner`): the province's own
 *   silver-green line arriving from the Emerald Terraces down the pass
 *   road — life as wayfinding on the last road in the province.
 * - **The meadow liaison** (kit `shoalRunner`): a fry line touring the
 *   mesa court, so the deep walk is always crossed by life.
 * - **The shade swarm** (kit `shoalRunner`): a dark-silver ring weaving
 *   the Twin Court's feet — the deep register's own traffic.
 * - **Canopy-dwellers** (kit `percherColony`, hover): fry clouds high
 *   under the crowns; **crown-court crabs** (dart) on the fallen
 *   pillar; **whelk trios** at the Doorwarden's foot; **cushion stars**
 *   (star) on the wellspring rims and garden skirts.
 * - **Glow colonies** (kit `glowColony`): the Shade Meadows' own light —
 *   moon-green lamps in the deepest floor, the Hollow Mesa's interior
 *   garden (licensed by its rest registration), the wellspring rims.
 * - **The wellspring breath** (kit `particulateField`, column): bubble
 *   columns rising off every spring; **the canopy's leaf-fall** (fall):
 *   old gold drifting down through the shafts.
 *
 * Routes and anchors keep out of every registered rest except where a
 * rest's own registration licenses them (the Hollow's glow, the
 * Clearwater's shaft). Seeds are fresh `^ 0x40xx–0x43xx` substreams.
 */

const SEED = SEEDS.regionVerdant3;

export interface Verdant3ColoniesBuild {
  readonly groups: Group[];
  readonly draws: number;
  readonly triangles: number;
  update(timeSec: number): void;
}

/** The traveller shoal's stations, spoke space — exported for the tests
 *  (the route must ride the pass corridor, off every rest). */
export const TRAVELLER_STATIONS: readonly (readonly [number, number, number])[] = [
  [1136, -2, 2.2],
  [1152, 3, 2.6],
  [1170, -4, 2.4],
  [1188, 2, 2.8],
  [1206, -3, 2.6],
  [1224, 2, 3.0],
  [1242, -2, 3.4],
  [1258, 3, 4.0],
  [1268, -1, 4.6],
  [1262, 6, 5.2],
  [1244, 7, 4.2],
  [1222, 6, 3.4],
  [1198, 7, 3.0],
  [1174, 5, 2.8],
  [1152, 6, 2.4],
] as const;

/** The meadow liaison's tour of the mesa court. */
const LIAISON_STATIONS: readonly (readonly [number, number, number])[] = [
  [1330, 6, 3.4],
  [1352, 28, 3.8],
  [1382, 40, 3.2],
  [1412, 48, 3.6],
  [1444, 40, 4.0],
  [1470, 26, 3.4],
  [1492, 2, 3.8],
  [1478, -28, 3.4],
  [1450, -44, 3.6],
  [1418, -52, 3.2],
  [1390, -40, 3.6],
  [1362, -22, 3.4],
  [1340, -8, 3.2],
] as const;

/** The shade swarm's dark ring through the Twin Court's feet. */
const SWARM_STATIONS: readonly (readonly [number, number, number])[] = [
  [1440, -18, 2.2],
  [1456, -30, 2.8],
  [1472, -22, 2.4],
  [1482, -4, 2.8],
  [1474, 14, 2.2],
  [1458, 18, 2.6],
  [1444, 8, 2.4],
  [1436, -4, 2.6],
] as const;

function routePoints(
  stations: readonly (readonly [number, number, number])[],
): [number, number, number][] {
  return stations.map(([u, v, lift]) => {
    const { x, z } = worldOf(u, v);
    return [x, seabedHeight(x, z) + lift, z] as [number, number, number];
  });
}

export function buildVerdant3Colonies(crowns: readonly MesaCrown[]): Verdant3ColoniesBuild {
  const builds: KitBuild[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  // ─── The shoal network ────────────────────────────────────────────────────
  const traveller = buildShoalRunner({
    seed: SEED ^ 0x4001,
    route: { stations: routePoints(TRAVELLER_STATIONS), closed: true },
    count: 40,
    fish: { scale: 0.8, color: 0xc9ecd8, emissive: 0x35584c, profile: "fusilier" },
    phaseSpeed: 0.011,
    braid: { lateral: 0.5, vertical: 0.3 },
    glint: { count: 10, size: 0.16 },
  });
  builds.push(traveller);
  updaters.push((t) => traveller.update(t));

  const liaison = buildShoalRunner({
    seed: SEED ^ 0x4002,
    route: { stations: routePoints(LIAISON_STATIONS), closed: true },
    count: 26,
    fish: { scale: 0.62, color: 0xc9ecd8, emissive: 0x35584c, profile: "fry" },
    phaseSpeed: 0.013,
    braid: { lateral: 0.4, vertical: 0.24 },
  });
  builds.push(liaison);
  updaters.push((t) => liaison.update(t));

  const swarm = buildShoalRunner({
    seed: SEED ^ 0x4003,
    route: { stations: routePoints(SWARM_STATIONS), closed: true },
    count: 34,
    fish: { scale: 0.5, color: 0x8fb4a2, emissive: 0x2c4a40, profile: "tetra" },
    phaseSpeed: 0.018,
    braid: { lateral: 0.6, vertical: 0.34 },
  });
  builds.push(swarm);
  updaters.push((t) => swarm.update(t));

  // ─── The canopy-dwellers ──────────────────────────────────────────────────
  // Hover fry high under the crowns: warm sparks against the deep roof.
  const dwellerAnchors: PercherAnchor[] = [];
  // Offsets are authored per crown: the Kingpillar's cloud hangs on the
  // crown's far side, clear of the Clearwater's rest below.
  for (const [name, du, dv] of [
    ["doorwarden", 3, -2],
    ["twin-east", 3, -2],
    ["kingpillar", 9, 9],
    ["south-watcher", -3, 2],
  ] as const) {
    const crown = crowns.find((candidate) => candidate.name === name);
    if (crown) {
      const { x, z } = worldOf(
        spokeOf(crown.x, crown.z).u + du,
        spokeOf(crown.x, crown.z).v + dv,
      );
      dwellerAnchors.push({ pos: [x, crown.topY - 6, z] });
    }
  }
  const dwellers = buildPercherColony({
    seed: SEED ^ 0x4101,
    palette: { base: 0xe8c2a0, tip: 0xf6dcb8 },
    anchors: dwellerAnchors,
    perAnchor: 8,
    body: "fry",
    motion: "hover",
  });
  builds.push(dwellers);
  if (dwellers.update) {
    const dwellerUpdate = dwellers.update.bind(dwellers);
    updaters.push((t) => dwellerUpdate(t));
  }

  // Crown-court crabs darting the fallen pillar's back.
  const crabAnchors: PercherAnchor[] = [];
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const u = FALLEN.tailU + (FALLEN.headU - FALLEN.tailU) * t;
    const v = FALLEN.tailV + (FALLEN.headV - FALLEN.tailV) * t;
    const { x, z } = worldOf(u, v + 4);
    crabAnchors.push({ pos: [x, seabedHeight(x, z) + 0.12, z] });
  }
  const crabs = buildPercherColony({
    seed: SEED ^ 0x4102,
    palette: { base: 0x8a6a4a, tip: 0xc2a05c },
    anchors: crabAnchors,
    perAnchor: 4,
    body: "shrimp",
    motion: "dart",
  });
  builds.push(crabs);
  if (crabs.update) {
    const crabUpdate = crabs.update.bind(crabs);
    updaters.push((t) => crabUpdate(t));
  }

  // Cushion stars on the wellspring rims and the garden skirts.
  const starAnchors: PercherAnchor[] = [];
  for (const spring of WELLSPRINGS.slice(0, 2)) {
    for (const [du, dv] of [
      [spring.radius * 1.3, 2],
      [-spring.radius * 1.2, -3],
    ] as const) {
      const { x, z } = worldOf(spring.u + du, spring.v + dv);
      starAnchors.push({ pos: [x, seabedHeight(x, z) + 0.05, z] });
    }
  }
  for (const mesa of [MESAS[0]!, MESAS[2]!, MESAS[5]!]) {
    const { x, z } = worldOf(mesa.u + mesa.footR + 3, mesa.v - 2);
    starAnchors.push({ pos: [x, seabedHeight(x, z) + 0.05, z] });
  }
  const stars = buildPercherColony({
    seed: SEED ^ 0x4103,
    palette: { base: 0x9e5f8a, tip: 0xc98aa8, shade: 0x544672 },
    anchors: starAnchors,
    perAnchor: 3,
    body: "star",
    motion: "seated",
  });
  builds.push(stars);

  // Whelk trios at the Doorwarden's foot stones.
  const door = MESAS[0]!;
  const whelkAnchors: PercherAnchor[] = [];
  for (const [du, dv] of [
    [door.footR + 2, 3],
    [-door.footR - 1, -4],
  ] as const) {
    const { x, z } = worldOf(door.u + du, door.v + dv);
    whelkAnchors.push({ pos: [x, seabedHeight(x, z) + 0.08, z] });
  }
  const whelks = buildPercherColony({
    seed: SEED ^ 0x4104,
    palette: { base: 0xa89a78, tip: 0xd0c4a0 },
    anchors: whelkAnchors,
    perAnchor: 3,
    body: "shrimp",
    motion: "seated",
  });
  builds.push(whelks);

  // ─── The glow colonies ────────────────────────────────────────────────────
  // The Shade Meadows' own lamps: moon-green colonies in the deepest
  // floor, where the canopy holds the shafts furthest apart.
  const meadowAnchors: (readonly [number, number, number])[] = [];
  for (const [u, v] of [
    [1356, -36],
    [1378, 52],
    [1404, -46],
    [1436, 30],
    [1466, -56],
    [1494, 34],
    [1508, -14],
    [1540, 26],
    [1556, -56],
    [1586, 10],
  ] as const) {
    const { x, z } = worldOf(u, v);
    meadowAnchors.push([x, seabedHeight(x, z) + 0.05, z] as const);
  }
  builds.push(
    buildGlowColony({
      seed: SEED ^ 0x4201,
      tint: 0xa8d8a0,
      anchors: meadowAnchors,
      budsPerAnchor: 7,
      glow: 0.32,
    }),
  );

  // The Hollow Mesa's interior garden — the secret's own light
  // (licensed by the rest's registration: glow + the oculus beam only).
  const hollowAnchors: (readonly [number, number, number])[] = [];
  for (const [du, dv] of [
    [2.4, 1.2],
    [-1.8, 2.6],
    [-2.6, -1.8],
    [1.4, -2.8],
    [0.2, 0.4],
  ] as const) {
    const { x, z } = worldOf(HOLLOW.u + du, HOLLOW.v + dv);
    hollowAnchors.push([x, seabedHeight(x, z) + 0.05, z] as const);
  }
  builds.push(
    buildGlowColony({
      seed: SEED ^ 0x4202,
      tint: 0xb8e0a8,
      anchors: hollowAnchors,
      budsPerAnchor: 8,
      glow: 0.34,
    }),
  );

  // Wellspring-rim lamps (the Clearwater keeps its rest: rim anchors
  // only at the two open springs).
  const springAnchors: (readonly [number, number, number])[] = [];
  for (const spring of WELLSPRINGS.slice(0, 2)) {
    for (const a of [0.8, 2.9]) {
      const { x, z } = worldOf(
        spring.u + Math.cos(a) * spring.radius * 1.4,
        spring.v + Math.sin(a) * spring.radius * 1.4,
      );
      springAnchors.push([x, seabedHeight(x, z) + 0.05, z] as const);
    }
  }
  builds.push(
    buildGlowColony({
      seed: SEED ^ 0x4203,
      tint: 0xa8d8b8,
      anchors: springAnchors,
      budsPerAnchor: 6,
      glow: 0.3,
    }),
  );

  // ─── The wellspring breath ────────────────────────────────────────────────
  // Bubble columns off every spring (the Clearwater's column is part of
  // its composed stillness: the water breathes, nothing else moves).
  for (const [index, spring] of WELLSPRINGS.entries()) {
    const { x, z } = worldOf(spring.u, spring.v);
    const floor = seabedHeight(x, z);
    // Round 2: grown and brightened — the r1 columns were invisible at
    // pose range (a 0.16 m spark at 0.5 opacity is sub-pixel past arm's
    // length; the verdant-2 mote lesson, at the springs).
    const column = buildParticulateField({
      seed: SEED ^ (0x4301 + index),
      tint: 0xdcf2e6,
      count: 120,
      mode: "column",
      volume: { center: [x, floor + 8, z], size: [spring.radius * 1.0, 16, spring.radius * 1.0] },
      size: 0.32,
      opacity: 0.6,
    });
    builds.push(column);
    updaters.push((t) => column.update(t));
  }

  // ─── The canopy's leaf-fall ───────────────────────────────────────────────
  // Old gold sifting down through the country's water — the roof sheds.
  {
    const { x, z } = worldOf(1462, 0);
    const fall = buildParticulateField({
      seed: SEED ^ 0x4310,
      tint: 0xc9b45e,
      count: 240,
      mode: "fall",
      volume: { center: [x, -18, z], size: [300, 26, 300] },
      size: 0.2,
      opacity: 0.42,
      bias: { dir: [0.2, -1, 0.12], speed: 0.5 },
    });
    builds.push(fall);
    updaters.push((t) => fall.update(t));
  }

  let draws = 0;
  let triangles = 0;
  const groups: Group[] = [];
  for (const build of builds) {
    draws += build.draws;
    triangles += build.triangles;
    groups.push(build.group);
  }

  return {
    groups,
    draws,
    triangles,
    update(timeSec: number): void {
      for (const updater of updaters) {
        updater(timeSec);
      }
    },
  };
}

// Re-exported so the def can compose without re-deriving.
export { WORLDS_END };
