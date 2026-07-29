import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  Sphere,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { requestAlbedo } from "../../rendering/AssetLibrary";
import { createToonMaterial } from "../../rendering/ToonShading";
import { Random, SEEDS } from "../../util/Random";
import type { LifeContext } from "../life/LifeSystem";
import { VisitorBase } from "./VisitorBase";
import { BankedArc } from "./VisitorPath";

/** Wingspan half-width and the shape numbers the outline is drawn from. */
const HALF_SPAN = 1.15;
const CHORD = 1.22;
const SWEEP = 0.35;
const THICKNESS = 0.1;
/** Grid resolution: enough for the undulation to bend through, no more. */
const SPAN_SEGMENTS = 16;
const CHORD_SEGMENTS = 6;
const TAIL_LENGTH = 1.35;

const RAY_SCALE = 1.2;

const ARC_COUNT = 3;
const ARC_RANGES = {
  entryRadius: 27,
  heightMin: 6.5,
  heightMax: 9.0,
  bow: 9,
  speed: 1.3,
  bank: 0.42,
} as const;

/** Wing beat: radians of vertical travel per unit of reach, and its tempo. */
const WING_AMP = 0.14;
const WING_HZ = 0.38;

/**
 * The undulation, injected the way the grass sway is: a travelling wave down
 * the wing whose amplitude grows with reach, plus a slower whip along the
 * tail filament. A module constant because three keys its program cache on
 * `onBeforeCompile.toString()` — every material here compiles one program.
 */
const WING_CHUNK = `#include <begin_vertex>
  float reach = abs(position.x) / ${HALF_SPAN.toFixed(2)};
  transformed.y += sin(uRayTime - reach * 2.6) * uRayAmp * pow(reach, 1.6);
  float tail = max(0.0, -position.z - ${(CHORD * 0.5).toFixed(2)});
  transformed.x += sin(uRayTime * 0.7 - tail * 2.0) * 0.05 * tail;`;

/**
 * The calm rarity: an eagle ray gliding higher in the column than anything
 * else swims, wings rolling in slow waves. The body is authored here — a
 * lens-sectioned diamond, painted topside (`ray-topside.png`) over a pale
 * belly — because no GLB exists for it and a smooth wing plane is exactly
 * what a procedural build is good at.
 */
export class Ray extends VisitorBase {
  private readonly arcs: BankedArc[] = [];
  private passIndex = 0;
  private arc: BankedArc;

  private readonly uTime = { value: 0 };
  private readonly uAmp = { value: WING_AMP };
  private readonly scratch = new Vector3();

