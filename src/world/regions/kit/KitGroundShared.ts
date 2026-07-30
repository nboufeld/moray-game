import {
  BufferAttribute,
  Color,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SUN_POSITION } from "../../../rendering/Lighting";
import type { Random } from "../../../util/Random";
import type { GateFn, KitArea, KitBuild } from "./KitTypes";

/**
 * Package A's internal helpers — the shared arithmetic behind the ground &
 * flora builders, so ten pieces do not carry ten copies of the same area
 * sampler and the same dispose discipline. INTERNAL to Package A: nothing
 * here is part of the kit's public contract (KIT-SPEC §2 signatures are),
 * and Package B neither imports nor edits this file.
 *
 * Two disciplines live here because every scatter piece shares them:
 *
 * - **Fixed draws per attempt** (the SeaGrass side-stream lesson, applied
 *   to rejection): every scatter attempt consumes exactly the same number
 *   of stream draws whether it is accepted or not, so retuning a `gate`
 *   (a density change) can never shift the position of any survivor — the
 *   attempt at index k has the same coordinates forever.
 * - **Seeded clumps** (the fill doctrine's "natural clustering"): uniform
 *   scatter reads as a texture; habitat reads as drifts with dense hearts.
 *   Each piece draws its clump centres first, from the same private stream,
 *   then mixes clumped attempts with a loose share of true scatter.
 */

// ─── Areas ───────────────────────────────────────────────────────────────────

export interface ResolvedArea {
  /** Point from two uniforms in [0,1) — never draws from a stream itself. */
  sample(u: number, v: number): { x: number; z: number };
  /** True when the point is inside the area with `margin` metres to spare. */
  contains(x: number, z: number, margin?: number): boolean;
  /** A representative centre, for demo cameras and honest-bounds checks. */
  readonly center: { x: number; z: number };
}

interface RoadSegment {
  readonly x: number;
  readonly z: number;
  readonly dx: number;
  readonly dz: number;
  readonly length: number;
  readonly from: number;
}

/** Normalises a `KitArea` into a sampler + containment test, computed once. */
export function resolveArea(area: KitArea): ResolvedArea {
  if ("center" in area) {
    const [cx, cz] = area.center;
    const radius = area.radius;
    return {
      sample(u, v) {
        // sqrt biases uniform-by-area; the clump pass adds the dense hearts.
        const r = radius * Math.sqrt(u);
        const theta = v * Math.PI * 2;
        return { x: cx + Math.cos(theta) * r, z: cz + Math.sin(theta) * r };
      },
      contains(x, z, margin = 0) {
        return Math.hypot(x - cx, z - cz) <= radius - margin;
      },
      center: { x: cx, z: cz },
    };
  }

  const points = area.polyline;
  const half = area.width / 2;
  const segments: RoadSegment[] = [];
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, az] = points[i]!;
    const [bx, bz] = points[i + 1]!;
    const length = Math.hypot(bx - ax, bz - az);
    if (length <= 1e-6) {
      continue;
    }
    segments.push({
      x: ax,
      z: az,
      dx: (bx - ax) / length,
      dz: (bz - az) / length,
      length,
      from: total,
    });
    total += length;
  }
  if (segments.length === 0) {
    throw new Error("kit area: a polyline needs two distinct points");
  }
  const mid = pointAlong(segments, total / 2);

  return {
    sample(u, v) {
      const at = pointAlong(segments, u * total);
      const lateral = (v * 2 - 1) * half;
      // Perpendicular of the segment the point landed on.
      return { x: at.x - at.dz * lateral, z: at.z + at.dx * lateral };
    },
    contains(x, z, margin = 0) {
      let best = Infinity;
      for (const segment of segments) {
        const px = x - segment.x;
        const pz = z - segment.z;
        const along = Math.min(segment.length, Math.max(0, px * segment.dx + pz * segment.dz));
        const nx = segment.x + segment.dx * along;
        const nz = segment.z + segment.dz * along;
        best = Math.min(best, Math.hypot(x - nx, z - nz));
      }
      return best <= half - margin;
    },
    center: { x: mid.x, z: mid.z },
  };
}

