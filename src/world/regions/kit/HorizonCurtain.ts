import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";

/**
 * `HorizonCurtain` — the hard-geometry purge's shared grammar fix
 * (critic wave, punch #3/F3 and the C4 family). Every region's painted
 * distance was drawing its rings as TWO-row opaque curtains: one flat
 * ink from foot to crest, the top edge a pixel-hard razor line, the
 * gap ends cut into 1.2 m slivers by the min-height clamp. On any
 * horizon that grammar reads as stepped paper rectangles — "one hard
 * rectangle kills a soft world instantly".
 *
 * The Deep Steps (Blue2Distance) already evolved the soft grammar:
 * three rows with RGBA vertex colours whose crest row dissolves to
 * alpha 0, on a transparent depthWrite-less material. This module is
 * that grammar extracted so every ring builder shares it instead of
 * re-deriving two-row strips:
 *
 * - **Three rows per column**: foot, shoulder at 82 % of the column's
 *   height, and a crest lifted 22 % PAST the authored top. Alpha runs
 *   1 → 1 → 0, so the silhouette dissolves across a band that
 *   straddles the authored ridge line — the perceived skyline stays
 *   where the region drew it, but its edge is a painted gradient,
 *   never a razor.
 * - **End dissolve**: columns carry an alpha multiplier; ring builders
 *   pass their gap-ease value so arcs fade OUT at their cut ends
 *   instead of running into the gap as a low opaque ribbon (the
 *   pale-10 "floating slab" defect).
 * - **Value grade** (the poster-board lesson): default row tints lift
 *   foot → crest so even a one-ink ring is never one value.
 *
 * The builder leaves each region's skyline arithmetic (fbm calls,
 * seeds, layer tables) byte-untouched — this is presentation grammar
 * only, and the no-reroll fence never comes near it: nothing here
 * consumes any placement stream.
 */

/** Shoulder row height, as a fraction of the column's authored height. */
const SHOULDER = 0.82;
/** How far past the authored top the dissolved crest row reaches. */
const CREST_LIFT = 0.22;

/** Default value grade, foot → shoulder → crest (never one value). */
const GRADE_FOOT = 0.86;
const GRADE_SHOULDER = 1.0;
const GRADE_CREST = 1.1;

export type SoftRingTints = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

export interface SoftRingColumnOptions {
  /** Alpha multiplier for the whole column (gap-end dissolve), default 1. */
  readonly alpha?: number;
  /** Per-row RGB tints, foot → shoulder → crest; default is the value grade. */
  readonly tints?: SoftRingTints;
  /**
   * Foot-row alpha override (conviction wave). The grammar grounds every
   * curtain's foot at full ink because a ring's foot normally stands
   * below the terrain line — but a curtain hanging over a drop (the
   * Hornsgate's jambs over the Worldwall's fall, the doorway promise
   * past the drop-off's lip) shows its foot row, and a full-ink foot is
   * a hard horizontal terminus. Defaults to the column alpha.
   */
  readonly footAlpha?: number;
}

const DEFAULT_TINTS: SoftRingTints = [
  [GRADE_FOOT, GRADE_FOOT, GRADE_FOOT],
  [GRADE_SHOULDER, GRADE_SHOULDER, GRADE_SHOULDER],
  [GRADE_CREST, GRADE_CREST, GRADE_CREST],
];

/**
 * Accumulates soft three-row curtain columns into one geometry. Call
 * {@link column} per ring station, {@link gap} when a ring skips a
 * sector (so the strip breaks), and {@link build} once.
 */
export class SoftRingBuilder {
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];
  private run = 0;

  /** Breaks the strip — the next column starts a new arc. */
  gap(): void {
    this.run = 0;
  }

  /** One station: a column from `foot` up to the authored `top`. */
  column(x: number, z: number, foot: number, top: number, options?: SoftRingColumnOptions): void {
    const height = Math.max(0, top - foot);
    const shoulder = foot + height * SHOULDER;
    const crest = top + height * CREST_LIFT;
    const alpha = options?.alpha ?? 1;
    const tints = options?.tints ?? DEFAULT_TINTS;
    const footAlpha = Math.min(options?.footAlpha ?? alpha, alpha);

    this.positions.push(x, foot, z, x, shoulder, z, x, crest, z);
    this.colors.push(...tints[0], footAlpha, ...tints[1], alpha, ...tints[2], 0);
    if (this.run > 0) {
      const a = this.positions.length / 3 - 6;
      this.indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
      this.indices.push(a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
    }
    this.run++;
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(this.colors), 4));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }
}

export interface SoftCurtainMaterialOptions {
  /** Placeholder ink until the ring's own followFog corrects it. */
  readonly color: Color | number;
}

/**
 * The material the soft grammar requires: RGBA vertex colours over a
 * fog-followed ink, transparent so the crest dissolve works, depth
 * writes off so the dissolve band never punches holes in what stands
 * behind it. Callers keep their own followFog hooks — only
 * `material.color` is ever re-mixed, exactly as before.
 */
export function softCurtainMaterial(options: SoftCurtainMaterialOptions): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: options.color,
    fog: false,
    side: DoubleSide,
    toneMapped: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * The gap-end dissolve every ring passes as the column alpha: full ink
 * once the end-ease has recovered, fading to nothing where the ease
 * approaches the cut — so no arc ever ends as an opaque sliver ribbon.
 */
export function endAlpha(ease: number): number {
  const t = (ease - 0.04) / 0.42;
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

export interface CurtainDissolveOptions {
  /** Camera distances across which the curtain FADES IN (near guard):
   *  fully gone inside `nearFrom`, fully present past `nearTo`. Unset ⇒
   *  no near guard. */
  readonly nearFrom?: number;
  readonly nearTo?: number;
  /** Camera distances across which the curtain fades OUT toward the far
   *  clip (the Hourglass round-7 lesson: the 160 m far plane slices an
   *  opaque ring into two hard vertical edges). Defaults 140 → 157. */
  readonly farFrom?: number;
  readonly farTo?: number;
  /** Shader cache key — one per distinct window. */
  readonly cacheKey: string;
}

/**
 * Camera-distance self-dissolve for a curtain material (the Deep Steps'
 * and the Hourglass's proven move, shared): alpha runs to zero inside
 * the far window — safely inside the 160 m clip — and, when a near
 * guard is asked for, rises from zero across the near window so a
 * curtain the swim-line passes beside never stands as an opaque blade
 * at arm's length.
 */
export function applyCurtainDissolve(
  material: MeshBasicMaterial,
  options: CurtainDissolveOptions,
): void {
  const farFrom = (options.farFrom ?? 140).toFixed(1);
  const farTo = (options.farTo ?? 157).toFixed(1);
  const near =
    options.nearFrom !== undefined && options.nearTo !== undefined
      ? `diffuseColor.a *= smoothstep(${options.nearFrom.toFixed(1)}, ${options.nearTo.toFixed(1)}, vCurtainDist);\n`
      : "";
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vCurtainDist;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvCurtainDist = -mvPosition.z;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vCurtainDist;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>\n${near}diffuseColor.a *= 1.0 - smoothstep(${farFrom}, ${farTo}, vCurtainDist);`,
      );
  };
  material.customProgramCacheKey = () => options.cacheKey;
}
