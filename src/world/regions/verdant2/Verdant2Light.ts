import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  ConeGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  Vector3,
  type BufferGeometry,
  type Camera,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { DRIFT_X, DRIFT_Z, smoothstep01 } from "./Verdant2Shared";
import { CISTERN, FERN_VAULT, worldOf } from "./Verdant2Terrain";

/**
 * The light of the Emerald Terraces: long *diagonal* blades — this deep,
 * the sun arrives slanted — a great fall of light over the Cistern with
 * a bright pool on its mirror floor, and the moss-lanterns that keep the
 * half-light places from going black.
 *
 * The canyon light-column discipline, all three parts: `fog: false` on
 * additive marks, a ground fade baked into vertex colours against
 * `seabedHeight`, and an edge-on fade per frame. The diagonal is a shear
 * applied after the blades stand — the fade math still reads the blade's
 * own yaw normals, which the shear leaves close enough to true.
 */

const SEED = SEEDS.regionVerdant2;

interface Blade {
  readonly u: number;
  readonly v: number;
  readonly top: number;
  readonly width: number;
  readonly opacity: number;
  /** Horizontal drift of the blade's head per metre of height. */
  readonly slant: number;
}

const BLADES: readonly Blade[] = [
  // The stair's reveal-blade, standing in the fourth step's open light.
  { u: 794, v: 2, top: 8, width: 2.6, opacity: 0.1, slant: 0.34 },
  // The gardens' pair, a fog-length apart along the terrace walk.
  { u: 862, v: -18, top: 2, width: 3.2, opacity: 0.11, slant: 0.38 },
  { u: 908, v: -2, top: 0, width: 2.4, opacity: 0.1, slant: 0.42 },
  // The Cistern's great fall of light — the region's brightest mark and
  // its first light peak. Fill round: grown 10.5 → 13 m wide, opacity
  // 0.22 → 0.3 (plan §4 — a named peak may carry more than an ordinary
  // mark; the 120 m range fade keeps it out of distant frames).
  { u: CISTERN.u, v: CISTERN.v, top: 4, width: 13, opacity: 0.3, slant: 0.3 },
  { u: CISTERN.u - 8, v: CISTERN.v + 7, top: 0, width: 3.0, opacity: 0.11, slant: 0.34 },
  // The vault's mouth: one thin blade at the threshold of the half-light.
  { u: FERN_VAULT.u + 16, v: FERN_VAULT.v + 14, top: -12, width: 1.8, opacity: 0.09, slant: 0.3 },
  // The Mistfall lip: a blade catching the rising milk.
  { u: 990, v: 8, top: -6, width: 2.8, opacity: 0.1, slant: 0.36 },
  // ── The fill blades (plan §4), appended after the pre-fill table so
  // the shared stream's existing draws never shift. ──
  // The threshold's first "this country has light" mark on the road in.
  { u: 700, v: -2, top: 6, width: 2.2, opacity: 0.09, slant: 0.3 },
  // The stair's rhythm: lit tread / shadow tread, at steps 2 and 6.
  { u: 762, v: 1, top: 6, width: 2.4, opacity: 0.1, slant: 0.36 },
  { u: 818, v: -2, top: 2, width: 2.6, opacity: 0.1, slant: 0.4 },
  // Two more on the terrace walk, so it meets a blade every ~40 m.
  { u: 876, v: -30, top: 0, width: 2.8, opacity: 0.1, slant: 0.4 },
  { u: 938, v: 18, top: 0, width: 2.6, opacity: 0.1, slant: 0.38 },
  // The Cistern's two rim satellites — the peak gets its retinue.
  { u: CISTERN.u + 10, v: CISTERN.v - 9, top: 2, width: 2.6, opacity: 0.11, slant: 0.32 },
  { u: CISTERN.u - 3, v: CISTERN.v + 13, top: 2, width: 2.2, opacity: 0.1, slant: 0.34 },
  // The vault's second, inner shaft, striking the first pillar under the
  // stone sky (the half-light finally has a light to be half of).
  { u: FERN_VAULT.u + 6, v: FERN_VAULT.v + 7, top: -23.4, width: 1.6, opacity: 0.1, slant: 0.18 },
  // A second lip blade on the Mistfall's north shoulder.
  { u: 1002, v: 26, top: -8, width: 2.4, opacity: 0.1, slant: 0.36 },
  // The balcony's raking diagonal across the balustrade, aimed at the
  // mesa city — the depth-3 promise is lit.
  { u: 1063, v: 46, top: -12, width: 3.0, opacity: 0.11, slant: 0.5 },
];

