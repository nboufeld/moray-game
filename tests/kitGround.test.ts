import { BoxGeometry, BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { buildBushBank } from "../src/world/regions/kit/BushBank";
import { buildCarpetField } from "../src/world/regions/kit/CarpetField";
import { buildDriftDebris } from "../src/world/regions/kit/DriftDebris";
import { buildFarGrassCards } from "../src/world/regions/kit/FarGrassCards";
import { buildGroundLitter } from "../src/world/regions/kit/GroundLitter";
import { applyWallStrata } from "../src/world/regions/kit/KitPaint";
import { buildMatRings } from "../src/world/regions/kit/MatRings";
import { buildScreeApron } from "../src/world/regions/kit/ScreeApron";
import { buildSpongeCluster } from "../src/world/regions/kit/SpongeCluster";
import { buildWallDrapeBank } from "../src/world/regions/kit/WallDrape";
import type { KitBuild } from "../src/world/regions/kit/KitTypes";

/**
 * The kit test contracts (KIT-SPEC §5), Package A. Per piece, the four
 * mandatory contracts:
 *
 * 1. determinism given a seed (byte-equal buffers) + a real stream
 *    (seed ^ 1 differs);
 * 2. budget honesty (declared draws/triangles counted from the meshes
 *    actually created, inside the piece's published budget shape);
 * 3. no-window safety (this whole file runs in plain Node — each build
 *    below IS the proof, and one case pins the environment);
 * 4. containment & bounds (every instance passes the gate/area; instanced
 *    bounding spheres are instance-aware; dispose leaves the group empty
 *    and detached).
 *
 * Plus the piece-specific additions: groundLitter rake alignment and
 * wallStrataPaint byte-identity where the gate returns 0.
 */

// ─── Shared probes ───────────────────────────────────────────────────────────

const flatGround = (): number => 0;
const wavyGround = (x: number, z: number): number => Math.sin(x * 0.23) * 0.3 + Math.cos(z * 0.31) * 0.2;
const openGate = (): number => 1;

/** Every mesh under the group, in traversal order. */
function meshesOf(build: KitBuild): Mesh[] {
  const meshes: Mesh[] = [];
  build.group.traverse((node) => {
    if (node instanceof Mesh) {
      meshes.push(node);
    }
  });
  return meshes;
}

function trianglesOf(mesh: Mesh): number {
  const geometry = mesh.geometry;
  const index = geometry.getIndex();
  const per = index ? index.count / 3 : (geometry.getAttribute("position")?.count ?? 0) / 3;
  return mesh instanceof InstancedMesh ? per * mesh.count : per;
}

/** All the typed arrays a build's look lives in, in a stable order. */
function buffersOf(build: KitBuild): Float32Array[] {
  const buffers: Float32Array[] = [];
  for (const mesh of meshesOf(build)) {
    const geometry = mesh.geometry;
    for (const name of ["position", "color", "aPhase", "aReach"]) {
      const attribute = geometry.getAttribute(name);
      if (attribute) {
        buffers.push(attribute.array as Float32Array);
      }
    }
    if (mesh instanceof InstancedMesh) {
      buffers.push(mesh.instanceMatrix.array as Float32Array);
      if (mesh.instanceColor) {
        buffers.push(mesh.instanceColor.array as Float32Array);
      }
    }
  }
  return buffers;
}

function bytesEqual(a: Float32Array, b: Float32Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  const ua = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const ub = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < ua.length; i++) {
    if (ua[i] !== ub[i]) {
      return false;
    }
  }
  return true;
}

/** Contract 1: same options twice ⇒ byte-identical; seed ^ 1 ⇒ different. */
function expectDeterminism(builder: (seed: number) => KitBuild, seed: number): void {
  const first = builder(seed);
  const second = builder(seed);
  const flipped = builder(seed ^ 1);

  const a = buffersOf(first);
  const b = buffersOf(second);
  const c = buffersOf(flipped);
  expect(a.length).toBeGreaterThan(0);
  expect(a.length).toBe(b.length);
  for (const [index, buffer] of a.entries()) {
    expect(bytesEqual(buffer, b[index]!), `buffer ${index} byte-identical`).toBe(true);
  }
  const anyDiffers =
    a.length !== c.length || a.some((buffer, index) => !bytesEqual(buffer, c[index]!));
  expect(anyDiffers, "seed ^ 1 must actually reach the stream").toBe(true);

  first.dispose();
  second.dispose();
  flipped.dispose();
}

