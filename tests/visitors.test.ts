import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "three";
import type { LifeContext } from "../src/creatures/life/LifeSystem";
import { JellyBloom } from "../src/creatures/visitors/JellyBloom";
import { Ray } from "../src/creatures/visitors/Ray";
import { Turtle } from "../src/creatures/visitors/Turtle";
import { VisitorSchedule } from "../src/creatures/visitors/VisitorSchedule";

/**
 * Plain Node, like every life-system test: the visitors have to be
 * constructible and drivable without a document, which is also what proves
 * the no-assets fallbacks exist — `AssetLibrary` never fires here, so every
 * body in these tests is the procedural stand-in.
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

/** The full cast, wired the way `Game` wires them: as unwired siblings. */
function buildCast() {
  const schedule = new VisitorSchedule();
  const turtle = new Turtle();
  const ray = new Ray();
  const jelly = new JellyBloom();
  const scene = new Scene();
  const systems = [schedule, turtle, ray, jelly];
  for (const system of systems) {
    system.addTo(scene);
  }
  return {
    schedule,
    turtle,
    ray,
    jelly,
    scene,
    visitors: [turtle, ray, jelly] as const,
    step(dt: number, time: number): void {
      for (const system of systems) {
        system.update(dt, context({ time }));
      }
    },
    dispose(): void {
      for (const system of systems) {
        system.dispose();
      }
    },
  };
}

describe("VisitorSchedule", () => {
  it("sends the first visitor inside its window, and never two at once", () => {
    const cast = buildCast();
    let firstArrival = -1;
    for (let t = 0; t < 140; t += 0.1) {
      cast.step(0.1, t);
      const passing = cast.visitors.filter((v) => v.isPassing).length;
      expect(passing).toBeLessThanOrEqual(1);
      if (passing === 1 && firstArrival < 0) {
        firstArrival = t;
      }
    }
    expect(firstArrival).toBeGreaterThanOrEqual(74);
    expect(firstArrival).toBeLessThanOrEqual(121);
    cast.dispose();
  });

  it("keeps the turtle the marquee over a long session, with gaps between visits", () => {
    const cast = buildCast();
    const arrivals: string[] = [];
    let wasPassing = false;
    let lastDeparture = -1;
    // Two simulated hours at a coarse step; enough for a dozen-odd visits.
    for (let t = 0; t < 7200; t += 0.5) {
      cast.step(0.5, t);
      const passing = cast.visitors.find((v) => v.isPassing) ?? null;
      if (passing && !wasPassing) {
        arrivals.push(passing.group.name);
        if (lastDeparture >= 0) {
          // The next arrival waits out the gap, not merely the pass.
          expect(t - lastDeparture).toBeGreaterThanOrEqual(149);
        }
      }
      if (!passing && wasPassing) {
        lastDeparture = t;
      }
      wasPassing = passing !== null;
    }
    expect(arrivals.length).toBeGreaterThanOrEqual(10);
    const count = (name: string) => arrivals.filter((a) => a === name).length;
    expect(count("turtle")).toBeGreaterThan(count("ray"));
    expect(count("turtle")).toBeGreaterThanOrEqual(count("jelly-bloom"));
    cast.dispose();
  });

  it("summons deterministically through the force-hook, part-way into a pass", () => {
    const cast = buildCast();
    expect(cast.schedule.summon("turtle", 20)).toBe(true);
    expect(cast.turtle.isPassing).toBe(true);
    cast.step(1 / 60, 0);
    const summoned = cast.turtle.group.children[0]!.position.clone();

    // A second cast, summoned the same way, puts the turtle in the same water.
    const other = buildCast();
    other.schedule.summon("turtle", 20);
    other.step(1 / 60, 0);
    expect(other.turtle.group.children[0]!.position.distanceTo(summoned)).toBeLessThan(1e-9);

    cast.dispose();
    other.dispose();
    // With every actor disposed, the hook reports failure rather than lying.
    const lone = new VisitorSchedule();
    expect(lone.summon("turtle")).toBe(false);
    lone.dispose();
  });
});

describe("visitors", () => {
  it("cross and leave: the group is dressed only while someone is passing", () => {
    for (const make of [() => new Turtle(), () => new Ray(), () => new JellyBloom()]) {
      const visitor = make();
      const scene = new Scene();
      visitor.addTo(scene);
      expect(visitor.group.children).toHaveLength(0);

      visitor.beginPass();
      expect(visitor.isPassing).toBe(true);
      expect(visitor.group.children.length).toBeGreaterThan(0);

      // No crossing lasts longer than three minutes of water.
      let elapsed = 0;
      while (visitor.isPassing && elapsed < 300) {
        visitor.update(0.5, context({ time: elapsed }));
        elapsed += 0.5;
      }
      expect(visitor.isPassing).toBe(false);
      expect(elapsed).toBeLessThan(180);
      expect(visitor.group.children).toHaveLength(0);

      visitor.dispose();
      expect(scene.children).not.toContain(visitor.group);
      visitor.dispose();
    }
  });

  it("moves along its arc, and survives paused and reduced-motion frames", () => {
    const turtle = new Turtle();
    turtle.beginPass();
    turtle.update(1 / 60, context());
    const early = turtle.group.children[0]!.position.clone();
    for (let i = 0; i < 600; i++) {
      turtle.update(1 / 60, context({ time: i / 60 }));
    }
    const later = turtle.group.children[0]!.position;
    expect(later.distanceTo(early)).toBeGreaterThan(5);

    // A paused frame (dt 0) and a calm frame must both be safe.
    const held = later.clone();
    turtle.update(0, context({ reducedMotion: true }));
    expect(turtle.group.children[0]!.position.distanceTo(held)).toBeLessThan(1e-9);
    turtle.dispose();
  });

  it("brings a bloom of five to nine bells, each pulsing on its own beat", () => {
    const jelly = new JellyBloom();
    jelly.beginPass();
    const raft = jelly.group.children[0]!;
    expect(raft.children.length).toBeGreaterThanOrEqual(5);
    expect(raft.children.length).toBeLessThanOrEqual(9);

    jelly.update(1 / 60, context());
    const scales = raft.children.map((holder) => holder.children[0]!.scale.y);
    // Phases are drawn per bell; a bloom breathing in lockstep is a re-roll.
    expect(new Set(scales.map((s) => s.toFixed(5))).size).toBeGreaterThan(1);
    jelly.dispose();
  });
});
