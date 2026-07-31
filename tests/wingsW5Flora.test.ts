import {
  InstancedMesh,
  Matrix4,
  Mesh,
  Points,
  Vector3,
  type Object3D,
} from "three";
import { describe, expect, it } from "vitest";
import { buildIceGrottoFlora } from "../src/world/wings/flora/IceGrottoFlora";
import { buildSargassumSkyFlora } from "../src/world/wings/flora/SargassumSkyFlora";
import { buildSandfallDunesFlora } from "../src/world/wings/flora/SandfallDunesFlora";
import { ICE_GROTTO } from "../src/world/wings/defs/IceGrotto";
import { SARGASSUM_SKY } from "../src/world/wings/defs/SargassumSky";
import { SANDFALL_DUNES } from "../src/world/wings/defs/SandfallDunes";
import { angleBetween, wedgeHalfAt } from "../src/world/wings/WingGeometry";
import type { WingDef, WingFlora } from "../src/world/wings/WingTypes";

/**
 * The W5 wings' own contracts: determinism off the pre-registered streams,
 * confinement to the frozen wedges, the ice grotto's den corridor and gate
 * lane, the sargassum turtle's volume, the draw/triangle budgets, and the
 * reduced-motion becalming — in the style every biome before these
 * answered to.
 */

interface WingCase {
  readonly def: WingDef;
  readonly build: (def: WingDef) => WingFlora;
}

const ICE: WingCase = { def: ICE_GROTTO, build: buildIceGrottoFlora };
const SARGASSUM: WingCase = { def: SARGASSUM_SKY, build: buildSargassumSkyFlora };
const SANDFALL: WingCase = { def: SANDFALL_DUNES, build: buildSandfallDunesFlora };
const ALL: readonly WingCase[] = [ICE, SARGASSUM, SANDFALL];

/**
 * Every vertex the flora can rasterise, in world space. The merged meshes
 * and the points are built in world space already; instanced populations
 * are transformed per live instance.
 */
/**
 * Connective-1 (MASTER R2): the sandfall doorway's gate veil recedes
 * BEHIND the end wall on purpose — its planes promise the Hourglass Sea
 * past the carve's radial envelope, so the wave-8 envelope law below
 * cannot apply to them. The veil subtree keeps its own contracts
 * (determinism, budgets, honest bounds past r 27, additive discipline)
 * in `tests/wingsConnective1.test.ts`; everything the wave-8 workers
 * built is still read here, vertex for vertex.
 */
function insideGateVeil(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (o.name === "wing-gate-veil") {
      return true;
    }
  }
  return false;
}

function collectVertices(flora: WingFlora): number[] {
  const out: number[] = [];
  const scratch = new Vector3();
  const matrix = new Matrix4();
  flora.group.updateMatrixWorld(true);
  flora.group.traverse((object: Object3D) => {
    if (insideGateVeil(object)) {
      return;
    }
    if (object instanceof InstancedMesh) {
      const position = object.geometry.attributes.position;
      if (!position) {
        return;
      }
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix);
        for (let v = 0; v < position.count; v++) {
          scratch.fromBufferAttribute(position, v).applyMatrix4(matrix);
          out.push(scratch.x, scratch.y, scratch.z);
        }
      }
    } else if (object instanceof Mesh || object instanceof Points) {
      const position = object.geometry.attributes.position;
      if (!position) {
        return;
      }
      for (let v = 0; v < position.count; v++) {
        scratch.fromBufferAttribute(position, v);
        out.push(scratch.x, scratch.y, scratch.z);
      }
    }
  });
  return out;
}

/** FNV-1a over the float bits of every collected vertex — the rerun fence. */
function hashVertices(vertices: readonly number[]): number {
  let hash = 0x811c9dc5;
  const bits = new Uint32Array(1);
  const floats = new Float32Array(bits.buffer);
  for (const value of vertices) {
    floats[0] = value;
    hash = Math.imul(hash ^ bits[0]!, 0x01000193);
  }
  return hash >>> 0;
}

function acrossOf(def: WingDef, x: number, z: number): number {
  return angleBetween(Math.atan2(z, x), def.azimuth);
}

/**
 * Connective-3 (MASTER R2, the connective-2 precedent): the budget pin
 * below holds the ORIGINAL wave-8 flora. Phase 3 uplift subtrees — the
 * Batch 1 gate veil and the Batch 3 `wing-uplift-conn3` density — are
 * measured against R2's own ceilings in `tests/wingsConnective3.test.ts`
 * (and the veil in `tests/wingsConnective1.test.ts`), so they are
 * excluded from THIS count only. Determinism and confinement still read
 * every uplift vertex and instance.
 */
