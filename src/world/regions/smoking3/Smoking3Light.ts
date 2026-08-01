import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  RingGeometry,
  Vector3,
  type Camera,
  type DataTexture,
  type Points,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildGlowColony } from "../kit/GlowColony";
import type { KitBuild } from "../kit/KitTypes";
import { ventSpot } from "./Smoking3Lanterns";
import { LV_SEEDS, smoothstep01 } from "./Smoking3Shared";
import {
  CRADLE,
  LANTERNS,
  POOLS,
  SPILT,
  VENT,
  benchFootU,
  channelCenter,
  wickCenter,
  worldOf,
} from "./Smoking3Terrain";

/**
 * The light of the Lantern Vigil — the province's law fulfilled: light
 * comes from BELOW, and here it finally goes UP. The sun is taken far
 * down by the mood tables; what falls from above is spent in two dim
 * falls only (one over the Ash Veil so the milk-pale drifts are FED,
 * one thin blade at the threshold crest for the reveal). The region's
 * real light is its own:
 *
 * - the lantern glass (baked into the spires' material, not here);
 * - lamp halos pooled at every lit lantern's foot — a lamp that
 *   brightens nothing beneath it is a decal;
 * - the Last Wick's ember stations, pacing the road every ~28 m;
 * - the Ember Fens' amber pool hearts and the Cradle's milk springs;
 * - **THE MORNING COLUMN** — the named light peak: the fire leaving
 *   the Vent's throat and climbing to the ceiling in one slow rising
 *   shaft, the province's whole arc paid off in a single vertical;
 * - heat shimmer over the hottest water, and the seam glow colonies —
 *   the small lives that gather where the ground is warm.
 *
 * The canyon light-column discipline, all three parts: `fog: false` on
 * an additive mark, a ground fade baked into vertex colours against
 * `seabedHeight`, and an edge-on fade per frame.
 */

const SEED = SEEDS.regionSmoking3;

interface Shaft {
  readonly u: number;
  readonly v: number;
  readonly top: number;
  readonly width: number;
  readonly opacity: number;
}

const SHAFTS: readonly Shaft[] = [
  // The Ash Veil's broad dim fall — the milk-pale drifts are FED.
  { u: 1480, v: 98, top: 22, width: 10, opacity: 0.08 },
  // The threshold crest's thin reveal-blade.
  { u: 1224, v: 1, top: 10, width: 2.0, opacity: 0.09 },
];

/** The warm painted ground-light: lamp halos, wick stations, pool
 *  hearts, the stair's cadence, the Vent's forecourt. Lit from below —
 *  strung so the whole road reads as a river of kept flame. */
export const GLOWS: readonly { u: number; v: number; radius: number; opacity: number }[] = [
  // The Last Wick's ember stations (agreeing with the seam thread).
  { u: 1318, v: wickCenter(1318) - 1.2, radius: 2.4, opacity: 0.09 },
  { u: 1346, v: wickCenter(1346) + 1.6, radius: 2.2, opacity: 0.08 },
  { u: 1374, v: wickCenter(1374) - 1.4, radius: 2.6, opacity: 0.09 },
  { u: 1402, v: wickCenter(1402) + 1.8, radius: 2.2, opacity: 0.08 },
  { u: 1430, v: wickCenter(1430) - 1.2, radius: 2.6, opacity: 0.09 },
  { u: 1458, v: wickCenter(1458) + 1.4, radius: 2.4, opacity: 0.08 },
  { u: 1486, v: wickCenter(1486) - 1.6, radius: 2.4, opacity: 0.08 },
  { u: 1514, v: wickCenter(1514) + 1.4, radius: 2.6, opacity: 0.09 },
  { u: 1542, v: wickCenter(1542) - 1.2, radius: 2.4, opacity: 0.08 },
  { u: 1570, v: wickCenter(1570) + 1.6, radius: 2.6, opacity: 0.09 },
  { u: 1598, v: wickCenter(1598) - 1.4, radius: 2.8, opacity: 0.1 },
  // The Nightfall Stair's riser seams — the approach's warm cadence —
  // and the threshold's first seeps, so the door reads the vocabulary
  // before the reveal (R2: the r1 threshold arrived on bare glass).
  { u: 1182, v: channelCenter(1182) + 1.5, radius: 1.8, opacity: 0.07 },
  { u: 1212, v: channelCenter(1212) - 1.5, radius: 2.0, opacity: 0.08 },
  { u: 1240, v: channelCenter(1240), radius: 2.4, opacity: 0.1 },
  { u: benchFootU(0) + 1, v: channelCenter(benchFootU(0)), radius: 2.8, opacity: 0.11 },
  { u: benchFootU(2) + 1, v: channelCenter(benchFootU(2)) + 1.5, radius: 3.0, opacity: 0.11 },
  { u: benchFootU(4) + 1, v: channelCenter(benchFootU(4)) - 1.5, radius: 3.0, opacity: 0.11 },
  // The Ember Fens' pool hearts — the warm coals the fens are named
  // for (R3: brighter and wider; the r2 pools didn't read from a
  // standing pose because the halos were small and dim).
  ...POOLS.filter((pool) => !pool.cradle).map((pool) => ({
    u: pool.u,
    v: pool.v,
    radius: pool.radius * 1.05,
    opacity: 0.17,
  })),
  // The Vent's forecourt: the fire arriving at its own door.
  { u: VENT.u - 6, v: VENT.v + 1, radius: 5.0, opacity: 0.13 },
  { u: VENT.u + 2, v: VENT.v - 8, radius: 3.2, opacity: 0.1 },
  // The Spilt Light: the fallen lantern's pooled glow at its break.
  { u: SPILT.headU + 2, v: SPILT.headV + 2, radius: 3.4, opacity: 0.12 },
];

