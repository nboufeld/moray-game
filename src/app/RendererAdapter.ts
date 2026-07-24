import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
  type Camera,
  type Scene,
} from "three";

/**
 * Thin adapter around WebGLRenderer. The blueprint recommends starting on
 * WebGL2 and hiding the renderer behind an adapter so a future WebGPU
 * migration touches exactly one file.
 */
export class RendererAdapter {
  readonly renderer: WebGLRenderer;
  private pixelRatioCap = 1.5;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
  }

  setPixelRatioCap(cap: number): void {
    this.pixelRatioCap = cap;
  }

  setSize(width: number, height: number): void {
    const ratio = Math.min(window.devicePixelRatio ?? 1, this.pixelRatioCap);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
  }

  render(scene: Scene, camera: Camera): void {
    this.renderer.render(scene, camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
