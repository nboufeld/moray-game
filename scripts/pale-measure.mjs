/** One-shot budget probe: draws/triangles per mesh and totals. */
import { Scene, InstancedMesh, Mesh, Points } from "three";
import "../src/world/Seabed.ts";
import { PALE_1 } from "../src/world/regions/pale1/Pale1.ts";

const build = PALE_1.build(new Scene());
let draws = 0;
let triangles = 0;
const rows = [];
build.group.traverse((node) => {
  if (node instanceof Mesh || node instanceof Points) {
    draws++;
    const geometry = node.geometry;
    const index = geometry.getIndex();
    const per = index
      ? index.count / 3
      : (geometry.attributes.position?.count ?? 0) / (node instanceof Points ? 1 : 3);
    const instances = node instanceof InstancedMesh ? node.count : 1;
    const tris = node instanceof Points ? 0 : per * instances;
    triangles += tris;
    rows.push([node.name || "(anon)", instances, Math.round(tris)]);
  }
});
rows.sort((a, b) => b[2] - a[2]);
for (const [name, instances, tris] of rows) {
  console.log(String(tris).padStart(8), String(instances).padStart(6), name);
}
console.log("TOTAL draws", draws, "triangles", Math.round(triangles));
