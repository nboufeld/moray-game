import {
  BufferAttribute,
  Color,
  IcosahedronGeometry,
  PlaneGeometry,
  type BufferGeometry,
  type Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBushBank } from "../kit/BushBank";
import { buildCarpetField, type CarpetFieldBuild } from "../kit/CarpetField";
import { buildDriftDebris } from "../kit/DriftDebris";
import { buildGroundLitter } from "../kit/GroundLitter";
import type { GateFn, KitArea, KitBuild } from "../kit/KitTypes";
import { smoothstep01 } from "./CalamityShared";
import {
  FILL_SEEDS,
  channelDistance,
  mileThin,
  mileWeight,
  regrowthReach,
  restFree,
  swimHalf,
} from "./CalamityFillShared";
import {
  LAST_GROVE,
  SEEP_GARDENS,
  SHATTERFIELD,
  calamityWeight,
  forestWeight,
  gardensWeight,
  groveWeight,
  marchChannelCenter,
  quietRimWeight,
  shatterWeight,
  spokeOf,
  tongueHalfWidth,
  woundWeight,
  worldOf,
} from "./CalamityTerrain";

/**
 * The Sunken Calamity's T1/T2 fill — ruin-density as STORY (fill plan §3):
 * the catastrophe says ten thousand stones, and this module is where most
 * of them land.
 *
 * - **Pavement-shard carpets** (region EXCLUSIVE composition): the blast's
 *   fingerprint. Kit `groundLitter` shards, two bone tones down the whole
 *   march and a densest field over the Shatterfield, every shard's long
 *   axis raked radially AWAY from the Wound (held by the region test).
 *   Litter stays off the channel's swim line and thins to sparse singles
 *   through the Suffocated Mile (the registry's clause, via `mileThin`).
 * - **Ash-lap drifts**: grit-grade ash pooled along the banks and out
 *   across the Quiet Rim — the sparse whisper the rim is allowed.
 * - **Fallen-strap straw lanes**: the dead forest's shed straps lying on
 *   the ash floor, raked with the blast — a dead forest stops having a
 *   swept floor.
 * - **Ash-bloom** (region EXCLUSIVE): pale grey-lavender ground flowers
 *   that only open within ~25 m of the seeps and the grove — the
 *   wrong-regrowth story made spatial.
 * - **The grove meadow**: a green blade carpet gated hard on
 *   `groveWeight`, with a second, brighter-tipped patch inside the warm
 *   shaft's footprint so the floor visibly ANSWERS its light. The inner
 *   lawn (registry rest) stays clear.
 * - **Fern rosettes, dead scrub, relics, bone-coral knuckles**: the T2
 *   understory — the march banks get their dead scrub stubble, the road
 *   gets its half-buried querns and bowls (kit `driftDebris` relics — the
 *   ruins-terrace wing's own drum radius and tile profile), the rim its
 *   relic pair, the gardens their bone-coral.
 *
 * Every call draws from a fresh `SEEDS.regionCalamity ^ FILL_SEEDS.*`
 * stream (the reroll fence) and multiplies {@link restFree} into its gate
 * so the registered rests stay composed bareness. Palettes are painted
 * for THIS region's light (grey-teal fog, sun 0.16): ash violets, bone,
 * cold silver — values held high, never black (the Kelp Sea's round-3
 * lesson: fill palettes are for the region's light, not the kit demo's).
 */

const SEED = SEEDS.regionCalamity;

export interface CalamityLitterBuild {
  readonly groups: Group[];
  /** Named for the tests: the raked march shards. */
  readonly shardGroups: Group[];
  /** Named for the tests: the grove meadow carpets. */
  readonly meadowGroups: Group[];
  update(timeSec: number): void;
}

/** The march channel as a kit road area, stations every ~16 m of spoke. */
function marchArea(fromU: number, toU: number, width: number): KitArea {
  const polyline: [number, number][] = [];
  for (let u = fromU; u <= toU; u += 16) {
    const { x, z } = worldOf(u, marchChannelCenter(Math.min(u, 505)));
    polyline.push([x, z]);
  }
  return { polyline, width };
}

