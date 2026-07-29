import type { Scene } from "three";
import type { MythicDefinition } from "../MythicTypes";

/**
 * STUB — owned by wave-8 worker W9. The Lantern Leviathan: a whale-spirit
 * hung with lantern barnacles, crossing the far water beyond the wings on
 * a long visitor schedule (the `VisitorSchedule` idiom: first pass minutes
 * in, then rare) — a silhouette with running lights, enormous and calm.
 * Blender GLB `creature-lantern-leviathan.glb` (budget 5000 tris,
 * emissive-authored lantern rows via COLOR_0). Draw only from
 * `SEEDS.mythLeviathan`.
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
  build: () => ({
    system: {
      addTo(_scene: Scene): void {},
      update(): void {},
      dispose(): void {},
    },
    targets: [],
  }),
};
