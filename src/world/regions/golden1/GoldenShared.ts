import { Color, Mesh, type BufferGeometry, type Material, type MeshToonMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";

/**
 * THE HOURGLASS SEA — shared idiom pieces for the builders. Nothing here
 * draws from a random stream or touches the scene; these are the region's
 * palette and the mechanical moves every module repeats.
 *
 * ## The palette, and the value key it keeps
 *
 * A golden dune ocean under honey-warm water: warm golds and creams,
 * violet shadows, glass-pale greens in the fused reach, gold-green life
 * in the hollows — and never black. The value key is held the pilots'
 * way: the darkest thing anywhere is a colour (the Hourglass deep is a
 * warm violet whose red stays above its green), distance goes milky-warm
 * through the mood tables rather than dark, and the brightest painted
 * values live on sunlit dune crests, terrace rims and the sandfalls —
 * a desert lives on its value structure and its violet shadows.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** Sun-gold sand at its brightest — the crest of the value range. */
export const SAND_BRIGHT = new Color(0xf3dfa8);
/** The resting dune gold. */
export const SAND_GOLD = new Color(0xd9b878);
/** Slip-face and hollow shadow: violet, red above green, never black. */
export const SHADOW_VIOLET = new Color(0x6e5476);
/** The Hourglass deep's own violet — the darkest colour in the region. */
export const DEEP_VIOLET = new Color(0x584468);
/** Fused glass: pale sea-green reading as translucency in toon values. */
export const GLASS_PALE = new Color(0xcfe8d8);
/** Oasis life: gold-green, the tender counterpoint. */
export const OASIS_GREEN = new Color(0x9db85e);
/** The sandfalls' cream — bright sand, not glow. */
export const FALL_CREAM = new Color(0.95, 0.89, 0.72);
/** The warm stone the monoliths are cut from. */
export const MONOLITH_STONE = 0x7a6a70;

/**
 * The emissive-by-vertex-colour patch (the canyon polyps' trick, the
 * pilots' inheritance): the glow rides the baked paint instead of lying
 * flat over the whole body, so only the painted highlight glows.
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
    throw new Error(`hourglass ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
