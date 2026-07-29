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
 * The Great Kelp Sea — shared idiom pieces for the builders. Nothing here
 * draws from a random stream or touches the scene; these are the region's
 * palette and the two mechanical moves (merged meshes, the sway shader)
 * every module repeats.
 *
 * ## The palette, and the value key it keeps
 *
 * The region's water is a deep living green, so its paint has to hold the
 * gouache rules harder than the bowl does: the darkest thing anywhere is a
 * colour (the maze's shadow is a violet whose red stays above its green),
 * distance goes milky-bright through the mood tables rather than dark, and
 * the warmth lives in the tips and the Sunwell, where the light is.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** The forest's leaf greens — a step deeper and calmer than the bowl kelp's. */
export const FOREST_TONES = [0x5f9450, 0x72a75c, 0x4c8146] as const;
/** The meadows' young kelp and grass: brighter, spring-keyed. */
export const MEADOW_TONES = [0x74b464, 0x8cc773, 0x5da45c] as const;
/** The maze's half-light growth: deep olive and wine, red held above green. */
export const MAZE_TONES = [0x4a6b42, 0x635648, 0x54704e] as const;
/** The golden-olive every tip leans toward; Sunwell crowns take the most. */
export const TIP_GOLD = new Color(0xc9b45e);
/** The violet the deepest shadow is mixed from — a colour, never a black. */
export const SHADOW_VIOLET = new Color(0x4c4260);

/** One drift direction for the whole sea — that is what a current is. */
export const DRIFT_X = 0.88;
export const DRIFT_Z = 0.47;

export interface SwayUniforms {
  readonly sway: { value: number };
  readonly wind: { value: number };
}

/**
 * The forest sway: the bowl kelp's two-line vertex injection, reading the
 * same `aPhase`/`aReach` floats. `aReach` is authored in metres because the
 * merged geometry is already in world space.
 */
export function injectVerdantSway(
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
       float bend = sin(uSway * 0.44 + aPhase) * 0.62 + sin(uSway * 0.19 + aPhase * 1.7) * 0.38;
       transformed.x += bend * aReach * uWind * ${DRIFT_X.toFixed(3)};
       transformed.z += bend * aReach * uWind * ${DRIFT_Z.toFixed(3)};`,
    );
}

/**
 * Writes the two floats the sway shader reads. `reachAt` maps a vertex's
 * height to the fraction of the plant that moves with it; squared so the
 * holdfast is still and the crown carries the sweep.
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
    throw new Error(`verdant ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
