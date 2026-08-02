import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector2,
  Vector3,
} from "three";
import { Moray } from "../creatures/morays/Moray";
import { Bubbles } from "../rendering/Bubbles";
import { CausticsSystem } from "../rendering/CausticsSystem";
import { LightShafts, type ShaftPlacement } from "../rendering/LightShafts";
import { Particles } from "../rendering/Particles";
import { UnderwaterFog } from "../rendering/UnderwaterFog";
import { SEEDS } from "../util/Random";
import { disposeSubtree } from "../util/disposeSubtree";
import { CoralField, type ClusterSite, type ToneRange } from "../world/CoralField";
import { createRockMaterial, weatherRock } from "../world/RockMaterial";
import { createSandMaterial } from "../world/SandMaterial";
import {
  bakeSeabedOcclusion,
  createSeabedGeometry,
  seabedHeight,
  type ContactPatch,
} from "../world/Seabed";
import { SeaGrass, type GrassClump } from "../world/SeaGrass";
import { SanctuaryLife } from "./SanctuaryLife";
import type { MoraySpeciesConfig } from "../creatures/morays/MoraySpeciesConfig";

/**
 * The aquarium's key light. It sits behind and to the right of the set, so the
 * backdrop's bright lobe, the shafts and the shadows all fall away from the
 * camera and the animals are lit against the light rather than flat into it.
 * Everything that has to agree about where the light is reads it from here.
 */
const KEY_POSITION = new Vector3(10, 15, -7);

/**
 * The camera swings rather than orbits.
 *
 * A full circle has to be composed for from every azimuth at once, which in
 * practice means composing for none of them: anything placed to frame the
 * animals from the front is a wall in the lens half a minute later. A slow
 * sweep across sixty degrees keeps one authored view — sea stacks either side,
 * the garden and the shafts behind, open sand below — while still parallaxing
 * enough that the room never reads as a painted backdrop.
 */
const CAMERA_DISTANCE = 9;
const CAMERA_HEIGHT = 2.6;
const LOOK_HEIGHT = 2.2;
const SWEEP = 0.52;
const SWEEP_RATE = 0.075;

interface RockSegment {
  /** Icosahedron radius before the stretch. */
  readonly radius: number;
  /** Height of the segment's centre above the sand at the stack's foot. */
  readonly rise: number;
  readonly stretch: number;
  /** Width across the lean, as a fraction of the width along it. */
  readonly flatten: number;
  readonly tilt: number;
  /** How far the segment steps off the stack's axis, in metres. */
  readonly lean: number;
}

interface RockPlacement {
  readonly x: number;
  readonly z: number;
  /** Compass direction (radians) the upper segment leans toward. */
  readonly leanTo: number;
  readonly color: number;
  readonly segments: readonly RockSegment[];
}

/**
 * Two stacks, one either side, standing outside the camera's swing.
 *
 * They are the room's walls: the frame needs something at its edges to be a
 * frame at all, and against them the open water in the middle reads as space
 * rather than as emptiness. Two segments each, leaning and overlapping, for the
 * same reason the reef's pinnacles have them — one weathered solid at this size
 * is still an egg, and an egg is the loudest greybox tell there is. The near one
 * is darker and taller and crops the left; the far one is lower, further back
 * and half dissolved in the fog, so the two edges are not a matched pair.
 */
const ROCKS: readonly RockPlacement[] = [
  {
    x: -11.5,
    z: -4,
    leanTo: 2.4,
    color: 0x5f6a68,
    segments: [
      { radius: 2.2, rise: 1.1, stretch: 1.35, flatten: 0.8, tilt: 0.14, lean: 0 },
      { radius: 1.45, rise: 3.9, stretch: 1.55, flatten: 0.72, tilt: -0.24, lean: 0.6 },
    ],
  },
  {
    x: 12,
    z: -8,
    leanTo: -0.9,
    color: 0x8b9184,
    segments: [
      { radius: 2.4, rise: 1.2, stretch: 1.2, flatten: 1.1, tilt: -0.12, lean: 0 },
      { radius: 1.3, rise: 3.6, stretch: 1.4, flatten: 0.9, tilt: 0.2, lean: 0.7 },
    ],
  },
];

