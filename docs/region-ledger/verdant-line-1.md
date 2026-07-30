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

---

# PHASE 3 REWORK — the fill (`rework/verdant-line-1`, plan `docs/fill-plans/verdant-line-1.md`)

Executed under FILL-DOCTRINE + MASTER (R1 caps, R4 first item, §1.2
registry inviolable). Every fill stream is `SEEDS.regionVerdant1 ^` a
fresh `FILL_SEEDS.*` constant appended after all pilot draws — the reroll
fence, proven by test pins on the first/last giants and the weaver's
haunt (exact pre-fill coordinates held to 9 decimal places).

## What landed (by checklist item)

1. **Budgets** — test caps raised to the doctrine's 160 draws / 450k
   tris; floors raised to 90 / 300k. Measured at round 1:
   **108 draws / 439,018 triangles** (pilot was 65 / 248,711).
2. **MASTER R4, first item** — `VerdantDistance` rings and trunk cards
   now part over the depth-2 pass (second gap at
   `VERDANT_SLOT.azimuth`, `PASS_GAP_HALF = 0.2`, card margin +0.1;
   asserted by test). `falling-edge` r1 shows the corridor open,
   milky-bright, the eased ring ends reading as soft hills.
3. **Ground paint** — the channel-centreline moss track (the road
   itself is green now) and the lip-garden sward band over u 248–330
   (the `vale-reveal` beige is gone).
4. **Kelp** — ledge clusters 11 → 22, meadow stands 9 → 15, +6 eave
   mids at u 356–404, canopy pads 6–8 → 9–12 per giant, plus the
   above-canopy pad cards (169 instanced, unlit, vertex-painted).
5. **Rocks** — root hubs 11 → 20 (scenery only), the wreck debris
   field (24 kit planks), 4 dead spars, 12 rim-crest stones at
   rc 196–204 with both pass corridors kept clear.
6. **Meadow** — patches 42 → 66 (the plan drew 70; the measured
   triangle budget trimmed four — see deviations), Sunwell ×1.3,
   Falling Edge ×1.5 with the shelf-pocket rest excluded.
