import { describe, expect, it } from "vitest";
import "../src/world/Seabed";
import { seabedHeight } from "../src/world/Seabed";
import { golden2TerrainTarget, worldOf } from "../src/world/regions/golden2/Golden2Terrain";

/**
 * Scratch probe (deleted before the round closes): walks each
 * re-authored round-3 pose's sightline over the composed terrain and
 * asserts no wall rises through it before the subject — the r2
 * anchorite-cell lesson (the sill at −14) checked by arithmetic this
 * time instead of by a 90-second capture.
 */

interface Sight {
  name: string;
  u: number;
  v: number;
  lift: number;
  atU: number;
  atV: number;
  pitch: number;
}

const SIGHTS: (Sight & { range?: number })[] = [
  { name: "anchorite-cell", u: 962.5, v: -71.5, lift: 2.1, atU: 962, atV: -80, pitch: -0.08 },
  { name: "seep-terraces", u: 962, v: 102, lift: 5.8, atU: 976, atV: 66, pitch: -0.09 },
  { name: "close-seep-rim", u: 963.5, v: 82.5, lift: 2.2, atU: 968.5, atV: 88.5, pitch: -0.28 },
  { name: "shore-road", u: 668, v: 2, lift: 2.6, atU: 716, atV: 2, pitch: -0.02 },
  // The vista pose walks its ray all the way to the distance rings.
  { name: "sunset-shelf", u: 1064, v: -10, lift: 10.0, atU: 1104, atV: 30, pitch: 0.04, range: 130 },
];

describe("golden-waste-2 round-3 pose sightlines", () => {
  for (const sight of SIGHTS) {
    it(`${sight.name} sees its subject over the composed ground`, () => {
      const from = worldOf(sight.u, sight.v);
      const eye = golden2TerrainTarget(from.x, from.z) + sight.lift;
      const to = worldOf(sight.atU, sight.atV);
      const aim = Math.hypot(to.x - from.x, to.z - from.z);
      const span = sight.range ?? aim;
      let worstClearance = Number.POSITIVE_INFINITY;
      let worstAt = 0;
      // Walk 1 m steps from 1.5 m out to 1.5 m short of the subject.
      for (let d = 1.5; d < span - 1.5; d += 1) {
        const t = d / aim;
        const x = from.x + (to.x - from.x) * t;
        const z = from.z + (to.z - from.z) * t;
        const ray = eye + Math.tan(sight.pitch) * d;
        const ground = seabedHeight(x, z);
        const clearance = ray - ground;
        if (clearance < worstClearance) {
          worstClearance = clearance;
          worstAt = d;
        }
      }
      // eslint-disable-next-line no-console
      console.log(
        `[probe] ${sight.name}: eye ${eye.toFixed(1)}, worst clearance ` +
          `${worstClearance.toFixed(2)} m at ${worstAt.toFixed(0)} m of ${span.toFixed(0)} m`,
      );
      expect(worstClearance).toBeGreaterThan(0.4);
    });
  }
});
