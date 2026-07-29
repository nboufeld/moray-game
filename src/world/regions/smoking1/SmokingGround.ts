import { BufferAttribute, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { smoothstep01 } from "./SmokingShared";
import {
  BASALT_STEP,
  CALDERA,
  CENTER_X,
  CENTER_Z,
  GORGE_TO,
  basaltWeight,
  calderaWeight,
  chimneysWeight,
  gorgeChannelCenter,
  gorgeChannelHalf,
  gorgeFloor,
  shoreWeight,
  spokeOf,
  springsStair,
  springsWeight,
  tongueHalfWidth,
} from "./SmokingTerrain";

/**
 * The Smoulder Fields' ground: five sheets and their authored paint.
 *
 * ## The tiling (the pilot's argument, rotated onto this spoke)
 *
 * The bowl's own seabed sheet ends at ±56, and this province's spoke runs
 * toward −x, so the gorge sheet begins exactly on the x = −56 line and
 * runs out to the disc tiles' near edge — overlapping them by three
 * metres and sunk 4 cm, the pilot's round-2 fix, so the T-junction
 * between different grids is backed by ground instead of cracking open
 * on the gorge's steep walls.
 *
 * ## The paint
 *
 * The sand wash carries the marks; the vertex colours carry the *place* —
 * value first, and in this region the value key runs on heat: charcoal
 * ash (a warm violet-grey, red above green, never black) is the resting
 * tone, the mineral is where the light lives (sinter rims, amber
 * staining, the caldera's ember veins), and the Vent Springs' floor
 * idiom — dark ground with amber pooled in the mottle — is reused and
 * *improved*: two mottle scales, staining that grows with the water's
 * warmth down the gorge, and bright painted values the wing never spent.
 */

const SEED = SEEDS.regionSmoking1;

/** Ground kept out to here from the disc's centre (the curtains stand inside). */
const DISC_GROUND_R = 240;

/** Disc tile edge length; two tiles span the disc with margin. */
const DISC_TILE = 231;
/** ~2.2 m per vertex on the disc, ~1.65 in the gorge — see the ledger note. */
const DISC_SEGMENTS = 104;
const GORGE_SEGMENTS = 78;

/** Where the bowl's own sheet ends and the gorge sheet must begin. */
const BOWL_SHEET_EDGE = -56;

function keepGround(x: number, z: number): boolean {
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  if (rc <= DISC_GROUND_R) {
    return true;
  }
  const { u, v } = spokeOf(x, z);
  return u >= 50 && u <= GORGE_TO && Math.abs(v) <= tongueHalfWidth(u) + 14;
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

/** Ash-drift mottle: pale wind-laid ribbons through the grey. */
function ashDrift(x: number, z: number): number {
  return fbm(x * 0.017, z * 0.017, { seed: SEED ^ 0xa5d1, period: 7, octaves: 3 });
}

/** Cinder mottle: the darker, sharper scatter under the drifts. */
function cinder(x: number, z: number): number {
  return fbm(x * 0.045, z * 0.045, { seed: SEED ^ 0xc1de, period: 11, octaves: 2 });
}

/**
 * The region's ground paint. Value first, then temperature; every tint
 * multiplies the sand wash, so 1 is "the bowl's own sand" and the biomes
 * pull it toward their own key.
 */
function bakeSmoulderPaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const { u, v } = spokeOf(x, z);

    // Value structure from the ground's own relief: the same fbm the
    // terrain adds as ground life, read back as shade.
    const life = fbm(x * 0.026, z * 0.026, { seed: SEED ^ 0x9e0a, period: 9, octaves: 2 }) - 0.5;
    let value = 0.9 + life * 0.4;

    // The ash flats: grey-violet, drawn at two scales — pale drift
    // ribbons over a darker cinder scatter. The base cut is hard because
    // the sand wash under it is strongly warm (the pilot's "a tile and a
    // tint cannot both carry the colour").
    const drift = smoothstep01((ashDrift(x, z) - 0.46) / 0.24);
    const cinders = smoothstep01((cinder(x, z) - 0.58) / 0.2);
    let r = 0.7 + drift * 0.16 - cinders * 0.16;
    let g = 0.66 + drift * 0.16 - cinders * 0.18;
    let b = 0.82 + drift * 0.1 - cinders * 0.08;

    if (u < GORGE_TO) {
      // The Black-Sand Gorge: charcoal floor with amber mineral staining
      // that grows as the water warms — the approach's whole story told
      // in the ground. The staining is the Vent Springs floor idiom,
      // improved: two scales, pooled in the channel, brightest where the
      // gorge is deepest.
      const warm = smoothstep01((u - 60) / 130);
      const inChannel =
        1 - smoothstep01((Math.abs(v - gorgeChannelCenter(u)) - gorgeChannelHalf(u)) / 7);
      const deep = smoothstep01((-gorgeFloor(u) - 6.5) / 2.2);
      const stain =
        smoothstep01((fbm(x * 0.08, z * 0.08, { seed: SEED ^ 0x44aa, period: 9, octaves: 3 }) - 0.48) / 0.18) *
        warm;
      // The walls are banded by height (round 2): charcoal at the
      // channel, a strata ripple up the face, a pale ash crest — so a
      // nine-metre wall is a drawn cliff, not a mauve dune.
      const wallT = smoothstep01((y - gorgeFloor(u)) / 8);
      const strata =
        Math.sin(y * 1.9 + fbm(x * 0.05, z * 0.05, { seed: SEED ^ 0x57a7, period: 6, octaves: 2 }) * 3) *
        0.06 *
        (1 - inChannel);
      const charcoalR = 0.44 + stain * 0.55 + wallT * 0.2 - deep * inChannel * 0.06;
      const charcoalG = 0.38 + stain * 0.3 + wallT * 0.18 - deep * inChannel * 0.08;
      const charcoalB = 0.56 - stain * 0.2 + wallT * 0.14 + deep * inChannel * 0.1;
      const s = 1 - smoothstep01((u - 250) / 42);
      r += (charcoalR - r) * s;
      g += (charcoalG - g) * s;
      b += (charcoalB - b) * s;
      value -= deep * inChannel * 0.1 * s;
      value += (stain * 0.12 + strata + wallT * 0.06) * s;
    }

    // The Basalt Steps: warm grey treads, violet risers. The riser is
    // found the way the terrain drew it — the bench fraction of the same
    // raw rise — so the paint lands exactly on the geometry's edges.
    const basalt = basaltWeight(u, v);
    if (basalt > 0) {
      const rawRise =
        10.4 * basalt +
        (fbm(x * 0.016, z * 0.016, { seed: SEED ^ 0xba5a, period: 7, octaves: 2 }) - 0.5) * 3;
      const frac = rawRise / BASALT_STEP - Math.floor(rawRise / BASALT_STEP);
      const riser = smoothstep01((frac - 0.68) / 0.14);
      const tread = 1 - riser;
      r += (0.62 + tread * 0.14 - r) * basalt;
      g += (0.56 + tread * 0.13 - g) * basalt;
      b += (0.72 + tread * 0.06 - b) * basalt;
      value += basalt * (tread * 0.08 - riser * 0.14);
    }

    // The Spring Terraces: pool floors milky sinter, rims bright — the
    // palest ground in the region — with amber staining down the risers
    // where the mineral water spills.
    const springs = springsWeight(u, v);
    if (springs > 0) {
      // Round 3: the terraces need CONTRAST to read as terraces — milky
      // pool hearts, amber-dark spill risers, and rims that are the
      // brightest painted value in the region.
      const { raw } = springsStair(u, v);
      const frac = raw / 1.1 - Math.floor(raw / 1.1);
      const rim = smoothstep01((frac - 0.66) / 0.14);
      const spill = smoothstep01((frac - 0.42) / 0.18) * (1 - rim);
      const heart = 1 - smoothstep01((frac - 0.4) / 0.2);
      // Round 5: three tints, not one — aqua-milk hearts, amber spill
      // risers, white rims. The stair reads by hue steps or not at all.
      r += (0.76 + heart * 0.1 + rim * 0.44 + spill * 0.32 - r) * springs;
      g += (0.72 + heart * 0.26 + rim * 0.42 + spill * 0.06 - g) * springs;
      b += (0.64 + heart * 0.3 + rim * 0.36 - spill * 0.22 - b) * springs;
      value += springs * (0.04 + rim * 0.26 - spill * 0.08);
    }

    // The Chimney Forest: the darkest resting ground, warm-charcoal with
    // ember-stain pools in the mottle — improved from the wing's floor:
    // the stain has a bright core here, because the forest floor is where
    // the vents breathe.
    const forest = chimneysWeight(u, v);
    if (forest > 0) {
      const stainField = fbm(x * 0.07, z * 0.07, { seed: SEED ^ 0xe8be, period: 8, octaves: 3 });
      const stain = smoothstep01((stainField - 0.55) / 0.2);
      const core = smoothstep01((stainField - 0.68) / 0.12);
      r += (0.48 + stain * 0.42 + core * 0.24 - r) * forest;
      g += (0.42 + stain * 0.2 + core * 0.08 - g) * forest;
      b += (0.58 - stain * 0.14 - b) * forest;
      value += forest * (stain * 0.08 + core * 0.12 - 0.1);
    }

    // The Caldera: deep violet floor — the darkest thing in the region is
    // this colour — cracked with radial ember veins that brighten toward
    // the Old Kiln at its centre.
    const caldera = calderaWeight(u, v);
    if (caldera > 0) {
      const d = Math.hypot(u - CALDERA.u, v - CALDERA.v);
      const theta = Math.atan2(v - CALDERA.v, u - CALDERA.u);
      const vein = smoothstep01(
        (fbm(theta * 2.2, d * 0.06, { seed: SEED ^ 0xcafe, period: 5, octaves: 2 }) - 0.62) / 0.12,
      );
      const nearKiln = 1 - smoothstep01((d - 8) / 26);
      r += (0.56 + vein * (0.5 + nearKiln * 0.3) - r) * caldera;
      g += (0.46 + vein * (0.22 + nearKiln * 0.1) - g) * caldera;
      b += (0.74 - vein * 0.24 - b) * caldera;
      value += caldera * (vein * (0.12 + nearKiln * 0.14) - 0.12);
    }

    // The Ember Shore: milky-warm, the distance rule written into the ground.
    const shore = shoreWeight(u);
    if (shore > 0) {
      r += (1.0 - r) * shore * 0.7;
      g += (0.94 - g) * shore * 0.7;
      b += (0.88 - b) * shore * 0.7;
      value += shore * 0.08;
    }

    // Contact shade under everything that stands on the ash.
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

    const total = value * shade;
    colors[i * 3] = Math.max(0.25, Math.min(1.3, r * total));
    colors[i * 3 + 1] = Math.max(0.25, Math.min(1.3, g * total));
    colors[i * 3 + 2] = Math.max(0.25, Math.min(1.3, b * total));
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** Builds the five painted ground sheets. */
export function buildSmokingGround(contacts: readonly ContactPatch[]): Mesh[] {
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
    trimSheet(geometry, keepGround);
    bakeSmoulderPaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "smoulder-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The gorge sheet: from the bowl sheet's x = −56 edge out to the disc
  // tiles' near edge, overlapping INTO the tiles by three metres and
  // sunk 4 cm (the pilot's seam fix). Round 4's cyan slashes were this
  // exact arithmetic with the sign flipped — a three-metre GAP at the
  // fog line instead of an overlap.
  const discEdgeX = CENTER_X + DISC_TILE;
  const gorgeSize = BOWL_SHEET_EDGE - (discEdgeX - 3);
  const gorgeGeometry = createSeabedGeometryAt(
    (BOWL_SHEET_EDGE + discEdgeX - 3) / 2,
    44,
    gorgeSize,
    GORGE_SEGMENTS,
    -0.04,
  );
  trimSheet(gorgeGeometry, keepGround);
  bakeSmoulderPaint(gorgeGeometry, contacts);
  const gorge = new Mesh(gorgeGeometry, material);
  gorge.name = "smoulder-ground-gorge";
  gorge.receiveShadow = true;
  meshes.push(gorge);

  return meshes;
}
