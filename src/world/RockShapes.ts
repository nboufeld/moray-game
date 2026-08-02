import {
  LatheGeometry,
  QuadraticBezierCurve3,
  SplineCurve,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../rendering/ProceduralTexture";
import { weatherRock } from "./RockMaterial";

/**
 * The reef's stones, as designed profiles rather than as one displaced solid.
 *
 * Every free rock in the reef used to be an icosahedron knocked about by radial
 * noise, and the trouble with that is not that it looks bad — WP-G3 spent a
 * package making it look like a soft hand-made lump, and it does. The trouble
 * is that it can only ever be *one* lump. Noise has no intent: turn its
 * amplitude up and a boulder becomes a lumpier boulder, never a shelf and never
 * a stack. A reef drawn by a person has three or four stones in it that are
 * recognisably different kinds of thing, and the difference lives in the
 * silhouette, which is the one part of a shape noise cannot author.
 *
 * So the outline is drawn and the noise is demoted to what it is good at. Each
 * archetype is a short authored curve — seven or eight numbers — splined,
 * revolved with {@link LatheGeometry}, and only then roughed by the same radial
 * fbm the rocks have always worn. The silhouette is the drawing; the noise is
 * the tooth on it.
 *
 * Three rules hold this to the rest of the reef:
 *
 * - **The finish comes from `weatherRock`, not from here.** Box-projected UVs at
 *   0.22 of a unit per metre, welded smooth normals, and the algae tint on the
 *   up-facing sides are the contract every stone in this world meets, and there
 *   is exactly one implementation of it. Calling it with `amount: 0` runs that
 *   finish over a shape this module has already displaced — the displacement is
 *   the only half a lathe needs done differently (see {@link roughLathe}), and
 *   duplicating the other half here is how two rocks end up wearing two
 *   different washes.
 * - **The foot stays planted.** Every profile starts below the sand at
 *   {@link SINK} and the vertical wobble is tapered to nothing at both ends, so
 *   no amount of roughing can lift a stone off the seabed or tear its poles
 *   apart.
 * - **Nothing here goes near a crevice.** The four hiding spots' mounds and
 *   flanks are frozen geometry placed against a raycast; they are built in
 *   `Reef.addHidingSpot` from the shapes they have always had and this module is
 *   not called for any of them.
 */

/** How far a profile's foot is buried, so its base disc is never seen. */
const SINK = 0.35;

/**
 * Lattice scale of the roughing, in lumps around the body.
 *
 * The same period and octave count `weatherRock` rounds a boulder with, and for
 * the same reason: one scale of lump and a suggestion of a second on it is what
 * a picture-book stone has, where four scales of noise is weathering read off a
 * photograph.
 */
const ROUGH_PERIOD = 3;
const ROUGH_OCTAVES = 2;

/** A point on an authored outline: height and radius, both as fractions. */
type ProfilePoint = readonly [t: number, r: number];

/**
 * The friendly potato. Widest a third of the way up, shoulders falling away to
 * a rounded crown, and a foot narrower than its belly so it reads as a stone
 * that settled rather than one that was poured.
 */
const BOULDER: readonly ProfilePoint[] = [
  [0, 0.62],
  [0.16, 0.88],
  [0.36, 1.0],
  [0.6, 0.94],
  [0.8, 0.72],
  [0.92, 0.42],
  [1, 0],
];

/**
 * The split crag (critic punch #9): the potato's first sibling. A full
 * shoulder that cleaves in at two thirds height and throws up a second,
 * narrower head — the one thing the convex potato can never be is
 * *concave*, and the collar is what a silhouette reads at fifty metres.
 * Same envelope: nothing exceeds the declared radius, foot at SINK,
 * crown closed.
 */
const SPLIT_CRAG: readonly ProfilePoint[] = [
  [0, 0.58],
  [0.13, 0.9],
  [0.3, 1.0],
  [0.5, 0.86],
  [0.64, 0.6],
  [0.75, 0.68],
  [0.87, 0.52],
  [0.95, 0.28],
  [1, 0],
];

/** The crag's head drifts a little off-axis (r2: a symmetric collar read
 *  as two stacked buns — the lean is what makes it ONE cleaved stone). */
const CRAG_LEAN = 0.16;

/**
 * The keeled stone: the potato's second sibling. Widest low, a straighter
 * fall to a narrow crest, and the whole spine *leaned* off the lathe axis
 * (see {@link leanRings}) — the asymmetry a body of revolution cannot
 * otherwise have. Callers already yaw every stone from their own streams,
 * so the lean direction distributes for free.
 */
const KEELED: readonly ProfilePoint[] = [
  [0, 0.7],
  [0.1, 0.94],
  [0.24, 1.0],
  [0.46, 0.8],
  [0.68, 0.56],
  [0.88, 0.34],
  [1, 0],
];

/** How far the keeled profiles' crowns shift off-axis, per unit radius. */
const KEEL_LEAN = 0.32;

/**
 * A low wide shelf: full width from the sand to well past half height, then a
 * quick fall to a broad flat crown.
 *
 * The overhang at 0.5 is the whole personality — a shelf that tapers from the
 * ground up is a hill, and a shelf whose widest point is above its foot is
 * something a reef has grown out over. Paired with a height around 0.45 of the
 * radius it crops the bottom of a frame the way nothing else in the reef does.
 */
const SLAB: readonly ProfilePoint[] = [
  [0, 0.88],
  [0.24, 1.0],
  [0.5, 1.02],
  [0.72, 0.95],
  [0.87, 0.8],
  [0.96, 0.5],
  [1, 0],
];

/**
 * The shelf-stack (critic punch #9): the slab's first sibling. Two benched
 * ledges — full width, a bitten waist, a narrower second bench — the
 * stepped strata read the single-overhang slab cannot give. Stays inside
 * the slab's own 1.02 overhang ceiling.
 */
const SHELF_STACK: readonly ProfilePoint[] = [
  [0, 0.92],
  [0.16, 1.02],
  [0.32, 0.98],
  [0.42, 0.75],
  [0.55, 0.82],
  [0.7, 0.76],
  [0.82, 0.52],
  [0.92, 0.42],
  [1, 0],
];

/** The bench tilt (r2): straight-stacked benches read as two slabs piled
 *  by a mason; a drifted upper bench is one ledged stone. */
const SHELF_LEAN = 0.1;

/**
 * The prow: the slab's second sibling. A low wedge whose crown drifts
 * off-axis (the keel lean again, gentler) — the leaning ship-bow stone a
 * roadside verge wants where the potato used to squat.
 */
const PROW: readonly ProfilePoint[] = [
  [0, 0.96],
  [0.2, 1.02],
  [0.42, 0.9],
  [0.64, 0.68],
  [0.84, 0.46],
  [1, 0],
];

/** The prow leans less than the keeled boulder: it is broad, not tall. */
const PROW_LEAN = 0.2;

/**
 * The waist a sea stack is given, as a fraction taken out at mid height.
 *
 * A stack is the one rock here that is tall enough for its outline to be read
 * as a *line* rather than as a blob, and a line with a gentle pinch in it is
 * the difference between a standing stone and a pile of boulders. It is applied
 * as a multiplier, which is also why it is safe: a waist can only ever take
 * material away, so a re-profiled stack stays inside the volume its colliders
 * and its footprint were authored against.
 */
const WAIST_DEPTH = 0.13;
const WAIST_AT = 0.52;
const WAIST_WIDTH = 0.24;

/**
 * The stack's silhouette variants (critic punch #9). The two-segment
 * bulb-over-bulb stack is the "double-lobe" the critic caught wearing
 * six recolours — golden's Honey Gate jambs, calamity's rim sentinels
 * and bank teeth, verdant and pale waysides. A stack's outline is
 * DERIVED from its measured blocks and may only ever lose material
 * (colliders and sightlines rely on it — see {@link stackSpan}), so a
 * sibling here is a different *carving* of the same union: a table of
 * Gaussian notches plus an optional crown taper, every term ≤ 1.
 *
 * - variant 0 — the original single waist, byte-identical arithmetic;
 * - variant 1 — the collared spire: a deep low collar over a pedestal
 *   foot, the crown pinched through the last quarter, so the upper
 *   lobe reads as a tapering finger instead of a second bulb;
 * - variant 2 — the cleft head: one thin, deep notch high on the stone
 *   and a faint belly trim, the split-crown read at fog distance.
 */
interface StackCarving {
  readonly notches: readonly { depth: number; at: number; width: number }[];
  /** Crown taper: radius × (1 − taper·s³) with s ramping over the top
   *  40% — zero keeps the profile exactly as measured. */
  readonly crownTaper: number;
}

const STACK_CARVINGS: readonly StackCarving[] = [
  { notches: [{ depth: WAIST_DEPTH, at: WAIST_AT, width: WAIST_WIDTH }], crownTaper: 0 },
  {
    notches: [{ depth: 0.24, at: 0.34, width: 0.2 }],
    crownTaper: 0.34,
  },
  {
    notches: [
      { depth: 0.3, at: 0.74, width: 0.11 },
      { depth: 0.09, at: 0.42, width: 0.3 },
    ],
    crownTaper: 0.12,
  },
];

/** One of the ellipsoids a sea stack's silhouette is measured from. */
export interface StackSegment {
  readonly radius: number;
  readonly rise: number;
  readonly stretch: number;
  readonly lean: number;
}

export interface RockShapeOptions {
  readonly seed: number;
  /** Widest radius, in metres. */
  readonly radius: number;
  /** Height above the sand, in metres. */
  readonly height: number;
  /** Peak radial roughing, as a fraction of the local radius. */
  readonly amount?: number;
  /** Segments around the body. */
  readonly segments?: number;
  /** Rings up the body. */
  readonly rings?: number;
}

/**
 * The silhouette families (critic punch #9 — "buy two more silhouettes
 * per kit slot"). Index 0 is always the original profile, byte-for-byte:
 * a seed that selects it builds exactly the stone it always built.
 */
const BOULDER_FAMILY: readonly { profile: readonly ProfilePoint[]; lean: number }[] = [
  { profile: BOULDER, lean: 0 },
  { profile: SPLIT_CRAG, lean: CRAG_LEAN },
  { profile: KEELED, lean: KEEL_LEAN },
];

const SLAB_FAMILY: readonly { profile: readonly ProfilePoint[]; lean: number }[] = [
  { profile: SLAB, lean: 0 },
  { profile: SHELF_STACK, lean: SHELF_LEAN },
  { profile: PROW, lean: PROW_LEAN },
];

/** A fresh XOR substream for the variant pick, so it can never collide
 *  with the roughing streams (`seed`, `seed ^ 0x4d21`) already in use. */
const VARIANT_SALT = 0x5eed_c2a6;

/**
 * Which sibling a seed selects — the deployment device. Every caller
 * already passes a per-stone seed drawn from its own fenced stream, so
 * hashing that seed (mulberry32's avalanche, no stream consumed) swaps
 * the geometry profile under a placement without moving it: position,
 * scale and rotation are the caller's and stay byte-identical.
 * Exported for the variant tests; regions have no reason to call it.
 */
export function rockVariantIndex(seed: number, kind: "boulder" | "slab" | "stack"): number {
  const count =
    kind === "boulder"
      ? BOULDER_FAMILY.length
      : kind === "slab"
        ? SLAB_FAMILY.length
        : STACK_CARVINGS.length;
  let t = (seed ^ VARIANT_SALT) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) % count;
}