function pointAlong(
  segments: readonly RoadSegment[],
  distance: number,
): { x: number; z: number; dx: number; dz: number } {
  let segment = segments[segments.length - 1]!;
  for (const candidate of segments) {
    if (distance <= candidate.from + candidate.length) {
      segment = candidate;
      break;
    }
  }
  const along = Math.min(segment.length, Math.max(0, distance - segment.from));
  return {
    x: segment.x + segment.dx * along,
    z: segment.z + segment.dz * along,
    dx: segment.dx,
    dz: segment.dz,
  };
}

// ─── The clumped rejection scatter ──────────────────────────────────────────

export interface ScatterOptions {
  readonly random: Random;
  readonly area: KitArea;
  readonly gate: GateFn;
  readonly count: number;
  /** Share of instances that scatter loose between the clumps. Default 0.3. */
  readonly looseShare?: number;
  /** Metres of clump heart. Default scaled off the area's own size. */
  readonly clumpRadius?: number;
  /** Target instances per clump; sets how many clump hearts are drawn. */
  readonly perClump?: number;
}

/**
 * The one scatter every ground piece uses: seeded clump hearts, a loose
 * share, rejection against the caller's `gate` — with exactly five draws
 * consumed per attempt, accepted or not (see the module header for why).
 */
export interface ScatterPoint {
  readonly x: number;
  readonly z: number;
  /**
   * How deep in a clump heart the point landed: 1 at a heart's centre,
   * falling to 0 at its rim; exactly 0 for the loose share. Derived from
   * numbers the scatter already drew — reading it costs the stream
   * nothing, so pieces that ignore it stay byte-identical.
   */
  readonly heart: number;
}

export function scatterPoints(options: ScatterOptions): ScatterPoint[] {
  const { random, gate, count } = options;
  const resolved = resolveArea(options.area);
  const looseShare = options.looseShare ?? 0.3;
  const areaScale =
    "center" in options.area ? options.area.radius : options.area.width;
  const clumpRadius = options.clumpRadius ?? Math.max(0.8, areaScale * 0.18);
  const perClump = options.perClump ?? 22;
  const clumpCount = Math.max(1, Math.round(count / perClump));

  // Clump hearts first, so a count retune of the instances cannot move them.
  const clumps: { x: number; z: number }[] = [];
  for (let i = 0; i < clumpCount; i++) {
    clumps.push(resolved.sample(random.next(), random.next()));
  }

  const points: ScatterPoint[] = [];
  const maxAttempts = count * 40;
  for (let attempt = 0; attempt < maxAttempts && points.length < count; attempt++) {
    const u1 = random.next();
    const u2 = random.next();
    const u3 = random.next();
    const u4 = random.next();
    const roll = random.next();

    let x: number;
    let z: number;
    let heart: number;
    if (u1 < looseShare) {
      const spot = resolved.sample(u2, u3);
      x = spot.x;
      z = spot.z;
      heart = 0;
      void u4; // drawn regardless — fixed draws per attempt is the contract
    } else {
      const clump = clumps[Math.min(clumps.length - 1, Math.floor(u2 * clumps.length))]!;
      const r = clumpRadius * Math.sqrt(u3);
      const theta = u4 * Math.PI * 2;
      x = clump.x + Math.cos(theta) * r;
      z = clump.z + Math.sin(theta) * r;
      heart = 1 - Math.sqrt(u3);
    }

    if (!resolved.contains(x, z)) {
      continue;
    }
    if (roll >= gate(x, z)) {
      continue;
    }
    points.push({ x, z, heart });
  }
  return points;
}

// ─── The sun-through-leaf glow (the bowl meadow's light note) ────────────────

