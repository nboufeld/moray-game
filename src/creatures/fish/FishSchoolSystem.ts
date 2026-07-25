import {
  BufferAttribute,
  Color,
  ConeGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  type BufferGeometry,
  type Scene,
  type Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SUN_POSITION } from "../../rendering/Lighting";
import { Random, SEEDS } from "../../util/Random";

/**
 * Number of shoals the school is distributed between.
 *
 * Seven read as feast or famine. A shoal only occupies a few metres, and what
 * a camera can see of the reef is an annulus — the standoff opens it and the
 * fish fog closes it — so seven groups scattered over the whole reef put an
 * average of one and a half of them in frame. In practice that meant a shot
 * with three shoals in it and, fifteen seconds later, one with none. Thirteen
 * groups of thirteen still read as schools, and the reef is never empty of
 * them: measured over the traverse camera, never fewer than four fish in shot.
 */
const SHOAL_COUNT = 13;

/**
 * How much further away a fish is, as far as the fog is concerned, than it
 * actually is.
 *
 * The school did already receive the scene's fog — `MeshStandardMaterial`
 * respects it and always has. It simply was not enough, because fog can only
 * interpolate toward the water and a lit fish started an order of magnitude
 * above it: measured off the composited frame, the brightest tenth of the
 * pixels of a shoal thirty metres out still landed near 143 against water at
 * 36. Exponential-squared fog is the right shape for the fix, though. Lengthen
 * the depth it is handed and the extra density lands almost entirely on the far
 * end — at eight metres this costs a fish about a tenth of its value, and at
 * thirty it takes most of what is left — which is exactly the ask: near fish
 * stay readable silver, far ones sink into the water instead of sitting on it.
 * It is also free, being one multiply in the vertex shader.
 */
const FOG_DISTANCE_GAIN = 1.6;

/** Horizontal bearing of the sun, which is the direction a glint answers to. */
const SUN_FLAT_LENGTH = Math.hypot(SUN_POSITION.x, SUN_POSITION.z);
const SUN_HEADING_X = SUN_POSITION.x / SUN_FLAT_LENGTH;
const SUN_HEADING_Z = SUN_POSITION.z / SUN_FLAT_LENGTH;

/**
 * How tightly the glint is tied to swimming at the sun, and how sharply it
 * pulses once it is. Both are exponents on a value already in 0..1, so raising
 * either narrows the window: the aim term admits roughly a sixth of all
 * headings, the flick term roughly an eighth of each cycle, and the product is
 * what keeps a school of 170 down to a handful of fish catching the light at
 * any one moment. That is the difference between a reef and a disco.
 */
const GLINT_AIM_EXPONENT = 6;
const GLINT_FLICK_EXPONENT = 5;

/**
 * Peak brightening per channel at the top of a flick, warm-weighted: the sun is
 * warm and the body is cool silver, so the product reads as a white flash off a
 * flank rather than as the fish changing colour.
 */
const GLINT_GAIN_R = 1.15;
const GLINT_GAIN_G = 1.02;
const GLINT_GAIN_B = 0.78;

/**
 * Where a shoal is turned back toward the reef, and how hard.
 *
 * Soft, because the alternative — wrapping a shoal's position inside a box — is
 * a whole school vanishing from one edge of the frame and reappearing at the
 * other, which is far more noticeable than the drift it was meant to hide. The
 * turn ramps in over nine metres of travel, so at cruising speed a shoal has
 * ten seconds or so to come round and the correction never reads as a
 * course change.
 *
 * Wide, because the region is centred on the reef and the cameras are not. Held
 * to a tighter disc the school kept leaving the frame entirely at the mid-depth
 * traverse, which stands off-centre and looks *outward* — the diver's whole
 * view cone fell in the part of the water the containment was busy emptying.
 * There is no cost to letting them range: the reef is 60m across, they have no
 * colliders, and the fog has taken them long before the far edge.
 */
const ROAM_SOFT = 20;
const ROAM_HARD = 29;
const CONTAIN_GAIN = 0.5;
/** Ceiling on the containment turn, so the far edge curves rather than snaps. */
const CONTAIN_MAX_RATE = 0.3;

