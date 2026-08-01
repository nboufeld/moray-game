import { Color, Mesh, type BufferGeometry, type Material, type MeshToonMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";

/**
 * THE VESPER STRAND — shared idiom pieces for the builders. Nothing here
 * draws from a random stream or touches the scene; these are the
 * region's palette, its seed-substream table and the mechanical moves
 * every module repeats.
 *
 * ## The palette, and the value key it keeps
 *
 * The Hourglass Sea was the desert's sand; the Carillon Waste was the
 * desert's bone; this is the desert's EVENING — the hour of sunset made
 * into a place. The province's key finishes its journey (honey over
 * violet, gold dapple, never black): the honey deepens toward rose-amber,
 * the violet grows long — every standing stone leans toward the Sun's
 * Door and throws its shadow back up the road the diver came by — and
 * the ground turns salt-pale where the last light doubles in the mirror
 * pans. Distance goes milky-rose through the mood; the brightest thing
 * in the region is the painted sun standing in its own door at the
 * world's edge.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** Sunset-lit stone at its brightest — crests, rims, the door's flank. */
export const STONE_BRIGHT = new Color(0xf4dda2);
/** The resting evening ochre. */
export const STONE_AMBER = new Color(0xd8ac72);
/** Long-shadow violet: warm, red above green, never black. */
export const SHADOW_VIOLET = new Color(0x76567c);
/** The Night Well's deep — the darkest colour in the region. */
export const WELL_VIOLET = new Color(0x544066);
/** Salt-crust pale: the pans' mineral rims and the basin's crust. */
export const SALT_PALE = new Color(0xece0c0);
/** The mirror pans' floors: the sky held in mineral glass. */
export const PAN_SKY = new Color(0xf6ecc8);

/** The pale carved-stone family (warm, red held over blue — the
 * province's proven ratio lever; round 2 pulled it back toward the
 * Carillon Waste's proven pale after the r1 stones read rust-brown
 * under the quarter-sun). */
export const CARVED_PALE = 0xd6b47e;
/** The kneeling/caprock family — darker, violet-warm (lifted with the
 * pale family in round 2). */
export const DUSK_STONE = 0xac9070;
/** The stone dusk-lift (the golden-2 lesson pre-paid): a small emissive
 * floor so a stone's toon-shade side stays a COLOUR under the
 * quarter-sun instead of crushing to eggplant. */
export const STONE_DUSK = 0x5a4430;
export const STONE_DUSK_INTENSITY = 0.25;

/**
 * The emissive-by-vertex-colour patch (the canyon polyps' trick, the
 * province's inheritance): the glow rides the baked paint instead of
 * lying flat over the whole body, so only the painted highlight glows —
 * the golden-2 round-3 lesson (a flat emissive floor irons the drawing
 * off the shade side), applied from draft one.
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
    throw new Error(`vesper ${name} parts could not be merged`);
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

// ─── Seed substreams (every stream is `SEEDS.regionGolden3 ^` one) ──────────

export const G3_SEEDS = {
  // Terrain (pure half).
  terrainDetail: 0x7e11,
  terrainSwell: 0x7e12,
  terrainComb: 0x7e13,
  terrainFine: 0x7e14,
  // Ground paint.
  paintDrift: 0x5a11,
  paintGrain: 0x5a12,
  paintCrust: 0x5a13,
  paintLife: 0x5a14,
  paintStain: 0x5a15,
  // Stone.
  rocks: 0x51cb,
  procession: 0x0aa1,
  waymarks: 0x0ab1,
  gateSlabs: 0x0ac1,
  combeBoulders: 0x0ad1,
  panLips: 0x0ae1,
  wellRim: 0x0af1,
  // The Sun's Door and the Afterglow Garden.
  door: 0x64a1,
  doorStacks: 0x64b1,
  candles: 0x65a1,
  candlePaint: 0x65a2,
  candleGlow: 0x65b1,
  gardenSpring: 0x65c1,
  // The falls and the pans.
  fallTexture: 0x66a1,
  fallSheets: 0x66a2,
  panRings: 0x67a1,
  // Cover (kit consumers).
  rippleGrit: 0xf101,
  saltShards: 0xf102,
  roadPebbles: 0xf103,
  roadWire: 0xf104,
  basinWire: 0xf105,
  combTufts: 0xf106,
  pocketFronds: 0xf107,
  gardenSward: 0xf108,
  gardenFronds: 0xf109,
  gardenBushes: 0xf10a,
  doorTufts: 0xf10b,
  doorScrub: 0xf10c,
  splitStones: 0xf10d,
  wellShards: 0xf10e,
  wrackLines: 0xf10f,
  thresholdWire: 0xf110,
  closePanBed: 0xf111,
  closeCombBed: 0xf112,
  closeGardenBed: 0xf113,
  closeDoorBed: 0xf114,
  // Life.
  motes: 0xe411,
  plankton: 0xe412,
  traveller: 0xe413,
  caravan: 0xe414,
  candleStars: 0xe415,
  panCrabs: 0xe416,
  springFry: 0xe417,
  doorWhelks: 0xe418,
  // The resident.
  pilgrim: 0x0ef1,
  // Light.
  dappleRoad: 0x12f1,
  dappleGarden: 0x12f2,
  roadBeams: 0x12f3,
  wellBlade: 0x12f4,
  lastLight: 0x12f5,
  panPools: 0x12f6,
  gardenGlints: 0x12f7,
  // Distance.
  distance: 0xd411,
  sunset: 0xd421,
} as const;