/** The lit lanterns' foot halos, derived from the same table the glass
 *  is built from — the lamps land their own light. */
const LAMP_HALOS: readonly { u: number; v: number; radius: number; opacity: number }[] =
  LANTERNS.filter((lantern) => lantern.lit).map((lantern) => ({
    u: lantern.u,
    v: lantern.v,
    radius: lantern.radius * 2.6,
    opacity: 0.1,
  }));

export interface Smoking3LightBuild {
  readonly meshes: (Mesh | Points)[];
  readonly groups: KitBuild["group"][];
  update(timeSec: number): void;
}

export function buildSmoking3Light(): Smoking3LightBuild {
  const random = new Random(SEED ^ LV_SEEDS.shafts);
  const meshes: (Mesh | Points)[] = [];
  const groups: KitBuild["group"][] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const map = shaftSprite();

  for (const shaft of SHAFTS) {
    const at = worldOf(shaft.u, shaft.v);
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
      throw new Error("vigil shaft blades could not be merged");
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
    mesh.name = "vigil-shaft";
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

  meshes.push(buildGroundPools(GLOWS, 0xffb070, "vigil-ember-pools"));
  meshes.push(buildGroundPools(LAMP_HALOS, 0xffc890, "vigil-lamp-halos"));
  meshes.push(
    buildGroundPools(
      POOLS.filter((pool) => pool.cradle).map((pool) => ({
        u: pool.u,
        v: pool.v,
        radius: pool.radius * 0.9,
        opacity: 0.14,
      })),
      0xffe0b8,
      "vigil-spring-pools",
    ),
  );

  // ─── THE MORNING COLUMN — the named light peak ────────────────────────────
  const column = buildMorningColumn();
  meshes.push(column.mesh);
  updaters.push(column.update);

  // ─── The heat-shimmer columns ─────────────────────────────────────────────
  const shimmer = buildShimmerColumns();
  meshes.push(shimmer.mesh);
  updaters.push(shimmer.update);

  // ─── The seam glow colonies ───────────────────────────────────────────────
  // Small warm lives gathered where the ground keeps its heat: the
  // Cradle's garden, the Vent's roots, the Spilt Light's break, and a
  // few lit lantern feet.
  const glowRandom = new Random(SEED ^ LV_SEEDS.gardenGlow ^ 0x0a);
  const gardenAnchors: [number, number, number][] = [];
  const anchorAt = (list: [number, number, number][], u: number, v: number): void => {
    const { x, z } = worldOf(u, v);
    list.push([x, seabedHeight(x, z) + 0.12, z]);
  };
  anchorAt(gardenAnchors, CRADLE.u - 14, CRADLE.v - 6);
  anchorAt(gardenAnchors, CRADLE.u + 4, CRADLE.v + 16);
  anchorAt(gardenAnchors, CRADLE.u + 16, CRADLE.v - 2);
  anchorAt(gardenAnchors, 1552, 44);
  anchorAt(gardenAnchors, 1572, 24);
  for (let i = 0; i < 3; i++) {
    anchorAt(gardenAnchors, CRADLE.u + glowRandom.signed(26), CRADLE.v + glowRandom.signed(24));
  }
  const garden = buildGlowColony({
    seed: SEED ^ LV_SEEDS.gardenGlow,
    tint: 0xff9450,
    anchors: gardenAnchors,
    budsPerAnchor: 6,
    glow: 0.34,
  });
  groups.push(garden.group);

  const lampAnchors: [number, number, number][] = [];
  anchorAt(lampAnchors, VENT.u - 7, VENT.v + 3);
  anchorAt(lampAnchors, VENT.u + 5, VENT.v + 7);
  anchorAt(lampAnchors, SPILT.headU + 2, SPILT.headV + 1);
  anchorAt(lampAnchors, 1330 + 2.5, -6 - 2);
  anchorAt(lampAnchors, 1428 + 3, -6 + 2);
  anchorAt(lampAnchors, 1494 - 3, 34 + 2);
  const lamps = buildGlowColony({
    seed: SEED ^ LV_SEEDS.lampGlow,
    tint: 0xffab60,
    anchors: lampAnchors,
    budsPerAnchor: 4,
    glow: 0.32,
  });
  groups.push(lamps.group);

  return {
    meshes,
    groups,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}

// ─── The Morning Column ──────────────────────────────────────────────────────

/**
 * The fire reaching the sky: crossed additive blades rising from the
 * Vent's lip to the country's ceiling, brightest where they leave the
 * throat, streaks CLIMBING (the shimmer texture's scroll, upward) —
 * light from below, finally going up. The named light peak: its 0.16
 * exceeds the ordinary 0.09 marks by licence (the plan's §4).
 */
function buildMorningColumn(): { mesh: Mesh; update(timeSec: number): void } {
  const vent = ventSpot();
  const foot = vent.lipY - 6;
  const top = 25.5;
  const length = top - foot;
  const parts: BufferGeometry[] = [];
  const normals: Vector3[] = [];
  for (const spin of [0, Math.PI / 2]) {
    const blade = new PlaneGeometry(7.5, length, 4, 24);
    // The column spreads as it rises — light unfurling.
    const position = blade.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const t = position.getY(i) / length + 0.5;
      position.setX(i, position.getX(i) * (1 + t * 0.5));
    }
    const yaw = 0.9 + spin;
    blade.rotateY(yaw);
    blade.translate(vent.x, (foot + top) / 2, vent.z);
    parts.push(blade);
    normals.push(new Vector3(Math.sin(yaw), 0, Math.cos(yaw)));
  }
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!geometry) {
    throw new Error("morning column blades could not be merged");
  }
  // The column's own fade: brightest at the lip, easing up — baked in
  // vertex colour (the ground fade discipline, inverted: this light's
  // "ground" is the throat it leaves).
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, (position.getY(i) - foot) / length));
    const value = (1 - smoothstep01((t - 0.12) / 0.88) * 0.8) * smoothstep01(t / 0.08);
    colors[i * 3] = value;
    colors[i * 3 + 1] = value * 0.82;
    colors[i * 3 + 2] = value * 0.58;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const texture = shimmerSprite();
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.18,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    vertexColors: true,
    fog: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "vigil-morning-column";
  mesh.renderOrder = 2;
  const center = new Vector3(vent.x, (foot + top) / 2, vent.z);
  const baseOpacity = 0.18;
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
    material.opacity = baseOpacity * smoothstep01((facing - 0.06) / 0.24);
  };
  return {
    mesh,
    update(timeSec: number): void {
      // The morning rises: the streaks climb, slightly faster than the
      // shimmer's — this is flight, not haze.
      texture.offset.y = -((timeSec * 0.055) % 1);
    },
  };
}

