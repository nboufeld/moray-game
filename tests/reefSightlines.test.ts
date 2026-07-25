import { describe, expect, it } from "vitest";
import { Raycaster, Vector3 } from "three";
import { Reef } from "../src/world/Reef";
import { CollisionField } from "../src/world/CollisionField";

/**
 * Line of sight to every moray, checked the way the game checks it.
 *
 * A moray whose head cannot be seen cannot be discovered, and the reef's
 * scenery is placed by eye for the camera rather than by the creature it might
 * hide. This is the guard on that: it stands where a diver could actually
 * stand — inside the focus band, on the head's open side, outside every
 * collider — and raycasts against the same `obstructionMeshes` the game does.
 */

const PLAYER_RADIUS = 0.6;
/** Matches `DEFAULT_FOCUS_PARAMS`; focus is impossible outside this band. */
const MIN_DISTANCE = 1.2;
const MAX_DISTANCE = 14;

const reef = new Reef();
// Outside a renderer nothing walks the scene graph, and a mesh whose world
// matrix is still the identity raycasts as though it stood at the origin.
reef.group.updateMatrixWorld(true);
const collision = new CollisionField(reef.colliders, reef.bounds);
const raycaster = new Raycaster();

/** The same test `Game.isObstructed` runs, including its 0.6m head margin. */
function isObstructed(from: Vector3, target: Vector3): boolean {
  const direction = new Vector3().subVectors(target, from);
  const distance = direction.length();
  direction.multiplyScalar(1 / distance);
  raycaster.set(from, direction);
  raycaster.far = Math.max(0.05, distance - 0.6);
  return raycaster.intersectObjects(reef.obstructionMeshes, false).length > 0;
}

/** True where a diver could hold station: collision leaves the point alone. */
function reachable(point: Vector3): boolean {
  const resolved = collision.resolve(point.clone(), PLAYER_RADIUS);
  return resolved.distanceToSquared(point) < 1e-6;
}

describe("every moray can be seen from its open side", () => {
  for (const spot of reef.hidingSpots) {
    it(`${spot.speciesId} is visible across its approach`, () => {
      const forward = new Vector3(Math.sin(spot.facing), 0, Math.cos(spot.facing));
      const right = new Vector3(forward.z, 0, -forward.x);

      let reachableCount = 0;
      let clear = 0;

      for (const distance of [3, 5, 7, 9, 11, 13]) {
        for (const offset of [-0.6, -0.3, 0, 0.3, 0.6]) {
          for (const height of [1.6, 2.1, 2.8]) {
            const from = spot.position
              .clone()
              .addScaledVector(forward, distance)
              .addScaledVector(right, distance * offset)
              .setY(height);
            if (from.distanceTo(spot.position) > MAX_DISTANCE || !reachable(from)) {
              continue;
            }
            reachableCount++;
            if (!isObstructed(from, spot.position)) {
              clear++;
            }
          }
        }
      }

      expect(reachableCount).toBeGreaterThan(20);
      // Not every angle has to work — the crevice's own flanks are meant to
      // narrow the view — but the open side has to be broadly open.
      expect(clear / reachableCount).toBeGreaterThan(0.75);
    });
  }
});

it("the snowflake moray is visible from every point of the spawn swim line", () => {
  const spot = reef.hidingSpots.find((s) => s.speciesId === "snowflake-moray");
  expect(spot).toBeDefined();
  const head = spot!.position;

  // The diver spawns at (0, 2, 22) and the e2e swim holds W, so this line is
  // exactly what the discovery test flies down.
  for (let z = 22; z >= head.z + MIN_DISTANCE; z -= 0.5) {
    const from = new Vector3(0, 2, z);
    expect(reachable(from), `blocked by a collider at z=${z}`).toBe(true);
    if (from.distanceTo(head) > MAX_DISTANCE) {
      continue;
    }
    expect(isObstructed(from, head), `line of sight obstructed at z=${z}`).toBe(false);
  }
});
