/** Length of the swell, in seconds. */
const DURATION = 1.2;
/** Fraction of it spent rising. The rest is the ease-out. */
const ATTACK = 0.15;
/**
 * How much of the swell survives reduced motion. A change of colour is not a
 * change of motion, so it is softened rather than cut — but it is no longer
 * allowed to swing.
 */
const CALM_SCALE = 0.4;

/**
 * The colour swell that marks a discovery: a quick rise and a long ease-out,
 * driving the grade's `uPulse`.
 *
 * It is deliberately a plain value with no renderer and no scene. The moment is
 * the payoff of the whole loop and the timings are worth testing, and nothing
 * about "how long a feeling lasts" needs a GPU to decide.
 */
export class DiscoveryPulse {
  private elapsed = -1;

  /** Restarts the swell from the top. */
  trigger(): void {
    this.elapsed = 0;
  }

  get isRunning(): boolean {
    return this.elapsed >= 0;
  }

  /** Advances by `dt` seconds and returns the new strength, 0 to 1. */
  advance(dt: number, reducedMotion = false): number {
    if (this.elapsed < 0) {
      return 0;
    }
    this.elapsed += dt;
    const t = this.elapsed / DURATION;
    if (t >= 1) {
      this.elapsed = -1;
      return 0;
    }
    const strength = t <= ATTACK ? t / ATTACK : ((1 - t) / (1 - ATTACK)) ** 2;
    return strength * (reducedMotion ? CALM_SCALE : 1);
  }
}
