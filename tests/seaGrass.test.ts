import { describe, expect, it } from "vitest";
import { Matrix4, Vector2, Vector3, type BufferAttribute } from "three";
import { SeaGrass } from "../src/world/SeaGrass";
import { SEEDS } from "../src/util/Random";

/**
 * The meadow, checked in plain Node (W-N2).
 *
 * The blade rework this file guards is a *shape* change on an instanced mesh:
 * the strap became a lanceolate leaf with a cross-cup and a twist, and none
 * of that is visible to any existing test. What must not change with it is
 * everything else — the meadow draws its layout from one seeded stream, and a
 * geometry edit that touches the stream re-rolls every blade in the reef.
 */

function bladePositions(grass: SeaGrass): BufferAttribute {
  return grass.mesh.geometry.attributes.position as BufferAttribute;
}

describe("the sea grass meadow", () => {
  it("grows the same meadow from the same seed", () => {
    const first = new SeaGrass(SEEDS.grass, []);
    const second = new SeaGrass(SEEDS.grass, []);
    const a = first.mesh.instanceMatrix.array as Float32Array;
    const b = second.mesh.instanceMatrix.array as Float32Array;
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        expect.fail(`instance matrix component ${i} drifted: ${a[i]} vs ${b[i]}`);
      }
    }
  });

  it("cuts a leaf, not a strap: wide, cupped across, and twisted", () => {
    // The round critic's words were "enormous flat green plastic straps with
    // hard facet edges", and each clause has a number here. Wide: the widest
    // row must clear the old 0.182. Cupped: the centre column must stand off
    // the plane of its row's edges — a flat card's centre is exactly between
    // them. Twisted: the tip row's across axis must have turned out of the
    // root row's, or every blade is still a playing card seen edge-on.
    const grass = new SeaGrass(SEEDS.grass, []);
    const position = bladePositions(grass);

    // Group vertices into rows of three columns by index order: PlaneGeometry
    // emits vertices row-major, top row first.
    const rows: Vector3[][] = [];
    for (let i = 0; i < position.count; i += 3) {
      rows.push([
        new Vector3().fromBufferAttribute(position, i),
        new Vector3().fromBufferAttribute(position, i + 1),
        new Vector3().fromBufferAttribute(position, i + 2),
      ]);
    }
    expect(rows).toHaveLength(5);

    let widest = 0;
    let deepestCup = 0;
    for (const [left, centre, right] of rows as [Vector3, Vector3, Vector3][]) {
      widest = Math.max(widest, left.distanceTo(right));
      // The cup: the centre vertex against the midpoint of its row's edges.
      const mid = left.clone().add(right).multiplyScalar(0.5);
      deepestCup = Math.max(deepestCup, centre.distanceTo(mid));
    }
    expect(widest).toBeGreaterThan(0.2);
    expect(deepestCup).toBeGreaterThan(0.015);

    // The twist: the across direction at the root against the one nearest
    // the tip (the tip row itself is pinched to a point, so use row 1).
    const across = (row: Vector3[]): Vector3 => row[2]!.clone().sub(row[0]!).normalize();
    const rootRow = rows[rows.length - 1]!;
    const highRow = rows[1]!;
    expect(Math.abs(across(rootRow).dot(across(highRow)))).toBeLessThan(0.995);
  });

  it("keeps every blade out of the crevice clearances it is handed", () => {
    const spot = new Vector2(4, 4);
    const grass = new SeaGrass(SEEDS.grass, [spot]);
    const matrix = new Matrix4();
    const positionOf = new Vector3();
    for (let i = 0; i < grass.mesh.count; i++) {
      grass.mesh.getMatrixAt(i, matrix);
      positionOf.setFromMatrixPosition(matrix);
      if (positionOf.y < -100) {
        continue; // A parked spare, not a plant.
      }
      // 3.98 rather than 4: the clearance is enforced in float64 and the
      // instance matrix stores float32, so a blade at the exact boundary can
      // land a hair inside it after storage. A `Vector2` clearance carries
      // its z in `.y`, the way `Reef.buildSeaGrass` writes them.
      expect(Math.hypot(positionOf.x - spot.x, positionOf.z - spot.y)).toBeGreaterThan(3.98);
    }
  });

  it("survives a minute of frames, in both motion modes", () => {
    const grass = new SeaGrass(SEEDS.grass, []);
    for (let i = 0; i < 3600; i++) {
      grass.update(1 / 60, false);
    }
    grass.update(1 / 60, true);
    grass.update(0, false);
    expect(grass.mesh.count).toBeGreaterThan(0);
  });
});
