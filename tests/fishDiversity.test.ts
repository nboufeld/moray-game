import { describe, expect, it } from "vitest";
import { Scene, Vector3, type BufferGeometry, type Material, type Mesh } from "three";
import { createFishGeometry } from "../src/creatures/fish/FishGeometry";
import { FishSchoolSystem } from "../src/creatures/fish/FishSchoolSystem";
import { FISH_SPECIES } from "../src/creatures/fish/FishSpecies";
import { coralFeedingSites } from "../src/world/CoralField";

/**
 * The fish community (W-L4), tested in plain Node like every other creature
 * system: no WebGL, no document — geometry, colours, seeding and motion are
 * all constructible and steppable without a renderer.
 */

/**
 * The four crevice mouths, copied as literals the way `Seabed` copies them:
 * the wanderer's patrol loops are authored to stay clear of the places the
 * game asks the player to hold still and stare at, and a fish is not in
 * `obstructionMeshes`, so nothing downstream would ever notice if a loop
 * drifted onto a mouth. `tests/coralGarden.test.ts` guards these literals
 * against the real `Reef`.
 */
const CREVICE_MOUTHS: readonly (readonly [number, number])[] = [
  [0, 1.5],
  [-13, 6],
  [13, 6],
  [-6, -9],
];

const VIEWER = new Vector3(0, 2, 22);

function makeSystem(): FishSchoolSystem {
  return new FishSchoolSystem();
}

/** Steps the system as the game would, far enough for every path to unfold. */
function settle(system: FishSchoolSystem, steps: number, dt = 1 / 30): void {
  for (let i = 0; i < steps; i++) {
    system.update(dt, false, VIEWER);
  }
}

function meshByName(system: FishSchoolSystem, name: string): Mesh {
  const mesh = system.meshes.find((candidate) => candidate.name === `fish-${name}`);
  if (!mesh) {
    throw new Error(`no mesh for species ${name}`);
  }
  return mesh;
}

function translations(system: FishSchoolSystem, name: string): Vector3[] {
  const mesh = meshByName(system, name);
  const array = (mesh as unknown as { instanceMatrix: { array: Float32Array } }).instanceMatrix.array;
  const count = (mesh as unknown as { count: number }).count;
  const points: Vector3[] = [];
  for (let i = 0; i < count; i++) {
    points.push(new Vector3(array[i * 16 + 12], array[i * 16 + 13], array[i * 16 + 14]));
  }
  return points;
}

describe("the species table", () => {
  it("holds four to six species with distinct names and colours", () => {
    expect(FISH_SPECIES.length).toBeGreaterThanOrEqual(4);
    expect(FISH_SPECIES.length).toBeLessThanOrEqual(6);
    expect(new Set(FISH_SPECIES.map((s) => s.name)).size).toBe(FISH_SPECIES.length);
    expect(new Set(FISH_SPECIES.map((s) => s.color)).size).toBe(FISH_SPECIES.length);
  });

  it("redistributes the population rather than ballooning it", () => {
    const total = FISH_SPECIES.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBeGreaterThanOrEqual(120);
    expect(total).toBeLessThanOrEqual(180);
  });

  it("keeps each count consistent with its behaviour's own arithmetic", () => {
    for (const species of FISH_SPECIES) {
      const behaviour = species.behaviour;
      if (behaviour.kind === "hover") {
        expect(species.count).toBe(behaviour.siteIndices.length * behaviour.perSite);
      }
      if (behaviour.kind === "patrol") {
        expect(species.count).toBe(behaviour.routes.length);
      }
      if (behaviour.kind === "shoal") {
        // Whole shoals: a remainder is a shoal that is quietly smaller than
        // every other, forever.
        expect(species.count % behaviour.shoalCount).toBe(0);
      }
    }
  });

  it("anchors every hover site index inside the authored coral sites", () => {
    const sites = coralFeedingSites();
    for (const species of FISH_SPECIES) {
      if (species.behaviour.kind !== "hover") {
        continue;
      }
      for (const index of species.behaviour.siteIndices) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(sites.length);
      }
    }
  });
});

