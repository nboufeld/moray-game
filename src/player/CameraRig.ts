import { Euler, MathUtils, PerspectiveCamera, Vector3 } from "three";
import type { ComfortSettings } from "../accessibility/AccessibilitySettings";
import { DiveController } from "./DiveController";

const MAX_PITCH = MathUtils.degToRad(85);
const MAX_ROLL = MathUtils.degToRad(6);

/**
 * Separates the diver's physical heading from camera comfort options. Bob,
 * roll and auto-levelling can each be toggled independently.
 */
export class CameraRig {
  yaw = 0;
  pitch = 0;

  private bobPhase = 0;
  private roll = 0;
  private readonly euler = new Euler(0, 0, 0, "YXZ");
  private readonly rightDir = new Vector3();
  private readonly forward = new Vector3();

  constructor(readonly camera: PerspectiveCamera) {}

  applyLook(yawDelta: number, pitchDelta: number, sensitivity: number): void {
    this.yaw += yawDelta * sensitivity;
    this.pitch = MathUtils.clamp(this.pitch + pitchDelta * sensitivity, -MAX_PITCH, MAX_PITCH);
  }

  update(dt: number, position: Vector3, velocity: Vector3, comfort: ComfortSettings): void {
    if (comfort.fieldOfView !== this.camera.fov) {
      this.camera.fov = comfort.fieldOfView;
      this.camera.updateProjectionMatrix();
    }

    const speed = velocity.length();

    if (comfort.autoLevel) {
      this.pitch = MathUtils.lerp(this.pitch, 0, Math.min(1, dt * 1.5));
    }

    let bobOffset = 0;
    if (comfort.cameraBob && !comfort.reducedMotion) {
      this.bobPhase += dt * (1.5 + speed * 0.8);
      bobOffset = Math.sin(this.bobPhase) * 0.045 * Math.min(1, speed / 4);
    }

    let targetRoll = 0;
    if (comfort.cameraRoll && !comfort.reducedMotion) {
      DiveController.rightFromYaw(this.yaw, this.rightDir);
      const lateral = velocity.dot(this.rightDir);
      targetRoll = MathUtils.clamp(-lateral * 0.02, -MAX_ROLL, MAX_ROLL);
    }
    this.roll = MathUtils.lerp(this.roll, targetRoll, Math.min(1, dt * 4));

    this.euler.set(this.pitch, this.yaw, this.roll, "YXZ");
    this.camera.quaternion.setFromEuler(this.euler);
    this.camera.position.copy(position);
    this.camera.position.y += bobOffset;
  }

  /** Unit-length world forward direction (ignoring bob/roll noise). */
  getForward(out = this.forward): Vector3 {
    this.euler.set(this.pitch, this.yaw, 0, "YXZ");
    out.set(0, 0, -1).applyEuler(this.euler);
    return out.normalize();
  }
}
