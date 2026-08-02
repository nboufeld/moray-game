import { describe, expect, it } from "vitest";
import { Color, InstancedMesh, Matrix4, Scene, Vector3 } from "three";
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

/**
 * The wave-8 re-sculpts, contracted in plain Node: budgets, silhouette
 * proportions and determinism — the things a turntable can judge but a
 * screenshot regression cannot. In Node the GLBs never arrive, so the crab
 * assertions inspect the procedural stand-in, which is painted in the GLB's
 * palette precisely so that either door shows the same animal.
 */
describe("the ground fauna's sculpted bodies", () => {
  it("starfish: tapered arms that curl off the sand under a dorsal ridge, inside 400 triangles", () => {
    const geometry = instancedMeshes(built(new Starfish()))[0]!.geometry;
    const triangles = geometry.getIndex()!.count / 3;
    expect(triangles).toBeGreaterThan(200);
    expect(triangles).toBeLessThanOrEqual(400);
    const position = geometry.attributes.position!;
    let rim = 0;
    let tipLift = 0;
    let crown = 0;
    for (let i = 0; i < position.count; i++) {
      const radius = Math.hypot(position.getX(i), position.getZ(i));
      const y = position.getY(i);
      rim = Math.max(rim, radius);
      if (radius > 0.92) {
        tipLift = Math.max(tipLift, y);
      }
      crown = Math.max(crown, y);
    }
    expect(rim).toBeGreaterThan(0.95); // unit-radius arms, as placed
    expect(tipLift).toBeGreaterThan(0.1); // the curl: tips lift off the dune
    expect(crown).toBeGreaterThan(0.31); // the ridge: proud of the old 0.3 dome
  });

  it("starfish builds the same star twice — the seeded bumps are deterministic", () => {
    const a = instancedMeshes(built(new Starfish()))[0]!.geometry;
    const b = instancedMeshes(built(new Starfish()))[0]!.geometry;
    expect([...(b.attributes.position!.array as Float32Array)]).toEqual([
      ...(a.attributes.position!.array as Float32Array),
    ]);
  });

  it("urchins: a dense shag of spines, warm-violet at the tips and dark at the roots", () => {
    const geometry = instancedMeshes(built(new Urchins()))[0]!.geometry;
    // Twenty spines read as a hedgehog's haircut; forty is the animal.
    expect(geometry.attributes.position!.count).toBeGreaterThan(300);
    expect(geometry.getIndex()!.count / 3).toBeLessThanOrEqual(400);
    const color = geometry.attributes.color!;
    let warmTips = 0;
    let darkest = Infinity;
    for (let i = 0; i < color.count; i++) {
      const r = color.getX(i);
      const g = color.getY(i);
      const b = color.getZ(i);
      if (b >= 1.1 && r > g && b > g) {
        warmTips++;
      }
      darkest = Math.min(darkest, r, g, b);
    }
    expect(warmTips).toBeGreaterThan(30); // roughly one pale point per spine
    expect(darkest).toBeLessThan(0.5); // roots sink into the shell's darkness
  });

  it("urchins build the same pincushion twice", () => {
    const a = instancedMeshes(built(new Urchins()))[0]!.geometry;
    const b = instancedMeshes(built(new Urchins()))[0]!.geometry;
    expect([...(b.attributes.position!.array as Float32Array)]).toEqual([
      ...(a.attributes.position!.array as Float32Array),
    ]);
  });

  it("crabs: the stand-in wears the sculpted palette under a near-neutral tint", () => {
    const crabs = built(new Crabs());
    const mesh = instancedMeshes(crabs)[0]!;
    const geometry = mesh.geometry;
    expect(geometry.getIndex()).not.toBeNull();
    // The shell hue lives in the geometry now: terracotta, not a white body
    // waiting for a tint to colour it.
    const color = geometry.attributes.color!;
    let rSum = 0;
    let bSum = 0;
    for (let i = 0; i < color.count; i++) {
      rSum += color.getX(i);
      bSum += color.getZ(i);
    }
    expect(rSum).toBeGreaterThan(bSum * 1.5);
    // And the per-instance multiplier is the warm near-neutral both doors
    // share — two draws per crab, in the order the stream always had.
    const tint = new Color();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getColorAt(i, tint);
      expect(tint.r).toBeGreaterThanOrEqual(tint.g);
      expect(tint.g).toBeGreaterThanOrEqual(tint.b);
      expect(tint.b).toBeGreaterThan(0.7);
    }
  });
});

