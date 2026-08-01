import type { Group } from "three";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildParticulateField } from "../kit/ParticulateField";
import { buildPercherColony, type PercherAnchor } from "../kit/PercherColony";
import { buildShoalRunner } from "../kit/ShoalRunner";
import type { KitBuild } from "../kit/KitTypes";
import { LV_SEEDS, restFree } from "./Smoking3Shared";
import {
  CRADLE,
  LANTERNS,
  VEIL,
  channelCenter,
  wickCenter,
  worldOf,
} from "./Smoking3Terrain";

/**
 * The Lantern Vigil's ambient life — life as a SYSTEM riding the road:
 *
 * - **the wick shoal** (kit `shoalRunner`, ember-dark tetras — the
 *   province's one shoal-light): one closed loop that noses under the
 *   Night Door, runs the Nightfall Stair, rides the Last Wick the whole
 *   way to the Morning Vent and comes home through the lantern courts —
 *   the road swims, and every leg keeps off the registered rests
 *   (MASTER R10: stillness beats cadence).
 * - **the cradle ring** (a second, smaller loop): fry circling the
 *   garden the fire keeps — the bloom has its own orbit.
 * - **moth-fry** (kit `percherColony`, hover): fry clouds circling the
 *   lit lanterns' glass bellies — the kit's own canonical use, and the
 *   image the region is named for.
 * - **lamp perchers** (seated blennies) on the lit lantern crowns.
 * - **fen shrimp** (kit `particulateField`, swarm): sparkle swarms low
 *   over the amber pools.
 * - **ash darters** (dart shrimp) on the Veil's flanks, held off the
 *   Cold Lantern's circle.
 * - **the ash fall**: warm ash sifting down over the Veil like snow —
 *   the region's weather (it crosses the Cold Lantern's rest the way
 *   weather does; the registry licence states it).
 * - **night motes**: a region-wide warm dust, the water's breath.
 *
 * Fresh `LV_SEEDS.*` streams throughout; every placement multiplies
 * {@link restFree}.
 */

const SEED = SEEDS.regionSmoking3;

export interface Smoking3LifeBuild {
  readonly groups: Group[];
  /** The wick shoal's stations, exported for the clearance test. */
  readonly wickStations: readonly (readonly [number, number, number])[];
  update(timeSec: number): void;
}

/**
 * The wick shoal's loop, as data: under the door, down the stair, the
 * length of the road to the Vent, home through the lantern courts.
 * Exported so the test and the build read one truth.
 */
export function wickShoalStations(): [number, number, number][] {
  const stations: [number, number, number][] = [];
  const at = (u: number, v: number, lift: number): void => {
    const { x, z } = worldOf(u, v);
    stations.push([x, seabedHeight(x, z) + lift, z]);
  };
  // The threshold leg: nose into the Night Door's handover band.
  for (const u of [1146, 1178, 1210, 1240]) {
    at(u, channelCenter(u), 2.2);
  }
  // Down the stair and onto the road.
  at(1266, channelCenter(1266), 2.4);
  at(1292, channelCenter(1292), 2.4);
  // The Last Wick, station by station to the door of morning.
  at(1318, wickCenter(1318), 2.4);
  at(1350, wickCenter(1350), 2.2);
  at(1385, wickCenter(1385), 2.4);
  at(1420, wickCenter(1420), 2.6);
  at(1455, wickCenter(1455), 2.4);
  at(1490, wickCenter(1490), 2.4);
  at(1525, wickCenter(1525), 2.6);
  at(1560, wickCenter(1560), 2.4);
  at(1592, wickCenter(1592), 2.6);
  // The turn at the Vent's forecourt (the Morning Shadow stays east).
  at(1606, 6, 3.0);
  // Home through the lantern courts, north of the road.
  at(1552, 16, 3.0);
  at(1512, 8, 3.0);
  at(1470, 16, 2.8);
  at(1430, 34, 3.0);
  at(1390, 20, 2.8);
  at(1350, 8, 2.6);
  at(1322, 2, 2.4);
  return stations;
}

