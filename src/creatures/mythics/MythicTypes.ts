import type { LifeSystem } from "../life/LifeSystem";
import type { DiscoveryTarget } from "../../discovery/DiscoverySystem";

/**
 * Wave 8: the mythic creatures — the beings the reef tells stories about.
 * Each one is self-contained: its own module, its own Blender build script,
 * its own seed stream, its own behaviours — registered through
 * `MythicRegistry` so `Game.ts` is edited by nobody.
 *
 * A mythic is a {@link LifeSystem} (added to the scene and stepped with the
 * frame like every other population) plus zero or more discovery targets
 * (found the same way a moray is: approach, centre, hold). Discovered
 * mythics join the codex with their own card; they do not join the
 * sanctuary — a being that size is visited, not kept.
 */

/** The codex card a discovered mythic files. */
export interface MythicCodexEntry {
  /** Stable id; also the save-file discovery key. Never change it. */
  readonly id: string;
  readonly commonName: string;
  readonly scientificName: string;
  /** The field-guide fact. */
  readonly fact: string;
  /** The storybook line under it — who this being is. */
  readonly codexLine: string;
}

export interface MythicBuild {
  /** The creature itself; `Game` registers it with the life registry. */
  readonly system: LifeSystem;
  /**
   * Where discovery can happen. Fixed at construction (the array is handed
   * to `DiscoverySystem` once); mutate each target's `position` per frame
   * the way the morays do. Empty for a stub.
   */
  readonly targets: readonly DiscoveryTarget[];
}

export interface MythicDefinition {
  readonly entry: MythicCodexEntry;
  /** One line for the hint ladder: where to look. */
  readonly habitatHint: string;
  /**
   * Optional codex plate: a data URL (render offscreen or paint a canvas).
   * Called once, deferred until authored assets have settled. Absent, the
   * card keeps its empty frame — complete without the image, as every card
   * is.
   */
  readonly portrait?: () => string | null;
  build(): MythicBuild;
}
