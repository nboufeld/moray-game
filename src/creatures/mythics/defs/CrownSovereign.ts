import type { Scene } from "three";
import type { MythicDefinition } from "../MythicTypes";

/**
 * STUB — owned by wave-8 worker W7. The Crown Jelly Sovereign: a giant
 * crowned jelly rising and sinking through its own glow column in the
 * Lumen Garden's deepest dark (the `JellyBloom` idiom at throne scale,
 * emissive crown). Blender GLB `creature-crown-jelly.glb` (budget 3000
 * tris). Lives near the wing's heart, r ≈ 42 on the lumen-garden axis.
 * Draw only from `SEEDS.mythSovereign`.
 */
export const CROWN_SOVEREIGN: MythicDefinition = {
  entry: {
    id: "myth-crown-sovereign",
    commonName: "Crown Jelly Sovereign",
    scientificName: "Corona abyssi",
    fact: "Its bell carries a ring of light the deep garden grew for it, petal by petal.",
    codexLine: "The garden glows because something must hold court, and it holds it gently.",
  },
  habitatHint: "The Lumen Garden's glow gathers around something that rises and sinks.",
  build: () => ({
    system: {
      addTo(_scene: Scene): void {},
      update(): void {},
      dispose(): void {},
    },
    targets: [],
  }),
};
