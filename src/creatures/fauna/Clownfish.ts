import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Object3D,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createToonMaterial } from "../../rendering/ToonShading";
import type { Random } from "../../util/Random";
import type { LifeContext } from "../life/LifeSystem";
import { paintVertices } from "./FaunaSystem";

/** Diver distance to the garden that sends the pair into the tentacles. */
const HIDE_RANGE = 3.2;
/** And the (larger) distance at which they trust the water again. */
const EMERGE_RANGE = 4.6;

/**
 * Half again over life size, for the same reason the shrimp are 2.75× theirs:
 * the moment is watched from three to five metres (any closer and the pair
 * hides), and at true size the fish were ten pixels lost in the grass — 1.25
 * was tried first and still vanished into the garden's own colour. 1.5× puts
 * a fish at ~16 cm, proportionate to crowns that grew to storybook size
 * themselves, and the white bands survive the distance.
 */
const FISH_SCALE = 1.5;

/** How hard each state pulls the fish toward its target, per second. */
const DART_RATE = 5;
const WEAVE_RATE = 2.1;
const EMERGE_RATE = 1.3;

interface FishState {
  readonly refuge: Vector3;
  readonly position: Vector3;
  readonly phases: readonly [number, number, number];
  readonly freqs: readonly [number, number, number];
  yaw: number;
  pitch: number;
}

/**
 * The pair of clownfish living in the anemone garden — the delight the user
 * asked for by name, so its behaviour is the point: they hover and weave among
 * the tentacle crowns, and when the diver closes inside a few metres they dart
 * *into* the tentacles and sit tight, re-emerging (more warily than they hid)
 * once the diver stands off again. The two ranges are a hysteresis pair so the
 * pair cannot flicker at the boundary.
 *
 * Not a `LifeSystem` itself: the garden owns it, drives it, and registers its
 * resources — a clownfish without an anemone is not a thing this reef has.
 */
export class Clownfish {
  readonly mesh: InstancedMesh;
  readonly geometry: BufferGeometry;
  readonly material: Material;

  private readonly fish: FishState[] = [];
  private readonly center: Vector3;
  private readonly dummy = new Object3D();
  private readonly desired = new Vector3();
  private readonly velocity = new Vector3();
  private hiding = false;
  private time = 0;

  /**
   * `refuges` are tentacle-crown points (one per fish, the garden picks them);
   * `center` is where the weaving orbits, a little over the crowns.
   */
  constructor(rng: Random, center: Vector3, refuges: readonly [Vector3, Vector3]) {
    this.center = center.clone();
    this.geometry = createClownfishGeometry();
    this.material = createToonMaterial({ vertexColors: true });
    this.mesh = new InstancedMesh(this.geometry, this.material, 2);
    this.mesh.name = "clownfish";
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    // Two swimming instances: bounds computed from the first pose go stale,
    // so the pair opts out of culling the way the bubbles do.
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);

    for (let i = 0; i < 2; i++) {
      const state: FishState = {
        refuge: refuges[i]!.clone(),
        position: new Vector3(),
        phases: [rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2)],
        // The two fish must not swim in lockstep; each takes its own tempo.
        freqs: [rng.range(0.3, 0.42), rng.range(0.22, 0.34), rng.range(0.5, 0.7)],
        yaw: rng.range(0, Math.PI * 2),
        pitch: 0,
      };
      this.weavePoint(state, 0, false, state.position);
      this.fish.push(state);
      this.pose(i, state);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  get isHiding(): boolean {
    return this.hiding;
  }

  /** Current world positions, copied — for the unit tests' assertions. */
  positions(): Vector3[] {
    return this.fish.map((state) => state.position.clone());
  }

