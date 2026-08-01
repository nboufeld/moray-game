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
import type { CombsBuild } from "./Smoking2Combs";
import { FC_SEEDS, restFree, smoothstep01 } from "./Smoking2Shared";
import {
  HEARTH,
  PILLOWS,
  benchFootU,
  glassWeight,
  hearthWeight,
  pillowsWeight,
  saddleCenter,
  saddleHalf,
  smoking2Weight,
  spokeOf,
  washCenter,
  washHalf,
  washWeight,
  worldOf,
} from "./Smoking2Terrain";

/**
 * The Forge Combs' ground cover — R12 from the first draft: density,
 * quality and light ARE the build. The fill is what a hot seamed floor
 * FEEDS, never clutter:
 *
 * - **dusk stubble** (near-profile blade carpet): the standing near layer
 *   over the whole gravel plain, a full value below the ground paint so
 *   it silhouettes;
 * - **crust fronds** (frond carpet, sunGlow): pale mineral rosettes on
 *   the pillow crowns and the wash's hem — the milk-bright register
 *   standing up off the ground;
 * - **clinker gravel** down the saddle and the stair, **comb-joint
 *   litter** under the walls, **wash cinder** along the road, **obsidian
 *   shards** on the Glass Shore, **hearth ember gravel** in the basin;
 * - **thermophile mat rings** (the province's signature, shifted a
 *   register deeper): seam-line mats along the Emberwash's stations,
 *   junction mats at the Hearth's rays, seep mats on the saddle's
 *   cadence;
 * - **comb scree** at every wall's feet and **wall drapes** on their
 *   faces (things grow FROM somewhere);
 * - **forge-bushes** — the smoke-bush a register deeper: iron-violet
 *   lobes, ember-rimmed;
 * - **far grass cards** with `nearFade`, the sweep's far layer.
 *
 * Every call takes a fresh `SEEDS.regionSmoking2 ^ FC_SEEDS.*` stream and
 * multiplies {@link restFree} into its gate so the Ladle, the Glass Hush
 * and the Anvil's Shadow stay composed bareness.
 */

const SEED = SEEDS.regionSmoking2;

export interface Smoking2FloraBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

function discAreaAt(u: number, v: number, radius: number): KitArea {
  const { x, z } = worldOf(u, v);
  return { center: [x, z], radius };
}

/** The Emberwash as a kit road area, stations every ~14 m of spoke. */
function washArea(fromU: number, toU: number, width: number): KitArea {
  const polyline: [number, number][] = [];
  for (let u = fromU; u <= toU; u += 14) {
    const { x, z } = worldOf(u, washCenter(u));
    polyline.push([x, z]);
  }
  return { polyline, width };
}

/** The saddle road as a kit area. */
function saddleArea(): KitArea {
  const polyline: [number, number][] = [];
  for (let u = 640; u <= 800; u += 12) {
    const { x, z } = worldOf(u, saddleCenter(u));
    polyline.push([x, z]);
  }
  return { polyline, width: 30 };
}

// ─── The gates ───────────────────────────────────────────────────────────────

/** The base dusk stubble holds the whole plain between the named zones. */
const baseStubbleGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 742) {
    return 0;
  }
  const open =
    (1 - washWeight(u, v) * 0.75) *
    (1 - hearthWeight(u, v) * 0.55) *
    (1 - pillowsWeight(u, v) * 0.5) *
    (1 - glassWeight(u) * 0.7);
  return open * restFree(x, z) * smoking2Weight(x, z);
};

/** Crust fronds: pillow crowns and the wash hem — the pale register. */
const crustFrondGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const pillows = pillowsWeight(u, v);
  let gate = pillows * 0.85;
  if (u > 756 && u < 1090) {
    const washD = Math.abs(v - washCenter(u));
    const hem =
      smoothstep01((washD - washHalf(u) * 0.8) / 2) *
      (1 - smoothstep01((washD - washHalf(u) * 2.2) / 5));
    gate = Math.max(gate, hem * 0.9);
  }
  return gate * restFree(x, z) * smoking2Weight(x, z);
};

/** Clinker gravel: the saddle channel and the stair's benches. */
const saddleGravelGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 640 || u > 815) {
    return 0;
  }
  const thicken = 0.25 + 0.75 * smoothstep01((u - 655) / 30);
  const offCenter = Math.abs(v - saddleCenter(u));
  const inChannel = 1 - smoothstep01((offCenter - saddleHalf(u) - 3) / 7);
  return thicken * inChannel * restFree(x, z);
};

/** Wash cinder: the road's own dark floor litter. */
const washCinderGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return washWeight(u, v) * restFree(x, z);
};

