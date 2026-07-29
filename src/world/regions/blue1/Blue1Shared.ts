import { Color, Mesh, type BufferGeometry, type Material } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";

/**
 * THE DROP PLAINS — shared idiom pieces for the builders. Nothing here
 * draws from a random stream or touches the scene; this is the region's
 * palette and the one mechanical move (merged one-off meshes) every
 * module repeats.
 *
 * ## The palette, and the value key it keeps
 *
 * The region's register is the whole of blue: clear and bright over the
 * steppe, deep violet-blue at the World's Edge. The gouache rules bind
 * hardest at the bottom of that register — the darkest thing anywhere is
 * a colour (the Under-Blue's shadow is a violet whose red stays above its
 * green), distance goes milky-bright through the mood tables rather than
 * dark, and the warmth is rationed: it lives at the slope's mouth (the
 * last reef colour falling away behind) and in the grass tips the high
 * sun still reaches.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** The steppe grass families: blue-green, spring to seafoam. */
export const STEPPE_TONES = [0x59a68e, 0x6cb8a0, 0x4b9382] as const;
/** Pale wind-silver the bending tips lean toward. */
export const TIP_SILVER = new Color(0xbcd8c8);
/** The megaliths' stone: cool blue-grey, pale where the light lands. */
export const STONE_BLUE = 0x5e6f88;
export const STONE_PALE = 0x8593a8;
/** The violet the deepest shadow is mixed from — a colour, never a black. */
export const SHADOW_VIOLET = new Color(0x483f66);

/**
 * One wind for the whole steppe — that is what a prairie is. World-space
 * direction, roughly cross-spoke so the swell crests and the bend agree.
 */
export const WIND_X = -0.76;
export const WIND_Z = -0.65;

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
    throw new Error(`blue1 ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
