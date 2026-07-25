/**
 * Data-only description of a moray species. Individuality comes from
 * configuration (proportions, colours, pattern, facts) rather than a bespoke
 * renderer, following the blueprint principle of "individual source assets,
 * shared runtime machinery".
 */
export type BodyArchetype = "ribbon" | "standard" | "robust" | "compact";

export type PatternKind = "spots" | "bands" | "plain";

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
];
