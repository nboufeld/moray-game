import { Mesh, type Object3D } from "three";

/**
 * Releases the geometries and materials under `root`.
 *
 * Anything that rebuilds a group of creatures — the sanctuary on every
 * discovery, a one-off codex portrait — has to call this, or the GPU copies
 * accumulate for the rest of the session. It deliberately leaves textures
 * alone: moray skins are cached per species and shared with the animals still
 * in the reef, so disposing them here would strip the living scene.
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
  });
}
