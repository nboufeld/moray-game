import { BufferAttribute, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { smoothstep01 } from "./Blue1Shared";
import {
  CENTER_X,
  CENTER_Z,
  DROP_LIP_S,
  SLOPE_TO,
  spokeOf,
  steppeSwell,
  tongueHalfWidth,
} from "./Blue1Terrain";

/**
 * THE DROP PLAINS' ground: five sheets and their authored paint.
 *
 * ## The tiling (the pilot's audited scheme)
 *
 * The bowl's own sheet ends at z = −56 on this spoke, so the slope sheet
 * begins exactly there — its first vertex row lies on the bowl sheet's
 * edge, sampling the same `seabedHeight`, so the two meet on one curve.
 * The four disc tiles are a 2×2 grid over the disc; the slope sheet
 * overlaps their near edge by three metres and sits 4 cm under them, the
 * pilot's T-junction fix, so the seam is backed by ground.
 *
 * ## The trim
 *
 * Triangles whose three corners all leave the domain (plus the margin the
 * painted-distance layers stand inside) are dropped. In the World's Edge
 * sector the sheet is cut *short* on purpose — at rc 178 the deep floor
 * simply ends, and past it there is only water and the painted distance:
 * the world's edge is an edge of the world.
 *
 * ## The paint
 *
 * The sand wash carries the marks; the vertex colours carry the *place*,
 * value first. The slope's mouth keeps the reef's warm sand and lets it
 * fall away to cool blue by mid-glide. The steppe is a drawn sward —
 * blue-green turf patches over pale blue-grey sand, crests a half-value
 * lighter than troughs so the swells read at range. Depth itself is the
 * dimmer past the terraces: each shelf a value deeper and bluer, the
 * cliff face violet (red above green, never black), the Under-Blue a deep
 * violet-blue drifted with pale silt. Contact rings seat every stone.
 */

const SEED = SEEDS.regionBlue1;

/** Ground kept out to here from the disc's centre (prairie sectors). */
const DISC_GROUND_R = 225;
/** …and only to here where the World's Edge has already dropped. */
const EDGE_GROUND_R = 178;

const DISC_TILE = 231;
const DISC_SEGMENTS = 104;
const SLOPE_SIZE = 100;
const SLOPE_SEGMENTS = 56;

/** Where the bowl's own sheet ends on this spoke and the slope must begin. */
const BOWL_SHEET_EDGE_Z = -56;

function inCorridor(u: number, v: number): boolean {
  return u >= 50 && u <= SLOPE_TO + 12 && Math.abs(v) <= tongueHalfWidth(u) + 14;
}

function keepGround(x: number, z: number): boolean {
  const { u, v } = spokeOf(x, z);
  const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
  const s = u - 445;
  const overTheEdge = s > DROP_LIP_S + 26 && Math.abs(v) < 118;
  if (rc <= (overTheEdge ? EDGE_GROUND_R : DISC_GROUND_R)) {
    return true;
  }
  return inCorridor(u, v);
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
 * The region's ground paint. Every tint multiplies the sand wash, so 1 is
 * "the bowl's own sand" and the biomes pull it toward their own key.
 */
function bakeBlue1Paint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const { u } = spokeOf(x, z);

    // Value structure from the ground's own relief: the terrain's ground
    // life read back as shade, the cheapest honest occlusion.
    const life = fbm(x * 0.026, z * 0.026, { seed: SEED ^ 0x9b01, period: 9, octaves: 2 }) - 0.5;
    let value = 0.92 + life * 0.42;

    // The steppe's swells carry their own value: crests catch the high
    // sun, troughs hold a cooler half-tone — the prairie's relief drawn
    // into the paint so the layered silhouettes read at range.
    const swell = steppeSwell(x, z, u);
    const crest = smoothstep01((swell + 0.6) / 3.2);

    // The sward: blue-green turf drawn in patches at two scales, never a
    // wash (the pilot's round-2 lesson: polite tints under a warm wash
    // read as beige — green ground means red is *cut*).
    const sward = smoothstep01(
      (fbm(x * 0.014, z * 0.014, { seed: SEED ^ 0x5aa2, period: 6, octaves: 3 }) - 0.4) / 0.28,
    );
    const fine = fbm(x * 0.06, z * 0.06, { seed: SEED ^ 0x5aa3, period: 14, octaves: 2 }) - 0.5;

    // Steppe base: pale blue-grey sand between swards, cool teal turf on
    // them, crests half a value lighter and a touch warmer.
    let r = 0.9 - sward * 0.38 + crest * 0.1 + fine * 0.08;
    let g = 0.99 - sward * 0.06 + crest * 0.08 + fine * 0.06;
    let b = 1.0 + sward * 0.02 - crest * 0.06;
    value += crest * 0.09 - sward * 0.03;

    if (u < SLOPE_TO + 20) {
      // The slope: the reef's warm sand at the mouth, falling away to the
      // steppe's cool key by mid-glide — the approach's whole story is
      // this crossfade.
      const warm = 1 - smoothstep01((u - 95) / 120);
      const sr = 0.9 - sward * 0.3 + warm * 0.16 + fine * 0.08;
      const sg = 0.98 - sward * 0.05 + warm * 0.04 + fine * 0.06;
      const sb = 1.0 - warm * 0.2;
      const fadeIn = 1 - smoothstep01((u - 262) / 46);
      r += (sr - r) * fadeIn;
      g += (sg - g) * fadeIn;
      b += (sb - b) * fadeIn;
    }

    // Depth is the dimmer: from the first terrace down, every metre takes
    // the ground a step deeper in value and further into violet-blue. Keyed
    // on the vertex's own height so the shelf faces and the cliff read as
    // painted bands without any second bookkeeping.
    const depthK = smoothstep01((-y - 18.5) / 26);
    if (depthK > 0) {
      const silt =
        fbm(x * 0.045, z * 0.045, { seed: SEED ^ 0x51f7, period: 11, octaves: 3 }) - 0.5;
      // Violet-blue: red held above green all the way down.
      const dr = 0.6 + silt * 0.16;
      const dg = 0.52 + silt * 0.14;
      const db = 0.92 + silt * 0.08;
      r += (dr - r) * depthK;
      g += (dg - g) * depthK;
      b += (db - b) * depthK;
      value -= depthK * (0.2 - silt * 0.14);
    }

    // The milky rim: distance goes bright, not dark — the rule written
    // into the ground where the prairie dissolves into the fog.
    const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
    const far = smoothstep01((rc - 150) / 60);
    if (far > 0 && depthK < 0.4) {
      r += (1.0 - r) * far * 0.6;
      g += (1.04 - g) * far * 0.6;
      b += (1.08 - b) * far * 0.6;
      value += far * 0.05;
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
export function buildBlue1Ground(contacts: readonly ContactPatch[]): Mesh[] {
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
    bakeBlue1Paint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "blue1-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The slope sheet: its top row on the bowl sheet's edge line, its far
  // rows overlapping the disc tiles by three metres and sunk 4 cm — the
  // pilot's seam discipline, unchanged.
  const slopeGeometry = createSeabedGeometryAt(
    70,
    BOWL_SHEET_EDGE_Z - SLOPE_SIZE / 2,
    SLOPE_SIZE,
    SLOPE_SEGMENTS,
    -0.04,
  );
  trimSheet(slopeGeometry, keepGround);
  bakeBlue1Paint(slopeGeometry, contacts);
  const slope = new Mesh(slopeGeometry, material);
  slope.name = "blue1-ground-slope";
  slope.receiveShadow = true;
  meshes.push(slope);

  return meshes;
}
