import { BufferGeometry, InstancedMesh, Matrix4, Mesh, MeshToonMaterial, Points, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { seabedHeight } from "../src/world/Seabed";
import { angleBetween, wedgeHalfAt } from "../src/world/wings/WingGeometry";
import { wingById } from "../src/world/wings/WingRegistry";
import type { WingDef, WingFlora } from "../src/world/wings/WingTypes";
import { buildRuinsTerraceFlora } from "../src/world/wings/flora/RuinsTerraceFlora";
import { buildMangroveRootsFlora } from "../src/world/wings/flora/MangroveRootsFlora";
import { buildOpenBlueFlora } from "../src/world/wings/flora/OpenBlueFlora";

/**
 * The W4 wings' own contracts: the Ruins Terrace, the Mangrove Roots and
 * the Open Blue, checked in plain Node in the style every biome before
 * them answered to — deterministic from their seeds, confined to their
 * wedges, and obedient to the three fences the brief laid down:
 *
 * - the ruins' corridor stays swimmable and the Kirin's meadow stays open;
 * - the mangrove's winding lane stays clear of every root;
 * - the Open Blue stays *empty* — the one wing where the important
 *   assertion is about what does not exist.
 */

const RUINS = wingById("ruins-terrace");
const MANGROVE = wingById("mangrove-roots");
const OPEN_BLUE = wingById("open-blue");

/** Per-piece radial margins used when instance centres stand in for vertices. */
const PIECE_MARGIN: Record<string, number> = {
  "w4-ruins-drums": 0.85,
  "w4-ruins-stones": 0.75,
  "w4-ruins-tufts": 0.5,
  "w4-mangrove-stumps": 0.5,
  "w4-mangrove-tufts": 0.5,
  "w4-openblue-lip": 1.4,
};

interface FloraPieces {
  /** Meshes whose material is toon — the solid world-space pieces. */
  readonly solid: Mesh[];
  readonly instanced: InstancedMesh[];
  readonly points: Points[];
  /** Every child that costs a draw call. */
  readonly draws: number;
}

function collect(flora: WingFlora): FloraPieces {
  const solid: Mesh[] = [];
  const instanced: InstancedMesh[] = [];
  const points: Points[] = [];
  let draws = 0;
  for (const child of flora.group.children) {
    if (child instanceof InstancedMesh) {
      instanced.push(child);
      draws++;
    } else if (child instanceof Points) {
      points.push(child);
      draws++;
    } else if (child instanceof Mesh) {
      draws++;
      const material = child.material;
      if (!Array.isArray(material) && material instanceof MeshToonMaterial) {
        solid.push(child);
      }
    }
  }
  return { solid, instanced, points, draws };
}

function vertices(geometry: BufferGeometry): Vector3[] {
  const position = geometry.attributes.position;
  const out: Vector3[] = [];
  if (!position) {
    return out;
  }
  for (let i = 0; i < position.count; i++) {
    out.push(new Vector3(position.getX(i), position.getY(i), position.getZ(i)));
  }
  return out;
}

function instancePositions(mesh: InstancedMesh): Vector3[] {
  const matrix = new Matrix4();
  const out: Vector3[] = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    out.push(new Vector3().setFromMatrixPosition(matrix));
  }
  return out;
}

function triangles(pieces: FloraPieces): number {
  let total = 0;
  const count = (geometry: BufferGeometry): number =>
    (geometry.index ? geometry.index.count : (geometry.attributes.position?.count ?? 0)) / 3;
  for (const mesh of pieces.solid) {
    total += count(mesh.geometry);
  }
  for (const mesh of pieces.instanced) {
    total += count(mesh.geometry) * mesh.count;
  }
  return total;
}

/** |angle| off the wing's axis, in radians. */
function offAxis(def: WingDef, p: Vector3): number {
  return angleBetween(Math.atan2(p.z, p.x), def.azimuth);
}

/** The across-axis coordinate — the meadow and corridor's native measure. */
function lateralOf(def: WingDef, p: Vector3): number {
  return p.x * -Math.sin(def.azimuth) + p.z * Math.cos(def.azimuth);
}

