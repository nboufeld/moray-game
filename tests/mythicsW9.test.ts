import { describe, expect, it } from "vitest";
import { Mesh, MeshToonMaterial, Scene, Vector3 } from "three";
import type { LifeContext } from "../src/creatures/life/LifeSystem";
import { ISLAND_THAT_SWIMS } from "../src/creatures/mythics/defs/IslandThatSwims";
import { LANTERN_LEVIATHAN } from "../src/creatures/mythics/defs/LanternLeviathan";
import {
  MAX_HEIGHT,
  MIN_HEIGHT,
  MIN_RADIUS,
  NEAR_PASS_ANCHOR,
} from "../src/creatures/mythics/leviathan/LeviathanArc";
import { LanternLeviathanSystem } from "../src/creatures/mythics/leviathan/LanternLeviathanSystem";
import { IslandElderSystem } from "../src/creatures/mythics/elder/IslandElderSystem";
import { SARGASSUM_SKY } from "../src/world/wings/defs/SargassumSky";
import { angleBetween, wedgeHalfAt } from "../src/world/wings/WingGeometry";

/**
 * Wave 8 worker W9: the Lantern Leviathan and the Island That Swims.
 * Plain Node, like every life-system test — `AssetLibrary` never fires here,
 * so every body in this file is the procedural stand-in, which is also the
 * proof that the no-assets build stays healthy.
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

/** The attached stage's body node (the visitors' own test idiom). */
function bodyOf(group: { children: { position: Vector3 }[] }): { position: Vector3 } {
  const body = group.children[0];
  expect(body, "the mythic's body is attached").toBeTruthy();
  return body!;
}

describe("the wave-9 mythic definitions", () => {
  it("keep their codex ids and build real systems with targets", () => {
    expect(LANTERN_LEVIATHAN.entry.id).toBe("myth-lantern-leviathan");
    expect(ISLAND_THAT_SWIMS.entry.id).toBe("myth-island-that-swims");

    for (const myth of [LANTERN_LEVIATHAN, ISLAND_THAT_SWIMS]) {
      const build = myth.build();
      expect(build.targets).toHaveLength(1);
      expect(build.targets[0]!.speciesId).toBe(myth.entry.id);
      build.system.dispose();
    }
  });
});

describe("fallback bodies, without a window", () => {
  it("builds the leviathan out of toon primitives, dressed only while passing", () => {
    const system = new LanternLeviathanSystem();
    const scene = new Scene();
    system.addTo(scene);
    expect(system.group.children).toHaveLength(0);
    expect(system.isPassing).toBe(false);

    system.beginPass(12);
    expect(system.isPassing).toBe(true);
    expect(system.group.children).toHaveLength(1);
    system.update(1 / 60, context());
    const root = system.group.children[0]!;

    let meshes = 0;
    let toonOnly = true;
    root.traverse((node) => {
      if (node instanceof Mesh) {
        meshes++;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (!(material instanceof MeshToonMaterial)) {
            toonOnly = false;
          }
        }
      }
    });
    expect(meshes, "the stand-in is dressed").toBeGreaterThan(6);
    expect(toonOnly, "every stand-in material is the shared toon ramp").toBe(true);

    system.dispose();
    expect(scene.children).not.toContain(system.group);
  });

  it("builds the elder resident, always on stage, and survives paused frames", () => {
    const system = new IslandElderSystem();
    const scene = new Scene();
    system.addTo(scene);
    expect(system.group.children).toHaveLength(1);

    system.update(1 / 60, context());
    const early = bodyOf(system.group).position.clone();
    for (let i = 0; i < 120; i++) {
      system.update(0.25, context({ time: i * 0.25 }));
    }
    const later = bodyOf(system.group).position;
    expect(later.distanceTo(early)).toBeGreaterThan(1);

    const held = later.clone();
    system.update(0, context({ reducedMotion: true }));
    expect(bodyOf(system.group).position.distanceTo(held)).toBeLessThan(1e-9);
    system.dispose();
  });
});

