import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { DiveController, NO_INPUT } from "../src/player/DiveController";

describe("DiveController", () => {
  it("swims forward along -Z at yaw 0", () => {
    const dive = new DiveController({ startPosition: new Vector3(0, 2, 0) });
    for (let i = 0; i < 30; i++) {
      dive.update(1 / 60, { ...NO_INPUT, forward: true }, 0);
    }
    expect(dive.position.z).toBeLessThan(-0.5);
    expect(Math.abs(dive.position.x)).toBeLessThan(1e-6);
    expect(dive.velocity.z).toBeLessThan(0);
  });

  it("strafes right along +X at yaw 0", () => {
    const dive = new DiveController({ startPosition: new Vector3(0, 2, 0) });
    for (let i = 0; i < 30; i++) {
      dive.update(1 / 60, { ...NO_INPUT, right: true }, 0);
    }
    expect(dive.position.x).toBeGreaterThan(0.5);
  });

  it("rotates the movement basis with yaw", () => {
    const dive = new DiveController({ startPosition: new Vector3(0, 2, 0) });
    const yaw = Math.PI / 2; // face -X
    for (let i = 0; i < 30; i++) {
      dive.update(1 / 60, { ...NO_INPUT, forward: true }, yaw);
    }
    expect(dive.position.x).toBeLessThan(-0.5);
    expect(Math.abs(dive.position.z)).toBeLessThan(0.2);
  });

  it("ascends and descends independently of heading", () => {
    const yaw = 1.23; // an arbitrary heading the vertical axis must ignore
    const up = new DiveController({ startPosition: new Vector3(0, 2, 0) });
    for (let i = 0; i < 20; i++) {
      up.update(1 / 60, { ...NO_INPUT, ascend: true }, yaw);
    }
    expect(up.position.y).toBeGreaterThan(2);
    expect(Math.abs(up.position.x)).toBeLessThan(1e-6);
    expect(Math.abs(up.position.z)).toBeLessThan(1e-6);

    const down = new DiveController({ startPosition: new Vector3(0, 2, 0) });
    for (let i = 0; i < 20; i++) {
      down.update(1 / 60, { ...NO_INPUT, descend: true }, yaw);
    }
    expect(down.position.y).toBeLessThan(2);
    expect(Math.abs(down.position.x)).toBeLessThan(1e-6);
    expect(Math.abs(down.position.z)).toBeLessThan(1e-6);
  });

  it("drags to a near stop when input is released", () => {
    const dive = new DiveController({ startPosition: new Vector3(0, 2, 0) });
    for (let i = 0; i < 20; i++) {
      dive.update(1 / 60, { ...NO_INPUT, forward: true }, 0);
    }
    for (let i = 0; i < 240; i++) {
      dive.update(1 / 60, NO_INPUT, 0);
    }
    expect(dive.velocity.length()).toBeLessThan(0.05);
  });

  it("never exceeds max speed", () => {
    const dive = new DiveController({ maxSpeed: 5 });
    for (let i = 0; i < 600; i++) {
      dive.update(1 / 60, { ...NO_INPUT, forward: true, right: true }, 0.4);
    }
    expect(dive.velocity.length()).toBeLessThanOrEqual(5 + 1e-6);
  });
});
