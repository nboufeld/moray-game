import type { Group } from "three";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBushBank } from "../kit/BushBank";
import { buildCarpetField, type CarpetFieldBuild } from "../kit/CarpetField";
import { buildFarGrassCards } from "../kit/FarGrassCards";
import { buildGroundLitter } from "../kit/GroundLitter";
import { buildMatRings, type MatAnchor } from "../kit/MatRings";
import { buildScreeApron, type ScreeAnchor } from "../kit/ScreeApron";
import { buildWallDrapeBank } from "../kit/WallDrape";
import type { GateFn, KitArea, KitBuild } from "../kit/KitTypes";
import type { LanternsBuild } from "./Smoking3Lanterns";
import { LV_SEEDS, restFree, smoothstep01 } from "./Smoking3Shared";
import {
  CRADLE,
  FENS,
  LANTERNS,
  POOLS,
  VEIL,
  channelCenter,
  channelHalf,
  cradleWeight,
  fensWeight,
  smoking3Weight,
  spokeOf,
  veilWeight,
  wickCenter,
  wickHalf,
  wickWeight,
  worldOf,
} from "./Smoking3Terrain";

/**
 * The Lantern Vigil's ground cover — R12 from the first draft: density,
 * quality and light ARE the build. The fill is what a kept fire FEEDS,
 * never clutter:
 *
 * - **night stubble** (near-profile blade carpet): the standing near
 *   layer over the whole plain, a value below the ground paint so it
 *   silhouettes against the night;
 * - **ember fronds** (frond carpet, sunGlow): warm pale rosettes on the
 *   fens' pool hems and the wick's hem — the fire's own feeding;
 * - **ash sward** (pale tufts) over the Veil's drifts, and **cradle
 *   garden** fronds + blades — the one living green-amber bloom the
 *   fire keeps;
 * - **wick cinder** along the road, **fen ember gravel**, **ash
 *   pebbles**, **glass shards** at the threshold and the lantern courts,
 *   **cradle pebbles**;
 * - **thermophile mat rings** in this region's own dusk-ember tiers:
 *   wick stations, fen pool junctions, cradle springs;
 * - **lantern scree** at every spire's foot and **vent drapes** on the
 *   chimney's flanks (things grow FROM somewhere);
 * - **night bushes** — the smoke-bush at the arc's end: iron-violet
 *   lobes, ember-rimmed; the Cradle's warm olive family;
 * - **far grass cards** with `nearFade`, the sweep's far layer.
 *
 * Every call takes a fresh `SEEDS.regionSmoking3 ^ LV_SEEDS.*` stream
 * and multiplies {@link restFree} into its gate so the Cold Lantern,
 * the Fen Hush and the Morning Shadow stay composed bareness.
 */

const SEED = SEEDS.regionSmoking3;

export interface Smoking3FloraBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

function discAreaAt(u: number, v: number, radius: number): KitArea {
  const { x, z } = worldOf(u, v);
  return { center: [x, z], radius };
}

/** The Last Wick as a kit road area, stations every ~14 m of spoke. */
function wickArea(fromU: number, toU: number, width: number): KitArea {
  const polyline: [number, number][] = [];
  for (let u = fromU; u <= toU; u += 14) {
    const { x, z } = worldOf(u, wickCenter(u));
    polyline.push([x, z]);
  }
  return { polyline, width };
}

/** The pass channel as a kit area. */
function passArea(): KitArea {
  const polyline: [number, number][] = [];
  for (let u = 1150; u <= 1315; u += 12) {
    const { x, z } = worldOf(u, channelCenter(u));
    polyline.push([x, z]);
  }
  return { polyline, width: 30 };
}

// ─── The gates ───────────────────────────────────────────────────────────────

/** The base night stubble holds the whole plain between the named zones. */
const nightStubbleGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const ramp = smoothstep01((u - 1214) / 40);
  if (ramp <= 0) {
    return 0;
  }
  const open =
    (1 - wickWeight(u, v) * 0.75) *
    (1 - veilWeight(u, v) * 0.6) *
    (1 - cradleWeight(u, v) * 0.55) *
    (1 - fensWeight(u, v) * 0.3);
  return ramp * open * restFree(x, z) * smoking3Weight(x, z);
};