export function buildSmoking3Life(
  perchTops: readonly (readonly [number, number, number])[],
): Smoking3LifeBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (build: KitBuild & { update?(timeSec: number): void }): void => {
    groups.push(build.group);
    if (build.update) {
      const update = build.update.bind(build);
      updaters.push(update);
    }
  };

  // ─── The wick shoal ───────────────────────────────────────────────────────
  const stations = wickShoalStations();
  keep(
    buildShoalRunner({
      seed: SEED ^ LV_SEEDS.wickShoal,
      route: { stations, closed: true },
      count: 48,
      // Ember-dark tetras: the province's one shoal-light — dark bodies
      // rimmed warm, so the ribbon reads as travelling sparks.
      fish: { scale: 0.8, color: 0xe8c49e, emissive: 0x8a4a2c, profile: "tetra" },
      // ~1.3 m/s over a ~1.1 km loop.
      phaseSpeed: 0.0012,
      braid: { lateral: 0.34, vertical: 0.22 },
    }),
  );

  // ─── The cradle ring ──────────────────────────────────────────────────────
  const ringStations: [number, number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const theta = (i / 8) * Math.PI * 2;
    const u = CRADLE.u + Math.cos(theta) * 17;
    const v = CRADLE.v + Math.sin(theta) * 17;
    const { x, z } = worldOf(u, v);
    ringStations.push([x, seabedHeight(x, z) + 2.4, z]);
  }
  keep(
    buildShoalRunner({
      seed: SEED ^ LV_SEEDS.cradleShoal,
      route: { stations: ringStations, closed: true },
      count: 26,
      fish: { scale: 0.55, color: 0xd9c2a2, emissive: 0x6a3c26, profile: "fry" },
      phaseSpeed: 0.0024,
      braid: { lateral: 0.26, vertical: 0.16 },
    }),
  );

  // ─── The moth-fry: fry clouds circling the lit glass ─────────────────────
  const mothAnchors: PercherAnchor[] = [];
  const mothRandom = new Random(SEED ^ LV_SEEDS.mothFry ^ 0x0a);
  for (const lantern of LANTERNS) {
    if (!lantern.lit || mothAnchors.length >= 6) {
      continue;
    }
    if (mothRandom.next() < 0.35) {
      continue;
    }
    const { x, z } = worldOf(lantern.u, lantern.v);
    if (restFree(x, z) < 0.75) {
      continue;
    }
    const belly = seabedHeight(x, z) - 1.2 + lantern.height * 0.45;
    mothAnchors.push({ pos: [x + lantern.radius * 0.9, belly, z] });
  }
  keep(
    buildPercherColony({
      seed: SEED ^ LV_SEEDS.mothFry,
      palette: { base: 0xe8cba0, tip: 0xf8e4c0, shade: 0x96704e },
      anchors: mothAnchors,
      perAnchor: 5,
      body: "fry",
      motion: "hover",
    }),
  );

  // ─── The lamp perchers ────────────────────────────────────────────────────
  const perchRandom = new Random(SEED ^ LV_SEEDS.perchers ^ 0x0a);
  const perchAnchors: PercherAnchor[] = [];
  for (const top of perchTops) {
    if (perchAnchors.length >= 8) {
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
      seed: SEED ^ LV_SEEDS.perchers,
      palette: { base: 0xd9b090, tip: 0xf2d5b4, shade: 0x8a6a58 },
      anchors: perchAnchors,
      perAnchor: 2,
      body: "blenny",
      motion: "seated",
    }),
  );

  // ─── The fen shrimp ───────────────────────────────────────────────────────
  const fenA = worldOf(1432, -100);
  keep(
    buildParticulateField({
      seed: SEED ^ LV_SEEDS.fenShrimp,
      tint: 0xffc27e,
      count: 44,
      mode: "swarm",
      volume: {
        center: [fenA.x, seabedHeight(fenA.x, fenA.z) + 1.1, fenA.z],
        size: [30, 2.2, 30],
      },
      size: 0.045,
      opacity: 0.32,
    }),
  );
  const fenB = worldOf(1410, -76);
  keep(
    buildParticulateField({
      seed: SEED ^ LV_SEEDS.fenShrimp ^ 0x22,
      tint: 0xffb877,
      count: 34,
      mode: "swarm",
      volume: {
        center: [fenB.x, seabedHeight(fenB.x, fenB.z) + 1.0, fenB.z],
        size: [22, 2.0, 22],
      },
      size: 0.045,
      opacity: 0.32,
    }),
  );

  // ─── The ash darters ──────────────────────────────────────────────────────
  const darterRandom = new Random(SEED ^ LV_SEEDS.ashDarters ^ 0x0a);
  const darterAnchors: PercherAnchor[] = [];
  let guard = 0;
  while (darterAnchors.length < 8 && guard++ < 240) {
    const u = VEIL.u + darterRandom.signed(66);
    const v = VEIL.v + darterRandom.signed(66);
    const { x, z } = worldOf(u, v);
    if (restFree(x, z) < 0.75) {
      continue;
    }
    darterAnchors.push({ pos: [x, seabedHeight(x, z) + 0.05, z] });
  }
  keep(
    buildPercherColony({
      seed: SEED ^ LV_SEEDS.ashDarters,
      palette: { base: 0xc4b6a2, tip: 0xe6dac0, shade: 0x86788a },
      anchors: darterAnchors,
      perAnchor: 4,
      body: "shrimp",
      motion: "dart",
    }),
  );

  // ─── The ash fall and the night motes ─────────────────────────────────────
  const veilAt = worldOf(VEIL.u, VEIL.v);
  keep(
    buildParticulateField({
      seed: SEED ^ LV_SEEDS.ashFall,
      tint: 0xd8c8a8,
      count: 700,
      mode: "fall",
      volume: { center: [veilAt.x, 2, veilAt.z], size: [150, 26, 150] },
      size: 0.06,
      opacity: 0.45,
    }),
  );
  const heart = worldOf(1460, 0);
  keep(
    buildParticulateField({
      seed: SEED ^ LV_SEEDS.motes,
      tint: 0xc9a67e,
      count: 900,
      mode: "drift",
      volume: { center: [heart.x, -4, heart.z], size: [380, 26, 380] },
      size: 0.045,
      opacity: 0.35,
    }),
  );

  return {
    groups,
    wickStations: stations,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}
