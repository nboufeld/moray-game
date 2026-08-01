import { BufferAttribute, Mesh, type PlaneGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, type ContactPatch } from "../../Seabed";
import { AMBER, EMBER, LAMP, smoothstep01 } from "./Smoking3Shared";
import {
  CENTER_X,
  CENTER_Z,
  DESCENT_TO,
  POOLS,
  VENT,
  benchFootU,
  channelCenter,
  channelHalf,
  cradleWeight,
  descentDrop,
  fensWeight,
  passHalfWidth,
  spokeOf,
  veilWeight,
  wickCenter,
  wickHalf,
  wickWeight,
  worldOf,
} from "./Smoking3Terrain";

/**
 * The Lantern Vigil's ground: five sheets and their authored paint.
 *
 * ## The tiling
 *
 * Four disc tiles span the country (231 m each, ~2.2 m per vertex); the
 * threshold sheet carries the pass. The Forge Combs' own ground reaches
 * rc 240 of THEIR centre — u ≈ 1180 on this spoke — so the threshold
 * sheet runs u 1138 → 1232: overlapping their Glass Shore under the
 * Night Door (sunk 4 cm, the pilot's seam fix) and reaching three
 * metres into our own tiles at u 1229.
 *
 * ## The paint
 *
 * The sand wash carries the marks; the vertex colours carry the
 * *place*. The value key runs on the province's night: the plain is the
 * darkest resting gravel in the Marches, amber pooled in its mottle
 * harder than anywhere; the Last Wick is one bright seam thread in a
 * charcoal band; the Ember Fens' bowls glow at the rims; the Ash Veil's
 * drifts go milk-pale (the milk-bright register carried by ash); the
 * Cradle's garden floor is the one warm living green-amber; and the
 * Vent's forecourt gathers radiating seams — the fire arriving at the
 * foot of its own door.
 */

const SEED = SEEDS.regionSmoking3;

/** Ground kept out to here from the disc's centre (the curtains stand inside). */
const DISC_GROUND_R = 240;

const DISC_TILE = 231;
const DISC_SEGMENTS = 104;
const SADDLE_SEGMENTS = 64;

/** The threshold sheet's reach along the spoke. */
const SADDLE_FROM = 1138;
const SADDLE_TO = 1232;

function keepDisc(x: number, z: number): boolean {
  return Math.hypot(x - CENTER_X, z - CENTER_Z) <= DISC_GROUND_R;
}

