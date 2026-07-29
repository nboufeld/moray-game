import { Color, Mesh, type BufferGeometry, type Material, type MeshToonMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";

/**
 * THE SMOULDER FIELDS — shared idiom pieces for the builders. Nothing here
 * draws from a random stream or touches the scene; these are the region's
 * palette and the mechanical moves every module repeats.
 *
 * ## The palette, and the value key it keeps
 *
 * Volcanic country under warm water: charcoal, warm greys, amber and
 * ember accents, violet shadows — and never black. The value key is held
 * the same way the pilot held it: the darkest thing anywhere is a colour
 * (charcoal here is a warm violet-grey whose red stays above its green),
 * distance goes milky-warm through the mood tables rather than dark, and
 * the bright painted values live in the embers, the vein glow and the
 * mineral pool rims — the light in this region comes from below as much
 * as above.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** Basalt greys: warm, red above green, violet held in the shade face. */
export const BASALT_TONES = [0x5c5258, 0x6b5f60, 0x504750] as const;
/** The ash flats' grey-violet, a step paler than the stone. */
export const ASH_TONES = [0x847a84, 0x92867e, 0x77707e] as const;
/** Mineral sinter: the pale rims the pools wear. */
export const SINTER_PALE = new Color(0xe9dcbe);
/** The amber the mineral stains toward. */
export const AMBER = new Color(0xd9964a);
/** The ember note — the hottest painted value in the region. */
export const EMBER = new Color(0xff7a38);
/** The violet the deepest shadow is mixed from — a colour, never a black. */
export const SHADOW_VIOLET = new Color(0x564660);

/**
 * The emissive-by-vertex-colour patch (the canyon polyps' trick, the Vent
 * Springs chimneys' inheritance): the glow rides the baked veins instead
 * of lying flat over the whole stack, so only the hot mineral glows and
 * the glow is the vein's own amber.
 */
export const VEIN_GLOW_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;

/** Patches a toon material so its emissive follows the baked vertex colour. */
export function applyVeinGlow(material: MeshToonMaterial, cacheKey: string): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      VEIN_GLOW_CHUNK,
    );
  };
  material.customProgramCacheKey = () => cacheKey;
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
    throw new Error(`smoulder ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
