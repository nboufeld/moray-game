# W2 — Wreck Meadow, Vent Springs, Moonlit Lagoon

Worker W2 of the wave-8 twelve. Three wings, three emotions, one visual
identity: lathed/swept silhouettes with fbm tooth, toon materials only,
the darkest thing always a colour (rust keeps red above green; charcoal
keeps warm grey; night keeps violet).

## What was built

### Wreck Meadow (`wreck-meadow`, azimuth 2.43, floor −6) — melancholy

- **Rib cage**: `WreckMeadowRibs.ribArcGeometry` — a swept circular arc
  (RockShapes' authored-silhouette argument: the arc is the drawing, the
  seam-safe fbm is the tooth). Three unit geometries (hoop, stub-low,
  stub-high) instanced over 11 stations down the keel line; per-instance
  scale/yaw/list/colour. Two stations are seeded-guaranteed fallen
  (stream-stable: both lateral offsets drawn regardless); one more fell
  by odds. 8 standing, 3 down.
- **Keel line**: three runs (36.4–39.2, 39.8–42.6, 43.4–45.8), sagging
  boxes with ragged end-wear, merged to one mesh. The sea took the gaps.
- **Timbers**: 20 instanced planks over the floor band + 2 at the gate
  flanks (lateral ≥ 2.0 m; doorway stays ~4 m).
- **Meadow**: `WreckMeadowBlades` (SeaGrass idiom rebuilt locally —
  3-column bowed/cupped/twisted blade, vertex-shader sway, sun-view leaf
  glow self-wound via `onBeforeRender`). 12 patches × 42 blades, muted
  sage/olive/grey-teal families; 379 of 504 blades planted (refusals are
  wedge/blend/keel guards, parked at −200).
- **Mood**: overcast-even — sun 0.5 taken, hemisphere 0.25, ambient 0.1;
  fog [0.72, 0.78, 0.8] (teal-grey, red close behind green, never cyan).
  **Paint**: rust silt low on the floor, mottled, fading up the walls.
- One wood toon material for all timber; vertex-baked rust ramp (dark wet
  feet → pale crown/break), per-instance drift only — nothing black.

### Vent Springs (`vent-springs`, azimuth 2.79, floor −7.5) — otherworldly warmth

- **Chimneys**: `VentSpringsChimneys.chimneyGeometry` — cratered lathe
  profiles (foot/waist/shoulder/lip turning back into a crater), 3
  seeded archetypes instanced as 13 chimneys across 4 off-axis clusters.
  Vertex-baked charcoal strata + amber veins + sinter crust; the polyps'
  `emissive × vColor` chunk makes the *veins only* glow (emissive 0.34,
  far under bloom 0.82).
- **Shimmer**: `VentSpringsBubbles` — 120 fine slow bubbles (Ø 0.07–0.17 m,
  0.2–0.36 m/s) over 13 chimney mouths + 3 fissures; crossed quads (wing
  `update` gets no camera), scale-envelope birth/death, one draw call.
  Reduced motion: × 0.22 — the vents keep breathing, slowly.
- **Amber stones**: 12 worn icosahedra, baked amber gradient, faint
  vein-glow emissive 0.16.
- **Corridor rule (hard)**: every piece's whole footprint ≥ 0.06 rad off
  axis for r 30–46 (`minLateral = max(0.06r, gate 1.6 m) + itemRadius`);
  nothing at all with r < 35.5, so the r 30–34 gate corridor is open by
  construction. Measured minimum centre lateral: 2.79 m at r 39.6
  (rule floor there: 2.37 m). The ember den (WingDens: r 41, across
  −0.025) is untouched.
- **Mood**: scaffold warm tables kept ([0.8, 0.55, 0.42]), densityGain
  0.018; moodSurface 4 → 6 so the warmth greets in the doorway.
  **Paint**: charcoal floor + amber staining pooled in mottle.

### Moonlit Lagoon (`moonlit-lagoon`, azimuth 3.15, floor −3.2) — serenity

