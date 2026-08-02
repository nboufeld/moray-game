# Region ledger — smoking-marches-3 · THE LANTERN VIGIL

Slot `smoking-marches-3` · spoke azimuth 2.79 · centre r = 1460 · disc
radius 220. Branch `region/smoking-marches-3`. Seed stream
`SEEDS.regionSmoking3` (XOR substreams in `Smoking3Shared.LV_SEEDS`).
Built to the full R12 standard from the first draft: no wedge era, no
separate fill pass — density, quality, light and life ARE the build.

## The concept

The far side of the Forge Combs' NIGHT DOOR, and the answer to the
province's whole arc. The Smoulder Fields were the fire's doorstep
(heat seeping up through a warm floor); the Forge Combs its workshop
(heat running in lines between black walls); past the Night Door the
darkness above finally arrives in full — the Smoking Marches' true
night — and the fire's purpose is revealed: it has been climbing all
this way to make LIGHT. Basalt-glass lantern spires (the forge's work)
stand in ranks, glowing amber from inside, strung along one last ember
seam — THE LAST WICK — which crosses the whole country to THE MORNING
VENT, the great chimney at the world's end where the heat finally
reaches the sky and the province makes itself a dawn (THE EMBER DAWN,
painted rising beyond the rim — the spoke's terminus owns the final
horizon). The Lampwright, a small ember-carrying night octopus, tends
the Choir's lanterns on its slow round. NOT another caldera, NOT
comb-country: lamp-country — kept, warm, awake in the dark.

## Named places (sub-biomes and landmarks)

| Place | Where (u, v) | What |
| --- | --- | --- |
| The Night Threshold | u 1130–1245 on the pass | dark glass shelf under the Night Door; seep mats + first embers |
| The Nightfall Stair | u 1252–1308 | five benches dropping 17 m into the night, risers seamed with ember |
| The Watch Lantern | (1330, −6) | the first lantern — the reveal's target from the stair |
| The Last Wick | u 1310–1622, wandering | the road: one bright ember seam in a charcoal band, station embers every ~28 m |
| The Lantern Rows | u 1360–1520 | ranked lit spires either side of the road |
| The Choir | (1418,22) (1428,−6) (1444,28) | three lanterns around the court the road crosses; the Lampwright's round |
| The Evensong | (1494, 34) | the tallest lantern in the province (h 22) |
| The Ember Fens | (1430, −95) r 78 | pooled amber at its provincial strongest; five sunk amber pools, shimmer, fen mats |
| The Spilt Light | (1512,−66)→(1526,−54) | the fallen lantern — a cracked glass dome, its light pooled at the break |
| The Ash Veil | (1478, 105) r 88 | raised milk-pale drift country under a slow warm ashfall — the tender register |
| The Cradle | (1560, 42) r 56 | the deepest basin: the warm garden the fire keeps, two milk springs, glow colonies |
| The Morning Vent | (1612, −10) | the terminus: a 24 m chimney, glowing meridian seams, THE MORNING COLUMN rising from its throat |
| The Ember Dawn | outbound horizon | the painted final horizon: kneeling night hills, distant lit lanterns, a dawn band rising beyond the rim |

## Registered rests (MASTER §1.2)

- **The Cold Lantern** — (1432, 130) r 11. The one lantern the fire never
  reached, standing unlit in the ash: the lantern itself is the rest's
  whole composition. Fill-free, fauna-free, glow-free; the Veil's ash
  fall crosses the circle like weather (licensed).
- **The Fen Hush** — (1402, −138) r 12. Bare dark mottle pocket at the
  fens' south rim. No fill, no fauna, no glow.
- **The Morning Shadow** — (1642, 14) r 10. The lee floor behind the
  Vent, off the road. No fill, no fauna, no glow.

`stillnessGate` (terrain) and `restFree` (fills) read one registry; the
region test walks every kit instance against it.

## The pass corridor (Forge Combs → Lantern Vigil)

The Forge Combs pre-reserved this connection at their Night Door
(u ≈ 1122): distance walls already part over the corridor (their
`GAP_OUT_HALF`), spine clear |v| < 11 for u 1080–1160. `PASS_TONGUE`:
fromR 1130 → toR 1300, half-width 12 → 52 — the tongue reaches ~30 m
INSIDE their disc (edge at u 1160), the verdant-3 overlap pattern: the
bounds handover overlaps, never gaps. The channel keeps |v| < 5 through
their fins (asserted). Ownership over their Glass Shore is a whisper
(thresholdGate 0.14) rising to full past u ≈ 1236. The framework's
depth-boundary reject circle (centre 1460, r 260 ⇒ u < 1200 on the
spoke) truncates where RegionField consults us; below it the terrain
target stays within ±1.2 m of dune level (asserted) so the annex floor
stays honest over their shelf. Our own rim ring is gated over the
corridor (u < 1260, |v| < 27) and the flanks are sealed by shoulder
rows u 1136–1310 at ±max(hw−3, 11), the verdant-3 seal shape. Corridor
swim-line asserted u 1133–1315 at three lifts, and on down the wick to
u 1600. This is the spoke's terminus: no outbound reservation.

## Density tiers (doctrine table, per zone)

- **T1**: night stubble (8.4k blade clumps, milk tips) region-wide;
  night blades (2.9k, the F-R3 rim flank band); ember fronds (2.8k,
  sunGlow) on pool and wick hems; ash sward (3.6k pale tufts) over the
  Veil; cradle garden (2.4k fronds sunGlow + 2k blades); threshold
  stubble (1.2k); wick cinder / fen gravel / ash pebbles / glass shards
  / cradle pebbles / plain shards (≈8.1k litter); far cards (5k,
  nearFade).
- **T2**: night bushes (iron-violet, ember-rimmed) + the Cradle's warm
  olive family; lantern-foot scree aprons; Vent drapes.
- **T3**: thirteen lantern spires (h 11–22) + the Morning Vent (h 24) +
  the Spilt Light.
- **T4**: the wick shoal (48 ember-dark tetras — the province's one
  shoal light — riding the whole road), the cradle ring (26 fry),
  moth-fry hovering at six lit lanterns, lamp perchers, fen shrimp
  swarms, ash darters, the ash fall, region-wide night motes; THE
  LAMPWRIGHT (findable + centrepiece, wake-latch determinism).
- **T5**: THE MORNING COLUMN (named light peak, 0.18 licensed), two dim
  falls from above (Ash Veil, threshold blade), ember station pools,
  lamp halos at every lit foot, fen pool hearts, cradle spring pools,
  heat shimmer, glow colonies (warm-rising 0xff9450 — the Smoulder
  register, never cold), mat rings in the region's own dusk-ember tiers.

## Budgets (measured by `tests/regionSmoking3.test.ts`, counted not claimed)

- Draft 1: **61 draws / 1,233,864 tris** (caps 260 / 1.35 M).
- Round 2 (density + rework): **62 draws / 1,335,481 tris** — 14.5k
  headroom; the region runs essentially at its cap, so any future
  addition must be paid for by a removal.

## The loop

### Round 1 — sm3-r1 (16 authored + 8 clean sweep of 12)

Captured off the dev server on port 5212 (SHOT_PER_LAUNCH=1, raised nav
ceiling — load ~10 with one sibling worker live). The sweep died at
pose 10: round-2 source edits were made while it ran and the dev
server's HMR reloaded the page mid-run (self-inflicted; the sweep
stream is seeded and re-runs identically). Sweep 08 was the documented
"hidden moray" boot-glitch frame (harness noise, recaptured next round).

