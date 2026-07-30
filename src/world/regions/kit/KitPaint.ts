import { BufferAttribute, type BufferGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import type { GateFn } from "./KitTypes";

/**
 * `wallStrataPaint` — KIT-SPEC §2.10. Not a mesh: the `canyonStrata` bake
 * generalised, so each wing's wall uplift is a TABLE handed to the existing
 * `WingDef.paint` slot instead of a bake rewritten fifteen times.
 *
 * The strata disciplines, preserved from `Abyss.canyonStrata`:
 *
 * - The caller's bands should lean violet with red held above green (the
 *   value key); the darkest band multiplies to a COLOUR, never a hole —
 *   the bands are the caller's table, and the demo palette shows the law.
 * - Band edges wander together on ONE seeded fbm field, so no stratum is
 *   a ruled line and the bands stay ordered top-down at every (x, z).
 * - Blends must stay at or above the mesh's grid pitch (Nyquist honesty —
 *   no band finer than ~2 vertices); the default 1.3 m is the canyon's,
 *   sized against the seabed's 0.94 m grid.
 * - **Skip-when-gate-zero**: wherever `gate` returns exactly 0 the vertex
 *   is never read or written, so untouched ground keeps byte identity
 *   (asserted by tests/kitGround.test.ts). Where the gate is partial the
 *   deviation scales through the canyon's own `smoothstep(gate / 0.35)`,
 *   so a wing passing its carve weight fades to identity at the wedge
 *   edges exactly the way the canyon does.
 *
 * Positions are read as WORLD space (seabed sheets and wing walls are
 * world-space by construction); `height` is the world y a band's floor
 * sits at, bands listed top-down, the last band running to −∞.
 */

export interface StrataBand {
  /** Per-channel multiplier on the baked vertex colours at full weight. */
  readonly tint: readonly [number, number, number];
  /** World y of this band's FLOOR — the next band takes over below it. */
  readonly height: number;
}

export interface WallStrataOptions {
  readonly seed: number;
  /** Top-down band table; the last entry extends to the geometry's foot. */
  readonly bands: readonly StrataBand[];
  /** Metres over which one band blends into the next. Default 1.3. */
  readonly blend?: number;
  /** Metres of seeded fbm wander on every band edge. Default 1.3. */
  readonly wander?: number;
  /** Paint weight in [0,1]; exactly 0 leaves the vertex bytes untouched. */
  readonly gate?: GateFn;
}

export function applyWallStrata(geometry: BufferGeometry, options: WallStrataOptions): void {
  if (options.bands.length === 0) {
    return;
  }
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }
  let colors = geometry.attributes.color as BufferAttribute | undefined;
  if (!colors) {
    colors = new BufferAttribute(new Float32Array(position.count * 3).fill(1), 3);
    geometry.setAttribute("color", colors);
  }

  const blend = options.blend ?? 1.3;
  const wanderAmp = options.wander ?? 1.3;
  const bands = options.bands;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const weight = options.gate ? options.gate(x, z) : 1;
    if (weight === 0) {
      continue; // the byte-identity contract: never read, never written
    }

    // One low-frequency field, sampled once — every band edge wanders
    // together, so the top-down order can never invert.
    const wander =
      (fbm(x * 0.045, z * 0.045, { seed: options.seed, period: 8, octaves: 2 }) - 0.5) *
      2 *
      wanderAmp;
    const level = position.getY(i) + wander;

    // Walk down the bands, blending across each boundary.
    let r = bands[0]!.tint[0];
    let g = bands[0]!.tint[1];
    let b = bands[0]!.tint[2];
    for (let bandIndex = 1; bandIndex < bands.length; bandIndex++) {
      const boundary = bands[bandIndex - 1]!.height;
      const into = smoothstep01((boundary - level) / blend);
      if (into <= 0) {
        break;
      }
      const tint = bands[bandIndex]!.tint;
      r += (tint[0] - r) * into;
      g += (tint[1] - g) * into;
      b += (tint[2] - b) * into;
    }

    // The canyon's own gate shaping: full paint by 0.35, identity at 0.
    const s = smoothstep01(weight / 0.35);
    colors.setXYZ(
      i,
      colors.getX(i) * (1 + (r - 1) * s),
      colors.getY(i) * (1 + (g - 1) * s),
      colors.getZ(i) * (1 + (b - 1) * s),
    );
  }
  colors.needsUpdate = true;
}

function smoothstep01(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}
