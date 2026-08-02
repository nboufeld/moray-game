import { BufferAttribute, Color, type BufferGeometry, type MeshToonMaterial } from "three";
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
 * What the tint is multiplied by once the painted wash is carrying the colour.
 *
 * The procedural map is authored to sit *under* a tint — it is near white, and
 * the material colour supplies the stone. A painted tile carries its own
 * colour, so leaving the tint alone would multiply the two and land every rock
 * well below the value it ships at. Sand had the same problem and answered it
 * by neutralising the tint to white, which works there because there is one
 * seabed.
 *
 * There is not one rock. `createRockMaterial` is called with a different colour
 * per rock family, and one of them is doing compositional work: the foreground
 * shoulder that crops shot A is `0x3a474a`, and a shoulder that is not darker
 * than the reef behind it is not a shoulder. Blending the tints toward white
 * would take that from 0.23 to 0.73 and flatten the frame. ({@link TINT_FLOOR}
 * does lift that shoulder now, but by value alone and by less than half of its
 * distance below the family — the order of the tints is the thing neither of
 * these is allowed to touch.)
 *
 * So the tint is *scaled* rather than washed out: a single multiply in linear
 * space, giving back the luminance the map stopped supplying. Every rock keeps
 * the value it has today and the ratios between them are untouched, because a
 * uniform scale cannot change a ratio — which is the whole point, since the
 * ratios are the rock-to-rock variation.
 *
 * The number moves with the file, and it is only ever the built texture's
 * linear luminance over the tile's. It was 2.85 for a limestone tile that
 * measured 0.27 against the built texture's 0.80, and 2.07 for the first
 * gouache wash at 0.3855. The repaint measures 0.3723 — a hair darker, because
 * it spends some of its value on colour — so the same ratio asks for 2.14.
 *
 * The families' own colours still need no adjustment, and now they are earning
 * it. They were always all but neutral (`0x8b9184` is four parts of
 * saturation), and where the first wash was a grey that leaned lavender in some
 * patches and sage in others — a swing of about 34 parts in red-minus-blue —
 * this one carries lavender, sage *and* ochre across a swing of 40, around a
 * mean that is itself 24 parts warmer. A near-neutral tint is a multiply that
 * cannot argue with any of it: the patches arrive as the stone's own colour.
 */
const TINT_LIFT = 2.14;

let shared: { map: ReturnType<typeof buildColorTexture>; normal: ReturnType<typeof buildNormalTexture> } | undefined;

/**
 * Layered strata plus cracks, as the two things they are used for.
 *
 * `form` is the rock's shape and drives the normal map — the fractures and the
 * blocky splits belong there, because that is where light actually reads them.
 * `wash` is what the colour map is painted from, and it is the same field with
 * the cracks and the joints at half: a drawn rock has its breaks in its
 * *drawing*, not in its local colour, and a crack that is dark as well as
 * creased is a crack read off a photograph. Both come out of one evaluation,
 * because the maps are built texel by texel over a 512² grid.
 */
function rockTerms(u: number, v: number): { form: number; wash: number } {
  const strata = fbm(u, v * 3.1, { seed: SEEDS.rock ^ 0x41, period: 5, octaves: 4 });
  const grain = fbm(u, v, { seed: SEEDS.rock ^ 0x93, period: 40, octaves: 3 });
  // Ridged noise carves the fractures; Voronoi walls add the blockier splits.
  const cracks = ridged(u, v, { seed: SEEDS.rock ^ 0x0d, period: 9, octaves: 3 });
  const { f1, f2 } = voronoi(u, v, 6, SEEDS.rock ^ 0xb7);
  const joints = Math.min(1, (f2 - f1) / 0.05);

  const bed = strata * 0.44 + grain * 0.2;
  const breaks = Math.pow(cracks, 3) * 0.22 + joints * 0.14;
  return { form: bed + breaks, wash: bed + breaks * 0.5 };
}

/** The height field the normal map is derived from. */
function rockHeight(u: number, v: number): number {
  return rockTerms(u, v).form;
}

/**
 * The hue of stone when there is no wash on disk, normalised so its largest
 * channel is 1 and it can only take colour out.
 *
 * The procedural map is authored to sit under a tint, and the tints are all but
 * neutral, so before this the fallback rock had no hue but the faint warm one
 * written into the map — which was mixed to look like limestone. A build with
 * no assets should be the same world in flatter paint rather than a different
 * one, so the map carries the wash's own mean instead.
 *
 * It tracks the file. The first wash averaged a grey leaning blue and this is
 * written as its mean, (0xaa, 0xa3, 0x9a) — a warm grey, because the repaint
 * moved the whole tile 24 parts warmer in red-minus-blue. The lavender and the
 * sage are patches *within* that mean and a single hue cannot stand in for
 * them; what it can do is stop the assetless build reading as a different rock
 * from the shipping one.
 */