/** Contract 2: declared draws/triangles counted from what exists. */
function expectHonestBudget(build: KitBuild): void {
  const meshes = meshesOf(build);
  expect(build.draws).toBe(meshes.length);
  const triangles = meshes.reduce((sum, mesh) => sum + trianglesOf(mesh), 0);
  expect(build.triangles).toBe(Math.round(triangles));
}

/** Contract 4b: dispose leaves the group empty and detached. */
function expectCleanDispose(build: KitBuild): void {
  const parent = new Group();
  parent.add(build.group);
  build.dispose();
  expect(build.group.children.length).toBe(0);
  expect(build.group.parent).toBeNull();
}

/** World positions of every instance of every InstancedMesh in the build. */
function instancePositions(build: KitBuild): Vector3[] {
  const positions: Vector3[] = [];
  const matrix = new Matrix4();
  for (const mesh of meshesOf(build)) {
    if (!(mesh instanceof InstancedMesh)) {
      continue;
    }
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      positions.push(new Vector3().setFromMatrixPosition(matrix).add(mesh.position));
    }
  }
  return positions;
}

/** Contract 4a for instanced scatters: containment, gate, honest sphere. */
function expectContained(
  build: KitBuild,
  center: readonly [number, number],
  radius: number,
  gate: (x: number, z: number) => number,
): void {
  const positions = instancePositions(build);
  expect(positions.length).toBeGreaterThan(0);
  for (const position of positions) {
    const distance = Math.hypot(position.x - center[0], position.z - center[1]);
    expect(distance).toBeLessThanOrEqual(radius + 1e-6);
    expect(gate(position.x, position.z)).toBeGreaterThan(0);
  }
  for (const mesh of meshesOf(build)) {
    if (!(mesh instanceof InstancedMesh)) {
      continue;
    }
    // The instance-aware sphere lives on the MESH (three computes it off
    // the real matrices); the geometry's own sphere stays at the origin.
    const sphere = mesh.boundingSphere;
    expect(sphere, "instance-aware sphere computed at build").not.toBeNull();
    // Off-origin scatter ⇒ off-origin sphere (the sill-stones trap).
    expect(Math.hypot(sphere!.center.x, sphere!.center.z)).toBeGreaterThan(radius);
    expect(
      Math.hypot(sphere!.center.x - center[0], sphere!.center.z - center[1]),
    ).toBeLessThanOrEqual(radius + 2);
  }
}

/** An off-origin disc and a hard half-plane gate, shared by the scatters. */
const FAR_CENTER: [number, number] = [30, -40];
const FAR_DISC = { center: FAR_CENTER, radius: 6 };
const halfGate = (x: number): number => (x >= FAR_CENTER[0] ? 1 : 0);

const PALETTE = { base: 0x69c184, tip: 0xa8d98a, shade: 0x3c6b60, accent: 0x8cad57 } as const;

// ─── The environment (contract 3, stated once) ──────────────────────────────

describe("kit plain-Node safety", () => {
  it("runs without a window or document", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });
});

// ─── carpetField ─────────────────────────────────────────────────────────────

