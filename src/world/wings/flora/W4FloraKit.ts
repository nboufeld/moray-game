import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CubicBezierCurve3,
  FogExp2,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
  type Material,
  type MeshBasicMaterial,
  type Scene,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import type { WingDef } from "../WingTypes";

/**
 * The W4 worker's shared kit for its three wings — the Ruins Terrace, the
 * Mangrove Roots and the Open Blue. Everything here is one of the reef's
 * established idioms restated for wing coordinates:
 *
 * - **World-space geometry, like `AbyssFlora`.** Every merged mesh is built
 *   at its final world position, so three's culling, the canonical-frustum
 *   guards and the wave-8 confinement tests all read the same numbers.
 * - **One instanced draw per population, like `CorridorDressing`.** A
 *   placement is `{ x, y, z, rotation, scale, color }`; the mesh carries
 *   instance-aware bounds and casts nothing.
 * - **The moss contract is the reef's algae contract, deepened.**
 *   `weatherRock` already tints up-facing stone green; {@link mossFaces}
 *   multiplies a blotchy second pass over it, which is what turns "rock with
 *   algae" into "stone that has been sitting in a garden for a thousand
 *   years". It only ever multiplies what is baked — it moves no vertex.
 *
 * Nothing here draws from a stream: callers own every `Random` draw, so a
 * helper's internals can never re-roll a wing's layout.
 */

/** The wing's axis and across-axis unit vectors, `GATE_AXIS`/`perp` style. */
export interface WingFrame {
  readonly axisX: number;
  readonly axisZ: number;
  readonly perpX: number;
  readonly perpZ: number;
}

export function wingFrame(def: WingDef): WingFrame {
  return {
    axisX: Math.cos(def.azimuth),
    axisZ: Math.sin(def.azimuth),
    perpX: -Math.sin(def.azimuth),
    perpZ: Math.cos(def.azimuth),
  };
}

/** The world point `r` metres out the wing's axis and `lateral` metres across it. */
export function wingPoint(
  frame: WingFrame,
  r: number,
  lateral: number,
): { readonly x: number; readonly z: number } {
  return { x: frame.axisX * r + frame.perpX * lateral, z: frame.axisZ * r + frame.perpZ * lateral };
}

