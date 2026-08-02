import { BufferAttribute, BufferGeometry } from "three";
import { Random } from "../../util/Random";

/**
 * The body every fish species is built from: one lofted tube, re-proportioned
 * per species.
 *
 * The old body was `SphereGeometry(0.13, 6, 5)` with two cone blades merged on
 * for a tail — a measured decision (3.0ms at 48 triangles against 5.5ms at 80
 * on the software rasteriser) from the single-species school, and it read as
 * exactly what it was: a lozenge with a propeller. The owner's bar for this
 * wave is sculpted animals, so the sphere is gone. The replacement is the
 * atelier's own pattern (the shrimp's, one size up): a tube whose rings are
 * *authored stations* — pointed snout, gill fullness, an arched shoulder,
 * a rear taper, a caudal peduncle — with the dorsal fin lofted out of the
 * rings' top vertex (a sail with real surface, not a stuck-on sheet) and the
 * tail as a crescent ring whose lobes sweep back past a recessed web: a
 * forked silhouette that is solid from every side, which a single-sided blade
 * never is. Two pectoral blades ride the shoulders as double-wound quads.
 *
 * 104 triangles, against the brief's 110 ceiling. The old arithmetic is
 * honoured rather than forgotten: that is +44 over the 60 it replaces,
 * ~+3.4ms at SwiftShader's ≈0.5ms/k across the 152 instances — a real cost on
 * the software rasteriser and nothing on hardware (60fps vsync), which is the
 * trade the wave brief sanctions. Everything stays indexed by construction:
 * there is no merge at all, so the silent-merge-failure that once took every
 * fish's tail is a class of bug this file no longer contains.
 *
 * Diversity still lives in the *proportions* — a tang is the same 58 vertices
 * as a fusilier, squashed flat and pulled tall under a taller sail — which is
 * what keeps five species from costing five times one.
 */
export interface FishBodyProfile {
  /** Scale across the body; small is laterally flat. */
  readonly width: number;
  /** Scale up the body; large is deep-bodied. */
  readonly height: number;
  /** Scale along the body; large is slender. */
  readonly length: number;
  /**
   * Rear-body girth control, eased in over the back half. The authored tube
   * already carries a real peduncle (it is drawn at taper 0.45), so this is
   * a *re-basing*: 0.45 is the body as drawn, less is fuller, more is leaner.
   */
  readonly tailTaper: number;
  /** Dorsal sail height multiplier: 1 is the authored fin, 0 removes it. */
  readonly dorsal: number;
  /** Pectoral blade reach, in body half-widths; 0 removes the blades. */
  readonly pectoral: number;
  readonly tail: TailProfile;
  /**
   * PRNG stream for the paint jitter (a ±0.02 value wobble that keeps the
   * counter-shading from reading machine-perfect). Absent pins it to zero.
   */
  readonly paintSeed?: number;
}

/**
 * The tail's crescent ring, in the body's own normalised units (1 = one body
 * half-extent). The web sits forward at `notch` while the two lobes sweep
 * back to `reach` — the fork is the gap between them.
 */
export interface TailProfile {
  /** Lobe tips along -z; 1.55 ≈ the old fork's tip on the fusilier. */
  readonly reach: number;
  /** Each lobe's vertical half-height, in body half-heights. */
  readonly lobe: number;
  /** The notch (and web) along -z; nearer `reach` is a shallower fork. */
  readonly notch: number;
}

/** The unit the loft is authored against; profiles scale it, nothing resizes it. */
export const FISH_BODY_RADIUS = 0.13;

/**
 * Where the pale underside ends and the dark back begins, up the body.
 *
 * Two plateaus with a short crossing between them, not a straight ramp: at the
 * size these animals are drawn a gradient averages into a single mid tone, and
 * the window sits at the flank's midline, which is where a counter-shaded fish
 * actually turns over. Shared by every species, because it is a property of
 * the geometry the marking lives on, not of the animal.
 */
const BELLY_TOP = 0.42;
const BACK_FROM = 0.72;

/**
 * How far the back is taken down from the belly's value. 0.78 for every
 * species, and the restraint is the point: under a ramp, counter-shading is a
 * marking, not a second model of the light (measured on the fusilier, WP-G8).
 */
const BACK_SHADE = 0.78;

/**
 * The eye: one vertex per cheek, and the only thing here allowed above 1.
 *
 * A lozenge has no front; an eye is the one mark that says which end is which.
 * It sits on the head ring's *lower* cheek because the cameras sit below the
 * shoals — the frame is mostly underside — and 1.5 is a highlight against a
 * ramp that is itself capped at 1, not a global brightening hidden in a
 * vertex buffer.
 */
const EYE_VALUE = 1.5;

/** The authored taper the loft is drawn with; profiles re-base around it. */
const TAPER_BASE = 0.45;

