import type { Group } from "three";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildParticulateField } from "../kit/ParticulateField";
import { buildPercherColony, type PercherAnchor } from "../kit/PercherColony";
import { buildShoalRunner } from "../kit/ShoalRunner";
import type { KitBuild } from "../kit/KitTypes";
import { FILL_SEEDS, restFree } from "./SmokingFillShared";
import {
  CHIMNEYS,
  SPRINGS,
  gorgeChannelCenter,
  worldOf,
} from "./SmokingTerrain";

/**
 * The fill's T4 ambient life (fill plan §5) — life as a SYSTEM riding the
 * roads, not decor:
 *
 * - **the spine shoal** (kit `shoalRunner`, 56 pale-ember tetras): one
 *   closed loop that noses into the Vent Springs' last metres, runs the
 *   gorge channel to the lip, skirts the flats' NORTH side, pools past
 *   the fork cairn, drifts the Ember Shore and comes home along the
 *   flats' south — the spine road swims. The loop bends around every
 *   registered rest (the Ash Meadows bar, the erratic's shadow, the
 *   mid-shore pocket): MASTER R10, stillness beats cadence — the plan's
 *   "pool over the fork cairn" is moved just east of the rest bar, with
 *   the cairn itself (deviation logged in the ledger).
 * - **vent shrimp** (kit `particulateField`, swarm): sparkle swarms over
 *   the spring terraces' rims and the forest's vent mouths.
 * - **perch fish** (kit `percherColony`, seated): blennies seated on the
 *   colonnade's and organ pipes' break faces.
 * - **silt-hoppers** (kit `percherColony`, dart): shrimp-bodied darters
 *   low over the flats — the quiet's small motion, held off the rest bar.
 *
 * Fresh `FILL_SEEDS.*` streams throughout (the fence); every placement
 * multiplies {@link restFree}.
 */

const SEED = SEEDS.regionSmoking1;

export interface SmokingFillLifeBuild {
  readonly groups: Group[];
  /** The spine shoal's stations, exported for the clearance test. */
  readonly spineStations: readonly (readonly [number, number, number])[];
  update(timeSec: number): void;
}

/**
 * The spine shoal's loop, as data: down the gorge on the channel's own
 * line, around the flats' north shoulder, out to the shore, home along
 * the south. Exported so the test and the build read one truth.
 */
export function spineShoalStations(): [number, number, number][] {
  const stations: [number, number, number][] = [];
  const at = (u: number, v: number, lift: number): void => {
    const { x, z } = worldOf(u, v);
    stations.push([x, seabedHeight(x, z) + lift, z]);
  };
  // The gorge leg: nose into the wing's doorway band, then the channel.
  for (const u of [52, 80, 110, 140, 170, 200, 230, 256]) {
    at(u, gorgeChannelCenter(u), 2.2);
  }
  // Over the lip, along the flats' north shoulder (the erratic's shadow
  // and the rest bar both stay to starboard).
  at(272, 4, 2.5);
  at(300, 18, 2.6);
  at(330, 30, 2.6);
  // The fork pool, just east of the rest bar, over the cairn's road.
  at(365, 26, 2.4);
  // Out toward the shore, south of the caldera's rim.
  at(420, 12, 2.8);
  at(480, 6, 3.0);
  at(540, 0, 2.8);
  // The shore drift (the mid-shore rest pocket stays north).
  at(584, -6, 2.6);
  at(618, 0, 2.8);
  // Home along the flats' south side.
  at(560, -20, 3.0);
  at(500, -26, 3.0);
  at(440, -30, 2.8);
  at(380, -30, 2.6);
  at(330, -28, 2.6);
  at(300, -12, 2.4);
  at(276, -2, 2.4);
  return stations;
}

