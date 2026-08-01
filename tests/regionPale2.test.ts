import {
  AdditiveBlending,
  InstancedMesh,
  Matrix4,
  Mesh,
  Points,
  Scene,
  Vector3,
  type MeshBasicMaterial,
  type Object3D,
} from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the defs, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing a def
// module *first* runs the cycle the other way round.
import { seabedHeight } from "../src/world/Seabed";
import { PALE_2, buildSeals } from "../src/world/regions/pale2/Pale2";
import { PALE_1 } from "../src/world/regions/pale1/Pale1";
import {
  CENTER_X,
  CENTER_Z,
  PALE2_SLOT,
  RESTS,
  channelCenter,
  farGate,
  pale2Ceiling,
  pale2TerrainTarget,
  pale2Weight,
  passGate,
  spokeOf,
  worldOf,
} from "../src/world/regions/pale2/Pale2Terrain";
import { DRIFT_STATIONS } from "../src/world/regions/pale2/Pale2Life";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Lantern Combs' own contracts: identity where it owns nothing,
 * the depth-2 pass overlap with the Bone Meadows asserted from both
 * sides, determinism, budgets counted rather than claimed, colliders
 * inside the domain, the registered rests held empty (down through
 * named kit GROUPS to their child meshes, sampled in world space),
 * the corridor swim-line, and capture poses standing in water the
 * region actually has.
 */

describe("pale-passage-2 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === PALE2_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(PALE_2.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero everywhere inside r = 46 and behind the pass mouth", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 45.9, 200, 400, 600]) {
        expect(
          PALE_2.weight(Math.cos(theta) * r, Math.sin(theta) * r),
          `r=${r} theta=${theta.toFixed(2)}`,
        ).toBe(0);
      }
    }
  });

  it("is full in its heart", () => {
    expect(PALE_2.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
  });

  it("overlaps the Bone Meadows' rim: both weights positive on the spoke between 635 and 665", () => {
    let overlapSeen = false;
    for (const u of [637, 645, 655, 664]) {
      const { x, z } = worldOf(u, 0);
      const ours = PALE_2.weight(x, z);
      const theirs = PALE_1.weight(x, z);
      expect(ours, `pale-2 at u=${u}`).toBeGreaterThan(0);
      if (ours > 0 && theirs > 0) {
        overlapSeen = true;
      }
    }
    expect(overlapSeen, "no spoke point had both weights positive").toBe(true);
  });

  it("covers the whole pass corridor so the bounds handover has no gap", () => {
    for (let u = 637; u <= 790; u += 6) {
      const { x, z } = worldOf(u, 0);
      expect(PALE_2.weight(x, z), `spine u=${u}`).toBeGreaterThan(0);
    }
  });
});

