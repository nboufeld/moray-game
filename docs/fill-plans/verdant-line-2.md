# Fill plan — verdant-line-2 (The Emerald Terraces)

Phase 1 planning under `docs/FILL-DOCTRINE.md`. Planning only. Coordinates
are the spoke system of `Verdant2Terrain.ts` (`u` along azimuth 1.35, `v`
lateral CCW; disc heart u 940).

**Budget position**: shipped at 40 draws / 189,862 tris against the old
120/250k caps. Doctrine ceiling **160 draws / 450k tris** → this region
has the province's largest headroom (~+120 draws / +260k tris). The
roll-up below lands at ≈ 92 draws / ≈ 405k tris.

## 1. Current-state audit

Citations are `visual-qa/20260730-0219_seed1_hi_REGION-verdant-line-2-<pose>_terraces-final.png`
(currently in the verdant2 worktree's `visual-qa/`).

| Pose | Verdict against the three-layer law |
|---|---|
| `pass-threshold` | **Fails hardest.** One sentinel stack and two distance cards in an otherwise empty frame; the shelf floor is bare wash to the horizon; no life, no light event. The province's front door is the emptiest picture in it. |
| `emerald-gate` | Jambs are monumental and read — but their drapes are a few dark sticks, the floor between them is beige, the bottom third of frame is naked sand, and the stair beyond reads as smooth banks. |
| `stair-descent` | **The stair still does not read as a stair.** From on the treads the frame is smooth grassy swells; slab lips read as dark blobs; no curtain run draws a lip line; no light blade in frame; the left flank wall is one bare brown mass. |
| `gardens-vista` | Best layering (foreground boulder, spill shoal, grazing turtle, far silhouettes) — but the terrace field itself is one olive plane with sprig rows; curtains at distance are dark dots; the "hanging gardens" do not hang yet at vista range. |
| `slab-bridge` | Bridge + passing turtle compose; the mid/foreground floor is bare olive; no light event; the riser the bridge spans carries no garden. |
| `turtle-terraces` | The turtle reads (moss shell, gold rim). The tread it grazes is a huge bare sheet front-and-centre; two fern rosettes right; light flat. |
| `curtain-grotto` | **Best doctrine frame in the region**: grotto stones, rose-gold dwellers, Warden mid-round, lantern accents. Still: the entire foreground is one naked olive dune, and the curtain itself is ~8 visible ribbons — a bead curtain, not a green wall. |
| `cistern` | Mirror floor + pool + rim silhouettes land, and the emptiness here is *composed* (the rest point — keep it). But the bottom third is featureless dark olive, and the great diagonal blade is a faint streak — the "great fall of light" is not great. |
| `fern-vault` | Good: shelf, pillar, serrated giants, gold motes. Foreground floor bare violet-brown; tufts thin; the half-light has no half-light *gradient* (one flat value under the slab). |
| `mistfall-above` | The pour reads but as **blocky vertical strips with hard rectangular tops**; the balcony mesa-city cards float as detached dark chimneys from this angle (the r4 flag is back at this pose); the far slope is one flat olive; the near shoulder underfoot is bare. |
| `mistfall-below` | Horns + pour + a sleeper compose at distance, but the lower 60 % of frame is one bare olive-beige hillside — the basin approach is a naked ramp; the fall's foot has no billow glow, no wet-light event. |
| `far-balcony` | Balustrade + framing stacks + mesa city read; the cards are flat, hard-edged and uniform-inked (razor silhouettes); the balcony deck itself is bare; no light narrative at the region's final vista. |

**The roads, walked from the layout tables** (`Verdant2Stone.ts`,
`Verdant2Gardens.ts`):

- **Threshold u 635–738 (~100 m)**: one sentinel (672), two waymark
  boulders (704–707). Otherwise a bare shelf for 100 m — three objects on
  the province's connecting road. Nothing lives here; nothing lights it.
- **Stair u 738–845**: gate jambs, 16 slab lips, 8 curtain runs, 8 turf
  patches. On paper dense; in frame (`stair-descent`) the curtains are
  too short/sparse to draw the lip lines and the treads' centres are
  bare. Bare stretches: every tread's mid-channel; the flank wall faces.
- **Stair foot → gardens (u 845–870)**: the overlook boulder, then
  nothing until the bridge. The "opening breath" has no foreground.
- **Garden terrace field (u 838–990)**: 3 contour curtain lines (~50
  anchors), 26 turf patches, 8 field stones over ~20,000 m². The riser
  *faces* carry paint but no growth; tread centres bare (`turtle-terraces`).
- **Gardens → Cistern / → Vault**: no transition dressing; the rim lawn
  (180 blades) is the only approach mark.
- **Mistfall lip road (u 985–1005)**: 18 long curtains flank the fall,
  one blade; the lip *shoulder* the diver walks (v −20..+30 outside the
  fall) is bare.
- **Basin floor (u 1010–1090)**: 5 sleepers over ~6,000 m². The deepest,
  most mysterious ground in the province is the second-emptiest.
- **Balcony approach (u 1040–1055)**: 2 authored ferns; the deck bare.

**Light audit**: 7 blades + cistern pool + 44 lanterns. The Mistfall —
named by the doctrine as a light-narrative peak — has *one* thin blade
and no event at the pour's foot. The balcony vista has none. **Life
audit**: spill shoal, dwellers, 4 turtles, 24 stars — good bones, but no
life on the threshold road, none in the basin, and no small-fauna
colonies per surface type.

## 2. Journey map

**Spine road** (~450 m): threshold shelf (u 650) → Emerald Gate (748) →
the eight steps → stair-foot overlook (851) → terrace walk past the Slab
Bridge (875, −35) → Curtain Grotto (893, 26) → Cistern rim (925, 68) →
back across the gardens → Mistfall lip (998) → down the fall → basin →
Far Balcony (1055, 42).

**Side loops**: (a) vault loop — gardens → Fern Vault (900, −85) → out
past the third terrace line; (b) cistern circuit — the worked rim ring
walked full circle; (c) basin sweep — fall foot → sleepers → balcony
underside → up the balcony's landward ramp.

**Rest points (stillness on purpose)**: the Cistern bowl interior (keep
fauna out — the mirror is the rest), the Fern Vault's inner shadow, and
the basin's far south pocket (1060, −30).

**Every 20–40 m**: threshold — a waymark event every 25 m (see §3: turf
islands, stone pairs, the runner shoal overhead, one beam); stair — every
step is the event: lip curtain line + tread turf + alternating slab lip,
with a blade at steps 2 and 6; gardens — each contour crossing shows a
hanging riser face, a turtle or the spill shoal, and a beam/pool every
~40 m; lip road — horn, curtains, grain-glow, then the drop; basin —
sleeper + glow colony every 25 m toward the balcony.

**Province arc**: this is the older, mistier end. Water thicker (mood
already authored), stone worked, light diagonal. Escalation inside the
region: pastoral (stair/gardens) → sacred (cistern) → secret (vault) →
sublime (Mistfall) → promise (balcony/depth-3 mesa city).

## 3. Zone density table

Same kit tri estimates as verdant-1's plan (carpet card 4, pebble 24,
blade 16, bush 160, sponge 60, glow polyp 60, fish 48).