/**
 * PORTED from `SeaGrass` (`createSunViewUniform` / `trackSunView` /
 * `injectLeafGlow`), the way `SpongeCluster` ports `paintTube`: the source
 * is cited and the copy is verbatim in behaviour. A direct import is
 * illegal here — `SeaGrass` pulls in the bowl's `Seabed` terrain module,
 * and kit pieces never import terrain (kit law 1 / KitTypes' GroundFn
 * contract). The glow is the R12 craft being licensed into the kit: a
 * leaf between the camera and the sun lights up golden, weighted toward
 * the tip because the root is the thick part.
 */
export interface KitSunViewUniform {
  readonly value: Vector3;
}

export function createKitSunViewUniform(): KitSunViewUniform {
  return { value: new Vector3(0, 1, 0) };
}

/** Hangs the per-frame sun-direction refresh on a mesh the kit owns. */
export function trackKitSunView(mesh: Object3D, sun: KitSunViewUniform): void {
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    sun.value
      .copy(SUN_POSITION)
      .normalize()
      .transformDirection(camera.matrixWorldInverse);
  };
}

/**
 * The two-note translucency (SeaGrass W-L9): a cool view-facing term (a
 * blade's far side glows rather than shadowing) and a warm backlit term
 * gated by `tipExpr`, the caller's "how far up the leaf" expression.
 */
export function injectKitLeafGlow(
  shader: WebGLProgramParametersWithUniforms,
  sun: KitSunViewUniform,
  coolTint: string,
  warmTint: string,
  tipExpr: string,
): void {
  shader.uniforms.uKitSunView = sun;
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
       uniform vec3 uKitSunView;`,
    )
    .replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
       float kitFacing = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));
       float kitToward = max(dot(normalize(-vViewPosition), uKitSunView), 0.0);
       float kitBacklit = pow(kitToward, 4.0);
       float kitLeafTip = ${tipExpr};
       gl_FragColor.rgb += diffuseColor.rgb * ${coolTint} * kitFacing;
       gl_FragColor.rgb += diffuseColor.rgb * ${warmTint} * kitBacklit * (0.25 + 0.75 * kitLeafTip);`,
    );
}

// ─── Paint arithmetic ────────────────────────────────────────────────────────

/**
 * The per-channel multiplier that takes the `from` hue down to the `to` hue,
 * clamped to the GLB ceiling (vertex colours only ever DARKEN relative to
 * the instance/material colour, so palettes stay the one hue source). Both
 * hexes go through `Color` exactly as the bowl's instance tints do.
 */
export function shadeRatio(
  from: number,
  to: number,
): readonly [number, number, number] {
  const a = new Color(from);
  const b = new Color(to);
  return [
    Math.min(1, b.r / Math.max(1e-4, a.r)),
    Math.min(1, b.g / Math.max(1e-4, a.g)),
    Math.min(1, b.b / Math.max(1e-4, a.b)),
  ];
}

/** Linear blend of two multiplier triples. */
export function mixRatio(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): readonly [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export const RATIO_ONE: readonly [number, number, number] = [1, 1, 1];

/** Shortest signed angle from `from` to `to`, for yaw combing and raking. */
export function angleTo(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) {
    delta -= Math.PI * 2;
  } else if (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return delta;
}

// ─── Instancing and build assembly ──────────────────────────────────────────

export interface KitPlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly color: Color;
}

/**
 * One instanced draw with the sill-stones discipline baked in: instance-aware
 * bounds computed once (nothing the kit builds ever moves its matrices), no
 * shadow flags (kit law 2), the caller's material and geometry owned by the
 * caller's dispose.
 */
export function instantiatePlacements(
  geometry: BufferGeometry,
  material: Material,
  parts: readonly KitPlacement[],
  name: string,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, parts.length);
  mesh.name = name;
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

