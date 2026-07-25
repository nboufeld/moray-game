import { Random } from "../util/Random";

/**
 * Voice and bus builders for the reef's soundscape. Every one of them takes a
 * `BaseAudioContext` rather than reaching for a live one, so the same code
 * that plays through the speakers renders into an `OfflineAudioContext` when a
 * probe needs to measure what it produced. There are no assets: the sea is
 * filtered noise, the bell is two oscillators, the reverb tail is a decaying
 * noise burst.
 */

/** The ambience bed: the sound the reef makes when nothing is happening. */
export const AMBIENCE = {
  /** Length of the looped noise. Long enough that the loop point is not a rhythm. */
  noiseSeconds: 10,
  bedGain: 0.18,
  /** Lowpass cutoff, in hertz, for the dive and for the sanctuary. */
  reefCutoff: 420,
  sanctuaryCutoff: 700,
  /** Cutoff drift around the base, and how slowly it breathes. */
  driftHz: 80,
  driftRate: 0.06,
  /** The sub-bass swell under the noise. */
  swellHz: 60,
  swellSpanHz: 5,
  /** One swell every twenty seconds. */
  swellRate: 0.05,
  swellGain: 0.035,
  swellDepth: 0.015,
} as const;

/** A single bubble leaving the diver's regulator. */
export const BUBBLE = {
  startHz: 900,
  endHz: 300,
  decay: 0.15,
  attack: 0.012,
  peakGain: 0.055,
} as const;

/** The three-note bell that marks a discovery. */
export const CHIME = {
  notes: [660, 880, 990],
  /** Seconds between note onsets — arpeggiated, not a chord. */
  spacing: 0.18,
  /** Modulator frequency as a multiple of the carrier, and its starting depth. */
  modRatio: 2.4,
  modIndex: 2.2,
  attack: 0.06,
  decay: 1.8,
  peakGain: 0.16,
  /** Later notes sit under the first so the phrase falls away rather than climbs. */
  noteFalloff: 0.82,
  /** Sidebands above this are sparkle turning into glare. */
  cutoff: 2600,
} as const;

/** The warm pad that fades in with the Dream Sanctuary. */
export const PAD = {
  hz: 130.81,
  detuneCents: 5,
  gain: 0.06,
  cutoff: 900,
  /** How slowly the pad's own filter breathes. */
  driftRate: 0.04,
  driftHz: 160,
} as const;

export const REVERB_SECONDS = 2.2;

/** Handles the soundscape needs to keep hold of after the bed is built. */
export interface AmbienceBed {
  /** Everything the bed produces, summed. */
  readonly output: GainNode;
  /** The bed's voice — its base cutoff is what the sanctuary crossfade moves. */
  readonly lowpass: BiquadFilterNode;
  stop(): void;
}

export interface SanctuaryPad {
  readonly output: GainNode;
  /** Crossfaded between silence and {@link PAD.gain}. */
  readonly gain: GainNode;
  stop(): void;
}

/**
 * Brown noise — the surf-and-pressure end of the spectrum, with none of the
 * hiss that makes white noise tiring after a minute.
 *
 * The two channels are independent streams so the bed has width, and the last
 * `CROSSFADE_SECONDS` are blended with material from just past the end of the
 * buffer: the loop then rejoins a sample that genuinely followed it, instead
 * of jumping back to an unrelated level and clicking once every ten seconds.
 */
export function createBrownNoiseBuffer(
  ctx: BaseAudioContext,
  seconds: number,
  random: Random,
): AudioBuffer {
  const CROSSFADE_SECONDS = 0.75;
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(seconds * rate));
  const fade = Math.min(Math.floor(CROSSFADE_SECONDS * rate), Math.floor(length / 2));
  const buffer = ctx.createBuffer(2, length, rate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = new Float32Array(length + fade);
    let last = 0;
    let mean = 0;
    for (let i = 0; i < source.length; i++) {
      const white = random.signed(1);
      // A leaky integrator: -6dB/octave without the runaway DC of a true one.
      last = (last + 0.02 * white) / 1.02;
      source[i] = last * 3.5;
      mean += source[i] as number;
    }
    mean /= source.length;

    let peak = 1e-6;
    for (let i = 0; i < source.length; i++) {
      source[i] = (source[i] as number) - mean;
      peak = Math.max(peak, Math.abs(source[i] as number));
    }

    const scale = 0.9 / peak;
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const value = source[i] as number;
      if (i < fade) {
        const w = i / fade;
        data[i] = (value * w + (source[length + i] as number) * (1 - w)) * scale;
      } else {
        data[i] = value * scale;
      }
    }
  }
  return buffer;
}

