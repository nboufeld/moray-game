import type { Scene } from "three";
import type { MythicDefinition } from "../MythicTypes";

/**
 * STUB — owned by wave-8 worker W8. The Kraken Hatchling: a shy octopus
 * child denned in the Sea-Glass Cove's pebble drifts, arms curling and
 * uncurling, chromatophore patterns rippling when calm and blanching when
 * startled (the moray presence-cycle idiom: peek, extend, startle, tuck).
 * Blender GLB `creature-kraken-hatchling.glb` (budget 4000 tris, jointed
 * arms). Draw only from `SEEDS.mythKraken`.
 */
export const KRAKEN_HATCHLING: MythicDefinition = {
  entry: {
    id: "myth-kraken-hatchling",
    commonName: "Kraken Hatchling",
    scientificName: "Architeuthis pupa",
    fact: "Its patterns ripple with its moods, and its moods are mostly curiosity.",
    codexLine: "Legends begin small, and this one is still collecting pretty pebbles.",
  },
  habitatHint: "The glass drifts of the cove rearrange themselves around a den.",
  build: () => ({
    system: {
      addTo(_scene: Scene): void {},
      update(): void {},
      dispose(): void {},
    },
    targets: [],
  }),
};
