import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "three";
import { Moray } from "../src/creatures/morays/Moray";
import {
  MAX_EXTENSION,
  MorayPresence,
  presenceSeed,
  STARTLE_RADIUS,
  STARTLE_SPEED,
  TUCK_OFFSET,
  type MorayPresenceState,
  type PresenceInput,
} from "../src/creatures/morays/MorayPresence";
import { MORAY_SPECIES } from "../src/creatures/morays/MoraySpeciesConfig";
import { SandPuffs } from "../src/rendering/SandPuffs";

/**
 * The den life runs on a minutes-long clock and none of it shows in a capture
 * settle, so — like the visitors and the bubble scheduler — it is proven here,
 * in plain Node, by driving simulated hours through the pure machine and the
 * assembled animal.
 */

const STEP = 1 / 30;

function far(): PresenceInput {
  return { distance: 30, diverSpeed: 0, reducedMotion: false };
}

/** Advances the machine, returning every state it passed through. */
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

describe("presence seeds and temperament", () => {
  it("derives a distinct, stable seed per species from SEEDS.morayPresence", () => {
    const ids = MORAY_SPECIES.map((s) => s.id);
    const seeds = ids.map(presenceSeed);
    expect(new Set(seeds).size).toBe(ids.length);
    for (const id of ids) {
      expect(presenceSeed(id)).toBe(presenceSeed(id));
    }
  });

  it("draws the same temperament from the same seed, with traits in range", () => {
    for (const species of MORAY_SPECIES) {
      const a = new MorayPresence(presenceSeed(species.id));
      const b = new MorayPresence(presenceSeed(species.id));
      expect(a.temperament).toEqual(b.temperament);
      for (const trait of [
        a.temperament.boldness,
        a.temperament.wariness,
        a.temperament.curiosity,
      ]) {
        expect(trait).toBeGreaterThanOrEqual(0);
        expect(trait).toBeLessThan(1);
      }
      expect(["bold", "shy", "curious"]).toContain(a.temperament.label);
    }
  });
});

describe("the opening pose is the authored pose", () => {
  it("holds offset at exactly zero for at least 60 seconds with no diver near", () => {
    // The whole shot set, the sightline tests and the discovery e2e were
    // tuned against the authored heads; the first ambient transition sits
    // beyond every capture settle, so a canonical frame cannot catch one.
    for (const species of MORAY_SPECIES) {
      const presence = new MorayPresence(presenceSeed(species.id));
      run(presence, 60, far, (pose) => {
        expect(pose.offset).toBe(0);
        expect(pose.state).toBe("peeking");
        expect(pose.peekBegan).toBe(false);
        expect(pose.puffStrength).toBe(0);
      });
    }
  });
});

describe("the ambient cycle", () => {
  it("visits cover and open water over a long calm dive, inside the safety caps", () => {
    const visited = new Set<MorayPresenceState>();
    let peeks = 0;
    for (const species of MORAY_SPECIES) {
      const presence = new MorayPresence(presenceSeed(species.id));
      const states = run(presence, 45 * 60, far, (pose) => {
        expect(pose.offset).toBeGreaterThanOrEqual(TUCK_OFFSET - 1e-6);
        expect(pose.offset).toBeLessThanOrEqual(MAX_EXTENSION + 1e-6);
        if (pose.peekBegan) {
          peeks++;
        }
      });
      for (const state of states) {
        visited.add(state);
      }
      // Every individual leaves the opening pose eventually.
      expect(states.size).toBeGreaterThan(1);
    }
    // Across the four temperaments the whole cycle is exercised.
    expect(visited.has("tucked")).toBe(true);
    expect(visited.has("extended")).toBe(true);
    expect(peeks).toBeGreaterThan(0);
  });

  it("never startles on a calm dive", () => {
    const presence = new MorayPresence(presenceSeed("zebra-moray"));
    const states = run(presence, 20 * 60, () => ({
      distance: 8,
      diverSpeed: 0.6,
      reducedMotion: false,
    }));
    expect(states.has("startled")).toBe(false);
  });
});