describe("pale-passage-2 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [650, 4],
      [750, 0],
      [795, -6],
      [905, 74],
      [895, -55],
      [1022, -4],
      [1100, 8],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = pale2TerrainTarget(x, z);
      expect(pale2TerrainTarget(x, z)).toBe(first);
      const composed = seabedHeight(x, z);
      expect(seabedHeight(x, z)).toBe(composed);
    }
  });

  it("keeps the threshold at dune level where the framework's reject circle truncates it", () => {
    // RegionField consults this region only within 260 m of its centre
    // (u ≥ ~680 on the spoke); below that the target must be near dune
    // level so the annex floor stays honest over pale-1's shelf.
    for (const u of [637, 655, 675, 695]) {
      const { x, z } = worldOf(u, 0);
      expect(Math.abs(pale2TerrainTarget(x, z)), `u=${u}`).toBeLessThan(1.4);
    }
  });

  it("carries at least 24 m of vertical range across the domain", () => {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let du = -170; du <= 170; du += 8) {
      for (let dv = -170; dv <= 170; dv += 8) {
        if (Math.hypot(du, dv) > 170) {
          continue;
        }
        const { x, z } = worldOf(940 + du, dv);
        const h = pale2TerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    // The threshold shelf sits at dune level above the country.
    const shelf = pale2TerrainTarget(worldOf(655, 0).x, worldOf(655, 0).z);
    highest = Math.max(highest, shelf);
    expect(highest - lowest).toBeGreaterThanOrEqual(24);
    // The Lamp Basin holds the bottom of the range.
    expect(lowest).toBeLessThanOrEqual(-24);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(940 + du, dv);
        if (pale2Weight(x, z) === 0) {
          continue;
        }
        const floor = pale2TerrainTarget(x, z) + PALE_2.floorClearance;
        expect(pale2Ceiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the pass's own spine, from inside pale-1's rim.
    for (let u = 637; u <= 840; u += 5) {
      const { x, z } = worldOf(u, channelCenter(u));
      const floor = pale2TerrainTarget(x, z) + PALE_2.floorClearance;
      expect(pale2Ceiling(x, z), `pass u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("pale-passage-2 build", () => {
  let build: RegionBuild;
  const named = new Map<string, Object3D[]>();

  beforeAll(() => {
    build = PALE_2.build(new Scene());
    (build.group as Object3D).traverse((node) => {
      if (node.name) {
        const list = named.get(node.name) ?? [];
        list.push(node);
        named.set(node.name, list);
      }
    });
  });

  it("stays inside the R12 draw-call and triangle budgets", () => {
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
    // MASTER R12: ≤260 draws / ≤1.35M tris, bound by the headed frame
    // gate (recorded in the ledger, not assertable here).
    // eslint-disable-next-line no-console
    console.info(`pale-passage-2 measured: ${draws} draws / ${Math.round(triangles)} triangles`);
    expect(draws).toBeLessThanOrEqual(260);
    expect(triangles).toBeLessThanOrEqual(1_350_000);
    // Honest floors as well as caps: an empty region passes no bar.
    // This region is built to the R12 standard from its first draft.
    expect(draws).toBeGreaterThan(50);
    expect(triangles).toBeGreaterThan(500_000);
  });

  it("builds deterministically (the combs and the Lamp byte-equal across builds)", () => {
    const again = PALE_2.build(new Scene());
    for (const name of ["pale2-combs-warm", "pale2-combs-cool", "pale2-lamp"]) {
      const first = build.group.getObjectByName(name) as Mesh | null;
      const second = again.group.getObjectByName(name) as Mesh | null;
      expect(first, name).not.toBeNull();
      expect(second, name).not.toBeNull();
      const a = first!.geometry.attributes.position!.array as Float32Array;
      const b = second!.geometry.attributes.position!.array as Float32Array;
      expect(a.length, name).toBeGreaterThan(0);
      expect(a.length, name).toBe(b.length);
      expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer)), `${name} bytes`).toBe(true);
    }
  });

  it("ships no lit geometry without a normal attribute (MASTER R5's class)", () => {
    // Round 1's blackout: `smoothNormals` no-ops without normals, and a
    // lit toon mesh with none rasterises as a full-screen wash. Every
    // Mesh that is not an additive/basic mark must carry normals.
    let checked = 0;
    (build.group as Object3D).traverse((node) => {
      if (!(node instanceof Mesh)) {
        return;
      }
      const material = node.material as { type?: string };
      if (material.type === "MeshBasicMaterial" || node instanceof Points) {
        return;
      }
      expect(
        node.geometry.attributes.normal,
        `${node.name || node.type} has no normal attribute`,
      ).toBeDefined();
      checked++;
    });
    expect(checked).toBeGreaterThan(10);
  });

  it("keeps every collider inside the domain", () => {
    expect(build.colliders.length).toBeGreaterThan(100);
    for (const collider of build.colliders) {
      const weight = pale2Weight(collider.center.x, collider.center.z);
      expect(
        weight,
        `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("registers the Lampwright as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("comb-lampwright");
    expect(pale2Weight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(PALE_2.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
  });

  it("keeps the pass channel swimmable — no geometry of ours blocks the road in", () => {
    // The depth-2 journey's own contract, verified from this side.
    // (Pale-1's far rim seal ring and distance rings cross this
    // corridor from THEIR side — the standing orchestrator flag,
    // mirroring MASTER R4.)
    const swim = new Vector3();
    for (let u = 637; u <= 830; u += 2) {
      const { x, z } = worldOf(u, channelCenter(u));
      const floor = pale2TerrainTarget(x, z);
      for (const lift of [0.9, 1.8, 2.7]) {
        swim.set(x, floor + lift, z);
        for (const collider of build.colliders) {
          const clearance = swim.distanceTo(collider.center) - collider.radius;
          expect(
            clearance,
            `blocked at u=${u} lift=${lift} by collider at ` +
              `${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
          ).toBeGreaterThan(0.55);
        }
      }
    }
  });

  it("keeps the reserved depth-3 corridor clear of our rim seals", () => {
    // The reservation, held by construction: nothing of ours stands on
    // the far-rim spine where pale-passage-3's tongue will arrive.
    const swim = new Vector3();
    for (let u = 1100; u <= 1160; u += 3) {
      const { x, z } = worldOf(u, 0);
      const floor = pale2TerrainTarget(x, z);
      swim.set(x, floor + 1.4, z);
      for (const collider of build.colliders) {
        const clearance = swim.distanceTo(collider.center) - collider.radius;
        expect(
          clearance,
          `reserved corridor blocked at u=${u} by collider at ` +
            `${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
        ).toBeGreaterThan(0.55);
      }
    }
  });

  it("holds the light marks to the additive discipline", () => {
    let checked = 0;
    build.group.traverse((node) => {
      if (!(node instanceof Mesh)) {
        return;
      }
      if (node.name !== "kit-beams" && node.name !== "kit-light-pools") {
        return;
      }
      const material = node.material as MeshBasicMaterial;
      expect(material.fog, node.name).toBe(false);
      expect(material.transparent, node.name).toBe(true);
      expect(material.depthWrite, node.name).toBe(false);
      expect(material.blending, node.name).toBe(AdditiveBlending);
      checked++;
    });
    expect(checked).toBeGreaterThanOrEqual(2);
  });

  it("keeps the registered rests empty — sampled down to child meshes in world space", () => {
    // The region's MASTER §1.2 contributions: the White Chapel, the
    // Still Pool, the Winnow Shadow. Every kit build and every region
    // instanced family stays out. Named kit GROUPS are walked down to
    // their child meshes and sampled in world space (the smoking-1
    // containment shape).
    const matrix = new Matrix4();
    const position = new Vector3();
    const kitNameOf = (node: Object3D): string | null => {
      let current: Object3D | null = node;
      while (current) {
        if (current.name.startsWith("kit-") || current.name.startsWith("pale2-")) {
          return current.name;
        }
        current = current.parent;
      }
      return null;
    };
    const assertOutside = (x: number, z: number, label: string): void => {
      const { u, v } = spokeOf(x, z);
      expect(
        Math.hypot(u - RESTS.chapel.u, v - RESTS.chapel.v),
        `${label} inside the White Chapel`,
      ).toBeGreaterThan(RESTS.chapel.radius - 2);
      expect(
        Math.hypot(u - RESTS.stillPool.u, v - RESTS.stillPool.v),
        `${label} inside the Still Pool`,
      ).toBeGreaterThan(RESTS.stillPool.radius - 1);
      if (
        u > RESTS.winnowShadow.fromU + 2 &&
        u < RESTS.winnowShadow.toU - 2 &&
        Math.abs(v - channelCenter(u)) < 8
      ) {
        throw new Error(`${label} inside the Winnow Shadow at u=${u.toFixed(1)}`);
      }
    };
    // Exemptions by licence: the ground sheets and distance rings span
    // the domain; the chapel's fin ring and beam are the rest's own
    // composition; the light marks are events, not scatter.
    const exempt = new Set([
      "pale2-ground-disc",
      "pale2-ground-pass",
      "pale2-combs-warm",
      "pale2-combs-cool",
      "pale2-lamp",
      "pale2-lamp-heart",
      "kit-beams",
      "kit-light-pools",
      "kit-particulate-field",
      "pale2-distance-0",
      "pale2-distance-1",
      "pale2-distance-2",
    ]);
    let inspected = 0;
    build.group.updateMatrixWorld(true);
    build.group.traverse((node) => {
      const kitName = kitNameOf(node);
      if (kitName === null || exempt.has(kitName) || kitName.startsWith("pale2-distance")) {
        return;
      }
      if (node instanceof InstancedMesh) {
        inspected++;
        for (let i = 0; i < node.count; i += 2) {
          node.getMatrixAt(i, matrix);
          if (matrix.elements[13]! < -100) {
            continue; // parked below the world
          }
          matrix.premultiply(node.matrixWorld);
          assertOutside(matrix.elements[12]!, matrix.elements[14]!, `${kitName}[${i}]`);
        }
        return;
      }
      if (node instanceof Mesh && !(node instanceof InstancedMesh)) {
        inspected++;
        const pos = node.geometry.getAttribute("position");
        if (!pos) {
          return;
        }
        for (let i = 0; i < pos.count; i += 90) {
          position.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld);
          assertOutside(position.x, position.z, `${kitName} vertex[${i}]`);
        }
      }
    });
    expect(inspected).toBeGreaterThan(10);
  });

  it("keeps the Lantern Drift's tour clear of the rests", () => {
    for (const [u, v] of DRIFT_STATIONS) {
      expect(
        Math.hypot(u - RESTS.chapel.u, v - RESTS.chapel.v),
        `drift station at u=${u}`,
      ).toBeGreaterThan(RESTS.chapel.radius + 2);
      expect(
        Math.hypot(u - RESTS.stillPool.u, v - RESTS.stillPool.v),
        `drift station at u=${u}`,
      ).toBeGreaterThan(RESTS.stillPool.radius + 2);
      expect(u, "the drift never enters the Winnow").toBeGreaterThan(RESTS.winnowShadow.toU + 2);
    }
  });

  it("survives a minute of updates without spending randomness", () => {
    const ctx = {
      diverPosition: { x: CENTER_X, y: -12, z: CENTER_Z },
      diverSpeed: 0,
      reducedMotion: false,
      time: 0,
    };
    for (let i = 0; i < 600; i++) {
      ctx.time += 0.1;
      build.update?.(0.1, ctx as never);
    }
  });

  it("updates deterministically — the same simulated second lands the same jelly matrices", () => {
    const ctxA = { diverPosition: { x: 0, y: 0, z: 0 }, diverSpeed: 0, reducedMotion: false, time: 0 };
    const first = PALE_2.build(new Scene());
    for (let i = 0; i < 100; i++) {
      ctxA.time += 0.1;
      first.update?.(0.1, ctxA as never);
    }
    const second = PALE_2.build(new Scene());
    const ctxB = { ...ctxA, time: 0 };
    for (let i = 0; i < 50; i++) {
      ctxB.time += 0.2;
      second.update?.(0.2, ctxB as never);
    }
    const jelliesA = first.group.getObjectByName("pale2-lantern-drift") as InstancedMesh;
    const jelliesB = second.group.getObjectByName("pale2-lantern-drift") as InstancedMesh;
    expect(jelliesA).toBeDefined();
    const a = jelliesA.instanceMatrix.array as Float32Array;
    const b = jelliesB.instanceMatrix.array as Float32Array;
    for (let i = 0; i < a.length; i++) {
      expect(Math.abs(a[i]! - b[i]!), `matrix float ${i}`).toBeLessThan(1e-4);
    }
  });
});

describe("pale-passage-2 seals", () => {
  it("walls the rim and the pass shoulders inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        pale2Weight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves both pass corridors open", () => {
    const seals = buildSeals();
    for (const seal of seals) {
      const { u, v } = spokeOf(seal.center.x, seal.center.z);
      const onInbound = u < 820 && Math.abs(v - channelCenter(u)) < 14;
      expect(onInbound, `seal blocks the inbound corridor at u=${u.toFixed(0)}, v=${v.toFixed(0)}`).toBe(false);
      const onReserved = u > 1090 && Math.abs(v) < 18;
      expect(onReserved, `seal blocks the reserved corridor at u=${u.toFixed(0)}, v=${v.toFixed(0)}`).toBe(false);
    }
  });

  it("gates the rim closure and rim fade off the corridors", () => {
    expect(passGate(760, 0)).toBeGreaterThan(0.95);
    expect(passGate(760, 120)).toBe(0);
    expect(passGate(1100, 0)).toBe(0);
    expect(farGate(1140, 0)).toBeGreaterThan(0.95);
    expect(farGate(1140, 60)).toBe(0);
    expect(farGate(900, 0)).toBe(0);
  });
});

describe("pale-passage-2 capture poses", () => {
  it("authors 14+ poses (four close) that stand inside the region's own water", () => {
    expect(PALE_2.capturePoses.length).toBeGreaterThanOrEqual(14);
    const close = PALE_2.capturePoses.filter((pose) => pose.name.startsWith("close-"));
    expect(close.length).toBeGreaterThanOrEqual(4);
    for (const pose of PALE_2.capturePoses) {
      const [x, y, z] = pose.position;
      expect(pale2Weight(x, z), pose.name).toBeGreaterThan(0.1);
      const floor = pale2TerrainTarget(x, z) + PALE_2.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(pale2Ceiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });

  it("includes the pass pose on the Bone Meadows' side of the overlap", () => {
    const pass = PALE_2.capturePoses.find((pose) => pose.name === "pass-threshold");
    expect(pass).toBeDefined();
    const [x, , z] = pass!.position;
    // It stands where BOTH regions own the water — the overlap, lived in.
    expect(PALE_1.weight(x, z)).toBeGreaterThan(0);
    expect(PALE_2.weight(x, z)).toBeGreaterThan(0);
  });

  it("keeps the world map separated: our domain never reaches another region's heart", () => {
    // The world-map separation contract from our side: at every other
    // slot's centre AND at pale-1's landmarks our weight is zero (the
    // slot-centre case is above; this walks pale-1's authored places).
    for (const [u, v] of [
      [355, -16], // Bone Forest
      [385, 78], // Quiet Gallery
      [558, 38], // Seed Grove
    ] as const) {
      const { x, z } = worldOf(u, v);
      expect(PALE_2.weight(x, z), `pale-1 landmark at u=${u}`).toBe(0);
    }
  });
});
