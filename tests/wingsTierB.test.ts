import {
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Points,
  type Object3D,
} from "three";
import { describe, expect, it } from "vitest";
import { seabedHeight } from "../src/world/Seabed";
import { angleBetween, wedgeHalfAt } from "../src/world/wings/WingGeometry";
import { WING_FLORA_BUILDERS } from "../src/world/wings/WingFloraRegistry";
import { wingById } from "../src/world/wings/WingRegistry";
import type { WingDef, WingFlora } from "../src/world/wings/WingTypes";
import { VEIL_GROUP_NAME } from "../src/world/wings/flora/GateVeilMount";
import { TIERB_GROUP_NAME } from "../src/world/wings/flora/TierBUplift";
import { MOONLIT_KOI_CIRCLE } from "../src/world/wings/flora/MoonlitLagoonFlora";
import { GLASS_COVE } from "../src/world/wings/defs/GlassCove";
import { CURRENT_RUN } from "../src/world/wings/defs/CurrentRun";

/**
 * Batch 4 (MASTER §4 "closure") — the Tier B side-room uplift: nine
 * non-gateway wings gain one T1 ground statement (a kit carpet/litter in
 * the wing's own palette), wall paint where the walls were bare
 * (glass-cove, current-run — the `WingDef.paint` device), and a gate
 * veil at the rim doorway, inks sourced from the wing behind the door.
 * (The tenth non-gateway wing, ruins-terrace, was uplifted as a gateway
 * under connective-1/-3 — its T1, wall paint and veil already stand and
 * are measured in the connective suites.)
 *
 * Held to the rulings it was built under:
 *
 * - **The reroll fence** (KIT-SPEC law 1): every uplift piece rides a
 *   fresh `SEEDS.<wing> ^ <constant>` substream fed to a kit-private
 *   Random, appended after every wave-8 draw. Proved with pre-uplift
 *   sentinels printed at this branch's base (commit 50504b4, before any
 *   Tier B change existed).
 * - **R2's Tier B ceilings, measured**: each wing's WHOLE Phase 3 uplift
 *   (T1 + veil) stays ≤ +6 draws / ≤ 20k triangles, counted from the
 *   meshes actually created; the program envelope arithmetic is printed
 *   each run.
 * - **R2's frustum guard**: no `frustumCulled = false`, no shadow work,
 *   honest bounding spheres past r = 27 inside each wing's cone.
 * - **The wave-8 laws, re-asserted against the NEW content**: every den
 *   corridor, gate lane, heart, circle, channel and kept-empty volume is
 *   proved against the T1 (and, where the law is a volume, the veil).
 */

const TIER_B = [
  "nursery-shallows",
  "lumen-garden",
  "wreck-meadow",
  "moonlit-lagoon",
  "glass-cove",
  "current-run",
  "mangrove-roots",
  "ice-grotto",
  "sargassum-sky",
] as const;

const MAX_UPLIFT_DRAWS = 6;
const MAX_UPLIFT_TRIS = 20_000;

/**
 * The critic's-wave polish (wings-polish ledger): two wings carry a
 * second Tier B allowance ON TOP of the Batch 4 uplift they already
 * ship, per the punch-list brief (≤ +6 draws / ≤ 20k tris measured, on
 * top of current numbers — see docs/region-ledger/wings-polish.md):
 * lumen-garden's glow constellations + door motes (#8, +3 draws), and
 * current-run's far-end composed close (+4 draws). Every other wing
 * keeps the plain Batch 4 ceiling. The program envelope below still
 * gates the sum, so the polish cannot quietly spend past MASTER R2.
 */
const POLISH_DRAW_ALLOWANCE: Record<string, number> = {
  "lumen-garden": 3,
  "current-run": 4,
};

/**
 * Pre-uplift sentinels, printed from the registry at commit 50504b4
 * (HEAD of the merged program tree, before any Tier B code existed):
 * the first contact patch and the first drawn position of the first
 * top-level drawable. If any wave-8 draw re-rolled, these move.
 */
const PINS: Record<
  string,
  {
    contact: readonly [number, number] | null;
    mesh: string;
    at: readonly [number, number, number];
  }
