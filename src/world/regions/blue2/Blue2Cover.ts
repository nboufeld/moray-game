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
  WRACK_LINE,
  beatDepth,
  lensFree,
  restFree,
  roadDistance,
  wrackDistance,
} from "./Blue2Beats";
import { WRACK_FRAGMENTS } from "./Blue2Stones";
import { B2_SEEDS, smoothstep01 } from "./Blue2Shared";
import {
  CENTER_X,
  CENTER_Z,
  CURRENT_SPINE,
  MOORING_POSTS,
  blue2Weight,
  currentCarve,
  currentDistance,
  passFillOwn,
  passGate,
  spokeOf,
  stepD,
  stepsDrop,
  worldOf,
} from "./Blue2Terrain";

/**
 * The Deep Steps' T1/T2 cover, in the Great Blue's own voice: COMPOSED
 * EMPTINESS. This region's fill is the sparsest in the program ON
 * PURPOSE — the doctrine's three-layer law is satisfied by ripple
 * grain, silt-bank tufts and the arcing geography itself, never by
 * gardens. Everything green wears the kit's blade/frond profiles (no
 * card wedges near a camera — R12), every family carries the dusk-lift
 * its register needs (three regions' pre-paid lesson: a palette picked
 * for the kit demo's light dies a value under a deep mood), every gate
 * multiplies {@link restFree} so the three registered rests stay
 * composed bareness, and every close pose's subject is its own
 * authored bed (the lily-bench law, paid up front).
 *
 * Where the life gathers tells the story: the Current's banks carry
 * the region's only green — life clings to the river — while the
 * shelves carry bone-pale tufts thinning with depth, and the Round
 * carries NOTHING but its licensed paint.
 */

const SEED = SEEDS.regionBlue2;

export interface Blue2CoverBuild {
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

function polylineArea(
  line: readonly (readonly [number, number])[],
  width: number,
): KitArea {
  const polyline: [number, number][] = line.map(([u, v]) => {
    const { x, z } = worldOf(u, v);
    return [x, z] as [number, number];
  });
  return { polyline, width };
}

// ─── Shared gate arithmetic ──────────────────────────────────────────────────

/**
 * Fill ownership (the Carillon Waste's round-3 law): the road's fill is
 * ours the moment the bounds are — the 0.14 treaty whisper is not a
 * bareness licence. Identical support to the weight.
 */
function fillOwn(x: number, z: number): number {
  return Math.max(blue2Weight(x, z), passFillOwn(x, z));
}

/** Shelf bands, by hinge distance. */
function strandBand(d: number): number {
  return smoothstep01((d - 152) / 10) * (1 - smoothstep01((d - 252) / 8));
}
function currentBand(d: number): number {
  return smoothstep01((d - 262) / 8) * (1 - smoothstep01((d - 342) / 8));
}
function roundBand(d: number): number {
  return smoothstep01((d - 352) / 10);
}

/** Standing stone footprints the cover keeps out of. */
function stoneFree(u: number, v: number): number {
  let free = 1;
  for (const fragment of WRACK_FRAGMENTS) {
    free = Math.min(
      free,
      smoothstep01((Math.hypot(u - fragment.u, v - fragment.v) - fragment.length * 0.4) / 1.4),
    );
  }
  for (const post of MOORING_POSTS) {
    free = Math.min(
      free,
      smoothstep01((Math.hypot(u - post.u, v - post.v) - post.radius * 1.5) / 1.2),
    );
  }
  return free;
}

/** The river bed itself stays clear — the water is the cover there. */
function bedFree(u: number, v: number): number {
  return 1 - currentCarve(u, v).bed * smoothstep01((6 - currentDistance(u, v).d) / 3);
}

/** T1 ripple grit: the whole country's close-range grain. */
const gritGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const d = stepD(u, v);
  const shelf =
    strandBand(d) * 0.9 +
    currentBand(d) * 0.75 +
    roundBand(d) * 0.3 +
    smoothstep01((d - 140) / 8) * (1 - smoothstep01((d - 156) / 6)) * 0.8;
  const road = 1 - smoothstep01((roadDistance(u, v) - 9) / 14) * 0.45;
  return fillOwn(x, z) * restFree(x, z) * shelf * road * bedFree(u, v);
};

/** The saddle road's pale pebbles (outside the hush rest, and never
 *  below the lip — the wall band u < 672 stays untouched). */
const saddlePebbleGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 672 || u > 770) {
    return 0;
  }
  const shoulder =
    smoothstep01((Math.abs(v) - 3) / 3) * (1 - smoothstep01((Math.abs(v) - 20) / 8));
  return fillOwn(x, z) * restFree(x, z) * shoulder;
};

