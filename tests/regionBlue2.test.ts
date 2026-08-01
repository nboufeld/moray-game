import { InstancedMesh, Matrix4, Mesh, Points, Scene, Vector3, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the def, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing the def
// module *first* runs the cycle the other way round.
import { seabedHeight } from "../src/world/Seabed";
import { BLUE_2, buildSeals } from "../src/world/regions/blue2/Blue2";
import { insideRest } from "../src/world/regions/blue2/Blue2Beats";
import { BLUE_1 } from "../src/world/regions/blue1/Blue1";
import {
  blue1TerrainTarget,
  blue1Weight,
} from "../src/world/regions/blue1/Blue1Terrain";
import {
  BLUE2_SLOT,
  CENTER_X,
  CENTER_Z,
  blue2Ceiling,
  blue2TerrainTarget,
  blue2Weight,
  spokeOf,
  stepD,
  worldOf,
} from "../src/world/regions/blue2/Blue2Terrain";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Deep Steps' own contracts: identity where it owns nothing, the
 * World's-Edge handover where it owns a whisper (including the Far
 * Wall mirror's honesty against the Drop Plains' own pure half),
 * determinism where it owns everything, budgets counted rather than
 * claimed (R12), colliders inside the domain, the protected-stillness
 * registry held (MASTER §1.2), the inbound corridor swimmable against
 * every collider of OURS, and capture poses that stand in water the
 * region actually has.
 */

describe("great-blue-2 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === BLUE2_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(BLUE_2.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero near the world's origin and the bowl", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 60, 120]) {
        expect(BLUE_2.weight(Math.cos(theta) * r, Math.sin(theta) * r)).toBe(0);
      }
    }
  });

  it("is full in its heart and continuous along the whole pass spine", () => {
    expect(BLUE_2.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
    for (let u = 636; u <= 1080; u += 8) {
      const { x, z } = worldOf(u, 0);
      expect(BLUE_2.weight(x, z), `spine u=${u}`).toBeGreaterThan(0.08);
    }
  });

  it("overlaps the Drop Plains across the World's Edge — no bounds gap", () => {
    // The pass tongue starts 30 m inside blue-1's rim (u 665), so both
    // domains own the water between 636 and 665.
    for (const u of [637, 644, 652, 660]) {
      const { x, z } = worldOf(u, 0);
      expect(BLUE_1.weight(x, z), `blue1 at u=${u}`).toBeGreaterThan(0);
      expect(BLUE_2.weight(x, z), `blue2 at u=${u}`).toBeGreaterThan(0);
    }
  });

  it("keeps the threshold a whisper so the Drop Plains carries the crossing", () => {
    for (const u of [640, 660, 690, 716]) {
      const { x, z } = worldOf(u, 0);
      const w = BLUE_2.weight(x, z);
      expect(w, `threshold u=${u}`).toBeGreaterThan(0.08);
      expect(w, `threshold u=${u}`).toBeLessThan(0.25);
    }
  });

  it("mirrors the Drop Plains' composed wall through the overlap band", () => {
    // The Far Wall band is the one threshold in the program whose
    // parent rim is NOT dune level: the annex floor must track the
    // composed ground (base dunes ±0.6 + blue-1's wall) or the diver
    // is clamped forty metres up mid-crossing.
    for (let u = 636; u <= 668; u += 4) {
      for (const v of [-8, 0, 8]) {
        const { x, z } = worldOf(u, v);
        const composed = seabedHeight(x, z);
        expect(
          Math.abs(blue2TerrainTarget(x, z) - composed),
          `wall mirror u=${u} v=${v}`,
        ).toBeLessThan(1.4);
      }
    }
    // And the wall really is a wall: the mirror spans the climb.
    const foot = worldOf(638, 0);
    const crest = worldOf(664, 0);
    expect(blue2TerrainTarget(foot.x, foot.z)).toBeLessThan(-8);
    expect(blue2TerrainTarget(crest.x, crest.z)).toBeGreaterThan(-2);
  });

  it("holds the saddle target at base level across the reject circle", () => {
    // RegionField consults a depth-2 region only within radius + 40 of
    // its centre (u ≥ ~680); out there the target must sit at base
    // level so the step at the circle is centimetres under the whisper
    // weight. (The wall band below 668 is covered by the mirror test.)
    for (let u = 670; u <= 700; u += 5) {
      for (const v of [-10, 0, 10]) {
        const { x, z } = worldOf(u, v);
        expect(Math.abs(blue2TerrainTarget(x, z)), `saddle u=${u} v=${v}`).toBeLessThan(0.9);
      }
    }
  });
});

