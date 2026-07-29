import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  LatheGeometry,
  Matrix4,
  Mesh,
  PlaneGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type DataTexture,
  type MeshToonMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { createSunViewUniform, injectLeafGlow, trackSunView } from "../../SeaGrass";
import {
  FOREST_TONES,
  MEADOW_TONES,
  TIP_GOLD,
  bakeSwayAttributes,
  injectVerdantSway,
  mergedMesh,
  smoothstep01,
  type SwayUniforms,
} from "./VerdantShared";
import {
  FOREST_BASIN,
  ROOT_MAZE,
  SUNWELL,
  mazeWeight,
  valeChannelCenter,
  worldOf,
} from "./VerdantTerrain";

/**
 * The High Forest, and every kelp plant in the Great Kelp Sea.
 *
 * This is the bowl kelp's merged-geometry idiom grown to geography: giants
 * of eighteen to twenty-five metres whose trunks become the region's
 * columns, crowned hard so the canopy closes overhead into a ceiling of
 * backlit leaf. Merged rather than instanced for the forest's own reason —
 * every leaf is welded to its own stalk's curve and sway phase — but split
 * into five area chunks (west forest, east forest, Sunwell ring, meadows,
 * Falling Edge) so frustum culling can retire whatever the fog has already
 * taken.
 *
 * ## The paint, improved over the Wave 8 idiom (the texture mandate)
 *
 * - The stipe carries three value stops, not a ramp: a violet-brown
 *   holdfast (red above green — the darkest thing on the trunk is a
 *   colour), an olive middle, a warm crown end.
 * - Straps take their stand's palette in rotation, a per-strap value
 *   jitter, a cool violet-leaned root band, and tips that lean into
 *   golden-olive — crowns hardest, because they live in the brightest
 *   water in the frame.
 * - The strap map gains ruffle shadow bands across the blade (real kelp
 *   carries them; the flat fibre of the Wave 8 map read as vinyl at trunk
 *   distance) and the midrib stays.
 * - Sun-through-leaf glow rides the shared `injectLeafGlow`, tuned a step
 *   warmer than the bowl forest: the canopy is the region's one big
 *   backlit surface and the breach swim is composed against it.
 *
 * Streams: placement `SEED ^ 0x1e0f`, leaves `^ 0x51ab`, crowns `^ 0xca9e`
 * — the bowl forest's three-stream split, kept so a canopy tune can never
 * move a holdfast.
 */

const SEED = SEEDS.regionVerdant1;

/** The giants' drawn range; the Elder stands above it. */
const GIANT_MIN = 18;
const GIANT_MAX = 24.5;
const ELDER_HEIGHT = 25.5;

const YOUNG_MIN = 3.2;
const YOUNG_MAX = 6.4;
/** The mid generation on the Falling Edge and the forest's eaves. */
const MID_MIN = 9;
const MID_MAX = 13;

const GIANT_RINGS = 16;
const STALK_SIDES = 7;
const YOUNG_RINGS = 8;

/** Tip sweep as a fraction of height. A 22 m giant's crown rides ~1.7 m. */
const GIANT_SWAY = 0.075;
const YOUNG_SWAY = 0.12;

/**
 * The stipe's three paint stops. Lifted a step in round 2: at round 1's
 * values a trunk two metres from the lens read as a charcoal pipe — the
 * darkest thing in the region must still be a colour with light in it.
 */
const HOLDFAST_TINT = new Color(0x6b5442);
const STIPE_TINT = new Color(0x7e9855);
const STIPE_CROWN_TINT = new Color(0xa3b264);

/** The vale's ledge kelp: cooler and deeper than the meadow's spring key. */
const VALE_TONES = [0x548a52, 0x639a58, 0x477a4a] as const;

export interface KelpFoot {
  readonly x: number;
  readonly z: number;
  readonly u: number;
  readonly v: number;
  readonly height: number;
}

export interface VerdantKelpBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** Giant trunk feet, for the serpent's weave and the composition tests. */
  readonly giants: KelpFoot[];
  update(dt: number, reducedMotion: boolean): void;
}