describe("carpetField", () => {
  const build = (
    seed: number,
    profile: "card" | "tuft" | "blade" | "frond" = "card",
  ): ReturnType<typeof buildCarpetField> =>
    buildCarpetField({
      seed,
      palette: PALETTE,
      area: FAR_DISC,
      gate: halfGate,
      ground: wavyGround,
      count: 150,
      profile,
      swayAmp: 0.06,
    });

  it("is deterministic given a seed and differs with seed ^ 1 (all four profiles)", () => {
    for (const profile of ["card", "tuft", "blade", "frond"] as const) {
      expectDeterminism((seed) => build(seed, profile), 0x11);
    }
  });

  it("declares an honest 1-draw budget: 4 card / 12 tuft / 48 blade / 60 frond tris", () => {
    const shapes = { card: 4, tuft: 12, blade: 48, frond: 60 } as const;
    for (const profile of ["card", "tuft", "blade", "frond"] as const) {
      const field = build(0x12, profile);
      expectHonestBudget(field);
      expect(field.draws).toBe(1);
      const mesh = meshesOf(field)[0] as InstancedMesh;
      expect(field.triangles).toBe(mesh.count * shapes[profile]);
      field.dispose();
    }
  });

  it("contains every instance in the gated area with honest bounds, and disposes clean", () => {
    for (const profile of ["card", "blade", "frond"] as const) {
      const field = build(0x13, profile);
      expectContained(field, FAR_CENTER, 6, halfGate);
      expectCleanDispose(field);
    }
  });

  it("advances sway without touching a buffer (capture-safe motion)", () => {
    const field = build(0x14);
    const before = buffersOf(field).map((buffer) => buffer.slice());
    field.update(12.34);
    const after = buffersOf(field);
    for (const [index, buffer] of after.entries()) {
      expect(bytesEqual(buffer, before[index]!)).toBe(true);
    }
    field.dispose();
  });

  it("keeps the R12 knobs opt-in: default ≡ looseShare 0.3, and sunGlow moves no buffer", () => {
    const plain = build(0x15);
    const explicit = buildCarpetField({
      seed: 0x15,
      palette: PALETTE,
      area: FAR_DISC,
      gate: halfGate,
      ground: wavyGround,
      count: 150,
      swayAmp: 0.06,
      looseShare: 0.3,
    });
    const glowing = buildCarpetField({
      seed: 0x15,
      palette: PALETTE,
      area: FAR_DISC,
      gate: halfGate,
      ground: wavyGround,
      count: 150,
      swayAmp: 0.06,
      sunGlow: true,
    });
    const a = buffersOf(plain);
    for (const [index, buffer] of buffersOf(explicit).entries()) {
      expect(bytesEqual(buffer, a[index]!), `looseShare default buffer ${index}`).toBe(true);
    }
    for (const [index, buffer] of buffersOf(glowing).entries()) {
      expect(bytesEqual(buffer, a[index]!), `sunGlow buffer ${index}`).toBe(true);
    }
    // And looseShare is really wired to the scatter.
    const loose = buildCarpetField({
      seed: 0x15,
      palette: PALETTE,
      area: FAR_DISC,
      gate: halfGate,
      ground: wavyGround,
      count: 150,
      swayAmp: 0.06,
      looseShare: 0.9,
    });
    expect(
      buffersOf(loose).some((buffer, index) => !bytesEqual(buffer, a[index]!)),
      "looseShare 0.9 must change the scatter",
    ).toBe(true);
    plain.dispose();
    explicit.dispose();
    glowing.dispose();
    loose.dispose();
  });

  it("cups the near profiles: blade clumps carry off-plane normals, not card facing", () => {
    // A flat card's normals all agree; an S-bent, cupped, twisted clump
    // must spread its normals — the W-N2 cup lesson held by a test.
    const field = build(0x16, "blade");
    const normal = meshesOf(field)[0]!.geometry.getAttribute("normal");
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < normal.count; i++) {
      minY = Math.min(minY, normal.getY(i));
      maxY = Math.max(maxY, normal.getY(i));
      minX = Math.min(minX, normal.getX(i));
      maxX = Math.max(maxX, normal.getX(i));
    }
    expect(maxY - minY).toBeGreaterThan(0.5);
    expect(maxX - minX).toBeGreaterThan(0.5);
    field.dispose();
  });
});

// ─── groundLitter ────────────────────────────────────────────────────────────

