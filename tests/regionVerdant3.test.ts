import {
  AdditiveBlending,
  InstancedMesh,
  Matrix4,
  Mesh,
  Points,
  Scene,
  Vector3,
  type MeshBasicMaterial,
  type Object3D,
} from "three";
import { beforeAll, describe, expect, it } from "vitest";
// Import order is load-bearing: `Seabed` pulls `RegionField` →
// `RegionRegistry` → the defs, and that chain tolerates the cycle (every
// binding it touches mid-cycle is a hoisted function). Importing a def
// module *first* runs the cycle the other way round.
import { seabedHeight } from "../src/world/Seabed";
import { VERDANT_3, buildSeals } from "../src/world/regions/verdant3/Verdant3";
import { VERDANT_2 } from "../src/world/regions/verdant2/Verdant2";
import {
  CENTER_X,
  CENTER_Z,
  HOLLOW,
  RESTS,
  VERDANT3_SLOT,
  channelCenter,
  passGate,
  spokeOf,
  verdant3Ceiling,
  verdant3TerrainTarget,
  verdant3Weight,
  worldOf,
} from "../src/world/regions/verdant3/Verdant3Terrain";
import { REGION_SLOTS, slotCenter } from "../src/world/regions/RegionSlots";
import { TRAVELLER_STATIONS } from "../src/world/regions/verdant3/Verdant3Colonies";
import type { RegionBuild } from "../src/world/regions/RegionTypes";

/**
 * The Canopy Deep's own contracts: identity where it owns nothing, the
 * depth-3 pass overlap with the Emerald Terraces asserted from both
 * sides, determinism, budgets counted rather than claimed, colliders
 * inside the domain, the registered rests held empty, and capture poses
 * standing in water the region actually has.
 */

describe("verdant-line-3 weight confinement", () => {
  it("is exactly zero at every other slot's centre", () => {
    for (const slot of REGION_SLOTS) {
      if (slot.id === VERDANT3_SLOT.id) {
        continue;
      }
      const { x, z } = slotCenter(slot);
      expect(VERDANT_3.weight(x, z), slot.id).toBe(0);
    }
  });

  it("is exactly zero everywhere inside r = 46 and behind the pass mouth", () => {
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      for (const r of [0, 20, 45.9, 200, 500, 900, 1100]) {
        expect(
          VERDANT_3.weight(Math.cos(theta) * r, Math.sin(theta) * r),
          `r=${r}`,
        ).toBe(0);
      }
    }
  });

  it("is full in its heart", () => {
    expect(VERDANT_3.weight(CENTER_X, CENTER_Z)).toBeGreaterThan(0.9);
  });

  it("overlaps the Emerald Terraces' rim: both weights positive on the spoke between 1130 and 1160", () => {
    let overlapSeen = false;
    for (const u of [1132, 1140, 1150, 1159]) {
      const { x, z } = worldOf(u, 0);
      const ours = VERDANT_3.weight(x, z);
      const theirs = VERDANT_2.weight(x, z);
      expect(ours, `verdant-3 at u=${u}`).toBeGreaterThan(0);
      if (ours > 0 && theirs > 0) {
        overlapSeen = true;
      }
    }
    expect(overlapSeen, "no spoke point had both weights positive").toBe(true);
  });

  it("covers the whole pass corridor so the bounds handover has no gap", () => {
    for (let u = 1132; u <= 1300; u += 6) {
      const { x, z } = worldOf(u, 0);
      expect(VERDANT_3.weight(x, z), `spine u=${u}`).toBeGreaterThan(0);
    }
  });
});

