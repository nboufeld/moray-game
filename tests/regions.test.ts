import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { GATE_AZIMUTH, WEDGE_HALF } from "../src/world/Abyss";
import { CollisionField } from "../src/world/CollisionField";
import { seabedHeight } from "../src/world/Seabed";
import { applyRegionTerrain, regionMoodAt } from "../src/world/regions/RegionField";
import { REGIONS } from "../src/world/regions/RegionRegistry";
import {
  GATEWAY_WING_IDS,
  REGION_SLOTS,
  regionSlot,
  slotCenter,
} from "../src/world/regions/RegionSlots";
import { approachTongue, discWeight, slotDisc, tongueWeight } from "../src/world/regions/RegionShapes";
import { wingMood } from "../src/world/wings/WingGeometry";
import { WINGS, wingById } from "../src/world/wings/WingRegistry";

/**
 * R0's contracts: the streamed world may be kilometres wide, but the
 * bowl, the canyon and the wings keep their bits, the slots never
 * overlap, and every registered region stays inside its slot.
 */

describe("the world map", () => {
  it("keeps every pair of slots apart", () => {
    for (let i = 0; i < REGION_SLOTS.length; i++) {
      for (let j = i + 1; j < REGION_SLOTS.length; j++) {
        const a = REGION_SLOTS[i]!;
        const b = REGION_SLOTS[j]!;
        const ca = slotCenter(a);
        const cb = slotCenter(b);
        const gap = Math.hypot(ca.x - cb.x, ca.z - cb.z) - a.radius - b.radius;
        expect(gap, `${a.id} vs ${b.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("gives every gateway a real wing", () => {
    for (const id of GATEWAY_WING_IDS) {
      expect(() => wingById(id)).not.toThrow();
    }
    for (const slot of REGION_SLOTS) {
      expect(slot.radius).toBeGreaterThan(0);
      expect(slot.centerR - slot.radius, slot.id).toBeGreaterThanOrEqual(120);
    }
  });
});

describe("bit-identity where everything already is", () => {
  it("changes no terrain inside r = 46, in any direction", () => {
    for (let i = 0; i < 48; i++) {
      const theta = (i / 48) * Math.PI * 2;
      for (const r of [0, 12, 29, 38, 45.9]) {
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;
        const base = 0.987654321;
        expect(applyRegionTerrain(x, z, base), `at theta=${theta.toFixed(2)}, r=${r}`).toBe(base);
        expect(regionMoodAt(x, 2, z)).toBeNull();
      }
    }
  });

  it("changes nothing in the canyon's wedge out to its end", () => {
    for (const across of [-WEDGE_HALF, 0, WEDGE_HALF]) {
      for (const r of [31, 40, 49.5]) {
        const theta = GATE_AZIMUTH + across;
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;
        const base = -1.5;
        expect(applyRegionTerrain(x, z, base)).toBe(base);
      }
    }
  });
});

describe("the wings hand their moods over", () => {
  it("fades every wing's mood to exactly zero by r = 60", () => {
    for (const wing of WINGS) {
      const x48 = Math.cos(wing.azimuth) * 47;
      const z48 = Math.sin(wing.azimuth) * 47;
      // Below 48 the arithmetic is the shipped expression untouched.
      const inside = wingMood(wing, x48, 0.2, z48);
      expect(inside, `${wing.id} inside`).toBeGreaterThan(0);

      for (const r of [60, 80, 200]) {
        const x = Math.cos(wing.azimuth) * r;
        const z = Math.sin(wing.azimuth) * r;
        expect(wingMood(wing, x, 0.2, z), `${wing.id} at r=${r}`).toBe(0);
      }
    }
  });
});

describe("the shape helpers", () => {
  it("build weights that are exactly zero outside themselves", () => {
    const slot = regionSlot("verdant-line-1");
    const disc = slotDisc(slot);
    const tongue = approachTongue(slot);
    const center = slotCenter(slot);

    expect(discWeight(disc, center.x, center.z)).toBe(1);
    const outX = center.x + (slot.radius + 1) * Math.cos(0.3);
    const outZ = center.z + (slot.radius + 1) * Math.sin(0.3);
    expect(discWeight(disc, outX, outZ)).toBe(0);

    // On the spine, half way out: full weight; off the edge: exactly zero.
    const midR = (tongue.fromR + tongue.toR) / 2;
    const spineX = Math.cos(slot.azimuth) * midR;
    const spineZ = Math.sin(slot.azimuth) * midR;
    expect(tongueWeight(tongue, spineX, spineZ)).toBeGreaterThan(0.95);
    const wideX = spineX + Math.cos(slot.azimuth + Math.PI / 2) * 60;
    const wideZ = spineZ + Math.sin(slot.azimuth + Math.PI / 2) * 60;
    expect(tongueWeight(tongue, wideX, wideZ)).toBe(0);
    // Behind the wing's end and beyond the disc: zero.
    expect(tongueWeight(tongue, Math.cos(slot.azimuth) * 40, Math.sin(slot.azimuth) * 40)).toBe(0);
  });
});

describe("registered regions", () => {
  it("each stays inside its slot's reach and keeps its neighbours' ground", () => {
    for (const region of REGIONS) {
      const slot = regionSlot(region.slotId);
      const center = slotCenter(slot);
      // Weight must be zero at the far side of every OTHER slot's centre.
      for (const other of REGION_SLOTS) {
        if (other.id === region.slotId) {
          continue;
        }
        const oc = slotCenter(other);
        expect(region.weight(oc.x, oc.z), `${region.slotId} at ${other.id}`).toBe(0);
      }
      // And full somewhere in its own heart.
      expect(region.weight(center.x, center.z), region.slotId).toBeGreaterThan(0.9);
      // Deterministic terrain.
      const h1 = seabedHeight(center.x + 11, center.z - 7);
      expect(seabedHeight(center.x + 11, center.z - 7)).toBe(h1);
    }
  });
});

describe("dynamic collision volumes", () => {
  it("take priority over the box and clamp to their own floor and ceiling", () => {
    const field = new CollisionField([], {
      minX: -30,
      maxX: 30,
      minY: 0.6,
      maxY: 12,
      minZ: -30,
      maxZ: 30,
    });
    field.setDynamic(
      [
        {
          contains: (x) => x > 100,
          floor: () => -8,
          ceiling: () => 20,
          maxRadius: Number.POSITIVE_INFINITY,
        },
      ],
      [{ center: new Vector3(120, 0, 0), radius: 2 }],
    );

    // Far outside the box but inside the volume: the box clamp never runs.
    const deep = field.resolve(new Vector3(140, -30, 5), 0.6);
    expect(deep.x).toBe(140);
    expect(deep.y).toBeCloseTo(-7.4, 6);
    const high = field.resolve(new Vector3(140, 50, 5), 0.6);
    expect(high.y).toBeCloseTo(19.4, 6);

    // The dynamic collider pushes like any sphere.
    const pushed = field.resolve(new Vector3(120.5, 0, 0), 0.6);
    expect(Math.hypot(pushed.x - 120, pushed.y, pushed.z)).toBeGreaterThanOrEqual(2.6 - 1e-6);

    // Cleared, the box rules again.
    field.setDynamic([], []);
    const boxed = field.resolve(new Vector3(140, -30, 5), 0.6);
    expect(boxed.x).toBeLessThanOrEqual(30);
  });
});
