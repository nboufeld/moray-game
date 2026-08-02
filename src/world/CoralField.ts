import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Object3D,
  Vector3,
  type BufferGeometry,
  type MeshToonMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { requestAlbedo, requestModel } from "../rendering/AssetLibrary";
import { createToonMaterial } from "../rendering/ToonShading";
import { Random } from "../util/Random";
import {
  CORAL_MODELS,
  CORAL_WASHES,
  FAN_ALPHA_TEST,
  FAN_ASSET,
  FAN_HEIGHT,
  coralGeometry,
  coralSkin,
  fanTexture,
  unpackCoralWash,
  unpackFan,
  type CoralKind,
} from "./CoralShapes";
import { seabedHeight } from "./Seabed";

/**
 * A designed coral garden, in five species and three sizes.
 *
 * What the shapes are lives in `CoralShapes`; this file is where they stand,
 * what colour they are, and what they are not allowed to stand in front of.
 *
 * ## Masses, not confetti
 *
 * The garden this replaces was five bommies of one small size, drawn from one
 * six-colour palette. Every bommie therefore looked like every other bommie,
 * and the reef read as ground cover with lumps in it. Three things change that
 * and all three are composition rather than content:
 *
 * **Hierarchy inside a cluster.** Each one is built landmark-first: one to
 * three modelled pieces up to 1.6 m that carry the cluster's silhouette from
 * across the reef, a handful of mid pieces at half that, and the small heads
 * filling the ground between them. A garden with no landmark has no scale, and
 * a viewer fifteen metres out cannot tell it from gravel.
 *
 * **A colour family per cluster.** Rose here, ochre there, violet against the
 * west stack — with a fifth of each cluster drawn from a neighbouring family so
 * the mass has some life in it. Six clusters drawing from one shared palette
 * average to the same dusty mid-tone at any distance, which is the confetti
 * failure the fish school was cured of in WP-G8, arriving from the other
 * direction.
 *
 * **Drifts between them.** A line of small heads and fans running from one
 * cluster to the next, thinning in the middle. Clusters alone are islands, and
 * the eye reads islands as objects placed on a floor; a drift is what turns six
 * objects into one reef.
 *
 * ## What the garden may not do
 *
 * Every piece is filtered through {@link isClear}, and the reason is that this
 * is a game about finding four animals in holes. Coral is not in
 * `Reef.obstructionMeshes`, so it can never *technically* hide a moray — which
 * makes this the dangerous kind of constraint, the one nothing fails on. A
 * thicket in a crevice mouth costs the player the discovery just as surely, and
 * the only thing that catches it is a rule stated up front and a test that
 * reads it back.
 */

/** The garden's colour families. */
export type CoralFamily = "rose" | "ochre" | "violet" | "mixed";

/**
 * A cluster of coral.
 *
 * Everything past `heads` is optional and defaults to a modest mixed bommie,
 * which is exactly what the sanctuary's four sites are and what they stay:
 * `SanctuaryScene` passes `{ x, z, heads }` and gets a room dressed from the
 * same generators without knowing any of this exists.
 */
export interface ClusterSite {
  readonly x: number;
  readonly z: number;
  /** Small fill heads — branching sprays and polyp-crusted domes. */
  readonly heads: number;
  /** Modelled landmarks: staghorn thickets and brain domes, largest first. */
  readonly landmarks?: number;
  /** Plate stacks and sponge clusters, at half a landmark's size. */
  readonly mid?: number;
  readonly fans?: number;
  /** How far the cluster spreads, in metres. */
  readonly radius?: number;
  /** The tallest landmark here, in metres. */
  readonly crown?: number;
  readonly family?: CoralFamily;
}

const CLUSTER_DEFAULTS = {
  landmarks: 1,
  mid: 2,
  fans: 3,
  radius: 2.8,
  crown: 0.95,
  family: "mixed" as CoralFamily,
};

/**
 * The reef's six gardens.
 *
 * Authored for the canonical cameras, exactly as the pinnacles are, and moved
 * only where {@link isClear} forced it. Shot A looks down the z axis from
 * (0, 2, 22), shot B crosses the middle of the reef from (10, 3, 12), shot C
 * stands at the snowflake's crevice and shot G is down at knee height on the
 * eastern shoulder — so the density is spent there and the far corners are
 * left to the rubble.
 *
 * Two of the old five had to move rather than merely grow. The bommie at
 * (4.2, -1.2) stood 4.4 m from the snowflake's mound and the one at
 * (-16.2, 9.6) stood 4.6 m from the ribbon's; both are inside the six-metre
 * ring this package draws around a crevice, and both were about to be given
 * landmark pieces a metre and a half tall.
 */
