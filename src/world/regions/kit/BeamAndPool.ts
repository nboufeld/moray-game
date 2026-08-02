import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  Vector3,
  type BufferGeometry,
  type DataTexture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { Random } from "../../../util/Random";
import type { GroundFn, KitBuild } from "./KitTypes";

/**
 * `beamAndPool` (KIT-SPEC §3.5) — the shaft + dapple-pool pair as one
 * call, the verdant implementations ported into route data: crossed
 * soft-bell blades landing on an authored ground point, with a pool of
 * light under each beam by default, because a beam that brightens
 * nothing it points at is a decal (the bowl's own rule).
 *
 * The four-part additive light discipline, all baked in:
 * - `fog: false` — fog on an additive mark brightens distance;
 * - ground fade in vertex colours against the caller's `ground` sampler
 *   (a beam must die before it lands or it lands as a hard wedge);
 * - edge-on fade — a crossed quad seen along its plane is a hairline;
 * - camera-distance fade, dead by ~120 m (verdant-2's round-6 lesson:
 *   `fog: false` marks never dim on their own).
 *
 * The whole beam family is ONE merged mesh (and the pools another), so
 * the per-blade fades cannot ride `material.opacity` the way the
 * regions' one-mesh-per-shaft versions do. They ride the vertex shader
 * instead: each vertex carries its mark's centre (and, for blades, the
 * blade-plane normal) as attributes, and a one-chunk patch computes the
 * edge-on and range fades from `cameraPosition` — zero per-frame CPU,
 * nothing for reduced motion to reduce, capture-deterministic.
 *
 * `slant` is first-class (verdant-2's diagonal blades): the head's
 * horizontal drift per metre of height, world XZ, applied as a shear
 * after the blade stands so the fades still read its true vertices.
 *
 * Budget note: 2 draws (merged blades + merged pools; 1 if either list
 * is empty). Triangles ≈ 336 per beam + 336 per pool — a six-beam call
 * is ~4k tris. Opacities are clamped to the spec cap 0.3 and carried in
 * vertex colours (`material.opacity` stays 1), so the cap is a property
 * of the buffers a test can read.
 */

export interface BeamSpec {
  /** Where the beam lands, world XZ — authored landings, never scatter. */
  readonly pos: readonly [number, number];
  /** Top of the beam, world Y. */
  readonly top: number;
  readonly width: number;
  /** Peak additive strength; clamped to the 0.3 cap. */
  readonly opacity: number;
  /** Head drift per metre of height, world XZ (verdant-2 semantics). */
  readonly slant?: readonly [number, number];
}

export interface PoolSpec {
  readonly pos: readonly [number, number];
  readonly radius: number;
  /** Peak additive strength; clamped to the 0.3 cap. */
  readonly opacity: number;
}

export interface BeamAndPoolOptions {
  readonly seed: number;
  /** sRGB hex — the light's colour; one tint for beam and pool alike. */
  readonly tint: number;
  readonly ground: GroundFn;
  readonly beams: readonly BeamSpec[];
  /** Omitted ⇒ one pool under every beam (the default the spec demands).
   *  Pass `[]` to suppress pools outright (the gate-veil column does). */
  readonly pools?: readonly PoolSpec[];
}

const OPACITY_CAP = 0.3;

/** Below the beam's landing the quad keeps going a little, then dies. */
const FOOT_DEPTH = 0.5;

/** The ground fade window, metres above the sampled floor. */
const GROUND_FADE_START = 0.15;
const GROUND_FADE_END = 1.8;

/** Edge-on fade window on |view · normal| (the LightShafts numbers). */
const EDGE_FADE_IN = 0.06;
const EDGE_FADE_OUT = 0.3;

/** Camera-distance fade: full to 70 m, dead by 120 m. */
const RANGE_FADE_FROM = 70;
const RANGE_FADE_TO = 120;

/** A derived pool covers this fraction of its beam's width. */
const POOL_SPREAD = 0.7;
/** And carries a little more strength than the beam, capped like it. */
const POOL_GAIN = 1.8;

const POOL_LIFT = 0.08;
const POOL_SPOKES = 28;
const POOL_RINGS = 6;
const POOL_RIM_FADE_FROM = 0.35;

/** One fixed stream for the shared sprites, apart from any caller seed. */
const SPRITE_SEED = 0xb0_5eed;

function smoothstep01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

let beamSpriteTexture: DataTexture | undefined;

/**
 * The blade's soft bell: verdant-1's shaft sprite with a longer head
 * ease. The regions' `(1 - v) * 5` head ramp is fine when a beam's top
 * is off-frame, but a kit beam gets photographed whole — that ramp put
 * its whole fade in the last fifth and the head read as a torch flame
 * with visible value steps. Easing over the top third (and flattening
 * the along-length power) keeps the ribbon even and the head airy.
 */
