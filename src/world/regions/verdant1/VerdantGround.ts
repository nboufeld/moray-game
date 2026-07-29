import { BufferAttribute, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { smoothstep01 } from "./VerdantShared";
import {
  CENTER_X,
  CENTER_Z,
  VALE_TO,
  fallingEdgeWeight,
  forestWeight,
  mazeWeight,
  spokeOf,
  sunwellWeight,
  tongueHalfWidth,
  valeChannelCenter,
  valeChannelHalf,
  valeFloor,
} from "./VerdantTerrain";

/**
 * The Great Kelp Sea's ground: five sheets and their authored paint.
 *
 * ## The tiling, and why the edges are where they are
 *
 * The bowl's own seabed sheet ends at ±56, so the vale sheet begins exactly
 * on the z = 56 line — its lowest vertex row lies on the bowl sheet's edge,
 * sampling the same `seabedHeight`, so the two meet on one curve with no
 * overlap to z-fight across. The four disc tiles are a 2×2 grid over the
 * disc whose lower edge the vale sheet's top edge lands on exactly, by the
 * same argument. Different grids meet with hairline T-junctions; both seams
 * lie 55+ m from anywhere a pose stands, under water this fog has closed.
 *
 * ## The trim
 *
 * A square sheet over a round region wastes its corners, and the corners
 * are the difference between fitting the triangle budget and blowing it:
 * triangles whose every vertex is outside the domain (plus a margin the
 * painted-distance curtains stand inside) are dropped from the index.
 *
 * ## The paint
 *
 * The sand wash carries the marks; the vertex colours carry the *place* —
 * value first: sunlit warm gold-green over the meadows, deep cool moss
 * under the forest, a violet whose red stays above its green in the maze's
 * gullies (the darkest thing in the region is a colour), and a milky-pale
 * lift over the Falling Edge where the world dissolves. Contact shade
 * rings sit under every holdfast and stone, because an object with no
 * contact shadow floats.
 */

const SEED = SEEDS.regionVerdant1;

/** Ground kept out to here from the disc's centre (the curtains stand inside). */
const DISC_GROUND_R = 240;

/** Disc tile edge length; two tiles span the disc with margin. */
const DISC_TILE = 231;
/** ~2.1 m per vertex on the disc, ~1.7 in the vale — see the ledger note. */
const DISC_SEGMENTS = 112;
const VALE_SEGMENTS = 88;

/** Where the bowl's own sheet ends and the vale sheet must begin. */
const BOWL_SHEET_EDGE = 56;

function keepGround(x: number, z: number): boolean {
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  if (rc <= DISC_GROUND_R) {
    return true;
  }
  const { u, v } = spokeOf(x, z);
  return u >= 50 && u <= VALE_TO && Math.abs(v) <= tongueHalfWidth(u) + 14;
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

/** Leaf-litter mottle: warm patches drifting through the forest floor. */
function litter(x: number, z: number): number {
  return fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x11ea, period: 8, octaves: 2 });
}

/**
 * The region's ground paint. Value first, then temperature; every tint
 * multiplies the sand wash, so 1 is "the bowl's own sand" and the biomes
 * pull it toward their own key.
 */
function bakeVerdantPaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
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
    const life = fbm(x * 0.024, z * 0.024, { seed: SEED ^ 0x9d01, period: 9, octaves: 2 }) - 0.5;
    let value = 0.9 + life * 0.5;

    // Meadow base: sunlit warm gold-green.
    let r = 1.03;
    let g = 1.0;
    let b = 0.8;

    if (u < VALE_TO) {
      // The vale: cool green walls, and a violet-leaning shadow pooled in
      // the deep narrows (keyed on the channel's own floor curve).
      const deep = smoothstep01((-valeFloor(u) - 5.0) / 2.4);
      const inChannel = 1 - smoothstep01((Math.abs(v - valeChannelCenter(u)) - valeChannelHalf(u)) / 8);
      const vr = 0.84 - deep * inChannel * 0.1;
      const vg = 0.95 - deep * inChannel * 0.2;
      const vb = 0.86 + deep * inChannel * 0.06;
      const s = 1 - smoothstep01((u - 250) / 42);
      r += (vr - r) * s;
      g += (vg - g) * s;
      b += (vb - b) * s;
      value -= deep * inChannel * 0.08;
    }

    // The forest floor: deep cool moss, drifted with warm leaf-litter.
    const forest = forestWeight(u, v);
    if (forest > 0) {
      const warm = smoothstep01((litter(x, z) - 0.58) / 0.2);
      r += (0.72 + warm * 0.24 - r) * forest;
      g += (0.86 - warm * 0.06 - g) * forest;
      b += (0.66 - warm * 0.06 - b) * forest;
      value -= forest * 0.06;
    }

    // The Sunwell: the palest, warmest ground in the region.
    const sun = sunwellWeight(u, v);
    if (sun > 0) {
      r += (1.12 - r) * sun;
      g += (1.06 - g) * sun;
      b += (0.85 - b) * sun;
      value += sun * 0.12;
    }

    // The maze: violet shadow — red above green, never a black.
    const maze = mazeWeight(u, v);
    if (maze > 0) {
      const gully = smoothstep01((-y - 19.4) / 2.4);
      r += (0.66 - gully * 0.08 - r) * maze;
      g += (0.6 - gully * 0.1 - g) * maze;
      b += (0.78 - gully * 0.04 - b) * maze;
      value -= maze * (0.1 + gully * 0.08);
    }

    // The Falling Edge: milky-bright, the distance rule written into the ground.
    const fe = fallingEdgeWeight(u);
    if (fe > 0) {
      r += (1.0 - r) * fe * 0.7;
      g += (1.02 - g) * fe * 0.7;
      b += (0.95 - b) * fe * 0.7;
      value += fe * 0.06;
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
    colors[i * 3] = Math.max(0.25, Math.min(1.25, r * total));
    colors[i * 3 + 1] = Math.max(0.25, Math.min(1.25, g * total));
    colors[i * 3 + 2] = Math.max(0.25, Math.min(1.25, b * total));
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** Builds the five painted ground sheets. */
export function buildVerdantGround(contacts: readonly ContactPatch[]): Mesh[] {
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
    bakeVerdantPaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "verdant-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The vale sheet: exactly from the bowl sheet's edge to the disc tiles'.
  const discEdgeZ = CENTER_Z - DISC_TILE;
  const valeSize = discEdgeZ - BOWL_SHEET_EDGE;
  const valeGeometry = createSeabedGeometryAt(
    30,
    (BOWL_SHEET_EDGE + discEdgeZ) / 2,
    valeSize,
    VALE_SEGMENTS,
  );
  trimSheet(valeGeometry, keepGround);
  bakeVerdantPaint(valeGeometry, contacts);
  const vale = new Mesh(valeGeometry, material);
  vale.name = "verdant-ground-vale";
  vale.receiveShadow = true;
  meshes.push(vale);

  return meshes;
}
