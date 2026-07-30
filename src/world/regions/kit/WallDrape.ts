import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random } from "../../../util/Random";
import type { KitBuild, KitPalette } from "./KitTypes";
import { RATIO_ONE, finishBuild, mixRatio, shadeRatio } from "./KitGroundShared";

/**
 * `wallDrapeBank` — KIT-SPEC §2.7. The answer to every wing audit's "bare
 * walls": strands drooping from wall anchors under an integrated arc (the
 * W-N2 rise/droop discipline — up out of the holdfast first, then over and
 * hanging), with 6-triangle encrusting pads flush to the wall between the
 * holdfasts.
 *
 * Budget note (asserted by tests/kitGround.test.ts): **2 draws** — one
 * merged strand mesh + one merged pad mesh, both world-space (the kelp
 * lesson: jointed hanging growth merges, never instances). 20 triangles
 * per strand, 6 per pad: 8 anchors × 5 strands + 3 pads each ≈ 950 tris.
 *
 * Sway rides the kelp's standing `aPhase`/`aReach` chunk: per-vertex reach
 * in metres (already scaled by `swayAmp`, squared toward the tip so the
 * holdfast is still), phase per strand, one closed-form time uniform for
 * the whole bank — capture-safe, zero when `swayAmp` is 0.
 *
 * Paint (law 3): the material colour owns the hue at the strand tips
 * (`palette.tip`); vertex colours darken down to `shade` at the roots.
 * Pads shade toward their centres.
 */

export interface DrapeAnchor {
  readonly pos: readonly [number, number, number];
  /** The wall's outward normal at the anchor, roughly horizontal. */
  readonly normal: readonly [number, number, number];
}

export interface WallDrapeBankOptions {
  readonly seed: number;
  readonly palette: KitPalette;
  readonly anchors: readonly DrapeAnchor[];
  /** Strands per holdfast. Default 5. */
  readonly strandsPerAnchor?: number;
  /** Strand length envelope centre, metres. Default 1.5. */
  readonly length?: number;
  /** Metres of tip sweep; 0 (default) builds fully static. */
  readonly swayAmp?: number;
}

export interface WallDrapeBuild extends KitBuild {
  /** Advances the sway to a simulated second count. No-op when static. */
  update(timeSec: number): void;
}

/** Strand rows: enough for the rise-and-droop to read as an arc. */
const STRAND_SEGMENTS = 5;
/** Pads per anchor, filling the wall between holdfasts. */
const PADS_PER_ANCHOR = 3;

/** Fallback root/centre shade: a deep sea-violet, never black. */
const DEFAULT_SHADE = 0x54506b;

