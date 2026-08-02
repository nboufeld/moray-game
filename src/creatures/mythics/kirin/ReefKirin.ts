import {
  ConeGeometry,
  Group,
  Mesh,
  Sphere,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";
import { requestModel } from "../../../rendering/AssetLibrary";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../../world/Seabed";
import { RUINS_TERRACE } from "../../../world/wings/defs/RuinsTerrace";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import type { LifeContext } from "../../life/LifeSystem";
import {
  MythicBody,
  buildSkinnedBody,
  retireFallback,
  type JointSpec,
} from "../shared/MythicBody";

/** The brief's hard ceiling; asserted in tests and in the build script. */
export const KIRIN_TRI_BUDGET = 4500;
export const KIRIN_MODEL_PATH = "models/creature-kirin.glb";

/**
 * The grazing range: the monument corridor of the Ruins Terrace, r 38–44
 * and never more than 0.065 rad off the wing's axis — inside the floor
 * band by construction, so the being is always findable from the swim
 * lane and never inside a wall.
 */
export const KIRIN_RANGE = {
  azimuth: RUINS_TERRACE.azimuth,
  radiusMin: 38.5,
  radiusMax: 43.5,
  azimuthSwing: 0.065,
  hover: 0.18,
} as const;

const WAYPOINTS = 6;
/** A stately drift between monuments; the kirin does not hurry anywhere. */
const TRAVEL_SPEED = 0.38;
const ARRIVE_RADIUS = 0.3;

/** The deer-attention: near and calm earns a raised head; no flee, ever. */
const ATTENTION_RANGE = 9.5;
const ATTENTION_MAX_SPEED = 1.2;
const ATTENTION_RISE = 0.8;
const ATTENTION_FALL = 0.45;
const NECK_YAW_MAX = 0.6;

/** The nibble: pitch down in soft bobs while grazing (head +Y is model +X). */
const NIBBLE_PITCH = 0.5;
/** The alert head: lifted a touch, levelled on the diver. */
const ALERT_PITCH = -0.14;

const TAIL_SWAY_AMP = 0.1;
const TAIL_SWAY_HZ = 0.07;

const IDLE_SAMPLES = 32;

/** The skin's joint order, measured off the GLB with the inspector. */
const KIRIN_JOINTS: readonly JointSpec[] = [
  { name: "root", origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], parent: null },
  { name: "neck", origin: [0, 1.09, 0.08], x: [1, 0, 0], y: [0, 1, 0], parent: 0 },
  { name: "head", origin: [0, 1.3, 0.17], x: [0, 0, 1], y: [1, 0, 0], parent: 1 },
  { name: "tail", origin: [0, 0.356, -0.036], x: [1, 0, 0], y: [0, 1, 0], parent: 0 },
];

/** Where the discovery point sits, in body space. */
const HEAD_LOCAL = new Vector3(0, 1.42, 0.2);

interface KirinRig {
  /** neck yaw, head pitch (+ is down), tail sway. */
  pose(neckYaw: number, headPitch: number, tailSway: number): void;
}

interface IdleSample {
  readonly idle: number;
  readonly nibbles: number;
  readonly nibblePeriod: number;
}

/**
 * The Reef Kirin, grazing between the Ruins Terrace's fallen columns.
 * It wanders a slow circuit of seeded waypoints with idle nibble bobs,
 * and — the whole character — lifts its head toward a diver who comes
 * slowly, the way deer stop eating to look. It never flees; it is the
 * ruins' oldest tenant, not prey.
 */
export class ReefKirin extends MythicBody {
  readonly target: DiscoveryTarget;

  private readonly waypoints: Vector3[] = [];
  private readonly idles: IdleSample[] = [];
  private waypointIndex = 0;
  private idleCount = 0;
  private idleClock = 0;
  private travelling = false;
  private yaw = 0;
  private neckYaw = 0;
  private attentionLevel = 0;

  private rig: KirinRig;
  private fallback: Group | null;
  private readonly bodyMaterial = this.own(createToonMaterial({ color: 0xd9bd7f }));

  private readonly scratch = new Vector3();

