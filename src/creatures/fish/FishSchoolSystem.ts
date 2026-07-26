import {
  BufferAttribute,
  ConeGeometry,
  InstancedMesh,
  Matrix4,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
  type Scene,
  type Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createToonMaterial } from "../../rendering/ToonShading";
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
 * The school did already receive the scene's fog — every lit material three
 * ships respects it and always has. It simply was not enough, because fog can only
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
 * How much of its girth the body has left by the tail.
 *
 * An ellipsoid is symmetric end to end, and a fish is not: the fork has to hang
 * off something that has narrowed to meet it, or the animal reads as a blimp
 * with fins glued on. The taper is eased in over the back half only, so the
 * head stays the full round shape the whole change is for.
 */
const TAIL_TAPER = 0.42;

/**
 * A rounded teardrop with a forked tail, nose along +Z.
 *
 * It was an octahedron, which is where "paper scraps" came from as much as any
 * value in the material did: eight flat faces read as a shard of something at
 * any distance where they can be told apart at all, and a school of shards is
 * drifting litter. A sphere is the fix, and this is the one place in the reef
 * where a round shape has to survive being a dozen pixels across.
 *
 * 6×5 rather than the 8×6 that was drawn up, and the reason is that a school is
 * 170 of these: measured on the software rasteriser at the resolution the
 * adaptive scaler actually settles on, the school costs 3.0ms of an 85ms frame
 * at 48 triangles and 5.5ms at 80, against 2.3ms for the diamond it replaces.
 * The two spheres are indistinguishable at the size this animal is ever drawn —
 * it is held at arm's length by `VIEWER_STANDOFF` and shrunk further by the
 * near-field cap — so the extra 32 triangles buy nothing but the frame.
 *
 * Every part of it stays *indexed* for the same reason. A sphere shares each of
 * its vertices between six faces, so keeping the index is the difference
 * between 42 vertices and 144, and it is why the fork is no longer flattened to
 * meet the body.
 */
function createFishGeometry(): BufferGeometry {
  const body = new SphereGeometry(0.13, 6, 5);
  body.scale(0.5, 0.75, 1.9);
  taperTail(body);
  // Indexed, so this averages across the shared vertices rather than splitting
  // them: the taper's normals come back smooth, which is the point of it.
  body.computeVertexNormals();

  // Two thin blades splayed into a fork, set behind the body.
  //
  // The indexing has to match, and its mismatching is why every fish in the
  // reef swam without a tail for a while: `mergeGeometries` takes the indexing
  // of the *first* geometry and then rejects every other one that disagrees.
  // A cone is built as a vertex grid with an index over it and an octahedron
  // came out of `PolyhedronGeometry` as bare triangles with none, so the merge
  // returned null, the fallback below quietly handed back a bare body, and
  // nothing about the frame said the tail was gone. The rule has not changed,
  // only which side gave way: with a sphere for a body both are indexed grids
  // and they agree as built.
  //
  // The blades keep the cone's own smooth normals with it. That used to be
  // impossible — everything here was flat-shaded — and it is invisible now:
  // a blade is sixteen centimetres long on an animal that is deliberately
  // never close to the lens.
  const upperBlade = new ConeGeometry(0.075, 0.16, 3);
  upperBlade.rotateX(-Math.PI / 2);
  upperBlade.rotateZ(Math.PI / 2);
  upperBlade.scale(0.28, 1, 1);
  upperBlade.translate(0, 0.055, -0.3);

  const lowerBlade = upperBlade.clone();
  lowerBlade.translate(0, -0.11, 0);

  // All three shaded against the body's own extent, so the fork continues the
  // gradient rather than restarting it. Read per part, a blade a centimetre and
  // a half tall would run the whole dark-back-to-pale-belly ramp across itself
  // and hang a belly-bright edge off the top of the tail.
  const shading = verticalExtent(body);
  countershade(body, shading);
  countershade(upperBlade, shading);
  countershade(lowerBlade, shading);

  // The fallback is kept because a merge can only fail by the attributes not
  // lining up, which is a build-time mistake and not a reason to have no fish.
  return mergeGeometries([body, upperBlade, lowerBlade]) ?? body;
}

/**
 * Narrows the back of the body toward the tail, in place.
 *
 * Only x and y move: the length is what the swim shader's `tailward` weighting
 * and the fork's own placement are both read against, and neither should have
 * to know that the body changed shape.
 */
function taperTail(geometry: BufferGeometry): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  let half = 0;
  for (let i = 0; i < position.count; i++) {
    half = Math.max(half, Math.abs(position.getZ(i)));
  }
  if (half <= 0) {
    return;
  }

  for (let i = 0; i < position.count; i++) {
    const z = position.getZ(i);
    // 0 everywhere forward of the middle, 1 at the tail tip.
    const back = Math.min(1, Math.max(0, -z / half));
    const narrow = 1 - TAIL_TAPER * back * back;
    position.setXYZ(i, position.getX(i) * narrow, position.getY(i) * narrow, z);
  }
  position.needsUpdate = true;
}

/** The vertical span the counter-shading gradient is read across. */
interface VerticalExtent {
  readonly min: number;
  readonly span: number;
}

