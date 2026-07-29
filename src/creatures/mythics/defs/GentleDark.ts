import type { Scene } from "three";
import type { MythicDefinition } from "../MythicTypes";

/**
 * STUB — owned by wave-8 worker W8. The Gentle Dark: an umibōzu of the
 * drop-off — a colossal smooth head-and-shoulders silhouette that rises
 * slowly past the Open Blue's far curtain (beyond r 48), regards the
 * water with two soft glowing eyes, and sinks away. Rare (minutes apart),
 * unhurried, never approaching. Mostly silhouette material against the
 * backdrop; the GLB `creature-gentle-dark.glb` is a smooth hull (budget
 * 2000 tris). Draw only from `SEEDS.mythUmibozu`.
 */
export const GENTLE_DARK: MythicDefinition = {
  entry: {
    id: "myth-gentle-dark",
    commonName: "The Gentle Dark",
    scientificName: "Umbra placida",
    fact: "It surfaces the way a thought does: slowly, completely, and without a sound.",
    codexLine: "The deep is not empty. It is company, at the distance company keeps.",
  },
  habitatHint: "Past the drop-off's last blue, something enormous rises and regards.",
  build: () => ({
    system: {
      addTo(_scene: Scene): void {},
      update(): void {},
      dispose(): void {},
    },
    targets: [],
  }),
};
