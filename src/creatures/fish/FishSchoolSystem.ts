import {
  Color,
  ConeGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  type BufferGeometry,
  type Scene,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Random, SEEDS } from "../../util/Random";

/** Number of loose shoals the school is distributed between. */
const SHOAL_COUNT = 7;

/**
 * A tapered body with a forked tail, nose along +Z.
 *
 * Shape matters more than size here: a bare diamond reads as a flying saucer
 * the moment the diver gets close enough to see it end-on, and a school of
 * those looks like drifting litter rather than life.
 */
function createFishGeometry(): BufferGeometry {
  const body = new OctahedronGeometry(0.13, 0);
  body.scale(0.55, 0.82, 2.1);

  // Two thin blades splayed into a fork, set behind the body.
  const upper = new ConeGeometry(0.075, 0.16, 3);
  upper.rotateX(-Math.PI / 2);
  upper.rotateZ(Math.PI / 2);
  upper.scale(0.28, 1, 1);
  upper.translate(0, 0.055, -0.3);

  const lower = upper.clone();
  lower.translate(0, -0.11, 0);

  return mergeGeometries([body, upper, lower]) ?? body;
}

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

  constructor(count = 170, seed: number = SEEDS.fish) {
    const random = new Random(seed);
    const geometry = createFishGeometry();
    const material = new MeshStandardMaterial({
      // Silvered rather than golden: a warm body against warm sand disappears,
      // and a whole school of it reads as floating litter.
      color: new Color(0xbcd7d2),
      roughness: 0.42,
      metalness: 0.15,
      flatShading: true,
    });
    this.mesh = new InstancedMesh(geometry, material, count);
    // Small, distant and always moving: their shadows are never legible, and
    // 170 extra casters in the shadow pass are not.
    this.mesh.castShadow = false;

    // Fish shoal near structure instead of dusting the whole water column.
    const shoals = Array.from({ length: SHOAL_COUNT }, () => ({
      x: random.signed(20),
      z: random.signed(20),
      y: random.range(1.6, 6.5),
    }));

    for (let i = 0; i < count; i++) {
      const shoal = shoals[i % SHOAL_COUNT]!;
      this.agents.push({
        centerX: shoal.x + random.signed(3.2),
        centerZ: shoal.z + random.signed(3.2),
        radius: random.range(1.2, 4.2),
        height: shoal.y + random.signed(1.1),
        speed: random.range(0.3, 0.62),
        phase: random.range(0, Math.PI * 2),
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
