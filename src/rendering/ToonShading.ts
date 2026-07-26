import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  LinearFilter,
  MeshToonMaterial,
  RGBAFormat,
  Vector2,
  type ColorRepresentation,
  type Side,
  type Texture,
} from "three";

/**
 * The one shading ramp the whole reef is lit through.
 *
 * Everything lit in this project is a `MeshToonMaterial` reading this texture,
 * which is what turns the frame from a photograph of a reef into a painting of
 * one. A physical BRDF spends its whole value range describing how light falls
 * off across a curved surface; a painter does not have that range and does not
 * want it. They put down two or three flat values and let the *edge between
 * them* describe the form. That edge is this file.
 *
 * Toon shading is also the cheaper of the two: no specular lobe, no roughness
 * or metalness fetch, one texture read replacing the whole BRDF. Nothing in the
 * reef is wet-looking any more, which is exactly the trade this look is here to
 * make — a painted highlight is an authored mark, not a physical response, and
 * it comes back later as pigment rather than as gloss.
 */

/**
 * Texels across the ramp.
 *
 * Sixteen is the usual number and it is one too few for this ramp. A texel
 * there is 0.0625 of the lookup, so a {@link RAMP_SOFTNESS} of 0.08 falls
 * between two texel centres more often than not and the whole step lands in a
 * single sample gap — the texture then declares a soft edge and hands the
 * renderer a hard one, with `LinearFilter` reconstructing a cliff one texel
 * wide. Measured at 16 the terminator jumped 0.39 of the ramp between two
 * neighbouring texels, which is a cel edge. Thirty-two puts two and a half
 * texels inside the window, so what is sampled is the curve that was authored.
 * It costs 128 bytes.
 */
const RAMP_SIZE = 32;

/**
 * The three values a surface can be lit to, darkest first.
 *
 * Not a fall to zero. The bottom band is a *shade*, the value a painter mixes
 * for the side of a thing facing away from the light, and in this water it is
 * still lit — the fog, the ambient and the hemisphere all reach it. Taking it
 * lower turns a step into a hole and puts the frame back into the photographic
 * range WP-G1 spent its whole budget closing.
 *
 * But it cannot be as high as it looks like it should be either, and the reason
 * is that the shade band is a *floor under the key*, not a description of the
 * scene's darkest value. A surface facing away from the sun used to receive
 * none of it; now it receives a quarter, on top of a fill that was already the
 * larger half of this rig. At 0.35 the canonical frames came back with their
 * tenth percentile lifted eight parts in 255, the steps inside a fifth of each
 * other, and — the tell that mattered — the violet gone out of the shadows,
 * because what a shade band adds is *warm key light*. This is the value that
 * keeps WP-G1's shadow colour while still being a colour rather than a hole.
 */
const RAMP_LEVELS = [0.26, 0.68, 1] as const;

/**
 * Where the steps fall, in the coordinate the toon shader looks the ramp up
 * with — `dot(normal, light) * 0.5 + 0.5`, so 0.5 is the terminator and the
 * whole lit hemisphere is the upper half of the texture.
 *
 * The first is the terminator itself. The second is not at the midpoint of what
 * is left, and that is the part worth writing down: it is placed against the
 * normals this reef actually has, not against the range it could have. The sun
 * stands about 48° above the horizon, so every up-facing plane in the scene —
 * the whole seabed, the top of every rock, the back of every animal — piles up
 * between 0.80 and 0.88, and everything facing away falls below 0.5. There is
 * almost nothing in between. A stop at 0.74 therefore put the seabed, the
 * boulder tops, their fronts *and* their sunward flanks all in the top band and
 * gave a rock exactly two values; measured off shot C, a boulder that should
 * read as three planes read as one. At 0.82 the step lands inside that cluster,
 * so a plane square to the sun separates from one merely turned toward it, and
 * the form comes back.
 */
const RAMP_STOPS = [0.5, 0.82] as const;

/**
 * How wide each step is, in the same coordinate.
 *
 * This is the whole difference between Ghibli and anime television. A hard cel
 * boundary is an ink line and belongs to a drawing with outlines; a painted
 * background has a step you can see and an edge you cannot point at. It is the
 * width {@link RAMP_SIZE} is sized to be able to carry.
 *
 * There are no mipmaps, because a one-pixel-tall texture has nothing to
 * average, and the wrap is clamped, because a surface pointing straight at or
 * straight away from the light samples the very edge and repeat would fold the
 * far end of the ramp back onto it.
 */
const RAMP_SOFTNESS = 0.08;

