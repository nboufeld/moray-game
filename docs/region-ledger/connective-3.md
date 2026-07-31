# Ledger — connective-3 (Phase 3, Batch 3)

The connective rework's third and final Tier A package, per MASTER §4
Batch 3: the **remaining Tier A wing uplift** — sandfall-dunes (the
Golden province's gateway) and ruins-terrace (the Calamity gateway) —
the **traveller-shoal network's wing legs** (connective plan §4/§5,
verdant first), and the **verdant pass polish** (§4.4 verification, R4).
Lane per MASTER R3: wings, gate-veils, traveller wing legs (bowl budget)
and the pass pattern — no region directory is touched.

Authority: FILL-DOCTRINE > MASTER (R2 ceilings, R3 ownership, R10/§1.2
registry, R12 quality-first) > connective-tissue.md. Kit pieces consumed
(all demo-proved in the kit ledgers, captures looked at):
`fallStreak` (the texture half — built for exactly this wing's falls),
`carpetField` (blade/tuft — R12 profiles), `driftDebris` (wrack; the
relic family, which restates THIS wing's drum radius and tile profile),
`groundLitter` (split stones, the `rake` knob), `particulateField`
(drift), `shoalRunner` (the §5 traveller system).

## Scope decisions, stated up front

- **Draw arithmetic** (connective-2's precedent): R2's ≤ +10 draws /
  ≤ 35k tris Tier A ceiling is the wing's WHOLE Phase 3 uplift —
  Batch 1's gate veil (+5 draws each) counts against it. Each wing here
  gets ≤ +5 draws of Batch 3 uplift. Measured numbers below.
- **The traveller legs are BOWL content** (the connective-2 finding,
  honoured): `shoalRunner`'s fish mesh needs `frustumCulled = false`,
  which R2 forbids inside a wing — so the five wing legs mount in
  `Reef` beside the wing flora, on the bowl budget, and are ledgered in
  the program arithmetic below. The golden route's REGION leg already
  ships in golden-waste-1 ("the loop leaves the doorway at u 52 — the
  wing's own leg is the connective worker's"); this package's wing leg
  meets it at the Honey Gate and does not double it — the wing leg
  turns at r 47.2, inside the sill.
- **The sandfall fall-mark repaint** is a repaint, not a re-roll (the
  open-blue curtain-ink precedent): the curtains keep their drawn
  placements, stream and draw count; only the streak bake moves off the
  vertex grid onto the kit `fallStreak` texture, with a slow scroll.
- **Seeds**: every wing piece rides `SEEDS.<wing> ^ <fresh constant>`
  (0x3d1a/0x3d2b/0x3d3c sandfall; 0x4e1a/0x4e2b/0x4e3c ruins) fed to
  kit-private Randoms, appended after every existing draw; the
  traveller legs ride `SEEDS.wingGates ^ 0x7a01–0x7a05` — the stream
  connective-1 registered for shared gate machinery and left unused, so
  the fence is structural. Proven with connective-1's own pre-veil pins
  (commit b53da4f values) in `tests/wingsConnective3.test.ts`.
- **The ruins wall relief carving** (connective §2's table) is def
  paint: a worked frieze band on the wedge wall slopes (~3.2 m motif,
  Nyquist-honest on the 0.94 m grid, one seeded fbm wander, value-only
  ±6%), gated off the floor, the gate ramp and the doorway slope, and
  scaled by the carve blend so the paint contract's identity holds.

## Test-collector amendments (stated, not hidden — the standing precedent)

- `tests/wingsW5Flora.test.ts` — `budgets()` now excludes the Phase 3
  uplift subtrees (`wing-gate-veil`, `wing-uplift-conn3`) so its 10-draw
  cap pins the ORIGINAL wave-8 flora; the uplift is measured against
  R2's own ceilings in the connective suites. Determinism and
  confinement still read every uplift vertex, instance and mote.
- `tests/wingsW4Flora.test.ts` needed no amendment (its collectors read
  top-level children only; the uplift is one nested Group — the
  connective-1 finding, still true).

## Budgets, measured (`[conn3-budget]`, vitest prints them each run)

| Wing | Whole uplift (veil incl.) | of which Batch 3 | R2 ceiling |
|---|---|---|---|
| sandfall-dunes | **+8 draws / +13,596 tris** | +3 / +11,980 | ≤ +10 / ≤ 35k |
| ruins-terrace | **+8 draws / +15,100 tris** | +3 / +13,484 | ≤ +10 / ≤ 35k |

Traveller wing legs (bowl budget, measured from the built runners):
**8 draws / ~19.0k tris resident** — 5 fish ribbons (verdant 56,
golden 44, pale 44, smoking 40, calamity 16 × 104-tri fish) + 3 glint
threads (verdant/golden/pale; the smoking embers and the calamity
grey file carry none by design).

**Program envelope arithmetic**: connective-1 (+31 / +10.3k) +
connective-2 (+15 / +68.9k) + this package's wings (+6 / +25.5k) +
the traveller legs (+8 / +19.0k) = **+60 draws / +123.7k tris
resident** against the ≤ +120 / ≤ 380k whole-program envelope. No
`frustumCulled = false` inside any wing (the runners are bowl
content), no castShadow, no new contacts, every wing-uplift sphere
past r = 27 inside its cone (the connective-3 frustum-guard suite
holds it on every run).

## The traveller network (connective §5, MASTER §1.2 world row)

One route per province — bowl rim ↔ gateway wing ↔ doorway turn at
r 47.2 — on seeded timetables drawn per-route (3–5 min; the calamity
file ~5–5¾, fewer and slower by design). Species per MASTER §1.1's
shoal-light row: verdant silver-green, golden gold (the Hourglass
traveller's own species, meeting its region leg at the Honey Gate),
pale pearl-white with a faint floor, smoking ember-dark with warm
bellies, calamity a sparse grey file. The §5 saturation check is THIS
lane's: `tests/travellerShoals.test.ts` samples every route curve at
512 points and asserts the shell bound (r ≤ 49.4 with braid margin)
plus > 60 m of clearance against every registry rest with documented
coordinates (narrows, shelf pocket, cistern, basin pocket, ash
meadows, ravine hush, gardener, suffocated mile, grove lawn, shrine,
mid-glide, drain's eye, empty quarter); every remaining rest lives
deeper inside its region than those anchors, so the shell bound covers
it a fortiori. Time-determinism (the split-timetable contract) and
pairwise-distinct periods are asserted in the same suite.

## Critique rounds

Captures per round: `visual-qa/*_conn3-r{n}.png` on port 5205
(`npx vite --port 5205 --strictPort`, server verified before every
run). Before set: the connective-1 finals
(`rw-connective1/visual-qa/*_conn1-final.png`, sandfall + ruins) — the
same canonical poses, captured at Batch 1's close.

### r1 (first uplift, looked at)

- **sandfall-dunes (interior)** — the duneling bed LANDS: golden wire
  blades scatter the doorway half of the floor, thin near the wing's
  quiet heart, thickening toward the door; wrack curls anchor the bed's
  feet; gold motes drift the doorway water; the think-lane stays a
  clean bare swim lane. Three layers read: bed foreground, stones +
  falls middle, veil + door distance. THE FALLS still carry a blocky
  bright read at pose range — softer than the wave-8 bake (the
  texture's streak columns show on both falls) but hard-edged bright
  chunks persist. Suspect shifted to the falling-streak INSTANCES
  (36 crossed quads per fall at 0.5 opacity ADD over an already-bright
  curtain saturates to white blobs) — r2 takes a close-fall diagnostic
  pose and retunes the streak quads (narrower, dimmer), not the veil.
- **sandfall-dunes (door)** — the golden handshake in one frame: bed
  blades to the sill, gold motes against the veil's honey column, and
  TWO RUST PILLARS past the door that a raycast probe (the verdant-2
  live-probe method; throwaway script, deleted) identified as
  `hourglass-rock` at t 16.8 — the Hourglass Sea's own saddle boulders
  seen THROUGH the open doorway: the depth-1 build margin attaches the
  region the moment the camera stands in the wing. Region-owned
  content, region-owned palette (its ledger's own boulder-warming
  arc); the door is a doorway now, not a poster.
- **ruins-terrace (interior)** — the calamity traveller's grey file
  crosses the frame mid-water between the arches: life as wayfinding,
  in the first frame that could show it. Moss tufts read on the right
  bank; the litter field reads faintly at the flanks; the corridor and
  meadow stay open (their laws are asserted against the uplift every
  test run). The frieze does not read at this range — r2 judges it at
  the door pose before touching amplitude.
- **ruins-terrace (door)** — POSE FAIL, mine: the camera stands
  against the half-buried round doorway (the torus fills the right
  third) and a fallen slab crowds the bottom. The veil's cold column
  and grey-violet inks DO read through the gap. r2 moves the camera to
  the west flank (lateral −2.4, r 40.5) so the door, the raked litter
  field and a relic or two share the frame.

### r1 routes (ten poses, all looked at)

- **golden** — the network's thesis frames: `ROUTE-golden-bowl` catches
  the gold fusilier ribbon threading the gate notch with glint riding
  it (follow the fish, find the province); `ROUTE-golden-wing` streams
  the file through the wing over the duneling bed with the falls
  flanking. BOTH PASS — and the wing frame convicts the falls again:
  at 8 m the left fall is stacked saturated blocks. The blockiness is
  the REGISTER, not the texture: a near-white curtain at 0.55 peak
  alpha over a bright backdrop saturates wherever the texture's clumps
  peak, and the 0.5-opacity streak quads ADD on top. r2 lowers the
  whole register (peak alpha 0.45, lift eased, streaks 0.42 and
  narrower, five defined streams instead of six soft ones).
- **smoking-bowl** — the ember file crosses the gate notch, dark bodies
  warm-bellied against the water. PASS. **smoking-wing** — pose fail,
  mine: the east stand sat among the chimneys and the dark file is
  unreadable against the charcoal bank; r2 stands on the west flank
  looking down the corridor.
- **pale-bowl** — the pearl file reads mid-frame between the bowl's
  seaweed and the ghost-reef gate. PASS (small at this range). 
  **pale-wing** — pose fail, mine: the pearl arch boulder eats the
  right half; r2 moves west and aims down the corridor.
- **verdant-bowl** — no fish in frame (camera 13 m behind the loop,
  fish sub-pixel at that range even when present) — POSE FAIL;
  **verdant-wing** — the silver-green file IS present by the gate but
  small and half-hidden by a nave column the camera stands against.
  r2: stand beside the rim loop (r 24.5, high, holding loop + sill in
  one frame — the golden r5 lesson) and on the west nave flank; the
  verdant fish also take a step of scale (0.82 → 0.88) and a lighter
  green — silver-green at 0.82 vanished into the bowl's own greens.
- **calamity-bowl / calamity-wing** — the grey file missed both frames
  (16 fish over a ~5½-minute loop occupy a tenth of it; both r1 poses
  held less than half the loop). The `calamity-wing` frame is
  otherwise the ruins uplift's best argument: the fallen-block field
  reads BLAST-RAKED down-terrace, relics and moss tufts between, the
  hero arch framing the gate veil. r2 raises both route cameras to
  hold the loop's majority and retakes until the file is caught (the
  timetable is wall-clock at capture; the pose must not need luck).

**A process fault, owned**: the r2 source edits were begun while the
r1 route run was still capturing on the same tree (the golden ledger's
shared-tree hazard, re-learned). The last three r1 frames were
captured after Vite reloaded the changed modules — smoking-wing and
both calamity frames therefore show r2 code (ruins litter at 500, the
falls register change); their reads above are judged accordingly. No
further edits during capture runs.

### r2 orders (landed before the r2 captures)

1. Falls register: curtain peak alpha 0.62→0.5 (cap 0.45), lift eased,
   texture 5 columns @ 0.55 softness, streak quads 0.07–0.16 m at 0.42
   opacity (the W5 becalmed pin keeps > 0.4).
2. Ruins litter 420 → 500 (faint at pose range); measured +16,700 tris
   whole-uplift, still ≤ 35k.
3. Verdant fish 0.88 scale, lighter green.
4. Route/door poses per the reads above.

### r2 (looked at — four wing poses, ten route poses, two pass poses)

- **sandfall-dunes (interior)** — the register fix mostly lands: both
  falls carry visible streak columns, and the GOLD TRAVELLER FILE
  descends the corridor mid-frame with its glint thread — bed, falls,
  motes, veil and commute in one look. Three-layer: PASS. One blocky
  remnant survives where the r-42 curtain tops out against the dune
  lip beside the pale stones. → r3: the lip dissolves earlier (top
  fade 0.88 → 0.78, cap 0.42).
- **sandfall-dunes (door)** — SHIPS: the file pours toward the bowl on
  the left, the bed thickens to the sill, gold motes ride against the
  veil's honey column, and the Hourglass country's own boulders stand
  past the door. The golden handshake reads as one gradient.
- **ruins-terrace (interior)** — SHIPS: the calamity grey file crosses
  upper-right between the arches (its violet-grey leans mauve under
  the gold-green water — accepted: the register rule constrains LIGHT
  families, and the file carries no glow), litter and moss carry both
  flanks, corridor and meadow stay open, the veil parting holds the
  distance.
- **ruins-terrace (door)** — the west-flank stand reads the raked
  litter up the left bank with the standing column as repoussoir and
  the veil's cold recession in the doorway; the near-right quadrant is
  the meadow/corridor's lawful bareness. → r3: one more metre west so
  litter owns the near field. Observation, region-owned: with
  sunken-calamity-1 attached (the depth-1 build margin), the doorway's
  horizon shows the march country's own skyline behind the veil — the
  door is a place now, not a poster.
- **routes** — golden both PASS (the wing frame now shows the falls as
  soft columns — the register verdict in the same frame); smoking both
  PASS (the bowl frame catches the ember file banking over the gate
  chimney, warm bellies flashing); verdant both PASS after the fish
  step (bowl: the file threads the saddle; wing: the file streams the
  nave, though the camera stands against a column — r3 moves route
  wing-cameras INTO the swim corridors, the one lane every wing law
  keeps open); pale-bowl PASS, pale-wing MISS (arch country, no file
  this phase); calamity MISS at both (three consecutive phase misses
  on a tenth-of-loop file). → r3: corridor-centre wing poses + bowl
  poses raised over the sill (majority-of-loop coverage both ends),
  retakes until the sparse files are caught.

### r3 orders (landed before the r3 captures)

1. Curtain lip: top fade 0.88 → 0.78, cap 0.45 → 0.42 — the last blocky
   remnant lived where the r-42 curtain met the dune lip at full alpha.
2. Route wing poses move INTO the swim corridors (r 44.2, lateral −1.2,
   looking back at the gate); bowl poses raised to y 6 over the sill.
3. Ruins door pose a metre further west (tried and REVERTED — see r3).

### r3 (looked at — four wing poses, ten route poses)

- **sandfall-dunes (interior)** — the falls repaint is DONE: soft
  streaked veils, clean vertical columns on the left fall, a softer
  cluster on the right, no blocky remnant at the lip. Three-layer holds
  with the gold file crossing. Final verdict on item 1's fall-marks.
- **sandfall-dunes (door)** — consistent with r2's SHIP; no regression
  from the curtain change.
- **ruins-terrace (interior)** — SHIPS as at r2: raked litter and moss
  on both flanks, the grey file crossing mid-frame, doorway haze open.
- **ruins-terrace (door)** — the r3 metre-west stand puts the colonnade
  drum in the lens (a third of the frame). REVERTED in the script: the
  r2 west-flank stand is the canonical door pose and its r2 frame is
  the record.
- **routes** — verdant both PASS (the wing frame is the set's best:
  near fish left, the file mid-lane, far fish against the doorway
  blue); golden both PASS (file over the saddle; file at the doorway
  notch over the mote field); pale both PASS (bowl: the file crosses
  the gate by the mossy arch; wing: the pale file threads the grass
  corridor); smoking-bowl PASS (two silver files over the smoker),
  smoking-wing FAIL — the stand is buried: vent-springs' corridor
  floor is the deepest of the five (−7.3 m under a +1.1 m gate sill,
  probed), and a camera 2.7 m off THAT floor reads the r38–42 rise as
  an eight-metre wall; calamity-bowl MARGINAL (a few grey fish on the
  crest — countable, not alive), calamity-wing FAIL (corridor open and
  lawful, zero fish — the fourth phase miss on the 16-fish file).

### r4 orders (the phase lottery ends)

The root cause, named: the traveller clock is wall time off page boot,
and on this box (load avg ~25, boots measured past 300 s) boot variance
EXCEEDS every route period — no pose short of framing the whole loop
can guarantee a file, and calamity's file spans a tenth of its loop.
Three misses were not bad poses; they were a lottery.

1. **QA door**: `Game.pinTravellerPhase(routeId, phase)` → `Reef` →
   `TravellerShoals.pinPhase` — pins the shared traveller clock so the
   named route sits at `phase`; everything downstream is a closed form
   of the pinned time (the kit's own determinism law), so the pin is
   exact, and the pin+capture share one `page.evaluate` so the only
   drift is the pose's settle (6 s ≈ 2% of a period). Asserted in
   `travellerShoals.test.ts`: pinPhase ≡ update-walking to the same
   simulated second, byte-equal matrices.
2. Every route pose pins: bowl at phase 0.16 (head just past the gate
   notch, file trailing the rim loop), wing at 0.36 (head mid-corridor
   on the out shoulder, trailing toward the gate — in frame for every
   span from calamity's 0.10 to verdant's 0.224).
3. smoking-wing stand raised −4.6 → −1.6, pitch −0.12 (the probe row).
4. r4 recaptures the full route set under pins — the passing r3 frames
   were unpinned luck; the pinned set is the record.

### r4 (looked at — ten route poses, pinned)

_(pending capture)_

## The verdant pass (MASTER R4 / connective §4.4) — VERIFIED

Both regions forced and attached together, both sides captured and
looked at (`PASS-*_conn3-r2.png`):

- **From the Great Kelp Sea** (verdant-1 `falling-edge`): the corridor
  opens between the pass jambs, the horizon dips through the ring line
  as soft milky hills, no opaque curtain — verdant-1's rework cut
  (`PASS_GAP_HALF = 0.2`, rings AND trunk cards) reads on screen
  exactly as its test asserts it.
- **From the Emerald Terraces** (verdant-2 `pass-threshold`): the
  milky→celadon carpet road runs to the sentinel through turf islands
  and waymark stones; the distance stays open down the corridor —
  verdant-2's own ring gap (`Verdant2Distance` far-pole gap) and its
  "pass channel swimmable u 636–810" / threshold-runner contracts hold
  it from this side.
- **The §4.4 pattern, item by item**: (1) threshold reveal — authored
  poses on both rims; (2) palette lerp — the milky-crest → celadon
  carpet handover at u < 700–740, region-owned and shipped; (3) life
  handover — verdant-2's threshold runner commutes the pass road
  (u 645–760, both directions), asserted in its region suite;
  (4) distance rings gated over the corridor on BOTH sides, asserted
  in both region suites and now verified visually from both sides;
  (5) double-rowed seals + 20–40 m rhythm — region-owned, shipped with
  the two reworks. Nothing remains assigned to connective on this
  pass; the pattern stands written in connective-tissue.md §4 for the
  reserved golden/smoking/pale passes.
