import { Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Points, Vector3, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import { wingById } from "../src/world/wings/WingRegistry";
import { WING_FLORA_BUILDERS } from "../src/world/wings/WingFloraRegistry";
import { CONN3_GROUP_NAME } from "../src/world/wings/flora/SandfallDunesFlora";
import { VEIL_GROUP_NAME } from "../src/world/wings/flora/GateVeilMount";
import { angleBetween, wedgeHalfAt } from "../src/world/wings/WingGeometry";
import { seabedHeight } from "../src/world/Seabed";
import type { WingDef, WingFlora } from "../src/world/wings/WingTypes";

/**
 * Connective-3 (MASTER Batch 3) — the remaining Tier A density/light
 * uplift: **sandfall-dunes** (the Golden province's gateway — fall-mark
 * repaint, duneling bed, gold motes) and **ruins-terrace** (the Calamity
 * gateway — fallen-block litter raked off the Wound, the relic
 * vocabulary, moss carpet). Held to the rulings it was built under:
 *
 * - **The reroll fence** (KIT-SPEC law 1): every uplift piece rides a
 *   fresh `^` substream fed to a kit-private Random, so no wave-8 flora
 *   position moves. Proved with the SAME pre-veil sentinels connective-1
 *   pinned (commit b53da4f values).
 * - **R2's ceilings, measured**: each wing's WHOLE Phase 3 uplift — the
 *   Batch 1 gate veil plus this batch's density — stays ≤ +10 draws /
 *   ≤ 35k triangles, counted from the meshes actually created.
 * - **R2's frustum guard**: every uplift mesh keeps `frustumCulled`, no
 *   shadow work, honest bounding spheres past r = 27 inside the cone.
 * - **The wave-8 laws, kept against the NEW content**: the ruins
 *   corridor stays swimmable, the Kirin's meadow stays open, the gate
 *   stretch stays ankle-height; the sandfall think-lane stays bare.
 * - **The handshakes**: the duneling bed THICKENS toward the doorway
 *   (the golden plan's "life gradient starts before the door"), and the
 *   ruins litter lies raked AWAY from the Wound (MASTER §1.1's row).
 * - **The fall-mark repaint**: the curtains keep their placements and
 *   their normal-blend register (≤ 0.55) and now carry the kit's
 *   fallStreak texture instead of the blocky per-vertex streak bake.
 */

const UPLIFTED = ["sandfall-dunes", "ruins-terrace"] as const;

/** The whole-uplift ceiling (MASTER R2): Batch 1 veil + Batch 3 density. */
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
  return drawables(subtree(flora, CONN3_GROUP_NAME)).map((object) => ({
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

describe("connective-3: the reroll fence", () => {
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
      const upliftIndex = children.findIndex((child) => child.name === CONN3_GROUP_NAME);
      expect(upliftIndex, "uplift present").toBeGreaterThan(0);
      expect(children.filter((child) => child.name === CONN3_GROUP_NAME).length).toBe(1);
      expect(upliftIndex, "uplift after wave-8, before the veil").toBe(children.length - 2);
      expect(children[children.length - 1]!.name).toBe(VEIL_GROUP_NAME);
    });
  }
});

describe("connective-3: determinism", () => {
  it("builds every uplift byte-identically twice", () => {
    for (const id of UPLIFTED) {
      const first = serializedUplift(build(id));
      const second = serializedUplift(build(id));
      expect((first as unknown[]).length, id).toBeGreaterThan(0);
      expect(second, id).toEqual(first);
    }
  });

  it("gives every wing its own uplift (the streams are per-wing)", () => {
    const sandfall = serializedUplift(build("sandfall-dunes"));
    const ruins = serializedUplift(build("ruins-terrace"));
    expect(sandfall).not.toEqual(ruins);
  });
});

describe("connective-3: R2's whole-uplift ceilings, measured", () => {
  for (const id of UPLIFTED) {
    it(`${id} spends ≤ +${MAX_UPLIFT_DRAWS} draws / ≤ ${MAX_UPLIFT_TRIS} tris across veil + Batch 3`, () => {
      const flora = build(id);
      const pieces = [
        ...drawables(subtree(flora, VEIL_GROUP_NAME)),
        ...drawables(subtree(flora, CONN3_GROUP_NAME)),
      ];
      const draws = pieces.length;
      const tris = pieces.reduce((sum, piece) => sum + trianglesOf(piece), 0);
      console.info(`[conn3-budget] ${id}: +${draws} draws, +${Math.round(tris)} tris (veil included)`);
      expect(draws, `${id} uplift draws`).toBeGreaterThan(5); // the veil alone is 5 — Batch 3 added something
      expect(draws, `${id} uplift draws`).toBeLessThanOrEqual(MAX_UPLIFT_DRAWS);
      expect(tris, `${id} uplift triangles`).toBeLessThanOrEqual(MAX_UPLIFT_TRIS);
    });
  }
});

describe("connective-3: R2's frustum guard", () => {
  for (const id of UPLIFTED) {
    it(`${id}'s uplift pieces carry honest bounds past r 27, inside the cone`, () => {
      const def: WingDef = wingById(id);
      for (const piece of drawables(subtree(build(id), CONN3_GROUP_NAME))) {
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

describe("connective-3: containment and the wave-8 laws", () => {
  for (const id of UPLIFTED) {
    it(`keeps every ${id} uplift position inside the wedge and envelope`, () => {
      const def: WingDef = wingById(id);
      const spots = upliftPositions(subtree(build(id), CONN3_GROUP_NAME));
      expect(spots.length).toBeGreaterThan(100);
      for (const spot of spots) {
        const r = Math.hypot(spot.x, spot.z);
        expect(r, `${spot.from} radius`).toBeGreaterThan(29.5);
        expect(r, `${spot.from} radius`).toBeLessThan(50.5);
        const away = angleBetween(Math.atan2(spot.z, spot.x), def.azimuth);
        expect(away, `${spot.from} at r=${r.toFixed(1)}`).toBeLessThan(wedgeHalfAt(def, r) + 1e-3);
      }
    });
  }

  it("keeps the sandfall think-lane bare below the door apron", () => {
    const def = wingById("sandfall-dunes");
    const group = subtree(build("sandfall-dunes"), CONN3_GROUP_NAME);
    let instances = 0;
    for (const piece of drawables(group)) {
      if (piece instanceof Points) {
        continue; // the gold motes drift the doorway water — they ARE the lane's life
      }
      for (const spot of upliftPositions(piece)) {
        const r = Math.hypot(spot.x, spot.z);
        if (r >= 46.2) {
          continue; // the door apron: the gradient crosses the lane there by design
        }
        instances += 1;
        // Instance centres are fenced at 1.6 m; merged wrack vertices may
        // reach ~0.5 m inward from their curl centres.
        expect(
          Math.abs(lateralOf(def, spot.x, spot.z)),
          `${spot.from} lane at r=${r.toFixed(1)}`,
        ).toBeGreaterThan(1.0);
      }
    }
    expect(instances).toBeGreaterThan(80);
  });

  it("thickens the duneling bed toward the doorway (the golden handshake)", () => {
    const group = subtree(build("sandfall-dunes"), CONN3_GROUP_NAME);
    let near = 0;
    let far = 0;
    for (const piece of drawables(group)) {
      if (!(piece instanceof InstancedMesh)) {
        continue;
      }
      const a = piece.instanceMatrix.array;
      for (let i = 0; i < piece.count; i++) {
        const r = Math.hypot(a[i * 16 + 12]!, a[i * 16 + 14]!);
        if (r < 43) {
          near += 1;
        } else {
          far += 1;
        }
      }
    }
    // The density gradient: clearly more growth in the doorway half.
    expect(far, "door-half instances").toBeGreaterThan(near * 1.3);
  });

  it("holds the ruins corridor, meadow and gate laws against the uplift", () => {
    const def = wingById("ruins-terrace");
    const spots = upliftPositions(subtree(build("ruins-terrace"), CONN3_GROUP_NAME));
    expect(spots.length).toBeGreaterThan(300);
    for (const spot of spots) {
      const r = Math.hypot(spot.x, spot.z);
      if (r >= 30 && r <= 46) {
        const away = angleBetween(Math.atan2(spot.z, spot.x), def.azimuth);
        expect(away, `${spot.from} corridor at r=${r.toFixed(1)}`).toBeGreaterThan(0.06 - 1e-3);
      }
      if (r >= 38 && r <= 44) {
        expect(
          Math.abs(lateralOf(def, spot.x, spot.z)),
          `${spot.from} meadow at r=${r.toFixed(1)}`,
        ).toBeGreaterThanOrEqual(2.0);
      }
      if (r < 34.5) {
        // The gate stretch stays ankle-height scenery, like the wave-8 law.
        expect(spot.y, `${spot.from} gate height`).toBeLessThan(seabedHeight(spot.x, spot.z) + 1.2);
      }
    }
  });

  it("rakes the fallen blocks away from the Wound (the calamity handshake)", () => {
    // The region's own rake idiom (tests/regionCalamity1.test.ts): the
    // stone's LOCAL +x lands on the outward radial from the Wound,
    // asserted as an axis dot product (Euler y folds past ±π/2, so the
    // yaw itself is not readable), sampled where the floor is flat
    // enough to read it — the ground-lie pitch/roll on the shelf slope
    // contaminates the horizontal projection.
    const group = subtree(build("ruins-terrace"), CONN3_GROUP_NAME);
    const woundX = Math.cos(4.59) * 700;
    const woundZ = Math.sin(4.59) * 700;
    // Unlike the calamity floor there is NO flat ground on this wing's
    // shelf (the whole terrace descends ~0.5 m/m), so the ground-lie is
    // filtered statistically rather than skipped: the field must read
    // raked in bulk, individual stones may wander with their slope.
    const matrix = new Matrix4();
    const axis = new Vector3();
    let sampled = 0;
    let aligned = 0;
    for (const piece of drawables(group)) {
      if (!(piece instanceof InstancedMesh) || !piece.name.startsWith("kit-ground-litter")) {
        continue;
      }
      for (let i = 0; i < piece.count; i++) {
        piece.getMatrixAt(i, matrix);
        const px = matrix.elements[12]!;
        const pz = matrix.elements[14]!;
        axis.set(matrix.elements[0]!, matrix.elements[1]!, matrix.elements[2]!);
        const horizontal = Math.hypot(axis.x, axis.z) || 1;
        const awayX = px - woundX;
        const awayZ = pz - woundZ;
        const away = Math.hypot(awayX, awayZ) || 1;
        const dot = (axis.x / horizontal) * (awayX / away) + (axis.z / horizontal) * (awayZ / away);
        sampled += 1;
        // Strength 0.9 leaves ≤ 0.1 π of residual free yaw plus ±0.2 of
        // jitter ≈ 0.52 rad worst case — cos 0.52 ≈ 0.86; 0.66 leaves
        // room for the shelf slope's ground-lie contamination.
        if (Math.abs(dot) > 0.66) {
          aligned += 1;
        }
      }
    }
    expect(sampled, "blocks sampled").toBeGreaterThan(300);
    console.info(`[conn3-rake] ruins-terrace blocks aligned ${aligned}/${sampled}`);
    expect(aligned / sampled, "rake alignment share").toBeGreaterThan(0.8);
  });
});

describe("connective-3: the fall-mark repaint", () => {
  it("keeps the curtains' placements, register and blend — and wears the streak texture", () => {
    const flora = build("sandfall-dunes");
    const curtains = flora.group.children.find(
      (child): child is Mesh => child instanceof Mesh && child.name === "sandfall-curtains",
    );
    expect(curtains, "curtains present").toBeDefined();
    const material = curtains!.material as MeshBasicMaterial;
    // The soft streak texture replaces the blocky per-vertex bake…
    expect(material.alphaMap, "fallStreak alphaMap").not.toBeNull();
    // …while the register holds: normal blending (bright sand, not glow),
    // no depth write, and the 0.55 alpha cap in the vertex envelope.
    expect(material.blending, "normal blending").toBe(1);
    expect(material.depthWrite).toBe(false);
    const colors = curtains!.geometry.attributes.color!;
    expect(colors.itemSize).toBe(4);
    for (let i = 0; i < colors.count; i++) {
      expect(colors.getW(i)).toBeLessThanOrEqual(0.55 + 1e-6);
    }
  });

  it("scrolls the curtain texture with simulated time, frozen when becalmed", () => {
    const flora = build("sandfall-dunes");
    const curtains = flora.group.children.find(
      (child): child is Mesh => child instanceof Mesh && child.name === "sandfall-curtains",
    )!;
    const material = curtains.material as MeshBasicMaterial;
    flora.update!(1, false);
    const running = material.alphaMap!.offset.y;
    expect(running).not.toBe(0);
    flora.update!(1, true);
    expect(material.alphaMap!.offset.y, "frozen mid-fall").toBe(running);
    flora.update!(1, false);
    expect(material.alphaMap!.offset.y).toBeGreaterThan(running);
  });
});

describe("connective-3: motion", () => {
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
