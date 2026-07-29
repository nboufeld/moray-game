import {
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Vector2,
  type BufferGeometry,
  type DataTexture,
  type MeshToonMaterial,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { requestAlbedo } from "../rendering/AssetLibrary";
import { buildColorTexture, fbm } from "../rendering/ProceduralTexture";
import { smoothNormals } from "../rendering/SmoothNormals";
import { createToonMaterial } from "../rendering/ToonShading";
import { Random, SEEDS } from "../util/Random";
import { seabedHeight } from "./Seabed";
import { createSunViewUniform, injectLeafGlow, trackSunView, unpackStrip } from "./SeaGrass";

/**
 * The forest layer: the only plant in this reef taller than the diver.
 *
 * Everything that grows here used to top out at about two metres — grass at
 * one, coral at one and a half — which means the reef had a floor, a skyline of
 * stone, and nothing alive in between. The upper half of every canonical frame
 * was empty water, and empty water is what makes a reef read as a stage set
 * with the props on the ground.
 *
 * Kelp is the fix, and the reason it is kelp rather than more of anything else
 * is that its silhouette crosses the horizon. A stalk two to four metres tall
 * standing on the sand runs from below the camera's eye line to well above it,
 * so the fog line — the brightest, flattest band in the picture — is broken by
 * something with a shape, at every distance out to where the water closes.
 *
 * ## How it is built, and why not the obvious way
 *
 * Two draw calls: one merged mesh of stalks, one of leaves. Not instanced, and
 * that is the decision worth explaining, because instancing is what the grass
 * and the fish and the coral all do.
 *
 * A clump of kelp is a *jointed* thing: every leaf hangs off a particular
 * height of a particular stalk, and that stalk bends on its own curve and sways
 * on its own phase. Instanced, the leaves would need the stalk's whole
 * displacement threaded through per-instance attributes and rotated into each
 * leaf's own frame, because an instance matrix carries the leaf's orientation
 * and an object-space offset is rotated by it. Merged, every vertex is already
 * in the group's space: the sway is two lines of GLSL reading one float per
 * vertex, and a leaf cannot come off its stalk because it is the same buffer.
 *
 * The price is per-stalk frustum culling, and at seventy-odd stalks and
 * forty-five thousand triangles across the whole reef (W-N2's canopy tripled
 * the straps) that is not a price. The gain, as
 * well as the sway, is that every stalk gets its *own* curve rather than one
 * shared geometry seen from different angles — which is most of what makes a
 * stand of kelp read as a stand and not as a row.
 *
 * ## What it stays away from
 *
 * The clumps are authored, like the bommies and the pinnacles, and they answer
 * to the same clearances: nothing in the spawn lane down `x = 0`, nothing
 * within six metres of a crevice mouth, nothing in the approach fans. Kelp is
 * not in `obstructionMeshes` — no plant in this reef is — so it cannot break a
 * discovery, but a four-metre frond in front of a moray's head is exactly as
 * bad for the player as a rock would be, and the raycast would not notice.
 */

/** A stand of kelp, as placed rather than as scattered. */
export interface KelpClump {
  readonly x: number;
  readonly z: number;
  readonly stalks: number;
  /** How far the stalks are spread about the clump's centre, in metres. */
  readonly radius: number;
  /** Multiplies the drawn height range; a clump can be young or old. */
  readonly scale?: number;
  /**
   * A canopy tree (W-L9): drawn from the giant height range, reaching seven
   * to nine and a half metres with a spreading crown, where an ordinary stalk
   * tops out under five. One or two per stand at most — a forest of giants
   * has no giants.
   */
  readonly giant?: boolean;
}

/**
 * Twelve stands, placed for the canonical cameras and around everything that
 * was already standing.
 *
 * The first two are the ones that do the work: they stand either side of the
 * opening shot, near enough to be read and far enough not to crowd it, so that
 * the first frame of the game has something growing in its upper half. Three
 * more cross the mid-depth traverse; two sit deep behind the crevice as a
 * background layer; the rest thin out to the reef's edge, where their job is to
 * be the last thing the fog takes.
 *
 * They keep six metres from every crevice mouth, and `tests/kelp.test.ts` also
 * holds them clear of the *approach fans* — which is the constraint that
 * actually matters and is not the same one. A stand three metres behind a
 * moray's head blocks nothing; a stand ten metres out on the line the player
 * looks down blocks everything. Two of these are much closer to a hiding spot
 * than the radius suggests, and both are behind it.
 *
 * Also checked: the pinnacle feet, the rock field's footprints, the coral
 * bommies, the arch's legs, and the two-metre disc at (7.5, 8.5) that a later
 * package plants an anemone garden in.
 */
export const KELP_CLUMPS: readonly KelpClump[] = [
  // The near stand, and the only one the opening shot sees close up. It is
  // small and it sits in the one window between the foreground shoulder, the
  // spawn lane and the ribbon's approach — see the note this line used to
  // carry at (-5.2, 13.2). W-L9's stream split re-rolled every stalk, and the
  // re-diced stand grazed a snowflake lane by 13mm, so it stepped a quarter
  // metre west and pulled its skirt in. W-N2's longer, re-diced fronds grazed
  // the same fan by 0.26m, so it stepped west again — the shoulder at
  // (-5.4, 19) is still six metres off: the same test doing the same job.
  { x: -5.9, z: 13.2, stalks: 3, radius: 0.55, scale: 0.72 },
  // The middle distance behind the gate, which is where the opening shot is
  // actually open: five stands across the band the eye travels into, tall
  // enough to stand into the fog rather than under it.
  { x: -12, z: -5, stalks: 5, radius: 1.7, scale: 1.15 },
  { x: 3.5, z: -7.5, stalks: 5, radius: 1.7, scale: 1.2 },
  { x: 6, z: -5, stalks: 4, radius: 1.5, scale: 1.1 },
  { x: 2, z: -11, stalks: 5, radius: 1.7, scale: 1.25 },
  { x: 10.5, z: -12, stalks: 5, radius: 1.7, scale: 1.2 },
  { x: -2.5, z: -14, stalks: 5, radius: 1.7, scale: 1.15 },
  { x: 1, z: -17, stalks: 5, radius: 1.8, scale: 1.12 },
  { x: -12, z: -13, stalks: 6, radius: 1.9, scale: 1.15 },
  // The two that carry the opening shot, and the last places found: level with
  // the gate posts and *behind* the ribbon and the zebra, where the approach
  // fans point the other way and there is finally room for a full-sized stand
  // inside the frame. Both land about twenty-two metres out on either side of
  // the crevice, which is near enough to read as a plant and far enough to be
  // the middle distance rather than the foreground.
  // The western one is three metres deeper than its twin, and that is not
  // symmetry-breaking for its own sake: the foreground shoulder crops the whole
  // left third of the opening shot, so a stand level with the gate is a stand
  // behind a rock. Deeper brings it out past the shoulder's edge.
  { x: -13.5, z: -3, stalks: 6, radius: 1.9, scale: 1.15 },
  { x: 15, z: 0, stalks: 6, radius: 1.9, scale: 1.15 },
  { x: -16, z: 14, stalks: 5, radius: 1.8, scale: 1.05 },
  { x: -19.5, z: -12, stalks: 4, radius: 1.6 },
  // The canopy trees (W-L9), appended so the twelve stands above keep their
  // exact stream. Each is one giant stalk reaching toward the surface with a
  // crown that spreads — the vertical the whole forest was missing, placed in
  // the deep and middle field where the canonical cameras look *through* them
  // into the fog. Every one answers the same clearances as the stands: six
  // metres off every crevice, out of every approach fan, off the spawn lane,
  // and their crowns' horizontal spread is what `tests/kelp.test.ts`'s
  // vertex sweep actually checks.
  { x: -12, z: -6.5, stalks: 1, radius: 0.4, giant: true },
  { x: 7, z: -8.5, stalks: 1, radius: 0.4, giant: true },
  { x: 0.5, z: -16, stalks: 1, radius: 0.4, giant: true, scale: 1.08 },
  { x: -16.5, z: -14, stalks: 1, radius: 0.4, giant: true },
  { x: 14, z: -10, stalks: 1, radius: 0.4, giant: true, scale: 0.94 },
  // The under-canopy grove (W-N2), appended so everything above keeps its
  // exact stream — the same append-only rule the canopy trees followed. Three
  // giants gathered around the NW stand at (-16, 14), which is the one place
  // a player can stand on the bench, look up, and be *under* the forest: the
  // stand's own regular stalks fill the mid-height and these carry the crowns.
  // Clearances by arithmetic before the tests read them back: the nearest
  // crevice mouth is the ribbon's at (-13, 6), 8.4m from the closest of the
  // three, and its approach fan points east — away. The Z-kelp-canopy capture
  // stands inside this grove.
  { x: -17.2, z: 15.6, stalks: 1, radius: 0.4, giant: true },
  { x: -14.6, z: 16.4, stalks: 1, radius: 0.4, giant: true, scale: 0.92 },
  { x: -18.6, z: 12.6, stalks: 1, radius: 0.4, giant: true, scale: 1.05 },
];

/** The range a stalk is drawn from, before a clump's own scale. */
const HEIGHT_MIN = 2.1;
const HEIGHT_MAX = 3.9;

/**
 * The giants' range (W-L9). The swim volume tops out at twelve metres and the
 * canonical cameras hold their top edge near ten, so a crown at eight or nine
 * is "reaching for the surface" in every frame that can see it — taller would
 * put the crown out of shot and buy nothing.
 */
const GIANT_MIN = 7.2;
const GIANT_MAX = 9.4;

/**
 * Rings up a stalk. Its whole shape is a curve, so it needs the tessellation —
 * and a giant needs half again more of it, because nine metres of S at eight
 * rings is a polyline. The regular stalks take one ring over W-L3's seven for
 * the deeper S; more measured as vertex cost with no visible curve bought.
 */
const STALK_RINGS = 8;
const GIANT_STALK_RINGS = 12;
const STALK_SIDES = 6;
const STALK_RADIUS = 0.055;

/**
 * Leaves per stalk, and how big they are.
 *
 * The first pass of this was measured in centimetres and it came out as bare
 * sticks with a few flecks on them — which is the failure the whole package is
 * against, and it is a failure of *mass* rather than of count. A frond is
 * mostly leaf: a two-metre strap on a three-metre stalk is what kelp looks
 * like, and half a metre of it is a twig with something wrong with it. Length
 * runs to two thirds of the stalk's own height and the widest leaves are two
 * fifths as wide as they are long, which at forty metres is still one
 * continuous shape rather than a scatter of marks.
 */
const LEAVES_MIN = 14;
const LEAVES_MAX = 19;
/** A giant is mostly crown, so it carries about twice the straps. */
const GIANT_LEAVES_MIN = 28;
const GIANT_LEAVES_MAX = 38;
const LEAF_LENGTH_MIN = 1.15;
const LEAF_LENGTH_MAX = 2.3;
/**
 * Ribbons rather than wires (W-N2). The round critic called W-L9's forest "a
 * charcoal wire armature with perhaps a dozen flat leaf straps", and both
 * numbers above and this ratio are the answer: strap count is up roughly
 * threefold and width half again, because a frond is mostly leaf and this one
 * measurably was not. Width is still the expensive axis — it multiplies into
 * covered pixels without lengthening the silhouette — and the cost is taken
 * knowingly this time: the whole package exists to put leaf area in the frame.
 */
const LEAF_WIDTH_MIN = 0.32;
const LEAF_WIDTH_MAX = 0.46;

/**
 * The crown clusters (W-N2), drawn from their own pre-registered seed.
 *
 * A stalk used to end in nothing: the straps thinned out toward `LEAF_TO` and
 * the top of every plant was a bare whip against the sky — which is exactly
 * where a diver under the forest is looking. Each stalk now finishes in a
 * cluster of drooping crown ribbons, and each *giant* additionally spreads a
 * ring of broad, near-horizontal canopy pads at the very top, so the surface
 * end of the forest is a ceiling of leaf with light coming through rather
 * than open water.
 *
 * Every draw here comes from `SEEDS.kelpCanopy`, never from the placement or
 * leaf streams — the same protection the W-L9 split bought, one layer over:
 * tuning the canopy can re-roll nothing but the canopy.
 */
const CROWN_STRAPS_MIN = 4;
const CROWN_STRAPS_MAX = 6;
const GIANT_CROWN_STRAPS_MIN = 12;
const GIANT_CROWN_STRAPS_MAX = 16;
const GIANT_PADS_MIN = 5;
const GIANT_PADS_MAX = 7;
/** Where along the stalk the lowest and highest leaves attach. */
const LEAF_FROM = 0.22;
const LEAF_TO = 0.98;

/**
 * How far a tip sweeps, as a fraction of the stalk's height, and the direction
 * it sweeps in.
 *
 * One direction for the whole forest, because that is what a current is: kelp
 * that leans every which way is kelp in a swimming pool. The phase varies per
 * stalk so the stand ripples rather than pulsing, which is the same trick the
 * meadow plays one order of magnitude smaller.
 */
const SWAY_REACH = 0.12;
const DRIFT_X = 0.91;
const DRIFT_Z = 0.42;

export class Kelp {
  readonly group = new Group();

  private readonly sway = { value: 0 };
  private readonly windStrength = { value: 1 };
  private readonly sunView = createSunViewUniform();
  /**
   * The two merged geometries and the two materials, and nothing else. The maps
   * are not here on purpose: the generated ones are module-level and shared,
   * and the painted one is owned by `AssetLibrary` and handed to every caller —
   * the same rule that keeps `disposeSubtree` off textures.
   */
  private readonly owned: (BufferGeometry | MeshToonMaterial)[] = [];

  constructor(seed: number = SEEDS.kelp) {
    this.group.name = "kelp";
    const random = new Random(seed);
    /**
     * The leaves draw from their own stream (W-L9). They used to share the
     * placement stream, which made every leaf-count or leaf-shape tune re-roll
     * every stalk planted after the first — the RNG fragility the kelp test's
     * header warns about. Split, a stalk costs a fixed five draws whatever
     * hangs off it, so retuning the canopy can never move a holdfast again.
     */
    const leafRandom = new Random(seed ^ 0x1eaf_0001);
    /**
     * The crown clusters' own stream (W-N2). Pre-registered as
     * `SEEDS.kelpCanopy` rather than folded from the kelp seed, so the canopy
     * is tunable without touching either existing stream — and so a future
     * package can find it in `Random.ts` where every other stream lives.
     */
    const canopyRandom = new Random(SEEDS.kelpCanopy);

    const stalks: BufferGeometry[] = [];
    const leaves: BufferGeometry[] = [];
    // Two tessellations of one template (W-O3): the small foliage keeps its
    // five rows, and any leaf long enough to show a straight margin at close
    // range takes the fine one. See `FINE_LEAF_LENGTH`.
    const leafTemplate = { coarse: leafGeometry(), fine: leafGeometry(FINE_LEAF_ROWS) };

    for (const clump of KELP_CLUMPS) {
      for (let i = 0; i < clump.stalks; i++) {
        const angle = random.range(0, Math.PI * 2);
        const spread = clump.radius * Math.sqrt(random.next());
        const x = clump.x + Math.cos(angle) * spread;
        const z = clump.z + Math.sin(angle) * spread;
        const giant = clump.giant === true;
        const height =
          (giant ? random.range(GIANT_MIN, GIANT_MAX) : random.range(HEIGHT_MIN, HEIGHT_MAX)) *
          (clump.scale ?? 1);
        this.growStalk(
          stalks,
          leaves,
          leafTemplate,
          random,
          leafRandom,
          canopyRandom,
          x,
          z,
          height,
          giant,
        );
      }
    }

    leafTemplate.coarse.dispose();
    leafTemplate.fine.dispose();
    this.group.add(this.build(stalks, stalkMaterial(this.sway, this.windStrength)));
    this.group.add(this.build(leaves, this.leafMaterial()));
  }

  /**
   * One plant: a lathed stalk bent onto its own S-curve, and the leaves that
   * hang off it, both written straight into world space.
   */
  private growStalk(
    stalks: BufferGeometry[],
    leaves: BufferGeometry[],
    template: { coarse: BufferGeometry; fine: BufferGeometry },
    random: Random,
    leafRandom: Random,
    canopyRandom: Random,
    x: number,
    z: number,
    height: number,
    giant: boolean,
  ): void {
    const foot = seabedHeight(x, z);
    const phase = random.range(0, Math.PI * 2);
    const yaw = random.range(0, Math.PI * 2);
    // A young stalk stands up and an old one has been lying over in the current
    // for a season. Both are in every clump. A giant leans less: nine metres
    // of stipe at a grown stalk's lean would put the crown a body's length
    // off the holdfast and out of the clearances it was authored against.
    const lean = random.range(0.1, 0.42) * (giant ? 0.45 : 1);
    const wave = random.signed(giant ? 0.09 : 0.2);
    // The S (W-L9): two harmonics rather than one shallow bend. The second
    // rides on the first's phase instead of its own draw, so adding it did
    // not move a single stalk — and it is what makes a stalk read as a spine
    // settling through the water rather than a bent pole.
    const wave2 = Math.sin(phase * 3.7) * (giant ? 0.05 : 0.09);
    const curve = (t: number): number =>
      (lean * t * t + wave * Math.sin(t * Math.PI * 1.35) + wave2 * Math.sin(t * Math.PI * 2.6)) *
      height;

    const stalk = bendedStalk(
      height,
      curve,
      random.range(0.85, 1.2) * STALK_RADIUS * (giant ? 1.5 : 1),
      giant ? GIANT_STALK_RINGS : STALK_RINGS,
    );
    place(stalk, yaw, x, foot, z);
    swayAttributes(stalk, phase, height, (y) => (y - foot) / height);
    stalks.push(stalk);

    /**
     * One strap, wherever it comes from. The base foliage and the crown share
     * this so a crown ribbon can never drift off the maths the leaves use —
     * same curve, same sway attributes, same placement.
     */
    const attach = (
      t: number,
      around: number,
      length: number,
      width: number,
      droop: number,
      tone: number,
      crown: boolean,
      stream: Random,
      rise = 0,
    ): void => {
      // Which leaves take the fine rows (W-O3): the crown clusters and pads,
      // and a giant's long base straps — the two sets a camera actually gets
      // under. Pose Z stands *inside* the grove looking up, so its frame is
      // crown ribbons plus the giants' own mid-height straps at arm's reach;
      // three cuts were photographed to find this key. Length alone (r1)
      // missed the short near crowns; crown alone (r3) lost the giants'
      // straps; both-everywhere (r2) fixed the pose at nearly twice this
      // bill, most of it on regular mid-field straps nobody sees the edge of.
      const fine = crown || (giant && length > FINE_LEAF_LENGTH);
      const leaf = (fine ? template.fine : template.coarse).clone();
      shapeLeaf(leaf, length, width, droop, tone, stream, crown, rise);
      const local = new Matrix4()
        .makeTranslation(curve(t), foot + t * height, 0)
        .multiply(new Matrix4().makeRotationY(around - yaw));
      leaf.applyMatrix4(local);
      place(leaf, yaw, x, 0, z);
      swayAttributes(leaf, phase, height, () => t);
      leaves.push(leaf);
    };

    const count = Math.round(
      giant
        ? leafRandom.range(GIANT_LEAVES_MIN, GIANT_LEAVES_MAX)
        : leafRandom.range(LEAVES_MIN, LEAVES_MAX),
    );
    // How hard the straps crowd the top (W-L9). A frond grows from its crown,
    // so the mass belongs in the top third. The giants' bias eased 0.5 → 0.62
    // in W-N2's second round: with the crown cluster carrying the top on its
    // own stream, a hard bias left the lower two thirds of a nine-metre stipe
    // bare — a trunk with a ball on it, which is a palm tree and not a kelp.
    const topBias = giant ? 0.62 : 0.72;
    for (let i = 0; i < count; i++) {
      // Spiralled up the stalk rather than whorled: a leaf every 137° is what
      // stops a stand of these reading as a row of fishbones.
      const t =
        LEAF_FROM +
        Math.pow((i + leafRandom.range(0.1, 0.9)) / count, topBias) * (LEAF_TO - LEAF_FROM);
      const around = yaw + i * 2.4 + leafRandom.signed(0.5);
      // Scaled with the stalk, so a young plant is not a mature one's leaves
      // on a shorter stem, and longer toward the crown where the growth is.
      // The scaling is capped: a nine-metre giant wearing proportional straps
      // would trail five-metre ribbons through its neighbours' clearances.
      const reach = Math.min(1.3, height / HEIGHT_MAX);
      const length =
        leafRandom.range(LEAF_LENGTH_MIN, LEAF_LENGTH_MAX) * (0.62 + t * 0.5) * reach;
      const width = length * leafRandom.range(LEAF_WIDTH_MIN, LEAF_WIDTH_MAX);
      // The higher the leaf, the more it hangs — the older tissue is at the
      // bottom of a frond and the new growth at the top is what stands out.
      // A giant's crown straps hang harder still, which is the spread.
      const droop = leafRandom.range(0.25, 0.75) * (1.15 - t * 0.5) * (giant && t > 0.75 ? 1.7 : 1);
      // The upward sweep (W-N2 r2): a blade rises with its stalk before the
      // droop curls it over. Rising also *shrinks* the horizontal envelope
      // the lane tests police, so the sweep costs no clearance.
      const rise = leafRandom.range(0.2, 0.7);
      attach(
        t,
        around,
        length,
        width,
        droop,
        LEAF_TONES[i % LEAF_TONES.length]!,
        giant && t > 0.7,
        leafRandom,
        rise,
      );
    }

    // The crown cluster (W-N2): the stalk's surface end finishes in a burst of
    // drooping ribbons rather than a bare whip. Every draw is from the canopy
    // stream, so nothing above re-rolls when these are tuned.
    const crownCount = Math.round(
      giant
        ? canopyRandom.range(GIANT_CROWN_STRAPS_MIN, GIANT_CROWN_STRAPS_MAX)
        : canopyRandom.range(CROWN_STRAPS_MIN, CROWN_STRAPS_MAX),
    );
    // Deliberately capped at 1 for the giants where the base foliage caps at
    // 1.3: a crown ribbon arcs *outward* before it hangs, so its horizontal
    // envelope is the one the lane tests police, and it must not grow past
    // what the W-L9 straps already claimed.
    const crownReach = giant ? Math.min(1, height / GIANT_MIN) : Math.min(1.3, height / HEIGHT_MAX);
    for (let i = 0; i < crownCount; i++) {
      const t = canopyRandom.range(0.86, 1.0);
      const around = yaw + canopyRandom.range(0, Math.PI * 2);
      // Longer and narrower than the first cut (W-N2 r2): a crown of short
      // broad pads read as a palm; a crown of trailing ribbons reads as kelp.
      const length =
        (giant ? canopyRandom.range(2.2, 3.4) : canopyRandom.range(0.9, 1.6)) * crownReach;
      const width = length * canopyRandom.range(0.3, 0.46);
      // Hard droop past a short rise: these ribbons lift, turn over and
      // trail, which is what fills the sky under a crown with backlit faces.
      const droop = canopyRandom.range(1.1, 1.7);
      const rise = canopyRandom.range(0.15, 0.45);
      attach(
        t,
        around,
        length,
        width,
        droop,
        LEAF_TONES[i % LEAF_TONES.length]!,
        true,
        canopyRandom,
        rise,
      );
    }

    // The canopy pads (W-N2), giants only: a ring of broad, nearly horizontal
    // blades spread at the very top, evenly fanned with a seeded stagger. This
    // is the ceiling itself — the thing between an upward camera and open
    // water — and it is a ring rather than a scatter so the pads tile the sky
    // instead of stacking on one side.
    if (giant) {
      const padCount = Math.round(canopyRandom.range(GIANT_PADS_MIN, GIANT_PADS_MAX));
      for (let i = 0; i < padCount; i++) {
        const t = canopyRandom.range(0.955, 1.0);
        const around = yaw + (i / padCount) * Math.PI * 2 + canopyRandom.signed(0.4);
        const length = canopyRandom.range(1.15, 1.75) * crownReach;
        const width = length * canopyRandom.range(0.5, 0.66);
        const droop = canopyRandom.range(0.16, 0.34);
        attach(
          t,
          around,
          length,
          width,
          droop,
          LEAF_TONES[(i + 1) % LEAF_TONES.length]!,
          true,
          canopyRandom,
        );
      }
    }
  }

  private build(parts: BufferGeometry[], material: MeshToonMaterial): Mesh {
    const merged = mergeGeometries(parts, false);
    for (const part of parts) {
      part.dispose();
    }
    if (!merged) {
      // `mergeGeometries` fails by returning null with a console error, which
      // in a frame looks exactly like the plant not being there.
      throw new Error("kelp parts could not be merged");
    }
    // The lathe duplicates its seam column, so every stalk carries a bright
    // line down one side until these are welded.
    smoothNormals(merged);

    const mesh = new Mesh(merged, material);
    trackSunView(mesh, this.sunView);
    // Neither cast nor received, and both are budget decisions with a reason.
    //
    // Casting is the meadow's rule: a few hundred double-sided leaves in the
    // shadow pass costs far more than the stippling they would put on the sand.
    // Receiving is this package's own, and it is where the frame came back
    // under its allowance: kelp is the one plant here that lives in *open
    // water* — its fronds are two to five metres up, above everything that
    // could shade them and lit by a sun 48° over the reef — so a shadow map
    // sample per fragment buys almost nothing on the largest new surface in
    // the scene. Measured through `scripts/probe-kelp.mjs`, dropping it and
    // narrowing the straps took the close shots from about 20ms of a
    // full-resolution frame to about 9.
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    this.owned.push(merged, material);
    return mesh;
  }

  private leafMaterial(): MeshToonMaterial {
    const material = createToonMaterial({
      side: DoubleSide,
      map: leafTexture(),
      vertexColors: true,
    });

    requestAlbedo("world/kelp-leaf.png", (texture) => {
      const painted = paintedLeaf(texture);
      if (painted) {
        material.map = painted;
        material.needsUpdate = true;
      }
    });

    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      injectSway(shader, this.sway, this.windStrength);
      // Two translucency notes, shared with the meadow (W-L9). The cool
      // view-facing term is the old one — a frond is a fraction of a
      // millimetre thick, so its far side glows rather than falling into
      // shadow. The warm term is what puts *light in the crowns*: a strap
      // between the camera and the sun goes golden-olive, weighted toward the
      // tip, which is exactly the look-up-through-the-canopy read the forest
      // was missing.
      injectLeafGlow(
        shader,
        this.sunView,
        "vec3(0.11, 0.22, 0.17)",
        "vec3(0.38, 0.30, 0.10)",
        "clamp(vMapUv.y, 0.0, 1.0)",
      );
    };

    return material;
  }

  update(dt: number, reducedMotion: boolean): void {
    // Slower than the grass by design: a four-metre frond has a period a person
    // can follow, and the same rate at ten times the amplitude is a flag.
    this.sway.value += dt * (reducedMotion ? 0.3 : 1);
    this.windStrength.value = reducedMotion ? 0.4 : 1;
  }

  dispose(): void {
    for (const owned of this.owned) {
      owned.dispose();
    }
    this.owned.length = 0;
    this.group.removeFromParent();
    this.group.clear();
  }
}

