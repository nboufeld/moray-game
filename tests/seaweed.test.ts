import { describe, expect, it } from "vitest";
import { InstancedMesh, Matrix4, Scene, Vector3 } from "three";
import { isClear } from "../src/world/CoralField";
import { DistantReef } from "../src/world/DistantReef";
import { Seaweed } from "../src/world/Seaweed";
import { SEEDS } from "../src/util/Random";

/**
 * W-L9's two new modules, checked in plain Node under the same rules as the
 * kelp: deterministic from their seeds, DOM-free at construction, disposable,
 * and never standing where the game is played.
 */

function instancePositions(seaweed: Seaweed): Vector3[] {
  const positions: Vector3[] = [];
  const matrix = new Matrix4();
  for (const child of seaweed.group.children) {
    if (!(child instanceof InstancedMesh)) {
      continue;
    }
    for (let i = 0; i < child.count; i++) {
      child.getMatrixAt(i, matrix);
      positions.push(new Vector3().setFromMatrixPosition(matrix));
    }
  }
  return positions;
}

describe("the seaweed accents", () => {
  it("comes to two instanced draws, neither casting a shadow", () => {
    const seaweed = new Seaweed();
    const meshes = seaweed.group.children.filter(
      (child): child is InstancedMesh => child instanceof InstancedMesh,
    );
    expect(meshes).toHaveLength(2);
    for (const mesh of meshes) {
      expect(mesh.castShadow).toBe(false);
    }
    seaweed.dispose();
  });

  it("grows the same accents from the same seed", () => {
    const first = instancePositions(new Seaweed(SEEDS.seaweed));
    const second = instancePositions(new Seaweed(SEEDS.seaweed));
    expect(first.length).toBe(second.length);
    expect(first.length).toBeGreaterThan(20);
    for (let i = 0; i < first.length; i++) {
      expect(first[i]!.distanceToSquared(second[i]!)).toBe(0);
    }
  });

  it("stands only where the coral's own law says a plant may stand", () => {
    // `isClear` carries the crevice rings, the mounds, the three approach
    // corridors and the anemone disc; the seaweed imports it rather than
    // copying it, so this is the rule reading itself back.
    for (const position of instancePositions(new Seaweed())) {
      expect(isClear(position.x, position.z), `at (${position.x}, ${position.z})`).toBe(true);
    }
  });

  it("runs a minute of frames and lets go of everything after it", () => {
    const seaweed = new Seaweed();
    const scene = new Scene();
    scene.add(seaweed.group);
    for (let i = 0; i < 3600; i++) {
      seaweed.update(1 / 60, false);
    }
    seaweed.update(1 / 60, true);
    seaweed.dispose();
    expect(scene.children).not.toContain(seaweed.group);
    expect(seaweed.group.children).toHaveLength(0);
    seaweed.dispose();
  });
});

describe("the distant reef", () => {
  it("stands entirely beyond the playable bowl and casts nothing", () => {
    const distant = new DistantReef();
    let layers = 0;
    for (const child of distant.group.children) {
      if (!("geometry" in child)) {
        continue;
      }
      layers++;
      const mesh = child as unknown as {
        castShadow: boolean;
        receiveShadow: boolean;
        geometry: { attributes: { position: { count: number; getX(i: number): number; getZ(i: number): number } } };
      };
      expect(mesh.castShadow).toBe(false);
      expect(mesh.receiveShadow).toBe(false);
      const position = mesh.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        expect(Math.hypot(position.getX(i), position.getZ(i))).toBeGreaterThan(46);
      }
    }
    expect(layers).toBeGreaterThanOrEqual(2);
    distant.dispose();
    expect(distant.group.children).toHaveLength(0);
  });

  it("builds the same skyline from the same seed", () => {
    const skyline = (reef: DistantReef): number[] => {
      const heights: number[] = [];
      for (const child of reef.group.children) {
        const mesh = child as unknown as {
          geometry?: { attributes: { position: { count: number; getY(i: number): number } } };
        };
        if (!mesh.geometry) {
          continue;
        }
        const position = mesh.geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
          heights.push(position.getY(i));
        }
      }
      return heights;
    };
    expect(skyline(new DistantReef())).toEqual(skyline(new DistantReef()));
  });
});
