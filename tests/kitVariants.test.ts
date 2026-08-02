import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { InstancedMesh, Scene, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import { SEEDS } from "../src/util/Random";
import {
  boulderGeometry,
  rockVariantIndex,
  slabGeometry,
  stackGeometry,
  type StackSegment,
} from "../src/world/RockShapes";
import { buildCarpetField, carpetFormIndex } from "../src/world/regions/kit/CarpetField";
import { buildGroundLitter } from "../src/world/regions/kit/GroundLitter";
import { CALAMITY_1 } from "../src/world/regions/calamity1/Calamity1";
import { GOLDEN_1 } from "../src/world/regions/golden1/Golden1";

/**
 * The kit-variants deployment proof (critic punch #9, C2): new rock and
 * tuft silhouettes may ONLY swap geometry profiles — every placement,
 * scale and rotation in the world stays byte-identical to the build
 * before the variants existed.
 *
 * The fixture (`tests/fixtures/kitVariantPlacements.json`) was recorded
 * against the PRE-CHANGE tree (commit 38b150c) with
 * `KIT_FIXTURE_RECORD=1 npx vitest run tests/kitVariants.test.ts` and is
 * committed. The suite then asserts, post-change:
 *
 * 1. Reference kit builds (carpet tuft/blade/card, shard litter) keep
 *    their instance matrices byte-identical (hashes over the raw
 *    Float32 bytes, plus raw first/last matrices for debuggability).
 * 2. Two rock-heavy region builds (golden-1, calamity-1 — the critic's
 *    gatepost and sentinel provinces) keep every node transform and
 *    every InstancedMesh matrix buffer byte-identical, and the tree
 *    keeps the same shape (names, counts, order).
 * 3. Rock geometry across a seed sweep: seeds that select the original
 *    potato profile stay byte-identical to the pre-change geometry;
 *    seeds that select a sibling differ (the swap is real); and the
 *    variant distribution over the sweep is non-degenerate.
 *
 * Contract 3's per-seed expectations are asserted in the post-change
 * half below (they need the variant selector to exist); the fixture
 * side records the pre-change geometry hashes it judges against.
 */

const FIXTURE_PATH = path.resolve(__dirname, "fixtures/kitVariantPlacements.json");
const RECORD = process.env.KIT_FIXTURE_RECORD === "1";

// ─── Byte hashing (two independent FNV-1a lanes = 64 effective bits) ────────

function hashBytes(bytes: Uint8Array): string {
  let a = 0x811c9dc5;
  let b = 0xcbf29ce4;
  for (let i = 0; i < bytes.length; i++) {
    a = Math.imul(a ^ bytes[i]!, 0x01000193) >>> 0;
    b = Math.imul(b ^ bytes[i]!, 0x01000197) >>> 0;
  }
  return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}:${bytes.length}`;
}

function hashFloats(array: ArrayLike<number> & { buffer?: ArrayBufferLike }): string {
  const f = array instanceof Float32Array ? array : Float32Array.from(array as ArrayLike<number>);
  return hashBytes(new Uint8Array(f.buffer, f.byteOffset, f.byteLength));
}

// ─── Placement signatures ────────────────────────────────────────────────────

/** JSON writes -0 as 0, so raw debug values normalise the sign; the byte
 *  hashes above keep full fidelity (a -0 in the BUFFER still matters). */
function norm(values: Iterable<number>): number[] {
  return [...values].map((value) => (value === 0 ? 0 : value));
}

interface NodeSignature {
  readonly name: string;
  readonly type: string;
  readonly transform: readonly number[];
  readonly instanceCount?: number;
  readonly instanceMatrixHash?: string;
  readonly firstMatrix?: readonly number[];
}

/** Every node's local transform, plus instance matrices where they exist. */
function treeSignature(root: Object3D): NodeSignature[] {
  const nodes: NodeSignature[] = [];
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    const signature: {
      name: string;
      type: string;
      transform: number[];
      instanceCount?: number;
      instanceMatrixHash?: string;
      firstMatrix?: number[];
    } = {
      name: node.name,
      type: node.type,
      transform: norm([
        ...node.position.toArray(),
        node.rotation.x,
        node.rotation.y,
        node.rotation.z,
        ...node.scale.toArray(),
      ]),
    };
    if ((node as InstancedMesh).isInstancedMesh) {
      const mesh = node as InstancedMesh;
      signature.instanceCount = mesh.count;
      signature.instanceMatrixHash = hashFloats(mesh.instanceMatrix.array as Float32Array);
      signature.firstMatrix = norm((mesh.instanceMatrix.array as Float32Array).slice(0, 16));
    }
    nodes.push(signature);
  });
  return nodes;
}

// ─── Reference kit builds (analytic ground, open-ish gate — plain Node) ─────

const REF_GROUND = (x: number, z: number): number =>
  Math.sin(x * 0.13) * 0.4 + Math.cos(z * 0.09) * 0.3;
const REF_GATE = (x: number, z: number): number =>
  0.55 + 0.45 * Math.sin(x * 0.05 + z * 0.07);
const REF_PALETTE = { base: 0x69c184, tip: 0xa8d98a, shade: 0x3c6b60 } as const;
const DARK_PALETTE = { base: 0x5c6152, tip: 0x8a8f6a, shade: 0x3a3f42 } as const;

function referenceBuilds(): Record<string, NodeSignature[]> {
  const area = { center: [4, -3] as [number, number], radius: 20 };
  const shared = { area, gate: REF_GATE, ground: REF_GROUND };
  const carpetTuft = buildCarpetField({
    seed: SEEDS.regionSmoking1 ^ 0x7e57_0001,
    palette: DARK_PALETTE,
    count: 420,
    profile: "tuft",
    ...shared,
  });
  const carpetBlade = buildCarpetField({
    seed: SEEDS.regionVerdant1 ^ 0x7e57_0002,
    palette: REF_PALETTE,
    count: 260,
    profile: "blade",
    swayAmp: 0.05,
    ...shared,
  });
  const carpetCard = buildCarpetField({
    seed: SEEDS.regionGolden1 ^ 0x7e57_0003,
    palette: REF_PALETTE,
    count: 380,
    profile: "card",
    ...shared,
  });
  const litterShard = buildGroundLitter({
    seed: SEEDS.regionCalamity ^ 0x7e57_0004,
    palette: DARK_PALETTE,
    count: 300,
    shapeSet: "shard",
    twoTone: true,
    ...shared,
  });
  const signatures = {
    carpetTuft: treeSignature(carpetTuft.group),
    carpetBlade: treeSignature(carpetBlade.group),
    carpetCard: treeSignature(carpetCard.group),
    litterShard: treeSignature(litterShard.group),
  };
  carpetTuft.dispose();
  carpetBlade.dispose();
  carpetCard.dispose();
  litterShard.dispose();
  return signatures;
}

// ─── Rock geometry sweep ─────────────────────────────────────────────────────

/** 24 seeds spread like real callers spread them: SEED ^ small offsets. */
const ROCK_SWEEP_SEEDS: readonly number[] = Array.from(
  { length: 24 },
  (_, i) => SEEDS.rockShapes ^ (0x0a00 + i * 131),
);

/** The double-lobe sentinel/gatepost idiom, verbatim from the region
 *  callers (calamity's teeth, golden's Honey Gate jambs). */
const SENTINEL_SEGMENTS: readonly StackSegment[] = [
  { radius: 1.1, rise: 0.5, stretch: 1.8, lean: 0.3 },
  { radius: 0.75, rise: 3.1, stretch: 1.6, lean: 0.8 },
];

function rockSweepHashes(): { boulders: string[]; slabs: string[]; stacks: string[] } {
  const boulders = ROCK_SWEEP_SEEDS.map((seed) => {
    const geometry = boulderGeometry({ seed, radius: 1.4, height: 1.8 });
    const hash = hashFloats(geometry.attributes.position!.array as Float32Array);
    geometry.dispose();
    return hash;
  });
  const slabs = ROCK_SWEEP_SEEDS.map((seed) => {
    const geometry = slabGeometry({ seed, radius: 2.2, height: 1.0 });
    const hash = hashFloats(geometry.attributes.position!.array as Float32Array);
    geometry.dispose();
    return hash;
  });
  const stacks = ROCK_SWEEP_SEEDS.map((seed) => {
    const geometry = stackGeometry(SENTINEL_SEGMENTS, { seed });
    const hash = hashFloats(geometry.attributes.position!.array as Float32Array);
    geometry.dispose();
    return hash;
  });
  return { boulders, slabs, stacks };
}

// ─── Region builds (the critic's gatepost + sentinel provinces) ─────────────

function regionSignatures(): Record<string, NodeSignature[]> {
  const goldenScene = new Scene();
  const golden = GOLDEN_1.build(goldenScene);
  const goldenSignature = treeSignature(golden.group as Object3D);
  golden.dispose?.();

  const calamityScene = new Scene();
  const calamity = CALAMITY_1.build(calamityScene);
  const calamitySignature = treeSignature(calamity.group as Object3D);
  calamity.dispose?.();

  return { golden1: goldenSignature, calamity1: calamitySignature };
}

// ─── Fixture shape ───────────────────────────────────────────────────────────

interface Fixture {
  reference: Record<string, NodeSignature[]>;
  regions: Record<string, NodeSignature[]>;
  rocks: { boulders: string[]; slabs: string[]; stacks?: string[] };
}

function currentFixture(): Fixture {
  return {
    reference: referenceBuilds(),
    regions: regionSignatures(),
    rocks: rockSweepHashes(),
  };
}

describe("kit variants: placements byte-unchanged vs the pre-change build", () => {
  if (RECORD) {
    it("records the fixture", () => {
      // APPEND-ONLY: anything already recorded was recorded against the
      // pre-change tree and is the truth this suite exists to defend —
      // re-recording it against a changed tree would erase the proof.
      const fixture = currentFixture();
      if (existsSync(FIXTURE_PATH)) {
        const previous = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Fixture;
        fixture.reference = previous.reference;
        // Region snapshots are NOT preserved on re-record: they defend
        // against unintended rerolls between waves, and a deliberate,
        // ledgered re-authoring (e.g. the beat-repair wave re-composing
        // calamity's shard carpet, punch #13) legitimately moves them.
        // The original variants proof stands in git history at the
        // fix/kit-variants merge. Rock bytes stay append-only: they ARE
        // the pre-change profile proof.
        fixture.rocks.boulders = previous.rocks.boulders;
        fixture.rocks.slabs = previous.rocks.slabs;
        if (previous.rocks.stacks) {
          fixture.rocks.stacks = previous.rocks.stacks;
        }
      }
      mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
      writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 1));
      expect(existsSync(FIXTURE_PATH)).toBe(true);
    });
    return;
  }

  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Fixture;
  const now = currentFixture();

  for (const key of Object.keys(fixture.reference)) {
    it(`keeps every ${key} placement byte-identical`, () => {
      expect(now.reference[key]).toEqual(fixture.reference[key]);
    });
  }

  for (const key of Object.keys(fixture.regions)) {
    it(`keeps every ${key} region placement byte-identical`, () => {
      const before = fixture.regions[key]!;
      const after = now.regions[key]!;
      // Prefix semantics, matching the reroll fence's actual law: every
      // placement recorded against the pre-change tree stays byte-identical,
      // while later waves may legitimately APPEND new content on fresh
      // substreams after the existing draws (e.g. the beat-repair wave's
      // calamity wreck slabs). Shrinkage or reordering still convicts.
      expect(after.length).toBeGreaterThanOrEqual(before.length);
      for (let i = 0; i < before.length; i++) {
        expect(after[i], `${key} node #${i} (${before[i]!.name})`).toEqual(before[i]);
      }
    });
  }

  it("rock sweep control: the fixture recorded the sweep", () => {
    expect(fixture.rocks.boulders.length).toBe(ROCK_SWEEP_SEEDS.length);
    expect(fixture.rocks.slabs.length).toBe(ROCK_SWEEP_SEEDS.length);
  });

  for (const kind of ["boulder", "slab", "stack"] as const) {
    it(`${kind}s on the original profile stay byte-identical; siblings differ`, () => {
      // Pre-change, every seed produced the one profile; the fixture holds
      // those bytes. Post-change the selector routes each seed: original-
      // profile picks must reproduce the recorded bytes exactly (lathe,
      // roughing and finish all untouched), sibling picks must differ.
      const recorded =
        kind === "boulder"
          ? fixture.rocks.boulders
          : kind === "slab"
            ? fixture.rocks.slabs
            : fixture.rocks.stacks!;
      const live =
        kind === "boulder" ? now.rocks.boulders : kind === "slab" ? now.rocks.slabs : now.rocks.stacks!;
      expect(recorded).toBeDefined();
      expect(live).toBeDefined();
      let originals = 0;
      for (const [i, seed] of ROCK_SWEEP_SEEDS.entries()) {
        if (rockVariantIndex(seed, kind) === 0) {
          originals++;
          expect(live[i], `${kind} seed #${i} (original pick)`).toBe(recorded[i]);
        } else {
          expect(live[i], `${kind} seed #${i} (sibling pick)`).not.toBe(recorded[i]);
        }
      }
      expect(originals).toBeGreaterThan(0);
      expect(originals).toBeLessThan(ROCK_SWEEP_SEEDS.length);
    });

    it(`${kind} variant distribution is non-degenerate across 240 seeds`, () => {
      const counts = [0, 0, 0];
      for (let i = 0; i < 240; i++) {
        counts[rockVariantIndex(SEEDS.rockShapes ^ (i * 977 + 13), kind)]!++;
      }
      for (const [variant, count] of counts.entries()) {
        expect(count, `${kind} variant ${variant}`).toBeGreaterThan(240 * 0.2);
      }
    });
  }

  it("every stack carving stays inside the measured blocks, poles sealed", () => {
    // The stackSpan guarantee (colliders, sightlines) must hold for every
    // sibling: the carvings only remove material. Sample seeds that land
    // on each carving and re-run the rockShapes containment walk.
    const top = SENTINEL_SEGMENTS.reduce(
      (h, s) => Math.max(h, s.rise + s.radius * s.stretch),
      0,
    );
    for (let variant = 0; variant < 3; variant++) {
      let seed = 0x7e57_a000 + variant;
      while (rockVariantIndex(seed, "stack") !== variant) {
        seed++;
      }
      const geometry = stackGeometry(SENTINEL_SEGMENTS, { seed });
      const position = geometry.attributes.position!;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        if (y < 0) {
          continue;
        }
        expect(y).toBeLessThanOrEqual(top + 0.01);
        const inside = SENTINEL_SEGMENTS.some((segment) => {
          const halfHeight = segment.radius * segment.stretch;
          const dx = (x - segment.lean) / segment.radius;
          const dy = (y - segment.rise) / halfHeight;
          const dz = z / segment.radius;
          return dx * dx + dy * dy + dz * dz <= 1.2;
        });
        expect(inside, `carving ${variant} vertex escaped`).toBe(true);
      }
      geometry.dispose();
    }
  });

  for (const profile of ["card", "tuft", "blade"] as const) {
    it(`${profile} carpets wear three real forms, deterministically`, () => {
      const options = {
        seed: SEEDS.regionSmoking1 ^ 0x7e57_0001,
        palette: DARK_PALETTE,
        area: { center: [4, -3] as [number, number], radius: 20 },
        gate: REF_GATE,
        ground: REF_GROUND,
        count: 420,
        profile,
      };
      const build = buildCarpetField(options);
      const mesh = build.group.children[0] as InstancedMesh;
      const geometry = mesh.geometry;

      // The per-instance pick: present, in range, matching the pure hash,
      // and non-degenerate across the field.
      const forms = geometry.getAttribute("aKitForm")!;
      expect(forms).toBeDefined();
      expect(forms.count).toBe(mesh.count);
      const counts = [0, 0, 0];
      for (let i = 0; i < forms.count; i++) {
        const form = forms.getX(i);
        expect(form).toBe(carpetFormIndex(options.seed, i));
        counts[form]!++;
      }
      for (const [form, count] of counts.entries()) {
        expect(count, `${profile} form ${form}`).toBeGreaterThan(forms.count * 0.2);
      }

      // The sibling deltas are real silhouette moves, not noise.
      for (const name of ["aKitFormB", "aKitFormC"]) {
        const delta = geometry.getAttribute(name)!;
        expect(delta, `${profile} ${name}`).toBeDefined();
        let magnitude = 0;
        for (let i = 0; i < delta.count; i++) {
          magnitude = Math.max(
            magnitude,
            Math.hypot(delta.getX(i), delta.getY(i), delta.getZ(i)),
          );
        }
        expect(magnitude, `${profile} ${name} max delta`).toBeGreaterThan(0.15);
        // ...and bounded: the honest-bounds inflation must stay sane.
        expect(magnitude, `${profile} ${name} max delta`).toBeLessThan(2);
      }

      // Deterministic: a second build welds byte-identical form buffers.
      const again = buildCarpetField(options);
      const meshAgain = again.group.children[0] as InstancedMesh;
      expect(hashFloats(forms.array as Float32Array)).toBe(
        hashFloats(meshAgain.geometry.getAttribute("aKitForm")!.array as Float32Array),
      );
      expect(
        hashFloats(geometry.getAttribute("aKitFormB")!.array as Float32Array),
      ).toBe(hashFloats(meshAgain.geometry.getAttribute("aKitFormB")!.array as Float32Array));
      build.dispose();
      again.dispose();
    });
  }
});
