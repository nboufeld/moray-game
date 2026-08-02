import {
  BoxGeometry,
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
import { LeviathanArc } from "./LeviathanArc";
import { OwnedResources, buildSkinnedMesh, retireFallback, type JointSpec } from "./SkinnedBody";

/**
 * The Lantern Leviathan: a rare crosser far beyond the wings.
 *
 * The `VisitorSchedule` idiom at mythic scale, self-contained because the
 * visitors' own director is a closed union of kinds that is not this
 * package's to widen: a schedule stream of its own (first pass two to four
 * minutes in, then every four to seven), a stage that is empty between
 * crossings (`root` is attached only while the animal is on it), and
 * pre-rolled paths on their own substream so re-tuning *when* it comes
 * never re-rolls *where* it swims.
 *
 * Its discovery target rides its head; between crossings the target is
 * parked far below the world so the scanner never sees it.
 */

/** Seconds of water before the first crossing. */
const FIRST_ARRIVAL_MIN = 120;
const FIRST_ARRIVAL_MAX = 240;
/** Seconds of empty water between crossings. */
const GAP_MIN = 240;
const GAP_MAX = 420;

/** Pre-rolled crossings; each pass takes the next. */
const ARC_COUNT = 4;

/** Where the target waits between crossings: far below everything. */
const PARKED_Y = -60;

/** The stroke: one slow fluke beat every eleven seconds, pectorals trailing. */
const FLUKE_HZ = 0.09;
const FLUKE_AMP = 0.13;
const PECT_AMP = 0.08;
const PECT_LAG = 1.1;
/** The lean into the turn at mid-crossing. */
const BANK = 0.1;

/** Where the discovery point sits, in model space: the crown of the head,
 * between and above the eyes — where a diver naturally holds their gaze. */
const HEAD_POINT = new Vector3(0, 0.9, 5.6);

/**
 * The exported skin's joints, measured off `creature-lantern-leviathan.glb`
 * with `inspect_creature.mjs`; order is the skin's joint order. `fluke`'s
 * local +Y is model +X, so `rotation.y` is the whale's vertical stroke; the
 * pectorals' local +Y is model +Z (body-forward), the turtle idiom.
 */
const JOINTS: readonly JointSpec[] = [
  { name: "root", origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0] },
  { name: "fluke", origin: [0, 0, -5.4], x: [0, 0, 1], y: [1, 0, 0] },
  { name: "pectL", origin: [0.95, -0.2, 2.59], x: [-1, 0, 0], y: [0, 0, 1] },
  { name: "pectR", origin: [-0.95, -0.2, 2.59], x: [-1, 0, 0], y: [0, 0, 1] },
];

/** One posable leviathan, whichever body it is wearing. */
interface LeviathanRig {
  /** fluke: + = tail tips up. pect: + = left pectoral rolls tip-up, mirrored
   * on the right. */
  pose(fluke: number, pect: number): void;
}

export class LanternLeviathanSystem implements LifeSystem {
  readonly group = new Group();
  /** The discovery point; its position is driven per frame. */
  readonly target: DiscoveryTarget;
  /** The pre-rolled crossings, exposed for the geometry tests. */
  readonly arcs: LeviathanArc[] = [];

  private readonly root = new Group();
  private readonly resources = new OwnedResources();
  private readonly scheduleRandom: Random;
  private countdown: number;
  private passIndex = 0;
  private arc: LeviathanArc;
  private passTime = 0;
  private passing = false;
  private disposed = false;

  private rig: LeviathanRig;
  private fallback: Group | null = null;
  /**
   * Starts as plain slate: the stand-in carries no colour attribute, and
   * `vertexColors: true` over a missing attribute renders black — the trap
   * `weatherRock` documented. The GLB's arrival turns vertex colours on.
   */
  private readonly bodyMaterial = this.resources.own(createToonMaterial({ color: 0x51697f }));

