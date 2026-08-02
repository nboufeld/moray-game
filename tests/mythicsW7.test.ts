import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { Scene, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { OLD_CURRENT } from "../src/creatures/mythics/defs/OldCurrent";
import { CROWN_SOVEREIGN } from "../src/creatures/mythics/defs/CrownSovereign";
import { REEF_KIRIN } from "../src/creatures/mythics/defs/ReefKirin";
import type { LifeContext } from "../src/creatures/life/LifeSystem";
import type { MythicDefinition } from "../src/creatures/mythics/MythicTypes";
import { ReefKirin, KIRIN_RANGE, KIRIN_TRI_BUDGET } from "../src/creatures/mythics/kirin/ReefKirin";
import {
  CrownSovereign,
  SOVEREIGN_HOME,
  SOVEREIGN_TRI_BUDGET,
} from "../src/creatures/mythics/sovereign/CrownSovereign";
import {
  OldCurrent,
  SERPENT_CIRCUIT,
  SERPENT_TRI_BUDGET,
  drawSerpentCircuit,
  serpentCircuitAt,
} from "../src/creatures/mythics/serpent/OldCurrent";
import { Random, SEEDS } from "../src/util/Random";
import { angleBetween, wedgeHalfAt } from "../src/world/wings/WingGeometry";
import type { WingDef } from "../src/world/wings/WingTypes";
import { LUMEN_GARDEN } from "../src/world/wings/defs/LumenGarden";
import { OPEN_BLUE } from "../src/world/wings/defs/OpenBlue";
import { RUINS_TERRACE } from "../src/world/wings/defs/RuinsTerrace";

/**
 * W7's three mythics, held to the wave's standing contracts: constructible
 * in plain Node (no `window`, no GLB — the procedural stand-ins), seeded
 * determinism, confinement to the authored wedges, and the triangle
 * budgets the Blender builds are measured against.
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

/** Steps a built mythic `frames` times at a fixed dt, time advancing. */
function run(
  system: { update(dt: number, ctx: LifeContext): void },
  frames: number,
  ctx: Partial<LifeContext> = {},
): void {
  const dt = 1 / 30;
  for (let i = 0; i < frames; i++) {
    system.update(dt, context({ ...ctx, time: (ctx.time ?? 0) + i * dt }));
  }
}

function insideWing(def: WingDef, position: Vector3): boolean {
  const r = Math.hypot(position.x, position.z);
  const half = wedgeHalfAt(def, r);
  return angleBetween(Math.atan2(position.z, position.x), def.azimuth) < half;
}

describe("the three mythics build their stand-ins without a window", () => {
  const defs: [string, MythicDefinition][] = [
    ["old-current", OLD_CURRENT],
    ["crown-sovereign", CROWN_SOVEREIGN],
    ["reef-kirin", REEF_KIRIN],
  ];

  it("builds, mounts, updates and disposes with no assets at all", () => {
    const scene = new Scene();
    for (const [, def] of defs) {
      const build = def.build();
      expect(build.targets.length).toBe(1);
      build.system.addTo(scene);
      run(build.system, 90);
      const position = build.targets[0]!.position;
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
      expect(Number.isFinite(position.z)).toBe(true);
      build.system.dispose();
    }
  });

  it("shows the procedural fallback, not nothing, while the GLB is away", () => {
    const systems = [new OldCurrent(), new CrownSovereign(), new ReefKirin()];
    const fallbacks = ["serpent-fallback", "sovereign-fallback", "kirin-fallback"];
    systems.forEach((system, index) => {
      let found = false;
      system.group.traverse((node) => {
        if (node.name === fallbacks[index]) {
          found = true;
        }
      });
      expect(found, fallbacks[index]).toBe(true);
      system.dispose();
    });
  });

  it("is deterministic from its own seed, frame for frame", () => {
    for (const [, def] of defs) {
      const a = def.build();
      const b = def.build();
      run(a.system, 240);
      run(b.system, 240);
      expect(b.targets[0]!.position.x).toBeCloseTo(a.targets[0]!.position.x, 12);
      expect(b.targets[0]!.position.y).toBeCloseTo(a.targets[0]!.position.y, 12);
      expect(b.targets[0]!.position.z).toBeCloseTo(a.targets[0]!.position.z, 12);
      a.system.dispose();
      b.system.dispose();
    }
  });
});

describe("the Old Current's circuit", () => {
  const params = drawSerpentCircuit(new Random(SEEDS.mythSerpent));
  const point = new Vector3();

  it("stays inside r 38–48, y 3–8 and the Open Blue's wedge", () => {
    for (let i = 0; i <= 720; i++) {
      const phi = (i / 720) * Math.PI * 4; // two full circuits
      serpentCircuitAt(params, phi, point);
      const r = Math.hypot(point.x, point.z);
      expect(r, `r at phi=${phi.toFixed(2)}`).toBeGreaterThanOrEqual(38);
      expect(r, `r at phi=${phi.toFixed(2)}`).toBeLessThanOrEqual(48);
      expect(point.y, `y at phi=${phi.toFixed(2)}`).toBeGreaterThanOrEqual(3);
      expect(point.y, `y at phi=${phi.toFixed(2)}`).toBeLessThanOrEqual(8);
      expect(insideWing(OPEN_BLUE, point), `wedge at phi=${phi.toFixed(2)}`).toBe(true);
    }
  });

  it("sweeps within 12 m of the wing's mid corridor, so discovery is earnable", () => {
    const corridor = new Vector3(
      40 * Math.cos(OPEN_BLUE.azimuth),
      5,
      40 * Math.sin(OPEN_BLUE.azimuth),
    );
    let nearest = Infinity;
    for (let i = 0; i <= 360; i++) {
      serpentCircuitAt(params, (i / 360) * Math.PI * 2, point);
      nearest = Math.min(nearest, point.distanceTo(corridor));
    }
    expect(nearest).toBeLessThanOrEqual(12);
  });

  it("keeps its discovery point on the circuit's own bounds every frame", () => {
    const system = new OldCurrent();
    for (let frame = 0; frame < 600; frame++) {
      run(system, 1, { time: frame / 30 });
      const target = system.target.position;
      const r = Math.hypot(target.x, target.z);
      expect(r).toBeGreaterThanOrEqual(38);
      expect(r).toBeLessThanOrEqual(48);
      expect(target.y).toBeGreaterThanOrEqual(3);
      expect(target.y).toBeLessThanOrEqual(8);
      expect(insideWing(OPEN_BLUE, target)).toBe(true);
    }
    system.dispose();
  });
});

describe("the Crown Sovereign's court", () => {
  it("rises and sinks inside y 1–5 near r 42 on the garden's axis", () => {
    const system = new CrownSovereign();
    let lowest = Infinity;
    let highest = -Infinity;
    for (let frame = 0; frame < 1500; frame++) {
      run(system, 1, { time: frame / 30 });
      const target = system.target.position;
      const r = Math.hypot(target.x, target.z);
      expect(r).toBeGreaterThan(40);
      expect(r).toBeLessThan(44);
      expect(insideWing(LUMEN_GARDEN, target)).toBe(true);
      lowest = Math.min(lowest, target.y);
      highest = Math.max(highest, target.y);
    }
    expect(lowest).toBeGreaterThanOrEqual(1 - 0.2);
    expect(highest).toBeLessThanOrEqual(5 + 0.4);
    expect(highest - lowest).toBeGreaterThan(2.5); // it really rises and sinks
    system.dispose();
  });

  it("matches its stated home", () => {
    expect(SOVEREIGN_HOME.azimuth).toBe(LUMEN_GARDEN.azimuth);
    expect(SOVEREIGN_HOME.radius).toBe(42);
  });
});

describe("the Reef Kirin's graze", () => {
  it("keeps its waypoints and its target inside the terrace corridor", () => {
    const system = new ReefKirin();
    for (let frame = 0; frame < 2400; frame++) {
      run(system, 1, { time: frame / 30 });
      const target = system.target.position;
      const r = Math.hypot(target.x, target.z);
      expect(r, `r at frame ${frame}`).toBeGreaterThan(KIRIN_RANGE.radiusMin - 1);
      expect(r, `r at frame ${frame}`).toBeLessThan(KIRIN_RANGE.radiusMax + 1);
      expect(insideWing(RUINS_TERRACE, target)).toBe(true);
    }
    system.dispose();
  });

  it("lifts its attention to a calm diver and lets a far one go", () => {
    const system = new ReefKirin();
    run(system, 60, { time: 0 });
    const near = system.target.position.clone().add(new Vector3(4, 0, 0));
    for (let frame = 0; frame < 90; frame++) {
      run(system, 1, { time: frame / 30, diverPosition: near, diverSpeed: 0 });
    }
    expect(system.attention).toBeGreaterThan(0.9);

    const far = new Vector3(0, 2, 22);
    for (let frame = 0; frame < 240; frame++) {
      run(system, 1, { time: 3 + frame / 30, diverPosition: far, diverSpeed: 0 });
    }
    expect(system.attention).toBeLessThan(0.05);
    system.dispose();
  });

  it("never hurries: the deer-attention wants a slow diver", () => {
    const system = new ReefKirin();
    run(system, 60, { time: 0 });
    const near = system.target.position.clone().add(new Vector3(4, 0, 0));
    for (let frame = 0; frame < 90; frame++) {
      run(system, 1, { time: frame / 30, diverPosition: near, diverSpeed: 4 });
    }
    expect(system.attention).toBeLessThan(0.05);
    system.dispose();
  });
});

describe("the triangle budgets", () => {
  it("asserts the constants the builds were measured against", () => {
    expect(SERPENT_TRI_BUDGET).toBe(6000);
    expect(SOVEREIGN_TRI_BUDGET).toBe(3000);
    expect(KIRIN_TRI_BUDGET).toBe(4500);
    expect(SERPENT_CIRCUIT.radius).toBe(43);
  });

  const models: [string, number][] = [
    ["public/assets/models/creature-serpent.glb", SERPENT_TRI_BUDGET],
    ["public/assets/models/creature-crown-jelly.glb", SOVEREIGN_TRI_BUDGET],
    ["public/assets/models/creature-kirin.glb", KIRIN_TRI_BUDGET],
  ];

  for (const [file, budget] of models) {
    it(`${file} measures under ${budget} tris when built`, () => {
      if (!existsSync(file)) {
        // The no-assets build is a first-class citizen; nothing to measure.
        return;
      }
      const out = execSync(`node tools/blender/creatures/inspect_creature.mjs ${file}`, {
        encoding: "utf8",
      });
      const match = out.match(/(\d+(?:\.\d+)?) tris/);
      expect(match, out).not.toBeNull();
      expect(Number(match![1])).toBeLessThanOrEqual(budget);
    });
  }
});
