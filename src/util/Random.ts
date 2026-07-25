/**
 * A tiny seeded PRNG (mulberry32). The reef, its grass, the fish and the
 * caustics pattern are all scattered procedurally, so without a fixed seed the
 * scene is different on every load and no two screenshots can be compared.
 * Art-direction review needs the same reef every time.
 */
export class Random {
  private state: number;

  constructor(seed: number) {
    // A zero state would lock the generator on a constant.
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform in [-magnitude, +magnitude). */
  signed(magnitude: number): number {
    return this.range(-magnitude, magnitude);
  }
}

/**
 * Distinct constants per subsystem so that reseeding or re-tuning one of them
 * does not shuffle the others out from under a screenshot comparison.
 */
export const SEEDS = {
  reef: 0x5eed_1eaf,
  grass: 0x6a55_3f21,
  coral: 0xc042_11ee,
  fish: 0x0f15_4001,
  motes: 0x3a17_7e5c,
  caustics: 0xca05_71c5,
  shafts: 0x5eab_ea11,
} as const;
