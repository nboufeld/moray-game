import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildCarpetField, type CarpetFieldBuild } from "../kit/CarpetField";
import { buildBushBank } from "../kit/BushBank";
import { buildDriftDebris } from "../kit/DriftDebris";
import { buildGroundLitter } from "../kit/GroundLitter";
import type { GateFn, KitArea, KitBuild } from "../kit/KitTypes";
import { smoothstep01 } from "./GoldenShared";
import {
  DRIFT_LINES,
  FILL_SEEDS,
  LEE_GARDENS,
  lensFree,
  restFree,
} from "./GoldenFillShared";
import { MONOLITHS } from "./GoldenRocks";
import { PALM_SEATS } from "./GoldenOasis";
import type { FinSpot } from "./GoldenGlass";
import {
  CENTER_X,
  CENTER_Z,
  HOURGLASS,
  flatsWeight,
  glassWeight,
  goldenWeight,
  hourglassWeight,
  oasisWeight,
  duneRank,
  saddleChannelCenter,
  saddleChannelHalf,
  shoreWeight,
  spokeOf,
  tongueHalfWidth,
  worldOf,
} from "./GoldenTerrain";

/**
 * The Hourglass Sea's T1/T2 ground cover — the fill audit's one-line
 * verdict answered ("T3/T5 land, T1 and T2 are near-absent everywhere").
 * Desert fill is rhythm and fine grain, not clutter: T1 carries vastness
 * (grit, shells, pebbles at huge counts), T2 is sparse-but-authored
 * (wire-grass, lee-garden fronds, wrack drift-lines, salt-lilies, oasis
 * bushes, shard aprons, singing stones).
 *
 * Everything here is a kit call at the R12 quality tier: anything green
 * or grass-like uses the `"blade"`/`"frond"` profiles (the q-final craft
 * — 48/60-tri authored clumps, never the 4-tri wedges the owner called
 * "half-cut grass"), litter uses the graded scatter so foreground stones
 * anchor, and every gate multiplies {@link restFree} so the two
 * registered rests stay composed bareness.
 *
 * Every call takes a fresh `SEEDS.regionGolden1 ^ FILL_SEEDS.*` stream —
 * the reroll fence; the region test pins six pilot placements to prove
 * nothing re-rolled.
 */

const SEED = SEEDS.regionGolden1;

export interface GoldenCoverBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

// ─── Areas ───────────────────────────────────────────────────────────────────

/** The whole disc as one kit area (gates carve the real shapes). */
function discArea(): KitArea {
  return { center: [CENTER_X, CENTER_Z], radius: 225 };
}

function discAreaAt(u: number, v: number, radius: number): KitArea {
  const { x, z } = worldOf(u, v);
  return { center: [x, z], radius };
}

/** The saddle channel as a kit road area, stations every ~16 m of spoke. */
function saddleArea(fromU: number, toU: number, width: number): KitArea {
  const polyline: [number, number][] = [];
  for (let u = fromU; u <= toU; u += 16) {
    const { x, z } = worldOf(u, saddleChannelCenter(u));
    polyline.push([x, z]);
  }
  return { polyline, width };
}

/** One authored drift-line as a kit road area. */
function driftLineArea(line: readonly (readonly [number, number])[], width: number): KitArea {
  const polyline: [number, number][] = line.map(([u, v]) => {
    const { x, z } = worldOf(u, v);
    return [x, z] as [number, number];
  });
  return { polyline, width };
}

/**
 * The lee-garden pockets threaded as one road area (ordered by spoke
 * distance): a giant disc with a pocket-only gate starves the scatter —
 * the polyline keeps the samples near the pockets and the gate does the
 * final carving.
 */
function pocketsArea(): KitArea {
  const ordered = [...LEE_GARDENS].sort((a, b) => a.u - b.u);
  const polyline: [number, number][] = ordered.map((pocket) => {
    const { x, z } = worldOf(pocket.u, pocket.v);
    return [x, z] as [number, number];
  });
  return { polyline, width: 15 };
}

// ─── Shared gate arithmetic ──────────────────────────────────────────────────

