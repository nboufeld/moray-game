/**
 * Data-only description of a moray species. Individuality comes from
 * configuration (proportions, colours, facts) rather than a bespoke renderer,
 * following the blueprint principle of "individual source assets, shared
 * runtime machinery".
 */
export type BodyArchetype = "ribbon" | "standard" | "robust" | "compact";

export interface MoraySpeciesConfig {
  readonly id: string;
  readonly commonName: string;
  readonly scientificName: string;
  readonly archetype: BodyArchetype;
  /** Primary body colour (hex). */
  readonly bodyColor: number;
  /** Secondary / pattern colour (hex). */
  readonly patternColor: number;
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
    lengthScale: 1,
    girthScale: 1.05,
    fact: "A cream body dusted with dark rosettes. Its rounded, approachable head makes it a gentle first find.",
    habitatHint: "Look beneath broad coral shelves in the warm shallows.",
  },
];
