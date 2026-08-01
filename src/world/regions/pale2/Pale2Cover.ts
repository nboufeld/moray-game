import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBushBank } from "../kit/BushBank";
import { buildCarpetField, type CarpetFieldBuild } from "../kit/CarpetField";
import { buildGroundLitter } from "../kit/GroundLitter";
import { buildScreeApron, type ScreeAnchor } from "../kit/ScreeApron";
import {
  CENTER_X,
  CENTER_Z,
  LAMP,
  LAMP_BASIN,
  POOLS,
  basinWeight,
  channelCenter,
  channelHalf,
  combMound,
  lumen,
  pale2Weight,
  roadCenter,
  spokeOf,
  stillnessGate,
  worldOf,
} from "./Pale2Terrain";

/**
 * The Lantern Combs' T1/T2 cover — the kit consumed with the region's
 * own light in the palettes (warm paper-whites and violet shadows,
 * never grey mush — the Bone Meadows' round-3 lesson pre-paid), and
 * every gate through the shared stillness function so the three
 * registered rests hold by construction.
 *
 * The fill voice: PAPER SWARD AND PEARL GRIT. The galleries carry a
 * warm gold-white blade sward that thickens with `lumen`; the road is
 * paced by its own blade band and pearl pebbles; the pool rims and the
 * basin wear frond rosettes in the moonmilk and lamp registers; the
 * far rim wears the F-R3 flank hem; and the litter runs two-tone with
 * genuine violet-bone so half of every run draws against the paper.
 */

const SEED = SEEDS.regionPale2;

const ground = (x: number, z: number): number => seabedHeight(x, z);

/** Free lanes: the walk line stays bare (trodden, not neglected). */
function roadFree(u: number, v: number): number {
  const d = Math.abs(v - roadCenter(u));
  return d < 2.2 ? 0 : d < 4 ? 0.4 : 1;
}

/** The pool bowls stay pearl-bare inside their lips. */
function poolFree(u: number, v: number): number {
  for (const pool of POOLS) {
    if (Math.hypot(u - pool.u, v - pool.v) < pool.radius * 0.95) {
      return 0;
    }
  }
  return 1;
}

/** The Lamp keeps a clear aisle around its foot. */
function lampFree(u: number, v: number): number {
  return Math.hypot(u - LAMP.u, v - LAMP.v) < 8.5 ? 0 : 1;
}

/** The shared base gate every scatter multiplies. */
function baseGate(x: number, z: number): number {
  const w = pale2Weight(x, z);
  if (w === 0) {
    return 0;
  }
  const { u, v } = spokeOf(x, z);
  return Math.sqrt(w) * stillnessGate(u, v) * roadFree(u, v) * poolFree(u, v) * lampFree(u, v);
}

export interface Pale2CoverBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