export function buildVerdant2Light(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEED ^ 0x11f8);
  const meshes: (Mesh | InstancedMesh)[] = [];
  const map = bladeSprite();

  for (const blade of BLADES) {
    const at = worldOf(blade.u, blade.v);
    const foot = seabedHeight(at.x, at.z) - 0.5;
    const length = blade.top - foot;
    const centerY = (blade.top + foot) / 2;
    const turn = random.range(0, Math.PI / 2);

    const sheets: BufferGeometry[] = [];
    const normals: Vector3[] = [];
    for (const spin of [0, Math.PI / 2]) {
      const sheet = new PlaneGeometry(blade.width, length, 4, 20);
      const yaw = turn + spin + random.signed(0.12);
      sheet.rotateY(yaw);
      sheet.translate(at.x, centerY, at.z);
      sheets.push(sheet);
      normals.push(new Vector3(Math.sin(yaw), 0, Math.cos(yaw)));
    }
    const geometry = mergeGeometries(sheets, false);
    for (const sheet of sheets) {
      sheet.dispose();
    }
    if (!geometry) {
      throw new Error("verdant2 light blades could not be merged");
    }
    // The diagonal: shear every vertex along the drift by its height.
    const position = geometry.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const rise = position.getY(i) - foot;
      position.setX(i, position.getX(i) + rise * blade.slant * DRIFT_X);
      position.setZ(i, position.getZ(i) + rise * blade.slant * DRIFT_Z);
    }
    position.needsUpdate = true;
    bakeGroundFade(geometry);
    geometry.computeBoundingSphere();

    const material = new MeshBasicMaterial({
      map,
      transparent: true,
      opacity: blade.opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      vertexColors: true,
      fog: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = "verdant2-light-blade";
    mesh.renderOrder = 2;
    const center = new Vector3(
      at.x + (centerY - foot) * blade.slant * DRIFT_X,
      centerY,
      at.z + (centerY - foot) * blade.slant * DRIFT_Z,
    );
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
      // The fourth part of the discipline (round 6): `fog: false` marks
      // never dim with distance, so without their own range fade the
      // Cistern's great blade washes frames a whole region away (the
      // Emerald Gate caught its bloom from 190 m). Dead by ~120 m.
      const range = 1 - smoothstep01((distance - 70) / 50);
      material.opacity = blade.opacity * smoothstep01((facing - 0.06) / 0.24) * range;
    };
    meshes.push(mesh);
  }

  meshes.push(buildCisternPool());
  meshes.push(buildMossLanterns());
  return { meshes };
}