describe("groundLitter", () => {
  const build = (seed: number, twoTone = true): KitBuild =>
    buildGroundLitter({
      seed,
      palette: PALETTE,
      area: FAR_DISC,
      gate: halfGate,
      ground: wavyGround,
      count: 120,
      shapeSet: "gravel",
      twoTone,
    });

  it("is deterministic given a seed and differs with seed ^ 1", () => {
    expectDeterminism((seed) => build(seed), 0x21);
  });

  it("draws once per tone family, honestly", () => {
    const single = build(0x22, false);
    expectHonestBudget(single);
    expect(single.draws).toBe(1);
    single.dispose();

    const double = build(0x22, true);
    expectHonestBudget(double);
    expect(double.draws).toBe(2);
    double.dispose();
  });

  it("contains every stone in the gated area with honest bounds, and disposes clean", () => {
    const litter = build(0x23);
    expectContained(litter, FAR_CENTER, 6, halfGate);
    expectCleanDispose(litter);
  });

  it("aligns raked yaw radially away from the blast point (the calamity knob)", () => {
    const from: readonly [number, number] = [10, 10];
    const raked = buildGroundLitter({
      seed: 0x24,
      palette: PALETTE,
      area: { center: [30, 10], radius: 8 },
      gate: openGate,
      ground: flatGround,
      count: 80,
      shapeSet: "shard",
      rake: { from, strength: 1, jitter: 0 },
    });
    const matrix = new Matrix4();
    const localX = new Vector3();
    for (const mesh of meshesOf(raked)) {
      const instanced = mesh as InstancedMesh;
      for (let i = 0; i < instanced.count; i++) {
        instanced.getMatrixAt(i, matrix);
        const position = new Vector3().setFromMatrixPosition(matrix);
        localX.setFromMatrixColumn(matrix, 0);
        localX.y = 0;
        localX.normalize();
        const away = Math.atan2(position.z - from[1], position.x - from[0]);
        const yawOfX = Math.atan2(localX.z, localX.x);
        let delta = Math.abs(yawOfX - away) % (Math.PI * 2);
        if (delta > Math.PI) {
          delta = Math.PI * 2 - delta;
        }
        expect(delta, `instance ${i} rake alignment`).toBeLessThanOrEqual(0.35);
      }
    }
    raked.dispose();
  });

  it("accepts caller geometry as one merged draw per family (R8)", () => {
    const bone = new BoxGeometry(0.4, 0.2, 0.2);
    const rib = new BoxGeometry(0.8, 0.1, 0.1);
    const litter = buildGroundLitter({
      seed: 0x25,
      palette: PALETTE,
      area: FAR_DISC,
      gate: openGate,
      ground: flatGround,
      count: 40,
      shapeSet: [bone, rib],
    });
    expectHonestBudget(litter);
    expect(litter.draws).toBe(1);
    // The caller's geometry is never consumed.
    expect(bone.getAttribute("position").count).toBeGreaterThan(0);
    litter.dispose();
    bone.dispose();
    rib.dispose();
  });

  it("builds the R12 split stone: honest 20-tri budget, contained, deterministic", () => {
    const make = (seed: number): KitBuild =>
      buildGroundLitter({
        seed,
        palette: PALETTE,
        area: FAR_DISC,
        gate: halfGate,
        ground: wavyGround,
        count: 60,
        shapeSet: "split",
      });
    expectDeterminism(make, 0x26);
    const split = make(0x26);
    expectHonestBudget(split);
    expect(split.draws).toBe(1);
    const mesh = meshesOf(split)[0] as InstancedMesh;
    expect(split.triangles).toBe(mesh.count * 20);
    expectContained(split, FAR_CENTER, 6, halfGate);
    expectCleanDispose(split);
  });

  it("keeps grade opt-in: grade 0 ≡ old build, graded sizes anchor the hearts", () => {
    const make = (grade?: number): KitBuild =>
      buildGroundLitter({
        seed: 0x27,
        palette: PALETTE,
        area: FAR_DISC,
        gate: halfGate,
        ground: wavyGround,
        count: 120,
        shapeSet: "gravel",
        ...(grade === undefined ? {} : { grade }),
      });
    const plain = make();
    const zero = make(0);
    const a = buffersOf(plain);
    for (const [index, buffer] of buffersOf(zero).entries()) {
      expect(bytesEqual(buffer, a[index]!), `grade 0 buffer ${index}`).toBe(true);
    }
    const graded = make(0.9);
    expect(
      buffersOf(graded).some((buffer, index) => !bytesEqual(buffer, a[index]!)),
      "grade 0.9 must rescale",
    ).toBe(true);
    expectContained(graded, FAR_CENTER, 6, halfGate);
    plain.dispose();
    zero.dispose();
    graded.dispose();
  });
});

// ─── screeApron ──────────────────────────────────────────────────────────────

describe("screeApron", () => {
  const anchors = [
    { pos: [28, -38] as const, facing: 0.4, spread: 2.5 },
    { pos: [32, -42] as const, facing: 2.2, spread: 3 },
  ];
  const build = (seed: number): KitBuild =>
    buildScreeApron({
      seed,
      palette: PALETTE,
      ground: wavyGround,
      anchors,
      slabsPerAnchor: 9,
    });

  it("is deterministic given a seed and differs with seed ^ 1", () => {
    expectDeterminism(build, 0x31);
  });

  it("declares one honest merged draw at 12 tris per slab (three variants, one bake)", () => {
    const apron = build(0x32);
    expectHonestBudget(apron);
    expect(apron.draws).toBe(1);
    expect(apron.triangles).toBe(2 * 9 * 12);
    apron.dispose();
  });

  it("keeps every slab inside its anchor's runout, with honest merged bounds", () => {
    const apron = build(0x33);
    const mesh = meshesOf(apron)[0]!;
    const position = mesh.geometry.getAttribute("position");
    // 18 slabs × 24 box vertices, baked world-space.
    expect(position.count).toBe(2 * 9 * 24);
    for (let i = 0; i < position.count; i++) {
      const near = anchors.some(
        (anchor) =>
          Math.hypot(position.getX(i) - anchor.pos[0], position.getZ(i) - anchor.pos[1]) <=
          anchor.spread + 1.0,
      );
      expect(near, `vertex ${i} inside a runout`).toBe(true);
    }
    const sphere = mesh.geometry.boundingSphere!;
    expect(Math.hypot(sphere.center.x, sphere.center.z)).toBeGreaterThan(10);
    expectCleanDispose(apron);
  });
});

