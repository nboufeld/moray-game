import { BufferAttribute, Color, Mesh, type PlaneGeometry } from "three";
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

/**
 * Bends the sheet's rim down below the painted deep steps in the World's
 * Edge sector. Round 5's node-toggle probe found the "sawtooth teeth" over
 * the void were never the arcs at all: the trimmed sheet edge at rc ≈ 178
 * rises with the disc's sealing rim, stands above the Under-Blue's eye
 * line, and its triangulated boundary silhouetted against the fog as
 * regular teeth. The last metres of sheet now pour down to −52 — under
 * the arcs' own feet — so the floor visibly falls away and the painted
 * distance owns everything beyond. The droop begins outside the seal ring
 * (rc 164), so no reachable water ever stands over it.
 */
function droopEdgeRim(geometry: PlaneGeometry): void {
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const { u, v } = spokeOf(x, z);
    const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
    // Round 8's raycasts found the LAST hard edge: the droop switched
    // between its two regimes at exactly |v| = 118, and the prairie rim
    // standing out to rc 214 right beside the edge sector's fall at 166
    // silhouetted as a razor-edged wall in Under-Blue's right frame. The
    // sector's reach now blends over |v| 118 → 140 (all inside the prairie
    // trim at 225, so no cut is ever exposed): start radius, pour depth
    // and span all interpolate, and the rim ends in a rounded shoulder.
    let edge = 0;
    if (u - 445 > DROP_LIP_S + 26) {
      edge = 1 - smoothstep01((Math.abs(v) - 118) / 22);
    }
    const startR = 166 + (214 - 166) * (1 - edge);
    const span = 10 - (10 - 9) * (1 - edge);
    const floor = -24 - 28 * edge;
    const k = smoothstep01((rc - startR) / span);
    if (k > 0) {
      position.setY(i, position.getY(i) - k * (position.getY(i) - floor));
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

// ─── The absolute paint (fill round 1 — pale1's ledgered lesson) ────────────
//
// The vertex colour multiplies the sand wash, whose levelled mean is
// ≈ #bab08a — gold, with blue at barely half of red in linear light. The
// pilot's multiplier bake wrote polite near-unit tints and the fill-plan
// audit measured the result exactly: "the sward ground tint does not read
// as green ground" — steppe-sea was 70% bare tan. No channel-alike
// multiplier can green a gold wash. The bake below composes an ABSOLUTE
// story colour per vertex and divides by the wash's own linear mean at
// the end, so the screen shows the story colour and the wash's ripple
// marks survive as value grain.

/** The wash's levelled mean (#bab08a) in linear light. */
const WASH_MEAN = new Color(0.729, 0.69, 0.541).convertSRGBToLinear();

/** A story colour, authored in sRGB and converted once to linear. */
function story(hex: number): Color {
  return new Color(hex).convertSRGBToLinear();
}

// The palette the bake composes with — absolute paint, not multipliers.
// Round-1 probe: the first stories were authored for neutral light and the
// mood's blue register pushed the floor to grey-blue (measured (81,89,108)
// where turf was meant). These are warmed to counter it — the calamity
// ledger's lesson: fill palettes are painted for THIS region's light.
const SAND_STEPPE = story(0xc6c6ac);
const SAND_WARM = story(0xd4b488);
const TURF = story(0x5da45e);
const TURF_CREST = story(0x8cc878);
// Round 2: 0x6b5c94 at full lerp crushed the look-back's shelves to mud
// (measured (62,74,112) against plains-final's (84,103,117)) — paler,
// and the depth dim eased below.
const DEPTH_VIOLET = story(0x8478aa);
const SILT_PALE = story(0xa89cc2);
const MILKY_RIM = story(0xc2d4cf);

/**
 * The region's ground paint: the steppe drawn as a green prairie under a
 * high sun — turf the majority, bare sand the composed exception —
 * crest/lee value split, the slope's warm mouth falling away, depth as
 * the dimmer, terrace silt bands, and the milky rim.
 */
function bakeBlue1Paint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const col = new Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const { u, v } = spokeOf(x, z);
    const s = u - 445;

    // Value structure from the ground's own relief: the terrain's ground
    // life read back as shade, the cheapest honest occlusion.
    const life = fbm(x * 0.026, z * 0.026, { seed: SEED ^ 0x9b01, period: 9, octaves: 2 }) - 0.5;
    let value = 0.96 + life * 0.3;

    // The sward: the same seeded field the blades grow from (one truth,
    // two readers), its threshold dropped so turf owns the prairie and
    // bare sand is the composed rest between passages — the doctrine's
    // rule 3, corrected from the audit's "70% bare tan".
    const sward = smoothstep01(
      (fbm(x * 0.014, z * 0.014, { seed: SEED ^ 0x5aa2, period: 6, octaves: 3 }) - 0.31) / 0.24,
    );
    const fine = fbm(x * 0.06, z * 0.06, { seed: SEED ^ 0x5aa3, period: 14, octaves: 2 }) - 0.5;

    col.copy(SAND_STEPPE).lerp(TURF, Math.min(1, sward * (0.9 + fine * 0.5)));

    // The crest/lee split: crests catch the high sun in a warmer green and
    // a half-value lift; troughs hold the cooler, deeper half-tone.
    const swell = steppeSwell(x, z, u);
    const crest = smoothstep01((swell + 0.6) / 3.2);
    col.lerp(TURF_CREST, crest * sward * 0.55);
    value *= 0.9 + crest * 0.22;

    if (u < SLOPE_TO + 20) {
      // The slope: the reef's warm sand at the mouth, falling away to the
      // steppe's cool key by mid-glide — the approach's whole story.
      const warm = (1 - smoothstep01((u - 95) / 120)) * (1 - smoothstep01((u - 262) / 46));
      col.lerp(SAND_WARM, warm * (1 - sward * 0.55));
    }

    // Depth is the dimmer: from the first terrace down, every metre takes
    // the ground deeper in value and further into violet-blue (red held
    // above green — a colour, never a black). Round 3: onset −18.5 →
    // −22.5 and the lerp eased again — the round-2 easing bought the
    // look-back's shelves only (63,79,117) against plains-final's
    // (84,103,117); the story was starting on the rim's OWN floor.
    const depthK = smoothstep01((-y - 22.5) / 24);
    const silt = fbm(x * 0.045, z * 0.045, { seed: SEED ^ 0x51f7, period: 11, octaves: 3 }) - 0.5;
    if (depthK > 0) {
      col.lerp(DEPTH_VIOLET, depthK * (0.6 + silt * 0.3));
      value -= depthK * (0.07 - silt * 0.1);
    }

    // The terrace silt bands: a pale violet drift pooled below each shelf
    // lip, so every step reads as a painted band, not a contour line.
    if (s > 24 && depthK < 0.85) {
      for (const stepS of [30, 58, 84]) {
        const band =
          smoothstep01((s - stepS - 0.5) / 2.5) - smoothstep01((s - stepS - 9) / 6);
        if (band > 0) {
          col.lerp(SILT_PALE, band * (0.3 + silt * 0.3) * Math.max(0, 1 - Math.abs(v) / 150));
        }
      }
    }

    // The milky rim: distance goes bright, not dark — the rule written
    // into the ground where the prairie dissolves into the fog.
    const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
    const far = smoothstep01((rc - 150) / 60);
    if (far > 0 && depthK < 0.4) {
      col.lerp(MILKY_RIM, far * 0.65);
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

    // The one absolute step: story ÷ wash mean, channel by channel. The
    // blue multiplier legitimately runs past 1.6 — that is the gold being
    // cancelled, not a tint gone wild.
    const total = value * shade;
    colors[i * 3] = Math.max(0.12, Math.min(2.4, (col.r / WASH_MEAN.r) * total));
    colors[i * 3 + 1] = Math.max(0.12, Math.min(2.4, (col.g / WASH_MEAN.g) * total));
    colors[i * 3 + 2] = Math.max(0.12, Math.min(2.4, (col.b / WASH_MEAN.b) * total));
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
    droopEdgeRim(geometry);
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
