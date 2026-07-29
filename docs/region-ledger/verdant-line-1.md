# verdant-line-1 — THE GREAT KELP SEA (pilot region)

Slot `verdant-line-1`, province The Verdant Line, gateway `kelp-cathedral`
(azimuth 1.35). Disc centre ≈ (97.7, 434.2), radius 220; approach tongue
r 48 → 285. Seed `SEEDS.regionVerdant1` and `^` substreams only.

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
| The Root Maze | (495, −82) r 62 | −20.6 ± gullies (lowest ≈ −23) |
| The Falling Edge | u > 540 to the rim | −2.4 shelf, fading to dune level by rc 210 |

Vertical range across the disc ≈ 24 m (lip +1.6 → maze −22.5). Ceiling: 12 m
at the vale mouth, 10 through the narrows, 26 over the forest, closing to
3.4 at the rim (one collider ring seals floor-to-ceiling there).

## Landmarks

1. **The Vale Gate** — two pale jamb stacks where the cathedral's end wall opens (u 55/57).
2. **The Overlook Lip** — the saddle at u 268 with its slab and crooked mid-giant pair; the reveal.
3. **The Shoal Hills erratic** — a 3 m boulder alone on a meadow swell (318, 32).
4. **The Elder** — the tallest giant in the province (25.5 m) on its hillock (430, −22); the serpent circles it.
5. **The Sunwell** — the clearing, its great shaft and light pool, eight ring giants leaning in.
6. **The Green Gates** — two root-wrapped swim-through arches on the maze approach.
7. **The Fallen Giant** — a dead trunk bridging the maze's widest gully.
8. **The Wreck Rib** — five ribs and a keel of an old hull, half-buried (489, −94).
9. **The Weaver's Grotto** — slab-roofed hollow at the maze's deep edge; the Kelp Weaver braids beneath.
10. **The Falling Edge pair** — two leaning stacks framing the painted distance (600, 24)/(596, 9).

## Life

Leaf-drift motes (600 points) + 36 tumbling leaf cards; the meadow shimmer
(travelling shoal, 60); the canopy grazers (hover shoal, 44, under the
Elder); **the current serpent** (96 silver fish swimming one closed line
through the forest, nose to tail — the moving centrepiece); emerald cushion
stars (26) and plum urchins (18); and **the Kelp Weaver** — the findable
resident, an eel-bodied spirit braiding a rose-curve through the grotto's
roots, with codex entry and discovery target (`kelp-weaver`).

## Budgets (measured programmatically in tests/regionVerdant1.test.ts)

Round 1 draft: **57 draw calls, 249,365 → 245k triangles (urchin spine trim),
298 colliders.** Ground sheets: 4 disc tiles (231 m, 112 segs ≈ 2.06 m/vertex,
trimmed to rc ≤ 240) + 1 vale sheet (88 segs ≈ 1.67 m/vertex, trimmed to the
tongue band). Deviation flagged: the mandate's ~1.2 m/vertex ground pitch
would alone cost ~210k triangles over this disc; 1.7–2.1 m/vertex is the
trade that keeps the whole region ≤ 250k. All authored terrain wavelengths
≥ 8 m, so the coarser grid samples them cleanly.

## Seeds

`SEEDS.regionVerdant1` (0x5a4d_0c01) with `^` substreams: terrain fbm
(0xd1a1, 0x4e11, 0x0f0e, 0x3a7e, 0xfa11, 0x9d01, 0x11ea), kelp placement
0x1e0f / leaves 0x51ab / crowns 0xca9e, rocks 0x50c7 (+0x0a..0x0e shape
seeds), life 0x40e5/0x40e6/0x5a01/0x5a02/0x5e59/0x57a5/0x0bc1/0x0bc2,
weaver 0x0ee1, light 0x11f7/0x90f1, distance 0xd157/0xd200+.

## Critique history

### Round 1 (`pilot-r1`, 13 poses) — honest verdict: bones right, paint absent

Silhouette: the vale reveal, the aisle's layered trunks, the Elder, the
sunwell ring and the falling-edge rings all read as composition. The
serpent reads as scattered dots, not a body. The canopy is not a ceiling
in `canopy-up` (pose sits in the cleared aisle; pads too sparse).

Value: the ground is one flat mid value everywhere — the biome vertex
paint is far too timid under the sand wash; the maze reads as pink-beige
dunes instead of violet half-light; trunks go near-black up close.

Colour: the fog is electric emerald (region colorScale red 0.58 is below
the value key's floor — "read the red channel first"); warm-gold fish read
salmon-pink against cyan (the documented value failure); wreck/roots read
tan instead of wine-and-silver.

Detail: the Long Vale is 200 m of empty walls — nothing breaches the fog
between the jambs and the lip pair; meadow grass is sparse sprigs; the
maze tangle is too thin; **cyan seam cracks** where the vale sheet
T-junctions the disc tiles across steep wall slopes (z ≈ 203).

Round 2 plan: ground paint ×2 with sward mottle; fog colorScale →
[0.72, 0.92, 0.66], density gain 0.0045; vale ledge-kelp + wall boulders +
grass tufts; meadow grass density/height up; maze gullies deeper, hubs
12, bolder violet; serpent tightened (smaller swing, brighter silver,
denser span); grazers to olive-cream; trunks lightened; pads +2 and
larger; distance rings' trunk spikes widened (sub-segment spikes vanish);
sheet seam fixed by overlap-and-sink (4 cm); poses: canopy-up moves under
the Elder, weaver settle 10 → 6 with reticle off-anchor, breach at y 15.
