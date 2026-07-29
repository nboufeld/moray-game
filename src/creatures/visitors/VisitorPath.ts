import { Vector3 } from "three";
import type { Random } from "../../util/Random";

/**
 * The shape of one crossing: where it enters, where it leaves, how high it
 * rides and how hard it leans into the turn.
 */
export interface ArcRanges {
  /** Metres from the bowl's centre where a crossing starts and ends. */
  readonly entryRadius: number;
  /** Height band, entry/exit drawn separately from the mid-point. */
  readonly heightMin: number;
  readonly heightMax: number;
  /** How far sideways the mid-point is pulled, which is the bend. */
  readonly bow: number;
  /** Metres per second along the arc. */
  readonly speed: number;
  /** Radians of roll at the deepest point of the turn. */
  readonly bank: number;
}

const SAMPLES = 16;

/**
 * One banked pass across the reef bowl — a quadratic Bézier whose mid-point
 * sits near the bowl's centre, so every crossing actually crosses the stage
 * rather than clipping a corner of it.
 *
 * Everything about the shape is drawn from the `Random` handed in, once, at
 * construction: the path streams (`turtlePath`, `rayPath`) are separate from
 * the schedule's stream precisely so that re-tuning *when* a visitor comes
 * never re-rolls *where* it swims.
 */
export class BankedArc {
  private readonly p0 = new Vector3();
  private readonly p1 = new Vector3();
  private readonly p2 = new Vector3();
  /** +1 leans one way round the turn, -1 the other. */
  private readonly turnSign: number;
  private readonly bank: number;
  readonly duration: number;

  constructor(random: Random, ranges: ArcRanges) {
    const entry = random.range(0, Math.PI * 2);
    // Roughly the opposite side of the bowl, never exactly: a perfect chord
    // through the centre has no turn to bank into.
    const exit = entry + Math.PI + random.signed(0.85);
    const r = ranges.entryRadius;
    this.p0.set(Math.cos(entry) * r, random.range(ranges.heightMin, ranges.heightMax), Math.sin(entry) * r);
    this.p2.set(Math.cos(exit) * r, random.range(ranges.heightMin, ranges.heightMax), Math.sin(exit) * r);

    // The control point starts at the chord's middle pulled in toward the
    // centre, then steps sideways — that sideways step is the whole curve.
    const side = random.next() < 0.5 ? -1 : 1;
    const chordX = this.p2.x - this.p0.x;
    const chordZ = this.p2.z - this.p0.z;
    const chord = Math.hypot(chordX, chordZ) || 1;
    const bow = side * random.range(ranges.bow * 0.5, ranges.bow);
    this.p1.set(
      (this.p0.x + this.p2.x) * 0.25 - (chordZ / chord) * bow,
      random.range(ranges.heightMin, ranges.heightMax),
      (this.p0.z + this.p2.z) * 0.25 + (chordX / chord) * bow,
    );
    this.turnSign = side;
    this.bank = ranges.bank;

    // Arc length by sampling; exact enough to hold the speed steady.
    let length = 0;
    const previous = new Vector3();
    const current = new Vector3();
    this.positionAt(0, previous);
    for (let i = 1; i <= SAMPLES; i++) {
      this.positionAt(i / SAMPLES, current);
      length += current.distanceTo(previous);
      previous.copy(current);
    }
    this.duration = length / ranges.speed;
  }

  /** World position at `s` in [0, 1]. */
  positionAt(s: number, out: Vector3): Vector3 {
    const a = (1 - s) * (1 - s);
    const b = 2 * (1 - s) * s;
    const c = s * s;
    return out.set(
      a * this.p0.x + b * this.p1.x + c * this.p2.x,
      a * this.p0.y + b * this.p1.y + c * this.p2.y,
      a * this.p0.z + b * this.p1.z + c * this.p2.z,
    );
  }

  /** Direction of travel at `s`; unit length. */
  tangentAt(s: number, out: Vector3): Vector3 {
    out.set(
      2 * (1 - s) * (this.p1.x - this.p0.x) + 2 * s * (this.p2.x - this.p1.x),
      2 * (1 - s) * (this.p1.y - this.p0.y) + 2 * s * (this.p2.y - this.p1.y),
      2 * (1 - s) * (this.p1.z - this.p0.z) + 2 * s * (this.p2.z - this.p1.z),
    );
    return out.normalize();
  }

  /**
   * Roll at `s`, eased in from level at the ends: an animal enters flat,
   * leans through the middle of its turn and levels out to leave.
   */
  bankAt(s: number): number {
    return this.turnSign * this.bank * Math.sin(Math.PI * Math.min(1, Math.max(0, s)));
  }
}
