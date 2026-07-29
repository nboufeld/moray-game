import type { Scene } from "three";
import type { MythicDefinition } from "../MythicTypes";

/**
 * STUB — owned by wave-8 worker W9. The Island That Swims: a turtle elder
 * of colossal age drifting beneath the Sargassum Sky, its shell a hanging
 * garden — moss, small corals, a resident shoal — the size of a room. The
 * turtle idiom (`Turtle.ts`) at monument scale, slower than anything else
 * alive. Blender GLB `creature-island-turtle.glb` (budget 6000 tris,
 * shell-garden authored in). Draw only from `SEEDS.mythElder`.
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
  build: () => ({
    system: {
      addTo(_scene: Scene): void {},
      update(): void {},
      dispose(): void {},
    },
    targets: [],
  }),
};
