import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  MeshBasicMaterial,
  Mesh,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Vector3,
  type DataTexture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { createFishGeometry } from "../../../creatures/fish/FishGeometry";
import { buildColorTexture, buildScalarTexture, fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { smoothstep01 } from "./GoldenShared";
import { FLATS, HOURGLASS, RANK_WAVELENGTH, worldOf } from "./GoldenTerrain";

/**
 * The Hourglass Sea's ambient life:
 *
 * - **Heat-shimmer motes**: five hundred pale-gold points (one additive
 *   draw) drifting up off the sun-warmed sand — the desert's own air.
 * - **The sand veils**: a handful of great translucent cream sheets
 *   drifting slowly over the dune crests — weather, not particles.
 * - **The slip-face shoal**: this region's shoal behaviour. A ribbon of
 *   bright gold fish that surfs one dune's slip-face — pouring down the
 *   steep lee like the sand itself, running the trough, climbing the
 *   long windward side, forever.
 * - **The garden eels**: colonies on the Singing Flats — slender
 *   question-marks rising from the ripple plain, swaying, and *drawing
 *   back into the sand as the diver nears* — a delight the game lacks;
 *   distance is read live from the life context, no randomness spent.
 * - **The ray caravan**: the moving centrepiece. Five great golden rays
 *   crossing the flats in single file, wing-tips rolling, on one long
 *   closed line past the monoliths and around the Hourglass's lip — the
 *   fog reveals them one at a time, and following them is the tour.
 *
 * Everything draws from `SEED ^` substreams at build; the update phase
 * spends no randomness, so a capture's settle is deterministic.
 */

const SEED = SEEDS.regionGolden1;

export interface GoldenLifeBuild {
  readonly meshes: (Mesh | Points | InstancedMesh)[];
  update(dt: number, time: number, reducedMotion: boolean, diver: Vector3): void;
}

export function buildGoldenLife(): GoldenLifeBuild {
  const meshes: (Mesh | Points | InstancedMesh)[] = [];
  const updaters: ((dt: number, time: number, calm: number, diver: Vector3) => void)[] = [];

  const motes = buildShimmerMotes();
  meshes.push(motes.points);
  updaters.push(motes.update);

  const veils = buildSandVeils();
  meshes.push(veils.mesh);
  updaters.push(veils.update);

  const shoal = buildSlipFaceShoal();
  meshes.push(shoal.mesh);
  updaters.push(shoal.update);

  const eels = buildGardenEels();
  meshes.push(eels.mesh);
  updaters.push(eels.update);

  const rays = buildRayCaravan();
  meshes.push(rays.mesh);
  updaters.push(rays.update);

  return {
    meshes,
    update(dt: number, time: number, reducedMotion: boolean, diver: Vector3): void {
      const calm = reducedMotion ? 0.45 : 1;
      for (const update of updaters) {
        update(dt, time, calm, diver);
      }
    },
  };
}

// ─── The heat-shimmer ────────────────────────────────────────────────────────

let shimmerSprite: DataTexture | undefined;
function shimmerTexture(): DataTexture {
  shimmerSprite ??= buildColorTexture(32, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const halo = Math.pow(Math.max(0, 1 - d * d), 2.2);
    return [halo, halo * 0.9, halo * 0.6];
  });
  return shimmerSprite;
}

