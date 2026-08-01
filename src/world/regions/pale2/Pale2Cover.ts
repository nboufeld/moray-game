import { Color, Mesh, type Group } from "three";
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
  // Round 3 (the sweep's one systemic failure): the counts and gates
  // below were keyed to the road spine and the broad flanks read bare
  // in 7 of 12 sweep cones. The sward is the region's base cover —
  // count up half again, the u-door widened, the shade lifted ABOVE
  // the ground's value (the verdant-2 lesson: blades must sit lighter
  // than the warm ground they stand on).
  // Round 4: the final density step (r3 sweep still failed five flank
  // cones on the ground layer) — count to 10000, shade a step lighter
  // still for the range read.
  const sward = buildCarpetField({
    seed: SEED ^ 0x3001,
    palette: { base: 0xe6d7ac, tip: 0xf7edc9, shade: 0xd4cbe2 },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      if (u < 790) {
        return 0;
      }
      return g * (0.6 + 0.4 * lumen(u, v)) * (1 - basinWeight(u, v) * 0.5);
    },
    ground,
    count: 10000,
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
    palette: { base: 0xe0d6b2, tip: 0xf2ead0, shade: 0xc7bbd8 },
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
    palette: { base: 0xe8e4d6, tip: 0xf5f1e4, shade: 0xcdc5de },
    area: { polyline: milkStations, width: 26 },
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u } = spokeOf(x, z);
      return g * (1 - (u - 640) / 150);
    },
    ground,
    count: 1250,
    profile: "blade",
    size: [0.28, 0.54],
    swayAmp: 0.04,
    // Round 3: sunGlow off — against the milk backlight the warm tips
    // rendered as wine-crimson sprigs (value below the paper).
    sunGlow: false,
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
    palette: { base: 0xdccdaa, tip: 0xf0e3c0, shade: 0xc7bbd8 },
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
    palette: { base: 0xc6e2d0, tip: 0xe6f5e9, shade: 0xbdc4d8 },
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
    palette: { base: 0xe6cb9e, tip: 0xf8e6bc, shade: 0xd0c2da },
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
  // Round 3: the band widened INWARD (rc 150 → 132) — sweep cones
  // standing on the flank band inside the old hem met bare fade.
  // Round 4: inward again (118) and half as dense again — 01/03/05
  // still stood on thin ground.
  const rimHem = buildCarpetField({
    seed: SEED ^ 0x3007,
    palette: { base: 0xe6ddc4, tip: 0xf5eeda, shade: 0xd4cbe2 },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
      if (rc < 118 || rc > 205) {
        return 0;
      }
      return g * (1 - Math.abs(rc - 162) / 46);
    },
    ground,
    count: 2200,
    profile: "blade",
    size: [0.38, 0.74],
    swayAmp: 0.05,
    sunGlow: true,
    looseShare: 0.5,
  });
  carpets.push(rimHem);

  // The Pearl Steps' tufts: short pearl grass on the rising terraces.
  // Round 4: the steps' band widened and near-tripled — sweep 08 (the
  // steps' north flank) was the sweep's one naked down-shot.
  const stepTufts = buildCarpetField({
    seed: SEED ^ 0x3008,
    palette: { base: 0xe2e8d8, tip: 0xf1f3e8, shade: 0xc6ccdc },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      if (u < 1040 || u > 1155) {
        return 0;
      }
      return g * (1 - basinWeight(u, v));
    },
    ground,
    count: 1700,
    profile: "tuft",
    size: [0.24, 0.5],
    swayAmp: 0.04,
  });
  carpets.push(stepTufts);

  // ── T1 litter ──────────────────────────────────────────────────────

  // Pearl pebbles pacing the road itself — the walk line's own voice.
  const roadPebbles = buildGroundLitter({
    seed: SEED ^ 0x3013,
    palette: { base: 0xf0ead9, shade: 0xb9a9d2 },
    area: { polyline: roadStations, width: 8 },
    gate: (x, z) => {
      const w = pale2Weight(x, z);
      if (w === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      // The pebbles may pace the trodden lane the blades avoid.
      return Math.sqrt(w) * stillnessGate(u, v) * poolFree(u, v) * lampFree(u, v);
    },
    ground,
    count: 900,
    shapeSet: "pebble",
    size: [0.05, 0.14],
    grade: 0.5,
  });
  groups.push(roadPebbles.group);

  // Pearl grit region-wide, two-tone with genuine violet-bone (the
  // camouflage lesson: half the run must draw against the paper).
  const grit = buildGroundLitter({
    seed: SEED ^ 0x3010,
    palette: { base: 0xf0ead8, shade: 0xb9a9d2 },
    area,
    gate: baseGate,
    ground,
    count: 4200,
    shapeSet: "grit",
    size: [0.03, 0.09],
    twoTone: true,
    grade: 0.4,
  });
  groups.push(grit.group as Group);

  // Comb shards drifting at the fin feet — the combs shed.
  const shards = buildGroundLitter({
    seed: SEED ^ 0x3011,
    palette: { base: 0xefe9dc, shade: 0xb8a6d2 },
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
    count: 1400,
    shapeSet: "shard",
    size: [0.09, 0.26],
    twoTone: true,
    grade: 0.5,
  });
  groups.push(shards.group as Group);

  // Split stones pacing the gallery floors — formed foreground rock.
  // Round 3: sized down and the grade eased — the r2 splits upsized
  // to ~0.57 m boxes whose toon-dark faces read as violet slabs.
  const splits = buildGroundLitter({
    seed: SEED ^ 0x3012,
    palette: { base: 0xf2ecdc, shade: 0xd6cbe4 },
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
    size: [0.1, 0.22],
    grade: 0.4,
  });
  groups.push(splits.group as Group);

  // ── T2 scree + bushes ──────────────────────────────────────────────

  // Aprons at every fin foot and needle — things grow FROM somewhere.
  const scree = buildScreeApron({
    seed: SEED ^ 0x3020,
    palette: { base: 0xf0e9d6, shade: 0xb9a9d2 },
    ground,
    anchors: screeAnchors,
    slabsPerAnchor: 7,
  });
  groups.push(scree.group as Group);

  // Paper bushes: pale cushions with gold tips and blush bud knots.
  const paperBushes = buildBushBank({
    seed: SEED ^ 0x3021,
    palette: { base: 0xe8dcbe, tip: 0xf6ecd4, shade: 0xc7bbd8, accent: 0xf0b6c4 },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      return u > 790 && u < 1120 ? g * (1 - basinWeight(u, v) * 0.6) : 0;
    },
    ground,
    count: 74,
    lobes: 6,
    fronds: 4,
    accents: 4,
  });
  groups.push(paperBushes.group as Group);

  // Lamp-gold bushes cresting the basin rim — the garden's edge.
  const goldBushes = buildBushBank({
    seed: SEED ^ 0x3022,
    palette: { base: 0xe8cb9c, tip: 0xf6e2b8, shade: 0xc7bbd8, accent: 0xeec98e },
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

  // The paper lift (the verdant-2 dusk-lift precedent, keyed for THIS
  // region's light): under the milk the toon ramp crushes smallwork a
  // full value below its hex, and blades keyed for paper render as
  // dark sprigs (round 1). A soft warm floor on every carpet and bush
  // material keeps the shadow side a colour. Region-side tweak only —
  // `createToonMaterial` mints per-build materials, nothing leaks.
  const lift = new Color(0x4a4030);
  for (const group of groups) {
    group.traverse((node) => {
      if (!(node instanceof Mesh)) {
        return;
      }
      const material = node.material as {
        type?: string;
        emissive?: Color;
        emissiveIntensity?: number;
      };
      if (material.type === "MeshToonMaterial" && material.emissive) {
        material.emissive.copy(lift);
        material.emissiveIntensity = 0.5;
      }
    });
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
