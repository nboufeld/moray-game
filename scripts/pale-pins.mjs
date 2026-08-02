/**
 * One-shot helper: prints the PRE-FILL landmark coordinates the reroll
 * fence pins (first/last bone-tree spot, first monument matrix position,
 * the cathedral, the gardener target). Run BEFORE any fill stream lands,
 * delete after the pins are in the test file.
 */
import { Scene, InstancedMesh, Matrix4, Vector3 } from "three";
// Import order is load-bearing (the documented registry cycle): Seabed
// first, then the def module.
import "../src/world/Seabed.ts";
import { PALE_1 } from "../src/world/regions/pale1/Pale1.ts";

const build = PALE_1.build(new Scene());
const matrix = new Matrix4();
const at = new Vector3();
build.group.traverse((node) => {
  if (!(node instanceof InstancedMesh)) {
    return;
  }
  if (node.name.startsWith("pale-bone-trees-") || node.name === "pale-monument-0") {
    node.getMatrixAt(0, matrix);
    at.setFromMatrixPosition(matrix);
    console.log(`${node.name}[0]`, at.x, at.y, at.z, "count", node.count);
    node.getMatrixAt(node.count - 1, matrix);
    at.setFromMatrixPosition(matrix);
    console.log(`${node.name}[last]`, at.x, at.y, at.z);
  }
});
build.group.traverse((node) => {
  if (node.name === "pale-bone-cathedral") {
    node.geometry.computeBoundingSphere();
    const s = node.geometry.boundingSphere;
    console.log("cathedral sphere", s.center.x, s.center.y, s.center.z, s.radius);
  }
});
const target = build.targets[0];
console.log("gardener", target.position.x, target.position.y, target.position.z);
