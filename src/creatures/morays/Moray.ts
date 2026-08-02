import {
  Bone,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  Object3D,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
} from "three";
import { requestAlbedo, requestModel } from "../../rendering/AssetLibrary";
import { diverMotion, requestSandPuff } from "../../rendering/SandPuffs";
import { createToonMaterial } from "../../rendering/ToonShading";
import { playMorayPeek } from "./MorayAudio";
import { buildMorayBody } from "./MorayBody";
import {
  buildGlbHeadSkeleton,
  glbHeadScale,
  GLB_EYE_RADIUS,
  GLB_LENGTH_TRIM,
  GLB_NOSTRIL,
  GLB_NOSTRIL_DIRECTION,
  GLB_SOCKET,
  HEAD_MODEL_PATH,
  prepareGlbHeadGeometry,
} from "./MorayGlbHead";
import { projectHeadUvs } from "./MorayHeadUv";
import { addMorayOutline, addSkinnedHull } from "./MorayOutline";
import { createMoraySkin } from "./MorayPattern";
import { personalityFor, personalitySeed, type MorayPersonality } from "./MorayPersonality";
import {
  MorayPresence,
  presenceSeed,
  type MorayPresenceState,
  type PresencePose,
} from "./MorayPresence";
import type { BodyArchetype, MoraySpeciesConfig } from "./MoraySpeciesConfig";
import { Random } from "../../util/Random";

/** Named runtime handles shared by every species (the common contract). */
export interface MorayAsset {
  readonly root: Group;
  readonly bodyRoot: Object3D;
  readonly head: Object3D;
  readonly upperJaw: Object3D;
  readonly lowerJaw: Object3D;
  readonly leftEye: Object3D;
  readonly rightEye: Object3D;
  readonly speciesId: string;
}

interface ArchetypeShape {
  readonly segments: number;
  readonly headScale: number;
  readonly segmentLength: number;
}

/**
 * A tube running along +Z, tapering from `frontRadius` to `backRadius`.
 * Cylinders are built around +Y, so the geometry is rotated once at build time
 * rather than every segment carrying its own correction.
 */
function tube(frontRadius: number, backRadius: number, length: number): CylinderGeometry {
  const geometry = new CylinderGeometry(frontRadius, backRadius, length, 10, 1, true);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/**
 * A cool edge light on every skin surface.
 *
 * The reef has one sun and a fill, so a head set back in a crevice has nothing
 * behind it: the animal the game asks the player to study is the only subject
 * in frame without a silhouette. This is the back light the cave cannot give
 * it — water-coloured rather than white, because a warm rim here reads as a
 * second sun, and emissive, so it survives the shadow the mound casts.
 *
 * Two things about it are load-bearing, and both were found by rendering it
 * wrong first.
 *
 * It is weighted by a fixed world direction — up and behind, opposite the sun —
 * and not by facing alone. A moray is a tube running away from the camera, and
 * every side normal of a tube seen end-on is perpendicular to the view, so a
 * plain fresnel scores the whole animal as silhouette and turns it into a cool
 * glowing blob. The direction is what makes it an edge.
 *
 * And it runs before the skin's normal map is applied, on the smooth geometric
 * normal: the wrinkle map throws normals far enough off that the rim breaks up
 * into a haze across the body instead of following the silhouette.
 *
 * The source is a module constant and identical for every material on purpose:
 * three keys its program cache on `onBeforeCompile.toString()`, so two
 * materials whose injected source differed only in a baked-in constant would
 * silently share one program — and one of them would wear the other's numbers.
 *
 * It survived the move to ramp shading untouched. The toon fragment shader
 * carries the same `normal_fragment_maps` chunk in the same place and reaches
 * `totalEmissiveRadiance` the same way, and emissive is the one channel a
 * stepped light leaves alone — which is what this rim needed in the first
 * place, since a crevice gives it no light to step.
 */
const RIM_LIGHT_CHUNK = /* glsl */ `
  vec3 rimWorldNormal = inverseTransformDirection( normal, viewMatrix );
  float rimFacing = 1.0 - saturate( dot( normalize( vViewPosition ), normal ) );
  float rimBack = saturate( dot( rimWorldNormal, normalize( vec3( -0.35, 0.9, -0.4 ) ) ) );
  totalEmissiveRadiance +=
    vec3( 0.34, 0.56, 0.64 ) * pow( rimFacing, 2.0 ) * pow( rimBack, 3.0 ) * 0.65;
  #include <normal_fragment_maps>
`;

/** Adds {@link RIM_LIGHT_CHUNK}. Inert in Node: nothing compiles without a renderer. */
function addRimLight(material: MeshToonMaterial): MeshToonMaterial {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      RIM_LIGHT_CHUNK,
    );
  };
  return material;
}

/** What the nasal tubes keep of the accent's saturation, and of its value. */
const NASAL_SATURATION = 0.72;
const NASAL_VALUE = 0.78;

/**
 * The accent colour as tissue rather than as signage; see `nasalMaterial`.
 *
 * Hue is untouched, because the hue is the species — a ribbon moray's nostrils
 * are yellow and a dragon's are orange, and that is a field mark. Only the two
 * terms that make a colour look like moulded plastic come down.
 *
 * The conversion is pinned to sRGB rather than left to the working space. HSL
 * has no meaning without one, and three's default here is linear-sRGB, where a
 * given fraction of "lightness" is a far deeper cut than the same fraction of
 * the value a painter — or the palette these colours were picked in — means by
 * it.
 */
function softenAccent(accent: Color): Color {
  const hsl = { h: 0, s: 0, l: 0 };
  accent.getHSL(hsl, SRGBColorSpace);
  return new Color().setHSL(
    hsl.h,
    hsl.s * NASAL_SATURATION,
    hsl.l * NASAL_VALUE,
    SRGBColorSpace,
  );
}

/** Seconds of turn each joint lags the head by; see `update`. */
const BANK_SECONDS = 0.4;
/** Hard limit on that lag, in radians per joint. */
const MAX_BANK = 0.13;

