import type { Camera, PlaneGeometry, Scene } from "three";
import { fbm } from "../rendering/ProceduralTexture";
import { Random, SEEDS } from "../util/Random";

/**
 * The second biome (W-M3): one pass through W-L9's rim and the twilight
 * canyon beyond it, described in one place so that the terrain carve, the
 * colliders, the mood modulation and the den all agree about where "beyond"
 * is by construction rather than by four copies of an angle.
 *
 * Everything radial here is measured from the world origin, like the rim it
 * cuts through. The whole biome is a wedge: a seeded azimuth, a floor band
 * either side of it, and walls easing back up to the rim's own skyline at the
 * wedge's edge. Outside the wedge — and everywhere inside the bowl — every
 * function in this module returns *exactly* zero, in the early-return style
 * `Seabed`'s protection mask established: bit-identity with the shipped bowl
 * is something the code says, not something floating point happens to agree
 * with. `tests/abyssBiome.test.ts` holds that.
 *
 * ## Where the gate landed, and why the draw band is narrow
 *
 * The azimuth is drawn from `SEEDS.abyss` inside [0.78, 0.99] rad (45–57°,
 * north-east), and the band is doing three jobs at once. Every canonical
 * camera looks south or south-west, so a north-east gate is outside every
 * canonical frustum and the in-bowl shot set stays bit-identical. The seabed
 * sheet is ±45 m, so a carve that runs to r = 50 only fits where the sheet is
 * diagonal — at the band's edges the sheet ends at r ≈ 50.2, which is why
 * {@link CARVE_END} is 50 and the band is no wider. And the spawn corridor's
 * own protection notch sits at 90°, far enough that the two masks can never
 * overlap. The drawn value is 0.7901 rad (45.3°).
 */

/** The gate's azimuth, in `atan2(z, x)` terms. */
export const GATE_AZIMUTH = new Random(SEEDS.abyss).range(0.78, 0.99);

/** Unit direction down the canyon's axis, out from the world origin. */
export const GATE_AXIS = {
  x: Math.cos(GATE_AZIMUTH),
  z: Math.sin(GATE_AZIMUTH),
} as const;

/**
 * The wedge, in radians either side of the axis: flat floor inside
 * {@link FLOOR_HALF}, walls easing back to the rim's own terrain by
 * {@link WEDGE_HALF}, and nothing at all beyond it.
 */
export const FLOOR_HALF = 0.13;
export const WEDGE_HALF = 0.32;

/**
 * The radial envelope. The carve eases in through the rim band — which is
 * what turns the ridge into a saddle rather than a cliff — and eases out
 * again by {@link CARVE_END}, safely inside the seabed sheet at every wedge
 * azimuth. The far end's rise back to dune level is masked by the silhouette
 * curtains and the canyon's own fog; see `AbyssFlora`.
 */
const CARVE_FROM = 29.5;
const CARVE_FULL = 33.5;
const CARVE_FADE_FROM = 46;
export const CARVE_END = 50;

/** Where the descending shelf runs, and how deep the twilight floor lands. */
const SILL_DEPTH = -2.2;
const FLOOR_DEPTH = -8.4;
const SHELF_FROM = 36;
const SHELF_TO = 44;

/** Hand-depth detail on the canyon floor, so twilight sand is not a plane. */
const DETAIL_AMPLITUDE = 0.3;
const DETAIL_SCALE = 0.02;

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** Shortest angular distance between two azimuths, in [0, π]. */
function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}

/**
 * How much of the canyon owns a point, in [0, 1]: 1 on the floor band, easing
 * to exactly 0 at the wedge's edges and outside the radial envelope.
 *
 * `Seabed.seabedHeight` blends its own answer toward {@link canyonTarget} by
 * this weight, so w = 0 is the bowl unchanged to the bit and w = 1 is the
 * authored canyon floor exactly, with the walls living in between.
 */
