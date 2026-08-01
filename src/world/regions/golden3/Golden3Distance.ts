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
import { G3_SEEDS, smoothstep01 } from "./Golden3Shared";
import { CENTER_X, CENTER_Z, GOLDEN3_SLOT } from "./Golden3Terrain";

/**
 * The Vesper Strand's painted distance — THE FINAL HORIZON. This is
 * the province's terminus: no further pass to reserve, so the far pole
 * belongs to the one painting the whole spoke has been promising —
 * THE SUNSET. The composition, far to near:
 *
 * - **The glow band** (rc 224): a curtain of evening sky standing past
 *   the world's last wall — amber at its foot through rose to violet
 *   at its dissolved top.
 * - **THE SUN** (rc 218): the setting disc itself, a painted near-white
 *   core falling off to amber, standing half into the glow band —
 *   sized so the Sun's Door frames it whole from the balcony.
 * - **The cloud bars** (rc 214): two long violet-rose bars crossing
 *   the sun, alpha-soft at both ends.
 * - **THE LAST ISLES** (rc 210): three low mesa silhouettes in dark
 *   warm violet — the last lands, unreachable by construction.
 * - **The flank rings** (rc 246/268): the province's carved mesa-line
 *   idiom carried to its end on both flanks, parting over the inbound
 *   pass corridor (MASTER R4) and over the whole sunset sector.
 *
 * All of it follows the DistantReef discipline: `fog: false`, inks
 * self-mixed toward `scene.fog` so any mood reaches them, alpha
 * self-dissolve across 140–157 m of camera distance (inside the 160 m
 * clip), drooped seeded skylines, depthWrite off, honest bounds. The
 * radii are chosen by the sightline arithmetic the province's ledgers
 * demand: from the Sun's Door balcony (rc ≈ 137) the sun stands ~81 m
 * out — fully opaque; from mid-basin it has dissolved before the fog
 * could flatten it. The reward is the walk.
 */

const SEED = SEEDS.regionGolden3;

interface MesaLayer {
  readonly radius: number;
  readonly ridgeBase: number;
  readonly ridgeVary: number;
  readonly fade: number;
  readonly ink: Color;
}

const LAYERS: readonly MesaLayer[] = [
  { radius: 246, ridgeBase: 15, ridgeVary: 4.6, fade: 0.36, ink: new Color(0.9, 0.68, 0.44) },
  { radius: 268, ridgeBase: 21, ridgeVary: 6.0, fade: 0.56, ink: new Color(0.68, 0.5, 0.62) },
];

const SEGMENTS = 220;
/** The curtains' feet, below every floor the rampart can show. */
const FOOT = -14;

/** Half-angle of the gap over the inbound pass corridor. */
const GAP_IN_HALF = 0.4;
/** Half-angle of the sunset sector at the outbound pole — the far
 *  pole's whole sky belongs to the sun. */
const SUNSET_HALF = 0.55;
/** Short end tapers (the province's round-4 lesson: a long taper
 *  suppresses the skyline exactly where the vista poses look). */
const TAPER = 0.16;

/** The self-dissolve window, metres of camera distance. */
const DISSOLVE_FROM = 140;
const DISSOLVE_TO = 157;