  update(dt: number, ctx: LifeContext): void {
    if (dt <= 0) {
      return;
    }
    this.time = ctx.time;

    const diverDistance = Math.hypot(
      ctx.diverPosition.x - this.center.x,
      ctx.diverPosition.z - this.center.z,
    );
    if (!this.hiding && diverDistance < HIDE_RANGE) {
      this.hiding = true;
    } else if (this.hiding && diverDistance > EMERGE_RANGE) {
      this.hiding = false;
    }

    for (let i = 0; i < this.fish.length; i++) {
      const state = this.fish[i]!;
      if (this.hiding) {
        this.desired.copy(state.refuge);
      } else {
        this.weavePoint(state, this.time, ctx.reducedMotion, this.desired);
      }

      // Darting in is urgent; coming back out is a slow, wary drift.
      const rate = this.hiding
        ? DART_RATE
        : diverDistance < EMERGE_RANGE + 1.5
          ? EMERGE_RATE
          : WEAVE_RATE;
      const blend = 1 - Math.exp(-rate * dt);
      this.velocity.copy(this.desired).sub(state.position).multiplyScalar(blend / dt);
      state.position.addScaledVector(this.velocity, dt);

      // Face the way it is moving; hold the last heading while parked.
      const speed = this.velocity.length();
      if (speed > 0.02) {
        const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
        state.yaw += shortestTurn(state.yaw, targetYaw) * Math.min(1, dt * 6);
        state.pitch +=
          (Math.atan2(-this.velocity.y, Math.hypot(this.velocity.x, this.velocity.z)) * 0.6 -
            state.pitch) *
          Math.min(1, dt * 6);
      }
      this.pose(i, state);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** The lazy figure-of-drift a clownfish rides over its anemone. */
  private weavePoint(state: FishState, time: number, reducedMotion: boolean, out: Vector3): void {
    const amp = reducedMotion ? 0.5 : 1;
    const tempo = reducedMotion ? 0.6 : 1;
    const [p1, p2, p3] = state.phases;
    const [f1, f2, f3] = state.freqs;
    out.set(
      this.center.x + Math.sin(time * f1 * tempo * Math.PI * 2 + p1) * 0.6 * amp,
      this.center.y + Math.sin(time * f3 * tempo * Math.PI * 2 + p3) * 0.16 * amp,
      this.center.z + Math.sin(time * f2 * tempo * Math.PI * 2 + p2) * 0.5 * amp,
    );
  }

  private pose(index: number, state: FishState): void {
    this.dummy.position.copy(state.position);
    this.dummy.rotation.set(state.pitch, state.yaw, 0, "YXZ");
    this.dummy.scale.setScalar(FISH_SCALE);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
  }
}

/** Signed shortest arc from one heading to another. */
function shortestTurn(from: number, to: number): number {
  let turn = (to - from) % (Math.PI * 2);
  if (turn > Math.PI) {
    turn -= Math.PI * 2;
  }
  if (turn < -Math.PI) {
    turn += Math.PI * 2;
  }
  return turn;
}

/**
 * An eleven-centimetre clownfish facing +Z: a chunky ellipsoid body with a
 * small tail fan, orange with two white bands painted in vertex colour by
 * position along the body. No eye at this size — the bands are the field mark,
 * exactly the trade the shrimp GLB's transverse bands make.
 */
function createClownfishGeometry(): BufferGeometry {
  const body = new SphereGeometry(0.034, 8, 6);
  body.scale(0.78, 0.88, 1.6);
  paintBands(body);

  const deepOrange = new Color(0xc4581c);
  const tail = new CylinderGeometry(0.002, 0.017, 0.026, 6, 1);
  tail.rotateX(Math.PI / 2);
  tail.translate(0, 0, -0.062);
  paintVertices(tail, deepOrange.r, deepOrange.g, deepOrange.b);

  const merged = mergeGeometries([body, tail], false);
  body.dispose();
  tail.dispose();
  if (!merged) {
    const fallback = new SphereGeometry(0.034, 8, 6);
    fallback.scale(0.78, 0.88, 1.6);
    paintBands(fallback);
    return fallback;
  }
  merged.computeBoundingSphere();
  return merged;
}

// Bright for this water on purpose: the pair is the one saturated accent the
// garden owns, and a duller orange sank into the rose coral behind it.
const ORANGE = new Color(0xff8438);
const WHITE = new Color(0xf6f0e2);

/** Orange with a head band and a mid band, by normalised body position. */
function paintBands(body: SphereGeometry): void {
  const position = body.attributes.position;
  if (!position) {
    return;
  }
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    // Body half-length after the scale above is 0.0544.
    const zn = position.getZ(i) / 0.0544;
    const banded = (zn > 0.38 && zn < 0.72) || (zn > -0.14 && zn < 0.14);
    const paint = banded ? WHITE : ORANGE;
    colors[i * 3] = paint.r;
    colors[i * 3 + 1] = paint.g;
    colors[i * 3 + 2] = paint.b;
  }
  body.setAttribute("color", new BufferAttribute(colors, 3));
}
