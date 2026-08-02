import {
  Bone,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  Sphere,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Scene,
} from "three";
import type { LifeContext, LifeSystem } from "../../life/LifeSystem";

/**
 * The wave-8 mythics' shared shell, distilled from the visitors' idioms.
 *
 * A mythic is a permanent resident, not a visitor — no schedule, no
 * director, the animal is on stage from the first frame — so it implements
 * {@link LifeSystem} directly rather than extending `VisitorBase`. What it
 * keeps from the visitors is the resource discipline: geometries and
 * materials the body built itself are recorded with {@link own} and
 * released on {@link dispose}, while the GLB geometry arrives shared from
 * `AssetLibrary` and is deliberately never disposed here.
 *
 * The GLB may never land (no `window`, no `public/` directory): every
 * mythic therefore constructs its procedural stand-in first and only then
 * asks for the model, exactly as the turtle does.
 */
export abstract class MythicBody implements LifeSystem {
  readonly group = new Group();
  /** The animal itself; motion code poses this node. */
  protected readonly body = new Group();
  private readonly owned = new Set<BufferGeometry | Material>();
  private readonly skeletons: Skeleton[] = [];
  private disposed = false;

  constructor(name: string) {
    this.group.name = name;
    this.body.name = `${name}-body`;
    this.group.add(this.body);
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }

  abstract update(dt: number, ctx: LifeContext): void;

  dispose(): void {
    this.disposed = true;
    this.group.removeFromParent();
    this.group.clear();
    for (const skeleton of this.skeletons) {
      skeleton.dispose();
    }
    this.skeletons.length = 0;
    for (const resource of this.owned) {
      resource.dispose();
    }
    this.owned.clear();
  }

  /** True after dispose, so a late GLB arrival builds nothing. */
  protected get isDisposed(): boolean {
    return this.disposed;
  }

  /** Records a geometry or material as this instance's to dispose. */
  protected own<T extends BufferGeometry | Material>(resource: T): T {
    this.owned.add(resource);
    return resource;
  }

  /** Disposes a previously owned resource now (a fallback being replaced). */
  protected disposeOwned(resource: BufferGeometry | Material): void {
    if (this.owned.delete(resource)) {
      resource.dispose();
    }
  }

  /** A skinned mesh's skeleton is owned too; register it at bind time. */
  protected ownSkeleton(skeleton: Skeleton): void {
    this.skeletons.push(skeleton);
  }
}

/**
 * One joint of a rebuilt skeleton, measured off the exported GLB (the
 * inspector prints exactly these numbers: origin in model space, the
 * directions the bone's local +X and +Y point — local +Y being the
 * articulation axis a `rotation.y` turns about).
 *
 * `parent` chains a joint onto an earlier one: a serpent's vertebrae
 * accumulate their yaw down the chain, and the kirin's head rides its
 * neck. The chain never changes the rest pose — each child's local frame
 * is the difference of the two global frames, so the bind stays identity
 * until a bone moves, the turtle's argument verbatim.
 */
export interface JointSpec {
  readonly name: string;
  readonly origin: readonly [number, number, number];
  readonly x: readonly [number, number, number];
  readonly y: readonly [number, number, number];
  readonly parent: number | null;
}

/**
 * Rebuilds a GLB's skeleton from its measured joint contract and binds it.
 *
 * `requestModel` delivers bare geometry; the skin attributes ride along in
 * `skinIndex`/`skinWeight` and index the joints in the order `specs` lists
 * them, which must be the skin's own order (the inspector's `joint[n]`
 * listing). The fallback body poses through the same rig interface, so one
 * behaviour drives whichever body the animal is wearing.
 */
export function buildSkinnedBody(
  geometry: BufferGeometry,
  specs: readonly JointSpec[],
  material: Material,
  boundingSphere: Sphere,
): { mesh: SkinnedMesh; bones: Bone[]; skeleton: Skeleton } {
  const bones: Bone[] = specs.map((spec) => {
    const bone = new Bone();
    bone.name = spec.name;
    return bone;
  });

  const offset = new Vector3();
  specs.forEach((spec, index) => {
    const bone = bones[index]!;
    const x = new Vector3(...spec.x);
    const y = new Vector3(...spec.y);
    const z = new Vector3().crossVectors(x, y);
    const orientation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
    if (spec.parent === null) {
      bone.position.set(spec.origin[0], spec.origin[1], spec.origin[2]);
      bone.quaternion.copy(orientation);
      return;
    }
    const parentSpec = specs[spec.parent]!;
    const parentBone = bones[spec.parent]!;
    // Local frame = parent's inverse * global frame; with identical axes
    // down a spine chain this is the identity orientation plus an offset.
    const inverse = parentBone.quaternion.clone().invert();
    offset.set(
      spec.origin[0] - parentSpec.origin[0],
      spec.origin[1] - parentSpec.origin[1],
      spec.origin[2] - parentSpec.origin[2],
    );
    bone.position.copy(offset.applyQuaternion(inverse));
    bone.quaternion.copy(inverse).multiply(orientation);
    parentBone.add(bone);
  });

  // Three bounds a skinned mesh from the pose at first render only; an
  // explicit sphere with motion headroom keeps a mid-swing animal from
  // being culled with its extremes outside.
  geometry.boundingSphere = boundingSphere;

  const mesh = new SkinnedMesh(geometry, material);
  const root = bones.find((_, index) => specs[index]!.parent === null)!;
  mesh.add(root);
  const skeleton = new Skeleton(bones);
  mesh.bind(skeleton);
  return { mesh, bones, skeleton };
}

/**
 * Releases a retired stand-in's own resources; materials shared with the
 * arrived GLB (or anywhere else) are named in `keep` and left alone. The
 * turtle's `retireFallback`, generalised only by the keep-set.
 */
export function retireFallback(
  fallback: Object3D,
  keep: ReadonlySet<Material>,
  disposeOwned: (resource: BufferGeometry | Material) => void,
): void {
  const seen = new Set<BufferGeometry | Material>();
  fallback.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }
    seen.add(node.geometry as BufferGeometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!keep.has(material as Material)) {
        seen.add(material as Material);
      }
    }
  });
  for (const resource of seen) {
    disposeOwned(resource);
  }
}
