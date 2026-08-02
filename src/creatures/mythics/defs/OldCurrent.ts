import type { MythicDefinition } from "../MythicTypes";
import { OldCurrent } from "../serpent/OldCurrent";
import { paintOldCurrentPortrait } from "../serpent/portrait";

/**
 * The Old Current: a benevolent sea serpent the length of the drop-off
 * itself, patrolling the Open Blue's middle water in slow banked
 * figure-eights (the `BankedArc` idiom at ten times the scale). Blender
 * GLB `creature-serpent.glb` (budget 6000 tris, skinned seven-joint spine,
 * CREATURES.md contracts), radial band r 38–48, heights 3–8. Draws only
 * from `SEEDS.mythSerpent`. Built by wave-8 worker W7.
 */
export const OLD_CURRENT: MythicDefinition = {
  entry: {
    id: "myth-old-current",
    commonName: "The Old Current",
    scientificName: "Serpens benevolens",
    fact: "A serpent so long the divers who met it disagreed about whether it had ended.",
    codexLine: "It has circled the drop-off since before the reef had a name, and it is not lost.",
  },
  habitatHint: "Something vast keeps a slow circuit out in the Open Blue.",
  portrait: paintOldCurrentPortrait,
  build: () => {
    const system = new OldCurrent();
    return { system, targets: [system.target] };
  },
};
