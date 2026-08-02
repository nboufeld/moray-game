import {
  Group,
  Mesh,
  QuadraticBezierCurve3,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { SphereCollider } from "../CollisionField";
import { createRockMaterial, weatherRock } from "../RockMaterial";
import { archGeometry, boulderGeometry, slabGeometry } from "../RockShapes";
import { Random } from "../../util/Random";
import { buildBeamAndPool } from "./kit/BeamAndPool";
import { buildDappleSheet } from "./kit/DappleSheet";
import { buildGroundLitter, type LitterShapeSet } from "./kit/GroundLitter";
import {
  buildShoalRunner,
  type ShoalFish,
  type ShoalRunnerBuild,
} from "./kit/ShoalRunner";
import type { GateFn, KitPalette } from "./kit/KitTypes";

/**
 * ROADS-AND-AXES (critic punches #2/#6/#10) — the one corridor-dressing
 * recipe every region owns its own serving of: ONE reveal (a silhouette
 * event in the province's own stone vocabulary), ONE companion shoal
 * (kit `shoalRunner`, confined to the corridor so it is ALWAYS on the
 * road — the life-visibility fix is structural, not a timetable
 * lottery), ONE light change (a sentence VARIED per corridor — broken
 * slanted shafts, floor pools, silhouette backlight, dapple where the
 * province's light row allows it — never eleven copies of the vertical
 * god-shaft, per C7), plus optional floor ribbons (wear-lines/drift
 * runs) that give the mid-down axis something to read (C3).
 *
 * The rules it lives under:
 * - **R3 ownership**: each region calls this from its OWN build with a
 *   fresh XOR substream of its OWN seed, appended after every existing
 *   module — the no-reroll fence is structural (nothing existing draws
 *   from these streams).
 * - **Composed ground**: pass corridors are overlap country; callers
 *   pass a `ground` already max()ed over both owners' terrainTargets
 *   (the journey harness's own rule), so nothing floats at the seam.
 * - **Budget honesty**: draws/triangles are counted from the meshes
 *   actually made, so the region budget tests measure the truth.
 * - **Protected rests**: reveal/shoal/ribbon placement is the caller's
 *   authored choice; region tests assert route clearance the way
 *   connective-3 did (the registry is the licence, not this module).
 */

// ─── The spoke frame ─────────────────────────────────────────────────────────

export interface RoadFrame {
  /** The spoke azimuth (`RegionSlot.azimuth`). */
  readonly azimuth: number;
  /** Spoke → world, the owning region's own mapping. */
  worldOf(u: number, v: number): { x: number; z: number };
  /** Composed floor along the corridor (max over both owners at seams). */
  ground(x: number, z: number): number;
}

/** Spoke-local geometry (x = u, z = v) turns into world space with this. */
function spokeYaw(azimuth: number): number {
  return -azimuth;
}

// ─── The reveal ──────────────────────────────────────────────────────────────

export type RevealKind = "leaning-pair" | "fallen-lintel" | "arch" | "ribs";

export interface RevealSpec {
  readonly kind: RevealKind;
  /** Where the event stands, spoke coordinates. */
  readonly u: number;
  readonly v: number;
  /** Half-gap between the flanking pieces, metres across the road. */
  readonly gap: number;
  /** Overall size multiplier (1 = the archetype's own metres). */
  readonly scale?: number;
  /** The province's stone hue (createRockMaterial lifts dark tints). */
  readonly color: number;
  /** Extra yaw of the whole event around its anchor, radians. */
  readonly turn?: number;
  /** Solid pieces get spheres; pass false for scenery-only (tight roads). */
  readonly colliders?: boolean;
}

interface RevealResult {
  readonly geometry: BufferGeometry;
  readonly colliders: SphereCollider[];
}

/** A tall lathed menhir, leaned; the pair breaks the walk's silhouette. */
function leaningPair(spec: RevealSpec, random: Random): RevealResult {
  const scale = spec.scale ?? 1;
  const parts: BufferGeometry[] = [];
  const feet: { z: number; height: number; radius: number }[] = [];
  for (const side of [-1, 1] as const) {
    const height = (4.6 + random.range(0, 1.4)) * scale;
    const radius = (0.85 + random.range(0, 0.35)) * scale;
    const stone = boulderGeometry({
      seed: (spec.u * 31 + side * 7 + Math.floor(random.next() * 0xffff)) >>> 0,
      radius,
      height,
      segments: 12,
      rings: 14,
    });
    // Lean toward the road: the two stones bow to each other over it.
    stone.rotateX(side * (0.16 + random.range(0, 0.08)));
    stone.rotateY(random.range(0, Math.PI * 2));
    stone.translate(random.signed(0.6), 0, side * spec.gap);
    parts.push(stone);
    feet.push({ z: side * spec.gap, height, radius });
  }
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!geometry) {
    throw new Error("road reveal: leaning pair failed to merge");
  }
  return {
    geometry,
    colliders: feet.map((foot) => ({
      center: new Vector3(0, foot.height * 0.45, foot.z),
      radius: foot.radius + 0.7,
    })),
  };
}

