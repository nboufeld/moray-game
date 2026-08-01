import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBushBank } from "../kit/BushBank";
import { buildCarpetField, type CarpetFieldBuild } from "../kit/CarpetField";
import { buildDriftDebris } from "../kit/DriftDebris";
import { buildGroundLitter } from "../kit/GroundLitter";
import type { GateFn, KitArea, KitBuild } from "../kit/KitTypes";
import {
  CLOSE_LENSES,
  DRIFT_LINES,
  EVENING_POCKETS,
  SPINE_ROAD,
  bushFree,
  lensFree,
  restFree,
  roadDistance,
} from "./Golden3Beats";
import { CANDLES, candleFree } from "./Golden3Garden";
import { PROCESSION, processionFree } from "./Golden3Rocks";
import { G3_SEEDS, smoothstep01 } from "./Golden3Shared";
import {
  CENTER_X,
  CENTER_Z,
  DOOR,
  GARDEN,
  GARDEN_SPRING,
  PANS,
  WELL,
  basinSwell,
  combRidge,
  combWeight,
  combeChannelCenter,
  combeChannelHalf,
  doorRise,
  gardenWeight,
  golden3Weight,
  passFillOwn,
  passHalfWidth,
  spokeOf,
  wellCarve,
  worldOf,
} from "./Golden3Terrain";

/**
 * The Vesper Strand's T1/T2 cover — built at the R12 quality tier from
 * the first draft (no wedge era): everything green wears the kit's
 * `"blade"`/`"frond"` profiles, litter is graded so foreground stones
 * anchor, every gate multiplies {@link restFree} so the two registered
 * rests stay composed stillness, and every close pose's subject is its
 * OWN authored bed (the lily-bench law, paid up front).
 *
 * Evening fill is rhythm and fine grain: T1 carries vastness (grit,
 * salt plates, pebbles at large counts), T2 is sparse-but-authored
 * (wire blades on the roads' shoulders and the basin's crust hollows,
 * evening-pocket fronds every 20–40 m, the garden's swards and scrub,
 * split-stone runs at every standing stone's foot, violet shards shed
 * into the Night Well).
 *
 * The value lessons are pre-paid: every family carries the province's
 * small-emissive dusk lift, keyed per family, because under this
 * region's quarter-strength evening sun a palette picked for the kit
 * demo's light renders a step too dark.
 */

const SEED = SEEDS.regionGolden3;

export interface Golden3CoverBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

/** The province's region-side dusk lift; the kit stays palette-pure. */
function warmMaterials(build: KitBuild | CarpetFieldBuild, hex: number, intensity: number): void {
  build.group.traverse((node) => {
    const material = (
      node as { material?: { emissive?: { setHex(h: number): void }; emissiveIntensity?: number } }
    ).material;
    if (material?.emissive) {
      material.emissive.setHex(hex);
      material.emissiveIntensity = intensity;
    }
  });
}

// ─── Areas ───────────────────────────────────────────────────────────────────

function discArea(): KitArea {
  return { center: [CENTER_X, CENTER_Z], radius: 225 };
}

function discAreaAt(u: number, v: number, radius: number): KitArea {
  const { x, z } = worldOf(u, v);
  return { center: [x, z], radius };
}

/** The whole journey as one road area: shelf, combe, spine road. */
function journeyArea(width: number): KitArea {
  const polyline: [number, number][] = [];
  for (let u = 1146; u <= 1318; u += 17) {
    const { x, z } = worldOf(u, combeChannelCenter(u));
    polyline.push([x, z]);
  }
  for (const [u, v] of SPINE_ROAD) {
    const { x, z } = worldOf(u, v);
    polyline.push([x, z]);
  }
  return { polyline, width };
}

/** The evening pockets threaded as one road area (ordered by spoke u). */
function pocketsArea(): KitArea {
  const ordered = [...EVENING_POCKETS].sort((a, b) => a.u - b.u);
  const polyline: [number, number][] = ordered.map((pocket) => {
    const { x, z } = worldOf(pocket.u, pocket.v);
    return [x, z] as [number, number];
  });
  return { polyline, width: 15 };
}

