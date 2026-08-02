import { BufferAttribute, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { AMBER, EMBER, smoothstep01 } from "./Smoking2Shared";
import {
  ANVIL,
  CENTER_X,
  CENTER_Z,
  DESCENT_TO,
  HEARTH,
  benchFootU,
  descentDrop,
  glassWeight,
  hearthWeight,
  passHalfWidth,
  pillowsWeight,
  saddleCenter,
  saddleHalf,
  spokeOf,
  washCenter,
  washHalf,
  washWeight,
  worldOf,
} from "./Smoking2Terrain";

/**
 * The Forge Combs' ground: five sheets and their authored paint.
 *
 * ## The tiling
 *
 * Four disc tiles span the country (231 m each, ~2.2 m per vertex); the
 * saddle sheet carries the pass. The Smoulder Fields' own ground reaches
 * rc 240 of ITS centre — u ≈ 685 on this spoke — so the saddle sheet
 * runs u 618 → 712: overlapping the Smoulder's sheets under the crest
 * (sunk 4 cm, the pilot's seam fix) and reaching three metres into our
 * own tiles at u 709.
 *
 * ## The paint
 *
 * The sand wash carries the marks; the vertex colours carry the *place*.
 * The value key runs on heat from below: dusk grey-violet gravel is the
 * resting tone, the Emberwash's floor is charcoal split by amber seam
 * veins (the brightest painted values in the region), the Hearth's
 * junction star radiates them, the pillow crowns wear milk-bright crust
 * rims, and the Glass Shore goes darker with cold sheen glints — the one
 * cool note, held against all that warmth.
 */

const SEED = SEEDS.regionSmoking2;

/** Ground kept out to here from the disc's centre (the curtains stand inside). */
const DISC_GROUND_R = 240;

const DISC_TILE = 231;
const DISC_SEGMENTS = 104;
const SADDLE_SEGMENTS = 64;

/** The saddle sheet's reach along the spoke. */
const SADDLE_FROM = 618;
const SADDLE_TO = 712;

function keepDisc(x: number, z: number): boolean {
  return Math.hypot(x - CENTER_X, z - CENTER_Z) <= DISC_GROUND_R;
}

function keepSaddle(x: number, z: number): boolean {
  const { u, v } = spokeOf(x, z);
  return u >= SADDLE_FROM && u <= SADDLE_TO && Math.abs(v) <= passHalfWidth(Math.max(u, 636)) + 14;
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

/** Gravel-drift mottle: paler wind-laid ribbons through the dusk. */
function drift(x: number, z: number): number {
  return fbm(x * 0.016, z * 0.016, { seed: SEED ^ 0x6d01, period: 7, octaves: 3 });
}

/** Clinker mottle: the darker, sharper scatter under the drifts. */
function clinker(x: number, z: number): number {
  return fbm(x * 0.047, z * 0.047, { seed: SEED ^ 0x6d02, period: 11, octaves: 2 });
}

/** The seam-vein field along the Emberwash: bright threads in the floor. */
export function washVein(u: number, v: number): number {
  const off = (v - washCenter(u)) / Math.max(1, washHalf(u));
  const thread = fbm(u * 0.11, off * 2.1, { seed: SEED ^ 0x6d03, period: 8, octaves: 3 });
  return smoothstep01((thread - 0.6) / 0.12) * (1 - smoothstep01((Math.abs(off) - 0.85) / 0.5));
}

/** The Hearth's junction star: seams radiating from the basin's heart. */
export function hearthVein(u: number, v: number): number {
  const d = Math.hypot(u - HEARTH.u, v - HEARTH.v);
  const theta = Math.atan2(v - HEARTH.v, u - HEARTH.u);
  const ray = smoothstep01(
    (fbm(theta * 2.4, d * 0.05, { seed: SEED ^ 0x6d04, period: 5, octaves: 2 }) - 0.6) / 0.12,
  );
  return ray * (1 - smoothstep01((d - 8) / 40));
}

/**
 * The region's ground paint. Value first, then temperature; every tint
 * multiplies the sand wash, so 1 is "the bowl's own sand" and the biomes
 * pull it toward their own key.
 */
function bakeForgePaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const { u, v } = spokeOf(x, z);

    // Value structure from the ground's own relief.
    const life = fbm(x * 0.027, z * 0.027, { seed: SEED ^ 0x2c07, period: 9, octaves: 2 }) - 0.5;
    let value = 0.9 + life * 0.4;

    // The gravel plain: dusk grey-violet at two scales — pale drift
    // ribbons over darker clinker scatter. R2: a full value darker than
    // r1 (the plain read mauve-tan and the province's dark ground was
    // missing), clinker darks harder.
    const drifts = smoothstep01((drift(x, z) - 0.46) / 0.24);
    const clinkers = smoothstep01((clinker(x, z) - 0.58) / 0.2);
    let r = 0.54 + drifts * 0.17 - clinkers * 0.21;
    let g = 0.48 + drifts * 0.16 - clinkers * 0.23;
    let b = 0.7 + drifts * 0.1 - clinkers * 0.12;

    // Amber pooled in the mottle — the province's signature, laid on the
    // open plain where the heat seeps: warm pools a value brighter,
    // held out of the wash/hearth/glass (they carry their own keys).
    const amberPool = smoothstep01(
      (fbm(x * 0.021, z * 0.021, { seed: SEED ^ 0x6d07, period: 6, octaves: 2 }) - 0.6) / 0.1,
    );
    r += amberPool * AMBER.r * 0.4;
    g += amberPool * AMBER.g * 0.26;
    b -= amberPool * 0.05;

    // The Cinder Saddle: milky over the crest (agreeing with the
    // Smoulder's Ember Shore where the two sheets overlap), grading to
    // cinder-charcoal down the Clinker Stair, each riser seamed ember.
    if (u < DESCENT_TO + 30) {
      const milk = 1 - smoothstep01((u - 688) / 46);
      r += (1.0 - r) * milk * 0.7;
      g += (0.94 - g) * milk * 0.7;
      b += (0.88 - b) * milk * 0.7;
      value += milk * 0.08;
      const inWay =
        1 - smoothstep01((Math.abs(v - saddleCenter(u)) - saddleHalf(u)) / 8);
      const stairBand = smoothstep01((u - 730) / 24) * (1 - smoothstep01((u - (DESCENT_TO + 26)) / 18));
      const { riser } = descentDrop(u);
      const cinderR = 0.4;
      const cinderG = 0.33;
      const cinderB = 0.5;
      const s = stairBand * inWay;
      r += (cinderR - r) * s * 0.8;
      g += (cinderG - g) * s * 0.8;
      b += (cinderB - b) * s * 0.8;
      // Ember seams on the riser faces — the stair announces the country.
      const seam = riser * smoothstep01(
        (fbm(x * 0.09, z * 0.09, { seed: SEED ^ 0x6d05, period: 9, octaves: 2 }) - 0.38) / 0.18,
      );
      r += seam * EMBER.r * 0.95 * s;
      g += seam * EMBER.g * 0.62 * s;
      b += seam * EMBER.b * 0.22 * s;
      value += (seam * 0.2 - riser * 0.08) * s;
    }

    // The Emberwash: charcoal floor split by amber-ember seam veins —
    // the road is drawn in heat.
    const wash = washWeight(u, v);
    if (wash > 0) {
      const vein = washVein(u, v);
      const charR = 0.34 + vein * (AMBER.r * 1.0 + EMBER.r * 0.4);
      const charG = 0.28 + vein * (AMBER.g * 0.68);
      const charB = 0.46 - vein * 0.16;
      r += (charR - r) * wash;
      g += (charG - g) * wash;
      b += (charB - b) * wash;
      value += wash * (vein * 0.26 - 0.13);
    }

    // The wash's lips: a pale mineral hem so the rift reads from afar.
    if (u > 752 && u < 1095) {
      const washD = Math.abs(v - washCenter(u));
      const hem =
        smoothstep01((washD - washHalf(u) * 0.85) / 2) *
        (1 - smoothstep01((washD - washHalf(u) * 1.6) / 3.5));
      r += hem * 0.2;
      g += hem * 0.17;
      b += hem * 0.1;
      value += hem * 0.05;
    }

    // The Pillow Meadows: warm rounded bosses, milk-bright crust rims on
    // their crowns — read from the same boss field the terrain drew.
    const pillows = pillowsWeight(u, v);
    if (pillows > 0) {
      const boss = Math.max(
        0,
        fbm(x * 0.052, z * 0.052, { seed: SEED ^ 0x2c04, period: 12, octaves: 2 }) - 0.42,
      );
      const crown = smoothstep01((boss - 0.16) / 0.1);
      const flank = smoothstep01((boss - 0.04) / 0.1) * (1 - crown);
      r += ((0.72 + flank * 0.14 + crown * 0.42) - r) * pillows;
      g += ((0.64 + flank * 0.12 + crown * 0.4) - g) * pillows;
      b += ((0.7 + flank * 0.04 + crown * 0.3) - b) * pillows;
      value += pillows * (crown * 0.2 + flank * 0.05);
    }

    // The First Hearth: the darkest resting floor, the junction star's
    // rays the brightest lines — the region's heart of heat.
    const hearth = hearthWeight(u, v);
    if (hearth > 0) {
      const vein = hearthVein(u, v);
      r += ((0.42 + vein * (0.66 + AMBER.r * 0.34)) - r) * hearth;
      g += ((0.34 + vein * 0.36) - g) * hearth;
      b += ((0.54 - vein * 0.18) - b) * hearth;
      value += hearth * (vein * 0.24 - 0.14);
    }

    // The Glass Shore: obsidian dark with cold sheen glints — the one
    // cool register, the far country's hush.
    const glass = glassWeight(u);
    if (glass > 0) {
      const sheen = smoothstep01(
        (fbm(x * 0.06, z * 0.06, { seed: SEED ^ 0x6d06, period: 8, octaves: 2 }) - 0.64) / 0.1,
      );
      // R2: r1's shore read as more tan dune — the obsidian must go
      // properly dark, the sheen the one cold light in it. R3: darker
      // still and the glints a value brighter; the fog halves everything.
      r += ((0.3 + sheen * 0.56) - r) * glass * 0.95;
      g += ((0.27 + sheen * 0.54) - g) * glass * 0.95;
      b += ((0.46 + sheen * 0.62) - b) * glass * 0.95;
      value += glass * (sheen * 0.18 - 0.15);
    }

    // The Anvil's court: worked ground, a warm halo around the block.
    const anvilD = Math.hypot(u - ANVIL.u, v - ANVIL.v);
    if (anvilD < 30) {
      const halo = 1 - smoothstep01((anvilD - 9) / 18);
      r += halo * 0.14;
      g += halo * 0.08;
      value += halo * 0.04;
    }

    // Contact shade under everything that stands on the gravel.
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
export function buildSmoking2Ground(contacts: readonly ContactPatch[]): Mesh[] {
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
    bakeForgePaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "forge-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The saddle sheet: over the crest between the Smoulder's ground (its
  // sheets reach u ≈ 685) and our tiles (their near corner cuts u ≈ 709
  // on the spine) — overlap on both sides, sunk 4 cm.
  const saddleAt = worldOf((SADDLE_FROM + SADDLE_TO) / 2, 0);
  const saddleGeometry = createSeabedGeometryAt(
    saddleAt.x,
    saddleAt.z,
    SADDLE_TO - SADDLE_FROM + 46,
    SADDLE_SEGMENTS,
    -0.04,
  );
  trimSheet(saddleGeometry, keepSaddle);
  bakeForgePaint(saddleGeometry, contacts);
  const saddle = new Mesh(saddleGeometry, material);
  saddle.name = "forge-ground-saddle";
  saddle.receiveShadow = true;
  meshes.push(saddle);

  return meshes;
}

/** Exported for the tests: the reveal-cadence bench feet, world space. */
export function benchFeet(): { x: number; z: number }[] {
  return [0, 1, 2, 3, 4].map((i) => {
    const u = benchFootU(i);
    return worldOf(u, saddleCenter(u));
  });
}
