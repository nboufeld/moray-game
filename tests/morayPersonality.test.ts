import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { Moray } from "../src/creatures/morays/Moray";
import {
  allPersonalities,
  DEFAULT_PERSONALITY,
  personalityFor,
  personalitySeed,
} from "../src/creatures/morays/MorayPersonality";
import {
  MAX_EXTENSION,
  MorayPresence,
  NEUTRAL_PRESENCE_STYLE,
  presenceSeed,
  TUCK_OFFSET,
  type MorayPresenceState,
  type PresenceInput,
} from "../src/creatures/morays/MorayPresence";
import { MORAY_SPECIES } from "../src/creatures/morays/MoraySpeciesConfig";

/**
 * W-M2: personality as a species trait. Everything here is the same plain-Node
 * discipline as `morayPresence.test.ts` — the characters live on minutes-long
 * clocks no capture reaches, so they are proven by simulation, and every
 * assertion is a *contrast* between two species rather than a magic number,
 * because the contrast is the design.
 */

const STEP = 1 / 30;

/** Every character: the shipped species plus the hermit's key, deduped —
 * the concurrent package lands "abyss" in `MORAY_SPECIES` itself. */
const CHARACTER_IDS = [...new Set([...MORAY_SPECIES.map((s) => s.id), "abyss"])];

function far(): PresenceInput {
  return { distance: 30, diverSpeed: 0, reducedMotion: false };
}

function presenceOf(id: string): MorayPresence {
  return new MorayPresence(presenceSeed(id), personalityFor(id).presence);
}

function run(
  presence: MorayPresence,
  seconds: number,
  input: () => PresenceInput,
  onPose?: (pose: ReturnType<MorayPresence["update"]>) => void,
): Set<MorayPresenceState> {
  const states = new Set<MorayPresenceState>();
  for (let t = 0; t < seconds; t += STEP) {
    const pose = presence.update(STEP, input());
    states.add(pose.state);
    onPose?.(pose);
  }
  return states;
}

/** Fraction of a long ambient dive spent in a state, opening hold excluded. */
function stateFraction(id: string, state: MorayPresenceState, minutes = 40): number {
  const presence = presenceOf(id);
  run(presence, 180, far); // past the 110–150 s opening hold
  let inState = 0;
  let total = 0;
  run(presence, minutes * 60, far, (pose) => {
    total++;
    if (pose.state === state) {
      inState++;
    }
  });
  return inState / total;
}

describe("the profile lookup", () => {
  it("has a profile for every shipped species, plus the concurrent hermit", () => {
    for (const species of MORAY_SPECIES) {
      expect(personalityFor(species.id).id).toBe(species.id);
    }
    expect(personalityFor("abyss").id).toBe("abyss");
  });

  it("tolerates species without profiles, and either spelling of the hermit", () => {
    const unknown = personalityFor("glass-moray");
    expect(unknown).toBe(DEFAULT_PERSONALITY);
    expect(unknown.presence).toBe(NEUTRAL_PRESENCE_STYLE);
    // The concurrent package may land its species as "abyss" or "abyss-moray";
    // both find the hermit, so neither worker blocks the other.
    expect(personalityFor("abyss-moray").id).toBe("abyss");
  });

  it("keeps every trait window inside the temperament contract", () => {
    for (const profile of allPersonalities()) {
      for (const window of [
        profile.presence.boldness,
        profile.presence.wariness,
        profile.presence.curiosity,
      ]) {
        expect(window.min).toBeGreaterThanOrEqual(0);
        expect(window.max).toBeLessThanOrEqual(1);
        expect(window.min).toBeLessThanOrEqual(window.max);
      }
    }
  });

  it("gives every profile a distinct storybook line, and the default a gentle one", () => {
    const lines = allPersonalities().map((profile) => profile.codexLine);
    expect(new Set(lines).size).toBe(lines.length);
    for (const line of [...lines, DEFAULT_PERSONALITY.codexLine]) {
      expect(line.length).toBeGreaterThan(20);
    }
  });

  it("derives distinct, stable expression seeds apart from the presence stream", () => {
    const ids = CHARACTER_IDS;
    const seeds = ids.map(personalitySeed);
    expect(new Set(seeds).size).toBe(ids.length);
    for (const id of ids) {
      expect(personalitySeed(id)).toBe(personalitySeed(id));
      expect(personalitySeed(id)).not.toBe(presenceSeed(id));
    }
  });
});

