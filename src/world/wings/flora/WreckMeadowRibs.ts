import { BoxGeometry, BufferAttribute, BufferGeometry, Color } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../../../rendering/ProceduralTexture";
import { seabedHeight } from "../../Seabed";

/**
 * The Wreck Meadow's timber geometry: the ribs of an old hull, its broken
 * keel line, and the planks the sea scattered off it.
 *
 * The ribs are the one authored silhouette in the wing, so they are drawn
 * the way `RockShapes` draws its stones: an authored curve — here an arc of
 * a circle, the line a bent frame timber actually takes — swept with a
 * tapering tube, and only then roughed by fbm. The noise is sampled by
 * direction-and-station, never per vertex, so the duplicated column at the
 * sweep's seam displaces identically and the surface stays closed (the
 * `roughLathe` argument, one shape family over).
 *
 * Two variants exist and no more. A *hoop* is a full frame standing across
 * the keel, both feet buried — the ribs a diver reads as a ship's skeleton
 * from twenty metres. A *stub* is the same arc broken off mid-climb, its
 * tube tapering to a splintered point; broken ribs are what make the place
 * a wreck rather than a skeleton waiting for its ship. Everything else —
 * height, list, yaw, whether a rib still stands or has fallen against the
 * sand — is per-instance, so the whole cage costs two draw calls.
 *
 * Nothing here is a rock, so nothing here goes through `weatherRock`: the
 * algae-and-box-UV contract is the reef's stone finish, and timber wears
 * its colour in the vertex bake instead — dark at the buried feet where
 * the wood stays wet, warm and pale toward the crown the light reaches.
 */

/** The wreck's wood palette: rust-warm browns, red above green, never black. */
export const RUST_DARK = new Color(0x6e3f26);
export const RUST_LIGHT = new Color(0xa86236);
const KEEL_DARK = new Color(0x63452e);
const KEEL_LIGHT = new Color(0x8a6544);
const TIMBER_TINT = new Color(0x8a6845);

/** How far below its chord a unit arc's feet are buried, so no rib floats. */
const ARC_SINK = 0.35;

/** Peak radial roughing on a swept tube, as a fraction of the local radius. */
const TUBE_ROUGH = 0.14;

export interface RibArcOptions {
  readonly seed: number;
  /**
   * Half the swept angle, in radians. The arc runs from `-phi` to
   * `tipTheta`, measured about the circle's centre: `phi` just past π/2
   * puts both feet below the sand with the crown over the keel.
   */
  readonly phi: number;
  /**
   * Where the sweep ends. `phi` for a hoop; anything smaller is a stub —
   * the tube tapers to a point there and the rib reads as snapped off.
   */
  readonly tipTheta: number;
  /** Tube radius at the foot, as a fraction of the (unit) arc radius. */
  readonly tube: number;
  readonly rings?: number;
  readonly sides?: number;
}

/**
 * Sweeps one rib: an arc of a unit circle in the local XY plane, feet at
 * `y = -ARC_SINK`, crown at `y = 1 - cos(phi) - ARC_SINK` for a hoop.
 * Per-instance scale therefore sets the standing height directly.
 */
