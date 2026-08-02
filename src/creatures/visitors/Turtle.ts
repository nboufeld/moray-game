import {
  Bone,
  Matrix4,
  Skeleton,
  SkinnedMesh,
  Sphere,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";
import { Group, Mesh } from "three";
import { requestAlbedo, requestModel } from "../../rendering/AssetLibrary";
import { createToonMaterial } from "../../rendering/ToonShading";
import { Random, SEEDS } from "../../util/Random";
import type { LifeContext } from "../life/LifeSystem";
import { VisitorBase } from "./VisitorBase";
import { playVisitorEvent } from "./VisitorDirector";
import { BankedArc } from "./VisitorPath";

/**
 * The whole animal, scaled up a quarter past the model's 1.40 m carapace to a
 * 1.75 m shell: "big and beautiful" is the brief, the biggest real green
 * turtles reach 1.5 m, and at the eight metres the canonical crossing passes
 * the camera the extra quarter is presence rather than caricature.
 */
const TURTLE_SCALE = 1.25;

/** Pre-rolled crossings; each pass takes the next, so a dive sees variety. */
const ARC_COUNT = 4;
const ARC_RANGES = {
  entryRadius: 27,
  heightMin: 4.0,
  heightMax: 6.2,
  bow: 10,
  speed: 0.95,
  bank: 0.38,
} as const;

/** A slow, deliberate stroke — a third of a hertz, nothing like a fish. */
const FLAP_HZ = 0.34;
const FRONT_FLAP = 0.42;
const BACK_FLAP = 0.22;
/** The back pair trails the front, which is what reads as swimming. */
const BACK_LAG = 0.9;
const NOD = 0.055;

/** The glide swell: re-fired while near, gain falling away with distance. */
const AUDIO_RANGE = 20;
const AUDIO_PERIOD = 2.8;

/**
 * The exported skin's joints, measured off the GLB and written down in
 * `public/assets/models/CREATURES.md`; order is the skin's joint order, which
 * `JOINTS_0` indexes into and therefore must not be shuffled. Each basis maps
 * the bone's local axes into model space — a bone rotates about its own local
 * +Y, so `rotation.y` on the built bone is exactly the documented motion.
 */
const JOINTS = [
  { name: "root", origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0] },
  { name: "head", origin: [0, 0.045, 0.66], x: [0, 0, 1], y: [1, 0, 0] },
  { name: "flipperFL", origin: [0.42, -0.02, 0.36], x: [-1, 0, 0], y: [0, 0, 1] },
  { name: "flipperFR", origin: [-0.42, -0.02, 0.36], x: [-1, 0, 0], y: [0, 0, 1] },
  { name: "flipperBL", origin: [0.33, -0.02, -0.42], x: [-1, 0, 0], y: [0, 0, 1] },
  { name: "flipperBR", origin: [-0.33, -0.02, -0.42], x: [-1, 0, 0], y: [0, 0, 1] },
] as const;

/** One posable turtle, whichever body it is wearing. */
interface TurtleRig {
  /** +front/back = flippers tip up on the left, mirrored on the right. */
  pose(front: number, back: number, nod: number): void;
}

/**
 * The hero visitor: a green turtle on a long banked arc across the reef bowl.
 *
 * The body is `creature-turtle.glb` wearing `turtle-shell.png`, with the
 * skeleton rebuilt here from the measured joint contract — `requestModel`
 * delivers bare geometry (the skin attributes ride along in `skinIndex` and
 * `skinWeight`), and binding freshly built bones in the documented rest pose
 * makes the skinning exactly identity until a bone moves. With no `public/`
 * directory at all it is a primitive-built stand-in with the same pivots, so
 * the same stroke drives both.
 */
export class Turtle extends VisitorBase {
  private readonly arcs: BankedArc[] = [];
  private passIndex = 0;
  private arc: BankedArc;

  private rig: TurtleRig;
  private fallback: Group | null = null;
  /**
   * Starts as a plain olive: the stand-in's spheres carry no colour attribute,
   * and `vertexColors: true` over a missing attribute renders black (the same
   * trap `weatherRock`'s note documents). The GLB's arrival turns the vertex
   * colours on; the painting's arrival turns them off again — CREATURES.md's
   * double-tint warning — and whichever lands last wins consistently because
   * the map, once set, always takes precedence.
   */
  private readonly bodyMaterial = this.own(createToonMaterial({ color: 0x6f7a4f }));
  private mapArrived = false;