  constructor(seed: number = SEEDS.mythKirin) {
    super("reef-kirin");
    const random = new Random(seed);
    for (let i = 0; i < WAYPOINTS; i++) {
      const r = random.range(KIRIN_RANGE.radiusMin, KIRIN_RANGE.radiusMax);
      const azimuth = KIRIN_RANGE.azimuth + random.signed(KIRIN_RANGE.azimuthSwing);
      const x = r * Math.cos(azimuth);
      const z = r * Math.sin(azimuth);
      this.waypoints.push(new Vector3(x, seabedHeight(x, z) + KIRIN_RANGE.hover, z));
    }
    const idleRandom = new Random(seed ^ 0x1d1e);
    for (let i = 0; i < IDLE_SAMPLES; i++) {
      this.idles.push({
        idle: idleRandom.range(4.5, 9),
        nibbles: 2 + Math.floor(idleRandom.range(0, 3.999)),
        nibblePeriod: idleRandom.range(0.55, 0.8),
      });
    }
    // A second, independent substream for the wander order's variation.
    const orderRandom = new Random(seed ^ 0x0dd);
    for (let i = this.waypoints.length - 1; i > 0; i--) {
      const j = Math.floor(orderRandom.range(0, i + 0.999));
      const held = this.waypoints[i]!;
      this.waypoints[i] = this.waypoints[j]!;
      this.waypoints[j] = held;
    }

    this.body.position.copy(this.waypoints[0]!);
    this.yaw = KIRIN_RANGE.azimuth + Math.PI / 2;

    const built = buildFallbackKirin(this.bodyMaterial, (r) => this.own(r));
    this.fallback = built.fallback;
    this.rig = built.rig;
    this.body.add(built.fallback);

    this.target = { speciesId: "myth-reef-kirin", position: new Vector3() };
    this.update(0, {
      diverPosition: new Vector3(0, 2, 22),
      diverSpeed: 0,
      reducedMotion: false,
      time: 0,
    });

    requestModel(KIRIN_MODEL_PATH, (geometry) => this.adoptModel(geometry));
  }

  /** 0..1 — how attended the diver is; exposed for the behaviour tests. */
  get attention(): number {
    return this.attentionLevel;
  }

  update(dt: number, ctx: LifeContext): void {
    const slow = ctx.reducedMotion ? 0.55 : 1;

    this.attend(dt, ctx);
    // Deer stand to look: travelling pauses while the diver is regarded.
    if (this.attentionLevel < 0.6) {
      this.wander(dt, slow);
    }

    // The hover is a hand's breadth, breathing; the floor does the rest.
    const bob = Math.sin(ctx.time * 1.1) * 0.04 * (ctx.reducedMotion ? 0.5 : 1);
    this.body.position.y = this.groundY() + KIRIN_RANGE.hover + bob;
    this.body.rotation.set(0, this.yaw, 0, "YXZ");

    // Head: nibble bobs while grazing, a lifted level head while attended.
    const sample = this.idles[this.idleSampleIndex()]!;
    let grazePitch = 0;
    if (!this.travelling && this.idleClock > 0.8) {
      const nibbleTime = (this.idleClock - 0.8) % (sample.nibblePeriod * sample.nibbles);
      const beat = (nibbleTime / sample.nibblePeriod) * Math.PI * 2;
      grazePitch = Math.max(0, Math.sin(beat)) * NIBBLE_PITCH;
    }
    const headPitch = grazePitch * (1 - this.attentionLevel) + ALERT_PITCH * this.attentionLevel;
    const tailSway =
      TAIL_SWAY_AMP * Math.sin(ctx.time * TAIL_SWAY_HZ * Math.PI * 2) * (ctx.reducedMotion ? 0.5 : 1);
    this.rig.pose(this.neckYaw * this.attentionLevel, headPitch * (ctx.reducedMotion ? 0.7 : 1), tailSway);

    this.target.position.copy(HEAD_LOCAL).applyQuaternion(this.body.quaternion).add(this.body.position);
  }

