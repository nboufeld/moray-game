import { describe, expect, it } from "vitest";
import { Matrix4, type Sphere } from "three";
import { canyonBlend, canyonStrata, bakeCanyonStrata, ABYSS_DEN } from "../src/world/Abyss";
import { AbyssFlora } from "../src/world/AbyssFlora";
import { createSeabedGeometry, bakeSeabedOcclusion } from "../src/world/Seabed";

/**
 * W-N1's contracts: the canyon's paint — wall strata, the light story, the
 * water-column veil, the leafed ghost kelp and the tripled sparkle — changes
 * pixels only where the carve already owned them, and everything W-M3 placed
 * on `SEEDS.abyssFlora` is bit-identical to the draw. The literals below were
 * read off the shipped W-M3 build before this package touched the file; if
 * any of them moves, a retune has changed the draw order or count ahead of an
 * existing element, which is the reroll-isolation convention broken.
 */

describe("the wall strata stay inside the carve", () => {
  it("is null exactly where the carve is zero", () => {
    // The bowl's guard literals, the spawn corridor, and points just past
    // every wedge edge — everywhere `canyonBlend` early-returns, the strata
    // must too, which is the whole of the bowl's bit-identity argument.
    for (const [x, z] of [
      [0, 1.5],
      [-13, 6],
      [13, 6],
      [-6, -9],
      [0, 22],
      [5, 9],
      [29, 0],
      [-20, -20],
    ] as const) {
      expect(canyonBlend(x, z)).toBe(0);
      expect(canyonStrata(x, z, seabedHeightAt(x, z))).toBeNull();
    }
  });

  it("paints the den's wall in violet-leaning bands, never near black", () => {
    // Sample down the canyon at several elevations: every tint is a colour
    // (all channels well off zero), red is held at or above green (violet,
    // not navy — the value key's rule), and deeper is darker.
    const tintAt = (y: number): readonly [number, number, number] => {
      const tint = canyonStrata(ABYSS_DEN.x, ABYSS_DEN.z, y);
      expect(tint, `strata at y=${y}`).not.toBeNull();
      return tint!;
    };
    let lastLuma = Infinity;
    for (const y of [0.5, -2, -4.8, -7.6]) {
      const [r, g, b] = tintAt(y);
      expect(r).toBeGreaterThan(0.45);
      expect(g).toBeGreaterThan(0.4);
      expect(b).toBeGreaterThan(0.6);
      expect(r).toBeGreaterThanOrEqual(g);
      const luma = 0.3 * r + 0.55 * g + 0.15 * b;
      expect(luma, `deeper band at y=${y} must not brighten`).toBeLessThanOrEqual(
        lastLuma + 1e-9,
      );
      lastLuma = luma;
    }
    // The deep band is genuinely a band: distinct from the top one.
    expect(tintAt(-7.6)[0]).toBeLessThan(tintAt(0.5)[0] - 0.15);
  });

  it("leaves a bowl-spanning seabed bake untouched to the byte", () => {
    // A 40 m sheet centred on the origin never reaches the carve. Bake the
    // occlusion, snapshot it, run the strata bake, and demand bit-identity.
    const geometry = createSeabedGeometry(40, 24);
    bakeSeabedOcclusion(geometry, []);
    const before = Float32Array.from(
      geometry.attributes.color!.array as unknown as Float32Array,
    );
    bakeCanyonStrata(geometry);
    expect([...(geometry.attributes.color!.array as unknown as Float32Array)]).toEqual([
      ...before,
    ]);
    geometry.dispose();
  });

  it("tints the carved wall on a real-sized sheet", () => {
    const geometry = createSeabedGeometry(90, 96);
    bakeSeabedOcclusion(geometry, []);
    const before = Float32Array.from(
      geometry.attributes.color!.array as unknown as Float32Array,
    );
    bakeCanyonStrata(geometry);
    const after = geometry.attributes.color!.array as unknown as Float32Array;
    let changed = 0;
    for (let i = 0; i < before.length; i++) {
      if (after[i] !== before[i]) {
        changed++;
      }
    }
    // The wedge past the rim is a small share of a 96² sheet, but it is not
    // nothing — and nowhere outside it may move (covered by the case above
    // for the bowl; here just prove the paint actually landed).
    expect(changed).toBeGreaterThan(100);
    geometry.dispose();
  });
});

