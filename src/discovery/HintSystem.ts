/**
 * Escalating hint ladder. Hints only advance when the player asks, preserving
 * the joy of discovery while ensuring no hidden eel becomes a frustration.
 */
export class HintSystem {
  private index = -1;

  constructor(private readonly rungs: readonly string[]) {
    if (rungs.length === 0) {
      throw new Error("HintSystem requires at least one hint rung");
    }
  }

  get level(): number {
    return this.index;
  }

  get isExhausted(): boolean {
    return this.index >= this.rungs.length - 1;
  }

  /** Advances to and returns the next hint (clamped at the most specific one). */
  next(): string {
    this.index = Math.min(this.index + 1, this.rungs.length - 1);
    const rung = this.rungs[this.index];
    if (rung === undefined) {
      throw new Error("Hint ladder out of range");
    }
    return rung;
  }

  reset(): void {
    this.index = -1;
  }
}
