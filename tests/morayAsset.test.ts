import { describe, expect, it } from "vitest";
import { Object3D, Vector3 } from "three";
import { Moray } from "../src/creatures/morays/Moray";
import { MorayRegistry } from "../src/creatures/morays/MorayRegistry";
import { MORAY_SPECIES } from "../src/creatures/morays/MoraySpeciesConfig";

describe("Moray asset contract", () => {
  it("ships four vertical-slice species", () => {
    const registry = new MorayRegistry();
    expect(registry.size).toBe(4);
    for (const id of ["snowflake-moray", "ribbon-moray", "zebra-moray", "dragon-moray"]) {
      expect(registry.has(id)).toBe(true);
    }
  });

  it("gives each species a distinct silhouette archetype set", () => {
    const archetypes = new Set(MORAY_SPECIES.map((s) => s.archetype));
    // Four species should not all collapse to one body archetype.
    expect(archetypes.size).toBeGreaterThanOrEqual(3);
  });

  it("builds every species with the required named runtime nodes", () => {
    for (const config of MORAY_SPECIES) {
      const moray = new Moray(config);
      const asset = moray.asset;
      expect(asset.speciesId).toBe(config.id);
      for (const node of [asset.root, asset.bodyRoot, asset.head, asset.upperJaw, asset.lowerJaw, asset.leftEye, asset.rightEye]) {
        expect(node).toBeInstanceOf(Object3D);
      }
    }
  });

  it("reports a stable head world position and animates without error", () => {
    const moray = new Moray(MORAY_SPECIES[0]!);
    moray.asset.root.position.set(1, 2, 3);
    moray.asset.root.updateMatrixWorld(true);
    const head = moray.getHeadWorldPosition(new Vector3());
    expect(head.x).toBeCloseTo(1, 1);
    // Stepping the animation should not throw and should keep the head finite.
    moray.update(1 / 60, new Vector3(0, 2, 10), false);
    const head2 = moray.getHeadWorldPosition(new Vector3());
    expect(Number.isFinite(head2.y)).toBe(true);
  });
});
