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

Pilot-final numbers; the Phase 3 rework section below carries the fill
budgets (caps honestly raised to the doctrine's 160 / 450k there).

- Draw calls: **59** (cap 120 at pilot close)
- Triangles: **233,235** (cap 250,000 at pilot close)
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

# PHASE 3 REWORK — the fill (`rework/pale-passage-1`, plan `docs/fill-plans/pale-passage-1.md`)

Executed under FILL-DOCTRINE + MASTER (§1.2 registry inviolable: the
Quiet Gallery pan, the Ravine Hush u 130–210, the Mother's Pool; R6
false spring authored region-side; R8 exclusives through kit doors; the
orchestrator field note F-R3 on rim-facing flank bands). Every fill
stream is `SEEDS.regionPale1 ^` a fresh `FILL_SEEDS.*` constant
(`PaleFillShared.ts`), appended after all pilot draws — the reroll
fence, proven by test pins on the first/last instances of all three
bone-tree archetypes, the first monument and the Gardener target (exact
pre-fill coordinates, the target to 9 decimal places).

## What landed (by checklist item)

1. **Budgets** — test caps raised to the doctrine's 160 draws / 450k
   tris; floors raised to 85 / 380k. Measured at round 3: **99 draws /
   448,083 triangles** (pilot was 59 / 233,235).
2. **`PaleCarpet.ts` (NEW — the T1/T2 kit consumer)** — the fill voice
   is BONE GRAVEL, NOT CLUTTER: ravine channel gravel (1,400, two bone
   tones, dead through the hush), stairs shard drifts (560, reveal
   cadence ~26 m → ~13 m), the descent fan (320, raked from the lip),
   the false-spring trace (170 blush-tinted, dying by u 68 — R6,
   authored so the gradient reads before connective-2 lands), the
   disc-wide bone grit floor (3,000), THE OSSUARY CARPET (2,950
   vertebra knuckles + branch fragments — the signature exclusive,
   custom 8-tri shapes through kit `groundLitter` per R8, dense at
   every tree's foot and under the cathedral crown), bone stumps (640,
   region-instanced standing layer, rim-leaned per F-R3), ravine
   bank-top shards (760, round 3), blush gravel (2,100), petal-fall
   (950, round 3), shelf turf (1,700) + grove rim turf (1,200, kit
   `carpetField`), bed-foot rubble (240), and kit `screeApron` fans at
   every stairs slab, jamb, ledge, arch leg and the cathedral.
3. **`PaleBones.ts`** — monument furrows deepened (cut 0.14, ridge
   paint 0.66–1.12); three strata-ledge stacks (u 96 / 200 / 232) as
   wall architecture; the Quiet Gallery's sanctioned threshold-plate
   path; garland cords on the arch and both blush skeletons; scree
   anchors exported for the carpet's aprons.
4. **`PaleBloom.ts`** — shelf sites 30 → 55 with ≥2 fans per authored
   bed (asserted), the pioneer bed at u 508, the Gardener's sprig
   trail, nursery 10 → 16 seats in paired double hedges + rim-gate
   hedges, and the mother's plates rebuilt as LATHE geometry with a
   ripple corrugation and radial growth rings that her emissive now
   wears (vertex paint multiplied into `totalEmissiveRadiance`).
5. **`PaleLife.ts`** — the hush-fry shoal (40, kit `shoalRunner`,
   bone-pale and deliberately near-colourless, walking the road u ≥
   212), porcelain brittle-stars (kit `percherColony`, two tints:
   white on trunks, rose on beds), THE PETAL CURRENT MADE REAL (12
   flecks → 300 petals + 420-point stream, arch and rim eddies, the
   darter escort splitting to circle the Gardener), blush + nursery
   midges, ravine + gallery dust columns, stars 26 → 50.
6. **`PaleLight.ts`** — the stairs god-ray pair, the arch blade
   widened, the blush skeletons' blades, the gallery pool, nursery
   micro-pools. NO dappleSheet (MASTER upheld the paper-light).
7. **`PaleGround.ts`** — near-field chalk keyed UP where recovery
   < 0.15, freckles redrawn at two separated scales, gallery white
   pulled to 0xfbf8f1, ravine walls leaning cool-white as they rise,
   the false-spring paint trace under the gravel of the same name.
8. **Poses** — 12 → 14 (`ravine-hush`, `ossuary-floor` added).

## Deviations, cited

- **The hush-fry vs the road** (plan §5 walked it "the length of the
  road"): the registry holds the hush at motes only — the route's
  stations start at u 212 and the test asserts it.
- **Monument scree** (plan §3 aproned every monument): the Quiet
  Gallery pan is registry stillness — the monuments keep bare feet;
  the sanctioned threshold plates carry the approach instead.
- **The u-200 ledge** stands inside the hush window: its apron fans
  AWAY from the channel at reduced spread; the lane below stays bare
  (asserted: nothing lies within `channelHalf + 0.5` through u
  130–210).
- **Budget trims** (the plan's roll-up under-counted): staghorn weight
  0.10 → 0.03 and brain 0.08 → 0.04 across rounds (fans and branches
  take the weight — bed density untouched), ossuary 3,200 → 2,950,
  shelf turf 2,000 → 1,700, grit 3,300 → 3,000, ravine gravel 1,500 →
  1,400, drifts 620 → 560, bed rubble 280 → 240.

## Rework round 1 (`pa-fill-r1`) — 59/233k → 95/442,893

Captured 11/14 authored (the shots script crashed at pose 12; the
missing three were read in r2's full set) and 10/12 sweep frames (the
sweep timed out on the last two). READ against the bone-final befores.
What worked at once: the ravine's gravel voice, the shard drifts'
cadence, the petal current visible from the white side, the shelf's
lushness against the white half. What failed, silhouette → value:

- **The camouflage failure (the round's lesson):** bone chips painted
  bone-on-bone VANISH under the milk's flat light — the grit and
  ossuary carpets were THERE (counts asserted) and invisible at pose
  distance. Verdant's round-7 lesson arrived here a round late.
- The strata ledges hovered off their banks ("flying saucers").
- The mother's growth rings: keyed off displaced y — nothing
  qualified; her emissive flattened the plates flat magenta.
- Sweep 02/03 (rim-facing): NOTHING standing in the first 35 m.

## Rework round 2 (`pa-fill-r2`) — the camouflage round; sweep 8/12

Grit/ossuary second tone taken to genuine violet-bone (half the run
now draws against the paper), chips grown a size, stumps 360 → 520
and rim-leaned, ossuary root-boost up, ledges sunk 0.35 into the bank,
ravine walls leaning cool-white, blush gravel 1,500 → 1,800, mother's
rings keyed off vertex normals + emissive wearing paint. Full 14
authored + 12 sweep captured and READ.

- Authored: 12 of 14 read as composed places. `mother-crown` still
  flat magenta from below (the cylinder cap holds vertices only at
  centre and rim — the ring paint had nothing to live on: r3 rebuilds
  the plate as a lathe). `chalk-stairs`: the u-96 stack's top plate
  still breaks the bank silhouette against the milk band.
- Sweep: **8/12** (05/06/07/08/10/11 clean; 01/12 soft passes on the
  stump line and litter margins). The four misses, traced by pose
  coordinates (`pale-sweep-where` helper): **02** u 250 v −19 — the
  ravine's high bank, where every family hugged the channel and the
  grit floor started at u 292; **03** u 357 v 174 — the white disc's
  far flank, grit too thin at half domain weight; **04** u 497
  v −159 — OUTSIDE the blush corridor's 170 m width, pink paint with
  not one stone; **09** u 556 k 1.0 — past every band's fade. None
  are registered rests. All four are GATE HOLES, not density tuning
  — the round-3 thesis.

## Rework round 3 (`pa-fill-r3`) — the sweep walks the banks

The four holes closed at the gate level: ravine bank-top shards (760,
u 62–292, only ever `channelHalf + 7` beyond the lane — the hush law
holds by construction) with stumps allowed onto the banks (never the
lane); the blush corridor widened 170 → 340 with a fifth station and
the band fade pushed k 0.9 → ~0.96; petal-fall litter (950) for the
deep-recovery flanks — the grove sheds. Paid by the staghorn/brain
weight cut, ossuary and shelf-turf trims (bed density untouched,
asserted). Ledge stacks sink 0.55 with shorter climb steps; the
mother's plates go lathe + ripple corrugation. Measured **99 draws /
448,083 tris**; 27/27 region tests green.

Full 14 authored + 12 sweep captured and READ.

- Authored: all 14 read as composed places. The lathe plates finally
  wear their rings (`mother-crown` a firm pass from below now), the
  u-96 ledge stack sits inside the bank silhouette, `blush-arch` gets
  its petal eddies, and the two rests (`quiet-gallery`, `ravine-hush`)
  hold their registered stillness.
- Sweep: **9/12** — 05/07/08/10/11 clean, 01/02/06 soft passes on the
  bank shards and stump line. Pose 12's frame is INVALID — it landed
  after the r4 edits began and the dev server's hot-reload broke the
  camera teleport mid-capture (the PNG shows the world spawn, not the
  bone forest at u 358). Not scored; the final sweep re-captures the
  identical pose. Counting 12 as unknown the round stands at 9 of 11
  readable frames, misses 03/04/09 — none registered rests. Still missing: **03** u 357 v 174,
  **04** u 497 v −159, **09** u 556 k 1.0. The r3 thesis (gate holes)
  was only half right: the gates now COVER those flanks, but what they
  deliver is ankle-height chips — 950 petals over a radius-130 disc is
  one chip per 56 m², and a 0.06 m chip is gone past arm's reach at
  eye height. The white half already knew the answer: something must
  STAND in the first 35 m (MASTER's field-note flank bands). The
  coloured half has no standing layer at all outside the beds.
- Also traced: sweep 03's stump starvation is arithmetic, not gating —
  `keep` multiplies by `paleWeight` (0.5 at the disc's far edge) on top
  of the flank thinness; the edge poses were taxed twice.

## Rework round 4 (`pa-fill-r4`) — the flanks get a standing layer

The three misses share one shape: an outward pose over ground that
holds only litter. Round 4 gives each half its knee-height answer:

- **Pioneer sprigs** (NEW, `^ 0xfa0e`): kit carpetField tufts,
  0.3–0.55 m, rose-gold painted for the region's warm light with a
  violet shade (the verdant round-3 lesson), radius-175 disc reaching
  both far flanks, gated `k > 0.42`, thinner where the shelf's own
  turf speaks, `t1Free` keeps the pool/aisle law.
- **Stumps 640 → 900**, `paleWeight` → `sqrt(paleWeight)` (un-taxing
  the disc edge), and a `|v|`-flank lean joined to the radial one.
- **Petal-fall grown**: 950 → 1,100 and 0.06–0.15 → 0.10–0.22 m.
- Paid honestly: staghorn weight 0.03 → 0.015, brain 0.04 → 0.02
  (fans take the freed weight — 9 staghorns and 8 brains remain, all
  authored-bed anchors), grit 3,000 → 2,400, ossuary 2,950 → 2,800,
  blush gravel 2,100 → 2,000, shelf turf 1,700 → 1,500, grove turf
  1,200 → 1,100. Bed density and site counts untouched.

Measured **100 draws / 449,597 tris**; 27/27 region tests green
(carpet determinism now pins three carpet fields).

Captured as the first `pa-filled` candidate set (14 authored + 14
noassets + 12 sweep), all READ.

- Authored: all 14 composed; the sprigs carry `gardener`,
  `blooming-shelf`, `seed-grove` and `white-lookback` visibly; the two
  rests hold; noassets set identical in composition (the region is
  fully procedural).
- Sweep: **11/12** — 05/07/08/09/10/11/12 clean (09, the k = 1.0
  flank, is TRANSFORMED by the sprigs), 01/02/03/06 soft passes on the
  stump/shard lines. The last miss: **04** (u 497, v −159, k 0.72) —
  traced with a probe: the pose stands 198 m from the sprig disc's
  centre and 198 m from the petal disc's — both gates HOT, both areas
  short. The deep-recovery band is a crescent; one disc cannot hold it.
- The standard demands misses land only in registered rests, and no
  drawn pose stands in a rest — so 04 must pass. One more round.

## Rework round 5 (`pa-filled`) — the south flank

One targeted move: a dedicated south-flank sprig patch (same palette,
profile and gate as the round-4 field, own stream `^ 0xfa0f`, disc
r 78 at the crescent's south end) so sweep 04's first 35 m gets its
standing layer. Funded by grit 2,400 → 2,050 and petal-fall
1,100 → 1,050. Full final sets re-captured on this build.

Measured **101 draws / 449,997 tris** (fill program caps ≤160 / ≤450k;
pilot baseline was 59 / 233,235). Gates: typecheck clean, eslint
0 warnings, region+kit vitest targets green, full `npm test` 714/714
green. Carpet determinism pins four carpet fields.

Final sweep, re-captured on this build, all twelve READ: **12/12**
pass the three-layer law.

- **04** — the round-4 miss — now stands in the south-flank sprigs:
  rose-gold tufts through the first 35 m over petal-fall chips and the
  violet ground wash. The crescent's south end is covered.
- **09** keeps its round-4 transformation after the petal-fall trim
  (1,100 → 1,050): colour washes + standing sprigs near, ridge forms
  mid, bone-forest silhouettes far.
- **12** is finally a valid frame (round 3's was hot-reload-corrupted):
  stumps and ossuary litter near, bone trees mid, gallery silhouettes
  far, petals drifting at frame right.
- **01/03/06** remain soft passes on the stump/shard lines — re-read
  after the grit trim (2,400 → 2,050), they hold: stumps stand in the
  first 35 m, freckles and grit keep the floor from reading bare.
- No misses. Neither registered rest (Quiet Gallery pan, Ravine Hush)
  was drawn by this sweep's poses, so no rest-excused frames needed.

Authored (14) and noassets (14) sets re-captured on this build and all
READ. The grit trim reads honest in `ravine-descent` / `chalk-stairs` /
`ossuary-floor` — the shard drifts, ossuary carpet and stumps carry the
near fields unchanged. The two rests hold their stillness: the Quiet
Gallery pan shows monuments, threshold plates and freckles only; the
Ravine Hush channel floor is bare wall-to-wall with the hush-fry
holding past u 212. The noassets set is compositionally identical to
the authored set (the fill is fully procedural — only the Gardener's
GLB shell reverts to a plain dome).

Final capture roster (visual-qa/, newest per pose is canonical):

- Authored `pa-filled`: `20260731-0657_*`, all 14 poses
  (the `0258` set is the round-4 build, retained for history).
- Sweep `pa-filled`: `20260731-0610_SWEEP-pale-passage-1-01..12`
  (the `0449` sweep set is the round-4 build, retained for history).
- Noassets `pa-filled-noassets`: `20260731-0747_*`, all 14 poses
  (the `0356` set is the round-4 build, retained for history).
