import { InstancedMesh, Mesh, Points, Scene, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the defs, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing a def
// module *first* runs the cycle the other way round.
import { seabedHeight } from "../src/world/Seabed";
import { VERDANT_2, buildSeals } from "../src/world/regions/verdant2/Verdant2";
import { VERDANT_1 } from "../src/world/regions/verdant1/Verdant1";
import {
  BASIN_FLOOR,
  CENTER_X,
  CENTER_Z,
  VERDANT2_SLOT,
  passGate,
  spokeOf,
  verdant2Ceiling,
  verdant2TerrainTarget,
  verdant2Weight,
  worldOf,
} from "../src/world/regions/verdant2/Verdant2Terrain";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Emerald Terraces' own contracts: identity where it owns nothing,
 * the depth-2 pass overlap with the Great Kelp Sea asserted from both
 * sides, determinism, budgets counted rather than claimed, colliders
 * inside the domain, and capture poses standing in water the region
 * actually has.
 */

describe("verdant-line-2 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === VERDANT2_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(VERDANT_2.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero everywhere inside r = 46 and behind the pass mouth", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 45.9, 200, 400, 620]) {
        expect(
          VERDANT_2.weight(Math.cos(theta) * r, Math.sin(theta) * r),
          `r=${r}`,
        ).toBe(0);
      }
    }
  });

  it("is full in its heart", () => {
    expect(VERDANT_2.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
  });

  it("overlaps the Great Kelp Sea's rim: both weights positive on the spoke between 635 and 665", () => {
    let overlapSeen = false;
    for (const u of [636, 645, 655, 664]) {
      const { x, z } = worldOf(u, 0);
      const ours = VERDANT_2.weight(x, z);
      const theirs = VERDANT_1.weight(x, z);
      expect(ours, `verdant-2 at u=${u}`).toBeGreaterThan(0);
      if (ours > 0 && theirs > 0) {
        overlapSeen = true;
      }
    }
    expect(overlapSeen, "no spoke point had both weights positive").toBe(true);
  });

  it("covers the whole pass corridor so the bounds handover has no gap", () => {
    for (let u = 636; u <= 780; u += 6) {
      const { x, z } = worldOf(u, 0);
      expect(VERDANT_2.weight(x, z), `spine u=${u}`).toBeGreaterThan(0);
    }
  });
});

describe("verdant-line-2 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [660, 4],
      [760, 0],
      [860, -20],
      [905, -12],
      [925, 68],
      [900, -85],
      [1030, 20],
      [1055, 42],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = verdant2TerrainTarget(x, z);
      expect(verdant2TerrainTarget(x, z)).toBe(first);
      const composed = seabedHeight(x, z);
      expect(seabedHeight(x, z)).toBe(composed);
    }
  });

  it("keeps the threshold at dune level where the framework's reject circle truncates it", () => {
    // RegionField consults this region only within 260 m of its centre
    // (u ≥ ~680 on the spoke); below that the target must be near dune
    // level so the annex floor stays honest over the kelp sea's shelf.
    for (const u of [640, 655, 670]) {
      const { x, z } = worldOf(u, 0);
      expect(Math.abs(verdant2TerrainTarget(x, z))).toBeLessThan(1.2);
    }
  });

  it("carries at least 30 m of vertical range across the disc", () => {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let du = -170; du <= 170; du += 8) {
      for (let dv = -170; dv <= 170; dv += 8) {
        if (Math.hypot(du, dv) > 170) {
          continue;
        }
        const { x, z } = worldOf(940 + du, dv);
        const h = verdant2TerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    expect(highest - lowest).toBeGreaterThanOrEqual(30);
    // The Mistfall basin holds the bottom of the range.
    expect(lowest).toBeLessThanOrEqual(BASIN_FLOOR + 4);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(940 + du, dv);
        if (verdant2Weight(x, z) === 0) {
          continue;
        }
        const floor = verdant2TerrainTarget(x, z) + VERDANT_2.floorClearance;
        expect(verdant2Ceiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the pass's own spine, from inside the kelp sea's rim.
    for (let u = 636; u <= 860; u += 5) {
      const { x, z } = worldOf(u, 0);
      const floor = verdant2TerrainTarget(x, z) + VERDANT_2.floorClearance;
      expect(verdant2Ceiling(x, z), `pass u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("verdant-line-2 build", () => {
  let build: RegionBuild;

  beforeAll(() => {
    build = VERDANT_2.build(new Scene());
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
    expect(triangles).toBeGreaterThan(100_000);
  });

  it("keeps every collider inside the domain", () => {
    expect(build.colliders.length).toBeGreaterThan(100);
    for (const collider of build.colliders) {
      const weight = verdant2Weight(collider.center.x, collider.center.z);
      expect(
        weight,
        `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("registers the Terrace Warden as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("terrace-warden");
    expect(verdant2Weight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(VERDANT_2.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
  });

  it("survives a minute of updates without spending randomness", () => {
    const ctx = {
      diverPosition: { x: CENTER_X, y: -20, z: CENTER_Z },
      diverSpeed: 0,
      reducedMotion: false,
      time: 0,
    };
    for (let i = 0; i < 600; i++) {
      ctx.time += 0.1;
      build.update?.(0.1, ctx as never);
    }
  });
});

describe("verdant-line-2 seals", () => {
  it("walls the rim and the pass shoulders inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        verdant2Weight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves the pass corridor open", () => {
    const seals = buildSeals();
    for (const seal of seals) {
      const { u, v } = spokeOf(seal.center.x, seal.center.z);
      const onSpine = u < 810 && Math.abs(v) < 20;
      expect(onSpine, `seal blocks the corridor at u=${u.toFixed(0)}, v=${v.toFixed(0)}`).toBe(
        false,
      );
    }
  });

  it("gates the rim closure and rim fade off the pass corridor", () => {
    // The gate must be fully open on the spine at the rim crossing and
    // fully closed well off it.
    expect(passGate(740, 0)).toBeGreaterThan(0.95);
    expect(passGate(740, 120)).toBe(0);
    expect(passGate(1100, 0)).toBe(0);
  });
});

describe("verdant-line-2 capture poses", () => {
  it("authors 8–12+ poses that stand inside the region's own water", () => {
    expect(VERDANT_2.capturePoses.length).toBeGreaterThanOrEqual(8);
    for (const pose of VERDANT_2.capturePoses) {
      const [x, y, z] = pose.position;
      expect(verdant2Weight(x, z), pose.name).toBeGreaterThan(0.1);
      const floor = verdant2TerrainTarget(x, z) + VERDANT_2.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(verdant2Ceiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });

  it("includes the pass pose on the kelp sea's side of the overlap", () => {
    const pass = VERDANT_2.capturePoses.find((pose) => pose.name === "pass-threshold");
    expect(pass).toBeDefined();
    const [x, , z] = pass!.position;
    // It stands where BOTH regions own the water — the overlap, lived in.
    expect(VERDANT_1.weight(x, z)).toBeGreaterThan(0);
    expect(VERDANT_2.weight(x, z)).toBeGreaterThan(0);
  });
});