/**
 * Seconds the root has to hold still before the presence cycle engages
 * (W-L7). This one number is three guarantees at once:
 *
 * - a sanctuary resident — whose root is re-posed along its lemniscate every
 *   frame — never engages at all, so the den behaviour cannot leak into an
 *   animal that has no den;
 * - a codex portrait settles for exactly 1 simulated second, inside this
 *   window, so every plate is bit-identical to the pre-presence ones;
 * - `tests/morayHead.test.ts` pins the head's world position on the root
 *   through 2 simulated seconds, also inside it, so that contract holds to
 *   the bit.
 *
 * The reef's morays are placed once, before their first update, and sit still
 * for the rest of the session — they engage two and a half seconds into the
 * dive and stay engaged.
 */
const PRESENCE_ENGAGE_SECONDS = 2.5;

/** How far away a peek is still worth its low murmur, in metres. */
const PEEK_AUDIO_RANGE = 18;

/** Extra jaw swing a fully curious animal adds over the attend gape. */
const GLB_CURIOUS_GAPE = 0.05;

/** Where the silt kicks up: forward of the den anchor and below the head, so
 * the cloud blooms at the mouth ledge the body scraped instead of behind the
 * animal, where the first render lost it entirely. */
const PUFF_FORWARD = 0.45;
const PUFF_DROP = 0.3;

/**
 * The den peek recomposed (W-N3): a resting arch, worn only by den dwellers.
 *
 * The authored peek used to be a straight horizontal tube with a head on the
 * end — which is exactly what the round critic saw in the opening frame: "a
 * pale banded cylinder hovering horizontally beside a rock, unanchored". A
 * real peek is a question mark: the head tilts up to look, and the body's
 * first bend dives back down into the den shadow, so the silhouette says
 * "something lives here" rather than "log floats here".
 *
 * Three constraints shaped the numbers, all of them other packages'
 * guarantees:
 *
 * - **The head's world position does not move.** The lift is a rotation of
 *   the head node about its own origin and the arch is joint rotation behind
 *   it, so `getHeadWorldPosition`, the focus cone, the sightline raycasts and
 *   `tests/morayHead.test.ts`'s pin all read exactly what they read before.
 * - **It engages behind the same gate as the presence cycle.** A sanctuary
 *   resident (root re-posed every frame) never wears it, and a codex
 *   portrait (1 s settle, inside the 2.5 s gate) stays bit-identical, for
 *   the same reasons W-L7's offset does. The blend then eases in over
 *   {@link DEN_ARCH_EASE} seconds and saturates at exactly 1, so a capture
 *   taken any time after the first few seconds of a session sees one pose.
 * - **The dive is behind the first joint, not on it.** Joint 0 shares the
 *   head's origin, and pitching it opens an angular step at the neck ring
 *   the sculpted head does not follow; from joint 1 back the bend lands
 *   0.5–0.7 m behind the head — at the den doorway, which is where the
 *   critic asked for the first bend to be visible.
 *
 * The arch relaxes partway while the animal stands extended and scanning
 * (`presence.scan`): a body that has left the den is swimming, not peeking,
 * and holding the full dive on it reads as a kink.
 */
const DEN_ARCH_EASE = 2;
/** Radians the resting head tilts up at the den; yields to the gaze. 0.38 was
 * tried first and over-rotated the head-on view (shot C read as all chin) —
 * the body dive supplies the rest of the 20–30° neck curve in profile. */
const HEAD_PEEK_LIFT = 0.32;
/** Per-joint resting pitch behind the head: dive into the shadow, then level. */
const DEN_ARCH_PITCH: readonly number[] = [0, -0.13, -0.11, -0.05, 0.07, 0.11, 0.07];

/**
 * Frame-edge staging (W-O2): the resting yaw a den dweller surveys along, in
 * radians about the head's own origin — positive turns the snout toward the
 * den's local right (world +z for a den facing −x).
 *
 * It exists for one measured collision. The zebra's den anchor at (13, 1.4, 6)
 * stands ~15° outside the right frustum edge of the canonical B/H/X camera
 * ((10, 3, 12), yaw 0.72), and its sculpted head reaches 2.1 m further west —
 * so ~0.3 m of bare snout crossed back into frame and rendered as the round
 * critic's "overturned dish with a handle": a cream-outlined fragment whose
 * eye can never be in frame (it sits 2 m outside the frustum, and the anchor
 * is FROZEN). No fragment of that head can read as a creature from B, so the
 * fix is the other allowed outcome — the snout stays out of frame. Yawed
 * south, the patroller surveys down the z ≈ 6 corridor it is approached
 * along, and from shot A's camera (which watches this den from the
 * south-west) the face turns *toward* the lens, which reads better anchored,
 * not worse.
 *
 * Three fences, all inherited: it is a rotation about the head node's origin,
 * so the head's world position — the sightline target, the focus cone, the
 * `morayHead` pin — holds to the bit; it is gated by `archGain`, so a driven
 * (sanctuary) animal and a settling portrait never wear it; and it is
 * deliberately *not* yielded to `lookBlend` — the B camera itself sits inside
 * the curiosity band (6.9 m of the 7 m ceiling), so a pose that the gaze
 * cancels is a pose the canonical settle removes. The gaze offsets *from*
 * this survey heading instead, which for a corridor diver (gaze ≈ −0.55 for
 * a western approach) lands the attended face nearly back on the corridor
 * axis.
 */
const DEN_FACE_YAW: Readonly<Record<string, number>> = {
  // 0.78 cleared B and X; H's nine-second settle grows the curiosity lean
  // (the head slides ~0.15 m back into frame) and its full lookBlend carries
  // the gaze term's −0.16, so the corner needed the rest of the swing.
  "zebra-moray": 0.92,
};

