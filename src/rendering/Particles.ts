import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  type Scene,
} from "three";

/**
 * Sparse drifting motes. Low density on purpose — the blueprint warns against
 * thousands of transparent particles.
 */
export class Particles {
  readonly points: Points;
  private readonly basePositions: Float32Array;
  private readonly count: number;
  private time = 0;

  constructor(count = 220, radius = 26) {
    this.count = count;
    this.basePositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.basePositions[i * 3] = (Math.random() - 0.5) * radius * 2;
      this.basePositions[i * 3 + 1] = Math.random() * 10 + 0.5;
      this.basePositions[i * 3 + 2] = (Math.random() - 0.5) * radius * 2;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(this.basePositions.slice(), 3));

    const material = new PointsMaterial({
      color: 0xdff4ef,
      size: 0.07,
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    this.points = new Points(geometry, material);
  }

  addTo(scene: Scene): void {
    scene.add(this.points);
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt * (reducedMotion ? 0.3 : 1);
    const attribute = this.points.geometry.getAttribute("position") as Float32BufferAttribute;
    const array = attribute.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      const bx = this.basePositions[i * 3] ?? 0;
      const by = this.basePositions[i * 3 + 1] ?? 0;
      const bz = this.basePositions[i * 3 + 2] ?? 0;
      array[i * 3] = bx + Math.sin(this.time * 0.2 + i) * 0.25;
      array[i * 3 + 1] = by + Math.sin(this.time * 0.15 + i * 0.5) * 0.2;
      array[i * 3 + 2] = bz + Math.cos(this.time * 0.18 + i) * 0.25;
    }
    attribute.needsUpdate = true;
  }
}