describe("the anemone garden", () => {
  it("plants everything inside its clearing, north of the corridor band", () => {
    const garden = built(new AnemoneGarden());
    const spots = translations(garden);
    expect(spots.length).toBeGreaterThan(40);
    for (const spot of spots) {
      // Instance origins sit inside the clearing; a splayed tentacle's tip
      // may lean a little past its origin, which the margin absorbs.
      expect(Math.hypot(spot.x - 9.0, spot.z - 10.2)).toBeLessThan(3.0);
    }

    // The grand garden's placement contract. Wave 8 moved the garden off the
    // reserved disc at (7.5, 8.5): a 2.4 m plant radius around the old centre
    // would have dropped its southern rim across the z ≈ 6 band the ribbon
    // and the zebra are approached along, with crowns a metre tall. The new
    // rim is z = 7.8 — flush with the corridor box's own top edge.
    const matrix = new Matrix4();
    const spot = new Vector3();
    const trunks = instancedMeshes(garden).find((mesh) => mesh.name === "anemone-trunks")!;
    expect(trunks.count).toBeGreaterThanOrEqual(12);
    expect(trunks.count).toBeLessThanOrEqual(14);
    for (let i = 0; i < trunks.count; i++) {
      trunks.getMatrixAt(i, matrix);
      spot.setFromMatrixPosition(matrix);
      expect(Math.hypot(spot.x - 9.0, spot.z - 10.2)).toBeLessThan(2.45);
      expect(spot.z).toBeGreaterThan(7.75);
      // And clear of the neighbours the placement was measured against: the
      // tidepool coral's eastern plate stack, the slab rock's foot, and the
      // two crab doorsteps a crab wanders a metre from.
      expect(Math.hypot(spot.x - 5.24, spot.z - 10.73)).toBeGreaterThan(2.3);
      expect(Math.hypot(spot.x - 7, spot.z - 15)).toBeGreaterThan(2.85);
      expect(Math.hypot(spot.x - 5.3, spot.z - 10.6)).toBeGreaterThan(0.95);
      expect(Math.hypot(spot.x - 10.2, spot.z - 11.6)).toBeGreaterThan(0.95);
    }

    // Grand, but low against the corridor: tentacles root at the trunk tops,
    // and nothing but a fish hovers higher than a crown.
    for (const mesh of instancedMeshes(garden)) {
      if (mesh.name === "clownfish") {
        continue;
      }
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        spot.setFromMatrixPosition(matrix);
        expect(spot.y - seabedHeight(spot.x, spot.z)).toBeLessThan(0.75);
      }
    }
  });

  it("grows grand crowns in three families, on two tentacle tiers", () => {
    const garden = built(new AnemoneGarden());
    const meshes = instancedMeshes(garden);
    const trunks = meshes.find((mesh) => mesh.name === "anemone-trunks")!;
    const tentacles = meshes.find((mesh) => mesh.name === "anemone-tentacles")!;
    const carpet = meshes.find((mesh) => mesh.name === "anemone-carpet")!;
    // Twenty or so tentacles a crown across the two tiers.
    expect(tentacles.count + carpet.count).toBeGreaterThan(200);

    // The brief's sizes, 1.8–3.0: fluted trunks 0.40–0.66 m tall.
    const matrix = new Matrix4();
    const scale = new Vector3();
    for (let i = 0; i < trunks.count; i++) {
      trunks.getMatrixAt(i, matrix);
      scale.setFromMatrixScale(matrix);
      expect(scale.y).toBeGreaterThan(0.38);
      expect(scale.y).toBeLessThan(0.68);
    }

    // Rose-magenta, sand-gold and sea-green, and no fourth family.
    const color = new Color();
    const families = new Set<string>();
    for (let i = 0; i < trunks.count; i++) {
      trunks.getColorAt(i, color);
      families.add(`${color.r.toFixed(3)},${color.g.toFixed(3)},${color.b.toFixed(3)}`);
    }
    expect(families.size).toBe(3);

    // The long tier carries its beads: a failed geometry merge falls back to
    // a plain tube, and the bubble-tips are the silhouette. The recurved
    // beaded geometry reaches past x = 0.3 in unit space; a bare tube ends
    // at 0.16.
    const position = tentacles.geometry.attributes.position!;
    let reach = 0;
    for (let i = 0; i < position.count; i++) {
      reach = Math.max(reach, Math.abs(position.getX(i)));
    }
    expect(reach).toBeGreaterThan(0.3);
  });

  it("rebuilds the same garden from the same seed", () => {
    const first = translations(built(new AnemoneGarden()));
    const second = translations(built(new AnemoneGarden()));
    expect(first.length).toBe(second.length);
    for (let i = 0; i < first.length; i++) {
      expect(first[i]!.distanceTo(second[i]!)).toBe(0);
    }
  });

  it("swims a trio — two adults and a juvenile — at thrice life size", () => {
    const garden = built(new AnemoneGarden());
    const trio = garden.clownfish;
    expect(trio).not.toBeNull();
    if (!trio) {
      return;
    }
    expect(trio.mesh.count).toBe(3);
    const matrix = new Matrix4();
    const scale = new Vector3();
    const scales: number[] = [];
    for (let i = 0; i < trio.mesh.count; i++) {
      trio.mesh.getMatrixAt(i, matrix);
      scale.setFromMatrixScale(matrix);
      scales.push(scale.y);
    }
    // 3.0× the GLB's true 0.11 m — documented in Clownfish.ts: at life size
    // the fish is a dozen pixels lost in a metre-wide crown.
    scales.sort((a, b) => b - a);
    expect(scales[0]).toBeCloseTo(3.0, 5);
    expect(scales[1]).toBeCloseTo(3.0, 5);
    expect(scales[2]).toBeCloseTo(2.2, 5);
  });

  it("keeps the no-assets clownfish banded and legible", () => {
    const garden = built(new AnemoneGarden());
    const trio = garden.clownfish;
    expect(trio).not.toBeNull();
    if (!trio) {
      return;
    }
    // In plain Node the GLB never arrives, so what this inspects is the
    // procedural stand-in — which must carry the sculpted animal's own field
    // marks: orange, three white bands, black edgings, a dark eye.
    const color = trio.geometry.attributes.color;
    expect(color).toBeDefined();
    let white = 0;
    let black = 0;
    let orange = 0;
    for (let i = 0; i < color!.count; i++) {
      const r = color!.getX(i);
      const g = color!.getY(i);
      const b = color!.getZ(i);
      if (r > 0.85 && g > 0.8 && b > 0.7) {
        white++;
      } else if (r < 0.25 && g < 0.25 && b < 0.3) {
        black++;
      } else {
        orange++;
      }
    }
    expect(white).toBeGreaterThan(80);
    // The edging is a line, not a stripe: thin, but present on every band.
    expect(black).toBeGreaterThan(18);
    // An orange fish with white bands, not a banded fish with orange gaps.
    expect(orange).toBeGreaterThan(white);
    expect(orange).toBeGreaterThan(black);
  });

  it("sends the clownfish into the tentacles when the diver closes, and back out", () => {
    const garden = built(new AnemoneGarden());
    const trio = garden.clownfish;
    expect(trio).not.toBeNull();
    if (!trio) {
      return;
    }
    const ground = seabedHeight(9.0, 10.2);

    // Diver far away: the trio weaves in open water over the crowns.
    let clock = run(garden, 20, new Vector3(0, 2, 22));
    expect(trio.isHiding).toBe(false);
    for (const fish of trio.positions()) {
      expect(fish.y).toBeGreaterThan(ground + 0.55);
      expect(Math.hypot(fish.x - 9.0, fish.z - 10.2)).toBeLessThan(1.8);
    }

    // Diver arrives: all three drop into the crowns and hold there — up the
    // trunk, nestled in the carpet, not buried under the sand.
    clock = run(garden, 8, new Vector3(9.0, 2, 11.4), clock);
    expect(trio.isHiding).toBe(true);
    for (const fish of trio.positions()) {
      expect(fish.y).toBeLessThan(ground + 0.85);
      expect(fish.y).toBeGreaterThan(ground + 0.25);
      expect(Math.hypot(fish.x - 9.0, fish.z - 10.2)).toBeLessThan(2.6);
    }

    // Diver stands off past the (larger) emerge range: they come back out.
    run(garden, 25, new Vector3(9.0, 2, 15.6), clock);
    expect(trio.isHiding).toBe(false);
    const emerged = trio.positions();
    expect(emerged.some((fish) => fish.y > ground + 0.8)).toBe(true);
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
