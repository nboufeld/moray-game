import { InstancedMesh, Matrix4, Mesh, Points, Scene, Vector3, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the defs, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing a def
// module *first* runs the cycle the other way round.
import { seabedHeight } from "../src/world/Seabed";
import { SMOKING_3, buildSeals } from "../src/world/regions/smoking3/Smoking3";
import { SMOKING_2 } from "../src/world/regions/smoking2/Smoking2";
import {
  CENTER_X,
  CENTER_Z,
  CRADLE,
  RESTS,
  SMOKING3_SLOT,
  channelCenter,
  passGate,
  smoking3Ceiling,
  smoking3TerrainTarget,
  smoking3Weight,
  spokeOf,
  wickCenter,
  worldOf,
} from "../src/world/regions/smoking3/Smoking3Terrain";
import { restFree } from "../src/world/regions/smoking3/Smoking3Shared";
import { GLOWS } from "../src/world/regions/smoking3/Smoking3Light";
import { wickShoalStations } from "../src/world/regions/smoking3/Smoking3Life";
import { wrightPathPoints } from "../src/world/regions/smoking3/Smoking3Wright";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Lantern Vigil's own contracts: identity where it owns nothing,
 * the depth-3 pass overlap with the Forge Combs asserted from both
 * sides, determinism, budgets counted rather than claimed, colliders
 * inside the domain, the registered rests held empty, the resident's
 * whole flight probed against the poses and the colliders, and capture
 * poses standing in water the region actually has.
 */

describe("smoking-marches-3 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === SMOKING3_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(SMOKING_3.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero everywhere inside r = 46 and short of the pass mouth", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 45.9, 200, 500, 940, 1110]) {
        expect(
          SMOKING_3.weight(Math.cos(theta) * r, Math.sin(theta) * r),
          `r=${r}`,
        ).toBe(0);
      }
    }
  });

  it("is full in its heart", () => {
    expect(SMOKING_3.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
  });

  it("overlaps the Forge Combs' far pole: both weights positive on the spoke between 1132 and 1159", () => {
    let overlapSeen = false;
    for (const u of [1133, 1140, 1150, 1158]) {
      const { x, z } = worldOf(u, 0);
      const ours = SMOKING_3.weight(x, z);
      const theirs = SMOKING_2.weight(x, z);
      expect(ours, `smoking-3 at u=${u}`).toBeGreaterThan(0);
      if (ours > 0 && theirs > 0) {
        overlapSeen = true;
      }
    }
    expect(overlapSeen, "no spoke point had both weights positive").toBe(true);
  });

  it("covers the whole pass corridor so the bounds handover has no gap", () => {
    for (let u = 1133; u <= 1310; u += 6) {
      const { x, z } = worldOf(u, channelCenter(u));
      expect(SMOKING_3.weight(x, z), `spine u=${u}`).toBeGreaterThan(0);
    }
  });

  it("threads the Night Door pair: the channel keeps |v| < 5 through their fins", () => {
    // The Forge Combs' ledger reserved a clear lane |v| < 11 for
    // u 1080–1160, pinched to |v| ≲ 8 by the Night Door pair's own
    // colliders at u ≈ 1107–1127; our channel must stay well inside it.
    for (let u = 1100; u <= 1140; u += 4) {
      expect(Math.abs(channelCenter(u)), `channel at u=${u}`).toBeLessThan(5);
    }
  });
});

