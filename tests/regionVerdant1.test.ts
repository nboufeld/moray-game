import { CatmullRomCurve3, InstancedMesh, Matrix4, Mesh, Points, Scene, Vector3, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the def, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing the def
// module *first* runs the cycle the other way round, where the registry
// reads `VERDANT_1` before its module finishes evaluating.
import { seabedHeight } from "../src/world/Seabed";
import { VERDANT_1, buildSeals } from "../src/world/regions/verdant1/Verdant1";
import { buildVerdantDistance, PASS_GAP_HALF } from "../src/world/regions/verdant1/VerdantDistance";
import { valeRunnerStations } from "../src/world/regions/verdant1/VerdantFillLife";
import { buildVerdantKelp } from "../src/world/regions/verdant1/VerdantKelp";
import {
  CENTER_X,
  CENTER_Z,
  VERDANT_SLOT,
  spokeOf,
  verdantCeiling,
  verdantTerrainTarget,
  verdantWeight,
  worldOf,
} from "../src/world/regions/verdant1/VerdantTerrain";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Great Kelp Sea's own contracts: identity where it owns nothing,
 * determinism where it owns everything, budgets counted rather than
 * claimed, colliders inside the domain, capture poses that stand in water
 * the region actually has — and, since the Phase 3 fill: the reroll fence
 * (pilot landmarks pinned to their pre-fill coordinates), the MASTER R4
 * far-pole gap, the vale runner's collider clearance, and the carpets'
 * build-to-build determinism.
 */

describe("verdant-line-1 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === VERDANT_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(VERDANT_1.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero everywhere inside the tongue's own start", () => {
    // The tongue deliberately holds weight from r = 44 across the wing
    // seam (RegionShapes' documented handover); the r ≤ 46 fast path in
    // RegionField is what guarantees terrain identity inside the bowl.
    // The raw weight must still be structurally zero below the seam band.
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 39, 43.9]) {
        expect(VERDANT_1.weight(Math.cos(theta) * r, Math.sin(theta) * r)).toBe(0);
      }
    }
  });

  it("is full in its heart and covers the approach tongue", () => {
    expect(VERDANT_1.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
    for (const u of [60, 120, 200, 270]) {
      const { x, z } = worldOf(u, 0);
      expect(VERDANT_1.weight(x, z), `tongue u=${u}`).toBeGreaterThan(0.5);
    }
  });
});

