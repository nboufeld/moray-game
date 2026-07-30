import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildScalarTexture, fbm } from "../../../rendering/ProceduralTexture";
import { Random } from "../../../util/Random";
import type { KitBuild } from "./KitTypes";

/**
 * `fallStreak` (KIT-SPEC §3.8) — the soft fall/streak mark: overlapping
 * tapered soft-edged columns of falling matter (sand, milk, ash) with a
 * slow vertical scroll, replacing every hard-topped bloom-block quad.
 * Two pieces:
 *
 * - `buildFallStreakTexture` — ONE tiling `DataTexture` of soft columns
 *   with per-column width/phase jitter and wrap-safe clump streaks (the
 *   noise lattice wraps in v, so the scroll never shows a seam). The
 *   texture is the shared half: verdant-2's Mistfall consumes it with
 *   its own regional sheet layout.
 * - `buildFallSheets` — merged vertical quads wearing that texture with
 *   the additive discipline (`fog: false`, `depthWrite: false`, opacity
 *   ≤ 0.2) and RGBA vertex colours fading tops AND feet (a fall that
 *   starts or ends on a hard line is a bloom block, which is the exact
 *   thing this piece exists to kill) plus side feathers.
 *
 * Motion is `update(timeSec)` setting the texture offset closed-form —
 * capture-safe, byte-deterministic, and visibly different one simulated
 * second apart (the scroll covers ~0.66 m/s at the default 6 m tile).
 *
 * Budget note: 1 draw (all sheets merged, one material, one texture);
 * ~64 tris per sheet. The texture is CALLER-owned and shared — dispose
 * releases the sheets, never the texture.
 */

export interface FallStreakTextureOptions {
  readonly seed: number;
  /** How many streams cross the tile; 4–7 reads as a fall, 2 as a leak. */
  readonly columns: number;
  /** 0..1 — edge feather and interior softness. */
  readonly softness: number;
}

export interface FallSheetSpec {
  /** The sheet's foot centre, world space. */
  readonly pos: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  /** Scroll/pattern phase, so neighbouring sheets never sync. */
  readonly phase: number;
  /** Yaw of the sheet's outward normal; 0 faces +z. */
  readonly facing?: number;
}

export interface FallSheetsOptions {
  readonly seed: number;
  readonly texture: DataTexture;
  readonly tint: number;
  readonly sheets: readonly FallSheetSpec[];
  /** Clamped to the spec cap 0.2. */
  readonly opacity?: number;
}

export interface FallSheetsBuild extends KitBuild {
  update(timeSec: number): void;
}

const OPACITY_CAP = 0.2;
const DEFAULT_OPACITY = 0.16;

/** Metres one texture repeat covers on a sheet, both axes. */
const TILE_METRES = 6;

/** Texture fraction scrolled per simulated second (~0.66 m/s of fall). */
const SCROLL_PER_SEC = 0.11;

/** The vertical alpha window: feet and tops both dissolve. */
const FOOT_FADE_TO = 0.14;
const TOP_FADE_FROM = 0.68;

/** Sheet tessellation: enough rows for the fades, few enough to merge big. */
const SHEET_COLUMNS = 6;
const SHEET_ROWS = 10;

function smoothstep01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

/**
 * The shared fall texture: soft tapering columns over a wrapping lattice.
 * Deterministic per options in plain Node (typed arrays only).
 */
export function buildFallStreakTexture(options: FallStreakTextureOptions): DataTexture {
  const random = new Random(options.seed);
  const soft = Math.min(1, Math.max(0, options.softness));
  const columns: { center: number; width: number; weight: number; wanderSeed: number; streakSeed: number }[] = [];
  for (let i = 0; i < options.columns; i++) {
    columns.push({
      // Spread across the tile, jittered — never an even comb.
      center: (i + 0.5) / options.columns + random.signed(0.4 / options.columns),
      width: random.range(0.05, 0.11) * (1 + soft * 0.8),
      weight: random.range(0.55, 1),
      wanderSeed: (options.seed ^ (0x11 + i * 977)) >>> 0,
      streakSeed: (options.seed ^ (0x77 + i * 1409)) >>> 0,
    });
  }
  const bellExponent = 1.2 + (1 - soft) * 1.6;

  return buildScalarTexture(128, (u, v) => {
    let value = 0;
    for (const column of columns) {
      // The stream wanders and breathes down the tile — both on wrapping
      // noise, so the scroll never meets a seam.
      const wander =
        (fbm(0.31, v, { seed: column.wanderSeed, period: 2, octaves: 2 }) - 0.5) * 0.1;
      const breathe =
        0.7 + 0.6 * fbm(0.67, v, { seed: column.wanderSeed ^ 0x5, period: 2, octaves: 2 });
      // Distance across the tile, wrapped so edge columns tile in u too.
      let across = Math.abs(u - (column.center + wander));
      across = Math.min(across, 1 - across);
      const bell = Math.pow(
        Math.max(0, 1 - across / (column.width * breathe)),
        bellExponent,
      );
      if (bell <= 0) {
        continue;
      }
      // Falling clumps: value streaks along v, wrapping, per column.
      // Wide swing on purpose — the clumps are what the eye tracks when
      // the sheet scrolls, and a low-contrast stream reads as a stain.
      const clumps =
        0.3 + 0.85 * fbm(u * 0.5, v, { seed: column.streakSeed, period: 4, octaves: 3 });
      value += bell * clumps * column.weight;
    }
    return Math.min(1, value);
  });
}

