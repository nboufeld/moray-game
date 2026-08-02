import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  Points,
  PointsMaterial,
  Sphere,
  Vector3,
  type DataTexture,
} from "three";
import { buildScalarTexture } from "../../../rendering/ProceduralTexture";
import { Random } from "../../../util/Random";
import type { KitBuild } from "./KitTypes";

/**
 * `particulateField` (KIT-SPEC §3.4) — one additive `Points` system for
 * every drifting-speck job in the fill program: dust blooms rising in a
 * column, marine snow falling, seeds / ash / pollen / gold motes on the
 * drift, and anchored vent- or ghost-shrimp sparkle swarms.
 *
 * The idioms carried in from the bowl (`Particles`) and the regions'
 * mote fields, as law rather than habit:
 * - **radial sprite mandatory** — a bare point rasterises as a square;
 * - **per-point twinkle in the colour attribute** — one multiply per
 *   mote, no shader patch, and a floor well above zero so nothing pops;
 * - **closed-form motion off simulated time** — `update(timeSec)` is a
 *   pure function, so any dt path lands on the same buffer;
 * - **cycling modes fade in AND out** (the Bubbles lesson): a recycled
 *   speck is born dark and dies dark, never switched on mid-water.
 *
 * Budget note: 1 draw, 0 triangles; the cost is `count` point sprites
 * of overdraw. Reference shapes: drift 200–600, column 60–160, fall
 * 150–400, swarm 20–80. Opacity is clamped to the spec's 0.6 cap.
 * Bounds are honest: motion wraps inside `volume`, so the geometry
 * carries an authored sphere over the volume plus sway margin and the
 * points keep frustum culling.
 */

export type ParticulateMode = "drift" | "column" | "fall" | "swarm";

export interface ParticulateVolume {
  readonly center: readonly [number, number, number];
  readonly size: readonly [number, number, number];
}

export interface ParticulateFieldOptions {
  readonly seed: number;
  /** sRGB hex — the region's spark colour; value carries the twinkle. */
  readonly tint: number;
  readonly count: number;
  readonly mode: ParticulateMode;
  readonly volume: ParticulateVolume;
  /** Sprite diameter in metres; defaults per mode. */
  readonly size?: number;
  /** Material opacity, clamped to the spec cap of 0.6. */
  readonly opacity?: number;
  /** A slow whole-field current; positions wrap inside the volume. */
  readonly bias?: { readonly dir: readonly [number, number, number]; readonly speed: number };
}

export interface ParticulateFieldBuild extends KitBuild {
  update(timeSec: number): void;
}

const OPACITY_CAP = 0.6;

/** Twinkle floor/rates: the Particles constants — a mote never goes out. */
const TWINKLE_FLOOR = 0.45;
const TWINKLE_RATE_MIN = 0.5;
const TWINKLE_RATE_MAX = 1.4;

/** Cycling modes ramp their brightness in and out over these phase spans. */
const BIRTH_SPAN = 0.12;
const FADE_SPAN = 0.18;

/** Sprite diameter per mode, metres, when the caller does not say. */
const DEFAULT_SIZE: Readonly<Record<ParticulateMode, number>> = {
  drift: 0.09,
  column: 0.11,
  fall: 0.08,
  swarm: 0.07,
};

/** Largest lateral excursion any mode's sway can add, for the bounds. */
const SWAY_MARGIN = 1.9;

let spriteTexture: DataTexture | undefined;

/** The shared soft round mote — module-owned, never disposed by a build. */
function radialSprite(): DataTexture {
  spriteTexture ??= buildScalarTexture(32, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    return Math.pow(Math.max(0, 1 - distance), 1.8);
  });
  return spriteTexture;
}

function euclidMod(value: number, span: number): number {
  return ((value % span) + span) % span;
}

