import { Random, SEEDS } from "../util/Random";

/**
 * The sky's slow moods (W-M1): weather passing over the reef, as long
 * painterly shifts in the water's personality — a golden hour, a passing
 * overcast, a plankton bloom — drifting in and out over minutes, the way
 * light moves over a Ghibli sea.
 *
 * The whole system is a *time-based* sibling of W-M3's *place-based*
 * `abyssMood`, and the composition rule between them is stated once and
 * held everywhere: **every weather channel is a multiplier on a base value,
 * the weather scales the base, and the twilight modulates the scaled base.**
 * Time and place are two channels over one base, applied in that order, so
 * the canyon at golden hour is the golden water taken down into twilight —
 * never two systems fighting over who writes last. At the default mood every
 * multiplier is exactly 1, and x × 1 is exact in IEEE floats, so the identity
 * is arithmetic rather than epsilon — the same verbatim-base contract
 * `tests/abyssBiome.test.ts` holds the twilight to, and the reason every
 * canonical capture renders bit-identical to its archive.
 *
 * Participation is opt-in: `UnderwaterFog`, `Lighting`, `LightShafts` and
 * `CausticsSystem` take the system through `attachWeather`, and only the
 * reef's instances are attached. The sanctuary keeps its own noon — the room
 * is a memory, not a window, and it already declined the reef's backdrop for
 * the same reason (see AGENTS.md, WP-G6).
 *
 * ## The schedule
 *
 * Deterministic from `SEEDS.weather`, drawn lazily in a fixed order as time
 * passes, so two runs of the same build always see the same weather at the
 * same minute. The opening hold on bright noon is drawn from 150–210 s —
 * past the 110–150 s convention the visitors and the presence cycle
 * established, with margin, because every canonical capture and every e2e
 * assertion lands well inside the first minute of a page. After that: a
 * 30–60 s crossfade (smoothstepped — a front arriving, not a dimmer), a
 * 120–240 s hold, and the next mood drawn from the others. Bright noon is a
 * mood among moods, so the reef keeps returning to its own look.
 *
 * Reduced motion needs no special handling here and that is arithmetic: the
 * fastest thing in the system is a 30 s crossfade, a fraction of a percent of
 * change per frame — far below the caustics drift that Calm Mode leaves
 * running at a quarter rate. Noted rather than assumed: a crossfade is a
 * *lighting* change, not a motion, and it carries no flicker at any speed the
 * schedule can produce.
 */

/**
 * Everything a mood may touch, each field a multiplier on the shipped base
 * value of its channel (so identity is exactly 1 everywhere).
 *
 * Colour triples multiply in three's linear working space, which is why the
 * authored tints below look timid: the value key's rule that "the same
 * fraction in linear is a far deeper cut" applies to every one of them, and
 * so does "read the red channel first" — no mood takes red down hard,
 * because a turquoise that loses its red is poster-paint cyan, not weather.
 */
export interface WeatherChannels {
  /** Per-channel scale on the fog colour (and everything derived from it). */
  fogRed: number;
  fogGreen: number;
  fogBlue: number;
  /** Scale on the exponential fog density: the water closing in, or opening. */
  fogDensity: number;
  /** Scale on the painted backdrop's level (`scene.backgroundIntensity`). */
  backdrop: number;
  /** Per-channel scale on the key light's colour. */
  sunRed: number;
  sunGreen: number;
  sunBlue: number;
  /** Scales on the light rig's three intensities. */
  sun: number;
  hemisphere: number;
  ambient: number;
  /** Per-channel tint on the shaft blades and their pools. */
  shaftRed: number;
  shaftGreen: number;
  shaftBlue: number;
  /** Scale on the shafts' (and pools') opacity. */
  shaftOpacity: number;
  /** Scale on the caustics layers' opacity. */
  caustics: number;
  /** Per-channel scale on the grade's highlight tint. */
  gradeRed: number;
  gradeGreen: number;
  gradeBlue: number;
  /** Scale on the grade's saturation. */
  gradeSaturation: number;
}

export const IDENTITY_CHANNELS: Readonly<WeatherChannels> = {
  fogRed: 1,
  fogGreen: 1,
  fogBlue: 1,
  fogDensity: 1,
  backdrop: 1,
  sunRed: 1,
  sunGreen: 1,
  sunBlue: 1,
  sun: 1,
  hemisphere: 1,
  ambient: 1,
  shaftRed: 1,
  shaftGreen: 1,
  shaftBlue: 1,
  shaftOpacity: 1,
  caustics: 1,
  gradeRed: 1,
  gradeGreen: 1,
  gradeBlue: 1,
  gradeSaturation: 1,
};

