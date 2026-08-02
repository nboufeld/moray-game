/**
 * When a discovered moray watches the diver, and when it stops (W-N5).
 *
 * `Game` used to pass `curious = discovered` straight into `Moray.update`,
 * which pinned `lookBlend` at 1 for the rest of the session: on a completed
 * save every head in the reef stayed permanently aimed at the diver, and the
 * den peek poses W-N3 composed never showed again. W-N3's close flagged it,
 * and this latch is the fix.
 *
 * The rule is attention with a slow release. A discovered moray becomes
 * curious the moment the diver genuinely attends to it — holds the focus
 * reticle on it, or simply arrives close — and it stays curious through the
 * discovery ceremony and for as long as the attention lasts. Only after
 * {@link CURIOSITY_RELAX_SECONDS} of *sustained* inattention (diver far away
 * and looking elsewhere, both at once) does the gaze let go, and the animal
 * settles back into its presence-cycle poses.
 *
 * Three fences, each some other package's guarantee:
 *
 * - **Pre-discovery behaviour is untouched.** An undiscovered moray never
 *   takes `curious = true` from here, exactly as it never did from the old
 *   flag — the reticle fill, the ceremony trigger and every fresh-save
 *   capture read the animal bit-identically. (`Moray.update`'s own
 *   `distance < 6` instinct is separate machinery and keeps working either
 *   way.)
 * - **The ceremony is covered by construction.** A discovery can only fire
 *   while the scanner holds the animal focused inside the 1.2–14 m band, so
 *   the frame it fires on is an attended frame: curiosity engages exactly
 *   when it used to, and the relax window means even a player who spins away
 *   instantly leaves the animal watching them go, which is what the plate
 *   moment wants behind it.
 * - **Relaxing is a decision about `Game`'s input to `Moray.update`, not
 *   about the animal.** `lookBlend`'s own ease, the presence cycle, W-M2's
 *   personalities — none of them are touched; this class only decides the
 *   boolean the game was already passing.
 *
 * Pure state, no three, no DOM, so `tests/morayCuriosity.test.ts` can drive
 * minutes of it in plain Node — the same rule every behaviour module here
 * answers to.
 */

/**
 * Seconds of sustained inattention before a discovered moray's gaze relaxes.
 *
 * Long enough that glancing around mid-conversation never drops the animal
 * (the scanner loses focus every time the reticle drifts), short enough that
 * a diver who has moved on leaves the reef to its own life within the
 * half-minute. The timer resets to zero on any attended frame, so this is a
 * quiet spell, not a budget.
 */
export const CURIOSITY_RELAX_SECONDS = 18;

/**
 * Metres within which the diver's presence alone counts as attention.
 *
 * A body hovering an arm's reach from a den is attending whatever the
 * reticle does. Deliberately a little wider than the 6 m instinct inside
 * `Moray.update`, so the game-side latch cannot flicker against the
 * animal-side one at their shared boundary.
 */
export const CURIOSITY_ATTEND_RADIUS = 8;

/** One step's worth of what the diver is doing about this animal. */
export interface AttentionSample {
  /** Whether the species is in the codex. Curiosity never engages before. */
  readonly discovered: boolean;
  /** Whether the focus scanner held this moray as its target. */
  readonly focused: boolean;
  /** Diver distance to the discovery target (the head), in metres. */
  readonly distance: number;
}

/** Per-moray attention latch; `Game` owns one per instance. */
export class MorayCuriosity {
  private curious = false;
  private inattentiveSeconds = 0;

  /** Advances one fixed step and returns the `curious` flag for `Moray.update`. */
  update(step: number, sample: AttentionSample): boolean {
    if (!sample.discovered) {
      return false;
    }
    if (sample.focused || sample.distance < CURIOSITY_ATTEND_RADIUS) {
      this.curious = true;
      this.inattentiveSeconds = 0;
    } else {
      this.inattentiveSeconds += step;
      if (this.inattentiveSeconds >= CURIOSITY_RELAX_SECONDS) {
        this.curious = false;
      }
    }
    return this.curious;
  }
}
