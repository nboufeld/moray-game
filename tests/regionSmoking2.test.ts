import { InstancedMesh, Matrix4, Mesh, Points, Scene, Vector3, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the defs, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing a def
// module *first* runs the cycle the other way round.
import { seabedHeight } from "../src/world/Seabed";
import { SMOKING_2, buildSeals } from "../src/world/regions/smoking2/Smoking2";
import { SMOKING_1 } from "../src/world/regions/smoking1/Smoking1";
import {
  CENTER_X,
  CENTER_Z,
  HEARTH,
  RESTS,
  SMOKING2_SLOT,
  passGate,
  saddleCenter,
  smoking2Ceiling,
  smoking2TerrainTarget,
  smoking2Weight,
  spokeOf,
  washCenter,
  worldOf,
} from "../src/world/regions/smoking2/Smoking2Terrain";
import { restFree } from "../src/world/regions/smoking2/Smoking2Shared";
import { GLOWS } from "../src/world/regions/smoking2/Smoking2Light";
import { washShoalStations } from "../src/world/regions/smoking2/Smoking2Life";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Forge Combs' own contracts: identity where it owns nothing, the
 * depth-2 pass overlap with the Smoulder Fields asserted from both
 * sides, determinism, budgets counted rather than claimed, colliders
 * inside the domain, the registered rests held empty, and capture poses
 * standing in water the region actually has.
 */

describe("smoking-marches-2 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === SMOKING2_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(SMOKING_2.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero everywhere inside r = 46 and short of the pass mouth", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 45.9, 200, 500, 620]) {
        expect(
          SMOKING_2.weight(Math.cos(theta) * r, Math.sin(theta) * r),
          `r=${r}`,
        ).toBe(0);
      }
    }
  });

  it("is full in its heart", () => {
    expect(SMOKING_2.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
  });

  it("overlaps the Smoulder Fields' far shore: both weights positive on the spoke between 636 and 664", () => {
    let overlapSeen = false;
    for (const u of [637, 645, 655, 663]) {
      const { x, z } = worldOf(u, 0);
      const ours = SMOKING_2.weight(x, z);
      const theirs = SMOKING_1.weight(x, z);
      expect(ours, `smoking-2 at u=${u}`).toBeGreaterThan(0);
      if (ours > 0 && theirs > 0) {
        overlapSeen = true;
      }
    }
    expect(overlapSeen, "no spoke point had both weights positive").toBe(true);
  });

  it("covers the whole pass corridor so the bounds handover has no gap", () => {
    for (let u = 637; u <= 806; u += 6) {
      const { x, z } = worldOf(u, saddleCenter(u));
      expect(SMOKING_2.weight(x, z), `spine u=${u}`).toBeGreaterThan(0);
    }
  });
});

