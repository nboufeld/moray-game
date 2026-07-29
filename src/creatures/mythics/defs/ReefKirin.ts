import type { MythicDefinition } from "../MythicTypes";
import { ReefKirin } from "../kirin/ReefKirin";
import { paintReefKirinPortrait } from "../kirin/portrait";

/**
 * The Reef Kirin: a seahorse-deer spirit with antlers of living coral,
 * grazing between the Ruins Terrace's fallen columns — unhurried, upright,
 * lifting its head to look at a slow diver the way deer do. Blender GLB
 * `creature-kirin.glb` (budget 4500 tris; neck/head/tail joints). Draws
 * only from `SEEDS.mythKirin`. Built by wave-8 worker W7.
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
  portrait: paintReefKirinPortrait,
  build: () => {
    const system = new ReefKirin();
    return { system, targets: [system.target] };
  },
};
