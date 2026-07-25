import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
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

    this.composer.addPass(new ShaderPass(ColorGradeShader));

    // Last: applies the renderer's tone mapping and output colour space.
    this.composer.addPass(new OutputPass());
  }

  setPixelRatioCap(cap: number): void {
    this.pixelRatioCap = cap;
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