const SITES: readonly ClusterSite[] = [
  /**
   * The garden the opening shot is about. It is the only colour in A's middle
   * distance, half way between the dark foreground shoulder and the crevice —
   * so it is the largest of the six and it carries the tallest thicket in the
   * reef.
   */
  { x: -5.2, z: 11.6, heads: 13, landmarks: 4, mid: 5, fans: 12, radius: 3.8, crown: 1.75, family: "rose" },
  /** The eastern bommie, square in shot B's frame and behind shot G's. */
  { x: 6.8, z: -3.8, heads: 12, landmarks: 3, mid: 4, fans: 8, radius: 3.4, crown: 1.55, family: "ochre" },
  /** Banked out from the west stack's foot, far enough not to grow into it. */
  { x: -13.5, z: -3.0, heads: 11, landmarks: 3, mid: 3, fans: 9, radius: 3.2, crown: 1.6, family: "violet" },
  /** The east stack's garden, the warm mass on B's right. */
  { x: 14.8, z: -3.4, heads: 11, landmarks: 3, mid: 3, fans: 7, radius: 3.2, crown: 1.45, family: "rose" },
  /** Deep south: the layer the frame fades into, so it stays low and warm. */
  { x: 2.5, z: -18.5, heads: 9, landmarks: 2, mid: 2, fans: 4, radius: 3.0, crown: 1.3, family: "ochre" },
  /**
   * The tidepool garden, and the only one placed for a camera two metres off
   * the sand. Shot G's foreground was bare — it is the one canonical pose that
   * looks *down* at the reef rather than across it. No landmark: a metre and a
   * half of staghorn two metres from the lens is a wall, not a garden. Its
   * eastern side thins out on its own, because W-L5's anemones are coming to
   * (7.5, 8.5) and that disc is in {@link CLEARANCES}.
   */
  { x: 4.6, z: 8.9, heads: 8, landmarks: 0, mid: 3, fans: 7, radius: 2.4, family: "rose" },
  /**
   * The two that frame the snowflake's crevice, and the reason they exist is
   * that the six-metre ring emptied shot C.
   *
   * C stands eight metres out and looks straight at the mouth: everything the
   * old garden put in that frame was inside the ring, and taking it out left a
   * bare stage with a hole in the middle of it. These stand just *outside* the
   * ring, east and west, so the shot gets a garden around the crevice rather
   * than in it — which is a better composition than the one the constraint
   * broke, and it is also what the spawn corridor asks for: the eye runs down
   * an empty channel of sand between two masses of colour, straight to the
   * animal.
   *
   * The western one is squeezed. The dragon's corridor takes x from -8.4 to
   * -3.6 up to z = 2 and the ribbon-and-zebra band takes z from 4.2 to 7.8, so
   * what is left over there is a two-metre slot between them; it gets a small
   * radius and no landmark rather than a landmark that would be rejected.
   */
  { x: 6.6, z: 1.6, heads: 8, landmarks: 2, mid: 3, fans: 7, radius: 2.6, crown: 1.35, family: "violet" },
  { x: -6.3, z: 3.1, heads: 6, landmarks: 0, mid: 2, fans: 6, radius: 1.9, family: "ochre" },
];

/**
 * Drifts of small coral running between the clusters, by index into
 * {@link SITES}.
 *
 * They are deliberately sparse and deliberately not straight: a drift's job is
 * to say the two masses at its ends are part of one reef, and a hedge between
 * them says something else entirely.
 */
const DRIFTS: readonly (readonly [number, number, number])[] = [
  [0, 5, 7],
  [0, 2, 6],
  [1, 3, 6],
  [1, 5, 5],
  [2, 4, 5],
  [1, 4, 6],
  [5, 6, 5],
  [6, 1, 5],
  [7, 2, 5],
  [0, 7, 5],
];

/**
 * Where the morays hide, and the mounds they hide in.
 *
 * A copy of `SPOT_PLACEMENTS` and the mound offset from `Reef`, rather than an
 * import: `Reef` builds a `CoralField`, so reaching back the other way is a
 * cycle. `tests/coralGarden.test.ts` reads the real thing off a built `Reef`
 * and fails if these two ever drift apart, which is the half of the contract a
 * comment cannot keep.
 */
const CREVICES: readonly { x: number; z: number; facing: number }[] = [
  { x: 0, z: 1.5, facing: 0 },
  { x: -13, z: 6, facing: Math.PI / 2 },
  { x: 13, z: 6, facing: -Math.PI / 2 },
  { x: -6, z: -9, facing: 0 },
];

/** How far behind a crevice mouth its mound sits; `Reef.addHidingSpot`. */
const MOUND_SETBACK = 3.9;

/** How much open water a crevice and its mound each keep around them. */
export const CREVICE_CLEARANCE = 6;

/** Discs nothing may grow in, beyond the crevices themselves. */
const CLEARANCES: readonly { x: number; z: number; radius: number }[] = [
  /**
   * W-L5's anemone garden. Reserved a wave early on purpose — this package
   * fills shot G's foreground and that one lands in the middle of it, and the
   * cheaper of the two conversations is the one that happens before both are
   * built.
   */
  { x: 7.5, z: 8.5, radius: 2.6 },
];

/**
 * The channels the game asks the player to look down, as (minX, maxX, minZ,
 * maxZ) boxes.
 *
 * The same three `Reef` keeps its stone out of: the spawn line straight down
 * x ≈ 0 to the snowflake, the z ≈ 6 band east and west to the ribbon and the
 * zebra, and the run south down x ≈ -6 to the dragon. `probe-moray.mjs` walks
 * all three, and a fan standing in one of them is a fan across the animal the
 * shot exists to show.
 */
const CORRIDORS: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[] = [
  { minX: -3.2, maxX: 3.2, minZ: -1, maxZ: 21 },
  { minX: -21, maxX: 21, minZ: 4.2, maxZ: 7.8 },
  { minX: -8.4, maxX: -3.6, minZ: -12, maxZ: 2 },
];

/**
 * Whether a coral may stand at (x, z).
 *
 * Rejection rather than repulsion, and the difference shows: a cluster pushed
 * away from a crevice arrives somewhere else at full density, where one that is
 * simply *thinner* on the side facing the crevice reads as a garden that grew
 * around the hole. Which is what a reef does.
 */