/** The Strand's bone tufts: drift-gathered, never a lawn. */
const strandTuftGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const d = stepD(u, v);
  const band = strandBand(d);
  if (band <= 0) {
    return 0;
  }
  const drift = smoothstep01(
    (Math.sin(d * 1.35) + 0.4) / 1.2,
  );
  const beat = beatDepth(u, v);
  const wrackLee = 1 - smoothstep01((wrackDistance(u, v) - 4) / 9);
  return (
    fillOwn(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    stoneFree(u, v) *
    band *
    Math.min(1, drift * 0.5 + beat + wrackLee * 0.7)
  );
};

/** The Current's banks: the region's only green. */
const bankBladeGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const { d: cd } = currentDistance(u, v);
  const bank = smoothstep01((cd - 3.2) / 2.4) * (1 - smoothstep01((cd - 15) / 8));
  if (bank <= 0) {
    return 0;
  }
  const d = stepD(u, v);
  const onStep = currentBand(d) + smoothstep01((d - 342) / 6) * 0.5;
  return fillOwn(x, z) * restFree(x, z) * lensFree(x, z) * stoneFree(u, v) * bank * onStep;
};

/** Bank fronds: rosettes crowding the levees at the Ford and the Spill. */
const bankFrondGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const { d: cd, t } = currentDistance(u, v);
  const bank = smoothstep01((cd - 2.8) / 2) * (1 - smoothstep01((cd - 10) / 5));
  const chapters = Math.max(
    1 - smoothstep01((Math.abs(t - 0.52) - 0.08) / 0.08),
    1 - smoothstep01((Math.abs(t - 0.86) - 0.08) / 0.08),
  );
  return fillOwn(x, z) * restFree(x, z) * lensFree(x, z) * stoneFree(u, v) * bank * chapters;
};

/** The stair treads' pale moss blades pacing the descent. */
const stairMossGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const d = stepD(u, v);
  const band = smoothstep01((d - 146) / 6) * (1 - smoothstep01((d - 192) / 8));
  if (band <= 0) {
    return 0;
  }
  const steps = stepsDrop(u, v);
  const tread = 1 - steps.riser;
  const near = 1 - smoothstep01((roadDistance(u, v) - 16) / 10);
  return fillOwn(x, z) * restFree(x, z) * lensFree(x, z) * band * tread * (0.3 + 0.7 * near);
};

/** The deep star-tufts: the third shelf's sparse dark cover, off-rest. */
const starTuftGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const d = stepD(u, v);
  const band = roundBand(d);
  if (band <= 0) {
    return 0;
  }
  const drift = smoothstep01((Math.sin(d * 0.9 + v * 0.02) + 0.55) / 1.1);
  const beat = beatDepth(u, v);
  return (
    blue2Weight(x, z) * restFree(x, z) * lensFree(x, z) * band * Math.min(1, drift * 0.45 + beat)
  );
};

/** The Worldwall's lower slope + the rim-facing flank band (F-R3). */
const wallTuftGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  const wall = smoothstep01((rc - 148) / 26) * (1 - smoothstep01((rc - 206) / 12));
  if (wall <= 0) {
    return 0;
  }
  const offCorridor = 1 - passGate(u, v);
  const beat = beatDepth(u, v);
  return (
    blue2Weight(x, z) *
    restFree(x, z) *
    lensFree(x, z) *
    wall *
    offCorridor *
    (0.45 + 0.55 * beat)
  );
};

/** Split-stone runs at the wrack fragments', the posts' and the
 *  Pharos' feet (round 2: the lone waymark stood on naked sand). */
const splitGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  let ring = smoothstep01((Math.hypot(u - 692, v - 8) - 1.8) / 1.2) *
    (1 - smoothstep01((Math.hypot(u - 692, v - 8) - 1.8 - 4) / 3));
  for (const fragment of WRACK_FRAGMENTS) {
    const fd = Math.hypot(u - fragment.u, v - fragment.v);
    ring = Math.max(
      ring,
      smoothstep01((fd - fragment.length * 0.38) / 1.2) * (1 - smoothstep01((fd - fragment.length * 0.38 - 5) / 3)),
    );
  }
  for (const post of MOORING_POSTS) {
    const pd = Math.hypot(u - post.u, v - post.v);
    ring = Math.max(
      ring,
      smoothstep01((pd - post.radius * 1.5) / 1.2) * (1 - smoothstep01((pd - post.radius * 1.5 - 5) / 3)),
    );
  }
  return ring * restFree(x, z) * lensFree(x, z) * fillOwn(x, z);
};

