import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  type DataTexture,
  type Scene,
} from "three";
import { Random, SEEDS } from "../util/Random";
import { buildScalarTexture } from "./ProceduralTexture";

/**
 * Sparse drifting motes. Low density on purpose — the blueprint warns against
 * thousands of transparent particles.
 */
export class Particles {
  readonly points: Points;
  private readonly basePositions: Float32Array;
  private readonly count: number;
  private time = 0;

  constructor(count = 220, radius = 26, seed: number = SEEDS.motes) {
    this.count = count;
    this.basePositions = new Float32Array(count * 3);
    const random = new Random(seed);
    for (let i = 0; i < count; i++) {
      this.basePositions[i * 3] = random.signed(radius);
      this.basePositions[i * 3 + 1] = random.range(0.5, 10.5);
      this.basePositions[i * 3 + 2] = random.signed(radius);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(this.basePositions.slice(), 3));

    const material = new PointsMaterial({
      color: 0xdff4ef,
      size: 0.09,
      // Without a sprite every mote is a hard square, which is exactly how they
      // read against the water: white confetti rather than drifting matter.
      map: createMoteSprite(),
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
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

/** A soft round mote: opaque core fading to nothing at the rim. */
function createMoteSprite(): DataTexture {
  return buildScalarTexture(32, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    return Math.pow(Math.max(0, 1 - distance), 1.8);
  });
}
