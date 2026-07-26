import { describe, expect, it } from "vitest";
import { Matrix4, Quaternion, Vector3 } from "three";
import { Bubbles } from "../src/rendering/Bubbles";
import { disposeSubtree } from "../src/util/disposeSubtree";
import { seabedHeight } from "../src/world/Seabed";

const COUNT = 12;
const VENTS = [
  [2, 3],
  [-4, 1],
] as const;

function instance(bubbles: Bubbles, index: number): { position: Vector3; scale: Vector3 } {
  const matrix = new Matrix4();
  bubbles.mesh.getMatrixAt(index, matrix);
  const position = new Vector3();
  const scale = new Vector3();
  matrix.decompose(position, new Quaternion(), scale);
  return { position, scale };
}

function positions(bubbles: Bubbles): Vector3[] {
  return Array.from({ length: COUNT }, (_, i) => instance(bubbles, i).position);
}

describe("Bubbles", () => {
  it("draws every bubble from one instanced mesh", () => {
    const bubbles = new Bubbles(COUNT, VENTS);
    expect(bubbles.mesh.count).toBe(COUNT);
    expect(bubbles.mesh.material).toBeTruthy();
    // Every instance moves every frame, so a cached bounding sphere would be
    // stale before it was read.
    expect(bubbles.mesh.frustumCulled).toBe(false);
  });

  it("starts each thread already strung out up its column", () => {
    // Otherwise the first frame of a capture shows four clumps leaving the sand
    // together, which is the one arrangement a vent never produces.
    const heights = positions(new Bubbles(COUNT, VENTS)).map((position) => position.y);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(2);
  });

  it("rises from the sand at its vents", () => {
    const bubbles = new Bubbles(COUNT, VENTS);
    for (const position of positions(bubbles)) {
      const nearest = Math.min(
        ...VENTS.map(([x, z]) => Math.hypot(position.x - x, position.z - z)),
      );
      // Vent spread plus the sway, and nothing like the distance to the other
      // vent.
      expect(nearest).toBeLessThan(1);
      expect(position.y).toBeGreaterThanOrEqual(seabedHeight(position.x, position.z));
    }
  });

  it("climbs at roughly walking pace and recycles at its ceiling", () => {
    const bubbles = new Bubbles(COUNT, VENTS);
    const before = positions(bubbles).map((position) => position.y);
    bubbles.update(1, false);
    const after = positions(bubbles).map((position) => position.y);

    let recycled = 0;
    after.forEach((y, i) => {
      const climb = y - before[i]!;
      if (climb < 0) {
        recycled++;
        return;
      }
      // 0.4 m/s, spread by a quarter either way, plus the sway's contribution.
      expect(climb).toBeGreaterThan(0.2);
      expect(climb).toBeLessThan(0.8);
    });
    // Over one second at most one of a dozen bubbles should have reached the
    // top of a six-to-eight metre column.
    expect(recycled).toBeLessThanOrEqual(1);

    // Nothing ever climbs out of the water: a ceiling is a hard limit, not a
    // fade the animation happens to reach.
    for (let i = 0; i < 400; i++) {
      bubbles.update(1 / 60, false);
    }
    for (const position of positions(bubbles)) {
      expect(position.y).toBeLessThan(9);
    }
  });

  it("shrinks a bubble away at both ends of its climb", () => {
    // The envelope, not an opacity: every instance shares one material, and the
    // fade is what keeps a sprite from being switched on in mid-water.
    const bubbles = new Bubbles(COUNT, VENTS);
    let sawFull = false;
    for (let frame = 0; frame < 600; frame++) {
      bubbles.update(1 / 30, false);
      for (let i = 0; i < COUNT; i++) {
        const { position, scale } = instance(bubbles, i);
        expect(scale.x).toBeGreaterThanOrEqual(0);
        expect(scale.x).toBeLessThan(0.4);
        if (position.y - seabedHeight(position.x, position.z) < 0.2) {
          // Just off the sand, a bubble is still growing into itself.
          expect(scale.x).toBeLessThan(0.2);
        }
        sawFull ||= scale.x > 0.1;
      }
    }
    expect(sawFull).toBe(true);
  });

  it("slows down under reduced motion", () => {
    const calm = new Bubbles(COUNT, VENTS);
    const busy = new Bubbles(COUNT, VENTS);
    const start = positions(calm).map((position) => position.y);
    calm.update(0.5, true);
    busy.update(0.5, false);

    const calmClimb = positions(calm)[0]!.y - start[0]!;
    const busyClimb = positions(busy)[0]!.y - start[0]!;
    expect(calmClimb).toBeGreaterThan(0);
    expect(calmClimb).toBeLessThan(busyClimb * 0.6);
  });

  it("turns its sprites to face the camera it is given", () => {
    const bubbles = new Bubbles(COUNT, VENTS);
    const facing = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    bubbles.update(1 / 60, false, facing);

    const matrix = new Matrix4();
    bubbles.mesh.getMatrixAt(0, matrix);
    const rotation = new Quaternion();
    matrix.decompose(new Vector3(), rotation, new Vector3());
    expect(rotation.angleTo(facing)).toBeLessThan(1e-5);
  });

  it("is reproducible from its seed", () => {
    const a = positions(new Bubbles(COUNT, VENTS));
    const b = positions(new Bubbles(COUNT, VENTS));
    a.forEach((position, i) => expect(position.distanceTo(b[i]!)).toBeLessThan(1e-9));
  });

  it("shares one sprite between systems and releases the rest", () => {
    const first = new Bubbles(COUNT, VENTS);
    const second = new Bubbles(COUNT, VENTS);
    // The map is owned by the module, like the shafts' beam and pool maps, so
    // `disposeSubtree` must be free to run without stripping another room.
    expect(first.mesh.material).not.toBe(second.mesh.material);
    expect(first.mesh.material.map).toBe(second.mesh.material.map);

    let disposedGeometry = false;
    let disposedMaterial = false;
    first.mesh.geometry.addEventListener("dispose", () => (disposedGeometry = true));
    first.mesh.material.addEventListener("dispose", () => (disposedMaterial = true));
    disposeSubtree(first.mesh);
    expect(disposedGeometry).toBe(true);
    expect(disposedMaterial).toBe(true);
    expect(second.mesh.material.map).toBeTruthy();
  });
});
