import {
  CanvasTexture,
  Color,
  EquirectangularReflectionMapping,
  FogExp2,
  SRGBColorSpace,
  Vector3,
  type Scene,
  type Texture,
} from "three";
import { Random, SEEDS } from "../util/Random";
import { requestBackdrop } from "./AssetLibrary";
import { readImageRows } from "./ImagePixels";
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
  /**
   * A painted water column to hang behind the world in place of the gradient,
   * if the file is there. The gradient is painted either way and stays up until
   * this lands — and forever if it never does.
   */
  backdropAsset?: string;
}

/** Where the horizon colour sits in the vertical gradient (0 down, 1 up). */
const HORIZON = 0.52;

/**
 * How tall a strip of the painted backdrop the fog colour is averaged from, in
 * image rows, centred on {@link HORIZON}.
 *
 * Wide enough that a brush mark or a stray light band cannot decide the colour
 * of every distant thing in the game, and narrow enough that it is still the
 * horizon it measures: sixteen rows of a 1024-row painting is about a degree
 * and a half of altitude, where the painted column moves by roughly one part in
 * 255 per row.
 */
const HORIZON_ROWS = 16;

/**
 * Where the sun is painted in `backdrop.png`, as a fraction of its width.
 *
 * Measured off the file — the brightest column of its top eighth — rather than
 * guessed, and used to turn the panorama so that its glow sits over the world's
 * actual sun. Without it the painting arrives with the light coming from
 * whichever direction the painter happened to choose, and the water is bright
 * on one side of the frame while the shafts fall on the other.
 */
const PAINTED_SUN_U = 0.287;

/**
 * What the painting is exposed at, in linear light.
 *
 * The panorama arrives painted brighter than this world is lit: its horizon
 * measures #68dbd9, which is very nearly the hue the fog was already tuned to
 * and a little over half a stop above its value. Dropped in as it comes it
 * lifted the canonical shots by twelve parts in 255 at the mean and eighteen at
 * the ninetieth — the water stopped being luminous turquoise and became haze,
 * and every distant rock lost its form into it.
 *
 * The fix has to be a *single* number applied to both sides, and this is it:
 * three multiplies the background by `backgroundIntensity` in linear light, and
 * the colour sampled off the same painting is multiplied by the same figure
 * before it becomes the fog. The horizon therefore still cannot band — the two
 * quantities are one quantity — while the frame keeps the value key WP-G1 set.
 * At 0.64 the derived fog lands within a part of the `0x53b2bb` it replaces on
 * every channel, which is the measurement that says the painter and the tuning
 * agreed about the *colour* all along and differed only about the exposure.
 */
const BACKDROP_EXPOSURE = 0.64;

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
  private readonly backdropAsset: string | undefined;

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
    this.backdropAsset = options.backdropAsset;
  }

  applyTo(scene: Scene): void {
    const fog = new FogExp2(this.color.getHex(), this.density);
    fog.color.copy(this.color);
    scene.fog = fog;

    // Falls back to a flat backdrop where there is no DOM to paint into, which
    // is how the scene classes stay constructible in plain Node unit tests.
    const gradient = this.createGradient();
    scene.background = gradient ?? this.color.clone().multiplyScalar(0.6);

    if (this.backdropAsset !== undefined) {
      requestBackdrop(this.backdropAsset, (texture) => {
        this.adoptBackdrop(scene, texture, gradient);
      });
    }
  }

  /**
   * Hangs the painting behind the world and makes the water agree with it.
   *
   * The agreement is the point, and it is why the fog colour is *read off the
   * painting* rather than left as a number someone matched by eye. Fog fades
   * distant geometry toward `scene.fog.color`; the pixels behind it come from
   * the backdrop. Where those two differ the seabed ends on a visible line, and
   * a painted backdrop is exactly the case where they drift apart — the file
   * can be repainted without anyone thinking to re-pick the fog. Sampling the
   * horizon strip makes the two the same quantity by construction, so the
   * horizon cannot band however the panorama is repainted.
   *
   * Both sides of that claim have to be in the same space for it to hold, and
   * they are: the whole scene renders into a linear render target, where the
   * background is the decoded painting and fogged geometry approaches the fog
   * colour, and the tone curve and the grade run afterwards over both alike.
   * A colour read as sRGB and set as linear is therefore the exact match, and
   * WP-G5's pooling — which takes its pigment off `scene.fog` every frame —
   * picks the new water up on the next frame with nothing to plumb.
   */
  private adoptBackdrop(scene: Scene, texture: Texture, gradient: CanvasTexture | null): void {
    const horizon = this.sampleHorizon(texture)?.multiplyScalar(BACKDROP_EXPOSURE);
    if (horizon) {
      this.color.copy(horizon);
      scene.fog?.color.copy(horizon);
    }

    scene.background = texture;
    scene.backgroundIntensity = BACKDROP_EXPOSURE;
    // The painted sun is turned onto the real one. `equirectUv` measures
    // azimuth as atan2(z, x) and three negates the background rotation before
    // handing it to the shader, so the sampled azimuth is the view's plus this.
    const sunAzimuth = Math.atan2(this.sunDirection.z, this.sunDirection.x);
    scene.backgroundRotation.y = (PAINTED_SUN_U - 0.5) * Math.PI * 2 - sunAzimuth;

    // The gradient it replaces has no other owner and will never be shown again.
    gradient?.dispose();
  }

  /**
   * The painting's own colour at the horizon, averaged over a strip.
   *
   * Image rows run down from the top and the backdrop is uploaded flipped — a
   * panorama's `v` is altitude, so the loader's default flip is what puts the
   * painted surface overhead — which is why the row is measured from the top
   * as `1 - HORIZON`.
   */
  private sampleHorizon(texture: Texture): Color | null {
    const height: unknown = (texture.image as { height?: unknown } | null)?.height;
    if (typeof height !== "number") {
      return null;
    }

    const pixels = readImageRows(
      texture,
      (1 - HORIZON) * height - HORIZON_ROWS / 2,
      HORIZON_ROWS,
    );
    if (!pixels || pixels.width === 0 || pixels.height === 0) {
      return null;
    }

    let r = 0;
    let g = 0;
    let b = 0;
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i] ?? 0;
      g += data[i + 1] ?? 0;
      b += data[i + 2] ?? 0;
    }

    const count = data.length / 4;
    // Averaged in the space it was painted in, then handed over as sRGB so the
    // conversion into the linear working space is three's own.
    return new Color().setRGB(r / count / 255, g / count / 255, b / count / 255, SRGBColorSpace);
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
