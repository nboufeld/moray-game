import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "three";
import { AnemoneGarden } from "../src/creatures/fauna/AnemoneGarden";
import { Crabs } from "../src/creatures/fauna/Crabs";
import { Starfish } from "../src/creatures/fauna/Starfish";
import { Urchins } from "../src/creatures/fauna/Urchins";
import {
  LifeRegistry,
  type LifeContext,
  type LifeSystem,
} from "../src/creatures/life/LifeSystem";
import { JellyBloom } from "../src/creatures/visitors/JellyBloom";
import { Ray } from "../src/creatures/visitors/Ray";
import { Turtle } from "../src/creatures/visitors/Turtle";
import { VisitorSchedule } from "../src/creatures/visitors/VisitorSchedule";
import { SandPuffs } from "../src/rendering/SandPuffs";
import { SEEDS } from "../src/util/Random";

/**
 * These run in plain Node, like the sanctuary's own test and for the same
 * reason: everything Round L adds to the reef has to be constructible without
 * a document, or none of it can be unit tested and all of it has to be
 * reviewed from a screenshot.
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

/** Every skeleton, with the seed each one is meant to be scattered from. */
const SCAFFOLDS = [
  { name: "Crabs", make: () => new Crabs(), seed: SEEDS.crabs },
  { name: "Starfish", make: () => new Starfish(), seed: SEEDS.starfish },
  { name: "Urchins", make: () => new Urchins(), seed: SEEDS.urchins },
  { name: "AnemoneGarden", make: () => new AnemoneGarden(), seed: SEEDS.anemonesGrand },
  { name: "VisitorSchedule", make: () => new VisitorSchedule(), seed: SEEDS.visitors },
  { name: "Turtle", make: () => new Turtle(), seed: SEEDS.visitors },
  { name: "Ray", make: () => new Ray(), seed: SEEDS.visitors },
  { name: "JellyBloom", make: () => new JellyBloom(), seed: SEEDS.visitors },
  { name: "SandPuffs", make: () => new SandPuffs(), seed: SEEDS.sandPuffs },
] as const;

class Recorder implements LifeSystem {
  added = 0;
  updates = 0;
  disposals = 0;
  lastDt = -1;

  addTo(): void {
    this.added++;
  }

  update(dt: number): void {
    this.updates++;
    this.lastDt = dt;
  }

  dispose(): void {
    this.disposals++;
  }
}

describe("LifeRegistry", () => {
  it("fans the frame out over every system it holds", () => {
    const first = new Recorder();
    const second = new Recorder();
    const registry = new LifeRegistry([first]);
    expect(registry.add(second)).toBe(second);
    expect(registry.size).toBe(2);

    const scene = new Scene();
    registry.addTo(scene);
    registry.update(1 / 60, context());

    for (const system of [first, second]) {
      expect(system.added).toBe(1);
      expect(system.updates).toBe(1);
      expect(system.lastDt).toBeCloseTo(1 / 60);
    }
  });

  it("disposes everything once, and empties itself so a second teardown is free", () => {
    const system = new Recorder();
    const registry = new LifeRegistry([system]);

    registry.dispose();
    registry.dispose();

    expect(system.disposals).toBe(1);
    expect(registry.size).toBe(0);
  });

  it("is a life system itself, so a room can hold one registry", () => {
    // `Game` treats it as one, and nesting is how a second scene would get its
    // own population without the reef's.
    const outer = new LifeRegistry([new LifeRegistry([new Crabs()])]);
    const scene = new Scene();
    outer.addTo(scene);
    outer.update(1 / 60, context());
    expect(scene.children).toHaveLength(1);

    outer.dispose();
    expect(scene.children).toHaveLength(0);
  });
});

describe("life system scaffolds", () => {
  it("registers a seed for every population", () => {
    // Pre-registered here so that the packages filling these in never have to
    // edit `Random.ts` — and so that two of them cannot silently pick the same
    // stream and scatter one population on top of another.
    const world = [SEEDS.crabs, SEEDS.starfish, SEEDS.urchins, SEEDS.anemonesGrand, SEEDS.sandPuffs];
    for (const seed of [...world, SEEDS.visitors]) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThan(0);
    }
    // The visitors share one stream by design; nothing else may.
    expect(new Set([...world, SEEDS.visitors]).size).toBe(world.length + 1);
  });

  for (const scaffold of SCAFFOLDS) {
    it(`${scaffold.name} constructs empty, runs and disposes clean`, () => {
      const system = scaffold.make();
      expect(system.seed).toBe(scaffold.seed);
      expect(system.group.name).not.toBe("");
      expect(system.group.children).toHaveLength(0);

      const scene = new Scene();
      system.addTo(scene);
      expect(scene.children).toContain(system.group);

      // A whole minute of frames, including the states the comfort panel and
      // a paused reef produce, with nothing on the other end of any of it.
      for (let i = 0; i < 3600; i++) {
        system.update(1 / 60, context({ time: i / 60, diverSpeed: 1.4 }));
      }
      system.update(0, context({ reducedMotion: true }));

      system.dispose();
      expect(scene.children).not.toContain(system.group);
      expect(system.group.children).toHaveLength(0);
      // Twice, because teardown runs on a path that may already have run.
      system.dispose();
    });
  }
});
