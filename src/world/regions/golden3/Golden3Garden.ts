import {
  BufferAttribute,
  Color,
  Group,
  LatheGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Mesh,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { buildGlowColony } from "../kit/GlowColony";
import { buildParticulateField, type ParticulateFieldBuild } from "../kit/ParticulateField";
import { CLOSE_LENSES, roadDistance } from "./Golden3Beats";
import {
  G3_SEEDS,
  SHADOW_VIOLET,
  STONE_AMBER,
  STONE_BRIGHT,
  applyVeinGlow,
  mergedMesh,
  smoothstep01,
} from "./Golden3Shared";
import { GARDEN, GARDEN_SPRING, gardenWeight, worldOf } from "./Golden3Terrain";

/**
 * THE AFTERGLOW GARDEN — the region's first exclusive: the desert's
 * last life, gathered where a warm spring breathes at the basin's edge,
 * lighting its own lamps as the day ends. Salt-candle pinnacles —
 * slender wind-carved stones with bright mineral crowns — stand in
 * ranked clusters, and the vein-glow material makes each painted crown
 * a candle flame: below, the bodies keep the evening's amber; above,
 * the crests carry the last light after the sun has left the floor.
 * Glow-bud colonies lamp the candle feet, and the spring's bubble
 * column keeps the garden's quiet time.
 *
 * All candles merge into ONE lit draw; the paint carries the drawing
 * (the golden-2 tower lessons pre-paid: resampled rows for the paint to
 * live on, vein-glow so the dusk lift never irons the drawing off the
 * shade side).
 */

const SEED = SEEDS.regionGolden3;

export interface Candle {
  readonly u: number;
  readonly v: number;
  readonly height: number;
  readonly radius: number;
}

/**
 * The candle field, drawn once at module load from its own substream —
 * pure and deterministic so cover gates, paint and tests agree on every
 * stand.
 */
function drawCandles(): Candle[] {
  const random = new Random(SEED ^ G3_SEEDS.candles);
  const field: Candle[] = [];
  let guard = 0;
  while (field.length < 30 && guard++ < 4000) {
    const angle = random.range(0, Math.PI * 2);
    const r = Math.sqrt(random.next()) * GARDEN.radius * 0.92;
    const u = GARDEN.u + Math.cos(angle) * r;
    const v = GARDEN.v + Math.sin(angle) * r * 0.86;
    if (Math.hypot(u - GARDEN_SPRING.u, v - GARDEN_SPRING.v) < GARDEN_SPRING.radius + 2.5) {
      continue;
    }
    if (roadDistance(u, v) < 6) {
      continue;
    }
    if (CLOSE_LENSES.some((lens) => Math.hypot(u - lens.u, v - lens.v) < 6)) {
      continue;
    }
    if (field.some((c) => Math.hypot(c.u - u, c.v - v) < 6.5)) {
      continue;
    }
    field.push({
      u,
      v,
      height: random.range(3.2, 7.4),
      radius: random.range(0.5, 0.9),
    });
  }
  // Three authored tapers: the tall Evensong candle over the spring,
  // and the gate pair where the road brushes the garden (appended
  // AFTER the seeded field, so nothing re-rolls).
  field.push(
    { u: 1534, v: 50, height: 9.2, radius: 1.05 },
    { u: 1502, v: 26, height: 6.4, radius: 0.85 },
    { u: 1510, v: 18, height: 4.6, radius: 0.7 },
  );
  return field;
}

export const CANDLES: readonly Candle[] = drawCandles();

/** The candle profile: a slender taper with a bulbed mineral crown. */
function candleProfile(candle: Candle, random: Random): Vector2[] {
  const r = candle.radius;
  const h = candle.height;
  return [
    new Vector2(r * 1.35, -0.5),
    new Vector2(r * 1.1, h * 0.08),
    new Vector2(r * 0.85, h * 0.3),
    new Vector2(r * random.range(0.6, 0.72), h * 0.62),
    new Vector2(r * 0.66, h * 0.82),
    new Vector2(r * random.range(0.72, 0.85), h * 0.9), // the crown bulb
    new Vector2(r * 0.45, h * 0.975),
    new Vector2(0.01, h),
  ];
}

/** Resample to ~0.5 m rows so the paint has rows to live on (the
 *  golden-2 round-4 lesson, pre-paid). */
function resampleProfile(points: Vector2[], step: number): Vector2[] {
  const out: Vector2[] = [points[0]!.clone()];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const rows = Math.max(1, Math.round(a.distanceTo(b) / step));
    for (let r = 1; r <= rows; r++) {
      out.push(a.clone().lerp(b, r / rows));
    }
  }
  return out;
}

const CROWN_LIGHT = new Color(0xffe9b0);

