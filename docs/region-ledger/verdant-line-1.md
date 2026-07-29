# verdant-line-1 — THE GREAT KELP SEA (pilot region)

Slot `verdant-line-1`, province The Verdant Line, gateway `kelp-cathedral`
(azimuth 1.35). Disc centre ≈ (97.7, 434.2), radius 220; approach tongues
r 44/62 → 285. Seed `SEEDS.regionVerdant1` and `^` substreams only.

## Concept

The Kelp Cathedral was the narthex; this is the sea it was praying toward.
A drowned green world the size of the whole original game, where giant kelp
becomes geography: a winding vale descends from the cathedral's vault to a
saddle-lip reveal; sunlit meadows roll under shoals; a high forest of 18–25 m
giants closes overhead around a circular clearing of falling light; the
deepest quarter tangles into holdfast maze, wreck and grotto; and the far
rim thins onto a shelf where painted green silhouettes promise the deeper
province.

## Sub-biome map (spoke coordinates: u along azimuth 1.35, v lateral CCW)

| Sub-biome | Where | Floor |
|---|---|---|
| The Long Vale | u 48→285 along the tongue, channel wanders ±12 | −5.4 → −7.2 → lip +1.6 → −1.8 |
| The Rolling Meadows | u 292–400, v −80..+80 | −3.8 .. +0.4 swells |
| The High Forest | basin at (450, −10) r 122 | ≈ −8.5, hillocked |
| The Sunwell | (475, +58) r 34 | −10.6 bowl, +1 rim ring |
| The Root Maze | (495, −82) r 62 | −20.6 ± 3.2 gullies (lowest ≈ −23) |
| The Falling Edge | u > 540 to the rim | −2.4 shelf, fading to dune level by rc 210 |