/** Merged fall sheets wearing the shared texture. */
export function buildFallSheets(options: FallSheetsOptions): FallSheetsBuild {
  const random = new Random(options.seed);
  const group = new Group();
  group.name = "kit-fall-streak";

  const parts: BufferGeometry[] = [];
  for (const sheet of options.sheets) {
    const [x, y, z] = sheet.pos;
    const yaw = sheet.facing ?? 0;
    const tanX = Math.cos(yaw);
    const tanZ = -Math.sin(yaw);
    // A whisper of per-sheet u offset so two sheets never share columns.
    const uOffset = sheet.phase + random.range(0, 1);

    const columns = SHEET_COLUMNS + 1;
    const rows = SHEET_ROWS + 1;
    const positions = new Float32Array(columns * rows * 3);
    const uvs = new Float32Array(columns * rows * 2);
    const colors = new Float32Array(columns * rows * 4);
    const indices: number[] = [];
    for (let r = 0; r < rows; r++) {
      const rowFrac = r / SHEET_ROWS;
      for (let c = 0; c < columns; c++) {
        const colFrac = c / SHEET_COLUMNS;
        const across = (colFrac - 0.5) * sheet.width;
        const vertex = r * columns + c;
        positions[vertex * 3] = x + tanX * across;
        positions[vertex * 3 + 1] = y + rowFrac * sheet.height;
        positions[vertex * 3 + 2] = z + tanZ * across;
        uvs[vertex * 2] = uOffset + (colFrac * sheet.width) / TILE_METRES;
        uvs[vertex * 2 + 1] = sheet.phase + (rowFrac * sheet.height) / TILE_METRES;

        // Feet AND tops dissolve; sides feather — no edge anywhere.
        const footFade = smoothstep01(rowFrac / FOOT_FADE_TO);
        const topFade = 1 - smoothstep01((rowFrac - TOP_FADE_FROM) / (1 - TOP_FADE_FROM));
        const sideFade = 1 - smoothstep01((Math.abs(colFrac - 0.5) - 0.3) / 0.2);
        colors[vertex * 4] = 1;
        colors[vertex * 4 + 1] = 1;
        colors[vertex * 4 + 2] = 1;
        colors[vertex * 4 + 3] = footFade * topFade * sideFade;
      }
    }
    for (let r = 0; r < SHEET_ROWS; r++) {
      for (let c = 0; c < SHEET_COLUMNS; c++) {
        const a = r * columns + c;
        const b = a + columns;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setAttribute("color", new BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    parts.push(geometry);
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("kit fall sheets could not be merged");
  }
  merged.computeBoundingSphere();

  const material = new MeshBasicMaterial({
    map: options.texture,
    color: new Color(options.tint),
    transparent: true,
    opacity: Math.min(options.opacity ?? DEFAULT_OPACITY, OPACITY_CAP),
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    forceSinglePass: true,
    vertexColors: true,
    fog: false,
  });

  const mesh = new Mesh(merged, material);
  mesh.name = "kit-fall-sheets";
  mesh.renderOrder = 2;
  group.add(mesh);

  const update = (timeSec: number): void => {
    // The fall: the pattern rides DOWN the sheets — sampling climbs the
    // wrapped texture, closed-form off simulated time.
    options.texture.offset.y = timeSec * SCROLL_PER_SEC;
  };
  update(0);

  return {
    group,
    draws: 1,
    triangles: (merged.index?.count ?? 0) / 3,
    update,
    dispose(): void {
      merged.dispose();
      material.dispose();
      // The texture is the CALLER's (and shared across builds): kept.
      group.clear();
      group.removeFromParent();
    },
  };
}
