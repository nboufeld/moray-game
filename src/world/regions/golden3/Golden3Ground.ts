import { BufferAttribute, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { THRESHOLD_REST } from "./Golden3Beats";
import { processionShadow } from "./Golden3Rocks";
import { G3_SEEDS, smoothstep01 } from "./Golden3Shared";
import {
  BASIN_FLOOR,
  COMBE_TO,
  GARDEN_SPRING,
  PANS,
  WELL,
  WELL_FLOOR,
  basinSwell,
  combRidge,
  combWeight,
  combeChannelCenter,
  combeChannelHalf,
  combeDrop,
  doorRise,
  gardenWeight,
  panDish,
  passHalfWidth,
  spokeOf,
  wellCarve,
  worldOf,
} from "./Golden3Terrain";

/**
 * The Vesper Strand's ground: five sheets and their authored paint.
 *
 * ## The tiling
 *
 * Four disc tiles in a 2×2 grid over the disc (the province layout),
 * plus one pass sheet running the Last Shelf back over the Carillon
 * Waste's rim. The pass sheet overlaps both the disc tiles and the
 * Carillon Waste's own trimmed tiles (they reach its rc 240, spoke
 * u ≈ 1180) by a few metres and is sunk 4 cm — abutting different
 * grids cracks open on steep slopes; overlapped-and-sunk, the crack is
 * backed by ground.
 *
 * ## The paint
 *
 * The sand wash carries the marks; the vertex colours carry the PLACE —
 * and the place is one hour: evening. Salt-pale crust over rose-amber
 * grain across the flats; every procession stone throwing one long
 * violet shadow back up the road; the mirror pans painted as held sky —
 * the brightest floors in the region; the comb crests lit on their
 * sunward side and violet in the lee; honey pour-stains falling down
 * the combe's three lips; green-gold life rings around the garden
 * spring; the Night Well deepening to the region's darkest violet; the
 * Sun's Door rise painted warm and bright with the Pilgrim's Threshold
 * swept in faint ripple rings — composed bareness, painted on purpose;
 * and the Vesper Rampart — the world's last wall — climbing milky-rose
 * out of the basin the way a sunset leaves the ground.
 */

const SEED = SEEDS.regionGolden3;

const CENTRE = worldOf(1460, 0);

/** Ground kept out to here from the disc's centre. */
const DISC_GROUND_R = 240;
const DISC_TILE = 231;
const DISC_SEGMENTS = 104;
const PASS_SEGMENTS = 60;

function keepGround(x: number, z: number): boolean {
  const rc = Math.hypot(x - CENTRE.x, z - CENTRE.z);
  if (rc <= DISC_GROUND_R) {
    return true;
  }
  const { u, v } = spokeOf(x, z);
  return u >= 1136 && u <= 1330 && Math.abs(v) <= passHalfWidth(u) + 14;
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

/** Wind-laid pale drift ribbons — the sand the dying wind still moves. */
function drift(x: number, z: number): number {
  return fbm(x * 0.017, z * 0.017, { seed: SEED ^ G3_SEEDS.paintDrift, period: 7, octaves: 3 });
}

/** The darker grain under the drifts. */
function grain(x: number, z: number): number {
  return fbm(x * 0.05, z * 0.05, { seed: SEED ^ G3_SEEDS.paintGrain, period: 11, octaves: 2 });
}

/** The salt crust: pale mineral plates spreading from the pans. */
function crust(x: number, z: number): number {
  return fbm(x * 0.03, z * 0.03, { seed: SEED ^ G3_SEEDS.paintCrust, period: 8, octaves: 2 });
}

/**
 * The region's ground paint. Value first, then temperature; every tint
 * multiplies the sand wash, so 1 is "the bowl's own sand" and the
 * biomes pull it toward their own key.
 */
function bakeVesperPaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const { u, v } = spokeOf(x, z);
    const rc = Math.hypot(x - CENTRE.x, z - CENTRE.z);

    // Value structure from the ground's own relief.
    const life =
      fbm(x * 0.026, z * 0.026, { seed: SEED ^ G3_SEEDS.paintLife, period: 9, octaves: 2 }) - 0.5;
    let value = 0.92 + life * 0.34;

    // The evening amber base: pale wind-drift over darker grain, blue
    // cut hard so the gold arrives by ratio; red held a step over the
    // Carillon Waste's — the register is later in the day.
    const ribbons = smoothstep01((drift(x, z) - 0.48) / 0.24);
    const grains = smoothstep01((grain(x, z) - 0.58) / 0.2);
    let r = 1.04 + ribbons * 0.13 - grains * 0.18;
    let g = 0.88 + ribbons * 0.13 - grains * 0.18;
    let b = 0.46 + ribbons * 0.09 - grains * 0.05;
    value += ribbons * 0.05 - grains * 0.07;

    const inCountry = smoothstep01((u - COMBE_TO + 12) / 26);

    if (inCountry > 0) {
      // Beat-repair (#14): the off-spine dune faces. The critic's
      // lost-bearing frame was a full-frame smooth dune whose only
      // drawing was the toon ramp's own step — a dark hairline contour
      // kinking along the grid (probed: nulling the gradient map erased
      // the lines). The dune takes the region's quiet detail instead:
      // wind-ripple bands at two scales and a soft violet lean in the
      // troughs, loud enough that no iso-light band survives as a naked
      // line. The pans, garden, door and combe paint all land AFTER and
      // override, so the ripples live only where the ground was bare.
      const rippleWander =
        (fbm(x * 0.021, z * 0.021, { seed: SEED ^ G3_SEEDS.paintRipple, period: 7, octaves: 2 }) -
          0.5) *
        9;
      const rippleWide = Math.sin(u * 0.72 + v * 0.31 + rippleWander);
      const rippleFine = Math.sin(u * 1.9 + v * 0.85 + rippleWander * 2.3);
      // r3-beat read: ±0.07 was still whisper-quiet next to the ramp
      // step — the amplitudes go up a step, and the rampart's FOOT BAND
      // (rc 140–200, where the bowl eases into the wall and the toon
      // contour drew its longest lines) takes an extra soft mottle.
      // Final amplitude, measured not guessed: a pixel-diff of the r5
      // capture showed ±0.11 in vColor survives to ~3% on screen (sand
      // wash × toon ramp × tone curve compress ~4×) — ±0.18 lands the
      // gentle ~8% read the register wants.
      const rippleAmp = (rippleWide * 0.18 + rippleFine * 0.09) * inCountry;
      value += rippleAmp;
      const footBand =
        smoothstep01((rc - 138) / 22) * (1 - smoothstep01((rc - 198) / 14)) * inCountry;
      if (footBand > 0) {
        const mottle =
          fbm(x * 0.055, z * 0.055, { seed: SEED ^ (G3_SEEDS.paintRipple + 1), period: 8, octaves: 2 }) -
          0.5;
        value += mottle * 0.3 * footBand;
      }
      // Troughs lean violet — the evening's own shade, never a grey.
      const trough = Math.max(0, -rippleWide) * inCountry;
      r -= trough * 0.09;
      g -= trough * 0.11;
      b += trough * 0.09;
      // The flats' story: salt crust spreading pale over the amber,
      // strongest near the pans, and the Procession's long violet
      // shadows — the evening's whole value structure.
      let nearPan = 0;
      for (const pan of PANS) {
        const d = Math.hypot(u - pan.u, v - pan.v);
        nearPan = Math.max(nearPan, 1 - smoothstep01((d - pan.radius) / 26));
      }
      const crustHere =
        smoothstep01((crust(x, z) - 0.52) / 0.2) * (0.35 + 0.65 * nearPan) * inCountry;
      r += (1.08 - r) * crustHere * 0.6;
      g += (1.02 - g) * crustHere * 0.6;
      b += (0.72 - b) * crustHere * 0.5;
      value += crustHere * 0.1;

      const hollow = 1 - smoothstep01(basinSwell(x, z) / 1.2);
      r += (1.1 - r) * hollow * 0.25 * inCountry;
      g += (0.96 - g) * hollow * 0.25 * inCountry;
      b += (0.5 - b) * hollow * 0.2 * inCountry;

      const shadow = processionShadow(u, v);
      r += (0.46 - r) * shadow * inCountry;
      g += (0.36 - g) * shadow * inCountry;
      b += (0.94 - b) * shadow * inCountry;
      value -= shadow * 0.3 * inCountry;

      // The comb fields: crests lit rose-gold on the sunward flank,
      // violet pooled in the lee troughs (contrast doubled in round 2:
      // at sweep range the r1 combs read as one muddy wash).
      const comb = combWeight(u, v);
      if (comb > 0.02) {
        const ridge = Math.min(1, combRidge(u, v) / 4.2); // 0..1 crest factor
        const lee = comb * (1 - ridge);
        r += (1.16 - r) * ridge * 0.6 * inCountry;
        g += (1.0 - g) * ridge * 0.6 * inCountry;
        b += (0.54 - b) * ridge * 0.5 * inCountry;
        value += ridge * 0.16 * inCountry;
        r += (0.58 - r) * lee * 0.42 * inCountry;
        g += (0.48 - g) * lee * 0.42 * inCountry;
        b += (0.86 - b) * lee * 0.34 * inCountry;
        value -= lee * 0.12 * inCountry;
      }
    }

    if (u < COMBE_TO + 26) {
      // The Last Shelf: the Carillon Waste's milky decrescendo carried
      // across the threshold — the honest handover.
      const shelf = 1 - smoothstep01((u - 1230) / 40);
      r += (1.05 - r) * shelf * 0.7;
      g += (0.99 - g) * shelf * 0.7;
      b += (0.85 - b) * shelf * 0.7;
      value += shelf * 0.07;
      // The combe: honey pour-stains falling down the lips, violet
      // flute grooves on the dune walls, warm channel floor.
      const inCombe = smoothstep01((u - 1240) / 16) * (1 - smoothstep01((u - (COMBE_TO + 10)) / 20));
      if (inCombe > 0) {
        const pour = combeDrop(u).pour;
        const away = Math.abs(v - combeChannelCenter(u));
        const inChannel = 1 - smoothstep01((away - combeChannelHalf(u)) / 8);
        const wallT = smoothstep01((away - combeChannelHalf(u)) / 9);
        const groove = Math.max(0, -Math.sin(v * 0.9 + u * 0.05)) * wallT;
        const stain =
          smoothstep01(
            (fbm(x * 0.055, z * 0.055, { seed: SEED ^ G3_SEEDS.paintStain, period: 9, octaves: 3 }) -
              0.48) /
              0.22,
          ) *
          (0.4 + 0.6 * inChannel);
        const honeyR = 0.94 + stain * 0.26 + pour * 0.22 - groove * 0.3;
        const honeyG = 0.78 + stain * 0.18 + pour * 0.2 - groove * 0.3;
        const honeyB = 0.5 - stain * 0.08 + pour * 0.08 + groove * 0.28;
        r += (honeyR - r) * inCombe;
        g += (honeyG - g) * inCombe;
        b += (honeyB - b) * inCombe;
        value += (stain * 0.07 + pour * 0.14 - groove * 0.1) * inCombe;
      }
    }

    // The Mirror Pans: held sky — the brightest floors in the region,
    // cream-gold leaning faintly violet-blue at each dish's heart.
    const dish = panDish(u, v);
    if (dish > 0.04) {
      const held = smoothstep01((dish - 0.04) / 0.5);
      r += (1.06 - r) * held;
      g += (1.04 - g) * held;
      b += (0.92 - b) * held;
      value += held * 0.18;
      // The heart: the sky's own violet lean, red kept above green.
      const heart = smoothstep01((dish - 0.6) / 0.3);
      r += (0.98 - r) * heart * 0.5;
      g += (0.92 - g) * heart * 0.5;
      b += (1.02 - b) * heart * 0.5;
    }

    // The Afterglow Garden: green-gold life rings around the spring,
    // warm floor under the candles.
    const garden = gardenWeight(u, v);
    if (garden > 0.02) {
      const springD = Math.hypot(u - GARDEN_SPRING.u, v - GARDEN_SPRING.v);
      const ring = 1 - smoothstep01((springD - GARDEN_SPRING.radius) / 16);
      const stain =
        0.5 +
        0.5 *
          smoothstep01(
            (fbm(x * 0.045, z * 0.045, { seed: SEED ^ G3_SEEDS.paintStain, period: 10, octaves: 2 }) -
              0.42) /
              0.3,
          );
      r += (0.86 - r) * garden * 0.5;
      g += (0.94 - g) * garden * 0.5;
      b += (0.5 - b) * garden * 0.4;
      r += (0.74 - r) * ring * stain * garden;
      g += (0.96 - g) * ring * stain * garden;
      b += (0.52 - b) * ring * stain * garden;
      value += garden * 0.04 + ring * 0.06;
      if (springD < GARDEN_SPRING.radius * 1.2) {
        // The spring's dish: pale mineral green, the water's own light.
        const pool = 1 - smoothstep01((springD - GARDEN_SPRING.radius * 0.6) / 2.5);
        r += (0.88 - r) * pool;
        g += (1.06 - g) * pool;
        b += (0.78 - b) * pool;
        value += pool * 0.12;
      }
    }

    // The Night Well: the desert's dark begins — violet deepening with
    // the carve, the rim drawn as a bright lip line.
    const well = wellCarve(u, v);
    if (well.carve < -0.5 || well.lip > 0.05) {
      const depthT = smoothstep01((BASIN_FLOOR - y) / (BASIN_FLOOR - WELL_FLOOR));
      const wellD = Math.hypot(u - WELL.u, v - WELL.v);
      const lipLine =
        smoothstep01((wellD - WELL.radius * 0.9) / 1.5) *
        (1 - smoothstep01((wellD - WELL.radius * 1.7) / 3));
      r += (0.62 - r) * depthT;
      g += (0.5 - g) * depthT;
      b += (0.98 - b) * depthT;
      value += lipLine * 0.16 - depthT * 0.24;
    }

    // The Sun's Door rise: warm and bright — the region's lit stage —
    // with the Pilgrim's Threshold swept in faint ripple rings.
    const rise = doorRise(u, v);
    if (rise > 0.02) {
      r += (1.1 - r) * rise * 0.6;
      g += (0.98 - g) * rise * 0.6;
      b += (0.56 - b) * rise * 0.5;
      value += rise * 0.1;
      const restD = Math.hypot(u - THRESHOLD_REST.u, v - THRESHOLD_REST.v);
      if (restD < THRESHOLD_REST.radius + 6) {
        const ringWave = Math.sin((restD / 4.4) * Math.PI * 2);
        const swept = 1 - smoothstep01((restD - THRESHOLD_REST.radius) / 6);
        value += swept * (0.07 + Math.max(0, ringWave) * 0.07);
      }
    }

    // The Vesper Rampart: the world's last wall climbs milky-rose out
    // of the basin — the sunset leaving the ground. Round 2: the r1
    // wall was a flat beige curtain in every far-pole frame — the
    // runnels doubled, height strata added, the crest warmed harder.
    const rampart = smoothstep01((rc - 165) / 40);
    if (rampart > 0) {
      const theta = Math.atan2(z - CENTRE.z, x - CENTRE.x);
      const height = smoothstep01((y - BASIN_FLOOR - 4) / 20);
      const runnel = Math.max(0, Math.sin(theta * 44 + Math.sin(theta * 9) * 2));
      const strata =
        fbm(theta * 8, y * 0.24, { seed: SEED ^ G3_SEEDS.paintStain, period: 6, octaves: 2 }) -
        0.5;
      r += (1.18 - r) * rampart * (0.4 + height * 0.55);
      g += (0.98 - g) * rampart * (0.4 + height * 0.55);
      b += (0.7 - b) * rampart * (0.3 + height * 0.55);
      // The runnels lean violet in their shade (red over green, held).
      // Round 3: contrast raised again — through 60+ m of fog the r2
      // wall still ironed flat; the drawing must overshoot to survive.
      // Beat-repair (#14): the journey's evening-horizon proved 60 m of
      // optimism short — the terminus frame closes on the wall's
      // MID-BAND and it read as one beige value. Runnel weight up
      // again, a BROAD fold family joins it (~90 m period — the width a
      // 100 m read actually resolves), and height strata deepened.
      const broad = 0.5 + 0.5 * Math.sin(theta * 13 + Math.sin(theta * 5) * 1.6);
      r += (0.56 - r) * rampart * runnel * 0.68;
      g += (0.44 - g) * rampart * runnel * 0.68;
      b += (0.92 - b) * rampart * runnel * 0.52;
      r += (0.72 - r) * rampart * broad * 0.3;
      g += (0.58 - g) * rampart * broad * 0.3;
      b += (0.84 - b) * rampart * broad * 0.24;
      value += rampart * (height * 0.2 + strata * 0.48 - runnel * 0.28 - broad * 0.14);
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
    colors[i * 3] = Math.max(0.25, Math.min(1.32, r * total));
    colors[i * 3 + 1] = Math.max(0.25, Math.min(1.32, g * total));
    colors[i * 3 + 2] = Math.max(0.25, Math.min(1.32, b * total));
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** Builds the five painted ground sheets. */
export function buildGolden3Ground(contacts: readonly ContactPatch[]): Mesh[] {
  const material = createSandMaterial();
  const meshes: Mesh[] = [];

  // Round 3: ONE disc sheet. The 2×2 tiling seamed twice — r1's abutting
  // grids opened a dark line, and r2's overlap-and-sink still drew its
  // 3 cm step across the smooth comb fields at grazing angles. A single
  // 211-segment sheet is the same vertex budget with no seam to hide,
  // and three fewer draws.
  const geometry = createSeabedGeometryAt(
    CENTRE.x,
    CENTRE.z,
    DISC_TILE * 2 + 4,
    DISC_SEGMENTS * 2 + 3,
  );
  trimSheet(geometry, keepGround);
  bakeVesperPaint(geometry, contacts);
  const disc = new Mesh(geometry, material);
  disc.name = "vesper-ground-disc";
  disc.receiveShadow = true;
  meshes.push(disc);

  // The pass sheet: the Last Shelf and the combe's head, back over the
  // Carillon Waste's rim — overlapping its tiles (they reach spoke
  // u ≈ 1180) and ours (near edge u ≈ 1220), sunk 4 cm.
  const passMid = worldOf(1180, 0);
  const passGeometry = createSeabedGeometryAt(passMid.x, passMid.z, 110, PASS_SEGMENTS, -0.04);
  trimSheet(passGeometry, (x, z) => {
    const { u, v } = spokeOf(x, z);
    return u >= 1136 && u <= 1226 && Math.abs(v) <= passHalfWidth(u) + 12;
  });
  bakeVesperPaint(passGeometry, contacts);
  const pass = new Mesh(passGeometry, material);
  pass.name = "vesper-ground-pass";
  pass.receiveShadow = true;
  meshes.push(pass);

  return meshes;
}
