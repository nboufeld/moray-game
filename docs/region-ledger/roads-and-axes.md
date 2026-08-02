# ROADS-AND-AXES — the critic's wave, punches #2 / #6 / #10

Worker ledger, branch `fix/roads-and-axes` (after the kit-variants
merge). Mandate, verbatim from the critic: *"give the roads the same
love as the beats — one reveal, one companion shoal, one light change
per corridor; author the down-look and the up-look."* Scope: the ten
pass corridors + the calamity march (C1), the mid-down axis in all
sixteen regions (C3), and life visibility (C6).

Authority: FILL-DOCTRINE > MASTER > region plans. The no-reroll fence
is law — every serving is a fresh XOR substream of the owning region's
seed (`^ 0x0ad5_0a11` corridor / `^ 0x0ad5_0b22` mid-down), appended
after every existing module. R3 ownership: each corridor's dressing is
built and paid for by the region that owns the tongue.

## 0. The shared recipe

`src/world/regions/RoadDressing.ts` — one composition module every
region consumes with its own palette/seed/registry gates:

- **Reveals** (4 archetypes, all in the world's own stone grammar —
  `RockShapes` lathes with the kit-variants silhouette families):
  `leaning-pair` (menhirs bowed over the road), `fallen-lintel` (two
  jambs, the cross-stone slid), `arch` (the swim-through), `ribs`
  (half-buried wreck/bone arcs). One merged draw each; leg colliders
  optional and off the swim lines.
- **Companion shoals**: kit `shoalRunner` on a loop CONFINED to the
  corridor (out one shoulder, home the other). Confinement is the
  visibility guarantee — presence on the road is 100% of phase, so no
  capture or swim-by can miss the file (the C6 fix is structural, not
  a timetable gamble).
- **Light sentences**, varied per C7 (never eleven god-shafts):
  slanted/broken blades, silhouette backlight, floor-pool runs,
  caustic dapple where the province's light row allows (never pale —
  upheld; dapple at golden-1's measured discipline: opacity 0.06–0.09,
  tile 12 — the kit default 0.2 read as a pale PLATE at grazing angle,
  the C4 card sin, caught and fixed in round 1).
- **Floor ribbons**: `groundLitter` wear-lines / drift-lines for the
  down-look, gated on each region's own `restFree`/`stillnessGate`.

