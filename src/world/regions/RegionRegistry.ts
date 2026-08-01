import type { RegionDef } from "./RegionTypes";
import { CALAMITY_1 } from "./calamity1/Calamity1";
import { BLUE_1 } from "./blue1/Blue1";
import { VERDANT_1 } from "./verdant1/Verdant1";
import { SMOKING_1 } from "./smoking1/Smoking1";
import { PALE_1 } from "./pale1/Pale1";
import { VERDANT_2 } from "./verdant2/Verdant2";
import { GOLDEN_1 } from "./golden1/Golden1";
import { VERDANT_3 } from "./verdant3/Verdant3";
import { GOLDEN_2 } from "./golden2/Golden2";
import { PALE_2 } from "./pale2/Pale2";
import { SMOKING_2 } from "./smoking2/Smoking2";
import { BLUE_2 } from "./blue2/Blue2";
import { GOLDEN_3 } from "./golden3/Golden3";

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
  VERDANT_3,
  GOLDEN_2,
  PALE_2,
  SMOKING_2,
  BLUE_2,
  GOLDEN_3,
];

const BY_SLOT = new Map(REGIONS.map((region) => [region.slotId, region]));

export function regionBySlot(slotId: string): RegionDef | undefined {
  return BY_SLOT.get(slotId);
}
