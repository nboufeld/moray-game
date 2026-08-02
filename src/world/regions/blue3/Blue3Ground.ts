import { BufferAttribute, Color, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { chainDistance } from "./Blue3Beats";
import { B3_SEEDS, smoothstep01 } from "./Blue3Shared";
import {
  ANCHOR,
  CENTER_X,
  CENTER_Z,
  DOORSTEP,
  FALL_FROM,
  MERE_FLOOR,
  OVERBRIM,
  PANS,
  PEARL,
  cradleCarve,
  cradleDistance,
  fallDrop,
  passGate,
  passHalfWidth,
  spokeOf,
  wellD,
  worldOf,
} from "./Blue3Terrain";

/**
 * THE FIRST SEA's ground: five sheets and their authored paint.
 *
 * ## The tiling
 *
 * Four disc tiles in a 2×2 grid over the disc, plus one pass sheet
 * running the Morning Shelf back up the Worldwall's outer face. The
 * pass sheet begins at u ≈ 1168 — just past where the Deep Steps' own
 * disc tiles tuck their outer trim under (their sheets keep rc ≤ 240
 * = u ≤ 1180, trim drooped to −8 from rc 232 ≈ u 1172) — and is sunk
 * 4 cm (the standing T-junction discipline). Nothing else is built on
 * the wall.
 *
 * ## The paint
 *
 * The vertex colours carry the PLACE as absolute stories (story ÷ wash
 * mean, the province's proven move). The register is the region's
 * whole argument: the deepest floor of the world does not go darker —
 * it turns toward morning. Milky shelf → the Longfall's long combed
 * fall, paling rose at the crest → the Mere's deep violet strewn with
 * THE STAR-BLOOM (pale warm specks, brightest inside the Wide
 * Morning: the rest is the region's most beautiful floor, composed,
 * not thin) → the Cradle's glass-green ribbon → the Wellhead's pale
 * crater with the Daybreak's painted circle in its bowl → the pans'
 * still starwater → the Hem paling upward with the dawn-rose bleeding
 * over its crest. Red above green everywhere; never cobalt; the
 * darkest floor is a colour.
 */

const SEED = SEEDS.regionBlue3;

const CENTRE = worldOf(1460, 0);

/** Ground kept out to here from the disc's centre. */
const DISC_GROUND_R = 240;
const DISC_TILE = 231;
const DISC_SEGMENTS = 104;
const PASS_SEGMENTS = 64;

function keepGround(x: number, z: number): boolean {
  const rc = Math.hypot(x - CENTRE.x, z - CENTRE.z);
  if (rc <= DISC_GROUND_R) {
    return true;
  }
  const { u, v } = spokeOf(x, z);
  return u >= 1168 && u <= 1290 && Math.abs(v) <= passHalfWidth(u) + 12;
}

/** The wash's levelled mean (#bab08a) in linear light (the pilot's number). */
const WASH_MEAN = new Color(0.729, 0.69, 0.541).convertSRGBToLinear();

/** A story colour, authored in sRGB and converted once to linear. */
function story(hex: number): Color {
  return new Color(hex).convertSRGBToLinear();
}

// The palette the bake composes with — authored for THIS region's
// violet-rose mood (fill palettes are for the region's own light).
const MILKY_SHELF = story(0xe8e6dc);
const FALL_ROSE = story(0xc8b8c2);
const FALL_VIOLET = story(0x9484ae);
const MERE_VIOLET_STORY = story(0x685c90);
const SILT_DRIFT = story(0xc4bcce);
const STAR_BLOOM = story(0xf0e8de);
const CRADLE_GLASS = story(0xbfe0d2);
const CRADLE_BANK = story(0xb2d0be);
const WELL_PALE = story(0xe6e0d6);
const DAYBREAK_BRIGHT = story(0xf2ece0);
const PAN_WATER = story(0xe4dcd8);
const HEM_MILK = story(0xd2d4d2);
const HEM_ROSE = story(0xe6d0c4);
const SHADOW_VIOLET = story(0x76689a);

/**
 * The star-bloom: the Mere's field of first light — small sharp pale
 * specks strewn in seeded constellations across the deep violet,
 * densest and brightest in the Wide Morning, over a FAINT broad
 * under-drift. Round 2: the r1 speck scale (~3 m blobs) read as
 * dapple pools, not stars — frequency ×2.5, threshold sharpened.
 */
function starBloom(
  x: number,
  z: number,
  u: number,
  v: number,
): { speck: number; drift: number } {
  const specks = fbm(x * 0.85, z * 0.85, { seed: SEED ^ B3_SEEDS.paintStars, period: 23, octaves: 2 });
  const drift = fbm(x * 0.017, z * 0.017, { seed: SEED ^ B3_SEEDS.paintSilt, period: 6, octaves: 2 });
  // Two bright fields: the Wide Morning, and (round 3) the pans'
  // approach — the starwater rest's own floor was reading bare.
  const morning = Math.max(
    1 - smoothstep01((Math.hypot(u - 1374, v + 58) - 30) / 40),
    (1 - smoothstep01((Math.hypot(u - 1416, v + 110) - 24) / 28)) * 0.75,
  );
  const threshold = 0.78 - drift * 0.06 - morning * 0.04;
  const speck =
    specks <= threshold
      ? 0
      : smoothstep01((specks - threshold) / 0.07) * (0.6 + morning * 0.4);
  // Round 3: the under-drift halved — at 40 m the r2 drift patches
  // read as beige blotches leading the specks instead of under them.
  const under = smoothstep01((drift - 0.56) / 0.2) * (0.1 + morning * 0.07);
  return { speck, drift: under };
}

/**
 * The region's ground paint — value first: the world's deepest floor,
 * turning toward morning.
 */
function bakeFirstSeaPaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const col = new Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const { u, v } = spokeOf(x, z);
    const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

    // Value structure from the ground's own relief.
    const life =
      fbm(x * 0.026, z * 0.026, { seed: SEED ^ B3_SEEDS.paintLife, period: 9, octaves: 2 }) - 0.5;
    let value = 0.95 + life * 0.26;

    // The silt drift: pale ribbons the deep water lays down everywhere.
    const silt = smoothstep01(
      (fbm(x * 0.016, z * 0.016, { seed: SEED ^ B3_SEEDS.paintSilt, period: 6, octaves: 3 }) -
        0.46) /
        0.26,
    );

    // ── The place stories, keyed along the journey ──
    if (u < 1178) {
      // The Worldwall's outer face: the Deep Steps' own register
      // continued — violet at the drowned foot, milky at the crest.
      const depthK = smoothstep01((-y - 3) / 30);
      col.copy(HEM_MILK).lerp(story(0x8478aa), depthK * 0.85);
      col.lerp(SILT_DRIFT, silt * 0.3 * (1 - depthK));
      value *= 1 - depthK * 0.16;
    } else if (u < FALL_FROM) {
      // The Morning Shelf: the world's last milky threshold. Round 2:
      // whitened a step — the r1 shelf read as bare warm tan.
      col.copy(MILKY_SHELF);
      col.lerp(SILT_DRIFT, silt * 0.18);
      value *= 1.14;
    } else {
      // The fall and the floor: the story runs on the drop itself —
      // the longest gradient in the game, rose crest to violet Mere.
      const fall = Math.min(1, Math.max(0, fallDrop(u, v) / MERE_FLOOR));
      const steepK = Math.min(1, 4 * fall * (1 - fall));
      col.copy(FALL_ROSE).lerp(FALL_VIOLET, smoothstep01((fall - 0.12) / 0.5));
      col.lerp(MERE_VIOLET_STORY, smoothstep01((fall - 0.55) / 0.45));
      col.lerp(SILT_DRIFT, silt * 0.3 * (1 - steepK * 0.8) * (1 - fall * 0.5));
      // The fall's face is combed and runnelled (round 2: amplitude up
      // hard — the r1 face fogged to one flat plane from the Mere.
      // Round 3: a 2–5 m fine octave joins — the sweep's down-look
      // graze at four metres found a face with no grain at its scale).
      if (fall > 0.02 && fall < 0.98) {
        const comb =
          fbm(v * 0.12, u * 0.014, { seed: SEED ^ B3_SEEDS.paintFall, period: 7, octaves: 2 }) -
          0.5;
        const runnel =
          fbm(v * 0.05, u * 0.006, { seed: SEED ^ (B3_SEEDS.paintFall + 3), period: 5, octaves: 2 }) -
          0.5;
        const fine =
          fbm(x * 0.42, z * 0.42, { seed: SEED ^ (B3_SEEDS.paintFall + 7), period: 15, octaves: 2 }) -
          0.5;
        value *= 1 + (comb * 0.36 + Math.max(0, runnel) * 0.24 + fine * 0.22) * steepK;
        col.lerp(SHADOW_VIOLET, Math.max(0, -runnel) * 0.6 * steepK);
        col.lerp(MILKY_SHELF, Math.max(0, runnel) * 0.3 * steepK);
      }
      value *= 1 - fall * 0.05;

      // THE STAR-BLOOM: the field of first light, waking on the fall's
      // lower half and fully lit across the Mere.
      const bloom = starBloom(x, z, u, v);
      const wake = smoothstep01((fall - 0.55) / 0.3);
      if (bloom.drift > 0) {
        col.lerp(SILT_DRIFT, bloom.drift * wake);
      }
      if (bloom.speck > 0) {
        col.lerp(STAR_BLOOM, bloom.speck * 0.95 * wake);
        value *= 1 + bloom.speck * 0.3 * wake;
      }
    }

    // The Chain's wear-line: a pale drag mark under the links, so the
    // line reads as one drawn stroke from the fall's foot to the ring.
    const chainD = chainDistance(u, v);
    if (chainD < 6 && u > 1320) {
      const wear = 1 - smoothstep01(chainD / 6);
      col.lerp(SILT_DRIFT, wear * 0.4);
      value *= 1 + wear * 0.08;
    }
    // The Anchor's shadow-stain: the great shape sits IN the silt.
    const anchorD = Math.hypot(u - ANCHOR.u, v - ANCHOR.v);
    if (anchorD < 14) {
      const stain = 1 - smoothstep01((anchorD - 4) / 9);
      col.lerp(SHADOW_VIOLET, stain * 0.35);
      value *= 1 - stain * 0.08;
    }

    // The Cradle: glass-green over pale levees — the young river,
    // painted so it reads even where the particulates rest.
    const cradle = cradleCarve(u, v);
    if (cradle.bed > 0) {
      const { d: cd } = cradleDistance(u, v);
      const centreLine = 1 - smoothstep01(cd / 3.2);
      col.lerp(CRADLE_BANK, cradle.bed * 0.8);
      col.lerp(CRADLE_GLASS, centreLine * 0.95);
      value *= 1 + centreLine * 0.3;
    }
    const bankStain = 1 - smoothstep01((cradleDistance(u, v).d - 7) / 12);
    if (bankStain > 0 && u > 1400 && wellD(u, v) > 24) {
      col.lerp(CRADLE_BANK, bankStain * 0.14 * (0.5 + silt * 0.5));
    }

    // THE WELLHEAD: the pale crater, and the Daybreak's painted circle
    // at the bottom of the world. Round 2: the pale story extends down
    // the outer skirt — the r1 flank read as tan mud.
    const wd = wellD(u, v);
    if (wd < 48) {
      const rim = smoothstep01((wd - 6) / 8) * (1 - smoothstep01((wd - 30) / 14));
      const skirt = smoothstep01((wd - 20) / 6) * (1 - smoothstep01((wd - 30) / 16));
      col.lerp(WELL_PALE, rim * 0.7 + skirt * 0.3);
      // Concentric breath-rings on the rim, like ripples of light —
      // plus (round 3) a fine grain across the whole mound face: the
      // r2 crater filled sixty percent of its portrait as one smooth
      // tan surface.
      const ripple = Math.sin(wd * 1.5);
      const mound =
        fbm(x * 0.48, z * 0.48, { seed: SEED ^ (B3_SEEDS.paintWall + 13), period: 21, octaves: 2 }) -
        0.5;
      value *= 1 + rim * (0.14 + ripple * 0.07) + skirt * 0.06 + (rim + skirt) * mound * 0.24;
      const bowl = 1 - smoothstep01((wd - 5) / 6);
      if (bowl > 0) {
        col.lerp(DAYBREAK_BRIGHT, bowl * 0.9);
        value *= 1 + bowl * 0.28;
      }
    }
    // The Overbrim's spill-streak, out of the notch toward the Cradle.
    const brimD = Math.hypot(u - OVERBRIM.u, v - OVERBRIM.v);
    if (brimD < 12) {
      const streak = 1 - smoothstep01((brimD - 3) / 8);
      col.lerp(CRADLE_GLASS, streak * 0.5);
      value *= 1 + streak * 0.08;
    }

    // THE STARWATER PANS: still dishes of held light (round 2: value
    // up — the r1 pans read as faint smears at thirty metres; round
    // 5: the LIGHT ITSELF — a star-bright core in each dish, value up
    // again: the r4 dishes read as pale sand, not held water).
    for (const pan of PANS) {
      const pd = Math.hypot(u - pan.u, v - pan.v);
      if (pd < pan.radius * 1.8) {
        const water = 1 - smoothstep01((pd - pan.radius * 0.75) / (pan.radius * 0.35));
        const lip =
          smoothstep01((pd - pan.radius * 0.85) / 1.5) *
          (1 - smoothstep01((pd - pan.radius * 1.4) / 2));
        col.lerp(PAN_WATER, water * 0.92);
        col.lerp(STAR_BLOOM, water * water * 0.6);
        col.lerp(SHADOW_VIOLET, lip * 0.25);
        value *= 1 + water * 0.55 + water * water * 0.25 - lip * 0.05;
      }
    }

    // The Pearl's fold: a soft pale bed under the secret, and the
    // contact shade that seats the orb (round 2: it hovered).
    const pearlD = Math.hypot(u - PEARL.u, v - PEARL.v);
    if (pearlD < 8) {
      const bed = 1 - smoothstep01((pearlD - 2) / 5);
      col.lerp(STAR_BLOOM, bed * 0.5);
      value *= 1 + bed * 0.1;
      const seat = 1 - smoothstep01((pearlD - 0.7) / 0.9);
      col.lerp(SHADOW_VIOLET, seat * 0.5);
      value *= 1 - seat * 0.25;
    }

    // The Doorstep's rise: milky, the world's last floor — flecked
    // (round 3): the rest licenses bareness of FILL, not of paint;
    // the r2 rise was one smooth gradient at the bench's feet.
    const doorD = Math.hypot(u - DOORSTEP.u, v - DOORSTEP.v);
    if (doorD < 30) {
      const rise = 1 - smoothstep01((doorD - 10) / 18);
      const fleck =
        fbm(x * 0.6, z * 0.6, { seed: SEED ^ (B3_SEEDS.paintStars + 4), period: 19, octaves: 2 }) -
        0.5;
      // Round 4: the r3 threshold (0.18) left the flecks under the
      // shutter's floor — the rise still read as one smooth gradient.
      col.lerp(MILKY_SHELF, rise * 0.55);
      col.lerp(STAR_BLOOM, rise * Math.max(0, fleck - 0.1) * 2.2);
      value *= 1 + rise * (0.1 + fleck * 0.2);
    }

    // THE HEM and the corridor's flank walls: every standing face
    // pales upward, the morning bleeding rose over the crest. Round 2:
    // the wall term also keys on the face itself (the corridor flanks
    // at rc < 176 carried NO wall story and fogged to flat planes),
    // and the value swing + a fine grain go up hard — fog eats half of
    // any amplitude (the blue-2 slab lesson, paid in paint).
    // Round 4, the wall-foot verdict: the r3 hem ramp `(rc − 164)/34`
    // left the paint at 5–50 % where the sweep grazes actually stood
    // (rc 172–195) — the story now reaches FULL VOICE at the foot,
    // the swing goes up again, the crest takes a light band (a far
    // wall must read as a drawn line at 90 m), and a violet-grey toe
    // mottle seats the wall on the floor.
    const hemK = smoothstep01((rc - 162) / 18) * smoothstep01((u - 1244) / 30);
    const flankK =
      u > 1248 && u < 1380
        ? smoothstep01((y - (fallDrop(u, v) + 1.5)) / 9) * smoothstep01((Math.abs(v) - 38) / 12)
        : 0;
    const wallK = Math.max(hemK, flankK);
    if (wallK > 0) {
      const contour = Math.sin(y * 0.9 + silt * 2);
      const runnel =
        fbm(u * 0.06, v * 0.06, { seed: SEED ^ B3_SEEDS.paintWall, period: 9, octaves: 2 }) - 0.5;
      const grain =
        fbm(u * 0.34, v * 0.34, { seed: SEED ^ (B3_SEEDS.paintWall + 5), period: 13, octaves: 2 }) -
        0.5;
      // Round 3: the 1–3 m octave the graze frames were missing, and
      // pale streak colour riding it — value alone dies under fog.
      const fine =
        fbm(x * 0.55, z * 0.55 + y * 0.3, {
          seed: SEED ^ (B3_SEEDS.paintWall + 9),
          period: 17,
          octaves: 2,
        }) - 0.5;
      const height = smoothstep01((y + 30) / 30);
      const crest = smoothstep01((y + 18) / 9);
      col.lerp(HEM_MILK, wallK * (0.5 + 0.2 * height));
      col.lerp(HEM_ROSE, wallK * height * height * 0.6);
      col.lerp(SHADOW_VIOLET, wallK * Math.max(0, -runnel) * 0.9);
      // Round 5: the milk rides the +runnel too — the r4 east face
      // (sweep 09, twenty to sixty metres out) still fogged to one
      // plane: value swings die at that range, only 8–16 m COLOUR
      // streaks survive it.
      col.lerp(MILKY_SHELF, wallK * Math.max(0, runnel) * 0.55);
      col.lerp(MILKY_SHELF, wallK * (Math.max(0, fine) * 0.5 + crest * 0.5));
      col.lerp(SHADOW_VIOLET, wallK * Math.max(0, -fine) * 0.4);
      value *=
        1 + wallK * (0.12 + contour * 0.26 + runnel * 0.26 + grain * 0.16 + fine * 0.42 + crest * 0.14);
    }

    // The toe: where the Hem meets the floor, a violet-grey debris
    // mottle (1–3 m) — the junction the graze cones stand over.
    const toe = smoothstep01((rc - 154) / 8) * (1 - smoothstep01((rc - 170) / 8));
    if (toe > 0 && u > 1244) {
      const mottle =
        fbm(x * 0.5, z * 0.5, { seed: SEED ^ (B3_SEEDS.paintWall + 11), period: 15, octaves: 2 }) -
        0.5;
      col.lerp(MILKY_SHELF, toe * Math.max(0, mottle) * 0.45);
      col.lerp(SHADOW_VIOLET, toe * Math.max(0, -mottle) * 0.5);
      value *= 1 + toe * mottle * 0.22;
    }

    // Depth is the dimmer — but gently here: the Mere carries its own
    // light. Red held above green, never cobalt.
    const depthK = smoothstep01((-y - 30) / 26);
    if (depthK > 0 && u >= 1178) {
      col.lerp(MERE_VIOLET_STORY, depthK * 0.22);
      value *= 1 - depthK * 0.06;
    }

    // Contact shade under everything that stands on the silt.
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

    // The one absolute step: story ÷ wash mean, channel by channel.
    const total = value * shade;
    colors[i * 3] = Math.max(0.12, Math.min(2.4, (col.r / WASH_MEAN.r) * total));
    colors[i * 3 + 1] = Math.max(0.12, Math.min(2.4, (col.g / WASH_MEAN.g) * total));
    colors[i * 3 + 2] = Math.max(0.12, Math.min(2.4, (col.b / WASH_MEAN.b) * total));
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/**
 * Tucks the disc tiles' outermost trim edge under the crest: a flat
 * cut edge at dune level silhouettes as a razor line on distant
 * horizons (the province's twice-paid lesson). Gated off the corridor,
 * whose own sheet carries the crossing.
 */
function tuckTrimEdge(geometry: PlaneGeometry): void {
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const rc = Math.hypot(x - CENTRE.x, z - CENTRE.z);
    if (rc <= 230) {
      continue;
    }
    const { u, v } = spokeOf(x, z);
    const k = smoothstep01((rc - 232) / 8) * (1 - passGate(u, v));
    if (k > 0) {
      position.setY(i, position.getY(i) + k * (-8 - position.getY(i)));
    }
  }
  position.needsUpdate = true;
}