const CHANNEL_KEYS = Object.keys(IDENTITY_CHANNELS) as readonly (keyof WeatherChannels)[];

export interface WeatherMood {
  readonly id: string;
  readonly channels: Readonly<WeatherChannels>;
}

/**
 * The four moods. Three art-direction constraints shaped every number:
 *
 * - **The fog colour and the painted backdrop cannot drift apart at the
 *   horizon** — the backdrop has only a scalar level, no tint — so any mood
 *   that moves the fog's hue also raises its density and dims the backdrop,
 *   which closes the distance into the fog before the disagreement can band.
 *   The twilight canyon made the same trade at far bigger numbers.
 * - **The key is a contrast control under a ramp** (see `Lighting`): the
 *   seabed takes the whole key, so a sun multiplier moves the largest surface
 *   in frame faster than it moves anything else. Overcast's flattening lives
 *   mostly in that one number.
 * - **A warm additive costs more than its luminance says** in this water
 *   (WP-G4), so golden afternoon's warmth is split across the shaft tint, the
 *   key colour and the grade rather than piled into one channel.
 *
 * W-N4 roughly doubled every table below and gave each mood a channel that
 * changes what the light *marks* are doing rather than only what they are
 * multiplied by. The round critic measured the shipped tables at +3.5 parts
 * of red for a whole golden afternoon and called W "nearly indistinguishable
 * from A" — amplitudes tuned to stay under the capture noise are amplitudes
 * the player cannot see either. The guardrails that actually matter are kept
 * and stated per mood: no mood cuts fog red below 0.9 of base (the shipped
 * base carries 83 parts — the electric-cyan crush lives below ~28, a long way
 * down), nothing approaches black, and warmth still arrives red-up rather
 * than green-down.
 */
export const WEATHER_MOODS: readonly WeatherMood[] = [
  /** The shipped look. Identity by construction — this row is the contract. */
  { id: "bright-noon", channels: IDENTITY_CHANNELS },
  {
    // The honeyed hour. The behavioural half is in the light marks: the
    // shafts come up two thirds and lean properly amber (blue at 0.6 — the
    // tint also lands on the caustic dapples, which wear the shaft tint since
    // W-N4, so the beam, its pool and its dapple stay one light), and the
    // dapples brighten by 1.4. The water itself warms a step — red up, blue
    // down, the safe direction — and the grade's highlight tilt carries the
    // honey into the sand. Density rises with the hue move so the horizon
    // cannot band against the un-tintable backdrop.
    id: "golden-afternoon",
    channels: {
      ...IDENTITY_CHANNELS,
      fogRed: 1.1,
      fogGreen: 0.97,
      fogBlue: 0.85,
      fogDensity: 1.12,
      backdrop: 0.93,
      sunRed: 1.02,
      sunGreen: 0.88,
      sunBlue: 0.62,
      sun: 1.12,
      hemisphere: 0.88,
      shaftRed: 1.0,
      shaftGreen: 0.88,
      shaftBlue: 0.6,
      shaftOpacity: 1.65,
      caustics: 1.4,
      gradeRed: 1.1,
      gradeGreen: 1.02,
      gradeBlue: 0.8,
      gradeSaturation: 1.06,
    },
  },
  {
    // Flat milky melancholy, and the one mood with a genuinely *absent*
    // channel: shafts, pools and dapples fade to exactly zero — there is no
    // focused light under a cloud, and 0.22× of a beam was still a beam. The
    // consumers hide the meshes at a gain of exactly 0, so a full overcast
    // also stops paying their overdraw. The key drops to under half of its
    // contrast job, the diffuse ceiling picks most of it up, and the fog goes
    // *brighter* and greyer — raising red most is what desaturates a
    // turquoise toward milk, the value key's own "distance goes milky-bright"
    // inverted into weather.
    id: "overcast-drift",
    channels: {
      ...IDENTITY_CHANNELS,
      fogRed: 1.2,
      fogGreen: 1.07,
      fogBlue: 1.02,
      fogDensity: 1.35,
      backdrop: 0.86,
      sunRed: 0.97,
      sunGreen: 1.0,
      sunBlue: 1.06,
      sun: 0.44,
      hemisphere: 1.25,
      ambient: 1.08,
      shaftOpacity: 0,
      caustics: 0,
      gradeRed: 0.98,
      gradeGreen: 1.0,
      gradeBlue: 1.04,
      gradeSaturation: 0.87,
    },
  },
  {
    // A bloom drifting through: green-milk water that closes the far field
    // right in. Density is the behavioural lever — 2.2× swallows the distant
    // reef rings and the rim into green silhouette (they re-mix their inks
    // from `scene.fog` on their own, so the whole painted distance follows
    // with no second writer) — and the backdrop comes down to 0.8 so the sky
    // sinks into the same soup. Red is held at 0.9 — the green arrives by
    // raising green, not by cutting red, which is the electric-cyan trap; 0.9
    // of the shipped 83 parts is 75, far above the tone curve's crush. It is
    // still a mood of *distance*: exp² fog barely acts inside ten metres,
    // which is why its capture pose stands on A's open-water camera.
    id: "plankton-haze",
    channels: {
      ...IDENTITY_CHANNELS,
      fogRed: 0.9,
      fogGreen: 1.16,
      fogBlue: 0.82,
      fogDensity: 2.2,
      backdrop: 0.8,
      sunRed: 0.94,
      sunGreen: 1.05,
      sunBlue: 0.9,
      sun: 0.8,
      ambient: 0.94,
      shaftRed: 0.92,
      shaftGreen: 1.06,
      shaftBlue: 0.82,
      shaftOpacity: 0.65,
      caustics: 0.55,
      gradeRed: 0.96,
      gradeGreen: 1.06,
      gradeBlue: 0.92,
      gradeSaturation: 1.02,
    },
  },
];

