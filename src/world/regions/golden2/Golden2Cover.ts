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
  COURT_ROAD,
  DRIFT_LINES,
  WIND_POCKETS,
  lensFree,
  restFree,
  roadDistance,
} from "./Golden2Beats";
import { HOODOOS, hoodooFree } from "./Golden2Rocks";
import { G2_SEEDS, smoothstep01 } from "./Golden2Shared";
import { TOWERS } from "./Golden2Carillon";
import {
  ARCH_AT,
  CARILLON,
  CENTER_X,
  CENTER_Z,
  PAVEMENT_RADIUS,
  SEEP_POOLS,
  carillonWeight,
  courtSwale,
  golden2Weight,
  gullyChannelCenter,
  gullyChannelHalf,
  passHalfWidth,
  ribbonDistance,
  seepPoolDish,
  seepsWeight,
  shelfWeight,
  spokeOf,
  windowsRidge,
  worldOf,
} from "./Golden2Terrain";

/**
 * The Carillon Waste's T1/T2 cover — built at the R12 quality tier from
 * the first draft (no wedge era): everything green wears the kit's
 * `"blade"`/`"frond"` profiles, litter is graded so foreground stones
 * anchor, every gate multiplies {@link restFree} so the two registered
 * rests stay composed bareness, and every close pose's subject is its
 * OWN authored bed (the lily-bench law, paid up front — a global
 * scatter is never asked to land a lens's subject).
 *
 * Desert fill is rhythm and fine grain: T1 carries vastness (grit,
 * shells, pebbles at large counts), T2 is sparse-but-authored (wire
 * blades on the roads' shoulders and the court's sand hollows, wind-
 * pocket fronds every 20–40 m, seep swards, scrub banks, split-stone
 * runs at every standing stone's foot, shard aprons under the Windows).
 *
 * The value lessons are pre-paid: every family carries the pilot's own
 * small-emissive dusk lift, keyed per family, because under this
 * region's quarter-strength honey sun a palette picked for the kit
 * demo's light renders a step too dark (verdant fill r1, golden fill
 * r1, verdant re-pass r2 — three regions learned it; this one starts
 * there).
 */

const SEED = SEEDS.regionGolden2;

export interface Golden2CoverBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

/** The pilot's region-side dusk lift; the kit stays palette-pure. */
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

/** The whole journey as one road area: shore road, gully, court road. */
function journeyArea(width: number): KitArea {
  const polyline: [number, number][] = [];
  for (let u = 646; u <= 816; u += 17) {
    const { x, z } = worldOf(u, gullyChannelCenter(u));
    polyline.push([x, z]);
  }
  for (const [u, v] of COURT_ROAD) {
    const { x, z } = worldOf(u, v);
    polyline.push([x, z]);
  }
  return { polyline, width };
}

/** The wind pockets threaded as one road area (ordered by spoke u). */
function pocketsArea(): KitArea {
  const ordered = [...WIND_POCKETS].sort((a, b) => a.u - b.u);
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

/** How deep inside the nearest wind pocket a spoke point sits. */
function pocketDepth(u: number, v: number): number {
  let best = 0;
  for (const pocket of WIND_POCKETS) {
    const d = Math.hypot(u - pocket.u, v - pocket.v);
    best = Math.max(best, 1 - smoothstep01((d - pocket.radius * 0.55) / (pocket.radius * 0.55)));
  }
  return best;
}

/** The pilot handshake: shore-road fill thins toward the Hourglass Sea. */
function shoreWarm(u: number): number {
  return 0.3 + 0.7 * smoothstep01((u - 652) / 40);
}

/** In-channel weight down the shore road and gully. */
function roadness(u: number, v: number): number {
  if (u < 644 || u > 824) {
    return 0;
  }
  const away = Math.abs(v - gullyChannelCenter(u));
  const half = u < 748 ? passHalfWidth(u) * 0.8 : gullyChannelHalf(u) + 6;
  return 1 - smoothstep01((away - half) / 8);
}

/** The calm zones that own their own floors (broad cover thins there). */
function zoneCalm(u: number, v: number): number {
  return Math.max(
    carillonWeight(u, v) * 0.85,
    seepsWeight(u, v) * 0.6,
    windowsRidge(u, v).w * 0.9,
    1 - smoothstep01((ribbonDistance(u, v).d - 4) / 5), // the slot walls
  );
}

/** Ring around each hoodoo's foot — growth shelters in stone lee. */
function hoodooRing(u: number, v: number): number {
  let ring = 0;
  for (const hoodoo of HOODOOS) {
    const d = Math.hypot(u - hoodoo.u, v - hoodoo.v);
    ring = Math.max(
      ring,
      smoothstep01((d - hoodoo.cap * 1.2) / 1.2) * (1 - smoothstep01((d - 7) / 4)),
    );
  }
  return ring;
}

// ─── The gates ───────────────────────────────────────────────────────────────

/** Ripple-grit: the whole carved floor's close-range grain (T1 base). */
const gritGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  // Grit gathers in the sand hollows and thins over bare carved rises.
  const hollow = 1 - smoothstep01(courtSwale(x, z) / 1.3) * 0.5;
  const base = u < 824 ? roadness(u, v) * shoreWarm(u) : 1 - zoneCalm(u, v) * 0.75;
  return golden2Weight(x, z) * restFree(x, z) * base * hollow;
};

