import type { MythicDefinition } from "../MythicTypes";
import { LanternLeviathanSystem } from "../leviathan/LanternLeviathanSystem";
import { paintLanternLeviathanPortrait } from "../leviathan/LeviathanPortrait";

/**
 * The Lantern Leviathan: a whale-spirit hung with lantern barnacles,
 * crossing the far water beyond the wings on a long visitor schedule (the
 * `VisitorSchedule` idiom: first pass minutes in, then rare) — a silhouette
 * with running lights, enormous and calm. Blender GLB
 * `creature-lantern-leviathan.glb` (3393 tris of a 6000 budget, lantern rows
 * authored bright in `COLOR_0`). Draws only from `SEEDS.mythLeviathan` and
 * its substreams; `leviathan/` carries the arc, the system and the plate.
 */
export const LANTERN_LEVIATHAN: MythicDefinition = {
  entry: {
    id: "myth-lantern-leviathan",
    commonName: "Lantern Leviathan",
    scientificName: "Balaena lucerna",
    fact: "The barnacles on its back glow in rows, like a town seen from a night ferry.",
    codexLine: "It carries its harbour with it, and every light is somebody home.",
  },
  habitatHint: "Now and then, far past everything, a row of lights crosses the blue.",
  portrait: paintLanternLeviathanPortrait,
  build: () => {
    const system = new LanternLeviathanSystem();
    return { system, targets: [system.target] };
  },
};
