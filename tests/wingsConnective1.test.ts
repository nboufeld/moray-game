import { Group, InstancedMesh, Mesh, Points, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import { wingById } from "../src/world/wings/WingRegistry";
import { WING_FLORA_BUILDERS } from "../src/world/wings/WingFloraRegistry";
import { VEIL_GROUP_NAME } from "../src/world/wings/flora/GateVeilMount";
import { angleBetween } from "../src/world/wings/WingGeometry";
import type { WingDef, WingFlora } from "../src/world/wings/WingTypes";

/**
 * Connective-1 (MASTER Batch 1) — the six gateway doorways' gate veils
 * and the Open Blue's hole repaint, held to the rulings they were built
 * under:
 *
 * - **The reroll fence** (KIT-SPEC law 1): mounting a veil consumes
 *   nothing from any live stream, so every piece of wave-8 flora keeps
 *   its exact position. Proved with sentinel values pinned from the
 *   pre-veil build — a contact and a drawn vertex/instance per wing.
 * - **R2's uplift ceilings**: each doorway's uplift (veil, plus the
 *   Open Blue's hole dressing) measures ≤ +10 draws / ≤ 35k triangles,
 *   counted from the meshes actually created.
 * - **R2's frustum guard**: every uplift mesh carries an honest bounding
 *   sphere that stands entirely past r = 27 and inside the wing's own
 *   angular cone — nothing a bowl pose could be forced to draw — with
 *   `frustumCulled` kept on and no shadow work anywhere.
 * - **The additive discipline** (KIT-SPEC §3.7): veil planes at the 0.2
 *   opacity cap, `fog: false`, no depth write.
 * - **Determinism**: two builds are byte-identical; two WINGS' veils are
 *   not each other (each rides its own `SEEDS.<wing> ^ salt` stream).
 */

const GATEWAYS = [
  "kelp-cathedral",
  "vent-springs",
  "ghost-reef",
  "open-blue",
  "sandfall-dunes",
  "ruins-terrace",
] as const;

/** Uplift subtrees per wing: the veil, plus open-blue's hole dressing. */
const UPLIFT_GROUPS: Record<string, readonly string[]> = {
  "open-blue": [VEIL_GROUP_NAME, "wing-gate-hole"],
};

const MAX_UPLIFT_DRAWS = 10;
const MAX_UPLIFT_TRIS = 35_000;

/**
 * The pre-veil sentinels, printed from the flora builds at the batch's
 * base commit (b53da4f) before any veil existed. If any of these move,
 * a veil has consumed from a live stream and the fence is broken.
 */
const PINS: Record<
  string,
  { contact: readonly [number, number]; mesh: string; at: readonly [number, number, number] }
> = {
  "kelp-cathedral": {
    contact: [11.082874880357624, 35.432969818406434],
    mesh: "cathedral-stalks",
    at: [11.08287525177002, -1.9435770511627197, 35.43296813964844],
  },
  "vent-springs": {
    contact: [-38.06977420048939, 9.651999744377964],
    mesh: "vent-amber-stones",
    at: [-41.42315673828125, -7.798037052154541, 11.787262916564941],
  },
  "ghost-reef": {
    contact: [-26.172918746976926, -28.176264674621176],
    mesh: "w3-ghost-tube",
    at: [-25.87721824645996, 1.571122169494629, -18.806365966796875],
  },
  "open-blue": {
    contact: [17.918442431423866, -31.835505663201722],
    mesh: "w4-openblue-curtain-0",
    at: [23.102657318115234, -13, -42.53030776977539],
  },
  "sandfall-dunes": {
    contact: [33.921661130650165, 0.6303305123727304],
    mesh: "sandfall-stones",
    at: [33.921661376953125, -0.45875293016433716, 0.630330502986908],
  },
  "ruins-terrace": {
    contact: [-7.621493813112508, -34.93082924948516],
    mesh: "w4-ruins-drums",
    at: [-8.5604248046875, 0.6242147088050842, -36.83041000366211],
  },
};

function build(id: string): WingFlora {
  return WING_FLORA_BUILDERS[id]!(wingById(id));
}

function upliftGroups(flora: WingFlora, id: string): Group[] {
  const names = UPLIFT_GROUPS[id] ?? [VEIL_GROUP_NAME];
  const groups: Group[] = [];
  for (const child of flora.group.children) {
    if (child instanceof Group && names.includes(child.name)) {
      groups.push(child);
    }
  }
  return groups;
}

function drawables(groups: readonly Group[]): (Mesh | Points)[] {
  const out: (Mesh | Points)[] = [];
  for (const group of groups) {
    group.traverse((object: Object3D) => {
      if (object instanceof Mesh || object instanceof Points) {
        out.push(object);
      }
    });
  }
  return out;
}

function trianglesOf(object: Mesh | Points): number {
  const geometry = object.geometry;
  const per = geometry.index
    ? geometry.index.count / 3
    : (geometry.attributes.position?.count ?? 0) / 3;
  if (object instanceof Points) {
    return 0;
  }
  return per * (object instanceof InstancedMesh ? object.count : 1);
}

/** First drawn position of the named top-level child, for the pins. */
function sentinelOf(flora: WingFlora, name: string): [number, number, number] {
  for (const child of flora.group.children) {
    if (child.name !== name) {
      continue;
    }
    if (child instanceof InstancedMesh) {
      const a = child.instanceMatrix.array;
      return [a[12]!, a[13]!, a[14]!];
    }
    if (child instanceof Mesh || child instanceof Points) {
      const p = child.geometry.attributes.position!;
      return [p.getX(0), p.getY(0), p.getZ(0)];
    }
  }
  throw new Error(`no top-level child named ${name}`);
}

function veilPositions(flora: WingFlora, id: string): number[] {
  const out: number[] = [];
  for (const object of drawables(upliftGroups(flora, id))) {
    const position = object.geometry.attributes.position;
    if (position) {
      out.push(...Array.from(position.array as Float32Array));
    }
  }
  return out;
}

describe("connective-1: the reroll fence", () => {
  for (const id of GATEWAYS) {
    it(`${id} keeps its wave-8 flora exactly where it stood`, () => {
      const flora = build(id);
      const pin = PINS[id]!;
      const contact = flora.contacts?.[0];
      expect(contact, `${id} first contact`).toBeDefined();
      expect(contact!.x).toBeCloseTo(pin.contact[0], 10);
      expect(contact!.z).toBeCloseTo(pin.contact[1], 10);
      const at = sentinelOf(flora, pin.mesh);
      expect(at[0], `${pin.mesh} x`).toBeCloseTo(pin.at[0], 5);
      expect(at[1], `${pin.mesh} y`).toBeCloseTo(pin.at[1], 5);
      expect(at[2], `${pin.mesh} z`).toBeCloseTo(pin.at[2], 5);
    });

    it(`${id} appends its veil after every existing draw`, () => {
      const children = build(id).group.children;
      expect(children[children.length - 1]!.name).toBe(VEIL_GROUP_NAME);
    });
  }
});

describe("connective-1: determinism", () => {
  it("builds every veil byte-identically twice", () => {
    for (const id of GATEWAYS) {
      const first = veilPositions(build(id), id);
      const second = veilPositions(build(id), id);
      expect(first.length, id).toBeGreaterThan(0);
      expect(second, id).toEqual(first);
    }
  });

  it("gives every doorway its own veil (the streams are per-wing)", () => {
    const kelp = veilPositions(build("kelp-cathedral"), "kelp-cathedral");
    const ghost = veilPositions(build("ghost-reef"), "ghost-reef");
    expect(kelp).not.toEqual(ghost);
  });
});

describe("connective-1: R2's uplift ceilings, measured", () => {
  for (const id of GATEWAYS) {
    it(`${id} spends ≤ +${MAX_UPLIFT_DRAWS} draws / ≤ ${MAX_UPLIFT_TRIS} tris on its doorway`, () => {
      const pieces = drawables(upliftGroups(build(id), id));
      const draws = pieces.length;
      const tris = pieces.reduce((sum, piece) => sum + trianglesOf(piece), 0);
      console.info(`[conn1-budget] ${id}: +${draws} draws, +${Math.round(tris)} tris`);
      expect(draws, `${id} uplift draws`).toBeGreaterThan(0);
      expect(draws, `${id} uplift draws`).toBeLessThanOrEqual(MAX_UPLIFT_DRAWS);
      expect(tris, `${id} uplift triangles`).toBeLessThanOrEqual(MAX_UPLIFT_TRIS);
    });
  }
});

describe("connective-1: R2's frustum guard", () => {
  for (const id of GATEWAYS) {
    it(`${id}'s doorway pieces carry honest bounds past r 27, inside the cone`, () => {
      const def: WingDef = wingById(id);
      for (const piece of drawables(upliftGroups(build(id), id))) {
        expect(piece.frustumCulled, `${piece.name} culling`).toBe(true);
        expect(piece.castShadow, `${piece.name} shadow`).toBe(false);
        const sphere = piece.geometry.boundingSphere;
        expect(sphere, `${piece.name} bounding sphere`).not.toBeNull();
        const r = Math.hypot(sphere!.center.x, sphere!.center.z);
        expect(r - sphere!.radius, `${piece.name} bowl clearance`).toBeGreaterThan(27);
        const away = angleBetween(
          Math.atan2(sphere!.center.z, sphere!.center.x),
          def.azimuth,
        );
        const spread = Math.asin(Math.min(1, sphere!.radius / r));
        // The cone: the wedge's end half-angle plus the sphere-cone test's
        // own conservatism (a sphere over a flat doorway panel spends most
        // of its radius vertically).
        expect(away + spread, `${piece.name} cone`).toBeLessThan(def.wedge.endHalf + 0.08);
      }
    });
  }
});

describe("connective-1: the additive discipline", () => {
  it("keeps every veil plane at the cap — fog off, depth write off, ≤ 0.2", () => {
    for (const id of GATEWAYS) {
      for (const piece of drawables(upliftGroups(build(id), id))) {
        if (!piece.name.startsWith("kit-gate-veil-plane")) {
          continue;
        }
        const material = piece.material as import("three").MeshBasicMaterial;
        expect(material.transparent, `${id} ${piece.name}`).toBe(true);
        expect(material.opacity, `${id} ${piece.name}`).toBeLessThanOrEqual(0.2);
        expect(material.depthWrite, `${id} ${piece.name}`).toBe(false);
        expect(material.fog, `${id} ${piece.name}`).toBe(false);
      }
    }
  });

  it("keeps the Open Blue's hole dressing under its own caps", () => {
    const flora = build("open-blue");
    const pieces = drawables(upliftGroups(flora, "open-blue"));
    const gradient = pieces.find((piece) => piece.name === "w4-openblue-hole-gradient");
    const rim = pieces.find((piece) => piece.name === "w4-openblue-hole-rim");
    expect(gradient).toBeDefined();
    expect(rim).toBeDefined();
    // The gradient's alpha lives in the buffers; nothing exceeds 0.52.
    const colors = gradient!.geometry.attributes.color!;
    for (let i = 0; i < colors.count; i++) {
      expect(colors.getW(i)).toBeLessThanOrEqual(0.52 + 1e-6);
    }
    const rimColors = rim!.geometry.attributes.color!;
    for (let i = 0; i < rimColors.count; i++) {
      expect(rimColors.getW(i)).toBeLessThanOrEqual(0.2 + 1e-6);
    }
  });
});

describe("connective-1: motion", () => {
  it("drives every doorway's drift from the flora update, both modes", () => {
    for (const id of GATEWAYS) {
      const flora = build(id);
      expect(flora.update, id).toBeDefined();
      expect(() => {
        flora.update!(0.016, false);
        flora.update!(0.016, true);
        flora.update!(1.5, false);
      }, id).not.toThrow();
    }
  });

  it("actually moves the kelp doorway's motes over a second", () => {
    const flora = build("kelp-cathedral");
    const points = drawables(upliftGroups(flora, "kelp-cathedral")).find(
      (piece): piece is Points => piece instanceof Points,
    );
    expect(points).toBeDefined();
    const before = Array.from(points!.geometry.attributes.position!.array as Float32Array);
    flora.update!(1, false);
    const after = Array.from(points!.geometry.attributes.position!.array as Float32Array);
    expect(after).not.toEqual(before);
  });
});