/**
 * Coral, kept behind the swimmers and out toward the edges. Three bommies bank
 * up against the stacks and one small one sits far out on the centre line as
 * the only colour in the deep distance.
 */
const CORAL_SITES: readonly ClusterSite[] = [
  { x: -7.0, z: -7.5, heads: 8 },
  { x: 6.2, z: -9.0, heads: 7 },
  { x: 9.0, z: 0.5, heads: 5 },
  { x: -1.5, z: -14.5, heads: 6 },
];

/**
 * The room's garden keeps the reef's palette and drops the bottom of its value
 * range; see {@link ToneRange}. The site at (9, 0.5) is the reason — it is the
 * only bommie the sweep brings close to the lens, and a table plate there,
 * drawn at the dark end of a rust, was reading as the strake of a wrecked hull
 * rather than as coral.
 */
const CORAL_TONE: ToneRange = { min: 0.88, max: 1.3 };

/**
 * Grass in the middle distance rather than at the lens. A clump close enough to
 * crop the frame is a fine repoussoir in the reef, where the camera goes where
 * the player takes it; here the camera swings through a known arc and would
 * walk straight into one, and the bottom strip of this screen belongs to the
 * sanctuary's species cards anyway.
 */
const GRASS_CLUMPS: readonly GrassClump[] = [
  { x: -3.6, z: -5.0, radius: 2.4, blades: 30, heightScale: 1.0 },
  { x: 4.2, z: -6.8, radius: 2.2, blades: 26, heightScale: 1.1 },
  { x: -8.5, z: -11.0, radius: 2.6, blades: 26, heightScale: 1.2 },
  { x: 8.0, z: -2.5, radius: 1.8, blades: 22, heightScale: 1.15 },
];

/**
 * Four beams, all landing behind the swimmers so that the animals cross them.
 * A shaft an eel never passes in front of is scenery; one it does is what puts
 * the animal in the room.
 *
 * The widths track the reef's WP-G4 retune — the beam map, its bell and its
 * opacity are shared, so a room left at the old widths would be lit by the same
 * softness at two thirds the breadth and read as a different, thinner ocean.
 * The count does not: four beams over twenty metres of bay is already the two
 * or three a frame can hold, where the reef's eight were spread over seventy.
 */
const SHAFTS: readonly ShaftPlacement[] = [
  // Well left of where it wants to look, because a beam leans: with the key
  // this far off vertical each one's curtain hangs several metres toward the
  // light from the sand it lands on, and every beam authored around the middle
  // ended up stacked in the right of the frame.
  { ground: [-5.5, -4.0], width: 6.7, height: 6.5 },
  { ground: [3.6, -3.2], width: 5.4, height: 6.0 },
  { ground: [-7.5, -10.5], width: 8.0, height: 7.0, faint: true },
  { ground: [7.0, -8.5], width: 7.4, height: 6.8, faint: true },
];

/**
 * Two vents, both behind the lanes and out toward the stacks.
 *
 * The reef gets its bubbles for atmosphere; the sanctuary gets them for depth.
 * The animals here swim in open water nine metres out with nothing between them
 * and the lens, and a thread of bubbles rising behind them is the cheapest
 * thing in the project that says how far back "behind" is. They stay off the
 * centre line, where they would climb through the swimmers rather than past
 * them, and out of the near field the sweep passes through.
 */
const BUBBLE_VENTS: readonly (readonly [number, number])[] = [
  [-4.5, -6.5],
  [5.0, -7.5],
];

/**
 * Keeps the meadow out of the near field the camera swings through. A blade is
 * a metre and a half tall and the lens passes two metres above the sand, so one
 * planted here is not ground cover, it is a green sword across the frame.
 */
