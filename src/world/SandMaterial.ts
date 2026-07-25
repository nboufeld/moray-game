import { MeshStandardMaterial } from "three";
import { requestAlbedo } from "../rendering/AssetLibrary";
import {
  buildColorTexture,
  buildNormalTexture,
  buildScalarTexture,
  fbm,
} from "../rendering/ProceduralTexture";
import { SEEDS } from "../util/Random";

const SIZE = 512;

/** How many times the maps repeat across the 90m seabed. */
export const SAND_REPEAT = 14;

/**
 * The seabed material: ripples, grain and damp patches.
 *
 * Sand is the largest thing on screen by a wide margin, so it is the surface
 * where texture buys the most. The ripples are the important part — a single
 * flat value reads as paper, and the directional bands immediately tell the eye
 * there is a current here and that the ground has a scale.
 */
export function createSandMaterial(): MeshStandardMaterial {
  const height = sandHeight;

  const material = new MeshStandardMaterial({
    // Desaturated toward grey-gold. Coral sand is far less yellow than it
    // looks, and a saturated base under warm light tips the whole frame ochre.
    color: 0xa2957c,
    map: buildSandAlbedo(),
    normalMap: buildNormalTexture(SIZE, height, 0.028),
    roughnessMap: buildSandRoughness(),
    roughness: 1,
    metalness: 0,
    // Vertex colours carry the baked occlusion: dune troughs and contact
    // shadows under everything resting on the sand.
    vertexColors: true,
  });

  for (const map of [material.map, material.normalMap, material.roughnessMap]) {
    map?.repeat.set(SAND_REPEAT, SAND_REPEAT);
  }

  // Authored grain tile, when present. The painted image carries its own
  // colour, unlike the procedural map that is authored to sit under the
  // material tint — so the tint neutralises on swap. Ripples stay in the
  // procedural normal map either way; the tile is painted shadow-free.
  requestAlbedo(
    "world/sand-albedo.png",
    (texture) => {
      texture.repeat.set(SAND_REPEAT, SAND_REPEAT);
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    },
    { tile: true },
  );

  return material;
}

/**
 * Ripple height. Sine bands running on one dominant axis, domain-warped by
 * low-frequency noise so they meander like a real ripple field instead of
 * marching in parallel, plus fine grain on top.
 */
function sandHeight(u: number, v: number): number {
  const warp = fbm(u, v, { seed: SEEDS.sand ^ 0x31, period: 3, octaves: 3 }) - 0.5;
  const along = u * 0.82 + v * 0.57 + warp * 0.62;
  const ripple = Math.sin(along * Math.PI * 2 * 6) * 0.5 + 0.5;

  const grain = fbm(u, v, { seed: SEEDS.sand ^ 0x77, period: 64, octaves: 3, gain: 0.55 });
  const drift = fbm(u, v, { seed: SEEDS.sand ^ 0x15, period: 5, octaves: 3 });

  // Ripples dominate; grain is a fine dusting; drift keeps whole regions from
  // looking equally corrugated.
  return ripple * 0.62 * (0.45 + drift * 0.75) + grain * 0.2;
}

function buildSandAlbedo() {
  return buildColorTexture(SIZE, (u, v) => {
    const h = sandHeight(u, v);
    const mottle = fbm(u, v, { seed: SEEDS.sand ^ 0x05, period: 6, octaves: 4 });
    const flecks = fbm(u, v, { seed: SEEDS.sand ^ 0x9a, period: 96, octaves: 2 });

    // Ripple crests are dry and pale, troughs hold darker wet sand. Kept
    // gentle: strong banding here plus the ripple normals reads as woven cloth
    // rather than as sand.
    let tone = 0.88 + h * 0.17 + (mottle - 0.5) * 0.11;
    // Sparse shell grit.
    if (flecks > 0.84) {
      tone += (flecks - 0.84) * 1.4;
    }

    // Near-neutral on purpose. The material's base colour carries the hue, and
    // tinting here as well stacked warm on warm and turned the seabed mustard.
    return [tone, tone * 0.985, tone * 0.955];
  });
}

function buildSandRoughness() {
  return buildScalarTexture(SIZE, (u, v) => {
    const damp = fbm(u, v, { seed: SEEDS.sand ^ 0xc3, period: 5, octaves: 3 });
    // Damp patches are smoother and catch a sheen; dry sand is fully matte.
    return 0.72 + damp * 0.28;
  });
}
