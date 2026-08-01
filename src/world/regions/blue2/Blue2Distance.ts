import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FogExp2,
  Mesh,
  MeshBasicMaterial,
  type Scene,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { SEEDS } from "../../../util/Random";
import { B2_SEEDS, smoothstep01 } from "./Blue2Shared";
import { BLUE2_SLOT, CENTER_X, CENTER_Z } from "./Blue2Terrain";

/**
 * The Deep Steps' painted distance: the amphitheatre going on — ridge
 * upon violet ridge of further shelf-country, each a step paler (the
 * Drop Plains' round-9 ink law inherited whole: near-neutral violets,
 * red a nose above green, level with blue — NEVER cobalt, and never
 * maroon). The skyline is long and reposeful (the Carillon's repose
 * relaxation kept: no column step exceeds arc × 0.42), and each ring
 * dissolves itself across 140–157 m of camera distance, inside the
 * 160 m clip.
 *
 * The rings part over BOTH corridors (MASTER R4): a wide gap over the
 * inbound World's-Edge azimuth — the Drop Plains' own painted deep
 * owns that view — and a narrow gap with a SHORT taper (the Carillon's
 * joint-constraint arithmetic, inherited: 0.16, so the flanks stand
 * opaque inside the dissolve window) over the outbound azimuth where
 * great-blue-3's pass is RESERVED.
 */

interface StepLayer {
  readonly radius: number;
  readonly ridgeBase: number;
  readonly ridgeVary: number;
  readonly fade: number;
  readonly ink: Color;
}

const LAYERS: readonly StepLayer[] = [
  { radius: 246, ridgeBase: 12, ridgeVary: 4.2, fade: 0.3, ink: new Color(0.72, 0.6, 0.78) },
  { radius: 265, ridgeBase: 18, ridgeVary: 5.6, fade: 0.5, ink: new Color(0.82, 0.7, 0.86) },
  { radius: 288, ridgeBase: 26, ridgeVary: 7.2, fade: 0.66, ink: new Color(0.92, 0.82, 0.94) },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the amphitheatre can show. */
const FOOT = -56;

/** Half-angle of the gap over the inbound World's-Edge corridor. */
const GAP_IN_HALF = 0.4;
/** Half-angle of the gap reserving the outbound depth-3 corridor. */
const GAP_OUT_HALF = 0.17;

/** Foot/crown tints: a curtain is never one value (the canyon-curtain
 *  lesson) — feet fall toward the deep's violet, crowns go milky. */
const FOOT_TINT: readonly [number, number, number] = [0.52, 0.52, 0.68];
const MID_TINT: readonly [number, number, number] = [0.85, 0.82, 0.92];
const CROWN_TINT: readonly [number, number, number] = [1.14, 1.1, 1.06];

export function buildBlue2Distance(): { meshes: Mesh[] } {
  const meshes: Mesh[] = [];
  const materials: MeshBasicMaterial[] = [];
  let lastFog = -1;

  const followFog = (scene: Scene): void => {
    const fog = scene.fog;
    if (!(fog instanceof FogExp2)) {
      return;
    }
    const hex = fog.color.getHex();
    if (hex === lastFog) {
      return;
    }
    lastFog = hex;
    for (const [index, layer] of LAYERS.entries()) {
      const ink = fog.color.clone().multiply(layer.ink);
      materials[index]?.color.copy(ink).lerp(fog.color, layer.fade);
    }
  };

  for (const [index, layer] of LAYERS.entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x6f6a90).lerp(new Color(0x6f6a90).multiply(layer.ink), 1 - layer.fade),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    // The self-dissolve: alpha to zero across 140–157 m of camera
    // distance, safely inside the 160 m clip.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vRingDist;")
        .replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvRingDist = -mvPosition.z;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vRingDist;")
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(140.0, 157.0, vRingDist);",
        );
    };
    material.customProgramCacheKey = () => "blue2-distance-dissolve";
    const geometry = stepRing(layer, SEEDS.regionBlue2 ^ (B2_SEEDS.distance + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `deepsteps-distance-${index}`;
    mesh.renderOrder = -(index + 1) - 2;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  return { meshes };
}

/**
 * One ring: a curtain whose top edge is a slow shelf-country swell —
 * long level runs falling away in soft shoulders, both pass sectors
 * skipped (long taper in, short taper out).
 */
function stepRing(layer: StepLayer, noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const gapIn = BLUE2_SLOT.azimuth + Math.PI;
  const gapOut = BLUE2_SLOT.azimuth;

  const ridges = new Float32Array(SEGMENTS + 1);
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const roll =
      fbm(t * 11, layer.radius * 0.013, { seed: noiseSeed, period: 11, octaves: 3 }) - 0.5;
    // Shelf country: clipped crests hold near-level runs before the
    // fall — steps, not peaks.
    const wave =
      Math.sin(t * Math.PI * 2 * 11 + roll * 3) * 0.6 +
      Math.sin(t * Math.PI * 2 * 4 + (noiseSeed % 7)) * 0.4;
    const table = Math.min(0.68, wave) / 0.68;
    const base = layer.ridgeBase * (0.86 + 0.28 * Math.sin(t * Math.PI * 2 * 3 + (noiseSeed % 5)));
    ridges[i] = base + (roll * 1.5 + table) * layer.ridgeVary;
  }

  // The repose relaxation: cap every column step at arc × 0.42.
  const arc = (Math.PI * 2 * layer.radius) / SEGMENTS;
  const maxStep = arc * 0.42;
  for (let i = 1; i <= SEGMENTS; i++) {
    ridges[i] = Math.min(ridges[i]!, ridges[i - 1]! + maxStep);
  }
  for (let i = SEGMENTS - 1; i >= 0; i--) {
    ridges[i] = Math.min(ridges[i]!, ridges[i + 1]! + maxStep);
  }
  ridges[0] = ridges[SEGMENTS] = Math.min(ridges[0]!, ridges[SEGMENTS]!);

  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const offIn = angleBetween(theta, gapIn);
    const offOut = angleBetween(theta, gapOut);
    if (offIn < GAP_IN_HALF || offOut < GAP_OUT_HALF) {
      column = 0;
      continue;
    }
    const end =
      smoothstep01((offIn - GAP_IN_HALF) / 1.3) * smoothstep01((offOut - GAP_OUT_HALF) / 0.16);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    // Three rows: violet foot, lit shoulder, dissolved milky crest.
    const top = FOOT + Math.max(1.4, ridges[i]! - FOOT) * end + 0.2;
    const mid = FOOT + (top - FOOT) * 0.7;
    positions.push(x, FOOT, z, x, mid, z, x, top, z);
    colors.push(...FOOT_TINT, 0.95, ...MID_TINT, 0.85, ...CROWN_TINT, 0);
    if (column > 0) {
      const a = positions.length / 3 - 6;
      indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
      indices.push(a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
    }
    column++;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}
