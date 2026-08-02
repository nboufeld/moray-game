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
  DAYSPRING,
  MERE,
  blushWeight,
  channelCenter,
  channelHalf,
  dawn,
  fontMound,
  mereWeight,
  doorstepWeight,
  pale3Weight,
  roadCenter,
  spokeOf,
  stillnessGate,
  worldOf,
} from "./Pale3Terrain";

/**
 * The Dayspring's T1/T2 cover — the kit consumed with the region's own
 * light in the palettes (warm paper-whites and violet shadows, never
 * grey mush — the Bone Meadows' round-3 lesson, third generation), and
 * every gate through the shared stillness function so the three
 * registered rests hold by construction. The pale province forbids
 * `dappleSheet` (MASTER §5) — nothing here touches it.
 *
 * The fill voice: PAPER SWARD, MORNING GOLD AND DAWN-ROSE. The vale
 * carries a warm gold-white blade sward that thickens with `dawn`; the
 * Blushfields carry the province's blush as a rose frond field at
 * last; the road is paced by its own blade band and pearl pebbles; the
 * mere wears a frond ring OUTSIDE its rest radius; the terraces wear
 * short pearl tufts; the far rim wears the F-R3 flank hem; and the
 * litter runs two-tone with genuine violet-bone so half of every run
 * draws against the paper.
 */

const SEED = SEEDS.regionPale3;

const ground = (x: number, z: number): number => seabedHeight(x, z);

/** Free lanes: the walk line stays bare (trodden, not neglected). */
function roadFree(u: number, v: number): number {
  const d = Math.abs(v - roadCenter(u));
  return d < 2.2 ? 0 : d < 4 ? 0.4 : 1;
}

/** The mere bowl stays glass-bare inside its lip (rest, plus margin). */
function mereFree(u: number, v: number): number {
  return Math.hypot(u - MERE.u, v - MERE.v) < MERE.radius * 0.95 ? 0 : 1;
}

/** The Dayspring keeps a clear apron at its own foot. */
function pearlFree(u: number, v: number): number {
  return Math.hypot(u - DAYSPRING.u, v - DAYSPRING.v) < DAYSPRING.radius + 2 ? 0 : 1;
}

/** The shared base gate every scatter multiplies. */
function baseGate(x: number, z: number): number {
  const w = pale3Weight(x, z);
  if (w === 0) {
    return 0;
  }
  const { u, v } = spokeOf(x, z);
  return Math.sqrt(w) * stillnessGate(u, v) * roadFree(u, v) * mereFree(u, v) * pearlFree(u, v);
}

export interface Pale3CoverBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