export function isClear(x: number, z: number): boolean {
  for (const crevice of CREVICES) {
    if (Math.hypot(x - crevice.x, z - crevice.z) < CREVICE_CLEARANCE) {
      return false;
    }
    const mound = moundOf(crevice);
    if (Math.hypot(x - mound.x, z - mound.z) < CREVICE_CLEARANCE) {
      return false;
    }
  }
  for (const disc of CLEARANCES) {
    if (Math.hypot(x - disc.x, z - disc.z) < disc.radius) {
      return false;
    }
  }
  for (const box of CORRIDORS) {
    if (x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ) {
      return false;
    }
  }
  return true;
}

function moundOf(crevice: { x: number; z: number; facing: number }): { x: number; z: number } {
  return {
    x: crevice.x - Math.sin(crevice.facing) * MOUND_SETBACK,
    z: crevice.z - Math.cos(crevice.facing) * MOUND_SETBACK,
  };
}

/**
 * Where each cluster's fish would feed, at the height of its coral heads.
 *
 * Exported as a function as well as hung on the instance, because the reef's
 * `CoralField` is built inside `Reef` and thrown away — nothing outside holds a
 * reference to it. The Wave-3 school needs these and cannot reach that object
 * without a line in `Reef` and a line in `Game`, so it gets them from the
 * authored sites instead, which is where they come from anyway.
 */
export function coralFeedingSites(sites: readonly ClusterSite[] = SITES): Vector3[] {
  return sites.map((site) => new Vector3(site.x, seabedHeight(site.x, site.z) + 1.2, site.z));
}

/**
 * Dusty, absorbed reef tones rather than swatch colours.
 *
 * Ten metres of water has already eaten most of the red out of the light
 * before it reaches these heads, so a fully saturated pink or purple down here
 * is not a bold choice, it is a physical impossibility — and it is the loudest
 * plastic-toy tell in the frame. These are hue families taken down in chroma to
 * where the water leaves them.
 *
 * `mixed` is the palette the whole garden used to draw from, kept exactly as it
 * was: it is what an unadorned `ClusterSite` gets, which is what the sanctuary
 * passes, so the room's garden keeps the colours it was composed with.
 */
const FAMILIES: Record<CoralFamily, readonly number[]> = {
  rose: [0xc9707e, 0xd2867c, 0xb8637a, 0xc7755a],
  ochre: [0xcca572, 0xd3b47e, 0xc08a55, 0xb9925f],
  violet: [0x8b7ab0, 0x7a6ba4, 0xa284b8, 0x6f8fae],
  mixed: [0xc7755a, 0xb06379, 0xcca572, 0x69a99c, 0x8372a9, 0xac755e],
};

/**
 * The family a cluster reaches into for its minority accents.
 *
 * A fifth of each cluster, and the number matters in both directions: below
 * about a tenth the accent is a mistake rather than a decision, and above a
 * third the two families average and the mass loses its identity. `mixed`
 * accents from itself, so a room passing plain sites sees no change at all.
 */
const ACCENTS: Record<CoralFamily, CoralFamily> = {
  rose: "violet",
  ochre: "rose",
  violet: "ochre",
  mixed: "mixed",
};
const ACCENT_SHARE = 0.2;

/**
 * How far each head's colour is scaled from the palette entry it drew.
 *
 * The reef's range is wide on purpose: a garden all at one value reads as one
 * moulded object, and the spread is most of what makes a reef out of six
 * colours. A room can ask for a different one, and the sanctuary does — the
 * bottom of the reef's range is a rust taken well down, which on a *branching*
 * head is one dark colony among lighter ones and on a wide plate lying a metre
 * off pale sand is a plank.
 *
 * It is a scale in the linear working space, like every `multiplyScalar` on a
 * `Color` — 0.68 of linear light is about 0.84 of the encoded value, which is
 * why the reef's bottom end is a deep colour rather than a black one.
 *
 * The floor came up from 0.6, and the pieces this package adds are the reason.
 * A finger's worth of coral at the dark end is one shaded colony among lighter
 * ones; a metre-wide brain dome or a metre-and-a-half fan at the same value is
 * a maroon slab, because the *area* it covers is ten times as much. Value that
 * reads as depth on a small shape reads as dirt on a big one.
 */
export interface ToneRange {
  readonly min: number;
  readonly max: number;
}
const REEF_TONE: ToneRange = { min: 0.68, max: 1.18 };

/**
 * Landmarks keep out of the bottom third of whatever range they are given.
 *
 * The dark end exists so that a small head can be one dark colony among lighter
 * ones. A metre and a half of staghorn at the same value is a dead tree, and a
 * brain coral there is a boulder — these are the pieces the garden is supposed
 * to be *led by*, and the eye does not follow the darkest thing in a bright
 * frame.
 */
function landmarkTone(tone: ToneRange): ToneRange {
  return { min: tone.min + (tone.max - tone.min) * 0.45, max: tone.max };
}

/** Which kinds are allowed to be bioluminescent; see the note in `build`. */
const CAN_GLOW: ReadonlySet<CoralKind> = new Set<CoralKind>(["polyp", "branch", "tube"]);

