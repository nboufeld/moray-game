import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  type Scene,
} from "three";

/**
 * A deliberately simple lighting vocabulary: one warm "sun" raking down through
 * the surface, a hemisphere that carries both the blue of the water above and
 * the bounce off the bright sand below, and a little ambient to keep the deep
 * shadows from going dead. Additional lights add rendering cost, so painted
 * materials are expected to carry much of the mood.
 */
export class Lighting {
  readonly group = new Group();
  readonly sun: DirectionalLight;

  constructor() {
    // Off-axis rather than straight overhead: a steep sun is physically right
    // for shallow water but leaves everything flat and shadowless.
    this.sun = new DirectionalLight(0xfff1d0, 1.25);
    this.sun.position.set(17, 24, 13);
    this.sun.castShadow = true;
    // 1024 over a frustum this tight resolves contact shadows well; 2048 cost
    // four times as much shadow fill for no visible gain at this scale.
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 80;
    // Tight to the play area — a wide frustum spends its texels on empty sand.
    this.sun.shadow.camera.left = -24;
    this.sun.shadow.camera.right = 24;
    this.sun.shadow.camera.top = 24;
    this.sun.shadow.camera.bottom = -24;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;

    // Warm ground colour is the sand bouncing light back up, which is what
    // keeps the undersides of the rocks and morays from reading as black.
    const hemisphere = new HemisphereLight(0xa8dcea, 0xc2a172, 0.6);
    const ambient = new AmbientLight(0x2f6b78, 0.2);

    this.group.add(this.sun, this.sun.target, hemisphere, ambient);
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }
}
