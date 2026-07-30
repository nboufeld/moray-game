import {
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  Matrix4,
  PlaneGeometry,
  type BufferGeometry,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random } from "../../../util/Random";
import type { GateFn, GroundFn, KitArea, KitBuild, KitPalette } from "./KitTypes";
import {
  RATIO_ONE,
  angleTo,
  createKitSunViewUniform,
  finishBuild,
  injectKitLeafGlow,
  instantiatePlacements,
  mixRatio,
  scatterPoints,
  shadeRatio,
  trackKitSunView,
  type KitPlacement,
} from "./KitGroundShared";

/**
 * `carpetField` — KIT-SPEC §2.1, re-authored under MASTER R12 (the
 * "half-cut grass" verdict). The T1 answer for every region: one instanced
 * draw of ground flora, palette-recoloured, gated by the region's own
 * density function. Four profiles now, two ranges:
 *
 * - **near profiles** (the R12 craft, the bowl meadow's authorship ported):
 *   `"blade"` — a clump of three S-bent lanceolate blades, cupped
 *   cross-sections, tip taper, per-blade lean/bow/twist variety, 48 tris;
 *   `"frond"` — a drooping fern-like rosette of five cupped straps bowed
 *   past horizontal, 60 tris. Both may carry the sun-through-leaf glow
 *   (`sunGlow`), the meadow's own light note.
 * - **far profiles** (unchanged, byte-identical to the first kit close):
 *   `"card"` 4-tri bent quad (default), `"tuft"` 12-tri crossed blades.
 *
 * Budget note (asserted by tests/kitGround.test.ts): **1 draw per call**;
 * 4 tris per "card", 12 per "tuft", 48 per "blade" clump, 60 per "frond"
 * — 3,000 cards ≈ 12k tris; 800 blade clumps ≈ 38k. Sway, when asked
 * for, is a vertex-shader lean off closed-form simulated time
 * (capture-safe; zero cost when `swayAmp` is 0).
 *
 * Paint (law 3): the instance colour owns the hue at the blade TIP — the
 * brightest point — and the vertex colours only darken below it (the GLB
 * ceiling rule): tip at 1, mid at base/tip, root at shade/tip. Every
 * profile is a true integrated bow with a twist, so the toon ramp rolls a
 * band across it instead of catching it in one flat value (the W-N2 cup
 * lesson); the near profiles add the real cupped cross-section the 4-tri
 * budget could not carry.
 */

export type CarpetProfile = "card" | "tuft" | "blade" | "frond";

export interface CarpetFieldOptions {
  readonly seed: number;
  readonly palette: KitPalette;
  readonly area: KitArea;
  readonly gate: GateFn;
  readonly ground: GroundFn;
  readonly count: number;
  /**
   * "card": 4-tri bent quad (default). "tuft": 12-tri crossed blades.
   * "blade": 48-tri S-bend blade clump. "frond": 60-tri drooping rosette.
   * Card/tuft are the far-field tier; blade/frond are the swimming-
   * distance tier (MASTER R12).
   */
  readonly profile?: CarpetProfile;
  /** Blade height envelope in metres, [min, max). */
  readonly size?: readonly [number, number];
  /** The comb: instances yaw toward `yaw` and lean with it by `strength`. */
  readonly rake?: { readonly yaw: number; readonly strength: number };
  /** Metres of tip sweep at full bend; 0 (default) builds fully static. */
  readonly swayAmp?: number;
  /**
   * Share of instances scattered loose between the clump hearts (F-R2:
   * sweep-critical bands need SOME instance in any view cone). Default
   * 0.3 — the value every existing consumer already got.
   */
  readonly looseShare?: number;
  /**
   * The bowl meadow's sun-through-leaf translucency (SeaGrass W-L9),
   * for the near profiles: a cool view-facing glow plus a warm backlit
   * tip. Off by default; far-field carpets should not pay for it.
   */
  readonly sunGlow?: boolean;
}

export interface CarpetFieldBuild extends KitBuild {
  /** Advances the sway to a simulated second count. No-op when static. */
  update(timeSec: number): void;
}

/** Default height envelopes: ankle carpet cards, knee-high tufts, the
 *  near profiles at knee-to-thigh where the owner's eye judges them. */
const CARD_SIZE: readonly [number, number] = [0.14, 0.34];
const TUFT_SIZE: readonly [number, number] = [0.2, 0.46];
const BLADE_SIZE: readonly [number, number] = [0.32, 0.68];
const FROND_SIZE: readonly [number, number] = [0.26, 0.5];

