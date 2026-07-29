import {
  CanvasTexture,
  Color,
  EquirectangularReflectionMapping,
  FogExp2,
  LinearFilter,
  SRGBColorSpace,
  Vector3,
  type Scene,
  type Texture,
} from "three";
import { Random, SEEDS } from "../util/Random";
import { ABYSS_FOG, abyssMood, onSceneRender } from "../world/Abyss";
import { wingMoodAt } from "../world/wings/WingField";
import type { WingMoodTables } from "../world/wings/WingTypes";
import { requestBackdrop } from "./AssetLibrary";
import { readImage, readImageRows, textureFromPixels } from "./ImagePixels";
import { SUN_POSITION } from "./Lighting";
import type { WeatherMoods } from "./WeatherMoods";

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
 * The fix has to be a *single* number applied to both sides, and this is it:
 * three multiplies the background by `backgroundIntensity` in linear light, and
 * the colour sampled off the same painting is multiplied by the same figure
 * before it becomes the fog. The horizon therefore cannot band — the two
 * quantities are one quantity — however the panorama is exposed or repainted.
 *
 * It was 0.64, and that figure was doing a job this painting no longer needs
 * done. The first panorama was flat: its column ran 101 to 141 in red between
 * the horizon and thirty degrees up, so the whole sky was one bright haze half
 * a stop above the reef, and 0.64 was the amount of pulling-down that took its
 * horizon back to the `0x53b2bb` WP-G1 had tuned by hand. Applied to a *flat*
 * image, an exposure is a brightness control and nothing else.
 *
 * The repaint has range — 64 at the horizon to 155 thirty degrees up, against a
 * whole-image p10/p50/p90 of 63/159/240 — so the same multiply now decides how
 * much of that range survives, and pulling it down by a third spends the range
 * before anyone sees it. Measured against the old painting's derived fog, the
 * new horizon strip asks for 0.858 in green and 0.783 in blue; 0.85 lands the
 * fog's green *exactly* on the value the reef has always had and its blue seven
 * parts over. What that buys is above the horizon rather than at it: the upper
 * third of shots A and B stops being a flat turquoise field and becomes water
 * with light coming down through it.
 *
 * Red is the channel to watch and the one that does not agree — the painter's
 * horizon is a cooler cyan than the old one, so at 0.85 the fog would carry 66
 * parts of red where it used to carry 83. That is the direction AGENTS.md's
 * value key warns about and it did go wrong, though not where it was expected
 * to; {@link RED_PEDESTAL} is the answer and the whole of it. With that in
 * place the canonical shots sit within a few parts of the last frame the value
 * key was signed off on — A +1.5 at the luma mean, B -1.4, C +2.5, with every
 * channel mean inside four — and what has moved is the ninetieth percentile of
 * blue, +10, which is the surface glow arriving and nothing else.
 *
 * The deep zone of the file drops red to 1 in 255 and it is never drawn: it
 * lies below 34° of depression, where a camera two metres over the sand is
 * looking at sand. That was the failure this package went looking for and it
 * is not the one that was there.
 */
const BACKDROP_EXPOSURE = 0.85;

