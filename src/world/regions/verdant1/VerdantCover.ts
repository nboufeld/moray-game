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
  aisleDistance,
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
 * - **moss carpet** (1,780 cards) down the vale channel — the road itself
 *   is green now, not just its walls; it fades before the lip crest rest.
 * - **base turf floor** (3,600, grown rounds 3–4, re-valued round 7 when
 *   its palette turned out to have converged with the r3 ground paint):
 *   olive stubble over the whole disc, so the ground BETWEEN zones is
 *   never bare by default — and visibly so.
 * - **flank tussocks** (520 knee-high tufts, rounds 4–7): the sweep's r3
 *   verdict — the outer flanks had colour but nothing STOOD there — so a
 *   sparse tall family guarantees the mid layer between the zones,
 *   leaned toward the flanks and the saddle mouth where no richer family
 *   shares the floor.
 * - **saddle-mouth stand** (130 tufts, round 7): a concentrated drift of
 *   the tussock growth on the mouth's off-channel flanks, the one band
 *   where a pose can face outward and run off the region inside 40 m.
 * - **sward carpet** (2,400) on the meadows' swell crests.
 * - **litter carpets** (2 × 950, two warm tones) between the forest's
 *   trunks — the leaf-fall the canopy has been shedding for years.
 * - **silt-bloom carpet** (1,100, violet family) on the maze's gully
 *   floors — half-light growth, red held above green.
 * - **shell-scatter carpet** (960, milky) on the Falling Edge, carried
 *   two rings further out than round 3 (sweep 08 stood past the old area
 *   polyline's own end, let alone the gate's fade).
 * - **ring-rim carpet** (600, pale gold) on the Sunwell's rim ring.
 * - **pebble runs**: 520 two-tone down the channel line, 140 across the
 *   meadow crests, a 12-stone skirt at the erratic's foot, 500 rubble in
 *   the maze gullies.
 * - **wreck debris field**: 24 planks strewn around the Wreck Rib.
 *
 * Every call takes a fresh `SEEDS.regionVerdant1 ^ FILL_SEEDS.*` stream
 * (the reroll fence) and multiplies {@link restFree} into its gate so the
 * registered rests stay composed bareness. Budget shape: 16 draws, ~90k
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
  // To u 652 since round 5: the polyline ended at 616, so no shell could
  // ever land where sweep 08 stood (u 631) — the gate's fade was arguing
  // with an area that had already run out of road.
  for (const u of [546, 584, 622, 652]) {
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

/** Shell scatter thins outward across the shelf — the decrescendo. Round
 *  4 carried the cut a ring further: sweep 08 stood at u 631 on bare pale
 *  ground, past the old u-600 fade, and the edge is NOT a registered rest. */
const shellGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return (
    fallingEdgeWeight(u) *
    (1 - mazeWeight(u, v)) *
    (1 - smoothstep01((u - 634) / 30)) *
    restFree(x, z) *
    verdantWeight(x, z)
  );
};

/**
 * The flank tussocks (round 4): the r3 sweep's exact miss. The paint pass
 * greened the inter-zone floor and the turf carpet textured it, but a
 * 0.5 m card vanishes past ~8 m — poses on the outer flanks (sweep 03/04/
 * 05/11, |v| ≈ 90–180) and the saddle mouth (12) had NOTHING standing in
 * their near layer. Knee-high crossed tufts, sparse enough to stay a
 * meadow and not a field of flags, carry that layer everywhere the turf
 * goes — thinned where the named zones own richer cover, faded across the
 * Falling Edge (the decrescendo keeps its right to dissolve), and held
 * off the forest aisle's swim line.
 */
const tussockGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  let channel = 0;
  if (u >= 50 && u <= 262) {
    const offCenter = Math.abs(v - valeChannelCenter(u));
    channel = 1 - smoothstep01((offCenter - 4) / (tongueHalfWidth(u) * 0.5));
  }
  // Round 5: lean the density toward the ground that shares its near
  // layer with nobody — the outer flanks (|v| beyond ~70, sweep 05/11's
  // bare near bands both stood past |v| 150) AND the saddle mouth before
  // the meadows begin (u < ~300, sweep 12's lone green dune): the mid
  // disc has sward/litter/named zones to stand things up, those two have
  // only the turf and this family.
  const saddleMouth = 1 - smoothstep01((u - 288) / 22);
  const flank = Math.max(
    saddleMouth,
    0.72 + 0.28 * smoothstep01((Math.abs(v) - 70) / 40),
  );
  return (
    verdantWeight(x, z) *
    flank *
    (1 - channel) *
    (1 - sunwellWeight(u, v)) *
    (1 - mazeWeight(u, v) * 0.75) *
    (1 - forestWeight(u, v) * 0.55) *
    (1 - fallingEdgeWeight(u) * 0.55) *
    smoothstep01((aisleDistance(u, v) - 3) / 3) *
    restFree(x, z)
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
  // dim sun); round 3 takes the ROOT off violet entirely — at speck size a
  // card reads by colour alone, and a violet root under the toon shade
  // band is soot whatever the tip does. Roots go olive, tips stay bright.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetMoss,
      palette: { base: 0x74a95e, tip: 0xa4d276, shade: 0x6b7c5a },
      area: valeChannelArea(54, 252, 15),
      gate: mossGate,
      ground: seabedHeight,
      // 2,300 → 1,780 across rounds 4–7: the r3 cards grew, the density
      // can pay for the flank tussocks — the vale passes comfortably.
      count: 1780,
      size: [0.2, 0.4],
      swayAmp: 0.03,
    }),
  );

  // The base turf floor: the round-2 sweep answer — olive stubble over the
  // whole disc so no pose lands on bare mustard by accident. Round 3 grew
  // it (traded from the sward, whose zones already pass), lifted the root
  // and sized the cards up; round 4 grew it again (2,800 → 3,600) — the
  // flank poses had colour underfoot but the stubble was still a rumour.
  // Round 7 found the last failure mode: the r3 ground paint and this
  // palette had CONVERGED — same greens, so 3,600 cards stood on the disc
  // and vanished into their own floor. Tips go a value brighter, roots a
  // value darker (silhouette against the paint), cards a hand taller —
  // all free, the count doesn't move.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetTurf,
      palette: { base: 0x9cb968, tip: 0xcfe084, shade: 0x616e48 },
      area: discAreaAt(350, 0, 320),
      gate: turfGate,
      ground: seabedHeight,
      count: 3600,
      size: [0.3, 0.6],
      swayAmp: 0.035,
    }),
  );

  // The flank tussocks: round 4's near-layer guarantee for the ground the
  // sweep actually lands on — see {@link tussockGate} for the verdict.
  // Round 7 added the saddle-mouth stand below: a pose on the mouth's own
  // flank (sweep 12, u 276 v −30 looking OUTWARD) sees only ~35 m of
  // region-owned ground before the weight dies, and a global scatter of a
  // few hundred tufts cannot promise its narrow view cone anything. A
  // small concentrated stand on that one band can.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetTussock,
      palette: { base: 0x7fa25e, tip: 0xa8c873, shade: 0x647550 },
      area: discAreaAt(350, 0, 320),
      gate: tussockGate,
      ground: seabedHeight,
      // 430 → 520 in round 7, paid by the sward and moss trims below: the
      // mid ring between the zones is this family's to carry alone.
      count: 520,
      profile: "tuft",
      size: [0.6, 1.1],
      swayAmp: 0.05,
    }),
  );

  // The saddle-mouth stand: the mouth's off-channel flanks (u ≈ 250–290,
  // |v| ≈ 20–75) are the only band where a sweep pose can face outward
  // and run off the region inside 40 m. Same family palette as the
  // tussocks — this is a denser drift of the same growth, not a new kind.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetSaddle,
      palette: { base: 0x7fa25e, tip: 0xa8c873, shade: 0x647550 },
      area: discAreaAt(268, -42, 55),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        let channel = 0;
        if (u >= 50 && u <= 262) {
          const offCenter = Math.abs(v - valeChannelCenter(u));
          channel = 1 - smoothstep01((offCenter - 4) / (tongueHalfWidth(u) * 0.5));
        }
        return verdantWeight(x, z) * (1 - channel) * restFree(x, z);
      },
      ground: seabedHeight,
      count: 130,
      profile: "tuft",
      size: [0.5, 0.95],
      swayAmp: 0.05,
    }),
  );

  // The sward: the meadows' swell crests carry the green the paint began.
  // Trimmed 3,400 → 3,000 → 2,700 → 2,500 across rounds 3–7 to pay for
  // the turf and the tussocks — the swarded crests pass the sweep already.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetSward,
      palette: { base: 0x82c46e, tip: 0xb2e884, shade: 0x5f8a5f },
      area: meadowArea(),
      gate: swardGate,
      ground: seabedHeight,
      count: 2400,
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
      palette: { base: 0xbca768, tip: 0xdecb74, shade: 0x94836a },
      area: discAreaAt(450, -10, 118),
      gate: litterGate,
      ground: seabedHeight,
      count: 950,
      size: [0.2, 0.42],
    }),
  );
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetLitterB,
      palette: { base: 0x9c985e, tip: 0xc0bc70, shade: 0x7e7a5c },
      area: discAreaAt(450, -10, 118),
      gate: litterGate,
      ground: seabedHeight,
      count: 950,
      size: [0.2, 0.42],
    }),
  );

  // The maze's silt bloom: a violet family whose red stays above green —
  // the gully floors carry their own half-light growth now.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetSilt,
      palette: { base: 0x9080ae, tip: 0xab94c6, shade: 0x6f6288 },
      area: discAreaAt(495, -82, 60),
      gate: siltGate,
      ground: seabedHeight,
      // 1,500 → 1,100 across rounds 4–7: the maze poses pass with margin,
      // and the trims paid for the tussocks and the saddle-mouth stand.
      count: 1100,
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
      count: 960,
      // Grown a step in round 6: at 0.12–0.26 the outer-shelf chips read
      // as specks from a pose's 1.2 m eye height (sweep 08) — same
      // triangle bill either way.
      size: [0.16, 0.32],
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
      palette: { base: 0x94907c, accent: 0xa39c88, shade: 0x7f7888 },
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
      palette: { base: 0x958aa4, shade: 0x6f6484 },
      area: discAreaAt(495, -82, 58),
      gate: siltGate,
      ground: seabedHeight,
      count: 420,
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