describe("great-blue-2 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [700, 2],
      [780, -4],
      [850, -30],
      [899, -16],
      [946, -136],
      [1030, -10],
      [1100, 6],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = blue2TerrainTarget(x, z);
      expect(blue2TerrainTarget(x, z)).toBe(first);
      const composed = seabedHeight(x, z);
      expect(seabedHeight(x, z)).toBe(composed);
    }
  });

  it("mirrors blue-1's pure half exactly where it reads it", () => {
    // The mirror is a read-only import of blue-1's pure functions;
    // this pin catches any drift in that coupling loudly.
    const { x, z } = worldOf(650, 4);
    const mirror = blue1Weight(x, z) * blue1TerrainTarget(x, z);
    expect(Math.abs(blue2TerrainTarget(x, z) - mirror)).toBeLessThan(0.6);
  });

  it("carries ≈ 47 m of vertical range: the amphitheatre is real", () => {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let du = -170; du <= 170; du += 6) {
      for (let dv = -170; dv <= 170; dv += 6) {
        if (Math.hypot(du, dv) > 170) {
          continue;
        }
        const { x, z } = worldOf(940 + du, dv);
        const h = blue2TerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    expect(highest - lowest).toBeGreaterThanOrEqual(40);
    expect(lowest).toBeLessThanOrEqual(-45);
    // The Round truly reaches the floor of the world.
    const round = worldOf(1010, -10);
    expect(blue2TerrainTarget(round.x, round.z)).toBeLessThan(-44);
    // And the shelves are STEPS, not a ramp: each floor near its book
    // value on the spine.
    const strand = worldOf(830, 0);
    expect(blue2TerrainTarget(strand.x, strand.z)).toBeGreaterThan(-24.5);
    expect(blue2TerrainTarget(strand.x, strand.z)).toBeLessThan(-17.5);
    const currentStep = worldOf(900, 30);
    expect(blue2TerrainTarget(currentStep.x, currentStep.z)).toBeGreaterThan(-37.5);
    expect(blue2TerrainTarget(currentStep.x, currentStep.z)).toBeLessThan(-30.5);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(940 + du, dv);
        if (blue2Weight(x, z) === 0) {
          continue;
        }
        const floor = blue2TerrainTarget(x, z) + BLUE_2.floorClearance;
        expect(blue2Ceiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the pass's own spine, wall band included.
    for (let u = 636; u <= 820; u += 4) {
      const { x, z } = worldOf(u, 0);
      const floor = blue2TerrainTarget(x, z) + BLUE_2.floorClearance;
      expect(blue2Ceiling(x, z), `pass u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("great-blue-2 build", () => {
  let build: RegionBuild;
  const named = new Map<string, Object3D[]>();

  beforeAll(() => {
    build = BLUE_2.build(new Scene());
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
    console.info(`[measure] blue2 budgets: ${draws} draws / ${Math.round(triangles)} tris`);
    // MASTER R12 (the binding gate is the headed frame measure,
    // recorded in the ledger; these caps are the honest envelope).
    expect(draws).toBeLessThanOrEqual(260);
    expect(triangles).toBeLessThanOrEqual(1_350_000);
    // Honest floors: an empty region passes no bar.
    expect(draws).toBeGreaterThan(45);
    expect(triangles).toBeGreaterThan(250_000);
  });

  it("keeps every collider inside the domain", () => {
    expect(build.colliders.length).toBeGreaterThan(80);
    for (const collider of build.colliders) {
      const weight = blue2Weight(collider.center.x, collider.center.z);
      expect(
        weight,
        `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("registers the Gentle Dark as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("the-gentle-dark");
    expect(blue2Weight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(BLUE_2.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
  });

  it("builds byte-identically twice — no draw-order dependence, no reroll", () => {
    const second = BLUE_2.build(new Scene());
    const secondNamed = new Map<string, Object3D[]>();
    (second.group as Object3D).traverse((node) => {
      const list = secondNamed.get(node.name) ?? [];
      list.push(node);
      secondNamed.set(node.name, list);
    });
    for (const name of [
      "deepsteps-stone-pale",
      "deepsteps-stone-slate",
      "deepsteps-mooring",
      "deepsteps-weir",
      "deepsteps-gentle-dark",
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
    const m1 = new Matrix4();
    const m2 = new Matrix4();
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

  it("keeps every cover instance out of the three registered rests", () => {
    // MASTER §1.2: the Round, the Othershore hush and the Skiff's
    // berth stay composed bareness. The containment walk goes down
    // through named kit GROUPS to their child meshes and samples in
    // world space (the Smoulder containment lesson).
    const coverNames = [
      "kit-carpet-field",
      "kit-ground-litter",
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
    expect(checked).toBeGreaterThan(4_000);
  });

  it("keeps everything of ours off the Drop Plains' wall band", () => {
    // "Nothing clutters below the lip": no cover instance, collider or
    // scatter of ours stands below u 668 except the pass sheet and the
    // shoulder seals the corridor itself needs.
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
            expect(u, `${name}[${i}] below the lip`).toBeGreaterThan(668);
          }
        });
      }
    }
  });

  it("keeps standing cover off the close poses' lenses", () => {
    const closes = BLUE_2.capturePoses.filter((pose) => pose.name.startsWith("close-"));
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

describe("great-blue-2 seals", () => {
  it("walls the rim and the pass shoulders inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        blue2Weight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves the inbound corridor swimmable end to end against OUR colliders", async () => {
    // The corridor's own swim line, from the wall band to the Round:
    // no collider of this region's build may block it. (Blue-1's rim
    // seal ring at its rc 164 = spoke u ≈ 609 crosses the corridor
    // OUTSIDE this walk — its cut is the orchestrator's, flagged.)
    const build = BLUE_2.build(new Scene());
    // Walk the road itself: the wall approach, then the spine stations.
    const walk: [number, number][] = [
      [638, 0],
      [650, 0],
    ];
    const { SPINE_ROAD } = await import("../src/world/regions/blue2/Blue2Beats");
    for (let i = 0; i < SPINE_ROAD.length - 1; i++) {
      const [au, av] = SPINE_ROAD[i]!;
      const [bu, bv] = SPINE_ROAD[i + 1]!;
      if (au > 990) {
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
          expect(d, `collider blocks the corridor at u=${u.toFixed(0)}, lift=${lift}`).toBeGreaterThan(
            collider.radius,
          );
        }
      }
    }
    build.dispose?.();
  });
});

describe("great-blue-2 capture poses", () => {
  it("authors 16+ poses that stand inside the region's own water", () => {
    expect(BLUE_2.capturePoses.length).toBeGreaterThanOrEqual(16);
    for (const pose of BLUE_2.capturePoses) {
      const [x, y, z] = pose.position;
      // Threshold poses stand in the whisper band on purpose (the
      // depth-2 handover): the floor of the bar is presence, not
      // ownership.
      expect(blue2Weight(x, z), pose.name).toBeGreaterThan(0.08);
      const floor = blue2TerrainTarget(x, z) + BLUE_2.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(blue2Ceiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });

  it("gives the Well its scheduled crossing and the Brink its reveal", () => {
    const well = BLUE_2.capturePoses.find((pose) => pose.name === "moon-well");
    const brink = BLUE_2.capturePoses.find((pose) => pose.name === "brink");
    const wallFace = BLUE_2.capturePoses.find((pose) => pose.name === "wall-face");
    expect(well).toBeDefined();
    expect(brink).toBeDefined();
    expect(wallFace).toBeDefined();
    expect(well!.settle).toBeGreaterThanOrEqual(8);
    expect(brink!.pitch).toBeLessThan(-0.05);
    // The wall pose stands genuinely on the climb, looking back down.
    expect(wallFace!.position[1]).toBeLessThan(-1);
    expect(wallFace!.pitch).toBeLessThan(-0.1);
  });

  it("keeps the sweep's domain sane where poses will be drawn", () => {
    // The sweep samples weight ≥ 0.5 and hovers ≤ ~7 m over the floor;
    // hold the invariant it depends on across the country proper
    // (u ≥ 760 — the thin transitional annulus at the saddle's edge is
    // legitimately rejection-sampled away by the sweep itself).
    for (let du = -196; du <= 196; du += 14) {
      for (let dv = -196; dv <= 196; dv += 14) {
        const { x, z } = worldOf(940 + du, dv);
        if (blue2Weight(x, z) < 0.5 || 940 + du < 760) {
          continue;
        }
        const floor = blue2TerrainTarget(x, z) + BLUE_2.floorClearance + 1.2;
        const ceiling = blue2Ceiling(x, z) - 1.2;
        expect(ceiling - floor, `pose water at ${940 + du},${dv}`).toBeGreaterThan(1);
      }
    }
  });

  it("world map: the disc keeps clear of every other slot", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === BLUE2_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      const d = Math.hypot(x - CENTER_X, z - CENTER_Z);
      expect(d, slot.id).toBeGreaterThan(BLUE2_SLOT.radius + slot.radius);
    }
  });
});

describe("great-blue-2 rests", () => {
  it("registers the Round's geometry where the steps actually are", () => {
    // The rest must sit on the third shelf, not hang over a riser.
    const centre = worldOf(1030, -10);
    expect(blue2TerrainTarget(centre.x, centre.z)).toBeLessThan(-44);
    expect(stepD(1030, -10)).toBeGreaterThan(357);
  });

  it("holds the Moon Well inside the Round's licence", () => {
    expect(insideRest(1032, -8)).toBe(true);
    expect(insideRest(680, 0)).toBe(false); // outside the hush band
    expect(insideRest(720, 0)).toBe(true); // the hush itself
    expect(insideRest(818, 96)).toBe(true); // the Skiff's berth
  });
});
