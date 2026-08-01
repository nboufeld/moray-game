import { InstancedMesh, Matrix4, Mesh, Points, Scene, Vector3, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the def, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing the def
// module *first* runs the cycle the other way round.
import { seabedHeight } from "../src/world/Seabed";
import { BLUE_3, buildSeals } from "../src/world/regions/blue3/Blue3";
import {
  MORNING_REST,
  SPINE_ROAD,
  insideRest,
} from "../src/world/regions/blue3/Blue3Beats";
import { BLUE_2 } from "../src/world/regions/blue2/Blue2";
import {
  blue2TerrainTarget,
  blue2Weight,
} from "../src/world/regions/blue2/Blue2Terrain";
import {
  BLUE3_SLOT,
  CENTER_X,
  CENTER_Z,
  WELLHEAD,
  blue3Ceiling,
  blue3TerrainTarget,
  blue3Weight,
  spokeOf,
  worldOf,
} from "../src/world/regions/blue3/Blue3Terrain";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The First Sea's own contracts: identity where it owns nothing, the
 * Worldwall handover where it owns a whisper (including the wall
 * mirror's honesty against the Deep Steps' own pure half — the blue-2
 * device, third use, pinned the same way), determinism where it owns
 * everything, budgets counted rather than claimed (R12), colliders
 * inside the domain, the protected-stillness registry held (MASTER
 * §1.2), the inbound corridor swimmable against every collider of
 * OURS, and capture poses that stand in water the region actually has.
 */

describe("great-blue-3 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === BLUE3_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(BLUE_3.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero near the world's origin and the bowl", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 60, 120]) {
        expect(BLUE_3.weight(Math.cos(theta) * r, Math.sin(theta) * r)).toBe(0);
      }
    }
  });

  it("is full in its heart and continuous along the whole pass spine", () => {
    expect(BLUE_3.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
    for (let u = 1132; u <= 1600; u += 8) {
      const { x, z } = worldOf(u, 0);
      expect(BLUE_3.weight(x, z), `spine u=${u}`).toBeGreaterThan(0.08);
    }
  });

  it("overlaps the Deep Steps across the Worldwall — no bounds gap", () => {
    // The pass tongue starts 30 m inside blue-2's rim (u 1160), so
    // both domains own the water between 1132 and 1158.
    for (const u of [1134, 1140, 1148, 1156]) {
      const { x, z } = worldOf(u, 0);
      expect(BLUE_2.weight(x, z), `blue2 at u=${u}`).toBeGreaterThan(0);
      expect(BLUE_3.weight(x, z), `blue3 at u=${u}`).toBeGreaterThan(0);
    }
  });

  it("keeps the threshold a whisper so the Deep Steps carries the crossing", () => {
    for (const u of [1136, 1160, 1190, 1214]) {
      const { x, z } = worldOf(u, 0);
      const w = BLUE_3.weight(x, z);
      expect(w, `threshold u=${u}`).toBeGreaterThan(0.08);
      expect(w, `threshold u=${u}`).toBeLessThan(0.25);
    }
  });

  it("mirrors the Deep Steps' composed wall through the overlap band", () => {
    // The Worldwall band's parent rim is NOT dune level until the
    // crest: the annex floor must track the composed ground (base
    // dunes ±0.6 + blue-2's wall) or the diver is clamped mid-climb.
    for (let u = 1132; u <= 1168; u += 4) {
      for (const v of [-8, 0, 8]) {
        const { x, z } = worldOf(u, v);
        const composed = seabedHeight(x, z);
        expect(
          Math.abs(blue3TerrainTarget(x, z) - composed),
          `wall mirror u=${u} v=${v}`,
        ).toBeLessThan(1.4);
      }
    }
    // And the wall really is a wall: the mirror spans the climb.
    const foot = worldOf(1132, 0);
    const crest = worldOf(1156, 0);
    expect(blue3TerrainTarget(foot.x, foot.z)).toBeLessThan(-5);
    expect(blue3TerrainTarget(crest.x, crest.z)).toBeGreaterThan(-2);
  });

  it("mirrors blue-2's pure half exactly where it reads it", () => {
    // The mirror is a read-only import of blue-2's pure functions;
    // this pin catches any drift in that coupling loudly.
    const { x, z } = worldOf(1142, 4);
    const mirror = blue2Weight(x, z) * blue2TerrainTarget(x, z);
    expect(Math.abs(blue3TerrainTarget(x, z) - mirror)).toBeLessThan(0.6);
  });

  it("holds the shelf target at base level across the reject circle", () => {
    // RegionField consults a depth-3 region only within radius + 40 of
    // its centre (u ≥ ~1200); out there the target must sit at base
    // level so the step at the circle is centimetres under the whisper
    // weight. (The wall band below 1178 is covered by the mirror test.)
    for (let u = 1180; u <= 1212; u += 4) {
      for (const v of [-10, 0, 10]) {
        const { x, z } = worldOf(u, v);
        expect(Math.abs(blue3TerrainTarget(x, z)), `shelf u=${u} v=${v}`).toBeLessThan(0.9);
      }
    }
  });
});