function defaultSize(profile: CarpetProfile): readonly [number, number] {
  switch (profile) {
    case "card":
      return CARD_SIZE;
    case "tuft":
      return TUFT_SIZE;
    case "blade":
      return BLADE_SIZE;
    case "frond":
      return FROND_SIZE;
    default: {
      const exhaustive: never = profile;
      throw new Error(`carpetField: unknown profile ${String(exhaustive)}`);
    }
  }
}

/** Fallback root shade when a palette brings no `shade`: a grey-violet dusk. */
const DEFAULT_ROOT: readonly [number, number, number] = [0.58, 0.55, 0.62];

export function buildCarpetField(options: CarpetFieldOptions): CarpetFieldBuild {
  const random = new Random(options.seed);
  const profile = options.profile ?? "card";
  const size = options.size ?? defaultSize(profile);
  const swayAmp = options.swayAmp ?? 0;
  const sunGlow = options.sunGlow === true;

  // The hue owner is the tip; everything below it is a darkening multiplier.
  const topHex = options.palette.tip ?? options.palette.base;
  const midRatio = shadeRatio(topHex, options.palette.base);
  const rootRatio =
    options.palette.shade !== undefined
      ? shadeRatio(topHex, options.palette.shade)
      : ([
          midRatio[0] * DEFAULT_ROOT[0],
          midRatio[1] * DEFAULT_ROOT[1],
          midRatio[2] * DEFAULT_ROOT[2],
        ] as const);

  const geometry = profileGeometry(profile, options.seed, midRatio, rootRatio);

  const sway = { value: 0 };
  const sunView = createKitSunViewUniform();
  const material = createToonMaterial({ side: DoubleSide, vertexColors: true });
  if (swayAmp > 0 || sunGlow) {
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      if (swayAmp > 0) {
        shader.uniforms.uKitSway = sway;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
             uniform float uKitSway;`,
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
             // Each blade leans on its own phase, taken from where it stands
             // (the meadow's trick — one uniform for the whole carpet).
             float kitPhase = instanceMatrix[3][0] * 0.61 + instanceMatrix[3][2] * 0.43;
             float kitTip = clamp(transformed.y, 0.0, 1.0);
             float kitBend = sin(uKitSway * 1.25 + kitPhase) * 0.5
                           + sin(uKitSway * 0.43 + kitPhase * 1.7) * 0.5;
             transformed.x += kitBend * ${swayAmp.toFixed(3)} * kitTip * kitTip;
             transformed.z += kitBend * ${(swayAmp * 0.55).toFixed(3)} * kitTip * kitTip;`,
          );
      }
      if (sunGlow) {
        // The paint ramp climbs root → tip, so the green ratio doubles as
        // the "how far up the leaf" weight (the Seaweed fronds' trick).
        injectKitLeafGlow(
          shader,
          sunView,
          "vec3(0.12, 0.22, 0.17)",
          "vec3(0.32, 0.26, 0.10)",
          "clamp(vColor.g * 1.6 - 0.6, 0.0, 1.0)",
        );
      }
    };
  }

  const spots = scatterPoints({
    random,
    area: options.area,
    gate: options.gate,
    count: options.count,
    looseShare: options.looseShare ?? 0.3,
    perClump: 26,
  });

  // The near profiles read at arm's length, where a ±8% wash is a lawn:
  // they take a wider value spread (the meadow's 0.75–1.15 idiom, capped
  // just over 1 so the tip hue stays the ceiling). The far profiles keep
  // the spec's ±8% exactly — their consumers are byte-identical.
  const nearProfile = profile === "blade" || profile === "frond";
  const jitterLo = nearProfile ? 0.78 : 0.92;
  const jitterHi = nearProfile ? 1.1 : 1.08;

  const color = new Color();
  const parts: KitPlacement[] = [];
  for (const spot of spots) {
    const freeYaw = random.range(0, Math.PI * 2);
    const tiltX = random.signed(0.1);
    const tiltZ = random.signed(0.1);
    const height = random.range(size[0], size[1]);
    const width = height * random.range(0.8, 1.25);
    const jitter = random.range(jitterLo, jitterHi); // the spec's value jitter

    let yaw = freeYaw;
    let lean = 0;
    if (options.rake) {
      // The comb: the blade's bow points along local +z, so combing is a
      // yaw pull toward the comb direction plus a little extra forward
      // lean — capped low, because a hard uniform lean puts every blade's
      // face in the same toon band and the carpet reads flat (a-r2/r3).
      yaw = freeYaw + angleTo(freeYaw, options.rake.yaw) * options.rake.strength;
      lean = 0.3 * options.rake.strength;
    }

    parts.push({
      x: spot.x,
      y: options.ground(spot.x, spot.z) - 0.02,
      z: spot.z,
      rotation: [tiltX + lean, yaw, tiltZ],
      scale: [width, height, width],
      color: color.setHex(topHex).multiplyScalar(jitter).clone(),
    });
  }

  const mesh = instantiatePlacements(geometry, material, parts, "kit-carpet-field");
  if (sunGlow) {
    trackKitSunView(mesh, sunView);
  }
  const group = new Group();
  group.name = "kit-carpet-field";
  group.add(mesh);

  const build = finishBuild(group, [geometry, material]);
  return {
    ...build,
    update(timeSec: number): void {
      sway.value = timeSec;
    },
  };
}

