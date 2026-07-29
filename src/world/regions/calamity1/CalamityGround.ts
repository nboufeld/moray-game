import { BufferAttribute, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { smoothstep01 } from "./CalamityShared";
import {
  CENTER_X,
  CENTER_Z,
  MARCH_TO,
  forestWeight,
  gardensWeight,
  groveWeight,
  marchChannelCenter,
  marchChannelHalf,
  marchFloor,
  quietRimWeight,
  shatterWeight,
  spokeOf,
  tongueHalfWidth,
  woundWeight,
} from "./CalamityTerrain";

/**
 * The Sunken Calamity's ground: six sheets and their authored paint.
 *
 * ## The tiling
 *
 * The spoke runs at azimuth 4.59 — almost straight down world −z, its
 * lateral axis almost +x — so two axis-aligned sheets cover the march the
 * way the pilot's one vale sheet did, overlapping each other and the four
 * disc tiles by metres and sunk 4 cm, the pilot's round-2 seam fix: the
 * tiles render on top and no T-junction crack opens on the broken banks.
 *
 * ## The trim
 *
 * Triangles whose every corner lies outside the domain (plus the margin
 * the painted-distance curtains stand inside) are dropped from the index
 * — the corners of a square sheet over a round region are the difference
 * between fitting the triangle budget and blowing it.
 *
 * ## The paint
 *
 * The sand wash carries the marks; the vertex colours carry the *place* —
 * and this region's place is drained: grey-cool ash where the pilot had
 * gold-green, violet whose red stays above its green in the Wound's
 * descending terraces, the shock rings still standing in the sand in
 * concentric value bands centred on the crater, bone-pale mats in the
 * gardens, and one pocket of hard-cut green in the Last Grove. Contact
 * shade rings sit under every stone and stipe, because an object with no
 * contact shadow floats.
 */

const SEED = SEEDS.regionCalamity;

/** Ground kept out to here from the disc's centre (the curtains stand inside). */
const DISC_GROUND_R = 240;

/** Disc tile edge length; two tiles span the disc with margin. */
const DISC_TILE = 231;
/** ~2.2 m per vertex on the disc, ~2.5 on the march — see the ledger note. */
const DISC_SEGMENTS = 104;
const MARCH_A_SEGMENTS = 108;
const MARCH_B_SEGMENTS = 102;

function keepGround(x: number, z: number): boolean {
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  if (rc <= DISC_GROUND_R) {
    return true;
  }
  const { u, v } = spokeOf(x, z);
  return u >= 46 && u <= MARCH_TO + 6 && Math.abs(v) <= tongueHalfWidth(u) + 14;
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
 * The blast's frozen signature: concentric value rings centred on the
 * Wound, still standing in the sand five hundred metres out. Soft sine
 * bands, attenuated with distance — strongest down the blast road, where
 * the ground itself stopped pretending to be dunes.
 */
function shockRing(x: number, z: number): number {
  const d = Math.hypot(x - CENTER_X, z - CENTER_Z);
  const reach = smoothstep01((560 - d) / 120);
  if (reach <= 0) {
    return 0;
  }
  const ring = Math.sin(d * 0.34 + 1.2);
  return ring * reach;
}

/**
 * The region's ground paint. Value first, then temperature; every tint
 * multiplies the sand wash, so 1 is "the bowl's own sand" and the biomes
 * pull it toward their own key. The Calamity's key is *drained*: red cut
 * a step harder than green, blue held — grey that stays a colour.
 */
function bakeCalamityPaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const { u, v } = spokeOf(x, z);

    // Value structure from the ground's own relief: the same fbm the
    // terrain adds as ground life, read back as shade so hollows sit a
    // little deeper in tone than swells — the cheapest honest occlusion.
    const life = fbm(x * 0.026, z * 0.026, { seed: SEED ^ 0x9d01, period: 9, octaves: 2 }) - 0.5;
    let value = 0.9 + life * 0.5;

    // The dead sand: the gold drained out. Red cut hardest, blue held —
    // the ash key. Silt mottle at two scales so no stretch reads as a
    // smooth grey dune (the pilot's round-4 lesson: a smooth mauve dune
    // is a smooth beige dune with the hue swapped).
    const silt =
      fbm(x * 0.045, z * 0.045, { seed: SEED ^ 0x5117, period: 11, octaves: 3 }) - 0.5;
    // Round 3 cut the red a third time: the sand wash under these
    // multipliers is strongly warm, and at 0.62 the near field still
    // read as beach. Grey means red is *cut*, not blue raised — the
    // pilot paid three rounds for the same lesson.
    let r = 0.52 + silt * 0.1;
    let g = 0.7 + silt * 0.12;
    let b = 0.84 + silt * 0.08;

    // The march: grey deepening down the blast road, the shock rings
    // standing in value bands, and a violet pool in the Suffocated Mile's
    // channel — the water went bad here and the ground remembers.
    if (u < MARCH_TO) {
      const ring = shockRing(x, z);
      value += ring * 0.18;
      const deep = smoothstep01((-marchFloor(u) - 6.4) / 2.2);
      const inChannel = 1 - smoothstep01((Math.abs(v - marchChannelCenter(u)) - marchChannelHalf(u)) / 8);
      const pool = deep * inChannel * smoothstep01((u - 280) / 60) * (1 - smoothstep01((u - 420) / 60));
      r += (0.62 - r) * pool;
      g += (0.6 - g) * pool;
      b += (0.88 - b) * pool;
      value -= pool * 0.08;
      // The banks' crests take a pale blast-scorch near the Gate: the
      // closer the ridge, the more the grey goes bone.
      const scorch = smoothstep01((u - 380) / 90) * smoothstep01((Math.abs(v - marchChannelCenter(u)) - marchChannelHalf(u)) / 10);
      r += (0.82 - r) * scorch * 0.5;
      g += (0.82 - g) * scorch * 0.5;
      b += (0.8 - b) * scorch * 0.5;
    }

    // The Shatterfield: pale fractured pavement, the cracks standing dark.
    const shatter = shatterWeight(u, v);
    if (shatter > 0) {
      const n = fbm(x * 0.021, z * 0.021, { seed: SEED ^ 0x5ca7, period: 7, octaves: 3 });
      const crack = 1 - smoothstep01((n - 0.42) / 0.16);
      r += (0.84 - crack * 0.3 - r) * shatter;
      g += (0.83 - crack * 0.28 - g) * shatter;
      b += (0.82 - crack * 0.2 - b) * shatter;
      value -= shatter * crack * 0.12;
    }

    // The Ghost Forest's bench: the ash drifts, palest in the hollows
    // where the ash pooled — a pale floor under pale columns.
    const forest = forestWeight(u, v);
    if (forest > 0) {
      const drift = smoothstep01((fbm(x * 0.016, z * 0.016, { seed: SEED ^ 0xa54, period: 6, octaves: 2 }) - 0.35) / 0.3);
      r += (0.8 + drift * 0.08 - r) * forest;
      g += (0.8 + drift * 0.08 - g) * forest;
      b += (0.84 + drift * 0.06 - b) * forest;
      value += forest * drift * 0.06;
    }

    // The Wound: violet descending the terraces — red above green at
    // every step, the deepest thing in the region and still a colour.
    const wound = woundWeight(u, v);
    if (wound > 0) {
      const deepT = smoothstep01((-y - 6) / 22);
      r += (0.6 - deepT * 0.18 - r) * wound;
      g += (0.56 - deepT * 0.16 - g) * wound;
      b += (0.74 + deepT * 0.04 - b) * wound;
      value -= wound * (0.1 + deepT * 0.12);
    }

    // The Seep Gardens: bone-pale mats drifting over the grey, mineral
    // shoulders warm with rust where the small seeps breathe.
    const gardens = gardensWeight(u, v);
    if (gardens > 0) {
      const mat = smoothstep01((fbm(x * 0.05, z * 0.05, { seed: SEED ^ 0x7a11, period: 10, octaves: 3 }) - 0.48) / 0.2);
      const rust = smoothstep01((fbm(x * 0.07, z * 0.07, { seed: SEED ^ 0x7b57, period: 8, octaves: 2 }) - 0.55) / 0.2);
      r += (0.88 + rust * 0.04 - mat * 0.04 - r) * gardens;
      g += (0.86 - mat * 0.02 - g) * gardens;
      b += (0.8 - mat * 0.04 - rust * 0.05 - b) * gardens;
      value += gardens * mat * 0.08;
    }

    // The Last Grove: green. Hard-cut red, the pilot's round-3 lesson —
    // a tile and a tint cannot both carry the colour, so living ground
    // means red is *cut*, not green raised. The one pocket in the whole
    // region where the old world's colour survives.
    const grove = groveWeight(u, v);
    if (grove > 0) {
      const sward = smoothstep01((fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x5ade, period: 7, octaves: 3 }) - 0.4) / 0.24);
      r += (0.5 - sward * 0.16 - r) * grove;
      g += (0.98 - sward * 0.1 - g) * grove;
      b += (0.56 - sward * 0.1 - b) * grove;
      value += grove * 0.05;
    }

    // The Quiet Rim: milky-bright, the distance rule written into the ground.
    const rim = quietRimWeight(u);
    if (rim > 0) {
      r += (0.92 - r) * rim * 0.6;
      g += (0.94 - g) * rim * 0.6;
      b += (0.96 - b) * rim * 0.6;
      value += rim * 0.05;
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

/** Builds the six painted ground sheets. */
export function buildCalamityGround(contacts: readonly ContactPatch[]): Mesh[] {
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
    bakeCalamityPaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "calamity-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The march's two sheets: from the bowl sheet's edge down the spoke
  // (which runs almost straight along world −z), overlapping each other
  // and the disc tiles' near edge by metres and sunk 4 cm under them.
  const marchA = createSeabedGeometryAt(-22, -174, 268, MARCH_A_SEGMENTS, -0.04);
  trimSheet(marchA, keepGround);
  bakeCalamityPaint(marchA, contacts);
  const sheetA = new Mesh(marchA, material);
  sheetA.name = "calamity-ground-march-a";
  sheetA.receiveShadow = true;
  meshes.push(sheetA);

  const marchB = createSeabedGeometryAt(-52, -418, 252, MARCH_B_SEGMENTS, -0.04);
  trimSheet(marchB, keepGround);
  bakeCalamityPaint(marchB, contacts);
  const sheetB = new Mesh(marchB, material);
  sheetB.name = "calamity-ground-march-b";
  sheetB.receiveShadow = true;
  meshes.push(sheetB);

  return meshes;
}