/** Triangles in one geometry, indexed or not. */
export function geometryTriangles(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  if (index) {
    return index.count / 3;
  }
  const position = geometry.getAttribute("position");
  return position ? position.count / 3 : 0;
}

/** Honest triangles for a mesh: geometry triangles × instances where instanced. */
export function meshTriangles(mesh: Mesh): number {
  const per = geometryTriangles(mesh.geometry);
  return mesh instanceof InstancedMesh ? per * mesh.count : per;
}

/**
 * Assembles the `KitBuild` contract off what was actually created: draws and
 * triangles COUNTED from the group's meshes (budget honesty is law 6), and a
 * dispose that releases only what the build owns and leaves the group empty
 * and detached (the LifeSystem discipline).
 */
export function finishBuild(
  group: Group,
  owned: readonly (BufferGeometry | Material)[],
): KitBuild {
  let draws = 0;
  let triangles = 0;
  group.traverse((node) => {
    if (node instanceof Mesh) {
      draws += 1;
      triangles += meshTriangles(node);
    }
  });
  return {
    group,
    draws,
    triangles: Math.round(triangles),
    dispose(): void {
      for (const resource of owned) {
        resource.dispose();
      }
      group.clear();
      group.removeFromParent();
    },
  };
}

/**
 * Bakes shape variants at their placements into ONE merged world-space
 * geometry — the draw-per-family answer when a family has several shapes
 * (an InstancedMesh carries exactly one geometry). Source geometries are
 * never mutated or disposed: each placement clones its pick, multiplies
 * the placement colour into the vertex colours (creating a filled
 * attribute when the variant brought none) and merges.
 */
export function mergeBakedPlacements(
  variants: readonly BufferGeometry[],
  placements: readonly KitPlacement[],
  picks: readonly number[],
): BufferGeometry {
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const euler = new Euler();
  const position = new Vector3();
  const scale = new Vector3();
  const parts: BufferGeometry[] = [];
  for (const [index, placement] of placements.entries()) {
    const source = variants[picks[index] ?? 0] ?? variants[0];
    if (!source) {
      throw new Error("kit: a shape set needs at least one geometry");
    }
    const part = source.clone();
    if (!part.attributes.color) {
      const filled = new Float32Array((part.attributes.position?.count ?? 0) * 3).fill(1);
      part.setAttribute("color", new BufferAttribute(filled, 3));
    }
    const colors = part.attributes.color as BufferAttribute;
    for (let i = 0; i < colors.count; i++) {
      colors.setXYZ(
        i,
        colors.getX(i) * placement.color.r,
        colors.getY(i) * placement.color.g,
        colors.getZ(i) * placement.color.b,
      );
    }
    quaternion.setFromEuler(
      euler.set(placement.rotation[0], placement.rotation[1], placement.rotation[2]),
    );
    matrix.compose(
      position.set(placement.x, placement.y, placement.z),
      quaternion,
      scale.set(placement.scale[0], placement.scale[1], placement.scale[2]),
    );
    part.applyMatrix4(matrix);
    parts.push(part);
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("kit: shape variants could not be merged");
  }
  merged.computeBoundingSphere();
  return merged;
}

// ─── Ground seating ──────────────────────────────────────────────────────────

/**
 * The ground's slope at a point, as the small rotations that lie a flat
 * piece onto it — pitch about x from the z-gradient, roll about z from the
 * x-gradient. Central differences at one metre: litter and slabs are ankle
 * scenery, and finer sampling only chases dune noise.
 */
export function groundLie(
  ground: (x: number, z: number) => number,
  x: number,
  z: number,
): { pitch: number; roll: number } {
  const step = 0.5;
  const dx = (ground(x + step, z) - ground(x - step, z)) / (2 * step);
  const dz = (ground(x, z + step) - ground(x, z - step)) / (2 * step);
  return { pitch: Math.atan(dz), roll: -Math.atan(dx) };
}