const LENS_CLEARANCE = [
  new Vector2(0, CAMERA_DISTANCE),
  new Vector2(4.5, 8),
  new Vector2(-4.5, 8),
  new Vector2(0, 4.5),
];

interface Lane {
  /** Centre of the figure-eight. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Half-width of the eight across the frame; its depth is half of this. */
  readonly radius: number;
  /**
   * Radians of path parameter per second, signed: a negative lane runs its
   * eight the other way round, so its animal crosses the frame away from the
   * camera rather than toward it.
   */
  readonly speed: number;
  readonly phase: number;
  /**
   * How far the whole eight is turned about its centre.
   *
   * Without it every lane is the same shape at a different height, so whatever
   * the phases are, four animals spend most of the loop pointing the same way —
   * a formation, not a group.
   *
   * It is kept small for a reason that is not obvious until it is rendered. A
   * lemniscate's heading stops turning altogether at the crossing, so an animal
   * spends most of its loop at one of two headings, forty-five degrees either
   * side of the lane's turn. Turn the lane far enough that one of those lands
   * on the camera and the animal parks end-on, where an eel is a lump with a
   * face on it — which is exactly what a quarter-turned lane looked like.
   */
  readonly turn: number;
  /**
   * How far the animal rises over one lobe of its eight (W-N3, per lane).
   *
   * This is the lever that actually broke the "five nearly parallel
   * horizontal sticks" read the round critic saw in E and S: heading can only
   * be staggered inside the narrow band the end-on trap above allows, but an
   * eel climbing at seventeen degrees and one gliding nearly level are
   * different lines whatever their yaw. The pitch a lane's rise buys is about
   * `atan(rise / (radius·√2))` at the crossing, so the spread below runs from
   * a near-level glide to a visible climb-and-dive.
   */
  readonly rise: number;
}