describe("the reroll fence: W-M3's marks are bit-identical under the paint", () => {
  // Literals read off the shipped W-M3 build (see the header note).
  const flora = new AbyssFlora();

  const meshByName = (name: string): unknown => {
    let found: unknown;
    flora.group.traverse((object) => {
      if (object.name === name) {
        found = object;
      }
    });
    expect(found, name).toBeDefined();
    return found;
  };

  it("keeps the first and last original motes exactly where W-M3 drew them", () => {
    const motes = meshByName("abyss-motes") as {
      geometry: { attributes: { position: { array: Float32Array } } };
    };
    const positions = motes.geometry.attributes.position.array;
    expect(positions[0]).toBeCloseTo(28.710439682006836, 6);
    expect(positions[1]).toBeCloseTo(-2.0901272296905518, 6);
    expect(positions[2]).toBeCloseTo(27.687551498413086, 6);
    expect(positions[219 * 3]).toBeCloseTo(26.99297332763672, 6);
    expect(positions[219 * 3 + 1]).toBeCloseTo(-0.6729996204376221, 6);
    expect(positions[219 * 3 + 2]).toBeCloseTo(27.308786392211914, 6);
    // And the sparkle genuinely tripled.
    expect(positions.length / 3).toBeGreaterThanOrEqual(3 * 220);
  });

  it("keeps the original polyp clusters and triples the count", () => {
    const polyps = meshByName("abyss-polyps") as {
      count: number;
      getMatrixAt: (i: number, m: Matrix4) => void;
    };
    const matrix = new Matrix4();
    polyps.getMatrixAt(0, matrix);
    expect(matrix.elements[12]).toBeCloseTo(29.272851943969727, 6);
    expect(matrix.elements[13]).toBeCloseTo(-4.343127727508545, 6);
    expect(matrix.elements[14]).toBeCloseTo(26.11281394958496, 6);
    polyps.getMatrixAt(41, matrix);
    expect(matrix.elements[12]).toBeCloseTo(35.452816009521484, 6);
    expect(matrix.elements[13]).toBeCloseTo(-8.294838905334473, 6);
    expect(matrix.elements[14]).toBeCloseTo(28.58003234863281, 6);
    expect(polyps.count).toBeGreaterThanOrEqual(3 * 42);
  });

  it("keeps every ghost kelp plant on its W-M3 root, and gives it leaves", () => {
    const fronds = meshByName("abyss-fronds") as {
      geometry: { attributes: { position: { array: Float32Array } } };
    };
    const positions = fronds.geometry.attributes.position.array;
    // The first plant's base centre — the midpoint of its first two stalk
    // vertices — is width-independent, so it pins the frozen skeleton draws
    // without pinning the stalk's cosmetic proportions.
    expect((positions[0]! + positions[3]!) / 2).toBeCloseTo(24.357409477233887, 5);
    expect((positions[1]! + positions[4]!) / 2).toBeCloseTo(-5.890097141265869, 5);
    expect((positions[2]! + positions[5]!) / 2).toBeCloseTo(32.366960525512695, 5);
    // Leaves: far more surface than 24 bare stalk quads (24 × 12 vertices).
    expect(positions.length / 3).toBeGreaterThan(24 * 12 * 2);
  });
});

