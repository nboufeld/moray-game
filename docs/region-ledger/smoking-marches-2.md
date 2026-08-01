# Region ledger — smoking-marches-2 · THE FORGE COMBS

Slot `smoking-marches-2` · spoke azimuth 2.79 · centre r = 940 · disc radius 220.
Branch `region/smoking-marches-2`. Seed stream `SEEDS.regionSmoking2` (XOR
substreams in `Smoking2Shared.FC_SEEDS`).

## The concept

The Smoulder Fields were the province's warm doorstep; the Forge Combs are
its deep hearth — and NOT another caldera. Past the Smoulder's far shore
the ground crests a milky **Cinder Saddle** and falls down the **Clinker
Stair** between the **Doorcombs**, and the country opens: long black
basalt fins standing in broken ranks (**the Comb Walls**), the
**Emberwash**'s glowing seams running the floor between them like a road
drawn in heat, the **Anvil** holding the heart, the **First Hearth**'s
junction star burning in its southern basin, the **Pillow Meadows**'
milk-crusted mounds breathing to the north, and the **Glass Shore**'s
obsidian hush running out to the **Night Door** — two fins leaning
together over the far pole, framing the reserved depth-3 pass. The
**Ember Skate** glides its slow lantern circuit of the wash. The province
vocabulary holds — heat below, dark ground, amber pooled in mottle,
milk-bright tops — in a deeper, more solemn register: wall-country, not
bowl-country.

## Named places (sub-biomes and landmarks)

| Place | Where (u, v) | What |
| --- | --- | --- |
| The Cinder Saddle | u 635–745 on the pass | milky crest road from the Smoulder's shore; seep mats every 25–35 m |
| The Clinker Stair | u 745–800 | five clinker benches dropping 13 m, risers seamed with ember |
| The Doorcombs | (758, −26) & (764, 24) | the gate pair the stair descends between |
| The Long Gallery | (840, 38) & (828, −40) | first comb rank, parted by the wash |
| The Broken Comb | (863, 24) & (855, −6) | two stubs + fallen lintel over the road; swim-under |
| The Emberwash | u 762–1075, wandering | the road: charcoal rift floor, amber seam veins, ember pools, mat rings |
| The Kings' Run | (903, 40) & (934, 26) | the tallest walls' aisle |
| The Anvil | (938, −22) | the heart: flared forge-block, ember seams, court glows south of the road |
| The First Hearth | (905, −95) r 70 | fissure-junction basin, the deepest floor (−20), junction star of veins + shimmer |
| The Pillow Meadows | (890, 128) r 92 | crusted mounds, milk-bright crowns, the region's gentle north |
| The Glass Shore | u > 1030 | obsidian shelf, shard drifts, the one cool register |
| The Night Door | (1122, 0) | two fins leaning together over the far pole — the reserved depth-3 frame |

## Registered rests (MASTER §1.2)

- **The Ladle** — (886, 122) r 12. A pillow-crown bowl holding a milk pool;
  its one dim glimmer shaft is the room's LICENSED light. Fauna-free,
  fill-free, glow-free otherwise.
- **The Glass Hush** — (1058, −64) r 12. Bare obsidian pocket, one witness
  erratic. No fill, no fauna, no glow.
- **The Anvil's Shadow** — (949, −37) r 9. The lee floor south-east of the
  Anvil, off the wash. No fill, no fauna, no glow.

`stillnessGate` (terrain) and `restFree` (fills) read one registry; the
region test walks every kit instance against it.

## The pass corridor (Smoulder Fields → Forge Combs)

The Smoulder's ledger reserved no depth-2 pass, so this region authors
the connection. `PASS_TONGUE`: fromR 635 → toR 840, half-width 14 → 52 —
the tongue reaches ~30 m INSIDE the Smoulder's disc (edge at u 665, its
rim ring at rc 206 ⇒ u 651 on the spoke), the verdant-3 overlap pattern:
the bounds handover overlaps, never gaps. Ownership over their shore is a
whisper (thresholdGate 0.14) rising to full past u ≈ 724. The framework's
depth-boundary reject circle (centre 940, r 260 ⇒ u < 680 on the spoke)
truncates where RegionField consults us; below it the terrain target
stays within ±1.2 m of dune level (asserted) so the annex floor stays
honest over their shelf. Our own rim ring is gated over the corridor
(u < 750, |v| < 27) and the flanks are sealed by shoulder rows u 640–806
at ±(passHalfWidth − 4ish), the verdant-3 seal shape. Corridor swim-line
asserted u 637–812 at three lifts, and on down the wash to u 1060.

