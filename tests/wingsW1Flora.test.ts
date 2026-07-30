import { InstancedMesh, Mesh, Points, Vector3, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import { seabedHeight } from "../src/world/Seabed";
import { angleBetween, wedgeHalfAt } from "../src/world/wings/WingGeometry";
import type { WingDef, WingFlora } from "../src/world/wings/WingTypes";
import { KELP_CATHEDRAL } from "../src/world/wings/defs/KelpCathedral";
import { LUMEN_GARDEN } from "../src/world/wings/defs/LumenGarden";
import { NURSERY_SHALLOWS } from "../src/world/wings/defs/NurseryShallows";
import { buildKelpCathedralFlora } from "../src/world/wings/flora/KelpCathedralFlora";
import { buildLumenGardenFlora } from "../src/world/wings/flora/LumenGardenFlora";
import { buildNurseryShallowsFlora } from "../src/world/wings/flora/NurseryShallowsFlora";

/**
 * Worker W1's wing-flora contracts, in the style every biome before it
 * answered to: determinism (two builds are bit-identical), confinement
 * (every instance, point, merged vertex and contact inside the wing's own
 * wedge), the corridor fences the brief sets (the nursery's den corridor and
 * gate, the lumen garden's clear heart, the cathedral's aisle), and the
 * per-wing budgets (≤ 10 draw calls, ≤ 30 000 triangles).
 */

const WINGS_UNDER_TEST: readonly {
  readonly def: WingDef;
  readonly build: (def: WingDef) => WingFlora;
}[] = [
  { def: KELP_CATHEDRAL, build: buildKelpCathedralFlora },
  { def: NURSERY_SHALLOWS, build: buildNurseryShallowsFlora },
  { def: LUMEN_GARDEN, build: buildLumenGardenFlora },
];

/** Per-wing budgets, straight from the wave brief. */
const MAX_DRAWS = 10;
const MAX_TRIS = 30_000;

interface FloraSnapshot {
  readonly instanceMatrices: number[][];
  readonly meshPositions: number[][];
  readonly pointPositions: number[][];
}

/** Everything that must agree between two builds of the same wing. */
function snapshot(flora: WingFlora): FloraSnapshot {
  const instanceMatrices: number[][] = [];
  const meshPositions: number[][] = [];
  const pointPositions: number[][] = [];
  flora.group.traverse((object) => {
    if (object instanceof InstancedMesh) {
      instanceMatrices.push(Array.from(object.instanceMatrix.array));
    } else if (object instanceof Points) {
      pointPositions.push(Array.from(object.geometry.attributes.position!.array as Float32Array));
    } else if (object instanceof Mesh) {
      meshPositions.push(Array.from(object.geometry.attributes.position!.array as Float32Array));
    }
  });
  return { instanceMatrices, meshPositions, pointPositions };
}

interface DrawStats {
  draws: number;
  tris: number;
}

/**
 * Connective-1 (MASTER R2): a gateway wing's gate veil is Phase 3 uplift
 * on its own budget (≤ +10 draws / ≤ 35k tris per Tier A wing), measured
 * and asserted in `tests/wingsConnective1.test.ts`. The wave-8 cap below
 * keeps pinning the ORIGINAL flora, so the veil's subtree is excluded
 * here — and only here; the determinism and confinement checks still
 * read it.
 */
function insideGateVeil(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (o.name === "wing-gate-veil") {
      return true;
    }
  }
  return false;
}

function drawStats(flora: WingFlora): DrawStats {
  let draws = 0;
  let tris = 0;
  flora.group.traverse((object) => {
    if (insideGateVeil(object)) {
      return;
    }
    if (object instanceof Points) {
      draws++;
      return;
    }
    if (object instanceof Mesh) {
      draws++;
      const geometry = object.geometry;
      const per = geometry.index ? geometry.index.count / 3 : geometry.attributes.position!.count / 3;
      tris += per * (object instanceof InstancedMesh ? object.count : 1);
    }
  });
  return { draws, tris };
}

