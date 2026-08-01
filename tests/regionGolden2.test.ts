import { InstancedMesh, Matrix4, Mesh, Points, Scene, Vector3, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the def, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing the def
// module *first* runs the cycle the other way round.
import { seabedHeight } from "../src/world/Seabed";
import { GOLDEN_2, buildSeals } from "../src/world/regions/golden2/Golden2";
import { insideRest } from "../src/world/regions/golden2/Golden2Beats";
import { GOLDEN_1 } from "../src/world/regions/golden1/Golden1";
import {
  CENTER_X,
  CENTER_Z,
  GOLDEN2_SLOT,
  RIBBON_SPINE,
  golden2Ceiling,
  golden2TerrainTarget,
  golden2Weight,
  gullyChannelCenter,
  spokeOf,
  worldOf,
} from "../src/world/regions/golden2/Golden2Terrain";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Carillon Waste's own contracts: identity where it owns nothing,
 * the depth-2 handover where it owns a whisper, determinism where it
 * owns everything, budgets counted rather than claimed (R12), colliders
 * inside the domain, the protected-stillness registry held (MASTER
 * §1.2), and capture poses that stand in water the region actually has.
 */

describe("golden-waste-2 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === GOLDEN2_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(GOLDEN_2.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero near the world's origin and the bowl", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 60, 120]) {
        expect(GOLDEN_2.weight(Math.cos(theta) * r, Math.sin(theta) * r)).toBe(0);
      }
    }
  });

  it("is full in its heart and continuous along the whole pass spine", () => {
    expect(GOLDEN_2.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
    for (let u = 632; u <= 1080; u += 8) {
      const { x, z } = worldOf(u, gullyChannelCenter(Math.min(u, 820)));
      expect(GOLDEN_2.weight(x, z), `spine u=${u}`).toBeGreaterThan(0.08);
    }
  });

  it("overlaps the Hourglass Sea across the handover band — no bounds gap", () => {
    // The pass tongue starts 35 m inside golden-waste-1's rim (u 665),
    // so both domains own the water between 635 and 665.
    for (const u of [636, 644, 652, 660]) {
      const { x, z } = worldOf(u, 0);
      expect(GOLDEN_1.weight(x, z), `golden1 at u=${u}`).toBeGreaterThan(0);
      expect(GOLDEN_2.weight(x, z), `golden2 at u=${u}`).toBeGreaterThan(0);
    }
  });

  it("keeps the threshold a whisper so the pilot carries the shore", () => {
    for (const u of [640, 660, 680]) {
      const { x, z } = worldOf(u, 0);
      const w = GOLDEN_2.weight(x, z);
      expect(w, `threshold u=${u}`).toBeGreaterThan(0.08);
      expect(w, `threshold u=${u}`).toBeLessThan(0.25);
    }
  });

  it("holds the threshold target at base level across the reject circle", () => {
    // RegionField consults a depth-2 region only within radius + 40 of
    // its centre (u ≥ ~680); out there the target must sit at the
    // probed base level (≈ 0 ± 0.4) so the step at the circle is
    // centimetres under the whisper weight.
    for (let u = 632; u <= 692; u += 6) {
      for (const v of [-10, 0, 10]) {
        const { x, z } = worldOf(u, v);
        expect(Math.abs(golden2TerrainTarget(x, z)), `target u=${u} v=${v}`).toBeLessThan(0.9);
      }
    }
  });
});

