import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Mesh, Vector3 } from "three";
import {
  archGeometry,
  boulderGeometry,
  slabGeometry,
  stackGeometry,
  type StackSegment,
} from "../src/world/RockShapes";
import { SEEDS } from "../src/util/Random";

/**
 * The archetypes, checked for the four things that cannot be seen in a
 * screenshot and are fatal in the frame.
 *
 * An inverted lathe renders as a black hole in the reef, a missing colour
 * attribute renders as a black rock (the shared rock material asks for vertex
 * colours), a pole torn apart by the roughing renders as a puncture nobody
 * notices until they swim under it, and a foot lifted off the sand renders as a
 * stone hovering over its own contact shadow. All four are cheap to assert and
 * none of them is obvious from a capture.
 */

const OPTIONS = { seed: SEEDS.rockShapes, radius: 2, height: 2.2 };

/** The west pinnacle's blocks, as `Reef` authors them. */
const STACK: readonly StackSegment[] = [
  { radius: 2.6, rise: 1.9, stretch: 1.5, lean: 0 },
  { radius: 1.9, rise: 5.5, stretch: 1.7, lean: 0.75 },
  { radius: 0.85, rise: 8.15, stretch: 1.45, lean: 1.6 },
];

const SHAPES: readonly { name: string; make: () => BufferGeometry }[] = [
  { name: "boulder", make: () => boulderGeometry(OPTIONS) },
  { name: "slab", make: () => slabGeometry({ ...OPTIONS, height: 0.95 }) },
  { name: "stack", make: () => stackGeometry(STACK, { seed: SEEDS.rockShapes }) },
  {
    name: "arch",
    make: () =>
      archGeometry({
        seed: SEEDS.rockShapes,
        span: 4.2,
        legHeight: 3.2,
        legRadius: 0.7,
        beamRadius: 0.5,
        rise: 1.3,
      }),
  },
];

/**
 * Six times the signed volume the triangles enclose.
 *
 * The divergence theorem is the only outward test that works on an arch: a
 * "do the faces point away from the centroid" check fails a shape whose
 * centroid is in its *opening*, where the inner face of each leg is supposed to
 * look back at the middle. Inverted winding flips the sign of every term, so
 * the sum's sign is the answer whatever the topology.
 */
function signedVolume(geometry: BufferGeometry): number {
  const position = geometry.attributes.position!;
  const index = geometry.getIndex();
  expect(index).not.toBeNull();

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const cross = new Vector3();

  let total = 0;
  for (let i = 0; i < index!.count; i += 3) {
    a.fromBufferAttribute(position, index!.getX(i));
    b.fromBufferAttribute(position, index!.getX(i + 1));
    c.fromBufferAttribute(position, index!.getX(i + 2));
    total += cross.crossVectors(a, b).dot(c);
  }
  return total / 6;
}

describe("rock archetypes", () => {
  for (const shape of SHAPES) {
    describe(shape.name, () => {
      const geometry = shape.make();

      it("is wound outward, so it is stone and not a hole in the reef", () => {
        expect(signedVolume(geometry)).toBeGreaterThan(0.05);
      });

      it("carries the vertex colours the shared rock material reads", () => {
        // `createRockMaterial` sets `vertexColors: true` for the algae tint, and
        // a geometry without the attribute draws black rather than untinted.
        const color = geometry.getAttribute("color");
        expect(color).toBeDefined();
        expect(color.count).toBe(geometry.attributes.position!.count);
        expect(geometry.getAttribute("uv")).toBeDefined();
      });

      it("keeps its poles sealed and its foot under the sand", () => {
        const box = new Box3().setFromObject(new Mesh(geometry));
        // Buried, so no roughing can raise the base disc into view.
        expect(box.min.y).toBeLessThan(-0.15);
        expect(box.max.y).toBeGreaterThan(0.5);

        // Every vertex of a lathe's pole occupies one point. If the roughing
        // moved them apart there would be more than one distinct position up
        // there, which is a hole in the top of the rock.
        const position = geometry.attributes.position!;
        const crowns = new Set<string>();
        for (let i = 0; i < position.count; i++) {
          if (Math.hypot(position.getX(i), position.getZ(i)) < 1e-4) {
            crowns.add(`${position.getY(i).toFixed(5)}`);
          }
        }
        // The base disc's centre, plus a crown for anything closed at the top.
        expect(crowns.size).toBeLessThanOrEqual(3);
      });
    });
  }

  it("keeps a sea stack inside the blocks it was measured from", () => {
    // The pinnacles' colliders, contact shadows and composition are authored
    // against the old segment stack, so the re-profiled silhouette has to fit
    // within it — a stack that grew is a stack that can occlude a moray.
    const geometry = stackGeometry(STACK, { seed: SEEDS.rockShapes });
    const position = geometry.attributes.position!;
    const top = STACK.reduce((h, s) => Math.max(h, s.rise + s.radius * s.stretch), 0);

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      if (y < 0) {
        continue;
      }
      expect(y).toBeLessThanOrEqual(top + 0.01);

      const inside = STACK.some((segment) => {
        const halfHeight = segment.radius * segment.stretch;
        const dx = (x - segment.lean) / segment.radius;
        const dy = (y - segment.rise) / halfHeight;
        const dz = z / segment.radius;
        // A little slack for the roughing, which is what gives the skin its
        // tooth and is bounded by `amount`.
        return dx * dx + dy * dy + dz * dz <= 1.2;
      });
      expect(inside, `vertex (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) escaped`).toBe(
        true,
      );
    }
  });
});
