import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  type Scene,
} from "three";

/**
 * A deliberately simple lighting vocabulary: one warm "sun" from above, a cool
 * hemisphere fill and a little ambient. Additional lights add rendering cost,
 * so painted materials are expected to carry much of the mood.
 */
export class Lighting {
  readonly group = new Group();
  readonly sun: DirectionalLight;

  constructor() {
    this.sun = new DirectionalLight(0xffe6b0, 1.6);
    this.sun.position.set(6, 20, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 60;
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.bias = -0.0008;

    const hemisphere = new HemisphereLight(0xbfeef0, 0x0a2836, 0.7);
    const ambient = new AmbientLight(0x3a7f88, 0.35);

    this.group.add(this.sun, this.sun.target, hemisphere, ambient);
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }
}
