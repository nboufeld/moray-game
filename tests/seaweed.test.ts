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
  it("comes to three instanced draws, none casting a shadow", () => {
    // Two since W-L9, three since W11: the lobed cushions and the frond
    // rosettes are joined by the leafy bushes, and the round's seaweed
    // budget of six draws still has three in hand.
    const seaweed = new Seaweed();
    const meshes = seaweed.group.children.filter(
      (child): child is InstancedMesh => child instanceof InstancedMesh,
    );
    expect(meshes).toHaveLength(3);
    for (const mesh of meshes) {
      expect(mesh.castShadow).toBe(false);
    }
    seaweed.dispose();
  });

  it("grows real bushes inside their triangle budget (W11)", () => {
    // The bush layer's contract, in numbers: 48 clumps of curved, cupped
    // leaves, one draw call, and a hard ceiling of 18,000 triangles.
    const seaweed = new Seaweed();
    const leafy = seaweed.group.children.find(
      (child): child is InstancedMesh => child instanceof InstancedMesh && child.name === "seaweed-leafy",
    );
    expect(leafy).toBeDefined();
    const position = leafy!.geometry.attributes.position!;
    const index = leafy!.geometry.index;
    const tris = index ? index.count / 3 : position.count / 3;
    expect(tris * leafy!.count).toBeLessThanOrEqual(18_000);

    // The sizes the brief asked for: 0.5–1.2 m, measured through the
    // instance matrices against the geometry's own span.
    leafy!.geometry.computeBoundingBox();
    const box = leafy!.geometry.boundingBox!;
    const span = box.max.y - box.min.y;
    const matrix = new Matrix4();
    const basisY = new Vector3();
    let low = Infinity;
    let high = -Infinity;
    for (let i = 0; i < leafy!.count; i++) {
      leafy!.getMatrixAt(i, matrix);
      basisY.set(matrix.elements[4], matrix.elements[5], matrix.elements[6]);
      const height = basisY.length() * span;
      low = Math.min(low, height);
      high = Math.max(high, height);
    }
    expect(low).toBeGreaterThanOrEqual(0.49);
    expect(high).toBeLessThanOrEqual(1.21);
    expect(high).toBeGreaterThan(1.0);

    // The warm-underside paint is a multiplier, not a colour: it stays in
    // the same near-1 band the module's other accents keep.
    const color = leafy!.geometry.attributes.color!;
    let paintHigh = -Infinity;
    for (let i = 0; i < color.count; i++) {
      paintHigh = Math.max(paintHigh, color.getX(i), color.getY(i), color.getZ(i));
    }
    expect(paintHigh).toBeLessThanOrEqual(1.1);
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
