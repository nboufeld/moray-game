import {
  CanvasTexture,
  Color,
  EquirectangularReflectionMapping,
  FogExp2,
  SRGBColorSpace,
  type Scene,
} from "three";

export interface UnderwaterFogOptions {
  /** Deep water tint the fog fades toward, and the colour at the horizon. */
  color?: number;
  /** Exponential fog density. */
  density?: number;
  /** Bright water looking up toward the surface. */
  surfaceColor?: number;
  /** The dark below, where the light has stopped reaching. */
  abyssColor?: number;
}

/** Where the horizon colour sits in the vertical gradient (0 down, 1 up). */
const HORIZON = 0.52;

/**
 * Depth-coloured exponential fog plus a matching gradient backdrop. The two
 * have to agree: fog fades distant geometry toward `color`, so if the backdrop
 * behind it is any other shade the seabed terminates on a hard horizon line
 * instead of dissolving into the water. This carries most of the "remembered
 * ocean" atmosphere cheaply, without volumetric rendering.
 */
export class UnderwaterFog {
  readonly color: Color;
  readonly density: number;
  private readonly surfaceColor: Color;
  private readonly abyssColor: Color;

  constructor(options: UnderwaterFogOptions = {}) {
    this.color = new Color(options.color ?? 0x11596a);
    this.density = options.density ?? 0.032;
    this.surfaceColor = new Color(options.surfaceColor ?? 0x4fc3d9);
    this.abyssColor = new Color(options.abyssColor ?? 0x05202b);
  }

  applyTo(scene: Scene): void {
    scene.fog = new FogExp2(this.color.getHex(), this.density);
    // Falls back to a flat backdrop where there is no DOM to paint into, which
    // is how the scene classes stay constructible in plain Node unit tests.
    scene.background = this.createGradient() ?? this.color.clone().multiplyScalar(0.6);
  }

  /**
   * A one-pixel-wide equirectangular strip: cheap, and three stretches it
   * around the whole sky so the water column reads brighter overhead.
   */
  private createGradient(): CanvasTexture | null {
    if (typeof document === "undefined") {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Canvas y runs top-down and equirectangular v runs bottom-up, so the
      // surface colour belongs at y = 0.
      const gradient = ctx.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, `#${this.surfaceColor.getHexString()}`);
      gradient.addColorStop(1 - HORIZON, `#${this.color.getHexString()}`);
      gradient.addColorStop(1, `#${this.abyssColor.getHexString()}`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1, 256);
    }

    const texture = new CanvasTexture(canvas);
    texture.mapping = EquirectangularReflectionMapping;
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }
}
