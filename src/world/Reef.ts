import {
  BoxGeometry,
  CircleGeometry,
  Color,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector2,
  Vector3,
  type DataTexture,
} from "three";
import { Random, SEEDS } from "../util/Random";
import type { ReefBounds, SphereCollider } from "./CollisionField";
import { requestModel } from "../rendering/AssetLibrary";
import { buildColorTexture, buildScalarTexture, fbm } from "../rendering/ProceduralTexture";
import { smoothNormals } from "../rendering/SmoothNormals";
import { createToonMaterial } from "../rendering/ToonShading";
import {
  ABYSS_DEN,
  AIRSPACE_MAX_RADIUS,
  CANYON_FLOOR_CLEARANCE,
  FLOOR_HALF,
  GATE_AXIS,
  GATE_AZIMUTH,
  bakeCanyonStrata,
  canyonCeiling,
  insideCanyonAirspace,
} from "./Abyss";
import { AbyssFlora } from "./AbyssFlora";
import {
  bakeWingPaint,
  wingAnnexes,
  wingGateAzimuths,
  wingWallColliders,
} from "./wings/WingField";
import { WINGS, wingById } from "./wings/WingRegistry";
import { WING_FLORA_BUILDERS } from "./wings/WingFloraRegistry";
import { WING_DENS, type WingDenSpec } from "./wings/WingDens";
import type { WingFlora } from "./wings/WingTypes";
import { REGION_SLOTS } from "./regions/RegionSlots";
import { regionBySlot } from "./regions/RegionRegistry";
import { CoralField } from "./CoralField";
import { CorridorDressing } from "./CorridorDressing";
import { DistantReef } from "./DistantReef";
import { Kelp } from "./Kelp";
import { createRockMaterial, weatherRock } from "./RockMaterial";
import { archGeometry, boulderGeometry, slabGeometry, stackGeometry } from "./RockShapes";
import { createSandMaterial } from "./SandMaterial";
import { bakeSeabedOcclusion, createSeabedGeometry, seabedHeight, type ContactPatch } from "./Seabed";
import { SeaGrass, type GrassClump } from "./SeaGrass";
import { Seaweed } from "./Seaweed";

export interface HidingSpot {
  readonly speciesId: string;
  /** World position where the moray's head peeks into open water. */
  readonly position: Vector3;
  /** Yaw (radians) the head faces — its open, approachable side. */
  readonly facing: number;
}

interface SpotPlacement {
  readonly speciesId: string;
  readonly position: Vector3;
  readonly facing: number;
}

/** Shared by every crevice: opaque at the centre, gone by the rim. */
let caveFalloffTexture: DataTexture | undefined;
function caveFalloff(): DataTexture {
  caveFalloffTexture ??= buildScalarTexture(64, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    return 1 - smoothStep(0.35, 1, distance);
  });
  return caveFalloffTexture;
}

/**
 * What is actually inside the crevice, shared by all four of them.
 *
 * A single flat colour behind the alpha falloff read as a sticker: the mouth
 * had no interior, just a tint. A radial ramp gives it one — deepest where the
 * passage runs furthest back, lifting toward broken rock near the rim where the
 * light still reaches. The noise is faint on purpose; the mouth has to read as
 * depth, and detail is what depth does not have.
 *
 * The throat used to be all but black, which is the one thing WP-G1 says this
 * world does not contain: the darkest thing in it is a colour, not the absence
 * of one, and a hole punched in the reef is where the eye goes first. It is a
 * deep violet-blue now, the same family the ambient casts its shadows in, so
 * the crevice reads as the darkest *shadow* in the frame rather than as a gap
 * in it. The animals in these mouths were tuned against the black — see the
 * WP-G4 note in AGENTS.md for how their legibility was re-checked.
 */
let caveInteriorTexture: DataTexture | undefined;
function caveInterior(): DataTexture {
  caveInteriorTexture ??= buildColorTexture(64, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    // 0 in the throat, 1 out at the rim.
    const outward = smoothStep(0.1, 1.05, distance);
    const detail = fbm(u, v, { seed: SEEDS.cave, period: 5, octaves: 2 }) * 0.15;
    const lift = outward * (0.055 + detail);
    // Red is held above the old ramp's proportion for the same reason
    // `uShadowTint` holds it at 1.0: with red below green this stops being
    // violet and goes straight back to being a cool blue hole.
    return [0.165 + lift * 0.72, 0.227 + lift, 0.408 + lift * 0.8];
  });
  return caveInteriorTexture;
}