| Zone | T1 ground cover | T2 understory | T3 verticals | T4 ambient life | T5 events |
|---|---|---|---|---|---|
| Threshold | milky-crest carpet 1,400 cards + shell pebble runs 400 | 6 turf islands (20 blades each) + 10 pale bushes + 3 stone pairs (waymarks every ~25 m) | 2 more worn stacks (692, +8 / 718, −9) | **threshold runner shoal (35)** commuting u 645–760; 6 stars | 1 pale beam at (700, −2); sentinel dapple pool |
| Emerald Stair | tread moss carpets 1,600 cards; riser-face **hanging turf rows** (240 blades on the faces themselves) | curtain runs thickened: anchors ×1.6, strands 2–4 → 3–5, lengths +30 %; 20 wine bushes at lip corners | jamb drapes 4 → 9 per jamb, full-length | spill shoal kept (its loop is the stair's life); fry colony in step-4 curtain | blades at steps 2 & 6 (u 762/818) + 2 tread dapple pools; jamb glow moss |
| Hanging Gardens | tread carpets 2,600 cards (emerald/celadon); pebble drifts 500 | riser-face curtain density ×2 (anchors 50 → 96); 60 garden bushes; 14 fallen terrace-stone props | 8 fern-kelp mids on tread backs | turtles 4 → 6 (already circuiting); star colonies 24 → 40; **ledge-crab colonies (10 × 4)** on slab lips | 2 more garden blades + 3 dapple pools on the walk; bridge under-glow lantern pair |
| Cistern | rim lawn ×1.6 (290 blades); **bowl floor stays bare (mirror rest)** | 10 short rim curtains kept + 8 worked-stone shards | ring kept | **no fauna inside the ring**; 4 stars on the rim only | great blade width 10.5 → 13, opacity 0.22 → 0.3; pool 12 → 14 m; 2 rim satellite blades — the region's *second* light peak |
| Fern Vault | vault-floor moss carpet 900 cards (deep celadon) + litter 400 | giant ferns 14 → 18; 16 low fronds; lantern count 44 → 60 (vault share) | 1 more pillar stack (asymmetry) | **vault moth-fry colony (3 × 8)** circling lanterns; 6 violet stars | mouth blade kept + a second inner shaft striking one pillar; half-light gradient via carpet value ramp |
| Mistfall & basin | lip-shoulder carpet 800 cards; basin silt-bloom carpets 1,400 (deep violet-green) | 8 more long curtains on the south lip; basin: 12 wine bushes + sleeper skirts (pebbles 300) | 2 dead fern spars on the lip | **basin glow colonies 10 × 8** among sleepers; grain motes ×1.5 near the fall | **the light peak**: fall-foot billow glow (soft additive fan at the pour's base), 2 lip blades, milk texture rework (§6b) |
| Far Balcony | deck moss-joint carpet 500 cards (worked-stone joints drawn in cover) | 6 balustrade curtains + 4 ferns | framing stacks kept | balcony fry colony (2 × 6); 4 stars | 1 diagonal blade raking the balustrade + mesa-city card rework (§6b); depth-3 promise gets its light |

**Roll-up**: new instanced meshes ≈ 20 draws (5 carpet families, pebbles,
2 bush palettes, shards/props, spars, glow colonies, runner shoal, crabs,
moth-fry ×2, stars growth reuses existing, stone additions merge into the
3 family draws); new light meshes ≈ 11 draws; curtain/fern growth merges
into existing chunk draws (+0). Total ≈ 40 + 31 = **≈ 71–92 draws**. New
tris ≈ 215k (carpets ~37k, curtains ×2 ≈ +45k, turf +18k, bushes ~30k,
ferns/spars ~15k, props/shards ~12k, fauna ~10k, lights ~5k, headroom
~40k for the milk/card reworks) → **≈ 405k total. Fits.**

## 4. Light plan

The narrative: *long diagonal blades through thick green, peaking twice —
the Cistern's fall and the Mistfall's glow.*

- **Threshold**: one pale beam (700, −2) + the sentinel's dapple pool —
  the first "this country has light" mark on the road in.
- **Stair**: blades at steps 2 and 6 with tread pools, so the descent
  alternates lit tread / shadow tread — rhythm, not wash.
- **Gardens**: blades at (862, −18) and (908, −2) kept, +2 more so the
  terrace walk meets one per ~40 m; 3 dapple pools on the walk line.
- **Cistern — light peak #1**: the great diagonal fall grown (13 m wide,
  0.3 opacity) + 2 rim satellites; the pool brightened. Everything else
  within 30 m stays markless; the bowl is the stillness.
- **Fern Vault**: second inner shaft striking a pillar; lanterns to 60;
  the carpet bakes a radial value ramp (bright mouth → deep interior) so
  the half-light finally has a gradient.
- **Mistfall — light peak #2**: the pour itself becomes the light
  event: milk texture rework (soft-edged, column-varied — kills the
  blocky strips in `mistfall-above`), a billow glow fan at the foot
  (additive, ground-faded, the wet-light of the falls), grain motes
  ×1.5, and 2 lip blades. The basin's dark is earned and carries glow
  colonies (canyon polyp discipline).
- **Balcony**: one raking diagonal blade across the balustrade aimed at
  the mesa city — the promise is lit.
- All marks keep the four-part discipline already in `Verdant2Light.ts`
  (including the 120 m camera-distance fade the Emerald Gate wash paid
  for).

## 5. Life system plan

- **Shoal network**: threshold runner (35) owns the pass road u 645–760
  and hands the diver to the spill shoal, whose stair loop is kept (it
  *is* the stair's signature); a garden link — extend the spill loop or
  add a 24-fish liaison line — connects stair foot → bridge → grotto so
  the terrace walk is always crossed by moving life; basin stays
  shoal-free (the deep quiet) except the glow colonies.
- **Small fauna per surface**: slab lips → ledge-crab colonies (10 × 4);
  curtains → dweller fry (kept) + step-4 fry colony; lantern light →
  vault moth-fry (3 × 8, circling); mirror rim → stars only; sleeper
  stones → glow polyps.
- **Drifters**: spore motes kept (520); grain motes near the fall ×1.5.
  No jellies here — that's verdant-1's mid-water accent; the terraces'
  mid-water belongs to the turtles' silhouettes.
- **Centrepiece + satellites**: the turtle procession grows 4 → 6 and
  stays the centrepiece; satellites are the spill shoal (behaviour
  signature) and the billow glow at the fall. The Warden stays the
  findable; its curtain grows denser but the part (v ≈ 24.4) is kept.
- **Stillness preserved**: the Cistern bowl, the vault's inner shadow,
  and the basin's south pocket — named so the density pass leaves them.

## 6. Asset needs

**(a) KIT** (shared with verdant-1's plan §6a — same code, this region's
knobs): `carpetField` (milky-crest / tread-moss / celadon / silt-violet /
deck-joint palettes), `pebbleRun`, `bushBank` (wine + pale palettes),
`glowColony` (basin + jamb tints), `shoalRunner` (threshold runner,
garden liaison), `smallColony` (crabs, moth-fry, dweller fry), and
`beamAndPool` (diagonal `slant` knob — this region's blades already
shear; the kit takes slant as a first-class knob).

**(b) EXCLUSIVE — this region only (2–4)**:

1. **Riser-face garden strip** — a merged strip of short hanging turf +
   moss clumps applied to terrace/stair riser *faces* (the surface every
   pose looks at and nothing grows on); knobs: contour callback, density.
   The single biggest fix for `stair-descent` and `turtle-terraces`.
2. **Mistfall milk rework** — replace the hard-topped quad columns with
   overlapping soft-edged tapered sheets (per-column width/phase jitter,
   alpha-faded tops and feet) + the foot billow glow fan. Fixes the
   blocky pour in both mistfall poses.
3. **Mesa-city silhouette card v2** — the depth-3 promise cards redrawn
   with stepped-terrace tops, slight per-card ink variance, and feet that
   drop below the rampart line from *all* authored angles (kills the
   floating-chimney read in `mistfall-above` / `far-balcony`).
4. **Worked-stone shard set** — small carved fragments (lintel, step
   corner, bowl rim) to scatter where the country "remembers being
   built": cistern rim, balcony deck, gate feet.

**(c) REUSE — denser deployment / repaint**:

- `growCurtain`: anchors ×1.6–2 on stair and garden contours, strand
  count 3–5, length +30 % (code unchanged; loop constants).
- `buildTurf`: capacity 1,900 → ~3,200; new deck-joint and vault
  families.
- `growFern`: 14 → 18 vault giants, +16 low fronds, +4 balcony.
- `buildMossLanterns`: 44 → 60 with the vault bias raised.
- Stone family builders: 2 threshold stacks, 1 vault pillar, sleeper
  skirts — all merge into the existing 3 family draws.
- `Verdant2Life.buildShoal`-style builders for the new runner/liaison.

## 7. Rework checklist (ordered)

1. `tests/regionVerdant2.test.ts` — raise budget caps to 160 / 450k
   (doctrine) before anything lands; add reroll-fence pins for the first
   existing draw of each `SEED ^` stream so new substreams provably
   append.
2. Kit integration (after Phase 2 ships the pieces): new seeds only from
   `SEEDS.regionVerdant2 ^` fresh substreams.
3. `Verdant2Ground.ts` — carpet fields are additive; also deepen the
   tread/riser paint split one more step (the treads still read olive in
   `turtle-terraces`) and draw the deck joints on the balcony.
4. `Verdant2Gardens.ts` — curtain densification (§6c), riser-face garden
   strips (§6b.1) along `contourU` and the stair steps, turf growth,
   fern growth. Keep the grotto part at v ≈ 24.4 clear (Warden contract,
   held by its test).
5. `Verdant2Stone.ts` — threshold stacks + waymark growth, worked shards,
   vault pillar, sleeper skirts. Scenery-by-construction (no new
   colliders except the two stacks' standard pair).
6. `Verdant2Mistfall.ts` — the milk rework + billow glow (§6b.2);
   verify from both mistfall poses and from the balcony.
7. `Verdant2Light.ts` — blade table +6, pools +5, Cistern boost, vault
   inner shaft, lantern growth (§4).
8. `Verdant2Distance.ts` — mesa-city card v2 (§6b.3): stepped tops, ink
   variance, feet below the rampart from the three poses that frame them
   (`far-balcony`, `mistfall-above`, `pass-threshold`).
9. `Verdant2Life.ts` — threshold runner, garden liaison, crabs,
   moth-fry, turtle count 4 → 6 (phase spacing re-checked against the
   `turtle-terraces` pose window — the wall-clock phase lesson from
   round 2), star growth.
10. Capture `region-shots verdant-line-2 fill-r1` (needs the merged tree
    or the worktree's server), critique against §1 pose by pose, iterate
    ≥ 2 rounds, then `fill-final` + noassets.
11. Tests to update honestly: budgets (item 1); curtain-part clearance
    (exists); add: riser-strip determinism, milk-sheet alpha discipline
    (opacity caps, fog:false, range fade), mesa-card foot-below-rampart
    assertion, threshold-runner path vs pass seals.

## 8. Coherence notes

- **The pass handshake (blocking, owned jointly)**: verdant-1 must cut
  its far distance-ring gap over the pass sector (its plan §7.9) — until
  then every threshold camera photographs an opaque curtain. This
  region's threshold band keeps weight a whisper (0.14) and dune-level
  terrain so the cut is safe; nothing in this plan changes that
  contract.
- **Handover gradient**: the Threshold's milky-crest carpet palette must
  sample toward verdant-1's Falling Edge paint (0.98/1.02/0.92 ground
  multipliers) at u < 700 and reach this region's own celadon by u 740 —
  a 40 m palette lerp, the doctrine's transition rule made concrete.
- **Sibling handshakes**: shared `TIP_GOLD` on all leaf tips; the
  threshold runner shoal's silver-green should match verdant-1's vale
  runner (one province, one fish light); the worked-jade stone family
  stays exclusive here — verdant-1 gets no worked stone, which is what
  makes the terraces read *older*.
- **Depth 3**: the mesa-city cards are the province's forward promise —
  card v2's stepped-terrace tops should quote whatever depth-3's concept
  becomes; keep their ink derived from `scene.fog` (already `followFog`-
  style) so mood/weather reach them for free.
- **Arc check**: verdant-1 ends milky-bright and thinning; this region
  opens milky, descends into thicker emerald, and ends on the lit
  promise. The two light peaks (Sunwell there, Cistern/Mistfall here)
  should not be equalled by any other mark in either region.
