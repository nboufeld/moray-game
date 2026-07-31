import { BufferAttribute, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { smoothstep01 } from "./Verdant3Shared";
import {
  CENTER_X,
  CENTER_Z,
  HOLLOW,
  MESAS,
  SUNFALL,
  WELLSPRINGS,
  WORLDS_END,
  channelCenter,
  descentDrop,
  mesaMound,
  passGate,
  passHalfWidth,
  spokeOf,
  worldOf,
} from "./Verdant3Terrain";

/**
 * The Canopy Deep's ground: five sheets and their authored paint.
 *
 * ## The tiling
 *
 * Four disc tiles in a 2×2 grid over the disc, plus one pass sheet
 * running the Boughfall back over the Emerald Terraces' rim. The pass
 * sheet overlaps both grids by a few metres and is sunk 4 cm — the
 * pilot's round-2 lesson: abutting different grids cracks open on steep
 * slopes; overlapped-and-sunk, the crack is backed by ground.
 *
 * ## The paint
 *
 * Value first, gouache logic, and — because this is the province's
 * darkest water — red cut hard but VALUES held up. The Shade Meadows
 * are deep moss with drifting lichen-light patches (never one green);
 * the Boughfall's risers sit a value down in violet-green shade with
 * hanging-root streaks; the wellspring pools are the cleanest, palest
 * ground in the region (cool clear water reads as pale floor); mesa
 * roots warm where the gardens spill; shaft landings carry a pre-lit
 * warmth under the light pools; and the Last Rampart rings the country
 * in stacked ledge bands with a milky crest — the world's final wall
 * painted as what it is. The threshold carries the terraces' own milky
 * crest multipliers across the overlap (the province handover grammar,
 * third use), lerping to our celadon over 40 m.
 */

const SEED = SEEDS.regionVerdant3;

/** Ground kept out to here from the disc's centre. */
const DISC_GROUND_R = 240;

const DISC_TILE = 231;
/** ~2.2 m per vertex on the disc, ~1.9 on the pass — the standing trade. */
const DISC_SEGMENTS = 104;
const PASS_SEGMENTS = 88;

function keepGround(x: number, z: number): boolean {
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  if (rc <= DISC_GROUND_R) {
    return true;
  }
  const { u, v } = spokeOf(x, z);
  return u >= 1146 && u <= 1300 && Math.abs(v) <= passHalfWidth(u) + 12;
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
 * The region's ground paint. Every tint multiplies the warm sand wash,
 * so green ground means red is CUT, not green raised (the pilot's
 * lesson, taken at full strength from the start — and the re-pass
 * lesson beside it: in dim water the VALUES stay up even as the red
 * goes down, or every small plant on the floor drops to silhouette).
 */
function bakeDeepPaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const { u, v } = spokeOf(x, z);

    // Value structure from the ground's own relief.
    const life = fbm(x * 0.026, z * 0.026, { seed: SEED ^ 0x5ae1, period: 9, octaves: 2 }) - 0.5;
    let value = 0.92 + life * 0.42;

    // The shade sward: two drifting moss families a value apart, so the
    // floor is never one green.
    const sward = smoothstep01(
      (fbm(x * 0.016, z * 0.016, { seed: SEED ^ 0x517d, period: 7, octaves: 3 }) - 0.42) / 0.26,
    );
    // Lichen-light: pale teal-leaning patches where the old light pools
    // have fed the floor for a thousand years — the deep meadow's
    // second drawing, coarser than the sward.
    const lichen = smoothstep01(
      (fbm(x * 0.009, z * 0.009, { seed: SEED ^ 0x70b3, period: 5, octaves: 2 }) - 0.5) / 0.2,
    );

    // The base key: deep-shade moss, the green leaning toward blue-dark
    // — red cut hard, blue held UP (the province arc's last note).
    // Round 2: red 0.52 → 0.44 and the sward cut deepened — the r1
    // close pose read the open floor as warm mustard under the sand
    // wash (the pilot's lesson, relearned in the dark register).
    // Round 3: red 0.44 → 0.40 and the lichen patches widened — the r2
    // close poses still read the open floor as khaki, and instances
    // cannot out-paint the paint (the pilot's fill-r3 lesson).
    // Round 4: 0.40 → 0.37 — the r3 close-shade-floor pose STILL read
    // khaki-olive at 2 m; the sand wash under this water needs the red
    // fully out of the open sward.
    let r = 0.37 - sward * 0.16;
    let g = 0.96 - sward * 0.05;
    let b = 0.7 - sward * 0.04;
    if (lichen > 0) {
      r += (0.68 - r) * lichen * 0.7;
      g += (1.02 - g) * lichen * 0.7;
      b += (0.84 - b) * lichen * 0.7;
      value += lichen * 0.08;
    }

    // The threshold: milky-bright, carrying the terraces' far-rim crest
    // across the overlap, lerping to our celadon (the doctrine's 20+ m
    // transition rule). Round 4: the milk GREENED (0.98/1.02/0.92 →
    // 0.84/1.04/0.94) and pulled back to fade out by u ≈ 1222 — the r3
    // close-road pose read the whole front door as raw sand; the
    // handover carries the terraces' LIGHT, not their bare ground.
    const milk = 1 - smoothstep01((u - 1188) / 34);
    if (milk > 0) {
      r += (0.84 - r) * milk;
      g += (1.04 - g) * milk;
      b += (0.94 - b) * milk;
      value += milk * 0.06;
    }

    // The Boughfall Shadow: the registered rest is a COMPOSED dark —
    // a cool shadow wash over the channel band, so its licensed
    // bareness reads as the descent's held breath, not as missing fill.
    if (u > 1270 && u < 1304) {
      const inShadow =
        smoothstep01((u - 1270) / 6) * (1 - smoothstep01((u - 1296) / 8));
      const nearChannel = 1 - smoothstep01((Math.abs(v - channelCenter(u)) - 12) / 8);
      const shadowMix = inShadow * nearChannel;
      r += (0.4 - r) * shadowMix * 0.5;
      g += (0.62 - g) * shadowMix * 0.5;
      b += (0.72 - b) * shadowMix * 0.5;
      value -= shadowMix * 0.12;
    }

    // The Boughfall's risers: a value step down, violet-leaning, with
    // hanging-root streaks — the step faces draw the descent.
    const drop = descentDrop(u);
    const riserBand = 1 - smoothstep01((u - 1330) / 24);
    const riser = drop.riser * riserBand;
    if (riser > 0) {
      const roots = smoothstep01(
        (fbm(v * 0.31, u * 0.05, { seed: SEED ^ 0x51b0, period: 9, octaves: 2 }) - 0.46) / 0.2,
      );
      r += (0.42 + roots * 0.08 - r) * riser * 0.9;
      g += (0.52 + roots * 0.26 - g) * riser * 0.9;
      b += (0.64 - roots * 0.1 - b) * riser * 0.9;
      value -= riser * (0.3 - roots * 0.1);
    }

    // Depth key: the lower the country, the cooler and more violet the
    // ground — red stays above green's cut, values stay colours.
    const y = position.getY(i);
    const deep = smoothstep01((-y - 18) / 20);
    r += (0.48 - r) * deep * 0.5;
    g += (0.66 - g) * deep * 0.5;
    b += (0.82 - b) * deep * 0.5;

    // The Last Rampart: the disc's fade back to dune level climbs the
    // world's final wall — stacked ledge bands by height, milky crest.
    const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
    const rim = smoothstep01((rc - 176) / 34) * (1 - passGate(u, v));
    if (rim > 0) {
      // Round 4: the ledge bands gated onto the climbing wall — on the
      // near-flat rim skirt the height-keyed sin bands drew as
      // tire-track contour arcs across the sward (sweep 04).
      const ledge =
        Math.max(0, Math.sin(y * 0.55 + 0.5)) ** 2 * smoothstep01((rim - 0.45) / 0.3);
      const crest = smoothstep01((y + 10) / 12);
      r += (0.6 - ledge * 0.1 + crest * 0.34 - r) * rim;
      g += (0.86 - ledge * 0.14 + crest * 0.16 - g) * rim;
      b += (0.72 - ledge * 0.02 + crest * 0.2 - b) * rim;
      value += rim * (crest * 0.1 - ledge * 0.08);
    }

    // The mesa roots: the gardens spill warmth down the pillars' feet —
    // a ring of richer, warmer moss under every crown.
    const mound = mesaMound(u, v);
    if (mound > 0) {
      const spill = mound / 1.6;
      r += (0.62 - r) * spill * 0.55;
      g += (0.98 - g) * spill * 0.55;
      b += (0.58 - b) * spill * 0.55;
      value += spill * 0.05;
    }

    // The Hollow Mesa's floor: the secret room keeps a violet hush with
    // a warm pool where the oculus beam lands.
    const hollowD = Math.hypot(u - HOLLOW.u, v - HOLLOW.v);
    if (hollowD < 7) {
      const inside = 1 - smoothstep01((hollowD - 3.5) / 3);
      r += (0.6 - r) * inside;
      g += (0.56 - g) * inside;
      b += (0.74 - b) * inside;
      value -= inside * 0.1;
    }

    // The Wellsprings: the cleanest, palest floors in the region — cool
    // clear pockets, faint concentric stillness rings. Round 3: the
    // rings' frequency halved and amplitude softened — at r2 close
    // range they read as tire tracks across the bowl.
    // Round 4: the pale reach widened to the bowl's true lip and cooled
    // — the r3 close-rim pose showed a khaki bowl slope around a small
    // pale centre; the cool clear pocket must own its whole basin.
    for (const spring of WELLSPRINGS) {
      const d = Math.hypot(u - spring.u, v - spring.v);
      if (d < spring.radius * 2) {
        const pool = 1 - smoothstep01((d - spring.radius * 0.8) / spring.radius);
        const rings = 0.5 + 0.5 * Math.sin(d * 0.55);
        r += (0.88 - r) * pool;
        g += (1.06 - g) * pool;
        b += (1.04 - b) * pool;
        value += pool * (0.12 + rings * 0.015);
      }
    }

    // The Sunfall Well's landing: the floor remembers the light.
    const sunfallD = Math.hypot(u - SUNFALL.u, v - SUNFALL.v);
    if (sunfallD < SUNFALL.radius) {
      const lit = 1 - smoothstep01((sunfallD - 4) / (SUNFALL.radius - 4));
      r += (0.86 - r) * lit * 0.5;
      g += (1.02 - g) * lit * 0.5;
      b += (0.7 - b) * lit * 0.5;
      value += lit * 0.1;
    }

    // The Province's End rise: elder moss with gold litter — the last
    // stand before the painted country.
    const endD = Math.hypot(u - WORLDS_END.u, v - WORLDS_END.v);
    if (endD < WORLDS_END.radius * 1.6) {
      const rise = 1 - smoothstep01((endD - WORLDS_END.radius * 0.6) / WORLDS_END.radius);
      const fleck = smoothstep01(
        (fbm(x * 0.09, z * 0.09, { seed: SEED ^ 0x51b1, period: 13, octaves: 1 }) - 0.6) / 0.16,
      );
      r += (0.66 + fleck * 0.24 - r) * rise;
      g += (0.94 + fleck * 0.1 - g) * rise;
      b += (0.6 - fleck * 0.06 - b) * rise;
      value += rise * 0.06;
    }

    // Contact shade under everything that stands on the ground.
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
    colors[i * 3] = Math.max(0.25, Math.min(1.25, r * total));
    colors[i * 3 + 1] = Math.max(0.25, Math.min(1.25, g * total));
    colors[i * 3 + 2] = Math.max(0.25, Math.min(1.25, b * total));
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** Builds the five painted ground sheets. */
export function buildVerdant3Ground(contacts: readonly ContactPatch[]): Mesh[] {
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
    bakeDeepPaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "verdant3-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The pass sheet: covers the Boughfall and the threshold back over
  // the terraces' rim, overlapping both grids and sunk 4 cm.
  // Round 3: sunk 4 → 7 cm — the r2 close-road frames caught the
  // overlap edge as a thin dark line at grazing angles.
  const passMid = worldOf(1222, 0);
  const passGeometry = createSeabedGeometryAt(passMid.x, passMid.z, 170, PASS_SEGMENTS, -0.07);
  trimSheet(passGeometry, (x, z) => {
    const { u, v } = spokeOf(x, z);
    return u >= 1146 && u <= 1308 && Math.abs(v) <= passHalfWidth(Math.min(u, 1300)) + 12;
  });
  bakeDeepPaint(passGeometry, contacts);
  const pass = new Mesh(passGeometry, material);
  pass.name = "verdant3-ground-pass";
  pass.receiveShadow = true;
  meshes.push(pass);

  return meshes;
}

// Re-exported for the paint's own tests.
export { MESAS };
