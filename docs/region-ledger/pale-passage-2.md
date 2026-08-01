# pale-passage-2 — THE LANTERN COMBS (the Pale Passage's depth-2)

Region worker ledger. Slot `pale-passage-2`, province The Pale Passage,
depth 2 — no gateway wing; the inbound connection is the depth-1 →
depth-2 pass from the Bone Meadows' far rim. Disc centre r = 940 on
azimuth 3.87 (world ≈ (−705.0, −621.6)), radius 220. Seed
`SEEDS.regionPale2` (0x5a4d_0c08) and `^` substreams only. Built to the
full R12 standard from the first draft (the Canopy Deep's way): no
wedge era, no separate fill pass — density, quality, light and life ARE
the build.

## Concept

The Bone Meadows answered "life returns"; this region answers **where
the pale light comes from**. The province's gradient row is "paper held
to a lamp" — depth 2 swims BEHIND the paper, toward the lamp. Past the
Mother-Coral's colour-return the far rim goes white again — not the
white of death this time but the white of LIGHT: a country of great
wind-curved chalk comb-fins standing in swept ranks (a new silhouette —
no meadows, no bone thickets), translucent paper-fan corals lit through
their own tissue, sunken MOONMILK POOLS of luminous pale water, the
strictest hush in the game (THE WHITE CHAPEL — a ring of inward-curved
fins around a bare pearl pan where nothing moves but one beam), and at
the far heart THE LAMP: a 25 m hollow chalk lantern-spire, its ribbed
cage holding a warm light over a garden of lantern-anemones — the lamp
the whole province's paper is held to. An ancient chalk-white nautilus,
THE LAMPWRIGHT, tends it on a slow circuit through the ribs.

The story number is `lumen(u, v)` in [0, 1] — how near the lamp the
light feels: 0 at the threshold (the Bone Meadows' milk carried across),
1 in the Lamp Basin. Ground warmth, fan density, anemone glow and the
water's own warmth all read this one gradient; the White Chapel is held
COOL by hand (its austerity is authored — pale country keeps its hush).

## The depth-2 pass (the province's second inter-region connection)

The Bone Meadows' disc ends at u ≈ 665 on the spoke; ours begins at
720. The pass tongue is authored `approachTongue("pale-passage-2",
{ fromR: 635, toR: 790, halfWidthFrom: 16, halfWidthTo: 56 })` — it
starts **30 m inside pale-1's rim**, so the two domains genuinely
overlap and the bounds handover has no gap (asserted in
`tests/regionPale2.test.ts`: both weights > 0 on the spoke between 635
and 665, and our weight > 0 continuously along the spine 637–790).

Three authored bands (the verdant-2/3 pattern, third use):

- **The Saddle Reach** (u 635–745): a milky crest shelf at dune level
  over the Bone Meadows' own rim. Our weight is a whisper (0.14, the
  threshold gate) so pale-1 keeps carrying the water, mood and terrain
  across the overlap; we own only the bounds. The gate also hides the
  framework's depth-boundary reject circle (`RegionField` consults a
  depth-2 region only within `radius + 40 = 260 m` of its centre —
  u ≥ ~680): below that our terrain target is held at dune level
  (asserted), so the step at the reject circle is centimetres.
- **The Winnow** (u 748–812): the pass is a place — six chalk
  root-steps down ~20 m in a slot between the first two great comb
  fins, light blades slanting through, the descent's dark breath (the
  Winnow Shadow rest) held at its foot. The Comb Gate stands at
  u ≈ 752 — deliberately past u 731: pale-1's far-side distance rings
  cross this pass at u ≈ 681/707/731 as opaque `fog:false` curtains
  (the Emerald Gate lesson, applied at authoring time), so nothing of
  ours composes before that line except threshold waymarks.
- **The country** (the disc).

## Sub-biome map (spoke coordinates: u along azimuth 3.87, v lateral CCW)