/** Two standing jambs; the cross-stone has slid and leans on one. */
function fallenLintel(spec: RevealSpec, random: Random): RevealResult {
  const scale = spec.scale ?? 1;
  const parts: BufferGeometry[] = [];
  const colliders: SphereCollider[] = [];
  const legHeight = 3.4 * scale;
  for (const side of [-1, 1] as const) {
    const radius = 0.75 * scale * random.range(0.9, 1.1);
    const leg = boulderGeometry({
      seed: (spec.u * 17 + side * 5 + Math.floor(random.next() * 0xffff)) >>> 0,
      radius,
      height: legHeight * random.range(0.88, 1.05),
      segments: 12,
      rings: 12,
    });
    leg.rotateY(random.range(0, Math.PI * 2));
    leg.translate(0, 0, side * spec.gap);
    parts.push(leg);
    colliders.push({
      center: new Vector3(0, legHeight * 0.45, side * spec.gap),
      radius: radius + 0.7,
    });
  }
  // The lintel, slid off: one end near a jamb's shoulder, the other in
  // the sand — the "something fell here" sentence in one stone.
  const lintel = slabGeometry({
    seed: (spec.u * 13 + Math.floor(random.next() * 0xffff)) >>> 0,
    radius: spec.gap * 0.85,
    height: 1.1 * scale,
    segments: 12,
    rings: 10,
  });
  lintel.rotateX(Math.PI / 2 - 0.55);
  lintel.rotateY(random.signed(0.3));
  lintel.translate(random.signed(0.5), legHeight * 0.35, spec.gap * 0.25);
  parts.push(lintel);
  colliders.push({
    center: new Vector3(0, legHeight * 0.3, spec.gap * 0.25),
    radius: spec.gap * 0.55,
  });
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!geometry) {
    throw new Error("road reveal: fallen lintel failed to merge");
  }
  return { geometry, colliders };
}

/** The swim-through arch, tilted a breath so it reads as survived, not built. */
function agedArch(spec: RevealSpec, random: Random): RevealResult {
  const scale = spec.scale ?? 1;
  const geometry = archGeometry({
    seed: (spec.u * 23 + Math.floor(random.next() * 0xffff)) >>> 0,
    span: spec.gap * 2,
    legHeight: 3.6 * scale,
    legRadius: 0.9 * scale,
    beamRadius: 0.7 * scale,
    rise: 1.1 * scale,
  });
  // The arch spans x in its own space; the road runs along local x, so a
  // crossing arch turns its span onto the v axis.
  geometry.rotateY(Math.PI / 2 + random.signed(0.1));
  geometry.rotateZ(random.signed(0.05));
  return {
    geometry,
    colliders: [-1, 1].map((side) => ({
      center: new Vector3(0, 1.8 * scale, side * spec.gap),
      radius: 0.9 * scale + 0.7,
    })),
  };
}

/** Half-buried rib arcs — the wreck/bone vocabulary (blue, calamity). */
function wreckRibs(spec: RevealSpec, random: Random): RevealResult {
  const scale = spec.scale ?? 1;
  const parts: BufferGeometry[] = [];
  const count = 3;
  for (let i = 0; i < count; i++) {
    const half = spec.gap * (1 - i * 0.22) * scale;
    const crown = (3.4 - i * 0.7) * scale;
    const rib = new TubeGeometry(
      new QuadraticBezierCurve3(
        new Vector3(0, -0.6, -half),
        new Vector3(0, crown * 2, random.signed(0.8)),
        new Vector3(0, -0.6, half),
      ),
      16,
      0.28 * scale,
      7,
      false,
    );
    // A rib is deeper than it is thick — squash along the road axis.
    rib.scale(0.55, 1, 1);
    weatherRock(rib, (spec.u * 41 + i * 9) >>> 0, { amount: 0.05 });
    rib.rotateY(random.signed(0.12));
    rib.translate(i * 2.4 * scale + random.signed(0.5), 0, random.signed(0.7));
    parts.push(rib);
  }
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!geometry) {
    throw new Error("road reveal: ribs failed to merge");
  }
  return { geometry, colliders: [] };
}

