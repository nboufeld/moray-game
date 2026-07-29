# pale-passage-1 — THE BONE MEADOWS

Region worker ledger. Slot `pale-passage-1`, province "The Pale Passage",
gateway wing `ghost-reef` (azimuth 3.87), disc centre r = 445, radius 220,
seed `SEEDS.regionPale1`.

## Concept

The Ghost Reef wing told the sorrow in one room; this region tells the
whole story. A vast bleached ossuary coming back to life, and the diver
swims the direction the life is returning: out of the wing's opened end
wall into a chalk ravine, into a white world of dead coral — bone
forests, monument boulder-corals on white sand, milky hushed water —
and then, band by band across the disc, colour returns. Pink and gold
buds freckle the white at the First Blush; young gardens stand at full
colour on the Blooming Shelf; and at the far heart, the Seed Grove, one
colossal living Mother-Coral stands over planted rows of juveniles.

The recovery is SPATIAL and one number: `recovery(u, v)` in
`PaleTerrain.ts` runs 0 at the gateway side to 1 at the Seed Grove
(held low over the Quiet Gallery on purpose — its austerity is
authored). Ground paint, flora tints, life density, water colour and
the tests all read this single gradient. A petal current is born at the
mother's crown and drifts back toward the white side — hope flowing
backward along the diver's own path.

## Sub-biome map (spoke coordinates: u along azimuth 3.87, v lateral CCW)

- **The Chalk Ravine** — u 48 → 292 along the approach tongue. Stacked
  pale plate walls (two benches in the silhouette), floor −4.2 at the
  wing seam, deepening to ≈ −7 through the hush, cresting a +2 saddle
  lip at u ≈ 266 (the reveal), falling into the Bone Forest.
- **The Bone Forest** — basin at (355, −16), r 96. Dead staghorn/branch
  thickets (three instanced archetypes), floor −2 to −4, hummocked.
- **The Quiet Gallery** — pan at (385, 78), r 58. A raised white table
  (+1.2, nearly flat) where the monument corals stand alone in an
  avenue. Recovery is suppressed here by hand (×0.15).
