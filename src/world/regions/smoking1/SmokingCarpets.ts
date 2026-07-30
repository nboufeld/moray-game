import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { Random } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildCarpetField, type CarpetFieldBuild } from "../kit/CarpetField";
import { buildBushBank } from "../kit/BushBank";
import { buildGroundLitter } from "../kit/GroundLitter";
import { buildMatRings, type MatAnchor } from "../kit/MatRings";
import { buildScreeApron, type ScreeAnchor } from "../kit/ScreeApron";
import type { GateFn, KitArea, KitBuild } from "../kit/KitTypes";
import type { ChimneyStand } from "./SmokingChimneys";
import { smoothstep01 } from "./SmokingShared";
import { FILL_SEEDS, restFree } from "./SmokingFillShared";
import {
  BASALT,
  CALDERA,
  CHIMNEYS,
  GORGE_TO,
  KILN,
  SPRINGS,
  basaltWeight,
  calderaWeight,
  chimneysWeight,
  gorgeChannelCenter,
  gorgeChannelHalf,
  shoreWeight,
  smokingWeight,
  spokeOf,
  springsStair,
  springsWeight,
  worldOf,
} from "./SmokingTerrain";
import { COLONNADE, ORGAN } from "./SmokingBasalt";

/**
 * The Smoulder Fields' T1 ground cover — the doctrine's "no square metre
 * bare by accident", spent as kit calls (fill plan §3's zone table). The
 * fill is what a hot floor FEEDS, never clutter:
 *
 * - **black-cinder gravel runs** down the gorge channel and its wall
 *   feet, starting AT the wing seam at the wing's own sparse density and
 *   thickening over 25 m (transitions are gradients — plan §8);
 * - **ash-ripple pebble drifts** across the flats' resting ground;
 * - **scoria cobble drifts** along the Ember Shore, clumped so they read
 *   as windrows every 25–35 m;
 * - **sinter shard litter** on the spring terraces, **joint litter** on
 *   the basalt treads, **ember gravel** under the chimney forest, and an
 *   **ember cobble run** down the caldera's south inner wall;
 * - **thermophile mat rings** — the region's exclusive signature (MASTER
 *   R8): tiered sinter/amber/rust discs on the spring stair, single mats
 *   on the flats' road, small warm seep-stain mats down the gorge, and
 *   ember-hearted seam mats at the kiln's feet;
 * - **column scree** at the colonnade/organ feet and **foot aprons** at
 *   every smoker (things grow FROM somewhere);
 * - **sulfur tufts** — the standing near-layer for the flats, the outer
 *   rim flank band (MASTER field note F-R3: rim-facing sweep poses must
 *   find their three layers inside ~35 m) and the shore;
 * - **smoke-bushes** — the third exclusive: charcoal lobes, ember-tipped.
 *
 * Every palette is painted for THIS region's light (the warm-grey fog
 * product): warm greys and embers over violet shadows, values held a
 * step off the ground paint so the cover SILHOUETTES instead of
 * converging with its own floor (verdant-1's round-7 lesson). Every call
 * takes a fresh `SEEDS.regionSmoking1 ^ FILL_SEEDS.*` stream (the reroll
 * fence) and multiplies {@link restFree} into its gate so all six
 * registered rests stay composed bareness.
 */

const SEED = SEEDS.regionSmoking1;

export interface SmokingCarpetsBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

/** The gorge channel as a kit road area, stations every ~12 m of spoke. */
function gorgeArea(fromU: number, toU: number, width: number): KitArea {
  const polyline: [number, number][] = [];
  for (let u = fromU; u <= toU; u += 12) {
    const { x, z } = worldOf(u, gorgeChannelCenter(u));
    polyline.push([x, z]);
  }
  return { polyline, width };
}

function discAreaAt(u: number, v: number, radius: number): KitArea {
  const { x, z } = worldOf(u, v);
  return { center: [x, z], radius };
}

