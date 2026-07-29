import {
  BufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
  Object3D,
  PlaneGeometry,
  type BufferGeometry,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildScalarTexture, fbm } from "../../../rendering/ProceduralTexture";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { FALL_CREAM, smoothstep01 } from "./GoldenShared";
import {
  GOLDEN_SLOT,
  HOURGLASS,
  RANK_WAVELENGTH,
  saddleChannelCenter,
  saddleChannelHalf,
  worldOf,
} from "./GoldenTerrain";

/**
 * The sandfalls — the wing's idiom matured to landscape scale. Three
 * systems share one vocabulary (static cream veils whose whole drawing
 * lives in four-component vertex colours, plus one instanced fall of
 * crossed streak quads recycling downward):
 *
 * - **The Hourglass ring**: twelve great falls pouring over the chasm's
 *   lip all the way round, fifteen metres down past the terraces — the
 *   wing's two-metre curtains grown into the region's landmark.
 * - **The slip-face ribbons**: short veils smoking off six dune crests
 *   in the ocean, seated by *scanning the composed terrain for the
 *   crest* so they always ride the very top of a rank.
 * - **The vale falls**: three modest falls down the saddle's walls — the
 *   approach speaks the wing's own language before the desert opens.
 *
 * Under reduced motion the streaks freeze mid-fall and dim; the baked
 * curtains carry the look alone, exactly as the wing does it.
 */

const SEED = SEEDS.regionGolden1;

interface Fall {
  readonly cx: number;
  readonly cz: number;
  readonly yaw: number;
  readonly topY: number;
  readonly height: number;
  readonly width: number;
  /** How many streaks this fall carries. */
  readonly streaks: number;
  /** Peak curtain alpha. */
  readonly alpha: number;
}

export interface GoldenFallsBuild {
  readonly meshes: (Mesh | InstancedMesh)[];
  update(dt: number, reducedMotion: boolean): void;
}

/** The slip-face ribbons' authored stations: lateral seat + search start. */
const RIBBON_SEATS: readonly { v: number; from: number }[] = [
  { v: -12, from: 306 },
  { v: 26, from: 322 },
  { v: -46, from: 348 },
  { v: 8, from: 356 },
  { v: 52, from: 336 },
  { v: -24, from: 386 },
];

function drawFalls(random: Random): Fall[] {
  const falls: Fall[] = [];

  // The Hourglass ring. World polar around the chasm's world centre —
  // the chasm is a circle, so world polar is the honest frame.
  const centre = worldOf(HOURGLASS.u, HOURGLASS.v);
  for (let k = 0; k < 12; k++) {
    const phi = (k / 12) * Math.PI * 2 + random.signed(0.1);
    const d = 45.5;
    const cx = centre.x + Math.cos(phi) * d;
    const cz = centre.z + Math.sin(phi) * d;
    const topY = seabedHeight(
      centre.x + Math.cos(phi) * (d + 3),
      centre.z + Math.sin(phi) * (d + 3),
    ) + random.range(0.4, 1.0);
    falls.push({
      cx,
      cz,
      // The veil's face looks across the chasm: normal along −radius.
      yaw: Math.atan2(-Math.cos(phi), -Math.sin(phi)),
      topY,
      height: random.range(13, 16.5),
      width: random.range(6.5, 9.5),
      streaks: 10,
      alpha: 0.72,
    });
  }

  // The slip-face ribbons: scan the composed ground along the spine of
  // each seat for the rank's crest, then hang a short veil just leeward.
  for (const seat of RIBBON_SEATS) {
    let bestU = seat.from;
    let bestY = -Infinity;
    for (let u = seat.from; u <= seat.from + RANK_WAVELENGTH; u += 0.5) {
      const { x, z } = worldOf(u, seat.v);
      const y = seabedHeight(x, z);
      if (y > bestY) {
        bestY = y;
        bestU = u;
      }
    }
    const { x, z } = worldOf(bestU + 1.2, seat.v);
    falls.push({
      cx: x,
      cz: z,
      // The ribbon's width lies along the rank (the v axis).
      yaw: Math.atan2(-Math.cos(GOLDEN_SLOT.azimuth), -Math.sin(GOLDEN_SLOT.azimuth)),
      topY: bestY + 0.3,
      height: random.range(3.2, 4.4),
      width: random.range(7, 10),
      streaks: 3,
      alpha: 0.5,
    });
  }

  // The vale falls: three, alternating walls, the wing's own scale.
  // Hung from the *local* ground, not the channel floor — round 1 hung
  // them from channel height and they floated mid-air off the slope.
  for (let i = 0; i < 3; i++) {
    const u = 118 + i * 56 + random.signed(6);
    const side = i % 2 === 0 ? -1 : 1;
    const v = saddleChannelCenter(u) + side * (saddleChannelHalf(u) + 8);
    const { x, z } = worldOf(u, v);
    const wallY = seabedHeight(x, z);
    const foot = worldOf(u, saddleChannelCenter(u) + side * (saddleChannelHalf(u) + 1));
    const footY = seabedHeight(foot.x, foot.z);
    falls.push({
      cx: (x + foot.x) / 2,
      cz: (z + foot.z) / 2,
      yaw: Math.atan2(-Math.cos(GOLDEN_SLOT.azimuth), -Math.sin(GOLDEN_SLOT.azimuth)) +
        random.signed(0.2),
      topY: wallY + 0.6,
      height: Math.max(2.2, wallY + 0.6 - footY),
      width: random.range(2.4, 3.4),
      streaks: 5,
      alpha: 0.6,
    });
  }

  return falls;
}

