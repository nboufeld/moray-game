import type { Random } from "../util/Random";

export interface BubbleTiming {
  /** Shortest and longest gap between two bubbles, in seconds. */
  minGap: number;
  maxGap: number;
  /**
   * How much the gap stretches under reduced motion. Bubbles are transient
   * events, and the comfort setting asks for fewer of those — quieter is not
   * the same thing as calmer, so this thins them out rather than turning
   * them down.
   */
  reducedGapScale: number;
}

export const DEFAULT_BUBBLE_TIMING: BubbleTiming = {
  minGap: 0.5,
  maxGap: 2,
  reducedGapScale: 1.6,
};

/**
 * Decides *when* a bubble happens, and nothing else.
 *
 * Split out from the soundscape because the timing is the only part of a
 * bubble that can be wrong in a way anyone can prove: it draws from the
 * seeded stream, so the same dive produces the same rhythm, and that is
 * testable in plain Node where an `AudioContext` is not.
 */
export class BubbleScheduler {
  private timer: number;

  constructor(
    private readonly random: Random,
    private readonly timing: BubbleTiming = DEFAULT_BUBBLE_TIMING,
  ) {
    this.timer = this.nextGap(false);
  }

  /** Seconds until the next bubble is due. */
  get timeToNext(): number {
    return this.timer;
  }

  /**
   * Advances the clock by `dt` and reports whether a bubble is due now. The
   * countdown only runs while the diver is moving, so a bubble never fires
   * into a still frame and the first stroke of a swim is not silent either.
   *
   * At most one bubble is returned per call by design: a long frame (a codex
   * portrait, a tab coming back to the foreground) must not fire a volley.
   */
  update(dt: number, moving: boolean, reducedMotion = false): boolean {
    if (!moving || dt <= 0) {
      return false;
    }
    this.timer -= dt;
    if (this.timer > 0) {
      return false;
    }
    this.timer = this.nextGap(reducedMotion);
    return true;
  }

  private nextGap(reducedMotion: boolean): number {
    const gap = this.random.range(this.timing.minGap, this.timing.maxGap);
    return reducedMotion ? gap * this.timing.reducedGapScale : gap;
  }
}
