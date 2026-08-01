import { describe, expect, it } from "vitest";
// Import order is load-bearing (see regionBlue2.test.ts): Seabed first
// so the registry cycle resolves through hoisted functions.
import "../src/world/Seabed";
import { Random } from "../src/util/Random";
import { KIT_SWEEP_SALT } from "../src/world/regions/kit/KitTypes";
import { BLUE_2 } from "../src/world/regions/blue2/Blue2";
import { insideRest } from "../src/world/regions/blue2/Blue2Beats";
import {
  BLUE2_SLOT,
  blue2Ceiling,
  blue2TerrainTarget,
  blue2Weight,
  spokeOf,
  worldOf,
} from "../src/world/regions/blue2/Blue2Terrain";
import { regionSlot, slotCenter } from "../src/world/regions/RegionSlots";

/**
 * The sweep-pose probe (the Carillon Waste's sightline-probe habit):
 * draws the SAME twelve seeded poses `scripts/region-sweep.mjs` will
 * draw (FNV-1a over the slot id ^ KIT_SWEEP_SALT — the published
 * arithmetic), prints them in spoke coordinates so the fill can be
 * aimed where the verifier actually looks, and holds two cheap
 * sanity contracts: every pose stands in real water, and each pose's
 * look ray clears its own ground for the first metres (a camera born
 * inside a riser face would fail before a capture could say so).
 */

function drawSweepPoses(): {
  position: [number, number, number];
  yaw: number;
  pitch: number;
}[] {
  const slot = regionSlot(BLUE2_SLOT.id);
  const center = slotCenter(slot);
  let hash = 0x811c9dc5;
  for (let i = 0; i < BLUE2_SLOT.id.length; i++) {
    hash = Math.imul(hash ^ BLUE2_SLOT.id.charCodeAt(i), 0x01000193);
  }
  const random = new Random((hash >>> 0) ^ KIT_SWEEP_SALT);
  const drawn: { position: [number, number, number]; yaw: number; pitch: number }[] = [];
  let guard = 0;
  while (drawn.length < 12 && guard++ < 4000) {
    const x = center.x + random.signed(slot.radius);
    const z = center.z + random.signed(slot.radius);
    if (BLUE_2.weight(x, z) < 0.5) {
      continue;
    }
    const floor = BLUE_2.terrainTarget(x, z) + BLUE_2.floorClearance + 1.2;
    const ceiling = BLUE_2.ceiling(x, z) - 1.2;
    if (ceiling - floor < 1) {
      continue;
    }
    const y = floor + random.next() * Math.min(ceiling - floor, 6);
    drawn.push({
      position: [x, y, z],
      yaw: random.range(0, Math.PI * 2),
      pitch: -random.range(0.03, 0.22),
    });
  }
  return drawn;
}

describe("great-blue-2 sweep probe", () => {
  it("draws twelve poses and prints where they stand", () => {
    const poses = drawSweepPoses();
    expect(poses.length).toBe(12);
    for (const [i, pose] of poses.entries()) {
      const { u, v } = spokeOf(pose.position[0], pose.position[2]);
      const floor = blue2TerrainTarget(pose.position[0], pose.position[2]);
      // Where the camera looks 20 m out, in spoke coordinates.
      const lookX = pose.position[0] - Math.sin(pose.yaw) * 20;
      const lookZ = pose.position[2] - Math.cos(pose.yaw) * 20;
      const look = spokeOf(lookX, lookZ);
      console.info(
        `[sweep ${String(i + 1).padStart(2, "0")}] u=${u.toFixed(0)} v=${v.toFixed(0)} ` +
          `y=${pose.position[1].toFixed(1)} floor=${floor.toFixed(1)} ` +
          `look→ u=${look.u.toFixed(0)} v=${look.v.toFixed(0)} pitch=${pose.pitch.toFixed(2)} ` +
          `rest=${insideRest(u, v)}`,
      );
      expect(blue2Weight(pose.position[0], pose.position[2])).toBeGreaterThanOrEqual(0.5);
      expect(pose.position[1]).toBeGreaterThan(floor);
      expect(pose.position[1]).toBeLessThan(blue2Ceiling(pose.position[0], pose.position[2]));
      // The look ray must not be BORN inside a wall: a two-metre graze
      // tolerance keeps honest near-field ground (a swell crest in the
      // first metres is foreground, not a bug) while catching a camera
      // staring into a riser face.
      for (const t of [4, 7]) {
        const rx = pose.position[0] - Math.sin(pose.yaw) * t;
        const rz = pose.position[2] - Math.cos(pose.yaw) * t;
        const ry = pose.position[1] + Math.sin(pose.pitch) * t;
        expect(
          ry,
          `sweep ${i + 1} ray dies in ground at ${t} m`,
        ).toBeGreaterThan(blue2TerrainTarget(rx, rz) - 2.0);
      }
    }
    void worldOf;
  });
});