// ─── matRings ────────────────────────────────────────────────────────────────

describe("matRings", () => {
  const bands = [
    { color: 0xe3c47c, width: 1 },
    { color: 0xb0703f, width: 1.1 },
    { color: 0xd9d2c0, width: 0.5 },
  ];
  const anchors = [
    { pos: [29, -39] as const, radius: 2 },
    { pos: [33, -41] as const, radius: 1.3 },
  ];
  const build = (seed: number): KitBuild =>
    buildMatRings({ seed, bands, ground: wavyGround, anchors, tiers: 2 });

  it("is deterministic given a seed and differs with seed ^ 1", () => {
    expectDeterminism(build, 0x41);
  });

  it("merges every disc into one honest draw", () => {
    const mats = build(0x42);
    expectHonestBudget(mats);
    expect(mats.draws).toBe(1);
    mats.dispose();
  });

  it("drapes every vertex near its anchor and to the ground, and disposes clean", () => {
    const mats = build(0x43);
    const mesh = meshesOf(mats)[0]!;
    const position = mesh.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const near = anchors.some(
        (anchor) => Math.hypot(x - anchor.pos[0], z - anchor.pos[1]) <= anchor.radius * 1.25,
      );
      expect(near, `vertex ${i} inside an anchor`).toBe(true);
      // Draped: on the ground sampler, within the lift + tier rises.
      expect(position.getY(i)).toBeGreaterThan(wavyGround(x, z));
      expect(position.getY(i)).toBeLessThan(wavyGround(x, z) + 1.2);
    }
    expect(mesh.geometry.boundingSphere).not.toBeNull();
    expectCleanDispose(mats);
  });

  it("dissolves the rim to zero alpha (no hard edge to minify)", () => {
    const mats = build(0x44);
    const color = meshesOf(mats)[0]!.geometry.getAttribute("color");
    expect(color.itemSize).toBe(4);
    let zeros = 0;
    let ones = 0;
    for (let i = 0; i < color.count; i++) {
      const alpha = color.getW(i);
      if (alpha === 0) {
        zeros++;
      } else if (alpha === 1) {
        ones++;
      }
    }
    expect(zeros).toBeGreaterThan(0);
    expect(ones).toBeGreaterThan(zeros);
    mats.dispose();
  });
});

// ─── bushBank ────────────────────────────────────────────────────────────────

describe("bushBank", () => {
  const build = (seed: number): KitBuild =>
    buildBushBank({
      seed,
      palette: PALETTE,
      area: FAR_DISC,
      gate: halfGate,
      ground: wavyGround,
      count: 20,
    });

  it("is deterministic given a seed and differs with seed ^ 1", () => {
    expectDeterminism(build, 0x51);
  });

  it("declares one honest draw at 36 tris per lobe", () => {
    const bank = build(0x52);
    expectHonestBudget(bank);
    expect(bank.draws).toBe(1);
    const mesh = meshesOf(bank)[0] as InstancedMesh;
    expect(bank.triangles).toBe(mesh.count * 5 * 36);
    bank.dispose();
  });

  it("contains every bush in the gated area with honest bounds, and disposes clean", () => {
    const bank = build(0x53);
    expectContained(bank, FAR_CENTER, 6, halfGate);
    expectCleanDispose(bank);
  });

  it("keeps the vertex paint under the ceiling (hue stays with the palette)", () => {
    const bank = build(0x54);
    const color = meshesOf(bank)[0]!.geometry.getAttribute("color");
    for (let i = 0; i < color.count; i++) {
      expect(color.getX(i)).toBeLessThanOrEqual(1);
      expect(color.getY(i)).toBeLessThanOrEqual(1);
      expect(color.getZ(i)).toBeLessThanOrEqual(1);
    }
    bank.dispose();
  });

  it("builds the R12 rich bush honestly: lobes×36 + fronds×12 + accents×8 tris", () => {
    const make = (seed: number): KitBuild =>
      buildBushBank({
        seed,
        palette: PALETTE,
        area: FAR_DISC,
        gate: halfGate,
        ground: wavyGround,
        count: 14,
        lobes: 7,
        fronds: 10,
        accents: 6,
      });
    expectDeterminism(make, 0x55);
    const rich = make(0x55);
    expectHonestBudget(rich);
    expect(rich.draws).toBe(1);
    const mesh = meshesOf(rich)[0] as InstancedMesh;
    expect(rich.triangles).toBe(mesh.count * (7 * 36 + 10 * 12 + 6 * 8));
    // The ceiling holds for the overhangs and the berry knots too.
    const color = mesh.geometry.getAttribute("color");
    for (let i = 0; i < color.count; i++) {
      expect(Math.max(color.getX(i), color.getY(i), color.getZ(i))).toBeLessThanOrEqual(1);
    }
    expectContained(rich, FAR_CENTER, 6, halfGate);
    expectCleanDispose(rich);
  });

  it("keeps fronds/accents/looseShare opt-in: defaults ≡ the pre-R12 placement stream", () => {
    const plain = build(0x56);
    const explicit = buildBushBank({
      seed: 0x56,
      palette: PALETTE,
      area: FAR_DISC,
      gate: halfGate,
      ground: wavyGround,
      count: 20,
      fronds: 0,
      accents: 0,
      looseShare: 0.22,
    });
    const a = buffersOf(plain);
    const b = buffersOf(explicit);
    expect(a.length).toBe(b.length);
    for (const [index, buffer] of b.entries()) {
      expect(bytesEqual(buffer, a[index]!), `buffer ${index}`).toBe(true);
    }
    plain.dispose();
    explicit.dispose();
  });
});

