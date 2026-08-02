import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBushBank } from "../kit/BushBank";
import { buildCarpetField, type CarpetFieldBuild } from "../kit/CarpetField";
import { buildDriftDebris } from "../kit/DriftDebris";
import { buildGroundLitter } from "../kit/GroundLitter";
import { buildScreeApron, type ScreeAnchor } from "../kit/ScreeApron";
import type { GateFn, KitArea, KitBuild } from "../kit/KitTypes";
import {
  CLOSE_LENSES,
  DRIFT_BEATS,
  SPINE_ROAD,
  beatDepth,
  chainDistance,
  lensFree,
  restFree,
  roadDistance,
} from "./Blue3Beats";
import { B3_SEEDS, smoothstep01 } from "./Blue3Shared";
import {
  ANCHOR,
  CENTER_X,
  CENTER_Z,
  CHAIN_LINKS,
  CRADLE_SPINE,
  DAYMARK,
  FALL_FROM,
  FALL_TO,
  blue3Weight,
  cradleCarve,
  cradleDistance,
  passFillOwn,
  passGate,
  spokeOf,
  wellD,
  worldOf,
} from "./Blue3Terrain";

/**
 * THE FIRST SEA's T1/T2 cover — the province's voice, kept to the last
 * room: COMPOSED EMPTINESS. The sparsest fill in the program ON
 * PURPOSE: the three-layer law is satisfied by the star-bloom paint,
 * the ripple grain, drift-gathered tuft stands and the geography
 * itself, never by gardens. Everything green wears the kit's
 * blade/frond profiles (no card wedges near a camera — R12), every
 * family carries the dusk-lift its register needs, every gate
 * multiplies {@link restFree} so the five registered rests stay
 * composed bareness, and every close pose's subject is its own
 * authored bed (the lily-bench law, paid up front).
 *
 * Where the life gathers tells the story: the Cradle's banks carry the
 * region's only green — life clings to the newborn river — while the
 * Mere carries pale rose-violet tufts thinning toward the Wide
 * Morning, and the fall carries the road's own moss.
 */

const SEED = SEEDS.regionBlue3;

export interface Blue3CoverBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

/** The region-side dusk lift; the kit stays palette-pure. */
function duskLift(build: KitBuild | CarpetFieldBuild, hex: number, intensity: number): void {
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
  return { center: [CENTER_X, CENTER_Z], radius: 228 };
}

function discAreaAt(u: number, v: number, radius: number): KitArea {
  const { x, z } = worldOf(u, v);
  return { center: [x, z], radius };
}

function polylineArea(line: readonly (readonly [number, number])[], width: number): KitArea {
  const polyline: [number, number][] = line.map(([u, v]) => {
    const { x, z } = worldOf(u, v);
    return [x, z] as [number, number];
  });
  return { polyline, width };
}

// ─── Shared gate arithmetic ──────────────────────────────────────────────────

/**
 * Fill ownership (the Carillon Waste's round-3 law): the road's fill
 * is ours the moment the bounds are — the 0.14 treaty whisper is not a
 * bareness licence. Identical support to the weight.
 */
function fillOwn(x: number, z: number): number {
  return Math.max(blue3Weight(x, z), passFillOwn(x, z));
}

/** The country bands, along the journey's own coordinate. */
function fallBand(u: number): number {
  return smoothstep01((u - (FALL_FROM - 6)) / 10) * (1 - smoothstep01((u - FALL_TO) / 14));
}
function mereBand(u: number): number {
  return smoothstep01((u - FALL_TO + 16) / 20);
}

/** Standing stone footprints the cover keeps out of. */
function stoneFree(u: number, v: number): number {
  let free = 1;
  for (const link of CHAIN_LINKS) {
    free = Math.min(free, smoothstep01((Math.hypot(u - link.u, v - link.v) - 3.2) / 1.4));
  }
  free = Math.min(free, smoothstep01((Math.hypot(u - ANCHOR.u, v - ANCHOR.v) - 9) / 2));
  free = Math.min(free, smoothstep01((Math.hypot(u - DAYMARK.u, v - DAYMARK.v) - 2) / 1.2));
  return free;
}

