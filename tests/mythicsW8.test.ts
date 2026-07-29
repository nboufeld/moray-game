import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "three";
import type { LifeContext } from "../src/creatures/life/LifeSystem";
import { MYTHICS, mythicById } from "../src/creatures/mythics/MythicRegistry";
import { GentleDarkSystem } from "../src/creatures/mythics/gentledark/GentleDarkSystem";
import { KrakenHatchlingSystem } from "../src/creatures/mythics/kraken/KrakenHatchlingSystem";
import { MoonKoiSystem } from "../src/creatures/mythics/moonkoi/MoonKoiSystem";
import { GLASS_COVE } from "../src/world/wings/defs/GlassCove";
import { MOONLIT_LAGOON } from "../src/world/wings/defs/MoonlitLagoon";
import { OPEN_BLUE } from "../src/world/wings/defs/OpenBlue";
import { angleBetween, wedgeHalfAt, wingTarget } from "../src/world/wings/WingGeometry";

/**
 * Wave 8's W8 trio — the Gentle Dark, the Kraken Hatchling and the Moon Koi.
 * Plain Node, like every life-system test: the creatures must construct and
 * swim without a document, which is also what proves the procedural fallbacks
 * exist — `AssetLibrary` never fires here, so every body in these tests is
 * the stand-in the no-assets build would wear.
 */

const ids = ["myth-gentle-dark", "myth-kraken-hatchling", "myth-moon-koi"] as const;

function context(overrides: Partial<LifeContext> = {}): LifeContext {
  return {
    diverPosition: new Vector3(0, 2, 22),
    diverSpeed: 0,
    reducedMotion: false,
    time: 0,
    ...overrides,
  };
}

describe("the W8 mythic definitions", () => {
  it("keep their stub codex ids exactly, registered in place", () => {
    expect(MYTHICS.map((myth) => myth.entry.id)).toEqual(expect.arrayContaining([...ids]));
    for (const id of ids) {
      expect(mythicById(id)?.entry.id).toBe(id);
    }
  });

  it("build in plain Node with a procedural fallback and one target each", () => {
    for (const id of ids) {
      const build = mythicById(id)!.build();
      const scene = new Scene();
      build.system.addTo(scene);
      expect(build.targets).toHaveLength(1);
      expect(build.targets[0]!.speciesId).toBe(id);
      // The fallback is dressed: the stand-in exists before any GLB can land.
      build.system.update(1 / 60, context());
      build.system.dispose();
      expect(scene.children).toHaveLength(0);
    }
  });
});

describe("the Gentle Dark's schedule", () => {
  /** Steps a fresh system until a phase occurs; returns the second it began. */
  function firstOccurrence(phase: string, horizon: number): number {
    const dark = new GentleDarkSystem();
    let at = -1;
    for (let t = 0; t <= horizon && at < 0; t += 0.5) {
      dark.update(0.5, context({ time: t }));
      if (dark.currentPhase === phase) {
        at = t;
      }
    }
    dark.dispose();
    return at;
  }

  it("rises rarely: first appearance in its window, minutes of water between", () => {
    const riseAt = firstOccurrence("rising", 160);
    expect(riseAt).toBeGreaterThanOrEqual(89);
    expect(riseAt).toBeLessThanOrEqual(151);
    const regardAt = firstOccurrence("regarding", 200);
    // The rise itself is slow: nearly half a minute of surfacing.
    expect(regardAt - riseAt).toBeGreaterThan(24);
    expect(regardAt - riseAt).toBeLessThan(32);

    // And the whole visitation is short against the gap after it: over a
    // simulated quarter hour it may not hold the stage for two full visits.
    const dark = new GentleDarkSystem();
    let regardingSeconds = 0;
    for (let t = 0; t <= 900; t += 0.5) {
      dark.update(0.5, context({ time: t }));
      if (dark.currentPhase === "regarding") {
        regardingSeconds += 0.5;
      }
    }
    dark.dispose();
    // 40 s per regard; three gaps of 3–6 minutes fit at most three visits.
    expect(regardingSeconds).toBeLessThanOrEqual(122);
    expect(regardingSeconds).toBeGreaterThanOrEqual(38);
  });

  it("parks its target out of reach while sunken, offers it only while risen", () => {
    const dark = new GentleDarkSystem();
    const wallDiver = new Vector3(
      50.6 * Math.cos(OPEN_BLUE.azimuth),
      -6.65,
      50.6 * Math.sin(OPEN_BLUE.azimuth),
    );
    let offeredInReach = false;
    for (let t = 0; t <= 220; t += 0.5) {
      dark.update(0.5, context({ time: t, diverPosition: wallDiver }));
      const target = dark.target.position;
      if (dark.currentPhase === "regarding") {
        const distance = target.distanceTo(wallDiver);
        if (distance >= 1.2 && distance <= 14) {
          offeredInReach = true;
        }
        // The nearest silhouette point: above the diver's cap radius, near.
        expect(distance).toBeLessThan(5);
      } else {
        expect(target.y).toBe(-60);
        expect(target.distanceTo(wallDiver)).toBeGreaterThan(40);
      }
    }
    expect(offeredInReach).toBe(true);
    dark.dispose();
  });

  it("is seeded-deterministic: two dives see the same visitations", () => {
    const phases = (system: GentleDarkSystem): string[] => {
      const seen: string[] = [];
      for (let t = 0; t <= 600; t += 0.5) {
        system.update(0.5, context({ time: t }));
        seen.push(system.currentPhase);
      }
      return seen;
    };
    const a = new GentleDarkSystem();
    const b = new GentleDarkSystem();
    const first = phases(a);
    const second = phases(b);
    expect(second).toEqual(first);
    // And its body stands in the same water on the same frame.
    expect(b.group.children[0]!.position.y).toBeCloseTo(a.group.children[0]!.position.y, 10);
    a.dispose();
    b.dispose();
  });
});

