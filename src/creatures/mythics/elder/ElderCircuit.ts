import { Vector3 } from "three";
import type { Random } from "../../../util/Random";

/**
 * The Island That Swims' patrol: one slow closed loop beneath the Sargassum
 * Sky's golden canopy, inside the wing's wedge the whole way round.
 *
 * The loop is authored in the wing's own polar coordinates (azimuth 6.03,
 * radius from the bowl's centre) as a handful of integer-harmonic sines —
 * integer harmonics so the circuit closes exactly and the animal can walk it
 * forever without a seam. Everything wavy is drawn from the handed `Random`
 * at construction, and the path is then a fixed polyline walked at constant
 * speed: the same reef-wide rule that a path is a seed, not a performance.
 */

/** The Sargassum Sky's frozen axis. */
export const SARGASSUM_AZIMUTH = 6.03;

/** The band the elder keeps: its loop stays inside these by construction. */
export const CIRCUIT_RADIUS_CENTRE = 42;
export const CIRCUIT_Y_CENTRE = 5;

/** Metres per second along the loop — the visitor turtle's idiom at a third
 * of its pace, so one circuit is about seventy seconds. */
export const ELDER_SPEED = 0.32;

/** Samples along the loop; walked arc-length uniformly. */
const SAMPLES = 128;

interface CircuitShape {
  readonly radialPhase: number;
  readonly azimuthPhase: number;
  readonly yPhase: number;
}

export class ElderCircuit {
  readonly duration: number;
  private readonly points: Vector3[] = [];
  private readonly cumulative: number[] = [];
  private readonly length: number;

  constructor(random: Random) {
    const shape: CircuitShape = {
      radialPhase: random.range(0, Math.PI * 2),
      azimuthPhase: random.range(0, Math.PI * 2),
      yPhase: random.range(0, Math.PI * 2),
    };

    let total = 0;
    const previous = new Vector3();
    for (let i = 0; i <= SAMPLES; i++) {
      const u = (i / SAMPLES) * Math.PI * 2;
      const point = this.sample(shape, u);
      this.points.push(point);
      if (i === 0) {
        this.cumulative.push(0);
      } else {
        total += point.distanceTo(previous);
        this.cumulative.push(total);
      }
      previous.copy(point);
    }
    this.length = total;
    this.duration = total / ELDER_SPEED;
  }

  /** One point of the closed loop; `u` runs [0, 2π]. */
  private sample(shape: CircuitShape, u: number): Vector3 {
    // Radius 38.3–45.7, azimuth ±0.097 rad (the wedge's walls at this radius
    // are ±0.149), height 4.3–5.7 — every bound the tests assert is a clamp
    // of the authored amplitudes, not a hope.
    const r = CIRCUIT_RADIUS_CENTRE + 3.2 * Math.cos(u) + 0.5 * Math.cos(3 * u + shape.radialPhase);
    const theta =
      SARGASSUM_AZIMUTH + 0.085 * Math.sin(u) + 0.012 * Math.sin(2 * u + shape.azimuthPhase);
    const y = CIRCUIT_Y_CENTRE + 0.7 * Math.sin(2 * u + shape.yPhase);
    return new Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
  }

  /** World position at `s` in [0, 1], walked at constant speed. */
  positionAt(s: number, out: Vector3): Vector3 {
    const wrapped = ((s % 1) + 1) % 1;
    const target = wrapped * this.length;
    let low = 0;
    let high = this.cumulative.length - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (this.cumulative[mid]! <= target) {
        low = mid;
      } else {
        high = mid;
      }
    }
    const from = this.points[low]!;
    const to = this.points[Math.min(high, this.points.length - 1)]!;
    const span = this.cumulative[high]! - this.cumulative[low]!;
    const t = span > 1e-9 ? (target - this.cumulative[low]!) / span : 0;
    return out.copy(from).lerp(to, t);
  }

  /** Direction of travel at `s`; unit length. */
  tangentAt(s: number, out: Vector3): Vector3 {
    const epsilon = 1 / SAMPLES;
    const a = this.positionAt(s - epsilon, out);
    const b = new Vector3();
    this.positionAt(s + epsilon, b);
    return out.copy(b).sub(a).normalize();
  }
}