/** How deep inside the nearest lee-garden pocket a spoke point sits. */
function pocketDepth(u: number, v: number): number {
  let best = 0;
  for (const pocket of LEE_GARDENS) {
    const d = Math.hypot(u - pocket.u, v - pocket.v);
    best = Math.max(best, 1 - smoothstep01((d - pocket.radius * 0.55) / (pocket.radius * 0.55)));
  }
  return best;
}

/** The wing handshake: saddle fill thins to the wing register by u ~90. */
function wingWarm(u: number): number {
  return 0.25 + 0.75 * smoothstep01((u - 58) / 32);
}

/** In-channel weight down the saddle (0 on the shoulders' far side). */
function saddleness(u: number, v: number): number {
  if (u < 50 || u > 290) {
    return 0;
  }
  const away = Math.abs(v - saddleChannelCenter(u));
  return 1 - smoothstep01((away - saddleChannelHalf(u) - 6) / 8);
}

/** The calm zones that own their own floors (cover thins there). */
function zoneCalm(u: number, v: number): number {
  return Math.max(
    hourglassWeight(u, v),
    glassWeight(u, v) * 0.8,
    oasisWeight(u, v) * 0.7,
    shoreWeight(u) * 0.45,
  );
}

// ─── The gates ───────────────────────────────────────────────────────────────

/** Ripple-grit: the fine grain of the whole desert floor (T1 base). */
const gritGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const rank = duneRank(u, v);
  // Grit gathers in the troughs and thins over bare windward crests —
  // the wind-sorted read a real dune floor has.
  const trough = 1 - rank.rise * 0.55;
  const saddle = saddleness(u, v);
  const base = u < 290 ? saddle * wingWarm(u) : 1 - hourglassWeight(u, v) * 0.9;
  return goldenWeight(x, z) * restFree(x, z) * base * trough;
};

/** Shell drift: pale shells stranded in dune lees and along the shore. */
const shellGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 285) {
    return 0;
  }
  const rank = duneRank(u, v);
  const lee = smoothstep01((rank.slip - 0.4) / 0.35);
  const shore = shoreWeight(u) * 0.55;
  const pockets = pocketDepth(u, v) * 0.7;
  const calm = Math.max(hourglassWeight(u, v), glassWeight(u, v) * 0.8, oasisWeight(u, v) * 0.6);
  return (
    goldenWeight(x, z) *
    restFree(x, z) *
    (1 - calm) *
    Math.min(1, lee + shore + pockets)
  );
};

/** The saddle's pebble runs, pooled where the honey stain pools. */
const saddlePebbleGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return saddleness(u, v) * wingWarm(u) * restFree(x, z) * goldenWeight(x, z);
};

/**
 * Dune-crest wire-grass: the region's standing near layer. Leaned toward
 * windward crests (dry grass holds a dune's back), boosted along the
 * rim-facing flank band (MASTER field note F-R3: the three-layer answer
 * must live in the first ~35 m even for poses that face outward), and
 * into the lee pockets.
 */
const duneWireGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 285) {
    return 0;
  }
  const rank = duneRank(u, v);
  const wind = rank.rise * (1 - rank.slip);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  const flank = 0.55 + 0.45 * smoothstep01((rc - 125) / 55);
  const calm = zoneCalm(u, v);
  const flats = flatsWeight(u, v);
  // The flats keep their emptiness composed: a thin fringe only.
  const flatsThin = 1 - flats * 0.72;
  const base = (0.28 + 0.72 * wind) * (1 - calm) * flatsThin;
  return (
    goldenWeight(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    flank *
    Math.min(1, base + pocketDepth(u, v) * 0.8)
  );
};

/** The saddle's own wire-grass, on the dune shoulders both sides. */
const saddleWireGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 52 || u > 292) {
    return 0;
  }
  const away = Math.abs(v - saddleChannelCenter(u));
  const shoulder =
    smoothstep01((away - 2.5) / 3) *
    (1 - smoothstep01((away - tongueHalfWidth(u) * 0.7) / 6));
  return (
    goldenWeight(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    wingWarm(u) *
    (0.35 + 0.65 * shoulder) *
    Math.min(1, 0.55 + pocketDepth(u, v))
  );
};

