import { BufferAttribute, PlaneGeometry } from "three";
import { fbm } from "../rendering/ProceduralTexture";
import { Random, SEEDS } from "../util/Random";
import { canyonBlend, canyonTarget } from "./Abyss";

/**
 * Gentle dunes, as layered sines rather than noise so the shape is exactly
 * reproducible and cheap to sample from anywhere.
 *
 * Amplitude is deliberately small. The diver's floor, the rock placements and
 * the crevice mounds were all authored against a flat seabed, so the dunes have
 * to read as relief without lifting anything off the ground or poking through
 * the camera's minimum height.
 */
function dunes(x: number, z: number): number {
  return (
    0.34 * Math.sin(x * 0.075) * Math.cos(z * 0.065) +
    0.18 * Math.sin(x * 0.19 + 1.3) * Math.cos(z * 0.17) +
    0.07 * Math.sin(x * 0.41) * Math.sin(z * 0.35 + 0.6)
  );
}

/**
 * The hollows and swells laid over the dunes, and where they are forbidden.
 *
 * Three sines give the seabed a shape but not a *surface*: they are smooth at
 * every scale the camera can see, so a flat plane sitting in one shading band
 * reads as one shading band however it is painted. This is the octave the sines
 * cannot supply — a couple of metres across and a hand's depth — and it is what
 * puts a lip in front of a rubble field and a shallow bowl between two bommies.
 *
 * What it is not allowed to do is move the ground under the game. Every crevice
 * is placed to the centimetre against a raycast, the diver's spawn line is flown
 * blind down `x = 0`, and the four moray heads sit barely a metre over the sand:
 * lifting the floor a hand's width under any of them is a gameplay change that
 * no screenshot can distinguish from an art one. So the relief is multiplied by
 * a mask that is *exactly* zero out to {@link RELIEF_CLEAR}, which makes
 * `seabedHeight` bit-identical to the function it replaces everywhere that
 * matters — by construction rather than by a tolerance.
 * `tests/seabedRelief.test.ts` holds that against a table of literals.
 */
const RELIEF_AMPLITUDE = 0.1;

/**
 * Lattice scale, in UV units per metre. At {@link RELIEF_PERIOD} the coarsest
 * octave is a swell about nine metres across and the finest a little over two —
 * comfortably above the seabed mesh's own 0.94 m grid, which is the resolution
 * ceiling on anything written into this function.
 */
const RELIEF_SCALE = 0.014;
const RELIEF_PERIOD = 8;

/** Metres of exact silence around a protected place, and the ramp out of it. */
const RELIEF_CLEAR = 6;
const RELIEF_FADE = 10;

/**
 * The four crevice mouths, copied from `SPOT_PLACEMENTS` in `Reef.ts`.
 *
 * Copied rather than imported: `Reef` imports this module for every rock,
 * mound and blade it plants, so reaching back the other way would close a
 * cycle around the one function the whole world's geometry is derived from.
 * These four numbers have not moved since the reef was authored and they are
 * frozen — if they ever do move, the guard test fails loudly, which is the
 * behaviour worth having here.
 */
const PROTECTED_SPOTS: readonly (readonly [number, number])[] = [
  [0, 1.5],
  [-13, 6],
  [13, 6],
  [-6, -9],
];

/** The line the diver spawns on and flies straight down, from `z` to the reef. */
const SPAWN_CORRIDOR = { x: 0, fromZ: 1.5, toZ: 24 } as const;

function microRelief(x: number, z: number): number {
  const n = fbm(x * RELIEF_SCALE, z * RELIEF_SCALE, {
    seed: SEEDS.seabedRelief,
    period: RELIEF_PERIOD,
    octaves: 3,
  });
  return (n - 0.5) * 2 * RELIEF_AMPLITUDE;
}

