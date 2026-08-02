import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Points,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from "three";
import { describe, expect, it } from "vitest";
import { buildBeamAndPool } from "../src/world/regions/kit/BeamAndPool";
import { buildDappleSheet } from "../src/world/regions/kit/DappleSheet";
import { buildFallSheets, buildFallStreakTexture } from "../src/world/regions/kit/FallStreak";
import { buildGateVeil } from "../src/world/regions/kit/GateVeil";
import { buildGlowColony } from "../src/world/regions/kit/GlowColony";
import { buildParticulateField } from "../src/world/regions/kit/ParticulateField";
import { buildPercherColony } from "../src/world/regions/kit/PercherColony";
import { buildShoalRunner } from "../src/world/regions/kit/ShoalRunner";
import type { KitBuild } from "../src/world/regions/kit/KitTypes";

/**
 * Package B's kit contracts (KIT-SPEC §5): per piece, the four mandatory
 * cases — seeded determinism (and that the seed is really consumed),
 * budget honesty counted off the meshes actually built, plain-Node
 * construction (this whole file IS that proof — no DOM anywhere), and
 * containment/bounds/dispose — plus the piece-specific additions:
 * glowColony's caps, the additive discipline on beamAndPool / gateVeil /
 * fallStreak, and shoalRunner's loop continuity and time determinism.
 */

// ─── Shared probes ───────────────────────────────────────────────────────────

/** A deterministic wavy test floor, nowhere near the real terrain. */
const ground = (x: number, z: number): number => -2 + Math.sin(x * 0.21) * 0.4 + Math.cos(z * 0.17) * 0.3;

type Updatable = KitBuild & { update?(timeSec: number): void };

/** Every float buffer a build owns — geometry, instances, and any
 *  DataTexture texels (dappleSheet's seed lives in its textures). */
function collectBuffers(build: KitBuild): Float32Array[] {
  const buffers: Float32Array[] = [];
  build.group.traverse((node: Object3D) => {
    const mesh = node as Mesh | InstancedMesh | Points;
    const geometry = (mesh as Mesh).geometry as BufferGeometry | undefined;
    if (!geometry) {
      return;
    }
    for (const name of Object.keys(geometry.attributes)) {
      buffers.push(new Float32Array(geometry.attributes[name]!.array as ArrayLike<number>));
    }
    if (mesh instanceof InstancedMesh) {
      buffers.push(new Float32Array(mesh.instanceMatrix.array));
      if (mesh.instanceColor) {
        buffers.push(new Float32Array(mesh.instanceColor.array));
      }
    }
    const material = (mesh as Mesh).material as { map?: { image?: { data?: Uint8Array } } };
    const texels = material?.map?.image?.data;
    if (texels instanceof Uint8Array) {
      buffers.push(Float32Array.from(texels));
    }
  });
  return buffers;
}

function expectByteEqual(a: Float32Array[], b: Float32Array[]): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(Buffer.compare(Buffer.from(a[i]!.buffer), Buffer.from(b[i]!.buffer)), `buffer ${i}`).toBe(0);
  }
}

function buffersDiffer(a: Float32Array[], b: Float32Array[]): boolean {
  if (a.length !== b.length) {
    return true;
  }
  for (let i = 0; i < a.length; i++) {
    if (Buffer.compare(Buffer.from(a[i]!.buffer), Buffer.from(b[i]!.buffer)) !== 0) {
      return true;
    }
  }
  return false;
}

/** Renderables (draw calls) and triangles, counted off the real meshes. */
function countGroup(build: KitBuild): { draws: number; triangles: number } {
  let draws = 0;
  let triangles = 0;
  build.group.traverse((node: Object3D) => {
    if (node instanceof Points) {
      draws += 1;
      return;
    }
    if (node instanceof Mesh) {
      draws += 1;
      const geometry = node.geometry as BufferGeometry;
      const per = (geometry.index?.count ?? geometry.attributes.position!.count) / 3;
      triangles += per * (node instanceof InstancedMesh ? node.count : 1);
    }
  });
  return { draws, triangles };
}

/** All instance translations of the first InstancedMesh in a build. */
function instanceTranslations(build: KitBuild): Vector3[] {
  let mesh: InstancedMesh | null = null;
  build.group.traverse((node) => {
    if (node instanceof InstancedMesh && !mesh) {
      mesh = node;
    }
  });
  expect(mesh).not.toBeNull();
  const found = mesh as unknown as InstancedMesh;
  const out: Vector3[] = [];
  const matrix = new Matrix4();
  for (let i = 0; i < found.count; i++) {
    found.getMatrixAt(i, matrix);
    out.push(new Vector3().setFromMatrixPosition(matrix));
  }
  return out;
}

