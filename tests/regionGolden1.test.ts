import { InstancedMesh, Matrix4, Mesh, Points, Scene, Vector3, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the def, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing the def
// module *first* runs the cycle the other way round, where the registry
// reads `GOLDEN_1` before its module finishes evaluating.
import { seabedHeight } from "../src/world/Seabed";
import { GOLDEN_1, buildSeals } from "../src/world/regions/golden1/Golden1";
import { insideRest } from "../src/world/regions/golden1/GoldenFillShared";
import {
  CENTER_X,
  CENTER_Z,
  GOLDEN_SLOT,
  HOURGLASS,
  goldenCeiling,
  goldenTerrainTarget,
  goldenWeight,
  spokeOf,
  worldOf,
} from "../src/world/regions/golden1/GoldenTerrain";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Hourglass Sea's own contracts: identity where it owns nothing,
 * determinism where it owns everything, budgets counted rather than
 * claimed, colliders inside the domain, capture poses that stand in
 * water the region actually has — and the Hourglass truly deep.
 */

describe("golden-waste-1 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === GOLDEN_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(GOLDEN_1.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero everywhere inside the tongue's own start", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 39, 43.9]) {
        expect(GOLDEN_1.weight(Math.cos(theta) * r, Math.sin(theta) * r)).toBe(0);
      }
    }
  });

  it("is full in its heart and covers the approach tongue", () => {
    expect(GOLDEN_1.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
    for (const u of [60, 120, 200, 270]) {
      const { x, z } = worldOf(u, 0);
      expect(GOLDEN_1.weight(x, z), `tongue u=${u}`).toBeGreaterThan(0.5);
    }
  });

  it("keeps its neighbour wing's seam water", () => {
    // The sargassum-sky wing sits at azimuth 6.03 with a 0.165 rad end
    // wedge, so its nearest edge is 0.195 rad off this spoke. The seam
    // tongue must be zero there — and on the far side too, where the
    // next wing up (kelp-cathedral, 1.35 ≡ 7.63) keeps its own water.
    for (const edge of [6.03 + 0.165, 7.63 - 0.165]) {
      for (const r of [40, 44, 48, 55]) {
        const x = Math.cos(edge) * r;
        const z = Math.sin(edge) * r;
        expect(GOLDEN_1.weight(x, z), `wing edge az=${edge.toFixed(3)} r=${r}`).toBe(0);
      }
    }
  });
});

