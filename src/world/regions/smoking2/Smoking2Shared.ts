import { Color, Mesh, type BufferGeometry, type Material, type MeshToonMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { RESTS, spokeOf } from "./Smoking2Terrain";

/**
 * THE FORGE COMBS — shared idiom pieces for the builders. Nothing here
 * draws from a random stream or touches the scene; these are the region's
 * palette, its seed substream table and the mechanical moves every module
 * repeats.
 *
 * ## The palette, and the value key it keeps
 *
 * The province's vocabulary a register deeper: iron-dark basalt walls
 * (still a warm violet-grey — red above green, never black), gravel
 * floors a shade duskier than the Smoulder's ash, and the light coming
 * from BELOW — the Emberwash's seams, the Hearth's junction star — while
 * the pillow crowns wear the milk-bright mineral crust that keeps the
 * tops pale. The hottest painted values live in the seams; the palest in
 * the crusts; distance goes milky-warm through the mood tables.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** Comb basalt: iron-violet, red above green, a step darker than ash. */
export const COMB_TONES = [0x554a58, 0x64565c, 0x494050] as const;
/** The gravel floors' dusk grey-violet. */
export const GRAVEL_TONES = [0x776d7c, 0x847668, 0x6a6276] as const;
/** The pillow crowns' milk-bright mineral crust. */
export const CRUST_PALE = new Color(0xe7dcc2);
/** The amber the seams pool toward. */
export const AMBER = new Color(0xd9964a);
/** The ember note — the hottest painted value in the region. */
export const EMBER = new Color(0xff7a38);
/** Obsidian sheen: the Glass Shore's cold glint over warm dark ground. */
export const GLASS_SHEEN = new Color(0xb9aec6);
/** The violet the deepest shadow is mixed from — a colour, never a black. */
export const SHADOW_VIOLET = new Color(0x4e4058);

/**
 * The emissive-by-vertex-colour patch (the canyon polyps' trick, the
 * province's inheritance): the glow rides the baked seams instead of
 * lying flat over a whole body, so only the hot mineral glows and the
 * glow is the seam's own amber.
 */
export const SEAM_GLOW_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;

/** Patches a toon material so its emissive follows the baked vertex colour. */
export function applySeamGlow(material: MeshToonMaterial, cacheKey: string): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      SEAM_GLOW_CHUNK,
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
    throw new Error(`forge-combs ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

// ─── Seed substreams ─────────────────────────────────────────────────────────
//
// Every stream is `SEEDS.regionSmoking2 ^` one of these — all distinct,
// each builder makes its own `Random` from one (kit builders do this by
// construction), so no module's growth can re-roll another's draws.

export const FC_SEEDS = {
  combs: 0x2100,
  anvil: 0x2101,
  nightDoor: 0x2102,
  pillows: 0x2103,
  skate: 0x2104,
  baseCarpet: 0x2110,
  combGravel: 0x2111,
  washCinder: 0x2112,
  glassShards: 0x2113,
  pillowLitter: 0x2114,
  hearthGravel: 0x2115,
  matsWash: 0x2120,
  matsHearth: 0x2121,
  matsSaddle: 0x2122,
  screeCombs: 0x2130,
  drapesCombs: 0x2131,
  forgeBushes: 0x2132,
  duskTufts: 0x2133,
  crustFronds: 0x2134,
  farCards: 0x2135,
  washShoal: 0x2140,
  gapShoal: 0x2141,
  perchers: 0x2142,
  glassHoppers: 0x2143,
  hearthShrimp: 0x2144,
  seamGlow: 0x2145,
  shafts: 0x2150,
  emberPools: 0x2151,
  shimmer: 0x2152,
  gateVeil: 0x2153,
  distance: 0x2160,
} as const;

// ─── The stillness registry gate ─────────────────────────────────────────────

/**
 * The stillness gate in world space: 0 inside every registered rest
 * (MASTER §1.2 — the Ladle, the Glass Hush, the Anvil's Shadow), 1
 * elsewhere, with a short feather so density dies INTO a rest instead of
 * at a ruled line. Every fill builder multiplies this into its kit gate;
 * fauna anchors and shoal stations test it directly.
 */
export function restFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  let gate = 1;
  for (const rest of [RESTS.ladle, RESTS.glassHush, RESTS.anvilShadow]) {
    const d = Math.hypot(u - rest.u, v - rest.v);
    gate *= smoothstep01((d - rest.radius) / 4);
  }
  return gate;
}