// ─── The companion shoal ─────────────────────────────────────────────────────

export interface CorridorShoalSpec {
  /** The loop's reach along the spoke. */
  readonly u0: number;
  readonly u1: number;
  /** Shoulder offset: out at +sideV, home at −sideV. */
  readonly sideV: number;
  /** Metres over the composed floor. */
  readonly lift: number;
  readonly count: number;
  readonly fish: ShoalFish;
  /** Loop seconds — corridor loops run SHORT (60–150 s) so the road is
   *  never long without its witness (the C6 fix). */
  readonly periodSec: number;
  readonly braid?: { readonly lateral: number; readonly vertical: number };
  readonly glint?: { readonly count: number; readonly size: number };
}

/**
 * A closed loop confined to the corridor: out one shoulder, home along
 * the other. Confinement is the visibility guarantee — some stretch of
 * the file is on the road at EVERY phase, so no capture or swim-by can
 * miss it the way the (period-gated) wing legs were missed.
 */
export function corridorLoopStations(
  frame: RoadFrame,
  spec: Pick<CorridorShoalSpec, "u0" | "u1" | "sideV" | "lift">,
): (readonly [number, number, number])[] {
  const stations: (readonly [number, number, number])[] = [];
  const seat = (u: number, v: number): readonly [number, number, number] => {
    const { x, z } = frame.worldOf(u, v);
    return [x, frame.ground(x, z) + spec.lift, z] as const;
  };
  const legs = Math.max(3, Math.round((spec.u1 - spec.u0) / 24));
  for (let i = 0; i <= legs; i++) {
    stations.push(seat(spec.u0 + ((spec.u1 - spec.u0) * i) / legs, spec.sideV));
  }
  for (let i = legs; i >= 0; i--) {
    stations.push(seat(spec.u0 + ((spec.u1 - spec.u0) * i) / legs, -spec.sideV));
  }
  return stations;
}

/** A drifting ellipse — the mid-down under-shoal (C3/C6, off the road). */
export interface LoopShoalSpec {
  readonly centerU: number;
  readonly centerV: number;
  readonly radiusU: number;
  readonly radiusV: number;
  readonly lift: number;
  readonly count: number;
  readonly fish: ShoalFish;
  readonly periodSec: number;
  readonly braid?: { readonly lateral: number; readonly vertical: number };
  readonly glint?: { readonly count: number; readonly size: number };
}

export function ellipseLoopStations(
  frame: RoadFrame,
  spec: Pick<LoopShoalSpec, "centerU" | "centerV" | "radiusU" | "radiusV" | "lift">,
): (readonly [number, number, number])[] {
  const stations: (readonly [number, number, number])[] = [];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const u = spec.centerU + Math.cos(theta) * spec.radiusU;
    const v = spec.centerV + Math.sin(theta) * spec.radiusV;
    const { x, z } = frame.worldOf(u, v);
    stations.push([x, frame.ground(x, z) + spec.lift, z] as const);
  }
  return stations;
}

// ─── The light change ────────────────────────────────────────────────────────

export type LightSpec =
  | {
      /** Slanted/broken shafts or a backlight blade — beams plus pools. */
      readonly kind: "shafts";
      readonly tint: number;
      readonly beams: readonly {
        readonly u: number;
        readonly v: number;
        readonly top: number;
        readonly width: number;
        readonly opacity: number;
        /** Spoke-space head drift per metre of height. */
        readonly slant?: readonly [number, number];
      }[];
      /** "none" suppresses the default pool under every beam. */
      readonly pools?: "auto" | "none";
    }
  | {
      /** Floor pools alone — light landing with no visible column. */
      readonly kind: "pools";
      readonly tint: number;
      readonly pools: readonly {
        readonly u: number;
        readonly v: number;
        readonly radius: number;
        readonly opacity: number;
      }[];
    }
  | {
      /** Caustic dapple — ONLY where the province's light row allows it
       *  (never pale — upheld). */
      readonly kind: "dapple";
      readonly tint: number;
      readonly centerU: number;
      readonly centerV: number;
      readonly radius: number;
      readonly opacity?: number;
      readonly tileMetres?: number;
    };

