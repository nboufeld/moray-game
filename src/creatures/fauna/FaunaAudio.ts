/**
 * The one door from the ground fauna to the soundscape, and it is a wart worth
 * stating plainly: `LifeContext` carries no audio — it is deliberately four
 * values — and this package's `Game.ts` budget was one appended line, so the
 * crabs cannot be handed the `ReefSoundscape` the way the discovery bell is.
 * What they *can* reach is the handle `main.ts` already hangs on the window for
 * the audio probe, which is the same object on the same event bus.
 *
 * Guarded the same way `AssetLibrary` is: without a `window` this is a no-op,
 * which is what lets the unit tests drive a minute of scuttling in plain Node.
 * If `LifeContext` ever grows an audio field, this file is the thing it
 * deletes.
 */
interface ReefEventPlayer {
  playEvent(name: "crab-click", gain?: number): void;
}

export function playReefEvent(name: "crab-click", gain: number): void {
  if (typeof window === "undefined") {
    return;
  }
  const audio = (window as unknown as { __reefAudio?: ReefEventPlayer }).__reefAudio;
  audio?.playEvent(name, gain);
}
