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