const DEFAULT_MOOD = WEATHER_MOODS[0] as WeatherMood;

/** Seconds bright noon holds from load before the first front may arrive. */
const OPENING_HOLD: readonly [number, number] = [150, 210];
/** Seconds a mood holds once it has fully arrived. */
const HOLD: readonly [number, number] = [120, 240];
/** Seconds a crossfade takes: a front passing, not a dimmer. */
const FADE: readonly [number, number] = [30, 60];

/**
 * A single frame delta longer than this is a tab coming back from sleep, not
 * play, and letting it through would jump the weather a whole mood in one
 * frame — a lighting pop on the first frame the player sees again.
 */
const MAX_STEP = 1;

type Phase =
  | { readonly kind: "hold"; readonly mood: WeatherMood; readonly until: number }
  | {
      readonly kind: "fade";
      readonly from: WeatherMood;
      readonly to: WeatherMood;
      readonly start: number;
      readonly until: number;
    };

/** What the schedule is doing, for the QA door and the probes. */
export interface WeatherState {
  /** The mood on stage (during a fade, the one being left). */
  mood: string;
  /** The mood arriving, or null outside a crossfade. */
  into: string | null;
  /** 0 at the outgoing mood, 1 at the incoming one. */
  blend: number;
  /** Accumulated weather clock, seconds. */
  time: number;
  pinned: boolean;
}

function smoothstep01(t: number): number {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return k * k * (3 - 2 * k);
}

function copyChannels(out: WeatherChannels, from: Readonly<WeatherChannels>): void {
  for (const key of CHANNEL_KEYS) {
    out[key] = from[key];
  }
}

/**
 * Exactly `from` at t = 0 and exactly `to` at t = 1 — by branch, not by
 * arithmetic. `from + (to − from) × 1` is *not* `to` in floating point
 * (1 + (0.44 − 1) is 0.43999999999999995), and W-M1's original tables only
 * ever agreed by luck; a pinned mood must hand back the published table to
 * the bit, because the composition tests — and the identity contract at the
 * other end — compare with `toBe`.
 */
function lerpChannels(
  out: WeatherChannels,
  from: Readonly<WeatherChannels>,
  to: Readonly<WeatherChannels>,
  t: number,
): void {
  if (t <= 0) {
    copyChannels(out, from);
    return;
  }
  if (t >= 1) {
    copyChannels(out, to);
    return;
  }
  for (const key of CHANNEL_KEYS) {
    out[key] = from[key] + (to[key] - from[key]) * t;
  }
}