/** March plus the Quiet Rim shelf, for the ash-lap's long whisper. */
function ashLapArea(): KitArea {
  const polyline: [number, number][] = [];
  for (let u = 56; u <= 530; u += 20) {
    const { x, z } = worldOf(u, marchChannelCenter(Math.min(u, 505)));
    polyline.push([x, z]);
  }
  for (let u = 550; u <= 900; u += 25) {
    const { x, z } = worldOf(u, 0);
    polyline.push([x, z]);
  }
  return { polyline, width: 110 };
}

function discAreaAt(u: number, v: number, radius: number): KitArea {
  const { x, z } = worldOf(u, v);
  return { center: [x, z], radius };
}

// ─── The gates ───────────────────────────────────────────────────────────────

/** Shards carpet the march floor and its bank feet, off the swim line. */
const marchShardGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 52 || u > 545) {
    return 0;
  }
  // The handshake gradient: near-zero at the terrace seam, thickening
  // over the first 30 m (fill plan §8 — the wing keeps its gold).
  const seamFade = smoothstep01((u - 56) / 30);
  const off = channelDistance(u, v);
  if (off < 1.8) {
    return 0; // the swim line itself stays clear (held by the test)
  }
  const inBand = 1 - smoothstep01((off - (tongueHalfWidth(u) - 8)) / 8);
  // Densest on the floor and lower bank; the crests keep their scorch.
  const lowGround = 0.5 + 0.5 * (1 - smoothstep01((off - swimHalf(u) - 6) / 8));
  return seamFade * inBand * lowGround * mileThin(u, v) * restFree(x, z) * calamityWeight(x, z);
};

/** The Shatterfield: the pavement's ten thousand stones, densest here. */
const shatterShardGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const shatter = shatterWeight(u, v);
  if (shatter <= 0) {
    return 0;
  }
  const off = channelDistance(u, v);
  if (u < 540 && off < 1.8) {
    return 0;
  }
  return shatter * (0.35 + 0.65 * smoothstep01((u - 480) / 30)) * restFree(x, z) * calamityWeight(x, z);
};

/** Ash-lap pools on the banks and drifts thin across the Quiet Rim. */
const ashLapGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const off = channelDistance(u, v);
  if (u < 540 && off < 1.8) {
    return 0;
  }
  let band = 0;
  if (u >= 56 && u <= 540) {
    band = 1 - smoothstep01((off - (tongueHalfWidth(u) - 6)) / 8);
  }
  const rim = quietRimWeight(u) * 0.4;
  return Math.max(band, rim) * mileThin(u, v) * restFree(x, z) * calamityWeight(x, z);
};

/** Straw lies where the dead stand — the whole forest bench. */
const strawGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return forestWeight(u, v) * (1 - woundWeight(u, v)) * restFree(x, z) * calamityWeight(x, z);
};

/** The ash-bloom's licence: within reach of the seeps and the grove only. */
const bloomGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return (
    regrowthReach(u, v) *
    (1 - groveWeight(u, v) * 0.7) *
    (1 - woundWeight(u, v)) *
    restFree(x, z) *
    calamityWeight(x, z)
  );
};

/** The meadow: hard-gated on the grove's own weight (held by a test). */
const meadowGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const grove = groveWeight(u, v);
  if (grove <= 0.02) {
    return 0;
  }
  return grove * restFree(x, z);
};

/** Dead scrub stubbles the march banks; never the Mile, never the road. */
const scrubGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 86 || u > 464) {
    return 0;
  }
  const off = channelDistance(u, v);
  const bank = smoothstep01((off - swimHalf(u) - 2) / 4) * (1 - smoothstep01((off - (tongueHalfWidth(u) - 6)) / 6));
  return bank * (1 - mileWeight(u, v)) * restFree(x, z) * calamityWeight(x, z);
};

/** Relics keep to the road's shoulders, out of the swim line. */
const relicGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 96 || u > 348) {
    return 0;
  }
  const off = channelDistance(u, v);
  if (off < 1.5) {
    return 0;
  }
  const band = 1 - smoothstep01((off - 14) / 6);
  return band * (1 - mileWeight(u, v)) * restFree(x, z) * calamityWeight(x, z);
};

// ─── The exclusive shapes ────────────────────────────────────────────────────