/**
 * One lane per resident, layered in depth and height rather than lined up —
 * and staggered in phase, heading *and* pitch (W-N3), because the sweep holds
 * all five in one frame and five copies of the same line are a fish-market
 * display, not a dream.
 *
 * They are deliberately small. Everything has to stay inside the frame at both
 * ends of the sweep, and an eel is not a point: a four metre body curving out
 * of a two metre loop already reaches most of the way to the edge.
 *
 * The stagger, stated as the rules the numbers obey (exported so
 * `tests/sanctuaryScene.test.ts` can read them back): distinct lanes;
 * centre heights spread across the water column, no two closer than 0.45 m;
 * turns pairwise at least 0.1 rad apart, all inside the ±0.35 the end-on trap
 * allows; phases pairwise at least 0.8 rad apart; both directions of travel
 * present; rises from 0.3 to 0.65 so no two animals cut the water at the
 * same angle. The tops stay under the jellies' 4.55 m drift floor.
 *
 * The stagger rules are necessary and were not sufficient (W-O2). The zebra
 * and dragon lanes were near-concentric in plan view at a relative angular
 * rate of 0.03 rad/s — so whenever their beat drifted into alignment, the
 * dragon's orange head sat screen-adjacent to the zebra's banded flank for
 * ~30 s at a stretch and the round critic read one impossible animal at both
 * canonical settles. Height stagger cannot prevent that: a lower animal a few
 * metres deeper projects onto the same screen band, and depth along the
 * camera axis is exactly what a chimera is made of. So the low trio is now
 * staggered *laterally* — the screen-x lever — as well: the zebra runs the
 * west half (reversed, so any residual dragon adjacency is two animals
 * passing nose-to-tail rather than one continuing into the other), the
 * dragon glides across the east half, and the hermit keeps the deep water
 * between them. Measured over the first 40 s of a visit with a screen-space
 * body simulation (near-parallel adjacency under 70 px), the old table
 * carried ~44 s of same-direction adjacency; this one carries under 2 s of
 * sub-second flickers inside the whole capture window.
 *
 * ## Wave 8: nine residents, and the rules grow scopes (W6)
 *
 * The wave brought four more morays, and the all-pairs rules above top out
 * arithmetically at seven lanes: nine phase draws cannot sit 0.8 rad apart
 * on a 2π circle (9 × 0.8 > 2π), nine turns cannot sit 0.1 apart inside the
 * ±0.35 the end-on trap allows, and nine heights cannot sit 0.45 apart in
 * this water column. W-O2's own lesson is what saves the design: a chimera
 * needs two bodies screen-adjacent, which needs similar height *and*
 * similar screen-x *and* a shared beat. So the thresholds are unchanged but
 * each is scoped to the axis that actually forms the pair, and the four new
 * lanes are placed to honour the scopes rather than the letters:
 *
 * - **Height and turn rules hold within a lateral half** (west is x ≤ 0.6,
 *   east is above it). Two animals three metres apart on screen cannot read
 *   as one body at any shared height, so the bands only separate what can
 *   meet. West: snowflake, ribbon, zebra, golden dwarf. East: dragon,
 *   abyss, frost, ember, pearl.
 * - **The phase rule holds within a direction of travel.** Two lanes
 *   running their eights opposite ways only ever meet anti-parallel — the
 *   praised nose-to-tail pass — so the shared-beat alignment the 0.8 rad
 *   guards against is a same-direction hazard. With the pearl the reversed
 *   group is {snowflake 6.1, zebra 4.7, pearl 3.55, abyss 2.4}; the forward
 *   group is {dragon 0.9, frost 1.75, ribbon 3.3, golden dwarf 4.4,
 *   ember 5.6}.
 *
 * The new lanes' characters are the species', read as paths: the golden
 * dwarf plays in the bright far-west water on the quickest beat of the
 * room; the frost glides nearly level, slowest of the forward group, out
 * in the deep far east; the ember keeps the warm east shallows off the
 * dragon's shoulder; the pearl drifts slow and reversed across the room's
 * high ceiling, pale against the bright water above every other lane —
 * the gentlest path in the room. Lanes 0–4 are bit-identical to the
 * pre-wave table — the five shipped residents swim exactly what they swam.
 *
 * The scoped rules are still only the arithmetic. The gate is the
 * screen-space simulation W-O2 prescribed, re-run over the nine residents
 * by `scripts/probe-sanctuary-lanes.mjs`: same-direction adjacency under
 * 70 px at the canonical 1600×900, totalled over a 90 s visit covering the
 * full camera swing. W-O2's own script did not survive, so the probe gates
 * the nine-lane table against the shipped five-lane one measured on the
 * same instrument: 3.00 s against the shipped 2.47 s in the first 40 s
 * (the whole excess is the hermit and the ember crossing, one 1.4 s
 * flicker), 9.37 s against 7.43 s over the full swing, and a worst
 * continuous run of 2.20 s — exactly the shipped table's own accepted
 * residual. It also teaches the placement rule this table obeys: the sweep
 * aligns any near lane with any far lane on its side of the room at some
 * azimuth, so no pair here relies on z alone — every pair keeps a
 * metre-plus of height or metres of x between its beats.
 */
