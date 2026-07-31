import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildCarpetField, type CarpetFieldBuild } from "../kit/CarpetField";
import { buildDriftDebris } from "../kit/DriftDebris";
import { buildGroundLitter } from "../kit/GroundLitter";
import type { GateFn, KitArea, KitBuild } from "../kit/KitTypes";
import { smoothstep01 } from "./VerdantShared";
import type { KelpFoot } from "./VerdantKelp";
import {
  ERRATIC,
  FILL_SEEDS,
  WRECK_AT,
  aisleAt,
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
  valeChannelHalf,
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
 * registered rests stay composed bareness.
 *
 * ## The R12.3 quality re-pass (MASTER R12, the owner's "half-cut grass")
 *
 * Every family the diver swims THROUGH moved off the 4-tri card onto the
 * kit's authored near profiles — `"blade"` (48-tri S-bend clumps) for the
 * grass families (turf, sward, tussocks, saddle stand, ring rim), and
 * `"frond"` (60-tri cupped rosettes) for the growth families (vale moss,
 * forest leaf-fall, maze silt bloom). Only the Falling Edge's shell
 * scatter keeps `"card"` — it draws shell CHIPS, not plants, and a flat
 * bent quad at 0.16–0.32 m is the right silhouette for a shell. The
 * sunlit families adopt `sunGlow` (the meadow's two-note translucency)
 * and the sweep-critical broad-disc families adopt a raised `looseShare`
 * (the F-R2 field note: loose singles are what a narrow view cone can be
 * promised). The re-pass also appends four NEW families from fresh
 * `0xf21x` streams — holdfast skirt-grass collars, forest ferns, and the
 * road-edge blade stands (vale + aisle) — spending the R12 headroom on
 * presence where the player actually swims.
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

/** Silt bloom pools on the maze's gully floors — the deeper, the denser.
 *  R12.3 round 3 raised the ridge baseline 0.3 → 0.45: the close-maze
 *  pose stared at a ridge mound the old gate left bald, and a maze floor
 *  is never bare, just thinner where it climbs. */
const siltGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const maze = mazeWeight(u, v);
  if (maze <= 0) {
    return 0;
  }
  const gully = smoothstep01((-seabedHeight(x, z) - 17.5) / 3);
  return maze * (0.45 + 0.55 * gully) * restFree(x, z);
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

export function buildVerdantCover(giants: readonly KelpFoot[]): VerdantCoverBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (build: KitBuild | CarpetFieldBuild): void => {
    groups.push(build.group);
    if ("update" in build) {
      updaters.push((timeSec) => build.update(timeSec));
    }
  };

  // The moss carpet: the vale's own road turned green underfoot. Re-pass:
  // the road is the one floor the diver stares at for 200 m, so it moved
  // to the "frond" rosette — low cupped growth instead of card wedges —
  // with the sun glow, since the vale's beams land on it.
  // Re-pass round 2: 1,780 → 2,200 (a 200 m road needs more than a
  // rumour of moss) and the whole ramp a value up — the rosettes show
  // mostly base/root from a swimming eye, and r1's read was dark-olive
  // silhouettes on bright paint.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetMoss,
      palette: { base: 0x81b468, tip: 0xaed87e, shade: 0x788a62 },
      area: valeChannelArea(54, 252, 15),
      gate: mossGate,
      ground: seabedHeight,
      count: 2200,
      profile: "frond",
      size: [0.2, 0.4],
      swayAmp: 0.03,
      sunGlow: true,
    }),
  );

  // The base turf floor: the round-2 sweep answer — stubble over the
  // whole disc so no pose lands on bare mustard by accident. Re-pass:
  // this family IS the owner's "half-cut grass everywhere" — 3,600 card
  // wedges — so it carries the heaviest upgrade: the 48-tri "blade"
  // S-bend clumps, the sun-through-leaf glow, and a raised looseShare
  // (F-R2) so any random view cone owns loose singles between clumps.
  // Re-pass round 2: r1's looseShare 0.55 spread the clumps so thin the
  // close-meadow pose owned nothing — back to 0.45 (singles still
  // guaranteed, hearts visible again), count 3,600 → 4,200, and the
  // root shade off dark olive (the lower two-thirds of a small blade is
  // root-to-base colour; that is what the eye actually gets).
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetTurf,
      palette: { base: 0x9cb968, tip: 0xcfe084, shade: 0x74814f },
      area: discAreaAt(350, 0, 320),
      gate: turfGate,
      ground: seabedHeight,
      // Round 3: 4,200 → 4,800 and a touch taller — the close-meadow
      // pose's near metre still owned too few blades.
      count: 4800,
      profile: "blade",
      size: [0.32, 0.66],
      swayAmp: 0.035,
      looseShare: 0.45,
      sunGlow: true,
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
      // Re-pass: knee-high crossed wedges → knee-high S-bend clumps; the
      // family whose whole job is standing in the near layer takes the
      // authored silhouette and a raised loose share (F-R2).
      count: 520,
      profile: "blade",
      size: [0.6, 1.1],
      swayAmp: 0.05,
      looseShare: 0.5,
      sunGlow: true,
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
      // Re-pass: same profile upgrade as its parent tussock family; the
      // stand stays CLUMPED (default looseShare) — concentration was the
      // whole point of round 7's fix for the outward-facing pose.
      profile: "blade",
      size: [0.5, 0.95],
      swayAmp: 0.05,
      sunGlow: true,
    }),
  );

  // The sward: the meadows' swell crests carry the green the paint began.
  // Re-pass: the sunniest grass in the region moves to "blade" with the
  // sun glow — the swells should read as backlit eelgrass, not stubble.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetSward,
      // Round 2: root shade a value up; 2,400 → 2,750 so the crests'
      // green carries down their own shoulders toward the close pose.
      palette: { base: 0x82c46e, tip: 0xb2e884, shade: 0x6f9a66 },
      area: meadowArea(),
      gate: swardGate,
      ground: seabedHeight,
      count: 2750,
      profile: "blade",
      size: [0.26, 0.55],
      swayAmp: 0.045,
      looseShare: 0.4,
      sunGlow: true,
    }),
  );

  // The forest litter, in two warm tones so the drifts read as seasons of
  // leaf-fall rather than one pour (fill plan §3 — golden-olive, held off
  // rust: round 3's redder litter dried into shipwreck colour). Re-pass:
  // the "frond" rosette at ankle height — five cupped straps drooped past
  // horizontal READ as curled shed leaves lying where they fell, which is
  // what a card wedge never managed at swimming distance.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetLitterA,
      // Round 2: whole ramp a half-step up — r1's drifts read as dark
      // specks on the forest floor's own paint.
      palette: { base: 0xc7b273, tip: 0xe6d47e, shade: 0xa39176 },
      area: discAreaAt(450, -10, 118),
      gate: litterGate,
      ground: seabedHeight,
      count: 950,
      profile: "frond",
      size: [0.18, 0.36],
    }),
  );
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetLitterB,
      palette: { base: 0xaaa668, tip: 0xccc878, shade: 0x8c8866 },
      area: discAreaAt(450, -10, 118),
      gate: litterGate,
      ground: seabedHeight,
      count: 950,
      profile: "frond",
      size: [0.18, 0.36],
    }),
  );

  // The maze's silt bloom: a violet family whose red stays above green —
  // the gully floors carry their own half-light growth now. Re-pass: the
  // "bloom" finally looks like one — frond rosettes instead of chips. No
  // sun glow: the maze is the half-light quarter, and its growth carrying
  // the sun's note would argue with the register.
  // Round 2: the r1 fronds sat at the maze paint's own value and
  // vanished — the whole ramp steps up (red still above green), the
  // rosettes grow to [0.2, 0.4], and 1,100 → 1,300 so the bloom is a
  // bloom. Still no sunGlow: the half-light register holds.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetSilt,
      palette: { base: 0xa393c0, tip: 0xc2abd8, shade: 0x877a9c },
      area: discAreaAt(495, -82, 60),
      gate: siltGate,
      ground: seabedHeight,
      count: 1450,
      profile: "frond",
      size: [0.2, 0.4],
      swayAmp: 0.02,
    }),
  );

  // The Falling Edge's shell scatter: milky-pale, thinning outward. The
  // ONE family that keeps "card" through the re-pass, deliberately: it
  // draws shell chips, not plants — a flat bent quad at 0.16–0.32 m is a
  // shell's own silhouette, and the R12 near profiles would turn the
  // decrescendo's chips into grass it never claimed to be. (The region
  // consumes no farGrassCards, so there is no nearFade case to guard.)
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetShell,
      palette: { base: 0xcfc7ae, tip: 0xe8e2cc, shade: 0x9a8f80 },
      area: edgeArea(),
      gate: shellGate,
      ground: seabedHeight,
      count: 960,
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
      // Re-pass: the light peak's own band gets the blade clumps and the
      // glow — this is where the sun-through-leaf note pays most.
      profile: "blade",
      size: [0.2, 0.42],
      swayAmp: 0.04,
      sunGlow: true,
    }),
  );

  // ─── Pebbles, rubble, debris ─────────────────────────────────────────────
  // Re-pass: the runs adopt the R12 `grade` hierarchy — clump hearts
  // anchor formed foreground stones, the loose fill thins — so the road's
  // pebbles read as gathered drifts instead of even confetti.
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
      grade: 0.55,
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
      grade: 0.5,
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
      // stone instead of 20. Re-pass: graded hard — a gully floor's piles
      // gather at the roots, they don't fall evenly.
      shapeSet: "shard",
      grade: 0.65,
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

  // ─── R12.3 — the headroom spend (fresh 0xf21x/0xf22x streams, appended
  // after every draw above; the reroll fence holds) ─────────────────────────

  // Holdfast skirt-grass collars: a ring of blade clumps seated just
  // outside every giant's root knuckles, so a trunk grows out of GROWTH
  // instead of out of a collar on bare paint — the single change the
  // close forest poses wanted most.
  const feet = giants.map((giant) => ({ x: giant.x, z: giant.z }));
  const footLine: [number, number][] = feet.map((foot) => [foot.x, foot.z]);
  const nearestFoot = (x: number, z: number): number => {
    let best = Infinity;
    for (const foot of feet) {
      const d = Math.hypot(x - foot.x, z - foot.z);
      if (d < best) {
        best = d;
      }
    }
    return best;
  };
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetSkirtGrass,
      palette: { base: 0x86a75c, tip: 0xb8d778, shade: 0x5a6a48 },
      area: { polyline: footLine, width: 7 },
      gate: (x, z) => {
        const d = nearestFoot(x, z);
        return (
          smoothstep01((d - 0.9) / 0.5) *
          (1 - smoothstep01((d - 2.4) / 0.8)) *
          restFree(x, z)
        );
      },
      ground: seabedHeight,
      count: 430,
      profile: "blade",
      size: [0.4, 0.8],
      swayAmp: 0.04,
      looseShare: 0.5,
      sunGlow: true,
    }),
  );

  // The forest ferns: a mid-value frond understory between the trunks —
  // the leaf-fall lies flat, the ferns stand out of it, and the floor
  // finally has the two heights a forest floor has.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetFerns,
      // Round 2: a value up (r1's ferns melted into the floor paint) and
      // 650 → 800 — the understory should be findable in any eave frame.
      palette: { base: 0x79ad66, tip: 0xa8da80, shade: 0x5b7e52 },
      area: discAreaAt(450, -10, 118),
      gate: litterGate,
      ground: seabedHeight,
      count: 800,
      profile: "frond",
      size: [0.3, 0.55],
      swayAmp: 0.03,
      looseShare: 0.4,
    }),
  );

  // The vale's road-edge stands: thigh-high blades lining the channel
  // where its floor meets the wall feet — the road reads as a mown lane
  // through TALL growth now, which is what "the road is a place" looks
  // like at swimming height. Dies before the crest rest, like the moss.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetValeStands,
      palette: { base: 0x7fb060, tip: 0xb4dd7c, shade: 0x5d7a4e },
      area: valeChannelArea(58, 246, 22),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        if (u < 58 || u > 246) {
          return 0;
        }
        const off = Math.abs(v - valeChannelCenter(u));
        const half = valeChannelHalf(u);
        const band =
          smoothstep01((off - (half - 2)) / 1.5) *
          (1 - smoothstep01((off - (half + 4)) / 2.5));
        const beforeCrest = 1 - smoothstep01((u - 240) / 8);
        return band * beforeCrest * restFree(x, z);
      },
      ground: seabedHeight,
      count: 380,
      profile: "blade",
      size: [0.8, 1.45],
      swayAmp: 0.06,
      looseShare: 0.45,
      sunGlow: true,
    }),
  );

  // The forest aisle's wayside stands: the same tall-blade idea along the
  // swim line's shoulders (3.5–9 m off it — the line itself stays clear),
  // so the aisle is an avenue through standing grass, not across paint.
  const aislePolyline: [number, number][] = [];
  for (const u of [305, 330, 355, 380, 405, 430, 455, 480]) {
    const { x, z } = worldOf(u, aisleAt(u));
    aislePolyline.push([x, z]);
  }
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.carpetAisleStands,
      palette: { base: 0x74a85e, tip: 0xa6d478, shade: 0x53724c },
      area: { polyline: aislePolyline, width: 22 },
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        const aisle = aisleDistance(u, v);
        if (!Number.isFinite(aisle)) {
          return 0;
        }
        const band =
          smoothstep01((aisle - 3.5) / 1.5) * (1 - smoothstep01((aisle - 9) / 3));
        return (
          band *
          forestWeight(u, v) *
          (1 - sunwellWeight(u, v)) *
          (1 - mazeWeight(u, v)) *
          restFree(x, z)
        );
      },
      ground: seabedHeight,
      count: 320,
      profile: "blade",
      size: [0.7, 1.3],
      swayAmp: 0.05,
      looseShare: 0.45,
      sunGlow: true,
    }),
  );

  // The maze's split stones: formed fracture-faced rock among the shard
  // rubble — the R12 `"split"` family, graded so the gully floors carry
  // foreground stones a close pose can rest on.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.mazeSplitStones,
      palette: { base: 0x9a8fa8, shade: 0x6b6080 },
      area: discAreaAt(495, -82, 58),
      gate: siltGate,
      ground: seabedHeight,
      count: 260,
      shapeSet: "split",
      size: [0.14, 0.34],
      grade: 0.6,
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
