import type { MythicDefinition, MythicBuild } from "../MythicTypes";
import { KrakenHatchlingSystem } from "../kraken/KrakenHatchlingSystem";
import { paintKrakenPortrait } from "../kraken/portrait";

/**
 * The Kraken Hatchling: a shy octopus child denned in the Sea-Glass Cove's
 * pebble drifts, arms curling and uncurling, chromatophore patterns rippling
 * when calm and blanching when startled — the moray presence-cycle idiom
 * (peek, extend, startle, tuck) re-expressed at half a metre. The GLB
 * `creature-kraken-hatchling.glb` (budget 4000 tris, eight arm joints) is
 * authored in the pale tint set; until it lands a cone-and-bulb stand-in
 * holds the same pivots. Draw only from `SEEDS.mythKraken`.
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
  portrait: paintKrakenPortrait,
  build: (): MythicBuild => {
    const system = new KrakenHatchlingSystem();
    return { system, targets: system.targets };
  },
};