/** Comb-joint litter: chips under the wall ranks. */
const combLitterGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 745 || u > 1060) {
    return 0;
  }
  const open =
    (1 - washWeight(u, v)) * (1 - pillowsWeight(u, v) * 0.6) * (1 - hearthWeight(u, v) * 0.4);
  return open * restFree(x, z) * smoking2Weight(x, z);
};

/** Obsidian shards on the Glass Shore. */
const glassShardGate: GateFn = (x, z) => {
  const { u } = spokeOf(x, z);
  return glassWeight(u) * (1 - smoothstep01((u - 1128) / 20)) * restFree(x, z) * smoking2Weight(x, z);
};

/** Hearth ember gravel: the basin's warm floor. */
const hearthGravelGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return hearthWeight(u, v) * restFree(x, z);
};

/** Pillow litter: crust chips shed off the mound crowns. */
const pillowLitterGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return pillowsWeight(u, v) * restFree(x, z);
};

/** Dusk tufts: the outer flank band + the plain — the F-R3 standing layer. */
const duskTuftGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 700) {
    return 0;
  }
  const rc = Math.hypot(u - 940, v);
  const flank = 0.45 + 0.55 * smoothstep01((rc - 105) / 50);
  const open =
    (1 - washWeight(u, v) * 0.6) *
    (1 - hearthWeight(u, v) * 0.5) *
    (1 - pillowsWeight(u, v) * 0.55);
  return flank * open * restFree(x, z) * smoking2Weight(x, z);
};

/** Forge-bushes: comb feet and the pillow fringe. */
const forgeBushGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 760) {
    return 0;
  }
  const open = (1 - washWeight(u, v)) * (1 - glassWeight(u) * 0.75);
  return open * restFree(x, z) * smoking2Weight(x, z);
};

/** The far-card layer: everywhere the country owns, thinned in the wash. */
const farCardGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 720) {
    return 0;
  }
  return (1 - washWeight(u, v) * 0.7) * restFree(x, z) * smoking2Weight(x, z);
};

// ─── The build ───────────────────────────────────────────────────────────────