function driftLineArea(line: readonly (readonly [number, number])[], width: number): KitArea {
  const polyline: [number, number][] = line.map(([u, v]) => {
    const { x, z } = worldOf(u, v);
    return [x, z] as [number, number];
  });
  return { polyline, width };
}

// ─── Shared gate arithmetic ──────────────────────────────────────────────────

/** How deep inside the nearest evening pocket a spoke point sits. */
function pocketDepth(u: number, v: number): number {
  let best = 0;
  for (const pocket of EVENING_POCKETS) {
    const d = Math.hypot(u - pocket.u, v - pocket.v);
    best = Math.max(best, 1 - smoothstep01((d - pocket.radius * 0.55) / (pocket.radius * 0.55)));
  }
  return best;
}

/** The neighbour handshake: shelf fill thins toward the Carillon Waste. */
function shelfWarm(u: number): number {
  return 0.3 + 0.7 * smoothstep01((u - 1152) / 40);
}

/**
 * Fill ownership: on the pass tongue the region WEIGHT is a 0.14
 * treaty whisper so the Carillon Waste keeps carrying terrain and
 * mood — but the fill belongs to whoever owns the bounds (golden-2's
 * round-3 law, adopted from draft one). Identical support to the
 * weight, so containment is unchanged.
 */
function fillOwn(x: number, z: number): number {
  return Math.max(golden3Weight(x, z), passFillOwn(x, z));
}

/** In-channel weight down the shelf road and the combe. */
function roadness(u: number, v: number): number {
  if (u < 1140 || u > 1328) {
    return 0;
  }
  const away = Math.abs(v - combeChannelCenter(u));
  const half = u < 1252 ? passHalfWidth(u) * 0.8 : combeChannelHalf(u) + 6;
  return 1 - smoothstep01((away - half) / 8);
}

/** The calm zones that own their own floors (broad cover thins there). */
function zoneCalm(u: number, v: number): number {
  let pans = 0;
  for (const pan of PANS) {
    pans = Math.max(pans, 1 - smoothstep01((Math.hypot(u - pan.u, v - pan.v) - pan.radius) / 4));
  }
  const spring =
    1 - smoothstep01((Math.hypot(u - GARDEN_SPRING.u, v - GARDEN_SPRING.v) - GARDEN_SPRING.radius) / 3);
  const well = 1 - smoothstep01((Math.hypot(u - WELL.u, v - WELL.v) - WELL.radius) / 5);
  return Math.max(pans * 0.95, spring * 0.9, well * 0.85);
}

/** Ring around each procession stone's foot — growth shelters in lee. */
function stoneRing(u: number, v: number): number {
  let ring = 0;
  for (const stone of PROCESSION) {
    const d = Math.hypot(u - stone.u, v - stone.v);
    ring = Math.max(
      ring,
      smoothstep01((d - stone.foot * 1.3) / 1.2) * (1 - smoothstep01((d - 7) / 4)),
    );
  }
  return ring;
}

/** The combe's HIGH shoulders join the country from the gate onward
 *  (golden-2's round-4 law, pre-paid): off-road only — the descent
 *  stays a road. */
function combeShoulder(u: number, v: number): number {
  if (u < 1240 || u > 1336) {
    return 0;
  }
  const away = Math.abs(v - combeChannelCenter(u));
  const offRoad = smoothstep01((away - combeChannelHalf(u) - 4) / 6);
  return smoothstep01((u - 1248) / 14) * (1 - smoothstep01((u - 1322) / 10)) * offRoad;
}

// ─── The gates ───────────────────────────────────────────────────────────────

