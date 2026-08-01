# golden-waste-3 — THE VESPER STRAND (the Golden Waste's depth 3)

Region worker ledger. Slot `golden-waste-3`, province The Golden Waste,
depth 3 — the province's LAST chamber; the inbound connection is the
depth-2 → depth-3 pass the Carillon Waste reserved at its Sunset
Spires. Disc centre r = 1460 on azimuth 6.39 (world ≈ (1451.7, 155.7)),
radius 220. Seed `SEEDS.regionGolden3` (0x5a4d_0c0f — pre-registered in
the SEEDS table; no registration was needed) and `^` substreams only.
Built to the full R12 standard from the first draft: no wedge era, no
separate fill pass — density, quality, light and life ARE the build.

## Concept

The Hourglass Sea was the desert's sand; the Carillon Waste was the
desert's bone; the desert's END is the end of the desert's DAY —
EVENING, made into a place. The last dunes pour over the Sandfall
Combe's three carved lips as golden fall-sheets (the sandfall-dunes
wing's opening motif returned at the province's close), and the diver
descends through falling light into THE VESPER FLATS: a salt-pale
evening basin where every stone of THE PROCESSION leans toward the
sunset and throws one long violet shadow back up the road it came by;
THE MIRROR PANS hold the sky on the ground (the largest is THE STILL
MIRROR — a registered rest); THE DUNE COMBS ridge both flanks; THE
AFTERGLOW GARDEN lights its candle-stones as the day goes; THE NIGHT
WELL sinks the desert's first dark below the flats; and on the far
rise THE SUN'S DOOR — a great natural arch squared to the whole
journey — frames THE SUNSET: the painted sun standing half-set at the
world's edge, the horizon the whole spoke has been promising. THE
LANTERN CARAVAN paces the road below; THE EVENING PILGRIM — an
ancient copper turtle — circles through the door into the last light,
forever.

The province's palette journey ends here (MASTER §1.1, the Golden
row): honey over violet arrives from the Carillon Waste and resolves
into evening — the honey deepens toward rose-amber, the violet grows
long, and the ground turns salt-pale where the light doubles in the
pans. As the spoke's terminus this region owns the final horizon: no
further pass is reserved, and the far pole's whole sky is the sunset.

## The depth-3 pass (the Sunset Shelf handover)

The Carillon Waste's disc ends at u ≈ 1160 on the spoke; ours begins
at 1240. The pass tongue is `approachTongue("golden-waste-3", {
fromR: 1130, toR: 1300, halfWidthFrom: 16, halfWidthTo: 56 })` — the
reservation its ledger wrote, honoured exactly: it starts 30 m INSIDE
golden-waste-2's rim, so the two domains genuinely overlap and the
bounds handover has no gap (asserted in `tests/regionGolden3.test.ts`:
both weights > 0 on the spoke between 1132 and 1160, and our weight
> 0 continuously along the spine 1132–1600).

Three authored bands:

- **The Last Shelf** (u 1130–1245): golden-2's Sunset Shelf carried to
  its end. Our weight is a whisper (0.14, the threshold gate) over the
  overlap so golden-2 keeps carrying water, mood and terrain; our
  threshold target MIRRORS its measured shelf fade (composed −2.2 at
  u 1130 easing to 0 by 1150 — probed before authoring), so the
  framework's depth-boundary reject circle (`RegionField` consults us
  only within radius + 40 = 260 m of centre, u ≥ ~1200) hides a step
  of centimetres (asserted). The gate rises to full ownership across
  u 1200–1222 — past golden-2's own domain, so the treaty is
  untouched and the honey mood arrives with the diver at our door.
- **The Strand Gate + the Sandfall Combe** (u 1245–1322): the pass is
  a place — two great leaning slabs (the hourglass's last grains) past
  golden-2's outermost distance ring (u ≈ 1226; the Emerald Gate
  lesson applied at authoring time — nothing of ours composes before
  that line), then three pour-lips dropping 9/9/8 m, each pouring a
  golden fall-sheet (kit fallStreak), with dune-crest flanks.
- **The country** (the disc).

## Sub-biome map (spoke coordinates: u along azimuth 6.39, v lateral CCW)