function verticalExtent(geometry: BufferGeometry): VerticalExtent {
  const position = geometry.attributes.position;
  if (!position) {
    return { min: 0, span: 1 };
  }

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < position.count; i++) {
    min = Math.min(min, position.getY(i));
    max = Math.max(max, position.getY(i));
  }
  return { min, span: Math.max(1e-5, max - min) };
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
 * buffer, where nobody reading the material would find it. The material's
 * colour is the animal's brightest point rather than something four fifths of
 * the way up it, and that is what makes the range below readable.
 *
 * The range itself came down when the reef went to a painted key. A back at
 * 0.42 of the belly was authored for a frame whose water sat near a fifth of
 * white; against WP-G1's bright turquoise the same ratio is a *dark* shape on a
 * light field, and a small dark low-chroma shape on a large saturated one is
 * read by the eye as that field's complement — which is the "pink against
 * turquoise" the pivot flagged and which no hue on the albedo can argue with
 * (measured, the pixels are already blue-grey). The counter-shading is still
 * the cue that says which way up a fish is; it just no longer has to carry the
 * animal down into water that is not there any more.
 *
 * The gradient is clamped at both ends for the same reason it is capped at 1:
 * the tail fork reaches a little above and below the body it is shaded against,
 * and an unclamped ramp would take the underside of the lower blade back over
 * that ceiling.
 */
function countershade(geometry: BufferGeometry, { min, span }: VerticalExtent): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, (position.getY(i) - min) / span));
    const shade = 1 - t * 0.4;
    // The hue turns over with the value: a shade of warm cream along the belly
    // and the cool of the water along the back, which is what counter-shading
    // looks like when a painter does it rather than a physicist. It is a tilt
    // of a few percent between channels on an albedo that stays cool overall —
    // the cream is the direction, not the colour.
    colors[i * 3] = shade * (1.02 - t * 0.07);
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade * (0.97 + t * 0.09);
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
  private readonly swim = { value: 0 };
  private time = 0;

  constructor(count = 170, seed: number = SEEDS.fish) {
    const random = new Random(seed);
    const geometry = createFishGeometry();
    const material = createToonMaterial({
      // This is the belly colour: the counter-shading below is a 0..1
      // multiplier now, so the brightest part of the animal is exactly this and
      // nothing in the material is secretly brighter than it looks.
      //
      // Same hue as before and a quarter brighter, which is the fix the
      // "pink against turquoise" note was actually asking for. The clash is a
      // *value* failure wearing a hue: a small mid-dark shape on a large field
      // of bright turquoise reads as that field's complement whatever it is
      // painted, and at the old value the school came back mauve. A cream body
      // — tried, measured, reverted — only makes it worse, because the warm key
      // then lands it on salmon, which is the same clash louder. The direction
      // that works is the one the old note gives and further along it: lean the
      // albedo against the warm light so the product is silver, and put it high
      // enough in value that it sits *near* the water rather than against it.
      //
      // The specular went with the BRDF, and both halves of the old argument
      // went with it. There is no lobe left to concentrate into the pinpoints
      // that made a school of 170 pop out of the water, and there is none left
      // to model a near fish either — which the ramp does instead, in flat
      // steps, which is what a storybook fish is.
      //
      // Still cool, and deliberately so even though the body is round now. The
      // warmth the art plan asks for is in the counter-shading's belly end,
      // where it is a few parts in 255 on the brightest strip of a small
      // animal; carried by the albedo it is the cream body WP-G2 measured and
      // threw out, because the warm key lands that on salmon.
      color: 0xdfeef2,
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
    // bearings are dealt round the compass rather than drawn freely, so a
    // school cannot roll every heading into one quadrant and leave three
    // quarters of the reef empty of fish.
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
        // A shoal of identically sized fish reads as a repeated decal.
        //
        // Smaller than they were, and this matters more than it sounds. The
        // body is about 0.85m at scale 1, so the old top end put metre-long
        // animals in a school of ambient background fish — and a metre-long
        // featureless body ten metres from the lens does not resolve into a
        // fish, it resolves into a smooth grey lozenge and an outline. The
        // counter-shading above is built on the assumption that the whole
        // animal is a handful of pixels; this is the range that keeps that true
        // even when a shoal wanders close.
        scale: random.range(0.45, 0.8),
      });
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

      // Near-field cap. A background animal only fails when it is large in
      // frame — it was three flat facets and an outline at a metre when it was
      // a diamond, and it is a bare round body with no eye, no gill and no
      // pattern now, which is the same failure with softer edges. Distance is
      // what the whole design of it assumes. The standoff bends shoal courses
      // away from the diver, but it is a steering force — a fish already
      // inside the bubble when a capture teleports the camera stays there
      // for the settle. So the render itself shrinks close fish toward the
      // small end of the scale range, blended over 6-12m so nothing pumps.
      const dx = x - viewer.x;
      const dy = y - viewer.y;
      const dz = z - viewer.z;
      const range = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const far = Math.min(1, Math.max(0, (range - 6) / 6));
      const nearScale = Math.min(fish.scale, 0.55);
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(pitch, yaw, bank, "YXZ");
      this.dummy.scale.setScalar(nearScale + (fish.scale - nearScale) * far);
      this.dummy.updateMatrix();
      this.matrix.copy(this.dummy.matrix);
      this.mesh.setMatrixAt(i, this.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
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
}
