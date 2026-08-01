import { BufferAttribute, Color, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { B2_SEEDS, smoothstep01 } from "./Blue2Shared";
import { WRACK_FRAGMENTS } from "./Blue2Stones";
import {
  CENTER_X,
  CENTER_Z,
  MOON_WELL,
  RISER3_D,
  SPILL,
  currentCarve,
  currentDistance,
  passGate,
  passHalfWidth,
  spokeOf,
  stepD,
  stepsDrop,
  worldOf,
} from "./Blue2Terrain";

/**
 * THE DEEP STEPS' ground: five sheets and their authored paint.
 *
 * ## The tiling
 *
 * Four disc tiles in a 2×2 grid over the disc, plus one pass sheet
 * running the Othershore saddle back down the Far Wall's upper face.
 * The pass sheet begins at u ≈ 626 — just outside the Drop Plains' own
 * edge-sector ground (its sheets keep rc ≤ 178 there, u ≈ 623) — so
 * the wall the collision believes in is finally VISIBLE from this
 * side; it overlaps our disc tiles by a few metres and is sunk 4 cm
 * (the standing T-junction discipline). Nothing else is built on the
 * wall: the Under-Blue's law holds.
 *
 * ## The paint
 *
 * The vertex colours carry the PLACE as absolute stories (the Drop
 * Plains' proven move on this same gold wash: story ÷ wash mean, so
 * the screen shows the story colour and the wash survives as value
 * grain). The register is the MASTER row's, kept to the letter: deep
 * steps retint violet with red above green — never cobalt; distance
 * and crests go milky-bright; the darkest floor is a colour. Each
 * shelf is one value deeper: bone-pale saddle → pale-violet Strand
 * (with its arcing ripple field) → step-violet Current country (the
 * river's bed painted glass-green with pale levees) → the Round's
 * deep violet under the Moon Well's bright circle. Riser faces carry
 * strata bands; the Worldwall pales upward into the milky rim; the
 * Spill streaks its riser pale.
 */

const SEED = SEEDS.regionBlue2;

const CENTRE = worldOf(940, 0);

/** Ground kept out to here from the disc's centre. */
const DISC_GROUND_R = 240;
const DISC_TILE = 231;
const DISC_SEGMENTS = 104;
const PASS_SEGMENTS = 78;

function keepGround(x: number, z: number): boolean {
  const rc = Math.hypot(x - CENTRE.x, z - CENTRE.z);
  if (rc <= DISC_GROUND_R) {
    return true;
  }
  const { u, v } = spokeOf(x, z);
  return u >= 626 && u <= 780 && Math.abs(v) <= passHalfWidth(u) + 12;
}

/** The wash's levelled mean (#bab08a) in linear light (the pilot's number). */
const WASH_MEAN = new Color(0.729, 0.69, 0.541).convertSRGBToLinear();

/** A story colour, authored in sRGB and converted once to linear. */
function story(hex: number): Color {
  return new Color(hex).convertSRGBToLinear();
}

// The palette the bake composes with — authored for THIS region's
// violet mood (the calamity lesson: fill palettes are for the region's
// own light; under a blue-violet fog, warmth must be overpaid).
const MILKY_SADDLE = story(0xe0e6dc);
const BONE_STRAND = story(0xbcb4c6);
const STEP_VIOLET_STORY = story(0x9282b0);
const ROUND_VIOLET_STORY = story(0x6a5e8c);
const RISER_FACE = story(0x7e6f9e);
const SILT_DRIFT = story(0xc2bacd);
const CURRENT_GLASS = story(0xbfe0d2);
const CURRENT_BANK = story(0xa9c9b8);
const WELL_BRIGHT = story(0xece8da);
const WALL_MILK = story(0xccd6d4);

/** The Strand's arcing ripple field: dunes combed around the hinge. */
function rippleField(u: number, v: number, x: number, z: number): number {
  const d = stepD(u, v);
  const wobble =
    fbm(x * 0.008, z * 0.008, { seed: SEED ^ B2_SEEDS.paintRipple, period: 4, octaves: 2 }) * 4;
  return Math.sin(d * 1.35 + wobble);
}

/**
 * The region's ground paint — value first: each shelf a value deeper,
 * crests and lips a half-value lighter than their treads so the steps
 * read at range.
 */
function bakeDeepStepsPaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const col = new Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const { u, v } = spokeOf(x, z);
    const d = stepD(u, v);
    const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);

    // Value structure from the ground's own relief.
    const life =
      fbm(x * 0.026, z * 0.026, { seed: SEED ^ B2_SEEDS.paintLife, period: 9, octaves: 2 }) - 0.5;
    let value = 0.95 + life * 0.28;

    // The silt drift: pale ribbons the deep water lays down everywhere.
    const silt = smoothstep01(
      (fbm(x * 0.016, z * 0.016, { seed: SEED ^ B2_SEEDS.paintSilt, period: 6, octaves: 3 }) -
        0.46) /
        0.26,
    );

    // ── The shelf stories, keyed by hinge distance ──
    if (u < 672) {
      // The Far Wall's face: the Under-Blue's own register continued —
      // violet at the drowned foot, paling to a milky crest. Painted
      // by HEIGHT, because the wall is the height.
      const depthK = smoothstep01((-y - 4) / 34);
      col.copy(WALL_MILK).lerp(story(0x8478aa), depthK * 0.85);
      col.lerp(SILT_DRIFT, silt * 0.3 * (1 - depthK));
      value *= 1 - depthK * 0.18;
    } else if (d < 152) {
      // The Othershore: milky bone shelf, sun again after the violet.
      col.copy(MILKY_SADDLE);
      col.lerp(SILT_DRIFT, silt * 0.3);
      value *= 1.09;
    } else if (d < 258) {
      // The Strand: pale violet-bone under an arcing ripple field.
      const ripple = rippleField(u, v, x, z);
      col.copy(BONE_STRAND).lerp(SILT_DRIFT, silt * 0.5);
      value *= 0.98 + ripple * 0.055;
    } else if (d < 348) {
      // The Current's Step.
      col.copy(STEP_VIOLET_STORY).lerp(SILT_DRIFT, silt * 0.32);
      const ripple = rippleField(u, v, x, z);
      value *= 0.96 + ripple * 0.04;
    } else {
      // The Round: the deepest, smoothest, quietest floor — with faint
      // pale star-specks, the floor of night.
      col.copy(ROUND_VIOLET_STORY).lerp(SILT_DRIFT, silt * 0.18);
      const stars = fbm(x * 0.32, z * 0.32, {
        seed: SEED ^ B2_SEEDS.paintStars,
        period: 23,
        octaves: 2,
      });
      if (stars > 0.72) {
        col.lerp(WELL_BRIGHT, smoothstep01((stars - 0.72) / 0.1) * 0.4);
      }
      value *= 0.94;
    }

    // Shelf boundaries: riser faces a step deeper with strata bands;
    // every lip a half-value lighter (the step edges DRAWN).
    const steps = stepsDrop(u, v);
    if (steps.riser > 0.04 && u >= 672) {
      const strata = Math.sin(y * 2.1 + silt * 2.5);
      col.lerp(RISER_FACE, steps.riser * 0.75);
      value *= 1 - steps.riser * 0.1 + strata * steps.riser * 0.06;
    }
    for (const edge of [150, 255, RISER3_D]) {
      const lip = smoothstep01((d - (edge - 5)) / 3) * (1 - smoothstep01((d - edge) / 1.6));
      if (lip > 0) {
        col.lerp(WELL_BRIGHT, lip * 0.3);
        value *= 1 + lip * 0.12;
      }
    }

    // The Old Current: a bed of glass-green over pale levees — the one
    // living ribbon in the violet, painted so the river reads even
    // where the particulates rest.
    const current = currentCarve(u, v);
    if (current.bed > 0 && u > 700) {
      const { d: cd } = currentDistance(u, v);
      const centreLine = 1 - smoothstep01(cd / 3.6);
      col.lerp(CURRENT_BANK, current.bed * 0.8);
      // Round 2: the river must READ as a river — the glass line
      // brightened to the region's near-brightest painted value.
      col.lerp(CURRENT_GLASS, centreLine * 0.95);
      value *= 1 + centreLine * 0.3;
    }
    // The banks' green fades outward — life clings to the river.
    const bankStain = 1 - smoothstep01((currentDistance(u, v).d - 8) / 14);
    if (bankStain > 0 && d > 258 && d < 352) {
      col.lerp(CURRENT_BANK, bankStain * 0.22 * (0.5 + silt * 0.5));
    }

    // The Spill: the riser under the fall streaked pale.
    const spillD = Math.hypot(u - SPILL.u, v - SPILL.v);
    if (spillD < 26) {
      const streak = (1 - smoothstep01((spillD - 6) / 18)) * smoothstep01((d - 335) / 10);
      col.lerp(CURRENT_GLASS, streak * 0.55);
      value *= 1 + streak * 0.1;
    }

    // THE MOON WELL: the pale circle — the Round's one bright thing,
    // painted (the rest's licence is ring paint and the beam).
    const wellD = Math.hypot(u - MOON_WELL.u, v - MOON_WELL.v);
    if (wellD < MOON_WELL.radius * 2.2) {
      const circle = 1 - smoothstep01((wellD - MOON_WELL.radius * 0.8) / (MOON_WELL.radius * 0.5));
      const halo =
        smoothstep01((wellD - MOON_WELL.radius * 0.9) / 2.5) *
        (1 - smoothstep01((wellD - MOON_WELL.radius * 1.6) / 3));
      col.lerp(WELL_BRIGHT, circle * 0.85 + halo * 0.2);
      value *= 1 + circle * 0.22;
    }

    // The Kings' Wrack: a violet shadow-stain pooled under the line's
    // fragments, so the fallen stones sit IN the silt, not on it.
    for (const fragment of WRACK_FRAGMENTS) {
      const fd = Math.hypot(u - fragment.u, v - fragment.v);
      if (fd < fragment.length) {
        const stain = 1 - smoothstep01((fd - fragment.length * 0.35) / (fragment.length * 0.6));
        col.lerp(RISER_FACE, stain * 0.3);
        value *= 1 - stain * 0.08;
      }
    }

    // The Worldwall: the rim pales upward into the milky rule —
    // distance goes bright, never dark — with contour strata.
    const wallK = smoothstep01((rc - 176) / 34) * smoothstep01((u - 700) / 30);
    if (wallK > 0) {
      // Round 2: contrast doubled and a runnel term added — the r1
      // wall read as one flat fogged band from every deep camera.
      const contour = Math.sin(y * 0.9 + silt * 2);
      const runnel =
        fbm(u * 0.06, v * 0.06, { seed: SEED ^ B2_SEEDS.paintWall, period: 9, octaves: 2 }) - 0.5;
      col.lerp(WALL_MILK, wallK * (0.55 + 0.2 * smoothstep01((y + 20) / 20)));
      col.lerp(RISER_FACE, wallK * Math.max(0, -runnel) * 0.8);
      value *= 1 + wallK * (0.08 + contour * 0.1 + runnel * 0.12);
    }

    // Depth is the dimmer: below the Strand every metre cools and
    // quiets — red held above green, never cobalt.
    const depthK = smoothstep01((-y - 24) / 26);
    if (depthK > 0 && u >= 672) {
      col.lerp(ROUND_VIOLET_STORY, depthK * 0.3);
      value *= 1 - depthK * 0.08;
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
 * Tucks the disc tiles' outermost trim edge under the crest (round 2):
 * a flat cut edge at dune level silhouetted as a razor line on distant
 * horizons (blue-1's round-5 sawtooth, one generation on). Gated off
 * the corridor, whose own sheet carries the crossing.
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
 * Droops the pass sheet's lateral trim edges under the wall (round 3):
 * seen edge-on from the wall band, the raw lateral cut zigzagged as a
 * sawtooth silhouette across the wall-face frame — the same razor-edge
 * family as the disc trim, one sheet later. The last metres of width
 * sag below the composed ground, so the cut edge tucks under the
 * wall's own curvature instead of standing on it.
 */
function droopPassEdge(geometry: PlaneGeometry): void {
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const { u, v } = spokeOf(x, z);
    const k = smoothstep01((Math.abs(v) - (passHalfWidth(u) + 3)) / 7);
    if (k > 0) {
      position.setY(i, position.getY(i) - k * 3.5);
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
export function buildBlue2Ground(contacts: readonly ContactPatch[]): Mesh[] {
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
    bakeDeepStepsPaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "deepsteps-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The pass sheet: the Othershore and the Far Wall's upper face, from
  // just past the Drop Plains' own edge-sector trim (its sheets end at
  // rc 178 ≈ u 623), sunk 4 cm under our disc tiles' near edge.
  const passMid = worldOf(700, 0);
  const passGeometry = createSeabedGeometryAt(passMid.x, passMid.z, 156, PASS_SEGMENTS, -0.04);
  trimSheet(passGeometry, (x, z) => {
    const { u, v } = spokeOf(x, z);
    return u >= 626 && u <= 742 && Math.abs(v) <= passHalfWidth(u) + 10;
  });
  droopPassEdge(passGeometry);
  bakeDeepStepsPaint(passGeometry, contacts);
  const pass = new Mesh(passGeometry, material);
  pass.name = "deepsteps-ground-pass";
  pass.receiveShadow = true;
  meshes.push(pass);

  return meshes;
}
