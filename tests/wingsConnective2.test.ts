import { Group, InstancedMesh, Mesh, Points, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import { wingById } from "../src/world/wings/WingRegistry";
import { WING_FLORA_BUILDERS } from "../src/world/wings/WingFloraRegistry";
import { CONN2_GROUP_NAME } from "../src/world/wings/flora/KelpCathedralFlora";
import { falseSpringDying } from "../src/world/wings/flora/GhostReefFlora";
import { VEIL_GROUP_NAME } from "../src/world/wings/flora/GateVeilMount";
import { angleBetween, wedgeHalfAt } from "../src/world/wings/WingGeometry";
import type { WingDef, WingFlora } from "../src/world/wings/WingTypes";

/**
 * Connective-2 (MASTER Batch 2) — the Tier A density/light uplift of the
 * three gateways whose provinces went dense this batch (kelp-cathedral,
 * vent-springs, ghost-reef), held to the rulings it was built under:
 *
 * - **The reroll fence** (KIT-SPEC law 1): every uplift piece rides a
 *   fresh `^` substream fed to a kit-private Random, so no wave-8 flora
 *   position moves. Proved with the SAME pre-veil sentinels connective-1
 *   pinned (commit b53da4f values) — if Batch 2 had consumed from a live
 *   stream, these would drift.
 * - **R2's ceilings, measured**: the wing's WHOLE Phase 3 uplift — the
 *   Batch 1 gate veil plus this batch's density — stays ≤ +10 draws /
 *   ≤ 35k triangles, counted from the meshes actually created.
 * - **R2's frustum guard**: every uplift mesh keeps `frustumCulled`, no
 *   shadow work, and carries an honest bounding sphere standing past
 *   r = 27 and inside the wing's cone.
 * - **Containment & corridors**: every instance, merged vertex and point
 *   the uplift adds stays inside its wedge; the vent-springs den corridor
 *   law (nothing under r 34.4, ≥ 0.06 rad off the axis through r 30–46)
 *   and the ghost-reef den approach (≥ 0.06 rad) read every vertex added
 *   here; the kelp cathedral's aisle keeps its 1.65 m heart.
 * - **R6, the false spring's wing half**: the ghost-reef recovery now
 *   peaks by the den and COOLS toward the doorway, handing the Bone
 *   Meadows' seam a dying trace instead of full pastel — asserted on the
 *   envelope's shape and on the built instance tints.
 */

const UPLIFTED = ["kelp-cathedral", "vent-springs", "ghost-reef"] as const;

/** The whole-uplift ceiling (MASTER R2): Batch 1 veil + Batch 2 density. */
const MAX_UPLIFT_DRAWS = 10;
const MAX_UPLIFT_TRIS = 35_000;

/**
 * The pre-veil sentinels, verbatim from `tests/wingsConnective1.test.ts`
 * (printed at commit b53da4f, before any Phase 3 uplift existed).
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
};

function build(id: string): WingFlora {
  return WING_FLORA_BUILDERS[id]!(wingById(id));
}

function subtree(flora: WingFlora, name: string): Group {
  const found = flora.group.children.find(
    (child): child is Group => child instanceof Group && child.name === name,
  );
  if (!found) {
    throw new Error(`no top-level group named ${name}`);
  }
  return found;
}

function drawables(root: Object3D): (Mesh | Points)[] {
  const out: (Mesh | Points)[] = [];
  root.traverse((object: Object3D) => {
    if (object instanceof Mesh || object instanceof Points) {
      out.push(object);
    }
  });
  return out;
}

function trianglesOf(object: Mesh | Points): number {
  if (object instanceof Points) {
    return 0;
  }
  const geometry = object.geometry;
  const per = geometry.index
    ? geometry.index.count / 3
    : (geometry.attributes.position?.count ?? 0) / 3;
  return per * (object instanceof InstancedMesh ? object.count : 1);
}

/** Every world position the uplift subtree owns: instance translations,
 *  merged vertices and point sprites — the containment corpus. */
function upliftPositions(root: Object3D): { x: number; y: number; z: number; from: string }[] {
  const out: { x: number; y: number; z: number; from: string }[] = [];
  for (const object of drawables(root)) {
    if (object instanceof InstancedMesh) {
      const a = object.instanceMatrix.array;
      for (let i = 0; i < object.count; i++) {
        out.push({ x: a[i * 16 + 12]!, y: a[i * 16 + 13]!, z: a[i * 16 + 14]!, from: object.name });
      }
    } else {
      const position = object.geometry.attributes.position;
      if (!position) {
        continue;
      }
      for (let i = 0; i < position.count; i++) {
        out.push({ x: position.getX(i), y: position.getY(i), z: position.getZ(i), from: object.name });
      }
    }
  }
  return out;
}

function serializedUplift(flora: WingFlora): unknown {
  return drawables(subtree(flora, CONN2_GROUP_NAME)).map((object) => ({
    name: object.name,
    positions: Array.from(object.geometry.attributes.position?.array ?? []),
    matrices: object instanceof InstancedMesh ? Array.from(object.instanceMatrix.array) : null,
    colors:
      object instanceof InstancedMesh && object.instanceColor
        ? Array.from(object.instanceColor.array)
        : null,
  }));
}

function lateralOf(def: WingDef, x: number, z: number): number {
  return x * -Math.sin(def.azimuth) + z * Math.cos(def.azimuth);
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

describe("connective-2: the reroll fence", () => {
  for (const id of UPLIFTED) {
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

    it(`${id} mounts one uplift group after every wave-8 draw, before the veil`, () => {
      const children = build(id).group.children;
      const upliftIndex = children.findIndex((child) => child.name === CONN2_GROUP_NAME);
      expect(upliftIndex, "uplift present").toBeGreaterThan(0);
      expect(children.filter((child) => child.name === CONN2_GROUP_NAME).length).toBe(1);
      expect(upliftIndex, "uplift after wave-8, before the veil").toBe(children.length - 2);
      expect(children[children.length - 1]!.name).toBe(VEIL_GROUP_NAME);
    });
  }
});

describe("connective-2: determinism", () => {
  it("builds every uplift byte-identically twice", () => {
    for (const id of UPLIFTED) {
      const first = serializedUplift(build(id));
      const second = serializedUplift(build(id));
      expect((first as unknown[]).length, id).toBeGreaterThan(0);
      expect(second, id).toEqual(first);
    }
  });

  it("gives every wing its own uplift (the streams are per-wing)", () => {
    const kelp = serializedUplift(build("kelp-cathedral"));
    const ghost = serializedUplift(build("ghost-reef"));
    expect(kelp).not.toEqual(ghost);
  });
});

describe("connective-2: R2's whole-uplift ceilings, measured", () => {
  for (const id of UPLIFTED) {
    it(`${id} spends ≤ +${MAX_UPLIFT_DRAWS} draws / ≤ ${MAX_UPLIFT_TRIS} tris across veil + Batch 2`, () => {
      const flora = build(id);
      const pieces = [
        ...drawables(subtree(flora, VEIL_GROUP_NAME)),
        ...drawables(subtree(flora, CONN2_GROUP_NAME)),
      ];
      const draws = pieces.length;
      const tris = pieces.reduce((sum, piece) => sum + trianglesOf(piece), 0);
      console.info(`[conn2-budget] ${id}: +${draws} draws, +${Math.round(tris)} tris (veil included)`);
      expect(draws, `${id} uplift draws`).toBeGreaterThan(5); // the veil alone is 5 — Batch 2 added something
      expect(draws, `${id} uplift draws`).toBeLessThanOrEqual(MAX_UPLIFT_DRAWS);
      expect(tris, `${id} uplift triangles`).toBeLessThanOrEqual(MAX_UPLIFT_TRIS);
    });
  }
});

describe("connective-2: R2's frustum guard", () => {
  for (const id of UPLIFTED) {
    it(`${id}'s uplift pieces carry honest bounds past r 27, inside the cone`, () => {
      const def: WingDef = wingById(id);
      for (const piece of drawables(subtree(build(id), CONN2_GROUP_NAME))) {
        expect(piece.frustumCulled, `${piece.name} culling`).toBe(true);
        expect(piece.castShadow, `${piece.name} shadow`).toBe(false);
        // An InstancedMesh's honest sphere lives on the MESH (computed off
        // the real matrices — the sill-stones trap); merged meshes and
        // point clouds carry theirs on the geometry.
        const sphere =
          piece instanceof InstancedMesh ? piece.boundingSphere : piece.geometry.boundingSphere;
        expect(sphere, `${piece.name} bounding sphere`).not.toBeNull();
        const r = Math.hypot(sphere!.center.x, sphere!.center.z);
        expect(r - sphere!.radius, `${piece.name} bowl clearance`).toBeGreaterThan(27);
        const away = angleBetween(Math.atan2(sphere!.center.z, sphere!.center.x), def.azimuth);
        const spread = Math.asin(Math.min(1, sphere!.radius / r));
        // The cone: the wedge's end half-angle plus the sphere-cone test's
        // own conservatism (connective-1's precedent — a sphere over a
        // floor carpet spends much of its radius vertically).
        expect(away + spread, `${piece.name} cone`).toBeLessThan(def.wedge.endHalf + 0.08);
      }
    });
  }
});

describe("connective-2: containment and the corridors", () => {
  for (const id of UPLIFTED) {
    it(`keeps every ${id} uplift position inside the wedge and envelope`, () => {
      const def: WingDef = wingById(id);
      for (const spot of upliftPositions(subtree(build(id), CONN2_GROUP_NAME))) {
        const r = Math.hypot(spot.x, spot.z);
        expect(r, `${spot.from} radius`).toBeGreaterThan(29.5);
        expect(r, `${spot.from} radius`).toBeLessThan(50.5);
        const away = angleBetween(Math.atan2(spot.z, spot.x), def.azimuth);
        expect(away, `${spot.from} at r=${r.toFixed(1)}`).toBeLessThan(wedgeHalfAt(def, r) + 1e-3);
      }
    });
  }

  it("holds the vent-springs den corridor and gate corridor clear of the uplift", () => {
    const def = wingById("vent-springs");
    const spots = upliftPositions(subtree(build("vent-springs"), CONN2_GROUP_NAME));
    expect(spots.length).toBeGreaterThan(100);
    for (const spot of spots) {
      const r = Math.hypot(spot.x, spot.z);
      expect(r, `${spot.from} gate corridor at r=${r.toFixed(1)}`).toBeGreaterThan(34.4);
      if (r >= 30 && r <= 46) {
        const away = angleBetween(Math.atan2(spot.z, spot.x), def.azimuth);
        expect(away, `${spot.from} den corridor at r=${r.toFixed(1)}`).toBeGreaterThan(0.06 - 1e-3);
      }
    }
  });

  it("holds the ghost-reef den approach clear of the uplift", () => {
    const def = wingById("ghost-reef");
    const spots = upliftPositions(subtree(build("ghost-reef"), CONN2_GROUP_NAME));
    expect(spots.length).toBeGreaterThan(100);
    for (const spot of spots) {
      const r = Math.hypot(spot.x, spot.z);
      if (r >= 30 && r <= 46) {
        const away = angleBetween(Math.atan2(spot.z, spot.x), def.azimuth);
        expect(away, `${spot.from} at r=${r.toFixed(1)}`).toBeGreaterThan(0.06 - 1e-3);
      }
    }
  });

  it("keeps the kelp cathedral's aisle heart open through the uplift", () => {
    const def = wingById("kelp-cathedral");
    const group = subtree(build("kelp-cathedral"), CONN2_GROUP_NAME);
    let instances = 0;
    for (const piece of drawables(group)) {
      if (!(piece instanceof InstancedMesh)) {
        continue;
      }
      const a = piece.instanceMatrix.array;
      for (let i = 0; i < piece.count; i++) {
        instances += 1;
        expect(
          Math.abs(lateralOf(def, a[i * 16 + 12]!, a[i * 16 + 14]!)),
          `${piece.name} instance ${i}`,
        ).toBeGreaterThanOrEqual(1.65);
      }
    }
    expect(instances).toBeGreaterThan(100);
  });
});

describe("connective-2: R6, the false spring's wing half", () => {
  it("cools the envelope toward the door, to a trace and never to zero", () => {
    expect(falseSpringDying(41)).toBe(1);
    expect(falseSpringDying(43.8)).toBeCloseTo(1, 5);
    let last = falseSpringDying(43.8);
    for (let r = 44; r <= 47; r += 0.2) {
      const dying = falseSpringDying(r);
      expect(dying, `monotone at r=${r.toFixed(1)}`).toBeLessThanOrEqual(last + 1e-9);
      last = dying;
    }
    // The handover register: a dying TRACE — well under half strength by
    // the seam, never extinguished (the region side picks the trace up).
    expect(falseSpringDying(46.5)).toBeLessThan(0.45);
    expect(falseSpringDying(46.5)).toBeGreaterThan(0.2);
  });

  it("shows in the built stands: colour peaks by the den, dies toward the door", () => {
    const flora = build("ghost-reef");
    const spreads: { r: number; spread: number }[] = [];
    for (const child of flora.group.children) {
      if (!(child instanceof InstancedMesh) || !child.instanceColor) {
        continue;
      }
      const matrices = child.instanceMatrix.array;
      const colors = child.instanceColor.array;
      for (let i = 0; i < child.count; i++) {
        const r = Math.hypot(matrices[i * 16 + 12]!, matrices[i * 16 + 14]!);
        const red = colors[i * 3]!;
        const green = colors[i * 3 + 1]!;
        const blue = colors[i * 3 + 2]!;
        spreads.push({ r, spread: Math.max(red, green, blue) - Math.min(red, green, blue) });
      }
    }
    const mean = (entries: readonly { spread: number }[]): number =>
      entries.reduce((sum, entry) => sum + entry.spread, 0) / Math.max(1, entries.length);
    const bone = spreads.filter((entry) => entry.r <= 40);
    // The envelope's own bands: ramp × dying peaks just past r 45; the
    // last half-metre before the seam is where the trace is handed over.
    const garden = spreads.filter((entry) => entry.r >= 44.9 && entry.r <= 45.4);
    const door = spreads.filter((entry) => entry.r >= 45.9);
    expect(garden.length, "garden stands exist").toBeGreaterThanOrEqual(3);
    expect(door.length, "door stands exist").toBeGreaterThanOrEqual(3);
    const boneMean = mean(bone);
    const gardenColour = mean(garden) - boneMean;
    const doorColour = mean(door) - boneMean;
    console.info(
      `[conn2-r6] ghost-reef spread means — bone ${boneMean.toFixed(3)}, garden peak +${gardenColour.toFixed(3)}, door +${doorColour.toFixed(3)}`,
    );
    // Deterministic build, deterministic means: over the bone baseline,
    // the door band carries clearly LESS colour than the peak by the den…
    expect(doorColour, "the door cools").toBeLessThan(gardenColour * 0.72);
    // …but clearly more than none: a trace is handed over, not a wall.
    expect(doorColour, "a trace remains").toBeGreaterThan(gardenColour * 0.15);
  });
});

describe("connective-2: motion", () => {
  for (const id of UPLIFTED) {
    it(`${id} updates without throwing, in both motion modes`, () => {
      const flora = build(id);
      expect(() => {
        flora.update?.(0.016, false);
        flora.update?.(0.016, true);
        flora.update?.(1.5, false);
      }).not.toThrow();
    });
  }
});
