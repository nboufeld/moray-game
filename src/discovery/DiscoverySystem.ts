import { Vector3 } from "three";
import { FocusScanner, type FocusParams, DEFAULT_FOCUS_PARAMS } from "./FocusScanner";

export interface DiscoveryTarget {
  readonly speciesId: string;
  /** World position of the moray's focusable point (its head). */
  readonly position: Vector3;
}

export interface DiscoveryProbe {
  readonly cameraPosition: Vector3;
  readonly forward: Vector3;
  /** Returns true when the line of sight to the given target is blocked. */
  readonly isObstructed: (target: DiscoveryTarget) => boolean;
}

export interface DiscoveryUpdate {
  /** The target currently being focused, if any. */
  readonly focused: DiscoveryTarget | null;
  /** Focus progress (0..1) of the focused target. */
  readonly progress: number;
  /** A species discovered on this exact update, if any. */
  readonly newlyDiscovered: DiscoveryTarget | null;
}

/**
 * Tracks focus progress across all reef targets and records discoveries.
 * Only the best-aligned uncompleted target accumulates progress per update,
 * so the player focuses one moray at a time.
 */
export class DiscoverySystem {
  private readonly scanners = new Map<string, FocusScanner>();
  private readonly discovered = new Set<string>();

  constructor(
    private readonly targets: readonly DiscoveryTarget[],
    params: FocusParams = DEFAULT_FOCUS_PARAMS,
  ) {
    for (const target of targets) {
      this.scanners.set(target.speciesId, new FocusScanner(params));
    }
  }

  get totalCount(): number {
    return this.targets.length;
  }

  get discoveredCount(): number {
    return this.discovered.size;
  }

  isDiscovered(speciesId: string): boolean {
    return this.discovered.has(speciesId);
  }

  /** Marks a species discovered without focusing (e.g. when loading a save). */
  markDiscovered(speciesId: string): void {
    this.discovered.add(speciesId);
    this.scanners.get(speciesId)?.reset();
  }

  discoveredIds(): string[] {
    return [...this.discovered];
  }

  update(probe: DiscoveryProbe, dt: number): DiscoveryUpdate {
    let best: DiscoveryTarget | null = null;
    let bestDot = -Infinity;
    const dir = new Vector3();

    for (const target of this.targets) {
      if (this.discovered.has(target.speciesId)) {
        continue;
      }
      dir.subVectors(target.position, probe.cameraPosition);
      const distance = dir.length();
      if (distance === 0) {
        continue;
      }
      const dot = dir.dot(probe.forward) / distance;
      if (dot > bestDot) {
        bestDot = dot;
        best = target;
      }
    }

    if (!best) {
      return { focused: null, progress: 0, newlyDiscovered: null };
    }

    const scanner = this.scanners.get(best.speciesId);
    if (!scanner) {
      throw new Error(`Missing focus scanner for ${best.speciesId}`);
    }

    // Every other undiscovered moray keeps decaying, otherwise a half-focused
    // one would hold its progress until the player happens to look back.
    for (const target of this.targets) {
      if (target === best || this.discovered.has(target.speciesId)) {
        continue;
      }
      this.scanners.get(target.speciesId)?.decay(dt);
    }

    const state = scanner.update(
      {
        cameraPosition: probe.cameraPosition,
        forward: probe.forward,
        targetPosition: best.position,
        obstructed: probe.isObstructed(best),
      },
      dt,
    );

    let newlyDiscovered: DiscoveryTarget | null = null;
    if (state.justCompleted) {
      this.discovered.add(best.speciesId);
      newlyDiscovered = best;
    }

    return { focused: best, progress: state.progress, newlyDiscovered };
  }
}
