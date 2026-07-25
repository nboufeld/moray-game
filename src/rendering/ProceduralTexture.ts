import { DataTexture, LinearMipmapLinearFilter, RGBAFormat, RepeatWrapping, SRGBColorSpace } from "three";

/**
 * Procedural texture generation, built into typed arrays rather than a canvas.
 *
 * Two reasons for `DataTexture` over canvas 2D. It has no DOM dependency, so
 * every map here works unchanged in the plain Node unit tests instead of
 * needing another `typeof document` guard. And it is bit-identical everywhere,
 * where canvas rasterisation is only deterministic for a given browser build —
 * which matters because the whole art-direction loop rests on two screenshots
 * of the same seed being comparable.
 *
 * Every generator below tiles seamlessly by construction: the lattice wraps on
 * a fixed integer period rather than being stamped and hoped over.
 */

export interface NoiseParams {
  readonly seed: number;
  /** Lattice cells across the tile. Must stay integral for the wrap to hold. */
  readonly period: number;
  readonly octaves?: number;
  readonly gain?: number;
}

/** Deterministic 2D hash in [0, 1). */
function hash2(x: number, y: number, seed: number): number {
  let h = (seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function wrap(value: number, period: number): number {
  return ((value % period) + period) % period;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Value noise on a wrapping lattice. `x`/`y` are in lattice cells. */
function valueNoise(x: number, y: number, period: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const ux = smooth(x - x0);
  const uy = smooth(y - y0);

  const xa = wrap(x0, period);
  const xb = wrap(x0 + 1, period);
  const ya = wrap(y0, period);
  const yb = wrap(y0 + 1, period);

  return mix(
    mix(hash2(xa, ya, seed), hash2(xb, ya, seed), ux),
    mix(hash2(xa, yb, seed), hash2(xb, yb, seed), ux),
    uy,
  );
}

/**
 * Fractal value noise in [0, 1]. Lacunarity is fixed at 2 so that each octave's
 * period stays integral and the tile keeps wrapping.
 */
export function fbm(u: number, v: number, params: NoiseParams): number {
  const octaves = params.octaves ?? 4;
  const gain = params.gain ?? 0.5;

  let amplitude = 1;
  let total = 0;
  let norm = 0;
  let frequency = 1;

  for (let i = 0; i < octaves; i++) {
    total +=
      amplitude *
      valueNoise(
        u * params.period * frequency,
        v * params.period * frequency,
        params.period * frequency,
        params.seed + i * 1013,
      );
    norm += amplitude;
    amplitude *= gain;
    frequency *= 2;
  }

  return total / norm;
}

/** Ridged fractal noise — sharp crests, good for cracks and strata. */
export function ridged(u: number, v: number, params: NoiseParams): number {
  const octaves = params.octaves ?? 4;
  const gain = params.gain ?? 0.5;

  let amplitude = 1;
  let total = 0;
  let norm = 0;
  let frequency = 1;

  for (let i = 0; i < octaves; i++) {
    const n = valueNoise(
      u * params.period * frequency,
      v * params.period * frequency,
      params.period * frequency,
      params.seed + i * 2027,
    );
    total += amplitude * (1 - Math.abs(n * 2 - 1));
    norm += amplitude;
    amplitude *= gain;
    frequency *= 2;
  }

  return total / norm;
}

export interface VoronoiSample {
  /** Distance to the nearest feature point, in tile units. */
  readonly f1: number;
  /** Distance to the second nearest. `f2 - f1` traces the cell walls. */
  readonly f2: number;
}

/** Cellular noise on a wrapping grid of `cells` feature points per axis. */
export function voronoi(u: number, v: number, cells: number, seed: number): VoronoiSample {
  const px = u * cells;
  const py = v * cells;
  const ix = Math.floor(px);
  const iy = Math.floor(py);

  let f1 = Infinity;
  let f2 = Infinity;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const wx = wrap(cx, cells);
      const wy = wrap(cy, cells);
      const featureX = cx + hash2(wx, wy, seed);
      const featureY = cy + hash2(wx, wy, seed ^ 0x9e3779b9);
      const distance = Math.hypot(px - featureX, py - featureY);
      if (distance < f1) {
        f2 = f1;
        f1 = distance;
      } else if (distance < f2) {
        f2 = distance;
      }
    }
  }

  return { f1: f1 / cells, f2: f2 / cells };
}

export type ColorSampler = (u: number, v: number) => readonly [number, number, number];

/**
 * Builds an sRGB colour map. `sample` returns linear 0..1 RGB per texel.
 */
export function buildColorTexture(size: number, sample: ColorSampler): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = sample((x + 0.5) / size, (y + 0.5) / size);
      const i = (y * size + x) * 4;
      data[i] = clamp255(r * 255);
      data[i + 1] = clamp255(g * 255);
      data[i + 2] = clamp255(b * 255);
      data[i + 3] = 255;
    }
  }
  return finish(new DataTexture(data, size, size, RGBAFormat), SRGBColorSpace);
}

/** Builds a single-channel map replicated across RGB (roughness, AO, masks). */
export function buildScalarTexture(size: number, sample: (u: number, v: number) => number): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = clamp255(sample((x + 0.5) / size, (y + 0.5) / size) * 255);
      const i = (y * size + x) * 4;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }
  return finish(new DataTexture(data, size, size, RGBAFormat), undefined);
}

/**
 * Derives a tangent-space normal map from a height function by central
 * differences. Sampling wraps, so the normal map tiles wherever the height did.
 */
export function buildNormalTexture(
  size: number,
  height: (u: number, v: number) => number,
  strength = 1,
): DataTexture {
  // Resolve the height field once: it is usually several octaves of noise and
  // each texel would otherwise be sampled four times over.
  const field = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      field[y * size + x] = height((x + 0.5) / size, (y + 0.5) / size);
    }
  }

  const at = (x: number, y: number): number => field[wrap(y, size) * size + wrap(x, size)] ?? 0;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength * size * 0.5;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength * size * 0.5;
      // Normal of the height field: (-dh/dx, -dh/dy, 1), normalised.
      const length = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      data[i] = clamp255(((-dx / length) * 0.5 + 0.5) * 255);
      data[i + 1] = clamp255(((-dy / length) * 0.5 + 0.5) * 255);
      data[i + 2] = clamp255((1 / length / 2 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }

  return finish(new DataTexture(data, size, size, RGBAFormat), undefined);
}

function finish(texture: DataTexture, colorSpace: typeof SRGBColorSpace | undefined): DataTexture {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  if (colorSpace) {
    texture.colorSpace = colorSpace;
  }
  texture.needsUpdate = true;
  return texture;
}

function clamp255(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
}
