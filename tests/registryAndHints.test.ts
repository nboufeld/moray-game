import { describe, expect, it } from "vitest";
import { MorayRegistry } from "../src/creatures/morays/MorayRegistry";
import { HintSystem } from "../src/discovery/HintSystem";
import { GameLoop } from "../src/app/GameLoop";

describe("MorayRegistry", () => {
  it("resolves the default snowflake moray", () => {
    const registry = new MorayRegistry();
    expect(registry.has("snowflake-moray")).toBe(true);
    expect(registry.require("snowflake-moray").scientificName).toBe("Echidna nebulosa");
  });

  it("throws for unknown species", () => {
    const registry = new MorayRegistry();
    expect(() => registry.require("kraken")).toThrow(/Unknown moray species/);
  });

  it("throws on duplicate species ids", () => {
    const dupe = {
      id: "x",
      commonName: "X",
      scientificName: "X x",
      archetype: "standard" as const,
      bodyColor: 0,
      patternColor: 0,
      lengthScale: 1,
      girthScale: 1,
      fact: "",
      habitatHint: "",
    };
    expect(() => new MorayRegistry([dupe, dupe])).toThrow(/Duplicate moray species/);
  });
});

describe("HintSystem", () => {
  it("escalates and then clamps at the most specific rung", () => {
    const hints = new HintSystem(["a", "b", "c"]);
    expect(hints.next()).toBe("a");
    expect(hints.next()).toBe("b");
    expect(hints.next()).toBe("c");
    expect(hints.next()).toBe("c");
    expect(hints.isExhausted).toBe(true);
  });

  it("requires at least one rung", () => {
    expect(() => new HintSystem([])).toThrow();
  });
});

describe("GameLoop", () => {
  it("runs whole fixed steps and reports interpolation alpha", () => {
    const loop = new GameLoop(1 / 60);
    let steps = 0;
    const alpha = loop.advance(1 / 60 + 1 / 120, () => steps++);
    expect(steps).toBe(1);
    expect(alpha).toBeGreaterThan(0.49);
    expect(alpha).toBeLessThan(0.51);
  });

  it("clamps oversized deltas so the simulation never jumps", () => {
    const loop = new GameLoop(1 / 60, 0.25);
    let steps = 0;
    loop.advance(10, () => steps++);
    expect(steps).toBeLessThanOrEqual(Math.ceil(0.25 * 60) + 1);
  });
});
