import { Color, Mesh, type BufferGeometry, type DataTexture, type Material } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { smoothNormals } from "../../../rendering/SmoothNormals";

/**
 * THE LANTERN COMBS — shared idiom pieces. Nothing here draws from a
 * random stream or touches the scene; this is the region's palette and
 * the mechanical moves the builders repeat.
 *
 * ## The palette, and the register it must hold
 *
 * The Pale Passage's whole province is "paper held to a lamp", and this
 * region is the lamp side of the paper: a step BRIGHTER and WARMER than
 * the Bone Meadows' milk, never a different painting. The rules:
 *
 * - The whites are colours: a warm paper-white and a violet-cool white,
 *   never one grey (the province's founding rule, kept).
 * - Every shadow is a violet whose red stays above its green.
 * - The warmth family is LAMP GOLD — candle-through-paper, never
 *   orange; it arrives with `lumen`, the region's story gradient.
 * - The pools hold a pearl-seafoam register of their own — luminous
 *   pale green-white, the moonmilk.
 * - Blush stays an accent (buds, bush knots): the colour-return was
 *   depth 1's story; this chamber's story is light.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** The two whites: warm paper on the lit faces, violet-cool in shade. */
export const PAPER_WARM = new Color(0xf2e9d6);
export const PAPER_COOL = new Color(0xe1e2ef);
/** The violet every shadow is mixed from — red above green. */
export const SHADOW_VIOLET = new Color(0x6f5c88);

/** The lamp's warmth: candle-through-paper gold, lit and deep. */
export const LAMP_GOLD = new Color(0xeec98e);
export const LAMP_DEEP = new Color(0xd9a86a);

/** The moonmilk: the pools' pearl-seafoam light. */
export const MOON_PEARL = new Color(0xd8ecdc);

/** Blush, held to accents (bud knots, bush accents). */
export const BLUSH = new Color(0xf0b6c4);

const SEED = SEEDS.regionPale2;

/**
 * The chalk skin: paper value, faint cool strata, a fine tooth — the
 * Bone Meadows' finding, kept: the shared rock wash's lichen mottle is
 * the wrong story for chalk, so the combs carry their own map.
 */
let chalkMap: DataTexture | undefined;
export function chalkTexture(): DataTexture {
  chalkMap ??= buildColorTexture(64, (u, v) => {
    const wobble = (fbm(u, v, { seed: SEED ^ 0xc4a7, period: 4, octaves: 2 }) - 0.5) * 0.8;
    const strata = 0.5 + 0.5 * Math.sin((v * 5 + wobble) * Math.PI * 2);
    const tooth = fbm(u * 3, v * 3, { seed: SEED ^ 0xc4a8, period: 9, octaves: 3 });
    const shade = 0.88 + strata * 0.1 + tooth * 0.1;
    return [shade, shade * 0.99, shade * 0.94 + strata * 0.03];
  });
  return chalkMap;
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
    throw new Error(`pale2 ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