/** Every instanced matrix's translation, across every InstancedMesh. */
function instancePositions(flora: WingFlora): Vector3[] {
  const positions: Vector3[] = [];
  flora.group.traverse((object) => {
    if (object instanceof InstancedMesh) {
      const array = object.instanceMatrix.array;
      for (let i = 0; i < object.count; i++) {
        positions.push(
          new Vector3(array[i * 16 + 12]!, array[i * 16 + 13]!, array[i * 16 + 14]!),
        );
      }
    }
  });
  return positions;
}

/** Every Points cloud's (base) positions, across every Points node. */
function pointPositions(flora: WingFlora, name?: string): Vector3[] {
  const positions: Vector3[] = [];
  flora.group.traverse((object) => {
    if (object instanceof Points && (name === undefined || object.name === name)) {
      const array = object.geometry.attributes.position!.array as Float32Array;
      for (let i = 0; i < array.length; i += 3) {
        positions.push(new Vector3(array[i]!, array[i + 1]!, array[i + 2]!));
      }
    }
  });
  return positions;
}

/** Every plain (non-instanced) mesh vertex, across every merged Mesh. */
function mergedVertices(flora: WingFlora): Vector3[] {
  const vertices: Vector3[] = [];
  flora.group.traverse((object) => {
    if (object instanceof Mesh && !(object instanceof InstancedMesh)) {
      const array = object.geometry.attributes.position!.array as Float32Array;
      for (let i = 0; i < array.length; i += 3) {
        vertices.push(new Vector3(array[i]!, array[i + 1]!, array[i + 2]!));
      }
    }
  });
  return vertices;
}

function angularMargin(def: WingDef, position: Vector3): number {
  const r = Math.hypot(position.x, position.z);
  return wedgeHalfAt(def, r) - angleBetween(Math.atan2(position.z, position.x), def.azimuth);
}

function lateralOf(def: WingDef, position: Vector3): number {
  return position.x * -Math.sin(def.azimuth) + position.z * Math.cos(def.azimuth);
}

describe("W1 wing flora: determinism", () => {
  for (const { def, build } of WINGS_UNDER_TEST) {
    it(`builds ${def.id} bit-identically twice`, () => {
      const first = snapshot(build(def));
      const second = snapshot(build(def));
      expect(second.instanceMatrices, "instance matrices").toEqual(first.instanceMatrices);
      expect(second.meshPositions, "merged vertices").toEqual(first.meshPositions);
      expect(second.pointPositions, "point positions").toEqual(first.pointPositions);
    });
  }
});

describe("W1 wing flora: budgets", () => {
  for (const { def, build } of WINGS_UNDER_TEST) {
    it(`${def.id} stays under 10 draws and 30k triangles`, () => {
      const stats = drawStats(build(def));
      console.info(`[w1-budget] ${def.id}: ${stats.draws} draws, ${Math.round(stats.tris)} triangles`);
      expect(stats.draws, def.id).toBeLessThanOrEqual(MAX_DRAWS);
      expect(stats.tris, def.id).toBeLessThanOrEqual(MAX_TRIS);
    });
  }
});

