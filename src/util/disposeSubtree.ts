import { Mesh, SkinnedMesh, type Object3D } from "three";

/**
 * Releases the geometries, materials and skeletons under `root`.
 *
 * Anything that rebuilds a group of creatures — the sanctuary on every
 * discovery, a one-off codex portrait — has to call this, or the GPU copies
 * accumulate for the rest of the session. It deliberately leaves textures
 * alone: moray skins are cached per species and shared with the animals still
 * in the reef, so disposing them here would strip the living scene.
 *
 * A skeleton is the exception to that, because it is not shared: it holds a
 * float texture of one animal's bone matrices, uploaded per skeleton and owned
 * by nothing else. Two skinned meshes can share one — a moray's body and its
 * dorsal fin do — and disposing it twice is safe.
 */
export function disposeSubtree(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material.dispose();
    }
    if (object instanceof SkinnedMesh) {
      object.skeleton.dispose();
    }
  });
}