// ─── The build ───────────────────────────────────────────────────────────────

export function buildBlue2Cover(): Blue2CoverBuild {
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
      seed: SEED ^ B2_SEEDS.rippleGrit,
      palette: { base: 0xb2aac0, accent: 0xccc4d6, shade: 0x746d8a },
      area: discArea(),
      gate: gritGate,
      ground: seabedHeight,
      count: 6400,
      shapeSet: "grit",
      size: [0.03, 0.09],
      twoTone: true,
      grade: 0.45,
    }),
  );
  duskLift(grit, 0x2c3440, 0.35);

  const pebbles = keep(
    buildGroundLitter({
      seed: SEED ^ B2_SEEDS.saddlePebbles,
      palette: { base: 0xcac4c2, accent: 0xe0dcd4, shade: 0x8e86a0 },
      area: polylineArea(SPINE_ROAD.slice(0, 6), 44),
      gate: saddlePebbleGate,
      ground: seabedHeight,
      count: 340,
      shapeSet: "pebble",
      size: [0.08, 0.2],
      twoTone: true,
      grade: 0.55,
    }),
  );
  duskLift(pebbles, 0x2c3440, 0.3);

  const splits = keep(
    buildGroundLitter({
      seed: SEED ^ B2_SEEDS.wrackSplits,
      palette: { base: 0xa79ec0, accent: 0xc4bcd4, shade: 0x6a6088 },
      area: discArea(),
      gate: splitGate,
      ground: seabedHeight,
      count: 380,
      shapeSet: "split",
      size: [0.1, 0.32],
      twoTone: true,
      grade: 0.6,
    }),
  );
  duskLift(splits, 0x2c3440, 0.35);

  // The Worldwall's scree aprons: the rim wall grows FROM its foot.
  const screeAnchors: ScreeAnchor[] = [];
  for (let i = 0; i < 15; i++) {
    const theta = (i / 15) * Math.PI * 2;
    const x = CENTER_X + Math.cos(theta) * 176;
    const z = CENTER_Z + Math.sin(theta) * 176;
    const { u, v } = spokeOf(x, z);
    if (passGate(u, v) > 0.2 || restFree(x, z) < 0.6 || u < 720) {
      continue;
    }
    screeAnchors.push({ pos: [x, z], facing: theta + Math.PI, spread: 12 });
  }
  const scree = keep(
    buildScreeApron({
      seed: SEED ^ B2_SEEDS.wallScree,
      palette: { base: 0xb4accc, tip: 0xd2ccdc, shade: 0x6e6588 },
      ground: seabedHeight,
      anchors: screeAnchors,
      slabsPerAnchor: 7,
    }),
  );
  duskLift(scree, 0x2c3440, 0.35);

  // ── T2: the standing layer ───────────────────────────────────────────────
  const strandTufts = keep(
    buildCarpetField({
      seed: SEED ^ B2_SEEDS.strandTufts,
      palette: { base: 0xb9b2ce, tip: 0xdcd8e2, shade: 0x7c7496 },
      area: discArea(),
      gate: strandTuftGate,
      ground: seabedHeight,
      count: 3600,
      profile: "blade",
      size: [0.34, 0.7],
      swayAmp: 0.045,
      sunGlow: true,
      looseShare: 0.45,
    }),
  );
  duskLift(strandTufts, 0x3a3450, 0.5);

  const bankBlades = keep(
    buildCarpetField({
      seed: SEED ^ B2_SEEDS.bankBlades,
      palette: { base: 0x84b49c, tip: 0xc2e2ce, shade: 0x527a6e },
      area: polylineArea(CURRENT_SPINE, 34),
      gate: bankBladeGate,
      ground: seabedHeight,
      count: 2400,
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
      seed: SEED ^ B2_SEEDS.bankFronds,
      palette: { base: 0x7cab96, tip: 0xb8dcc4, shade: 0x4e7468 },
      area: polylineArea(CURRENT_SPINE, 24),
      gate: bankFrondGate,
      ground: seabedHeight,
      count: 700,
      profile: "frond",
      size: [0.28, 0.54],
      swayAmp: 0.04,
    }),
  );
  duskLift(bankFronds, 0x223a2a, 0.5);

  const stairMoss = keep(
    buildCarpetField({
      seed: SEED ^ B2_SEEDS.stairMoss,
      palette: { base: 0xa9b4b6, tip: 0xd0dcd6, shade: 0x6e7890 },
      area: discAreaAt(788, 0, 70),
      gate: stairMossGate,
      ground: seabedHeight,
      count: 900,
      profile: "blade",
      size: [0.3, 0.6],
      swayAmp: 0.04,
      sunGlow: true,
      looseShare: 0.5,
    }),
  );
  duskLift(stairMoss, 0x2c4038, 0.45);

  const starTufts = keep(
    buildCarpetField({
      seed: SEED ^ B2_SEEDS.starTufts,
      palette: { base: 0x746a9e, tip: 0xaaa2c6, shade: 0x4c4470 },
      area: discArea(),
      gate: starTuftGate,
      ground: seabedHeight,
      count: 1050,
      profile: "tuft",
      size: [0.26, 0.55],
    }),
  );
  duskLift(starTufts, 0x2c3440, 0.55);

  const wallTufts = keep(
    buildCarpetField({
      seed: SEED ^ B2_SEEDS.wallTufts,
      palette: { base: 0xb6bcc8, tip: 0xdfe4e4, shade: 0x787e9a },
      area: discArea(),
      gate: wallTuftGate,
      ground: seabedHeight,
      count: 1400,
      profile: "blade",
      size: [0.36, 0.72],
      swayAmp: 0.045,
      sunGlow: true,
      looseShare: 0.5,
    }),
  );
  duskLift(wallTufts, 0x3a3450, 0.5);

  // Flank bushes: silver-violet cushions at the drift beats — the
  // mid-scale silhouettes the open shelves need (the Terraces' sweep
  // lesson pre-paid).
  const bushes = keep(
    buildBushBank({
      seed: SEED ^ B2_SEEDS.flankBushes,
      palette: { base: 0x8f84b2, tip: 0xc6bede, shade: 0x584e7c, accent: 0xdcd6ea },
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
          fillOwn(x, z)
        );
      },
      ground: seabedHeight,
      count: 30,
      fronds: 5,
      accents: 4,
      looseShare: 0.35,
    }),
  );
  duskLift(bushes, 0x2c3440, 0.45);

  // The wrack's own drift debris: what else fell, strandlined along it.
  const wrackDrift = keep(
    buildDriftDebris({
      seed: SEED ^ B2_SEEDS.driftWrack,
      palette: { base: 0x9a92ae, shade: 0x665e80 },
      area: polylineArea(WRACK_LINE, 8),
      gate: (x, z) => restFree(x, z) * lensFree(x, z) * fillOwn(x, z),
      ground: seabedHeight,
      count: 56,
      shapeSet: "wrack",
    }),
  );
  duskLift(wrackDrift, 0x2c3440, 0.3);

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
      seed: B2_SEEDS.closeStrandBed,
      at: { u: CLOSE_LENSES[0]!.u + 3.0, v: CLOSE_LENSES[0]!.v + 3.2 },
      radius: 4.5,
      count: 84,
      profile: "blade",
      palette: { base: 0xb9b2ce, tip: 0xdcd8e2, shade: 0x7c7496 },
      warm: 0x3a3450,
    },
    {
      seed: B2_SEEDS.closeBankBed,
      at: { u: CLOSE_LENSES[1]!.u + 2.8, v: CLOSE_LENSES[1]!.v + 2.4 },
      radius: 4,
      count: 130,
      profile: "blade",
      palette: { base: 0x84b49c, tip: 0xc2e2ce, shade: 0x527a6e },
      warm: 0x223a2a,
    },
    {
      seed: B2_SEEDS.closeWrackBed,
      // On the look ray toward the fallen blade (round 2 restage).
      at: { u: CLOSE_LENSES[2]!.u - 2.4, v: CLOSE_LENSES[2]!.v - 2.4 },
      radius: 4,
      count: 78,
      profile: "frond",
      palette: { base: 0x9e94be, tip: 0xccc4de, shade: 0x665e86 },
      warm: 0x3a3450,
    },
    {
      seed: B2_SEEDS.closePostBed,
      // Between the backed-out lens and the post's foot (round 2).
      at: { u: CLOSE_LENSES[3]!.u + 2.4, v: CLOSE_LENSES[3]!.v - 3.2 },
      radius: 4,
      count: 72,
      profile: "blade",
      palette: { base: 0xb6bcc8, tip: 0xdfe4e4, shade: 0x787e9a },
      warm: 0x3a3450,
    },
  ] as const;
  for (const bed of beds) {
    const stand = keep(
      buildCarpetField({
        seed: SEED ^ bed.seed,
        palette: bed.palette,
        area: discAreaAt(bed.at.u, bed.at.v, bed.radius),
        gate: (x, z) => restFree(x, z) * lensFree(x, z) * stoneFree(spokeOf(x, z).u, spokeOf(x, z).v) * blue2Weight(x, z),
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
