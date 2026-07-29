import { Vector3 } from "three";

export interface SphereCollider {
  readonly center: Vector3;
  readonly radius: number;
}

/**
 * A volume the diver may occupy *outside* the box (W-M3: the canyon past the
 * rim). While the diver is inside it, the box clamp is replaced by the
 * annex's own positional floor and ceiling plus a radial cap from the world
 * origin — a wedge is not something an axis-aligned box can say. The annex's
 * side containment is the collider walls the reef builds along the wedge;
 * the predicate is deliberately a little wider than those walls, so the body
 * is turned by a sphere before the zone ever changes hands.
 */
export interface BoundsAnnex {
  /** True where the annex owns the point, in plan. */
  contains(x: number, z: number): boolean;
  /** World-space lower y bound at a point; replaces the box's `minY`. */
  floor(x: number, z: number): number;
  /** World-space upper y bound at a point; replaces the box's `maxY`. */
  ceiling(x: number, z: number): number;
  /** Hard radial cap from the world origin, in metres. */
  readonly maxRadius: number;
}

export interface ReefBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
  /** Optional volume beyond the box; absent, behaviour is exactly the box. */
  readonly annex?: BoundsAnnex;
  /**
   * Wave 8: the wings' annexes, one per wedge. Checked after `annex` — the
   * canyon's and the wings' predicates are azimuthally disjoint by
   * construction, so at most one volume ever owns a point.
   */
  readonly annexes?: readonly BoundsAnnex[];
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

    const annex = this.bounds.annex;
    if (annex?.contains(position.x, position.z)) {
      return this.resolveInAnnex(position, radius, annex);
    }
    if (this.bounds.annexes) {
      for (const wing of this.bounds.annexes) {
        if (wing.contains(position.x, position.z)) {
          return this.resolveInAnnex(position, radius, wing);
        }
      }
    }

    position.x = clamp(position.x, this.bounds.minX + radius, this.bounds.maxX - radius);
    position.y = clamp(position.y, this.bounds.minY + radius, this.bounds.maxY - radius);
    position.z = clamp(position.z, this.bounds.minZ + radius, this.bounds.maxZ - radius);
    return position;
  }

  private resolveInAnnex(position: Vector3, radius: number, annex: BoundsAnnex): Vector3 {
    const r = Math.hypot(position.x, position.z);
    const maxR = annex.maxRadius - radius;
    if (r > maxR && r > 1e-6) {
      const scale = maxR / r;
      position.x *= scale;
      position.z *= scale;
    }
    position.y = clamp(
      position.y,
      annex.floor(position.x, position.z) + radius,
      annex.ceiling(position.x, position.z) - radius,
    );
    return position;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
