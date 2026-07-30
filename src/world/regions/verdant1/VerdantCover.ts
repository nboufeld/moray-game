import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildCarpetField, type CarpetFieldBuild } from "../kit/CarpetField";
import { buildDriftDebris } from "../kit/DriftDebris";
import { buildGroundLitter } from "../kit/GroundLitter";
import type { GateFn, KitArea, KitBuild } from "../kit/KitTypes";
import { smoothstep01 } from "./VerdantShared";
import {
  ERRATIC,
  FILL_SEEDS,
  WRECK_AT,
  restFree,
} from "./VerdantFillShared";
import {
  fallingEdgeWeight,
  forestWeight,
  mazeWeight,
  spokeOf,
  sunwellWeight,
  tongueHalfWidth,
  valeChannelCenter,
  verdantWeight,
  worldOf,
} from "./VerdantTerrain";

/**
 * The Great Kelp Sea's T1 ground cover — the doctrine's "no square metre
 * bare by accident", spent as kit calls (fill plan §3's zone table):
 *
 * - **moss carpet** (2,300 cards) down the vale channel — the road itself
 *   is green now, not just its walls; it fades before the lip crest rest.
 * - **base turf floor** (2,200, round 2): sparse olive stubble over the
 *   whole disc, so the ground BETWEEN zones is never bare by default.
 * - **sward carpet** (3,400) on the meadows' swell crests.
 * - **litter carpets** (2 × 1,050, two warm tones) between the forest's
 *   trunks — the leaf-fall the canopy has been shedding for years.
 * - **silt-bloom carpet** (1,500, violet family) on the maze's gully
 *   floors — half-light growth, red held above green.
 * - **shell-scatter carpet** (800, milky) on the Falling Edge.
 * - **ring-rim carpet** (600, pale gold) on the Sunwell's rim ring.
 * - **pebble runs**: 520 two-tone down the channel line, 140 across the
 *   meadow crests, a 12-stone skirt at the erratic's foot, 500 rubble in
 *   the maze gullies.
 * - **wreck debris field**: 24 planks strewn around the Wreck Rib.
 *
 * Every call takes a fresh `SEEDS.regionVerdant1 ^ FILL_SEEDS.*` stream
 * (the reroll fence) and multiplies {@link restFree} into its gate so the
 * registered rests stay composed bareness. Budget shape: 14 draws, ~85k
 * triangles — measured by the region test, not claimed.
 */

const SEED = SEEDS.regionVerdant1;

export interface VerdantCoverBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

/** The vale channel as a kit road area, stations every ~16 m of spoke. */
function valeChannelArea(fromU: number, toU: number, width: number): KitArea {
  const polyline: [number, number][] = [];
  for (let u = fromU; u <= toU; u += 16) {
    const { x, z } = worldOf(u, valeChannelCenter(u));
    polyline.push([x, z]);
  }
  return { polyline, width };
}

/** The meadows as a kit road area running up the spoke. */
function meadowArea(): KitArea {
  const polyline: [number, number][] = [];
  for (const u of [294, 330, 366, 402]) {
    const { x, z } = worldOf(u, 0);
    polyline.push([x, z]);
  }
  return { polyline, width: 165 };
}

function edgeArea(): KitArea {
  const polyline: [number, number][] = [];
  for (const u of [546, 580, 616]) {
    const { x, z } = worldOf(u, 0);
    polyline.push([x, z]);
  }
  return { polyline, width: 170 };
}

function discAreaAt(u: number, v: number, radius: number): KitArea {
  const { x, z } = worldOf(u, v);
  return { center: [x, z], radius };
}

// ─── The gates ───────────────────────────────────────────────────────────────

/** Moss holds the channel and the wall feet, dying before the crest rest. */
const mossGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 50 || u > 260) {
    return 0;
  }
  const offCenter = Math.abs(v - valeChannelCenter(u));
  const inVale = 1 - smoothstep01((offCenter - 4) / (tongueHalfWidth(u) * 0.5));
  const beforeCrest = 1 - smoothstep01((u - 246) / 8);
  return inVale * beforeCrest * (0.45 + 0.55 * smoothstep01(1 - offCenter / 5)) * restFree(x, z);
};