/**
 * A synthetic impulse response: noise under an exponential decay. It is what
 * keeps the discovery bell from sounding like it was struck inside a phone —
 * the reef is a big room and the tail is most of why it reads as one.
 */
export function createReverbImpulse(
  ctx: BaseAudioContext,
  seconds: number,
  random: Random,
): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(seconds * rate));
  const buffer = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // A short silent head reads as distance; the ^2.6 tail is a soft room.
      const early = Math.min(1, i / (rate * 0.01));
      data[i] = random.signed(1) * early * (1 - t) ** 2.6;
    }
  }
  return buffer;
}

export function buildAmbienceBed(ctx: BaseAudioContext, random: Random): AmbienceBed {
  const output = ctx.createGain();

  const noise = ctx.createBufferSource();
  noise.buffer = createBrownNoiseBuffer(ctx, AMBIENCE.noiseSeconds, random);
  noise.loop = true;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = AMBIENCE.reefCutoff;
  lowpass.Q.value = 0.6;

  const bedGain = ctx.createGain();
  bedGain.gain.value = AMBIENCE.bedGain;
  noise.connect(lowpass).connect(bedGain).connect(output);

  // The cutoff drifts rather than sits: a static filter on static noise is
  // the one thing that makes a synthesised sea sound synthesised.
  const drift = ctx.createOscillator();
  drift.frequency.value = AMBIENCE.driftRate;
  const driftDepth = ctx.createGain();
  driftDepth.gain.value = AMBIENCE.driftHz;
  drift.connect(driftDepth);
  driftDepth.connect(lowpass.frequency);

  // A slow sine underneath, both pitch- and level-modulated by one twenty
  // second LFO, so the bed inhales and exhales instead of humming.
  const swell = ctx.createOscillator();
  swell.type = "sine";
  swell.frequency.value = AMBIENCE.swellHz;
  const swellLfo = ctx.createOscillator();
  swellLfo.frequency.value = AMBIENCE.swellRate;
  const swellPitch = ctx.createGain();
  swellPitch.gain.value = AMBIENCE.swellSpanHz;
  swellLfo.connect(swellPitch);
  swellPitch.connect(swell.frequency);
  const swellGain = ctx.createGain();
  swellGain.gain.value = AMBIENCE.swellGain;
  const swellDepth = ctx.createGain();
  swellDepth.gain.value = AMBIENCE.swellDepth;
  swellLfo.connect(swellDepth);
  swellDepth.connect(swellGain.gain);
  swell.connect(swellGain).connect(output);

  noise.start();
  drift.start();
  swell.start();
  swellLfo.start();

  return {
    output,
    lowpass,
    stop() {
      stopSources(noise, drift, swell, swellLfo);
    },
  };
}

export function buildSanctuaryPad(ctx: BaseAudioContext): SanctuaryPad {
  const output = ctx.createGain();
  const gain = ctx.createGain();
  gain.gain.value = 0;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = PAD.cutoff;
  filter.Q.value = 0.5;
  filter.connect(gain).connect(output);

  const low = ctx.createOscillator();
  low.type = "triangle";
  low.frequency.value = PAD.hz;
  low.detune.value = -PAD.detuneCents;
  const high = ctx.createOscillator();
  high.type = "triangle";
  high.frequency.value = PAD.hz;
  high.detune.value = PAD.detuneCents;
  low.connect(filter);
  high.connect(filter);

  // The beat between the two detuned voices is the pad's only movement, so
  // the filter gets a drift of its own to keep the top from standing still.
  const drift = ctx.createOscillator();
  drift.frequency.value = PAD.driftRate;
  const driftDepth = ctx.createGain();
  driftDepth.gain.value = PAD.driftHz;
  drift.connect(driftDepth);
  driftDepth.connect(filter.frequency);

  low.start();
  high.start();
  drift.start();

  return {
    output,
    gain,
    stop() {
      stopSources(low, high, drift);
    },
  };
}

