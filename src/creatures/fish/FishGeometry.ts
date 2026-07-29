import { BufferAttribute, ConeGeometry, SphereGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The body every fish species is built from, as scales on one sphere.
 *
 * The base is `SphereGeometry(0.13, 6, 5)` for every species, and that is a
 * measured decision inherited from the single-species school, not a default:
 * at 170 instances on the software rasteriser the school cost 3.0ms at 48
 * triangles and 5.5ms at 80, and the two spheres cannot be told apart at any
 * size these animals are drawn. Diversity lives in the *proportions* — a tang
 * is the same 42 vertices as a fusilier, squashed flat and pulled tall — which
 * is what keeps five species from costing five times one.
 *
 * Everything stays indexed. `mergeGeometries` takes its indexing from the
 * first geometry and rejects every other one that disagrees, and an
 * indexed/non-indexed mismatch is exactly how every fish in the reef once swam
 * without a tail behind a single console error. Sphere and cone are both
 * indexed grids as three builds them, so the merge agrees by construction —
 * and the fallback below exists because a null merge is a build-time mistake,
 * not a reason to have no fish.
 */
export interface FishBodyProfile {
  /** Scale across the body; small is laterally flat. */
  readonly width: number;
  /** Scale up the body; large is deep-bodied. */
  readonly height: number;
  /** Scale along the body; large is slender. */
  readonly length: number;
  /** How much girth is gone by the tail; eased in over the back half only. */
  readonly tailTaper: number;
  readonly fork: ForkProfile;
}

/** The two cone blades splayed into a tail fork, set behind the body. */
export interface ForkProfile {
  readonly radius: number;
  readonly length: number;
  /** Scale across each blade, so the fork is thin like the body. */
  readonly pinch: number;
  /** Half the vertical gap between the two blades. */
  readonly splay: number;
  /** Where the fork sits along -z; just past the body's tail end. */
  readonly z: number;
}

/** The sphere every body starts as; profiles scale it, nothing resizes it. */
export const FISH_BODY_RADIUS = 0.13;

/**
 * Where the pale underside ends and the dark back begins, up the body.
 *
 * Two plateaus with a short crossing between them, not a straight ramp: at the
 * size these animals are drawn a gradient averages into a single mid tone, and
 * the window is placed between the third and fourth of the five-segment
 * sphere's six vertex rings — the flank at the midline, which is where a
 * counter-shaded fish actually turns over. Shared by every species, because it
 * is a property of the geometry the marking lives on, not of the animal.
 */
const BELLY_TOP = 0.42;
const BACK_FROM = 0.72;

/**
 * How far the back is taken down from the belly's value.
 *
 * 0.78 for every species, and the restraint is the point: under a ramp,
 * counter-shading is a marking, not a second model of the light — the key is
 * overhead, so the ramp already hands the back the lit band, and a deep dip
 * here darkens the lit side until it cancels against the shaded belly and the
 * whole flank goes one flat mauve. That failure was measured once on the
 * fusilier (WP-G8) and it would be exactly as true on a tang.
 */
const BACK_SHADE = 0.78;

/**
 * The eye: one vertex per side, and the only thing here allowed above 1.
 *
 * A lozenge has no front; an eye is the one mark that says which end is which,
 * and at six segments around it is a soft bright patch over the front eighth
 * of the body rather than a dot — which still breaks the fore-and-aft symmetry,
 * which is the whole job. It sits just *below* the midline because the cameras
 * sit below the shoals: the frame is mostly underside, and on the upper cheek
 * the mark merges into the pale dorsal band the ramp lights. The
 * counter-shading itself is capped at 1 (a ramp peaking above 1 is a global
 * brightening hidden in a vertex buffer); two vertices at the head are a
 * highlight, visible as one in the geometry, and not that.
 */
const EYE_FORWARD = 0.82;
const EYE_RISE = -0.25;
const EYE_VALUE = 1.5;

/**
 * A rounded teardrop with a forked tail, nose along +Z, proportioned by the
 * profile. Counter-shading and the eye are baked into vertex colours here so
 * every species carries them for free — no texture, no second draw call.
 */
export function createFishGeometry(profile: FishBodyProfile): BufferGeometry {
  const body = new SphereGeometry(FISH_BODY_RADIUS, 6, 5);
  body.scale(profile.width, profile.height, profile.length);
  taperTail(body, profile.tailTaper);
  // Indexed, so this averages across the shared vertices rather than
  // splitting them: the taper's normals come back smooth.
  body.computeVertexNormals();

  const fork = profile.fork;
  const upperBlade = new ConeGeometry(fork.radius, fork.length, 3);
  upperBlade.rotateX(-Math.PI / 2);
  upperBlade.rotateZ(Math.PI / 2);
  upperBlade.scale(fork.pinch, 1, 1);
  upperBlade.translate(0, fork.splay, fork.z);

  const lowerBlade = upperBlade.clone();
  lowerBlade.translate(0, -fork.splay * 2, 0);

  // All three shaded against the body's own extent, so the fork continues the
  // gradient rather than restarting it: a blade read per part would run the
  // whole dark-back-to-pale-belly ramp across itself.
  const shading = verticalExtent(body);
  countershade(body, shading);
  countershade(upperBlade, shading);
  countershade(lowerBlade, shading);
  // After the counter-shading, whose entries it overwrites, and on the body
  // alone: a tail blade has no cheek to put an eye on.
  markEyes(body);

  return mergeGeometries([body, upperBlade, lowerBlade]) ?? body;
}

/**
 * Narrows the back of the body toward the tail, in place.
 *
 * Only x and y move: the length is what the swim shader's `tailward`
 * weighting and the fork's own placement are both read against, and neither
 * should have to know that the body changed shape.
 */
function taperTail(geometry: BufferGeometry, taper: number): void {
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
    const narrow = 1 - taper * back * back;
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
 * Bakes counter-shading — dark back, bright belly — into vertex colours, with
 * a hue that turns over with the value: warm cream along the belly, the cool
 * of the water along the back, a tilt of a few percent between channels. The
 * material colour is the belly, so nothing in the buffer is secretly brighter
 * than the material says (the eye excepted; see {@link EYE_VALUE}).
 */
function countershade(geometry: BufferGeometry, { min, span }: VerticalExtent): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, (position.getY(i) - min) / span));
    const shade = 1 - (1 - BACK_SHADE) * smoothstep(BELLY_TOP, BACK_FROM, t);
    colors[i * 3] = shade * (1.02 - t * 0.07);
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade * (0.97 + t * 0.09);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Writes the eye onto whichever vertex is nearest the anchor on each side.
 *
 * The anchor is expressed as fractions of the body's own half-extents so it
 * survives the body being re-proportioned per species; the nearest vertex on
 * each side wins, which is stable because every body is mirror-symmetric
 * across x.
 */
function markEyes(geometry: BufferGeometry): void {
  const position = geometry.attributes.position;
  const color = geometry.attributes.color;
  if (!position || !color) {
    return;
  }

  let halfWidth = 0;
  let halfHeight = 0;
  let halfLength = 0;
  for (let i = 0; i < position.count; i++) {
    halfWidth = Math.max(halfWidth, Math.abs(position.getX(i)));
    halfHeight = Math.max(halfHeight, position.getY(i));
    halfLength = Math.max(halfLength, position.getZ(i));
  }

  for (const side of [-1, 1]) {
    const ax = side * halfWidth;
    const ay = halfHeight * EYE_RISE;
    const az = halfLength * EYE_FORWARD;

    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      // Its own side only. This also drops the two poles, whose x is exactly 0
      // and which would otherwise be eligible for both eyes at once.
      if (x * side <= 0) {
        continue;
      }
      const distance =
        (x - ax) ** 2 + (position.getY(i) - ay) ** 2 + (position.getZ(i) - az) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }

    if (best >= 0) {
      color.setXYZ(best, EYE_VALUE, EYE_VALUE, EYE_VALUE);
    }
  }
}