  /** The deer-attention: near and calm raises it; anything else lets it go. */
  private attend(dt: number, ctx: LifeContext): void {
    const distance = this.scratch.subVectors(ctx.diverPosition, this.body.position).length();
    const watching = distance < ATTENTION_RANGE && ctx.diverSpeed < ATTENTION_MAX_SPEED;
    const rate = watching ? ATTENTION_RISE : -ATTENTION_FALL;
    this.attentionLevel = Math.min(1, Math.max(0, this.attentionLevel + rate * dt));

    if (watching) {
      // Neck yaw toward the diver, in body space, clamped like a real neck.
      this.scratch.copy(ctx.diverPosition).sub(this.body.position);
      const inverse = this.body.quaternion.clone().invert();
      this.scratch.applyQuaternion(inverse);
      const want = Math.max(-NECK_YAW_MAX, Math.min(NECK_YAW_MAX, Math.atan2(this.scratch.x, this.scratch.z)));
      this.neckYaw += Math.max(-1.2 * dt, Math.min(1.2 * dt, want - this.neckYaw));
    }
  }

  /** Idle graze at a waypoint, then an unhurried walk to the next. */
  private wander(dt: number, slow: number): void {
    if (!this.travelling) {
      this.idleClock += dt;
      if (this.idleClock >= this.idles[this.idleSampleIndex()]!.idle) {
        this.travelling = true;
        this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
      }
      return;
    }

    const goal = this.waypoints[this.waypointIndex]!;
    this.scratch.subVectors(goal, this.body.position);
    this.scratch.y = 0;
    const distance = this.scratch.length();
    if (distance < ARRIVE_RADIUS) {
      this.travelling = false;
      this.idleClock = 0;
      this.idleCount++;
      return;
    }
    const step = Math.min(distance, TRAVEL_SPEED * slow * dt);
    this.body.position.addScaledVector(this.scratch.normalize(), step);
    const wantYaw = Math.atan2(this.scratch.x, this.scratch.z);
    let dyaw = wantYaw - this.yaw;
    if (dyaw > Math.PI) {
      dyaw -= Math.PI * 2;
    } else if (dyaw < -Math.PI) {
      dyaw += Math.PI * 2;
    }
    this.yaw += Math.max(-0.9 * dt, Math.min(0.9 * dt, dyaw));
  }

  private idleSampleIndex(): number {
    return this.idleCount % IDLE_SAMPLES;
  }

  /** The terrace's floor under the body — recomputed, the wander is slow. */
  private groundY(): number {
    return seabedHeight(this.body.position.x, this.body.position.z);
  }

  /** The GLB landed: rebuild the skeleton and retire the stand-in. */
  private adoptModel(geometry: BufferGeometry): void {
    if (this.isDisposed) {
      return;
    }
    this.bodyMaterial.color.set(0xffffff);
    this.bodyMaterial.vertexColors = true;
    this.bodyMaterial.needsUpdate = true;

    const { mesh, bones, skeleton } = buildSkinnedBody(
      geometry,
      KIRIN_JOINTS,
      this.bodyMaterial,
      new Sphere(new Vector3(0, 0.85, 0.05), 1.1),
    );
    this.ownSkeleton(skeleton);
    this.body.add(mesh);

    if (this.fallback) {
      this.body.remove(this.fallback);
      retireFallback(this.fallback, new Set([this.bodyMaterial]), (r) => this.disposeOwned(r));
      this.fallback = null;
    }

    const neck = bones[1]!;
    const head = bones[2]!;
    const tail = bones[3]!;
    this.rig = {
      pose: (neckYaw, headPitch, tailSway) => {
        neck.rotation.y = neckYaw;
        head.rotation.y = headPitch;
        tail.rotation.y = tailSway;
      },
    };
  }
}

/**
 * The no-assets kirin: the same pivots the GLB's skin carries, wearing
 * stacked-sphere body volumes, a torus tail curl, cone antlers and a moss
 * mane ridge. One pose drives either body, as everywhere here.
 */