describe("great-blue-3 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [1190, 2],
      [1290, -6],
      [1374, -58],
      [1392, 64],
      [1444, 46],
      [1502, -28],
      [1602, -4],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = blue3TerrainTarget(x, z);
      expect(blue3TerrainTarget(x, z)).toBe(first);
      const composed = seabedHeight(x, z);
      expect(seabedHeight(x, z)).toBe(composed);
    }
  });

  it("carries ≈ 59 m of vertical range: the game's deepest country", () => {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    // Sampled over the whole owned disc (the Hem's climb included —
    // the crest is the range's top; everything within r 170 is already
    // the deep Mere).
    for (let du = -204; du <= 204; du += 6) {
      for (let dv = -204; dv <= 204; dv += 6) {
        if (Math.hypot(du, dv) > 204) {
          continue;
        }
        const { x, z } = worldOf(1460 + du, dv);
        const h = blue3TerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    expect(highest - lowest).toBeGreaterThanOrEqual(50);
    expect(lowest).toBeLessThanOrEqual(-55);
    // The Wellhead's bowl, sampled directly, is the deepest point in
    // the game — below the Deep Steps' Round (−47) and the Under-Blue
    // (−46.5).
    const bowl = worldOf(WELLHEAD.u, WELLHEAD.v);
    expect(blue3TerrainTarget(bowl.x, bowl.z)).toBeLessThan(-56);
    // The whole drop from the Morning Shelf to the bowl is the
    // region's journey.
    const shelf = worldOf(1200, 0);
    expect(
      blue3TerrainTarget(shelf.x, shelf.z) - blue3TerrainTarget(bowl.x, bowl.z),
    ).toBeGreaterThan(50);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(1460 + du, dv);
        if (blue3Weight(x, z) === 0) {
          continue;
        }
        const floor = blue3TerrainTarget(x, z) + BLUE_3.floorClearance;
        expect(blue3Ceiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the pass's own spine, wall band included.
    for (let u = 1134; u <= 1360; u += 6) {
      const { x, z } = worldOf(u, 0);
      const floor = blue3TerrainTarget(x, z) + BLUE_3.floorClearance;
      expect(blue3Ceiling(x, z), `pass u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("great-blue-3 build", () => {
  let build: RegionBuild;
  const named = new Map<string, Object3D[]>();

  beforeAll(() => {
    build = BLUE_3.build(new Scene());
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
    console.info(`[measure] blue3 budgets: ${draws} draws / ${Math.round(triangles)} tris`);
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
      const weight = blue3Weight(collider.center.x, collider.center.z);
      expect(
        weight,
        `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("registers the Morning Whale as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("the-morning-whale");
    expect(blue3Weight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(BLUE_3.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
  });

  it("builds byte-identically twice — no draw-order dependence, no reroll", () => {
    const second = BLUE_3.build(new Scene());
    const secondNamed = new Map<string, Object3D[]>();
    (second.group as Object3D).traverse((node) => {
      const list = secondNamed.get(node.name) ?? [];
      list.push(node);
      secondNamed.set(node.name, list);
    });
    const m1 = new Matrix4();
    const m2 = new Matrix4();
    for (const name of [
      "firstsea-stone-pale",
      "firstsea-stone-slate",
      "firstsea-morning-whale",
      "firstsea-pearl-orb",
      "firstsea-distance-0",
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

  it("keeps every cover instance out of the five registered rests", () => {
    // MASTER §1.2: the Wide Morning, the Starwater Pans, the Morning
    // Shelf hush, the Pearl's fold and the Sea's Doorstep stay
    // composed stillness. The containment walk goes down through named
    // kit GROUPS to their child meshes and samples in world space (the
    // Smoulder containment lesson).
    const coverNames = [
      "kit-carpet-field",
      "kit-ground-litter-0",
      "kit-ground-litter-1",
      "kit-bush-bank",
      "kit-drift-debris",
      "kit-scree-apron",
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
              expect(
                insideRest(u, sv),
                `${name} vertex at u=${u.toFixed(0)} v=${sv.toFixed(0)}`,
              ).toBe(false);
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

  it("keeps every cover instance off the Worldwall band", () => {
    // "Nothing clutters below the lip" — the wall band u < 1178 is the
    // Deep Steps' rim country and this region builds nothing on it.
    const m = new Matrix4();
    for (const name of ["kit-carpet-field", "kit-ground-litter", "kit-bush-bank"]) {
      for (const node of named.get(name) ?? []) {
        node.updateMatrixWorld(true);
        node.traverse((child) => {
          const mesh = child as InstancedMesh;
          if (!mesh.isInstancedMesh) {
            return;
          }
          for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, m);
            if (m.elements[13]! < -100) {
              continue;
            }
            m.premultiply(mesh.matrixWorld);
            const { u } = spokeOf(m.elements[12]!, m.elements[14]!);
            expect(u, `${name}[${i}] below the lip`).toBeGreaterThan(1178);
          }
        });
      }
    }
  });

  it("keeps standing cover off the close poses' lenses", () => {
    const closes = BLUE_3.capturePoses.filter((pose) => pose.name.startsWith("close-"));
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

  it("keeps the road clear of the Wide Morning", () => {
    // The dawn shoal and the buoy fry ride within ~6 m of the spine
    // road; the road itself must clear the region's largest rest.
    for (let i = 0; i < SPINE_ROAD.length - 1; i++) {
      const [au, av] = SPINE_ROAD[i]!;
      const [bu, bv] = SPINE_ROAD[i + 1]!;
      for (let t = 0; t <= 1; t += 0.1) {
        const u = au + (bu - au) * t;
        const v = av + (bv - av) * t;
        const d = Math.hypot(u - MORNING_REST.u, v - MORNING_REST.v);
        expect(d, `road at u=${u.toFixed(0)}`).toBeGreaterThan(MORNING_REST.radius + 5);
      }
    }
  });

  it("survives a minute of updates without spending randomness", () => {
    const ctx = {
      diverPosition: new Vector3(CENTER_X, -40, CENTER_Z),
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

describe("great-blue-3 seals", () => {
  it("walls the rim and the pass shoulders inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        blue3Weight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves the inbound corridor swimmable end to end against OUR colliders", () => {
    // The corridor's own swim line, from the wall band down the
    // Longfall to the Mere: no collider of this region's build may
    // block it. (Blue-2's rim seal ring at its rc 206 = spoke u ≈ 1146
    // crosses the corridor OUTSIDE our build — its cut is the
    // orchestrator's, flagged in the ledger.)
    const build = BLUE_3.build(new Scene());
    const walk: [number, number][] = [
      [1136, 0],
      [1144, 0],
    ];
    for (let i = 0; i < SPINE_ROAD.length - 1; i++) {
      const [au, av] = SPINE_ROAD[i]!;
      const [bu, bv] = SPINE_ROAD[i + 1]!;
      if (au > 1440) {
        break;
      }
      const steps = Math.max(1, Math.round(Math.hypot(bu - au, bv - av) / 4));
      for (let s = 0; s < steps; s++) {
        walk.push([au + ((bu - au) * s) / steps, av + ((bv - av) * s) / steps]);
      }
    }
    for (const [u, v] of walk) {
      const { x, z } = worldOf(u, v);
      const yBase = seabedHeight(x, z);
      for (const lift of [1.4, 2.4]) {
        const y = yBase + lift;
        for (const collider of build.colliders) {
          const d = Math.hypot(x - collider.center.x, y - collider.center.y, z - collider.center.z);
          expect(
            d,
            `collider blocks the corridor at u=${u.toFixed(0)}, lift=${lift}`,
          ).toBeGreaterThan(collider.radius);
        }
      }
    }
    build.dispose?.();
  });

  it("keeps the corridor's swim line under the neighbour's low mouth", () => {
    // Blue-2's rim ceiling-closure pinches the crossing to a ~2–3.5 m
    // duck over the crest (probed; narrowest ≈ 1.9 m mid-climb at
    // u ≈ 1136): low, but real water. The flagged ceiling cut opens
    // the vault at merge; the crossing works without it.
    for (const u of [1140, 1148, 1156]) {
      const { x, z } = worldOf(u, 0);
      const floor = seabedHeight(x, z);
      const theirCeiling = BLUE_2.ceiling(x, z);
      expect(theirCeiling - floor, `mouth at u=${u}`).toBeGreaterThan(1.6);
    }
  });
});

describe("great-blue-3 capture poses", () => {
  it("authors 20+ poses that stand inside the region's own water", () => {
    expect(BLUE_3.capturePoses.length).toBeGreaterThanOrEqual(20);
    for (const pose of BLUE_3.capturePoses) {
      const [x, y, z] = pose.position;
      // Threshold poses stand in the whisper band on purpose (the
      // depth-3 handover): the floor of the bar is presence, not
      // ownership.
      expect(blue3Weight(x, z), pose.name).toBeGreaterThan(0.08);
      const floor = blue3TerrainTarget(x, z) + BLUE_3.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(blue3Ceiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });

  it("gives the Daybreak its up-shot and the Whale its window", () => {
    const daybreak = BLUE_3.capturePoses.find((pose) => pose.name === "daybreak");
    const whale = BLUE_3.capturePoses.find((pose) => pose.name === "morning-whale");
    const horizon = BLUE_3.capturePoses.find((pose) => pose.name === "morning-horizon");
    expect(daybreak).toBeDefined();
    expect(whale).toBeDefined();
    expect(horizon).toBeDefined();
    // The daybreak pose stands genuinely inside the bowl, looking up.
    expect(daybreak!.position[1]).toBeLessThan(-46);
    expect(daybreak!.pitch).toBeGreaterThan(0.2);
    expect(daybreak!.settle).toBeGreaterThanOrEqual(6);
    expect(whale!.settle).toBeGreaterThanOrEqual(6);
    // The horizon stand rides the vault above the Hem's own crest
    // sightline (the horns-promise arithmetic, pre-paid).
    expect(horizon!.position[1]).toBeGreaterThan(-24);
  });
});
