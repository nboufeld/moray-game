import { Random, SEEDS } from "../../util/Random";

/**
 * The presence cycle: the slow life a moray leads in its den (W-L7).
 *
 * This is pure state — numbers in, numbers out, no three, no DOM — for the
 * same reason `FocusScanner` and `BubbleScheduler` are: the behaviour has to
 * be drivable through two simulated hours in plain Node, because none of it
 * can be judged from a screenshot and most of it happens on a minutes-long
 * clock no capture settle reaches.
 *
 * What it decides each frame is one number and some colour on it: `offset`,
 * metres along the den axis the animal stands from its authored pose, plus
 * the body-language blends (`curve`, `scan`, `surge`, `curiosity`) and the
 * one-shot events (`peekBegan`, `puffStrength`) `Moray` turns into audio and
 * silt. `Moray` owns *applying* it; this class owns *deciding* it.
 *
 * Three constraints shaped every number here, and all three are about other
 * packages' guarantees rather than about the animal:
 *
 * - **The authored pose is `offset = 0`, and it is the opening state.** Every
 *   canonical shot, every sightline test and the whole discovery e2e were
 *   tuned against the heads exactly where `SPOT_PLACEMENTS` put them, so the
 *   machine opens in "peeking" — which *is* that pose — and holds it for
 *   {@link OPENING_HOLD} before the first ambient transition. Same trick as
 *   the visitors' 75 s first-arrival floor: every canonical settle (2–9 s,
 *   taken well under a minute into the page) is presence-quiescent by
 *   construction, and the e2e discovery swim is over long before the reef
 *   starts moving on its own.
 *
 * - **The head must stay within ~1.2 m of the den mouth.** The sightline
 *   guarantees are raycasts to the authored positions; an animal that could
 *   wander a body-length into open water could be discovered from angles
 *   those tests never stood at. {@link MAX_EXTENSION} caps the far end
 *   (extension plus curiosity lean, together) and {@link TUCK_OFFSET} the
 *   near end — a tuck deeper than the 0.6 m margin `Game.isObstructed`
 *   leaves at the target end of its ray would let the mound's own flanks
 *   swallow the head on the approach corridor the e2e flies down.
 *
 * - **No flickering.** The startle is speed-gated on the way in and
 *   calm-gated on the way out ({@link CALM_SECONDS} of sustained calm, the
 *   clownfish hysteresis one package over), and curiosity is a slow blend
 *   rather than a threshold, so a diver hovering at any boundary cannot
 *   strobe the animal.
 */

export type MorayPresenceState = "tucked" | "peeking" | "extended" | "startled";

export type TemperamentLabel = "bold" | "shy" | "curious";

export interface MorayTemperament {
  /** How far it stands out of the den, and how often it chooses to. */
  readonly boldness: number;
  /** How long it sulks after a startle, and how slowly it comes back. */
  readonly wariness: number;
  /** How strongly a calm, close diver draws it out of the archway. */
  readonly curiosity: number;
  /** The dominant trait, for the codex-of-the-mind (and the tests). */
  readonly label: TemperamentLabel;
}

/** The window a seeded trait draw is mapped into: `min + draw * (max - min)`.
 * The neutral window is [0, 1), which reproduces the raw draw exactly — a
 * species profile narrows it so the snowflake is always shy and the dragon
 * always bold, while the *where inside the window* stays the individual's. */
export interface TraitWindow {
  readonly min: number;
  readonly max: number;
}

/**
 * The knobs a species personality turns on this machine (W-M2). Every one of
 * them is a bias on an existing W-L7 mechanism, never a new mechanism: the
 * hard caps ({@link TUCK_OFFSET}, {@link MAX_EXTENSION}), the opening hold
 * and the reduced-motion damping are deliberately not in here, because those
 * are other packages' guarantees and no personality may spend them.
 *
 * The neutral style (all windows [0, 1), all scales 1) makes the machine
 * bit-identical to its pre-personality self — same PRNG stream, same
 * arithmetic — which is what keeps every W-L7 test green unchanged.
 */