describe("determinism", () => {
  it("two leviathans built from the same seed cross identically", () => {
    const a = new LanternLeviathanSystem();
    const b = new LanternLeviathanSystem();
    a.beginPass(30);
    b.beginPass(30);
    for (let i = 0; i < 240; i++) {
      a.update(0.25, context({ time: i * 0.25 }));
      b.update(0.25, context({ time: i * 0.25 }));
    }
    expect(bodyOf(b.group).position.distanceTo(bodyOf(a.group).position)).toBeLessThan(1e-9);
    expect(b.target.position.distanceTo(a.target.position)).toBeLessThan(1e-9);
    a.dispose();
    b.dispose();
  });

  it("two elders built from the same seed drift identically", () => {
    const a = new IslandElderSystem();
    const b = new IslandElderSystem();
    for (let i = 0; i < 480; i++) {
      a.update(0.25, context({ time: i * 0.25 }));
      b.update(0.25, context({ time: i * 0.25 }));
    }
    expect(bodyOf(b.group).position.distanceTo(bodyOf(a.group).position)).toBeLessThan(1e-9);
    expect(b.target.position.distanceTo(a.target.position)).toBeLessThan(1e-9);
    a.dispose();
    b.dispose();
  });
});

describe("the leviathan's schedule", () => {
  it("is seeded: first pass 2–4 minutes in, then every 4–7, never inside r 52", () => {
    const system = new LanternLeviathanSystem();
    const scene = new Scene();
    system.addTo(scene);

    let firstArrival = -1;
    let lastDeparture = -1;
    let arrivals = 0;
    let wasPassing = false;
    for (let t = 0; t < 1500; t += 0.5) {
      system.update(0.5, context({ time: t }));
      if (system.isPassing) {
        const position = bodyOf(system.group).position;
        const r = Math.hypot(position.x, position.z);
        expect(r, `body radius at t=${t.toFixed(1)}`).toBeGreaterThanOrEqual(MIN_RADIUS);
        expect(position.y, `body height at t=${t.toFixed(1)}`).toBeGreaterThanOrEqual(MIN_HEIGHT);
        expect(position.y, `body height at t=${t.toFixed(1)}`).toBeLessThanOrEqual(MAX_HEIGHT);
        if (!wasPassing) {
          arrivals++;
          if (firstArrival < 0) {
            firstArrival = t;
          }
          if (lastDeparture >= 0) {
            expect(t - lastDeparture, "the gap is 4–7 minutes").toBeGreaterThanOrEqual(239);
            expect(t - lastDeparture, "the gap is 4–7 minutes").toBeLessThanOrEqual(421);
          }
        }
      } else if (wasPassing) {
        lastDeparture = t;
      }
      wasPassing = system.isPassing;
    }
    expect(firstArrival).toBeGreaterThanOrEqual(119);
    expect(firstArrival).toBeLessThanOrEqual(241);
    expect(arrivals).toBeGreaterThanOrEqual(2);
    system.dispose();
  });
});

describe("the leviathan's arc", () => {
  const scratch = new Vector3();

  it("keeps every pre-rolled crossing behind the world, 80–105 seconds long", () => {
    const system = new LanternLeviathanSystem();
    for (const arc of system.arcs) {
      expect(arc.duration).toBeGreaterThanOrEqual(80);
      expect(arc.duration).toBeLessThanOrEqual(105);
      for (let i = 0; i <= 400; i++) {
        arc.positionAt(i / 400, scratch);
        const r = Math.hypot(scratch.x, scratch.z);
        expect(r).toBeGreaterThanOrEqual(MIN_RADIUS);
        expect(scratch.y).toBeGreaterThanOrEqual(MIN_HEIGHT);
        expect(scratch.y).toBeLessThanOrEqual(MAX_HEIGHT);
      }
    }
    system.dispose();
  });

  it("comes within 13 m of the Open Blue's end-wall water on every crossing", () => {
    const system = new LanternLeviathanSystem();
    const head = new Vector3();
    const tangent = new Vector3();
    for (const arc of system.arcs) {
      let nearest = Infinity;
      let nearestHead = Infinity;
      for (let i = 0; i <= 800; i++) {
        const s = i / 800;
        arc.positionAt(s, scratch);
        nearest = Math.min(nearest, scratch.distanceTo(NEAR_PASS_ANCHOR));
        // The target rides the head, ~5.6 m ahead of the body centre and a
        // little up — the point a diver actually focuses.
        arc.tangentAt(s, tangent);
        head.copy(scratch).addScaledVector(tangent, 5.6).add(new Vector3(0, 0.9, 0));
        nearestHead = Math.min(nearestHead, head.distanceTo(NEAR_PASS_ANCHOR));
      }
      expect(nearest, "arc's nearest pass to the end wall").toBeLessThanOrEqual(13);
      expect(nearestHead, "the head inside the scanner's 14 m reach").toBeLessThanOrEqual(14);
    }
    system.dispose();
  });
});

