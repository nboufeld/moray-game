import {
  AdditiveBlending,
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  type Scene,
} from "three";

/**
 * Cheap animated caustics: a tiling canvas texture drawn once and gently
 * scrolled/pulsed across an overlay plane on the seabed. No shaders required,
 * so it is robust across renderers.
 */
export class CausticsSystem {
  readonly mesh: Mesh;
  private readonly texture: CanvasTexture;
  private readonly material: MeshBasicMaterial;
  private time = 0;

  // `height` must clear the opaque seabed at y = 0: the overlay is depth
  // tested like anything else, so a plane at or below the sand never draws.
  constructor(size = 60, height = 0.05) {
    this.texture = new CanvasTexture(CausticsSystem.createPattern());
    this.texture.wrapS = RepeatWrapping;
    this.texture.wrapT = RepeatWrapping;
    this.texture.repeat.set(6, 6);

    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.35,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    const geometry = new PlaneGeometry(size, size);
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = height;
    this.mesh.renderOrder = 1;
  }

  addTo(scene: Scene): void {
    scene.add(this.mesh);
  }

  update(dt: number, reducedMotion: boolean): void {
    const rate = reducedMotion ? 0.15 : 1;
    this.time += dt * rate;
    this.texture.offset.set(Math.sin(this.time * 0.06) * 0.1, this.time * 0.02);
    this.material.opacity = (reducedMotion ? 0.22 : 0.3) + Math.sin(this.time * 0.5) * 0.05;
  }

  private static createPattern(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return canvas;
    }
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 256, 256);

    // Overlapping soft light cells approximate refracted sunlight.
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 8 + Math.random() * 26;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      const brightness = 0.4 + Math.random() * 0.6;
      gradient.addColorStop(0, `rgba(210, 255, 250, ${brightness})`);
      gradient.addColorStop(1, "rgba(210, 255, 250, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return canvas;
  }
}
