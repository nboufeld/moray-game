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
/** ~2.36 m per vertex on the disc, ~1.84 in the vale (eased a step from
 *  the pilot's 104/84 to pay for the fill's T1 carpets — the authored
 *  terrain wavelengths are ≥ 8 m, so the coarser grid still samples them
 *  cleanly; see the ledger's rework note). */
const DISC_SEGMENTS = 98;
const VALE_SEGMENTS = 80;

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

    // The sward: drifting patches of algal turf that green the ground
    // itself. Round 1's paint sat politely under the sand wash and the
    // whole region read as bare dunes — the sward is the correction, and
    // it is a *drawing* (patchy, two scales) rather than a wash.
    const sward =
      smoothstep01((fbm(x * 0.016, z * 0.016, { seed: SEED ^ 0x5ade, period: 7, octaves: 3 }) - 0.42) / 0.26);

    // Meadow base: sunlit gold-green, swarded hard. The multipliers here
    // look brutal on paper because the sand wash under them is strongly
    // warm — "a tile and a tint cannot both carry the colour", so green
    // ground means red is *cut*, not green raised. Round 2 measured the
    // polite version as beige; the round-2 SWEEP measured the off-sward
    // base itself as bare mustard (frames 03/04/05/08/11/12 — every fail
    // stood on it), so round 3 greens the base and lets the sward patches
    // deepen from an already-green floor. No square metre of owned disc
    // may read as bare sand by default.
    // R12.3 round 3: another red cut off the base — the re-pass's close
    // poses proved the inter-sward floor still reads mustard at swimming
    // distance under the warm wash, and no instance count can out-paint
    // the paint (the fill-r3 lesson, taken one step further).
    let r = 0.66 - sward * 0.26;
    let g = 0.99 - sward * 0.05;
    let b = 0.58 - sward * 0.08;

    if (u < VALE_TO) {
      // The vale: mossy green walls banded by height, and a violet-leaning
      // shadow pooled in the deep narrows.
      const deep = smoothstep01((-valeFloor(u) - 5.0) / 2.4);
      const inChannel = 1 - smoothstep01((Math.abs(v - valeChannelCenter(u)) - valeChannelHalf(u)) / 8);
      // Round 3: the descent's walls still read mustard-tan under the
      // warm wash at round 2's figures — red comes down another step so
      // the vale is a green corridor, not a tan trench with a green line.
      const moss = 0.4 + sward * 0.5;
      const vr = 0.68 - moss * 0.3 - deep * inChannel * 0.08;
      const vg = 0.98 - moss * 0.08 - deep * inChannel * 0.16;
      const vb = 0.68 - moss * 0.16 + deep * inChannel * 0.2;
      const s = 1 - smoothstep01((u - 250) / 42);
      r += (vr - r) * s;
      g += (vg - g) * s;
      b += (vb - b) * s;
      value -= deep * inChannel * 0.1 * s;

      // The moss track (fill plan §7.3): the channel's own centreline is
      // the road the diver actually swims, and for 200 m it read as bare
      // olive floor. A deliberate green band runs the vale's length —
      // strongest on the spine, feathered by 4.5 m, broken by the same
      // sward fbm so it reads as grown moss and not painted tape. Green
      // arrives the region's own way: red is CUT, not green raised.
      const track =
        (1 - smoothstep01((Math.abs(v - valeChannelCenter(u)) - 1.2) / 4.5)) *
        (0.55 + sward * 0.45) *
        s;
      r -= track * 0.26;
      g += track * 0.02;
      b -= track * 0.1;
    }

    // The lip garden band (fill plan §7.3): `vale-reveal`'s lower half
    // read as bare warm beige — the "green world" contradicting its own
    // doorstep. Over the saddle and the meadows' first swells the sward
    // contrast deepens, so the ground the reveal opens onto is already
    // the meadows' green.
    const lip = smoothstep01((u - 248) / 14) * (1 - smoothstep01((u - 330) / 26));
    if (lip > 0) {
      // Eased from 0.2 in round 3: the base is green now, and the old cut
      // stacked on it ran the swarded doorstep into the clamp floor.
      const deepen = lip * (0.35 + sward * 0.65);
      r -= deepen * 0.14;
      b -= deepen * 0.06;
    }

    // The forest floor: deep cool moss, drifted with warm leaf-litter.
    // The litter stays golden-olive — round 3's redder mix dried into
    // rust at close range.
    const forest = forestWeight(u, v);
    if (forest > 0) {
      const warm = smoothstep01((litter(x, z) - 0.64) / 0.18);
      r += (0.42 + warm * 0.3 - r) * forest;
      g += (0.72 - warm * 0.04 - g) * forest;
      b += (0.42 - warm * 0.02 - b) * forest;
      value -= forest * 0.05;
    }

    // The Sunwell: the palest, warmest ground in the region.
    const sun = sunwellWeight(u, v);
    if (sun > 0) {
      r += (0.92 - r) * sun;
      g += (1.06 - g) * sun;
      b += (0.56 - b) * sun;
      value += sun * 0.16;
    }

    // The maze: violet shadow — red above green, never a black. Cooled and
    // dropped a step in round 4; the gully floors take the deepest violet,
    // so the tangle's passages read as passages.
    const maze = mazeWeight(u, v);
    if (maze > 0) {
      const gully = smoothstep01((-y - 18.6) / 2.8);
      // Its own mottle at its own scale: silt drifts and algal shadow
      // patches, because a smooth mauve dune is a smooth beige dune with
      // the hue swapped (round 4's read).
      const silt =
        fbm(x * 0.05, z * 0.05, { seed: SEED ^ 0x517a, period: 12, octaves: 3 }) - 0.5;
      r += (0.46 - gully * 0.08 + silt * 0.14 - r) * maze;
      g += (0.4 - gully * 0.08 + silt * 0.18 - g) * maze;
      b += (0.66 + gully * 0.02 + silt * 0.1 - b) * maze;
      value -= maze * (0.16 + gully * 0.14 - silt * 0.12);
    }

    // The Falling Edge: milky-bright, the distance rule written into the ground.
    const fe = fallingEdgeWeight(u);
    if (fe > 0) {
      r += (0.98 - r) * fe * 0.7;
      g += (1.02 - g) * fe * 0.7;
      b += (0.92 - b) * fe * 0.7;
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

  // The vale sheet: from the bowl sheet's edge, overlapping the disc
  // tiles' lower edge by three metres and sunk 4 cm under them. Abutting
  // exactly left a T-junction crack that opened visibly on the steep wall
  // slopes crossing the seam (round 1's cyan slashes); overlapped and
  // sunk, the disc tiles render on top and the crack is backed by ground.
  const discEdgeZ = CENTER_Z - DISC_TILE;
  const valeSize = discEdgeZ + 3 - BOWL_SHEET_EDGE;
  const valeGeometry = createSeabedGeometryAt(
    30,
    (BOWL_SHEET_EDGE + discEdgeZ + 3) / 2,
    valeSize,
    VALE_SEGMENTS,
    -0.04,
  );
  trimSheet(valeGeometry, keepGround);
  bakeVerdantPaint(valeGeometry, contacts);
  const vale = new Mesh(valeGeometry, material);
  vale.name = "verdant-ground-vale";
  vale.receiveShadow = true;
  meshes.push(vale);

  return meshes;
}
