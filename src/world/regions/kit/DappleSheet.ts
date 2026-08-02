import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Texture,
} from "three";
import { requestAlbedo } from "../../../rendering/AssetLibrary";
import { buildColorTexture, fbm, voronoi } from "../../../rendering/ProceduralTexture";
import { Random } from "../../../util/Random";
import type { GroundFn, KitArea, KitBuild } from "./KitTypes";

/**
 * `dappleSheet` (KIT-SPEC §3.6) — the caustic-dapple sheet recolorable
 * per region: two drifting clones of one tiling dapple pattern riding
 * just above the caller's terrain, beating against each other at
 * different scales and drift rates (the bowl's `CausticsSystem` idiom
 * as a kit call).
 *
 * THE one asset-touching piece: it asks `AssetLibrary` for the painted
 * `world/caustic-dapple.png`. The library texture is cloned per layer
 * (clones share one `Source` — one upload) and recoloured by `tint`
 * through the material colour, and it is NEVER disposed — the library
 * owns it. Until (or without) the asset, a generated Voronoi dapple in
 * the bowl's exact recipe is the standing fallback, so the noassets
 * build and plain Node render/construct identically by design.
 *
 * `tint` is the over-mix warmth knob (the sRGB-on-sand lesson: sand is
 * already warm, so a dapple that should READ warm needs its blue pulled
 * far further down than it looks — pass a honey like 0xffd98c, not a
 * near-white).
 *
 * Budget note: 1–2 draws (near + far layer; the far layer carries 0.62
 * of the weight so two scatters read as one light shimmering).
 * Triangles ≈ 2 × grid² × 2 — a 9 m disc at the default pitch is ~2.3k.
 * Additive discipline: `depthWrite: false`, fog on (a pool of light is
 * brighter than the fog it fades into), reach baked to zero at the
 * area's rim in vertex colours so the sheet never ends on an edge.
 */

export interface DappleSheetOptions {
  readonly seed: number;
  /** sRGB hex — the region's light colour laid over the pattern. */
  readonly tint: number;
  readonly ground: GroundFn;
  readonly area: KitArea;
  /** Per-layer strength; clamped to the ordinary-mark cap 0.3. */
  readonly opacity?: number;
  /** Metres one repeat of the near layer covers; far runs 1.55×. */
  readonly tileMetres?: number;
}

export interface DappleSheetBuild extends KitBuild {
  update(timeSec: number): void;
}

const OPACITY_CAP = 0.3;
const DEFAULT_OPACITY = 0.2;
const DEFAULT_TILE_METRES = 7;

/** Sheet lift over the ground, per layer, so the crests never punch. */
const LAYER_LIFT = [0.06, 0.075] as const;
/** The far layer's relative pattern scale, weight and drift. */
const FAR_SCALE = 1.55;
const FAR_WEIGHT = 0.62;
const LAYER_DRIFT = [1, -0.62] as const;
/** The far layer's spin off the near one's axes (painted clones only). */
const LAYER_SPIN = [0, 1.07] as const;

/** Grid pitch in metres, and the segment ceiling per sheet side. */
const GRID_PITCH = 1.1;
const MAX_SEGMENTS = 48;

/** Where the reach fade begins, as a fraction of the area's half-size. */
const REACH_FADE_FROM = 0.62;

/** The generated pattern's texel edge and cell count (the bowl's). */
const TEXTURE_SIZE = 256;
const CELLS = 5;
const DAPPLE_CORE = 0.12;
const DAPPLE_EDGE = 0.42;

const ASSET_PATH = "world/caustic-dapple.png";

function smoothstep01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

/** The generated dapple — the bowl's recipe verbatim, per-seed. */
function generatedDapple(seed: number): Texture {
  return buildColorTexture(TEXTURE_SIZE, (u, v) => {
    const warpX = u + (fbm(u, v, { seed: seed ^ 0x11, period: 4, octaves: 3 }) - 0.5) * 0.16;
    const warpY = v + (fbm(u, v, { seed: seed ^ 0x22, period: 4, octaves: 3 }) - 0.5) * 0.16;
    const { f1 } = voronoi(warpX, warpY, CELLS, seed);
    const wobble = 0.62 + 0.76 * fbm(u, v, { seed: seed ^ 0x33, period: 3, octaves: 2 });
    const dapple = smoothstep01((DAPPLE_EDGE - f1 * CELLS * wobble) / (DAPPLE_EDGE - DAPPLE_CORE));
    const patch =
      0.5 +
      0.5 * smoothstep01((fbm(u, v, { seed: seed ^ 0x77, period: 2, octaves: 2 }) - 0.35) / 0.4);
    const intensity = dapple * patch;
    return [intensity, intensity, intensity];
  });
}

