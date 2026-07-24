import { Vector3 } from "three";

export interface SphereCollider {
  readonly center: Vector3;
  readonly radius: number;
}

export interface ReefBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Extremely simple collision against a set of spheres plus reef bounds.
 * The diver is treated as a sphere; on penetration it is pushed back out
 * along the surface normal. Pure math for unit testing.
 */
export class CollisionField {
  constructor(
    private readonly colliders: readonly SphereCollider[],
    private readonly bounds: ReefBounds,
  ) {}

  /** Resolves the position in place and returns it for convenience. */
  resolve(position: Vector3, radius: number): Vector3 {
    const push = new Vector3();
    for (const collider of this.colliders) {
      push.subVectors(position, collider.center);
      const minDistance = collider.radius + radius;
      const distance = push.length();
      if (distance < minDistance && distance > 1e-5) {
        push.multiplyScalar((minDistance - distance) / distance);
        position.add(push);
      } else if (distance <= 1e-5) {
        position.y += minDistance;
      }
    }

    position.x = clamp(position.x, this.bounds.minX + radius, this.bounds.maxX - radius);
    position.y = clamp(position.y, this.bounds.minY + radius, this.bounds.maxY - radius);
    position.z = clamp(position.z, this.bounds.minZ + radius, this.bounds.maxZ - radius);
    return position;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
