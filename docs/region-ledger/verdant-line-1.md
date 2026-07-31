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

## Rework round 2 (`fill-r2`) — critique

All 13 authored poses (the 1032 set) READ against fill-r1:

- `vale-descent` / `vale-narrows`: the sponge's traffic-cone red is
  gone (olive-tan reads as growth), the runner leads in overhead, moss
  track + beams land. **Still fails on the T1 read**: the moss/turf
  cards read as near-black violet stubble on tan ground — the value
  pass moved them a step and the region's dim sun plus the toon shade
  band eats the step. Roots are still violet-dark; the ground between
  the moss track and the walls is still bare warm sand.
- `vale-reveal`: composes; the bare right dune is the lip crest rest.
  The sward band reads only faintly — the doorstep is tan-olive, not
  green. Marginal.
- `meadow-hills`: transformed — grass, sward patches, violet jellies ✓,
  stands, erratic, far ring. But between swards the ground is mustard
  and the T1 chips read as sparse dark specks.
- `forest-eaves` / `forest-aisle`: treeline + beams + skirts + wayside
  grass ✓; the foreground floor band is still broad olive-brown with
  speck litter — bigger litter landed but its value is still low.
- `elder-serpent`: skirts + orange litter chips + motes compose; the
  serpent reads as a sparse dotted line at this settle (accepted —
  the pilot's own backlight note).
- `canopy-up`: passes — pads + crowns + grazers close most of the sky.
- `canopy-breach`: pads + shaft + pool read; the far "sea of crowns"
  is still a flat teal band along the sightline. Watch item.
- `sunwell`: passes — lush bowl, rim band, bright shaft.
- `root-maze`: passes — spars drooped ✓, wine bushes deep ✓, glow
  paled off lime ✓, arch/hubs/wreck/debris compose in violet.
- `weaver-grotto`: passes (marginal) — weaver at the mouth, tapered
  spar ✓, lanterns lifted ✓; silt shards still read dark.
- `falling-edge`: passes — turf, stones, bushes, pale beam, open pass.

### Round-2 sweep (`fill-r2`, 12/12 captured)

- **01 PASS** (marginal) — kelp stalk left, sparse grass mid, ring +
  headland far; most of the floor bare tan.
- **02 PASS** — bright grass tufts near (the value pass reads here),
  kelp forest middle, ring far; left half bare.
- **03 FAIL** — bare olive-mustard swells to the horizon, turf specks
  read as dirt. Outer meadow flank.
- **04 FAIL** — broad tan slope, headland + cards far, nothing < 8 m.
- **05 FAIL** — mustard floor, eave silhouettes + beams middle-far,
  foreground bare.
- **06 PASS** — trunk + limbs + gold litter chips foreground (the
  litter fix reads), boulder mid, arch far.
- **07 PASS** — swarded green swell with chips + a jelly + spar
  silhouettes; where the sward paints, the world is green.
- **08 FAIL** — the bare tan plain again, wreck silhouette far.
- **09 PASS** — boulder trio + spar + kelp crest.
- **10 PASS** (weak) — grass + orange/violet chips + trunks; floor
  still 3/4 broad olive-brown.
- **11 FAIL** — shelf lateral: boulder mid + crest far, bare tan
  foreground.
- **12 FAIL** — one green-mottled tan dune fills the frame; no
  foreground interest, distance a sliver.

**Verdict 6/12** — up one from round 1, still far off ≥11/12; no miss
in a registered rest. The pattern is now exact: every PASS stands on
sward-painted or authored ground, every FAIL on the base disc where
`bakeVerdantPaint`'s off-sward multiplier is (0.95, 0.99, 0.62) —
bare warm sand — and the turf cards (1 per ~69 m²) are dark specks
that read as dirt. With the budget at 444,992/450k, instances cannot
carry the inter-zone floor. **Round-3 orders (a paint round, ~free)**:
(1) green the base itself — cut red off-sward so no square metre of
owned disc reads mustard, deepen sward patches to match, keep the
maze/Sunwell/edge overrides; (2) lift every carpet family's root
shade off violet-black (the cards read at speck size by colour alone,
so roots go olive, tips stay bright); (3) mid-violet the maze
shard/silt values a step so foreground chips read as growth, not
soot; (4) canopy-breach's far crown band: pad cards value/size nudge
so the "sea of crowns" breaks the teal.

## Rework round 3 (`fill-r3`) — the paint round

All four round-2 orders landed: `VerdantGround`'s off-sward base went
green (the mustard multiplier cut its red), the vale walls greened
further and the lip deepening eased; every carpet root came off
violet-black onto olive; the maze silt/rubble values stepped up to
mid-violet; the canopy pads grew a size. Authored set READ: the disc
reads as a green sea-meadow at last — `meadow-hills`, `vale-*`,
`forest-*`, `sunwell`, `root-maze`, `weaver-grotto`, `falling-edge`,
`canopy-up` all pass; `canopy-breach`'s crown band breaks the teal
now (watch item closed).

### Round-3 sweep — 6/12, same shape, new lesson

Frames 03/04/05/08/11/12 still fail, but differently: the ground under
them is GREEN now — the paint answered round 2 — and still nothing
STANDS within the near ring. Colour was never the whole miss: a 0.5 m
turf card vanishes past ~8 m, and the flanks (|v| ≈ 90–180), the edge
shelf (u > 600) and the saddle mouth (u < 300) own no taller family at
all. **Round-4/5/6 orders**: a knee-high tussock family (tufts, not
cards) leaned toward exactly that ground; grow the turf again; carry
the shell scatter as far out as the poses actually stand (08 stood at
u 631 — past the edge area polyline's own END at 616, an area/gate
argument the gate lost); pay for all of it with trims where the sweep
already passes (moss, sward, silt, maze rubble).

## Rework rounds 4–6 (`fill-r4`–`fill-r6`) — things that stand

- **Flank tussocks** (new family, `SEED ^ 0xf119`, tuft profile,
  0.55–1.05 m): 340 → 430 across the rounds, gate leaned toward the
  outer flanks (|v| beyond ~70) and — round 6 — the saddle mouth
  (u < ~300), the two bands whose near layer nobody else shares.
  Test pin grew to 9 carpet families.
- **Turf** 2,800 → 3,600; **shells** 800 → 960 and grown to
  0.16–0.32 m (a speck at 1.2 m eye height was the 08 read), edge
  area polyline extended 616 → 652, gate fade carried to u 634+.
- **Paid by**: moss 2,300 → 1,850, sward 3,000 → 2,700, silt
  1,500 → 1,300, litter 1,050 → 980 ×2, maze rubble 500 → 420.
- Budget after r6: **110 draws / 449,792 tris** — 208 under the cap.

Risk-pose retakes (05/08/11/12): 11 passes cleanly (tussocks + spars
mid, kelp far), 05/08 marginal (standing growth arrived but the near
band still reads thin), 12 still a bare green dune. 9–10/12 honest.

## Rework round 7 (`fill-r7`) — the camouflage and the outward stare

Two findings, both structural:

1. **The turf had converged with its own floor.** The r3 paint pass
   and the turf palette had arrived at the SAME greens — 3,600 cards
   stood on the disc and vanished into it. Tips went a value brighter
   (0xb4cc78 → 0xcfe084), roots a value darker (silhouette against
   the paint), cards a hand taller (0.3–0.6 m). Free — the count
   didn't move. This was 05/08/11's remaining thinness in one change.
2. **Sweep 12 faces OUT of the region.** The pose stands at
   (u 276, v −30) — restFree = 1.00, NOT the crest rest, whose window
   hugs the channel centre at v ≈ +3 — and stares along a ray where
   `verdantWeight` dies within ~45 m (0.98 at 5 m, 0.07 at 60 m).
   Only ~35 m of what it sees is ours to fill, and a global scatter
   of a few hundred tufts cannot promise a narrow cone anything
   (counted: 14 tussocks within 30 m, ~0–3 in the cone). Answer: a
   **saddle-mouth stand** — 130 tufts of the same tussock growth
   concentrated on the mouth's off-channel flanks (disc at u 268,
   v −42, r 55; gate verdant × channel-free × restFree; fresh
   substream `SEED ^ 0xf11a`). Counted before capturing: 56 of 130
   land in pose 12's view cone inside 45 m. Test pin: 10 families.
   Paid by silt 1,300 → 1,100, sward 2,500 → 2,400, litter 950 ×2
   (an over-cap measurement at 450,552 caught and walked back).

