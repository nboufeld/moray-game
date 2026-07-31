import { InstancedMesh, Points } from "three";
import { describe, expect, it } from "vitest";
import { seabedHeight } from "../src/world/Seabed";
import { angleBetween, wedgeHalfAt, wingBlend } from "../src/world/wings/WingGeometry";
import type { WingFlora } from "../src/world/wings/WingTypes";
import { CURRENT_RUN } from "../src/world/wings/defs/CurrentRun";
import { GHOST_REEF } from "../src/world/wings/defs/GhostReef";
import { GLASS_COVE } from "../src/world/wings/defs/GlassCove";
import { buildCurrentRunFlora } from "../src/world/wings/flora/CurrentRunFlora";
import { buildGhostReefFlora } from "../src/world/wings/flora/GhostReefFlora";
import { buildGlassCoveFlora } from "../src/world/wings/flora/GlassCoveFlora";
import { lateralOf, wingFrame } from "../src/world/wings/flora/W3FloraKit";

/**
 * Worker W3's wing flora — the Sea-Glass Cove, the Ghost Reef and the
 * Current Run — held to the wave's own contracts: determinism off the
 * registered seeds, confinement to the frozen wedges, the corridor
 * clearances the dens' approaches swim through, and the per-wing budgets
 * (≤ 10 draws, ≤ 30 000 triangles). The Ghost Reef also answers for its
 * story: the bleaching is spatial, white at the gate, colour past r 42.
 */

const W3_WINGS = [
  { def: GLASS_COVE, build: buildGlassCoveFlora },
  { def: GHOST_REEF, build: buildGhostReefFlora },
  { def: CURRENT_RUN, build: buildCurrentRunFlora },
] as const;

const MAX_DRAWS = 10;
const MAX_TRIANGLES = 30_000;

interface Mark {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly mesh: string;
  readonly floorBound: string;
}

/** Every placed thing in a wing's flora: instance origins, and point sprites. */
function marksOf(flora: WingFlora): Mark[] {
  const marks: Mark[] = [];
  for (const child of flora.group.children) {
    if (child instanceof InstancedMesh) {
      const array = child.instanceMatrix.array;
      for (let i = 0; i < child.count; i++) {
        marks.push({
          x: array[i * 16 + 12]!,
          y: array[i * 16 + 13]!,
          z: array[i * 16 + 14]!,
          mesh: child.name,
          floorBound: String(child.userData.floorBound ?? "no"),
        });
      }
    } else if (child instanceof Points) {
      const position = child.geometry.attributes.position;
      if (!position) {
        continue;
      }
      for (let i = 0; i < position.count; i++) {
        marks.push({
          x: position.getX(i),
          y: position.getY(i),
          z: position.getZ(i),
          mesh: child.name,
          floorBound: "no",
        });
      }
    }
  }
  return marks;
}

/** The build's full state as data, for the determinism comparison. */
function serialized(flora: WingFlora): unknown {
  return flora.group.children.map((child) => {
    if (child instanceof InstancedMesh) {
      return {
        name: child.name,
        matrices: Array.from(child.instanceMatrix.array),
        colors: Array.from(child.instanceColor?.array ?? []),
      };
    }
    if (child instanceof Points) {
      return {
        name: child.name,
        positions: Array.from(child.geometry.attributes.position?.array ?? []),
        colors: Array.from(child.geometry.attributes.color?.array ?? []),
      };
    }
    return { name: child.name };
  });
}

/** Rendered triangles across the wing's instanced meshes (points cost none). */
function trianglesOf(flora: WingFlora): number {
  let total = 0;
  for (const child of flora.group.children) {
    if (child instanceof InstancedMesh) {
      const geometry = child.geometry;
      const per = geometry.index
        ? geometry.index.count / 3
        : (geometry.attributes.position?.count ?? 0) / 3;
      total += per * child.count;
    }
  }
  return total;
}

