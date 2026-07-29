import { describe, expect, it } from "vitest";
import { InstancedMesh, Matrix4, Scene, Vector3 } from "three";
import { AnemoneGarden } from "../src/creatures/fauna/AnemoneGarden";
import { Crabs } from "../src/creatures/fauna/Crabs";
import { Shrimp } from "../src/creatures/fauna/Shrimp";
import { Starfish } from "../src/creatures/fauna/Starfish";
import { Urchins } from "../src/creatures/fauna/Urchins";
import type { FaunaSystem } from "../src/creatures/fauna/FaunaSystem";
import type { LifeContext } from "../src/creatures/life/LifeSystem";
import { coralFeedingSites, isClear } from "../src/world/CoralField";
import { seabedHeight } from "../src/world/Seabed";

/**
 * W-L5's ground fauna, checked in plain Node — the same rule every life
 * system is built under. The things worth holding here are the ones no
 * screenshot can catch: a population that re-rolls between loads, a crab that
 * wanders into an approach lane, a clownfish that never actually hides, and a
 * teardown that leaks.
 */

function context(overrides: Partial<LifeContext> = {}): LifeContext {
  return {
    diverPosition: new Vector3(0, 2, 22),
    diverSpeed: 0,
    reducedMotion: false,
    time: 0,
    ...overrides,
  };
}

/** Builds the system by adding it to a throwaway scene, as `Game` would. */
function built<T extends FaunaSystem>(system: T): T {
  system.addTo(new Scene());
  return system;
}

function instancedMeshes(system: FaunaSystem): InstancedMesh[] {
  return system.group.children.filter(
    (child): child is InstancedMesh => child instanceof InstancedMesh,
  );
}

/** Every instance's world translation, read back out of the matrices. */
function translations(system: FaunaSystem): Vector3[] {
  const matrix = new Matrix4();
  const out: Vector3[] = [];
  for (const mesh of instancedMeshes(system)) {
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      out.push(new Vector3().setFromMatrixPosition(matrix));
    }
  }
  return out;
}

/** A minute of frames with the diver standing somewhere specific. */
function run(system: FaunaSystem, seconds: number, diver: Vector3, from = 0): number {
  const ctx = context({ diverPosition: diver });
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    ctx.time = from + (i + 1) / 60;
    system.update(1 / 60, ctx);
  }
  return from + seconds;
}

const GROUND_POPULATIONS = [
  { name: "Crabs", make: () => new Crabs() },
  { name: "Starfish", make: () => new Starfish() },
  { name: "Urchins", make: () => new Urchins() },
] as const;

describe("the ground fauna", () => {
  for (const population of GROUND_POPULATIONS) {
    it(`${population.name} builds the same population from the same seed`, () => {
      const first = translations(built(population.make()));
      const second = translations(built(population.make()));
      expect(first.length).toBeGreaterThan(0);
      expect(first.length).toBe(second.length);
      for (let i = 0; i < first.length; i++) {
        expect(first[i]!.distanceTo(second[i]!)).toBe(0);
      }
    });

    it(`${population.name} stands clear of every crevice, corridor and the reserved disc`, () => {
      // `isClear` is the coral garden's own clearance contract — crevice
      // rings, mounds, approach corridors, the anemone disc — read from the
      // file that owns it rather than copied here.
      for (const spot of translations(built(population.make()))) {
        expect(isClear(spot.x, spot.z), `(${spot.x.toFixed(2)}, ${spot.z.toFixed(2)})`).toBe(true);
      }
    });
  }

  it("keeps a wandering crab near home and out of forbidden ground", () => {
    const crabs = built(new Crabs());
    const homes = translations(crabs);
    const diver = new Vector3(0, 2, 22);
    run(crabs, 120, diver);
    const roamed = translations(crabs);
    for (let i = 0; i < roamed.length; i++) {
      expect(roamed[i]!.distanceTo(homes[i]!)).toBeLessThan(2.5);
      expect(isClear(roamed[i]!.x, roamed[i]!.z)).toBe(true);
    }
  });

  it("actually scuttles: two minutes moves at least one crab", () => {
    const crabs = built(new Crabs());
    const before = translations(crabs);
    run(crabs, 120, new Vector3(0, 2, 22));
    const after = translations(crabs);
    const moved = after.some((spot, i) => spot.distanceTo(before[i]!) > 0.05);
    expect(moved).toBe(true);
  });
});