export function canyonBlend(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= CARVE_FROM || r >= CARVE_END) {
    return 0;
  }
  const away = angleBetween(Math.atan2(z, x), GATE_AZIMUTH);
  if (away >= WEDGE_HALF) {
    return 0;
  }

  const across = 1 - smoothstep01((away - FLOOR_HALF) / (WEDGE_HALF - FLOOR_HALF));
  const inward = smoothstep01((r - CARVE_FROM) / (CARVE_FULL - CARVE_FROM));
  const outward = 1 - smoothstep01((r - CARVE_FADE_FROM) / (CARVE_END - CARVE_FADE_FROM));
  return across * inward * outward;
}

/**
 * The floor the canyon is carved toward: a shallow saddle through the notch,
 * one long descending shelf, and a twilight floor six to eight metres below
 * dune level, with its own hand-depth of seeded detail. Sampled by position
 * so the seabed mesh, the rubble, the den and the flora all land on the same
 * ground — the same one-function contract the bowl's terrain keeps.
 */
export function canyonTarget(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const shelf = smoothstep01((r - SHELF_FROM) / (SHELF_TO - SHELF_FROM));
  const sill = smoothstep01((r - CARVE_FROM) / (SHELF_FROM - CARVE_FROM));
  const detail =
    (fbm(x * DETAIL_SCALE, z * DETAIL_SCALE, {
      seed: SEEDS.abyss ^ 0x7e1f,
      period: 8,
      octaves: 2,
    }) -
      0.5) *
    2 *
    DETAIL_AMPLITUDE;
  return sill * SILL_DEPTH + shelf * (FLOOR_DEPTH - SILL_DEPTH) + detail * shelf;
}

// ─── The wall strata (W-N1) ──────────────────────────────────────────────────
//
// The carve gave the canyon its shape and nothing else: one wash of sand from
// the rim's shoulder to the twilight floor, which the round critic read as "a
// single flat mauve-brown value". A drawn cliff is bands of geology, so the
// walls take three value bands baked into the seabed's vertex colours — the
// same channel the occlusion bake already writes — as per-channel multipliers
// on the sand wash. The bands follow *elevation*, because strata do; their
// edges are jittered by a seeded fbm so no boundary is a ruled line; and the
// whole deviation is scaled by `canyonBlend`, so at the wedge's edges and
// everywhere in the bowl the multiplier is exactly identity and the bowl's
// bake is bit-identical by construction.
//
// The palette follows the value key: every band leans violet (red held above
// green), nothing approaches black, and the deepest band still multiplies the
// wash to a colour — a violet-grey stone, not a hole.

/** Elevation bands, top down: [above this y, tint]. Metres of world height. */
const STRATA_BANDS: readonly { readonly floor: number; readonly tint: readonly [number, number, number] }[] = [
  { floor: -0.9, tint: [1, 1, 1] },
  { floor: -3.6, tint: [0.88, 0.8, 1.0] },
  { floor: -6.3, tint: [0.68, 0.6, 0.96] },
  { floor: -Infinity, tint: [0.54, 0.48, 0.88] },
];

/** Metres over which one band blends into the next; under this it aliases. */
const STRATA_BLEND = 1.3;

/** Metres of seeded wander on every band edge, so no stratum is a ruled line. */
const STRATA_JITTER = 1.3;

/**
 * Within-band mottle (W-O1). The look-back exposed what the elevation bands
 * cannot fix on their own: a camera on the twilight floor looking up the
 * shelf sees ten metres of slope that all live inside one band, and one band
 * is one value — the round critic's "mauve field". The mottle is a second
 * fbm term sampled by position only (so at a fixed (x, z) it is a constant
 * multiplier and the bands' top-down value order is untouched), swinging the
 * paint a few percent in value and trading a little blue against it — a
 * brighter patch leans rose, a darker one leans deeper violet, which is how
 * gouache actually pools. Scaled by the carve like the bands, so it is
 * exactly identity everywhere the bowl is.
 */
const MOTTLE_SWING = 0.24;
const MOTTLE_BLUE_TRADE = 0.35;
/** Darkening runs shallower than brightening: gouache pools *up* toward
 * rose here, and the deep band already sits near the value floor the strata
 * tests hold (every channel a colour, red above 0.45). */