interface Chunk {
  readonly stalks: BufferGeometry[];
  readonly leaves: BufferGeometry[];
}

export function buildVerdantKelp(): VerdantKelpBuild {
  const random = new Random(SEED ^ 0x1e0f);
  const leafRandom = new Random(SEED ^ 0x51ab);
  const canopyRandom = new Random(SEED ^ 0xca9e);

  const sway: SwayUniforms = { sway: { value: 0 }, wind: { value: 1 } };
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const giants: KelpFoot[] = [];

  const chunks: Record<string, Chunk> = {
    forestWest: { stalks: [], leaves: [] },
    forestEast: { stalks: [], leaves: [] },
    sunwell: { stalks: [], leaves: [] },
    meadow: { stalks: [], leaves: [] },
    edge: { stalks: [], leaves: [] },
  };

  const grow = (
    chunk: Chunk,
    u: number,
    v: number,
    height: number,
    kind: "giant" | "mid" | "young",
    tones: readonly number[],
    crownBias?: number,
  ): void => {
    const { x, z } = worldOf(u, v);
    growPlant(chunk, random, leafRandom, canopyRandom, x, z, height, kind, tones, crownBias);
    contacts.push({ x, z, radius: kind === "giant" ? 1.1 : 0.7, strength: 0.42 });
    if (kind === "giant") {
      giants.push({ x, z, u, v, height });
      const foot = seabedHeight(x, z);
      colliders.push(
        { center: new Vector3(x, foot + 1.6, z), radius: 0.9 },
        { center: new Vector3(x, foot + 5.2, z), radius: 0.85 },
      );
    }
  };

  // ─── The High Forest ─────────────────────────────────────────────────────
  // Scattered through the basin with a minimum spacing that keeps trunks
  // reading as columns, holding clear of the Sunwell's bowl, the maze's
  // deep heart, and the wandering aisle a swimmer (and the serpent) follows
  // from the vale lip toward the Sunwell.
  const placed: { u: number; v: number }[] = [];
  const aisleAt = (u: number): number =>
    58 * smoothstep01((u - 300) / 165) + 6 * Math.sin(u * 0.05);
  let attempts = 0;
  while (placed.length < 29 && attempts < 400) {
    attempts++;
    const angle = random.range(0, Math.PI * 2);
    const spread = Math.sqrt(random.next()) * 104;
    const u = FOREST_BASIN.u + Math.cos(angle) * spread;
    const v = FOREST_BASIN.v + Math.sin(angle) * spread * 0.85;
    if (u < 305 || u > 585) {
      continue;
    }
    if (Math.hypot(u - SUNWELL.u, v - SUNWELL.v) < 40) {
      continue;
    }
    if (mazeWeight(u, v) > 0.4) {
      continue;
    }
    if (u < 480 && Math.abs(v - aisleAt(u)) < 5.5) {
      continue;
    }
    if (placed.some((p) => Math.hypot(p.u - u, p.v - v) < 9)) {
      continue;
    }
    placed.push({ u, v });
    const chunk = v < -12 ? chunks.forestWest! : chunks.forestEast!;
    grow(chunk, u, v, random.range(GIANT_MIN, GIANT_MAX), "giant", FOREST_TONES);
  }

  // ─── The Elder ───────────────────────────────────────────────────────────
  // The tallest living thing in the province, alone on its hillock where
  // the aisle bends — the serpent circles it.
  grow(chunks.forestEast!, 430, -22, ELDER_HEIGHT, "giant", FOREST_TONES);

  // ─── The Sunwell ring ────────────────────────────────────────────────────
  // Eight giants on the bowl's rim, crowns biased inward so the clearing is
  // a held breath: a ring of leaning light around open water.
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + random.signed(0.16);
    const ringR = random.range(38, 43);
    const u = SUNWELL.u + Math.cos(angle) * ringR;
    const v = SUNWELL.v + Math.sin(angle) * ringR;
    // The bias points each crown's straps at the well's centre.
    const { x, z } = worldOf(u, v);
    const toCenter = worldOf(SUNWELL.u, SUNWELL.v);
    const bias = Math.atan2(toCenter.x - x, -(toCenter.z - z)) + Math.PI / 2;
    grow(chunks.sunwell!, u, v, random.range(21, 24.5), "giant", FOREST_TONES, bias);
  }

  // ─── The vale lip pair ───────────────────────────────────────────────────
  // Two crooked mid giants flanking the saddle — the reveal's repoussoir.
  grow(chunks.meadow!, 263, -8.5, 13.5, "mid", FOREST_TONES);
  grow(chunks.meadow!, 267, 7.5, 12, "mid", FOREST_TONES);

  // ─── The Rolling Meadows' young stands ───────────────────────────────────
  for (let stand = 0; stand < 9; stand++) {
    const u = random.range(298, 392);
    const v = random.signed(70);
    if (Math.abs(v - aisleAt(u)) < 6) {
      continue;
    }
    const count = 2 + Math.floor(random.next() * 3);
    for (let i = 0; i < count; i++) {
      const du = random.signed(2.2);
      const dv = random.signed(2.2);
      grow(chunks.meadow!, u + du, v + dv, random.range(YOUNG_MIN, YOUNG_MAX), "young", MEADOW_TONES);
    }
  }
  // One young stand just past the lip, close enough for the reveal to
  // read plants before the fog: the meadows' welcome.
  for (let i = 0; i < 3; i++) {
    grow(
      chunks.meadow!,
      296 + random.signed(2.5),
      6 + random.signed(3),
      random.range(YOUNG_MIN + 1, YOUNG_MAX + 1),
      "young",
      MEADOW_TONES,
    );
  }

  // ─── The Long Vale's ledge kelp ──────────────────────────────────────────
  // Nine clusters on alternating wall feet down the vale — the something
  // that breaches the fog every thirty metres of a two-hundred-metre
  // approach, and the green the walls' moss paint is reaching toward.
  for (let i = 0; i < 9; i++) {
    const u = 78 + i * 23 + random.signed(5);
    const side = i % 2 === 0 ? 1 : -1;
    const vc = valeChannelCenter(u);
    const lateral = vc + side * random.range(5.5, 8.5);
    const count = 1 + Math.floor(random.next() * 2);
    for (let k = 0; k < count; k++) {
      grow(
        chunks.meadow!,
        u + random.signed(1.6),
        lateral + random.signed(1.2),
        random.range(2.6, 4.8),
        "young",
        VALE_TONES,
      );
    }
  }

  // ─── The Falling Edge's thinning line ────────────────────────────────────
  for (let i = 0; i < 9; i++) {
    const u = random.range(548, 608);
    const v = random.signed(95);
    if (mazeWeight(u, v) > 0.25) {
      continue;
    }
    const mid = random.next() < 0.4;
    grow(
      chunks.edge!,
      u,
      v,
      mid ? random.range(MID_MIN, MID_MAX) : random.range(YOUNG_MIN, YOUNG_MAX),
      mid ? "mid" : "young",
      FOREST_TONES,
    );
  }

  // ─── The meshes ──────────────────────────────────────────────────────────
  const meshes: Mesh[] = [];
  const sunView = createSunViewUniform();
  const stalkMat = stalkMaterial(sway);
  const leafMat = leafMaterial(sway, sunView);
  for (const [name, chunk] of Object.entries(chunks)) {
    if (chunk.stalks.length === 0) {
      continue;
    }
    meshes.push(mergedMesh(chunk.stalks, stalkMat, `verdant-kelp-stalks-${name}`));
    const leaves = mergedMesh(chunk.leaves, leafMat, `verdant-kelp-leaves-${name}`);
    trackSunView(leaves, sunView);
    meshes.push(leaves);
  }

  // ─── The Fallen Giant ────────────────────────────────────────────────────
  // A dead trunk lying across the Root Maze's widest gully: the landmark
  // that says the forest is old, and a beam to swim along in the half-light.
  const fallen = buildFallenGiant(random);
  meshes.push(fallen.mesh);
  colliders.push(...fallen.colliders);
  contacts.push(...fallen.contacts);

  return {
    meshes,
    colliders,
    contacts,
    giants,
    update(dt: number, reducedMotion: boolean): void {
      sway.sway.value += dt * (reducedMotion ? 0.3 : 1);
      sway.wind.value = reducedMotion ? 0.4 : 1;
    },
  };
}