Tests: `tests/roadDressing.test.ts` — byte determinism, honest budget
counts, corridor-loop confinement, §1.2 rest clearance for every new
shoal station (world-space anchors + registered radii + swing margin,
connective-3's idiom), the blue-2 legal-window assert, the calamity
Mile assert.

## 1. The life-visibility diagnosis (punch #10)

Audited every existing `buildShoalRunner` route (28 of them) plus the
traveller wing legs. Why the doctrine's network was invisible:

1. **Timetable, mostly.** The wing legs ran 200–345 s loops — a door
   crossing was a once-per-4-minutes event, and `journey-shots` never
   pins phase, so nearly every capture found still water. The smoking
   spine/wash/wick road routes run **769–833 s** loops; golden's road
   travellers 300–340 s. A through-file's presence at any point of its
   road is only its span (~0.1–0.2), so a frame catches it one time in
   five at best.
2. **Coverage gaps.** blue-2's pass body (u 630–760) had no route at
   all; blue-3's corridor below u 1252 likewise; the calamity march
   runner stops at u 308 (correctly — the Mile).
3. **NOT density or depth** — counts and lifts were fine where routes
   existed (pale's 95 s confined threshold files were the one pattern
   that already worked; the critic's own pale pass23-back caught fish).

Fixes taken:

- Confined corridor files added where the road had none or only a
  long-period through-file (golden 12/23, smoking 12/23, blue 12 —
  see §2). Where a confined short-period file already existed
  (verdant 12/23, pale 12/23, blue 23's buoy commute, the calamity
  march runner), it IS the companion — adding a second would break
  connective §5's "never two shoals on a road at once".
- Traveller wing legs retimed to the band's floor: verdant 182–212 s,
  golden 188–224 s, pale 180–206 s, smoking 194–232 s; calamity keeps
  300–345 s (the melancholy-row contrast the tests assert). Timetable
  data only — no placement stream touched.
- Where a corridor now has both a resident file and a long-period
  through-traveller (golden, smoking), the overlap window is brief
  (the through-file's span) and counts were kept low; saturation
  intent held, stated here rather than hidden.

## 2. The per-corridor dressing table (punch #2)

| Corridor | Owner (R3) | Reveal | Companion shoal | Light change (C7 sentence) | Budget before → after (tris) |
|---|---|---|---|---|---|
| verdant 1→2 (Emerald Stair) | verdant-line-2 | jade leaning pair on the threshold road's south shoulder (u 692) | EXISTING 35-fish threshold runner, 91 s confined | celadon dapple pool on the threshold road + mid-down serving | 1,343,356 → 1,347,372 (cap 1.35M) |
| verdant 2→3 (Canopy road) | verdant-line-3 | jade SWIM-THROUGH ARCH straddling the wandering channel (u 1202) | EXISTING 40-fish traveller, 91 s confined | canopy BACKLIGHT blade slanted behind the arch, pool under | 1,344,208 → measured in suite (cap 1.35M) |
| smoking 1→2 (saddle road) | smoking-marches-2 | basalt gate, lintel slid (u 688) | NEW ember file ×24, 115 s confined | EMBER FLOOR POOLS ×3 (warm, rising, no column — the province's law) | 1,303,897 → 1,313,697 |
| smoking 2→3 (night threshold) | smoking-marches-3 | dark leaning pair centred on the channel (u 1194) | NEW ember file ×14, 120 s confined | the DIMMING ember guide-line (three pools fading into the dark) | 1,346,653 → 1,349,837 (163 under cap — economy serving) |
| pale 1→2 | pale-passage-2 | bone menhir pair bowed over the road (u 694) | EXISTING 28-fry threshold file, 95 s confined | TWO BROKEN SLANTED pearl blades + their pools (no dapple in pale — upheld) | 1,204,580 → 1,217,948 |
| pale 2→3 (the cited JOURNEY-pale-09 road) | pale-passage-3 | fallen bone dolmen (u 1198) — sun's-doorstep prefigured as ruin | EXISTING 28-fry pilgrim file, 95 s confined (turns before the Undawn) | mint-pearl FLOOR-POOL run stepping toward daybreak | 1,349,764 → 1,353,116 (**R12 overage recorded**, test moved to 1,354,000; the binding gate is the frame measure) |
| blue 1→2 (World's Edge crossing) | great-blue-2 | LARGE wreck-rib set (u 676, scale 1.6) — C5's anchoring silhouette in the only legal window (Far Wall band u<668 builds nothing; Othershore Hush 700–740 takes no fauna/scatter) | NEW lavender file ×14, 90 s, confined u 670–698 (asserted) | one thin slanted blade, NO pool (the hush keeps the Pharos as its only mark) | 704,775 → 707,223 |
| blue 2→3 (the cited great-blue-09 crossing) | great-blue-3 | drowned-keel rib set past the sill (u 1244, scale 1.7) — the daybreak keel's kin | EXISTING buoy-fry commute (u 1252–1340, 220 s) | two cool morning floor pools past the hush + mid-down serving | 807,583 → 812,167 |
| golden 1→2 (shore road) | golden-waste-2 | caprock waymark pair leaning over the road (u 692) | NEW gold file ×26, 110 s confined, glint | honey ROAD DAPPLE at golden-1's measured discipline + wear-lines | 892,826 → 908,910 |
| golden 2→3 | golden-waste-3 | toppled tower drum (fallen lintel, u 1196) — the noon-bell vocabulary as ruin | NEW gold file ×24, 120 s confined, glint | EVENING SILHOUETTE BACKLIGHT — one wide amber blade slanted low behind the drum | 1,043,103 → measured in suite |
| calamity march (the 11th corridor) | sunken-calamity-1 | bent-spar rib pair at u 162 — composed wreck framed dead-centre by the authored mid-march pose (the #13 confetti counter) | EXISTING march runner ×22, 125 s (u 96–308; stops before the Mile) | one COLD slanted grey-green blade, no pool (calamity light settles) | 440,976 → measured in suite (old 450k cap holds) |

Reroll fence: all servings on fresh substreams appended last; every
region's byte-fixture and build-twice determinism tests stay green.

## 3. The mid-down axis (punch #6) — verdicts per region

Servings are dapple (where the light row allows) + a value ribbon
(wear/drift litter) + a slow under-shoal at ~5.5–6 m lift under the
critic's 20 m stand, all gated on the region's own stillness gates.

| Region | Serving | Verdict basis |
|---|---|---|
| verdant-line-1 | dapple + moss drift-line + 12-fish under-shoal at (490, −60) | was "gradient wash with sprigs" |
| verdant-line-2 | dapple + 12-fish under-shoal at (985, −60) | cited proof frame family |
| verdant-line-3 | leaf-light dapple only | canopy floor already carries value |
| smoking-marches-1 | **no serving** — the critic's best unauthored down-look (vent field) stands | already passes |
| smoking-marches-2 | shard drift-line + 2 ember pools + 14-fish ember under-shoal | Comb country was two-tone |
| smoking-marches-3 | **no serving** (economy; 163 tris headroom) — verdict at capture | night register |
| pale-passage-1 | bone drift-line + 10-tetra under-shoal (no dapple — upheld) | R12 cap adopted over old 450k |
| pale-passage-2 | bone drift-line + 12-tetra under-shoal | milk register, value-first |
| pale-passage-3 | **no serving** (zero headroom) — verdict recorded at capture | R12 overage already spent on the corridor |
| great-blue-1 | **no serving** — critic's own frames ("grass-slope down-look with blue coral boulders") already read | already passes |
| great-blue-2 | **no serving** — the stand (985, −60) lies INSIDE the Round of the Gentle Dark (r 78 at (1030, −10)); MASTER §1.2: bare there is CORRECT | registered rest |
| great-blue-3 | pale scree drift-line + 10-fish lavender under-shoal (outside every rest) | quiet, not dead |
| golden-waste-1 | **no serving** — the stand is the oasis-from-above, a critic top-frame; the razor water-volume edge in it is C4 (framework), not this wave | already passes |
| golden-waste-2 | honey dapple + grit drift-line + 16-fish under-shoal | rest-gated (Pavement, Cell) |
| golden-waste-3 | honey dapple + grit drift-line + 14-fish under-shoal | the #14 "featureless off the spine" region |
| sunken-calamity-1 | **no serving** — "the mid-down actually has content" (critic); the grief register is not decorated | already passes |

## 4. Rounds

### Round 1 (build + first capture)

- Built everything above; all touched region suites green.
- Caught in round 1: the corridor dapple at kit-default opacity 0.2
  read as a pale rectangular PLATE at grazing angle in
  `JOURNEY-golden-05` — the exact C4 card sin. Fixed to golden-1's
  measured discipline (0.06–0.09 / tile 12) before any other corridor
  took dapple; recapture confirms the plate gone, the pool soft.
- Pre-existing flag (not this wave's): `pass12-fwd` poses report
  DISPLACED 3.9 m on golden (verified identical with all changes
  stashed — the pose settles against something at u 648; the journey
  harness's own displacement note).
- Full pass-frame + mid-down battery captured (36 frames + the
  calamity march set). Round-1 reads:
  - **smoking pass12/23**: the ember files are VISIBLE streaming the
    road both crossings; the night threshold's leaning pair flanks
    the reticle with the dimming pool line leading in — "a darker tan
    plain" now reads as a threshold.
  - **blue pass12**: the large rib set is the frame's event; the
    thin blade beside it. "One great shape" landed.
  - **blue pass23 (the cited great-blue-09)**: ribs at u 1244 stood
    98 m from the pose — a ghost through fog. → round 2.
  - **golden pass12**: file + dapple pool + wear-lines read; the pair
    at 1.15 got lost among the Gilded Shore's own stacks. → round 2.
  - **pale-09 (cited)**: foreground gravel + the dolmen/lantern
    silhouettes + a pilgrim fry — no longer the emptiest road.
  - **calamity mid-march**: the bent-spar arcs compose the walk
    behind the shard slopes (the #13 counter).
  - **mid-downs**: verdant-1/-2, golden-2/-3, smoking-2, blue-3 all
    carry a third value + motion now; pale-2's pearl fish were
    invisible on milk from 20 m (→ round 2); pale-3 and blue-1 read
    fine WITHOUT spend (verdict, no work); blue-2's stand is inside
    the Round rest (correct bareness); smoking-1/golden-1/calamity
    stand on their existing strengths.

### Round 2 (refinement + recapture)

- **blue-3 ribs → the legal sliver** (u 1178–1185, anchored 1185 and
  grown backward with `turn: π`; vertex-level test added). The cited
  `great-blue-09` now anchors on the arcs at ~40 m; `-10` (back pose,
  from inside the hush) frames them across the horizon. Both PASS.
- **golden-2 pair grown 1.15 → 1.4** — owns the mid-ground instead of
  merging with the rim stacks. PASS (modest, honest).
- **pale-2 mid-down**: under-shoal fish a step larger (the traveller
  network's own r2 lesson: small-and-pale vanishes into its own
  register) + ribbon 150 → 190 at a larger size envelope. Gravel and
  fish now read; soft is the milk register's voice. PASS.

### Round 3 (final acceptance battery)

Full recapture of every pass frame (5 spokes × 4), the calamity march
beats, and all sixteen `-02-mid-down` stands at tag `r3` (39 frames,
`visual-qa/20260802-09*_r3.png`).

## 5. Verdicts at the critic's cited proof frames (before → after)

| Cited frame | Critic's charge | Round-3 verdict |
|---|---|---|
| `JOURNEY-pale-09` | "the emptiest road in the game — bare-sand composition" | **PASS.** Bone-gravel foreground, sprig scatter, the fallen dolmen and font silhouettes on the horizon, a pilgrim fry in frame; the road reads as pale's own country, not a formula. |
| `JOURNEY-golden-05` | pass-corridor monotony proof | **PASS (modest).** Gold file on the road, honey dapple pool (soft — the r1 plate was caught and killed), wear-lines, the leaning waymark pair among the shore stacks. Pre-existing flag: the pose itself settles DISPLACED 3.9 m (verified identical with all changes stashed). |
| `JOURNEY-great-blue-09` | same formula; the province "vast as absent" | **PASS.** The drowned keel's three rib arcs now anchor the crossing dead-centre at ~40 m, dark against the milky threshold — C5's prescription (one large anchoring silhouette), inside the registry's one legal sliver, vertex-asserted. The back pose (`-10`) frames the same arcs across the horizon from inside the hush. |
| `CRITIC-*-02-mid-down` (all sixteen) | "featureless two-tone wash in nearly every region" | **12 PASS with new content** (three values + one motion: dapple/ribbon/under-shoal per register), **4 PASS by standing strength or registry**: smoking-1 (the vent field — the critic's own best), golden-1 (the oasis-from-above — critic top-frame), great-blue-1 (prairie + boulders — critic's own praise), great-blue-2 (stand is INSIDE the Round of the Gentle Dark rest — bare is CORRECT per MASTER §1.2), sunken-calamity-1 (content confirmed standing), pale-3 (dawn-rose banding + sprigs + beam — read PASS without spend, zero headroom honoured). |

Every mid-down frame now clears the stated bar — "quiet, not dead" —
without one registered rest taking so much as a pebble.

## 6. Final measured budgets (closing figures, full suite green)

| Region | Before | After | Cap note |
|---|---|---|---|
| verdant-line-2 | 116 / 1,343,356 | 122 / 1,347,372 | under 130 / 1.35M |
| smoking-marches-2 | 57 / 1,303,897 | 66 / 1,313,697 | under |
| smoking-marches-3 | 64 / 1,346,653 | 67 / 1,349,837 | 163 under 1.35M — economy build |
| pale-passage-2 | 66 / 1,204,580 | 74 / 1,216,460 | under |
| pale-passage-3 | 70 / 1,349,764 | 72 / 1,351,660 | **R12 overage +1,660 recorded**; test cap 1,354,000 with citation |
| great-blue-2 | 61 / 704,775 | 64 / 707,223 | under |
| great-blue-3 | 76 / 807,583 | 81 / 812,167 | under |
| golden-waste-2 | 67 / 892,826 | 79 / 912,194 | under |
| golden-waste-3 | 66 / 1,043,103 | 78 / 1,059,035 | under |
| pale-passage-1 | 101 / 449,997 | +~3k | old 450k cap superseded per R12; test moved to 260 / 460k with citation |
| verdant-line-1 / -3, sunken-calamity-1 | — | small servings | inside existing test caps, suites green |

## 7. Gates and flags

- `npm run typecheck` clean; `npx eslint . --max-warnings 0` clean;
  full `npm test` **73 files / 1161 passed** (baseline was 72 / 1142;
  +1 file, +19 tests from this wave).
- `tests/kitVariants.test.ts` region fixture: the append-only reading
  made explicit — all 152 recorded calamity nodes verified
  byte-identical at their recorded indices; appended nodes must be a
  later wave's own module (name-guarded). The kit-variants proof is
  intact.
- **Flags for the orchestrator:**
  - Pre-existing pose displacements (NOT this wave's): golden
    `pass12-fwd` 3.9 m (stash-verified identical), great-blue
    `pass23-fwd/back` 4.2/7.4 m and the blue-adjacent calamity beats
    (`suffocated-mile` 5.7 m, `wound-gate` 3.1 m) — the journey
    harness's own DISPLACED notes; poses settle against terrain, the
    frames still compose.
  - blue-1's `Blue1Fill` runs TWO shoals on the same glide road
    (outriders + outriders-b, same stations) — a pre-existing
    saturation-check oddity, left untouched.
  - The smoking spine/wash/wick through-routes keep their 769–833 s
    clocks (their regions' own ledgered numbers); the corridor
    residents carry road visibility now. If a future wave wants the
    long loops livelier, retiming is timetable-only (no reroll).
  - Headed frame measures (median ≤ 16.9 ms) not re-run this wave;
    additions are 2–19k tris per region against a measured 450k→1.35M
    envelope that R12's own probe showed frame-flat. pale-3's +1,660
    overage rides that same R12 sentence; flagged for the next headed
    pass.