function expectDisposedClean(build: KitBuild): void {
  const parent = new Group();
  parent.add(build.group);
  build.dispose();
  expect(build.group.children.length).toBe(0);
  expect(build.group.parent).toBeNull();
}

/** The reference option set per piece, seed-parameterised. */
const REFERENCE: Record<string, (seed: number) => Updatable> = {
  shoalRunner: (seed) =>
    buildShoalRunner({
      seed,
      route: {
        stations: [
          [24, -1, 38],
          [34, 0.5, 44],
          [44, 1, 36],
          [38, 0, 26],
          [28, -0.5, 28],
        ],
        closed: true,
      },
      count: 40,
      fish: { scale: 1.2, color: 0xcdeedd, emissive: 0x3a5f52 },
      phaseSpeed: 1 / 32,
      braid: { lateral: 0.3, vertical: 0.2 },
      glint: { count: 20, size: 0.12 },
    }),
  percherColony: (seed) =>
    buildPercherColony({
      seed,
      palette: { base: 0x2e8a5e, tip: 0xc9b45e, shade: 0x1e5a44 },
      anchors: [
        { pos: [30, -1.5, 40] },
        { pos: [32, -1.2, 42], normal: [0.2, 0.9, 0.1] },
        { pos: [29, -1.8, 43] },
      ],
      perAnchor: 4,
      body: "star",
      motion: "seated",
    }),
  glowColony: (seed) =>
    buildGlowColony({
      seed,
      tint: 0x9fe8e0,
      anchors: [
        [30, -1.6, 40],
        [32.5, -1.4, 41.5],
      ],
      budsPerAnchor: 5,
      glow: 0.3,
    }),
  particulateField: (seed) =>
    buildParticulateField({
      seed,
      tint: 0xe8d29a,
      count: 150,
      mode: "fall",
      volume: { center: [30, 2, 40], size: [8, 6, 8] },
      opacity: 0.5,
      bias: { dir: [0.3, 0, 0.1], speed: 0.2 },
    }),
  beamAndPool: (seed) =>
    buildBeamAndPool({
      seed,
      tint: 0xffe2ae,
      ground,
      beams: [
        { pos: [28, 38], top: 8, width: 3.4, opacity: 0.12 },
        { pos: [34, 42], top: 7, width: 2.6, opacity: 0.1, slant: [0.3, -0.1] },
      ],
    }),
  dappleSheet: (seed) =>
    buildDappleSheet({
      seed,
      tint: 0xffd98c,
      ground,
      area: { center: [30, 40], radius: 8 },
      opacity: 0.22,
    }),
  gateVeil: (seed) =>
    buildGateVeil({
      seed,
      doorway: { pos: [30, -2, 40], facing: 0.6, width: 6, height: 5 },
      palette: [0x123526, 0x22553c, 0x3e7a58],
      particulate: { tint: 0xdce8a8, count: 60 },
      column: { tint: 0xe4f0c0, opacity: 0.12 },
    }),
  fallStreak: (seed) =>
    buildFallSheets({
      seed,
      texture: buildFallStreakTexture({ seed: seed ^ 0x7e, columns: 5, softness: 0.5 }),
      tint: 0xfff0d0,
      sheets: [
        { pos: [28, -2, 38], width: 4, height: 6, phase: 0 },
        { pos: [31, -2, 38.4], width: 2.5, height: 5, phase: 0.4, facing: 0.3 },
      ],
      opacity: 0.18,
    }),
};

/** Published budget shapes at the reference options (draws, tri ceiling). */
const BUDGET: Record<string, { draws: number; maxTriangles: number }> = {
  shoalRunner: { draws: 2, maxTriangles: 5000 },
  percherColony: { draws: 1, maxTriangles: 1200 },
  glowColony: { draws: 2, maxTriangles: 1000 },
  particulateField: { draws: 1, maxTriangles: 0 },
  beamAndPool: { draws: 2, maxTriangles: 1600 },
  dappleSheet: { draws: 2, maxTriangles: 1200 },
  gateVeil: { draws: 5, maxTriangles: 2000 },
  fallStreak: { draws: 1, maxTriangles: 400 },
};

// ─── The four mandatory contracts, per piece ─────────────────────────────────

