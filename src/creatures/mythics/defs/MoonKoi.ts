import type { Scene } from "three";
import type { MythicDefinition } from "../MythicTypes";

/**
 * STUB — owned by wave-8 worker W8. The Moon Koi: a ningyo spirit in the
 * shape of a great pale koi, trailing a silk of fin, circling the Moonlit
 * Lagoon's stillest pool in a slow figure the diver can learn. Silver-white
 * with a blush of rose under the moon-dim key. Blender GLB
 * `creature-moon-koi.glb` (budget 3500 tris, spine joints). Draw only from
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
  build: () => ({
    system: {
      addTo(_scene: Scene): void {},
      update(): void {},
      dispose(): void {},
    },
    targets: [],
  }),
};