/** Ripple-grit: the whole evening floor's close-range grain (T1 base). */
const gritGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const hollow = 1 - smoothstep01(basinSwell(x, z) / 1.3) * 0.5;
  const base =
    u < 1328
      ? Math.max(roadness(u, v) * shelfWarm(u), combeShoulder(u, v) * 0.85)
      : 1 - zoneCalm(u, v) * 0.75;
  return fillOwn(x, z) * restFree(x, z) * base * hollow;
};

/** Salt plates: pale crust shards spreading from the pans (T1). */
const saltGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 1320) {
    return 0;
  }
  let nearPan = 0;
  for (const pan of PANS) {
    const d = Math.hypot(u - pan.u, v - pan.v);
    nearPan = Math.max(
      nearPan,
      smoothstep01((d - pan.radius - 1) / 2) * (1 - smoothstep01((d - pan.radius - 22) / 14)),
    );
  }
  const hollow = smoothstep01(-basinSwell(x, z) / 1.1) * 0.5;
  return (
    fillOwn(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    (1 - zoneCalm(u, v)) *
    Math.min(1, nearPan + hollow)
  );
};

/** Pebble runs pacing the whole journey road. */
const roadPebbleGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const near = u < 1328 ? roadness(u, v) : 1 - smoothstep01((roadDistance(u, v) - 7) / 5);
  return near * shelfWarm(Math.min(u, 1200)) * restFree(x, z) * fillOwn(x, z);
};

/** Road-shoulder wire blades: the journey's standing near layer. */
const roadWireGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  let shoulder: number;
  if (u < 1328) {
    const away = Math.abs(v - combeChannelCenter(u));
    const half = u < 1252 ? 10 : combeChannelHalf(u);
    shoulder = smoothstep01((away - half * 0.35) / 3) * (1 - smoothstep01((away - half - 16) / 9));
  } else {
    const d = roadDistance(u, v);
    shoulder = smoothstep01((d - 2.5) / 2.5) * (1 - smoothstep01((d - 11) / 6));
  }
  return (
    fillOwn(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    processionFree(x, z) *
    shelfWarm(u) *
    (0.3 + 0.7 * shoulder) *
    (1 - zoneCalm(u, v))
  );
};

/**
 * Basin wire: the open country's standing layer — crust hollows, stone
 * lees, and the rim-facing flank band (MASTER F-R3: the three-layer
 * answer must live in the first ~35 m even for poses facing outward).
 */
const basinWireGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const country = u >= 1322 ? 1 : combeShoulder(u, v);
  if (country <= 0) {
    return 0;
  }
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  const flank = 0.68 + 0.32 * smoothstep01((rc - 125) / 55);
  const hollow = smoothstep01(-basinSwell(x, z) / 1.2);
  const base = 0.6 + 0.4 * Math.min(1, hollow + stoneRing(u, v));
  return (
    golden3Weight(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    processionFree(x, z) *
    candleFree(u, v) *
    (1 - zoneCalm(u, v)) *
    (1 - doorRise(u, v) * 0.55) *
    country *
    flank *
    base
  );
};

/** Comb-lee tufts: growth sheltering in the ridges' violet troughs. */
const combTuftGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const comb = combWeight(u, v);
  if (comb <= 0.05) {
    return 0;
  }
  // The terrain's ridge factor, normalised by its own amplitude: the
  // tufts favour the troughs (the lee), thinning over the lit crests.
  // Round 5: the crests keep a 0.5 floor of wind-bent stragglers — the
  // r4 sweep drew a stand ON a crest whose face filled the whole near
  // band; each ridge occludes its trough, so the face must carry its
  // own layer (a crest is combed, never shaved). A 0.25 first cut put
  // ~4 blades on a 90 m² face — measured in-page, invisible.
  const crest = Math.max(0, Math.min(1, combRidge(u, v) / 2.8));
  const lee = 0.5 + 0.5 * (1 - smoothstep01((crest - 0.6) / 0.3));
  return comb * lee * restFree(x, z) * lensFree(x, z) * golden3Weight(x, z);
};

