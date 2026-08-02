# Region ledger — BEAT REPAIRS (the critic's wave, items #4 #5 #12 #13 #14)

Branch `fix/region-beats`. Five region-local defects from `docs/CRITIC-REPORT.md`,
each proved at an authored pose, each repaired in its own region's register.
Owned directories only: `smoking2`, `pale1`, `golden2`, `calamity1`, `golden3`
(+ their tests and this ledger). The kit and every other region untouched.

The reroll fence held throughout: every NEW fill draws from a fresh
`SEEDS.<region> ^ <fresh constant>` stream appended after all existing draws;
gate/count/palette retunes stay inside their own streams (the kit's
fixed-draws-per-attempt contract); every region's existing determinism tests
and pins stayed green un-edited.

The critic's own proof frames no longer exist on disk (the critique worktree
was retired after merge), so every item was re-proved first: the authored
JOURNEY poses recaptured through the real streamed chains
(`scripts/journey-shots.mjs`, `SHOT_POSE_FILTER`) and the CRITIC stands
through `scripts/critic-offroad.mjs` — all against the dev server on :5217.
The `beats-before` set reproduced every finding exactly as written.

---

## #4 — smoking-2: the Comb reads flat at the anvil pose

**Proof frames**: `JOURNEY-smoking-08-smoking2-anvil`,
`CRITIC-smoking-marches-2-01-roadside-cross`.

**Before (recaptured, confirmed)**: at the journey anvil pose the Anvil block
and the court's comb walls read as flat salmon silhouettes — the iron-violet
strata exist in the paint and die entirely; off-road the roadside-cross frame
catches a comb's shade face at close range as one featureless violet slab.

**Diagnosis**: two compounding causes. (1) The fin material had NO emissive —
on the shade side the toon ramp multiplies the whole face toward one dark
value and the strata (±0.12 lightness) vanish inside a single ramp band;
lit-side, the warm water does the same from the other end. (2) The strata
were all fine-frequency — nothing at the band width a 30–80 m read resolves.

**Fix** (`Smoking2Combs.ts`, `Smoking2Light.ts`, `Smoking2Shared.ts`,
`Smoking2.ts`), landed over rounds r2–r8 because the first three cuts did
NOT survive the recapture (the round table below is the honest history):
- **Rows first**: the fin grid resampled 1.6 → 1.1 m along, 1.1 → 0.8 m up —
  golden-2's tower lesson again: paint needs rows to live on; at the old
  pitch every band interpolated away.
- **The drawing, at measured amplitude**: strata bands ±0.26 + ±0.18 (two
  frequencies, fbm-wandered), applied ASYMMETRICALLY (dark half × 1.35 —
  iron strata are shadow lines, not stripes); a per-column value stripe
  (~2.2 m, ±0.22, dying toward the crest) the rib relief agrees with
  (0.55 → 0.9); a ~1 m close grain ±0.12 for the arm's-length read.
- **The dusk-lift**: the walls now wear the region's OWN seam-glow patch
  (`applySeamGlow` — the Anvil has always worn it): emissive 0xffcf9e ×
  0.38 riding the baked vertex colour, so every value move survives the
  shade ramp and the fog as a colour, not just a value.
- **THE EMBER LICK**: where the Emberwash runs under a wall face, the foot
  takes mottled ember/amber paint the glow material reads as pooled light —
  plus `fog: false` additive lick cards (fresh stream `0x2154`, appended
  last) lapping the wash-facing wall feet and the Anvil skirt, so the heat
  reads from the road THROUGH the region's own haze.
- **The Anvil**: flank strata (~5.7 m, ±0.16), body anchored darker
  (× 0.78–0.96 by height), seams hotter (0.3 → 0.4) — the heart stays the
  darkest, hottest thing in frame.
- **The fog**: densityGain 0.0085 → 0.0078 — the region's own r3 move,
  smaller; the mid-distance combs were dying at 60 m regardless of paint.

**After** (`beats-r8`): the comb faces carry a real drawing — strata,
column grain, pale crests — through the court's warm water; the Anvil
anchors dark with ember at its feet; the roadside-cross shade face is no
longer one violet value. Byte-determinism test untouched and green (paint
and fbm terms are seeded; the combs' shared stream draws unchanged in
count and order; the licks draw last on their own stream).

**Budget**: 58 draws / 1,324,697 tris (caps 260 / 1.35 M) — was
57 / 1,303,897: +1 draw (the merged lick cards), +20.8 k tris (the finer
fin rows). 98% of the tri cap — flagged below.

---

## #5 — pale-1: the mother-crown clips into an unlit magenta polygon