**Verdict: the bones are right — the lantern country exists, the road
reads, the layout composes — but the register is DAY and the lanterns
are JUGS. Honest sweep ≈ 4–5/7 clean frames.**

- **The register reads pastel day, not the province's night.** The fog
  goes warm-rose correctly (the hook multiplies the base), but the
  bright painted backdrop kept the sky at day and the pale ground kept
  the country at pastel. → backdropFade 0.52 → 0.64, sun 0.16 → 0.14,
  plain paint a full step darker, drifts quieter.
- **Every lit lantern read as a terracotta jug.** Root cause found in
  the material, not the paint: the linear emissive-by-vColor chunk left
  `0.22 luminance × 0.55 intensity` of amber wash over the whole dark
  glass body. → the chunk SQUARES vColor (dark body ~0.03, windows
  keep ~1.5); windows narrowed to three slots between the ribs
  (panel mask 0.62→0.28) with authored fire values (1.22, 0.86, 0.5);
  profile slimmed (belly 1.5→1.3, longer throat) and heights +2 m
  across the table; rib bulge 0.08→0.035 (pumpkin lobes).
- **The Morning Vent read as a carnival tent** — the seam noise cut
  broad diagonal bands. → thin meridian threads (threshold 0.72+t·0.12
  over 0.045), squared emissive shared with the lanterns.
- **The Spilt Light was a disaster**: the full fallen tube, open-ended
  and single-sided, read as a torn hoop floating on the sky. → broken
  belly only (cut t 0.6), tipped past horizontal so the mouth kisses
  the ground, half-sunk (a cracked dome), pose backed off.
