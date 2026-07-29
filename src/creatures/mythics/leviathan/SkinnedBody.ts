import {
  Bone,
  Matrix4,
  Mesh,
  Skeleton,
  SkinnedMesh,
  Sphere,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";

/**
 * The pieces the wave-8 monument-scale mythics share, factored out of what
 * `Turtle.ts` proved: `requestModel` delivers bare geometry (the skin's
 * attributes ride along in `skinIndex`/`skinWeight`), so the skeleton is
 * rebuilt here from the joint table measured off the exported GLB — the
 * same table the wave-8 ledger carries — and binding bones that stand in
 * the documented rest pose makes the skinning exactly identity until a bone
 * moves.
 *
 * Also here: the ownership ledger every fallback-wearing body needs. The
 * GLB geometry belongs to the `AssetLibrary` and is shared, so a body must
 * never blanket-`disposeSubtree`; it disposes exactly what it created.
 */

/** One row of a measured joint table: name, rest origin, and the model-space
 * directions the bone's local +X and +Y point (the articulation axis is +Y). */
export interface JointSpec {
  readonly name: string;
  readonly origin: readonly [number, number, number];
  readonly x: readonly [number, number, number];
  readonly y: readonly [number, number, number];
}

/**
 * Builds a `SkinnedMesh` wearing `geometry`, with bones standing in the
 * measured rest pose. Joint order must be the skin's own order — `JOINTS_0`
 * indexes into it and must not be shuffled. The root bone is the first row.
 */
export function buildSkinnedMesh(
  geometry: BufferGeometry,
  joints: readonly JointSpec[],
  material: Material,
  boundingSphere: Sphere,
): { mesh: SkinnedMesh; bones: Bone[] } {
  const bones: Bone[] = [];
  const rootBone = new Bone();
  for (const joint of joints) {
    const bone = joint.name === "root" ? rootBone : new Bone();
    bone.name = joint.name;
    if (bone !== rootBone) {
      bone.position.set(joint.origin[0], joint.origin[1], joint.origin[2]);
      const x = new Vector3(joint.x[0], joint.x[1], joint.x[2]);
      const y = new Vector3(joint.y[0], joint.y[1], joint.y[2]);
      const z = new Vector3().crossVectors(x, y);
      bone.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
      rootBone.add(bone);
    }
    bones.push(bone);
  }

  // Three bounds a skinned mesh from the bones' pose at first render and
  // never again; an explicit sphere with stroke headroom keeps a mid-stroke
  // animal from being culled with its tips outside.
  geometry.boundingSphere = boundingSphere;

  const mesh = new SkinnedMesh(geometry, material);
  mesh.add(rootBone);
  // Bones stand in the documented rest pose, so the default bind is identity.
  mesh.bind(new Skeleton(bones));
  return { mesh, bones };
}

/** What a body created and therefore must dispose; the GLB is not in it. */
export class OwnedResources {
  private readonly owned = new Set<BufferGeometry | Material>();

  own<T extends BufferGeometry | Material>(resource: T): T {
    this.owned.add(resource);
    return resource;
  }

  disposeOwned(resource: BufferGeometry | Material): void {
    if (this.owned.delete(resource)) {
      resource.dispose();
    }
  }

  disposeAll(): void {
    for (const resource of this.owned) {
      resource.dispose();
    }
    this.owned.clear();
  }
}

/**
 * Releases a fallback stand-in's own resources when the GLB lands, sparing
 * the materials named in `keep` (the shared body material survives — the
 * real mesh wears it next).
 */
export function retireFallback(
  fallback: Object3D,
  keep: readonly Material[],
  disposeOwned: (resource: BufferGeometry | Material) => void,
): void {
  const seen = new Set<BufferGeometry | Material>();
  fallback.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }
    seen.add(node.geometry as BufferGeometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!keep.includes(material as Material)) {
        seen.add(material as Material);
      }
    }
  });
  for (const resource of seen) {
    disposeOwned(resource);
  }
}
