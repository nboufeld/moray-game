# WAVE-CLOSE — the critic's wave, deferred verifications + the mood-level residual

Worker ledger, branch `fix/wave-close`, run against the fully merged
critic-wave tree (all six remediation branches in). Mandate: the headed
frame gates the wave deferred (roads-and-axes flag: "flagged for the
next headed pass"), the current-run doorway ghost pyramid
(wings-polish flag 1), calamity-08's two-tone horizon (hard-geometry
residual — the one visual iteration this close-out is licensed for),
and two cross-branch control frames.

Port discipline: `npx vite --port 5218 --strictPort`, curl-verified 200
before every capture; no other workers live (verified — no vite,
playwright or chromium processes, no 52xx listeners).

## 1. Headed frame gates — the post-wave world, eight probes

Method per FILL-DOCTRINE: `scripts/measure-frames.mjs`, `SHOT_HEADED=1`
(real GPU, window visible), 5 s samples, `SHOT_REGION` forced,
`SHOT_AT` from each region's ledgered probe poses (world coords read
live off the defs by `scripts/pose-coords.mjs`, the pale-3/journey-close
idiom). Gate: **median ≤ 16.9 ms at settled scale 1.00**.

| Region | Probe pose | Frames | Median | p95 | Scale | Verdict |
|---|---|---|---|---|---|---|
| smoking-marches-2 (98% tri cap) | anvil (court, densest) | 300 | 16.7 ms (59.9 fps) | 18.6 ms | 1.00 | **PASS** |
| smoking-marches-2 | emberwash-road | 300 | 16.7 ms | 18.6 ms | 1.00 | **PASS** |
| smoking-marches-3 (971-tri overage) | the-choir | 300 | 16.7 ms | 18.6 ms | 1.00 | **PASS** |
| smoking-marches-3 | close-cradle | 300 | 16.7 ms | 18.6 ms | 1.00 | **PASS** |
| golden-waste-3 (new spend since gate) | afterglow-garden | 300 | 16.7 ms | 18.6 ms | 1.00 | **PASS** |
| golden-waste-3 | caravan-road | 300 | 16.7 ms | 18.6 ms | 1.00 | **PASS** |
| pale-passage-3 (1,660 + ~4k overage) | daybreak | 300 | 16.7 ms | 18.6 ms | 1.00 | **PASS** |
| pale-passage-3 | blushfields | 300 | 16.7 ms | 18.6 ms | 1.00 | **PASS** |

**8/8 PASS — vsync-locked at 60 Hz, full render scale, at every
stacked-spend region's two heaviest ledgered views. No triangle refunds
required.** The R12 sentence the overages rode ("the binding gate is
the frame measure, not the cap") is now paid in full: smoking-3's
measured 1,350,971 tris and pale-3's 1,352,794 tris (suite prints this
run) hold the gate on the real GPU.

## 2. The current-run doorway ghost pyramid — CLOSED-BY-MERGE

wings-polish flag 1 said a wing cannot fix it: the pyramid is the
bowl's `DistantReef` pinnacle ring framed by the doorway notch.
hard-geometry (which branched later and merged after) landed the
camera-following ring parting (diagnosis 2 in its ledger: past
r ≈ 19 the sector ahead of the camera eases open in-shader).

Recaptured `DOOR-current-run` on the merged tree
(`scripts/tierb-wing-shots.mjs`, `WING_ONLY=current-run
POSE_ONLY=door`, the ledgered stand at r 25.5):
`visual-qa/20260802-0958_…_DOOR-current-run_waveclose-check.png` —
READ. **The pyramid is gone.** The water above the notch is a clean
turquoise grade; through the door the wing's own close reads
(recession planes, the water-light column, motes). No translucent
pane anywhere in frame. No code needed; the two branches' fixes
compose correctly on the integrated tree. **CLOSED-BY-MERGE.**

## 3. Calamity-08's two-tone horizon — fog/backdrop value harmony

The hard-geometry residual, verbatim: the straight value division at
the shelf horizon is the pale fogged shelf (ground at fog saturation)
meeting the backdrop painting's dark ash band on the flat world's
horizon line — a VALUE mismatch, not card geometry; curable only at
mood level. Fixed here in calamity's own register: `CALAMITY_1.mood`
in `src/world/regions/calamity1/Calamity1.ts` — nothing else touched.

Measured at `JOURNEY-calamity-08-sunken1-last-grove` (1600×900,
16-row strips just above/below the division at rows ~452–466;
`scripts/image-stats.mjs`):

| Round | mood values | above (r/g/b mean) | below (r/g/b mean) | green step | luma step |
|---|---|---|---|---|---|
| before | colorScale [0.66, 0.75, 0.82], fade 0.35 | 34.5 / 140.5 / 162.1 | 41.2 / 157.7 / 173.3 | **17.2** | 16.6 |
| r1 | [0.64, 0.72, 0.79], fade 0.28 | 35.6 / 143.1 / 164.1 | 40.5 / 155.5 / 171.6 | 12.4 | 10.4 |
| r2 | [0.61, 0.69, 0.755], fade 0.20 | 37.5 / 146.3 / 166.4 | 39.0 / 153.3 / 169.5 | 7.0 | 5.5 |
| r3 (shipped) | **[0.60, 0.64, 0.74], fade 0.20** | 35.8 / 141.2 / 164.8 | 38.7 / 147.8 / 169.0 | **6.6** | **5.6** |