export function buildPale2Cover(
  screeAnchors: readonly ScreeAnchor[],
): Pale2CoverBuild {
  const groups: Group[] = [];
  const carpets: CarpetFieldBuild[] = [];
  const area = { center: [CENTER_X, CENTER_Z] as [number, number], radius: 196 };

  // ── T1 carpets ─────────────────────────────────────────────────────

  // The gallery sward: the country's voice — warm gold-white blades
  // over violet roots, thickening as the lamp light nears.
  const sward = buildCarpetField({
    seed: SEED ^ 0x3001,
    palette: { base: 0xd9c48c, tip: 0xf0e2b4, shade: 0x8d78ab },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      if (u < 800) {
        return 0;
      }
      return g * (0.4 + 0.6 * lumen(u, v)) * (1 - basinWeight(u, v) * 0.5);
    },
    ground,
    count: 4200,
    profile: "blade",
    size: [0.34, 0.66],
    swayAmp: 0.05,
    sunGlow: true,
    looseShare: 0.45,
  });
  carpets.push(sward);

  // The road band: pearl-gold blades pacing the spine from the
  // threshold to the Pearl Steps (road-as-place; the lane itself
  // stays trodden-bare via roadFree).
  const roadStations: [number, number][] = [];
  for (let u = 645; u <= 1120; u += 18) {
    const { x, z } = worldOf(u, roadCenter(u));
    roadStations.push([x, z]);
  }
  const roadBlades = buildCarpetField({
    seed: SEED ^ 0x3002,
    palette: { base: 0xccbd94, tip: 0xeadfba, shade: 0x9a8bb0 },
    area: { polyline: roadStations, width: 15 },
    gate: baseGate,
    ground,
    count: 1500,
    profile: "blade",
    size: [0.3, 0.6],
    swayAmp: 0.05,
    sunGlow: true,
    looseShare: 0.5,
  });
  carpets.push(roadBlades);

  // The threshold milk: pale-1's paper light carried across the
  // overlap, dying as our warmer key takes over (20+ m lerp by hand).
  const milkStations: [number, number][] = [];
  for (let u = 640; u <= 780; u += 14) {
    const { x, z } = worldOf(u, channelCenter(u));
    milkStations.push([x, z]);
  }
  const thresholdMilk = buildCarpetField({
    seed: SEED ^ 0x3003,
    palette: { base: 0xd8d4c6, tip: 0xece7d8, shade: 0xa79ec0 },
    area: { polyline: milkStations, width: 22 },
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u } = spokeOf(x, z);
      return g * (1 - (u - 640) / 150);
    },
    ground,
    count: 700,
    profile: "blade",
    size: [0.26, 0.5],
    swayAmp: 0.04,
    sunGlow: true,
    looseShare: 0.5,
  });
  carpets.push(thresholdMilk);

  // The winnow banks: moss on the descent's shoulders; the channel
  // lane and the Winnow Shadow stay bare via the shared gates.
  const winnowStations: [number, number][] = [];
  for (let u = 745; u <= 830; u += 10) {
    const { x, z } = worldOf(u, channelCenter(u));
    winnowStations.push([x, z]);
  }
  const winnowMoss = buildCarpetField({
    seed: SEED ^ 0x3004,
    palette: { base: 0xc6b490, tip: 0xe4d6ae, shade: 0x8d78ab },
    area: { polyline: winnowStations, width: 30 },
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      // Banks only: the slot floor is the road and the rest.
      const inLane = 1 - Math.min(1, Math.max(0, (Math.abs(v - channelCenter(u)) - channelHalf(u) + 2) / 3));
      return g * (1 - inLane);
    },
    ground,
    count: 800,
    profile: "blade",
    size: [0.3, 0.58],
    swayAmp: 0.04,
    sunGlow: true,
  });
  carpets.push(winnowMoss);

  // The pool-rim fronds: moonmilk rosettes ringing the three lit
  // bowls (the Still Pool's rest keeps its own rim bare).
  const poolFronds = buildCarpetField({
    seed: SEED ^ 0x3005,
    palette: { base: 0xaecfba, tip: 0xd8ecdc, shade: 0x7a86a8 },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      let ring = 0;
      for (const pool of POOLS) {
        if (pool.rest) {
          continue;
        }
        const d = Math.hypot(u - pool.u, v - pool.v) / pool.radius;
        if (d > 0.95 && d < 1.9) {
          ring = Math.max(ring, 1 - Math.abs(d - 1.35) / 0.55);
        }
      }
      return g * ring;
    },
    ground,
    count: 850,
    profile: "frond",
    size: [0.28, 0.52],
    swayAmp: 0.04,
  });
  carpets.push(poolFronds);

  // The basin gardens: warm rosettes down the crater slopes among the
  // lantern anemones — the lamp feeding its own garden.
  const basinFronds = buildCarpetField({
    seed: SEED ^ 0x3006,
    palette: { base: 0xd2b184, tip: 0xf0d9a8, shade: 0x8d78ab },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      return g * basinWeight(u, v);
    },
    ground,
    count: 1400,
    profile: "frond",
    size: [0.3, 0.56],
    swayAmp: 0.04,
    sunGlow: true,
  });
  carpets.push(basinFronds);

  // The rim hem (F-R3): a standing band at the disc's edge so
  // rim-facing sweep cones meet knee-high paper blades, not bare fade.
  const rimHem = buildCarpetField({
    seed: SEED ^ 0x3007,
    palette: { base: 0xd6cbae, tip: 0xefe6cc, shade: 0x8d78ab },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
      if (rc < 150 || rc > 205) {
        return 0;
      }
      return g * (1 - Math.abs(rc - 178) / 30);
    },
    ground,
    count: 900,
    profile: "blade",
    size: [0.38, 0.74],
    swayAmp: 0.05,
    sunGlow: true,
    looseShare: 0.5,
  });
  carpets.push(rimHem);

  // The Pearl Steps' tufts: short pearl grass on the rising terraces.
  const stepTufts = buildCarpetField({
    seed: SEED ^ 0x3008,
    palette: { base: 0xd4dcc8, tip: 0xe9ecdf, shade: 0x9a8bb0 },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      if (u < 1055 || u > 1150) {
        return 0;
      }
      return g * (1 - basinWeight(u, v));
    },
    ground,
    count: 650,
    profile: "tuft",
    size: [0.24, 0.5],
    swayAmp: 0.04,
  });
  carpets.push(stepTufts);

  // ── T1 litter ──────────────────────────────────────────────────────

  // Pearl grit region-wide, two-tone with genuine violet-bone (the
  // camouflage lesson: half the run must draw against the paper).
  const grit = buildGroundLitter({
    seed: SEED ^ 0x3010,
    palette: { base: 0xe7e0cc, shade: 0x8d78ab },
    area,
    gate: baseGate,
    ground,
    count: 2200,
    shapeSet: "grit",
    size: [0.03, 0.09],
    twoTone: true,
    grade: 0.4,
  });
  groups.push(grit.group as Group);

  // Comb shards drifting at the fin feet — the combs shed.
  const shards = buildGroundLitter({
    seed: SEED ^ 0x3011,
    palette: { base: 0xe2dcd0, shade: 0x7d6b96 },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      return g * Math.min(1, combMound(u, v) * 1.6);
    },
    ground,
    count: 1100,
    shapeSet: "shard",
    size: [0.09, 0.26],
    twoTone: true,
    grade: 0.5,
  });
  groups.push(shards.group as Group);

  // Split stones pacing the gallery floors — formed foreground rock.
  const splits = buildGroundLitter({
    seed: SEED ^ 0x3012,
    palette: { base: 0xe9e3d2, shade: 0x8d78ab },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u } = spokeOf(x, z);
      return u > 800 ? g : 0;
    },
    ground,
    count: 240,
    shapeSet: "split",
    size: [0.12, 0.3],
    grade: 0.6,
  });
  groups.push(splits.group as Group);

  // ── T2 scree + bushes ──────────────────────────────────────────────

  // Aprons at every fin foot and needle — things grow FROM somewhere.
  const scree = buildScreeApron({
    seed: SEED ^ 0x3020,
    palette: { base: 0xeae2ce, shade: 0x7d6b96 },
    ground,
    anchors: screeAnchors,
    slabsPerAnchor: 7,
  });
  groups.push(scree.group as Group);

  // Paper bushes: pale cushions with gold tips and blush bud knots.
  const paperBushes = buildBushBank({
    seed: SEED ^ 0x3021,
    palette: { base: 0xd8c9a8, tip: 0xf2e6c8, shade: 0x8d78ab, accent: 0xf0b6c4 },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      return u > 795 && u < 1090 ? g * (1 - basinWeight(u, v) * 0.6) : 0;
    },
    ground,
    count: 56,
    lobes: 6,
    fronds: 4,
    accents: 4,
  });
  groups.push(paperBushes.group as Group);

  // Lamp-gold bushes cresting the basin rim — the garden's edge.
  const goldBushes = buildBushBank({
    seed: SEED ^ 0x3022,
    palette: { base: 0xd9b581, tip: 0xf0d9a8, shade: 0x8d78ab, accent: 0xeec98e },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      const d = Math.hypot(u - LAMP_BASIN.u, v - LAMP_BASIN.v);
      return d > 40 && d < 62 ? g : 0;
    },
    ground,
    count: 26,
    lobes: 6,
    fronds: 5,
    accents: 5,
  });
  groups.push(goldBushes.group as Group);

  for (const carpet of carpets) {
    groups.push(carpet.group as Group);
  }

  return {
    groups,
    update(timeSec: number): void {
      for (const carpet of carpets) {
        carpet.update(timeSec);
      }
    },
  };
}
