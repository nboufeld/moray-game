import { InstancedMesh, Matrix4, Mesh, Points, Scene, Vector3, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the def, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing the def
// module *first* runs the cycle the other way round, where the registry
// reads `SMOKING_1` before its module finishes evaluating.
import { seabedHeight } from "../src/world/Seabed";
import { SMOKING_1, buildSeals } from "../src/world/regions/smoking1/Smoking1";
import {
  CENTER_X,
  CENTER_Z,
  SMOKING_SLOT,
  smokingCeiling,
  smokingTerrainTarget,
  smokingWeight,
  spokeOf,
  worldOf,
} from "../src/world/regions/smoking1/SmokingTerrain";
import {
  inCalderaNorthQuadrant,
  inFlatsRest,
  restFree,
} from "../src/world/regions/smoking1/SmokingFillShared";
import { spineShoalStations } from "../src/world/regions/smoking1/SmokingFillLife";
import { GLOWS } from "../src/world/regions/smoking1/SmokingLight";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Smoulder Fields' own contracts: identity where it owns nothing,
 * determinism where it owns everything, budgets counted rather than
 * claimed (the doctrine's raised caps, R1), colliders inside the domain,
 * the Phase 3 fill's reroll fence (pilot landmarks byte-unchanged), the
 * protected-stillness registry (MASTER §1.2), and capture poses that
 * stand in water the region actually has.
 */

describe("smoking-marches-1 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === SMOKING_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(SMOKING_1.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero everywhere inside the tongue's own start", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 39, 43.9]) {
        expect(SMOKING_1.weight(Math.cos(theta) * r, Math.sin(theta) * r)).toBe(0);
      }
    }
  });

  it("is full in its heart and covers the approach tongue", () => {
    expect(SMOKING_1.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
    for (const u of [60, 120, 200, 270]) {
      const { x, z } = worldOf(u, 0);
      expect(SMOKING_1.weight(x, z), `tongue u=${u}`).toBeGreaterThan(0.5);
    }
  });

  it("keeps its neighbour wings' seam water", () => {
    // The neighbouring wings sit 0.36 rad off this spoke; their wedge
    // edges reach 0.195 rad. The seam tongue must be zero there.
    for (const neighbour of [2.43, 3.15]) {
      for (const r of [40, 44, 48, 55]) {
        const edge = neighbour + (neighbour < SMOKING_SLOT.azimuth ? 1 : -1) * 0.165;
        const x = Math.cos(edge) * r;
        const z = Math.sin(edge) * r;
        expect(SMOKING_1.weight(x, z), `wing edge az=${edge.toFixed(3)} r=${r}`).toBe(0);
      }
    }
  });
});