/**
 * Droops the pass sheet's trim edges (blue-2's rounds 3–4 lesson,
 * pre-paid): a raw lateral or end cut seen edge-on saws the frame.
 * The last metres of width sag below the composed ground; the u-end
 * sag deepens across the wall's steep band.
 */
function droopPassEdge(geometry: PlaneGeometry): void {
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const { u, v } = spokeOf(x, z);
    const k = Math.max(
      smoothstep01((Math.abs(v) - (passHalfWidth(u) + 3)) / 7),
      smoothstep01((1173 - u) / 5),
    );
    if (k > 0) {
      const sag = 3.5 + 4 * smoothstep01((1180 - u) / 12);
      position.setY(i, position.getY(i) - k * sag);
    }
  }
  position.needsUpdate = true;
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

/** Builds the five painted ground sheets. */
export function buildBlue3Ground(contacts: readonly ContactPatch[]): Mesh[] {
  const material = createSandMaterial();
  const meshes: Mesh[] = [];

  const half = DISC_TILE / 2;
  const centers: [number, number][] = [
    [CENTRE.x - half, CENTRE.z - half],
    [CENTRE.x + half, CENTRE.z - half],
    [CENTRE.x - half, CENTRE.z + half],
    [CENTRE.x + half, CENTRE.z + half],
  ];
  for (const [cx, cz] of centers) {
    const geometry = createSeabedGeometryAt(cx, cz, DISC_TILE, DISC_SEGMENTS);
    trimSheet(geometry, keepGround);
    tuckTrimEdge(geometry);
    bakeFirstSeaPaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "firstsea-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The pass sheet: the Morning Shelf and the Worldwall's outer face,
  // from just past the Deep Steps' own trim tuck (their sheets droop
  // under from rc 232 ≈ u 1172), sunk 4 cm under our disc tiles.
  const passMid = worldOf(1228, 0);
  const passGeometry = createSeabedGeometryAt(passMid.x, passMid.z, 132, PASS_SEGMENTS, -0.04);
  trimSheet(passGeometry, (x, z) => {
    const { u, v } = spokeOf(x, z);
    return u >= 1168 && u <= 1290 && Math.abs(v) <= passHalfWidth(u) + 10;
  });
  droopPassEdge(passGeometry);
  bakeFirstSeaPaint(passGeometry, contacts);
  const pass = new Mesh(passGeometry, material);
  pass.name = "firstsea-ground-pass";
  pass.receiveShadow = true;
  meshes.push(pass);

  return meshes;
}
