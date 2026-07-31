import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
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
import { buildShoalRunner } from "../kit/ShoalRunner";
import { FILL_SEEDS } from "./GoldenFillShared";
import { smoothstep01 } from "./GoldenShared";
import { FLATS, RANK_WAVELENGTH, saddleChannelCenter, worldOf } from "./GoldenTerrain";

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
  readonly meshes: (Mesh | Points | InstancedMesh | Group)[];
  update(dt: number, time: number, reducedMotion: boolean, diver: Vector3): void;
}

export function buildGoldenLife(): GoldenLifeBuild {
  const meshes: GoldenLifeBuild["meshes"] = [];
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
  meshes.push(...rays.meshes);
  updaters.push(rays.update);

  // The traveller shoal (Phase 3 fill, connective §5's region leg): a
  // gold fusilier ribbon commuting the doorway ↔ saddle ↔ first crescent
  // — life as wayfinding on the region's own road. Kit `shoalRunner`,
  // closed-form off simulated time, fresh substream.
  const traveller = buildShoalRunner({
    seed: SEED ^ FILL_SEEDS.travellerShoal,
    route: { stations: travellerStations(), closed: true },
    count: 46,
    fish: { scale: 0.82, color: 0xf2da9a, emissive: 0x9a7a30, profile: "fusilier" },
    // One commute every ~5 minutes: stately, and seeded apart from every
    // other province's route by construction (the seed is the timetable).
    phaseSpeed: 1 / 300,
    braid: { lateral: 0.5, vertical: 0.28 },
    glint: { count: 24, size: 0.12 },
  });
  meshes.push(traveller.group);
  updaters.push((_dt, time, calm) => traveller.update(time * calm));

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

/**
 * The traveller's road: out along the channel's east shoulder, around the
 * first crescent past the lip, and home along the west — the loop leaves
 * the doorway at u 52 (the Sandfall Dunes handshake: the wing's own leg
 * is the connective worker's, and the two agree at the door).
 */
function travellerStations(): (readonly [number, number, number])[] {
  const stations: (readonly [number, number, number])[] = [];
  const spine = [52, 84, 116, 148, 180, 212, 244, 266, 284] as const;
  const seat = (u: number, dv: number, lift: number): void => {
    const { x, z } = worldOf(u, saddleChannelCenter(u) + dv);
    stations.push([x, seabedHeight(x, z) + lift, z] as const);
  };
  for (const u of spine) {
    seat(u, 2.4, 2.6);
  }
  // The turn: out over the lip to the first crescent's smoking shoulder.
  seat(300, 6, 3.4);
  const crest = worldOf(314, 10);
  stations.push([crest.x, seabedHeight(crest.x, crest.z) + 3.8, crest.z] as const);
  seat(298, -4, 3.2);
  for (let i = spine.length - 1; i >= 0; i--) {
    seat(spine[i]!, -2.4, 3.2);
  }
  return stations;
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

  // Phase 3 fill (plan §5): one veil routed down the saddle, so the road
  // has weather. Appended from a FRESH substream after every pilot draw
  // — the nine original seats above are byte-identical forever.
  {
    const extra = new Random(SEED ^ FILL_SEEDS.saddleVeil);
    const u = extra.range(120, 190);
    const v = saddleChannelCenter(u) + extra.signed(3);
    const { x, z } = worldOf(u, v);
    seats.push({
      u,
      v,
      y: seabedHeight(x, z) + extra.range(2.2, 4),
      yaw: extra.range(0, Math.PI),
      phase: extra.range(0, Math.PI * 2),
      drift: extra.range(1.2, 2.2),
    });
  }

  const geometry = new PlaneGeometry(14, 4, 1, 1);
  const material = new MeshBasicMaterial({
    alphaMap: veilSprite(),
    color: 0xf0e0b4,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new InstancedMesh(geometry, material, seats.length);
  mesh.name = "hourglass-sand-veils";
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

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

  // Round 4: at 0.5 the shoal spread over half its loop and read as
  // scattered dots; at 0.28 the ribbon was a 25 m dash a chest-height
  // pose never met. Round 5: 0.36 of the loop at a faster surf, judged
  // from a 7 m overlook that frames most of the circuit.
  const bodySpan = 0.36;
  const dummy = new Object3D();
  const at = new Vector3();
  const ahead = new Vector3();
  const side = new Vector3();
  const up = new Vector3(0, 1, 0);

  const update = (_dt: number, time: number, calm: number): void => {
    const head = (time * calm * 0.02) % 1;
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
  // Thickened ~70% in round 5: 5 cm at the poses' 22 m was two pixels
  // of whisker — a delight nobody could see.
  const geometry = new CylinderGeometry(0.048, 0.085, 1, 5, 6, true);
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

/** The pilot colonies, in spoke coordinates (the flats' core four). */
const EEL_COLONIES: readonly { u: number; v: number; radius: number; count: number }[] = [
  { u: 516, v: 84, radius: 9, count: 44 },
  { u: 538, v: 102, radius: 8, count: 38 },
  { u: 500, v: 108, radius: 7, count: 32 },
  { u: FLATS.u + 26, v: FLATS.v - 22, radius: 8, count: 34 },
] as const;

/**
 * Phase 3 fill (plan §5): colonies 4 → 7 — an oasis fringe, a shore
 * outpost, and the SADDLE outpost the journey map schedules at u ~175 (a
 * taste of the flats on the road itself, twenty eels). Placed from a
 * FRESH substream appended after every pilot draw — the fence.
 */
const NEW_EEL_COLONIES: readonly { u: number; v: number; radius: number; count: number }[] = [
  { u: 528, v: -48, radius: 6, count: 30 },
  { u: 582, v: 36, radius: 7, count: 30 },
  { u: 176, v: saddleChannelCenter(176) + 5.5, radius: 4.5, count: 20 },
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
    /** Which colony the eel rose from — the colony-wide sway wave. */
    readonly colony: number;
    /** Retraction eases per eel, so a colony ripples down, not snaps. */
    shy: number;
  }
  const eels: Eel[] = [];
  const plantColony = (
    colony: { u: number; v: number; radius: number; count: number },
    index: number,
    stream: Random,
  ): void => {
    for (let i = 0; i < colony.count; i++) {
      const angle = stream.range(0, Math.PI * 2);
      const spread = Math.sqrt(stream.next()) * colony.radius;
      const { x, z } = worldOf(
        colony.u + Math.cos(angle) * spread,
        colony.v + Math.sin(angle) * spread,
      );
      eels.push({
        x,
        y: seabedHeight(x, z) - 0.02,
        z,
        yaw: stream.range(0, Math.PI * 2),
        height: stream.range(0.85, 1.35),
        phase: stream.range(0, Math.PI * 2),
        colony: index,
        shy: 1,
      });
    }
  };
  for (const [index, colony] of EEL_COLONIES.entries()) {
    plantColony(colony, index, random);
  }
  const fillStream = new Random(SEED ^ FILL_SEEDS.eelColonies);
  for (const [index, colony] of NEW_EEL_COLONIES.entries()) {
    plantColony(colony, EEL_COLONIES.length + index, fillStream);
  }

  const material = createToonMaterial({
    vertexColors: true,
    side: DoubleSide,
    emissive: 0xcfb078,
    emissiveIntensity: 0.85,
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
      // The colony-wide wave (plan §5): a slow shared phase per colony
      // riding under each eel's own sway, so a distant field visibly
      // ripples — "the flats sing". Derived, not drawn: no randomness.
      const colonyWave = Math.sin(time * calm * 0.42 + eel.colony * 2.3) * 0.045;
      const sway = Math.sin(time * calm * 1.3 + eel.phase) * 0.06 + colonyWave;
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
  // "Great GOLDEN rays": round 3's backs read rust-dark against the
  // warm sky — lifted toward gold, the wing edges brightest.
  const back = new Color(0xb3946a);
  const edge = new Color(0xf2dc9c);
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
  meshes: InstancedMesh[];
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x4a71);

  // The line: one wobbled circuit of the Singing Flats' heart, around
  // the (545, 74) monolith and past the eel colonies. Round 2's grand
  // tour was never in any frame; round 3's flats-wide loop put the file
  // wherever the pose was not (the settle is wall-clock offset, so a
  // 250 s circuit cannot be aimed at). Round 5 shrinks the circuit to
  // r ≈ 25 so the crossing pose frames the WHOLE loop — a caravan that
  // cannot leave the frame needs no phase luck.
  const station = (u: number, v: number, lift: number): Vector3 => {
    const { x, z } = worldOf(u, v);
    return new Vector3(x, seabedHeight(x, z) + lift, z);
  };
  const points: Vector3[] = [
    station(FLATS.u + 26, FLATS.v + 2, 5.5),
    station(FLATS.u + 18, FLATS.v + 20, 6.5),
    station(FLATS.u + 1, FLATS.v + 25, 5.5),
    station(FLATS.u - 16, FLATS.v + 18, 6),
    station(FLATS.u - 23, FLATS.v + 1, 7),
    station(FLATS.u - 16, FLATS.v - 16, 6),
    station(FLATS.u + 2, FLATS.v - 22, 5.5),
    station(FLATS.u + 20, FLATS.v - 15, 6.5),
  ];
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const count = 7;
  const sway = { value: 0 };
  const material = createToonMaterial({
    vertexColors: true,
    side: DoubleSide,
    // Lifted in round 5 for the camouflage (round 4's find), then
    // pulled back within the round: at 0.85 a near ray rendered as a
    // flat neon-orange kite. 0.65 keeps the file warm against the sky.
    emissive: 0x9a7c3a,
    emissiveIntensity: 0.65,
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
    // Round 4: 3.2–4.2 made ~15 m wingspans that swallowed whole
    // frames; round 5 trimmed twice — even 2.0–2.5 filled half the sky
    // when the near arc met the settle. ~7 m is still a great animal.
    scales.push(random.range(1.7, 2.1));
    tint.setScalar(random.range(0.9, 1.08));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  // ── The pilot-fish satellites (Phase 3 fill, doctrine T5 satellites):
  // small bright gold fish riding each ray's slipstream — the caravan
  // stops being seven lone deltas and becomes a procession with
  // outriders. One instanced draw, a FRESH substream (the fence), and
  // an update that reuses the caravan's own path arithmetic.
  const pilotRandom = new Random(SEED ^ FILL_SEEDS.pilotFish);
  const pilotCount = 42;
  const pilotGeometry = createFishGeometry({
    width: 0.9,
    height: 0.95,
    length: 0.9,
    tailTaper: 0.52,
    dorsal: 0.45,
    pectoral: 0.8,
    tail: { reach: 1.4, lobe: 0.6, notch: 1.0 },
  });
  const pilotMaterial = createToonMaterial({
    vertexColors: true,
    emissive: 0x9a7a30,
    emissiveIntensity: 0.6,
  });
  const pilots = new InstancedMesh(pilotGeometry, pilotMaterial, pilotCount);
  pilots.name = "hourglass-pilot-fish";
  pilots.castShadow = false;
  pilots.receiveShadow = false;
  pilots.frustumCulled = false;
  pilots.instanceMatrix.setUsage(DynamicDrawUsage);

  const pilotGold = new Color(0xf6dc9c);
  const pilotTint = new Color();
  const pilotSeats: {
    ray: number;
    behind: number;
    side: number;
    lift: number;
    phase: number;
    scale: number;
  }[] = [];
  for (let i = 0; i < pilotCount; i++) {
    pilotSeats.push({
      ray: i % count,
      behind: pilotRandom.range(0.004, 0.022),
      side: pilotRandom.signed(1.6),
      lift: pilotRandom.range(-0.5, 1.0),
      phase: pilotRandom.range(0, Math.PI * 2),
      scale: pilotRandom.range(0.34, 0.5),
    });
    pilotTint.copy(pilotGold).multiplyScalar(pilotRandom.range(0.86, 1.1));
    pilots.setColorAt(i, pilotTint);
  }
  if (pilots.instanceColor) {
    pilots.instanceColor.needsUpdate = true;
  }

  // Single file: on the shrunk ~155 m circuit the procession spreads
  // wider (0.45) so seven rays ride nose-to-tail with daylight between.
  const fileSpan = 0.45;
  const dummy = new Object3D();
  const at = new Vector3();
  const ahead = new Vector3();
  const side = new Vector3();
  const up = new Vector3(0, 1, 0);

  const update = (_dt: number, time: number, calm: number): void => {
    sway.value = time * calm;
    // Stately ~0.85 m/s around the ~155 m circuit.
    const head = (0.05 + time * calm * 0.0055) % 1;
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

    for (const [i, seat] of pilotSeats.entries()) {
      const s =
        (((head - (seat.ray / count) * fileSpan - seat.behind) % 1) + 1) % 1;
      path.getPointAt(s, at);
      path.getPointAt((s + 0.006) % 1, ahead);
      side.subVectors(ahead, at).cross(up).normalize();
      const dart = Math.sin(time * calm * 1.1 + seat.phase) * 0.3;
      at.addScaledVector(side, seat.side + dart);
      at.y +=
        seat.lift +
        Math.sin(time * calm * 0.4 + seat.ray * 1.7) * 0.5 +
        Math.sin(time * calm * 0.9 + seat.phase * 1.3) * 0.18;
      dummy.position.copy(at);
      dummy.rotation.set(0, Math.atan2(ahead.x - at.x, ahead.z - at.z), 0);
      dummy.rotateZ(-Math.cos(time * calm * 1.1 + seat.phase) * 0.2);
      dummy.scale.setScalar(seat.scale);
      dummy.updateMatrix();
      pilots.setMatrixAt(i, dummy.matrix);
    }
    pilots.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1);
  return { meshes: [mesh, pilots], update };
}