/** Sward loves the sunlit swell crests; thins into the forest's shade. */
const swardGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 288 || u > 452 || Math.abs(v) > 86) {
    return 0;
  }
  const crest = smoothstep01((seabedHeight(x, z) + 2.6) / 2.4);
  const shade = 1 - forestWeight(u, v) * 0.75;
  return (
    (0.45 + 0.55 * crest) *
    shade *
    (1 - mazeWeight(u, v)) *
    (1 - sunwellWeight(u, v)) *
    restFree(x, z) *
    verdantWeight(x, z)
  );
};

/** Litter drifts between the trunks, out of the Sunwell's pale floor. */
const litterGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return (
    forestWeight(u, v) *
    (1 - sunwellWeight(u, v)) *
    (1 - mazeWeight(u, v)) *
    restFree(x, z) *
    verdantWeight(x, z)
  );
};

/** Silt bloom pools on the maze's gully floors — the deeper, the denser. */
const siltGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const maze = mazeWeight(u, v);
  if (maze <= 0) {
    return 0;
  }
  const gully = smoothstep01((-seabedHeight(x, z) - 17.5) / 3);
  return maze * (0.3 + 0.7 * gully) * restFree(x, z);
};

/**
 * The base turf floor (round 2, from the sweep): a sparse olive stubble
 * over the WHOLE disc between the named zones, so the ground between
 * meadow and rim is never bare by default (the doctrine's "no square
 * metre bare by accident" — sweep frames 03/04/05/08 were exactly this
 * bare disc). It thins where a richer family already owns the floor and
 * stays out of the vale channel (the moss track's) and the Sunwell bowl.
 */
const turfGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  let channel = 0;
  if (u >= 50 && u <= 262) {
    const offCenter = Math.abs(v - valeChannelCenter(u));
    channel = 1 - smoothstep01((offCenter - 4) / (tongueHalfWidth(u) * 0.5));
  }
  return (
    verdantWeight(x, z) *
    (1 - channel) *
    (1 - sunwellWeight(u, v)) *
    (1 - mazeWeight(u, v) * 0.75) *
    (1 - forestWeight(u, v) * 0.55) *
    restFree(x, z)
  );
};

/** Shell scatter thins outward across the shelf — the decrescendo. */
const shellGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return (
    fallingEdgeWeight(u) *
    (1 - mazeWeight(u, v)) *
    (1 - smoothstep01((u - 600) / 26)) *
    restFree(x, z) *
    verdantWeight(x, z)
  );
};

// ─── The build ───────────────────────────────────────────────────────────────

