import { BufferAttribute, Color, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { smoothstep01 } from "./Pale2Shared";
import {
  CENTER_X,
  CENTER_Z,
  CHAPEL,
  LAMP_BASIN,
  POOLS,
  RESTS,
  STEPS_FROM,
  basinWeight,
  chapelWeight,
  channelCenter,
  channelHalf,
  combMound,
  descentDrop,
  lumen,
  passGate,
  passHalfWidth,
  spokeOf,
  winnowFloor,
  worldOf,
} from "./Pale2Terrain";

/**
 * The Lantern Combs' ground: five sheets and their authored paint.
 *
 * ## The tiling
 *
 * Four disc tiles in a 2×2 grid over the disc, plus one pass sheet
 * running the Winnow back over the Bone Meadows' rim. The pass sheet
 * overlaps both grids by a few metres and is sunk 7 cm (the verdant-3
 * number: at 4 cm the overlap edge caught as a thin dark line at
 * grazing angles).
 *
 * ## The paint — the chalk trick, inherited whole
 *
 * The vertex colour multiplies the warm sand wash (levelled mean
 * ≈ #bab08a — in linear light its blue is barely half its red), so no
 * near-unit multiplier can ever whiten it. The Bone Meadows' round-3
 * cure is taken from the first line here: every rule below composes an
 * ABSOLUTE story colour in linear light, and only the last step
 * divides it by the wash's own mean, channel by channel — the screen
 * shows the story colour, and the wash's ripple marks survive as
 * value grain. The blue multiplier legitimately runs past 2.
 *
 * The stories this bake tells: the threshold carries the Bone
 * Meadows' own milk across the overlap (the province handover grammar)
 * and warms to our paper over 40 m; the Winnow's risers step down in
 * violet shade with top-lit treads; the galleries are two whites
 * drifting at the 12 m scale with warm sward patches arriving on
 * `lumen`; the moonmilk pools are the palest floors in the province —
 * pearl-seafoam bowls; the White Chapel pan is one even white (its
 * austerity is flatness); the Lamp Basin warms band by band to candle
 * gold at the heart — the one place in the pale province the ground
 * itself is allowed to glow warm; the Pearl Steps band pearl-bright;
 * and the far rim climbs in stacked ledge paint with a milky crest.
 */

const SEED = SEEDS.regionPale2;

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
  return u >= 646 && u <= 812 && Math.abs(v) <= passHalfWidth(u) + 12;
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
const PAPER_WARM_G = story(0xefe6d1);
// Round 3: the cool white warmed a step — at 0xdfe1f0 its fbm patches
// read as flat lavender puddles at close range under the violet ambient.
const PAPER_COOL_G = story(0xe8e8f2);
const SHADOW_VIOLET_G = story(0xa997c6);
// Round 4: keyed DOWN toward pale-1's own dune tan — the bright milk
// made every poke-through of our sunk sheet a white flag over their
// dunes at the threshold (r3's patchwork).
const MILK_HANDOVER = story(0xe0d9c4);
const SWARD_GOLD = story(0xdcc793);
const MOON_PEARL_G = story(0xdff0e3);
const CHAPEL_WHITE = story(0xfbf8f1);
const BASIN_GOLD = story(0xeed3a4);
// Round 4: lifted from 0xe4b87e — the caramel read terracotta mud
// under the violet ambient at close range (candle, not rust).
// Round 5: one more step (0xefd0a0 →) — the deepest band still leant
// ochre at arm's length in close-garden-bed; the wide shots were right.
const LAMP_HEART = story(0xf0d8b0);
const PEARL_BAND = story(0xe9ecdf);

/**
 * The region's ground paint. The rules compose an absolute story colour
 * per vertex; the last step divides it by the wash's own linear mean.
 */
function bakeCombPaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const col = new Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const { u, v } = spokeOf(x, z);

    // Value structure from the ground's own relief — gentle, so the
    // white ground never reads as dirt.
    const life = fbm(x * 0.024, z * 0.024, { seed: SEED ^ 0x5ae1, period: 9, octaves: 2 }) - 0.5;
    let value = 1.0 + life * 0.2;

    // The two whites, drifting at the ~12 m scale.
    const cool = smoothstep01(
      (fbm(x * 0.014, z * 0.014, { seed: SEED ^ 0x5eaf, period: 6, octaves: 3 }) - 0.46) / 0.24,
    );
    col.copy(PAPER_WARM_G).lerp(PAPER_COOL_G, cool * 0.75);

    const k = lumen(u, v);

    // The threshold: the Bone Meadows' milk carried across the overlap,
    // warming to our paper over ~40 m (the doctrine's 20+ m rule).
    const milk = 1 - smoothstep01((u - 700) / 40);
    if (milk > 0) {
      col.lerp(MILK_HANDOVER, milk * 0.7);
      value += milk * 0.02;
    }

    // The pass corridor: channel shadow and stepped risers. Round 3:
    // every violet halved again AND a pre-lit warmth floor over the
    // whole band — the banks face away from the sun, fall into the
    // toon ramp's dark band, and r2 read as a lavender wall; the paint
    // must carry the paper INTO the shade.
    if (u < 840) {
      const s = 1 - smoothstep01((u - 812) / 28);
      const inChannel = 1 - smoothstep01((Math.abs(v - channelCenter(u)) - channelHalf(u)) / 7);
      value += s * 0.08;
      // The Winnow Shadow rest is a COMPOSED dark: a violet held breath
      // over the slot's floor, so its licensed bareness reads authored.
      if (u > RESTS.winnowShadow.fromU - 4 && u < RESTS.winnowShadow.toU + 4) {
        const inShadow =
          smoothstep01((u - (RESTS.winnowShadow.fromU - 4)) / 5) *
          (1 - smoothstep01((u - RESTS.winnowShadow.toU) / 5));
        col.lerp(SHADOW_VIOLET_G, inShadow * inChannel * 0.2);
        value -= inShadow * inChannel * 0.04;
      }
      const drop = descentDrop(u);
      if (drop.riser > 0) {
        // Riser faces step down in violet shade; treads stay lit.
        col.lerp(SHADOW_VIOLET_G, drop.riser * s * 0.18);
        value -= drop.riser * s * 0.05;
      }
      // Bank tops lean warm paper as they rise (r2: cool-white here
      // stacked lavender on lavender).
      const rise = smoothstep01((y - winnowFloor(u) - 1.2) / 3.5);
      col.lerp(PAPER_WARM_G, rise * s * 0.35);
      value += rise * s * 0.05;
      // Channel floor: a breath of violet — the walk line reads as a way.
      col.lerp(SHADOW_VIOLET_G, inChannel * s * 0.06);
    }

    // The gallery sward: warm gold patches arriving with the lumen —
    // the light feeding the floor, drawn at two scales so it reads as
    // painting, not tint.
    if (k > 0.02 && u > 780) {
      const patch = smoothstep01(
        (fbm(x * 0.021, z * 0.021, { seed: SEED ^ 0x70af, period: 8, octaves: 3 }) - 0.44) / 0.24,
      );
      const fleck = smoothstep01(
        (fbm(x * 0.11, z * 0.11, { seed: SEED ^ 0xb1d5, period: 19, octaves: 2 }) - 0.56) / 0.12,
      );
      col.lerp(SWARD_GOLD, Math.min(1, k * 1.4) * patch * (0.4 + fleck * 0.35));
    }

    // Violet shade drifting under the comb ranks — the darkest thing in
    // the white country is a colour.
    const mound = combMound(u, v);
    if (mound > 0) {
      const shade = smoothstep01(
        (fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x51b0, period: 11, octaves: 3 }) - 0.5) / 0.2,
      );
      col.lerp(SHADOW_VIOLET_G, mound * shade * 0.22);
      value -= mound * shade * 0.03;
    }

    // The Moonmilk Pools: the palest floors in the province — pearl
    // bowls with faint stillness rings, brightest at the heart.
    for (const pool of POOLS) {
      const d = Math.hypot(u - pool.u, v - pool.v);
      if (d < pool.radius * 2) {
        const bowl = 1 - smoothstep01((d - pool.radius * 0.8) / pool.radius);
        const rings = 0.5 + 0.5 * Math.sin(d * 0.5);
        col.lerp(MOON_PEARL_G, bowl);
        // Round 4: brighter — the r3 bowls read but under-sold.
        value += bowl * (0.24 + rings * 0.015);
      }
    }

    // The White Chapel: one even white — the palest, flattest paint in
    // the game; the hush is in how little happens here.
    const chapel = chapelWeight(u, v);
    if (chapel > 0) {
      col.lerp(CHAPEL_WHITE, chapel);
      value += chapel * 0.12;
    }

    // The Lamp Basin: the ground warms band by band into candle gold —
    // the one warm floor in the pale province, because the lamp lives
    // here. The heart deepens (depth painted as colour, never black).
    const basin = basinWeight(u, v);
    if (basin > 0) {
      const d = Math.hypot(u - LAMP_BASIN.u, v - LAMP_BASIN.v);
      const heart = 1 - smoothstep01((d - 8) / 22);
      col.lerp(BASIN_GOLD, basin * 0.75);
      col.lerp(LAMP_HEART, basin * heart * 0.5);
      // Round 3: the basin's value lifted a step — r2's gold sat at
      // mid value and the garden beds read toward mud.
      value += basin * 0.08 - basin * heart * 0.04;
    }

    // The Pearl Steps: nacre banding on the rising terraces.
    if (u > STEPS_FROM - 8 && basin < 0.4) {
      const band = 0.5 + 0.5 * Math.sin(y * 1.3 + 0.4);
      const own = smoothstep01((u - (STEPS_FROM - 8)) / 16);
      col.lerp(PEARL_BAND, own * 0.5);
      value += own * (band - 0.5) * 0.1;
    }

    // The far rim: the Pearl Rampart — stacked ledge paint gated onto
    // the climbing wall (never contour arcs on the flat skirt — the
    // Canopy Deep's round-4 lesson), with a milky crest.
    const rc = Math.hypot(x - CENTER_X, z - CENTER_Z);
    const rim = smoothstep01((rc - 176) / 34) * (1 - passGate(u, v));
    if (rim > 0) {
      const ledge = Math.max(0, Math.sin(y * 0.6 + 0.5)) ** 2 * smoothstep01((rim - 0.45) / 0.3);
      const crest = smoothstep01((y + 8) / 10);
      col.lerp(PAPER_COOL_G, rim * 0.5);
      col.lerp(CHAPEL_WHITE, rim * crest * 0.6);
      value += rim * (crest * 0.08 - ledge * 0.1);
    }

    // Contact shade under everything that stands on the ground — violet,
    // not soot.
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
export function buildPale2Ground(contacts: readonly ContactPatch[]): Mesh[] {
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
    bakeCombPaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "pale2-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The pass sheet: covers the Winnow and the threshold back over the
  // Bone Meadows' rim, overlapping both grids and sunk 7 cm.
  const passMid = worldOf(722, 0);
  const passGeometry = createSeabedGeometryAt(passMid.x, passMid.z, 170, PASS_SEGMENTS, -0.07);
  trimSheet(passGeometry, (x, z) => {
    const { u, v } = spokeOf(x, z);
    return u >= 640 && u <= 816 && Math.abs(v) <= passHalfWidth(Math.min(u, 790)) + 12;
  });
  // Round 4: the pale-1 overlap span sinks deeper (−0.25 feathering
  // back to the −0.07 base by u 708) — at 7 cm our sheet poked through
  // their coarser dune triangulation as white patchwork (r3). The
  // gradient is centimetres over fifty metres; the baked normals hold.
  {
    const position = passGeometry.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const { u } = spokeOf(position.getX(i), position.getZ(i));
      if (u < 708) {
        position.setY(i, position.getY(i) - 0.18 * (1 - smoothstep01((u - 660) / 48)));
      }
    }
    position.needsUpdate = true;
  }
  bakeCombPaint(passGeometry, contacts);
  const pass = new Mesh(passGeometry, material);
  pass.name = "pale2-ground-pass";
  pass.receiveShadow = true;
  meshes.push(pass);

  return meshes;
}

// Re-exported for the paint's own tests.
export { CHAPEL };
