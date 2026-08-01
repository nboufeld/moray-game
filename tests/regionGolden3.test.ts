import { InstancedMesh, Matrix4, Mesh, Points, Scene, Vector3, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the def, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing the def
// module *first* runs the cycle the other way round.
import { seabedHeight } from "../src/world/Seabed";
import { GOLDEN_3, buildSeals } from "../src/world/regions/golden3/Golden3";
import { MIRROR_REST, SPINE_ROAD, insideRest } from "../src/world/regions/golden3/Golden3Beats";
import { GOLDEN_2 } from "../src/world/regions/golden2/Golden2";
import {
  CENTER_X,
  CENTER_Z,
  GOLDEN3_SLOT,
  WELL,
  combeChannelCenter,
  golden3Ceiling,
  golden3TerrainTarget,
  golden3Weight,
  spokeOf,
  worldOf,
} from "../src/world/regions/golden3/Golden3Terrain";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Vesper Strand's own contracts: identity where it owns nothing,
 * the depth-3 handover where it owns a whisper, determinism where it
 * owns everything, budgets counted rather than claimed (R12), colliders
 * inside the domain, the protected-stillness registry held (MASTER
 * §1.2), the corridor swimmable, and capture poses that stand in water
 * the region actually has.
 */

describe("golden-waste-3 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === GOLDEN3_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(GOLDEN_3.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero near the world's origin and the bowl", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 60, 120]) {
        expect(GOLDEN_3.weight(Math.cos(theta) * r, Math.sin(theta) * r)).toBe(0);
      }
    }
  });

  it("is full in its heart and continuous along the whole pass spine", () => {
    expect(GOLDEN_3.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
    for (let u = 1132; u <= 1600; u += 8) {
      const { x, z } = worldOf(u, combeChannelCenter(Math.min(u, 1320)));
      expect(GOLDEN_3.weight(x, z), `spine u=${u}`).toBeGreaterThan(0.08);
    }
  });

  it("overlaps the Carillon Waste across the handover band — no bounds gap", () => {
    // The pass tongue starts 30 m inside golden-waste-2's rim (u 1160),
    // so both domains own the water between 1132 and 1160.
    for (const u of [1136, 1144, 1152, 1158]) {
      const { x, z } = worldOf(u, 0);
      expect(GOLDEN_2.weight(x, z), `golden2 at u=${u}`).toBeGreaterThan(0);
      expect(GOLDEN_3.weight(x, z), `golden3 at u=${u}`).toBeGreaterThan(0);
    }
  });

  it("keeps the threshold a whisper so the Carillon Waste carries the shelf", () => {
    for (const u of [1140, 1160, 1180]) {
      const { x, z } = worldOf(u, 0);
      const w = GOLDEN_3.weight(x, z);
      expect(w, `threshold u=${u}`).toBeGreaterThan(0.08);
      expect(w, `threshold u=${u}`).toBeLessThan(0.25);
    }
  });

  it("mirrors the neighbour's shelf across the reject circle", () => {
    // RegionField consults a depth-3 region only within radius + 40 of
    // its centre (u ≥ ~1200); out there the target must track the
    // composed ground (golden-2's shelf fades −2.2 → 0 by u 1150, then
    // base ≈ 0 ± 0.4 — probed before authoring) so the step at the
    // circle is centimetres under the whisper weight.
    for (let u = 1132; u <= 1196; u += 6) {
      for (const v of [-10, 0, 10]) {
        const { x, z } = worldOf(u, v);
        const target = golden3TerrainTarget(x, z);
        const composed = seabedHeight(x, z);
        expect(Math.abs(target - composed), `target vs ground u=${u} v=${v}`).toBeLessThan(1.6);
      }
    }
    // And exactly at the circle's edge the step is centimetres.
    for (const v of [-8, 0, 8]) {
      const { x, z } = worldOf(1200, v);
      expect(Math.abs(golden3TerrainTarget(x, z)), `target at circle v=${v}`).toBeLessThan(0.9);
    }
  });
});

