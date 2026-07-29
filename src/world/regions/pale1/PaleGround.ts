import { BufferAttribute, Color, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { smoothstep01 } from "./PaleShared";
import {
  CENTER_X,
  CENTER_Z,
  RAVINE_TO,
  SEED_GROVE,
  bloomWeight,
  boneForestWeight,
  galleryWeight,
  groveWeight,
  ravineChannelCenter,
  ravineChannelHalf,
  ravineFloor,
  recovery,
  spokeOf,
  tongueHalfWidth,
} from "./PaleTerrain";

/**
 * The Bone Meadows' ground: five sheets and their authored paint.
 *
 * ## The tiling
 *
 * Four disc tiles in a 2×2 over the disc, trimmed to the domain. The
 * ravine runs diagonal to the world grid (azimuth 3.87), so its sheet is
 * one square over the gap between the bowl's own ±56 sheet and the tile
 * grid, trimmed hard to the tongue band, overlapped into both neighbours
 * and sunk 4 cm — the pilot's round-2 lesson: abutting different grids
 * cracks open on steep slopes; overlapped and sunk, the upper sheet
 * renders on top and the crack is backed by ground.
 *
 * ## The paint — the white half judged hardest
 *
 * The mandate's hard case: an all-pale world that still carries value
 * structure. The rules this bake holds:
 *
 * - The white is two whites: a warm paper-white on the lit swells, a
 *   violet-cool white in the hollows — never one grey.
 * - Every dark is a violet whose red stays above its green: channel
 *   shadow in the ravine, thicket shade in the Bone Forest, the grove
 *   bowl's depth.
 * - The chalk walls band by height (stacked plates as *paint* as well as
 *   silhouette).
 * - Colour returns by `recovery`: blush freckles first (patchy, drawn at
 *   two scales — a wash would read as tinted milk), then the garden
 *   floor's rose-gold turf, then the grove's warm heart.
 *
 * ## How the bake gets white out of a gold wash (rounds 1–3)
 *
 * The vertex colour *multiplies* the sand wash, whose levelled mean is
 * ≈ #bab08a — in linear light its blue is barely half its red. Rounds 1
 * and 2 wrote polite near-unit multipliers and the whole region rendered
 * tan: no multiplier that treats the channels alike can ever whiten a
 * gold ground. Round 3 rebuilt the bake as *absolute* paint: every rule
 * above composes a story colour directly, and only the last line divides
 * it by the wash's own mean, channel by channel, so the screen shows the
 * story colour and the wash's ripple marks survive as value grain. The
 * blue multiplier legitimately runs past 2 — that is the gold being
 * cancelled, not a tint gone wild.
 */

const SEED = SEEDS.regionPale1;

/** Ground kept out to here from the disc's centre (curtains stand inside). */
const DISC_GROUND_R = 240;

const DISC_TILE = 231;
/** ~2.2 m/vertex on the disc, ~1.35 in the ravine — the pilot's ledgered trade. */
const DISC_SEGMENTS = 104;
const RAVINE_SEGMENTS = 112;

/**
 * The ravine sheet: one square over the gap between the bowl's ±56 sheet
 * and the 2×2 tile grid. The spoke runs diagonal to the world axes, so
 * the tile grid only owns the whole tongue band past u ≈ 178 (its worst
 * corner is the +v shoulder); the square below covers u 46–188 with the
 * band's full width, centred on the spoke at u ≈ 127.
 */
const RAVINE_SHEET_X = -94;
const RAVINE_SHEET_Z = -86;
const RAVINE_SHEET_SIZE = 150;

function keepDisc(x: number, z: number): boolean {
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  if (rc <= DISC_GROUND_R) {
    return true;
  }
  const { u, v } = spokeOf(x, z);
  return u >= 160 && u <= RAVINE_TO && Math.abs(v) <= tongueHalfWidth(u) + 14;
}

function keepRavine(x: number, z: number): boolean {
  const { u, v } = spokeOf(x, z);
  return u >= 46 && u <= 188 && Math.abs(v) <= tongueHalfWidth(u) + 14;
}

/** Drops every triangle whose three corners all fail `keep`. */
function trimSheet(geometry: PlaneGeometry, keep: (x: number, z: number) => boolean): void {
  const position = geometry.attributes.position!;
  const index = geometry.getIndex();
  if (!index) {
    return;
  }
  const kept: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    if (
      keep(position.getX(a), position.getZ(a)) ||
      keep(position.getX(b), position.getZ(b)) ||
      keep(position.getX(c), position.getZ(c))
    ) {
      kept.push(a, b, c);
    }
  }
  geometry.setIndex(kept);
}