const MOTTLE_DARK_SCALE = 0.7;

/**
 * Sediment lines (W-O1): thin elevation-keyed value ripples riding the same
 * wander field as the band edges, so they undulate instead of ruling. From
 * the look-back a wall's elevation contours are exactly the cross-slope
 * lines a painter would lay down, and the three broad bands alone leave ten
 * metres of slope inside one of them. Amplitude is held far below a band
 * step, so the top-down value order the tests assert survives at every
 * sample the bands separate.
 */
// The pitch is bounded below by the seabed sheet's own grid: at 0.94 m per
// vertex a 1.6 m sine is at Nyquist and bakes as mush rather than lines
// (measured, `wo1-r4`). 3.2 m puts three and a half vertices in a cycle.
const SEDIMENT_PITCH = 3.2;
const SEDIMENT_AMPLITUDE = 0.055;

/**
 * The gate glow (W-O1): the way home is made of light. Toward the sill the
 * wall paint lifts toward a pale, faintly warm multiplier, so the climb out
 * of the twilight visibly brightens as it approaches the bowl's water — the
 * look-back's one natural light narrative, baked where the strata already
 * are instead of added as another additive layer. It is a radial ramp inside
 * the carve (zero beyond {@link GATE_GLOW_TO}, full at {@link GATE_GLOW_AT}),
 * so the den's wall at r = 44 — where the strata tests sample — is untouched.
 */
const GATE_GLOW_AT = 31.5;
const GATE_GLOW_TO = 39;
const GATE_GLOW_TINT: readonly [number, number, number] = [1.14, 1.08, 1.0];
const GATE_GLOW_STRENGTH = 0.7;

/**
 * The wall's paint at a point, as per-channel multipliers on the seabed's
 * vertex colours — or null wherever the carve is exactly zero, which is the
 * strata's whole bit-identity argument: the bake multiplies nothing it was
 * not handed, so a bowl vertex keeps the bytes it always had.
 *
 * `y` is the *carved* height, read off the already-displaced geometry rather
 * than recomputed, so the bands land on the walls the mesh actually has.
 */
export function canyonStrata(
  x: number,
  z: number,
  y: number,
): readonly [number, number, number] | null {
  const carve = canyonBlend(x, z);
  if (carve === 0) {
    return null;
  }

  // The band edges wander together: one low-frequency field, sampled once.
  const wander =
    (fbm(x * 0.045, z * 0.045, { seed: SEEDS.canyonPaint, period: 8, octaves: 2 }) - 0.5) *
    2 *
    STRATA_JITTER;
  const level = y + wander;

  // Walk down the bands, blending across each boundary.
  let r = STRATA_BANDS[0]!.tint[0];
  let g = STRATA_BANDS[0]!.tint[1];
  let b = STRATA_BANDS[0]!.tint[2];
  for (let i = 1; i < STRATA_BANDS.length; i++) {
    const boundary = STRATA_BANDS[i - 1]!.floor;
    const into = smoothstep01((boundary - level) / STRATA_BLEND);
    if (into <= 0) {
      break;
    }
    const tint = STRATA_BANDS[i]!.tint;
    r += (tint[0] - r) * into;
    g += (tint[1] - g) * into;
    b += (tint[2] - b) * into;
  }

  // The within-band mottle (W-O1): value first, then the blue trade. Both
  // ride the same field, so a patch is one decision — brighter-and-rosier or
  // deeper-and-bluer — rather than two kinds of noise stacked.
  const mottle =
    (fbm(x * 0.15, z * 0.15, { seed: SEEDS.canyonPaint ^ 0x3a77, period: 6, octaves: 3 }) - 0.5) *
    2 *
    MOTTLE_SWING;
  const lines = Math.sin((level * Math.PI * 2) / SEDIMENT_PITCH + wander * 3) * SEDIMENT_AMPLITUDE;
  const value = (1 + (mottle > 0 ? mottle : mottle * MOTTLE_DARK_SCALE)) * (1 + lines);
  r *= value;
  g *= value;
  b *= value * (1 - mottle * MOTTLE_BLUE_TRADE);

  // The gate glow (W-O1): the climb toward the sill lifts toward home's own
  // light. Red stays at or above green through the lerp, so the value key's
  // violet rule survives the warm lift.
  const glow =
    GATE_GLOW_STRENGTH * smoothstep01((GATE_GLOW_TO - Math.hypot(x, z)) / (GATE_GLOW_TO - GATE_GLOW_AT));
  if (glow > 0) {
    r += (GATE_GLOW_TINT[0] - r) * glow;
    g += (GATE_GLOW_TINT[1] - g) * glow;
    b += (GATE_GLOW_TINT[2] - b) * glow;
  }

  // Scaled by the carve, so the paint fades to identity exactly where the
  // walls fade back into the rim's own terrain — no seam against bowl sand.
  const s = smoothstep01(carve / 0.35);
  return [1 + (r - 1) * s, 1 + (g - 1) * s, 1 + (b - 1) * s];
}

