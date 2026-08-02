import { type MeshToonMaterial, type Texture } from "three";
import { requestAlbedo } from "../rendering/AssetLibrary";
import { readImage, textureFromPixels } from "../rendering/ImagePixels";
import { buildColorTexture, buildNormalTexture, fbm } from "../rendering/ProceduralTexture";
import { applyFarClipDissolve, createToonMaterial } from "../rendering/ToonShading";
import { SEEDS } from "../util/Random";

const SIZE = 512;

/** How many times the procedural maps repeat across the 90m seabed. */
const SAND_REPEAT = 14;

/**
 * How many times the painted wash repeats across the same 90m.
 *
 * Half the procedural rate, and the reason is that the two maps are carrying
 * different things. The normal map's ripples were tuned at 14 as surface —
 * grain you read at a metre — and there is no argument for moving them. The
 * wash's ripples are the *drawing*: since the shading became a ramp the seabed
 * has no shading of its own to speak of (a flat plane sits in one band from
 * here to the fog line), so every mark on the largest surface in the frame now
 * comes out of this image. At 14 a painted ripple is 70cm across, which is two
 * or three pixels at the far end of shot B and gone into the mip chain; at 7 it
 * is a metre and a half and reads as a brush mark from anywhere in the scene.
 *
 * Mirrored repeat is what makes halving it safe: the tile meets itself at every
 * edge by construction, so the only thing a bigger tile risks is the mirror
 * *itself* becoming visible — and the wash has no line, edge or figure in it
 * for a reflection to be read off.
 */
const SAND_WASH_REPEAT = 7;

/**
 * What the painted wash is scaled by, and how far its marks are opened up.
 *
 * The current wash is the second painting of this tile. The first swung only
 * 4% peak to trough — two parts in 255 on a surface sitting near 200, under
 * the frame's own dither — and needed a 2.6× runtime opening to carry the
 * floor at all, plus a strong blue lift against its saturated yellow mix. It
 * was repainted to what those corrections said it should have been: measured
 * means (218, 201, 158), a p10–p90 ripple swing of ~10%, blue at 73% of red.
 *
 * The level lands the tile on the same after-level means the shipped seabed
 * was judged at — about #bab08a, i.e. (186, 176, 138) — so the frame's
 * exposure does not move with the repaint. The contrast stays a hair above 1
 * only to keep the mip chain from softening the marks in the middle distance;
 * the paint itself now carries them. Since WP-G2 there is nothing else left to
 * draw the floor: a ramp gives a flat plane one band from here to the fog
 * line, so the marks in this image are the only marks the seabed has.
 *
 * Both are applied to the painted bytes rather than to linear light, which is
 * the space the image was painted in and the space the swing was read in; the
 * file sits in the upper range of the curve where that distinction is under a
 * part in 255.
 */
const WASH_LEVEL = [0.86, 0.88, 0.88] as const;
const WASH_CONTRAST = 1.1;

/**
 * The seabed material: ripples, grain and damp patches.
 *
 * Sand is the largest thing on screen by a wide margin, so it is the surface
 * where texture buys the most. The ripples are the important part — a single
 * flat value reads as paper, and the directional bands immediately tell the eye
 * there is a current here and that the ground has a scale.
 *
 * There is no damp variation any more. It was a roughness map, and a roughness
 * map is a statement about a specular lobe that no longer exists: the seabed is
 * ramp-shaded now, so a wetter patch had nothing left to be wetter *with*. The
 * ripples it used to follow are still in the normal map, which is where the
 * light actually reads them.
 */
