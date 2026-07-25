import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
  type Camera,
  type Scene,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ColorGradeShader } from "../rendering/ColorGradeShader";

/** How far below display resolution the bloom mips are rendered. */
const BLOOM_DIVISOR = 4;

/** Multisampling on the composer targets. WebGL2 is a given here. */
const MSAA_SAMPLES = 4;

/** Frame budget either side of which the internal resolution is adjusted. */
const SLOW_FRAME_MS = 30;
const FAST_FRAME_MS = 18;
/**
 * Low enough that a machine with no hardware acceleration still reaches an
 * interactive frame time. A blurry reef that responds is worth more than a
 * sharp one at three frames a second, and hardware that can keep up never
 * leaves 1.0.
 */
const MIN_RENDER_SCALE = 0.34;
const SCALE_INTERVAL_MS = 900;

/** Off-screen stills are rendered this much larger, then scaled down. */
const PORTRAIT_SUPERSAMPLE = 2;

/**
 * Thin adapter around WebGLRenderer and the post chain. The blueprint
 * recommends starting on WebGL2 and hiding the renderer behind an adapter so a
 * future WebGPU migration touches exactly one file, so the composer lives here
 * rather than leaking passes into `Game`.
 */
export class RendererAdapter {
  readonly renderer: WebGLRenderer;

  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloomPass: UnrealBloomPass;
  private readonly gradePass: ShaderPass;
  private pixelRatioCap = 1.5;
  private width = 1;
  private height = 1;
  private renderScale = 1;
  private adaptive = true;
  private frameMs = 16;
  private lastFrameAt = 0;
  private lastScaleAt = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      // No `antialias` here: every frame goes through the composer, so scene
      // geometry never rasterises into the canvas's MSAA buffer. It was pure
      // wasted memory. The multisampling that matters is on the composer
      // targets below.
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    // EffectComposer already defaults its targets to half float, which is what
    // keeps bloom highlights from banding before tone mapping. What it does not
    // do is multisample them, and without that every edge in the scene is
    // stair-stepped no matter what the canvas was asked for.
    this.composer = new EffectComposer(this.renderer);
    this.composer.renderTarget1.samples = MSAA_SAMPLES;
    this.composer.renderTarget2.samples = MSAA_SAMPLES;

    // The scene and camera are swapped per frame: the reef and the sanctuary
    // are separate scenes that share this one chain.
    this.renderPass = new RenderPass(undefined as unknown as Scene, undefined as unknown as Camera);
    this.composer.addPass(this.renderPass);

    // The threshold has to sit between the brightest sand and the light sources
    // themselves, and both of those are properties of this scene rather than
    // round numbers. Measured off the shots: sunlit sand tops out near 0.31 in
    // this buffer and a light pool's core reaches about 0.93, so 0.55 catches
    // every light and no sand. Above the pool's peak — where it started — bloom
    // has no input at all and the whole pass may as well be switched off; only
    // a little below, and the sand hazes over, which is the flatness the grade
    // was opened up to fix.
    this.bloomPass = new UnrealBloomPass(new Vector2(1, 1), 0.42, 0.65, 0.55);
    this.composer.addPass(this.bloomPass);

    // `ShaderPass` clones the shader's uniforms, so the live grade is driven
    // through this pass rather than through `ColorGradeShader.uniforms`.
    this.gradePass = new ShaderPass(ColorGradeShader);
    this.composer.addPass(this.gradePass);