// ─── One plant ───────────────────────────────────────────────────────────────

function growPlant(
  chunk: Chunk,
  random: Random,
  leafRandom: Random,
  canopyRandom: Random,
  x: number,
  z: number,
  height: number,
  kind: "giant" | "mid" | "young",
  tones: readonly number[],
  crownBias?: number,
): void {
  const giant = kind !== "young";
  const foot = seabedHeight(x, z);
  const phase = random.range(0, Math.PI * 2);
  const yaw = random.range(0, Math.PI * 2);
  const swayReach = giant ? GIANT_SWAY : YOUNG_SWAY;

  // A grown giant stands nearly straight — twenty metres of stipe at a
  // young stalk's lean is a fallen tree — but its S still wanders twice.
  const lean = random.range(0.1, 0.42) * (giant ? 0.28 : 1);
  const wave = random.signed(giant ? 0.05 : 0.2);
  const wave2 = Math.sin(phase * 3.7) * (giant ? 0.035 : 0.09);
  const curve = (t: number): number =>
    (lean * t * t + wave * Math.sin(t * Math.PI * 1.35) + wave2 * Math.sin(t * Math.PI * 2.6)) *
    height;

  const radius = random.range(0.85, 1.2) * (giant ? 0.24 : 0.06) * (kind === "mid" ? 0.6 : 1);
  const stalk = bendedStalk(height, curve, radius, giant ? GIANT_RINGS : YOUNG_RINGS);
  stalk.applyMatrix4(new Matrix4().makeRotationY(yaw));
  stalk.translate(x, foot, z);
  bakeSwayAttributes(stalk, phase, height * swayReach, (y) => (y - foot) / height);
  chunk.stalks.push(stalk);

  const attach = (
    t: number,
    around: number,
    length: number,
    width: number,
    droop: number,
    tone: number,
    crown: boolean,
    stream: Random,
    rise = 0,
  ): void => {
    const fine = crown || (giant && length > 2.2);
    const leaf = strapGeometry(length, width, droop, rise, tone, stream, crown, fine);
    const local = new Matrix4()
      .makeTranslation(curve(t), foot + t * height, 0)
      .multiply(new Matrix4().makeRotationY(around - yaw));
    leaf.applyMatrix4(local);
    leaf.applyMatrix4(new Matrix4().makeRotationY(yaw));
    leaf.translate(x, 0, z);
    bakeSwayAttributes(leaf, phase, height * swayReach, () => t);
    chunk.leaves.push(leaf);
  };

  // The base foliage, spiralled a golden angle apart and crowd-topped.
  const count = Math.round(
    giant ? leafRandom.range(16, 21) * (kind === "mid" ? 0.7 : 1) : leafRandom.range(9, 13),
  );
  const topBias = giant ? 0.6 : 0.72;
  for (let i = 0; i < count; i++) {
    const t = 0.22 + Math.pow((i + leafRandom.range(0.1, 0.9)) / count, topBias) * 0.74;
    const around = yaw + i * 2.4 + leafRandom.signed(0.5);
    const reach = giant ? Math.min(1.35, height / GIANT_MAX + 0.35) : Math.min(1.3, height / YOUNG_MAX);
    const length = leafRandom.range(1.4, 2.6) * (0.62 + t * 0.5) * reach;
    const width = length * leafRandom.range(0.3, 0.44);
    const droop = leafRandom.range(0.25, 0.75) * (1.15 - t * 0.5) * (giant && t > 0.75 ? 1.7 : 1);
    const rise = leafRandom.range(0.2, 0.7);
    attach(t, around, length, width, droop, tones[i % tones.length]!, giant && t > 0.72, leafRandom, rise);
  }

  // The crown cluster: trailing ribbons that lift, turn over and hang.
  const crownCount = Math.round(giant ? canopyRandom.range(11, 15) : canopyRandom.range(4, 6));
  const crownReach = giant ? Math.min(1, height / GIANT_MIN) : 1;
  for (let i = 0; i < crownCount; i++) {
    const t = canopyRandom.range(0.87, 1.0);
    const around =
      crownBias !== undefined
        ? crownBias + canopyRandom.signed(0.55)
        : yaw + canopyRandom.range(0, Math.PI * 2);
    const length = (giant ? canopyRandom.range(2.4, 3.8) : canopyRandom.range(0.9, 1.6)) * crownReach;
    const width = length * canopyRandom.range(0.3, 0.46);
    const droop = canopyRandom.range(1.1, 1.7);
    const rise = canopyRandom.range(0.15, 0.45);
    attach(t, around, length, width, droop, tones[i % tones.length]!, true, canopyRandom, rise);
  }

  // The canopy pads, giants only: the ceiling of leaf the breach swims
  // through. Fanned in a ring so they tile the sky.
  if (kind === "giant") {
    const padCount = Math.round(canopyRandom.range(6, 8));
    for (let i = 0; i < padCount; i++) {
      const t = canopyRandom.range(0.955, 1.0);
      const around =
        (crownBias !== undefined ? crownBias : yaw) +
        (i / padCount) * Math.PI * 2 +
        canopyRandom.signed(0.4);
      const length = canopyRandom.range(1.6, 2.3) * crownReach;
      const width = length * canopyRandom.range(0.5, 0.66);
      const droop = canopyRandom.range(0.16, 0.34);
      attach(t, around, length, width, droop, tones[(i + 1) % tones.length]!, true, canopyRandom);
    }
  }
}