/** The pool of light on the Cistern's mirror floor — pale jade, ringed. */
function buildCisternPool(): Mesh {
  const { x, z } = worldOf(CISTERN.u, CISTERN.v);
  // Fill round: the pool grows with its blade (12 → 14 m), light peak #1.
  const ring = new RingGeometry(0, 14, 32, 6);
  ring.rotateX(-Math.PI / 2);
  const position = ring.attributes.position!;
  const fade = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const lx = position.getX(i);
    const lz = position.getZ(i);
    position.setY(i, seabedHeight(x + lx, z + lz) + 0.08);
    const d = Math.hypot(lx, lz) / 14;
    const edge = 1 - smoothstep01((d - 0.3) / 0.7);
    const ripple = 1 - 0.25 * Math.max(0, Math.sin(d * 14)) ** 2;
    const value = edge * ripple;
    fade[i * 3] = value;
    fade[i * 3 + 1] = value;
    fade[i * 3 + 2] = value;
  }
  position.needsUpdate = true;
  ring.setAttribute("color", new BufferAttribute(fade, 3));
  ring.translate(x, 0, z);
  ring.computeBoundingSphere();

  const material = new MeshBasicMaterial({
    map: poolSprite(),
    color: 0xd6ecc4,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const mesh = new Mesh(ring, material);
  mesh.name = "verdant2-cistern-pool";
  mesh.renderOrder = 1;
  // Same range fade as the blades — the pool is `fog: false` additive
  // too, and reads as a floating glow from across the country without it.
  const center = new Vector3(x, seabedHeight(x, z), z);
  const baseOpacity = material.opacity;
  mesh.onBeforeRender = (_renderer, _scene, camera: Camera) => {
    const distance = center.distanceTo(camera.position);
    material.opacity = baseOpacity * (1 - smoothstep01((distance - 70) / 50));
  };
  return mesh;
}

/**
 * The moss-lanterns: small glowing spore-drops hanging in the vault's
 * and the grotto's half-light — the "darkest thing is a colour" rule
 * made literal. One instanced draw.
 */
function buildMossLanterns(): InstancedMesh {
  const random = new Random(SEED ^ 0x90f2);
  const drop = new ConeGeometry(0.09, 0.24, 5);
  drop.applyMatrix4(new Matrix4().makeRotationX(Math.PI));
  const material = createToonMaterial({
    color: 0x9db85a,
    emissive: 0x6a7a2e,
    emissiveIntensity: 0.85,
  });
  // Fill round: 44 → 60. The first 44 draw exactly as before (the reroll
  // fence); the growth is vault-biased (+12) with two grotto sparks and
  // the bridge's under-glow pair (plan §3, gardens T5).
  const count = 60;
  const mesh = new InstancedMesh(drop, material, count);
  mesh.name = "verdant2-moss-lanterns";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const tint = new Color();
  for (let i = 0; i < 44; i++) {
    // Two thirds under the vault's shelf, the rest around the grotto.
    const inVault = i % 3 !== 0;
    const u = inVault ? FERN_VAULT.u + random.signed(15) : 893 + random.signed(5);
    const v = inVault ? FERN_VAULT.v + random.signed(15) : 26 + random.signed(5);
    const { x, z } = worldOf(u, v);
    const floor = seabedHeight(x, z);
    const y = inVault ? floor + random.range(4.5, 7.5) : floor + random.range(2.2, 3.6);
    dummy.position.set(x, y, z);
    dummy.rotation.set(random.signed(0.3), random.range(0, Math.PI * 2), random.signed(0.3));
    dummy.scale.setScalar(random.range(0.7, 1.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tint.setHex(i % 4 === 0 ? 0xc4b45e : 0x9db85a).multiplyScalar(random.range(0.85, 1.15));
    mesh.setColorAt(i, tint);
  }
  const growth = new Random(SEED ^ 0xf910);
  for (let i = 44; i < count; i++) {
    let u: number;
    let v: number;
    let lift: [number, number];
    if (i < 56) {
      // The vault's share raised: the half-light gets more of its own light.
      u = FERN_VAULT.u + growth.signed(16);
      v = FERN_VAULT.v + growth.signed(16);
      lift = [4.2, 7.5];
    } else if (i < 58) {
      // Two more warm sparks in the grotto's green.
      u = 893 + growth.signed(5);
      v = 26 + growth.signed(5);
      lift = [2.0, 3.4];
    } else {
      // The Slab Bridge's under-glow pair, hung beneath the deck's span.
      u = 872 + (i - 58) * 4;
      v = -34.5 - (i - 58) * 1;
      lift = [1.2, 2.0];
    }
    const { x, z } = worldOf(u, v);
    const floor = seabedHeight(x, z);
    dummy.position.set(x, floor + growth.range(lift[0], lift[1]), z);
    dummy.rotation.set(growth.signed(0.3), growth.range(0, Math.PI * 2), growth.signed(0.3));
    dummy.scale.setScalar(growth.range(0.7, 1.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tint.setHex(i % 4 === 0 ? 0xc4b45e : 0x9db85a).multiplyScalar(growth.range(0.85, 1.15));
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
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

let bladeSpriteTexture: DataTexture | undefined;
function bladeSprite(): DataTexture {
  bladeSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.5);
    const along = Math.pow(v, 1.15) * Math.min(1, (1 - v) * 5);
    const value = bell * along;
    return [value * 0.8, value, value * 0.6];
  });
  return bladeSpriteTexture;
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
