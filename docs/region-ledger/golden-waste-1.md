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