// ─── The stipe ───────────────────────────────────────────────────────────────

function bendedStalk(
  height: number,
  curve: (t: number) => number,
  radius: number,
  rings: number,
): BufferGeometry {
  const points: Vector2[] = [new Vector2(0, -0.12)];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const taper = (1.35 - t * 0.95) * (1 + Math.exp(-t * 9) * 0.5);
    points.push(new Vector2(radius * taper, t * height));
  }
  points.push(new Vector2(0, height));

  const geometry = new LatheGeometry(points, STALK_SIDES);
  const position = geometry.attributes.position!;
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const t = Math.min(1, Math.max(0, y / height));
    position.setX(i, position.getX(i) + curve(t));
    // Three stops up the trunk: violet-brown holdfast, olive body, warm
    // crown end — the value structure a twenty-metre column needs to read
    // as a column and not a pipe.
    if (t < 0.3) {
      shade.copy(HOLDFAST_TINT).lerp(STIPE_TINT, smoothstep01(t / 0.3));
    } else {
      shade.copy(STIPE_TINT).lerp(STIPE_CROWN_TINT, smoothstep01((t - 0.3) / 0.7));
    }
    shade.multiplyScalar(0.84 + t * 0.32);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

// ─── The straps ──────────────────────────────────────────────────────────────