for (const { def, build } of W3_WINGS) {
  describe(def.id, () => {
    it("builds bit-identically twice off its registered seed", () => {
      expect(serialized(build(def))).toEqual(serialized(build(def)));
    });

    it("keeps every mark inside the wing's envelope and wedge", () => {
      const flora = build(def);
      for (const mark of marksOf(flora)) {
        const r = Math.hypot(mark.x, mark.z);
        expect(r, `${mark.mesh} radius`).toBeGreaterThan(29.5);
        expect(r, `${mark.mesh} radius`).toBeLessThanOrEqual(51);
        const away = angleBetween(Math.atan2(mark.z, mark.x), def.azimuth);
        expect(away, `${mark.mesh} at r=${r.toFixed(1)}`).toBeLessThan(wedgeHalfAt(def, r) + 1e-6);
      }
    });

    it("holds its floor pieces above blend one half in the live band", () => {
      const flora = build(def);
      for (const mark of marksOf(flora)) {
        if (mark.floorBound === "no") {
          continue;
        }
        const r = Math.hypot(mark.x, mark.z);
        if (r < 34 || r > 46) {
          // Gate dressing is scenery-only and answers the wedge test instead.
          continue;
        }
        expect(wingBlend(def, mark.x, mark.z), `${mark.mesh} at r=${r.toFixed(1)}`).toBeGreaterThan(
          0.5,
        );
      }
    });

    it("stands its floor pieces on the seabed", () => {
      const flora = build(def);
      for (const mark of marksOf(flora)) {
        const ground = seabedHeight(mark.x, mark.z);
        if (mark.floorBound === "foot") {
          expect(Math.abs(mark.y - ground), `${mark.mesh} foot`).toBeLessThan(0.26);
        } else if (mark.floorBound === "rest") {
          // Centre-origin pieces (boulders, branch fingers, channel stones):
          // nestled, never floating, never buried whole.
          expect(mark.y - ground, `${mark.mesh} rest`).toBeGreaterThan(0.05);
          expect(mark.y - ground, `${mark.mesh} rest`).toBeLessThan(1.4);
        }
      }
    });

    it("stays within the draw and triangle budgets", () => {
      const flora = build(def);
      expect(flora.group.children.length, "draw calls").toBeLessThanOrEqual(MAX_DRAWS);
      expect(trianglesOf(flora), "triangles").toBeLessThanOrEqual(MAX_TRIANGLES);
    });

    it("contacts nothing it did not place on the ground", () => {
      const flora = build(def);
      for (const contact of flora.contacts ?? []) {
        const r = Math.hypot(contact.x, contact.z);
        expect(r, "contact radius").toBeGreaterThan(29.5);
        expect(r, "contact radius").toBeLessThanOrEqual(51);
        expect(contact.strength).toBeGreaterThan(0);
        expect(contact.strength).toBeLessThanOrEqual(0.5);
      }
    });
  });
}

describe("the Sea-Glass Cove's corridor", () => {
  it("keeps the 3 m clearing and the 0.06 rad approach open through r 30–46", () => {
    const frame = wingFrame(GLASS_COVE);
    const flora = buildGlassCoveFlora(GLASS_COVE);
    const marks = marksOf(flora);
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      const r = Math.hypot(mark.x, mark.z);
      if (r < 30 || r > 46) {
        continue;
      }
      const lateral = Math.abs(lateralOf(frame, mark.x, mark.z));
      expect(lateral, `${mark.mesh} at r=${r.toFixed(1)}`).toBeGreaterThanOrEqual(3.0 - 1e-9);
      const away = angleBetween(Math.atan2(mark.z, mark.x), GLASS_COVE.azimuth);
      expect(away, `${mark.mesh} at r=${r.toFixed(1)}`).toBeGreaterThan(0.06);
    }
  });

  it("banks its grand drift around the hatchling's den, not through it", () => {
    const frame = wingFrame(GLASS_COVE);
    const marks = marksOf(buildGlassCoveFlora(GLASS_COVE)).filter(
      (mark) => mark.mesh === "w3-glass-drift-dodeca" || mark.mesh === "w3-glass-drift-sphere",
    );
    const den = marks.filter((mark) => {
      const r = Math.hypot(mark.x, mark.z);
      return r >= 38 && r <= 42;
    });
    // The prettiest drift is present where the brief banks it…
    expect(den.length).toBeGreaterThan(60);
    // …and every pebble of it stands off the axis.
    for (const mark of den) {
      expect(Math.abs(lateralOf(frame, mark.x, mark.z))).toBeGreaterThanOrEqual(3.0 - 1e-9);
    }
  });
});

