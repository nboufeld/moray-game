import type { Group } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBushBank } from "../kit/BushBank";
import { buildCarpetField, type CarpetFieldBuild } from "../kit/CarpetField";
import { buildDriftDebris } from "../kit/DriftDebris";
import { buildGroundLitter } from "../kit/GroundLitter";
import type { KitBuild } from "../kit/KitTypes";
import {
  CENTER_X,
  CENTER_Z,
  MESAS,
  SUNFALL,
  WELLSPRINGS,
  WORLDS_END,
  channelCenter,
  mesaMound,
  smoothstep01,
  spokeOf,
  stillnessGate,
  verdant3Weight,
  worldOf,
} from "./Verdant3Terrain";

/**
 * THE SHADE MEADOWS' COVER — every square metre deliberate (doctrine
 * rule 3), built from the kit's R12 QUALITY profiles from the first
 * draft: the close-range tiers are `"blade"` (48-tri S-bend clumps) and
 * `"frond"` (60-tri cupped rosettes) — no wedge era, no card popcorn.
 *
 * The layout leans on two verdant-2 fill lessons baked in from round
 * one: (1) broad-field gates ride a seeded fbm DRIFT field (~14 m
 * cells) so the same counts gather into drifts with composed gaps —
 * uniform scatter is noise, drifts are cover; (2) the region's dim
 * water means every family paints a VALUE STEP UP from where a brighter
 * region would put it (the verdant-1 re-pass lesson: under a dim sun,
 * small flora drops to silhouette).
 *
 * Density tiers, per zone (the doctrine's table — declared in the
 * ledger): T1 is this file's carpets and litter; T2 its bush banks and
 * shed-frond wrack; T3 lives in Mesas/Canopy; T4/T5 in Life/Colonies.
 *
 * Every rest in `RESTS` is kept empty through the shared stillness
 * gate. Seeds are fresh `SEEDS.regionVerdant3 ^ 0x30xx` substreams.
 */

const SEED = SEEDS.regionVerdant3;

export interface Verdant3CoverBuild {
  readonly groups: Group[];
  readonly draws: number;
  readonly triangles: number;
  update(timeSec: number): void;
}

/** The drift field: gathers broad-field scatter into ~14 m drifts.
 *  Round 2: floor 0.35 → 0.45 — the r1 close pose landed in a drift
 *  gap and read the floor as bare; gaps thin the cover, never zero it. */
function drift(x: number, z: number): number {
  const n = fbm(x * 0.048, z * 0.048, { seed: SEED ^ 0x30f0, period: 7, octaves: 2 });
  return 0.45 + 0.55 * smoothstep01((n - 0.42) / 0.24);
}

/** The whole-domain base gate: ownership × stillness. */
function baseGate(x: number, z: number): number {
  const w = verdant3Weight(x, z);
  if (w <= 0) {
    return 0;
  }
  const { u, v } = spokeOf(x, z);
  return Math.min(1, w * 1.4) * stillnessGate(u, v);
}

/** Deep-country gate: the disc floor past the descent's foot. */
function meadowGate(x: number, z: number): number {
  const g = baseGate(x, z);
  if (g === 0) {
    return 0;
  }
  const { u, v } = spokeOf(x, z);
  const past = smoothstep01((u - 1305) / 20);
  // Wellspring pools keep their clean floors; the pale rim sward is its
  // own family.
  let pools = 1;
  for (const spring of WELLSPRINGS) {
    const d = Math.hypot(u - spring.u, v - spring.v);
    pools *= smoothstep01((d - spring.radius * 0.9) / 3);
  }
  return g * past * pools * drift(x, z);
}

/** The pass road gate: the threshold and the Boughfall's channel. */
function roadGate(x: number, z: number): number {
  const g = baseGate(x, z);
  if (g === 0) {
    return 0;
  }
  const { u, v } = spokeOf(x, z);
  if (u > 1320) {
    return 0;
  }
  const across = 1 - smoothstep01((Math.abs(v - channelCenter(u)) - 12) / 8);
  return g * across * (0.55 + 0.45 * drift(x, z));
}