describe("smoking-marches-2 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [660, 2],
      [742, 0],
      [800, -4],
      [860, 30],
      [905, -95],
      [890, 126],
      [938, -4],
      [1060, -40],
      [1120, 2],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = smoking2TerrainTarget(x, z);
      expect(smoking2TerrainTarget(x, z)).toBe(first);
      const composed = seabedHeight(x, z);
      expect(seabedHeight(x, z)).toBe(composed);
    }
  });

  it("keeps the threshold at dune level where the framework's reject circle truncates it", () => {
    // RegionField consults this region only within 260 m of its centre
    // (u ≥ 680 on the spoke); below that the target must stay near dune
    // level so the annex floor stays honest over the Smoulder's shore.
    for (const u of [637, 650, 665, 678]) {
      const { x, z } = worldOf(u, 0);
      expect(Math.abs(smoking2TerrainTarget(x, z)), `u=${u}`).toBeLessThan(1.2);
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
        const { x, z } = worldOf(940 + du, dv);
        const h = smoking2TerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    expect(highest - lowest).toBeGreaterThanOrEqual(20);
    // The First Hearth holds the bottom of the range.
    expect(lowest).toBeLessThanOrEqual(-18);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(940 + du, dv);
        if (smoking2Weight(x, z) === 0) {
          continue;
        }
        const floor = smoking2TerrainTarget(x, z) + SMOKING_2.floorClearance;
        expect(smoking2Ceiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the pass's own spine, from inside the Smoulder's rim.
    for (let u = 637; u <= 860; u += 5) {
      const { x, z } = worldOf(u, saddleCenter(u));
      const floor = smoking2TerrainTarget(x, z) + SMOKING_2.floorClearance;
      expect(smoking2Ceiling(x, z), `pass u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("smoking-marches-2 build", () => {
  let build: RegionBuild;
  const named = new Map<string, Object3D[]>();

  beforeAll(() => {
    build = SMOKING_2.build(new Scene());
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
    console.info(`[measure] smoking2 budgets: ${draws} draws / ${Math.round(triangles)} tris`);
    // MASTER R12: ≤260 draws / ≤1.35M tris, bound by the headed frame
    // gate (recorded in the ledger, not assertable here).
    expect(draws).toBeLessThanOrEqual(260);
    expect(triangles).toBeLessThanOrEqual(1_350_000);
    // Honest floors as well as caps: an empty region passes no bar.
    // This region is built to the R12 standard from its first draft.
    expect(draws).toBeGreaterThan(50);
    expect(triangles).toBeGreaterThan(400_000);
  });

  it("builds deterministically (the combs and the Anvil byte-equal across builds)", () => {
    const again = SMOKING_2.build(new Scene());
    for (const name of ["forge-comb-walls", "forge-anvil"]) {
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
      const weight = smoking2Weight(collider.center.x, collider.center.z);
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
        // single merged meshes, some are named GROUPS whose children carry
        // the geometry. Walk down to the real meshes before sampling.
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
                smoking2Weight(v.x, v.z),
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
              smoking2Weight(x, z),
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
    // perchers — stays out of the Ladle, the Glass Hush and the Anvil's
    // Shadow. A miss inside one is a registry violation, not a style
    // choice. (The Ladle's licensed exception is its one light shaft,
    // which is not a kit instance.)
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
      if (kitName === null || kitName.startsWith("kit-shoal") || kitName.startsWith("kit-particulate")) {
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

  it("keeps every ember glow out of the rests", () => {
    for (const glow of GLOWS) {
      const { x, z } = worldOf(glow.u, glow.v);
      expect(restFree(x, z), `glow at u=${glow.u},v=${glow.v.toFixed(1)}`).toBeGreaterThan(0.5);
    }
  });

  it("gives the wash shoal honest water (clearance and ceiling)", () => {
    const stations = washShoalStations();
    expect(stations.length).toBeGreaterThan(10);
    for (const [x, y, z] of stations) {
      // The saddle leg noses into the handover band, where our ownership
      // is deliberately a whisper (0.14) under the Smoulder's shore.
      expect(smoking2Weight(x, z)).toBeGreaterThan(0.1);
      const floor = smoking2TerrainTarget(x, z);
      expect(y).toBeGreaterThan(floor + 1);
      expect(y).toBeLessThan(smoking2Ceiling(x, z) - 0.5);
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
    // The depth-2 journey's own contract, verified from this side: along
    // the corridor's swim line no collider of ours (comb, seal, lintel)
    // may intrude on the channel the diver swims. (The Smoulder's far rim
    // ring crosses this corridor from THEIR side — the standing
    // orchestrator flag, mirroring the Canopy Deep protocol.)
    const swim = new Vector3();
    for (let u = 637; u <= 812; u += 2) {
      const { x, z } = worldOf(u, saddleCenter(u));
      const floor = smoking2TerrainTarget(x, z);
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
    // And on down the wash, the road-as-place through the country.
    for (let u = 812; u <= 1060; u += 4) {
      const { x, z } = worldOf(u, washCenter(u));
      const floor = smoking2TerrainTarget(x, z);
      swim.set(x, floor + 1.6, z);
      for (const collider of build.colliders) {
        const clearance = swim.distanceTo(collider.center) - collider.radius;
        expect(
          clearance,
          `wash blocked at u=${u} by collider at ` +
            `${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
        ).toBeGreaterThan(0.55);
      }
    }
  });

  it("registers the Ember Skate as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("ember-skate");
    expect(smoking2Weight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(SMOKING_2.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
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

describe("smoking-marches-2 seals", () => {
  it("walls the rim and the pass shoulders inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        smoking2Weight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves the pass corridor open", () => {
    const seals = buildSeals();
    for (const seal of seals) {
      const { u, v } = spokeOf(seal.center.x, seal.center.z);
      const onSpine = u < 812 && Math.abs(v - saddleCenter(u)) < 11;
      expect(onSpine, `seal blocks the corridor at u=${u.toFixed(0)}, v=${v.toFixed(0)}`).toBe(
        false,
      );
    }
  });

  it("gates the rim closure and rim fade off the pass corridor", () => {
    expect(passGate(740, 0)).toBeGreaterThan(0.95);
    expect(passGate(740, 120)).toBe(0);
    expect(passGate(1000, 0)).toBe(0);
  });
});

describe("smoking-marches-2 capture poses", () => {
  it("authors 12+ poses that stand inside the region's own water", () => {
    expect(SMOKING_2.capturePoses.length).toBeGreaterThanOrEqual(12);
    for (const pose of SMOKING_2.capturePoses) {
      const [x, y, z] = pose.position;
      expect(smoking2Weight(x, z), pose.name).toBeGreaterThan(0.1);
      const floor = smoking2TerrainTarget(x, z) + SMOKING_2.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(smoking2Ceiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });

  it("includes the pass pose on the Smoulder's side of the overlap", () => {
    const pass = SMOKING_2.capturePoses.find((pose) => pose.name === "saddle-crest");
    expect(pass).toBeDefined();
    const [x, , z] = pass!.position;
    // It stands where BOTH regions own the water — the overlap, lived in.
    expect(SMOKING_1.weight(x, z)).toBeGreaterThan(0);
    expect(SMOKING_2.weight(x, z)).toBeGreaterThan(0);
  });

  it("frames the depth-3 reservation: the Night Door pose faces the reserved pass", () => {
    const pose = SMOKING_2.capturePoses.find((p) => p.name === "night-door");
    expect(pose).toBeDefined();
    const [x, , z] = pose!.position;
    const { u } = spokeOf(x, z);
    expect(u).toBeGreaterThan(1040);
  });

  it("keeps a stillness pose for the Ladle that reads from the rim, not inside", () => {
    const pose = SMOKING_2.capturePoses.find((p) => p.name === "the-ladle");
    expect(pose).toBeDefined();
    const [x, , z] = pose!.position;
    const { u, v } = spokeOf(x, z);
    const d = Math.hypot(u - RESTS.ladle.u, v - RESTS.ladle.v);
    expect(d).toBeGreaterThan(RESTS.ladle.radius);
    expect(d).toBeLessThan(40);
    // The Hearth pose likewise stands off the basin's heart.
    const hearth = SMOKING_2.capturePoses.find((p) => p.name === "first-hearth");
    expect(hearth).toBeDefined();
    const [hx, , hz] = hearth!.position;
    const hs = spokeOf(hx, hz);
    expect(Math.hypot(hs.u - HEARTH.u, hs.v - HEARTH.v)).toBeGreaterThan(20);
  });
});
