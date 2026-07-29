import {
  BufferGeometry,
  Float32BufferAttribute,
  Sphere,
  Uint16BufferAttribute,
  Vector3,
} from "three";

/**
 * The skinned body of a moray: one continuous tube and one continuous dorsal
 * fin, both authored in the rig's rest pose and both weighted to the same
 * chain of joints.
 *
 * This replaces a stack of nine capped cylinders and a row of overlapping
 * ridge boxes. That stack had two failures no amount of tuning could reach.
 * Each link stepped its radius down at the joint, so the animal wore a visible
 * ring every forty centimetres — a telescope, not a body. And a rigid link
 * cannot bend: the wave down the chain broke the silhouette into flat chords
 * with a corner at every joint, which at four metres is a hinge. Both are
 * properties of the topology, so the topology is what changes here. A vertex
 * that straddles two joints is *interpolated* between them, which is the
 * whole trick: the same wave, driving the same joints, now curves.
 *
 * Everything is expressed in "joint units": `g` is the position along the
 * body measured in joints, so `g = 0` is the first joint (the neck, at the
 * body root's origin), `g = 3.5` is halfway between the fourth and fifth, and
 * a fractional `g` is exactly the skin weight of the vertex sitting there.
 * Metres only appear at the end, where `g` is multiplied by the joint spacing.
 */

/**
 * Vertices around the circumference. Ten was enough for a link seen against
 * its neighbours; a single tube shows its own outline for its whole length,
 * and at ten the silhouette of a body near the lens is visibly a polygon.
 */
const RADIAL_SEGMENTS = 12;

/**
 * Rings per joint. One ring per joint would put every ring exactly on a joint
 * and weight it entirely to that joint, which reproduces the rigid chain — the
 * bend would still be a corner, just a smoother-shaded one. Two puts a ring at
 * every midpoint, where the weights are even and the interpolation does its
 * work.
 */
const RINGS_PER_JOINT = 2;

/** How far forward of the first joint the tube runs, in joint units. */
const NECK_OVERLAP = 0.55;
/** How far past the last joint the tail runs, in joint units. */
const TAIL_EXTENT = 0.55;

/** Eels are laterally compressed — narrow across, deep top to bottom. */
const LATERAL = 0.9;

/** Girth at the neck and how much of it is lost by the last joint. */
const NECK_GIRTH = 0.42;
const TAIL_GIRTH_DROP = 0.24;

/**
 * How much the tube narrows over its overlap with the skull.
 *
 * The front ring is open and sits inside the cranium, so the join is hidden by
 * the skull rather than by a cap. Drawing it at full girth would push it back
 * out through the top of a head that is narrower there than the neck is; a
 * gentle tuck keeps it inside while the ring at `g = 0` still meets the skull
 * at full width, which is what closes the seam.
 */
const NECK_TUCK = 0.3;

/** Fraction of the body after which the tail taper begins. */
const TAIL_START = 0.62;
/** Radius at the very tip, as a fraction of the untapered profile there. */
const TAIL_TIP = 0.05;

/**
 * Peak dorsal fin height as a fraction of the local girth, and where it ramps
 * in.
 *
 * It runs from just behind the skull to the tip, and its height is tied to the
 * body's own radius rather than to a constant, so it thins into the tail with
 * the animal instead of ending in a stub.
 *
 * The ramp is long on purpose. A fin that reaches full height in one joint
 * presents a tall, thin blade standing off the neck, and a zebra's pale fin
 * caught edge-on there rendered as a bright spike over the animal's head — the
 * comb's failure mode wearing a different shape. Over two and a half joints it
 * is a rise instead of a step.
 */
const FIN_HEIGHT = 0.3;
const FIN_START = 0.45;
const FIN_RAMP = 2.4;

/**
 * How much of its peak the fin keeps at the ends of its arch.
 *
 * The body's profile is close to linear, so a fin that is a fixed fraction of
 * it has a straight top edge from the neck to the tail — a wedge laid on a
 * cone, which is a shape no animal has. A shallow arch, tallest around the
 * middle, is the difference between a fin and a fairing.
 */
const FIN_ARCH_FLOOR = 0.7;
/**
 * How far the fin's root is sunk into the back. A fin rooted exactly on the
 * surface leaves a crease of coincident faces down the spine that z-fights;
 * buried, the two surfaces simply meet.
 */
const FIN_ROOT_SINK = 0.86;
/** Fin thickness at root and edge, as fractions of the local body radius. */
const FIN_ROOT_HALF_WIDTH = 0.09;
const FIN_EDGE_HALF_WIDTH = 0.025;

/**
 * Slack on the bind-pose bounding sphere.
 *
 * Three computes a skinned mesh's bounds once, from whatever pose the bones
 * happen to be in at the first render, and never again — so a body that
 * swims out of that first sphere is culled while still on screen. The bind
 * pose is a straight rod, the animal is inextensible, and no joint can fold
 * the tail further from the centre than the tail already is, so half the
 * body's length with a margin bounds every pose it can reach.
 */