/** The shore shelf as a road area out to the rim fade. */
function shoreArea(): KitArea {
  const polyline: [number, number][] = [];
  for (const u of [552, 582, 612, 642]) {
    const { x, z } = worldOf(u, 4);
    polyline.push([x, z]);
  }
  return { polyline, width: 130 };
}

// ─── The gates ───────────────────────────────────────────────────────────────

/** Cinder gravel holds the channel and wall feet; sparse at the seam. */
const gorgeGravelGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 48 || u > GORGE_TO) {
    return 0;
  }
  // The doorway band stays light: wing density at the seam, full by ~80.
  const thicken = 0.22 + 0.78 * smoothstep01((u - 52) / 28);
  const offCenter = Math.abs(v - gorgeChannelCenter(u));
  const inChannel = 1 - smoothstep01((offCenter - gorgeChannelHalf(u) - 3) / 6);
  return thicken * inChannel * restFree(x, z);
};

/** Ash-ripple pebbles rest where the flats own the floor. */
const flatsRippleGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 282) {
    return 0;
  }
  const open =
    (1 - basaltWeight(u, v) * 0.8) *
    (1 - springsWeight(u, v)) *
    (1 - chimneysWeight(u, v)) *
    (1 - calderaWeight(u, v)) *
    (1 - shoreWeight(u) * 0.65);
  return open * restFree(x, z) * smokingWeight(x, z);
};

/** Scoria drifts thin off the shelf into the rim fade. */
const scoriaGate: GateFn = (x, z) => {
  const { u } = spokeOf(x, z);
  return shoreWeight(u) * (1 - smoothstep01((u - 648) / 20)) * restFree(x, z) * smokingWeight(x, z);
};

const springShardGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return springsWeight(u, v) * restFree(x, z);
};

const basaltLitterGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return basaltWeight(u, v) * restFree(x, z);
};

const forestGravelGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return chimneysWeight(u, v) * (1 - calderaWeight(u, v)) * restFree(x, z);
};

/** The ember cobble run: the caldera's south inner wall, rim gap → kiln. */
const calderaCobbleGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const d = Math.hypot(u - CALDERA.u, v - CALDERA.v);
  if (d < 6 || d > 50) {
    return 0;
  }
  return calderaWeight(u, v) * restFree(x, z);
};

/**
 * Sulfur tufts: the flats' and the rim flanks' standing near-layer. The
 * outer annulus boost is the F-R3 flank band — a rim-facing sweep pose
 * must find something standing inside its first ~35 m.
 */
const sulfurGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 280) {
    return 0;
  }
  const rc = Math.hypot(u - 445, v);
  const flank = 0.5 + 0.5 * smoothstep01((rc - 120) / 45);
  const open =
    (1 - basaltWeight(u, v) * 0.7) *
    (1 - springsWeight(u, v) * 0.85) *
    (1 - chimneysWeight(u, v) * 0.6) *
    (1 - calderaWeight(u, v));
  return flank * open * restFree(x, z) * smokingWeight(x, z);
};

const smokeBushFlatsGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 285) {
    return 0;
  }
  const open =
    (1 - basaltWeight(u, v)) *
    (1 - springsWeight(u, v)) *
    (1 - calderaWeight(u, v)) *
    (1 - chimneysWeight(u, v) * 0.5);
  return open * restFree(x, z) * smokingWeight(x, z);
};

const smokeBushForestGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const forest = chimneysWeight(u, v);
  const shore = shoreWeight(u);
  return Math.max(forest * 0.9, shore * 0.7) * (1 - calderaWeight(u, v)) * restFree(x, z) * smokingWeight(x, z);
};

// ─── The build ───────────────────────────────────────────────────────────────