export interface PresenceStyle {
  readonly boldness: TraitWindow;
  readonly wariness: TraitWindow;
  readonly curiosity: TraitWindow;
  /** Multipliers on the ambient hold ranges: how long each spell lasts. */
  readonly tuckedHoldScale: number;
  readonly peekingHoldScale: number;
  readonly extendedHoldScale: number;
  /** 1 keeps the full seeded spread of a hold draw; toward 0 the draws close
   * on the range's midpoint — the zebra's clockwork. Never touches the
   * opening hold. */
  readonly clockSpread: number;
  /** Multiplier on the peeking→extended chance (capped so cover stays reachable). */
  readonly extendChanceScale: number;
  /** Extension eagerness inside the hard cap; >1 clamps at full reach. */
  readonly reachScale: number;
  /** Multiplier on the startle speed threshold: <1 is a hair trigger, >1 stoic.
   * The radius is shared and untouched — it is what protects the e2e swim. */
  readonly startleSpeedScale: number;
  /** How long it sulks in cover after a startle. */
  readonly startleHoldScale: number;
  /** How fast the withdraw itself is: 1 is a dart, large is a slow fold. */
  readonly startleTauScale: number;
  /** Multiplier on the wary re-emergence slowdown: how slowly trust rebuilds. */
  readonly waryEmergeScale: number;
  /** Multipliers on the ordinary ease rates. */
  readonly emergeTauScale: number;
  readonly retreatTauScale: number;
}

const NEUTRAL_WINDOW: TraitWindow = { min: 0, max: 1 };

/** The unbiased machine: exactly W-L7's behaviour, draw for draw. */
export const NEUTRAL_PRESENCE_STYLE: PresenceStyle = {
  boldness: NEUTRAL_WINDOW,
  wariness: NEUTRAL_WINDOW,
  curiosity: NEUTRAL_WINDOW,
  tuckedHoldScale: 1,
  peekingHoldScale: 1,
  extendedHoldScale: 1,
  clockSpread: 1,
  extendChanceScale: 1,
  reachScale: 1,
  startleSpeedScale: 1,
  startleHoldScale: 1,
  startleTauScale: 1,
  waryEmergeScale: 1,
  emergeTauScale: 1,
  retreatTauScale: 1,
};

export interface PresenceInput {
  /** Metres from the diver to the den anchor (the authored head position). */
  readonly distance: number;
  /** The diver's speed in m/s — the dive controller's, not a position diff. */
  readonly diverSpeed: number;
  readonly reducedMotion: boolean;
}

/** One frame of presence, reused across updates — do not hold a reference. */
export interface PresencePose {
  state: MorayPresenceState;
  /** Metres along the den axis; 0 is the authored pose, positive is out. */
  offset: number;
  /** Multiplier on the resting S-curve: >1 bunched into the den, <1 poured out. */
  curve: number;
  /** 0..1 blend of the extended, slowly scanning posture. */
  scan: number;
  /** Smoothed emergence velocity in m/s; the head lifts slightly with it. */
  surge: number;
  /** 0..1 blend of attention to a calm, close diver. */
  curiosity: number;
  /** True on the one update where an emergence from cover begins. */
  peekBegan: boolean;
  /** Silt to throw at the den mouth this update; 0 means none. */
  puffStrength: number;
}

/** How far into the den shadow the head tucks, in metres. Kept well inside the
 * 0.6 m the obstruction ray already forgives at the target end. */
export const TUCK_OFFSET = -0.34;

/** The hard cap on forward travel — extension and curiosity lean combined —
 * which is what keeps the head within ~1.2 m of the den mouth. */
export const MAX_EXTENSION = 0.9;

/** The classic pose and the whole shot set's pose: exactly the authored one. */
const PEEK_OFFSET = 0;

/** Seconds before the first ambient transition; see the header. */
const OPENING_HOLD: readonly [number, number] = [110, 150];

const TUCKED_HOLD: readonly [number, number] = [14, 34];
const PEEKING_HOLD: readonly [number, number] = [18, 46];
const EXTENDED_HOLD: readonly [number, number] = [11, 26];

/** Rushing: this fast, this close, and the animal bolts. The dive controller
 * tops out at 8 m/s and the e2e approach coasts to a stop 7.5 m out, so the
 * spec's own swim can never trip this. */
