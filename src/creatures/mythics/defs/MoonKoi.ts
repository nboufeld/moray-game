import type { MythicDefinition, MythicBuild } from "../MythicTypes";
import { MoonKoiSystem } from "../moonkoi/MoonKoiSystem";
import { paintMoonKoiPortrait } from "../moonkoi/portrait";

/**
 * The Moon Koi: a ningyo spirit in the shape of a great pale koi, trailing a
 * silk of fin, circling the Moonlit Lagoon's stillest pool — r ≈ 40 on the
 * axis, a 4 m circle at y ≈ 2.5, one slow revolution in 25 s, the body bent
 * along the circle and the ribbon trailing with delay. It meets a calm diver
 * half a metre closer and yields half a metre to a fast one. The GLB
 * `creature-moon-koi.glb` (budget 3500 tris, five spine joints and two
 * ribbon joints) is silver-white with a rose blush and a deep-blue eye;
 * until it lands a segmented stand-in swims the same figure. Draw only from
 * `SEEDS.mythMoonKoi`.
 */
export const MOON_KOI: MythicDefinition = {
  entry: {
    id: "myth-moon-koi",
    commonName: "Moon Koi",
    scientificName: "Cyprinus lunae",
    fact: "It swims the same circle every night, and the circle is the shape of the moon.",
    codexLine: "Somewhere a garden pond misses it. It writes home in ripples.",
  },
  habitatHint: "The lagoon's silver holds a circle that never quite closes.",
  portrait: paintMoonKoiPortrait,
  build: (): MythicBuild => {
    const system = new MoonKoiSystem();
    return { system, targets: system.targets };
  },
};
