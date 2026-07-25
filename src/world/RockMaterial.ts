import { BufferAttribute, MeshStandardMaterial, type BufferGeometry } from "three";
import { requestAlbedo } from "../rendering/AssetLibrary";
import {
  buildColorTexture,
  buildNormalTexture,
  fbm,
  ridged,
  voronoi,
} from "../rendering/ProceduralTexture";
import { Random, SEEDS } from "../util/Random";

const SIZE = 512;

/**
 * How many times the painted tile repeats across one unit of box-projected UV.
 *
 * {@link boxProjectUvs} lays 0.22 of a UV unit down per metre, so one unit is
 * 4.5 m of stone and this puts a tile every 2.3 m. One repeat has to serve an
 * eight-metre sea stack and a two-metre boulder, since every rock in the reef
 * shares one material, so it is chosen for the middle and checked at the ends:
 * at 2.3 m a stack wears three and a half tiles across its face and a boulder
 * most of one, which is variation on the big shapes without a boulder becoming
 * a repeating pattern in its own right. It is also about 450 texels per metre,
 * where 4.5 m would be 225 — and the player swims within a metre of these.
 *
 * The procedural normal map is deliberately left at one tile per unit. Its
 * cracks are the rock's *form* and were tuned at that size against the
 * silhouette; the painted tile is shadow-free colour, and colour finer than
 * form is how stone actually looks.
 */
const TILE_REPEAT = 2;

/**
 * What the tint is multiplied by once the painted tile is carrying the colour.
 *
 * The procedural map is authored to sit *under* a tint — it is near white, and
 * the material colour supplies the stone. The painted tile carries its own
 * colour, so leaving the tint alone would multiply the two and land every rock
 * at a third of the value it ships at today. Measured: the built texture
 * averages 0.80 in linear luminance, the PNG 0.27, a ratio of 2.95. Sand had
 * the same problem and answered it by neutralising the tint to white, which
 * works there because there is one seabed.
 *
 * There is not one rock. `createRockMaterial` is called with a different colour
 * per rock family, and one of them is doing compositional work: the foreground
 * shoulder that crops shot A is `0x3a474a`, and a shoulder that is not darker
 * than the reef behind it is not a shoulder. Blending the tints toward white
 * would take that from 0.23 to 0.73 and flatten the frame.
 *
 * So the tint is *scaled* rather than washed out: a single multiply in linear
 * space, giving back the luminance the map stopped supplying. Every rock keeps
 * the value it has today and the ratios between them are untouched, because a
 * uniform scale cannot change a ratio — which is the whole point, since the
 * ratios are the rock-to-rock variation. It sits a little under the measured
 * 2.95 because that is where the brightest channel of the brightest tint in the
 * project — the boulders' green — comes to rest at 1.0 rather than above it.
 * The four canonical shots hold their frame mean to within one part in 255.
 */
const TINT_LIFT = 2.85;

let shared: { map: ReturnType<typeof buildColorTexture>; normal: ReturnType<typeof buildNormalTexture> } | undefined;

/** Layered strata plus cracks — the height field the maps are derived from. */
function rockHeight(u: number, v: number): number {
  const strata = fbm(u, v * 3.1, { seed: SEEDS.rock ^ 0x41, period: 5, octaves: 4 });
  const grain = fbm(u, v, { seed: SEEDS.rock ^ 0x93, period: 40, octaves: 3 });
  // Ridged noise carves the fractures; Voronoi walls add the blockier splits.
  const cracks = ridged(u, v, { seed: SEEDS.rock ^ 0x0d, period: 9, octaves: 3 });
  const { f1, f2 } = voronoi(u, v, 6, SEEDS.rock ^ 0xb7);
  const joints = Math.min(1, (f2 - f1) / 0.05);

  return strata * 0.44 + grain * 0.2 + Math.pow(cracks, 3) * 0.22 + joints * 0.14;
}

/**
 * Stone surface, shared by every rock, mound and flank in the reef.
 *
 * Flat shading is kept deliberately. A normal map composes correctly with it —
 * the derivative-based tangent frame perturbs the face normal — so the result
 * is textured facets, chiselled rather than smoothly rendered, which is the
 * look the rest of the reef is built around.
 */
