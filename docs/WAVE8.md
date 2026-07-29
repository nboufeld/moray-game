# Wave 8 — The Great Expansion

Written by the orchestrator before the twelve-worker wave. This is the
shared design reference; each worker also carries a self-contained brief.
Read AGENTS.md's method sections first if you have not. The bar is
unchanged and verbatim: **"literally, near Studio Ghibli graphics as a
video game, not this slop."**

## What this wave is

The critic closed the visual campaign at 9/10 and the owner answered with
scope: the world is too small, too many assets are lazy primitives, and
the cast is too thin. Wave 8 therefore ships, in one parallel push:

- **Fifteen new environments ("wings")** radiating from the bowl through
  the rim — each a wedge with its own carve, water, light, palette and
  emotion, built on the canyon's proven pattern generalised as data
  (`src/world/wings/`). The playable world roughly triples.
- **Twelve new beings**: four new moray species with dens in the wings,
  and eight mythic creatures (`src/creatures/mythics/`).
- **Asset uplift**: crabs, ambient fish, starfish/urchins, corals,
  seagrass (taller, plus bushes), anemones and clownfish (both far
  bigger and legible).
- **Swim-where-you-look movement** (already landed in the scaffold).

## The wing map (GEOMETRY FROZEN)

Azimuth slots: centre `1.35 + i × 0.36` rad; wedge half-angles 0.115
(gate) → 0.165 (end); carve envelope 29.5 → 50 for every wing; airspace
annex to r 51. The canyon keeps 0.79 ± 0.32. Changing any of these moves
other workers' work — do not.

| # | id | title | emotion | floor | ceiling | resident |
|---|----|-------|---------|-------|---------|----------|
| 0 | `kelp-cathedral` | Kelp Cathedral | awe, hush | −5.5 | 11 | — |
| 1 | `nursery-shallows` | Nursery Shallows | tenderness, hope | **+1.6** | 9 | golden dwarf moray |
| 2 | `lumen-garden` | Lumen Garden | deep-night wonder | −10 | 6 | Crown Jelly Sovereign |
| 3 | `wreck-meadow` | Wreck Meadow | melancholy | −6 | 8 | — |
| 4 | `vent-springs` | Vent Springs | otherworldly warmth | −7.5 | 7 | ember moray |
| 5 | `moonlit-lagoon` | Moonlit Lagoon | serenity | −3.2 | 9 | Moon Koi |
| 6 | `glass-cove` | Sea-Glass Cove | playfulness | −2.6 | 9 | Kraken Hatchling |
| 7 | `ghost-reef` | Ghost Reef | sorrow → recovery | −4.2 | 9 | pearl moray |
| 8 | `current-run` | Current Run | exhilaration | −5.2 | 8 | — |
| 9 | `ruins-terrace` | Ruins Terrace | ancient majesty | −6.6 | 9 | Reef Kirin |
| 10 | `mangrove-roots` | Mangrove Roots | intimacy | −1.4 | 6 | — |
| 11 | `open-blue` | The Open Blue | vertigo, freedom | −14 | 11 | The Old Current; The Gentle Dark |
| 12 | `ice-grotto` | Ice Grotto | crystalline hush | −4.4 | 5.5 | frost moray |
| 13 | `sargassum-sky` | Sargassum Sky | dreamlike inversion | −3.4 | 10 | The Island That Swims |
| 14 | `sandfall-dunes` | Sandfall Dunes | meditation | −5.0 | 8 | Lantern Leviathan (flyby beyond) |

A wing owner may tune their def's `mood` tables, `moodSurface`/`moodDescent`
and add a `paint` callback — never the azimuth, carve, wedge or ceilings.

## The cast

New morays (all reuse the shared GLB head + procedural body/pattern):
`golden-dwarf-moray` (nursery, tiny, bright gold, playful), `frost-moray`
(ice grotto, ice-blue with white bands, robust), `ember-moray` (vents,
charcoal with glowing ember speckle), `pearl-moray` (ghost reef,
translucent pearl-white, ethereal). Dens go in `WingDens.ts`; species in
`MoraySpeciesConfig.ts`; personalities in `MorayPersonality.ts` — all
owned by one worker.

Mythics: see `src/creatures/mythics/defs/*.ts` — each stub carries its
concept, GLB budget and seed. Mythics are LifeSystems with discovery
targets; discovered they join the codex (not the sanctuary).

## Non-negotiable invariants

1. **Seeds**: draw only from your pre-registered `SEEDS.*` streams (and
   `^` substreams). Never insert draws into an existing stream.
2. **Bowl and canyon bit-identity**: `tests/wings.test.ts`,
   `tests/abyssBiome.test.ts` and `tests/seabedRelief.test.ts` hold it.
   If your change trips one, your change is wrong — not the test.
3. **FROZEN blocks**: `SPOT_PLACEMENTS`, the crevice machinery, wing
   geometry. Untouchable.
4. **Asset fallbacks**: every GLB/texture loads via `AssetLibrary` with a
   procedural stand-in that must remain healthy.
5. **One writer per channel**: fog/light modulation goes through the wing
   mood tables, never through a second hook.
6. **Toon everything**: `createToonMaterial` (or authored COLOR_0 through
   it); no MeshStandardMaterial, no PBR.
7. **Blender**: `/Applications/Blender-4.5.app/Contents/MacOS/Blender
   --background --python <script>` (4.5.12 LTS, outside sandbox). Follow
   `public/assets/models/CREATURES.md` contracts; verify with
   `inspect_creature.mjs` / `inspect_glb.mjs`.
8. **Perf**: stated triangle budgets per asset; instanced meshes for
   populations; no shadows on smallwork; flag any budget overrun in the
   ledger rather than hiding it.

## Wave discipline (12 workers in one tree)

- Edit ONLY the files your brief assigns you. The scaffold pre-wired
  every registry so shared files need no edits.
- **No dev servers, no browser captures, no e2e during the wave** — the
  machine runs twelve of you; e2e under load lies and HMR poisons
  captures. Verify in Node: targeted `npx vitest run tests/<yours>`,
  probes, and Blender turntables (`render_views` → `visual-qa/atelier/`).
- Ledger: append NOTHING to AGENTS.md during the wave. Write your section
  to `docs/wave8-ledger/<your-id>.md`; the orchestrator merges after.
- Full-suite verification, canonical captures and the critic pass are the
  orchestrator's, after the merge.