/**
 * Multiplies the strata into a seabed geometry's baked vertex colours.
 *
 * Runs after `bakeSeabedOcclusion` and only ever touches vertices the carve
 * owns — everywhere `canyonStrata` returns null the loop writes nothing at
 * all, so the bowl's bake is untouched to the byte. Only the reef calls this;
 * the sanctuary keeps its own floor exactly as it was.
 */
export function bakeCanyonStrata(geometry: PlaneGeometry): void {
  const position = geometry.attributes.position;
  const color = geometry.attributes.color;
  if (!position || !color) {
    return;
  }

  for (let i = 0; i < position.count; i++) {
    const strata = canyonStrata(position.getX(i), position.getZ(i), position.getY(i));
    if (!strata) {
      continue;
    }
    color.setXYZ(
      i,
      color.getX(i) * strata[0],
      color.getY(i) * strata[1],
      color.getZ(i) * strata[2],
    );
  }
  color.needsUpdate = true;
}

// ─── The mood ────────────────────────────────────────────────────────────────

/**
 * How deep into the twilight the camera is, in [0, 1].
 *
 * This is the one function the biome's *weather* hangs off — fog colour and
 * density, the key light, the painted backdrop's level — and its contract is
 * the package's headline invariant: it returns exactly 0 everywhere the bowl
 * is playable. Three early returns state that structurally: above y = 0.45
 * (the bowl's collision floor keeps the camera above 1.2, with 0.045 of bob),
 * inside r = 30, and outside the wedge's azimuth band. A capture posed
 * anywhere in the bowl therefore renders through arithmetic the modulation
 * never touches — not through a modulation that happens to be small.
 *
 * Inside the canyon it is a smooth product of descent, distance through the
 * gate, and closeness to the floor band, so the twilight arrives the way a
 * dive arrives — eased, positional, and with nothing animated about it
 * (reduced motion has nothing to reduce).
 */
export const MOOD_SURFACE = 0.45;

export function abyssMood(x: number, y: number, z: number): number {
  if (y >= MOOD_SURFACE) {
    return 0;
  }
  const r = Math.hypot(x, z);
  if (r <= 30) {
    return 0;
  }
  const away = angleBetween(Math.atan2(z, x), GATE_AZIMUTH);
  if (away >= WEDGE_HALF + 0.1) {
    return 0;
  }

  const descent = smoothstep01((MOOD_SURFACE - y) / 4.5);
  const through = smoothstep01((r - 30) / 5);
  const across = 1 - smoothstep01((away - FLOOR_HALF) / (WEDGE_HALF + 0.1 - FLOOR_HALF));
  return descent * through * across;
}

/**
 * What the mood does when it is not zero, stated as data so the fog, the
 * lights and the tests read the same numbers.
 *
 * The fog scales are per-channel multipliers on the *live* base colour — the
 * one `adoptBackdrop` derives from the painting — so a repaint moves the
 * twilight with it. Green is cut hardest and red is held nearest, which is
 * the value key's rule for keeping a deep water violet-leaning instead of
 * electric: take the green out of a turquoise and what is left leans violet;
 * take the red out and it goes poster-paint cyan.
 */