describe("verdant-line-1 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [100, 2],
      [320, -30],
      [450, 0],
      [495, -82],
      [475, 58],
      [580, 20],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = verdantTerrainTarget(x, z);
      expect(verdantTerrainTarget(x, z)).toBe(first);
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
        const h = verdantTerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    // The vale's lip adds the top of the range; the maze holds the bottom.
    expect(highest - lowest).toBeGreaterThanOrEqual(20);
    expect(lowest).toBeLessThanOrEqual(-18);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(445 + du, dv);
        if (verdantWeight(x, z) === 0) {
          continue;
        }
        const floor = verdantTerrainTarget(x, z) + VERDANT_1.floorClearance;
        expect(verdantCeiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the vale's own channel.
    for (let u = 48; u <= 290; u += 6) {
      const { x, z } = worldOf(u, 0);
      const floor = verdantTerrainTarget(x, z) + VERDANT_1.floorClearance;
      expect(verdantCeiling(x, z), `vale u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("verdant-line-1 build", () => {
  let build: RegionBuild;

  beforeAll(() => {
    build = VERDANT_1.build(new Scene());
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
    // MASTER R12 ceilings (260 / 1.35M — the binding gate is the headed
    // frame measure, recorded in the ledger's re-pass section). The caps
    // here are set to what the R12.3 re-pass MEASURED plus working
    // margin, not to the doctrine maximum: honest caps catch regressions.
    expect(draws).toBeLessThanOrEqual(130);
    expect(triangles).toBeLessThanOrEqual(1_340_000);
    // Honest floors as well as caps: an empty region passes no bar, and a
    // FILLED region must actually be filled — after the R12.3 profile
    // upgrades the region cannot legitimately shrink below these.
    expect(draws).toBeGreaterThan(100);
    expect(triangles).toBeGreaterThan(900_000);
  });

  it("keeps every collider inside the domain", () => {
    expect(build.colliders.length).toBeGreaterThan(100);
    for (const collider of build.colliders) {
      const weight = verdantWeight(collider.center.x, collider.center.z);
      expect(weight, `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`).toBeGreaterThan(0);
    }
  });

  it("registers the Kelp Weaver as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("kelp-weaver");
    expect(verdantWeight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(VERDANT_1.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
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
      // The update signature takes the standing life context.
      build.update?.(0.1, ctx as never);
    }
  });
});

describe("verdant-line-1 seals", () => {
  it("walls the rim and the vale inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        verdantWeight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves a gate over the approach tongue", () => {
    const seals = buildSeals();
    // No rim seal may block the corridor's spine where the vale exits.
    for (const seal of seals) {
      const { u, v } = spokeOf(seal.center.x, seal.center.z);
      const onSpine = u > 230 && u < 300 && Math.abs(v) < 8;
      expect(onSpine, `seal blocks the corridor at u=${u.toFixed(0)}, v=${v.toFixed(0)}`).toBe(
        false,
      );
    }
  });
});

describe("verdant-line-1 reroll fence", () => {
  // The pilot's landmark coordinates, captured BEFORE the fill landed.
  // Every fill stream is a fresh `^` substream appended after the pilot's
  // draws, so these numbers must never move — if they do, existing
  // content re-rolled and the fence is broken.
  //
  // R12.3 restatement: the quality re-pass swaps carpet PROFILES and opts
  // banks into richness knobs, which may re-roll those families' OWN
  // buffers (expected and honest — the swap is the point); its new
  // families draw only from fresh `0xf21x`/`0xf22x` substreams appended
  // after every existing draw. The pins below therefore still hold to
  // nine decimal places: the landmarks, the kelp, the weaver and every
  // other pilot system are byte-unchanged by the re-pass.
  it("keeps the pilot's first and last giants exactly where they stood", () => {
    const kelp = buildVerdantKelp();
    expect(kelp.giants.length).toBe(39);
    const first = kelp.giants[0]!;
    const last = kelp.giants[kelp.giants.length - 1]!;
    expect(first.x).toBeCloseTo(76.44525357700229, 9);
    expect(first.z).toBeCloseTo(417.49691112376604, 9);
    expect(first.height).toBeCloseTo(24.06434390472714, 9);
    expect(last.x).toBeCloseTo(51.15686027014214, 9);
    expect(last.z).toBeCloseTo(262.1606866929158, 9);
    expect(last.height).toBeCloseTo(12, 9);
  });

  it("keeps the weaver's haunt exactly where the pilot placed it", () => {
    const build = VERDANT_1.build(new Scene());
    const target = build.targets![0]!;
    expect(target.position.x).toBeCloseTo(213.00160552272973, 9);
    expect(target.position.y).toBeCloseTo(-15.8430871917494, 9);
    expect(target.position.z).toBeCloseTo(467.70554416720296, 9);
  });
});

describe("verdant-line-1 distance rings (MASTER R4)", () => {
  function offAngle(x: number, z: number, at: number): number {
    const theta = Math.atan2(z - CENTER_Z, x - CENTER_X);
    const delta = Math.abs(theta - at) % (Math.PI * 2);
    return delta > Math.PI ? Math.PI * 2 - delta : delta;
  }

  it("parts over the depth-2 pass corridor — rings and trunk cards both", () => {
    const distance = buildVerdantDistance();
    const passAt = VERDANT_SLOT.azimuth;
    const matrix = new Matrix4();
    const at = new Vector3();
    let ringVertices = 0;
    for (const mesh of distance.meshes) {
      if (mesh instanceof InstancedMesh) {
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, matrix);
          at.setFromMatrixPosition(matrix);
          expect(
            offAngle(at.x, at.z, passAt),
            `trunk card ${i} of ${mesh.name} inside the pass sector`,
          ).toBeGreaterThan(PASS_GAP_HALF + 0.1 - 1e-6);
        }
        continue;
      }
      const position = mesh.geometry.attributes.position!;
      for (let i = 0; i < position.count; i++) {
        ringVertices++;
        expect(
          offAngle(position.getX(i), position.getZ(i), passAt),
          `${mesh.name} vertex ${i} inside the pass sector`,
        ).toBeGreaterThan(PASS_GAP_HALF - 1e-6);
      }
    }
    expect(ringVertices).toBeGreaterThan(100);
  });
});

describe("verdant-line-1 vale runner", () => {
  it("keeps clearance from every collider along its whole loop", () => {
    const build = VERDANT_1.build(new Scene());
    const stations = valeRunnerStations();
    const curve = new CatmullRomCurve3(
      stations.map(([x, y, z]) => new Vector3(x, y, z)),
      true,
      "centripetal",
      0.5,
    );
    const samples = curve.getPoints(240);
    for (const sample of samples) {
      for (const collider of build.colliders) {
        const clear = sample.distanceTo(collider.center) - collider.radius;
        expect(
          clear,
          `runner at ${sample.x.toFixed(1)},${sample.z.toFixed(1)} vs collider ` +
            `${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
        ).toBeGreaterThan(0.5);
      }
    }
  });

  it("stays out of the narrows shadow passage (MASTER §1.2 — motes only)", () => {
    for (const [x, , z] of valeRunnerStations()) {
      const { u } = spokeOf(x, z);
      expect(u).toBeLessThan(190);
    }
  });
});

describe("verdant-line-1 carpet determinism", () => {
  it("builds byte-identical carpets twice", () => {
    const firstBuild = VERDANT_1.build(new Scene());
    const secondBuild = VERDANT_1.build(new Scene());
    const collect = (build: RegionBuild): InstancedMesh[] => {
      const found: InstancedMesh[] = [];
      (build.group as Object3D).traverse((node) => {
        if (node instanceof InstancedMesh && node.name === "kit-carpet-field") {
          found.push(node);
        }
      });
      return found;
    };
    const first = collect(firstBuild);
    const second = collect(secondBuild);
    // The fill plan's §3 seven carpet families plus the round-2 base turf
    // floor (the sweep's "never bare by default" answer), the round-4
    // flank tussocks (the sweep's "nothing STANDS on the flanks" answer),
    // the round-7 saddle-mouth stand (sweep 12's outward-facing pose) —
    // and the R12.3 re-pass's four: holdfast skirt-grass collars, forest
    // ferns, and the vale/aisle road-edge blade stands.
    expect(first.length).toBe(14);
    expect(second.length).toBe(first.length);
    for (const [index, mesh] of first.entries()) {
      const twin = second[index]!;
      expect(twin.count).toBe(mesh.count);
      expect(Array.from(twin.instanceMatrix.array)).toEqual(
        Array.from(mesh.instanceMatrix.array),
      );
    }
  });
});

describe("verdant-line-1 capture poses", () => {
  it("authors 8–12+ poses that stand inside the region's own water", () => {
    expect(VERDANT_1.capturePoses.length).toBeGreaterThanOrEqual(8);
    for (const pose of VERDANT_1.capturePoses) {
      const [x, y, z] = pose.position;
      expect(verdantWeight(x, z), pose.name).toBeGreaterThan(0.3);
      const floor = verdantTerrainTarget(x, z) + VERDANT_1.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(verdantCeiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });
});