describe("the Ghost Reef's corridor", () => {
  it("keeps every stand at least 0.06 rad off the axis through r 30–46", () => {
    const flora = buildGhostReefFlora(GHOST_REEF);
    const marks = marksOf(flora);
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      const r = Math.hypot(mark.x, mark.z);
      if (r < 30 || r > 46) {
        continue;
      }
      const away = angleBetween(Math.atan2(mark.z, mark.x), GHOST_REEF.azimuth);
      expect(away, `${mark.mesh} at r=${r.toFixed(1)}`).toBeGreaterThan(0.06);
    }
  });
});

describe("the Ghost Reef's recovery", () => {
  it("is bone near the gate and coloured toward the far end", () => {
    const flora = buildGhostReefFlora(GHOST_REEF);
    // The spread between an instance tint's strongest and weakest channel:
    // near-zero on a bone, clearly positive on a pastel.
    const spreads: { r: number; spread: number }[] = [];
    for (const child of flora.group.children) {
      if (!(child instanceof InstancedMesh) || !child.instanceColor) {
        continue;
      }
      const matrices = child.instanceMatrix.array;
      const colors = child.instanceColor.array;
      for (let i = 0; i < child.count; i++) {
        const r = Math.hypot(matrices[i * 16 + 12]!, matrices[i * 16 + 14]!);
        const red = colors[i * 3]!;
        const green = colors[i * 3 + 1]!;
        const blue = colors[i * 3 + 2]!;
        spreads.push({ r, spread: Math.max(red, green, blue) - Math.min(red, green, blue) });
      }
    }
    const near = spreads.filter((entry) => entry.r <= 40);
    // Connective-2 (MASTER R6): the recovery no longer peaks AT the door —
    // past r ≈ 45.6 the false-spring cooling deliberately takes the colour
    // back down so the wing hands the Bone Meadows' seam a dying trace
    // (asserted in tests/wingsConnective2.test.ts). Colour is unmistakable
    // where the design now puts its peak: the band just shy of the seam.
    const far = spreads.filter((entry) => entry.r >= 44.9 && entry.r <= 45.6);
    expect(near.length).toBeGreaterThan(10);
    expect(far.length).toBeGreaterThanOrEqual(6);
    const mean = (entries: readonly { spread: number }[]): number =>
      entries.reduce((sum, entry) => sum + entry.spread, 0) / entries.length;
    // Instance colours land in linear working space, where the warm bone's
    // spread measures 0.155 at full value lift; 0.17 is bone, not pastel.
    expect(mean(near), "the gate stays bone").toBeLessThan(0.17);
    expect(mean(far), "the far end recovers").toBeGreaterThan(mean(near) * 3);
  });
});

describe("the Current Run's channel", () => {
  it("keeps the centre open for the ride", () => {
    const frame = wingFrame(CURRENT_RUN);
    const marks = marksOf(buildCurrentRunFlora(CURRENT_RUN)).filter(
      (mark) => mark.floorBound !== "no",
    );
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      expect(Math.abs(lateralOf(frame, mark.x, mark.z)), mark.mesh).toBeGreaterThanOrEqual(
        1.9 - 1e-9,
      );
    }
  });
});