  private readonly scratch = new Vector3();
  private readonly headScratch = new Vector3();

  constructor(readonly seed: number = SEEDS.mythLeviathan) {
    this.group.name = "lantern-leviathan";
    this.root.name = "lantern-leviathan-body";
    this.target = { speciesId: "myth-lantern-leviathan", position: new Vector3(0, PARKED_Y, 0) };

    // Drawn before any async: the schedule's stream and the paths' substream
    // are both spent at construction, so the GLB landing later re-rolls
    // nothing.
    this.scheduleRandom = new Random(seed);
    this.countdown = this.scheduleRandom.range(FIRST_ARRIVAL_MIN, FIRST_ARRIVAL_MAX);
    const pathRandom = new Random(seed ^ 0x9a71);
    for (let i = 0; i < ARC_COUNT; i++) {
      this.arcs.push(new LeviathanArc(pathRandom));
    }
    this.arc = this.arcs[0]!;

    const { fallback, rig } = this.buildFallback();
    this.fallback = fallback;
    this.rig = rig;
    this.root.add(fallback);

    requestModel("models/creature-lantern-leviathan.glb", (geometry) => this.adoptModel(geometry));
  }

  get isPassing(): boolean {
    return this.passing;
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }

  /**
   * Starts a crossing now, optionally `secondsIn` into it — the deterministic
   * force-hook the visitors keep for captures, kept here for the same reason.
   */
  beginPass(secondsIn = 0): void {
    if (this.disposed) {
      return;
    }
    this.arc = this.arcs[this.passIndex % this.arcs.length]!;
    this.passIndex++;
    this.passTime = Math.max(0, secondsIn);
    if (!this.passing) {
      this.passing = true;
      this.group.add(this.root);
    }
  }

  update(dt: number, ctx: LifeContext): void {
    if (!this.passing) {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.beginPass();
      } else {
        return;
      }
    }

    // The pass advances the frame it begins on, so the body is never seen
    // standing at the origin for a tick.
    this.passTime += dt;
    const s = this.passTime / this.arc.duration;
    if (s >= 1) {
      this.endPass();
      this.countdown = this.scheduleRandom.range(GAP_MIN, GAP_MAX);
      return;
    }

    this.arc.positionAt(s, this.root.position);
    this.arc.tangentAt(s, this.scratch);
    const horizontal = Math.hypot(this.scratch.x, this.scratch.z);
    this.root.rotation.set(
      -Math.atan2(this.scratch.y, horizontal),
      Math.atan2(this.scratch.x, this.scratch.z),
      this.arc.bankAt(s) * BANK * (ctx.reducedMotion ? 0.5 : 1),
      "YXZ",
    );

    const calm = ctx.reducedMotion ? 0.6 : 1;
    const beat = this.passTime * FLUKE_HZ * Math.PI * 2;
    this.rig.pose(Math.sin(beat) * FLUKE_AMP * calm, Math.sin(beat - PECT_LAG) * PECT_AMP * calm);

