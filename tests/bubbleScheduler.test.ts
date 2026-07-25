import { describe, expect, it } from "vitest";
import { BubbleScheduler, DEFAULT_BUBBLE_TIMING } from "../src/audio/BubbleScheduler";
import { Random, SEEDS } from "../src/util/Random";

const STEP = 1 / 60;

/** Runs a swim of `seconds` and counts the bubbles it would have produced. */
function swim(seconds: number, options: { moving?: boolean; reducedMotion?: boolean } = {}): number {
  const scheduler = new BubbleScheduler(new Random(SEEDS.audioBubbles));
  let count = 0;
  for (let t = 0; t < seconds; t += STEP) {
    if (scheduler.update(STEP, options.moving ?? true, options.reducedMotion ?? false)) {
      count++;
    }
  }
  return count;
}

describe("BubbleScheduler", () => {
  it("stays silent while the diver is still", () => {
    expect(swim(120, { moving: false })).toBe(0);
  });

  it("emits at roughly the mean rate of its gap range", () => {
    const seconds = 600;
    const count = swim(seconds);
    const meanGap = (DEFAULT_BUBBLE_TIMING.minGap + DEFAULT_BUBBLE_TIMING.maxGap) / 2;
    const expected = seconds / meanGap;
    expect(count).toBeGreaterThan(expected * 0.85);
    expect(count).toBeLessThan(expected * 1.15);
  });

  it("never emits twice in one call, however long the frame was", () => {
    const scheduler = new BubbleScheduler(new Random(SEEDS.audioBubbles));
    // A tab returning to the foreground hands us a frame worth of minutes; it
    // must produce one bubble, not a volley of them.
    expect(scheduler.update(600, true)).toBe(true);
    expect(scheduler.update(0.001, true)).toBe(false);
  });

  it("keeps gaps inside the configured range", () => {
    const scheduler = new BubbleScheduler(new Random(SEEDS.audioBubbles));
    for (let i = 0; i < 200; i++) {
      expect(scheduler.timeToNext).toBeGreaterThanOrEqual(DEFAULT_BUBBLE_TIMING.minGap);
      expect(scheduler.timeToNext).toBeLessThanOrEqual(DEFAULT_BUBBLE_TIMING.maxGap);
      scheduler.update(DEFAULT_BUBBLE_TIMING.maxGap, true);
    }
  });

  it("thins the bubbles out under reduced motion", () => {
    const normal = swim(600);
    const reduced = swim(600, { reducedMotion: true });
    expect(reduced).toBeLessThan(normal);
    // Roughly the configured stretch, not merely "some" fewer.
    expect(reduced).toBeCloseTo(normal / DEFAULT_BUBBLE_TIMING.reducedGapScale, -1);
  });

  it("is deterministic for a given seed", () => {
    expect(swim(300)).toBe(swim(300));
  });
});