/**
 * Which kinds cast a shadow — the big ones, and nothing else.
 *
 * The shadow pass submits every triangle a second time, and measured through
 * `probe-coral.mjs` it was twenty milliseconds of the garden's cost at the
 * resolution the round's budget is quoted in. What it buys, on a piece under
 * about half a metre, is nothing: the seabed already bakes a contact shadow
 * under every head from `contacts`, and that patch is *wider* than the shadow a
 * eleven-centimetre polyp would throw. Paying twice for one mark.
 *
 * It is the argument the rubble made in `Reef.buildRubble` and the grass made
 * before it, applied to the four small kinds. A landmark, a plate stack and a
 * sponge cluster keep theirs: those are big enough that the shadow is a real
 * mark on the sand and not a smudge under the thing casting it.
 *
 * The fan is excluded for a second reason on top of the first. Its silhouette
 * lives in an alpha channel, so a cast shadow means running the cut-out in the
 * depth pass too — the most expensive shadow in the garden, for a lace pattern
 * projected onto sand that no camera in this game is ever positioned to read.
 */
const CASTS_SHADOW: ReadonlySet<CoralKind> = new Set<CoralKind>([
  "staghorn",
  "brain",
  "plateStack",
  "tube",
]);

interface Part {
  readonly kind: CoralKind;
  readonly matrix: Matrix4;
  readonly color: Color;
  readonly glowing: boolean;
}

export class CoralField {
  readonly group = new Group();
  /** Where each piece meets the sand, for the seabed's baked contact shadows. */
  readonly contacts: { x: number; z: number; radius: number; strength: number }[] = [];
  /** One per cluster, at coral-head height; see {@link coralFeedingSites}. */
  readonly feedingSites: Vector3[];
  /** Instanced meshes, in build order. One draw call each. */
  readonly meshes: InstancedMesh[] = [];

  private readonly materials: MeshToonMaterial[] = [];
  private readonly sway = { value: 0 };
  private readonly windStrength = { value: 1 };
  /** Set once an owner starts calling {@link update}; see the note there. */
  private driven = false;
  private lastRenderAt = 0;

  /**
   * `sites` and `tone` default to the reef's authored gardens and value range.
   * The sanctuary grows its own from the same generators, and passing those in
   * is the whole of the difference — the reef's composition is the default
   * precisely so that a second room cannot disturb it.
   */
  constructor(seed: number, sites: readonly ClusterSite[] = SITES, tone: ToneRange = REEF_TONE) {
    this.feedingSites = coralFeedingSites(sites);
    this.build(seed, sites, tone);
  }

  private build(seed: number, sites: readonly ClusterSite[], tone: ToneRange): void {
    const random = new Random(seed);
    /**
     * The pieces that were not in the old garden draw from their own stream.
     *
     * `random` places every fill head in order, so a draw taken for a landmark
     * would shift each following head and re-roll the whole bommie. Keeping the
     * new work on a second stream means a change to how a plate stack leans
     * cannot move a single small head — which is the only reason two
     * screenshots a package apart can be compared at all.
     */
    const featureRandom = new Random(seed ^ 0x7ab1_e001);
    const parts: Part[] = [];

    for (const site of sites) {
      const spread = site.radius ?? CLUSTER_DEFAULTS.radius;
      const family = site.family ?? CLUSTER_DEFAULTS.family;
      const palette = { body: FAMILIES[family], accent: FAMILIES[ACCENTS[family]] };

      // Landmarks first, so that a cluster's biggest pieces are placed in open
      // sand rather than into whatever the fill happened to leave.
      const landmarks = site.landmarks ?? CLUSTER_DEFAULTS.landmarks;
      const crown = site.crown ?? CLUSTER_DEFAULTS.crown;
      for (let i = 0; i < landmarks; i++) {
        this.addLandmark(parts, featureRandom, site, spread * 0.62, palette, landmarkTone(tone), i, crown);
      }

      const mid = site.mid ?? CLUSTER_DEFAULTS.mid;
      for (let i = 0; i < mid; i++) {
        this.addMid(parts, featureRandom, site, spread * 0.85, palette, tone, i);
      }

      for (let i = 0; i < site.heads; i++) {
        this.addHead(parts, random, site, spread, palette, tone);
      }

      const fans = site.fans ?? CLUSTER_DEFAULTS.fans;
      for (let i = 0; i < fans; i++) {
        this.addFan(parts, featureRandom, site.x, site.z, spread * 1.05, palette, tone);
      }
    }

    this.addDrifts(parts, featureRandom, sites, tone);
    this.assemble(parts);
  }

  /** A modelled piece: the thing a cluster is recognised by from across the reef. */
  private addLandmark(
    parts: Part[],
    random: Random,
    site: ClusterSite,
    spread: number,
    palette: Palette,
    tone: ToneRange,
    index: number,
    crown: number,
  ): void {
    /**
     * The first landmark stands on the site itself, and the rest scatter.
     *
     * The cluster's coordinates are the authored ones — chosen against shot A's
     * middle distance, shot B's crossing, the crevice frame in C — so the piece
     * the composition is *for* belongs exactly there rather than up to two
     * metres away in whatever direction the stream happened to pick. Scattered,
     * the tallest thicket in the reef landed behind its own cluster twice and
     * behind a sea stack once, which reads as a garden with no landmark at all
     * and is impossible to tell from one whose landmarks are too small.
     *
     * The draw is taken either way, so pinning the first one does not re-roll
     * the ones after it.
     */
    const scattered = this.place(random, site.x, site.z, spread);
    const spot = index === 0 && isClear(site.x, site.z) ? { x: site.x, z: site.z } : scattered;
    if (!spot) {
      return;
    }

    // Alternating rather than rolled: a cluster with two landmarks should show
    // both silhouettes, and a coin flip gives a third of them two of the same.
    const kind: CoralKind = index % 2 === 0 ? "staghorn" : "brain";
    // Largest first, then two thirds, then half — a stand of one age is a
    // plantation.
    const scale = crown * [1, 0.72, 0.52][Math.min(index, 2)]!;

    const local = new Object3D();
    local.position.set(spot.x, seabedHeight(spot.x, spot.z) - 0.05, spot.z);
    local.rotation.set(random.signed(0.05), random.range(0, Math.PI * 2), random.signed(0.05));
    if (kind === "staghorn") {
      local.scale.set(scale * random.range(0.9, 1.15), scale, scale * random.range(0.9, 1.15));
    } else {
      // A brain is authored 1.87 wide per unit of height, so its scale is read
      // off the width the garden wants rather than off the height.
      const height = scale * random.range(0.42, 0.58);
      local.scale.set(height * random.range(0.95, 1.1), height, height);
    }

    push(parts, kind, local, drawColor(random, palette, tone), false);
    this.contacts.push({ x: spot.x, z: spot.z, radius: scale * 1.5, strength: 0.5 });
  }