- **The First Blush** — the band u ≈ 400–500. The ground stays pale;
  the blush is paint and buds (pink/gold polyps on the ground, climbing
  two skeletons, crowding the Blush Arch's crown).
- **The Blooming Shelf** — basin at (525, −48), r 85, settling to
  ≈ −9.5. Young coral gardens at full colour, the blush darter shoal.
- **The Seed Grove** — bowl at (558, 38), r 44, sinking to −19.5 with a
  soft rim lip. The Mother-Coral and the double nursery hedges.

Vertical range: grove floor −19.5 to ravine/monument crowns and the
24 m disc ceiling — well past the 20 m bar (mother's crown alone stands
12.5 m off a −19.5 floor).

### The domain, and how it is sealed

Weight is the max of the slot disc and two approach tongues (seam
tongue 8.0 m half-width at the wing end — clear of both neighbouring
wings' wedges — widening to 34; a second tongue from r = 62 carrying
the ravine's width). Authored ground fades to dune level across the
rim feather gated on u as well as rc, so the ravine never fades. The
ceiling closes to 3.4 m at the rim; ravine-side seals and the rim ring
close the world floor-to-ceiling (asserted channel-relative in tests).

## Landmarks (reveals every 30–60 m along the spine)

1. **The Ravine Gate** — chalk jambs at the wing seam (u ≈ 52).
2. **The Chalk Stairs** — stacked plate ledges stepping the ravine's
   climb (u ≈ 210–255), three lone dead trees between them.
3. **The Saddle Lip** — the +2 crest at u = 266; the whole white disc
   revealed at once.
4. **The Bone Cathedral** — the grand dead tree at (352, −34), grown at
   4-deep recursion with real girth; the forest's tallest silhouette.
5. **The Quiet Gallery avenue** — five monument boulder-corals on the
   white pan (385, 78), a milk light-column over them.
6. **The Blush Arch** — a bleached arch at (456, −7), its crown crowded
   with the first pink/gold buds; the doorway from white into colour.
7. **The Gardener's Round** — the hermit-crab colossus walking its slow
   circle at (492, 26), coral garden on its shell (DiscoveryTarget).
8. **The Blooming Shelf gardens** — authored beds at (518, −48) /
   (532, −62) / (545, −45) framing the shelf pose; the shoal above.
9. **The Mother-Coral** — the region's landmark at (558, 38): 12.5 m
   rose-and-gold pagoda of tiered living plates with an antler crown,
   the one thing in the province that was never bleached.
10. **The nursery hedges** — six double rows of seafoam/gold juveniles
    radiating down the grove bowl — the Gardener's work.
11. **The petal current** — born at the mother's crown, drifting toward
    the white side; the region's moving centrepiece.

## Life (the density gradient IS the story)

- **Milk dust motes** — densest in the white half; the water itself.
- **Blush darters** — a 62-strong shoal that lives only in the coloured
  half (Blooming Shelf ellipse), rose-gold above the milk's value.
- **The petal current** — slow warm drift of petals/spawn from the
  mother's crown back along the diver's path.
- **Floor stars** — small benthic stars thickening with recovery.
- **The Gardener** — findable resident, codex entry `Coenobita
  hortulanus` ("It carries the reef's tomorrow on its back, and plants
  it one sprig at a time."), deterministic daily circle, procedurally
  painted shell garden, DiscoveryTarget at its round's centre.

## Budgets (measured programmatically; tests/regionPale1.test.ts holds the caps)

- Draw calls: **59** (cap 120)
- Triangles: **233,235** (cap 250,000)
- Colliders: **321** (floor 100 asserted; all inside the domain)
- Everything repeated is instanced: bone-tree archetypes, garden corals
  (one InstancedMesh per kind), buds, floor stars, silhouette cards,
  distance rings' segments merged.

## Seeds

`SEEDS.regionPale1` with `^` substreams only. Notable streams: terrain
`^0x4e22/^0x0f1e/^0x9a11/^0xb10a/^0x9d07`, ground paint
`^0x517b/^0x5eaf/^0x70af/^0xb1d5`, bones `^0x0a11–^0x0a15`, cathedral
`^0x0bca`, monuments `^0x0ba1–^0x0ba3`, ravine dressing
`^0x0c11/^0x0d01/^0x0d02/^0x50c8/^0xc4a7/^0xc4a8`, bloom
`^0x0ec1–^0x0ec4`, mother paint `^0x30a7`, gardener `^0x0ee7`, life
`^0x40d5/^0x57a9/^0x5a11/^0x9e7a/^0x9e7b`, light `^0x11f9/^0x90f3`.
Runtime updates spend no randomness (the pilot's rule, kept).

## Critique history (silhouette → value → colour → detail, per round)

### Round 1 — bones right, scale wrong

First buildable draft. Silhouettes stood but the wing's one-metre
garden pieces vanished in a 150,000 m² basin; the cathedral read as one
more thicket; the mother's near-circular plates read as parasols; buds
scattered in a loose box read as floating confetti; pale bloom mixes
washed to grey under the milk. Fix: colony scale 2–3 m, cathedral
regrown deeper with girth, plates lobed hard, buds hugged to the arch's
curve, bloom families given real chroma.

### Round 2 — the whites become colours

Warm milk fog; real chalk whites via a custom chalk texture +
`createToonMaterial` (createRockMaterial's granite mean was killing the
paper-white); monuments into an avenue; ground still beige — the
sand-wash texture's warm mean dominated any multiplier paint. Also
found: saturated tubes rendered as maroon — a colony whose tint dips
under the milk's own value reads as its complement.

### Round 3 — absolute paint over the wash mean

`bakePalePaint` refactored to compose story colours absolutely in
linear space and divide by the wash's linear mean — the ground finally
chalk. Bloom tints value-floored; the mother given her emissive.
Streamer QA pin fixed the far-slot capture detachment (framework
`RegionStreamer.force()` pins until first arrival — sanctioned, see
Flags).

### Round 4 — grief lit flat

The sun itself was the last warmth: sun cut for the milk, hemisphere
and ambient shifted violet, fog densityGain 0.009. Ground measured at
paper values. Beds still rendered ~35% below the milk band's value —
pastel-chromatic bloom families and emissive gardens brought them up.

### Round 5 — above the water's value

recoveryTint value range lifted to 1.16–1.38; mother emissive up;
darters rose-gold, bigger, 62-strong; distance rings re-radiused to
hide the ground trim edge; gallery milk-column narrowed. Remaining:
brain mounds still maroon livers, mother grey-beige at the grove
pose's 25 m of milk, nursery rows invisible.

### Round 6 — the mother's lit side

Brain mounds tinted at half chroma + extra value (their skin map is the
darkest of the kinds); plate rose extended to the growing margins — at
25 m the margins are all the eye gets, so the margins must carry rose;
nursery rebuilt as paired double hedges (a single file of seats never
read as a *row* through the milk) in seafoam/gold complements against
the rose bowl; grove pose moved to the mother's lit side after probing
the row's far end (her shadow side) and a raised rim (the milk ate
her). Final frame: rose pagoda, gold crown, light pool, hedge sprigs
leading in.

## The no-assets build

No GLBs are used by this region — every mesh is procedural (bone trees,
chalk architecture, coral instancing, the mother, the Gardener). The
`-noassets` capture set is therefore identical in content and captured
under `bone-final-noassets` for the canonical contract.

## Capture sets

12 poses authored in the def: `ravine-descent`, `chalk-stairs`,
`lip-reveal`, `bone-forest`, `bone-cathedral`, `quiet-gallery`,
`blush-arch`, `gardener`, `blooming-shelf`, `seed-grove`,
`mother-crown`, `white-lookback`. Final sets under
`visual-qa/*_REGION-pale-passage-1-*_bone-final.png` and
`*_bone-final-noassets.png`.

## Flags

- **Framework touch (sanctioned workaround):** `RegionStreamer.force()`
  now pins the forced entry until the diver first arrives inside the
  build margin (`pinned` flag). Without it the QA door's own contract
  fails for far-side slots: three of this region's depth-1 slots sit
  outside the detach radius from the bowl spawn, and the region
  unloaded between `force()` and the capture teleport. Gameplay never
  sets the flag; the pilot's slot sat inside the radius and never saw
  it. Orchestrator should review on merge.
- The pre-existing `CoralField.ts` emissive shader patch throws a GLSL
  error in some probe contexts (`totalEmissiveRadiance *= vColor` with
  vec4 vColor) — an existing framework issue, not introduced here.
- Triangle budget sits at 93% of cap; any future additions should come
  out of the distance cards, not the gardens.
