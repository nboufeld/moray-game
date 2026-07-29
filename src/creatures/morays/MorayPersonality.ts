import { SEEDS } from "../../util/Random";
import { NEUTRAL_PRESENCE_STYLE, type PresenceStyle } from "./MorayPresence";

/**
 * Who each moray *is* (W-M2). W-L7 gave every animal a seeded individual
 * temperament; this module makes personality a species trait layered over it —
 * the snowflake is always the shy one and the dragon always the sovereign,
 * while the seeded draws still decide exactly how shy this snowflake is.
 *
 * Everything here is a parameter set that feeds existing machinery. The
 * `presence` half biases the W-L7 state machine (`PresenceStyle` documents
 * the rule: caps, opening hold and reduced-motion damping are untouchable);
 * the `motion` half styles what `Moray.update` already animates — sway, gaze,
 * jaw — and adds exactly one new expression, the ribbon's ripple, whose
 * per-individual timing draws from `SEEDS.personality` so it can never
 * re-roll a presence stream.
 *
 * The lookup is deliberately tolerant in both directions: a species without a
 * profile wears {@link DEFAULT_PERSONALITY} (sensible neutral defaults), and a
 * profile without a species — the "abyss" hermit, whose species another
 * package is adding concurrently — is harmless dead data until its animal
 * arrives. Neither worker can block the other.
 */

/** How a species carries itself: multipliers on Moray.update's own terms.
 * All 1s (and ripple 0) is exactly the pre-personality animal. */
export interface MorayMotionStyle {
  /** Overall body-sway amplitude: the ribbon undulates, the hermit barely stirs. */
  readonly swayAmplitude: number;
  /** Sway clock rate: a dancer's quick beat against a dreamer's slow one. */
  readonly swayTempo: number;
  /** Multiplier on the extended-scan sway widening. */
  readonly scanSway: number;
  /** Extra sway gain earned by curiosity — the snowflake's dreamy sway once
   * trust is won. 0 for everyone else. */
  readonly curiositySway: number;
  /** Head-tracking blend rate: how eagerly the gaze finds the diver. */
  readonly lookRate: number;
  /** Head-tracking strength: the dragon's direct stare against the hermit's
   * sidelong glance. */
  readonly lookGain: number;
  /** Ventilation clock rate. */
  readonly breatheTempo: number;
  /** Scale on the sculpted jaw's lean-toward-closed; <1 carries the mouth wider. */
  readonly gapeBias: number;
  /** Scale on the attention gape (jaw language toward a watched diver). */
  readonly attendGape: number;
  /** Scale on the curiosity gape. */
  readonly curiousGape: number;
  /** Amplitude of the spontaneous full-body ripple; 0 means never. */
  readonly ripple: number;
  /**
   * Amplitude of the standing lateral sweep an extended animal wears (W-N3):
   * the body turns broadside and ribbons across the frame instead of
   * foreshortening into a lozenge behind the head. 0 keeps the ordinary
   * extended posture; only the dancer carries it.
   */
  readonly extendFlare: number;
}

export const NEUTRAL_MOTION_STYLE: MorayMotionStyle = {
  swayAmplitude: 1,
  swayTempo: 1,
  scanSway: 1,
  curiositySway: 0,
  lookRate: 1,
  lookGain: 1,
  breatheTempo: 1,
  gapeBias: 1,
  attendGape: 1,
  curiousGape: 1,
  ripple: 0,
  extendFlare: 0,
};

export interface MorayPersonality {
  readonly id: string;
  /** Biases on the W-L7 presence machine. */
  readonly presence: PresenceStyle;
  /** Styling on the animal's movement language. */
  readonly motion: MorayMotionStyle;
  /** One warm storybook sentence for the codex card. */
  readonly codexLine: string;
}

export const DEFAULT_PERSONALITY: MorayPersonality = {
  id: "default",
  presence: NEUTRAL_PRESENCE_STYLE,
  motion: NEUTRAL_MOTION_STYLE,
  codexLine: "Every moray keeps its own counsel; linger gently and its character will show.",
};