// ─── spongeCluster ───────────────────────────────────────────────────────────

describe("spongeCluster", () => {
  const anchors = [{ pos: [29, -40] as const }, { pos: [31.5, -39] as const }];
  const build = (seed: number): KitBuild =>
    buildSpongeCluster({
      seed,
      palette: PALETTE,
      ground: wavyGround,
      anchors,
      tubesPerAnchor: 4,
      height: 1.1,
    });

  it("is deterministic given a seed and differs with seed ^ 1", () => {
    expectDeterminism(build, 0x61);
  });

  it("declares one honest draw at the W-N5 180 tris per tube", () => {
    const cluster = build(0x62);
    expectHonestBudget(cluster);
    expect(cluster.draws).toBe(1);
    expect(cluster.triangles).toBe(2 * 4 * 180);
    cluster.dispose();
  });

  it("keeps tubes at their holdfasts with honest bounds, and disposes clean", () => {
    const cluster = build(0x63);
    for (const position of instancePositions(cluster)) {
      const near = anchors.some(
        (anchor) => Math.hypot(position.x - anchor.pos[0], position.z - anchor.pos[1]) <= 0.6,
      );
      expect(near).toBe(true);
    }
    const sphere = (meshesOf(cluster)[0] as InstancedMesh).boundingSphere!;
    expect(Math.hypot(sphere.center.x, sphere.center.z)).toBeGreaterThan(10);
    expectCleanDispose(cluster);
  });

  it("wears the ported paint: no cream rim, a red-leaning throat", () => {
    const cluster = build(0x64);
    const geometry = (meshesOf(cluster)[0] as InstancedMesh).geometry;
    const color = geometry.getAttribute("color");
    const uv = geometry.getAttribute("uv");
    let throatSamples = 0;
    for (let i = 0; i < color.count; i++) {
      // The exterior ceiling: nothing reaches full white anywhere.
      expect(Math.max(color.getX(i), color.getY(i), color.getZ(i))).toBeLessThan(0.85);
      // Throat vertices (profile index past the lip) lean red over blue.
      if (uv.getY(i) > 0.75) {
        expect(color.getX(i)).toBeGreaterThan(color.getZ(i));
        throatSamples++;
      }
    }
    expect(throatSamples).toBeGreaterThan(0);
    cluster.dispose();
  });
});

// ─── wallDrapeBank ───────────────────────────────────────────────────────────

