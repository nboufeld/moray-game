import { Color, FogExp2, type Scene } from "three";

export interface UnderwaterFogOptions {
  /** Deep water tint the fog fades toward. */
  color?: number;
  /** Exponential fog density. */
  density?: number;
}

/**
 * Depth-coloured exponential fog plus a matching background. This carries most
 * of the "remembered ocean" atmosphere cheaply, without volumetric rendering.
 */
export class UnderwaterFog {
  readonly color: Color;
  readonly density: number;

  constructor(options: UnderwaterFogOptions = {}) {
    this.color = new Color(options.color ?? 0x0f5f6e);
    this.density = options.density ?? 0.035;
  }

  applyTo(scene: Scene): void {
    scene.fog = new FogExp2(this.color.getHex(), this.density);
    scene.background = this.color.clone().multiplyScalar(0.55);
  }
}