Retakes: **05 PASS** (tussocks stand across the near/mid ring),
**08 PASS** (shells near and mid on the decrescendo, wreck far),
**11 PASS**, **12 PASS** (the stand lines the dune crest; headland
and kelp carry the far). Budget: **111 draws / 449,912 tris**.

## Rework close (`v1-filled`) — the final sets

All three sets captured fresh on the final code and LOOKED AT:

- **Authored (13 poses)** — all pass. The vale is a green moss road
  with pink pebbles and standing tussocks; the narrows' cards read as
  growth (roots silhouetted, tips lit); the meadows carry bright
  grass, chips, jellies, the erratic and the far ring; the forest has
  its litter seasons, wayside grass, fry and beams; the Sunwell bowl
  is lush with its rim band and shaft; the maze composes in violet
  with gold chips, glow, arch and wreck; the grotto keeps its weaver
  (the capture even scored a find); the edge does its turf-and-stones
  decrescendo under the pale beam. `canopy-breach`'s far crown band
  breaks the teal (round-2 watch item closed). `vale-reveal`'s bare
  right dune is the lip crest rest, composed as intended.
- **Sweep (12 seeded poses) — verdict 12/12.** 01 and 08 are the
  quiet passes (kelp-stalk flank; the edge decrescendo, quiet by
  design) — both carry three layers. No miss anywhere, so the
  "misses only in registered rests" clause goes unused. The seeded
  poses recur round to round; the verdict is comparable with r1's
  5/10, r2's 6/12 and r3's 6/12.
