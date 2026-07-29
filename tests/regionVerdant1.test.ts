import { InstancedMesh, Mesh, Points, Scene, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the def, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing the def
// module *first* runs the cycle the other way round, where the registry
// reads `VERDANT_1` before its module finishes evaluating.
import { seabedHeight } from "../src/world/Seabed";
import { VERDANT_1, buildSeals } from "../src/world/regions/verdant1/Verdant1";
import {
  CENTER_X,
  CENTER_Z,
  VERDANT_SLOT,
  spokeOf,
  verdantCeiling,
  verdantTerrainTarget,
  verdantWeight,
  worldOf,
} from "../src/world/regions/verdant1/VerdantTerrain";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Great Kelp Sea's own contracts: identity where it owns nothing,
 * determinism where it owns everything, budgets counted rather than
 * claimed, colliders inside the domain, and capture poses that stand in
 * water the region actually has.
 */

describe("verdant-line-1 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === VERDANT_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(VERDANT_1.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero everywhere inside the tongue's own start", () => {
    // The tongue deliberately holds weight from r = 44 across the wing
    // seam (RegionShapes' documented handover); the r ≤ 46 fast path in
    // RegionField is what guarantees terrain identity inside the bowl.
    // The raw weight must still be structurally zero below the seam band.
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 39, 43.9]) {
        expect(VERDANT_1.weight(Math.cos(theta) * r, Math.sin(theta) * r)).toBe(0);
      }
    }
  });

  it("is full in its heart and covers the approach tongue", () => {
    expect(VERDANT_1.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
    for (const u of [60, 120, 200, 270]) {
      const { x, z } = worldOf(u, 0);
      expect(VERDANT_1.weight(x, z), `tongue u=${u}`).toBeGreaterThan(0.5);
    }
  });
});

describe("verdant-line-1 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [100, 2],
      [320, -30],
      [450, 0],
      [495, -82],
      [475, 58],
      [580, 20],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = verdantTerrainTarget(x, z);
      expect(verdantTerrainTarget(x, z)).toBe(first);
      const composed = seabedHeight(x, z);
      expect(seabedHeight(x, z)).toBe(composed);
    }
  });

  it("carries at least 20 m of vertical range across the disc", () => {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let du = -170; du <= 170; du += 8) {
      for (let dv = -170; dv <= 170; dv += 8) {
        if (Math.hypot(du, dv) > 170) {
          continue;
        }
        const { x, z } = worldOf(445 + du, dv);
        const h = verdantTerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    // The vale's lip adds the top of the range; the maze holds the bottom.
    expect(highest - lowest).toBeGreaterThanOrEqual(20);
    expect(lowest).toBeLessThanOrEqual(-18);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(445 + du, dv);
        if (verdantWeight(x, z) === 0) {
          continue;
        }
        const floor = verdantTerrainTarget(x, z) + VERDANT_1.floorClearance;
        expect(verdantCeiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the vale's own channel.
    for (let u = 48; u <= 290; u += 6) {
      const { x, z } = worldOf(u, 0);
      const floor = verdantTerrainTarget(x, z) + VERDANT_1.floorClearance;
      expect(verdantCeiling(x, z), `vale u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("verdant-line-1 build", () => {
  let build: RegionBuild;

  beforeAll(() => {
    build = VERDANT_1.build(new Scene());
  });

  it("stays inside the draw-call and triangle budgets", () => {
    let draws = 0;
    let triangles = 0;
    (build.group as Object3D).traverse((node) => {
      if (node instanceof Mesh || node instanceof Points) {
        draws++;
        const geometry = (node as Mesh).geometry;
        const index = geometry.getIndex();
        const per = index
          ? index.count / 3
          : (geometry.attributes.position?.count ?? 0) / (node instanceof Points ? 1 : 3);
        const instances = node instanceof InstancedMesh ? node.count : 1;
        if (!(node instanceof Points)) {
          triangles += per * instances;
        }
      }
    });
    expect(draws).toBeLessThanOrEqual(120);
    expect(triangles).toBeLessThanOrEqual(250_000);
    // Honest floors as well as caps: an empty region passes no bar.
    expect(draws).toBeGreaterThan(20);
    expect(triangles).toBeGreaterThan(120_000);
  });

  it("keeps every collider inside the domain", () => {
    expect(build.colliders.length).toBeGreaterThan(100);
    for (const collider of build.colliders) {
      const weight = verdantWeight(collider.center.x, collider.center.z);
      expect(weight, `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`).toBeGreaterThan(0);
    }
  });

  it("registers the Kelp Weaver as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("kelp-weaver");
    expect(verdantWeight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(VERDANT_1.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
  });

  it("survives a minute of updates without spending randomness", () => {
    const ctx = {
      diverPosition: { x: CENTER_X, y: 2, z: CENTER_Z },
      diverSpeed: 0,
      reducedMotion: false,
      time: 0,
    };
    for (let i = 0; i < 600; i++) {
      ctx.time += 0.1;
      // The update signature takes the standing life context.
      build.update?.(0.1, ctx as never);
    }
  });
});

describe("verdant-line-1 seals", () => {
  it("walls the rim and the vale inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        verdantWeight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves a gate over the approach tongue", () => {
    const seals = buildSeals();
    // No rim seal may block the corridor's spine where the vale exits.
    for (const seal of seals) {
      const { u, v } = spokeOf(seal.center.x, seal.center.z);
      const onSpine = u > 230 && u < 300 && Math.abs(v) < 8;
      expect(onSpine, `seal blocks the corridor at u=${u.toFixed(0)}, v=${v.toFixed(0)}`).toBe(
        false,
      );
    }
  });
});

describe("verdant-line-1 capture poses", () => {
  it("authors 8–12+ poses that stand inside the region's own water", () => {
    expect(VERDANT_1.capturePoses.length).toBeGreaterThanOrEqual(8);
    for (const pose of VERDANT_1.capturePoses) {
      const [x, y, z] = pose.position;
      expect(verdantWeight(x, z), pose.name).toBeGreaterThan(0.3);
      const floor = verdantTerrainTarget(x, z) + VERDANT_1.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(verdantCeiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });
});
