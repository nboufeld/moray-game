/**
 * Called once, when the context has been created and is ready to be built on.
 */
export type AudioGraphBuilder = (context: AudioContext, destination: GainNode) => void;

/** Time constant for every level change, so nothing ever steps and clicks. */
const RAMP_TAU = 0.08;
/**
 * How long to wait after fading to silence before suspending the context.
 * Long enough for the fade to finish — suspending stops the clock the fade
 * is riding on, and a context frozen mid-ramp comes back at the wrong level.
 */
const SUSPEND_DELAY_MS = 400;

/**
 * Owns the `AudioContext`, the master gain and the lifecycle around them.
 *
 * Nothing exists until {@link start} is called, and {@link start} is meant to
 * be called from a real user gesture: browsers refuse to run a context that
 * was not asked for, and a page that constructs one anyway spends the session
 * logging about it. Until then this object holds two numbers and no hardware.
 *
 * It is also safe to construct under Node — nothing here touches `window`
 * outside {@link start}, and {@link start} returns quietly when there is no
 * window to touch, which is what lets the unit tests drive it at all.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.7;
  private muted = false;
  /** Set when the platform has no usable audio, so we stop trying. */
  private unavailable = false;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;

  /** Graph builders, run in order the moment the context comes up. */
  readonly onStart: AudioGraphBuilder[] = [];

  get isStarted(): boolean {
    return this.context !== null;
  }

  get contextState(): string | null {
    return this.context?.state ?? null;
  }

  /** The requested level, which is what the settings slider holds. */
  get masterVolume(): number {
    return this.volume;
  }

  /** The level the master gain is actually at, mid-ramp included. */
  get masterGain(): number | null {
    return this.master?.gain.value ?? null;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get sampleRate(): number | null {
    return this.context?.sampleRate ?? null;
  }

  /**
   * Brings the engine up. Idempotent, and never throws: a reef with no sound
   * is a disappointment, a reef that will not boot is a bug.
   */
  start(): void {
    if (this.context || this.unavailable) {
      return;
    }
    const Ctor = resolveAudioContext();
    if (!Ctor) {
      this.unavailable = true;
      return;
    }

    let created: AudioContext | null = null;
    try {
      const context = new Ctor();
      created = context;
      const master = context.createGain();
      // Always come up from silence and ramp: the first sound of the game
      // must not be the click of a gain node being switched on.
      master.gain.value = 0;

      // A safety net, not an effect. Everything here is mixed well under
      // unity, but a discovery landing on top of a swell should not be able
      // to clip on a player who has their system volume wide open.
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 18;
      limiter.ratio.value = 3;
      limiter.attack.value = 0.008;
      limiter.release.value = 0.25;

      master.connect(limiter).connect(context.destination);

      this.context = context;
      this.master = master;

      for (const build of this.onStart) {
        build(context, master);
      }
    } catch {
      // No audio device, a blocked context, a graph that would not build:
      // none of it is worth taking the dive down for.
      this.teardown();
      this.unavailable = true;
      void created?.close().catch(() => {});
      return;
    }

    this.resume();
    this.applyLevel();
  }

  /** 0..1. Values outside the range are clamped rather than rejected. */
  setMasterVolume(volume: number): void {
    const clamped = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : this.volume;
    if (clamped === this.volume) {
      return;
    }
    this.volume = clamped;
    this.applyLevel();
  }

  setMuted(muted: boolean): void {
    if (muted === this.muted) {
      return;
    }
    this.muted = muted;
    this.applyLevel();
  }

  /** The context's clock, or 0 before it exists. */
  get now(): number {
    return this.context?.currentTime ?? 0;
  }

  dispose(): void {
    this.clearSuspendTimer();
    const context = this.context;
    this.teardown();
    if (context) {
      void context.close().catch(() => {
        // Closing an already-closed context rejects; nothing to do about it.
      });
    }
  }

  private applyLevel(): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) {
      return;
    }
    const target = this.muted ? 0 : this.volume;
    if (target > 0) {
      this.resume();
    }
    master.gain.setTargetAtTime(target, context.currentTime, RAMP_TAU);
    this.scheduleSuspend(target <= 0);
  }

  /**
   * Silence should cost nothing. A muted context still runs its graph — every
   * oscillator, filter and LFO — on the audio thread, so at zero we let it go
   * to sleep and wake it again when there is something to hear.
   */
  private scheduleSuspend(shouldSuspend: boolean): void {
    this.clearSuspendTimer();
    if (!shouldSuspend) {
      return;
    }
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = null;
      const context = this.context;
      if (!context || context.state !== "running") {
        return;
      }
      void context.suspend().catch(() => {
        // Racing a close, or a context the browser already parked.
      });
    }, SUSPEND_DELAY_MS);
  }

  private resume(): void {
    const context = this.context;
    if (!context || context.state !== "suspended") {
      return;
    }
    // Autoplay policy: this rejects when the browser does not believe a
    // gesture happened. Nothing sensible follows from that but staying quiet.
    void context.resume().catch(() => {});
  }

  private clearSuspendTimer(): void {
    if (this.suspendTimer !== null) {
      clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
  }

  private teardown(): void {
    this.context = null;
    this.master = null;
  }
}

type AudioContextConstructor = new () => AudioContext;

function resolveAudioContext(): AudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const scope = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}