export function buildPale3Cover(screeAnchors: readonly ScreeAnchor[]): Pale3CoverBuild {
  const groups: Group[] = [];
  const carpets: CarpetFieldBuild[] = [];
  const area = { center: [CENTER_X, CENTER_Z] as [number, number], radius: 196 };
  // The rim bands sample past the shared disc (the Combs' round-5
  // sampling bug, pre-paid: a hem gate reaching rc 212 can never fill
  // from a 196 m sample area).
  const rimArea = { center: [CENTER_X, CENTER_Z] as [number, number], radius: 214 };

  // ── T1 carpets ─────────────────────────────────────────────────────

  // The vale sward: the country's voice — warm gold-white blades over
  // violet-white roots, thickening as the morning nears. Counts and
  // shade hexes start where the Combs' seven rounds ENDED (10k, shades
  // above the ground's value) — their flank lesson, not re-learned.
  // Round 2: count up, the u-door widened and the blades sized up —
  // r1's near fields at the descent's foot read thin.
  const sward = buildCarpetField({
    seed: SEED ^ 0x3001,
    palette: { base: 0xe8dab0, tip: 0xf8efcc, shade: 0xe0d8ec },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      if (u < 1302) {
        return 0;
      }
      return g * (0.55 + 0.45 * dawn(u, v)) * (1 - blushWeight(u, v) * 0.6);
    },
    ground,
    count: 9500,
    profile: "blade",
    size: [0.36, 0.7],
    swayAmp: 0.05,
    sunGlow: true,
    looseShare: 0.45,
  });
  carpets.push(sward);

  // The Blushfields: dawn-rose fronds — the province's blush, a field
  // at last (value HIGH, red above green; rose over paper, not candy).
  // Round 2: the sample area becomes a POLYLINE band down the field's
  // own spine (a whole-disc sample area starves a flank band — the
  // Combs' round-5/6 sampling lesson, applied before the sweep asks),
  // the count up half again, the fronds sized up and the palette a
  // value lighter (r1's fronds read as dark sprigs). 3880, not 4200:
  // the R12 triangle cap billed the difference (60 tris a frond).
  const blushStations: [number, number][] = [];
  for (let u = 1368; u <= 1552; u += 16) {
    const { x, z } = worldOf(u, -72);
    blushStations.push([x, z]);
  }
  // Round 3: sunGlow OFF (warm tips render amber-crimson against the
  // milk — the Combs' round-3 finding, re-proven on this field) and
  // the palette keyed pale ROSE, not clay.
  const blushFronds = buildCarpetField({
    seed: SEED ^ 0x3002,
    palette: { base: 0xf4d8d0, tip: 0xfcece6, shade: 0xdcc8de },
    area: { polyline: blushStations, width: 72 },
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      return g * blushWeight(u, v);
    },
    ground,
    count: 3880,
    profile: "frond",
    size: [0.32, 0.6],
    swayAmp: 0.04,
    sunGlow: false,
  });
  carpets.push(blushFronds);

  // The road band: pearl-gold blades pacing the Sun Road from the
  // threshold to the Dawn Steps (the lane itself stays trodden-bare
  // via roadFree).
  const roadStations: [number, number][] = [];
  for (let u = 1140; u <= 1620; u += 18) {
    const { x, z } = worldOf(u, roadCenter(u));
    roadStations.push([x, z]);
  }
  const roadBlades = buildCarpetField({
    seed: SEED ^ 0x3003,
    palette: { base: 0xe2d8b4, tip: 0xf4ecd2, shade: 0xd8cee6 },
    area: { polyline: roadStations, width: 15 },
    gate: baseGate,
    ground,
    count: 1600,
    profile: "blade",
    size: [0.3, 0.6],
    swayAmp: 0.05,
    sunGlow: true,
    looseShare: 0.5,
  });
  carpets.push(roadBlades);

  // The threshold milk: the Combs' pearl light carried across the
  // overlap, dying as our warmer key takes over (20+ m lerp by hand).
  const milkStations: [number, number][] = [];
  for (let u = 1136; u <= 1280; u += 14) {
    const { x, z } = worldOf(u, channelCenter(u));
    milkStations.push([x, z]);
  }
  // Round 2: thicker and warmed above the ground — r1's threshold
  // blades read cool-dark against the tan shelf.
  const thresholdMilk = buildCarpetField({
    seed: SEED ^ 0x3004,
    palette: { base: 0xefebe0, tip: 0xf8f5ec, shade: 0xd8d2e6 },
    area: { polyline: milkStations, width: 26 },
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u } = spokeOf(x, z);
      return g * (1 - (u - 1136) / 150);
    },
    ground,
    count: 1700,
    profile: "blade",
    size: [0.3, 0.58],
    swayAmp: 0.04,
    // Against the milk backlight, warm sunGlow tips render as crimson
    // sprigs (the Combs' round-3 finding) — off on the threshold.
    sunGlow: false,
    looseShare: 0.5,
  });
  carpets.push(thresholdMilk);

  // The Matins banks: moss on the descent's shoulders; the channel
  // lane and the Undawn stay bare via the shared gates.
  const matinsStations: [number, number][] = [];
  for (let u = 1245; u <= 1330; u += 10) {
    const { x, z } = worldOf(u, channelCenter(u));
    matinsStations.push([x, z]);
  }
  const matinsMoss = buildCarpetField({
    seed: SEED ^ 0x3005,
    palette: { base: 0xdecfab, tip: 0xf1e5c2, shade: 0xd8cee6 },
    area: { polyline: matinsStations, width: 30 },
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      const inLane =
        1 - Math.min(1, Math.max(0, (Math.abs(v - channelCenter(u)) - channelHalf(u) + 2) / 3));
      return g * (1 - inLane);
    },
    ground,
    count: 800,
    profile: "blade",
    size: [0.3, 0.58],
    swayAmp: 0.04,
    sunGlow: true,
  });
  carpets.push(matinsMoss);

  // The mere ring: pearl-seafoam fronds ringing the mirror from
  // OUTSIDE its rest radius — the stillness is framed, never filled.
  // Round 2: sampled along the ring itself (the disc-area scatter
  // starved a 2%-of-disc band — the Combs' sampling arithmetic) and
  // the count up.
  const mereStations: [number, number][] = [];
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const { x, z } = worldOf(MERE.u + Math.cos(a) * 34, MERE.v + Math.sin(a) * 34);
    mereStations.push([x, z]);
  }
  const mereFronds = buildCarpetField({
    seed: SEED ^ 0x3006,
    palette: { base: 0xc8e4d2, tip: 0xe8f6ea, shade: 0xc6cede },
    area: { polyline: mereStations, width: 16 },
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      const d = Math.hypot(u - MERE.u, v - MERE.v);
      if (d < 27 || d > 44) {
        return 0;
      }
      return g * (1 - Math.abs(d - 34) / 11);
    },
    ground,
    count: 900,
    profile: "frond",
    size: [0.3, 0.56],
    swayAmp: 0.04,
  });
  carpets.push(mereFronds);

  // The terrace tufts: short pearl grass on the Dawn Steps — mostly
  // loose (clump-led scatter starves narrow bands; the Combs' round-6
  // finding, pre-paid).
  const terraceTufts = buildCarpetField({
    seed: SEED ^ 0x3007,
    // Rounds 2+3: lifted twice — the tufts read violet-dark at range.
    palette: { base: 0xeef0e2, tip: 0xf6f8ec, shade: 0xdce0ea },
    area: rimArea,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      if (u < 1550 || u > 1668) {
        return 0;
      }
      return g * (1 - mereWeight(u, v)) * (1 - doorstepWeight(u, v));
    },
    ground,
    count: 2300,
    profile: "tuft",
    size: [0.26, 0.52],
    swayAmp: 0.04,
    looseShare: 0.75,
  });
  carpets.push(terraceTufts);

  // The rim hem (F-R3): a standing band at the disc's edge so
  // rim-facing sweep cones meet knee-high paper blades, not bare fade.
  // The band starts wide and dense — the Combs paid four rounds for
  // these numbers.
  const rimHem = buildCarpetField({
    seed: SEED ^ 0x3008,
    palette: { base: 0xe8dfc6, tip: 0xf6f0dc, shade: 0xe0d8ec },
    area: rimArea,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
      if (rc < 118 || rc > 212) {
        return 0;
      }
      return g * (1 - Math.abs(rc - 165) / 55);
    },
    ground,
    count: 2400,
    profile: "blade",
    size: [0.38, 0.74],
    swayAmp: 0.05,
    sunGlow: true,
    looseShare: 0.5,
  });
  carpets.push(rimHem);

  // ── T1 litter ──────────────────────────────────────────────────────

  // Pearl pebbles pacing the Sun Road itself — the walk line's voice.
  const roadPebbles = buildGroundLitter({
    seed: SEED ^ 0x3013,
    palette: { base: 0xf0ead9, shade: 0xc8badc },
    area: { polyline: roadStations, width: 8 },
    gate: (x, z) => {
      const w = pale3Weight(x, z);
      if (w === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      // The pebbles may pace the trodden lane the blades avoid.
      return Math.sqrt(w) * stillnessGate(u, v) * mereFree(u, v) * pearlFree(u, v);
    },
    ground,
    count: 950,
    shapeSet: "pebble",
    size: [0.06, 0.16],
    twoTone: true,
    grade: 0.5,
  });
  groups.push(roadPebbles.group);

  // Pearl grit region-wide, two-tone with genuine violet-bone (the
  // camouflage lesson: half the run must draw against the paper).
  // Round 2: shades up a step — the violet-bone read near-black at range.
  const grit = buildGroundLitter({
    seed: SEED ^ 0x3010,
    palette: { base: 0xf0ead8, shade: 0xc8badc },
    area,
    gate: baseGate,
    ground,
    count: 3800,
    shapeSet: "grit",
    size: [0.03, 0.09],
    twoTone: true,
    grade: 0.35,
  });
  groups.push(grit.group as Group);

  // Font shards drifting at the tower feet — the fonts shed.
  const shards = buildGroundLitter({
    seed: SEED ^ 0x3011,
    palette: { base: 0xefe9dc, shade: 0xc8b8dc },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      return g * Math.min(1, fontMound(u, v) * 1.6);
    },
    ground,
    count: 1300,
    shapeSet: "shard",
    size: [0.09, 0.26],
    twoTone: true,
    grade: 0.35,
  });
  groups.push(shards.group as Group);

  // Split stones pacing the vale floors — formed foreground rock,
  // sized small (the Combs' violet-box lesson).
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
      return u > 1310 ? g : 0;
    },
    ground,
    count: 240,
    shapeSet: "split",
    // Round 3: sized down — at [0.1, 0.22] the two-tone halves read
    // as purple luggage in the close frames.
    size: [0.08, 0.15],
    grade: 0.35,
  });
  groups.push(splits.group as Group);

  // ── T2 scree + bushes ──────────────────────────────────────────────

  // Aprons at every font foot — things grow FROM somewhere.
  const scree = buildScreeApron({
    seed: SEED ^ 0x3020,
    palette: { base: 0xf0e9d6, shade: 0xd6cae6 },
    ground,
    anchors: screeAnchors,
    slabsPerAnchor: 7,
  });
  groups.push(scree.group as Group);

  // Paper bushes: pale cushions with gold tips and blush bud knots.
  // Rounds 2+3: bases up twice — the cushions read as mud lumps at
  // range; the accents brightened to read as BUDS, not bruises.
  const paperBushes = buildBushBank({
    seed: SEED ^ 0x3021,
    palette: { base: 0xf6efdc, tip: 0xfdf8ea, shade: 0xdcd4e8, accent: 0xf8c8d4 },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      return u > 1310 && u < 1580 ? g * (1 - blushWeight(u, v) * 0.5) : 0;
    },
    ground,
    count: 64,
    lobes: 6,
    fronds: 4,
    accents: 4,
  });
  groups.push(paperBushes.group as Group);

  // Rose bushes in the Blushfields — the dawn's own scrub.
  const roseBushes = buildBushBank({
    seed: SEED ^ 0x3022,
    palette: { base: 0xf6dcd2, tip: 0xfceee6, shade: 0xdccce2, accent: 0xf8c6d0 },
    area,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      return g * blushWeight(u, v);
    },
    ground,
    count: 26,
    lobes: 6,
    fronds: 5,
    accents: 6,
  });
  groups.push(roseBushes.group as Group);

  // Morning-gold bushes cresting the Dawn Steps — the terraces' edge.
  const goldBushes = buildBushBank({
    seed: SEED ^ 0x3023,
    palette: { base: 0xf6e6c4, tip: 0xfcf2d8, shade: 0xdcd4e8, accent: 0xfae4b8 },
    area: rimArea,
    gate: (x, z) => {
      const g = baseGate(x, z);
      if (g === 0) {
        return 0;
      }
      const { u, v } = spokeOf(x, z);
      return u > 1556 && u < 1650 ? g * (1 - doorstepWeight(u, v)) : 0;
    },
    ground,
    count: 18,
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
  // dark sprigs. A soft warm floor on every carpet and bush material
  // keeps the shadow side a colour. Region-side tweak only —
  // `createToonMaterial` mints per-build materials, nothing leaks.
  // Rounds 3–5: the lift, finally paid in full. 0x4a4030 @ 0.5 left
  // the shade side a dark violet sprig against the paper, and rounds
  // 3+4 nudged the product by three parts in a hundred — arithmetic,
  // not art (emissive ≈ hex × intensity; a step must MOVE that
  // product). This floor puts a shade side at ≈ 0.4, a lit paper
  // blade near white — the pale country's own register.
  const lift = new Color(0x8e7e6a);
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
        material.emissiveIntensity = 0.72;
      }
    });
  }

  // The Blushfields' own lift is ROSE, not paper — the shade side of
  // a rose frond must stay a rose, or the field prints as violet
  // sprigs from every up-sun camera.
  const roseLift = new Color(0x9a7268);
  (blushFronds.group as Group).traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }
    const material = node.material as {
      type?: string;
      emissive?: Color;
      emissiveIntensity?: number;
    };
    if (material.type === "MeshToonMaterial" && material.emissive) {
      material.emissive.copy(roseLift);
      material.emissiveIntensity = 0.72;
    }
  });

  return {
    groups,
    update(timeSec: number): void {
      for (const carpet of carpets) {
        carpet.update(timeSec);
      }
    },
  };
}
