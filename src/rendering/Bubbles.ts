import {
  AdditiveBlending,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type DataTexture,
  type Scene,
} from "three";
import { Random, SEEDS } from "../util/Random";
import { seabedHeight } from "../world/Seabed";
import { buildScalarTexture } from "./ProceduralTexture";

/**
 * Where the reef's bubbles come up, in world XZ.
 *
 * Authored rather than scattered, for the same reason the light shafts are: a
 * rising thread of bubbles is one of the few moving verticals in the frame, and
 * where it crosses the composition is the whole of its value. Two sit either
 * side of the corridor the diver swims down so the opening minutes always have
 * one in view, and two are out on the flanks as depth cues.
 *
 * All four stand clear of the morays' approach corridors — the spawn line down
 * x = 0, the z = 6 band, and x = -6 running south. Bubbles cannot obstruct a
 * sightline (they are not in `Reef.obstructionMeshes` and the raycast never
 * sees them), but a column of light drifting across a dark head is a thing the
 * player has to look past, and this game asks them to hold still and look.
 */
const VENTS: readonly (readonly [number, number])[] = [
  // Nearest the spawn point, and off its centre line by enough that the thread
  // never crosses the reticle: at four vents the opening frame was empty of
  // bubbles for a bit over a quarter of its moments, which is not a trickle,
  // it is an occasional bubble.
  [-2.4, 17.5],
  [-5.5, 13.0],
  [3.4, 10.5],
  [8.5, 3.0],
  [-9.0, -2.0],
];

/** Metres per second, before the per-bubble spread. */
const RISE_SPEED = 0.4;

/** How high above its vent a bubble climbs before it is recycled. */
const CEILING_MIN = 6;
const CEILING_MAX = 8;

/** Sprite diameter, in metres. */
const RADIUS_MIN = 0.05;
const RADIUS_MAX = 0.15;

/**
 * The stretch of the climb a bubble spends growing in at the bottom and
 * shrinking away in at the top, as a fraction of its ceiling.
 *
 * Both ends need one. A bubble that appears at full size on the sand is a
 * sprite being switched on, and one that vanishes at its ceiling is the same
 * thing in reverse — which is the failure the eye catches, because it happens
 * in mid-water with nothing to hide behind. Scale rather than opacity does it
 * so that every instance can stay one colour and the mesh can stay one draw
 * call with nothing per-instance but its matrix.
 */
const BIRTH_FRACTION = 0.06;
const FADE_FRACTION = 0.16;

interface Bubble {
  readonly originX: number;
  readonly originZ: number;
  readonly originY: number;
  /** Metres climbed since leaving the vent. */
  height: number;
  readonly speed: number;
  readonly ceiling: number;
  readonly radius: number;
  /** Compass direction of the sway's long axis. */
  readonly swayCos: number;
  readonly swaySin: number;
  readonly swayAmplitude: number;
  readonly swayRate: number;
  readonly swayPhase: number;
}

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Threads of bubbles rising from vents in the sand.
 *
 * The one thing in this package that is added rather than retuned, and the most
 * recognisable mark in the language: a Ponyo sea is never still, and what moves
 * in it is round, bright and going up. Each bubble is a camera-facing quad
 * wearing a ring — a bright rim around a hollow centre, which is what a bubble
 * actually looks like from outside and also what a brush draws when it draws
 * one — climbing at walking pace with a lazy sideways wander.
 *
 * The whole system is one `InstancedMesh`: one draw call, four dozen small
 * quads, and a matrix per bubble rebuilt on the CPU each frame. That is the
 * cheap half of the design. The expensive half would have been size — these are
 * additive, transparent and unsorted, so their cost is overdraw, and a bubble
 * large enough to be admired is a bubble that costs more than the sand behind
 * it. Measured on the opening frame the whole system covers four tenths of one
 * percent of it, which is what makes the count a free parameter and the radius
 * an expensive one.
 */
export class Bubbles {
  readonly mesh: InstancedMesh<PlaneGeometry, MeshBasicMaterial>;

  private readonly bubbles: Bubble[] = [];
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly facing = new Quaternion();
  private time = 0;

