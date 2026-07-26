import { Random, SEEDS } from "../util/Random";
import { AudioEngine } from "./AudioEngine";
import { BubbleScheduler } from "./BubbleScheduler";
import {
  AMBIENCE,
  PAD,
  REVERB_SECONDS,
  buildAmbienceBed,
  buildSanctuaryPad,
  createReverbImpulse,
  playBubble,
  playChime,
  playLifeEvent,
  type AmbienceBed,
  type LifeEventName,
  type SanctuaryPad,
} from "./synth";

/** How far the bed gets out of the way of a discovery: -2dB. */
const DUCK_LEVEL = 0.794;
/** And how long it stays there before coming back up. */
const DUCK_SECONDS = 1;
/** The bed steps back a little further while the comfort panel is open. */
const SOFTENED_LEVEL = 0.6;
/** Seconds the reef takes to become the sanctuary, and back. */
const MODE_CROSSFADE = 1.2;

const CHIME_SEND = 0.35;
const BUBBLE_SEND = 0.12;
const EVENT_SEND = 0.1;

/**
 * The one trim on every living sound in the reef.
 *
 * The voices are already mixed as garnish, and this is the knob that says how
 * much garnish — half, so that even a crab clicking directly under the diver
 * sits below the bubble from their own regulator. It is a bus rather than six
 * constants because the answer to "the reef is getting chatty" has to be one
 * number.
 */
const EVENT_LEVEL = 0.5;

interface SoundscapeGraph {
  readonly context: AudioContext;
  readonly bed: AmbienceBed;
  readonly pad: SanctuaryPad;
  /** Bed and pad, summed — everything that ducks. */
  readonly ambience: GainNode;
  readonly duck: GainNode;
  readonly soften: GainNode;
  readonly chimeBus: GainNode;
  readonly bubbleBus: GainNode;
  /** Everything the reef's creatures do, trimmed by {@link EVENT_LEVEL}. */
  readonly eventBus: GainNode;
}

/**
 * The reef's voice: an ambience bed, the diver's bubbles, the discovery bell
 * and the sanctuary's pad, all synthesised — there is not an audio file in
 * this repository and there is not going to be one.
 *
 * The object is inert until {@link start} runs on a user gesture, and every
 * method below is safe to call before that: the game drives the soundscape
 * from state it already has, and should not have to ask first whether anyone
 * is listening.
 */
export class ReefSoundscape {
  private readonly bubbles = new BubbleScheduler(new Random(SEEDS.audioBubbles));
  private readonly bubbleRandom = new Random(SEEDS.audioBubbleVoice);
  private readonly eventRandom = new Random(SEEDS.audioLife);
  private graph: SoundscapeGraph | null = null;

  private inSanctuary = false;
  private panelOpen = false;
  private reducedMotion = false;
  private chimes = 0;
  private bubbleCount = 0;
  private eventCount = 0;

  constructor(private readonly engine: AudioEngine = new AudioEngine()) {
    this.engine.onStart.push((context, master) => this.build(context, master));
  }

  /** Call from the first user gesture. Idempotent, and never throws. */
  start(): void {
    this.engine.start();
  }

  setVolume(volume: number): void {
    this.engine.setMasterVolume(volume);
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
  }

  /**
   * Advances the event layers. `moving` is the diver actually swimming — not
   * merely alive — because bubbles are the sound of effort.
   */
  update(dt: number, moving: boolean): void {
    if (!this.graph) {
      return;
    }
    if (this.bubbles.update(dt, moving, this.reducedMotion)) {
      this.emitBubble(this.graph);
    }
  }

  /** The bell, and the small breath the bed takes to let it through. */
  playDiscovery(): void {
    const graph = this.graph;
    if (!graph) {
      return;
    }
    const now = graph.context.currentTime;
    playChime(graph.context, graph.chimeBus, now + 0.02);

    graph.duck.gain.cancelScheduledValues(now);
    graph.duck.gain.setTargetAtTime(DUCK_LEVEL, now, 0.12);
    // Back up under the tail rather than after it, so the reef closes over
    // the moment instead of waiting politely for it to finish.
    graph.duck.gain.setTargetAtTime(1, now + DUCK_SECONDS, 0.35);
    this.chimes++;
  }

  /**
   * A one-shot from something alive: a crab moving, a visitor passing, silt
   * settling. `gain` scales the voice's own level, which is how a caller says
   * "small" or "far off" without knowing what the sound is made of.
   *
   * Unlike a discovery this does not duck the bed and does not announce
   * itself. It is safe before the first gesture, like everything else here,
   * and safe to call every frame — nothing rate-limits it, because what makes
   * a noise and how often is the caller's decision, not the mixer's.
   */
  playEvent(name: LifeEventName, gain = 1): void {
    const graph = this.graph;
    if (!graph) {
      return;
    }
    playLifeEvent(
      graph.context,
      graph.eventBus,
      name,
      graph.context.currentTime + 0.02,
      gain,
      this.eventRandom,
    );
    this.eventCount++;
  }

  /** Opens the bed up and fades the pad in (or the reverse, on the way out). */
  setSanctuary(active: boolean): void {
    if (active === this.inSanctuary) {
      return;
    }
    this.inSanctuary = active;
    this.applyMode(MODE_CROSSFADE);
  }

  /** The reef is paused behind the comfort panel; it should sound like it. */
  setPanelOpen(open: boolean): void {
    if (open === this.panelOpen) {
      return;
    }
    this.panelOpen = open;
    this.applySoften();
  }

  dispose(): void {
    const graph = this.graph;
    if (graph) {
      graph.bed.stop();
      graph.pad.stop();
      this.graph = null;
    }
    this.engine.dispose();
  }

