import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { DiscoverySystem, type DiscoveryTarget } from "../src/discovery/DiscoverySystem";

function makeTarget(): DiscoveryTarget {
  return { speciesId: "snowflake-moray", position: new Vector3(0, 0, -5) };
}

describe("DiscoverySystem", () => {
  it("discovers a focused target and records it once", () => {
    const target = makeTarget();
    const system = new DiscoverySystem([target]);
    const probe = {
      cameraPosition: new Vector3(0, 0, 0),
      forward: new Vector3(0, 0, -1),
      isObstructed: () => false,
    };

    let discoveries = 0;
    for (let i = 0; i < 200; i++) {
      const result = system.update(probe, 1 / 60);
      if (result.newlyDiscovered) {
        discoveries++;
      }
    }

    expect(discoveries).toBe(1);
    expect(system.discoveredCount).toBe(1);
    expect(system.isDiscovered("snowflake-moray")).toBe(true);
    expect(system.discoveredIds()).toEqual(["snowflake-moray"]);
  });

  it("does not discover when the player looks away", () => {
    const system = new DiscoverySystem([makeTarget()]);
    const probe = {
      cameraPosition: new Vector3(0, 0, 0),
      forward: new Vector3(0, 0, 1), // facing away
      isObstructed: () => false,
    };

    for (let i = 0; i < 200; i++) {
      system.update(probe, 1 / 60);
    }
    expect(system.discoveredCount).toBe(0);
  });

  it("reports the correct total count", () => {
    const system = new DiscoverySystem([makeTarget()]);
    expect(system.totalCount).toBe(1);
  });
});
