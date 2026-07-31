import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Vector2,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildScalarTexture } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { buildCarpetField } from "../../regions/kit/CarpetField";
import { buildDriftDebris } from "../../regions/kit/DriftDebris";
import { buildFallStreakTexture } from "../../regions/kit/FallStreak";
import { buildParticulateField } from "../../regions/kit/ParticulateField";
import { angleBetween, wedgeHalfAt } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";
import { mountGateVeil } from "./GateVeilMount";

/**
 * The Sandfall Dunes' flora (wave 8, `SEEDS.wingSandfallDunes` + substreams):
 * meditation, warm quiet. The bowl's own sand palette taken to its quietest
 * register.
 *
 * Four draw calls:
 *
 * - **Ridge stones** — smooth pale lathed stones stretched along both wedge
 *   walls, the dune walls' dressing. No roughing pass at all: the dune
 *   stones are water-worn, and their silhouette is a smooth pale line at
 *   the wall foot rather than the reef's hand-made lump.
 * - **The sandfall curtains** — the hero. Three falls (r ≈ 38, 42, 46,
 *   alternating walls) where sand spills over the dune lips and hangs in
 *   slow warm veils: vertical elongated ribbons whose alpha is baked per
 *   vertex (UV-less — streaks, side fade, lip and floor fades all live in
 *   the four-component colour attribute), cream values, normal blending.
 *   They never move; they are the stillness the falling streaks play
 *   against.
 * - **The falling streaks** — the motion. One InstancedMesh of small
 *   elongated crossed quads, the bubbles' billboard idiom inverted
 *   downward: each streak leaves the lip, sinks a hand's breadth per
 *   second, and is recycled to the top. Two crossed planes per streak, so
 *   no camera is needed (the abyss light columns' reason), and under
 *   reduced motion the whole system freezes mid-fall and dims to the faint
 *   static veil the brief allows — the curtains alone carry the look then.
 * - **Pebbles** — a sparse warm scatter at the stones' feet. The floor
 *   stays nearly empty: this is the wing a player goes to think in.
 *
 * There is no den here (the Lantern Leviathan passes beyond the end wall),
 * so the falls stand off-axis against the walls and the centre of the bowl
 * is kept deliberately bare. `tests/wingsW5Flora.test.ts` holds the
 * confinement, the budgets and the reduced-motion freeze.
 */

/** The stones' warm cream gradient, sand-worn base to sun-pale crown. */
const STONE_BASE = new Color(0.8, 0.74, 0.63);
const STONE_TOP = new Color(0.96, 0.91, 0.8);

/** The sandfalls' warm cream — bright sand, not glow. */
const CURTAIN_CREAM = new Color(0.94, 0.89, 0.77);
const STREAK_TINT = 0xefe0bd;

/** The pebbles' sandy tones. */
const PEBBLE_TONES = [0xcdbb96, 0xd8c8a4, 0xc2b088] as const;

/**
 * Connective-3 (MASTER Batch 3): the Tier A density uplift's one named
 * subtree — the same idiom as connective-2's `wing-uplift-conn2`: the
 * wave-8 tests that pin the ORIGINAL flora exclude this name from their
 * draw caps and nothing else; `tests/wingsConnective3.test.ts` measures
 * what lives inside it against R2's ceilings. Both Batch 3 wings
 * (sandfall-dunes, ruins-terrace) share the literal.
 */
export const CONN3_GROUP_NAME = "wing-uplift-conn3";

/**
 * The duneling bed's palette — sourced from what SHIPPED, not the plan:
 * golden-waste-1's dune-crest wire-grass (`GoldenCover.ts`, the r3 value
 * step) so the wing's bed and the Hourglass Sea's crests are one growth.
 * The region lifts its copy with a small emissive against its dim honey
 * sun; the wing's own light keeps far more of the rig (sun share 0.15),
 * so the bed starts on the shipped hues and is judged in captures.
 */
const DUNELING_PALETTE = { base: 0xdcc87a, tip: 0xf6eaaa, shade: 0xa8946a } as const;

/** The wrack drift's warm tan over a violet-grey underside. */
const WRACK_PALETTE = { base: 0xc9ac7e, shade: 0x8a7a8e } as const;

/** The gold motes — the Hourglass ledger's own gold (veil mote kin). */
const MOTE_GOLD = 0xffe0a0;