/** The area's bounding box and its membership fade. */
interface AreaShape {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  reach(x: number, z: number): number;
}

function shapeArea(area: KitArea): AreaShape {
  if ("center" in area) {
    const [cx, cz] = area.center;
    const r = area.radius;
    return {
      minX: cx - r,
      maxX: cx + r,
      minZ: cz - r,
      maxZ: cz + r,
      reach: (x, z) =>
        1 - smoothstep01((Math.hypot(x - cx, z - cz) / r - REACH_FADE_FROM) / (1 - REACH_FADE_FROM)),
    };
  }
  const half = area.width / 2;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of area.polyline) {
    minX = Math.min(minX, x - half);
    maxX = Math.max(maxX, x + half);
    minZ = Math.min(minZ, z - half);
    maxZ = Math.max(maxZ, z + half);
  }
  const distance = (x: number, z: number): number => {
    let best = Infinity;
    for (let i = 0; i < area.polyline.length - 1; i++) {
      const [ax, az] = area.polyline[i]!;
      const [bx, bz] = area.polyline[i + 1]!;
      const dx = bx - ax;
      const dz = bz - az;
      const lengthSq = dx * dx + dz * dz;
      const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / lengthSq));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
    return best;
  };
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    reach: (x, z) =>
      1 - smoothstep01((distance(x, z) / half - REACH_FADE_FROM) / (1 - REACH_FADE_FROM)),
  };
}

/**
 * Swaps the painted dapples in when they land: one clone per layer (a
 * clone shares the library texture's `Source` — one image, one upload),
 * each carrying its own repeat/spin/offset. The recolour is the
 * material's `color` (a uniform tint multiply is texel-for-texel what a
 * baked recoloured copy would be, without a second upload per tint).
 * The library texture itself is shared and never disposed.
 */
function adoptPainted(
  layers: readonly { material: MeshBasicMaterial; repeat: number; spin: number }[],
  onOwned: (owned: Texture[]) => void,
): void {
  requestAlbedo(
    ASSET_PATH,
    (texture) => {
      const owned: Texture[] = [];
      for (const layer of layers) {
        const painted = texture.clone();
        painted.repeat.set(layer.repeat, layer.repeat);
        // Centre first, or the rotation pivots about the tile corner and
        // shears the drift (the bowl's own note).
        painted.center.set(0.5, 0.5);
        painted.rotation = layer.spin;
        const generated = layer.material.map;
        layer.material.map = painted;
        layer.material.needsUpdate = true;
        generated?.dispose();
        owned.push(painted);
      }
      onOwned(owned);
    },
    { tile: true },
  );
}