/**
 * How close a shoal will come to the diver before it starts bending away, and
 * how hard it bends.
 *
 * Not a nicety. A shoal is a formation five metres across, so a course that
 * happens to run through the diver puts a fish *inside a metre of the lens* —
 * measured, at the canonical mid-depth camera: the nearest six instances sat
 * between 0.8m and 1.8m out and the closest of them spanned thirty-one degrees
 * of the frame. At that size the animal stops being a fish and becomes three
 * flat facets and an outline, which is the "paper scrap" read in its purest
 * form, and no amount of tuning the material fixes it because the problem is
 * that it is a metre away. Bending the course is the fix, and reef fish keeping
 * their distance from something diver-sized is what reef fish do, so this buys
 * life rather than spending it.
 *
 * The distance is a balance and not just a floor. Everything nearer than this
 * is empty water and the fish fog closes the view at around twenty-four metres,
 * so the standoff and the fog together decide how wide a band the school can be
 * *seen* in — set to eleven it read as a clean frame at the canonical moment
 * and an empty one a minute later, because there was almost nowhere left for a
 * shoal to be both allowed and visible.
 */
const VIEWER_STANDOFF = 8.5;
const VIEWER_GAIN = 0.9;
const VIEWER_MAX_RATE = 0.45;

/**
 * A tapered body with a forked tail, nose along +Z.
 *
 * Shape matters more than size here: a bare diamond reads as a flying saucer
 * the moment the diver gets close enough to see it end-on, and a school of
 * those looks like drifting litter rather than life.
 */
function createFishGeometry(): BufferGeometry {
  const body = new OctahedronGeometry(0.13, 0);
  body.scale(0.55, 0.82, 2.1);
  countershade(body);

  // Two thin blades splayed into a fork, set behind the body.
  const upper = new ConeGeometry(0.075, 0.16, 3);
  upper.rotateX(-Math.PI / 2);
  upper.rotateZ(Math.PI / 2);
  upper.scale(0.28, 1, 1);
  upper.translate(0, 0.055, -0.3);

  const lower = upper.clone();
  lower.translate(0, -0.11, 0);
  countershade(upper);
  countershade(lower);

  return mergeGeometries([body, upper, lower]) ?? body;
}

/**
 * Bakes counter-shading — dark back, bright belly — into vertex colours.
 *
 * This is the real cue that makes a fish read as a fish from a distance, and at
 * this size it is not worth a texture fetch to get it: the whole animal is a
 * handful of pixels, so the gradient does all the work a map would.
 *
 * The ceiling is 1. It used to be 1.25, which meant the belly was a 25%
 * *brightening* applied on top of the base colour — a gain living in a vertex
 * buffer, where nobody reading the material would find it. The belly-to-back
 * ratio below is the one it always had, so the cue is unchanged; what moved is
 * that the material's colour is now the animal's brightest point rather than
 * something four fifths of the way up it.
 */
function countershade(geometry: BufferGeometry): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < position.count; i++) {
    min = Math.min(min, position.getY(i));
    max = Math.max(max, position.getY(i));
  }

  const span = Math.max(1e-5, max - min);
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) - min) / span;
    const shade = 1 - t * 0.58;
    colors[i * 3] = shade * 0.95;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade * 1.04;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/**
 * A shoal travelling somewhere, rather than a point things orbit.
 *
 * Its heading is wandered by two sines of incommensurate period rather than by
 * a noise lattice: at one value per shoal per frame a lattice buys nothing, and
 * a closed-form function of time cannot drift out of step between a screenshot
 * run and the run it is compared against.
 */
interface Shoal {
  x: number;
  z: number;
  /** Cruising depth, above the seabed and above the diver's eye line. */
  y: number;
  heading: number;
  speed: number;
  wanderRateA: number;
  wanderAmpA: number;
  wanderPhaseA: number;
  wanderRateB: number;
  wanderAmpB: number;
  wanderPhaseB: number;
  /** A slow shared rise and fall — the whole school riding one swell. */
  bobRate: number;
  bobPhase: number;
  bobAmp: number;
  /** Scales every station in the formation: a tight ball, or a loose drift. */
  spread: number;
}

/** A fish's station within its shoal, in the shoal's own frame. */
interface FishAgent {
  shoal: number;
  right: number;
  up: number;
  forward: number;
  weaveRate: number;
  weavePhase: number;
  weaveAmp: number;
  riseAmp: number;
  surgeRate: number;
  surgeAmp: number;
  /** How much the weave turns the nose, so no two fish sit exactly parallel. */
  yawAmp: number;
  /** How far it drops the inside shoulder as the weave turns it. */
  bankAmp: number;
  glintRate: number;
  glintPhase: number;
  scale: number;
}

