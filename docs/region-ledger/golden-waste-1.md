# golden-waste-1 — THE HOURGLASS SEA

Slot `golden-waste-1`, province The Golden Waste, gateway `sandfall-dunes`
(azimuth 6.39 ≈ 0.107 — almost due +x). Disc centre at u = 445 on the
spoke, radius 220; approach tongues r 44/62 → 285 (seam tongue halfWidth
8.2 → 34, saddle tongue 20 → 40 from r = 62). Seed `SEEDS.regionGolden1`
and `^` substreams only.

## Concept

The Sandfall Dunes wing was a quiet room of falling sand; this is the
desert it came from — a golden dune ocean where the sand itself is the
living element, and the mood is meditation at landscape scale: vast,
warm, slow, quietly surreal. A honey-warm dune saddle winds out of the
wing to a lip that opens on the Dune Ocean's ranked crescents; the
Hourglass — a vast circular chasm the whole desert drains into — pours
sandfalls over its lip all the way round, past terraced ledges into a
violet-warm deep where the Hourglass Keeper circles; the Glass Reach
stands fused pale fins over old trenches; the Oasis Hollows shelter
sea-palms, gold seagrass and the region's densest life; the Singing
Flats spread ripple-plains under lone monoliths and their long violet
shadows, garden eels rising and drawing back, a caravan of great rays
crossing in single file; and the far rim dissolves into stacked
gold-to-violet dune lines.

## Sub-biome map (spoke coordinates: u along azimuth 6.39, v lateral CCW)

| Sub-biome | Where | Floor |
|---|---|---|
| The Dune Saddle | u 48→285, channel wanders ±11, returning to the spine by the lip | −5.0 → −6.8 → +1.8 lip (u≈268) → dunes |
| The Dune Ocean | the disc's resting ground | −3.2 base, crescent ranks rising ~5–7 m, slip-faces in violet |
| The Hourglass | (455, +30) r 46 | terraced descent to ≈ −29, +2.2 sand-lip ring |
| The Glass Reach | (395, −78) r 62 | −7.2 fused trench grooves ±1.9 |
| The Oasis Hollows | (517, −64) r 27 and (543, −36) r 18 | −8 / −6.5 sheltered bowls, +0.9 rims |
| The Singing Flats | (528, +84) r 74 | −3.6 ripple-plain ±0.4 |
| The Gilded Shore | u > 560 to the rim | −2.2 shelf fading to dune level by rc 210 |