  private audioCountdown = 0;
  private readonly scratch = new Vector3();

  constructor(seed: number = SEEDS.visitors) {
    super("turtle", seed, "turtle");
    // The path stream is its own seed: re-tuning the schedule's cadence must
    // never re-roll where the turtle swims.
    const pathRandom = new Random(SEEDS.turtlePath);
    for (let i = 0; i < ARC_COUNT; i++) {
      this.arcs.push(new BankedArc(pathRandom, ARC_RANGES));
    }
    this.arc = this.arcs[0]!;

    const { fallback, rig } = buildFallbackTurtle(this.bodyMaterial, (r) => this.own(r));
    this.fallback = fallback;
    this.rig = rig;
    this.root.add(fallback);
    this.root.scale.setScalar(TURTLE_SCALE);

    requestModel("models/creature-turtle.glb", (geometry) => this.adoptModel(geometry));
    requestAlbedo("creatures/turtle-shell.png", (texture) => {
      // The trap CREATURES.md documents: the mesh carries vertex colours that
      // approximate this very painting, and multiplying the two squares the
      // value down. The map replaces them outright.
      this.mapArrived = true;
      this.bodyMaterial.map = texture;
      this.bodyMaterial.vertexColors = false;
      this.bodyMaterial.color.set(0xffffff);
      this.bodyMaterial.needsUpdate = true;
    });
  }

  protected override onPassStarted(): void {
    this.arc = this.arcs[this.passIndex % this.arcs.length]!;
    this.passIndex++;
    this.audioCountdown = 0.5;
  }

  protected advancePass(dt: number, ctx: LifeContext): void {
    const s = this.passTime / this.arc.duration;
    if (s >= 1) {
      this.endPass();
      return;
    }

    this.arc.positionAt(s, this.root.position);
    this.arc.tangentAt(s, this.scratch);
    const horizontal = Math.hypot(this.scratch.x, this.scratch.z);
    this.root.rotation.set(
      -Math.atan2(this.scratch.y, horizontal),
      Math.atan2(this.scratch.x, this.scratch.z),
      this.arc.bankAt(s) * (ctx.reducedMotion ? 0.5 : 1),
      "YXZ",
    );

    const calm = ctx.reducedMotion ? 0.6 : 1;
    const beat = this.passTime * FLAP_HZ * Math.PI * 2;
    this.rig.pose(
      Math.sin(beat) * FRONT_FLAP * calm,
      Math.sin(beat - BACK_LAG) * BACK_FLAP * calm,
      Math.sin(this.passTime * 0.3) * NOD,
    );

    this.audioCountdown -= dt;
    if (this.audioCountdown <= 0) {
      this.audioCountdown = AUDIO_PERIOD;
      const distance = this.root.position.distanceTo(ctx.diverPosition);
      if (distance < AUDIO_RANGE) {
        playVisitorEvent("turtle-glide", 1 - distance / AUDIO_RANGE);
      }
    }
  }

