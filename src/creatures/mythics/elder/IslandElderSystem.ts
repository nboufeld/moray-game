import {
  Group,
  Mesh,
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
import type { LifeContext, LifeSystem } from "../../life/LifeSystem";
import { ElderCircuit } from "./ElderCircuit";
import {
  OwnedResources,
  buildSkinnedMesh,
  retireFallback,
  type JointSpec,
} from "../leviathan/SkinnedBody";

/**
 * The Island That Swims: a turtle elder the size of a room, drifting beneath
 * the Sargassum Sky with a garden on its back.
 *
 * The visitor `Turtle`'s idiom at monument scale and a third of its pace:
 * a resident rather than a crosser, so its body is always on stage — the
 * transient-cost promise belongs to the leviathan; this one IS the place.
 * Its stroke is slower than anything else alive, and its head turns toward
 * a calm diver the way old things look at you: slowly, and all at once.
 *
 * Its discovery target rides the crown of its head, driven per frame.
 */

/** The stroke: one beat every six and a half seconds, back flippers trailing. */
const FLAP_HZ = 0.15;
const FRONT_FLAP = 0.3;
const BACK_FLAP = 0.16;
const BACK_LAG = 0.9;
const NOD = 0.04;

/** How the elder notices a diver: near, calm and unhurried. */
const NOTICE_RADIUS = 13;
const CALM_SPEED = 0.6;
/** Radians per second the gaze is allowed to travel — never sudden. */
const TURN_RATE = 0.55;
/** How far the head turns, at most. */
const MAX_YAW = 0.7;
const MAX_PITCH = 0.35;

/** The discovery point in model space: the crown of the head. */
const HEAD_POINT = new Vector3(0, 0.42, 2.85);

/**
 * The exported skin's joints, measured off `creature-island-turtle.glb` with
 * `inspect_creature.mjs`; order is the skin's joint order, and the axes are
 * the visitor turtle's idiom scaled up: `head`'s local +Y is model +X (the
 * nod), the flippers' local +Y is model +Z (the stroke's roll).
 */
const JOINTS: readonly JointSpec[] = [
  { name: "root", origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0] },
  { name: "head", origin: [0, 0.15, 2.1], x: [0, 0, 1], y: [1, 0, 0] },
  { name: "flipperFL", origin: [1.34, -0.06, 1.16], x: [-1, 0, 0], y: [0, 0, 1] },
  { name: "flipperFR", origin: [-1.34, -0.06, 1.16], x: [-1, 0, 0], y: [0, 0, 1] },
  { name: "flipperBL", origin: [1.06, -0.06, -1.35], x: [-1, 0, 0], y: [0, 0, 1] },
  { name: "flipperBR", origin: [-1.06, -0.06, -1.35], x: [-1, 0, 0], y: [0, 0, 1] },
];

/** One posable elder, whichever body it is wearing. */
interface ElderRig {
  /** front/back: + = flippers tip up on the left, mirrored on the right.
   * nod: + = head pitches down. yaw: + = head turns to its left. */
  pose(front: number, back: number, nod: number, yaw: number): void;
}

export class IslandElderSystem implements LifeSystem {
  readonly group = new Group();
  /** The discovery point; its position is driven per frame. */
  readonly target: DiscoveryTarget;
  /** The loop it walks, exposed for the geometry tests. */
  readonly circuit: ElderCircuit;

  private readonly root = new Group();
  private readonly resources = new OwnedResources();
  private elapsed = 0;

  private rig: ElderRig;
  private fallback: Group | null = null;
  /** Plain olive until the GLB's `COLOR_0` arrives — see the leviathan's
   * note about `vertexColors` over a missing attribute rendering black. */
  private readonly bodyMaterial = this.resources.own(createToonMaterial({ color: 0x77713f }));

  private gazeYaw = 0;
  private gazePitch = 0;
  private readonly scratch = new Vector3();
  private readonly headScratch = new Vector3();
  private readonly diverLocal = new Vector3();

  constructor(readonly seed: number = SEEDS.mythElder) {
    this.group.name = "island-that-swims";
    this.root.name = "island-that-swims-body";
    this.target = { speciesId: "myth-island-that-swims", position: new Vector3() };

    // The circuit is the construction's only draw; the GLB arriving later
    // re-rolls nothing.
    this.circuit = new ElderCircuit(new Random(seed));

    const { fallback, rig } = this.buildFallback();
    this.fallback = fallback;
    this.rig = rig;
    this.root.add(fallback);
    this.group.add(this.root);

    requestModel("models/creature-island-turtle.glb", (geometry) => this.adoptModel(geometry));

    // Park the target somewhere sensible until the first update places it.
    this.circuit.positionAt(0, this.root.position);
    this.target.position.copy(this.root.position);
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }

  update(dt: number, ctx: LifeContext): void {
    this.elapsed += dt;
    const s = this.elapsed / this.circuit.duration;

    this.circuit.positionAt(s, this.root.position);
    this.circuit.tangentAt(s, this.scratch);
    const horizontal = Math.hypot(this.scratch.x, this.scratch.z);
    this.root.rotation.set(
      -Math.atan2(this.scratch.y, horizontal),
      Math.atan2(this.scratch.x, this.scratch.z),
      0,
      "YXZ",
    );

    const calm = ctx.reducedMotion ? 0.6 : 1;
    const beat = this.elapsed * FLAP_HZ * Math.PI * 2;
    const nod = Math.sin(this.elapsed * 0.22) * NOD;

    this.updateGaze(dt, ctx);
    this.rig.pose(
      Math.sin(beat) * FRONT_FLAP * calm,
      Math.sin(beat - BACK_LAG) * BACK_FLAP * calm,
      nod + this.gazePitch,
      this.gazeYaw,
    );

    this.headScratch.copy(HEAD_POINT).applyQuaternion(this.root.quaternion).add(this.root.position);
    this.target.position.copy(this.headScratch);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
    this.resources.disposeAll();
  }

  /**
   * The head turns toward a calm diver: a slow, rate-limited gaze that also
   * slowly lets go. Reduced motion halves the travel, and the gaze is the
   * only thing about the elder that can hurry at all.
   */
  private updateGaze(dt: number, ctx: LifeContext): void {
    let wantYaw = 0;
    let wantPitch = 0;
    const distance = this.root.position.distanceTo(ctx.diverPosition);
    if (distance < NOTICE_RADIUS && ctx.diverSpeed < CALM_SPEED) {
      // The diver in the elder's frame: undo the body's yaw so "toward the
      // diver" is a head angle, not a world angle.
      this.diverLocal.copy(ctx.diverPosition).sub(this.root.position);
      const bodyYaw = this.root.rotation.y;
      const dx = Math.cos(bodyYaw) * this.diverLocal.x - Math.sin(bodyYaw) * this.diverLocal.z;
      const dz = Math.sin(bodyYaw) * this.diverLocal.x + Math.cos(bodyYaw) * this.diverLocal.z;
      wantYaw = Math.atan2(dx, dz);
      wantYaw = Math.min(MAX_YAW, Math.max(-MAX_YAW, wantYaw));
      const flat = Math.hypot(dx, dz);
      // Negative nod looks up: +θ about the head's own Y pitches it down.
      wantPitch = -Math.atan2(this.diverLocal.y - 0.4, Math.max(flat, 1e-3));
      wantPitch = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, wantPitch));
    }
    const rate = TURN_RATE * (ctx.reducedMotion ? 0.5 : 1) * dt;
    this.gazeYaw += Math.min(rate, Math.abs(wantYaw - this.gazeYaw)) * Math.sign(wantYaw - this.gazeYaw);
    this.gazePitch +=
      Math.min(rate, Math.abs(wantPitch - this.gazePitch)) * Math.sign(wantPitch - this.gazePitch);
  }

  /** The GLB landed: rebuild the skeleton and retire the stand-in. */
  private adoptModel(geometry: BufferGeometry): void {
    this.bodyMaterial.color.set(0xffffff);
    this.bodyMaterial.vertexColors = true;
    this.bodyMaterial.needsUpdate = true;

    const { mesh, bones } = buildSkinnedMesh(
      geometry,
      JOINTS,
      this.bodyMaterial,
      new Sphere(new Vector3(0, 0.3, 0.2), 3.9),
    );
    this.root.add(mesh);

    if (this.fallback) {
      this.root.remove(this.fallback);
      retireFallback(this.fallback, [this.bodyMaterial], (r) => this.resources.disposeOwned(r));
      this.fallback = null;
    }

    const head = bones[1]!;
    const flippers = [bones[2]!, bones[3]!, bones[4]!, bones[5]!];
    this.rig = {
      pose: (front, back, nod, yaw) => {
        // FR/BR mirror: the export does not sign-correct left and right.
        flippers[0]!.rotation.y = front;
        flippers[1]!.rotation.y = -front;
        flippers[2]!.rotation.y = back;
        flippers[3]!.rotation.y = -back;
        // The nod is about the bone's +Y (model +X); the yaw about its +Z
        // (model +Y). At these angles the composition order is invisible.
        head.rotation.y = nod;
        head.rotation.z = yaw;
      },
    };
  }

  /**
   * The no-assets elder: the measured silhouette out of primitives in the
   * authored palette — shell, garden and all — with pivot groups standing
   * exactly where the GLB's joints stand.
   */
  private buildFallback(): { fallback: Group; rig: ElderRig } {
    const own = <T extends BufferGeometry | Material>(r: T): T => this.resources.own(r);
    const fallback = new Group();
    fallback.name = "island-elder-fallback";

    const olive = this.bodyMaterial;
    const cream = own(createToonMaterial({ color: 0xcfc191 }));
    const sage = own(createToonMaterial({ color: 0x8b945e }));
    const moss = own(createToonMaterial({ color: 0x668542 }));
    const rose = own(createToonMaterial({ color: 0xcc7060 }));

    const carapace = new Mesh(own(new SphereGeometry(1, 16, 12)), olive);
    carapace.scale.set(1.62, 0.62, 2.3);
    carapace.position.y = 0.35;
    fallback.add(carapace);

    const plastron = new Mesh(own(new SphereGeometry(1, 12, 8)), cream);
    plastron.scale.set(1.28, 0.28, 1.85);
    plastron.position.set(0, -0.08, 0.06);
    fallback.add(plastron);

    // The garden, in primitives: moss mats as flattened domes, coral knobs
    // as small rose studs, all sitting on the dome.
    const matGeometry = own(new SphereGeometry(1, 8, 5));
    const mats: readonly (readonly [number, number, number, number])[] = [
      [0.55, 0.98, 0.6, 0.3],
      [-0.7, 0.95, 0.2, 0.34],
      [0.1, 1.02, -0.7, 0.36],
      [-0.45, 0.9, -1.3, 0.26],
      [0.75, 0.88, -0.5, 0.24],
    ];
    for (const [x, y, z, r] of mats) {
      const mat = new Mesh(matGeometry, moss);
      mat.scale.set(r, r * 0.3, r);
      mat.position.set(x, y, z);
      fallback.add(mat);
    }
    const knobGeometry = own(new SphereGeometry(1, 6, 5));
    const knobs: readonly (readonly [number, number, number, number])[] = [
      [0.2, 1.05, 1.0, 0.09],
      [-0.3, 1.02, 0.8, 0.11],
      [0.85, 0.9, 0.1, 0.08],
      [-0.85, 0.88, -0.4, 0.1],
      [0.4, 0.98, -1.2, 0.09],
      [-0.1, 1.06, -0.2, 0.08],
    ];
    for (const [x, y, z, r] of knobs) {
      const knob = new Mesh(knobGeometry, rose);
      knob.scale.set(r, r * 1.6, r);
      knob.position.set(x, y, z);
      fallback.add(knob);
    }

    const headPivot = new Group();
    headPivot.position.set(0, 0.15, 2.1);
    const skull = new Mesh(own(new SphereGeometry(0.34, 10, 8)), sage);
    skull.scale.set(1, 0.9, 1.35);
    skull.position.set(0, 0.16, 0.62);
    headPivot.add(skull);
    const neck = new Mesh(own(new SphereGeometry(0.26, 8, 6)), sage);
    neck.scale.set(1, 0.95, 1.5);
    neck.position.set(0, 0.02, 0.1);
    headPivot.add(neck);
    fallback.add(headPivot);

    const flipperGeometry = own(new SphereGeometry(1, 8, 6));
    const makeFlipper = (x: number, z: number, length: number): Group => {
      const pivot = new Group();
      pivot.position.set(x, -0.06, z);
      const blade = new Mesh(flipperGeometry, sage);
      blade.scale.set(length, 0.09, 0.42);
      blade.position.x = Math.sign(x) * length * 0.85;
      blade.rotation.y = Math.sign(x) * -0.35;
      pivot.add(blade);
      fallback.add(pivot);
      return pivot;
    };
    const fl = makeFlipper(1.34, 1.16, 1.1);
    const fr = makeFlipper(-1.34, 1.16, 1.1);
    const bl = makeFlipper(1.06, -1.35, 0.65);
    const br = makeFlipper(-1.06, -1.35, 0.65);

    const tail = new Mesh(own(new SphereGeometry(0.16, 6, 5)), sage);
    tail.scale.set(1, 0.8, 2);
    tail.position.set(0, -0.05, -2.35);
    fallback.add(tail);

    const rig: ElderRig = {
      pose: (front, back, nod, yaw) => {
        fl.rotation.z = front;
        fr.rotation.z = -front;
        bl.rotation.z = back;
        br.rotation.z = -back;
        headPivot.rotation.x = nod;
        headPivot.rotation.y = yaw;
      },
    };
    return { fallback, rig };
  }
}