const BOUNDS_SLACK = 1.4;

export interface MorayBodyOptions {
  /** Joints in the chain the geometry is skinned to. */
  readonly jointCount: number;
  /** Distance between joints, in metres. */
  readonly jointSpacing: number;
  /** The species' girth multiplier. */
  readonly girthScale: number;
}

export interface MorayBodyGeometry {
  /** The tube, textured with the species skin over continuous head-to-tail UVs. */
  readonly body: BufferGeometry;
  /** The dorsal fin, a thin ribbon riding the same spine. */
  readonly fin: BufferGeometry;
  /** Bounds wide enough for every pose the rig can reach; see {@link BOUNDS_SLACK}. */
  readonly bounds: Sphere;
  /**
   * The `v` the tube samples at the body root — the plane the head group stands
   * on, and so the value the head's own band has to end at if the two are to
   * agree where they meet. It is not 0: the tube runs {@link NECK_OVERLAP}
   * joints further forward than that, up inside the skull, and it is *there*
   * that its `v` reaches 0. Depends on the length of the animal, so every
   * archetype has its own; see `projectHeadUvs`.
   */
  readonly neckV: number;
  /**
   * The tube's radius at the body root (`g = 0`), in metres — its vertical
   * half-height, since the ring is squashed to {@link LATERAL} across. This is
   * the girth the sculpted head has to meet without a step, so it is what the
   * head's scale is derived from; see `glbHeadScale`.
   */
  readonly neckRadius: number;
}

