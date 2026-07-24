import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { CollisionField, type ReefBounds } from "../src/world/CollisionField";

const bounds: ReefBounds = {
  minX: -10,
  maxX: 10,
  minY: 0.5,
  maxY: 10,
  minZ: -10,
  maxZ: 10,
};

describe("CollisionField", () => {
  it("pushes the diver out of a sphere collider", () => {
    const field = new CollisionField([{ center: new Vector3(0, 2, 0), radius: 2 }], bounds);
    const position = new Vector3(0.5, 2, 0);
    field.resolve(position, 0.6);
    const distance = position.distanceTo(new Vector3(0, 2, 0));
    expect(distance).toBeGreaterThanOrEqual(2 + 0.6 - 1e-4);
  });

  it("clamps the diver within reef bounds", () => {
    const field = new CollisionField([], bounds);
    const position = new Vector3(100, -100, 100);
    field.resolve(position, 0.6);
    expect(position.x).toBeLessThanOrEqual(bounds.maxX - 0.6 + 1e-6);
    expect(position.y).toBeGreaterThanOrEqual(bounds.minY + 0.6 - 1e-6);
    expect(position.z).toBeLessThanOrEqual(bounds.maxZ - 0.6 + 1e-6);
  });

  it("leaves a diver in open water untouched", () => {
    const field = new CollisionField([{ center: new Vector3(0, 2, 0), radius: 2 }], bounds);
    const position = new Vector3(6, 5, 6);
    field.resolve(position, 0.6);
    expect(position.equals(new Vector3(6, 5, 6))).toBe(true);
  });
});