7. **Life** — vale runner (45 + glint, kit `shoalRunner`, loop u
   64–184), brooding shoal (30, maze), far shoal (20, leaning pair),
   8 drifter jellies, meadow crab colony (4×3, kit `percherColony`
   dart on region crab geometry), bark-percher fry (10×5 hover),
   glow-polyp colonies 14×8 + wreck/grotto accents + gate-jamb moss
   (kit `glowColony`), stars 26 → 44 (the maze's rose-violet family),
   urchins 18 → 34 + eight vale colonies of four. Shimmer re-centred
   (350, 16, rU 56) so its ellipse crosses the aisle twice.
8. **Light** — kit `beamAndPool`: 8 gold-green beams (vale 110/165/186,
   erratic 330, aisle 385/456, the Elder god-ray pair) + 6 pools
   (vale ×2, erratic, aisle ×3 — one under the standing 442 shaft),
   1 dusk beam through Green Gate 1, 1 pale beam at the Falling Edge.
   Sunwell peak: great shaft 0.15 → 0.22, pool 9 → 11 m.
9. **T1/T2 kit cover** — seven carpet families (moss 2,600 / sward
   3,400 / litter 2×1,150 / silt 1,800 / shell 900 / ring-rim 600),
   pebble runs (vale 520 two-tone, meadow 140, erratic skirt 12, maze
   shards 500), six bush banks (vale 40 / meadow 60 / forest 70 /
   wine 40 / pale 20 / Sunwell-outside 8), vale sponges (8×3), and
   the region exclusives: holdfast skirts on all 39 giants, 26 fallen
   limbs (3 variants through kit `groundLitter`), dead spars, canopy
   pad cards.

## Deviations, cited

- **The narrows vs the vale runner** (plan §5 said "full channel u
  60–280"): MASTER §1.2 holds u 190–250 at *motes only*, and R10 says
  stillness beats cadence — the runner's loop ends at u 184. Life
  leads the diver in, goes quiet through the shadow, and the shimmer
  picks the thread up past the lip. Asserted by test.
- **The third vale beam** (plan §4 drew it at u 230, inside the
  registry's beam-free narrows): moved to u 186, just before the
  shadow starts, which reads as the pinch's last light.
- **Beam count**: the plan's §3 zone table lists 12 new beams, its §6c
  says +8 — irreconcilable as written. Landed 10 (the §4 narrative's
  set minus the two Sunwell satellites, whose job the 0.22 peak boost
  does better without crowding the markless-within-40 m rule).
- **Meadow patches 70 → 66, litter 2,800 → 2,300, vale pebbles 700 →
  520, maze rubble as 8-tri shards, bushes at 4 lobes, sponges 3/anchor,
  urchin spikes 16 → 12, ground pitch 104/84 → 98/80 segments**: the
  plan's §3 roll-up under-counted (its own estimate was 415k; the
  faithful build measured 480k), and R1's 450k cap binds. These trims
  took the measured build to 439,018 with the composition intact.

## Rework round 1 (`fill-r1`) — critique, silhouette → value → colour → detail

All 13 authored poses captured and READ against the pilot-final befores:

- `vale-descent` / `vale-narrows`: the road works now — moss track,
  ledge gardens both sides, beams with landings, runner overhead.
  **FAILS on value**: the moss/pebble T1 reads as near-black violet
  thorns under the region's dim sun (the kit demo's brighter stage
  hid it); the sponge cluster reads as a traffic-cone RED column; the
  runner's fish read as dull brown blobs when backlit (the fish
  community's complement illusion, again — value must come UP).
- `vale-reveal`: the doorstep is green; saddle bareness is the crest
  rest, composed. Passes.
- `meadow-hills`: transformed — sward, pebbles, young stands, erratic
  skirt, beams. The jellies read SALMON-pink fish (cool them violet).
- `forest-eaves`: eave mids close the treeline gaps; aisle beams
  land. Foreground litter still reads as dark specks — value + size.
- `forest-aisle`: wayside grass + skirts read; the bush bank at left
  reads near-black (lift the olive family's whole ramp).
- `elder-serpent`: serpent + motes + skirts compose; the Elder
  god-ray pair is nearly invisible (edge-on fade kills near-vertical
  blades seen from below — the pair needs real slant).
- `canopy-up`: crowns denser (9–12 pads) but the ceiling still shows
  too much open sky; the pad cards barely read from below. More and
  bigger pads.
- `canopy-breach`: pool + shaft + grazers + near pads — better, but
  the "sea of crowns" is still thin along the sightline.
- `sunwell`: the light peak lands — lush bowl, ring-rim carpet band,
  brighter shaft. Passes.
- `root-maze`: dead spar + arch + hubs + debris compose, glow
  colonies carry their own light. **But**: spar stubs read as a
  signpost "T" (droop them), wine bushes read magenta (deepen), glow
  tint reads lime-slime in the mid-value water (pale it).
- `weaver-grotto`: weaver at the mouth ✓; the right-edge spar reads
  as a telegraph pole (taper + curve); grotto lanterns too faint;
  silt cards read as specks (lift the violet family's value).
- `falling-edge`: turf + shells + bushes + pale beam + THE OPEN PASS
  (R4). Passes.

**Round-2 orders**: one value pass over every fill palette (the fill
was painted for the kit demo's light, not the region's); sponge
ochre → olive-tan/wine; jellies violet; runner fish value up; spar
taper + drooped stubs; wine bushes deepened; glow tint paled; god-ray
pair slanted harder; litter bigger; pads more/bigger.

### Round-1 sweep (`fill-r1`, 10/12 captured — 11/12 timed out on the
### loaded machine; the seeded poses recur, so the verdict is honest)

- **01 PASS** (marginal) — kelp stem + boulder foreground, grass mid,
  ring distance.
- **02 PASS** (marginal) — grass tufts near, kelp forest middle, ring
  far; bottom-left quarter bare.
- **03 FAIL** — bare olive swells, no foreground <8 m, middle only the
  far ring. Outer meadow flank.
- **04 FAIL** — bare tan slope, distance only. Inter-zone disc.
- **05 FAIL** — bare mustard ground to the horizon-line, kelp
  silhouettes far. Outer flank.
- **06 PASS** — trunk + skirt + limbs foreground, boulder mid, kelp
  middle, arch far.
- **07 PASS** (marginal) — sward + litter chips + a jelly; the ring
  end reads as a headland (eased in r1, acceptable).
- **08 FAIL** — the barest frame: empty tan plain, wreck silhouette
  far left. Rim-side disc.
- **09 PASS** — boulder trio + dead spar + kelp crest.
- **10 FAIL** — forest-eave ground bare for two-thirds of the frame;
  the T1 specks vanish at pose height.

**Verdict 5/10** — far off the ≥11/12 standard, and no miss lands in a
registered rest (the rests are the Sunwell bowl, the narrows, the lip
crest, the shelf pocket — none of these frames). Root cause, beyond
the value pass already ordered: the carpet families are gated to the
named zones and their cards are too small/dark to read at pose
height, so the broad disc between zones stays bare. **Sweep orders
for round 2**: bigger T1 cards across every family; a base coverage
floor so the disc between zones is never bare by default (doctrine:
"no square metre bare by accident"); litter/pebble value up so
foreground interest reads.
