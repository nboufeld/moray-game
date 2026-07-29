import {
  AdditiveBlending,
  BufferAttribute,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  Vector3,
  type BufferGeometry,
  type Camera,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { smoothstep01 } from "./SmokingShared";
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
  // The spring stair's two glimmers, where the pools shine back.
  { u: SPRINGS.u + 4, v: SPRINGS.v + 6, top: 13, width: 2.6, opacity: 0.08 },
  { u: SPRINGS.u - 10, v: SPRINGS.v - 8, top: 11, width: 2.2, opacity: 0.07 },
  // The lip's thin reveal-beam.
  { u: GORGE_LIP_U + 6, v: 0, top: 10, width: 2.0, opacity: 0.09, inGorge: true },
];

/** The ember pools: warm painted light on the ground, lit from below. */
// Round 1 whited the kiln pose out entirely: an additive fog-free pool
// seen from two metres fills half the frame, so these marks are sized
// and dimmed for the closest pose that can see them, not the farthest.
const GLOWS: readonly { u: number; v: number; radius: number; opacity: number }[] = [
  { u: KILN.u, v: KILN.v, radius: 5.5, opacity: 0.13 },
  { u: 508, v: -44, radius: 4.5, opacity: 0.12 },
  { u: 516, v: -52, radius: 4.5, opacity: 0.12 },
  { u: 494, v: -68, radius: 3.5, opacity: 0.1 },
  { u: 528, v: -34, radius: 3.5, opacity: 0.1 },
  { u: SPRINGS.u, v: SPRINGS.v, radius: 4, opacity: 0.1 },
];

export function buildSmokingLight(): { meshes: Mesh[] } {
  const random = new Random(SEED ^ 0x11f9);
  const meshes: Mesh[] = [];
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
  return { meshes };
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