/**
 * What a normal map is worth once the shading is stepped.
 *
 * Under a continuous BRDF a normal map is surface: it modulates a gradient that
 * was already there. Under a ramp it modulates *where the step falls*, so the
 * same map that read as texture now reads as a torn edge — at full strength the
 * band boundary breaks up into noise and the form stops reading at all. Half is
 * where the wrinkles and the strata still trouble the terminator without
 * dissolving it.
 */
export const TOON_NORMAL_SCALE = 0.5;

/**
 * Three's own type definitions do not list `flatShading` on the toon material,
 * and its constructor does not initialise it — but the renderer reads it off
 * whatever material it is handed when it builds the program defines, and
 * `getProgramCacheKeyBooleans` hashes it, so a faceted toon material compiles
 * its own program and keeps it. The gap is in the declaration, not the feature,
 * and the reef needs the feature: rock, coral, rubble and fish are all faceted
 * on purpose, and facets are what give a stepped light something to step over.
 */
declare module "three" {
  interface MeshToonMaterial {
    flatShading: boolean;
  }
}

let gradientMap: DataTexture | undefined;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** The ramp as a function, sampled at texel centres by {@link toonGradientMap}. */
function rampValue(coord: number): number {
  let value = RAMP_LEVELS[0];
  for (let i = 0; i < RAMP_STOPS.length; i++) {
    const stop = RAMP_STOPS[i]!;
    const next = RAMP_LEVELS[i + 1]!;
    const previous = RAMP_LEVELS[i]!;
    value += (next - previous) * smoothstep(stop - RAMP_SOFTNESS / 2, stop + RAMP_SOFTNESS / 2, coord);
  }
  return value;
}

/**
 * The shared ramp, built once.
 *
 * A `DataTexture` rather than a painted canvas, for the same reason every other
 * map in the project is one: it needs no DOM, so it exists in the Node unit
 * tests, and it is bit-identical between runs, which is what lets two
 * screenshots be compared at all.
 *
 * Three only ever reads the red channel of a gradient map, but the value is
 * written to all four channels anyway: `RGBAFormat` needs no row alignment
 * fussing and the whole texture is 128 bytes either way. It stays in the
 * default (linear, un-managed) colour space on
 * purpose: this is a multiplier on irradiance, not a colour, and tagging it
 * sRGB would put a decode curve through the middle of the ramp.
 */
export function toonGradientMap(): DataTexture {
  if (gradientMap) {
    return gradientMap;
  }

  const data = new Uint8Array(RAMP_SIZE * 4);
  for (let i = 0; i < RAMP_SIZE; i++) {
    const value = Math.round(Math.min(1, Math.max(0, rampValue((i + 0.5) / RAMP_SIZE))) * 255);
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  }

  const texture = new DataTexture(data, RAMP_SIZE, 1, RGBAFormat);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;

  gradientMap = texture;
  return texture;
}

export interface ToonMaterialOptions {
  readonly color?: ColorRepresentation;
  readonly map?: Texture | null;
  readonly normalMap?: Texture | null;
  /** Defaults to {@link TOON_NORMAL_SCALE}; only meaningful with a normal map. */
  readonly normalScale?: number;
  readonly vertexColors?: boolean;
  readonly flatShading?: boolean;
  readonly emissive?: ColorRepresentation;
  readonly emissiveIntensity?: number;
  readonly side?: Side;
  readonly transparent?: boolean;
  readonly opacity?: number;
}

/**
 * A lit surface in this reef.
 *
 * Every opaque thing the light touches is built here, so the ramp and the
 * normal-map strength are decided once rather than in nine files. What it
 * deliberately does not take is a roughness or a metalness: `MeshToonMaterial`
 * has neither, and losing them is the point of the package rather than a
 * limitation of it.
 */
export function createToonMaterial(options: ToonMaterialOptions = {}): MeshToonMaterial {
  const material = new MeshToonMaterial({
    gradientMap: toonGradientMap(),
    vertexColors: options.vertexColors ?? false,
  });
  // Assigned rather than passed to the constructor, which would drop it: see
  // the module augmentation above.
  material.flatShading = options.flatShading ?? false;

  if (options.color !== undefined) {
    material.color = new Color(options.color);
  }
  if (options.map) {
    material.map = options.map;
  }
  if (options.normalMap) {
    material.normalMap = options.normalMap;
    const scale = options.normalScale ?? TOON_NORMAL_SCALE;
    material.normalScale = new Vector2(scale, scale);
  }
  if (options.emissive !== undefined) {
    material.emissive = new Color(options.emissive);
  }
  if (options.emissiveIntensity !== undefined) {
    material.emissiveIntensity = options.emissiveIntensity;
  }
  if (options.side !== undefined) {
    material.side = options.side;
  }
  if (options.transparent !== undefined) {
    material.transparent = options.transparent;
  }
  if (options.opacity !== undefined) {
    material.opacity = options.opacity;
  }

  return material;
}