Vertical range across the disc ≈ 24 m (lip +1.6 → maze −22.5; the test
holds ≥ 20 and lowest ≤ −18). Ceiling: 12 m at the vale mouth (meeting the
cathedral's vault), 10 through the narrows and over the lip, 26 over the
forest (the canopy breach at ~+15 is a swim), closing to 3.4 at the rim so
one collider ring seals the world's edge floor-to-ceiling.

### The domain, and how it is sealed

Weight is max-combined from `slotDisc` plus **two** `approachTongue`s: a
seam tongue (halfWidth 8.2 → 34) that clears the canyon wedge (azimuth
1.11) and the Nursery Shallows wedge (1.545) at the wing seam — 8.2 m is
the widest the map allows at r = 44 — and a wide vale tongue starting at
r = 62, past every wing's carve end, carrying the walls (20 → 40). The
collision handover teleports a diver who reaches weight = 0, so the open
edges are walled: a 94-sphere rim ring at rc 206 (gated only over the
channel's own width), double rows down the vale (inner at wall crest,
outer at the tongue edge, overlapping by construction), and three-sphere
stacks at the 8.2 m doorway.

## Landmarks

1. **The Vale Gate** — two pale jamb stacks where the cathedral's end wall opens (u 55/57).
2. **The Overlook Lip** — the saddle at u 268: slab, crooked giant pair, the reveal over the meadows with two outrider giants ghosting in the fog.
3. **The Shoal Hills erratic** — a 3 m boulder alone on a meadow swell (318, 32).
4. **The Elder** — the tallest giant in the province (25.5 m) on its hillock (430, −22); the serpent circles it.
5. **The Sunwell** — the clearing: great shaft, light pool, pale meadow bowl, eight ring giants leaning in.
6. **The Green Gates** — two root-wrapped swim-through arches on the maze approach.
7. **The Fallen Giant** — a dead trunk bridging the maze's widest gully, swim-under clearance at its middle.
8. **The Wreck Rib** — five ribs and a keel of an old hull, half-buried (489, −94), wine-and-silver.
9. **The Weaver's Grotto** — slab-roofed hollow at the maze's deep edge; the Kelp Weaver braids at its mouth.
10. **The Falling Edge pair** — two leaning stacks framing the painted distance (600, 24)/(596, 9).

Plus the fog-rhythm dressing: 11 ledge-kelp clusters and 6 wall boulders
alternating down the vale (something breaches the fog every ~25–35 m of
the 200 m approach), young stands through the meadows, thinning stands
and turf on the shelf.

## Life

Leaf-drift motes (600 points, vale included) + 36 tumbling leaf cards; the
meadow shimmer (travelling shoal, 60); the canopy grazers (hover shoal,
44, under the Elder); **the current serpent** (76 green-silver fish
swimming one closed 17-station line through the forest, nose to tail at
body-span 0.12 — the moving centrepiece; following it is the tour); 26
emerald/rose/violet cushion stars; 18 plum urchins in the maze; and **the
Kelp Weaver** — the findable resident (`kelp-weaver`), an eel-bodied
spirit braiding a three-petal rose curve at the grotto's mouth, 36-ring
live-posed tube with banded jade paint and a gold dorsal ribbon, codex
entry in the def's pure half, discovery target at the braid's anchor.
The weaver was discovered *by the capture harness itself* during the
grotto pose's settle in two rounds — treated as a live proof of
discoverability.

## Budgets (measured programmatically; tests/regionVerdant1.test.ts holds the caps)

**65 draw calls, 248,711 triangles, 305 colliders** at close. Ground:
4 disc tiles (231 m, 104 segs ≈ 2.2 m/vertex, trimmed to rc ≤ 240) + 1
vale sheet (84 segs ≈ 1.75 m/vertex, trimmed to the tongue band,
overlapping the disc tiles by 3 m and sunk 4 cm — see round 2). Kelp is
five merged area chunks (2 draws each) for frustum culling; everything
repeated is instanced.

**Deviation flagged:** the mandate's ~1.2 m/vertex ground pitch would
alone cost ~210k triangles over this disc; 1.75–2.2 m/vertex is the trade
that keeps the whole region ≤ 250k. Authored terrain wavelengths are
≥ 8 m, so the coarser grid samples them cleanly. Also flagged: build()
runs synchronously in the streamer's attach (~200 ms of geometry and
paint bakes on this machine) — a hitch on first approach; acceptable for
the pilot, a candidate for amortised builds later.

## Seeds

`SEEDS.regionVerdant1` (0x5a4d_0c01) with `^` substreams: terrain fbm
(0xd1a1, 0x4e11, 0x0f0e, 0x3a7e, 0xfa11, 0x9d01, 0x11ea, 0x5ade, 0x517a),
kelp placement 0x1e0f / leaves 0x51ab / crowns 0xca9e, rocks 0x50c7
(+0x0a.., 0x0b.., 0x0c.., 0x0d.., 0x0e.. shape seeds), life 0x40e5/0x40e6/
0x5a01/0x5a02/0x5e59/0x57a5/0x0bc1/0x0bc2, weaver 0x0ee1, light
0x11f7/0x90f1, distance 0xd157/0xd200+. Update spends no randomness, so
captures settle deterministically.

## Critique history (silhouette → value → colour → detail, per round)

