import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
  type DataTexture,
} from "three";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import type { WingDef, WingFlora } from "../WingTypes";
import {
  bubbleRingSprite,
  drawFloorSpot,
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
    const shade = (0.5 + v * 0.75) * fibre * across;
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

  const update = (dt: number, reducedMotion: boolean): void => {
    // One clock governs both motions: under reduced motion it advances at
    // 0.3×, which becalms the banners' sway and the streams' tear alike —
    // the bubbles' travel is read out of the same time.
    clock.advance(dt, reducedMotion, 0.25);
    wobbleScale = reducedMotion ? 0.4 : 1;
    poseBubbles();
  };

  return { group, contacts, update };
}
