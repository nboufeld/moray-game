import { describe, expect, it } from "vitest";
import { LinearFilter, MeshToonMaterial } from "three";
import { createToonMaterial, toonGradientMap, TOON_NORMAL_SCALE } from "../src/rendering/ToonShading";
import { createSandMaterial } from "../src/world/SandMaterial";
import { createRockMaterial } from "../src/world/RockMaterial";

/** The gradient map's red channel, which is the only one the toon shader reads. */
function ramp(): number[] {
  const texture = toonGradientMap();
  const data = texture.image.data as Uint8Array;
  const values: number[] = [];
  for (let i = 0; i < texture.image.width; i++) {
    values.push(data[i * 4]! / 255);
  }
  return values;
}

describe("toon ramp", () => {
  it("steps upward without ever falling back", () => {
    const values = ramp();
    expect(values).toHaveLength(32);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });

  it("reaches full light and floors well above black", () => {
    const values = ramp();
    expect(values.at(-1)).toBeCloseTo(1, 2);
    // The shade band is a colour, not a hole: see RAMP_LEVELS.
    expect(values[0]).toBeGreaterThan(0.2);
    expect(values[0]).toBeLessThan(0.4);
  });

  it("holds three plateaux", () => {
    const values = ramp();
    const flat = values.filter((value, i) => i > 0 && Math.abs(value - values[i - 1]!) < 0.01);
    // Most of the ramp is plateau; only a handful of texels are in transition.
    expect(flat.length).toBeGreaterThan(values.length * 0.6);
    expect(new Set(values.map((value) => value.toFixed(2))).size).toBeGreaterThanOrEqual(3);
  });

  it("crosses each step over several texels rather than in one", () => {
    // The failure this guards against is a texture that declares a soft edge
    // and hands the renderer a hard one: if a whole step falls between two
    // texel centres, `LinearFilter` reconstructs a cel boundary. It is what
    // happens at 16 texels, and it is why RAMP_SIZE is what it is.
    const values = ramp();
    // Texels sitting clear of all three plateaux: two or more per stop.
    const plateaux = [values[0]!, values[values.length / 2]!, values.at(-1)!];
    const climbing = values.filter((value) =>
      plateaux.every((plateau) => Math.abs(value - plateau) > 0.02),
    );
    expect(climbing.length).toBeGreaterThanOrEqual(4);
    // And no single texel may carry more than about half of a step.
    const steps = values.slice(1).map((value, i) => value - values[i]!);
    expect(Math.max(...steps)).toBeLessThan(0.26);
  });

  it("filters linearly and carries no mips", () => {
    const texture = toonGradientMap();
    expect(texture.minFilter).toBe(LinearFilter);
    expect(texture.magFilter).toBe(LinearFilter);
    expect(texture.generateMipmaps).toBe(false);
  });

  it("is built once and shared by every surface", () => {
    expect(toonGradientMap()).toBe(toonGradientMap());
    expect(createToonMaterial().gradientMap).toBe(toonGradientMap());
  });
});

describe("toon materials", () => {
  it("halves a normal map rather than taking it at face value", () => {
    const material = createToonMaterial({
      normalMap: createSandMaterial().normalMap,
    });
    expect(material.normalScale.x).toBe(TOON_NORMAL_SCALE);
    expect(material.normalScale.y).toBe(TOON_NORMAL_SCALE);
    expect(TOON_NORMAL_SCALE).toBe(0.5);
  });

  it("gives the reef's surfaces a ramp and no BRDF to fall back on", () => {
    for (const material of [createSandMaterial(), createRockMaterial(0x8b9184)]) {
      expect(material).toBeInstanceOf(MeshToonMaterial);
      expect(material.gradientMap).toBe(toonGradientMap());
      expect(material).not.toHaveProperty("roughness");
      expect(material).not.toHaveProperty("metalness");
    }
  });

  it("shades every surface smoothly, facets and all", () => {
    // The reef used to be chiselled on purpose and is round on purpose now: a
    // faceted boulder is a photograph's rock, and the fix for a shape that
    // looks like a platonic solid is geometry rather than a shading flag. What
    // faceting survives is in the buffers — see `SmoothNormals` — and no
    // material asks for more of it.
    expect(createRockMaterial(0x8b9184).flatShading).toBe(false);
    expect(createSandMaterial().flatShading).toBe(false);
  });
});