/** The bed's fences: the think-lane stays bare, the walls keep a margin. */
const BED_R_MIN = 38.2;
const BED_R_MAX = 48.0;
const BED_LANE_HALF = 1.6;
/** Radius past which the bed may cross the lane — the door apron. */
const BED_APRON_FROM = 46.2;

/** The curtains' texture-scroll rate (texture fraction per second ≈ 0.5 m/s
 *  of falling sand at the 6 m tile — sand in no hurry). */
const CURTAIN_SCROLL_PER_SEC = 0.085;

/** Metres one repeat of the fall texture covers on a curtain. */
const CURTAIN_TILE_METRES = 6;

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/**
 * One sandfall, shared by the curtain and the streaks: the same r, wall,
 * lip and height drive both, so the particles always fall *through* the
 * veil they brighten.
 */
interface Sandfall {
  readonly r: number;
  readonly across: number;
  /** Fall centre. */
  readonly cx: number;
  readonly cz: number;
  /** Unit vector along the fall's width — the radial, like the wall. */
  readonly dirX: number;
  readonly dirZ: number;
  /** Unit vector across the fall's face — the tangential normal. */
  readonly norX: number;
  readonly norZ: number;
  /** Plane yaw. */
  readonly yaw: number;
  /** Where the sand leaves the dune lip. */
  readonly lipY: number;
  /** Where it lands. */
  readonly baseY: number;
  readonly height: number;
  readonly width: number;
}

/** The three falls, drawn once and shared by both systems. */
function drawSandfalls(def: WingDef, random: Random): Sandfall[] {
  const falls: Sandfall[] = [];
  for (let i = 0; i < 3; i++) {
    const r = 38 + i * 4 + random.signed(0.6);
    const side = i % 2 === 0 ? -1 : 1;
    const across = side * (wedgeHalfAt(def, r) - 0.045);
    const theta = def.azimuth + across;
    const cx = Math.cos(theta) * r;
    const cz = Math.sin(theta) * r;
    const lipY = random.range(0.8, 1.6);
    const baseY = seabedHeight(cx, cz) - 0.3;
    const width = random.range(1.9, 2.3);
    falls.push({
      r,
      across,
      cx,
      cz,
      dirX: Math.cos(theta),
      dirZ: Math.sin(theta),
      norX: -Math.sin(theta),
      norZ: Math.cos(theta),
      // Local +x onto the radial: the curtain's width lies along the wall
      // face, its normal looks across the wedge.
      yaw: -theta + random.signed(0.08),
      lipY,
      baseY,
      height: lipY - baseY,
      width,
    });
  }
  return falls;
}

