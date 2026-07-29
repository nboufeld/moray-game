import { describe, expect, it } from "vitest";
import { InstancedMesh, Matrix4, Scene, Vector3 } from "three";
import { isClear } from "../src/world/CoralField";
import { CorridorDressing } from "../src/world/CorridorDressing";
import { SEEDS } from "../src/util/Random";

/**
 * The spawn corridor's edge dressing (W-N5), checked in plain Node under the
 * seaweed field's rules: deterministic from its seed, DOM-free, disposable —
 * and, the one rule this package is not allowed to get wrong, never standing
 * *in* the corridor it exists to frame. The channel is a deliberate approach
 * lane; the dressing lives on its edges or it defeats itself.
 */

/** The spawn corridor box from `CoralField.CORRIDORS`, with the bed margins. */
const CHANNEL_HALF_WIDTH = 3.2;

function instancePositions(dressing: CorridorDressing): Vector3[] {
  const positions: Vector3[] = [];
  const matrix = new Matrix4();
  for (const child of dressing.group.children) {
    if (!(child instanceof InstancedMesh)) {
      continue;
    }
    for (let i = 0; i < child.count; i++) {
      child.getMatrixAt(i, matrix);
      positions.push(new Vector3().setFromMatrixPosition(matrix));
    }
  }
  return positions;
}

describe("the corridor dressing", () => {
  it("comes to five instanced draws, none casting a shadow", () => {
    const dressing = new CorridorDressing();
    const meshes = dressing.group.children.filter(
      (child): child is InstancedMesh => child instanceof InstancedMesh,
    );
    expect(meshes).toHaveLength(5);
    for (const mesh of meshes) {
      expect(mesh.castShadow, mesh.name).toBe(false);
      // Instance-aware bounds: the geometry's own sphere sits at the origin,
      // and a mesh culled by it vanishes whenever the origin leaves the frame.
      expect(mesh.boundingSphere, mesh.name).not.toBeNull();
      expect(mesh.boundingSphere!.center.length(), mesh.name).toBeGreaterThan(1);
    }
    dressing.dispose();
  });

  it("lays the same beds from the same seed", () => {
    const first = instancePositions(new CorridorDressing(SEEDS.corridorDressing));
    const second = instancePositions(new CorridorDressing(SEEDS.corridorDressing));
    expect(first.length).toBe(second.length);
    expect(first.length).toBeGreaterThan(20);
    for (let i = 0; i < first.length; i++) {
      expect(first[i]!.distanceToSquared(second[i]!)).toBe(0);
    }
  });

  it("keeps every piece out of the channel and inside the framed stretch", () => {
    for (const position of instancePositions(new CorridorDressing())) {
      const at = `at (${position.x.toFixed(2)}, ${position.z.toFixed(2)})`;
      // Outside the corridor box, with margin: the lane stays a lane.
      expect(Math.abs(position.x), at).toBeGreaterThan(CHANNEL_HALF_WIDTH + 0.1);
      // On the corridor's first ten metres from spawn, which is the brief.
      expect(position.z, at).toBeGreaterThan(11.5);
      expect(position.z, at).toBeLessThan(21.5);
      // And under the coral field's whole clearance law, read back from the
      // file that owns it.
      expect(isClear(position.x, position.z), at).toBe(true);
    }
  });

  it("reports contact patches that obey the same law", () => {
    const dressing = new CorridorDressing();
    expect(dressing.contacts.length).toBeGreaterThan(8);
    for (const contact of dressing.contacts) {
      expect(isClear(contact.x, contact.z), `${contact.x},${contact.z}`).toBe(true);
      expect(Math.abs(contact.x)).toBeGreaterThan(CHANNEL_HALF_WIDTH);
    }
  });

  it("runs a minute of frames and lets go of everything after it", () => {
    const dressing = new CorridorDressing();
    const scene = new Scene();
    scene.add(dressing.group);
    for (let i = 0; i < 3600; i++) {
      dressing.update(1 / 60, false);
    }
    dressing.update(1 / 60, true);
    dressing.dispose();
    expect(scene.children).not.toContain(dressing.group);
    expect(dressing.group.children).toHaveLength(0);
    dressing.dispose();
  });
});
