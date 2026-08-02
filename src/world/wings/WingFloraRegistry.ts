import type { WingFloraBuilder } from "./WingTypes";
import { buildKelpCathedralFlora } from "./flora/KelpCathedralFlora";
import { buildNurseryShallowsFlora } from "./flora/NurseryShallowsFlora";
import { buildLumenGardenFlora } from "./flora/LumenGardenFlora";
import { buildWreckMeadowFlora } from "./flora/WreckMeadowFlora";
import { buildVentSpringsFlora } from "./flora/VentSpringsFlora";
import { buildMoonlitLagoonFlora } from "./flora/MoonlitLagoonFlora";
import { buildGlassCoveFlora } from "./flora/GlassCoveFlora";
import { buildGhostReefFlora } from "./flora/GhostReefFlora";
import { buildCurrentRunFlora } from "./flora/CurrentRunFlora";
import { buildRuinsTerraceFlora } from "./flora/RuinsTerraceFlora";
import { buildMangroveRootsFlora } from "./flora/MangroveRootsFlora";
import { buildOpenBlueFlora } from "./flora/OpenBlueFlora";
import { buildIceGrottoFlora } from "./flora/IceGrottoFlora";
import { buildSargassumSkyFlora } from "./flora/SargassumSkyFlora";
import { buildSandfallDunesFlora } from "./flora/SandfallDunesFlora";

/**
 * Wing id → flora builder. Pre-wired to every stub by the orchestrator so a
 * wing's worker only ever edits their own `flora/*.ts` files — this map is
 * complete and append-only for the wave.
 */
export const WING_FLORA_BUILDERS: Readonly<Record<string, WingFloraBuilder>> = {
  "kelp-cathedral": buildKelpCathedralFlora,
  "nursery-shallows": buildNurseryShallowsFlora,
  "lumen-garden": buildLumenGardenFlora,
  "wreck-meadow": buildWreckMeadowFlora,
  "vent-springs": buildVentSpringsFlora,
  "moonlit-lagoon": buildMoonlitLagoonFlora,
  "glass-cove": buildGlassCoveFlora,
  "ghost-reef": buildGhostReefFlora,
  "current-run": buildCurrentRunFlora,
  "ruins-terrace": buildRuinsTerraceFlora,
  "mangrove-roots": buildMangroveRootsFlora,
  "open-blue": buildOpenBlueFlora,
  "ice-grotto": buildIceGrottoFlora,
  "sargassum-sky": buildSargassumSkyFlora,
  "sandfall-dunes": buildSandfallDunesFlora,
};
