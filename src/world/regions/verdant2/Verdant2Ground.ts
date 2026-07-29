import { BufferAttribute, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { smoothstep01 } from "./Verdant2Shared";
import {
  CENTER_X,
  CENTER_Z,
  CISTERN,
  MISTFALL,
  balconyWeight,
  cisternWeight,
  gardenTerraces,
  mistfallDrop,
  passGate,
  passHalfWidth,
  spokeOf,
  stairDescent,
  vaultWeight,
  worldOf,
} from "./Verdant2Terrain";

/**
 * The Emerald Terraces' ground: five sheets and their authored paint.
 *
 * ## The tiling
 *
 * Four disc tiles in a 2×2 grid over the disc (the pilot's layout), plus
 * one pass sheet running the Emerald Stair back over the Great Kelp
 * Sea's rim. The pass sheet overlaps both the disc tiles and the kelp
 * sea's own trimmed tiles by a few metres and is sunk 4 cm — the pilot's
 * round-2 lesson: abutting different grids cracks open on steep slopes,
 * overlapped-and-sunk they render on top and the crack is backed by
 * ground.
 *
 * ## The paint
 *
 * Value first, gouache logic. The terrace *treads* are mossy sward
 * (red cut hard); the terrace *risers* — read straight from the terrain
 * module's own riser factor — sit a value step down in viridian-violet
 * shade, because a stepped country is drawn by darkening the step faces.
 * The Cistern is pale worked jade with a bright mirror floor; the Fern
 * Vault floor is violet half-light with fern litter; the Mistfall's fan
 * is milky silt; the basin is the deepest colour in the province and
 * still a colour (violet over green, red above green). The threshold
 * stays milky-bright to agree with the kelp sea's own Falling Edge.
 */

const SEED = SEEDS.regionVerdant2;

/** Ground kept out to here from the disc's centre (curtains stand inside). */
const DISC_GROUND_R = 240;

const DISC_TILE = 231;
/** ~2.2 m per vertex on the disc, ~1.9 on the pass — the pilot's trade. */
const DISC_SEGMENTS = 104;
const PASS_SEGMENTS = 88;

function keepGround(x: number, z: number): boolean {
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  if (rc <= DISC_GROUND_R) {
    return true;
  }
  const { u, v } = spokeOf(x, z);
  return u >= 652 && u <= 800 && Math.abs(v) <= passHalfWidth(u) + 12;
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
 * The region's ground paint. Every tint multiplies the sand wash, so 1
 * is "the bowl's own sand" and the biomes pull it toward their key. The
 * wash is strongly warm — green ground means red is *cut*, not green
 * raised (the pilot's round-2/3 lesson, taken at full strength from the
 * start).
 */
function bakeTerracePaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const { u, v } = spokeOf(x, z);

    // Value structure from the ground's own relief.
    const life = fbm(x * 0.026, z * 0.026, { seed: SEED ^ 0x7e06, period: 9, octaves: 2 }) - 0.5;
    let value = 0.9 + life * 0.45;

    // The sward: drifting moss-turf patches, two scales, a drawing.
    const sward = smoothstep01(
      (fbm(x * 0.017, z * 0.017, { seed: SEED ^ 0x5adf, period: 7, octaves: 3 }) - 0.42) / 0.26,
    );

    // The base key: emerald terrace moss, deeper than the kelp sea's
    // meadows — this country is older and lower.
    let r = 0.62 - sward * 0.24;
    let g = 0.92 - sward * 0.06;
    let b = 0.56 - sward * 0.08;

    // The threshold: milky-bright, agreeing with the kelp sea's Falling
    // Edge across the overlap. Eases out down the stair.
    const milk = 1 - smoothstep01((u - 700) / 90);
    if (milk > 0) {
      r += (0.97 - r) * milk;
      g += (1.01 - g) * milk;
      b += (0.9 - b) * milk;
      value += milk * 0.06;
    }

    // The steps: risers a value step down, violet-leaning; treads keep
    // the sward. This is the stair and the garden terraces both.
    const stair = stairDescent(u);
    const terraces = gardenTerraces(u, v);
    const riser = Math.max(stair.riser * (1 - smoothstep01((u - 860) / 30)), terraces.riser);
    if (riser > 0) {
      r += (0.5 - r) * riser * 0.75;
      g += (0.62 - g) * riser * 0.75;
      b += (0.68 - b) * riser * 0.75;
      value -= riser * 0.18;
    }

    // Depth key: the lower the country, the cooler and more violet the
    // ground — the light is further away. Red stays above green's cut.
    const y = position.getY(i);
    const deep = smoothstep01((-y - 20) / 20);
    r += (0.55 - r) * deep * 0.5;
    g += (0.66 - g) * deep * 0.5;
    b += (0.78 - b) * deep * 0.5;

    // The High Rim rampart: the disc's fade back to dune level climbs
    // 20–45 m and rings the whole country, so it is painted as what it
    // is — the oldest terrace wall: stacked ledge bands by height, and a
    // milky lift toward the crest (the distance rule written into it).
    const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
    const rim = smoothstep01((rc - 176) / 34) * (1 - passGate(u, v));
    if (rim > 0) {
      const ledge = Math.max(0, Math.sin(y * 0.55 + 0.5)) ** 2;
      const crest = smoothstep01((y + 10) / 12);
      r += (0.6 - ledge * 0.1 + crest * 0.34 - r) * rim;
      g += (0.84 - ledge * 0.14 + crest * 0.18 - g) * rim;
      b += (0.7 - ledge * 0.02 + crest * 0.2 - b) * rim;
      value += rim * (crest * 0.1 - ledge * 0.08);
    }

    // The Cistern: pale worked jade; the mirror floor is the brightest
    // ground in the region, with faint concentric stillness rings.
    const cistern = cisternWeight(u, v);
    if (cistern > 0) {
      const d = Math.hypot(u - CISTERN.u, v - CISTERN.v);
      const rings = 0.5 + 0.5 * Math.sin(d * 0.9);
      const floor = 1 - smoothstep01((d - 24) / 8);
      r += (0.88 + floor * 0.06 - r) * cistern;
      g += (0.98 + floor * 0.08 - g) * cistern;
      b += (0.86 + floor * 0.1 - b) * cistern;
      value += cistern * (0.1 + floor * (0.12 + rings * 0.03));
    }

    // The Fern Vault: violet half-light, drifted with olive fern litter.
    const vault = vaultWeight(u, v);
    if (vault > 0) {
      const litter = smoothstep01(
        (fbm(x * 0.045, z * 0.045, { seed: SEED ^ 0x517b, period: 11, octaves: 2 }) - 0.6) / 0.2,
      );
      r += (0.5 + litter * 0.22 - r) * vault;
      g += (0.48 + litter * 0.16 - g) * vault;
      b += (0.66 - litter * 0.06 - b) * vault;
      value -= vault * (0.12 - litter * 0.08);
    }

    // The Mistfall's fan and basin: milky silt pouring into the deepest
    // colour in the province — still a colour.
    const drop = mistfallDrop(u, v);
    if (drop > 0) {
      const fanAcross = 1 - smoothstep01((Math.abs(v - MISTFALL.v) - 12) / 16);
      const streaks =
        fbm(u * 0.06, v * 0.14, { seed: SEED ^ 0x70af, period: 10, octaves: 2 }) - 0.5;
      // Basin base: deep viridian-violet.
      r += (0.48 - r) * drop * 0.8;
      g += (0.56 - g) * drop * 0.8;
      b += (0.72 - b) * drop * 0.8;
      value -= drop * 0.1;
      // The silt fan under the fall, streaked along the flow.
      const fan = drop * fanAcross;
      if (fan > 0) {
        r += (0.92 + streaks * 0.1 - r) * fan;
        g += (0.97 + streaks * 0.1 - g) * fan;
        b += (0.9 + streaks * 0.08 - b) * fan;
        value += fan * 0.12;
      }
    }

    // The Far Balcony: pale worked stone, a landing of light on the rim.
    const balcony = balconyWeight(u, v);
    if (balcony > 0) {
      r += (0.86 - r) * balcony;
      g += (0.94 - g) * balcony;
      b += (0.82 - b) * balcony;
      value += balcony * 0.12;
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
export function buildVerdant2Ground(contacts: readonly ContactPatch[]): Mesh[] {
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
    bakeTerracePaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "verdant2-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The pass sheet: covers the stair and the threshold back over the
  // kelp sea's rim, overlapping its tiles (trimmed at rc1 = 240, spoke
  // u ≈ 685) and ours, sunk 4 cm so the crack is backed by ground.
  const passMid = worldOf(726, 0);
  const passGeometry = createSeabedGeometryAt(passMid.x, passMid.z, 166, PASS_SEGMENTS, -0.04);
  trimSheet(passGeometry, (x, z) => {
    const { u, v } = spokeOf(x, z);
    return u >= 652 && u <= 812 && Math.abs(v) <= passHalfWidth(Math.min(u, 780)) + 12;
  });
  bakeTerracePaint(passGeometry, contacts);
  const pass = new Mesh(passGeometry, material);
  pass.name = "verdant2-ground-pass";
  pass.receiveShadow = true;
  meshes.push(pass);

  return meshes;
}