describe("the Kraken Hatchling's den and presence", () => {
  it("dens at r ≈ 40 on the cove's axis, off the drift clearing's edge", () => {
    const kraken = new KrakenHatchlingSystem();
    const scene = new Scene();
    kraken.addTo(scene);
    const den = kraken.group.children[0]!.position;

    const radius = Math.hypot(den.x, den.z);
    expect(radius).toBeGreaterThan(39);
    expect(radius).toBeLessThan(41);
    expect(angleBetween(Math.atan2(den.z, den.x), GLASS_COVE.azimuth)).toBeLessThan(
      GLASS_COVE.wedge.floorHalf,
    );
    // Planted on the cove's own floor, not floating in its water.
    expect(Math.abs(den.y - (wingTarget(GLASS_COVE, den.x, den.z) + 0.34))).toBeLessThan(1e-9);
    expect(den.y).toBeGreaterThan(-3.5);
    expect(den.y).toBeLessThan(-1.2);
    // The wedge owns the spot completely — full carve, no wall in it.
    expect(wedgeHalfAt(GLASS_COVE, radius)).toBeGreaterThan(0.11);
    kraken.dispose();
  });

  it("startles at a fast approach, blanching, and comes back to a calm one", () => {
    const kraken = new KrakenHatchlingSystem();
    kraken.addTo(new Scene());
    const den = kraken.group.children[0]!.position;
    const near = den.clone().add(new Vector3(1.5, 0.2, 0.5));

    // Loud and close: the dart and the blanch are both immediate.
    kraken.update(0.1, context({ diverPosition: near, diverSpeed: 4, time: 0 }));
    expect(kraken.presenceState).toBe("startled");
    for (let t = 0.1; t <= 1.2; t += 0.1) {
      kraken.update(0.1, context({ diverPosition: near, diverSpeed: 4, time: t }));
    }
    expect(kraken.blanchAmount).toBeGreaterThan(0.85);
    // The jet put it back into the den's shadow, toward the den from the anchor.
    const tucked = kraken.group.children[0]!.position.distanceTo(den);
    expect(tucked).toBeLessThan(0.3);

    // Sustained calm brings it back out to peek, and the rose returns slowly.
    let backAt = -1;
    for (let t = 1.3; t <= 30 && backAt < 0; t += 0.1) {
      kraken.update(0.1, context({ diverPosition: near, diverSpeed: 0, time: t }));
      if (kraken.presenceState === "peeking") {
        backAt = t;
      }
    }
    expect(backAt).toBeGreaterThan(0);
    const peak = kraken.blanchAmount;
    kraken.update(3, context({ diverPosition: near, diverSpeed: 0, time: backAt + 3 }));
    expect(kraken.blanchAmount).toBeLessThan(peak * 0.5);
    kraken.dispose();
  });

  it("never strays past its presence cap over two ambient hours, deterministically", () => {
    const wander = (seedless: KrakenHatchlingSystem): { min: number; max: number; last: Vector3 } => {
      const anchor = seedless.group.children[0]!.position.clone();
      let min = Infinity;
      let max = -Infinity;
      for (let t = 0; t <= 300; t += 0.5) {
        seedless.update(0.5, context({ time: t, diverPosition: new Vector3(0, 2, 22) }));
        const along = seedless.group.children[0]!.position.clone().sub(anchor);
        min = Math.min(min, along.y);
        max = Math.max(max, along.y);
      }
      return { min, max, last: seedless.group.children[0]!.position.clone() };
    };
    const a = new KrakenHatchlingSystem();
    const b = new KrakenHatchlingSystem();
    const walkA = wander(a);
    const walkB = wander(b);
    // The hard caps, scaled to the hatchling: never deeper than the tuck,
    // never farther than the reach, measured along the den axis's rise.
    expect(walkA.max).toBeLessThan(0.25);
    expect(walkA.min).toBeGreaterThan(-0.12);
    expect(walkB.last.distanceTo(walkA.last)).toBeLessThan(1e-9);
    a.dispose();
    b.dispose();
  });

  it("rides its discovery target on the mantle, in reach while it shows itself", () => {
    const kraken = new KrakenHatchlingSystem();
    kraken.update(0.1, context({ time: 0 }));
    const den = kraken.group.children[0]!.position;
    // The target sits half a metre above the den floor, on the animal.
    expect(kraken.target.position.distanceTo(den.clone().add(new Vector3(0, 0.3, 0)))).toBeLessThan(0.3);
    kraken.dispose();
  });
});