  // --- Diagnostics -------------------------------------------------------
  // Exposed on `window.__reefAudio` beside `__reef`. Sound is the one part of
  // this game a screenshot cannot review and a test cannot hear, so the graph
  // reports its own shape and its own levels instead.

  get isStarted(): boolean {
    return this.engine.isStarted && this.graph !== null;
  }

  get contextState(): string | null {
    return this.engine.contextState;
  }

  get sampleRate(): number | null {
    return this.engine.sampleRate;
  }

  get masterVolume(): number {
    return this.engine.masterVolume;
  }

  get masterGain(): number | null {
    return this.engine.masterGain;
  }

  /** Base cutoff of the bed, without the drift LFO riding on top of it. */
  get bedCutoff(): number | null {
    return this.graph?.bed.lowpass.frequency.value ?? null;
  }

  get padGain(): number | null {
    return this.graph?.pad.gain.gain.value ?? null;
  }

  get duckGain(): number | null {
    return this.graph?.duck.gain.value ?? null;
  }

  get chimeCount(): number {
    return this.chimes;
  }

  get bubblesPlayed(): number {
    return this.bubbleCount;
  }

  get eventsPlayed(): number {
    return this.eventCount;
  }

  /** The permanent buses, in signal order, for a structural assertion. */
  get graphNodes(): string[] {
    if (!this.graph) {
      return [];
    }
    return [
      "bed",
      "pad",
      "ambience",
      "duck",
      "soften",
      "chimeBus",
      "bubbleBus",
      "eventBus",
      "master",
    ];
  }

  /**
   * Renders the bed and one chime through an `OfflineAudioContext` and returns
   * the RMS of the result. The same builders that feed the speakers are used
   * here, so a non-zero answer is evidence that the synthesis produces signal
   * — which is as close to listening as an automated check gets.
   */
  async probeRms(seconds = 1.5, volume = 0.7): Promise<number> {
    if (typeof OfflineAudioContext === "undefined") {
      return 0;
    }
    const sampleRate = 44100;
    const context = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
    const master = context.createGain();
    master.gain.value = Math.min(1, Math.max(0, volume));
    master.connect(context.destination);

    const bed = buildAmbienceBed(context, new Random(SEEDS.audioBed));
    bed.output.connect(master);
    playChime(context, master, 0.05);

    const rendered = await context.startRendering();
    const samples = rendered.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i] as number;
      sum += sample * sample;
    }
    return Math.sqrt(sum / Math.max(1, samples.length));
  }

  // --- Graph -------------------------------------------------------------

  private build(context: AudioContext, master: GainNode): void {
    const ambience = context.createGain();
    const duck = context.createGain();
    const soften = context.createGain();
    ambience.connect(duck).connect(soften).connect(master);

    const bed = buildAmbienceBed(context, new Random(SEEDS.audioBed));
    bed.output.connect(ambience);
    const pad = buildSanctuaryPad(context);
    pad.output.connect(ambience);

    const chimeBus = context.createGain();
    chimeBus.connect(master);
    const bubbleBus = context.createGain();
    bubbleBus.connect(master);
    const eventBus = context.createGain();
    eventBus.gain.value = EVENT_LEVEL;
    eventBus.connect(master);

    // A tail on the transients only. The bed is already a diffuse wash and
    // sending it through as well just smears it into mud.
    const reverb = context.createConvolver();
    reverb.buffer = createReverbImpulse(context, REVERB_SECONDS, new Random(SEEDS.audioReverb));
    reverb.connect(master);
    connectSend(context, chimeBus, reverb, CHIME_SEND);
    connectSend(context, bubbleBus, reverb, BUBBLE_SEND);
    // A little less tail than a bubble gets: these sounds are close and small,
    // and a crab in a cathedral is a crab somewhere else.
    connectSend(context, eventBus, reverb, EVENT_SEND);

    this.graph = {
      context,
      bed,
      pad,
      ambience,
      duck,
      soften,
      chimeBus,
      bubbleBus,
      eventBus,
    };

    // The player may already be in the sanctuary or holding the panel open
    // when the first gesture lands; come up in the state we are actually in.
    this.applyMode(0);
    this.applySoften();
  }

  private emitBubble(graph: SoundscapeGraph): void {
    playBubble(graph.context, graph.bubbleBus, graph.context.currentTime + 0.02, this.bubbleRandom);
    this.bubbleCount++;
  }

  private applyMode(seconds: number): void {
    const graph = this.graph;
    if (!graph) {
      return;
    }
    const now = graph.context.currentTime;
    const cutoff = this.inSanctuary ? AMBIENCE.sanctuaryCutoff : AMBIENCE.reefCutoff;
    const frequency = graph.bed.lowpass.frequency;
    frequency.cancelScheduledValues(now);
    frequency.setValueAtTime(frequency.value, now);
    frequency.linearRampToValueAtTime(cutoff, now + Math.max(0.001, seconds));

    const padTarget = this.inSanctuary ? PAD.gain : 0;
    graph.pad.gain.gain.setTargetAtTime(padTarget, now, Math.max(0.05, seconds / 3));
  }

  private applySoften(): void {
    const graph = this.graph;
    if (!graph) {
      return;
    }
    graph.soften.gain.setTargetAtTime(
      this.panelOpen ? SOFTENED_LEVEL : 1,
      graph.context.currentTime,
      0.2,
    );
  }
}

function connectSend(
  context: AudioContext,
  source: GainNode,
  destination: AudioNode,
  amount: number,
): void {
  const send = context.createGain();
  send.gain.value = amount;
  source.connect(send).connect(destination);
}