/**
 * The five characters. Values are biases on W-L7's measured baselines, and
 * the loudest ones are stated in what they mean:
 *
 * - **snowflake** — the shy dreamer. Tucked spells run 2.2× long, the startle
 *   trigger drops to 2.4 m/s (the e2e swim is protected by the untouched
 *   radius, not the speed), the post-startle sulk is half again longer and
 *   trust rebuilds at 1.5× the wary slowdown — but curiosity is biased high,
 *   so a patient diver still draws the full lean, and the sway blooms with it.
 * - **zebra** — the methodical patroller. `clockSpread` 0.15 closes every
 *   hold draw on its midpoint: peek, survey, rest, on an almost fixed beat.
 *   Startle threshold 1.6× and a low curiosity window — it barely reacts to
 *   the diver either way, and that reliability is the character. W-N3 gave
 *   its resting jaw a lower floor (`gapeBias` 1.75): a patroller at rest is
 *   not mid-yawn.
 * - **dragon** — the bold sovereign. Boldness windowed 0.85–0.98, extend
 *   chance 1.5× (capped), full reach, extended holds 2× — and a startle
 *   threshold of 7 m/s that the 8 m/s dive controller can barely graze. The
 *   gaze is the loudest tell: lookRate 1.6 and lookGain 1.35 turn the head
 *   to meet an approaching diver squarely, with the widest jaw language.
 * - **ribbon** — the playful dancer. Peeking and extended holds halved (quick
 *   frequent peeks), the fastest recovery in the reef (wary emerge 0.45×),
 *   1.3× sway at 1.25× tempo for the slender body, and the one spontaneous
 *   flourish: an occasional full-body ripple (see `Moray.update`). Extended,
 *   it also turns broadside (`extendFlare`, W-N3), so the flourish is a
 *   ribbon across the frame rather than a lozenge behind the head.
 * - **abyss** — the elusive hermit, keyed for the concurrent deep-canyon
 *   package. Tucks 3.2× long and rarely extends, but when it does the spell
 *   runs 2.6× — rare, calm, prolonged. Startle means almost nothing to it:
 *   a high trigger, and a withdraw at 6× the startle tau, a slow fold back
 *   into the dark rather than a bolt.
 *
 * Wave 8 (W6) appended four more — **golden dwarf** the playful one,
 * **frost** the calm one, **ember** the shy one, **pearl** the gentle one —
 * each stated where its loudest numbers land.
 */
