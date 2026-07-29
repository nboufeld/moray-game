import type { MythicDefinition, MythicBuild } from "../MythicTypes";
import { GentleDarkSystem } from "../gentledark/GentleDarkSystem";
import { paintGentleDarkPortrait } from "../gentledark/portrait";

/**
 * The Gentle Dark: an umibōzu of the drop-off — a colossal smooth
 * head-and-shoulders silhouette that rises slowly past the Open Blue's far
 * curtain (beyond r 48, outside the swimmable cap), regards the water with
 * two soft glowing eyes, and sinks away. Rare (minutes apart), unhurried,
 * never approaching. The GLB `creature-gentle-dark.glb` is a smooth hull
 * (budget 2000 tris); until it lands a three-sphere stand-in holds the same
 * silhouette. Draw only from `SEEDS.mythUmibozu`.
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
  portrait: paintGentleDarkPortrait,
  build: (): MythicBuild => {
    const system = new GentleDarkSystem();
    return { system, targets: system.targets };
  },
};