export function buildSandfallDunesFlora(def: WingDef): WingFlora {
  const group = new Group();
  group.name = "sandfall-dunes-flora";
  const contacts: ContactPatch[] = [];

  const random = new Random(SEEDS.wingSandfallDunes);
  const fallRandom = new Random(SEEDS.wingSandfallDunes ^ 0x5a1d);
  const falls = drawSandfalls(def, fallRandom);

  // ── The fall-mark repaint (connective-3, the standing wave-8 flag). ──
  // The wave-8 curtains baked their streaks into per-vertex alpha on a
  // 5 × 15 grid: linear interpolation across half-metre quads read as
  // stacked bloom blocks from the canonical pose ("blocky bloom smears —
  // hard quad edges through the glow"). The kit's fallStreak texture
  // carries the streaks at 128 px instead — overlapping tapered
  // soft-edged columns, scrolled slowly downward — while the curtains
  // keep their exact drawn placements (same stream, same draw count:
  // a repaint, not a re-roll; the open-blue curtain-ink precedent).
  // r2: five narrower, better-defined streams (six soft ones washed into
  // one broad sheet at pose range and the veil saturated back to blocks).
  const fallTexture = buildFallStreakTexture({
    seed: (SEEDS.wingSandfallDunes ^ 0xfa11) >>> 0,
    columns: 5,
    softness: 0.55,
  });
  group.add(buildStones(def, random, contacts));
  const curtains = buildCurtains(falls, fallTexture);
  group.add(curtains);
  const streaks = buildStreaks(falls);
  group.add(streaks.mesh);
  group.add(buildPebbles(def));

  // ── Connective-3: the Tier A uplift (MASTER Batch 3) ──
  // The golden handshake (MASTER §1.1, golden plan §8): the wing gains a
  // duneling bed and gold motes so the LIFE gradient starts before the
  // door. The bed thickens toward the doorway and keeps the wing's
  // think-lane bare (this is still the place a player goes to think);
  // a sparse wrack drift gives the bed's feet something the current
  // left. Every piece rides a fresh `^` substream fed to a kit-private
  // Random, appended after every existing draw — nothing above re-rolls
  // (the connective-1 sentinels hold) — and everything lives under one
  // named group so the wave-8 caps keep pinning the original flora.
  const uplift = new Group();
  uplift.name = CONN3_GROUP_NAME;

  const axisX = Math.cos(def.azimuth);
  const axisZ = Math.sin(def.azimuth);
  const lateralOf = (x: number, z: number): number => x * -axisZ + z * axisX;
  const bedGate = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    if (r < BED_R_MIN || r > BED_R_MAX) {
      return 0;
    }
    const away = angleBetween(Math.atan2(z, x), def.azimuth);
    if (away > wedgeHalfAt(def, r) - 1.1 / r) {
      return 0;
    }
    if (r < BED_APRON_FROM && Math.abs(lateralOf(x, z)) < BED_LANE_HALF) {
      return 0;
    }
    // The gradient: thin where the wing's quiet heart ends, thickening
    // toward the doorway — the Hourglass Sea started early.
    return 0.35 + 0.65 * smoothstep01((r - BED_R_MIN) / (BED_APRON_FROM - BED_R_MIN));
  };
  const bedArea = {
    center: [axisX * 43.2, axisZ * 43.2] as [number, number],
    radius: 5.6,
  };

  const dunelingBed = buildCarpetField({
    seed: (SEEDS.wingSandfallDunes ^ 0x3d1a) >>> 0,
    palette: DUNELING_PALETTE,
    area: bedArea,
    gate: bedGate,
    ground: seabedHeight,
    count: 240,
    profile: "blade",
    size: [0.34, 0.62],
    swayAmp: 0.04,
    sunGlow: true,
    looseShare: 0.4,
  });
  uplift.add(dunelingBed.group);

  // The wrack keeps a wider lane fence at every radius: a curl's merged
  // vertices reach ~0.95 m from its centre, and unlike the blades the
  // wrack never crosses the lane at the door apron.
  const wrackGate = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    if (r < BED_R_MIN || r > BED_R_MAX) {
      return 0;
    }
    const away = angleBetween(Math.atan2(z, x), def.azimuth);
    if (away > wedgeHalfAt(def, r) - 1.5 / r) {
      return 0;
    }
    if (Math.abs(lateralOf(x, z)) < 2.3) {
      return 0;
    }
    return 0.35 + 0.65 * smoothstep01((r - BED_R_MIN) / (BED_APRON_FROM - BED_R_MIN));
  };
  const wrack = buildDriftDebris({
    seed: (SEEDS.wingSandfallDunes ^ 0x3d2b) >>> 0,
    palette: WRACK_PALETTE,
    area: bedArea,
    gate: wrackGate,
    ground: seabedHeight,
    count: 46,
    shapeSet: "wrack",
  });
  uplift.add(wrack.group);

  // The gold motes: a drift filling the doorway half of the wedge,
  // biased gently INTO the wing — the region's gold blowing through the
  // door. The box is sized off the wedge itself so every live point
  // (volume + the kit's 1.9 m sway margin) stays inside the walls.
  const moteR = 43.0;
  const moteAlong = 8.0;
  const moteNearR = moteR - moteAlong / 2 - 0.6;
  const moteLateralRoom = moteNearR * wedgeHalfAt(def, moteNearR) - 1.9 - 0.4;
  const moteAcross = Math.max(1.6, 2 * (moteLateralRoom - (moteAlong / 2) * Math.abs(axisZ)));
  const moteFloor = seabedHeight(axisX * moteR, axisZ * moteR);
  const goldMotes = buildParticulateField({
    seed: (SEEDS.wingSandfallDunes ^ 0x3d3c) >>> 0,
    tint: MOTE_GOLD,
    count: 80,
    mode: "drift",
    volume: {
      center: [axisX * moteR, moteFloor + 2.4, axisZ * moteR],
      size: [moteAlong, 3.6, moteAcross],
    },
    size: 0.09,
    opacity: 0.5,
    bias: { dir: [-axisX, 0.05, -axisZ], speed: 0.12 },
  });
  uplift.add(goldMotes.group);

  group.add(uplift);

  // ── The gate veil (connective-1). ──
  // The quietest doorway ends on the Hourglass Sea's promise: honey over
  // violet — a deep violet-umber near ink warming to pale honey behind
  // the door — a gold-dapple column and the first gold motes drifting in,
  // the life gradient starting before the door the way the golden plan
  // asks. Appended after every existing draw, on its own `^` substream.
  // Round 3: a taller frame and a lighter far honey — at height 5 the
  // silhouettes barely crested the end wall from the wing's heart, and
  // the far ink sat too near the near one to read as country receding.
  const veil = mountGateVeil(def, {
    width: 7,
    height: 6,
    palette: [0x4a3a2e, 0x74583a, 0xb08e5c],
    column: { tint: 0xffe0a0, opacity: 0.1 },
    particulate: { tint: 0xffe0a0, count: 80 },
  });
  group.add(veil.group);

  let time = 0;
  let upliftTime = 0;
  return {
    group,
    contacts,
    update(dt: number, reducedMotion: boolean): void {
      veil.update(dt, reducedMotion);
      // The uplift's sway and drift ride the becalmed clock (closed-form
      // off simulated seconds — the kit contract, connective-2's idiom).
      upliftTime += dt * (reducedMotion ? 0.3 : 1);
      dunelingBed.update(upliftTime);
      goldMotes.update(upliftTime);
      if (reducedMotion) {
        // Becalmed: the falls freeze mid-fall and dim to faint static
        // veils — the baked curtains carry the look on their own. The
        // curtain scroll freezes with them (`time` stops).
        streaks.material.opacity = 0.15;
        return;
      }
      // r2: 0.5 → 0.42 — the streaks ADD over the curtain, and together
      // they saturated to white (the W5 becalmed test pins > 0.4).
      streaks.material.opacity = 0.42;
      time += dt;
      streaks.update(time);
      // The repainted curtains fall: the streak pattern rides slowly
      // down the veils, closed-form off the same simulated clock.
      fallTexture.offset.y = time * CURTAIN_SCROLL_PER_SEC;
    },
  };
}

