import { BufferAttribute, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { EMPTY_QUARTER } from "./GoldenFillShared";
import { MONOLITHS } from "./GoldenRocks";
import { smoothstep01 } from "./GoldenShared";
import {
  CENTER_X,
  CENTER_Z,
  HOURGLASS,
  HOURGLASS_FLOOR,
  SADDLE_TO,
  TERRACE_STEP,
  duneRank,
  flatsWeight,
  glassWeight,
  hourglassWeight,
  oasisWeight,
  saddleChannelCenter,
  saddleChannelHalf,
  saddleFloor,
  shoreWeight,
  spokeOf,
  tongueHalfWidth,
} from "./GoldenTerrain";

/**
 * The Hourglass Sea's ground: five sheets and their authored paint.
 *
 * ## The tiling (the pilots' argument, rotated onto this spoke)
 *
 * The bowl's own seabed sheet ends at ±56, and this province's spoke
 * runs almost due +x, so the saddle sheet begins exactly on the x = 56
 * line and runs out to the disc tiles' near edge — overlapping them by
 * three metres and sunk 4 cm (the pilot's round-2 fix, the Smoulder
 * round-4 lesson repeated), so the T-junction between different grids is
 * backed by ground instead of cracking open on the dune shoulders.
 *
 * ## The paint
 *
 * The sand wash carries the marks; the vertex colours carry the *place*
 * — value first, and in this region the value key runs on sun: sunlit
 * gold on every windward face and terrace tread, violet pooled in every
 * slip-face, hollow and the Hourglass deep (red above green, never
 * black), glass-pale green where the sand fused, and each Singing
 * Monolith throwing one long painted violet shadow down the flats —
 * a desert lives on its value structure and its violet shadows.
 */

const SEED = SEEDS.regionGolden1;

/** Ground kept out to here from the disc's centre (the curtains stand inside). */
const DISC_GROUND_R = 240;

/** Disc tile edge length; two tiles span the disc with margin. */
const DISC_TILE = 231;
/** ~2.2 m per vertex on the disc, ~2.0 in the saddle — see the ledger note. */
const DISC_SEGMENTS = 104;
const SADDLE_SEGMENTS = 80;

/** Where the bowl's own sheet ends and the saddle sheet must begin. */
const BOWL_SHEET_EDGE = 56;

/**
 * The painted low sun's direction on the flats, in spoke coordinates.
 * Chosen lateral to the flats poses' sightlines (round 2 threw shadows
 * directly away from the camera, and each read as a disconnected
 * stain): the streaks now sweep across the frame from their stones.
 */
const SHADOW_DIR_U = -0.6;
const SHADOW_DIR_V = 0.8;

function keepGround(x: number, z: number): boolean {
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  if (rc <= DISC_GROUND_R) {
    return true;
  }
  const { u, v } = spokeOf(x, z);
  return u >= 50 && u <= SADDLE_TO && Math.abs(v) <= tongueHalfWidth(u) + 14;
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

/** Wind-laid drift ribbons: the pale streaks the sand wears. */
function drift(x: number, z: number): number {
  return fbm(x * 0.018, z * 0.018, { seed: SEED ^ 0xd21f, period: 7, octaves: 3 });
}

/** The darker grain under the drifts, at its own scale. */
function grain(x: number, z: number): number {
  return fbm(x * 0.05, z * 0.05, { seed: SEED ^ 0x92a1, period: 11, octaves: 2 });
}

/**
 * The region's ground paint. Value first, then temperature; every tint
 * multiplies the sand wash, so 1 is "the bowl's own sand" and the biomes
 * pull it toward their own key.
 */
function bakeGoldenPaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const { u, v } = spokeOf(x, z);

    // Value structure from the ground's own relief: the same fbm the
    // terrain adds as ground life, read back as shade.
    const life = fbm(x * 0.026, z * 0.026, { seed: SEED ^ 0x9e0b, period: 9, octaves: 2 }) - 0.5;
    let value = 0.92 + life * 0.4;

    // The dune gold, drawn at two scales: pale wind-laid drift ribbons
    // over a darker grain. Blue is cut hard because the sand wash under
    // it is already warm — the gold arrives by ratio, not by raising
    // red. Round 1's ±0.12 mottle did nothing; a drawing needs range.
    const ribbons = smoothstep01((drift(x, z) - 0.46) / 0.24);
    const grains = smoothstep01((grain(x, z) - 0.58) / 0.2);
    let r = 1.04 + ribbons * 0.16 - grains * 0.2;
    let g = 0.92 + ribbons * 0.16 - grains * 0.2;
    let b = 0.44 + ribbons * 0.1 - grains * 0.05;
    value += ribbons * 0.06 - grains * 0.08;

    // The slip-faces: every dune's lee wears the violet shadow. This is
    // the desert's whole value structure in one term — at full strength
    // (round 1 ran it at 0.8 and the ranks read as beige swells).
    const rank = duneRank(u, v);
    const calm = Math.max(
      hourglassWeight(u, v),
      glassWeight(u, v) * 0.9,
      oasisWeight(u, v),
      flatsWeight(u, v) * 0.85,
      shoreWeight(u),
    );
    const slip = rank.slip * (1 - calm) * (u > 250 ? 1 : 0.4);
    r += (0.44 - r) * slip;
    g += (0.34 - g) * slip;
    b += (0.95 - b) * slip;
    value -= slip * 0.24;
    // And the windward crests catch the sun.
    const crest = rank.rise * (1 - rank.slip) * (1 - calm);
    value += crest * 0.14;
    // Phase 3 fill (plan §7.1): the crest SHELL-LINE — the pale seam of
    // wind-sorted shell along each rank's very top, the T1 mark that
    // makes a crest a drawn line instead of a value ramp. Keyed to the
    // rank function itself (wavelength 46 m — honest on the 2.2 m grid).
    const shellLine = smoothstep01((rank.rise - 0.72) / 0.2) * (1 - smoothstep01(rank.slip / 0.35)) * (1 - calm);
    r += (1.12 - r) * shellLine * 0.5;
    g += (1.06 - g) * shellLine * 0.5;
    b += (0.78 - b) * shellLine * 0.4;
    value += shellLine * 0.08;

    if (u < SADDLE_TO) {
      // The Dune Saddle: honey walls banded by height, the channel floor
      // warming as it goes — the approach's whole story told in the
      // ground: the water goes honey-warm before the desert opens.
      const warm = smoothstep01((u - 60) / 130);
      const inChannel =
        1 - smoothstep01((Math.abs(v - saddleChannelCenter(u)) - saddleChannelHalf(u)) / 8);
      // The honey stain pools in the channel — the path the water warms.
      const stain =
        smoothstep01(
          (fbm(x * 0.07, z * 0.07, { seed: SEED ^ 0x44ab, period: 9, octaves: 3 }) - 0.48) / 0.2,
        ) *
        warm *
        (0.4 + 0.6 * inChannel);
      const wallT = smoothstep01((y - saddleFloor(u)) / 7);
      // The crescent dunelings' lee shadow: the same wave the terrain
      // draws, read back as violet where the little faces fall away —
      // round 2's corridor floor was a monotone.
      const lee =
        Math.max(0, -Math.cos(u * 0.21 + Math.sin(v * 0.18) * 1.3)) *
        smoothstep01((u - 110) / 60) *
        (1 - wallT);
      // Contrast up in round 4: the descent frame still read one
      // mid-tone — the stain and the wall band both push harder.
      const honeyR = 0.84 + stain * 0.32 + wallT * 0.2 - lee * 0.34;
      const honeyG = 0.72 + stain * 0.2 + wallT * 0.18 - lee * 0.34;
      const honeyB = 0.5 - stain * 0.12 + wallT * 0.1 + lee * 0.3;
      const s = 1 - smoothstep01((u - 250) / 42);
      r += (honeyR - r) * s;
      g += (honeyG - g) * s;
      b += (honeyB - b) * s;
      value += (stain * 0.1 + wallT * 0.07 - lee * 0.12) * s;
    }

    // The Glass Reach: sea-glass pale, grooves a step deeper and greener,
    // with sparse bright glints where the fused surface catches light.
    const glass = glassWeight(u, v);
    if (glass > 0) {
      const groove = smoothstep01((-Math.sin((u * 0.42 + v * 0.91) * 0.34 + 1.1) - 0.1) / 0.5);
      const glint = smoothstep01(
        (fbm(x * 0.11, z * 0.11, { seed: SEED ^ 0x611e, period: 13, octaves: 2 }) - 0.72) / 0.08,
      );
      r += (0.78 - groove * 0.12 + glint * 0.3 - r) * glass;
      g += (0.98 - groove * 0.08 + glint * 0.28 - g) * glass;
      b += (0.9 - groove * 0.02 + glint * 0.26 - b) * glass;
      value += glass * (glint * 0.18 - groove * 0.06);
      // Phase 3 fill: FRACTURE paint — broad cooled seams crossing the
      // grooves at a second angle, so the fused field reads as cracked
      // plates rather than one polish. Seam bands ~9 m wide on a ~55 m
      // spacing (the grid-honesty floor: nothing finer than 8 m in
      // vertex paint — fine fracture grain lives in the shard aprons).
      const fracture =
        smoothstep01((Math.abs(Math.sin((u * 0.9 - v * 0.55) * 0.11 + 0.7)) - 0.82) / 0.18) *
        glass;
      r -= fracture * 0.1;
      g -= fracture * 0.04;
      b += fracture * 0.06;
      value -= fracture * 0.07;
    }

    // The Oasis Hollows: green-gold ground, deepest green in the hearts.
    const oasis = oasisWeight(u, v);
    if (oasis > 0) {
      const moss = smoothstep01(
        (fbm(x * 0.045, z * 0.045, { seed: SEED ^ 0x0a51, period: 10, octaves: 2 }) - 0.42) / 0.3,
      );
      r += (0.62 - moss * 0.18 - r) * oasis;
      g += (0.92 - moss * 0.06 - g) * oasis;
      b += (0.42 - moss * 0.04 - b) * oasis;
      value -= oasis * moss * 0.06;
    }

    // The Singing Flats: quiet pale gold, striped with the same ripple
    // the terrain carries (so the "ripple-plain" reads in paint as well
    // as relief) — and each monolith's long violet shadow, thrown along
    // the region's one painted low sun.
    const flats = flatsWeight(u, v);
    if (flats > 0) {
      const stripe = Math.sin(u * 0.62 + Math.sin(v * 0.11) * 2.0);
      r += (1.04 - r) * flats * 0.55;
      g += (0.96 - g) * flats * 0.55;
      b += (0.58 - b) * flats * 0.55;
      value += flats * stripe * 0.05;
      let shadow = 0;
      for (const m of MONOLITHS) {
        const du = u - m.u;
        const dv = v - m.v;
        const along = du * SHADOW_DIR_U + dv * SHADOW_DIR_V;
        if (along < -1.5 || along > m.shadow * 1.3) {
          continue;
        }
        const perp = Math.abs(du * SHADOW_DIR_V - dv * SHADOW_DIR_U);
        // Widened and darkened in round 4: round 3's 1.2–3.6 m streaks
        // read as faint scratches at capture distance.
        const width = 2.2 + (along / m.shadow) * 5.0;
        const across = 1 - smoothstep01((perp - width * 0.4) / (width * 0.6));
        const fade = 1 - smoothstep01((along / (m.shadow * 1.3) - 0.5) / 0.5);
        shadow = Math.max(shadow, across * fade);
      }
      shadow *= flats;
      // Deepened once more in round 5 — at 25 m the round-4 streaks
      // still read faint against the ripple paint.
      r += (0.44 - r) * shadow;
      g += (0.34 - g) * shadow;
      b += (0.94 - b) * shadow;
      value -= shadow * 0.34;
    }

    // The Hourglass: terrace treads sunlit gold near the lip fading to
    // the deep violet, terrace rims the brightest painted value in the
    // region, risers violet — and the floor cracked with radial gold
    // sand-runs converging on the drain.
    const d = Math.hypot(u - HOURGLASS.u, v - HOURGLASS.v);
    if (d < 62) {
      const inBowl = 1 - smoothstep01((d - 44) / 8);
      if (inBowl > 0) {
        const raw = HOURGLASS_FLOOR * smoothstep01((46 - d) / 32);
        const frac = raw / TERRACE_STEP - Math.floor(raw / TERRACE_STEP);
        const rim = smoothstep01((frac - 0.6) / 0.16);
        const riser = smoothstep01((frac - 0.36) / 0.2) * (1 - rim);
        const depthT = smoothstep01(-y / 26);
        const theta = Math.atan2(v - HOURGLASS.v, u - HOURGLASS.u);
        const run = smoothstep01(
          (fbm(theta * 2.4, d * 0.05, { seed: SEED ^ 0x40a3, period: 5, octaves: 2 }) - 0.58) / 0.14,
        );
        const nearFloor = 1 - smoothstep01((d - 6) / 18);
        // Round 2: the bowl read as one smooth tone — the ledge rims are
        // now the brightest painted value in the region, the risers and
        // the deep go firmly violet, and the gold sand-runs stay lit all
        // the way down to the drain.
        // Phase 3 fill: the tread FRINGE — a violet-cooled band just
        // inside each rim, the debris line a pouring fall leaves along
        // the bench it lands on. Same spatial key as the shipped rim
        // paint (the bench function), so it aliases exactly as much.
        const fringe = smoothstep01((frac - 0.44) / 0.1) * (1 - smoothstep01((frac - 0.58) / 0.08));
        const tr = 1.02 - depthT * 0.5 + rim * 0.5 - riser * 0.4 + run * (0.4 + nearFloor * 0.3) - fringe * 0.12;
        const tg = 0.9 - depthT * 0.52 + rim * 0.46 - riser * 0.42 + run * (0.28 + nearFloor * 0.18) - fringe * 0.14;
        const tb = 0.52 + depthT * 0.44 + rim * 0.24 + riser * 0.1 - run * 0.12 + fringe * 0.1;
        r += (tr - r) * inBowl;
        g += (tg - g) * inBowl;
        b += (tb - b) * inBowl;
        value += inBowl * (rim * 0.26 + run * 0.14 - riser * 0.14 - depthT * 0.12);
      } else {
        // The sand-lip ring: the brightest resting gold — the desert
        // leaning over its own drain.
        const onLip = smoothstep01((d - 44) / 6) * (1 - smoothstep01((d - 58) / 12));
        value += onLip * 0.1;
        b -= onLip * 0.06;
      }
    }

    // Phase 3 fill: THE EMPTY QUARTER (MASTER §1.2, registered rest) —
    // its bareness is composed, not defaulted: full ripple T1 paint,
    // wind-laid stripes at ~11.5 m wavelength (honest on the 2.2 m
    // grid), and nothing else. The fill gates keep every instance out.
    {
      const dq = Math.hypot(u - EMPTY_QUARTER.u, v - EMPTY_QUARTER.v);
      const quarter = 1 - smoothstep01((dq - EMPTY_QUARTER.radius + 4) / 8);
      if (quarter > 0) {
        const stripe = Math.sin(u * 0.55 + Math.sin(v * 0.13) * 1.8);
        const wave = smoothstep01((stripe - 0.15) / 0.5);
        r += (1.06 - r) * quarter * wave * 0.4;
        g += (0.98 - g) * quarter * wave * 0.4;
        b += (0.52 - b) * quarter * wave * 0.3;
        value += quarter * (wave - 0.5) * 0.12;
      }
    }

    // The Gilded Shore: milky-warm, the distance rule written into the ground.
    const shore = shoreWeight(u);
    if (shore > 0) {
      r += (1.04 - r) * shore * 0.7;
      g += (0.98 - g) * shore * 0.7;
      b += (0.84 - b) * shore * 0.7;
      value += shore * 0.08;
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

    const total = value * shade;
    colors[i * 3] = Math.max(0.25, Math.min(1.3, r * total));
    colors[i * 3 + 1] = Math.max(0.25, Math.min(1.3, g * total));
    colors[i * 3 + 2] = Math.max(0.25, Math.min(1.3, b * total));
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** Builds the five painted ground sheets. */
export function buildGoldenGround(contacts: readonly ContactPatch[]): Mesh[] {
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
    bakeGoldenPaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "hourglass-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The saddle sheet: from the bowl sheet's x = 56 edge out to the disc
  // tiles' near edge, overlapping INTO the tiles by three metres and
  // sunk 4 cm (the pilots' seam fix — mind the sign; the Smoulder's
  // round-4 cyan slashes were this arithmetic flipped).
  const discEdgeX = CENTER_X - DISC_TILE;
  const saddleSize = discEdgeX + 3 - BOWL_SHEET_EDGE;
  const saddleGeometry = createSeabedGeometryAt(
    (BOWL_SHEET_EDGE + discEdgeX + 3) / 2,
    14,
    saddleSize,
    SADDLE_SEGMENTS,
    -0.04,
  );
  trimSheet(saddleGeometry, keepGround);
  bakeGoldenPaint(saddleGeometry, contacts);
  const saddle = new Mesh(saddleGeometry, material);
  saddle.name = "hourglass-ground-saddle";
  saddle.receiveShadow = true;
  meshes.push(saddle);

  return meshes;
}
