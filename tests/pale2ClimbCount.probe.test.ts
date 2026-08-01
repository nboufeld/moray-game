/**
 * PROBE (not shipped): counts world-space instances standing on the gate
 * climb strip (u 1080–1162, rc 172–212) per instanced mesh, to verify the
 * round-6 polyline resample actually landed its pebbles and tufts.
 */
import { InstancedMesh, Matrix4, Object3D, Scene, Vector3 } from "three";
import { describe, it } from "vitest";
// Import order is load-bearing: `Seabed` runs the registry cycle in the
// direction it tolerates (see regionPale2.test.ts).
import "../src/world/Seabed";
import { PALE_2 } from "../src/world/regions/pale2/Pale2";
import { CENTER_X, CENTER_Z, spokeOf } from "../src/world/regions/pale2/Pale2Terrain";

describe("pale-passage-2 climb strip census", () => {
  it("prints instances inside the climb window per mesh", () => {
    const build = PALE_2.build(new Scene());
    build.group.updateMatrixWorld(true);
    const matrix = new Matrix4();
    const at = new Vector3();
    const counts = new Map<string, number>();
    (build.group as Object3D).traverse((node) => {
      if (!(node instanceof InstancedMesh)) {
        return;
      }
      let inside = 0;
      for (let i = 0; i < node.count; i++) {
        node.getMatrixAt(i, matrix);
        at.setFromMatrixPosition(matrix).applyMatrix4(node.matrixWorld);
        const { u } = spokeOf(at.x, at.z);
        const rc = Math.hypot(at.x - CENTER_X, at.z - CENTER_Z);
        if (u >= 1080 && u <= 1162 && rc >= 172 && rc <= 212) {
          inside += 1;
        }
      }
      if (inside > 0) {
        counts.set(`${node.name || "(unnamed)"} [total ${node.count}]`, inside);
      }
    });
    for (const [name, inside] of counts) {
      console.info(`${name}: ${inside} on the climb strip`);
    }
  });
});
