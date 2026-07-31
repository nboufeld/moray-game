import { InstancedMesh, Mesh, Points, Scene, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing (the pilot's documented cycle note):
// `Seabed` pulls `RegionField` → `RegionRegistry` → the defs, and that
// chain tolerates the cycle. Importing the def module first runs the
// cycle the other way round.
import { seabedHeight } from "../src/world/Seabed";
import { BLUE_1, buildSeals } from "../src/world/regions/blue1/Blue1";
import {
  BLUE1_SLOT,
  CENTER_X,
  CENTER_Z,
  DEEP_FLOOR,
  DROP_LIP_S,
  SEAL_RC,
  blue1Ceiling,
  blue1TerrainTarget,
  blue1Weight,
  dropWeight,
  slopeChannelCenter,
  slopeChannelHalf,
  spokeOf,
  worldOf,
} from "../src/world/regions/blue1/Blue1Terrain";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Drop Plains' own contracts: identity where it owns nothing,
 * determinism where it owns everything, a drop that truly exceeds −30,
 * budgets counted rather than claimed, colliders inside the honest core,
 * and capture poses that stand in water the region actually has.
 */

describe("great-blue-1 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === BLUE1_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(BLUE_1.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero everywhere inside the tongue's own start", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 39, 43.9]) {
        expect(BLUE_1.weight(Math.cos(theta) * r, Math.sin(theta) * r)).toBe(0);
      }
    }
  });

  it("is full in its heart and covers the approach tongue", () => {
    expect(BLUE_1.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
    for (const u of [60, 120, 200, 270]) {
      const { x, z } = worldOf(u, 0);
      expect(BLUE_1.weight(x, z), `tongue u=${u}`).toBeGreaterThan(0.5);
    }
  });

  it("keeps clear of the neighbouring wings' wedges at the seam", () => {
    // Mangrove Roots' wedge reaches 5.115 rad; Ice Grotto's starts at
    // 5.505 (endHalf 0.165 either side of 4.95 / 5.67). The seam tongue
    // must be structurally zero in both, out to the wings' carve end.
    for (const azimuth of [5.115, 5.505]) {
      for (const r of [44, 47, 50]) {
        expect(
          BLUE_1.weight(Math.cos(azimuth) * r, Math.sin(azimuth) * r),
          `azimuth=${azimuth} r=${r}`,
        ).toBe(0);
      }
    }
  });
});