/** Columns around the tube. j = 0 is the top, 2 the +x side, 4 the belly. */
const COLS = 8;

/**
 * The body stations, nose to peduncle, in normalised units: the unscaled body
 * spans z ∈ [-1, +1] as the sphere did, so the profiles' old numbers keep
 * their meaning. `fin` is the dorsal sail's rise above the spine at that
 * station (before the species' `dorsal` multiplier).
 */
const RINGS: readonly { z: number; hw: number; hh: number; cy: number; fin: number }[] = [
  { z: 0.96, hw: 0.1, hh: 0.13, cy: 0.03, fin: 0 }, // snout band
  { z: 0.66, hw: 0.38, hh: 0.48, cy: 0.05, fin: 0 }, // head and gills
  { z: 0.18, hw: 0.5, hh: 0.64, cy: 0.1, fin: 0.42 }, // shoulder; sail peak
  { z: -0.55, hw: 0.28, hh: 0.36, cy: 0.06, fin: 0.16 }, // rear taper; sail falls
  { z: -0.9, hw: 0.15, hh: 0.17, cy: 0.02, fin: 0 }, // caudal peduncle
];

/** Nose pole, slightly ahead of the snout band: a point, not a flat cap. */
const NOSE_TIP = 1.06;
/** Half-thickness of the tail blade's edge columns. */
const TAIL_WEB = 0.09;

/** The ring the eye and the pectoral root are read from: the head. */
const HEAD_RING = 1;
/** The ring the pectoral blade roots against: the shoulder. */
const SHOULDER_RING = 2;

/**
 * A laterally-compressed fish, nose along +Z, proportioned by the profile.
 *
 * Counter-shading and the eye are baked into vertex colours here so every
 * species carries them for free — no texture, no second draw call. The whole
 * animal is one indexed geometry built in normalised units and scaled at the
 * end, exactly as the sphere was, so the swim shader's `-z` tailward
 * weighting and every species' tuned numbers go on meaning what they meant.
 */
export function createFishGeometry(profile: FishBodyProfile): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  // The nose pole, then RINGS.length ring stations, then the tail's crescent
  // ring, then the web pole. Rings are laid nose to tail so the strip between
  // ring i and i + 1 faces outward with the winding below.
  positions.push(0, 0.03, NOSE_TIP);
  for (const ring of RINGS) {
    const back = Math.min(1, Math.max(0, -ring.z));
    const narrow = 1 - (profile.tailTaper - TAPER_BASE) * back * back;
    for (let j = 0; j < COLS; j++) {
      const theta = (j / COLS) * Math.PI * 2;
      const fin = j === 0 ? ring.fin * profile.dorsal : 0;
      positions.push(
        ring.hw * narrow * Math.sin(theta),
        ring.cy + ring.hh * narrow * Math.cos(theta) + fin,
        ring.z,
      );
    }
  }
  const crescentBase = 1 + RINGS.length * COLS;
  pushCrescent(positions, profile.tail);
  const tailPole = positions.length / 3;
  positions.push(0, 0, -(profile.tail.notch + 0.02));

  // Nose fan (outward is +z here), ring strips, then the web fan (-z).
  for (let j = 0; j < COLS; j++) {
    indices.push(0, 1 + j, 1 + ((j + 1) % COLS));
  }
  for (let i = 0; i < RINGS.length - 1; i++) {
    const a = 1 + i * COLS;
    const b = a + COLS;
    for (let j = 0; j < COLS; j++) {
      const next = (j + 1) % COLS;
      indices.push(a + j, a + next, b + j);
      indices.push(a + next, b + next, b + j);
    }
  }
  const lastRing = 1 + (RINGS.length - 1) * COLS;
  for (let j = 0; j < COLS; j++) {
    const next = (j + 1) % COLS;
    indices.push(lastRing + j, lastRing + next, crescentBase + j);
    indices.push(lastRing + next, crescentBase + next, crescentBase + j);
  }
  for (let j = 0; j < COLS; j++) {
    indices.push(tailPole, crescentBase + j, crescentBase + ((j + 1) % COLS));
  }

  appendPectorals(positions, indices, profile);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);

  // Colour in normalised space (the gradient is indifferent to the scale),
  // shaded against the body's own extent so the sail and lobes run past it.
  countershade(geometry, bodyExtent());
  if (profile.paintSeed !== undefined) {
    jitter(geometry, new Random(profile.paintSeed));
  }
  markEyes(geometry);

  geometry.scale(
    FISH_BODY_RADIUS * profile.width,
    FISH_BODY_RADIUS * profile.height,
    FISH_BODY_RADIUS * profile.length,
  );
  // After the scale, so the normals are true for the body as drawn rather
  // than transformed from the unit tube.
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The tail ring: a crescent, not a cone. The lobes sweep back to `reach` at
 * top and bottom while the web between them stops forward at `notch`, so the
 * fork is a silhouette cut into a solid ring — visible from every side,
 * which the old cone pair was only ever lucky about.
 */
