import {
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
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
  finishBuild,
  instantiatePlacements,
  mixRatio,
  scatterPoints,
  shadeRatio,
  type KitPlacement,
} from "./KitGroundShared";

/**
 * `carpetField` — KIT-SPEC §2.1. The T1 answer for every region: one
 * instanced draw of bent cards or crossed tufts, palette-recoloured, gated
 * by the region's own density function.
 *
 * Budget note (asserted by tests/kitGround.test.ts): **1 draw per call**;
 * 4 triangles per "card" instance, 12 per "tuft" — 3,000 cards ≈ 12k tris,
 * 3,000 tufts ≈ 36k. Sway, when asked for, is a vertex-shader lean off
 * closed-form simulated time (capture-safe; zero cost when `swayAmp` is 0).
 *
 * Paint (law 3): the instance colour owns the hue at the blade TIP — the
 * brightest point — and the vertex colours only darken below it (the GLB
 * ceiling rule): tip at 1, mid at base/tip, root at shade/tip. The card is
 * a true integrated bow with a small twist, so the toon ramp rolls a band
 * across it instead of catching it in one flat value (the W-N2 cup lesson,
 * carried by bow + twist at the 4-triangle budget).
 */

export interface CarpetFieldOptions {
  readonly seed: number;
  readonly palette: KitPalette;
  readonly area: KitArea;
  readonly gate: GateFn;
  readonly ground: GroundFn;
  readonly count: number;
  /** "card": 4-tri bent quad (default). "tuft": 12-tri crossed blades. */
  readonly profile?: "card" | "tuft";
  /** Blade height envelope in metres, [min, max). */
  readonly size?: readonly [number, number];
  /** The comb: instances yaw toward `yaw` and lean with it by `strength`. */
  readonly rake?: { readonly yaw: number; readonly strength: number };
  /** Metres of tip sweep at full bend; 0 (default) builds fully static. */
  readonly swayAmp?: number;
}

export interface CarpetFieldBuild extends KitBuild {
  /** Advances the sway to a simulated second count. No-op when static. */
  update(timeSec: number): void;
}

/** Default height envelopes: ankle carpet cards, knee-high tufts. */
const CARD_SIZE: readonly [number, number] = [0.14, 0.34];
const TUFT_SIZE: readonly [number, number] = [0.2, 0.46];

/** Fallback root shade when a palette brings no `shade`: a grey-violet dusk. */
const DEFAULT_ROOT: readonly [number, number, number] = [0.58, 0.55, 0.62];

export function buildCarpetField(options: CarpetFieldOptions): CarpetFieldBuild {
  const random = new Random(options.seed);
  const profile = options.profile ?? "card";
  const size = options.size ?? (profile === "card" ? CARD_SIZE : TUFT_SIZE);
  const swayAmp = options.swayAmp ?? 0;

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

  const geometry =
    profile === "card" ? cardGeometry(midRatio, rootRatio) : tuftGeometry(midRatio, rootRatio);

  const sway = { value: 0 };
  const material = createToonMaterial({ side: DoubleSide, vertexColors: true });
  if (swayAmp > 0) {
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
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
    };
  }

  const spots = scatterPoints({
    random,
    area: options.area,
    gate: options.gate,
    count: options.count,
    perClump: 26,
  });

  const color = new Color();
  const parts: KitPlacement[] = [];
  for (const spot of spots) {
    const freeYaw = random.range(0, Math.PI * 2);
    const tiltX = random.signed(0.1);
    const tiltZ = random.signed(0.1);
    const height = random.range(size[0], size[1]);
    const width = height * random.range(0.8, 1.25);
    const jitter = random.range(0.92, 1.08); // the spec's ±8% value jitter

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