describe("the anemone garden", () => {
  it("plants everything inside the reserved disc, low to the ground", () => {
    const garden = built(new AnemoneGarden());
    const spots = translations(garden);
    expect(spots.length).toBeGreaterThan(20);
    for (const spot of spots) {
      // Instance origins sit inside the clearing; a splayed tentacle's tip
      // may lean a little past its origin, which the 2.6 m disc absorbs.
      expect(Math.hypot(spot.x - 7.5, spot.z - 8.5)).toBeLessThan(2.35);
    }

    // Ankle-high — the plants only, since the clownfish hover higher by
    // design. The disc's south edge dips into the z ≈ 6 sightline band, and
    // short is what makes that harmless.
    const matrix = new Matrix4();
    const spot = new Vector3();
    for (const mesh of instancedMeshes(garden)) {
      if (mesh.name === "clownfish") {
        continue;
      }
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        spot.setFromMatrixPosition(matrix);
        expect(spot.y - seabedHeight(spot.x, spot.z)).toBeLessThan(0.45);
      }
    }
  });

  it("rebuilds the same garden from the same seed", () => {
    const first = translations(built(new AnemoneGarden()));
    const second = translations(built(new AnemoneGarden()));
    expect(first.length).toBe(second.length);
    for (let i = 0; i < first.length; i++) {
      expect(first[i]!.distanceTo(second[i]!)).toBe(0);
    }
  });

  it("sends the clownfish into the tentacles when the diver closes, and back out", () => {
    const garden = built(new AnemoneGarden());
    const pair = garden.clownfish;
    expect(pair).not.toBeNull();
    if (!pair) {
      return;
    }
    const ground = seabedHeight(7.5, 8.5);

    // Diver far away: the pair weaves in open water over the crowns.
    let clock = run(garden, 20, new Vector3(0, 2, 22));
    expect(pair.isHiding).toBe(false);
    for (const fish of pair.positions()) {
      expect(fish.y).toBeGreaterThan(ground + 0.3);
      expect(Math.hypot(fish.x - 7.5, fish.z - 8.5)).toBeLessThan(1.5);
    }

    // Diver arrives: both fish drop into the crowns and hold there.
    clock = run(garden, 8, new Vector3(7.5, 2, 10.2), clock);
    expect(pair.isHiding).toBe(true);
    for (const fish of pair.positions()) {
      expect(fish.y).toBeLessThan(ground + 0.3);
    }

    // Diver stands off past the (larger) emerge range: they come back out.
    run(garden, 25, new Vector3(7.5, 2, 15), clock);
    expect(pair.isHiding).toBe(false);
    const emerged = pair.positions();
    expect(emerged.some((fish) => fish.y > ground + 0.3)).toBe(true);
  });
});

describe("the cleaner shrimp", () => {
  it("perches a small pod at the coral feeding sites, at storybook scale", () => {
    const shrimp = built(new Shrimp());
    const spots = translations(shrimp);
    expect(spots.length).toBeGreaterThanOrEqual(5);
    expect(spots.length).toBeLessThanOrEqual(10);

    const sites = coralFeedingSites();
    const scale = new Vector3();
    const matrix = new Matrix4();
    const mesh = instancedMeshes(shrimp)[0]!;
    for (let i = 0; i < spots.length; i++) {
      const spot = spots[i]!;
      const nearest = Math.min(
        ...sites.map((site) => Math.hypot(site.x - spot.x, site.z - spot.z)),
      );
      expect(nearest, `shrimp at (${spot.x.toFixed(1)}, ${spot.z.toFixed(1)})`).toBeLessThan(0.9);

      mesh.getMatrixAt(i, matrix);
      scale.setFromMatrixScale(matrix);
      // 2.75× the GLB's true 50 mm — documented in Shrimp.ts: at life size
      // the animal is sub-pixel from everywhere this game stands.
      expect(scale.y).toBeCloseTo(2.75, 5);
    }
  });

  it("constructs empty, runs a minute and disposes clean, like every scaffold", () => {
    // Shrimp postdates `lifeSystems.test.ts`, so it takes the same drill here.
    const shrimp = new Shrimp();
    expect(shrimp.group.children).toHaveLength(0);
    const scene = new Scene();
    shrimp.addTo(scene);
    expect(scene.children).toContain(shrimp.group);
    run(shrimp, 60, new Vector3(0, 2, 22));
    shrimp.update(0, context({ reducedMotion: true }));
    shrimp.dispose();
    expect(scene.children).not.toContain(shrimp.group);
    expect(shrimp.group.children).toHaveLength(0);
    shrimp.dispose();
  });
});