for (const [name, make] of Object.entries(REFERENCE)) {
  describe(`kit piece ${name}`, () => {
    it("is byte-deterministic given a seed, and the seed is consumed", () => {
      const first = make(0xb0b0);
      const second = make(0xb0b0);
      first.update?.(2.5);
      second.update?.(2.5);
      expectByteEqual(collectBuffers(first), collectBuffers(second));

      const reseeded = make(0xb0b0 ^ 1);
      reseeded.update?.(2.5);
      expect(buffersDiffer(collectBuffers(first), collectBuffers(reseeded)), "seed ^ 1 must reroll").toBe(
        true,
      );
      first.dispose();
      second.dispose();
      reseeded.dispose();
    });

    it("declares an honest budget inside its published shape", () => {
      const build = make(0xb0b0);
      const counted = countGroup(build);
      expect(build.draws, "declared draws").toBe(counted.draws);
      expect(Math.round(build.triangles), "declared triangles").toBe(Math.round(counted.triangles));
      const budget = BUDGET[name]!;
      expect(counted.draws).toBeLessThanOrEqual(budget.draws);
      expect(counted.triangles).toBeLessThanOrEqual(budget.maxTriangles);
      build.dispose();
    });

    it("constructs in plain Node (no window, no assets awaited)", () => {
      expect(typeof window).toBe("undefined");
      const build = make(0xb0b0);
      expect(build.group.children.length).toBeGreaterThan(0);
      build.dispose();
    });

    it("carries instance-aware bounds and disposes to an empty, detached group", () => {
      const build = make(0xb0b0);
      build.group.traverse((node) => {
        if (node instanceof InstancedMesh) {
          expect(node.geometry.boundingSphere ?? node.boundingSphere, "a bounding sphere").toBeTruthy();
          const sphere = node.boundingSphere;
          expect(sphere).not.toBeNull();
          // The reference sets stand ~50 m off origin: an origin-centred
          // sphere is the sill-stones trap this asserts against.
          expect(sphere!.center.length()).toBeGreaterThan(5);
        }
      });
      expectDisposedClean(build);
    });
  });
}

// ─── Containment, proved per piece ───────────────────────────────────────────

describe("containment", () => {
  it("particulateField stays wrapped inside its volume (with sway margin) on any clock", () => {
    const build = REFERENCE.particulateField!(0x77aa) as Updatable;
    for (const t of [0, 3.7, 111.2]) {
      build.update?.(t);
      const positions = (
        (build.group.children[0] as Points).geometry.attributes.position!.array as Float32Array
      ) as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        expect(Math.abs(positions[i]! - 30)).toBeLessThanOrEqual(4 + 2);
        expect(Math.abs(positions[i + 1]! - 2)).toBeLessThanOrEqual(3 + 2);
        expect(Math.abs(positions[i + 2]! - 40)).toBeLessThanOrEqual(4 + 2);
      }
    }
    build.dispose();
  });

  it("percherColony seats every body within its anchor spread", () => {
    const build = REFERENCE.percherColony!(0x77ab);
    const anchors = [new Vector3(30, -1.5, 40), new Vector3(32, -1.2, 42), new Vector3(29, -1.8, 43)];
    for (const at of instanceTranslations(build)) {
      const nearest = Math.min(...anchors.map((anchor) => anchor.distanceTo(at)));
      expect(nearest).toBeLessThanOrEqual(0.5);
    }
    build.dispose();
  });

  it("glowColony keeps buds by their anchors and halos above the tips", () => {
    const build = REFERENCE.glowColony!(0x77ac);
    const anchors = [new Vector3(30, -1.6, 40), new Vector3(32.5, -1.4, 41.5)];
    const buds = instanceTranslations(build);
    for (const at of buds) {
      const nearest = Math.min(
        ...anchors.map((anchor) => Math.hypot(anchor.x - at.x, anchor.z - at.z)),
      );
      expect(nearest).toBeLessThanOrEqual(0.5);
    }
    const halos = build.group.children.find((child): child is Points => child instanceof Points)!;
    const positions = halos.geometry.attributes.position!.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      // Just ABOVE the bud tips — the depth-test lesson, held by a test.
      expect(positions[i + 1]!).toBeGreaterThan(-1.6 + 0.02);
    }
    build.dispose();
  });

  it("shoalRunner keeps every fish near its route and the glint inside its authored sphere", () => {
    const build = REFERENCE.shoalRunner!(0x77ad) as Updatable;
    const stations = [
      new Vector3(24, -1, 38),
      new Vector3(34, 0.5, 44),
      new Vector3(44, 1, 36),
      new Vector3(38, 0, 26),
      new Vector3(28, -0.5, 28),
    ];
    const centre = stations.reduce((sum, s) => sum.add(s), new Vector3()).divideScalar(stations.length);
    const reach = Math.max(...stations.map((s) => s.distanceTo(centre))) + 3;
    build.update?.(17.3);
    for (const at of instanceTranslations(build)) {
      expect(at.distanceTo(centre)).toBeLessThanOrEqual(reach);
    }
    const glints = build.group.children.find((child): child is Points => child instanceof Points)!;
    expect(glints.geometry.boundingSphere).not.toBeNull();
    const positions = glints.geometry.attributes.position!.array as Float32Array;
    const sphere = glints.geometry.boundingSphere!;
    for (let i = 0; i < positions.length; i += 3) {
      const at = new Vector3(positions[i]!, positions[i + 1]!, positions[i + 2]!);
      expect(sphere.containsPoint(at)).toBe(true);
    }
    build.dispose();
  });

  it("dappleSheet stays inside its area's box and reaches zero at the rim", () => {
    const build = REFERENCE.dappleSheet!(0x77ae);
    for (const child of build.group.children) {
      const geometry = (child as Mesh).geometry as BufferGeometry;
      const positions = geometry.attributes.position!.array as Float32Array;
      const colors = geometry.attributes.color!.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        expect(Math.abs(positions[i]! - 30)).toBeLessThanOrEqual(8.01);
        expect(Math.abs(positions[i + 2]! - 40)).toBeLessThanOrEqual(8.01);
        const radial = Math.hypot(positions[i]! - 30, positions[i + 2]! - 40);
        if (radial > 7.9) {
          expect(colors[i]!).toBeLessThanOrEqual(0.02);
        }
      }
    }
    build.dispose();
  });
});