/** One cross-section of the animal, and the joints it is carried by. */
interface Station {
  readonly z: number;
  readonly radius: number;
  readonly finHeight: number;
  /** Texture coordinate down the body: 0 at the snout end, 1 at the tail tip. */
  readonly v: number;
  readonly jointA: number;
  readonly jointB: number;
  /** Share of the station carried by `jointB`; the rest is `jointA`'s. */
  readonly blend: number;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothStep01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function buildMorayBody({
  jointCount,
  jointSpacing,
  girthScale,
}: MorayBodyOptions): MorayBodyGeometry {
  const stations = layOutSpine(jointCount, jointSpacing, girthScale);
  const front = stations[0]!;
  const back = stations[stations.length - 1]!;
  const halfLength = (front.z - back.z) / 2;

  return {
    body: buildTube(stations),
    fin: buildFin(stations),
    bounds: new Sphere(
      new Vector3(0, 0, (front.z + back.z) / 2),
      halfLength * BOUNDS_SLACK + front.radius,
    ),
    // `v` is linear in `z` from 0 at the front station to 1 at the back one, so
    // the value at `z = 0` is where the root falls between the two ends.
    neckV: front.z / (front.z - back.z),
    // The profile at `g = 0` exactly: the tuck and the taper are both 1 there.
    neckRadius: NECK_GIRTH * girthScale * 0.5,
  };
}

function layOutSpine(jointCount: number, jointSpacing: number, girthScale: number): Station[] {
  const lastJoint = jointCount - 1;
  const gFront = -NECK_OVERLAP;
  const gBack = lastJoint + TAIL_EXTENT;
  const span = gBack - gFront;
  const stationCount = Math.round(span * RINGS_PER_JOINT) + 1;

  const tailStart = TAIL_START * lastJoint;
  const stations: Station[] = [];

  for (let i = 0; i < stationCount; i++) {
    const along = i / (stationCount - 1);
    const g = gFront + span * along;

    // The profile the old chain stepped through, read continuously.
    const profile = (NECK_GIRTH - TAIL_GIRTH_DROP * clamp01(g / lastJoint)) * girthScale * 0.5;

    // A quadratic tuck, so the tube leaves the skull without a shoulder crease.
    const tuck = g < 0 ? 1 - NECK_TUCK * (g / NECK_OVERLAP) ** 2 : 1;

    // An elliptical run-out: flat where it starts, near-vertical at the tip,
    // which is a point rather than the blunt stub a smoothstep would leave.
    const t = clamp01((g - tailStart) / (gBack - tailStart));
    const taper = TAIL_TIP + (1 - TAIL_TIP) * Math.sqrt(Math.max(0, 1 - t * t));

    const radius = profile * tuck * taper;
    const jointA = Math.min(lastJoint - 1, Math.max(0, Math.floor(g)));
    const blend = clamp01(g - jointA);

    const finRise = smoothStep01((g - FIN_START) / FIN_RAMP);
    const finArch =
      FIN_ARCH_FLOOR +
      (1 - FIN_ARCH_FLOOR) * Math.sin(Math.PI * clamp01((g - FIN_START) / (gBack - FIN_START)));

    stations.push({
      z: -g * jointSpacing,
      radius,
      finHeight: FIN_HEIGHT * 2 * radius * finRise * finArch,
      v: along,
      jointA,
      jointB: jointA + 1,
      blend,
    });
  }

  return stations;
}

/**
 * The body tube.
 *
 * Normals are derived from the profile rather than averaged from the faces.
 * A tube closes on itself, so the seam column exists twice — once at `u = 0`
 * and once at `u = 1` — and averaged normals give the two copies different
 * values, which draws a bright line straight down the belly of every animal.
 * The analytic normal depends only on the angle and the local slope, so both
 * copies get the same one.
 */
function buildTube(stations: readonly Station[]): BufferGeometry {
  const columns = RADIAL_SEGMENTS + 1;
  const count = stations.length * columns;

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const skinIndices = new Uint16Array(count * 4);
  const skinWeights = new Float32Array(count * 4);
  const indices: number[] = [];

  for (let s = 0; s < stations.length; s++) {
    const station = stations[s]!;
    const previous = stations[Math.max(0, s - 1)]!;
    const next = stations[Math.min(stations.length - 1, s + 1)]!;
    // Central differences: the slope of the profile at this station, which is
    // what tilts the normal off the cross-section plane.
    const dz = next.z - previous.z;
    const dr = next.radius - previous.radius;

    for (let j = 0; j < columns; j++) {
      const u = j / RADIAL_SEGMENTS;
      const angle = u * Math.PI * 2;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      const vertex = s * columns + j;
      const p = vertex * 3;
      // `u = 0` is the belly and `u = 0.5` the spine, which is the convention
      // the species skin is painted to — see `MorayPattern`.
      positions[p] = LATERAL * station.radius * sin;
      positions[p + 1] = -station.radius * cos;
      positions[p + 2] = station.z;

      const nx = -dz * sin;
      const ny = LATERAL * dz * cos;
      const nz = LATERAL * dr;
      const length = Math.hypot(nx, ny, nz) || 1;
      normals[p] = nx / length;
      normals[p + 1] = ny / length;
      normals[p + 2] = nz / length;

      uvs[vertex * 2] = u;
      uvs[vertex * 2 + 1] = station.v;
      writeSkin(skinIndices, skinWeights, vertex, station);
    }
  }

  for (let s = 0; s < stations.length - 1; s++) {
    for (let j = 0; j < RADIAL_SEGMENTS; j++) {
      const a = s * columns + j;
      const b = a + 1;
      const c = b + columns;
      const d = a + columns;
      indices.push(a, c, b, a, d, c);
    }
  }

  return assemble(positions, normals, uvs, skinIndices, skinWeights, indices);
}

/**
 * The dorsal fin: a thin wedge running the length of the back.
 *
 * Four vertices a station — a root either side and an edge either side — so
 * the fin has real thickness. A flat sheet would vanish to a hairline every
 * time the camera came level with it, which is most of the reef, and the comb
 * of separate plates this replaces existed to avoid exactly that.
 */
function buildFin(stations: readonly Station[]): BufferGeometry {
  const columns = 4;
  const count = stations.length * columns;

  const positions = new Float32Array(count * 3);
  const skinIndices = new Uint16Array(count * 4);
  const skinWeights = new Float32Array(count * 4);
  const indices: number[] = [];

  for (let s = 0; s < stations.length; s++) {
    const station = stations[s]!;
    const root = station.radius * FIN_ROOT_SINK;
    const edge = station.radius + station.finHeight;
    const rootHalf = station.radius * FIN_ROOT_HALF_WIDTH;
    const edgeHalf = station.radius * FIN_EDGE_HALF_WIDTH;

    const section: readonly (readonly [number, number])[] = [
      [-rootHalf, root],
      [-edgeHalf, edge],
      [edgeHalf, edge],
      [rootHalf, root],
    ];

    for (let j = 0; j < columns; j++) {
      const [x, y] = section[j]!;
      const vertex = s * columns + j;
      const p = vertex * 3;
      positions[p] = x;
      positions[p + 1] = y;
      positions[p + 2] = station.z;
      writeSkin(skinIndices, skinWeights, vertex, station);
    }
  }

  for (let s = 0; s < stations.length - 1; s++) {
    for (let j = 0; j < columns - 1; j++) {
      const a = s * columns + j;
      const b = a + 1;
      const c = b + columns;
      const d = a + columns;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);
  // Averaged is right here, unlike on the tube: the fin's only creases are its
  // two edges, and softening them is what keeps a thin wedge from reading as a
  // folded card.
  geometry.computeVertexNormals();
  return geometry;
}

/** Two influences per vertex: the joint behind it and the joint in front. */
function writeSkin(
  indices: Uint16Array,
  weights: Float32Array,
  vertex: number,
  station: Station,
): void {
  const w = vertex * 4;
  indices[w] = station.jointA;
  indices[w + 1] = station.jointB;
  weights[w] = 1 - station.blend;
  weights[w + 1] = station.blend;
}

function assemble(
  positions: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
  skinIndices: Uint16Array,
  skinWeights: Float32Array,
  indices: number[],
): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);
  return geometry;
}