// ─── W-L9: the amphitheatre ──────────────────────────────────────────────────
//
// The bowl used to be a plate: camera, horizon and every rock foot on one
// plane, and distance dissolving into flat fog with nothing to close it. This
// is the macro octave the relief above deliberately stays under — a rim ridge
// that sweeps the seabed up toward the arena's edge, two elevated shelves in
// the mid-field and one gentle hollow, so a frame finally has a low foreground
// and a high background to compose between.
//
// It rides the same protection mask as the micro relief, which is the whole of
// the safety argument: everywhere the game is placed, `seabedHeight` still
// early-returns the bare dunes, bit-identical, and `tests/seabedRelief.test.ts`
// still holds that against its table of literals. Everything *planted* on the
// seabed samples this function at construction, so rocks, coral, kelp, grass,
// rubble and the fauna's homes all follow the new ground automatically.

/**
 * Where the rim ridge stands, radially from the world origin.
 *
 * The rise starts just inside the reef's ±30 swim box — the ridge is meant to
 * be *arrived at*, not merely seen — and `Reef` rings the crest with colliders
 * so the diver is turned away before the floor climbs past the swim volume's
 * own floor. It falls back to dune level before the seabed plane ends at ±45,
 * so the far corners of the sand sheet stay flat under the painted distance.
 */
const RIM_FROM = 26;
const RIM_CREST = 33;
const RIM_FALL_FROM = 37;
const RIM_END = 45;

/** Metres of ridge at the crest, before the azimuthal variation. */
const RIM_BASE = 3.3;

/**
 * The ridge's skyline, as a short seeded Fourier series over azimuth.
 *
 * Harmonics rather than fbm because the profile has to be exactly 2π-periodic
 * — a noise seam at one azimuth is a cliff in the skyline — and because four
 * sine terms are something a test can bound without re-implementing a noise
 * lattice. Low orders only: a rim is a landform, and detail finer than a
 * pinnacle's width belongs to the rocks standing on it, not to the ground.
 */
const RIM_HARMONICS: readonly { k: number; amp: number; phase: number }[] = (() => {
  const random = new Random(SEEDS.bowlRim);
  return [2, 3, 5, 7].map((k, i) => ({
    k,
    // Coarse swells carry more height than fine ones, and the total swing
    // stays inside ±RIM_VARY so the test's envelope holds by arithmetic.
    amp: random.range(0.45, 0.75) * [1, 0.7, 0.45, 0.3][i]!,
    phase: random.range(0, Math.PI * 2),
  }));
})();

/** Upper bound on the harmonics' total swing; the guard test leans on it. */
export const RIM_VARY = RIM_HARMONICS.reduce((sum, h) => sum + h.amp, 0);

/**
 * The mid-field features. Authored, not scattered — each one is a composition
 * decision about a canonical camera, and each stands clear of every crevice
 * ring (the mask enforces that regardless), every approach corridor, and far
 * enough from the anemone disc at (7.5, 8.5) that nothing there floats.
 *
 * The shelf under the deep-south coral garden is the point of the exercise:
 * shot A's background layer rides up a metre and a quarter, which is what
 * "background-high" means when everything samples this function.
 */
export interface TerrainFeature {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  /** Positive lifts a shelf; negative sinks a hollow. */
  readonly height: number;
}

export const TERRAIN_FEATURES: readonly TerrainFeature[] = [
  /** The deep-south terrace: lifts the z ≈ -19 coral garden and kelp. */
  { x: 4, z: -19, radius: 8, height: 1.25 },
  /** The north-west bench, under the kelp stand at (-16, 14). */
  { x: -19, z: 13, radius: 6, height: 1.05 },
  /** The hollow in shot A's right mid-ground; rubble and grass ride into it. */
  { x: 13, z: 14, radius: 4.8, height: -0.5 },
];

/** Flat-topped dome: 1 out to a third of the radius, C1 down to 0 at the rim. */
function dome(distance: number, radius: number): number {
  return 1 - smoothstep01((distance / radius - 0.35) / 0.65);
}

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

function rimProfile(r: number): number {
  const up = smoothstep01((r - RIM_FROM) / (RIM_CREST - RIM_FROM));
  const down = 1 - smoothstep01((r - RIM_FALL_FROM) / (RIM_END - RIM_FALL_FROM));
  return up * down;
}

