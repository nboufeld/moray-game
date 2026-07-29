import {
  InstancedMesh,
  Matrix4,
  Mesh,
  Points,
  Quaternion,
  Vector3,
  type Object3D,
} from "three";
import { describe, expect, it } from "vitest";
import { seabedHeight } from "../src/world/Seabed";
import { angleBetween, wedgeHalfAt, wingBlend } from "../src/world/wings/WingGeometry";
import { MOONLIT_LAGOON } from "../src/world/wings/defs/MoonlitLagoon";
import { VENT_SPRINGS } from "../src/world/wings/defs/VentSprings";
import { WRECK_MEADOW } from "../src/world/wings/defs/WreckMeadow";
import {
  MOONLIT_KOI_CIRCLE,
  buildMoonlitLagoonFlora,
} from "../src/world/wings/flora/MoonlitLagoonFlora";
import { buildVentSpringsFlora } from "../src/world/wings/flora/VentSpringsFlora";
import { buildWreckMeadowFlora } from "../src/world/wings/flora/WreckMeadowFlora";
import type { WingFlora } from "../src/world/wings/WingTypes";

/**
 * Worker W2's three wings — Wreck Meadow, Vent Springs, Moonlit Lagoon —
 * held to the wave's standing contracts: seeded determinism, confinement
 * to the authored wedges, floor pieces on the wing's own floor, the vent
 * wing's den corridor and the lagoon's koi circle kept clear, and the
 * per-wing draw/triangle budgets.
 */

const WINGS_UNDER_TEST = [
  { def: WRECK_MEADOW, build: buildWreckMeadowFlora },
  { def: VENT_SPRINGS, build: buildVentSpringsFlora },
  { def: MOONLIT_LAGOON, build: buildMoonlitLagoonFlora },
] as const;

interface Placed {
  readonly name: string;
  readonly position: Vector3;
  readonly scale: Vector3;
  readonly geometry: { readonly boundingBoxTop: number };
}

function placedInstances(root: Object3D): Placed[] {
  const placed: Placed[] = [];
  const matrix = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  root.traverse((object) => {
    if (object instanceof InstancedMesh) {
      object.geometry.computeBoundingBox();
      const top = object.geometry.boundingBox?.max.y ?? 0;
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix);
        matrix.decompose(position, quaternion, scale);
        // The builders park refused instances at y = −200.
        if (position.y < -100) {
          continue;
        }
        placed.push({
          name: object.name,
          position: position.clone(),
          scale: scale.clone(),
          geometry: { boundingBoxTop: top },
        });
      }
    }
  });
  return placed;
}

/** Vertices of the world-space plain meshes and point clouds. */
function worldVertices(root: Object3D): Vector3[] {
  const vertices: Vector3[] = [];
  root.traverse((object) => {
    if (object instanceof InstancedMesh) {
      return;
    }
    if (object instanceof Mesh || object instanceof Points) {
      const position = object.geometry.attributes.position;
      if (!position) {
        return;
      }
      for (let i = 0; i < position.count; i++) {
        vertices.push(new Vector3(position.getX(i), position.getY(i), position.getZ(i)));
      }
    }
  });
  return vertices;
}

function meshesOf(root: Object3D): (Mesh | InstancedMesh | Points)[] {
  const meshes: (Mesh | InstancedMesh | Points)[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh || object instanceof InstancedMesh || object instanceof Points) {
      meshes.push(object);
    }
  });
  return meshes;
}

function trianglesOf(root: Object3D): number {
  let total = 0;
  for (const mesh of meshesOf(root)) {
    const geometry = mesh.geometry;
    const tris = (geometry.index ? geometry.index.count : geometry.attributes.position?.count ?? 0) / 3;
    if (mesh instanceof InstancedMesh) {
      total += tris * mesh.count;
    } else if (mesh instanceof Points) {
      // A point sprite is two triangles at most.
      total += (geometry.attributes.position?.count ?? 0) * 2;
    } else {
      total += tris;
    }
  }
  return total;
}

function fingerprint(flora: WingFlora): unknown {
  const meshes = meshesOf(flora.group).map((mesh) => ({
    name: mesh.name,
    kind: mesh instanceof InstancedMesh ? "instanced" : mesh instanceof Points ? "points" : "mesh",
    positions: Array.from(mesh.geometry.attributes.position?.array ?? []),
    instanceMatrices:
      mesh instanceof InstancedMesh ? Array.from(mesh.instanceMatrix.array) : null,
    instanceColors:
      mesh instanceof InstancedMesh && mesh.instanceColor
        ? Array.from(mesh.instanceColor.array)
        : null,
  }));
  return { meshes, contacts: flora.contacts ?? [] };
}