/**
 * The pedestal the painting's red channel is lifted onto, in sRGB bytes, before
 * anything reads it.
 *
 * This is the one correction allowed to the panorama's *hue*, and it exists
 * because of a specific piece of arithmetic downstream rather than because the
 * painter mixed the wrong colour. Three's neutral tone curve begins by
 * subtracting `x - 6.25x²` from every channel, where `x` is the *smallest* of
 * the three. On a turquoise frame the smallest is always red, and the
 * subtraction is close to total while red is small: at 0.02 of linear light it
 * removes seven eighths of it. So the tone curve is a black-point crush aimed
 * squarely at the one channel AGENTS.md's value key says to read first, and the
 * deeper the cyan the harder it pulls.
 *
 * The old panorama never got near it — its horizon carried 103 parts of red.
 * The repaint's horizon carries 71, which lands the water above the skyline
 * inside the crush: measured on shot A, that band rendered at rgb(15, 175, 186)
 * and 2.5% of the frame came out under 25 parts of red against 0.06% before.
 * That is the electric poster-paint cyan the key describes, and it is visible —
 * put the same crop from the two runs one above the other and the pigment has
 * gone out of the water.
 *
 * The remap is the crush read backwards: an affine lift that takes 0 to this
 * and leaves 255 alone, so it is largest exactly where the curve's subtraction
 * is largest and fades to nothing in the bright water overhead. It preserves
 * order, so every gradient the painter put in the red channel survives, and it
 * is applied to the *image* rather than to the fog — which is what keeps the
 * two one quantity, since the horizon strip is sampled from the lifted copy.
 *
 * 28 was reached from both ends. The knee says it: at 20 the same band still
 * measured 0.070 of linear red going into the curve, inside the `x < 0.08`
 * window where the subtraction is quadratic rather than the flat 0.04 it
 * becomes above, and 28 is what clears it. So does the frame — 20 took the
 * water above the horizon from 67 back to 77 parts of red and 28 takes it to
 * 82, against 86 in the frame this is being held to, and the share of the shot
 * under 25 parts of red goes 2.475% → 0.112% → 0.056% against that frame's own
 * 0.058%. Higher than this is not free, and the reason is the fog rather than
 * the sky: the horizon strip is sampled off the lifted copy, so every part of
 * this lift lands on every fogged surface in the reef as well. Past the knee
 * that is no longer correcting anything — it is warming the distance, which is
 * a decision about the water and belongs in the water's own colour.
 */
const RED_PEDESTAL = 28;

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
 * Columns blended on each side of the panorama's wrap join, and the vertical
 * window (in rows) the join's mismatch is smoothed over before it is used.
 *
 * The join is the seam fix (W-N4). The painting's left and right edges do not
 * agree — measured off the file, they differ by 36 parts of red at the zenith
 * rows and six to ten parts of green and blue down the whole water column,
 * against an interior column-to-column step of well under one part — and an
 * equirectangular background puts that join *somewhere* in every panning
 * frame. With the backdrop turned so its painted sun sits over the world's
 * (−1.9912 rad), the join lands at azimuth −1.15 rad, which shot A's yaw-0
 * fov-70 camera projects to x = 1087 of 1600: the hard vertical line in the
 * open water of A, F, W and Y, standing still while the fish swim past it.
 * It was diagnosed as a colour *step* rather than an additive mark — red
 * falls across it while green and blue rise, which no shaft can do.
 *
 * The seal is a per-row cross-ramp: each row's low-frequency edge mismatch
 * (edge means over {@link WRAP_EDGE_COLS} columns, smoothed vertically over
 * {@link WRAP_SMOOTH_ROWS} rows so the painting's grain cannot streak) is
 * split between the two sides, fading linearly to nothing {@link WRAP_BLEND}
 * columns in. The two edges then meet at their mutual average and the join is
 * a gradient spread over 8° of azimuth instead of a step at one column. Every
 * pixel outside the two ramps is untouched, and the horizon strip the fog is
 * sampled from moves by under a part in ten thousand — the ramps are 4.7% of
 * its width and shift it by half a mismatch each, in opposite directions.
 */
const WRAP_BLEND = 48;
const WRAP_EDGE_COLS = 4;
const WRAP_SMOOTH_ROWS = 15;

/**
 * Cross-fades the panorama's wrap join closed, in place. Runs after the red
 * lift so the values it reconciles are the values the GPU will sample.
 */
function sealWrap(pixels: ImageData): void {
  const { width, height, data } = pixels;
  if (width <= WRAP_BLEND * 2) {
    return;
  }

  // Per-row mismatch, left edge minus right edge, from a few columns of mean.
  const mismatch = new Float32Array(height * 3);
  for (let y = 0; y < height; y++) {
    for (let c = 0; c < 3; c++) {
      let left = 0;
      let right = 0;
      for (let k = 0; k < WRAP_EDGE_COLS; k++) {
        left += data[(y * width + k) * 4 + c] ?? 0;
        right += data[(y * width + (width - 1 - k)) * 4 + c] ?? 0;
      }
      mismatch[y * 3 + c] = (left - right) / WRAP_EDGE_COLS;
    }
  }

  // Smoothed vertically: the correction is a shift by a smooth field, so the
  // grain of one edge can never print onto the other as horizontal streaks.
  const half = (WRAP_SMOOTH_ROWS - 1) / 2;
  const smoothed = new Float32Array(height * 3);
  for (let y = 0; y < height; y++) {
    const from = Math.max(0, y - half);
    const to = Math.min(height - 1, y + half);
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let k = from; k <= to; k++) {
        sum += mismatch[k * 3 + c] ?? 0;
      }
      smoothed[y * 3 + c] = sum / (to - from + 1);
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < WRAP_BLEND; x++) {
      // 1 at the edge column, 0 one column past the ramp.
      const ramp = 1 - x / WRAP_BLEND;
      const leftIndex = (y * width + x) * 4;
      const rightIndex = (y * width + (width - 1 - x)) * 4;
      for (let c = 0; c < 3; c++) {
        const shift = ((smoothed[y * 3 + c] ?? 0) / 2) * ramp;
        data[leftIndex + c] = (data[leftIndex + c] ?? 0) - shift;
        data[rightIndex + c] = (data[rightIndex + c] ?? 0) + shift;
      }
    }
  }
}

