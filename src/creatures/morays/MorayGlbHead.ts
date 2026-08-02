import { Bone, BufferGeometry, Float32BufferAttribute, Sphere, Vector3 } from "three";

/**
 * The sculpted hero head (`models/creature-moray-head.glb`), turned from the
 * atelier's contract into geometry a live archetype can wear.
 *
 * Everything here is the measured contract in `public/assets/models/
 * CREATURES.md`, resolved: the constants below are that file's numbers, and
 * the two ambiguities it flags are decided once, in {@link glbHeadScale} and
 * {@link prepareGlbHeadGeometry}, rather than per call site.
 *
 * All of it is pure geometry work on a *clone*. The library's cached geometry
 * is shared by every moray, every sanctuary resident and every portrait, and
 * two of the transforms here are per-archetype (the scale and the `v`
 * rescale) — so a copy is not caution, it is the only correct object to write
 * into. The clone belongs to its animal, which is also what lets the
 * sanctuary's `disposeSubtree` release it without touching the cache.
 */

/** Path under `public/assets/` the head is requested from. */
export const HEAD_MODEL_PATH = "models/creature-moray-head.glb";

/**
 * The neck ring's half-height in the file, in metres. The ring is an ellipse
 * (half-width 0.072 × half-height 0.080 — the same 0.9 lateral squash
 * `MorayBody` builds its tube with), so one measure fixes both axes.
 */
export const GLB_NECK_HALF_HEIGHT = 0.08;

/** The `v` band the file's UVs are baked to; the game's `neckV` replaces it. */
export const GLB_V_BAND = 0.12;

/** The `jaw` bone's hinge, on the model's z axis. */
export const GLB_JAW_HINGE_Z = 0.231;

/** The rest gape baked into the mesh; `-GLB_REST_GAPE` about x shuts it. */
export const GLB_REST_GAPE = (11 * Math.PI) / 180;

/**
 * The eye socket dish's centre, measured off the exported vertices (the
 * vertex nearest the sculpt's own `EYE_S = 0.44`, `EYE_PHI = 0.6π` in UV
 * space lands here). Mirrored in x for the two sides.
 */
export const GLB_SOCKET = new Vector3(0.0525, 0.0221, 0.312);

/**
 * The bead that sits in that socket, in model metres — radius 0.014 against
 * the dish's briefed ~0.012, so the ball fills the dish and stands a few
 * millimetres proud of it, which is what an eye under a brow does. This is
 * ambiguity #3 resolved the way the manifest recommends: scale the head
 * first, then size the eye to the socket the sculpt actually has, instead of
 * carrying over a bead sized for a primitive skull three times this one's
 * girth.
 */
export const GLB_EYE_RADIUS = 0.014;

/**
 * Where the nasal tubes leave the surface, and which way they point —
 * `NOSE_S = 0.12`, `NOSE_PHI = 0.72π` and the build script's flare direction,
 * converted to glTF axes. Only the species with raised appendages hang their
 * accent cones here; the sculpt's own small flared shells serve everyone.
 */
export const GLB_NOSTRIL = new Vector3(0.0285, 0.0247, 0.484);
export const GLB_NOSTRIL_DIRECTION = new Vector3(0.45, 0.7, 0.55).normalize();

/**
 * The neck cap the manifest calls deletable: a fan whose centre vertex sits
 * here, just inside whatever tube the head is grafted onto. Kept for a
 * standalone prop; stripped when grafting, which is the only way this module
 * is ever used.
 */
const NECK_CAP_CENTRE = new Vector3(0, 0, 0.008);
const NECK_CAP_EPSILON = 1e-3;

/**
 * Where the pale skin ends and the mouth lining begins, in linear luminance.
 *
 * The file's `COLOR_0` carries three things: a dorsal-to-belly skin gradient,
 * a ×0.88 occlusion dish in each socket, and a dark warm mouth lining. Only
 * the last survives the graft. The skin gradient is counter-shading, and
 * under a ramp counter-shading is a marking, not a second model of the light
 * — the painted albedo already carries the species' own, and multiplying the
 * two is the same double-modelling `MorayPattern`'s fallback was cured of in
 * WP-G6. The socket occlusion goes with it (it sits above this window),
 * because the eye bead fills the dish anyway. The lining stays because the
 * painted maps have no pixels for the inside of a mouth — `MorayHeadUv` says
 * as much — and an open mouth showing bright skin is a sock puppet.
 *
 * A window rather than a threshold, so the sculpt's skin-to-lining gradient
 * stays a gradient — but the window sits *above* every authored lining
 * value. The first cut lifted anything dark in proportion to its own
 * luminance, and the mouth's floor ledge (authored around 0.15) came out a
 * third of the way to white; multiplied by a cream species map that read as
 * a pale open maw, which head-on is the whole face. Below 0.30 the authored
 * colour now survives exactly.
 */
const SKIN_WINDOW_LOW = 0.3;
const SKIN_WINDOW_HIGH = 0.55;

export interface GlbHeadOptions {
  /** Uniform scale from model metres to the archetype's, from {@link glbHeadScale}. */
  readonly scale: number;
  /** The body tube's `v` at the root; see `MorayBodyGeometry.neckV`. */
  readonly neckV: number;
}

/**
 * Ambiguity #2, resolved for neck-girth continuity: the head is scaled so its
 * neck ellipse lands exactly on the tube's ring at the body root, because a
 * step where head meets body is a seam on the one animal the game asks the
 * player to stare at, while a head that runs longer than the primitive one
 * did is just a longer face. (The lateral axes agree by construction — the
 * file's 0.072/0.080 is the tube's own 0.9 squash.)
 */