Seven sub-biomes (the bar asks five). Vertical range across the disc
≈ 31 m (dune crests ≈ +2 → chasm floor ≈ −29; the test holds range ≥ 25,
lowest ≤ −25 — the Hourglass mandate — highest ≥ +1.2). Ceiling: 10 m at
the saddle mouth (meeting the wing's vault), 8.5 through the pinch and
over the lip, 30 over the disc (composing down into the Hourglass and up
out of it are two different awes), closing to 3.4 at the rim so one
collider ring seals the world's edge floor-to-ceiling.

### The domain, and how it is sealed

Weight is max-combined from `slotDisc` plus two `approachTongue`s — the
seam tongue clears the sargassum-sky wedge (6.03 + 0.165) with 8.2 m at
r = 44; the next wing upward (kelp-cathedral at 1.35 ≡ 7.63) is 1.24 rad
away. The wide saddle tongue starts at r = 62, past every wing's carve
end. Seals: a 94-sphere rim ring at rc 206 (gated only over the saddle
corridor), three-sphere doorway stacks at u 48–66, and double rows down
the saddle (inner at the shoulder crest, outer at the tongue edge) —
the corridor is sealed wall to ring, and the test proves no seal blocks
the approach spine.

## Landmarks

1. **The Honey Gate** — pale jamb stacks where the Sandfall Dunes' end wall opens.
2. **The Vale Falls** — three of the wing's own sandfalls down the saddle walls: the idiom continues.
3. **The Saddle Lip** — the reveal at u ≈ 268 with its overlook slab: the Dune Ocean in one breath.
4. **The Great Crescents** — the ranked barchan trains of the Dune Ocean, slip-faces in violet, ribbons smoking off six scanned crests.
5. **The Hourglass** — the region's heart: a 92 m chasm ringed by twelve sandfalls, terraced ledges, a violet deep — two poses, the lip looking down and the deep looking up.
6. **The Fused Arch** — a glass swim-through over the Glass Reach's widest trench.
7. **The Glass Fins** — 26 pale fused blades in rows along the groove crests, glint sparks over the field.
8. **The Twin Gardens** — the two Oasis Hollows: eight sea-palms, the region's densest seagrass.
9. **The Singing Monoliths** — five lone standing stones on the ripple flats, each with a long painted violet shadow.
10. **The Gilded Shore stacks** — two leaning stones framing the painted distance.

## Life

Heat-shimmer motes (500 points, one additive draw); drifting sand veils
(nine great translucent sheets, instanced); **the slip-face shoal** — a
ribbon of bright gold fish surfing one scanned dune crest: down the
slip-face, along the trough, up the windward side, forever; **the
garden eels** — four colonies (~150) on the Singing Flats that rise,
sway, and *draw back into the sand as the diver nears* (distance read
live from the life context; a delight the game lacked); **the ray
caravan** — the moving centrepiece: five great golden rays crossing the
flats in single file past the monoliths and around the Hourglass's lip,
wing-tips rolling on a shader flap; and **the Hourglass Keeper**
(`hourglass-keeper`) — the findable resident: an ancient turtle-spirit
circling the chasm the way sand circles a drain, the gold runnel on its
shell read by the vein-glow material as a slow lantern in the violet
deep. Codex entry in the def; DiscoveryTarget at the drain's eye.

## Budgets (measured; tests/regionGolden1.test.ts holds the caps)

Round-1 draft: **46 draw calls** of ≤ 120, **131,662 triangles** of
≤ 250k, **228 colliders** — all inside the domain by test.

Final (round 8, as shipped): **47 draw calls** of ≤ 120, **136,326
triangles** of ≤ 250k, **231 colliders** — all inside the domain by
test.

## Seeds

`SEEDS.regionGolden1` (0x5a4d_0c0d) with `^` substreams: terrain fbm
(0xd0e1, 0xdca1, 0x901d, 0x91a5, 0xf1a7, 0x40a1, 0x5407, 0x9e0b, 0x40a3),
ground paint (0xd21f, 0x92a1, 0x44ab, 0x611e, 0x0a51), rocks 0x50cb
(+0x0a2., 0x0ab., 0x0ac., 0x0e2. shape seeds), glass 0x61a5/0x611e/0x611f,
falls 0x5a1f, oasis 0x9a1e/0xa5a1/0xa5a2/0xb1ac, life
0xe41e/0x0e11/0x0e12/0x50a3/0xee15/0x4a71, keeper 0x0ee9/0x5cae, light
0x11fb/0x90f5, distance 0xd15b/0xd400+. Update spends no randomness, so
captures settle deterministically.

## Critique history (silhouette → value → colour → detail, per round)

### Round 1 (`hourglass-r1`) — bones compose, the desert isn't painted yet

Silhouette: the saddle corridor, the glass reach (arch + fins + glints
— the round's one pass), the oasis gardens, the monolith flats and the
shore stacks all compose; the Hourglass's two awes have the right
geometry but the bowl reads as a smooth crater — terraces too fine for
the 2.2 m grid, sandfall ring **invisible** (cream veils at 20–90 m
through warm fog have no value separation from the sand walls behind
them); the reveal opens onto *nothing* — the dune ranks are too low to
read from the lip; distance monolith cards poke over the Hourglass's
rim in the lip pose like chimneys on a roof (the pilots' rooftop
failure, reproduced exactly); the distance rings' gap ends show as
flat-topped blocks on the oasis and flats horizons. Value: the whole
ground is one mid-tone gold mush — drift/grain mottle ±0.12 does
nothing, slip-face violet too weak to structure the ranks, terrace
paint washes out; the seagrass and garden eels read as *black cutouts*
(dark toon maps under a quarter-strength sun — the value key's "never
black" broken by lighting, not by paint). Colour: the water is honey
only near the ground; the cyan backdrop dominates every frame above eye
level — density 0.0045 leaves the backdrop undiluted (the Smoulder's
warm sky was mostly *fog*, not backdrop). Detail: the vale fall
curtains float mid-air off the wall slope (hung from channel-floor
height, not local ground); palm crowns read as broken tripods (straps
hang instead of arching); the slip-face shoal is scattered dots
(pilot round 1, same failure); the ray caravan missed its frame
entirely (loop too fast for the settle window); the Keeper is not
found in either deep frame.

Fixes for round 2: fog [3.6, 0.58, 0.26] at density 0.007, backdrop
0.5; rank amplitude 7 with a steeper slip and violet at full strength;
TERRACE_STEP 4.2 so the ledges survive the grid; falls re-seated on
local ground, brighter and wider with more streaks; rings taller,
darker, longer end tapers; cards fewer and shorter; eels and grass
lifted into the value range with a touch of emissive; palm crowns
re-arched; shoal tightened; caravan slowed to a stately 1 m/s with a
head start onto the framed leg; Keeper grown and brightened.

### Round 2 (`hourglass-r2`) — the bowl paints itself; the rooftop returns

Silhouette: the Hourglass finally composes from the lip — terraces
bench, the falls' veils read as bright smoke inside the bowl — but the
shortened distance cards STILL poke over the far rim as a picket of
sticks against the cyan (the rooftop failure, second offence), and the
crescent ranks, taller now, read as smooth swells rather than ranked
dunes because their slip-faces carry only a timid mauve. Value: the
saddle and flats grounds still run one mid-gold; the monolith shadows
were thrown directly AWAY from the flats poses' sightlines, so each
reads as a disconnected purple smear beside its stone instead of a
shadow anchored to it. The falls' bottoms cut hard buried-plane shards
where their planes meet terrace geometry. Colour: fog at 0.007 owns the
first thirty degrees above the horizon but the upper sky is still raw
cyan backdrop. Detail: the ray caravan missed its frame AGAIN (the
grand tour loop was simply somewhere else); the eels read as dark
strokes; the slip-face pose stood buried in the windward slope of the
wrong dune.

Fixes for round 3: distance cards removed outright (twice is enough —
dune lines only, varied out of their mesa flats); slip violet to full
pitch with painted duneling lees down the saddle; monolith shadows
swung lateral to the poses; hourglass falls hung a step inside the lip
with an earlier bottom fade; caravan re-drawn as a flats-only circuit
spread over a third of its loop; eels brightened; the slip-face pose
corrected to the scanned crest.

### Round 3 (`hourglass-r3`) — the chasm lands; the flats and the file don't

Silhouette: hourglass-lip is the region's first frame worth keeping —
bowl, benches, veils and violet ledges compose, and with the cards gone
the far rim carries only the true Singing Monoliths (still slightly
chimney-ish at 150 m, but honest geography). The saddle reveal remains
the big silhouette failure: the ranks beyond the lip sit below eye
level and the Dune Ocean opens as one flat horizon line. hourglass-deep
wastes two-thirds of its frame on empty water above the rim (pitch
0.65 was authored for awe and framed nothing). Value: violet finally
structures the bowl and the near slip-faces; the flats' painted
ripples and swung shadows exist but read faint at capture distance;
oasis seagrass and garden eels STILL sit near-black against the sand
(the grass material carries no emissive at all — the round-2 "lift"
touched only the eels). Colour: the water is honey to ~25° above the
horizon; above that the cyan backdrop still owns every sky (0.007 is
not what warm costs — the Smoulder paid 0.009). Detail: the
ray-crossing pose is BROKEN — the loop's western station passes within
three metres of the camera, so one rust-dark ray fills the top half of
the frame like a tarpaulin; the Keeper appears in NEITHER deep frame
(a 72 s loop against a wall-clock-nondeterministic settle means the
pose must frame the whole patrol ring, not a lucky arc of it); the
slip-face shoal spreads over half its loop and reads as scattered
dots again; the gilded-shore stacks frame a single low flat dune line
— "stacked gold-to-violet lines" is not yet true.

Fixes for round 4: fog density to 0.0085 and backdrop fade 0.62 (buy
the warm sky, fade the rooftop monoliths); grand-crescent amplitude
boost in the reveal's sector so the lip opens onto ranked silhouettes;
ray caravan shrunk from ~15 m to ~10 m span, lifted brighter gold, and
its pose camera moved outside the loop to watch the file cross at
25–40 m; keeper-deep re-authored as a high-terrace frame that holds
the WHOLE patrol ring, Keeper grown to 3.0 and its lantern brightened;
hourglass-deep pitch brought down to frame falls, terraces and rim
ring; grass given emissive and the eels lifted again; monolith
shadows widened and darkened; distance rings given real swell variance
and a taller far layer; two more vale falls and three more saddle
boulders for the approach's fog rhythm; shoal ribbon tightened.

### Round 4 (`hourglass-r4`) — the bowl is won; the horizon grows turrets

Silhouette: hourglass-lip now composes fully (terraces, veils, violet
ledges, honest far-rim silhouettes); glass-reach, oasis and
first-crescent hold; keeper-deep's re-authored high-terrace frame
works — the whole ring in one look, and the Keeper IS in it at last.
But the round's variance boost turned the distance rings into a
FORTRESS: `pow(|sin|, 1.5)` crests over a slow flat base read as a
crenellated wall with turrets from everywhere that faces them
(ray-crossing's right half, the oasis and flats horizons, blocky
notches on the reveal's crest line). Proven by mesh toggle in the live
scene — hide `hourglass-distance-*` and every block vanishes. The
saddle-reveal's boosted grand crescents rank now, but the ring blocks
sit on top of them. Value: the descent paint's harder stain works;
the flats' widened shadows still read faint at 25 m. Colour: the sky
is honey to ~30°; raw cyan still owns the zenith (0.0085/0.62 was not
quite enough); the saddle boulders and the Gilded Shore stacks read
saturated PLUM — the lavender rock wash under this region's
quarter-sun turns both stone families purple, and 0x9a8a70 vs
0x7a6a70 render nearly the same eggplant. The "gold" seagrass reads
plain GREEN (olive emissive + green families — toggle-proven: hiding
`hourglass-gold-seagrass` removes every green blade in the flats
frames). Detail: THE CARAVAN WAS IN FRAME ALL ALONG — with the rings
hidden, ray-crossing shows six tan deltas crossing mid-water; tan
rays in front of a tan fortress wall are invisible (camouflage, not
absence). The slip-face pose frames a bare crest (the tightened
ribbon is a 25 m dash somewhere on a 90 m loop — a chest-height
camera behind the crest sees none of it); hourglass-deep still spends
two thirds of its frame on empty water (pitch 0.42 aims at the far
wall 33 m off, which the bowl's own haze eats); the garden eels are
sub-pixel whiskers at the pose's 22 m and RETRACT when the capture
teleports the diver closer (5 cm × 1 m at 22 m ≈ two pixels — the
delight is invisible at every distance the shot set stands at).

Fixes for round 5: distance skyline rebuilt as rounded integer-period
swells (no side steeper than a dune's repose — the fortress was the
crest sharpening, not the variance); caravan circuit shrunk to r ≈ 25
around the flats' heart so the pose frames the WHOLE loop (a file
that cannot leave the frame needs no phase luck) and the rays lifted
brighter gold; ray-crossing re-posed outside the shrunk loop;
slip-face pose raised to a 7 m overlook framing crest, lee and trough
(most of the shoal's circuit); shoal span 0.36 at a faster surf;
hourglass-deep re-authored INSIDE the bowl on a mid terrace, 30 m
from the west falls, pitch 0.36; eels thickened ~70% and the flats
pose brought to ~14 m of a colony; grass families and blade texture
warmed from green to dry gold, emissive amber; both stone tints
warmed against the plum (pale 0xb09a74, monolith 0x8a7468); backdrop
fade 0.66; monolith shadows deepened a step.

### Round 5 (`hourglass-r5` partial, `hourglass-r5b` full) — three wins, two new tarpaulins

Captured under wave contention (1-min loads 13–27; two runs raced and
both died starved — the r5 tag is a 12-pose partial, r5b the full set
on a gated quiet minute). Silhouette: hourglass-deep is DONE — the
live candidate search found a swimmer's frame of terrace benches
stacking diagonally to the lip with one sandfall burning over the
crest; the fortress reads are gone from ray-crossing/oasis/flats
horizons (soft-top rings dissolve into the water), and slip-face
finally holds its shoal — the ribbon arcs over the crest top in
frame. But the reveal's notch persists: NOT the rings (toggle-proven)
— the crescent field SATURATES, so a rank's crest line runs
ruler-straight for tens of metres and steps down through the old
narrow shoulder like a wall with a gate cut in it. And the flats'
second stand put the first monolith four metres from the lens (a
purple wall on the right third). Value: the falls' fog-off is the
round's big win — the lip pose reads the WHOLE ring of twelve for the
first time, the vale falls populate the descent, and the reveal
gained an unfogged fall-beam beacon at the Hourglass's azimuth (200 m
off, reads as a landmark, kept). The Keeper missed keeper-deep AGAIN
(round 4's stand loses the patrol's deep near arc below the frame
edge; the wider round-5 fix framed the ring but produced a frame of
pure interior haze in which a fogged lantern carries nothing).
Colour: stones warmer but the first warming did not survive the
violet ambient (saddle boulder still eggplant at the base); "gold"
grass overshot to rust-orange accent blades; the caravan's 0.85
emissive reads NEON when close. Detail: the shrunk circuit works —
the file is in every flats-side frame now — but 36 m of standoff is
not enough: an unlucky settle parked the near arc overhead and two
2.5-scale rays kited across the whole sky; and hourglass-deep's first
stand sat ON the Keeper's patrol band (a glowing three-metre turtle a
wing's length from the lens). The garden eels finally read as bent
question-marks at the new distance.

Fixes for round 6: duneRank heave (a slow ±14% multiplier so no crest
line ever runs dead level) and the crescent shoulder widened 0.3 →
0.42; rays trimmed to 1.7–2.1 scale at 0.65 emissive, watched from
47 m; keeper-deep re-authored at 52 m with the near lip crossing the
lower third AND the Keeper made fog-free (the falls' own lesson — a
lantern must pay its way through the bowl's haze); hourglass-deep
slid to r ≈ 10 of the chasm centre, inside the patrol's breathing
band; flats stand clear of both the circuit and the stones; stone
warming doubled (pale 0xc2a066, monolith 0x9a7c6a — the red/blue
ratio is the lever, not the value); grass pulled back to wheat; ring
bases up a step to pay for the alpha-dissolved crests.

### Round 6 (`hourglass-r6`) — the bowl breathes; the horizon keeps its buildings

Silhouette: the round-5 fix list mostly paid off. The crest heave
killed the ruler-straight rank in saddle-reveal (no crest line runs
dead level any more, and the widened 0.42 shoulder swallowed the
gate-notch); the flats' stand cleared the stones and the circuit; the
trimmed 1.7–2.1 caravan at 0.65 emissive watched from 47 m finally
reads as a file of wings instead of a sky-filling kite. Two failures
stayed. FIRST: rectangular flat-topped blocks on the ray-crossing and
oasis horizons — the round-1 read, back again after every skyline
retune. SECOND: hourglass-deep at r ≈ 8 of the chasm centre still let
the patrol's near arc close to 11 m, and an eight-metre spirit at
eleven metres is a tarpaulin — worse, seen from BELOW the Keeper
rendered as one flat neon-orange blob: the vein-glow multiplies the
fog-free emissive by the vertex colour, and the belly was cream.
Value/colour: stones hold their warmth this time (the red/blue lever
worked), grass reads wheat-gold, the falls stay unfogged. Detail: eels,
terraces and runnel-gold all carry at their poses.

### Round 7 (`hourglass-r7`) — the blocks are named: the rings, then the camera

Diagnosis round, run with two scratch harnesses (mesh-visibility
toggles and a numeric skyline profiler; both deleted after). Toggling
`hourglass-sand-veils` off left the blocks standing; toggling
`hourglass-distance-*` off removed them — the blocks ARE the distance
rings, not the veils and not ring gaps. The profiler then measured
WHY: the `roll * 5` phase term folds the 15-cycle swell into local
sawtooth cliffs — 9.2 m ridge steps over an 8.2 m column arc on the
far ring, a >45° run that at three hundred metres reads as the
vertical edge of a building. Fix one, in `duneRing`: a two-direction
relaxation pass caps every column step at arc × 0.42 (~23°, a dune's
repose) by construction, planing the cliffs and keeping every crest
that already respected the slope; the seam column at t = 0 ≡ 1 is
relaxed the same way. But the capture still showed two hard VERTICAL
edges per arc — and those traced past the geometry to the camera: the
game's far plane ends at 160 m while the rings stand 246–286 m from
disc centre, so from any stand only the near arc renders and the clip
slices it off square. The region may not touch the camera, so fix two
makes the rings dissolve themselves: an `onBeforeCompile` varying
carries camera distance and alpha runs to zero across 132–154 m,
safely inside the clip. Fix three, for the Keeper: `BELLY_DUSK`
(0x84688a) replaces the cream underside — dusk below, gold spiral
above; a lantern reads from the lip and a violet silhouette with warm
edges reads from the floor. Fix four: hourglass-deep re-authored AT
the chasm centre — the one stand where every point of the 19.5–26.5 m
patrol ring keeps ~20 m of standoff.

### Round 8 (`hourglass-r8`) — the horizon dissolves; one fade cut too greedy

Silhouette: the blocks are gone. Ray-crossing and oasis horizons run
as low dune swells that thin into the water; the profiler's re-run
confirms no column step exceeds the cap. Hourglass-deep now frames the
whole patrol ring from the centre and the Keeper reads as a
dusk-violet creature with runnel-gold edges — a resident, not a blob.
One regression: the 132–154 m fade window ate half of gilded-shore's
far violet line (its three ring lines stand at 103/121/143 m of
camera distance, and the third sat deep in the fade). Fix: window
slid out to 140–157 m — every canonical ring view stays under the
fade's onset, and the dissolve still completes before the 160 m clip.

### Final (`hourglass-final` + `hourglass-final-noassets`) — closed

All 13 poses captured and read, assets and noassets both. Saddle
descent frames the crescent gate with sandfalls burning at the lip;
first-crescent, dune-ocean and slip-face hold their painted swells and
the shoal ribbon; glass-reach's spire rows carry; hourglass-lip reads
the whole ring of twelve falls with the Keeper as a lantern below;
hourglass-deep and keeper-deep frame the patrol as a violet-and-gold
silhouette over the terraces; the oasis bowls read green-gold with
palms; singing-flats and ray-crossing hold monolith ranks against a
clean dissolving horizon with the caravan's wings crossing; gilded
shore keeps all three distance lines. Noassets spot-checks
(saddle-descent, hourglass-lip, oasis, ray-crossing) confirm the
procedural fallbacks paint the same region — terrain paint, veils,
spires, palms, stones and caravan all present, nothing missing and no
horizon artefacts. Budgets measured at close: 47 draws, 136,326
triangles, 231 colliders. Gates: typecheck clean, eslint clean at
--max-warnings 0, targeted suites and the full `npm test` green.

# PHASE 3 REWORK — the fill (`rework/golden-waste-1`, plan `docs/fill-plans/golden-waste-1.md`)

Executed under FILL-DOCTRINE (R12 budgets: ≤260 draws / ≤1.35M tris,
bound by the headed frame gate) + MASTER (R9 rebase-first, R10 stillness
beats cadence, §1.2 registry inviolable), at the R12 quality tier from
the start — the first fill to skip the wedge era: everything green wears
the kit's `"blade"`/`"frond"` profiles, litter is graded, and the 4-tri
card tier is not consumed at all.

## The rebase audit (R9 — the plan was written against round 4)

The plan's audit re-read against the CURRENT code (round-8 close, merge
01b028f) and the final `hourglass-final` captures, all 13 LOOKED at:

- **Plan checklist §7.7 (distance swell variance) is CLOSED**: rounds
  7–8 rebuilt the skyline with the slope-relaxation pass and the
  camera-distance dissolve; `ray-crossing`/`oasis` finals show low dune
  swells thinning into the water, no mesa block, no fortress. No edit.
- **The Keeper's belly was re-authored** (r7 `BELLY_DUSK`) — the plan's
  "keeper satellites" land on the final body, not the r4 blob.
- **Fog closed at 0.0085 / backdrop 0.66** (the plan quoted r4's
  in-flight 0.0085 — confirmed final; the §8 wing handshake numbers
  still hold as written).
- **Budgets rebased**: the plan's arithmetic was over 46 draws/131.7k
  (r1); the final is 47/136,326 — the fill budget below re-measures
  against that, under the REVISED R12 caps, not the plan's 160/450k.
- **Everything else in the §1 audit stands exactly**: the final frames
  are the r4 frames with a cleaner horizon — T3/T5 land, T1/T2
  near-absent everywhere, no dapple, roads bare. The checklist executes
  as written, quality-tier upgraded per R12.

## What landed (by checklist item, rebased)

1. **GoldenGround T1 paint** — crest shell-lines (keyed to the rank
   function, wavelength 46 m), Glass Reach fracture seams (~9 m bands on
   ~55 m spacing — the grid-honesty floor respected; fine fracture lives
   in the shard-apron instances), terrace-tread fringes (same spatial
   key as the shipped rim paint), and THE EMPTY QUARTER's composed
   ripple stripes (~11.5 m wavelength, paint only).
2. **GoldenCover.ts** (new) — every T1/T2 kit consumer: ripple-grit
   (5,200 two-tone, graded), shell-drift (2,600, dune lees + shore),
   saddle pebble runs (680), dune-crest wire-grass (1,400 kit BLADE
   clumps at the desert palette — the R12 tier, never wedges; flank
   band boosted past rc 125 per MASTER F-R3), saddle wire (380),
   lee-garden fronds (560 kit FROND rosettes in 14 authored pockets —
   the journey map's 20–40 m beats), wrack drift-lines (3 authored
   lines + pocket wrack), terrace salt-lilies (250 + a 42-frond
   authored bench for the close pose), oasis cushion bushes (40, R12's
   opt-in fronds+berry accents), fallen palm fronds (60), shard aprons
   (460, fanned from the exported fin spots), singing stones (90 split
   stones ringing the monoliths), and the Gilded Shore decrescendo
   (800 pebbles + 110 wrack + 300 blade tufts).
3. **GoldenLife** — eel colonies 4 → 7 (oasis fringe 30, shore outpost
   30, the saddle outpost of 20 at u 176 — the plan's u ~175 road
   taste), all APPENDED from a fresh stream with the original 148 eels'
   placement AND tints byte-identical; a colony-wide sway wave (derived,
   zero draws) so a distant field ripples; 42 pilot-fish riding the
   caravan's slipstream (one instanced draw, same path arithmetic); the
   traveller shoal (kit `shoalRunner`, 46 gold fusiliers + glint,
   doorway ↔ saddle ↔ first crescent, ~5 min loop); one sand veil
   routed down the saddle (appended, the nine originals hold).
4. **GoldenKeeper** — two remoras trailing the shell-glow on authored
   offsets (zero randomness, the patrol's own arithmetic; licensed
   inside the Drain's Eye as the Keeper's own circle).
5. **GoldenLight** — the gold dapple (kit `dappleSheet`, honey 0xffca6e
   over-mixed per the sRGB-on-sand lesson: saddle channel + oasis bowls
   + flats), two road beams with pools (drift-line u 131, shore
   stacks), three faint secondary blades between the Hourglass falls,
   the Drain's Eye cool pool (the column lands on something), the
   glass-glint breathing swarm (kit `particulateField`, 110 motes over
   the fused field) and the u ~205 glint tease over the saddle's west
   wall.
6. **GoldenRocks** — the monolith warm rim-band (vertex paint against
   the painted shadows' own sun direction; zero stream draws).
7. **GoldenGlass** — fin spots exported for the aprons; the SAND-ROSES
   (the one new exclusive the plan allows): 60 fused-glass rosettes on
   the groove crests, four authored at (390, −64) for the close pose.
8. **Golden1** — cover/light wiring; 7 new poses: `empty-quarter` (the
   registered rest, framed as composed bareness), `drift-line` (the
   u ~130 road beat) and FIVE close poses at 2–4 m (`close-lee-garden`,
   `close-salt-lily`, `close-sand-rose`, `close-palm-foot`,
   `close-wire-crest` — the last resolved onto the same scanned crest
   as the slip-face pose).
9. **tests/regionGolden1.test.ts** — caps to the R12 260/1.35M with
   honest floors (60/300k), the reroll fence (six pilot pins to nine
   decimals: boulder, monolith, fin, eel, palm, Keeper, plus veil count
   10 with seat 0 pinned), stillness exclusion (every cover instance
   and debris vertex swept against both rests, >5k points), and the
   close-lens clearance (no carpet instance within 0.9 m of a close
   pose's camera).

Budgets: **before 47 draws / 136,326 tris → r1 89 / 448,262** (measured
by the region test's own walk). Reroll fence proven: all six pins
byte-identical against the pre-fill scratch walk.

## Rework round 1 (`go-fill-r1`) — critique, silhouette → value → colour → detail

All 20 authored+close poses captured on :5202 (verified) and READ; the
sweep died at 4/12 on a self-inflicted Vite full-reload (round-2 edits
made while the capture ran — the standing shared-tree hazard, one
worker, one tree, same lesson; never again). The four frames read.

- **The bones compose everywhere**: the saddle is a road now (gardens,
  stones, drift-line + beam, veil, tease sparks); the oasis is dense
  (palms + grass + bushes + dapple); ray-crossing carries the file WITH
  its pilot outriders; singing-flats has eels + stones + caravan; the
  glass reach has roses and (faintly) aprons; the shore has standing
  tufts and its beam between the stacks.
- **FAILS on value, exactly verdant r1**: the wire-grass, fronds,
  bushes and shore tufts all read as near-black thorns/spiders under
  the region's 0.26 sun — painted for the kit demo's light. The
  singing stones read PLUM (violet shade under violet ambient — the
  pilot's own stone-warming lesson, re-learned on litter).
- **The dapple is leopard spots**: 0.2/0.22 additive over warm sand at
  8 m tiles owns the whole channel floor — a dapple is a whisper, not a
  pattern the ground wears.
- **Grit read as floating grey dice** at the close lens (violet-grey
  shade + hard grade); a remora rendered NEON ORANGE at the salt-lily
  terrace (fog-free emissive 0.5 — the caravan's r5 lesson, one size
  down).
- **close-lee-garden sparse; close-wire-crest missed its subject** (the
  crest scatter is honest but thin at the lens); dune-ocean's near
  floor still bare (wind-gate base too low).
- Working already: salt-lilies read pale and true; sand-roses read as
  glass stars; the Keeper's near-arc luck degraded both hourglass poses
  this session (documented noisy pose — the patrol phase is wall-clock;
  not a fill regression).

**Round-2 orders** (all landed in commit `go-fill-r2`): one value pass
over every fill palette + the pilot's own small-emissive move applied
region-side (the kit stays palette-pure); dapple halved and spread
(0.1/0.11/0.08 at 10 m tiles); wire 980 → 1,400 with base 0.42 and an
authored crest stand at the close pose; fronds 430 → 560; shards 340 →
460 and grown; stones warmed off plum; grit smaller/warmer/calmer;
remoras to 0.26 on a duller ink.

## Rework round 2 (`go-fill-r2`) — critique

All 20 authored+close poses captured and READ; the sweep landed 9/12
before Chromium died under the box's load (three sibling capture jobs
running); the per-launch retry (`r2b`) proved the stations deterministic
(frame 01 byte-similar) but ran at ~3 min/shot, so it was stopped rather
than hold the round — the final build gets its full 12. Nine distinct
random stations is a fair read of this build.

- **The value pass HALF-landed**: the r1 soot is gone — first-crescent's
  entrance tufts, the lee pockets (sweep 03) and the salt-lilies (sweep
  02) all read as planted growth in the honey light. But the wire-tufts
  at range still sit a half-step dark (gilded-shore's flats, sweep 05's
  crest line read as dark stick clusters against lit sand) and the
  singing stones hold a violet cast (sweep 07). One more step, not
  three: emissive lift on wire/fronds/bushes/shore-tufts, stones' shade
  swapped warm.
- **The dapple still stamps**: saddle-reveal's floor wears distinct
  ellipse spots; sweep 01/r2b-01 show the sheet as repeated dashes on
  the dune face at grazing angle. Opacity down (0.10/0.11/0.08 →
  0.07/0.09/0.06) and the tile up 10 → 12 m so the period stops
  registering as a pattern.
- **The sweep's recurring miss is the bare dune face**: 04 and 09 put a
  featureless slip face across the whole lower half (three-layer fail);
  05/06/08 pass only on faint paint. The wind-gate keeps faces bare by
  design, but the doctrine's near-layer answer must live in the first
  ~35 m: wire base 0.42 → 0.52, count 1,400 → 1,700, grit 5,200 →
  5,900 so the fine grain reads past 10 m.
- **close-lee-garden is still thin** at the lens (a pocket heart, not a
  garden): fronds 560 → 720. **close-wire-crest** found its subject but
  the stand is loose: the authored crest stand widened ((d−2)/5 →
  (d−3)/6). **close-palm-foot** centres the trunk like a mugshot: aim
  nudged off-axis (camera holds, lens registry unchanged).
- **glass-reach's aprons still whisper** at pose range: 460 → 580,
  grown to 0.12–0.34 m.
- Working and locked: oasis composition (bushes + dapple + fallen
  fronds), ray-crossing's pilot outriders, singing-flats' eel field +
  caravan, the drift-line beat under its beam, sand-roses, the remoras
  off neon, both rests still composed bareness (empty-quarter pose +
  sweep misses only there). The pale slab at the empty-quarter horizon
  persists — it is the distant falls stack seen edge-on, pre-fill
  geometry, logged as a flag for the region owner, not a fill defect.

**Round-3 orders**: the second (final) value step on standing cover;
dapple to a whisper; dune-face near layer; lee/crest/apron densities;
palm-foot aim. Nothing structural — the bones have held two rounds.

## Rework round 3 (`go-fill-r3`/`r3c`) — critique

The box ran three sibling regions' captures all round (load ~20) and
full 20-pose runs died on page-load timeouts; the set landed as r3
(10 poses) + r3c (the missing 10, captured through a TEMPORARY pose
filter in the def, reverted the moment the run ended). All 20 READ.

- **The value step landed**: gilded-shore's and saddle-reveal's tufts
  read as lit golden grass, the lee pockets read as gardens
  (close-lee-garden is a garden now — fronds, blades, wrack, grit),
  the oasis understory is rich and warm, singing stones sit ochre. No
  fill element reads sooty anywhere in the set.
- **The dapple stopped stamping**: saddle-reveal/drift-line show soft
  oval caustic light that reads as intentional water-light, not
  leopard; the grazing-angle dashes are gone at 12 m tiles.
- **glass-reach's aprons finally read** (580 at 0.12–0.34 m), the
  sand-roses star cleanly at the close lens; slip-face carries the
  traveller shoal draped along the dune's back with crest tufts on the
  skyline; dune-ocean's near floor anchors on wrack + drift-marks.
- **THE ONE FAIL: close-wire-crest** — r2 and r3 read compared side by
  side prove the lily-bench lesson from the other side: a 1,700-clump
  scatter over the 225 m disc averages ~0.3 clumps in a 4 m circle;
  the crestStand gate boost raised acceptance, but no gate can raise a
  density the global count never supplied. The lens's near field is
  bare in both rounds.
- close-palm-foot reads as understory now (trunk off-axis, bushes and
  blades behind); empty-quarter stays composed bareness; the horizon
  slab flag stands (pre-fill distance geometry, the region owner's).

**Round-4 order (one item)**: the crest gets its OWN authored stand —
kit carpetField, fresh seed `crestStand` appended, 54 blades in a
4.5 m disc at the scanned crest, dune-wire palette, `restFree ×
lensFree` gated — exactly the lily-bench move that made
close-salt-lily work in round 1.

## Rework round 4 (`go-filled`) — the final read

The crest stand is the round's only code change; the set is the
canonical `go-filled` roster (authored 20/20 + sweep 12/12, all
captured per-launch under sustained sibling load ~20 and ALL READ).

**Authored + close: 20/20 pass.**

- **close-wire-crest RESOLVED**: the authored stand fills the near
  field with lit golden wire at 2–4 m, the crest line silhouettes
  behind it and the road beams hold the distance — the frame that
  failed three rounds is the set's best argument for the lily-bench
  rule (author the close subject; never ask a global scatter to land
  one).
- The other four close poses hold their round-3 reads: lee-garden a
  garden, salt-lily a pale bench under the pool glow, sand-rose glass
  stars over fracture seams, palm-foot an understory with the trunk
  off-axis.
- The touring poses hold: saddle a road with gardens/stones/beam/veil,
  oasis dense and warm, singing-flats' eels + caravan over shell
  drift, slip-face's shoal on the dune's back, glass-reach's roses +
  aprons + fins, gilded-shore's beam between the stacks over standing
  tufts, drift-line's beat under its beam, dune-ocean anchored on
  wrack + drift-marks, ray-crossing's file with pilot outriders,
  hourglass/keeper poses framing the patrol, empty-quarter composed
  bareness (the pale horizon slab flag stands — pre-fill distance
  geometry, the region owner's).

**Sweep: 11/12 three-layer, the miss inside a registered rest —
STANDARD MET.** 01 dune face under glints against the glass rim; 02
Glass Reach roses + seams + fin ranks; 03 a lee garden under dune
walls; 05 the shore edge; 06 crest wire on the skyline over drift
trails; 07 the monolith avenue over pebble drift; 08 tuft-scattered
dune ocean; 10 the lee vale; 12 a sand-rose anchoring the reach — all
carry near instances + mid dune + distance landmark. 04/09 are the
thin cases (big dune walls with sparse near tufts) but both hold three
honest layers past the r3 wire/grit boost. 11 looks into the Hourglass
bowl floor — the Drain's Eye rest, bare by design with the pool glow
and terrace treads composing it.

**Budgets at close: 90 draws / 510,334 tris** (before the fill: 47 /
136,326; caps 260 / 1.35M — the quality-first licence spent on blade
profiles and paint, not raw count). **Headed frame gate: median
16.7 ms (59.9 fps), p95 18.6 ms, settled scale 1.00** at BOTH probe
poses (`oasis` 504.5,−0.6,3.8 — the densest interior — and
`saddle-reveal` 250.6,5.0,26.9), measured on the shared box at load
~20 with a sibling capture running; 16.7 ms is the 60 Hz vsync
cadence, i.e. the region holds refresh at full scale. Gate ≤16.9 ms:
**PASS**.

## Fill close-out — gates and the canonical roster

- **Gates**: `tsc --noEmit` clean; `eslint src/world/regions
  tests/regionGolden1.test.ts --max-warnings 0` clean; targeted vitest
  (regions + regionGolden1 + kitGround + kitLife) 119/119 green; full
  `npm test` 769/770 — the ONE failure is
  `tests/regionSmoking1.test.ts` (Smoulder containment, a cross-branch
  merge artefact between that region's code and its repaired test;
  nothing on this branch touches either — EXTERNAL FLAG for the
  orchestrator, it failed identically before this fill's first
  commit).
- **No-assets fallback (20/20 read)**: the fill is procedural end to
  end, so every composition survives asset blocking byte-for-byte —
  same gardens, stands, roses, dapple, beams, eels, shoal, remoras.
  close-wire-crest's fallback frame even catches the traveller shoal
  cresting the dune behind the authored stand.
- **Canonical capture roster** (all under `visual-qa/`, all READ):
  authored+close `20260731-1432_*_go-filled.png` (20), sweep
  `20260731-1543_SWEEP-*_go-filled.png` (12), fallback
  `20260731-1619_*_go-filled-noassets.png` (20).
- **Standing flags**: (1) the pale horizon slab at the empty-quarter
  horizon — pre-fill distance geometry, the region owner's; (2) the
  Keeper's wall-clock patrol phase makes hourglass/keeper poses
  noisy between capture sessions — documented, not a regression;
  (3) the smoking-marches test failure above — external.
