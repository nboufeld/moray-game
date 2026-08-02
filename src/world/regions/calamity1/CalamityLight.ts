import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  Vector3,
  type Camera,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, buildScalarTexture, fbm } from "../../../rendering/ProceduralTexture";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBeamAndPool } from "../kit/BeamAndPool";
import { FILL_SEEDS } from "./CalamityFillShared";
import { SEEP_SPOTS } from "./CalamitySeeps";
import { smoothstep01 } from "./CalamityShared";
import { GATE_U, LAST_GROVE, WOUND, marchChannelCenter, worldOf } from "./CalamityTerrain";

/**
 * The light of the Sunken Calamity: pale blades through ash-water, the
 * grove's one surviving green-gold fall, and the Cold Candle's cold glow.
 *
 * The canyon light-column discipline, all three parts: `fog: false` on an
 * additive mark (fog on additive brightens distance instead of closing
 * it), a ground fade baked into vertex colours against `seabedHeight`,
 * and an edge-on fade per frame. Cool silver for the ruin — but the
 * grove's shaft keeps the old world's green, because the grove is where
 * the old world is.
 */

const SEED = SEEDS.regionCalamity;

interface Shaft {
  readonly u: number;
  readonly v: number;
  readonly top: number;
  readonly width: number;
  readonly opacity: number;
  /** Lateral is measured off the march channel's own wandering centre. */
  readonly inMarch?: boolean;
  /** The grove's shaft is the one warm mark in the region. */
  readonly warm?: boolean;
}

const SHAFTS: readonly Shaft[] = [
  // The Wound Gate's blade: the reveal's own light, standing in the pinch.
  { u: GATE_U + 4, v: 0, top: 12, width: 2.4, opacity: 0.12, inMarch: true },
  // Two pale blades down the Shatterfield causeway.
  { u: 514, v: -6, top: 14, width: 2.8, opacity: 0.1 },
  { u: 552, v: 10, top: 15, width: 3.2, opacity: 0.11 },
  // The Ghost Forest's cold cathedral light, spaced a fog-length apart.
  { u: 608, v: -10, top: 16, width: 3.4, opacity: 0.1 },
  // The fill's god-fall break: one more cold fall mid-forest, landing
  // beside the aisle so the dead ranks stand against it (fill plan §4).
  { u: 641, v: -12, top: 17, width: 4.2, opacity: 0.12 },
  // The Cold Candle's wide cold column: the crater's heart glows.
  { u: WOUND.u, v: WOUND.v, top: 18, width: 8, opacity: 0.13 },
  // The Last Grove's green-gold fall: the region's one warm mark.
  { u: LAST_GROVE.u - 2, v: LAST_GROVE.v + 2, top: 14, width: 5.5, opacity: 0.2, warm: true },
];

export interface CalamityLightBuild {
  readonly meshes: (Mesh | Points | Group)[];
  update(time: number, reducedMotion: boolean): void;
}

