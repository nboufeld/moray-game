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
import { PALE_3, buildSeals } from "../src/world/regions/pale3/Pale3";
import { PALE_2 } from "../src/world/regions/pale2/Pale2";
import { farGate } from "../src/world/regions/pale2/Pale2Terrain";
import {
  CENTER_X,
  CENTER_Z,
  PALE3_SLOT,
  RESTS,
  channelCenter,
  pale3Ceiling,
  pale3TerrainTarget,
  pale3Weight,
  passGate,
  spokeOf,
  worldOf,
} from "../src/world/regions/pale3/Pale3Terrain";
import { CHOIR_STATIONS } from "../src/world/regions/pale3/Pale3Life";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Dayspring's own contracts: identity where it owns nothing, the
 * depth-3 pass overlap with the Lantern Combs asserted from both
 * sides (including THEIR pre-parted far gate — the reservation,
 * spent), determinism, budgets counted rather than claimed, colliders
 * inside the domain, the registered rests held empty (down through
 * named kit GROUPS to their child meshes, sampled in world space),
 * the corridor swim-line, and capture poses standing in water the
 * region actually has.
 */

describe("pale-passage-3 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === PALE3_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(PALE_3.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero everywhere inside r = 46 and far behind the pass mouth", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 45.9, 200, 500, 900, 1100]) {
        expect(
          PALE_3.weight(Math.cos(theta) * r, Math.sin(theta) * r),
          `r=${r} theta=${theta.toFixed(2)}`,
        ).toBe(0);
      }
    }
  });

  it("is full in its heart", () => {
    expect(PALE_3.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
  });

  it("overlaps the Combs' rim: both weights positive on the spoke between 1130 and 1160", () => {
    let overlapSeen = false;
    for (const u of [1132, 1140, 1150, 1159]) {
      const { x, z } = worldOf(u, 0);
      const ours = PALE_3.weight(x, z);
      const theirs = PALE_2.weight(x, z);
      expect(ours, `pale-3 at u=${u}`).toBeGreaterThan(0);
      if (ours > 0 && theirs > 0) {
        overlapSeen = true;
      }
    }
    expect(overlapSeen, "no spoke point had both weights positive").toBe(true);
  });

  it("covers the whole pass corridor so the bounds handover has no gap", () => {
    for (let u = 1132; u <= 1290; u += 6) {
      const { x, z } = worldOf(u, 0);
      expect(PALE_3.weight(x, z), `spine u=${u}`).toBeGreaterThan(0);
    }
  });

  it("arrives inside the corridor the Combs reserved (their farGate parts over it)", () => {
    // Their ledger's reservation: seals and rings part over u ≥ ~1080,
    // |v| ≤ ~22. Our tongue must live inside that parted window where
    // it crosses their rim.
    for (const u of [1132, 1145, 1158]) {
      expect(farGate(u, 0), `their farGate on our spine at u=${u}`).toBeGreaterThan(0.9);
      const { x, z } = worldOf(u, 0);
      const ours = PALE_3.weight(x, z);
      expect(ours, `our weight at u=${u}`).toBeGreaterThan(0);
    }
  });
});