export function glbHeadScale(neckRadius: number): number {
  return neckRadius / GLB_NECK_HALF_HEIGHT;
}

/**
 * How much of the sculpt's length the graft keeps, along z only.
 *
 * The cross-section is not free — the girth is the continuity above — but
 * the length is, because a z-only scale cannot move the neck ellipse. It is
 * spent because the two contracts disagree by construction: the sculpt is
 * proportionally slimmer than the game's animals (0.55 m of head on 0.16 m
 * of girth against the primitives' ~2:1), so girth-matched it runs 1.6–1.8×
 * the head length each archetype was composed with, and rendered at full
 * length the zebra's face filled half its own den arch. At 0.8 the heads
 * land 25–40% longer than the primitives — a real moray's long face, kept —
 * without the totem-pole read. The distortion this costs the sculpt was
 * looked at rather than assumed: the mouth corner steepens slightly and the
 * socket dish rounds, neither of which a probe frame can find.
 */
export const GLB_LENGTH_TRIM = 0.8;

/**
 * A clone of the library's head geometry, fitted to one archetype.
 *
 * Four transforms, in the order that keeps each one simple:
 * - the neck-cap fan is stripped (every triangle touching its centre vertex);
 * - `v` is rescaled from the baked 0.12 band to the archetype's own `neckV`,
 *   which is a plain linear scale because both are linear in the same `s`;
 * - the scale is baked into the positions rather than carried on the node,
 *   so the outline hull's constant push means one width in every direction
 *   and the skeleton can be authored in the same metres as the mesh;
 * - `COLOR_0` is flattened into a mouth-lining multiplier (see
 *   {@link SKIN_KNEE}).
 */
export function prepareGlbHeadGeometry(
  source: BufferGeometry,
  { scale, neckV }: GlbHeadOptions,
): BufferGeometry {
  const geometry = source.clone();

  stripNeckCap(geometry);

  const uv = geometry.getAttribute("uv");
  if (uv) {
    const rescale = neckV / GLB_V_BAND;
    for (let i = 0; i < uv.count; i++) {
      uv.setY(i, uv.getY(i) * rescale);
    }
    uv.needsUpdate = true;
  }

  geometry.scale(scale, scale, scale * GLB_LENGTH_TRIM);
  flattenSkinColour(geometry);

  // An explicit sphere with slack, for the same reason the body carries one:
  // three bounds a skinned mesh once, from whichever pose the jaw is in at
  // the first draw. The gape can drop the chin a few centimetres past the
  // rest silhouette, so the rest bounds get a margin instead of a recompute.
  geometry.computeBoundingSphere();
  const bounds = geometry.boundingSphere ?? new Sphere(new Vector3(), scale);
  bounds.radius *= 1.2;

  return geometry;
}

/**
 * The two-bone chain the file's skin weights index: slot 0 the root at the
 * origin, slot 1 the jaw on the hinge. The bones are authored unrotated —
 * the glTF node's own "local +Y is model +X" frame is the exporter's, not a
 * contract the skin needs — so opening the jaw is simply a positive rotation
 * about the bone's x, the hinge axis the manifest states.
 *
 * @param scale The same scale baked into the geometry, so the hinge sits on
 * the sculpted jaw line — through {@link GLB_LENGTH_TRIM}, exactly as the
 * vertices went — whatever archetype is wearing it.
 */
export function buildGlbHeadSkeleton(scale: number): { root: Bone; jaw: Bone } {
  const root = new Bone();
  const jaw = new Bone();
  jaw.position.set(0, 0, GLB_JAW_HINGE_Z * scale * GLB_LENGTH_TRIM);
  root.add(jaw);
  return { root, jaw };
}

/** Drops every triangle that touches the neck-cap fan's centre vertex. */
function stripNeckCap(geometry: BufferGeometry): void {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!position || !index) {
    return;
  }

  const centres = new Set<number>();
  for (let i = 0; i < position.count; i++) {
    const dx = position.getX(i) - NECK_CAP_CENTRE.x;
    const dy = position.getY(i) - NECK_CAP_CENTRE.y;
    const dz = position.getZ(i) - NECK_CAP_CENTRE.z;
    if (Math.hypot(dx, dy, dz) < NECK_CAP_EPSILON) {
      centres.add(i);
    }
  }
  if (centres.size === 0) {
    return;
  }

  const kept: number[] = [];
  for (let tri = 0; tri < index.count; tri += 3) {
    const a = index.getX(tri);
    const b = index.getX(tri + 1);
    const c = index.getX(tri + 2);
    if (!centres.has(a) && !centres.has(b) && !centres.has(c)) {
      kept.push(a, b, c);
    }
  }
  geometry.setIndex(kept);
}

/** See {@link SKIN_WINDOW_LOW}. Writes a float RGB multiplier over the file's colour. */
function flattenSkinColour(geometry: BufferGeometry): void {
  const colour = geometry.getAttribute("color");
  if (!colour) {
    return;
  }

  const flattened = new Float32Array(colour.count * 3);
  for (let i = 0; i < colour.count; i++) {
    // `getComponent` denormalizes the file's uint16 channels itself.
    const r = colour.getComponent(i, 0);
    const g = colour.getComponent(i, 1);
    const b = colour.getComponent(i, 2);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const t = Math.min(
      1,
      Math.max(0, (luminance - SKIN_WINDOW_LOW) / (SKIN_WINDOW_HIGH - SKIN_WINDOW_LOW)),
    );
    const toWhite = t * t * (3 - 2 * t);
    flattened[i * 3] = r + (1 - r) * toWhite;
    flattened[i * 3 + 1] = g + (1 - g) * toWhite;
    flattened[i * 3 + 2] = b + (1 - b) * toWhite;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(flattened, 3));
}
