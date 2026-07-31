import {
  AdditiveBlending,
  BufferAttribute,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MultiplyBlending,
  PlaneGeometry,
  RepeatWrapping,
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
import { FILL_SEEDS } from "./Blue1FillShared";
import { smoothstep01, WIND_X, WIND_Z } from "./Blue1Shared";
import { CENTER_X, CENTER_Z, dropWeight, spokeOf, worldOf } from "./Blue1Terrain";

/**
 * The light of the Drop Plains: the prairie's high sun made visible.
 *
 * Three broad pale blades stand over the steppe — the "sun kept fairly
 * high" written into the water — and one thin warm beam falls at the
 * Fallen King's foot, marking the secret for anyone who has come close
 * enough to deserve it, with a small pool of light on the sand below.
 * Nothing stands over the World's Edge: the drop's light is taken away
 * by the mood's descent, and a beam there would argue with the dark.
 *
 * The canyon light-column discipline, all three parts: `fog: false` on
 * an additive mark, a ground fade baked into vertex colours against
 * `seabedHeight`, and an edge-on fade per frame.
 */

const SEED = SEEDS.regionBlue1;

interface Shaft {
  readonly u: number;
  readonly v: number;
  readonly top: number;
  readonly width: number;
  readonly opacity: number;
}

const SHAFTS: readonly Shaft[] = [
  // The prairie blades, spaced a fog-length apart along the wander line.
  { u: 356, v: 26, top: 0, width: 7.5, opacity: 0.09 },
  { u: 452, v: -34, top: 1, width: 8.5, opacity: 0.1 },
  // The Gnomon's accent: the tallest stone gets the tallest light.
  { u: 419, v: 52, top: 2, width: 4.0, opacity: 0.11 },
  // The secret's thin warm beam at the Fallen King's foot. Fill round 1:
  // 0.13 → 0.16 (the plan's §4 nudge — it must survive its own pose).
  { u: 383.8, v: -102.2, top: -4, width: 1.7, opacity: 0.16 },
  // Fill round 1 (appended after every existing draw, so the earlier
  // shafts keep their stream): one blade at the Sisters' arch — their
  // pose had none — and one over the Wayline's middle stone.
  { u: 464, v: -47, top: 1, width: 6.5, opacity: 0.1 },
  { u: 495, v: 3, top: 1.5, width: 7.0, opacity: 0.1 },
];

export function buildBlue1Light(): {
  meshes: Mesh[];
  update(time: number, reducedMotion: boolean): void;
} {
  const random = new Random(SEED ^ 0x11fb);
  const meshes: Mesh[] = [];
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
      throw new Error("blue1 shaft blades could not be merged");
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
    mesh.name = "blue1-shaft";
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

  meshes.push(buildSecretPool());

  const clouds = buildCloudShadows();
  meshes.push(...clouds.meshes);

  return {
    meshes,
    update(time: number, reducedMotion: boolean): void {
      clouds.update(time, reducedMotion);
    },
  };
}

// ─── The moving cloud-dapple (MASTER R11, prototype-first) ──────────────────

/**
 * The steppe's signature light event: two large soft SHADOW fields
 * drifting across the prairie — multiplicative darkening (value ≈ −6%)
 * on two ground-draped quads whose blotch texture scrolls with the one
 * wind. Cloud shadows crossing grass is the strongest "prairie wind" cue
 * there is, and it costs two draws.
 *
 * Mechanics: the quads are draped over the terrain once at build (static
 * geometry — the motion is the texture offset, so nothing re-drapes per
 * frame); outside the prairie (the slope, the shelves, the drop, the rim)
 * the drape sinks below the ground so the sheet's edges are buried and
 * the shadow exists only where the steppe is. `fog: false` and
 * `toneMapped: false` keep the multiply neutral — a fogged multiply
 * source would tint the frame, not shade it.
 *
 * R11's stated fallback if this reads as a decal in captures: a 60 s
 * opacity swell on the three prairie shafts (light that breathes instead
 * of shadows that move). Judged from the round captures.
 */
function buildCloudShadows(): {
  meshes: Mesh[];
  update(time: number, reducedMotion: boolean): void;
} {
  const meshes: Mesh[] = [];
  const maps: DataTexture[] = [];
  const specs = [
    { seed: SEED ^ FILL_SEEDS.cloudShadow, size: 360, lift: 0.22, repeat: 1.6, speed: 0.006 },
    { seed: SEED ^ FILL_SEEDS.cloudShadow2, size: 300, lift: 0.42, repeat: 1.2, speed: 0.0085 },
  ] as const;

  for (const spec of specs) {
    const map = cloudTexture(spec.seed);
    maps.push(map);
    const geometry = new PlaneGeometry(spec.size, spec.size, 72, 72);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(CENTER_X, 0, CENTER_Z);
    drapeOverPrairie(geometry, spec.lift);
    geometry.computeBoundingSphere();
    const material = new MeshBasicMaterial({
      map,
      transparent: true,
      blending: MultiplyBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    map.repeat.set(spec.repeat, spec.repeat);
    const mesh = new Mesh(geometry, material);
    mesh.name = "blue1-cloud-shadow";
    mesh.renderOrder = 1;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
  }

  return {
    meshes,
    update(time: number, reducedMotion: boolean): void {
      const calm = reducedMotion ? 0.5 : 1;
      for (const [i, spec] of specs.entries()) {
        const drift = time * calm * spec.speed;
        maps[i]!.offset.set(drift * WIND_X, drift * WIND_Z);
      }
    },
  };
}

/** Drapes a shadow sheet on the steppe and buries it everywhere else. */
function drapeOverPrairie(geometry: PlaneGeometry, lift: number): void {
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const { u, v } = spokeOf(x, z);
    const floor = seabedHeight(x, z);
    const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
    const prairie =
      u > 302 && floor > -24 && dropWeight(u - 445, v) <= 0.02 && rc < 200;
    position.setY(i, prairie ? floor + lift : floor - 2.5);
  }
  position.needsUpdate = true;
}

/** Soft cloud blotches around a neutral 1 — the multiply's whole story. */
const cloudMaps = new Map<number, DataTexture>();
function cloudTexture(seed: number): DataTexture {
  let map = cloudMaps.get(seed);
  if (!map) {
    map = buildColorTexture(128, (u, v) => {
      // Tileable by fbm period; smoothstepped so most of the sheet is
      // exactly neutral and the shadows are islands, not a global dim.
      const blotch = smoothstep01(
        (fbm(u * 3, v * 3, { seed, period: 3, octaves: 3 }) - 0.56) / 0.2,
      );
      const value = 1 - blotch * 0.07;
      return [value, value, value * 1.01];
    });
    map.wrapS = RepeatWrapping;
    map.wrapT = RepeatWrapping;
    cloudMaps.set(seed, map);
  }
  return map;
}

/** The pool of light where the secret beam lands. */
function buildSecretPool(): Mesh {
  const { x, z } = worldOf(383.8, -102.2);
  const ring = new RingGeometry(0, 3.4, 24, 5);
  ring.rotateX(-Math.PI / 2);
  const position = ring.attributes.position!;
  const fade = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const lx = position.getX(i);
    const lz = position.getZ(i);
    position.setY(i, seabedHeight(x + lx, z + lz) + 0.07);
    const edge = 1 - smoothstep01((Math.hypot(lx, lz) / 3.4 - 0.3) / 0.7);
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
    color: 0xe2e8c8,
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const mesh = new Mesh(ring, material);
  mesh.name = "blue1-secret-pool";
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
    // Pale sun through blue water: whiter than the kelp sea's gold.
    return [value * 0.88, value * 0.97, value];
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