  /** A plate stack or a sponge cluster, at half a landmark's size. */
  private addMid(
    parts: Part[],
    random: Random,
    site: ClusterSite,
    spread: number,
    palette: Palette,
    tone: ToneRange,
    index: number,
  ): void {
    const spot = this.place(random, site.x, site.z, spread);
    if (!spot) {
      return;
    }
    const ground = seabedHeight(spot.x, spot.z);
    const color = drawColor(random, palette, tone);
    const local = new Object3D();

    if (index % 2 === 0) {
      const scale = random.range(0.5, 0.66);
      local.position.set(spot.x, ground - 0.03, spot.z);
      local.rotation.set(0, random.range(0, Math.PI * 2), 0);
      local.scale.set(scale * random.range(0.9, 1.12), scale, scale * random.range(0.9, 1.12));
      push(parts, "plateStack", local, color, false);
      this.contacts.push({ x: spot.x, z: spot.z, radius: scale * 2.4, strength: 0.44 });
      return;
    }

    // A sponge is never alone: three to five barrels of different heights out
    // of one holdfast is the whole silhouette, and one on its own is a pipe.
    const barrels = Math.round(random.range(3, 5));
    const glowing = random.next() < 0.22;
    for (let i = 0; i < barrels; i++) {
      const around = (i / barrels) * Math.PI * 2 + random.signed(0.5);
      const out = random.range(0.05, 0.26);
      const height = random.range(0.32, 0.78);
      const x = spot.x + Math.cos(around) * out;
      const z = spot.z + Math.sin(around) * out;
      local.position.set(x, seabedHeight(x, z) - 0.04, z);
      local.rotation.set(random.signed(0.12), random.range(0, Math.PI * 2), random.signed(0.12));
      local.scale.set(height * random.range(0.85, 1.15), height, height * random.range(0.85, 1.15));
      push(parts, "tube", local, color, glowing);
    }
    this.contacts.push({ x: spot.x, z: spot.z, radius: 0.9, strength: 0.4 });
  }

  /** One of the old garden's small heads: a branching spray or a crusted dome. */
  private addHead(
    parts: Part[],
    random: Random,
    site: ClusterSite,
    spread: number,
    palette: Palette,
    tone: ToneRange,
  ): void {
    const spot = this.place(random, site.x, site.z, spread);
    if (!spot) {
      return;
    }

    const color = drawColor(random, palette, tone);
    // A minority of heads are bioluminescent. Kept rare on purpose:
    // everything glowing reads as neon, a few glowing reads as magic.
    const glowing = random.next() < 0.26;

    const head = new Object3D();
    head.position.set(spot.x, seabedHeight(spot.x, spot.z), spot.z);
    head.rotation.y = random.range(0, Math.PI * 2);
    const headScale = random.range(0.6, 1.1);
    head.scale.setScalar(headScale);
    head.updateMatrix();
    this.contacts.push({ x: spot.x, z: spot.z, radius: headScale * 1.9, strength: 0.42 });

    if (random.next() < 0.5) {
      addBranching(parts, head.matrix, color, glowing, random);
    } else {
      addBoulder(parts, head.matrix, color, glowing, random);
    }
  }

  /** A sea fan, standing across the current. */
  private addFan(
    parts: Part[],
    random: Random,
    cx: number,
    cz: number,
    spread: number,
    palette: Palette,
    tone: ToneRange,
  ): void {
    const spot = this.place(random, cx, cz, spread);
    if (!spot) {
      return;
    }
    // Up to 1.6 m, where they used to top out at 1.3. A fan is the cheapest
    // vertical mass in the garden — forty triangles, one cut-out sheet — and
    // it is also the silhouette that reads soonest at range, so it is the
    // right thing to spend the scale on.
    const height = random.range(0.62, 1.6);
    const local = new Object3D();
    local.position.set(spot.x, seabedHeight(spot.x, spot.z) - 0.04, spot.z);
    // Fans in one cluster face broadly the same way, because they are all
    // reading the same current — but not exactly, or they are a fence.
    local.rotation.set(random.signed(0.09), random.range(0, Math.PI * 2), random.signed(0.13));
    local.scale.set(height * random.range(0.8, 1.2), height, height);
    push(parts, "fan", local, drawColor(random, palette, tone), false);
    this.contacts.push({ x: spot.x, z: spot.z, radius: height * 0.5, strength: 0.3 });
  }

