import { Color, Mesh, type BufferGeometry, type DataTexture, type Material } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { smoothNormals } from "../../../rendering/SmoothNormals";

/**
 * THE DAYSPRING — shared idiom pieces. Nothing here draws from a
 * random stream or touches the scene; this is the region's palette and
 * the mechanical moves the builders repeat.
 *
 * ## The palette, and the register it must hold
 *
 * The Pale Passage's whole province is "paper held to a lamp"; the
 * Bone Meadows were the paper bleached, the Lantern Combs were the
 * lamp side of the paper — and this region is where the paper ENDS:
 * the morning itself. One step brighter and warmer again, never a
 * different painting. The rules:
 *
 * - The whites are colours: a warm paper-white and a violet-cool
 *   white, never one grey (the province's founding rule, kept).
 * - Every shadow is a violet whose red stays above its green.
 * - The warmth family is MORNING GOLD — first-light gold, a breath
 *   rosier than the Combs' candle gold, never orange; it arrives with
 *   `dawn`, the region's story gradient.
 * - BLUSH — held to accents for two whole regions — is finally
 *   allowed to be a field, but only in the Blushfields and only as
 *   dawn-rose over paper: red above green, value high, never candy.
 * - The mere holds the pre-dawn register: pearl-seafoam stillness
 *   with the one painted reflection lane.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** The two whites: warm paper on the lit faces, violet-cool in shade. */
export const PAPER_WARM = new Color(0xf4ecd9);
export const PAPER_COOL = new Color(0xe3e4f0);
/** The violet every shadow is mixed from — red above green. */
export const SHADOW_VIOLET = new Color(0x6f5c88);

/** The morning's warmth: first-light gold, lit and deep. */
export const MORNING_GOLD = new Color(0xf2cf96);
export const MORNING_DEEP = new Color(0xdcae72);

/** Dawn-rose: the blush grown up — a field colour at last. */
export const DAWN_ROSE = new Color(0xecbfb8);

/** The mere's pearl-seafoam stillness. */
export const MERE_PEARL = new Color(0xdaeddf);

const SEED = SEEDS.regionPale3;

/**
 * The chalk skin: paper value, faint cool strata, a fine tooth — the
 * pale province's own map (the shared rock wash's lichen mottle is the
 * wrong story for chalk), reseeded for this region so the fonts wear
 * their own weather.
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
    throw new Error(`pale3 ${name} parts could not be merged`);
  }
  // MASTER R5's class, guarded at the door: a LIT mesh with no normal
  // attribute rasterises as a full-screen wash (the Combs' round-1
  // blackout — `smoothNormals` silently no-ops without normals).
  if (!merged.attributes.normal) {
    merged.computeVertexNormals();
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
