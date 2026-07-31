# smoking-marches-1 — THE SMOULDER FIELDS

Slot `smoking-marches-1`, province The Smoking Marches, gateway `vent-springs`
(azimuth 2.79). Disc centre at u = 445 on the spoke, radius 220; approach
tongues r 44/62 → 285 (seam tongue halfWidth 8.2 → 34, gorge tongue
20 → 40 from r = 62). Seed `SEEDS.regionSmoking1` and `^` substreams only.

> **Provenance note.** The working copy of this ledger was the one
> uncommitted file when the session was interrupted, and it did not
> survive. The mandate, concept and round 1–3 critiques below are
> reconstructed from the round commits (67f0844, 660ede9, 5895648,
> b22d44a), the code's own round-marked comments, and a re-read of the
> `smoulder-r1`–`r3` capture sets. Round 4 onward is critiqued live.

## Concept

The Vent Springs wing was a warm doorway; this is the volcanic country
beyond it — otherworldly, warm, alive with slow breath, never hostile.
A black-sand gorge winds out of the wing, the water warming visibly, to a
saddle lip that opens on the Ash Meadows' grey-violet quiet; the Basalt
Steps terrace up to the Organ Pipes' broken colonnades; the Spring
Terraces stack pale-rimmed pools down a mineral stair; the Chimney Forest
stands smokers tall as trees under slow ember-lit smoke columns; the
Caldera holds a bowl of haze where thermal jellies rise in single file
from the Old Kiln — and the Kiln Keeper, a salamander-newt spirit,
patrols its seams. The far rim dissolves into charcoal-and-amber painted
distance.

## Sub-biome map (spoke coordinates: u along azimuth 2.79, v lateral CCW)

| Sub-biome | Where | Floor |
|---|---|---|
| The Black-Sand Gorge | u 48→285, channel wanders ±11 | −7.5 → −9.2 narrows → +1.2 lip (u≈266) → ash |
| The Ash Meadows | the disc's resting ground | −2.4 ± 1.3 grey-violet flats |
| The Basalt Steps | (420, +92) r 84 | benched 1.6 m treads rising to ≈ +8.6 crown |
| The Spring Terraces | (385, −72) r 60 | +6.5 crown stepping down in 1.1 m pool rings |
| The Chimney Forest | (512, −52) r 66 | −12 hummocked basin |
| The Caldera | (505, +55) r 58 | −20 haze bowl, +2.5 rim ring |
| The Ember Shore | u > 555 to the rim | −2 shelf fading to dune level by rc 210 |

