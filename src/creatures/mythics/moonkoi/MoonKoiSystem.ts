import {
  Bone,
  BoxGeometry,
  Color,
  Group,
  Matrix4,
  Mesh,
  Skeleton,
  SkinnedMesh,
  Sphere,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Scene,
} from "three";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { requestModel } from "../../../rendering/AssetLibrary";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { disposeSubtree } from "../../../util/disposeSubtree";
import { MOONLIT_LAGOON } from "../../../world/wings/defs/MoonlitLagoon";
import type { LifeContext, LifeSystem } from "../../life/LifeSystem";

/**
 * The Moon Koi — a ningyo spirit in the shape of a great pale koi, circling
 * the Moonlit Lagoon's stillest pool in a slow figure the diver can learn.
 *
 * The figure is one circle: r ≈ 40 on the lagoon's axis, radius 4 m at
 * y ≈ 2.5, one revolution in 25 s, the body curved along the circle the way
 * a fish's body curves along its path, and the long caudal ribbon trailing
 * with delay — the silk of fin the codex line remembers. A calm diver draws
 * it half a metre closer; a fast one pushes it the same half metre away.
 *
 * The body is `creature-moon-koi.glb` (five spine joints and two ribbon
 * joints, all turning about the dorsal axis, so `rotation.y` on each rebuilt
 * bone is exactly the lateral bend); until it lands, the same seven pivots
 * drive a chain of primitive segments in the same silver palette.
 */

/** The pool: r ≈ 40 on the lagoon's axis. */
const POOL_RADIUS = 40;
const POOL_X = POOL_RADIUS * Math.cos(MOONLIT_LAGOON.azimuth);
const POOL_Z = POOL_RADIUS * Math.sin(MOONLIT_LAGOON.azimuth);
const POOL_Y = 2.5;

/** The figure: a 4 m circle swum in 25 s, counterclockwise seen from above. */
const CIRCLE_RADIUS = 4;
const REVOLUTION_SECONDS = 25;
const OMEGA = (Math.PI * 2) / REVOLUTION_SECONDS;

/** The body's constant bend along its circle: length over radius, per joint. */
const CIRCLE_BEND = 0.09;
/** The swim wave riding over the bend: small, slow, trailing down the spine. */
const WAVE_AMP = 0.055;
const WAVE_PERIOD = 3.2;
const WAVE_LAG = 0.5;
/** The ribbon's trailing delay: it answers the tail's angle this slowly. */
const RIBBON_TAU = 0.9;
const RIBBON_SWAY = 0.1;

/** How far the koi meets a calm diver, and yields to a fast one. */
const DRIFT_METRES = 0.5;
const DRIFT_TAU = 1.6;
const CALM_SPEED = 1.1;
const CALM_RANGE = 12;
const FAST_SPEED = 3.2;
const FAST_RANGE = 10;

/** Where the discovery target rides, in model space: the brow. */
const HEAD_LOCAL_Z = 0.72;

/**
 * The exported skin's joints, predicted from the authored build and verified
 * against `inspect_creature.mjs` (contract in the wave-8 ledger): five spine
 * joints nose-to-peduncle and two ribbon joints, each bone lying along the
 * dorsal axis so its local +Y is model +Y — `rotation.y` is the lateral bend
 * of the swim. Order is the skin's joint order and must not be shuffled.
 */
const JOINTS = [
  { name: "root", origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0] },
  { name: "spine0", origin: [0, 0, 0.65], x: [1, 0, 0], y: [0, 1, 0] },
  { name: "spine1", origin: [0, 0, 0.32], x: [1, 0, 0], y: [0, 1, 0] },
  { name: "spine2", origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0] },
  { name: "spine3", origin: [0, 0, -0.32], x: [1, 0, 0], y: [0, 1, 0] },
  { name: "spine4", origin: [0, 0, -0.6], x: [1, 0, 0], y: [0, 1, 0] },
  { name: "ribbon0", origin: [0, 0, -0.9], x: [1, 0, 0], y: [0, 1, 0] },
  { name: "ribbon1", origin: [0, 0, -1.42], x: [1, 0, 0], y: [0, 1, 0] },
] as const;
const JOINT_COUNT = JOINTS.length - 1;

/** One posable koi, whichever body it is wearing. */
interface KoiRig {
  /** Seven lateral bends: five spine joints, then the two ribbon joints. */
  pose(angles: readonly number[]): void;
}

export class MoonKoiSystem implements LifeSystem {
  readonly group = new Group();
  readonly target: DiscoveryTarget;
  readonly targets: readonly DiscoveryTarget[];

  private readonly root = new Group();
  private readonly bodyMaterial = createToonMaterial({ color: 0xeceef2 });
  private readonly ribbonMaterial = createToonMaterial({ color: 0xe6d9e2 });