describe("reaction to the diver", () => {
  /** Walks the machine into its extended state through the QA door. */
  function extended(id = "snowflake-moray"): MorayPresence {
    const presence = new MorayPresence(presenceSeed(id));
    presence.force("extended");
    run(presence, 10, far);
    expect(presence.state).toBe("extended");
    return presence;
  }

  it("startles at a rushing diver: fast retreat, one puff, then a wary hold", () => {
    const presence = extended();
    const before = presence.update(STEP, far()).offset;
    expect(before).toBeGreaterThan(0.3);

    const rushing = (): PresenceInput => ({
      distance: STARTLE_RADIUS - 1,
      diverSpeed: STARTLE_SPEED + 2,
      reducedMotion: false,
    });

    let puffs = 0;
    let puffStrength = 0;
    run(presence, 2, rushing, (pose) => {
      if (pose.puffStrength > 0) {
        puffs++;
        puffStrength = pose.puffStrength;
      }
    });
    expect(presence.state).toBe("startled");
    // One puff, sized by how far out the animal was standing.
    expect(puffs).toBe(1);
    expect(puffStrength).toBeGreaterThan(0.6);
    // Two seconds in, the animal is already most of the way into cover.
    expect(presence.update(STEP, rushing()).offset).toBeLessThan(TUCK_OFFSET * 0.6);

    // Still rushing about nearby: it stays down — no flicker, no second puff.
    run(presence, 10, rushing, (pose) => {
      expect(pose.state).toBe("startled");
      expect(pose.puffStrength).toBe(0);
    });
  });

  it("does not startle at a slow approach, however close", () => {
    const presence = extended();
    const states = run(presence, 30, () => ({
      distance: 2.5,
      diverSpeed: 0.4,
      reducedMotion: false,
    }));
    expect(states.has("startled")).toBe(false);
  });

  it("re-emerges only after sustained calm, and slower than it fled", () => {
    const presence = extended();
    run(presence, 1, () => ({ distance: 3, diverSpeed: 6, reducedMotion: false }));
    expect(presence.state).toBe("startled");

    // Speed jittering around the calm threshold resets the calm clock: the
    // hysteresis means the animal cannot strobe at the boundary.
    run(presence, 25, () => ({
      distance: 5,
      diverSpeed: Math.random() < 0.5 ? 0.5 : 2.5,
      reducedMotion: false,
    }));
    // With calm never sustained, it is still holding (the hold itself has
    // long expired — 13 s is the ceiling).
    expect(presence.state).toBe("startled");

    // Genuine calm: it comes back out, and takes seconds to do it.
    let emergedAt = -1;
    let elapsed = 0;
    run(
      presence,
      40,
      () => ({ distance: 7.5, diverSpeed: 0, reducedMotion: false }),
      (pose) => {
        elapsed += STEP;
        if (emergedAt < 0 && pose.peekBegan) {
          emergedAt = elapsed;
        }
      },
    );
    expect(emergedAt).toBeGreaterThan(2);
    expect(presence.state).not.toBe("startled");
    expect(presence.update(STEP, far()).offset).toBeGreaterThan(TUCK_OFFSET * 0.5);
  });

  it("leans out toward a calm, close diver — and never past the extension cap", () => {
    const presence = extended();
    const lingering = (): PresenceInput => ({
      distance: 4,
      diverSpeed: 0.2,
      reducedMotion: false,
    });

    let maxOffset = 0;
    let maxCuriosity = 0;
    run(presence, 30, lingering, (pose) => {
      maxOffset = Math.max(maxOffset, pose.offset);
      maxCuriosity = Math.max(maxCuriosity, pose.curiosity);
    });
    expect(maxCuriosity).toBeGreaterThan(0.8);
    expect(maxOffset).toBeLessThanOrEqual(MAX_EXTENSION + 1e-6);

    // The diver drifts off; the lean lets go.
    run(presence, 20, far);
    expect(presence.update(STEP, far()).curiosity).toBeLessThan(0.1);
  });
});