// ─── Piece-specific disciplines ──────────────────────────────────────────────

describe("glowColony caps", () => {
  it("clamps emissive to 0.36 and halo opacity to 0.28, whatever the caller asks", () => {
    const build = buildGlowColony({
      seed: 0x900d,
      tint: 0xffb070,
      anchors: [[10, 0, 10]],
      budsPerAnchor: 4,
      glow: 0.9,
    });
    const buds = build.group.children.find(
      (child): child is InstancedMesh => child instanceof InstancedMesh,
    )!;
    expect(
      (buds.material as unknown as { emissiveIntensity: number }).emissiveIntensity,
    ).toBeLessThanOrEqual(0.36);
    const halos = build.group.children.find((child): child is Points => child instanceof Points)!;
    expect((halos.material as { opacity: number }).opacity).toBeLessThanOrEqual(0.28);
    build.dispose();
  });
});

describe("percherColony star body (R12)", () => {
  it("publishes the authored five-arm star at 100 tris per body, five real arms", () => {
    const build = REFERENCE.percherColony!(0x900e);
    // 3 anchors × 4 bodies × the polar dome's 100 triangles.
    expect(build.triangles).toBe(12 * 100);
    // The arm profile is in the topology: the outer ring's radius must
    // swing between arm tips and valleys (the q-r1 "green blob" failure
    // was a lattice that could not carry the swing).
    let mesh: InstancedMesh | null = null;
    build.group.traverse((node) => {
      if (node instanceof InstancedMesh && !mesh) {
        mesh = node;
      }
    });
    const geometry = (mesh as unknown as InstancedMesh).geometry;
    const position = geometry.attributes.position!;
    let minR = Infinity;
    let maxR = 0;
    for (let i = 1 + 40; i < 1 + 60; i++) {
      const r = Math.hypot(position.getX(i), position.getZ(i));
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
    }
    expect(maxR / minR).toBeGreaterThan(1.8);
    build.dispose();
  });
});