export function boulderGeometry(options: RockShapeOptions): BufferGeometry {
  const variant = BOULDER_FAMILY[rockVariantIndex(options.seed, "boulder")]!;
  return latheRock(variant.profile, options, { lean: variant.lean });
}

export function slabGeometry(options: RockShapeOptions): BufferGeometry {
  const variant = SLAB_FAMILY[rockVariantIndex(options.seed, "slab")]!;
  return latheRock(variant.profile, options, { lean: variant.lean });
}

/**
 * A sea stack, measured off the blocks it replaces and then given a waist.
 *
 * The pinnacles are staged for the canonical cameras and their feet, colliders
 * and contact shadows are authored numbers — so the profile is *derived* rather
 * than drawn: at each ring the outline is the union of the segment ellipsoids
 * along their own lean axis, which reproduces the footprint the composition was
 * built on and cannot exceed it. What the drawing supplies is the waist, and
 * the fact that a single skin over the whole stack has no seams in it where two
 * blocks used to overlap.
 *
 * The lean is baked in as a shift of each ring's centre, so the caller places
 * the stack at its foot and turns it to face the lean, exactly as the blocks
 * were placed.
 */
export function stackGeometry(
  segments: readonly StackSegment[],
  options: Omit<RockShapeOptions, "radius" | "height">,
): BufferGeometry {
  const top = segments.reduce(
    (highest, s) => Math.max(highest, s.rise + s.radius * s.stretch),
    0,
  );
  const rings = options.rings ?? 22;
  const radii: number[] = [];
  const heights: number[] = [];
  // The lathe carries the radius; the lean is a shift applied afterwards,
  // because a surface of revolution has one axis by definition.
  const centres: number[] = [0];

  const carving = STACK_CARVINGS[rockVariantIndex(options.seed, "stack")]!;
  let axis = 0;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = -SINK + t * (top + SINK);
    const span = stackSpan(segments, y);
    // Every carving term multiplies by ≤ 1, so the profile can only ever
    // fit deeper inside the measured blocks (the stackSpan guarantee).
    let waist = 1;
    for (const notch of carving.notches) {
      waist *= 1 - notch.depth * Math.exp(-(((t - notch.at) / notch.width) ** 2));
    }
    if (carving.crownTaper > 0) {
      const s = Math.min(1, Math.max(0, (t - 0.6) / 0.4));
      waist *= 1 - carving.crownTaper * s * s * s;
    }
    radii.push(Math.max(0, span.radius * waist));
    heights.push(y);
    // The topmost ring closes on nothing — the highest block's own apex is
    // exactly there — so it has no lean of its own to report. Carrying the one
    // below is the difference between a stack that comes to a point and one
    // that throws a spike back across to its axis.
    if (span.radius > 0) {
      axis = span.centre;
    }
    centres.push(axis);
  }

  const points: Vector2[] = [new Vector2(0, -SINK)];
  for (const [i, radius] of smoothedProfile(radii).entries()) {
    points.push(new Vector2(radius, heights[i]!));
  }

  const geometry = new LatheGeometry(points, options.segments ?? 16);
  shiftRings(geometry, points, centres);
  roughLathe(geometry, options.seed, options.amount ?? 0.12);
  return finish(geometry, options.seed);
}

