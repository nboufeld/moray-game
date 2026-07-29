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
import { smoothstep01 } from "./VerdantShared";
import { SUNWELL, VALE_LIP_U, valeChannelCenter, worldOf } from "./VerdantTerrain";

/**
 * The light of the Great Kelp Sea: the Sunwell's great shaft, two lesser
 * blades over the forest aisle, and one thin reveal-beam at the vale's lip.
 *
 * The canyon light-column discipline, all three parts: `fog: false` on an
 * additive mark (fog on additive brightens distance instead of closing
 * it), a ground fade baked into vertex colours against `seabedHeight`
 * (a beam must die before it lands or it lands as a hard-edged wedge), and
 * an edge-on fade per frame (a crossed quad seen along its plane is a
 * bright hairline). Warm gold-green, because this water keeps its sun.
 *
 * The Sunwell's pool is the one place the region spends a bright mark on
 * the ground: the clearing is the composition's rest, and the pool is what
 * the eye lands on from the canopy's shadow forty metres out.
 */

const SEED = SEEDS.regionVerdant1;

interface Shaft {
  readonly u: number;
  readonly v: number;
  readonly top: number;
  readonly width: number;
  readonly opacity: number;
  /** Lateral is measured off the vale channel's own wandering centre. */
  readonly inVale?: boolean;
}

const SHAFTS: readonly Shaft[] = [
  // The Sunwell's fall of light: the region's brightest mark.
  { u: SUNWELL.u, v: SUNWELL.v, top: 20, width: 9, opacity: 0.15 },
  { u: SUNWELL.u - 7, v: SUNWELL.v + 8, top: 17, width: 3.4, opacity: 0.09 },
  // The aisle's two blades, spaced a fog-length apart along the swim line.
  { u: 398, v: 40, top: 12, width: 2.6, opacity: 0.1 },
  { u: 442, v: 6, top: 14, width: 3.0, opacity: 0.11 },
  // The lip's thin reveal-beam, standing in the saddle's open light.
  { u: VALE_LIP_U + 6, v: 0, top: 11, width: 2.0, opacity: 0.1, inVale: true },
];

export function buildVerdantLight(): { meshes: Mesh[] } {
  const random = new Random(SEED ^ 0x11f7);
  const meshes: Mesh[] = [];
  const map = shaftSprite();

  for (const shaft of SHAFTS) {
    const at = worldOf(shaft.u, shaft.v + (shaft.inVale ? valeChannelCenter(shaft.u) : 0));
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
      throw new Error("verdant shaft blades could not be merged");
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
    mesh.name = "verdant-shaft";
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

  meshes.push(buildSunwellPool());
  return { meshes };
}

/** The pool of light on the Sunwell's floor. */
function buildSunwellPool(): Mesh {
  const { x, z } = worldOf(SUNWELL.u, SUNWELL.v);
  const ring = new RingGeometry(0, 7.5, 28, 6);
  ring.rotateX(-Math.PI / 2);
  const position = ring.attributes.position!;
  const fade = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const lx = position.getX(i);
    const lz = position.getZ(i);
    position.setY(i, seabedHeight(x + lx, z + lz) + 0.08);
    const edge = 1 - smoothstep01((Math.hypot(lx, lz) / 7.5 - 0.35) / 0.65);
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
    color: 0xdcecac,
    vertexColors: true,
    transparent: true,
    opacity: 0.22,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const mesh = new Mesh(ring, material);
  mesh.name = "verdant-sunwell-pool";
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
    return [value * 0.82, value, value * 0.58];
  });
  return shaftSpriteTexture;
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
