/**
 * How the visitors find each other, and how they reach the rest of the game.
 *
 * `Game` registers the schedule and the three visitors as four sibling
 * `LifeSystem`s with no references between them — the registry's whole design
 * is that a population touches no shared file. So the wiring lives here, at
 * module scope inside the one package that owns all four: an actor registers
 * itself when it is constructed and the schedule looks it up by kind when its
 * clock says someone should arrive. Registration is undone in `dispose`, which
 * is what keeps the unit tests — which construct and tear these down one at a
 * time — from leaking one test's turtle into the next test's schedule.
 */

export type VisitorKind = "turtle" | "ray" | "jelly-bloom";

/** What the schedule needs to know about a visitor to send it on stage. */
export interface VisitorActor {
  readonly kind: VisitorKind;
  /** True from `beginPass` until the animal has left the water. */
  readonly isPassing: boolean;
  /**
   * Starts a crossing. `secondsIn` starts it part-way through, which is what
   * lets a nine-second capture photograph the middle of a fifty-second pass.
   */
  beginPass(secondsIn?: number): void;
}

const actors = new Map<VisitorKind, VisitorActor>();

export function registerActor(actor: VisitorActor): void {
  actors.set(actor.kind, actor);
}

export function unregisterActor(actor: VisitorActor): void {
  if (actors.get(actor.kind) === actor) {
    actors.delete(actor.kind);
  }
}

export function actorOf(kind: VisitorKind): VisitorActor | null {
  return actors.get(kind) ?? null;
}

export function anyPassing(): boolean {
  for (const actor of actors.values()) {
    if (actor.isPassing) {
      return true;
    }
  }
  return false;
}

/** The two voices `synth.ts` holds ready for this package. */
export type VisitorEventName = "turtle-glide" | "jelly-shimmer";

interface VisitorAudio {
  playEvent(name: VisitorEventName, gain?: number): void;
}

/**
 * A visitor's one-shot, through the soundscape `main.ts` hangs on the window.
 *
 * The `LifeContext` is deliberately four values and no audio handle, and the
 * soundscape is `Game`'s own — so the only door left is the `__reefAudio`
 * diagnostic handle, read at call time and guarded, which makes this a silent
 * no-op in Node exactly the way `AssetLibrary` is inert there. `playEvent`
 * itself is safe before the first gesture, so nothing here needs to ask
 * whether anyone is listening.
 */
export function playVisitorEvent(name: VisitorEventName, gain: number): void {
  if (typeof window === "undefined") {
    return;
  }
  const audio = (window as { __reefAudio?: VisitorAudio }).__reefAudio;
  audio?.playEvent(name, gain);
}
