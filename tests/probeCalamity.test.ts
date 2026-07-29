import { InstancedMesh, Mesh, Points, Scene, type Object3D } from "three";
import { describe, it } from "vitest";
// Seabed first — the same load-bearing import order as the region's tests.
import "../src/world/Seabed";
import { CALAMITY_1 } from "../src/world/regions/calamity1/Calamity1";

/** A temporary measurement probe — deleted before handoff. */
describe("probe", () => {
  it("measures the region", () => {
    const build = CALAMITY_1.build(new Scene());
    let draws = 0;
    let triangles = 0;
    const byName: { name: string; tris: number }[] = [];
    (build.group as Object3D).traverse((node) => {
      if (node instanceof Mesh || node instanceof Points) {
        draws++;
        const geometry = (node as Mesh).geometry;
        const index = geometry.getIndex();
        const per = index
          ? index.count / 3
          : (geometry.attributes.position?.count ?? 0) / (node instanceof Points ? 1 : 3);
        const instances = node instanceof InstancedMesh ? node.count : 1;
        if (!(node instanceof Points)) {
          triangles += per * instances;
          byName.push({ name: node.name, tris: per * instances });
        }
      }
    });
    byName.sort((a, b) => b.tris - a.tris);
    console.info(`DRAWS ${draws} TRIS ${triangles} COLLIDERS ${build.colliders.length}`);
    for (const row of byName.slice(0, 24)) {
      console.info(`  ${row.name}: ${Math.round(row.tris)}`);
    }
  });
});