const WASH_HUE = [1, 0xa3 / 0xaa, 0x9a / 0xaa] as const;

/**
 * The value the stone family sits at, and how much of a darker tint's distance
 * below it survives.
 *
 * Every rock in the reef and the sanctuary shares one map, so the only thing
 * that separates a sea stack from a foreground shoulder is the tint it is
 * given — and two of those tints were written when this world was lit like a
 * photograph, where a dark mass is how you build depth. Under a painted key it
 * is how you put a hole in the picture: the sanctuary's near stack rendered at
 * 114 of luma against water at 189, and the reef's foreground shoulder at 80
 * against 175. Both read as slabs of a different, heavier world laid over this
 * one, and neither is far off the "nothing anywhere near black" the value key
 * turns on.
 *
 * A floor rather than a brightening, and a soft one rather than a clamp. The
 * shoulder is *doing something* — it crops the left of shot A and it is only a
 * repoussoir while it is darker than the reef behind it — so what this must not
 * do is flatten the order the tints are in. Taking 55% of the distance below
 * the floor out keeps every rock in its place and pulls the bottom of the range
 * up into the family: the shoulder goes from 0.268 of perceived value to 0.407
 * and the sanctuary's near stack from 0.406 to 0.469, while the two mid-grey
 * families above the floor are untouched to the bit.
 *
 * The lift is a scale in sRGB, so hue and saturation are exactly preserved and
 * only value moves — which is what "toward the pastel family" has to mean for a
 * stone whose actual colour is coming from a painted wash.
 */
const TINT_FLOOR = 0.52;
const TINT_FLOOR_KEEP = 0.45;

/** Perceived value on sRGB numerals; see `MorayOutline`'s note on the space. */
function value(srgb: Color): number {
  return 0.2126 * srgb.r + 0.7152 * srgb.g + 0.0722 * srgb.b;
}

/** A rock family's tint, with the bottom of the range lifted into the family. */
function liftDarkTint(color: number): Color {
  const tint = new Color(color).convertLinearToSRGB();
  const level = value(tint);
  if (level >= TINT_FLOOR || level <= 0) {
    return tint.convertSRGBToLinear();
  }
  const lifted = TINT_FLOOR - (TINT_FLOOR - level) * TINT_FLOOR_KEEP;
  return tint.multiplyScalar(lifted / level).convertSRGBToLinear();
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
export interface RockMaterialOptions {
  /**
   * Hard-geometry purge, stretch #11: how far the painted wash's HUE
   * swing is calmed toward its own value, 0–1. The shared wash carries
   * lavender, sage and ochre patches; under great-blue's cool register
   * the ochre reads as orange mottling fighting the soft key (the
   * gnomon and the mooring arch, `JOURNEY-great-blue-04/-08`). Calming
   * desaturates only the SAMPLED WASH in-shader — value grain, the
   * material tint and the vertex algae stay exactly as they were.
   */
  readonly washCalm?: number;
}

export function createRockMaterial(color: number, options?: RockMaterialOptions): MeshToonMaterial {
  shared ??= {
    map: buildColorTexture(SIZE, (u, v) => {
      // Half the swing it had, at the same mean, for the reason the sand's
      // fallback lost half of its: this map stands in for a wash now.
      const tone = 0.78 + rockTerms(u, v).wash * 0.25;
      return [tone * WASH_HUE[0], tone * WASH_HUE[1], tone * WASH_HUE[2]];
    }),
    normal: buildNormalTexture(SIZE, rockHeight, 0.07),
  };

  const material = createToonMaterial({
    color: liftDarkTint(color),
    map: shared.map,
    normalMap: shared.normal,
    // Algae tinting is baked per-vertex from the surface normal.
    vertexColors: true,
  });

  const washCalm = options?.washCalm ?? 0;
  if (washCalm > 0) {
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      previous?.call(material, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
         vec4 rockWashTexel = texture2D( map, vMapUv );
         float rockWashValue = dot(rockWashTexel.rgb, vec3(0.2126, 0.7152, 0.0722));
         rockWashTexel.rgb = mix(rockWashTexel.rgb, vec3(rockWashValue), ${washCalm.toFixed(2)});
         diffuseColor *= rockWashTexel;
         #endif`,
      );
    };
    const baseKey = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = () => `${baseKey()}|rock-wash-calm-${washCalm.toFixed(2)}`;
  }

  // The painted wash, when present. Albedo only: the strata, the cracks and the
  // Voronoi joints live in the procedural normal map, which is the rock's form
  // and is not something a shadow-free colour tile can carry. The box-projected
  // UVs are untouched as well — the wash is laid over them at
  // {@link TILE_REPEAT}, so a swap moves no vertex and re-seams nothing.
  requestAlbedo(
    "world/rock-wash.png",
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
