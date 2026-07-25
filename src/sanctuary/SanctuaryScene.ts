import {
  AmbientLight,
  CylinderGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  type Object3D,
} from "three";
import { Moray } from "../creatures/morays/Moray";
import { UnderwaterFog } from "../rendering/UnderwaterFog";
import type { MoraySpeciesConfig } from "../creatures/morays/MoraySpeciesConfig";

/** The aquarium's key light, shared with the backdrop that has to agree with it. */
const KEY_POSITION = new Vector3(6, 14, 8);

interface SanctuaryResident {
  readonly moray: Moray;
  readonly centerX: number;
  readonly radius: number;
  readonly height: number;
  readonly speed: number;
  angle: number;
}

/**
 * The dream sanctuary: a calm, warmly lit bay where discovered morays drift in
 * gentle loops. A controlled showcase environment (few animals, higher detail)
 * and the emotional reward for discovery.
 */
export class SanctuaryScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(55, 1, 0.1, 120);

  private readonly residents: SanctuaryResident[] = [];
  private readonly playerProxy = new Vector3();
  private orbit = 0;

  constructor() {
    // The sanctuary is the reward for discovery, so it is lit as a warm, lamplit
    // aquarium rather than the near-black tank it used to be. It borrows the
    // reef's gradient backdrop for the same reason the reef needs one: without
    // it the floor terminates on a hard line instead of fading into the water.
    new UnderwaterFog({
      color: 0x1d5b74,
      density: 0.028,
      surfaceColor: 0x63d0e0,
      abyssColor: 0x0a2f3e,
      // Its own key, not the reef's sun: the backdrop has to brighten on the
      // side the light in this room actually comes from.
      sunDirection: KEY_POSITION,
    }).applyTo(this.scene);

    const key = new DirectionalLight(0xffe7c2, 2.1);
    key.position.copy(KEY_POSITION);
    // A second, cooler light from behind picks the moray silhouettes off the
    // background; one key alone leaves their far side in flat shadow.
    const rim = new DirectionalLight(0x9fd8ea, 0.9);
    rim.position.set(-9, 6, -11);
    const hemisphere = new HemisphereLight(0xcdeeff, 0x2a4450, 1.1);
    const ambient = new AmbientLight(0x4d7f92, 0.55);
    this.scene.add(key, rim, hemisphere, ambient);

    // Wide enough that its rim is fully fogged out; a 16m disc showed a hard
    // edge cutting across the water behind the residents.
    const floor = new Mesh(
      new CylinderGeometry(90, 90, 0.6, 64),
      new MeshStandardMaterial({ color: 0x2c5f70, roughness: 0.9 }),
    );
    floor.position.y = -0.3;
    this.scene.add(floor);

    this.camera.position.set(0, 4, 14);
    this.camera.lookAt(0, 2, 0);
  }

  /** Rebuilds the residents to match the set of discovered species. */
  setSpecies(configs: readonly MoraySpeciesConfig[]): void {
    for (const resident of this.residents) {
      this.scene.remove(resident.moray.asset.root);
      disposeSubtree(resident.moray.asset.root);
    }
    this.residents.length = 0;

    const count = configs.length;
    configs.forEach((config, index) => {
      const moray = new Moray(config);
      moray.asset.root.scale.setScalar(1.25);
      this.scene.add(moray.asset.root);

      const spread = count > 1 ? index / (count - 1) - 0.5 : 0;
      this.residents.push({
        moray,
        // Tighter and more layered in depth than a straight line of animals:
        // they should compose as a group rather than a specimen row.
        centerX: spread * Math.min(12, count * 3),
        radius: 2.2 + (index % 2) * 0.8,
        height: 1.8 + (index % 3) * 1.3,
        speed: 0.3 + (index % 3) * 0.08,
        angle: index * 1.7,
      });
    });
  }

  get residentCount(): number {
    return this.residents.length;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, reducedMotion: boolean): void {
    const motion = reducedMotion ? 0.4 : 1;
    this.orbit += dt * 0.12 * motion;

    const distance = 13;
    this.camera.position.set(Math.sin(this.orbit) * distance, 4.2, Math.cos(this.orbit) * distance);
    this.camera.lookAt(0, 2.6, 0);

    this.camera.getWorldPosition(this.playerProxy);
    for (const resident of this.residents) {
      resident.angle += dt * resident.speed * motion;
      const x = resident.centerX + Math.cos(resident.angle) * resident.radius;
      const z = Math.sin(resident.angle) * resident.radius;
      const root = resident.moray.asset.root;
      root.position.set(x, resident.height, z);
      root.rotation.y = resident.angle + Math.PI / 2;

      // The orbiting camera stands in for "where to look" so eyes track it.
      resident.moray.update(dt * motion, this.playerProxy, true);
    }
  }
}

/**
 * Residents are rebuilt every time the sanctuary is opened or a moray is
 * discovered, so their geometries and materials must be released or the GPU
 * copies accumulate for the rest of the session.
 */
function disposeSubtree(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material.dispose();
    }
  });
}