// ─── Floor ribbons (the mid-down paint) ──────────────────────────────────────

export interface RibbonSpec {
  /** Wear-line / drift ribbon polyline, spoke coordinates. */
  readonly polyline: readonly (readonly [number, number])[];
  readonly width: number;
  readonly count: number;
  readonly palette: KitPalette;
  readonly shapeSet?: LitterShapeSet;
  readonly size?: readonly [number, number];
  readonly twoTone?: boolean;
  readonly grade?: number;
  /** Optional rest-gate: return 0 inside protected stillness. */
  readonly gate?: GateFn;
  readonly rake?: {
    readonly from: readonly [number, number];
    readonly strength: number;
    readonly jitter: number;
  };
}

// ─── The build ───────────────────────────────────────────────────────────────

export interface RoadDressingSpec {
  /** Fresh XOR substream of the OWNING region's seed (the fence). */
  readonly seed: number;
  readonly frame: RoadFrame;
  readonly reveal?: RevealSpec;
  readonly corridorShoal?: CorridorShoalSpec;
  readonly loopShoals?: readonly LoopShoalSpec[];
  readonly lights?: readonly LightSpec[];
  readonly ribbons?: readonly RibbonSpec[];
}

export interface RoadDressingBuild {
  readonly group: Group;
  readonly draws: number;
  readonly triangles: number;
  readonly colliders: readonly SphereCollider[];
  /** Every shoal's stations, corridor first — for route-clearance tests. */
  readonly shoalStations: readonly (readonly (readonly [number, number, number])[])[];
  update(timeSec: number): void;
  dispose(): void;
}

