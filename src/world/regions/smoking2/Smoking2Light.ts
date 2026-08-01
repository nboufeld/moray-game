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
import { FC_SEEDS, smoothstep01 } from "./Smoking2Shared";
import {
  ANVIL,
  HEARTH,
  NIGHT_DOOR,
  RESTS,
  saddleCenter,
  washCenter,
  worldOf,
} from "./Smoking2Terrain";

/**
 * The light of the Forge Combs — the province's law, a register deeper:
 * light comes from BELOW. The sun is taken far down by the mood tables,
 * so what falls from above is spent sparingly (one broad dim fall over
 * the Pillow Meadows, a thin blade at the saddle crest for the reveal,
 * the Ladle's one glimmer — its licensed exception), and the region's
 * real light is the ground's: ember pools strung down the Emberwash's
 * seams, the First Hearth's junction star, the Anvil's forge-glow, the
 * Night Door's two watch-embers — and the seam glow colonies, the small
 * lives that gather where the rock is warm.
 *
 * The canyon light-column discipline, all three parts: `fog: false` on
 * an additive mark, a ground fade baked into vertex colours against
 * `seabedHeight`, and an edge-on fade per frame.
 */

const SEED = SEEDS.regionSmoking2;

interface Shaft {
  readonly u: number;
  readonly v: number;
  readonly top: number;
  readonly width: number;
  readonly opacity: number;
}

const SHAFTS: readonly Shaft[] = [
  // The Pillow Meadows' broad dim fall — the milk-bright tops are FED.
  { u: 885, v: 105, top: 20, width: 10, opacity: 0.09 },
  // The Ladle's one glimmer (the rest's licensed exception: the pool and
  // this light are the room's whole composition).
  { u: RESTS.ladle.u, v: RESTS.ladle.v, top: 14, width: 2.4, opacity: 0.07 },
  // The saddle crest's thin reveal-blade.
  { u: 706, v: 2, top: 10, width: 2.0, opacity: 0.09 },
  // The Kings' Run aisle: one pale fall between the tallest walls.
  { u: 918, v: 34, top: 16, width: 3.0, opacity: 0.07 },
];

/** The ember pools: warm painted light on the ground, lit from below —
 *  strung along the wash's seams so the road reads as a river of held
 *  heat, with the Hearth's star and the Anvil's court the brightest. */
export const GLOWS: readonly { u: number; v: number; radius: number; opacity: number }[] = [
  // The Emberwash stations (agreeing with the seam mats and veins).
  { u: 782, v: washCenter(782) - 1.5, radius: 2.6, opacity: 0.09 },
  { u: 812, v: washCenter(812) + 1.8, radius: 2.4, opacity: 0.08 },
  { u: 846, v: washCenter(846) - 1.2, radius: 2.8, opacity: 0.09 },
  { u: 872, v: washCenter(872) + 2, radius: 2.4, opacity: 0.08 },
  { u: 906, v: washCenter(906) - 1.6, radius: 2.8, opacity: 0.09 },
  { u: 968, v: washCenter(968) + 1.8, radius: 2.6, opacity: 0.08 },
  { u: 1002, v: washCenter(1002) - 1.4, radius: 2.4, opacity: 0.08 },
  { u: 1034, v: washCenter(1034) + 1.6, radius: 2.2, opacity: 0.07 },
  // The Anvil's forge-court: the heart's own heat.
  { u: ANVIL.u - 3, v: ANVIL.v - 6, radius: 4.5, opacity: 0.12 },
  { u: ANVIL.u + 6, v: ANVIL.v + 2, radius: 3.2, opacity: 0.1 },
  // The First Hearth's junction star.
  { u: HEARTH.u, v: HEARTH.v, radius: 5.5, opacity: 0.13 },
  { u: HEARTH.u - 12, v: HEARTH.v + 9, radius: 3.2, opacity: 0.1 },
  { u: HEARTH.u + 11, v: HEARTH.v - 8, radius: 3.0, opacity: 0.1 },
  { u: HEARTH.u + 4, v: HEARTH.v + 14, radius: 2.6, opacity: 0.09 },
  // The stair's riser seams, the approach's warm cadence.
  { u: 752, v: 0, radius: 2.0, opacity: 0.08 },
  { u: 772, v: -2, radius: 2.2, opacity: 0.08 },
  { u: 792, v: 2, radius: 2.2, opacity: 0.08 },
  // The saddle's seep stations.
  { u: 680, v: saddleCenter(680) - 2, radius: 1.8, opacity: 0.07 },
  { u: 708, v: saddleCenter(708) + 1.8, radius: 2.0, opacity: 0.07 },
  // The Night Door's two watch-embers, framing the reserved corridor.
  { u: NIGHT_DOOR.u - 5, v: -11, radius: 2.2, opacity: 0.1 },
  { u: NIGHT_DOOR.u - 3, v: 11, radius: 2.2, opacity: 0.1 },
];