function buildShimmerMotes(): {
  points: Points;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0xe41e);
  const count = 500;
  const base = new Float32Array(count * 3);
  const live = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const spans = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Thicker over the flats and the glass reach, thinner down the saddle.
    const overWarmth = random.next() < 0.6;
    const u = overWarmth ? 430 + random.signed(150) : random.range(90, 580);
    const v = u < 292 ? random.signed(14) : random.signed(140);
    const { x, z } = worldOf(u, v);
    const floor = seabedHeight(x, z);
    base[i * 3] = x;
    base[i * 3 + 1] = floor + 0.3;
    base[i * 3 + 2] = z;
    phases[i] = random.range(0, 1);
    spans[i] = random.range(3, 9);
  }
  live.set(base);

  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(live, 3);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  geometry.computeBoundingSphere();

  const material = new PointsMaterial({
    size: 0.09,
    map: shimmerTexture(),
    transparent: true,
    opacity: 0.55,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new Points(geometry, material);
  points.name = "hourglass-shimmer-motes";
  points.frustumCulled = false;

  return {
    points,
    update(_dt: number, time: number, calm: number): void {
      const t = time * calm;
      for (let i = 0; i < count; i++) {
        const p = phases[i]!;
        // Heat shimmer: a slow climb with a strong sideways waver.
        const cycle = (p + t * 0.025) % 1;
        live[i * 3] = base[i * 3]! + Math.sin(t * 0.7 + p * 37) * 0.5;
        live[i * 3 + 1] = base[i * 3 + 1]! + cycle * spans[i]!;
        live[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(t * 0.55 + p * 53) * 0.5;
      }
      attribute.needsUpdate = true;
    },
  };
}

// ─── The sand veils ──────────────────────────────────────────────────────────

function buildSandVeils(): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x0e11);
  const count = 9;

  const geometry = new PlaneGeometry(14, 4, 1, 1);
  const material = new MeshBasicMaterial({
    alphaMap: veilSprite(),
    color: 0xf0e0b4,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "hourglass-sand-veils";
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const seats: { u: number; v: number; y: number; yaw: number; phase: number; drift: number }[] =
    [];
  for (let i = 0; i < count; i++) {
    const u = random.range(300, 560);
    const v = random.signed(130);
    const { x, z } = worldOf(u, v);
    seats.push({
      u,
      v,
      y: seabedHeight(x, z) + random.range(2.5, 6),
      yaw: random.range(0, Math.PI),
      phase: random.range(0, Math.PI * 2),
      drift: random.range(1.6, 3.2),
    });
  }

  const dummy = new Object3D();
  const update = (_dt: number, time: number, calm: number): void => {
    const t = time * calm;
    for (const [i, seat] of seats.entries()) {
      const { x, z } = worldOf(
        seat.u + Math.sin(t * 0.05 + seat.phase) * seat.drift * 3,
        seat.v + Math.cos(t * 0.04 + seat.phase * 1.3) * seat.drift,
      );
      dummy.position.set(x, seat.y + Math.sin(t * 0.09 + seat.phase) * 0.6, z);
      dummy.rotation.set(0, seat.yaw + Math.sin(t * 0.03 + seat.phase) * 0.3, 0);
      const breathe = 1 + Math.sin(t * 0.12 + seat.phase * 2.1) * 0.18;
      dummy.scale.set(breathe, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1);
  return { mesh, update };
}

let veilSpriteTexture: DataTexture | undefined;
function veilSprite(): DataTexture {
  veilSpriteTexture ??= buildScalarTexture(64, (u, v) => {
    const bellU = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.6);
    const bellV = Math.pow(Math.max(0, Math.cos((v - 0.5) * Math.PI)), 1.2);
    const wisp = 0.6 + 0.6 * fbm(u * 3, v * 2, { seed: 0x0e12, period: 4, octaves: 2 });
    return Math.min(1, bellU * bellV * wisp);
  });
  return veilSpriteTexture;
}

// ─── The slip-face shoal ─────────────────────────────────────────────────────

function buildSlipFaceShoal(): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x50a3);

  // The dune the shoal owns: scan for the crest of the rank near the
  // dune-ocean poses, then draw a closed loop that pours down the
  // slip-face, runs the trough, and climbs the windward side.
  const laneV = 14;
  let crestU = 340;
  let crestY = -Infinity;
  for (let u = 330; u <= 330 + RANK_WAVELENGTH; u += 0.5) {
    const { x, z } = worldOf(u, laneV);
    const y = seabedHeight(x, z);
    if (y > crestY) {
      crestY = y;
      crestU = u;
    }
  }

  const station = (u: number, v: number, lift: number): Vector3 => {
    const { x, z } = worldOf(u, v);
    return new Vector3(x, seabedHeight(x, z) + lift, z);
  };
  const points: Vector3[] = [
    station(crestU - 4, laneV - 8, 3.4),
    station(crestU + 1, laneV, 2.2), // over the crest
    station(crestU + 7, laneV + 6, 1.2), // pouring down the slip-face
    station(crestU + 13, laneV + 10, 1.4), // the trough run
    station(crestU + 18, laneV - 2, 2.2),
    station(crestU + 10, laneV - 14, 3.2), // swinging wide
    station(crestU - 8, laneV - 18, 3.6), // climbing the windward side
    station(crestU - 12, laneV - 4, 3.8),
  ];
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const count = 66;
  const geometry = createFishGeometry({
    width: 0.9,
    height: 1.0,
    length: 0.95,
    tailTaper: 0.52,
    dorsal: 0.5,
    pectoral: 0.85,
    tail: { reach: 1.4, lobe: 0.6, notch: 1.0 },
  });
  // Bright gold, held ABOVE the water's value (the pilot's round-8
  // lesson): a dim fish on a saturated warm field reads as its
  // complement, so the ribbon is bright on purpose.
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x9a7a30,
    emissiveIntensity: 0.7,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "hourglass-slipface-shoal";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const gold = new Color(0xf6e2ae);
  const tint = new Color();
  const offsets: { lateral: number; phase: number; scale: number }[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push({
      // Tightened in round 2: at ±0.6 the ribbon read as scattered dots.
      lateral: random.signed(0.35),
      phase: random.range(0, Math.PI * 2),
      scale: random.range(0.8, 1.2),
    });
    tint.copy(gold).multiplyScalar(random.range(0.85, 1.05));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const bodySpan = 0.5;
  const dummy = new Object3D();
  const at = new Vector3();
  const ahead = new Vector3();
  const side = new Vector3();
  const up = new Vector3(0, 1, 0);

  const update = (_dt: number, time: number, calm: number): void => {
    const head = (time * calm * 0.014) % 1;
    for (const [i, o] of offsets.entries()) {
      const s = (((head - (i / count) * bodySpan) % 1) + 1) % 1;
      path.getPointAt(s, at);
      path.getPointAt((s + 0.004) % 1, ahead);
      side.subVectors(ahead, at).cross(up).normalize();
      const swing = Math.sin(time * calm * 1.6 + i * 0.35 + o.phase * 0.2) * 0.18;
      at.addScaledVector(side, o.lateral + swing);
      at.y += Math.sin(time * calm * 1.2 + i * 0.24) * 0.2;
      dummy.position.copy(at);
      const pitch = Math.atan2(ahead.y - at.y, Math.hypot(ahead.x - at.x, ahead.z - at.z));
      dummy.rotation.set(0, Math.atan2(ahead.x - at.x, ahead.z - at.z), 0);
      dummy.rotateX(-pitch * 0.8);
      dummy.scale.setScalar(o.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1);
  return { mesh, update };
}

// ─── The garden eels ─────────────────────────────────────────────────────────

/** A slender question-mark of an eel, risen height 1 before scaling. */
function eelGeometry(): BufferGeometry {
  const geometry = new CylinderGeometry(0.028, 0.05, 1, 5, 6, true);
  geometry.translate(0, 0.5, 0);
  const position = geometry.attributes.position!;
  // Bow the top third forward — the grazing curve garden eels hold.
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const bow = smoothstep01((y - 0.62) / 0.38);
    position.setX(i, position.getX(i) + bow * bow * 0.12);
    position.setY(i, y - bow * bow * 0.04);
  }
  position.needsUpdate = true;

  const colors = new Float32Array(position.count * 3);
  // Held above the sand's value: round 1's eels read as black cutouts
  // under the quarter-strength sun.
  const body = new Color(0xf6e6ba);
  const band = new Color(0xb59c78);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const banded = Math.max(0, Math.sin(y * 22)) ** 6;
    shade.copy(body).lerp(band, banded * 0.6);
    // The head a shade darker: the eye-end of the question mark.
    shade.multiplyScalar(1 - smoothstep01((y - 0.86) / 0.14) * 0.25);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  smoothNormals(geometry);
  return geometry;
}

/** The colonies, in spoke coordinates. */
const EEL_COLONIES: readonly { u: number; v: number; radius: number; count: number }[] = [
  { u: 516, v: 84, radius: 9, count: 44 },
  { u: 538, v: 102, radius: 8, count: 38 },
  { u: 500, v: 108, radius: 7, count: 32 },
  { u: FLATS.u + 26, v: FLATS.v - 22, radius: 8, count: 34 },
] as const;

function buildGardenEels(): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number, diver: Vector3) => void;
} {
  const random = new Random(SEED ^ 0xee15);

  interface Eel {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly yaw: number;
    readonly height: number;
    readonly phase: number;
    /** Retraction eases per eel, so a colony ripples down, not snaps. */
    shy: number;
  }
  const eels: Eel[] = [];
  for (const colony of EEL_COLONIES) {
    for (let i = 0; i < colony.count; i++) {
      const angle = random.range(0, Math.PI * 2);
      const spread = Math.sqrt(random.next()) * colony.radius;
      const { x, z } = worldOf(
        colony.u + Math.cos(angle) * spread,
        colony.v + Math.sin(angle) * spread,
      );
      eels.push({
        x,
        y: seabedHeight(x, z) - 0.02,
        z,
        yaw: random.range(0, Math.PI * 2),
        height: random.range(0.7, 1.15),
        phase: random.range(0, Math.PI * 2),
        shy: 1,
      });
    }
  }

  const material = createToonMaterial({
    vertexColors: true,
    side: DoubleSide,
    emissive: 0x8a6a40,
    emissiveIntensity: 0.35,
  });
  const mesh = new InstancedMesh(eelGeometry(), material, eels.length);
  mesh.name = "hourglass-garden-eels";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const tint = new Color();
  for (let i = 0; i < eels.length; i++) {
    tint.setScalar(random.range(0.88, 1.1));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();

  const dummy = new Object3D();
  const update = (dt: number, time: number, calm: number, diver: Vector3): void => {
    for (const [i, eel] of eels.entries()) {
      const d = Math.hypot(diver.x - eel.x, diver.z - eel.z);
      // The delight: eels within eight metres draw back into the sand;
      // past eleven they rise again. Each eases at its own speed.
      const want = smoothstep01((d - 8) / 3);
      eel.shy += (want - eel.shy) * Math.min(1, dt * (want < eel.shy ? 5 : 1.2));
      const sway = Math.sin(time * calm * 1.3 + eel.phase) * 0.06;
      const graze = 1 + Math.sin(time * calm * 0.5 + eel.phase * 1.7) * 0.06;
      const rise = Math.max(0.01, eel.height * eel.shy * graze);
      dummy.position.set(eel.x, eel.y, eel.z);
      dummy.rotation.set(sway, eel.yaw, sway * 0.7);
      dummy.scale.set(1, rise, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1, new Vector3(0, 0, 0));
  return { mesh, update };
}

// ─── The ray caravan ─────────────────────────────────────────────────────────

/** One great ray: a low-poly delta with cambered wings and a long tail. */
function rayGeometry(): BufferGeometry {
  // Authored as a fan of triangles around the body line; x is wingspan,
  // z runs nose to tail. The wing-flap shader bends by |x|.
  const positions = new Float32Array([
    // Left wing (two panels).
    0, 0.16, 1.15, -1.05, 0.02, 0.25, 0, 0.1, -0.15,
    -1.05, 0.02, 0.25, -1.95, -0.1, -0.45, 0, 0.1, -0.15,
    0, 0.1, -0.15, -1.95, -0.1, -0.45, -0.85, 0.02, -0.8,
    0, 0.1, -0.15, -0.85, 0.02, -0.8, 0, 0.08, -1.0,
    // Right wing, mirrored winding.
    0, 0.16, 1.15, 0, 0.1, -0.15, 1.05, 0.02, 0.25,
    1.05, 0.02, 0.25, 0, 0.1, -0.15, 1.95, -0.1, -0.45,
    0, 0.1, -0.15, 0.85, 0.02, -0.8, 1.95, -0.1, -0.45,
    0, 0.1, -0.15, 0, 0.08, -1.0, 0.85, 0.02, -0.8,
    // The tail: a thin trailing blade.
    -0.06, 0.06, -0.95, 0.06, 0.06, -0.95, 0, 0.02, -2.6,
  ]);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));

  const colors = new Float32Array(positions.length);
  const back = new Color(0x9a7e5c);
  const edge = new Color(0xe6c887);
  const shade = new Color();
  for (let i = 0; i < positions.length / 3; i++) {
    const x = Math.abs(positions[i * 3]!);
    shade.copy(back).lerp(edge, smoothstep01((x - 0.6) / 1.4));
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildRayCaravan(): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x4a71);

  // The line: a long closed tour — up the flats past the monolith row,
  // around the Hourglass's lip, out over the dune ranks and home.
  const station = (u: number, v: number, lift: number): Vector3 => {
    const { x, z } = worldOf(u, v);
    return new Vector3(x, seabedHeight(x, z) + lift, z);
  };
  const points: Vector3[] = [
    station(560, 96, 4.5),
    station(532, 108, 5),
    station(505, 92, 4.5),
    station(486, 66, 5.5),
    station(HOURGLASS.u + 6, HOURGLASS.v + 54, 6), // skirting the chasm's lip
    station(HOURGLASS.u - 34, HOURGLASS.v + 22, 7),
    station(390, 26, 6),
    station(356, -6, 5),
    station(392, -34, 5.5),
    station(452, -20, 6),
    station(506, 10, 5),
    station(544, 48, 4.5),
  ];
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const count = 5;
  const sway = { value: 0 };
  const material = createToonMaterial({
    vertexColors: true,
    side: DoubleSide,
    emissive: 0x6a5426,
    emissiveIntensity: 0.5,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uSway = sway;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uSway;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         float wingPhase = instanceMatrix[3][0] * 0.11 + instanceMatrix[3][2] * 0.07;
         float span = abs(transformed.x);
         transformed.y += sin(uSway * 1.5 + wingPhase) * pow(span, 1.6) * 0.22;`,
      );
  };
  material.customProgramCacheKey = () => "hourglass-ray";

  const mesh = new InstancedMesh(rayGeometry(), material, count);
  mesh.name = "hourglass-ray-caravan";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const tint = new Color();
  const scales: number[] = [];
  for (let i = 0; i < count; i++) {
    scales.push(random.range(3.2, 4.2));
    tint.setScalar(random.range(0.9, 1.08));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  // Single file: the caravan occupies a short arc of the long loop.
  const fileSpan = 0.085;
  const dummy = new Object3D();
  const at = new Vector3();
  const ahead = new Vector3();

  const update = (_dt: number, time: number, calm: number): void => {
    sway.value = time * calm;
    // Slowed to a stately ~1 m/s in round 2 (the round-1 caravan crossed
    // its framed leg before any capture could settle); the head start
    // puts the file on that leg through the whole settle window.
    const head = (0.05 + time * calm * 0.002) % 1;
    for (let i = 0; i < count; i++) {
      const s = (((head - (i / count) * fileSpan) % 1) + 1) % 1;
      path.getPointAt(s, at);
      path.getPointAt((s + 0.006) % 1, ahead);
      dummy.position.copy(at);
      dummy.position.y += Math.sin(time * calm * 0.4 + i * 1.7) * 0.5;
      const yaw = Math.atan2(ahead.x - at.x, ahead.z - at.z);
      const pitch = Math.atan2(ahead.y - at.y, Math.hypot(ahead.x - at.x, ahead.z - at.z));
      dummy.rotation.set(0, yaw, 0);
      dummy.rotateX(-pitch * 0.7);
      // A slow bank into the turns.
      dummy.rotateZ(Math.sin(time * calm * 0.25 + i) * 0.08);
      dummy.scale.setScalar(scales[i]!);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1);
  return { mesh, update };
}
