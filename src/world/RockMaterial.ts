import { BufferAttribute, MeshStandardMaterial, type BufferGeometry } from "three";
import {
  buildColorTexture,
  buildNormalTexture,
  fbm,
  ridged,
  voronoi,
} from "../rendering/ProceduralTexture";
import { Random, SEEDS } from "../util/Random";

const SIZE = 512;

let shared: { map: ReturnType<typeof buildColorTexture>; normal: ReturnType<typeof buildNormalTexture> } | undefined;

/** Layered strata plus cracks — the height field the maps are derived from. */
function rockHeight(u: number, v: number): number {
  const strata = fbm(u, v * 3.1, { seed: SEEDS.rock ^ 0x41, period: 5, octaves: 4 });
  const grain = fbm(u, v, { seed: SEEDS.rock ^ 0x93, period: 40, octaves: 3 });
  // Ridged noise carves the fractures; Voronoi walls add the blockier splits.
  const cracks = ridged(u, v, { seed: SEEDS.rock ^ 0x0d, period: 9, octaves: 3 });
  const { f1, f2 } = voronoi(u, v, 6, SEEDS.rock ^ 0xb7);
  const joints = Math.min(1, (f2 - f1) / 0.05);

  return strata * 0.44 + grain * 0.2 + Math.pow(cracks, 3) * 0.22 + joints * 0.14;
}

/**
 * Stone surface, shared by every rock, mound and flank in the reef.
 *
 * Flat shading is kept deliberately. A normal map composes correctly with it —
 * the derivative-based tangent frame perturbs the face normal — so the result
 * is textured facets, chiselled rather than smoothly rendered, which is the
 * look the rest of the reef is built around.
 */
export function createRockMaterial(color: number): MeshStandardMaterial {
  shared ??= {
    map: buildColorTexture(SIZE, (u, v) => {
      const h = rockHeight(u, v);
      const tone = 0.68 + h * 0.5;
      // Faintly cooler in the crevices, where less light reaches.
      return [tone, tone * (0.97 + h * 0.03), tone * (0.93 + h * 0.06)];
    }),
    normal: buildNormalTexture(SIZE, rockHeight, 0.07),
  };

  return new MeshStandardMaterial({
    color,
    map: shared.map,
    normalMap: shared.normal,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
    // Algae tinting is baked per-vertex from the surface normal.
    vertexColors: true,
  });
}

/**
 * Roughens a platonic solid into something that reads as stone, and gives it
 * usable UVs and an algae tint.
 *
 * The d20/d12 silhouette was half the reason the rocks looked like programmer
 * art; no amount of surface detail fixes an obviously regular solid. Radial
 * FBM displacement breaks the regularity while keeping the faceted style.
 */
export function weatherRock(
  geometry: BufferGeometry,
  seed: number,
  amount = 0.16,
  /**
   * Only ever shrink the surface. The crevice mounds sit a few centimetres
   * behind a moray's head and are raycast for line of sight, so a mound that
   * can bulge outward can silently swallow the creature the whole game is
   * about. Inward-only displacement makes that impossible by construction.
   */
  inwardOnly = false,
): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  const random = new Random(seed);
  const offsetX = random.range(0, 100);
  const offsetY = random.range(0, 100);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const length = Math.hypot(x, y, z) || 1;

    // Sample the noise by direction so shared vertices displace identically and
    // the surface stays closed.
    const u = (Math.atan2(z, x) / (Math.PI * 2) + 0.5 + offsetX) % 1;
    const v = (Math.asin(Math.max(-1, Math.min(1, y / length))) / Math.PI + 0.5 + offsetY) % 1;
    const n = fbm(u, v, { seed, period: 6, octaves: 4 });

    const scale = inwardOnly ? 1 - n * amount : 1 + (n - 0.5) * 2 * amount;
    position.setXYZ(i, x * scale, y * scale, z * scale);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  boxProjectUvs(geometry);
  tintByFacing(geometry);
}

/**
 * Projects UVs along each face's dominant axis.
 *
 * Platonic geometries have unusable UVs, and the textbook fix — runtime
 * triplanar sampling — costs three fetches per map on surfaces this large.
 * Box projection is one fetch and free, and its seams land on facet edges where
 * flat shading has already broken the normal, so they are invisible.
 */
function boxProjectUvs(geometry: BufferGeometry): void {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  if (!position || !normal) {
    return;
  }

  const uvs = new Float32Array(position.count * 2);
  const scale = 0.22;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));

    let u: number;
    let v: number;
    if (nx >= ny && nx >= nz) {
      u = z * scale;
      v = y * scale;
    } else if (ny >= nz) {
      u = x * scale;
      v = z * scale;
    } else {
      u = x * scale;
      v = y * scale;
    }

    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }

  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
}

/** Up-facing stone collects algae; undersides stay bare and cool. */
function tintByFacing(geometry: BufferGeometry): void {
  const normal = geometry.attributes.normal;
  if (!normal) {
    return;
  }

  const colors = new Float32Array(normal.count * 3);
  for (let i = 0; i < normal.count; i++) {
    const up = Math.max(0, normal.getY(i));
    const algae = Math.pow(up, 1.6);
    colors[i * 3] = 1 - algae * 0.22;
    colors[i * 3 + 1] = 1 - algae * 0.03;
    colors[i * 3 + 2] = 1 - algae * 0.2;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}