export function createSandMaterial(): MeshToonMaterial {
  const height = sandHeight;

  const material = createToonMaterial({
    // The colour of the seabed when there is no wash on disk, and it is a
    // pastel rather than the grey-gold it was. A build with no `public/assets`
    // has to be the same world in flatter paint — not the photographic one this
    // pivot started from — so the fallback is aimed at where the painted wash
    // actually lands (a mean of about #bab08a on the shipped path) instead of
    // at the darker tile it was mixed against. Still desaturated toward the
    // grey side of gold: a saturated base under a warm key tips the whole frame
    // ochre, which the wash's own level correction is fighting for the same
    // reason.
    color: 0xd9c9a3,
    map: buildSandAlbedo(),
    normalMap: buildNormalTexture(SIZE, height, 0.028),
    // Vertex colours carry the baked occlusion: dune troughs and contact
    // shadows under everything resting on the sand.
    vertexColors: true,
  });

  // Every region's ground sheet is built from this material, and the
  // ground sheets are the one surface vast enough to be CUT by the
  // camera's far plane in open frames (the wall-crossing razor line) —
  // they melt into the backdrop across the last visible metres instead.
  applyFarClipDissolve(material);

  for (const map of [material.map, material.normalMap]) {
    map?.repeat.set(SAND_REPEAT, SAND_REPEAT);
  }

  // The painted wash, when present. Albedo only, as every authored tile here
  // is: the ripples stay in the procedural normal map, and the wash is painted
  // shadow-free so the sun can move across it.
  requestAlbedo(
    "world/sand-wash.png",
    (texture) => {
      const opened = openWash(texture);
      opened.repeat.set(SAND_WASH_REPEAT, SAND_WASH_REPEAT);
      material.map = opened;
      // The wash carries its own colour, unlike the procedural map, which is
      // authored to sit under the tint. So the tint gets out of its way.
      material.color.set(0xffffff);
      material.needsUpdate = true;
    },
    { tile: true },
  );

  return material;
}

/**
 * The wash, levelled and opened up — see {@link WASH_LEVEL}.
 *
 * Memoised, because the reef's seabed and the sanctuary's floor both ask for
 * it and this is a megapixel of arithmetic. Both of them then set `repeat` on
 * the one texture they share, which is the arrangement the loaded tile already
 * had and is harmless while they agree on the number.
 *
 * The source is never edited: it belongs to the asset library, which hands the
 * same object to everyone. Without a DOM there is nothing to remap into and the
 * file is used as painted, which cannot happen in practice — nothing loads at
 * all without a `window` — but is what keeps this a pure function of its input.
 */
let openedWash: Texture | undefined;
function openWash(texture: Texture): Texture {
  if (openedWash) {
    return openedWash;
  }

  const pixels = readImage(texture);
  if (!pixels) {
    return texture;
  }

  const data = pixels.data;
  const count = data.length / 4;
  let meanR = 0;
  let meanG = 0;
  let meanB = 0;
  for (let i = 0; i < data.length; i += 4) {
    meanR += data[i] ?? 0;
    meanG += data[i + 1] ?? 0;
    meanB += data[i + 2] ?? 0;
  }
  const centres = [meanR / count, meanG / count, meanB / count];

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const centre = centres[c] ?? 0;
      const value =
        (centre + ((data[i + c] ?? 0) - centre) * WASH_CONTRAST) * (WASH_LEVEL[c] ?? 1);
      data[i + c] = value < 0 ? 0 : value > 255 ? 255 : value;
    }
  }

  openedWash = textureFromPixels(pixels, texture) ?? texture;
  return openedWash;
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

    // Ripple crests are dry and pale, troughs hold darker wet sand. Every term
    // is half what it was: this map is the fallback now, and its job changed
    // with that. It used to be the seabed's whole surface and was pushed as far
    // as it could go without reading as woven cloth; what it stands in for now
    // is a gouache wash, which is broad soft marks and no grain at all. Half is
    // where the ripples still say the ground has a scale and the grit stops
    // being a photograph of sand.
    let tone = 0.88 + h * 0.085 + (mottle - 0.5) * 0.055;
    // Sparse shell grit.
    if (flecks > 0.84) {
      tone += (flecks - 0.84) * 0.7;
    }

    // Near-neutral on purpose. The material's base colour carries the hue, and
    // tinting here as well stacked warm on warm and turned the seabed mustard.
    return [tone, tone * 0.985, tone * 0.955];
  });
}