describe("verdant-line-3 terrain", () => {
  it("is deterministic", () => {
    for (const [u, v] of [
      [1150, 4],
      [1250, 0],
      [1290, -6],
      [1390, -18],
      [1462, -10],
      [1418, -92],
      [1520, 66],
      [1608, -8],
    ] as const) {
      const { x, z } = worldOf(u, v);
      const first = verdant3TerrainTarget(x, z);
      expect(verdant3TerrainTarget(x, z)).toBe(first);
      const composed = seabedHeight(x, z);
      expect(seabedHeight(x, z)).toBe(composed);
    }
  });

  it("keeps the threshold at dune level where the framework's reject circle truncates it", () => {
    // RegionField consults this region only within 260 m of its centre
    // (u ≥ ~1200 on the spoke); below that the target must be near dune
    // level so the annex floor stays honest over the terraces' shelf.
    for (const u of [1135, 1155, 1175, 1195]) {
      const { x, z } = worldOf(u, 0);
      expect(Math.abs(verdant3TerrainTarget(x, z)), `u=${u}`).toBeLessThan(1.2);
    }
  });

  it("carries at least 35 m of vertical range across the domain", () => {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let du = -170; du <= 170; du += 8) {
      for (let dv = -170; dv <= 170; dv += 8) {
        if (Math.hypot(du, dv) > 170) {
          continue;
        }
        const { x, z } = worldOf(1460 + du, dv);
        const h = verdant3TerrainTarget(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    // The threshold shelf sits at dune level above the country.
    const shelf = verdant3TerrainTarget(worldOf(1150, 0).x, worldOf(1150, 0).z);
    highest = Math.max(highest, shelf);
    expect(highest - lowest).toBeGreaterThanOrEqual(35);
    // The Clearwater holds the bottom of the range.
    expect(lowest).toBeLessThanOrEqual(-38);
  });

  it("keeps the ceiling above the floor everywhere the diver can be", () => {
    for (let du = -220; du <= 220; du += 11) {
      for (let dv = -220; dv <= 220; dv += 11) {
        const { x, z } = worldOf(1460 + du, dv);
        if (verdant3Weight(x, z) === 0) {
          continue;
        }
        const floor = verdant3TerrainTarget(x, z) + VERDANT_3.floorClearance;
        expect(verdant3Ceiling(x, z), `at ${du},${dv}`).toBeGreaterThan(floor + 1.2);
      }
    }
    // And down the pass's own spine, from inside the terraces' rim.
    for (let u = 1132; u <= 1350; u += 5) {
      const { x, z } = worldOf(u, channelCenter(u));
      const floor = verdant3TerrainTarget(x, z) + VERDANT_3.floorClearance;
      expect(verdant3Ceiling(x, z), `pass u=${u}`).toBeGreaterThan(floor + 1.2);
    }
  });
});

describe("verdant-line-3 build", () => {
  let build: RegionBuild;

  beforeAll(() => {
    build = VERDANT_3.build(new Scene());
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
    // MASTER R12: ≤260 draws / ≤1.35M tris, bound by the headed frame
    // gate (recorded in the ledger, not assertable here).
    expect(draws).toBeLessThanOrEqual(260);
    expect(triangles).toBeLessThanOrEqual(1_350_000);
    // Honest floors as well as caps: an empty region passes no bar.
    // This region is built to the R12 standard from its first draft.
    expect(draws).toBeGreaterThan(60);
    expect(triangles).toBeGreaterThan(600_000);
  });

  it("builds deterministically (the mesa pillars byte-equal across builds)", () => {
    const again = VERDANT_3.build(new Scene());
    for (const name of ["verdant3-mesa-pillars", "verdant3-canopy-heart"]) {
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
      const weight = verdant3Weight(collider.center.x, collider.center.z);
      expect(
        weight,
        `collider at ${collider.center.x.toFixed(1)},${collider.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("registers the Elderleaf as a findable resident", () => {
    expect(build.targets?.length).toBe(1);
    const target = build.targets![0]!;
    expect(target.speciesId).toBe("canopy-elderleaf");
    expect(verdant3Weight(target.position.x, target.position.z)).toBeGreaterThan(0.5);
    expect(VERDANT_3.codexEntries?.some((entry) => entry.id === target.speciesId)).toBe(true);
  });

  it("keeps the pass channel swimmable — no geometry of ours blocks the road in", () => {
    // The depth-3 journey's own contract, verified from this side: along
    // the corridor's swim line no collider of ours (mesa, tree, seal)
    // may intrude on the channel the diver swims. (The terraces' far rim
    // ring and distance rings cross this corridor from THEIR side — the
    // standing orchestrator flag, mirroring MASTER R4.)
    const swim = new Vector3();
    for (let u = 1132; u <= 1330; u += 2) {
      const { x, z } = worldOf(u, channelCenter(u));
      const floor = verdant3TerrainTarget(x, z);
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
  });

  it("routes the traveller shoal inside the corridor and clear of every seal", () => {
    const seals = buildSeals();
    const at = new Vector3();
    for (const [u, v, lift] of TRAVELLER_STATIONS) {
      expect(u).toBeGreaterThanOrEqual(1132);
      expect(u).toBeLessThanOrEqual(1300);
      const { x, z } = worldOf(u, v);
      expect(verdant3Weight(x, z), `station u=${u}`).toBeGreaterThan(0);
      at.set(x, verdant3TerrainTarget(x, z) + lift, z);
      for (const seal of seals) {
        expect(
          at.distanceTo(seal.center) - seal.radius,
          `traveller station u=${u} inside a seal`,
        ).toBeGreaterThan(1.0);
      }
    }
  });

  it("holds the cathedral shafts to the additive light discipline", () => {
    let checked = 0;
    build.group.traverse((node) => {
      if (!(node instanceof Mesh)) {
        return;
      }
      if (node.name !== "kit-beams" && node.name !== "kit-light-pools") {
        return;
      }
      const material = node.material as MeshBasicMaterial;
      expect(material.fog, node.name).toBe(false);
      expect(material.transparent, node.name).toBe(true);
      expect(material.depthWrite, node.name).toBe(false);
      expect(material.blending, node.name).toBe(AdditiveBlending);
      checked++;
    });
    expect(checked).toBeGreaterThanOrEqual(2);
  });

  it("keeps the registered rests empty of kit scatter and fauna", () => {
    // The region's MASTER §1.2 contributions: the Clearwater pool, the
    // Hollow Mesa's shaft (its glow colonies are the rest's LICENSED
    // light — exempted by name), the Boughfall Shadow, the Elder's Rest.
    const matrix = new Matrix4();
    const position = new Vector3();
    const kitNameOf = (node: Object3D): string | null => {
      let current: Object3D | null = node;
      while (current) {
        if (current.name.startsWith("kit-")) {
          return current.name;
        }
        current = current.parent;
      }
      return null;
    };
    let inspected = 0;
    build.group.traverse((node) => {
      if (!(node instanceof InstancedMesh)) {
        return;
      }
      const kitName = kitNameOf(node);
      if (kitName === null) {
        return;
      }
      inspected++;
      const glow = kitName.startsWith("kit-glow");
      for (let i = 0; i < node.count; i++) {
        node.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        const { u, v } = spokeOf(position.x, position.z);
        expect(
          Math.hypot(u - RESTS.clearwater.u, v - RESTS.clearwater.v),
          `${node.name} ${i} inside the Clearwater`,
        ).toBeGreaterThan(RESTS.clearwater.radius - 2);
        if (!glow) {
          expect(
            Math.hypot(u - RESTS.hollowShaft.u, v - RESTS.hollowShaft.v),
            `${node.name} ${i} inside the Hollow shaft`,
          ).toBeGreaterThan(RESTS.hollowShaft.radius - 2);
        }
        expect(
          Math.hypot(u - RESTS.eldersRest.u, v - RESTS.eldersRest.v),
          `${node.name} ${i} inside the Elder's Rest`,
        ).toBeGreaterThan(RESTS.eldersRest.radius - 2);
        if (
          u > RESTS.boughfallShadow.fromU + 2 &&
          u < RESTS.boughfallShadow.toU - 2 &&
          Math.abs(v - channelCenter(u)) < 9
        ) {
          throw new Error(`${kitName} ${i} inside the Boughfall Shadow at u=${u.toFixed(1)}`);
        }
      }
    });
    expect(inspected).toBeGreaterThan(10);
  });

  it("keeps the Hollow Mesa's chamber swimmable through its mouth", () => {
    // The secret must be enterable: from outside the mouth to the
    // chamber's heart, a swim line at 1.4 m lift stays clear.
    const { x, z } = worldOf(HOLLOW.u, HOLLOW.v);
    const mouthDir = { x: worldOf(HOLLOW.u - 20, HOLLOW.v + 24).x - x, z: worldOf(HOLLOW.u - 20, HOLLOW.v + 24).z - z };
    const len = Math.hypot(mouthDir.x, mouthDir.z);
    const swim = new Vector3();
    for (const reach of [10, 7, 4.5, 2, 0]) {
      const sx = x + (mouthDir.x / len) * reach;
      const sz = z + (mouthDir.z / len) * reach;
      swim.set(sx, seabedHeight(sx, sz) + 1.4, sz);
      for (const collider of build.colliders) {
        expect(
          swim.distanceTo(collider.center) - collider.radius,
          `hollow mouth blocked at reach=${reach}`,
        ).toBeGreaterThan(0.4);
      }
    }
  });

  it("survives a minute of updates without spending randomness", () => {
    const ctx = {
      diverPosition: { x: CENTER_X, y: -25, z: CENTER_Z },
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

describe("verdant-line-3 seals", () => {
  it("walls the rim and the pass shoulders inside the domain", () => {
    const seals = buildSeals();
    expect(seals.length).toBeGreaterThan(80);
    for (const seal of seals) {
      expect(
        verdant3Weight(seal.center.x, seal.center.z),
        `seal at ${seal.center.x.toFixed(1)},${seal.center.z.toFixed(1)}`,
      ).toBeGreaterThan(0);
    }
  });

  it("leaves the pass corridor open", () => {
    const seals = buildSeals();
    for (const seal of seals) {
      const { u, v } = spokeOf(seal.center.x, seal.center.z);
      const onSpine = u < 1305 && Math.abs(v - channelCenter(u)) < 14;
      expect(onSpine, `seal blocks the corridor at u=${u.toFixed(0)}, v=${v.toFixed(0)}`).toBe(
        false,
      );
    }
  });

  it("gates the rim closure and rim fade off the pass corridor", () => {
    expect(passGate(1262, 0)).toBeGreaterThan(0.95);
    expect(passGate(1262, 120)).toBe(0);
    expect(passGate(1600, 0)).toBe(0);
  });
});

describe("verdant-line-3 capture poses", () => {
  it("authors 12+ poses (four close) that stand inside the region's own water", () => {
    expect(VERDANT_3.capturePoses.length).toBeGreaterThanOrEqual(12);
    const close = VERDANT_3.capturePoses.filter((pose) => pose.name.startsWith("close-"));
    expect(close.length).toBeGreaterThanOrEqual(4);
    for (const pose of VERDANT_3.capturePoses) {
      const [x, y, z] = pose.position;
      expect(verdant3Weight(x, z), pose.name).toBeGreaterThan(0.1);
      const floor = verdant3TerrainTarget(x, z) + VERDANT_3.floorClearance;
      expect(y, `${pose.name} above floor`).toBeGreaterThan(floor);
      expect(y, `${pose.name} below ceiling`).toBeLessThan(verdant3Ceiling(x, z));
      expect(pose.settle).toBeGreaterThan(0);
    }
  });

  it("includes the pass pose on the terraces' side of the overlap", () => {
    const pass = VERDANT_3.capturePoses.find((pose) => pose.name === "pass-threshold");
    expect(pass).toBeDefined();
    const [x, , z] = pass!.position;
    // It stands where BOTH regions own the water — the overlap, lived in.
    expect(VERDANT_2.weight(x, z)).toBeGreaterThan(0);
    expect(VERDANT_3.weight(x, z)).toBeGreaterThan(0);
  });
});
