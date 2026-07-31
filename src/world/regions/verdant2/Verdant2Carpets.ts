import {
  BoxGeometry,
  Mesh,
  TorusGeometry,
  type BufferGeometry,
  type Group,
  type MeshToonMaterial,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBushBank } from "../kit/BushBank";
import { buildCarpetField } from "../kit/CarpetField";
import { buildGroundLitter } from "../kit/GroundLitter";
import { buildWallDrapeBank, type DrapeAnchor } from "../kit/WallDrape";
import type { GateFn, KitArea, KitBuild } from "../kit/KitTypes";
import { contourU } from "./Verdant2Gardens";
import { smoothstep01 } from "./Verdant2Shared";
import {
  BALCONY,
  CISTERN,
  FERN_VAULT,
  MISTFALL,
  balconyWeight,
  cisternWeight,
  gardenTerraces,
  mistfallDrop,
  mistfallLipU,
  spokeOf,
  stairChannelCenter,
  stairChannelHalf,
  stepFootU,
  vaultWeight,
  verdant2Weight,
  worldOf,
} from "./Verdant2Terrain";

/**
 * The Emerald Terraces' ground cover — the doctrine's T1/T2 fill, all of
 * it kit consumption (FILL-DOCTRINE rule 3: no square metre bare by
 * accident). Carpet families per zone, pebble/litter runs, bush banks,
 * the worked-stone shard set (exclusive shapes fed to the kit litter
 * scatterer per MASTER R8), the sleeper skirts, and the riser-face drape
 * base (kit `wallDrapeBank` — the exclusive garden strips layer on top
 * of it in `Verdant2Gardens`).
 *
 * Every seed is `SEEDS.regionVerdant2 ^ <fresh 0xf1xx–0xf4xx constant>`,
 * appended after all pre-fill draws — the reroll fence the region test
 * pins. The protected rests (MASTER §1.2) are gated out by construction:
 * the Cistern bowl interior, the Fern Vault's inner shadow and the basin
 * south pocket (1060, −30) never pass a gate below.
 *
 * R12.3 QUALITY RE-PASS: every swimmable carpet family swaps its far-tier
 * `"card"`/`"tuft"` profile for the kit's authored `"blade"`/`"frond"`
 * (the owner's "half-cut grass" verdict answered with the bowl meadow's
 * craft) — the swap re-rolls those families' own buffers, which is the
 * point and is honest; landmarks and every other system stay
 * byte-unchanged. Bushes opt into `fronds`/`accents`, litter runs take
 * `grade`, and the ×3 headroom is spent on new road-edge stands, split
 * stone, deeper vault understory and richer curtains — all on fresh
 * `^ 0xf1xx/0xf2xx/0xf4xx` constants appended after every existing draw.
 */

const SEED = SEEDS.regionVerdant2;

export interface Verdant2CarpetsBuild {
  readonly groups: Group[];
  readonly draws: number;
  readonly triangles: number;
  update(timeSec: number): void;
}

/** The registered rests: 0 inside, easing to 1 at the rim of each. */
function stillnessGate(u: number, v: number): number {
  // The Cistern bowl interior — the mirror is the rest (registry line 1).
  const bowl = 1 - smoothstep01((26 - Math.hypot(u - CISTERN.u, v - CISTERN.v)) / 6);
  // The Fern Vault's inner shadow.
  const shadow = 1 - smoothstep01((9 - Math.hypot(u - FERN_VAULT.u, v - FERN_VAULT.v)) / 5);
  // The basin's south pocket (1060, −30).
  const pocket = 1 - smoothstep01((14 - Math.hypot(u - 1060, v - -30)) / 6);
  return bowl * shadow * pocket;
}

/**
 * The drift field (round 4): a seeded fbm mottle that gathers broad-field
 * cover into ~13 m drifts with composed gaps between. The r3 sweep's
 * verdict was arithmetic — a uniform scatter of ankle cards reads as
 * noise from any midwater pose, however many there are; the same count
 * gathered 3–4× locally reads as ground COVER with intent. Roads and
 * zone dressings keep their even gates; only the open country drifts.
 */
function drift(u: number, v: number): number {
  const value = fbm(u / 13, v / 13, { seed: SEED ^ 0xf00d, period: 64, octaves: 2 });
  return 0.15 + 0.85 * smoothstep01((value - 0.47) / 0.2);
}

/**
 * The pour's own face — the only part of the great drop that stays bare
 * (the milk, the fan and the billows live there). Round 4b narrowed the
 * exclusion from the whole drop band to the pour's ±18 m; round 5's pose
 * probe then showed the sweep's bare flanks (frames 02/10) were never
 * this face at all but the basin's south side, which no zone bed
 * reached — see the south-flank bed below.
 */
function onFallFace(u: number, v: number): boolean {
  const d = mistfallDrop(u, v);
  return d > 0.1 && d < 0.9 && Math.abs(v - MISTFALL.v) < 18;
}

/**
 * The dusk lift (re-pass round 3): the deep country dims the mood light
 * to the point where the kit's painted values render near-silhouette —
 * the same failure the region's own curtains hit in its round 4 ("the
 * hems kept reading black through three rounds of tone lifts — in this
 * water the shadow side needs its own light, a colour, never a black").
 * The curtains' cure, applied consumer-side to the kit builds: an
 * emissive floor under the toon shade. Region-side material tweak only;
 * the kit, its buffers and its streams are untouched.
 */
function duskLift<T extends KitBuild>(build: T, hex: number, intensity: number): T {
  build.group.traverse((node) => {
    if (node instanceof Mesh) {
      const material = node.material as MeshToonMaterial;
      if ("emissive" in material) {
        material.emissive.setHex(hex);
        material.emissiveIntensity = intensity;
      }
    }
  });
  return build;
}