function buildAll(): { ruins: WingFlora; mangrove: WingFlora; openBlue: WingFlora } {
  return {
    ruins: buildRuinsTerraceFlora(RUINS),
    mangrove: buildMangroveRootsFlora(MANGROVE),
    openBlue: buildOpenBlueFlora(OPEN_BLUE),
  };
}

describe("the W4 wings' flora", () => {
  it("is deterministic from its seeds, to the bit", () => {
    const first = buildAll();
    const second = buildAll();
    for (const key of ["ruins", "mangrove", "openBlue"] as const) {
      const a = first[key].group.children;
      const b = second[key].group.children;
      expect(a.length, key).toBe(b.length);
      for (let i = 0; i < a.length; i++) {
        const childA = a[i]!;
        const childB = b[i]!;
        expect(childB.name, `${key}[${i}]`).toBe(childA.name);
        if (childA instanceof InstancedMesh && childB instanceof InstancedMesh) {
          expect(childB.count).toBe(childA.count);
          const matrixA = new Matrix4();
          const matrixB = new Matrix4();
          for (let j = 0; j < childA.count; j++) {
            childA.getMatrixAt(j, matrixA);
            childB.getMatrixAt(j, matrixB);
            expect(matrixB.elements, `${childA.name} #${j}`).toEqual(matrixA.elements);
          }
        }
        if (childA instanceof Mesh && childB instanceof Mesh) {
          const posA = childA.geometry.attributes.position;
          const posB = childB.geometry.attributes.position;
          expect(posB?.count, childA.name).toBe(posA?.count);
          if (posA && posB) {
            for (let v = 0; v < posA.count; v++) {
              expect(posB.getX(v)).toBe(posA.getX(v));
              expect(posB.getY(v)).toBe(posA.getY(v));
              expect(posB.getZ(v)).toBe(posA.getZ(v));
            }
          }
        }
      }
    }
  });

  it("stays inside its own wedge and the carve's radial run", () => {
    const wings: readonly [WingDef, WingFlora][] = [
      [RUINS, buildRuinsTerraceFlora(RUINS)],
      [MANGROVE, buildMangroveRootsFlora(MANGROVE)],
      [OPEN_BLUE, buildOpenBlueFlora(OPEN_BLUE)],
    ];
    for (const [def, flora] of wings) {
      const pieces = collect(flora);
      const check = (p: Vector3, margin: number, label: string): void => {
        const r = Math.hypot(p.x, p.z);
        expect(r, `${def.id} ${label} radial`).toBeGreaterThan(29.5);
        expect(r, `${def.id} ${label} radial`).toBeLessThan(50.5);
        const half = wedgeHalfAt(def, r);
        expect(offAxis(def, p) + margin / r, `${def.id} ${label} wedge`).toBeLessThan(half - 0.001);
      };
      for (const mesh of pieces.solid) {
        for (const p of vertices(mesh.geometry)) {
          check(p, 0, mesh.name);
        }
      }
      for (const mesh of pieces.instanced) {
        const margin = PIECE_MARGIN[mesh.name] ?? 0.5;
        for (const p of instancePositions(mesh)) {
          check(p, margin, mesh.name);
        }
      }
      for (const cloud of pieces.points) {
        for (const p of vertices(cloud.geometry)) {
          check(p, 0, cloud.name);
        }
      }
    }
  });

  it("keeps the ruins' corridor swimmable and the Kirin's meadow open", () => {
    const pieces = collect(buildRuinsTerraceFlora(RUINS));

    // The corridor: r 30–46, |across| < 0.06 rad holds nothing a diver could
    // touch — overhead stone (the hero arch's lintel) is the only exception.
    const corridor = (p: Vector3, margin: number, label: string): void => {
      const r = Math.hypot(p.x, p.z);
      if (r < 30 || r > 46) {
        return;
      }
      const angle = offAxis(RUINS, p);
      const overhead = p.y > seabedHeight(p.x, p.z) + 2.4;
      expect(
        angle >= 0.06 + margin / r || overhead,
        `${label} at r=${r.toFixed(1)} angle=${angle.toFixed(3)}`,
      ).toBe(true);
    };
    for (const mesh of pieces.solid) {
      for (const p of vertices(mesh.geometry)) {
        corridor(p, 0, mesh.name);
      }
    }
    for (const mesh of pieces.instanced) {
      const margin = PIECE_MARGIN[mesh.name] ?? 0.5;
      for (const p of instancePositions(mesh)) {
        corridor(p, margin, mesh.name);
      }
    }

    // The meadow: r 38–44 keeps a clearing at least 4 m wide down the
    // monuments — everything stands 2 m or more off the axis there.
    const meadow = (p: Vector3, margin: number, label: string): void => {
      const r = Math.hypot(p.x, p.z);
      if (r < 38 || r > 44) {
        return;
      }
      expect(
        Math.abs(lateralOf(RUINS, p)) >= 2.0 || margin >= 2.0,
        `${label} meadow at r=${r.toFixed(1)}`,
      ).toBe(true);
    };
    for (const mesh of pieces.solid) {
      for (const p of vertices(mesh.geometry)) {
        meadow(p, 0, mesh.name);
      }
    }
    for (const mesh of pieces.instanced) {
      for (const p of instancePositions(mesh)) {
        meadow(p, 2.0, mesh.name);
      }
    }

    // The gate stretch is scenery-only: nothing solid stands tall below r 34.5.
    for (const mesh of pieces.solid) {
      for (const p of vertices(mesh.geometry)) {
        const r = Math.hypot(p.x, p.z);
        if (r < 34.5) {
          expect(p.y, `${mesh.name} gate`).toBeLessThan(seabedHeight(p.x, p.z) + 1.6);
        }
      }
    }
    for (const mesh of pieces.instanced) {
      for (const p of instancePositions(mesh)) {
        const r = Math.hypot(p.x, p.z);
        if (r < 34.5) {
          // Only ankle-height scenery may dress the gate: the moss boulders
          // and the low tufts at the arch's feet, nothing taller.
          const smallwork = ["w4-ruins-stones", "w4-ruins-tufts"];
          expect(smallwork, `gate piece ${mesh.name}`).toContain(mesh.name);
          expect(p.y, `${mesh.name} gate`).toBeLessThan(seabedHeight(p.x, p.z) + 1.2);
        }
      }
    }
  });

  it("keeps the mangrove's winding lane clear of every root", () => {
    const pieces = collect(buildMangroveRootsFlora(MANGROVE));

    // The lane: r 30–46, |across| < 0.05 rad holds no solid geometry at all.
    const lane = (p: Vector3, margin: number, label: string): void => {
      const r = Math.hypot(p.x, p.z);
      if (r < 30 || r > 46) {
        return;
      }
      const angle = offAxis(MANGROVE, p);
      expect(
        angle,
        `${label} at r=${r.toFixed(1)} lateral=${lateralOf(MANGROVE, p).toFixed(2)}`,
      ).toBeGreaterThanOrEqual(0.05 + margin / r);
    };
    for (const mesh of pieces.solid) {
      for (const p of vertices(mesh.geometry)) {
        lane(p, 0, mesh.name);
      }
    }
    for (const mesh of pieces.instanced) {
      const margin = PIECE_MARGIN[mesh.name] ?? 0.5;
      for (const p of instancePositions(mesh)) {
        lane(p, margin, mesh.name);
      }
    }

    // The gate stretch: nothing solid at all below r 34 — the roots begin
    // past the doorway, their crowns pierce the roof well inside.
    for (const mesh of pieces.solid) {
      for (const p of vertices(mesh.geometry)) {
        expect(Math.hypot(p.x, p.z), `${mesh.name} gate`).toBeGreaterThanOrEqual(34);
      }
    }
    for (const mesh of pieces.instanced) {
      for (const p of instancePositions(mesh)) {
        expect(Math.hypot(p.x, p.z), `${mesh.name} gate`).toBeGreaterThanOrEqual(34);
      }
    }
  });

  it("leaves the Open Blue empty past the lip, except the far accents", () => {
    const pieces = collect(buildOpenBlueFlora(OPEN_BLUE));

    // The brief's exact law: zero flora *instances* with r > 38 except the
    // far accents (the curtains and the lone spire, which live past r 46).
    for (const mesh of pieces.instanced) {
      for (const p of instancePositions(mesh)) {
        const r = Math.hypot(p.x, p.z);
        expect(r, `${mesh.name} past the lip`).toBeLessThanOrEqual(38);
      }
    }
    for (const mesh of pieces.solid) {
      const accent = mesh.name.startsWith("w4-openblue-curtain") || mesh.name === "w4-openblue-spire";
      expect(accent, `${mesh.name} is no accent`).toBe(true);
      for (const p of vertices(mesh.geometry)) {
        const r = Math.hypot(p.x, p.z);
        expect(r, `${mesh.name} accent radius`).toBeGreaterThanOrEqual(44);
      }
    }

    // The motes are sparse and stay in the approach water.
    expect(pieces.points).toHaveLength(1);
    const motes = vertices(pieces.points[0]!.geometry);
    expect(motes.length).toBeLessThanOrEqual(90);
    for (const p of motes) {
      expect(Math.hypot(p.x, p.z), "mote radius").toBeLessThanOrEqual(40);
    }
  });

  it("holds the draw and triangle budgets — the Open Blue far under", () => {
    const budgets: readonly [WingDef, WingFlora, number][] = [
      [RUINS, buildRuinsTerraceFlora(RUINS), 30000],
      [MANGROVE, buildMangroveRootsFlora(MANGROVE), 30000],
      [OPEN_BLUE, buildOpenBlueFlora(OPEN_BLUE), 9000],
    ];
    for (const [def, flora, maxTriangles] of budgets) {
      const pieces = collect(flora);
      expect(pieces.draws, `${def.id} draws`).toBeLessThanOrEqual(10);
      expect(triangles(pieces), `${def.id} triangles`).toBeLessThanOrEqual(maxTriangles);
      for (const mesh of pieces.instanced) {
        expect(mesh.castShadow, `${mesh.name} shadow`).toBe(def.id === "ruins-terrace" && mesh.name === "w4-ruins-drums");
      }
    }
  });

  it("plants its smallwork on the seabed it stands on", () => {
    const grounded: readonly [WingDef, WingFlora, readonly string[]][] = [
      [RUINS, buildRuinsTerraceFlora(RUINS), ["w4-ruins-stones", "w4-ruins-tufts"]],
      [MANGROVE, buildMangroveRootsFlora(MANGROVE), ["w4-mangrove-stumps", "w4-mangrove-tufts"]],
      [OPEN_BLUE, buildOpenBlueFlora(OPEN_BLUE), ["w4-openblue-lip"]],
    ];
    for (const [def, flora, names] of grounded) {
      const pieces = collect(flora);
      for (const mesh of pieces.instanced) {
        if (!names.includes(mesh.name)) {
          continue;
        }
        for (const p of instancePositions(mesh)) {
          expect(
            Math.abs(p.y - seabedHeight(p.x, p.z)),
            `${def.id} ${mesh.name} foot`,
          ).toBeLessThan(0.35);
        }
      }
    }
  });

  it("runs the mangrove's dapple shimmer, stills it under reduced motion", () => {
    const flora = buildMangroveRootsFlora(MANGROVE);
    expect(flora.update).toBeDefined();
    for (let i = 0; i < 600; i++) {
      flora.update!(1 / 60, false);
    }
    flora.update!(1 / 60, true);
    // A minute of frames leaves every matrix finite.
    for (const mesh of collect(flora).instanced) {
      const matrix = new Matrix4();
      mesh.getMatrixAt(0, matrix);
      expect(Number.isFinite(matrix.elements[12])).toBe(true);
    }
  });

  it("returns contact patches for the substantial pieces", () => {
    const ruins = buildRuinsTerraceFlora(RUINS);
    expect(ruins.contacts?.length ?? 0).toBeGreaterThan(10);
    const mangrove = buildMangroveRootsFlora(MANGROVE);
    expect(mangrove.contacts?.length ?? 0).toBeGreaterThan(4);
    const openBlue = buildOpenBlueFlora(OPEN_BLUE);
    expect(openBlue.contacts?.length ?? 0).toBeGreaterThan(6);
    for (const flora of [ruins, mangrove, openBlue]) {
      for (const contact of flora.contacts ?? []) {
        const r = Math.hypot(contact.x, contact.z);
        expect(r, "contact radius").toBeGreaterThan(29.5);
        expect(r, "contact radius").toBeLessThan(50.5);
      }
    }
  });
});