describe("wallDrapeBank", () => {
  const anchors = [
    { pos: [28, 3, -40] as const, normal: [0, 0, 1] as const },
    { pos: [31, 2.4, -40] as const, normal: [0.3, 0, 0.95] as const },
  ];
  const build = (seed: number, swayAmp = 0.1): ReturnType<typeof buildWallDrapeBank> =>
    buildWallDrapeBank({
      seed,
      palette: PALETTE,
      anchors,
      strandsPerAnchor: 4,
      length: 1.5,
      swayAmp,
    });

  it("is deterministic given a seed and differs with seed ^ 1", () => {
    expectDeterminism((seed) => build(seed), 0x71);
  });

  it("declares two honest merged draws (strands + pads)", () => {
    const bank = build(0x72);
    expectHonestBudget(bank);
    expect(bank.draws).toBe(2);
    // 20 tris per strand, 6 per pad.
    expect(bank.triangles).toBe(2 * 4 * 20 + 2 * 3 * 6);
    bank.dispose();
  });

  it("hangs every vertex near its anchor, with honest merged bounds", () => {
    const bank = build(0x73);
    for (const mesh of meshesOf(bank)) {
      const position = mesh.geometry.getAttribute("position");
      for (let i = 0; i < position.count; i++) {
        const near = anchors.some(
          (anchor) =>
            Math.hypot(
              position.getX(i) - anchor.pos[0],
              position.getY(i) - anchor.pos[1],
              position.getZ(i) - anchor.pos[2],
            ) <= 2.5,
        );
        expect(near, "vertex within a strand length of an anchor").toBe(true);
      }
      const sphere = mesh.geometry.boundingSphere!;
      expect(Math.hypot(sphere.center.x, sphere.center.z)).toBeGreaterThan(10);
    }
    expectCleanDispose(bank);
  });

  it("carries the aPhase/aReach chunk, zeroed when static, and moves no buffer", () => {
    const still = build(0x74, 0);
    const strandMesh = meshesOf(still).find((mesh) => mesh.name.includes("strands"))!;
    const reach = strandMesh.geometry.getAttribute("aReach");
    for (let i = 0; i < reach.count; i++) {
      expect(reach.getX(i)).toBe(0);
    }
    still.dispose();

    const swaying = build(0x75, 0.12);
    const before = buffersOf(swaying).map((buffer) => buffer.slice());
    swaying.update(7.7);
    for (const [index, buffer] of buffersOf(swaying).entries()) {
      expect(bytesEqual(buffer, before[index]!)).toBe(true);
    }
    swaying.dispose();
  });
});

// ─── driftDebris ─────────────────────────────────────────────────────────────

describe("driftDebris", () => {
  const build = (seed: number, shapeSet: "wrack" | "relics" = "wrack"): KitBuild =>
    buildDriftDebris({
      seed,
      palette: PALETTE,
      area: FAR_DISC,
      gate: halfGate,
      ground: wavyGround,
      count: 30,
      shapeSet,
      mossTint: 0x7d9053,
    });

  it("is deterministic given a seed and differs with seed ^ 1", () => {
    expectDeterminism((seed) => build(seed), 0x81);
  });

  it("declares one honest merged draw per shape family", () => {
    for (const family of ["wrack", "relics"] as const) {
      const debris = build(0x82, family);
      expectHonestBudget(debris);
      expect(debris.draws).toBe(1);
      debris.dispose();
    }
  });

  it("keeps every piece in the gated area, with honest merged bounds", () => {
    const debris = build(0x83);
    const mesh = meshesOf(debris)[0]!;
    const position = mesh.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const distance = Math.hypot(position.getX(i) - FAR_CENTER[0], position.getZ(i) - FAR_CENTER[1]);
      // Vertices may lean a piece's own extent past its scatter point.
      expect(distance).toBeLessThanOrEqual(6 + 1.5);
      expect(position.getX(i)).toBeGreaterThanOrEqual(FAR_CENTER[0] - 1.5);
    }
    const sphere = mesh.geometry.boundingSphere!;
    expect(Math.hypot(sphere.center.x, sphere.center.z)).toBeGreaterThan(10);
    expectCleanDispose(debris);
  });

  it("accepts caller geometry without consuming it", () => {
    const spar = new BoxGeometry(1, 0.1, 0.1);
    const debris = buildDriftDebris({
      seed: 0x84,
      palette: PALETTE,
      area: FAR_DISC,
      gate: openGate,
      ground: flatGround,
      count: 12,
      shapeSet: [spar],
    });
    expectHonestBudget(debris);
    expect(debris.draws).toBe(1);
    expect(spar.getAttribute("position").count).toBeGreaterThan(0);
    debris.dispose();
    spar.dispose();
  });
});

// ─── farGrassCards ───────────────────────────────────────────────────────────