export function buildCalamityLight(): CalamityLightBuild {
  const random = new Random(SEED ^ 0x11f7);
  const meshes: (Mesh | Points | Group)[] = [];
  const map = shaftSprite();
  const warmMap = warmShaftSprite();

  for (const shaft of SHAFTS) {
    const at = worldOf(shaft.u, shaft.v + (shaft.inMarch ? marchChannelCenter(shaft.u) : 0));
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
      throw new Error("calamity shaft blades could not be merged");
    }
    bakeGroundFade(geometry);
    geometry.computeBoundingSphere();

    const material = new MeshBasicMaterial({
      map: shaft.warm ? warmMap : map,
      transparent: true,
      opacity: shaft.opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      vertexColors: true,
      fog: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = shaft.warm ? "calamity-shaft-grove" : "calamity-shaft";
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

  meshes.push(buildCraterGlow());

  // ═══ THE PHASE 3 FILL — the ember-INVERSE grown (fill plan §4): cold,
  // settling light, and the milk-white sky committed. ═══

  // The crater sky card: a faint wide brightening high over the Wound's
  // open column, so looking up from the terraces always reads "the sky
  // survived". One additive quad, opacity ≤ 0.06.
  {
    const at = worldOf(WOUND.u, WOUND.v);
    const card = new PlaneGeometry(56, 56, 1, 1);
    card.rotateX(-Math.PI / 2);
    card.translate(at.x, 16, at.z);
    card.computeBoundingSphere();
    const material = new MeshBasicMaterial({
      map: poolSprite(),
      color: 0xdfe9ee,
      transparent: true,
      opacity: 0.06,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    });
    const mesh = new Mesh(card, material);
    mesh.name = "calamity-sky-card";
    mesh.renderOrder = 2;
    meshes.push(mesh);
  }

  // Two terrace glow seams inside the Wound: the pools idiom in the cold
  // register (kit beamAndPool, pools only — a seam of chemical light
  // lying on a terrace lip; red kept low but never zero).
  {
    const seams = buildBeamAndPool({
      seed: SEED ^ FILL_SEEDS.terraceSeams,
      tint: 0xaec2d0,
      ground: seabedHeight,
      beams: [],
      pools: [
        { pos: [worldOf(692, 13).x, worldOf(692, 13).z], radius: 4.6, opacity: 0.2 },
        { pos: [worldOf(711, -13).x, worldOf(711, -13).z], radius: 3.8, opacity: 0.18 },
      ],
    });
    meshes.push(seams.group);
  }

  // The cold-fire wisps (region EXCLUSIVE — nothing else in the game may
  // burn cold): small drifting chemical flames over the five lesser
  // seeps, blue-white leaning violet, red low but never zero.
  const wisps = buildColdWisps();
  meshes.push(wisps.points);

  return {
    meshes,
    update(time: number, reducedMotion: boolean): void {
      wisps.update(time * (reducedMotion ? 0.4 : 1));
    },
  };
}

// ─── The cold-fire wisps ─────────────────────────────────────────────────────

let wispSpriteTexture: DataTexture | undefined;
function wispSprite(): DataTexture {
  wispSpriteTexture ??= buildScalarTexture(32, (u, v) => {
    // A teardrop flame: a hot foot easing into a tapered head.
    const dx = (u - 0.5) * 2.2;
    const dy = v - 0.35;
    const body = Math.max(0, 1 - Math.hypot(dx, dy * 1.8));
    return Math.pow(body, 2.2);
  });
  return wispSpriteTexture;
}

function buildColdWisps(): { points: Points; update: (time: number) => void } {
  const random = new Random(SEED ^ FILL_SEEDS.coldWisps);
  // The five garden seeps only — the crater's own light is the plume's.
  const spots = SEEP_SPOTS.slice(0, 5);
  const perWisp = 6;
  const count = spots.length * perWisp;
  const base = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const rates = new Float32Array(count);
  let index = 0;
  for (const spot of spots) {
    const { x, z } = worldOf(spot.u, spot.v);
    const mouth = seabedHeight(x, z) + 1.7 * spot.scale;
    for (let i = 0; i < perWisp; i++) {
      base[index * 3] = x + random.signed(0.4 * spot.scale);
      base[index * 3 + 1] = mouth + random.range(0.1, 0.5);
      base[index * 3 + 2] = z + random.signed(0.4 * spot.scale);
      phases[index] = random.range(0, Math.PI * 2);
      rates[index] = random.range(0.05, 0.09);
      index++;
    }
  }

  const live = new Float32Array(count * 3);
  const shade = new Float32Array(count * 3);
  const geometry = new BufferGeometry();
  const positionAttribute = new BufferAttribute(live, 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  const colorAttribute = new BufferAttribute(shade, 3);
  colorAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("color", colorAttribute);
  geometry.computeBoundingSphere();
  {
    const centre = worldOf(754, 60);
    geometry.boundingSphere!.center.set(centre.x, -8, centre.z);
    geometry.boundingSphere!.radius = 34;
  }

  const material = new PointsMaterial({
    size: 0.34,
    map: wispSprite(),
    // Blue-white leaning violet: red held LOW but never zero.
    color: 0xb4aede,
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: true,
  });
  const points = new Points(geometry, material);
  points.name = "calamity-cold-wisps";
  points.renderOrder = 3;

  const update = (time: number): void => {
    for (let i = 0; i < count; i++) {
      const p = phases[i]!;
      // Each flame climbs a short breath and dies, drifting as it goes —
      // cold and SETTLING: the rise is small, the fade long.
      const cycle = (p / (Math.PI * 2) + time * rates[i]!) % 1;
      live[i * 3] = base[i * 3]! + Math.sin(time * 0.5 + p) * 0.22;
      live[i * 3 + 1] = base[i * 3 + 1]! + cycle * 1.3;
      live[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(time * 0.4 + p * 1.6) * 0.22;
      const flicker = 0.6 + 0.4 * Math.sin(time * 2.1 + p * 3);
      const fade = Math.min(1, cycle / 0.15) * Math.min(1, (1 - cycle) / 0.35);
      const level = flicker * fade;
      shade[i * 3] = level * 0.92;
      shade[i * 3 + 1] = level * 0.88;
      shade[i * 3 + 2] = level;
    }
    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
  };
  update(0);
  return { points, update };
}

/** The cold glow lying on the Wound's floor around the Candle's foot. */
function buildCraterGlow(): Mesh {
  const { x, z } = worldOf(WOUND.u, WOUND.v);
  const ring = new RingGeometry(0, 8.5, 28, 6);
  ring.rotateX(-Math.PI / 2);
  const position = ring.attributes.position!;
  const fade = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const lx = position.getX(i);
    const lz = position.getZ(i);
    position.setY(i, seabedHeight(x + lx, z + lz) + 0.1);
    const edge = 1 - smoothstep01((Math.hypot(lx, lz) / 8.5 - 0.35) / 0.65);
    fade[i * 3] = edge;
    fade[i * 3 + 1] = edge;
    fade[i * 3 + 2] = edge;
  }
  position.needsUpdate = true;
  ring.setAttribute("color", new BufferAttribute(fade, 3));
  ring.translate(x, 0, z);
  ring.computeBoundingSphere();

  const material = new MeshBasicMaterial({
    map: poolSprite(),
    color: 0xbfd4d8,
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const mesh = new Mesh(ring, material);
  mesh.name = "calamity-crater-glow";
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
    colors[i * 3 + 1] = value;
    colors[i * 3 + 2] = value;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

let shaftSpriteTexture: DataTexture | undefined;
function shaftSprite(): DataTexture {
  shaftSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.5);
    const along = Math.pow(v, 1.15) * Math.min(1, (1 - v) * 5);
    const value = bell * along;
    // Cool silver: the ruin's light has the warmth gone out of it.
    return [value * 0.82, value * 0.92, value];
  });
  return shaftSpriteTexture;
}

let warmShaftSpriteTexture: DataTexture | undefined;
function warmShaftSprite(): DataTexture {
  warmShaftSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.5);
    const along = Math.pow(v, 1.15) * Math.min(1, (1 - v) * 5);
    const value = bell * along;
    // The grove's green-gold: the old world's light, kept in one place.
    return [value * 0.78, value, value * 0.5];
  });
  return warmShaftSpriteTexture;
}

let poolSpriteTexture: DataTexture | undefined;
function poolSprite(): DataTexture {
  poolSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const wobble = fbm(u, v, { seed: SEED ^ 0x90f1, period: 3, octaves: 2 });
    const rim = Math.hypot(u - 0.5, v - 0.5) * 2;
    const distance = Math.min(1, rim * (0.86 + 0.3 * wobble));
    const halo = Math.pow(Math.max(0, 1 - distance * distance), 2.4);
    return [halo, halo, halo];
  });
  return poolSpriteTexture;
}