describe("the neutral style is the unbiased machine", () => {
  it("matches the styleless constructor draw for draw, through a startle", () => {
    const plain = new MorayPresence(presenceSeed("snowflake-moray"));
    const neutral = new MorayPresence(presenceSeed("snowflake-moray"), NEUTRAL_PRESENCE_STYLE);
    expect(neutral.temperament).toEqual(plain.temperament);

    const script = (t: number): PresenceInput =>
      t > 300 && t < 302
        ? { distance: 3, diverSpeed: 6, reducedMotion: false }
        : far();
    let t = 0;
    for (let i = 0; i < 20 * 60 * 30; i++) {
      t += STEP;
      const input = script(t);
      const a = plain.update(STEP, input);
      const b = neutral.update(STEP, input);
      expect(b.offset).toBe(a.offset);
      expect(b.state).toBe(a.state);
    }
  });
});

describe("the characters, told apart by behaviour", () => {
  it("orders the startle triggers: hair-trigger snowflake, stoic zebra, unshakeable dragon", () => {
    // 4.5 m/s at arm's length: over the snowflake's lowered trigger, under
    // the zebra's raised one, nowhere near the dragon's — which sits above
    // what the 8 m/s dive controller can sustain arriving that close.
    const brisk = (): PresenceInput => ({ distance: 3, diverSpeed: 4.5, reducedMotion: false });
    expect(run(presenceOf("snowflake-moray"), 5, brisk).has("startled")).toBe(true);
    expect(run(presenceOf("zebra-moray"), 5, brisk).has("startled")).toBe(false);
    expect(run(presenceOf("dragon-moray"), 5, brisk).has("startled")).toBe(false);

    const charge = (): PresenceInput => ({ distance: 3, diverSpeed: 7.5, reducedMotion: false });
    expect(run(presenceOf("dragon-moray"), 5, charge).has("startled")).toBe(true);
  });

  it("brings the ribbon back from a startle well before the snowflake", () => {
    const recoveryTime = (id: string): number => {
      const presence = presenceOf(id);
      presence.force("extended");
      run(presence, 5, far);
      run(presence, 2, () => ({ distance: 3, diverSpeed: 7, reducedMotion: false }));
      expect(presence.state).toBe("startled");
      let emergedAt = -1;
      let elapsed = 0;
      run(presence, 120, far, (pose) => {
        elapsed += STEP;
        if (emergedAt < 0 && pose.peekBegan) {
          emergedAt = elapsed;
        }
      });
      expect(emergedAt).toBeGreaterThan(0);
      return emergedAt;
    };
    expect(recoveryTime("ribbon-moray")).toBeLessThan(recoveryTime("snowflake-moray") * 0.6);
  });

  it("makes the abyss hermit withdraw slowly where the snowflake bolts", () => {
    const offsetAfter = (id: string, seconds: number): number => {
      const presence = presenceOf(id);
      presence.force("extended");
      run(presence, 5, far);
      const rushing = (): PresenceInput => ({ distance: 3, diverSpeed: 7, reducedMotion: false });
      let offset = 0;
      run(presence, seconds, rushing, (pose) => {
        offset = pose.offset;
      });
      expect(presence.state).toBe("startled");
      return offset;
    };
    // One second into the fright the snowflake is already deep in cover and
    // the hermit has barely begun to fold back.
    expect(offsetAfter("snowflake-moray", 1)).toBeLessThan(-0.2);
    expect(offsetAfter("abyss", 1)).toBeGreaterThan(0);
  });

  it("makes extension a dragon habit, a snowflake rarity and an abyss occasion", () => {
    const dragon = stateFraction("dragon-moray", "extended");
    const snowflake = stateFraction("snowflake-moray", "extended");
    expect(dragon).toBeGreaterThan(0.3);
    expect(dragon).toBeGreaterThan(snowflake * 2);
    // The hermit lives tucked away; the snowflake hides long too, the
    // patroller doesn't linger in cover.
    expect(stateFraction("abyss", "tucked")).toBeGreaterThan(0.4);
    expect(stateFraction("snowflake-moray", "tucked")).toBeGreaterThan(
      stateFraction("zebra-moray", "tucked") * 1.5,
    );
  });

  it("gives the zebra clockwork rounds and the ribbon quick loose ones", () => {
    const peekSpells = (id: string): number[] => {
      const presence = presenceOf(id);
      run(presence, 200, far); // clear the opening hold
      const spells: number[] = [];
      let inPeek = presence.state === "peeking";
      let spell = 0;
      run(presence, 45 * 60, far, (pose) => {
        if (pose.state === "peeking") {
          spell += STEP;
          inPeek = true;
        } else if (inPeek) {
          spells.push(spell);
          spell = 0;
          inPeek = false;
        }
      });
      return spells.slice(1); // the first may be a partial carried in
    };

    const spread = (spells: number[]): number => {
      const mean = spells.reduce((a, b) => a + b, 0) / spells.length;
      const max = Math.max(...spells);
      const min = Math.min(...spells);
      return (max - min) / mean;
    };

    const zebra = peekSpells("zebra-moray");
    const ribbon = peekSpells("ribbon-moray");
    expect(zebra.length).toBeGreaterThan(5);
    expect(ribbon.length).toBeGreaterThan(zebra.length);
    // The zebra's peeks land within a tight band of one another; the
    // ribbon's scatter across their full range.
    expect(spread(zebra)).toBeLessThan(0.25);
    expect(spread(ribbon)).toBeGreaterThan(0.45);
  });

  it("holds every character inside W-L7's hard caps", () => {
    for (const id of CHARACTER_IDS) {
      const presence = presenceOf(id);
      presence.force("extended");
      const lingering = (): PresenceInput => ({
        distance: 4,
        diverSpeed: 0.2,
        reducedMotion: false,
      });
      run(presence, 40, lingering, (pose) => {
        expect(pose.offset).toBeLessThanOrEqual(MAX_EXTENSION + 1e-6);
        expect(pose.offset).toBeGreaterThanOrEqual(TUCK_OFFSET - 1e-6);
      });
    }
  });

  it("keeps the opening quiescence for every character", () => {
    for (const id of CHARACTER_IDS) {
      const presence = presenceOf(id);
      run(presence, 60, far, (pose) => {
        expect(pose.offset).toBe(0);
        expect(pose.state).toBe("peeking");
      });
    }
  });
});