/** The deep green families' floor (the curtain material's own family). */
const DUSK_GREEN = 0x223a2a;
/** The basin's silt-violet families: cooler, a step quieter. */
const DUSK_SILT = 0x2c3440;

function spokeGate(fn: (u: number, v: number) => number): GateFn {
  return (x, z) => {
    if (verdant2Weight(x, z) <= 0) {
      return 0;
    }
    const { u, v } = spokeOf(x, z);
    return Math.max(0, Math.min(1, fn(u, v))) * stillnessGate(u, v);
  };
}

/** A road area along the pass spine between two spoke distances. */
function spineRoad(fromU: number, toU: number, width: number): KitArea {
  const polyline: [number, number][] = [];
  for (let u = fromU; u <= toU; u += 16) {
    const { x, z } = worldOf(u, stairChannelCenter(u));
    polyline.push([x, z]);
  }
  return { polyline, width };
}

function disc(u: number, v: number, radius: number): KitArea {
  const { x, z } = worldOf(u, v);
  return { center: [x, z], radius };
}

export function buildVerdant2Carpets(): Verdant2CarpetsBuild {
  const builds: KitBuild[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  // ─── The whole country's base cover (round 2; grown round 3) ─────────────
  // The round-1 sweep caught what the authored poses cannot: between the
  // zone gates the disc's open slopes were still bare by accident. One
  // moss-card carpet and one litter drift cover EVERY square metre the
  // region owns (doctrine rule 3 — cover is chosen, not defaulted); the
  // zone carpets above and below layer their own keys over this.
  // Round 3: count 2200 → 5200 and cards 0.14–0.3 → 0.22–0.5 m — the r2
  // sweep proved a 20 cm card at 1 per 8 m² is sub-pixel from any
  // midwater pose, which is bare-by-arithmetic however chosen it was.
  // Round 5: broad fields thinned ~15% to pay for the south-flank and
  // southwest-approach beds — targeted cover where the sweep actually
  // failed buys more than the same triangles spread thin everywhere.
  const heart = worldOf(940, 0);
  // R12.3: card → blade (the whole-country floor is the surface the
  // owner judged; 4-tri wedges at 1 per 8 m² were the verdict's exact
  // subject). Count 4000 → 2800 across two rounds pays the profile's
  // 12× bill and funds the zone beds where the close poses stand;
  // looseShare up so a random view cone always owns a clump (F-R2).
  // Round 2: every deep-country key lifted a value step — the r1
  // captures proved the swapped families render a full value darker
  // than their hexes under this mood (the v1 re-pass lesson, pre-paid).
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf10a,
      palette: { base: 0x7cbe8c, tip: 0xa4d492, shade: 0x639a72 },
      area: { center: [heart.x, heart.z], radius: 200 },
      gate: spokeGate((u, v) => {
        if (onFallFace(u, v)) {
          return 0; // never on the pour's own face
        }
        return 0.85 * drift(u, v);
      }),
      ground: seabedHeight,
      count: 2500,
      profile: "blade",
      size: [0.3, 0.6],
      sunGlow: true,
      looseShare: 0.45,
    }), DUSK_GREEN, 0.5),
  );
  builds.push(
    buildGroundLitter({
      seed: SEED ^ 0xf208,
      palette: { base: 0x77875f, shade: 0x5c5470 },
      area: { center: [heart.x, heart.z], radius: 200 },
      gate: spokeGate((u, v) =>
        onFallFace(u, v) ? 0 : 0.7 * drift(u, v),
      ),
      ground: seabedHeight,
      count: 700,
      shapeSet: "pebble",
      size: [0.08, 0.2],
      grade: 0.55,
    }),
  );
  // The country's understory (round 4): knee-high tuft drifts and a
  // sparse bush scatter riding the same drift field — the mid-scale
  // silhouettes the open slopes had none of (the r3 sweep's flat banks).
  // R12.3: tuft → blade, grown to knee-thigh — the stands the open
  // country reads at swimming distance.
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf10c,
      palette: { base: 0x70be84, tip: 0xa4d492, shade: 0x588c6a },
      area: { center: [heart.x, heart.z], radius: 200 },
      gate: spokeGate((u, v) => {
        if (onFallFace(u, v)) {
          return 0;
        }
        return 0.8 * drift(u, v);
      }),
      ground: seabedHeight,
      // Round 9: 870 → 840 helps fund the approach bush cluster.
      count: 840,
      profile: "blade",
      size: [0.4, 0.8],
      swayAmp: 0.06,
      sunGlow: true,
    }), DUSK_GREEN, 0.5),
  );
  builds.push(
    duskLift(buildBushBank({
      seed: SEED ^ 0xf306,
      palette: { base: 0x6fae5f, tip: 0x9ac96f, shade: 0x44703f, accent: 0xc4788a },
      area: { center: [heart.x, heart.z], radius: 200 },
      gate: spokeGate((u, v) => {
        if (onFallFace(u, v)) {
          return 0;
        }
        // Off the pass road's centre line, so the way in stays a way.
        const offside = u < 860 ? smoothstep01((Math.abs(v - stairChannelCenter(u)) - 6) / 5) : 1;
        return 0.8 * offside * drift(u, v);
      }),
      ground: seabedHeight,
      count: 40,
      scale: 0.9,
      fronds: 8,
      accents: 4,
    }), DUSK_GREEN, 0.3),
  );

  // ─── The threshold: the 40 m handover lerp, lived on the ground ──────────
  // Milky-crest cards sampling verdant-1's Falling Edge multipliers
  // (0.98/1.02/0.92) at u < 700, handing to this region's own celadon by
  // u 740 — the doctrine's transition rule as two crossfading carpets.
  // R12.3: both handover carpets card → blade — the road in is judged at
  // swimming height the whole way, and the crossfade reads better when
  // both sides of it are plants rather than chips.
  builds.push(
    buildCarpetField({
      seed: SEED ^ 0xf101,
      palette: { base: 0xdfe2c6, tip: 0xefe9d2, shade: 0x8fa682 },
      area: spineRoad(636, 756, 30),
      gate: spokeGate((u, v) => {
        const inChannel = 1 - smoothstep01((Math.abs(v - stairChannelCenter(u)) - 9) / 8);
        return (1 - smoothstep01((u - 700) / 40)) * (0.4 + 0.6 * inChannel);
      }),
      ground: seabedHeight,
      count: 950,
      profile: "blade",
      size: [0.22, 0.44],
      swayAmp: 0.05,
      sunGlow: true,
    }),
  );
  builds.push(
    buildCarpetField({
      seed: SEED ^ 0xf102,
      palette: { base: 0x8fd0ab, tip: 0xb2dfbe, shade: 0x6dac8e },
      area: spineRoad(690, 780, 32),
      gate: spokeGate((u) => smoothstep01((u - 700) / 40)),
      ground: seabedHeight,
      count: 750,
      profile: "blade",
      size: [0.22, 0.46],
      swayAmp: 0.05,
      sunGlow: true,
    }),
  );
  // Shell-pebble runs drifted along the threshold road's sides.
  // Round 2: value taken down toward the ground's own key — the round-1
  // pebbles read as pale lavender chips against the milky shelf (the
  // confetti lesson: variety by value, and never brighter than the wash).
  builds.push(
    buildGroundLitter({
      seed: SEED ^ 0xf201,
      palette: { base: 0xaaa88e, shade: 0x6d6878 },
      area: spineRoad(644, 744, 26),
      gate: spokeGate((u, v) => {
        const offside = smoothstep01((Math.abs(v - stairChannelCenter(u)) - 3) / 5);
        return (1 - smoothstep01((u - 720) / 30)) * (0.25 + 0.75 * offside);
      }),
      ground: seabedHeight,
      count: 400,
      shapeSet: "pebble",
      size: [0.06, 0.16],
      grade: 0.5,
    }),
  );
  // Pale bushes marking the waymark rhythm. R12.3: pale buds on the
  // crowns — the waymarks gain the close-range read the rhythm deserves.
  builds.push(
    buildBushBank({
      seed: SEED ^ 0xf301,
      palette: { base: 0xb9c4a4, tip: 0xd8dcba, shade: 0x7a8570, accent: 0xe3d5ae },
      area: spineRoad(650, 745, 26),
      gate: spokeGate((u, v) => {
        const offside = smoothstep01((Math.abs(v - stairChannelCenter(u)) - 4) / 4);
        return 0.7 * offside;
      }),
      ground: seabedHeight,
      count: 10,
      fronds: 5,
      accents: 3,
    }),
  );

  // ─── The Emerald Stair: tread moss + wine bushes at the lip corners ──────
  // R12.3: card → blade — the treads are where the stair pose and the
  // close pose both stand (r2: count restored to 1800 and the key
  // lifted; concentration over looseShare, the treads read as clumps).
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf103,
      palette: { base: 0x70c688, tip: 0xaeda82, shade: 0x568a66 },
      area: spineRoad(742, 850, 34),
      gate: spokeGate((u, v) => {
        const inChannel = 1 - smoothstep01((Math.abs(v - stairChannelCenter(u)) - stairChannelHalf(u) + 1) / 4);
        return 0.9 * inChannel;
      }),
      ground: seabedHeight,
      count: 1800,
      profile: "blade",
      size: [0.24, 0.48],
      swayAmp: 0.05,
      sunGlow: true,
    }), DUSK_GREEN, 0.5),
  );
  // Wine lip-corner scrub: thorny, not leafy — sparse fronds, more knots.
  builds.push(
    buildBushBank({
      seed: SEED ^ 0xf302,
      palette: { base: 0x84525f, tip: 0xa8707a, shade: 0x4f3a52, accent: 0xc27a88 },
      area: spineRoad(748, 848, 30),
      gate: spokeGate((u, v) => {
        // Lip corners: near a step foot, off the channel's centre line.
        let nearLip = 0;
        for (let i = 0; i < 8; i++) {
          nearLip = Math.max(nearLip, 1 - smoothstep01((Math.abs(u - stepFootU(i)) - 1.5) / 2.5));
        }
        const offside = smoothstep01((Math.abs(v - stairChannelCenter(u)) - 4) / 4);
        return nearLip * offside;
      }),
      ground: seabedHeight,
      count: 20,
      scale: 0.8,
      fronds: 3,
      accents: 5,
    }),
  );

  // ─── The Hanging Gardens: tread carpets, pebble drifts, garden bushes ────
  const gardensGate = (u: number, v: number): number => {
    if (
      cisternWeight(u, v) > 0.3 ||
      vaultWeight(u, v) > 0.35 ||
      mistfallDrop(u - 2, v) > 0.05 ||
      balconyWeight(u, v) > 0.2
    ) {
      return 0;
    }
    return u >= 836 && u <= 995 && v >= -85 && v <= 70 ? 1 : 0;
  };
  // R12.3: the garden treads are the region's heart and its closest-
  // judged ground — card → blade on the tread carpet, tuft → frond on the
  // celadon layer (the hanging gardens are exactly where frond rosettes
  // belong), berries on the garden bushes.
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf104,
      palette: { base: 0x74ce94, tip: 0xaeda82, shade: 0x529068 },
      area: disc(910, -8, 92),
      gate: spokeGate(
        (u, v) =>
          gardensGate(u, v) *
          (0.5 + 0.5 * (1 - gardenTerraces(u, v).riser)) *
          (0.35 + 0.65 * drift(u, v)),
      ),
      ground: seabedHeight,
      count: 2300,
      profile: "blade",
      size: [0.24, 0.5],
      swayAmp: 0.05,
      sunGlow: true,
    }), DUSK_GREEN, 0.5),
  );
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf105,
      palette: { base: 0x92dcb8, tip: 0xb9edd0, shade: 0x6dac8e },
      area: disc(890, 20, 86),
      gate: spokeGate((u, v) => gardensGate(u, v) * 0.8 * (0.3 + 0.7 * drift(u + 200, v))),
      ground: seabedHeight,
      count: 1200,
      profile: "frond",
      size: [0.24, 0.46],
      swayAmp: 0.06,
      sunGlow: true,
    }), DUSK_GREEN, 0.5),
  );
  // Round 2: moss-toned and smaller — the round-1 drift read as pale
  // confetti scattered over every garden frame instead of fallen stone.
  builds.push(
    buildGroundLitter({
      seed: SEED ^ 0xf202,
      palette: { base: 0x6f8258, shade: 0x51446a },
      area: disc(905, -12, 96),
      gate: spokeGate((u, v) => gardensGate(u, v) * (0.3 + 0.7 * gardenTerraces(u, v).riser)),
      ground: seabedHeight,
      count: 420,
      shapeSet: "pebble",
      size: [0.06, 0.15],
      grade: 0.5,
    }),
  );
  builds.push(
    duskLift(buildBushBank({
      seed: SEED ^ 0xf303,
      palette: { base: 0x6fae5f, tip: 0x9ac96f, shade: 0x44703f, accent: 0xc4788a },
      area: disc(905, -10, 92),
      gate: spokeGate((u, v) => gardensGate(u, v)),
      ground: seabedHeight,
      count: 60,
      scale: 0.9,
      fronds: 10,
      accents: 6,
    }), DUSK_GREEN, 0.3),
  );

  // ─── The Fern Vault: deep celadon floor + fern litter ────────────────────
  // The stillness gate keeps the inner shadow bare; the half-light's
  // value gradient is baked in the ground paint (Verdant2Ground).
  // R12.3: card → frond — a fern vault's floor is rosettes by name. The
  // half-light register keeps sunGlow off; the value lift comes from the
  // palette (v1 re-pass r1: under a dim sun small fronds drop toward
  // silhouette, so the base and tip both step up).
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf106,
      palette: { base: 0x68ac7c, tip: 0x92d49a, shade: 0x51446a },
      area: disc(FERN_VAULT.u, FERN_VAULT.v, 26),
      gate: spokeGate((u, v) => smoothstep01((vaultWeight(u, v) - 0.18) / 0.3)),
      ground: seabedHeight,
      count: 1050,
      profile: "frond",
      size: [0.22, 0.44],
    }), DUSK_GREEN, 0.45),
  );
  builds.push(
    buildGroundLitter({
      seed: SEED ^ 0xf203,
      palette: { base: 0x7a8a5c, shade: 0x51446a },
      area: disc(FERN_VAULT.u, FERN_VAULT.v, 24),
      gate: spokeGate((u, v) => smoothstep01((vaultWeight(u, v) - 0.3) / 0.3) * 0.8),
      ground: seabedHeight,
      count: 400,
      shapeSet: "shard",
      size: [0.08, 0.24],
      grade: 0.6,
    }),
  );

  // ─── The Mistfall lip shoulder + the basin's silt blooms ─────────────────
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf107,
      palette: { base: 0x7cca8c, tip: 0xaeda82, shade: 0x5a8a6c },
      area: disc(996, 8, 34),
      gate: spokeGate((u, v) => {
        const beforeLip = 1 - smoothstep01((u - (mistfallLipU(v) - 1)) / 2);
        const offFall = smoothstep01((Math.abs(v - MISTFALL.v) - 11) / 6);
        return beforeLip * (0.3 + 0.7 * offFall) * smoothstep01((u - 975) / 8);
      }),
      ground: seabedHeight,
      count: 650,
      profile: "blade",
      size: [0.2, 0.4],
      swayAmp: 0.05,
      sunGlow: true,
    }), DUSK_GREEN, 0.5),
  );
  // R12.3: the basin silt blooms go frond (rosettes standing off the
  // violet floor), count 1900 → 1400 against the profile bill, and the
  // key lifts a half step — the deep families sat a value too close to
  // their own ground under the misty light.
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf108,
      palette: { base: 0x699a7c, tip: 0x8cbb96, shade: 0x5e5480 },
      area: disc(1046, 8, 52),
      gate: spokeGate((u, v) => mistfallDrop(u, v) * (u > 1008 ? 1 : 0) * (0.3 + 0.7 * drift(u, v))),
      ground: seabedHeight,
      count: 1350,
      profile: "frond",
      size: [0.24, 0.46],
    }), DUSK_SILT, 0.45),
  );
  builds.push(
    duskLift(buildBushBank({
      seed: SEED ^ 0xf304,
      palette: { base: 0x84525f, tip: 0xa8707a, shade: 0x4f3a52, accent: 0xc27a88 },
      area: disc(1046, 6, 46),
      gate: spokeGate((u, v) => (mistfallDrop(u, v) > 0.9 && u > 1014 ? 0.8 : 0)),
      ground: seabedHeight,
      count: 12,
      scale: 0.85,
      fronds: 4,
      accents: 5,
    }), DUSK_SILT, 0.3),
  );

  // ─── The pillar-sector bed (round 3) ─────────────────────────────────────
  // The mesa-city cards' near cluster stands INSIDE the swimmable domain
  // (rc 132–172, u ≈ 1039–1112), and the r2 sweep swam there: flat cards
  // on naked violet ground (frames 03/05/12). The promise's own floor is
  // owned ground like any other — a silt carpet, a litter drift and a
  // few wine bushes carry the country out to the card feet. The basin's
  // south pocket keeps its stillness through the shared gate.
  const sectorGate = spokeGate((u, v) => {
    if (u < 1030 || balconyWeight(u, v) > 0.2) {
      return 0;
    }
    return 0.85 * drift(u, v);
  });
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf10b,
      palette: { base: 0x699a7c, tip: 0x8cbb96, shade: 0x5e5480 },
      area: disc(1082, 42, 52),
      gate: sectorGate,
      ground: seabedHeight,
      count: 800,
      profile: "frond",
      size: [0.24, 0.46],
      looseShare: 0.4,
    }), DUSK_SILT, 0.45),
  );
  builds.push(
    buildGroundLitter({
      seed: SEED ^ 0xf209,
      palette: { base: 0x6f7d68, shade: 0x51446a },
      area: disc(1082, 42, 48),
      gate: sectorGate,
      ground: seabedHeight,
      count: 260,
      shapeSet: "pebble",
      size: [0.08, 0.24],
      grade: 0.5,
    }),
  );
  builds.push(
    duskLift(buildBushBank({
      seed: SEED ^ 0xf305,
      palette: { base: 0x84525f, tip: 0xa8707a, shade: 0x4f3a52, accent: 0xc27a88 },
      area: disc(1082, 44, 44),
      gate: sectorGate,
      ground: seabedHeight,
      count: 10,
      scale: 0.85,
      fronds: 4,
      accents: 5,
    }), DUSK_SILT, 0.3),
  );

  // ─── The basin's south flank (round 5) ───────────────────────────────────
  // The r4/r4b sweeps kept failing frames 02 and 10, and the pose probe
  // finally located them: both look at the basin's SOUTH side (v ≈ −40 to
  // −100), where the silt carpet (disc v 8) and the sector bed (disc v 42)
  // never reach — only the base cover thinned through a drift gap. The
  // r4b fall-face retune was aimed at the wrong band entirely. This bed
  // owns that flank: same silt-violet key as the basin floor, a drift
  // FLOOR of 0.45 so no gap goes naked, and the south-pocket rest kept
  // dark by the shared stillness gate.
  const southFlankGate = spokeGate((u, v) => {
    if (u <= 1008) {
      return 0;
    }
    return mistfallDrop(u, v) * (0.45 + 0.55 * drift(u, v));
  });
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf10d,
      palette: { base: 0x699a7c, tip: 0x8cbb96, shade: 0x5e5480 },
      area: disc(1060, -80, 55),
      gate: southFlankGate,
      ground: seabedHeight,
      // Round 8: 750 → 500 funds the second bush bank — by this bed's own
      // r6 lesson the ankle cards are the least visible thing on the flank.
      count: 800,
      profile: "blade",
      size: [0.24, 0.48],
      looseShare: 0.5,
    }), DUSK_SILT, 0.45),
  );
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf10e,
      palette: { base: 0x70be84, tip: 0xa4d492, shade: 0x588c6a },
      area: disc(1060, -80, 55),
      gate: southFlankGate,
      ground: seabedHeight,
      count: 120,
      profile: "blade",
      // Round 7: knee-high → thigh-high. Frame 10 looks down this flank
      // from ~7 m up; the 0.28–0.55 tufts read as specks at that range
      // while the same tufts pass at ground level (frame 02). R12.3:
      // the thigh-high band keeps its envelope on the blade profile.
      size: [0.42, 0.8],
      swayAmp: 0.06,
    }), DUSK_GREEN, 0.5),
  );
  builds.push(
    buildGroundLitter({
      seed: SEED ^ 0xf20a,
      palette: { base: 0x6f7d68, shade: 0x51446a },
      area: disc(1060, -80, 50),
      gate: southFlankGate,
      ground: seabedHeight,
      count: 100,
      shapeSet: "pebble",
      size: [0.08, 0.24],
      grade: 0.5,
    }),
  );
  // Round 6: mid-scale silhouettes for the flank — from the sweep's 4–7 m
  // midwater cameras (frames 02/10) ankle cards and knee tufts read as
  // specks however dense; a dozen wine bushes in the basin's own key give
  // those frames actual OBJECTS the way the sleepers serve the north side.
  // Round 7: the r6 capture proved the wine key INVISIBLE here — value and
  // hue both sit on the violet silt (shade 0x51446a) they stand on. Same
  // bushes, brighter rose lifted a full value step off the ground, and
  // scale 0.9 → 1.2 (scale is free; count unchanged).
  builds.push(
    buildBushBank({
      seed: SEED ^ 0xf307,
      palette: { base: 0xa8697a, tip: 0xd08e9a, shade: 0x5c4260, accent: 0xe8b6c0 },
      area: disc(1060, -80, 50),
      gate: southFlankGate,
      ground: seabedHeight,
      count: 12,
      scale: 1.2,
      fronds: 6,
      accents: 5,
    }),
  );
  // Round 8: the position probe showed WHY the flank bushes never appear
  // in sweep frame 10 — scatterPoints gathers 12 bushes into ~2 clumps,
  // and 0xf307's two hearts both landed at u ≈ 1086, east of the frame's
  // camera wedge (u 1051–1071 looking south). A second bank on a disc
  // held INSIDE that wedge puts its clump hearts where the camera can
  // see them. Four lobes (144 tris/bush) keep it affordable.
  builds.push(
    buildBushBank({
      seed: SEED ^ 0xf308,
      palette: { base: 0xa8697a, tip: 0xd08e9a, shade: 0x5c4260, accent: 0xe8b6c0 },
      area: disc(1058, -72, 28),
      gate: southFlankGate,
      ground: seabedHeight,
      count: 12,
      lobes: 4,
      scale: 1.1,
      fronds: 6,
      accents: 5,
    }),
  );

  // ─── The southwest approach (round 5) ────────────────────────────────────
  // Frames 04 and 07 stand on the country's southwest slope — south of the
  // gardens band (whose gate cuts at v ≥ −85), west of the vault, off the
  // stair road — where again only drift-gapped base cover lands. A meadow
  // bed with the same drift floor carries the turf key out there; the
  // vault keeps its own floor (and its inner-shadow rest) to itself.
  const approachGate = spokeGate((u, v) => {
    if (vaultWeight(u, v) > 0.35) {
      return 0;
    }
    return 0.45 + 0.55 * drift(u, v);
  });
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf10f,
      palette: { base: 0x7cbe8c, tip: 0xa4d492, shade: 0x639a72 },
      area: disc(820, -100, 55),
      gate: approachGate,
      ground: seabedHeight,
      // Round 9: 500 → 400 helps fund the approach bush cluster below.
      count: 400,
      profile: "blade",
      size: [0.28, 0.55],
      sunGlow: true,
      looseShare: 0.5,
    }), DUSK_GREEN, 0.5),
  );
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf110,
      palette: { base: 0x70be84, tip: 0xa4d492, shade: 0x588c6a },
      area: disc(820, -100, 55),
      gate: approachGate,
      ground: seabedHeight,
      count: 100,
      profile: "blade",
      size: [0.36, 0.7],
      swayAmp: 0.06,
      sunGlow: true,
    }), DUSK_GREEN, 0.5),
  );
  // Round 9: the last marginal sweep frame (07) hangs 8 m over this slope
  // at (814, −68) looking at (826, −60) — its only mid-scale layer was the
  // naked ridge line. A small olive cluster on a disc held ON that look
  // ray gives the frame real objects the way the rose bank served
  // frame 10 (same probe, same lesson: place INSIDE the camera wedge —
  // the first try at disc(826, −60, 22) let the clump heart wander 66°
  // off-axis; a 12 m disc centred 25 m down the ray cannot).
  // Round 10: the probe confirms the hearts at (832, −65), 18 m out and
  // 24° off the look ray — IN frame — yet the capture shows only bumps:
  // at scale 1.0 in the shelf's own olive they were position-right and
  // read-wrong. The r7 flank lesson verbatim (size + value, not place):
  // scale 1.35, key a warm value step off the teal shelf. Zero triangles.
  builds.push(
    duskLift(buildBushBank({
      seed: SEED ^ 0xf309,
      palette: { base: 0x93c161, tip: 0xc8dd85, shade: 0x567a41, accent: 0xd8c874 },
      area: disc(832, -56, 12),
      gate: approachGate,
      ground: seabedHeight,
      count: 10,
      lobes: 4,
      scale: 1.35,
      fronds: 6,
      accents: 4,
    }), DUSK_GREEN, 0.3),
  );

  // ─── The Far Balcony: the deck's moss-joint carpet ───────────────────────
  // R12.3: card → frond at moss scale — small rosettes growing out of the
  // worked joints instead of loose chips lying on them.
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf109,
      palette: { base: 0x8fae83, tip: 0xb9c9a2, shade: 0x6a7a62 },
      area: disc(BALCONY.u, BALCONY.v, 16),
      gate: spokeGate((u, v) => smoothstep01((balconyWeight(u, v) - 0.3) / 0.3)),
      ground: seabedHeight,
      count: 500,
      profile: "frond",
      size: [0.14, 0.28],
    }), DUSK_GREEN, 0.4),
  );

  // ─── The worked-stone shard set (exclusive shapes, kit scatterer) ────────
  // Where the country remembers being built: the Cistern rim, the balcony
  // deck and the Emerald Gate's feet take carved fragments — lintel, step
  // corner, bowl rim — as one merged litter draw per place.
  const shardShapes = workedShardShapes();
  for (const [seed, area, gate] of [
    [
      SEED ^ 0xf204,
      disc(CISTERN.u, CISTERN.v, 40),
      spokeGate((u, v) => {
        const d = Math.hypot(u - CISTERN.u, v - CISTERN.v);
        return d > 28 && d < 40 ? 1 : 0;
      }),
    ],
    [
      SEED ^ 0xf205,
      disc(BALCONY.u, BALCONY.v, 14),
      spokeGate((u, v) => smoothstep01((balconyWeight(u, v) - 0.35) / 0.3)),
    ],
    [
      SEED ^ 0xf206,
      disc(748, 0, 12),
      spokeGate((u, v) => (Math.abs(v - stairChannelCenter(u)) > 5 ? 1 : 0.2)),
    ],
  ] as const) {
    // Round 2: fewer, smaller, and a value up — eight per site read as
    // dark chips floating at the Emerald Gate's feet.
    builds.push(
      buildGroundLitter({
        seed,
        palette: { base: 0xb7c4ac, shade: 0x7a8474 },
        area,
        gate,
        ground: seabedHeight,
        count: 6,
        shapeSet: shardShapes,
        size: [0.4, 0.75],
      }),
    );
  }

  // ─── The sleeper skirts ──────────────────────────────────────────────────
  // Pebble aprons around the basin's half-buried sleepers, so the deepest
  // stones sit in ground that remembers them.
  builds.push(
    buildGroundLitter({
      seed: SEED ^ 0xf207,
      palette: { base: 0x6f7d68, shade: 0x51446a },
      area: disc(1045, MISTFALL.v, 40),
      gate: spokeGate((u, v) => (mistfallDrop(u, v) > 0.9 && u > 1014 && u < 1072 ? 0.8 : 0)),
      ground: seabedHeight,
      count: 300,
      shapeSet: "pebble",
      size: [0.08, 0.26],
      grade: 0.6,
    }),
  );

  // ─── The riser-face drape base (kit wallDrapeBank) ───────────────────────
  // The base layer of the region's signature exclusive: hanging growth ON
  // the vertical faces every pose actually looks at. The stair's eight
  // riser faces and the gardens' three contour walls each take a bank;
  // the exclusive strips (Verdant2Gardens) grow over the same lines.
  const downhill = spineNormal();
  const stairAnchors: DrapeAnchor[] = [];
  for (let step = 0; step < 8; step++) {
    const lipU = stepFootU(step) - 1.4;
    for (let k = -2; k <= 2; k++) {
      const v = stairChannelCenter(lipU) + k * 3.4;
      const { x, z } = worldOf(lipU, v);
      const y = seabedHeight(x, z) + 1.1;
      stairAnchors.push({ pos: [x, y, z], normal: downhill });
    }
  }
  const drapePalette = {
    base: 0x5c9c62,
    tip: 0x9ec96f,
    shade: 0x51446a,
    accent: 0x6db273,
  } as const;
  // Round 2: strands longer and one more per holdfast — from on the
  // stair the round-1 bank was too fine to draw the riser lines.
  const stairBank = duskLift(buildWallDrapeBank({
    seed: SEED ^ 0xf401,
    palette: drapePalette,
    anchors: stairAnchors,
    strandsPerAnchor: 5,
    length: 2.0,
    swayAmp: 0.08,
  }), DUSK_GREEN, 0.4);
  builds.push(stairBank);
  updaters.push((t) => stairBank.update(t));

  const gardenAnchors: DrapeAnchor[] = [];
  for (const edge of [10, 44, 82]) {
    for (let k = 0; k < 26; k++) {
      const v = -74 + k * 5.6;
      const u = contourU(edge, v);
      if (u === null) {
        continue;
      }
      if (cisternWeight(u, v) > 0.3 || vaultWeight(u, v) > 0.35 || mistfallDrop(u - 3, v) > 0.05) {
        continue;
      }
      const { x, z } = worldOf(u + 1.2, v);
      const y = seabedHeight(x, z) + 1.6;
      gardenAnchors.push({ pos: [x, y, z], normal: downhill });
    }
  }
  const gardenBank = duskLift(buildWallDrapeBank({
    seed: SEED ^ 0xf402,
    palette: drapePalette,
    anchors: gardenAnchors,
    strandsPerAnchor: 5,
    length: 1.9,
    swayAmp: 0.09,
  }), DUSK_GREEN, 0.4);
  builds.push(gardenBank);
  updaters.push((t) => gardenBank.update(t));

  // ─── R12.3 headroom spend (fresh seeds, appended after every existing
  // draw — the reroll fence) ───────────────────────────────────────────────
  // Tall blade stands lining the road edges: the pass road (threshold +
  // stair) and the descent from the stair foot to the Mistfall lip. The
  // shoulders of the swim line get waist-high grass the diver passes
  // THROUGH, not specks passed over.
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf111,
      palette: { base: 0x7cca8c, tip: 0xaeda82, shade: 0x5a8a6c },
      area: spineRoad(650, 848, 36),
      gate: spokeGate((u, v) => {
        const off = Math.abs(v - stairChannelCenter(u));
        // The shoulder band: off the swim line, inside the road's edge.
        return off > 4 && off < 15 ? 0.9 : 0;
      }),
      ground: seabedHeight,
      count: 360,
      profile: "blade",
      size: [0.5, 0.95],
      swayAmp: 0.06,
      sunGlow: true,
      looseShare: 0.5,
    }), DUSK_GREEN, 0.5),
  );
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf112,
      palette: { base: 0x74ce94, tip: 0xaeda82, shade: 0x529068 },
      area: spineRoad(850, 995, 32),
      gate: spokeGate((u, v) => {
        if (onFallFace(u, v) || cisternWeight(u, v) > 0.3 || vaultWeight(u, v) > 0.35) {
          return 0;
        }
        const off = Math.abs(v - stairChannelCenter(u));
        return off > 4 && off < 14 ? 0.85 : 0;
      }),
      ground: seabedHeight,
      count: 300,
      profile: "blade",
      size: [0.5, 0.9],
      swayAmp: 0.06,
      sunGlow: true,
      looseShare: 0.5,
    }), DUSK_GREEN, 0.5),
  );
  // The Fern Vault's deeper understory: a second frond layer gathered
  // toward the mouth, taller than the floor carpet — the half-light
  // gains a knee-high storey between the floor rosettes and the giants.
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf113,
      palette: { base: 0x68ac7c, tip: 0x92d49a, shade: 0x51446a },
      area: disc(FERN_VAULT.u, FERN_VAULT.v, 26),
      gate: spokeGate((u, v) => smoothstep01((vaultWeight(u, v) - 0.14) / 0.3) * 0.8),
      ground: seabedHeight,
      count: 400,
      profile: "frond",
      size: [0.34, 0.62],
    }), DUSK_GREEN, 0.45),
  );
  // Split-stone runs (the kit's R12 "split" shape + grade): formed,
  // fracture-faced foreground rock for the two most-walked floors of a
  // country that remembers being built — the garden terrace feet and the
  // stair treads.
  builds.push(
    buildGroundLitter({
      seed: SEED ^ 0xf20b,
      palette: { base: 0x8a9478, shade: 0x5c5470 },
      area: disc(905, -10, 92),
      gate: spokeGate((u, v) => gardensGate(u, v) * (0.25 + 0.75 * gardenTerraces(u, v).riser)),
      ground: seabedHeight,
      count: 140,
      shapeSet: "split",
      size: [0.12, 0.3],
      grade: 0.6,
    }),
  );
  builds.push(
    buildGroundLitter({
      seed: SEED ^ 0xf20c,
      palette: { base: 0x8a9478, shade: 0x5c5470 },
      area: spineRoad(742, 850, 30),
      gate: spokeGate((u, v) => {
        const off = Math.abs(v - stairChannelCenter(u));
        return off > 3 && off < 13 ? 0.9 : 0;
      }),
      ground: seabedHeight,
      count: 100,
      shapeSet: "split",
      size: [0.12, 0.28],
      grade: 0.6,
    }),
  );
  // The basin close pose's own bed (re-pass round 3): the flank bed's
  // 55 m disc leaves any given near field to the clump lottery — the
  // fill's frame-07/frame-10 lesson says place a tight disc ON the look
  // ray. 200 fronds under `close-basin-silt`'s camera wedge.
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf114,
      palette: { base: 0x699a7c, tip: 0x8cbb96, shade: 0x5e5480 },
      area: disc(1057, -68, 10),
      gate: spokeGate(() => 0.9),
      ground: seabedHeight,
      count: 200,
      profile: "frond",
      size: [0.24, 0.46],
    }), DUSK_SILT, 0.45),
  );
  // Round 4: the basin bed's method applied to the three remaining
  // close poses — a tight disc on each look ray. The threshold pose's
  // bed abandons the milky key entirely (r3: milky blades camouflage
  // against the milky shelf AND grey out under the teal column); it
  // wears the region's own saturated celadon-green with a gentle dusk
  // floor so the road's near field finally reads at swim height.
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf115,
      palette: { base: 0x86cc96, tip: 0xb6e2a4, shade: 0x649c78 },
      area: disc(705, 5, 9),
      gate: spokeGate(() => 0.9),
      ground: seabedHeight,
      count: 180,
      profile: "blade",
      size: [0.3, 0.62],
      swayAmp: 0.05,
      sunGlow: true,
    }), DUSK_GREEN, 0.25),
  );
  // The stair tread bed: the floor between the tall centre blades.
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf116,
      palette: { base: 0x70c688, tip: 0xaeda82, shade: 0x568a66 },
      area: disc(801, -4, 8),
      gate: spokeGate(() => 0.9),
      ground: seabedHeight,
      count: 150,
      profile: "blade",
      size: [0.28, 0.62],
      swayAmp: 0.05,
      sunGlow: true,
    }), DUSK_GREEN, 0.5),
  );
  // The garden tread bed: rosettes under the camera's bare near strip.
  // Round 5: the r4 bed read as sparse teal specks — the celadon key
  // cooled to blue-grey under the dusk lift and 0.26–0.5 rosettes stay
  // sub-knee at 3 m. Warmer green key, 200 fronds, sized to be SEEN.
  builds.push(
    duskLift(buildCarpetField({
      seed: SEED ^ 0xf117,
      palette: { base: 0x7cc08c, tip: 0xa8d894, shade: 0x5c9070 },
      area: disc(902, -38, 9),
      gate: spokeGate(() => 0.9),
      ground: seabedHeight,
      count: 200,
      profile: "frond",
      size: [0.3, 0.58],
      swayAmp: 0.06,
      sunGlow: true,
    }), DUSK_GREEN, 0.5),
  );

  let draws = 0;
  let triangles = 0;
  const groups: Group[] = [];
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
      for (const updater of updaters) {
        updater(timeSec);
      }
    },
  };
}

