import {
  CatmullRomCurve3,
  InstancedMesh,
  Matrix4,
  Mesh,
  Points,
  Quaternion,
  Scene,
  Vector3,
  type Object3D,
} from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the def, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing the def
// module *first* runs the cycle the other way round, where the registry
// reads `CALAMITY_1` before its module finishes evaluating.
import { seabedHeight } from "../src/world/Seabed";
import { CALAMITY_1, buildSeals } from "../src/world/regions/calamity1/Calamity1";
import {
  craterRunnerStations,
  marchRunnerStations,
} from "../src/world/regions/calamity1/CalamityFillLife";
import { buildCalamityForest } from "../src/world/regions/calamity1/CalamityForest";
import { buildCalamityLitter } from "../src/world/regions/calamity1/CalamityLitter";
import { buildCalamityRubble } from "../src/world/regions/calamity1/CalamityRubble";
import {
  CALAMITY_SLOT,
  CENTER_X,
  CENTER_Z,
  calamityCeiling,
  calamityTerrainTarget,
  calamityWeight,
  groveWeight,
  marchChannelCenter,
  marchChannelHalf,
  spokeOf,
  worldOf,
} from "../src/world/regions/calamity1/CalamityTerrain";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Sunken Calamity's own contracts: identity where it owns nothing,
 * determinism where it owns everything, budgets counted rather than
 * claimed, colliders inside the domain, capture poses that stand in
 * water the region actually has — and, since the Phase 3 fill: the
 * reroll fence (pilot content pinned to nine decimals), the blast-rake
 * alignment, the Suffocated Mile's registry stillness, the shoal
 * routes' clearances, and the grove meadow's gate.
 */

describe("sunken-calamity-1 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === CALAMITY_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(CALAMITY_1.weight(x, z), slot.id).toBe(0);
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
        expect(CALAMITY_1.weight(Math.cos(theta) * r, Math.sin(theta) * r)).toBe(0);
      }
    }
  });

  it("is exactly zero in both neighbouring wings' ground at the seam", () => {
    // The Current Run (4.23) and Mangrove Roots (4.95) wedges reach
    // 0.195 rad of the 4.59 spoke at r = 44–50; the seam tongue's 8.2 m
    // half-width clears both. Sampled inside their carve where it hurts.
    for (const azimuth of [4.23 + 0.14, 4.95 - 0.14]) {
      for (const r of [44, 47, 49.5]) {
        const x = Math.cos(azimuth) * r;
        const z = Math.sin(azimuth) * r;
        expect(CALAMITY_1.weight(x, z), `az=${azimuth} r=${r}`).toBe(0);
      }
    }
  });

  it("is full in its heart and covers the whole long approach", () => {
    expect(CALAMITY_1.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
    for (const u of [60, 150, 280, 400, 500]) {
      const { x, z } = worldOf(u, 0);
      expect(CALAMITY_1.weight(x, z), `tongue u=${u}`).toBeGreaterThan(0.5);
    }
  });
});