/**
 * The extended flourish recomposed (W-N3), for the species that carry
 * `motion.extendFlare`: a standing lateral sweep, worn only while extended
 * (`presence.scan` gates it, so it needs the den machinery engaged and the
 * animal out of cover). K3 read the extended ribbon as "a small blue
 * inflatable dinghy": the pose is photographed down its own den axis, and a
 * body whose rest curve is a 0.07 rad S foreshortens into a lozenge directly
 * behind the head. The flare turns the body broadside instead — cumulative,
 * about a radian within the first two metres of body — so the dancer ribbons
 * across the frame the way the fact card promises.
 *
 * It is a spiral, not a flat turn, and the vertical half carries the read:
 * K3 is photographed straight down the den axis, so a yaw-only sweep
 * foreshortens into the same lozenge (the first cut proved it — 0.16 rad per
 * joint moved the visible body a third of a metre and the frame within
 * noise). Only a metre and a half of body ever stands outside the den (the
 * MAX_EXTENSION fence is a sightline guarantee and takes no style), so the
 * flourish spends that stretch *upward*: the first joints arc the body into
 * a raised loop that silhouettes against the violet cave mouth behind it,
 * and the later joints fold it back down into the den. Lateral yaw plus
 * vertical lift is a dancer's line; lateral alone was a bilge.
 */
const EXTEND_FLARE: readonly number[] = [0, 0.45, 0.55, 0.35, 0.1, -0.05, -0.15, -0.15, -0.1, -0.05];
const EXTEND_FLARE_LIFT: readonly number[] = [0, 0.3, 0.25, 0.05, -0.12, -0.2, -0.08, 0.1, 0.18, 0.1];

/** What `update` poses against while the presence cycle is not engaged. */
const NEUTRAL_PRESENCE: Readonly<PresencePose> = {
  state: "peeking",
  offset: 0,
  curve: 1,
  scan: 0,
  surge: 0,
  curiosity: 0,
  peekBegan: false,
  puffStrength: 0,
};

/** The primitive eye bead's radius, in the head's own metres; see `GLB_EYE_RADIUS`. */
const PRIMITIVE_EYE_RADIUS = 0.06;

/**
 * How the sculpted jaw breathes, on top of its baked ~11° rest gape.
 *
 * The primitive jaws ventilate over 0..0.28 rad because each pivot only moves
 * its own half of a mouth built shut; the sculpt already stands open, so the
 * same swing on the bone would be a yawn every four seconds. A quarter of it
 * reads as the slow pumping a resting moray actually does. (The first cut of
 * both numbers was bigger — 0.35 and 0.14 — and the probe renders showed a
 * reef of gaping maws: at rest gape 11° is already an open mouth.)
 *
 * The attention gape rides on `lookBlend` — the one behaviour signal the
 * animal has, the same blend that turns the head toward a close or curious
 * diver — so the mouth opens wider exactly when the animal is peeking at the
 * player, and eases back as they leave. It is additive and never negative:
 * the mouth never shuts below its sculpted rest.
 */
const GLB_BREATHE = 0.25;
const GLB_ATTEND_GAPE = 0.06;
/**
 * A constant lean toward closed, inside the −11° the contract allows. The
 * sculpt's rest gape reads right on a standalone prop and as a dark maw on a
 * dark species in a dark den — the zebra's whole lower face went to lining.
 * Rest now swings ~7–11° and full attention reaches ~14°; the mouth never
 * shuts (the swing's floor is ~6° of the baked gape still open).
 */
const GLB_GAPE_BIAS = -0.08;

/** Accent nasal cones on the sculpted head, in model metres (scaled with it). */
const GLB_NASAL_RADIUS = 0.009;
const GLB_NASAL_LENGTH = 0.06;

/**
 * The ribbon's flourish (W-M2): a spontaneous full-body ripple, a travelling
 * wave a couple of seconds long riding on top of the ordinary sway. Its
 * timing draws from the species' own `SEEDS.personality` stream, and its
 * clock only runs once the presence cycle has engaged — so a sanctuary
 * resident never ripples, and the first one lands no earlier than
 * {@link RIPPLE_FIRST}[0] seconds after engage, past the presence machine's
 * own 150 s opening ceiling: every capture settle and e2e spec is over long
 * before the reef starts dancing.
 */
const RIPPLE_SECONDS = 2.4;
const RIPPLE_FIRST: readonly [number, number] = [155, 215];
const RIPPLE_GAP: readonly [number, number] = [30, 75];
/** An animal in cover does not flourish; try again shortly after. */
const RIPPLE_RETRY = 8;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Cone geometry's own axis, for aiming the accent nostrils. */
const UP = new Vector3(0, 1, 0);

const ARCHETYPES: Record<BodyArchetype, ArchetypeShape> = {
  ribbon: { segments: 13, headScale: 0.7, segmentLength: 0.34 },
  standard: { segments: 9, headScale: 0.9, segmentLength: 0.38 },
  robust: { segments: 8, headScale: 1.15, segmentLength: 0.44 },
  compact: { segments: 7, headScale: 1.0, segmentLength: 0.36 },
};

/**
 * A procedurally built moray: a sculpted head with jaw, eyes and optional nasal
 * appendages, on a skinned body and dorsal fin that can recede into a crevice
 * or swim freely in the sanctuary. Individuality comes from the species config
 * layered onto shared machinery.
 */
export class Moray {
  readonly asset: MorayAsset;

  /**
   * Grafts the sculpted head (`creature-moray-head.glb`) onto this animal.
   *
   * In the game it is called exactly once, by the `AssetLibrary` request the
   * constructor makes — synchronously out of the cache for every animal after
   * the first. It is a public seam because the library is inert in Node, and
   * the unit tests graft the real file through here instead; the geometry it
   * is handed is the library's (or the test's) and is only ever cloned.
   */
  readonly adoptSculptedHead: (source: BufferGeometry) => void;

  /**
   * The den life this animal leads (W-L7): temperament, the tucked → peeking
   * → extended cycle, the startle and the curiosity lean. Public because the
   * unit tests and the QA door drive states the ambient clock takes minutes
   * to reach; the game itself never touches it.
   */
  readonly presence: MorayPresence;

