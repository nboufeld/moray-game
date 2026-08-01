import { Color, Mesh, type BufferGeometry, type Material, type MeshToonMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";

/**
 * THE FIRST SEA — shared idiom pieces for the builders. Nothing here
 * draws from a random stream or touches the scene; these are the
 * region's palette, its seed-substream table and the mechanical moves
 * every module repeats.
 *
 * ## The palette, and the value key it keeps
 *
 * The last region of the world. The Drop Plains fell over the World's
 * Edge; the Deep Steps was the violet night the fall was into, kept
 * kind by the Gentle Dark; and below the deepest night is not a darker
 * dark — it is the hour before morning. The First Sea is the floor of
 * the whole ocean, and the register INVERTS the expectation: the water
 * clears, the violet leans rose toward daybreak, and the floor itself
 * is strewn with the star-bloom — a field of pale first light. The
 * province key holds to the letter: violets keep red above green —
 * NEVER cobalt; distance goes milky-bright (here it goes milky-ROSE:
 * the light beyond the world's hem); the darkest floor is a colour;
 * the brightest values are kept for the Daybreak's circle, the
 * star-bloom and the horizon's seam.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** The star-bloom at its brightest — the Wide Morning's floor, the
 *  Daybreak's circle, the Pearl. Warm-white, a nose of rose. */
export const STAR_BRIGHT = new Color(0xeee6e0);
/** The resting rose-pale silt of the shelf and the fall's crest. */
export const SILT_ROSE = new Color(0xc4b6c4);
/** The Mere's deep violet — the darkest colour in the region (and in
 *  the game's whole floor): red held above green, level under blue. */
export const MERE_VIOLET = new Color(0x5e5484);
/** The Cradle's silver-green: the province's one living ribbon,
 *  inherited from the Old Current upstream. */
export const CRADLE_GREEN = new Color(0x9ec4b4);
/** The dawn-rose the horizon bleeds over the Hem — an accent, always
 *  milky-bright, never a register of its own. */
export const DAWN_ROSE = new Color(0xe8d2c6);

/** The pale worked-stone family (blue-2's proven sky-key lift kept:
 *  warm rock-wash albedo reads rust under a violet mood unless the
 *  material tint leans blue-pale). */
export const STONE_PALE = 0xdadce2;
/** The violet-slate family — a step deeper, for silhouettes that must
 *  stand against the milky rim. */
export const STONE_SLATE = 0xa8aac4;
/** The stone dusk-lift (the Carillon cure, via blue-2): a small
 *  emissive floor so a shade side stays a COLOUR under the deep mood. */
export const STONE_DUSK = 0x3c3452;
export const STONE_DUSK_INTENSITY = 0.3;

/**
 * The emissive-by-vertex-colour patch (blue-2's inheritance): the
 * dusk-lift rides the baked paint instead of lying flat over the whole
 * body, so grooves stay dark and the drawing survives the shade side.
 */
export function applyVeinGlow(material: MeshToonMaterial, cacheKey: string): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`,
    );
  };
  material.customProgramCacheKey = () => cacheKey;
}

/**
 * Lerps a stone geometry's baked vertex colours toward the pale sky
 * key (blue-1's stone-value move, proven again by blue-2): the rock
 * pipeline bakes a warm facing tint that reads as rust under the deep
 * mood; this keeps its variety and re-keys its family.
 */
export function palenStone(geometry: { attributes: Record<string, unknown> }, amount: number): void {
  const colors = geometry.attributes.color as
    | {
        count: number;
        getX(i: number): number;
        getY(i: number): number;
        getZ(i: number): number;
        setXYZ(i: number, x: number, y: number, z: number): void;
        needsUpdate: boolean;
      }
    | undefined;
  if (!colors) {
    return;
  }
  const c = new Color();
  for (let i = 0; i < colors.count; i++) {
    c.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i)).lerp(STAR_BRIGHT, amount);
    colors.setXYZ(i, c.r, c.g, c.b);
  }
  colors.needsUpdate = true;
}

/**
 * Merges one-off parts into a single mesh: welded normals, an honest
 * bounding sphere, no shadows in either direction (the smallwork rule).
 */
export function mergedMesh(parts: BufferGeometry[], material: Material, name: string): Mesh {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error(`first-sea ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

// ─── Seed substreams (every stream is `SEEDS.regionBlue3 ^` one) ────────────

export const B3_SEEDS = {
  // Terrain (pure half).
  terrainShelf: 0x7e01,
  terrainFall: 0x7e02,
  terrainMere: 0x7e03,
  terrainDetail: 0x7e04,
  // Ground paint.
  paintLife: 0x5a01,
  paintSilt: 0x5a02,
  paintStars: 0x5a03,
  paintFall: 0x5a04,
  paintWall: 0x5a05,
  // Stone.
  daymark: 0x0a11,
  buoys: 0x0a21,
  chain: 0x0a31,
  anchor: 0x0a41,
  wellCrags: 0x0a51,
  doorstep: 0x0a61,
  watchers: 0x0a71,
  pearl: 0x0a81,
  fordStones: 0x0a91,
  panLips: 0x0aa1,
  // The Wellhead's water.
  wellBreath: 0xca01,
  cradleGlass: 0xca02,
  overbrim: 0xca03,
  fordGlints: 0xca04,
  panShimmer: 0xca05,
  // Cover (kit consumers).
  mereGrit: 0xf001,
  shelfPebbles: 0xf002,
  mereTufts: 0xf003,
  bankBlades: 0xf004,
  bankFronds: 0xf005,
  fallMoss: 0xf006,
  wallTufts: 0xf007,
  starTufts: 0xf008,
  chainSplits: 0xf009,
  wallScree: 0xf00a,
  flankBushes: 0xf00b,
  flankMeadowW: 0xf00c,
  flankMeadowE: 0xf00d,
  chainDrift: 0xf00e,
  closeMereBed: 0xf011,
  closeBankBed: 0xf012,
  closeChainBed: 0xf013,
  closeWellBed: 0xf014,
  // Life.
  snow: 0xe401,
  plankton: 0xe402,
  planktonDeep: 0xe403,
  dawnShoal: 0xe404,
  buoyFry: 0xe405,
  chainStars: 0xe406,
  anchorBlennies: 0xe407,
  cradleCrabs: 0xe408,
  wellFry: 0xe409,
  // The resident.
  morningWhale: 0x0ee1,
  // Light.
  daybreak: 0x11f1,
  daymarkBlade: 0x11f2,
  fallFoot: 0x11f6,
  anchorPool: 0x11f3,
  pearlGlow: 0x11f4,
  doorstepRays: 0x11f5,
  // Distance.
  distance: 0xd401,
} as const;