export function ribArcGeometry(options: RibArcOptions): BufferGeometry {
  const rings = options.rings ?? 15;
  const sides = options.sides ?? 8;
  const stub = options.tipTheta < options.phi;
  const lift = -Math.cos(options.phi) - ARC_SINK;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const tint = new Color();

  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const theta = -options.phi + t * (options.phi + options.tipTheta);
    const cx = Math.sin(theta);
    const cy = Math.cos(theta) + lift;
    // The ring frame of a planar curve is constant: outward normal in the
    // plane, binormal along z.
    const nx = Math.sin(theta);
    const ny = Math.cos(theta);

    // A hoop tapers toward its crown, as a bent frame tapers toward the
    // gunwale; a stub runs to nothing at the break.
    const taper = stub ? Math.pow(1 - t, 0.62) * 0.96 + 0.04 : 1 - 0.4 * Math.sin(Math.PI * t);
    const rho = options.tube * taper;
    // The tooth fades where the tube closes: roughing a point is a hole.
    const bite = TUBE_ROUGH * Math.min(1, taper * 3);

    for (let s = 0; s <= sides; s++) {
      const u = s / sides;
      const angle = u * Math.PI * 2;
      const rough =
        1 + (fbm(u, t, { seed: options.seed, period: 3, octaves: 2 }) - 0.5) * 2 * bite;
      const radius = rho * rough;
      const across = Math.cos(angle) * radius;
      const along = Math.sin(angle) * radius;
      positions.push(cx + nx * across, cy + ny * across, along);

      // Dark at the buried feet, warm where the light reaches: the crown of
      // a hoop, the pale snapped end of a stub. The outward face of the arc
      // (up, at the crown) carries the light; the under-arch stays wet and
      // dark — without the face term the whole visible crown clamped to one
      // value and the timber read flat.
      const bright = stub ? 0.32 + 0.6 * t : 0.36 + 0.56 * Math.sin(Math.PI * t);
      const grain = fbm(u, t, { seed: options.seed ^ 0x4d21, period: 3, octaves: 1 });
      const face = 0.78 + 0.28 * Math.cos(angle);
      const value = bright * face * (0.82 + grain * 0.3);
      tint.copy(RUST_DARK).lerp(RUST_LIGHT, Math.min(1, value));
      colors.push(tint.r, tint.g, tint.b);
    }
  }

  const stride = sides + 1;
  for (let i = 0; i < rings; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * stride + s;
      indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A segment of the broken keel line, as radial stations along the wing's axis. */
export interface KeelSegment {
  readonly r0: number;
  readonly r1: number;
}

/**
 * The keel: a few run lengths of heavy timber, gaps where the sea took the
 * rest. Each segment is a long box with a sag amidships, ragged tapering
 * ends, and fbm tooth — merged into one world-space geometry so the whole
 * line is one draw call. The yaw is the wing's own azimuth, so the keel
 * lies exactly down the corridor the ribs stand across.
 */
export function keelGeometry(
  segments: readonly KeelSegment[],
  azimuth: number,
  seed: number,
): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const axisX = Math.cos(azimuth);
  const axisZ = Math.sin(azimuth);

  for (const [index, segment] of segments.entries()) {
    const length = segment.r1 - segment.r0;
    const box = new BoxGeometry(length, 0.42, 0.52, 10, 1, 1);
    const position = box.attributes.position;
    if (!position) {
      continue;
    }
    const colors = new Float32Array(position.count * 3);
    const tint = new Color();
    for (let i = 0; i < position.count; i++) {
      // Clamped: a float box end lands a hair past ±length/2, and a
      // fractional power of a negative u is NaN, not a small number.
      const u = Math.min(1, Math.max(0, position.getX(i) / length + 0.5));
      // Amidships sag and ends worked thin and ragged: a keel is not a beam
      // any more, it is what is left of one.
      const sag = Math.sin(Math.PI * u) * 0.1;
      const endWear = 0.62 + 0.38 * Math.sin(Math.PI * Math.pow(u, 0.7));
      const gnaw = fbm(u * 2, index * 0.7, { seed, period: 3, octaves: 2 }) - 0.5;
      position.setY(i, position.getY(i) * endWear - sag + gnaw * 0.05);
      position.setZ(i, position.getZ(i) * endWear * (1 + gnaw * 0.3));

      const up = position.getY(i) / 0.42 + 0.5;
      tint.copy(KEEL_DARK).lerp(KEEL_LIGHT, Math.min(1, Math.max(0, up)));
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
    }
    position.needsUpdate = true;
    box.setAttribute("color", new BufferAttribute(colors, 3));
    box.computeVertexNormals();

    const mid = (segment.r0 + segment.r1) / 2;
    const x = axisX * mid;
    const z = axisZ * mid;
    // rotateY(-azimuth) lays local +x along the wing's axis.
    box.rotateY(-azimuth);
    box.translate(x, seabedHeight(x, z) + 0.16, z);
    parts.push(box);
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("keel segments could not be merged");
  }
  return merged;
}

/**
 * One scattered plank, unit length along x: a box gently cupped along its
 * run and worked thinner toward the snapped end. Per-instance scale sets
 * the length; the sea does the rest with yaw and a few degrees of pitch.
 */
export function timberGeometry(seed: number): BufferGeometry {
  const box = new BoxGeometry(1, 0.09, 0.26, 5, 1, 1);
  const position = box.attributes.position;
  const count = position ? position.count : 0;
  const colors = new Float32Array(count * 3);
  const tint = new Color();
  if (position) {
    for (let i = 0; i < position.count; i++) {
      const u = position.getX(i) + 0.5;
      const cup = Math.sin(Math.PI * u) * 0.03;
      const wear = 0.68 + 0.32 * (1 - u);
      const gnaw = fbm(u, 0.5, { seed, period: 3, octaves: 2 }) - 0.5;
      position.setY(i, position.getY(i) + cup + gnaw * 0.02);
      position.setZ(i, position.getZ(i) * wear);
      // Bleached toward the break, darker where it lay in the sand.
      const shade = 0.55 + 0.45 * u + gnaw * 0.2;
      tint.copy(TIMBER_TINT).multiplyScalar(Math.min(1.15, Math.max(0.7, shade)));
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
    }
    position.needsUpdate = true;
  }
  box.setAttribute("color", new BufferAttribute(colors, 3));
  box.computeVertexNormals();
  return box;
}
