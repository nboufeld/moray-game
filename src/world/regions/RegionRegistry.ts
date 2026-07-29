import type { RegionDef } from "./RegionTypes";
import { VERDANT_1 } from "./verdant1/Verdant1";

/**
 * The registered regions. Pre-wired empty by R0. A region worker adds
 * exactly one import and one array entry for their own region on their
 * branch (needed to see it in their own dev server); the orchestrator owns
 * merging this file across branches — one line per branch, trivially
 * resolvable. Append-only, never reordered.
 */
export const REGIONS: readonly RegionDef[] = [VERDANT_1];

const BY_SLOT = new Map(REGIONS.map((region) => [region.slotId, region]));

export function regionBySlot(slotId: string): RegionDef | undefined {
  return BY_SLOT.get(slotId);
}