> = {
  "nursery-shallows": {
    contact: [-1.0932698790964315, 41.13872075434174],
    mesh: "nursery-branch",
    at: [-7.981038570404053, 0.845062792301178, 38.42234420776367],
  },
  "lumen-garden": {
    contact: [-22.897656470088016, 33.170280995961164],
    mesh: "lumen-polyp-beds",
    at: [-22.013395309448242, -4.1489105224609375, 32.866722106933594],
  },
  "wreck-meadow": {
    contact: [-28.541346440096483, 24.661536723113517],
    mesh: "wreck-ribs",
    at: [-28.541345596313477, -2.7524943351745605, 24.661537170410156],
  },
  "moonlit-lagoon": {
    contact: [-40.32063798573082, -2.717068403462499],
    mesh: "moonlit-lagoon-blades",
    at: [-38.350929260253906, -2.1651296615600586, 0.9325327277183533],
  },
  "glass-cove": {
    contact: [-38.846247539217586, -19.33708346445954],
    mesh: "w3-glass-drift-dodeca",
    at: [-29.73178482055664, 1.352805733680725, -15.146217346191406],
  },
  "current-run": {
    contact: [-19.260599187988323, -31.8260899062769],
    mesh: "w3-current-banners",
    at: [-22.979713439941406, -5.2461934089660645, -39.15311050415039],
  },
  "mangrove-roots": {
    contact: [5.628632909708948, -39.278736188524974],
    mesh: "w4-mangrove-roots",
    at: [5.628362655639648, 6.289491176605225, -38.94107437133789],
  },
  "ice-grotto": {
    contact: [28.641296385476036, -24.655145682485436],
    mesh: "ice-spires",
    at: [28.825098037719727, -1.788240909576416, -24.277278900146484],
  },
  "sargassum-sky": {
    contact: null,
    mesh: "sargassum-canopy",
    at: [40.413211822509766, 8.921796798706055, -9.242411613464355],
  },
};

function build(id: string): WingFlora {
  return WING_FLORA_BUILDERS[id]!(wingById(id));
}

