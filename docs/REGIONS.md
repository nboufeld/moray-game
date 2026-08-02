# The Regions — R0 framework and the ambition mandate

Written by the orchestrator at R0, after the owner's verdict on Wave 8's
wings: *"each just adds a ridiculously small square with a tiny different
vibe."* The wings survive as antechambers; the regions are the answer. The
bar for every region, verbatim in spirit from the owner: **a place you can
wander in and be amazed — dreamy — at minimum a hundred times the size,
twenty times the detail. Amaze me, truly and really.**

## What a region is

A region is **a game's worth of place**: a 440-metre disc (~150,000 m² —
several hundred times the whole original playable bowl) streamed in under
the diver, with its own terrain, water, light, flora, creatures, painted
distance, landmarks and secrets. The fog carries the streaming argument:
visibility ends at ~100 m, so only the region under the diver is ever
built or drawn, and each region may spend roughly the entire old game's
visual budget on itself.

Read `src/world/regions/*.ts` end to end before starting — the types are
documented — plus `docs/WAVE8.md` for the world map's history and
AGENTS.md (rg, never whole) for the painting rules.

## The minimum bars (floors, not ceilings)

A region that misses these is not done:

1. **At least five distinct sub-biomes/areas** inside the disc, each with
   its own ground character, flora idiom and value key — the way the bowl
   contains the corridor, the garden, the meadow, the rim and the arch.
   They must *compose*: approach vistas, layered silhouettes, a skyline.
2. **At least eight authored landmark compositions** — set pieces placed
   for the eye (the pinnacle/arch/repoussoir discipline), each one worth
   a screenshot, arranged so wandering keeps producing reveals at
   fog-distance rhythm (something new should breach the fog every
   **20–40 m** of travel — FILL-DOCTRINE rule 2 tightened the old
   30–60 m; MASTER ruling R1 makes that figure canon, and §1.2's
   protected rests are the only exemption).
3. **Real verticality**: ≥ 20 m of terrain range inside the disc
   (terraces, drops, overlooks, swim-throughs). The approach vale
   (depth 1) is an authored journey, not a corridor: a reveal at its
   mouth, a vista at its opening into the disc.
4. **Living density**: ambient populations (instanced — shoals, drifters,
   floor fauna) *plus* at least one findable resident with a codex entry
   and discovery target, and at least one moving centrepiece (creature or
   phenomenon) worth following.
5. **Texture quality**: this program includes the owner's texture-rework
   mandate. No untinted primitives; every surface carries authored vertex
   paint (value-first, gouache logic: darkest thing is a colour, violets
   keep red above green) or a painted wash. Where Wave 8 idioms are
   reused, *improve* their paint, don't copy it.
6. **Its own painted distance**: silhouette layers at the disc's edge
   (the `DistantReef` idiom re-authored per region) so every vista ends
   in layered depth, never in bare fog.
7. **Budgets** (per region, honest and measured — superseded twice, per
   MASTER rulings R1 and R12): ≤ **260 draw calls** attached, ≤ **1.35M
   triangles**, and the BINDING gate is the measurement, not the cap —
   every rework ships a headed frame measure at its densest interior
   pose and must hold **median ≤ 16.9 ms at render scale 1.00**
   (`SHOT_HEADED=1 ... node scripts/measure-frames.mjs`). A region under
   the caps that misses the gate fails; one over a cap that holds the
   gate may ship with the overage recorded. The added headroom is
   licensed for per-instance QUALITY first, density second (R12).
   Instancing for everything repeated, no castShadow on smallwork,
   ground sheets ~1.2 m/vertex. State overruns in the ledger; never
   hide them.

## The contracts (same as they ever were)

- **Seeds**: only your slot's pre-registered `SEEDS.region*` stream and
  `^` substreams; all draws before any async callback.
- **Pure half vs built half**: terrain/weight/mood are pure seeded
  functions, always live, deterministic, cheap (they run inside
  `seabedHeight`); scene objects belong to `build()` only.
- **Identity**: weight exactly 0 outside your domain; nothing inside
  r = 46; never touch another slot's ground. `tests/regions.test.ts`
  holds all of it — extend it with your region's own contracts.
- **One writer per channel**: water and light only through your def's
  mood tables.
- **Fallbacks**: every authored texture/GLB through `AssetLibrary` with a
  healthy procedural stand-in; verify the no-assets build.
- **Toon everything**; Blender 4.5.12 at
  `/Applications/Blender-4.5.app/Contents/MacOS/Blender`, contracts per
  `public/assets/models/CREATURES.md`, turntables into
  `visual-qa/atelier/`.

## The loop that was missing in Wave 8 (mandatory)

You work in your own worktree with your own dev server:

```bash
npx vite --port <your-port>
SHOT_URL=http://localhost:<your-port> node scripts/region-shots.mjs <slot-id> <tag>
```

Author 6–10 capture poses in your def as you design. **Capture, look at
the PNGs, critique yourself in writing, refine — no fewer than four
full look-critique-refine rounds before you call the region done.**
Judge silhouette first, then value structure, then colour, then detail —
at 1600×900, from the poses a player would actually swim through. A
region nobody has looked at is a region that does not exist yet.

Gates before handoff: typecheck, eslint clean on your files, your tests
green plus `regions`, `wings`, `seabedRelief`, `abyssBiome`, and one full
`npm test`; a full capture set under a final tag; a ledger at
`docs/region-ledger/<slot-id>.md` (what/why/numbers/critique
history/flags).