/**
 * The clock, the schedule and the blended channel values, in one object the
 * reef's renderer-side systems read from. `Game` owns one, advances it on the
 * frame clock (like the caustics and the shafts — weather keeps passing while
 * the comfort panel holds the simulation), and hangs its QA door on `__reef`.
 */
export class WeatherMoods {
  private readonly random = new Random(SEEDS.weather);
  private time = 0;
  private phase: Phase;
  private readonly current: WeatherChannels = { ...IDENTITY_CHANNELS };
  private identity = true;
  private blend = 0;
  private pinnedName: string | null = null;
  private pinnedBlend = 0;

  constructor() {
    this.phase = { kind: "hold", mood: DEFAULT_MOOD, until: this.random.range(...OPENING_HOLD) };
  }

  /** Whether every channel is exactly 1 — the whole system stood down. */
  get isIdentity(): boolean {
    return this.identity;
  }

  /** The blended multipliers this frame. Read, never written, by consumers. */
  get channels(): Readonly<WeatherChannels> {
    return this.current;
  }

  get state(): WeatherState {
    if (this.pinnedName !== null) {
      return {
        mood: this.pinnedName,
        into: null,
        blend: this.pinnedBlend,
        time: this.time,
        pinned: true,
      };
    }
    if (this.phase.kind === "hold") {
      return { mood: this.phase.mood.id, into: null, blend: 0, time: this.time, pinned: false };
    }
    return {
      mood: this.phase.from.id,
      into: this.phase.to.id,
      blend: this.blend,
      time: this.time,
      pinned: false,
    };
  }

  update(dt: number): void {
    this.time += Math.min(Math.max(dt, 0), MAX_STEP);
    if (this.pinnedName === null) {
      this.refresh();
    }
  }

  /**
   * The QA door: pins the channels at `blend` of the way from bright noon to
   * the named mood (so 1 is the mood in full and 0.5 is mid-crossfade), and
   * stops the schedule writing over it. `null` unpins and the schedule
   * resumes from wherever the clock has reached — the skipped phases are
   * drawn in order on the way, so a pin can never re-roll the weather that
   * follows it. An unknown name warns and changes nothing, the asset
   * library's own failure manner.
   */
  setMood(name: string | null, blend = 1): void {
    if (name === null) {
      this.pinnedName = null;
      this.refresh();
      return;
    }
    const mood = WEATHER_MOODS.find((candidate) => candidate.id === name);
    if (!mood) {
      console.warn(`[weather] unknown mood "${name}"`);
      return;
    }
    const k = Math.min(1, Math.max(0, blend));
    this.pinnedName = mood.id;
    this.pinnedBlend = k;
    lerpChannels(this.current, DEFAULT_MOOD.channels, mood.channels, k);
    this.identity = mood === DEFAULT_MOOD || k === 0;
  }

  private refresh(): void {
    while (this.time >= this.phase.until) {
      this.phase = this.nextPhase(this.phase);
    }
    const phase = this.phase;
    if (phase.kind === "hold") {
      copyChannels(this.current, phase.mood.channels);
      this.blend = 0;
      this.identity = phase.mood === DEFAULT_MOOD;
      return;
    }
    this.blend = smoothstep01((this.time - phase.start) / (phase.until - phase.start));
    lerpChannels(this.current, phase.from.channels, phase.to.channels, this.blend);
    this.identity = false;
  }

  /**
   * Phase boundaries are laid end to end off the *previous* boundary rather
   * than off the clock, and the draws are consumed here in a fixed order —
   * next mood, then fade length, then hold length — so the whole schedule is
   * a pure function of the seed however the frame deltas arrive.
   */
  private nextPhase(phase: Phase): Phase {
    if (phase.kind === "hold") {
      const to = this.pickNext(phase.mood);
      return {
        kind: "fade",
        from: phase.mood,
        to,
        start: phase.until,
        until: phase.until + this.random.range(...FADE),
      };
    }
    return { kind: "hold", mood: phase.to, until: phase.until + this.random.range(...HOLD) };
  }

  private pickNext(current: WeatherMood): WeatherMood {
    const candidates = WEATHER_MOODS.filter((mood) => mood !== current);
    const index = Math.min(
      Math.floor(this.random.next() * candidates.length),
      candidates.length - 1,
    );
    return candidates[index] as WeatherMood;
  }
}
