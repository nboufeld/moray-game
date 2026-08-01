# golden-waste-2 — THE CARILLON WASTE (the Golden Waste's depth 2)

Region worker ledger. Slot `golden-waste-2`, province The Golden Waste,
depth 2 — no gateway wing; the inbound connection is the inter-region
pass the Hourglass Sea's ledger reserved at its Gilded Shore stacks.
Disc centre r = 940 on azimuth 6.39 (world ≈ (934.6, 100.2)), radius
220. Seed `SEEDS.regionGolden2` (0x5a4d_0c0e) and `^` substreams only.
Built to the full R12 standard from the first draft: no wedge era, no
separate fill pass — density, quality, light and life ARE the build.

## Concept

The Hourglass Sea was the desert's sand; this is the desert's BONE —
the wind-carved honey sandstone country the dunes were milled from,
and the place the desert's wind LIVES. Ten thousand years of moving
water fluted the stone until the currents ring it: capped hoodoo
spires ranked across a carved pavement under long violet shadows; a
pierced wall with sky in its windows and one Great Arch for a door;
a slot canyon — the Ribbon — cut to a violet deep with a well of
amber light burning at its elbow; spring pools benched down
travertine terraces where the region's densest life gathers; and at
the heart THE CARILLON — five great fluted towers over a swept stone
pavement, where the Noon Bell falls, golden swifts ride one closed
thermal around the spires, and the Bell Ringer — an ancient chambered
nautilus — rises out of the Belfry's hollow crown once a breath, slow
as a struck note. The far shelf's leaning spires frame the painted
mesa-lines that promise depth 3.

The province's palette journey continues (MASTER §1.1, the Golden
row): honey over violet and gold dapple arrive with the diver from
the Gilded Shore, then become carved amber — the register shifts from
dune-gold to stone, the violet stays warm, the light stays honey.

## The depth-2 pass (the Gilded Shore handover)

The Hourglass Sea's disc ends at u ≈ 665 on the spoke; ours begins at
720. The pass tongue is `approachTongue("golden-waste-2", { fromR:
630, toR: 780, halfWidthFrom: 16, halfWidthTo: 56 })` — it starts
35 m INSIDE golden-waste-1's rim, so the two domains genuinely
overlap and the bounds handover has no gap (asserted in
`tests/regionGolden2.test.ts`: both weights > 0 on the spoke between
636 and 660, and our weight > 0 continuously along the spine
632–1080).