/**
 * One bubble: a sine falling from 900Hz to 300Hz inside a sixth of a second.
 * A little jitter in pitch and pan stops a swim sounding like a metronome.
 */
export function playBubble(
  ctx: BaseAudioContext,
  destination: AudioNode,
  when: number,
  random: Random,
): void {
  const jitter = random.range(0.85, 1.2);
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(BUBBLE.startHz * jitter, when);
  osc.frequency.exponentialRampToValueAtTime(BUBBLE.endHz * jitter, when + BUBBLE.decay);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(SILENT, when);
  amp.gain.exponentialRampToValueAtTime(BUBBLE.peakGain * random.range(0.7, 1), when + BUBBLE.attack);
  amp.gain.exponentialRampToValueAtTime(SILENT, when + BUBBLE.decay);

  osc.connect(amp);
  connectPanned(ctx, amp, destination, random.signed(0.45));

  osc.start(when);
  osc.stop(when + BUBBLE.decay + 0.05);
}

/**
 * The discovery bell: three FM voices, struck in sequence.
 *
 * The modulator decays much faster than the carrier, which is the whole trick
 * of an FM bell — the strike is bright and inharmonic, and what rings on
 * afterwards is nearly a pure tone. A flat modulation depth instead gives the
 * buzzing electric-piano sound that would undercut the one moment this game
 * is built around.
 */
export function playChime(ctx: BaseAudioContext, destination: AudioNode, when: number): void {
  const bus = ctx.createBiquadFilter();
  bus.type = "lowpass";
  bus.frequency.value = CHIME.cutoff;
  bus.Q.value = 0.4;
  bus.connect(destination);

  CHIME.notes.forEach((frequency, index) => {
    const start = when + index * CHIME.spacing;
    const peak = CHIME.peakGain * CHIME.noteFalloff ** index;

    const carrier = ctx.createOscillator();
    carrier.type = "sine";
    carrier.frequency.value = frequency;

    const modulator = ctx.createOscillator();
    modulator.type = "sine";
    modulator.frequency.value = frequency * CHIME.modRatio;

    const modDepth = ctx.createGain();
    const depth = frequency * CHIME.modIndex;
    modDepth.gain.setValueAtTime(depth, start);
    modDepth.gain.exponentialRampToValueAtTime(depth * 0.02, start + CHIME.decay * 0.5);
    modulator.connect(modDepth);
    modDepth.connect(carrier.frequency);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(SILENT, start);
    // An exponential rise is slow at first and then quick: a struck bell,
    // without the click that a jump to full level would put in front of it.
    amp.gain.exponentialRampToValueAtTime(peak, start + CHIME.attack);
    amp.gain.exponentialRampToValueAtTime(SILENT, start + CHIME.decay);
    carrier.connect(amp).connect(bus);

    const end = start + CHIME.decay + 0.05;
    carrier.start(start);
    carrier.stop(end);
    modulator.start(start);
    modulator.stop(end);
  });
}

/**
 * An exponential ramp cannot reach or pass through zero, so silence in every
 * envelope here is this: far below the noise floor, but not actually nothing.
 */
const SILENT = 0.0001;

function connectPanned(
  ctx: BaseAudioContext,
  source: AudioNode,
  destination: AudioNode,
  pan: number,
): void {
  if (typeof ctx.createStereoPanner !== "function") {
    source.connect(destination);
    return;
  }
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  source.connect(panner).connect(destination);
}

function stopSources(...sources: AudioScheduledSourceNode[]): void {
  for (const source of sources) {
    try {
      source.stop();
      source.disconnect();
    } catch {
      // Stopping a node twice throws; a teardown must not care.
    }
  }
}
