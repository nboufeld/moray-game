import type { MythicDefinition } from "../MythicTypes";
import { IslandElderSystem } from "../elder/IslandElderSystem";
import { paintElderPortrait } from "../elder/ElderPortrait";

/**
 * The Island That Swims: a turtle elder of colossal age drifting beneath
 * the Sargassum Sky, its shell a hanging garden — moss, small corals, a
 * couple of golden tufts — the size of a room. The turtle idiom
 * (`Turtle.ts`) at monument scale, slower than anything else alive. Blender
 * GLB `creature-island-turtle.glb` (3172 tris of a 6000 budget, the garden
 * authored in with `COLOR_0`). Draws only from `SEEDS.mythElder`; `elder/`
 * carries the circuit, the system and the plate.
 */
export const ISLAND_THAT_SWIMS: MythicDefinition = {
  entry: {
    id: "myth-island-that-swims",
    commonName: "The Island That Swims",
    scientificName: "Chelonia insula",
    fact: "Whole generations of fish have lived on its shell without touching the reef.",
    codexLine: "Patience, given long enough, becomes geography.",
  },
  habitatHint: "Under the golden canopy, the floor sometimes moves — all of it at once.",
  portrait: paintElderPortrait,
  build: () => {
    const system = new IslandElderSystem();
    return { system, targets: [system.target] };
  },
};
