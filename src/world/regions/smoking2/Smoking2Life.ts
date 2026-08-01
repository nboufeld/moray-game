import type { Group } from "three";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildParticulateField } from "../kit/ParticulateField";
import { buildPercherColony, type PercherAnchor } from "../kit/PercherColony";
import { buildShoalRunner } from "../kit/ShoalRunner";
import type { KitBuild } from "../kit/KitTypes";
import { FC_SEEDS, restFree } from "./Smoking2Shared";
import {
  HEARTH,
  PILLOWS,
  saddleCenter,
  washCenter,
  worldOf,
} from "./Smoking2Terrain";

/**
 * The Forge Combs' ambient life — life as a SYSTEM riding the roads:
 *
 * - **the wash shoal** (kit `shoalRunner`, pale-ember tetras): one closed
 *   loop that noses over the saddle crest, runs the Clinker Stair, rides
 *   the Emberwash's whole length to the Glass Shore's edge and comes
 *   home through the comb gaps on the north side — the road swims. The
 *   loop bends around every registered rest (MASTER R10: stillness beats
 *   cadence).
 * - **the gap runners** (a second, smaller loop): fry threading the Long
 *   Gallery's and the Kings' Run's gaps — the cross-traffic that makes
 *   the wall country read inhabited.
 * - **seam shrimp** (kit `particulateField`, swarm): sparkle swarms low
 *   over the First Hearth's rays and the Anvil's court.
 * - **perch fish** (kit `percherColony`, seated): blennies on the combs'
 *   crest break-faces.
 * - **glass-hoppers** (kit `percherColony`, dart): shrimp-bodied darters
 *   low over the obsidian shelf — the far quarter's small motion, held
 *   off the Glass Hush.
 *
 * Fresh `FC_SEEDS.*` streams throughout; every placement multiplies
 * {@link restFree}.
 */

const SEED = SEEDS.regionSmoking2;

export interface Smoking2LifeBuild {
  readonly groups: Group[];
  /** The wash shoal's stations, exported for the clearance test. */
  readonly washStations: readonly (readonly [number, number, number])[];
  update(timeSec: number): void;
}

/**
 * The wash shoal's loop, as data: over the crest, down the stair, the
 * length of the road, home through the comb gaps. Exported so the test
 * and the build read one truth.
 */
export function washShoalStations(): [number, number, number][] {
  const stations: [number, number, number][] = [];
  const at = (u: number, v: number, lift: number): void => {
    const { x, z } = worldOf(u, v);
    stations.push([x, seabedHeight(x, z) + lift, z]);
  };
  // The saddle leg: nose into the Smoulder's handover band, then the way.
  for (const u of [648, 676, 704, 730, 756]) {
    at(u, saddleCenter(u), 2.2);
  }
  // Down the stair and onto the road.
  at(780, washCenter(780), 2.4);
  at(812, washCenter(812), 2.4);
  at(846, washCenter(846), 2.2);
  at(880, washCenter(880), 2.4);
  // Past the Anvil on the road's own south bend.
  at(916, washCenter(916), 2.6);
  at(950, washCenter(950), 2.4);
  at(990, washCenter(990), 2.4);
  at(1030, washCenter(1030), 2.6);
  // The turn at the Glass Shore's edge (the Glass Hush stays far south).
  at(1058, washCenter(1058) + 10, 3.0);
  // Home through the comb gaps, north of the wash (the Anvil's Shadow
  // rest at (946, 12) stays south of this line).
  at(1010, 36, 3.0);
  at(966, 46, 3.0);
  at(920, 8, 2.8);
  at(878, 24, 2.8);
  at(836, 12, 2.6);
  at(800, 4, 2.4);
  at(768, saddleCenter(768), 2.2);
  return stations;
}