| Sub-biome | Where | Floor |
|---|---|---|
| The Saddle Reach (threshold) | u 635–745 along the pass | +0.2 → −2.2 milky shelf |
| The Winnow | u 748–812, comb-walled slot | 6 × −3.3 steps → −19.8 |
| The Comb Galleries | u 815–1000, fin ranks over rolling floor | ≈ −13, swells ±1.6 |
| The Moonmilk Pools | (895,−55) r10 / (927,−34) r7.5 / (958,−64) r12 (+ the Still Pool (872,−84) r9) | −17.5 → −19.5 luminous bowls |
| THE WHITE CHAPEL | (905, 74) r 30 fin ring | −9.5 pearl pan |
| The Lamp Basin | (1022, −4) r 52 | −27 crater under the Lamp |
| The Pearl Steps | u 1075–1135 toward the far gate | −13 → −6.5 terraces |

Vertical range: threshold +0.2 → basin −27 (≈ 27 m of terrain; the
combs add 22 m of standing silhouette above the gallery floor).
Ceiling: 3.8 m at the threshold (meeting pale-1's closed far rim),
vaulting to 12 into the Winnow, easing to 10 over the country (the
paper-light presses close — 23–37 m of water), closing to 3.4 at the
far rim.

## Registered rests (for MASTER §1.2 — the region's contributions)

| Rest | Where | Licence |
|---|---|---|
| THE WHITE CHAPEL | r 26 at (905, 74) | the strictest hush in the game: nothing moves but its one beam; no fauna, no scatter, no motes inside the fin ring |
| The Still Pool | r 9 at (872, −84) | a glass-flat pearl floor; no bubbles, no fauna, no scatter; its rim fronds stop at the lip |
| The Winnow Shadow | u 776–800, the channel's width | motes only; beam-free, scatter-free — the descent's held breath |

## Landmarks (a reveal every 20–40 m)

1. **The Saddle Waymarks** — comb-splinter stones pacing the shelf
   road every ~25 m (u 645–740), the first things of ours the fog
   gives up on the threshold (before pale-1's rings, which own
   everything beyond until u 731).
2. **The Comb Gate** (u ≈ 752) — two great inward-curving fins forming
   the slot doorway into the Winnow.
3. **The Winnow** — the six-step descent between overlapping fins,
   slanted light blades crossing the slot.
4. **The Gallery Crossing** (u ≈ 818) — the descent's foot: the comb
   country opens in one breath, ranks of white fins into the fog.
5. **The Great Comb** (u ≈ 900, v ≈ 6) — the tallest fin arc, 22 m,
   its flank crowded with lit paper-fans.
6. **The Moonmilk Pools** — three luminous bowls with pearl lips and
   frond gardens (a fourth, the Still Pool, holds the hush register).
7. **THE WHITE CHAPEL** — the fin ring around the pearl pan; one beam.
8. **THE LAMP** — the region's landmark: the 25 m hollow lantern-spire
   in its crater, ribbed cage glowing warm from inside, the province's
   named light peak.
9. **The Lantern Gardens** — anemone-lantern beds down the basin's
   slopes, warm sparks under the Lamp.
10. **The Pearl Steps** — chalk terraces rising toward the far gate.
11. **The Far Gate** (u ≈ 1128, v ± 14) — the leaning needle pair
    framing the reserved depth-3 corridor and the painted DAYSPRING
    beyond (the forward promise: the place the light rises from).
12. **The Lantern Drift** — the moving centrepiece: seven moon-jellies
    on one slow closed procession along the gallery road.

## Life (T4/T5 systemic, short of saturation)

- **Pearl dust motes** (drift, region-wide) + **pool breath columns**
  over the three lit moonmilk pools.
- **The pearl file** (kit shoalRunner, ~44 pearl-white fry — the
  province's one shoal light): walks the road threshold → galleries →
  basin and home; life as wayfinding on the pass.
- **THE LANTERN DRIFT** — seven moon-jellies (exclusive, instanced,
  closed-form pulse and bob) touring gallery → pools → basin.
- **Perchers** (kit): porcelain brittle-stars on comb feet; whelk
  shrimps at pool lips; moth-fry hovering in the Lamp's light.
- **Glow colonies** (kit): pearl lamps at pool rims; the Lamp's warm
  interior garden; lantern-garden accents. (Pale is not a dark
  register: all light here is warm paper-light — nothing burns cold.)
- **THE LAMPWRIGHT** — the findable resident (`comb-lampwright`,
  *Nautilus lucernifer*): an ancient chalk-white nautilus, shell
  banded like paper over a lamp, on a slow closed circuit through the
  Lamp's ribs; codex entry in the def's pure half; DiscoveryTarget at
  the Lamp's mouth window, crossed twice a loop.

## Density tiers (doctrine table, per zone)

- **T1**: gallery sward (blade carpets, warm paper-gold over violet
  shade, sunGlow); road blades pacing the spine; threshold milky
  blades (pale-1's light carried across, 20+ m lerp); pool-rim and
  basin frond rosettes (pearl-seafoam); rim-hem tufts (F-R3 flank
  bands); step tufts; pearl grit + comb-shard litter (two-tone with
  genuine violet-bone — the Bone Meadows' camouflage lesson pre-paid);
  graded split-stone runs at fin feet.
- **T2**: pale paper bushes (kit bushBank, gold tips, violet crotches,
  blush bud accents); scree aprons at every fin foot, jamb and needle
  (things grow FROM somewhere); pearl clusters at pool lips.
- **T3**: ~30 comb fins in three swept ranks + gate pair + chapel ring
  + far needles; THE LAMP; paper-fan corals (instanced, translucent
  warm); lantern anemones.
- **T4**: as Life above. **T5**: slanted comb-slot blades + walk-line
  pools (kit beamAndPool), the chapel's single beam, the Lamp shaft
  (named light peak), pool lights.

## The palette (the region's own light, not the kit demo's)

Warm paper-white 0xf2e9d6 / violet-cool white 0xe1e2ef on the chalk;
shadows always violet with red above green (0x8d78ab ground family);
the warmth family is LAMP GOLD 0xeec98e → 0xd9a86a (never orange);
pool register pearl-seafoam 0xd8ecdc; blush accents 0xf0b6c4 kept to
buds. Fill palettes are keyed for paper light: warm whites and violet
shadows, never grey mush (the Bone Meadows' round-3 lesson).

## The depth-3 reservation (pale-passage-3)

The spoke continues: pale-passage-3 sits at centre r = 1460, azimuth
3.87 — its future pass tongue will run `fromR ≈ 1130` (30 m inside OUR
rim at 1160) down the same spoke, exactly as we reached into pale-1.
Reserved and framed on our side from draft one:

- **Our far-rim seal ring is PARTED over the corridor** (`farGate(u,v)`:
  u ≥ ~1080, |v| ≤ ~22) — no orchestrator cut will be needed on our
  seals (the verdant-2 lesson, pre-paid).
- **Our distance rings PART over both corridors** (MASTER R4): the
  inbound gap toward pale-1 (half-angle 0.42) and the reserved outbound
  gap on the spoke (half-angle 0.30).
- **The Far Gate needles** (u 1128, v ±14) and the Pearl Steps frame
  the corridor; the painted DAYSPRING (a warm-white glow horizon with
  flanking font-tower cards at |v| 26–40, feet clear of the future
  tongue's half-width) makes the promise without standing in the
  future threshold's spine.
- Terrain and ceiling keep the standard rim shape (dune-level crest,
  3.4 m ceiling) — the same low-crawl handover shape pale-1 gave us.

## Seeds

`SEEDS.regionPale2` (0x5a4d_0c08) with `^` substreams: terrain
0x7e01–0x7e05, ground paint 0x5ae1/0x5eaf/0x70af/0x51b0/0xb1d5, combs
0x0a01+/0x0b01 (chapel)/0x0aef, lamp 0x0c01–0x0c05, gardens
0x2a01/0x2b01/0x2c01, cover 0x3001–0x30f0, light 0x11f9, life
0x40a1/0x40a2/0x41a1/0x42a1/0x43a1–0x43a3/0x44a1–0x44a3/0x45a1,
lampwright 0x0ee5, distance 0xd159/0xd210+. Runtime updates spend no
randomness — captures settle deterministically.

## Budgets

Measured programmatically by the region test's own traversal; caps are
R12's ≤260 draws / ≤1.35M tris, bound by the headed frame gate
(≤16.9 ms median at scale 1.00 at the densest pose). Numbers per round
below.

## Critique history (silhouette → value → colour → detail, per round)

### Round 1 (`pa2-r1`) — the R5 blackout found by probe; the value key fails everywhere it can

Draft-1 measured 59 draws / 738,924 tris; 26/26 region tests green.
18 authored + 12 sweep captured. **Seven authored frames came back
FLAT VIOLET** — deterministic, not the compile race. Probed in a live
browser (node-toggle at scene level, then a show-one-at-a-time pass):
hiding the LIGHTS restored the world, and exactly two region children
each reproduce the wash alone — `pale2-lamp` and `pale2-lampwright`.
Root cause: **both shipped without a `normal` attribute** —
`smoothNormals` silently no-ops when none exists (every other module
called `computeVertexNormals` first), and a LIT toon mesh with no
normals rasterises as a full-screen violet wash. This is MASTER R5's
documented class ("lit geometry shipping without a normal attribute"),
reproduced and cured at authoring time. Fix: `mergedMesh` computes
normals when missing; the Lampwright's shell/body compute theirs; a
region test now walks every lit mesh and asserts the attribute.

The eleven readable frames, silhouette → value → colour → detail:

- **Silhouette — the bones stand.** The Comb Gate composes (two curved
  fins, slot doorway, slanted blades); the Winnow reads as a walled
  descent; `gallery-crossing` layers fin ranks into the fog with the
  jellies drifting between; `pearl-steps` frames both needle horns on
  the crest; the Still Pool bowl + flanking fin compose. The comb
  silhouette IS a new country — the concept survives contact.
- **Value — the region's one systemic failure, in every frame.** The
  Bone Meadows' complement lesson arrived here on day one: every fill
  family keyed below the paper's value reads as a DARK VIOLET SPRIG
  (road/threshold/sward blades), the split stones read as blank purple
  boxes, the jelly bells grey. And the ground's violet stories
  (channel shadow, riser shade, comb shade) are so strong the
  `winnow-hush` frame is a flat purple wall — the paper is gone.
- **Colour** — water reads teal-mint rather than the province's milk
  (densityGain 0.0075 also merges the fins to flat mint by ~35 m);
  the basin ground reads BROWN mud, not lamp gold (the gold stories
  sit at mid value under the milk — grey-mush cousin).
- **Detail** — the lantern anemones read as TAN MUSHROOM LAWNS (caps
  too flat and broad, spacing uniform); near fields are bare over
  broad mauve swells (three-layer law fails on the ground layer);
  the pass sheet's trim reads as patchwork against the dunes at the
  close road pose.

Sweep r1 (read in full): the same classes — mid silhouettes pass
almost everywhere (the fin ranks carry), foregrounds fail on bare
ground + sub-pixel dark sprigs.

Sweep r1, all twelve read against the locator (offline reproduction of
the seeded stream — `tests/pale2SweepWhere.probe.test.ts`): **2 eaten
by the R5 blackout** (02, 04 — both frusta hold the Lamp), 3 pass-ish
(07 gallery heart, 09 fin close-up with fans reading, 11 comb skyline
+ 12 pool flank on composition), the rest FAIL one way: **the broad
flanks are bare** — 01/03 stand on the south-west band (u ~925–935,
v −118..−137, INSIDE the rim hem's inner edge), 05/06 on the south-east
quadrant beyond the basin, 08 a down-shot of naked mauve with two road
pebble streaks, 10 the south steps flank. The authored zones cluster on
the road band; the doctrine's rule 3 (every square metre a deliberate
cover state) is not yet true of the flanks. Round 3 carries the density
order; round 2 first cures the blackout and the value key (no density
judgement is honest while every blade renders as a dark sprig).

**Round-2 orders**: (1) the R5 cure + regression test; (2) value pass
— every fill palette lifted ABOVE the ground (paper-warm tips, violet-
WHITE shades), a warm emissive floor on the cover families (the
verdant-2 dusk-lift, keyed for paper light); (3) ground violet halved
everywhere, gold stories lifted toward candle-through-paper; (4) fog
densityGain 0.0075 → 0.005 with a milkier colour scale so the comb
portraits keep paint to ~55 m; (5) anemones rebuilt as clustered
glowing pinheads (smaller, rounder, brighter, clumped); (6) road
pearl-pebble run + threshold milk thickened; (7) fin paint amplitudes
up (strata banding, crest lift) so near fins read painted chalk.

### Round 2 (pa2-r2) — the blackout cured; the value key half-won; the chalk unpainted

All 18 authored + 12 sweep frames read. **The R5 cure holds**: every
frame renders; the Lamp's cage reads on the skyline from half the
region (sweep 02/04, both r1 blackout frames, now carry it as the far
layer). The value pass moved the fills from dark sprigs to readable
blades in the near field — the winnow banks' gold moss, the road
band, the pool-rim rosettes and the rebuilt anemone clumps (12's
lantern dots) all read. What still fails, frame by frame:

- **The chalk is UNPAINTED at portrait range.** `great-comb` reads one
  flat cream wall; `close-gallery-floor`'s fin flank is a flat
  mauve-pink sheet. Root cause found in code, not paint: the fin,
  lamp and needle geometries ship NO `uv` attribute, so
  `chalkTexture` samples one texel — the whole map does nothing.
  Strata amplitude tuning cannot fix a texture that never varies.
- **The pass ground is still a violet-lavender wall** (`the-winnow`,
  `winnow-hush`): the banks' slopes face away from the sun, fall into
  the toon ramp's dark band, and the violet ambient owns them; my
  riser/channel/shadow paint stacks more violet on top.
- **The lamp heart reads as a flat tan ball** from the lamp-heart
  pose: the gradient is keyed bottom-dark and the pose looks at the
  bottom. The rib inner faces lean pink; a small bright ellipse
  (the beam pool sprite edge-on) floats under the heart.
- **Value at distance**: sward roots still render dark at range (the
  violet shade hex is below the ground's value); the split stones
  read as violet boxes (toon-dark faces, oversized by the grade).
- **Fans**: the sun-through-paper reads, but too dark and too orange
  against the paper — hinge and rim both need a value lift, the
  emissive floor a step down.
- **Poses**: `moonmilk-pools` looks across a ridge that hides its
  subject; `white-chapel` stands too far out — the ring reads as
  distant hills, not architecture; `pearl-steps`' Dayspring warmth is
  invisible (the font cards fall outside the frame; the gap shows
  plain horizon fade).
- **Threshold**: pale-1's rose fills own the pass-threshold frame
  (correct — its build margin covers u 642), but OUR side is thin:
  the milk blades and pebbles need weight, and the frame needs a
  waymark pair inside u 660–700.

Sweep r2, all twelve read: **5/12 carry three layers** (04 marginal,
07 gallery heart, 09 fin close-up, 11 comb skyline, 12 pool flank
with anemone lanterns). The seven misses are ONE class: **the broad
flanks are bare** — 01/03 SW band, 05/06 SE quadrant, 08 naked
down-shot, 10 south steps flank, 02 threshold flank. None are
registered rests. The doctrine's rule 3 is still not true of the
flanks; the cover counts and gates were keyed to the road spine.

**Round-3 orders** (value + paint + density, in that order):
1. **UVs on all chalk geometry** (fins, needles, lamp foot/ribs/crown,
   waymark splinters) so `chalkTexture` actually paints; scale ~6 m
   per repeat, station × height parameterisation.
2. **Pass ground de-violeted**: riser/channel/shadow lerps and value
   drops halved again; a pre-lit warmth floor over the whole pass
   band (value +0.08 gated on the pass story) so the toon-dark band
   reads paper-in-shade, not lavender; the cool white warmed a step
   and its patch lerp softened (the lavender puddles).
3. **Mood compromise**: densityGain 0.005 → 0.006, hemisphere 0.22 →
   0.3, sun 0.5 → 0.48 — the extra hemi softens the toon-dark band
   that owns every away-facing slope.
4. **Flank density** (the sweep's one systemic failure): sward count
   5200 → 7800 and its gate floor raised with the u-door widened to
   790; rim hem band widened inward (rc 150 → 132); grit 2200 → 3200;
   shards 1100 → 1400; paper bushes 56 → 74 over u 790–1120; road
   pebbles 700 → 900; threshold milk 900 → 1250 over width 26.
5. **Shade hexes lifted above the ground's value** across all carpet
   families (the b2a4cc family → c7bbd8 class); splits sized down
   [0.12,0.3] → [0.1,0.22], grade 0.6 → 0.4, shade lifted.
6. **The heart rekeyed**: base value 0.3 → 0.56, gradient softened,
   emissive 0.5 → 0.62 — a light from EVERY angle; rib inner gold
   less pink; the lamp beam pool pulled in (r 10 → 7, the ellipse).
7. **Fans re-valued**: hinge 0.62 → 0.74 class, rim toward warm
   cream, emissive floor 0.3 → 0.22.
8. **Anemone gardens fuller**: 24 → 30 hearts, 6–10 → 7–12 per clump.
9. **The Dayspring made real**: a warm additive veil plane deep in the
   outbound gap + the font cards pulled into the corridor's frame
   (angular flank band tightened, radii pulled in).
10. **Poses**: moonmilk-pools moved onto the bowls' lip; white-chapel
    into the ring's doorway looking in; chapel fins raised a step so
    the ring reads as architecture from inside.

### Round 3 (pa2-r3) — the chalk paints; the region arrives; two paint bugs left

All 18 authored read (sweep read below, same session). **The UV cure
is the round's headline**: the Great Comb carries horizontal strata
down its whole bowed blade, the comb-gate fin reads painted chalk at
portrait range, the waymark monoliths took grain, the Lamp's foot
mottles like real material. The value orders landed: `the-winnow`'s
right bank is warm tan with moss and litter; `gallery-crossing` is a
pass (warm swells, jelly overhead, fin ranks layering, light blades);
`the-lamp` is the region's proof frame — cage, glowing heart, beam,
jelly, milk; `lamp-heart` shows a warm gold lantern ball (the rekey
worked); `lantern-gardens` reads full (clumped lanterns, warm basin,
Lampwright's shell in the cage); `still-pool` composes bowl + strata
fin; `close-road-shelf` is road-as-place (milk blades, pearl pebbles,
textured waymark); `close-gallery-floor`'s fin flank is real material.
`white-chapel` from the doorway reads composed (pan, beam, ring at
depth, Lamp far-left) — passable, if not yet cathedral. What fails:

- **The threshold patchwork** (`pass-threshold`, `close-road-shelf`
  lower-left): in the pale-1 overlap (u 640–705) our pass sheet pokes
  through pale-1's coarser dune triangulation — 7 cm of sink is not
  enough where their 2.2 m grid curves over dune crests, and our
  MILK-bright paint makes every poke-through a white flag over their
  tan. TWO cures, both ours: sink the sheet's overlap span deeper
  (feathered −0.25 → −0.07 across u 660–708) and key the handover
  milk DOWN toward pale-1's own dune tan.
- **`winnow-hush` is still a mauve wall**: the pose at lift 2.0 fills
  the whole frustum with one away-facing bank slope, and no paint
  order can make one toon-dark surface a composition. The pose is
  wrong, not (only) the paint: raise the eye, pitch up at the fins
  and the light — the rest reads as a held breath only if the frame
  holds what the breath is FOR.
- **`white-lookback`**: the swell hides the comb skyline (lift too
  low) and its away-facing slope still reads brown-mauve with dark
  sprig-marks at range — the residual value gap between the ground
  bake and the shade hexes at distance.
- **The basin runs terracotta** (`close-garden-bed`): LAMP_HEART's
  caramel at 0.65 lerp under the violet ambient reads rust-orange mud
  up close, not candle-through-paper. Story hex lifted, lerp eased.
- **The Dayspring is still a rumour** (`pearl-steps`): the needles
  frame it, but the veil at (0.34,0.24,0.11) peak is a whisper against
  the mint backdrop and the font towers at angular offsets ≤0.42
  stand outside the frame's edges. Veil brighter and closer; fonts
  INTO the gap's flanks (0.13–0.34, feet still |v| ≥ 27 — clear of
  the future tongue by construction).
- **A crimson sprig at the Still Pool's lip** (`still-pool`): legal
  (outside the 9 m rest) but it draws the eye in the game's second-
  strictest hush — the rest's gate radius widens to 12.5.
- Nits: the splits still read violet-boxy up close (shade lifted
  again); the cool-family fin flank leans saturated lavender in
  close quarters (material colour a step up); moonmilk bowls read
  but under-sell (pearl value bump up, pool light up).

**Round-4 orders**: (1) threshold overlap sink + milk toward pale-1's
tan; (2) winnow-hush pose raised/pitched at the light, shadow lerp
eased a hair; (3) white-lookback lift 5 → 7.5; (4) LAMP_HEART
0xe4b87e → 0xefd0a0, heart lerp 0.65 → 0.5; (5) veil peak ×1.6 and
r 306 → 296, fonts into the gap flanks; (6) Still Pool rest radius
12.5; (7) splits shade 0xd6cbe4; coolChalk 0xe3e5ee → 0xeaecf4;
MOON_PEARL bump 0.18 → 0.24, pool lights 0.12 → 0.16; sward shade
0xc7bbd8 → 0xd4cbe2; basin fronds shade warmed.

### Round 4 (pa2-r4) — the orders land; three small marks left

All 18 authored read. **The threshold patchwork is cured**: the sunk,
tan-keyed handover sheet hands pale-1's dunes over without a white
flag (`pass-threshold` clean; `close-road-shelf` keeps only faint
low-contrast seam traces where pale-1's 2.2 m triangulation crosses —
the reciprocal cut, flag 1 below, retires those too). `winnow-hush`
is a composition at last — slot walls, fins and the light blades
above, the shadowed floor a base note instead of the whole frame.
`still-pool` holds a clean hush (the sprig is outside the widened
gate and out of frame). `great-comb`, `the-lamp`, `lantern-gardens`
(basin now candle-gold, lanterns clumped, Lampwright in frame),
`pearl-steps` (Dayspring veil finally a visible warm column between
the gate horns; font cards on the flanks), `white-lookback` (raised
eye clears the swell; comb skyline + jellies + anemone gold),
`comb-gate`, `gallery-crossing`, `the-winnow`, `close-pool-rim`,
`close-gallery-floor` — all pass. What remains:

- **`white-chapel` still under-reads** (the round's one fail): from
  the doorway the pan runs warm tan (chapelWeight is only ~0.7 at the
  camera's feet — the plateau ends at d 16 while the ring stands at
  26) and the far fins at 48 m are fog-mint hills, not architecture.
  Cure: widen the white plateau to the ring's own radius and step the
  camera in off the doorway so the far ring stands ~35 m out.
- **`lamp-heart`'s blue ellipse identified**: the heart lathe is OPEN
  at both poles (profile starts at r ≈ 0.46, no caps) — looking up
  from the cage foot you see the water column straight through the
  bottom hole. Cure: cap both poles with triangle fans.
- **The basin's deepest band still leans ochre** at close range
  (`close-garden-bed`) — one more gentle lift of the heart band, the
  wide shots are already right.
- Soft notes, accepted: the moonmilk bowls read as pearl sheen rather
  than pooled light from the lip pose (in register for the hush
  country); the splits still read a touch boxy at 1 m.

**The sweep**: 11/12 pass. 02/04/07/09 are the strong frames (04: the
Lamp's cage with the Lampwright inside it on the skyline; 09: road,
waymark, Great Comb wall, beam). 01/03/05/06 pass on the R4 hem and
sward steps — thin but composed. **08 fails again** (u 1119, v 39,
down-shot at the gate climb's north flank) — and the R4 order could
never have cured it: the visible slope runs rc 190–215, where the hem
falloff gave ≤ 0.17 strength, the tuft band stopped at u 1155 — and
above all the carpet SAMPLE AREA is a 196 m disc, so the hem's rc 205
gate span past 196 was never seeded at all. Not a rest; must be fixed.

**Round-5 orders (targeted)**: (1) heart pole caps (the lathe was open
at both poles — the lamp-heart ellipse was the water seen through the
bottom hole); (2) chapelWeight plateau 16 → 24, white-chapel camera
u 883 → 890 (far ring 48 → 41 m); (3) LAMP_HEART 0xefd0a0 → 0xf0d8b0;
(4) sweep 08's climb: rimArea radius 214 for the rim bands (the
sampling bug), hem gate rc ≤ 212 with falloff |rc−165|/55, step tufts
to u 1162 count 2400, and a climb-pebble strip (u 1080–1162,
rc 172–212, 520 two-tone). Full authored + sweep recapture on final
code.

### Round 5 (pa2-r5) — 18/18 authored; the climb strip starves

**All 18 authored pass.** `white-chapel` composes at last — doorway
fins flanking at strata range, the pan pearl-white to the ring, the
one beam standing at centre, the far ring as fins instead of hills.
`lamp-heart`'s ellipse is gone (the pole caps took the bright base
colour — a solid warm lantern from below). `close-garden-bed` keeps a
warm ochre at the Lamp's very foot even after the second lift —
ACCEPTED as the authored register: the basin is the province's one
warm extreme (candle-gold, lumen = 1), the layers all read, and the
wide basin shots are right. All other frames hold their round-4 reads.

**The sweep**: 11/12 again, and **08 still fails** — a couple dozen
stones where 520 were ordered. The r5 order was HALF right: rimArea
lets the rim bands sample past 196, but `scatterPoints` seeds its
clump hearts across the WHOLE area disc and caps attempts at 40 ×
count — a gate window that is ~7% of the 214 m disc starves before it
fills (the acceptance is ~2%). And the pose's centre line runs out to
rc ≈ 212, the disc weight's own feather. The kit's idiom for narrow
bands is the POLYLINE area (the road pebbles' shape) — sampling
concentrated where the strip lives.

**Round-6 orders (one sweep cone)**: the climb strip becomes a
polyline arc at rc 191 across the gate sector (φ ± 0.38, width 44) —
pebbles ×700 + short pearl tufts ×900 on the same stations, both
gated by the old u/rc window; stepTufts looseShare 0.75 (clump-led
scatter starves narrow bands). Budgets after: 64 draws / 1,203,860
tris. Full authored + sweep recapture.

## Flags for the orchestrator (the reciprocal cuts — NOT made here)

Measured exactly, pale-1's geometry crossing OUR corridor (we may not
edit `src/world/regions/pale1/**`):

1. **Pale-1's far-rim seal ring crosses the pass corridor.** Its
   `buildSeals()` rim ring stands at ITS rc 206 — on the spoke that is
   u ≈ 651 — with stations every ~13.8 m (94 around) and spheres
   r = 9 at terrain + 1.5, gated open only over its own inbound ravine
   (u < 310 on its side). **Cut a gate over this pass tongue's width
   (|v| ≤ ~18 at u 637–665)** when the depth-2 connection goes live —
   the exact move fbab214 made in verdant-2 for the Canopy Deep.
2. **Pale-1's far-side distance rings cross the corridor at
   u ≈ 681 / 707 / 731** (its ring radii 236/262/286 from centre 445;
   its card bands rc 238–280 → u ≈ 683–725). Its `GAP_HALF = 0.42`
   gap faces its own ravine only (gapAt = azimuth + π). They are
   opaque `fog:false` curtains: nothing of ours exists to a camera
   before them — our gate composition therefore lives past u 745.
   **Part its far ring sector + card bands over the corridor** with
   the same gate.
3. **The framework's depth-boundary reject circle** (`RegionField`,
   radius + 40 = 260) truncates our terrain/mood application below
   u ≈ 680. Authored around (threshold whisper-weight, dune-level
   target below u 700), documented in `Pale2Terrain`, asserted in
   tests. No action needed — recorded for the map.
4. Our pass-shoulder seals are invisible walls over open shelf — the
   standing trade at every rim.

## Capture sets

(appended per round)