function subtree(flora: WingFlora, name: string): Object3D {
  const found = flora.group.children.find((child) => child.name === name);
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

/** Instance translations of the T1 subtree — the solid content corpus. */
function t1Positions(flora: WingFlora): { x: number; y: number; z: number; from: string }[] {
  const out: { x: number; y: number; z: number; from: string }[] = [];
  for (const object of drawables(subtree(flora, TIERB_GROUP_NAME))) {
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

/** Every world vertex of the veil subtree (its planes are world-space). */
function veilVertices(flora: WingFlora): { x: number; y: number; z: number; from: string }[] {
  const out: { x: number; y: number; z: number; from: string }[] = [];
  for (const object of drawables(subtree(flora, VEIL_GROUP_NAME))) {
    const position = object.geometry.attributes.position;
    if (!position) {
      continue;
    }
    for (let i = 0; i < position.count; i++) {
      out.push({ x: position.getX(i), y: position.getY(i), z: position.getZ(i), from: object.name });
    }
  }
  return out;
}

function serializedUplift(flora: WingFlora): unknown {
  return [
    ...drawables(subtree(flora, TIERB_GROUP_NAME)),
    ...drawables(subtree(flora, VEIL_GROUP_NAME)),
  ].map((object) => ({
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

describe("tier B: the reroll fence", () => {
  for (const id of TIER_B) {
    it(`${id} keeps its wave-8 flora exactly where it stood`, () => {
      const flora = build(id);
      const pin = PINS[id]!;
      if (pin.contact) {
        const contact = flora.contacts?.[0];
        expect(contact, `${id} first contact`).toBeDefined();
        expect(contact!.x).toBeCloseTo(pin.contact[0], 10);
        expect(contact!.z).toBeCloseTo(pin.contact[1], 10);
      } else {
        expect(flora.contacts ?? undefined, `${id} stays contact-free`).toBeUndefined();
      }
      const at = sentinelOf(flora, pin.mesh);
      expect(at[0], `${pin.mesh} x`).toBeCloseTo(pin.at[0], 5);
      expect(at[1], `${pin.mesh} y`).toBeCloseTo(pin.at[1], 5);
      expect(at[2], `${pin.mesh} z`).toBeCloseTo(pin.at[2], 5);
    });

    it(`${id} mounts one uplift group after every wave-8 draw, before the veil`, () => {
      const children = build(id).group.children;
      expect(children.filter((child) => child.name === TIERB_GROUP_NAME).length).toBe(1);
      expect(children.filter((child) => child.name === VEIL_GROUP_NAME).length).toBe(1);
      const upliftIndex = children.findIndex((child) => child.name === TIERB_GROUP_NAME);
      expect(upliftIndex, "uplift after wave-8, before the veil").toBe(children.length - 2);
      expect(children[children.length - 1]!.name).toBe(VEIL_GROUP_NAME);
    });
  }
});

describe("tier B: determinism", () => {
  it("builds every uplift byte-identically twice", () => {
    for (const id of TIER_B) {
      const first = serializedUplift(build(id));
      const second = serializedUplift(build(id));
      expect((first as unknown[]).length, id).toBeGreaterThan(0);
      expect(second, id).toEqual(first);
    }
  });

  it("gives every wing its own uplift (the streams are per-wing)", () => {
    const seen = TIER_B.map((id) => JSON.stringify(serializedUplift(build(id))));
    expect(new Set(seen).size).toBe(TIER_B.length);
  });
});

describe("tier B: R2's ceilings, measured", () => {
  it(`every wing spends ≤ +${MAX_UPLIFT_DRAWS} draws / ≤ ${MAX_UPLIFT_TRIS} tris (T1 + veil), and the program envelope holds`, () => {
    let totalDraws = 0;
    let totalTris = 0;
    for (const id of TIER_B) {
      const flora = build(id);
      const pieces = [
        ...drawables(subtree(flora, TIERB_GROUP_NAME)),
        ...drawables(subtree(flora, VEIL_GROUP_NAME)),
      ];
      const draws = pieces.length;
      const tris = pieces.reduce((sum, piece) => sum + trianglesOf(piece), 0);
      console.info(`[tierb-budget] ${id}: +${draws} draws, +${Math.round(tris)} tris (veil included)`);
      expect(draws, `${id} uplift draws`).toBeGreaterThan(1); // T1 + a veil both landed
      const drawCeiling = MAX_UPLIFT_DRAWS + (POLISH_DRAW_ALLOWANCE[id] ?? 0);
      expect(draws, `${id} uplift draws`).toBeLessThanOrEqual(drawCeiling);
      expect(tris, `${id} uplift triangles`).toBeLessThanOrEqual(MAX_UPLIFT_TRIS);
      totalDraws += draws;
      totalTris += tris;
    }
    // The whole-program wing-uplift envelope (MASTER R2 ≤ +120 / ≤ 380k):
    // connective-1..3 closed at +60 draws / +123.7k tris resident.
    console.info(
      `[tierb-budget] batch total: +${totalDraws} draws, +${Math.round(totalTris)} tris; ` +
        `program: +${60 + totalDraws} draws / +${Math.round(123_700 + totalTris)} tris of ≤ +120 / ≤ 380k`,
    );
    expect(60 + totalDraws, "program draws envelope").toBeLessThanOrEqual(120);
    expect(123_700 + totalTris, "program tris envelope").toBeLessThanOrEqual(380_000);
  });
});

describe("tier B: R2's frustum guard", () => {
  for (const id of TIER_B) {
    it(`${id}'s uplift pieces carry honest bounds past r 27, inside the cone`, () => {
      const def: WingDef = wingById(id);
      const flora = build(id);
      const pieces = [
        ...drawables(subtree(flora, TIERB_GROUP_NAME)),
        ...drawables(subtree(flora, VEIL_GROUP_NAME)),
      ];
      for (const piece of pieces) {
        expect(piece.frustumCulled, `${piece.name} culling`).toBe(true);
        expect(piece.castShadow, `${piece.name} shadow`).toBe(false);
        const sphere =
          piece instanceof InstancedMesh ? piece.boundingSphere : piece.geometry.boundingSphere;
        expect(sphere, `${piece.name} bounding sphere`).not.toBeNull();
        const r = Math.hypot(sphere!.center.x, sphere!.center.z);
        expect(r - sphere!.radius, `${piece.name} bowl clearance`).toBeGreaterThan(27);
        const away = angleBetween(Math.atan2(sphere!.center.z, sphere!.center.x), def.azimuth);
        const spread = Math.asin(Math.min(1, sphere!.radius / r));
        // The connective-3 tolerance: a sphere over a floor carpet or a
        // doorway veil spends much of its radius vertically.
        expect(away + spread, `${piece.name} cone`).toBeLessThan(def.wedge.endHalf + 0.08);
      }
    });
  }
});

describe("tier B: veil discipline (KIT-SPEC §3.7)", () => {
  for (const id of TIER_B) {
    it(`${id}'s veil planes keep the additive-order discipline`, () => {
      const flora = build(id);
      let planes = 0;
      for (const piece of drawables(subtree(flora, VEIL_GROUP_NAME))) {
        if (!(piece instanceof Mesh) || !piece.name.startsWith("kit-gate-veil-plane")) {
          continue;
        }
        planes += 1;
        const material = piece.material as MeshBasicMaterial;
        expect(material.opacity, `${piece.name} opacity`).toBeLessThanOrEqual(0.2);
        expect(material.depthWrite, `${piece.name} depthWrite`).toBe(false);
        expect(material.fog, `${piece.name} fog`).toBe(false);
        expect(material.transparent, `${piece.name} transparent`).toBe(true);
      }
      expect(planes).toBeGreaterThanOrEqual(2);
    });
  }
});

describe("tier B: containment and the wave-8 laws, re-asserted", () => {
  for (const id of TIER_B) {
    it(`keeps every ${id} T1 position inside the wedge and envelope`, () => {
      const def: WingDef = wingById(id);
      const spots = t1Positions(build(id));
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

  it("keeps the nursery den corridor and gate corridor (0.06 rad; r 30–34 bare)", () => {
    const def = wingById("nursery-shallows");
    for (const spot of t1Positions(build("nursery-shallows"))) {
      const r = Math.hypot(spot.x, spot.z);
      expect(r, `${spot.from} gate`).toBeGreaterThan(34.5);
      if (r <= 46) {
        const away = angleBetween(Math.atan2(spot.z, spot.x), def.azimuth);
        expect(away, `${spot.from} corridor at r=${r.toFixed(1)}`).toBeGreaterThanOrEqual(0.06);
      }
    }
  });

  it("keeps the lumen heart open (0.065 rad, r 39–45) against the fronds AND the veil", () => {
    const def = wingById("lumen-garden");
    const flora = build("lumen-garden");
    for (const spot of [...t1Positions(flora), ...veilVertices(flora)]) {
      const r = Math.hypot(spot.x, spot.z);
      if (r >= 39 && r <= 45) {
        const away = angleBetween(Math.atan2(spot.z, spot.x), def.azimuth);
        expect(away, `${spot.from} heart at r=${r.toFixed(1)}`).toBeGreaterThanOrEqual(0.064);
      }
    }
  });

  it("keeps the glass-cove clearing (3 m + 0.06 rad through r 30–46) against the grit", () => {
    const def = wingById("glass-cove");
    for (const spot of t1Positions(build("glass-cove"))) {
      const r = Math.hypot(spot.x, spot.z);
      if (r >= 30 && r <= 46) {
        expect(
          Math.abs(lateralOf(def, spot.x, spot.z)),
          `${spot.from} clearing at r=${r.toFixed(1)}`,
        ).toBeGreaterThanOrEqual(3.0);
        const away = angleBetween(Math.atan2(spot.z, spot.x), def.azimuth);
        expect(away, `${spot.from} approach`).toBeGreaterThan(0.06);
      }
    }
  });

  it("keeps the current-run channel (≥ 1.9 m) against the combed turf and the close's solids", () => {
    const def = wingById("current-run");
    for (const spot of t1Positions(build("current-run"))) {
      // The far-end close's recession planes and light column are
      // intangible light PAST the run's end, and the composition needs
      // them ON the axis — the wings-polish ledger's stated amendment.
      // The exemption carries its own radial fence so it can never
      // quietly swallow the channel the law protects.
      if (spot.from.startsWith("w3-run-close-")) {
        expect(Math.hypot(spot.x, spot.z), `${spot.from} stays past the run`).toBeGreaterThan(46.6);
        continue;
      }
      expect(
        Math.abs(lateralOf(def, spot.x, spot.z)),
        `${spot.from} channel`,
      ).toBeGreaterThanOrEqual(1.9);
    }
  });

  it("keeps the mangrove lane (0.05 rad) and the bare gate stretch against the seedlings", () => {
    const def = wingById("mangrove-roots");
    for (const spot of t1Positions(build("mangrove-roots"))) {
      const r = Math.hypot(spot.x, spot.z);
      expect(r, `${spot.from} gate`).toBeGreaterThanOrEqual(34.4);
      if (r <= 46) {
        const away = angleBetween(Math.atan2(spot.z, spot.x), def.azimuth);
        expect(away, `${spot.from} lane at r=${r.toFixed(1)}`).toBeGreaterThanOrEqual(0.05);
      }
    }
  });

  it("keeps the ice-grotto corridor (0.06 rad + footprint) against the hoarfrost", () => {
    const def = wingById("ice-grotto");
    for (const spot of t1Positions(build("ice-grotto"))) {
      const r = Math.hypot(spot.x, spot.z);
      expect(r, `${spot.from} gate lane`).toBeGreaterThan(34.5);
      if (r <= 46) {
        const away = angleBetween(Math.atan2(spot.z, spot.x), def.azimuth);
        expect(away, `${spot.from} corridor at r=${r.toFixed(1)}`).toBeGreaterThan(0.0605);
      }
    }
  });

  it("keeps the koi circle's flora ceiling against the moon-grass, and the gauze short of it", () => {
    const flora = build("moonlit-lagoon");
    for (const spot of t1Positions(flora)) {
      const r = Math.hypot(spot.x, spot.z);
      if (r >= MOONLIT_KOI_CIRCLE.from && r <= MOONLIT_KOI_CIRCLE.to) {
        const floor = seabedHeight(spot.x, spot.z);
        // Blade clumps stand at most ~0.62 m over their root.
        expect(spot.y, `${spot.from} circle`).toBeLessThan(floor + MOONLIT_KOI_CIRCLE.maxTop - 0.5);
      }
    }
    // The veil never enters the circle at all — every vertex radially short.
    for (const vertex of veilVertices(flora)) {
      expect(Math.hypot(vertex.x, vertex.z), `${vertex.from} gauze`).toBeLessThan(
        MOONLIT_KOI_CIRCLE.from,
      );
    }
  });

  it("keeps the sargassum turtle volume (r 38–46, y 4–6) empty — veil included", () => {
    const flora = build("sargassum-sky");
    const everything = [...t1Positions(flora), ...veilVertices(flora)];
    expect(everything.length).toBeGreaterThan(100);
    for (const spot of everything) {
      const r = Math.hypot(spot.x, spot.z);
      const inside = r > 38 && r < 46 && spot.y > 4 && spot.y < 6;
      expect(inside, `${spot.from} at r=${r.toFixed(1)} y=${spot.y.toFixed(1)}`).toBe(false);
    }
    // The floor stays a held breath: the fallen-pad litter is the batch's
    // sparsest T1 by design.
    const cards = t1Positions(flora).filter((spot) => spot.from.includes("carpet"));
    expect(cards.length).toBeLessThanOrEqual(160);
  });

  it("keeps the wreck-meadow gate stretch to its wave-8 pair of timbers", () => {
    for (const spot of t1Positions(build("wreck-meadow"))) {
      expect(Math.hypot(spot.x, spot.z), `${spot.from} gate`).toBeGreaterThanOrEqual(34.5);
    }
  });
});

describe("tier B: the new wall paints (glass-cove, current-run)", () => {
  it("are pure, identity below the blend floor, and stay in the wash band", () => {
    for (const def of [GLASS_COVE, CURRENT_RUN]) {
      expect(def.paint, def.id).toBeDefined();
      const ax = Math.cos(def.azimuth);
      const az = Math.sin(def.azimuth);
      // Below the blend floor nothing is written — the neighbours' bakes
      // keep their bytes (the paint contract).
      expect(def.paint!(40 * ax, 40 * az, 0, 0.01)).toBeNull();
      for (const [r, y, blend] of [
        [36, -2.5, 0.8],
        [42, -4.5, 0.55],
        [45, -1.0, 0.3],
      ] as const) {
        const a = def.paint!(r * ax, r * az, y, blend);
        const b = def.paint!(r * ax, r * az, y, blend);
        expect(a, `${def.id} paint at r=${r}`).not.toBeNull();
        expect(b).toEqual(a);
        for (const channel of a!) {
          expect(channel, `${def.id} channel`).toBeGreaterThan(0.85);
          expect(channel, `${def.id} channel`).toBeLessThan(1.15);
        }
      }
    }
  });
});

describe("tier B: motion", () => {
  for (const id of TIER_B) {
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
