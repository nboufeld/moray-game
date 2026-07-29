# sunken-calamity-1 — THE SUNKEN CALAMITY

Slot `sunken-calamity-1`, the sixteenth slot, gateway `ruins-terrace`
(azimuth 4.59). Disc centre ≈ (−82.3, −694.8), radius 220; approach
tongues r 44/62 → 540 — the longest approach in the game, a 490 m march.
Seed `SEEDS.regionCalamity` (0x5a4d_0c11) and `^` substreams only.

## The invented catastrophe

The country past the Ruins Terrace was the terrace-builders' own: a paved
garden-country of shrines, causeways and tended kelp meadows, where the
old sea kept a held breath — a buried pocket of cold gas asleep under the
pavement for ten thousand years. One still autumn night, the sea exhaled.

The pavement rose as one slab and fell as ten thousand stones. The blast
laid the kelp sea down pointing away from the wound like the hands of a
clock. The water turned to ash-milk for a season, and everything that
breathed it stopped. The country sank a body's height and never rose
again. That was thirty years ago — one generation of the sea: long enough
for the place to become a legend the wings tell, not long enough for
anything to have healed.

What the sea is doing about it is the region's pulse: the crater still
breathes cold silver (a methane seep — *something still burning cold*);
around its breath, life has come back *wrong* — bone-pale tube worms
crowned arterial red, white chemosynthetic felt, rust shoulders — and in
a hollow the thrown ridge defended, one grove of the old kelp sea never
died. An Ashkeeper octopus keeps the drowned country's small bright
things in a shrine at the grove's edge, and tends it every day.

## Sub-biome map (spoke coordinates: u along azimuth 4.59, v lateral CCW)

| Sub-biome | Where | Floor |
|---|---|---|
| The Long Sorrow (approach) | u 48→530 along the tongue, channel wanders ±14 | −6.6 → −8.6 → crest +2.2 at the Wound Gate (u≈470) → −5.8 |
| The Shatterfield | ellipse (532, 0) ru 66 rv 92 | −5.0 ridged benches ±3.4 |
| The Ghost Forest | ellipse (626, −4) ru 78 rv 96 | −8.2, ash drifts ±1.3 |
| The Wound | (700, 0) r 58 | terraced bowls to −30, +1.3 thrown lip |
| The Seep Gardens | (752, +58) r 46 | −11 ± 0.9 mounds |
| The Grove Ridge | ellipse (742, −48) ru 40 rv 22 | +6.5 ejecta dike |
| The Last Grove | (774, −86) r 42 | −13.4 hollow |
| The Quiet Rim | u > 820 to the rim | −3.0 shelf, fading to dune by rc 210 |

