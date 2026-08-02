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
 * How far a mote dims and brightens over its cycle, and how long that cycle
 * takes at its slowest and fastest.
 *
 * The floor is deliberately well above zero: a mote that goes out entirely
 * pops back, and forty of those at once is static rather than sparkle. Rates
 * are spread so no two motes share a beat — a field of specks on one metronome
 * reads as the whole screen flickering.
 */
const TWINKLE_FLOOR = 0.45;
const TWINKLE_RATE_MIN = 0.5;
const TWINKLE_RATE_MAX = 1.4;

/**
 * Sparse drifting motes. Low density on purpose — the blueprint warns against
 * thousands of transparent particles.
 *
 * Since WP-G4 they twinkle: each one rides its own slow sine, brightening and
 * fading rather than sitting at a constant value. Under additive blending
 * brightness and opacity are the same quantity, so the twinkle is carried in a
 * per-point colour attribute and costs one multiply per mote per frame — no
 * shader patch, and the same CPU loop that was already moving them.
 */
export class Particles {
  readonly points: Points;
  private readonly basePositions: Float32Array;
  private readonly twinklePhases: Float32Array;
  private readonly twinkleRates: Float32Array;
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

    // Drawn after every position rather than interleaved with them, so adding
    // the twinkle left the drift field it rides on bit-identical.
    this.twinklePhases = new Float32Array(count);
    this.twinkleRates = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.twinklePhases[i] = random.range(0, Math.PI * 2);
      this.twinkleRates[i] = random.range(TWINKLE_RATE_MIN, TWINKLE_RATE_MAX);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(this.basePositions.slice(), 3));
    geometry.setAttribute("color", new Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));

    const material = new PointsMaterial({
      color: 0xfff8e8,
      size: 0.12,
      // Without a sprite every mote is a hard square, which is exactly how they
      // read against the water: white confetti rather than drifting matter.
      map: createMoteSprite(),
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      // Multiplies the material colour, and carries the twinkle.
      vertexColors: true,
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
    const twinkle = this.points.geometry.getAttribute("color") as Float32BufferAttribute;
    const shade = twinkle.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      const bx = this.basePositions[i * 3] ?? 0;
      const by = this.basePositions[i * 3 + 1] ?? 0;
      const bz = this.basePositions[i * 3 + 2] ?? 0;
      array[i * 3] = bx + Math.sin(this.time * 0.2 + i) * 0.25;
      array[i * 3 + 1] = by + Math.sin(this.time * 0.15 + i * 0.5) * 0.2;
      array[i * 3 + 2] = bz + Math.cos(this.time * 0.18 + i) * 0.25;

      const rate = this.twinkleRates[i] ?? 1;
      const phase = this.twinklePhases[i] ?? 0;
      const level =
        TWINKLE_FLOOR + (1 - TWINKLE_FLOOR) * (0.5 + 0.5 * Math.sin(this.time * rate + phase));
      shade[i * 3] = level;
      shade[i * 3 + 1] = level;
      shade[i * 3 + 2] = level;
    }
    attribute.needsUpdate = true;
    twinkle.needsUpdate = true;
  }
}

/** A soft round mote: opaque core fading to nothing at the rim. */
function createMoteSprite(): DataTexture {
  return buildScalarTexture(32, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    return Math.pow(Math.max(0, 1 - distance), 1.8);
  });
}