## The depth-3 reservation (for smoking-marches-3)

**Reserved: the far pole of this disc, on the spoke (azimuth 2.79), at
the Night Door (u ≈ 1122).** The Night Door's two fins (1116, −14) and
(1118, 14) lean together over the reserved corridor; the distance walls
already PART over it (GAP_OUT_HALF 0.16 rad about the outbound azimuth,
mirroring MASTER R4), and the rim ceiling-closure + rim seal ring at the
far pole remain CLOSED — the depth-3 worker authors their own threshold
under our rim exactly the way this region did under the Smoulder's, then
flags our rim ring/ceiling for the orchestrator's reciprocal cut.
Everything a depth-3 tongue needs to reach 30 m inside our rim (to
u ≈ 1110) is unobstructed on the spine: no comb, collider or rest sits on
|v| < 11 for u 1080–1160 except the Night Door pair at ±14.

## FLAGS for the orchestrator — reciprocal cuts in smoking-1 (NOT made here)

Measured against `smoking1/` as built on this branch's base:

1. **Rim seal ring** — `smoking1/Smoking1.ts` `buildSeals()` rim ring:
   rc = 206 of its centre (u 445 on the spoke), 94 stations, one sphere
   r 9 at floor +1.5 per station. It crosses our corridor at **u ≈ 651,
   |v| ≲ 27**. Needed cut: skip stations where `u > 640 && |v| < 15`
   (our saddle channel plus shoulders; our own shoulder rows seal
   |v| ≈ 13–38 from u 640). The verdant-2 cut (`fbab214`) used exactly
   this shape (`u > 1120 && |v| < 15`).
2. **Far-side distance rings** — `smoking1/SmokingDistance.ts` `LAYERS`:
   rings at rc **246 / 264 / 286** of its centre, opaque fog:false
   curtains with ridges 6–13 m; they cross our corridor at **u ≈ 691 /
   709 / 731, |v| < ~35** — straight across our Cinder Saddle and the
   Clinker Stair's approach (they also stand inside our own disc's
   water there). Needed cut: part each ring over the outbound azimuth
   (gap half-angle ≈ 0.14–0.16 rad about azimuth 2.79 on the far half-
   plane u > 445), mirroring the verdant-2 `GAP_OUT_HALF` pattern with
   its 0.14 end fade. Until this cut lands, the saddle's reveal poses
   read their curtains mid-corridor (visible in sm2-r1 saddle-crest).
3. **No ceiling flag**: the Smoulder's ceiling closes at its rim
   (rc > 186 of ITS centre) but our tongue's threshold ceiling (3.8 m)
   dips beneath it across the overlap, the verdant-3 precedent — no cut
   needed.

Until cut 1 lands, the corridor is physically sealed at u ≈ 651 (the
region is capture-reachable via the QA door only) — the same pre-merge
state the Canopy Deep shipped in.

## Budgets (measured by `tests/regionSmoking2.test.ts`, counted not claimed)

- Round 1: **54 draws / 661,901 tris** (caps 260 / 1.35 M). Headroom noted;
  round 2 spends some of it on near-layer density.
- Round 5 (final geometry): **57 draws / 1,303,897 tris** (caps 260 /
  1.35 M) — the r2 density spend plus the Strand Stones' single draw.

## The loop

### Round 1 — sm2-r1 (15 authored + 12 sweep, preview server workaround)

