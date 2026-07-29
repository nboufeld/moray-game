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