export interface Smoking2LightBuild {
  readonly meshes: (Mesh | Points)[];
  readonly groups: KitBuild["group"][];
  update(timeSec: number): void;
}

export function buildSmoking2Light(): Smoking2LightBuild {
  const random = new Random(SEED ^ FC_SEEDS.shafts);
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
      throw new Error("forge shaft blades could not be merged");
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
    mesh.name = "forge-shaft";
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

  // ─── The heat-shimmer columns ─────────────────────────────────────────────
  const shimmer = buildShimmerColumns();
  meshes.push(shimmer.mesh);
  updaters.push(shimmer.update);

  // ─── The seam glow colonies ───────────────────────────────────────────────
  // Small warm lives clustered where the seams break the surface: the
  // Hearth's rays, the wash's brightest stations, the Anvil's seams.
  const glowRandom = new Random(SEED ^ FC_SEEDS.seamGlow ^ 0x0a);
  const glowAnchors: [number, number, number][] = [];
  const anchorAt = (u: number, v: number): void => {
    const { x, z } = worldOf(u, v);
    glowAnchors.push([x, seabedHeight(x, z) + 0.12, z]);
  };
  anchorAt(HEARTH.u - 8, HEARTH.v + 5);
  anchorAt(HEARTH.u + 9, HEARTH.v - 3);
  anchorAt(HEARTH.u + 2, HEARTH.v + 12);
  anchorAt(846, washCenter(846) + 2.4);
  anchorAt(906, washCenter(906) - 2.6);
  anchorAt(1002, washCenter(1002) + 2.2);
  anchorAt(ANVIL.u - 8, ANVIL.v - 8);
  for (let i = 0; i < 3; i++) {
    anchorAt(
      HEARTH.u + glowRandom.signed(26),
      HEARTH.v + glowRandom.signed(26),
    );
  }
  const colony = buildGlowColony({
    seed: SEED ^ FC_SEEDS.seamGlow,
    tint: 0xff9450,
    anchors: glowAnchors,
    budsPerAnchor: 6,
    glow: 0.34,
  });
  groups.push(colony.group);

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

// ─── The heat-shimmer columns (province vocabulary) ─────────────────────────

/**
 * Tall additive card pairs with a slow vertical scroll — heat refraction
 * standing over the hottest seams: the First Hearth's heart (the
 * region's tallest), the Anvil's court, and the wash's warm bend. One
 * merged draw; the scroll is the shared texture's offset, driven off
 * simulated time (capture-safe).
 */
function buildShimmerColumns(): { mesh: Mesh; update(timeSec: number): void } {
  const random = new Random(SEED ^ FC_SEEDS.shimmer);
  const columns: { u: number; v: number; height: number; width: number }[] = [
    { u: HEARTH.u, v: HEARTH.v, height: 19, width: 3.4 },
    { u: ANVIL.u - 4, v: ANVIL.v - 7, height: 13, width: 2.8 },
    { u: 872, v: washCenter(872) + 2, height: 8.5, width: 2.4 },
    { u: 1034, v: washCenter(1034) + 1.6, height: 7.5, width: 2.2 },
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
    throw new Error("forge shimmer blades could not be merged");
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
  mesh.name = "forge-heat-shimmer";
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
              (u * 6 + fbm(u * 2, v * 2, { seed: SEED ^ 0x5112, period: 2, octaves: 2 }) * 2 + v * 3) *
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
    throw new Error("forge ember pools could not be merged");
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
  mesh.name = "forge-ember-pools";
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
    const wobble = fbm(u, v, { seed: SEED ^ 0x90f4, period: 3, octaves: 2 });
    const rim = Math.hypot(u - 0.5, v - 0.5) * 2;
    const distance = Math.min(1, rim * (0.86 + 0.3 * wobble));
    const halo = Math.pow(Math.max(0, 1 - distance * distance), 2.4);
    return [halo, halo, halo];
  });
  return poolSpriteTexture;
}