/**
 * The swim-through: two lathed legs and a lofted lintel, welded into one stone.
 *
 * It is the only piece of scenery in the reef with a hole in it, and a hole is
 * an invitation — the eye reads an opening as somewhere to go long before the
 * player works out that they can. Which is also the whole risk of the thing, so
 * it is built as *one* geometry: a single mesh raycasts once, occludes as one
 * shape, and can be checked against `tests/reefSightlines` as one object rather
 * than as three that might individually be innocent.
 *
 * The lintel is a tube on a quadratic arc, squashed across the arch's plane
 * afterwards. That squash is only legitimate because the arc is planar — every
 * cross-section shares one normal direction, so one scale on the depth axis
 * turns every circular section into the same ellipse. Bend the arc out of
 * plane and this stops being true.
 */
export interface ArchOptions {
  readonly seed: number;
  /** Distance between the two legs' axes, in metres. */
  readonly span: number;
  /** Where the legs' shoulders sit, in metres above the sand. */
  readonly legHeight: number;
  readonly legRadius: number;
  /** Half-thickness of the lintel, before the depth squash. */
  readonly beamRadius: number;
  /** How far the lintel's crown rises above the shoulders. */
  readonly rise: number;
}

/**
 * A leg. It does not taper away at the top like a free rock: the lintel lands
 * on it, so it swells back out into a shoulder and closes on a small flat crown
 * that the beam covers.
 */
