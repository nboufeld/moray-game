import {
  BufferAttribute,
  Group,
  InstancedMesh,
  Vector3,
  type BufferGeometry,
  type Material,
  type Scene,
} from "three";
import type { LifeContext, LifeSystem } from "../life/LifeSystem";
import { seabedHeight } from "../../world/Seabed";

/**
 * The shared shape of Wave 3's ground fauna, replacing `LifeScaffold` the way
 * that class's own header asks: a population that has grown real contents
 * implements {@link LifeSystem} itself.
 *
 * Two decisions live here so that five modules do not each re-make them.
 *
 * **Contents are built on `addTo`, not at construction.** That is not laziness
 * for its own sake: `tests/lifeSystems.test.ts` — which this package must keep
 * green and may not edit — constructs every population and asserts its group is
 * empty before it joins a scene. The build is still deterministic from the
 * moment it runs, because every draw comes off the seed taken at construction,
 * and it runs exactly once however many scenes ask.
 *
 * **Disposal releases what the system owns and nothing else.** `disposeSubtree`
 * would walk the meshes and dispose whatever geometry they happen to be
 * wearing, and the shrimp wear `AssetLibrary`'s cached GLB the moment it lands
 * — geometry the library owns and every future caller shares, exactly like the
 * textures. So each system registers the geometries and materials it created,
 * and teardown releases that list plus the per-instance buffers of its
 * instanced meshes, which is everything it ever allocated.
 */
export abstract class FaunaSystem implements LifeSystem {
  readonly group = new Group();

  private built = false;
  private readonly owned: (BufferGeometry | Material)[] = [];
  private readonly instanced: InstancedMesh[] = [];

  constructor(
    name: string,
    readonly seed: number,
  ) {
    this.group.name = name;
  }

  addTo(scene: Scene): void {
    if (!this.built) {
      this.built = true;
      this.build();
    }
    scene.add(this.group);
  }

  /** Called once, on the first `addTo`. Populate the group here. */
  protected abstract build(): void;

  abstract update(dt: number, ctx: LifeContext): void;

  /** Registers a resource this system created and must release on teardown. */
  protected own<T extends BufferGeometry | Material>(resource: T): T {
    this.owned.push(resource);
    return resource;
  }

  /** An owned instanced mesh: its per-instance buffers are released too. */
  protected ownInstanced(mesh: InstancedMesh): InstancedMesh {
    this.instanced.push(mesh);
    return mesh;
  }

  dispose(): void {
    for (const mesh of this.instanced) {
      mesh.dispose();
    }
    this.instanced.length = 0;
    for (const resource of this.owned) {
      resource.dispose();
    }
    this.owned.length = 0;
    this.group.removeFromParent();
    this.group.clear();
  }
}

/**
 * The seabed's normal at (x, z), by central differences on `seabedHeight`.
 *
 * Half a metre of step on purpose: the fauna conforming to the ground are
 * hand-sized, and what a starfish drapes over is the dune, not the micro-relief
 * — sampled finer, every one of them picks up a random-looking tilt from the
 * fbm octave and the bed stops reading as one surface.
 */
export function seabedNormal(x: number, z: number, out: Vector3): Vector3 {
  const step = 0.5;
  const dx = seabedHeight(x + step, z) - seabedHeight(x - step, z);
  const dz = seabedHeight(x, z + step) - seabedHeight(x, z - step);
  return out.set(-dx, 2 * step, -dz).normalize();
}

/**
 * Writes one flat colour across a part, so merged buffers agree on their
 * attributes — `mergeGeometries` rejects a part that lacks one the others
 * carry, and it rejects it silently, which is how the fish lost its tail once.
 */
export function paintVertices(
  geometry: BufferGeometry,
  r: number,
  g: number,
  b: number,
): BufferGeometry {
  const count = geometry.attributes.position?.count ?? 0;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}