function stalkMaterial(sway: { value: number }, wind: { value: number }): MeshToonMaterial {
  const material = createToonMaterial({ map: stalkTexture(), vertexColors: true });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    injectSway(shader, sway, wind);
  };
  return material;
}

/**
 * The one piece of shader in this module, shared by the stalk and the leaf so
 * that a leaf can never drift off the stalk it grew on.
 *
 * `aReach` is already in metres — the sway amplitude at that vertex's height —
 * because the merged geometry is in the group's space and there is no instance
 * matrix to scale it. A stalk's own vertices carry their own height's reach; a
 * leaf's carry the reach at the point it is attached, so the whole leaf
 * translates with the stalk rather than shearing against it.
 */
function injectSway(
  shader: WebGLProgramParametersWithUniforms,
  sway: { value: number },
  wind: { value: number },
): void {
  shader.uniforms.uSway = sway;
  shader.uniforms.uWind = wind;
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
       uniform float uSway;
       uniform float uWind;
       attribute float aPhase;
       attribute float aReach;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       float bend = sin(uSway * 0.52 + aPhase) * 0.62 + sin(uSway * 0.21 + aPhase * 1.7) * 0.38;
       transformed.x += bend * aReach * uWind * ${DRIFT_X.toFixed(3)};
       transformed.z += bend * aReach * uWind * ${DRIFT_Z.toFixed(3)};`,
    );
}

/**
 * A stalk: a lathe for the taper, then every ring slid onto the S-curve.
 *
 * The bend is applied to the finished surface rather than authored into the
 * profile because a profile is a radius and a radius cannot lean. Sliding rings
 * is the same move `RockShapes` makes for a leaning sea stack, and it is safe
 * for the same reason: a ring moves as one, so the surface stays closed.
 */
function bendedStalk(
  height: number,
  curve: (t: number) => number,
  radius: number,
  rings: number = STALK_RINGS,
): BufferGeometry {
  const points: Vector2[] = [new Vector2(0, -0.12)];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    // Thickest at the holdfast, thinning to a whip. The small swell at the
    // foot is the one place a kelp is visibly anchored to the rock.
    const taper = (1.35 - t * 0.95) * (1 + Math.exp(-t * 9) * 0.5);
    points.push(new Vector2(radius * taper, t * height));
  }
  points.push(new Vector2(0, height));

  const geometry = new LatheGeometry(points, STALK_SIDES);
  const position = geometry.attributes.position!;
  const tint = new Color(0x6f8f4e);
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const t = Math.min(1, Math.max(0, y / height));
    position.setX(i, position.getX(i) + curve(t));

    // Dark at the holdfast where nothing reaches it, warming up the stalk.
    shade.copy(tint).multiplyScalar(0.72 + t * 0.5);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/**
 * The leaf template: a flat strip in edge coordinates, shaped per leaf.
 *
 * It is a shape rather than a cut-out. `kelp-leaf.png` is a frond on black and
 * the obvious use for that is an alpha map, which is the wrong one here for the
 * two reasons the grass strip taught: a mostly-black image mips down to black
 * and puts a dark meadow at the back of the frame, and an alpha test on three
 * hundred overlapping quads is the one thing in this package that could
 * actually cost the frame. The silhouette goes in the geometry, the painting is
 * bled out to fill it, and every fragment drawn is opaque.
 *
 * The template no longer bakes the lanceolate outline (W-O3): the silhouette
 * moved into `shapeLeaf` so every leaf can wear its own — the round critic
 * found the canopy's cloned outlines, and a shared template is exactly where
 * a clone comes from. `x` here is an edge coordinate, -1 at one margin to +1
 * at the other; `y` runs 0 at the root to 1 at the tip.
 *
 * `rows` is the tessellation along the leaf, and it is a *silhouette* budget:
 * a margin can only undulate between the vertices it has. Five rows carries
 * the small foliage; the big canopy leaves take {@link FINE_LEAF_ROWS}.
 */
function leafGeometry(rows = 5): BufferGeometry {
  const geometry = new PlaneGeometry(1, 1, 2, rows);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    // The plane is centred; run `v` from 0 at the leaf's root to 1 at its tip.
    position.setXYZ(i, position.getX(i) * 2, position.getY(i) + 0.5, 0);
  }
  position.needsUpdate = true;
  return geometry;
}

/**
 * Rows for the crown leaves, which are the ones a camera gets under.
 *
 * At pose Z a canopy pad is a metre and a half of leaf a body's length from
 * the lens, and its five-row margin is a run of dead-straight thirty-
 * centimetre segments — the "cut paper" read W-O3 was asked for. Nine rows
 * puts a vertex every sixteen centimetres of a big pad, which is enough for
 * the margin wave below to read as a leaf's edge rather than as a polyline.
 * Only the crown-flagged leaves and a giant's long straps pay for it: the
 * regular base foliage is seen from beside, not along its margin, and rows
 * on it measured as pure vertex cost.
 */
const FINE_LEAF_ROWS = 9;
/** A giant's base strap long enough to earn the fine rows; see `attach`. */
const FINE_LEAF_LENGTH = 1.4;

/** The lanceolate profile's baseline taper exponent; see {@link outline}. */
const OUTLINE_PEAK = 0.82;

/** Half-width along a leaf, as a fraction of its widest. */
function outline(v: number, peak = OUTLINE_PEAK): number {
  return Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, v)), peak)) ** 0.62;
}

/**
 * Three greens, so a frond is not one colour.
 *
 * They are taken in order round a stalk rather than drawn, which is what makes
 * a plant read as a plant: a random palette per leaf is confetti, and leaves
 * alternating up a stem is what a growing thing does. Calmer and a step deeper
 * than the meadow's since W-L9 — the forest is the frame's dark vertical mass
 * and the meadow its bright floor, and the two used to sit in one value — with
 * the warmth moved out of the body and into the tips below.
 */
const LEAF_TONES = [0x6fa458, 0x81b464, 0x578d4c];

/** The golden-olive the tips lean toward; the crown straps take more of it. */
const TIP_GOLD = new Color(0xc4ae56);

/**
 * Folds a leaf's own drawn parameters into a seed (FNV-1a over float bits).
 *
 * This is where the per-leaf shape variation gets its randomness from, and it
 * is deliberately not a PRNG stream: every stream in this module is spoken
 * for by a placement contract (`tests/kelp.test.ts` freezes the stalk buffer
 * and W-N2's header explains why), and a draw added inside this function
 * would shift every leaf placed after it. Hashing values the streams already
 * produced costs nothing from any of them, so the forest's layout is
 * bit-identical to W-N2's and only the vertices inside each leaf move.
 */
function leafDetailSeed(length: number, width: number, droop: number, rise: number): number {
  let hash = 0x811c9dc5;
  for (const value of [length, width, droop, rise]) {
    const bits = new Uint32Array(new Float32Array([value]).buffer)[0]!;
    hash = Math.imul(hash ^ bits, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Scales the template to one leaf's size and hangs it over.
 *
 * The shape jitter (W-O3) is fenced by one rule: **no vertex may land further
 * out in the ground plane than the un-jittered leaf put it.** The lane sweeps
 * in `tests/kelp.test.ts` are horizontal and their margins are thin — W-N2
 * re-stepped a stand for 0.26 m — so the margin wave only cuts inward
 * (`wave ≤ 1`), the profile jitter is clamped under the baseline outline, the
 * cup only deepens, and the ruffle is purely vertical. Variation that can
 * only shrink a silhouette costs no clearance anywhere, by construction.
 */
function shapeLeaf(
  geometry: BufferGeometry,
  length: number,
  width: number,
  droop: number,
  tone: number,
  random: Random,
  crown = false,
  rise = 0,
): void {
  const position = geometry.attributes.position!;
  // Along the leaf as well as between leaves: new tissue at the tip is the
  // pale part of every frond there is.
  const tint = new Color(tone).multiplyScalar(random.range(0.86, 1.12));
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);

  // Per-leaf character, off the hash: where the widest point sits, how the
  // margins undulate (each edge on its own phase, so the two are never
  // mirror images), how the blade ripples along its length, how hard the
  // edges curl back. Frequencies are sized to what the tessellation can
  // carry — a wave the rows cannot express reconstructs as noise.
  const detail = new Random(leafDetailSeed(length, width, droop, rise));
  const rows = position.count / 3 - 1;
  const fine = rows > 6;
  const peak = detail.range(0.7, 0.96);
  const margin = detail.range(0.06, fine ? 0.16 : 0.12);
  const marginFreq = fine ? detail.range(2.2, 3.6) : detail.range(1.2, 2.1);
  const marginPhase = detail.range(0, Math.PI * 2);
  // The fine leaves keep a real ruffle floor: a big pad seen along its own
  // plane shows the cup fold as its silhouette, and the vertical ruffle is
  // the only term that can bend that line — a leaf that draws nearly none
  // stays a ruled edge however serrated its margins are.
  const ruffle = detail.range(fine ? 0.02 : 0.012, fine ? 0.04 : 0.022) * length;
  const ruffleFreq = fine ? detail.range(1.6, 2.7) : detail.range(1.0, 1.8);
  const rufflePhase = detail.range(0, Math.PI * 2);
  const cupBack = detail.range(0.1225, 0.18);

  for (let i = 0; i < position.count; i++) {
    const v = position.getY(i);
    const edge = position.getX(i);
    // The margin wave: inward-only serration, offset per side.
    const wave =
      1 -
      margin *
        (0.5 + 0.5 * Math.sin(v * marginFreq * Math.PI * 2 + marginPhase + (edge < 0 ? 2.1 : 0)));
    const half = Math.min(outline(v, peak), outline(v)) * wave;
    const across = edge * half * 0.5 * width;
    // Out along the stalk's local +x, arcing over as it goes, with a shallow
    // cup across it so the leaf is never a flat card in the light.
    //
    // The arc is integrated (W-N2) rather than the parabola it used to be —
    // the same correction the meadow's bow took in W-L9. A parabola slides the
    // tip down while keeping the full horizontal reach, which on the crown's
    // hard droops made a hanging ribbon read as a leaning plank *and* pushed
    // its tip out to the very edge of the clearance envelope. Integrated,
    // height trades smoothly into fall: a crown ribbon at droop 1.5 arcs out,
    // turns over, and hangs — and its horizontal reach shrinks as it does.
    const bent = arcAlong(v, droop, rise);
    const reach = bent.along * length;
    // The ruffle rides the fall: an undulation growing toward the tip, in the
    // vertical only, which is what stops a metre of margin reading as a ruled
    // line without moving a single vertex in the plane the lane tests sweep.
    const fall =
      -bent.drop * length + Math.sin(v * ruffleFreq * Math.PI * 2 + rufflePhase) * ruffle * v;
    const cup = Math.abs(across) * cupBack;
    position.setXYZ(i, reach - cup, fall, across);

    // Toward golden-olive at the tip (W-L9): the sun sits over the crowns, so
    // the newest tissue is the sunlit tissue — and a crown strap, living in
    // the brightest water in the frame, leans further into it.
    shade
      .copy(tint)
      .lerp(TIP_GOLD, v * v * (crown ? 0.55 : 0.3))
      .multiplyScalar(0.84 + v * 0.28);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/**
 * Where a point `v` of the way along a drooping ribbon lands, as fractions of
 * its length: `along` the growth direction and `drop` below it.
 *
 * The bend angle grows toward the tip as `droop · s^1.4` and the strip is
 * integrated along it, so the ribbon's arc length is exactly its length
 * however hard it hangs — the same integration `SeaGrass.createBladeGeometry`
 * does for the meadow's bow. Twelve steps is plenty: this runs at
 * construction, once per vertex, and the arc is smooth by then.
 */
function arcAlong(v: number, droop: number, rise = 0): { along: number; drop: number } {
  const clamped = Math.min(1, Math.max(0, v));
  const steps = 12;
  const dv = clamped / steps;
  let along = 0;
  let drop = 0;
  for (let s = 0; s < steps; s++) {
    // `rise` tilts the root end up before the droop takes over (W-N2 r2): a
    // kelp blade sweeps *upward* with its stalk and curls over at the tip,
    // where a blade with no rise grows out sideways like a bough — which is
    // exactly the palm-tree read the first canopy round came back with.
    const angle = droop * Math.pow((s + 0.5) * dv, 1.4) - rise;
    along += Math.cos(angle) * dv;
    drop += Math.sin(angle) * dv;
  }
  return { along, drop };
}

/** Turns a part in place: yaw about its own foot, then out to where it grows. */
function place(geometry: BufferGeometry, yaw: number, x: number, y: number, z: number): void {
  geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
  geometry.translate(x, y, z);
}

/**
 * Writes the two floats the sway shader reads. `reachAt` returns the fraction
 * of the stalk a vertex should move with — its own height for a stalk, the
 * attachment point for every vertex of a leaf.
 */
function swayAttributes(
  geometry: BufferGeometry,
  phase: number,
  height: number,
  reachAt: (y: number) => number,
): void {
  const position = geometry.attributes.position!;
  const phases = new Float32Array(position.count);
  const reaches = new Float32Array(position.count);

  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, reachAt(position.getY(i))));
    phases[i] = phase;
    // Squared, so the holdfast is still and the tip carries the whole sweep.
    reaches[i] = t * t * height * SWAY_REACH;
  }

  geometry.setAttribute("aPhase", new BufferAttribute(phases, 1));
  geometry.setAttribute("aReach", new BufferAttribute(reaches, 1));
}

/**
 * The generated leaf, and what the painting is levelled onto.
 *
 * Root to tip with a midrib, near enough hue-neutral in the way the rock and
 * sand maps are: the per-leaf colour above carries the palette, and a map that
 * brings its own would multiply the two into a stand of dark weed.
 */
let leafMap: DataTexture | undefined;
function leafTexture(): DataTexture {
  leafMap ??= buildColorTexture(48, (u, v) => {
    const rib = 1 - Math.exp(-((u - 0.5) ** 2) / 0.004) * 0.22;
    const fibre = 0.92 + fbm(u * 3, v, { seed: SEEDS.kelp, period: 10, octaves: 2 }) * 0.2;
    const shade = (0.62 + v * 0.5) * fibre * rib;
    return [shade * 0.9, shade, shade * 0.62];
  });
  return leafMap;
}

let paintedLeafMap: Texture | undefined | null;
function paintedLeaf(texture: Texture): Texture | null {
  if (paintedLeafMap !== undefined) {
    return paintedLeafMap;
  }
  paintedLeafMap = unpackStrip(texture, leafTexture());
  return paintedLeafMap;
}

/** A stalk is a fibrous cord: lengthwise grain and nothing else. */
let stalkMap: DataTexture | undefined;
function stalkTexture(): DataTexture {
  stalkMap ??= buildColorTexture(32, (u, v) => {
    const grain = 0.66 + fbm(u * 2, v * 6, { seed: SEEDS.kelp ^ 0x51, period: 8, octaves: 2 }) * 0.28;
    return [grain * 0.96, grain, grain * 0.78];
  });
  return stalkMap;
}