describe("the light story keeps the canyon's disciplines", () => {
  const flora = new AbyssFlora();

  it("stays far under the bloom threshold and off the fog", () => {
    let columns = 0;
    flora.group.traverse((object) => {
      if (
        object.name !== "abyss-light-column" &&
        object.name !== "abyss-light-pool" &&
        object.name !== "abyss-gate-glow" &&
        object.name !== "abyss-polyp-halos"
      ) {
        return;
      }
      columns++;
      const material = (object as unknown as {
        material: { opacity: number; blending: number; fog: boolean; depthWrite: boolean };
      }).material;
      // Additive marks at these opacities cannot reach the bloom pass's
      // 0.82; and fog on an additive surface brightens distance, so off.
      expect(material.opacity).toBeLessThanOrEqual(0.32);
      expect(material.fog).toBe(false);
      expect(material.depthWrite).toBe(false);
    });
    // Three columns of two blades each, the moon pool, W-O1's gate glow and
    // the polyp halo cloud.
    expect(columns).toBe(9);
  });

  it("keeps every new mark inside the wedge, past the bowl", () => {
    // The veil, columns, pool, gate glow and halo cloud all carry
    // world-space bounding spheres that stand north-east past r = 30 — the
    // same property the frustum-culling guard in abyssBiome.test.ts leans on.
    flora.group.traverse((object) => {
      const named = object.name;
      if (
        named !== "abyss-veil" &&
        named !== "abyss-light-column" &&
        named !== "abyss-light-pool" &&
        named !== "abyss-gate-glow" &&
        named !== "abyss-polyp-halos"
      ) {
        return;
      }
      const sphere = (object as unknown as { geometry: { boundingSphere: Sphere | null } })
        .geometry.boundingSphere;
      expect(sphere, `${named} sphere`).not.toBeNull();
      const r = Math.hypot(sphere!.center.x, sphere!.center.z);
      expect(r - sphere!.radius, `${named} nearest reach`).toBeGreaterThan(27);
    });
  });

  it("gives the veil a real vertical gradient that dissolves at the top", () => {
    let checked = 0;
    flora.group.traverse((object) => {
      if (object.name !== "abyss-veil") {
        return;
      }
      const color = (object as unknown as {
        geometry: { attributes: { color: { itemSize: number; array: Float32Array } } };
      }).geometry.attributes.color;
      expect(color.itemSize).toBe(4);
      const array = color.array;
      const rows = 5;
      // First column: the foot is deep violet-leaning and nearly opaque,
      // the top row fully transparent — the edge the critic saw is gone by
      // construction, not by luck.
      expect(array[3]).toBeGreaterThan(0.85);
      expect(array[(rows - 1) * 4 + 3]).toBe(0);
      expect(array[0]).toBeLessThan(array[(rows - 1) * 4]!);
      checked++;
    });
    expect(checked).toBe(3);
  });
});

