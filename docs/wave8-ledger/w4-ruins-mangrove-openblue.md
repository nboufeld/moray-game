# W4 — Ruins Terrace, Mangrove Roots, The Open Blue

Three wings, one identity, three emotions: ancient majesty, sheltered
intimacy, and vertigo. Everything is toon (`createToonMaterial` /
`createRockMaterial` for the stone); everything is drawn from
`SEEDS.wingRuinsTerrace` / `wingMangroveRoots` / `wingOpenBlue` plus `^`
substreams, all consumed before anything async; every foot lands on
`seabedHeight`; confinement is by `wingBlend`/`wedgeHalfAt` margins and is
asserted, not hoped for.

## What was built

### Ruins Terrace (`ruins-terrace`) — ancient majesty, no menace

A processional way in mossed stone: a **hero arch spanning the corridor**
(r 35.6, legs 6.6 m apart so the lane swims *through* it — the reef's own
`archGeometry` idiom), a **broken twin** on the east shelf (r 42.5, span
turned along the axis), a **colonnade** of three lathed standing drums
(rising east) and three fallen drums + capital (strewn west), and a
**half-buried round doorway** (a weathered torus ring, toppled, r 44.8).
Moss is two layers: `mossFaces` (a blotch field multiplied over
`weatherRock`'s baked algae tint, so up-faces go soft gouache green in
patches) plus ~32 low green tufts at every foot and along the meadow's
fringe. Mood retuned brighter gold-green (sun barely touched: majesty is a
value story, not a gloom); floor `paint` adds the same gold-green wash to
the sand.

Fences (all asserted): corridor r 30–46 |across| < 0.06 holds nothing below
2.4 m over the floor (the lintel passes overhead); **Kirin meadow** r 38–44
keeps a clearing ≥ 4 m wide (everything stands |lateral| ≥ 2.6); gate
r < 34.5 is ankle-height scenery only (two moss boulders + low tufts).

### Mangrove Roots (`mangrove-roots`) — intimacy, shelter

Five clusters (r 39.5–46.2, alternating sides; the wedge is only ±0.115 rad
at the gate, so clusters begin where the walls open) each drop **seven
tapered prop-root arcs** from a crown past the ceiling (custom
`taperedTube` — `TubeGeometry` can't taper, and a root that doesn't taper
is a pipe) that bend *away* from the lane and spread fore/aft along the
wing where the wedge has room. One merged draw for all 35 roots; wood
gradient baked per-vertex (warm crown → damp foot). Plus: 19 root-knee
stumps, 23 warm-tinted tufts, and **amber dapple** — 15 soft additive
quads high between the roots (opacity 0.12, `fog: false`, far under the
bloom threshold) with a slow breathing shimmer (the wing's one `update`;
dims under reduced motion). Mood: closer, warmer water; backdrop dissolves
to 0.5 (shelter has no horizon); floor `paint` warms the sand.