describe("the ribbon's flourish, on the assembled animal", () => {
  const player = new Vector3(0, 2, 22);

  /** The last joint of the wave chain: bodyRoot's first child is the root
   * bone and each bone's first child is the next. */
  function tailJoint(moray: Moray): { rotation: { y: number } } {
    let joint = moray.asset.bodyRoot.children[0]!;
    for (let next = joint.children[0]; next; next = joint.children[0]) {
      joint = next;
    }
    return joint;
  }

  /** The largest frame-to-frame swing of the tail joint over a window. The
   * ordinary sway is slow (~1.4 rad/s); the ripple's travelling wave is not
   * (~6.5 rad/s), so it shows up as per-frame deltas the sway cannot make. */
  function maxTailDelta(moray: Moray, seconds: number): number {
    const joint = tailJoint(moray);
    // Prime one frame first: the constructed rest pose is a straight chain,
    // so the very first update is a jump to the sway pose, not a sway delta.
    moray.update(STEP, player, false);
    let last = joint.rotation.y;
    let maxDelta = 0;
    for (let t = STEP; t < seconds; t += STEP) {
      moray.update(STEP, player, false);
      maxDelta = Math.max(maxDelta, Math.abs(joint.rotation.y - last));
      last = joint.rotation.y;
    }
    return maxDelta;
  }

  it("never fires inside the opening quiescence, then fires, and only on the ribbon", () => {
    const ribbon = new Moray(MORAY_SPECIES[1]!);
    ribbon.asset.root.position.set(4, 1.3, 8);

    // Through 150 s (engage gate included) the tail moves only at sway speed.
    const quiet = maxTailDelta(ribbon, 150);
    // And within the next eight minutes, at least one ripple runs through it.
    const lively = maxTailDelta(ribbon, 480);
    expect(lively).toBeGreaterThan(quiet * 1.8);
    expect(lively).toBeGreaterThan(0.03);

    // The zebra, same dwell, never flourishes.
    const zebra = new Moray(MORAY_SPECIES[2]!);
    zebra.asset.root.position.set(12, 1.2, 6);
    const zebraQuiet = maxTailDelta(zebra, 150);
    const zebraLater = maxTailDelta(zebra, 480);
    expect(zebraLater).toBeLessThan(zebraQuiet * 1.8);
  });

  it("turns the extended dancer broadside where the patroller stays in line", () => {
    // W-N3: the flourish recomposed. Extended, the ribbon's `extendFlare`
    // sweeps the body laterally — measured as the time-average of a mid-body
    // joint's yaw, since sway and ripple average to zero — while a species
    // without the flare keeps only the small resting S there.
    const meanMidYaw = (config: (typeof MORAY_SPECIES)[number]): number => {
      const moray = new Moray(config);
      moray.asset.root.position.set(-13, 1.6, 6);
      // Through the engage gate and the arch ease, then out to full reach.
      for (let i = 0; i < 10 * 30; i++) {
        moray.update(STEP, player, false);
      }
      moray.presence.force("extended");
      for (let i = 0; i < 8 * 30; i++) {
        moray.update(STEP, player, false);
      }
      // Joint 2 is where the broadside turn is spent: the flare front-loads
      // its yaw so the loop lives in the metre of body outside the den.
      const joint2 = moray.asset.bodyRoot.children[0]!.children[0]!.children[0]!;
      let sum = 0;
      const samples = 15 * 30;
      for (let i = 0; i < samples; i++) {
        moray.update(STEP, player, false);
        sum += joint2.rotation.y;
      }
      return sum / samples;
    };

    const ribbon = meanMidYaw(MORAY_SPECIES[1]!);
    const zebra = meanMidYaw(MORAY_SPECIES[2]!);
    expect(ribbon - zebra).toBeGreaterThan(0.3);

    // And the flare is the dancer's alone, by data: no other profile turns.
    for (const profile of allPersonalities()) {
      if (profile.id !== "ribbon-moray") {
        expect(profile.motion.extendFlare, profile.id).toBe(0);
      }
    }
  });

  it("never ripples on a driven animal — the sanctuary stays a still room", () => {
    const ribbon = new Moray(MORAY_SPECIES[1]!);
    let last = 0;
    let maxDelta = 0;
    const joint = tailJoint(ribbon);
    for (let i = 0; i < 480 * 30; i++) {
      const t = i * STEP;
      ribbon.asset.root.position.set(Math.sin(t * 0.4) * 4, 3, Math.cos(t * 0.8) * 2);
      ribbon.update(STEP, player, true, 0.1);
      if (i > 0) {
        maxDelta = Math.max(maxDelta, Math.abs(joint.rotation.y - last));
      }
      last = joint.rotation.y;
    }
    // Sway plus the lane's bank, never the ripple's frequency.
    expect(maxDelta).toBeLessThan(0.03);
  });
});