/**
 * The ridge stones: thirty smooth pale stones hugging both wall feet from
 * the gate to the fade, elongated along the radial so they read as the dune
 * wall's own ridge line. The reef's stones are roughed; these are not —
 * water-worn dunes wear smooth.
 */
function buildStones(def: WingDef, random: Random, contacts: ContactPatch[]): InstancedMesh {
  const geometry = ridgeStoneGeometry();
  const material = createToonMaterial({ vertexColors: true });

  const count = 30;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "sandfall-stones";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const color = new Color();
  for (let i = 0; i < count; i++) {
    const r = 34 + i * 0.5 + random.signed(0.35);
    const side = i % 2 === 0 ? -1 : 1;
    const sx = random.range(0.8, 1.15);
    const sy = random.range(0.5, 0.85);
    const sz = random.range(1.2, 2.1);
    // With the long axis turned onto the radial, the stone's local x is its
    // tangential extent; the margin keeps every vertex inside the wedge.
    const margin = ((0.72 * sx) / r) * 1.05 + 0.006;
    const across = side * (wedgeHalfAt(def, r) - margin - random.next() * 0.012);
    const theta = def.azimuth + across;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    dummy.position.set(x, seabedHeight(x, z), z);
    // Local +z onto the radial, plus a seeded wander so the line is not ruled.
    dummy.rotation.set(random.signed(0.04), Math.PI / 2 - theta + random.signed(0.22), 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHex(0xffffff).multiplyScalar(random.range(0.88, 1.06));
    mesh.setColorAt(i, color);
    contacts.push({ x, z, radius: 0.8 * sz, strength: 0.35 });
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  return mesh;
}

/**
 * The smooth ridge stone: an authored lathe profile with no roughing pass,
 * normals welded smooth, shaded warm cream from a sand-worn base. Unit
 * height before instance scale.
 */
function ridgeStoneGeometry(): BufferGeometry {
  const profile: readonly (readonly [number, number])[] = [
    [0, -0.3],
    [0.42, -0.28],
    [0.62, -0.1],
    [0.7, 0.15],
    [0.62, 0.42],
    [0.45, 0.65],
    [0.22, 0.82],
    [0, 0.9],
  ];
  const geometry = new LatheGeometry(
    profile.map(([x, y]) => new Vector2(x, y)),
    10,
  );
  smoothNormals(geometry);

  const position = geometry.attributes.position!;
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, (position.getY(i) + 0.3) / 1.2));
    shade.copy(STONE_BASE).lerp(STONE_TOP, t);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/**
 * The static veils: one merged geometry of the three curtains, world space
 * like the abyss's. The fall SHAPE — side fade, lip fade, floor fade —
 * stays baked in four-component vertex colours; the STREAKS moved off the
 * vertex grid and onto the kit's fallStreak texture (connective-3): the
 * wave-8 bake interpolated an fbm field across half-metre quads and read
 * as stacked bloom blocks, where the 128 px texture carries true tapered
 * soft-edged columns. Same placements, same stream, same one draw.
 */
function buildCurtains(falls: readonly Sandfall[], texture: DataTexture): Mesh {
  const parts: BufferGeometry[] = [];
  for (const [index, fall] of falls.entries()) {
    const geometry = new PlaneGeometry(fall.width, fall.height, 4, 14);
    const position = geometry.attributes.position!;
    const uv = geometry.attributes.uv!;
    const colors = new Float32Array(position.count * 4);
    for (let i = 0; i < position.count; i++) {
      const u = position.getX(i) / fall.width + 0.5;
      const v = position.getY(i) / fall.height + 0.5;
      // The bell closes the side edges; the envelope takes both ends, so
      // no edge of the ribbon ever reads as a cut.
      const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.3);
      const envelope = smoothstep01((v - 0.02) / 0.16) * (1 - smoothstep01((v - 0.88) / 0.12));
      // r2: peak alpha 0.62 → 0.5 (capped 0.45) and the lift eased — at
      // the old register the near-white veil saturated over the bright
      // backdrop and the texture's clumps read as bright blocks again.
      const alpha = Math.min(0.45, bell * envelope * 0.5);
      const lift = 0.78 + 0.26 * v;
      colors[i * 4] = CURTAIN_CREAM.r * lift;
      colors[i * 4 + 1] = CURTAIN_CREAM.g * lift;
      colors[i * 4 + 2] = CURTAIN_CREAM.b * lift;
      colors[i * 4 + 3] = alpha;
      // World-metre UVs with a per-fall phase, so the three veils never
      // share columns and the shared scroll offset drifts them all.
      uv.setXY(
        i,
        index * 0.37 + (u * fall.width) / CURTAIN_TILE_METRES,
        index * 0.61 + (v * fall.height) / CURTAIN_TILE_METRES,
      );
    }
    geometry.setAttribute("color", new BufferAttribute(colors, 4));
    geometry.rotateY(fall.yaw);
    geometry.translate(fall.cx, (fall.lipY + fall.baseY) / 2, fall.cz);
    parts.push(geometry);
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("sandfall curtains could not be merged");
  }
  merged.computeBoundingSphere();

  const material = new MeshBasicMaterial({
    // The texture shapes the alpha; the vertex colours keep the cream and
    // the edge envelopes. Normal blending — bright sand, not glow.
    alphaMap: texture,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(merged, material);
  mesh.name = "sandfall-curtains";
  mesh.renderOrder = 1;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * The falling streaks: the bubbles' system inverted. One InstancedMesh of
 * elongated crossed quads, each recycling lip → floor at a hand's breadth
 * a second with the birth/fade envelope at both ends. Two crossed planes
 * per streak because `WingFlora.update` is handed no camera — the abyss
 * light columns' solution to the same constraint.
 */
function buildStreaks(falls: readonly Sandfall[]): {
  mesh: InstancedMesh;
  material: MeshBasicMaterial;
  update: (time: number) => void;
} {
  const random = new Random(SEEDS.wingSandfallDunes ^ 0x57ea);
  const perFall = 36;

  interface Streak {
    readonly fall: Sandfall;
    readonly widthOffset: number;
    readonly layer: number;
    readonly p0: number;
    readonly speed: number;
    readonly w: number;
    readonly h: number;
    readonly swayPhase: number;
    readonly fade: number;
  }
  const streaks: Streak[] = [];
  for (const fall of falls) {
    for (let s = 0; s < perFall; s++) {
      streaks.push({
        fall,
        widthOffset: random.signed(0.85),
        layer: random.signed(0.28),
        // Pre-spread down the fall, so the first frame already hangs.
        p0: random.next(),
        speed: random.range(0.22, 0.4),
        // r2: narrower grains — at 0.2 m the crossed quads clustered into
        // the bright chunks the repaint exists to kill.
        w: random.range(0.07, 0.16),
        h: random.range(0.45, 1.0),
        swayPhase: random.range(0, Math.PI * 2),
        fade: random.range(0.75, 1),
      });
    }
  }

  // Two crossed vertical quads sharing the streak sprite.
  const bladeA = new PlaneGeometry(1, 1);
  const bladeB = new PlaneGeometry(1, 1);
  bladeB.rotateY(Math.PI / 2);
  const geometry = mergeGeometries([bladeA, bladeB], false);
  bladeA.dispose();
  bladeB.dispose();
  if (!geometry) {
    throw new Error("sandfall streak blades could not be merged");
  }

  const material = new MeshBasicMaterial({
    // The sprite shapes the alpha, not the colour: under normal blending a
    // dark-rimmed colour map would read as smudge at half opacity.
    alphaMap: streakSprite(),
    color: STREAK_TINT,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new InstancedMesh(geometry, material, streaks.length);
  mesh.name = "sandfall-streaks";
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;

  const dummy = new Object3D();
  const update = (time: number): void => {
    for (const [i, streak] of streaks.entries()) {
      const { fall } = streak;
      const p = (streak.p0 + (time * streak.speed) / fall.height) % 1;
      const y = fall.lipY - p * fall.height;
      // A slow sideways wander as it sinks — sand in water, not on a wire.
      const wander = Math.sin(time * 0.3 + streak.swayPhase) * 0.2 * p;
      const along = streak.widthOffset + wander;
      dummy.position.set(
        fall.cx + fall.dirX * along + fall.norX * streak.layer,
        y,
        fall.cz + fall.dirZ * along + fall.norZ * streak.layer,
      );
      // The bubbles' envelope: grown in below the lip, gone before the sand.
      const envelope =
        smoothstep01(p / 0.1) * (1 - smoothstep01((p - 0.8) / 0.2)) * streak.fade;
      dummy.scale.set(streak.w * envelope, streak.h * envelope, 1);
      dummy.rotation.set(0, fall.yaw, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { mesh, material, update };
}

/** The pebbles: a sparse warm scatter along the wall feet, nothing more. */
function buildPebbles(def: WingDef): InstancedMesh {
  const random = new Random(SEEDS.wingSandfallDunes ^ 0x9ebb);
  const geometry = new IcosahedronGeometry(1, 0);
  const material = createToonMaterial({ color: 0xffffff });

  const count = 44;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "sandfall-pebbles";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const color = new Color();
  for (let i = 0; i < count; i++) {
    const r = random.range(34, 48.5);
    const side = random.next() < 0.5 ? -1 : 1;
    const across = side * (wedgeHalfAt(def, r) - random.range(0.02, 0.09));
    const theta = def.azimuth + across;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const scale = random.range(0.06, 0.2);
    dummy.position.set(x, seabedHeight(x, z) + scale * 0.2, z);
    dummy.rotation.set(random.signed(0.4), random.range(0, Math.PI * 2), random.signed(0.4));
    dummy.scale.set(scale, scale * 0.55, scale * random.range(0.8, 1.2));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color
      .setHex(PEBBLE_TONES[Math.floor(random.next() * PEBBLE_TONES.length)] ?? PEBBLE_TONES[0])
      .multiplyScalar(random.range(0.9, 1.08));
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  return mesh;
}

/**
 * The streak sprite: a soft vertical smear, closed at both ends so no
 * quad boundary ever shows. Scalar — under normal blending the material
 * colour carries the cream.
 */
let streakSpriteTexture: DataTexture | undefined;
function streakSprite(): DataTexture {
  streakSpriteTexture ??= buildScalarTexture(32, (u, v) => {
    const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.5);
    return bell * smoothstep01(v / 0.1) * (1 - smoothstep01((v - 0.9) / 0.1));
  });
  return streakSpriteTexture;
}
