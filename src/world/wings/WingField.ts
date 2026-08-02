import { Vector3, type PlaneGeometry } from "three";
import type { BoundsAnnex, SphereCollider } from "../CollisionField";
import type { WingDef, WingMoodTables } from "./WingTypes";
import {
  WING_AIRSPACE_FROM,
  insideWingAirspace,
  wedgeHalfAt,
  wingBlend,
  wingCeiling,
  wingMaxRadius,
  wingMood,
  wingTarget,
} from "./WingGeometry";
import { WINGS } from "./WingRegistry";

/**
 * The registry-bound half of the wing machinery: everything the shared
 * systems (`Seabed`, `UnderwaterFog`, `Lighting`, `Reef`, `CollisionField`)
 * consume is exported from here, so those files each take exactly one new
 * import and no wing owner ever edits them.
 */

/** Inside this radius no wing owns anything; the fast path out of the loop. */
const WING_CARVE_MIN = Math.min(...WINGS.map((wing) => wing.carve.carveFrom));

/**
 * Applies every wing's carve to a height the bowl (and canyon) already
 * agreed on. Exactly `base` inside {@link WING_CARVE_MIN} and outside every
 * wedge — the same structural bit-identity the canyon carve keeps.
 */
export function applyWingCarves(x: number, z: number, base: number): number {
  if (Math.hypot(x, z) <= WING_CARVE_MIN) {
    return base;
  }
  let height = base;
  for (const wing of WINGS) {
    const blend = wingBlend(wing, x, z);
    if (blend !== 0) {
      height += blend * (wingTarget(wing, x, z) - height);
    }
  }
  return height;
}

export interface PlaceMood {
  readonly mood: number;
  readonly tables: WingMoodTables;
}

const MOOD_SCRATCH: { mood: number; tables: WingMoodTables } = {
  mood: 0,
  tables: WINGS[0]!.mood,
};

/**
 * The dominant wing mood at a point, or null where every wing is exactly
 * zero — which is everywhere the bowl is playable, everywhere the canyon's
 * wedge is, and every azimuth between wings. The fog and lighting hooks call
 * this only after `abyssMood` returned zero, so time and place stay two
 * channels over one quantity with a single writer each.
 *
 * Returns a reused scratch object: per-frame, per-scene — do not retain.
 */
export function wingMoodAt(x: number, y: number, z: number): PlaceMood | null {
  if (Math.hypot(x, z) <= 30) {
    return null;
  }
  let best = 0;
  let bestWing: WingDef | null = null;
  for (const wing of WINGS) {
    const mood = wingMood(wing, x, y, z);
    if (mood > best) {
      best = mood;
      bestWing = wing;
    }
  }
  if (bestWing === null) {
    return null;
  }
  MOOD_SCRATCH.mood = best;
  MOOD_SCRATCH.tables = bestWing.mood;
  return MOOD_SCRATCH;
}

/**
 * One airspace annex per wing, for `ReefBounds.annexes`. The floor rides the
 * carved ground through the `floorAt` the reef passes in (`seabedHeight`) —
 * passed rather than imported, because `Seabed` imports this module for the
 * carves and a cycle around the world's one height function helps nobody.
 */
export function wingAnnexes(floorAt: (x: number, z: number) => number): readonly BoundsAnnex[] {
  return WINGS.map((wing) => ({
    contains: (x: number, z: number) => insideWingAirspace(wing, x, z),
    floor: (x: number, z: number) => floorAt(x, z) + wing.floorClearance,
    ceiling: (x: number, z: number) => wingCeiling(wing, x, z),
    maxRadius: wingMaxRadius(wing),
  }));
}

/**
 * The wall spheres that keep a diver inside a wing's wedge — the canyon's
 * `buildCanyonColliders` pattern, derived per wing from its own envelope.
 * Rows at four radial stations along both wedge edges, stacked from the
 * floor to just over the ceiling so the crack between two wings cannot be
 * flown over inside the swim volume, plus an end pair where the carve fades.
 */
export function wingWallColliders(
  openEnded: ReadonlySet<string> = new Set(),
): readonly SphereCollider[] {
  const colliders: SphereCollider[] = [];
  for (const wing of WINGS) {
    const perpX = -Math.sin(wing.azimuth);
    const perpZ = Math.cos(wing.azimuth);
    const axisX = Math.cos(wing.azimuth);
    const axisZ = Math.sin(wing.azimuth);

    for (const r of [35.5, 39, 42.5, 46]) {
      const across = wedgeHalfAt(wing, r) + 0.01;
      for (const side of [-1, 1]) {
        const lateral = side * Math.sin(across) * r;
        const along = Math.cos(across) * r;
        const x = axisX * along + perpX * lateral;
        const z = axisZ * along + perpZ * lateral;
        const floor = wing.carve.floorDepth;
        const ceiling = wing.ceilingInside;
        for (let y = floor + 1; y < ceiling; y += 4.5) {
          colliders.push({ center: new Vector3(x, y, z), radius: 3.0 });
        }
        colliders.push({ center: new Vector3(x, ceiling + 1, z), radius: 3.0 });
      }
    }

    // The end wall, where the carve eases back up under the wing's own
    // curtains/backdrop dressing. The annex's radial cap stands behind it.
    // R0: a gateway wing keeps no end wall — its far end opens into a
    // province's approach vale, and the region's own bounds take over.
    if (openEnded.has(wing.id)) {
      continue;
    }
    const endR = wing.carve.carveEnd - 2;
    for (const side of [-1, 1]) {
      const x = axisX * endR + perpX * side * 2.2;
      const z = axisZ * endR + perpZ * side * 2.2;
      for (const y of [wing.carve.floorDepth + 1, wing.carve.floorDepth + 5]) {
        colliders.push({ center: new Vector3(x, y, z), radius: 3.5 });
      }
    }
  }
  return colliders;
}

/** Every wing gate's azimuth, for the rim ring's doorway logic. */
export function wingGateAzimuths(): readonly number[] {
  return WINGS.map((wing) => wing.azimuth % (Math.PI * 2));
}

/**
 * Multiplies every wing's authored wall paint into the seabed's baked vertex
 * colours — `bakeCanyonStrata`'s contract, generalised: wherever every
 * wing's `paint` returns null (or the wing has none), the loop writes
 * nothing at all, so the bowl's and the canyon's bakes keep their bytes.
 */
export function bakeWingPaint(geometry: PlaneGeometry): void {
  const painted = WINGS.filter((wing) => wing.paint !== undefined);
  if (painted.length === 0) {
    return;
  }
  const position = geometry.attributes.position;
  const color = geometry.attributes.color;
  if (!position || !color) {
    return;
  }

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    if (Math.hypot(x, z) <= WING_CARVE_MIN) {
      continue;
    }
    for (const wing of painted) {
      const blend = wingBlend(wing, x, z);
      if (blend === 0) {
        continue;
      }
      const paint = wing.paint!(x, z, position.getY(i), blend);
      if (!paint) {
        continue;
      }
      color.setXYZ(
        i,
        color.getX(i) * paint[0],
        color.getY(i) * paint[1],
        color.getZ(i) * paint[2],
      );
    }
  }
  color.needsUpdate = true;
}

export { WING_AIRSPACE_FROM };