function outline(v: number, peak: number): number {
  return Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, v)), peak)) ** 0.62;
}

/** FNV-1a over the drawn floats — per-leaf character with no stream traffic. */
function strapDetailSeed(length: number, width: number, droop: number, rise: number): number {
  let hash = 0x811c9dc5;
  for (const value of [length, width, droop, rise]) {
    const bits = new Uint32Array(new Float32Array([value]).buffer)[0]!;
    hash = Math.imul(hash ^ bits, 0x01000193);
  }
  return hash >>> 0;
}

function strapGeometry(
  length: number,
  width: number,
  droop: number,
  rise: number,
  tone: number,
  random: Random,
  crown: boolean,
  fine: boolean,
): BufferGeometry {
  const rows = fine ? 9 : 5;
  const geometry = new PlaneGeometry(1, 1, 2, rows);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(i, position.getX(i) * 2, position.getY(i) + 0.5, 0);
  }

  const detail = new Random(strapDetailSeed(length, width, droop, rise));
  const peak = detail.range(0.7, 0.96);
  const margin = detail.range(0.06, fine ? 0.16 : 0.12);
  const marginFreq = fine ? detail.range(2.2, 3.6) : detail.range(1.2, 2.1);
  const marginPhase = detail.range(0, Math.PI * 2);
  const ruffle = detail.range(fine ? 0.02 : 0.012, fine ? 0.04 : 0.022) * length;
  const ruffleFreq = fine ? detail.range(1.6, 2.7) : detail.range(1.0, 1.8);
  const rufflePhase = detail.range(0, Math.PI * 2);
  const cupBack = detail.range(0.12, 0.18);

  const tint = new Color(tone).multiplyScalar(random.range(0.85, 1.13));
  const rootShade = new Color(tone).multiplyScalar(0.62);
  // The root band leans violet-cool: red eased up over green so the shadow
  // where a strap meets its stipe is a colour, not a murk.
  rootShade.r = Math.min(1, rootShade.r * 1.18);
  rootShade.b = Math.min(1, rootShade.b * 1.3);
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const v = position.getY(i);
    const edge = position.getX(i);
    const wave =
      1 -
      margin *
        (0.5 + 0.5 * Math.sin(v * marginFreq * Math.PI * 2 + marginPhase + (edge < 0 ? 2.1 : 0)));
    const half = Math.min(outline(v, peak), outline(v, 0.82)) * wave;
    const across = edge * half * 0.5 * width;
    const bent = arcAlong(v, droop, rise);
    const reach = bent.along * length;
    const fall =
      -bent.drop * length + Math.sin(v * ruffleFreq * Math.PI * 2 + rufflePhase) * ruffle * v;
    const cup = Math.abs(across) * cupBack;
    position.setXYZ(i, reach - cup, fall, across);

    shade
      .copy(rootShade)
      .lerp(tint, smoothstep01(v / 0.3))
      .lerp(TIP_GOLD, v * v * (crown ? 0.55 : 0.3))
      .multiplyScalar(0.84 + v * 0.28);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/** Integrated droop arc — arc length is exactly the strap's length. */
