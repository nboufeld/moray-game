import type { MythicDefinition } from "../MythicTypes";
import { CrownSovereign } from "../sovereign/CrownSovereign";
import { paintCrownSovereignPortrait } from "../sovereign/portrait";

/**
 * The Crown Jelly Sovereign: a giant crowned jelly rising and sinking
 * through its own glow column in the Lumen Garden's deepest dark (the
 * `JellyBloom` idiom at throne scale, the coronet a painted lamp). Blender
 * GLB `creature-crown-jelly.glb` (budget 3000 tris). Lives near the wing's
 * heart, r ≈ 42 on the lumen-garden axis, y 1–5. Draws only from
 * `SEEDS.mythSovereign`. Built by wave-8 worker W7.
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
  portrait: paintCrownSovereignPortrait,
  build: () => {
    const system = new CrownSovereign();
    return { system, targets: [system.target] };
  },
};