  /**
   * Who this species is (W-M2): the parameter set that biased `presence`
   * above and styles the sway, gaze and jaw below. Data, never machinery.
   */
  readonly personality: MorayPersonality;

  private readonly joints: Bone[] = [];
  /** Per-individual expression draws (`SEEDS.personality`); see the ripple. */
  private readonly expression: Random;
  private rippleClock = 0;
  private rippleAt: number;
  private rippleUntil = -1;
  private readonly shape: ArchetypeShape;
  private breatheTime = 0;
  private swayTime = 0;
  private lookBlend = 0;
  private readonly headWorld = new Vector3();
  private readonly toPlayer = new Vector3();
  /** Den-anchor bookkeeping for the presence gate; see `advancePresence`. */
  private readonly rootAnchor = new Vector3();
  private hasRootAnchor = false;
  private stationarySeconds = 0;
  private presenceRegistered = false;
  /** 0..1 ease of the den peek arch; see {@link DEN_ARCH_EASE}. */
  private denBlend = 0;
  private readonly puffPoint = new Vector3();
  /** The sculpted head's hinge, once the GLB has landed; see `update`. */
  private glbJaw: Bone | null = null;
  /** Its material, so a painted albedo landing later still reaches the face. */
  private glbHeadMaterial: MeshToonMaterial | null = null;

