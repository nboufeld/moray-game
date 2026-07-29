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
import { buildScalarTexture, fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { wedgeHalfAt } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";

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

  group.add(buildStones(def, random, contacts));
  group.add(buildCurtains(falls));
  const streaks = buildStreaks(falls);
  group.add(streaks.mesh);
  group.add(buildPebbles(def));

  let time = 0;
  return {
    group,
    contacts,
    update(dt: number, reducedMotion: boolean): void {
      if (reducedMotion) {
        // Becalmed: the falls freeze mid-fall and dim to faint static
        // veils — the baked curtains carry the look on their own.
        streaks.material.opacity = 0.15;
        return;
      }
      streaks.material.opacity = 0.5;
      time += dt;
      streaks.update(time);
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
 * like the abyss's. The fall shape — side fade, lip fade, floor fade and
 * the vertical streaks — is all baked into four-component vertex colours,
 * so the material is a plain transparent basic and the veil reads in fog.
 */
function buildCurtains(falls: readonly Sandfall[]): Mesh {
  const parts: BufferGeometry[] = [];
  for (const [index, fall] of falls.entries()) {
    const geometry = new PlaneGeometry(fall.width, fall.height, 4, 14);
    const position = geometry.attributes.position!;
    const colors = new Float32Array(position.count * 4);
    for (let i = 0; i < position.count; i++) {
      const u = position.getX(i) / fall.width + 0.5;
      const v = position.getY(i) / fall.height + 0.5;
      // The bell closes the side edges; the envelope takes both ends, so
      // no edge of the ribbon ever reads as a cut.
      const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.3);
      const envelope = smoothstep01((v - 0.02) / 0.16) * (1 - smoothstep01((v - 0.88) / 0.12));
      // UV-less streaks: fbm across the fall's width, one field per fall.
      const streak =
        0.65 +
        0.7 *
          fbm(u * 2.5, index * 7.3, { seed: SEEDS.wingSandfallDunes ^ 0x5a1d, period: 3, octaves: 2 });
      const alpha = Math.min(0.55, bell * envelope * streak * 0.55);
      const lift = 0.82 + 0.3 * v;
      colors[i * 4] = CURTAIN_CREAM.r * lift;
      colors[i * 4 + 1] = CURTAIN_CREAM.g * lift;
      colors[i * 4 + 2] = CURTAIN_CREAM.b * lift;
      colors[i * 4 + 3] = alpha;
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
        w: random.range(0.09, 0.2),
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