/** Ember fronds: fen pool hems and the wick hem — the fire's feeding. */
const emberFrondGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  let gate = 0;
  for (const pool of POOLS) {
    if (pool.cradle) {
      continue;
    }
    const d = Math.hypot(u - pool.u, v - pool.v);
    const hem =
      smoothstep01((d - pool.radius * 0.7) / 2) * (1 - smoothstep01((d - pool.radius * 2.2) / 4));
    gate = Math.max(gate, hem * 0.95);
  }
  if (u > 1310 && u < 1625) {
    const wickD = Math.abs(v - wickCenter(u));
    const hem =
      smoothstep01((wickD - wickHalf(u) * 0.8) / 2) *
      (1 - smoothstep01((wickD - wickHalf(u) * 2.2) / 5));
    gate = Math.max(gate, hem * 0.85);
  }
  return gate * restFree(x, z) * smoking3Weight(x, z);
};

/** Ash sward: the Veil's pale standing layer. */
const ashSwardGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return veilWeight(u, v) * 0.9 * restFree(x, z) * smoking3Weight(x, z);
};

/** The Cradle's garden: dense inside the basin, off the springs' bowls. */
const cradleGardenGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  let open = 1;
  for (const pool of POOLS) {
    if (!pool.cradle) {
      continue;
    }
    const d = Math.hypot(u - pool.u, v - pool.v);
    open *= smoothstep01((d - pool.radius * 0.9) / 2.5);
  }
  return cradleWeight(u, v) * open * restFree(x, z) * smoking3Weight(x, z);
};

/** Night blades: the outer flank band + the plain — the F-R3 standing layer. */
const nightBladeGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 1230) {
    return 0;
  }
  const rc = Math.hypot(u - 1460, v);
  const flank = 0.4 + 0.6 * smoothstep01((rc - 105) / 50);
  const open =
    (1 - wickWeight(u, v) * 0.6) * (1 - cradleWeight(u, v) * 0.5) * (1 - veilWeight(u, v) * 0.45);
  return flank * open * restFree(x, z) * smoking3Weight(x, z);
};

/** The threshold's own stubble: the road arrives dressed. */
const thresholdStubbleGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 1158 || u > 1320) {
    return 0;
  }
  const thicken = 0.25 + 0.75 * smoothstep01((u - 1176) / 30);
  const offCenter = Math.abs(v - channelCenter(u));
  const inReach = 1 - smoothstep01((offCenter - channelHalf(u) - 6) / 7);
  const offTread = 0.3 + 0.7 * smoothstep01((offCenter - 2.5) / 2.5);
  return thicken * inReach * offTread * restFree(x, z);
};

/** Wick cinder: the road's own dark floor litter. */
const wickCinderGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return wickWeight(u, v) * restFree(x, z);
};

/** Fen ember gravel: the warm dark's floor. */
const fenGravelGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return fensWeight(u, v) * restFree(x, z);
};

/** Ash pebbles: crust chips settling off the drift crowns. */
const ashPebbleGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return veilWeight(u, v) * restFree(x, z);
};

/** Glass shards: the threshold shelf and the lantern courts. */
const glassShardGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  let gate = (1 - smoothstep01((u - 1250) / 60)) * smoothstep01((u - 1150) / 20) * 0.9;
  for (const lantern of LANTERNS) {
    const d = Math.hypot(u - lantern.u, v - lantern.v);
    const court = 1 - smoothstep01((d - lantern.radius * 1.4) / 7);
    gate = Math.max(gate, court * 0.85);
  }
  return gate * restFree(x, z) * smoking3Weight(x, z);
};

/** Cradle pebbles: the garden's pale floor stones. */
const cradlePebbleGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return cradleWeight(u, v) * restFree(x, z);
};

/** Plain shard litter under the open night. */
const plainLitterGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 1250) {
    return 0;
  }
  const open =
    (1 - wickWeight(u, v)) * (1 - veilWeight(u, v) * 0.6) * (1 - cradleWeight(u, v) * 0.4);
  return open * restFree(x, z) * smoking3Weight(x, z);
};

/** Night bushes: lantern courts, fen hem, the rows' open floor. */
const nightBushGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 1265) {
    return 0;
  }
  const open = (1 - wickWeight(u, v)) * (1 - veilWeight(u, v) * 0.7);
  return open * restFree(x, z) * smoking3Weight(x, z);
};