/** Lee-garden fronds: the T2 hearts of the authored pockets. */
const leeFrondGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const pocket = pocketDepth(u, v);
  if (pocket <= 0) {
    return 0;
  }
  return (
    goldenWeight(x, z) * restFree(x, z) * lensFree(x, z) * pocket * wingWarm(Math.min(u, 92))
  );
};

/** Terrace salt-lilies: pale rosettes on the Hourglass's benched treads. */
const saltLilyGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const d = Math.hypot(u - HOURGLASS.u, v - HOURGLASS.v);
  if (d > 44) {
    return 0;
  }
  const band = smoothstep01((d - 15) / 4) * (1 - smoothstep01((d - 40) / 4));
  return band * restFree(x, z) * lensFree(x, z);
};

/** Oasis cushion bushes: the hollows' understory between the palms. */
const oasisBushGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const oasis = oasisWeight(u, v);
  if (oasis <= 0.1) {
    return 0;
  }
  // Off the palm trunks themselves.
  let clear = 1;
  for (const seat of PALM_SEATS) {
    clear = Math.min(clear, smoothstep01((Math.hypot(u - seat.u, v - seat.v) - 1.6) / 1.4));
  }
  return oasis * clear * restFree(x, z);
};

/** Fallen palm fronds: shed straps at the palms' feet. */
const fallenFrondGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  let near = 0;
  for (const seat of PALM_SEATS) {
    const d = Math.hypot(u - seat.u, v - seat.v);
    near = Math.max(near, (1 - smoothstep01((d - 1.4) / 2.6)) * smoothstep01((d - 0.9) / 0.5));
  }
  return near * restFree(x, z);
};

/** Singing-stone scatter: split stones ringing the monolith country. */
const singingStoneGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const flats = flatsWeight(u, v);
  if (flats <= 0.05) {
    return 0;
  }
  let ring = 0;
  let clear = 1;
  for (const m of MONOLITHS) {
    const d = Math.hypot(u - m.u, v - m.v);
    ring = Math.max(ring, smoothstep01((d - 2.6) / 1.6) * (1 - smoothstep01((d - 11) / 6)));
    clear = Math.min(clear, smoothstep01((d - 2.2) / 1.2));
  }
  return flats * clear * (0.3 + 0.7 * ring) * restFree(x, z);
};

/** The Gilded Shore's shelf drift, thinning toward the rim seal. */
const shoreGate: GateFn = (x, z) => {
  const { u } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  return (
    shoreWeight(u) *
    (1 - smoothstep01((rc - 192) / 14)) *
    restFree(x, z) *
    goldenWeight(x, z)
  );
};

// ─── The build ───────────────────────────────────────────────────────────────