/** Evening-pocket fronds: the T2 hearts of the authored beats. */
const pocketFrondGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const pocket = pocketDepth(u, v);
  if (pocket <= 0) {
    return 0;
  }
  return (
    fillOwn(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    processionFree(x, z) *
    candleFree(u, v) *
    pocket *
    shelfWarm(Math.min(u, 1200))
  );
};

/** The garden sward: green-gold blades under the candles, clear of the spring. */
const gardenSwardGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const garden = gardenWeight(u, v);
  if (garden <= 0.08) {
    return 0;
  }
  const springD = Math.hypot(u - GARDEN_SPRING.u, v - GARDEN_SPRING.v);
  const dryLand = smoothstep01((springD - GARDEN_SPRING.radius - 0.5) / 2);
  return garden * dryLand * candleFree(u, v) * restFree(x, z) * lensFree(x, z) * golden3Weight(x, z);
};

/** Garden fronds: rosettes crowding the spring ring and candle feet. */
const gardenFrondGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const garden = gardenWeight(u, v);
  if (garden <= 0.08) {
    return 0;
  }
  const springD = Math.hypot(u - GARDEN_SPRING.u, v - GARDEN_SPRING.v);
  const nearSpring =
    smoothstep01((springD - GARDEN_SPRING.radius - 0.5) / 1.4) *
    (1 - smoothstep01((springD - GARDEN_SPRING.radius - 9) / 6));
  let nearCandle = 0;
  for (const candle of CANDLES) {
    const d = Math.hypot(u - candle.u, v - candle.v);
    nearCandle = Math.max(
      nearCandle,
      smoothstep01((d - candle.radius * 1.4) / 0.8) * (1 - smoothstep01((d - 4.5) / 2.5)),
    );
  }
  return (
    garden *
    (0.2 + 0.8 * Math.max(nearSpring, nearCandle)) *
    candleFree(u, v) *
    restFree(x, z) *
    lensFree(x, z)
  );
};

/** The door rise's tufts: the last stand before the world's edge. */
const doorTuftGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const rise = doorRise(u, v);
  if (rise <= 0.03) {
    return 0;
  }
  return rise * restFree(x, z) * lensFree(x, z) * golden3Weight(x, z);
};

/** Split-stone runs at every standing stone's foot. */
const splitStoneGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  let ring = stoneRing(u, v);
  for (const candle of CANDLES) {
    const d = Math.hypot(u - candle.u, v - candle.v);
    ring = Math.max(
      ring,
      smoothstep01((d - candle.radius * 1.4) / 1) * (1 - smoothstep01((d - 4.5) / 2.5)),
    );
  }
  const doorD = Math.hypot(u - DOOR.u, v - DOOR.v);
  ring = Math.max(ring, smoothstep01((doorD - 8) / 2) * (1 - smoothstep01((doorD - 16) / 5)));
  return ring * restFree(x, z) * lensFree(x, z) * golden3Weight(x, z);
};

/** The Night Well's shed shards, on its walls and floor. */
const wellShardGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const carve = wellCarve(u, v);
  const inWell = Math.min(1, -carve.carve / 6);
  return Math.max(0, inWell) * restFree(x, z) * golden3Weight(x, z);
};

// ─── The build ───────────────────────────────────────────────────────────────

