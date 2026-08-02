import type { WingDef } from "./WingTypes";
import { KELP_CATHEDRAL } from "./defs/KelpCathedral";
import { NURSERY_SHALLOWS } from "./defs/NurseryShallows";
import { LUMEN_GARDEN } from "./defs/LumenGarden";
import { WRECK_MEADOW } from "./defs/WreckMeadow";
import { VENT_SPRINGS } from "./defs/VentSprings";
import { MOONLIT_LAGOON } from "./defs/MoonlitLagoon";
import { GLASS_COVE } from "./defs/GlassCove";
import { GHOST_REEF } from "./defs/GhostReef";
import { CURRENT_RUN } from "./defs/CurrentRun";
import { RUINS_TERRACE } from "./defs/RuinsTerrace";
import { MANGROVE_ROOTS } from "./defs/MangroveRoots";
import { OPEN_BLUE } from "./defs/OpenBlue";
import { ICE_GROTTO } from "./defs/IceGrotto";
import { SARGASSUM_SKY } from "./defs/SargassumSky";
import { SANDFALL_DUNES } from "./defs/SandfallDunes";

/**
 * The fifteen wings, in azimuth order starting just past the canyon's wedge.
 * The order is load-bearing: `SEEDS.wingDens` and any shared stream that
 * walks "all wings" draws in this order, so the registry is append-only and
 * never reordered — the same contract `SEEDS` itself keeps.
 *
 * Azimuth slots are FROZEN: centres at 1.35 + i × 0.36 rad, wedge half-angles
 * 0.115 (gate) to 0.165 (end), which leaves the canyon's wedge (0.79 ± 0.32)
 * untouched and at least 0.03 rad of standing rock between any two wings.
 */
export const WINGS: readonly WingDef[] = [
  KELP_CATHEDRAL,
  NURSERY_SHALLOWS,
  LUMEN_GARDEN,
  WRECK_MEADOW,
  VENT_SPRINGS,
  MOONLIT_LAGOON,
  GLASS_COVE,
  GHOST_REEF,
  CURRENT_RUN,
  RUINS_TERRACE,
  MANGROVE_ROOTS,
  OPEN_BLUE,
  ICE_GROTTO,
  SARGASSUM_SKY,
  SANDFALL_DUNES,
];

const BY_ID = new Map(WINGS.map((wing) => [wing.id, wing]));

export function wingById(id: string): WingDef {
  const wing = BY_ID.get(id);
  if (!wing) {
    throw new Error(`Unknown wing: ${id}`);
  }
  return wing;
}