  /** Small coral trailing between two clusters; see {@link DRIFTS}. */
  private addDrifts(
    parts: Part[],
    random: Random,
    sites: readonly ClusterSite[],
    tone: ToneRange,
  ): void {
    for (const [fromIndex, toIndex, count] of DRIFTS) {
      const from = sites[fromIndex];
      const to = sites[toIndex];
      if (!from || !to) {
        continue;
      }
      const family = from.family ?? CLUSTER_DEFAULTS.family;
      const palette = { body: FAMILIES[family], accent: FAMILIES[ACCENTS[family]] };

      for (let i = 0; i < count; i++) {
        // Thickest at the ends and thinnest in the middle, which is what a
        // trail of spat settling out from two colonies actually looks like.
        const t = (i + 0.5) / count;
        const lateral = Math.sin(t * Math.PI) * 3.4;
        const x = from.x + (to.x - from.x) * t + random.signed(lateral);
        const z = from.z + (to.z - from.z) * t + random.signed(lateral);
        if (!isClear(x, z)) {
          continue;
        }

        const color = drawColor(random, palette, tone);
        const local = new Object3D();
        const roll = random.next();
        if (roll < 0.34) {
          const height = random.range(0.4, 0.75);
          local.position.set(x, seabedHeight(x, z) - 0.03, z);
          local.rotation.set(random.signed(0.1), random.range(0, Math.PI * 2), random.signed(0.1));
          local.scale.set(height, height, height);
          push(parts, "fan", local, color, false);
        } else if (roll < 0.62) {
          const height = random.range(0.24, 0.46);
          local.position.set(x, seabedHeight(x, z) - 0.03, z);
          local.rotation.set(random.signed(0.14), random.range(0, Math.PI * 2), random.signed(0.14));
          local.scale.setScalar(height);
          push(parts, "tube", local, color, random.next() < 0.2);
        } else {
          const head = new Object3D();
          head.position.set(x, seabedHeight(x, z), z);
          head.rotation.y = random.range(0, Math.PI * 2);
          head.scale.setScalar(random.range(0.4, 0.72));
          head.updateMatrix();
          addBoulder(parts, head.matrix, color, random.next() < 0.2, random);
        }
        this.contacts.push({ x, z, radius: 0.8, strength: 0.34 });
      }
    }
  }

  /**
   * Finds somewhere in a cluster a piece is allowed to stand.
   *
   * Six tries, each consuming the same two numbers whether it lands or not, so
   * the stream is the same length however the clearances are drawn — a piece
   * that cannot be placed is simply not placed, and the cluster comes out
   * thinner on the side facing whatever pushed it back.
   */
  private place(random: Random, cx: number, cz: number, spread: number): { x: number; z: number } | null {
    for (let attempt = 0; attempt < 6; attempt++) {
      // Square-rooted, so the draw is uniform over the disc and the cluster has
      // a dense heart rather than a dense rim.
      const distance = spread * Math.sqrt(random.next());
      const angle = random.range(0, Math.PI * 2);
      const x = cx + Math.cos(angle) * distance;
      const z = cz + Math.sin(angle) * distance;
      if (isClear(x, z)) {
        return { x, z };
      }
    }
    return null;
  }

  /**
   * Flattens every piece into one instanced mesh per silhouette.
   *
   * Built as individual meshes this garden would be some six hundred draw
   * calls, twice over once the shadow pass ran. Instanced it is eleven, and
   * that number is the budget: the glowing variants double a bucket, so only
   * the three small kinds are allowed to glow. A landmark that glowed would
   * cost a whole draw call to light up one piece, and a metre and a half of
   * bioluminescence is a lamp rather than a hint of magic.
   */
  private assemble(parts: readonly Part[]): void {
    const kinds: CoralKind[] = [
      "staghorn",
      "brain",
      "plateStack",
      "tube",
      "branch",
      "boulder",
      "polyp",
      // Last, and on its own: it is the only alpha-tested surface here, and a
      // cut-out drawn before the opaque geometry behind it pays for every
      // fragment it later throws away.
      "fan",
    ];

    for (const kind of kinds) {
      for (const glowing of [false, true]) {
        if (glowing && !CAN_GLOW.has(kind)) {
          continue;
        }
        const matching = parts.filter((part) => part.kind === kind && part.glowing === glowing);
        if (matching.length === 0) {
          continue;
        }
        this.group.add(this.buildInstances(kind, matching, glowing));
      }
    }

    // The modelled pieces, if they are on disk. Until then — and forever, in
    // the build with no `public/assets` — every one of these is standing as its
    // `CoralShapes` stand-in, at the same size and in the same place.
    for (const [kind, path] of Object.entries(CORAL_MODELS) as [CoralKind, string][]) {
      const targets = this.meshes.filter((mesh) => mesh.name === kind);
      if (targets.length === 0) {
        continue;
      }
      requestModel(path, (geometry) => {
        for (const mesh of targets) {
          // The stand-in is `CoralShapes`' to own and is shared with the
          // sanctuary's garden, so it is dropped here rather than disposed.
          mesh.geometry = geometry;
        }
      });
    }
  }

