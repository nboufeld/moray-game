import {
  CanvasTexture,
  Color,
  EquirectangularReflectionMapping,
  FogExp2,
  SRGBColorSpace,
  Vector3,
  type Scene,
} from "three";
import { Random, SEEDS } from "../util/Random";
import { SUN_POSITION } from "./Lighting";

export interface UnderwaterFogOptions {
  /** Deep water tint the fog fades toward, and the colour at the horizon. */
  color?: number;
  /** Exponential fog density. */
  density?: number;
  /** Bright water looking up toward the surface. */
  surfaceColor?: number;
  /** The deepest water in the world — the darkest note, and still luminous. */
  abyssColor?: number;
  /** Which way the light arrives from, so the backdrop can brighten toward it. */
  sunDirection?: Vector3;
}

/** Where the horizon colour sits in the vertical gradient (0 down, 1 up). */
const HORIZON = 0.52;

/**
 * Wide enough to resolve a smooth horizontal lobe. It used to be 8 columns,
 * which is all a purely vertical gradient plus dither ever needed.
 */
const WIDTH = 64;
const HEIGHT = 256;

/**
 * The sun's near glow and the much broader haze around it, as half-widths in
 * radians of azimuth, with the multiplier each applies to the surface colour.
 *
 * Two lobes rather than one because they answer different questions. The narrow
 * one is the glare you look into when you turn toward the sun. The wide one is
 * why, with the sun off behind your shoulder, the water on that side of the
 * frame is still perceptibly brighter than the water on the other — which is
 * the read that tells the eye where the light is coming from in every shot, not
 * just the one that happens to face the sun.
 */
const SUN_LOBE = 0.7;
const SUN_GAIN = 1.6;
const HAZE_LOBE = 2.4;
const HAZE_GAIN = 1.24;

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function smoothstep01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

/** A cos² falloff over `halfWidth`, flat at the peak and zero at the edge. */
function lobe(delta: number, halfWidth: number): number {
  if (delta >= halfWidth) {
    return 0;
  }
  const c = Math.cos((delta / halfWidth) * (Math.PI / 2));
  return c * c;
}

/** Shortest angular distance between two azimuths, in [0, π]. */
function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}

/** sRGB bytes, which is the space the gradient is interpolated and written in. */
function bytes(color: Color): [number, number, number] {
  const hex = color.getHex(SRGBColorSpace);
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

/**
 * Depth-coloured exponential fog plus a matching gradient backdrop. The two
 * have to agree: fog fades distant geometry toward `color`, so if the backdrop
 * behind it is any other shade the seabed terminates on a hard horizon line
 * instead of dissolving into the water. This carries most of the "remembered
 * ocean" atmosphere cheaply, without volumetric rendering.
 *
 * The fog colour sits *above* the midtone most of the reef occupies, which is
 * how distance reads in a painted background rather than in a photograph:
 * geometry does not sink into a dark, cold deep, it dissolves upward into
 * milky turquoise light. Range is still unambiguous — a rock thirty metres out
 * has lost nearly all its contrast and all its local colour — but the frame
 * never gains a dark corner in the process, which is the whole value plan.
 */
export class UnderwaterFog {
  readonly color: Color;
  readonly density: number;
  private readonly surfaceColor: Color;
  private readonly abyssColor: Color;
  private readonly sunDirection: Vector3;

  constructor(options: UnderwaterFogOptions = {}) {
    // Every one of these carries far more red than a photograph of this water
    // would. That is the difference between a turquoise mixed from pigment and
    // one left over from a blue channel: with red near zero the water is an
    // electric cyan that no paint box contains, and the whole frame goes
    // plastic. Read the red first when retuning any of them.
    this.color = new Color(options.color ?? 0x53b2bb);
    this.density = options.density ?? 0.028;
    this.surfaceColor = new Color(options.surfaceColor ?? 0xd4f4ea);
    this.abyssColor = new Color(options.abyssColor ?? 0x2b7f91);
    this.sunDirection = (options.sunDirection ?? SUN_POSITION).clone().normalize();
  }

  applyTo(scene: Scene): void {
    scene.fog = new FogExp2(this.color.getHex(), this.density);
    // Falls back to a flat backdrop where there is no DOM to paint into, which
    // is how the scene classes stay constructible in plain Node unit tests.
    scene.background = this.createGradient() ?? this.color.clone().multiplyScalar(0.6);
  }

  /**
   * An equirectangular strip: cheap, and three stretches it around the whole
   * sky so the water column reads brighter overhead and brighter still toward
   * the sun.
   */
  private createGradient(): CanvasTexture | null {
    if (typeof document === "undefined") {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      this.paint(ctx);
    }

    const texture = new CanvasTexture(canvas);
    texture.mapping = EquirectangularReflectionMapping;
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }

  private paint(ctx: CanvasRenderingContext2D): void {
    const surface = bytes(this.surfaceColor);
    const horizon = bytes(this.color);
    const abyss = bytes(this.abyssColor);

    // `equirectUv` in three maps a direction to u as atan2(z, x), so the lobe
    // has to be centred on the same measure. Read off the sun vector rather
    // than written down, so moving the sun moves its glow with it.
    const sunAzimuth = Math.atan2(this.sunDirection.z, this.sunDirection.x);

    // Canvas y runs top-down and equirectangular v runs bottom-up, so the
    // surface colour belongs at y = 0.
    const image = ctx.createImageData(WIDTH, HEIGHT);
    const random = new Random(SEEDS.fogDither);
    const channel = [0, 0, 0];

    for (let y = 0; y < HEIGHT; y++) {
      const t = y / (HEIGHT - 1);
      // Above the horizon the ramp runs surface → horizon; below it continues
      // horizon → abyss.
      const up = t < 1 - HORIZON;
      const from = up ? surface : horizon;
      const to = up ? horizon : abyss;
      const k = up ? t / (1 - HORIZON) : (t - (1 - HORIZON)) / HORIZON;
      // The sun's contribution lives in the water overhead and is gone by the
      // horizon; carrying it lower turns the lobe into a visible disc pasted
      // onto the sky rather than light coming down through the surface.
      const overhead = 1 - smoothstep01(t / (1 - HORIZON));

      for (let x = 0; x < WIDTH; x++) {
        const azimuth = ((x + 0.5) / WIDTH - 0.5) * Math.PI * 2;
        const delta = angleBetween(azimuth, sunAzimuth);
        const gain =
          (lobe(delta, SUN_LOBE) * (SUN_GAIN - 1) + lobe(delta, HAZE_LOBE) * (HAZE_GAIN - 1)) *
          overhead;

        // A smooth ramp stretched across the whole sky is exactly the case that
        // bands on 8-bit output. A pixel of per-row jitter breaks the contours
        // apart into noise the eye reads as water rather than as steps.
        const jitter = Math.round(random.range(-1.5, 1.5));
        for (let c = 0; c < 3; c++) {
          const base = (from[c] ?? 0) + ((to[c] ?? 0) - (from[c] ?? 0)) * k;
          channel[c] = clampByte(Math.round(base + (surface[c] ?? 0) * gain) + jitter);
        }

        const index = (y * WIDTH + x) * 4;
        image.data[index] = channel[0] ?? 0;
        image.data[index + 1] = channel[1] ?? 0;
        image.data[index + 2] = channel[2] ?? 0;
        image.data[index + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
  }
}