- **Mat rings read as bright bullseyes** (the Forge Combs' "lava
  pancakes" lesson relearned). → every band palette a step dimmer.
- **The Ember Dawn band was invisible** — placed beyond every distance
  ring, occluded whole; its glow also sat below the hill line. →
  radius 302→276 (between rings 2 and 3), glow peak lifted above the
  kneeling hills (kneel 0.32→0.45), values ×1.4.
- **The amber mottle washed whole dunes orange** (loud, and it bled
  into the Ash Veil). → threshold up, gain 0.5→0.36, gated out of the
  veil entirely; fens keep the doubled pooling over a darker floor.
- **The Ash Veil read tan, the fall a rumour.** → milkier paint, ash
  fall 700→1100 at size 0.075, sward paler and +400; pose stood 12 m
  from the veil-lantern (it filled half the frame) → moved past it.
- **ember-fens pose read 50 m of fog wall** → moved into the fens;
  **nightfall-stair** stood at the crest and read only the far plain
  edge-on → moved onto the first bench aiming at the Watch Lantern;
  **the-cradle** skimmed the rim → pitch down; **close-wick** buried
  the lens in the channel's own dark bank (the Forge Combs' r6 law:
  a road-level stand may not stare into the road's cut) → reads along
  it; **close-cradle** found the rim's bare bank → moved into the
  basin, garden densified (fronds 1800→2400, blades 1400→2000).
- **Night bushes read near-black** → a value brighter. **The
  Lampwright read as a pale speck** → body a third bigger, darker
  back, coal freckles brighter (it woke and flew deterministically ✓).
- **Sweeps 03/06: bare-plain cones** (near sprigs only, no mid) →
  base stubble 8000→8400 at [0.48, 0.88], night blades 2900 at
  [0.45, 0.8]; threshold seep mats + first embers added so the door
  arrives dressed (road-as-place from the first metre).
- **night-threshold is honest-but-thin**: the parent's water fades at
  the mutual feather (both weights ~0.3 there — seam physics), and the
  corridor gap means no distance layer dead ahead. Dressed via the
  threshold cadence; judged again in r2.

### Round 2 — sm3-r2 (16 authored + 12 clean sweep)

**Verdict: the two big r1 misses are ANSWERED — the lanterns read as
glass lanterns (dark bellies, one lit slot, elegant profiles, ash
crowns) and the country reads a register darker. But the SKY is still
bright teal day, which the region's whole idea forbids, and two poses
came up empty. Honest sweep ≈ 8–9/12.**

- **Landed:** the-watch, wick-road, the-choir, evensong, nightfall-stair,
  morning-vent, cold-lantern, close-wick, close-cradle all pass — the
  lantern ranks read as ranks, the lit slots read as held fire, the
  wick road frames with the drifting Lampwright, the Vent reads as a
  chimney with the column faint above it, the garden reads lush. The
  squared-emissive chunk was the whole cure for the "jug" read; the
  Spilt Light's cracked-dome rework reads as a broken lantern now, not
  a floating hoop. Ember Dawn glows at the horizon in morning-vent and
  sweep 11.
- **The register is still DAY.** backdropFade 0.64 darkened the sky's
  intensity but the water column overhead still reads bright turquoise;
  the fog is warm-rose at the ground but the frame's top third is a
  bright teal field. This region is the province's darkness-above
  arriving in full — the sky must go night. → backdropFade 0.64 → 0.8,
  fog blue 0.48 → 0.42, sun 0.14 → 0.13.
- **ember-fens read a flat empty plain.** The pools were 2 m sinks with
  small dim halos — nothing read from a standing pose. → pool depths
  −20.x → −22.x (deeper bowls), ember-pool halos radius ×1.05 /
  opacity 0.17, and the pose lowered onto the pool chain at (1400,−84)
  looking straight down it.
- **lampwright came up EMPTY** (dark water, no choir, no animal) —
  the r2 stand's aim missed the court's own backdrop. → stand moved to
  (1460, 0) aiming at the court centre (1432, 10) so the three Choir
  lanterns fill the frame behind the animal; the whole flight still
  holds ≥ 14.8 m (asserted).
- Sweeps: the near/mid layers carry (the r1 bare-cone fix held —
  03/05/06/09/12 all have standing blades + mid relief + a far
  silhouette or dawn band); the one weakness is the bright sky, same
  register fix as above.

### Round 3 — sm3-r3 (16 authored + 12 sweep; the authored set re-shot
after an HMR race killed the first pass mid-sweep)