| Sub-biome | Where | Floor |
|---|---|---|
| The Last Shelf (threshold) | u 1130–1245 along the pass | −2.2 → 0 milky shelf |
| The Sandfall Combe | u 1252–1322, three pour-lips | 0 → −26 in three pours |
| The Vesper Flats | the disc's resting basin | −30 salt-pale floor, swells ±1.6 |
| The Mirror Pans | (1372,20) r9.5 / (1408,−26) r13 / (1452,34) r8.5 | dishes −1 with salt lips +0.4 |
| The Dune Combs | ellipses at (1420,118) and (1435,−122) | ridge crests to ≈ −26 |
| The Afterglow Garden | (1524, 46) r 48 | −27.5 apron; candles to ≈ −19 (built) |
| The Night Well | (1420, −92) r 12 | −40 pit, wind-lip +0.8 rim |
| The Sun's Door rise | (1600, −4) | −22 balcony; arch to ≈ −10.6 (built) |

Eight sub-biomes plus the pass bands. Vertical terrain range ≈ 40 m
(threshold shelf ≈ 0 → Night Well −40; test holds range ≥ 28, the
well ≤ −38, the shelf-to-well drop > 34); the arch and candles carry
built verticality. Ceiling: 3.8 m over the Last Shelf (meeting
golden-2's closed far rim at its own 3.4–3.9 m mouth), vaulting to
~12 down the combe, opening to 6 (absolute) over the basin (~36 m of
water), closing to 3.4 at the far rim — gated off the inbound pass
corridor only. The province ends here: the far pole never opens.

## Registered rests (MASTER §1.2 — this region's contributions)

| Rest | Where | Licence |
|---|---|---|
| THE STILL MIRROR | r 12 at (1408, −26), the largest pan | pan paint + its salt rim (kit matRings) only; its ONLY light is its own sky-pool (the held reflection); NOTHING moves in it — no crabs, no bubbles, no motes born in its bowl |
| THE PILGRIM'S THRESHOLD | r 8 at (1600, −4), the arch's foot | ripple-ring paint only; its only light is THE LAST LIGHT falling through the door; its only motion is the Pilgrim crossing above — the resident's own circle (the Drain's Eye / Pavement precedent, third use in the province) |

## Landmarks (a reveal every 20–40 m)

1. **The Last Shelf waymarks** — leaning stone pairs pacing the road
   every ~26 m (golden-2's Sunset Spires' idiom carried forward).
2. **THE STRAND GATE** (u ≈ 1250) — two great leaning slabs tipped
   against the water where the shelf becomes the combe.
3. **THE SANDFALL COMBE** — three golden fall-sheets pouring over the
   three lips; pour shafts lighting the falling water.
4. **The basin reveal** (u ≈ 1324) — the Vesper Flats open in one
   breath: the Foremost kneel, the Procession ranks into the fog.
5. **THE PROCESSION** — ~32 leaning pilgrim stones + 3 authored
   sentinels, every one leaning toward the Sun's Door, each throwing
   one long painted violet shadow.
6. **THE MIRROR PANS** — three salt-lipped dishes holding the sky;
   the Still Mirror is the rest.
7. **THE DUNE COMBS** — combed relic ridges on both flanks, marker
   stones on their crests.
8. **THE NIGHT WELL** — the desert's first dark: a violet pit with a
   kneeling stone ring and one amber blade.
9. **THE AFTERGLOW GARDEN** — ~33 salt-candle pinnacles with burning
   crowns, glow-bud lamps, the spring, the region's densest gardens.
10. **THE LANTERN CARAVAN** — ten amber lantern-jellies pacing one
    slow closed circuit of the spine road.
11. **THE SUN'S DOOR** — the great arch on the balcony rise, THE LAST
    LIGHT falling through it onto the Pilgrim's Threshold.
12. **THE SUNSET** — the painted final horizon: glow band, the
    half-set sun, violet cloud bars, the Last Isles.

## Life (T4/T5 systemic, short of saturation)