/** Stable per-crevice variation so each mound weathers differently. */
function hashSpecies(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * A stack's plan is an ellipse and its blocks each had their own; the lathe has
 * one. The mean is what keeps a pinnacle as wide across its lean as it was.
 */
function meanFlatten(segments: readonly PinnacleSegment[]): number {
  if (segments.length === 0) {
    return 1;
  }
  return segments.reduce((sum, segment) => sum + segment.flatten, 0) / segments.length;
}

// ─── FROZEN: the crevices ────────────────────────────────────────────────────
// Everything from here to the end of `addHidingSpot` is placed to the
// centimetre against a raycast, and both `tests/reefSightlines.test.ts` and the
// discovery e2e are tuned against the shapes it produces. It is the one part of
// the reef where a change of silhouette and a change of gameplay cannot be told
// apart from a screenshot. Round L's geometry packages re-profile the scenery
// around it and leave this exactly as it is — no re-profiling, no re-weld, not
// a number. `Seabed`'s relief mask covers these four positions for the same
// reason, and copies them for the same reason.
const SPOT_PLACEMENTS: readonly SpotPlacement[] = [
  { speciesId: "snowflake-moray", position: new Vector3(0, 1.4, 1.5), facing: 0 },
  { speciesId: "ribbon-moray", position: new Vector3(-13, 1.6, 6), facing: Math.PI / 2 },
  { speciesId: "zebra-moray", position: new Vector3(13, 1.4, 6), facing: -Math.PI / 2 },
  { speciesId: "dragon-moray", position: new Vector3(-6, 1.6, -9), facing: 0 },
];
// ─── end FROZEN (continues at `addHidingSpot`) ───────────────────────────────

/**
 * How the sculpted den mouths (`models/creature-den-mouth.glb`) sit at the
 * four crevices. The archway is authored with a ~0.9 × 0.7 m doorway, its
 * pivot at the ground centre of the opening and its crown leaning toward -z
 * (the reef side), so posed at `facing` the crown leans back over the mound
 * and the moray looks out through the door.
 *
 * These are scenery, deliberately: the mesh joins neither `obstructionMeshes`
 * nor `colliders`, so every raycast and every collision the FROZEN crevices
 * were tuned against evaluates exactly what it evaluated before. What the
 * numbers answer for instead is the *eye* — the doorway has to frame the head
 * without ever crossing the approach sightline, which is why the setback puts
 * the opening's plane behind the head and the scale keeps the lintel well
 * over it.
 */
const DEN = {
  /** Uniform scale on the archway: a ~2.3 m wide, ~1.8 m tall doorway. */
  scale: 2.6,
  /** Metres behind the head the opening's plane stands. */
  setback: 0.75,
  /** Base metres of foot sunk into the dune (jittered per spot). */
  sink: 0.08,
} as const;

/**
 * The fifth crevice (W-M3), on the canyon's twilight floor and facing back
 * up the shelf toward the gate — so the approach corridor the sightline
 * machinery guards is the canyon itself. Built as a placement like the four
 * above but *derived* rather than frozen: its numbers live in `Abyss` beside
 * the carve, and its head height rides the carved ground at construction.
 */
function abyssDenPlacement(): SpotPlacement {
  return {
    speciesId: ABYSS_DEN.speciesId,
    position: new Vector3(
      ABYSS_DEN.x,
      seabedHeight(ABYSS_DEN.x, ABYSS_DEN.z) + ABYSS_DEN.headAbove,
      ABYSS_DEN.z,
    ),
    facing: ABYSS_DEN.facing,
  };
}

/**
 * The gate's flanking pinnacles: two stacks standing on the notch's jambs,
 * crowns leaning in over the doorway. Authored like {@link PINNACLES} and
 * placed in gate space — `across` is radians off the axis, so the whole gate
 * turns with the seeded azimuth as one thing.
 */
const GATE_STACKS: readonly {
  readonly across: number;
  readonly r: number;
  readonly segments: readonly PinnacleSegment[];
}[] = [
  {
    across: 0.27,
    r: 33.2,
    segments: [
      // Stretched hard and overlapped by more than half: the first cut used
      // the bowl pinnacles' rounder ratios, and at the gate's scale two round
      // segments read as a snowman standing on a ridge. A gate post is a
      // spire, so the profile thins fast and keeps thinning.
      { radius: 1.9, rise: 1.6, stretch: 1.85, flatten: 0.7, tilt: 0.13, lean: 0 },
      { radius: 1.15, rise: 5.2, stretch: 2.1, flatten: 0.66, tilt: -0.2, lean: 0.55 },
      { radius: 0.52, rise: 8.1, stretch: 1.8, flatten: 0.75, tilt: 0.26, lean: 1.15 },
    ],
  },
  {
    // The shorter post, for the same reason the bowl's gate posts differ:
    // matched heights hand the doorway back its symmetry.
    across: -0.27,
    r: 33.4,
    segments: [
      { radius: 2.0, rise: 1.4, stretch: 1.6, flatten: 1.05, tilt: -0.11, lean: 0 },
      { radius: 1.15, rise: 4.7, stretch: 1.9, flatten: 0.72, tilt: 0.18, lean: 0.7 },
    ],
  },
];

interface PinnacleSegment {
  /** Icosahedron radius before the vertical stretch. */
  readonly radius: number;
  /** Height of the segment's centre above the sand at the stack's foot. */
  readonly rise: number;
  /** Vertical stretch. Boulders are round; a sea stack is not. */
  readonly stretch: number;
  /** Width across the lean, as a fraction of the width along it. */
  readonly flatten: number;
  /** Radians off vertical, authored rather than jittered. */
  readonly tilt: number;
  /** How far the segment steps off the stack's axis, in metres. */
  readonly lean: number;
}

/**
 * A free-standing stone, and which of the archetypes it is.
 *
 * `radius` and `height` are the metres the shape actually occupies rather than
 * a scale on a primitive, which is the whole point of {@link RockShapes}: a
 * slab and a boulder of the same radius are two different objects, and neither
 * of them is a sphere with a number on it. The colliders and contact shadows
 * are still derived from `radius`, at exactly the proportions the icosahedron
 * field used, so the footprints these were placed on have not moved.
 */
interface RockPlacement {
  readonly x: number;
  readonly z: number;
  readonly kind: "boulder" | "slab";
  readonly radius: number;
  readonly height: number;
  /** Width across the yaw, as a fraction of the width along it. */
  readonly flatten?: number;
}

/**
 * The stones between the set pieces, now that they are three kinds of thing.
 *
 * The six original placements keep their ground and their reach — this is a
 * change of silhouette, not of layout — and four more join them in the middle
 * distance of shots A and B, which is where a personality can actually be read.
 * A boulder at twenty-two metres is a lump whatever curve it was drawn from.
 */
const ROCKS: readonly RockPlacement[] = [
  { x: -20, z: -2, kind: "boulder", radius: 2.4, height: 3.1 },
  { x: 20, z: -3, kind: "slab", radius: 3.4, height: 1.85, flatten: 0.78 },
  { x: -12, z: -18, kind: "boulder", radius: 2.0, height: 2.6 },
  // Brought two metres nearer and in, which is the difference between cropping
  // the opening shot's right edge and sitting just outside it.
  { x: 7, z: 15, kind: "slab", radius: 1.9, height: 0.95, flatten: 0.82 },
  { x: 22, z: 14, kind: "boulder", radius: 2.2, height: 2.9 },
  { x: -3, z: -20, kind: "slab", radius: 3.1, height: 1.6 },
  // A shelf out past the eastern gate post. It wants to be nearer, and cannot
  // be: the corridor the zebra is approached along runs the width of the band
  // at z ≈ 6, and the two metres held clear at (7.5, 8.5) for a later
  // package's anemone garden is the only other place a rock this wide fits.
  { x: 13.5, z: -7, kind: "slab", radius: 2.3, height: 1.05, flatten: 0.72 },
  // Its answer across the mid-depth traverse, deeper and rounder.
  { x: 15.5, z: 8.5, kind: "boulder", radius: 1.7, height: 2.2 },
  // Two in the middle distance beyond the gate, which the eye reads as the
  // reef continuing rather than ending at the pinnacles.
  { x: -16.5, z: -6.5, kind: "slab", radius: 2.6, height: 1.4, flatten: 0.85 },
  { x: 4.5, z: -14.5, kind: "boulder", radius: 1.9, height: 2.5 },
];

interface PinnaclePlacement {
  readonly x: number;
  readonly z: number;
  /** Compass direction (radians) the upper segments lean toward. */
  readonly leanTo: number;
  readonly segments: readonly PinnacleSegment[];
}

/**
 * Stone stacks that give the reef a skyline.
 *
 * Nothing here used to rise above three metres inside a twelve-metre swim
 * volume, so the top half of every frame was empty water and the reef read as
 * a floor with pimples. These are authored for the canonical cameras rather
 * than scattered: the first two stand either side of the snowflake crevice so
 * the opening shot looks at its subject through a gate, and the third sits
 * deep behind the dragon to give the frame a background layer to fade into.
 *
 * Their footprints deliberately clear every hiding spot's open side. The
 * dragon is approached up the x ≈ -6 channel and the ribbon and zebra across
 * the z ≈ 6 band, which is why the west stack sits at x = -10.5 rather than
 * the -9 the eye would prefer: a pinnacle in an approach corridor is an
 * undiscoverable moray.
 *
 * Every segment is stretched, flattened and tilted, and each one overlaps the
 * one below by more than a third of its height. Round segments stacked on a
 * shared axis do not read as a sea stack; they read as a snowman, which is
 * exactly what the first pass of these looked like.
 */
const PINNACLES: readonly PinnaclePlacement[] = [
  {
    x: -10.5,
    z: 1,
    leanTo: 2.3,
    segments: [
      { radius: 2.6, rise: 1.9, stretch: 1.5, flatten: 0.72, tilt: 0.16, lean: 0 },
      { radius: 1.9, rise: 5.5, stretch: 1.7, flatten: 0.68, tilt: -0.24, lean: 0.75 },
      { radius: 0.85, rise: 8.15, stretch: 1.45, flatten: 0.78, tilt: 0.32, lean: 1.6 },
    ],
  },
  {
    x: 10,
    z: -2,
    leanTo: -0.7,
    segments: [
      { radius: 3.0, rise: 1.5, stretch: 1.4, flatten: 1.18, tilt: -0.13, lean: 0 },
      // Deliberately the shorter of the two gate posts. Matched heights either
      // side of the subject would hand the frame back its symmetry.
      { radius: 2.05, rise: 5.0, stretch: 1.62, flatten: 0.8, tilt: 0.21, lean: 0.85 },
    ],
  },
  {
    x: -7.5,
    z: -17.5,
    leanTo: 1.2,
    segments: [
      { radius: 2.5, rise: 1.6, stretch: 1.45, flatten: 0.85, tilt: 0.15, lean: 0 },
      { radius: 1.5, rise: 5.3, stretch: 1.85, flatten: 1.1, tilt: -0.26, lean: 0.65 },
    ],
  },
];

/**
 * The foreground mass in the opening shot: a shoulder of dark stone just off
 * the diver's left, close enough to be cut by the frame edge.
 *
 * A repoussoir is the cheapest depth cue there is — one near, dark, partly
 * cropped object turns a flat vista into three layers — and it is what makes
 * the composition asymmetric. It sits west of the spawn line, well clear of
 * the snowflake's corridor, and the right of the frame is left deliberately
 * empty so the eye has somewhere to travel.
 */
const FOREGROUND_SHOULDER = { x: -5.4, z: 19, radius: 2.8, rise: 0.95 } as const;

/**
 * Its grass, standing taller and tighter than the meadow so that it crops the
 * frame edge instead of dressing the floor. It grows off the shoulder's inner
 * flank — the shoulder itself fills the sand behind it — and stops two metres
 * short of the spawn line, which the diver flies straight down.
 */
const FOREGROUND_CLUMPS: readonly GrassClump[] = [
  { x: -3.4, z: 18.6, radius: 1.3, blades: 34, heightScale: 2 },
  // The corridors the canonical cameras look down, which the scattered meadow
  // reaches only by chance. A patch is 26 blades in a mesh that is drawn
  // anyway, so this is the cheapest lushness in the project and it is spent
  // exactly where it will be seen. The list is appended to rather than
  // reordered: the meadow is planted before it and the clumps in order after,
  // so a new one is the only thing new in the next screenshot.
  { x: 3.6, z: 15.4, radius: 1.7, blades: 30, heightScale: 1.15 },
  { x: -6.6, z: 12.4, radius: 2.1, blades: 34, heightScale: 1.25, broad: true },
  { x: 6.8, z: 9.4, radius: 1.9, blades: 30, heightScale: 1.2 },
  { x: 11, z: 10, radius: 1.9, blades: 28, heightScale: 1.3, broad: true },
  // W-N5: two low tufts among the corridor dressing's beds, appended per the
  // note above — the spawn channel's edges read as a path once something
  // green stands on them, and a tuft is still the cheapest way to do it.
  { x: 4.4, z: 18.4, radius: 1.4, blades: 26, heightScale: 0.95 },
  { x: -4.3, z: 13.9, radius: 1.2, blades: 22, heightScale: 0.9 },
];

/**
 * The swim-through, and the one thing in the reef with a hole in it.
 *
 * It stands frame-left of the mid-depth traverse and left of centre in the
 * opening shot, at the near edge of the middle distance in both — an opening
 * only invites you through it while you can see that there is water on the
 * other side, which means it has to be closer than the fog line and further
 * than the foreground. The span is turned about half way between the two
 * cameras' facings so that neither of them looks at it edge-on, where an arch
 * is just two rocks.
 *
 * Its clearances are the same ones every other placement here answers to: it
 * sits north of the z ≈ 6 band the ribbon and the zebra are approached across,
 * east of the x ≈ -6 channel down to the dragon, and well clear of the spawn
 * line the snowflake is found from. It is in `obstructionMeshes` like every
 * other stone, so `tests/reefSightlines` raycasts it — and the one thing that
 * would make this piece not worth having is if it had to be taken out of that
 * list to pass.
 */
const ARCH = {
  x: -4.6,
  z: 10.6,
  /** Radians the span is turned from the world x-axis. */
  turn: 0.44,
  span: 4.4,
  legHeight: 3.2,
  legRadius: 0.72,
  beamRadius: 0.5,
  rise: 1.35,
} as const;

/**
 * A hand-placed greybox of the Sunlit Coral Garden: seabed, rounded rocks,
 * the pinnacles and foreground shoulder that stage it for the camera, coral
 * bommies, instanced sea grass and several hero crevices — one per moray.
 * Each crevice's coral mound sits behind the peeking head so the line of sight
 * stays clear from the head's open side.
 *
 * Everything here is placed twice over: once for the eye, and once for the
 * raycast that decides whether a moray can be seen. `tests/reefSightlines`
 * guards the second one.
 */
export class Reef {
  readonly group = new Group();
  readonly colliders: SphereCollider[] = [];
  readonly obstructionMeshes: Mesh[] = [];
  readonly hidingSpots: HidingSpot[] = [];
  readonly bounds: ReefBounds = {
    minX: -30,
    maxX: 30,
    minY: 0.6,
    maxY: 12,
    minZ: -30,
    maxZ: 30,
    // W-M3: the canyon annex. Outside the wedge nothing about the bounds has
    // changed; inside it the box hands over to a positional floor riding
    // `seabedHeight` — which is the carved ground itself — a ceiling that
    // eases down past the gate, and a radial cap behind the far curtains.
    annex: {
      contains: insideCanyonAirspace,
      floor: (x, z) => seabedHeight(x, z) + CANYON_FLOOR_CLEARANCE,
      ceiling: canyonCeiling,
      maxRadius: AIRSPACE_MAX_RADIUS,
    },
    // Wave 8: the wings' annexes, one per wedge, by the same contract.
    annexes: wingAnnexes(seabedHeight),
  };

  // Lifted well off the old near-black: against bright sand and blue water the
  // previous value read as a silhouette hole rather than as stone.
  private readonly rockMaterial = createRockMaterial(0x8b9184);
  private readonly boulderMaterial = createRockMaterial(0x93a089);
  // Only the foreground shoulder uses this. It stands a few metres from the
  // lens with the sun behind the diver, so nothing but its own darkness will
  // hold it down against the lit reef beyond.
  private readonly silhouetteMaterial = createRockMaterial(0x3a474a);

  private readonly random: Random;
  private readonly contacts: ContactPatch[] = [];
  private grass?: SeaGrass;
  private kelp?: Kelp;
  private seaweed?: Seaweed;
  private corridorDressing?: CorridorDressing;
  /** Wave 8: each wing's flora, in registry order; `update` fans out to them. */
  private readonly wingFlora: WingFlora[] = [];

  constructor(seed: number = SEEDS.reef) {
    this.random = new Random(seed);
    this.buildRockField();
    this.buildStage();
    this.buildCoral();
    for (const placement of SPOT_PLACEMENTS) {
      this.addHidingSpot(placement);
    }
    // W-M3: the fifth crevice, appended after the frozen four and built by
    // the same machinery. Its ground is the canyon floor, so the head height
    // rides `seabedHeight` the way every other placement in the world does.
    this.addHidingSpot(abyssDenPlacement());
    // Wave 8: the wing dens, appended after the fifth in `WING_DENS` order —
    // same machinery, ground riding each wing's carved floor.
    for (const spec of WING_DENS) {
      this.addHidingSpot(wingDenPlacement(spec));
    }
    this.dressDens();
    this.buildRubble();
    this.buildSeaGrass();
    this.buildKelp();
    this.buildSeaweed();
    this.buildCorridorDressing();
    this.buildDistantReef();
    this.buildRimColliders();
    this.buildAbyssGate();
    this.buildCanyonColliders();
    this.buildAbyssFlora();
    this.buildWingColliders();
    this.buildWingFlora();
    // Last: the sand bakes a contact shadow under everything standing on it,
    // so it has to know where everything ended up. Nothing above consumes the
    // seabed mesh, and none of them share a random stream, so the reordering
    // leaves the layout identical.
    this.buildSeabed();
  }

  private buildSeabed(): void {
    // Wave 8: the sheet grew from 90 m to 112 m so every wing's carve
    // (r ≤ 50) fits at every azimuth, not only on the diagonals the canyon
    // was seeded into. Segments grew with it, so the grid keeps the same
    // ~0.94 m per vertex the sediment-line pitch was measured against.
    const geometry = createSeabedGeometry(112, 120);
    bakeSeabedOcclusion(geometry, this.contacts);
    // W-N1: the canyon walls' strata bands, multiplied into the bake. A no-op
    // to the byte everywhere `canyonBlend` is zero — see `bakeCanyonStrata`.
    bakeCanyonStrata(geometry);
    // Wave 8: each wing's own wall paint, by the same identity contract.
    bakeWingPaint(geometry);
    const seabed = new Mesh(geometry, createSandMaterial());
    seabed.receiveShadow = true;
    this.group.add(seabed);
  }

  /**
   * The free stones, drawn rather than displaced.
   *
   * Every one of these used to be the same subdivided icosahedron under
   * different noise, which can make a lump lumpier and can never make it a
   * different kind of thing. They are lathed archetypes now — see
   * {@link RockShapes} — and the only thing that has not changed is where they
   * stand: the colliders and the contact shadows are still `radius * 0.85` and
   * `radius * 1.9`, so the sand is marked where it was marked and the diver is
   * turned away where they were turned away.
   *
   * They draw from their own stream. `this.random` also scatters the rubble,
   * and a rock that takes a different number of draws than it used to would
   * re-roll a hundred and fifty pebbles out from under the next screenshot.
   */
  private buildRockField(): void {
    const random = new Random(SEEDS.rockShapes);

    for (const [index, placement] of ROCKS.entries()) {
      const seed = SEEDS.rockShapes + index * 131;
      const options = {
        seed,
        radius: placement.radius,
        height: placement.height,
        amount: placement.kind === "slab" ? 0.12 : 0.15,
      };
      const geometry =
        placement.kind === "slab" ? slabGeometry(options) : boulderGeometry(options);

      const rock = new Mesh(geometry, this.boulderMaterial);
      rock.position.set(placement.x, seabedHeight(placement.x, placement.z), placement.z);
      // Yaw freely, list barely at all. A lathed stone has a foot, and a foot
      // tumbled onto its side is a stone that fell out of the sky.
      rock.rotation.set(random.signed(0.08), random.range(0, Math.PI * 2), random.signed(0.08));
      rock.scale.set(1, 1, placement.flatten ?? 1);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
      this.obstructionMeshes.push(rock);
      this.colliders.push({
        center: rock.position.clone().setY(rock.position.y + placement.height * 0.45),
        radius: placement.radius * 0.85,
      });
      this.contacts.push({
        x: placement.x,
        z: placement.z,
        radius: placement.radius * 1.9,
        strength: 0.5,
      });
    }
  }

  /**
   * The staging pass: the pinnacles that carry the skyline and the foreground
   * shoulder that crops the opening frame.
   *
   * It draws from its own stream rather than the reef's shared one so that
   * adding to it does not reshuffle the rubble and the rock field downstream —
   * a screenshot comparison is worthless if everything moves at once.
   */
  private buildStage(): void {
    const random = new Random(SEEDS.pinnacle);

    for (const [index, pinnacle] of PINNACLES.entries()) {
      const foot = seabedHeight(pinnacle.x, pinnacle.z);
      const leanX = Math.cos(pinnacle.leanTo);
      const leanZ = Math.sin(pinnacle.leanTo);

      /**
       * One skin over the whole stack, measured off the blocks it replaces.
       *
       * Three overlapping ellipsoids read as three overlapping ellipsoids
       * however they are weathered — the seams are where two smooth surfaces
       * cross, and no amount of noise puts a crease there that a stack would
       * actually have. {@link stackGeometry} takes the same segment table as
       * its silhouette and revolves a single continuous profile through it,
       * with the lean carried as a shift of each ring rather than as a step
       * between blocks, so what is lost is the seams and what is kept is the
       * footprint, the skyline and every collider below.
       */
      const geometry = stackGeometry(pinnacle.segments, {
        seed: SEEDS.pinnacle + index * 131,
        amount: 0.15,
      });
      const stack = new Mesh(geometry, this.boulderMaterial);
      stack.position.set(pinnacle.x, foot, pinnacle.z);
      // Turned so the geometry's baked lean points along `leanTo` and the
      // flattened axis lies across it, exactly as the blocks were turned.
      stack.rotation.y = -pinnacle.leanTo;
      stack.scale.set(1, 1, meanFlatten(pinnacle.segments));
      stack.castShadow = true;
      stack.receiveShadow = true;
      this.group.add(stack);
      this.obstructionMeshes.push(stack);

      // Unchanged, and deliberately: a collider is where the diver is turned
      // away, and the new profile fits inside the blocks these were written
      // for. Moving them would change which points `reefSightlines` even
      // considers, which is a different test from the one that passes today.
      for (const segment of pinnacle.segments) {
        this.colliders.push({
          center: new Vector3(
            pinnacle.x + leanX * segment.lean,
            foot + segment.rise,
            pinnacle.z + leanZ * segment.lean,
          ),
          radius: segment.radius * 0.95 * Math.max(1, segment.flatten),
        });
      }

      const base = pinnacle.segments[0];
      if (base) {
        this.contacts.push({
          x: pinnacle.x,
          z: pinnacle.z,
          radius: base.radius * 2.1,
          strength: 0.6,
        });
      }
    }

    const shoulder = FOREGROUND_SHOULDER;
    // The one stone in the reef whose job is its outline. A slab crops the
    // frame edge where a boulder rolls away from it: the shelf's top runs level
    // out of shot instead of curving out of it, which is what a repoussoir in a
    // painted background does.
    const rock = new Mesh(
      slabGeometry({
        seed: SEEDS.pinnacle ^ 0x5c0d,
        radius: shoulder.radius * 1.24,
        height: shoulder.rise + shoulder.radius * 1.05,
        amount: 0.16,
      }),
      this.silhouetteMaterial,
    );
    rock.position.set(shoulder.x, seabedHeight(shoulder.x, shoulder.z), shoulder.z);
    rock.rotation.set(random.signed(0.1), random.range(0, Math.PI * 2), 0.1);
    rock.scale.set(1, 1, 0.78);
    rock.castShadow = true;
    rock.receiveShadow = true;
    this.group.add(rock);
    this.obstructionMeshes.push(rock);
    this.colliders.push({
      center: rock.position.clone().setY(rock.position.y + shoulder.rise),
      radius: shoulder.radius * 0.95,
    });
    this.contacts.push({
      x: shoulder.x,
      z: shoulder.z,
      radius: shoulder.radius * 2,
      strength: 0.55,
    });

    this.buildArch();
  }

  /** The swim-through; see {@link ARCH} for where it stands and why. */
  private buildArch(): void {
    const foot = seabedHeight(ARCH.x, ARCH.z);
    const arch = new Mesh(
      archGeometry({
        seed: SEEDS.rockShapes ^ 0xa2c4,
        span: ARCH.span,
        legHeight: ARCH.legHeight,
        legRadius: ARCH.legRadius,
        beamRadius: ARCH.beamRadius,
        rise: ARCH.rise,
      }),
      this.rockMaterial,
    );
    arch.position.set(ARCH.x, foot, ARCH.z);
    arch.rotation.y = -ARCH.turn;
    arch.castShadow = true;
    arch.receiveShadow = true;
    this.group.add(arch);
    this.obstructionMeshes.push(arch);

    // A leg is a column, so it takes two spheres: one would let the diver
    // through above or below the waist of the thing they can see.
    const alongX = Math.cos(ARCH.turn);
    const alongZ = -Math.sin(ARCH.turn);
    for (const side of [-1, 1]) {
      const legX = ARCH.x + alongX * side * (ARCH.span / 2);
      const legZ = ARCH.z + alongZ * side * (ARCH.span / 2);
      for (const rise of [0.85, 2.4]) {
        this.colliders.push({
          center: new Vector3(legX, foot + rise, legZ),
          radius: ARCH.legRadius * 1.2,
        });
      }
      this.contacts.push({ x: legX, z: legZ, radius: ARCH.legRadius * 3, strength: 0.5 });
    }
    // The lintel. Its underside clears the opening, so this only stops the
    // diver swimming through the stone rather than through the gap.
    this.colliders.push({
      center: new Vector3(ARCH.x, foot + ARCH.legHeight + ARCH.rise * 0.7, ARCH.z),
      radius: ARCH.beamRadius * 1.5,
    });
  }

  private buildCoral(): void {
    const coral = new CoralField(SEEDS.coral);
    this.group.add(coral.group);
    this.contacts.push(...coral.contacts);
  }

  // ─── FROZEN: the crevices (see the note above `SPOT_PLACEMENTS`) ───────────
  private addHidingSpot(placement: SpotPlacement): void {
    const { position, facing } = placement;
    const forward = new Vector3(Math.sin(facing), 0, Math.cos(facing));
    const back = forward.clone().negate();
    const right = new Vector3(forward.z, 0, -forward.x);

    // Coral mound behind the head (along the body/deeper direction).
    //
    // Every vertex of it stands exactly where it stood before the reef went
    // round: `preserveProfile` keeps the old displacement field, so this shape
    // is bit-identical and the line of sight through the crevice cannot have
    // moved. What it does take is the new smooth normals, which is the half of
    // "chiselled" the camera actually sees.
    const moundGeometry = new DodecahedronGeometry(3.0, 1);
    weatherRock(moundGeometry, SEEDS.rock ^ hashSpecies(placement.speciesId), {
      amount: 0.2,
      inwardOnly: true,
      preserveProfile: true,
    });
    const mound = new Mesh(moundGeometry, this.rockMaterial);
    mound.position.copy(position).addScaledVector(back, 3.9);
    mound.position.y = position.y + 1.0;
    mound.scale.set(1.5, 0.8, 1.2);
    mound.rotation.y = facing;
    mound.castShadow = true;
    mound.receiveShadow = true;
    this.group.add(mound);
    this.obstructionMeshes.push(mound);
    this.colliders.push({
      center: position.clone().addScaledVector(back, 3.9).setY(position.y + 0.3),
      radius: 3.0,
    });

    // Dark cave mouth framing the crevice, facing the head's open side.
    // The interior ramp carries the depth — near-black in the throat, a trace
    // of cool rock by the rim — and the alpha falls off outward so the mouth
    // blends into the mound instead of sitting on it like a sticker.
    const cave = new Mesh(
      new CircleGeometry(1.25, 28),
      new MeshBasicMaterial({
        map: caveInterior(),
        transparent: true,
        depthWrite: false,
        alphaMap: caveFalloff(),
      }),
    );
    cave.position.copy(position).addScaledVector(back, 0.95).setY(position.y - 0.05);
    cave.rotation.y = facing;
    this.group.add(cave);

    // Flank blocks framing the mouth (a natural cleaner-shrimp perch).
    //
    // Segmented finely enough for `weatherRock` to have something to work
    // with. A box at two segments an axis has one vertex ring to displace per
    // face, so however much it is weathered it stays a box with a bevel — six
    // flat faces and twelve straight edges, standing beside the moray's head
    // where the camera is closest to it and reading as laid masonry. At four
    // it breaks up like every other stone in the reef.
    //
    // These hold the old profile for the same reason the mound does. They
    // stand a body's width either side of the head and narrow the view into the
    // crevice on purpose, which is the one thing the sightline test measures
    // and does not fully pin down: it asks that three quarters of the approach
    // be clear, and a stone free to bulge a third further out is free to spend
    // that margin. Smooth normals round them off without spending anything.
    for (const sign of [-1, 1]) {
      const flankGeometry = new BoxGeometry(1.1, 1.7, 1.5, 4, 4, 4);
      weatherRock(flankGeometry, SEEDS.rock ^ hashSpecies(placement.speciesId + sign), {
        amount: 0.3,
        preserveProfile: true,
      });
      const flank = new Mesh(flankGeometry, this.rockMaterial);
      flank.position
        .copy(position)
        .addScaledVector(back, 1.9)
        .addScaledVector(right, sign * 1.9)
        .setY(position.y - 0.5);
      // Two matched blocks square to the mouth form a right-angled doorway
      // around the eel — the last trace of greybox in the close-up. Yawing
      // each off the mound axis, sinking them, and scaling them unequally
      // turns the doorway back into two stones that happen to sit there.
      const skew = ((hashSpecies(placement.speciesId + String(sign)) % 100) / 100 - 0.5) * 0.4;
      flank.rotation.y = facing + sign * 0.24 + skew;
      flank.scale.set(1 + sign * 0.14, 0.94 - sign * 0.12, 1.08);
      flank.castShadow = true;
      flank.receiveShadow = true;
      this.group.add(flank);
    }

    this.contacts.push({
      x: mound.position.x,
      z: mound.position.z,
      radius: 5.4,
      strength: 0.5,
    });

    this.hidingSpots.push({ speciesId: placement.speciesId, position: position.clone(), facing });
  }
  // ─── end FROZEN ───────────────────────────────────────────────────────────

  /**
   * Dresses each crevice with the sculpted rock archway; see {@link DEN}.
   *
   * Purely additive over the frozen dressing: the mound, the cave mouth and
   * the flanks are all still there and still exactly where they were, and
   * they are what the player sees when the file does not load — the same
   * fallback contract every authored asset in the project answers to.
   *
   * Every pose is drawn from `SEEDS.denDressing` *before* the request is
   * made, so the dressing is identical whether the file arrives from the
   * network or the cache — an async draw order is not a thing a seeded world
   * can be allowed to have.
   */
  private dressDens(): void {
    const random = new Random(SEEDS.denDressing);
    const poses = SPOT_PLACEMENTS.map((placement) => ({
      placement,
      tiltX: random.signed(0.04),
      yaw: placement.facing + random.signed(0.1),
      tiltZ: random.signed(0.04),
      scale: DEN.scale * (1 + random.signed(0.06)),
      sink: DEN.sink + random.range(0, 0.08),
    }));

    // W-M3: the abyss den's pose comes off its own stream (`SEEDS.abyssDen`),
    // drawn after the four above have taken exactly the draws they always
    // took — so the frozen dens are dressed identically to the bit and the
    // fifth can be retuned without moving them.
    const abyssRandom = new Random(SEEDS.abyssDen);
    const abyssPlacement = abyssDenPlacement();
    poses.push({
      placement: abyssPlacement,
      tiltX: abyssRandom.signed(0.04),
      yaw: abyssPlacement.facing + abyssRandom.signed(0.1),
      tiltZ: abyssRandom.signed(0.04),
      scale: DEN.scale * (1 + abyssRandom.signed(0.06)),
      sink: DEN.sink + abyssRandom.range(0, 0.08),
    });

    // Wave 8: the wing dens' poses, off their own pre-registered stream and
    // drawn in `WING_DENS` order — so the five dens above are dressed
    // identically to the bit, and a wing den can be retuned without moving
    // any other.
    const wingRandom = new Random(SEEDS.wingDens);
    for (const spec of WING_DENS) {
      const placement = wingDenPlacement(spec);
      poses.push({
        placement,
        tiltX: wingRandom.signed(0.04),
        yaw: placement.facing + wingRandom.signed(0.1),
        tiltZ: wingRandom.signed(0.04),
        scale: DEN.scale * (1 + wingRandom.signed(0.06)),
        sink: DEN.sink + wingRandom.range(0, 0.08),
      });
    }

    requestModel("models/creature-den-mouth.glb", (source) => {
      // One clone shared by all four mouths, because the cached geometry is
      // the library's and these UVs are ours to change: the file lays one UV
      // unit per wash tile (~2.3 m), and the rock material's wash texture
      // carries `repeat = 2`, so the coordinates are halved to land the tile
      // at the same spacing every other stone in the reef wears it.
      const geometry = source.clone();
      const uv = geometry.getAttribute("uv");
      if (uv) {
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);
        }
        uv.needsUpdate = true;
      }

      for (const pose of poses) {
        const { position, facing } = pose.placement;
        // The rock family's own material: the file's vertex colours are a
        // near-neutral multiplier authored to take this tint, and its inner
        // faces already shade toward the crevices' violet-blue.
        const den = new Mesh(geometry, this.rockMaterial);
        den.name = "den-mouth";
        den.position
          .copy(position)
          .addScaledVector(new Vector3(-Math.sin(facing), 0, -Math.cos(facing)), DEN.setback);
        den.position.y = seabedHeight(den.position.x, den.position.z) - pose.sink;
        den.rotation.set(pose.tiltX, pose.yaw, pose.tiltZ);
        den.scale.setScalar(pose.scale);
        den.castShadow = true;
        den.receiveShadow = true;
        this.group.add(den);
      }
    });
  }

  /**
   * Small stones strewn across the sand. Bare seabed is the dead space that
   * makes an open reef read as an empty stage, and rubble is the cheapest way
   * to give the eye something to travel over between the set pieces.
   */
  private buildRubble(): void {
    const count = 150;
    const material = createToonMaterial({
      // Close to the sand it lies on. Stones darker than this read as holes
      // punched in the seabed rather than as pebbles resting on it.
      color: 0xc4baa0,
    });
    // Smooth, like every other stone in the reef now — and here that is the
    // whole of the change, because a dodecahedron at detail 0 is already
    // carrying face normals in its buffer and the material flag was doing
    // nothing. Welding them turns twelve pentagons into one worn pebble.
    const stoneGeometry = new DodecahedronGeometry(0.24, 0);
    smoothNormals(stoneGeometry);
    const stones = new InstancedMesh(stoneGeometry, material, count);
    stones.receiveShadow = true;
    // No cast shadow: at this size the contact shadow is larger than the stone
    // and turns a scattering of pebbles into a scattering of dark smudges.
    stones.castShadow = false;

    const dummy = new Object3D();
    const color = new Color();
    for (let i = 0; i < count; i++) {
      const x = this.random.signed(30);
      const z = this.random.signed(30);
      dummy.position.set(x, seabedHeight(x, z) + this.random.range(-0.04, 0.06), z);
      dummy.rotation.set(
        this.random.range(0, Math.PI),
        this.random.range(0, Math.PI),
        this.random.range(0, Math.PI),
      );
      // Flattened, as though long settled rather than freshly dropped.
      dummy.scale.set(
        this.random.range(0.35, 1.1),
        this.random.range(0.18, 0.45),
        this.random.range(0.35, 1.1),
      );
      dummy.updateMatrix();
      stones.setMatrixAt(i, dummy.matrix);

      color.setHex(0xc4baa0).multiplyScalar(this.random.range(0.82, 1.1));
      stones.setColorAt(i, color);
    }
    stones.instanceMatrix.needsUpdate = true;
    if (stones.instanceColor) {
      stones.instanceColor.needsUpdate = true;
    }
    this.group.add(stones);
  }

  private buildSeaGrass(): void {
    const clearances = this.hidingSpots.map((spot) => new Vector2(spot.position.x, spot.position.z));
    this.grass = new SeaGrass(SEEDS.grass, clearances, FOREGROUND_CLUMPS);
    this.group.add(this.grass.mesh);
  }

  /**
   * The forest layer.
   *
   * Built by the reef rather than registered as a `LifeSystem`, and that is a
   * decision rather than an omission. A life system is handed the diver's
   * position and speed every frame and is owned by `Game`'s `LifeRegistry` —
   * kelp needs neither: it is scenery that moves, exactly like the meadow, and
   * it is driven by the same two numbers `Reef.update` already has. Wiring it
   * through the registry would mean editing `Game.ts` to gain a per-frame
   * context it does not use.
   */
  private buildKelp(): void {
    this.kelp = new Kelp(SEEDS.kelp);
    this.group.add(this.kelp.group);
  }

  /** The flora accents (W-L9): seaweed bushes and drooping frond rosettes. */
  private buildSeaweed(): void {
    this.seaweed = new Seaweed(SEEDS.seaweed);
    this.group.add(this.seaweed.group);
  }

  /**
   * Low colour framing the spawn corridor's first metres (W-N5); see
   * {@link CorridorDressing}. Its own stream, its own module — scenery by
   * construction, in neither `obstructionMeshes` nor `colliders` — and its
   * contact patches join the seabed bake like everything else standing on
   * the sand.
   */
  private buildCorridorDressing(): void {
    this.corridorDressing = new CorridorDressing(SEEDS.corridorDressing);
    this.group.add(this.corridorDressing.group);
    this.contacts.push(...this.corridorDressing.contacts);
  }

  /**
   * The painted distance (W-L9): silhouette rings standing well beyond the
   * rim, deliberately in neither `obstructionMeshes` nor `colliders` — they
   * are backdrop, and nothing playable can ever reach them.
   */
  private buildDistantReef(): void {
    this.group.add(new DistantReef(SEEDS.distantReef).group);
  }

  /**
   * Turns the diver away from the rim ridge (W-L9).
   *
   * `seabedHeight` now climbs metres past `RIM_FROM`, and the swim volume's
   * floor is a flat y = 0.6 — without these a diver at the bounds' corner is
   * inside a hillside. A ring of spheres at the ridge's inner shoulder does
   * what every rock already does: turns the body away before the camera can
   * clip. They sit at radius 33.5, so their surfaces stand near r = 27 where
   * the ridge is still ankle height. Every sightline sample in
   * `tests/reefSightlines.test.ts` lives within 14 m of a head — over ten
   * metres clear of these — so `reachable()` evaluates exactly what it did.
   */
  private buildRimColliders(): void {
    // Wave 8: the rim is mostly doorways now — the canyon's gate plus the
    // fifteen wings' — so the W-L9 ring of 24 spheres became a fence of
    // *gap fins*: one stack of spheres at the midpoint of every stretch of
    // standing rock between two adjacent gates. Placed at r = 31.5 with
    // radius 4.5 so their inner surfaces stand near r = 27, which is where
    // the old ring turned the diver away — the ridge is still ankle height
    // there and nothing can clip into the crest. Each doorway keeps a free
    // channel between its two flanking fins; inside a wedge the wing's own
    // wall colliders and annex take over.
    const gates = [GATE_AZIMUTH, ...wingGateAzimuths()]
      .map((azimuth) => ((azimuth % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
      .sort((a, b) => a - b);
    for (let i = 0; i < gates.length; i++) {
      const current = gates[i]!;
      const next = gates[(i + 1) % gates.length]!;
      const span = i + 1 < gates.length ? next - current : next + Math.PI * 2 - current;
      const theta = current + span / 2;
      for (const y of [1.6, 5]) {
        this.colliders.push({
          center: new Vector3(Math.cos(theta) * 31.5, y, Math.sin(theta) * 31.5),
          radius: 4.5,
        });
      }
    }

    // The two shelves take sunken spheres whose crowns sit just over their
    // tops, so the diver glides up and over them the way they do a dune —
    // same approximation every boulder already is. The hollow needs nothing:
    // ground that falls away cannot be clipped into.
    const domes: readonly { x: number; z: number; y: number; radius: number }[] = [
      { x: 1, z: -19, y: -3.6, radius: 5 },
      { x: 7, z: -19, y: -3.6, radius: 5 },
      { x: 4, z: -16, y: -3.6, radius: 5 },
      { x: 4, z: -22, y: -3.6, radius: 5 },
      { x: -21, z: 13, y: -3.3, radius: 4.5 },
      { x: -17, z: 13, y: -3.3, radius: 4.5 },
    ];
    for (const dome of domes) {
      this.colliders.push({
        center: new Vector3(dome.x, dome.y, dome.z),
        radius: dome.radius,
      });
    }
  }

  /**
   * The gate (W-M3): two pinnacle stacks flanking the notch the canyon cuts
   * through the rim, standing on its sloping jambs with their crowns leaning
   * in over the doorway. They are ordinary reef stones in every contract —
   * `stackGeometry`, the rock material, `obstructionMeshes`, per-segment
   * colliders, a contact patch — and they stand outside every canonical
   * frustum and outside the sun's ±24 m shadow box, so nothing in the bowl's
   * shot set can see them arrive.
   */
  private buildAbyssGate(): void {
    for (const [index, post] of GATE_STACKS.entries()) {
      const azimuth = GATE_AZIMUTH + post.across;
      const x = Math.cos(azimuth) * post.r;
      const z = Math.sin(azimuth) * post.r;
      const foot = seabedHeight(x, z);
      // Crowns lean tangentially in over the doorway: toward the axis, which
      // from a post's own azimuth is a quarter turn toward the gate's centre.
      const leanTo = azimuth - Math.sign(post.across) * (Math.PI / 2);
      const leanX = Math.cos(leanTo);
      const leanZ = Math.sin(leanTo);

      const stack = new Mesh(
        stackGeometry(post.segments, { seed: SEEDS.abyss ^ (0x6a7e + index * 131), amount: 0.15 }),
        this.boulderMaterial,
      );
      stack.name = "abyss-gate-stack";
      stack.position.set(x, foot, z);
      stack.rotation.y = -leanTo;
      stack.scale.set(1, 1, meanFlatten(post.segments));
      stack.castShadow = true;
      stack.receiveShadow = true;
      this.group.add(stack);
      this.obstructionMeshes.push(stack);

      for (const segment of post.segments) {
        this.colliders.push({
          center: new Vector3(
            x + leanX * segment.lean,
            foot + segment.rise,
            z + leanZ * segment.lean,
          ),
          radius: segment.radius * 0.95 * Math.max(1, segment.flatten),
        });
      }

      const base = post.segments[0];
      if (base) {
        this.contacts.push({ x, z, radius: base.radius * 2.1, strength: 0.6 });
      }
    }

    this.buildSillStones();
    this.buildShelfLipStones();
  }

  /**
   * A scatter of worn stones along the gate's sill (W-N1). From shot I the
   * saddle's crest used to meet the deep-water band on a dead-straight
   * horizontal line with nothing on it — "the edge of an unfinished level",
   * per the round critic — and a handful of silhouettes on the crest is the
   * cheapest thing that breaks it. They are scenery by construction, like
   * `dressDens`' arches: in neither `obstructionMeshes` nor `colliders`, so
   * every sightline and every collider the canyon was tuned against evaluates
   * exactly what it did. Placement stays off the descent corridor — at least
   * 1.7 m of lateral clearance against a sightline sweep that uses ±0.3 — and
   * everything draws from `SEEDS.canyonPaint`: these are new placed elements,
   * so the gate stacks' own stream is untouched.
   */
  private buildSillStones(): void {
    const random = new Random(SEEDS.canyonPaint ^ 0x5111);
    const count = 9;
    const material = createToonMaterial({
      // A step into the strata's first band rather than the bowl pebbles'
      // sand-match: these stand against the deep-water band, and a stone the
      // colour of the sand it crests reads as a lump of the same flat edge.
      color: 0xa195ac,
    });
    const geometry = new DodecahedronGeometry(0.34, 0);
    smoothNormals(geometry);
    const stones = new InstancedMesh(geometry, material, count);
    stones.name = "abyss-sill-stones";
    stones.castShadow = false;
    stones.receiveShadow = true;
    // Parented at the sill's centre rather than the origin, so the cost
    // probe's wedge collector finds it and the bounding sphere is honest.
    const centerX = GATE_AXIS.x * 32.7;
    const centerZ = GATE_AXIS.z * 32.7;
    stones.position.set(centerX, 0, centerZ);

    const perpX = -GATE_AXIS.z;
    const perpZ = GATE_AXIS.x;
    const dummy = new Object3D();
    const color = new Color();
    for (let i = 0; i < count; i++) {
      // Tight on the crest ring the bowl-side eye actually grazes. Measured
      // from shot I's camera, the visual horizon is the raised sill at
      // r ≈ 30.2 (ground +1.7, ray slope −0.035): a stone at r = 33 would
      // need 2.7 m of height to notch the line, while on the crest itself
      // half a metre does it. The first two cuts scattered to 34–36 and
      // vanished below the horizon they were placed to break.
      const r = random.range(30.1, 31.6);
      const side = random.next() < 0.5 ? -1 : 1;
      const lateral = side * random.range(1.7, 5.2);
      const x = GATE_AXIS.x * r + perpX * lateral;
      const z = GATE_AXIS.z * r + perpZ * lateral;
      dummy.position.set(
        x - centerX,
        seabedHeight(x, z) + random.range(-0.05, 0.04),
        z - centerZ,
      );
      dummy.rotation.set(
        random.range(0, Math.PI),
        random.range(0, Math.PI),
        random.range(0, Math.PI),
      );
      dummy.scale.set(random.range(1.2, 2.6), random.range(1.0, 1.9), random.range(1.2, 2.6));
      dummy.updateMatrix();
      stones.setMatrixAt(i, dummy.matrix);
      color.setHex(0xa195ac).multiplyScalar(random.range(0.85, 1.12));
      stones.setColorAt(i, color);

      this.contacts.push({ x, z, radius: 0.7, strength: 0.4 });
    }
    stones.instanceMatrix.needsUpdate = true;
    if (stones.instanceColor) {
      stones.instanceColor.needsUpdate = true;
    }
    // An instance-aware sphere, computed once: these never move, and the
    // geometry's own 0.34 m sphere at the node would cull them wrongly.
    stones.computeBoundingSphere();
    this.group.add(stones);
  }

  /**
   * Standing stones at the shelf's lips (W-O1). The look-back — from the
   * twilight floor toward the gate — used to cross ten metres of bare slope
   * between the camera and the sill crest: one uninterrupted mauve field, the
   * round critic's words. Two small groups of taller stones break it into
   * layers: four on the upper lip where the shelf tips over (r ≈ 35–37.2,
   * where they notch the look-back's horizon against the doorway's bright
   * water — measured from the AB6 camera at (28.9, −4.4, 29.2) the grazing
   * ray passes r = 36 around y ≈ −1, so a stone standing a metre off the
   * ground there cuts it), and three smaller ones low near the floor's edge
   * for the foreground. Scenery by construction, exactly like the sill
   * stones: no obstruction meshes, no colliders, lateral clearance ≥ 1.8 m
   * against the descent corridor's ±0.3 m sightline sweep, and every draw
   * from a fresh `SEEDS.canyonPaint` substream so nothing W-N1 placed can
   * re-roll.
   */
  private buildShelfLipStones(): void {
    const random = new Random(SEEDS.canyonPaint ^ 0x0b5e);
    const material = createToonMaterial({
      // A step deeper than the sill stones' band-one grey: these stand
      // against the doorway's bright water and the gate-glow slope, and a
      // silhouette is a value, not a hue.
      color: 0x9188a6,
    });
    const geometry = new DodecahedronGeometry(0.34, 0);
    smoothNormals(geometry);

    const groups: readonly {
      readonly count: number;
      readonly rMin: number;
      readonly rMax: number;
      readonly latMin: number;
      readonly latMax: number;
      readonly tallMin: number;
      readonly tallMax: number;
    }[] = [
      // The upper lip: tall enough to notch the look-back horizon.
      { count: 5, rMin: 35.0, rMax: 37.2, latMin: 1.8, latMax: 4.6, tallMin: 2.2, tallMax: 5.4 },
      // The floor's edge: low foreground interest at the near lip.
      { count: 4, rMin: 38.4, rMax: 40.2, latMin: 2.0, latMax: 5.6, tallMin: 1.3, tallMax: 2.6 },
    ];
    const total = groups.reduce((sum, group) => sum + group.count, 0);
    const stones = new InstancedMesh(geometry, material, total);
    stones.name = "abyss-shelf-stones";
    stones.castShadow = false;
    stones.receiveShadow = true;
    // Parented at the shelf's centre, like the sill stones: the cost probe's
    // wedge collector finds it and the instance sphere is honest.
    const centerX = GATE_AXIS.x * 37.4;
    const centerZ = GATE_AXIS.z * 37.4;
    stones.position.set(centerX, 0, centerZ);

    const perpX = -GATE_AXIS.z;
    const perpZ = GATE_AXIS.x;
    const dummy = new Object3D();
    const color = new Color();
    let index = 0;
    for (const group of groups) {
      for (let i = 0; i < group.count; i++) {
        const r = random.range(group.rMin, group.rMax);
        // Alternate jambs rather than coin-flip: seven stones on one side is
        // a re-roll away, and the frame needs both edges held.
        const side = index % 2 === 0 ? -1 : 1;
        const lateral = side * random.range(group.latMin, group.latMax);
        const x = GATE_AXIS.x * r + perpX * lateral;
        const z = GATE_AXIS.z * r + perpZ * lateral;
        dummy.position.set(
          x - centerX,
          seabedHeight(x, z) + random.range(-0.08, 0.02),
          z - centerZ,
        );
        // Upright standing stones, not tumbled: only yaw spins freely, so
        // the vertical stretch stays vertical and the silhouette reads.
        dummy.rotation.set(
          random.signed(0.16),
          random.range(0, Math.PI * 2),
          random.signed(0.16),
        );
        dummy.scale.set(
          random.range(1.1, 2.2),
          random.range(group.tallMin, group.tallMax),
          random.range(1.1, 2.2),
        );
        dummy.updateMatrix();
        stones.setMatrixAt(index, dummy.matrix);
        color.setHex(0x9188a6).multiplyScalar(random.range(0.82, 1.1));
        stones.setColorAt(index, color);
        this.contacts.push({ x, z, radius: 0.6, strength: 0.35 });
        index++;
      }
    }
    stones.instanceMatrix.needsUpdate = true;
    if (stones.instanceColor) {
      stones.instanceColor.needsUpdate = true;
    }
    stones.computeBoundingSphere();
    this.group.add(stones);
  }

  /**
   * What keeps the diver inside the canyon (W-M3): two rows of wall spheres
   * along each side of the wedge — the same job the rim ring does, done along
   * a line instead of a circle — and an end pair flanking the den's mound
   * where the carve fades out, so the silhouette curtains are never reached.
   * The airspace annex in `bounds` is deliberately wider than these walls;
   * a sphere always turns the body before the zone changes hands.
   */
  private buildCanyonColliders(): void {
    const perpX = -GATE_AXIS.z;
    const perpZ = GATE_AXIS.x;
    const wallAcross = FLOOR_HALF + 0.105;

    for (const r of [36, 39.5, 43, 46.5]) {
      for (const side of [-1, 1]) {
        const lateral = side * Math.sin(wallAcross) * r;
        const along = Math.cos(wallAcross) * r;
        const x = GATE_AXIS.x * along + perpX * lateral;
        const z = GATE_AXIS.z * along + perpZ * lateral;
        for (const y of [-4.5, 1.5]) {
          this.colliders.push({ center: new Vector3(x, y, z), radius: 4.6 });
        }
      }
    }

    for (const side of [-1, 1]) {
      const x = GATE_AXIS.x * 48 + perpX * side * 4.3;
      const z = GATE_AXIS.z * 48 + perpZ * side * 4.3;
      for (const y of [-5, 0.8]) {
        this.colliders.push({ center: new Vector3(x, y, z), radius: 4.5 });
      }
    }
  }

  /** The twilight life accents and the far curtains; see {@link AbyssFlora}. */
  private buildAbyssFlora(): void {
    this.group.add(new AbyssFlora(SEEDS.abyssFlora).group);
  }

  /**
   * Wave 8: the walls that keep a diver inside a wing's wedge — the canyon's
   * own collider pattern, derived per wing from its frozen envelope. One
   * shared builder in `WingField`, so a wing owner never edits this file.
   *
   * R0: a gateway wing whose depth-1 region has actually landed keeps no
   * end wall — the province opens through it. Gateways without a region
   * yet stay walled, so an unfinished province is a place the diver has
   * simply not been shown, not a hole.
   */
  private buildWingColliders(): void {
    const open = new Set(
      REGION_SLOTS.filter((slot) => slot.depth === 1 && regionBySlot(slot.id) !== undefined).map(
        (slot) => slot.gatewayWingId,
      ),
    );
    this.colliders.push(...wingWallColliders(open));
  }

  /**
   * Wave 8: each wing's flora, from its owner's builder in
   * `WingFloraRegistry`. Contacts join the seabed bake like everything else
   * standing on the sand; `update` fans the frame out to any wing that
   * moves. Scenery by construction unless a wing's ledger note says
   * otherwise.
   */
  private buildWingFlora(): void {
    for (const wing of WINGS) {
      const builder = WING_FLORA_BUILDERS[wing.id];
      if (!builder) {
        continue;
      }
      const flora = builder(wing);
      this.group.add(flora.group);
      if (flora.contacts) {
        this.contacts.push(...flora.contacts);
      }
      this.wingFlora.push(flora);
    }
  }

  /** Advances the ambient life in the reef: the meadow's sway, the kelp's and the seaweed's. */
  update(dt: number, reducedMotion: boolean): void {
    this.grass?.update(dt, reducedMotion);
    this.kelp?.update(dt, reducedMotion);
    this.seaweed?.update(dt, reducedMotion);
    this.corridorDressing?.update(dt, reducedMotion);
    for (const flora of this.wingFlora) {
      flora.update?.(dt, reducedMotion);
    }
  }
}

/**
 * Wave 8: resolves a wing den's wing-relative spec into a world placement,
 * the way `abyssDenPlacement` resolves the fifth den — the head rides the
 * carved ground, and the default facing looks back up the wing toward its
 * gate so the approach corridor the sightline machinery guards is the wing
 * itself.
 */
function wingDenPlacement(spec: WingDenSpec): SpotPlacement {
  const wing = wingById(spec.wingId);
  const azimuth = wing.azimuth + spec.across;
  const x = Math.cos(azimuth) * spec.r;
  const z = Math.sin(azimuth) * spec.r;
  const axisX = Math.cos(wing.azimuth);
  const axisZ = Math.sin(wing.azimuth);
  return {
    speciesId: spec.speciesId,
    position: new Vector3(x, seabedHeight(x, z) + spec.headAbove, z),
    facing: Math.atan2(-axisX, -axisZ) + spec.facingOffset,
  };
}
