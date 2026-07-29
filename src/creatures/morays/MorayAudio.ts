/**
 * The morays' door to the soundscape — the same stated wart `FaunaAudio` is,
 * for the same reason: `Moray.update` is handed a position and a flag, not
 * the mixer, and this package may not widen `Game`'s wiring. What it *can*
 * reach is the handle `main.ts` already hangs on the window for the audio
 * probe, which is the same `ReefSoundscape` on the same event bus.
 *
 * Guarded like `AssetLibrary`: without a `window` this is a no-op, which is
 * what lets the unit tests drive hours of den life in plain Node. If
 * `LifeContext` — or `Moray.update` — ever grows an audio channel, this file
 * is the thing it deletes, together with `FaunaAudio`.
 */
interface ReefEventPlayer {
  playEvent(name: "moray-peek", gain?: number): void;
}

export function playMorayPeek(gain: number): void {
  if (typeof window === "undefined") {
    return;
  }
  const audio = (window as unknown as { __reefAudio?: ReefEventPlayer }).__reefAudio;
  audio?.playEvent("moray-peek", gain);
}