describe("the meshes", () => {
  it("builds one InstancedMesh per species, and `mesh` stays the fusilier", () => {
    const system = makeSystem();
    expect(system.meshes.length).toBe(FISH_SPECIES.length);
    // The probe contract: `probe-fish.mjs` masks and measures `fish.mesh`,
    // which must remain the big mid-water school.
    expect(system.mesh).toBe(system.meshes[0]);
    expect(system.mesh.name).toBe("fish-fusilier");
    for (let i = 0; i < FISH_SPECIES.length; i++) {
      const species = FISH_SPECIES[i]!;
      const mesh = system.meshes[i]!;
      expect(mesh.name).toBe(`fish-${species.name}`);
      expect(mesh.count).toBe(species.count);
      expect(mesh.castShadow).toBe(false);
      expect(mesh.frustumCulled).toBe(false);
    }
  });

  it("adds every species to the scene", () => {
    const system = makeSystem();
    const scene = new Scene();
    system.addTo(scene);
    for (const mesh of system.meshes) {
      expect(scene.children).toContain(mesh);
    }
  });

  it("gives every species its own program cache key, so five sway constants get five programs", () => {
    const system = makeSystem();
    const keys = system.meshes.map((mesh) => (mesh.material as Material).customProgramCacheKey());
    expect(new Set(keys).size).toBe(system.meshes.length);
  });

  it("sculpts every species as one indexed loft inside the 110-triangle budget", () => {
    const system = makeSystem();
    for (const mesh of system.meshes) {
      const geometry = mesh.geometry as BufferGeometry;
      // One welded loft — there is no merge to fail, so "every fish lost its
      // tail" is a shape assertion now rather than a null check. 58 vertices
      // is the full sculpt (tube, sail, crescent, pectorals); anything at or
      // below the old sphere's 42 is a body that shed a part.
      expect(geometry.getIndex()).not.toBeNull();
      expect(geometry.attributes.position!.count).toBeGreaterThan(42);
      const triangles = geometry.getIndex()!.count / 3;
      // The wave-8 budget: sculpted, but lean enough to instance 152 of.
      expect(triangles).toBeGreaterThan(90);
      expect(triangles).toBeLessThanOrEqual(110);
    }
  });

  it("points the nose forward and forks the tail past it, on every species", () => {
    const system = makeSystem();
    for (const mesh of system.meshes) {
      const geometry = mesh.geometry as BufferGeometry;
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      // The swim shader reads `-transformed.z` as tailward: the nose must be
      // the +z end, and the tail's lobes must reach measurably past it.
      expect(box.max.z).toBeGreaterThan(0.1);
      expect(box.min.z).toBeLessThan(-1.2 * box.max.z);
    }
  });

  it("winds every triangle outward — a positive signed volume, so the toon ramp lights the outside", () => {
    for (const species of FISH_SPECIES) {
      const geometry = createFishGeometry(species.body);
      const position = geometry.attributes.position!;
      const index = geometry.getIndex()!;
      let volume = 0;
      for (let t = 0; t < index.count; t += 3) {
        const a = index.getX(t);
        const b = index.getX(t + 1);
        const c = index.getX(t + 2);
        const ax = position.getX(a);
        const ay = position.getY(a);
        const az = position.getZ(a);
        const bx = position.getX(b);
        const by = position.getY(b);
        const bz = position.getZ(b);
        const cx = position.getX(c);
        const cy = position.getY(c);
        const cz = position.getZ(c);
        volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      }
      expect(volume, species.name).toBeGreaterThan(0);
    }
  });

  it("raises a dorsal sail above the body tube, and varies the silhouette per species", () => {
    const system = makeSystem();
    const spans = new Map<string, { x: number; y: number; z: number; maxX: number; maxY: number }>();
    for (let i = 0; i < FISH_SPECIES.length; i++) {
      const species = FISH_SPECIES[i]!;
      const geometry = system.meshes[i]!.geometry as BufferGeometry;
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      // The sail rises past the body tube (0.74 in the tube's own units);
      // without it the fish is the old lozenge with a tail.
      expect(geometry.boundingBox!.max.y, species.name).toBeGreaterThan(0.13 * species.body.height * 0.76);
      spans.set(species.name, {
        x: box.max.x - box.min.x,
        y: box.max.y - box.min.y,
        z: box.max.z - box.min.z,
        maxX: box.max.x,
        maxY: box.max.y,
      });
    }
    const needle = spans.get("needlefish")!;
    const tang = spans.get("tang")!;
    const wrasse = spans.get("wrasse")!;
    // The lance, the disc and the fuller wanderer, as proportions.
    expect(needle.z / needle.x).toBeGreaterThan(8);
    expect(tang.y / tang.x).toBeGreaterThan(6);
    expect(wrasse.maxX).toBeGreaterThan(tang.maxX * 3);
  });

  it("rebuilds every species' body bit for bit from the same profile", () => {
    for (const species of FISH_SPECIES) {
      const a = createFishGeometry(species.body);
      const b = createFishGeometry(species.body);
      expect([...(b.attributes.position!.array as Float32Array)]).toEqual([
        ...(a.attributes.position!.array as Float32Array),
      ]);
      expect([...(b.attributes.color!.array as Float32Array)]).toEqual([
        ...(a.attributes.color!.array as Float32Array),
      ]);
    }
  });

  it("counter-shades in vertex colours, capped at 1 with exactly one eye per cheek above it", () => {
    const system = makeSystem();
    for (const mesh of system.meshes) {
      const geometry = mesh.geometry as BufferGeometry;
      const colors = geometry.attributes.color;
      expect(colors).toBeDefined();
      let eyeEntries = 0;
      for (let i = 0; i < colors!.count * 3; i++) {
        const value = (colors!.array as Float32Array)[i]!;
        if (value === 1.5) {
          eyeEntries++;
          continue;
        }
        // The ramp itself stays at or under the material colour; the belly's
        // warm tilt reaches 1.02 on the red channel and nothing else may.
        expect(value).toBeLessThanOrEqual(1.05);
        expect(value).toBeGreaterThan(0.5);
      }
      // Two eye vertices, three channels each.
      expect(eyeEntries).toBe(6);
    }
  });
});

