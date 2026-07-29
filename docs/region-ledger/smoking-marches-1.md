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
Capture review: pending below.

## Budgets

Measured at close: see the final section (tests hold ≤ 120 draws,
≤ 250k triangles, with honest floors of > 20 draws and > 100k tris).

## Capture sets

`smoulder-r1` … `smoulder-r4` (iteration rounds), `smoulder-final`
(canonical 12), `smoulder-final-noassets` (fallback build), all under
`visual-qa/` as `*_REGION-smoking-marches-1-<pose>_<tag>.png`. Poses:
gorge-descent, first-breath, gorge-lip, ash-flats, colonnade,
organ-steps, spring-stair, chimney-forest, twin-kings, caldera-rim,
kiln-keeper, ember-shore.

## Flags

- The round 1–3 critique text above is a reconstruction (see the
  provenance note); the capture PNGs and commits are the primary record.