function dissolveMaterial(color: Color, cacheKey: string): MeshBasicMaterial {
  const material = new MeshBasicMaterial({
    color,
    fog: false,
    side: DoubleSide,
    toneMapped: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vRingDist;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvRingDist = -mvPosition.z;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vRingDist;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(${DISSOLVE_FROM.toFixed(1)}, ${DISSOLVE_TO.toFixed(1)}, vRingDist);`,
      );
  };
  material.customProgramCacheKey = () => cacheKey;
  return material;
}

export function buildGolden3Distance(): { meshes: Mesh[] } {
  const meshes: Mesh[] = [];

  // Every material's ink self-mixes toward the live fog colour, so the
  // mood reaches the painting (the DistantReef discipline).
  const followers: { material: MeshBasicMaterial; ink: Color; fade: number }[] = [];
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
    for (const follower of followers) {
      const ink = fog.color.clone().multiply(follower.ink);
      follower.material.color.copy(ink).lerp(fog.color, follower.fade);
    }
  };

  const keep = (
    geometry: BufferGeometry,
    ink: Color,
    fade: number,
    name: string,
    order: number,
  ): Mesh => {
    const material = dissolveMaterial(
      new Color(0x9a8468).lerp(new Color(0x9a8468).multiply(ink), 1 - fade),
      "vesper-distance-dissolve",
    );
    followers.push({ material, ink, fade });
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = name;
    mesh.renderOrder = order;
    meshes.push(mesh);
    return mesh;
  };

  // ── The flank rings ──────────────────────────────────────────────────────
  for (const [index, layer] of LAYERS.entries()) {
    keep(
      mesaRing(layer, SEED ^ (G3_SEEDS.distance + index * 131)),
      layer.ink,
      layer.fade,
      `vesper-distance-${index}`,
      -(index + 1) - 6,
    );
  }

  // ── THE SUNSET ───────────────────────────────────────────────────────────
  keep(
    sunsetBand(SEED ^ G3_SEEDS.sunset),
    new Color(1.05, 0.72, 0.5),
    0.3,
    "vesper-sunset-band",
    -6,
  );
  keep(sunDisc(), new Color(1.35, 1.1, 0.72), 0.08, "vesper-sun", -5);
  keep(cloudBars(SEED ^ (G3_SEEDS.sunset + 7)), new Color(0.62, 0.44, 0.62), 0.42, "vesper-cloud-bars", -4);
  keep(
    lastIsles(SEED ^ (G3_SEEDS.sunset + 13)),
    new Color(0.52, 0.38, 0.56),
    0.4,
    "vesper-last-isles",
    -3,
  );

  // One follower drives them all.
  meshes[0]!.onBeforeRender = (_renderer, scene) => followFog(scene);

  return { meshes };
}

// ─── The pieces ──────────────────────────────────────────────────────────────

function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}

/** World angle of the outbound (sunset) pole from the disc's centre. */
const SUNSET_THETA = GOLDEN3_SLOT.azimuth;
/** World angle of the inbound corridor from the disc's centre. */
const INBOUND_THETA = GOLDEN3_SLOT.azimuth + Math.PI;

/**
 * One flank ring: a curtain whose top edge is a slow mesa swell — worn
 * table-lands with softly stepped shoulders (the province's repose
 * relaxation kept whole: no column step ever exceeds arc × 0.42), both
 * gaps skipped with short end tapers.
 */
function mesaRing(layer: MesaLayer, noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const ridges = new Float32Array(SEGMENTS + 1);
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const roll =
      fbm(t * 11, layer.radius * 0.013, { seed: noiseSeed, period: 11, octaves: 3 }) - 0.5;
    const wave =
      Math.sin(t * Math.PI * 2 * 13 + roll * 3) * 0.6 +
      Math.sin(t * Math.PI * 2 * 5 + (noiseSeed % 7)) * 0.4;
    const table = Math.min(0.72, wave) / 0.72;
    const base = layer.ridgeBase * (0.84 + 0.32 * Math.sin(t * Math.PI * 2 * 3 + (noiseSeed % 5)));
    ridges[i] = base + (roll * 1.6 + table) * layer.ridgeVary;
  }

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
    const offIn = angleBetween(theta, INBOUND_THETA);
    const offOut = angleBetween(theta, SUNSET_THETA);
    if (offIn < GAP_IN_HALF || offOut < SUNSET_HALF) {
      column = 0;
      continue;
    }
    const end =
      smoothstep01((offIn - GAP_IN_HALF) / 1.3) * smoothstep01((offOut - SUNSET_HALF) / TAPER);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

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

  return curtain(positions, colors, indices);
}

/** The evening sky: a curtain across the sunset sector, amber foot to
 *  a violet-rose dissolved crest, brightest on the sun's own axis. */
function sunsetBand(noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const radius = 224;
  const steps = 44;
  const half = SUNSET_HALF + 0.24;
  let column = 0;

  for (let i = 0; i <= steps; i++) {
    const off = -half + (i / steps) * half * 2;
    const theta = SUNSET_THETA + off;
    const x = CENTER_X + Math.cos(theta) * radius;
    const z = CENTER_Z + Math.sin(theta) * radius;
    // The band's crest droops away from the sun's axis and wanders.
    const axial = 1 - smoothstep01((Math.abs(off) - 0.08) / (half - 0.08));
    const wander =
      (fbm(i * 0.13, 0.4, { seed: noiseSeed, period: 6, octaves: 2 }) - 0.5) * 2.2;
    const top = 4 + axial * 9 + wander;
    const mid = FOOT + (top - FOOT) * 0.6;
    const end = smoothstep01((half - Math.abs(off)) / 0.2);
    // Amber at the foot near the axis, rose-violet off-axis and up.
    positions.push(x, FOOT, z, x, mid, z, x, top, z);
    const warmth = 0.55 + axial * 0.45;
    colors.push(
      warmth, warmth * 0.82, 0.62, 0.9 * end,
      warmth, warmth * 0.78, 0.72, 0.62 * end,
      0.72, 0.6, 0.86, 0,
    );
    if (column > 0) {
      const a = positions.length / 3 - 6;
      indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
      indices.push(a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
    }
    column++;
  }

  return curtain(positions, colors, indices);
}

/**
 * THE SUN — the setting disc, painted: a near-white core falling off
 * through gold to a soft amber rim, standing half-sunk into the band's
 * glow at the world's edge. A fan of triangles with per-vertex alpha:
 * core 1, rim 0 — a light in paint, far under any bloom.
 */
function sunDisc(): BufferGeometry {
  const radius = 218;
  const x = CENTER_X + Math.cos(SUNSET_THETA) * radius;
  const z = CENTER_Z + Math.sin(SUNSET_THETA) * radius;
  const r = 11;
  const cy = 8;
  // The disc faces the region: its plane is perpendicular to the
  // sunset axis, spanned by the lateral direction and +y.
  const lx = -Math.sin(SUNSET_THETA);
  const lz = Math.cos(SUNSET_THETA);

  const positions: number[] = [x, cy, z];
  const colors: number[] = [1, 1, 1, 1];
  const indices: number[] = [];
  const spokes = 26;
  for (let i = 0; i <= spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const px = x + lx * Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    const pz = z + lz * Math.cos(a) * r;
    positions.push(px, py, pz);
    // The rim leans amber and dissolves.
    colors.push(1, 0.82, 0.6, 0);
    if (i > 0) {
      indices.push(0, i, i + 1);
    }
  }
  // A second, tighter ring of full-strength core so the centre holds a
  // readable disc rather than a single hot point.
  const coreStart = positions.length / 3;
  for (let i = 0; i <= spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const px = x + lx * Math.cos(a) * r * 0.45;
    const py = cy + Math.sin(a) * r * 0.45;
    const pz = z + lz * Math.cos(a) * r * 0.45;
    positions.push(px, py, pz);
    colors.push(1, 0.97, 0.86, 1);
    if (i > 0) {
      indices.push(0, coreStart + i, coreStart + i + 1);
    }
  }

  return curtain(positions, colors, indices);
}

/** Two long violet-rose bars crossing the sun, alpha-soft at the ends. */
function cloudBars(noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const radius = 214;
  const lx = -Math.sin(SUNSET_THETA);
  const lz = Math.cos(SUNSET_THETA);
  const cx = CENTER_X + Math.cos(SUNSET_THETA) * radius;
  const cz = CENTER_Z + Math.sin(SUNSET_THETA) * radius;

  for (const [b, bar] of [
    { y: 11.5, halfLen: 36, thick: 1.5, shift: -6 },
    { y: 16.5, halfLen: 26, thick: 1.1, shift: 9 },
  ].entries()) {
    const steps = 16;
    const start = positions.length / 3;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const along = (t * 2 - 1) * bar.halfLen + bar.shift;
      const sag =
        (fbm(t * 3 + b * 5, 0.3, { seed: noiseSeed, period: 4, octaves: 2 }) - 0.5) * 1.6;
      const px = cx + lx * along;
      const pz = cz + lz * along;
      const soft = smoothstep01((1 - Math.abs(t * 2 - 1)) / 0.35);
      positions.push(px, bar.y + sag - bar.thick, pz, px, bar.y + sag + bar.thick, pz);
      colors.push(1, 1, 1, 0.85 * soft, 1, 1, 1, 0.2 * soft);
      if (i > 0) {
        const a = start + (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }

  return curtain(positions, colors, indices);
}

/** The Last Isles: three low mesa silhouettes flanking the sun. */
function lastIsles(noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const radius = 210;

  for (const [n, isle] of [
    { off: -0.34, halfWidth: 0.09, top: 9 },
    { off: 0.28, halfWidth: 0.11, top: 7 },
    { off: 0.44, halfWidth: 0.06, top: 10.5 },
  ].entries()) {
    const steps = 12;
    let column = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const theta = SUNSET_THETA + isle.off + (t * 2 - 1) * isle.halfWidth;
      const x = CENTER_X + Math.cos(theta) * radius;
      const z = CENTER_Z + Math.sin(theta) * radius;
      const table =
        smoothstep01(t / 0.28) * (1 - smoothstep01((t - 0.72) / 0.28));
      const wobble =
        (fbm(t * 4 + n * 3, 0.6, { seed: noiseSeed, period: 5, octaves: 2 }) - 0.5) * 1.8;
      const top = FOOT + (isle.top - FOOT) * table + wobble * table;
      positions.push(x, FOOT, z, x, top, z);
      colors.push(1, 1, 1, 0.92, 1, 1, 1, 0.05);
      if (column > 0) {
        const a = positions.length / 3 - 4;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      column++;
    }
  }

  return curtain(positions, colors, indices);
}

function curtain(positions: number[], colors: number[], indices: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
