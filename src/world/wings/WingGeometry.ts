import { fbm } from "../../rendering/ProceduralTexture";
import { SEEDS } from "../../util/Random";
import type { WingDef } from "./WingTypes";

/**
 * The pure per-wing arithmetic, generalised from `Abyss.ts`'s canyon (W-M3).
 * Every function here keeps the canyon's structural bit-identity argument:
 * outside a wing's radial envelope and azimuth wedge it returns *exactly*
 * zero (or false) through early returns, never through arithmetic that
 * happens to be small. `tests/wings.test.ts` holds that.
 *
 * Nothing in this module reads the registry — every function takes its
 * `WingDef` — so the geometry is unit-testable per wing and the registry
 * binding lives in one place (`WingField`).
 */

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** Shortest angular distance between two azimuths, in [0, π]. */
export function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}

/**
 * The wedge's wall half-angle at a radius: wings are doorways at the rim
 * and rooms beyond it, so the wedge widens from `gateHalf` to `endHalf`
 * across the carve's radial run.
 */
export function wedgeHalfAt(def: WingDef, r: number): number {
  const t = smoothstep01((r - def.carve.carveFrom) / (def.carve.carveEnd - def.carve.carveFrom));
  return def.wedge.gateHalf + (def.wedge.endHalf - def.wedge.gateHalf) * t;
}

/**
 * How much of the wing owns a point, in [0, 1] — `canyonBlend`'s shape with
 * the wing's own numbers. `Seabed.seabedHeight` blends toward
 * {@link wingTarget} by this weight.
 */
export function wingBlend(def: WingDef, x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= def.carve.carveFrom || r >= def.carve.carveEnd) {
    return 0;
  }
  const away = angleBetween(Math.atan2(z, x), def.azimuth);
  const half = wedgeHalfAt(def, r);
  if (away >= half) {
    return 0;
  }

  const across = 1 - smoothstep01((away - def.wedge.floorHalf) / (half - def.wedge.floorHalf));
  const inward = smoothstep01((r - def.carve.carveFrom) / (def.carve.carveFull - def.carve.carveFrom));
  const outward = 1 - smoothstep01((r - def.carve.fadeFrom) / (def.carve.carveEnd - def.carve.fadeFrom));
  return across * inward * outward;
}

/**
 * The floor the wing is carved toward: a sill through the rim's notch, a
 * shelf descending (or climbing — nursery floors *rise*) to the wing's own
 * level, and a hand-depth of seeded detail from the wing's own stream.
 */
export function wingTarget(def: WingDef, x: number, z: number): number {
  const r = Math.hypot(x, z);
  const carve = def.carve;
  const shelf = smoothstep01((r - carve.shelfFrom) / (carve.shelfTo - carve.shelfFrom));
  const sill = smoothstep01((r - carve.carveFrom) / (carve.shelfFrom - carve.carveFrom));
  const detail =
    (fbm(x * 0.02, z * 0.02, {
      seed: SEEDS[def.seedKey] ^ 0x7e1f,
      period: 8,
      octaves: 2,
    }) -
      0.5) *
    2 *
    carve.detailAmplitude;
  return sill * carve.sillDepth + shelf * (carve.floorDepth - carve.sillDepth) + detail * shelf;
}

/**
 * How deep into the wing's mood the camera is, in [0, 1] — `abyssMood`'s
 * three early returns with the wing's own surface and descent, so a wing can
 * be a twilight that arrives on the way down or a shallows that is simply
 * *on* the moment the wedge is entered.
 */
export function wingMood(def: WingDef, x: number, y: number, z: number): number {
  if (y >= def.moodSurface) {
    return 0;
  }
  const r = Math.hypot(x, z);
  if (r <= 30) {
    return 0;
  }
  const away = angleBetween(Math.atan2(z, x), def.azimuth);
  // The same small margin the airspace keeps — and no more: the wings stand
  // 0.36 rad apart and 0.56 from the canyon's axis, so a wider apron here
  // would bleed one place's water into the next.
  const half = wedgeHalfAt(def, r) + 0.02;
  if (away >= half) {
    return 0;
  }

  const descent = smoothstep01((def.moodSurface - y) / def.moodDescent);
  const through = smoothstep01((r - 30) / 5);
  const across = 1 - smoothstep01((away - def.wedge.floorHalf) / (half - def.wedge.floorHalf));
  return descent * through * across;
}

/** Where the annexed airspace begins and ends, shared by all wings. */
export const WING_AIRSPACE_FROM = 29;

/** Metres past the carve's end the radial cap stands. */
export function wingMaxRadius(def: WingDef): number {
  return def.carve.carveEnd + 1;
}

export function insideWingAirspace(def: WingDef, x: number, z: number): boolean {
  const r = Math.hypot(x, z);
  if (r < WING_AIRSPACE_FROM || r > wingMaxRadius(def) + 1) {
    return false;
  }
  return angleBetween(Math.atan2(z, x), def.azimuth) < wedgeHalfAt(def, r) + 0.02;
}

/**
 * The wing's ceiling, eased from the bowl's 12 m at the gate down (or barely
 * at all — the cathedral keeps its vault) to the wing's own roof.
 */
export function wingCeiling(def: WingDef, x: number, z: number): number {
  const r = Math.hypot(x, z);
  const t = smoothstep01((r - 30) / 8);
  return def.ceilingAtGate + (def.ceilingInside - def.ceilingAtGate) * t;
}