export const SANCTUARY_LANES: readonly Lane[] = [
  // The far lane runs the other way, so the deepest animal is the one heading
  // away. The species take these in codex order, and the snowflake is the one
  // that can afford the back of the room: it is the palest animal here and
  // still reads at depth, where the dragon's dark red went to a brown stick.
  { x: -2, y: 3.1, z: -4.2, radius: 2, speed: -0.3, phase: 6.1, turn: -0.32, rise: 0.42 },
  // The tightest lane, because the ribbon is the longest animal by half again:
  // head offset plus body length is what has to clear the frame edge, and this
  // one spends most of its length covering ground on its own. The dancer takes
  // the highest water and a real climb.
  { x: -1.4, y: 3.65, z: 1.0, radius: 1.6, speed: 0.235, phase: 3.3, turn: 0.22, rise: 0.55 },
  // The zebra: low water, the widest vertical travel in the room — and the
  // west half of the frame, run backwards (W-O2, see the header).
  { x: -1.7, y: 1.5, z: -1.75, radius: 2.3, speed: -0.27, phase: 4.7, turn: -0.1, rise: 0.65 },
  // The dragon glides nearly level across the east half of the frame: the
  // sovereign does not bob, and he no longer shares his water (W-O2).
  { x: 2.65, y: 2.35, z: -0.75, radius: 2.4, speed: 0.3, phase: 0.9, turn: 0.34, rise: 0.35 },
  // W-M3: the fifth resident's lane. Low, slow and deep like its canyon: it
  // hugs the sand below every other lane and runs its eight backwards so it
  // mostly heads away, in the middle water the other two low lanes now leave
  // clear.
  { x: 0.9, y: 1.0, z: -2.4, radius: 2.1, speed: -0.24, phase: 2.4, turn: 0.06, rise: 0.5 },
  // ─── Wave 8 (W6): the four wing residents (see the header's scopes) ─────
  // Placed by the screen-space probe, not by eye. The lesson the probe
  // teaches: the sweep's ±30° swings the camera far enough that any two
  // lanes separated mostly in *z* go collinear at some point of it — the
  // near one parks on the far one's line to the lens, the depth that made
  // them safe vanishes, and the chimera is back. So no pair here relies on
  // z alone: every pair of lanes keeps either a metre-plus of height or
  // metres of x between its beats.
  // The golden dwarf: bright far-west water, the quickest beat in the room
  // — the playful one. The lemniscate's tip heights anti-correlate with its
  // x extremes (a lane's far tip is also its height extreme), so the zebra's
  // low west tip and the dwarf's high east tip never share a height, and its
  // band tops out just under the snowflake's floor.
  { x: -4.1, y: 2.05, z: 1.0, radius: 1.25, speed: 0.28, phase: 4.4, turn: -0.21, rise: 0.35 },
  // The frost: out in the deep far-east, the slowest forward lane and
  // nearly level — the grotto's calm, a metre of water above the dragon's.
  { x: 4.0, y: 3.55, z: -3.6, radius: 1.4, speed: 0.18, phase: 1.75, turn: -0.06, rise: 0.3 },
  // The ember: the warm east shallows — laterally clear of the hermit's
  // deep water and the dragon's glide alike.
  { x: 3.4, y: 1.7, z: 0.5, radius: 1.4, speed: 0.22, phase: 5.6, turn: 0.2, rise: 0.5 },
  // The pearl: the room's high ceiling, slow and reversed — the ghost reef
  // drifts; she does too, pale against the bright water above every other
  // lane, three metres of height over the hermit swimming below her.
  { x: 1.2, y: 4.15, z: -2.0, radius: 1.6, speed: -0.16, phase: 3.55, turn: -0.17, rise: 0.35 },
];

const LANES = SANCTUARY_LANES;

/**
 * Body length the residents are normalised toward, in units of the rig's
 * nominal length. The reef can afford its morays at full size because they are
 * met one at a time from wherever the player stops; here four of them share one
 * frame nine metres from the lens, and the ribbon at full length swept out of
 * it entirely.
 */
const RESIDENT_LENGTH = 1.05;

interface SanctuaryResident {
  readonly moray: Moray;
  readonly lane: Lane;
  angle: number;
  /** Yaw rate of the lane, low-passed so the body eases into its curve. */
  turnRate: number;
}

function clamp(value: number, limit: number): number {
  return value < -limit ? -limit : value > limit ? limit : value;
}

/**
 * The dream sanctuary: a calm, warmly lit bay where discovered morays drift in
 * slow figure-eights. A controlled showcase environment (few animals, higher
 * detail) and the emotional reward for discovery.
 *
 * Everything except the animals is built once, in the constructor. Residents
 * come and go with discovery — `setSpecies` rebuilds them, and disposing what
 * it replaces is the whole reason that method exists — but the room they swim
 * in must never be part of that path.
 */