export function buildGoldenFalls(): GoldenFallsBuild {
  const random = new Random(SEED ^ 0x5a1f);
  const falls = drawFalls(random);

  const curtains = buildCurtains(falls);
  const streaks = buildStreaks(falls, random);

  let time = 0;
  return {
    meshes: [curtains, streaks.mesh],
    update(dt: number, reducedMotion: boolean): void {
      if (reducedMotion) {
        streaks.material.opacity = 0.15;
        return;
      }
      streaks.material.opacity = 0.5;
      time += dt;
      streaks.update(time);
    },
  };
}

/** All the veils merged into one draw, the wing's baked-alpha idiom. */
function buildCurtains(falls: readonly Fall[]): Mesh {
  const parts: BufferGeometry[] = [];
  for (const [index, fall] of falls.entries()) {
    const geometry = new PlaneGeometry(fall.width, fall.height, 4, 14);
    const position = geometry.attributes.position!;
    const colors = new Float32Array(position.count * 4);
    for (let i = 0; i < position.count; i++) {
      const u = position.getX(i) / fall.width + 0.5;
      const v = position.getY(i) / fall.height + 0.5;
      const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.3);
      const envelope = smoothstep01((v - 0.02) / 0.16) * (1 - smoothstep01((v - 0.86) / 0.14));
      const streak =
        0.6 +
        0.7 * fbm(u * 2.5, index * 7.3, { seed: SEED ^ 0x5a1f, period: 3, octaves: 2 });
      const alpha = Math.min(fall.alpha, bell * envelope * streak * fall.alpha);
      // Brighter than the wing's: these veils must separate from sand
      // walls of nearly their own colour at ten times the distance.
      const lift = 0.95 + 0.4 * v;
      colors[i * 4] = FALL_CREAM.r * lift;
      colors[i * 4 + 1] = FALL_CREAM.g * lift;
      colors[i * 4 + 2] = FALL_CREAM.b * lift;
      colors[i * 4 + 3] = alpha;
    }
    geometry.setAttribute("color", new BufferAttribute(colors, 4));
    geometry.rotateY(fall.yaw);
    geometry.translate(fall.cx, fall.topY - fall.height / 2, fall.cz);
    parts.push(geometry);
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("hourglass curtains could not be merged");
  }
  merged.computeBoundingSphere();

  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(merged, material);
  mesh.name = "hourglass-sandfall-curtains";
  mesh.renderOrder = 1;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** One instanced fall of crossed streak quads, recycling lip → depth. */
function buildStreaks(
  falls: readonly Fall[],
  random: Random,
): {
  mesh: InstancedMesh;
  material: MeshBasicMaterial;
  update: (time: number) => void;
} {
  interface Streak {
    readonly fall: Fall;
    readonly widthOffset: number;
    readonly layer: number;
    readonly p0: number;
    readonly speed: number;
    readonly w: number;
    readonly h: number;
    readonly swayPhase: number;
    readonly fade: number;
  }
  const streaks: Streak[] = [];
  for (const fall of falls) {
    for (let s = 0; s < fall.streaks; s++) {
      streaks.push({
        fall,
        widthOffset: random.signed(fall.width * 0.38),
        layer: random.signed(0.3),
        p0: random.next(),
        speed: random.range(0.5, 0.9),
        w: random.range(0.1, 0.22),
        h: random.range(0.6, 1.4),
        swayPhase: random.range(0, Math.PI * 2),
        fade: random.range(0.7, 1),
      });
    }
  }

  const bladeA = new PlaneGeometry(1, 1);
  const bladeB = new PlaneGeometry(1, 1);
  bladeB.rotateY(Math.PI / 2);
  const geometry = mergeGeometries([bladeA, bladeB], false);
  bladeA.dispose();
  bladeB.dispose();
  if (!geometry) {
    throw new Error("hourglass streak blades could not be merged");
  }

  const material = new MeshBasicMaterial({
    alphaMap: streakSprite(),
    color: 0xf0e2ba,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new InstancedMesh(geometry, material, streaks.length);
  mesh.name = "hourglass-sandfall-streaks";
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;

  const dummy = new Object3D();
  const update = (time: number): void => {
    for (const [i, streak] of streaks.entries()) {
      const { fall } = streak;
      const p = (streak.p0 + (time * streak.speed) / fall.height) % 1;
      const y = fall.topY - p * fall.height;
      const wander = Math.sin(time * 0.3 + streak.swayPhase) * 0.25 * p;
      const along = streak.widthOffset + wander;
      const dirX = Math.cos(fall.yaw);
      const dirZ = -Math.sin(fall.yaw);
      dummy.position.set(
        fall.cx + dirX * along + Math.sin(fall.yaw) * streak.layer,
        y,
        fall.cz + dirZ * along + Math.cos(fall.yaw) * streak.layer,
      );
      const envelope =
        smoothstep01(p / 0.1) * (1 - smoothstep01((p - 0.78) / 0.22)) * streak.fade;
      dummy.scale.set(streak.w * envelope, streak.h * envelope, 1);
      dummy.rotation.set(0, fall.yaw, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { mesh, material, update };
}

let streakSpriteTexture: DataTexture | undefined;
function streakSprite(): DataTexture {
  streakSpriteTexture ??= buildScalarTexture(32, (u, v) => {
    const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.5);
    return bell * smoothstep01(v / 0.1) * (1 - smoothstep01((v - 0.9) / 0.1));
  });
  return streakSpriteTexture;
}