export const STARTLE_SPEED = 3.2;
export const STARTLE_RADIUS = 4.2;
const STARTLE_HOLD: readonly [number, number] = [6, 13];

/** Calm, for the hysteresis: slow or gone, sustained. */
const CALM_SPEED = 1.1;
const CALM_DISTANCE = 6.5;
const CALM_SECONDS = 2.5;

/** The band a lingering diver reads as company rather than as a wall. */
const CURIOUS_MIN = 2.2;
const CURIOUS_MAX = 7;
const CURIOUS_SPEED = 0.9;
/** Metres of extra lean a fully curious animal offers a fully calm diver. */
const CURIOSITY_LEAN = 0.3;

/** Transition time constants, in seconds of exponential easing. */
const EMERGE_TAU = 2.2;
const RETREAT_TAU = 2.8;
const STARTLE_TAU = 0.4;
/** A startled animal comes back out this much slower — wariness as a number,
 * the clownfish's quarter-rate re-emergence one package over. */
const WARY_EMERGE_SCALE = 2.5;

const SCAN_TAU = 1.6;
const CURIOSITY_RISE_TAU = 2.6;
const CURIOSITY_FALL_TAU = 1.1;

/** Reduced motion: half the travel, half the rate — the kelp's convention
 * (slower clock, smaller strength) applied to a body instead of a frond. */
const REDUCED_RANGE = 0.5;
const REDUCED_RATE = 0.5;

/** Below this much of standing-out, a retreat throws no silt: nothing moved. */
const PUFF_MIN_TRAVEL = 0.12;
/** The gentle silt of a body nosing out of cover, against a startle's kick. */
const EMERGE_PUFF = 0.3;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** A seeded [0,1) draw mapped into a profile's trait window. */
function mapTrait(draw: number, window: TraitWindow): number {
  return window.min + draw * (window.max - window.min);
}

/**
 * Per-individual seed: the shared `SEEDS.morayPresence` stream folded with a
 * stable hash of the species id (djb2). Each animal draws its temperament and
 * its ambient clock from its own stream, so tuning one species' behaviour —
 * or adding a fifth — never re-rolls a sibling's mood. Same isolation rule as
 * `SEEDS.fishSpecies`' sub-seeds.
 */
export function presenceSeed(speciesId: string): number {
  let hash = 5381;
  for (let i = 0; i < speciesId.length; i++) {
    hash = (Math.imul(hash, 33) ^ speciesId.charCodeAt(i)) >>> 0;
  }
  return (hash ^ SEEDS.morayPresence) >>> 0;
}

export class MorayPresence {
  readonly temperament: MorayTemperament;

  private readonly style: PresenceStyle;
  private readonly random: Random;
  private stateName: MorayPresenceState = "peeking";
  /** Seconds left before the next ambient transition. */
  private hold: number;
  private offset = 0;
  private velocity = 0;
  private scanBlend = 0;
  private curiosityBlend = 0;
  private calmSeconds = 0;
  /** Set by a startle, cleared once the animal has fully re-emerged. */
  private wary = false;

  private readonly pose: PresencePose = {
    state: "peeking",
    offset: 0,
    curve: 1,
    scan: 0,
    surge: 0,
    curiosity: 0,
    peekBegan: false,
    puffStrength: 0,
  };

  constructor(seed: number, style: PresenceStyle = NEUTRAL_PRESENCE_STYLE) {
    this.style = style;
    this.random = new Random(seed);
    // The three draws come first and in this order whatever the style, so a
    // species profile can never re-roll the individual underneath it.
    const boldness = mapTrait(this.random.next(), style.boldness);
    const wariness = mapTrait(this.random.next(), style.wariness);
    const curiosity = mapTrait(this.random.next(), style.curiosity);
    this.temperament = {
      boldness,
      wariness,
      curiosity,
      label:
        boldness >= wariness && boldness >= curiosity
          ? "bold"
          : wariness >= curiosity
            ? "shy"
            : "curious",
    };
    // The opening hold takes no style on purpose: the 110–150 s quiescence is
    // what keeps every capture settle and the whole discovery e2e presence-free.
    this.hold = this.random.range(OPENING_HOLD[0], OPENING_HOLD[1]);
  }

