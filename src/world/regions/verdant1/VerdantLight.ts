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
import { buildBeamAndPool, type BeamSpec, type PoolSpec } from "../kit/BeamAndPool";
import { smoothstep01 } from "./VerdantShared";
import { FILL_SEEDS, GREEN_GATE_1 } from "./VerdantFillShared";
import { SUNWELL, VALE_LIP_U, valeChannelCenter, worldOf } from "./VerdantTerrain";
import type { Group } from "three";

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
  // The Sunwell's fall of light: the region's brightest mark. Raised
  // 0.15 → 0.22 in the fill rework (plan §4 — the peak is the peak, and
  // at 0.15 the pilot's great shaft read faint even from the bowl).
  { u: SUNWELL.u, v: SUNWELL.v, top: 20, width: 9, opacity: 0.22 },
  { u: SUNWELL.u - 7, v: SUNWELL.v + 8, top: 17, width: 3.4, opacity: 0.09 },
  // The aisle's two blades, spaced a fog-length apart along the swim line.
  { u: 398, v: 40, top: 12, width: 2.6, opacity: 0.1 },
  { u: 442, v: 6, top: 14, width: 3.0, opacity: 0.11 },
  // The lip's thin reveal-beam, standing in the saddle's open light.
  { u: VALE_LIP_U + 6, v: 0, top: 11, width: 2.0, opacity: 0.1, inVale: true },
];

export function buildVerdantLight(): { meshes: (Mesh | Group)[] } {
  const random = new Random(SEED ^ 0x11f7);
  const meshes: (Mesh | Group)[] = [];
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

  // ─── The fill's light events (plan §4, via kit `beamAndPool`) ────────────
  // Ten new beams and six new dapple pools, all authored landings. The
  // narrows u 190–250 stays beam-free (MASTER §1.2 — the registry moved
  // the plan's third vale beam from u 230 up to u 186, logged in the
  // ledger); everything within 40 m of the Sunwell stays markless so the
  // peak is a peak. The kit carries the four-part fade discipline.
  const spokeBeam = (
    u: number,
    v: number,
    top: number,
    width: number,
    opacity: number,
    inVale = false,
    slant?: readonly [number, number],
  ): BeamSpec => {
    const at = worldOf(u, v + (inVale ? valeChannelCenter(u) : 0));
    return {
      pos: [at.x, at.z],
      top,
      width,
      opacity,
      ...(slant ? { slant } : {}),
    };
  };
  const spokePool = (u: number, v: number, radius: number, opacity: number, inVale = false): PoolSpec => {
    const at = worldOf(u, v + (inVale ? valeChannelCenter(u) : 0));
    return { pos: [at.x, at.z], radius, opacity };
  };

  meshes.push(
    buildBeamAndPool({
      seed: SEED ^ FILL_SEEDS.lightMain,
      tint: 0xdcecac,
      ground: seabedHeight,
      beams: [
        // The vale's wall-notch beams, alternating sides down the road.
        spokeBeam(110, 5, 5, 2.4, 0.14, true),
        spokeBeam(165, -5, 5.5, 2.6, 0.13, true),
        spokeBeam(186, 5, 6, 2.2, 0.13, true),
        // The meadows' one beam, by the erratic.
        spokeBeam(330, 18, 12, 2.8, 0.12),
        // The aisle's two new blades (with 398/442 that is one per ~40 m).
        spokeBeam(385, 33, 13, 2.6, 0.12),
        spokeBeam(456, 18, 14, 2.8, 0.12),
        // The Elder's god-ray pair, slanted through its crown gap so the
        // serpent's circling — and `canopy-up` — finally read lit.
        spokeBeam(426, -16, 21, 2.4, 0.13, false, [0.08, 0.05]),
        spokeBeam(434, -29, 19, 1.9, 0.11, false, [-0.06, 0.09]),
      ],
      pools: [
        spokePool(110, 5, 2.2, 0.18, true),
        spokePool(186, 5, 2.0, 0.18, true),
        spokePool(330, 18, 2.6, 0.18),
        spokePool(385, 33, 2.4, 0.17),
        spokePool(456, 18, 2.4, 0.17),
        // Under the standing 442 shaft, which never had a landing — a
        // beam that brightens nothing is a decal.
        spokePool(442, 6, 2.4, 0.16),
      ],
    }).group,
  );

  // The maze's one sun event: a dusk beam slanting through Green Gate 1's
  // arch. Everything else down there is the glow colonies' own light.
  const gate = worldOf(GREEN_GATE_1.u, GREEN_GATE_1.v);
  meshes.push(
    buildBeamAndPool({
      seed: SEED ^ FILL_SEEDS.lightMaze,
      tint: 0xd8c090,
      ground: seabedHeight,
      beams: [
        {
          pos: [gate.x, gate.z],
          top: seabedHeight(gate.x, gate.z) + 9,
          width: 2.6,
          opacity: 0.12,
          slant: [0.3, -0.2],
        },
      ],
      pools: [],
    }).group,
  );

  // The Falling Edge's pale wide beam between the leaning stacks; the
  // milky ground paint does the rest of that zone's light.
  const edge = worldOf(598, 16.5);
  meshes.push(
    buildBeamAndPool({
      seed: SEED ^ FILL_SEEDS.lightEdge,
      tint: 0xe8f0d8,
      ground: seabedHeight,
      beams: [
        {
          pos: [edge.x, edge.z],
          top: seabedHeight(edge.x, edge.z) + 11,
          width: 3.6,
          opacity: 0.1,
        },
      ],
      pools: [],
    }).group,
  );

  return { meshes };
}

/** The pool of light on the Sunwell's floor — grown 9 → 11 m in the fill
 *  rework: the light peak's landing, wide enough to read from the canopy. */
const SUNWELL_POOL_RADIUS = 11;

function buildSunwellPool(): Mesh {
  const { x, z } = worldOf(SUNWELL.u, SUNWELL.v);
  const ring = new RingGeometry(0, SUNWELL_POOL_RADIUS, 28, 6);
  ring.rotateX(-Math.PI / 2);
  const position = ring.attributes.position!;
  const fade = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const lx = position.getX(i);
    const lz = position.getZ(i);
    position.setY(i, seabedHeight(x + lx, z + lz) + 0.08);
    const edge = 1 - smoothstep01((Math.hypot(lx, lz) / SUNWELL_POOL_RADIUS - 0.35) / 0.65);
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
    opacity: 0.3,
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
