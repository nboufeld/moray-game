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
    for (const mesh of [first.mesh, first.tallMesh]) {
      const other = mesh === first.mesh ? second.mesh : second.tallMesh;
      const a = mesh.instanceMatrix.array as Float32Array;
      const b = other.instanceMatrix.array as Float32Array;
      expect(a.length).toBe(b.length);
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          expect.fail(`instance matrix component ${i} drifted: ${a[i]} vs ${b[i]}`);
        }
      }
    }
    expect(first.tallMesh.count).toBe(second.tallMesh.count);
  });

  it("stands knee-high to chest-high, with the canopy well above it (W11)", () => {
    // The honest numbers behind "raise the meadow": the blade geometry is
    // 1.8 m now, and the per-instance draw is re-centred rather than
    // stretched, so the envelope widened in absolute metres without turning
    // the whole meadow into a wall. Measured from the instance matrices:
    // scaleY is the Y basis vector's length, and the broad variant's 0.74
    // multiplier is why the floor sits under the fine turf's 0.61.
    const grass = new SeaGrass(SEEDS.grass, []);
    const matrix = new Matrix4();
    const positionOf = new Vector3();
    const basisY = new Vector3();
    let low = Infinity;
    let high = -Infinity;
    for (let i = 0; i < grass.mesh.count; i++) {
      grass.mesh.getMatrixAt(i, matrix);
      positionOf.setFromMatrixPosition(matrix);
      if (positionOf.y < -100) {
        continue;
      }
      basisY.set(matrix.elements[4], matrix.elements[5], matrix.elements[6]);
      const height = basisY.length() * 1.8;
      low = Math.min(low, height);
      high = Math.max(high, height);
    }
    expect(low).toBeGreaterThan(0.44);
    expect(low).toBeLessThan(0.75);
    expect(high).toBeGreaterThan(1.75);
    expect(high).toBeLessThan(1.9);
    // The spread itself is the point: stands vary by well over a metre.
    expect(high - low).toBeGreaterThan(1.2);
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
    for (const mesh of [grass.mesh, grass.tallMesh]) {
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
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
    }
  });

  it("mixes a slimmer, S-curved tall variant through the patches (W11)", () => {
    const grass = new SeaGrass(SEEDS.grass, []);
    // Fifteen percent of patch blades draw a sibling, give or take the draw's
    // own variance; the meadow's stream is untouched either way.
    let meadowPlaced = 0;
    const matrix = new Matrix4();
    const positionOf = new Vector3();
    for (let i = 0; i < grass.mesh.count; i++) {
      grass.mesh.getMatrixAt(i, matrix);
      positionOf.setFromMatrixPosition(matrix);
      if (positionOf.y > -100) {
        meadowPlaced++;
      }
    }
    const share = grass.tallMesh.count / meadowPlaced;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.2);

    // The tall blade, measured: slimmer than the meadow blade (whose widest
    // row clears 0.2 above), standing about two metres before the instance
    // scale, and bowed in a gentle S — the forward reach peaks a row below
    // the tip, which hooks back instead of falling over.
    const position = grass.tallMesh.geometry.attributes.position as BufferAttribute;
    const rows: Vector3[][] = [];
    for (let i = 0; i < position.count; i += 3) {
      rows.push([
        new Vector3().fromBufferAttribute(position, i),
        new Vector3().fromBufferAttribute(position, i + 1),
        new Vector3().fromBufferAttribute(position, i + 2),
      ]);
    }
    expect(rows).toHaveLength(6);
    let widest = 0;
    for (const [left, , right] of rows as [Vector3, Vector3, Vector3][]) {
      widest = Math.max(widest, left.distanceTo(right));
    }
    expect(widest).toBeLessThan(0.2);
    const tip = rows[0]![1]!;
    const belowTip = rows[1]![1]!;
    const mid = rows[2]![1]!;
    expect(tip.y).toBeGreaterThan(1.9);
    expect(belowTip.z).toBeGreaterThan(tip.z);
    expect(belowTip.z).toBeGreaterThan(mid.z);

    // Its planted heights: roughly two metres and change, from the tall
    // geometry times the per-instance draw.
    const basisY = new Vector3();
    for (let i = 0; i < grass.tallMesh.count; i++) {
      grass.tallMesh.getMatrixAt(i, matrix);
      basisY.set(matrix.elements[4], matrix.elements[5], matrix.elements[6]);
      expect(basisY.length()).toBeGreaterThanOrEqual(0.82);
      expect(basisY.length()).toBeLessThan(1.13);
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
    expect(grass.tallMesh.count).toBeGreaterThan(0);
  });
});
