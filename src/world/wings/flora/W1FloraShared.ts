import { BufferAttribute, type BufferGeometry, type WebGLProgramParametersWithUniforms } from "three";
import type { Random } from "../../../util/Random";
import { angleBetween, wedgeHalfAt } from "../WingGeometry";
import type { WingDef } from "../WingTypes";

/**
 * Worker W1's shared wing-flora arithmetic: the three wings this worker owns
 * (kelp-cathedral, nursery-shallows, lumen-garden) all place, sway and confine
 * by the same handful of idioms, stated once here so the three builders cannot
 * drift apart. Everything is pure and deterministic — no draws happen here;
 * every `Random` is the caller's own pre-registered stream.
 */

export function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** The wing's axis as a unit vector in the ground plane. */
export function wingAxis(def: WingDef): { x: number; z: number } {
  return { x: Math.cos(def.azimuth), z: Math.sin(def.azimuth) };
}

/** Ninety degrees off the axis — positive lateral stands to the axis's left. */
export function wingPerp(def: WingDef): { x: number; z: number } {
  return { x: -Math.sin(def.azimuth), z: Math.cos(def.azimuth) };
}

/** A point in the wing from its radial and lateral coordinates. */
export function polarPoint(
  def: WingDef,
  r: number,
  lateral: number,
): { x: number; z: number } {
  const axis = wingAxis(def);
  const perp = wingPerp(def);
  return { x: axis.x * r + perp.x * lateral, z: axis.z * r + perp.z * lateral };
}

/** A point's signed offset off the wing's axis, in metres. */
export function lateralOf(def: WingDef, x: number, z: number): number {
  const perp = wingPerp(def);
  return x * perp.x + z * perp.z;
}

/** A point's angular offset off the wing's axis, in radians. */
export function angleOffAxis(def: WingDef, x: number, z: number): number {
  return angleBetween(Math.atan2(z, x), def.azimuth);
}

/**
 * Whether a point stands inside the wedge with `margin` radians to spare —
 * the confinement contract every foot in these wings keeps. Radially the wing
 * owns (carveFrom, carveEnd); the margin is angular so it means the same
 * thing at every radius.
 */
export function insideWing(def: WingDef, x: number, z: number, margin = 0): boolean {
  const r = Math.hypot(x, z);
  if (r <= def.carve.carveFrom + 0.4 || r >= def.carve.carveEnd - 0.1) {
    return false;
  }
  return angleOffAxis(def, x, z) < wedgeHalfAt(def, r) - margin;
}

/**
 * Re-clamps a point inside the wedge's wall angle, less `margin` radians —
 * the mirror of {@link insideWing} for cluster members whose spread can
 * carry them over the wall their centre was sampled inside. A move, never
 * a re-draw, so no stream shifts under a fence retune. Without it a member
 * planted over the angle stands on rim rock metres above its own floor.
 */
export function clampInsideWedge(
  def: WingDef,
  x: number,
  z: number,
  side: number,
  margin: number,
): { x: number; z: number } {
  const r = Math.hypot(x, z);
  const half = wedgeHalfAt(def, r) - margin;
  if (angleOffAxis(def, x, z) <= half) {
    return { x, z };
  }
  return polarPoint(def, r, side * half);
}

/**
 * Draws a floor position inside the wedge: radius in [rMin, rMax], angular
 * offset at least `minAngle(r)` off the axis (the corridor fence — zero where
 * a wing keeps no corridor) and at most the wall angle less `edgeMargin`.
 * The side is drawn first and the magnitude second, always, so a caller
 * tuning either fence never re-rolls a sibling population.
 */
export function sampleWedgePoint(
  random: Random,
  def: WingDef,
  rMin: number,
  rMax: number,
  minAngle: (r: number) => number,
  edgeMargin: number,
): { x: number; z: number; r: number; angle: number } {
  const r = random.range(rMin, rMax);
  const side = random.next() < 0.5 ? -1 : 1;
  const half = wedgeHalfAt(def, r) - edgeMargin;
  const low = Math.min(minAngle(r), half - 0.005);
  const angle = side * random.range(low, Math.max(low + 0.002, half));
  const { x, z } = polarPoint(def, r, angle * r);
  return { x, z, r, angle };
}

/**
 * The kelp forest's merged-mesh sway, verbatim in spirit: two harmonics on
 * one phase per plant, amplitude already in metres in `aReach`. Shared by the
 * cathedral's columns and the lumen garden's lantern strands, so a strand can
 * never drift off the sway maths a column uses.
 */
export function injectWingSway(
  shader: WebGLProgramParametersWithUniforms,
  sway: { value: number },
  wind: { value: number },
  driftX: number,
  driftZ: number,
): void {
  shader.uniforms.uSway = sway;
  shader.uniforms.uWind = wind;
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
       uniform float uSway;
       uniform float uWind;
       attribute float aPhase;
       attribute float aReach;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       float bend = sin(uSway * 0.52 + aPhase) * 0.62 + sin(uSway * 0.21 + aPhase * 1.7) * 0.38;
       transformed.x += bend * aReach * uWind * ${driftX.toFixed(3)};
       transformed.z += bend * aReach * uWind * ${driftZ.toFixed(3)};`,
    );
}

/**
 * Writes the two floats the sway shader reads — `Kelp.swayAttributes`' own
 * contract: the phase is the plant's, the reach is squared in the attachment
 * fraction so the holdfast is still and the tip carries the whole sweep.
 */
export function addSwayAttributes(
  geometry: BufferGeometry,
  phase: number,
  height: number,
  reachAt: (y: number) => number,
  reachScale: number,
): void {
  const position = geometry.attributes.position!;
  const phases = new Float32Array(position.count);
  const reaches = new Float32Array(position.count);

  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, reachAt(position.getY(i))));
    phases[i] = phase;
    reaches[i] = t * t * height * reachScale;
  }

  geometry.setAttribute("aPhase", new BufferAttribute(phases, 1));
  geometry.setAttribute("aReach", new BufferAttribute(reaches, 1));
}