### Round 1 (`pilot-r1`) — bones right, paint absent
Silhouette: reveal/aisle/Elder/sunwell-ring/falling-edge-rings compose;
serpent = scattered dots; canopy not a ceiling. Value: ground one flat
mid value everywhere; maze reads as beige dunes; trunks near-black close
up. Colour: fog electric emerald (red 0.58 below the value key's floor);
warm-gold fish read salmon; wreck/roots tan. Detail: the vale is 200 m of
empty walls; grass sparse sprigs; **cyan seam cracks** where the vale
sheet T-junctions the disc tiles across steep slopes.

### Round 2 (`pilot-r2`) — direction right, magnitude wrong
Seam fixed (overlap + 4 cm sink — abutting different grids cracks open on
steep slopes). Vale gains ledge kelp + boulders; fog softened; but the
ground still read beige: polite tints under a strongly warm sand wash do
nothing — "a tile and a tint cannot both carry the colour".

### Round 3 (`pilot-r3`) — the ground turns green
Red cut hard in every ground tint; sward mottle patches; forest floor
reads moss with litter drifts; Sunwell lush (grass ×2, pool up). New
finds: litter dried into rust; roots salmon-rust; maze flat mauve; ring
"trunk spikes" invisible (sub-segment at 250 m — a 3.5 m feature cannot
exist in a 220-segment ring); outriders placed beyond the fog (80–100 m);
lip pair reads bamboo ("mid" kelp too sparse).

### Round 4 (`pilot-r4`) — composition lands
Lip pair grown to full giants; outriders at 50–65 m ghost correctly;
meadow families lifted; maze cooled/dropped with gully contrast; roots
cooled; weaver moved to the grotto mouth (was hidden under the slab).
Rings still read as mountains — widened in-ring spikes just become hills.

### Round 5 (`pilot-r5`) — the distance gets its own geometry
Distant giants become instanced crossed silhouette cards (two ink bands
riding the same followFog as the rings); maze gains silt mottle; ledge
clusters to 11. Cards read as spindly teeth; ring layers (with 17–26 m
trunk-hills reinstated by mistake) read as mountain peaks.

### Round 6 (`pilot-r6`) — rings flattened, cards grown
Rings reduced to pure canopy lines; cards to 24–40 m. Cards' single-diamond
crowns scaled into pyramids — mountains again from the other side. Fish
still warm. Sunwell and narrows pass their reads.

### Round 7 (`pilot-r7`) — measured, not guessed
Cards redrawn to young-kelp proportions (thin two-segment stem, lumpy
two-diamond head, drooping straps) — the horizon finally reads as a
distant kelp sea. Fish measured off the frame with a scratch pixel probe:
the shoal was already grey-green (106,164,154) against cyan (65,166,167)
— the salmon read was the complement illusion on a darker low-chroma
shape (the fish community's documented failure), not a hue error.

### Round 8 (`pilot-final`) — the serpent above the water's value
Serpent lifted to bright green-silver (0xcdeedd ×0.85–1.05) with a
stronger green emissive; the ribbon now reads as a pale living current
between the trunks. Final full-set review: all 13 poses compose; none
reads empty, flat, or unpainted.

## The no-assets build

Captured under `pilot-noassets`: every mark this region ships is
procedural (DataTextures, vertex colours, seeded geometry); the only
authored asset it touches is the sand wash through `createSandMaterial`'s
own fallback path. Nothing breaks.

## Capture sets

`pilot-r1` … `pilot-r7` (iteration rounds), `pilot-final` (canonical 13),
`pilot-noassets` (fallback build), all under `visual-qa/` as
`*_REGION-verdant-line-1-<pose>_<tag>.png`. Poses: vale-descent,
vale-narrows, vale-reveal, meadow-hills, forest-eaves, forest-aisle,
elder-serpent, canopy-up, canopy-breach, sunwell, root-maze,
weaver-grotto, falling-edge.

## Flags

- Ground vertex pitch 1.75–2.2 m (vs the ~1.2 m guidance) — the 250k cap
  is the binding constraint; documented above.
- `build()` is a synchronous ~200 ms hitch on first approach.
- The rim ring / vale rows are invisible collider walls; near the rim the
  ceiling closes to 3.4 m to keep one row sufficient. A diver surfing the
  rim will feel the wall before seeing a reason — the painted-distance
  rings 40 m further out are the visual excuse, but a future pass could
  add rim reef-crest dressing.
- The weaver discovery fires during the grotto capture settle (proof of
  discoverability; the ceremony is HUD-only and does not cover the frame).
- The serpent's fish still lean warm when strongly backlit (canopy-up);
  accepted as backlight after the round-7 measurement.
- Region HUD total rises 17 → 18 when the region first builds (the
  streamer's designed behaviour).