describe("W1 wing flora: confinement", () => {
  for (const { def, build } of WINGS_UNDER_TEST) {
    it(`keeps every ${def.id} instance, point and contact inside the wedge`, () => {
      const flora = build(def);
      for (const position of instancePositions(flora)) {
        const r = Math.hypot(position.x, position.z);
        expect(r, `instance radius at ${position.x.toFixed(1)}, ${position.z.toFixed(1)}`).toBeGreaterThan(29.5);
        expect(r, `instance radius at ${position.x.toFixed(1)}, ${position.z.toFixed(1)}`).toBeLessThan(50.5);
        expect(
          angularMargin(def, position),
          `instance angle at ${position.x.toFixed(1)}, ${position.z.toFixed(1)}`,
        ).toBeGreaterThan(0.001);
      }
      for (const position of pointPositions(flora)) {
        expect(
          angularMargin(def, position),
          `point angle at ${position.x.toFixed(1)}, ${position.z.toFixed(1)}`,
        ).toBeGreaterThan(-0.001);
      }
      for (const contact of flora.contacts ?? []) {
        expect(
          angularMargin(def, new Vector3(contact.x, 0, contact.z)),
          `contact at ${contact.x.toFixed(1)}, ${contact.z.toFixed(1)}`,
        ).toBeGreaterThan(0.001);
      }
    });

    it(`keeps every ${def.id} merged vertex in the wing's neighbourhood`, () => {
      // Merged straps and ribbons sway on their own curves; the structural
      // bound is the wall angle plus a small allowance for reach, which the
      // builders size their crowns and fronds against.
      const flora = build(def);
      for (const vertex of mergedVertices(flora)) {
        expect(
          angularMargin(def, vertex),
          `vertex at ${vertex.x.toFixed(1)}, ${vertex.y.toFixed(1)}, ${vertex.z.toFixed(1)}`,
        ).toBeGreaterThan(-0.02);
      }
    });
  }
});

describe("the kelp cathedral's aisle", () => {
  it("plants every column foot clear of the axis", () => {
    const flora = buildKelpCathedralFlora(KELP_CATHEDRAL);
    expect(flora.contacts?.length).toBe(16);
    for (const contact of flora.contacts ?? []) {
      const r = Math.hypot(contact.x, contact.z);
      // The nave's rows keep a 6 m aisle; the gate sentinels hug the jambs
      // a step closer, on the wall slopes the brief gives to wall dressing.
      const fence = r > 34 ? 2.95 : 2.7;
      expect(
        Math.abs(lateralOf(KELP_CATHEDRAL, new Vector3(contact.x, 0, contact.z))),
        `column at ${contact.x.toFixed(1)}, ${contact.z.toFixed(1)}`,
      ).toBeGreaterThanOrEqual(fence);
    }
  });

  it("keeps the moss out of the aisle's heart", () => {
    const flora = buildKelpCathedralFlora(KELP_CATHEDRAL);
    const moss = instancePositions(flora);
    expect(moss.length).toBeGreaterThan(20);
    for (const pad of moss) {
      expect(
        Math.abs(lateralOf(KELP_CATHEDRAL, pad)),
        `moss pad at ${pad.x.toFixed(1)}, ${pad.z.toFixed(1)}`,
      ).toBeGreaterThanOrEqual(1.65);
    }
  });

  it("keeps every column foot planted on its own ground", () => {
    const flora = buildKelpCathedralFlora(KELP_CATHEDRAL);
    for (const contact of flora.contacts ?? []) {
      const height = seabedHeight(contact.x, contact.z);
      const r = Math.hypot(contact.x, contact.z);
      if (r > 34) {
        // The nave stands on ground the carve owns — below the sill at the
        // first stations, down to the floor's −5.5 at the heart. What it may
        // never stand on is rim rock, which is the + side of the water.
        expect(height).toBeGreaterThan(-8.5);
        expect(height).toBeLessThan(0);
      } else {
        // The sentinels stand on the gate's jamb slopes: rim-shoulder
        // terrain the sill has only begun to pull down.
        expect(height).toBeGreaterThan(-4);
        expect(height).toBeLessThan(2.6);
      }
    }
  });
});

