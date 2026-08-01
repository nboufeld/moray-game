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