**Verdict: the NIGHT ARRIVES — the sky reads true night in every frame,
the lanterns hold their r2 cure, the fens pools read from the pose, the
dawn shows. 14/16 authored pass; lampwright is a boot-template capture
(the loading spinner is IN the frame — capture noise, not a code bug);
night-threshold passes but its mid-ground is thin. Honest sweep 6 solid
+ 3 marginal + 3 weak = ~9/12, and none of the three weak frames sit in
a rest — under the bar. Round 4 targets the outer annulus.**

- **Landed:** nightfall-stair (the crest rank of silhouettes against
  true night is the arrival the region promised), wick-road, the-choir,
  evensong, the-watch, cold-lantern, morning-vent (seams read, column
  reads, dawn glows behind), ash-veil (milk-pale under the dark),
  the-cradle, close-wick, close-cradle, spilt-light, ember-fens
  (marginal — the pool chain reads, faint but present), ember-dawn.
- **lampwright r3 is a WHITEOUT with the loading spinner visible** —
  the pose relaunch caught the compile. Not a composition failure; the
  r4 re-shoot of this one pose runs with SHOT_COMPILE_WAIT raised.
- **The Ember Dawn's arc ends read as a hard pale SLAB** (the-cradle
  top-left, spilt-light frame-left, sweeps 04/08/10/11): the additive
  band stops while the pale ring curtain behind it continues — a
  vertical yellow step; and one ring TOWER rises inside the dawn
  sector, reading as a bright pyramid poking through the glow.
  → DAWN_HALF 1.0 → 1.2 with the end-fade window 0.24 → 0.34 (the step
  smears out), towers suppressed across the dawn sector, ring fades
  0.52/0.68/0.80 → 0.50/0.64/0.72 (the far curtains keep more ink
  against the night sky), band ink a step warmer (chartreuse → ember).
- **Sweep 03 (u1363 v−134), 06 (u1393 v132), 11 (u1552 v−107) are BARE
  in the mid-ground** — the outer annulus between the named zones
  carries stubble too sparse to read past 15 m, and none of the three
  stands in a registered rest. → night blades 2900 → 3600 with the
  flank bias deepened (0.4 → 0.28 base, so the same rejection stream
  lands MORE of them in the outer band), stubble 8400 → 8800, far
  cards 5000 → 4600 (the trade pays the triangles), drift ribbons a
  hair wider (threshold 0.46 → 0.44) so the plain's mottle reads at
  sweep range.
- **night-threshold's forecourt is honest but thin** — the corridor
  genuinely extends past u 1240 (the Emerald Gate constraint: the gate
  composition lives past the parent's rings), but our first 30 m can
  carry more of the region's vocabulary. → two watch-ember seeps added
  at u 1152 / 1166 on the channel (echoing the Forge Combs' own
  watch-embers across the door), joining the 1182/1212/1240 chain.
- **ember-fens halos still a hair shy** → radius ×1.05 → ×1.12,
  opacity 0.17 → 0.19.

### Round 4 — sm3-r4 (18 authored + 12 sweep, with three targeted
re-shoot passes: r4b–r4e)

**Verdict: 18/18 authored pass — including the two probe-named cures
below. Sweep 11/12 with the one miss (06, the north outer flank) NOT in
a rest — still under the bar by one frame; round 5 is that frame's.**

- **The lampwright WHITEOUT was never capture noise** (r3's reading was
  wrong, and r4's first re-shoots with SHOT_COMPILE_WAIT raised still
  whited out). Probed by toggling nodes in the live harness: hiding
  `vigil-lampwright` cured the frame with the emissive untouched. Root
  cause: the mantle sheet carried BOTH windings "so the underside
  draws", and `computeVertexNormals` over paired opposite faces summed
  to zero → NaN normals → NaN pixels poisoning the light-shaft blur →
  the whole frame whited out around the animal. Cure: ONE winding +
  `DoubleSide`; a regression test now walks every wright normal for
  finiteness. The r4d re-shoot stands: the court reads, the coal-orange
  mantle crosses it mid-frame.
- **The Ember Dawn's "pale slab" was geometric, not ink** (r4b still
  showed it after the R3 end-fade widening): from inside the country a
  tangential sight line compresses any short end-taper to a few pixels,
  so the curtain stopped in a hard vertical edge wherever the band's
  end crossed the frame. Cure: a dome profile — full height only at the
  dawn's centre, the top diving to the foot toward both ends — so the
  silhouette is a descending arc from every angle. Verified across
  ember-dawn, the-cradle (top-left taper now soft), spilt-light and
  morning-vent in r4e.