describe("reduced motion", () => {
  it("halves the excursions and slows the cycle", () => {
    const reach = (reducedMotion: boolean): number => {
      // The natural cycle, not the QA door: `force` seeds a full-range pose
      // and would be measured instead of the damped machine.
      const presence = new MorayPresence(presenceSeed("snowflake-moray"));
      let maxOffset = 0;
      let minOffset = 0;
      run(
        presence,
        40 * 60,
        () => ({ distance: 30, diverSpeed: 0, reducedMotion }),
        (pose) => {
          maxOffset = Math.max(maxOffset, pose.offset);
          minOffset = Math.min(minOffset, pose.offset);
        },
      );
      return maxOffset - minOffset;
    };

    const full = reach(false);
    const damped = reach(true);
    expect(full).toBeGreaterThan(0.6);
    expect(damped).toBeLessThan(full * 0.62);
  });
});

describe("the assembled animal", () => {
  const player = new Vector3(0, 2, 22);

  it("keeps the head exactly on the root until the presence gate opens", () => {
    // The portrait settles for 1 s and `tests/morayHead.test.ts` pins the
    // head through 2 s; the 2.5 s engage gate is what keeps both bit-exact.
    const moray = new Moray(MORAY_SPECIES[0]!);
    moray.asset.root.position.set(0, 1.4, 1.5);
    moray.asset.root.scale.setScalar(1.5);
    for (let i = 0; i < 120; i++) {
      moray.update(1 / 60, player, false);
    }
    expect(moray.asset.bodyRoot.position.z).toBe(0);
  });

  it("never engages on a driven animal, however long it swims", () => {
    // A sanctuary resident's root is re-posed along its lane every frame;
    // presence must read that as "not a den" for the whole session.
    const moray = new Moray(MORAY_SPECIES[1]!);
    for (let i = 0; i < 1800; i++) {
      const t = i / 60;
      moray.asset.root.position.set(Math.sin(t * 0.4) * 4, 3, Math.cos(t * 0.8) * 2);
      moray.update(1 / 60, player, true, 0.1);
      expect(moray.asset.bodyRoot.position.z).toBe(0);
    }
  });

  it("caps the head's world travel at the den-mouth budget", () => {
    const moray = new Moray(MORAY_SPECIES[0]!);
    moray.asset.root.position.set(0, 1.4, 1.5);
    moray.asset.root.scale.setScalar(1.5);
    moray.asset.root.updateMatrixWorld(true);
    const authored = moray.getHeadWorldPosition(new Vector3()).clone();

    // Engage, force the far end of the cycle, and let a lingering calm diver
    // add every lean the machine will give.
    for (let i = 0; i < 300; i++) {
      moray.update(1 / 60, player, false);
    }
    moray.presence.force("extended");
    const lingering = new Vector3(0, 1.6, 5.5);
    let maxTravel = 0;
    for (let i = 0; i < 3600; i++) {
      moray.update(1 / 60, lingering, false);
      moray.asset.root.updateMatrixWorld(true);
      const head = moray.getHeadWorldPosition(new Vector3());
      maxTravel = Math.max(maxTravel, head.distanceTo(authored));
    }
    // The machine caps at MAX_EXTENSION in world metres — comfortably inside
    // the ~1.2 m den-mouth budget the sightline guarantees assume.
    expect(maxTravel).toBeGreaterThan(0.4);
    expect(maxTravel).toBeLessThanOrEqual(MAX_EXTENSION + 1e-3);
  });

  it("wears the den peek arch once the gate opens, without moving the head", () => {
    // W-N3: the recomposed peek. A den dweller's resting head tilts up and
    // the body's first bend dives behind it — measured as the time-average
    // of the rotations, since the sway rides on top and averages to zero —
    // while the head's *world position* stays exactly the authored one,
    // which is the sightline and discovery contract.
    const moray = new Moray(MORAY_SPECIES[2]!);
    moray.asset.root.position.set(13, 1.4, 6);
    moray.asset.root.rotation.y = -Math.PI / 2;
    moray.asset.root.scale.setScalar(1.5);
    moray.asset.root.updateMatrixWorld(true);
    const authored = moray.getHeadWorldPosition(new Vector3()).clone();

    // Through the engage gate and the arch's own ease.
    for (let i = 0; i < 600; i++) {
      moray.update(1 / 60, player, false);
    }

    const joint1 = moray.asset.bodyRoot.children[0]!.children[0]!;
    let headPitch = 0;
    let jointPitch = 0;
    const samples = 600;
    for (let i = 0; i < samples; i++) {
      moray.update(1 / 60, player, false);
      headPitch += moray.asset.head.rotation.x;
      jointPitch += joint1.rotation.x;
    }
    // The resting head looks up (negative x is snout-up), around 20 degrees.
    expect(headPitch / samples).toBeLessThan(-0.25);
    // And the first bend behind the head dives toward the den shadow.
    expect(jointPitch / samples).toBeLessThan(-0.08);

    // The pose is rotation only: the head's world position holds to the bit.
    moray.asset.root.updateMatrixWorld(true);
    const head = moray.getHeadWorldPosition(new Vector3());
    expect(head.x).toBe(authored.x);
    expect(head.y).toBe(authored.y);
    expect(head.z).toBe(authored.z);
  });

  it("wears the zebra's den survey yaw once the gate opens, without moving the head", () => {
    // W-O2: the zebra's den anchor stands just outside the right frustum edge
    // of the canonical B/H/X camera, and its sculpted head reaches 2.1 m
    // further west — a bare cream-outlined snout sliver crossed back into
    // frame ("an overturned dish"). The survey yaw turns the resting snout
    // south, down the approach corridor, and out of that frame. It is a
    // rotation about the head node's own origin, so the head's world
    // position — the sightline target — holds to the bit.
    const zebra = new Moray(MORAY_SPECIES[2]!);
    expect(zebra.config.id).toBe("zebra-moray");
    zebra.asset.root.position.set(13, 1.4, 6);
    zebra.asset.root.rotation.y = -Math.PI / 2;
    zebra.asset.root.scale.setScalar(1.5);
    zebra.asset.root.updateMatrixWorld(true);
    const authored = zebra.getHeadWorldPosition(new Vector3()).clone();

    // Through the engage gate and the arch's ease; the far diver keeps
    // lookBlend at zero so the average reads the resting pose itself.
    for (let i = 0; i < 600; i++) {
      zebra.update(1 / 60, player, false);
    }
    let yaw = 0;
    const samples = 600;
    for (let i = 0; i < samples; i++) {
      zebra.update(1 / 60, player, false);
      yaw += zebra.asset.head.rotation.y;
    }
    // The resting survey heading: at least ~35 degrees toward the corridor.
    // (0.6 rad was measured as the minimum that clears pose B's frame edge;
    // the shipped constant carries margin for pose H's nine-second lean.)
    expect(yaw / samples).toBeGreaterThan(0.6);

    // Rotation only: the head's world position holds to the bit.
    zebra.asset.root.updateMatrixWorld(true);
    const head = zebra.getHeadWorldPosition(new Vector3());
    expect(head.x).toBe(authored.x);
    expect(head.y).toBe(authored.y);
    expect(head.z).toBe(authored.z);

    // And it is the zebra's alone: every other species rests unturned.
    for (const index of [0, 1, 3, 4]) {
      const other = new Moray(MORAY_SPECIES[index]!);
      other.asset.root.position.set(13, 1.4, 6);
      other.asset.root.rotation.y = -Math.PI / 2;
      for (let i = 0; i < 600; i++) {
        other.update(1 / 60, player, false);
      }
      let otherYaw = 0;
      for (let i = 0; i < samples; i++) {
        other.update(1 / 60, player, false);
        otherYaw += other.asset.head.rotation.y;
      }
      expect(Math.abs(otherYaw / samples), MORAY_SPECIES[index]!.id).toBeLessThan(0.05);
    }
  });

  it("never wears the survey yaw on a driven animal, nor inside the engage gate", () => {
    // A sanctuary resident is re-posed every frame; its head must stay on
    // its lane's own heading (the gaze may move it, so drive with a far
    // player and no curiosity).
    const driven = new Moray(MORAY_SPECIES[2]!);
    const farPlayer = new Vector3(0, 30, 40);
    let yaw = 0;
    for (let i = 0; i < 1200; i++) {
      const t = i / 60;
      driven.asset.root.position.set(Math.sin(t * 0.4) * 4, 3, Math.cos(t * 0.8) * 2);
      driven.update(1 / 60, farPlayer, false, 0.1);
      yaw += driven.asset.head.rotation.y;
    }
    expect(Math.abs(yaw / 1200)).toBeLessThan(0.02);

    // And inside the engage gate — the portrait's 1 s settle — the head is
    // still exactly the pre-W-O2 one: unturned.
    const settling = new Moray(MORAY_SPECIES[2]!);
    settling.asset.root.position.set(13, 1.4, 6);
    for (let i = 0; i < 60; i++) {
      settling.update(1 / 60, farPlayer, false);
    }
    expect(Math.abs(settling.asset.head.rotation.y)).toBeLessThan(0.02);
  });

  it("never wears the arch on a driven animal, nor inside the engage gate", () => {
    // A sanctuary resident is re-posed every frame and must swim level.
    const driven = new Moray(MORAY_SPECIES[2]!);
    let pitch = 0;
    const joint1 = driven.asset.bodyRoot.children[0]!.children[0]!;
    for (let i = 0; i < 1200; i++) {
      const t = i / 60;
      driven.asset.root.position.set(Math.sin(t * 0.4) * 4, 3, Math.cos(t * 0.8) * 2);
      driven.update(1 / 60, player, true, 0.1);
      pitch += joint1.rotation.x;
    }
    // Sway only: the average pitch carries no arch.
    expect(Math.abs(pitch / 1200)).toBeLessThan(0.02);

    // And a den dweller inside the 2.5 s gate — the portrait's 1 s settle —
    // is still exactly the pre-W-N3 animal: no lift, no dive.
    const settling = new Moray(MORAY_SPECIES[2]!);
    settling.asset.root.position.set(13, 1.4, 6);
    for (let i = 0; i < 60; i++) {
      settling.update(1 / 60, player, true);
    }
    const settlingJoint = settling.asset.bodyRoot.children[0]!.children[0]!;
    expect(Math.abs(settlingJoint.rotation.x)).toBeLessThan(0.03);
  });

  it("throws silt through the sand-puff door when startled", () => {
    const puffs = new SandPuffs();
    puffs.addTo(new Scene());
    // Publish diver motion the way the life registry would: rushing.
    puffs.update(1 / 60, {
      diverPosition: new Vector3(0, 1.6, 3),
      diverSpeed: 6,
      reducedMotion: false,
      time: 0,
    });

    const moray = new Moray(MORAY_SPECIES[0]!);
    moray.asset.root.position.set(0, 1.4, 1.5);
    moray.asset.root.scale.setScalar(1.5);
    const rushingDiver = new Vector3(0, 1.6, 3);
    for (let i = 0; i < 600; i++) {
      moray.update(1 / 60, rushingDiver, false);
    }
    expect(moray.presence.state).toBe("startled");
    expect(puffs.liveMotes).toBeGreaterThan(0);
    puffs.dispose();
  });
});

