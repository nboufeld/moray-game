import type { Scene } from "three";
import type { MythicDefinition } from "../MythicTypes";

/**
 * STUB — owned by wave-8 worker W7. The Reef Kirin: a seahorse-deer spirit
 * with antlers of living coral, grazing between the Ruins Terrace's fallen
 * columns — unhurried, upright, occasionally lifting its head to look at
 * the diver the way deer do. Blender GLB `creature-kirin.glb` (budget 4500
 * tris, joints for head/tail). Draw only from `SEEDS.mythKirin`.
 */
export const REEF_KIRIN: MythicDefinition = {
  entry: {
    id: "myth-reef-kirin",
    commonName: "Reef Kirin",
    scientificName: "Hippocampus cervus",
    fact: "Its antlers are true coral, and small fish shelter in them as it walks.",
    codexLine: "The ruins keep their oldest tenant, and it keeps their garden.",
  },
  habitatHint: "Between the fallen columns of the Ruins Terrace, something grazes.",
  build: () => ({
    system: {
      addTo(_scene: Scene): void {},
      update(): void {},
      dispose(): void {},
    },
    targets: [],
  }),
};