const ARCH_LEG: readonly ProfilePoint[] = [
  [0, 1.0],
  [0.2, 0.84],
  [0.45, 0.73],
  [0.66, 0.76],
  [0.86, 0.9],
  [0.96, 0.86],
  [1, 0.55],
];

export function archGeometry(options: ArchOptions): BufferGeometry {
  const half = options.span / 2;
  const parts: BufferGeometry[] = [];

  for (const side of [-1, 1]) {
    const leg = latheRock(
      ARCH_LEG,
      {
        seed: options.seed ^ (side > 0 ? 0x1a37 : 0x7c05),
        radius: options.legRadius,
        height: options.legHeight,
        amount: 0.1,
        segments: 14,
        rings: 14,
      },
      { finish: false },
    );
    leg.translate(side * half, 0, 0);
    parts.push(leg);
  }

  const crown = options.legHeight + options.rise;
  const beam = new TubeGeometry(
    new QuadraticBezierCurve3(
      new Vector3(-half, options.legHeight - options.beamRadius * 0.4, 0),
      // A quadratic passes half way to its control point, so the control sits
      // twice the rise above the shoulders for a crown at the rise.
      new Vector3(0, options.legHeight + options.rise * 2, 0),
      new Vector3(half, options.legHeight - options.beamRadius * 0.4, 0),
    ),
    22,
    options.beamRadius,
    9,
    false,
  );
  // A beam as deep as it is thick is a pipe. Across the arch's plane it is
  // three quarters of that, which is a cut stone lintel.
  beam.scale(1, 1, 0.72);
  roughBeam(beam, options.seed ^ 0x3f11, crown);
  parts.push(beam);

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    // `mergeGeometries` returns null when its inputs disagree on attributes or
    // indexing, and it does it with a console error and nothing in the frame —
    // the failure the fish's tail fork went missing behind for a while.
    throw new Error("arch parts could not be merged");
  }
  return finish(merged, options.seed);
}

