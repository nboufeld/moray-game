import {
  ConeGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  type Scene,
} from "three";

interface FishAgent {
  centerX: number;
  centerZ: number;
  radius: number;
  height: number;
  speed: number;
  phase: number;
}

/**
 * Sparse ambient reef fish. Each fish drifts along a slow circle with a gentle
 * bob — cheap, deterministic-feeling life via a single InstancedMesh (one draw
 * call), rather than a physics flock.
 */
export class FishSchoolSystem {
  readonly mesh: InstancedMesh;
  private readonly agents: FishAgent[] = [];
  private readonly dummy = new Object3D();
  private readonly matrix = new Matrix4();
  private time = 0;

  constructor(count = 90) {
    const geometry = new ConeGeometry(0.14, 0.6, 5);
    geometry.rotateX(Math.PI / 2); // point the nose along +Z
    const material = new MeshStandardMaterial({
      color: new Color(0xffd88a),
      roughness: 0.6,
      metalness: 0,
      flatShading: true,
    });
    this.mesh = new InstancedMesh(geometry, material, count);

    for (let i = 0; i < count; i++) {
      this.agents.push({
        centerX: (Math.random() - 0.5) * 44,
        centerZ: (Math.random() - 0.5) * 44,
        radius: 2 + Math.random() * 6,
        height: 2 + Math.random() * 6,
        speed: 0.25 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  addTo(scene: Scene): void {
    scene.add(this.mesh);
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt * (reducedMotion ? 0.4 : 1);
    for (let i = 0; i < this.agents.length; i++) {
      const fish = this.agents[i];
      if (!fish) {
        continue;
      }
      const angle = fish.phase + this.time * fish.speed;
      const x = fish.centerX + Math.cos(angle) * fish.radius;
      const z = fish.centerZ + Math.sin(angle) * fish.radius;
      const y = fish.height + Math.sin(this.time * 0.6 + fish.phase) * 0.3;

      this.dummy.position.set(x, y, z);
      // Face along the tangent of the circle.
      this.dummy.rotation.set(0, angle + Math.PI / 2, 0);
      this.dummy.updateMatrix();
      this.matrix.copy(this.dummy.matrix);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