export function buildGoldenCover(finSpots: readonly FinSpot[]): GoldenCoverBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (build: KitBuild | CarpetFieldBuild): void => {
    groups.push(build.group);
    if ("update" in build) {
      updaters.push((timeSec) => build.update(timeSec));
    }
  };

  /** Shard aprons fan out from the fins' own feet (the audit: "the fins
   *  spring from nothing"), thickening along the groove crests. */
  const shardApronGate: GateFn = (x, z) => {
    const { u, v } = spokeOf(x, z);
    const glass = glassWeight(u, v);
    if (glass <= 0.15) {
      return 0;
    }
    let near = 0;
    for (const fin of finSpots) {
      const d = Math.hypot(u - fin.u, v - fin.v);
      near = Math.max(near, 1 - smoothstep01((d - fin.s * 1.1) / 2.6));
    }
    const groove = smoothstep01((Math.sin((u * 0.42 + v * 0.91) * 0.34 + 1.1) - 0.05) / 0.5);
    return glass * restFree(x, z) * Math.min(1, near * 1.1 + groove * 0.22);
  };

  // ── T1: the fine grain ────────────────────────────────────────────────────
  // Ripple-grit, two-tone: the whole desert floor's close-range texture.
  // The grid-honesty rule sends every ripple finer than 8 m HERE, into
  // instances, instead of into the 2.2 m sheet's vertex paint.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.gritCarpet,
      palette: { base: 0xc9ae74, accent: 0xdcc890, shade: 0x8a7080 },
      area: discArea(),
      gate: gritGate,
      ground: seabedHeight,
      count: 5200,
      shapeSet: "grit",
      size: [0.04, 0.11],
      twoTone: true,
      grade: 0.55,
    }),
  );

  // Shell-drift carpet: pale shells stranded in the lees.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.shellDrift,
      palette: { base: 0xe4d6b2, accent: 0xf1e8cc, shade: 0xa08a80 },
      area: discArea(),
      gate: shellGate,
      ground: seabedHeight,
      count: 2600,
      shapeSet: "pebble",
      size: [0.09, 0.22],
      twoTone: true,
      grade: 0.6,
    }),
  );

  // The saddle's pebble runs down the honey channel.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.saddlePebbles,
      palette: { base: 0xbfa87c, accent: 0xd2bc90, shade: 0x86688a },
      area: saddleArea(54, 288, 12),
      gate: saddlePebbleGate,
      ground: seabedHeight,
      count: 680,
      shapeSet: "pebble",
      twoTone: true,
      grade: 0.5,
    }),
  );

  // ── T2: the standing layer ───────────────────────────────────────────────
  // Dune-crest wire-grass (kit blade profile at the desert palette —
  // R12: the near tier is authored clumps, never wedges).
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.duneWire,
      palette: { base: 0xcbb668, tip: 0xeadc92, shade: 0x8a7a60 },
      area: discArea(),
      gate: duneWireGate,
      ground: seabedHeight,
      count: 980,
      profile: "blade",
      size: [0.5, 0.95],
      swayAmp: 0.05,
      sunGlow: true,
    }),
  );

  // The saddle's own wire-grass on the dune shoulders.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.saddleWire,
      palette: { base: 0xc4ae66, tip: 0xe4d48c, shade: 0x847458 },
      area: saddleArea(52, 292, 26),
      gate: saddleWireGate,
      ground: seabedHeight,
      count: 380,
      profile: "blade",
      size: [0.42, 0.8],
      swayAmp: 0.045,
      sunGlow: true,
    }),
  );

  // Lee-garden fronds: the pockets' green-gold hearts (the T2 debut the
  // journey map schedules at u ~80 and every 20–40 m after).
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.leeFronds,
      palette: { base: 0xa8a852, tip: 0xd6ca6e, shade: 0x6e7a4a },
      area: pocketsArea(),
      gate: leeFrondGate,
      ground: seabedHeight,
      count: 430,
      profile: "frond",
      size: [0.3, 0.55],
      swayAmp: 0.04,
      sunGlow: true,
    }),
  );

  // Wrack strewn through the pockets — dry gold curls the current left.
  keep(
    buildDriftDebris({
      seed: SEED ^ FILL_SEEDS.leeWrack,
      palette: { base: 0xb09a6e, shade: 0x7a6880 },
      area: pocketsArea(),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        return pocketDepth(u, v) * restFree(x, z) * goldenWeight(x, z);
      },
      ground: seabedHeight,
      count: 130,
      shapeSet: "wrack",
    }),
  );

  // The drift-lines: wrack runs angled across the road (beat u ~130, and
  // two ocean troughs) — debris strands where the current dropped it.
  for (const [index, line] of DRIFT_LINES.entries()) {
    keep(
      buildDriftDebris({
        seed: SEED ^ (FILL_SEEDS.driftLines + index),
        palette: { base: 0xbca878, shade: 0x807088 },
        area: driftLineArea(line, 5),
        gate: (x, z) => restFree(x, z) * goldenWeight(x, z),
        ground: seabedHeight,
        count: index === 0 ? 54 : 46,
        shapeSet: "wrack",
      }),
    );
  }

  // Terrace salt-lilies: pale cream-violet rosettes on the chasm benches.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.saltLilies,
      palette: { base: 0xd2c2b4, tip: 0xf0e4cf, shade: 0x8d7a92 },
      area: discAreaAt(HOURGLASS.u, HOURGLASS.v, 46),
      gate: saltLilyGate,
      ground: seabedHeight,
      count: 250,
      profile: "frond",
      size: [0.24, 0.44],
      swayAmp: 0.03,
    }),
  );

  // The lily bench: one authored terrace (u 435, v 27 — the close pose's
  // subject) carries a concentrated stand of the same salt-lily growth,
  // the verdant fill's saddle-mouth-stand lesson: a global scatter
  // cannot promise a close lens anything; a small authored drift can.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.lilyBench,
      palette: { base: 0xd2c2b4, tip: 0xf0e4cf, shade: 0x8d7a92 },
      area: discAreaAt(435, 27, 4.5),
      gate: (x, z) => restFree(x, z) * lensFree(x, z),
      ground: seabedHeight,
      count: 42,
      profile: "frond",
      size: [0.24, 0.42],
      swayAmp: 0.03,
      looseShare: 0.6,
    }),
  );

  // Oasis cushion bushes: the hollows' rich understory (R12's opt-in
  // fronds and berry knots — the region re-pass licence, spent here).
  keep(
    buildBushBank({
      seed: SEED ^ FILL_SEEDS.oasisBushes,
      palette: { base: 0xb0a050, tip: 0xd8c86a, shade: 0x6a6a44, accent: 0xd8925a },
      area: discAreaAt(528, -52, 32),
      gate: oasisBushGate,
      ground: seabedHeight,
      count: 40,
      lobes: 6,
      fronds: 4,
      accents: 5,
    }),
  );

  // Fallen palm fronds at the trunks' feet.
  keep(
    buildDriftDebris({
      seed: SEED ^ FILL_SEEDS.fallenFronds,
      palette: { base: 0xa8a05c, shade: 0x6e7050 },
      area: discAreaAt(528, -52, 32),
      gate: fallenFrondGate,
      ground: seabedHeight,
      count: 60,
      shapeSet: "wrack",
    }),
  );

  // Shard aprons: fracture ground under the glass fins.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.shardAprons,
      palette: { base: 0xcfe2d4, accent: 0xeafaf0, shade: 0x7e9a8c },
      area: discAreaAt(395, -78, 64),
      gate: shardApronGate,
      ground: seabedHeight,
      count: 340,
      shapeSet: "shard",
      size: [0.09, 0.26],
      twoTone: true,
      grade: 0.6,
    }),
  );

  // Singing stones: split stones scattered around the monolith country.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.singingStones,
      palette: { base: 0x9a7c6a, shade: 0x6e5476 },
      area: discAreaAt(528, 84, 76),
      gate: singingStoneGate,
      ground: seabedHeight,
      count: 90,
      shapeSet: "split",
      size: [0.28, 0.62],
      grade: 0.8,
    }),
  );

  // ── The Gilded Shore's decrescendo ───────────────────────────────────────
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.shorePebbles,
      palette: { base: 0xd6c49a, accent: 0xe8dcbc, shade: 0x9a8698 },
      area: discAreaAt(600, 10, 90),
      gate: shoreGate,
      ground: seabedHeight,
      count: 800,
      shapeSet: "pebble",
      size: [0.08, 0.2],
      twoTone: true,
      grade: 0.45,
    }),
  );
  keep(
    buildDriftDebris({
      seed: SEED ^ FILL_SEEDS.shoreWrack,
      palette: { base: 0xc2ac80, shade: 0x847492 },
      area: discAreaAt(600, 10, 88),
      gate: shoreGate,
      ground: seabedHeight,
      count: 110,
      shapeSet: "wrack",
    }),
  );
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.shoreTufts,
      palette: { base: 0xd4c68e, tip: 0xeee2b6, shade: 0x9a8a74 },
      area: discAreaAt(600, 10, 88),
      gate: (x, z) => shoreGate(x, z) * lensFree(x, z),
      ground: seabedHeight,
      count: 300,
      profile: "blade",
      size: [0.4, 0.72],
      swayAmp: 0.04,
      sunGlow: true,
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