interface LatheRockFlags {
  /** Off while a part is on its way into a merge; see {@link archGeometry}. */
  readonly finish?: boolean;
  /** Crown drift off the lathe axis, per unit radius; see {@link leanRings}. */
  readonly lean?: number;
}

function latheRock(
  profile: readonly ProfilePoint[],
  options: RockShapeOptions,
  flags: LatheRockFlags = {},
): BufferGeometry {
  const rings = options.rings ?? 16;
  const wall = new SplineCurve(profile.map(([t, r]) => new Vector2(t, r)));

  const points: Vector2[] = [new Vector2(0, -SINK)];
  for (let i = 0; i <= rings; i++) {
    const sample = wall.getPoint(i / rings);
    const t = Math.min(1, Math.max(0, sample.x));
    points.push(
      new Vector2(
        Math.max(0, sample.y) * options.radius,
        -SINK + t * (options.height + SINK),
      ),
    );
  }

  // A profile that does not close on the axis leaves the top open. The arch's
  // legs are the case: their shoulders carry a lintel rather than tapering
  // away, so they take a flat crown disc that the beam then covers.
  const crown = points[points.length - 1]!;
  if (crown.x > 1e-3) {
    points.push(new Vector2(0, crown.y));
  }

  const geometry = new LatheGeometry(points, options.segments ?? 13);
  roughLathe(geometry, options.seed, options.amount ?? 0.14);
  if (flags.lean) {
    leanRings(geometry, points, flags.lean * options.radius, options.height);
  }
  return flags.finish === false ? geometry : finish(geometry, options.seed);
}

/**
 * Drifts a lathe's rings off the axis as they climb — the keeled stones'
 * asymmetry. The same ring-stride walk as {@link shiftRings}, with the
 * shift a smooth power of height so the foot stays planted where the
 * caller put it and only the crown leans. Applied AFTER the roughing
 * (whose noise is sampled around the original axis, so the seam column
 * still displaces identically) and BEFORE the finish (which computes the
 * welded normals off the final shape). The crown shift never exceeds a
 * third of the radius, so a leaned stone stays inside the footprint its
 * caller's clearances were authored against.
 */
function leanRings(
  geometry: BufferGeometry,
  points: readonly Vector2[],
  crownShift: number,
  height: number,
): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }
  const perSlice = points.length;
  for (let i = 0; i < position.count; i++) {
    const ring = i % perSlice;
    const t = Math.max(0, (points[ring]!.y + SINK) / (height + SINK));
    position.setX(i, position.getX(i) + crownShift * Math.pow(t, 1.6));
  }
  position.needsUpdate = true;
}

/**
 * How much a ring's axis is dragged toward the fatter of two overlapping
 * blocks. High enough that dominance passes over quickly and the stack leans
 * where the blocks leaned; low enough that it passes *smoothly*, which a plain
 * "follow the widest" would not.
 */
const DOMINANCE = 6;

/**
 * Where a stack's outline stands at one height.
 *
 * The radius is the widest single ellipsoid at that height, and it is
 * deliberately not the width of their union along the lean. Two blocks a metre
 * apart span two and a half metres between them and reach only three quarters
 * of that to either side, and a lathe told to span the union comes out forty
 * per cent too fat *across* it — which on a stack that is only there to be a
 * silhouette is the difference between a standing stone and a bollard, and on
 * one placed to keep out of a moray's approach is worse than that. Taking the
 * widest instead means the profile can only ever fit inside the blocks it
 * replaces, in every direction, which is the property the colliders and the
 * sightline test are relying on.
 */
function stackSpan(
  segments: readonly StackSegment[],
  y: number,
): { radius: number; centre: number } {
  let radius = 0;
  let weighted = 0;
  let weight = 0;

  for (const segment of segments) {
    const halfHeight = segment.radius * segment.stretch;
    const off = (y - segment.rise) / halfHeight;
    if (Math.abs(off) >= 1) {
      continue;
    }
    const rho = segment.radius * Math.sqrt(1 - off * off);
    radius = Math.max(radius, rho);
    const share = rho ** DOMINANCE;
    weighted += share * segment.lean;
    weight += share;
  }

  return { radius, centre: weight > 0 ? weighted / weight : 0 };
}

