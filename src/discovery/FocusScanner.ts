import { Vector3 } from "three";

export interface FocusParams {
  /** Closest distance at which a moray can be focused (avoids clipping). */
  readonly minDistance: number;
  /** Farthest distance at which focus is possible. */
  readonly maxDistance: number;
  /** Cosine of the maximum half-angle between view forward and the target. */
  readonly minViewDot: number;
  /** Seconds of continuous alignment required to fully focus. */
  readonly focusDuration: number;
  /** Progress lost per second when alignment is broken. */
  readonly decayRate: number;
}

export const DEFAULT_FOCUS_PARAMS: FocusParams = {
  minDistance: 1.2,
  maxDistance: 14,
  minViewDot: 0.95, // ~18 degree half-angle
  focusDuration: 1.5,
  decayRate: 1.4,
};

export interface FocusSample {
  readonly cameraPosition: Vector3;
  /** Unit-length view forward direction. */
  readonly forward: Vector3;
  readonly targetPosition: Vector3;
  /** True when the line of sight is blocked by geometry. */
  readonly obstructed: boolean;
}

export interface FocusState {
  /** 0..1 accumulated focus progress. */
  readonly progress: number;
  /** True when the target is currently within cone, range and unobstructed. */
  readonly aligned: boolean;
  /** True only on the update where progress first reaches 1. */
  readonly justCompleted: boolean;
  /** True once fully focused (latched). */
  readonly completed: boolean;
}

/**
 * Accumulates focus on a single target while the player keeps it centred,
 * in range and unobstructed. Pure math so it runs in unit tests without WebGL.
 */
export class FocusScanner {
  private progress = 0;
  private completed = false;
  private readonly toTarget = new Vector3();

  constructor(private readonly params: FocusParams = DEFAULT_FOCUS_PARAMS) {}

  reset(): void {
    this.progress = 0;
    this.completed = false;
  }

  isCompleted(): boolean {
    return this.completed;
  }

  update(sample: FocusSample, dt: number): FocusState {
    if (this.completed) {
      return { progress: 1, aligned: true, justCompleted: false, completed: true };
    }

    this.toTarget.subVectors(sample.targetPosition, sample.cameraPosition);
    const distance = this.toTarget.length();
    let aligned = false;

    if (distance >= this.params.minDistance && distance <= this.params.maxDistance && !sample.obstructed) {
      const dot = this.toTarget.dot(sample.forward) / distance;
      aligned = dot >= this.params.minViewDot;
    }

    if (aligned) {
      this.progress += dt / this.params.focusDuration;
    } else {
      this.progress -= dt * this.params.decayRate;
    }
    this.progress = Math.min(1, Math.max(0, this.progress));

    let justCompleted = false;
    if (this.progress >= 1) {
      justCompleted = true;
      this.completed = true;
    }

    return { progress: this.progress, aligned, justCompleted, completed: this.completed };
  }
}