- **Gold motes** (900) + **midwater plankton** (1,600 large soft
  sparks — the province's proven density).
- **The traveller shoal** (kit shoalRunner, 48 gold fusiliers — the
  province's one shoal light): arrives down the pass from golden-2 and
  commutes the whole road to the Sun's Door and home.
- **THE LANTERN CARAVAN** — the moving centrepiece: ten lantern-jellies
  (lathed bells, fluted skirts, vein-glow crowns) on one closed ~150 s
  circuit of the spine road.
- **Perchers on every surface type**: cushion-star trios at candle
  feet, salt-crabs darting on the two unprotected pan rims (never the
  Mirror), hover-fry over the garden spring, whelk trios at the door's
  kneeling stones.
- **THE EVENING PILGRIM** — the findable resident (`vesper-pilgrim`,
  *Chelonia vespertina*): an ancient copper sea-turtle on a 72 s round
  through the Sun's Door — the gold seams of its shell one line per
  evening the sun set without it. Codex entry in the def's pure half;
  DiscoveryTarget in the arch's window, crossed every round.

## Density tiers (doctrine table, per zone)

- **T1**: ripple-grit (two-tone, graded), salt-plate shards spreading
  from the pans, road pebble runs; ground paint carries drift ribbons,
  salt crust, procession shadows, comb crest/lee, pan sky-floors,
  garden rings, well violet, door ripple-rings, rampart runnels.
- **T2**: road wire blades + basin wire (kit BLADE profile — never
  wedges); evening-pocket fronds in 29 authored pockets pacing every
  road and flank at 20–40 m; comb-lee tufts; garden sward + fronds +
  bushes; door tufts + scrub; split-stone runs at every standing
  stone's foot; violet well shards; three wrack drift-lines; four
  authored close-pose beds (the lily-bench law, paid up front).
- **T3**: ~35 procession stones (two merged draws with waymarks,
  gate slabs, lip stones, markers), 33 candles (one draw), the arch +
  flank stacks (one draw), pan rims (kit matRings).
- **T4**: as Life above. **T5**: the gold dapple (road + garden at
  the province's earned whisper opacities), THE LAST LIGHT (named
  light peak), the pour shafts, THE WELL BLADE, the pan sky-pools
  (the Still Mirror's licensed light), garden glints, spring bubbles,
  THE SUNSET composition.

## Budgets (measured by the region test's own walk; caps R12 260/1.35M)

- Draft 1: **69 draws / 899,334 tris**; colliders > 100, all inside
  the domain by test. Headroom held for the critique rounds.
- Final (after round 5's comb-tuft density fix): **66 draws /
  1,043,103 tris** — 25% of the R12 draw cap, 77% of the tri cap,
  bound by the measured frame gate below.

## Seeds

`SEEDS.regionGolden3` (0x5a4d_0c0f — already present in the SEEDS
table; nothing was added) with `^` substreams: terrain 0x7e11–0x7e14,
ground paint 0x5a11–0x5a15, rocks 0x51cb + 0x0aa1–0x0e31 shape seeds,
door 0x64a1–0x64b4, candles 0x65a1–0x65d0+, falls 0x66a1–0x66a2, pans
0x67a1, cover 0xf101–0xf114, life 0xe411–0xe418, pilgrim 0x0ef1–0x0ef3,
light 0x12f1–0x12f7, distance 0xd411/0xd421+. Runtime updates spend no
randomness — captures settle deterministically (every mover is
closed-form off `ctx.time`).

## The flagged reciprocal cut (for the orchestrator, at merge)

- **Golden-2's rim seal ring** (its `buildSeals` rimR 206 around its
  centre (934.6, 100.2)) crosses our corridor at spoke u ≈ 1146. Cut,
  in golden-2's `buildSeals` rim loop, mirroring fbab214/ae492ab:
  **skip ring stacks where `u > 1130 && Math.abs(v) < 15`** (spoke
  coordinates via its own `spokeOf`). Our shoulder seal rows stand at
  |v| = 15 over u 1136–1248, so the flank stays sealed the moment the
  gate opens.
- **Golden-2's rim ceiling-closure needs NO cut**: over the corridor
  its ceiling closes to a 3.4–3.9 m mouth above a ≈ −0.4..0 floor
  (probed) — a swimmable low doorway that matches our own 3.8 m
  threshold ceiling; the verdant-2 → verdant-3 handover shipped the
  identical shape.
- **Golden-2's distance rings already part** over this corridor
  (GAP_OUT_HALF 0.17 rad at its azimuth, taper 0.16 — authored in its
  round 4); no ring cut is needed.

## Critique history (silhouette → value → colour → detail, per round)

### Round 1 (`gw3-r1`) — the region composes; the stone and the lanterns are value problems

Captured against the dev server on :5210 (`SHOT_NAV_TIMEOUT=900000
SHOT_COMPILE_WAIT=5000 SHOT_PER_LAUNCH=1` — the province's
load-hardened harness, needed from the first session at 1-min load
~14 with sibling workers live). All 19 authored poses captured and
READ; the seeded sweep runs with round 2 (the r1 orders below were
already unambiguous).

**Silhouette.** The region EXISTS: `basin-reveal` opens on a genuine
evening — honey floor, long violet shadow lanes, the Foremost
kneeling, wire pacing the swells; `caravan-road` is the round's best
road frame (dapple streaking the floor like low light, the shoal
crossing, the arch on the horizon with lanterns pacing toward it);
`evening-horizon` PROVES THE SUNSET — the painted sun with its violet
cloud bars standing over the world's last wall; `still-mirror` reads
as a held bowl of light; `afterglow-garden` ranks its candle field
with the sun's disc showing over the rampart; `night-well` finds the
violet deep with the blade falling in. Fails, by size: **`pilgrim` is
a rust wall + a giant orange saucer** — the arch at 10 m reads
mottled rust-brown, and the 2.0-scale, 0.9-emissive turtle reads as a
comic UFO instead of an ember; **`close-door-foot` is one boulder** —
the kneeling stone stands 2 m from the lens and fills 70% of the
frame (the province's close-flute-foot lesson, relearned);
**`well-blade` frames the pit's featureless wall** (a hole reads only
against its own door — the stand must be ON the floor looking up the
blade at the rim); **`dune-combs` is a soft dune with no combs** (the
2.8 m ridges at 17 m pitch read as noise; the marker stones stand out
of frame); `last-shelf` and `pilgrim` are photobombed by BUSHES at
the lens (bush gates respected only the four close lenses — wide
stands need clearing too).

**Value — the round's headline, the province's oldest lesson.** The
pale stone family (0xd2a878) reads RUST-BROWN under the quarter-sun
— every procession stone, the arch, the gate slabs sit a full value
too dark and a step too red; the candles read carrot-orange with no
readable burning crown; THE LANTERNS ARE THE WORST OFFENDER: fog-free
saturated orange bells visible from 150 m read as parade balloons on
every horizon in the region (five frames photobombed). The Keeper's
fog-free licence is for a resident confined to its own circle, not
for ten movers pacing the whole map.

**Colour.** The honey mood carries beautifully at the horizon and on
the ground (the painted floor is the round's win: drift ribbons, salt
crust, shadow lanes, dapple all read); the water column above stays
the province's teal — correct register. BUT the threshold poses
(u < 1222) swim in base-blue water: the threshold gate held the mood
to a whisper long past golden-2's own domain (its weight ends at
u 1160; the reject circle already hides everything below 1200) — the
gate can rise at 1200 without touching the treaty. The VESPER
RAMPART — the world's last wall — is a giant FLAT BEIGE CURTAIN in
every far-pole frame: the runnel term is a whisper, and there are no
strata; the wall needs to be painted like the sunset is leaving it.

**Detail.** `close-pan-rim` nearly passes draft one (blades, salt
plates, pool, candle skyline); `close-comb-tufts` carries its near
band but the comb slope behind reads muddy and a dark tile-seam line
crosses it (the 2×2 grid crack — golden-2's hairline artifact, a
step louder here; the tiles will overlap-and-sink like the pass sheet
already does); `close-garden-bed` shows the candle family's orange
problem at 3 m and a smooth green bush mound at the lens (bush lens
clearance is 1 m — needs ~3.5). The sun sits a touch high for the
`suns-door` window (centre y 8; the window wants ~3), and the sunset
band + isles fade their alpha exactly where they show above the
rampart crest (the visible half is the transparent half — restructure
the rows so the body holds opacity and only the crest dissolves).

**Round-2 orders** (all landed before the r2 captures):

1. Stone families toward the province's proven pale: CARVED_PALE
   0xd2a878 → 0xd6b47e, DUSK_STONE → 0xac9070; candle bodies to the
   pale family with genuinely BURNING crowns (brighter crown band,
   wider, whiter); arch/gate value rises with the family.
2. Lanterns: `fog: true`, emissive 0.9 → 0.6, scale 1.5–2.1 →
   1.25–1.65, bells repainted amber-cream with near-white crowns,
   circuit lifted ~1 m.
3. Pilgrim: scale 2.0 → 1.4, emissive 0.9 → 0.5, shell repainted —
   dark copper plates, THIN bright gold seams (the drawing is the
   seams, not the glow).
4. The threshold gate rises at u 1200 (past golden-2's domain, inside
   our reject circle) so the honey arrives with the diver.
5. The rampart painted: runnels ×2.3, height strata, warmer crest.
6. Combs: amplitude 2.8 → 4.2 with a second harmonic; crest/lee paint
   contrast up; `dune-combs` pose moved into the field's heart.
7. Sunset: sun centre y 8 → 3 (half-set on the crest from the
   balcony, IN the window from the road); band and isles re-rowed so
   the above-crest body holds alpha; isles to rc 212, tops 10–13.
8. `standFree`: bushes (and their kin) clear EVERY authored stand by
   4 m and every close lens by 3.5 m.
9. Poses: `well-blade` re-authored from the pit floor looking up the
   blade; `close-door-foot` kneeling stone moved off the lens;
   `suns-door` lifted +1.5 with pitch 0.08.
10. Ground tiles overlap-and-sink (the pass-sheet device on the 2×2
    grid) so the comb seam line is backed by ground.
11. Grit 7,000 → 8,600; comb tufts 1,100 → 1,400 (brighter palette);
    basin wire 5,200 → 5,600.

## Round 2 — the read (17/17 authored captured)

**PASS (7):** `still-mirror` (the rest composes: pan, sky-pool, salt
rim, stone skyline), `mirror-pans`, `close-pan-rim` (the region's best
frame: blades, mat slabs, warm pool, gate skyline, rampart strata),
`caravan-road` (road streaks + waymarks + gate arch + lantern; two
pea-green bushes off-palette), `night-well` (violet deep + blade),
`pilgrim` (the resident finally reads as a small copper ember crossing
the window), `last-shelf` (bush photobomb cured, falls glinting;
water still cool at the doorstep — the honest handover, accepted).

**MARGINAL (5):** `suns-door` (sun seated in the window ✓, sunset band
✓ — but the blade reads teal and the arch merges into the wall),
`well-blade` (blade + petals ✓, walls flat), `afterglow-garden`
(candle crowns read, bodies still carrot), `procession` (stones the
proven pale ✓ but the stand reads the avenue as distant nubs),
`close-comb-tufts` (near band ✓; the tile-seam line SURVIVED the
overlap-and-sink — a 3 cm step still draws at grazing angles).

**FAIL (4):**
- `basin-reveal` — a lantern in the lens at point-blank. Structural,
  not phase luck: the caravan circuit's first station IS SPINE_ROAD[0]
  (1322, 0), two metres from the camera stand.
- `evening-horizon` — the Pilgrim at point-blank top-right (its home
  leg passes 6 m from the balcony camera), plus half the frame is the
  rampart's flat beige mid-band.
- `dune-combs` — the r2 stand stares into one lee face from below:
  a single flat brown slab. The combs exist (close pose proves it);
  the camera cannot see them from inside a trough.
- `close-garden-bed` — traffic-cone candles (emissive wash saturates
  the whole taper) + pea-green sward/bushes out of the province's
  palette.

## Round 3 — orders (all landed)

1. Caravan circuit starts one station down the road (never again at a
   camera's feet); flight −0.6 m; scale 1.25–1.65 → 1.0–1.3.
2. Pilgrim home leg pushed north to v ≥ 22 (clears the balcony camera
   by ~12 m).
3. Candles: emissive 0.6 → 0.32 and hex cooled to umber (the crowns
   burn through the near-white paint, not through a body wash); body
   paint base lift 0.34 → 0.5.
4. The whole garden green family to olive-gold (sward, fronds, bushes,
   close bed) — sunset grass, not spring lawn.
5. ONE disc ground sheet (211 segments) — the 2×2 grid is gone, and
   with it the seam; three draws saved.
6. Rampart runnels overshoot for the fog (0.32 → 0.5, value −0.2) and
   the strata band doubled.
7. Door family dusk-lift 0.25 → 0.36 warm (every touring pose sees its
   shade side by design; it crushed at close range).
8. THE LAST LIGHT warmed 0xffdf9c → 0xffc87a, beam 0.16 → 0.19, pool
   0.2 → 0.24 (the r2 blade read teal over the honey water).
9. Poses: `procession` dollied into the ranks at the Tall Pilgrim;
   `dune-combs` raised to 7 m raking along the crests; `evening-horizon`
   raised to 9 m (sky and sunset over wall).
10. The combe-foot drift line pushed 16 m down-road off the
    basin-reveal lens; wrack palette brightened a step.

## Round 3 — the read (17/17 authored captured)

**Every frame now composes.** The four r2 fails are cured: `basin-reveal`
(no lantern, no litter blob — the shadow-streaked road opens the basin
between the Foremost pair), `evening-horizon` (no Pilgrim; the sun sits
half-set on the crest under its amber cloud band), `dune-combs` (raked
from 7 m the ridge country and its skyline read), `close-garden-bed`
(the sward is olive-gold and drawn). `procession` is a portrait now —
the Tall Pilgrim centred against the ranked skyline. `well-blade`,
`night-well`, `still-mirror`, `mirror-pans`, `strand-gate`,
`sandfall-combe`, `close-pan-rim`, `last-shelf`, `suns-door` (sun IN
the window, warm blade) all pass.

**Four nits remain, all small:**
1. Both comb poses show thin DEAD-STRAIGHT dark lines — not the tile
   seam after all (the single sheet proved it): they are toon-step
   contour lines along my grid-straight parallel ridges. The phase
   needs more wander so the contours curve like wind creases.
2. Candle bodies still lean terracotta at close range; the crowns no
   longer visibly burn (the r3 emissive cut traded one for the other).
3. The door scrub mounds read pea-green ON the skyline at 130 m — red
   attenuation over distance on a mid-value olive.
4. The arch's shade side still crushes to rust-violet mottle at the
   pilgrim pose's 10 m (0.36 was not enough against the wash).

## Round 4 — orders (all landed)

1. Comb wander 6 → 13 (curved contours, natural creases).
2. Candle body base lift 0.5 → 0.62; crown paint overdrives ×1.35 past
   white so the vein glow burns there and nowhere else.
3. Door scrub palette up a value step (0xc2b070/0xecdc96/0x807454),
   warm lift toward amber.
4. Door family emissive 0.36 → 0.48 at 0x7a5c40.

## Round 4 — the read (19/19 authored + the seeded sweep)

**All 19 authored poses pass.** The four r3 nits are cured: the comb
contours curve like wind creases (both comb poses), the candles are
pale mineral tapers whose crowns genuinely burn, the door scrub reads
warm gold on the rise's skyline, and the arch's shade side holds its
pale at the pilgrim pose's ten metres.

**Sweep (`gw3-r4`): 11/12.** Poses re-derived in spoke coordinates by
a replay probe (the stream is FNV-1a off the slot id + KIT_SWEEP_SALT):
none land in a registered rest except 04 (the Still Mirror, licensed —
and it composes anyway: pan shards, stone skyline, lanterns). The miss
is **08** — a random stand ON a comb crest at u ≈ 1363, v ≈ 109,
staring across its own crest face: the near band read as one bare
slab, no first layer.

## Round 5 — the diagnosis and the fix (pose 08)

Probed, not guessed:

1. A ray-march along 08's view line showed the near band is the
   CREST TOP itself — and the comb-tuft gate zeroed on crests by
   design (a lee-only band, `1 − smoothstep((crest − 0.6)/0.3)`).
   Each ridge occludes its own trough from a stand on the crest, so
   the lee-only rule guarantees a bare frame from every crest top.
2. Live-scene instance counts (a browser probe walking
   `kit-carpet-field` matrices) confirmed the tufts exist and draw —
   just never on the face the camera sees.
3. A first cut (floor 0.25, count 2600) measured invisible in-page:
   ~4 blades on a 90 m² face. The honest fix is both terms:
   **crest floor 0.5** (a crest is combed, never shaved) and
   **count 1400 → 3400** (two ~110×52 m comb fields at 1400 gave one
   tuft per ~20 m²).
4. A stale-module trap cost one sub-round: Vite kept serving the old
   `Golden3Cover` chunk after the edit (budget test showed the new
   tris; captures did not). A dev-server restart cured it — when a
   capture contradicts a measurement, RESTART THE SERVER before
   doubting the measurement.

Budget after: 66 draws / 1,043,103 tris (the tuft field is merged
instancing; the draw count actually fell with the round-3 one-sheet
consolidation and holds).

## Round 6 — the read (final sweep + recaptures)

**Sweep (`gw3-r6`): 12/12.** Frame 08 now carries wind-bent
stragglers across its crest band at every distance ring; the comb
country reads combed from ON the comb, not only from beside it. All
other frames hold their round-4 reads: near tufts/litter, mid stones
or pan rims or combe walls, far sunset band or rampart or caravan
wire in every frame. 04 remains the Still Mirror's licensed
stillness and composes regardless.

**Recaptured authored poses** (`dune-combs`, `close-comb-tufts`,
`evening-horizon`): all pass — the tuft floor did not fuzz the comb
silhouettes, and the horizon frame keeps its garden foreground, the
end-wall's warm rim glow, and the sun's dome over the crest.

**Verdict: authored 19/19, sweep 12/12.** The loop closes at four
full rounds plus the round-5/6 targeted fix cycle.

## The no-assets pass (dev server, `SHOT_NO_ASSETS=1`) — 19/19

All 19 authored poses captured against the DEV server with painted
maps blocked. The region is procedurally self-sufficient: the ground
paint carries the drift ribbons, comb crest/lee, pan sky-floors, and
rampart runnels alone; the procession stones and the door family hold
as clean pale slabs (their painted lichen gone, their silhouettes and
dusk-lift intact); the candles keep their taper-and-crown read on
vertex colour + material emissive; the falls, THE WELL BLADE, THE
LAST LIGHT, the lanterns, the Pilgrim, and THE SUNSET are all
procedural and unchanged. **PASS.**

## The frame gate — headed, scale 1.00, both poses under the bar

`scripts/measure-frames.mjs` with `SHOT_HEADED=1`, real GPU, window
visible, `SHOT_REGION=golden-waste-3`, 5 s samples:

- **afterglow-garden** (the densest pose: 33 candles + sward +
  fronds + bushes + glints + the spring column + the sunset):
  300 frames | **median 16.7 ms** (59.9 fps) | p95 18.1 ms |
  settled scale **1.00**
- **caravan-road** (road dapple + caravan + shoal + procession
  skyline + gate arch): 300 frames | **median 16.7 ms** (59.9 fps) |
  p95 18.1 ms | settled scale **1.00**

Both under the ≤16.9 ms bar — vsync held at 60 Hz at full render
scale at the region's two heaviest views. Gate **PASS**.

## Capture sets

- `gw3-r1` — draft 1, 19 authored.
- `gw3-r2` — round 2, 19 authored.
- `gw3-r3` — round 3, 19 authored.
- `gw3-r4` — round 4, 19 authored + 12 sweep.
- `gw3-r5`/`r5b`/`r5c`/`r5d` — the pose-08 fix sub-rounds (comb
  poses + sweep 01/08 probes; includes the stale-module detour).
- `gw3-r6` — final: 12 sweep + `evening-horizon` recapture.
- `gw3-noassets` — the procedural fallback build, 19 authored.

Diagnostic probes retired; their findings live in this ledger
(the sweep replay, the pose-08 ray-march, the live-scene instance
counts, and the show/hide pixel-diff are all described above).