/** The river bed itself stays clear — the water is the cover there. */
function bedFree(u: number, v: number): number {
  return 1 - cradleCarve(u, v).bed * smoothstep01((5 - cradleDistance(u, v).d) / 3);
}

/** The crater keeps its own floor: nothing stands inside the bowl or
 *  on the painted rim rings; the crags and the breath own it. */
function craterFree(u: number, v: number): number {
  return smoothstep01((wellD(u, v) - 24) / 5);
}

/** T1 ripple grit: the whole country's close-range grain. */
const gritGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const country =
    fallBand(u) * 0.85 +
    mereBand(u) * 0.55 +
    smoothstep01((u - 1238) / 8) * (1 - smoothstep01((u - 1254) / 6)) * 0.8;
  const road = 1 - smoothstep01((roadDistance(u, v) - 9) / 14) * 0.4;
  return fillOwn(x, z) * restFree(x, z) * Math.min(1, country) * road * bedFree(u, v) * craterFree(u, v);
};

/** The shelf road's pale pebbles (outside the hush; never below the
 *  crest — the wall band u < 1178 stays untouched). */
const shelfPebbleGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 1180 || u > 1258) {
    return 0;
  }
  const shoulder = smoothstep01((Math.abs(v) - 3) / 3) * (1 - smoothstep01((Math.abs(v) - 20) / 8));
  return fillOwn(x, z) * restFree(x, z) * shoulder;
};

/** The Mere's tufts: pale rose-violet stands, drift-gathered along the
 *  star-bloom's own constellations — never a lawn. */
const mereTuftGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const band = mereBand(u);
  if (band <= 0) {
    return 0;
  }
  const drift = smoothstep01((Math.sin(u * 0.11 + v * 0.07) + 0.45) / 1.15);
  const beat = beatDepth(u, v);
  const chainLee = 1 - smoothstep01((chainDistance(u, v) - 4) / 9);
  return (
    fillOwn(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    stoneFree(u, v) *
    bedFree(u, v) *
    craterFree(u, v) *
    band *
    Math.min(1, drift * 0.42 + beat + chainLee * 0.6)
  );
};

/** The Cradle's banks: the region's only green. */
const bankBladeGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const { d: cd, t } = cradleDistance(u, v);
  const bank = smoothstep01((cd - 2.8) / 2.2) * (1 - smoothstep01((cd - 14) / 7));
  if (bank <= 0 || t < 0.12) {
    return 0;
  }
  return (
    fillOwn(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    stoneFree(u, v) *
    craterFree(u, v) *
    bank
  );
};

/** Bank fronds: rosettes crowding the levees at the Shallows and the
 *  Overbrim's tail. */
const bankFrondGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const { d: cd, t } = cradleDistance(u, v);
  const bank = smoothstep01((cd - 2.4) / 1.8) * (1 - smoothstep01((cd - 9) / 5));
  if (bank <= 0 || t < 0.12) {
    return 0;
  }
  const chapters = Math.max(
    1 - smoothstep01((Math.abs(t - 0.44) - 0.09) / 0.09),
    1 - smoothstep01((Math.abs(t - 0.2) - 0.08) / 0.08),
  );
  return fillOwn(x, z) * restFree(x, z) * lensFree(x, z) * stoneFree(u, v) * bank * chapters;
};

/** The Longfall's moss: pale blades pacing the road's descent. */
const fallMossGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const band = fallBand(u);
  if (band <= 0) {
    return 0;
  }
  const near = 1 - smoothstep01((roadDistance(u, v) - 15) / 10);
  const comb = smoothstep01((Math.sin(v * 0.34 + u * 0.05) + 0.35) / 1.2);
  // Round 3: the off-road floor rises 0.25 → 0.42 — the sweep's
  // down-look at the fall's open face found only paint.
  return fillOwn(x, z) * restFree(x, z) * lensFree(x, z) * stoneFree(u, v) * band * (0.42 + 0.58 * near) * (0.4 + 0.6 * comb);
};

/** The deep star-tufts: sparse dark-register cover ringing the crater
 *  and the fall's foot. */
const starTuftGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const wd = wellD(u, v);
  const ring =
    smoothstep01((wd - 26) / 6) * (1 - smoothstep01((wd - 52) / 14)) +
    smoothstep01((u - FALL_TO + 6) / 8) * (1 - smoothstep01((u - FALL_TO - 26) / 12)) * 0.7;
  if (ring <= 0) {
    return 0;
  }
  const drift = smoothstep01((Math.sin(wd * 0.8 + v * 0.03) + 0.5) / 1.1);
  return (
    blue3Weight(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    stoneFree(u, v) *
    bedFree(u, v) *
    Math.min(1, ring) *
    (0.35 + 0.65 * drift)
  );
};

/** The Hem's lower slope + the rim-facing flank band (F-R3). Round 3:
 *  the band reaches 210 (the r2 cut at 206 left the upper face the
 *  sweep grazes bare), and the Longfall's flank walls join. */
const wallTuftGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  const hem = smoothstep01((rc - 148) / 26) * (1 - smoothstep01((rc - 210) / 10));
  const flank =
    u > 1252 && u < 1380
      ? smoothstep01((Math.abs(v) - 36) / 10) * (1 - smoothstep01((Math.abs(v) - 62) / 12)) * 0.7
      : 0;
  const wall = Math.max(hem, flank);
  if (wall <= 0) {
    return 0;
  }
  const offCorridor = 1 - passGate(u, v);
  const beat = beatDepth(u, v);
  // Round 5: the beat floor rises 0.45 → 0.62 — the east and north
  // faces sit between drift beats, and their graze frames (sweep
  // 04/09) got the band's thinnest draw.
  return (
    blue3Weight(x, z) * restFree(x, z) * lensFree(x, z) * wall * offCorridor * (0.62 + 0.38 * beat)
  );
};

/** Split-stone runs at every named stone's foot. */
const splitGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  let ring = 0;
  const foot = (fu: number, fv: number, inner: number): void => {
    const d = Math.hypot(u - fu, v - fv);
    ring = Math.max(
      ring,
      smoothstep01((d - inner) / 1.2) * (1 - smoothstep01((d - inner - 4.5) / 3)),
    );
  };
  foot(DAYMARK.u, DAYMARK.v, 1.8);
  for (const link of CHAIN_LINKS) {
    foot(link.u, link.v, 2.8);
  }
  foot(ANCHOR.u, ANCHOR.v, 8);
  return ring * restFree(x, z) * lensFree(x, z) * fillOwn(x, z) * bedFree(u, v);
};

// ─── The build ───────────────────────────────────────────────────────────────