  get state(): MorayPresenceState {
    return this.stateName;
  }

  /**
   * One seeded hold draw, styled: the range is squeezed toward its midpoint by
   * `clockSpread` (the zebra's near-constant rounds) and scaled by the
   * species' own pacing. Exactly one `next()` whatever the style, so the
   * stream stays aligned with the unbiased machine's.
   */
  private drawHold(range: readonly [number, number], scale: number): number {
    const centered = 0.5 + (this.random.next() - 0.5) * this.style.clockSpread;
    return (range[0] + centered * (range[1] - range[0])) * scale;
  }

  /**
   * QA door: jumps the machine into a state and most of the way through its
   * transition, so a probe can photograph "extended" without simulating the
   * minutes the ambient clock would take to get there. Never called by the
   * game.
   */
  force(state: MorayPresenceState): void {
    this.stateName = state;
    this.hold = 30;
    this.calmSeconds = CALM_SECONDS;
    this.offset = 0.85 * this.targetFor(state, false);
    this.velocity = 0;
    this.scanBlend = state === "extended" ? 1 : 0;
  }

  update(dt: number, input: PresenceInput): PresencePose {
    const pose = this.pose;
    pose.peekBegan = false;
    pose.puffStrength = 0;

    if (dt > 0) {
      this.advanceStates(dt, input, pose);
      this.advanceBlends(dt, input);
    }

    pose.state = this.stateName;
    pose.offset = this.offset;
    pose.surge = this.velocity;
    pose.scan = this.scanBlend * (input.reducedMotion ? 0.6 : 1);
    pose.curiosity = this.curiosityBlend;
    // Bunched into the den while tucked, and bunching further while the body
    // is being pulled backward — poured out flat while it surges forward.
    // This is the "body follows" half of the motion: the root slides the head
    // immediately and the S-curve unwinds behind it.
    const tuckAmount = clamp01(this.offset / TUCK_OFFSET);
    const bunching = Math.max(-0.3, Math.min(0.45, -this.velocity * 1.4));
    pose.curve = Math.max(0.7, Math.min(1.5, 1 + bunching + 0.25 * tuckAmount));
    return pose;
  }

  private advanceStates(dt: number, input: PresenceInput, pose: PresencePose): void {
    // Startle: an interrupt, not a scheduled state. The puff is sized by how
    // far out the animal was standing — a body that dashed a metre kicks more
    // silt than one that flinched — and an animal already in cover kicks none.
    if (
      this.stateName !== "startled" &&
      input.diverSpeed > STARTLE_SPEED * this.style.startleSpeedScale &&
      input.distance < STARTLE_RADIUS
    ) {
      if (this.offset > TUCK_OFFSET + PUFF_MIN_TRAVEL) {
        pose.puffStrength =
          0.45 + 0.55 * clamp01((this.offset - TUCK_OFFSET) / (MAX_EXTENSION - TUCK_OFFSET));
      }
      this.stateName = "startled";
      this.hold =
        this.drawHold(STARTLE_HOLD, this.style.startleHoldScale) *
        (0.7 + 0.6 * this.temperament.wariness);
      this.wary = true;
      this.calmSeconds = 0;
    }

    // The calm clock, for the way back out. Resetting on every loud frame is
    // the hysteresis: the diver has to actually settle, not dip under the
    // threshold for a step.
    const calm = input.diverSpeed < CALM_SPEED || input.distance > CALM_DISTANCE;
    this.calmSeconds = calm ? this.calmSeconds + dt : 0;

    this.hold -= dt;
    // A calm, curious diver at the archway shortens a sulk in cover — the
    // "linger and it relaxes" promise — but never a startled one's: that
    // clock is what the startle means.
    if (this.stateName === "tucked" && this.curiosityBlend > 0.4) {
      this.hold -= dt * 2;
    }

    if (this.stateName === "startled") {
      if (this.hold <= 0 && this.calmSeconds >= CALM_SECONDS) {
        this.beginPeek(pose);
      }
      return;
    }
    if (this.hold > 0) {
      return;
    }

    switch (this.stateName) {
      case "tucked":
        this.beginPeek(pose);
        break;
      case "peeking": {
        // Capped below 1 so cover stays reachable: even the boldest sovereign
        // still slips back into its den now and then.
        const extendChance = Math.min(
          0.97,
          (0.35 + 0.5 * this.temperament.boldness) * this.style.extendChanceScale,
        );
        if (this.random.next() < extendChance) {
          this.stateName = "extended";
          this.hold = this.drawHold(EXTENDED_HOLD, this.style.extendedHoldScale);
        } else {
          this.stateName = "tucked";
          this.hold =
            this.drawHold(TUCKED_HOLD, this.style.tuckedHoldScale) *
            (0.7 + 0.6 * this.temperament.wariness);
        }
        break;
      }
      case "extended":
        this.stateName = "peeking";
        this.hold = this.drawHold(PEEKING_HOLD, this.style.peekingHoldScale);
        break;
      default:
        this.stateName satisfies never;
    }
  }