/**
 * The panorama with its red channel stood on {@link RED_PEDESTAL} and its
 * wrap join sealed (see {@link sealWrap}).
 *
 * Memoised, because this is two megapixels of arithmetic and a second upload:
 * the copy is what gets hung, so the texture the library loaded is read once
 * here and never reaches the GPU at all. Nothing disposes either — the source
 * belongs to the library and is shared by path, and the copy outlives every
 * scene that could ask for it, exactly as the sand wash's opened tile does.
 *
 * Without a DOM there is nothing to remap into and the painting is used as
 * loaded, which cannot happen in practice — nothing loads at all without a
 * `window` — but is what keeps this a pure function of its input.
 */
let liftedBackdrop: Texture | undefined;
function liftRed(texture: Texture): Texture {
  if (liftedBackdrop) {
    return liftedBackdrop;
  }

  const pixels = readImage(texture);
  if (!pixels) {
    return texture;
  }

  const data = pixels.data;
  const gain = (255 - RED_PEDESTAL) / 255;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = RED_PEDESTAL + (data[i] ?? 0) * gain;
  }
  sealWrap(pixels);

  const lifted = textureFromPixels(pixels, texture);
  if (!lifted) {
    return texture;
  }
  // The one property `textureFromPixels` cannot carry: it copies the sampling a
  // surface map needs, and this is not a surface. Without it three would treat
  // the panorama as a flat UV texture and the sky would be one stretched pixel.
  lifted.mapping = EquirectangularReflectionMapping;
  // No mipmaps, and this is the other half of the seam fix: equirect UVs jump
  // from 1 back to 0 along one screen column, the rasteriser reads that as a
  // derivative of the whole texture width and samples the smallest mip, and
  // that column renders as the panorama's global average — a one-pixel line
  // no amount of pixel sealing can touch. Measured after the seal: a residual
  // two-part red step at the join, gone with the mips. The painting is never
  // minified anywhere a camera can look (2048 columns over 360° is magnified
  // ~2.7× at fov 70 on a 1600px frame), so the mips bought nothing anyway.
  lifted.generateMipmaps = false;
  lifted.minFilter = LinearFilter;
  liftedBackdrop = lifted;
  return lifted;
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
  /** What the backdrop renders at with no twilight over it; see `applyTo`. */
  private backgroundLevel = 1;
  private readonly twilight = new Color();
  /** The sky's slow moods (W-M1); null — and identity — everywhere but the reef. */
  private weather: WeatherMoods | null = null;
  private readonly weatherBase = new Color();

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

  /**
   * Opts this water into the sky's slow moods (W-M1). Only the reef attaches;
   * the sanctuary's fog never sees weather, so the room keeps its own noon —
   * the same "not a different ocean, but not this one's sky" line WP-G6 drew
   * when the room declined the painted backdrop.
   */
  attachWeather(weather: WeatherMoods): void {
    this.weather = weather;
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

    // W-M3: the twilight, as a function of where the camera is. Runs at the
    // top of every render, before the render lists or the background, so the
    // whole frame sees one consistent water — and at a mood of exactly zero,
    // which is everywhere the bowl is playable, it writes the base values
    // back verbatim: no lerp, no drift, and every in-bowl capture renders
    // through arithmetic this hook never touches. The base is read live off
    // `this.color`/`this.density` rather than snapshotted, because
    // `adoptBackdrop` re-derives the colour when the painting lands.
    //
    // Everything downstream follows for free: WP-G5's pooling reads
    // `scene.fog` each frame, and `DistantReef` and the canyon's own curtains
    // re-mix their inks from it — so the whole painted distance turns violet
    // with the water and turns back, with nothing plumbed.
    // W-M1 layers the sky's slow moods over the same hook: the weather
    // *scales the base* — colour, density, backdrop level — and the twilight
    // then modulates the scaled base, exactly as it always modulated the
    // shipped one. Time and place are two channels over one quantity, so the
    // canyon at golden hour is the golden water taken down into twilight and
    // there is no second writer to fight. With no weather attached (the
    // sanctuary, the unit tests) or at the identity mood — which is the whole
    // opening stretch of every dive — the branch below is not entered and the
    // arithmetic is W-M3's to the character.
    onSceneRender(scene, (camera) => {
      const position = camera.position;
      const mood = abyssMood(position.x, position.y, position.z);
      const weather =
        this.weather !== null && !this.weather.isIdentity ? this.weather.channels : null;
      let base = this.color;
      let density = this.density;
      let level = this.backgroundLevel;
      if (weather !== null) {
        base = this.weatherBase.setRGB(
          this.color.r * weather.fogRed,
          this.color.g * weather.fogGreen,
          this.color.b * weather.fogBlue,
        );
        density = this.density * weather.fogDensity;
        level = this.backgroundLevel * weather.backdrop;
      }

      // Wave 8: the wings are the same channel as the twilight — a place
      // mood over the weather-scaled base, one writer, one arithmetic. The
      // canyon and the wings are azimuthally disjoint by construction, so at
      // most one of them is nonzero and the canyon's own numbers pass
      // through this branch untouched. At zero everywhere — the whole bowl —
      // the base is written back verbatim, exactly as W-M3 shipped it.
      let placeMood = mood;
      let tables: WingMoodTables["fog"] = ABYSS_FOG;
      if (placeMood === 0) {
        const wing = wingMoodAt(position.x, position.y, position.z);
        if (wing !== null) {
          placeMood = wing.mood;
          tables = wing.tables.fog;
        }
      }

      fog.color.copy(base);
      if (placeMood === 0) {
        fog.density = density;
        scene.backgroundIntensity = level;
        return;
      }
      const [r, g, b] = tables.colorScale;
      this.twilight.setRGB(r, g, b).multiply(base);
      fog.color.lerp(this.twilight, placeMood);
      // Wings may *clear* the water (negative gain); the floor keeps a fog.
      fog.density = Math.max(0.004, density + tables.densityGain * placeMood);
      scene.backgroundIntensity = level * (1 - tables.backdropFade * placeMood);
    });
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
    // The lift first, and everything downstream reads the lifted copy — the
    // background the player sees and the strip the fog is averaged from are the
    // same pixels, which is the invariant this whole method exists to keep.
    const painting = liftRed(texture);
    const horizon = this.sampleHorizon(painting)?.multiplyScalar(BACKDROP_EXPOSURE);
    if (horizon) {
      this.color.copy(horizon);
      scene.fog?.color.copy(horizon);
    }

    scene.background = painting;
    scene.backgroundIntensity = BACKDROP_EXPOSURE;
    // The twilight hook scales the backdrop from this level, so it has to
    // know what "no twilight" renders at once the painting owns the sky.
    this.backgroundLevel = BACKDROP_EXPOSURE;
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
