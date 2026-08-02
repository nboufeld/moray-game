import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FogExp2,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
  type DataTexture,
  type Scene,
} from "three";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { buildBeamAndPool } from "../../regions/kit/BeamAndPool";
import { buildCarpetField } from "../../regions/kit/CarpetField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { angleBetween, wedgeHalfAt } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";
import { mountGateVeil } from "./GateVeilMount";
import { TIERB_GROUP_NAME } from "./TierBUplift";
import {
  bubbleRingSprite,
  drawFloorSpot,
  lateralOf,
  smoothstep01,
  swayClock,
  wingFrame,
  type SwayClock,
} from "./W3FloraKit";

/**
 * Wing 8 — the Current Run (worker W3). The one place in the game built
 * for speed instead of drift: a long clean channel where the water itself
 * is going somewhere. Three marks say it and nothing else does:
 *
 * - **Grass banners all bent one way.** Every blade's bow is baked into
 *   its geometry (the meadow's integrated arc, bent harder — 1.3 rad at
 *   the tip) and every instance is yawed onto the wing's axis, so the
 *   whole stand lies over downstream like hair in wind. The sway shader
 *   reads each instance's world radius and *strengthens* the amplitude
 *   down-channel: the run gets wilder the further you ride it.
 * - **Streaming bubble lines.** Four thin threads of small rings tearing
 *   down the channel at 2.4–3.8 m/s — ten times the reef's vent bubbles —
 *   hugging a couple of metres over the floor as the floor drops away.
 *   Fast, thin, and all going the same way.
 * - **Sparse streamlined stones.** Smooth elongated ellipsoids aligned
 *   with the flow, the channel's own stones worn to the shape of the
 *   water that made them.
 *
 * The centre stays open — every banner and stone stands ≥ 1.9 m off the
 * axis — because the channel is the ride and the ride is the point.
 * `update` becalms banners and bubbles alike under reduced motion.
 *
 * Seeds: `SEEDS.wingCurrentRun` and `^` substreams only, all draws at build.
 */

/** How far off the axis the channel's dressing keeps, in metres. */
const CHANNEL_CLEAR = 1.9;

/* ------------------------------------------------------------------ *
 *  The banners
 * ------------------------------------------------------------------ */

const BANNER_WIDTH = 0.34;
const BANNER_HEIGHT = 1.7;
/** The baked downstream bow: the meadow's 1.0 rad, pushed to a streaming lean. */
const BANNER_TIP_BOW = 1.3;
const BANNER_TWIST = 0.5;
const BANNER_CUP = 0.35;

/** Half-width along the blade, the meadow's lanceolate profile. */
function lanceolate(t: number): number {
  const s = Math.min(1, Math.max(0, t));
  return Math.max(0.05, Math.sin(Math.PI * Math.pow(0.16 + s * 0.84, 0.72)) ** 0.8);
}

/**
 * One banner blade: the meadow's arc, cup and twist, bent harder and grown
 * taller — a ribbon that stands up at the root and streams at the tip.
 * Bows toward local +z; instances yaw that onto the wing's axis.
 */