function insidePhase3Uplift(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (o.name === "wing-gate-veil" || o.name === "wing-uplift-conn3") {
      return true;
    }
  }
  return false;
}

function budgets(flora: WingFlora): { draws: number; triangles: number } {
  let draws = 0;
  let triangles = 0;
  flora.group.traverse((object: Object3D) => {
    if (insidePhase3Uplift(object)) {
      return;
    }
    if (object instanceof Points) {
      draws++;
      return;
    }
    if (object instanceof Mesh || object instanceof InstancedMesh) {
      draws++;
      const geometry = object.geometry;
      const tris = geometry.index
        ? geometry.index.count / 3
        : (geometry.attributes.position?.count ?? 0) / 3;
      triangles += object instanceof InstancedMesh ? tris * object.count : tris;
    }
  });
  return { draws, triangles };
}

function instanceMatrices(flora: WingFlora, name: string): number[] {
  const out: number[] = [];
  const matrix = new Matrix4();
  flora.group.traverse((object: Object3D) => {
    if (object instanceof InstancedMesh && object.name === name) {
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix);
        out.push(...matrix.elements);
      }
    }
  });
  return out;
}

describe("the W5 flora builds", () => {
  it("are deterministic — two builds produce bit-identical vertices", () => {
    for (const { def, build } of ALL) {
      const first = hashVertices(collectVertices(build(def)));
      const second = hashVertices(collectVertices(build(def)));
      expect(second, def.id).toBe(first);
    }
  });

  it("hold every vertex inside the wedge and the radial envelope", () => {
    for (const { def, build } of ALL) {
      const vertices = collectVertices(build(def));
      expect(vertices.length, def.id).toBeGreaterThan(0);
      for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i]!;
        const z = vertices[i + 2]!;
        const r = Math.hypot(x, z);
        expect(r, `${def.id} r`).toBeGreaterThan(29.9);
        expect(r, `${def.id} r`).toBeLessThan(51.2);
        const across = acrossOf(def, x, z);
        expect(across, `${def.id} across at r=${r.toFixed(1)}`).toBeLessThan(
          wedgeHalfAt(def, r) + 0.002,
        );
      }
    }
  });

  it("stay within the per-wing draw and triangle budgets", () => {
    for (const { def, build } of ALL) {
      const { draws, triangles } = budgets(build(def));
      expect(draws, `${def.id} draws`).toBeLessThanOrEqual(10);
      expect(triangles, `${def.id} triangles`).toBeLessThanOrEqual(30000);
    }
  });

  it("run their updates without throwing, in both motion modes", () => {
    for (const { def, build } of ALL) {
      const flora = build(def);
      expect(() => {
        flora.update?.(0.5, false);
        flora.update?.(0.5, true);
        flora.update?.(1.0, false);
      }, def.id).not.toThrow();
    }
  });
});

describe("the Ice Grotto's corridor and gate", () => {
  it("keeps every vertex at least 0.06 rad off the axis for r 30–46", () => {
    const vertices = collectVertices(buildIceGrottoFlora(ICE_GROTTO));
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i]!;
      const z = vertices[i + 2]!;
      const r = Math.hypot(x, z);
      if (r < 30 || r > 46) {
        continue;
      }
      const across = acrossOf(ICE_GROTTO, x, z);
      expect(across, `corridor at r=${r.toFixed(1)}`).toBeGreaterThan(0.0605);
    }
  });

  it("keeps the doorway's centre lane open across the gate band", () => {
    const vertices = collectVertices(buildIceGrottoFlora(ICE_GROTTO));
    let dressed = 0;
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i]!;
      const z = vertices[i + 2]!;
      const r = Math.hypot(x, z);
      if (r < 30.5 || r > 34) {
        continue;
      }
      dressed++;
      const across = acrossOf(ICE_GROTTO, x, z);
      expect(across, `gate lane at r=${r.toFixed(1)}`).toBeGreaterThan(0.0745);
    }
    // The gate is dressed, not empty: jambs exist, the lane is simply open.
    expect(dressed).toBeGreaterThan(0);
  });

  it("hands the seabed its contact patches, all inside the wedge", () => {
    const flora = buildIceGrottoFlora(ICE_GROTTO);
    expect(flora.contacts).toBeDefined();
    expect(flora.contacts!.length).toBeGreaterThanOrEqual(8);
    for (const contact of flora.contacts!) {
      const r = Math.hypot(contact.x, contact.z);
      expect(r).toBeGreaterThan(29.9);
      expect(r).toBeLessThan(51.2);
      expect(acrossOf(ICE_GROTTO, contact.x, contact.z)).toBeLessThan(wedgeHalfAt(ICE_GROTTO, r));
    }
  });
});