function arcAlong(v: number, droop: number, rise = 0): { along: number; drop: number } {
  const clamped = Math.min(1, Math.max(0, v));
  const steps = 12;
  const dv = clamped / steps;
  let along = 0;
  let drop = 0;
  for (let s = 0; s < steps; s++) {
    const angle = droop * Math.pow((s + 0.5) * dv, 1.4) - rise;
    along += Math.cos(angle) * dv;
    drop += Math.sin(angle) * dv;
  }
  return { along, drop };
}

// ─── The Fallen Giant ────────────────────────────────────────────────────────

function buildFallenGiant(random: Random): {
  mesh: Mesh;
  colliders: SphereCollider[];
  contacts: ContactPatch[];
} {
  const from = worldOf(ROOT_MAZE.u - 18, ROOT_MAZE.v + 20);
  const to = worldOf(ROOT_MAZE.u + 6, ROOT_MAZE.v - 8);
  const fromY = seabedHeight(from.x, from.z) + 0.6;
  const toY = seabedHeight(to.x, to.z) + 1.4;
  const midX = (from.x + to.x) / 2 + random.signed(2);
  const midZ = (from.z + to.z) / 2 + random.signed(2);
  // The trunk sags between its ends but rides clear of the gully below it —
  // a bridge in the half-light, high enough to swim under at its middle.
  const midY = Math.max((fromY + toY) / 2 + 1.2, seabedHeight(midX, midZ) + 2.6);

  const path = new CatmullRomCurve3([
    new Vector3(from.x, fromY, from.z),
    new Vector3(midX, midY, midZ),
    new Vector3(to.x, toY, to.z),
  ]);
  const geometry = new TubeGeometry(path, 22, 0.55, 7, false);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  const worn = new Color(0x8a7a58);
  const bark = new Color(0x54402f);
  for (let i = 0; i < position.count; i++) {
    // Pale worn top, dark bark below: the light has been eating this trunk
    // for years and the paint says so.
    const t = Math.min(1, Math.max(0, (position.getY(i) - midY + 1.2) / 2.4));
    shade.copy(bark).lerp(worn, t * t);
    const grain = fbm(position.getX(i) * 0.4, position.getZ(i) * 0.4, {
      seed: SEED ^ 0xfa77,
      period: 6,
      octaves: 2,
    });
    shade.multiplyScalar(0.82 + grain * 0.3);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const mesh = new Mesh(geometry, createToonMaterial({ vertexColors: true }));
  mesh.name = "verdant-fallen-giant";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const colliders: SphereCollider[] = [];
  for (let i = 0; i <= 4; i++) {
    const at = path.getPoint(i / 4);
    colliders.push({ center: at, radius: 1.0 });
  }
  return {
    mesh,
    colliders,
    contacts: [
      { x: from.x, z: from.z, radius: 1.6, strength: 0.45 },
      { x: to.x, z: to.z, radius: 1.4, strength: 0.4 },
    ],
  };
}

// ─── The materials ───────────────────────────────────────────────────────────

function stalkMaterial(sway: SwayUniforms): MeshToonMaterial {
  const material = createToonMaterial({ map: stalkTexture(), vertexColors: true });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    injectVerdantSway(shader, sway);
  };
  material.customProgramCacheKey = () => "verdant-kelp-stalk";
  return material;
}

