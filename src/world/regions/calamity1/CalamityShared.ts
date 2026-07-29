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
 * The Sunken Calamity — shared idiom pieces for the builders. Nothing here
 * draws from a random stream or touches the scene; these are the region's
 * palette and the two mechanical moves (merged meshes, the sway shader)
 * every module repeats.
 *
 * ## The palette, and the value key it keeps
 *
 * The catastrophe drained the gold out of this water, so the paint's job
 * is harder than anywhere else in the game: devastation that still obeys
 * the gouache rules. The darkest thing anywhere is a colour (the Wound's
 * shadow is a violet whose red stays above its green), the ash goes
 * milky-pale with distance rather than black, and the world's last
 * saturated notes are spent like coin: the seep gardens' artery-red, the
 * Last Grove's green, the shrine's warm gleam.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** The Ghost Forest's bone tones — bleached, never white, never black. */
export const BONE_TONES = [0x8d887a, 0x9a9382, 0x7e7a6e] as const;
/** The young dead and the forest's far ranks: greyer, colder. */
export const ASH_TONES = [0x84837c, 0x8f8d84, 0x767672] as const;
/** The violet every deep shadow is mixed from — red above green, always. */
export const SHADOW_VIOLET = new Color(0x4c4458);
/** The faint cold lustre the dead stipes' tips kept — a drowned opal. */
export const TIP_ASH = new Color(0x9fa8a4);
/** The seep gardens' one hot note: arterial red, spent at the worm tips. */
export const ARTERY_RED = new Color(0xb43a4a);
/** The bacterial mats' bone-pale — a colour, not a white. */
export const MAT_PALE = new Color(0xdcd6c6);
/** The Last Grove's greens — the living note, greener than the pilot's. */
export const GROVE_TONES = [0x5f9c50, 0x74b25e, 0x4c8846] as const;
/** The shrine's warm gleam: shell, bone and old gold in the grey. */
export const SHRINE_GLEAM = new Color(0xd8bd8e);

/** One drift direction for the whole sea — what little current is left. */
export const DRIFT_X = 0.8;
export const DRIFT_Z = 0.6;

export interface SwayUniforms {
  readonly sway: { value: number };
  readonly wind: { value: number };
}

/**
 * The region's sway: the pilot's two-line vertex injection, reading the
 * same `aPhase`/`aReach` floats. In the Calamity it is reserved for what
 * still lives — the grove's kelp, the worms' crowns — the dead forest
 * stands still, and the stillness is the point.
 */
export function injectCalamitySway(
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
 * root is still and the crown carries the sweep.
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
    throw new Error(`calamity ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
