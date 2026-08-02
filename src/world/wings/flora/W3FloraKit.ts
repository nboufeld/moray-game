import { DataTexture, type BufferGeometry, type InstancedMesh } from "three";
import { buildScalarTexture } from "../../../rendering/ProceduralTexture";
import { Random } from "../../../util/Random";
import { wedgeHalfAt } from "../WingGeometry";
import type { WingDef } from "../WingTypes";

/**
 * The shared arithmetic and sprites for worker W3's three wings — the
 * Sea-Glass Cove, the Ghost Reef and the Current Run. One file so the three
 * modules agree about the numbers rather than copying them: the polar frame
 * a wing's axis makes, the lateral window a floor piece may occupy, the
 * corridor fences the dens swim through, and the additive sprites (bubble
 * ring, glint star) that two of the wings share.
 *
 * Nothing here draws from a stream — the samplers take their caller's
 * `Random` — so every wing's draw order lives in its own module, where the
 * ledger can read it.
 */

/** A wing's own compass: the axis it radiates along, and its left normal. */
export interface WingFrame {
  readonly axisX: number;
  readonly axisZ: number;
  readonly perpX: number;
  readonly perpZ: number;
}

export function wingFrame(def: WingDef): WingFrame {
  const axisX = Math.cos(def.azimuth);
  const axisZ = Math.sin(def.azimuth);
  // The same perpendicular convention `AbyssFlora` uses at the canyon gate.
  return { axisX, axisZ, perpX: -axisZ, perpZ: axisX };
}

export function wingPoint(
  frame: WingFrame,
  r: number,
  lateral: number,
): { readonly x: number; readonly z: number } {
  return {
    x: frame.axisX * r + frame.perpX * lateral,
    z: frame.axisZ * r + frame.perpZ * lateral,
  };
}

/** Signed metres off the wing's axis (positive to its left). */
export function lateralOf(frame: WingFrame, x: number, z: number): number {
  return x * frame.perpX + z * frame.perpZ;
}

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/**
 * The furthest off-axis a floor piece may stand at radius `r`, in metres,
 * and still hold `wingBlend` above 0.5. `wingBlend`'s across term runs
 * `1 − smoothstep01((away − floorHalf) / (half − floorHalf))`; sampling away
 * out to `floorHalf + 0.45·(half − floorHalf)` keeps the across term at
 * 0.575 or better, which *is* the blend everywhere the radial terms are 1
 * (r between `carveFull` and `fadeFrom`). Pieces nearer the gate or past the
 * fade are wall-shoulder scenery and answer `wedgeInnerHalf` instead.
 */
export function floorWindowHalf(def: WingDef, r: number): number {
  const half = wedgeHalfAt(def, r);
  return r * (def.wedge.floorHalf + 0.45 * (half - def.wedge.floorHalf));
}

/** Just inside the wedge's wall at radius `r`, in metres — the gate dressing's outer limit. */
export function wedgeInnerHalf(def: WingDef, r: number): number {
  return r * (wedgeHalfAt(def, r) - 0.005);
}

export interface WingSpot {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly lateral: number;
}

/**
 * A floor position in the wing's live band (r 34–46, where the carve is at
 * full weight): corridor fence on the inside, `floorWindowHalf` on the
 * outside. `margin` shrinks both edges, so a cluster drawn around the spot
 * keeps its fringe inside the same contracts.
 *
 * Draws are taken whether or not the window exists, so a fence retune never
 * re-rolls a downstream mark — at these radii and fences the window always
 * exists, and the clamp is arithmetic insurance, not a decision.
 */
export function drawFloorSpot(
  random: Random,
  def: WingDef,
  frame: WingFrame,
  rMin: number,
  rMax: number,
  fence: number,
  margin = 0,
): WingSpot {
  const r = random.range(rMin, rMax);
  const side = random.next() < 0.5 ? -1 : 1;
  const lo = fence + margin;
  const hi = Math.max(lo + 0.01, floorWindowHalf(def, r) - margin);
  const lateral = side * random.range(lo, hi);
  const { x, z } = wingPoint(frame, r, lateral);
  return { x, z, r, lateral };
}