/** Grooves + drawn paint: amber body, violet grooves, burning crown. */
function paintCandle(geometry: BufferGeometry, candle: Candle, seed: number): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radius = Math.hypot(x, z);
    const theta = Math.atan2(z, x);
    const t = Math.min(1, Math.max(0, y / candle.height));
    const groove = Math.sin(theta * 7 + t * 1.4);
    const band = smoothstep01((t - 0.08) / 0.14) * (1 - smoothstep01((t - 0.78) / 0.16));
    const flute = 1 + groove * 0.11 * band;
    if (radius > 0.02) {
      position.setX(i, x * flute);
      position.setZ(i, z * flute);
    }
    const strata = fbm(t * 5, theta * 0.7, { seed: seed ^ 0x17, period: 5, octaves: 2 }) - 0.5;
    const grain = fbm(theta * 2.4, y * 0.9, { seed: seed ^ 0x2b, period: 7, octaves: 2 }) - 0.5;
    // The crown: the candle's flame — the only part the vein-glow
    // emissive lets burn, rising through the bulb to the tip.
    const crown = smoothstep01((t - 0.8) / 0.14);
    shade
      .copy(STONE_AMBER)
      .lerp(STONE_BRIGHT, 0.24 + smoothstep01((t - 0.3) / 0.6) * 0.5)
      .lerp(SHADOW_VIOLET, Math.max(0, -groove) * 0.32 * band + Math.max(0, -strata) * 0.22)
      .multiplyScalar(1.04 + strata * 0.26 + grain * 0.2)
      .lerp(CROWN_LIGHT, crown);
    // The foot stands in its own contact dusk.
    shade.lerp(SHADOW_VIOLET, (1 - smoothstep01((t - 0.02) / 0.1)) * 0.24);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  position.needsUpdate = true;
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

export interface GardenBuild {
  readonly groups: Group[];
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  update(timeSec: number): void;
}

export function buildGarden(): GardenBuild {
  const random = new Random(SEED ^ G3_SEEDS.candlePaint);
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const parts: BufferGeometry[] = [];
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  for (const [i, candle] of CANDLES.entries()) {
    const geometry = new LatheGeometry(resampleProfile(candleProfile(candle, random), 0.5), 18);
    paintCandle(geometry, candle, SEED ^ (0x65d0 + i));
    const { x, z } = worldOf(candle.u, candle.v);
    const y = seabedHeight(x, z);
    geometry.rotateY(random.range(0, Math.PI * 2));
    geometry.translate(x, y, z);
    parts.push(geometry);
    contacts.push({ x, z, radius: candle.radius * 1.8, strength: 0.4 });
    colliders.push({
      center: new Vector3(x, y + candle.height * 0.35, z),
      radius: Math.max(0.8, candle.radius * 1.1),
    });
    colliders.push({
      center: new Vector3(x, y + candle.height * 0.8, z),
      radius: Math.max(0.7, candle.radius * 0.9),
    });
  }

  // The candle draw: dusk-lift emissive UNDER the paint's control (the
  // vein glow), so the crowns burn and the grooves stay dusk.
  const material = createToonMaterial({
    color: 0xe2c896,
    vertexColors: true,
    emissive: 0x8a6034,
    emissiveIntensity: 0.62,
  });
  applyVeinGlow(material, "golden3-candle-glow");
  const mesh = mergedMesh(parts, material, "vesper-candles");

  // The lamps at the feet: warm glow-bud colonies on a third of the
  // candles (never the road's own verge — the buds mark the garden's
  // inner walks).
  const glowRandom = new Random(SEED ^ G3_SEEDS.candleGlow);
  const anchors: (readonly [number, number, number])[] = [];
  for (let i = 0; i < CANDLES.length; i += 3) {
    const candle = CANDLES[i]!;
    const angle = glowRandom.range(0, Math.PI * 2);
    const { x, z } = worldOf(
      candle.u + Math.cos(angle) * (candle.radius + 0.9),
      candle.v + Math.sin(angle) * (candle.radius + 0.9),
    );
    anchors.push([x, seabedHeight(x, z) + 0.12, z] as const);
  }
  const lamps = buildGlowColony({
    seed: SEED ^ G3_SEEDS.candleGlow,
    tint: 0xffc06a,
    anchors,
    budsPerAnchor: 5,
    glow: 0.34,
  });
  groups.push(lamps.group);

  // The spring's breath: one bubble column, the garden's metronome.
  const springAt = worldOf(GARDEN_SPRING.u, GARDEN_SPRING.v);
  const springFloor = seabedHeight(springAt.x, springAt.z);
  const spring: ParticulateFieldBuild = buildParticulateField({
    seed: SEED ^ G3_SEEDS.gardenSpring,
    tint: 0xdef0e6,
    count: 34,
    mode: "column",
    volume: {
      center: [springAt.x, springFloor + 3.2, springAt.z],
      size: [GARDEN_SPRING.radius * 0.9, 6, GARDEN_SPRING.radius * 0.9],
    },
    size: 0.2,
    opacity: 0.45,
  });
  groups.push(spring.group);
  updaters.push((t) => spring.update(t));

  return {
    groups,
    meshes: [mesh],
    colliders,
    contacts,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}

/** Spoke-space test the cover gates share: candle footprints. */
export function candleFree(u: number, v: number): number {
  let free = 1;
  for (const candle of CANDLES) {
    free = Math.min(
      free,
      smoothstep01((Math.hypot(u - candle.u, v - candle.v) - candle.radius * 1.5) / 1.1),
    );
  }
  return free;
}

/** Re-exported for life anchors: where the garden's heart is. */
export { GARDEN, GARDEN_SPRING, gardenWeight };