function beamSprite(): DataTexture {
  beamSpriteTexture ??= buildColorTexture(128, (u, v) => {
    // Nearly flat across the core, feathering over the outer half — the
    // bowl's "softness, not width, turns a shaft into a ribbon" lesson.
    const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.25);
    const head = smoothstep01((1 - v) / 0.38);
    // A floor under the along-length ramp: the lower stretch must stay
    // lit until the baked ground fade takes it, or the beam detaches
    // from its own pool and hangs in the water.
    const along = (0.45 + 0.55 * Math.pow(v, 1.2)) * head;
    const value = bell * along;
    return [value, value, value];
  });
  return beamSpriteTexture;
}

let poolSpriteTexture: DataTexture | undefined;

/** The pool's wobbled halo: verdant-1's pool sprite, module-owned. */
function poolSprite(): DataTexture {
  poolSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const wobble = fbm(u, v, { seed: SPRITE_SEED, period: 3, octaves: 2 });
    const rim = Math.hypot(u - 0.5, v - 0.5) * 2;
    const distance = Math.min(1, rim * (0.86 + 0.3 * wobble));
    const halo = Math.pow(Math.max(0, 1 - distance * distance), 2.4);
    return [halo, halo, halo];
  });
  return poolSpriteTexture;
}

/**
 * The vertex-shader half of the discipline. `withNormal` adds the
 * edge-on term (blades only); pools take the range fade alone.
 */