Fences: r 30–46 |across| < 0.05 holds **zero** solid geometry; nothing
solid below r 34 at all. Roots join **no colliders** (scenery, per the
stub's flag option) — swim-through roots, noted here per the brief.

### The Open Blue (`open-blue`) — vertigo, freedom, vastness

Restraint shipped as four things: **the lip** (7 pale slabs leaning seaward
along r 36.4–37.6, flanks only — the bare middle *is* the edge), **64
sparse motes** in the approach water (r ≤ 39.5), **two far curtains**
(r 48.4/48.9, canyon `curtainArc` idiom generalised to the wing's azimuth,
fog-ink re-derived from live water, deep blue, skylines *below* a diver's
eye line so the end stays open), and **one lone spire** (r 47.6, west
flank, deep blue-grey toon). Mood: negative density gain (the water clears
at full mood), backdrop fade 0.6, sun kept — vertigo reads bright. Floor
`paint` falls from pale warm lip to deep blue-green with depth — the drop
is painted on the sand. The test asserts the emptiness: **zero flora
instances past r 38** except the accents (curtains + spire, all ≥ r 44),
motes ≤ 90 and ≤ r 40.

## Numbers

| wing | draws | triangles | contacts | budget |
|---|---|---|---|---|
| ruins-terrace | 4 | 6 562 | 20 | ≤ 10 draws, ≤ 30 k tris |
| mangrove-roots | 4 | 5 036 | 5 | ≤ 10 draws, ≤ 30 k tris |
| open-blue | 5 | 2 552 (+64 pts) | 8 | ≤ 10 draws, ≤ 30 k — far under, on purpose |

## Files

- `src/world/wings/flora/W4FloraKit.ts` (new, mine): wing frame, tapered
  tube, moss blotch pass, tuft geometry, wing curtain, `FogInk`
  (`DistantReef.followFog` packed), soft sprite, instancing/world-merge.
- `src/world/wings/flora/{RuinsTerraceFlora,MangroveRootsFlora,OpenBlueFlora}Flora.ts`…
  (i.e. `RuinsTerraceFlora.ts`, `MangroveRootsFlora.ts`, `OpenBlueFlora.ts`)
  — stubs replaced.
- `src/world/wings/defs/{RuinsTerrace,MangroveRoots,OpenBlue}.ts` — **only**
  `mood`, `moodSurface`/`moodDescent`, and a new `paint`. Azimuth, carve,
  wedge, ceilings untouched.
- `tests/wingsW4Flora.test.ts` (new, mine): 9 tests — bit-determinism,
  wedge/radial confinement, ruins corridor + Kirin meadow + gate law,
  mangrove lane + gate law, Open-Blue emptiness, budgets, seabed feet,
  shimmer, contacts.

## Verification (Node only)

- `npm run typecheck` — my files clean. Pre-existing mid-flight errors in
  other workers' files (`mythics/**`, `LumenGardenFlora.ts`,
  `tests/mythicsW8.test.ts`) are not mine and were left alone.
- `npx eslint src/world/wings tests/wingsW4Flora.test.ts --max-warnings 0`
  — clean (the one remaining error is `LumenGardenFlora.ts`, W-other).
- `npx vitest run tests/wingsW4Flora.test.ts` — **9/9 green**.
- `npx vitest run tests/wings.test.ts tests/wingsW4Flora.test.ts
  tests/seabedRelief.test.ts tests/abyssBiome.test.ts` — 30/30 pass except
  one **unrelated mid-flight failure**: `abyssBiome.test.ts` "keeps the
  fifth hiding spot" now finds 9 hiding spots because the den worker's
  `WingDens.ts` (their file) added the four wing dens; the test or the den
  package will reconcile. Nothing of mine touches dens or hiding spots.
- Full `npm test`, once, at the end: 413/423 pass. Every failure is in
  another worker's mid-flight file (`abyssBiome`, `coralGarden`, `fauna`,
  `lifeSystems`, `reefSightlines`, `seaweed`, `wingDens`, `wingsW2Flora`,
  `wingsW5Flora`). None is in a file I own; `wingsW4Flora`, `wings` and
  `seabedRelief` are green.

## Flags

- **Silhouette/light marks use `MeshBasicMaterial` with `fog: false`** (far
  curtains, dapple, motes) — the canyon's and `DistantReef`'s own contract:
  `FogExp2` has closed by those radii, so the tint does the fog's job
  (`FogInk` re-derives inks from `scene.fog`). All other surfaces are toon.
- **Mangrove roots carry no colliders** — scenery-only, flagged per the
  stub. If swim-through blocking is wanted later it's a one-line join, but
  it would change the corridor's feel and belongs to a gameplay pass.
- **Hero arch + drums cast shadows** (substantial monuments, reef-arch
  precedent); all smallwork casts nothing.
- **For the serpent/giant workers**: r 38–48 mid-water has nothing of mine
  but water; my spire tops out at y ≈ −6.4 at (r 47.6, lateral −4.2) and
  the curtains stand at r ≥ 48.4 below y ≈ −1.4 — the patrol band is clear.
- **Kirin worker**: the meadow clearing r 38–44, |lateral| < 2.6, is kept
  by test; monuments nearest the meadow edge stand at |lateral| ≈ 4.0–4.7.
