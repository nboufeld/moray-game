import type { Group, Object3D, Scene } from "three";
import type { SphereCollider } from "../CollisionField";
import type { ContactPatch } from "../Seabed";
import type { WingMoodTables } from "../wings/WingTypes";
import type { LifeContext } from "../../creatures/life/LifeSystem";
import type { DiscoveryTarget } from "../../discovery/DiscoverySystem";
import type { CodexEntry } from "../../ui/Codex";

/**
 * R0 — a region: a whole place the size of the original game, streamed in
 * under the diver by `RegionStreamer` and never visible from anywhere the
 * fog does not already end.
 *
 * The split that matters:
 *
 * - **The pure half** (terrain, domain, mood) is data — seeded functions
 *   with no scene objects — and is ALWAYS live: `seabedHeight` composes
 *   every region's terrain whether or not it is built, so tests, bakes and
 *   placements sample one truth. It must be deterministic and cheap.
 * - **The built half** (`build()`) makes the scene objects, colliders and
 *   populations, and only exists while the streamer keeps it.
 *
 * A region owns everything inside its domain: ground sheets, rocks, flora,
 * creatures, its own painted far silhouettes, its capture poses. It may
 * not touch anything outside it — the bowl, the wings, the canyon and its
 * sibling regions keep their bit-identity the same way they always have.
 */
export interface RegionBuild {
  /** The region's whole scene graph, positioned in world space. */
  readonly group: Group | Object3D;
  /** Solid things the diver is turned away from, inside the domain only. */
  readonly colliders: readonly SphereCollider[];
  /** For the region's own ground bake, if it takes one — informational. */
  readonly contacts?: readonly ContactPatch[];
  /** Discovery targets for anything findable living here. */
  readonly targets?: readonly DiscoveryTarget[];
  /** Per-frame life; receives the standing life context. */
  update?(dt: number, ctx: LifeContext): void;
  /** Optional release; unbuilt regions stay cached by default. */
  dispose?(): void;
}

export interface RegionCapturePose {
  readonly name: string;
  readonly position: readonly [number, number, number];
  readonly yaw: number;
  readonly pitch: number;
  readonly settle: number;
}

export interface RegionDef {
  /** Must match a `REGION_SLOTS` id. */
  readonly slotId: string;
  readonly title: string;
  readonly emotion: string;

  // ── The pure half ─────────────────────────────────────────────────────
  /**
   * Ownership weight in [0, 1]: 1 in the region's heart, feathering to
   * exactly 0 at the domain's edge (structural early-return, not small
   * numbers). Drives the terrain blend, the mood blend and the bounds
   * handover. Must cover the approach tongue for depth-1 regions.
   */
  weight(x: number, z: number): number;
  /** The floor the region's terrain is carved toward, in world metres. */
  terrainTarget(x: number, z: number): number;
  /** Swim ceiling over the domain, world metres. */
  ceiling(x: number, z: number): number;
  readonly floorClearance: number;
  /** Water and light, the standing composition shape. */
  readonly mood: WingMoodTables;
  readonly moodSurface: number;
  readonly moodDescent: number;

  // ── The built half ────────────────────────────────────────────────────
  build(scene: Scene): RegionBuild;

  /**
   * Codex cards for every findable species this region's targets can
   * discover — part of the pure half, so a save restores its cards
   * without the region being built.
   */
  readonly codexEntries?: readonly CodexEntry[];

  /** The region's own canonical shot set, for `scripts/region-shots.mjs`. */
  readonly capturePoses: readonly RegionCapturePose[];
}