Vertical range across the disc ≈ 36 m (ridge +6.5 → Wound −30; the test
holds ≥ 20 and lowest ≤ −24). Ceiling: 11 m at the seam (meeting the
terrace's vault), 8.5 through the Suffocated Mile, a 7.6 pinch over the
Wound Gate so the light narrows before the reveal, 26 over the crater
country, 28 over the Wound itself (the plume and gyre are a swim), 18 on
the Quiet Rim, closing to 3.4 at the disc's rim so one collider ring
seals the world's edge floor-to-ceiling.

### The domain, and how it is sealed

Weight is max-combined from `slotDisc` plus **two** `approachTongue`s: a
seam tongue (halfWidth 8.2 → 30) that clears the Current Run (4.23) and
Mangrove Roots (4.95) wedges — both reach 0.195 rad of the spoke at
r = 44, the same map the pilot proved — and a wide tongue starting at
r = 62 carrying the broken banks (18 → 38). The collision handover
teleports a diver who reaches weight = 0, so the open edges are walled:
a 94-sphere rim ring at rc 206 (gated only over the channel's own width),
double rows down the march (inner at bank crest, outer at the tongue
edge, overlapping by construction), and three-sphere stacks at the 8.2 m
doorway.

## Landmarks

1. **The Fallen Processional** — three column drums of the terrace
   country lying in the march's mouth (u 62–88): the first omen.
2. **The First Dead One** — a single grey kelp giant standing in
   still-half-gold water (u 168): the annunciation.
3. **The Shock Rings** — the blast's frozen ripples standing in the sand
   in concentric value bands centred on the crater (u 200–320).
4. **The Card House** — five pavement slabs fallen against each other
   with swim-under shadows (u 315–345).
5. **The Ghost Traps** — fourteen broken amphorae in the Suffocated
   Mile's violet pool (u 352–440).
6. **The Wound Gate** — two thrown monoliths leaning into a rough arch
   over the channel at the crest (u 466): the pinch before the reveal.
7. **The Shatterfield Causeway** — twelve great slabs in a jumbled
   procession into the crater country (u 498–570).
8. **The Great Slab** — fourteen metres of pavement standing on edge at
   the Ghost Forest's eaves (u 585): the reveal's horizon mark.
9. **The Ghost Forest** — fifty-eight blast-raked dead giants, 22 snapped
   stumps, six fallen trunks, all pointing away from the Wound (u 548–712).
10. **The Wound and the Cold Candle** — the terraced crater and its 8.4 m
    seep chimney, breathing a 18 m bubble plume with three lesser throats.
11. **The Seep Gardens** — five lesser seeps, ~150 tube worms, 26 white
    mats, white crabs: life that came back wrong (u 742–770, v +50..70).
12. **The Last Grove** — eight living plants and their young behind the
    sheltering ridge, greener than anything in the province (u 774, −86).
13. **The Curator's Shrine** — forty gleaming small things heaped against
    a low stone, and the Ashkeeper octopus tending them (u 771, −82).
14. **The Quiet Rim pair** — two leaning stacks framing the painted
    distance (u 876/882).

Plus the fog-rhythm dressing: twelve bank teeth alternating down the
march, eight thrown stones pointing away from the Wound, two crater-lip
watchers — something breaches the fog every ~30–40 m of the 490 m
approach.

## Life

Ash snow (700 motes falling region-wide, march included) + 180 silt
darts low over the ash; the pallid shoal (50 silver-ash survivors
travelling the Ghost Forest's aisle); **the crater gyre** (64 bone-silver
fish riding the Cold Candle's updraft in a toroidal wheel — up the plume
in a tight helix, spilling off the top, gliding down the wide outside —
the moving centrepiece); 26 bone/ash-violet stars, 16 ghost urchins, 18
white crabs at the seeps; and **the Curator** — the findable resident
(`ashkeeper-octopus`), a live-posed mantle-and-eight-arms build breathing
over its shrine, codex entry in the def's pure half, discovery target at
its head.

## Budgets (measured programmatically; tests/regionCalamity1.test.ts holds the caps)

**78 draw calls, 210,609 triangles, 514 colliders** at close (fallback
build measured — the sculpted Gardener swaps 604 GLB triangles for the
stand-in's ~700 when it arrives, a wash). Ground: 4 disc tiles (231 m,
104 segs ≈ 2.2 m/vertex, trimmed to rc ≤ 240) + 2 march sheets
(≈ 2.5 m/vertex, trimmed to the tongue band, overlapping each other and
the disc tiles and sunk 4 cm — the pilot's round-2 seam fix). Kelp is
merged area chunks for frustum culling; everything repeated is instanced
(teeth, amphorae, worms, mats, stars, urchins, crabs, fish, distance
cards).

**Deviation flagged:** the mandate's ~1.2 m/vertex ground pitch would
alone cost ~210k triangles over this disc; 2.2–2.5 m/vertex is the trade
that keeps the whole region ≤ 250k (the pilot's own trade). Authored
terrain wavelengths are ≥ 8 m (the march's jag field is ≥ 22 m), so the
coarser grid samples them cleanly. Also flagged: build() runs
synchronously in the streamer's attach (~2.1 s of geometry and paint
bakes on this machine) — a hitch on first approach; the pilot's
precedent, a candidate for amortised builds later.

## Seeds

`SEEDS.regionCalamity` (0x5a4d_0c11) with `^` substreams: terrain fbm
(0xd1a1, 0x4e11, 0x5ca7, 0xa54, 0x9e2d, 0xfa11, 0x9d01, 0xba9e, 0x5117,
0x5ade, 0x7a11, 0x7b57), rubble 0x50c7 (+0x0a.., 0x0b.., 0x0e.., 0x0f..
shape seeds), forest 0x1e0f / leaves 0x51ab, seeps 0x5eed (+0xca.., 0xcb..
throats), life 0xa51e/0xdad7/0x5a01/0x69fe/0x57a5/0x0bc1/0x0bc2/0xc4ab/
0xc4a5, curator 0xc1a7/0xc1a8, light 0x11f7/0x90f1, distance 0xd157/
0xd200+. Update spends no randomness, so captures settle deterministically.

## Critique history (silhouette → value → colour → detail, per round)

### Round 0 (`calamity-r0`) — the empty canvas

Ground-only draft to prove the harness: geography composed (the reveal's
descent, the crater's terraces read), but the water measured *too milky*
— densityGain 0.006 closes the vistas to ~40 m where the pilot breathed
to 70. Three test-caught terrain faults fixed before round 1: the crater
bowl was inverted (deepest point read −18.5, not −30), the gate banks
could crest through the pinch ceiling, and the seal test's spine window
ignored the channel's wander.

### Round 1 (`calamity-r1`) — bones right, subjects buried

Silhouette: the geography composes everywhere — the march reads as a
road, the Card House jumbles, the crater's terraces descend, the grove
is *there*. But the Ghost Forest's blast rake (0.16–0.34 rad) reads as
ordinary straight poles — the clock-hand signature was authored too
politely — and the reveal pose stood behind the crest instead of on it,
so the region's one big breath opened onto a bank. Value: the frame's
verdict was unanimous — the water is near-white milk (densityGain 0.006
+ colorScale 0.72/0.79/0.84) and *every* authored subject reads near-black
against it: teeth, stones, dead giants, worms, the shrine, the Curator
itself. The canyon's ghost-kelp note in AGENTS.md had already written
this failure down: an unlit toon surface under a strong mood renders the
pale palette as near-black quills; the cure is a faint emissive floor.
Colour: the "dead sand" still read as beach (the sand wash is strongly
warm; 0.74 red is a tint, not a cut — the pilot's round-2 lesson); the
grove's green ends in a hard circle; no arterial red survives at the
gardens. Detail: the bubble plume is nearly invisible (a few dots); the
gyre unread; the chimney a pale nub from the rim; shock rings faint
(0.09 amplitude); the First Dead One a dark post, not a pale ghost.

Round 2's surgery: fog to grey-teal (0.66/0.75/0.82, gain 0.0035) so
pale subjects ghost *against* the water; emissive floors on the dead
forest, stones (via tint lift), worms, crabs, chimney, gleams and the
Curator; the rake committed (0.34–0.58 rad, 70 thicker taller giants);
reveal/cold-candle/seep-gardens/shrine poses moved onto their subjects;
plume ×1.6 and brighter; ground red cut to 0.62; shock rings 0.14.

### Round 2 (`calamity-r2`) — the ghosts arrive, the floor stays warm

Silhouette: the reveal now *reveals* — crest, causeway slabs, ghost
ranks at the fog's edge. The dead read as a forest (pale, many, leaning)
but as *poles*: 3–6 sparse stub straps carry no canopy skeleton, and a
dead kelp keeps its canopy's bones. Card House slabs lean properly now;
the chimney reads from the rim. Value: the emissive floors landed — the
First Dead One ghosts, the suffocated mile's violet pool reads, the
Wound's terraces descend in violet. Two holdouts: the shrine's mound
stone and the gardens' small life still cut out dark. Colour: the
near-field sand still reads beach-warm everywhere (the wash is stronger
than 0.62 red — the pilot paid three rounds for this lesson before me);
the grove's plants read as dark-green scrub, not a lit grove; the
gardens still spend no red (worms too small, crowns too small, mats
invisible). Detail: plume improved but still dots, not a column; gleams
sparse on a dark stone; amphora at 1.35 scale read bird-like; the Quiet
Rim's broken skyline rings work, the cards faint.

Round 3's surgery: ground red to 0.52; canopy skeletons (5–9 straps down
the upper half + crown-skeleton rings of 4–6 long straps); shrine stone,
gleams (×70, tighter, brighter) and Curator take their own emissive
floors; grove clumped (two clusters) with brighter straps and emissive
0.65; worms 1.2–2.8 with denser rings; mats 2.2–5 m with emissive;
plume to 300; distance ink deepened.

### Round 3 (`calamity-r3`) — the look lands

Silhouette: the Ghost Forest *is* a dead forest now — canopy skeletons
down the whole upper half of every giant, crown-skeleton rings, the
radial rake reading left and right of the aisle; the Wound Gate arch
reads; the watcher repoussoir lands the crater frame. Value: the ground
went cool (red 0.52 — ash, not beach) and the whole region's value key
snapped into place: pale subjects ghosting on grey-teal water, violet
pool in the mile, violet terraces in the Wound. Colour: the shrine is
the frame the region was written for — the mound glows pale-warm, the
gleams pile shines, the Curator's lilac sits on top of her treasure with
the green grove behind. The gardens still spend no red: the worm crowns
were too small to read. Detail: the plume finally reads as a *column*
from the cold-candle pose; gleams heap properly; amphorae pot-sized;
Quiet Rim's broken skyline reads at the horizon.

Round 4 (surgical): worm crowns → bright fountains (0.3 r, pushed past
1.0 red); a 17 m survivor at the grove's heart; the Curator lifted onto
her pile (0.62 → 0.78); gardens pose down into the field.

### Round 4 (`calamity-r4`) — every pose passes its read

The surgical round landed all of it. Silhouette: the worm crowns are
fountains now, red-tipped and clustered at the mounds; the 17 m survivor
stands over the grove's clumps. Value: the gardens finally *spend* the
red (crowns pushed past 1.0 read at thirty metres); the Curator sits ON
her pile instead of inside it. Colour: the shrine frame is the region's
thesis in one image — lilac keeper, gold pile, green behind, grey around.
Detail: full-set review — all 15 poses compose; none reads empty, flat,
or unpainted.

### Round 5 (`calamity-r5` → `calamity-final`) — the Gardener arrives

Round 4's set predated the Drowned Gardener (the sculpted set-piece
landed after the round started). Round 5 adds `the-gardener` pose and
recaptures the set with the statue on the road: the pale robed figure
lies across the blast road, hood toward the terrace, arm still raised,
moss on its up-facing stone — the saddest, most storybook thing in the
march, and the frame holds at both fidelities (the sculpted GLB and its
procedural stand-in are the same figure in two strokes). Final full-set
review: all 16 poses compose; none reads empty, flat, or unpainted.

## Capture sets

`calamity-r0` (ground-only smoke), `calamity-r1` … `calamity-r5`
(iteration rounds), `calamity-final` (canonical 16), and
`calamity-final-noassets` (the fallback build — every mark in the region
is procedural except the sculpted Gardener, whose own stand-in is the
procedural figure in broader strokes; nothing breaks). All under
`visual-qa/` as `*_REGION-sunken-calamity-1-<pose>_<tag>.png`; the
Gardener's turntables live in `visual-qa/atelier/`. Poses: sorrow-gate,
first-dead, shock-rings, the-gardener, card-house, suffocated-mile,
wound-gate, the-reveal, shatterfield, ghost-forest, the-wound,
cold-candle, seep-gardens, last-grove, the-shrine, quiet-rim.

## The no-assets build

Captured under `calamity-final-noassets`: every mark in the region is
procedural (DataTextures, vertex colours, seeded geometry) except the
sculpted Gardener — and it carries its own procedural stand-in authored
in the GLB's local frame, so the statue lies on the road in full
silhouette either way. The ghost forest, the Wound, the shrine and the
grove all hold; nothing breaks.

## Flags

- Ground vertex pitch 2.2–2.5 m (vs the ~1.2 m guidance) — the 250k cap
  is the binding constraint; documented above.
- `build()` is a synchronous ~2.1 s hitch on first approach.
- The rim ring / march rows are invisible collider walls; near the rim
  the ceiling closes to 3.4 m to keep one row sufficient. The painted
  distance rings 40 m further out are the visual excuse.
- The gardens' worm crowns lean salmon at the far edge of readability
  under the grey water — the fish community's documented complement
  illusion; measured real red present in the crowns (pushed past 1.0)
  before accepting it.
- A pre-existing headless-SwiftShader toon program warning (`vec4 →
  vec3`, unnamed material) fires at game startup on the capture harness
  — reproduced with this region's registry entry reverted; not this
  region's code, and invisible in every captured frame.