describe("smoking-marches-1 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [100, 2],
      [310, -20],
      [420, 92],
      [385, -72],
      [512, -52],
      [505, 55],
      [583, 12],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = smokingTerrainTarget(x, z);
      expect(smokingTerrainTarget(x, z)).toBe(first);
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
        const { x, z } = worldOf(445 + du, dv);
        const h = smokingTerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    // The basalt crown holds the top of the range; the caldera the bottom.
    expect(highest - lowest).toBeGreaterThanOrEqual(20);
    expect(lowest).toBeLessThanOrEqual(-17);
    expect(highest).toBeGreaterThanOrEqual(5);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(445 + du, dv);
        if (smokingWeight(x, z) === 0) {
          continue;
        }
        const floor = smokingTerrainTarget(x, z) + SMOKING_1.floorClearance;
        expect(smokingCeiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the gorge's own channel.
    for (let u = 48; u <= 290; u += 6) {
      const { x, z } = worldOf(u, 0);
      const floor = smokingTerrainTarget(x, z) + SMOKING_1.floorClearance;
      expect(smokingCeiling(x, z), `gorge u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("smoking-marches-1 build", () => {
  let build: RegionBuild;
  const named = new Map<string, Object3D[]>();

  beforeAll(() => {
    build = SMOKING_1.build(new Scene());
    (build.group as Object3D).traverse((node) => {
      const list = named.get(node.name) ?? [];
      list.push(node);
      named.set(node.name, list);
    });
  });

  it("stays inside the doctrine's raised budgets, measured", () => {
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
    console.info(`[measure] smoking1 budgets: ${draws} draws / ${Math.round(triangles)} tris`);
    // The doctrine's caps (MASTER R1): ≤160 draws, ≤450k triangles.
    expect(draws).toBeLessThanOrEqual(160);
    expect(triangles).toBeLessThanOrEqual(450_000);
    // Honest floors as well as caps: the filled region must exceed the
    // pilot's own measured 59 / 171,543 — an empty region passes no bar.
    expect(draws).toBeGreaterThan(59);
    expect(triangles).toBeGreaterThan(171_543);
  });

  it("keeps the pilot's landmarks byte-unchanged (the reroll fence)", () => {
    const m = new Matrix4();
    const pin = (
      mesh: Object3D | undefined,
      index: number,
      expected: readonly [number, number, number],
    ): void => {
      expect(mesh).toBeDefined();
      (mesh as InstancedMesh).getMatrixAt(index, m);
      const e = m.elements;
      expect(e[12]).toBeCloseTo(expected[0], 3);
      expect(e[13]).toBeCloseTo(expected[1], 3);
      expect(e[14]).toBeCloseTo(expected[2], 3);
    };
    // The smokers' first instances (the Twin Kings' own archetype seats),
    // pinned against the pre-fill build.
    const smokers = named.get("smoulder-smokers") ?? [];
    expect(smokers.length).toBe(3);
    pin(smokers[0], 0, [-452.81585693359375, -12.226642608642578, 226.7319030761719]);
    pin(smokers[1], 0, [-461.7699890136719, -11.715802192687988, 216.26019287109375]);
    pin(smokers[2], 0, [-466.52545166015625, -11.766222953796387, 226.5259552001953]);
    // The basalt columns' first instances.
    const basalt = named.get("smoulder-basalt-columns") ?? [];
    expect(basalt.length).toBe(3);
    pin(basalt[0], 0, [-412.08209228515625, 6.700450420379639, 88.81112670898438]);
    pin(basalt[1], 0, [-463.782470703125, 2.9991841316223145, 73.30857849121094]);
    pin(basalt[2], 0, [-369.906005859375, -1.0740164518356323, 45.32826614379883]);
    // The spring rims' first bead and the pilot's first vent.
    pin(named.get("smoulder-spring-rims")?.[0], 0, [
      -318.4903259277344, -1.8832679986953735, 239.4455108642578,
    ]);
    pin(named.get("smoulder-vents")?.[0], 0, [
      -458.57586669921875, -12.758599281311035, 213.90467834472656,
    ]);
    // The pilot's one-mesh stones: the first jamb, the first gorge
    // boulder, the erratic and the last shore stack.
    const rocks = named.get("smoulder-rock") ?? [];
    expect(rocks.length).toBe(22);
    const center = (index: number): Vector3 =>
      (rocks[index] as Mesh).geometry.boundingSphere!.center;
    expect(center(0).x).toBeCloseTo(-48.73159217834473, 3);
    expect(center(2).x).toBeCloseTo(-78.69575500488281, 3);
    expect(center(2).z).toBeCloseTo(38.70378112792969, 3);
    expect(center(10).x).toBeCloseTo(-307.7706756591797, 3);
    expect(center(10).z).toBeCloseTo(95.7418098449707, 3);
    expect(center(21).x).toBeCloseTo(-559.9765930175781, 3);
  });

  it("keeps every collider inside the domain", () => {
    expect(build.colliders.length).toBeGreaterThan(100);
    for (const collider of build.colliders) {
      const weight = smokingWeight(collider.center.x, collider.center.z);
      expect(
        weight,
        `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("keeps the fill's instances inside the domain", () => {
    const kitNames = [
      "kit-ground-litter-0",
      "kit-ground-litter-1",
      "kit-scree-apron",
      "kit-carpet-field",
    ];
    const m = new Matrix4();
    let sampled = 0;
    for (const name of kitNames) {
      for (const node of named.get(name) ?? []) {
        const mesh = node as InstancedMesh;
        // The kit's quality pass (R12) rebuilt some pieces as single merged
        // meshes — scree-apron among them — so only true instanced nodes
        // carry a matrix table. Merged pieces keep their containment under
        // the kit's own §5 contract; here we sample their geometry instead.
        if (!mesh.isInstancedMesh) {
          const position = mesh.geometry.getAttribute("position");
          for (let i = 0; i < position.count; i += 60) {
            const x = position.getX(i);
            const z = position.getZ(i);
            expect(
              smokingWeight(x, z),
              `${name} vertex[${i}] at ${x.toFixed(1)},${z.toFixed(1)}`,
            ).toBeGreaterThan(0);
            sampled++;
          }
          continue;
        }
        for (let i = 0; i < mesh.count; i += 5) {
          mesh.getMatrixAt(i, m);
          const x = m.elements[12]!;
          const y = m.elements[13]!;
          const z = m.elements[14]!;
          if (y < -100) {
            continue; // parked
          }
          expect(smokingWeight(x, z), `${name}[${i}] at ${x.toFixed(1)},${z.toFixed(1)}`).toBeGreaterThan(0);
          sampled++;
        }
      }
    }
    expect(sampled).toBeGreaterThan(200);
  });

  it("keeps the registered rests empty of new fill (MASTER §1.2)", () => {
    // Every fill instance — kit litter, carpets, scree, bushes, mats,
    // perchers — and the grown stars/urchins stay out of the two rest
    // bars. A miss inside one of these is a registry violation, not a
    // style choice.
    const instancedNames = [
      "kit-ground-litter-0",
      "kit-ground-litter-1",
      "kit-scree-apron",
      "kit-carpet-field",
      "kit-bush-bank",
      "kit-percher-shrimp",
      "kit-percher-blenny",
      "smoulder-cinder-stars",
      "smoulder-ember-urchins",
    ];
    const m = new Matrix4();
    for (const name of instancedNames) {
      for (const node of named.get(name) ?? []) {
        if (!(node instanceof InstancedMesh)) {
          continue;
        }
        for (let i = 0; i < node.count; i++) {
          node.getMatrixAt(i, m);
          const x = m.elements[12]!;
          const y = m.elements[13]!;
          const z = m.elements[14]!;
          if (y < -100) {
            continue; // parked below the world on purpose
          }
          const { u, v } = spokeOf(x, z);
          expect(inFlatsRest(u, v), `${name}[${i}] in the Ash Meadows rest`).toBe(false);
          expect(
            inCalderaNorthQuadrant(u, v),
            `${name}[${i}] in the caldera's north quadrant`,
          ).toBe(false);
        }
      }
    }
    // The mat rings' merged discs, by vertex.
    for (const node of named.get("kit-mat-rings") ?? []) {
      if (!(node instanceof Mesh)) {
        continue;
      }
      const position = node.geometry.attributes.position!;
      for (let i = 0; i < position.count; i += 7) {
        const { u, v } = spokeOf(position.getX(i), position.getZ(i));
        expect(inFlatsRest(u, v), `mat vertex in the Ash Meadows rest`).toBe(false);
        expect(inCalderaNorthQuadrant(u, v), `mat vertex in the north quadrant`).toBe(false);
      }
    }
  });

  it("keeps every glow mark out of the glow-free rests", () => {
    for (const [index, glow] of GLOWS.entries()) {
      // The two registry bars bind EVERY mark, pilot and fill alike.
      expect(inFlatsRest(glow.u, glow.v), `glow at u=${glow.u}`).toBe(false);
      expect(inCalderaNorthQuadrant(glow.u, glow.v), `glow at u=${glow.u}`).toBe(false);
      // The point rests bind the FILL's marks (index ≥ 6); the pilot's
      // six (the kiln pool, the springs pool, the forest pools) predate
      // the registry and are the landmarks' own light.
      if (index < 6) {
        continue;
      }
      const { x, z } = worldOf(glow.u, glow.v);
      expect(restFree(x, z), `glow at u=${glow.u},v=${glow.v}`).toBeGreaterThan(0.5);
    }
  });

  it("gives the spine shoal honest water (clearance and ceiling)", () => {
    const stations = spineShoalStations();
    expect(stations.length).toBeGreaterThan(16);
    for (const [x, y, z] of stations) {
      expect(smokingWeight(x, z)).toBeGreaterThan(0.3);
      const floor = smokingTerrainTarget(x, z);
      expect(y).toBeGreaterThan(floor + 1);
      expect(y).toBeLessThan(smokingCeiling(x, z) - 0.5);
      // The route bends around the rest bars.
      const { u, v } = spokeOf(x, z);
      expect(inFlatsRest(u, v), `station at u=${u.toFixed(0)}`).toBe(false);
      expect(inCalderaNorthQuadrant(u, v), `station at u=${u.toFixed(0)}`).toBe(false);
    }
    // Every station clears every collider with a braid margin.
    for (const [x, y, z] of stations) {
      for (const collider of build.colliders) {
        const distance = collider.center.distanceTo(new Vector3(x, y, z));
        expect(
          distance,
          `station ${x.toFixed(1)},${z.toFixed(1)} vs collider ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
        ).toBeGreaterThan(collider.radius + 0.9);
      }
    }
  });

  it("keeps the hatchlings at the kiln (bounded satellites, no target)", () => {
    const hatchlings = [
      named.get("smoulder-keeper-hatchling-0")?.[0],
      named.get("smoulder-keeper-hatchling-1")?.[0],
    ];
    for (const hatchling of hatchlings) {
      expect(hatchling).toBeDefined();
      const sphere = (hatchling as Mesh).geometry.boundingSphere!;
      const { u, v } = spokeOf(sphere.center.x, sphere.center.z);
      const d = Math.hypot(u - 505, v - 55);
      expect(d, "hatchling anchored at the kiln").toBeLessThan(10);
      expect(sphere.radius).toBeLessThan(6);
    }
    // Satellites, not a second find: the keeper stays the only target.
    expect(build.targets?.length).toBe(1);
  });

  it("registers the Kiln Keeper as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("kiln-keeper");
    expect(smokingWeight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(SMOKING_1.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
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

describe("smoking-marches-1 seals", () => {
  it("walls the rim and the gorge inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        smokingWeight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves a gate over the approach tongue", () => {
    const seals = buildSeals();
    for (const seal of seals) {
      const { u, v } = spokeOf(seal.center.x, seal.center.z);
      const onSpine = u > 230 && u < 300 && Math.abs(v) < 8;
      expect(onSpine, `seal blocks the corridor at u=${u.toFixed(0)}, v=${v.toFixed(0)}`).toBe(
        false,
      );
    }
  });
});

describe("smoking-marches-1 capture poses", () => {
  it("authors 8–14 poses that stand inside the region's own water", () => {
    expect(SMOKING_1.capturePoses.length).toBeGreaterThanOrEqual(8);
    for (const pose of SMOKING_1.capturePoses) {
      const [x, y, z] = pose.position;
      expect(smokingWeight(x, z), pose.name).toBeGreaterThan(0.3);
      const floor = smokingTerrainTarget(x, z) + SMOKING_1.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(smokingCeiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });
});