describe("the additive light discipline", () => {
  it("beamAndPool: fog off, depth-write off, and the 0.3 cap lives in the buffers", () => {
    const build = buildBeamAndPool({
      seed: 0xadd1,
      tint: 0xffffff,
      ground,
      beams: [{ pos: [0, 0], top: 8, width: 3, opacity: 0.9 }],
      pools: [{ pos: [0, 0], radius: 2, opacity: 0.9 }],
    });
    for (const child of build.group.children) {
      const material = (child as Mesh).material as MeshBasicMaterial;
      expect(material.fog).toBe(false);
      expect(material.depthWrite).toBe(false);
      expect(material.transparent).toBe(true);
      const colors = ((child as Mesh).geometry as BufferGeometry).attributes.color!
        .array as Float32Array;
      for (const value of colors) {
        expect(value).toBeLessThanOrEqual(0.3 + 1e-6);
      }
    }
    build.dispose();
  });

  it("gateVeil: every mark is fog:false and depth-write off; planes hold the 0.2 cap and ≤ 5 draws", () => {
    const build = REFERENCE.gateVeil!(0xadd2);
    expect(build.draws).toBeLessThanOrEqual(5);
    let planes = 0;
    build.group.traverse((node) => {
      if (!(node instanceof Mesh) && !(node instanceof Points)) {
        return;
      }
      const material = (node as Mesh).material as MeshBasicMaterial;
      expect(material.depthWrite, node.name).toBe(false);
      if (node.name.startsWith("kit-gate-veil-plane")) {
        planes += 1;
        expect(material.fog).toBe(false);
        expect(material.opacity).toBeLessThanOrEqual(0.2 + 1e-6);
        // The dissolve: RGBA colours with alpha reaching zero at the top.
        const colors = (node.geometry as BufferGeometry).attributes.color!;
        expect(colors.itemSize).toBe(4);
        let minAlpha = 1;
        for (let i = 0; i < colors.count; i++) {
          minAlpha = Math.min(minAlpha, colors.getW(i));
        }
        expect(minAlpha).toBeLessThanOrEqual(1e-6);
      }
    });
    expect(planes).toBe(3);
    build.dispose();
  });

  it("fallStreak: fog off, depth-write off, the 0.2 cap held, and the scroll really moves", () => {
    const texture = buildFallStreakTexture({ seed: 0xadd3, columns: 5, softness: 0.5 });
    const build = buildFallSheets({
      seed: 0xadd4,
      texture,
      tint: 0xffffff,
      sheets: [{ pos: [0, 0, 0], width: 4, height: 6, phase: 0 }],
      opacity: 0.9,
    });
    const material = (build.group.children[0] as Mesh).material as MeshBasicMaterial;
    expect(material.fog).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(material.opacity).toBeLessThanOrEqual(0.2 + 1e-6);
    build.update(3);
    const before = texture.offset.y;
    build.update(4);
    expect(texture.offset.y).not.toBe(before);
    build.dispose();
    texture.dispose();
  });
});

describe("shoalRunner's clock", () => {
  it("holds loop continuity: phase 0 and phase 1 are the same matrices to the byte", () => {
    // phaseSpeed 1/32 and t = 32 make the wrapped phase EXACTLY 0 again.
    const build = REFERENCE.shoalRunner!(0xc10c) as Updatable;
    build.update?.(0);
    const atZero = collectBuffers(build);
    build.update?.(32);
    expectByteEqual(atZero, collectBuffers(build));
    build.dispose();
  });

  it("is time-deterministic: the same timeSec lands on the same matrices via any dt path", () => {
    const direct = REFERENCE.shoalRunner!(0xc10d) as Updatable;
    direct.update?.(7.25);
    const stepped = REFERENCE.shoalRunner!(0xc10d) as Updatable;
    for (const t of [0.4, 1.9, 3.3, 5.05, 6.6, 7.25]) {
      stepped.update?.(t);
    }
    expectByteEqual(collectBuffers(direct), collectBuffers(stepped));
    direct.dispose();
    stepped.dispose();
  });

  it("shares a timetable across a streaming split: two same-seed runners agree", () => {
    const wingLeg = REFERENCE.shoalRunner!(0x5eed) as Updatable;
    const regionLeg = REFERENCE.shoalRunner!(0x5eed) as Updatable;
    wingLeg.update?.(41.7);
    regionLeg.update?.(41.7);
    expectByteEqual(collectBuffers(wingLeg), collectBuffers(regionLeg));
    wingLeg.dispose();
    regionLeg.dispose();
  });
});

describe("fallStreak's texture", () => {
  it("is a deterministic DataTexture whose bytes follow the seed", () => {
    const a = buildFallStreakTexture({ seed: 0xf00, columns: 5, softness: 0.5 });
    const b = buildFallStreakTexture({ seed: 0xf00, columns: 5, softness: 0.5 });
    const c = buildFallStreakTexture({ seed: 0xf01, columns: 5, softness: 0.5 });
    const bytesA = a.image.data as Uint8Array;
    const bytesB = b.image.data as Uint8Array;
    const bytesC = c.image.data as Uint8Array;
    expect(Buffer.compare(Buffer.from(bytesA), Buffer.from(bytesB))).toBe(0);
    expect(Buffer.compare(Buffer.from(bytesA), Buffer.from(bytesC))).not.toBe(0);
    a.dispose();
    b.dispose();
    c.dispose();
  });
});
