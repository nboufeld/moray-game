import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBeamAndPool } from "../kit/BeamAndPool";
import { buildGlowColony } from "../kit/GlowColony";
import { buildPercherColony, type PercherAnchor } from "../kit/PercherColony";
import { buildShoalRunner } from "../kit/ShoalRunner";
import type { KitBuild } from "../kit/KitTypes";
import {
  BALCONY,
  FERN_VAULT,
  stairChannelCenter,
  stepFootU,
  worldOf,
} from "./Verdant2Terrain";

/**
 * The Emerald Terraces' colonies — the doctrine's T4 small fauna per
 * surface type and the T5 light-life, all kit consumption:
 *
 * - **The threshold runner** (kit `shoalRunner`): 35 silver-green fish
 *   commuting the pass road u 645–760 — the emptiest 100 m in the
 *   province becomes a road with traffic. Silver-green is the province's
 *   one shoal light (MASTER §1.1); the runner hands the diver to the
 *   spill shoal at the stair.
 * - **The garden liaison** (kit `shoalRunner`): a 24-fry line stair foot
 *   → bridge → grotto, so the terrace walk is always crossed by life.
 * - **Ledge crabs** (kit `percherColony`, dart) on the slab lips;
 *   **moth-fry** (hover) circling the vault's lanterns; **balcony fry**
 *   over the deck; a **step-4 curtain fry colony** in the stair's green.
 * - **Glow colonies** (kit `glowColony`): the basin's sleepers among the
 *   deep quiet, and moss-glow at the Emerald Gate's jamb feet.
 * - **The dapple pools** (kit `beamAndPool`, pools only): the walk-line
 *   pools under the new blades — threshold, treads, garden walk — one
 *   merged draw with the four-part light discipline built in.
 *
 * The basin keeps its shoal-free deep quiet (plan §5); no route or
 * anchor below enters the Cistern bowl, the vault's inner shadow or the
 * basin's south pocket (MASTER §1.2). Seeds are fresh `^ 0xf5xx–0xf8xx`
 * substreams, appended after every pre-fill draw.
 */

const SEED = SEEDS.regionVerdant2;

export interface Verdant2ColoniesBuild {
  readonly groups: Group[];
  readonly draws: number;
  readonly triangles: number;
  update(timeSec: number): void;
}

/** The threshold runner's stations, spoke space — exported for the tests
 *  (the route must ride the pass corridor and clear every seal). */
export const THRESHOLD_RUNNER_STATIONS: readonly (readonly [number, number, number])[] = [
  [648, -2, 2.2],
  [664, 3, 2.8],
  [680, -4, 2.4],
  [698, 2, 3.0],
  [716, -3, 2.6],
  [734, 1, 3.2],
  [750, -2, 3.6],
  [758, 4, 4.2],
  [744, 8, 5.0],
  [722, 6, 4.2],
  [700, 8, 3.6],
  [676, 6, 3.0],
  [658, 7, 2.6],
];

/** The garden liaison's line: stair foot → bridge → grotto and home. */
const LIAISON_STATIONS: readonly (readonly [number, number, number])[] = [
  [850, -6, 3.0],
  [862, -20, 3.4],
  [872, -32, 3.0],
  [882, -38, 2.6],
  [890, -24, 3.4],
  [893, -6, 3.2],
  [892, 14, 2.8],
  [886, 24, 2.4],
  [874, 16, 3.2],
  [862, 4, 3.4],
];

function routePoints(
  stations: readonly (readonly [number, number, number])[],
): [number, number, number][] {
  return stations.map(([u, v, lift]) => {
    const { x, z } = worldOf(u, v);
    return [x, seabedHeight(x, z) + lift, z] as [number, number, number];
  });
}