export function buildVerdant3Cover(): Verdant3CoverBuild {
  const builds: KitBuild[] = [];
  const carpets: CarpetFieldBuild[] = [];
  const groups: Group[] = [];

  const discArea = { center: [CENTER_X, CENTER_Z] as [number, number], radius: 214 };
  // Round 2: the road band tightened 34 → 26 m — the r1 close-road pose
  // read bare because 520 blades over 6,500 m² is a rumour.
  const roadArea = {
    polyline: roadLine(),
    width: 26,
  };

  const add = (build: KitBuild): void => {
    builds.push(build);
  };
  const addCarpet = (build: CarpetFieldBuild): void => {
    builds.push(build);
    carpets.push(build);
  };

  // ─── T1: the deep-shade floor ─────────────────────────────────────────────
  // The region's base cover: cupped shed-rosette fronds in the deep
  // register — the primeval floor is grown over, never bare by accident.
  // Round 2: 3,400 → 6,000 and a value step UP (r1's close pose: 1/40 m²
  // is a rumour, and the r1 palette dropped to navy silhouettes under
  // this water — the verdant-1 re-pass lesson, applied harder).
  // Round 3: another density and value notch (r2's close pose still
  // read dark rosettes on khaki — value first, then count).
  addCarpet(
    buildCarpetField({
      seed: SEED ^ 0x3001,
      palette: { base: 0x6cae76, tip: 0xbce09a, shade: 0x6a6292 },
      area: discArea,
      gate: meadowGate,
      ground: seabedHeight,
      count: 7400,
      profile: "frond",
      size: [0.36, 0.65],
      looseShare: 0.4,
      swayAmp: 0.05,
    }),
  );
  // Knee-high blade tufts riding the same drifts — the mid-scale the
  // open floor needs from midwater (the verdant-2 sweep lesson).
  addCarpet(
    buildCarpetField({
      seed: SEED ^ 0x3002,
      palette: { base: 0x66b284, tip: 0xb6dc94, shade: 0x655c86 },
      area: discArea,
      gate: meadowGate,
      ground: seabedHeight,
      count: 2600,
      profile: "blade",
      size: [0.45, 0.85],
      looseShare: 0.42,
      swayAmp: 0.08,
    }),
  );
  // The tall drift stands: the region's own 1.1–1.7 m grass, clumped on
  // purpose — the silhouette scale the open floor reads from midwater
  // and the close poses stand among (the verdant-1 re-pass round-4
  // move, built in from the start here).
  addCarpet(
    buildCarpetField({
      seed: SEED ^ 0x3005,
      palette: { base: 0x559a68, tip: 0xb2cf7f, shade: 0x565080 },
      area: discArea,
      gate: meadowGate,
      ground: seabedHeight,
      count: 420,
      profile: "blade",
      size: [1.05, 1.7],
      looseShare: 0.3,
      sunGlow: true,
      swayAmp: 0.14,
    }),
  );

  // The road in: milky celadon blades carrying the terraces' crest
  // paint into our deep register (the 40 m palette handover, planted).
  // Round 2: base deepened a step off the milky ground (light-on-light
  // vanished) and the count raised for the close read.
  addCarpet(
    buildCarpetField({
      seed: SEED ^ 0x3003,
      palette: { base: 0x86b890, tip: 0xd8e8c2, shade: 0x6a7a80 },
      area: roadArea,
      gate: roadGate,
      ground: seabedHeight,
      count: 1500,
      profile: "blade",
      size: [0.3, 0.62],
      looseShare: 0.45,
      swayAmp: 0.06,
    }),
  );
  // Shell pebbles pacing the road — the close pose's anchor tier.
  add(
    buildGroundLitter({
      seed: SEED ^ 0x3006,
      palette: { base: 0xaab89e, tip: 0xd0d8c0, shade: 0x7a7a8c },
      area: roadArea,
      gate: roadGate,
      ground: seabedHeight,
      count: 450,
      shapeSet: "pebble",
      twoTone: true,
    }),
  );
  // The Boughfall's root-moss: brighter rosettes where the light still
  // follows the road down.
  addCarpet(
    buildCarpetField({
      seed: SEED ^ 0x3004,
      palette: { base: 0x6cb076, tip: 0xb8e094, shade: 0x655c86 },
      area: { polyline: descentLine(), width: 26 },
      gate: roadGate,
      ground: seabedHeight,
      count: 900,
      profile: "frond",
      size: [0.32, 0.62],
      looseShare: 0.4,
      swayAmp: 0.05,
    }),
  );

  // ─── The mesa skirt gardens (T1 at the pillar feet) ───────────────────────
  // Each crown's spill: taller sun-glow blades ringing every foot.
  for (const [index, mesa] of MESAS.entries()) {
    const { x, z } = worldOf(mesa.u, mesa.v);
    addCarpet(
      buildCarpetField({
        seed: SEED ^ (0x3010 + index),
        palette: { base: 0x6cb474, tip: 0xc9b45e, shade: 0x544672 },
        area: { center: [x, z] as [number, number], radius: 16 },
        gate: (gx, gz) => {
          const g = baseGate(gx, gz);
          if (g === 0) {
            return 0;
          }
          const { u, v } = spokeOf(gx, gz);
          const d = Math.hypot(u - mesa.u, v - mesa.v);
          if (d < mesa.footR * 0.9) {
            return 0;
          }
          return g * (1 - smoothstep01((d - mesa.footR - 5) / 6));
        },
        ground: seabedHeight,
        count: 300,
        profile: "blade",
        size: [0.5, 0.9],
        looseShare: 0.35,
        sunGlow: true,
        swayAmp: 0.08,
      }),
    );
  }

  // The wellspring rims: pale clean sward around the cool pockets.
  for (const [index, spring] of WELLSPRINGS.entries()) {
    const { x, z } = worldOf(spring.u, spring.v);
    addCarpet(
      buildCarpetField({
        seed: SEED ^ (0x3020 + index),
        palette: { base: 0x9fceac, tip: 0xd8ecd0, shade: 0x6a7a80 },
        area: { center: [x, z] as [number, number], radius: spring.radius * 1.9 },
        gate: (gx, gz) => {
          const g = baseGate(gx, gz);
          if (g === 0) {
            return 0;
          }
          const { u, v } = spokeOf(gx, gz);
          const d = Math.hypot(u - spring.u, v - spring.v);
          const ring =
            smoothstep01((d - spring.radius * 0.8) / 2) *
            (1 - smoothstep01((d - spring.radius * 1.6) / 3));
          return g * ring;
        },
        ground: seabedHeight,
        count: 260,
        profile: "blade",
        size: [0.34, 0.56],
        looseShare: 0.4,
        swayAmp: 0.06,
      }),
    );
  }

  // The Sunfall lawn: the well-lit floor under the great shaft.
  {
    const { x, z } = worldOf(SUNFALL.u, SUNFALL.v);
    addCarpet(
      buildCarpetField({
        seed: SEED ^ 0x3030,
        palette: { base: 0x7cc276, tip: 0xd0dc8a, shade: 0x5c6a5a },
        area: { center: [x, z] as [number, number], radius: 13 },
        gate: baseGate,
        ground: seabedHeight,
        count: 180,
        profile: "blade",
        size: [0.4, 0.75],
        looseShare: 0.4,
        sunGlow: true,
        swayAmp: 0.08,
      }),
    );
  }

  // The Province's End stand: gold-green blades on the last rise.
  {
    const { x, z } = worldOf(WORLDS_END.u, WORLDS_END.v);
    addCarpet(
      buildCarpetField({
        seed: SEED ^ 0x3031,
        palette: { base: 0x86b46a, tip: 0xd0c274, shade: 0x5c5a70 },
        area: { center: [x, z] as [number, number], radius: 20 },
        gate: baseGate,
        ground: seabedHeight,
        count: 220,
        profile: "blade",
        size: [0.5, 0.9],
        looseShare: 0.38,
        sunGlow: true,
        swayAmp: 0.08,
      }),
    );
  }

  // ─── T1: the litter ────────────────────────────────────────────────────────
  add(
    buildGroundLitter({
      seed: SEED ^ 0x3041,
      palette: { base: 0x7a8a74, tip: 0x9aa88c, shade: 0x5a5270 },
      area: discArea,
      gate: meadowGate,
      ground: seabedHeight,
      count: 850,
      shapeSet: "pebble",
      twoTone: true,
    }),
  );
  // The descent's raked gravel: broken edges pointing down the road.
  {
    const from = worldOf(1250, channelCenter(1250));
    add(
      buildGroundLitter({
        seed: SEED ^ 0x3042,
        palette: { base: 0x74806a, tip: 0x98a184, shade: 0x585070 },
        area: { polyline: descentLine(), width: 22 },
        gate: roadGate,
        ground: seabedHeight,
        count: 380,
        shapeSet: "shard",
        rake: { from: [from.x, from.z], strength: 0.8, jitter: 0.3 },
      }),
    );
  }
  // Split stones at the mesa roots: formed foreground rock.
  add(
    buildGroundLitter({
      seed: SEED ^ 0x3043,
      palette: { base: 0x82887a, tip: 0xa0a692, shade: 0x5a5270 },
      area: discArea,
      gate: (x, z) => {
        const g = baseGate(x, z);
        if (g === 0) {
          return 0;
        }
        const { u, v } = spokeOf(x, z);
        return g * smoothstep01(mesaMound(u, v) / 1.2);
      },
      ground: seabedHeight,
      count: 300,
      shapeSet: "split",
      grade: 0.6,
    }),
  );
  // Shell grit on the wellspring rims.
  for (const [index, spring] of WELLSPRINGS.entries()) {
    const { x, z } = worldOf(spring.u, spring.v);
    add(
      buildGroundLitter({
        seed: SEED ^ (0x3044 + index),
        palette: { base: 0xb8c2ac, tip: 0xd6dcc8, shade: 0x8a8a96 },
        area: { center: [x, z] as [number, number], radius: spring.radius * 1.8 },
        gate: (gx, gz) => {
          const g = baseGate(gx, gz);
          if (g === 0) {
            return 0;
          }
          const { u, v } = spokeOf(gx, gz);
          const d = Math.hypot(u - spring.u, v - spring.v);
          return g * smoothstep01((d - spring.radius * 0.9) / 2) * (1 - smoothstep01((d - spring.radius * 1.6) / 3));
        },
        ground: seabedHeight,
        count: 110,
        shapeSet: "pebble",
      }),
    );
  }

  // ─── T2: the bush banks ───────────────────────────────────────────────────
  // The shade scrub: wine-violet cushion bushes with rose bud knots — a
  // full value step off the deep moss so they read from midwater.
  add(
    buildBushBank({
      seed: SEED ^ 0x3051,
      palette: { base: 0x966a86, tip: 0xcc9aa6, shade: 0x5c5080, accent: 0xdcaab2 },
      area: discArea,
      gate: meadowGate,
      ground: seabedHeight,
      count: 46,
      lobes: 6,
      fronds: 8,
      accents: 4,
      scale: 1.1,
    }),
  );
  // The garden skirts' spring bushes at the pillar feet.
  add(
    buildBushBank({
      seed: SEED ^ 0x3052,
      palette: { base: 0x5ca660, tip: 0x9ed07e, shade: 0x4a4468, accent: 0xc9b45e },
      area: discArea,
      gate: (x, z) => {
        const g = baseGate(x, z);
        if (g === 0) {
          return 0;
        }
        const { u, v } = spokeOf(x, z);
        return g * smoothstep01(mesaMound(u, v) / 1.1);
      },
      ground: seabedHeight,
      count: 28,
      lobes: 5,
      fronds: 10,
      accents: 5,
    }),
  );
  // The threshold's celadon scrub, pacing the road in.
  add(
    buildBushBank({
      seed: SEED ^ 0x3053,
      palette: { base: 0x8cb894, tip: 0xc4dcb2, shade: 0x6a7a80, accent: 0xd8e8c2 },
      area: roadArea,
      gate: roadGate,
      ground: seabedHeight,
      count: 12,
      lobes: 5,
      fronds: 6,
      accents: 3,
    }),
  );
  // The Province's End gold bushes, framing the last view.
  {
    const { x, z } = worldOf(WORLDS_END.u, WORLDS_END.v);
    add(
      buildBushBank({
        seed: SEED ^ 0x3054,
        palette: { base: 0x9aa860, tip: 0xd0c274, shade: 0x5c5a70, accent: 0xe0d090 },
        area: { center: [x, z] as [number, number], radius: 18 },
        gate: baseGate,
        ground: seabedHeight,
        count: 8,
        lobes: 6,
        fronds: 9,
        accents: 5,
      }),
    );
  }

  // ─── T2: the shed crowns ──────────────────────────────────────────────────
  // Wrack curls under the Old Canopy — the roof sheds, the floor keeps.
  add(
    buildDriftDebris({
      seed: SEED ^ 0x3061,
      palette: { base: 0x6a8a5c, tip: 0x9aa87a, shade: 0x544672 },
      area: discArea,
      gate: meadowGate,
      ground: seabedHeight,
      count: 220,
      shapeSet: "wrack",
    }),
  );

  let draws = 0;
  let triangles = 0;
  for (const build of builds) {
    draws += build.draws;
    triangles += build.triangles;
    groups.push(build.group);
  }

  return {
    groups,
    draws,
    triangles,
    update(timeSec: number): void {
      for (const carpet of carpets) {
        carpet.update(timeSec);
      }
    },
  };
}

/** The pass road's spine as a world polyline. */
function roadLine(): [number, number][] {
  const line: [number, number][] = [];
  for (let u = 1132; u <= 1325; u += 12) {
    const { x, z } = worldOf(u, channelCenter(u));
    line.push([x, z]);
  }
  return line;
}

/** The Boughfall's descent as a world polyline. */
function descentLine(): [number, number][] {
  const line: [number, number][] = [];
  for (let u = 1246; u <= 1332; u += 8) {
    const { x, z } = worldOf(u, channelCenter(u));
    line.push([x, z]);
  }
  return line;
}
