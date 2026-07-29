import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { GATE_AZIMUTH, WEDGE_HALF, abyssMood } from "../src/world/Abyss";
import { CollisionField } from "../src/world/CollisionField";
import { seabedHeight } from "../src/world/Seabed";
import {
  applyWingCarves,
  wingAnnexes,
  wingMoodAt,
  wingWallColliders,
} from "../src/world/wings/WingField";
import {
  angleBetween,
  wedgeHalfAt,
  wingBlend,
  wingCeiling,
  wingMood,
} from "../src/world/wings/WingGeometry";
import { WINGS } from "../src/world/wings/WingRegistry";

/**
 * The wave-8 wing framework's own contracts, in the style every biome
 * before it answered to: bit-identity where the bowl and the canyon are,
 * confinement to the authored wedges, and determinism.
 */

const norm = (azimuth: number): number => ((azimuth % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

describe("the wings' azimuth slots", () => {
  it("never overlap one another", () => {
    for (let i = 0; i < WINGS.length; i++) {
      for (let j = i + 1; j < WINGS.length; j++) {
        const a = WINGS[i]!;
        const b = WINGS[j]!;
        const gap = angleBetween(norm(a.azimuth), norm(b.azimuth));
        expect(gap, `${a.id} vs ${b.id}`).toBeGreaterThan(a.wedge.endHalf + b.wedge.endHalf);
      }
    }
  });

  it("all stand clear of the canyon's wedge", () => {
    for (const wing of WINGS) {
      const gap = angleBetween(norm(wing.azimuth), GATE_AZIMUTH);
      expect(gap, wing.id).toBeGreaterThan(wing.wedge.endHalf + WEDGE_HALF);
    }
  });
});

describe("bit-identity where the bowl is", () => {
  it("carves exactly nothing inside the carve radius, moods nothing inside r = 30", () => {
    // 29.5 is where every carve begins — the canyon's own number. The
    // sliver between 29.5 and the box's corner belongs to the wedges, as it
    // always has at the canyon's azimuth.
    for (let x = -30; x <= 30; x += 3) {
      for (let z = -30; z <= 30; z += 3) {
        const r = Math.hypot(x, z);
        if (r <= 29.5) {
          const base = 0.123456789;
          expect(applyWingCarves(x, z, base), `at (${x}, ${z})`).toBe(base);
        }
        if (r <= 30) {
          expect(wingMoodAt(x, 2, z), `mood at (${x}, ${z})`).toBeNull();
        }
      }
    }
  });

  it("carves and moods exactly nothing anywhere in the canyon's wedge", () => {
    for (const across of [-WEDGE_HALF, -WEDGE_HALF / 2, 0, WEDGE_HALF / 2, WEDGE_HALF]) {
      for (const r of [31, 36, 42, 48]) {
        const theta = GATE_AZIMUTH + across;
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        const base = -0.42;
        expect(applyWingCarves(x, z, base), `carve at r=${r}`).toBe(base);
        expect(wingMoodAt(x, 0.2, z), `mood at r=${r}`).toBeNull();
      }
    }
  });

  it("returns zero blend just past every wedge's angular edge", () => {
    for (const wing of WINGS) {
      for (const r of [31, 36, 42, 48]) {
        const half = wedgeHalfAt(wing, r);
        for (const side of [-1, 1]) {
          const theta = wing.azimuth + side * (half + 0.002);
          const x = r * Math.cos(theta);
          const z = r * Math.sin(theta);
          expect(wingBlend(wing, x, z), `${wing.id} at r=${r}`).toBe(0);
        }
      }
      for (const r of [29.4, 50.1, 55]) {
        const x = r * Math.cos(wing.azimuth);
        const z = r * Math.sin(wing.azimuth);
        expect(wingBlend(wing, x, z), `${wing.id} on-axis r=${r}`).toBe(0);
      }
    }
  });
});

describe("each wing's carve", () => {
  it("lands the floor the definition authored, deterministically", () => {
    for (const wing of WINGS) {
      const r = Math.min(wing.carve.shelfTo + 0.5, 45);
      const x = r * Math.cos(wing.azimuth);
      const z = r * Math.sin(wing.azimuth);
      const height = seabedHeight(x, z);
      // Full carve on the floor band: the ground is the authored floor to
      // within the wing's own detail plus the shelf's last easing.
      expect(Math.abs(height - wing.carve.floorDepth), `${wing.id} floor`).toBeLessThan(1.6);
      expect(seabedHeight(x, z), `${wing.id} determinism`).toBe(height);
    }
  });

  it("descends (or climbs) monotonically enough to swim", () => {
    for (const wing of WINGS) {
      const sign = wing.carve.floorDepth < wing.carve.sillDepth ? 1 : -1;
      let last = seabedHeight(
        34 * Math.cos(wing.azimuth),
        34 * Math.sin(wing.azimuth),
      );
      for (let r = 35; r <= Math.min(wing.carve.shelfTo, 45); r += 1) {
        const height = seabedHeight(r * Math.cos(wing.azimuth), r * Math.sin(wing.azimuth));
        expect(sign * height, `${wing.id} shelf at r=${r}`).toBeLessThan(sign * last + 0.6);
        last = height;
      }
    }
  });
});

describe("each wing's mood", () => {
  it("is on in the wing's heart, off for the abyss, and dominant for itself", () => {
    for (const wing of WINGS) {
      const r = 42;
      const x = r * Math.cos(wing.azimuth);
      const z = r * Math.sin(wing.azimuth);
      const y = Math.max(wing.carve.floorDepth + 1.5, 0.2);
      expect(abyssMood(x, y, z), `${wing.id} abyss`).toBe(0);
      const place = wingMoodAt(x, y, z);
      expect(place, `${wing.id} mood`).not.toBeNull();
      expect(place!.mood).toBeGreaterThan(0);
      expect(place!.mood).toBeLessThanOrEqual(1);
      expect(place!.tables).toBe(wing.mood);
    }
  });

  it("is exactly zero above every wing's surface", () => {
    for (const wing of WINGS) {
      const x = 42 * Math.cos(wing.azimuth);
      const z = 42 * Math.sin(wing.azimuth);
      expect(wingMood(wing, x, wing.moodSurface, z), wing.id).toBe(0);
      expect(wingMood(wing, x, wing.moodSurface + 3, z), wing.id).toBe(0);
    }
  });
});

describe("the wings' airspace", () => {
  it("is claimed by exactly one annex in each wing's heart", () => {
    const annexes = wingAnnexes(seabedHeight);
    for (const wing of WINGS) {
      const x = 40 * Math.cos(wing.azimuth);
      const z = 40 * Math.sin(wing.azimuth);
      const owners = annexes.filter((annex) => annex.contains(x, z));
      expect(owners.length, wing.id).toBe(1);
    }
  });

  it("keeps the diver between each wing's floor and ceiling", () => {
    const annexes = wingAnnexes(seabedHeight);
    const field = new CollisionField([], {
      minX: -30,
      maxX: 30,
      minY: 0.6,
      maxY: 12,
      minZ: -30,
      maxZ: 30,
      annexes,
    });
    for (const wing of WINGS) {
      const x = 40 * Math.cos(wing.azimuth);
      const z = 40 * Math.sin(wing.azimuth);
      const floor = seabedHeight(x, z) + wing.floorClearance;
      const ceiling = wingCeiling(wing, x, z);

      const low = field.resolve(new Vector3(x, floor - 3, z), 0.6);
      expect(low.y, `${wing.id} floor`).toBeGreaterThanOrEqual(floor + 0.6 - 1e-9);

      const high = field.resolve(new Vector3(x, ceiling + 3, z), 0.6);
      expect(high.y, `${wing.id} ceiling`).toBeLessThanOrEqual(ceiling - 0.6 + 1e-9);
    }
  });

  it("builds wall colliders that stay out of the bowl and the floor bands", () => {
    for (const collider of wingWallColliders()) {
      const r = Math.hypot(collider.center.x, collider.center.z);
      expect(r - collider.radius).toBeGreaterThan(30);
      // No wall sphere may intrude on its own wing's floor-band corridor.
      const theta = Math.atan2(collider.center.z, collider.center.x);
      for (const wing of WINGS) {
        if (angleBetween(theta, norm(wing.azimuth)) < 0.001) {
          throw new Error(`wall sphere sits on ${wing.id}'s axis`);
        }
      }
    }
  });
});
