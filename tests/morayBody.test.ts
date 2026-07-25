import { describe, expect, it } from "vitest";
import { SkinnedMesh, Vector3 } from "three";
import { Moray } from "../src/creatures/morays/Moray";
import { MORAY_SPECIES } from "../src/creatures/morays/MoraySpeciesConfig";

function skinnedMeshes(moray: Moray): SkinnedMesh[] {
  const found: SkinnedMesh[] = [];
  moray.asset.root.traverse((object) => {
    if (object instanceof SkinnedMesh) {
      found.push(object);
    }
  });
  return found;
}

describe("Moray body rig", () => {
  it("skins one body and one fin to the joint chain of every species", () => {
    for (const config of MORAY_SPECIES) {
      const meshes = skinnedMeshes(new Moray(config));
      // The whole point of the rig: two surfaces, not a stack of them.
      expect(meshes).toHaveLength(2);
      // Both ride the same chain, so a joint cannot move one without the other.
      expect(new Set(meshes.map((mesh) => mesh.skeleton)).size).toBe(1);
    }
  });

  it("weights every vertex to real joints, summing to one", () => {
    for (const config of MORAY_SPECIES) {
      for (const mesh of skinnedMeshes(new Moray(config))) {
        const joints = mesh.skeleton.bones.length;
        const index = mesh.geometry.getAttribute("skinIndex");
        const weight = mesh.geometry.getAttribute("skinWeight");
        expect(index.count).toBe(weight.count);

        let worstSum = 0;
        let highestJoint = -1;
        for (let i = 0; i < index.count; i++) {
          const sum = weight.getX(i) + weight.getY(i) + weight.getZ(i) + weight.getW(i);
          worstSum = Math.max(worstSum, Math.abs(sum - 1));
          highestJoint = Math.max(
            highestJoint,
            index.getX(i),
            index.getY(i),
            index.getZ(i),
            index.getW(i),
          );
        }
        // An unnormalised weight shrinks or inflates the body around that
        // vertex, and an index past the end of the chain reads whatever the
        // bone texture happens to hold there.
        expect(worstSum).toBeLessThan(1e-5);
        expect(highestJoint).toBeLessThan(joints);
      }
    }
  });

  it("runs one skin the whole length of the body", () => {
    const body = skinnedMeshes(new Moray(MORAY_SPECIES[0]!)).find((mesh) =>
      mesh.geometry.hasAttribute("uv"),
    );
    const uv = body?.geometry.getAttribute("uv");
    expect(uv).toBeDefined();

    let lowest = Infinity;
    let highest = -Infinity;
    for (let i = 0; i < uv!.count; i++) {
      lowest = Math.min(lowest, uv!.getY(i));
      highest = Math.max(highest, uv!.getY(i));
    }
    // Head to tail exactly once. Per-ring UVs would repeat the species pattern
    // at every joint, which is what a five-band zebra wearing forty looks like.
    expect(lowest).toBeCloseTo(0, 6);
    expect(highest).toBeCloseTo(1, 6);
  });

  it("keeps the head where the discovery system expects it", () => {
    const moray = new Moray(MORAY_SPECIES[3]!);
    moray.asset.root.position.set(-6, 1.6, -9);
    moray.asset.root.rotation.y = 0.4;

    for (let step = 0; step < 120; step++) {
      moray.update(1 / 60, new Vector3(0, 2, 8), true, 0.5);
    }
    moray.asset.root.updateMatrixWorld(true);

    // The head hangs off the body root, not off the first joint, so nothing the
    // body does can move it — the focus cone, `DiscoverySystem` and the
    // sightline raycast are all tuned against exactly this point.
    const head = moray.getHeadWorldPosition(new Vector3());
    expect(head.x).toBe(-6);
    expect(head.y).toBe(1.6);
    expect(head.z).toBe(-9);
  });
});