export function buildRoadDressing(spec: RoadDressingSpec): RoadDressingBuild {
  const random = new Random(spec.seed);
  const group = new Group();
  group.name = "road-dressing";
  let draws = 0;
  let triangles = 0;
  const colliders: SphereCollider[] = [];
  const shoalStations: (readonly (readonly [number, number, number])[])[] = [];
  const updates: ((timeSec: number) => void)[] = [];
  const disposers: (() => void)[] = [];

  // ── Reveal ────────────────────────────────────────────────────────────────
  if (spec.reveal) {
    const reveal = spec.reveal;
    const built =
      reveal.kind === "leaning-pair"
        ? leaningPair(reveal, random)
        : reveal.kind === "fallen-lintel"
          ? fallenLintel(reveal, random)
          : reveal.kind === "arch"
            ? agedArch(reveal, random)
            : wreckRibs(reveal, random);

    const { x, z } = spec.frame.worldOf(reveal.u, reveal.v);
    const y = spec.frame.ground(x, z);
    const yaw = spokeYaw(spec.frame.azimuth) + (reveal.turn ?? 0);
    built.geometry.rotateY(yaw);
    built.geometry.translate(x, y, z);
    built.geometry.computeBoundingSphere();

    const material = createRockMaterial(reveal.color);
    const mesh = new Mesh(built.geometry, material);
    mesh.name = `road-reveal-${reveal.kind}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    draws += 1;
    triangles += (built.geometry.index?.count ?? built.geometry.attributes.position!.count) / 3;
    disposers.push(() => {
      built.geometry.dispose();
      material.dispose();
    });

    if (reveal.colliders !== false) {
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      for (const sphere of built.colliders) {
        colliders.push({
          center: new Vector3(
            x + sphere.center.x * cos + sphere.center.z * sin,
            y + sphere.center.y,
            z - sphere.center.x * sin + sphere.center.z * cos,
          ),
          radius: sphere.radius,
        });
      }
    }
  }

  // ── Shoals ────────────────────────────────────────────────────────────────
  const mountShoal = (
    stations: (readonly [number, number, number])[],
    shoal: {
      count: number;
      fish: ShoalFish;
      periodSec: number;
      braid?: { readonly lateral: number; readonly vertical: number };
      glint?: { readonly count: number; readonly size: number };
    },
    salt: number,
  ): void => {
    const build: ShoalRunnerBuild = buildShoalRunner({
      seed: (spec.seed ^ salt) >>> 0,
      route: { stations, closed: true },
      count: shoal.count,
      fish: shoal.fish,
      phaseSpeed: 1 / shoal.periodSec,
      ...(shoal.braid ? { braid: shoal.braid } : {}),
      ...(shoal.glint ? { glint: shoal.glint } : {}),
    });
    group.add(build.group);
    draws += build.draws;
    triangles += build.triangles;
    shoalStations.push(stations);
    updates.push(build.update);
    disposers.push(() => build.dispose());
  };

  if (spec.corridorShoal) {
    mountShoal(
      corridorLoopStations(spec.frame, spec.corridorShoal),
      spec.corridorShoal,
      0x51_0a11,
    );
  }
  for (const [index, loop] of (spec.loopShoals ?? []).entries()) {
    mountShoal(ellipseLoopStations(spec.frame, loop), loop, 0x52_0b00 + index);
  }

  // ── Light ─────────────────────────────────────────────────────────────────
  for (const [index, light] of (spec.lights ?? []).entries()) {
    if (light.kind === "dapple") {
      const { x, z } = spec.frame.worldOf(light.centerU, light.centerV);
      const build = buildDappleSheet({
        seed: (spec.seed ^ (0x53_0c00 + index)) >>> 0,
        tint: light.tint,
        ground: (gx, gz) => spec.frame.ground(gx, gz),
        area: { center: [x, z], radius: light.radius },
        ...(light.opacity !== undefined ? { opacity: light.opacity } : {}),
        ...(light.tileMetres !== undefined ? { tileMetres: light.tileMetres } : {}),
      });
      group.add(build.group);
      draws += build.draws;
      triangles += build.triangles;
      updates.push(build.update);
      disposers.push(() => build.dispose());
      continue;
    }

    const axisX = Math.cos(spec.frame.azimuth);
    const axisZ = Math.sin(spec.frame.azimuth);
    const toWorldSlant = (
      slant: readonly [number, number],
    ): readonly [number, number] => [
      slant[0] * axisX - slant[1] * axisZ,
      slant[0] * axisZ + slant[1] * axisX,
    ];

    const build = buildBeamAndPool({
      seed: (spec.seed ^ (0x54_0d00 + index)) >>> 0,
      tint: light.tint,
      ground: (gx, gz) => spec.frame.ground(gx, gz),
      beams:
        light.kind === "shafts"
          ? light.beams.map((beam) => {
              const { x, z } = spec.frame.worldOf(beam.u, beam.v);
              return {
                pos: [x, z] as const,
                top: beam.top,
                width: beam.width,
                opacity: beam.opacity,
                ...(beam.slant ? { slant: toWorldSlant(beam.slant) } : {}),
              };
            })
          : [],
      ...(light.kind === "pools"
        ? {
            pools: light.pools.map((pool) => {
              const { x, z } = spec.frame.worldOf(pool.u, pool.v);
              return { pos: [x, z] as const, radius: pool.radius, opacity: pool.opacity };
            }),
          }
        : light.pools === "none"
          ? { pools: [] }
          : {}),
    });
    group.add(build.group);
    draws += build.draws;
    triangles += build.triangles;
    disposers.push(() => build.dispose());
  }

  // ── Ribbons ───────────────────────────────────────────────────────────────
  for (const [index, ribbon] of (spec.ribbons ?? []).entries()) {
    const polyline = ribbon.polyline.map(([u, v]) => {
      const { x, z } = spec.frame.worldOf(u, v);
      return [x, z] as [number, number];
    });
    const build = buildGroundLitter({
      seed: (spec.seed ^ (0x55_0e00 + index)) >>> 0,
      palette: ribbon.palette,
      area: { polyline, width: ribbon.width },
      gate: ribbon.gate ?? (() => 1),
      ground: (gx, gz) => spec.frame.ground(gx, gz),
      count: ribbon.count,
      ...(ribbon.shapeSet !== undefined ? { shapeSet: ribbon.shapeSet } : {}),
      ...(ribbon.size !== undefined ? { size: ribbon.size } : {}),
      ...(ribbon.twoTone !== undefined ? { twoTone: ribbon.twoTone } : {}),
      ...(ribbon.grade !== undefined ? { grade: ribbon.grade } : {}),
      ...(ribbon.rake !== undefined ? { rake: ribbon.rake } : {}),
    });
    group.add(build.group);
    draws += build.draws;
    triangles += build.triangles;
    disposers.push(() => build.dispose());
  }

  return {
    group,
    draws,
    triangles,
    colliders,
    shoalStations,
    update(timeSec: number): void {
      for (const update of updates) {
        update(timeSec);
      }
    },
    dispose(): void {
      for (const dispose of disposers) {
        dispose();
      }
      group.clear();
      group.removeFromParent();
    },
  };
}
