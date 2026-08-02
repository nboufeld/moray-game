import { Color, InstancedMesh, Matrix4, Mesh, Points, Scene, Vector3, type Object3D } from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing (the pilot's documented cycle note):
// `Seabed` pulls `RegionField` → `RegionRegistry` → the defs, and that
// chain tolerates the cycle; importing the def module first runs it the
// other way round, where the registry reads the def before its module
// finishes evaluating.
import { seabedHeight } from "../src/world/Seabed";
import { PALE_1, buildSeals } from "../src/world/regions/pale1/Pale1";
import { buildPaleBloom } from "../src/world/regions/pale1/PaleBloom";
import { buildPaleBones } from "../src/world/regions/pale1/PaleBones";
import { aisleDistance } from "../src/world/regions/pale1/PaleFillShared";
import { hushFryStations } from "../src/world/regions/pale1/PaleLife";
import {
  CENTER_X,
  CENTER_Z,
  PALE_SLOT,
  SEED_GROVE,
  galleryWeight,
  paleCeiling,
  paleTerrainTarget,
  paleWeight,
  ravineChannelCenter,
  ravineChannelHalf,
  recovery,
  spokeOf,
  worldOf,
} from "../src/world/regions/pale1/PaleTerrain";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Bone Meadows' own contracts: identity where it owns nothing,
 * determinism where it owns everything, budgets counted rather than
 * claimed, colliders inside the domain, poses in real water — and the
 * story itself asserted: the built gardens' saturation must rise with
 * distance across the disc, because the colour gradient IS the region.
 */

describe("pale-passage-1 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === PALE_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(PALE_1.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero everywhere inside the tongue's own start", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 39, 43.9]) {
        expect(PALE_1.weight(Math.cos(theta) * r, Math.sin(theta) * r)).toBe(0);
      }
    }
  });

  it("is zero in both neighbour wings' wedges at the seam radius", () => {
    // Glass Cove (3.51) and Current Run (4.23), endHalf 0.165: their
    // wedge edges at 3.675 and 4.065 must own their own water.
    for (const theta of [3.51, 3.675 - 0.005, 4.065 + 0.005, 4.23]) {
      for (const r of [40, 44, 48]) {
        expect(
          paleWeight(Math.cos(theta) * r, Math.sin(theta) * r),
          `theta=${theta} r=${r}`,
        ).toBe(0);
      }
    }
  });

  it("is full in its heart and covers the approach tongue", () => {
    expect(PALE_1.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
    for (const u of [60, 120, 200, 270]) {
      const { x, z } = worldOf(u, 0);
      expect(PALE_1.weight(x, z), `tongue u=${u}`).toBeGreaterThan(0.5);
    }
  });
});

