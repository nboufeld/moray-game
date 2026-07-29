import {
  Bone,
  Color,
  ConeGeometry,
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
import { GLASS_COVE } from "../../../world/wings/defs/GlassCove";
import { wingTarget } from "../../../world/wings/WingGeometry";
import type { LifeContext, LifeSystem } from "../../life/LifeSystem";
import {
  MorayPresence,
  type PresenceStyle,
  type PresencePose,
} from "../../morays/MorayPresence";

/**
 * The Kraken Hatchling — a shy octopus child denned in the Sea-Glass Cove's
 * pebble drifts, and the moray presence cycle re-expressed at half a metre.
 *
 * It is literally the same machine (`MorayPresence` with a shy, curious
 * style): it peeks from its den, extends to explore the nearby pebbles —
 * arms curling and uncurling through the exported arm joints — startles at a
 * fast approach (blanching to its pale tint set and darting back), and leans
 * with calm curiosity toward a slow one. The den anchor never moves; what
 * the machine decides each frame is how far along the den axis the animal
 * stands and what its arms are doing.
 *
 * The blanch is the octopus's own trick stated for a multiply-only material:
 * the GLB is authored in its *pale* set, the calm body is that set tinted
 * down to dusty rose, and a startle is the tint easing back to white — the
 * authored pale reads through.
 */

/** The den: r ≈ 40 on the cove's axis, among the glass-pebble drifts. */
const DEN_RADIUS = 40;
const DEN_X = DEN_RADIUS * Math.cos(GLASS_COVE.azimuth);
const DEN_Z = DEN_RADIUS * Math.sin(GLASS_COVE.azimuth);
const DEN_FLOOR_Y = wingTarget(GLASS_COVE, DEN_X, DEN_Z);
/** The presence anchor: the mantle's rest centre, peeking out of the den. */
const ANCHOR_Y = DEN_FLOOR_Y + 0.34;

/** Out of the den toward the gate, tilted gently up — the peeking direction. */
const AXIS = new Vector3(-Math.cos(GLASS_COVE.azimuth), 0.22, -Math.sin(GLASS_COVE.azimuth)).normalize();
/** The presence machine's metres are a moray's; the hatchling's are shorter. */
const OFFSET_SCALE = 0.7;

/** Where the discovery target rides, in model space: the mantle's crown. */
const MANTLE_LOCAL = new Vector3(0, 0.3, 0.08);

/**
 * The exported skin's arm joints, measured off the GLB with
 * `inspect_creature.mjs` (contract in the wave-8 ledger). Arm `i` stands at
 * 22.5° + 45°i around the mantle rim (r 0.16); each bone's local +Y is its
 * rim tangent, so a positive `rotation.y` curls the arm's tip up toward the
 * mantle. The local +X is the export's own roll — a basis is rebuilt from
 * both, so it must match exactly. Order is the skin's joint order and must
 * not be shuffled.
 */
const ARM_COUNT = 8;
const ARM_ROOT_RADIUS = 0.16;
const ARM_ROOT_Y = 0.02;
const JOINTS = (() => {
  const joints = [{ name: "root", origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0] }];
  for (let i = 0; i < ARM_COUNT; i++) {
    const theta = ((22.5 + 45 * i) * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    joints.push({
      name: `arm${i}`,
      origin: [ARM_ROOT_RADIUS * cos, ARM_ROOT_Y, -ARM_ROOT_RADIUS * sin],
      x: [-cos, 0, sin],
      y: [sin, 0, cos],
    });
  }
  return joints as readonly { name: string; origin: readonly number[]; x: readonly number[]; y: readonly number[] }[];
})();

/** Arm curl, radians about each bone's own +Y: 0 poured out, 1 balled up. */
const CURL_EXPLORE = 0.3;
const CURL_PEEK = 0.55;
const CURL_TUCK = 0.95;
const CURL_JET = 1.15;
const CURL_MAX = 1.2;

/** The two tint sets: dusty rose over the authored pale, and the pale itself. */
const ROSE_TINT = new Color(0.8, 0.56, 0.56);
const PALE_TINT = new Color(1, 1, 1);

/** The hatchling's personality: shy on the way in, curious once trusted. */
const KRAKEN_PRESENCE_STYLE: PresenceStyle = {
  boldness: { min: 0.2, max: 0.65 },
  wariness: { min: 0.55, max: 1 },
  curiosity: { min: 0.45, max: 1 },
  tuckedHoldScale: 0.65,
  peekingHoldScale: 0.7,
  extendedHoldScale: 0.85,
  clockSpread: 1,
  extendChanceScale: 0.9,
  reachScale: 0.9,
  startleSpeedScale: 0.85,
  startleHoldScale: 0.8,
  startleTauScale: 0.8,
  waryEmergeScale: 1,
  emergeTauScale: 0.8,
  retreatTauScale: 0.7,
};

/** One posable hatchling, whichever body it is wearing. */
interface KrakenRig {
  /** Sets the eight arms' curl (0 spread, ~1.2 balled under the mantle). */
  setCurls(curls: readonly number[]): void;
}

export class KrakenHatchlingSystem implements LifeSystem {
  readonly group = new Group();
  readonly target: DiscoveryTarget;
  readonly targets: readonly DiscoveryTarget[];

  private readonly presence = new MorayPresence(SEEDS.mythKraken, KRAKEN_PRESENCE_STYLE);
  private readonly root = new Group();
  private readonly bodyMaterial = createToonMaterial({ color: ROSE_TINT.clone() });

  /** Per-arm wave phases and the pebble dressing, from substreams. */
  private readonly armPhases: number[] = [];
  private readonly curls = new Array<number>(ARM_COUNT).fill(CURL_PEEK);
  private rig: KrakenRig;
  private glbMesh: SkinnedMesh | null = null;
  /** 0 calm rose, 1 blanched pale; eased on its own clock. */
  private pale = 0;

  private readonly scratch = new Vector3();
  private readonly tintScratch = new Color();

  constructor() {
    this.group.name = "myth-kraken-hatchling";
    this.root.name = "kraken-hatchling-body";
    this.group.add(this.root);

    // Facing out of the den, along the axis the presence cycle slides on.
    this.root.rotation.y = Math.atan2(AXIS.x, AXIS.z);
    this.root.position.set(DEN_X, ANCHOR_Y, DEN_Z);

    const phaseRandom = new Random(SEEDS.mythKraken ^ 0xa235);
    for (let i = 0; i < ARM_COUNT; i++) {
      this.armPhases.push(phaseRandom.range(0, Math.PI * 2));
    }

    const { rig, fallback } = buildFallbackKraken(this.bodyMaterial, this.curls);
    this.rig = rig;
    this.root.add(fallback);
    this.dressDen();

    this.target = { speciesId: "myth-kraken-hatchling", position: new Vector3(DEN_X, ANCHOR_Y + 0.3, DEN_Z) };
    this.targets = [this.target];

    requestModel("models/creature-kraken-hatchling.glb", (geometry) => this.adoptModel(geometry));
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }

  /** The presence pose of the last update, for the tests. */
  get presenceState(): PresencePose["state"] {
    return this.presence.state;
  }

  /** 0 calm rose, 1 blanched pale — the tests' window on the tint set. */
  get blanchAmount(): number {
    return this.pale;
  }

  update(dt: number, ctx: LifeContext): void {
    this.scratch.set(DEN_X, ANCHOR_Y, DEN_Z).sub(ctx.diverPosition);
    const pose = this.presence.update(dt, {
      distance: this.scratch.length(),
      diverSpeed: ctx.diverSpeed,
      reducedMotion: ctx.reducedMotion,
    });

    // Along the den axis: out to the pebbles, back into the mound's shadow.
    this.root.position.set(DEN_X, ANCHOR_Y, DEN_Z).addScaledVector(AXIS, pose.offset * OFFSET_SCALE);

    // The blanch runs on its own ease — fast to pale, slow to trust again.
    const blanched = pose.state === "startled";
    const paleTau = blanched ? 0.15 : 2.2;
    this.pale += ((blanched ? 1 : 0) - this.pale) * (1 - Math.exp(-dt / paleTau));
    // Chromatophores: a calm, engaged animal shimmers a few percent around
    // its set; a blanched one is flat — fear has no pattern.
    const shimmer = 1 + 0.045 * Math.sin(ctx.time * 1.4) * (1 - this.pale) * (0.3 + 0.7 * pose.curiosity);
    this.tintScratch.copy(ROSE_TINT).lerp(PALE_TINT, this.pale).multiplyScalar(shimmer);
    this.bodyMaterial.color.copy(this.tintScratch);

    // The arms: a base curl per state, plus each arm's own slow wave when
    // the animal is showing itself. Curiosity opens them toward the diver.
    const motion = ctx.reducedMotion ? 0.5 : 1;
    const base =
      pose.state === "startled"
        ? CURL_JET
        : pose.state === "tucked"
          ? CURL_TUCK
          : pose.state === "extended"
            ? CURL_EXPLORE - 0.12 * pose.curiosity
            : CURL_PEEK - 0.1 * pose.curiosity;
    const waveAmp = (pose.state === "extended" ? 0.22 : 0.08) * motion;
    const tau = pose.state === "startled" ? 0.1 : 0.45;
    const ease = 1 - Math.exp(-dt / tau);
    for (let i = 0; i < ARM_COUNT; i++) {
      const wave = waveAmp * Math.sin(ctx.time * 1.6 + this.armPhases[i]!);
      const target = Math.max(0, Math.min(CURL_MAX, base + wave));
      this.curls[i]! += (target - this.curls[i]!) * ease;
    }
    this.rig.setCurls(this.curls);

    // The target rides the mantle — in reach whenever the animal shows itself.
    this.target.position.set(
      this.root.position.x + MANTLE_LOCAL.z * Math.sin(this.root.rotation.y),
      this.root.position.y + MANTLE_LOCAL.y,
      this.root.position.z + MANTLE_LOCAL.z * Math.cos(this.root.rotation.y),
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

  /** The glass-pebble drift the den is hollowed out of: readable primitives. */
  private dressDen(): void {
    const dressing = new Group();
    dressing.name = "kraken-den";
    const palette = [0x9fd8d2, 0xe8b7c3, 0xb9d9e8, 0xd9e6c9].map((c) => createToonMaterial({ color: c }));
    const random = new Random(SEEDS.mythKraken ^ 0xde1f);
    const geometry = new SphereGeometry(1, 8, 6);
    for (let i = 0; i < 11; i++) {
      // The mouth sector (toward the axis) stays open; the pebbles bank the
      // sides and the back of the hollow.
      const angle = random.range(Math.PI * 0.55, Math.PI * 1.45) + Math.atan2(AXIS.z, AXIS.x);
      const radius = random.range(0.4, 0.72);
      const pebble = new Mesh(geometry, palette[i % palette.length]!);
      const size = random.range(0.1, 0.24);
      pebble.scale.set(size, size * random.range(0.5, 0.75), size);
      pebble.position.set(
        DEN_X + Math.cos(angle) * radius,
        DEN_FLOOR_Y + size * 0.25,
        DEN_Z + Math.sin(angle) * radius,
      );
      pebble.rotation.y = random.range(0, Math.PI);
      dressing.add(pebble);
    }
    this.group.add(dressing);
  }

  /** The GLB landed: rebuild the skeleton and retire the stand-in. */
  private adoptModel(geometry: BufferGeometry): void {
    // The real mesh brings `COLOR_0` authored in the pale set; the frame's
    // own tint (written every update) is what keys the animal rose or pale.
    this.bodyMaterial.vertexColors = true;
    this.bodyMaterial.needsUpdate = true;

    const bones: Bone[] = [];
    const rootBone = new Bone();
    for (const joint of JOINTS) {
      const bone = joint.name === "root" ? rootBone : new Bone();
      bone.name = joint.name;
      if (bone !== rootBone) {
        bone.position.set(joint.origin[0]!, joint.origin[1]!, joint.origin[2]!);
        const x = new Vector3(joint.x[0]!, joint.x[1]!, joint.x[2]!);
        const y = new Vector3(joint.y[0]!, joint.y[1]!, joint.y[2]!);
        const z = new Vector3().crossVectors(x, y);
        bone.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
        rootBone.add(bone);
      }
      bones.push(bone);
    }

    // Explicit bounds: the arms wave outside any pose three could infer.
    geometry.boundingSphere = new Sphere(new Vector3(0, 0.05, 0.1), 1.35);

    const mesh = new SkinnedMesh(geometry, this.bodyMaterial);
    mesh.add(rootBone);
    mesh.bind(new Skeleton(bones));
    this.root.add(mesh);
    this.glbMesh = mesh;

    const fallback = this.root.getObjectByName("kraken-fallback");
    if (fallback) {
      fallback.removeFromParent();
      retireFallback(fallback as Group, this.bodyMaterial);
    }

    const arms = bones.slice(1);
    this.rig = {
      setCurls: (curls) => {
        for (let i = 0; i < ARM_COUNT; i++) {
          arms[i]!.rotation.y = curls[i]!;
        }
      },
    };
    this.rig.setCurls(this.curls);
  }
}

/** The no-assets hatchling: a mantle bulb, bead eyes and eight curling cones. */
function buildFallbackKraken(
  bodyMaterial: Material,
  initialCurls: readonly number[],
): { rig: KrakenRig; fallback: Group } {
  const fallback = new Group();
  fallback.name = "kraken-fallback";

  const mantle = new Mesh(new SphereGeometry(1, 14, 10), bodyMaterial);
  mantle.scale.set(0.2, 0.26, 0.21);
  mantle.position.y = 0.24;
  fallback.add(mantle);

  const eyeMaterial = createToonMaterial({ color: 0x241418 });
  const eyeGeometry = new SphereGeometry(0.028, 8, 6);
  for (const side of [-1, 1]) {
    const eye = new Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(side * 0.1, 0.18, 0.17);
    fallback.add(eye);
  }

  // The arm pivots stand where the GLB's bones stand and turn about the same
  // tangent axes, so the one curl driver poses either body.
  const armGeometry = new ConeGeometry(0.042, 0.8, 6);
  armGeometry.translate(0, 0.4, 0);
  const arms: { axis: Vector3; pivot: Group }[] = [];
  for (let i = 0; i < ARM_COUNT; i++) {
    const theta = ((22.5 + 45 * i) * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const pivot = new Group();
    pivot.position.set(ARM_ROOT_RADIUS * cos, ARM_ROOT_Y, -ARM_ROOT_RADIUS * sin);
    const cone = new Mesh(armGeometry, bodyMaterial);
    // Laid along the arm's outward-down direction inside the pivot; the curl
    // is the pivot's own rotation about the rim tangent, applied per frame.
    cone.quaternion.setFromUnitVectors(
      new Vector3(0, 1, 0),
      new Vector3(cos, -0.4, -sin).normalize(),
    );
    pivot.add(cone);
    fallback.add(pivot);
    arms.push({ axis: new Vector3(sin, 0, cos), pivot });
  }

  const rig: KrakenRig = {
    setCurls: (curls) => {
      for (let i = 0; i < ARM_COUNT; i++) {
        arms[i]!.pivot.setRotationFromAxisAngle(arms[i]!.axis, curls[i]!);
      }
    },
  };
  rig.setCurls(initialCurls);
  return { rig, fallback };
}

/** Releases the stand-in's own resources; the shared body material stays. */
function retireFallback(fallback: Group, bodyMaterial: Material): void {
  const seen = new Set<BufferGeometry | Material>();
  fallback.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }
    seen.add(node.geometry as BufferGeometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material !== bodyMaterial) {
        seen.add(material as Material);
      }
    }
  });
  for (const resource of seen) {
    resource.dispose();
  }
}
