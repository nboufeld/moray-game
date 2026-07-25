import { describe, expect, it } from "vitest";
import { DiscoveryPulse } from "../src/rendering/DiscoveryPulse";

/** Advances in fixed steps and reports the strongest value seen. */
function run(pulse: DiscoveryPulse, seconds: number, reducedMotion = false): number {
  let peak = 0;
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
    peak = Math.max(peak, pulse.advance(1 / 60, reducedMotion));
  }
  return peak;
}

describe("DiscoveryPulse", () => {
  it("stays neutral until a discovery triggers it", () => {
    const pulse = new DiscoveryPulse();
    expect(pulse.isRunning).toBe(false);
    expect(run(pulse, 2)).toBe(0);
  });

  it("swells to full strength and eases back to nothing", () => {
    const pulse = new DiscoveryPulse();
    pulse.trigger();
    expect(pulse.isRunning).toBe(true);
    expect(run(pulse, 1.5)).toBeGreaterThan(0.9);
    expect(pulse.isRunning).toBe(false);
    expect(pulse.advance(1 / 60)).toBe(0);
  });

  it("decays rather than holding: half way through it is well past its peak", () => {
    const pulse = new DiscoveryPulse();
    pulse.trigger();
    run(pulse, 0.6);
    expect(pulse.advance(0)).toBeLessThan(0.6);
  });

  it("softens but does not cut the swell under reduced motion", () => {
    const pulse = new DiscoveryPulse();
    pulse.trigger();
    const calmPeak = run(pulse, 1.5, true);
    expect(calmPeak).toBeGreaterThan(0);
    expect(calmPeak).toBeLessThan(0.5);
  });

  it("restarts cleanly when a second moray is found mid-swell", () => {
    const pulse = new DiscoveryPulse();
    pulse.trigger();
    pulse.advance(1);
    pulse.trigger();
    expect(run(pulse, 1.5)).toBeGreaterThan(0.9);
  });
});
