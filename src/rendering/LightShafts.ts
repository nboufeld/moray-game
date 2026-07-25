import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type Scene,
} from "three";
import { Random, SEEDS } from "../util/Random";

/**
 * Kept deliberately low. The diver stands inside these, so every shaft is a
 * full-screen additive layer and the cost is overdraw, not triangles.
 */
const SHAFT_COUNT = 8;
const SHAFT_LENGTH = 34;

/**
 * Sunlight raking down through the surface, faked with crossed additive
 * curtains rather than volumetrics.
 *
 * Each shaft is two quads in a cross so it never disappears when the diver
 * happens to view it edge-on, and every shaft is depth tested, so the rocks and
 * coral cut into the beams the way they should.
 */
export class LightShafts {
  readonly group = new Group();

  // One material per shaft. They are cheap, and a single shared opacity made
  // the entire ocean breathe on one metronome.
  private readonly materials: { material: MeshBasicMaterial; phase: number }[] = [];
  private readonly baseOpacity = 0.15;
  private time = 0;

  constructor(sunDirection: Vector3, seed: number = SEEDS.shafts) {
    const random = new Random(seed);

    const texture = createShaftTexture();

    // Point each shaft down the sun ray: the geometry runs along its own +Y.
    const along = sunDirection.clone().normalize().negate();
    const orientation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), along);

    for (let i = 0; i < SHAFT_COUNT; i++) {
      const width = random.range(2.4, 6.5);
      const material = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: this.baseOpacity,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        // Fog would tint an additive surface and brighten the distance instead
        // of fading it, so the shafts opt out and rely on their own falloff.
        fog: false,
      });
      this.materials.push({ material, phase: random.range(0, Math.PI * 2) });

      const shaft = new Group();
      shaft.quaternion.copy(orientation);
      shaft.position.set(random.signed(26), random.range(4, 9), random.signed(26));
      shaft.scale.setScalar(random.range(0.8, 1.35));

      for (const spin of [0, Math.PI / 2]) {
        const geometry = new PlaneGeometry(width, SHAFT_LENGTH);
        const blade = new Mesh(geometry, material);
        blade.rotation.y = spin + random.signed(0.4);
        blade.renderOrder = 2;
        shaft.add(blade);
      }

      this.group.add(shaft);
    }
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt * (reducedMotion ? 0.25 : 1);
    // A slow breathing pulse; the surface above is never quite still. Each
    // shaft runs on its own phase so the swell reads as water, not a dimmer.
    const scale = this.baseOpacity * (reducedMotion ? 0.75 : 1);
    for (const { material, phase } of this.materials) {
      material.opacity = scale * (1 + Math.sin(this.time * 0.35 + phase) * 0.28);
    }
  }
}

/**
 * A soft-edged beam: a bell across the width so the sides never show a hard
 * boundary, fading out along its length as the light is absorbed.
 */
function createShaftTexture(): CanvasTexture {
  const width = 64;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      // Canvas y = 0 is the top of the plane, nearest the surface.
      const depth = 1 - y / (height - 1);
      // Ramp in just under the surface as well as out with depth: without the
      // head fade the quad's top edge cuts a hard diagonal across the water.
      const head = Math.min(1, (1 - depth) * 7);
      const fade = Math.pow(depth, 1.7) * head;
      for (let x = 0; x < width; x++) {
        const across = (x / (width - 1)) * 2 - 1;
        const bell = Math.pow(Math.cos((across * Math.PI) / 2), 2.2);
        const alpha = Math.max(0, bell * fade);
        const index = (y * width + x) * 4;
        image.data[index] = 214;
        image.data[index + 1] = 245;
        image.data[index + 2] = 255;
        image.data[index + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