/** The wash's levelled mean (#bab08a) in linear light — see the header. */
const WASH_MEAN = new Color(0.729, 0.69, 0.541).convertSRGBToLinear();

/** A story colour, authored in sRGB and converted once to linear. */
function story(hex: number): Color {
  return new Color(hex).convertSRGBToLinear();
}

// The palette the bake composes with — absolute paint, not multipliers.
const PAPER_WARM = story(0xeee5d0);
const PAPER_COOL = story(0xdde0ef);
const SHADOW_VIOLET_GROUND = story(0x8d78ab);
const GALLERY_WHITE = story(0xf8f4e9);
const BLUSH_GROUND = story(0xe9b0c1);
const TURF_GOLD = story(0xc0a95c);
const BED_ROSE = story(0xd28a78);
const GROVE_ROSE = story(0xcf8090);
const GROVE_HEART = story(0xa9647f);

/**
 * The region's ground paint. The rules compose an absolute story colour
 * per vertex; the last step divides it by the wash's own linear mean so
 * the screen shows the story colour and the wash's ripple marks survive
 * as value grain.
 */
function bakePalePaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const col = new Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const { u, v } = spokeOf(x, z);

    // Value structure from the ground's own relief: hollows a step deeper
    // in tone than swells — the cheapest honest occlusion, kept gentle so
    // the white ground never reads as dirt.
    const life = fbm(x * 0.024, z * 0.024, { seed: SEED ^ 0x9d07, period: 9, octaves: 2 }) - 0.5;
    let value = 1.0 + life * 0.2;

    // The two whites: a warm paper-white patched with a violet-cool one,
    // drawn at the ~12 m scale so the white half is a painting, not a fill.
    const cool = smoothstep01(
      (fbm(x * 0.014, z * 0.014, { seed: SEED ^ 0x5eaf, period: 6, octaves: 3 }) - 0.46) / 0.24,
    );
    col.copy(PAPER_WARM).lerp(PAPER_COOL, cool);

    if (u < RAVINE_TO) {
      // The Chalk Ravine: strata bands as value rhythm up the walls, and
      // violet shadow pooled in the channel.
      const above = y - ravineFloor(u);
      const band = 0.5 + 0.5 * Math.sin((above / 2.2) * Math.PI * 2);
      const inChannel =
        1 - smoothstep01((Math.abs(v - ravineChannelCenter(u)) - ravineChannelHalf(u)) / 7);
      const s = 1 - smoothstep01((u - 250) / 42);
      value += (band - 0.5) * 0.14 * s;
      col.lerp(SHADOW_VIOLET_GROUND, inChannel * s * 0.5);
      value -= inChannel * 0.12 * s;
    }

    // The Bone Forest floor: violet thicket shade drifting through the
    // milk-white — the darkest thing in the white half is a colour.
    const forest = boneForestWeight(u, v);
    if (forest > 0) {
      const shade = smoothstep01(
        (fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x517b, period: 11, octaves: 3 }) - 0.52) / 0.2,
      );
      col.lerp(SHADOW_VIOLET_GROUND, forest * shade * 0.45);
      value -= forest * shade * 0.08;
    }

    // The Quiet Gallery: the palest, most even ground in the region — the
    // austerity is in how little happens here.
    const gallery = galleryWeight(u, v);
    if (gallery > 0) {
      col.lerp(GALLERY_WHITE, gallery);
      value += gallery * 0.06;
    }

    // The recovery: blush freckles first, then turf. Both are patchy
    // drawings gated by the story's own gradient.
    const k = recovery(u, v);
    if (k > 0) {
      const freckle = smoothstep01(
        (fbm(x * 0.05, z * 0.05, { seed: SEED ^ 0xb1d5, period: 13, octaves: 3 }) - 0.56) / 0.16,
      );
      col.lerp(BLUSH_GROUND, Math.min(1, k * 2.2) * freckle * 0.7);

      const turfPatch = smoothstep01(
        (fbm(x * 0.021, z * 0.021, { seed: SEED ^ 0x70af, period: 8, octaves: 3 }) - 0.44) / 0.24,
      );
      col.lerp(TURF_GOLD, smoothstep01((k - 0.35) / 0.5) * turfPatch * 0.8);
    }

    // The Blooming Shelf beds deepen the turf's warmth where the gardens
    // stand; the grove bowl is the warmest ground in the region, deepening
    // to violet-rose at the heart — depth painted as colour, never black.
    const bloom = bloomWeight(u, v) * smoothstep01((k - 0.3) / 0.4);
    if (bloom > 0) {
      col.lerp(BED_ROSE, bloom * 0.5);
    }
    const grove = groveWeight(u, v);
    if (grove > 0) {
      const d = Math.hypot(u - SEED_GROVE.u, v - SEED_GROVE.v);
      const heart = 1 - smoothstep01((d - 6) / 20);
      col.lerp(GROVE_ROSE, grove);
      col.lerp(GROVE_HEART, grove * heart * 0.6);
      value -= grove * heart * 0.06;
    }

    // Contact shade under everything that stands on the sand.
    let shade = 1;
    for (const contact of contacts) {
      const dx = x - contact.x;
      const dz = z - contact.z;
      if (Math.abs(dx) > contact.radius || Math.abs(dz) > contact.radius) {
        continue;
      }
      const distance = Math.hypot(dx, dz);
      if (distance < contact.radius) {
        const falloff = 1 - distance / contact.radius;
        shade *= 1 - contact.strength * falloff * falloff;
      }
    }
    // The white half's contact shadows are violet, not soot: the shade
    // bends toward the shadow colour as it takes value down.
    col.lerp(SHADOW_VIOLET_GROUND, (1 - shade) * 0.5);

    // The division: story colour over the wash's own mean, so the map's
    // marks survive as grain and the colour on screen is the one above.
    const total = value * (0.72 + shade * 0.28);
    colors[i * 3] = Math.max(0.2, Math.min(3.2, (col.r / WASH_MEAN.r) * total));
    colors[i * 3 + 1] = Math.max(0.2, Math.min(3.2, (col.g / WASH_MEAN.g) * total));
    colors[i * 3 + 2] = Math.max(0.2, Math.min(3.2, (col.b / WASH_MEAN.b) * total));
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** Builds the five painted ground sheets. */
export function buildPaleGround(contacts: readonly ContactPatch[]): Mesh[] {
  const material = createSandMaterial();
  const meshes: Mesh[] = [];

  const half = DISC_TILE / 2;
  const centers: [number, number][] = [
    [CENTER_X - half, CENTER_Z - half],
    [CENTER_X + half, CENTER_Z - half],
    [CENTER_X - half, CENTER_Z + half],
    [CENTER_X + half, CENTER_Z + half],
  ];
  for (const [cx, cz] of centers) {
    const geometry = createSeabedGeometryAt(cx, cz, DISC_TILE, DISC_SEGMENTS);
    trimSheet(geometry, keepDisc);
    bakePalePaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "pale-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The ravine sheet: sunk 4 cm under both the bowl sheet and the disc
  // tiles it overlaps, trimmed to the tongue band — see the module header.
  const ravineGeometry = createSeabedGeometryAt(
    RAVINE_SHEET_X,
    RAVINE_SHEET_Z,
    RAVINE_SHEET_SIZE,
    RAVINE_SEGMENTS,
    -0.04,
  );
  trimSheet(ravineGeometry, keepRavine);
  bakePalePaint(ravineGeometry, contacts);
  const ravine = new Mesh(ravineGeometry, material);
  ravine.name = "pale-ground-ravine";
  ravine.receiveShadow = true;
  meshes.push(ravine);

  return meshes;
}