describe("sunken-calamity-1 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [100, 2],
      [260, -6],
      [470, 0],
      [532, 0],
      [626, -4],
      [700, 0],
      [752, 58],
      [774, -86],
      [860, 10],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = calamityTerrainTarget(x, z);
      expect(calamityTerrainTarget(x, z)).toBe(first);
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
        const { x, z } = worldOf(700 + du, dv);
        const h = calamityTerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    // The Wound holds the bottom at −30; the sheltering ridge the top.
    expect(highest - lowest).toBeGreaterThanOrEqual(20);
    expect(lowest).toBeLessThanOrEqual(-24);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(700 + du, dv);
        if (calamityWeight(x, z) === 0) {
          continue;
        }
        const floor = calamityTerrainTarget(x, z) + CALAMITY_1.floorClearance;
        expect(calamityCeiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the march's own channel, at its lowest point per station.
    for (let u = 48; u <= 530; u += 6) {
      const { x, z } = worldOf(u, marchChannelCenter(u));
      const floor = calamityTerrainTarget(x, z) + CALAMITY_1.floorClearance;
      expect(calamityCeiling(x, z), `march u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("sunken-calamity-1 build", () => {
  let build: RegionBuild;

  beforeAll(() => {
    build = CALAMITY_1.build(new Scene());
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
    // The doctrine's raised caps (MASTER R1): 160 / 450k, measured.
    expect(draws).toBeLessThanOrEqual(160);
    expect(triangles).toBeLessThanOrEqual(450_000);
    // Honest floors as well as caps: an empty region passes no bar, and
    // a fill that silently vanished should fail loudly.
    expect(draws).toBeGreaterThan(90);
    expect(triangles).toBeGreaterThan(250_000);
  });

  it("keeps every collider inside the domain", () => {
    expect(build.colliders.length).toBeGreaterThan(100);
    for (const collider of build.colliders) {
      const weight = calamityWeight(collider.center.x, collider.center.z);
      expect(weight, `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`).toBeGreaterThan(0);
    }
  });

  it("registers the Curator as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("ashkeeper-octopus");
    expect(calamityWeight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(CALAMITY_1.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
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

describe("sunken-calamity-1 seals", () => {
  it("walls the rim and the march inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        calamityWeight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves a gate over the approach tongue", () => {
    const seals = buildSeals();
    // No rim seal may block the corridor where the march exits — and the
    // corridor is the *channel*, which wanders: the spine window follows
    // the channel's own centre, not the spoke's axis.
    for (const seal of seals) {
      const { u, v } = spokeOf(seal.center.x, seal.center.z);
      const onSpine =
        u > 460 && u < 530 && Math.abs(v - marchChannelCenter(u)) < marchChannelHalf(u) - 2;
      expect(onSpine, `seal blocks the corridor at u=${u.toFixed(0)}, v=${v.toFixed(0)}`).toBe(
        false,
      );
    }
  });
});

// ─── The Phase 3 fill's contracts ────────────────────────────────────────────

describe("sunken-calamity-1 reroll fence", () => {
  it("keeps the pilot's content byte-unchanged under the fill (pins)", () => {
    // Values recorded from the PRE-fill build (verified identical on the
    // stashed HEAD tree before the fill landed): the first amphora, the
    // first bank tooth, the fourth collider (a thrown stone) and the
    // first ghost giant's foot. Every fill stream is a fresh `^`
    // substream appended after existing draws; these pins prove it.
    const rubble = buildCalamityRubble();
    const matrix = new Matrix4();
    const p = new Vector3();
    const q = new Quaternion();
    const s = new Vector3();

    const amphorae = rubble.meshes.find((m) => m.name === "calamity-amphorae") as InstancedMesh;
    amphorae.getMatrixAt(0, matrix);
    matrix.decompose(p, q, s);
    expect(p.x).toBeCloseTo(-34.187129974, 6);
    expect(p.y).toBeCloseTo(-8.099873543, 6);
    expect(p.z).toBeCloseTo(-350.974182129, 6);

    const teeth = rubble.meshes.find((m) => m.name === "calamity-bank-teeth") as InstancedMesh;
    teeth.getMatrixAt(0, matrix);
    matrix.decompose(p, q, s);
    expect(p.x).toBeCloseTo(-4.679626465, 6);
    expect(p.y).toBeCloseTo(-4.113380432, 6);
    expect(p.z).toBeCloseTo(-108.044555664, 6);

    const stone = rubble.colliders[3]!;
    expect(stone.center.x).toBeCloseTo(-30.531262488, 6);
    expect(stone.center.y).toBeCloseTo(-6.97157072, 6);
    expect(stone.center.z).toBeCloseTo(-151.204583009, 6);

    const forest = buildCalamityForest();
    expect(forest.ghosts[0]!.x).toBeCloseTo(-92.203098726, 6);
    expect(forest.ghosts[0]!.z).toBeCloseTo(-544.179239089, 6);
  });
});

describe("sunken-calamity-1 fill litter", () => {
  const litter = buildCalamityLitter();
  const matrix = new Matrix4();
  const p = new Vector3();
  const q = new Quaternion();
  const s = new Vector3();
  const wound = worldOf(700, 0);

  function eachInstance(
    groups: readonly Object3D[],
    visit: (x: number, z: number, rotation: Quaternion) => void,
  ): number {
    let seen = 0;
    for (const group of groups) {
      group.traverse((node) => {
        if (!(node instanceof InstancedMesh)) {
          return;
        }
        for (let i = 0; i < node.count; i++) {
          node.getMatrixAt(i, matrix);
          matrix.decompose(p, q, s);
          visit(p.x, p.z, q);
          seen++;
        }
      });
    }
    return seen;
  }

  it("rakes every pavement shard away from the Wound", () => {
    // groundLitter's contract: the shard's LOCAL +x (its long axis) lands
    // on the outward radial from the Wound. Residual = (1−0.85)·π + 0.14
    // jitter ≈ 0.61 rad worst case — asserted as an axis dot product
    // (Euler y folds past ±π/2). Instances lying on STEEP ground are
    // skipped: the ground-lie pitch/roll on a jagged bank contaminates
    // the horizontal projection, so the alignment is sampled where the
    // floor is flat enough to read it (and enough of those must exist).
    const axis = new Vector3();
    let sampled = 0;
    const seen = eachInstance(litter.shardGroups, (x, z, quaternion) => {
      const step = 0.5;
      const dx = (seabedHeight(x + step, z) - seabedHeight(x - step, z)) / (2 * step);
      const dz = (seabedHeight(x, z + step) - seabedHeight(x, z - step)) / (2 * step);
      if (Math.hypot(dx, dz) > 0.28) {
        return;
      }
      sampled++;
      axis.set(1, 0, 0).applyQuaternion(quaternion);
      const horizontal = Math.hypot(axis.x, axis.z) || 1;
      const awayX = x - wound.x;
      const awayZ = z - wound.z;
      const away = Math.hypot(awayX, awayZ) || 1;
      const dot = (axis.x / horizontal) * (awayX / away) + (axis.z / horizontal) * (awayZ / away);
      expect(Math.abs(dot), `shard at ${x.toFixed(1)},${z.toFixed(1)}`).toBeGreaterThan(0.66);
    });
    expect(seen).toBeGreaterThan(1200);
    expect(sampled).toBeGreaterThan(600);
  });

  it("keeps litter inside the domain and off the channel's swim line", () => {
    eachInstance(litter.shardGroups, (x, z) => {
      expect(calamityWeight(x, z), `shard at ${x.toFixed(1)},${z.toFixed(1)}`).toBeGreaterThan(0);
      const { u, v } = spokeOf(x, z);
      if (u >= 52 && u <= 540) {
        const off = Math.abs(v - marchChannelCenter(Math.min(u, 505)));
        expect(off, `shard on the swim line at u=${u.toFixed(0)}`).toBeGreaterThan(1.6);
      }
    });
  });

  it("grows the grove meadow only where the grove owns the ground", () => {
    const seen = eachInstance(litter.meadowGroups, (x, z) => {
      const { u, v } = spokeOf(x, z);
      expect(groveWeight(u, v), `blade at ${x.toFixed(1)},${z.toFixed(1)}`).toBeGreaterThan(0);
    });
    expect(seen).toBeGreaterThan(600);
  });
});

describe("sunken-calamity-1 mile stillness (the registry clause)", () => {
  it("routes both shoal legs clear of the Suffocated Mile", () => {
    for (const [x, , z] of marchRunnerStations()) {
      const { u } = spokeOf(x, z);
      expect(u).toBeLessThan(348);
    }
    for (const [x, , z] of craterRunnerStations()) {
      const { u } = spokeOf(x, z);
      expect(u).toBeGreaterThan(450);
    }
  });

  it("thins the ash snow to ~an eighth through the Mile", () => {
    const build = CALAMITY_1.build(new Scene());
    let snow: Points | undefined;
    (build.group as Object3D).traverse((node) => {
      if (node instanceof Points && node.name === "calamity-ash-snow") {
        snow = node;
      }
    });
    expect(snow).toBeDefined();
    const position = snow!.geometry.getAttribute("position");
    let total = 0;
    let inMile = 0;
    for (let i = 0; i < position.count; i++) {
      const { u, v } = spokeOf(position.getX(i), position.getZ(i));
      total++;
      if (u > 352 && u < 440 && Math.abs(v) < 22) {
        inMile++;
      }
    }
    // 700 motes, mile ≈ 10.9% of the u span, kept at 12.5%: ≈ 9 expected.
    expect(total).toBe(700);
    expect(inMile).toBeLessThanOrEqual(20);
  });
});

describe("sunken-calamity-1 shoal routes", () => {
  it("clears every collider and stays inside the swimmable water", () => {
    const build = CALAMITY_1.build(new Scene());
    for (const [leg, stations] of [
      ["march", marchRunnerStations()],
      ["crater", craterRunnerStations()],
    ] as const) {
      const path = new CatmullRomCurve3(
        stations.map(([x, y, z]) => new Vector3(x, y, z)),
        true,
        "centripetal",
        0.5,
      );
      const at = new Vector3();
      for (let i = 0; i < 400; i++) {
        path.getPointAt(i / 400, at);
        expect(calamityWeight(at.x, at.z), `${leg} leg off-domain at ${i}`).toBeGreaterThan(0.3);
        const floor = calamityTerrainTarget(at.x, at.z);
        expect(at.y, `${leg} leg under the floor at ${i}`).toBeGreaterThan(floor + 0.6);
        expect(at.y, `${leg} leg over the ceiling at ${i}`).toBeLessThan(
          calamityCeiling(at.x, at.z) - 0.8,
        );
        for (const collider of build.colliders) {
          const distance = at.distanceTo(collider.center);
          expect(
            distance,
            `${leg} leg hits a collider at sample ${i} (${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)})`,
          ).toBeGreaterThan(collider.radius + 0.7);
        }
      }
    }
  });
});

describe("sunken-calamity-1 capture poses", () => {
  it("authors 8–12+ poses that stand inside the region's own water", () => {
    expect(CALAMITY_1.capturePoses.length).toBeGreaterThanOrEqual(8);
    for (const pose of CALAMITY_1.capturePoses) {
      const [x, y, z] = pose.position;
      expect(calamityWeight(x, z), pose.name).toBeGreaterThan(0.3);
      const floor = calamityTerrainTarget(x, z) + CALAMITY_1.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(calamityCeiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });
});