/** Shell drift: pale shells stranded in hollows and along the roads. */
const shellGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const hollow = smoothstep01(-courtSwale(x, z) / 1.1);
  const road = roadness(u, v) * 0.5;
  const pockets = pocketDepth(u, v) * 0.7;
  return (
    golden2Weight(x, z) *
    restFree(x, z) *
    (1 - zoneCalm(u, v)) *
    Math.min(1, hollow * 0.8 + road + pockets)
  );
};

/** Pebble runs pacing the whole journey road. */
const roadPebbleGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const near = u < 824 ? roadness(u, v) : 1 - smoothstep01((roadDistance(u, v) - 7) / 5);
  return near * shoreWarm(Math.min(u, 700)) * restFree(x, z) * golden2Weight(x, z);
};

/** Road-shoulder wire blades: the journey's standing near layer. */
const roadWireGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  let shoulder: number;
  if (u < 824) {
    const away = Math.abs(v - gullyChannelCenter(u));
    const half = u < 748 ? 10 : gullyChannelHalf(u);
    shoulder = smoothstep01((away - half * 0.35) / 3) * (1 - smoothstep01((away - half - 9) / 7));
  } else {
    const d = roadDistance(u, v);
    shoulder = smoothstep01((d - 2.5) / 2.5) * (1 - smoothstep01((d - 11) / 6));
  }
  return (
    golden2Weight(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    hoodooFree(x, z) *
    shoreWarm(u) *
    (0.3 + 0.7 * shoulder) *
    (1 - zoneCalm(u, v))
  );
};

/**
 * Court wire: the open country's standing layer — sand hollows, hoodoo
 * lees, and the rim-facing flank band (MASTER F-R3: the three-layer
 * answer must live in the first ~35 m even for poses facing outward).
 */
const courtWireGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 812) {
    return 0;
  }
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  const flank = 0.55 + 0.45 * smoothstep01((rc - 125) / 55);
  const hollow = smoothstep01(-courtSwale(x, z) / 1.2);
  const base = 0.5 + 0.5 * Math.min(1, hollow + hoodooRing(u, v));
  return (
    golden2Weight(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    hoodooFree(x, z) *
    (1 - zoneCalm(u, v)) *
    flank *
    base
  );
};

/** The Sunset Shelf's decrescendo tufts, thinning toward the rim seal. */
const shelfTuftGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  return (
    shelfWeight(u) *
    (1 - smoothstep01((rc - 192) / 14)) *
    restFree(x, z) *
    lensFree(x, z) *
    (1 - zoneCalm(u, v)) *
    golden2Weight(x, z)
  );
};

/** Wind-pocket fronds: the T2 hearts of the authored beats. */
const pocketFrondGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const pocket = pocketDepth(u, v);
  if (pocket <= 0) {
    return 0;
  }
  return (
    golden2Weight(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    hoodooFree(x, z) *
    pocket *
    shoreWarm(Math.min(u, 700))
  );
};

/** The seep sward: green-gold blades on the benches, clear of pools. */
const seepSwardGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const seeps = seepsWeight(u, v);
  if (seeps <= 0.08) {
    return 0;
  }
  const dryLand = 1 - smoothstep01((seepPoolDish(u, v) - 0.05) / 0.15);
  return seeps * dryLand * restFree(x, z) * lensFree(x, z) * golden2Weight(x, z);
};

/** Seep fronds: rosettes crowding the pool rims and stain plumes. */
const seepFrondGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const seeps = seepsWeight(u, v);
  if (seeps <= 0.08) {
    return 0;
  }
  let nearPool = 0;
  for (const pool of SEEP_POOLS) {
    const d = Math.hypot(u - pool.u, v - pool.v);
    nearPool = Math.max(
      nearPool,
      smoothstep01((d - pool.radius * 0.7) / 1.2) * (1 - smoothstep01((d - pool.radius - 7) / 5)),
    );
  }
  const dryLand = 1 - smoothstep01((seepPoolDish(u, v) - 0.08) / 0.15);
  return seeps * dryLand * (0.25 + 0.75 * nearPool) * restFree(x, z) * lensFree(x, z);
};

