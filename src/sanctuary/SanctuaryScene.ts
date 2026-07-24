import {
  AmbientLight,
  Color,
  CylinderGeometry,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import { Moray } from "../creatures/morays/Moray";
import type { MoraySpeciesConfig } from "../creatures/morays/MoraySpeciesConfig";

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
    const water = new Color(0x123a52);
    this.scene.background = water.clone().multiplyScalar(0.5);
    this.scene.fog = new FogExp2(water.getHex(), 0.02);

    const key = new DirectionalLight(0xffe1b0, 1.3);
    key.position.set(4, 12, 6);
    const hemisphere = new HemisphereLight(0xbfe6ff, 0x1a2a33, 0.8);
    const ambient = new AmbientLight(0x3a5a66, 0.4);
    this.scene.add(key, hemisphere, ambient);

    const floor = new Mesh(
      new CylinderGeometry(16, 16, 0.6, 48),
      new MeshStandardMaterial({ color: 0x1c3a4a, roughness: 0.9 }),
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
    }
    this.residents.length = 0;

    const count = configs.length;
    configs.forEach((config, index) => {
      const moray = new Moray(config);
      moray.asset.root.scale.setScalar(1.7);
      this.scene.add(moray.asset.root);

      const spread = count > 1 ? index / (count - 1) - 0.5 : 0;
      this.residents.push({
        moray,
        centerX: spread * Math.min(18, count * 4),
        radius: 2.2 + (index % 2) * 0.8,
        height: 2.2 + (index % 2) * 0.9,
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

    const distance = 14;
    this.camera.position.set(Math.sin(this.orbit) * distance, 4.5, Math.cos(this.orbit) * distance);
    this.camera.lookAt(0, 2.2, 0);

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
