import type { PlaceMood } from "../wings/WingField";
import type { WingMoodTables } from "../wings/WingTypes";
import { REGIONS } from "./RegionRegistry";
import { REGION_SLOTS, regionSlot, slotCenter } from "./RegionSlots";

/**
 * R0 — the registry-bound region arithmetic the shared systems consume:
 * terrain composition for `Seabed.seabedHeight` and place mood for the fog
 * and lighting hooks. Pure functions of position over the defs' pure
 * halves — nothing here knows whether a region is built.
 *
 * The identity argument, one biome generation on: every region's `weight`
 * is exactly 0 outside its domain, no region domain reaches within
 * r = 120 of the origin (slots start at centre 280 − radius 150, and the
 * approach tongues stop at r = 48 where the gateway wings end — the wings
 * themselves own 29.5–50), and the fast path below rejects the whole loop
 * for any point inside r = 46. The bowl, the canyon and the wings keep
 * their bits by construction; `tests/regions.test.ts` holds it.
 */

/** Inside this radius no region owns anything, tongues included. */
const REGION_MIN_R = 46;

/** Squared reject radius per slot: disc + feather + tongue reach. */
const REJECT: readonly { x: number; z: number; r2: number }[] = REGION_SLOTS.map((slot) => {
  const { x, z } = slotCenter(slot);
  // The disc plus a generous margin; depth-1 tongues run back toward the
  // origin, so those slots' reject radius reaches their gateway instead.
  const reach = slot.depth === 1 ? slot.centerR - REGION_MIN_R + slot.radius : slot.radius + 40;
  return { x, z, r2: reach * reach };
});

const SLOT_INDEX = new Map(REGION_SLOTS.map((slot, index) => [slot.id, index]));

/**
 * Applies every registered region's terrain to a height the bowl, canyon
 * and wings already agreed on. Exactly `base` wherever every weight is 0.
 */
export function applyRegionTerrain(x: number, z: number, base: number): number {
  if (REGIONS.length === 0) {
    return base;
  }
  if (x * x + z * z <= REGION_MIN_R * REGION_MIN_R) {
    return base;
  }
  let height = base;
  for (const region of REGIONS) {
    const reject = REJECT[SLOT_INDEX.get(region.slotId)!]!;
    const dx = x - reject.x;
    const dz = z - reject.z;
    if (dx * dx + dz * dz > reject.r2) {
      continue;
    }
    const weight = region.weight(x, z);
    if (weight !== 0) {
      height += weight * (region.terrainTarget(x, z) - height);
    }
  }
  return height;
}

const MOOD_SCRATCH: { mood: number; tables: WingMoodTables } = {
  mood: 0,
  tables: {
    fog: { colorScale: [1, 1, 1], densityGain: 0, backdropFade: 0 },
    light: { sun: 0, hemisphere: 0, ambient: 0 },
  },
};

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/**
 * The dominant region mood at a point, or null where every region is
 * exactly zero. The fog and lighting hooks ask the canyon first, then the
 * wings, then this — three spatially disjoint place channels over one
 * quantity, still one writer each.
 *
 * Returns a reused scratch object: per-frame, per-scene — do not retain.
 */
export function regionMoodAt(x: number, y: number, z: number): PlaceMood | null {
  if (REGIONS.length === 0) {
    return null;
  }
  if (x * x + z * z <= REGION_MIN_R * REGION_MIN_R) {
    return null;
  }
  let best = 0;
  let bestTables: WingMoodTables | null = null;
  for (const region of REGIONS) {
    if (y >= region.moodSurface) {
      continue;
    }
    const reject = REJECT[SLOT_INDEX.get(region.slotId)!]!;
    const dx = x - reject.x;
    const dz = z - reject.z;
    if (dx * dx + dz * dz > reject.r2) {
      continue;
    }
    const weight = region.weight(x, z);
    if (weight === 0) {
      continue;
    }
    const descent = smoothstep01((region.moodSurface - y) / region.moodDescent);
    const mood = weight * descent;
    if (mood > best) {
      best = mood;
      bestTables = region.mood;
    }
  }
  if (bestTables === null) {
    return null;
  }
  MOOD_SCRATCH.mood = best;
  MOOD_SCRATCH.tables = bestTables;
  return MOOD_SCRATCH;
}

/** Validates a def against its slot at registration time (used by tests). */
export function assertRegionFitsSlot(slotId: string): void {
  regionSlot(slotId);
}