  /** The GLB landed: rebuild the skeleton and retire the stand-in. */
  private adoptModel(geometry: BufferGeometry): void {
    // The real mesh brings `COLOR_0`; wear it unless the painting is already
    // on, and stop tinting either way — the olive was the stand-in's.
    this.bodyMaterial.color.set(0xffffff);
    if (!this.mapArrived) {
      this.bodyMaterial.vertexColors = true;
    }
    this.bodyMaterial.needsUpdate = true;

    const bones: Bone[] = [];
    const rootBone = new Bone();
    for (const joint of JOINTS) {
      const bone = joint.name === "root" ? rootBone : new Bone();
      bone.name = joint.name;
      if (bone !== rootBone) {
        bone.position.set(joint.origin[0], joint.origin[1], joint.origin[2]);
        const x = new Vector3(...joint.x);
        const y = new Vector3(...joint.y);
        const z = new Vector3().crossVectors(x, y);
        bone.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
        rootBone.add(bone);
      }
      bones.push(bone);
    }

    // Three bounds a skinned mesh from whichever pose the bones are in at the
    // first render and never again; an explicit sphere with flap headroom is
    // what keeps a mid-stroke turtle from being culled with its tips outside.
    geometry.boundingSphere = new Sphere(new Vector3(0, 0.1, 0.1), 1.7);

    const mesh = new SkinnedMesh(geometry, this.bodyMaterial);
    mesh.add(rootBone);
    // Bones sit in the documented rest pose, so the default bind is identity.
    mesh.bind(new Skeleton(bones));
    this.root.add(mesh);

    if (this.fallback) {
      this.root.remove(this.fallback);
      retireFallback(this.fallback, this.bodyMaterial, (r) => this.disposeOwned(r));
      this.fallback = null;
    }

    const head = bones[1]!;
    const flippers = [bones[2]!, bones[3]!, bones[4]!, bones[5]!];
    this.rig = {
      pose: (front, back, nod) => {
        // FR/BR mirror: the export does not sign-correct left and right.
        flippers[0]!.rotation.y = front;
        flippers[1]!.rotation.y = -front;
        flippers[2]!.rotation.y = back;
        flippers[3]!.rotation.y = -back;
        head.rotation.y = nod;
      },
    };
  }
}

/**
 * The no-assets turtle: the measured silhouette out of squashed spheres, with
 * pivot groups standing where the GLB's joints stand so the one stroke in
 * `advancePass` drives either body.
 */
function buildFallbackTurtle(
  shellMaterial: Material,
  own: <T extends BufferGeometry | Material>(r: T) => T,
): { fallback: Group; rig: TurtleRig } {
  const fallback = new Group();
  fallback.name = "turtle-fallback";

  const skin = own(createToonMaterial({ color: 0x8a9668 }));
  const cream = own(createToonMaterial({ color: 0xd9cda8 }));

  const carapace = new Mesh(own(new SphereGeometry(1, 12, 9)), shellMaterial);
  carapace.scale.set(0.51, 0.2, 0.72);
  carapace.position.y = 0.12;
  fallback.add(carapace);

  const plastron = new Mesh(own(new SphereGeometry(1, 10, 7)), cream);
  plastron.scale.set(0.4, 0.09, 0.58);
  plastron.position.set(0, -0.03, 0.02);
  fallback.add(plastron);

  const headPivot = new Group();
  headPivot.position.set(0, 0.045, 0.66);
  const head = new Mesh(own(new SphereGeometry(0.12, 8, 6)), skin);
  head.scale.set(1, 0.9, 1.4);
  head.position.z = 0.06;
  headPivot.add(head);
  fallback.add(headPivot);

  const flipperGeometry = own(new SphereGeometry(1, 8, 6));
  const makeFlipper = (x: number, z: number, length: number): Group => {
    const pivot = new Group();
    pivot.position.set(x, -0.02, z);
    const blade = new Mesh(flipperGeometry, skin);
    blade.scale.set(length, 0.03, 0.13);
    blade.position.x = Math.sign(x) * length * 0.85;
    blade.rotation.y = Math.sign(x) * -0.35;
    pivot.add(blade);
    fallback.add(pivot);
    return pivot;
  };
  const fl = makeFlipper(0.42, 0.36, 0.34);
  const fr = makeFlipper(-0.42, 0.36, 0.34);
  const bl = makeFlipper(0.33, -0.42, 0.2);
  const br = makeFlipper(-0.33, -0.42, 0.2);

  const rig: TurtleRig = {
    pose: (front, back, nod) => {
      fl.rotation.z = front;
      fr.rotation.z = -front;
      bl.rotation.z = back;
      br.rotation.z = -back;
      headPivot.rotation.x = nod;
    },
  };
  return { fallback, rig };
}

/** Releases the stand-in's own resources; the shared shell material stays. */
function retireFallback(
  fallback: Object3D,
  shellMaterial: Material,
  disposeOwned: (r: BufferGeometry | Material) => void,
): void {
  const seen = new Set<BufferGeometry | Material>();
  fallback.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }
    seen.add(node.geometry as BufferGeometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material !== shellMaterial) {
        seen.add(material as Material);
      }
    }
  });
  for (const resource of seen) {
    disposeOwned(resource);
  }
}
