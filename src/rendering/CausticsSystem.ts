import {
  AdditiveBlending,
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  RepeatWrapping,
  type Scene,
} from "three";
import { Random, SEEDS } from "../util/Random";
import { createSeabedGeometry } from "../world/Seabed";

/** Edge length of the tiling caustics pattern, in pixels. */
const SIZE = 256;

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

  // `height` must clear the seabed: the overlay is depth tested like anything
  // else, so a sheet at or below the sand never draws. It also has to follow
  // the same dunes, or the crests punch through it.
  constructor(size = 72, height = 0.06) {
    this.texture = new CanvasTexture(CausticsSystem.createPattern());
    this.texture.wrapS = RepeatWrapping;
    this.texture.wrapT = RepeatWrapping;
    this.texture.repeat.set(9, 9);

    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.35,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: true,
    });

    this.mesh = new Mesh(createSeabedGeometry(size, 48, height), this.material);
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
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return canvas;
    }
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Overlapping soft light cells approximate refracted sunlight. Each cell is
    // stamped at nine wrapped offsets so the ones straddling an edge reappear
    // on the opposite side; without that the tile seams read as a hard grid
    // across the whole seabed.
    const random = new Random(SEEDS.caustics);
    const wrap = [-SIZE, 0, SIZE];
    for (let i = 0; i < 110; i++) {
      const x = random.range(0, SIZE);
      const y = random.range(0, SIZE);
      const radius = random.range(10, 38);
      const brightness = random.range(0.35, 0.95);
      for (const offsetX of wrap) {
        for (const offsetY of wrap) {
          CausticsSystem.stampCell(ctx, x + offsetX, y + offsetY, radius, brightness);
        }
      }
    }
    return canvas;
  }

  private static stampCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    brightness: number,
  ): void {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(210, 255, 250, ${brightness})`);
    gradient.addColorStop(1, "rgba(210, 255, 250, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