/** Split-stone runs at every standing stone's foot. */
const splitStoneGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  let ring = hoodooRing(u, v);
  for (const tower of TOWERS) {
    const d = Math.hypot(u - tower.u, v - tower.v);
    ring = Math.max(
      ring,
      smoothstep01((d - tower.radius * 1.3) / 1.2) * (1 - smoothstep01((d - tower.radius * 1.3 - 5) / 3)),
    );
  }
  // Never inside the swept Pavement.
  const pavement = smoothstep01(
    (Math.hypot(u - CARILLON.u, v - CARILLON.v) - PAVEMENT_RADIUS) / 3,
  );
  return ring * pavement * restFree(x, z) * lensFree(x, z) * golden2Weight(x, z);
};

/** The Ribbon's floor litter: blocks the slot shed into its own deep. */
const slotFloorGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const rd = ribbonDistance(u, v);
  const inSlot = 1 - smoothstep01((rd.d - 3) / 3);
  return inSlot * restFree(x, z) * golden2Weight(x, z);
};

// ─── The build ───────────────────────────────────────────────────────────────

export function buildGolden2Cover(finFeet: readonly { u: number; v: number }[]): Golden2CoverBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = <T extends KitBuild | CarpetFieldBuild>(build: T): T => {
    groups.push(build.group);
    if ("update" in build) {
      updaters.push((timeSec) => build.update(timeSec));
    }
    return build;
  };

  /** Shard aprons fan from the Windows' fin feet and the arch's legs. */
  const shardApronGate: GateFn = (x, z) => {
    const { u, v } = spokeOf(x, z);
    let near = 0;
    for (const fin of finFeet) {
      const d = Math.hypot(u - fin.u, v - fin.v);
      near = Math.max(near, 1 - smoothstep01((d - 2.4) / 3.4));
    }
    const arch = 1 - smoothstep01((Math.hypot(u - ARCH_AT.u, v - ARCH_AT.v) - 3) / 5);
    return restFree(x, z) * lensFree(x, z) * Math.min(1, near + arch * 0.8);
  };

  // ── T1: the fine grain ───────────────────────────────────────────────────
  const grit = keep(
    buildGroundLitter({
      seed: SEED ^ G2_SEEDS.rippleGrit,
      palette: { base: 0xd0b67e, accent: 0xe2d09a, shade: 0x9a8470 },
      area: discArea(),
      gate: gritGate,
      ground: seabedHeight,
      count: 5200,
      shapeSet: "grit",
      size: [0.03, 0.09],
      twoTone: true,
      grade: 0.4,
    }),
  );
  warmMaterials(grit, 0x38302a, 0.3);

  const shells = keep(
    buildGroundLitter({
      seed: SEED ^ G2_SEEDS.shellDrift,
      palette: { base: 0xe4d6b2, accent: 0xf1e8cc, shade: 0xa08a80 },
      area: discArea(),
      gate: shellGate,
      ground: seabedHeight,
      count: 2200,
      shapeSet: "pebble",
      size: [0.09, 0.22],
      twoTone: true,
      grade: 0.6,
    }),
  );
  warmMaterials(shells, 0x38302a, 0.3);

  const pebbles = keep(
    buildGroundLitter({
      seed: SEED ^ G2_SEEDS.roadPebbles,
      palette: { base: 0xc8b284, accent: 0xdcc69a, shade: 0x967a94 },
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
      seed: SEED ^ G2_SEEDS.roadWire,
      palette: { base: 0xdcc87a, tip: 0xf6eaaa, shade: 0xa8946a },
      area: journeyArea(26),
      gate: roadWireGate,
      ground: seabedHeight,
      count: 1050,
      profile: "blade",
      size: [0.46, 0.88],
      swayAmp: 0.05,
      sunGlow: true,
      looseShare: 0.45,
    }),
  );
  warmMaterials(roadWire, 0xa08a48, 0.6);

  const courtWire = keep(
    buildCarpetField({
      seed: SEED ^ G2_SEEDS.courtWire,
      palette: { base: 0xd8c072, tip: 0xf4e6a2, shade: 0xa48e66 },
      area: discArea(),
      gate: courtWireGate,
      ground: seabedHeight,
      count: 1600,
      profile: "blade",
      size: [0.42, 0.85],
      swayAmp: 0.05,
      sunGlow: true,
      looseShare: 0.45,
    }),
  );
  warmMaterials(courtWire, 0xa08a48, 0.6);

  const shelfTufts = keep(
    buildCarpetField({
      seed: SEED ^ G2_SEEDS.shelfTufts,
      palette: { base: 0xdcc87a, tip: 0xf6eaaa, shade: 0xa8946a },
      area: discAreaAt(1110, 0, 80),
      gate: shelfTuftGate,
      ground: seabedHeight,
      count: 460,
      profile: "blade",
      size: [0.4, 0.75],
      swayAmp: 0.045,
      sunGlow: true,
      looseShare: 0.5,
    }),
  );
  warmMaterials(shelfTufts, 0xa08a48, 0.6);

  const pocketFronds = keep(
    buildCarpetField({
      seed: SEED ^ G2_SEEDS.pocketFronds,
      palette: { base: 0xbcb45c, tip: 0xe6da7e, shade: 0x86885a },
      area: pocketsArea(),
      gate: pocketFrondGate,
      ground: seabedHeight,
      count: 980,
      profile: "frond",
      size: [0.3, 0.56],
      swayAmp: 0.04,
      sunGlow: true,
    }),
  );
  warmMaterials(pocketFronds, 0x8c8c3e, 0.6);

  const seepSward = keep(
    buildCarpetField({
      seed: SEED ^ G2_SEEDS.seepSward,
      palette: { base: 0x9cb060, tip: 0xd2dc86, shade: 0x6e8455 },
      area: discAreaAt(975, 72, 56),
      gate: seepSwardGate,
      ground: seabedHeight,
      count: 900,
      profile: "blade",
      size: [0.34, 0.64],
      swayAmp: 0.05,
      sunGlow: true,
      looseShare: 0.4,
    }),
  );
  warmMaterials(seepSward, 0x6a8a3e, 0.55);

  const seepFronds = keep(
    buildCarpetField({
      seed: SEED ^ G2_SEEDS.seepFronds,
      palette: { base: 0x8cb068, tip: 0xc8dc8e, shade: 0x648256 },
      area: discAreaAt(972, 72, 40),
      gate: seepFrondGate,
      ground: seabedHeight,
      count: 640,
      profile: "frond",
      size: [0.28, 0.52],
      swayAmp: 0.04,
      sunGlow: true,
    }),
  );
  warmMaterials(seepFronds, 0x6a8a3e, 0.55);

  // Scrub banks: gold cushion bushes in the seep gardens, olive scrub
  // at the Windows' foot, dry gold banks along the court's pockets.
  const seepBushes = keep(
    buildBushBank({
      seed: SEED ^ G2_SEEDS.seepBushes,
      palette: { base: 0x9aa856, tip: 0xd6d688, shade: 0x5c6a4a, accent: 0xf0e6a0 },
      area: discAreaAt(975, 72, 46),
      gate: seepSwardGate,
      ground: seabedHeight,
      count: 26,
      fronds: 8,
      accents: 5,
    }),
  );
  warmMaterials(seepBushes, 0x6a8a3e, 0.45);

  const windowScrub = keep(
    buildBushBank({
      seed: SEED ^ G2_SEEDS.windowScrub,
      palette: { base: 0xa89e5c, tip: 0xd8cc84, shade: 0x6a6448 },
      area: discAreaAt(866, 60, 34),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        const ridge = windowsRidge(u, v);
        const foot = smoothstep01((ridge.w - 0.04) / 0.2) * (1 - smoothstep01((ridge.w - 0.55) / 0.3));
        return foot * restFree(x, z) * lensFree(x, z) * golden2Weight(x, z);
      },
      ground: seabedHeight,
      count: 16,
      fronds: 4,
      accents: 3,
    }),
  );
  warmMaterials(windowScrub, 0x8c8c3e, 0.5);

  const courtBushes = keep(
    buildBushBank({
      seed: SEED ^ G2_SEEDS.courtBushes,
      palette: { base: 0xb8a860, tip: 0xe6d88c, shade: 0x746850 },
      area: pocketsArea(),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        return (
          pocketDepth(u, v) * restFree(x, z) * lensFree(x, z) * hoodooFree(x, z) * golden2Weight(x, z)
        );
      },
      ground: seabedHeight,
      count: 30,
      fronds: 5,
      accents: 4,
      looseShare: 0.35,
    }),
  );
  warmMaterials(courtBushes, 0xa08a48, 0.5);

  // Split-stone runs: formed foreground rock at every stone's foot.
  const splits = keep(
    buildGroundLitter({
      seed: SEED ^ G2_SEEDS.splitStones,
      palette: { base: 0xc0a072, accent: 0xd8bc8a, shade: 0x8a7268 },
      area: discArea(),
      gate: splitStoneGate,
      ground: seabedHeight,
      count: 340,
      shapeSet: "split",
      size: [0.1, 0.3],
      twoTone: true,
      grade: 0.6,
    }),
  );
  warmMaterials(splits, 0x38302a, 0.3);

  // Shard aprons under the Windows — the fins spring FROM somewhere.
  const shards = keep(
    buildGroundLitter({
      seed: SEED ^ G2_SEEDS.shardAprons,
      palette: { base: 0xcaaa76, accent: 0xe0c890, shade: 0x907686 },
      area: discAreaAt(866, 60, 40),
      gate: shardApronGate,
      ground: seabedHeight,
      count: 460,
      shapeSet: "shard",
      size: [0.1, 0.32],
      twoTone: true,
      grade: 0.6,
    }),
  );
  warmMaterials(shards, 0x38302a, 0.3);

  // The Ribbon's floor: blocks the slot shed into its own deep.
  const slotBlocks = keep(
    buildGroundLitter({
      seed: SEED ^ G2_SEEDS.slotFloor,
      palette: { base: 0xb493a0, accent: 0xd0b49a, shade: 0x7a5f80 },
      area: discAreaAt(955, -62, 62),
      gate: slotFloorGate,
      ground: seabedHeight,
      count: 320,
      shapeSet: "shard",
      size: [0.12, 0.38],
      twoTone: true,
      grade: 0.65,
    }),
  );
  warmMaterials(slotBlocks, 0x40324a, 0.35);

  // The wrack drift-lines: freight the wind dropped across the roads.
  for (const [index, line] of DRIFT_LINES.entries()) {
    const wrack = keep(
      buildDriftDebris({
        seed: SEED ^ (G2_SEEDS.wrackLines + index),
        palette: { base: 0xccb886, shade: 0x948496 },
        area: driftLineArea(line, 5),
        gate: (x, z) => restFree(x, z) * golden2Weight(x, z),
        ground: seabedHeight,
        count: index === 0 ? 54 : 46,
        shapeSet: "wrack",
      }),
    );
    warmMaterials(wrack, 0x3a342a, 0.3);
  }

  // ── The close beds (the lily-bench law, paid up front) ───────────────────
  // Each close pose's near field is its own authored kit call on the
  // camera's look ray; the lens registry keeps the metre under the
  // camera itself clear.
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
      seed: G2_SEEDS.closeCourtBed,
      at: { u: CLOSE_LENSES[0]!.u + 3.2, v: CLOSE_LENSES[0]!.v + 3.4 },
      radius: 4.5,
      count: 88,
      profile: "frond",
      palette: { base: 0xbcb45c, tip: 0xe6da7e, shade: 0x86885a },
      warm: 0x8c8c3e,
    },
    {
      seed: G2_SEEDS.closeSeepBed,
      at: { u: CLOSE_LENSES[1]!.u + 1.8, v: CLOSE_LENSES[1]!.v + 2.6 },
      radius: 4,
      count: 110,
      profile: "frond",
      palette: { base: 0x8cb068, tip: 0xc8dc8e, shade: 0x648256 },
      warm: 0x6a8a3e,
    },
    {
      seed: G2_SEEDS.closeFluteBed,
      at: { u: CLOSE_LENSES[2]!.u + 2.6, v: CLOSE_LENSES[2]!.v + 2.8 },
      radius: 4,
      count: 66,
      profile: "blade",
      palette: { base: 0xdcc87a, tip: 0xf6eaaa, shade: 0xa8946a },
      warm: 0xa08a48,
    },
    {
      seed: G2_SEEDS.closeArchBed,
      at: { u: CLOSE_LENSES[3]!.u + 2.4, v: CLOSE_LENSES[3]!.v + 3.0 },
      radius: 4,
      count: 60,
      profile: "blade",
      palette: { base: 0xd8c072, tip: 0xf4e6a2, shade: 0xa48e66 },
      warm: 0xa08a48,
    },
  ] as const;
  for (const bed of beds) {
    const stand = keep(
      buildCarpetField({
        seed: SEED ^ bed.seed,
        palette: bed.palette,
        area: discAreaAt(bed.at.u, bed.at.v, bed.radius),
        gate: (x, z) => restFree(x, z) * lensFree(x, z) * golden2Weight(x, z),
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
