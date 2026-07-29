import type { MythicDefinition } from "./MythicTypes";
import { OLD_CURRENT } from "./defs/OldCurrent";
import { CROWN_SOVEREIGN } from "./defs/CrownSovereign";
import { REEF_KIRIN } from "./defs/ReefKirin";
import { GENTLE_DARK } from "./defs/GentleDark";
import { KRAKEN_HATCHLING } from "./defs/KrakenHatchling";
import { MOON_KOI } from "./defs/MoonKoi";
import { LANTERN_LEVIATHAN } from "./defs/LanternLeviathan";
import { ISLAND_THAT_SWIMS } from "./defs/IslandThatSwims";

/**
 * The eight mythics, pre-wired by the orchestrator so a creature's worker
 * only ever edits their own `defs/*.ts` module. Append-only, never
 * reordered — codex cards and save keys follow the entries' own ids, but
 * the registry order is still the order `Game` builds them in.
 */
export const MYTHICS: readonly MythicDefinition[] = [
  OLD_CURRENT,
  CROWN_SOVEREIGN,
  REEF_KIRIN,
  GENTLE_DARK,
  KRAKEN_HATCHLING,
  MOON_KOI,
  LANTERN_LEVIATHAN,
  ISLAND_THAT_SWIMS,
];

const BY_ID = new Map(MYTHICS.map((myth) => [myth.entry.id, myth]));

export function mythicById(id: string): MythicDefinition | undefined {
  return BY_ID.get(id);
}