function profileGeometry(
  profile: CarpetProfile,
  seed: number,
  midRatio: readonly [number, number, number],
  rootRatio: readonly [number, number, number],
): BufferGeometry {
  switch (profile) {
    case "card":
      return cardGeometry(midRatio, rootRatio);
    case "tuft":
      return tuftGeometry(midRatio, rootRatio);
    case "blade":
      // The clump's own sub-stream: a count/gate retune consumes the main
      // stream differently, but the clump is welded once per call.
      return bladeClumpGeometry(new Random(seed ^ 0x1eaf_b1ad), midRatio, rootRatio);
    case "frond":
      return frondGeometry(new Random(seed ^ 0x1eaf_f209), midRatio, rootRatio);
    default: {
      const exhaustive: never = profile;
      throw new Error(`carpetField: unknown profile ${String(exhaustive)}`);
    }
  }
}

/**
 * One blade at unit height: an integrated bow (the SeaGrass arc at carpet
 * scale) with a taper and a light twist. Two length segments — the fewest
 * that let the ramp roll a band across the bend — and 4 triangles.
 */
function bladeGeometry(
  bow: number,
  twistBy: number,
  midRatio: readonly [number, number, number],
  rootRatio: readonly [number, number, number],
): BufferGeometry {
  const segments = 2;
  const width = 0.5;
  const geometry = new PlaneGeometry(width, 1, 1, segments);
  const position = geometry.attributes.position as BufferAttribute;

  // Integrate the arc once per row so height trades smoothly into reach.
  const rows = segments + 1;
  const arcY = new Float32Array(rows);
  const arcZ = new Float32Array(rows);
  const step = 1 / segments;
  let y = 0;
  let z = 0;
  for (let row = 0; row < rows; row++) {
    arcY[row] = y;
    arcZ[row] = z;
    const angle = bow * Math.pow((row + 0.5) / segments, 1.6);
    y += Math.cos(angle) * step;
    z += Math.sin(angle) * step;
  }

  const colors = new Float32Array(position.count * 3);
  const half = width / 2;
  for (let i = 0; i < position.count; i++) {
    const t = position.getY(i) + 0.5; // PlaneGeometry is centred; t in [0,1]
    const row = Math.round(t * segments);
    const column = position.getX(i) / half;
    const taper = 1 - t * 0.55;
    const twist = twistBy * t;
    const across = column * half * taper;
    position.setXYZ(
      i,
      across * Math.cos(twist),
      arcY[row] ?? 0,
      (arcZ[row] ?? 0) + across * Math.sin(twist),
    );

    // Root shade climbing through the base hue to the instance tip at 1.
    const ratio =
      t < 0.6 ? mixRatio(rootRatio, midRatio, t / 0.6) : mixRatio(midRatio, RATIO_ONE, (t - 0.6) / 0.4);
    colors[i * 3] = ratio[0];
    colors[i * 3 + 1] = ratio[1];
    colors[i * 3 + 2] = ratio[2];
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

function cardGeometry(
  midRatio: readonly [number, number, number],
  rootRatio: readonly [number, number, number],
): BufferGeometry {
  return bladeGeometry(0.85, 0.4, midRatio, rootRatio);
}

/**
 * The tuft: three blades crossed at 60°, each with its own bow and a small
 * outward tilt, so the clump reads from every angle. 12 triangles.
 */
function tuftGeometry(
  midRatio: readonly [number, number, number],
  rootRatio: readonly [number, number, number],
): BufferGeometry {
  const blades: BufferGeometry[] = [];
  const bows = [0.65, 0.95, 0.8] as const;
  for (let i = 0; i < 3; i++) {
    const blade = bladeGeometry(bows[i]!, 0.45, midRatio, rootRatio);
    blade.rotateX(0.12 + i * 0.05);
    blade.rotateY((i / 3) * Math.PI * 2 + i * 0.35);
    blades.push(blade);
  }
  const merged = mergeGeometries(blades, false);
  for (const blade of blades) {
    blade.dispose();
  }
  if (!merged) {
    throw new Error("carpetField: tuft blades could not be merged");
  }
  return merged;
}

// ─── The near profiles (MASTER R12: the bowl meadow's craft, ported) ─────────

/**
 * Half-width along a leaf: widest a quarter up, easing to a soft point —
 * the SeaGrass lanceolate profile. A linear taper is a spike; a leaf has
 * shoulders.
 */
function lanceolate(t: number): number {
  const s = Math.min(1, Math.max(0, t));
  return Math.max(0.05, Math.sin(Math.PI * Math.pow(0.16 + s * 0.84, 0.72)) ** 0.8);
}

interface LeafSpec {
  /** Leaf length in the clump's unit-height frame. */
  readonly length: number;
  /** Plane width before taper, same frame. */
  readonly width: number;
  /** Length segments; 3 columns always (the cup needs the centre). */
  readonly segments: number;
  /** Bend angle (radians) at parameter t ∈ [0,1] along the leaf. */
  readonly bendAt: (t: number) => number;
  /** Radians of twist about the spine at the tip. */
  readonly twist: number;
  /** Cup depth as a share of the local half-width. */
  readonly cup: number;
  /** Half-width profile along the leaf. */
  readonly taper: (t: number) => number;
  /** Per-leaf value step (≤ 1 — the ceiling rule), for clump depth. */
  readonly tone: number;
}

/**
 * One authored leaf: the SeaGrass blade construction verbatim — the arc
 * integrated once per row so height trades smoothly into reach, the cup
 * riding the centre column in the row's own frame, the twist making sure
 * no leaf is ever caught edge-on down its whole length — with the kit's
 * ratio paint (root shade climbing through base to the instance tip hue).
 */
function leafGeometry(
  spec: LeafSpec,
  midRatio: readonly [number, number, number],
  rootRatio: readonly [number, number, number],
): BufferGeometry {
  const geometry = new PlaneGeometry(spec.width, spec.length, 2, spec.segments);
  const position = geometry.attributes.position as BufferAttribute;

  const rows = spec.segments + 1;
  const arcY = new Float32Array(rows);
  const arcZ = new Float32Array(rows);
  const bendAt = new Float32Array(rows);
  const step = spec.length / spec.segments;
  let y = 0;
  let z = 0;
  for (let row = 0; row < rows; row++) {
    arcY[row] = y;
    arcZ[row] = z;
    bendAt[row] = spec.bendAt(row / spec.segments);
    const angle = spec.bendAt((row + 0.5) / spec.segments);
    y += Math.cos(angle) * step;
    z += Math.sin(angle) * step;
  }

  const colors = new Float32Array(position.count * 3);
  const half = spec.width / 2;
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) + spec.length / 2) / spec.length;
    const row = Math.round(t * spec.segments);
    const column = position.getX(i) / half;
    const theta = bendAt[row] ?? 0;
    const twist = spec.twist * t;
    // The row's normal leans back as the leaf bows; the across axis turns
    // about the spine as it climbs (the SeaGrass frame).
    const normalY = -Math.sin(theta);
    const normalZ = Math.cos(theta);
    const across = column * half * spec.taper(t);
    const cup = (1 - Math.abs(column)) * half * spec.taper(t) * spec.cup;
    const offNormal = across * Math.sin(twist) + cup;
    position.setXYZ(
      i,
      across * Math.cos(twist),
      (arcY[row] ?? 0) + offNormal * normalY,
      (arcZ[row] ?? 0) + offNormal * normalZ,
    );

    const ratio =
      t < 0.6 ? mixRatio(rootRatio, midRatio, t / 0.6) : mixRatio(midRatio, RATIO_ONE, (t - 0.6) / 0.4);
    colors[i * 3] = ratio[0] * spec.tone;
    colors[i * 3 + 1] = ratio[1] * spec.tone;
    colors[i * 3 + 2] = ratio[2] * spec.tone;
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/** Seats a leaf: leans it outward, turns it, and slips its root off centre. */
function plantLeaf(leaf: BufferGeometry, yaw: number, lean: number, rootOut: number): void {
  const matrix = new Matrix4()
    .makeRotationY(yaw)
    .multiply(new Matrix4().makeRotationX(lean));
  leaf.applyMatrix4(matrix);
  leaf.translate(Math.sin(yaw) * rootOut, 0, Math.cos(yaw) * rootOut);
}

/**
 * The "blade" clump: three lanceolate blades from one root — a tall
 * S-bent leader (the SeaGrass tall variant's return bow: out, over, and
 * hooking back past vertical, a lifted living tip instead of a wilting
 * one) and two shorter siblings bowed simply and leaning out. 48
 * triangles; per-blade bow/twist/lean/tone drawn from the clump's own
 * sub-stream so no two seeds weld the same plant.
 */
function bladeClumpGeometry(
  random: Random,
  midRatio: readonly [number, number, number],
  rootRatio: readonly [number, number, number],
): BufferGeometry {
  const leaves: BufferGeometry[] = [];
  const baseYaw = random.range(0, Math.PI * 2);

  // The leader: full height, the S that separates "grew long" from "fell".
  const sBow = random.range(0.62, 0.88);
  leaves.push(
    leafGeometry(
      {
        length: 1,
        width: 0.13,
        segments: 4,
        bendAt: (t) => sBow * Math.sin(t * Math.PI * 1.35),
        twist: random.range(0.6, 0.95),
        cup: 0.45,
        taper: lanceolate,
        tone: 1,
      },
      midRatio,
      rootRatio,
    ),
  );
  plantLeaf(leaves[0]!, baseYaw, random.signed(0.08), random.range(0.01, 0.04));

  // Two siblings: shorter, simply bowed harder, leaning out of the clump.
  for (let i = 0; i < 2; i++) {
    const bow = random.range(0.95, 1.3);
    const leaf = leafGeometry(
      {
        length: random.range(0.6, 0.82),
        width: 0.16,
        segments: 4,
        bendAt: (t) => bow * Math.pow(t, 1.6),
        twist: random.range(0.4, 0.7),
        cup: 0.5,
        taper: lanceolate,
        tone: random.range(0.86, 0.96),
      },
      midRatio,
      rootRatio,
    );
    const yaw = baseYaw + ((i + 1) * Math.PI * 2) / 3 + random.signed(0.5);
    plantLeaf(leaf, yaw, random.range(0.12, 0.32), random.range(0.02, 0.06));
    leaves.push(leaf);
  }

  const merged = mergeGeometries(leaves, false);
  for (const leaf of leaves) {
    leaf.dispose();
  }
  if (!merged) {
    throw new Error("carpetField: blade clump could not be merged");
  }
  return merged;
}

/**
 * The "frond" rosette: five cupped straps arching out from one root and
 * drooping past horizontal (the Seaweed rosette's 1.9-radian hang, with
 * the cup the straps never had), tips tapering to soft points. 60
 * triangles; the drawing is the droop, so every strap gets its own arc.
 */
function frondGeometry(
  random: Random,
  midRatio: readonly [number, number, number],
  rootRatio: readonly [number, number, number],
): BufferGeometry {
  const leaves: BufferGeometry[] = [];
  const count = 5;
  const baseYaw = random.range(0, Math.PI * 2);
  for (let i = 0; i < count; i++) {
    // The last two straps are the rosette's young growth: shorter, more
    // upright, barely drooped — the age mix that stops five identical
    // arches reading as a plastic fern.
    const young = i >= 3;
    const droop = young ? random.range(0.85, 1.15) : random.range(1.55, 2.0);
    const leaf = leafGeometry(
      {
        length: young ? random.range(0.42, 0.58) : random.range(0.78, 1.05),
        width: 0.21,
        segments: 3,
        bendAt: (t) => droop * Math.pow(t, 1.4),
        twist: random.range(0.2, 0.45),
        cup: 0.6,
        taper: (t) => Math.max(0.08, 1 - t * 0.82),
        // The young growth sits a value step down — new leaves are the
        // shaded heart of the rosette, not its brightest spikes.
        tone: young ? random.range(0.78, 0.88) : random.range(0.85, 1),
      },
      midRatio,
      rootRatio,
    );
    const yaw = baseYaw + (i / count) * Math.PI * 2 + random.signed(0.4);
    plantLeaf(leaf, yaw, young ? random.range(0.05, 0.2) : random.range(0.18, 0.42), random.range(0.01, 0.04));
    leaves.push(leaf);
  }

  const merged = mergeGeometries(leaves, false);
  for (const leaf of leaves) {
    leaf.dispose();
  }
  if (!merged) {
    throw new Error("carpetField: frond straps could not be merged");
  }
  return merged;
}