/**
 * A fallen strap: the dead forest's own strap geometry flattened to the
 * floor — a tapered ribbon lying along +x (so the kit's rake elongation
 * aligns it with the blast), a slight mid-curl, bone paint with a violet
 * root end. ~10 triangles.
 */
function strawStrap(length: number, width: number, curl: number): BufferGeometry {
  const geometry = new PlaneGeometry(length, width, 5, 1);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const root = new Color(0.62, 0.55, 0.68); // violet-bone ratio, never black
  const tip = new Color(1.0, 1.02, 0.98); // a whisper of drowned opal
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const t = position.getX(i) / length + 0.5; // 0 at the root end
    const across = position.getZ(i) / (width / 2);
    // Taper toward the tip; lift a little at mid-length (the curl).
    position.setZ(i, position.getZ(i) * (1 - t * 0.5));
    position.setY(i, 0.015 + Math.sin(t * Math.PI) * curl * (1 - Math.abs(across) * 0.4));
    shade.copy(root).lerp(tip, smoothstep01((t - 0.12) / 0.55));
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/** A bone-coral knuckle: two welded knobs, pale over a violet under. */
function knuckleGeometry(lean: number): BufferGeometry {
  const a = new IcosahedronGeometry(0.09, 0);
  a.scale(1, 1.35, 1);
  const b = new IcosahedronGeometry(0.065, 0);
  b.scale(1, 1.5, 1);
  b.translate(0.09, 0.02, 0.03 * lean);
  b.rotateZ(-0.3 * lean);
  const merged = mergeGeometries([a, b], false);
  a.dispose();
  b.dispose();
  if (!merged) {
    throw new Error("calamity knuckle knobs could not be merged");
  }
  merged.translate(0, 0.06, 0);
  merged.computeVertexNormals();
  const position = merged.attributes.position!;
  const normal = merged.attributes.normal!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const up = normal.getY(i) * 0.5 + 0.5;
    const t = up * up * (3 - 2 * up);
    colors[i * 3] = 0.66 + 0.34 * t;
    colors[i * 3 + 1] = 0.62 + 0.38 * t;
    colors[i * 3 + 2] = 0.72 + 0.26 * t;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  return merged;
}

// ─── The build ───────────────────────────────────────────────────────────────

export function buildCalamityLitter(): CalamityLitterBuild {
  const groups: Group[] = [];
  const shardGroups: Group[] = [];
  const meadowGroups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (build: KitBuild | CarpetFieldBuild, into?: Group[]): void => {
    groups.push(build.group);
    into?.push(build.group);
    if ("update" in build) {
      updaters.push((timeSec) => build.update(timeSec));
    }
  };

  const wound = worldOf(700, 0);
  const rakeFromWound = { from: [wound.x, wound.z] as const, strength: 0.85, jitter: 0.14 };

  // The march's pavement-shard carpet: two bone tones, blast-raked.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.shardMarch,
      palette: { base: 0xa8a294, accent: 0xbcb6a6, shade: 0x7a7288 },
      area: marchArea(56, 536, 46),
      gate: marchShardGate,
      ground: seabedHeight,
      count: 1900,
      shapeSet: "shard",
      size: [0.14, 0.45],
      rake: rakeFromWound,
      twoTone: true,
    }),
    shardGroups,
  );

  // The Shatterfield's field — the story's densest ground.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.shardShatter,
      palette: { base: 0xb4aea0, shade: 0x7e768c },
      area: discAreaAt(SHATTERFIELD.u, SHATTERFIELD.v, 96),
      gate: shatterShardGate,
      ground: seabedHeight,
      count: 1050,
      shapeSet: "shard",
      size: [0.2, 0.6],
      rake: rakeFromWound,
    }),
    shardGroups,
  );

  // The ash-lap: grit pooled on the banks, whispering out over the rim.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.ashLap,
      palette: { base: 0xa89fb0, shade: 0x766e84 },
      area: ashLapArea(),
      gate: ashLapGate,
      ground: seabedHeight,
      count: 640,
      shapeSet: "grit",
      size: [0.07, 0.18],
    }),
  );

  // The fallen-strap straw lanes: raked away from the Wound, like
  // everything else the blast touched.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.strawLanes,
      palette: { base: 0x9a9382, shade: 0x6a6276 },
      area: discAreaAt(626, -4, 96),
      gate: strawGate,
      ground: seabedHeight,
      count: 780,
      shapeSet: [strawStrap(1.5, 0.2, 0.05), strawStrap(1.05, 0.16, 0.08), strawStrap(2.0, 0.24, 0.04)],
      size: [0.7, 1.15],
      rake: { from: [wound.x, wound.z], strength: 0.92, jitter: 0.1 },
    }),
  );

  // The ash-bloom: wrong regrowth, opening only near the seeps and grove.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.ashBloom,
      palette: { base: 0xb9aec6, tip: 0xd8cce0, shade: 0x847a96 },
      area: discAreaAt(762, -10, 132),
      gate: bloomGate,
      ground: seabedHeight,
      count: 260,
      size: [0.14, 0.3],
      swayAmp: 0.02,
    }),
  );

  // The grove meadow — and the patch that answers the warm shaft.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.groveMeadow,
      palette: { base: 0x6fae58, tip: 0x9ed070, shade: 0x4a7a48 },
      area: discAreaAt(LAST_GROVE.u, LAST_GROVE.v, 44),
      gate: meadowGate,
      ground: seabedHeight,
      count: 820,
      size: [0.18, 0.4],
      swayAmp: 0.035,
    }),
    meadowGroups,
  );
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.groveMeadowLit,
      palette: { base: 0x83c464, tip: 0xd2e87e, shade: 0x568a4c },
      area: discAreaAt(LAST_GROVE.u - 2, LAST_GROVE.v + 2, 5.5),
      gate: meadowGate,
      ground: seabedHeight,
      count: 240,
      size: [0.2, 0.44],
      swayAmp: 0.04,
    }),
    meadowGroups,
  );

  // Fern rosettes under the grove's eaves.
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.fernRosettes,
      palette: { base: 0x54904c, tip: 0x7cb862, shade: 0x3d6b42 },
      area: discAreaAt(LAST_GROVE.u, LAST_GROVE.v, 30),
      gate: meadowGate,
      ground: seabedHeight,
      count: 54,
      profile: "tuft",
      size: [0.3, 0.6],
      swayAmp: 0.04,
    }),
    meadowGroups,
  );

  // Dead scrub stubble on the march banks: ash-wine, brittle, unmoving.
  keep(
    buildBushBank({
      seed: SEED ^ FILL_SEEDS.deadScrub,
      palette: { base: 0x84707e, tip: 0xa08e96, shade: 0x5e5168 },
      area: marchArea(86, 462, 44),
      gate: scrubGate,
      ground: seabedHeight,
      count: 84,
      lobes: 4,
      scale: 0.7,
    }),
  );

  // The relic scatter: the wing's own architecture, broken small. Clumps
  // land the reveal-cadence beats (half-buried querns and bowls u ~130).
  keep(
    buildDriftDebris({
      seed: SEED ^ FILL_SEEDS.relicsMarch,
      palette: { base: 0xa39a8a, shade: 0x6f6880 },
      area: marchArea(98, 348, 30),
      gate: relicGate,
      ground: seabedHeight,
      count: 26,
      shapeSet: "relics",
      mossTint: 0x7a945f,
    }),
  );

  // The Quiet Rim's relic pair and its shard whisper.
  keep(
    buildDriftDebris({
      seed: SEED ^ FILL_SEEDS.relicsRim,
      palette: { base: 0xaaa294, shade: 0x776f84 },
      area: discAreaAt(852, 8, 26),
      gate: (x, z) => restFree(x, z) * calamityWeight(x, z),
      ground: seabedHeight,
      count: 7,
      shapeSet: "relics",
      mossTint: 0x6f8a58,
    }),
  );

  // Bone-coral knuckles among the gardens' mats.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.boneKnuckles,
      palette: { base: 0xc4bca8, shade: 0x8a8096 },
      area: discAreaAt(SEEP_GARDENS.u, SEEP_GARDENS.v, 34),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        return gardensWeight(u, v) * restFree(x, z) * calamityWeight(x, z);
      },
      ground: seabedHeight,
      count: 40,
      shapeSet: [knuckleGeometry(1), knuckleGeometry(-1)],
      size: [0.8, 1.6],
    }),
  );

  return {
    groups,
    shardGroups,
    meadowGroups,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}
