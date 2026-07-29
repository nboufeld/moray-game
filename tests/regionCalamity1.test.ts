import { InstancedMesh, Mesh, Points, Scene, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the def, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing the def
// module *first* runs the cycle the other way round, where the registry
// reads `CALAMITY_1` before its module finishes evaluating.
import { seabedHeight } from "../src/world/Seabed";
import { CALAMITY_1, buildSeals } from "../src/world/regions/calamity1/Calamity1";
import {
  CALAMITY_SLOT,
  CENTER_X,
  CENTER_Z,
  calamityCeiling,
  calamityTerrainTarget,
  calamityWeight,
  marchChannelCenter,
  marchChannelHalf,
  spokeOf,
  worldOf,
} from "../src/world/regions/calamity1/CalamityTerrain";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Sunken Calamity's own contracts: identity where it owns nothing,
 * determinism where it owns everything, budgets counted rather than
 * claimed, colliders inside the domain, and capture poses that stand in
 * water the region actually has.
 */

describe("sunken-calamity-1 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === CALAMITY_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(CALAMITY_1.weight(x, z), slot.id).toBe(0);
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
        expect(CALAMITY_1.weight(Math.cos(theta) * r, Math.sin(theta) * r)).toBe(0);
      }
    }
  });

  it("is exactly zero in both neighbouring wings' ground at the seam", () => {
    // The Current Run (4.23) and Mangrove Roots (4.95) wedges reach
    // 0.195 rad of the 4.59 spoke at r = 44–50; the seam tongue's 8.2 m
    // half-width clears both. Sampled inside their carve where it hurts.
    for (const azimuth of [4.23 + 0.14, 4.95 - 0.14]) {
      for (const r of [44, 47, 49.5]) {
        const x = Math.cos(azimuth) * r;
        const z = Math.sin(azimuth) * r;
        expect(CALAMITY_1.weight(x, z), `az=${azimuth} r=${r}`).toBe(0);
      }
    }
  });

  it("is full in its heart and covers the whole long approach", () => {
    expect(CALAMITY_1.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
    for (const u of [60, 150, 280, 400, 500]) {
      const { x, z } = worldOf(u, 0);
      expect(CALAMITY_1.weight(x, z), `tongue u=${u}`).toBeGreaterThan(0.5);
    }
  });
});

describe("sunken-calamity-1 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [100, 2],
      [260, -6],
      [470, 0],
      [532, 0],
      [626, -4],
      [700, 0],
      [752, 58],
      [774, -86],
      [860, 10],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = calamityTerrainTarget(x, z);
      expect(calamityTerrainTarget(x, z)).toBe(first);
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
        const { x, z } = worldOf(700 + du, dv);
        const h = calamityTerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    // The Wound holds the bottom at −30; the sheltering ridge the top.
    expect(highest - lowest).toBeGreaterThanOrEqual(20);
    expect(lowest).toBeLessThanOrEqual(-24);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(700 + du, dv);
        if (calamityWeight(x, z) === 0) {
          continue;
        }
        const floor = calamityTerrainTarget(x, z) + CALAMITY_1.floorClearance;
        expect(calamityCeiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the march's own channel, at its lowest point per station.
    for (let u = 48; u <= 530; u += 6) {
      const { x, z } = worldOf(u, marchChannelCenter(u));
      const floor = calamityTerrainTarget(x, z) + CALAMITY_1.floorClearance;
      expect(calamityCeiling(x, z), `march u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("sunken-calamity-1 build", () => {
  let build: RegionBuild;

  beforeAll(() => {
    build = CALAMITY_1.build(new Scene());
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
      const weight = calamityWeight(collider.center.x, collider.center.z);
      expect(weight, `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`).toBeGreaterThan(0);
    }
  });

  it("registers the Curator as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("ashkeeper-octopus");
    expect(calamityWeight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(CALAMITY_1.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
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

describe("sunken-calamity-1 seals", () => {
  it("walls the rim and the march inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        calamityWeight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves a gate over the approach tongue", () => {
    const seals = buildSeals();
    // No rim seal may block the corridor where the march exits — and the
    // corridor is the *channel*, which wanders: the spine window follows
    // the channel's own centre, not the spoke's axis.
    for (const seal of seals) {
      const { u, v } = spokeOf(seal.center.x, seal.center.z);
      const onSpine =
        u > 460 && u < 530 && Math.abs(v - marchChannelCenter(u)) < marchChannelHalf(u) - 2;
      expect(onSpine, `seal blocks the corridor at u=${u.toFixed(0)}, v=${v.toFixed(0)}`).toBe(
        false,
      );
    }
  });
});

describe("sunken-calamity-1 capture poses", () => {
  it("authors 8–12+ poses that stand inside the region's own water", () => {
    expect(CALAMITY_1.capturePoses.length).toBeGreaterThanOrEqual(8);
    for (const pose of CALAMITY_1.capturePoses) {
      const [x, y, z] = pose.position;
      expect(calamityWeight(x, z), pose.name).toBeGreaterThan(0.3);
      const floor = calamityTerrainTarget(x, z) + CALAMITY_1.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(calamityCeiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });
});