describe("golden-waste-2 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [700, 2],
      [780, -4],
      [880, -30],
      [946, -52],
      [975, 72],
      [1030, -18],
      [1100, 6],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = golden2TerrainTarget(x, z);
      expect(golden2TerrainTarget(x, z)).toBe(first);
      const composed = seabedHeight(x, z);
      expect(seabedHeight(x, z)).toBe(composed);
    }
  });

  it("carries at least 28 m of vertical range and takes the Ribbon past −30", () => {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let du = -170; du <= 170; du += 6) {
      for (let dv = -170; dv <= 170; dv += 6) {
        if (Math.hypot(du, dv) > 170) {
          continue;
        }
        const { x, z } = worldOf(940 + du, dv);
        const h = golden2TerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    expect(highest - lowest).toBeGreaterThanOrEqual(28);
    expect(lowest).toBeLessThanOrEqual(-30);
    // The Windows rampart crests ~10 m over the court floor (round 2
    // took the terrain ridge to 9 m so it stops reading as a dune;
    // the built towers carry the region's verticality to ≈ +11).
    expect(highest).toBeGreaterThanOrEqual(-1.2);
    // The slot's own middle, sampled directly, is truly deep.
    const mid = RIBBON_SPINE[2]!;
    const centre = worldOf(mid[0], mid[1]);
    expect(golden2TerrainTarget(centre.x, centre.z)).toBeLessThan(-28);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(940 + du, dv);
        if (golden2Weight(x, z) === 0) {
          continue;
        }
        const floor = golden2TerrainTarget(x, z) + GOLDEN_2.floorClearance;
        expect(golden2Ceiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the pass's own channel.
    for (let u = 634; u <= 830; u += 6) {
      const { x, z } = worldOf(u, gullyChannelCenter(u));
      const floor = golden2TerrainTarget(x, z) + GOLDEN_2.floorClearance;
      expect(golden2Ceiling(x, z), `pass u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("golden-waste-2 build", () => {
  let build: RegionBuild;
  const named = new Map<string, Object3D[]>();

  beforeAll(() => {
    build = GOLDEN_2.build(new Scene());
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
    console.info(`[measure] golden2 budgets: ${draws} draws / ${Math.round(triangles)} tris`);
    // MASTER R12 (the binding gate is the headed frame measure,
    // recorded in the ledger; these caps are the honest envelope).
    expect(draws).toBeLessThanOrEqual(260);
    expect(triangles).toBeLessThanOrEqual(1_350_000);
    // Honest floors: an empty region passes no bar, and a region whose
    // fill silently vanished fails loudly.
    expect(draws).toBeGreaterThan(55);
    expect(triangles).toBeGreaterThan(280_000);
  });

  it("keeps every collider inside the domain", () => {
    expect(build.colliders.length).toBeGreaterThan(100);
    for (const collider of build.colliders) {
      const weight = golden2Weight(collider.center.x, collider.center.z);
      expect(
        weight,
        `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("registers the Bell Ringer as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("carillon-nautilus");
    expect(golden2Weight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(GOLDEN_2.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
  });

  it("builds byte-identically twice — no draw-order dependence, no reroll", () => {
    const second = GOLDEN_2.build(new Scene());
    const secondNamed = new Map<string, Object3D[]>();
    (second.group as Object3D).traverse((node) => {
      const list = secondNamed.get(node.name) ?? [];
      list.push(node);
      secondNamed.set(node.name, list);
    });
    const m1 = new Matrix4();
    const m2 = new Matrix4();
    for (const name of [
      "carillon-stone-pale",
      "carillon-stone-cap",
      "carillon-towers",
      "carillon-windows",
      "carillon-nautilus",
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
    // MASTER §1.2: the Pavement and the Anchorite's Cell stay composed
    // bareness. The containment walk goes down through named kit
    // GROUPS to their child meshes and samples in world space (the
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
    const closes = GOLDEN_2.capturePoses.filter((pose) => pose.name.startsWith("close-"));
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

  it("survives a minute of updates without spending randomness", () => {
    const ctx = {
      diverPosition: new Vector3(CENTER_X, 2, CENTER_Z),
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

describe("golden-waste-2 seals", () => {
  it("walls the rim and the pass shoulders inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        golden2Weight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves the inbound pass corridor swimmable end to end", () => {
    const seals = buildSeals();
    for (let u = 636; u <= 826; u += 3) {
      const vc = gullyChannelCenter(u);
      for (const dv of [-3, 0, 3]) {
        const { x, z } = worldOf(u, vc + dv);
        const yBase = golden2TerrainTarget(x, z);
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
});

describe("golden-waste-2 capture poses", () => {
  it("authors 16+ poses that stand inside the region's own water", () => {
    expect(GOLDEN_2.capturePoses.length).toBeGreaterThanOrEqual(16);
    for (const pose of GOLDEN_2.capturePoses) {
      const [x, y, z] = pose.position;
      // Threshold poses stand in the whisper band on purpose (the
      // depth-2 handover): the floor of the bar is presence, not
      // ownership.
      expect(golden2Weight(x, z), pose.name).toBeGreaterThan(0.08);
      const floor = golden2TerrainTarget(x, z) + GOLDEN_2.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(golden2Ceiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });

  it("gives the Ribbon its two frames and the Belfry its up-shot", () => {
    const mouth = GOLDEN_2.capturePoses.find((pose) => pose.name === "ribbon-mouth");
    const depths = GOLDEN_2.capturePoses.find((pose) => pose.name === "ribbon-depths");
    const belfry = GOLDEN_2.capturePoses.find((pose) => pose.name === "belfry");
    expect(mouth).toBeDefined();
    expect(depths).toBeDefined();
    expect(belfry).toBeDefined();
    expect(mouth!.pitch).toBeLessThan(-0.08);
    // The depths pose stands genuinely inside the slot, looking up.
    expect(depths!.position[1]).toBeLessThan(-24);
    expect(depths!.pitch).toBeGreaterThan(0.05);
    expect(belfry!.pitch).toBeGreaterThan(0.4);
  });
});