const PROFILES: readonly MorayPersonality[] = [
  {
    id: "snowflake-moray",
    presence: {
      ...NEUTRAL_PRESENCE_STYLE,
      boldness: { min: 0.05, max: 0.3 },
      wariness: { min: 0.8, max: 0.99 },
      curiosity: { min: 0.7, max: 0.95 },
      tuckedHoldScale: 2.2,
      extendedHoldScale: 1.3,
      extendChanceScale: 0.7,
      reachScale: 0.9,
      startleSpeedScale: 0.75,
      startleHoldScale: 1.5,
      startleTauScale: 0.85,
      waryEmergeScale: 1.5,
      emergeTauScale: 1.15,
    },
    motion: {
      ...NEUTRAL_MOTION_STYLE,
      swayAmplitude: 0.95,
      swayTempo: 0.8,
      scanSway: 1.4,
      curiositySway: 0.6,
      lookRate: 0.7,
      lookGain: 0.9,
      breatheTempo: 0.9,
      attendGape: 0.8,
    },
    codexLine:
      "Shy as a first snowfall — wait quietly, and she will drift out to see you.",
  },
  {
    id: "zebra-moray",
    presence: {
      ...NEUTRAL_PRESENCE_STYLE,
      boldness: { min: 0.45, max: 0.6 },
      wariness: { min: 0.3, max: 0.45 },
      curiosity: { min: 0.1, max: 0.25 },
      clockSpread: 0.15,
      reachScale: 0.95,
      startleSpeedScale: 1.6,
      startleHoldScale: 0.8,
      waryEmergeScale: 0.9,
    },
    motion: {
      ...NEUTRAL_MOTION_STYLE,
      swayAmplitude: 0.85,
      swayTempo: 0.95,
      scanSway: 0.8,
      lookRate: 0.55,
      lookGain: 0.7,
      breatheTempo: 0.85,
      // W-N3: the resting mouth carried nearly the sculpt's full 11° gape,
      // and at K4's range on a 1.5× animal that read as mid-yawn — "a wooden
      // shoe". 2.0 leans the jaw a further 4.6° toward closed: rest now
      // swings ~2–6°, and the attention terms below came down with it
      // because K4's own staging (an attending, curious diver at arm's
      // length) was re-supplying most of what the bias removed. The mouth
      // never shuts: −11° is closed and the floor keeps ~1.8° of the baked
      // gape, which `tests/morayHead.test.ts` pins.
      gapeBias: 2.0,
      attendGape: 0.35,
      curiousGape: 0.3,
    },
    codexLine:
      "A patroller of steady habits — peek, survey, rest, and round again; you could set a tide-clock by her.",
  },
  {
    id: "dragon-moray",
    presence: {
      ...NEUTRAL_PRESENCE_STYLE,
      boldness: { min: 0.85, max: 0.98 },
      wariness: { min: 0.02, max: 0.15 },
      curiosity: { min: 0.7, max: 0.9 },
      tuckedHoldScale: 0.6,
      peekingHoldScale: 0.8,
      extendedHoldScale: 2,
      extendChanceScale: 1.5,
      reachScale: 1.1,
      startleSpeedScale: 2.2,
      startleHoldScale: 0.6,
      waryEmergeScale: 0.6,
      emergeTauScale: 0.85,
      retreatTauScale: 1.1,
    },
    motion: {
      ...NEUTRAL_MOTION_STYLE,
      swayAmplitude: 0.9,
      swayTempo: 0.85,
      lookRate: 1.6,
      lookGain: 1.35,
      gapeBias: 0.7,
      attendGape: 1.5,
      curiousGape: 1.4,
    },
    codexLine:
      "The sovereign of the deeper rocks — he does not hide from you; he watches you arrive.",
  },
  {
    id: "ribbon-moray",
    presence: {
      ...NEUTRAL_PRESENCE_STYLE,
      boldness: { min: 0.55, max: 0.8 },
      wariness: { min: 0.15, max: 0.35 },
      curiosity: { min: 0.6, max: 0.85 },
      tuckedHoldScale: 0.7,
      peekingHoldScale: 0.5,
      extendedHoldScale: 0.6,
      extendChanceScale: 1.2,
      startleHoldScale: 0.55,
      waryEmergeScale: 0.45,
      emergeTauScale: 0.7,
      retreatTauScale: 0.9,
    },
    motion: {
      ...NEUTRAL_MOTION_STYLE,
      swayAmplitude: 1.3,
      swayTempo: 1.25,
      scanSway: 1.2,
      curiositySway: 0.25,
      lookRate: 1.2,
      breatheTempo: 1.15,
      ripple: 1,
      // W-N3: extended, the dancer turns broadside and sweeps its body
      // laterally across the frame — the flourish is a shape, not just a
      // ripple. See `EXTEND_FLARE` in `Moray.ts`.
      extendFlare: 1,
    },
    codexLine:
      "A dancer who cannot quite hold still — quick peeks, bright flourishes, and now and then a ripple of pure delight.",
  },
  {
    id: "abyss",
    presence: {
      ...NEUTRAL_PRESENCE_STYLE,
      boldness: { min: 0.05, max: 0.2 },
      wariness: { min: 0.5, max: 0.7 },
      curiosity: { min: 0.15, max: 0.35 },
      tuckedHoldScale: 3.2,
      peekingHoldScale: 1.4,
      extendedHoldScale: 2.6,
      extendChanceScale: 0.55,
      reachScale: 0.85,
      startleSpeedScale: 1.4,
      startleHoldScale: 1.3,
      startleTauScale: 6,
      waryEmergeScale: 1.2,
      emergeTauScale: 1.7,
      retreatTauScale: 1.6,
    },
    motion: {
      ...NEUTRAL_MOTION_STYLE,
      swayAmplitude: 0.75,
      swayTempo: 0.6,
      scanSway: 0.7,
      lookRate: 0.4,
      lookGain: 0.5,
      breatheTempo: 0.7,
      attendGape: 0.5,
      curiousGape: 0.4,
    },
    codexLine:
      "A hermit of the far dark — she emerges rarely, calmly, and on no clock but her own.",
  },
  // ─── Wave 8 (W6): the four wing residents ────────────────────────────────
  // Same rule as the five above: biases on W-L7's measured baselines, no new
  // machinery, and the flourish stays the dancer's alone (ripple and
  // extendFlare are 0 here, which `tests/morayPersonality.test.ts` pins).
  {
    // The playful one: quick, frequent peeks and the shortest tucks in the
    // game — a small animal that cannot stop coming out to look. Curiosity
    // is windowed highest of any species so a calm diver earns the lean
    // quickly; the startle is a small animal's flinch, but the recovery is
    // nearly the ribbon's pace because the curiosity pulls it back out.
    id: "golden-dwarf-moray",
    presence: {
      ...NEUTRAL_PRESENCE_STYLE,
      boldness: { min: 0.5, max: 0.75 },
      wariness: { min: 0.2, max: 0.4 },
      curiosity: { min: 0.75, max: 0.95 },
      tuckedHoldScale: 0.55,
      peekingHoldScale: 0.5,
      extendedHoldScale: 0.7,
      extendChanceScale: 1.25,
      reachScale: 1.05,
      startleSpeedScale: 0.9,
      startleHoldScale: 0.55,
      startleTauScale: 0.9,
      waryEmergeScale: 0.55,
      emergeTauScale: 0.75,
      retreatTauScale: 0.85,
    },
    motion: {
      ...NEUTRAL_MOTION_STYLE,
      swayAmplitude: 1.15,
      swayTempo: 1.25,
      scanSway: 1.2,
      curiositySway: 0.4,
      lookRate: 1.3,
      lookGain: 1.1,
      breatheTempo: 1.25,
      attendGape: 1.1,
      curiousGape: 1.2,
    },
    codexLine:
      "A scrap of sunlight with a face — she darts out to look at you, thinks better of it, and darts out again.",
  },
  {
    // The calm one: every hold stretched long and the clock closed a third
    // toward its midpoint, so the grotto's resident lives on slow, even
    // rounds. A startle means little (1.5× trigger) and happens slowly
    // (2.5× tau) — a heavy body folding back, not a bolt. The gaze arrives
    // late and stays: the slowest lookRate in the game.
    id: "frost-moray",
    presence: {
      ...NEUTRAL_PRESENCE_STYLE,
      boldness: { min: 0.4, max: 0.6 },
      wariness: { min: 0.25, max: 0.45 },
      curiosity: { min: 0.15, max: 0.35 },
      tuckedHoldScale: 1.7,
      peekingHoldScale: 1.8,
      extendedHoldScale: 2.3,
      clockSpread: 0.6,
      extendChanceScale: 0.85,
      reachScale: 0.9,
      startleSpeedScale: 1.5,
      startleHoldScale: 1.1,
      startleTauScale: 2.5,
      waryEmergeScale: 1.2,
      emergeTauScale: 1.5,
      retreatTauScale: 1.4,
    },
    motion: {
      ...NEUTRAL_MOTION_STYLE,
      swayAmplitude: 0.8,
      swayTempo: 0.65,
      scanSway: 0.8,
      lookRate: 0.45,
      lookGain: 0.75,
      breatheTempo: 0.7,
      gapeBias: 1.5,
      attendGape: 0.6,
      curiousGape: 0.5,
    },
    codexLine:
      "Patient as the ice he keeps — he has never once hurried, and is not about to start for you.",
  },
  {
    // The shy one: tucks second in length only to the hermit's, and the
    // briefest extends of any species — the glow is earned. But curiosity
    // sits mid-high rather than low, which is what separates it from the
    // abyss: this animal *wants* to come out, and a calm diver at the vent
    // mouth shortens every sulk.
    id: "ember-moray",
    presence: {
      ...NEUTRAL_PRESENCE_STYLE,
      boldness: { min: 0.08, max: 0.28 },
      wariness: { min: 0.6, max: 0.85 },
      curiosity: { min: 0.35, max: 0.6 },
      tuckedHoldScale: 2.6,
      peekingHoldScale: 1.2,
      extendedHoldScale: 0.55,
      extendChanceScale: 0.6,
      reachScale: 0.8,
      startleSpeedScale: 0.85,
      startleHoldScale: 1.3,
      startleTauScale: 1.1,
      waryEmergeScale: 1.35,
      emergeTauScale: 1.25,
      retreatTauScale: 1.15,
    },
    motion: {
      ...NEUTRAL_MOTION_STYLE,
      swayAmplitude: 0.85,
      swayTempo: 0.85,
      scanSway: 0.8,
      curiositySway: 0.2,
      lookRate: 0.6,
      lookGain: 0.7,
      breatheTempo: 0.9,
      attendGape: 0.7,
      curiousGape: 0.6,
    },
    codexLine:
      "A banked coal in the warm dark — hold still, and her glow comes out to meet you.",
  },
  {
    // The gentle one: nothing pushed to an extreme — holds a third again
    // longer across the board, a slow dreamy clock, and a curiosity window
    // just past midpoint so she notices a quiet diver without ever mobbing
    // them. The startle is a slow fold (1.6× tau), the ethereal version of
    // the hermit's 6× one.
    id: "pearl-moray",
    presence: {
      ...NEUTRAL_PRESENCE_STYLE,
      boldness: { min: 0.3, max: 0.5 },
      wariness: { min: 0.35, max: 0.55 },
      curiosity: { min: 0.5, max: 0.75 },
      tuckedHoldScale: 1.3,
      peekingHoldScale: 1.3,
      extendedHoldScale: 1.6,
      extendChanceScale: 0.9,
      reachScale: 0.95,
      startleSpeedScale: 1.1,
      startleHoldScale: 1.1,
      startleTauScale: 1.6,
      waryEmergeScale: 1.1,
      emergeTauScale: 1.3,
      retreatTauScale: 1.3,
    },
    motion: {
      ...NEUTRAL_MOTION_STYLE,
      swayAmplitude: 0.9,
      swayTempo: 0.7,
      scanSway: 0.9,
      curiositySway: 0.35,
      lookRate: 0.6,
      lookGain: 0.85,
      breatheTempo: 0.8,
      gapeBias: 1.2,
      attendGape: 0.75,
      curiousGape: 0.8,
    },
    codexLine:
      "The reef's own gentle ghost — she drifts through the pale water like a thought it is thinking.",
  },
];

