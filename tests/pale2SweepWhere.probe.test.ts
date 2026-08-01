import { it } from "vitest";
// The sweep-pose locator (the Bone Meadows' `pale-sweep-where` idiom):
// reproduces region-sweep.mjs's seeded stream offline and prints each
// frame's spoke coordinates, so a failing sweep frame can be traced to
// a place. Run: npx vitest run tests/pale2SweepWhere.probe.test.ts
// Import order is load-bearing (see regionPale2.test.ts).
import "../src/world/Seabed";
import { PALE_2 } from "../src/world/regions/pale2/Pale2";
import { regionSlot, slotCenter } from "../src/world/regions/RegionSlots";
import { Random } from "../src/util/Random";
import { KIT_SWEEP_SALT } from "../src/world/regions/kit/KitTypes";
import { lumen, spokeOf } from "../src/world/regions/pale2/Pale2Terrain";

it("prints the sweep poses in spoke coordinates", () => {
  const slot = "pale-passage-2";
  const slotDef = regionSlot(slot);
  const center = slotCenter(slotDef);
  let hash = 0x811c9dc5;
  for (let i = 0; i < slot.length; i++) {
    hash = Math.imul(hash ^ slot.charCodeAt(i), 0x01000193);
  }
  const random = new Random((hash >>> 0) ^ KIT_SWEEP_SALT);
  const drawn: string[] = [];
  let guard = 0;
  while (drawn.length < 12 && guard++ < 4000) {
    const x = center.x + random.signed(slotDef.radius);
    const z = center.z + random.signed(slotDef.radius);
    if (PALE_2.weight(x, z) < 0.5) {
      continue;
    }
    const floor = PALE_2.terrainTarget(x, z) + PALE_2.floorClearance + 1.2;
    const ceiling = PALE_2.ceiling(x, z) - 1.2;
    if (ceiling - floor < 1) {
      continue;
    }
    const y = floor + random.next() * Math.min(ceiling - floor, 6);
    const yaw = random.range(0, Math.PI * 2);
    const pitch = -random.range(0.03, 0.22);
    const { u, v } = spokeOf(x, z);
    const lookX = x - Math.sin(yaw) * 30;
    const lookZ = z - Math.cos(yaw) * 30;
    const look = spokeOf(lookX, lookZ);
    drawn.push(
      `${String(drawn.length + 1).padStart(2, "0")}: u=${u.toFixed(0)} v=${v.toFixed(0)} ` +
        `y=${y.toFixed(1)} lumen=${lumen(u, v).toFixed(2)} → looks at u=${look.u.toFixed(0)} v=${look.v.toFixed(0)} ` +
        `pose=${JSON.stringify({ position: [x, y, z], yaw, pitch, settle: 2 })}`,
    );
  }
  console.info(drawn.join("\n"));
});
