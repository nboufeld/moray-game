import {
  CircleGeometry,
  Color,
  Group,
  Mesh,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Scene,
} from "three";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { requestModel } from "../../../rendering/AssetLibrary";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { disposeSubtree } from "../../../util/disposeSubtree";
import { OPEN_BLUE } from "../../../world/wings/defs/OpenBlue";
import type { LifeContext, LifeSystem } from "../../life/LifeSystem";

/**
 * The Gentle Dark — an umibōzu off the Open Blue's drop-off.
 *
 * A colossal head-and-shoulders silhouette that lives *outside* the swimmable
 * cap: every three to six minutes it rises slowly past the far curtain
 * (r ≈ 53.5, where the diver's ceiling ends at r 51), regards the water with
 * two soft glowing eyes for about forty seconds, and sinks away. It never
 * approaches; the whole behaviour is one slow vertical line, which is what
 * makes it read as a presence rather than as an animal crossing the stage.
 *
 * The schedule is the `VisitorSchedule` idiom on the creature's own stream —
 * a seeded countdown, a first-appearance window long enough that no canonical
 * settle ever meets it, and a drawn gap after each sinking. The body is
 * `creature-gentle-dark.glb` when it lands and a three-sphere stand-in in the
 * same palette until then, exactly the visitors' contract.
 */

/**
 * Where it rises: outside the wing's radial cap (r 51), on the wing's axis.
 * 54.5 puts the face's nearest point 1.5 m past the cap — close enough that a
 * diver at the end wall earns the discovery (focus reaches 14 m), never close
 * enough to touch.
 */
const RISE_RADIUS = 54.5;
const RISE_X = RISE_RADIUS * Math.cos(OPEN_BLUE.azimuth);
const RISE_Z = RISE_RADIUS * Math.sin(OPEN_BLUE.azimuth);
/** Its regard faces the reef's centre: the direction the hull's +Z looks. */
const FACE_FORWARD_X = -Math.cos(OPEN_BLUE.azimuth);
const FACE_FORWARD_Z = -Math.sin(OPEN_BLUE.azimuth);

/** The hull is ~10 m tall; its base rides between these two depths. */
const SUNKEN_Y = -34;
const RISEN_Y = -13.2;

/** The schedule's clock: the first window keeps captures quiescent. */
const FIRST_MIN = 90;
const FIRST_MAX = 150;
const GAP_MIN = 180;
const GAP_MAX = 360;

/** Seconds per phase at full motion. */
const RISE_SECONDS = 28;
const REGARD_SECONDS = 40;
const SINK_SECONDS = 32;

/** The face's front surface and eye height in model space (authored). */
const FACE_Z = 2.06;
const EYE_Y = 6.9;
const EYE_X = 0.92;

/** While it is not regarding, the discovery target is parked out of reach. */
const PARKED_Y = -60;

/** The palette: a deep blue-violet, never black, and a warm pale eye. */
const BODY_FALLBACK = 0x241f4e;
const EYE_GLOW = 0xf5dfa8;

type Phase = "hidden" | "rising" | "regarding" | "sinking";

function smooth01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

export class GentleDarkSystem implements LifeSystem {
  readonly group = new Group();
  readonly target: DiscoveryTarget;
  readonly targets: readonly DiscoveryTarget[];

  private readonly random = new Random(SEEDS.mythUmibozu);
  private readonly root = new Group();
  private readonly bodyMaterial = createToonMaterial({ color: BODY_FALLBACK });
  private readonly eyeMaterial = createToonMaterial({
    color: EYE_GLOW,
    emissive: EYE_GLOW,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0,
  });

  private phase: Phase = "hidden";
  private countdown: number;
  private phaseTime = 0;
  private phaseDuration = 1;
  /** 0 sunken, 1 risen; the vertical line's only coordinate. */
  private emergence = 0;
  private glbMesh: Mesh | null = null;

  private readonly facing: number;

  constructor() {
    this.group.name = "myth-gentle-dark";
    this.root.name = "gentle-dark-body";
    this.group.add(this.root);

    this.facing = Math.atan2(-RISE_X, -RISE_Z);
    this.root.rotation.y = this.facing;
    this.root.position.set(RISE_X, SUNKEN_Y, RISE_Z);

    this.buildFallback();
    this.buildEyes();

    this.target = { speciesId: "myth-gentle-dark", position: new Vector3(RISE_X, PARKED_Y, RISE_Z) };
    this.targets = [this.target];

    // The one seeded draw before anything async: when the first rise comes.
    this.countdown = this.random.range(FIRST_MIN, FIRST_MAX);

    requestModel("models/creature-gentle-dark.glb", (geometry) => this.adoptModel(geometry));
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }

  update(dt: number, ctx: LifeContext): void {
    if (dt > 0) {
      this.advance(dt, ctx.reducedMotion);
    }

    const y = SUNKEN_Y + (RISEN_Y - SUNKEN_Y) * this.emergence;
    this.root.position.y = y;

    // The regard is not a statue: a drift of centimetres and a breath in the
    // glow, scaled down (never off) for reduced motion.
    const calm = ctx.reducedMotion ? 0.4 : 1;
    const t = ctx.time;
    this.root.position.x = RISE_X + Math.sin(t * 0.11) * 0.16 * calm * this.emergence;
    this.root.position.z = RISE_Z + Math.cos(t * 0.09) * 0.14 * calm * this.emergence;
    const glow = this.emergence * (0.45 + 0.2 * Math.sin(t * 0.8) * calm);
    this.eyeMaterial.opacity = glow;

    // The target lives on the silhouette's nearest point only while the being
    // holds its risen pose; a focus attempt has the whole regard to finish in.
    if (this.phase === "regarding") {
      this.target.position.set(
        this.root.position.x + FACE_FORWARD_X * FACE_Z,
        y + EYE_Y,
        this.root.position.z + FACE_FORWARD_Z * FACE_Z,
      );
    } else {
      this.target.position.set(RISE_X, PARKED_Y, RISE_Z);
    }
  }

  dispose(): void {
    // The GLB's geometry is the AssetLibrary's cache, not ours: unhook the
    // mesh before the subtree sweep so the shared buffer survives.
    if (this.glbMesh) {
      this.glbMesh.removeFromParent();
    }
    disposeSubtree(this.group);
    this.group.removeFromParent();
    this.group.clear();
  }

  /** Current phase, for the tests and nothing else. */
  get currentPhase(): Phase {
    return this.phase;
  }

  private advance(dt: number, reducedMotion: boolean): void {
    const rate = reducedMotion ? 0.55 : 1;
    switch (this.phase) {
      case "hidden":
        this.countdown -= dt;
        if (this.countdown <= 0) {
          this.phase = "rising";
          this.phaseTime = 0;
          this.phaseDuration = RISE_SECONDS / rate;
        }
        break;
      case "rising":
        this.phaseTime += dt;
        this.emergence = smooth01(this.phaseTime / this.phaseDuration);
        if (this.phaseTime >= this.phaseDuration) {
          this.phase = "regarding";
          this.phaseTime = 0;
          // Reduced motion buys stillness, not absence: the pose holds longer.
          this.phaseDuration = REGARD_SECONDS * (reducedMotion ? 1.6 : 1);
        }
        break;
      case "regarding":
        this.phaseTime += dt;
        this.emergence = 1;
        if (this.phaseTime >= this.phaseDuration) {
          this.phase = "sinking";
          this.phaseTime = 0;
          this.phaseDuration = SINK_SECONDS / rate;
        }
        break;
      case "sinking":
        this.phaseTime += dt;
        this.emergence = 1 - smooth01(this.phaseTime / this.phaseDuration);
        if (this.phaseTime >= this.phaseDuration) {
          this.phase = "hidden";
          this.emergence = 0;
          this.countdown = this.random.range(GAP_MIN, GAP_MAX);
        }
        break;
      default:
        this.phase satisfies never;
    }
  }

  /** The stand-in: three squashed spheres in the same blue-violet. */
  private buildFallback(): void {
    const fallback = new Group();
    fallback.name = "gentle-dark-fallback";
    const shoulders = new Mesh(new SphereGeometry(1, 18, 12), this.bodyMaterial);
    shoulders.scale.set(3.5, 2.3, 2.15);
    shoulders.position.y = 2.1;
    const head = new Mesh(new SphereGeometry(1, 18, 12), this.bodyMaterial);
    head.scale.set(2.0, 2.55, 1.95);
    head.position.y = 6.3;
    const crown = new Mesh(new SphereGeometry(1, 14, 10), this.bodyMaterial);
    crown.scale.set(1.35, 1.5, 1.3);
    crown.position.y = 8.55;
    fallback.add(shoulders, head, crown);
    this.root.add(fallback);
  }

  /**
   * The two soft eyes, proud of the face in both bodies: the GLB paints them
   * in `COLOR_0`, and these discs carry the glow it is seen by.
   */
  private buildEyes(): void {
    const geometry = new CircleGeometry(0.34, 14);
    for (const side of [-1, 1]) {
      const eye = new Mesh(geometry, this.eyeMaterial);
      eye.position.set(side * EYE_X, EYE_Y, FACE_Z + 0.02);
      this.root.add(eye);
    }
  }

  private adoptModel(geometry: BufferGeometry): void {
    const fallback = this.root.getObjectByName("gentle-dark-fallback");
    if (fallback) {
      fallback.removeFromParent();
      disposeSubtree(fallback);
    }
    this.bodyMaterial.color = new Color(0xffffff);
    this.bodyMaterial.vertexColors = true;
    this.bodyMaterial.needsUpdate = true;
    const mesh = new Mesh(geometry, this.bodyMaterial);
    mesh.name = "gentle-dark-glb";
    this.root.add(mesh);
    this.glbMesh = mesh;
  }
}