  constructor(seed: number = SEEDS.visitors) {
    super("ray", seed, "ray");
    const pathRandom = new Random(SEEDS.rayPath);
    for (let i = 0; i < ARC_COUNT; i++) {
      this.arcs.push(new BankedArc(pathRandom, ARC_RANGES));
    }
    this.arc = this.arcs[0]!;

    const topMaterial = this.own(createToonMaterial({ color: 0x51606f }));
    const bellyMaterial = this.own(createToonMaterial({ color: 0xe6e0cd }));
    // Double-sided: the tail is a flat ribbon and the camera lives below it.
    const tailMaterial = this.own(createToonMaterial({ color: 0x3d4a56, side: DoubleSide }));
    for (const material of [topMaterial, bellyMaterial, tailMaterial]) {
      material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
        shader.uniforms.uRayTime = this.uTime;
        shader.uniforms.uRayAmp = this.uAmp;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
             uniform float uRayTime;
             uniform float uRayAmp;`,
          )
          .replace("#include <begin_vertex>", WING_CHUNK);
      };
    }
    requestAlbedo("creatures/ray-topside.png", (texture) => {
      topMaterial.map = texture;
      topMaterial.color.set(0xffffff);
      topMaterial.needsUpdate = true;
    });

    const wing = new Mesh(this.own(buildWingGeometry()), [topMaterial, bellyMaterial]);
    // The shader wave travels outside the static bounds; give culling room.
    wing.geometry.boundingSphere = new Sphere(new Vector3(0, 0, -0.1), HALF_SPAN + 0.5);
    this.root.add(wing);

    const tail = new Mesh(this.own(buildTailGeometry()), tailMaterial);
    tail.geometry.boundingSphere = new Sphere(new Vector3(0, 0, -CHORD * 0.5 - TAIL_LENGTH * 0.5), TAIL_LENGTH);
    this.root.add(tail);

    this.root.scale.setScalar(RAY_SCALE);
  }

  protected override onPassStarted(): void {
    this.arc = this.arcs[this.passIndex % this.arcs.length]!;
    this.passIndex++;
  }

  protected advancePass(_dt: number, ctx: LifeContext): void {
    const s = this.passTime / this.arc.duration;
    if (s >= 1) {
      this.endPass();
      return;
    }

    this.arc.positionAt(s, this.root.position);
    this.arc.tangentAt(s, this.scratch);
    const horizontal = Math.hypot(this.scratch.x, this.scratch.z);
    this.root.rotation.set(
      // A ray stays flatter along its path than a turtle does.
      -Math.atan2(this.scratch.y, horizontal) * 0.5,
      Math.atan2(this.scratch.x, this.scratch.z),
      this.arc.bankAt(s) * (ctx.reducedMotion ? 0.5 : 1),
      "YXZ",
    );

    this.uTime.value = this.passTime * WING_HZ * Math.PI * 2;
    this.uAmp.value = WING_AMP * (ctx.reducedMotion ? 0.5 : 1);
  }
}

/** Chord length across the span; wings close to a point at the tips. */
function chordAt(u: number): number {
  return CHORD * Math.pow(1 - Math.abs(u), 0.75) + 0.02;
}

/** Mid-chord line; the wings sweep back as they reach. */
function midlineAt(u: number): number {
  return -SWEEP * Math.pow(Math.abs(u), 1.3);
}

/** Lens thickness: fattest over the body, feathering to nothing at edges. */
function thicknessAt(u: number, v: number): number {
  const spanwise = Math.pow(1 - u * u, 2);
  return THICKNESS * spanwise * Math.sin(Math.PI * Math.min(1, Math.max(0, v)));
}

/**
 * Two stitched sheets — a mapped top and a pale belly — sharing one rim, as
 * two geometry groups so the diamond is one mesh with two materials. Built
 * once per ray; the undulation never touches these buffers.
 */
function buildWingGeometry(): BufferGeometry {
  const rows = CHORD_SEGMENTS + 1;
  const cols = SPAN_SEGMENTS + 1;
  const sheetVerts = rows * cols;

  const positions = new Float32Array(sheetVerts * 2 * 3);
  const uvs = new Float32Array(sheetVerts * 2 * 2);

  for (let side = 0; side < 2; side++) {
    const top = side === 0;
    for (let j = 0; j < rows; j++) {
      const v = j / CHORD_SEGMENTS;
      for (let i = 0; i < cols; i++) {
        const u = -1 + (2 * i) / SPAN_SEGMENTS;
        const chord = chordAt(u);
        const index = side * sheetVerts + j * cols + i;
        positions[index * 3] = u * HALF_SPAN;
        // The belly is flatter than the back, the way a wing section is.
        positions[index * 3 + 1] = thicknessAt(u, v) * (top ? 0.7 : -0.4);
        positions[index * 3 + 2] = midlineAt(u) + chord * 0.5 - v * chord;
        uvs[index * 2] = (u + 1) / 2;
        uvs[index * 2 + 1] = v;
      }
    }
  }

  const indices: number[] = [];
  for (let side = 0; side < 2; side++) {
    const base = side * sheetVerts;
    for (let j = 0; j < CHORD_SEGMENTS; j++) {
      for (let i = 0; i < SPAN_SEGMENTS; i++) {
        const a = base + j * cols + i;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        if (side === 0) {
          indices.push(a, c, b, b, c, d);
        } else {
          // Wound the other way so the belly faces down.
          indices.push(a, b, c, b, d, c);
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const perSheet = SPAN_SEGMENTS * CHORD_SEGMENTS * 6;
  geometry.addGroup(0, perSheet, 0);
  geometry.addGroup(perSheet, perSheet, 1);
  geometry.computeVertexNormals();
  return geometry;
}

/** The whip: a flat tapering ribbon trailing off the body's tail root. */
function buildTailGeometry(): BufferGeometry {
  const segments = 5;
  const rootZ = -CHORD * 0.5;
  const positions = new Float32Array((segments + 1) * 2 * 3);
  for (let j = 0; j <= segments; j++) {
    const t = j / segments;
    const width = 0.05 * (1 - t) + 0.008;
    const z = rootZ - t * TAIL_LENGTH;
    positions[(j * 2) * 3] = -width;
    positions[(j * 2) * 3 + 1] = 0;
    positions[(j * 2) * 3 + 2] = z;
    positions[(j * 2 + 1) * 3] = width;
    positions[(j * 2 + 1) * 3 + 1] = 0;
    positions[(j * 2 + 1) * 3 + 2] = z;
  }
  const indices: number[] = [];
  for (let j = 0; j < segments; j++) {
    const a = j * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
