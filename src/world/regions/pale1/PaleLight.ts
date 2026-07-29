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
import { smoothstep01 } from "./PaleShared";
import {
  QUIET_GALLERY,
  RAVINE_LIP_U,
  SEED_GROVE,
  ravineChannelCenter,
  worldOf,
} from "./PaleTerrain";

/**
 * The light of the Bone Meadows: a broad milk-column standing over the
 * Quiet Gallery (the white world's one soft radiance), a thin reveal
 * beam at the ravine's lip, a blade at the Blush Arch, and the Seed
 * Grove's warm fall — the brightest, warmest light in the region lands
 * on the mother-coral, because that is where the story is going.
 *
 * The canyon light-column discipline, all three parts: `fog: false` on
 * additive marks, a ground fade baked into vertex colours against
 * `seabedHeight`, and an edge-on fade per frame. The white half's shafts
 * are near-neutral milk; the grove's lean gold-rose.
 */

const SEED = SEEDS.regionPale1;

interface Shaft {
  readonly u: number;
  readonly v: number;
  readonly top: number;
  readonly width: number;
  readonly opacity: number;
  /** Milk shafts stay neutral; warm ones carry the grove's gold-rose. */
  readonly warm: boolean;
  readonly inRavine?: boolean;
}

const SHAFTS: readonly Shaft[] = [
  // The gallery's milk-column: wide, faint, and alone.
  { u: QUIET_GALLERY.u + 4, v: QUIET_GALLERY.v + 2, top: 18, width: 10, opacity: 0.09, warm: false },
  // The lip's thin reveal-beam.
  { u: RAVINE_LIP_U + 6, v: 0, top: 10, width: 2.0, opacity: 0.1, warm: false, inRavine: true },
  // The Blush Arch's blade.
  { u: 456, v: -11, top: 12, width: 2.6, opacity: 0.1, warm: true },
  // The Seed Grove's fall: the region's brightest mark.
  { u: SEED_GROVE.u, v: SEED_GROVE.v, top: 16, width: 8, opacity: 0.16, warm: true },
  { u: SEED_GROVE.u - 8, v: SEED_GROVE.v + 7, top: 13, width: 3.2, opacity: 0.09, warm: true },
];

export function buildPaleLight(): { meshes: Mesh[] } {
  const random = new Random(SEED ^ 0x11f9);
  const meshes: Mesh[] = [];
  const milk = milkSprite();
  const warm = warmShaftSprite();

  for (const shaft of SHAFTS) {
    const at = worldOf(shaft.u, shaft.v + (shaft.inRavine ? ravineChannelCenter(shaft.u) : 0));
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
      throw new Error("pale shaft blades could not be merged");
    }
    bakeGroundFade(geometry);
    geometry.computeBoundingSphere();

    const material = new MeshBasicMaterial({
      map: shaft.warm ? warm : milk,
      transparent: true,
      opacity: shaft.opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      vertexColors: true,
      fog: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = "pale-shaft";
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

  meshes.push(buildGrovePool());
  return { meshes };
}

/** The pool of warm light under the mother-coral. */
function buildGrovePool(): Mesh {
  const { x, z } = worldOf(SEED_GROVE.u, SEED_GROVE.v);
  const ring = new RingGeometry(0, 8, 28, 6);
  ring.rotateX(-Math.PI / 2);
  const position = ring.attributes.position!;
  const fade = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const lx = position.getX(i);
    const lz = position.getZ(i);
    position.setY(i, seabedHeight(x + lx, z + lz) + 0.08);
    const edge = 1 - smoothstep01((Math.hypot(lx, lz) / 8 - 0.35) / 0.65);
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
    color: 0xf2d8b0,
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const mesh = new Mesh(ring, material);
  mesh.name = "pale-grove-pool";
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

let milkSpriteTexture: DataTexture | undefined;
function milkSprite(): DataTexture {
  milkSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.5);
    const along = Math.pow(v, 1.15) * Math.min(1, (1 - v) * 5);
    const value = bell * along;
    return [value * 0.96, value * 0.97, value];
  });
  return milkSpriteTexture;
}

let warmShaftSpriteTexture: DataTexture | undefined;
function warmShaftSprite(): DataTexture {
  warmShaftSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.5);
    const along = Math.pow(v, 1.15) * Math.min(1, (1 - v) * 5);
    const value = bell * along;
    return [value, value * 0.82, value * 0.62];
  });
  return warmShaftSpriteTexture;
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