describe("the W2 wings' flora", () => {
  it("is bit-identical between two builds of every wing", () => {
    for (const { def, build } of WINGS_UNDER_TEST) {
      const first = build(def);
      const second = build(def);
      expect(fingerprint(second), def.id).toEqual(fingerprint(first));
    }
  });

  it("keeps every mark inside its own wedge", () => {
    for (const { def, build } of WINGS_UNDER_TEST) {
      const flora = build(def);
      for (const placed of placedInstances(flora.group)) {
        const r = Math.hypot(placed.position.x, placed.position.z);
        const away = angleBetween(Math.atan2(placed.position.z, placed.position.x), def.azimuth);
        expect(away, `${def.id} ${placed.name} at r=${r.toFixed(1)}`).toBeLessThan(
          wedgeHalfAt(def, r) + 1e-3,
        );
      }
      for (const vertex of worldVertices(flora.group)) {
        const r = Math.hypot(vertex.x, vertex.z);
        const away = angleBetween(Math.atan2(vertex.z, vertex.x), def.azimuth);
        expect(away, `${def.id} vertex at r=${r.toFixed(1)}`).toBeLessThan(
          wedgeHalfAt(def, r) + 1e-3,
        );
      }
    }
  });

  it("stands its floor pieces where the wing owns the ground", () => {
    const floorPieces = new RegExp(/blades|timbers|moonlit-stones/);
    for (const { def, build } of WINGS_UNDER_TEST) {
      const flora = build(def);
      for (const placed of placedInstances(flora.group)) {
        if (!floorPieces.test(placed.name)) {
          continue;
        }
        expect(
          wingBlend(def, placed.position.x, placed.position.z),
          `${def.id} ${placed.name}`,
        ).toBeGreaterThan(0.49);
      }
    }
  });

  it("holds the vent-springs den corridor and gate corridor clear", () => {
    const flora = buildVentSpringsFlora(VENT_SPRINGS);
    const points = [
      ...placedInstances(flora.group).map((placed) => placed.position),
      ...worldVertices(flora.group),
    ];
    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      const r = Math.hypot(point.x, point.z);
      // The gate corridor (r 30–34) stays open: nothing stands there.
      expect(r, `gate corridor at r=${r.toFixed(1)}`).toBeGreaterThan(34.4);
      if (r >= 30 && r <= 46) {
        const away = angleBetween(Math.atan2(point.z, point.x), VENT_SPRINGS.azimuth);
        // Every piece keeps its footprint at least 0.06 rad off the axis;
        // the centres and bubbles asserted here carry their own margins.
        expect(away, `den corridor at r=${r.toFixed(1)}`).toBeGreaterThan(0.06 - 1e-3);
      }
    }
  });

  it("keeps the moon koi's circle clear of tall flora", () => {
    const flora = buildMoonlitLagoonFlora(MOONLIT_LAGOON);
    for (const placed of placedInstances(flora.group)) {
      const r = Math.hypot(placed.position.x, placed.position.z);
      if (r < MOONLIT_KOI_CIRCLE.from || r > MOONLIT_KOI_CIRCLE.to) {
        continue;
      }
      const floor = seabedHeight(placed.position.x, placed.position.z);
      const top = placed.position.y + placed.geometry.boundingBoxTop * placed.scale.y;
      expect(top, `${placed.name} at r=${r.toFixed(1)}`).toBeLessThan(
        floor + MOONLIT_KOI_CIRCLE.maxTop + 0.1,
      );
    }
    // The motes hug the floor inside the circle as well.
    for (const vertex of worldVertices(flora.group)) {
      const r = Math.hypot(vertex.x, vertex.z);
      if (r < MOONLIT_KOI_CIRCLE.from || r > MOONLIT_KOI_CIRCLE.to) {
        continue;
      }
      const floor = seabedHeight(vertex.x, vertex.z);
      expect(vertex.y, `vertex at r=${r.toFixed(1)}`).toBeLessThan(floor + MOONLIT_KOI_CIRCLE.maxTop);
    }
  });

  it("stays within the wave's per-wing budgets", () => {
    for (const { def, build } of WINGS_UNDER_TEST) {
      const flora = build(def);
      expect(meshesOf(flora.group).length, `${def.id} draw calls`).toBeLessThanOrEqual(10);
      expect(trianglesOf(flora.group), `${def.id} triangles`).toBeLessThanOrEqual(30000);
    }
  });

  it("updates under reduced motion without throwing, and barely drifts", () => {
    for (const { def, build } of WINGS_UNDER_TEST) {
      const flora = build(def);
      expect(() => {
        flora.update?.(1 / 60, false);
        flora.update?.(1 / 60, true);
      }, def.id).not.toThrow();
    }

    // The shimmer's contract: reduced motion stills the vent streams.
    const snapshot = (flora: WingFlora): Float32Array => {
      const bubbles = flora.group.getObjectByName("vent-bubbles");
      expect(bubbles).toBeInstanceOf(InstancedMesh);
      return new Float32Array((bubbles as InstancedMesh).instanceMatrix.array);
    };
    const drift = (before: Float32Array, after: Float32Array): number => {
      let total = 0;
      for (let i = 0; i < before.length; i++) {
        total += Math.abs((after[i] ?? 0) - (before[i] ?? 0));
      }
      return total / before.length;
    };

    const reduced = buildVentSpringsFlora(VENT_SPRINGS);
    const reducedBefore = snapshot(reduced);
    reduced.update?.(1, true);
    const reducedDrift = drift(reducedBefore, snapshot(reduced));

    const normal = buildVentSpringsFlora(VENT_SPRINGS);
    const normalBefore = snapshot(normal);
    normal.update?.(1, false);
    const normalDrift = drift(normalBefore, snapshot(normal));

    expect(normalDrift).toBeGreaterThan(reducedDrift * 1.5);
  });
});
