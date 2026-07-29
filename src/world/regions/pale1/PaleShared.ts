import { Color, Mesh, type BufferGeometry, type Material } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import type { Random } from "../../../util/Random";

/**
 * THE BONE MEADOWS — shared idiom pieces. Nothing here draws from a
 * random stream or touches the scene; this is the region's palette and
 * the mechanical moves the builders repeat.
 *
 * ## The palette, and the value key it must hold hardest
 *
 * An all-pale world is the hard case of the gouache rules: the whites
 * must be *colours* — a warm paper-white and a cool violet-white, never
 * one grey — and every shadow in the white half is a violet whose red
 * stays above its green. The colour that returns across the disc is soft
 * gouache (rose, gold, lavender, seafoam), never neon: the value
 * structure stays pale even at full bloom, which is what keeps the far
 * quarter feeling like the same painting warmed up rather than a second
 * region taped on.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** The bleached bones: one warm paper-white, one violet-cool white. */
export const BONE_WARM = new Color(0xf1e9d8);
export const BONE_COOL = new Color(0xe2e3ec);
/** The violet every white-half shadow is mixed from — red above green. */
export const SHADOW_VIOLET = new Color(0x6f5c88);

/** The First Blush: buds of pink and gold appearing on the white. */
export const BLUSH_PINK = new Color(0xf0b6c4);
export const BLUSH_GOLD = new Color(0xeccf96);

/**
 * The returning colour families, in the order the story deals them:
 * rose, gold, lavender, seafoam, ember. Soft gouache — a recovered reef,
 * not a carnival — but with real chroma: round 1's paler mixes washed to
 * grey under the milk, and a colour that cannot survive its own fog is
 * not a colour.
 */
export const BLOOM_FAMILIES = [
  new Color(0xd9748f),
  new Color(0xd9a446),
  new Color(0x9678cf),
  new Color(0x63bd8a),
  new Color(0xcf7247),
] as const;

/**
 * The tint a living coral wears at a given recovery: bone at 0, its own
 * family at 1, the ramp shared by the gardens, the buds and the tests.
 * `depth` keeps full bloom short of poster saturation.
 */
export function recoveryTint(random: Random, k: number, depth = 0.88): Color {
  const bone = BONE_WARM.clone().lerp(BONE_COOL, random.next());
  const family = BLOOM_FAMILIES[Math.floor(random.next() * BLOOM_FAMILIES.length)]!;
  // The value floor sits high on purpose: a colony whose tint dips under
  // the milk's own value reads as its complement (round 2's maroon
  // tubes) — in this region even the darkest living thing stays pale.
  const value = random.range(0.98, 1.14);
  return bone.lerp(family, smoothstep01(k) * depth).multiplyScalar(value);
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
    throw new Error(`pale ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