describe("sand puffs", () => {
  const ctx = (time: number) => ({
    diverPosition: new Vector3(0, 2, 22),
    diverSpeed: 0,
    reducedMotion: false,
    time,
  });

  it("billows and settles: a burst lives, shrinks and dies away", () => {
    const puffs = new SandPuffs();
    puffs.addTo(new Scene());
    puffs.update(1 / 60, ctx(0));

    puffs.puffAt(new Vector3(0, 1.2, 1.5), 1);
    const born = puffs.liveMotes;
    expect(born).toBeGreaterThanOrEqual(10);

    for (let i = 0; i < 60; i++) {
      puffs.update(1 / 60, ctx(i / 60));
    }
    expect(puffs.liveMotes).toBeGreaterThan(0);

    for (let i = 60; i < 300; i++) {
      puffs.update(1 / 60, ctx(i / 60));
    }
    expect(puffs.liveMotes).toBe(0);
    puffs.dispose();
  });

  it("is a no-op before it joins a scene and caps its population under a storm", () => {
    const unbuilt = new SandPuffs();
    unbuilt.puffAt(new Vector3(), 1);
    expect(unbuilt.liveMotes).toBe(0);
    unbuilt.dispose();

    const puffs = new SandPuffs();
    puffs.addTo(new Scene());
    for (let i = 0; i < 20; i++) {
      puffs.puffAt(new Vector3(i, 1, 0), 1.5);
    }
    expect(puffs.liveMotes).toBeLessThanOrEqual(72);
    puffs.dispose();
  });
});
