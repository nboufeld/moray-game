import { Color, Mesh, type BufferGeometry, type Material, type MeshToonMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";

/**
 * THE DEEP STEPS — shared idiom pieces for the builders. Nothing here
 * draws from a random stream or touches the scene; these are the
 * region's palette, its seed-substream table and the mechanical moves
 * every module repeats.
 *
 * ## The palette, and the value key it keeps
 *
 * The Drop Plains ended on a fall into violet; this is the country the
 * fall was into — the amphitheatre of great violet shelves at the foot
 * of the World's Edge, where the Old Current comes to rest and the
 * Gentle Dark keeps the floor. The province's key continues (composed
 * emptiness; deep steps retint violet with red above green — NEVER
 * cobalt; distance goes milky-bright; nothing black): pale bone-silt on
 * every crest and lip, violet pooled a step deeper on every floor down,
 * the Current's silver-green the one living ribbon, and the brightest
 * values kept for the Moon Well's circle and the saddle's milky light.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** Bone-pale silt at its brightest — lips, crests, the Well's circle. */
export const SILT_BRIGHT = new Color(0xe2dcd2);
/** The resting pale-violet silt of the upper steps. */
export const SILT_PALE = new Color(0xb6aec4);
/** A step down: the middle country's violet (red held above green). */
export const STEP_VIOLET = new Color(0x8a7aa6);
/** The Round's deep violet — the darkest colour in the region. */
export const ROUND_VIOLET = new Color(0x5e5280);
/** The Current's silver-green: the one living ribbon. */
export const CURRENT_GREEN = new Color(0x9ec4b4);
/** The pale worked-stone family (red over blue kept close — the deep
 * mood pushes blue hard; the stone must fight for its warmth). */
export const STONE_PALE = 0xbdb2ae;
/** The darker violet-slate stone family (fallen fragments' undersides). */
export const STONE_SLATE = 0x8d8298;
/** The stone dusk-lift (the Carillon Waste's proven cure): a small
 * emissive floor so a shade side stays a COLOUR under the deep mood.
 * Violet-leaning here — warm rust would read Smoulder. */
export const STONE_DUSK = 0x3a3450;
export const STONE_DUSK_INTENSITY = 0.3;

/**
 * The emissive-by-vertex-colour patch (the Carillon's inheritance): the
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
 * Merges one-off parts into a single mesh: welded normals, an honest
 * bounding sphere, no shadows in either direction (the smallwork rule).
 */
export function mergedMesh(parts: BufferGeometry[], material: Material, name: string): Mesh {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error(`deep-steps ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

// ─── Seed substreams (every stream is `SEEDS.regionBlue2 ^` one) ────────────

export const B2_SEEDS = {
  // Terrain (pure half).
  terrainDetail: 0x7e01,
  terrainStep: 0x7e02,
  terrainRound: 0x7e03,
  terrainSaddle: 0x7e04,
  // Ground paint.
  paintLife: 0x5a01,
  paintSilt: 0x5a02,
  paintRipple: 0x5a03,
  paintStars: 0x5a04,
  paintWall: 0x5a05,
  // Stone.
  rocks: 0x50cb,
  pharos: 0x0a11,
  brinkSlabs: 0x0a21,
  stairBoulders: 0x0a31,
  wrack: 0x0a41,
  skiff: 0x0a51,
  horns: 0x0a61,
  chuteStones: 0x0a71,
  sleeper: 0x0a81,
  // The Mooring and the Weir.
  mooring: 0x61a1,
  mooringPaint: 0x61b0,
  weir: 0x62a1,
  // The Old Current.
  currentGlass: 0xca01,
  currentFlow: 0xca02,
  spillFall: 0xca03,
  fordGlints: 0xca04,
  spillPool: 0xca05,
  // Cover (kit consumers).
  rippleGrit: 0xf001,
  strandTufts: 0xf002,
  bankBlades: 0xf003,
  bankFronds: 0xf004,
  saddlePebbles: 0xf005,
  wrackSplits: 0xf006,
  postSplits: 0xf007,
  wallScree: 0xf008,
  wallTufts: 0xf009,
  starTufts: 0xf00a,
  stairMoss: 0xf00b,
  driftWrack: 0xf00c,
  flankBushes: 0xf00d,
  closeStrandBed: 0xf011,
  closeBankBed: 0xf012,
  closeWrackBed: 0xf013,
  closePostBed: 0xf014,
  // Life.
  snow: 0xe401,
  plankton: 0xe402,
  planktonDeep: 0xe403,
  travellers: 0xe404,
  pilgrims: 0xe405,
  postStars: 0xe406,
  weirBlennies: 0xe407,
  strandCrabs: 0xe408,
  spillFry: 0xe409,
  // The resident.
  gentleDark: 0x0ee1,
  // Light.
  moonWell: 0x11f1,
  brinkBeam: 0x11f2,
  pharosBlade: 0x11f3,
  skiffLantern: 0x11f4,
  // Distance.
  distance: 0xd401,
} as const;