export function buildDappleSheet(options: DappleSheetOptions): DappleSheetBuild {
  const random = new Random(options.seed);
  const group = new Group();
  group.name = "kit-dapple-sheet";
  const shape = shapeArea(options.area);
  const tile = options.tileMetres ?? DEFAULT_TILE_METRES;
  const opacity = Math.min(options.opacity ?? DEFAULT_OPACITY, OPACITY_CAP);
  const tint = new Color(options.tint);

  const sizeX = shape.maxX - shape.minX;
  const sizeZ = shape.maxZ - shape.minZ;
  const segmentsX = Math.min(MAX_SEGMENTS, Math.max(8, Math.round(sizeX / GRID_PITCH)));
  const segmentsZ = Math.min(MAX_SEGMENTS, Math.max(8, Math.round(sizeZ / GRID_PITCH)));

  const geometries: BufferGeometry[] = [];
  const materials: MeshBasicMaterial[] = [];
  const layers: {
    material: MeshBasicMaterial;
    repeat: number;
    spin: number;
    drift: number;
  }[] = [];
  let paintedMaps: Texture[] | null = null;
  let triangles = 0;

  for (const [index, lift] of LAYER_LIFT.entries()) {
    const scale = index === 0 ? 1 : FAR_SCALE;
    const weight = index === 0 ? 1 : FAR_WEIGHT;
    // Whole repeats, or a fractional tile wraps mid-pattern at the rim.
    const repeat = Math.max(1, Math.round(Math.max(sizeX, sizeZ) / (tile * scale)));

    // The sheet: a grid fitted to the caller's ground, reach in colours.
    const columns = segmentsX + 1;
    const rows = segmentsZ + 1;
    const positions = new Float32Array(columns * rows * 3);
    const uvs = new Float32Array(columns * rows * 2);
    const colors = new Float32Array(columns * rows * 3);
    const indices: number[] = [];
    for (let iz = 0; iz < rows; iz++) {
      for (let ix = 0; ix < columns; ix++) {
        const x = shape.minX + (ix / segmentsX) * sizeX;
        const z = shape.minZ + (iz / segmentsZ) * sizeZ;
        const vertex = iz * columns + ix;
        positions[vertex * 3] = x;
        positions[vertex * 3 + 1] = options.ground(x, z) + lift;
        positions[vertex * 3 + 2] = z;
        uvs[vertex * 2] = ix / segmentsX;
        uvs[vertex * 2 + 1] = iz / segmentsZ;
        const reach = shape.reach(x, z);
        colors[vertex * 3] = reach;
        colors[vertex * 3 + 1] = reach;
        colors[vertex * 3 + 2] = reach;
      }
    }
    for (let iz = 0; iz < segmentsZ; iz++) {
      for (let ix = 0; ix < segmentsX; ix++) {
        const a = iz * columns + ix;
        const b = a + columns;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    // The generated fallback wears its own seed per layer, so the two
    // scatters never align (the painted clones use LAYER_SPIN instead).
    const texture = generatedDapple(index === 0 ? options.seed : options.seed ^ 0x5bd1);
    texture.repeat.set(repeat, repeat);

    const material = new MeshBasicMaterial({
      map: texture,
      color: tint.clone().multiplyScalar(weight),
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      // Hard-geometry purge (critic C4, the golden oasis mid-down): an
      // ADDITIVE material with fog on does not dim toward the fog — it
      // ADDS the fog colour across its whole footprint, so from above
      // the sheet drew a teal haze rectangle whose grid cut crossed the
      // frame corner-to-corner as a razor edge. The kit's own additive
      // discipline (the canyon light-column rule) is fog:false; the
      // fog's dimming job is done by hand below, exactly like the
      // curtains do their own fog.
      fog: false,
    });

    const mesh = new Mesh(geometry, material);
    mesh.name = `kit-dapple-layer-${index}`;
    mesh.renderOrder = 1 + index;
    // The hand fog: the pool of light dims away with camera distance the
    // way the water would have dimmed it, dissolving entirely before the
    // range where the old fog-add painted rectangles.
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      const sphere = geometry.boundingSphere;
      if (!sphere) {
        return;
      }
      const distance = camera.position.distanceTo(sphere.center);
      const dim = 1 - smoothstep01((distance - 30) / 55);
      material.opacity = opacity * dim;
    };
    group.add(mesh);
    geometries.push(geometry);
    materials.push(material);
    layers.push({
      material,
      repeat,
      spin: LAYER_SPIN[index]!,
      // A touch of seeded drift-rate jitter so two sheets in one region
      // never share a beat.
      drift: LAYER_DRIFT[index]! * random.range(0.92, 1.08),
    });
    triangles += indices.length / 3;
  }

  let lastTimeSec = 0;
  const update = (timeSec: number): void => {
    lastTimeSec = timeSec;
    for (const layer of layers) {
      layer.material.map?.offset.set(
        Math.sin(timeSec * 0.07 * layer.drift) * 0.12,
        timeSec * 0.021 * layer.drift,
      );
    }
  };

  adoptPainted(layers, (owned) => {
    paintedMaps = owned;
    // The swap lands whenever the asset does — a fresh clone wears zero
    // offset, so the sheet must be re-wound to the clock it was on or a
    // capture-in-flight silently loses its drift.
    update(lastTimeSec);
  });

  update(0);

  return {
    group,
    draws: layers.length,
    triangles,
    update,
    dispose(): void {
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of materials) {
        // Generated maps are owned; painted clones share the library's
        // Source and must never be disposed (the library owns it).
        if (!paintedMaps) {
          material.map?.dispose();
        }
        material.dispose();
      }
      group.clear();
      group.removeFromParent();
    },
  };
}
