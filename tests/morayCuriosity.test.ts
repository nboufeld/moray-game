import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import {
  CURIOSITY_ATTEND_RADIUS,
  CURIOSITY_RELAX_SECONDS,
  MorayCuriosity,
} from "../src/app/MorayCuriosity";
import { Moray } from "../src/creatures/morays/Moray";
import { MorayRegistry } from "../src/creatures/morays/MorayRegistry";

/**
 * The curiosity latch (W-N5), pinned in plain Node.
 *
 * The bug this replaces: `Game` passed `curious = discovered` forever, so a
 * completed save held every head permanently on the diver and W-N3's peek
 * poses never showed on a discovered animal. The latch's contract has three
 * halves — engage on genuine attention, hold through it, and relax only
 * after a sustained quiet spell — and each is asserted here, plus the one
 * integration fact the pure module cannot see: that a relaxed flag actually
 * lets a real moray's head come back to its den pose.
 */

const STEP = 1 / 60;

function drive(
  latch: MorayCuriosity,
  seconds: number,
  sample: { discovered: boolean; focused: boolean; distance: number },
): boolean {
  let curious = false;
  for (let t = 0; t < seconds; t += STEP) {
    curious = latch.update(STEP, sample);
  }
  return curious;
}

describe("the curiosity latch", () => {
  it("never engages before discovery, however hard the diver attends", () => {
    const latch = new MorayCuriosity();
    expect(drive(latch, 5, { discovered: false, focused: true, distance: 2 })).toBe(false);
  });

  it("stays relaxed on a restored save until the diver actually attends", () => {
    // The whole point of the fix: a completed save boots with the diver at
    // spawn, twenty metres from every den, and the reef keeps its poses.
    const latch = new MorayCuriosity();
    expect(drive(latch, 60, { discovered: true, focused: false, distance: 20.5 })).toBe(false);
  });

  it("engages on the first attended frame, by focus or by presence", () => {
    const byFocus = new MorayCuriosity();
    expect(byFocus.update(STEP, { discovered: true, focused: true, distance: 12 })).toBe(true);

    const byPresence = new MorayCuriosity();
    expect(
      byPresence.update(STEP, {
        discovered: true,
        focused: false,
        distance: CURIOSITY_ATTEND_RADIUS - 0.5,
      }),
    ).toBe(true);
  });

  it("holds through inattention shorter than the relax window", () => {
    const latch = new MorayCuriosity();
    latch.update(STEP, { discovered: true, focused: true, distance: 7 });
    expect(
      drive(latch, CURIOSITY_RELAX_SECONDS - 2, { discovered: true, focused: false, distance: 15 }),
    ).toBe(true);
  });

  it("relaxes after the sustained quiet spell, and only then", () => {
    const latch = new MorayCuriosity();
    latch.update(STEP, { discovered: true, focused: true, distance: 7 });
    expect(
      drive(latch, CURIOSITY_RELAX_SECONDS + 1, { discovered: true, focused: false, distance: 15 }),
    ).toBe(false);
  });

  it("resets the quiet spell on any attended frame", () => {
    const latch = new MorayCuriosity();
    latch.update(STEP, { discovered: true, focused: true, distance: 7 });
    // Most of a window of inattention, one glance back, most of another:
    // never a full window in a row, so the animal keeps watching.
    drive(latch, CURIOSITY_RELAX_SECONDS - 2, { discovered: true, focused: false, distance: 15 });
    latch.update(STEP, { discovered: true, focused: true, distance: 15 });
    expect(
      drive(latch, CURIOSITY_RELAX_SECONDS - 2, { discovered: true, focused: false, distance: 15 }),
    ).toBe(true);
  });

  it("re-engages when the diver comes back", () => {
    const latch = new MorayCuriosity();
    latch.update(STEP, { discovered: true, focused: true, distance: 7 });
    drive(latch, CURIOSITY_RELAX_SECONDS + 1, { discovered: true, focused: false, distance: 15 });
    expect(latch.update(STEP, { discovered: true, focused: false, distance: 5 })).toBe(true);
  });
});

describe("a relaxed flag reaches the animal", () => {
  it("lets a discovered moray's gaze decay back toward its den pose", () => {
    // The integration half: drive a real moray the way `Game.simulate` does,
    // from far enough away that its own 6 m instinct stays quiet, and check
    // the head actually turns toward an attending diver and comes back after
    // the latch relaxes. The diver stands off-axis so the tracked yaw is
    // clearly nonzero while curious.
    // The dragon: the strongest gaze in the reef (lookGain 1.35), so the
    // attended/relaxed contrast is far above any sway noise.
    const config = new MorayRegistry().require("dragon-moray");
    const moray = new Moray(config);
    const diver = new Vector3(9, 1.4, 9);

    // Settle: past the presence gate, gaze relaxed (curious=false, far away).
    for (let t = 0; t < 8; t += STEP) {
      moray.update(STEP, diver, false);
    }
    const restingYaw = moray.asset.head.rotation.y;

    // Attended: the latch would report true; the head turns to the diver.
    for (let t = 0; t < 6; t += STEP) {
      moray.update(STEP, diver, true);
    }
    const attendedYaw = moray.asset.head.rotation.y;
    expect(Math.abs(attendedYaw - restingYaw)).toBeGreaterThan(0.1);

    // Relaxed again: the gaze eases back — the pin the old `curious=true`
    // forever made impossible.
    for (let t = 0; t < 12; t += STEP) {
      moray.update(STEP, diver, false);
    }
    expect(Math.abs(moray.asset.head.rotation.y - restingYaw)).toBeLessThan(0.02);
  });
});