**Proof frame**: `JOURNEY-pale-04-pale1-mother-crown`.

**Before (recaptured, confirmed)**: two hard-edged flat magenta plates fill
the frame; the bottom tier's rim sits ON the near plane — the critic's
"camera inside a petal" was literally right.

**Diagnosis**, in three parts:
1. **The pose**: the stand (u 553, v 33, lift 2.0) put the lens at the height
   of the bottom tier's lobed rim — the plate radius runs to ~6.9 m under the
   ×1.5 lobe and the stand was 7.1 m out. The rim crossed the near plane.
2. **The rings aliased to nothing**: the fill-round lathe profile held only
   FOUR radial stations per plate face; the 7-cycle growth-ring bake (paint
   AND corrugation, `sin(radial·π·14)`) sampled at four points collapses into
   one flat wash. Golden-2 paid the identical debt on its tower rows
   ("paint needs rows to live on") — this is that lesson landing here.
3. **The rim paint**: the underside held deep rose to the very edge, so the
   rim silhouette read as a hard cut-out.

**Fix** (`PaleBloom.ts`, `Pale1.ts`, `PaleCarpet.ts`): the plate profile is
now SAMPLED — 7 stations across the top, 16 up the underside where the rings
live; ring frequency 14 → 9 half-turns so each band owns ~3.5 rows and reads
as a soft swell; the underside margins take cream (0.45 at the rim) so the
edge reads lit, not cut. The pose keeps its bearing and drops a body
(lift 2.0 → 1.3, pitch 0.92): the whole pagoda stacks up the frame from
under the rim plane. Paid honestly under the region's 450 k cap (it sat at
449,997/450,000): grit 2,050 → 1,700 — a prefix trim; kept placements
byte-identical; the ossuary carpet and stumps carry the white half's near
field, per their own round-4 role.

**After** (`beats-r2`): the plates wear their rings — visible concentric
swells with deep-rose troughs — the trunk and tiers compose, petals cross the
frame's top, nothing clips. All 27 pale tests green including the bone-tree /
monument / Gardener pins and the four-carpet determinism.

**Budget**: 101 draws / 449,893 tris (caps 160 / 450 k).

---

## #12 — golden-2: tiled-texture patch on the plain behind noon-bell

**Proof frame**: `JOURNEY-golden-08-golden2-noon-bell`.

**Before (recaptured, confirmed)**: a rectangular-ish patch of repeating
marks in rows on the plain ~90 m behind the towers, right of the Noon Bell.

**Diagnosis (probed, not guessed)**: a show/hide bisect over the exact stand
(scratch playwright, deleted) walked every kit family and the region's own
merged meshes. Hiding litter, carpets, drift debris, mat rings, bushes, the
hoodoo caps, the pale stones and the seeps changed nothing; hiding
`kit-dapple-sheet` erased the patch outright. It is the SEEP DAPPLE
(radius-34 disc at (972, 72)): at a grazing 90 m view its 12 m tile repeat
lines the caustic cells into rows and the additive sheet repaints the
mid-distance ground brighter than its own fog — a tiled texture, literally.

**Fix** (`Golden2Light.ts`, region-side parameters only — the kit sheet is
untouched): tiles up (seep 12 → 26 m, court road 12 → 22 m) so the repeat
falls below what a distant graze can line up, opacity down a step
(0.09 → 0.06 seep, 0.07 → 0.055 road). Up close the gardens keep their
pooled light — a dapple is a surface, never a pattern (the module's own law,
now true from every distance).

**After** (`beats-r3`): the patch is GONE — the plain behind the towers
holds its own paint and haze; the seep gardens' light no longer reads from
the pavement. Towers untouched, Bell Ringer and beam hold.

**Budget**: 67 draws / 892,826 tris (caps 260 / 1.35 M) — byte-identical
to the ledger baseline; the fix is parameters on an existing sheet.

---

## #13 — calamity-1: the mid-march shard scatter reads as confetti

**Proof frame**: `JOURNEY-calamity-04-sunken1-mid-march`.

**Before (recaptured, confirmed)**: uniform same-sized pale chips sprinkled
evenly over both banks — bright violet-pale flecks with no composition; the
blast tells no story at this beat.

