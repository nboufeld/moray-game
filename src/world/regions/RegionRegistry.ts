import type { RegionDef } from "./RegionTypes";
import { CALAMITY_1 } from "./calamity1/Calamity1";
import { BLUE_1 } from "./blue1/Blue1";
import { VERDANT_1 } from "./verdant1/Verdant1";
import { SMOKING_1 } from "./smoking1/Smoking1";
import { PALE_1 } from "./pale1/Pale1";
import { VERDANT_2 } from "./verdant2/Verdant2";
import { GOLDEN_1 } from "./golden1/Golden1";

/**
 * The registered regions. Pre-wired empty by R0. A region worker adds
 * exactly one import and one array entry for their own region on their
 * branch (needed to see it in their own dev server); the orchestrator owns
 * merging this file across branches — one line per branch, trivially
 * resolvable. Append-only, never reordered.
 */
export const REGIONS: readonly RegionDef[] = [
  VERDANT_1,
  SMOKING_1,
  PALE_1,
  CALAMITY_1,
  VERDANT_2,
  GOLDEN_1,
  BLUE_1,
];

const BY_SLOT = new Map(REGIONS.map((region) => [region.slotId, region]));

export function regionBySlot(slotId: string): RegionDef | undefined {
  return BY_SLOT.get(slotId);
}