/**
 * A gate-dressing position (r 31–34): scenery-only, so it may stand on the
 * sill's shoulders where the blend is thin, but never outside the wedge and
 * never inside the corridor fence.
 */
export function drawGateSpot(
  random: Random,
  def: WingDef,
  frame: WingFrame,
  rMin: number,
  rMax: number,
  fence: number,
): WingSpot {
  const r = random.range(rMin, rMax);
  const side = random.next() < 0.5 ? -1 : 1;
  const lateral = side * random.range(fence, Math.max(fence + 0.01, wedgeInnerHalf(def, r)));
  const { x, z } = wingPoint(frame, r, lateral);
  return { x, z, r, lateral };
}

/**
 * One wing's animation clock: the two uniforms the sway shaders read, and
 * the becalm every motion here takes under reduced motion — the same
 * contract `SeaGrass.update` keeps in the bowl.
 */
export interface SwayClock {
  readonly time: { value: number };
  readonly strength: { value: number };
  advance(dt: number, reducedMotion: boolean, calm?: number): void;
}

export function swayClock(): SwayClock {
  const time = { value: 0 };
  const strength = { value: 1 };
  return {
    time,
    strength,
    advance(dt: number, reducedMotion: boolean, calm = 0.35): void {
      time.value += dt * (reducedMotion ? 0.3 : 1);
      strength.value = reducedMotion ? calm : 1;
    },
  };
}

/**
 * The bubble's ring, re-authored here rather than imported: `Bubbles`' own
 * sprite is module-private, and the Current Run's streams wear the same
 * mark — a bright rim, a hollow centre, a small off-axis catchlight, black
 * (additive-nothing) at the corners.
 */
let ringSpriteTexture: DataTexture | undefined;
export function bubbleRingSprite(): DataTexture {
  ringSpriteTexture ??= buildScalarTexture(48, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    const rim = Math.exp(-Math.pow((distance - 0.7) / 0.17, 2));
    const fill = 0.1 * (1 - smoothstep01((distance - 0) / 0.8));
    const catchlight = 0.5 * Math.exp(-Math.pow(Math.hypot(u - 0.35, v - 0.35) / 0.1, 2));
    return Math.min(1, rim + fill + catchlight) * (1 - smoothstep01((distance - 0.86) / 0.14));
  });
  return ringSpriteTexture;
}

/**
 * The sea-glass glint: a hot pinprick with a four-point star's streaks, the
 * mark a sun fleck leaves on tumbled glass. Soft everywhere — a hard star at
 * this size is an aliased pixel by the second metre.
 */
let glintSpriteTexture: DataTexture | undefined;
export function glintStarSprite(): DataTexture {
  glintSpriteTexture ??= buildScalarTexture(32, (u, v) => {
    const dx = u - 0.5;
    const dy = v - 0.5;
    const distance = Math.hypot(dx, dy) * 2;
    const core = Math.exp(-Math.pow(distance / 0.18, 2));
    const streaks =
      Math.exp(-Math.pow(dx / 0.055, 2)) * Math.exp(-Math.pow(dy / 0.42, 2)) +
      Math.exp(-Math.pow(dy / 0.055, 2)) * Math.exp(-Math.pow(dx / 0.42, 2));
    return Math.min(1, core + streaks * 0.5) * (1 - smoothstep01((distance - 0.82) / 0.18));
  });
  return glintSpriteTexture;
}

/**
 * The one number the budget test and the ledger both want: rendered
 * triangles across a wing's instanced meshes (points and lines cost no
 * triangles and are not counted).
 */
export function instancedTriangles(mesh: InstancedMesh): number {
  const geometry: BufferGeometry = mesh.geometry;
  const per = geometry.index ? geometry.index.count / 3 : geometry.attributes.position!.count / 3;
  return per * mesh.count;
}
