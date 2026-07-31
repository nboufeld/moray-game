import { Color, Mesh, type BufferGeometry, type Material } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";

/**
 * THE CANOPY DEEP — shared idiom pieces for the builders. Nothing here
 * draws from a random stream or touches the scene; these are the
 * region's palette and the one mechanical move (merged one-off meshes)
 * every module repeats.
 *
 * ## The palette, and the value key it keeps
 *
 * The province's arc ends here: the kelp sea's bright spring green →
 * the terraces' mistier emerald → this, the primeval register, green
 * going toward blue-dark. The gouache rules hold hardest in the darkest
 * room: never one green (three families per idiom, a value apart), the
 * darkest thing anywhere is a violet whose red stays above its green,
 * warmth lives where the cathedral shafts land, and distance goes
 * milky-bright through the mood tables rather than dark. Because the
 * water is the province's dimmest, every close-range family paints a
 * value step ABOVE where the terraces would put it (the verdant-1
 * re-pass lesson: under a dim sun, small flora drops to silhouette).
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** The deep-shade floor greens — the Shade Meadows' own register. */
export const SHADE_TONES = [0x4c8a5f, 0x5c9e68, 0x3f7a58] as const;
/** The hanging gardens' brighter spill — crown gardens, drape hems. */
export const GARDEN_TONES = [0x6cb474, 0x82c983, 0x58a068] as const;
/** The old crowns' canopy greens, seen mostly from below. */
export const CANOPY_TONES = [0x51946a, 0x66aa72, 0x437f5e] as const;
/** The golden-olive every lit tip leans toward — the province's one gold. */
export const TIP_GOLD = new Color(0xc9b45e);
/** The violet the deepest shadow is mixed from — a colour, never a black. */
export const SHADOW_VIOLET = new Color(0x544672);
/** The pale ancient stone of the mesa columns' lit faces. */
export const MESA_STONE = new Color(0x8fa189);

/** One slow drift for the whole country — the same current as upstream. */
export const DRIFT_X = 0.88;
export const DRIFT_Z = 0.47;

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
    throw new Error(`verdant3 ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
