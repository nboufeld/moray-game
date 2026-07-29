/**
 * Data-only description of a moray species. Individuality comes from
 * configuration (proportions, colours, pattern, facts) rather than a bespoke
 * renderer, following the blueprint principle of "individual source assets,
 * shared runtime machinery".
 */
export type BodyArchetype = "ribbon" | "standard" | "robust" | "compact";

export type PatternKind = "spots" | "bands" | "plain" | "speckle";

export interface MoraySpeciesConfig {
  readonly id: string;
  readonly commonName: string;
  readonly scientificName: string;
  readonly archetype: BodyArchetype;
  /** Primary body colour (hex). */
  readonly bodyColor: number;
  /** Pattern colour (hex) — rosettes, bands or flecks. */
  readonly patternColor: number;
  /** Accent colour (hex) for fin margin and nasal appendages. */
  readonly accentColor: number;
  readonly pattern: PatternKind;
  /**
   * Painted albedo for the body tube, as a path under `public/assets/`.
   *
   * Optional, and only ever an upgrade: a species without one — or one whose
   * file is missing at runtime — wears the procedural skin `MorayPattern`
   * builds from the colours above, which stays the fallback for all of them.
   */
  readonly albedoAsset?: string;
  /** Slender ribbon and ornate dragon morays carry raised nasal appendages. */
  readonly nasalAppendages: boolean;
  /** Relative body length multiplier for the shared rig. */
  readonly lengthScale: number;
  /** Relative body girth multiplier for the shared rig. */
  readonly girthScale: number;
  /** A short, gentle field-guide fact shown in the codex. */
  readonly fact: string;
  /** Habitat hint surfaced by the hint ladder. */
  readonly habitatHint: string;
}

export const MORAY_SPECIES: readonly MoraySpeciesConfig[] = [
  {
    id: "snowflake-moray",
    commonName: "Snowflake moray",
    scientificName: "Echidna nebulosa",
    archetype: "compact",
    bodyColor: 0xf3ead6,
    patternColor: 0x3b3730,
    accentColor: 0xf6c667,
    pattern: "spots",
    albedoAsset: "creatures/moray-snowflake-albedo.png",
    nasalAppendages: false,
    lengthScale: 1,
    girthScale: 1.05,
    fact: "A cream body dusted with dark rosettes. Its rounded, approachable head makes it a gentle first find.",
    habitatHint: "Look beneath the broad coral shelf in the warm shallows, straight ahead of where you began.",
  },
  {
    id: "ribbon-moray",
    commonName: "Ribbon moray",
    scientificName: "Rhinomuraena quaesita",
    archetype: "ribbon",
    bodyColor: 0x2b6fff,
    patternColor: 0x2b6fff,
    accentColor: 0xffd23a,
    pattern: "plain",
    albedoAsset: "creatures/moray-ribbon-albedo.png",
    nasalAppendages: true,
    lengthScale: 1.35,
    girthScale: 0.55,
    fact: "A slender ribbon of electric blue with a bright yellow fin margin and flaring nostrils that read even from afar.",
    habitatHint: "Its long silhouette drifts near the coral to your left, where the sea grass thins.",
  },
  {
    id: "zebra-moray",
    commonName: "Zebra moray",
    scientificName: "Gymnomuraena zebra",
    archetype: "robust",
    bodyColor: 0x24201d,
    patternColor: 0xe8e0cf,
    accentColor: 0xcbbfa6,
    pattern: "bands",
    albedoAsset: "creatures/moray-zebra-albedo.png",
    nasalAppendages: false,
    lengthScale: 1.0,
    girthScale: 1.35,
    fact: "Heavy and blunt-headed, wrapped in strong pale bands. It favours crushing snails over chasing fish.",
    habitatHint: "Watch the boulders to your right — its bold banding hides in the rock shadow.",
  },
  {
    id: "dragon-moray",
    commonName: "Dragon moray",
    scientificName: "Enchelycore pardalis",
    archetype: "standard",
    bodyColor: 0xb5432a,
    patternColor: 0xf4e9d0,
    accentColor: 0xffb347,
    pattern: "spots",
    albedoAsset: "creatures/moray-dragon-albedo.png",
    nasalAppendages: true,
    lengthScale: 1.1,
    girthScale: 0.95,
    fact: "An ornate face of orange and cream with raised nasal tubes and hooked jaws — the reef's most dramatic reveal.",
    habitatHint: "Deeper in, behind you and to the left, an ornate face waits in the darker rocks.",
  },
  {
    /**
     * The fifth moray (W-M3), and the only animal that does not live in the
     * bowl: its den is on the canyon floor past the rim's gate, so finding it
     * is a journey rather than a turn of the head. Deliberately procedural —
     * no `albedoAsset` — because the fallback skin is a shipping surface in
     * this project and a creature of the dark is the one animal a hand-glazed
     * painting serves least: its markings are points of pallor on a body that
     * is mostly value, which is exactly what `MorayPattern`'s speckle draws.
     */
    id: "abyss",
    commonName: "Abyssal moray",
    scientificName: "Gymnothorax bathyphilus",
    archetype: "standard",
    // Dark violet-charcoal, not black: the darkest thing in this world is a
    // colour, and this animal lives beside the violet the canyon's fog and
    // shadows are mixed from.
    bodyColor: 0x37324e,
    // Moonlit pale blue-white — the "luminous" is value against the body,
    // not emission; nothing on an animal may bloom.
    patternColor: 0xdde6f4,
    accentColor: 0x8fa8d8,
    pattern: "speckle",
    nasalAppendages: false,
    lengthScale: 1.2,
    girthScale: 0.9,
    fact: "A hermit of the twilight canyon, charcoal-violet and dusted with pale speckles like a night of faint stars.",
    habitatHint: "Past the rim itself — over your right shoulder from where you began, a gate of stone opens into darker water.",
  },
];