The loop (every frame READ before the next order):

- **r1** — both sides moved toward each other (ash haze −4%, backdrop
  dim eased 0.35 → 0.28). Step narrowed but the line still read; the
  tone curve compresses backdrop lifts ~5:1, so fade alone cannot
  close it.
- **r2** — harder on both (fade 0.20). Step halved again — but the
  upper sky brightened past the register's comfort (top-band green
  179.7 → 194.7): the fade lever was starting to buy harmony by
  thinning the gloom.
- **r3** — rebalanced: fade held at 0.20, the fog's green taken down
  instead ([0.61, 0.69, 0.755] → [0.60, 0.64, 0.74]). The meeting
  point lands DARKER — the water goes a step deeper grey-cool, which
  is mourning's own direction, not a retreat from it. The residual
  ~6-part step spreads across the clip-dissolve fringe and reads as a
  soft water boundary, not a rule. **SHIPPED.**

Register verification (against the canonical `ca-filled` reads in the
sunken-calamity-1 ledger): the last grove's green kelp and green shaft
stand untouched against the cooler water — the green defiance is
intact and gains contrast from the deeper ash. `the-reveal` (07): rib
arcs across a soft graded horizon, urn husks, shard slopes — mournful
and huge, no new line, no stepped rectangles. `wound-gate` (06,
control): bent mast + pennants unchanged; whole-frame luma drift
+2.0% (118.6 → 121.0), 07 +3.1% — all of it the eased backdrop dim,
subjects' value bands (p01/p10/p50 floors) essentially unmoved. The
authored look survives; the water is a shade more sorrowful, not less.

Captures: `visual-qa/*_wc-before/-r1/-r2/-r3` (06/07/08 each round,
via `scripts/journey-shots.mjs calamity` with `SHOT_POSE_FILTER` —
the full chain still swims, so streaming state is honest).

## 4. Cross-branch control frames — the merged wave still reads

- **`JOURNEY-great-blue-07-great2-wall-face`** (`wc-control`):
  **PASS.** No razor teal band, no stepped rectangle corner — the Far
  Wall's blue-violet curtain masses at frame left, the far floor
  melting into the backdrop through the clip dissolve. Matches
  journey-close's ledgered verdict ("PASS — weak frame, mostly open
  water by design of the stand"). Harness note: the pose settled
  DISPLACED 7.6 m this run (the pre-existing journey-harness
  displacement family — roads-and-axes flags the same class on the
  adjacent blue/calamity beats; no geometry changed in this wave, and
  the frame composes at the ledgered read).
- **`JOURNEY-pale-09-pass23-fwd`** (`wc-control`): **PASS.**
  Bone-gravel and chalk-plate foreground, sprig scatter, font-tower
  silhouettes under the warm dawn band, pilgrim fry in frame — the
  roads-and-axes round-3 verdict holds on the integrated tree, and
  the hard-geometry ring fix holds with it (no floating slab ribbons,
  crest dissolved).

Cross-branch stacking regressed nothing at either cited frame.

## 5. Budgets

Zero geometry, zero draws, zero triangles: the one code change is
three numbers in calamity's mood table (fog colorScale, backdropFade).
No placement stream consumed — determinism suites green (the mood is
runtime colour arithmetic, outside every byte fixture).

## 6. Gates

Run unpiped at the final tree:

- `npm run typecheck` — clean.
- `npx eslint . --max-warnings 0` — clean.
- `npm test` — **73 files / 1161 tests, all green** (the
  roads-and-axes closing figure exactly; includes the calamity region
  suite, every reroll-fence sentinel, and the tierb budget asserts).

## 7. Flags for the orchestrator

- **The perf story is closed.** All four stacked-spend regions hold
  the headed gate at scale 1.00 on the merged tree; the recorded
  overages (smoking-3 +971, pale-3 +2,794 as measured this run) ride
  a PASSING measurement now, not a deferred one.
- The pre-existing journey-harness pose displacements persist on the
  merged tree (wound-gate 3.1 m, wall-face 7.6 m this run) — same
  class roads-and-axes flagged; frames compose, nothing new.
- calamity-08's horizon is harmonised to a ~6-part soft step under
  the dissolve fringe — value harmony, honestly reported, not
  invisibility: a flat shelf against a painting will always have a
  transition; it no longer reads as a two-tone division. If a future
  repaint of `backdrop.png` retunes the ash band, re-read this frame.
- The lumen-garden doorway's diagonal terrain-bake crease and the
  verdant-3 crown drapes (wings-polish flags 2–3) remain open — out
  of this close-out's scope, unchanged.