  private buildInstances(kind: CoralKind, parts: readonly Part[], glowing: boolean): InstancedMesh {
    const geometry = coralGeometry(kind);
    const material = kind === "fan" ? this.fanMaterial() : this.skinnedMaterial(kind, geometry);

    if (glowing) {
      // Emissive is a material uniform, so on its own every glowing head would
      // share one colour. Multiplying it by the per-instance colour lets each
      // head glow in its own hue while still sharing a single draw call.
      material.emissive = new Color(0xffffff);
      material.emissiveIntensity = 0.4;
      material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          // `.rgb` because the sculpted heads' GLB carries RGBA vertex
          // colours, which makes `vColor` a vec4 (USE_COLOR_ALPHA) and a
          // bare vec4 *= vec3 fails to compile — an invalid program that
          // corrupted whole frames wherever these heads were drawn. The
          // swizzle is valid on both vec3 and vec4, so the fallback build
          // (procedural RGB colours) compiles the same line unchanged.
          `#include <emissivemap_fragment>
           totalEmissiveRadiance *= vColor.rgb;`,
        );
      };
    }
    const sways = kind === "staghorn" || kind === "fan";
    if (sways) {
      this.addSway(material, kind);
    }

    const mesh = new InstancedMesh(geometry, material, parts.length);
    mesh.name = kind;
    if (sways) {
      mesh.onBeforeRender = this.wind;
    }
    mesh.castShadow = CASTS_SHADOW.has(kind);
    mesh.receiveShadow = true;

    parts.forEach((part, index) => {
      mesh.setMatrixAt(index, part.matrix);
      mesh.setColorAt(index, part.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    this.meshes.push(mesh);
    this.materials.push(material);
    return mesh;
  }

  private skinnedMaterial(kind: CoralKind, geometry: BufferGeometry): MeshToonMaterial {
    const skin = coralSkin(kind);
    const material = createToonMaterial({
      // No facets, on any of these shapes. The garden is the closest thing in
      // the reef to a bed of flowers and it was reading as cut glass. What
      // carries the surface instead is the map, which is corallite structure —
      // the detail a colony actually has, at the scale it has it — kept light
      // and hue-neutral so the per-instance colour below still carries the
      // variation across the garden.
      map: skin.map,
      normalMap: skin.normal,
      // Vertex colour, instance colour and the map all multiply together in the
      // shader, so a piece that carries its own occlusion — every landmark, and
      // the plate stack's undersides — keeps its per-head tint on top of it.
      vertexColors: geometry.hasAttribute("color"),
    });

    // The painted washes (W-O3), same delivery contract as the fan's sheet:
    // procedural until the file lands, procedural forever if it does not, and
    // only the colour map moves — the procedural normal stays, because the
    // painting has no channel for form. `tile: true` because the brain's GLB
    // UVs run eight tiles around the dome and four up it.
    const wash = CORAL_WASHES[kind];
    if (wash) {
      requestAlbedo(
        wash,
        (texture) => {
          const painted = unpackCoralWash(kind, texture);
          if (painted) {
            material.map = painted;
            material.needsUpdate = true;
          }
        },
        { tile: true },
      );
    }
    return material;
  }

  /**
   * The sea fan's material: one cut-out sheet, lit like everything else.
   *
   * `alphaTest` rather than `transparent`, which is the whole of the fan's
   * frame cost. A transparent fan would leave the opaque queue, be sorted
   * against every other fan in the garden on every camera move, write no depth
   * — so each one would draw over the ones behind it in full — and still be
   * wrong where two of them cross. Cut out, the piece stays opaque: it writes
   * depth, it occludes, and the only thing it costs over a solid quad is the
   * fragments it discards.
   *
   * `DoubleSide` because a fan is a sheet a millimetre thick, and half a garden
   * of them faces away from any given camera.
   */
  private fanMaterial(): MeshToonMaterial {
    const material = createToonMaterial({ map: fanTexture(), side: DoubleSide });
    material.alphaTest = FAN_ALPHA_TEST;
    requestAlbedo(FAN_ASSET, (texture) => {
      const painted = unpackFan(texture);
      if (painted) {
        material.map = painted;
        material.needsUpdate = true;
      }
    });
    return material;
  }

  /**
   * The sway, injected the way the grass injects its own.
   *
   * Root-hinged and quadratic in height, so the holdfast does not move and the
   * rim does — and at well under the meadow's amplitude, because these are
   * skeletons. A fan's tip travels about six centimetres against a blade of
   * grass's sixteen, which is below even the meadow's Calm Mode figure; that is
   * the reason there is no separate reduced-motion amplitude here beyond what
   * {@link update} already applies.
   */
  private addSway(material: MeshToonMaterial, kind: CoralKind): void {
    const amount = kind === "fan" ? 0.065 : 0.026;
    const height = kind === "fan" ? FAN_HEIGHT : 1;
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uSway = this.sway;
      shader.uniforms.uWind = this.windStrength;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uSway;
           uniform float uWind;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           // Each colony leans on its own phase, taken from where it stands.
           float phase = instanceMatrix[3][0] * 0.6 + instanceMatrix[3][2] * 0.43;
           float tip = clamp(transformed.y / ${height.toFixed(2)}, 0.0, 1.0);
           float bend = sin(uSway * 1.3 + phase) * 0.5 + sin(uSway * 0.47 + phase * 1.7) * 0.5;
           transformed.x += bend * ${amount.toFixed(3)} * uWind * tip * tip;
           transformed.z += bend * ${(amount * 0.55).toFixed(3)} * uWind * tip * tip;`,
        );
    };
  }

  /**
   * Advances the sway.
   *
   * The reef's `CoralField` is built inside `Reef` and not kept, so nothing
   * calls this today and the meshes wind their own clock forward from
   * `onBeforeRender` instead. That is a worse clock in one specific way — it
   * keeps running while `capture()` holds a frame, where everything driven off
   * the fixed step stops — and it is the price of the garden not owning a line
   * in a file this package may not touch. It is bounded: the amplitude is a few
   * centimetres and the fans are the only thing it moves.
   *
   * The moment an owner does call this the self-winding stops, which is what
   * makes wiring it up later a one-line change with no dead code left behind.
   */
  update(dt: number, reducedMotion: boolean): void {
    this.driven = true;
    this.sway.value += dt * (reducedMotion ? 0.35 : 1);
    this.windStrength.value = reducedMotion ? 0.45 : 1;
  }

  /** See {@link update}: the fallback clock, hung on the swaying meshes. */
  private readonly wind = (): void => {
    if (this.driven) {
      return;
    }
    const now = performance.now() / 1000;
    // First frame, or a tab that was in the background: start from here rather
    // than jumping the whole gap.
    const step = this.lastRenderAt > 0 ? Math.min(0.1, now - this.lastRenderAt) : 0;
    this.lastRenderAt = now;
    this.sway.value += step;
  };

  /**
   * Releases what this field owns: its materials.
   *
   * Not its geometries and not its skins — those are `CoralShapes`', cached per
   * silhouette and shared with whatever other room grew a garden from them, and
   * the same rule the `AssetLibrary` textures live under. Disposing one here
   * would empty the other field's meshes.
   */
  dispose(): void {
    for (const material of this.materials) {
      material.dispose();
    }
    this.materials.length = 0;
    for (const mesh of this.meshes) {
      mesh.dispose();
      mesh.removeFromParent();
    }
    this.meshes.length = 0;
  }
}

interface Palette {
  readonly body: readonly number[];
  readonly accent: readonly number[];
}

/**
 * One colour out of a cluster's family, or occasionally its neighbour's.
 *
 * Always the same three draws whichever branch is taken, so that changing the
 * accent share cannot re-roll every piece placed after it.
 */
function drawColor(random: Random, palette: Palette, tone: ToneRange): Color {
  const accent = random.next() < ACCENT_SHARE;
  const list = accent ? palette.accent : palette.body;
  const hex = list[Math.floor(random.next() * list.length)] ?? list[0]!;
  return new Color(hex).multiplyScalar(random.range(tone.min, tone.max));
}

/** Composes a part's local transform, already in world space, into a `Part`. */
function push(parts: Part[], kind: CoralKind, local: Object3D, color: Color, glowing: boolean): void {
  local.updateMatrix();
  parts.push({ kind, matrix: local.matrix.clone(), color, glowing });
}

/** Composes a part's local transform into its head's world matrix. */
function pushInHead(
  parts: Part[],
  kind: CoralKind,
  headMatrix: Matrix4,
  local: Object3D,
  color: Color,
  glowing: boolean,
): void {
  local.updateMatrix();
  parts.push({
    kind,
    matrix: new Matrix4().multiplyMatrices(headMatrix, local.matrix),
    color,
    glowing,
  });
}

/** A spray of tapered fingers, the classic staghorn silhouette in miniature. */
function addBranching(
  parts: Part[],
  headMatrix: Matrix4,
  color: Color,
  glowing: boolean,
  random: Random,
): void {
  const local = new Object3D();
  const fingers = Math.round(random.range(4, 8));
  for (let i = 0; i < fingers; i++) {
    const lean = random.range(0.1, 0.42);
    const around = (i / fingers) * Math.PI * 2 + random.signed(0.4);
    const height = random.range(0.6, 1.15);
    local.scale.set(random.range(0.7, 1.1), height, random.range(0.7, 1.1));
    local.position.set(Math.cos(around) * 0.28, height * 0.72, Math.sin(around) * 0.28);
    local.rotation.set(Math.sin(around) * lean, 0, -Math.cos(around) * lean);
    pushInHead(parts, "branch", headMatrix, local, color, glowing);
  }
}

/** A squat dome, crusted with polyps. */
function addBoulder(
  parts: Part[],
  headMatrix: Matrix4,
  color: Color,
  glowing: boolean,
  random: Random,
): void {
  const local = new Object3D();
  local.scale.set(random.range(0.9, 1.4), random.range(0.55, 0.85), random.range(0.9, 1.4));
  local.position.set(0, 0.28, 0);
  local.rotation.set(0, 0, 0);
  pushInHead(parts, "boulder", headMatrix, local, color, glowing);

  /**
   * Two to four, where it used to be four to nine.
   *
   * Measured per bucket with `probe-coral.mjs`, the polyps were 53 ms of the
   * garden's 69 — more than everything else in it together, and out of all
   * proportion to their twelve thousand triangles. What they cost is *count*:
   * three hundred and twenty of them, each an eleven-centimetre sphere that
   * covers a pixel or two at the distance the canonical cameras stand, each
   * submitted again for the shadow pass.
   *
   * They were worth it when the garden was three shapes and a boulder needed
   * crusting to read as coral at all. With a brain dome and a plate stack and a
   * sponge cluster beside it, a boulder is one head among five species and its
   * texture is doing the crusting anyway.
   */
  const polyps = Math.round(random.range(2, 4));
  for (let i = 0; i < polyps; i++) {
    const around = random.range(0, Math.PI * 2);
    const radius = random.range(0.1, 0.5);
    local.scale.setScalar(1);
    local.position.set(
      Math.cos(around) * radius,
      random.range(0.45, 0.68),
      Math.sin(around) * radius,
    );
    pushInHead(parts, "polyp", headMatrix, local, color, glowing);
  }
}