/**
 * Takes the corner off the profile where dominance passes from one block to the
 * next, without ever letting a ring grow. A three-tap average and then a
 * minimum against the original: the smoothing is allowed to shrink the stack
 * and not to inflate it, which keeps {@link stackSpan}'s guarantee intact.
 */
function smoothedProfile(radii: readonly number[]): number[] {
  return radii.map((radius, i) => {
    const before = radii[i - 1] ?? radius;
    const after = radii[i + 1] ?? radius;
    return Math.min(radius, before * 0.25 + radius * 0.5 + after * 0.25);
  });
}

/**
 * Slides each of a lathe's rings sideways, which is the only way to bend a
 * surface of revolution and keep it closed.
 *
 * `LatheGeometry` lays its vertices out one meridian at a time — every profile
 * point in order, then the next slice round — so a ring is a stride rather than
 * a run, and the profile array is the lookup that says which ring a vertex is
 * in.
 */
function shiftRings(
  geometry: BufferGeometry,
  points: readonly Vector2[],
  centres: readonly number[],
): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  const perSlice = points.length;
  for (let i = 0; i < position.count; i++) {
    const centre = centres[i % perSlice];
    if (centre !== undefined && centre !== 0) {
      position.setX(i, position.getX(i) + centre);
    }
  }
  position.needsUpdate = true;
}

/**
 * Knocks a lathed shape out of round.
 *
 * The displacement `weatherRock` applies is a scale along the vertex's own
 * radius *from the origin*, which is the right move on something roughly
 * spherical and the wrong one on anything tall: a nine-metre stack would have
 * its crown thrown two and a half metres up and down. Here the noise multiplies
 * the horizontal radius instead — so a ring's height is its own — with a small
 * vertical wobble laid on top to keep the rings from reading as contour lines.
 *
 * Both terms are sampled by *direction and height*, never per vertex, so the
 * duplicated column at the lathe's seam displaces identically and the surface
 * stays closed. Both taper to nothing at the poles for the same reason: the
 * vertices at radius zero all occupy one point, and moving them apart is a hole
 * in the top of the rock.
 */
function roughLathe(geometry: BufferGeometry, seed: number, amount: number): void {
  const position = geometry.attributes.position;
  if (!position || amount <= 0) {
    return;
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const extent = Math.max(1e-3, maxY - minY);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radius = Math.hypot(x, z);
    const t = (y - minY) / extent;
    const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;

    const lump = fbm(u, t, { seed, period: ROUGH_PERIOD, octaves: ROUGH_OCTAVES });
    const scale = 1 + (lump - 0.5) * 2 * amount;
    // Zero at both poles: a pole is one point wearing many vertices.
    const taper = Math.sin(Math.PI * t);
    const wobble =
      (fbm(u, t, { seed: seed ^ 0x4d21, period: ROUGH_PERIOD, octaves: 1 }) - 0.5) *
      2 *
      amount *
      extent *
      0.35 *
      taper;

    if (radius > 1e-4) {
      position.setX(i, x * scale);
      position.setZ(i, z * scale);
    }
    position.setY(i, y + wobble);
  }

  position.needsUpdate = true;
}

/**
 * The lintel's tooth. A beam is not a body of revolution about anything useful,
 * so its noise is read off the world position directly — which is fine because
 * it is one piece of geometry that exists once, in one place.
 */
function roughBeam(geometry: BufferGeometry, seed: number, crown: number): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const lump =
      fbm(x * 0.09 + 0.5, y * 0.09 + 0.5, { seed, period: 4, octaves: ROUGH_OCTAVES }) - 0.5;
    // Along the beam's own thickness, so the arc's line is never broken.
    const axis = Math.hypot(x, y - crown) || 1;
    const push = lump * 0.11;
    position.setXYZ(i, x + (x / axis) * push, y + ((y - crown) / axis) * push, z * (1 + lump * 0.14));
  }

  position.needsUpdate = true;
}

/**
 * The surface contract every stone in the reef meets, taken from the one place
 * it is written. `amount: 0` leaves this module's own displacement exactly
 * where it is — a scale of 1 is the identity on a float — and runs the rest:
 * box-projected UVs, welded smooth normals, and the algae tint that darkens
 * what faces up.
 */
function finish(geometry: BufferGeometry, seed: number): BufferGeometry {
  weatherRock(geometry, seed, { amount: 0 });
  return geometry;
}