function bannerGeometry(): PlaneGeometry {
  const segments = 5;
  const geometry = new PlaneGeometry(BANNER_WIDTH, BANNER_HEIGHT, 2, segments);
  const position = geometry.attributes.position as BufferAttribute;

  const rows = segments + 1;
  const arcY = new Float32Array(rows);
  const arcZ = new Float32Array(rows);
  const bendAt = new Float32Array(rows);
  const step = BANNER_HEIGHT / segments;
  let y = 0;
  let z = 0;
  for (let row = 0; row < rows; row++) {
    arcY[row] = y;
    arcZ[row] = z;
    bendAt[row] = BANNER_TIP_BOW * Math.pow(row / segments, 1.7);
    const angle = BANNER_TIP_BOW * Math.pow((row + 0.5) / segments, 1.7);
    y += Math.cos(angle) * step;
    z += Math.sin(angle) * step;
  }

  const half = BANNER_WIDTH / 2;
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) + BANNER_HEIGHT / 2) / BANNER_HEIGHT;
    const row = Math.round(t * segments);
    const column = position.getX(i) / half;
    const theta = bendAt[row] ?? 0;
    const twist = BANNER_TWIST * t;
    const normalY = -Math.sin(theta);
    const normalZ = Math.cos(theta);
    const across = column * half * lanceolate(t);
    const cup = (1 - Math.abs(column)) * half * lanceolate(t) * BANNER_CUP;
    const offNormal = across * Math.sin(twist) + cup;
    position.setXYZ(
      i,
      across * Math.cos(twist),
      (arcY[row] ?? 0) + offNormal * normalY,
      (arcZ[row] ?? 0) + offNormal * normalZ,
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Root-to-tip gradient with fibre, hue-neutral so the instance colour owns the green. */
let bannerMap: DataTexture | undefined;
function bannerTexture(): DataTexture {
  bannerMap ??= buildColorTexture(32, (u, v) => {
    const fibre = 0.9 + fbm(u * 4, v, { seed: SEEDS.wingCurrentRun ^ 0x1eaf, period: 12, octaves: 2 }) * 0.24;
    const across = 0.86 + Math.abs(u - 0.5) * 0.5;
    // Three readable bands up the blade: a deep root, a mid body, and a
    // tip that blooms late — the old linear ramp read as only two values.
    const shade = (0.36 + v * 0.55 + Math.pow(v, 3) * 0.36) * fibre * across;
    return [shade * 0.85, shade, shade * 0.78];
  });
  return bannerMap;
}

/** The channel's greens: running-water turquoise, brighter than the meadow's. */
const BANNER_PALETTE = [0x4fc2a0, 0x7fdcb4, 0x3aa98e] as const;

/* ------------------------------------------------------------------ *
 *  The bubble streams
 * ------------------------------------------------------------------ */

const STREAM_LATERALS = [-2.3, -0.6, 0.8, 2.3] as const;
const BUBBLES_PER_STREAM = 16;
const STREAM_FROM = 31.5;
const STREAM_TO = 48;
const STREAM_SPAN = STREAM_TO - STREAM_FROM;

interface StreamBubble {
  readonly lateral: number;
  readonly offset: number;
  readonly speed: number;
  readonly radius: number;
  readonly hover: number;
  readonly phase: number;
  readonly wobbleAmplitude: number;
  readonly wobbleRate: number;
}

/* ------------------------------------------------------------------ *
 *  The flora
 * ------------------------------------------------------------------ */

export function buildCurrentRunFlora(def: WingDef): WingFlora {
  const group = new Group();
  group.name = "w3-current-run";
  const frame = wingFrame(def);
  const contacts: ContactPatch[] = [];
  const clock: SwayClock = swayClock();

  /** The downstream yaw: local +z (the banners' bow) onto the wing's axis. */
  const downstreamYaw = Math.atan2(frame.axisX, frame.axisZ);

  /* ---------- The banners ---------- */

  const bannerStream = new Random(SEEDS[def.seedKey] ^ 0x0ba5);
  const bannerParts: { matrix: Matrix4; tint: Color }[] = [];
  const dummy = new Object3D();
  for (let clump = 0; clump < 12; clump++) {
    // A banner line strings down-channel: one clump radius, each blade its
    // own radius beside it and its own lateral inside the floor window, so
    // the whole stand leans together and the contracts hold blade by blade.
    const clumpR = bannerStream.range(35, 44.5);
    const blades = 10 + Math.floor(bannerStream.next() * 5);
    for (let blade = 0; blade < blades; blade++) {
      const r = Math.min(45.8, Math.max(34.2, clumpR + bannerStream.signed(1.2)));
      const spot = drawFloorSpot(bannerStream, def, frame, r, r, CHANNEL_CLEAR);
      const { x, z } = spot;
      dummy.position.set(x, seabedHeight(x, z) - 0.04, z);
      dummy.rotation.set(
        bannerStream.signed(0.08),
        downstreamYaw + bannerStream.signed(0.14),
        bannerStream.signed(0.08),
      );
      dummy.scale.set(
        bannerStream.range(0.85, 1.3),
        bannerStream.range(0.75, 1.35),
        1,
      );
      dummy.updateMatrix();
      const tint = new Color(
        BANNER_PALETTE[Math.floor(bannerStream.next() * BANNER_PALETTE.length)] ?? BANNER_PALETTE[0],
      ).multiplyScalar(bannerStream.range(0.8, 1.15));
      bannerParts.push({ matrix: dummy.matrix.clone(), tint });
    }
  }

  const bannerMaterial = createToonMaterial({
    color: 0xffffff,
    map: bannerTexture(),
    side: DoubleSide,
  });
  bannerMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uSway = clock.time;
    shader.uniforms.uWind = clock.strength;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uSway;
         uniform float uWind;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         // Wilder downstream: the amplitude grows with the run itself.
         float phase = instanceMatrix[3][0] * 0.5 + instanceMatrix[3][2] * 0.37;
         float downstream = smoothstep(31.0, 46.0, length(instanceMatrix[3].xz));
         float tip = clamp(transformed.y / ${BANNER_HEIGHT.toFixed(2)}, 0.0, 1.0);
         float amp = (0.10 + 0.22 * downstream) * uWind;
         float bend = sin(uSway * 2.1 + phase) * 0.6 + sin(uSway * 0.9 + phase * 1.6) * 0.4;
         transformed.z += bend * amp * tip * tip;
         transformed.x += sin(uSway * 1.3 + phase * 2.1) * amp * 0.3 * tip * tip;`,
      );
  };
  const banners = new InstancedMesh(bannerGeometry(), bannerMaterial, bannerParts.length);
  banners.name = "w3-current-banners";
  banners.userData.floorBound = "foot";
  banners.receiveShadow = true;
  banners.castShadow = false;
  bannerParts.forEach((part, index) => {
    banners.setMatrixAt(index, part.matrix);
    banners.setColorAt(index, part.tint);
  });
  banners.instanceMatrix.needsUpdate = true;
  if (banners.instanceColor) {
    banners.instanceColor.needsUpdate = true;
  }
  group.add(banners);

  /* ---------- The streamlined stones ---------- */

  const stoneStream = new Random(SEEDS[def.seedKey] ^ 0x057e);
  const stoneYaw = Math.atan2(-frame.axisZ, frame.axisX);
  const stoneParts: { matrix: Matrix4; tint: Color }[] = [];
  for (let i = 0; i < 14; i++) {
    const spot = drawFloorSpot(stoneStream, def, frame, 34.5, 45.5, CHANNEL_CLEAR + 0.1);
    const along = stoneStream.range(1.5, 2.3);
    const across = stoneStream.range(0.75, 1.05);
    const height = stoneStream.range(0.35, 0.5);
    const yaw = stoneYaw + stoneStream.signed(0.12);
    const y = seabedHeight(spot.x, spot.z) + 0.5 * height * 0.55;
    dummy.position.set(spot.x, y, spot.z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(along, height, across);
    dummy.updateMatrix();
    const tint = new Color(0xb8cfd2)
      .lerp(new Color(0x9fd8cf), stoneStream.next() * 0.5)
      .multiplyScalar(stoneStream.range(0.85, 1.08));
    stoneParts.push({ matrix: dummy.matrix.clone(), tint });
    contacts.push({ x: spot.x, z: spot.z, radius: 0.5 * along * 1.2, strength: 0.35 });
  }
  const stoneMaterial = createToonMaterial({ color: 0xffffff });
  const stones = new InstancedMesh(new SphereGeometry(0.5, 9, 6), stoneMaterial, stoneParts.length);
  stones.name = "w3-current-stones";
  stones.userData.floorBound = "rest";
  stones.receiveShadow = true;
  stones.castShadow = false;
  stoneParts.forEach((part, index) => {
    stones.setMatrixAt(index, part.matrix);
    stones.setColorAt(index, part.tint);
  });
  stones.instanceMatrix.needsUpdate = true;
  if (stones.instanceColor) {
    stones.instanceColor.needsUpdate = true;
  }
  group.add(stones);

  /* ---------- The bubble streams ---------- */

  const bubbleStream = new Random(SEEDS[def.seedKey] ^ 0x0b0b);
  const bubbles: StreamBubble[] = [];
  for (const lateral of STREAM_LATERALS) {
    for (let i = 0; i < BUBBLES_PER_STREAM; i++) {
      bubbles.push({
        lateral: lateral + bubbleStream.signed(0.2),
        offset: bubbleStream.range(0, STREAM_SPAN),
        speed: bubbleStream.range(2.4, 3.8),
        radius: bubbleStream.range(0.035, 0.075),
        hover: bubbleStream.range(1.9, 3.1),
        phase: bubbleStream.range(0, Math.PI * 2),
        wobbleAmplitude: bubbleStream.range(0.2, 0.35),
        wobbleRate: bubbleStream.range(0.7, 1.3),
      });
    }
  }
  const streamMaterial = new MeshBasicMaterial({
    map: bubbleRingSprite(),
    color: 0xf2fbff,
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const streams = new InstancedMesh(new PlaneGeometry(1, 1), streamMaterial, bubbles.length);
  streams.name = "w3-current-bubbles";
  streams.userData.floorBound = "no";
  // Every instance moves every frame; the matrices are the bounding volume.
  streams.frustumCulled = false;
  group.add(streams);

  const facing = new Quaternion();
  // Grab the camera once per render, the `trackSunView` compromise: nothing
  // owns an update call with a camera in it, and a one-frame-old facing on a
  // nine-centimetre ring is invisible.
  streams.onBeforeRender = (_renderer, _scene, camera) => {
    facing.copy(camera.quaternion);
  };

  const pose = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  let wobbleScale = 1;
  const poseBubbles = (): void => {
    const t = clock.time.value;
    for (const [index, bubble] of bubbles.entries()) {
      const travelled = (bubble.offset + t * bubble.speed) % STREAM_SPAN;
      const r = STREAM_FROM + travelled;
      const lateral =
        bubble.lateral + Math.sin(t * bubble.wobbleRate + bubble.phase) * bubble.wobbleAmplitude * wobbleScale;
      const x = frame.axisX * r + frame.perpX * lateral;
      const z = frame.axisZ * r + frame.perpZ * lateral;
      const y =
        seabedHeight(x, z) + bubble.hover + Math.sin(t * 0.9 + bubble.phase) * 0.15 * wobbleScale;

      const progress = travelled / STREAM_SPAN;
      const envelope =
        smoothstep01(progress / 0.06) * (1 - smoothstep01((progress - 0.92) / 0.08));
      const size = bubble.radius * 2 * envelope;
      position.set(x, y, z);
      scale.set(size, size, 1);
      pose.compose(position, facing, scale);
      streams.setMatrixAt(index, pose);
    }
    streams.instanceMatrix.needsUpdate = true;
  };
  poseBubbles();

  // ── Batch 4: the Tier B uplift (MASTER §4 closure, R2 ≤ +6 / ≤ 20k) ──
  // The T1 statement in the run's own voice: a combed turf of short
  // turquoise tufts, every one raked downstream with the banners — the
  // floor itself streaming the way the water is going. The channel law
  // (≥ 1.9 m off the axis) is kept with the tufts' own footprint on top.
  // Fresh `^` substream, kit-private Random, appended after every wave-8
  // draw.
  const uplift = new Group();
  uplift.name = TIERB_GROUP_NAME;
  const combedTurf = buildCarpetField({
    seed: (SEEDS.wingCurrentRun ^ 0xb406) >>> 0,
    palette: { base: 0x5da890, tip: 0x9adcc8, shade: 0x2f5f54 },
    area: { center: [frame.axisX * 40, frame.axisZ * 40], radius: 7.5 },
    gate: (x, z) => {
      const r = Math.hypot(x, z);
      if (r < 34.5 || r > 46.5) {
        return 0;
      }
      const away = angleBetween(Math.atan2(z, x), def.azimuth);
      if (away > wedgeHalfAt(def, r) - 0.02) {
        return 0;
      }
      return Math.abs(lateralOf(frame, x, z)) < CHANNEL_CLEAR + 0.3 ? 0 : 1;
    },
    ground: seabedHeight,
    count: 360,
    profile: "tuft",
    size: [0.2, 0.42],
    rake: { yaw: downstreamYaw, strength: 0.75 },
    swayAmp: 0.05,
  });
  uplift.add(combedTurf.group);

  // ── The critic's-wave re-pass: the far end's composed close ──────────
  // The critic's verdict on the interior stand: "a seagrass corridor
  // ending at a plain tan wall with one flat blue mound for a horizon".
  // The run's whole identity is water GOING somewhere, so the far end
  // now says where, in the wing's own register — three layers, back to
  // front: two rushing-teal recession planes past the shelf's end
  // (lightening with depth: the run continues into BRIGHT water, the
  // glass-cove trick, under the gate-veil discipline — drooped fbm
  // skylines, alpha-dissolved tops and sides, opacity ≤ 0.2, fog:false
  // with self-mixed inks), one pale water-light column standing in the
  // far notch (the light the run is racing toward), and a pair of tall
  // worn sentinel stones leaning downstream at the channel's mouth with
  // a trail of lower ones behind them. Everything keeps the channel law
  // (solids ≥ 2.1 m off the axis); the planes and the column are
  // intangible light PAST the run's end (r ≥ 46.9), exempted by name in
  // tests/wingsTierB.test.ts with the exemption's own radial fence.
  // Streams: fresh `^ 0xb40b` (stones) and `^ 0xb40c` (column) only.
  addRunClose(uplift, def, frame, downstreamYaw, contacts);
  group.add(uplift);

  // The doorway: a rushing-turquoise veil with a pale water-light column —
  // the ride promised from the bowl, the channel's centre left open.
  // Height 3.6 → 2.7 (the critic's-wave re-pass): the near plane's seeded
  // ridge peak crested the saddle from the bowl stand and read as a
  // translucent GHOST PYRAMID hovering in the doorway (the C4 family) —
  // at 2.7 every skyline stays inside the notch.
  const veil = mountGateVeil(def, {
    doorR: 32,
    width: 3.8,
    height: 2.7,
    sillLift: -1.0,
    palette: [0x2c4844, 0x40625c, 0x5c807a],
    column: { tint: 0xd8f0ea, opacity: 0.07 },
    particulate: { tint: 0xcfe8e2, count: 45 },
  });
  group.add(veil.group);

  let kitTime = 0;
  const update = (dt: number, reducedMotion: boolean): void => {
    // One clock governs both motions: under reduced motion it advances at
    // 0.3×, which becalms the banners' sway and the streams' tear alike —
    // the bubbles' travel is read out of the same time.
    clock.advance(dt, reducedMotion, 0.25);
    wobbleScale = reducedMotion ? 0.4 : 1;
    poseBubbles();
    kitTime += dt * (reducedMotion ? 0.3 : 1);
    combedTurf.update(kitTime);
    veil.update(dt, reducedMotion);
  };

  return { group, contacts, update };
}

/* ------------------------------------------------------------------ *
 *  The far end's composed close (the critic's-wave re-pass)
 * ------------------------------------------------------------------ */

/** The recession planes: [radial station, full width, band height].
 *  r3: bands 2.9/3.7 → 4.6/6.0 — from the low interior stand the end
 *  wall towers over the run, and a waist-high recession left most of it
 *  bare tan; the taller bands paint the teal "the water goes on" up the
 *  face, tops still alpha-dissolved so no edge ever shows. */
const CLOSE_PLANES = [
  [47.3, 11, 4.6],
  [49.2, 13, 6.0],
] as const;
/** Inks near → far, LIGHTENING with depth: the run ends in bright water. */
const CLOSE_INKS = [0x3f6f66, 0x6fa79c] as const;
const CLOSE_FOG_MIX = [0.3, 0.55] as const;
const CLOSE_OPACITY = 0.18;
/** Vertical value grade and dissolve, the gate-veil discipline. */
const CLOSE_GRADE_FOOT = 0.82;
const CLOSE_GRADE_TOP = 1.12;
const CLOSE_DISSOLVE_FROM = 0.58;
const CLOSE_FOOT = 2;

/**
 * The far-end close, mounted inside the Tier B uplift group so every
 * containment sweep reads it. Solids (the sentinel stones) obey the
 * channel law directly; the two recession planes and the light column
 * are named `w3-run-close-*` and stand past r 46.9 — the tierb suite's
 * channel case exempts exactly that name behind its own radial fence.
 */
function addRunClose(
  uplift: Group,
  def: WingDef,
  frame: ReturnType<typeof wingFrame>,
  downstreamYaw: number,
  contacts: ContactPatch[],
): void {
  // ── The recession planes ──
  const planeMaterials: { material: MeshBasicMaterial; ink: Color; mix: number }[] = [];
  let firstPlane: Mesh | null = null;
  for (const [index, [station, width, band]] of CLOSE_PLANES.entries()) {
    const centreX = frame.axisX * station;
    const centreZ = frame.axisZ * station;
    const groundY = seabedHeight(centreX, centreZ);
    const ridgeSeed = (SEEDS[def.seedKey] ^ (0xb40d + index * 0x9e37)) >>> 0;

    const columns = 24;
    const rows = 4;
    const positions = new Float32Array((columns + 1) * (rows + 1) * 3);
    const colors = new Float32Array((columns + 1) * (rows + 1) * 4);
    const indices: number[] = [];
    for (let c = 0; c <= columns; c++) {
      const u = c / columns;
      const ridge = fbm(u * 2, index * 0.41, { seed: ridgeSeed, period: 2, octaves: 2 });
      let top = band * (0.72 + 0.28 * ridge);
      // Drooped ends — no rectangular corner ever shows (the veil rule).
      top *= 1 - 0.4 * smoothstep01((Math.abs(u - 0.5) - 0.28) / 0.2);
      const across = (u - 0.5) * width;
      const x = centreX + frame.perpX * across;
      const z = centreZ + frame.perpZ * across;
      for (let r = 0; r <= rows; r++) {
        const rowFrac = r / rows;
        const y = groundY - CLOSE_FOOT + (top + CLOSE_FOOT) * rowFrac;
        const vertex = c * (rows + 1) + r;
        positions[vertex * 3] = x;
        positions[vertex * 3 + 1] = y;
        positions[vertex * 3 + 2] = z;
        const grade = CLOSE_GRADE_FOOT + (CLOSE_GRADE_TOP - CLOSE_GRADE_FOOT) * rowFrac;
        const topFade = 1 - smoothstep01((rowFrac - CLOSE_DISSOLVE_FROM) / (1 - CLOSE_DISSOLVE_FROM));
        const sideFade = 1 - smoothstep01((Math.abs(u - 0.5) - 0.34) / 0.16);
        colors[vertex * 4] = grade;
        colors[vertex * 4 + 1] = grade;
        colors[vertex * 4 + 2] = grade;
        colors[vertex * 4 + 3] = topFade * sideFade;
      }
    }
    for (let c = 0; c < columns; c++) {
      for (let r = 0; r < rows; r++) {
        const a = c * (rows + 1) + r;
        const b = (c + 1) * (rows + 1) + r;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    const ink = new Color(CLOSE_INKS[index]!);
    const mix = CLOSE_FOG_MIX[index]!;
    const material = new MeshBasicMaterial({
      color: ink.clone().lerp(new Color(0x53b2bb), mix),
      transparent: true,
      opacity: CLOSE_OPACITY,
      depthWrite: false,
      side: DoubleSide,
      forceSinglePass: true,
      vertexColors: true,
      fog: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = `w3-run-close-plane-${index}`;
    mesh.renderOrder = 1;
    uplift.add(mesh);
    planeMaterials.push({ material, ink, mix });
    firstPlane ??= mesh;
  }

  // The DistantReef self-mix: the inks follow every mood and weather.
  if (firstPlane) {
    let lastFog = -1;
    firstPlane.onBeforeRender = (_renderer, scene) => {
      const fog = (scene as Scene).fog;
      if (!(fog instanceof FogExp2)) {
        return;
      }
      const hex = fog.color.getHex();
      if (hex === lastFog) {
        return;
      }
      lastFog = hex;
      for (const plane of planeMaterials) {
        plane.material.color.copy(plane.ink).lerp(fog.color, plane.mix);
      }
    };
  }

  // ── The far light column ──
  const columnX = frame.axisX * 48.3;
  const columnZ = frame.axisZ * 48.3;
  const columnGround = seabedHeight(columnX, columnZ);
  const column = buildBeamAndPool({
    seed: (SEEDS[def.seedKey] ^ 0xb40c) >>> 0,
    tint: 0xdcf4ee,
    ground: () => columnGround,
    beams: [
      // Upright on purpose: a slanted head would walk the quad corners
      // past the r 50.5 containment fence the tierb suite sweeps.
      // r3: 2.6 @ 0.09 → 3.1 @ 0.12 — the light the run races toward
      // was a whisper against the recession; still far under the 0.3 cap.
      {
        pos: [columnX, columnZ],
        top: columnGround + 7.2,
        width: 3.1,
        opacity: 0.12,
      },
    ],
    pools: [],
  });
  // The name prefix is the tierb channel-law exemption's handle — rename
  // every drawable, not just the group, so the sweep's `from` carries it.
  column.group.traverse((node) => {
    node.name = `w3-run-close-${node.name || "column"}`;
  });
  uplift.add(column.group);

  // ── The sentinel stones ──
  const stream = new Random((SEEDS[def.seedKey] ^ 0xb40b) >>> 0);
  const dummy = new Object3D();
  const tint = new Color();
  const spots: { matrix: Matrix4; value: number }[] = [];
  /** [r, lateral, along, height, across, lean] — solids ≥ 2.1 m off axis.
   *  r2: the first cut's squat eggs read as MUSHROOM CAPS — the pair is
   *  slimmer and taller now (standing stones, not dishes), and the trail
   *  stones sit low and close so nothing perches on the far wall's crest
   *  silhouetting as a floating cap. */
  const stones = [
    [46.9, -2.7, 0.95, 3.7, 0.8, 0.24],
    [47.1, 2.8, 0.9, 3.2, 0.75, 0.28],
    // r3: the trail pulled in under r 47.6 and flattened — at 47.7+ the
    // pads rode the rising end wall and silhouetted at its crest as
    // floating caps from the canonical stand.
    [47.4, -3.2, 1.5, 0.42, 0.85, 0.08],
    [47.6, 3.2, 1.4, 0.38, 0.8, 0.06],
    [47.2, -2.3, 1.2, 0.34, 0.7, 0.05],
    [47.5, 2.3, 1.1, 0.3, 0.65, 0.05],
  ] as const;
  for (const [r, lateral, along, height, across, lean] of stones) {
    const jr = r + stream.signed(0.15);
    const jl = lateral + Math.sign(lateral) * stream.range(0, 0.2);
    const x = frame.axisX * jr + frame.perpX * jl;
    const z = frame.axisZ * jr + frame.perpZ * jl;
    const ground = seabedHeight(x, z);
    dummy.position.set(x, ground + height * (height > 2 ? 0.34 : 0.16), z);
    // Yawed onto the flow, tipped downstream about the across axis: the
    // run's worn stones lean the way the banners do.
    dummy.rotation.set(0, downstreamYaw + stream.signed(0.1), -lean);
    dummy.scale.set(along, height, across);
    dummy.updateMatrix();
    spots.push({ matrix: dummy.matrix.clone(), value: stream.range(0.85, 1.05) });
    contacts.push({ x, z, radius: Math.max(along, across) * 0.7, strength: 0.35 });
  }
  const material = createToonMaterial({ color: 0xffffff });
  const sentinels = new InstancedMesh(new SphereGeometry(0.5, 9, 6), material, spots.length);
  sentinels.name = "w3-run-sentinels";
  sentinels.userData.floorBound = "rest";
  // Uplift discipline (R2): no shadow work in either direction.
  sentinels.receiveShadow = false;
  sentinels.castShadow = false;
  spots.forEach((spot, index) => {
    sentinels.setMatrixAt(index, spot.matrix);
    // A step deeper than the channel's pale stones, so the pair reads as
    // silhouette against the bright far water rather than more tan.
    tint.setHex(0x6f9e96).multiplyScalar(spot.value);
    sentinels.setColorAt(index, tint);
  });
  sentinels.instanceMatrix.needsUpdate = true;
  if (sentinels.instanceColor) {
    sentinels.instanceColor.needsUpdate = true;
  }
  sentinels.computeBoundingSphere();
  uplift.add(sentinels);
}
