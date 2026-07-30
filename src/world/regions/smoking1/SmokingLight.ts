import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RepeatWrapping,
  RingGeometry,
  Vector3,
  type Camera,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { smoothstep01 } from "./SmokingShared";
import { FILL_SEEDS } from "./SmokingFillShared";
import { COLONNADE } from "./SmokingBasalt";
import { CALDERA, GORGE_LIP_U, KILN, SPRINGS, gorgeChannelCenter, worldOf } from "./SmokingTerrain";

/**
 * The light of the Smoulder Fields. The sun is taken down by the mood
 * tables, so what light there is is *spent*: one broad dim fall of warm
 * light into the caldera's haze, two pale glimmers over the spring stair,
 * a thin reveal-beam at the gorge's lip — and the ember glows, painted
 * pools of warm light on the ground where the world is hot from below,
 * which is this region's inversion of the pilot's sunwell.
 *
 * The canyon light-column discipline, all three parts: `fog: false` on an
 * additive mark, a ground fade baked into vertex colours against
 * `seabedHeight`, and an edge-on fade per frame.
 */

const SEED = SEEDS.regionSmoking1;

interface Shaft {
  readonly u: number;
  readonly v: number;
  readonly top: number;
  readonly width: number;
  readonly opacity: number;
  readonly inGorge?: boolean;
}

const SHAFTS: readonly Shaft[] = [
  // The caldera's fall of light: broad, dim, the haze made visible.
  { u: CALDERA.u, v: CALDERA.v, top: 24, width: 11, opacity: 0.1 },
  { u: CALDERA.u - 9, v: CALDERA.v + 7, top: 20, width: 4, opacity: 0.07 },
  // The kiln's own breath: a warm column standing in the bowl, so the
  // "something old and calm at its centre" breaches the haze before the
  // kiln itself does (round 4 read the bowl as empty from its rim).
  { u: KILN.u + 1, v: KILN.v - 1, top: -1, width: 7, opacity: 0.15 },
  // The spring stair's two glimmers, where the pools shine back.
  { u: SPRINGS.u + 4, v: SPRINGS.v + 6, top: 13, width: 2.6, opacity: 0.08 },
  { u: SPRINGS.u - 10, v: SPRINGS.v - 8, top: 11, width: 2.2, opacity: 0.07 },
  // The lip's thin reveal-beam.
  { u: GORGE_LIP_U + 6, v: 0, top: 10, width: 2.0, opacity: 0.09, inGorge: true },
  // Fill (plan §4.3): the colonnade's aisle blade — the swim-through
  // arcade gets the lip-beam treatment, one thin fall down the aisle.
  { u: COLONNADE.u, v: COLONNADE.v, top: 12, width: 2.4, opacity: 0.08 },
];

/** The ember pools: warm painted light on the ground, lit from below. */
// Round 1 whited the kiln pose out entirely: an additive fog-free pool
// seen from two metres fills half the frame, so these marks are sized
// and dimmed for the closest pose that can see them, not the farthest.
// The fill's ember ladder (plan §4.1) grows the table 6 → 14: warm
// seep-stains down the gorge (over the seep mats at 78/145/215), the
// fork cairn's glow, two flats stains at the road's mat rings, and the
// kiln's keeper-print seams — every 25–35 m of road, something warm
// underfoot. All merged into the ONE existing ember-pools draw. The Ash
// Meadows rest bar (u 330–360, v ±20) and the caldera's north quadrant
// are glow-free by the registry: the cairn's glow sits at u 363 with the
// cairn itself (deviation from the plan's u 360, logged), and the seam
// prints radiate south.
export const GLOWS: readonly { u: number; v: number; radius: number; opacity: number }[] = [
  { u: KILN.u, v: KILN.v, radius: 5.5, opacity: 0.13 },
  { u: 508, v: -44, radius: 4.5, opacity: 0.12 },
  { u: 516, v: -52, radius: 4.5, opacity: 0.12 },
  { u: 494, v: -68, radius: 3.5, opacity: 0.1 },
  { u: 528, v: -34, radius: 3.5, opacity: 0.1 },
  { u: SPRINGS.u, v: SPRINGS.v, radius: 4, opacity: 0.1 },
  // The gorge's seep-stains (small and dim — the round-1 whiteout lesson).
  { u: 78, v: gorgeChannelCenter(78) + 1.6, radius: 2.2, opacity: 0.08 },
  { u: 145, v: gorgeChannelCenter(145) + 1.6, radius: 2.4, opacity: 0.08 },
  { u: 215, v: gorgeChannelCenter(215) + 1.6, radius: 2.5, opacity: 0.08 },
  // The fork cairn and the flats' two road stains.
  { u: 363, v: 24, radius: 2.5, opacity: 0.09 },
  { u: 303, v: 24, radius: 2.2, opacity: 0.08 },
  { u: 318, v: -26, radius: 2.2, opacity: 0.08 },
  // The keeper-print seams, radiating south from the kiln.
  { u: KILN.u - 7, v: KILN.v - 5, radius: 2.0, opacity: 0.08 },
  { u: KILN.u + 7, v: KILN.v - 4, radius: 2.0, opacity: 0.08 },
];