- **Landed without further notes:** nightfall-stair, night-threshold
  (the watch-ember chain reads on the way in), the-watch, wick-road,
  the-choir, evensong, cold-lantern, ash-veil (ash fall present),
  ember-fens (pool-chain halos read), close-wick, close-cradle,
  the-cradle, spilt-light, morning-vent (seams + column).
- **Sweep:** 01/02/05/07/08/09/10/12 solid; 03 and 11 marginal passes
  (the R4 flank-bias landed blades across their mid-grounds); **06
  (u1393 v132) still reads one flat pale slope** — near blades only at
  the frame's foot, and its pitch (−0.03, near-level) holds the whole
  mid-field at 30–80 m where 0.5–0.9 m carpets are sub-pixel under the
  night fog. Not in a rest → under the standard.

### Round 5 — sm3-r5/r5b/r5c (sweep ×3 + the three veil-adjacent
authored poses re-shot)

**Verdict: sweep 12/12 (10 solid + 03/11 marginal, no misses);
ash-veil, cold-lantern, evensong hold. The region closes at 64 draws /
1,346,653 tris.**

- **r5 (ash skirt + settle paint): not enough.** A 700-tuft skirt ring
  (d 52–118 off the Veil's heart) and pale settle streaks in the paint
  went in — and frame 06 didn't move. The lesson named above: at a
  near-level pitch nothing at carpet height reads past ~30 m in this
  fog; density was never the failure mode, HEIGHT was.
- **r5b (20 flank bushes, rc 118–196 band): still not enough** — one
  bush per ~50 m of a ~1000 m ring cannot be guaranteed onto one
  bearing.
- **r5c (THE STRAYS): the cure.** Two lit lantern spires that wandered
  from the rows onto the north-west flank — stray-near (u1368 v146,
  11 m) stands dead on the sweep's bearing at 29 m, stray-far (u1342
  v161, 9 m) fades behind it at 59 m. Frame 06 now composes: blades and
  skirt tufts near, the lit stray mid, the crest fringe far. Sweep 01
  gained a horizon silhouette for free; cold-lantern and ash-veil hold
  (the strays sit outside both frames' subjects); the Cold Lantern
  keeps its solitude (66 m clear).
- The skirt, streaks, and bushes stay: they are what the flank should
  have carried from the start, and the strays need ground to stand on.
- Trades to hold the budget: night stubble 8600 → 8450, far cards
  4600 → 4300. Measured: **64 draws / 1,346,653 tris**.

## Close-out

- **Authored:** 18/18 pass (r4/r4d/r4e/r5c frames standing).
- **Sweep:** 12/12 (10 solid, 03/11 marginal, no misses) — sm3-r5c.
- **No-assets pass (dev server):** clean — the procedural fallback
  build composes every checked frame; the wright renders without
  whiteout (the NaN-normal cure holds with no painted maps in play).
- **Headed frame gate, scale 1.00 (the-choir, the densest court, and
  close-cradle, the garden floor):** median 16.7 ms / p95 17.9 ms and
  median 16.7 ms / p95 17.8 ms — both under the 16.9 ms bar.
- **Budgets:** 64 draws / 1,346,653 tris (caps 260 / 1.35 M).
- **Tests:** 30 region tests green; full suite green at commit.

## Flags for the orchestrator

1. **The reciprocal rim-seal cut in smoking-2 (the seventh run of the
   protocol).** In `smoking2/Smoking2.ts` `buildSeals()`, the rim ring
   (rimR 206 off their centre, 94 stacks of two spheres r 9 + r 7)
   crosses this corridor at **u ≈ 1146** and is gated only inbound
   (`u < 750 && |v| < 27`). Add the outbound gate, mirroring it:
   **skip stacks where `u > 1120 && |v| < 16`** — that releases the
   1–3 stacks whose spheres (r 9) reach into the swim channel (|v| < 5,
   asserted on our side u 1133–1315 at lifts 0.9/1.8/2.7). |v| < 16
   gives the channel edge ≥ 2 m of clearance past the sphere reach;
   the shoulder rows they already stand keep the flanks sealed.
2. **No ceiling cut needed.** Our threshold ceiling authors UNDER their
   closed far-rim ceiling across the whole overlap (3.8 m over the
   Night Threshold, the verdant-3 precedent) — asserted by our region
   tests.
3. **No distance-wall cut needed.** Their walls already part over the
   corridor (`GAP_OUT_HALF`, pre-reserved at the Night Door).
4. **This is the spoke's terminus** — no outbound reservation on our
   far side; our own rim ring and ceiling close the world's edge floor
   to ceiling.
5. The night-threshold capture pose stands in the honest pre-merge
   state: their rim stacks still cross the corridor in-frame until the
   cut lands (the same state every depth pass shipped in).