function buildFallbackKirin(
  bodyMaterial: Material,
  own: <T extends BufferGeometry | Material>(r: T) => T,
): { fallback: Group; rig: KirinRig } {
  const fallback = new Group();
  fallback.name = "kirin-fallback";

  const cream = own(createToonMaterial({ color: 0xefe3b4 }));
  const moss = own(createToonMaterial({ color: 0x75805a }));
  const coral = own(createToonMaterial({ color: 0xe89d80 }));
  const dark = own(createToonMaterial({ color: 0x201a14 }));

  const ball = own(new SphereGeometry(1, 12, 9));

  const tailPivot = new Group();
  tailPivot.position.set(0, 0.356, -0.036);
  fallback.add(tailPivot);
  const curl = new Mesh(own(new TorusGeometry(0.13, 0.034, 8, 14, 4.6)), bodyMaterial);
  curl.position.set(0, -0.19, 0.07);
  curl.rotation.y = Math.PI / 2;
  tailPivot.add(curl);

  const belly = new Mesh(ball, bodyMaterial);
  belly.scale.set(0.095, 0.15, 0.105);
  belly.position.set(0, 0.62, 0.04);
  fallback.add(belly);
  const bellyCream = new Mesh(ball, cream);
  bellyCream.scale.set(0.07, 0.11, 0.06);
  bellyCream.position.set(0, 0.58, 0.1);
  fallback.add(bellyCream);
  const chest = new Mesh(ball, bodyMaterial);
  chest.scale.set(0.088, 0.13, 0.098);
  chest.position.set(0, 0.88, 0.0);
  fallback.add(chest);

  const neckPivot = new Group();
  neckPivot.position.set(0, 1.09, 0.08);
  fallback.add(neckPivot);
  const neckMesh = new Mesh(ball, bodyMaterial);
  neckMesh.scale.set(0.055, 0.17, 0.062);
  neckMesh.position.set(0, 0.1, 0.01);
  neckPivot.add(neckMesh);
  const mane = new Mesh(own(new ConeGeometry(0.035, 0.34, 5)), moss);
  mane.scale.set(1, 1, 0.45);
  mane.position.set(0, 0.12, -0.055);
  neckPivot.add(mane);

  const headPivot = new Group();
  headPivot.position.set(0, 0.21, 0.09);
  neckPivot.add(headPivot);
  const skull = new Mesh(ball, bodyMaterial);
  skull.scale.set(0.062, 0.055, 0.07);
  skull.position.set(0, 0.09, 0.03);
  headPivot.add(skull);
  const muzzle = new Mesh(ball, bodyMaterial);
  muzzle.scale.set(0.034, 0.03, 0.055);
  muzzle.position.set(0, 0.08, 0.115);
  headPivot.add(muzzle);
  const nose = new Mesh(ball, dark);
  nose.scale.setScalar(0.016);
  nose.position.set(0, 0.075, 0.165);
  headPivot.add(nose);
  for (const side of [1, -1]) {
    const eye = new Mesh(ball, dark);
    eye.scale.setScalar(0.013);
    eye.position.set(side * 0.048, 0.105, 0.06);
    headPivot.add(eye);

    const beam = new Mesh(own(new ConeGeometry(0.016, 0.24, 5)), coral);
    beam.position.set(side * 0.06, 0.2, 0.0);
    beam.rotation.set(-0.42, 0, -side * 0.38, "YXZ");
    headPivot.add(beam);
    const tine = new Mesh(own(new ConeGeometry(0.011, 0.13, 4)), coral);
    tine.position.set(side * 0.085, 0.14, 0.06);
    tine.rotation.set(0.5, 0, -side * 0.2, "YXZ");
    headPivot.add(tine);

    const ear = new Mesh(ball, moss);
    ear.scale.set(0.035, 0.014, 0.02);
    ear.position.set(side * 0.08, 0.1, -0.01);
    headPivot.add(ear);
  }

  const rig: KirinRig = {
    pose: (neckYaw, headPitch, tailSway) => {
      neckPivot.rotation.y = neckYaw;
      headPivot.rotation.x = headPitch;
      tailPivot.rotation.y = tailSway;
    },
  };
  return { fallback, rig };
}