export const ABYSS_FOG = {
  /** Per-channel scale on the fog colour at full mood. */
  colorScale: [0.58, 0.31, 0.64] as const,
  /** Added to the base density at full mood: the water closing in. */
  densityGain: 0.024,
  /** Fraction of the backdrop's level given up at full mood. */
  backdropFade: 0.52,
} as const;

/**
 * How much of each light the twilight takes at full mood. The key gives up
 * more than half — scarce light is the place's whole argument — while the
 * violet ambient keeps most of its floor, so the canyon darkens into colour
 * rather than into black, exactly as the value key demands of every shadow.
 */
export const ABYSS_LIGHT = {
  sun: 0.72,
  hemisphere: 0.55,
  ambient: 0.22,
} as const;

type SceneRenderHook = (camera: Camera) => void;

/**
 * Runs a callback at the top of every render of `scene`, with the camera the
 * frame is actually drawn through.
 *
 * Three calls `scene.onBeforeRender` before it builds render lists or draws
 * the background, so anything written here — fog, light intensities, a
 * visibility flag — is consistent across the whole frame; and the composer's
 * bloom and grade passes render their own internal scenes, so the hook fires
 * exactly once per composed frame. Chained rather than assigned, so two
 * modules hanging their weather off one scene cannot silently drop each
 * other.
 */
export function onSceneRender(scene: Scene, hook: SceneRenderHook): void {
  const previous = scene.onBeforeRender;
  // Three's type declares Object3D's six-argument callback; at runtime a
  // scene is called with (renderer, scene, camera, renderTarget). Forwarding
  // the rest untyped keeps both true.
  const chained: Scene["onBeforeRender"] = (renderer, self, camera, ...rest) => {
    (previous as (...args: unknown[]) => void).call(scene, renderer, self, camera, ...rest);
    hook(camera);
  };
  scene.onBeforeRender = chained;
}

// ─── The airspace ────────────────────────────────────────────────────────────

/**
 * The volume the diver may occupy beyond the bowl's box, in plan: the wedge
 * sector, slightly wider than the collider walls so the walls turn the body
 * before the predicate ever flips. `CollisionField` swaps its box clamp for
 * this zone's own floor, ceiling and radial cap while the diver is inside it.
 */
const AIRSPACE_HALF = WEDGE_HALF + 0.02;
const AIRSPACE_FROM = 29;
export const AIRSPACE_MAX_RADIUS = 51;

/** Metres of clearance the collision floor keeps over the canyon ground. */
export const CANYON_FLOOR_CLEARANCE = 0.7;

export function insideCanyonAirspace(x: number, z: number): boolean {
  const r = Math.hypot(x, z);
  if (r < AIRSPACE_FROM || r > AIRSPACE_MAX_RADIUS + 1) {
    return false;
  }
  return angleBetween(Math.atan2(z, x), GATE_AZIMUTH) < AIRSPACE_HALF;
}

/**
 * The canyon's ceiling, eased down from the bowl's 12 m to 5.5 m over the
 * first metres past the gate: the diver descends into the place because the
 * place descends, and a body pushed down half a metre a metre is a slope,
 * not a wall.
 */
export function canyonCeiling(x: number, z: number): number {
  const r = Math.hypot(x, z);
  return 12 - 6.5 * smoothstep01((r - 30) / 8);
}

// ─── The den ─────────────────────────────────────────────────────────────────

/**
 * Where the fifth moray lives: on the canyon floor, facing back up the shelf
 * toward the gate, so the approach corridor the sightline test walks is the
 * canyon itself. The head height rides `seabedHeight` at construction, like
 * every other placement in the world.
 */
export const ABYSS_DEN = {
  speciesId: "abyss",
  x: 44 * GATE_AXIS.x,
  z: 44 * GATE_AXIS.z,
  /** Metres the head peeks above the local floor; the bowl spots sit ~1.3. */
  headAbove: 1.5,
  facing: Math.atan2(-GATE_AXIS.x, -GATE_AXIS.z),
} as const;