function keepSaddle(x: number, z: number): boolean {
  const { u, v } = spokeOf(x, z);
  return u >= SADDLE_FROM && u <= SADDLE_TO && Math.abs(v) <= passHalfWidth(Math.max(u, 1146)) + 14;
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

/** Gravel-drift mottle: paler laid ribbons through the night floor. */
function drift(x: number, z: number): number {
  return fbm(x * 0.016, z * 0.016, { seed: SEED ^ 0x6e01, period: 7, octaves: 3 });
}

/** Cinder mottle: the darker, sharper scatter under the drifts. */
function cinder(x: number, z: number): number {
  return fbm(x * 0.047, z * 0.047, { seed: SEED ^ 0x6e02, period: 11, octaves: 2 });
}

/** The wick's seam thread: ONE bright line wandering the road's floor. */
export function wickVein(u: number, v: number): number {
  const off = (v - wickCenter(u)) / Math.max(1, wickHalf(u));
  const thread =
    1 -
    smoothstep01(
      (Math.abs(
        off - (fbm(u * 0.05, 0.5, { seed: SEED ^ 0x6e03, period: 6, octaves: 2 }) - 0.5) * 0.9,
      ) -
        0.1) /
        0.22,
    );
  const sparks = smoothstep01(
    (fbm(u * 0.16, off * 2.2, { seed: SEED ^ 0x6e04, period: 9, octaves: 2 }) - 0.62) / 0.12,
  );
  return Math.min(1, thread + sparks * 0.6) * (1 - smoothstep01((Math.abs(off) - 0.9) / 0.4));
}

/** The Vent forecourt's gathering seams: rays running to the door. */
export function ventVein(u: number, v: number): number {
  const d = Math.hypot(u - VENT.u, v - VENT.v);
  const theta = Math.atan2(v - VENT.v, u - VENT.u);
  const ray = smoothstep01(
    (fbm(theta * 2.6, d * 0.05, { seed: SEED ^ 0x6e05, period: 5, octaves: 2 }) - 0.6) / 0.12,
  );
  return ray * (1 - smoothstep01((d - 7) / 26));
}

/**
 * The region's ground paint. Value first, then temperature; every tint
 * multiplies the sand wash, so 1 is "the bowl's own sand" and the
 * biomes pull it toward their own key.
 */
function bakeVigilPaint(geometry: PlaneGeometry, contacts: readonly ContactPatch[]): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const { u, v } = spokeOf(x, z);

    // Value structure from the ground's own relief.
    const life = fbm(x * 0.027, z * 0.027, { seed: SEED ^ 0x3c07, period: 9, octaves: 2 }) - 0.5;
    let value = 0.9 + life * 0.4;

    // The night plain: the darkest resting gravel in the province —
    // pale drift ribbons over hard cinder darks, violet held in both.
    // R2: a step darker still, and the drifts quieter — the r1 plain
    // read as pastel day; the night is the register the lanterns need.
    const drifts = smoothstep01((drift(x, z) - 0.46) / 0.24);
    const cinders = smoothstep01((cinder(x, z) - 0.56) / 0.2);
    let r = 0.45 + drifts * 0.12 - cinders * 0.2;
    let g = 0.39 + drifts * 0.11 - cinders * 0.22;
    let b = 0.63 + drifts * 0.07 - cinders * 0.11;

    // Amber pooled in the mottle — the province's signature: POOLS of
    // held heat, not fields of it (R2: the r1 gain washed whole dunes
    // orange), and none in the Ash Veil — the ash owns its own pale.
    const veil = veilWeight(u, v);
    const amberPool =
      smoothstep01(
        (fbm(x * 0.021, z * 0.021, { seed: SEED ^ 0x6e07, period: 6, octaves: 2 }) - 0.6) / 0.09,
      ) *
      (1 - veil);
    r += amberPool * AMBER.r * 0.36;
    g += amberPool * AMBER.g * 0.2;
    b -= amberPool * 0.05;

    // The Night Threshold: dark glass shelf agreeing with the Combs'
    // Glass Shore where the sheets overlap, grading to cinder down the
    // Nightfall Stair, each riser seamed with the wick's first embers.
    if (u < DESCENT_TO + 30) {
      const glass = 1 - smoothstep01((u - 1196) / 46);
      const sheen = smoothstep01(
        (fbm(x * 0.06, z * 0.06, { seed: SEED ^ 0x6e06, period: 8, octaves: 2 }) - 0.64) / 0.1,
      );
      r += ((0.3 + sheen * 0.56) - r) * glass * 0.9;
      g += ((0.27 + sheen * 0.54) - g) * glass * 0.9;
      b += ((0.46 + sheen * 0.62) - b) * glass * 0.9;
      value += glass * (sheen * 0.18 - 0.12);

      const inWay = 1 - smoothstep01((Math.abs(v - channelCenter(u)) - channelHalf(u)) / 8);
      const stairBand =
        smoothstep01((u - 1240) / 22) * (1 - smoothstep01((u - (DESCENT_TO + 26)) / 18));
      const { riser } = descentDrop(u);
      const s = stairBand * inWay;
      r += (0.38 - r) * s * 0.8;
      g += (0.31 - g) * s * 0.8;
      b += (0.5 - b) * s * 0.8;
      const seam =
        riser *
        smoothstep01(
          (fbm(x * 0.09, z * 0.09, { seed: SEED ^ 0x6e08, period: 9, octaves: 2 }) - 0.38) / 0.18,
        );
      r += seam * EMBER.r * 0.95 * s;
      g += seam * EMBER.g * 0.62 * s;
      b += seam * EMBER.b * 0.22 * s;
      value += (seam * 0.2 - riser * 0.08) * s;
    }

    // The Last Wick: a charcoal band carrying ONE bright seam thread —
    // the road home, drawn in held heat.
    const wick = wickWeight(u, v);
    if (wick > 0) {
      const vein = wickVein(u, v);
      const charR = 0.32 + vein * (AMBER.r * 1.05 + EMBER.r * 0.45);
      const charG = 0.26 + vein * (AMBER.g * 0.7);
      const charB = 0.44 - vein * 0.15;
      r += (charR - r) * wick;
      g += (charG - g) * wick;
      b += (charB - b) * wick;
      value += wick * (vein * 0.34 - 0.13);
    }

    // The wick's lips: a pale mineral hem so the seam reads from afar.
    if (u > 1305 && u < 1630) {
      const wickD = Math.abs(v - wickCenter(u));
      const hem =
        smoothstep01((wickD - wickHalf(u) * 0.85) / 2) *
        (1 - smoothstep01((wickD - wickHalf(u) * 1.6) / 3.5));
      r += hem * 0.18;
      g += hem * 0.15;
      b += hem * 0.09;
      value += hem * 0.05;
    }

    // The Ember Fens: the warm dark, mottle amber doubled over a
    // deeper resting floor so the pools read as held coals.
    const fens = fensWeight(u, v);
    if (fens > 0) {
      const pool2 = smoothstep01(
        (fbm(x * 0.03, z * 0.03, { seed: SEED ^ 0x6e09, period: 7, octaves: 2 }) - 0.52) / 0.13,
      );
      r += ((0.38 + pool2 * (AMBER.r * 0.72)) - r) * fens;
      g += ((0.29 + pool2 * (AMBER.g * 0.44)) - g) * fens;
      b += ((0.5 - pool2 * 0.1) - b) * fens;
      value += fens * (pool2 * 0.18 - 0.12);
    }

    // The amber pools: warm hearts, vein-bright rims.
    for (const pool of POOLS) {
      const d = Math.hypot(u - pool.u, v - pool.v);
      if (d < pool.radius * 2) {
        const heart = 1 - smoothstep01((d - pool.radius * 0.4) / (pool.radius * 0.5));
        const rim =
          smoothstep01((d - pool.radius * 0.7) / (pool.radius * 0.3)) *
          (1 - smoothstep01((d - pool.radius * 1.3) / (pool.radius * 0.5)));
        if (pool.cradle) {
          // The Cradle's springs: warm milk — the garden's own light.
          r += heart * 0.5 + rim * 0.2;
          g += heart * 0.44 + rim * 0.16;
          b += heart * 0.3 + rim * 0.08;
          value += heart * 0.18;
        } else {
          r += heart * (AMBER.r * 0.8 + EMBER.r * 0.3) + rim * LAMP.r * 0.3;
          g += heart * (AMBER.g * 0.5) + rim * LAMP.g * 0.2;
          b += heart * -0.1 + rim * 0.02;
          value += heart * 0.22 + rim * 0.06;
        }
      }
    }

    // The Ash Veil: milk-pale drifts — the fall's settle, brightest on
    // the drift crowns (read from the same boss field the terrain drew).
    // R2: milkier — the r1 veil read as tan dune, not settled ash.
    if (veil > 0) {
      const boss = Math.max(
        0,
        fbm(x * 0.041, z * 0.041, { seed: SEED ^ 0x3c05, period: 11, octaves: 2 }) - 0.36,
      );
      const crown = smoothstep01((boss - 0.2) / 0.16);
      const flank = smoothstep01((boss - 0.05) / 0.12) * (1 - crown);
      r += ((0.8 + flank * 0.12 + crown * 0.38) - r) * veil;
      g += ((0.76 + flank * 0.11 + crown * 0.36) - g) * veil;
      b += ((0.78 + flank * 0.05 + crown * 0.28) - b) * veil;
      value += veil * (crown * 0.2 + flank * 0.06);
    }

    // The Cradle: the garden floor — the one warm living green-amber in
    // the province's night, the fire's tended ground (R2: greener and
    // deeper; r1 read tan).
    const cradle = cradleWeight(u, v);
    if (cradle > 0) {
      const moss = smoothstep01(
        (fbm(x * 0.035, z * 0.035, { seed: SEED ^ 0x6e0a, period: 8, octaves: 2 }) - 0.42) / 0.18,
      );
      r += ((0.44 + moss * 0.26) - r) * cradle;
      g += ((0.48 + moss * 0.32) - g) * cradle;
      b += ((0.38 + moss * 0.06) - b) * cradle;
      value += cradle * (moss * 0.1 - 0.05);
    }

    // The Vent's forecourt: gathering seams and a worked warm halo.
    const ventD = Math.hypot(u - VENT.u, v - VENT.v);
    if (ventD < 34) {
      const vein = ventVein(u, v);
      const halo = 1 - smoothstep01((ventD - 8) / 22);
      r += halo * 0.12 + vein * (AMBER.r * 0.9 + EMBER.r * 0.35);
      g += halo * 0.07 + vein * (AMBER.g * 0.6);
      b -= vein * 0.14;
      value += halo * 0.05 + vein * 0.22;
    }

    // Contact shade under everything that stands on the night floor.
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
    colors[i * 3] = Math.max(0.24, Math.min(1.3, r * total));
    colors[i * 3 + 1] = Math.max(0.24, Math.min(1.3, g * total));
    colors[i * 3 + 2] = Math.max(0.24, Math.min(1.3, b * total));
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** Builds the five painted ground sheets. */
export function buildSmoking3Ground(contacts: readonly ContactPatch[]): Mesh[] {
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
    trimSheet(geometry, keepDisc);
    bakeVigilPaint(geometry, contacts);
    const mesh = new Mesh(geometry, material);
    mesh.name = "vigil-ground-disc";
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  // The threshold sheet: over the crest between the Combs' ground
  // (their sheets reach u ≈ 1180) and our tiles (their near corner cuts
  // u ≈ 1229 on the spine) — overlap on both sides, sunk 4 cm.
  const saddleAt = worldOf((SADDLE_FROM + SADDLE_TO) / 2, 0);
  const saddleGeometry = createSeabedGeometryAt(
    saddleAt.x,
    saddleAt.z,
    SADDLE_TO - SADDLE_FROM + 46,
    SADDLE_SEGMENTS,
    -0.04,
  );
  trimSheet(saddleGeometry, keepSaddle);
  bakeVigilPaint(saddleGeometry, contacts);
  const saddle = new Mesh(saddleGeometry, material);
  saddle.name = "vigil-ground-threshold";
  saddle.receiveShadow = true;
  meshes.push(saddle);

  return meshes;
}

/** Exported for the tests: the reveal-cadence bench feet, world space. */
export function benchFeet(): { x: number; z: number }[] {
  return [0, 1, 2, 3, 4].map((i) => {
    const u = benchFootU(i);
    return worldOf(u, channelCenter(u));
  });
}