    // Last: applies the renderer's tone mapping and output colour space.
    this.composer.addPass(new OutputPass());
  }

  setPixelRatioCap(cap: number): void {
    this.pixelRatioCap = cap;
  }

  /** Strength of the discovery swell in the grade, 0 (neutral) to 1. */
  setGradePulse(value: number): void {
    const uniform = this.gradePass.uniforms.uPulse;
    if (uniform) {
      uniform.value = Math.max(0, Math.min(1, value));
    }
  }

  /**
   * Fixes the internal resolution and stops it adapting. Screenshot review
   * depends on it: a shot taken while the scaler happened to be throttled is
   * not comparable with the shot it is supposed to be measured against.
   */
  pinRenderScale(scale: number): void {
    this.adaptive = false;
    this.renderScale = scale;
    this.applySize();
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.applySize();
  }

  private applySize(): void {
    const ratio = Math.min(window.devicePixelRatio ?? 1, this.pixelRatioCap);
    // The canvas keeps its full resolution; only the offscreen chain shrinks.
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setPixelRatio(ratio * this.renderScale);
    this.composer.setSize(this.width, this.height);
    // Bloom is low-frequency by definition, so it is blurred at quarter
    // resolution. It is the most expensive pass in the chain by a wide margin
    // and the difference is not visible in a halo that is already this soft.
    this.bloomPass.setSize(
      Math.max(1, Math.round((this.width * this.renderScale) / BLOOM_DIVISOR)),
      Math.max(1, Math.round((this.height * this.renderScale) / BLOOM_DIVISOR)),
    );
  }

  render(scene: Scene, camera: Camera): void {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render();
    this.adaptResolution();
  }

  /**
   * Renders one throwaway scene off-screen and returns it as a PNG data URL —
   * the codex portraits, and anything else that needs a still of a scene that
   * is never on screen.
   *
   * It deliberately skips the composer: bloom and the grade are tuned for a
   * full frame of reef and would wash out a 256px card. What it cannot skip is
   * tone mapping. Three disables both tone mapping and the sRGB transfer when
   * the destination is a render target, so what comes back from
   * `readRenderTargetPixels` is raw scene-linear light — displayed as-is it is
   * the flat, milky image that makes people think their portrait is broken.
   * Both are applied here on the CPU with the same curve and exposure the
   * screen gets, so a portrait matches the game it came from.
   */
  captureToDataUrl(scene: Scene, camera: Camera, size: number): string | null {
    if (typeof document === "undefined") {
      return null;
    }

    // Supersampled rather than multisampled: a portrait is nearly all
    // silhouette, and reading a multisampled target back is a resolve step
    // this does not need when the whole render is a few thousand pixels.
    const rendered = size * PORTRAIT_SUPERSAMPLE;
    const target = new WebGLRenderTarget(rendered, rendered);
    const pixels = new Uint8Array(rendered * rendered * 4);
    const previousTarget = this.renderer.getRenderTarget();
    try {
      this.renderer.setRenderTarget(target);
      this.renderer.render(scene, camera);
      this.renderer.readRenderTargetPixels(target, 0, 0, rendered, rendered, pixels);
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      target.dispose();
    }

    return toDataUrl(pixels, rendered, size, this.renderer.toneMappingExposure);
  }

  /**
   * Dynamic resolution. The post chain and the reef together are comfortable on
   * a GPU and hopeless on a software rasteriser, which is exactly what a
   * machine without hardware acceleration falls back to. Rather than cut the
   * art for everyone, the internal render targets shrink until frames land in
   * budget and grow back when there is headroom. The canvas itself never
   * changes size, so the upscale is the only visible cost.
   */
  private adaptResolution(): void {
    if (!this.adaptive) {
      return;
    }

    const now = performance.now();
    const elapsed = now - this.lastFrameAt;
    this.lastFrameAt = now;

    // Ignore the first frame and any hitch from a tab returning to the front.
    if (elapsed <= 0 || elapsed > 500) {
      return;
    }
    this.frameMs = this.frameMs * 0.9 + elapsed * 0.1;

    // Resizing reallocates every render target, so change rarely and decisively.
    if (now - this.lastScaleAt < SCALE_INTERVAL_MS) {
      return;
    }

    const previous = this.renderScale;
    if (this.frameMs > SLOW_FRAME_MS) {
      this.renderScale = Math.max(MIN_RENDER_SCALE, this.renderScale - 0.15);
    } else if (this.frameMs < FAST_FRAME_MS) {
      this.renderScale = Math.min(1, this.renderScale + 0.1);
    }

    if (this.renderScale !== previous) {
      this.lastScaleAt = now;
      this.applySize();
    }
  }

  dispose(): void {
    this.composer.dispose();
    this.renderer.dispose();
  }
}

/**
 * Turns the linear pixels of an off-screen render into a displayable image:
 * flipped (GL reads bottom row first), tone mapped, sRGB encoded, and scaled
 * down to the requested size, which is where the supersampling is cashed in.
 */
function toDataUrl(
  pixels: Uint8Array,
  rendered: number,
  size: number,
  exposure: number,
): string | null {
  const source = document.createElement("canvas");
  source.width = rendered;
  source.height = rendered;
  const sourceContext = source.getContext("2d");
  if (!sourceContext) {
    return null;
  }

  const image = sourceContext.createImageData(rendered, rendered);
  const rgb: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < rendered; y++) {
    const readRow = (rendered - 1 - y) * rendered * 4;
    const writeRow = y * rendered * 4;
    for (let x = 0; x < rendered; x++) {
      const read = readRow + x * 4;
      const write = writeRow + x * 4;
      rgb[0] = (pixels[read] ?? 0) / 255;
      rgb[1] = (pixels[read + 1] ?? 0) / 255;
      rgb[2] = (pixels[read + 2] ?? 0) / 255;
      acesFilmic(rgb, exposure);
      image.data[write] = Math.round(sRgbTransfer(rgb[0]) * 255);
      image.data[write + 1] = Math.round(sRgbTransfer(rgb[1]) * 255);
      image.data[write + 2] = Math.round(sRgbTransfer(rgb[2]) * 255);
      image.data[write + 3] = 255;
    }
  }
  sourceContext.putImageData(image, 0, 0);

  const output = document.createElement("canvas");
  output.width = size;
  output.height = size;
  const outputContext = output.getContext("2d");
  if (!outputContext) {
    return null;
  }
  outputContext.imageSmoothingQuality = "high";
  outputContext.drawImage(source, 0, 0, size, size);
  return output.toDataURL("image/png");
}

/**
 * Three's ACES filmic curve, in place. Ported rather than approximated: the
 * portrait sits beside the live reef in the same UI, and a different shoulder
 * would show up as a different animal.
 */
function acesFilmic(rgb: [number, number, number], exposure: number): void {
  const scale = exposure / 0.6;
  const r = rgb[0] * scale;
  const g = rgb[1] * scale;
  const b = rgb[2] * scale;

  const inR = 0.59719 * r + 0.35458 * g + 0.04823 * b;
  const inG = 0.076 * r + 0.90834 * g + 0.01566 * b;
  const inB = 0.0284 * r + 0.13383 * g + 0.83777 * b;

  const fitR = rrtAndOdtFit(inR);
  const fitG = rrtAndOdtFit(inG);
  const fitB = rrtAndOdtFit(inB);

  rgb[0] = clamp01(1.60475 * fitR - 0.53108 * fitG - 0.07367 * fitB);
  rgb[1] = clamp01(-0.10208 * fitR + 1.10813 * fitG - 0.00605 * fitB);
  rgb[2] = clamp01(-0.00327 * fitR - 0.07276 * fitG + 1.07602 * fitB);
}

function rrtAndOdtFit(v: number): number {
  return (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
}

function sRgbTransfer(value: number): number {
  return value <= 0.0031308 ? value * 12.92 : Math.pow(value, 0.41666) * 1.055 - 0.055;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