export function buildSmokingCarpets(stands: readonly ChimneyStand[]): SmokingCarpetsBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (build: KitBuild | CarpetFieldBuild): void => {
    groups.push(build.group);
    if ("update" in build) {
      updaters.push((timeSec) => build.update(timeSec));
    }
  };

  // ─── Gravel, pebbles, shards (T1 litter) ─────────────────────────────────
  // Black-cinder gravel: charcoal held as a warm violet-grey — the darkest
  // fill is a colour, never black — with a warm second tone so the run
  // reads as mixed cinder under the amber water.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.gorgeGravel,
      palette: { base: 0x74616c, accent: 0x8d6a58, shade: 0x594c62 },
      area: gorgeArea(50, 290, 16),
      gate: gorgeGravelGate,
      ground: seabedHeight,
      count: 1300,
      shapeSet: "gravel",
      size: [0.07, 0.2],
      twoTone: true,
    }),
  );

  // The flats' ash-ripple drifts: pale grey-violet pebbles, wind-laid.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.flatsRipple,
      palette: { base: 0xa2949c, accent: 0xb2a191, shade: 0x7c7186 },
      area: discAreaAt(370, 0, 150),
      gate: flatsRippleGate,
      ground: seabedHeight,
      count: 850,
      shapeSet: "pebble",
      twoTone: true,
    }),
  );

  // The shore's scoria cobbles, clumped into windrows.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.shoreScoria,
      palette: { base: 0x84695f, accent: 0x9c8d7c, shade: 0x64556a },
      area: shoreArea(),
      gate: scoriaGate,
      ground: seabedHeight,
      count: 560,
      shapeSet: "gravel",
      size: [0.08, 0.24],
      twoTone: true,
    }),
  );

  // Sinter shard litter around the spring terraces' pale stair.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.springShards,
      palette: { base: 0xe0d2b2, shade: 0xa89684 },
      area: discAreaAt(SPRINGS.u, SPRINGS.v, 54),
      gate: springShardGate,
      ground: seabedHeight,
      count: 420,
      shapeSet: "shard",
      size: [0.06, 0.18],
    }),
  );

  // Joint litter on the basalt treads: the columns' own chips.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.basaltJointLitter,
      palette: { base: 0x8d8076, shade: 0x685e70 },
      area: discAreaAt(BASALT.u, BASALT.v, 78),
      gate: basaltLitterGate,
      ground: seabedHeight,
      count: 520,
      shapeSet: "shard",
      size: [0.07, 0.2],
    }),
  );

  // Ember gravel under the chimney forest — the floor the vents feed.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.forestEmberGravel,
      palette: { base: 0x77605a, accent: 0xa25e3e, shade: 0x5a4a60 },
      area: discAreaAt(CHIMNEYS.u, CHIMNEYS.v, 60),
      gate: forestGravelGate,
      ground: seabedHeight,
      count: 640,
      shapeSet: "gravel",
      size: [0.06, 0.18],
      twoTone: true,
    }),
  );

  // The caldera's ember cobble run: down the inner wall from the south
  // gap to the kiln — the north floor quadrant is the registry's rest.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.calderaCobbleRun,
      palette: { base: 0x77617a, accent: 0xa25e42, shade: 0x584a64 },
      area: {
        polyline: [
          worldOf(CALDERA.u - 6, CALDERA.v - 50),
          worldOf(CALDERA.u - 2, CALDERA.v - 34),
          worldOf(KILN.u + 1, KILN.v - 18),
          worldOf(KILN.u, KILN.v - 7),
        ].map(({ x, z }) => [x, z] as [number, number]),
        width: 10,
      },
      gate: calderaCobbleGate,
      ground: seabedHeight,
      count: 300,
      shapeSet: "gravel",
      size: [0.08, 0.22],
      twoTone: true,
    }),
  );

  // ─── The thermophile mat rings (exclusive signature, MASTER R8) ──────────
  // The spring stair's tiers: sinter heart, amber mid, rust ring, a dark
  // mineral skirt dissolving out — the Yellowstone note nothing else in
  // the game may wear.
  const springAnchors: MatAnchor[] = [];
  const anchorRandom = new Random(SEED ^ FILL_SEEDS.matsSprings ^ 0x0a);
  let guard = 0;
  while (springAnchors.length < 12 && guard++ < 240) {
    const theta = anchorRandom.range(0, Math.PI * 2);
    const d = 8 + Math.sqrt(anchorRandom.next()) * 38;
    const u = SPRINGS.u + Math.cos(theta) * d;
    const v = SPRINGS.v + Math.sin(theta) * d;
    if (springsWeight(u, v) < 0.45) {
      continue;
    }
    const { x, z } = worldOf(u, v);
    if (restFree(x, z) < 0.7) {
      continue;
    }
    // Seat each mat on one tread: springsStair's pooled bench is flat
    // there, so the drape stays a disc instead of breaking on a riser.
    const { raw } = springsStair(u, v);
    const frac = raw / 1.1 - Math.floor(raw / 1.1);
    if (frac > 0.55) {
      continue;
    }
    if (springAnchors.some((a) => Math.hypot(a.pos[0] - x, a.pos[1] - z) < 4.5)) {
      continue;
    }
    springAnchors.push({ pos: [x, z], radius: anchorRandom.range(1.7, 3.1) });
  }
  keep(
    buildMatRings({
      seed: SEED ^ FILL_SEEDS.matsSprings,
      bands: [
        { color: 0xecdfc0, width: 1.1 },
        { color: 0xdd9a4c, width: 1.0 },
        { color: 0xa85c34, width: 0.9 },
        { color: 0x7a5a54, width: 0.7 },
      ],
      ground: seabedHeight,
      anchors: springAnchors,
      tiers: 2,
    }),
  );

  // The flats' road rings: the reveal cadence's mat ring at u 285 and
  // three sisters along the fork roads — all outside the rest bar.
  keep(
    buildMatRings({
      seed: SEED ^ FILL_SEEDS.matsFlats,
      bands: [
        { color: 0xe4d5b4, width: 1.0 },
        { color: 0xd08e46, width: 1.0 },
        { color: 0x9a5836, width: 0.8 },
        { color: 0x74565c, width: 0.7 },
      ],
      ground: seabedHeight,
      anchors: [
        { pos: matSpot(285, -4), radius: 2.6 },
        { pos: matSpot(303, 24), radius: 2.0 },
        { pos: matSpot(318, -26), radius: 2.3 },
        { pos: matSpot(366, 30), radius: 1.9 },
      ],
    }),
  );

  // The gorge's warm seep-stain mats: small, on the reveal cadence's own
  // stations (78, 105, 145, 175, 215, 240) — the road is never bare for
  // more than ~30 m, and every mat agrees with a glow mark or a frond
  // bank so the heat reads as a SYSTEM.
  keep(
    buildMatRings({
      seed: SEED ^ FILL_SEEDS.matsGorgeSeeps,
      bands: [
        { color: 0xd39a54, width: 1.0 },
        { color: 0x96543c, width: 0.9 },
        { color: 0x64484e, width: 0.7 },
      ],
      ground: seabedHeight,
      anchors: [78, 105, 145, 175, 215, 240].map((u, i) => ({
        pos: matSpot(u, gorgeChannelCenter(u) + (i % 2 === 0 ? 1.6 : -1.8)),
        radius: 1.1 + (i % 3) * 0.45,
      })),
    }),
  );

  // The kiln's seam mats: ember hearts at the old thing's feet — south,
  // west and east; the north floor quadrant keeps its registered quiet.
  keep(
    buildMatRings({
      seed: SEED ^ FILL_SEEDS.matsKilnSeams,
      bands: [
        { color: 0xdd7a40, width: 0.9 },
        { color: 0x9a5436, width: 1.0 },
        { color: 0x62486a, width: 0.8 },
      ],
      ground: seabedHeight,
      anchors: [
        { pos: matSpot(KILN.u - 1, KILN.v - 8.5), radius: 1.6 },
        { pos: matSpot(KILN.u - 8, KILN.v - 3), radius: 1.3 },
        { pos: matSpot(KILN.u + 8.5, KILN.v - 2), radius: 1.4 },
      ],
    }),
  );

  // ─── Column scree (things grow FROM somewhere) ───────────────────────────
  const screeRandom = new Random(SEED ^ FILL_SEEDS.screeColumns ^ 0x0a);
  const columnAnchors: ScreeAnchor[] = [];
  // The colonnade's two rows shed toward the aisle's shoulders.
  const along = { u: Math.cos(COLONNADE.heading), v: Math.sin(COLONNADE.heading) };
  const across = { u: -along.v, v: along.u };
  for (let i = 0; i < 6; i += 2) {
    const s = (i - 2.5) * 4.6;
    for (const side of [-1, 1]) {
      const u = COLONNADE.u + along.u * s + across.u * side * 4.5;
      const v = COLONNADE.v + along.v * s + across.v * side * 4.5;
      const { x, z } = worldOf(u, v);
      columnAnchors.push({
        pos: [x, z],
        facing: Math.atan2(z - worldOf(COLONNADE.u, COLONNADE.v).z, x - worldOf(COLONNADE.u, COLONNADE.v).x),
        spread: screeRandom.range(2.2, 3.4),
      });
    }
  }
  // The organ pipes shed outward from the crown's half-circle.
  for (let i = 0; i < 13; i += 2) {
    const theta = -0.4 + (i / 12) * Math.PI * 1.15;
    const u = ORGAN.u + Math.cos(theta) * 10.5;
    const v = ORGAN.v + Math.sin(theta) * 10.5;
    const { x, z } = worldOf(u, v);
    const center = worldOf(ORGAN.u, ORGAN.v);
    columnAnchors.push({
      pos: [x, z],
      facing: Math.atan2(z - center.z, x - center.x),
      spread: screeRandom.range(2.4, 3.6),
    });
  }
  keep(
    buildScreeApron({
      seed: SEED ^ FILL_SEEDS.screeColumns,
      palette: { base: 0x84776f, shade: 0x5c5064 },
      ground: seabedHeight,
      anchors: columnAnchors,
      slabsPerAnchor: 7,
    }),
  );

  // Every smoker's foot wears an apron of shed sinter — the forest floor
  // grows from its own trees. Fanned downslope-ish by seeded bearing.
  const chimneyRandom = new Random(SEED ^ FILL_SEEDS.screeChimneys ^ 0x0a);
  const footAnchors: ScreeAnchor[] = stands.map((stand) => ({
    pos: [stand.x, stand.z],
    facing: chimneyRandom.range(0, Math.PI * 2),
    spread: chimneyRandom.range(1.8, 3.2) * Math.max(0.7, stand.height / 12),
  }));
  keep(
    buildScreeApron({
      seed: SEED ^ FILL_SEEDS.screeChimneys,
      palette: { base: 0x6e6058, shade: 0x50465c },
      ground: seabedHeight,
      anchors: footAnchors,
      slabsPerAnchor: 5,
    }),
  );

  // ─── The standing near-layer ─────────────────────────────────────────────
  // Sulfur tufts: bone-sulfur crossed tufts over the flats, the shore and
  // the outer flank band — knee-high so a pose finds a silhouette, not
  // just paint (values a step off the ash so they never converge).
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.sulfurTufts,
      palette: { base: 0xbfae76, tip: 0xe4d494, shade: 0x877a62 },
      area: discAreaAt(445, 0, 212),
      gate: sulfurGate,
      ground: seabedHeight,
      count: 620,
      profile: "tuft",
      size: [0.4, 0.78],
      swayAmp: 0.045,
    }),
  );

  // ─── The smoke-bushes (exclusive) ────────────────────────────────────────
  // Charcoal lobes, ember-tipped: the flats' and forest's understory.
  keep(
    buildBushBank({
      seed: SEED ^ FILL_SEEDS.smokeBushFlats,
      palette: { base: 0x6e5666, tip: 0xa5684a, shade: 0x4e4458 },
      area: discAreaAt(352, 8, 95),
      gate: smokeBushFlatsGate,
      ground: seabedHeight,
      count: 24,
    }),
  );
  keep(
    buildBushBank({
      seed: SEED ^ FILL_SEEDS.smokeBushForest,
      palette: { base: 0x66505e, tip: 0xa8603e, shade: 0x483e52 },
      area: discAreaAt(548, -24, 120),
      gate: smokeBushForestGate,
      ground: seabedHeight,
      count: 24,
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