export function createRockMaterial(color: number): MeshStandardMaterial {
  shared ??= {
    map: buildColorTexture(SIZE, (u, v) => {
      const h = rockHeight(u, v);
      const tone = 0.68 + h * 0.5;
      // Faintly cooler in the crevices, where less light reaches.
      return [tone, tone * (0.97 + h * 0.03), tone * (0.93 + h * 0.06)];
    }),
    normal: buildNormalTexture(SIZE, rockHeight, 0.07),
  };

  const material = new MeshStandardMaterial({
    color,
    map: shared.map,
    normalMap: shared.normal,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
    // Algae tinting is baked per-vertex from the surface normal.
    vertexColors: true,
  });

  // Authored limestone tile, when present. Albedo only: the strata, the cracks
  // and the Voronoi joints live in the procedural normal map, which is the
  // rock's form and is not something a shadow-free colour tile can carry. The
  // box-projected UVs are untouched as well — the tile is laid over them at
  // {@link TILE_REPEAT}, so a swap moves no vertex and re-seams nothing.
  requestAlbedo(
    "world/rock-albedo.png",
    (texture) => {
      texture.repeat.set(TILE_REPEAT, TILE_REPEAT);
      material.map = texture;
      material.color.multiplyScalar(TINT_LIFT);
      material.needsUpdate = true;
    },
    { tile: true },
  );

  return material;
}

/**
 * Roughens a platonic solid into something that reads as stone, and gives it
 * usable UVs and an algae tint.
 *
 * The d20/d12 silhouette was half the reason the rocks looked like programmer
 * art; no amount of surface detail fixes an obviously regular solid. Radial
 * FBM displacement breaks the regularity while keeping the faceted style.
 */
export function weatherRock(
  geometry: BufferGeometry,
  seed: number,
  amount = 0.16,
  /**
   * Only ever shrink the surface. The crevice mounds sit a few centimetres
   * behind a moray's head and are raycast for line of sight, so a mound that
   * can bulge outward can silently swallow the creature the whole game is
   * about. Inward-only displacement makes that impossible by construction.
   */
  inwardOnly = false,
): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  const random = new Random(seed);
  const offsetX = random.range(0, 100);
  const offsetY = random.range(0, 100);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const length = Math.hypot(x, y, z) || 1;

    // Sample the noise by direction so shared vertices displace identically and
    // the surface stays closed.
    const u = (Math.atan2(z, x) / (Math.PI * 2) + 0.5 + offsetX) % 1;
    const v = (Math.asin(Math.max(-1, Math.min(1, y / length))) / Math.PI + 0.5 + offsetY) % 1;
    const n = fbm(u, v, { seed, period: 6, octaves: 4 });

    const scale = inwardOnly ? 1 - n * amount : 1 + (n - 0.5) * 2 * amount;
    position.setXYZ(i, x * scale, y * scale, z * scale);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  boxProjectUvs(geometry);
  tintByFacing(geometry);
}

/**
 * Projects UVs along each face's dominant axis.
 *
 * Platonic geometries have unusable UVs, and the textbook fix — runtime
 * triplanar sampling — costs three fetches per map on surfaces this large.
 * Box projection is one fetch and free, and its seams land on facet edges where
 * flat shading has already broken the normal, so they are invisible.
 */
function boxProjectUvs(geometry: BufferGeometry): void {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  if (!position || !normal) {
    return;
  }

  const uvs = new Float32Array(position.count * 2);
  const scale = 0.22;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));

    let u: number;
    let v: number;
    if (nx >= ny && nx >= nz) {
      u = z * scale;
      v = y * scale;
    } else if (ny >= nz) {
      u = x * scale;
      v = z * scale;
    } else {
      u = x * scale;
      v = y * scale;
    }

    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }

  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
}

/** Up-facing stone collects algae; undersides stay bare and cool. */
function tintByFacing(geometry: BufferGeometry): void {
  const normal = geometry.attributes.normal;
  if (!normal) {
    return;
  }

  const colors = new Float32Array(normal.count * 3);
  for (let i = 0; i < normal.count; i++) {
    const up = Math.max(0, normal.getY(i));
    const algae = Math.pow(up, 1.6);
    colors[i * 3] = 1 - algae * 0.22;
    colors[i * 3 + 1] = 1 - algae * 0.03;
    colors[i * 3 + 2] = 1 - algae * 0.2;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}