function macroRelief(x: number, z: number): number {
  let height = 0;

  const r = Math.hypot(x, z);
  if (r > RIM_FROM && r < RIM_END) {
    const theta = Math.atan2(z, x);
    let skyline = RIM_BASE;
    for (const harmonic of RIM_HARMONICS) {
      skyline += harmonic.amp * Math.sin(harmonic.k * theta + harmonic.phase);
    }
    height += rimProfile(r) * skyline;
  }

  for (const feature of TERRAIN_FEATURES) {
    const distance = Math.hypot(x - feature.x, z - feature.z);
    if (distance < feature.radius) {
      height += feature.height * dome(distance, feature.radius);
    }
  }

  return height;
}
// ─── end W-L9 ────────────────────────────────────────────────────────────────

/** Distance to the nearest place the relief is not allowed to touch. */
function distanceToProtected(x: number, z: number): number {
  const alongCorridor = Math.max(SPAWN_CORRIDOR.fromZ, Math.min(SPAWN_CORRIDOR.toZ, z));
  let nearest = Math.hypot(x - SPAWN_CORRIDOR.x, z - alongCorridor);

  for (const [spotX, spotZ] of PROTECTED_SPOTS) {
    const distance = Math.hypot(x - spotX, z - spotZ);
    if (distance < nearest) {
      nearest = distance;
    }
  }

  return nearest;
}

export function seabedHeight(x: number, z: number): number {
  const base = dunes(x, z);
  const mask = reliefFalloff(distanceToProtected(x, z));
  // Returned rather than added at zero, so that "bit-identical" is something
  // the code says and not something floating point happens to agree with.
  const bowl = mask === 0 ? base : base + (microRelief(x, z) + macroRelief(x, z)) * mask;

  // W-M3: the canyon past the rim. Blended *toward* an authored floor rather
  // than added, so the walls are the transition between the rim's terrain and
  // the canyon's — and gated the same way the protection mask is: a weight of
  // exactly zero returns the bowl's own answer untouched, which is the whole
  // of the bit-identity argument for every height inside the bowl.
  const carve = canyonBlend(x, z);
  return carve === 0 ? bowl : bowl + carve * (canyonTarget(x, z) - bowl);
}

function reliefFalloff(distance: number): number {
  const t = Math.min(1, Math.max(0, (distance - RELIEF_CLEAR) / (RELIEF_FADE - RELIEF_CLEAR)));
  return t * t * (3 - 2 * t);
}

/**
 * A dune-displaced ground plane, already rotated into the XZ plane.
 * `lift` raises the whole sheet, which the caustics overlay uses to sit just
 * clear of the sand it is projected onto.
 */
export interface ContactPatch {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly strength: number;
}

/**
 * Bakes soft occlusion into the seabed's vertex colours: dune troughs sit in
 * shade, and everything resting on the sand gets a contact ring beneath it.
 *
 * A contact shadow is what visually attaches an object to the ground. Without
 * one, rocks and coral read as decals hovering above the seabed no matter how
 * well the sand itself is textured — and shadow mapping alone will not supply
 * it for the many objects here that deliberately do not cast.
 */
export function bakeSeabedOcclusion(
  geometry: PlaneGeometry,
  contacts: readonly ContactPatch[],
): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);

    // Troughs of the dune field hold a little more shade than the crests.
    // Clamped to the dune-and-relief range: the W-L9 rim is metres tall, and a
    // slope-shading term sized for hand-depth hollows has nothing true to say
    // at that scale — the lights and the fog already carry the ridge.
    const relief = Math.min(0.8, Math.max(-0.8, seabedHeight(x, z)));
    let shade = 0.9 + relief * 0.22;

    for (const contact of contacts) {
      const distance = Math.hypot(x - contact.x, z - contact.z);
      if (distance < contact.radius) {
        const falloff = 1 - distance / contact.radius;
        shade *= 1 - contact.strength * falloff * falloff;
      }
    }

    const value = Math.max(0.25, Math.min(1.2, shade));
    colors[i * 3] = value;
    colors[i * 3 + 1] = value;
    colors[i * 3 + 2] = value;
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

export function createSeabedGeometry(size: number, segments: number, lift = 0): PlaneGeometry {
  const geometry = new PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  if (position) {
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      position.setY(i, seabedHeight(x, z) + lift);
    }
    position.needsUpdate = true;
  }
  geometry.computeVertexNormals();

  return geometry;
}