/** The far-card layer: everywhere the country owns, thinned on the road. */
const farCardGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 1230) {
    return 0;
  }
  return (1 - wickWeight(u, v) * 0.7) * restFree(x, z) * smoking3Weight(x, z);
};

// ─── The build ───────────────────────────────────────────────────────────────

export function buildSmoking3Flora(lanterns: LanternsBuild): Smoking3FloraBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (build: KitBuild | CarpetFieldBuild): void => {
    groups.push(build.group);
    if ("update" in build) {
      updaters.push((timeSec) => build.update(timeSec));
    }
  };

  // ─── The standing near layer (R12 near profiles) ─────────────────────────
  // Night stubble: charcoal-violet blade clumps with milk-pale tips —
  // the family that silhouettes under this light.
  keep(
    buildCarpetField({
      seed: SEED ^ LV_SEEDS.baseCarpet,
      palette: { base: 0x6e6076, tip: 0x94838a, shade: 0x4a415c },
      area: discAreaAt(1450, 0, 230),
      gate: nightStubbleGate,
      ground: seabedHeight,
      count: 8500,
      profile: "blade",
      size: [0.42, 0.8],
      swayAmp: 0.035,
    }),
  );

  // Ember fronds: warm pale rosettes standing off the pool hems and the
  // wick's hem — what the kept fire feeds, with the glow of it.
  keep(
    buildCarpetField({
      seed: SEED ^ LV_SEEDS.emberFronds,
      palette: { base: 0xd0a878, tip: 0xf0d0a0, shade: 0x86644e },
      area: discAreaAt(1470, -40, 210),
      gate: emberFrondGate,
      ground: seabedHeight,
      count: 2400,
      profile: "frond",
      size: [0.34, 0.6],
      swayAmp: 0.04,
      sunGlow: true,
    }),
  );

  // Ash sward: bone-pale crossed tufts over the Veil's drifts.
  keep(
    buildCarpetField({
      seed: SEED ^ LV_SEEDS.ashSward,
      palette: { base: 0xbfb298, tip: 0xe0d4b8, shade: 0x847a74 },
      area: discAreaAt(VEIL.u, VEIL.v, 92),
      gate: ashSwardGate,
      ground: seabedHeight,
      count: 3200,
      profile: "tuft",
      size: [0.4, 0.75],
      swayAmp: 0.03,
    }),
  );

  // The Cradle's garden: the bloom the fire keeps — warm olive-gold
  // fronds with the sun-through-leaf glow over deep warm blades.
  keep(
    buildCarpetField({
      seed: SEED ^ LV_SEEDS.cradleGarden,
      palette: { base: 0xa89858, tip: 0xd8c884, shade: 0x6a5c46 },
      area: discAreaAt(CRADLE.u, CRADLE.v, 60),
      gate: cradleGardenGate,
      ground: seabedHeight,
      count: 1800,
      profile: "frond",
      size: [0.4, 0.7],
      swayAmp: 0.045,
      sunGlow: true,
    }),
  );
  keep(
    buildCarpetField({
      seed: SEED ^ LV_SEEDS.cradleGarden ^ 0x2f,
      palette: { base: 0x7c7c4e, tip: 0xa8a86a, shade: 0x545040 },
      area: discAreaAt(CRADLE.u, CRADLE.v, 60),
      gate: cradleGardenGate,
      ground: seabedHeight,
      count: 1400,
      profile: "blade",
      size: [0.45, 0.85],
      swayAmp: 0.04,
    }),
  );

  // Night blades: the flats' knee-high layer and the rim flank band
  // (F-R3: a rim-facing pose finds a silhouette).
  keep(
    buildCarpetField({
      seed: SEED ^ LV_SEEDS.nightBlades,
      palette: { base: 0x5b4f63, tip: 0xa99a94, shade: 0x413a52 },
      area: discAreaAt(1460, 0, 218),
      gate: nightBladeGate,
      ground: seabedHeight,
      count: 2600,
      profile: "blade",
      size: [0.4, 0.75],
      swayAmp: 0.035,
    }),
  );

  // The threshold's own stubble: sparse at the Night Door handover,
  // thickening down the stair.
  keep(
    buildCarpetField({
      seed: SEED ^ LV_SEEDS.wickCinder ^ 0x77,
      palette: { base: 0x6c5f6e, tip: 0x8a767c, shade: 0x4a4258 },
      area: passArea(),
      gate: thresholdStubbleGate,
      ground: seabedHeight,
      count: 1200,
      profile: "blade",
      size: [0.34, 0.66],
      swayAmp: 0.03,
    }),
  );

  // ─── Litter (T1) ──────────────────────────────────────────────────────────
  keep(
    buildGroundLitter({
      seed: SEED ^ LV_SEEDS.wickCinder,
      palette: { base: 0x685866, accent: 0xa2603c, shade: 0x4e4460 },
      area: wickArea(1312, 1620, 16),
      gate: wickCinderGate,
      ground: seabedHeight,
      count: 1500,
      shapeSet: "gravel",
      size: [0.1, 0.28],
      twoTone: true,
    }),
  );
  keep(
    buildGroundLitter({
      seed: SEED ^ LV_SEEDS.fenGravel,
      palette: { base: 0x72564c, accent: 0xa85e3a, shade: 0x554860 },
      area: discAreaAt(FENS.u, FENS.v, 82),
      gate: fenGravelGate,
      ground: seabedHeight,
      count: 1400,
      shapeSet: "gravel",
      size: [0.08, 0.26],
      twoTone: true,
    }),
  );
  keep(
    buildGroundLitter({
      seed: SEED ^ LV_SEEDS.ashPebbles,
      palette: { base: 0xa89a88, accent: 0xd4c8aa, shade: 0x7c7280 },
      area: discAreaAt(VEIL.u, VEIL.v, 92),
      gate: ashPebbleGate,
      ground: seabedHeight,
      count: 1300,
      shapeSet: "pebble",
      size: [0.1, 0.3],
      twoTone: true,
    }),
  );
  keep(
    buildGroundLitter({
      seed: SEED ^ LV_SEEDS.glassLitter,
      palette: { base: 0x362e48, accent: 0xc2b8d2, shade: 0x2a2440 },
      area: discAreaAt(1380, 10, 200),
      gate: glassShardGate,
      ground: seabedHeight,
      count: 1800,
      shapeSet: "shard",
      size: [0.09, 0.26],
      twoTone: true,
    }),
  );
  keep(
    buildGroundLitter({
      seed: SEED ^ LV_SEEDS.cradlePebbles,
      palette: { base: 0x94825e, accent: 0xc2b088, shade: 0x6a5c58 },
      area: discAreaAt(CRADLE.u, CRADLE.v, 60),
      gate: cradlePebbleGate,
      ground: seabedHeight,
      count: 900,
      shapeSet: "pebble",
      size: [0.09, 0.26],
      twoTone: true,
    }),
  );
  keep(
    buildGroundLitter({
      seed: SEED ^ LV_SEEDS.glassLitter ^ 0x33,
      palette: { base: 0x7c7080, shade: 0x5a5068 },
      area: discAreaAt(1440, -10, 190),
      gate: plainLitterGate,
      ground: seabedHeight,
      count: 1200,
      shapeSet: "shard",
      size: [0.1, 0.28],
    }),
  );

  // ─── The thermophile mat rings (province signature, the night tiers) ─────
  // Wick mats: one at every second ember station, the road's warm felt.
  keep(
    buildMatRings({
      seed: SEED ^ LV_SEEDS.matsWick,
      bands: [
        { color: 0xc0b090, width: 1.0 },
        { color: 0xac783e, width: 1.0 },
        { color: 0x80452e, width: 0.9 },
        { color: 0x564050, width: 0.7 },
      ],
      ground: seabedHeight,
      anchors: [1332, 1360, 1388, 1416, 1444, 1472, 1500, 1528, 1556, 1584].map((u, i) => ({
        pos: matSpot(u, wickCenter(u) + (i % 2 === 0 ? 2.4 : -2.6)),
        radius: 1.2 + (i % 3) * 0.5,
      })),
      tiers: 2,
    }),
  );

  // Fen mats: junction felt around the amber pools.
  const fenAnchors: MatAnchor[] = [];
  const fenRandom = new Random(SEED ^ LV_SEEDS.matsFens ^ 0x0a);
  let guard = 0;
  while (fenAnchors.length < 8 && guard++ < 200) {
    const pool = POOLS[Math.floor(fenRandom.next() * 5)]!;
    const theta = fenRandom.range(0, Math.PI * 2);
    const d = pool.radius * 1.3 + fenRandom.next() * 6;
    const u = pool.u + Math.cos(theta) * d;
    const v = pool.v + Math.sin(theta) * d;
    if (fensWeight(u, v) < 0.45) {
      continue;
    }
    const { x, z } = worldOf(u, v);
    if (restFree(x, z) < 0.7) {
      continue;
    }
    if (fenAnchors.some((a) => Math.hypot(a.pos[0] - x, a.pos[1] - z) < 5)) {
      continue;
    }
    fenAnchors.push({ pos: [x, z], radius: fenRandom.range(1.4, 2.6) });
  }
  keep(
    buildMatRings({
      seed: SEED ^ LV_SEEDS.matsFens,
      bands: [
        { color: 0xc8b898, width: 1.1 },
        { color: 0xb6814a, width: 1.0 },
        { color: 0x925434, width: 0.9 },
        { color: 0x664e52, width: 0.7 },
      ],
      ground: seabedHeight,
      anchors: fenAnchors,
      tiers: 2,
    }),
  );

  // Cradle mats: the springs' paler, warmer felt.
  keep(
    buildMatRings({
      seed: SEED ^ LV_SEEDS.matsCradle,
      bands: [
        { color: 0xd4c8a4, width: 1.1 },
        { color: 0xbe9660, width: 1.0 },
        { color: 0x8a6244, width: 0.8 },
      ],
      ground: seabedHeight,
      anchors: [
        { pos: matSpot(1548, 26), radius: 1.6 },
        { pos: matSpot(1558, 40), radius: 1.2 },
        { pos: matSpot(1566, 58), radius: 1.8 },
        { pos: matSpot(1576, 46), radius: 1.1 },
      ],
    }),
  );

  // ─── Lantern scree and Vent drapes (things grow FROM somewhere) ──────────
  const screeAnchors: ScreeAnchor[] = lanterns.feet.map((foot, i) => ({
    pos: [foot.pos[0], foot.pos[1]],
    facing: foot.facing,
    spread: 2.0 + (i % 3) * 0.6,
  }));
  keep(
    buildScreeApron({
      seed: SEED ^ LV_SEEDS.screeFeet,
      palette: { base: 0x746878, shade: 0x524860 },
      ground: seabedHeight,
      anchors: screeAnchors,
      slabsPerAnchor: 6,
    }),
  );
  keep(
    buildWallDrapeBank({
      seed: SEED ^ LV_SEEDS.drapesVent,
      palette: { base: 0x86705e, tip: 0xb59672, shade: 0x544862 },
      anchors: lanterns.ventAnchors,
      strandsPerAnchor: 7,
      length: 2.6,
      swayAmp: 0.05,
    }),
  );

  // ─── The night bushes ─────────────────────────────────────────────────────
  keep(
    buildBushBank({
      seed: SEED ^ LV_SEEDS.nightBushes,
      palette: { base: 0x5e4e5c, tip: 0x8e5642, shade: 0x443a52 },
      area: discAreaAt(1420, -20, 140),
      gate: nightBushGate,
      ground: seabedHeight,
      count: 24,
    }),
  );
  keep(
    buildBushBank({
      seed: SEED ^ LV_SEEDS.nightBushes ^ 0x99,
      palette: { base: 0x6a6448, tip: 0x9c9058, shade: 0x4a4640 },
      area: discAreaAt(CRADLE.u, CRADLE.v, 58),
      gate: cradleGardenGate,
      ground: seabedHeight,
      count: 14,
    }),
  );

  // ─── The far layer ────────────────────────────────────────────────────────
  keep(
    buildFarGrassCards({
      seed: SEED ^ LV_SEEDS.farCards,
      palette: { base: 0x877a86, tip: 0xaf9e96, shade: 0x605872 },
      area: discAreaAt(1460, 0, 218),
      gate: farCardGate,
      ground: seabedHeight,
      count: 6000,
      size: [0.26, 0.6],
      nearFade: 14,
    }),
  );

  return {
    groups,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}

/** World XZ from spoke coordinates, as the kit's `[x, z]` tuple. */
function matSpot(u: number, v: number): [number, number] {
  const { x, z } = worldOf(u, v);
  return [x, z];
}