describe("farGrassCards", () => {
  const build = (seed: number): KitBuild =>
    buildFarGrassCards({
      seed,
      palette: PALETTE,
      area: FAR_DISC,
      gate: halfGate,
      ground: wavyGround,
      count: 400,
    });

  it("is deterministic given a seed and differs with seed ^ 1", () => {
    expectDeterminism(build, 0x91);
  });

  it("declares one honest draw at exactly 4 tris per card", () => {
    const cards = build(0x92);
    expectHonestBudget(cards);
    expect(cards.draws).toBe(1);
    const mesh = meshesOf(cards)[0] as InstancedMesh;
    expect(cards.triangles).toBe(mesh.count * 4);
    cards.dispose();
  });

  it("contains every card in the gated area with honest bounds, and disposes clean", () => {
    const cards = build(0x93);
    expectContained(cards, FAR_CENTER, 6, halfGate);
    expectCleanDispose(cards);
  });

  it("keeps nearFade shader-only: buffers byte-identical with the guard on", () => {
    const plain = build(0x94);
    const guarded = buildFarGrassCards({
      seed: 0x94,
      palette: PALETTE,
      area: FAR_DISC,
      gate: halfGate,
      ground: wavyGround,
      count: 400,
      nearFade: 9,
    });
    const a = buffersOf(plain);
    for (const [index, buffer] of buffersOf(guarded).entries()) {
      expect(bytesEqual(buffer, a[index]!), `buffer ${index}`).toBe(true);
    }
    plain.dispose();
    guarded.dispose();
  });
});

// ─── wallStrataPaint ─────────────────────────────────────────────────────────

describe("wallStrataPaint", () => {
  const bands = [
    { tint: [1, 1, 1] as const, height: 3 },
    { tint: [0.88, 0.8, 1.0] as const, height: 1 },
    { tint: [0.54, 0.48, 0.88] as const, height: -Infinity },
  ];

  function paintedWall(gate?: (x: number, z: number) => number): BoxGeometry {
    const geometry = new BoxGeometry(10, 6, 1, 20, 12, 1);
    geometry.translate(0, 3, -5);
    const position = geometry.getAttribute("position");
    geometry.setAttribute(
      "color",
      new BufferAttribute(new Float32Array(position.count * 3).fill(1), 3),
    );
    applyWallStrata(geometry, { seed: 0xa1, bands, gate });
    return geometry;
  }

  it("is deterministic and actually uses its seed", () => {
    const first = paintedWall();
    const second = paintedWall();
    expect(
      bytesEqual(
        first.getAttribute("color").array as Float32Array,
        second.getAttribute("color").array as Float32Array,
      ),
    ).toBe(true);

    const reseeded = new BoxGeometry(10, 6, 1, 20, 12, 1);
    reseeded.translate(0, 3, -5);
    const position = reseeded.getAttribute("position");
    reseeded.setAttribute(
      "color",
      new BufferAttribute(new Float32Array(position.count * 3).fill(1), 3),
    );
    applyWallStrata(reseeded, { seed: 0xa1 ^ 1, bands, wander: 2 });
    expect(
      bytesEqual(
        first.getAttribute("color").array as Float32Array,
        reseeded.getAttribute("color").array as Float32Array,
      ),
    ).toBe(false);
    first.dispose();
    second.dispose();
    reseeded.dispose();
  });

  it("keeps byte identity wherever the gate returns exactly 0", () => {
    const untouched = paintedWall(() => 0);
    const colors = untouched.getAttribute("color").array as Float32Array;
    for (const value of colors) {
      expect(value).toBe(1);
    }
    untouched.dispose();

    // A half gate: the zero side byte-identical, the open side painted.
    const half = paintedWall((x) => (x < 0 ? 0 : 1));
    const position = half.getAttribute("position");
    const color = half.getAttribute("color");
    let paintedCount = 0;
    for (let i = 0; i < position.count; i++) {
      if (position.getX(i) < 0) {
        expect(color.getX(i)).toBe(1);
        expect(color.getY(i)).toBe(1);
        expect(color.getZ(i)).toBe(1);
      } else if (color.getX(i) !== 1 || color.getZ(i) !== 1) {
        paintedCount++;
      }
    }
    expect(paintedCount).toBeGreaterThan(0);
    half.dispose();
  });

  it("orders bands top-down: deep vertices sit at or below high vertices' value", () => {
    const wall = paintedWall();
    const position = wall.getAttribute("position");
    const color = wall.getAttribute("color");
    let highMean = 0;
    let highCount = 0;
    let lowMean = 0;
    let lowCount = 0;
    for (let i = 0; i < position.count; i++) {
      const value = (color.getX(i) + color.getY(i) + color.getZ(i)) / 3;
      if (position.getY(i) > 4.5) {
        highMean += value;
        highCount++;
      } else if (position.getY(i) < 0.5) {
        lowMean += value;
        lowCount++;
      }
    }
    expect(lowMean / lowCount).toBeLessThan(highMean / highCount);
    wall.dispose();
  });
});
