import { describe, expect, it } from "vitest";
import { Mesh, type BufferGeometry, type Material, type Object3D } from "three";
import { MORAY_SPECIES } from "../src/creatures/morays/MoraySpeciesConfig";
import { SanctuaryScene } from "../src/sanctuary/SanctuaryScene";

function collectResources(roots: readonly Object3D[]): {
  geometries: Set<BufferGeometry>;
  materials: Set<Material>;
} {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  for (const root of roots) {
    root.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
      }
    });
  }
  return { geometries, materials };
}

describe("SanctuaryScene", () => {
  it("replaces residents instead of stacking them up", () => {
    const sanctuary = new SanctuaryScene();
    const fixtures = sanctuary.scene.children.length;

    sanctuary.setSpecies(MORAY_SPECIES);
    const populated = sanctuary.scene.children.length;
    expect(sanctuary.residentCount).toBe(MORAY_SPECIES.length);
    expect(populated).toBe(fixtures + MORAY_SPECIES.length);

    sanctuary.setSpecies(MORAY_SPECIES);
    expect(sanctuary.scene.children.length).toBe(populated);
    expect(sanctuary.residentCount).toBe(MORAY_SPECIES.length);
  });

  it("releases the GPU resources of residents it removes", () => {
    const sanctuary = new SanctuaryScene();
    const fixtures = new Set(sanctuary.scene.children);

    sanctuary.setSpecies(MORAY_SPECIES);
    const residentRoots = sanctuary.scene.children.filter((child) => !fixtures.has(child));
    const { geometries, materials } = collectResources(residentRoots);
    expect(geometries.size).toBeGreaterThan(0);
    expect(materials.size).toBeGreaterThan(0);

    const disposed = new Set<BufferGeometry | Material>();
    for (const resource of [...geometries, ...materials]) {
      resource.addEventListener("dispose", () => disposed.add(resource));
    }

    sanctuary.setSpecies([]);

    expect(sanctuary.residentCount).toBe(0);
    expect(disposed.size).toBe(geometries.size + materials.size);
    // The permanent scene fixtures (floor, lights) must survive the rebuild.
    for (const fixture of fixtures) {
      expect(sanctuary.scene.children).toContain(fixture);
    }
  });
});
