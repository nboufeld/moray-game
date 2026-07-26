import { BufferAttribute, type BufferGeometry, type MeshToonMaterial } from "three";
import { requestAlbedo } from "../rendering/AssetLibrary";
import {
  buildColorTexture,
  buildNormalTexture,
  fbm,
  ridged,
  voronoi,
} from "../rendering/ProceduralTexture";
import { smoothNormals } from "../rendering/SmoothNormals";
import { createToonMaterial } from "../rendering/ToonShading";
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
 * Nothing here is flat-shaded any more. A faceted stone is a *chiselled* one,
 * and chiselled is the shape language this pivot exists to leave behind: the
 * target is a boulder a picture book would draw, which is a big soft lump with
 * two or three broad values across it. The facets went out of the material and
 * out of the buffer together — see {@link weatherRock} — because turning the
 * material flag off on its own would have changed nothing.
 */
export function createRockMaterial(color: number): MeshToonMaterial {
  shared ??= {
    map: buildColorTexture(SIZE, (u, v) => {
      const h = rockHeight(u, v);
      const tone = 0.68 + h * 0.5;
      // Faintly cooler in the crevices, where less light reaches.
      return [tone, tone * (0.97 + h * 0.03), tone * (0.93 + h * 0.06)];
    }),
    normal: buildNormalTexture(SIZE, rockHeight, 0.07),
  };

  const material = createToonMaterial({
    color,
    map: shared.map,
    normalMap: shared.normal,
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
 * The displacement field a round rock is knocked out of shape with.
 *
 * The old one — a period of 6 at four octaves — was detail: four scales of
 * noise laid over each other put a wrinkle on every facet, and that is a
 * *chiselled* rock, weathered stone read off a photograph. What a picture-book
 * boulder has instead is one scale of lump and nothing finer, so this halves
 * the period (fewer, wider lumps around the body) and takes the octaves down to
 * two (a lump, and a suggestion of a second one on it).
 *
 * Amplitude has to go up to pay for it. The old profile got its silhouette from
 * the fine octaves, which nibble the outline everywhere; two octaves at the
 * same amount is most of the way back to a sphere, and a sphere is the other
 * failure — a marble, not a potato. A third again is where the outline is
 * clearly hand-made and still clearly one soft mass.
 */
const ROUND_PERIOD = 3;
const ROUND_OCTAVES = 2;
const ROUND_AMOUNT_GAIN = 1.3;

/** The profile the crevice geometry was tuned against; see `preserveProfile`. */
const CHISELLED_PERIOD = 6;
const CHISELLED_OCTAVES = 4;

export interface WeatherOptions {
  /** Peak radial displacement, as a fraction of the radius. */
  readonly amount?: number;
  /**
   * Only ever shrink the surface. The crevice mounds sit a few centimetres
   * behind a moray's head and are raycast for line of sight, so a mound that
   * can bulge outward can silently swallow the creature the whole game is
   * about. Inward-only displacement makes that impossible by construction.
   */
  readonly inwardOnly?: boolean;
  /**
   * Keep the old displacement field, and with it every vertex position this
   * geometry has today.
   *
   * The four crevices are not scenery. Their mounds and flanks are placed to
   * the centimetre so that a moray's head is occluded from the wrong angles and
   * clear from the right ones, and `tests/reefSightlines.test.ts` and the
   * discovery e2e are both tuned against the shapes they have now. Rounding
   * them off is a shape change *and* a gameplay change, and the two cannot be
   * told apart from a screenshot. So they take the new normals — which is what
   * the eye is actually reading — and none of the new geometry: with the field
   * unchanged the displacement is bit-identical, and the invariant holds by
   * construction rather than by a passing test.
   */
  readonly preserveProfile?: boolean;
}

/**
 * Roughens a platonic solid into something that reads as stone, and gives it
 * usable UVs and an algae tint.
 *
 * The d20/d12 silhouette was half the reason the rocks looked like programmer
 * art; no amount of surface detail fixes an obviously regular solid. Radial FBM
 * displacement breaks the regularity — at {@link ROUND_PERIOD}, into big soft
 * lumps rather than into strata.
 *
 * The order of the last four lines is load-bearing. `computeVertexNormals`
 * leaves a face normal on every vertex of these non-indexed shapes, which is
 * exactly what {@link boxProjectUvs} wants — all three corners of a triangle
 * agree on which way to project, so the mapping is coherent across it. Only
 * then are the normals welded smooth. Run the weld first and neighbouring
 * corners choose different projection planes, which warps the map inside the
 * triangle rather than at its edges.
 */
export function weatherRock(
  geometry: BufferGeometry,
  seed: number,
  { amount = 0.16, inwardOnly = false, preserveProfile = false }: WeatherOptions = {},
): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  const random = new Random(seed);
  const offsetX = random.range(0, 100);
  const offsetY = random.range(0, 100);
  const period = preserveProfile ? CHISELLED_PERIOD : ROUND_PERIOD;
  const octaves = preserveProfile ? CHISELLED_OCTAVES : ROUND_OCTAVES;
  const reach = preserveProfile ? amount : amount * ROUND_AMOUNT_GAIN;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const length = Math.hypot(x, y, z) || 1;

    // Sample the noise by direction so shared vertices displace identically and
    // the surface stays closed.
    const u = (Math.atan2(z, x) / (Math.PI * 2) + 0.5 + offsetX) % 1;
    const v = (Math.asin(Math.max(-1, Math.min(1, y / length))) / Math.PI + 0.5 + offsetY) % 1;
    const n = fbm(u, v, { seed, period, octaves });

    const scale = inwardOnly ? 1 - n * reach : 1 + (n - 0.5) * 2 * reach;
    position.setXYZ(i, x * scale, y * scale, z * scale);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  boxProjectUvs(geometry);
  smoothNormals(geometry);
  tintByFacing(geometry);
}

/**
 * Projects UVs along each face's dominant axis.
 *
 * Platonic geometries have unusable UVs, and the textbook fix — runtime
 * triplanar sampling — costs three fetches per map on surfaces this large.
 * Box projection is one fetch and free, and its seams land where a triangle's
 * dominant axis changes.
 *
 * Flat shading used to break the normal along those same edges and hide them.
 * It no longer does, so on a smooth-shaded boulder the seam is a visible change
 * of grain direction where the wash swings from one axis to another. It is
 * cheap to see and almost impossible to read as anything but rock: the maps it
 * lays down are low-contrast noise, and noise has no direction to contradict.
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
