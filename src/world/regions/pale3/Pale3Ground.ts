import { BufferAttribute, Color, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { smoothstep01 } from "./Pale3Shared";
import {
  CENTER_X,
  CENTER_Z,
  DAYSPRING,
  MERE,
  RESTS,
  STEPS_FROM,
  blushWeight,
  channelCenter,
  channelHalf,
  dawn,
  descentDrop,
  doorstepWeight,
  fontMound,
  matinsFloor,
  mereWeight,
  passGate,
  passHalfWidth,
  roadCenter,
  spokeOf,
  worldOf,
} from "./Pale3Terrain";

/**
 * The Dayspring's ground: five sheets and their authored paint.
 *
 * ## The tiling
 *
 * Four disc tiles in a 2×2 grid over the disc, plus one pass sheet
 * running the Matins back over the Lantern Combs' rim. The pass sheet
 * overlaps both grids by a few metres and is sunk 7 cm, with the
 * Combs-overlap span sunk deeper (the pale-2 round-4 lesson: a sunk
 * sheet still pokes through a neighbour's coarser triangulation at
 * dune crests, and bright paint makes every poke-through a flag).
 *
 * ## The paint — the chalk trick, inherited whole
 *
 * The vertex colour multiplies the warm sand wash (levelled mean
 * ≈ #bab08a), so every rule below composes an ABSOLUTE story colour in
 * linear light and only the last step divides it by the wash's own
 * mean, channel by channel (the Bone Meadows' round-3 cure, third
 * generation). The stories: the threshold carries the Combs' nacre
 * tan across the overlap and brightens toward our paper over 40 m;
 * the Matins' risers step down in violet shade with the UNDAWN a
 * composed held-breath dark; the vale is two whites drifting at the
 * 12 m scale with morning-gold patches arriving on `dawn`; the
 * BLUSHFIELDS take dawn-rose — the province's blush finally a field;
 * the mere is the palest floor in the region with the one REFLECTION
 * LANE of gold laid across its pearl (the low sun's lane on water,
 * painted on the floor); the Dawn Steps band nacre-bright and warm;
 * the SUN ROAD carries a faint gold lane up the spine; the doorstep
 * pan is one even warm white; and the far rim — the MORNINGLIP —
 * climbs milky, warming toward the spoke's bearing where the painted
 * morning stands beyond it.
 */

const SEED = SEEDS.regionPale3;

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
  return u >= 1136 && u <= 1316 && Math.abs(v) <= passHalfWidth(u) + 12;
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

/** The wash's levelled mean (#bab08a) in linear light — see the header. */
const WASH_MEAN = new Color(0.729, 0.69, 0.541).convertSRGBToLinear();

/** A story colour, authored in sRGB and converted once to linear. */
function story(hex: number): Color {
  return new Color(hex).convertSRGBToLinear();
}

// The palette the bake composes with — absolute paint, not multipliers.
const PAPER_WARM_G = story(0xf1e8d3);
const PAPER_COOL_G = story(0xe9e9f3);
const SHADOW_VIOLET_G = story(0xa997c6);
// The handover: keyed toward the Combs' own rim nacre so no poke-
// through of our sunk sheet can flag white over their crest.
const NACRE_HANDOVER = story(0xe2dcc8);
const SWARD_GOLD = story(0xdfca94);
const DAWN_ROSE_G = story(0xe8c3ba);
const MERE_PEARL_G = story(0xe0f1e4);
const REFLECTION_GOLD = story(0xf4d9a4);
const STEP_NACRE = story(0xeceedf);
const DOORSTEP_WHITE = story(0xfbf6ec);
const MORNING_GOLD_G = story(0xf0d4a2);

/**
 * The region's ground paint. The rules compose an absolute story colour
 * per vertex; the last step divides it by the wash's own linear mean.
 */
function bakeDawnPaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const col = new Color();

  // The reflection lane's axis: mere centre toward the Dayspring.
  const laneDU = DAYSPRING.u - MERE.u;
  const laneDV = DAYSPRING.v - MERE.v;
  const laneLen = Math.hypot(laneDU, laneDV);
  const laneNU = laneDU / laneLen;
  const laneNV = laneDV / laneLen;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const { u, v } = spokeOf(x, z);

    // Value structure from the ground's own relief — gentle, so the
    // white ground never reads as dirt. Round 2: the whole key lifted
    // (1.0 → 1.06) — r1's country read TAN, not paper, in every wide
    // frame; the morning needs a white ground to arrive on.
    const life = fbm(x * 0.024, z * 0.024, { seed: SEED ^ 0x5ae1, period: 9, octaves: 2 }) - 0.5;
    let value = 1.06 + life * 0.18;

    // The two whites, drifting at the ~12 m scale (round 2: the cool
    // share eased — the r1 mix leant lavender-tan).
    const cool = smoothstep01(
      (fbm(x * 0.014, z * 0.014, { seed: SEED ^ 0x5eaf, period: 6, octaves: 3 }) - 0.46) / 0.24,
    );
    col.copy(PAPER_WARM_G).lerp(PAPER_COOL_G, cool * 0.6);

    const k = dawn(u, v);

    // The threshold: the Combs' nacre carried across the overlap,
    // brightening toward our paper over ~40 m.
    const handover = 1 - smoothstep01((u - 1195) / 40);
    if (handover > 0) {
      col.lerp(NACRE_HANDOVER, handover * 0.7);
      value += handover * 0.02;
    }

    // The pass corridor: channel shadow and stepped risers, with the
    // paper carried INTO the shade (the Combs' round-3 cure, pre-paid:
    // a pre-lit warmth floor over the whole band).
    if (u < 1340) {
      const s = 1 - smoothstep01((u - 1312) / 28);
      const inChannel = 1 - smoothstep01((Math.abs(v - channelCenter(u)) - channelHalf(u)) / 7);
      value += s * 0.08;
      // THE UNDAWN is a COMPOSED dark: the hour before morning, a
      // violet held breath over the slot's floor.
      if (u > RESTS.undawn.fromU - 4 && u < RESTS.undawn.toU + 4) {
        const inShadow =
          smoothstep01((u - (RESTS.undawn.fromU - 4)) / 5) *
          (1 - smoothstep01((u - RESTS.undawn.toU) / 5));
        col.lerp(SHADOW_VIOLET_G, inShadow * inChannel * 0.22);
        value -= inShadow * inChannel * 0.05;
      }
      const drop = descentDrop(u);
      if (drop.riser > 0) {
        col.lerp(SHADOW_VIOLET_G, drop.riser * s * 0.18);
        value -= drop.riser * s * 0.05;
      }
      // Bank tops lean warm paper as they rise.
      const rise = smoothstep01((y - matinsFloor(u) - 1.2) / 3.5);
      col.lerp(PAPER_WARM_G, rise * s * 0.35);
      value += rise * s * 0.08;
      col.lerp(SHADOW_VIOLET_G, inChannel * s * 0.06);
    }

    // The vale sward: morning-gold patches arriving with the dawn —
    // the light feeding the floor, drawn at two scales.
    if (k > 0.02 && u > 1310) {
      const patch = smoothstep01(
        (fbm(x * 0.021, z * 0.021, { seed: SEED ^ 0x70af, period: 8, octaves: 3 }) - 0.44) / 0.24,
      );
      const fleck = smoothstep01(
        (fbm(x * 0.11, z * 0.11, { seed: SEED ^ 0xb1d5, period: 19, octaves: 2 }) - 0.56) / 0.12,
      );
      col.lerp(SWARD_GOLD, Math.min(1, k * 1.3) * patch * (0.38 + fleck * 0.34));
    }

    // THE BLUSHFIELDS: dawn-rose reaching the ground — the province's
    // blush, a field at last, drawn as patches so it reads painted.
    // Round 2: patches bigger and the rose stronger — r1 showed almost
    // no colour where the story says colour arrives.
    const blush = blushWeight(u, v);
    if (blush > 0.02) {
      const roseField = smoothstep01(
        (fbm(x * 0.019, z * 0.019, { seed: SEED ^ 0x51b7, period: 7, octaves: 3 }) - 0.4) / 0.3,
      );
      col.lerp(DAWN_ROSE_G, blush * roseField * 0.85);
      value += blush * roseField * 0.05;
    }

    // Violet shade drifting under the font ranks — the darkest thing
    // in the white country is a colour.
    const mound = fontMound(u, v);
    if (mound > 0) {
      const shade = smoothstep01(
        (fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x51b0, period: 11, octaves: 3 }) - 0.5) / 0.2,
      );
      // Round 4: down again — with the font's cool chalk and the
      // scree shade-sides this stacked three violets in one frame.
      col.lerp(SHADOW_VIOLET_G, mound * shade * 0.1);
      value -= mound * shade * 0.015;
    }

    // THE STILL MORNING: the palest floor in the region — a pearl
    // mirror with the one gold REFLECTION LANE laid across it toward
    // the Dayspring (the mirror carries the morning).
    // Round 3: the r2 fix overshot — lane + gold covered the bowl and
    // it read as a GOLD SAND PATCH. The bowl is nacre first; the lane
    // is ONE gold seam, clamped to the crossing chord and thinner.
    const bowl = mereWeight(u, v);
    if (bowl > 0) {
      col.lerp(MERE_PEARL_G, Math.min(1, bowl * 1.05));
      value += bowl * 0.2;
      const cross = (u - MERE.u) * laneNV - (v - MERE.v) * laneNU;
      const along = (u - MERE.u) * laneNU + (v - MERE.v) * laneNV;
      const chord = 1 - smoothstep01((Math.abs(along) - MERE.radius * 0.8) / 6);
      const lane = (1 - smoothstep01((Math.abs(cross) - 1.6) / 2.4)) * bowl * chord;
      if (lane > 0) {
        col.lerp(REFLECTION_GOLD, lane * 0.55);
        value += lane * 0.18;
      }
    }

    // The Dawn Steps: nacre banding on the rising terraces, warming
    // with the morning.
    if (u > STEPS_FROM - 8) {
      const band = 0.5 + 0.5 * Math.sin(y * 1.3 + 0.4);
      const own = smoothstep01((u - (STEPS_FROM - 8)) / 16) * (1 - bowl);
      col.lerp(STEP_NACRE, own * 0.65);
      col.lerp(MORNING_GOLD_G, own * k * 0.4);
      value += own * (0.04 + (band - 0.5) * 0.1);
    }

    // THE SUN'S DOORSTEP: one even warm white — the last ten metres
    // are silence; the flatness IS the composition.
    const doorstep = doorstepWeight(u, v);
    if (doorstep > 0) {
      col.lerp(DOORSTEP_WHITE, doorstep);
      value += doorstep * 0.12;
    }

    // THE SUN ROAD: the faint gold lane the morning draws up the
    // spine — strongest where the dawn is.
    if (u > 1330) {
      const away = Math.abs(v - roadCenter(u));
      const lane = 1 - smoothstep01((away - 1.4) / 3.2);
      if (lane > 0) {
        col.lerp(MORNING_GOLD_G, lane * (0.18 + k * 0.36));
        value += lane * (0.02 + k * 0.07);
      }
    }

    // The far rim: the MORNINGLIP — stacked ledge paint gated onto the
    // climbing wall, milky crest, warming toward the morning's bearing.
    const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
    const rim = smoothstep01((rc - 176) / 34) * (1 - passGate(u, v));
    if (rim > 0) {
      const ledge = Math.max(0, Math.sin(y * 0.6 + 0.5)) ** 2 * smoothstep01((rim - 0.45) / 0.3);
      const crest = smoothstep01((y + 8) / 10);
      const morning = smoothstep01((u - 1540) / 90);
      col.lerp(PAPER_COOL_G, rim * 0.5);
      col.lerp(DOORSTEP_WHITE, rim * crest * 0.55);
      col.lerp(MORNING_GOLD_G, rim * crest * morning * 0.4);
      value += rim * (crest * 0.08 - ledge * 0.1);
    }

    // Contact shade under everything that stands on the ground —
    // violet, not soot.
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
    col.lerp(SHADOW_VIOLET_G, (1 - shade) * 0.35);

    // The division: story colour over the wash's own mean. The 1.16
    // rides over the milk's flat light — the Bone Meadows' measured
    // number, inherited with its provenance.
    const total = value * (0.72 + shade * 0.28) * 1.16;
    colors[i * 3] = Math.max(0.2, Math.min(3.2, (col.r / WASH_MEAN.r) * total));
    colors[i * 3 + 1] = Math.max(0.2, Math.min(3.2, (col.g / WASH_MEAN.g) * total));
    colors[i * 3 + 2] = Math.max(0.2, Math.min(3.2, (col.b / WASH_MEAN.b) * total));
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** Builds the five painted ground sheets. */
export function buildPale3Ground(contacts: readonly ContactPatch[]): Mesh[] {
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
    bakeDawnPaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "pale3-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The pass sheet: covers the Matins and the threshold back over the
  // Combs' rim, overlapping both grids and sunk 7 cm.
  const passMid = worldOf(1218, 0);
  const passGeometry = createSeabedGeometryAt(passMid.x, passMid.z, 176, PASS_SEGMENTS, -0.07);
  trimSheet(passGeometry, (x, z) => {
    const { u, v } = spokeOf(x, z);
    return u >= 1134 && u <= 1320 && Math.abs(v) <= passHalfWidth(Math.min(u, 1300)) + 12;
  });
  // The Combs-overlap span sinks deeper (−0.25 feathering back to the
  // −0.07 base by u ≈ 1204): at 7 cm our sheet would poke through
  // their 2.2 m rim triangulation as pale patchwork (their round-3
  // finding at the pale-1 boundary, applied one boundary further out).
  {
    const position = passGeometry.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const { u } = spokeOf(position.getX(i), position.getZ(i));
      if (u < 1204) {
        position.setY(i, position.getY(i) - 0.18 * (1 - smoothstep01((u - 1156) / 48)));
      }
    }
    position.needsUpdate = true;
  }
  bakeDawnPaint(passGeometry, contacts);
  const pass = new Mesh(passGeometry, material);
  pass.name = "pale3-ground-pass";
  pass.receiveShadow = true;
  meshes.push(pass);

  return meshes;
}
