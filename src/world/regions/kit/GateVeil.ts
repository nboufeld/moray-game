import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FogExp2,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Scene,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { Random } from "../../../util/Random";
import { buildBeamAndPool } from "./BeamAndPool";
import { buildParticulateField } from "./ParticulateField";
import type { KitBuild } from "./KitTypes";

/**
 * `gateVeil` (KIT-SPEC §3.7) — the highest-leverage piece: what a
 * gateway doorway shows before (and while) the region behind it streams
 * in. Instead of a cut-out onto empty fog, the door frames a PROMISE:
 * two-to-three silhouette planes in the region's own inks receding into
 * the water, a soft light column standing in the opening, and a drift
 * of particulate catching it.
 *
 * The planes are the `DistantReef` hand-fog idiom, ported with the
 * abyss curtains' hard-won lessons:
 * - `fog: false`, and the inks SELF-MIX toward `scene.fog` per frame
 *   (one colour compare, three lerps on change), so every mood, weather
 *   and repaint reaches them — and when the region streams in behind,
 *   the veil agrees with the real distance rings by construction (same
 *   palette source, same fog);
 * - drooped, seeded fbm skylines — never a straight top edge;
 * - alpha-dissolved tops (RGBA vertex colours) so the geometry's edge
 *   never shows; a baked vertical value grade so a close plane is not
 *   poster board;
 * - `depthWrite: false`, opacity ≤ 0.2, one mesh per plane with a tight
 *   sphere (the veil's segmenting — no 27 m uncullable arcs).
 *
 * The column and the drift are B-internal composition (legal per spec):
 * one `beamAndPool` call with pools suppressed and one `particulateField`
 * in drift mode, so the veil's light carries the same four-part additive
 * discipline as every other mark in the kit.
 *
 * Budget note: ≤ 5 draws (≤ 3 planes + 1 column + 1 Points), ~1.6k
 * triangles at reference options. `update(timeSec)` drives the drift
 * only; everything else is still.
 */

export interface GateVeilDoorway {
  /** The doorway sill's centre, world space (y = the sill's floor). */
  readonly pos: readonly [number, number, number];
  /** Yaw of the doorway's outward normal — toward the wing side. */
  readonly facing: number;
  readonly width: number;
  readonly height: number;
}

export interface GateVeilOptions {
  readonly seed: number;
  readonly doorway: GateVeilDoorway;
  /** 2–3 inks sourced from the REGION behind the door, near → far. */
  readonly palette: readonly number[];
  /** Re-mix the inks from `scene.fog` per frame; default true. */
  readonly followFog?: boolean;
  readonly particulate?: { readonly tint: number; readonly count: number };
  readonly column?: { readonly tint: number; readonly opacity: number };
}

export interface GateVeilBuild extends KitBuild {
  update(timeSec: number): void;
}

const PLANE_OPACITY_CAP = 0.2;

/** Depths behind the door, widths and heights, per plane index. */
const PLANE_DEPTH = [0.9, 2.1, 3.6] as const;
/** Widths kept close: the three planes must STACK over the doorway's
 *  opening — at the 0.2 cap one plane alone is a tint, three are a place. */
const PLANE_WIDTH = [1.15, 1.45, 1.85] as const;
const PLANE_HEIGHT = [1.1, 1.45, 1.9] as const;

/** How far each plane's ink has already dissolved toward the fog. The
 *  near plane keeps most of its ink: at the 0.2 opacity cap the darkness
 *  has to come from the colour (the abyss curtains' lesson — a doorway
 *  must read darker than the water around it, or it is not a doorway). */
const PLANE_FOG_MIX = [0.05, 0.24, 0.48] as const;

/** The skyline band, as fractions of the plane's own height. */
const RIDGE_FLOOR = 0.7;
const RIDGE_VARY = 0.3;

/** The alpha dissolve starts here, up each column's own height. Late on
 *  purpose: at the 0.2 opacity cap a plane's whole reading comes from
 *  its solid band, and an early dissolve left the veil invisible above
 *  the terrain horizon (round 3's lesson on the demo stage). */