  private beginPeek(pose: PresencePose): void {
    this.stateName = "peeking";
    this.hold = this.drawHold(PEEKING_HOLD, this.style.peekingHoldScale);
    pose.peekBegan = true;
    pose.puffStrength = Math.max(pose.puffStrength, EMERGE_PUFF);
  }

  private advanceBlends(dt: number, input: PresenceInput): void {
    const rate = input.reducedMotion ? REDUCED_RATE : 1;

    // Curiosity: a slow blend toward a diver who is close, calm and standing
    // off — never a switch. Only an animal already showing itself leans.
    const showing = this.stateName === "peeking" || this.stateName === "extended";
    const curious =
      showing &&
      input.distance > CURIOUS_MIN &&
      input.distance < CURIOUS_MAX &&
      input.diverSpeed < CURIOUS_SPEED;
    const curiosityTau = (curious ? CURIOSITY_RISE_TAU : CURIOSITY_FALL_TAU) / rate;
    this.curiosityBlend +=
      ((curious ? 1 : 0) - this.curiosityBlend) * (1 - Math.exp(-dt / curiosityTau));

    // The offset target, then one exponential ease toward it.
    const target = this.targetFor(this.stateName, input.reducedMotion);
    const emerging = target > this.offset;
    let tau =
      this.stateName === "startled"
        ? STARTLE_TAU * this.style.startleTauScale * (input.reducedMotion ? 1.5 : 1)
        : (emerging
            ? EMERGE_TAU *
              this.style.emergeTauScale *
              (this.wary ? WARY_EMERGE_SCALE * this.style.waryEmergeScale : 1)
            : RETREAT_TAU * this.style.retreatTauScale) / rate;
    tau = Math.max(tau, 1e-3);

    const previous = this.offset;
    this.offset += (target - this.offset) * (1 - Math.exp(-dt / tau));
    const rawVelocity = (this.offset - previous) / dt;
    this.velocity += (rawVelocity - this.velocity) * Math.min(1, dt * 6);

    if (this.wary && this.stateName !== "startled" && this.offset > PEEK_OFFSET - 0.04) {
      this.wary = false;
    }

    const scanTarget = this.stateName === "extended" ? 1 : 0;
    this.scanBlend += (scanTarget - this.scanBlend) * (1 - Math.exp(-dt / SCAN_TAU));
  }

  private targetFor(state: MorayPresenceState, reducedMotion: boolean): number {
    const range = reducedMotion ? REDUCED_RANGE : 1;
    const lean =
      this.curiosityBlend * CURIOSITY_LEAN * (0.4 + 0.6 * this.temperament.curiosity);
    switch (state) {
      case "startled":
      case "tucked":
        return TUCK_OFFSET * range;
      case "peeking":
        return Math.min(PEEK_OFFSET + lean, MAX_EXTENSION) * range;
      case "extended": {
        // Eagerness inside the hard cap, never through it: the min against
        // MAX_EXTENSION below is the sightline guarantee and takes no style.
        const reach =
          MAX_EXTENSION *
          Math.min(1, (0.55 + 0.45 * this.temperament.boldness) * this.style.reachScale);
        return Math.min(reach + lean, MAX_EXTENSION) * range;
      }
      default:
        return state satisfies never;
    }
  }
}