Three authored bands (the Emerald Terraces' device, third use):

- **The Shore Road** (u 630–745): a milky-gold shelf at base level
  past the Gilded Shore stacks (their spoke ≈ (596, 30) — the pilot's
  own `gilded-shore` pose looks straight down this road). Our weight
  is a whisper (0.14, the threshold gate) so the Hourglass Sea keeps
  carrying water, mood and terrain across the overlap; we own only
  the bounds. The gate also hides the framework's depth-boundary
  reject circle (`RegionField` consults us only within radius + 40 =
  260 m of centre, u ≥ ~680): out there our target is held at the
  probed base level (≈ 0 ± 0.4 m — measured before authoring), so the
  step at the reject circle is centimetres (asserted).
- **The Chime Gate + the Wind Gully** (u 745–818): the pass is a
  place — two fluted jamb spires past the pilot's outermost distance
  ring (u ≈ 731; the Emerald Gate lesson applied at authoring time —
  NOTHING of ours composes before that line, because nothing behind
  an opaque `fog:false` ring exists to a camera in front of it), then
  a fluted walled gully ramping ~11 m down in two chutes with a
  landing breath between.
- **The country** (the disc).

## Sub-biome map (spoke coordinates: u along azimuth 6.39, v lateral CCW)

| Sub-biome | Where | Floor |
|---|---|---|
| The Shore Road (threshold) | u 630–745 along the pass | ≈ 0 milky shelf |
| The Wind Gully | u 748–818, fluted walled ramp | 0 → −11 in two chutes |
| The Hoodoo Court | the disc's resting ground | −11 carved pavement, swales ±1.3 |
| The Windows wall | ridge (838, 36) → (896, 84) | crest to ≈ +2; arch doorway dips to court |
| The Ribbon | slot spine (898,−30) → (1004,−96) | −32 floor, wind-lip +0.8 rims |
| The Seep Terraces | (975, 72) r 52 | −4.6 → −11 travertine benches, pool dishes |
| The Carillon | (1030, −18) r 42 | −11.8/−12.3 swept plinth; towers to ≈ +11 (built) |
| The Sunset Shelf | u > 1080 to the rim | −6 rise fading to base by rc 210 |

Seven sub-biomes plus the pass bands. Vertical terrain range ≈ 34 m
(Windows crest ≈ +2 → Ribbon floor ≈ −32; test holds range ≥ 28,
lowest ≤ −30, highest ≥ +1.2); the towers carry built verticality to
≈ +11. Ceiling: 3.8 m over the Shore Road (meeting the Hourglass
Sea's closed rim), vaulting to ~13 down the gully, opening to 26 over
the country, closing to 3.4 at the far rim (gated off the inbound
pass corridor only — the reserved depth-3 corridor stays sealed).

## Registered rests (MASTER §1.2 — this region's contributions)

| Rest | Where | Licence |
|---|---|---|
| THE PAVEMENT | r 14 at (1030, −18), the Carillon's swept circle | ring paint only; its ONLY light is the Noon Bell (one beam + cool pool); its only motion is the Bell Ringer's breath above and the swifts crossing — the resident's own circle (the Drain's Eye precedent) |
| THE ANCHORITE'S CELL | r 7 at (962, −78), off the Ribbon's elbow | bare carved stone; one THIN light blade (half the Light Well's voice); no scatter, no fauna, nothing moves |

## Landmarks (a reveal every 20–40 m)

1. **The Shore Road waymarks** — leaning stone pairs pacing the road
   every ~26 m (the Gilded Shore stacks' idiom carried forward).
2. **The Chime Gate** (u ≈ 748) — two fluted jambs standing against
   the water, the door into the carved country.
3. **The Wind Gully** — the two-chute fluted descent, shoulder
   boulders alternating flanks, wind pockets pacing it.
4. **The court reveal** (u ≈ 818) — the Hoodoo Court opens in one
   breath; a road beam lands at the gully's foot.
5. **THE HOODOO FIELD** — ~33 capped spires (three tall sentinels
   authored), each throwing one long painted violet shadow.
6. **The Windows wall** — seven pierced fins on a 13 m ridge.
7. **THE GREAT ARCH** — the swim-through doorway between court and
   seeps, a beam falling through it.
8. **THE RIBBON** — the slot canyon: lip slabs pacing its rim, shed
   blocks on its floor, crabs darting, the LIGHT WELL's three slanted
   amber blades at the elbow.
9. **The Anchorite's Cell** — the carved side-chamber rest.
10. **The Seep Terraces** — three travertine benches, three ringed
    spring pools with bubble columns, the region's densest gardens.
11. **THE CARILLON** — five fluted towers (the Belfry's crown is an
    open bell mouth), eight chime-stones, the swept Pavement, the
    Noon Bell, the swift wheel, the Bell Ringer.
12. **The Sunset Spires** (u ≈ 1100, v ±14) — two leaning stacks
    framing the reserved depth-3 pass azimuth over the painted
    mesa-lines.

## Life (T4/T5 systemic, short of saturation)

- **Gold motes** (700) + **midwater plankton** (1,100 large soft
  sparks at 0.4 m — the verdant-2 sweep arithmetic adopted at its
  proven density, so random midwater frames keep a foreground).
- **The traveller shoal** (kit shoalRunner, 48 gold fusiliers — the
  province's one shoal light): the whole journey as one closed
  commute — shore road, gully, court road, around the Carillon,
  home. Life as wayfinding.
- **THE TOWER SWIFTS** — the moving centrepiece: nine small golden
  rays on one closed thermal — up the Belfry in two turns, across the
  Pavement's sky, down the far tower, home low over the court. The
  whole wheel fits inside the Carillon poses' frames (the caravan's
  phase-luck lesson, pre-paid).
- **Perchers on every surface type**: cushion-star trios at hoodoo
  feet, blennies on the Windows' sills, darting crabs on the Ribbon's
  floor (gated off the Cell), hover-fry over the seep pools.
- **THE BELL RINGER** — the findable resident (`carillon-nautilus`,
  *Nautilus tintinnabuli*): an ancient chambered nautilus rising out
  of the Belfry's bell mouth on a 46 s breath — up, hang, sink —
  vein-glow gold spiral, fog-free lantern (the Keeper's lesson).
  Codex entry in the def's pure half; DiscoveryTarget above the bell
  mouth, crossed at every crest of the breath.

## Density tiers (doctrine table, per zone)

- **T1**: ripple-grit (5,200 two-tone, graded), shell drift (2,200),
  road pebble runs (760); ground paint carries joints, swales, hoodoo
  shadows, seep stains, pavement rings, Ribbon rim-lines.
- **T2**: road wire blades (1,050) + court wire (1,600) + shelf tufts
  (460) — all kit BLADE profile, never wedges; wind-pocket fronds
  (980) in 17 authored pockets pacing every road at 20–40 m; seep
  sward (900 blades) + seep fronds (640); three bush banks (72);
  split-stone runs (340) at every standing stone's foot; shard aprons
  (460) under the Windows; slot-floor blocks (320); three wrack
  drift-lines; four authored close-pose beds (the lily-bench law paid
  up front).
- **T3**: ~33 hoodoos + 3 sentinels (two merged draws), five towers +
  eight chime-stones (one draw), seven fins + the Great Arch (one
  draw), waymarks/jambs/boulders/lip slabs/Sunset Spires (merged).
- **T4**: as Life above. **T5**: the gold dapple (court road + seep
  gardens at the golden fill's earned whisper opacities), THE NOON
  BELL (named light peak), THE LIGHT WELL, road beams (drift-line,
  reveal, arch), seep glints, travertine rims (kit matRings), bubble
  columns.

## Budgets (measured by the region test's own walk; caps R12 260/1.35M)

- Draft 1: **67 draws / 618,842 tris**; colliders > 100, all inside
  the domain by test. Headroom held for the critique rounds.

## Seeds

`SEEDS.regionGolden2` (0x5a4d_0c0e) with `^` substreams: terrain
0x7e01–0x7e05, ground paint 0x5a01–0x5a07, rocks 0x50cb + 0x0a31–0x0d0f
shape seeds, towers 0x61a1–0x61c7, windows/arch 0x62a1–0x62b6, seeps
0x63a1–0x63c4, cover 0xf001–0xf017, life 0xe401–0xe409, nautilus
0x0ee1–0x0ee3, light 0x11f1–0x11f7, distance 0xd401+. Runtime updates
spend no randomness — captures settle deterministically (the
connective-3 traveller-phase lesson: every mover is closed-form off
`ctx.time`).

## The depth-3 reservation (for golden-waste-3)

- The **Sunset Spires** (u ≈ 1098–1102, v −12/+16) frame the outbound
  spoke azimuth — the torch passed exactly as the Gilded Shore passed
  it here.
- Our **distance rings part over the outbound corridor** (gap
  half-angle 0.30 rad at azimuth 6.39, long tapers) per MASTER R4 —
  golden-waste-3's gate composition can live past our rings without a
  cut.
- Our **rim seal ring and rim ceiling-closure stay CLOSED** at the
  outbound azimuth until golden-waste-3 opens them — the orchestrator
  cuts the gate when the depth-3 connection goes live (R4's precedent,
  third use).
- Recommended tongue for golden-waste-3: `fromR ≈ 1130` (30 m inside
  our rim at 1160), `toR ≈ 1300`, threshold whisper against OUR far
  shelf (−6 fading to base by rc 210); our Sunset Shelf paint and
  shelf tufts already stage the decrescendo.

## Critique history (silhouette → value → colour → detail, per round)

### Round 1 (`gw2-r1`) — the country composes; the stone is a value problem

Captured against the prebuilt bundle on :5206 (`npm run build` + `vite
preview` + `SHOT_PER_LAUNCH=1 SHOT_NAV_TIMEOUT=900000
SHOT_COMPILE_WAIT=5000` — the verdant-3 load-wall workaround, needed
from the first session: the dev server blew the 180 s nav ceiling at
1-min load 28–33 with two sibling workers live). All 21 authored poses
captured and READ; the sweep (12 seeded poses via `SHOT_POSES_FILE`,
drawn offline by the identical arithmetic) ran after.

**Silhouette.** The region EXISTS: `court-reveal` opens on a genuine
ranked hoodoo skyline with caps; `ribbon-mouth` cracks the pavement
under a towering capped sentinel; `ribbon-depths` is the round's best
frame — violet slot walls, three gold light-well blades, shed blocks;
`carillon`/`noon-bell` rank five towers around the swept Pavement with
the Noon Bell striking it AND the Bell Ringer visibly rising over the
Belfry in both frames; `close-arch-shards` frames the Great Arch as a
door of rusty gold. Fails, by size: **`windows-wall` is a smooth dune
flank** (the 13 m terrain ridge at the 2.2 m grid reads as a soft
mountain, fins buried behind its crest — the "pierced wall" identity
lives entirely in the fins, so the ridge must come down and the fins
must grow); **`great-arch` is photobombed by a fin at 2 m** (the pose
stands on the fin line; the arch is a distant mound); **`belfry` is a
flat maroon wall** (10 m from a 23 m tower, whole shaft in toon shade);
**`close-flute-foot` is one featureless maroon frame** (2.4 m from the
same shade side — camera inside the subject); **`anchorite-cell` looks
down the slot from above and frames nothing** (the cell is invisible
from the rim; the pose must go INSIDE); **`sunset-shelf` frames the
promise straight down the outbound ring GAP** — the reserved corridor
parts the rings exactly where this pose looks, so the "painted mesa
lines" are absent from their own promise shot (aim must swing off-gap
so the flanking rings carry the vista); the swifts are INVISIBLE in
`swift-wheel` (0.62–0.85 scale reads as specks at 40 m) and read as
torn orange paper at close range in `belfry`.

**Value — the round's headline, the province's own lesson relearned on
towers.** Every vertical stone's shade side collapses to flat MAROON:
the near tower in `carillon`, the whole frame of `close-flute-foot`,
the caprock boulders (`wind-gully`), the sentinel in `ribbon-mouth`,
the Sunset Spires. Sun-side stone reads warm and right (`swift-wheel`'s
two towers are the proof). The toon ramp under the region's
quarter-sun multiplies the whole shade side down and the violet-warm
paint terms push it to eggplant — the golden-1 stone-warming lesson
plus the verdant re-pass dusk-lift lesson, both due at once: warm the
family hexes AND give the stone materials a small emissive floor so
the shade side stays a colour.

**Colour.** The honey reads at the horizon band and on the ground
(paint is right: gully honey stain, joint seams, hoodoo shadows all
carry); the zenith is the dimmed painted backdrop at backdropFade
0.68 — the same arithmetic the Hourglass Sea ships at 0.66, one shade
darker here; nudge 0.68 → 0.65 and verify against a same-session
golden-1 control. The wrack drift-lines read as PALE PAPER SCRAPS
(value above their ground — down a step). Seep greens read true.

**Detail.** `close-court-garden` nearly passes draft one (pocket
fronds read as painted plants; graded splits and pebbles anchor);
`close-seep-rim` passes with notes (hover fry charming; bubbles are
white PUFFBALLS — size 0.3 → 0.2, opacity down); the seep pools
themselves hide under bushes that grew ON the rims (gate must exclude
the pool discs); the mid-band of the open court is thin (courtWire
1600 over ~90k m² — the sweep will say it louder); `shore-road` is
near-empty and the Hourglass Sea's far-side distance rings are
MISSING from its backdrop (they cross the corridor at u 691/709/731
and should be the road's whole distance layer — attachment probed
after the sweep; if they render, the road still needs taller waymarks
and denser shoulder wire).

**Round-2 orders** (the full list lives in the r2 commit): stone
value/hue pass (hex warm + dusk-lift emissive, flutes deepened,
tower paint contrast up); Windows rebuilt (ridge 13 → 9 with broken
crest, fins 8 taller/tighter, arch grown); five poses re-authored
(great-arch → court side, windows-wall → along the wall, belfry
backed out, anchorite-cell → inside the slot at the cell mouth,
close-flute-foot backed out, sunset-shelf re-aimed off-gap +
spires grown/warmed); swifts grown to 1.0–1.3 and brightened; seep
bushes off the rims, sward/frond counts up, bubbles calmed; court
wire 1600 → 2400 + bushes 30 → 42; wrack re-valued down; two
authored hoodoos planted in `hoodoo-court`'s near field; slot-wall
flute striping; lip slabs leaned off the "manhole" read; waymarks
grown; Anchorite's Cell rest radius trimmed to 5.5 so the mouth can
take its two flank stones (the carve keeps r 7).