  private readonly theta0: number;
  private readonly angles = new Array<number>(JOINT_COUNT).fill(0);
  private readonly ribbonLag = [0, 0];
  private readonly drift = new Vector3();
  private readonly driftTarget = new Vector3();
  private rig: KoiRig;
  private glbMesh: SkinnedMesh | null = null;

  private readonly scratch = new Vector3();

  constructor() {
    this.group.name = "myth-moon-koi";
    this.root.name = "moon-koi-body";
    this.group.add(this.root);

    const random = new Random(SEEDS.mythMoonKoi);
    // The one seeded draw before anything async: where on its circle it began.
    this.theta0 = random.range(0, Math.PI * 2);

    const { rig, fallback } = buildFallbackKoi(this.bodyMaterial, this.ribbonMaterial);
    this.rig = rig;
    this.root.add(fallback);

    this.target = { speciesId: "myth-moon-koi", position: new Vector3(POOL_X, POOL_Y, POOL_Z) };
    this.targets = [this.target];

    requestModel("models/creature-moon-koi.glb", (geometry) => this.adoptModel(geometry));
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }

  /** The eased regard/yield offset from the pool's centre, for the tests. */
  get driftOffset(): Vector3 {
    return this.drift.clone();
  }

  update(dt: number, ctx: LifeContext): void {
    const calm = ctx.reducedMotion ? 0.35 : 1;
    const theta = this.theta0 + OMEGA * ctx.time;

    // The drift: half a metre of regard or of yield, eased on its own clock.
    if (dt > 0) {
      this.scratch.set(ctx.diverPosition.x - POOL_X, 0, ctx.diverPosition.z - POOL_Z);
      const distance = this.scratch.length();
      this.driftTarget.set(0, 0, 0);
      if (distance > 1e-3) {
        if (ctx.diverSpeed < CALM_SPEED && distance < CALM_RANGE) {
          this.driftTarget.copy(this.scratch).normalize().multiplyScalar(DRIFT_METRES * (1 - distance / CALM_RANGE));
        } else if (ctx.diverSpeed > FAST_SPEED && distance < FAST_RANGE) {
          this.driftTarget.copy(this.scratch).normalize().multiplyScalar(-DRIFT_METRES * (1 - distance / FAST_RANGE));
        }
      }
      this.drift.lerp(this.driftTarget, 1 - Math.exp(-dt / DRIFT_TAU));
    }

    const cx = POOL_X + this.drift.x;
    const cz = POOL_Z + this.drift.z;
    const x = cx + CIRCLE_RADIUS * Math.cos(theta);
    const z = cz + CIRCLE_RADIUS * Math.sin(theta);
    const y = POOL_Y + 0.08 * Math.sin(ctx.time * 0.5) * calm;
    this.root.position.set(x, y, z);

    // CCW: the velocity is 90° left of the radius, and the body bends left —
    // positive yaw per joint — to lie along its own circle.
    const yaw = Math.atan2(-Math.sin(theta), Math.cos(theta));
    this.root.rotation.y = yaw;

    const wave = (ctx.time * Math.PI * 2) / WAVE_PERIOD;
    for (let i = 0; i < 5; i++) {
      this.angles[i] = CIRCLE_BEND + WAVE_AMP * calm * Math.sin(wave - i * WAVE_LAG);
    }
    // The ribbon answers the tail's angle late: its joints ease toward what
    // the peduncle did a moment ago, which is the whole language of silk.
    const tailAngle = this.angles[4]!;
    if (dt > 0) {
      const ease = 1 - Math.exp(-dt / RIBBON_TAU);
      this.ribbonLag[0]! += (tailAngle - this.ribbonLag[0]!) * ease;
      this.ribbonLag[1]! += (this.ribbonLag[0]! - this.ribbonLag[1]!) * ease;
    }
    this.angles[5] = this.ribbonLag[0]! + RIBBON_SWAY * calm * Math.sin(ctx.time * 0.4);
    this.angles[6] = this.ribbonLag[1]! + RIBBON_SWAY * calm * Math.sin(ctx.time * 0.4 - 1.3);
    this.rig.pose(this.angles);

    // The brow, in world space — focus follows the figure around the pool.
    this.target.position.set(
      x + HEAD_LOCAL_Z * Math.sin(yaw),
      y,
      z + HEAD_LOCAL_Z * Math.cos(yaw),
    );
  }

  dispose(): void {
    if (this.glbMesh) {
      this.glbMesh.removeFromParent();
      this.glbMesh.skeleton.dispose();
    }
    disposeSubtree(this.group);
    this.group.removeFromParent();
    this.group.clear();
  }