describe("the look-back composition (W-O1)", () => {
  const flora = new AbyssFlora();

  const byName = (name: string): unknown => {
    let found: unknown;
    flora.group.traverse((object) => {
      if (object.name === name) {
        found = object;
      }
    });
    expect(found, name).toBeDefined();
    return found;
  };

  it("shapes every polyp bud with a tip-bright baked gradient", () => {
    const polyps = byName("abyss-polyps") as {
      geometry: {
        attributes: {
          position: { count: number; getY: (i: number) => number };
          color: { itemSize: number; getX: (i: number) => number };
        };
      };
      material: { vertexColors: boolean };
    };
    const { position, color } = polyps.geometry.attributes;
    expect(color, "bud gradient attribute").toBeDefined();
    expect(color.itemSize).toBe(3);
    expect(polyps.material.vertexColors).toBe(true);
    // The tip is genuinely brighter than the base, and nothing exceeds 1 —
    // the glow lives in the halo, not in a buffer.
    let top = 0;
    let bottom = Infinity;
    for (let i = 0; i < position.count; i++) {
      const value = color.getX(i);
      expect(value).toBeLessThanOrEqual(1.0001);
      if (position.getY(i) > 0.09) {
        top = Math.max(top, value);
      }
      if (position.getY(i) < -0.09) {
        bottom = Math.min(bottom, value);
      }
    }
    expect(top - bottom).toBeGreaterThan(0.3);
  });

  it("gives every bud a halo point just above its tip", () => {
    const polyps = byName("abyss-polyps") as {
      count: number;
      getMatrixAt: (i: number, m: Matrix4) => void;
    };
    const halos = byName("abyss-polyp-halos") as {
      geometry: { attributes: { position: { count: number; array: Float32Array } } };
    };
    const positions = halos.geometry.attributes.position;
    expect(positions.count).toBe(polyps.count);
    // Each halo rides its own bud: same plan position, centre above the
    // bud's — the lifted core is what survives the bud's depth test.
    const matrix = new Matrix4();
    for (const index of [0, 41, polyps.count - 1]) {
      polyps.getMatrixAt(index, matrix);
      expect(positions.array[index * 3]).toBeCloseTo(matrix.elements[12]!, 5);
      expect(positions.array[index * 3 + 2]).toBeCloseTo(matrix.elements[14]!, 5);
      expect(positions.array[index * 3 + 1]).toBeGreaterThan(matrix.elements[13]!);
    }
  });

  it("stands gate-side kelp silhouettes inside the gate, off the corridor", () => {
    const fronds = byName("abyss-fronds") as {
      geometry: { attributes: { position: { array: Float32Array } } };
    };
    const position = fronds.geometry.attributes.position.array;
    // W-M3's plants all root at r ≥ 36.5; the gate-side silhouettes stand
    // inside r = 36, and no tip may clear y = +2 (shot I's grazing ray).
    let inside = 0;
    for (let i = 0; i < position.length; i += 3) {
      const along = position[i]! * 0.7037725526787336 + position[i + 2]! * 0.7104246477188941;
      if (along < 36) {
        inside++;
        expect(position[i + 1]!, "gate-side kelp height").toBeLessThan(2);
      }
    }
    expect(inside).toBeGreaterThan(40);
  });

  it("varies the wall paint within a band, and brightens the climb toward the gate", () => {
    // The mottle: neighbouring points mid-shelf differ in value. Averaged
    // over a small ring so one unlucky flat patch cannot pass or fail it.
    const luma = (x: number, z: number, y: number): number => {
      const tint = canyonStrata(x, z, y);
      expect(tint).not.toBeNull();
      return 0.3 * tint![0] + 0.55 * tint![1] + 0.15 * tint![2];
    };
    const axis = { x: 0.7037725526787336, z: 0.7104246477188941 };
    const perp = { x: -axis.z, z: axis.x };
    let spread = 0;
    for (let lat = -4; lat < 4; lat += 1) {
      const a = luma(38 * axis.x + lat * perp.x, 38 * axis.z + lat * perp.z, -4);
      const b = luma(38 * axis.x + (lat + 1) * perp.x, 38 * axis.z + (lat + 1) * perp.z, -4);
      spread = Math.max(spread, Math.abs(a - b));
    }
    expect(spread, "within-band mottle").toBeGreaterThan(0.02);

    // The gate glow: at the same elevation, the wall near the sill is
    // brighter than the wall at the den — averaged across the wedge so the
    // mottle washes out.
    const meanAt = (r: number): number => {
      let sum = 0;
      for (let lat = -2; lat <= 2; lat++) {
        sum += luma(r * axis.x + lat * perp.x, r * axis.z + lat * perp.z, -1.8);
      }
      return sum / 5;
    };
    expect(meanAt(33)).toBeGreaterThan(meanAt(42) + 0.08);
  });
});

/** Local mirror of the one-function terrain contract, for strata sampling. */
function seabedHeightAt(x: number, z: number): number {
  // The strata only need *an* elevation to sample at in the bowl — they must
  // be null there whatever y is handed in. Zero is fine.
  void x;
  void z;
  return 0;
}