export class SanctuaryScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(55, 1, 0.1, 120);

  private readonly residents: SanctuaryResident[] = [];
  private readonly playerProxy = new Vector3();
  private readonly caustics = new CausticsSystem(40);
  private readonly shafts = new LightShafts(KEY_POSITION, SEEDS.sanctuaryShafts, SHAFTS);
  private readonly motes = new Particles(120, 14, SEEDS.sanctuaryMotes);
  private readonly bubbles = new Bubbles(22, BUBBLE_VENTS, SEEDS.sanctuaryBubbles);
  private readonly grass = new SeaGrass(SEEDS.sanctuaryGrass, LENS_CLEARANCE, GRASS_CLUMPS);
  /** W-L8: the shoal and the bells. Set dressing, like everything above —
   * built once, never part of the `setSpecies` path. */
  private readonly life = new SanctuaryLife();
  private sweep = 0;

  constructor() {
    // The sanctuary is the reward for discovery, so it is lit as a warm, lamplit
    // aquarium rather than the near-black tank it used to be. It borrows the
    // reef's gradient backdrop for the same reason the reef needs one: without
    // it the floor terminates on a hard line instead of fading into the water.
    new UnderwaterFog({
      // The reef's family, turned a few degrees toward green and gold. This is
      // the same remembered water seen indoors, so it may be a shade warmer and
      // a shade calmer than the open reef but it may not be a different ocean.
      color: 0x5cb5b0,
      // Dense enough that the far rim of a sixty-metre floor is gone before it
      // gets there. The bay has to end in water, not in an edge.
      density: 0.042,
      surfaceColor: 0xdcf3e2,
      abyssColor: 0x2f8288,
      // Its own key, not the reef's sun: the backdrop has to brighten on the
      // side the light in this room actually comes from.
      sunDirection: KEY_POSITION,
      // And no `backdropAsset`, which is the one place this room does not
      // follow the reef. Hanging the painted water column here was tried and
      // measured across the sweep: it costs nothing (83.3ms either way) and it
      // is a slightly deeper, cooler water — but the fog colour comes off the
      // same painting, so the room ends up in the *reef's* ocean exactly, and
      // the shade of warmth above is the only thing that ever said this was
      // somewhere else. A calmer, greener bay behind the animals is also the
      // better field to read a subject against. See `tmp_S-sanctuary-t*` under
      // the `g6-gradient` and `g6-backdrop` tags.
    }).applyTo(this.scene);

    // Held to the reef's key ratio: enough to say which side the light is on,
    // not enough to be the exposure. The room's brightness is its water. It
    // tracked the reef's key up when the shading became a ramp, and its ambient
    // down by the same amount, for the reason set out in `Lighting`.
    const key = new DirectionalLight(0xfff0d2, 1.8);
    key.position.copy(KEY_POSITION);
    // The animals are the subject and they are off the ground, so nothing but a
    // cast shadow attaches them to it — the sand's baked occlusion can only
    // ground what stands on it. A tight frustum around the swimming volume is
    // what keeps a second shadow pass affordable.
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 60;
    key.shadow.camera.left = -16;
    key.shadow.camera.right = 16;
    key.shadow.camera.top = 16;
    key.shadow.camera.bottom = -16;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;

    // A cooler fill from the camera's side of the room. With the key behind the
    // set the animals would otherwise face the lens in silhouette, which is
    // drama the codex portraits already provide and this room does not want.
    const fill = new DirectionalLight(0xbfe8f2, 0.5);
    fill.position.set(-9, 5, 11);
    // The ground half was a dark slate, which is a floor bouncing nothing. It
    // is warm sand here for the same reason the reef's is. Sky under ambient,
    // for the same reason as the reef: see `Lighting`.
    const hemisphere = new HemisphereLight(0xb2e6de, 0xf7e2b6, 0.44);
    const ambient = new AmbientLight(0xb391d6, 0.72);
    this.scene.add(key, key.target, fill, hemisphere, ambient);

    const contacts: ContactPatch[] = [];
    this.buildRocks(contacts);
    this.buildCoral(contacts);
    this.scene.add(this.grass.mesh);
    // Last, like the reef's: the sand bakes a contact shadow under everything
    // resting on it, so it has to know where everything ended up.
    this.buildSeabed(contacts);

    this.shafts.addTo(this.scene);
    this.caustics.addTo(this.scene);
    this.motes.addTo(this.scene);
    this.bubbles.addTo(this.scene);
    this.life.addTo(this.scene);

    this.placeCamera();
  }

  private buildSeabed(contacts: readonly ContactPatch[]): void {
    const geometry = createSeabedGeometry(60, 48);
    bakeSeabedOcclusion(geometry, contacts);
    const floor = new Mesh(geometry, createSandMaterial());
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  private buildRocks(contacts: ContactPatch[]): void {
    for (const [index, placement] of ROCKS.entries()) {
      const material = createRockMaterial(placement.color);
      const foot = seabedHeight(placement.x, placement.z);
      const leanX = Math.cos(placement.leanTo);
      const leanZ = Math.sin(placement.leanTo);
      // Turning about this tips the segment's up-axis toward the lean.
      const leanAxis = new Vector3(leanZ, 0, -leanX);

      for (const [order, segment] of placement.segments.entries()) {
        const geometry = new IcosahedronGeometry(segment.radius, 2);
        weatherRock(geometry, SEEDS.sanctuaryRock + (index * 7 + order) * 131, { amount: 0.32 });
        const block = new Mesh(geometry, material);
        block.position.set(
          placement.x + leanX * segment.lean,
          foot + segment.rise,
          placement.z + leanZ * segment.lean,
        );
        block.rotation.y = -placement.leanTo;
        block.scale.set(1, segment.stretch, segment.flatten);
        block.rotateOnWorldAxis(leanAxis, segment.tilt);
        block.castShadow = true;
        block.receiveShadow = true;
        this.scene.add(block);
      }

      const base = placement.segments[0];
      if (base) {
        contacts.push({
          x: placement.x,
          z: placement.z,
          radius: base.radius * 2.1,
          strength: 0.55,
        });
      }
    }
  }

  private buildCoral(contacts: ContactPatch[]): void {
    const coral = new CoralField(SEEDS.sanctuaryCoral, CORAL_SITES, CORAL_TONE);
    this.scene.add(coral.group);
    contacts.push(...coral.contacts);
  }

  /** Rebuilds the residents to match the set of discovered species. */
  setSpecies(configs: readonly MoraySpeciesConfig[]): void {
    for (const resident of this.residents) {
      this.scene.remove(resident.moray.asset.root);
      disposeSubtree(resident.moray.asset.root);
    }
    this.residents.length = 0;

    configs.forEach((config, index) => {
      const moray = new Moray(config);
      // Normalised by the species' own length so a ribbon and a snowflake take
      // comparable amounts of the frame; the difference between them is carried
      // by girth and pattern, which this leaves alone.
      moray.asset.root.scale.setScalar(RESIDENT_LENGTH / config.lengthScale);
      // Heading, then pitch, then roll about the animal's own long axis — in
      // the default XYZ order the roll would be applied about a world axis and
      // an eel swimming across the frame would pitch instead of banking.
      moray.asset.root.rotation.order = "YXZ";
      this.scene.add(moray.asset.root);

      const lane = LANES[index % LANES.length] ?? LANES[0]!;
      this.residents.push({ moray, lane, angle: lane.phase, turnRate: 0 });
    });

    // The room reopens on its authored composition rather than wherever the
    // last visit left the camera. Discovery also lands here, but the reef is
    // what is on screen then, so nothing snaps in view.
    this.sweep = 0;
    this.placeCamera();
  }

  get residentCount(): number {
    return this.residents.length;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, reducedMotion: boolean): void {
    const motion = reducedMotion ? 0.4 : 1;
    this.sweep += dt * SWEEP_RATE * motion;
    this.placeCamera();

    this.camera.getWorldPosition(this.playerProxy);
    for (const resident of this.residents) {
      this.swim(resident, dt * motion);
    }

    this.grass.update(dt, reducedMotion);
    // Already scaled by the room's own calm factor, like the residents.
    this.life.update(dt * motion);
    this.caustics.update(dt, reducedMotion);
    // `playerProxy` is this frame's camera position, read above.
    this.shafts.update(dt, reducedMotion, this.playerProxy);
    this.motes.update(dt, reducedMotion);
    // The sweep turns the camera every frame, and a bubble is a quad that has
    // to be turned with it.
    this.bubbles.update(dt, reducedMotion, this.camera.quaternion);
  }

  private placeCamera(): void {
    const azimuth = Math.sin(this.sweep) * SWEEP;
    this.camera.position.set(
      Math.sin(azimuth) * CAMERA_DISTANCE,
      CAMERA_HEIGHT,
      Math.cos(azimuth) * CAMERA_DISTANCE,
    );
    this.camera.lookAt(0, LOOK_HEIGHT, 0);
  }

  /**
   * Advances one resident along its figure-eight.
   *
   * A circle is the one path that looks like machinery: constant speed,
   * constant curvature, and every lap identical. A lemniscate crosses itself,
   * so the animal alternately swims away and back across the frame, slows
   * through the turns and passes its own line — and, crucially, it is a path
   * with a *changing* heading, which is what the body can be bent by.
   */
  private swim(resident: SanctuaryResident, dt: number): void {
    const { lane } = resident;
    resident.angle += dt * lane.speed;

    const a = resident.angle;
    const sinA = Math.sin(a);
    const cosA = Math.cos(a);
    const cos2A = Math.cos(2 * a);

    // The eight is authored across the frame and then turned about its centre,
    // which for a yaw is a rotation of the offset and an addition to the
    // heading.
    const acrossPath = sinA * lane.radius;
    const alongPath = Math.sin(2 * a) * 0.5 * lane.radius;
    const cosTurn = Math.cos(lane.turn);
    const sinTurn = Math.sin(lane.turn);

    const root = resident.moray.asset.root;
    root.position.set(
      lane.x + acrossPath * cosTurn + alongPath * sinTurn,
      lane.y + sinA * lane.rise,
      lane.z - acrossPath * sinTurn + alongPath * cosTurn,
    );

    // Velocity along the path, in path-parameter units: the heading is where it
    // points and the yaw rate is how fast that is turning. A lane running
    // backwards travels the same curve nose-first the other way, so its
    // velocity — and only its velocity — is negated.
    const direction = lane.speed < 0 ? -1 : 1;
    const alongX = cosA * lane.radius * direction;
    const alongZ = cos2A * lane.radius * direction;
    const alongY = cosA * lane.rise * direction;
    const yawRate =
      ((-sinA * cos2A + 2 * Math.sin(2 * a) * cosA) / (cosA * cosA + cos2A * cos2A)) * lane.speed;
    // Eased rather than taken raw: the ends of a lemniscate turn hard enough
    // that an instantaneous read snaps the body into its curve.
    resident.turnRate += (yawRate - resident.turnRate) * Math.min(1, dt * 4);

    root.rotation.set(
      -Math.atan2(alongY, Math.hypot(alongX, alongZ)),
      Math.atan2(alongX, alongZ) + lane.turn,
      // Fish lean into a turn, dropping the shoulder they are turning toward.
      clamp(-resident.turnRate * 0.3, 0.35),
    );

    // The camera stands in for "where to look" so eyes track the viewer.
    resident.moray.update(dt, this.playerProxy, true, resident.turnRate);
  }
}