export function buildVerdantCover(): VerdantCoverBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (build: KitBuild | CarpetFieldBuild): void => {
    groups.push(build.group);
    if ("update" in build) {
      updaters.push((timeSec) => build.update(timeSec));
    }
  };

  // The moss carpet: the vale's own road turned green underfoot. Round 2
  // lifted the whole ramp (r1 read as near-black thorns under the region's
  // dim sun) and grew the cards so the green reads at swim height.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetMoss,
      palette: { base: 0x69a156, tip: 0xa4d276, shade: 0x5c5570 },
      area: valeChannelArea(54, 252, 15),
      gate: mossGate,
      ground: seabedHeight,
      count: 2300,
      size: [0.16, 0.36],
      swayAmp: 0.03,
    }),
  );

  // The base turf floor: the round-2 sweep answer — a muted olive stubble
  // over the whole disc so no pose lands on bare mustard by accident.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetTurf,
      palette: { base: 0x8aa65e, tip: 0xb4cc78, shade: 0x6d7a50 },
      area: discAreaAt(350, 0, 320),
      gate: turfGate,
      ground: seabedHeight,
      count: 2200,
      size: [0.2, 0.44],
      swayAmp: 0.035,
    }),
  );

  // The sward: the meadows' swell crests carry the green the paint began.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetSward,
      palette: { base: 0x82c46e, tip: 0xb2e884, shade: 0x5f8a5f },
      area: meadowArea(),
      gate: swardGate,
      ground: seabedHeight,
      count: 3400,
      size: [0.24, 0.52],
      swayAmp: 0.045,
    }),
  );

  // The forest litter, in two warm tones so the drifts read as seasons of
  // leaf-fall rather than one pour (fill plan §3 — golden-olive, held off
  // rust: round 3's redder litter dried into shipwreck colour).
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetLitterA,
      palette: { base: 0xbca768, tip: 0xdecb74, shade: 0x84735a },
      area: discAreaAt(450, -10, 118),
      gate: litterGate,
      ground: seabedHeight,
      count: 1050,
      size: [0.16, 0.34],
    }),
  );
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetLitterB,
      palette: { base: 0x9c985e, tip: 0xc0bc70, shade: 0x6e6a4c },
      area: discAreaAt(450, -10, 118),
      gate: litterGate,
      ground: seabedHeight,
      count: 1050,
      size: [0.16, 0.34],
    }),
  );

  // The maze's silt bloom: a violet family whose red stays above green —
  // the gully floors carry their own half-light growth now.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetSilt,
      palette: { base: 0x8672a2, tip: 0xab94c6, shade: 0x615478 },
      area: discAreaAt(495, -82, 60),
      gate: siltGate,
      ground: seabedHeight,
      count: 1500,
      size: [0.16, 0.36],
      swayAmp: 0.02,
    }),
  );

  // The Falling Edge's shell scatter: milky-pale, thinning outward.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetShell,
      palette: { base: 0xcfc7ae, tip: 0xe8e2cc, shade: 0x9a8f80 },
      area: edgeArea(),
      gate: shellGate,
      ground: seabedHeight,
      count: 800,
      size: [0.12, 0.26],
    }),
  );

  // The Sunwell's ring-rim carpet: pale gold on the raised rim the ring
  // giants stand on — the band `sunwell` read as bare between near grass
  // and the giants. Ground cover only; the bowl's fauna rest holds.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetRingRim,
      palette: { base: 0xb0c47e, tip: 0xd9e79a, shade: 0x7a8a5c },
      area: discAreaAt(475, 58, 46),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        const d = Math.hypot(u - 475, v - 58);
        return smoothstep01((d - 24) / 5) * (1 - smoothstep01((d - 42) / 7));
      },
      ground: seabedHeight,
      count: 600,
      size: [0.18, 0.38],
      swayAmp: 0.04,
    }),
  );

  // ─── Pebbles, rubble, debris ─────────────────────────────────────────────
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.valePebbles,
      palette: { base: 0x94907c, accent: 0xa39c88, shade: 0x6f687c },
      area: valeChannelArea(54, 252, 9),
      gate: mossGate,
      ground: seabedHeight,
      count: 520,
      shapeSet: "pebble",
      twoTone: true,
    }),
  );
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.meadowPebbles,
      palette: { base: 0xa39c88, shade: 0x6f687c },
      area: meadowArea(),
      gate: swardGate,
      ground: seabedHeight,
      count: 140,
      shapeSet: "pebble",
    }),
  );
  // The erratic's skirt: twelve stones seated at the lone boulder's foot,
  // so the meadows' scale-giver grew FROM somewhere.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.erraticSkirt,
      palette: { base: 0xa39c88, shade: 0x6f687c },
      area: discAreaAt(ERRATIC.u, ERRATIC.v, 6.5),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        return Math.hypot(u - ERRATIC.u, v - ERRATIC.v) > 3.4 ? 1 : 0.15;
      },
      ground: seabedHeight,
      count: 12,
      shapeSet: "gravel",
      size: [0.22, 0.5],
    }),
  );
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.mazeRubble,
      palette: { base: 0x847892, shade: 0x5f5474 },
      area: discAreaAt(495, -82, 58),
      gate: siltGate,
      ground: seabedHeight,
      count: 500,
      // Shards, not gravel: angular rubble suits the tangle, at 8 tris a
      // stone instead of 20 (the budget's biggest single T1 cut).
      shapeSet: "shard",
    }),
  );
  // The wreck's debris field: planks the hull shed, strewn down-current.
  keep(
    buildDriftDebris({
      seed: SEED ^ FILL_SEEDS.wreckDebris,
      palette: { base: 0x6e5a50, shade: 0x54322c },
      area: discAreaAt(WRECK_AT.u, WRECK_AT.v, 8),
      gate: (x, z) => restFree(x, z),
      ground: seabedHeight,
      count: 24,
      shapeSet: "planks",
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
