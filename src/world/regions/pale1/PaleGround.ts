import { BufferAttribute, Mesh, type PlaneGeometry } from "three";
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

/**
 * The region's ground paint. Value first, temperature second; every tint
 * multiplies the sand wash, so 1 is "the bowl's own sand" and the biomes
 * pull it toward their keys.
 */
function bakePalePaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const { u, v } = spokeOf(x, z);

    // Value structure from the ground's own relief: hollows a step deeper
    // in tone than swells — the cheapest honest occlusion.
    const life = fbm(x * 0.024, z * 0.024, { seed: SEED ^ 0x9d07, period: 9, octaves: 2 }) - 0.5;
    let value = 0.94 + life * 0.42;

    // The two whites. The warm/cool patching is a drawing at two scales,
    // not a wash — one flat lift reads as fogged beige (the pilot's
    // round-2 lesson translated into white).
    const cool = smoothstep01(
      (fbm(x * 0.014, z * 0.014, { seed: SEED ^ 0x5eaf, period: 6, octaves: 3 }) - 0.46) / 0.24,
    );
    // Warm paper-white base: red held up, blue eased down a touch...
    let r = 1.06 - cool * 0.1;
    let g = 1.07 - cool * 0.04;
    // ...and the cool patches lean violet: blue rises over green.
    let b = 0.96 + cool * 0.14;

    if (u < RAVINE_TO) {
      // The Chalk Ravine: plate-banded walls, violet shadow pooled in the
      // channel. The bands ride height above the channel floor at a 2.2 m
      // rhythm — stacked plates in paint where the benches carry them in
      // silhouette.
      const above = y - ravineFloor(u);
      const band = 0.5 + 0.5 * Math.sin((above / 2.2) * Math.PI * 2);
      const inChannel =
        1 - smoothstep01((Math.abs(v - ravineChannelCenter(u)) - ravineChannelHalf(u)) / 7);
      const s = 1 - smoothstep01((u - 250) / 42);
      const vr = 1.02 + band * 0.05 - inChannel * 0.16;
      const vg = 1.03 + band * 0.04 - inChannel * 0.22;
      const vb = 1.0 + band * 0.02 - inChannel * 0.04;
      r += (vr - r) * s;
      g += (vg - g) * s;
      b += (vb - b) * s;
      value -= inChannel * 0.12 * s;
    }

    // The Bone Forest floor: milk-white with violet thicket shade drifting
    // through it — the darkest thing in the white half is a colour.
    const forest = boneForestWeight(u, v);
    if (forest > 0) {
      const shade = smoothstep01(
        (fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x517b, period: 11, octaves: 3 }) - 0.52) / 0.2,
      );
      r += (1.0 - shade * 0.24 - r) * forest;
      g += (1.02 - shade * 0.32 - g) * forest;
      b += (1.02 - shade * 0.1 - b) * forest;
      value -= forest * shade * 0.08;
    }

    // The Quiet Gallery: the palest, most even ground in the region — the
    // austerity is in how little happens here. A whisper of warmth keeps
    // it paper, not plaster.
    const gallery = galleryWeight(u, v);
    if (gallery > 0) {
      r += (1.1 - r) * gallery;
      g += (1.1 - g) * gallery;
      b += (1.02 - b) * gallery;
      value += gallery * 0.1;
    }

    // The recovery: blush freckles first, then turf. Both are patchy
    // drawings gated by the story's own gradient.
    const k = recovery(u, v);
    if (k > 0) {
      const freckle = smoothstep01(
        (fbm(x * 0.05, z * 0.05, { seed: SEED ^ 0xb1d5, period: 13, octaves: 3 }) - 0.56) / 0.16,
      );
      const blush = Math.min(1, k * 2.2) * freckle;
      r += (1.12 - r) * blush * 0.5;
      g += (0.92 - g) * blush * 0.5;
      b += (0.98 - b) * blush * 0.5;

      const turfPatch = smoothstep01(
        (fbm(x * 0.021, z * 0.021, { seed: SEED ^ 0x70af, period: 8, octaves: 3 }) - 0.44) / 0.24,
      );
      const turf = smoothstep01((k - 0.35) / 0.5) * turfPatch;
      r += (0.98 - r) * turf;
      g += (0.9 - g) * turf;
      b += (0.66 - b) * turf;
    }

    // The Blooming Shelf beds deepen the turf's warmth where the gardens
    // stand; the grove bowl is the warmest ground in the region, deepening
    // to violet-rose at the heart — depth painted as colour, never black.
    const bloom = bloomWeight(u, v) * smoothstep01((k - 0.3) / 0.4);
    if (bloom > 0) {
      r += (1.04 - r) * bloom * 0.5;
      g += (0.88 - g) * bloom * 0.5;
      b += (0.72 - b) * bloom * 0.5;
    }
    const grove = groveWeight(u, v);
    if (grove > 0) {
      const d = Math.hypot(u - SEED_GROVE.u, v - SEED_GROVE.v);
      const heart = 1 - smoothstep01((d - 6) / 20);
      r += (1.02 - r) * grove;
      g += (0.86 - g) * grove;
      b += (0.8 - b) * grove;
      value -= grove * heart * 0.1;
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
    // multiplier bends blue up as it takes value down.
    const violet = 1 - shade;

    const total = value * shade;
    colors[i * 3] = Math.max(0.25, Math.min(1.3, r * total * (1 + violet * 0.06)));
    colors[i * 3 + 1] = Math.max(0.25, Math.min(1.3, g * total));
    colors[i * 3 + 2] = Math.max(0.25, Math.min(1.3, b * total * (1 + violet * 0.16)));
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