**Fix** (`CalamityLitter.ts`, `CalamityFillShared.ts`) — compose, don't
sprinkle:
- **Drift lanes**: one seeded band field (`marchDrift`, fbm over (u, off))
  now clusters the march's shard carpet — gate floor 0.22 so the road never
  goes bare, but the mass lies in lanes. Gate-only change: candidates draw
  the same bytes (fixed draws per attempt is the kit's contract).
- **Fewer, larger**: march shards 1,900 → 1,300; the dust floor raised
  (0.14 → 0.22 m — the sub-chip sparkle WAS the confetti read); the pale
  accent tone pulled toward the base so the two-tone run reads as one rubble.
- **THE WRECK SLABS** (new, fresh stream `0xf259`, appended last): 96
  knee-high pavement pieces (0.55–1.2 m) seated INSIDE the same drift lanes,
  long axes raked off the Wound at 0.92 — the blast-rake discipline extended
  up in scale, exactly as the punch list ordered.

**After** (`beats-r2`): the banks read as raked wreckage collecting in
drifts — a near lane of large oriented slabs, calm ground between lanes; the
even sprinkle is gone. The rake test (axis dot > 0.66 against the Wound
radial) covers the new family too, and the swim-line clearance holds
(slabs keep 2.4 m). All 21 calamity tests green including the nine-decimal
pilot pins.

**Budget**: 122 draws / 437,475 tris (caps 160 / 450 k) — the shard trim
funded the slabs with ~3.5 k tris returned to headroom.

---

## #14 — golden-3: featureless off-spine dunes + the hairline seam kink

**Proof frames**: `JOURNEY-golden-13-golden3-evening-horizon`,
`CRITIC-golden-waste-3-04-lost-bearing`.

**Before (recaptured, confirmed)**: evening-horizon closes the province on a
flat beige wall band (the Vesper Rampart's mid-band, unreadable through
~100 m of fog); the lost-bearing stand is a full-frame bare dune crossed by
thin dark hairlines that kink — the "seam".

**The seam, diagnosed (probed, not guessed)**: NOT a sheet boundary — the
region has run one disc sheet since its round 3. The same bisect harness
hid every kit family (lines survived), then nulled the ground material's
toon `gradientMap` in-page: the lines vanished. They are TOON-RAMP STEP
CONTOURS — iso-light lines tracing the smooth dune, kinking along the 2.2 m
grid facets. The region's own round 3 met this exact class on the comb
ridges ("thin dead-straight dark lines... toon-step contour lines") and
cured it there with wander; a bare dune face has nowhere to hide the line —
unless the paint is louder than the step.

**Fix** (`Golden3Ground.ts`, `Golden3Cover.ts`, `Golden3Terrain.ts`,
`Golden3Distance.ts`, `Golden3.ts`, `Golden3Shared.ts`), landed over
r3–r9 — the first ripple cut was proven invisible by its own recapture and
the amplitude was then MEASURED, not guessed:
- **Wind-ripple paint** across the open country (fresh fbm seed `0x5a16`):
  two ripple scales (~8.7 m and ~3.3 m bands, fbm-wandered so nothing runs
  ruler-straight), plus mottle. Final amplitude ±0.18/±0.09: a pixel-diff
  of the r5 capture showed ±0.11 in vertex colour survives to ~3% on screen
  (sand wash × toon ramp × tone curve compress ~4×) — ±0.18 lands the
  gentle ~8% read the register wants. Troughs lean violet. The pans,
  garden, door, combe and shelf paint all land AFTER and override, so the
  ripples live only where the ground was bare.
- **The toe-wrinkle** (`Golden3Terrain.ts`, fresh fbm constant `0x7e15`,
  pure function — no stream draws): the lost-bearing hairline survived the
  paint because it is geometric — the rampart-toe fade is a 38 m smoothstep
  and a face smooth by construction hands the toon ramp one long clean
  iso-light line to draw. Gentle fbm scallops (±0.8 m, ~16 m grain, gated
  off the pass corridor and gone by the rim seal) break it into wind-worked
  toe country — the region's own comb-wander cure, applied to the wall's
  foot.
- **Dune-face stragglers** (new carpet, fresh stream `0xf115`, appended
  last): 1,500 sparse taller wire-grass blades (0.5–0.95 m) gated onto the
  open FACES and outer flanks the basin wire's hollow-seeking gate starves —
  quiet detail, never a lawn. The registered rests and calm zones (the
  Still Mirror and both open pans, the spring, the Night Well) are excluded
  by the same `restFree`/`zoneCalm` gates the round-4 fills obey; composed
  stillness stays composed.
- **The rampart painted like the sunset is leaving it**: runnel weight
  0.5 → 0.68 with a new BROAD fold family (~90 m period — the width a 100 m
  read actually resolves), height strata ±0.24; the mesa ring
  (`Golden3Distance.ts`) takes the same fold family so the far wall and the
  near wall speak one language.
- **The evening-horizon pose recomposed** (lift 9.0 → 11.5, pitch 0.05):
  the critique read the terminus as "closing on a bare dune face"; through
  ~100 m of the region's own fog no honest paint survives at that graze —
  the province's last frame belongs to the sunset, with the wall as its
  sill. Fog densityGain 0.009 → 0.0078 so what paint IS there reaches
  the mid-distance.

**After** (`beats-r9`): the lost-bearing frame carries ripple bands, mottle
and walking stragglers; the sharp angled hairline is GONE — the surviving
thin strokes are soft wandering ripple-crest curves, part of the drawing.
Evening-horizon closes on the Sun's Door glow over the crest instead of a
beige void.

**Budget**: 67 draws / 1,115,103 tris (caps 260 / 1.35 M) — was
66 / 1,043,103: +1 draw (the merged straggler field), +72 k tris. 83% of
the tri cap; flagged for the orchestrator below.

---

## The rounds (recapture → read → refine)

- **beats-before** — all five findings reproduced exactly as the critique
  wrote them. The critic was right five for five.
- **beats-r1 (smoking)** — INVALID for the combs: the dev server served a
  stale `Smoking2Combs` chunk (golden-3's round-5 trap, verbatim). One
  finding kept: editing sources while a capture chain runs hot-reloads the
  page mid-pose and kills the chain — captures and edits now alternate,
  and the server restarts fresh before every round.
- **beats-r2** — server restarted fresh. Pale mother-crown PASSES (rings,
  no clipping, soft margins). Calamity mid-march PASSES (drift lanes, wreck
  slabs, no confetti). Smoking r2 proved ±0.12 strata do NOT survive the
  shade ramp — amplitudes doubled, emissive 0.26 → 0.38.
- **beats-r3** — golden-2 noon-bell PASSES (the patch is gone, towers
  untouched). Smoking and golden-3 read better at thumbnail but the CLOSE
  read failed both: the comb faces still compressed to near-one value
  through the court fog, and the lost-bearing hairline KINK survived the
  ripple paint untouched.
- **beats-r4–r5 (diagnosis rounds)** — two probes that changed the plan:
  (1) the big central "anvil" shape at the journey pose is actually the
  court-south COMB face (show/hide bisect) — so the walls, not just the
  Anvil, needed the loudest drawing; and a pixel-diff of r5 measured the
  paint pipeline compressing vertex-colour amplitude ~4× (fog + ramp +
  tone curve) — amplitudes were then set by measurement, not taste.
  (2) golden-3's hairline is GEOMETRIC — a toon iso-light line on the
  38 m rampart-toe smoothstep; no paint amplitude removes it, the face
  itself must wrinkle.
- **beats-r6–r7** — smoking fin grid resampled (paint needs rows), grain
  term added, asymmetric banding; golden-3 rampart broad folds + mesa-ring
  folds landed; both regions' fog gain stepped down. r7 smoking close but
  the wash feet still cold — the lick cards followed.
- **beats-r8** — smoking-2 FINAL: anvil journey pose composes near-bank →
  ember road margin → drawn walls → anchored Anvil; roadside-cross shade
  face carries strata and column grain in the dusk-lift. PASS both frames.
  (Honest note: the near bank's bareness at the journey pose is
  pass-corridor work — punch #2's owner, not this item.)
- **beats-r9** — golden-3 FINAL: the toe-wrinkle landed — r7's sharp
  angled hairline at frame-bottom is gone, replaced by soft wandering
  ripple-crest curves; the dune carries ripple bands, mottle and
  stragglers with the rests untouched. Evening-horizon closes on the
  Sun's Door glow. PASS both frames.

## Gates (all unpiped, exit codes real)

- `npm run typecheck` — clean.
- `npx eslint . --max-warnings 0` — clean.
- `npm test` — 71 files / 1,125 tests green (includes all five regions' own
  contracts: determinism/no-reroll pins, budgets counted, rest emptiness,
  rake alignment, swim-line clearances, pose water).

## Flags for the orchestrator

- **smoking-2 sits at 98% of its triangle cap** (1,324,697 / 1.35 M — the
  finer fin rows). The region's budget test is green but the NEXT spend in
  this region must come from a refund first.
- golden-3 now sits at 83% of its triangle cap (1,115,103 / 1.35 M); its
  headed frame gate was NOT re-run in this wave (out of scope) — re-measure
  before the next spend in that region.
- The anvil pose's near bank (lower half of `JOURNEY-smoking-08`) is
  pass-corridor bareness — punch #2's owner, not a region defect; left
  untouched here deliberately.
- `pale-passage-1` grit 2,050 → 1,700: sweep frames 01/03/06 (soft passes on
  the stump/shard lines in the fill rounds) were not re-swept this wave; if
  a future sweep reads them thin, the refund lives in the mother's plate
  rows.