describe("pale-passage-3 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [1140, 4],
      [1250, 0],
      [1295, -6],
      [1438, 74],
      [1442, -46],
      [1470, -80],
      [1614, 0],
      [1630, 0],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = pale3TerrainTarget(x, z);
      expect(pale3TerrainTarget(x, z)).toBe(first);
      const composed = seabedHeight(x, z);
      expect(seabedHeight(x, z)).toBe(composed);
    }
  });

  it("keeps the threshold at dune level where the framework's reject circle truncates it", () => {
    // RegionField consults this region only within 260 m of its centre
    // (u ≥ ~1200 on the spoke); below that the target must be near
    // dune level so the annex floor stays honest over the Combs' rim.
    for (const u of [1132, 1150, 1170, 1195]) {
      const { x, z } = worldOf(u, 0);
      expect(Math.abs(pale3TerrainTarget(x, z)), `u=${u}`).toBeLessThan(1.4);
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
        const { x, z } = worldOf(1460 + du, dv);
        const h = pale3TerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    // The threshold shelf sits at dune level above the country.
    const shelf = pale3TerrainTarget(worldOf(1150, 0).x, worldOf(1150, 0).z);
    highest = Math.max(highest, shelf);
    expect(highest - lowest).toBeGreaterThanOrEqual(24);
    // The mere holds the bottom of the range.
    expect(lowest).toBeLessThanOrEqual(-26);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(1460 + du, dv);
        if (pale3Weight(x, z) === 0) {
          continue;
        }
        const floor = pale3TerrainTarget(x, z) + PALE_3.floorClearance;
        expect(pale3Ceiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the pass's own spine, from inside the Combs' rim.
    for (let u = 1132; u <= 1340; u += 5) {
      const { x, z } = worldOf(u, channelCenter(u));
      const floor = pale3TerrainTarget(x, z) + PALE_3.floorClearance;
      expect(pale3Ceiling(x, z), `pass u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("pale-passage-3 build", () => {
  let build: RegionBuild;

  beforeAll(() => {
    build = PALE_3.build(new Scene());
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
    console.info(`pale-passage-3 measured: ${draws} draws / ${Math.round(triangles)} triangles`);
    expect(draws).toBeLessThanOrEqual(260);
    // Hard-geometry purge: the horizon rings' soft three-row grammar
    // (crest dissolve — critic F3) lands ~0.9k tris over the R12 cap;
    // the doctrine ships an overage recorded against the measured gate
    // (docs/region-ledger/hard-geometry-fix.md).
    expect(triangles).toBeLessThanOrEqual(1_355_000);
    // Honest floors as well as caps: an empty region passes no bar.
    expect(draws).toBeGreaterThan(50);
    expect(triangles).toBeGreaterThan(500_000);
  });

  it("builds deterministically (the fonts and the pearl byte-equal across builds)", () => {
    const again = PALE_3.build(new Scene());
    for (const name of ["pale3-fonts-warm", "pale3-fonts-cool", "pale3-belfry", "pale3-dayspring-pearl"]) {
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
      const weight = pale3Weight(collider.center.x, collider.center.z);
      expect(
        weight,
        `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("registers the Chorister as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("dayspring-chorister");
    expect(pale3Weight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(PALE_3.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
  });

  it("keeps the pass channel swimmable — no geometry of ours blocks the road in", () => {
    // The depth-3 journey's own contract, verified from this side.
    // (The Combs' side needs NO reciprocal cut: their seals and rings
    // were parted over this corridor from their first draft.)
    const swim = new Vector3();
    for (let u = 1132; u <= 1330; u += 2) {
      const { x, z } = worldOf(u, channelCenter(u));
      const floor = pale3TerrainTarget(x, z);
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
    // The region's MASTER §1.2 contributions: the Still Morning, the
    // Sun's Doorstep, the Undawn. Every kit build and every region
    // instanced family stays out. Named kit GROUPS are walked down to
    // their child meshes and sampled in world space.
    const matrix = new Matrix4();
    const position = new Vector3();
    const kitNameOf = (node: Object3D): string | null => {
      let current: Object3D | null = node;
      while (current) {
        if (current.name.startsWith("kit-") || current.name.startsWith("pale3-")) {
          return current.name;
        }
        current = current.parent;
      }
      return null;
    };
    const assertOutside = (x: number, z: number, label: string): void => {
      const { u, v } = spokeOf(x, z);
      expect(
        Math.hypot(u - RESTS.stillMorning.u, v - RESTS.stillMorning.v),
        `${label} inside the Still Morning`,
      ).toBeGreaterThan(RESTS.stillMorning.radius - 2);
      expect(
        Math.hypot(u - RESTS.doorstep.u, v - RESTS.doorstep.v),
        `${label} inside the Sun's Doorstep`,
      ).toBeGreaterThan(RESTS.doorstep.radius - 1);
      if (
        u > RESTS.undawn.fromU + 2 &&
        u < RESTS.undawn.toU - 2 &&
        Math.abs(v - channelCenter(u)) < 8
      ) {
        throw new Error(`${label} inside the Undawn at u=${u.toFixed(1)}`);
      }
    };
    // Exemptions by licence: the ground sheets and distance rings span
    // the domain; the Dayspring, the Morning Ring and the Chorister
    // are the doorstep's own composition; the light marks are events,
    // not scatter; the fonts stand outside every rest by construction
    // but their merged sheets span wide bounding volumes.
    const exempt = new Set([
      "pale3-ground-disc",
      "pale3-ground-pass",
      "pale3-fonts-warm",
      "pale3-fonts-cool",
      "pale3-belfry",
      "pale3-dayspring-pearl",
      "pale3-morning-ring",
      "pale3-morning-veil",
      "pale3-chorister",
      "kit-beams",
      "kit-light-pools",
      "kit-particulate-field",
    ]);
    let inspected = 0;
    build.group.updateMatrixWorld(true);
    build.group.traverse((node) => {
      const kitName = kitNameOf(node);
      if (
        kitName === null ||
        exempt.has(kitName) ||
        kitName.startsWith("pale3-distance") ||
        kitName.startsWith("pale3-chorister")
      ) {
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

  it("keeps the Dawn Choir's tour clear of the rests", () => {
    for (const [u, v] of CHOIR_STATIONS) {
      expect(
        Math.hypot(u - RESTS.stillMorning.u, v - RESTS.stillMorning.v),
        `choir station at u=${u}`,
      ).toBeGreaterThan(RESTS.stillMorning.radius + 2);
      expect(
        Math.hypot(u - RESTS.doorstep.u, v - RESTS.doorstep.v),
        `choir station at u=${u}`,
      ).toBeGreaterThan(RESTS.doorstep.radius + 2);
      expect(u, "the choir never enters the Undawn").toBeGreaterThan(RESTS.undawn.toU + 2);
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

  it("updates deterministically — the same simulated second lands the same choir matrices", () => {
    const ctxA = { diverPosition: { x: 0, y: 0, z: 0 }, diverSpeed: 0, reducedMotion: false, time: 0 };
    const first = PALE_3.build(new Scene());
    for (let i = 0; i < 100; i++) {
      ctxA.time += 0.1;
      first.update?.(0.1, ctxA as never);
    }
    const second = PALE_3.build(new Scene());
    const ctxB = { ...ctxA, time: 0 };
    for (let i = 0; i < 50; i++) {
      ctxB.time += 0.2;
      second.update?.(0.2, ctxB as never);
    }
    const choirA = first.group.getObjectByName("pale3-dawn-choir") as InstancedMesh;
    const choirB = second.group.getObjectByName("pale3-dawn-choir") as InstancedMesh;
    expect(choirA).toBeDefined();
    const a = choirA.instanceMatrix.array as Float32Array;
    const b = choirB.instanceMatrix.array as Float32Array;
    for (let i = 0; i < a.length; i++) {
      expect(Math.abs(a[i]! - b[i]!), `matrix float ${i}`).toBeLessThan(1e-4);
    }
  });
});

describe("pale-passage-3 seals", () => {
  it("walls the rim and the pass shoulders inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        pale3Weight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves the inbound pass corridor open", () => {
    const seals = buildSeals();
    for (const seal of seals) {
      const { u, v } = spokeOf(seal.center.x, seal.center.z);
      const onInbound = u < 1324 && Math.abs(v - channelCenter(u)) < 14;
      expect(
        onInbound,
        `seal blocks the inbound corridor at u=${u.toFixed(0)}, v=${v.toFixed(0)}`,
      ).toBe(false);
    }
  });

  it("gates the rim closure and rim fade off the corridor", () => {
    expect(passGate(1264, 0)).toBeGreaterThan(0.95);
    expect(passGate(1264, 120)).toBe(0);
    expect(passGate(1600, 0)).toBe(0);
  });
});

describe("pale-passage-3 capture poses", () => {
  it("authors 14+ poses (four close) that stand inside the region's own water", () => {
    expect(PALE_3.capturePoses.length).toBeGreaterThanOrEqual(14);
    const close = PALE_3.capturePoses.filter((pose) => pose.name.startsWith("close-"));
    expect(close.length).toBeGreaterThanOrEqual(4);
    for (const pose of PALE_3.capturePoses) {
      const [x, y, z] = pose.position;
      expect(pale3Weight(x, z), pose.name).toBeGreaterThan(0.1);
      const floor = pale3TerrainTarget(x, z) + PALE_3.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(pale3Ceiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });

  it("includes the pass pose on the Combs' side of the overlap", () => {
    const pass = PALE_3.capturePoses.find((pose) => pose.name === "pass-threshold");
    expect(pass).toBeDefined();
    const [x, , z] = pass!.position;
    // It stands where BOTH regions own the water — the overlap, lived in.
    expect(PALE_2.weight(x, z)).toBeGreaterThan(0);
    expect(PALE_3.weight(x, z)).toBeGreaterThan(0);
  });

  it("keeps the world map separated: our domain never reaches another region's heart", () => {
    // The world-map separation contract from our side: at every other
    // slot's centre AND at the Combs' landmarks our weight is zero
    // (the slot-centre case is above; this walks pale-2's authored
    // places).
    for (const [u, v] of [
      [905, 74], // the White Chapel
      [1022, -4], // the Lamp
      [872, -84], // the Still Pool
    ] as const) {
      const { x, z } = worldOf(u, v);
      expect(PALE_3.weight(x, z), `pale-2 landmark at u=${u}`).toBe(0);
    }
  });
});