const DISSOLVE_FROM = 0.72;

/** Vertical value grade, foot → top (the abyss poster-board lesson). */
const GRADE_FOOT = 0.82;
const GRADE_TOP = 1.12;

/** Metres the planes' feet sink below the sill, so no gap ever opens. */
const FOOT = 2;

const COLUMNS = 36;
const ROWS = 6;

/** The stand-in water the inks mix toward when no fog is followed yet. */
const FALLBACK_FOG = 0x53b2bb;

function smoothstep01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

export function buildGateVeil(options: GateVeilOptions): GateVeilBuild {
  const random = new Random(options.seed);
  const group = new Group();
  group.name = "kit-gate-veil";
  const { doorway } = options;
  const [doorX, doorY, doorZ] = doorway.pos;
  const outX = Math.sin(doorway.facing);
  const outZ = Math.cos(doorway.facing);
  // The door's tangent, a quarter turn from its outward normal.
  const tanX = outZ;
  const tanZ = -outX;

  const inks = options.palette.slice(0, 3).map((hex) => new Color(hex));
  if (inks.length < 2) {
    throw new Error("gateVeil needs 2–3 palette inks");
  }

  const geometries: BufferGeometry[] = [];
  const materials: MeshBasicMaterial[] = [];
  let draws = 0;
  let triangles = 0;

  // ─── The silhouette planes ───────────────────────────────────────────────
  const planeMaterials: { material: MeshBasicMaterial; ink: Color; mix: number }[] = [];
  for (const [index, ink] of inks.entries()) {
    const depth = doorway.width * PLANE_DEPTH[index]!;
    const halfWidth = (doorway.width * PLANE_WIDTH[index]!) / 2;
    const height = doorway.height * PLANE_HEIGHT[index]!;
    const centreX = doorX - outX * depth;
    const centreZ = doorZ - outZ * depth;

    // Column skylines: fbm ridge plus one seeded peak, per plane.
    const ridgeSeed = (options.seed ^ (index * 0x9e37)) >>> 0;
    const peakAt = random.range(0.15, 0.85);
    const peakHalf = random.range(0.08, 0.16);
    const peakRise = random.range(0.1, 0.24);

    const positions = new Float32Array((COLUMNS + 1) * (ROWS + 1) * 3);
    const colors = new Float32Array((COLUMNS + 1) * (ROWS + 1) * 4);
    const indices: number[] = [];

    for (let c = 0; c <= COLUMNS; c++) {
      const u = c / COLUMNS;
      // Low frequency and two octaves only: at 36 columns a busier ridge
      // aliases into sawteeth (round 6's isolated render).
      const ridgeNoise = fbm(u * 2, index * 0.37, { seed: ridgeSeed, period: 2, octaves: 2 });
      let top = height * (RIDGE_FLOOR + RIDGE_VARY * ridgeNoise);
      const peakDelta = Math.abs(u - peakAt);
      if (peakDelta < peakHalf) {
        const t = 1 - peakDelta / peakHalf;
        top += height * peakRise * t * t;
      }
      // Drooped ends: the skyline sags away past the door's own jambs, so
      // the plane never presents a rectangular corner.
      top *= 1 - 0.35 * smoothstep01((Math.abs(u - 0.5) - 0.3) / 0.2);

      const across = (u - 0.5) * halfWidth * 2;
      const x = centreX + tanX * across;
      const z = centreZ + tanZ * across;
      for (let r = 0; r <= ROWS; r++) {
        const rowFrac = r / ROWS;
        const y = doorY - FOOT + (top + FOOT) * rowFrac;
        const vertex = c * (ROWS + 1) + r;
        positions[vertex * 3] = x;
        positions[vertex * 3 + 1] = y;
        positions[vertex * 3 + 2] = z;

        const grade = GRADE_FOOT + (GRADE_TOP - GRADE_FOOT) * rowFrac;
        const topFade = 1 - smoothstep01((rowFrac - DISSOLVE_FROM) / (1 - DISSOLVE_FROM));
        // The sides dissolve too: a plane whose vertical end-edge shows
        // reads as a pane of glass standing in the water (round 5).
        const sideFade = 1 - smoothstep01((Math.abs(u - 0.5) - 0.36) / 0.14);
        colors[vertex * 4] = grade;
        colors[vertex * 4 + 1] = grade;
        colors[vertex * 4 + 2] = grade;
        colors[vertex * 4 + 3] = topFade * sideFade;
      }
    }
    for (let c = 0; c < COLUMNS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const a = c * (ROWS + 1) + r;
        const b = (c + 1) * (ROWS + 1) + r;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    const mix = PLANE_FOG_MIX[index]!;
    const material = new MeshBasicMaterial({
      // A stand-in close to the shipped water; corrected on first render
      // when `followFog` holds (the DistantReef move).
      color: ink.clone().lerp(new Color(FALLBACK_FOG), mix),
      transparent: true,
      opacity: PLANE_OPACITY_CAP,
      depthWrite: false,
      side: DoubleSide,
      forceSinglePass: true,
      vertexColors: true,
      fog: false,
    });

    const mesh = new Mesh(geometry, material);
    mesh.name = `kit-gate-veil-plane-${index}`;
    mesh.renderOrder = 1;
    group.add(mesh);
    geometries.push(geometry);
    materials.push(material);
    planeMaterials.push({ material, ink: ink.clone(), mix });
    draws += 1;
    triangles += indices.length / 3;
  }

  // The self-winding fog follow: nothing owns an update call into a veil,
  // so the nearest plane re-mixes every ink when the fog colour changes.
  if (options.followFog !== false) {
    let lastFog = -1;
    const first = group.children[0] as Mesh;
    first.onBeforeRender = (_renderer, scene) => {
      const fog = (scene as Scene).fog;
      if (!(fog instanceof FogExp2)) {
        return;
      }
      const hex = fog.color.getHex();
      if (hex === lastFog) {
        return;
      }
      lastFog = hex;
      for (const plane of planeMaterials) {
        plane.material.color.copy(plane.ink).lerp(fog.color, plane.mix);
      }
    };
  }

  // ─── The light column ─────────────────────────────────────────────────────
  let column: KitBuild | null = null;
  if (options.column) {
    column = buildBeamAndPool({
      seed: (options.seed ^ 0xc01) >>> 0,
      tint: options.column.tint,
      ground: () => doorY,
      beams: [
        {
          pos: [doorX - outX * doorway.width * 0.35, doorZ - outZ * doorway.width * 0.35],
          top: doorY + doorway.height * 1.2,
          width: doorway.width * 0.55,
          opacity: options.column.opacity,
        },
      ],
      // The veil budget holds ≤ 5 draws; the doorway's floor is usually a
      // threshold, not open sand, so the column stands poolless.
      pools: [],
    });
    group.add(column.group);
    draws += column.draws;
    triangles += column.triangles;
  }

  // ─── The particulate drift ───────────────────────────────────────────────
  let drift: (KitBuild & { update(timeSec: number): void }) | null = null;
  if (options.particulate) {
    drift = buildParticulateField({
      seed: (options.seed ^ 0xd51f) >>> 0,
      tint: options.particulate.tint,
      count: options.particulate.count,
      mode: "drift",
      volume: {
        center: [
          doorX - outX * doorway.width * 0.2,
          doorY + doorway.height * 0.55,
          doorZ - outZ * doorway.width * 0.2,
        ],
        size: [
          doorway.width * 1.1,
          doorway.height * 1.0,
          doorway.width * 1.1,
        ],
      },
      opacity: 0.5,
      bias: { dir: [outX * 0.4, 0.08, outZ * 0.4], speed: 0.35 },
    });
    group.add(drift.group);
    draws += drift.draws;
    triangles += drift.triangles;
  }

  return {
    group,
    draws,
    triangles,
    update(timeSec: number): void {
      drift?.update(timeSec);
    },
    dispose(): void {
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
      column?.dispose();
      drift?.dispose();
      group.clear();
      group.removeFromParent();
    },
  };
}
