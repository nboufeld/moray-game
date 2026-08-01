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
import { G2_SEEDS, smoothstep01 } from "./Golden2Shared";
import { CENTER_X, CENTER_Z, GOLDEN2_SLOT } from "./Golden2Terrain";

/**
 * The Carillon Waste's painted distance: stacked carved-mesa lines —
 * amber near, dusk-violet far — the `DistantReef` idiom in this
 * region's ink. The skyline is a slow swell of worn table-lands with
 * softly stepped shoulders, held to a stone's repose BY CONSTRUCTION
 * (the Hourglass Sea's round-7 relaxation pass, inherited whole: no
 * column step ever exceeds arc × 0.42, so nothing reads as masonry),
 * and each ring dissolves itself across 140–157 m of camera distance,
 * inside the game's 160 m clip (the pilot's far-plane lesson,
 * inherited).
 *
 * The rings part over BOTH pass corridors (MASTER R4, legislated for
 * every pass): a wide gap over the inbound Shore Road azimuth — the
 * approach's own walls close that view — and a second, narrower gap
 * over the spoke's outbound azimuth, where golden-waste-3's pass is
 * RESERVED: when the depth-3 sibling builds, its gate composition can
 * live past these rings without a cut (the Emerald Gate lesson, paid
 * at authoring time).
 */

interface MesaLayer {
  readonly radius: number;
  readonly ridgeBase: number;
  readonly ridgeVary: number;
  readonly fade: number;
  readonly ink: Color;
}

const LAYERS: readonly MesaLayer[] = [
  // Amber near…
  { radius: 246, ridgeBase: 10, ridgeVary: 4.4, fade: 0.34, ink: new Color(0.88, 0.7, 0.44) },
  { radius: 264, ridgeBase: 15, ridgeVary: 5.8, fade: 0.52, ink: new Color(0.74, 0.56, 0.56) },
  // …dusk-violet far.
  { radius: 286, ridgeBase: 23, ridgeVary: 7.4, fade: 0.66, ink: new Color(0.6, 0.46, 0.68) },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the shelf can show. */
const FOOT = -14;

/** Half-angle of the gap over the inbound Shore Road corridor. */
const GAP_IN_HALF = 0.4;
/** Half-angle of the gap reserving the outbound depth-3 corridor.
 *  Narrowed in round 2: 0.3 rad parts ~72 m of skyline at the ring —
 *  the whole Sunset Shelf vista fell into its own reservation. 0.17
 *  still clears the future tongue's width with margin. */
const GAP_OUT_HALF = 0.17;

export function buildGolden2Distance(): { meshes: Mesh[] } {
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
      color: new Color(0x9a8468).lerp(new Color(0x9a8468).multiply(layer.ink), 1 - layer.fade),
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
    material.customProgramCacheKey = () => "carillon-distance-dissolve";
    const geometry = mesaRing(layer, SEEDS.regionGolden2 ^ (G2_SEEDS.distance + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `carillon-distance-${index}`;
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
 * One ring: a curtain whose top edge is a slow mesa swell — worn
 * table-lands with softly stepped shoulders, no verticals, both pass
 * sectors skipped with long end tapers.
 */
function mesaRing(layer: MesaLayer, noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const gapIn = GOLDEN2_SLOT.azimuth + Math.PI;
  const gapOut = GOLDEN2_SLOT.azimuth;

  // First pass: the drawn skyline, one ridge height per column. Mesa
  // country: long level-ish tables (a flattened sine) over a slow
  // drifting base, seamed nowhere.
  const ridges = new Float32Array(SEGMENTS + 1);
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const roll =
      fbm(t * 11, layer.radius * 0.013, { seed: noiseSeed, period: 11, octaves: 3 }) - 0.5;
    // The table read: clip the swell's crests so runs of skyline hold
    // near-level before falling away — carved, not blown.
    const wave =
      Math.sin(t * Math.PI * 2 * 13 + roll * 3) * 0.6 +
      Math.sin(t * Math.PI * 2 * 5 + (noiseSeed % 7)) * 0.4;
    const table = Math.min(0.72, wave) / 0.72;
    const base = layer.ridgeBase * (0.84 + 0.32 * Math.sin(t * Math.PI * 2 * 3 + (noiseSeed % 5)));
    ridges[i] = base + (roll * 1.6 + table) * layer.ridgeVary;
  }

  // The repose relaxation (the pilot's round-7 fix, kept whole): cap
  // every column step at arc × 0.42 in both directions so no shoulder
  // ever reads as the vertical edge of a building.
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
    // Long tapers into both gaps (short ramps read as buildings).
    const end =
      smoothstep01((offIn - GAP_IN_HALF) / 1.3) * smoothstep01((offOut - GAP_OUT_HALF) / 1.1);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    // Three rows: opaque foot, near-opaque shoulder, transparent crest.
    const top = FOOT + Math.max(1.4, ridges[i]! - FOOT) * end + 0.2;
    const mid = FOOT + (top - FOOT) * 0.72;
    positions.push(x, FOOT, z, x, mid, z, x, top, z);
    colors.push(1, 1, 1, 0.95, 1, 1, 1, 0.85, 1, 1, 1, 0);
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
