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

  it("gives the focus slot to a moray in range over a better-aligned distant one", () => {
    // The far moray is dead ahead (dot 1.0) but well beyond focus range, while
    // the near one is slightly off-centre yet inside the cone.
    const near: DiscoveryTarget = { speciesId: "near-moray", position: new Vector3(1, 0, -5) };
    const far: DiscoveryTarget = { speciesId: "far-moray", position: new Vector3(0, 0, -40) };
    const system = new DiscoverySystem([near, far]);
    const probe = {
      cameraPosition: new Vector3(0, 0, 0),
      forward: new Vector3(0, 0, -1),
      isObstructed: () => false,
    };

    expect(system.update(probe, 1 / 60).focused?.speciesId).toBe("near-moray");

    for (let i = 0; i < 200; i++) {
      system.update(probe, 1 / 60);
    }
    expect(system.isDiscovered("near-moray")).toBe(true);
  });

  it("focuses nothing while every moray is out of range", () => {
    const far: DiscoveryTarget = { speciesId: "far-moray", position: new Vector3(0, 0, -40) };
    const system = new DiscoverySystem([far]);
    const result = system.update(
      {
        cameraPosition: new Vector3(0, 0, 0),
        forward: new Vector3(0, 0, -1),
        isObstructed: () => false,
      },
      1 / 60,
    );

    expect(result.focused).toBeNull();
    expect(result.progress).toBe(0);
  });

  it("decays a part-focused moray while the player studies another one", () => {
    const ahead: DiscoveryTarget = { speciesId: "ahead-moray", position: new Vector3(0, 0, -5) };
    const behind: DiscoveryTarget = { speciesId: "behind-moray", position: new Vector3(0, 0, 5) };
    const system = new DiscoverySystem([ahead, behind]);

    const cameraPosition = new Vector3(0, 0, 0);
    const isObstructed = () => false;
    const lookAhead = { cameraPosition, forward: new Vector3(0, 0, -1), isObstructed };
    const lookBehind = { cameraPosition, forward: new Vector3(0, 0, 1), isObstructed };

    // Hold half of the required focus on the moray ahead.
    for (let i = 0; i < 45; i++) {
      system.update(lookAhead, 1 / 60);
    }
    expect(system.update(lookAhead, 0).progress).toBeGreaterThan(0.4);

    // Turn around and study the other one for a full second.
    for (let i = 0; i < 60; i++) {
      system.update(lookBehind, 1 / 60);
    }

    // Coming back must start the hold again rather than resume banked progress.
    const resumed = system.update(lookAhead, 1 / 60);
    expect(resumed.focused?.speciesId).toBe("ahead-moray");
    expect(resumed.progress).toBeLessThan(0.1);
  });
});
