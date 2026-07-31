import {
  AdditiveBlending,
  BufferAttribute,
  DoubleSide,
  Group,
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
import { buildBeamAndPool } from "../kit/BeamAndPool";
import { buildDappleSheet } from "../kit/DappleSheet";
import { buildParticulateField } from "../kit/ParticulateField";
import type { KitArea } from "../kit/KitTypes";
import { FILL_SEEDS } from "./GoldenFillShared";
import { smoothstep01 } from "./GoldenShared";
import {
  FLATS,
  GLASS,
  HOURGLASS,
  OASIS_A,
  OASIS_B,
  SADDLE_LIP_U,
  saddleChannelCenter,
  worldOf,
} from "./GoldenTerrain";

/**
 * The light of the Hourglass Sea. The desert's light is broad and even,
 * so what is *spent* is spent on the places the composition needs: one
 * great fall of light down the Hourglass's throat (the chasm advertises
 * itself as a column of lit water before its lip is even visible), two
 * green-gold glimmers over the oasis hollows, a pale shimmer over the
 * glass reach, and a thin reveal-beam at the saddle's lip.
 *
 * The canyon light-column discipline, all three parts: `fog: false` on
 * an additive mark, a ground fade baked into vertex colours against
 * `seabedHeight`, and an edge-on fade per frame.
 */

const SEED = SEEDS.regionGolden1;

interface Shaft {
  readonly u: number;
  readonly v: number;
  readonly top: number;
  readonly width: number;
  readonly opacity: number;
  readonly inSaddle?: boolean;
}

const SHAFTS: readonly Shaft[] = [
  // The Hourglass's throat: broad and tall, standing in the chasm.
  { u: HOURGLASS.u, v: HOURGLASS.v, top: 22, width: 13, opacity: 0.11 },
  { u: HOURGLASS.u - 8, v: HOURGLASS.v + 6, top: 16, width: 5, opacity: 0.07 },
  // The oasis glimmers.
  { u: OASIS_A.u, v: OASIS_A.v, top: 12, width: 3.2, opacity: 0.08 },
  { u: OASIS_B.u, v: OASIS_B.v, top: 10, width: 2.6, opacity: 0.07 },
  // A pale shimmer over the glass reach's heart.
  { u: GLASS.u, v: GLASS.v, top: 11, width: 3.4, opacity: 0.06 },
  // The lip's thin reveal-beam.
  { u: SADDLE_LIP_U + 6, v: 0, top: 10, width: 2.0, opacity: 0.09, inSaddle: true },
];

/** Warm painted light pooled on the ground where the light falls. */
const GLOWS: readonly { u: number; v: number; radius: number; opacity: number }[] = [
  { u: HOURGLASS.u, v: HOURGLASS.v, radius: 7, opacity: 0.1 },
  { u: OASIS_A.u, v: OASIS_A.v, radius: 5, opacity: 0.11 },
  { u: OASIS_B.u, v: OASIS_B.v, radius: 4, opacity: 0.1 },
];

export interface GoldenLightBuild {
  readonly meshes: Mesh[];
  readonly groups: Group[];
  update(timeSec: number): void;
}

export function buildGoldenLight(): GoldenLightBuild {
  const random = new Random(SEED ^ 0x11fb);
  const meshes: Mesh[] = [];
  const map = shaftSprite();

  for (const shaft of SHAFTS) {
    const at = worldOf(shaft.u, shaft.v + (shaft.inSaddle ? saddleChannelCenter(shaft.u) : 0));
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
      throw new Error("hourglass shaft blades could not be merged");
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
    mesh.name = "hourglass-shaft";
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

  meshes.push(buildLightPools());

  // ─── Phase 3 fill (plan §4) — the gold dapple, the road light events,
  // the Drain's Eye pool and the glass-glint breathing. All kit calls on
  // fresh substreams; every update below is closed-form off simulated
  // time (capture-safe, nothing for reduced motion to re-clock).
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  // The gold dapple — the desert had NO dapple, and it is the cheapest
  // "sunlit" signal in the project. Honey, over-mixed warm (the
  // sRGB-on-sand lesson: blue pulled far further than it looks).
  const saddleDapple: KitArea = (() => {
    const polyline: [number, number][] = [];
    for (let u = 62; u <= 262; u += 20) {
      const { x, z } = worldOf(u, saddleChannelCenter(u));
      polyline.push([x, z]);
    }
    return { polyline, width: 16 };
  })();
  const oasisAt = worldOf(528, -52);
  const flatsAt = worldOf(FLATS.u - 6, FLATS.v - 4);
  for (const [seed, area, opacity] of [
    [FILL_SEEDS.dappleSaddle, saddleDapple, 0.2],
    [FILL_SEEDS.dappleOasis, { center: [oasisAt.x, oasisAt.z], radius: 30 }, 0.22],
    [FILL_SEEDS.dappleFlats, { center: [flatsAt.x, flatsAt.z], radius: 42 }, 0.16],
  ] as const) {
    const dapple = buildDappleSheet({
      seed: SEED ^ seed,
      tint: 0xffca6e,
      ground: seabedHeight,
      area: area as KitArea,
      opacity,
      tileMetres: 8,
    });
    groups.push(dapple.group);
    updaters.push((timeSec) => dapple.update(timeSec));
  }

  // The road light events: one beam over drift-line 1 (the u ~130 beat)
  // and one over the Gilded Shore stacks — with the kit's own pools
  // under them, because a beam that brightens nothing is a decal.
  const driftAt = worldOf(131, saddleChannelCenter(131) - 1);
  const shoreAt = worldOf(596, 30);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ FILL_SEEDS.roadBeams,
      tint: 0xffd98c,
      ground: seabedHeight,
      beams: [
        {
          pos: [driftAt.x, driftAt.z],
          top: seabedHeight(driftAt.x, driftAt.z) + 9,
          width: 2.6,
          opacity: 0.12,
          slant: [0.08, 0.05],
        },
        {
          pos: [shoreAt.x, shoreAt.z],
          top: seabedHeight(shoreAt.x, shoreAt.z) + 11,
          width: 3.2,
          opacity: 0.1,
          slant: [0.06, -0.07],
        },
      ],
    }).group,
  );

  // Three faint secondary blades between the Hourglass falls, so the
  // ring advertises at more azimuths than the two the pilot lit.
  const hgCentre = worldOf(HOURGLASS.u, HOURGLASS.v);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ FILL_SEEDS.hourglassBlades,
      tint: 0xf6ecd0,
      ground: seabedHeight,
      beams: [0.55, 2.65, 4.35].map((phi) => {
        const x = hgCentre.x + Math.cos(phi) * 30;
        const z = hgCentre.z + Math.sin(phi) * 30;
        return {
          pos: [x, z] as const,
          top: 1.6,
          width: 3.4,
          opacity: 0.08,
        };
      }),
    }).group,
  );

  // The Drain's Eye pool: cool, so the great falling column lands on
  // something (the beam-that-brightens-nothing rule) — the one mark the
  // registered rest licences, beside the Keeper's circle.
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ FILL_SEEDS.drainPool,
      tint: 0xd8d4f0,
      ground: seabedHeight,
      beams: [],
      pools: [
        {
          pos: [hgCentre.x, hgCentre.z],
          radius: 6.5,
          opacity: 0.2,
        },
      ],
    }).group,
  );

  // The glass-glint breathing: the pilot's static sparks gain a slow
  // anchored shimmer over the whole fused field…
  const glassAt = worldOf(GLASS.u, GLASS.v);
  const breath = buildParticulateField({
    seed: SEED ^ FILL_SEEDS.glintBreath,
    tint: 0xeafff0,
    count: 110,
    mode: "swarm",
    volume: {
      center: [glassAt.x, seabedHeight(glassAt.x, glassAt.z) + 2.6, glassAt.z],
      size: [88, 7, 88],
    },
    size: 0.16,
    opacity: 0.5,
  });
  groups.push(breath.group);
  updaters.push((timeSec) => breath.update(timeSec));

  // …and one glint TEASE over the saddle's west wall at u ~205: a spark
  // where the Reach lies, the fork advertised before the lip (plan §2).
  const teaseAt = worldOf(205, saddleChannelCenter(205) - 15);
  const tease = buildParticulateField({
    seed: SEED ^ FILL_SEEDS.glintTease,
    tint: 0xeafff0,
    count: 8,
    mode: "swarm",
    volume: {
      center: [teaseAt.x, seabedHeight(teaseAt.x, teaseAt.z) + 1.4, teaseAt.z],
      size: [4, 2.4, 4],
    },
    size: 0.2,
    opacity: 0.55,
  });
  groups.push(tease.group);
  updaters.push((timeSec) => tease.update(timeSec));

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

/** All the ground light-pools merged into one additive mark. */
function buildLightPools(): Mesh {
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
      fade[i * 3 + 1] = edge * 0.88;
      fade[i * 3 + 2] = edge * 0.5;
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
    throw new Error("hourglass light pools could not be merged");
  }
  merged.computeBoundingSphere();

  const material = new MeshBasicMaterial({
    map: poolSprite(),
    color: 0xffe2a0,
    vertexColors: true,
    transparent: true,
    opacity: 0.24,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const mesh = new Mesh(merged, material);
  mesh.name = "hourglass-light-pools";
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
    colors[i * 3 + 1] = value * 0.94;
    colors[i * 3 + 2] = value * 0.72;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

let shaftSpriteTexture: DataTexture | undefined;
function shaftSprite(): DataTexture {
  shaftSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.5);
    const along = Math.pow(v, 1.15) * Math.min(1, (1 - v) * 5);
    const value = bell * along;
    return [value, value * 0.88, value * 0.6];
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
