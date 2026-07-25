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
  fogDither: 0xd177_be71,
  sand: 0x5a4d_0001,
  rock: 0x5a4d_0002,
  coralSkin: 0x5a4d_0003,
  grassBlade: 0x5a4d_0004,
  pinnacle: 0x5a4d_0005,
  cave: 0x5a4d_0006,
  // The sanctuary dresses its own set from the same generators as the reef, so
  // it takes its own streams: sharing the reef's would put the reef's meadow
  // and its bommies in the aquarium, and re-tuning one room would re-roll the
  // other out from under a screenshot comparison.
  sanctuaryRock: 0x5a4d_0101,
  sanctuaryCoral: 0x5a4d_0102,
  sanctuaryGrass: 0x5a4d_0103,
  sanctuaryMotes: 0x5a4d_0104,
  sanctuaryShafts: 0x5a4d_0105,
  // The soundscape synthesises its noise the same way the reef scatters its
  // rocks: from a fixed stream, so the ambience bed and the reverb tail are
  // the same waveform on every load and a re-tune is a change anyone can hear
  // against the version before it.
  audioBed: 0x5a4d_0201,
  /** When a bubble happens, kept apart from what it sounds like. */
  audioBubbles: 0x5a4d_0202,
  audioBubbleVoice: 0x5a4d_0203,
  audioReverb: 0x5a4d_0204,
} as const;