describe("the motion", () => {
  it("is deterministic: two systems stepped identically write identical matrices", () => {
    const first = makeSystem();
    const second = makeSystem();
    settle(first, 120);
    settle(second, 120);
    for (let i = 0; i < first.meshes.length; i++) {
      const a = (first.meshes[i] as unknown as { instanceMatrix: { array: Float32Array } })
        .instanceMatrix.array;
      const b = (second.meshes[i] as unknown as { instanceMatrix: { array: Float32Array } })
        .instanceMatrix.array;
      expect(a.length).toBe(b.length);
      let identical = true;
      for (let e = 0; e < a.length; e++) {
        if (a[e] !== b[e]) {
          identical = false;
          break;
        }
      }
      expect(identical).toBe(true);
    }
  });

  it("writes finite matrices under normal, reduced-motion and zero-dt updates", () => {
    const system = makeSystem();
    settle(system, 60);
    system.update(0, false, VIEWER);
    system.update(1 / 30, true, VIEWER);
    for (const mesh of system.meshes) {
      const array = (mesh as unknown as { instanceMatrix: { array: Float32Array } }).instanceMatrix
        .array;
      for (const value of array) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("stratifies the water column: shoals mid-water, needles high, coral fish low, the wanderer on the floor", () => {
    const system = makeSystem();
    settle(system, 1200);

    for (const point of translations(system, "fusilier")) {
      expect(point.y).toBeGreaterThan(2.0);
      expect(point.y).toBeLessThan(9.3);
    }
    for (const point of translations(system, "needlefish")) {
      expect(point.y).toBeGreaterThan(6.2);
      expect(point.y).toBeLessThan(10.2);
    }
    for (const point of translations(system, "tang")) {
      expect(point.y).toBeGreaterThan(-0.2);
      expect(point.y).toBeLessThan(3.8);
    }
    for (const point of translations(system, "damsel")) {
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(3.5);
    }
    for (const point of translations(system, "wrasse")) {
      expect(point.y).toBeGreaterThan(-0.2);
      expect(point.y).toBeLessThan(2.4);
    }
  });

  it("keeps the coral species at the coral", () => {
    const system = makeSystem();
    settle(system, 600);
    const sites = coralFeedingSites();

    const nearestSite = (point: Vector3): number =>
      Math.min(...sites.map((site) => Math.hypot(point.x - site.x, point.z - site.z)));

    for (const point of translations(system, "damsel")) {
      expect(nearestSite(point)).toBeLessThan(1.6);
    }
    for (const point of translations(system, "tang")) {
      expect(nearestSite(point)).toBeLessThan(3.2);
    }
  });

  it("keeps the wanderer clear of every crevice mouth, all the way round its loops", () => {
    const system = makeSystem();
    // Sample continuously over several loop periods (a loop is ~40s), so the
    // whole ellipse is tested rather than one arc of it.
    let worst = Infinity;
    for (let i = 0; i < 3000; i++) {
      system.update(1 / 10, false, VIEWER);
      if (i % 5 !== 0) {
        continue;
      }
      for (const point of translations(system, "wrasse")) {
        for (const [x, z] of CREVICE_MOUTHS) {
          worst = Math.min(worst, Math.hypot(point.x - x, point.z - z));
        }
      }
    }
    expect(worst).toBeGreaterThan(4.5);
  });
});