export function buildSmoking2Life(
  perchTops: readonly (readonly [number, number, number])[],
): Smoking2LifeBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (build: KitBuild & { update?(timeSec: number): void }): void => {
    groups.push(build.group);
    if (build.update) {
      const update = build.update.bind(build);
      updaters.push(update);
    }
  };

  // ─── The wash shoal ───────────────────────────────────────────────────────
  const stations = washShoalStations();
  keep(
    buildShoalRunner({
      seed: SEED ^ FC_SEEDS.washShoal,
      route: { stations, closed: true },
      count: 52,
      // Pale-ember tetras: the province's one shoal-light, held ABOVE
      // the water's value so the ribbon reads at range.
      fish: { scale: 0.8, color: 0xf2cfa8, emissive: 0x8a4a2c, profile: "tetra" },
      // ~1.4 m/s over a ~1.1 km loop.
      phaseSpeed: 0.0013,
      braid: { lateral: 0.34, vertical: 0.22 },
    }),
  );

  // ─── The gap runners ──────────────────────────────────────────────────────
  const gapStations: [number, number, number][] = [];
  const gapAt = (u: number, v: number, lift: number): void => {
    const { x, z } = worldOf(u, v);
    gapStations.push([x, seabedHeight(x, z) + lift, z]);
  };
  gapAt(826, 16, 2.6);
  gapAt(852, 34, 3.0);
  gapAt(886, 52, 3.2);
  gapAt(920, 60, 3.0);
  gapAt(946, 44, 2.8);
  gapAt(930, 16, 2.6);
  gapAt(896, 2, 2.4);
  gapAt(858, -2, 2.4);
  keep(
    buildShoalRunner({
      seed: SEED ^ FC_SEEDS.gapShoal,
      route: { stations: gapStations, closed: true },
      count: 30,
      fish: { scale: 0.55, color: 0xd9c2a2, emissive: 0x6a3c26, profile: "fry" },
      phaseSpeed: 0.0022,
      braid: { lateral: 0.28, vertical: 0.18 },
    }),
  );

  // ─── The seam shrimp ──────────────────────────────────────────────────────
  const hearthAt = worldOf(HEARTH.u, HEARTH.v + 4);
  keep(
    buildParticulateField({
      seed: SEED ^ FC_SEEDS.hearthShrimp,
      tint: 0xffc27e,
      count: 48,
      mode: "swarm",
      volume: {
        center: [hearthAt.x, seabedHeight(hearthAt.x, hearthAt.z) + 1.1, hearthAt.z],
        size: [34, 2.2, 34],
      },
      size: 0.045,
      opacity: 0.32,
    }),
  );
  const anvilCourt = worldOf(934, -12);
  keep(
    buildParticulateField({
      seed: SEED ^ FC_SEEDS.hearthShrimp ^ 0x22,
      tint: 0xffb877,
      count: 36,
      mode: "swarm",
      volume: {
        center: [anvilCourt.x, seabedHeight(anvilCourt.x, anvilCourt.z) + 1.0, anvilCourt.z],
        size: [24, 2.0, 24],
      },
      size: 0.045,
      opacity: 0.32,
    }),
  );

  // ─── The perch fish ───────────────────────────────────────────────────────
  const perchRandom = new Random(SEED ^ FC_SEEDS.perchers ^ 0x0a);
  const perchAnchors: PercherAnchor[] = [];
  for (const top of perchTops) {
    if (perchAnchors.length >= 14) {
      break;
    }
    if (perchRandom.next() < 0.3) {
      continue;
    }
    if (restFree(top[0], top[2]) < 0.75) {
      continue;
    }
    perchAnchors.push({ pos: [top[0], top[1] + 0.06, top[2]] });
  }
  keep(
    buildPercherColony({
      seed: SEED ^ FC_SEEDS.perchers,
      palette: { base: 0xd9b090, tip: 0xf2d5b4, shade: 0x8a6a58 },
      anchors: perchAnchors,
      perAnchor: 2,
      body: "blenny",
      motion: "seated",
    }),
  );

  // ─── The glass-hoppers ────────────────────────────────────────────────────
  const hopperRandom = new Random(SEED ^ FC_SEEDS.glassHoppers ^ 0x0a);
  const hopperAnchors: PercherAnchor[] = [];
  let guard = 0;
  while (hopperAnchors.length < 10 && guard++ < 300) {
    const u = hopperRandom.range(1020, 1120);
    const v = hopperRandom.signed(80);
    const { x, z } = worldOf(u, v);
    if (restFree(x, z) < 0.75) {
      continue;
    }
    hopperAnchors.push({ pos: [x, seabedHeight(x, z) + 0.05, z] });
  }
  keep(
    buildPercherColony({
      seed: SEED ^ FC_SEEDS.glassHoppers,
      palette: { base: 0xbcaec2, tip: 0xe2d8e6, shade: 0x7c7090 },
      anchors: hopperAnchors,
      perAnchor: 5,
      body: "shrimp",
      motion: "dart",
    }),
  );

  // ─── The pillow grazers ───────────────────────────────────────────────────
  // A third, tiny presence: darters low over the pillow flank (the Ladle
  // keeps its stillness — the gate holds them off the crown).
  const grazerRandom = new Random(SEED ^ FC_SEEDS.perchers ^ 0x2b);
  const grazerAnchors: PercherAnchor[] = [];
  guard = 0;
  while (grazerAnchors.length < 8 && guard++ < 240) {
    const u = PILLOWS.u + grazerRandom.signed(70);
    const v = PILLOWS.v + grazerRandom.signed(70);
    const { x, z } = worldOf(u, v);
    if (restFree(x, z) < 0.75) {
      continue;
    }
    grazerAnchors.push({ pos: [x, seabedHeight(x, z) + 0.05, z] });
  }
  keep(
    buildPercherColony({
      seed: SEED ^ FC_SEEDS.perchers ^ 0x2c,
      palette: { base: 0xc9b6a4, tip: 0xe8d8c2, shade: 0x8e7e88 },
      anchors: grazerAnchors,
      perAnchor: 4,
      body: "shrimp",
      motion: "dart",
    }),
  );

  return {
    groups,
    washStations: stations,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}