export function buildBlue3Cover(): Blue3CoverBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = <T extends KitBuild | CarpetFieldBuild>(build: T): T => {
    groups.push(build.group);
    if ("update" in build) {
      updaters.push((timeSec) => build.update(timeSec));
    }
    return build;
  };

  // ── T1: the fine grain ───────────────────────────────────────────────────
  const grit = keep(
    buildGroundLitter({
      seed: SEED ^ B3_SEEDS.mereGrit,
      palette: { base: 0xaea6c4, accent: 0xccc4d8, shade: 0x6e6890 },
      area: discArea(),
      gate: gritGate,
      ground: seabedHeight,
      count: 6200,
      shapeSet: "grit",
      size: [0.03, 0.09],
      twoTone: true,
      grade: 0.45,
    }),
  );
  duskLift(grit, 0x2c3440, 0.35);

  const pebbles = keep(
    buildGroundLitter({
      seed: SEED ^ B3_SEEDS.shelfPebbles,
      palette: { base: 0xccc6c0, accent: 0xe2ded4, shade: 0x8e88a0 },
      area: polylineArea(SPINE_ROAD.slice(0, 6), 44),
      gate: shelfPebbleGate,
      ground: seabedHeight,
      // Round 4: the morning-shelf stand still read bare tan — the
      // shelf's own T1 voice up.
      count: 460,
      shapeSet: "pebble",
      size: [0.08, 0.2],
      twoTone: true,
      grade: 0.55,
    }),
  );
  duskLift(pebbles, 0x2c3440, 0.3);

  const splits = keep(
    buildGroundLitter({
      seed: SEED ^ B3_SEEDS.chainSplits,
      palette: { base: 0xa9a0c2, accent: 0xc6bed6, shade: 0x6c6288 },
      area: discArea(),
      gate: splitGate,
      ground: seabedHeight,
      count: 420,
      shapeSet: "split",
      size: [0.1, 0.32],
      twoTone: true,
      grade: 0.6,
    }),
  );
  duskLift(splits, 0x2c3440, 0.35);

  // The Hem's scree aprons: the world's last wall grows FROM its foot.
  const screeAnchors: ScreeAnchor[] = [];
  for (let i = 0; i < 15; i++) {
    const theta = (i / 15) * Math.PI * 2;
    const x = CENTER_X + Math.cos(theta) * 176;
    const z = CENTER_Z + Math.sin(theta) * 176;
    const { u, v } = spokeOf(x, z);
    if (passGate(u, v) > 0.2 || restFree(x, z) < 0.6 || u < 1280) {
      continue;
    }
    screeAnchors.push({ pos: [x, z], facing: theta + Math.PI, spread: 12 });
  }
  // Round 3: the Longfall's flank-wall feet join — the sweep's two
  // graze misses both stood over faces whose feet held nothing.
  for (const [au, av] of [
    [1296, -44],
    [1322, -50],
    [1348, -56],
    [1300, 44],
    [1330, 52],
  ] as const) {
    const at = worldOf(au, av);
    const inward = worldOf(au, av - Math.sign(av) * 4);
    if (restFree(at.x, at.z) < 0.6) {
      continue;
    }
    screeAnchors.push({
      pos: [at.x, at.z],
      facing: Math.atan2(inward.z - at.z, inward.x - at.x),
      spread: 10,
    });
  }
  // Round 5: the east and north Hem feet join too — sweep 04 and 09
  // stand over those quadrants, and the even ring at 24° spacing left
  // both bearings between anchors. These face the bowl's centre.
  for (const [au, av] of [
    [1628, 50],
    [1610, 74],
    [1499, 171],
    [1531, 161],
  ] as const) {
    const at = worldOf(au, av);
    const inward = worldOf(au + (1460 - au) * 0.05, av - av * 0.05);
    if (restFree(at.x, at.z) < 0.6) {
      continue;
    }
    screeAnchors.push({
      pos: [at.x, at.z],
      facing: Math.atan2(inward.z - at.z, inward.x - at.x),
      spread: 11,
    });
  }
  const scree = keep(
    buildScreeApron({
      seed: SEED ^ B3_SEEDS.wallScree,
      palette: { base: 0xb6aecc, tip: 0xd4cede, shade: 0x6e6588 },
      ground: seabedHeight,
      anchors: screeAnchors,
      slabsPerAnchor: 9,
    }),
  );
  duskLift(scree, 0x2c3440, 0.35);

  // ── T2: the standing layer ───────────────────────────────────────────────
  const mereTufts = keep(
    buildCarpetField({
      seed: SEED ^ B3_SEEDS.mereTufts,
      palette: { base: 0xb4aacb, tip: 0xe8dcd2, shade: 0x776e94 },
      area: discArea(),
      gate: mereTuftGate,
      ground: seabedHeight,
      count: 3400,
      profile: "blade",
      size: [0.34, 0.7],
      swayAmp: 0.045,
      sunGlow: true,
      looseShare: 0.45,
    }),
  );
  duskLift(mereTufts, 0x3a3450, 0.5);

  const bankBlades = keep(
    buildCarpetField({
      seed: SEED ^ B3_SEEDS.bankBlades,
      palette: { base: 0x84b49c, tip: 0xc2e2ce, shade: 0x527a6e },
      area: polylineArea(CRADLE_SPINE, 34),
      gate: bankBladeGate,
      ground: seabedHeight,
      count: 2100,
      profile: "blade",
      size: [0.4, 0.85],
      swayAmp: 0.055,
      sunGlow: true,
      looseShare: 0.4,
    }),
  );
  duskLift(bankBlades, 0x223a2a, 0.5);

  const bankFronds = keep(
    buildCarpetField({
      seed: SEED ^ B3_SEEDS.bankFronds,
      palette: { base: 0x7cab96, tip: 0xb8dcc4, shade: 0x4e7468 },
      area: polylineArea(CRADLE_SPINE, 24),
      gate: bankFrondGate,
      ground: seabedHeight,
      count: 520,
      profile: "frond",
      size: [0.28, 0.54],
      swayAmp: 0.04,
    }),
  );
  duskLift(bankFronds, 0x223a2a, 0.5);

  const fallMoss = keep(
    buildCarpetField({
      seed: SEED ^ B3_SEEDS.fallMoss,
      palette: { base: 0xacb2bc, tip: 0xd8dcda, shade: 0x707c96 },
      area: discAreaAt(1304, 0, 80),
      gate: fallMossGate,
      ground: seabedHeight,
      count: 850,
      profile: "blade",
      size: [0.3, 0.6],
      swayAmp: 0.04,
      sunGlow: true,
      looseShare: 0.5,
    }),
  );
  duskLift(fallMoss, 0x2c4038, 0.45);

  const starTufts = keep(
    buildCarpetField({
      seed: SEED ^ B3_SEEDS.starTufts,
      palette: { base: 0x7a6ea4, tip: 0xb2a8cc, shade: 0x504870 },
      area: discArea(),
      gate: starTuftGate,
      ground: seabedHeight,
      count: 950,
      profile: "tuft",
      size: [0.26, 0.55],
    }),
  );
  duskLift(starTufts, 0x2c3440, 0.55);

  const wallTufts = keep(
    buildCarpetField({
      seed: SEED ^ B3_SEEDS.wallTufts,
      palette: { base: 0xb8bcca, tip: 0xe4e2e0, shade: 0x7a7e9c },
      area: discArea(),
      gate: wallTuftGate,
      ground: seabedHeight,
      // Round 4: 2600 over the whole ring band measured ~0.04/m² —
      // eight blades in a graze frame. Up again.
      count: 3400,
      profile: "blade",
      size: [0.36, 0.72],
      swayAmp: 0.045,
      sunGlow: true,
      looseShare: 0.5,
    }),
  );
  duskLift(wallTufts, 0x3a3450, 0.5);

  // The flank meadows: authored tuft stands on the open flanks the
  // sweep actually visits (aimed off the pinned sweep probe — the
  // blue-2 round-3 lesson paid up front: sweeps 01 and 11 stand on
  // the bare south-west flank; sweep 03 rides the north-east bank).
  // Silt banks, not gardens. Round 5: the east face (sweep 09's whole
  // frame) and the north slope (sweep 04's right wall) get their own
  // stands — the ring band's even draw left both quadrants at eight
  // blades a frame.
  const meadows: readonly { seed: number; u: number; v: number; radius: number; count: number }[] =
    [
      { seed: B3_SEEDS.flankMeadowW, u: 1382, v: -140, radius: 26, count: 520 },
      { seed: B3_SEEDS.flankMeadowE, u: 1512, v: 82, radius: 24, count: 440 },
      { seed: B3_SEEDS.hemEastMeadow, u: 1630, v: 54, radius: 20, count: 380 },
      { seed: B3_SEEDS.hemNorthMeadow, u: 1518, v: 178, radius: 20, count: 360 },
    ];
  for (const meadow of meadows) {
    const field = keep(
      buildCarpetField({
        seed: SEED ^ meadow.seed,
        palette: { base: 0xb4aacb, tip: 0xe8dcd2, shade: 0x776e94 },
        area: discAreaAt(meadow.u, meadow.v, meadow.radius),
        gate: (x, z) => {
          const { u, v } = spokeOf(x, z);
          const d = Math.hypot(u - meadow.u, v - meadow.v);
          const disc = 1 - smoothstep01((d - meadow.radius * 0.7) / (meadow.radius * 0.3));
          const drift = smoothstep01((Math.sin(d * 0.7 + u * 0.05) + 0.5) / 1.1);
          return (
            fillOwn(x, z) *
            restFree(x, z) *
            lensFree(x, z) *
            stoneFree(u, v) *
            bedFree(u, v) *
            disc *
            (0.35 + 0.65 * drift)
          );
        },
        ground: seabedHeight,
        count: meadow.count,
        profile: "blade",
        size: [0.34, 0.68],
        swayAmp: 0.045,
        sunGlow: true,
        looseShare: 0.5,
      }),
    );
    duskLift(field, 0x3a3450, 0.5);
  }

  // Flank bushes: silver-violet cushions at the drift beats — the
  // mid-scale silhouettes the open floor needs.
  const bushes = keep(
    buildBushBank({
      seed: SEED ^ B3_SEEDS.flankBushes,
      palette: { base: 0x8f84b2, tip: 0xc8bede, shade: 0x584e7c, accent: 0xcfc8de },
      area: polylineArea(
        DRIFT_BEATS.map((beat) => [beat.u, beat.v] as const),
        18,
      ),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        return (
          beatDepth(u, v) *
          restFree(x, z) *
          lensFree(x, z) *
          stoneFree(u, v) *
          bedFree(u, v) *
          craterFree(u, v) *
          fillOwn(x, z)
        );
      },
      ground: seabedHeight,
      count: 40,
      fronds: 5,
      accents: 4,
      looseShare: 0.35,
    }),
  );
  duskLift(bushes, 0x2c3440, 0.45);

  // The Chain's own drift: what else settled along the drag-line.
  const chainWrack = keep(
    buildDriftDebris({
      seed: SEED ^ B3_SEEDS.chainDrift,
      palette: { base: 0x9a92ae, shade: 0x665e80 },
      area: polylineArea(
        [
          [1330, 12],
          ...CHAIN_LINKS.map((link) => [link.u, link.v] as const),
        ],
        9,
      ),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        return restFree(x, z) * lensFree(x, z) * stoneFree(u, v) * fillOwn(x, z);
      },
      ground: seabedHeight,
      count: 48,
      shapeSet: "wrack",
    }),
  );
  duskLift(chainWrack, 0x2c3440, 0.3);

  // ── The close beds (the lily-bench law, paid up front) ───────────────────
  const beds: readonly {
    seed: number;
    at: { u: number; v: number };
    radius: number;
    count: number;
    profile: "blade" | "frond" | "tuft";
    palette: { base: number; tip: number; shade: number };
    warm: number;
  }[] = [
    {
      seed: B3_SEEDS.closeMereBed,
      at: { u: CLOSE_LENSES[0]!.u + 3.0, v: CLOSE_LENSES[0]!.v + 3.2 },
      radius: 4.5,
      count: 110,
      profile: "blade",
      palette: { base: 0xb4aacb, tip: 0xe8dcd2, shade: 0x776e94 },
      warm: 0x3a3450,
    },
    {
      seed: B3_SEEDS.closeBankBed,
      at: { u: CLOSE_LENSES[1]!.u + 2.8, v: CLOSE_LENSES[1]!.v + 2.4 },
      radius: 4,
      count: 130,
      profile: "blade",
      palette: { base: 0x84b49c, tip: 0xc2e2ce, shade: 0x527a6e },
      warm: 0x223a2a,
    },
    {
      seed: B3_SEEDS.closeChainBed,
      at: { u: CLOSE_LENSES[2]!.u - 2.4, v: CLOSE_LENSES[2]!.v + 1.8 },
      radius: 4,
      count: 78,
      profile: "frond",
      palette: { base: 0x9e94be, tip: 0xccc4de, shade: 0x665e86 },
      warm: 0x3a3450,
    },
    {
      seed: B3_SEEDS.closeWellBed,
      at: { u: CLOSE_LENSES[3]!.u + 2.6, v: CLOSE_LENSES[3]!.v - 2.4 },
      radius: 3.5,
      count: 64,
      profile: "tuft",
      palette: { base: 0x7a6ea4, tip: 0xb2a8cc, shade: 0x504870 },
      warm: 0x2c3440,
    },
  ] as const;
  for (const bed of beds) {
    const stand = keep(
      buildCarpetField({
        seed: SEED ^ bed.seed,
        palette: bed.palette,
        area: discAreaAt(bed.at.u, bed.at.v, bed.radius),
        gate: (x, z) => {
          const { u, v } = spokeOf(x, z);
          return restFree(x, z) * lensFree(x, z) * stoneFree(u, v) * bedFree(u, v) * blue3Weight(x, z);
        },
        ground: seabedHeight,
        count: bed.count,
        profile: bed.profile,
        size: [0.32, 0.62],
        swayAmp: 0.045,
        sunGlow: true,
        looseShare: 0.6,
      }),
    );
    duskLift(stand, bed.warm, 0.55);
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