describe("smoking-marches-3 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [1140, 2],
      [1246, 0],
      [1308, -4],
      [1330, -6],
      [1430, -98],
      [1478, 104],
      [1560, 42],
      [1612, -10],
      [1650, 2],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = smoking3TerrainTarget(x, z);
      expect(smoking3TerrainTarget(x, z)).toBe(first);
      const composed = seabedHeight(x, z);
      expect(seabedHeight(x, z)).toBe(composed);
    }
  });

  it("keeps the threshold at dune level where the framework's reject circle truncates it", () => {
    // RegionField consults this region only within 260 m of its centre
    // (u ≥ 1200 on the spoke); below that the target must stay near
    // dune level so the annex floor stays honest over the Combs' shore.
    for (const u of [1133, 1150, 1170, 1195]) {
      const { x, z } = worldOf(u, 0);
      expect(Math.abs(smoking3TerrainTarget(x, z)), `u=${u}`).toBeLessThan(1.2);
    }
  });

  it("carries at least 20 m of vertical range across the domain", () => {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let du = -170; du <= 170; du += 8) {
      for (let dv = -170; dv <= 170; dv += 8) {
        if (Math.hypot(du, dv) > 170) {
          continue;
        }
        const { x, z } = worldOf(1460 + du, dv);
        const h = smoking3TerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    expect(highest - lowest).toBeGreaterThanOrEqual(20);
    // The Cradle holds the bottom of the range.
    expect(lowest).toBeLessThanOrEqual(-21);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(1460 + du, dv);
        if (smoking3Weight(x, z) === 0) {
          continue;
        }
        const floor = smoking3TerrainTarget(x, z) + SMOKING_3.floorClearance;
        expect(smoking3Ceiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the pass's own spine, from inside the Combs' rim.
    for (let u = 1133; u <= 1360; u += 5) {
      const { x, z } = worldOf(u, channelCenter(u));
      const floor = smoking3TerrainTarget(x, z) + SMOKING_3.floorClearance;
      expect(smoking3Ceiling(x, z), `pass u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("smoking-marches-3 build", () => {
  let build: RegionBuild;
  const named = new Map<string, Object3D[]>();

  beforeAll(() => {
    build = SMOKING_3.build(new Scene());
    (build.group as Object3D).traverse((node) => {
      const list = named.get(node.name) ?? [];
      list.push(node);
      named.set(node.name, list);
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
    console.info(`[measure] smoking3 budgets: ${draws} draws / ${Math.round(triangles)} tris`);
    // MASTER R12: ≤260 draws / ≤1.35M tris, bound by the headed frame
    // gate (recorded in the ledger, not assertable here).
    expect(draws).toBeLessThanOrEqual(260);
    expect(triangles).toBeLessThanOrEqual(1_350_000);
    // Honest floors as well as caps: an empty region passes no bar.
    // This region is built to the R12 standard from its first draft.
    expect(draws).toBeGreaterThan(50);
    expect(triangles).toBeGreaterThan(400_000);
  });

  it("builds deterministically (the lanterns and the cold lantern byte-equal across builds)", () => {
    const again = SMOKING_3.build(new Scene());
    for (const name of ["vigil-lanterns", "vigil-cold-lantern"]) {
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

  it("keeps every collider inside the domain", () => {
    expect(build.colliders.length).toBeGreaterThan(100);
    for (const collider of build.colliders) {
      const weight = smoking3Weight(collider.center.x, collider.center.z);
      expect(
        weight,
        `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("keeps the fill's instances inside the domain", () => {
    const m = new Matrix4();
    let sampled = 0;
    for (const [name, nodes] of named) {
      if (!name.startsWith("kit-")) {
        continue;
      }
      // Swimmers (shoals, particulates) hold their stations under their
      // own kit contract and are asserted by route below.
      if (name.startsWith("kit-shoal") || name.startsWith("kit-particulate")) {
        continue;
      }
      for (const node of nodes) {
        // The kit's quality pass (R12) reshapes pieces freely: some are
        // single merged meshes, some are named GROUPS whose children
        // carry the geometry. Walk down to the real meshes before
        // sampling.
        const meshes: InstancedMesh[] = [];
        node.traverse((child) => {
          if ((child as InstancedMesh).isMesh) {
            meshes.push(child as InstancedMesh);
          }
        });
        node.updateMatrixWorld(true);
        for (const mesh of meshes) {
          if (!mesh.isInstancedMesh) {
            const position = mesh.geometry.getAttribute("position");
            const v = new Vector3();
            for (let i = 0; i < position.count; i += 60) {
              v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
              expect(
                smoking3Weight(v.x, v.z),
                `${name} vertex[${i}] at ${v.x.toFixed(1)},${v.z.toFixed(1)}`,
              ).toBeGreaterThan(0);
              sampled++;
            }
            continue;
          }
          for (let i = 0; i < mesh.count; i += 5) {
            mesh.getMatrixAt(i, m);
            if (m.elements[13]! < -100) {
              continue; // parked below the world
            }
            m.premultiply(mesh.matrixWorld);
            const x = m.elements[12]!;
            const z = m.elements[14]!;
            expect(
              smoking3Weight(x, z),
              `${name}[${i}] at ${x.toFixed(1)},${z.toFixed(1)}`,
            ).toBeGreaterThan(0);
            sampled++;
          }
        }
      }
    }
    expect(sampled).toBeGreaterThan(200);
  });

  it("keeps the registered rests empty of fill (MASTER §1.2)", () => {
    // Every kit instance — litter, carpets, scree, bushes, mats, drapes,
    // perchers — stays out of the Cold Lantern's circle, the Fen Hush
    // and the Morning Shadow. A miss inside one is a registry
    // violation, not a style choice. (The Cold Lantern itself is the
    // rest's licensed composition, and is not a kit instance; the ash
    // fall crosses the circle like weather, licensed by the registry.)
    const m = new Matrix4();
    const position = new Vector3();
    const assertOut = (x: number, z: number, label: string): void => {
      const { u, v } = spokeOf(x, z);
      for (const [restName, rest] of Object.entries(RESTS)) {
        expect(
          Math.hypot(u - rest.u, v - rest.v),
          `${label} inside ${restName}`,
        ).toBeGreaterThan(rest.radius - 2);
      }
    };
    let inspected = 0;
    (build.group as Object3D).traverse((node) => {
      let current: Object3D | null = node;
      let kitName: string | null = null;
      while (current) {
        if (current.name.startsWith("kit-")) {
          kitName = current.name;
          break;
        }
        current = current.parent;
      }
      if (
        kitName === null ||
        kitName.startsWith("kit-shoal") ||
        kitName.startsWith("kit-particulate")
      ) {
        return;
      }
      if (!(node instanceof InstancedMesh)) {
        return;
      }
      inspected++;
      for (let i = 0; i < node.count; i++) {
        node.getMatrixAt(i, m);
        position.setFromMatrixPosition(m);
        if (position.y < -100) {
          continue; // parked below the world on purpose
        }
        assertOut(position.x, position.z, `${kitName} ${i}`);
      }
    });
    expect(inspected).toBeGreaterThan(8);
    // The mat rings' merged discs, by vertex.
    for (const node of named.get("kit-mat-rings") ?? []) {
      const meshes: Mesh[] = [];
      node.traverse((child) => {
        if ((child as Mesh).isMesh) {
          meshes.push(child as Mesh);
        }
      });
      node.updateMatrixWorld(true);
      for (const mesh of meshes) {
        const pos = mesh.geometry.getAttribute("position");
        const v = new Vector3();
        for (let i = 0; i < pos.count; i += 7) {
          v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
          assertOut(v.x, v.z, `mat vertex[${i}]`);
        }
      }
    }
  });

  it("keeps every warm glow out of the rests", () => {
    for (const glow of GLOWS) {
      const { x, z } = worldOf(glow.u, glow.v);
      expect(restFree(x, z), `glow at u=${glow.u},v=${glow.v.toFixed(1)}`).toBeGreaterThan(0.5);
    }
  });

  it("gives the wick shoal honest water (clearance and ceiling)", () => {
    const stations = wickShoalStations();
    expect(stations.length).toBeGreaterThan(10);
    for (const [x, y, z] of stations) {
      // The threshold leg noses into the handover band, where our
      // ownership is deliberately a whisper (0.14) under the Combs'
      // Glass Shore.
      expect(smoking3Weight(x, z)).toBeGreaterThan(0.1);
      const floor = smoking3TerrainTarget(x, z);
      expect(y).toBeGreaterThan(floor + 1);
      expect(y).toBeLessThan(smoking3Ceiling(x, z) - 0.5);
      const { u, v } = spokeOf(x, z);
      for (const [restName, rest] of Object.entries(RESTS)) {
        expect(
          Math.hypot(u - rest.u, v - rest.v),
          `station u=${u.toFixed(0)} in ${restName}`,
        ).toBeGreaterThan(rest.radius);
      }
    }
    // Every station clears every collider with a braid margin.
    const at = new Vector3();
    for (const [x, y, z] of stations) {
      at.set(x, y, z);
      for (const collider of build.colliders) {
        expect(
          at.distanceTo(collider.center),
          `station ${x.toFixed(1)},${z.toFixed(1)} vs collider ` +
            `${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
        ).toBeGreaterThan(collider.radius + 0.9);
      }
    }
  });

  it("keeps the pass channel swimmable — no geometry of ours blocks the road in", () => {
    // The depth-3 journey's own contract, verified from this side:
    // along the corridor's swim line no collider of ours (lantern, seal,
    // shoulder) may intrude on the channel the diver swims. (The Forge
    // Combs' far rim ring crosses this corridor from THEIR side — the
    // standing orchestrator flag, mirroring the Canopy Deep protocol.)
    const swim = new Vector3();
    for (let u = 1133; u <= 1315; u += 2) {
      const { x, z } = worldOf(u, channelCenter(u));
      const floor = smoking3TerrainTarget(x, z);
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
    // And on down the wick, the road-as-place through the country.
    for (let u = 1315; u <= 1600; u += 4) {
      const { x, z } = worldOf(u, wickCenter(u));
      const floor = smoking3TerrainTarget(x, z);
      swim.set(x, floor + 1.6, z);
      for (const collider of build.colliders) {
        const clearance = swim.distanceTo(collider.center) - collider.radius;
        expect(
          clearance,
          `wick blocked at u=${u} by collider at ` +
            `${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
        ).toBeGreaterThan(0.55);
      }
    }
  });

  it("registers the Lampwright as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("lampwright");
    expect(smoking3Weight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(SMOKING_3.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
  });

  it("keeps the Lampwright's whole round clear of colliders and rests", () => {
    const points = wrightPathPoints();
    for (const point of points) {
      const { u, v } = spokeOf(point.x, point.z);
      for (const [restName, rest] of Object.entries(RESTS)) {
        expect(
          Math.hypot(u - rest.u, v - rest.v),
          `round in ${restName}`,
        ).toBeGreaterThan(rest.radius);
      }
      for (const collider of build.colliders) {
        expect(
          point.distanceTo(collider.center),
          `round vs collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
        ).toBeGreaterThan(collider.radius + 0.4);
      }
    }
  });

  it("keeps the lampwright pose beyond the focus scanner's reach of the whole flight", () => {
    const pose = SMOKING_3.capturePoses.find((p) => p.name === "lampwright");
    expect(pose).toBeDefined();
    const stand = new Vector3(...pose!.position);
    for (const point of wrightPathPoints()) {
      expect(stand.distanceTo(point), "flight point inside 14.8 m").toBeGreaterThan(14.8);
    }
  });

  it("keeps every wright normal finite (the r4 whiteout regression)", () => {
    // Double-wound sheets summed opposite face normals to zero →
    // NaN normals → NaN pixels poisoning the light-shaft blur → the
    // whole frame whited out around the animal. One winding +
    // DoubleSide; this holds it.
    const mesh = build.group.getObjectByName("vigil-lampwright") as Mesh | null;
    expect(mesh?.geometry.attributes.normal).toBeDefined();
    const normal = mesh!.geometry.attributes.normal!;
    for (let i = 0; i < normal.count; i++) {
      const len =
        Math.abs(normal.getX(i)) + Math.abs(normal.getY(i)) + Math.abs(normal.getZ(i));
      expect(Number.isFinite(len) && len > 1e-6, `normal ${i} degenerate`).toBe(true);
    }
  });

  it("survives a minute of updates without spending randomness", () => {
    const ctx = {
      diverPosition: { x: CENTER_X, y: -10, z: CENTER_Z },
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

describe("smoking-marches-3 seals", () => {
  it("walls the rim and the pass shoulders inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        smoking3Weight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves the pass corridor open", () => {
    const seals = buildSeals();
    for (const seal of seals) {
      const { u, v } = spokeOf(seal.center.x, seal.center.z);
      const onSpine = u < 1315 && Math.abs(v - channelCenter(u)) < 9.5;
      expect(onSpine, `seal blocks the corridor at u=${u.toFixed(0)}, v=${v.toFixed(0)}`).toBe(
        false,
      );
    }
  });

  it("gates the rim closure and rim fade off the pass corridor", () => {
    expect(passGate(1240, 0)).toBeGreaterThan(0.95);
    expect(passGate(1240, 120)).toBe(0);
    expect(passGate(1500, 0)).toBe(0);
  });
});

describe("smoking-marches-3 capture poses", () => {
  it("authors 12+ poses that stand inside the region's own water", () => {
    expect(SMOKING_3.capturePoses.length).toBeGreaterThanOrEqual(12);
    for (const pose of SMOKING_3.capturePoses) {
      const [x, y, z] = pose.position;
      expect(smoking3Weight(x, z), pose.name).toBeGreaterThan(0.1);
      const floor = smoking3TerrainTarget(x, z) + SMOKING_3.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(smoking3Ceiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });

  it("includes the pass pose on the Forge Combs' side of the overlap", () => {
    const pass = SMOKING_3.capturePoses.find((pose) => pose.name === "night-threshold");
    expect(pass).toBeDefined();
    const [x, , z] = pass!.position;
    // It stands where BOTH regions own the water — the overlap, lived in.
    expect(SMOKING_2.weight(x, z)).toBeGreaterThan(0);
    expect(SMOKING_3.weight(x, z)).toBeGreaterThan(0);
  });

  it("keeps a stillness pose for the Cold Lantern that reads from outside, not inside", () => {
    const pose = SMOKING_3.capturePoses.find((p) => p.name === "cold-lantern");
    expect(pose).toBeDefined();
    const [x, , z] = pose!.position;
    const { u, v } = spokeOf(x, z);
    const d = Math.hypot(u - RESTS.coldLantern.u, v - RESTS.coldLantern.v);
    expect(d).toBeGreaterThan(RESTS.coldLantern.radius);
    expect(d).toBeLessThan(40);
    // The Cradle pose likewise stands off the garden's heart.
    const cradle = SMOKING_3.capturePoses.find((p) => p.name === "the-cradle");
    expect(cradle).toBeDefined();
    const [cx, , cz] = cradle!.position;
    const cs = spokeOf(cx, cz);
    expect(Math.hypot(cs.u - CRADLE.u, cs.v - CRADLE.v)).toBeGreaterThan(20);
  });

  it("ends the province: the morning-vent pose faces the terminus", () => {
    const pose = SMOKING_3.capturePoses.find((p) => p.name === "morning-vent");
    expect(pose).toBeDefined();
    const [x, , z] = pose!.position;
    const { u } = spokeOf(x, z);
    expect(u).toBeGreaterThan(1540);
  });
});