/** The same angle expressed in [-π, π], so a turn takes the short way round. */
function wrapAngle(radians: number): number {
  const wrapped = (radians + Math.PI) % (Math.PI * 2);
  return (wrapped < 0 ? wrapped + Math.PI * 2 : wrapped) - Math.PI;
}

/**
 * Ambient reef fish: shoals travelling across the reef, each carrying its fish
 * in a loose formation that weaves around its station.
 *
 * They used to orbit. Not as a school — every fish had its own centre and its
 * own radius, so what the reef actually held was a hundred and seventy separate
 * carousels, and a carousel is the one motion nothing alive makes. From a fixed
 * camera the giveaway is that nothing ever arrives or leaves; it just goes
 * round. The cost is unchanged either way: one InstancedMesh, one draw call,
 * the same 170 matrices written per frame.
 */
export class FishSchoolSystem {
  readonly mesh: InstancedMesh;
  private readonly shoals: Shoal[] = [];
  private readonly agents: FishAgent[] = [];
  private readonly dummy = new Object3D();
  private readonly matrix = new Matrix4();
  private readonly tint = new Color();
  private readonly swim = { value: 0 };
  private time = 0;

  constructor(count = 170, seed: number = SEEDS.fish) {
    const random = new Random(seed);
    const geometry = createFishGeometry();
    const material = new MeshStandardMaterial({
      // This is the belly colour: the counter-shading below is a 0..1
      // multiplier now, so the brightest part of the animal is exactly this and
      // nothing in the material is secretly brighter than it looks.
      //
      // Silvered rather than golden, and cooler than the value alone would
      // suggest. The key light is strong and warm, so a neutral body under it
      // comes out cream — which against blue water is the tan paper scrap the
      // school was being mistaken for. Leaning the albedo blue is what lets it
      // land on white silver once the sun has warmed it.
      color: new Color(0xc8e2e6),
      // Barely metal, and rough. The extreme pixels in the shots that started
      // this were specular rather than diffuse: at metalness 0.15 and roughness
      // 0.42 a flat-shaded facet catching the sun went to a hard pinpoint,
      // which a few pixels across does not read as "shiny fish" but as a bright
      // dot with no shape — 170 of those is the pop. Taking it to zero costs
      // too much, though: with no specular at all a fish near the lens is matte
      // cardboard, and the modelling that tells you which way it is facing goes
      // with it. So the lobe stays and is spread wide instead, which keeps the
      // form and cannot concentrate into a dot. The highlight that is *meant*
      // to be sharp is the glint below, and that one is aimed.
      roughness: 0.58,
      metalness: 0.09,
      flatShading: true,
      vertexColors: true,
    });
    // Tail sway in the vertex shader, phased per instance. At this size a fish
    // is a few pixels of silhouette, and motion is the only thing that
    // separates a school from a scattering of debris.
    //
    // A module-level constant is folded into the fog line rather than passed as
    // a uniform: three keys its program cache on `onBeforeCompile.toString()`,
    // which returns the source and not the interpolated result, so a second
    // material wanting a different gain would silently get this one's program.
    // There is exactly one fish material, and this is the note for whoever adds
    // the second.
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uSwim = this.swim;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uSwim;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           float swimPhase = instanceMatrix[3][0] * 0.9 + instanceMatrix[3][2] * 0.7;
           // Weighted toward the tail (-z), so the nose stays steady.
           float tailward = clamp(-transformed.z / 0.42, 0.0, 1.0);
           transformed.x += sin(uSwim * 7.0 + swimPhase) * 0.06 * tailward * tailward;`,
        )
        .replace(
          "#include <fog_vertex>",
          `#include <fog_vertex>
           #ifdef USE_FOG
             vFogDepth *= ${FOG_DISTANCE_GAIN.toFixed(2)};
           #endif`,
        );
    };
    this.mesh = new InstancedMesh(geometry, material, count);
    // Small, distant and always moving: their shadows are never legible, and
    // 170 extra casters in the shadow pass are not.
    this.mesh.castShadow = false;

    // Shoals set off from scattered stations on scattered bearings. The
    // bearings are dealt round the compass rather than drawn freely: the glint
    // only answers to fish swimming at the sun, so a school that happened to
    // roll every heading into one quadrant would never catch the light at all.
    for (let s = 0; s < SHOAL_COUNT; s++) {
      this.shoals.push({
        x: random.signed(15),
        z: random.signed(15),
        // Above the diver's eye line, which sits around two metres, but not far
        // above it. This is a composition setting, not a safety one — keeping
        // the school clear of the diver is the standoff's job, and it does it
        // in the horizontal plane, where there is always a direction to turn.
        // Flying the shoals high as well overshot badly: these cameras are
        // pitched slightly *down*, so their top edge is only about thirty
        // degrees up, and a shoal at nine metres of depth passing at the
        // standoff distance sits above the frame entirely. Most of the school
        // was there the whole time and simply out of shot.
        y: random.range(4, 7.2),
        heading: (s / SHOAL_COUNT) * Math.PI * 2 + random.signed(0.4),
        speed: random.range(0.55, 1.05),
        wanderRateA: random.range(0.07, 0.14),
        wanderAmpA: random.range(0.05, 0.11),
        wanderPhaseA: random.range(0, Math.PI * 2),
        wanderRateB: random.range(0.21, 0.36),
        wanderAmpB: random.range(0.02, 0.05),
        wanderPhaseB: random.range(0, Math.PI * 2),
        bobRate: random.range(0.11, 0.2),
        bobPhase: random.range(0, Math.PI * 2),
        bobAmp: random.range(0.3, 0.7),
        // Some shoals ball up and some string out. Without this every group is
        // the same size and density, which is a repeated decal at the scale of
        // the shoal rather than of the fish.
        spread: random.range(0.65, 1.5),
      });
    }

    for (let i = 0; i < count; i++) {
      this.agents.push({
        shoal: i % SHOAL_COUNT,
        // Wider than tall and longer than wide, which is the shape a school
        // travelling in one direction actually holds.
        right: random.signed(2.8),
        up: random.signed(1.1),
        forward: random.signed(3.5),
        weaveRate: random.range(0.5, 1.1),
        weavePhase: random.range(0, Math.PI * 2),
        weaveAmp: random.range(0.25, 0.7),
        riseAmp: random.range(0.1, 0.35),
        surgeRate: random.range(0.24, 0.52),
        surgeAmp: random.range(0.3, 0.9),
        yawAmp: random.range(0.12, 0.3),
        bankAmp: random.range(0.22, 0.55),
        glintRate: random.range(0.7, 1.4),
        glintPhase: random.range(0, Math.PI * 2),
        // A shoal of identically sized fish reads as a repeated decal.
        //
        // Smaller than they were, and this matters more than it sounds. The
        // body is about 0.85m at scale 1, so the old top end put metre-long
        // animals in a school of ambient background fish — and a metre-long
        // flat-shaded octahedron ten metres from the lens does not resolve into
        // a fish, it resolves into three grey facets and an outline. The
        // counter-shading above is built on the assumption that the whole
        // animal is a handful of pixels; this is the range that keeps that true
        // even when a shoal wanders close.
        scale: random.range(0.45, 0.8),
      });
      // Allocates `instanceColor` before the first render, which is when three
      // decides whether the program has the attribute at all.
      this.mesh.setColorAt(i, this.tint.setRGB(1, 1, 1));
    }
  }

  addTo(scene: Scene): void {
    scene.add(this.mesh);
  }

  update(dt: number, reducedMotion: boolean, viewer: Vector3): void {
    const step = dt * (reducedMotion ? 0.4 : 1);
    this.time += step;
    this.swim.value = this.time;
    this.advanceShoals(step, viewer);

    for (let i = 0; i < this.agents.length; i++) {
      const fish = this.agents[i];
      const shoal = fish ? this.shoals[fish.shoal] : undefined;
      if (!fish || !shoal) {
        continue;
      }

      // The shoal's frame: it travels along (sin, cos), so the axis across it
      // is (cos, -sin) — the same pair, a quarter turn over.
      const forwardX = Math.sin(shoal.heading);
      const forwardZ = Math.cos(shoal.heading);
      const weave = this.time * fish.weaveRate + fish.weavePhase;
      const lateral = fish.right * shoal.spread + Math.sin(weave) * fish.weaveAmp;
      const along =
        fish.forward * shoal.spread +
        Math.sin(this.time * fish.surgeRate + fish.weavePhase) * fish.surgeAmp;

      const x = shoal.x + forwardZ * lateral + forwardX * along;
      const z = shoal.z - forwardX * lateral + forwardZ * along;
      const y =
        shoal.y +
        fish.up * shoal.spread +
        Math.sin(this.time * shoal.bobRate + shoal.bobPhase) * shoal.bobAmp +
        Math.sin(weave * 0.7) * fish.riseAmp;

      // A fish weaving across the formation is, at that moment, pointing
      // slightly across it, banking into the turn, and nosed wherever it is
      // climbing to. Without these the whole shoal is rigidly parallel — and a
      // rigidly parallel shoal caught broadside is two dozen *identical*
      // rhombi, which is the shape "paper scraps" was describing as much as the
      // value was. The bank is the one that does the work: it rolls the body
      // about its own long axis, so a flat-shaded facet that was square to the
      // light on one fish is edge-on to it on its neighbour.
      const yaw = shoal.heading + Math.cos(weave) * fish.yawAmp;
      const bank = -Math.sin(weave) * fish.bankAmp;
      const pitch = -Math.cos(weave * 0.7) * fish.riseAmp * 0.5;

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(pitch, yaw, bank, "YXZ");
      this.dummy.scale.setScalar(fish.scale);
      this.dummy.updateMatrix();
      this.matrix.copy(this.dummy.matrix);
      this.mesh.setMatrixAt(i, this.matrix);
      this.setGlint(i, fish, yaw);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Carries each shoal a step along its heading, and bends the heading.
   *
   * Position is integrated rather than solved for, so it depends on the size of
   * the steps taken — which is fine and is the existing bargain: `Game.capture`
   * always replays the same whole fixed steps from load, so a screenshot is
   * still reproducible frame for frame. Heading is a closed form of time plus
   * the turns below, neither of which depends on the frame rate.
   */
  private advanceShoals(step: number, viewer: Vector3): void {
    for (const shoal of this.shoals) {
      const wander =
        Math.sin(this.time * shoal.wanderRateA + shoal.wanderPhaseA) * shoal.wanderAmpA +
        Math.sin(this.time * shoal.wanderRateB + shoal.wanderPhaseB) * shoal.wanderAmpB;

      let steer = 0;
      const radius = Math.hypot(shoal.x, shoal.z);
      if (radius > ROAM_SOFT) {
        const ramp = Math.min(1, (radius - ROAM_SOFT) / (ROAM_HARD - ROAM_SOFT));
        const inward = Math.atan2(-shoal.x, -shoal.z);
        const turn = wrapAngle(inward - shoal.heading) * CONTAIN_GAIN * ramp * ramp;
        steer = Math.max(-CONTAIN_MAX_RATE, Math.min(CONTAIN_MAX_RATE, turn));
      }

      // Horizontal only: a shoal that meets a diver goes around, it does not
      // dive, and there is no vertical turn that helps when the diver is
      // directly below anyway. That case is the cruising band's job.
      const awayX = shoal.x - viewer.x;
      const awayZ = shoal.z - viewer.z;
      const range = Math.hypot(awayX, awayZ);
      if (range < VIEWER_STANDOFF) {
        const ramp = 1 - range / VIEWER_STANDOFF;
        const away = Math.atan2(awayX, awayZ);
        const turn = wrapAngle(away - shoal.heading) * VIEWER_GAIN * ramp * ramp;
        steer += Math.max(-VIEWER_MAX_RATE, Math.min(VIEWER_MAX_RATE, turn));
      }

      shoal.heading += (wander + steer) * step;
      shoal.x += Math.sin(shoal.heading) * shoal.speed * step;
      shoal.z += Math.cos(shoal.heading) * shoal.speed * step;
    }
  }

  /**
   * The flick of sun off a flank, as a per-instance colour multiplier.
   *
   * Instance colour rather than a shader term because at this size it makes no
   * visible difference which one it is — a fish is a few pixels, so brightening
   * the whole body reads exactly as brightening the side that faces the light —
   * and 170 colours is 2kB of upload against a new varying and a new fragment
   * branch on every pixel of every fish.
   */
  private setGlint(index: number, fish: FishAgent, yaw: number): void {
    const facing = Math.sin(yaw) * SUN_HEADING_X + Math.cos(yaw) * SUN_HEADING_Z;
    if (facing <= 0) {
      this.mesh.setColorAt(index, this.tint.setRGB(1, 1, 1));
      return;
    }
    const flick = Math.sin(this.time * fish.glintRate + fish.glintPhase);
    if (flick <= 0) {
      this.mesh.setColorAt(index, this.tint.setRGB(1, 1, 1));
      return;
    }

    const glint = facing ** GLINT_AIM_EXPONENT * flick ** GLINT_FLICK_EXPONENT;
    this.mesh.setColorAt(
      index,
      this.tint.setRGB(
        1 + glint * GLINT_GAIN_R,
        1 + glint * GLINT_GAIN_G,
        1 + glint * GLINT_GAIN_B,
      ),
    );
  }
}