- **No-assets (13 poses)** — the fallback build holds: same
  composition, fill and layers with generated stand-ins, no black
  materials, no missing draws.

### Budgets, before → after the fill

| | draws | triangles | caps |
|---|---|---|---|
| pilot close (before) | 65 | 248,711 | 80 / 260k |
| fill r1 | 108 | 439,018 | 160 / 450k |
| fill close (after) | **111** | **449,912** | 160 / 450k |

Measured programmatically (the region test holds the caps; an
over-cap state at 450,552 during round 7 was caught by measurement
and walked back before any capture).

### Flags carried out of the rework

- **F-R1 (budget headroom)**: the region closes 88 triangles under
  its cap. Any future fill must trade, not add — the carpet counts
  in `VerdantCover` are the intended trading stock (the round 4–7
  history shows the going rates).
- **F-R2 (kit clump scatter)**: `carpetField` hardcodes
  `perClump: 26` with a 0.3 loose share; a global family cannot
  guarantee ANY random view cone an instance (round 7's sweep-12
  lesson). Regions with sweep-critical bands should author
  concentrated stands, as done here; a kit-level `looseShare` knob
  would make this cheaper.
- **F-R3 (outward-facing poses)**: sweep poses drawn near the rim
  can face out of the region and see mostly unowned seabed; the
  three-layer answer must live in the first ~35 m. Worth a MASTER
  note for other regions' fills.

---

# R12.3 QUALITY RE-PASS — the fill made worth looking at
# (`repass/verdant-line-1`, MASTER R12 + kit/quality-pass)

The verdict this answers, verbatim: *"it still feels super
underwhelmingly empty, or at least what's been added is not so great —
some kind of half-cut grass everywhere, doesn't seem like an added value
at all."* The kit re-authoring (docs/region-ledger/kit-quality-pass.md)
provides the craft; this pass consumes it. Budgets are R12's
≤260 / ≤1.35M, gated by the headed frame measure (median ≤16.9 ms at
scale 1.00 at the densest pose).

## The reroll fence, restated

Profile swaps and richness opt-ins re-roll THOSE FAMILIES' own buffers —
expected and honest, the swap is the point. Everything else (landmarks,
kelp, weaver, all pilot systems, all other fill streams) is
byte-unchanged: every new draw is `SEEDS.regionVerdant1 ^` a fresh
`0xf21x`/`0xf22x` constant appended after all existing draws, and the
test pins (first/last giants, the weaver's haunt, to nine decimals)
still hold.

## What changed (round 1)

1. **Profile swaps** — turf / sward / tussocks / saddle stand / ring rim
   → `"blade"` (48-tri S-bend clumps); vale moss / forest litter ×2 /
   maze silt → `"frond"` (60-tri cupped rosettes; the litter's drooped
   straps read as curled shed leaves). The Falling Edge shells KEEP
   `"card"` deliberately: they draw chips, not plants — a flat bent quad
   at 0.16–0.32 m is a shell's own silhouette. (No farGrassCards in this
   region, so no nearFade case exists to guard.)