const PROFILE_BY_ID = new Map(PROFILES.map((profile) => [profile.id, profile]));

/**
 * The species' personality, or {@link DEFAULT_PERSONALITY} when it has none.
 *
 * A `-moray` suffix is tolerated on the way in: the four shipped species are
 * keyed by their full ids, and the concurrent package's hermit is keyed
 * `"abyss"` as specified — so whether its species lands as `"abyss"` or
 * `"abyss-moray"`, it finds its character.
 */
export function personalityFor(speciesId: string): MorayPersonality {
  return (
    PROFILE_BY_ID.get(speciesId) ??
    PROFILE_BY_ID.get(speciesId.replace(/-moray$/, "")) ??
    DEFAULT_PERSONALITY
  );
}

/** Every authored profile, for the tests and the codex-of-the-mind. */
export function allPersonalities(): readonly MorayPersonality[] {
  return PROFILES;
}

/**
 * Per-individual expression seed: `SEEDS.personality` folded with the same
 * djb2 species hash `presenceSeed` uses, so a species' flourish timing is its
 * own stream — tuning the ribbon's ripple can never re-roll a sibling, and
 * never touches a presence draw.
 */
export function personalitySeed(speciesId: string): number {
  let hash = 5381;
  for (let i = 0; i < speciesId.length; i++) {
    hash = (Math.imul(hash, 33) ^ speciesId.charCodeAt(i)) >>> 0;
  }
  return (hash ^ SEEDS.personality) >>> 0;
}
