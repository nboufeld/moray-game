/**
 * One-shot helper: reproduces the twelve seeded sweep poses for
 * pale-passage-1 and prints each one's spoke coordinates, recovery and
 * biome weights, so a failing frame can be traced to the gate that
 * starves it. Delete alongside the other pale-* helpers at close.
 */
// Import order is load-bearing (the documented registry cycle).
import "../src/world/Seabed.ts";
import { PALE_1 } from "../src/world/regions/pale1/Pale1.ts";
import { regionSlot, slotCenter } from "../src/world/regions/RegionSlots.ts";
import { Random } from "../src/util/Random.ts";
import { KIT_SWEEP_SALT } from "../src/world/regions/kit/KitTypes.ts";
import {
  RAVINE_TO,
  bloomWeight,
  boneForestWeight,
  paleWeight,
  recovery,
  spokeOf,
} from "../src/world/regions/pale1/PaleTerrain.ts";

const slot = "pale-passage-1";
const slotDef = regionSlot(slot);
const center = slotCenter(slotDef);

let hash = 0x811c9dc5;
for (let i = 0; i < slot.length; i++) {
  hash = Math.imul(hash ^ slot.charCodeAt(i), 0x01000193);
}
const random = new Random((hash >>> 0) ^ KIT_SWEEP_SALT);

const drawn = [];
let guard = 0;
while (drawn.length < 12 && guard++ < 4000) {
  const x = center.x + random.signed(slotDef.radius);
  const z = center.z + random.signed(slotDef.radius);
  if (PALE_1.weight(x, z) < 0.5) {
    continue;
  }
  const floor = PALE_1.terrainTarget(x, z) + PALE_1.floorClearance + 1.2;
  const ceiling = PALE_1.ceiling(x, z) - 1.2;
  if (ceiling - floor < 1) {
    continue;
  }
  const y = floor + random.next() * Math.min(ceiling - floor, 6);
  const yaw = random.range(0, Math.PI * 2);
  const pitch = -random.range(0.03, 0.22);
  drawn.push({ x, y, z, yaw, pitch });
}

console.log("RAVINE_TO =", RAVINE_TO);
for (const [i, p] of drawn.entries()) {
  const { u, v } = spokeOf(p.x, p.z);
  console.log(
    String(i + 1).padStart(2, "0"),
    "u", u.toFixed(1).padStart(6),
    "v", v.toFixed(1).padStart(7),
    "y", p.y.toFixed(1).padStart(6),
    "yaw", p.yaw.toFixed(2),
    "k", recovery(u, v).toFixed(2),
    "pale", paleWeight(p.x, p.z).toFixed(2),
    "forest", boneForestWeight(u, v).toFixed(2),
    "bloom", bloomWeight(u, v).toFixed(2),
  );
}