Seven sub-biomes (the bar asks five). Vertical range across the disc
≈ 29 m (basalt crown ≈ +8.6 → caldera floor ≈ −20.8; the test holds
≥ 20, lowest ≤ −17, highest ≥ +5). Ceiling: 10 m at the gorge mouth
(meeting the wing's vault), 8.5 through the narrows and over the lip,
28.5 over the disc (the smoke columns and the jelly procession want the
head-room), closing to 3.4 at the rim so one collider ring seals the
world's edge floor-to-ceiling.

### The domain, and how it is sealed

Weight is max-combined from `slotDisc` plus two `approachTongue`s — the
seam tongue clears the wreck-meadow (2.43) and moonlit-lagoon (3.15)
wedges with 8.2 m at r = 44; the wide gorge tongue starts at r = 62,
past every wing's carve end. Seals: a 94-sphere rim ring at rc 206
(gated only over the gorge corridor), three-sphere doorway stacks at
u 48–66, and double rows down the gorge (inner at the wall crest, outer
at the tongue edge) — the corridor is sealed wall to ring, and the test
proves no seal blocks the approach spine.

## Landmarks

1. **The Warm Gate** — charcoal jamb stacks where the Vent Springs' end wall opens.
2. **The First Breath** — the lone gorge smoker at u 158, the first sign the water is warming.
3. **The Overlook Lip** — the saddle at u 266 with its slab: the reveal over the Smoulder Fields.
4. **The Ash Erratic** — a lone boulder on the flats, the quiet's one witness.
5. **The Broken Colonnade** — two leaning rows of columns over a 4.5 m swim-through aisle (393, +52).
6. **The Organ Steps** — thirteen pipes in a half-circle at the basalt crown (424, +96), heights stepped like an organ rank: the country's skyline.
7. **The Spring Head** — the amber-throated crown mound the whole mineral stair descends from.
8. **The Twin Kings** — the two tallest smokers (15.5/16.5 m) at the forest's heart; the thermal riders spiral their smoke.
9. **The Old Kiln** — the domed, ember-seamed mound at the caldera's centre; source of the jelly procession; the Keeper's patrol.
10. **The Ember Shore stacks** — leaning stones framing the painted distance on the far shelf.

Plus fog-rhythm dressing down the 200 m gorge (boulders and warm stains
alternating so something breaches the fog every ~30 m) and the caldera's
rim crags.

## Life

Heat-drift ember motes (600 points, one additive draw — the region is
always breathing out); **the thermal riders** — a ribbon of pale-copper
fish on one closed line that spirals 2.3 turns up the Twin Kings' smoke
column, glides off the crown and sinks back down the forest's edge;
**the jelly procession** — the moving centrepiece: nine great thermal
jellies rising in single file from the Old Kiln, pulsing, drifting off
the haze top and sinking back along the bowl's far wall, a lantern-parade
the fog reveals one jelly at a time; cinder stars (violet-charcoal
cushion stars with ember lobe-tips) and ember urchins (maroon domes,
amber-tipped spines) on the warm floors; and **the Kiln Keeper**
(`kiln-keeper`) — the findable resident: a salamander-newt spirit
patrolling the kiln in one 34-second loop, fixed-topology live-posed
tube with crest, leg-fins and flattened tail, charcoal-violet back and
an ember belly the vein-glow material reads as light — in the haze it
is a slow lantern, which is what makes it findable. Codex entry in the
def; DiscoveryTarget at the kiln. Flame fronds and ash-grass carry the
living-ground bar everywhere the terrain says heat.

## Seeds

`SEEDS.regionSmoking1` with `^` substreams: terrain fbm (0xb1ac, 0xa5f1,
0xba5a, 0xb0d1, 0x59a1, 0xc41d, 0xca1d, 0x9e0a, 0x5407), basalt 0xba5e/
0xba17+/0xba1f/0xface, chimneys 0x51c0+, springs 0x59a7, rocks 0x50c9,
keeper 0x0ee7, life substreams for motes/riders/jellies/stars/urchins,
flora and distance streams. Update spends no randomness, so captures
settle deterministically.

## Critique history (silhouette → value → colour → detail, per round)

### Round 1 (`smoulder-r1`) — bones right, everything too loud at once
(Reconstructed.) Silhouette: gorge/lip/organ-rank/kings/kiln compose;
the smokers read as one orange-brick mass — the amber veins flooded the
four value stops. Value: ash-grass bone-pale blades vanished against the
dunes; the springs sheet a solid milky slab hiding its own floor. Colour:
the water still bowl-cyan — the region did not yet own its warmth; kiln
throat glow overblown. Detail: smoke puffs small and busy; the reveal at
the lip opened onto nothing near — no scout shape between lip and flats.

### Round 2 (`smoulder-r2`) — the water warms, the amber becomes an event
(Reconstructed from 660ede9.) Fog density raised to carry the amber;
springs sheet faded to a whisper over its floor; kiln unblown; smokers
regreyed (foot 0x4c4452 → crown 0xb8a48e) so the veins are events, not
the wall; grass darkened; a scout smoker placed for the reveal. Found
next: the "warm" fog scale still read olive — polite scales do nothing
against a base water whose green outvotes red eight to one.

### Round 3 (`smoulder-r3`) — red above one
(Reconstructed from 5895648.) Fog red scale pushed above one — the
water finally warms; springs sheet defogged and the terraces given
contrast so the stair reads as steps of light; smoke puffs grown big and
dim (few large soft shapes, not confetti); the jellies unstalked (the
procession line had read as beads on a visible rod). Found next: the
warmth still not *felt* in the frames — measured, the scale was being
applied in linear space where base red is 0.086 against green 0.443.

### Round 4 (`smoulder-r4`) — fog measured in linear space
The one change: `colorScale` red 1.3 → 3.2, green 0.52, blue 0.36 —
measured against the linear-space base water (0.086, 0.443, 0.494),
where a red scale below ~2.6 cannot even reach parity with green. The
product (0.28, 0.23, 0.18) is the warm grey the whole palette keys to.
Capture review: the water finally breathes amber down the gorge and
across the flats — the region owns its mood. Still standing: a cyan
slash where the gorge sheet stopped 3 m short of the bowl sheet (a
sign error in the overlap arithmetic); the spring stair reading as one
smooth mound; the keeper lost behind the kiln for most of its loop;
the thermal riders often out of frame; distance cards shrub-scaled.

### Round 5 (`smoulder-r5`) — the seam closed, the stair terraced
Silhouette: gorge sheet regrown over the bowl sheet (the 3 m gap was
`discEdgeX + 3` where the overlap wanted `− 3`); distance cards grown
to 26–50 m giants and pushed a wide margin off the gorge gap. Value:
spring terraces re-baked in three tints (pale sinter rim, amber
mid-shelf, violet risers) so the stair reads as steps of light under
the water sheets; the sheets' vertex shade lifted 0.12 → 0.18. Colour:
kiln breath given its own light shaft so the caldera advertises from
afar. Detail: keeper grown to a spirit (body radius 0.17 → 0.28, crest
and legs to match, emissive up) — a discovery should not need a
magnifying glass; riders' loop pulled in so the spiral stays in the
twin-kings frame. Found next: the round-5 card cut (symmetric crown
lumps) read as telephone-pole crosses on every horizon.

### Round 6 (`smoulder-r6`) — the cards fail differently, the keeper walks wide
Cards redrawn one-sided (a plume smudge drifting +x): on the ember
shore and ash flats horizons they read as periscope necks — a solid
plume cap in flat fog ink will never read as smoke. (The domed shapes
over the caldera rim, first misread as failed cards, are the jellies
themselves — bell over trailing straps, the intended lantern read.) Keeper patrol widened (r 5.4 → 7.0, over-shoulder swing up)
so it clears the kiln's silhouette most of its loop — the kiln-keeper
pose now catches it mid-crossing, ember belly lit, codex trigger firing
in the capture itself. Kiln seams calmed (threshold 0.6 → 0.68). All
other poses hold: gorge warm over violet shadow, colonnade and organ
steps carrying the columnar-jointing skyline, chimney forest layered
smoker-over-smoker in the haze, twin kings with the rider spiral,
ash flats quiet with grass, erratic and far skyline.

### Round 7 (`smoulder-r7`) — bare spires
The plume is gone. Two attempts proved the lesson: the reference that
*does* read at 250 m is the near forest's own far skyline — bare
tapering spires, nothing at the crown but a leaning tip. The card is
now exactly that (broad foot, two leaning segments, wind-side tip),
and the horizon finally says "distant smokers" from the ember shore
and the ash flats alike. Verdict: every pose holds — the loop closes
at seven rounds.

## Budgets

Measured on the final build (the test's own traversal, honest floors
held): **59 draw calls** of the ≤ 120 budget, **171,543 triangles** of
the ≤ 250k budget, 391 colliders — all inside the domain by test.

## Capture sets

`smoulder-r1` … `smoulder-r7` (iteration rounds), `smoulder-final`
(canonical 12), `smoulder-final-noassets` (fallback build), all under
`visual-qa/` as `*_REGION-smoking-marches-1-<pose>_<tag>.png`. Poses:
gorge-descent, first-breath, gorge-lip, ash-flats, colonnade,
organ-steps, spring-stair, chimney-forest, twin-kings, caldera-rim,
kiln-keeper, ember-shore.

## Flags

- The round 1–3 critique text above is a reconstruction (see the
  provenance note); the capture PNGs and commits are the primary record.

---

# Phase 3 rework — the fill (docs/fill-plans/smoking-marches-1.md)

Executed against FILL-DOCTRINE / MASTER (registry §1.2 inviolable; the
two Smoulder rest bars are the Ash Meadows centre u 330–360 v ±20 and
the caldera's north floor quadrant — both tested empty of every fill
tier). Budgets per R1: ≤ 160 draws / ≤ 450k tris, measured by the
region test. All fill streams are `SEEDS.regionSmoking1 ^ FILL_SEEDS.*`
(fresh constants, appended after every pilot draw); the test pins
smoker/basalt/bead/vent/rock positions from the pre-fill build to prove
the fence.

## Deviations, cited

- **The fork cairn and its glow at u 363, v 24** (plan §2 drew the fork
  at u ≈ 360, v 0): the registry's Ash Meadows rest bar ends at u 360 /
  v ±20 and is glow-free — the registry wins (R10). The cairn marks the
  fork from just past the bar's corner.
- **The spine shoal's fork pool at (365, 26)** — same clause; the loop
  also rides the flats' NORTH shoulder out and the south home leg at
  v ≈ −28, so it never crosses the rest bar, the erratic's shadow or
  the mid-shore pocket. Asserted by test.
- **The Spring Head geyser** stands over the crown's throat; the crown
  pool rest itself takes NO standing fill (the burst is the landmark's
  own breath, plan §4.3's authored event; new light marks are tested
  out of all six rests, with the pilot's six pool rows grandfathered).
- **No new contacts registered for the mats** (plan §7.3 said "contacts
  registered with buildSmokingGround"): a mat is a draped decal with a
  dissolving rim — a contact shadow under it would darken through its
  own transparency. The new rocks/smokers register contacts as before.
- **Vents 30 → 72** (plan said 80): the pilot's 30 keep their exact
  stream; 30 more forest/stand vents + 12 caldera fume domes land under
  an 84 capacity — the last 8 were headroom, not composition.

## Rework round 1 (`sm-fill-r1`) — critique

All 14 authored poses captured (12 pilot + the plan's two road poses)
and READ against the `smoulder-final` baseline:

- `gorge-descent`/`first-breath`/`gorge-road`: the road is a place now —
  cinder gravel, seep mats + frond banks, wall boulders every ~15 m,
  glow marks, the spine shoal overhead, gorge motes. **Fails on marks**:
  the shoal's glint thread reads as cold-white fairy lights in the warm
  register (kit sparkle is 0xf4ffe8 — wrong lamp for this country).
- `gorge-lip`: skyline + beam land; the foreground shelf u 252–280
  still bare — the sulfur band started at u 280.
- `ash-flats`: grass, cobble pairs, tufts, hoppers, erratic, scout ✓.
- `colonnade`: aisle blade ✓, fallen segments ✓; the floor's joint
  litter reads as specks (too small at pose height).
- `organ-steps`: scree + fallen shafts + skyline ✓.
- `spring-stair`: the geyser fires ✓, shard litter + mats on the treads
  — but the near thermophile mat reads maroon-black (rust/skirt bands
  painted too deep for this light: the verdant round-1 lesson, again)
  and large mats break across risers.
- `chimney-forest`/`twin-kings`/`forest-road`: floor fed (ember gravel,
  aprons, fronds, urchins) — but the vent-shrimp swarms spray white
  sparkle across the SKY at pose height: too many, too big, too high.
- `caldera-rim`: cobble run + fume domes + seam mats give the bowl a
  floor; north quadrant quiet ✓.
- `kiln-keeper`: **corrupted frame** (flat violet) — diagnosed as a
  capture-harness race, not scene content: the same pose re-captured
  with longer post-capture wall time renders clean every time (the pose
  triggers the keeper discovery mid-settle and brings several unique
  programs into frustum; the 250 ms screenshot wait can race the
  compile). Flagged below; retaken per round.
- `ember-shore`: dune grass, scoria windrows, leaners, tufts ✓.

### Round-1 sweep — verdict ~4–5/12

PASS 05 (basalt near/mid/skyline), 08 (forest eaves), 09 (forest);
marginal 04, 06 (smoke-bushes read as pumpkin buns — tips too ripe),
10, 12; FAIL 01, 02, 03, 07, 11 — every fail is the bare inter-zone
disc / rim flank band, none in a registered rest. The verdant shape
exactly: 620 sulfur tufts over a 215 m disc cannot carry the near
layer, and default-size litter vanishes past 8 m.

**Round-2 orders**: a base ash-tuft carpet (3,000 cards, bone-over-
violet, painted a step off the ground paint) across the whole disc;
sulfur tufts 620 → 950, taller, band leaned harder to the rim and
reached back to the lip flanks; flats pebbles and joint litter grown a
size; vent shrimp halved, smaller, dimmer, floor-hugging; the shoal's
glint thread dropped (the motes are this region's sparkle); smoke-bush
tips off pumpkin onto smoulder; spring-mat bands lifted a value and
radii tightened to one tread.

## Rework round 2 (`sm-fill-r2`) — critique

All 14 authored poses (kiln-keeper clean this round) and the 12-pose
sweep captured and READ. The mark tune-downs landed: shrimp swarms sit
low and dim, the shoal keeps its ember body without the cold glint,
smoke-bushes read burnt, the spring mats hold their tread and their
value. `chimney-forest`/`forest-road`/`spring-stair`/`kiln-keeper` are
finished pictures.

### Round-2 sweep — verdict ~6–7/12

PASS 04, 06, 08, 09 (the forest and its eaves carry everywhere);
borderline-pass 05, 10, 12 (basalt country: columns + litter, near
layer thin); FAIL 01, 02, 03, 07, 11 — the same inter-zone disc bands
as r1, none in a registered rest. The r2 base carpet did NOT read:

- **The bone-pale paint converged with the fog-lit ash floor** — the
  exact wording of verdant-1's round-3 lesson, suffered here despite
  quoting it: 3,000 pale cards stood on a pale ground under a warm fog
  and vanished. What DOES read at pose height, in every frame that has
  it, is the ash grass's dark violet silhouette.
- Litter at 0.07–0.24 m still reads as specks past ~8 m; the gorge's
  near field (`first-breath`, `gorge-road`) is gravel-only and bare.

**Round-3 orders** (the value pass, done properly): repaint the base
carpet INTO the dark family the region already proves — charcoal-violet
stubble a full value BELOW the ground paint — and double it (3,000 →
6,000 cards, 0.4–0.75 m); give the gorge its own standing stubble
(1,100 cards on the wall feet, centre tread kept lighter so the road
stays a road); sulfur tufts 950 → 1,300 with the flank floor raised
0.35 → 0.45; every litter family up a size step (gorge gravel 1,500 @
0.1–0.28, ripple/scoria 0.1–0.3, forest gravel 800 @ 0.08–0.24).

## Rework round 3 (`sm-fill-r3`) — critique

All 14 authored poses (kiln-keeper retaken with a 9 s post-capture
wait after the harness race hit again — scene content clean both
times) and the 12-pose sweep captured and READ.

The value pass is the round that made the region. The charcoal-violet
stubble reads at pose height in EVERY sweep frame — the exact dark
silhouette the ash grass was already proving — and the up-sized litter
finally survives past 8 m:

- `gorge-descent`/`first-breath`/`gorge-road`: the gorge is finished —
  standing stubble on the wall feet, cinder gravel with visible stones,
  the centre tread lighter so the road still reads as a road, seep mats
  and glow marks pacing it, the spine shoal and motes overhead.
- `gorge-lip`: the u 252–280 shelf carries its own tuft band now.
- `colonnade`/`organ-steps`: joint litter reads as stones, stubble
  fills the aisles; fallen segments + blade ✓.
- `spring-stair`: mats hold their tread and value; geyser fires ✓.
- `chimney-forest`/`twin-kings`/`forest-road`: finished pictures —
  smoker feet glowing, ember gravel, shrimp low and dim.
- `caldera-rim`: fume domes + seam mats; north-quadrant floor still
  quiet ✓. `ash-flats`: hoppers, cobbles, tufts, grass ✓.
- `ember-shore`: leaners with scoria saddles, dune grass, windrows ✓.
- `kiln-keeper`: dome, jellies, prints and a hatchling in frame; the
  mood table untouched.

### Round-3 sweep — verdict 11/12

PASS 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 12 — every frame carries
near stubble/litter, a mid event (columns, boulders, smokers, mats)
and a far silhouette (skyline stands, rim, motes). 06 and 07 are the
thinnest passes (flats country: far layer is one distant stand plus
marks) but all three layers are present on the flanks. The one MISS is
11: the camera looks straight down the flats centre — the REGISTERED
flats rest bar — so its mid band is deliberately empty; near fronds
and the colonnade skyline are there. Miss inside a registered rest:
allowed by the standard. 11/12 ≥ 11 — the standard is met; rounds
close.

## Fill close-out — budgets and captures

Budgets, measured by the region test (printed by the budget spec):

- **Before** (pilot, `smoulder-final`): 59 draws / 171,543 tris.
- **After** (fill, r3): **94 draws / 398,685 tris** — inside the
  doctrine's ≤160 / ≤450k with headroom (66 draws / ~51k tris).

Final capture sets under `sm-filled`: authored (14 poses), sweep
(12 poses), and the `SHOT_NO_ASSETS=1` procedural-fallback authored
set — all read.

Flags for the orchestrator:

- **Capture-harness race** (pre-existing, not a scene bug): poses that
  trigger a discovery mid-settle can screenshot before the last unique
  programs compile (flat-violet frame). A longer post-capture wait
  renders clean every time. `scripts/region-shots.mjs`'s 250 ms wait is
  worth raising, but that file is out of this branch's scope.
- The fork cairn glow sits at u 363 (plan said ~360) — the registry's
  glow-free bar u 330–360 wins over the plan's number.
- Thermophile mats are decals and register no ground contacts — a
  contact shadow would darken through their own transparency.