2. **`sunGlow`** on the sunlit families (moss, turf, tussock, saddle,
   sward, ring rim, and the new stands); withheld from the maze silt
   (half-light register) and the litter (dead leaves don't glow).
3. **`looseShare`** raised on the sweep-critical broad-disc families
   (turf 0.55, tussocks 0.5, sward 0.4 — the F-R2 field note); the
   saddle-mouth stand keeps its default: concentration was its fix.
4. **Bush richness** — all six banks opt into `fronds`/`accents` on
   their own accent inks (spring berries, olive-gold buds, wine thorn
   knots, pale buds, Sunwell gold); wine takes the sparsest fronds
   (dead scrub is thorny, not leafy).
5. **Litter upgrades** — `grade` on the vale/meadow pebble runs (0.55 /
   0.5) and maze rubble (0.65); a NEW maze `"split"`-stone run (160,
   graded 0.6) for formed foreground rock.
6. **Headroom spend (new families, fresh streams)** — holdfast
   skirt-grass collars (380 blades ringing every giant's foot), forest
   ferns (650 fronds between the trunks), vale road-edge stands
   (300 thigh-high blades lining the channel), aisle wayside stands
   (260, the swim line's shoulders); the holdfast skirt itself deepened
   to nine fingers + five inner knuckles (~340 tris, was ~208).
7. **Four new close poses** (`close-vale-road`, `close-meadow-sward`,
   `close-forest-floor`, `close-maze-floor`) — camera ~1.4–1.5 m up,
   pitched down, judging the fill at the distance the owner judged it.
8. **Test caps updated honestly**: measured **116 draws / 1,141,270
   tris** (fill close was 111 / 449,912) → caps 130 / 1.25M, floors
   100 / 900k.

## Round 1 (`rp-r1`) — critique, close poses judged hardest

16/17 poses captured on the loaded machine (close-maze-floor timed out;
retaken in round 2 — the seeded poses recur, the verdict is honest).

- **The profile swap works**: everywhere a blade clump or frond rosette
  is close enough to read, it reads as a PLANT — S-bends, cupped
  straps, tip taper. `falling-edge`'s turf blades and the aisle/wayside
  stands in `forest-eaves`/`forest-aisle` are the proof; `sunwell`
  passes outright (meadow + ring-rim blades, lush bowl).
- **`close-vale-road`**: moss rosettes + graded pink pebble drifts read;
  road-edge stands line the banks. FAILS on coverage: the road is still
  mostly bare green paint between rosettes — 1,780 fronds over a 200 m
  road is a rumour, not moss.
- **`close-meadow-sward`**: the pose's own floor is nearly EMPTY — the
  sward hugs its crests and the turf's raised looseShare (0.55) spread
  the clumps so thin locally that nothing owns the near metre. The few
  blades in frame read beautifully; there are not enough of them.
- **`close-forest-floor`**: wayside stands pass; litter fronds read as
  dark specks (value), ferns nearly invisible against the floor paint
  (value + count).
- **`root-maze` / `weaver-grotto`**: the violet silt fronds sit almost
  exactly at the ground paint's own value — the bloom vanishes; the
  split stones can't carry a bare frame alone.
- **Value, the old lesson again**: the kit families were re-judged on
  the kit's bright demo stage; under this region's dim sun (0.12) every
  small frond/blade drops toward silhouette. The families that read are
  the BIG ones (stands, skirt grass) — size is value here.

**Round-2 orders**: (1) value pass — lift silt/moss/litter/fern
bases+shades a step, brighten turf/sward roots off dark olive; (2)
density where the close poses stand — moss 1,780→2,200, turf
3,600→4,200 with looseShare back to 0.45, sward 2,400→2,750, ferns
650→800, silt 1,100→1,300 and sized up, stands 300/260→380/320, skirt
grass 380→430, split stones 160→200; (3) grow silt size to [0.2,0.4] so
the maze bloom stands off its own floor.

## Round 2 (`rp-r2`) — critique (all 17 poses, close judged hardest)

Measured **116 draws / 1,242,990 tris** after the round-2 orders.

- **`close-vale-road`**: the road reads as a mossy pebbled lane now —
  rosettes green and legible, graded pink drifts, stands on both banks.
  Marginal PASS on the "painted plants" bar; one more moss notch would
  not hurt but is not owed.
- **`close-forest-floor`**: PASS — golden litter curls, green fern
  rosettes, wayside blades, the orange rake mark; the floor has its two
  heights and its seasons.
- **`close-meadow-sward`**: still FAILS — the value lift worked (the
  blades in frame read as plants), but the pose's near metres sit in a
  turf hole and the inter-sward ground still reads MUSTARD under the
  warm wash. Instances cannot out-paint the paint (the fill-r3 lesson,
  round 2 of learning it).
- **`close-maze-floor`**: FAILS — the silt value lift reads (pale
  violet rosettes are plants now), but the pose stares at a ridge mound
  the 0.3-baseline gate left bald; the split stones pooled elsewhere.
- Authored set: `vale-descent`/`vale-narrows` green road arcs work;
  `meadow-hills` mid-frame still broad mustard with specks;
  `root-maze` foreground still bald on its ridge; everything else
  holds its r1 read or better.

**Round-3 orders**: (1) cut the base paint's red again (0.74 → 0.66
off-sward) — no square metre of the meadows may read mustard at
swimming distance; (2) turf 4,200 → 4,800 and a touch taller; (3) the
silt gate's ridge baseline 0.3 → 0.45 (a maze floor is never bare,
just thinner uphill), silt 1,300 → 1,450, split stones 200 → 260.