describe("the leviathan's target", () => {
  it("parks at y −60 between crossings and rides the head while passing", () => {
    const system = new LanternLeviathanSystem();
    const scene = new Scene();
    system.addTo(scene);

    expect(system.target.position.y).toBe(-60);
    system.beginPass(20);
    for (let i = 0; i < 40; i++) {
      system.update(0.25, context({ time: i * 0.25 }));
      const body = bodyOf(system.group);
      expect(system.target.position.distanceTo(body.position)).toBeGreaterThan(5.2);
      expect(system.target.position.distanceTo(body.position)).toBeLessThan(6.2);
      expect(system.target.position.y).toBeGreaterThan(5);
      expect(system.target.position.y).toBeLessThan(11);
    }
    // Run the crossing out; the target parks again.
    for (let i = 0; i < 400 && system.isPassing; i++) {
      system.update(0.5, context({ time: 200 + i * 0.5 }));
    }
    expect(system.isPassing).toBe(false);
    expect(system.target.position.y).toBe(-60);
    system.dispose();
  });
});

describe("the elder's circuit", () => {
  it("stays inside the Sargassum wedge at y 4–6, one circuit about 70 seconds", () => {
    const system = new IslandElderSystem();
    const scene = new Scene();
    system.addTo(scene);

    const duration = system.circuit.duration;
    expect(duration).toBeGreaterThanOrEqual(55);
    expect(duration).toBeLessThanOrEqual(85);

    const steps = Math.ceil((duration + 2) / 0.25);
    for (let i = 0; i < steps; i++) {
      system.update(0.25, context({ time: i * 0.25 }));
      const position = bodyOf(system.group).position;
      const r = Math.hypot(position.x, position.z);
      expect(r, "circuit radius").toBeGreaterThanOrEqual(38);
      expect(r, "circuit radius").toBeLessThanOrEqual(46);
      expect(position.y, "circuit height").toBeGreaterThanOrEqual(4);
      expect(position.y, "circuit height").toBeLessThanOrEqual(6);
      const away = angleBetween(Math.atan2(position.z, position.x), SARGASSUM_SKY.azimuth);
      expect(away, "inside the wedge").toBeLessThanOrEqual(wedgeHalfAt(SARGASSUM_SKY, r));
    }
    system.dispose();
  });

  it("rides its discovery target on its head", () => {
    const system = new IslandElderSystem();
    const scene = new Scene();
    system.addTo(scene);
    for (let i = 0; i < 200; i++) {
      system.update(0.25, context({ time: i * 0.25 }));
      const body = bodyOf(system.group);
      // The crown of the head sits ~3 m from the shell's centre.
      expect(system.target.position.distanceTo(body.position)).toBeLessThan(3.5);
      expect(system.target.position.y).toBeGreaterThan(4);
      expect(system.target.position.y).toBeLessThan(7);
    }
    system.dispose();
  });

  it("turns its head toward a calm diver, slowly", () => {
    const system = new IslandElderSystem();
    const scene = new Scene();
    system.addTo(scene);

    // Park a calm diver right beside the circuit and let the gaze engage.
    system.update(1 / 30, context()); // seat the target on the head first
    const calmDiver = context({
      diverPosition: system.target.position.clone().add(new Vector3(4, 1, 0)),
      diverSpeed: 0.2,
    });
    let moved = 0;
    let previous = system.target.position.clone();
    for (let i = 0; i < 120; i++) {
      system.update(1 / 30, calmDiver);
      moved = Math.max(moved, system.target.position.distanceTo(previous));
      previous = system.target.position.clone();
    }
    // The elder keeps drifting (its target moves with it), and nothing about
    // the gaze jumps: per-frame target travel stays at a drift's pace.
    expect(moved).toBeLessThan(0.25);
    expect(system.target.position.distanceTo(bodyOf(system.group).position)).toBeLessThan(3.5);
    system.dispose();
  });
});
