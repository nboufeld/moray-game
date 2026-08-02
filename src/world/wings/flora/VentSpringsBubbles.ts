import {
  AdditiveBlending,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildScalarTexture } from "../../../rendering/ProceduralTexture";
import { Random } from "../../../util/Random";

/**
 * The Vent Springs' shimmer: thin columns of fine bubbles standing over
 * each vent, slow and unhurried — the one hot place in a cool game telling
 * you so before anything glows.
 *
 * The reef's `Bubbles` idiom, rebuilt for a wing: one `InstancedMesh`, one
 * additive ring sprite, a matrix per bubble rebuilt on the CPU each frame.
 * Two differences are deliberate. The quads are *crossed* — two planes at
 * right angles per bubble — because a wing flora's `update` is never
 * handed a camera, and a crossed pair reads round from every azimuth where
 * a single camera-facing quad would need the lens. And the bubbles are
 * finer and slower than the bowl's: vents breathe, they do not fizz.
 *
 * Scale, not opacity, runs the birth and death of a bubble, so every
 * instance can stay one colour and the mesh one draw call. Under reduced
 * motion the streams barely drift — the vents keep breathing, slowly.
 */

/** A bubble's source: a chimney mouth or a fissure, in world space. */
export interface VentSource {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Metres per second at the middle of the spread — walking pace, halved. */
const RISE_MIN = 0.2;
const RISE_MAX = 0.36;

/** How high above its vent a bubble climbs before it is recycled. */
const CEILING_MIN = 4.5;
const CEILING_MAX = 6.5;

/** Sprite diameter, in metres — fine bubbles, not the bowl's berries. */
const RADIUS_MIN = 0.035;
const RADIUS_MAX = 0.085;

/** The stretch spent growing in at the bottom and shrinking away at the top. */
const BIRTH_FRACTION = 0.07;
const FADE_FRACTION = 0.18;

interface Bubble {
  readonly originX: number;
  readonly originY: number;
  readonly originZ: number;
  height: number;
  readonly speed: number;
  readonly ceiling: number;
  readonly radius: number;
  readonly swayCos: number;
  readonly swaySin: number;
  readonly swayAmplitude: number;
  readonly swayRate: number;
  readonly swayPhase: number;
  readonly yaw: number;
}

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class VentSpringsBubbles {
  readonly mesh: InstancedMesh;

  private readonly bubbles: Bubble[] = [];
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly facing = new Quaternion();
  private time = 0;

  constructor(vents: readonly VentSource[], count: number, seed: number) {
    const random = new Random(seed);

    for (let i = 0; i < count; i++) {
      const vent = vents[i % vents.length]!;
      // A vent is a mouth, not a nozzle: without the spread every bubble in
      // a column rises up the same line.
      const swayAngle = random.range(0, Math.PI * 2);
      const ceiling = random.range(CEILING_MIN, CEILING_MAX);
      this.bubbles.push({
        originX: vent.x + random.signed(0.16),
        originY: vent.y + 0.04,
        originZ: vent.z + random.signed(0.16),
        // Spread up the column at build time, so the first frame already
        // has threads in the water.
        height: random.range(0, ceiling),
        speed: random.range(RISE_MIN, RISE_MAX),
        ceiling,
        radius: random.range(RADIUS_MIN, RADIUS_MAX),
        swayCos: Math.cos(swayAngle),
        swaySin: Math.sin(swayAngle),
        swayAmplitude: random.range(0.05, 0.13),
        swayRate: random.range(0.4, 1.0),
        swayPhase: random.range(0, Math.PI * 2),
        yaw: random.range(0, Math.PI),
      });
    }

    this.mesh = new InstancedMesh(crossedQuad(), bubbleMaterial(), count);
    this.mesh.name = "vent-bubbles";
    // Every instance moves every frame; one draw call of small quads has
    // nothing to gain from being culled.
    this.mesh.frustumCulled = false;
    this.pose();
  }

  update(dt: number, reducedMotion: boolean): void {
    const step = dt * (reducedMotion ? 0.22 : 1);
    this.time += step;
    for (const bubble of this.bubbles) {
      bubble.height += bubble.speed * step;
      if (bubble.height > bubble.ceiling) {
        bubble.height = 0;
      }
    }
    this.pose();
  }

  private pose(): void {
    for (const [index, bubble] of this.bubbles.entries()) {
      const sway = Math.sin(this.time * bubble.swayRate + bubble.swayPhase) * bubble.swayAmplitude;
      const drift =
        Math.cos(this.time * bubble.swayRate * 0.53 + bubble.swayPhase) *
        bubble.swayAmplitude *
        0.6;
      this.position.set(
        bubble.originX + sway * bubble.swayCos - drift * bubble.swaySin,
        bubble.originY + bubble.height,
        bubble.originZ + sway * bubble.swaySin + drift * bubble.swayCos,
      );

      const climb = bubble.height / bubble.ceiling;
      const envelope =
        smoothStep(0, BIRTH_FRACTION, climb) * (1 - smoothStep(1 - FADE_FRACTION, 1, climb));
      const size = bubble.radius * 2 * envelope;
      this.scale.set(size, size, 1);
      this.facing.setFromAxisAngle(UP, bubble.yaw);
      this.matrix.compose(this.position, this.facing, this.scale);
      this.mesh.setMatrixAt(index, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const UP = new Vector3(0, 1, 0);

/** Two quads at right angles: a sprite that reads round from every azimuth. */
function crossedQuad(): BufferGeometry {
  const a = new PlaneGeometry(1, 1);
  const b = new PlaneGeometry(1, 1);
  b.rotateY(Math.PI / 2);
  const merged = mergeGeometries([a, b], false);
  a.dispose();
  b.dispose();
  if (!merged) {
    throw new Error("bubble quads could not be merged");
  }
  return merged;
}

/**
 * One material and one map for every vent bubble: a bright rim, a hollow
 * centre and a small catchlight, going to black well inside the map's edge
 * — what a bubble looks like from outside, and what a brush draws. The
 * tint is the springs' warm white; opacity stays additive-mark modest.
 */
let ringTexture: DataTexture | undefined;
function bubbleMaterial(): MeshBasicMaterial {
  ringTexture ??= buildScalarTexture(48, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    const rim = Math.exp(-Math.pow((distance - 0.7) / 0.17, 2));
    const fill = 0.1 * (1 - smoothStep(0, 0.8, distance));
    const catchlight = 0.5 * Math.exp(-Math.pow(Math.hypot(u - 0.35, v - 0.35) / 0.1, 2));
    return Math.min(1, rim + fill + catchlight) * (1 - smoothStep(0.86, 1, distance));
  });
  return new MeshBasicMaterial({
    map: ringTexture,
    color: 0xffe4b8,
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    // Additive and fog do not mix; the vents all stand in the near field.
    fog: false,
  });
}