export function buildParticulateField(options: ParticulateFieldOptions): ParticulateFieldBuild {
  const random = new Random(options.seed);
  const { count, mode } = options;
  const [cx, cy, cz] = options.volume.center;
  const [sx, sy, sz] = options.volume.size;
  const minX = cx - sx / 2;
  const minY = cy - sy / 2;
  const minZ = cz - sz / 2;

  // Base stations, then the per-point motion parameters, drawn in two
  // passes so a count retune never re-rolls the field it rides on.
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    base[i * 3] = minX + random.next() * sx;
    base[i * 3 + 1] = minY + random.next() * sy;
    base[i * 3 + 2] = minZ + random.next() * sz;
  }
  const phases = new Float32Array(count);
  const rates = new Float32Array(count);
  const twinkleRates = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    phases[i] = random.range(0, Math.PI * 2);
    // Cycle rate for column/fall (fraction of the volume height per
    // second) and sway individuality for drift/swarm.
    rates[i] = random.range(0.75, 1.35);
    twinkleRates[i] = random.range(TWINKLE_RATE_MIN, TWINKLE_RATE_MAX);
  }

  const live = new Float32Array(count * 3);
  const shade = new Float32Array(count * 3);
  const geometry = new BufferGeometry();
  const positionAttribute = new BufferAttribute(live, 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  const colorAttribute = new BufferAttribute(shade, 3);
  colorAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("color", colorAttribute);

  // Honest bounds without per-frame recompute: every closed form below
  // wraps inside the volume, so the sphere is authored over it once and
  // the points keep frustum culling (law 4's preferred half).
  geometry.boundingSphere = new Sphere(
    new Vector3(cx, cy, cz),
    Math.hypot(sx / 2, sy / 2, sz / 2) + SWAY_MARGIN,
  );

  const material = new PointsMaterial({
    color: new Color(options.tint),
    size: options.size ?? DEFAULT_SIZE[mode],
    map: radialSprite(),
    transparent: true,
    opacity: Math.min(options.opacity ?? 0.55, OPACITY_CAP),
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    // Multiplies the tint, and carries the twinkle plus the cycle fades.
    vertexColors: true,
  });

  const points = new Points(geometry, material);
  points.name = `kit-particulate-${mode}`;
  points.renderOrder = 3;

  const biasX = (options.bias?.dir[0] ?? 0) * (options.bias?.speed ?? 0);
  const biasY = (options.bias?.dir[1] ?? 0) * (options.bias?.speed ?? 0);
  const biasZ = (options.bias?.dir[2] ?? 0) * (options.bias?.speed ?? 0);

  const update = (timeSec: number): void => {
    const t = timeSec;
    for (let i = 0; i < count; i++) {
      const p = phases[i]!;
      const rate = rates[i]!;
      const bx = base[i * 3]!;
      const by = base[i * 3 + 1]!;
      const bz = base[i * 3 + 2]!;

      let x = bx;
      let y = by;
      let z = bz;
      // The cycle ramp: 1 through the middle of a column/fall pass, easing
      // from and to zero at the wrap so a recycled speck never pops.
      let cycleFade = 1;

      switch (mode) {
        case "drift": {
          x = minX + euclidMod(bx - minX + biasX * t + Math.sin(t * 0.11 + p) * 1.6, sx);
          y = minY + euclidMod(by - minY + biasY * t + Math.sin(t * 0.07 + p * 1.7) * 0.9, sy);
          z = minZ + euclidMod(bz - minZ + biasZ * t + Math.cos(t * 0.09 + p) * 1.6, sz);
          break;
        }
        case "column": {
          // Heat rises: each speck climbs the volume on its own beat and
          // re-seeds at the foot, widening a little as it goes.
          const cycle = euclidMod(p / (Math.PI * 2) + (t * 0.045 * rate), 1);
          const widen = 0.6 + cycle * 1.3;
          x = bx + Math.sin(t * 0.24 + p * 37) * widen * 0.55;
          y = minY + cycle * sy;
          z = bz + Math.cos(t * 0.21 + p * 53) * widen * 0.55;
          cycleFade =
            Math.min(1, cycle / BIRTH_SPAN) * Math.min(1, (1 - cycle) / FADE_SPAN);
          break;
        }
        case "fall": {
          // Marine snow: a slow sink with a pendulum sway, recycled at the
          // volume floor.
          const cycle = euclidMod(p / (Math.PI * 2) + (t * 0.03 * rate), 1);
          x = bx + Math.sin(t * 0.4 + p) * 0.5 + Math.sin(t * 0.13 + p * 2.3) * 0.7;
          y = minY + (1 - cycle) * sy;
          z = bz + Math.cos(t * 0.34 + p * 1.4) * 0.5;
          cycleFade =
            Math.min(1, cycle / BIRTH_SPAN) * Math.min(1, (1 - cycle) / FADE_SPAN);
          break;
        }
        case "swarm": {
          // Anchored: quick, small jitters about the station — a sparkle
          // cloud that never leaves its vent or lantern.
          x = bx + Math.sin(t * (1.6 + rate) + p) * 0.16;
          y = by + Math.sin(t * (1.3 + rate * 0.7) + p * 1.9) * 0.14;
          z = bz + Math.cos(t * (1.5 + rate * 0.9) + p) * 0.16;
          break;
        }
        default: {
          const exhaustive: never = mode;
          throw new Error(`unhandled particulate mode: ${String(exhaustive)}`);
        }
      }

      live[i * 3] = x;
      live[i * 3 + 1] = y;
      live[i * 3 + 2] = z;

      const level =
        (TWINKLE_FLOOR + (1 - TWINKLE_FLOOR) * (0.5 + 0.5 * Math.sin(t * twinkleRates[i]! + p))) *
        cycleFade;
      shade[i * 3] = level;
      shade[i * 3 + 1] = level;
      shade[i * 3 + 2] = level;
    }
    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
  };

  // Pose once so the first frame is a field, not a stack of dark points.
  update(0);

  const group = new Group();
  group.name = "kit-particulate-field";
  group.add(points);

  return {
    group,
    draws: 1,
    triangles: 0,
    update,
    dispose(): void {
      geometry.dispose();
      material.dispose();
      group.clear();
      group.removeFromParent();
    },
  };
}
