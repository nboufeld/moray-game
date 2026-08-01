import { Color, Mesh, type BufferGeometry, type Material, type MeshToonMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";

/**
 * THE CARILLON WASTE — shared idiom pieces for the builders. Nothing here
 * draws from a random stream or touches the scene; these are the region's
 * palette, its seed-substream table, its protected rests and the
 * mechanical moves every module repeats.
 *
 * ## The palette, and the value key it keeps
 *
 * The Hourglass Sea was the desert's sand; this is the desert's BONE —
 * the wind-carved honey sandstone country the dunes were milled from.
 * The province's key continues (honey over violet, gold dapple, never
 * black) but the register shifts from dune-gold to carved amber: sunlit
 * ochre on every crest, rib and caprock; warm violet pooled in flutes,
 * wind-hollows and the Ribbon's deep; seep-green only where water
 * touches stone. Distance goes milky-warm through the mood, and the
 * brightest painted values live on the towers' lit flanks and the
 * pavement's swept rings.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** Sunlit carved sandstone at its brightest — the crest of the range. */
export const STONE_BRIGHT = new Color(0xf2dda6);
/** The resting carved ochre. */
export const STONE_AMBER = new Color(0xd6ae74);
/** Flute and hollow shadow: warm violet, red above green, never black. */
export const FLUTE_VIOLET = new Color(0x74567a);
/** The Ribbon's deep — the darkest colour in the region. */
export const RIBBON_VIOLET = new Color(0x564268);
/** Seep-fed stone: green-gold where the springs stain the rock. */
export const SEEP_GREEN = new Color(0xa8b06a);
/** Travertine pale: the seep pools' mineral rims. */
export const TRAVERTINE = new Color(0xe8ddbe);
/** The pale carved-stone family (warm, red held over blue — the
 * pilot's round-5 lesson: under a violet ambient the red/blue ratio is
 * the lever, not the value). */
export const CARVED_PALE = 0xc6a468;
/** The caprock family — darker, violet-warm, the balanced hats. */
export const CAPROCK_STONE = 0x96765e;

/**
 * The emissive-by-vertex-colour patch (the canyon polyps' trick, the
 * pilots' inheritance): the glow rides the baked paint instead of lying
 * flat over the whole body, so only the painted highlight glows.
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
    throw new Error(`carillon ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

// ─── Seed substreams (every stream is `SEEDS.regionGolden2 ^` one) ──────────

export const G2_SEEDS = {
  // Terrain (pure half).
  terrainDetail: 0x7e01,
  terrainSwale: 0x7e02,
  terrainRib: 0x7e03,
  terrainShelf: 0x7e04,
  terrainSeep: 0x7e05,
  // Ground paint.
  paintDrift: 0x5a01,
  paintGrain: 0x5a02,
  paintJoint: 0x5a03,
  paintSeep: 0x5a04,
  paintLife: 0x5a05,
  // Stone.
  rocks: 0x50cb,
  hoodooField: 0x0a31,
  waymarks: 0x0a41,
  jambs: 0x0a51,
  gullyBoulders: 0x0a61,
  slotLips: 0x0a71,
  sunsetSpires: 0x0a81,
  // The Carillon and the Windows.
  towers: 0x61a1,
  towerPaint: 0x61a2,
  windowsWall: 0x62a1,
  archStone: 0x62a3,
  // The Seep Terraces.
  seepRims: 0x63a1,
  seepBubbles: 0x63a2,
  // Cover (kit consumers).
  rippleGrit: 0xf001,
  shellDrift: 0xf002,
  roadPebbles: 0xf003,
  roadWire: 0xf004,
  courtWire: 0xf005,
  flankWire: 0xf006,
  pocketFronds: 0xf007,
  seepFronds: 0xf008,
  seepSward: 0xf009,
  seepBushes: 0xf00a,
  windowScrub: 0xf00b,
  splitStones: 0xf00c,
  towerFeet: 0xf00d,
  shardAprons: 0xf00e,
  wrackLines: 0xf00f,
  slotFloor: 0xf010,
  gullyFronds: 0xf011,
  courtBushes: 0xf012,
  closeCourtBed: 0xf013,
  closeSeepBed: 0xf014,
  closeFluteBed: 0xf015,
  closeArchBed: 0xf016,
  shelfTufts: 0xf017,
  // Life.
  motes: 0xe401,
  plankton: 0xe402,
  traveller: 0xe403,
  swifts: 0xe404,
  hoodooWhelks: 0xe405,
  windowBlennies: 0xe406,
  slotCrabs: 0xe407,
  seepFry: 0xe408,
  seepStars: 0xe409,
  // The resident.
  nautilus: 0x0ee1,
  // Light.
  dappleCourt: 0x11f1,
  dappleSeep: 0x11f2,
  roadBeams: 0x11f3,
  lightWell: 0x11f4,
  noonBell: 0x11f5,
  seepGlints: 0x11f6,
  archBeam: 0x11f7,
  // Distance.
  distance: 0xd401,
} as const;