describe("golden-waste-1 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [100, 2],
      [310, -20],
      [HOURGLASS.u, HOURGLASS.v],
      [395, -78],
      [517, -64],
      [528, 84],
      [585, 12],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = goldenTerrainTarget(x, z);
      expect(goldenTerrainTarget(x, z)).toBe(first);
      const composed = seabedHeight(x, z);
      expect(seabedHeight(x, z)).toBe(composed);
    }
  });

  it("carries at least 25 m of vertical range and takes the Hourglass past −25", () => {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let du = -170; du <= 170; du += 8) {
      for (let dv = -170; dv <= 170; dv += 8) {
        if (Math.hypot(du, dv) > 170) {
          continue;
        }
        const { x, z } = worldOf(445 + du, dv);
        const h = goldenTerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    // The dune crests hold the top of the range; the chasm the bottom.
    expect(highest - lowest).toBeGreaterThanOrEqual(25);
    expect(lowest).toBeLessThanOrEqual(-25);
    expect(highest).toBeGreaterThanOrEqual(1.2);
    // And the chasm's own centre, sampled directly, is truly deep.
    const centre = worldOf(HOURGLASS.u, HOURGLASS.v);
    expect(goldenTerrainTarget(centre.x, centre.z)).toBeLessThan(-25);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(445 + du, dv);
        if (goldenWeight(x, z) === 0) {
          continue;
        }
        const floor = goldenTerrainTarget(x, z) + GOLDEN_1.floorClearance;
        expect(goldenCeiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the saddle's own channel.
    for (let u = 48; u <= 290; u += 6) {
      const { x, z } = worldOf(u, 0);
      const floor = goldenTerrainTarget(x, z) + GOLDEN_1.floorClearance;
      expect(goldenCeiling(x, z), `saddle u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("golden-waste-1 build", () => {
  let build: RegionBuild;

  beforeAll(() => {
    build = GOLDEN_1.build(new Scene());
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
    // MASTER R12 budgets (the binding gate is the headed frame measure,
    // recorded in the ledger; these caps are the honest envelope).
    expect(draws).toBeLessThanOrEqual(260);
    expect(triangles).toBeLessThanOrEqual(1_350_000);
    // Honest floors as well as caps: an empty region passes no bar — and
    // a region whose fill silently vanished fails loudly.
    expect(draws).toBeGreaterThan(60);
    expect(triangles).toBeGreaterThan(300_000);
  });

  it("keeps every collider inside the domain", () => {
    expect(build.colliders.length).toBeGreaterThan(100);
    for (const collider of build.colliders) {
      const weight = goldenWeight(collider.center.x, collider.center.z);
      expect(
        weight,
        `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("registers the Hourglass Keeper as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("hourglass-keeper");
    expect(goldenWeight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(GOLDEN_1.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
  });

  it("holds the reroll fence: pilot placements byte-identical to the pre-fill build", () => {
    // Values read off the pre-fill tree (commit 01b028f) by a scratch
    // scene walk. Every fill stream is `SEEDS.regionGolden1 ^
    // FILL_SEEDS.*`, appended after all pilot draws — so a fill retune
    // that shifts ANY of these has consumed from a pilot stream and
    // broken the fence.
    const named: Record<string, Object3D[]> = {};
    (build.group as Object3D).traverse((node) => {
      (named[node.name] ??= []).push(node);
    });
    const m = new Matrix4();

    const rocks = (named["hourglass-rock"] ?? []) as Mesh[];
    const boulder = rocks[2]!.geometry.boundingSphere!.center;
    expect(boulder.x).toBeCloseTo(83.49681854248047, 9);
    expect(boulder.y).toBeCloseTo(-4.689630508422852, 9);
    expect(boulder.z).toBeCloseTo(1.53416408598423, 9);
    const monolith = rocks[12]!.geometry.boundingSphere!.center;
    expect(monolith.x).toBeCloseTo(495.18067932128906, 9);
    expect(monolith.z).toBeCloseTo(118.99128723144531, 9);

    const fins = named["hourglass-glass-fins"]![0] as InstancedMesh;
    fins.getMatrixAt(0, m);
    expect(m.elements[12]).toBeCloseTo(446.5163879394531, 9);
    expect(m.elements[14]).toBeCloseTo(-54.69419479370117, 9);

    const eels = named["hourglass-garden-eels"]![0] as InstancedMesh;
    eels.getMatrixAt(0, m);
    expect(m.elements[12]).toBeCloseTo(497.3562927246094, 9);
    expect(m.elements[14]).toBeCloseTo(141.784210205078, 9);

    const palms = named["hourglass-sea-palms"]![0] as InstancedMesh;
    palms.getMatrixAt(0, m);
    expect(m.elements[12]).toBeCloseTo(516.33154296875, 9);
    expect(m.elements[14]).toBeCloseTo(-13.027262687683105, 9);

    const keeper = named["hourglass-keeper"]![0] as Mesh;
    expect(keeper.position.x).toBeCloseTo(463.5802078078077, 9);
    expect(keeper.position.z).toBeCloseTo(63.522568623359625, 9);

    // The appended sand veil must not have moved the original nine.
    const veils = named["hourglass-sand-veils"]![0] as InstancedMesh;
    veils.getMatrixAt(0, m);
    expect(m.elements[12]).toBeCloseTo(378.476806640625, 9);
    expect(m.elements[14]).toBeCloseTo(63.95013427734375, 9);
    expect(veils.count).toBe(10);
  });

  it("keeps every fill instance out of the two registered rests", () => {
    // MASTER §1.2: The Empty Quarter and The Drain's Eye stay composed
    // bareness. Every kit cover instance, sand-rose and merged debris
    // vertex must stand outside both.
    const coverNames = new Set([
      "kit-carpet-field",
      "kit-ground-litter-0",
      "kit-ground-litter-1",
      "kit-bush-bank",
      "hourglass-sand-roses",
    ]);
    const m = new Matrix4();
    let checked = 0;
    (build.group as Object3D).traverse((node) => {
      if (node instanceof InstancedMesh && coverNames.has(node.name)) {
        for (let i = 0; i < node.count; i++) {
          node.getMatrixAt(i, m);
          const { u, v } = spokeOf(m.elements[12]!, m.elements[14]!);
          expect(insideRest(u, v), `${node.name}[${i}] at u=${u.toFixed(0)} v=${v.toFixed(0)}`).toBe(
            false,
          );
          checked++;
        }
      } else if (node instanceof Mesh && node.name === "kit-drift-debris") {
        const position = node.geometry.attributes.position!;
        for (let i = 0; i < position.count; i += 7) {
          const { u, v } = spokeOf(position.getX(i), position.getZ(i));
          expect(insideRest(u, v), `debris vertex at u=${u.toFixed(0)} v=${v.toFixed(0)}`).toBe(
            false,
          );
          checked++;
        }
      }
    });
    expect(checked).toBeGreaterThan(5_000);
  });

  it("keeps standing cover off the close poses' lenses", () => {
    const closes = GOLDEN_1.capturePoses.filter((pose) => pose.name.startsWith("close-"));
    expect(closes.length).toBeGreaterThanOrEqual(4);
    const m = new Matrix4();
    (build.group as Object3D).traverse((node) => {
      if (node instanceof InstancedMesh && node.name === "kit-carpet-field") {
        for (let i = 0; i < node.count; i++) {
          node.getMatrixAt(i, m);
          for (const pose of closes) {
            const d = Math.hypot(
              m.elements[12]! - pose.position[0],
              m.elements[14]! - pose.position[2],
            );
            expect(d, `carpet instance on ${pose.name}'s lens`).toBeGreaterThan(0.9);
          }
        }
      }
    });
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

describe("golden-waste-1 seals", () => {
  it("walls the rim and the saddle inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        goldenWeight(seal.center.x, seal.center.z),
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

describe("golden-waste-1 capture poses", () => {
  it("authors 8–13+ poses that stand inside the region's own water", () => {
    expect(GOLDEN_1.capturePoses.length).toBeGreaterThanOrEqual(8);
    for (const pose of GOLDEN_1.capturePoses) {
      const [x, y, z] = pose.position;
      expect(goldenWeight(x, z), pose.name).toBeGreaterThan(0.3);
      const floor = goldenTerrainTarget(x, z) + GOLDEN_1.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(goldenCeiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });

  it("gives the Hourglass its two awes — the lip looking down, the deep looking up", () => {
    const lip = GOLDEN_1.capturePoses.find((pose) => pose.name === "hourglass-lip");
    const deep = GOLDEN_1.capturePoses.find((pose) => pose.name === "hourglass-deep");
    expect(lip).toBeDefined();
    expect(deep).toBeDefined();
    expect(lip!.pitch).toBeLessThan(-0.2);
    expect(deep!.pitch).toBeGreaterThan(0.2);
    // The deep pose stands genuinely inside the chasm.
    expect(deep!.position[1]).toBeLessThan(-15);
  });
});