export function buildGolden3Cover(): Golden3CoverBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = <T extends KitBuild | CarpetFieldBuild>(build: T): T => {
    groups.push(build.group);
    if ("update" in build) {
      updaters.push((timeSec) => build.update(timeSec));
    }
    return build;
  };

  // ── T1: the fine grain ───────────────────────────────────────────────────
  const grit = keep(
    buildGroundLitter({
      seed: SEED ^ G3_SEEDS.rippleGrit,
      palette: { base: 0xd2b47e, accent: 0xe4d09c, shade: 0x9a8272 },
      area: discArea(),
      gate: gritGate,
      ground: seabedHeight,
      count: 8600,
      shapeSet: "grit",
      size: [0.03, 0.09],
      twoTone: true,
      grade: 0.4,
    }),
  );
  warmMaterials(grit, 0x38302a, 0.3);

  const salt = keep(
    buildGroundLitter({
      seed: SEED ^ G3_SEEDS.saltShards,
      palette: { base: 0xe8dcba, accent: 0xf4ecd2, shade: 0xa4909a },
      area: discArea(),
      gate: saltGate,
      ground: seabedHeight,
      count: 2200,
      shapeSet: "shard",
      size: [0.08, 0.24],
      twoTone: true,
      grade: 0.55,
    }),
  );
  warmMaterials(salt, 0x38302a, 0.3);

  const pebbles = keep(
    buildGroundLitter({
      seed: SEED ^ G3_SEEDS.roadPebbles,
      palette: { base: 0xcab284, accent: 0xdec69c, shade: 0x967a94 },
      area: journeyArea(13),
      gate: roadPebbleGate,
      ground: seabedHeight,
      count: 760,
      shapeSet: "pebble",
      twoTone: true,
      grade: 0.5,
    }),
  );
  warmMaterials(pebbles, 0x38302a, 0.3);

  // ── T2: the standing layer ───────────────────────────────────────────────
  const roadWire = keep(
    buildCarpetField({
      seed: SEED ^ G3_SEEDS.roadWire,
      palette: { base: 0xdec87c, tip: 0xf8ecac, shade: 0xa8926c },
      area: journeyArea(30),
      gate: roadWireGate,
      ground: seabedHeight,
      count: 1350,
      profile: "blade",
      size: [0.46, 0.88],
      swayAmp: 0.05,
      sunGlow: true,
      looseShare: 0.45,
    }),
  );
  warmMaterials(roadWire, 0xa08a48, 0.6);

  const basinWire = keep(
    buildCarpetField({
      seed: SEED ^ G3_SEEDS.basinWire,
      palette: { base: 0xd6be74, tip: 0xf2e2a2, shade: 0xa28c6c },
      area: discArea(),
      gate: basinWireGate,
      ground: seabedHeight,
      count: 5600,
      profile: "blade",
      size: [0.42, 0.85],
      swayAmp: 0.05,
      sunGlow: true,
      looseShare: 0.45,
    }),
  );
  warmMaterials(basinWire, 0xa08a48, 0.6);

  const combTufts = keep(
    buildCarpetField({
      seed: SEED ^ G3_SEEDS.combTufts,
      palette: { base: 0xd2ba6e, tip: 0xf2e29a, shade: 0x92806c },
      area: discArea(),
      gate: combTuftGate,
      ground: seabedHeight,
      // Round 5: 1400 → 3400 — two ~110×52 m comb fields at 1400 gave
      // one tuft per ~20 m², and a random stand on a crest read bare.
      count: 3400,
      profile: "blade",
      size: [0.4, 0.75],
      swayAmp: 0.045,
      sunGlow: true,
      looseShare: 0.5,
    }),
  );
  warmMaterials(combTufts, 0xa08a48, 0.6);

  const pocketFronds = keep(
    buildCarpetField({
      seed: SEED ^ G3_SEEDS.pocketFronds,
      palette: { base: 0xbeb45e, tip: 0xe8da80, shade: 0x86885a },
      area: pocketsArea(),
      gate: pocketFrondGate,
      ground: seabedHeight,
      count: 1050,
      profile: "frond",
      size: [0.3, 0.56],
      swayAmp: 0.04,
      sunGlow: true,
    }),
  );
  warmMaterials(pocketFronds, 0x8c8c3e, 0.6);

  // Round 3: the whole garden green family shifts from pea-green to
  // olive-gold — sunset grass, not spring lawn (the r2 close frame
  // read out of the province's palette entirely).
  const gardenSward = keep(
    buildCarpetField({
      seed: SEED ^ G3_SEEDS.gardenSward,
      palette: { base: 0xa8ac5e, tip: 0xe0d688, shade: 0x76784e },
      area: discAreaAt(GARDEN.u, GARDEN.v, 52),
      gate: gardenSwardGate,
      ground: seabedHeight,
      count: 1350,
      profile: "blade",
      size: [0.34, 0.64],
      swayAmp: 0.05,
      sunGlow: true,
      looseShare: 0.4,
    }),
  );
  warmMaterials(gardenSward, 0x8a883e, 0.55);

  const gardenFronds = keep(
    buildCarpetField({
      seed: SEED ^ G3_SEEDS.gardenFronds,
      palette: { base: 0xa2a660, tip: 0xd6ce86, shade: 0x6e744e },
      area: discAreaAt(GARDEN.u, GARDEN.v, 44),
      gate: gardenFrondGate,
      ground: seabedHeight,
      count: 900,
      profile: "frond",
      size: [0.28, 0.52],
      swayAmp: 0.04,
      sunGlow: true,
    }),
  );
  warmMaterials(gardenFronds, 0x8a883e, 0.55);

  const gardenBushes = keep(
    buildBushBank({
      seed: SEED ^ G3_SEEDS.gardenBushes,
      palette: { base: 0xaaa45c, tip: 0xdcd086, shade: 0x6c684a, accent: 0xf0e096 },
      area: discAreaAt(GARDEN.u, GARDEN.v, 46),
      gate: (x, z) => gardenSwardGate(x, z) * bushFree(x, z),
      ground: seabedHeight,
      count: 26,
      fronds: 8,
      accents: 5,
    }),
  );
  warmMaterials(gardenBushes, 0x8a883e, 0.45);

  const doorTufts = keep(
    buildCarpetField({
      seed: SEED ^ G3_SEEDS.doorTufts,
      palette: { base: 0xdec87c, tip: 0xf8ecac, shade: 0xa8926c },
      area: discAreaAt(DOOR.u - 8, DOOR.v, 44),
      gate: doorTuftGate,
      ground: seabedHeight,
      count: 460,
      profile: "blade",
      size: [0.4, 0.75],
      swayAmp: 0.045,
      sunGlow: true,
      looseShare: 0.5,
    }),
  );
  warmMaterials(doorTufts, 0xa08a48, 0.6);

  // Round 4: brighter, warmer — the r3 mounds sat mid-value on the door
  // rise's skyline, and 130 m of red attenuation turned olive to pea.
  const doorScrub = keep(
    buildBushBank({
      seed: SEED ^ G3_SEEDS.doorScrub,
      palette: { base: 0xc2b070, tip: 0xecdc96, shade: 0x807454 },
      area: discAreaAt(DOOR.u - 10, DOOR.v, 34),
      gate: (x, z) => doorTuftGate(x, z) * bushFree(x, z),
      ground: seabedHeight,
      count: 12,
      fronds: 5,
      accents: 4,
      looseShare: 0.35,
    }),
  );
  warmMaterials(doorScrub, 0xb09a50, 0.5);

  const pocketBushes = keep(
    buildBushBank({
      seed: SEED ^ G3_SEEDS.gardenBushes ^ 0x7,
      palette: { base: 0xbaa862, tip: 0xe8d88e, shade: 0x746850 },
      area: pocketsArea(),
      gate: (x, z) => pocketFrondGate(x, z) * bushFree(x, z),
      ground: seabedHeight,
      count: 40,
      fronds: 5,
      accents: 4,
      looseShare: 0.35,
    }),
  );
  warmMaterials(pocketBushes, 0xa08a48, 0.5);

  const splits = keep(
    buildGroundLitter({
      seed: SEED ^ G3_SEEDS.splitStones,
      palette: { base: 0xc2a274, accent: 0xdabc8c, shade: 0x8a7268 },
      area: discArea(),
      gate: splitStoneGate,
      ground: seabedHeight,
      count: 440,
      shapeSet: "split",
      size: [0.1, 0.3],
      twoTone: true,
      grade: 0.6,
    }),
  );
  warmMaterials(splits, 0x38302a, 0.3);

  const wellShards = keep(
    buildGroundLitter({
      seed: SEED ^ G3_SEEDS.wellShards,
      palette: { base: 0xb493a2, accent: 0xd0b49c, shade: 0x7a5f80 },
      area: discAreaAt(WELL.u, WELL.v, 30),
      gate: wellShardGate,
      ground: seabedHeight,
      count: 280,
      shapeSet: "shard",
      size: [0.12, 0.38],
      twoTone: true,
      grade: 0.65,
    }),
  );
  warmMaterials(wellShards, 0x40324a, 0.35);

  // The wrack drift-lines: freight the dying wind set down across the
  // roads (a value DOWN from the ground, the province's proven read).
  for (const [index, line] of DRIFT_LINES.entries()) {
    const wrack = keep(
      buildDriftDebris({
        seed: SEED ^ (G3_SEEDS.wrackLines + index),
        palette: { base: 0xbea87c, shade: 0x968694 },
        area: driftLineArea(line, 5),
        gate: (x, z) => restFree(x, z) * fillOwn(x, z),
        ground: seabedHeight,
        count: index === 0 ? 54 : 46,
        shapeSet: "wrack",
      }),
    );
    warmMaterials(wrack, 0x3a342a, 0.3);
  }

  // ── The close beds (the lily-bench law, paid up front) ───────────────────
  const beds: readonly {
    seed: number;
    at: { u: number; v: number };
    radius: number;
    count: number;
    profile: "blade" | "frond";
    palette: { base: number; tip: number; shade: number };
    warm: number;
  }[] = [
    {
      seed: G3_SEEDS.closePanBed,
      at: { u: CLOSE_LENSES[0]!.u - 2.6, v: CLOSE_LENSES[0]!.v - 2.8 },
      radius: 4,
      count: 70,
      profile: "blade",
      palette: { base: 0xdec87c, tip: 0xf8ecac, shade: 0xa8926c },
      warm: 0xa08a48,
    },
    {
      seed: G3_SEEDS.closeCombBed,
      at: { u: CLOSE_LENSES[1]!.u + 2.6, v: CLOSE_LENSES[1]!.v + 2.9 },
      radius: 4.5,
      count: 88,
      profile: "blade",
      palette: { base: 0xc8b268, tip: 0xecd892, shade: 0x8c7a68 },
      warm: 0xa08a48,
    },
    {
      seed: G3_SEEDS.closeGardenBed,
      at: { u: CLOSE_LENSES[2]!.u + 3.0, v: CLOSE_LENSES[2]!.v + 3.6 },
      radius: 4.5,
      count: 110,
      profile: "frond",
      palette: { base: 0xa2a660, tip: 0xd6ce86, shade: 0x6e744e },
      warm: 0x8a883e,
    },
    {
      seed: G3_SEEDS.closeDoorBed,
      at: { u: CLOSE_LENSES[3]!.u + 2.8, v: CLOSE_LENSES[3]!.v + 2.2 },
      radius: 4,
      count: 66,
      profile: "blade",
      palette: { base: 0xdac274, tip: 0xf6e6a4, shade: 0xa48e68 },
      warm: 0xa08a48,
    },
  ] as const;
  for (const bed of beds) {
    const stand = keep(
      buildCarpetField({
        seed: SEED ^ bed.seed,
        palette: bed.palette,
        area: discAreaAt(bed.at.u, bed.at.v, bed.radius),
        gate: (x, z) => restFree(x, z) * lensFree(x, z) * golden3Weight(x, z),
        ground: seabedHeight,
        count: bed.count,
        profile: bed.profile,
        size: [0.34, 0.66],
        swayAmp: 0.045,
        sunGlow: true,
        looseShare: 0.6,
      }),
    );
    warmMaterials(stand, bed.warm, 0.6);
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
