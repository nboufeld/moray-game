import { BufferAttribute, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { hoodooShadow } from "./Golden2Rocks";
import { G2_SEEDS, smoothstep01 } from "./Golden2Shared";
import { PAVEMENT_REST } from "./Golden2Beats";
import {
  CARILLON,
  COURT_FLOOR,
  GULLY_TO,
  RIBBON_FLOOR,
  SEEP_POOLS,
  carillonWeight,
  courtSwale,
  gullyChannelCenter,
  gullyChannelHalf,
  gullyFloor,
  passHalfWidth,
  ribbonCarve,
  ribbonDistance,
  seepBenches,
  seepPoolDish,
  seepsWeight,
  shelfWeight,
  spokeOf,
  windowsRidge,
  worldOf,
} from "./Golden2Terrain";

/**
 * The Carillon Waste's ground: five sheets and their authored paint.
 *
 * ## The tiling
 *
 * Four disc tiles in a 2×2 grid over the disc (the pilots' layout),
 * plus one pass sheet running the Shore Road back over the Hourglass
 * Sea's rim. The pass sheet overlaps both the disc tiles and the
 * Hourglass Sea's own trimmed tiles (they reach its rc 240, spoke
 * u ≈ 685) by a few metres and is sunk 4 cm — abutting different grids
 * cracks open on steep slopes; overlapped-and-sunk, the crack is
 * backed by ground.
 *
 * ## The paint
 *
 * The sand wash carries the marks; the vertex colours carry the PLACE.
 * This desert's value structure is carved, not blown: sunlit ochre on
 * every rise and rim, warm violet pooled in swales, joints and flutes,
 * each hoodoo throwing one long painted violet shadow across the
 * court, travertine pale on the seep benches with green seep-stains
 * running off the pools, the Ribbon's rim drawn as the brightest line
 * in the region over a violet deep, and the Pavement's swept
 * concentric rings — composed bareness, painted on purpose.
 */

const SEED = SEEDS.regionGolden2;

const CENTRE = worldOf(940, 0);

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
  return u >= 640 && u <= 830 && Math.abs(v) <= passHalfWidth(u) + 14;
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

/** Wind-laid pale drift ribbons — the sand the wind still moves. */
function drift(x: number, z: number): number {
  return fbm(x * 0.017, z * 0.017, { seed: SEED ^ G2_SEEDS.paintDrift, period: 7, octaves: 3 });
}

/** The darker grain under the drifts. */
function grain(x: number, z: number): number {
  return fbm(x * 0.05, z * 0.05, { seed: SEED ^ G2_SEEDS.paintGrain, period: 11, octaves: 2 });
}

/**
 * The carved joint seams: broad shaded bands crossing the pavement in
 * two families (~6 m wide on ~30 m spacing — honest on the 2.2 m
 * grid), wandered by one seeded fbm so no seam runs ruler-straight.
 */
function jointSeam(u: number, v: number): number {
  const wander =
    (fbm(u * 0.01, v * 0.01, { seed: SEED ^ G2_SEEDS.paintJoint, period: 5, octaves: 2 }) - 0.5) *
    8;
  const a = Math.abs(Math.sin((u + wander) * 0.105 + 0.6));
  const b = Math.abs(Math.sin((u * 0.42 - v * 0.91 + wander) * 0.076 + 1.9));
  return Math.max(smoothstep01((a - 0.9) / 0.1), smoothstep01((b - 0.92) / 0.08) * 0.8);
}

/**
 * The region's ground paint. Value first, then temperature; every tint
 * multiplies the sand wash, so 1 is "the bowl's own sand" and the
 * biomes pull it toward their own key.
 */
function bakeCarillonPaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const { u, v } = spokeOf(x, z);

    // Value structure from the ground's own relief.
    const life =
      fbm(x * 0.026, z * 0.026, { seed: SEED ^ G2_SEEDS.paintLife, period: 9, octaves: 2 }) - 0.5;
    let value = 0.92 + life * 0.36;

    // The carved amber base: pale wind-drift over darker grain, blue
    // cut hard so the gold arrives by ratio (the pilot's move).
    const ribbons = smoothstep01((drift(x, z) - 0.48) / 0.24);
    const grains = smoothstep01((grain(x, z) - 0.58) / 0.2);
    let r = 1.02 + ribbons * 0.14 - grains * 0.18;
    let g = 0.9 + ribbons * 0.14 - grains * 0.18;
    let b = 0.46 + ribbons * 0.09 - grains * 0.05;
    value += ribbons * 0.05 - grains * 0.07;

    const inCountry = smoothstep01((u - GULLY_TO + 10) / 24);

    if (inCountry > 0) {
      // The pavement's story: swale hollows collect blown sand (warm,
      // rippled); the rises are carved stone with violet joint seams.
      const rise = smoothstep01(courtSwale(x, z) / 1.3);
      const seam = jointSeam(u, v) * (1 - (1 - rise) * 0.6);
      const shadow = hoodooShadow(u, v);
      // Swale hollows collect blown sand: warmer, softer than the stone.
      const hollow = 1 - rise;
      r += (1.1 - r) * hollow * 0.35 * inCountry;
      g += (0.98 - g) * hollow * 0.35 * inCountry;
      b += (0.5 - b) * hollow * 0.3 * inCountry;
      // Joint seams: violet-cooled, a value down.
      r += (0.56 - r) * seam * 0.55 * inCountry;
      g += (0.46 - g) * seam * 0.55 * inCountry;
      b += (0.86 - b) * seam * 0.4 * inCountry;
      value -= seam * 0.1 * inCountry;
      // The hoodoos' long violet shadows — the court's whole value
      // structure, thrown along the region's one painted low sun.
      r += (0.44 - r) * shadow * inCountry;
      g += (0.34 - g) * shadow * inCountry;
      b += (0.94 - b) * shadow * inCountry;
      value -= shadow * 0.3 * inCountry;
    }

    if (u < GULLY_TO + 26) {
      // The Shore Road and the Wind Gully: the Hourglass Sea's milky
      // shore key carried across the threshold, warming into the
      // gully's honey as the walls rise — the road's whole story.
      const shore = 1 - smoothstep01((u - 720) / 46);
      r += (1.04 - r) * shore * 0.7;
      g += (0.98 - g) * shore * 0.7;
      b += (0.84 - b) * shore * 0.7;
      value += shore * 0.07;
      const inGully = smoothstep01((u - 738) / 18) * (1 - smoothstep01((u - (GULLY_TO + 8)) / 20));
      if (inGully > 0) {
        const away = Math.abs(v - gullyChannelCenter(u));
        const wallT = smoothstep01((y - gullyFloor(u) - 1.2) / 4.5);
        const inChannel = 1 - smoothstep01((away - gullyChannelHalf(u)) / 8);
        const stain =
          smoothstep01(
            (fbm(x * 0.06, z * 0.06, { seed: SEED ^ 0x5a06, period: 9, octaves: 3 }) - 0.48) /
              0.22,
          ) *
          (0.4 + 0.6 * inChannel);
        // The flutes on the walls: violet grooves the terrain also rides.
        const groove = Math.max(0, -Math.sin(v * 1.05 + u * 0.06)) * wallT;
        const honeyR = 0.88 + stain * 0.28 + wallT * 0.18 - groove * 0.3;
        const honeyG = 0.74 + stain * 0.18 + wallT * 0.16 - groove * 0.3;
        const honeyB = 0.5 - stain * 0.1 + wallT * 0.1 + groove * 0.28;
        r += (honeyR - r) * inGully;
        g += (honeyG - g) * inGully;
        b += (honeyB - b) * inGully;
        value += (stain * 0.08 + wallT * 0.06 - groove * 0.1) * inGully;
      }
    }

    // The Windows ridge: lit face rising to a bright crest, violet foot.
    const ridge = windowsRidge(u, v);
    if (ridge.w > 0.02) {
      const height = smoothstep01((y - COURT_FLOOR - 2) / 9);
      r += (1.06 - r) * ridge.w * height * 0.7;
      g += (0.94 - g) * ridge.w * height * 0.7;
      b += (0.52 - b) * ridge.w * height * 0.6;
      value += ridge.w * (height * 0.16 - (1 - height) * 0.1);
    }

    // The Ribbon: the rim lip is the region's brightest drawn line;
    // inside, the walls fall to violet with amber light-well runnels.
    const ribbon = ribbonCarve(u, v);
    const rd = ribbonDistance(u, v);
    if (rd.d < 16) {
      const lipLine =
        smoothstep01((rd.d - 7.5) / 1.5) * (1 - smoothstep01((rd.d - 12) / 3)) * ribbon.lip * 1.25;
      value += lipLine * 0.18;
      b -= lipLine * 0.08;
      if (ribbon.wall > 0) {
        const depthT = smoothstep01((COURT_FLOOR - y) / (COURT_FLOOR - RIBBON_FLOOR));
        const runnel = smoothstep01(
          (fbm(rd.t * 9, y * 0.1, { seed: SEED ^ 0x5a07, period: 4, octaves: 2 }) - 0.56) / 0.16,
        );
        const tr = 1.0 - depthT * 0.52 + runnel * 0.34;
        const tg = 0.86 - depthT * 0.5 + runnel * 0.22;
        const tb = 0.54 + depthT * 0.42 - runnel * 0.1;
        r += (tr - r) * ribbon.wall;
        g += (tg - g) * ribbon.wall;
        b += (tb - b) * ribbon.wall;
        value += ribbon.wall * (runnel * 0.12 - depthT * 0.16);
      }
    }

    // The Seep Terraces: travertine-pale bench risers, green seep
    // stains running off the pools, pale water floors in the dishes.
    const seeps = seepsWeight(u, v);
    if (seeps > 0) {
      const bench = seepBenches(u, v);
      const dish = seepPoolDish(u, v);
      let stain = 0;
      for (const pool of SEEP_POOLS) {
        const d = Math.hypot(u - pool.u, v - pool.v);
        // The stain plumes downhill (toward smaller v) from each pool.
        const downhill = smoothstep01((pool.v - v + 2) / 10);
        stain = Math.max(stain, (1 - smoothstep01((d - pool.radius) / 14)) * downhill);
      }
      stain *=
        0.5 +
        0.5 *
          smoothstep01(
            (fbm(x * 0.045, z * 0.045, { seed: SEED ^ G2_SEEDS.paintSeep, period: 10, octaves: 2 }) -
              0.42) /
              0.3,
          );
      const riser = bench.riser;
      r += (0.72 - stain * 0.14 + riser * 0.36 - r) * seeps;
      g += (0.92 - stain * 0.02 + riser * 0.3 - g) * seeps;
      b += (0.48 + stain * 0.06 + riser * 0.3 - b) * seeps;
      value += seeps * (riser * 0.14 - stain * 0.04);
      if (dish > 0.06) {
        // The pool floors: pale mineral green, the water's own light.
        const pool = smoothstep01((dish - 0.06) / 0.3);
        r += (0.86 - r) * pool * seeps;
        g += (1.06 - g) * pool * seeps;
        b += (0.78 - b) * pool * seeps;
        value += pool * seeps * 0.12;
      }
    }

    // The Carillon's Pavement: swept concentric rings — the registered
    // rest painted as composed bareness, bright and deliberate.
    const carillon = carillonWeight(u, v);
    if (carillon > 0) {
      const d = Math.hypot(u - CARILLON.u, v - CARILLON.v);
      const ring = Math.sin((d / 9) * Math.PI * 2);
      const wave = smoothstep01((ring - 0.2) / 0.5);
      const swept = 1 - smoothstep01((d - PAVEMENT_REST.radius) / 10);
      r += (1.08 - r) * carillon * 0.6;
      g += (0.99 - g) * carillon * 0.6;
      b += (0.62 - b) * carillon * 0.5;
      value += carillon * (wave - 0.5) * 0.11 + swept * 0.09;
    }

    // The Sunset Shelf: milky-warm — the distance rule written into
    // the ground, the same decrescendo the Gilded Shore played.
    const shelf = shelfWeight(u);
    if (shelf > 0) {
      r += (1.05 - r) * shelf * 0.7;
      g += (0.99 - g) * shelf * 0.7;
      b += (0.85 - b) * shelf * 0.7;
      value += shelf * 0.08;
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
    colors[i * 3] = Math.max(0.25, Math.min(1.3, r * total));
    colors[i * 3 + 1] = Math.max(0.25, Math.min(1.3, g * total));
    colors[i * 3 + 2] = Math.max(0.25, Math.min(1.3, b * total));
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** Builds the five painted ground sheets. */
export function buildGolden2Ground(contacts: readonly ContactPatch[]): Mesh[] {
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
    bakeCarillonPaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "carillon-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The pass sheet: the Shore Road and the gully's head, back over the
  // Hourglass Sea's rim — overlapping its tiles (they reach spoke
  // u ≈ 685) and ours (near edge u ≈ 709), sunk 4 cm.
  const passMid = worldOf(674, 0);
  const passGeometry = createSeabedGeometryAt(passMid.x, passMid.z, 100, PASS_SEGMENTS, -0.04);
  trimSheet(passGeometry, (x, z) => {
    const { u, v } = spokeOf(x, z);
    return u >= 640 && u <= 714 && Math.abs(v) <= passHalfWidth(u) + 12;
  });
  bakeCarillonPaint(passGeometry, contacts);
  const pass = new Mesh(passGeometry, material);
  pass.name = "carillon-ground-pass";
  pass.receiveShadow = true;
  meshes.push(pass);

  return meshes;
}
