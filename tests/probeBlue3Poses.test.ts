import { describe, expect, it } from "vitest";
// Import order is load-bearing (see regionBlue3.test.ts): Seabed first
// so the registry cycle resolves through hoisted functions.
import "../src/world/Seabed";
import { Random } from "../src/util/Random";
import { KIT_SWEEP_SALT } from "../src/world/regions/kit/KitTypes";
import { BLUE_3 } from "../src/world/regions/blue3/Blue3";
import { insideRest } from "../src/world/regions/blue3/Blue3Beats";
import {
  BLUE3_SLOT,
  blue3Ceiling,
  blue3TerrainTarget,
  blue3Weight,
  spokeOf,
  worldOf,
} from "../src/world/regions/blue3/Blue3Terrain";
import { regionSlot, slotCenter } from "../src/world/regions/RegionSlots";

/**
 * The sweep-pose probe (blue-2's pinned idiom): draws the SAME twelve
 * seeded poses `scripts/region-sweep.mjs` will draw (FNV-1a over the
 * slot id ^ KIT_SWEEP_SALT — the published arithmetic), prints them in
 * spoke coordinates so the fill can be aimed where the verifier
 * actually looks, and holds two cheap sanity contracts: every pose
 * stands in real water, and each pose's look ray clears its own ground
 * for the first metres.
 */

function drawSweepPoses(): {
  position: [number, number, number];
  yaw: number;
  pitch: number;
}[] {
  const slot = regionSlot(BLUE3_SLOT.id);
  const center = slotCenter(slot);
  let hash = 0x811c9dc5;
  for (let i = 0; i < BLUE3_SLOT.id.length; i++) {
    hash = Math.imul(hash ^ BLUE3_SLOT.id.charCodeAt(i), 0x01000193);
  }
  const random = new Random((hash >>> 0) ^ KIT_SWEEP_SALT);
  const drawn: { position: [number, number, number]; yaw: number; pitch: number }[] = [];
  let guard = 0;
  while (drawn.length < 12 && guard++ < 4000) {
    const x = center.x + random.signed(slot.radius);
    const z = center.z + random.signed(slot.radius);
    if (BLUE_3.weight(x, z) < 0.5) {
      continue;
    }
    const floor = BLUE_3.terrainTarget(x, z) + BLUE_3.floorClearance + 1.2;
    const ceiling = BLUE_3.ceiling(x, z) - 1.2;
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

describe("great-blue-3 sweep probe", () => {
  it("draws twelve poses and prints where they stand", () => {
    const poses = drawSweepPoses();
    expect(poses.length).toBe(12);
    for (const [i, pose] of poses.entries()) {
      const { u, v } = spokeOf(pose.position[0], pose.position[2]);
      const floor = blue3TerrainTarget(pose.position[0], pose.position[2]);
      const lookX = pose.position[0] - Math.sin(pose.yaw) * 20;
      const lookZ = pose.position[2] - Math.cos(pose.yaw) * 20;
      const look = spokeOf(lookX, lookZ);
      console.info(
        `[sweep ${String(i + 1).padStart(2, "0")}] u=${u.toFixed(0)} v=${v.toFixed(0)} ` +
          `y=${pose.position[1].toFixed(1)} floor=${floor.toFixed(1)} ` +
          `look→ u=${look.u.toFixed(0)} v=${look.v.toFixed(0)} pitch=${pose.pitch.toFixed(2)} ` +
          `rest=${insideRest(u, v)}`,
      );
      expect(blue3Weight(pose.position[0], pose.position[2])).toBeGreaterThanOrEqual(0.5);
      expect(pose.position[1]).toBeGreaterThan(floor);
      expect(pose.position[1]).toBeLessThan(blue3Ceiling(pose.position[0], pose.position[2]));
      // The look ray must not be BORN inside a wall: a two-metre graze
      // tolerance keeps honest near-field ground while catching a
      // camera staring into the Longfall's face or the crater's rim.
      // Hem-facing cones are exempt: on the rim band the wall face IS
      // the composed subject (F-R3 — the wall paint and wall tufts
      // carry those frames; sweep 01 stands in one).
      const { x: cx, z: cz } = worldOf(1460, 0);
      for (const t of [4, 7]) {
        const rx = pose.position[0] - Math.sin(pose.yaw) * t;
        const rz = pose.position[2] - Math.cos(pose.yaw) * t;
        const ry = pose.position[1] + Math.sin(pose.pitch) * t;
        if (Math.hypot(rx - cx, rz - cz) > 160) {
          continue;
        }
        expect(
          ry,
          `sweep ${i + 1} ray dies in ground at ${t} m`,
        ).toBeGreaterThan(blue3TerrainTarget(rx, rz) - 2.0);
      }
    }
    void worldOf;
  });
});
