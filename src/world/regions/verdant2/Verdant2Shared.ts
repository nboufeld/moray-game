import {
  BufferAttribute,
  Color,
  Mesh,
  type BufferGeometry,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";

/**
 * THE EMERALD TERRACES — shared idiom pieces for the builders. Nothing
 * here draws from a random stream or touches the scene; these are the
 * region's palette and the two mechanical moves (merged meshes, the
 * hanging-sway shader) every module repeats.
 *
 * ## The palette, and the value key it keeps
 *
 * The water here is thicker and greener than the kelp sea's, so the
 * paint holds the gouache rules harder still: never one green (three
 * families per idiom, a value apart), the darkest thing anywhere is a
 * violet whose red stays above its green, warmth lives where the light
 * blades land (terrace crowns, gold tips, the Cistern's pale rim), and
 * distance goes milky-bright through the mood tables rather than dark.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** The hanging curtains' deep moss greens — the shadow side of the region. */
export const CURTAIN_TONES = [0x477d4d, 0x549256, 0x3a6c46] as const;
/** The bright viridian of terrace faces the light reaches. */
export const VIRIDIAN_TONES = [0x5da76c, 0x6fbd75, 0x4c945e] as const;
/** The Fern Vault's fronds: cooler, celadon-leaning half-light greens. */
export const FERN_TONES = [0x5b9a63, 0x6fae6e, 0x4a8758] as const;
/** The golden-olive every lit tip leans toward. */
export const TIP_GOLD = new Color(0xcdb662);
/** The violet the deepest shadow is mixed from — a colour, never a black. */
export const SHADOW_VIOLET = new Color(0x51446a);
/** The pale worked jade of the Cistern's stone and the balcony slabs. */
export const JADE_STONE = new Color(0xa9bda0);

/** One slow drift for the whole country — the same current as upstream. */
export const DRIFT_X = 0.88;
export const DRIFT_Z = 0.47;

export interface SwayUniforms {
  readonly sway: { value: number };
  readonly wind: { value: number };
}

/**
 * The hanging sway: the same two-float vertex injection as the kelp
 * sea's, reading `aPhase`/`aReach`. For curtains `aReach` is authored
 * largest at the *bottom* of the ribbon — anchored at the lip, swinging
 * at the hem — which is what tells the eye these gardens hang.
 */
export function injectHangingSway(
  shader: WebGLProgramParametersWithUniforms,
  uniforms: SwayUniforms,
): void {
  shader.uniforms.uSway = uniforms.sway;
  shader.uniforms.uWind = uniforms.wind;
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
       uniform float uSway;
       uniform float uWind;
       attribute float aPhase;
       attribute float aReach;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       float bend = sin(uSway * 0.38 + aPhase) * 0.6 + sin(uSway * 0.17 + aPhase * 1.9) * 0.4;
       transformed.x += bend * aReach * uWind * ${DRIFT_X.toFixed(3)};
       transformed.z += bend * aReach * uWind * ${DRIFT_Z.toFixed(3)};`,
    );
}

/**
 * Writes the two floats the sway shader reads. `reachAt` maps a vertex's
 * y to the fraction of the plant that moves with it.
 */
export function bakeSwayAttributes(
  geometry: BufferGeometry,
  phase: number,
  amplitude: number,
  reachAt: (y: number) => number,
): void {
  const position = geometry.attributes.position!;
  const phases = new Float32Array(position.count);
  const reaches = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, reachAt(position.getY(i))));
    phases[i] = phase;
    reaches[i] = t * t * amplitude;
  }
  geometry.setAttribute("aPhase", new BufferAttribute(phases, 1));
  geometry.setAttribute("aReach", new BufferAttribute(reaches, 1));
}

/**
 * Merges one-off parts into a single mesh: welded normals, an honest
 * bounding sphere, no shadows in either direction (the smallwork rule).
 */
export function mergedMesh(parts: BufferGeometry[], material: Material, name: string): Mesh {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error(`verdant2 ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