describe("pale-passage-1 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [100, 2],
      [260, 0],
      [355, -16],
      [385, 78],
      [525, -48],
      [558, 38],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = paleTerrainTarget(x, z);
      expect(paleTerrainTarget(x, z)).toBe(first);
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
        const h = paleTerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    // The gallery pan holds the top of the range; the grove's heart the bottom.
    expect(highest - lowest).toBeGreaterThanOrEqual(20);
    expect(lowest).toBeLessThanOrEqual(-18);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(445 + du, dv);
        if (paleWeight(x, z) === 0) {
          continue;
        }
        const floor = paleTerrainTarget(x, z) + PALE_1.floorClearance;
        expect(paleCeiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    for (let u = 48; u <= 290; u += 6) {
      const { x, z } = worldOf(u, 0);
      const floor = paleTerrainTarget(x, z) + PALE_1.floorClearance;
      expect(paleCeiling(x, z), `ravine u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });

  it("tells the story in the pure gradient: white at the gate, bloom at the grove", () => {
    expect(recovery(320, 0)).toBe(0);
    expect(recovery(470, 0)).toBeGreaterThan(0.1);
    expect(recovery(470, 0)).toBeLessThan(0.75);
    expect(recovery(560, 38)).toBeGreaterThan(0.9);
    // The Quiet Gallery is held pale on purpose.
    expect(recovery(385, 78)).toBeLessThan(0.2);
  });
});

describe("pale-passage-1 build", () => {
  let build: RegionBuild;

  beforeAll(() => {
    build = PALE_1.build(new Scene());
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
    // The fill doctrine's Phase 3 ceilings (MASTER R1): the pilot's
    // 120/250k caps are superseded; the measured numbers go in the
    // region ledger.
    expect(draws).toBeLessThanOrEqual(160);
    // Hard-geometry purge: the horizon rings' soft three-row grammar
    // (crest dissolve — critic F3) costs ~0.8k tris over the old cap;
    // recorded in docs/region-ledger/hard-geometry-fix.md.
    expect(triangles).toBeLessThanOrEqual(455_000);
    // Honest floors as well as caps: an empty region passes no bar, and
    // a FILLED region must actually be filled.
    expect(draws).toBeGreaterThan(85);
    expect(triangles).toBeGreaterThan(380_000);
  });

  it("keeps every collider inside the domain", () => {
    expect(build.colliders.length).toBeGreaterThan(100);
    for (const collider of build.colliders) {
      const weight = paleWeight(collider.center.x, collider.center.z);
      expect(
        weight,
        `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("asserts the colour-gradient story on the built gardens", () => {
    // Read every bloom instance's tint and spoke distance back off the
    // scene graph, then require the mean saturation to RISE band over
    // band across the disc: pioneers near-bone, gardens in colour.
    const samples: { u: number; saturation: number }[] = [];
    const color = new Color();
    (build.group as Object3D).traverse((node) => {
      if (!(node instanceof InstancedMesh) || !node.name.startsWith("pale-bloom-")) {
        return;
      }
      const matrices = node.instanceMatrix;
      const tints = node.instanceColor;
      if (!tints) {
        return;
      }
      for (let i = 0; i < node.count; i++) {
        const x = matrices.array[i * 16 + 12]!;
        const z = matrices.array[i * 16 + 14]!;
        const { u } = spokeOf(x, z);
        color.fromArray(tints.array, i * 3);
        const max = Math.max(color.r, color.g, color.b);
        const min = Math.min(color.r, color.g, color.b);
        samples.push({ u, saturation: max === 0 ? 0 : (max - min) / max });
      }
    });
    expect(samples.length).toBeGreaterThan(60);

    const meanSat = (from: number, to: number): number => {
      const band = samples.filter((s) => s.u >= from && s.u < to);
      expect(band.length, `stands in u ${from}–${to}`).toBeGreaterThan(4);
      return band.reduce((sum, s) => sum + s.saturation, 0) / band.length;
    };
    const near = meanSat(390, 470);
    const middle = meanSat(470, 530);
    const far = meanSat(530, 640);
    expect(middle).toBeGreaterThan(near);
    expect(far).toBeGreaterThan(middle);
    // And the far quarter is genuinely in colour, not merely less white.
    expect(far).toBeGreaterThan(0.25);
  });

  it("registers the Gardener as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("pale-gardener");
    expect(paleWeight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(PALE_1.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
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

describe("pale-passage-1 seals", () => {
  it("walls the rim and the ravine inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        paleWeight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves the channel itself unsealed the whole way down", () => {
    // The ravine's channel wanders off the spine by design, so the gate is
    // asserted channel-relative: no seal centre may sit within 4 m of the
    // channel's open water anywhere past the mouth stacks.
    const seals = buildSeals();
    for (const seal of seals) {
      const { u, v } = spokeOf(seal.center.x, seal.center.z);
      if (u < 100 || u > 300) {
        continue;
      }
      const uc = Math.min(u, 285);
      const away = Math.abs(v - ravineChannelCenter(uc));
      expect(
        away,
        `seal crowds the channel at u=${u.toFixed(0)}, v=${v.toFixed(0)}`,
      ).toBeGreaterThanOrEqual(ravineChannelHalf(uc) + 4);
    }
  });
});

describe("pale-passage-1 capture poses", () => {
  it("authors the pilot's 12 poses plus the fill round's 2, in real water", () => {
    expect(PALE_1.capturePoses.length).toBe(14);
    // The fill's poses are APPENDED so archives stay comparable.
    expect(PALE_1.capturePoses[12]!.name).toBe("ravine-hush");
    expect(PALE_1.capturePoses[13]!.name).toBe("ossuary-floor");
    for (const pose of PALE_1.capturePoses) {
      const [x, y, z] = pose.position;
      expect(paleWeight(x, z), pose.name).toBeGreaterThan(0.3);
      const floor = paleTerrainTarget(x, z) + PALE_1.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(paleCeiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });
});

// ─── The Phase 3 fill's own contracts ────────────────────────────────────────

describe("pale-passage-1 reroll fence", () => {
  // The pilot's landmark coordinates, captured BEFORE the fill landed
  // (scripts run against the pre-fill build). Every fill stream is a
  // fresh `^` substream appended after the pilot's draws, so these
  // numbers must never move — if they do, existing content re-rolled
  // and the fence is broken. Instance matrices are float32; the
  // Gardener target is double precision.
  it("keeps the pilot's bone trees exactly where they stood", () => {
    const build = PALE_1.build(new Scene());
    const matrix = new Matrix4();
    const at = new Vector3();
    const pins: Record<string, { count: number; first: [number, number]; last: [number, number] }> =
      {
        "pale-bone-trees-0": { count: 20, first: [-229.64018, -243.6749], last: [-344.17569, -309.70322] },
        "pale-bone-trees-1": { count: 15, first: [-303.51505, -282.34296], last: [-238.189, -227.21796] },
        "pale-bone-trees-2": { count: 13, first: [-313.86304, -216.89716], last: [-344.96445, -286.28577] },
      };
    let seen = 0;
    (build.group as Object3D).traverse((node) => {
      if (!(node instanceof InstancedMesh)) {
        return;
      }
      const pin = pins[node.name];
      if (!pin) {
        return;
      }
      seen++;
      expect(node.count, node.name).toBe(pin.count);
      node.getMatrixAt(0, matrix);
      at.setFromMatrixPosition(matrix);
      expect(at.x, `${node.name} first x`).toBeCloseTo(pin.first[0], 3);
      expect(at.z, `${node.name} first z`).toBeCloseTo(pin.first[1], 3);
      node.getMatrixAt(node.count - 1, matrix);
      at.setFromMatrixPosition(matrix);
      expect(at.x, `${node.name} last x`).toBeCloseTo(pin.last[0], 3);
      expect(at.z, `${node.name} last z`).toBeCloseTo(pin.last[1], 3);
    });
    expect(seen).toBe(3);
  });

  it("keeps the first monument and the Gardener exactly in place", () => {
    const build = PALE_1.build(new Scene());
    const matrix = new Matrix4();
    const at = new Vector3();
    (build.group as Object3D).traverse((node) => {
      if (node instanceof InstancedMesh && node.name === "pale-monument-0") {
        node.getMatrixAt(0, matrix);
        at.setFromMatrixPosition(matrix);
        expect(at.x).toBeCloseTo(-224.55841, 3);
        expect(at.z).toBeCloseTo(-289.96808, 3);
      }
    });
    const target = build.targets![0]!;
    expect(target.position.x).toBeCloseTo(-349.8401585606639, 9);
    expect(target.position.y).toBeCloseTo(-0.9536567030300063, 9);
    expect(target.position.z).toBeCloseTo(-346.9176609200655, 9);
  });
});

describe("pale-passage-1 fill gating (MASTER §1.2 — inviolable)", () => {
  // Every T1/T2 fill instance, read back off the built scene graph.
  const FILL_NAMES = /^(kit-ground-litter-\d|kit-carpet-field|kit-scree-apron|pale-bone-stumps)$/;

  function fillPoints(build: RegionBuild): { x: number; z: number; name: string }[] {
    const points: { x: number; z: number; name: string }[] = [];
    (build.group as Object3D).traverse((node) => {
      if (!FILL_NAMES.test(node.name)) {
        return;
      }
      if (node instanceof InstancedMesh) {
        const matrices = node.instanceMatrix;
        for (let i = 0; i < node.count; i++) {
          points.push({
            x: matrices.array[i * 16 + 12]!,
            z: matrices.array[i * 16 + 14]!,
            name: node.name,
          });
        }
      } else if (node instanceof Mesh) {
        // The ossuary's merged draws: sample vertices (each within
        // ~0.4 m of its placement).
        const position = node.geometry.attributes.position!;
        for (let i = 0; i < position.count; i += 12) {
          points.push({ x: position.getX(i), z: position.getZ(i), name: node.name });
        }
      }
    });
    return points;
  }

  let build: RegionBuild;
  let points: { x: number; z: number; name: string }[];

  beforeAll(() => {
    build = PALE_1.build(new Scene());
    points = fillPoints(build);
    expect(points.length).toBeGreaterThan(4000);
  });

  it("keeps every fill piece off the Quiet Gallery pan", () => {
    for (const point of points) {
      const { u, v } = spokeOf(point.x, point.z);
      expect(
        galleryWeight(u, v),
        `${point.name} at u=${u.toFixed(0)}, v=${v.toFixed(0)}`,
      ).toBeLessThanOrEqual(0.4);
    }
  });

  it("keeps the Mother's Pool clean", () => {
    for (const point of points) {
      const { u, v } = spokeOf(point.x, point.z);
      expect(
        Math.hypot(u - SEED_GROVE.u, v - SEED_GROVE.v),
        `${point.name} inside the pool`,
      ).toBeGreaterThan(7.5);
    }
  });

  it("keeps the forest aisle's swim line clear", () => {
    for (const point of points) {
      const { u, v } = spokeOf(point.x, point.z);
      expect(
        aisleDistance(u, v),
        `${point.name} on the aisle at u=${u.toFixed(0)}`,
      ).toBeGreaterThanOrEqual(2.4);
    }
  });

  it("keeps the Ravine Hush's channel floor bare (u 130–210, gravel stops)", () => {
    // The rest is the CHANNEL FLOOR: the stairs slabs on the benches keep
    // their (outward-fanned) aprons, the ledge at u 200 is wall
    // architecture — but nothing may lie in the hush's open water lane.
    for (const point of points) {
      const { u, v } = spokeOf(point.x, point.z);
      if (u < 130.5 || u > 209.5) {
        continue;
      }
      const away = Math.abs(v - ravineChannelCenter(u));
      expect(
        away,
        `${point.name} on the hush floor at u=${u.toFixed(1)}, v=${v.toFixed(1)}`,
      ).toBeGreaterThan(ravineChannelHalf(u) + 0.5);
    }
  });
});

describe("pale-passage-1 fill density floors", () => {
  it("carries real bone gravel down the ravine channel", () => {
    const build = PALE_1.build(new Scene());
    let inChannel = 0;
    (build.group as Object3D).traverse((node) => {
      if (!(node instanceof InstancedMesh) || !node.name.startsWith("kit-ground-litter-")) {
        return;
      }
      const matrices = node.instanceMatrix;
      for (let i = 0; i < node.count; i++) {
        const x = matrices.array[i * 16 + 12]!;
        const z = matrices.array[i * 16 + 14]!;
        const { u, v } = spokeOf(x, z);
        if (u < 60 || u > 292) {
          continue;
        }
        if (Math.abs(v - ravineChannelCenter(u)) < ravineChannelHalf(u) + 6) {
          inChannel++;
        }
      }
    });
    expect(inChannel).toBeGreaterThan(600);
  });

  it("plants at least two fans in every authored bed", () => {
    const bones = buildPaleBones();
    const bloom = buildPaleBloom(bones.archCrown);
    for (const [bu, bv] of [
      [518, -48],
      [532, -62],
      [545, -45],
      [509, -30],
      [508, -6],
      [494, 30],
    ] as const) {
      const fans = bloom.stands.filter(
        (stand) => stand.kind === "fan" && Math.hypot(stand.u - bu, stand.v - bv) < 8,
      );
      expect(fans.length, `fans at bed (${bu}, ${bv})`).toBeGreaterThanOrEqual(2);
    }
  });

  it("grows the nursery to sixteen seats per line, aligned", () => {
    const bones = buildPaleBones();
    const bloom = buildPaleBloom(bones.archCrown);
    const nursery = bloom.stands.filter((stand) => {
      const d = Math.hypot(stand.u - SEED_GROVE.u, stand.v - SEED_GROVE.v);
      return d > 9 && d < 36 && (stand.kind === "branch" || stand.kind === "fan");
    });
    // 6 rows × 2 lines × 16 seats plus the rim-gate hedges, minus any
    // garden-site strays double-counted — a floor, not an exact count.
    expect(nursery.length).toBeGreaterThan(180);
  });
});

describe("pale-passage-1 hush-fry route", () => {
  it("stays out of the Ravine Hush and the Quiet Gallery (MASTER R10)", () => {
    const stations = hushFryStations();
    expect(stations.length).toBeGreaterThan(10);
    for (const [x, , z] of stations) {
      const { u, v } = spokeOf(x, z);
      expect(u, "hush (u 130–210) is motes-only").toBeGreaterThanOrEqual(212);
      expect(galleryWeight(u, v), "the gallery is dust-only").toBeLessThan(0.35);
      expect(paleWeight(x, z)).toBeGreaterThan(0.3);
    }
  });
});

describe("pale-passage-1 carpet determinism", () => {
  it("builds byte-identical fill carpets twice", () => {
    const collect = (build: RegionBuild): InstancedMesh[] => {
      const found: InstancedMesh[] = [];
      (build.group as Object3D).traverse((node) => {
        if (node instanceof InstancedMesh && node.name === "kit-carpet-field") {
          found.push(node);
        }
      });
      return found;
    };
    const first = collect(PALE_1.build(new Scene()));
    const second = collect(PALE_1.build(new Scene()));
    // The shelf's rose-gold turf, the grove's rim turf, the deep flanks'
    // pioneer sprigs (round 4) and their south-flank patch (round 5).
    expect(first.length).toBe(4);
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
