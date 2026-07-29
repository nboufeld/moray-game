import {
  BoxGeometry,
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
import { requestModel } from "../../rendering/AssetLibrary";
import { createToonMaterial } from "../../rendering/ToonShading";
import type { Random } from "../../util/Random";
import type { LifeContext } from "../life/LifeSystem";
import { paintVertices } from "./FaunaSystem";

/** Diver distance to the garden that sends the trio into the tentacles. */
const HIDE_RANGE = 3.2;
/** And the (larger) distance at which they trust the water again. */
const EMERGE_RANGE = 4.6;

/**
 * Twice life size, for the same reason the shrimp are 2.75× theirs: the
 * moment is watched from three to five metres (any closer and the trio
 * hides), and at true size the fish were ten pixels lost in the crowns —
 * which is exactly the owner's complaint this wave answers. The GLB is
 * authored at the animal's true 0.11 m, so 3.0 puts a fish at ~33 cm: a real
 * presence against crowns that now span a metre and more, proportionate to
 * the anemones the way a nine-centimetre ocellaris is proportionate to a
 * forty-centimetre bubble-tip. The juvenile is smaller — clownfish live as a
 * breeding pair with a smaller attendant, and the size difference is what
 * reads as a family at eight metres.
 */
const FISH_SCALES = [3.0, 3.0, 2.2] as const;

/** How hard each state pulls the fish toward its target, per second. */
const DART_RATE = 5;
const WEAVE_RATE = 2.1;
const EMERGE_RATE = 1.3;

interface FishState {
  readonly refuge: Vector3;
  readonly scale: number;
  readonly position: Vector3;
  readonly phases: readonly [number, number, number];
  readonly freqs: readonly [number, number, number];
  yaw: number;
  pitch: number;
}

/**
 * The clownfish trio living in the anemone city — the delight the user asked
 * for by name, so its behaviour is the point: they hover and weave among the
 * crowns, and when the diver closes inside a few metres they dart *into* the
 * tentacles and sit tight, re-emerging (more warily than they hid) once the
 * diver stands off again. The two ranges are a hysteresis pair so the trio
 * cannot flicker at the boundary.
 *
 * One instanced mesh wearing the sculpted GLB when it lands and a banded
 * procedural stand-in until then (and forever, in the no-assets build) — the
 * repo's one-door asset contract, exactly as the shrimp keep it. Not a
 * `LifeSystem` itself: the garden owns it, drives it, and registers its
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
   * `center` is where the weaving orbits, a little over the crowns. Three
   * refuges, three fish: two adults and a juvenile.
   */
  constructor(rng: Random, center: Vector3, refuges: readonly Vector3[]) {
    this.center = center.clone();
    this.geometry = createClownfishGeometry();
    this.material = createToonMaterial({ vertexColors: true });
    this.mesh = new InstancedMesh(this.geometry, this.material, refuges.length);
    this.mesh.name = "clownfish";
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    // Swimming instances: bounds computed from the first pose go stale, so
    // the trio opts out of culling the way the bubbles do.
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);

    // The sculpted animal, when it arrives. The stand-in geometry stays owned
    // by the garden and is disposed on teardown; the GLB is the library's,
    // shared with any future caller, and must never be disposed here.
    requestModel("models/creature-clownfish.glb", (geometry) => {
      this.mesh.geometry = geometry;
    });

    for (let i = 0; i < refuges.length; i++) {
      const state: FishState = {
        refuge: refuges[i]!.clone(),
        scale: FISH_SCALES[i] ?? FISH_SCALES[2],
        position: new Vector3(),
        phases: [rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2)],
        // The fish must not swim in lockstep; each takes its own tempo.
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
      this.center.x + Math.sin(time * f1 * tempo * Math.PI * 2 + p1) * 1.5 * amp,
      this.center.y + Math.sin(time * f3 * tempo * Math.PI * 2 + p3) * 0.3 * amp,
      this.center.z + Math.sin(time * f2 * tempo * Math.PI * 2 + p2) * 1.2 * amp,
    );
  }

  private pose(index: number, state: FishState): void {
    this.dummy.position.copy(state.position);
    this.dummy.rotation.set(state.pitch, state.yaw, 0, "YXZ");
    this.dummy.scale.setScalar(state.scale);
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

// Bright for this water on purpose: the trio is the one saturated accent the
// garden owns, and a duller orange sank into the rose coral behind it.
const ORANGE = new Color(0xff8438);
const WHITE = new Color(0xf6f0e2);
const BLACK = new Color(0x141118);

/**
 * The stand-in clownfish, authored at the GLB's own true 0.105–0.11 m so the
 * instance matrices mean the same thing whichever geometry is wearing them: a
 * plump ellipsoid body, a thin tail fan and a dorsal blade, with the THREE
 * white bands and their black edgings painted in vertex colour by position
 * along the body — the same field marks CREATURES.md gives the sculpted
 * animal, so the no-assets build stays legible. The sphere's rows decide
 * where paint can land, and the band table below is tuned so a full row
 * carries each white plateau and a row carries each black rim; a band whose
 * edge falls between rows is a pink smudge, and the bands are the point.
 */
function createClownfishGeometry(): BufferGeometry {
  const body = new SphereGeometry(0.03, 14, 20);
  body.scale(0.55, 1.0, 1.75);
  paintBands(body);

  const tail = new CylinderGeometry(0.0012, 0.019, 0.022, 6, 1);
  tail.rotateX(Math.PI / 2);
  tail.scale(0.3, 1.15, 1);
  tail.translate(0, 0.001, -0.06);
  paintVertices(tail, ORANGE.r, ORANGE.g, ORANGE.b);

  const dorsal = new BoxGeometry(0.0016, 0.016, 0.038);
  dorsal.translate(0, 0.033, 0.001);
  paintVertices(dorsal, ORANGE.r, ORANGE.g, ORANGE.b);

  const merged = mergeGeometries([body, tail, dorsal], false);
  body.dispose();
  tail.dispose();
  dorsal.dispose();
  if (!merged) {
    const fallback = new SphereGeometry(0.03, 14, 20);
    fallback.scale(0.55, 1.0, 1.75);
    paintBands(fallback);
    return fallback;
  }
  merged.computeBoundingSphere();
  return merged;
}

/** Body half-length after the scale above. */
const HALF_LENGTH = 0.03 * 1.75;
/** Body half-width after the scale above; the eye dots live at its edge. */
const HALF_WIDTH = 0.03 * 0.55;

/**
 * The three bands, (centre, white half-width, black rim width) in |z| units.
 * The stand-in's sphere has twenty rows, and this table is tuned so a full
 * row carries each white plateau (two or three rows, equator-heavy) and one
 * row carries each black rim — a rim that catches two rows reads as a black
 * stripe, and the fish is orange with white bands, not banded black.
 */
const FALLBACK_BANDS: readonly (readonly [number, number, number])[] = [
  [0.62, 0.08, 0.06],
  [0.0, 0.13, 0.065],
  [-0.62, 0.08, 0.06],
];

/** Orange with three black-edged white bands, and the eye's dark dot. */
function paintBands(body: SphereGeometry): void {
  const position = body.attributes.position;
  if (!position) {
    return;
  }
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const zn = position.getZ(i) / HALF_LENGTH;
    // The eye sits inside the head band, at the body's widest — a dark dot
    // per cheek, and it must stay dark.
    const isEye = zn > 0.52 && zn < 0.7 && Math.abs(position.getX(i)) > HALF_WIDTH * 0.7;
    let paint = ORANGE;
    if (isEye) {
      paint = BLACK;
    } else {
      for (const [centre, half, rim] of FALLBACK_BANDS) {
        const edge = Math.abs(zn - centre) - half;
        if (edge < 0) {
          paint = WHITE;
          break;
        }
        if (edge < rim) {
          paint = BLACK;
          break;
        }
      }
    }
    colors[i * 3] = paint.r;
    colors[i * 3 + 1] = paint.g;
    colors[i * 3 + 2] = paint.b;
  }
  body.setAttribute("color", new BufferAttribute(colors, 3));
}