describe("great-blue-1 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [100, 2],
      [340, -60],
      [445, 0],
      [500, 40],
      [560, -10],
      [382, -96],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = blue1TerrainTarget(x, z);
      expect(blue1TerrainTarget(x, z)).toBe(first);
      const composed = seabedHeight(x, z);
      expect(seabedHeight(x, z)).toBe(composed);
    }
  });

  it("carries more than 30 m of vertical range and a drop past −30", () => {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let du = -160; du <= 160; du += 6) {
      for (let dv = -160; dv <= 160; dv += 6) {
        if (Math.hypot(du, dv) > 160) {
          continue;
        }
        const { x, z } = worldOf(445 + du, dv);
        const h = blue1TerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    expect(highest - lowest).toBeGreaterThan(30);
    // The World's Edge is a true drop: the floor exceeds −30 by metres.
    expect(lowest).toBeLessThan(-40);
    // And the Under-Blue actually reaches the authored deep floor.
    const deepAt = worldOf(445 + DROP_LIP_S + 30, 0);
    expect(blue1TerrainTarget(deepAt.x, deepAt.z)).toBeLessThan(DEEP_FLOOR + 4);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    // The honest core: everything inside the seal radius.
    for (let du = -SEAL_RC; du <= SEAL_RC; du += 8) {
      for (let dv = -SEAL_RC; dv <= SEAL_RC; dv += 8) {
        if (Math.hypot(du, dv) > SEAL_RC) {
          continue;
        }
        const { x, z } = worldOf(445 + du, dv);
        const floor = blue1TerrainTarget(x, z) + BLUE_1.floorClearance;
        expect(blue1Ceiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the glide's own channel.
    for (let u = 48; u <= 298; u += 6) {
      const { x, z } = worldOf(u, 0);
      const floor = blue1TerrainTarget(x, z) + BLUE_1.floorClearance;
      expect(blue1Ceiling(x, z), `slope u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });

  it("agrees with the composed ground inside the honest core", () => {
    // Inside the seal radius the weight is 1, so the composed ground must
    // BE the target — the annex floor's whole honesty argument.
    for (const [du, dv] of [
      [0, 0],
      [80, 40],
      [110, -20],
      [140, 0],
      [-100, 90],
    ] as const) {
      const { x, z } = worldOf(445 + du, dv);
      expect(Math.abs(seabedHeight(x, z) - blue1TerrainTarget(x, z))).toBeLessThan(1e-9);
    }
  });
});

describe("great-blue-1 build", () => {
  let build: RegionBuild;

  beforeAll(() => {
    build = BLUE_1.build(new Scene());
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
    // Fill rounds (R12 budgets ≤260 / ≤1.35M): round 1 measured 90 draws
    // / 853,315 tris; round 2 (near blades 9k, lip-country mid tier,
    // deep stars 30) measured 89 / 996,159.
    expect(draws).toBeLessThanOrEqual(140);
    expect(triangles).toBeLessThanOrEqual(1_100_000);
    // Honest floors as well as caps: an empty region passes no bar.
    expect(draws).toBeGreaterThan(70);
    expect(triangles).toBeGreaterThan(600_000);
  });

  it("gives every lit mesh a finite normal attribute", () => {
    // The Ferryman shipped once with no normals at all (a position-only
    // merge, and `smoothNormals` silently requires an existing attribute) —
    // and a lit draw with the normal array unbound corrupted whole frames
    // on the capture machine's driver. Never again, for any mesh here.
    (build.group as Object3D).traverse((node) => {
      if (!(node instanceof Mesh) || node instanceof Points) {
        return;
      }
      const material = node.material as { type?: string };
      if (material.type !== "MeshToonMaterial" && material.type !== "MeshStandardMaterial") {
        return;
      }
      const normal = node.geometry.attributes.normal;
      expect(normal, `mesh ${node.name} has no normal attribute`).toBeDefined();
      const array = normal!.array as Float32Array;
      for (let i = 0; i < array.length; i++) {
        if (!Number.isFinite(array[i])) {
          throw new Error(`mesh ${node.name} has a non-finite normal at ${i}`);
        }
      }
    });
  });

  it("keeps every collider inside the domain", () => {
    expect(build.colliders.length).toBeGreaterThan(120);
    for (const collider of build.colliders) {
      const weight = blue1Weight(collider.center.x, collider.center.z);
      expect(
        weight,
        `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("registers the Ferryman as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("the-ferryman");
    expect(blue1Weight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(BLUE_1.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
    // The anchor hangs in the void below the lip, above the deep floor.
    expect(target.position.y).toBeLessThan(-20);
    expect(target.position.y).toBeGreaterThan(
      blue1TerrainTarget(target.position.x, target.position.z),
    );
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
      build.update?.(0.1, ctx as never);
    }
  });
});

describe("great-blue-1 seals", () => {
  it("walls the rim and the glide inside the honest core", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(100);
    for (const seal of seals) {
      expect(
        blue1Weight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
      // Every ring/row seal stands where target = composed ground exactly
      // (weight 1) or on the slope's tongue — never in the feather where
      // the annex floor and the visible ground disagree.
      const rc = Math.hypot(seal.center.x - CENTER_X, seal.center.z - CENTER_Z);
      const { u } = spokeOf(seal.center.x, seal.center.z);
      expect(rc < 170 || u < 300, `seal in the feather at rc=${rc.toFixed(0)}`).toBe(true);
    }
  });

  it("leaves a gate over the approach corridor's spine", () => {
    const seals = buildSeals();
    for (const seal of seals) {
      const { u, v } = spokeOf(seal.center.x, seal.center.z);
      const rc = Math.hypot(seal.center.x - CENTER_X, seal.center.z - CENTER_Z);
      const blocksSpine = Math.abs(rc - SEAL_RC) < 6 && Math.abs(v) < 10 && u < 300;
      expect(blocksSpine, `seal blocks the corridor at u=${u.toFixed(0)}, v=${v.toFixed(0)}`).toBe(
        false,
      );
    }
  });
});

// ─── The fill's contracts (Phase 3, docs/fill-plans/great-blue-1.md) ─────────

/** Reads instance world positions out of an InstancedMesh's matrices. */
function instancePositions(mesh: InstancedMesh): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  const m = mesh.instanceMatrix.array as Float32Array;
  for (let i = 0; i < mesh.count; i++) {
    out.push({ x: m[i * 16 + 12]!, y: m[i * 16 + 13]!, z: m[i * 16 + 14]! });
  }
  return out;
}

/** Every static fill instance in the build, tagged by its parent's name. */
function fillInstances(build: RegionBuild): { name: string; x: number; y: number; z: number }[] {
  const out: { name: string; x: number; y: number; z: number }[] = [];
  (build.group as Object3D).traverse((node) => {
    if (!(node instanceof InstancedMesh)) {
      return;
    }
    // Walk up for the fill wrapper name; skip movers (shoals, fry, jacks)
    // whose instances are posed by update, not placed on the ground.
    let owner: Object3D | null = node;
    while (owner && !owner.name.startsWith("blue1-fill")) {
      owner = owner.parent;
    }
    if (!owner) {
      return;
    }
    if (/outriders|fry-pods|jacks/.test(owner.name)) {
      return;
    }
    for (const p of instancePositions(node)) {
      if (p.y < -200) {
        continue; // parked spare capacity
      }
      out.push({ name: owner.name, ...p });
    }
  });
  return out;
}

describe("great-blue-1 fill", () => {
  let build: RegionBuild;

  beforeAll(() => {
    build = BLUE_1.build(new Scene());
  });

  it("holds the reroll fence: landmarks, Ferryman, deep steps byte-unchanged", () => {
    // Pinned against the pre-fill build (plains-final, commit e1a519d):
    // every fill stream is `SEEDS.regionBlue1 ^ 0xf3xx`, appended after
    // all existing draws, so these numbers cannot move.
    const c0 = build.colliders[0]!.center;
    expect(c0.x).toBeCloseTo(24.664018883, 9);
    expect(c0.y).toBeCloseTo(-2.425317405, 9);
    expect(c0.z).toBeCloseTo(-49.743805369, 9);

    (build.group as Object3D).traverse((node) => {
      if (node.name === "blue1-ferryman") {
        const mesh = node as Mesh;
        expect(mesh.position.x).toBeCloseTo(298.455808146, 9);
        expect(mesh.position.y).toBeCloseTo(-25.437144069, 9);
        expect(mesh.position.z).toBeCloseTo(-488.662174961, 9);
      }
      if (node.name === "blue1-deep-step-0") {
        const p = (node as Mesh).geometry.attributes.position!;
        expect(p.getX(0)).toBeCloseTo(201.902526855, 9);
        expect(p.getY(0)).toBeCloseTo(-50, 9);
        expect(p.getZ(0)).toBeCloseTo(-534.981872559, 9);
      }
    });
  });

  it("keeps the registered rests empty: Under-Blue, hush lane, King hollow, Prow tip", () => {
    const king = worldOf(383.8, -102.2);
    const prowTip = worldOf(551.4, 4);
    const instances = fillInstances(build);
    expect(instances.length).toBeGreaterThan(10_000);
    for (const p of instances) {
      const { u, v } = spokeOf(p.x, p.z);
      // THE UNDER-BLUE: nothing below the lip's grip, ever.
      expect(dropWeight(u - 445, v), `${p.name} over the drop at u${u.toFixed(0)}`).toBeLessThanOrEqual(0.05);
      // The Fallen King hollow: stars and beam only.
      expect(
        Math.hypot(p.x - king.x, p.z - king.z),
        `${p.name} in the King's hollow`,
      ).toBeGreaterThan(8);
      // The Prow tip.
      expect(
        Math.hypot(p.x - prowTip.x, p.z - prowTip.z),
        `${p.name} on the Prow tip`,
      ).toBeGreaterThan(7.5);
      // The mid-glide hush: the channel lane stays a clean sand road.
      if (u > 180 && u < 230) {
        const away = Math.abs(v - slopeChannelCenter(u));
        expect(away, `${p.name} in the hush lane at u${u.toFixed(0)}`).toBeGreaterThan(
          slopeChannelHalf(u),
        );
      }
    }
  });

  it("grows the grass tiers where the prairie is and nowhere it is not", () => {
    let near = 0;
    let mid = 0;
    let far = 0;
    for (const p of fillInstances(build)) {
      if (p.name === "blue1-fill-grass-near") {
        near++;
      } else if (p.name === "blue1-fill-grass-mid") {
        mid++;
      } else if (p.name === "blue1-fill-grass-far") {
        far++;
      } else {
        continue;
      }
      const { u, v } = spokeOf(p.x, p.z);
      // Grass country: on the disc, off the slope road, off the drop.
      expect(u, `grass on the slope at u${u.toFixed(0)}`).toBeGreaterThan(288);
      expect(dropWeight(u - 445, v)).toBeLessThanOrEqual(0.05);
    }
    // The ~4× prairie: three tiers, each carrying real density.
    expect(near).toBeGreaterThan(3500);
    expect(mid).toBeGreaterThan(5500);
    expect(far).toBeGreaterThan(6500);
  });

  it("gives the Ferryman its two pilot jacks", () => {
    let jacks: InstancedMesh | undefined;
    (build.group as Object3D).traverse((node) => {
      if (node.name === "blue1-ferryman-jacks" && node instanceof InstancedMesh) {
        jacks = node;
      }
    });
    expect(jacks).toBeDefined();
    expect(jacks!.count).toBe(2);
    // Posed with the patrol from the region's own attach clock: both ride
    // within a few metres of the mola.
    const positions = instancePositions(jacks!);
    for (const p of positions) {
      const d = Math.hypot(p.x - 298.455808146, p.y - -25.437144069, p.z - -488.662174961);
      expect(d).toBeLessThan(6);
    }
  });
});

describe("great-blue-1 capture poses", () => {
  it("authors 8–18 poses that stand inside the region's own water", () => {
    // Fill round 1 appended two authored poses (wayline-walk,
    // ferryman-crossing) and the four close poses after the twelve.
    expect(BLUE_1.capturePoses.length).toBeGreaterThanOrEqual(8);
    expect(BLUE_1.capturePoses.length).toBeLessThanOrEqual(18);
    for (const pose of BLUE_1.capturePoses) {
      const [x, y, z] = pose.position;
      expect(blue1Weight(x, z), pose.name).toBeGreaterThan(0.3);
      const floor = blue1TerrainTarget(x, z) + BLUE_1.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(blue1Ceiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });
});