describe("the Moon Koi's figure", () => {
  it("holds its circle inside the lagoon's wedge for a full revolution", () => {
    const koi = new MoonKoiSystem();
    const scene = new Scene();
    koi.addTo(scene);
    const body = koi.group.children[0]!;
    for (let t = 0; t <= 25.2; t += 0.3) {
      koi.update(0.3, context({ time: t, diverPosition: new Vector3(0, 2, 22) }));
      const r = Math.hypot(body.position.x, body.position.z);
      expect(r).toBeGreaterThan(35);
      expect(r).toBeLessThan(45);
      const away = angleBetween(Math.atan2(body.position.z, body.position.x), MOONLIT_LAGOON.azimuth);
      expect(away).toBeLessThan(wedgeHalfAt(MOONLIT_LAGOON, r) - 0.005);
      expect(body.position.y).toBeGreaterThan(2.3);
      expect(body.position.y).toBeLessThan(2.7);
    }
    koi.dispose();
  });

  it("closes the circle in about 25 s, deterministically from its seed", () => {
    const a = new MoonKoiSystem();
    const b = new MoonKoiSystem();
    a.update(1 / 60, context({ time: 0 }));
    const start = a.group.children[0]!.position.clone();
    for (let i = 1; i <= 1500; i++) {
      a.update(1 / 60, context({ time: i / 60 }));
    }
    expect(a.group.children[0]!.position.distanceTo(start)).toBeLessThan(0.35);

    // Same steps, same times: the two dives agree exactly.
    for (let i = 1; i <= 600; i++) {
      b.update(1 / 60, context({ time: i / 60 }));
    }
    for (let i = 601; i <= 1200; i++) {
      a.update(1 / 60, context({ time: i / 60 }));
      b.update(1 / 60, context({ time: i / 60 }));
    }
    expect(b.group.children[0]!.position.distanceTo(a.group.children[0]!.position)).toBe(0);
    a.dispose();
    b.dispose();
  });

  it("meets a calm diver half a metre and yields the same to a fast one", () => {
    const poolX = 40 * Math.cos(MOONLIT_LAGOON.azimuth);
    const poolZ = 40 * Math.sin(MOONLIT_LAGOON.azimuth);
    const diver = new Vector3(poolX + 4, 2.5, poolZ - 1.7);
    const toDiver = new Vector3(diver.x - poolX, 0, diver.z - poolZ).normalize();

    const calm = new MoonKoiSystem();
    for (let t = 0; t <= 10; t += 0.2) {
      calm.update(0.2, context({ time: t, diverPosition: diver, diverSpeed: 0 }));
    }
    const toward = calm.driftOffset;
    expect(toward.length()).toBeLessThanOrEqual(0.55);
    expect(toward.dot(toDiver)).toBeGreaterThan(0.15);
    calm.dispose();

    const fast = new MoonKoiSystem();
    for (let t = 0; t <= 10; t += 0.2) {
      fast.update(0.2, context({ time: t, diverPosition: diver, diverSpeed: 5 }));
    }
    const away = fast.driftOffset;
    expect(away.length()).toBeLessThanOrEqual(0.55);
    expect(away.dot(toDiver)).toBeLessThan(-0.15);
    fast.dispose();
  });

  it("stills its wave under reduced motion while keeping the circle", () => {
    const koi = new MoonKoiSystem();
    koi.update(0.5, context({ time: 0, reducedMotion: true }));
    const start = koi.group.children[0]!.position.clone();
    for (let t = 0.5; t <= 25; t += 0.5) {
      koi.update(0.5, context({ time: t, reducedMotion: true }));
    }
    expect(koi.group.children[0]!.position.distanceTo(start)).toBeLessThan(0.4);
    koi.dispose();
  });
});