export function buildWallDrapeBank(options: WallDrapeBankOptions): WallDrapeBuild {
  const random = new Random(options.seed);
  const strandsPerAnchor = Math.max(1, Math.round(options.strandsPerAnchor ?? 5));
  const length = options.length ?? 1.5;
  const swayAmp = options.swayAmp ?? 0;

  const topHex = options.palette.tip ?? options.palette.base;
  const rootRatio = shadeRatio(topHex, options.palette.shade ?? DEFAULT_SHADE);
  const padHex = options.palette.accent ?? options.palette.base;
  const padCentreRatio = shadeRatio(padHex, options.palette.shade ?? DEFAULT_SHADE);

  const strandParts: BufferGeometry[] = [];
  const padParts: BufferGeometry[] = [];
  for (const anchor of options.anchors) {
    const frame = wallFrame(anchor);
    for (let i = 0; i < strandsPerAnchor; i++) {
      strandParts.push(strandGeometry(random, anchor, frame, length, swayAmp, rootRatio));
    }
    for (let i = 0; i < PADS_PER_ANCHOR; i++) {
      padParts.push(padGeometry(random, anchor, frame, padCentreRatio));
    }
  }

  const strands = mergeGeometries(strandParts, false);
  const pads = mergeGeometries(padParts, false);
  for (const part of [...strandParts, ...padParts]) {
    part.dispose();
  }
  if (!strands || !pads) {
    throw new Error("wallDrapeBank: strands or pads could not be merged");
  }
  strands.computeBoundingSphere();
  pads.computeBoundingSphere();

  const sway = { value: 0 };
  const strandMaterial = createToonMaterial({
    color: topHex,
    vertexColors: true,
    side: DoubleSide,
  });
  if (swayAmp > 0) {
    strandMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uKitSway = sway;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uKitSway;
           attribute float aPhase;
           attribute float aReach;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           // The kelp chunk: reach is already metres at this vertex.
           float kitBend = sin(uKitSway * 0.52 + aPhase) * 0.62
                         + sin(uKitSway * 0.21 + aPhase * 1.7) * 0.38;
           transformed.x += kitBend * aReach * 0.82;
           transformed.z += kitBend * aReach * 0.46;`,
        );
    };
  }
  const padMaterial = createToonMaterial({ color: padHex, vertexColors: true });

  const strandMesh = new Mesh(strands, strandMaterial);
  strandMesh.name = "kit-wall-drape-strands";
  const padMesh = new Mesh(pads, padMaterial);
  padMesh.name = "kit-wall-drape-pads";

  const group = new Group();
  group.name = "kit-wall-drape-bank";
  group.add(strandMesh);
  group.add(padMesh);

  const build = finishBuild(group, [strands, pads, strandMaterial, padMaterial]);
  return {
    ...build,
    update(timeSec: number): void {
      sway.value = timeSec;
    },
  };
}

interface WallFrame {
  readonly out: Vector3;
  readonly side: Vector3;
  readonly up: Vector3;
}

/** Orthonormal frame off the anchor's normal: out of the wall, along it, up it. */
function wallFrame(anchor: DrapeAnchor): WallFrame {
  const out = new Vector3(...anchor.normal).normalize();
  const side = new Vector3().crossVectors(out, new Vector3(0, 1, 0));
  if (side.lengthSq() < 1e-6) {
    side.set(1, 0, 0);
  }
  side.normalize();
  const up = new Vector3().crossVectors(side, out).normalize();
  return { out, side, up };
}

/**
 * One strand: a tapered strap integrated along a rise-then-droop arc. The
 * bend angle starts above horizontal (growth reaches for light before
 * weight wins) and integrates down past vertical, so the tip hangs. Three
 * columns carry a cup so the ramp rolls a band across the strap.
 */
function strandGeometry(
  random: Random,
  anchor: DrapeAnchor,
  frame: WallFrame,
  lengthBase: number,
  swayAmp: number,
  rootRatio: readonly [number, number, number],
): BufferGeometry {
  const length = lengthBase * random.range(0.7, 1.25);
  const width = length * random.range(0.1, 0.15);
  const rise = random.range(0.3, 0.6);
  const droopTo = random.range(1.35, 1.75);
  const slip = random.signed(0.55);
  const phase = random.range(0, Math.PI * 2);
  const tone = random.range(0.85, 1.0);

  // The strand's own out direction: the wall normal yawed a little.
  const out = frame.out
    .clone()
    .multiplyScalar(Math.cos(slip))
    .addScaledVector(frame.side, Math.sin(slip))
    .normalize();
  const side = new Vector3().crossVectors(out, new Vector3(0, 1, 0)).normalize();

  const rows = STRAND_SEGMENTS + 1;
  const columns = 3;
  const positions = new Float32Array(rows * columns * 3);
  const colors = new Float32Array(rows * columns * 3);
  const phases = new Float32Array(rows * columns);
  const reaches = new Float32Array(rows * columns);
  const indices: number[] = [];

  const spine = new Vector3(...anchor.pos).addScaledVector(out, 0.02);
  const step = length / STRAND_SEGMENTS;
  const cursor = spine.clone();
  const point = new Vector3();

  for (let row = 0; row < rows; row++) {
    const t = row / STRAND_SEGMENTS;
    // Rise, then integrate over into the droop; past-vertical by the tip.
    const theta = rise - (rise + droopTo) * Math.pow(t, 1.45);
    const taper = 1 - t * 0.6;
    const cup = width * 0.4 * taper;
    for (let column = 0; column < columns; column++) {
      const across = (column - 1) * (width / 2) * taper;
      const dome = (1 - Math.abs(column - 1)) * cup;
      point
        .copy(cursor)
        .addScaledVector(side, across)
        .addScaledVector(out, dome * 0.4)
        .addScaledVector(frame.up, dome * 0.2);
      const at = (row * columns + column) * 3;
      positions[at] = point.x;
      positions[at + 1] = point.y;
      positions[at + 2] = point.z;
      const ratio = t < 0.55 ? mixRatio(rootRatio, RATIO_ONE, t / 0.55) : RATIO_ONE;
      colors[at] = ratio[0] * tone;
      colors[at + 1] = ratio[1] * tone;
      colors[at + 2] = ratio[2] * tone;
      phases[row * columns + column] = phase;
      // Squared toward the tip; already metres (the kelp contract).
      reaches[row * columns + column] = t * t * length * swayAmp;
    }
    if (row < STRAND_SEGMENTS) {
      for (let column = 0; column < columns - 1; column++) {
        const a = row * columns + column;
        indices.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1);
      }
    }
    // Advance the spine along the current bend angle.
    cursor.addScaledVector(out, Math.cos(theta) * step);
    cursor.y += Math.sin(theta) * step;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setAttribute("aPhase", new BufferAttribute(phases, 1));
  geometry.setAttribute("aReach", new BufferAttribute(reaches, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * One encrusting pad: a 6-triangle fan flush to the wall, domed a touch so
 * it catches the ramp, centre shaded toward the palette's `shade`.
 */
function padGeometry(
  random: Random,
  anchor: DrapeAnchor,
  frame: WallFrame,
  centreRatio: readonly [number, number, number],
): BufferGeometry {
  const radius = random.range(0.09, 0.2);
  const overSide = random.signed(0.42);
  const overUp = random.signed(0.34);
  const tone = random.range(0.85, 1.0);
  const spin = random.range(0, Math.PI * 2);

  const centre = new Vector3(...anchor.pos)
    .addScaledVector(frame.side, overSide)
    .addScaledVector(frame.up, overUp)
    .addScaledVector(frame.out, 0.025);

  const rim = 6;
  const positions = new Float32Array((rim + 1) * 3);
  const colors = new Float32Array((rim + 1) * 3);
  const indices: number[] = [];
  const point = new Vector3();

  positions[0] = centre.x + frame.out.x * radius * 0.3;
  positions[1] = centre.y + frame.out.y * radius * 0.3;
  positions[2] = centre.z + frame.out.z * radius * 0.3;
  colors[0] = centreRatio[0] * tone;
  colors[1] = centreRatio[1] * tone;
  colors[2] = centreRatio[2] * tone;

  for (let s = 0; s < rim; s++) {
    const theta = spin + (s / rim) * Math.PI * 2;
    const wobble = radius * (1 + Math.sin(theta * 3 + spin) * 0.18);
    point
      .copy(centre)
      .addScaledVector(frame.side, Math.cos(theta) * wobble)
      .addScaledVector(frame.up, Math.sin(theta) * wobble);
    positions[(s + 1) * 3] = point.x;
    positions[(s + 1) * 3 + 1] = point.y;
    positions[(s + 1) * 3 + 2] = point.z;
    colors[(s + 1) * 3] = tone;
    colors[(s + 1) * 3 + 1] = tone;
    colors[(s + 1) * 3 + 2] = tone;
    indices.push(0, s + 1, 1 + ((s + 1) % rim));
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
