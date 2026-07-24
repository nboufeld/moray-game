import type { DiveInput } from "./DiveController";

export interface LookDelta {
  yaw: number;
  pitch: number;
}

/**
 * Keyboard + mouse input. Movement uses WASD, vertical uses Space/Shift.
 * Looking works with either the arrow keys (very reliable, gamepad-friendly)
 * or pointer-locked mouse movement. Discrete actions are exposed as callbacks.
 */
export class InputController {
  private readonly keys = new Set<string>();
  private mouseYaw = 0;
  private mousePitch = 0;
  private pointerLocked = false;

  readonly onToggleCodex: (() => void)[] = [];
  readonly onRequestHint: (() => void)[] = [];

  private readonly keyTurnRate = 1.8; // radians / second
  private readonly mouseSensitivity = 0.0022;

  constructor(private readonly target: HTMLElement) {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.target.addEventListener("click", this.requestPointerLock);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
    document.addEventListener("mousemove", this.handleMouseMove);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.target.removeEventListener("click", this.requestPointerLock);
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
    document.removeEventListener("mousemove", this.handleMouseMove);
  }

  get diveInput(): DiveInput {
    return {
      forward: this.keys.has("keyw"),
      back: this.keys.has("keys"),
      left: this.keys.has("keya"),
      right: this.keys.has("keyd"),
      ascend: this.keys.has("space"),
      descend: this.keys.has("shiftleft") || this.keys.has("shiftright"),
    };
  }

  /** Consumes and returns accumulated look delta for this frame. */
  consumeLook(dt: number): LookDelta {
    let yaw = this.mouseYaw;
    let pitch = this.mousePitch;
    this.mouseYaw = 0;
    this.mousePitch = 0;

    if (this.keys.has("arrowleft")) yaw += this.keyTurnRate * dt;
    if (this.keys.has("arrowright")) yaw -= this.keyTurnRate * dt;
    if (this.keys.has("arrowup")) pitch += this.keyTurnRate * dt;
    if (this.keys.has("arrowdown")) pitch -= this.keyTurnRate * dt;

    return { yaw, pitch };
  }

  private readonly requestPointerLock = (): void => {
    if (!this.pointerLocked) {
      void this.target.requestPointerLock?.();
    }
  };

  private readonly handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.target;
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.pointerLocked) {
      return;
    }
    this.mouseYaw -= event.movementX * this.mouseSensitivity;
    this.mousePitch -= event.movementY * this.mouseSensitivity;
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const code = event.code.toLowerCase();
    if (MOVEMENT_CODES.has(code) || LOOK_CODES.has(code)) {
      event.preventDefault();
    }
    if (code === "keyc") {
      this.onToggleCodex.forEach((fn) => fn());
      return;
    }
    if (code === "keyh") {
      this.onRequestHint.forEach((fn) => fn());
      return;
    }
    this.keys.add(code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code.toLowerCase());
  };
}

const MOVEMENT_CODES = new Set([
  "keyw",
  "keya",
  "keys",
  "keyd",
  "space",
  "shiftleft",
  "shiftright",
]);

const LOOK_CODES = new Set(["arrowleft", "arrowright", "arrowup", "arrowdown"]);