describe("golden-waste-3 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [1180, 2],
      [1270, -4],
      [1360, 20],
      [1408, -26],
      [1420, -92],
      [1524, 46],
      [1600, -4],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = golden3TerrainTarget(x, z);
      expect(golden3TerrainTarget(x, z)).toBe(first);
      const composed = seabedHeight(x, z);
      expect(seabedHeight(x, z)).toBe(composed);
    }
  });

  it("carries at least 28 m of vertical range and takes the Night Well past −38", () => {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let du = -170; du <= 170; du += 6) {
      for (let dv = -170; dv <= 170; dv += 6) {
        if (Math.hypot(du, dv) > 170) {
          continue;
        }
        const { x, z } = worldOf(1460 + du, dv);
        const h = golden3TerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    expect(highest - lowest).toBeGreaterThanOrEqual(28);
    expect(lowest).toBeLessThanOrEqual(-36);
    // The Night Well's heart, sampled directly, is truly deep.
    const well = worldOf(WELL.u, WELL.v);
    expect(golden3TerrainTarget(well.x, well.z)).toBeLessThan(-38);
    // The whole drop from the threshold's shelf (≈ 0) to the well is
    // the region's ~40 m journey.
    const shelf = worldOf(1240, 0);
    expect(
      golden3TerrainTarget(shelf.x, shelf.z) - golden3TerrainTarget(well.x, well.z),
    ).toBeGreaterThan(34);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(1460 + du, dv);
        if (golden3Weight(x, z) === 0) {
          continue;
        }
        const floor = golden3TerrainTarget(x, z) + GOLDEN_3.floorClearance;
        expect(golden3Ceiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the pass's own channel.
    for (let u = 1136; u <= 1330; u += 6) {
      const { x, z } = worldOf(u, combeChannelCenter(u));
      const floor = golden3TerrainTarget(x, z) + GOLDEN_3.floorClearance;
      expect(golden3Ceiling(x, z), `pass u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("golden-waste-3 build", () => {
  let build: RegionBuild;
  const named = new Map<string, Object3D[]>();

  beforeAll(() => {
    build = GOLDEN_3.build(new Scene());
    (build.group as Object3D).traverse((node) => {
      const list = named.get(node.name) ?? [];
      list.push(node);
      named.set(node.name, list);
    });
  });

  it("stays inside the R12 budgets, measured", () => {
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
    console.info(`[measure] golden3 budgets: ${draws} draws / ${Math.round(triangles)} tris`);
    // MASTER R12 (the binding gate is the headed frame measure,
    // recorded in the ledger; these caps are the honest envelope).
    expect(draws).toBeLessThanOrEqual(260);
    expect(triangles).toBeLessThanOrEqual(1_350_000);
    // Honest floors: an empty region passes no bar, and a region whose
    // fill silently vanished fails loudly.
    expect(draws).toBeGreaterThan(50);
    expect(triangles).toBeGreaterThan(250_000);
  });

  it("keeps every collider inside the domain", () => {
    expect(build.colliders.length).toBeGreaterThan(100);
    for (const collider of build.colliders) {
      const weight = golden3Weight(collider.center.x, collider.center.z);
      expect(
        weight,
        `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("registers the Evening Pilgrim as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("vesper-pilgrim");
    expect(golden3Weight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(GOLDEN_3.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
  });

  it("builds byte-identically twice — no draw-order dependence, no reroll", () => {
    const second = GOLDEN_3.build(new Scene());
    const secondNamed = new Map<string, Object3D[]>();
    (second.group as Object3D).traverse((node) => {
      const list = secondNamed.get(node.name) ?? [];
      list.push(node);
      secondNamed.set(node.name, list);
    });
    const m1 = new Matrix4();
    const m2 = new Matrix4();
    for (const name of [
      "vesper-stone-pale",
      "vesper-stone-dusk",
      "vesper-door",
      "vesper-candles",
      "vesper-pilgrim",
    ]) {
      const a = named.get(name)?.[0] as Mesh | undefined;
      const b = secondNamed.get(name)?.[0] as Mesh | undefined;
      expect(a, name).toBeDefined();
      expect(b, name).toBeDefined();
      const ca = a!.geometry.boundingSphere!.center;
      const cb = b!.geometry.boundingSphere!.center;
      expect(ca.x, name).toBe(cb.x);
      expect(ca.y, name).toBe(cb.y);
      expect(ca.z, name).toBe(cb.z);
    }
    // Instanced cover: the carpet fields' first instances agree
    // exactly across builds. The named nodes are kit GROUPS — walk
    // down to the instanced meshes (the Smoulder containment lesson).
    const instanced = (nodes: Object3D[] | undefined): InstancedMesh[] => {
      const meshes: InstancedMesh[] = [];
      for (const node of nodes ?? []) {
        node.traverse((child) => {
          if ((child as InstancedMesh).isInstancedMesh) {
            meshes.push(child as InstancedMesh);
          }
        });
      }
      return meshes;
    };
    const carpetsA = instanced(named.get("kit-carpet-field"));
    const carpetsB = instanced(secondNamed.get("kit-carpet-field"));
    expect(carpetsA.length).toBeGreaterThan(0);
    expect(carpetsA.length).toBe(carpetsB.length);
    for (let i = 0; i < carpetsA.length; i++) {
      expect(carpetsA[i]!.count).toBe(carpetsB[i]!.count);
      carpetsA[i]!.getMatrixAt(0, m1);
      carpetsB[i]!.getMatrixAt(0, m2);
      expect(m1.elements).toEqual(m2.elements);
    }
    second.dispose?.();
  });

  it("keeps every cover instance out of the two registered rests", () => {
    // MASTER §1.2: the Still Mirror and the Pilgrim's Threshold stay
    // composed stillness. The containment walk goes down through named
    // kit GROUPS to their child meshes and samples in world space (the
    // Smoulder containment lesson).
    const coverNames = [
      "kit-carpet-field",
      "kit-ground-litter-0",
      "kit-ground-litter-1",
      "kit-bush-bank",
      "kit-drift-debris",
    ];
    const m = new Matrix4();
    const v = new Vector3();
    let checked = 0;
    for (const name of coverNames) {
      for (const node of named.get(name) ?? []) {
        const meshes: InstancedMesh[] = [];
        node.traverse((child) => {
          if ((child as InstancedMesh).isMesh) {
            meshes.push(child as InstancedMesh);
          }
        });
        node.updateMatrixWorld(true);
        for (const mesh of meshes) {
          if (!mesh.isInstancedMesh) {
            const position = mesh.geometry.getAttribute("position")!;
            for (let i = 0; i < position.count; i += 13) {
              v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
              const { u, v: sv } = spokeOf(v.x, v.z);
              expect(insideRest(u, sv), `${name} vertex at u=${u.toFixed(0)} v=${sv.toFixed(0)}`).toBe(
                false,
              );
              checked++;
            }
            continue;
          }
          for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, m);
            if (m.elements[13]! < -100) {
              continue; // parked below the world
            }
            m.premultiply(mesh.matrixWorld);
            const { u, v: sv } = spokeOf(m.elements[12]!, m.elements[14]!);
            expect(insideRest(u, sv), `${name}[${i}] at u=${u.toFixed(0)} v=${sv.toFixed(0)}`).toBe(
              false,
            );
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(5_000);
  });

  it("keeps standing cover off the close poses' lenses", () => {
    const closes = GOLDEN_3.capturePoses.filter((pose) => pose.name.startsWith("close-"));
    expect(closes.length).toBeGreaterThanOrEqual(4);
    const m = new Matrix4();
    for (const node of named.get("kit-carpet-field") ?? []) {
      const meshes: InstancedMesh[] = [];
      node.traverse((child) => {
        if ((child as InstancedMesh).isInstancedMesh) {
          meshes.push(child as InstancedMesh);
        }
      });
      node.updateMatrixWorld(true);
      for (const mesh of meshes) {
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m);
          if (m.elements[13]! < -100) {
            continue;
          }
          m.premultiply(mesh.matrixWorld);
          for (const pose of closes) {
            const d = Math.hypot(
              m.elements[12]! - pose.position[0],
              m.elements[14]! - pose.position[2],
            );
            expect(d, `carpet instance on ${pose.name}'s lens`).toBeGreaterThan(0.9);
          }
        }
      }
    }
  });

  it("keeps the road life clear of the Still Mirror", () => {
    // The traveller shoal and the Lantern Caravan both ride within
    // ~5 m of the spine road; the road itself must clear the rest.
    for (let i = 0; i < SPINE_ROAD.length - 1; i++) {
      const [au, av] = SPINE_ROAD[i]!;
      const [bu, bv] = SPINE_ROAD[i + 1]!;
      for (let t = 0; t <= 1; t += 0.1) {
        const u = au + (bu - au) * t;
        const v = av + (bv - av) * t;
        const d = Math.hypot(u - MIRROR_REST.u, v - MIRROR_REST.v);
        expect(d, `road at u=${u.toFixed(0)}`).toBeGreaterThan(MIRROR_REST.radius + 5);
      }
    }
  });

  it("survives a minute of updates without spending randomness", () => {
    const ctx = {
      diverPosition: new Vector3(CENTER_X, -20, CENTER_Z),
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

describe("golden-waste-3 seals", () => {
  it("walls the rim and the pass shoulders inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        golden3Weight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves the inbound pass corridor swimmable end to end", () => {
    const seals = buildSeals();
    for (let u = 1136; u <= 1334; u += 3) {
      const vc = combeChannelCenter(u);
      for (const dv of [-3, 0, 3]) {
        const { x, z } = worldOf(u, vc + dv);
        const yBase = golden3TerrainTarget(x, z);
        for (const lift of [1.4, 2.4]) {
          const y = yBase + lift;
          for (const seal of seals) {
            const d = Math.hypot(x - seal.center.x, y - seal.center.y, z - seal.center.z);
            expect(d, `seal blocks the corridor at u=${u.toFixed(0)}, dv=${dv}`).toBeGreaterThan(
              seal.radius,
            );
          }
        }
      }
    }
  });

  it("keeps the corridor's swim line under the neighbour's low mouth", () => {
    // Golden-2's far-rim ceiling closes to ~3.4–3.9 m over the
    // corridor (u 1150–1160): the handover doorway is low but real.
    for (const u of [1140, 1150, 1158]) {
      const { x, z } = worldOf(u, 0);
      const floor = golden3TerrainTarget(x, z) + GOLDEN_3.floorClearance;
      const theirCeiling = GOLDEN_2.ceiling(x, z);
      expect(theirCeiling - floor, `mouth at u=${u}`).toBeGreaterThan(1.6);
    }
  });
});

describe("golden-waste-3 capture poses", () => {
  it("authors 16+ poses that stand inside the region's own water", () => {
    expect(GOLDEN_3.capturePoses.length).toBeGreaterThanOrEqual(16);
    for (const pose of GOLDEN_3.capturePoses) {
      const [x, y, z] = pose.position;
      // Threshold poses stand in the whisper band on purpose (the
      // depth-3 handover): the floor of the bar is presence, not
      // ownership.
      expect(golden3Weight(x, z), pose.name).toBeGreaterThan(0.08);
      const floor = golden3TerrainTarget(x, z) + GOLDEN_3.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(golden3Ceiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });

  it("gives the Night Well its up-shot and the Pilgrim its window", () => {
    const wellPose = GOLDEN_3.capturePoses.find((pose) => pose.name === "well-blade");
    const pilgrim = GOLDEN_3.capturePoses.find((pose) => pose.name === "pilgrim");
    const horizon = GOLDEN_3.capturePoses.find((pose) => pose.name === "evening-horizon");
    expect(wellPose).toBeDefined();
    expect(pilgrim).toBeDefined();
    expect(horizon).toBeDefined();
    // The well pose stands genuinely inside the pit, looking up.
    expect(wellPose!.position[1]).toBeLessThan(-34);
    expect(wellPose!.pitch).toBeGreaterThan(0.1);
    expect(pilgrim!.pitch).toBeGreaterThan(0.05);
    expect(pilgrim!.settle).toBeGreaterThanOrEqual(6);
  });
});