function pushCrescent(positions: number[], tail: TailProfile): void {
  const { reach, lobe, notch } = tail;
  const mid = notch + (reach - notch) * 0.45;
  // The columns between the lobes are kept low and their z pulled forward:
  // the membrane reads as a thin recessed web between two distinct blades,
  // not a solid fan wearing the fork as a hemline.
  const columns: readonly (readonly [number, number, number])[] = [
    [0, lobe, -reach],
    [TAIL_WEB, lobe * 0.3, -mid],
    [TAIL_WEB * 1.2, 0, -notch],
    [TAIL_WEB, -lobe * 0.3, -mid],
    [0, -lobe, -reach],
    [-TAIL_WEB, -lobe * 0.3, -mid],
    [-TAIL_WEB * 1.2, 0, -notch],
    [-TAIL_WEB, lobe * 0.3, -mid],
  ];
  for (const [x, y, z] of columns) {
    positions.push(x, y, z);
  }
}

/**
 * The pectoral pair: one quad blade per side, wound both ways (four triangles
 * the pair), so the thin membrane is never backface-culled whichever side the
 * camera sits on — the ray's `DoubleSide` ribbon trick, without the material.
 */
function appendPectorals(positions: number[], indices: number[], profile: FishBodyProfile): void {
  if (profile.pectoral <= 0) {
    return;
  }
  const shoulder = RINGS[SHOULDER_RING]!;
  const pec = profile.pectoral;
  for (const side of [-1, 1]) {
    const base = positions.length / 3;
    const x = side * (shoulder.hw + 0.005);
    positions.push(
      x, shoulder.cy - 0.02, shoulder.z + 0.02, // root, leading
      x, shoulder.cy - 0.08, shoulder.z - 0.1, // root, trailing
      side * (shoulder.hw + pec * 0.5), shoulder.cy - pec * 0.26, shoulder.z - 0.1 - pec * 0.5,
      side * (shoulder.hw + pec * 0.44), shoulder.cy - pec * 0.18, shoulder.z + 0.02 - pec * 0.38,
    );
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
}

/** The vertical span the counter-shading gradient is read across. */
interface VerticalExtent {
  readonly min: number;
  readonly span: number;
}

/**
 * The body's own extent, from the authored stations rather than a vertex scan:
 * the dorsal sail and the tail lobes reach *past* the body proper, and an
 * extent that included them would drag the flank's turnover off the midline
 * (the old code shaded the fork against the body for the same reason).
 */
function bodyExtent(): VerticalExtent {
  let min = Infinity;
  let max = -Infinity;
  for (const ring of RINGS) {
    min = Math.min(min, ring.cy - ring.hh);
    max = Math.max(max, ring.cy + ring.hh);
  }
  return { min, span: Math.max(1e-5, max - min) };
}

/**
 * Bakes counter-shading — dark back, bright belly — into vertex colours, with
 * a hue that turns over with the value: warm cream along the belly, the cool
 * of the water along the back. Read against the body's own extent, so the
 * sail continues darkening past the spine (a real dorsal's dark edge) and the
 * tail's lower lobe pales like a second belly. The material colour is the
 * belly, so nothing in the buffer is secretly brighter than the material says
 * (the eye excepted; see {@link EYE_VALUE}).
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
 * A ±0.02 value wobble, one draw per vertex, all three channels together so
 * it moves value and never hue. Under the toon ramp it nudges where fragments
 * cross a band boundary — the difference between a printed gradient and a
 * machine one. Seeded by the species, so two builds agree bit for bit.
 */
function jitter(geometry: BufferGeometry, rng: Random): void {
  const color = geometry.attributes.color;
  if (!color) {
    return;
  }
  for (let i = 0; i < color.count; i++) {
    const wobble = rng.signed(0.02);
    color.setXYZ(i, color.getX(i) + wobble, color.getY(i) + wobble, color.getZ(i) + wobble);
  }
}

/**
 * Writes the eye onto the head ring's two lower cheeks — deterministic
 * vertices, not a nearest-vertex search: the loft has a real head station, so
 * the anchor arithmetic the sphere needed is gone. Lower rather than upper
 * cheek because the cameras sit below the shoals; see {@link EYE_VALUE}.
 */
function markEyes(geometry: BufferGeometry): void {
  const color = geometry.attributes.color;
  if (!color) {
    return;
  }
  const headRing = 1 + HEAD_RING * COLS;
  color.setXYZ(headRing + 3, EYE_VALUE, EYE_VALUE, EYE_VALUE);
  color.setXYZ(headRing + 5, EYE_VALUE, EYE_VALUE, EYE_VALUE);
}
