export type StepCallback = (fixedDelta: number) => void;

/**
 * Fixed-timestep accumulator. Simulation advances in constant steps while
 * rendering can interpolate with the returned alpha. Oversized frame deltas
 * (for example after a tab is restored) are clamped so the simulation never
 * receives a giant jump.
 */
export class GameLoop {
  private accumulator = 0;

  constructor(
    readonly fixedDelta = 1 / 60,
    private readonly maxFrameDelta = 0.25,
  ) {}

  reset(): void {
    this.accumulator = 0;
  }

  /**
   * Advances the accumulator by a real frame delta (seconds), invoking
   * `onStep` for each whole fixed step. Returns the interpolation alpha
   * (0..1) representing the leftover fraction of a step.
   */
  advance(frameDelta: number, onStep: StepCallback): number {
    const clamped = Math.min(Math.max(frameDelta, 0), this.maxFrameDelta);
    this.accumulator += clamped;

    let guard = 0;
    while (this.accumulator >= this.fixedDelta) {
      onStep(this.fixedDelta);
      this.accumulator -= this.fixedDelta;
      if (++guard > 240) {
        this.accumulator = 0;
        break;
      }
    }

    return this.accumulator / this.fixedDelta;
  }
}