  constructor(
    count = 55,
    vents: readonly (readonly [number, number])[] = VENTS,
    seed: number = SEEDS.bubbles,
  ) {
    const random = new Random(seed);

    for (let i = 0; i < count; i++) {
      const vent = vents[i % vents.length] ?? [0, 0];
      const [ventX, ventZ] = vent;
      // A vent is a patch of sand, not a nozzle: without the spread every
      // bubble in a thread rises up the same line and the thread reads as a
      // dotted rule drawn on the water.
      const originX = ventX + random.signed(0.28);
      const originZ = ventZ + random.signed(0.28);
      const swayAngle = random.range(0, Math.PI * 2);
      const ceiling = random.range(CEILING_MIN, CEILING_MAX);

      this.bubbles.push({
        originX,
        originZ,
        originY: seabedHeight(originX, originZ) + 0.05,
        // Spread up the column at build time, so the first frame already has a
        // thread in the air rather than four clumps leaving the sand together.
        height: random.range(0, ceiling),
        speed: RISE_SPEED * random.range(0.78, 1.25),
        ceiling,
        radius: random.range(RADIUS_MIN, RADIUS_MAX),
        swayCos: Math.cos(swayAngle),
        swaySin: Math.sin(swayAngle),
        swayAmplitude: random.range(0.06, 0.2),
        swayRate: random.range(0.5, 1.3),
        swayPhase: random.range(0, Math.PI * 2),
      });
    }

    this.mesh = new InstancedMesh(new PlaneGeometry(1, 1), bubbleMaterial(), count);
    // Every instance moves every frame, so a bounding sphere computed from the
    // matrices is stale before it is used. One draw call of forty small quads
    // has nothing to gain from being culled anyway.
    this.mesh.frustumCulled = false;
    this.pose();
  }

  addTo(scene: Scene): void {
    scene.add(this.mesh);
  }

  /**
   * `cameraQuaternion` is optional so a caller with no camera to hand — the
   * unit tests, and anything driving this before a frame has been posed — still
   * gets bubbles. Given one, every sprite turns to face the lens.
   */
  update(dt: number, reducedMotion: boolean, cameraQuaternion?: Quaternion): void {
    const step = dt * (reducedMotion ? 0.4 : 1);
    this.time += step;

    for (const bubble of this.bubbles) {
      bubble.height += bubble.speed * step;
      if (bubble.height > bubble.ceiling) {
        // Back to the sand rather than wrapped by the ceiling: a bubble that
        // keeps its fractional overshoot drifts into lockstep with its
        // neighbours over a long session.
        bubble.height = 0;
      }
    }

    if (cameraQuaternion) {
      this.facing.copy(cameraQuaternion);
    }
    this.pose();
  }

  private pose(): void {
    this.bubbles.forEach((bubble, index) => {
      const sway = Math.sin(this.time * bubble.swayRate + bubble.swayPhase) * bubble.swayAmplitude;
      // A second, slower swing across the first: one sine alone is a pendulum,
      // and a bubble wanders.
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

      this.matrix.compose(this.position, this.facing, this.scale);
      this.mesh.setMatrixAt(index, this.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * One material and one map for every bubble in the reef, built once and shared
 * the way the shafts' beam and pool maps are. Nothing here varies per instance
 * but the matrix, and a texture the library owns is a texture no instance may
 * dispose.
 */
let ringTexture: DataTexture | undefined;
function bubbleMaterial(): MeshBasicMaterial {
  ringTexture ??= createRingSprite();
  return new MeshBasicMaterial({
    map: ringTexture,
    // Warm white, matching the dapples and the shafts: everything bright in
    // this water is the same sun.
    color: 0xfff6e2,
    transparent: true,
    opacity: 0.55,
    blending: AdditiveBlending,
    depthWrite: false,
    // Additive and fog do not mix — fog would interpolate a bubble toward the
    // water's own bright colour and then add that, so distance would brighten
    // it. The vents are all inside the near field, so nothing needs fading.
    fog: false,
  });
}

/**
 * A bubble seen from outside: a bright rim, a hollow centre and a small
 * off-axis catchlight, going to black well inside the map's edge.
 *
 * Black rather than transparent because the sprite is additive — the alpha
 * channel a scalar map carries is a flat 1, and what keeps the corners of the
 * quad from showing is that they add nothing. The mote sprite works the same
 * way.
 */
function createRingSprite(): DataTexture {
  return buildScalarTexture(48, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    // The rim, as a soft band rather than a stroke: a hard ring at this size is
    // one aliased pixel wide by the time it is three metres away.
    const rim = Math.exp(-Math.pow((distance - 0.7) / 0.17, 2));
    // A trace of interior so the shape reads as a sphere of water rather than
    // as a ring drawn on nothing.
    const fill = 0.1 * (1 - smoothStep(0, 0.8, distance));
    const catchlight =
      0.5 * Math.exp(-Math.pow(Math.hypot(u - 0.35, v - 0.35) / 0.1, 2));
    // Closes the map off short of its own edge, so no filtering can smear the
    // rim onto the quad's boundary.
    return Math.min(1, rim + fill + catchlight) * (1 - smoothStep(0.86, 1, distance));
  });
}