Dev-server captures starved (~5 min/pose); switched to `npm run build` +
`vite preview --port 5207` + `SHOT_PER_LAUNCH=1` (the verdant-3
workaround). Sweep poses drawn offline via `SHOT_POSES_FILE` (the Canopy
Deep close-out's finding — the in-page draw needs a dev server).

**Verdict: bones right, dressing fails the three-layer law in most
frames. Honest sweep score ≈ 3/12.** The warm below-light mood, the road,
the Anvil silhouette and the wall skylines all read; almost everything
else is under the bar.

- **Ground paint too uniform and pale.** One mauve-tan value everywhere;
  the province's "dark ground, amber pooled in mottle" is missing. →
  darken base gravel a full step, strengthen clinker darks, ADD amber
  mottle pools to the plain, darken wash charcoal + stair cinder, darken
  the Glass Shore properly (it read as more tan dune).
- **Near layer too sparse.** Stubble 5200 over a 215 m disc ≈ nothing;
  sweeps 01/02/04/12 are empty plains. → stubble 11k, fronds 3.2k, tufts
  2.8k, litters ×1.5, saddle stubble 1.4k. Budget headroom covers it.
- **Comb walls read as pale cardboard.** Fog eats them and their own
  tones are too light; crest notches read as rectangular punched holes
  against bright water. → darken COMB_TONES, strengthen base shadow +
  strata, pale crust caps stronger, ANGLED notches, heights up (kings 22,
  galleries 17–18, doors 14–16, night pair 16–17) so crests clear the
  welts.
- **Mat rings scorching** — brightest thing in half the frames, read as
  lava pancakes. → dim all band palettes.
- **Yellow tufts/shards read as confetti** (sweeps 05/06/09, night-door).
  → desaturate duskTufts, recolor glass shards charcoal + sheen.
- **first-hearth pose blocked** by hearth-west's flat face 18 m out. →
  reposition NE of the basin looking between the fins.
- **broken-comb pose** framed the lintel floating against sky from a
  mound top. → stand ON the road, read the slab spanning ahead.
- **kings-run pose** 80 % empty teal. → pitch 0.4, drapes denser/longer
  on the kings, gap-runner shoal crossing the aisle.
- **ember-skate pose** missed the skate (76 s loop, wall-clock phase — the
  verdant-3 twin-court caveat). → reframe as a high oversight of the
  Anvil court + a long reach of road; settle 8 keeps the lottery odds
  fair, and the pose composes road + Anvil even on a miss.
- **the-ladle pose:** the rest's composition doesn't exist yet — the milk
  pool must be BUILT (pale pool disc + crust rim, licensed glimmer
  above). Distance ring band above the horizon read maroon → blend INK
  toward the fog rose and fade ring tops harder.
- **saddle-crest** is honest (their country, our fin promise above their
  curtain) — keep.
- Artifact watch: a straight dark crease crossed sweep-01's plain
  (bottom-right) — suspect a disc tile seam or the saddle sheet edge;
  re-check in r2.

### Round 2 — sm2-r2 (14 authored + 12 sweep)

**Verdict: the ground reads at last — dark gravel, amber mottle, dense
stubble; road frames (emberwash, broken-comb, anvil) pass properly.
Honest sweep ≈ 9–10/12. Three systematic fails remain.**

- **What landed:** the r1 rework did its job — emberwash-road, broken-comb
  (ember light on the near wall face is the best frame yet), anvil,
  clinker-stair, pillow-meadows, first-hearth all pass; sweeps 03, 05–08,
  10–12 pass with near+mid+far all reading.
- **doorcombs pose buried in the parent's curtain.** At u 726 the whole
  frame was one maroon wall: the stand sat BEHIND smoking-1's outermost
  un-cut distance ring (crossing at u ≈ 731). Not a fill problem — a
  flag interaction. → stand past u ≈ 740 until the orchestrator's cut.
- **Fog crushing the mid ground.** densityGain 0.011 folded everything
  past ~50 m into one putty value — walls read as flat cardboard again
  DESPITE the darker tones (the vertex paint survives to the eye only
  ~40 m). → density down to 0.0085 (the Smoulder's own), blue up a step,
  backdropFade 0.56.
- **Bare violet flanks** (sweeps 02/04): the base stubble's hard u<742
  cutoff left the saddle flanks naked. → ramp the gate in from u 698.
- **the-ladle pool = grey UFO.** The single-level disc floated over the
  pillow mounds and clipped through crests. → drape every vertex to its
  own floor, radius 5, opacity 0.48.
- **kings-run still 60 % open water** at pitch 0.36 → 0.18.
- **glass-shore aims into the wash gully**, obsidian sheet out of frame →
  re-aim onto the sheet, sheen contrast up.
- **ember-skate: second miss.** The 76 s wash-length circuit is a phase
  lottery for ANY frame (connective-3's route lesson, verbatim). → the
  circuit itself is wrong: replaced with a compact Anvil-court loop
  (u 948 ± 46, v wc ± 9) that a single stand can hold IN FULL — the
  keeper rides the heart's reach, and no capture or visiting diver can
  miss it.

### Round 3 — sm2-r3 (14 authored + 12 sweep)

**Verdict: doorcombs, kings-run now pass; fog fix carries the mid ground;
sweeps 9–10/12 with the two misses both in the far-east band. One new
failure mode found and root-caused: the discovery flash.**

- **doorcombs**: passes — both jambs, stubble, perchers, drapes.
- **kings-run**: passes — aisle floor + both faces + rim perchers.
- **broken-comb / emberwash-road / anvil**: strong; the thinner fog gives
  the walls their own value to ~90 m.
- **the-ladle**: the pool now lies in the bowl but the coarse ring
  (26×6) shows hard tessellation facets against mound crests → 48×12.
- **glass-shore**: STILL reads gully-first — the re-aim helps but the
  sheen needs the extra step (r3 paint change captures in r4).
- **ember-skate WHITEOUT, root-caused by bisect** (playwright, per-mesh
  hiding): the white is not a sprite at the camera — it is the DISCOVERY
  FLASH. The skate is a findable target; the r3 stand aimed straight
  down the loop's axis, so whenever the lantern drifted under the held
  reticle the game began focusing it and the capture caught the flash.
  → r4 aims the reticle at the ANVIL: the loop stays in frame, the
  reticle rests on stone, crossings are momentary.
- **Sweep misses (02 at 1123,0; 04 at 1128,27)**: both in the Night
  Reach — the east rim band past the Glass Shore's hem has no near layer
  of its own (shards fade at the seal, tufts thin at the rim). → a
  dedicated Night Reach blade carpet (3.2k, charcoal w/ milk-pale tips,
  u > 1032) + shards 2.1k over a wider disc.

### Round 4 — sm2-r4 (14 authored + 12 sweep)

**Verdict: sweep 12/12 (the Night Reach carpet closed both far-east
misses); authored 11/14. Three poses still under the bar, each
root-caused.**

- **Passing and settled:** doorcombs, saddle-crest (their curtain still
  crosses it — flag 2 — but our side is honest), emberwash-road,
  clinker-stair, comb-gallery, broken-comb, anvil, kings-run,
  first-hearth, pillow-meadows, night-door (the new charcoal stubble
  gives the door's forecourt its floor).
- **the-ladle: dark torn-cloth shards around the pool.** Root cause in
  the material, not the drape: `poolSprite()` is a halo on BLACK, and
  the pool used *normal* blending — every black texel rendered as a
  48 %-opacity dark shard wherever the draped rim tilted. The ember
  pools never showed it because they blend additively. → additive.
- **glass-shore: a fog wall.** The stand read 50 m across the sheet at
  the rim and found nothing between the near shards and the far rim —
  the shore HAS no mid-ground furniture. → the Strand Stones: five low
  hexagonal obsidian plates, half-sunk, dark flanks under sheen tops
  (one merged draw, colliders + contacts), and the pose stands on the
  shore reading them.
- **ember-skate: the lantern out of the fog's reach.** Three probe
  launches (scripts/probe-skate.mjs, the harness's own waits) found the
  skate at three different reaches of the ±46 m loop — two of them
  ~100 m from the r4 stand, past what the fog lets a 3 m animal read.
  The loop is a lottery not because of the stand but because flight
  time counts from PAGE BOOT. → r5 shrinks the loop to ±26 m; r6 kills
  the clock outright (below).

### Round 5 — sm2-r5 (14 authored)

**Verdict: the-ladle and glass-shore PASS (milk lies in the hollows;
the Strand Stones carry the shore's mid-ground). ember-skate still
under the bar — the ±26 m loop kept every phase in frame, but a 3 m
skate at an unknown reach of a 52 m court is a speck among tufts; the
pose needs the animal NEAR, which needs phase control, not framing.**

- **The fix that holds: the keeper ROOSTS.** The skate now lies
  wings-still on the warm seam road (the loop's θ₀ point) and lifts
  into its round only when a diver first comes within 90 m of the
  court. Flight time counts from that wake, never from page boot — so
  a capture's settle always finds it the same seconds into the same
  circuit, and a visiting diver gets a reveal (the ember lantern rising
  from the road) instead of a creature mid-lap. Wall clock cannot reach
  it: connective-3's traveller lesson answered in the animal's own
  behaviour instead of a QA pin. Probe: two launches, bit-identical
  position at the held frame.
- The discovery target now rides the skate's nose (the morays' head
  convention) instead of a fixed point of court water; the pose's aim
  ray to the Anvil's cap passes ≥ 6 m over the flight band, so the
  reticle never rests on the animal (r3's flash lesson held).
- Emissive up 0.5 → 0.62: the lantern must read at the loop's far
  reach (~50 m in the court's own haze).

### Round 6 — sm2-r6 (14 authored)

**Verdict: 13/14 pass — every pose but the skate's is settled. The
roost-wake made the animal's held-frame position EXACT (u 950.1,
v −0.5, probed bit-identical across launches), but the r6 stand around
it was wrong twice, and both failures are now laws for the file:**

- **ember-skate, the flat violet frame, root-caused by probe rays:**
  the r6 stand floated in the road gully at road level, aiming across
  a bend. Six probe rays from the held camera found ground 2.5–14 m on
  ALL sides — the stand sat in a mound pocket, and the aim ray cut
  into the near bank's shaded brow: the whole lens was close dark
  gravel, no bug anywhere. *A road-level stand may not aim across the
  road's own bends.* → the r7 stand is ON the road east of the court,
  aiming straight down the swim line at the skate's exact held point;
  probed floors along the whole ray keep ≥ 2.7 m clearance.
- **The discovery-distance law, probed both ways:** the focus scanner
  arms inside 14 m (`maxDistance`). A trial stand 17.4 m from the held
  point still tripped it — the ROOST sits 7 m from that stand and the
  rise crossed the aim cone inside focus range mid-settle; the held
  frame carried the codex banner. The final stand keeps the animal's
  whole flight — roost included — at ≥ 14.8 m, so the reticle can rest
  dead ON the skate with the scanner silent. *A creature pose's stand
  must clear 14 m against the flight path's nearest point, not the
  framed point.*
- **Everything else holds from r5:** the-ladle's milk lies nested in
  the mounds (additive, 48×12 drape); glass-shore reads Strand Stones
  → shore band → far comb; night-door's forecourt floor is carpeted
  and both watch-embers show; saddle-crest remains honest-but-flagged
  (the parent's uncut curtain, flag 2).

### Round 7 — sm2-r7 (14 authored + 12 sweep)

**Verdict: 14/14 authored PASS; sweep 12/12. The standard is met.**

- **ember-skate finally passes**: the animal rests dead on the reticle,
  dark wings and milk-pale rim silhouetted against the pale comb wall,
  ember pools on the road beneath it, the broken lintel and haze
  beyond — and the HUD stayed 0/N (the scanner never armed; the whole
  flight holds ≥ 14.8 m from the stand). The frame matched the probe's
  screenshot pixel-for-pixel — the roost-wake determinism is real
  across launches.
- All other authored frames bit-identical to their r6 passes
  (spot-checked anvil + the-ladle against r6 — deterministic build
  confirmed frame-for-frame).
- **Sweep 12/12** with three-layer law: the weakest two (02, a
  downward Night Reach slope; 10, a hazy mottle plain) still carry
  near litter + blades, mid crest structure, and a far skyline or
  water band. No miss landed in a rest.

## Gates (all unpiped, exit codes real)

- `npm run typecheck` — clean.
- `npx eslint . --max-warnings 0` — clean.
- `npm test` — 60 files / 869 tests, all green (includes
  `tests/regionSmoking2.test.ts`: containment walking kit groups to
  child meshes in world space, rest emptiness, determinism/no-reroll,
  world-map separation, corridor swim-line, wash-shoal honest water,
  skate registration + deterministic updates).
- **Headed frame gate at scale 1.00** (SHOT_HEADED, 5 s samples,
  301 frames each):
  - anvil court (densest): **median 16.7 ms** (59.9 fps), p95 18.4 ms.
  - emberwash road: **median 16.7 ms** (59.9 fps), p95 18.6 ms.
  - Both under the 16.9 ms law.
- **No-assets pass**: full authored set captured with assets blocked
  (`sm2-r7-noassets`) — every frame reads essentially identical to the
  painted set (the region is procedural throughout: painted ground
  bakes, vertex-coloured combs, kit fills, the skate's own sheet). One
  harness finding for the file: `blockAssets` aborts `**/assets/**`,
  which on a PREVIEW server also kills the app's own `dist/assets/*.js`
  bundle — the no-assets pass only runs against the dev server.