// ─── The heat-shimmer columns (province vocabulary) ─────────────────────────

/**
 * Tall additive card pairs with a slow vertical scroll — heat
 * refraction standing over the warmest water: the Vent's forecourt,
 * two fen pools, one Cradle spring. One merged draw; the scroll is the
 * shared texture's offset, driven off simulated time (capture-safe).
 */
function buildShimmerColumns(): { mesh: Mesh; update(timeSec: number): void } {
  const random = new Random(SEED ^ LV_SEEDS.shimmer);
  const columns: { u: number; v: number; height: number; width: number }[] = [
    { u: VENT.u - 6, v: VENT.v + 1, height: 14, width: 3.0 },
    { u: 1432, v: -102, height: 10, width: 2.6 },
    { u: 1408, v: -78, height: 8, width: 2.2 },
    { u: 1570, v: 52, height: 9, width: 2.4 },
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
    throw new Error("vigil shimmer blades could not be merged");
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
  mesh.name = "vigil-heat-shimmer";
  mesh.renderOrder = 2;
  return {
    mesh,
    update(timeSec: number): void {
      // The refraction reads by the streaks CLIMBING: heat rises.
      texture.offset.y = -((timeSec * 0.045) % 1);
    },
  };
}

let shimmerSpriteTexture: DataTexture | undefined;
function shimmerSprite(): DataTexture {
  shimmerSpriteTexture ??= (() => {
    const texture = buildColorTexture(64, (u, v) => {
      const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.8);
      const streaks =
        0.35 +
        0.65 *
          Math.max(
            0,
            Math.sin(
              (u * 6 +
                fbm(u * 2, v * 2, { seed: SEED ^ 0x5113, period: 2, octaves: 2 }) * 2 +
                v * 3) *
                Math.PI *
                2,
            ),
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

/** A set of warm ground-pools merged into one additive mark. */
function buildGroundPools(
  pools: readonly { u: number; v: number; radius: number; opacity: number }[],
  color: number,
  name: string,
): Mesh {
  const parts: BufferGeometry[] = [];
  for (const glow of pools) {
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
    throw new Error(`${name} could not be merged`);
  }
  merged.computeBoundingSphere();

  const material = new MeshBasicMaterial({
    map: poolSprite(),
    color,
    vertexColors: true,
    transparent: true,
    opacity: 0.24,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const mesh = new Mesh(merged, material);
  mesh.name = name;
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
    const wobble = fbm(u, v, { seed: SEED ^ 0x90f5, period: 3, octaves: 2 });
    const rim = Math.hypot(u - 0.5, v - 0.5) * 2;
    const distance = Math.min(1, rim * (0.86 + 0.3 * wobble));
    const halo = Math.pow(Math.max(0, 1 - distance * distance), 2.4);
    return [halo, halo, halo];
  });
  return poolSpriteTexture;
}