/**
 * The downhill normal of the terrace faces, world XZ — every riser face
 * in this country looks back up the spine toward the arriving diver.
 */
function spineNormal(): readonly [number, number, number] {
  const a = worldOf(0, 0);
  const b = worldOf(1, 0);
  return [b.x - a.x, 0, b.z - a.z] as const;
}

/**
 * The worked-stone shard set — the exclusive shapes (MASTER R8): a
 * lintel length, a step corner, a bowl-rim arc. Small carved fragments
 * for ground the country built and forgot.
 */
function workedShardShapes(): BufferGeometry[] {
  const lintel = new BoxGeometry(1.5, 0.26, 0.34).toNonIndexed();
  lintel.rotateY(0.12);

  const stepA = new BoxGeometry(0.9, 0.24, 0.5).toNonIndexed();
  const stepB = new BoxGeometry(0.5, 0.5, 0.5).toNonIndexed();
  stepB.translate(-0.28, 0.2, 0);
  const corner = mergeGeometries([stepA, stepB], false);
  stepA.dispose();
  stepB.dispose();
  if (!corner) {
    throw new Error("verdant2 worked-shard corner could not be merged");
  }

  const rim = new TorusGeometry(0.55, 0.11, 5, 7, 1.3).toNonIndexed();
  rim.rotateX(-Math.PI / 2);
  rim.translate(0, 0.08, 0);

  return [lintel, corner, rim];
}