- **Tufts**: the shared blade module paled down — 7 patches × 18,
  silver-green families, faint cool emissive 0.12 (the mood takes the
  sun; ghost-kelp discipline).
- **Stones**: 8 basin stones + 2 gate-flank stones, water-worn icosahedra,
  silver baked (cool base → moonlit crown).
- **Motes**: 150 sparkle motes (Particles idiom: additive points, twinkle
  in per-point colour, drift × 0.2 under reduced motion).
- **Moon pool**: one additive ground ring at r 40 on the axis under the
  koi's circle, edge-dissolved vertex fade, opacity 0.2.
- **Koi circle (hard rule)**: `MOONLIT_KOI_CIRCLE` = r 36–44, tops ≤
  floor + 1.25 — tufts capped short (not refused), stones ≤ 0.55 scale,
  motes ≤ floor + 1.1. Exported constant; the test checks against it.
- **Mood/paint**: scaffold silver tables kept ([0.62, 0.72, 0.98], sun
  0.65, ambient −0.05); paint lifts the basin floor cool-silver, easing
  off up the walls.

## Numbers

| wing | draws | tris | placed/parked | contacts |
|---|---|---|---|---|
| wreck-meadow | 6 | 17,204 | 412 / 147 | 6 |
| vent-springs | 5 | 7,992 | 146 / 7 | 14 |
| moonlit-lagoon | 4 | 4,516 | 134 / 2 | 10 |

(Budgets: ≤ 10 draws, ≤ 30k tris per wing — met, parked instances counted
against the totals above.)

## Seeds

Only `SEEDS.wingWreckMeadow` / `wingVentSprings` / `wingMoonlitLagoon`
plus `^` substreams (blade meadow `^0x6d31`/`^0x6d44`, rib geometries
`^0x1b05…`, chimneys `^0x7a11`, bubbles `^0x5b22`, motes `^0x7e55`,
stones `^0x1f66`, paints `^0x51de`/`^0x44aa`/`^0x77c1`, …). All draws are
synchronous at build; no async, no `requestAlbedo` — procedural
`DataTexture` maps only, so Node tests construct everything.

## Verification

- `npm run typecheck` — clean for every file I own (other workers'
  mid-flight files currently fail: `AnemoneGarden.ts`, `OldCurrent.ts`,
  `IceGrottoFlora.ts` — none mine).
- `npx eslint src/world/wings tests/wingsW2Flora.test.ts --max-warnings 0` — clean.
- `npx vitest run tests/wings.test.ts tests/wingsW2Flora.test.ts tests/seabedRelief.test.ts tests/abyssBiome.test.ts`
  — **41/42 pass; all 7 of mine pass.** The one failure is
  `abyssBiome.test.ts > keeps the fifth hiding spot` expecting 5 hiding
  spots where `Reef` now builds 9 (5 + 4 wing dens from the den worker's
  populated `WING_DENS`). Not my change; the assertion looks stale
  against the wave-8 scaffold design — flagging for the orchestrator's
  merge pass.
- My test (`tests/wingsW2Flora.test.ts`): bit-identical double-build,
  per-vertex + per-instance wedge confinement, floor pieces blend > 0.5,
  vent corridor/gate clearance, koi-circle height caps, draw/tri budgets,
  update() smoke + reduced-motion drift (normal motion drifts > 1.5 ×
  reduced).

## Flags

1. **abyssBiome hiding-spot count** (above) — orchestrator to decide
   whether the test learns 9 or the dens report differently.
2. Fixed one of my own bugs mid-build: float box-end + `pow(u, 0.7)`
   produced NaN keel vertices (clamped `u`); caught by my confinement
   test, worth the pattern note for other lathe/box builders.
3. `IceGrottoFlora.ts` currently breaks `tsc` (unused imports + an
   unresolved name) — W-ice worker's mid-flight state, mentioned only so
   a red wave-wide typecheck isn't misread as mine.
