import {
  BufferAttribute,
  Color,
  ConeGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  type BufferGeometry,
  type Scene,
  type WebGLProgramParametersWithUniforms,
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
  countershade(body);

  // Two thin blades splayed into a fork, set behind the body.
  const upper = new ConeGeometry(0.075, 0.16, 3);
  upper.rotateX(-Math.PI / 2);
  upper.rotateZ(Math.PI / 2);
  upper.scale(0.28, 1, 1);
  upper.translate(0, 0.055, -0.3);

  const lower = upper.clone();
  lower.translate(0, -0.11, 0);
  countershade(upper);
  countershade(lower);

  return mergeGeometries([body, upper, lower]) ?? body;
}

/**
 * Bakes counter-shading — dark back, bright belly — into vertex colours.
 *
 * This is the real cue that makes a fish read as a fish from a distance, and at
 * this size it is not worth a texture fetch to get it: the whole animal is a
 * handful of pixels, so the gradient does all the work a map would.
 */
function countershade(geometry: BufferGeometry): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < position.count; i++) {
    min = Math.min(min, position.getY(i));
    max = Math.max(max, position.getY(i));
  }

  const span = Math.max(1e-5, max - min);
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) - min) / span;
    // Belly close to white, back dropping toward a cool shadow.
    const shade = 1.25 - t * 0.72;
    colors[i * 3] = shade * 0.95;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade * 1.04;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

interface FishAgent {
  centerX: number;
  centerZ: number;
  radius: number;
  height: number;
  speed: number;
  phase: number;
  scale: number;
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
  private readonly swim = { value: 0 };
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
      vertexColors: true,
    });
    // Tail sway in the vertex shader, phased per instance. At this size a fish
    // is a few pixels of silhouette, and motion is the only thing that
    // separates a school from a scattering of debris.
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uSwim = this.swim;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uSwim;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           float swimPhase = instanceMatrix[3][0] * 0.9 + instanceMatrix[3][2] * 0.7;
           // Weighted toward the tail (-z), so the nose stays steady.
           float tailward = clamp(-transformed.z / 0.42, 0.0, 1.0);
           transformed.x += sin(uSwim * 7.0 + swimPhase) * 0.06 * tailward * tailward;`,
        );
    };
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
        // A shoal of identically sized fish reads as a repeated decal.
        scale: random.range(0.72, 1.45),
      });
    }
  }

  addTo(scene: Scene): void {
    scene.add(this.mesh);
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt * (reducedMotion ? 0.4 : 1);
    this.swim.value = this.time;
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
      // Face along the tangent of the circle. For a position of (cos a, sin a)
      // the velocity is (-sin a, cos a), and a yaw of θ points local +Z at
      // (sin θ, cos θ), so θ = -a. The previous a + π/2 pointed every fish
      // radially outward and swept a full turn of heading error per lap.
      this.dummy.rotation.set(0, -angle, 0);
      this.dummy.scale.setScalar(fish.scale);
      this.dummy.updateMatrix();
      this.matrix.copy(this.dummy.matrix);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