  constructor(readonly config: MoraySpeciesConfig) {
    this.shape = ARCHETYPES[config.archetype];
    this.personality = personalityFor(config.id);
    this.presence = new MorayPresence(presenceSeed(config.id), this.personality.presence);
    this.expression = new Random(personalitySeed(config.id));
    this.rippleAt = this.expression.range(RIPPLE_FIRST[0], RIPPLE_FIRST[1]);

    const accentColor = new Color(config.accentColor);

    // Markings, counter-shading and skin folds are all painted.
    const skin = createMoraySkin(config);
    const bodyMaterial = addRimLight(
      createToonMaterial({
        map: skin.map,
        normalMap: skin.normalMap,
      }),
    );
    // Upgrade the albedo to the painted one if there is a painted one. Only the
    // albedo: the wrinkles and the broken wet sheen live in the procedural
    // normal and roughness maps, which the painting has no channel for and no
    // reason to replace. The material is untinted — `bodyMaterial` is built
    // without a `color`, so it is white and multiplies the map by 1 — which is
    // also what makes the procedural path work, since that map already carries
    // the species colour. Nothing arrives here in Node, and nothing arrives if
    // the file is missing; either way the skin above is what stays on.
    if (config.albedoAsset) {
      requestAlbedo(config.albedoAsset, (albedo) => {
        bodyMaterial.map = albedo;
        bodyMaterial.needsUpdate = true;
        // The sculpted head's material copies `bodyMaterial.map` when it is
        // built; if the painting lands after the sculpt, it is carried across
        // here so the face and the body never wear two different skins.
        if (this.glbHeadMaterial) {
          this.glbHeadMaterial.map = albedo;
          this.glbHeadMaterial.needsUpdate = true;
        }
      });
    }

    // The nasal tubes are skin, not signage. They wear the species' accent, but
    // the accent is authored to be *found* across ten metres of water on a fin
    // margin, and at full strength on a bare untextured cone twenty centimetres
    // from the eye it is the brightest, flattest thing on a painted face — a
    // plastic horn stuck to an animal. Held down in saturation and value it
    // keeps the hue that identifies the species and gives up the glow.
    const nasalMaterial = addRimLight(createToonMaterial({ color: softenAccent(accentColor) }));
    // The fin wears the accent colour flat. It used to also wear a roughness of
    // its own, because it is a broad thin surface the camera meets edge-on as
    // often as not and a tighter lobe hung a hard highlight all down its top
    // edge — a spike over a head in a dark crevice. Ramp shading settles that
    // argument for it: there is no lobe left to spread.
    const finMaterial = addRimLight(createToonMaterial({ color: accentColor }));

    const root = new Group();
    const bodyRoot = new Object3D();
    root.add(bodyRoot);

    const segmentLength = this.shape.segmentLength * config.lengthScale;

    // The chain the wave is driven down. These used to each carry a cylinder;
    // now they are the skeleton one continuous tube is skinned to, so `update`
    // is unchanged and the same wave bends the body instead of hinging it.
    let parent: Object3D = bodyRoot;
    for (let i = 0; i < this.shape.segments; i++) {
      const joint = new Bone();
      joint.position.z = i === 0 ? 0 : -segmentLength;
      parent.add(joint);
      this.joints.push(joint);
      parent = joint;
    }

    const rig = buildMorayBody({
      jointCount: this.shape.segments,
      jointSpacing: segmentLength,
      girthScale: config.girthScale,
    });
    // One texture spanning the animal head to tail: the tube's `v` already
    // runs 0 at the snout to 1 at the tip, which is the space `MorayPattern`
    // paints in.
    const body = new SkinnedMesh(rig.body, bodyMaterial);
    const fin = new SkinnedMesh(rig.fin, finMaterial);
    for (const skinned of [body, fin]) {
      // Three would otherwise bound these from whichever pose the bones are in
      // at the first render and never update it. See `BOUNDS_SLACK`.
      skinned.boundingSphere = rig.bounds.clone();
      bodyRoot.add(skinned);
    }

    // Bind while the rig is still in its rest pose: the inverses taken here are
    // what every later pose is measured against.
    root.updateMatrixWorld(true);
    const skeleton = new Skeleton(this.joints);
    body.bind(skeleton);
    fin.bind(skeleton);

    const head = new Object3D();
    bodyRoot.add(head);
    const headScale = this.shape.headScale;

    // The primitive head, under one node so that the sculpted head — which
    // arrives through `AssetLibrary` on its own schedule, or never — can
    // retire it in one motion, contour hulls and all. It is the fallback in
    // exactly the sense the procedural skin is: the animal is complete before
    // the request is made and stays complete if nothing ever lands.
    const primitiveHead = new Object3D();
    head.add(primitiveHead);

    // A tapered cranium rather than a ball. This is the object the player is
    // asked to hold a reticle on for a second and a half, so its silhouette
    // carries the game's key moment: a snout that narrows forward, a brow that
    // overhangs the eye, and a jaw line beneath it.
    const skull = new Mesh(new SphereGeometry(0.29 * headScale, 14, 12), bodyMaterial);
    skull.scale.set(0.82, 0.78, 1.16);
    skull.position.z = 0.26 * headScale;
    primitiveHead.add(skull);

    const snout = new Mesh(tube(0.13 * headScale, 0.25 * headScale, 0.34 * headScale), bodyMaterial);
    snout.scale.set(0.88, 0.82, 1);
    snout.position.set(0, 0.01 * headScale, 0.52 * headScale);
    primitiveHead.add(snout);

    const brow = new Mesh(new SphereGeometry(0.1 * headScale, 8, 7), bodyMaterial);
    brow.scale.set(1.9, 0.62, 1.25);
    brow.position.set(0, 0.17 * headScale, 0.36 * headScale);
    primitiveHead.add(brow);

    const upperJaw = new Object3D();
    upperJaw.position.set(0, 0.06 * headScale, 0.5 * headScale);
    const upperJawMesh = new Mesh(
      tube(0.09 * headScale, 0.19 * headScale, 0.42 * headScale),
      bodyMaterial,
    );
    upperJawMesh.scale.set(1, 0.62, 1);
    upperJawMesh.position.z = 0.17 * headScale;
    upperJaw.add(upperJawMesh);
    primitiveHead.add(upperJaw);

    if (config.nasalAppendages) {
      for (const side of [-1, 1]) {
        const tube = new Mesh(new ConeGeometry(0.05 * headScale, 0.22 * headScale, 6), nasalMaterial);
        tube.position.set(side * 0.1 * headScale, 0.14 * headScale, 0.42 * headScale);
        tube.rotation.x = Math.PI / 2.4;
        upperJaw.add(tube);
      }
    }

    const lowerJaw = new Object3D();
    lowerJaw.position.set(0, -0.08 * headScale, 0.5 * headScale);
    // The jaw wears the skin, like the rest of the head. It used to wear a flat
    // three-quarter-value copy of the body colour, which was a fair stand-in
    // beside a low-contrast procedural map and is not one beside a painted
    // face: untextured, it is the largest single flat surface on the animal and
    // the eye reads it as a plastic bib hung under the jaw line. `bodyMaterial`
    // also carries the rim light the chin needs to keep the bottom edge of the
    // silhouette, which the bespoke material was built to provide.
    const lowerJawMesh = new Mesh(tube(0.08 * headScale, 0.17 * headScale, 0.4 * headScale), bodyMaterial);
    lowerJawMesh.scale.set(1, 0.55, 1);
    lowerJawMesh.position.z = 0.17 * headScale;
    lowerJaw.add(lowerJawMesh);
    primitiveHead.add(lowerJaw);

    // Every part above wears `bodyMaterial` on the texture coordinates its own
    // primitive generator authored, which smears the map's whole length across
    // a head and rolls the counter-shading a quarter turn. Re-wrap them in the
    // body's space, into the band of the map the neck continues from. This runs
    // once the head is fully assembled so the jaw is projected in the same pass
    // and in the same frame as the skull it hangs from — a part's own offset
    // and rotation inside the head is what the projection divides out, and the
    // jaw's is a pivot, not a placement.
    projectHeadUvs(head, [skull, snout, brow, upperJawMesh], rig.neckV, [lowerJawMesh]);

    const eyeGeometry = new SphereGeometry(PRIMITIVE_EYE_RADIUS * headScale, 10, 10);
    // The bead is ramp-shaded like the rest of the animal. It used to be a
    // near-mirror — roughness 0.08 — which on a sphere is a pinpoint, and a
    // pinpoint is precisely what this pivot is removing from the frame. The
    // wet spark was never that highlight anyway; it is the catchlight below,
    // which is a modelled object and survives untouched.
    const eyeMaterial = createToonMaterial({ color: 0x14100e, emissive: 0x241a12 });
    // A wet catchlight is what separates "a creature is looking at you" from
    // "two dark beads"; the bloom pass then gives it a faint wet flare.
    // Sized for the distance the game is actually played at: at the range shot
    // C frames the crevice from, the old bead covered well under a pixel and
    // fell below the bloom threshold, so the one spark in the frame was gone
    // exactly when the player was being asked to look for it.
    //
    // This is the one lit-material type the ramp pivot left alone, and the
    // reason is that it is not a lit surface: it is a bloom source wearing a
    // sphere, held above 1 by an emissive of 3.2 and taken out of the tone
    // curve entirely. Ramping it would step a diffuse term that contributes
    // under a sixth of what it puts on screen, and would risk the one spark the
    // discovery moment is built around for nothing.
    const catchlightGeometry = new SphereGeometry(0.028 * headScale, 8, 8);
    const catchlightMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff4e2,
      emissiveIntensity: 3.2,
      toneMapped: false,
    });

    // Set into sockets under the brow rather than stuck on the surface.
    const leftEye = new Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.15 * headScale, 0.115 * headScale, 0.4 * headScale);
    head.add(leftEye);
    const rightEye = new Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.15 * headScale, 0.115 * headScale, 0.4 * headScale);
    head.add(rightEye);

    for (const eye of [leftEye, rightEye]) {
      const catchlight = new Mesh(catchlightGeometry, catchlightMaterial);
      catchlight.position.set(0.022 * headScale, 0.026 * headScale, 0.046 * headScale);
      eye.add(catchlight);
    }

    root.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
      }
    });

    // Last, and after the traverse above rather than before it: the contour is
    // a drawn line and must not cast a shadow. The parts it is given are the
    // ones that carry the silhouette — the tube, the fin and the five head
    // primitives. The eyes, their catchlights and the nasal tubes are left
    // out: the first two for the reason `MorayOutlineParts` gives, and the
    // tubes because a twelve-millimetre shell on a five-centimetre cone is not
    // a line around an appendage, it is a fatter appendage.
    const outlineMaterial = addMorayOutline(config.bodyColor, {
      skinned: [body, fin],
      rigid: [skull, snout, brow, upperJawMesh, lowerJawMesh],
    });

    this.asset = {
      root,
      bodyRoot,
      head,
      upperJaw,
      lowerJaw,
      leftEye,
      rightEye,
      speciesId: config.id,
    };

    // The sculpted head, when there is one. Same contract as the painted
    // albedo above: nothing arrives in Node and nothing arrives if the file
    // is missing, and the primitive head just built stays on. When it does
    // arrive, the swap retires the primitives and their hulls, grafts the
    // skinned head at the neck ring, and reseats the eyes in its sockets.
    this.adoptSculptedHead = (source) => {
      if (this.glbJaw) {
        return;
      }
      const scale = glbHeadScale(rig.neckRadius);
      const geometry = prepareGlbHeadGeometry(source, { scale, neckV: rig.neckV });

      // The head wears the body's map on the file's own UVs — the sculpt's
      // band is the analytic form of `projectHeadUvs`, rescaled to this
      // archetype's `neckV` — plus the sculpt's vertex colours, which after
      // `prepareGlbHeadGeometry` carry only the dark mouth lining. A separate
      // material rather than `bodyMaterial` because `vertexColors` is a
      // program-level switch, and the tube has no colour attribute to feed it.
      this.glbHeadMaterial = addRimLight(
        createToonMaterial({
          map: bodyMaterial.map,
          normalMap: skin.normalMap,
          vertexColors: true,
        }),
      );

      const { root: headBone, jaw } = buildGlbHeadSkeleton(scale);
      const glbHead = new SkinnedMesh(geometry, this.glbHeadMaterial);
      glbHead.name = "moray-glb-head";
      glbHead.castShadow = true;
      glbHead.add(headBone);
      head.add(glbHead);

      // Bind in one consistent snapshot: the bind matrix and the bone
      // inverses are taken from the same `updateMatrixWorld` pass, so the
      // graft is exact whether it happens in this constructor or ten seconds
      // into a swim.
      root.updateMatrixWorld(true);
      glbHead.bind(new Skeleton([headBone, jaw]));
      // Explicit, with the slack `prepareGlbHeadGeometry` gave it — the same
      // rule the body follows, or three bounds it from the first pose drawn.
      if (geometry.boundingSphere) {
        glbHead.boundingSphere = geometry.boundingSphere.clone();
      }
      this.glbJaw = jaw;

      // The same ink the rest of the animal wears, on the same trick the
      // body uses: the hull shares the geometry, the skeleton and the bind
      // matrix, so the line follows the jaw for free.
      addSkinnedHull(glbHead, outlineMaterial);

      // The eyes move into the sculpted sockets and shrink to fit them —
      // the beads and their catchlights are kept, only re-seated, so the
      // catchlight's offset and the bloom it feeds scale down with the ball.
      const eyeScale = (GLB_EYE_RADIUS * scale) / (PRIMITIVE_EYE_RADIUS * headScale);
      for (const [eye, side] of [
        [leftEye, -1],
        [rightEye, 1],
      ] as const) {
        eye.position.set(
          side * GLB_SOCKET.x * scale,
          GLB_SOCKET.y * scale,
          GLB_SOCKET.z * scale * GLB_LENGTH_TRIM,
        );
        eye.scale.setScalar(eyeScale);
      }

      // The sculpt has small flared nostril shells of its own, for every
      // species; the raised accent appendages of the ribbon and the dragon
      // grow out of them, sized to the sculpted tubes rather than to the
      // primitive snout they used to stand on.
      if (config.nasalAppendages) {
        for (const side of [-1, 1]) {
          const cone = new Mesh(
            new ConeGeometry(GLB_NASAL_RADIUS * scale, GLB_NASAL_LENGTH * scale, 6),
            nasalMaterial,
          );
          const direction = GLB_NOSTRIL_DIRECTION.clone();
          direction.x *= side;
          cone.quaternion.setFromUnitVectors(UP, direction);
          cone.position
            .set(side * GLB_NOSTRIL.x, GLB_NOSTRIL.y, GLB_NOSTRIL.z * GLB_LENGTH_TRIM)
            .multiplyScalar(scale)
            .addScaledVector(direction, GLB_NASAL_LENGTH * scale * 0.35);
          cone.castShadow = true;
          head.add(cone);
        }
      }

      // The primitives and their hulls go together. Geometries only: the
      // body material, the nasal material and the outline material all live
      // on parts that stay.
      head.remove(primitiveHead);
      primitiveHead.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
        }
      });
    };
    requestModel(HEAD_MODEL_PATH, this.adoptSculptedHead);
  }

  /** World position of the head, used by the discovery focus system. */
  getHeadWorldPosition(out = this.headWorld): Vector3 {
    return this.asset.head.getWorldPosition(out);
  }

  /**
   * @param turnRate Yaw rate of the path the animal is following, in radians
   * per second, or 0 for an animal that is holding station — which is every
   * moray in the reef, so the default leaves their motion untouched.
   */
  update(dt: number, playerPosition: Vector3, curious: boolean, turnRate = 0): void {
    this.breatheTime += dt;
    this.swayTime += dt;

    // The den life, before anything that poses a bone: the offset it decides
    // slides the whole rig, and the blends it returns colour the sway, the
    // gaze and the gape below.
    const presence = this.advancePresence(dt, playerPosition);

    // The species' movement language (W-M2): every multiplier below is 1 on
    // the neutral profile, so an unprofiled species moves exactly as before.
    const motion = this.personality.motion;

    // Rhythmic jaw ventilation — the moray's natural, gentle character, at
    // the species' own resting rate.
    const ventilation = (Math.sin(this.breatheTime * 1.6 * motion.breatheTempo) * 0.5 + 0.5) * 0.28;
    this.asset.lowerJaw.rotation.x = ventilation;
    this.asset.upperJaw.rotation.x = -ventilation * 0.35;

    // Curvature the body inherits from the path it is on.
    //
    // The root only carries the head's heading, so an animal on a curve drifts
    // sideways like a ship unless every joint takes a share of the turn. The
    // sign is negative because the body *trails*: joint
    // i is where the head was `i` segment-times ago, when it was pointing that
    // much further back around the turn. The magnitude is that lag in seconds —
    // roughly how long a segment takes to pass a point at swimming speed — and
    // it is clamped because a figure-eight's ends are tighter than any eel can
    // actually bend, and past this the animal coils into a spring.
    const bank = clamp(-turnRate * BANK_SECONDS, -MAX_BANK, MAX_BANK);

    // Slow body sway travelling down the chain, over a resting S-curve. Without
    // the resting curve a moray at rest is a straight pipe; eels are never
    // straight, and the curve is most of what sells the animal at a glance.
    //
    // The presence cycle colours both terms (W-L7): `curve` bunches the
    // S-curve while the animal is tucked or being pulled backward and pours
    // it out flat while it surges forward — the root slides the head at once
    // and the body unwinds behind it, which is the head leading — and `scan`
    // widens the sway while it stands extended, watching the water.
    // The species styles the sway (W-M2): overall amplitude and tempo, how
    // much the extended scan widens it, and — the snowflake's dreamy sway —
    // an extra gain earned by curiosity, so trust is visible in the body.
    // The ribbon's spontaneous ripple rides on top as its own travelling wave.
    const swayGain =
      (1 + 0.35 * presence.scan * motion.scanSway + motion.curiositySway * presence.curiosity) *
      motion.swayAmplitude;
    const swayPhase = this.swayTime * motion.swayTempo;
    const ripple = this.advanceRipple(dt, presence);
    // The den peek arch (W-N3), eased in on its own clock and smoothstepped so
    // engaging is a settle rather than a step. It relaxes while the animal is
    // out scanning; the extend flare takes over the composition there.
    const denEase = this.denBlend * this.denBlend * (3 - 2 * this.denBlend);
    const archGain = denEase * (1 - 0.45 * presence.scan);
    const flareGain = motion.extendFlare * presence.scan * denEase;
    for (let i = 0; i < this.joints.length; i++) {
      const joint = this.joints[i];
      if (!joint) {
        continue;
      }
      const amplitude = (0.07 + i * 0.018) * swayGain;
      const rest = Math.sin(i * 0.55) * 0.07 * presence.curve + bank;
      joint.rotation.y =
        rest +
        flareGain * (EXTEND_FLARE[i] ?? 0) +
        Math.sin(swayPhase * 1.1 - i * 0.5) * amplitude +
        ripple * Math.sin(swayPhase * 5.2 - i * 0.9) * (0.05 + i * 0.015);
      joint.rotation.x =
        archGain * (DEN_ARCH_PITCH[i] ?? 0) +
        flareGain * (EXTEND_FLARE_LIFT[i] ?? 0) +
        Math.sin(swayPhase * 0.73 - i * 0.38) * amplitude * 0.3;
    }

    // Gentle head tracking that strengthens once the player is close/curious.
    this.getHeadWorldPosition(this.headWorld);
    this.toPlayer.subVectors(playerPosition, this.headWorld);
    const distance = this.toPlayer.length();
    const wantsToLook = curious || distance < 6 || presence.curiosity > 0.5 ? 1 : 0;
    // The species' eagerness (W-M2): the dragon's gaze snaps to a diver and
    // turns further to meet them; the hermit's barely follows at all.
    this.lookBlend += (wantsToLook - this.lookBlend) * Math.min(1, dt * 2 * motion.lookRate);

    const yaw = Math.atan2(this.toPlayer.x, this.toPlayer.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, this.toPlayer.y / Math.max(distance, 0.001))));
    // While extended and unwatched, the head sweeps slowly across the water —
    // scanning — and lifts a touch with the surge of an emergence. Both fade
    // out exactly as the tracking takes over, so the gaze always wins.
    const scanYaw = Math.sin(swayPhase * 0.42) * 0.16 * presence.scan * (1 - this.lookBlend);
    // The den survey heading (W-O2) is the base the gaze and the scan offset
    // from; see DEN_FACE_YAW for why it does not yield to the gaze.
    this.asset.head.rotation.y =
      (DEN_FACE_YAW[this.config.id] ?? 0) * archGain +
      yaw * 0.5 * motion.lookGain * this.lookBlend +
      scanYaw;
    // The peek lift yields to the gaze exactly as the scan sweep does: a head
    // that has found the diver aims at the diver, and the resting up-tilt is
    // what it aims *from*.
    this.asset.head.rotation.x =
      -pitch * 0.4 * motion.lookGain * this.lookBlend -
      Math.max(0, presence.surge) * 0.3 -
      HEAD_PEEK_LIFT * archGain * (1 - this.lookBlend);

    // The sculpted jaw: the same ventilation rhythm, scaled down because the
    // sculpt already stands open at rest, plus a wider gape while the animal
    // is attending to the player — after `lookBlend` above, so the mouth and
    // the gaze answer the same signal on the same frame. Curiosity adds its
    // own increment on top (W-L7): a moray studying a calm diver holds its
    // mouth a shade wider than one merely facing them.
    // The species' jaw language (W-M2) scales each term, never the baked
    // mechanics: the dragon carries its mouth wider and answers attention
    // with the broadest gape, the zebra and the hermit barely change theirs.
    if (this.glbJaw) {
      this.glbJaw.rotation.x =
        GLB_GAPE_BIAS * motion.gapeBias +
        ventilation * GLB_BREATHE +
        this.lookBlend * GLB_ATTEND_GAPE * motion.attendGape +
        presence.curiosity * GLB_CURIOUS_GAPE * motion.curiousGape;
    }
  }

  /**
   * Advances the flourish clock and returns this frame's ripple envelope
   * (0..ripple). See {@link RIPPLE_SECONDS}: engaged den dwellers only, first
   * fire beyond the opening quiescence, timing from the species' own
   * `SEEDS.personality` stream, halved under reduced motion (the kelp
   * convention), and never thrown while the animal is in cover.
   */
  private advanceRipple(dt: number, presence: Readonly<PresencePose>): number {
    const motion = this.personality.motion;
    if (motion.ripple === 0 || !this.presenceRegistered) {
      return 0;
    }
    this.rippleClock += dt;
    if (this.rippleClock >= this.rippleAt && this.rippleClock >= this.rippleUntil) {
      const showing = presence.state === "peeking" || presence.state === "extended";
      if (showing) {
        this.rippleUntil = this.rippleClock + RIPPLE_SECONDS;
        this.rippleAt = this.rippleUntil + this.expression.range(RIPPLE_GAP[0], RIPPLE_GAP[1]);
      } else {
        this.rippleAt = this.rippleClock + RIPPLE_RETRY;
      }
    }
    if (this.rippleClock >= this.rippleUntil) {
      return 0;
    }
    const t = 1 - (this.rippleUntil - this.rippleClock) / RIPPLE_SECONDS;
    const envelope = Math.sin(Math.PI * t);
    const reduced = diverMotion()?.reducedMotion ?? false;
    return envelope * envelope * motion.ripple * (reduced ? 0.5 : 1);
  }

  /**
   * Advances the presence cycle and applies its offset, or holds the animal
   * exactly on its authored pose while the cycle is not engaged.
   *
   * The gate is root stillness (see {@link PRESENCE_ENGAGE_SECONDS}): only an
   * animal whose root has held one position for a while is a den dweller.
   * The offset is applied to `bodyRoot`, which slides the head, the bone
   * chain and both skinned meshes as one rigid piece — the neck join cannot
   * open, the outline hulls ride along, and `getHeadWorldPosition` (and so
   * the discovery target `Game` copies from it every step) tracks the real
   * head for free. It is divided by the root's scale so the machine's metres
   * are world metres whatever size the reef dresses its animals at.
   */
  private advancePresence(dt: number, playerPosition: Vector3): Readonly<PresencePose> {
    const root = this.asset.root;
    if (!this.hasRootAnchor) {
      this.hasRootAnchor = true;
      this.rootAnchor.copy(root.position);
    }
    if (root.position.distanceToSquared(this.rootAnchor) > 1e-10) {
      // A driven animal (a sanctuary resident on its lane) is not in a den:
      // drop the gate, forget any offset, and follow the driver. The peek
      // arch goes with it — a swimming body wears no den pose.
      this.rootAnchor.copy(root.position);
      this.stationarySeconds = 0;
      this.denBlend = 0;
      this.asset.bodyRoot.position.z = 0;
      return NEUTRAL_PRESENCE;
    }

    this.stationarySeconds += dt;
    if (this.stationarySeconds < PRESENCE_ENGAGE_SECONDS) {
      return NEUTRAL_PRESENCE;
    }
    // Past the gate this is a den dweller: ease the peek arch in, to exactly
    // 1, so every capture taken after the first seconds sees one pose.
    this.denBlend = Math.min(1, this.denBlend + dt / DEN_ARCH_EASE);
    if (!this.presenceRegistered) {
      this.presenceRegistered = true;
      this.registerPresenceDoor();
    }

    // The diver's motion arrives over the channel `SandPuffs` publishes off
    // the frame's `LifeContext`; before the registry has run (or in a unit
    // test that never built one) the diver simply reads as still, which can
    // startle nothing.
    const motion = diverMotion();
    const pose = this.presence.update(dt, {
      distance: playerPosition.distanceTo(root.position),
      diverSpeed: motion?.speed ?? 0,
      reducedMotion: motion?.reducedMotion ?? false,
    });

    const scale = root.scale.x || 1;
    this.asset.bodyRoot.position.z = pose.offset / scale;

    if (pose.peekBegan) {
      const distance = playerPosition.distanceTo(root.position);
      if (distance < PEEK_AUDIO_RANGE) {
        playMorayPeek(0.9 * (1 - distance / PEEK_AUDIO_RANGE));
      }
    }
    if (pose.puffStrength > 0) {
      const facing = root.rotation.y;
      this.puffPoint
        .set(Math.sin(facing) * PUFF_FORWARD, -PUFF_DROP, Math.cos(facing) * PUFF_FORWARD)
        .add(root.position);
      requestSandPuff(this.puffPoint, pose.puffStrength);
    }
    return pose;
  }

  /**
   * Hangs this animal's presence controls on `window.__morayPresence`, keyed
   * by species — the visitors' `summon` door one system over, and for the
   * same reason: peek, extended and startle live on a minutes-long clock no
   * capture settle reaches, so the probes force them instead. Registered on
   * engage rather than at construction, so a sanctuary resident (same
   * species ids, own instances) can never shadow the reef's animals.
   */
  private registerPresenceDoor(): void {
    if (typeof window === "undefined") {
      return;
    }
    const w = window as unknown as {
      __morayPresence?: Record<
        string,
        {
          state: () => MorayPresenceState;
          force: (state: MorayPresenceState) => void;
          ripple: () => void;
        }
      >;
    };
    (w.__morayPresence ??= {})[this.asset.speciesId] = {
      state: () => this.presence.state,
      force: (state) => this.presence.force(state),
      // QA door for the flourish (W-M2): the first natural ripple sits past
      // the opening quiescence, minutes beyond any capture settle, so the
      // probe starts one directly. Species whose profile has no ripple
      // stay still — `advanceRipple` multiplies by `motion.ripple` — and
      // the game never calls this.
      ripple: () => {
        this.rippleUntil = this.rippleClock + RIPPLE_SECONDS;
      },
    };
  }
}