export interface SmokingLightBuild {
  readonly meshes: (Mesh | Points)[];
  update(timeSec: number): void;
}

export function buildSmokingLight(): SmokingLightBuild {
  const random = new Random(SEED ^ 0x11f9);
  const meshes: (Mesh | Points)[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const map = shaftSprite();

  for (const shaft of SHAFTS) {
    const at = worldOf(shaft.u, shaft.v + (shaft.inGorge ? gorgeChannelCenter(shaft.u) : 0));
    const foot = seabedHeight(at.x, at.z) - 0.5;
    const length = shaft.top - foot;
    const centerY = (shaft.top + foot) / 2;
    const turn = random.range(0, Math.PI / 2);

    const blades: BufferGeometry[] = [];
    const normals: Vector3[] = [];
    for (const spin of [0, Math.PI / 2]) {
      const blade = new PlaneGeometry(shaft.width, length, 4, 20);
      const yaw = turn + spin + random.signed(0.12);
      blade.rotateY(yaw);
      blade.translate(at.x, centerY, at.z);
      blades.push(blade);
      normals.push(new Vector3(Math.sin(yaw), 0, Math.cos(yaw)));
    }
    const geometry = mergeGeometries(blades, false);
    for (const blade of blades) {
      blade.dispose();
    }
    if (!geometry) {
      throw new Error("smoulder shaft blades could not be merged");
    }
    bakeGroundFade(geometry);
    geometry.computeBoundingSphere();

    const material = new MeshBasicMaterial({
      map,
      transparent: true,
      opacity: shaft.opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      vertexColors: true,
      fog: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = "smoulder-shaft";
    mesh.renderOrder = 2;
    const center = new Vector3(at.x, centerY, at.z);
    mesh.onBeforeRender = (_renderer, _scene, camera: Camera) => {
      const view = new Vector3().subVectors(center, camera.position);
      const distance = view.length();
      if (distance < 1e-4) {
        return;
      }
      view.multiplyScalar(1 / distance);
      let facing = 1;
      for (const normal of normals) {
        facing = Math.min(facing, Math.abs(view.dot(normal)));
      }
      material.opacity = shaft.opacity * smoothstep01((facing - 0.06) / 0.24);
    };
    meshes.push(mesh);
  }

  meshes.push(buildEmberPools());

  // ─── The fill's event ladder (plan §4.3) ─────────────────────────────────
  const shimmer = buildShimmerColumns();
  meshes.push(shimmer.mesh);
  updaters.push(shimmer.update);

  const geyser = buildGeyser();
  meshes.push(geyser.points);
  updaters.push(geyser.update);

  return {
    meshes,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}

// ─── The heat-shimmer columns (EXCLUSIVE — plan §6b) ─────────────────────────

/**
 * A tall additive card pair with a slow vertical scroll — reads as heat
 * refraction standing over the gorge's warm pool (u 215) and the Twin
 * Kings' saddle. One merged draw; the scroll is the shared texture's
 * offset, driven off simulated time (capture-safe). Opacity far under
 * the round-5 additive figures; ground fade baked as vertex colour.
 */
function buildShimmerColumns(): { mesh: Mesh; update(timeSec: number): void } {
  const random = new Random(SEED ^ FILL_SEEDS.shimmer);
  const columns: { u: number; v: number; height: number; width: number }[] = [
    { u: 215, v: gorgeChannelCenter(215) + 1.6, height: 7.5, width: 2.6 },
    { u: 512, v: -48, height: 21, width: 3.4 },
  ];
  const parts: BufferGeometry[] = [];
  for (const column of columns) {
    const at = worldOf(column.u, column.v);
    const foot = seabedHeight(at.x, at.z) - 0.3;
    const turn = random.range(0, Math.PI);
    for (const spin of [0, Math.PI / 2]) {
      const blade = new PlaneGeometry(column.width, column.height, 2, 12);
      blade.rotateY(turn + spin);
      blade.translate(at.x, foot + column.height / 2, at.z);
      parts.push(blade);
    }
  }
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!geometry) {
    throw new Error("smoulder shimmer blades could not be merged");
  }
  bakeGroundFade(geometry);
  geometry.computeBoundingSphere();

  const texture = shimmerSprite();
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.07,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    vertexColors: true,
    fog: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "smoulder-heat-shimmer";
  mesh.renderOrder = 2;
  return {
    mesh,
    update(timeSec: number): void {
      // The refraction reads by the streaks CLIMBING: heat rises.
      texture.offset.y = -((timeSec * 0.045) % 1);
    },
  };
}

// ─── The Spring Head geyser (T5) ─────────────────────────────────────────────

/** The burst's period and active window, seconds. */
const GEYSER_PERIOD = 90;
const GEYSER_BURST = 7;

/**
 * A timed bubble jet over the Spring Head's throat (the seep-bubble
 * idiom): forty-six sprites climbing a 13 m column for seven seconds
 * every ninety, deterministic off simulated time. The crown pool below
 * keeps its registered stillness — the burst is the landmark's own
 * breath, born at the throat, standing in nothing.
 */
function buildGeyser(): { points: Points; update(timeSec: number): void } {
  const random = new Random(SEED ^ FILL_SEEDS.geyser);
  const head = worldOf(SPRINGS.u, SPRINGS.v);
  const throatY = seabedHeight(head.x, head.z) + 2.1;
  const count = 46;
  const rise = 13;

  const phases = new Float32Array(count);
  const drifts = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    phases[i] = random.range(0, 1);
    drifts[i * 2] = random.signed(0.5);
    drifts[i * 2 + 1] = random.signed(0.5);
  }

  const live = new Float32Array(count * 3);
  const shade = new Float32Array(count * 3);
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(live, 3);
  position.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", position);
  const color = new BufferAttribute(shade, 3);
  color.setUsage(DynamicDrawUsage);
  geometry.setAttribute("color", color);

  const material = new PointsMaterial({
    size: 0.24,
    map: bubbleSprite(),
    transparent: true,
    opacity: 0.55,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: true,
  });
  const points = new Points(geometry, material);
  points.name = "smoulder-geyser";

  const update = (timeSec: number): void => {
    const cycle = ((timeSec % GEYSER_PERIOD) + GEYSER_PERIOD) % GEYSER_PERIOD;
    // The envelope: quick onset, easing tail — a breath, not a valve.
    const envelope =
      smoothstep01(cycle / 1.2) * (1 - smoothstep01((cycle - GEYSER_BURST + 2) / 2));
    for (let i = 0; i < count; i++) {
      const t = (cycle * 0.24 + phases[i]!) % 1;
      live[i * 3] = head.x + drifts[i * 2]! * t * 2.4 + Math.sin(t * 9 + i) * 0.2;
      live[i * 3 + 1] = throatY + t * rise;
      live[i * 3 + 2] = head.z + drifts[i * 2 + 1]! * t * 2.4 + Math.cos(t * 8 + i * 1.7) * 0.2;
      // Born bright at the throat, dying into the water — and dark
      // entirely between bursts.
      const life = (1 - t * t) * envelope;
      shade[i * 3] = life;
      shade[i * 3 + 1] = life * 0.92;
      shade[i * 3 + 2] = life * 0.8;
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
  };
  update(0);
  // An authored, honest bound: the jet never leaves its column.
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.center.set(head.x, throatY + rise / 2, head.z);
  geometry.boundingSphere!.radius = rise / 2 + 4;

  return { points, update };
}

let shimmerSpriteTexture: DataTexture | undefined;
function shimmerSprite(): DataTexture {
  shimmerSpriteTexture ??= (() => {
    const texture = buildColorTexture(64, (u, v) => {
      // Narrow rising streaks inside a soft bell: refraction, not smoke.
      const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.8);
      const streaks =
        0.35 +
        0.65 *
          Math.max(
            0,
            Math.sin((u * 6 + fbm(u * 2, v * 2, { seed: SEED ^ 0x5111, period: 2, octaves: 2 }) * 2 + v * 3) * Math.PI * 2),
          );
      const alongFade = Math.min(1, v * 4) * Math.min(1, (1 - v) * 3);
      const value = bell * streaks * alongFade;
      return [value, value * 0.9, value * 0.78];
    });
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    return texture;
  })();
  return shimmerSpriteTexture;
}

let bubbleSpriteTexture: DataTexture | undefined;
function bubbleSprite(): DataTexture {
  bubbleSpriteTexture ??= buildColorTexture(32, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    // A bright rim over a dimmer heart — a bubble, not a mote.
    const rim = Math.pow(Math.max(0, 1 - Math.abs(d - 0.62) * 3.2), 2);
    const heart = Math.pow(Math.max(0, 1 - d), 2.4) * 0.5;
    const value = Math.min(1, rim + heart);
    return [value, value, value];
  });
  return bubbleSpriteTexture;
}

/** All the ember ground-pools merged into one additive mark. */
function buildEmberPools(): Mesh {
  const parts: BufferGeometry[] = [];
  for (const glow of GLOWS) {
    const { x, z } = worldOf(glow.u, glow.v);
    const ring = new RingGeometry(0, glow.radius, 22, 5);
    ring.rotateX(-Math.PI / 2);
    const position = ring.attributes.position!;
    const fade = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const lx = position.getX(i);
      const lz = position.getZ(i);
      position.setY(i, seabedHeight(x + lx, z + lz) + 0.1);
      const edge =
        (1 - smoothstep01((Math.hypot(lx, lz) / glow.radius - 0.3) / 0.7)) * glow.opacity * 2;
      fade[i * 3] = edge;
      fade[i * 3 + 1] = edge * 0.62;
      fade[i * 3 + 2] = edge * 0.34;
    }
    position.needsUpdate = true;
    ring.setAttribute("color", new BufferAttribute(fade, 3));
    ring.translate(x, 0, z);
    parts.push(ring);
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("smoulder ember pools could not be merged");
  }
  merged.computeBoundingSphere();

  const material = new MeshBasicMaterial({
    map: poolSprite(),
    color: 0xffb070,
    vertexColors: true,
    transparent: true,
    opacity: 0.24,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const mesh = new Mesh(merged, material);
  mesh.name = "smoulder-ember-pools";
  mesh.renderOrder = 1;
  return mesh;
}

function bakeGroundFade(geometry: BufferGeometry): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const above = position.getY(i) - seabedHeight(position.getX(i), position.getZ(i));
    const value = smoothstep01((above - 0.15) / 1.8);
    colors[i * 3] = value;
    colors[i * 3 + 1] = value * 0.92;
    colors[i * 3 + 2] = value * 0.8;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

let shaftSpriteTexture: DataTexture | undefined;
function shaftSprite(): DataTexture {
  shaftSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.5);
    const along = Math.pow(v, 1.15) * Math.min(1, (1 - v) * 5);
    const value = bell * along;
    return [value, value * 0.8, value * 0.56];
  });
  return shaftSpriteTexture;
}

let poolSpriteTexture: DataTexture | undefined;
function poolSprite(): DataTexture {
  poolSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const wobble = fbm(u, v, { seed: SEED ^ 0x90f3, period: 3, octaves: 2 });
    const rim = Math.hypot(u - 0.5, v - 0.5) * 2;
    const distance = Math.min(1, rim * (0.86 + 0.3 * wobble));
    const halo = Math.pow(Math.max(0, 1 - distance * distance), 2.4);
    return [halo, halo, halo];
  });
  return poolSpriteTexture;
}