/** Signed angular distance from the wing's axis, in radians — the corridor coordinate. */
export function signedWingAngle(def: WingDef, x: number, z: number): number {
  let delta = (Math.atan2(z, x) - def.azimuth) % (Math.PI * 2);
  if (delta > Math.PI) {
    delta -= Math.PI * 2;
  } else if (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return delta;
}

/** One instanced placement; see {@link instantiate}. */
export interface PlacedPart {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly color: Color;
}

/**
 * `CorridorDressing.instantiate`, generalised to full rotations: one
 * instanced draw, instance-aware bounds (computed once — nothing here ever
 * moves), no shadow cast, the seabed's bake doing the grounding instead.
 */
export function instantiate(
  geometry: BufferGeometry,
  material: Material,
  parts: readonly PlacedPart[],
  name: string,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, parts.length);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const dummy = new Object3D();
  for (const [index, part] of parts.entries()) {
    dummy.position.set(part.x, part.y, part.z);
    dummy.rotation.set(part.rotation[0], part.rotation[1], part.rotation[2]);
    dummy.scale.set(part.scale[0], part.scale[1], part.scale[2]);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, part.color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * Merges world-space parts into one geometry, `archGeometry`'s ending. Every
 * part must carry the same attribute set; the merge throwing is preferable
 * to a silent missing piece (the fish-tail lesson).
 */
export function worldMerge(parts: readonly BufferGeometry[], name: string): BufferGeometry {
  const merged = mergeGeometries(parts as BufferGeometry[], false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error(`${name}: parts could not be merged`);
  }
  merged.computeBoundingSphere();
  return merged;
}

/** Places a geometry in the world: yaw, then translate. Mutates and returns it. */
export function placeGeometry(
  geometry: BufferGeometry,
  yaw: number,
  x: number,
  y: number,
  z: number,
): BufferGeometry {
  const matrix = new Matrix4().makeRotationY(yaw);
  matrix.setPosition(x, y, z);
  geometry.applyMatrix4(matrix);
  return geometry;
}

/**
 * A tapered tube along a cubic curve — the mangrove prop root's shape.
 * `TubeGeometry` at constant radius cannot taper, and a root that does not
 * taper reads as a pipe; here the radius is a function of `t`, thick at the
 * crown and narrowing to the foot the way a prop root enters the sand. The
 * frames are `Curve.computeFrenetFrames`, sampled exactly as `TubeGeometry`
 * samples them, so the surface is closed and smooth along its length. The
 * ends stay open by design: the foot is buried and the crown is past the
 * ceiling, and no camera ever sees either.
 */
export function taperedTube(
  curve: CubicBezierCurve3,
  tubularSegments: number,
  radialSegments: number,
  radiusAt: (t: number) => number,
  colorAt: (t: number) => readonly [number, number, number],
): BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const rings = tubularSegments + 1;
  const around = radialSegments + 1;
  const positions = new Float32Array(rings * around * 3);
  const colors = new Float32Array(rings * around * 3);
  const indices: number[] = [];
  const point = new Vector3();
  const vertex = new Vector3();

  for (let i = 0; i < rings; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, point);
    const radius = radiusAt(t);
    const [cr, cg, cb] = colorAt(t);
    const normal = frames.normals[i]!;
    const binormal = frames.binormals[i]!;
    for (let j = 0; j < around; j++) {
      const theta = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = -Math.cos(theta);
      vertex.set(
        point.x + radius * (cos * normal.x + sin * binormal.x),
        point.y + radius * (cos * normal.y + sin * binormal.y),
        point.z + radius * (cos * normal.z + sin * binormal.z),
      );
      const base = (i * around + j) * 3;
      positions[base] = vertex.x;
      positions[base + 1] = vertex.y;
      positions[base + 2] = vertex.z;
      colors[base] = cr;
      colors[base + 1] = cg;
      colors[base + 2] = cb;
    }
    if (i < tubularSegments) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * around + j;
        indices.push(a, a + around, a + 1, a + 1, a + around, a + around + 1);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The second moss pass. `weatherRock`'s `tintByFacing` is a uniform algae
 * veil; real moss is *patchy* — it holds to the upper faces in blotches and
 * leaves the shaded sides bare stone. This multiplies a blotch field over
 * the baked vertex colours: up-facing vertices inside a blotch go a soft
 * gouache green (red and blue taken down a step, green lifted a touch),
 * everywhere else is untouched to the bit.
 */
export function mossFaces(geometry: BufferGeometry, seed: number, amount = 1): void {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  if (!position || !normal) {
    return;
  }
  let colors = geometry.attributes.color as BufferAttribute | undefined;
  if (!colors) {
    colors = new BufferAttribute(new Float32Array(position.count * 3).fill(1), 3);
    geometry.setAttribute("color", colors);
  }
  for (let i = 0; i < position.count; i++) {
    const up = Math.max(0, normal.getY(i));
    if (up <= 0) {
      continue;
    }
    const blotch = fbm(position.getX(i) * 0.06 + 0.5, position.getZ(i) * 0.06 + 0.5, {
      seed,
      period: 3,
      octaves: 2,
    });
    const moss =
      Math.pow(up, 1.4) * Math.min(1, Math.max(0, (blotch - 0.32) / 0.45)) * amount;
    if (moss <= 0) {
      continue;
    }
    colors.setXYZ(
      i,
      colors.getX(i) * (1 - 0.3 * moss),
      Math.min(1, colors.getY(i) * (1 + 0.1 * moss)),
      colors.getZ(i) * (1 - 0.34 * moss),
    );
  }
  colors.needsUpdate = true;
}

/**
 * The low tuft: three crossed blades, two quads each, with the root-to-tip
 * value gradient baked in so a one-colour instance tint still reads as a
 * plant and not a card. The instance colour supplies the hue — moss green in
 * the ruins, warm olive under the mangrove.
 */
export function tuftGeometry(): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let blade = 0; blade < 3; blade++) {
    const yaw = (blade / 3) * Math.PI;
    const acrossX = Math.cos(yaw);
    const acrossZ = Math.sin(yaw);
    const leanX = -acrossZ * 0.22;
    const leanZ = acrossX * 0.22;
    const base = positions.length / 3;
    // Rows: root, mid, tip. Width tapers to a point; the lean bows the blade.
    const rows: readonly [number, number][] = [
      [0, 0.5],
      [0.55, 0.3],
      [1, 0.02],
    ];
    for (const [t, half] of rows) {
      const cx = leanX * t * t;
      const cz = leanZ * t * t;
      positions.push(cx - acrossX * half, t, cz - acrossZ * half);
      positions.push(cx + acrossX * half, t, cz + acrossZ * half);
      const value = 0.52 + 0.48 * t;
      colors.push(value, value, value, value, value, value);
    }
    for (let row = 0; row < rows.length - 1; row++) {
      const a = base + row * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A curtain's vertical stations; see `AbyssFlora.CURTAIN_ROWS` for the why. */
const CURTAIN_ROWS = [0, 0.4, 0.65, 0.82, 0.92, 1] as const;

export interface WingCurtainOptions {
  /** The arc's centre azimuth — the wing's own. */
  readonly azimuth: number;
  readonly radius: number;
  /** The arc's angular half-span, radians either side of the azimuth. */
  readonly halfSpan: number;
  readonly foot: number;
  readonly top: number;
  readonly droop: number;
  readonly ripple: number;
  readonly seed: number;
  /**
   * The gradient, as value multipliers at the foot and the top — the ink
   * itself comes from the fog-following material, exactly the canyon's
   * curtain contract.
   */
  readonly shadeFoot: number;
  readonly shadeTop: number;
}

/**
 * One silhouette curtain on a wing's own azimuth: `AbyssFlora.curtainArc`
 * generalised, drooping rippled top and six-row gradient included, because
 * those are the two things that keep a far plane reading as water rather
 * than as a screen.
 */
export function wingCurtain(options: WingCurtainOptions): BufferGeometry {
  const segments = 24;
  const rows = CURTAIN_ROWS.length;
  const positions = new Float32Array((segments + 1) * rows * 3);
  const colors = new Float32Array((segments + 1) * rows * 3);
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = options.azimuth + (t * 2 - 1) * options.halfSpan;
    const x = Math.cos(theta) * options.radius;
    const z = Math.sin(theta) * options.radius;
    const droop = (1 - Math.cos((t * 2 - 1) * Math.PI * 0.5)) * options.droop;
    const ripple =
      (fbm(t * 3, options.radius * 0.05, { seed: options.seed, period: 3, octaves: 2 }) - 0.5) *
      2 *
      options.ripple;
    const topY = options.top - droop + ripple;

    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const s = CURTAIN_ROWS[rowIndex]!;
      const y = options.foot + s * (topY - options.foot);
      const base = (i * rows + rowIndex) * 3;
      positions[base] = x;
      positions[base + 1] = y;
      positions[base + 2] = z;
      const k = s * s * (3 - 2 * s);
      const value = options.shadeFoot + (options.shadeTop - options.shadeFoot) * k;
      colors[base] = value;
      colors[base + 1] = value;
      colors[base + 2] = Math.min(1.2, value + 0.05 * (1 - k));
    }

    if (i < segments) {
      for (let rowIndex = 0; rowIndex < rows - 1; rowIndex++) {
        const a = i * rows + rowIndex;
        indices.push(a, a + 1, a + rows, a + 1, a + rows + 1, a + rows);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * `DistantReef.followFog`, packed for wing use: re-derives each registered
 * material's ink from the live fog colour — taken down the wing's own
 * violet-blue step, mixed back by the layer's fade — whenever the fog's hex
 * actually changes. Attach {@link hook} to any mesh that must stay honest.
 */
export class FogInk {
  private lastFog = -1;

  constructor(
    private readonly entries: readonly { readonly material: MeshBasicMaterial; readonly fade: number }[],
    private readonly ink: Color,
  ) {}

  follow(scene: Scene): void {
    const fog = scene.fog;
    if (!(fog instanceof FogExp2)) {
      return;
    }
    const hex = fog.color.getHex();
    if (hex === this.lastFog) {
      return;
    }
    this.lastFog = hex;
    const ink = fog.color.clone().multiply(this.ink);
    for (const entry of this.entries) {
      entry.material.color.copy(ink).lerp(fog.color, entry.fade);
    }
  }

  hook(mesh: Mesh): void {
    mesh.onBeforeRender = (_renderer, scene) => {
      this.follow(scene);
    };
  }
}

/**
 * The soft radial sprite every small bright mark in these wings shares —
 * the motes' own: a bare point or quad of additive light with hard edges is
 * a pixel error, so the falloff does the drawing.
 */
let softSpriteTexture: ReturnType<typeof buildColorTexture> | undefined;
export function softSprite(): ReturnType<typeof buildColorTexture> {
  softSpriteTexture ??= buildColorTexture(32, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    const glow = Math.max(0, 1 - distance);
    const soft = glow * glow;
    return [soft, soft, soft];
  });
  return softSpriteTexture;
}