export function buildSmokingFillLife(
  perchTops: readonly (readonly [number, number, number])[],
): SmokingFillLifeBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (build: KitBuild & { update?(timeSec: number): void }): void => {
    groups.push(build.group);
    if (build.update) {
      const update = build.update.bind(build);
      updaters.push(update);
    }
  };

  // ─── The spine shoal ──────────────────────────────────────────────────────
  const stations = spineShoalStations();
  keep(
    buildShoalRunner({
      seed: SEED ^ FILL_SEEDS.spineShoal,
      route: { stations, closed: true },
      count: 56,
      // Pale-ember tetras: the riders' family, held ABOVE the water's
      // value (the round-8 lesson — a dim fish on a saturated warm field
      // reads as its complement). The province's one shoal-light.
      fish: { scale: 0.8, color: 0xf2cfa8, emissive: 0x8a4a2c, profile: "tetra" },
      // ~1.5 m/s over a ~1.2 km loop.
      phaseSpeed: 0.0012,
      braid: { lateral: 0.34, vertical: 0.22 },
      glint: { count: 26, size: 0.12 },
    }),
  );

  // ─── The vent shrimp ─────────────────────────────────────────────────────
  // Sparkle swarms anchored where the water leaves the ground hot: the
  // spring terraces' rims (off the crown pool's five-metre rest) and the
  // forest's vent mouths.
  const springsAt = worldOf(SPRINGS.u + 10, SPRINGS.v + 6);
  keep(
    buildParticulateField({
      seed: SEED ^ FILL_SEEDS.ventShrimpSprings,
      tint: 0xffc27e,
      count: 90,
      mode: "swarm",
      volume: {
        center: [springsAt.x, seabedHeight(springsAt.x, springsAt.z) + 1.6, springsAt.z],
        size: [30, 3.5, 30],
      },
      size: 0.06,
      opacity: 0.5,
    }),
  );
  const forestAt = worldOf(CHIMNEYS.u, CHIMNEYS.v + 2);
  keep(
    buildParticulateField({
      seed: SEED ^ FILL_SEEDS.ventShrimpForest,
      tint: 0xffb877,
      count: 110,
      mode: "swarm",
      volume: {
        center: [forestAt.x, seabedHeight(forestAt.x, forestAt.z) + 1.8, forestAt.z],
        size: [44, 4, 44],
      },
      size: 0.06,
      opacity: 0.5,
    }),
  );

  // ─── The perch fish ──────────────────────────────────────────────────────
  // Blennies seated on the columns' break faces — rock life for the
  // columnar country (the zone table's one T4 ask the basalt never had).
  const perchRandom = new Random(SEED ^ FILL_SEEDS.perchFish ^ 0x0a);
  const perchAnchors: PercherAnchor[] = [];
  for (const top of perchTops) {
    if (perchAnchors.length >= 15) {
      break;
    }
    if (perchRandom.next() < 0.25) {
      continue;
    }
    perchAnchors.push({ pos: [top[0], top[1] + 0.06, top[2]] });
  }
  keep(
    buildPercherColony({
      seed: SEED ^ FILL_SEEDS.perchFish,
      palette: { base: 0xd9b090, tip: 0xf2d5b4, shade: 0x8a6a58 },
      anchors: perchAnchors,
      perAnchor: 2,
      body: "blenny",
      motion: "seated",
    }),
  );

  // ─── The silt-hoppers ────────────────────────────────────────────────────
  // Darting shrimp low over the flats: twelve stations × five, every
  // station drawn OUTSIDE the rest bar and the erratic's shadow.
  const hopperRandom = new Random(SEED ^ FILL_SEEDS.siltHoppers ^ 0x0a);
  const hopperAnchors: PercherAnchor[] = [];
  let guard = 0;
  while (hopperAnchors.length < 12 && guard++ < 300) {
    const u = hopperRandom.range(288, 470);
    const v = hopperRandom.signed(70);
    const { x, z } = worldOf(u, v);
    if (restFree(x, z) < 0.75) {
      continue;
    }
    hopperAnchors.push({ pos: [x, seabedHeight(x, z) + 0.05, z] });
  }
  keep(
    buildPercherColony({
      seed: SEED ^ FILL_SEEDS.siltHoppers,
      palette: { base: 0xc9b6a4, tip: 0xe8d8c2, shade: 0x8e7e88 },
      anchors: hopperAnchors,
      perAnchor: 5,
      body: "shrimp",
      motion: "dart",
    }),
  );

  return {
    groups,
    spineStations: stations,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}