function patchMarkFades(withNormal: boolean) {
  return (shader: WebGLProgramParametersWithUniforms): void => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         attribute vec3 aMarkCenter;
         ${withNormal ? "attribute vec3 aBladeNormal;" : ""}`,
      )
      .replace(
        "#include <color_vertex>",
        `#include <color_vertex>
         {
           vec3 kitView = aMarkCenter - cameraPosition;
           float kitDist = length(kitView);
           float kitRange = 1.0 - smoothstep(${RANGE_FADE_FROM.toFixed(1)}, ${RANGE_FADE_TO.toFixed(1)}, kitDist);
           ${
             withNormal
               ? `float kitFacing = abs(dot(kitView / max(kitDist, 1e-4), aBladeNormal));
           float kitEdge = smoothstep(${EDGE_FADE_IN.toFixed(2)}, ${EDGE_FADE_OUT.toFixed(2)}, kitFacing);`
               : "float kitEdge = 1.0;"
           }
           vColor.rgb *= kitEdge * kitRange;
         }`,
      );
  };
}

/** Fills a constant vec3 attribute over every vertex of a geometry. */
function constantAttribute(geometry: BufferGeometry, name: string, value: Vector3): void {
  const count = geometry.attributes.position!.count;
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    data[i * 3] = value.x;
    data[i * 3 + 1] = value.y;
    data[i * 3 + 2] = value.z;
  }
  geometry.setAttribute(name, new BufferAttribute(data, 3));
}

export function buildBeamAndPool(options: BeamAndPoolOptions): KitBuild {
  const random = new Random(options.seed);
  const group = new Group();
  group.name = "kit-beam-and-pool";
  const tint = new Color(options.tint);

  const geometries: BufferGeometry[] = [];
  const materials: MeshBasicMaterial[] = [];
  let draws = 0;
  let triangles = 0;

  // ─── The blades ───────────────────────────────────────────────────────────
  const blades: BufferGeometry[] = [];
  for (const beam of options.beams) {
    const [x, z] = beam.pos;
    const foot = options.ground(x, z) - FOOT_DEPTH;
    const length = beam.top - foot;
    const centerY = (beam.top + foot) / 2;
    const turn = random.range(0, Math.PI / 2);
    const opacity = Math.min(beam.opacity, OPACITY_CAP);
    const slantX = beam.slant?.[0] ?? 0;
    const slantZ = beam.slant?.[1] ?? 0;

    const center = new Vector3(
      x + (centerY - foot) * slantX,
      centerY,
      z + (centerY - foot) * slantZ,
    );

    for (const spin of [0, Math.PI / 2]) {
      const blade = new PlaneGeometry(beam.width, length, 4, 20);
      const yaw = turn + spin + random.signed(0.12);
      blade.rotateY(yaw);
      blade.translate(x, centerY, z);

      // The diagonal: shear every vertex along the drift by its height
      // above the foot, AFTER the blade stands (verdant-2's move), so the
      // ground fade below reads the vertices the frame will actually see.
      const position = blade.attributes.position!;
      if (slantX !== 0 || slantZ !== 0) {
        for (let i = 0; i < position.count; i++) {
          const rise = position.getY(i) - foot;
          position.setX(i, position.getX(i) + rise * slantX);
          position.setZ(i, position.getZ(i) + rise * slantZ);
        }
      }

      // Ground fade × the beam's own strength, in vertex colours — the
      // merged material's opacity stays 1, so the cap lives in buffers.
      const colors = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        const above =
          position.getY(i) - options.ground(position.getX(i), position.getZ(i));
        const value =
          smoothstep01((above - GROUND_FADE_START) / (GROUND_FADE_END - GROUND_FADE_START)) *
          opacity;
        colors[i * 3] = value;
        colors[i * 3 + 1] = value;
        colors[i * 3 + 2] = value;
      }
      blade.setAttribute("color", new BufferAttribute(colors, 3));
      constantAttribute(blade, "aMarkCenter", center);
      constantAttribute(
        blade,
        "aBladeNormal",
        new Vector3(Math.sin(yaw), 0, Math.cos(yaw)),
      );
      blades.push(blade);
    }
  }

  if (blades.length > 0) {
    const merged = mergeGeometries(blades, false);
    for (const blade of blades) {
      blade.dispose();
    }
    if (!merged) {
      throw new Error("kit beam blades could not be merged");
    }
    merged.computeBoundingSphere();

    const material = new MeshBasicMaterial({
      map: beamSprite(),
      color: tint.clone(),
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      vertexColors: true,
      fog: false,
      // Three renders double-sided transparency in two passes since
      // r156; additive blending is commutative, so the second pass would
      // buy nothing and double the overdraw AND the honest call count.
      forceSinglePass: true,
    });
    material.onBeforeCompile = patchMarkFades(true);
    material.customProgramCacheKey = () => "kit-beam-fades";

    const mesh = new Mesh(merged, material);
    mesh.name = "kit-beams";
    mesh.renderOrder = 2;
    group.add(mesh);
    geometries.push(merged);
    materials.push(material);
    draws += 1;
    triangles += (merged.index?.count ?? 0) / 3;
  }

  // ─── The pools ────────────────────────────────────────────────────────────
  const pools =
    options.pools ??
    options.beams.map((beam) => ({
      pos: beam.pos,
      radius: beam.width * POOL_SPREAD,
      opacity: Math.min(beam.opacity * POOL_GAIN, OPACITY_CAP),
    }));

  const discs: BufferGeometry[] = [];
  for (const pool of pools) {
    const [x, z] = pool.pos;
    const opacity = Math.min(pool.opacity, OPACITY_CAP);
    const ring = new RingGeometry(0, pool.radius, POOL_SPOKES, POOL_RINGS);
    ring.rotateX(-Math.PI / 2);
    // Every pool shares one sprite; without a spin per pool the same
    // lumpy outline repeats. Baked before the dune fit, like the bowl's.
    ring.rotateY(random.range(0, Math.PI * 2));

    const position = ring.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const lx = position.getX(i);
      const lz = position.getZ(i);
      position.setY(i, options.ground(x + lx, z + lz) + POOL_LIFT);
      const edge =
        1 -
        smoothstep01((Math.hypot(lx, lz) / pool.radius - POOL_RIM_FADE_FROM) / (1 - POOL_RIM_FADE_FROM));
      const value = edge * opacity;
      colors[i * 3] = value;
      colors[i * 3 + 1] = value;
      colors[i * 3 + 2] = value;
    }
    position.needsUpdate = true;
    ring.setAttribute("color", new BufferAttribute(colors, 3));
    ring.translate(x, 0, z);
    constantAttribute(ring, "aMarkCenter", new Vector3(x, options.ground(x, z), z));
    discs.push(ring);
  }

  if (discs.length > 0) {
    const merged = mergeGeometries(discs, false);
    for (const disc of discs) {
      disc.dispose();
    }
    if (!merged) {
      throw new Error("kit light pools could not be merged");
    }
    merged.computeBoundingSphere();

    const material = new MeshBasicMaterial({
      map: poolSprite(),
      color: tint.clone(),
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      fog: false,
    });
    material.onBeforeCompile = patchMarkFades(false);
    material.customProgramCacheKey = () => "kit-pool-fades";

    const mesh = new Mesh(merged, material);
    mesh.name = "kit-light-pools";
    mesh.renderOrder = 1;
    group.add(mesh);
    geometries.push(merged);
    materials.push(material);
    draws += 1;
    triangles += (merged.index?.count ?? 0) / 3;
  }

  return {
    group,
    draws,
    triangles,
    dispose(): void {
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
      group.clear();
      group.removeFromParent();
    },
  };
}