function leafMaterial(
  sway: SwayUniforms,
  sunView: ReturnType<typeof createSunViewUniform>,
): MeshToonMaterial {
  const material = createToonMaterial({
    side: DoubleSide,
    map: strapTexture(),
    vertexColors: true,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    injectVerdantSway(shader, sway);
    // A step warmer than the bowl forest's: the canopy is this region's
    // big backlit surface, and the breach is composed against its glow.
    injectLeafGlow(
      shader,
      sunView,
      "vec3(0.10, 0.21, 0.16)",
      "vec3(0.42, 0.33, 0.11)",
      "clamp(vMapUv.y, 0.0, 1.0)",
    );
  };
  material.customProgramCacheKey = () => "verdant-kelp-leaf";
  return material;
}

/**
 * The strap map: midrib, lengthwise fibre, and the ruffle shadow bands the
 * Wave 8 idiom was missing — a kelp blade is corrugated, and at trunk
 * distance those bands are most of what says "blade" instead of "ribbon".
 */
let strapMap: DataTexture | undefined;
function strapTexture(): DataTexture {
  strapMap ??= buildColorTexture(64, (u, v) => {
    const rib = 1 - Math.exp(-((u - 0.5) ** 2) / 0.004) * 0.24;
    const fibre =
      0.9 + fbm(u * 3, v, { seed: SEED ^ 0x1e11, period: 10, octaves: 2 }) * 0.2;
    const bands =
      1 - Math.max(0, Math.sin(v * Math.PI * 18 + Math.sin(u * 9) * 1.4)) ** 2 * 0.14;
    const shade = (0.6 + v * 0.5) * fibre * rib * bands;
    return [shade * 0.86, shade, shade * 0.6];
  });
  return strapMap;
}

/** The stipe map: lengthwise cord grain. */
let stalkMap: DataTexture | undefined;
function stalkTexture(): DataTexture {
  stalkMap ??= buildColorTexture(32, (u, v) => {
    const grain =
      0.66 + fbm(u * 2, v * 6, { seed: SEED ^ 0x51ff, period: 8, octaves: 2 }) * 0.28;
    return [grain * 0.94, grain, grain * 0.72];
  });
  return stalkMap;
}