describe("the nursery shallows' corridors", () => {
  it("keeps every piece of flora 0.06 rad off the axis for r 30–46", () => {
    const flora = buildNurseryShallowsFlora(NURSERY_SHALLOWS);
    const positions = instancePositions(flora);
    expect(positions.length).toBeGreaterThan(100);
    for (const position of positions) {
      const r = Math.hypot(position.x, position.z);
      if (r >= 30 && r <= 46) {
        const angle = angleBetween(
          Math.atan2(position.z, position.x),
          NURSERY_SHALLOWS.azimuth,
        );
        expect(angle, `flora at ${position.x.toFixed(1)}, ${position.z.toFixed(1)}`).toBeGreaterThanOrEqual(
          0.06,
        );
      }
    }
  });

  it("keeps the r 30–34 gate corridor open", () => {
    const flora = buildNurseryShallowsFlora(NURSERY_SHALLOWS);
    for (const position of instancePositions(flora)) {
      const r = Math.hypot(position.x, position.z);
      if (r >= 29.5 && r <= 34.5) {
        // The only dressing near the gate is the jamb pair, standing on the
        // wall slopes beyond the flat floor band.
        const angle = angleBetween(
          Math.atan2(position.z, position.x),
          NURSERY_SHALLOWS.azimuth,
        );
        expect(angle, `jamb at ${position.x.toFixed(1)}, ${position.z.toFixed(1)}`).toBeGreaterThan(
          NURSERY_SHALLOWS.wedge.floorHalf,
        );
      }
    }
  });
});

describe("the lumen garden's heart", () => {
  it("keeps the jelly's water clear of beds, strands and motes", () => {
    const flora = buildLumenGardenFlora(LUMEN_GARDEN);
    const solids = [...instancePositions(flora), ...mergedVertices(flora)];
    expect(solids.length).toBeGreaterThan(100);
    for (const position of solids) {
      const r = Math.hypot(position.x, position.z);
      if (r >= 39 && r <= 45) {
        const angle = angleBetween(Math.atan2(position.z, position.x), LUMEN_GARDEN.azimuth);
        expect(
          angle,
          `solid at ${position.x.toFixed(1)}, ${position.z.toFixed(1)}`,
        ).toBeGreaterThanOrEqual(0.064);
      }
    }
    // The halo points ride the domes' own fence; the drifting motes keep
    // the wider one — the jelly's column of water is theirs to frame.
    for (const halo of pointPositions(flora, "lumen-polyp-halos")) {
      const r = Math.hypot(halo.x, halo.z);
      if (r >= 39 && r <= 45) {
        const angle = angleBetween(Math.atan2(halo.z, halo.x), LUMEN_GARDEN.azimuth);
        expect(angle, `halo at ${halo.x.toFixed(1)}, ${halo.z.toFixed(1)}`).toBeGreaterThanOrEqual(
          0.063,
        );
      }
    }
    for (const mote of pointPositions(flora, "lumen-motes")) {
      const r = Math.hypot(mote.x, mote.z);
      if (r >= 39 && r <= 45) {
        expect(
          Math.abs(lateralOf(LUMEN_GARDEN, mote)),
          `mote at ${mote.x.toFixed(1)}, ${mote.z.toFixed(1)}`,
        ).toBeGreaterThanOrEqual(2.89);
      }
    }
  });
});

describe("W1 wing flora: motion", () => {
  for (const { def, build } of WINGS_UNDER_TEST) {
    it(`${def.id} updates without throwing, in both motion modes`, () => {
      const flora = build(def);
      expect(() => {
        flora.update?.(0.016, false);
        flora.update?.(0.016, true);
        flora.update?.(1.5, false);
      }).not.toThrow();
    });
  }

  it("keeps the lumen motes' drift bounded under reduced motion", () => {
    const flora = buildLumenGardenFlora(LUMEN_GARDEN);
    const before = pointPositions(flora);
    flora.update?.(3, true);
    const after = pointPositions(flora);
    expect(after.length).toBe(before.length);
    for (let i = 0; i < before.length; i++) {
      const drift = after[i]!.distanceTo(before[i]!);
      // The drift field's own amplitude: 0.3 across, 0.22 up, however long
      // the frame runs — the constellations breathe, they do not travel.
      expect(drift, `mote ${i}`).toBeLessThanOrEqual(0.75);
    }
  });
});
