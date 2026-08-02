import { describe, expect, it } from "vitest";
import { AudioEngine } from "../src/audio/AudioEngine";
import { ReefSoundscape } from "../src/audio/ReefSoundscape";
import { LIFE_EVENT_NAMES } from "../src/audio/synth";

/**
 * These run in plain Node, where there is no `window` and no `AudioContext`.
 * That is the point: the engine is constructed with the game, long before any
 * gesture, and the soundscape is driven every frame from state the game
 * already has. Both have to be completely inert until they are switched on,
 * or the reef cannot be built in a test at all.
 */
describe("AudioEngine without a window", () => {
  it("is inert on construction", () => {
    const engine = new AudioEngine();
    expect(engine.isStarted).toBe(false);
    expect(engine.contextState).toBeNull();
    expect(engine.masterGain).toBeNull();
    expect(engine.sampleRate).toBeNull();
    expect(engine.now).toBe(0);
  });

  it("stays inert when started, and does not throw", () => {
    const engine = new AudioEngine();
    engine.start();
    engine.start();
    expect(engine.isStarted).toBe(false);
  });

  it("never runs a graph builder it cannot give a context to", () => {
    const engine = new AudioEngine();
    let built = 0;
    engine.onStart.push(() => built++);
    engine.start();
    expect(built).toBe(0);
  });

  it("remembers the requested volume, clamped, before it has anything to apply it to", () => {
    const engine = new AudioEngine();
    engine.setMasterVolume(0.35);
    expect(engine.masterVolume).toBeCloseTo(0.35);

    engine.setMasterVolume(4);
    expect(engine.masterVolume).toBe(1);
    engine.setMasterVolume(-1);
    expect(engine.masterVolume).toBe(0);

    // A corrupt save reaching this far must not turn the level into NaN.
    engine.setMasterVolume(Number.NaN);
    expect(engine.masterVolume).toBe(0);
  });

  it("tracks the mute flag and disposes cleanly", () => {
    const engine = new AudioEngine();
    engine.setMuted(true);
    expect(engine.isMuted).toBe(true);
    engine.setMuted(false);
    expect(engine.isMuted).toBe(false);
    engine.dispose();
  });
});

describe("ReefSoundscape without a window", () => {
  it("accepts every call the game makes, and stays silent", () => {
    const soundscape = new ReefSoundscape();
    soundscape.setVolume(0.5);
    soundscape.setReducedMotion(true);
    soundscape.start();

    expect(soundscape.isStarted).toBe(false);
    expect(soundscape.graphNodes).toEqual([]);
    expect(soundscape.bedCutoff).toBeNull();
    expect(soundscape.padGain).toBeNull();

    // A whole dive's worth of driving, with nothing on the other end of it.
    for (let i = 0; i < 600; i++) {
      soundscape.update(1 / 60, true);
    }
    soundscape.playDiscovery();
    soundscape.setSanctuary(true);
    soundscape.setPanelOpen(true);
    soundscape.setSanctuary(false);
    soundscape.setPanelOpen(false);

    expect(soundscape.chimeCount).toBe(0);
    expect(soundscape.bubblesPlayed).toBe(0);
    soundscape.dispose();
  });

  it("takes every life event the reef can ask for, before there is a graph", () => {
    // The creatures are driven from the simulation, which runs long before
    // anyone touches the page — so an event fired at a soundscape that has no
    // context yet has to be a no-op rather than a crash, exactly like a bubble.
    const soundscape = new ReefSoundscape();
    for (const name of LIFE_EVENT_NAMES) {
      soundscape.playEvent(name);
      soundscape.playEvent(name, 0.2);
      // Silence and nonsense are both a caller's prerogative.
      soundscape.playEvent(name, 0);
      soundscape.playEvent(name, Number.NaN);
    }
    expect(soundscape.eventsPlayed).toBe(0);
    soundscape.dispose();
  });

  it("reports no signal from an offline probe it cannot run", async () => {
    await expect(new ReefSoundscape().probeRms(0.2)).resolves.toBe(0);
  });
});
