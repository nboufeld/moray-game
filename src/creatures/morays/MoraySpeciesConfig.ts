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
  // ─── Wave 8 (W6): the four wing residents ────────────────────────────────
  // All four wear the procedural skin only — no `albedoAsset`, like the
  // abyss — because each of them is described the way `MorayPattern` already
  // paints: a sheen, a banding, a dusting of embers, a pearl lustre. Dens
  // live in `WingDens.ts`; personalities in `MorayPersonality.ts`.
  {
    id: "golden-dwarf-moray",
    commonName: "Golden dwarf moray",
    scientificName: "Gymnothorax melatremus",
    archetype: "compact",
    // Luminous gold, not white-hot: the value is high but the hue is pure
    // sun, and the plain pattern's faint cream mottle stands in for the pale
    // belly of a real dwarf moray — the counter-shading lifts it further.
    bodyColor: 0xe9b83c,
    patternColor: 0xf6e8c8,
    // A deeper honey on the fin margin, so the fin reads against the body.
    accentColor: 0xd89a2b,
    pattern: "plain",
    nasalAppendages: false,
    lengthScale: 0.75,
    girthScale: 0.7,
    fact: "A dwarf among morays, gold through and through with a cream belly — brave in short, bright bursts.",
    habitatHint: "Past the rim behind you, a shade right of straight back, where the water climbs warm and bright into the nursery shallows.",
  },
  {
    id: "frost-moray",
    commonName: "Frost moray",
    scientificName: "Gymnothorax pruinosus",
    archetype: "robust",
    // Ice-blue with glacial white bands. The white is a blue that stopped
    // just short of paper — the abyss's pale speckle established that a
    // near-white marking here is still a colour, never a hole in the paint.
    bodyColor: 0x9ec7e8,
    patternColor: 0xf0f6fa,
    accentColor: 0x6fa8d8,
    pattern: "bands",
    nasalAppendages: false,
    lengthScale: 1.1,
    girthScale: 1.3,
    fact: "Broad and unhurried, banded like pack ice. In the cold still water it simply out-waits everything.",
    habitatHint: "Ahead and to your right, far past the rim, where the water goes cold and quiet — the ice grotto.",
  },
  {
    id: "ember-moray",
    commonName: "Ember moray",
    scientificName: "Gymnothorax favillus",
    archetype: "standard",
    // Warm charcoal, red held above green: the darkest animal in the vents
    // is still a colour. The embers are bright painted value on the body —
    // a glow an illustrator would glaze on, never a light the shader emits.
    bodyColor: 0x3e3230,
    patternColor: 0xffa83c,
    accentColor: 0xe2702e,
    pattern: "speckle",
    nasalAppendages: false,
    lengthScale: 1.0,
    girthScale: 0.95,
    fact: "Charcoal-dark and dusted with embers, like a banked fire. It keeps the warm springs and its own counsel.",
    habitatHint: "Behind you and well to the left, where warm springs breathe up through the dark floor of the vents.",
  },
  {
    id: "pearl-moray",
    commonName: "Pearl moray",
    scientificName: "Gymnothorax margaritifer",
    archetype: "standard",
    // Pearl-white, and the value key holds even here: red sits above green
    // so the palest animal in the game still leans warm, never paper. The
    // plain pattern's faint mottle is the rose-gold sheen — a lustre, not
    // a marking, which is exactly what a low-contrast mottle paints.
    bodyColor: 0xf0e9e4,
    patternColor: 0xe4bca6,
    accentColor: 0xd9a58f,
    pattern: "plain",
    nasalAppendages: true,
    lengthScale: 1.0,
    girthScale: 0.75,
    fact: "Near-translucent white with a rose-gold sheen — the ghost reef's gentle haunting.",
    habitatHint: "Ahead and to your left, out past the rim, where the old reef stands pale in the water — the ghost reef.",
  },
];
