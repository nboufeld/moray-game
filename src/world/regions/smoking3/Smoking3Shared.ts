import { Color, Mesh, type BufferGeometry, type Material, type MeshToonMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { RESTS, spokeOf } from "./Smoking3Terrain";

/**
 * THE LANTERN VIGIL — shared idiom pieces for the builders. Nothing here
 * draws from a random stream or touches the scene; these are the
 * region's palette, its seed substream table and the mechanical moves
 * every module repeats.
 *
 * ## The palette, and the value key it keeps
 *
 * The province's vocabulary at its destination: the darkest water in
 * the Smoking Marches — a true night, violet-charcoal, never black —
 * and against it the fire's answer: lantern glass glowing amber from
 * inside, the Last Wick's one bright seam, amber pooled harder in the
 * fens' mottle than anywhere in the province, the Ash Veil's milk-pale
 * drifts (the milk-bright register carried by falling ash), and the
 * Morning Vent's rising column — the one place the light finally goes
 * UP. Warm and rising, always; nothing here burns cold.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** Night basalt-glass: violet-charcoal, red above green, never black. */
export const GLASS_TONES = [0x3a3044, 0x463a48, 0x2d2738] as const;
/** The night plain's dusk gravel — a shade darker than the Combs'. */
export const NIGHT_TONES = [0x6e6476, 0x7a6c62, 0x625a70] as const;
/** The ash drifts' milk-pale settle. */
export const ASH_PALE = new Color(0xe3d8c0);
/** The amber the fens' mottle pools toward. */
export const AMBER = new Color(0xd9964a);
/** The ember note — the hottest painted value in the region. */
export const EMBER = new Color(0xff7a38);
/** The lantern light: the amber the glass holds. */
export const LAMP = new Color(0xffa14e);
/** The violet the deepest shadow is mixed from — a colour, never a black. */
export const SHADOW_VIOLET = new Color(0x483a54);

/**
 * The emissive-by-vertex-colour patch (the province's inheritance from
 * the canyon polyps, third generation) — SQUARED: the glow rides the
 * baked window panels and seams instead of lying flat over a whole
 * body. R2 lesson: the linear form (`*= vColor`) left a residual
 * emissive wash over the dark glass (0.22 luminance × 0.55 intensity
 * turned every spire into a terracotta jug); squaring the factor takes
 * the dark body's contribution to ~0.03 while the bright windows keep
 * theirs — only the lit glass glows, and the glow is the lamp's own.
 */
export const LAMP_GLOW_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor * vColor;
`;

/** Patches a toon material so its emissive follows the baked vertex colour. */
export function applyLampGlow(material: MeshToonMaterial, cacheKey: string): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      LAMP_GLOW_CHUNK,
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
    throw new Error(`lantern-vigil ${name} parts could not be merged`);
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
// Every stream is `SEEDS.regionSmoking3 ^` one of these — all distinct,
// each builder makes its own `Random` from one (kit builders do this by
// construction), so no module's growth can re-roll another's draws.

export const LV_SEEDS = {
  lanterns: 0x3100,
  vent: 0x3101,
  spilt: 0x3102,
  wright: 0x3104,
  baseCarpet: 0x3110,
  nightBlades: 0x3111,
  wickCinder: 0x3112,
  ashSward: 0x3113,
  ashPebbles: 0x3114,
  fenGravel: 0x3115,
  cradleGarden: 0x3116,
  cradlePebbles: 0x3117,
  glassLitter: 0x3118,
  emberFronds: 0x3119,
  matsWick: 0x3120,
  matsFens: 0x3121,
  matsCradle: 0x3122,
  screeFeet: 0x3130,
  drapesVent: 0x3131,
  nightBushes: 0x3132,
  farCards: 0x3135,
  wickShoal: 0x3140,
  cradleShoal: 0x3141,
  perchers: 0x3142,
  mothFry: 0x3143,
  fenShrimp: 0x3144,
  ashDarters: 0x3145,
  gardenGlow: 0x3146,
  lampGlow: 0x3147,
  shafts: 0x3150,
  emberPools: 0x3151,
  shimmer: 0x3152,
  ashFall: 0x3153,
  motes: 0x3154,
  distance: 0x3160,
} as const;

// ─── The stillness registry gate ─────────────────────────────────────────────

/**
 * The stillness gate in world space: 0 inside every registered rest
 * (MASTER §1.2 — the Cold Lantern, the Fen Hush, the Morning Shadow),
 * 1 elsewhere, with a short feather so density dies INTO a rest instead
 * of at a ruled line. Every fill builder multiplies this into its kit
 * gate; fauna anchors and shoal stations test it directly.
 */
export function restFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  let gate = 1;
  for (const rest of [RESTS.coldLantern, RESTS.fenHush, RESTS.morningShadow]) {
    const d = Math.hypot(u - rest.u, v - rest.v);
    gate *= smoothstep01((d - rest.radius) / 4);
  }
  return gate;
}
