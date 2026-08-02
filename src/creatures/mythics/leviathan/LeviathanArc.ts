import { Vector3 } from "three";
import type { Random } from "../../../util/Random";

/**
 * The Lantern Leviathan's crossing: one slow arc around the far water
 * behind the wings, from beyond the Sandfall Dunes to beyond the Open Blue.
 *
 * The shape is authored in azimuth–radius–height space rather than as a
 * Cartesian Bézier (`BankedArc`'s idiom) because the journey is not *across*
 * a stage but *around* one: the animal sweeps the quadrant between the two
 * wings while never coming nearer than its own depth allows. That is what
 * makes the two testable promises of this module expressible as clamps:
 *
 * - the body never enters `r < {@link MIN_RADIUS}` (it crosses BEHIND the
 *   world, outside every wing's swimmable cap), and
 * - every crossing dips toward the Open Blue's end wall once, so the min
 *   distance from the arc to {@link NEAR_PASS_ANCHOR} stays well under the
 *   focus scanner's 14 m reach and a waiting diver can earn the discovery.
 *
 * Everything is drawn from the handed `Random` at construction — the seed
 * rule of the whole reef — and the path is then a fixed polyline walked at
 * constant speed, so a crossing is bit-identical between runs.
 */

/** Azimuth of the Open Blue's axis (its frozen wing slot). */
export const OPEN_BLUE_AZIMUTH = 5.31;
/** Azimuth of the Sandfall Dunes' axis (its frozen wing slot). */
export const SANDFALL_AZIMUTH = 6.39;

/** Metres from the bowl's centre the body never crosses inside. */
export const MIN_RADIUS = 52;
/** The y band the whole crossing rides in. */
export const MIN_HEIGHT = 6;
export const MAX_HEIGHT = 10;

/**
 * Where a diver waits for the near pass: the Open Blue's end-wall reachable
 * water, on-axis at r = 50, mid-way up the arc's own band (the wing's
 * ceiling there is 11, so a diver can genuinely hold this height).
 */
export const NEAR_PASS_ANCHOR = new Vector3(
  50 * Math.cos(OPEN_BLUE_AZIMUTH),
  8,
  50 * Math.sin(OPEN_BLUE_AZIMUTH),
);

/** Metres per second along the arc — stately for a 14 m animal. */
export const LEVIATHAN_SPEED = 0.95;

/** Samples along one arc; the polyline is walked arc-length uniformly. */
const SAMPLES = 128;

interface ArcShape {
  /** Unwrapped azimuth at s = 0 (entry, past the Sandfall) and s = 1 (exit,
   * past the Open Blue). Entry > exit: the sweep runs "down" through the
   * 2π wrap — Sandfall (6.39 ≡ 0.11) to Open Blue (5.31). */
  readonly thetaFrom: number;
  readonly thetaTo: number;
  /** Far-water radii at entry, mid-crossing and exit. */
  readonly rFrom: number;
  readonly rMid: number;
  readonly rTo: number;
  /** The near-pass dip: where along the arc, how deep, how wide. */
  readonly dipAt: number;
  readonly dipDepth: number;
  readonly dipWidth: number;
  /** The slow height breathing: phase and wave count over the crossing. */
  readonly yPhase: number;
  readonly yWaves: number;
}

function smooth01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

export class LeviathanArc {
  readonly duration: number;
  private readonly points: Vector3[] = [];
  private readonly cumulative: number[] = [];
  private readonly length: number;

  constructor(random: Random) {
    // Entry a touch past the Sandfall's axis (unwrapped past 2π), exit a
    // touch past the Open Blue's; jittered so no two crossings are twins.
    const thetaFrom = SANDFALL_AZIMUTH + random.range(0.16, 0.3);
    const thetaTo = OPEN_BLUE_AZIMUTH - random.range(0.18, 0.32);
    const shape: ArcShape = {
      thetaFrom,
      thetaTo,
      rFrom: random.range(56, 60),
      rMid: random.range(54, 57),
      rTo: random.range(55, 59),
      // The dip lands exactly on the Open Blue's azimuth, so the near pass
      // is a property of every crossing, not a lucky one.
      dipAt: (thetaFrom - OPEN_BLUE_AZIMUTH) / (thetaFrom - thetaTo),
      dipDepth: random.range(2.0, 3.4),
      dipWidth: random.range(0.03, 0.046),
      yPhase: random.range(0, Math.PI * 2),
      yWaves: random.range(0.9, 1.4),
    };

    let total = 0;
    const previous = new Vector3();
    for (let i = 0; i <= SAMPLES; i++) {
      const s = i / SAMPLES;
      const point = this.sample(shape, s);
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
    this.duration = total / LEVIATHAN_SPEED;
  }

  /** The pre-clamp shape of one point: azimuth sweep, radius, height. */
  private sample(shape: ArcShape, s: number): Vector3 {
    // Linear in s on purpose: speed is the arc-length walk's job, and the
    // dip's `dipAt` is solved against exactly this mapping.
    const theta = shape.thetaFrom + (shape.thetaTo - shape.thetaFrom) * s;

    // Radius: far water, easing between the three stations, then the one
    // deliberate dip toward the Open Blue's end wall — never inside 52.
    const base =
      s < 0.5
        ? shape.rFrom + (shape.rMid - shape.rFrom) * smooth01(s * 2)
        : shape.rMid + (shape.rTo - shape.rMid) * smooth01((s - 0.5) * 2);
    const dip = shape.dipDepth * Math.exp(-(((s - shape.dipAt) / shape.dipWidth) ** 2));
    const r = Math.max(MIN_RADIUS + 0.5, base - dip);

    // Height: a long slow breathe inside the 6–10 band.
    const y = 8 + 1.5 * Math.sin(shape.yPhase + shape.yWaves * Math.PI * 2 * s);
    const clamped = Math.min(MAX_HEIGHT - 0.2, Math.max(MIN_HEIGHT + 0.2, y));

    return new Vector3(r * Math.cos(theta), clamped, r * Math.sin(theta));
  }

  /** World position at `s` in [0, 1], walked at constant speed. */
  positionAt(s: number, out: Vector3): Vector3 {
    const target = Math.min(1, Math.max(0, s)) * this.length;
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
    const a = this.positionAt(Math.max(0, s - epsilon), out);
    const bx = new Vector3();
    this.positionAt(Math.min(1, s + epsilon), bx);
    return out.copy(bx).sub(a).normalize();
  }

  /**
   * Roll at `s`: a whisper of bank, eased to nothing at the ends. The dip
   * toward the end wall leans the animal into its one turn, which is where
   * the lantern rows showing over the wing come from.
   */
  bankAt(s: number): number {
    return Math.sin(Math.PI * Math.min(1, Math.max(0, s)));
  }
}
