import { Group, type Scene } from "three";
import { Random, SEEDS } from "../../util/Random";
import type { LifeContext, LifeSystem } from "../life/LifeSystem";
import { actorOf, anyPassing, type VisitorKind } from "./VisitorDirector";

/**
 * Seconds before the first visitor of a dive. Long enough that the player has
 * settled into the reef and the canonical captures (settles of two to nine
 * seconds) never see an unforced visitor; short enough that a single play
 * session meets someone.
 */
const FIRST_ARRIVAL_MIN = 75;
const FIRST_ARRIVAL_MAX = 120;

/** Seconds of empty water between one visitor leaving and the next arriving. */
const GAP_MIN = 150;
const GAP_MAX = 260;

/** If the drawn visitor is not registered (a unit test), try again shortly. */
const RETRY_SECONDS = 20;

/**
 * The turtle is the marquee — an explicit request — so it takes half of every
 * draw; the ray is the calm rarity. Order matters only to the cumulative walk.
 */
const ARRIVALS: readonly { kind: VisitorKind; weight: number }[] = [
  { kind: "turtle", weight: 0.5 },
  { kind: "jelly-bloom", weight: 0.3 },
  { kind: "ray", weight: 0.2 },
];

/** The deterministic force-hook, hung beside `__reef` for captures and e2e. */
export interface VisitorTestHook {
  /** Starts a pass now, optionally `secondsIn` into it. Returns success. */
  summon(kind: VisitorKind, secondsIn?: number): boolean;
  /** Whether any visitor is currently crossing. */
  passing(): boolean;
}

/**
 * Decides which visitor is passing through, and when.
 *
 * It owns {@link SEEDS.visitors} — who comes and when is one stream, kept
 * apart from the path streams so re-tuning the cadence never re-rolls where
 * anyone swims. It holds no reference to the visitors themselves: `Game`
 * constructs all four as siblings, so the schedule finds its actors through
 * the module-scope registry in `VisitorDirector`.
 *
 * Never two at once: the countdown simply does not run while someone is on
 * stage, and the gap to the next arrival is drawn when they leave.
 */
export class VisitorSchedule implements LifeSystem {
  readonly group = new Group();
  private readonly random: Random;
  private countdown: number;
  private someonePassing = false;
  private hook: VisitorTestHook | null = null;

  constructor(readonly seed: number = SEEDS.visitors) {
    this.group.name = "visitor-schedule";
    this.random = new Random(seed);
    this.countdown = this.random.range(FIRST_ARRIVAL_MIN, FIRST_ARRIVAL_MAX);

    // The QA door: captures and e2e need a visitor *now*, not two minutes of
    // simulated water from now. Guarded, so the schedule still constructs in
    // Node — where the unit tests call `summon` directly instead.
    if (typeof window !== "undefined") {
      this.hook = {
        summon: (kind, secondsIn = 0) => this.summon(kind, secondsIn),
        passing: () => anyPassing(),
      };
      (window as { __reefVisitors?: VisitorTestHook }).__reefVisitors = this.hook;
    }
  }

  /**
   * Force a visitor on stage, deterministically. `secondsIn` starts the pass
   * part-way through, which is how a nine-second capture photographs the
   * middle of a fifty-second crossing. QA-only; the schedule's own arrivals
   * respect one-at-a-time, and this deliberately does not fight the tester.
   */
  summon(kind: VisitorKind, secondsIn = 0): boolean {
    const actor = actorOf(kind);
    if (!actor) {
      return false;
    }
    actor.beginPass(secondsIn);
    return true;
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }

  update(dt: number, _ctx: LifeContext): void {
    if (anyPassing()) {
      this.someonePassing = true;
      return;
    }
    if (this.someonePassing) {
      // The stage just emptied; the wait until the next arrival starts now.
      this.someonePassing = false;
      this.countdown = this.random.range(GAP_MIN, GAP_MAX);
    }
    this.countdown -= dt;
    if (this.countdown > 0) {
      return;
    }
    const actor = actorOf(this.pickKind());
    if (actor) {
      actor.beginPass();
    } else {
      this.countdown = RETRY_SECONDS;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
    if (typeof window !== "undefined" && this.hook) {
      const holder = window as { __reefVisitors?: VisitorTestHook };
      if (holder.__reefVisitors === this.hook) {
        delete holder.__reefVisitors;
      }
      this.hook = null;
    }
  }

  private pickKind(): VisitorKind {
    const total = ARRIVALS.reduce((sum, arrival) => sum + arrival.weight, 0);
    let draw = this.random.next() * total;
    for (const arrival of ARRIVALS) {
      draw -= arrival.weight;
      if (draw <= 0) {
        return arrival.kind;
      }
    }
    return ARRIVALS[ARRIVALS.length - 1]!.kind;
  }
}
