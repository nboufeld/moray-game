import { regionSlot, slotCenter, type RegionSlot } from "./RegionSlots";

/**
 * R0 — weight-field helpers for region domains, so every worker's
 * `weight(x, z)` is built from the same audited pieces: a feathered disc
 * over the slot, and (for depth 1) an approach tongue running back along
 * the spoke to the gateway wing's end. All pieces return exactly 0
 * outside themselves — the structural early-return the identity tests
 * lean on — and combine with `Math.max`.
 */

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

export interface SlotDisc {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly feather: number;
}

/** The slot's authored disc with an edge feather (default 50 m). */
export function slotDisc(slot: RegionSlot | string, feather = 50): SlotDisc {
  const resolved = typeof slot === "string" ? regionSlot(slot) : slot;
  const { x, z } = slotCenter(resolved);
  return { x, z, radius: resolved.radius, feather };
}

/** 1 inside `radius - feather`, easing to exactly 0 at `radius`. */
export function discWeight(disc: SlotDisc, x: number, z: number): number {
  const distance = Math.hypot(x - disc.x, z - disc.z);
  if (distance >= disc.radius) {
    return 0;
  }
  return 1 - smoothstep01((distance - (disc.radius - disc.feather)) / disc.feather);
}

export interface Tongue {
  readonly azimuth: number;
  /** Radial run, from the gateway wing's end out to the disc's rim. */
  readonly fromR: number;
  readonly toR: number;
  /** Metres of half-width at each end — tongues widen as they open. */
  readonly halfWidthFrom: number;
  readonly halfWidthTo: number;
}

/** A depth-1 approach tongue along the spoke; defaults meet the wing at 48. */
export function approachTongue(slot: RegionSlot | string, overrides: Partial<Tongue> = {}): Tongue {
  const resolved = typeof slot === "string" ? regionSlot(slot) : slot;
  return {
    azimuth: resolved.azimuth,
    fromR: 48,
    toR: resolved.centerR - resolved.radius + 60,
    halfWidthFrom: 7,
    halfWidthTo: 34,
    ...overrides,
  };
}

/**
 * 1 on the tongue's spine, easing to exactly 0 at its edges and ends.
 * The `fromR` end holds weight 1 across the wing seam so the handover to
 * the wing's own carve is a blend, not a step.
 */
export function tongueWeight(tongue: Tongue, x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= tongue.fromR - 4 || r >= tongue.toR) {
    return 0;
  }
  const along = (r - tongue.fromR) / (tongue.toR - tongue.fromR);
  const halfWidth =
    tongue.halfWidthFrom + (tongue.halfWidthTo - tongue.halfWidthFrom) * Math.min(1, Math.max(0, along));

  // Lateral distance from the spoke's axis.
  const axisX = Math.cos(tongue.azimuth);
  const axisZ = Math.sin(tongue.azimuth);
  const alongAxis = x * axisX + z * axisZ;
  if (alongAxis <= 0) {
    return 0;
  }
  const lateral = Math.abs(x * -axisZ + z * axisX);
  if (lateral >= halfWidth) {
    return 0;
  }

  const across = 1 - smoothstep01((lateral - halfWidth * 0.55) / (halfWidth * 0.45));
  const enter = smoothstep01((r - (tongue.fromR - 4)) / 6);
  const exit = 1 - smoothstep01((r - (tongue.toR - 22)) / 22);
  return across * enter * exit;
}
