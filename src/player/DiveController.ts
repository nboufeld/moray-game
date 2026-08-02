import { Vector3 } from "three";

export interface DiveInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  ascend: boolean;
  descend: boolean;
}

export const NO_INPUT: DiveInput = {
  forward: false,
  back: false,
  left: false,
  right: false,
  ascend: false,
  descend: false,
};

export interface DiveControllerOptions {
  acceleration?: number;
  maxSpeed?: number;
  /** Linear drag coefficient (higher = the diver glides to a stop faster). */
  drag?: number;
  startPosition?: Vector3;
}

/**
 * Kinematic swimming with acceleration, drag and separate vertical control.
 * Deliberately free of rendering concerns so the feel can be unit tested.
 */
export class DiveController {
  readonly position = new Vector3(0, 2, 14);
  readonly velocity = new Vector3(0, 0, 0);

  acceleration: number;
  maxSpeed: number;
  drag: number;

  private readonly wish = new Vector3();
  private readonly forwardDir = new Vector3();
  private readonly rightDir = new Vector3();

  constructor(options: DiveControllerOptions = {}) {
    this.acceleration = options.acceleration ?? 22;
    this.maxSpeed = options.maxSpeed ?? 8;
    this.drag = options.drag ?? 2.6;
    if (options.startPosition) {
      this.position.copy(options.startPosition);
    }
  }

  /** Horizontal forward direction for a given yaw (radians, 0 faces -Z). */
  static forwardFromYaw(yaw: number, out = new Vector3()): Vector3 {
    return out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  }

  /** Horizontal right direction for a given yaw. */
  static rightFromYaw(yaw: number, out = new Vector3()): Vector3 {
    return out.set(Math.cos(yaw), 0, -Math.sin(yaw));
  }

  /**
   * Wave 8: swim where you look. When `lookForward` is given (the camera
   * rig's true forward, pitch included), the forward/back axis follows it —
   * look up and swim forward to rise, look down to descend — so the whole
   * ocean is reachable without ever touching Space or Shift. Strafing stays
   * on the horizontal, which is what keeps a lateral dodge from also being
   * a dive; and the vertical keys still add their axis for anyone who wants
   * them. Omitted (older tests, probes), the behaviour is exactly the
   * shipped yaw-planar swim.
   */
  update(dt: number, input: DiveInput, yaw: number, lookForward?: Vector3): void {
    if (dt <= 0) {
      return;
    }

    if (lookForward) {
      this.forwardDir.copy(lookForward).normalize();
    } else {
      DiveController.forwardFromYaw(yaw, this.forwardDir);
    }
    DiveController.rightFromYaw(yaw, this.rightDir);

    const forwardAxis = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const strafeAxis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const verticalAxis = (input.ascend ? 1 : 0) - (input.descend ? 1 : 0);

    this.wish.set(0, 0, 0);
    this.wish.addScaledVector(this.forwardDir, forwardAxis);
    this.wish.addScaledVector(this.rightDir, strafeAxis);
    this.wish.y += verticalAxis;

    if (this.wish.lengthSq() > 1) {
      this.wish.normalize();
    }

    this.velocity.addScaledVector(this.wish, this.acceleration * dt);

    // Exponential drag keeps the glide gentle and frame-rate independent-ish.
    const dragFactor = Math.max(0, 1 - this.drag * dt);
    this.velocity.multiplyScalar(dragFactor);

    const speed = this.velocity.length();
    if (speed > this.maxSpeed) {
      this.velocity.multiplyScalar(this.maxSpeed / speed);
    }

    this.position.addScaledVector(this.velocity, dt);
  }
}