    this.headScratch.copy(HEAD_POINT).applyQuaternion(this.root.quaternion).add(this.root.position);
    this.target.position.copy(this.headScratch);
  }

  dispose(): void {
    this.disposed = true;
    this.endPass();
    this.group.removeFromParent();
    this.group.clear();
    this.resources.disposeAll();
  }

  /** The crossing is over; the animal leaves the scene graph and the target parks. */
  private endPass(): void {
    if (!this.passing) {
      return;
    }
    this.passing = false;
    this.group.remove(this.root);
    this.target.position.set(0, PARKED_Y, 0);
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
      new Sphere(new Vector3(0, 0, 0.2), 8.4),
    );
    this.root.add(mesh);

    if (this.fallback) {
      this.root.remove(this.fallback);
      retireFallback(this.fallback, [this.bodyMaterial], (r) => this.resources.disposeOwned(r));
      this.fallback = null;
    }

    const fluke = bones[1]!;
    const pectL = bones[2]!;
    const pectR = bones[3]!;
    this.rig = {
      pose: (flukeAngle, pect) => {
        fluke.rotation.y = flukeAngle;
        pectL.rotation.y = pect;
        pectR.rotation.y = -pect;
      },
    };
  }

  /**
   * The no-assets leviathan: the measured silhouette out of primitives in
   * the authored palette, with pivot groups standing exactly where the
   * GLB's joints stand so the one stroke drives either body.
   */
  private buildFallback(): { fallback: Group; rig: LeviathanRig } {
    const own = <T extends BufferGeometry | Material>(r: T): T => this.resources.own(r);
    const fallback = new Group();
    fallback.name = "lantern-leviathan-fallback";

    const slate = this.bodyMaterial;
    const pale = own(createToonMaterial({ color: 0xc9d4cf }));
    const deep = own(createToonMaterial({ color: 0x40566e }));
    const gold = own(createToonMaterial({ color: 0xeec25a }));

    const body = new Mesh(own(new SphereGeometry(1, 18, 12)), slate);
    body.scale.set(1.16, 1.22, 6.6);
    fallback.add(body);

    const head = new Mesh(own(new SphereGeometry(1, 14, 10)), slate);
    head.scale.set(1.05, 1.1, 2.3);
    head.position.set(0, 0.02, 4.9);
    fallback.add(head);

    const throat = new Mesh(own(new SphereGeometry(1, 12, 8)), pale);
    throat.scale.set(0.9, 0.55, 3.4);
    throat.position.set(0, -0.72, 3.0);
    fallback.add(throat);

    const fin = new Mesh(own(new BoxGeometry(0.12, 0.75, 1.1)), deep);
    fin.position.set(0, 1.3, -2.3);
    fin.rotation.x = 0.35;
    fallback.add(fin);

    const flukePivot = new Group();
    flukePivot.position.set(0, 0, -5.4);
    const flukeBlade = own(new BoxGeometry(1.7, 0.08, 0.9));
    for (const sign of [1, -1]) {
      const lobe = new Mesh(flukeBlade, deep);
      lobe.position.set(sign * 0.85, 0, -1.0);
      lobe.rotation.y = sign * -0.4;
      flukePivot.add(lobe);
    }
    fallback.add(flukePivot);

    const pectBlade = own(new SphereGeometry(1, 8, 6));
    const makePect = (sign: number): Group => {
      const pivot = new Group();
      pivot.position.set(sign * 0.95, -0.2, 2.59);
      const blade = new Mesh(pectBlade, deep);
      blade.scale.set(1.25, 0.07, 0.4);
      blade.position.set(sign * 1.1, -0.5, 0.5);
      blade.rotation.y = sign * -0.5;
      pivot.add(blade);
      fallback.add(pivot);
      return pivot;
    };
    const pectL = makePect(1);
    const pectR = makePect(-1);

    // The lantern rows: gold studs along the flanks and the back, the same
    // places the GLB carries them.
    const stud = own(new SphereGeometry(0.11, 6, 5));
    for (const sign of [1, -1]) {
      for (let k = 0; k < 8; k++) {
        const z = 3.6 - k * 1.05;
        const dot = new Mesh(stud, gold);
        dot.position.set(sign * (1.02 - Math.abs(z) * 0.045), 0.45, z);
        fallback.add(dot);
      }
    }
    for (let k = 0; k < 7; k++) {
      const z = 2.6 - k * 1.1;
      const dot = new Mesh(stud, gold);
      dot.position.set(0, 1.05 - Math.abs(z) * 0.05, z);
      fallback.add(dot);
    }

    const rig: LeviathanRig = {
      pose: (flukeAngle, pect) => {
        flukePivot.rotation.x = flukeAngle;
        pectL.rotation.z = pect;
        pectR.rotation.z = -pect;
      },
    };
    return { fallback, rig };
  }
}