  /** The GLB landed: rebuild the skeleton and retire the stand-in. */
  private adoptModel(geometry: BufferGeometry): void {
    this.bodyMaterial.color = new Color(0xffffff);
    this.bodyMaterial.vertexColors = true;
    this.bodyMaterial.needsUpdate = true;

    const bones: Bone[] = [];
    const rootBone = new Bone();
    for (let i = 0; i < JOINTS.length; i++) {
      const joint = JOINTS[i]!;
      const bone = i === 0 ? rootBone : new Bone();
      bone.name = joint.name;
      if (i > 0) {
        // A chain, so a bend at the head carries the whole distal body: each
        // bone's position is relative to its parent's origin, and at the rest
        // pose (all rotations zero) the composed origins are the exported
        // ones — which is what makes the default bind exactly identity.
        const prev = JOINTS[i - 1]!.origin;
        bone.position.set(
          joint.origin[0] - prev[0],
          joint.origin[1] - prev[1],
          joint.origin[2] - prev[2],
        );
        const x = new Vector3(joint.x[0], joint.x[1], joint.x[2]);
        const y = new Vector3(joint.y[0], joint.y[1], joint.y[2]);
        const z = new Vector3().crossVectors(x, y);
        bone.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
        bones[i - 1]!.add(bone);
      }
      bones.push(bone);
    }

    // Explicit bounds: the ribbon trails outside any pose-inferred sphere.
    geometry.boundingSphere = new Sphere(new Vector3(0, 0, -0.6), 1.9);

    const mesh = new SkinnedMesh(geometry, this.bodyMaterial);
    mesh.add(rootBone);
    mesh.bind(new Skeleton(bones));
    this.root.add(mesh);
    this.glbMesh = mesh;

    const fallback = this.root.getObjectByName("koi-fallback");
    if (fallback) {
      fallback.removeFromParent();
      retireFallback(fallback as Group, this.bodyMaterial, this.ribbonMaterial);
    }

    const joints = bones.slice(1);
    this.rig = {
      pose: (angles) => {
        for (let i = 0; i < JOINT_COUNT; i++) {
          joints[i]!.rotation.y = angles[i]!;
        }
      },
    };
    this.rig.pose(this.angles);
  }
}

/**
 * The no-assets koi: seven nested pivots exactly where the GLB's bones stand,
 * each carrying a primitive segment, so the one bend driver poses either
 * body — the stand-in swims the same figure the sculpted one will.
 */
function buildFallbackKoi(bodyMaterial: Material, ribbonMaterial: Material): { rig: KoiRig; fallback: Group } {
  const fallback = new Group();
  fallback.name = "koi-fallback";

  const segmentGeometry = new SphereGeometry(1, 12, 8);
  const segmentScales = [
    [0.15, 0.19, 0.3],
    [0.17, 0.21, 0.32],
    [0.15, 0.2, 0.34],
    [0.1, 0.14, 0.3],
    [0.05, 0.08, 0.3],
  ] as const;
  const pivots: Group[] = [];
  let parent: Group = fallback;
  for (let i = 0; i < 5; i++) {
    const pivot = new Group();
    const here = JOINTS[i + 1]!.origin;
    const base = JOINTS[i]!.origin;
    pivot.position.set(here[0] - base[0], here[1] - base[1], here[2] - base[2]);
    parent.add(pivot);
    pivots.push(pivot);
    const segment = new Mesh(segmentGeometry, bodyMaterial);
    segment.scale.set(segmentScales[i]![0]!, segmentScales[i]![1]!, segmentScales[i]![2]!);
    segment.position.z = i === 0 ? 0.12 : -0.14;
    pivot.add(segment);
    parent = pivot;
  }

  const eyeMaterial = createToonMaterial({ color: 0x18245e });
  const eyeGeometry = new SphereGeometry(0.024, 8, 6);
  const head = pivots[0]!;
  for (const side of [-1, 1]) {
    const eye = new Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(side * 0.12, 0.05, 0.16);
    head.add(eye);
  }

  const ribbonGeometry = new BoxGeometry(0.015, 0.2, 0.62);
  ribbonGeometry.translate(0, 0, -0.3);
  for (let i = 5; i < JOINT_COUNT; i++) {
    const pivot = new Group();
    const here = JOINTS[i + 1]!.origin;
    const base = JOINTS[i]!.origin;
    pivot.position.set(here[0] - base[0], here[1] - base[1], here[2] - base[2]);
    const ribbon = new Mesh(ribbonGeometry, ribbonMaterial);
    ribbon.scale.set(1, 1 + 0.5 * (i - 4), 1);
    pivot.add(ribbon);
    parent.add(pivot);
    pivots.push(pivot);
    parent = pivot;
  }

  const rig: KoiRig = {
    pose: (angles) => {
      for (let i = 0; i < JOINT_COUNT; i++) {
        pivots[i]!.rotation.y = angles[i]!;
      }
    },
  };
  return { rig, fallback };
}

/** Releases the stand-in's own resources; the two shared materials stay. */
function retireFallback(fallback: Group, ...keep: Material[]): void {
  const seen = new Set<BufferGeometry | Material>();
  fallback.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }
    seen.add(node.geometry as BufferGeometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!keep.includes(material as Material)) {
        seen.add(material as Material);
      }
    }
  });
  for (const resource of seen) {
    resource.dispose();
  }
}