export function buildVerdant2Colonies(): Verdant2ColoniesBuild {
  const builds: KitBuild[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  // ─── The shoal network ────────────────────────────────────────────────────
  const runner = buildShoalRunner({
    seed: SEED ^ 0xf701,
    route: { stations: routePoints(THRESHOLD_RUNNER_STATIONS), closed: true },
    count: 35,
    fish: { scale: 0.8, color: 0xc9ecd8, emissive: 0x35584c, profile: "fusilier" },
    phaseSpeed: 0.011,
    braid: { lateral: 0.5, vertical: 0.3 },
    glint: { count: 10, size: 0.16 },
  });
  builds.push(runner);
  updaters.push((t) => runner.update(t));

  const liaison = buildShoalRunner({
    seed: SEED ^ 0xf702,
    route: { stations: routePoints(LIAISON_STATIONS), closed: true },
    count: 24,
    fish: { scale: 0.62, color: 0xc9ecd8, emissive: 0x35584c, profile: "fry" },
    phaseSpeed: 0.014,
    braid: { lateral: 0.4, vertical: 0.24 },
  });
  builds.push(liaison);
  updaters.push((t) => liaison.update(t));

  // ─── Ledge crabs on the slab lips (10 anchors × 4, dart) ─────────────────
  const crabAnchors: PercherAnchor[] = [];
  for (let step = 0; step < 8; step++) {
    const u = stepFootU(step) + 0.8;
    const side = step % 2 === 0 ? 1 : -1;
    const v = stairChannelCenter(u) + side * 5.5;
    const { x, z } = worldOf(u, v);
    crabAnchors.push({ pos: [x, seabedHeight(x, z) + 0.12, z] });
  }
  for (const [u, v] of [
    [871, -33],
    [906, -2],
  ] as const) {
    const { x, z } = worldOf(u, v);
    crabAnchors.push({ pos: [x, seabedHeight(x, z) + 0.12, z] });
  }
  const crabs = buildPercherColony({
    seed: SEED ^ 0xf501,
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

  // ─── The vault's moth-fry (3 anchors × 8, circling the lanterns) ─────────
  const mothAnchors: PercherAnchor[] = [];
  for (const [du, dv, lift] of [
    [-8, 4, 5.6],
    [5, -9, 6.2],
    [9, 8, 5.2],
  ] as const) {
    const { x, z } = worldOf(FERN_VAULT.u + du, FERN_VAULT.v + dv);
    mothAnchors.push({ pos: [x, seabedHeight(x, z) + lift, z] });
  }
  const mothFry = buildPercherColony({
    seed: SEED ^ 0xf502,
    palette: { base: 0xe8d8a0, tip: 0xfff0c0 },
    anchors: mothAnchors,
    perAnchor: 8,
    body: "fry",
    motion: "hover",
  });
  builds.push(mothFry);
  if (mothFry.update) {
    const mothUpdate = mothFry.update.bind(mothFry);
    updaters.push((t) => mothUpdate(t));
  }

  // ─── The balcony fry (2 × 6) and the step-4 curtain fry (1 × 8) ──────────
  const balconyAnchors: PercherAnchor[] = [];
  for (const [du, dv] of [
    [4, -4],
    [-3, 7],
  ] as const) {
    const { x, z } = worldOf(BALCONY.u + du, BALCONY.v + dv);
    balconyAnchors.push({ pos: [x, seabedHeight(x, z) + 2.4, z] });
  }
  const balconyFry = buildPercherColony({
    seed: SEED ^ 0xf503,
    palette: { base: 0xe8c2a0, tip: 0xf6dcb8 },
    anchors: balconyAnchors,
    perAnchor: 6,
    body: "fry",
    motion: "hover",
  });
  builds.push(balconyFry);
  if (balconyFry.update) {
    const balconyUpdate = balconyFry.update.bind(balconyFry);
    updaters.push((t) => balconyUpdate(t));
  }

  const step4U = stepFootU(3) - 3.1;
  const step4 = worldOf(step4U, stairChannelCenter(step4U) + 3);
  const stepFry = buildPercherColony({
    seed: SEED ^ 0xf504,
    palette: { base: 0xe8c2a0, tip: 0xf6dcb8 },
    anchors: [{ pos: [step4.x, seabedHeight(step4.x, step4.z) + 2.2, step4.z] }],
    perAnchor: 8,
    body: "fry",
    motion: "hover",
  });
  builds.push(stepFry);
  if (stepFry.update) {
    const stepUpdate = stepFry.update.bind(stepFry);
    updaters.push((t) => stepUpdate(t));
  }

  // ─── The glow colonies ────────────────────────────────────────────────────
  // The basin's deep quiet carries its own light (doctrine rule 4): ten
  // sleeper-side colonies of eight buds, cool moon-green. The south
  // pocket (1060, −30) stays dark — the registry's rest.
  const basinAnchors: (readonly [number, number, number])[] = [];
  for (const [u, v] of [
    [1020, 2],
    [1026, 18],
    [1032, -8],
    [1040, 26],
    [1046, 6],
    [1052, 16],
    [1058, -2],
    [1064, 24],
    [1035, 34],
    [1050, 36],
  ] as const) {
    const { x, z } = worldOf(u, v);
    basinAnchors.push([x, seabedHeight(x, z) + 0.05, z] as const);
  }
  builds.push(
    buildGlowColony({
      seed: SEED ^ 0xf601,
      tint: 0xa8d8a0,
      anchors: basinAnchors,
      budsPerAnchor: 8,
      glow: 0.34,
    }),
  );

  // The pillar-sector colonies (round 3): the mesa-city cluster stands
  // on swimmable ground, and the r2 sweep found its floor naked — a few
  // moon-green lamps among the card feet make the promise a place.
  const sectorAnchors: (readonly [number, number, number])[] = [];
  // All six stand past the balcony's own r ≈ 122 (they are the cluster's
  // ground, not the deck's — the deck keeps its authored dressing).
  for (const [u, v] of [
    [1080, 30],
    [1090, 55],
    [1100, 40],
    [1070, 70],
    [1110, 20],
    [1060, 90],
  ] as const) {
    const { x, z } = worldOf(u, v);
    sectorAnchors.push([x, seabedHeight(x, z) + 0.05, z] as const);
  }
  builds.push(
    buildGlowColony({
      seed: SEED ^ 0xf603,
      tint: 0xa8d8a0,
      anchors: sectorAnchors,
      budsPerAnchor: 7,
      glow: 0.32,
    }),
  );

  // Jamb glow moss at the Emerald Gate's feet — the doorway keeps a lamp.
  const jambAnchors: (readonly [number, number, number])[] = [];
  for (const [i, side] of [-1, 1].entries()) {
    const u = 747 + i * 2;
    const v = stairChannelCenter(u) + side * 7.6;
    const { x, z } = worldOf(u, v);
    jambAnchors.push([x, seabedHeight(x, z) + 0.05, z] as const);
  }
  builds.push(
    buildGlowColony({
      seed: SEED ^ 0xf602,
      tint: 0xc4b45e,
      anchors: jambAnchors,
      budsPerAnchor: 6,
      glow: 0.3,
    }),
  );

  // ─── The walk-line dapple pools (kit beamAndPool, pools only) ────────────
  // One merged draw; the blades they answer live in Verdant2Light.
  const pool = (u: number, v: number, radius: number, opacity: number) => {
    const { x, z } = worldOf(u, v);
    return { pos: [x, z] as const, radius, opacity };
  };
  builds.push(
    buildBeamAndPool({
      seed: SEED ^ 0xf801,
      tint: 0xd6ecc4,
      ground: seabedHeight,
      beams: [],
      pools: [
        // The sentinel's dapple pool + the threshold beam's landing.
        pool(672, -4, 3.2, 0.16),
        pool(700, -2, 2.8, 0.18),
        // The stair's lit treads (blades at steps 2 and 6).
        pool(762, 1, 2.6, 0.18),
        pool(818, -2, 2.8, 0.18),
        // The garden walk: one pool per ~40 m along the terrace line.
        pool(862, -18, 3.0, 0.16),
        pool(876, -30, 2.8, 0.16),
        pool(908, -2, 3.0, 0.16),
        pool(938, 18, 2.8, 0.16),
      ],
    }),
  );

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