export function buildSmoking2Flora(combs: CombsBuild): Smoking2FloraBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (build: KitBuild | CarpetFieldBuild): void => {
    groups.push(build.group);
    if ("update" in build) {
      updaters.push((timeSec) => build.update(timeSec));
    }
  };

  // ─── The standing near layer (R12 near profiles) ─────────────────────────
  // Dusk stubble: charcoal-violet blade clumps a full value below the
  // gravel paint, the family that silhouettes under this light.
  keep(
    buildCarpetField({
      seed: SEED ^ FC_SEEDS.baseCarpet,
      palette: { base: 0x76677a, tip: 0x91808c, shade: 0x504661 },
      area: discAreaAt(940, 0, 215),
      gate: baseStubbleGate,
      ground: seabedHeight,
      count: 5200,
      profile: "blade",
      size: [0.38, 0.72],
      swayAmp: 0.035,
    }),
  );

  // Crust fronds: the milk-bright register standing off the crowns and
  // the wash hem — pale rosettes with the sun-through-leaf glow.
  keep(
    buildCarpetField({
      seed: SEED ^ FC_SEEDS.crustFronds,
      palette: { base: 0xd8c9a6, tip: 0xefe3c2, shade: 0x93836e },
      area: discAreaAt(940, 10, 215),
      gate: crustFrondGate,
      ground: seabedHeight,
      count: 1500,
      profile: "frond",
      size: [0.34, 0.6],
      swayAmp: 0.04,
      sunGlow: true,
    }),
  );

  // Dusk tufts: bone-amber crossed tufts, the flats' knee-high layer and
  // the rim flank band (F-R3: a rim-facing pose finds a silhouette).
  keep(
    buildCarpetField({
      seed: SEED ^ FC_SEEDS.duskTufts,
      palette: { base: 0xb5a276, tip: 0xdcc890, shade: 0x80735f },
      area: discAreaAt(940, 0, 215),
      gate: duskTuftGate,
      ground: seabedHeight,
      count: 1400,
      profile: "tuft",
      size: [0.5, 0.9],
      swayAmp: 0.045,
    }),
  );

  // The saddle's own stubble: the road arrives dressed (sparse at the
  // Smoulder handover, thickening down the stair).
  keep(
    buildCarpetField({
      seed: SEED ^ FC_SEEDS.washCinder ^ 0x77,
      palette: { base: 0x72646e, tip: 0x8c777c, shade: 0x4e455c },
      area: saddleArea(),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        if (u < 648 || u > 812) {
          return 0;
        }
        const thicken = 0.25 + 0.75 * smoothstep01((u - 664) / 28);
        const offCenter = Math.abs(v - saddleCenter(u));
        const inReach = 1 - smoothstep01((offCenter - saddleHalf(u) - 6) / 7);
        const offTread = 0.3 + 0.7 * smoothstep01((offCenter - 2.5) / 2.5);
        return thicken * inReach * offTread * restFree(x, z);
      },
      ground: seabedHeight,
      count: 900,
      profile: "blade",
      size: [0.34, 0.66],
      swayAmp: 0.03,
    }),
  );

  // ─── Litter (T1) ──────────────────────────────────────────────────────────
  keep(
    buildGroundLitter({
      seed: SEED ^ FC_SEEDS.combGravel,
      palette: { base: 0x6f6274, accent: 0x8a6a58, shade: 0x554b64 },
      area: saddleArea(),
      gate: saddleGravelGate,
      ground: seabedHeight,
      count: 1100,
      shapeSet: "gravel",
      size: [0.1, 0.28],
      twoTone: true,
    }),
  );
  keep(
    buildGroundLitter({
      seed: SEED ^ FC_SEEDS.washCinder,
      palette: { base: 0x6a5a66, accent: 0xa2603c, shade: 0x514660 },
      area: washArea(760, 1075, 18),
      gate: washCinderGate,
      ground: seabedHeight,
      count: 1300,
      shapeSet: "gravel",
      size: [0.1, 0.3],
      twoTone: true,
    }),
  );
  keep(
    buildGroundLitter({
      seed: SEED ^ FC_SEEDS.pillowLitter,
      palette: { base: 0x9d9184, accent: 0xcabfa2, shade: 0x776c7e },
      area: discAreaAt(PILLOWS.u, PILLOWS.v, 96),
      gate: pillowLitterGate,
      ground: seabedHeight,
      count: 750,
      shapeSet: "pebble",
      size: [0.1, 0.3],
      twoTone: true,
    }),
  );
  keep(
    buildGroundLitter({
      seed: SEED ^ FC_SEEDS.glassShards,
      palette: { base: 0x4f4560, accent: 0xb9aec6, shade: 0x3f3852 },
      area: discAreaAt(1075, -20, 110),
      gate: glassShardGate,
      ground: seabedHeight,
      count: 900,
      shapeSet: "shard",
      size: [0.09, 0.26],
      twoTone: true,
    }),
  );
  keep(
    buildGroundLitter({
      seed: SEED ^ FC_SEEDS.hearthGravel,
      palette: { base: 0x74584e, accent: 0xa85e3a, shade: 0x584a60 },
      area: discAreaAt(HEARTH.u, HEARTH.v, 72),
      gate: hearthGravelGate,
      ground: seabedHeight,
      count: 800,
      shapeSet: "gravel",
      size: [0.08, 0.24],
      twoTone: true,
    }),
  );
  keep(
    buildGroundLitter({
      seed: SEED ^ FC_SEEDS.combGravel ^ 0x33,
      palette: { base: 0x83766e, shade: 0x60556a },
      area: discAreaAt(920, -10, 190),
      gate: combLitterGate,
      ground: seabedHeight,
      count: 850,
      shapeSet: "shard",
      size: [0.1, 0.28],
    }),
  );

  // ─── The thermophile mat rings (province signature, deeper register) ─────
  // Seam-line mats down the Emberwash: one every 25–35 m of road, each
  // agreeing with a seam vein or an ember pool so the heat is a SYSTEM.
  keep(
    buildMatRings({
      seed: SEED ^ FC_SEEDS.matsWash,
      bands: [
        { color: 0xe8d8b6, width: 1.0 },
        { color: 0xdc9a4e, width: 1.0 },
        { color: 0xa2583a, width: 0.9 },
        { color: 0x6c4c5c, width: 0.7 },
      ],
      ground: seabedHeight,
      anchors: [782, 812, 846, 872, 906, 940, 968, 1002, 1034, 1062].map((u, i) => ({
        pos: matSpot(u, washCenter(u) + (i % 2 === 0 ? 2.2 : -2.4)),
        radius: 1.3 + (i % 3) * 0.5,
      })),
      tiers: 2,
    }),
  );

  // Junction mats at the Hearth: the star's rays pooled in tiers.
  const hearthAnchors: MatAnchor[] = [];
  const hearthRandom = new Random(SEED ^ FC_SEEDS.matsHearth ^ 0x0a);
  let guard = 0;
  while (hearthAnchors.length < 9 && guard++ < 200) {
    const theta = hearthRandom.range(0, Math.PI * 2);
    const d = 6 + Math.sqrt(hearthRandom.next()) * 34;
    const u = HEARTH.u + Math.cos(theta) * d;
    const v = HEARTH.v + Math.sin(theta) * d;
    if (hearthWeight(u, v) < 0.45) {
      continue;
    }
    const { x, z } = worldOf(u, v);
    if (restFree(x, z) < 0.7) {
      continue;
    }
    if (hearthAnchors.some((a) => Math.hypot(a.pos[0] - x, a.pos[1] - z) < 5)) {
      continue;
    }
    hearthAnchors.push({ pos: [x, z], radius: hearthRandom.range(1.4, 2.6) });
  }
  keep(
    buildMatRings({
      seed: SEED ^ FC_SEEDS.matsHearth,
      bands: [
        { color: 0xecdfc0, width: 1.1 },
        { color: 0xe0a458, width: 1.0 },
        { color: 0xbe6c3e, width: 0.9 },
        { color: 0x84625c, width: 0.7 },
      ],
      ground: seabedHeight,
      anchors: hearthAnchors,
      tiers: 2,
    }),
  );

  // Seep mats on the saddle's cadence — the approach announces the
  // vocabulary at 25–35 m stations before the reveal.
  keep(
    buildMatRings({
      seed: SEED ^ FC_SEEDS.matsSaddle,
      bands: [
        { color: 0xd39a54, width: 1.0 },
        { color: 0x96543c, width: 0.9 },
        { color: 0x5e4654, width: 0.7 },
      ],
      ground: seabedHeight,
      anchors: [652, 680, 708, 734].map((u, i) => ({
        pos: matSpot(u, saddleCenter(u) + (i % 2 === 0 ? 1.8 : -2.0)),
        radius: 1.1 + (i % 3) * 0.4,
      })),
    }),
  );

  // Bench-foot mats: one at each clinker riser's foot, the stair's own
  // warm punctuation.
  keep(
    buildMatRings({
      seed: SEED ^ FC_SEEDS.matsSaddle ^ 0x55,
      bands: [
        { color: 0xdd8a44, width: 0.9 },
        { color: 0x9a5436, width: 0.9 },
        { color: 0x64485a, width: 0.6 },
      ],
      ground: seabedHeight,
      anchors: [0, 2, 4].map((i) => ({
        pos: matSpot(benchFootU(i) + 1.5, saddleCenter(benchFootU(i)) + (i - 2) * 1.4),
        radius: 1.0 + i * 0.2,
      })),
    }),
  );

  // ─── Comb scree and wall drapes (things grow FROM somewhere) ─────────────
  const screeAnchors: ScreeAnchor[] = combs.feet.map((foot, i) => ({
    pos: [foot.pos[0], foot.pos[1]],
    facing: foot.facing,
    spread: 2.2 + (i % 3) * 0.6,
  }));
  keep(
    buildScreeApron({
      seed: SEED ^ FC_SEEDS.screeCombs,
      palette: { base: 0x7c6f74, shade: 0x584d64 },
      ground: seabedHeight,
      anchors: screeAnchors,
      slabsPerAnchor: 6,
    }),
  );
  keep(
    buildWallDrapeBank({
      seed: SEED ^ FC_SEEDS.drapesCombs,
      palette: { base: 0x8a7266, tip: 0xb59672, shade: 0x564a62 },
      anchors: combs.drapeAnchors,
      strandsPerAnchor: 4,
      length: 1.7,
      swayAmp: 0.05,
    }),
  );

  // ─── The forge-bushes ─────────────────────────────────────────────────────
  keep(
    buildBushBank({
      seed: SEED ^ FC_SEEDS.forgeBushes,
      palette: { base: 0x63525f, tip: 0x8e5642, shade: 0x483e54 },
      area: discAreaAt(900, 20, 130),
      gate: forgeBushGate,
      ground: seabedHeight,
      count: 26,
    }),
  );
  keep(
    buildBushBank({
      seed: SEED ^ FC_SEEDS.forgeBushes ^ 0x99,
      palette: { base: 0x6a5a68, tip: 0x9a6a4a, shade: 0x4e4458 },
      area: discAreaAt(1010, -30, 120),
      gate: forgeBushGate,
      ground: seabedHeight,
      count: 18,
    }),
  );

  // ─── The far layer ────────────────────────────────────────────────────────
  keep(
    buildFarGrassCards({
      seed: SEED ^ FC_SEEDS.farCards,
      palette: { base: 0x8d7d84, tip: 0xb3a094, shade: 0x665c72 },
      area: discAreaAt(940, 0, 218),
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