describe("the Sargassum Sky's turtle volume", () => {
  it("keeps r 38–46, y 4–6 empty for The Island That Swims", () => {
    const vertices = collectVertices(buildSargassumSkyFlora(SARGASSUM_SKY));
    let canopyVertices = 0;
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i]!;
      const y = vertices[i + 1]!;
      const z = vertices[i + 2]!;
      const r = Math.hypot(x, z);
      if (y > 6) {
        canopyVertices++;
      }
      const inside =
        r > 38 && r < 46 && y > 4 && y < 6;
      expect(inside, `turtle volume at r=${r.toFixed(1)} y=${y.toFixed(1)}`).toBe(false);
    }
    // The ceiling is the scene: the canopy must actually be overhead.
    expect(canopyVertices).toBeGreaterThan(1500);
  });
});

describe("the Sandfall Dunes' falls", () => {
  it("freeze to faint veils under reduced motion, and run warm otherwise", () => {
    const flora = buildSandfallDunesFlora(SANDFALL_DUNES);
    const streaks = (): InstancedMesh | null => {
      let found: InstancedMesh | null = null;
      flora.group.traverse((object: Object3D) => {
        if (object instanceof InstancedMesh && object.name === "sandfall-streaks") {
          found = object;
        }
      });
      return found;
    };

    // Advance a moment, then freeze: the pose must not move again, and the
    // material dims to the faint static veil the brief allows.
    flora.update?.(0.5, false);
    const running = instanceMatrices(flora, "sandfall-streaks");
    flora.update?.(0.5, true);
    const frozen = instanceMatrices(flora, "sandfall-streaks");
    expect(frozen).toEqual(running);
    const mesh = streaks();
    expect(mesh).not.toBeNull();
    expect((mesh!.material as { opacity: number }).opacity).toBeLessThan(0.2);
    flora.update?.(0.5, false);
    expect((mesh!.material as { opacity: number }).opacity).toBeGreaterThan(0.4);
  });

  it("are deterministic across builds, updates included", () => {
    const first = buildSandfallDunesFlora(SANDFALL_DUNES);
    const second = buildSandfallDunesFlora(SANDFALL_DUNES);
    first.update?.(0.37, false);
    second.update?.(0.37, false);
    expect(hashVertices(collectVertices(first))).toBe(hashVertices(collectVertices(second)));
    expect(instanceMatrices(first, "sandfall-streaks")).toEqual(
      instanceMatrices(second, "sandfall-streaks"),
    );
  });

  it("hands the seabed a contact per ridge stone, inside the wedge", () => {
    const flora = buildSandfallDunesFlora(SANDFALL_DUNES);
    expect(flora.contacts).toBeDefined();
    expect(flora.contacts!.length).toBeGreaterThanOrEqual(28);
    for (const contact of flora.contacts!) {
      const r = Math.hypot(contact.x, contact.z);
      expect(acrossOf(SANDFALL_DUNES, contact.x, contact.z)).toBeLessThan(
        wedgeHalfAt(SANDFALL_DUNES, r),
      );
    }
  });
});

describe("the W5 defs' owned fields", () => {
  it("paints are pure, and identity at the wedge's edge", () => {
    for (const { def } of ALL) {
      expect(def.paint, def.id).toBeDefined();
      // Below the blend floor nothing is written — the neighbouring wing's
      // bake is untouched.
      expect(def.paint!(40 * Math.cos(def.azimuth), 40 * Math.sin(def.azimuth), 0, 0.01)).toBeNull();
      const x = 42 * Math.cos(def.azimuth);
      const z = 42 * Math.sin(def.azimuth);
      const a = def.paint!(x, z, def.carve.floorDepth, 0.8);
      const b = def.paint!(x, z, def.carve.floorDepth, 0.8);
      expect(a).toEqual(b);
      for (const channel of a!) {
        expect(channel).toBeGreaterThan(0.9);
        expect(channel).toBeLessThan(1.15);
      }
    }
  });

  it("keep the mood tables' channel discipline — a shade stays a colour", () => {
    for (const { def } of ALL) {
      expect(def.mood.fog.densityGain).toBeGreaterThanOrEqual(-0.03);
      expect(Math.abs(def.mood.light.sun)).toBeLessThan(0.9);
      expect(def.moodDescent).toBeGreaterThan(0);
    }
  });
});
