# verdant-line-2 — THE EMERALD TERRACES (the first depth-2 region)

Region worker ledger. Slot `verdant-line-2`, province The Verdant Line,
depth 2 — no gateway wing; the inbound connection is an inter-region
pass from the Great Kelp Sea's far rim. Disc centre r = 940 on azimuth
1.35 (world ≈ (206, 917)), radius 220. Seed `SEEDS.regionVerdant2`
(0x5a4d_0c02) and `^` substreams only.

## Concept

Deeper, older, stranger than the kelp sea. A drowned cliff country:
great stone terraces stepping down through green mist, hanging gardens
spilling over every ledge — vine-fall ribbon curtains, drooping
fern-kelp, moss turf — water thicker and greener than the forest's,
light arriving in long diagonal blades. The country remembers being
built: the Cistern's rim ring and the Balcony's balustrade are worked
stone; everything else has grown over the memory.

The whole region descends: threshold ≈ 0 m → stair foot −27 → gardens
−22..−31 → Cistern floor −34 → Mistfall basin −45.5. The rim of the
disc climbs back to dune level (the framework's identity contract), and
that rampart is authored as what it is — the High Rim, the oldest
terrace wall, painted in stacked ledge bands with a milky crest.

## The depth-2 pass (the first inter-region connection)

The Great Kelp Sea's disc ends at r ≈ 665 on the spoke; ours begins at
720. The pass tongue is authored `approachTongue("verdant-line-2",
{ fromR: 635, toR: 780, halfWidthFrom: 16, halfWidthTo: 56 })` — it
starts **30 m inside verdant-1's rim**, so the two domains genuinely
overlap and the bounds handover has no gap (asserted in
`tests/regionVerdant2.test.ts`: both weights > 0 on the spoke between
635 and 665, and our weight > 0 continuously along the spine 636–780).

Three authored bands:

- **The Threshold** (u 635–738): a milky crest shelf at dune level. Our
  weight is deliberately a whisper (0.14, the *threshold gate*) so the
  kelp sea keeps carrying the water, mood and terrain across the
  overlap; we own only the bounds. The gate also hides the framework's
  terrain-reject circle (`RegionField` consults a depth-2 region only
  within `radius + 40 = 260 m` of its centre — u ≥ ~680): out there our
  terrain target is held at dune level (asserted), so the step at the
  reject circle is centimetres.
- **The Emerald Stair** (u 738–845): the pass is a place — eight great
  steps down ~25 m in a walled cleft, ledge gardens deepening step by
  step, slab lips on alternating sides, curtains thickening with depth.
- **The country** (the disc).

## Sub-biome map (spoke coordinates: u along azimuth 1.35, v lateral CCW)

| Sub-biome | Where | Floor |
|---|---|---|
| The Threshold | u 635–738 along the pass | +0.2 → −2.2 milky shelf |
| The Emerald Stair | u 738–845, walled cleft ±10–16 | 8 × −3.1 steps → −27 |
| The Hanging Gardens | disc heart, terrace field (edges at tc 10/44/82) | −22 → −31 |
| The Cistern | (925, +68) r 46 | −34.2 mirror floor, +1.6 worked rim |
| The Fern Vault | (900, −85) r 48 | −30.2, authored stone ceiling −22.6 |
| The Mistfall basin | lip u ≈ 998, basin u 1010–1090 | lip −31 → basin −45.5 |
| The Far Balcony | (1055, +42) r 30 | −26.5 worked terrace over the deep |

Vertical range across the disc ≈ 45 m (stair-flank crowns ≈ −1 → basin
≈ −46.5; test holds ≥ 30 and lowest ≤ −41.5). Ceiling: 3.8 m at the
threshold (meeting the kelp sea's closed rim), vaulting to 12 down the
stair, easing to 6 over the deep country, −22.6 under the Fern Vault's
stone shelf, closing to 3.4 at the far rim (gated off the pass).

### The domain, and how it is sealed

Weight = max(slot disc, pass tongue × threshold gate). The rim ring
(92 stations of two-sphere stacks at rc 198) is gated open over the
pass corridor (`passGate`); the pass shoulders take rows of stacked
spheres (u 656–800, both flanks, never pinching the corridor tighter
than ±20.5). The threshold's mouth needs no seal: behind it the Great
Kelp Sea's own domain and walls take over — that is the handover.

## Landmarks (reveals every 30–60 m along the swim)

1. **The Rim Sentinel** — a lone worn stack on the threshold (672, −6),
   the first thing of ours the fog gives up.
2. **The Emerald Gate** — two worked jamb stacks flanking the first
   riser (u ≈ 735), moss-draped.
3. **The Emerald Stair** — the eight-step descent itself, slab lips and
   ledge gardens alternating sides.
4. **The stair-foot overlook** — the great boulder at (851, −11) where
   the terrace country opens in one breath.
5. **The Slab Bridge** — a fallen terrace sheet spanning the second
   garden riser (≈ 875, −35), swim-under at its middle.
6. **The Curtain Grotto** — a dense vine-fall over a slab-roofed hollow
   (893, 26); the Terrace Warden patrols through its part.
7. **The Cistern** — ten worked stones (two fallen) evenly ringing a
   mirror-flat bowl; a great diagonal fall of light lands in it.
8. **The Fern Vault** — giant serrated ferns under a stone shelf on
   pillars, moss-lanterns in the half-light.
9. **THE MISTFALL** — the region's landmark: a slow waterfall of silt
   pouring 14.5 m off the great lip into the basin, framed by two horn
   stacks; composed from above (the lip) and below (the basin).
10. **The Far Balcony** — a worked terrace jutting 19 m proud of the
    basin, balustrade slabs and two framing stacks, looking into the
    painted cliff-lines that promise depth 3.

## Life

- **Spore-motes** (520 points) drifting through pass and gardens.
- **The spill shoal** (62 pale green-silver fish) — the signature
  behaviour: one closed line that hugs a stair tread, pours over the
  lip, falls nose-first down two riser faces and climbs back — a shoal
  behaving like spilled water.
- **The garden-dwellers** (34 rose-gold fry) hovering *in* the grotto's
  curtain, warm sparks in green.
- **The turtle procession** — the moving centrepiece: four great slow
  turtles (moss shells, gold rim scutes, violet plastrons) grazing the
  gardens ledge by ledge on one closed 12-station circuit; following
  them is the tour.
- **Cushion stars** (24, violet-rose/emerald/coral) on treads and rim.
- **THE TERRACE WARDEN** — the findable resident (`terrace-warden`,
  *Custos pensilis*): a newt-bodied axolotl-headed spirit, moss-dappled
  jade with a gold gill-crown, patrolling a closed figure through the
  grotto curtain's part. Live-posed tube + tail fin + six frill strips;
  codex entry in the def's pure half; DiscoveryTarget at the curtain's
  part, crossed by the head twice a loop.

## Budgets (measured programmatically; tests hold the caps)

- Draw calls: 40 (cap 120)
- Triangles: 189,862 (cap 250,000)
- Colliders: 297 (floor 100 asserted; all inside the domain)
- Instancing: turf (1 draw), turtles, spill shoal, dwellers, stars,
  moss-lanterns, distance pillars; curtains/ferns merged per area
  chunk; stones merged per material family (3 draws).

## Seeds

`SEEDS.regionVerdant2` (0x5a4d_0c02) with `^` substreams: terrain
0x7e01–0x7e06, ground paint 0x5adf/0x517b/0x70af, stone 0x50c9 +
0x0a01–0x0ae1, gardens 0x1e11/0x51ac/0xca9f/0x9eae/0x9e38 + textures
0x1e12/0xb1ae, mistfall 0x30a8–0x30aa, light 0x11f8/0x90f2/0x90f3,
life 0x40e7/0x5a03/0x5a04/0x70b1/0x57a6, warden 0x0ee2, distance
0xd158/0xd300+. Runtime updates spend no randomness (the pilot's rule,
kept) — captures settle deterministically.

## Critique history (silhouette → value → colour → detail, per round)

### Round 1 (`terraces-r1`) — bones half-present, drama an order of magnitude too small
Silhouette: the *idea* survives only in three frames (grotto+warden+dwellers
compose; fern vault's pillars-under-shelf reads; slab bridge reads). The
rest fail their own subjects: **emerald-gate is an empty frame** (jambs at
v ≈ ±10 sit outside the pose's frustum, the first riser melts into dune);
the stair reads as a smooth vale (3.1 m risers spread over 4.6 m runs,
sampled by a 2.2 m grid, read as swells); the garden terraces don't exist
to the eye (3 m drops over 6.5 m runs); **the Mistfall is a glass box
standing on a flat plain** — `mistfallDrop` spreads 14.5 m of fall over
16 m of run (a 42° slope, not a cliff), and the curtains are placed at
fixed u ≈ 999.5 while the authored lip meanders to u ≈ 1005 at the fall's
own v — the fall stands uphill of its own cliff; mistfall-below is a bare
hillside filling the frame. The Cistern's ring stones (1 m radius, 22 m
apart on a 72 m ring) read as pebbles on a horizon; no mirror. Value: the
distance rings are inked at fog×0.77 — from the Far Balcony the promised
depth-3 country reads as **a flat wall of fog colour**; ground value is
one washed mid tone everywhere. Colour: ground beige-olive (the authored
green tints sit under the warm sand wash — the pilot's round-2 read,
repeated); water teal rather than emerald. Detail: curtains are 2–5 m
ribbons in a 260 m country — sticks, not hanging gardens; turtle shell
reads brown; light blades/pool invisible at their authored opacities.

Round 2 orders (silhouette first): sharpen every riser (stair run 4.6→2.8,
terrace run 6.5→3.6 with drop 3.0→3.6, mistfall run 16→7); move the fall,
its horns, grains and billows onto the *local* lip via a shared
`mistfallLipU(v)`; grow the gate jambs and re-aim the pose from u 712;
grow the Cistern ring stones ~40% and tighten the ring; ink the distance
rings darker (fade 0.42/0.6/0.75 → 0.22/0.42/0.6) and raise their tops
above the rampart sightline; double the garden curtains' length and
thicken their runs; grow the vault giants 4–6 m → 6–9 m; darken riser
paint and make the Cistern floor a dark mirror instead of pale jade.

### Round 2 (`terraces-r2`) — the cliff pours, the distance arrives, the gate still hides
Silhouette: the Mistfall is *fixed* — from below it reads as a pouring
milk curtain between two horn silhouettes over its own cliff; the
distance rings finally read from the Far Balcony (a stepped mesa skyline
over the rampart — the depth-3 promise exists); the Fern Vault composes
(giant serrated ferns under the shelf, gold motes); the balcony's
balustrade and framing stacks read. Still failing: **emerald-gate** — the
grown jambs stand at v ≈ ±10 *inside the stair's wall slopes* and
camouflage against them (same warm rock over same bank); the stair from
mid-descent still reads as a smooth vale because each tread hides the
next riser and the curtain runs are too sparse to draw the lip lines;
**turtle-terraces framed no turtle** — the procession's phase rides
wall-clock time, which is not pose-stable between runs, so a pose aimed
at one circuit point is a coin toss; mistfall-above stands behind a
ground swell and sees the curtain as a billboard, not the drop; the
cistern pose stands *inside* its own ring (near stones out of frustum,
far stones pebbles). Value: curtains and grotto drape read near-black
(tone families too deep for this water); mirror floor now dark but the
light pool is a faint smudge. Colour: ground still olive-beige on the
treads — sward not cutting red hard enough; turtle shell reads brown.
Detail: spill shoal photobombed gardens-vista beautifully (kept); billow
foot invisible under the curtain.

Round 3 orders: jambs into the channel (v ±(half−3)) in the cool deep
family so they stand against the banks, pose pitch down; both-sides slab
lips per step; curtain tones up a value step, ribbons wider (0.3–0.55),
hem floor raised; procession to six turtles and the pose re-aimed along
a quarter of the circuit; mistfall-above onto the lip shoulder at
(1001.5, −8); cistern pose out to d ≈ 52 with a taller lift; pillar
cards taller and inked harder; sward red cut to 0.5, mirror pool
brighter; turtle shell to moss.

### Round 3 (`terraces-r3`) — the gate mystery solved by probe, not by guessing
The pose fixes landed: the Cistern ring finally *frames* (near stones in
frustum, grown stacks, light shaft + pool on the dark mirror); a turtle
grazes through turtle-terraces (six on the circuit now, moss shell, gold
rim); mistfall-below composes (horns, pour, billow, a turtle in the
basin); fern-vault and grotto hold. **The Emerald Gate still rendered
empty, three rounds running — and the reason was none of my guesses.**
A live-browser probe (throwaway playwright script; raycast + red-paint
A/B) proved the jambs exist in the drawn mesh (raycast hit at 10.7 m),
are not frustum-culled, and *still* never reach the frame: **verdant-1's
far-side distance ring — an opaque, fog-coloured, `fog:false` curtain at
its rc 288, which crosses our pass at spoke u ≈ 733 — stands between
every u < 733 camera and everything behind it.** My own flags section
had already documented the ring crossing at u ≈ 691–731; what round 1–2
missed is that it isn't a "brief flat-card moment", it is a wall that
eats the whole Emerald Gate composition. I may not edit verdant-1, so
the *gate moves*: jambs to u 747/749 (past the ring and the first
riser), pose to u 735.8 — inside the ring, doorway framing the descent.
Remaining value/colour notes: mistfall-above's re-aim planted the camera
against the south horn (half the frame is one violet-orange boulder —
the deep stone tint reads purple against the rust wash; recolour cool
green-grey); the balcony's pillar cards still hide below the rampart
sightline — the depth-3 promise needs its own *near* cluster beyond the
balcony; garden curtains at distance read as dark stumps — the riser
faces themselves must carry hanging-garden streak paint; grotto drape
hems still near-black; fern-vault floor bare violet mud.

### Round 4 (`terraces-r4`) — the gate stands, the promise towers
Silhouette: **the Emerald Gate finally exists** — two monumental cool
stacks framing the descent, turf and curtains between, the terrace
country glowing beyond; **the Far Balcony vista is transformed** — the
new near pillar cluster (basin sector, rc 132–172, heads breaking the
rampart line) reads as a drowned mesa city beyond the rim, exactly the
depth-3 promise the mandate asks for; mistfall-above finally *is* the
top of the falls (lip shoulder, pour plunging left, horn right). Fails:
**the cistern pose planted the camera against the nearest ring stone**
(half the frame is one flat stone face); stair-descent still reads as a
vale — from mid-channel the treads hide their own risers, so the pose
must climb the flank wall and take the staircase in profile; the fall
curtains show their plane edges (the vertex-colour fades darken to
black instead of fading out — a brightness step against the fog);
gardens-vista's terrace country still reads as one value plane from
above (riser faces invisible from uphill; the treads need a per-tread
value step and crest fringes). Value: jambs read near-silhouette
(accepted as backlit drama, but the deep family gets a half-value
lift); grotto hems finally colours, not blacks (emissive floor). Colour:
water leans emerald now; vault litter reads; deep stone no longer
purple. Detail: balcony cluster heads photobomb mistfall-above's sky as
floating chimneys — sector narrowed away from that sightline.

Round 5 orders: curtain alpha fade (alphaMap carries the edge/head/foot
fades; vertex colour keeps only the streak values); cistern pose out to
d ≈ 60; stair pose onto the flank crest at (768, −13) for the profile
read; per-tread value step + turf fringe rows along the garden contour
crests; deep stone value up (0x6a7a6a); balcony cluster sector 0.34±0.38,
heads ≤ 44 m.

### Round 5 (`terraces-r5`) — three broken cameras, one washed gate
Silhouette: mistfall-below is *the* fall now — the milk curtain with its
alpha-fade edges pouring between the two lip horns, grains riding it;
far-balcony holds its drowned-city promise; fern-vault, curtain-grotto
(the Warden mid-round with a turtle passing), slab-bridge and
pass-threshold all ship-worthy. Fails, and they are pose fails:
**cistern is a solid violet frame** — (880, 26) stands the camera
straight into the gardens→basin riser face (its viridian-violet paint
is the whole screen); **mistfall-above is a wall of close ground** —
pitch −0.44 with lift 4.0 at the lip fills the frame with the shoulder
underfoot; **emerald-gate is washed white** — the jambs stand (the
r4 move worked) but the Cistern's great light-blade and mirror-pool
are `fog:false` additive marks, and the R5 width/opacity boost made
them a *cross-region* glow: with a clear sightline down the stair the
gate camera catches ~150 m of unfogged bloom. Value: stair-descent's
profile read works at the treads, but the frame's midline is my own
distance ring seen dead-on — one flat teal band with a razor edge.
Colour: sward/riser split reads; turtle shells mossy. Detail:
gardens-vista still too horizon-hungry — lift 3.4, pitch −0.07 stares
at the fog band instead of down the terrace field.

Round 6 orders: light discipline completed — blades *and* pool get a
camera-distance fade in `onBeforeRender` (unfogged additive marks must
die by ~120 m or they wash every distant frame); cistern pose into the
bowl itself (inside the ring, low over the mirror floor, looking across
the pool to the far stones); mistfall-above up and back (lift ~7,
pitch ~−0.3); stair-descent pitch down so terrain owns the midline;
gardens-vista raised (lift ~7, pitch ~−0.2) to look *down* the field.

### Round 6 (`terraces-r6`) — the light learns its range
Silhouette: **emerald-gate ships** — the wash is gone (the light
discipline's missing fourth part: `fog:false` additive marks now carry
a camera-distance fade, dead by ~120 m, in `onBeforeRender` alongside
the edge-on fade) and the jambs stand clean over the descent with turf
and curtain rows between; **cistern ships** — from inside the bowl the
mirror floor runs to the rim, the light-pool glows mid-frame, ring
stones and the fallen pair silhouette on the rim line; **mistfall-above
nearly ships** — lip crossing the frame diagonally, the milk pouring
over it, the north horn standing right, mesa-city pillar cards floating
behind — but the south horn's flank (v ≈ −1, five metres off the
camera's nose) eats the left quarter. Fails: **stair-descent is still
one teal band** — the deeper pitch wasn't the cure; from the flank
crest every tread lives beyond the fog's value-merge distance, so the
pose must get *on* the stair and shoot close and steep; **far-balcony
came back as a void with the wrong HUD** ("Find the hidden moray
0 / 1") — a capture-harness state glitch on the set's last pose, not
the region (r5's frame from the identical spec was sound; re-roll and
verify). Value: gardens-vista finally layers — foreground boulder,
winding shoal, grazing turtle, curtain rows on the far crest. Colour
and detail: fern-vault, curtain-grotto, slab-bridge, turtle-terraces,
mistfall-below, pass-threshold all hold.

Round 7 orders: mistfall-above camera to v 4 (past the south horn's
shoulder); stair-descent onto the stair at (774, −10), lift 4,
pitch −0.34, subject inside 30 m; re-capture and verify far-balcony.

### Round 7 (`terraces-r7`) — every frame reads; the loop closes
Silhouette: **mistfall-above ships** — the south horn cleared the
frame (camera to v 4), the milk pours wide over the diagonal lip, the
north horn holds the right, the mesa-city cards hang over it all;
**far-balcony re-rolled sound** — r6's void was the harness state
glitch it looked like (wrong HUD, "hidden moray"), not the region.
Stair-descent from on the stair: the near treads step down with their
dark ledge slabs, kelp tufts on the flanks, curtain rows on the far
crest — the teal band beyond is the region's own water closing the
vale, which is the "deeper country" the mood is authored to say;
accepted. Value: cistern's mirror floor, pool and rim silhouettes
hold; emerald-gate holds clean. Colour and detail: all twelve poses
read — nothing empty, nothing flat-carded, nothing unpainted.
Measured budgets recorded above (40 draws / 189,862 tris / 297
colliders). Loop closed after seven rounds; on to gates and finals.

### Finals (`terraces-final`, `terraces-final-noassets`)
Gates green: typecheck clean; eslint (regions + region test, zero
warnings); the six required suites 74/74; ONE full `npm test` 553/553
across 49 files. Both final sets captured against the verified
port-5189 server and *looked at*: the twelve `terraces-final` frames
match round 7 exactly, and the `-noassets` procedural-fallback set
renders every pose (gate, stair, gardens, bridge, turtles, grotto,
cistern, vault, both mistfalls, balcony, threshold) with nothing empty
and nothing flat.

## THE FILL REWORK (Phase 3, Batch 1 — `rework/verdant-line-2`)

Executed against `docs/fill-plans/verdant-line-2.md` under FILL-DOCTRINE
and MASTER (R1 caps 160/450k; R4 verified from this side; §1.2 rests
held). Item 1 first: caps raised and reroll-fence pins added — the Rim
Sentinel, gate jamb, mistfall horn, a Cistern ring stone and the
Warden's beat pinned byte-exact, and every fill substream is
`SEEDS.regionVerdant2 ^ 0xf1xx–0xf9xx`, appended after all pre-fill
draws. New fill contracts in `tests/regionVerdant2.test.ts`: pass
channel swimmable u 636–810 (three swim heights, every collider),
threshold-runner route inside the corridor and >1 m clear of every
seal, milk-sheet additive discipline (fog:false, depthWrite off,
opacity ≤ 0.2, range fade), mesa-card feet ≤ −44, registered rests
empty of every instanced kit scatter, riser-strip byte-determinism.

### Fill round 1 (`v2-fill-r1`) — the roads exist; two drifters caught red-handed
Silhouette: **pass-threshold transforms** — turf islands, waymark pairs,
worn stacks, shell pebbles and the milky→celadon carpet carry the eye to
the sentinel; three layers stand where the audit's "three objects on
100 m" was. **emerald-gate**: jambs finally DRESSED (9 full drapes each),
glow moss at their feet, worked shards and turf between. **slab-bridge /
turtle-terraces**: liaison fry cross the walk, crabs sit the slab lips,
garden bushes and fringe turf draw the treads. **mistfall-above ships
its milk** — the kit fallStreak sheets read as soft streaked columns
pouring between the horns (the hard-topped strips are gone), and the
mesa-city v2 cards carry stepped tops and varied ink. **fern-vault**:
moth-fry circle the lanterns, low fronds and carpet fill the floor,
the mouth gradient reads. **cistern**: pool grown, rim lawn thicker,
stillness kept. Fails: **gardens-vista washed white** — an additive
sheet mid-frame; **mistfall-below** — a huge translucent panel floats
over the basin. Probe verdict (node-toggle idiom): both are the same
class of bug — the billows (pre-fill code) and my new glow fan breathe
via `mesh.scale` over WORLD-BAKED geometry, which scales about the
origin a kilometre away: every breath slides the mark tens of metres
across the province, wall-clock-phased, so frames catch it mid-drift.
Fixed properly: geometry made local, position on the mesh. Value:
the round-1 litter read as pale lavender confetti (threshold shells) and
dark chips (gate shards) — both re-valued toward their grounds and
shrunk. Detail: riser strips too fine to read from the stair pose —
blades +30% length, drape strands 4 → 5 × 2.0 m.
Sweep (3/12 frames before a page-load timeout; full sweeps from r2):
**the verifier bit** — midwater frames over the open slopes found bare
ground between the zone gates. Round 2 adds the doctrine-rule-3 answer:
a region-wide base moss carpet + litter drift over every owned square
metre (2 draws, ~16k tris), and spore motes 520 → 900 widened to the
threshold road and rim slopes so the water carries light everywhere.

### Fill round 2 (`v2-fill-r2`) — the poses hold; the sweep indicts the open country
Authored poses (all twelve looked at): **pass-threshold, emerald-gate,
slab-bridge, turtle-terraces, curtain-grotto, cistern, fern-vault,
mistfall-above, far-balcony all hold** — the r1 fixes landed (turf reads,
litter re-valued, the drifting marks pinned, mesa-city v2 composes, the
Warden discovered itself mid-settle in the grotto frame). Two authored
fails: **mistfall-below** — a billow reads as a giant tinted GLASS PANE
over the basin (r1's drift is fixed but the material was always the
second half of that bug: normal-blended `MeshBasicMaterial` with a
colour-only halo texture and NO alpha — a uniform-opacity quad whose
map goes black at the corners is a hard-edged pane, tilted across the
whole frame from the basin pose); **stair-descent** — the mid-channel
treads still read bare-ish, and a hard-edged mint RECTANGLE floats at
top-right. Probe (node-toggle idiom, `verdant2-distance-0` off/on):
the rectangle is **our own nearest cliff ring's terraced skyline** — a
level mesa run whose 5 m step falls as a razor vertical edge over the
flat fog band; from inside the country a lone step reads as a floating
card (r5's accepted "teal band" was the ring seen dead-on; this is the
ring's STEP seen dead-on, and it is not accepted).
Sweep (12/12 captured this time): **~4 of 12 pass — the verifier's
verdict is the round's real work order.** Frame 06 lands inside the
Cistern bowl (registered rest — licensed miss). The rest fail one way:
**the open country reads bare from a few metres up.** The base moss
carpet's 0.14–0.3 m cards at ~1 per 8 m² are sub-pixel from any
midwater pose (01, 02, 04, 10, 11 — rolling olive with nothing on it);
the spore motes at 0.09 m are invisible sparks, so midwater frames have
NO foreground layer at all; and the basin's pillar-cluster sector
(03, 05, 12) is undressed — the silt carpets stop at u ≈ 1098 while the
mesa cards' feet stand to u ≈ 1112, so a diver who swims out to the
promise finds flat cards on naked violet ground.
Round 3 orders: base cover count 2200 → 5200 and cards up to
0.22–0.5 m, litter 500 → 1100; garden tread carpet 1600 → 2600 at
0.2–0.44; stair tread carpet 1600 → 2000 at 0.2–0.42; basin silt
carpet 1400 → 2200 at 0.2–0.42 and a NEW pillar-sector bed
(carpet + litter + wine bushes + glow colonies at the card feet, fresh
`^ 0xf10b/0xf209/0xf305/0xf603` substreams); vault carpet gate eased to
the mouth and 900 → 1100; spore motes 900 → 1500 (growth stream only)
at size 0.09 → 0.15; billows take their own halo as `alphaMap` (the
pane dissolves into cloud); ring skylines take a wider step ramp
(0.16 → 0.3) and wobble 0.8 → 1.5 so no step is a razor rectangle.

### Fill round 3 (`v2-fill-r3`) — two poses cured; the sweep says clump, not count
Authored: **mistfall-below transforms** — with the halo as `alphaMap` the
glass pane dissolves and the frame is the fall again (milk between the
horns, foot glow, sleeper + buds below); **stair-descent** gains carpet,
the spill shoal and motes mid-frame, and the ring step's razor edge is
sloped — a small sliver still crops the top-right corner (watch it, not
worth another distance retune yet). All other authored poses hold r2.
Sweep: **≈4 pass / 3 marginal / 4 fail / 1 licensed (Cistern rest)** —
better, not the bar. What the marginals proved: the count-and-size lever
works at ground level (frames 08/09/11 read) and CANNOT work alone from
midwater — 5,000 uniform ankle cards read as noise from 6 m up, however
many they are. The motes now exist in every water column (right lever,
keep). Frame 04's razor-edged wall probed by node-toggle:
**verdant-1's far-side distance ring** (its trunk silhouettes on the
crest gave it away; hiding `region-verdant-line-1` removes it) — the
documented cross-region flag, R4's cut, verdant-1's rework owns it; the
frame's bare foreground is still ours. Round 4 orders: a seeded fbm
DRIFT field (~13 m cells) multiplies every broad-field gate — same
counts gathered 3–4× locally into drifts with composed gaps (uniform
scatter is noise; drifts are cover) — plus a region-wide knee-high tuft
layer (950 × 0.28–0.55 m) and a sparse bush scatter (40) riding the
same field, the mid-scale silhouettes the open slopes never had. Budget
trimmed back under the cap (base litter 1100 → 900, cards 5200 → 5000):
measured 448,888 ≤ 450k at the same 25/25 green.

### Fill round 4 (`v2-fill-r4`/`r4b`) — the drift reads; the probe finds the true bare ground
Authored (r4, all twelve looked at): the drift-gathered cover and the
knee-high tuft layer land — **pass-threshold, emerald-gate, slab-bridge,
turtle-terraces, curtain-grotto, cistern, fern-vault, mistfall-above,
mistfall-below, far-balcony, stair-descent all hold** (the pane stays
cured, the pillar-sector floor is a place, the stair's razor edge stays
sloped with only the watched top-right sliver). `gardens-vista` r4 came
back a blank violet frame — a capture failure, not a scene bug (r4b's
recapture of the same pose renders fine).
Sweep r4: **7 pass / 1 licensed (06, Cistern) / 4 down** — 02 and 10
bare flanks, 04 sparse slope plus the cross-region wall (flagged, not
ours), 07 thin foreground from high midwater. r4b (the fall-face gate
narrowed to the pour's ±18 m) changed NOTHING in any sweep frame — the
narrowing was aimed at the wrong band. The pose probe (drawing the
sweep's own seeded stream and mapping each camera to spoke coordinates)
finally located the failures: **frames 02 and 10 look at the basin's
SOUTH side** (camera/look v ≈ −39 to −101, u 1051–1071) where the silt
carpet (disc centre v 8) and the sector bed (v 42) never reach — only
drift-gapped base cover lands there; frame 10 additionally straddles
the south-pocket rest's rim, but its bare field runs far past the
pocket's 14 m. **Frame 04/07 stand on the southwest slope** (u 814–822,
v −68 to −128), south of the gardens gate's v ≥ −85 cut. Round 5
orders: a basin south-flank bed (silt key, drift floor 0.45, fresh
`^ 0xf10d/0xf10e/0xf20a`) at disc(1060, −80, 55) and a southwest
approach meadow (turf key, fresh `^ 0xf10f/0xf110`) at
disc(820, −100, 55), both through the shared stillness gate; paid for
by thinning the broad fields ~15% (base cards 5000 → 4000, litter
900 → 800, tufts 950 → 870, silt 2200 → 1900, gardens 2600 → 2400,
stair 2000 → 1900, vault 1100 → 1000). Measured after: **103 draws /
449,568 tris** (caps 160/450k), 25/25 green (rests, fence, channel all
hold).

### Fill round 5 (`v2-fill-r5`) — the south beds land; midwater is the last thin place
Authored (all twelve looked at): the ~15% broad-field thinning cost
nothing visible — **all twelve poses hold r4** (drift gathers what
remains, the treads stay dressed, the pane stays cured, gardens-vista
renders normally again).
Sweep r5: **8 pass / 1 licensed (06, Cistern) / 3 marginal** — the two
r4 failures are cured: **frame 02** (basin south side) now carries the
silt-key bed edge to edge, **frame 04** (southwest slope) reads with the
approach meadow's tufts (its right-edge wall is the flagged cross-region
ring). What remains: **frame 07** hangs high over the ridge with only
fall streaks in the foreground — no mote reaches its water; **frame 10**
looks down the same south flank from higher up, its tufts and pebbles
read but the mid-field wants one mid-scale silhouette; **frame 01**
(high midwater over the road) is the same thin-foreground class as 07.
All three are the midwater-foreground problem, not bare ground. Round 6
orders: spore motes 1500 → 1900 on a SECOND fresh substream
(`^ 0xf531`) held to the y +2..+12 water column across the open country
(u 780–1105) — ground poses get foreground from carpets, midwater poses
can only get it from the water itself; a south-flank bush bank
(12 × wine-key, `^ 0xf307`) through the same gate for frame 10's
mid-scale; paid for by base litter 800 → 700. Measured after:
**104 draws / 449,728 tris** (caps 160/450k).

### Fill round 6 (`v2-fill-r6`) — the count lever exhausts itself; two frames want SIZE
Authored (all twelve looked at): **all twelve hold** — threshold
waymarks + blades + runner, gate jambs + drapes, dressed treads with the
spill shoal (top-right sliver unchanged, still watched), gardens with
turtles, slab crabs, grotto moth-fry, Cistern mirror bright and its bowl
empty, vault ferns + spore fall, both Mistfall poses (pane cured, milk
additive), balcony fry + ferns.
Sweep r6: **8 pass / 1 licensed (06, Cistern) / 3 marginal** — 02 and
04 confirmed cured a second round. But 01/07/10 did not move: the 400
new column motes are IN frame 07's water and invisible — a 0.15 m
additive spark is subpixel past ~25 m, so raising the count put more
unreadable things in the water (the r3 lesson again, one level up); and
frame 10's dozen wine bushes vanished against the violet silt — hue and
value both sit ON the ground key (proof: the same bushes at the same
counts read fine as silhouettes where they break the skyline). Round 7
orders, all levers SIZE and VALUE, not count: (1) a drift-plankton layer
(`^ 0xf532`, 320 × 0.42 m at opacity 0.34, y +3..+14, u 640–1105
covering the road band frame 01 hangs over) — points cost no triangles,
one draw; (2) the flank bushes re-keyed a full value step off the silt
(base 0xa8697a, tip 0xd08e9a) and scale 0.9 → 1.2; (3) the flank tufts
0.28–0.55 → 0.36–0.72 (thigh-high reads from 7 m up). Zero triangle
cost total. Measured after: **105 draws / 449,728 tris** (caps
160/450k), 25/25 green.

### Fill round 7 (`v2-fill-r7`) — right levers, wrong densities; the probe finds the bushes
Authored (all twelve looked at): **all twelve hold** — no visible cost
anywhere from r7's retunes.
Sweep r7: **8 pass / 1 licensed / 3 marginal, unchanged** — 01/07/10
barely moved. Two diagnoses, both instructive. (1) The 320-drifter
plankton layer is one spark per ~5,000 m³; a 0.42 m additive sprite is
readable inside ~15 m, and a random midwater camera usually has NO
drifter that close — the size lever was right, the density was a
lottery ticket. (2) The bush POSITION probe (dumping every
kit-bush-bank instance to spoke coordinates) found the real reason the
flank bushes never appear in frame 10: `scatterPoints` gathers 12
bushes into ~2 clumps (perClump 7), and both of `^ 0xf307`'s clump
hearts landed at u ≈ 1086 — EAST of the frame's camera wedge
(u 1051–1071 looking south). The r7 re-key fixed the value of bushes
the frame cannot see. Round 8 orders: plankton 320 → 900 (sequential
draws, first 320 byte-identical; near-camera sparks become expectation,
not luck); a second flank bank (`^ 0xf308`, 12 × 4-lobe at scale 1.1,
same rose key) on disc(1058, −72, 28) held INSIDE the camera wedge —
the probe confirms its hearts at (1076, −52)/(1059, −71)/(1049, −98);
paid for by south cards 750 → 500 (the flank's own least-visible
element), vault cards 1000 → 900, gardens cards 2400 → 2300. Measured
after: **106 draws / 449,656 tris** (caps 160/450k), 25/25 green.

### Fill round 8 (`v2-fill-r8`) — density and the wedge both pay off; one frame left
Authored (all twelve looked at): **all twelve hold** — the second flank
bank sits below the turtle-terraces pose without crowding it; nothing
else moved.
Sweep r8: **10 pass / 1 licensed (06, Cistern) / 1 marginal** —
**frame 10 CURED** (the `^ 0xf308` bank's rose mounds break the flank's
mid-field exactly where the probe promised) and **frame 01 CURED** (at
900 drifters the road band finally keeps sparks near a random camera).
Only **frame 07** remains: high over the southwest slope, foreground
faint, mid-field still the naked ridge line. Round 9 orders: the pose
probe pins frame 07 at (814, −68), 7.9 m up, looking at (826, −60) —
give it the frame-10 treatment: an olive approach cluster (`^ 0xf309`,
10 × 4-lobe, scale 1.0) on disc(832, −56, 12) centred 25 m DOWN the
look ray (the first attempt at disc(826, −60, 22) let `scatterPoints`
carry the clump heart 66° off-axis; the tight disc cannot); paid for by
approach cards 500 → 400, stair cards 1900 → 1800, region tufts
870 → 840. Measured after: **107 draws / 449,936 tris** (caps 160/450k),
25/25 green.

### Fill round 9 (`v2-fill-r9`) — in the wedge and still unread: position was never the whole lesson
Authored (all twelve looked at): **all twelve hold**.
Sweep r9: **10 pass / 1 licensed (06, Cistern) / 1 marginal**. Frame 09
came back white — recaptured alone it reads as it always has (same
transient capture class as r4's blank gardens-vista; graded on the
recapture). Frame 07: the bush probe confirms `^ 0xf309`'s hearts at
(832, −65) — 18 m from the camera, 24° off the look ray, IN the frame —
and the capture shows them only as bumps on the ridge. Position-right,
read-wrong: at scale 1.0, keyed in the shelf's own olive, ten bushes at
18 m are sub-silhouette. Round 10 orders are the r7 flank lesson
verbatim (SIZE and VALUE, not place): scale 1.0 → 1.35 and the key a
warm value step off the teal shelf (base 0x93c161, tip 0xc8dd85); and
plankton 900 → 1600 (first 900 byte-identical) — at 900 the 15 m
readable bubble around a midwater camera averages ~1.5 drifters and is
empty a third of the time; frame 07's foreground was that empty third.
Zero triangle cost on both levers.

### Fill round 10 (`v2-fill-r10`) — THE STANDARD HOLDS
Authored (all twelve looked at): **all twelve hold** — the brightened
approach bushes sit naturally under the stair-descent and gardens-vista
poses; the Cistern's mirror bright, its bowl empty; both Mistfall poses
additive and quiet; threshold, gate, grotto, terraces, slab, vault,
balcony all carry their compositions.
Sweep r10 (frames 11–12 recaptured after a harness timeout killed the
run at frame 10; graded on the recaptures): **11 pass / 1 licensed
(06, Cistern rest)**. **Frame 07 CURED** — and the cure was proven, not
assumed: an NDC projection probe (camera rebuilt from the pose stream
with the rig's own YXZ convention) puts the `^ 0xf309` bushes at
ndc (−0.4, −0.76), 20–27 m out, bottom-left of frame — the golden
mounds now visible on the hill there are them. r9's "bumps on the
ridge" were never the bushes at all (a 2 m bush at 18 m spans ~70 px,
the bumps were ~10 px — distant objects); the bank was in frame all
along and unreadable at scale 1.0 in the shelf's own olive. Frames
01/02/10 hold their cures; 09 clean this round (r9's white frame was
transient). The three-layer law holds from eleven random positions;
the only miss rests where stillness is registered.
Measured: **107 draws / 449,936 tris** (caps 160/450k) — unchanged
from r9; both r10 levers (bush scale/key, plankton count) are
triangle-free and draw-free.

### Rework finals (`v2-filled`, `v2-filled-noassets`)
Gates green: typecheck clean; eslint (regions + region test, zero
warnings); the five required suites 131/131; ONE full `npm test`
659/659. All three final sets captured against the verified port-5193
server and *looked at*, every frame:
- **Authored (12/12 hold)** — gardens-vista recaptured once (the same
  transient white-out the harness showed in r4 and r9; the recapture
  is clean: turtles fore, terrace slabs mid, standing stones and mesa
  cards far). The Cistern's bowl stays empty around its bright mirror;
  both Mistfall poses stay additive and quiet; threshold, gate,
  grotto, terraces, slab, vault, balcony, stair all carry their
  compositions.
- **Sweep (11 pass / 1 licensed)** — the standard holds on the final
  set as it did in r10; the one miss is frame 06 inside the Cistern's
  registered rest, licensed by MASTER §1.2.
- **No-assets fallback (12/12 render)** — far-balcony recaptured (the
  harness run died on a nav timeout at its last pose), curtain-grotto
  recaptured (a moray codex flash overexposed the first take); every
  pose renders the procedural fallback with the fill intact, nothing
  empty, nothing flat.
Budgets, before the rework → after: **40 draws / 189,862 tris →
107 draws / 449,936 tris** (caps 160/450k).

## R12.3 QUALITY RE-PASS — the fill made worth looking at
## (`repass/verdant-line-2`, MASTER R12 + kit/quality-pass)

The verdict this answers, verbatim: *"some kind of half-cut grass
everywhere — doesn't seem like an added value at all."* The kit
re-authoring (docs/region-ledger/kit-quality-pass.md) provides the
craft; this pass consumes it. Budgets are R12's ≤260 / ≤1.35M, gated by
the headed frame measure (median ≤16.9 ms at scale 1.00 at the densest
pose). The sibling Kelp Sea re-pass had NOT merged when this pass began
(its commits live only on `repass/verdant-line-1`); its ledger was read
across branches as guidance, not contract.

### The reroll fence, restated

Profile swaps and richness opt-ins re-roll THOSE FAMILIES' own buffers —
expected and honest, the swap is the point. Everything else (landmark
stone, the Warden's beat, all pre-fill systems, all other fill streams)
is byte-unchanged: every new draw is `SEEDS.regionVerdant2 ^` a fresh
`0xf11x/0xf20b–0xf20c/0xf419–0xf41e` constant appended after all
existing draws, and the test pins (Rim Sentinel, mistfall horn, gate
jamb, Cistern ring stone, the Warden's target, to full float precision)
still hold — 25/25 green on the swapped build.

### What changed (round 1)

1. **Profile swaps** — every swimmable carpet family leaves the far
   tier: base cover 4000 card → 3400 `"blade"`; country understory
   tufts → knee-thigh blades; milky + celadon handover carpets → blades;
   stair tread 1800 card → 1500 blade; gardens tread 2300 card → 2000
   blade; gardens celadon tuft → `"frond"` (the hanging gardens are
   where rosettes belong); Fern Vault card → frond (value-lifted key,
   half-light keeps sunGlow off); Mistfall lip → blade; basin silt 1900
   card → 1400 frond (key lifted a half step off the violet floor);
   pillar-sector 1300 card → 1000 frond; south flank card/tuft →
   blade/thigh-blade; approach card/tuft → blade; balcony moss → small
   fronds. NO carpetField family keeps `"card"` — none of them is true
   far-field (the mesa-city distance cards are the region's own
   exclusive, not carpetField). No farGrassCards in this region, so no
   `nearFade` case exists to guard (verified by search).
2. **`sunGlow`** on the sunlit families (base, understory, both
   handover carpets, stair, gardens, lip, approach, road stands);
   withheld from the vault (half-light), the basin silts and the sector
   (deep register).
3. **`looseShare`** raised on the sweep-critical broad fields (base
   0.45, south flank/approach/stands 0.5, sector 0.4).
4. **Bush richness** — all ten banks opt into `fronds`/`accents` on
   their own inks: spring banks take rose berries (8/4, gardens 10/6),
   pale waymarks pale buds (5/3), wine scrub thorn-sparse (3–4 fronds,
   5 knots), rose flank banks bright buds (6/5), approach olive gold
   (6/4).
5. **Litter upgrades** — `grade` on every pebble/shard run (0.5–0.6);
   two NEW `"split"`-stone runs (`^ 0xf20b` gardens terrace feet 140,
   `^ 0xf20c` stair shoulders 100, both graded 0.6) — formed foreground
   rock for the country that remembers being built.
6. **Headroom spend (new families, fresh streams)** — road-edge blade
   stands `^ 0xf111` (360, waist-high, threshold+stair shoulders) and
   `^ 0xf112` (300, stair foot → Mistfall lip); vault understory second
   frond storey `^ 0xf113` (400 at 0.34–0.62); denser riser strips
   (`^ 0xf419/0xf41a` interleaved second rows on stair + contours);
   richer curtain layering (`^ 0xf41c` second contour run ×48/contour
   band, `^ 0xf41d` grotto outer veil, `^ 0xf41e` low-stair runs);
   eight more low vault ferns `^ 0xf41b`.
7. **Five new close poses** (`close-threshold-road`, `close-stair-tread`,
   `close-garden-tread`, `close-vault-floor`, `close-basin-silt`) —
   camera ~1.4–1.6 m up, subject 3–5 m out, judged hardest.
8. **Test caps updated honestly**: measured **112 draws / 1,290,388
   tris** (fill close was 107 / 449,936) → caps 130 / 1.34M, floors
   100 / 1.0M; the budget test now prints its measurement.

### Round 1 (`v2rp-r1`) — critique, close poses judged hardest

All 17 authored frames + 12 sweep frames captured against the verified
port-5201 server and looked at.

- **The profile swap works**: everywhere a blade clump or frond rosette
  is close enough to read, it reads as a PLANT — S-bend leaders, cupped
  straps, tip taper. `pass-threshold` (bright shallow light) is the
  proof; `fern-vault` and `close-vault-floor` are transformed (rosette
  floor + knee-high storey + giants — the best frames the region has).
- **The twelve original authored poses all hold** their v2-filled
  compositions (gate, stair, gardens, slab, turtles, grotto, cistern
  mirror bright + bowl empty, both mistfalls, balcony, threshold).
- **`close-vault-floor`: PASS.** `close-stair-tread`: MARGINAL — the
  blades in frame read beautifully, the riser face at right is bare
  wash, density thin. `close-garden-tread`: MARGINAL-FAIL — rosettes
  legible but the near field is broad bare olive with metre-spaced
  plants. `close-threshold-road`: FAIL — the road's near metres nearly
  empty; the milky blades camouflage against the milky shelf.
  `close-basin-silt`: FAIL — naked violet slope, one rose bush, thin
  dark sprigs.
- **Value, the v1 lesson confirmed**: in the deep country (thicker
  mood, dimmer sun) the swapped families render a full value DARKER
  than their hexes — gate-foot blades and gardens fronds read
  blue-violet against warm treads; basin silt fronds read as dark
  specks on their own violet ground. The bright-shallow threshold shows
  the same families reading perfectly — the palettes were keyed for the
  kit demo stage's light, not this mood (the fill-r2 lesson, one tier
  up).

**Round-2 orders**: (1) value pass — lift base/tip/shade a step on
every deep-country family (base cover, understory, stair, gardens
blades + fronds, vault, silts, sector, flank, approach, stands); (2)
density where the close poses stand — stair 1500 → 1800, gardens
2000 → 2400, gardens fronds 1000 → 1200, vault floor 900 → 1050,
milky 800 → 950, celadon 600 → 750, south flank 500 → 800; (3)
looseShare on the tread families back to the default (concentration
reads as cover; loose singles vanish — v1's close-meadow lesson,
pre-paid); paid for by base cover 3400 → 2900, sector 1000 → 900,
lip 800 → 700.

## Flags

- **Verdant-1's far-rim seal ring crosses the pass corridor.** The
  pilot's `buildSeals()` rim ring (rc 206 around its disc) gates only
  its own vale; at the far side (spoke u ≈ 651) its spheres stand across
  this pass. Everything on our side (bounds, terrain, seals, poses) is
  authored so the corridor works; **the orchestrator must cut a gate in
  verdant-1's rim ring over the pass tongue's width** (mirroring its
  vale-gate condition) when the depth-2 connection goes live. We may
  not edit verdant-1 on this branch.
- **Verdant-1's far-side distance rings cross the pass at u ≈ 691–733.**
  From the threshold they read as the painted promise becoming real
  (they are the very silhouettes the pilot placed to promise this
  province) — but they are opaque fog-coloured curtains: **nothing behind
  them exists to a camera in front of them** (round 3's probe proved the
  Emerald Gate's jambs invisible for exactly this reason; the whole gate
  composition now lives past u 733). Swimming *through* one is a brief
  flat-card moment. The orchestrator's same gate should open the pilot's
  far ring sector when the pass goes live; our threshold band (weight a
  whisper, kelp-sea terrain carried across) is authored so that cut is
  safe from our side.
- **The framework's depth-2 reject circle** (`RegionField`, radius+40)
  truncates our terrain/mood application below u ≈ 680. Authored
  around: threshold gate keeps weight a whisper and target at dune
  level out there; documented in `Verdant2Terrain`.
- The threshold's flank seals are invisible walls over open shelf (the
  pilot's same trade at his rim).
