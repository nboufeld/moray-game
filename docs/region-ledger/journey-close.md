# journey-close — the program close's verification pair

Batch 4 journey-close worker ledger. Branch `program/journey-close`.
Two jobs, nothing else: the full-journey capture sweep (all six spokes,
streamer running naturally — the transitions ARE the test) and the
headed performance pass at the world's stress points. This was not a
fill pass; every region met its own bar. Only genuine seam/transition
defects were fixed, all by the established R0.x cut idiom.

## Method

`scripts/journey-shots.mjs` (new, modelled on `region-shots.mjs`)
walks one spoke per launch as a SINGLE browser session: bowl → gateway
wing hall → wing door → approach vale → depth-1 heart → 1→2 pass
(both directions) → depth-2 heart → 2→3 pass (both directions) →
depth-3 heart → terminus horizon. 14 poses per province spoke, 10 for
the Calamity spur — 80 frames per sweep. Nothing is forced: the diver
teleports pose to pose inside the running game, `collision.resolve`
and `streamer.update` run every frame, and each pose's frame is taken
only after `waitForAssets` plus a re-settle, so the captures show what
a swimmer actually meets — attach margins, corridor colliders, ring
gaps, veils, mood handoff. The script logs the attached regions and
warns when the resolved dive position is displaced from the request
(that is collision telling on itself; every displacement was chased).

Poses are either references to authored `capturePoses` (resolved
in-page from `__reefRegions`) or custom spoke-coordinate stands
(`u`/`v` along the azimuth, height from `terrainTarget` + lift, with
the gateway-wing floors hardcoded from the wing defs since wings are
not exposed at runtime).

Sweep tags in `visual-qa/`:

- `jc-r1` — the first full sweep, all six spokes (2026-08-02).
- `jc-r2-ringcut` — proof sets after the three ring cuts (golden
  pass12 pair + golden1 authored set; calamity full chain; pale1 and
  great-blue-1 authored sets — the two regions whose rings were cut).
- `jc-r2-veil` — proof set after the pale2 Dayspring veil edge fix.
- `jc-perf` — the filtered mid-pass stands recaptured to print the
  exact `SHOT_AT` coordinates (and live-region lists) the headed perf
  probes were pointed at.

## Per-spoke journey verdicts

Verdict column: PASS = the crossing reads per the MASTER §1.1 gradient
row (mood hands off without a band, corridor open, promise → arrival
lands). One line per pose; crossings judged from both directions.

### Verdant (azimuth 1.35): bowl → Kelp Cathedral → Verdant Line 1→2→3

| # | pose | verdict |
|---|------|---------|
| 00 | bowl | PASS — bowl reads as home; kelp raft overhead |
| 01 | wing-hall | PASS — cathedral naves, god-beams |
| 02 | wing-door | PASS — door parts onto green light |
| 03 | vale-reveal | PASS — vale opens, no band at the wing seam |
| 04 | sunwell (heart 1) | PASS |
| 05 | pass12-fwd | PASS — corridor open, deeper green promised |
| 06 | pass12-back | PASS — home country reads back through the cut |
| 07 | pass-threshold (arrival 2) | PASS — arrival matches the promise |
| 08 | cistern (heart 2) | PASS |
| 09 | pass23-fwd | PASS |
| 10 | pass23-back | PASS |
| 11 | pass-threshold (arrival 3) | PASS |
| 12 | twin-court (heart 3) | PASS |
| 13 | provinces-end (terminus) | PASS — the horizon story lands |

### Smoking (azimuth 2.79): bowl → Vent Springs → Smoking Marches 1→2→3

| # | pose | verdict |
|---|------|---------|
| 00 | bowl | PASS |
| 01 | wing-hall | PASS |
| 02 | wing-door | PASS |
| 03 | gorge-lip | PASS |
| 04 | caldera-rim (heart 1) | PASS |
| 05 | pass12-fwd | PASS |
| 06 | pass12-back | PASS — note: smoking-2's authored Comb slab fills the right of frame; stark flat-toned up close but the corridor swim-line is open. Pose-framing, not a seam. |
| 07 | saddle-crest (arrival 2) | PASS |
| 08 | anvil (heart 2) | PASS |
| 09 | pass23-fwd | PASS |
| 10 | pass23-back | PASS |
| 11 | night-threshold (arrival 3) | PASS |
| 12 | the-choir (heart 3) | PASS |
| 13 | ember-dawn (terminus) | PASS |

### Pale (azimuth 3.87): bowl → Ghost Reef → Pale Passage 1→2→3

| # | pose | verdict |
|---|------|---------|
| 00 | bowl | PASS |
| 01 | wing-hall | PASS |
| 02 | wing-door | PASS |
| 03 | lip-reveal | PASS (small collision displacement in the tongue overlap — informational, frame composes) |
| 04 | mother-crown (heart 1) | PASS |
| 05 | pass12-fwd | PASS |
| 06 | pass12-back | PASS |
| 07 | pass-threshold (arrival 2) | PASS |
| 08 | lantern-gardens (heart 2) | PASS |
| 09 | pass23-fwd | **DEFECT → FIXED** (D4, pale-2's Dayspring veil drew its own rectangle — see below) |
| 10 | pass23-back | PASS |
| 11 | pass-threshold (arrival 3) | **DEFECT → FIXED** (same D4 pane, seen from the far side) |
| 12 | daybreak (heart 3) | PASS — bone-pillar silhouette band is pale-3's authored painted horizon |
| 13 | suns-doorstep (terminus) | PASS — the sun dome arrives; the province's dawn story lands |

### Great Blue (azimuth 5.31): bowl → Open Blue → Great Blue 1→2→3

| # | pose | verdict |
|---|------|---------|
| 00 | bowl | PASS |
| 01 | wing-hall | PASS (camera clamps above the still-descending wing floor — displacement is the collision system working, frame composes) |
| 02 | wing-door | PASS — the opaque cobalt pane IS the door: connective-1's Open-Blue "through the painting" repaint (OpenBlueFlora CURTAIN_INK), intentional; the look-back from the vale confirms it never blocks the road |
| 03 | slope-reveal | PASS (flag F2: a faint hard-edged card face sits at the right frame edge; present identically in blue-1's forced lone-region captures, so it is blue-1 interior content, not a streaming seam) |
| 04 | gnomon (heart 1) | PASS |
| 05 | pass12-fwd | PASS |
| 06 | pass12-back | PASS |
| 07 | wall-face (arrival 2) | PASS (weak frame — mostly open water by design of the stand) |
| 08 | mooring (heart 2) | PASS — arch + columns + violet prairie, strong frame |
| 09 | pass23-fwd | PASS |
| 10 | pass23-back | PASS |
| 11 | wall-crossing (arrival 3) | PASS — the Worldwall notch silhouette is the authored step |
| 12 | daybreak (heart 3) | PASS — hull overhead, strong frame |
| 13 | morning-horizon (terminus) | PASS — the Morning Bank mounds land the "brightest deep" inversion |

### Golden (azimuth 6.39): bowl → Sandfall Dunes → Golden Waste 1→2→3

| # | pose | verdict |
|---|------|---------|
| 00 | bowl | PASS |
| 01 | wing-hall | PASS — sandfall glints |
| 02 | wing-door | PASS — rust sentinels frame the doorway |
| 03 | saddle-reveal | PASS |
| 04 | oasis (heart 1) | PASS |
| 05 | pass12-fwd | PASS |
| 06 | pass12-back | **DEFECT → FIXED** (D1: golden-1's rings had no outbound gap; the look-back was an amber wall — see below) |
| 07 | shore-road (arrival 2) | PASS |
| 08 | noon-bell (heart 2) | PASS — strong frame |
| 09 | pass23-fwd | PASS |
| 10 | pass23-back | PASS |
| 11 | last-shelf (arrival 3) | PASS |
| 12 | afterglow-garden (heart 3) | PASS |
| 13 | evening-horizon (terminus) | PASS — the setting ember lands the afterglow story |

### Calamity spur (azimuth 4.59): bowl → wing → the Sunken March

| # | pose | verdict |
|---|------|---------|
| 00 | bowl | PASS |
| 01 | wing-hall | PASS |
| 02 | wing-door | PASS |
| 03 | sorrow-gate | PASS |
| 04 | mid-march | PASS |
| 05 | suffocated-mile | **DEFECT → FIXED** (D2+D3: pale-1's and great-blue-1's painted rings stood in the march as a flat cyan wall — see below) |
| 06 | wound-gate | PASS after fix (was displaced/blocked by the same rings) |
| 07 | the-reveal | PASS — rib arcs land |
| 08 | last-grove | PASS (the notched horizon band is the march's own authored painted distance — identical before and after the ring cuts) |
| 09 | quiet-rim | PASS |

## Seam defects found and fixed

All four are the same species: painted-distance geometry standing in a
corridor that per-region QA never saw, because per-region QA forces a
lone region and the journey attaches neighbours naturally.

### D1 — golden-1's rings never parted over the outbound pass (MASTER R4)

`golden1/GoldenDistance.ts` had one gap (over the saddle approach) and
none at the outbound azimuth, so `pass12-back` read as a solid amber
dune wall. Added `GAP_OUT_HALF = 0.15` at the outbound azimuth with
its own taper, the exact R4 idiom the other five provinces already
carry (verdant `PASS_GAP_HALF`, pale/smoking `GAP_OUT_HALF`).
**Proof:** `jc-r2-ringcut` golden pass12 pair — the dunes part at the
corridor and golden-1 reads back through the cut; `gilded-shore`
(golden-1's own authored pose toward that azimuth) still composes.

### D2 — pale-1's rings ran tangent along the Calamity march (new cut R0.10)

The spur's march line passes 293 m from pale-1's centre; pale-1's
outermost reef arcs sit at ≤ 286 m — so once `sunken-calamity-1` and
`pale-passage-1` attach together (BUILD_MARGIN 130 makes them
co-resident along the whole march), the arcs stood ALONG the swim-line
as opaque `fog:false` sheets: the flat cyan wall in `calamity-05`.
Cut in `pale1/PaleDistance.ts`: a world-space lateral clearance off
the spur's line (`SPUR_CLEAR 40`, taper 30, `spurEase` folded into the
ring taper) and the same clearance parks the silhouette cards
(post-filter, so the deterministic card stream is untouched).

### D3 — great-blue-1's rings, same tangency, same march (R0.10)

Identical geometry problem from the other side (outermost prairie
radius 288 m vs 293 m to the march line). Same cut in
`blue1/Blue1Distance.ts`: `overSpur` corridor test in the ring
builders, and monolith cards over the corridor collapse with the
existing void-gap ones.
**Proof of D2+D3:** `jc-r2-ringcut` calamity full chain — the march
reads open at 05/06, the wound-gate composes, and the reveal/last-grove
frames are unchanged; pale-1's and great-blue-1's own authored sets
(`jc-r2-ringcut`) show no wound to either region's interior look.

### D4 — pale-2's Dayspring veil drew its own rectangle (R0.7 finish)

The veil's additive pane is meant to dissolve at its rims (black =
gone), but the gaussians left 15–37 % of peak brightness at the edges,
so from the pass stands (~90 m, outside the near-fade) the pane read
as a hard-cornered floating curtain in `pale-09` and `pale-11`. Fix in
`pale2/Pale2Distance.ts`: an edge window (`smoothstep` off every rim)
multiplied into the falloff — true zero at the rims, the heart of the
glow untouched.
**Proof:** `jc-r2-veil` pale pass23/threshold set.

## Flags for the orchestrator (not seam defects; not fixed here)

- **F1 — smoking-2's Comb up close** (`smoking-06 pass12-back`): the
  authored slab is stark flat-toned when the look-back pose puts it at
  the right of frame. Interior content, corridor open. Cosmetic at
  most.
- **F2 — blue-1 distance-card face** (`great-blue-03/04`): a faint
  hard-edged card face at the right frame edge, identical in forced
  lone-region captures — blue-1 interior, pre-existing.
- **F3 — calamity horizon notches** (`calamity-08 last-grove`): the
  painted horizon band behind the grove carries two rectangular
  notches. Present in jc-r1 before any cut and unchanged after —
  sunken-calamity-1 authored content.
- **F4 — displacement notes**: wing-hall stands clamp above
  still-descending wing floors (blue especially); `pale-03` displaces
  ~ a body-length inside the tongue overlap. Both are the collision
  field behaving correctly; logged so nobody mistakes the warnings for
  streaming bugs.

## Headed performance pass

Method: `scripts/measure-frames.mjs`, `SHOT_HEADED=1` (real GPU, window
visible), 5 s sample per probe; gate ≤ 16.9 ms median at settled scale
1.00 per FILL-DOCTRINE/R12. Probes: every province's densest documented
stand (coordinates via `scripts/pose-coords.mjs` from the authored
poses) PLUS every mid-pass crossing stand from the journey chains —
the co-attached worst cases the per-region gates never measured. For
each crossing probe the nearer region was forced and the neighbour(s)
attached through the streamer before sampling; the journey logs name
who was live (pale-pass12 and blue-pass12 are TRIPLE attaches — the
Calamity spur is co-resident with both of its neighbours there).

**All 22 probes pass the gate.** Median is vsync-locked 16.7 ms
(59.9 fps) at settled scale 1.00 at every stand; the whole world
never drops off the display rate, not even with three regions live.

| probe | attached regions | median | p95 | scale |
|-------|------------------|--------|-----|-------|
| fern-vault (verdant-2) | v1+v2 | 16.7 ms | 17.8 ms | 1.00 |
| anvil (smoking-2) | s1+s2 | 16.7 ms | 18.0 ms | 1.00 |
| the-choir (smoking-3) | s2+s3 | 16.7 ms | 18.0 ms | 1.00 |
| close-cradle (smoking-3) | s2+s3 | 16.7 ms | 18.1 ms | 1.00 |
| lantern-gardens (pale-2) | calamity+p2 | 16.7 ms | 18.1 ms | 1.00 |
| daybreak (pale-3) | p2+p3 | 16.7 ms | 17.7 ms | 1.00 |
| blushfields (pale-3) | p2+p3 | 16.7 ms | 18.2 ms | 1.00 |
| mooring (great-blue-2) | b1+b2 | 16.7 ms | 17.7 ms | 1.00 |
| weir-ford (great-blue-2) | b1+b2 | 16.7 ms | 17.9 ms | 1.00 |
| oasis (golden-1) | g1+g2 | 16.7 ms | 18.2 ms | 1.00 |
| afterglow-garden (golden-3) | g2+g3 | 16.7 ms | 18.7 ms | 1.00 |
| verdant pass 1→2 mid-stand | v1+v2 | 16.7 ms | 18.7 ms | 1.00 |
| verdant pass 2→3 mid-stand | v2+v3 | 16.7 ms | 18.7 ms | 1.00 |
| smoking pass 1→2 mid-stand | s1+s2 | 16.7 ms | 18.7 ms | 1.00 |
| smoking pass 2→3 mid-stand | s2+s3 | 16.7 ms | 18.6 ms | 1.00 |
| pale pass 1→2 mid-stand | **p1+calamity+p2** | 16.7 ms | 18.6 ms | 1.00 |
| pale pass 2→3 mid-stand | p2+p3 | 16.7 ms | 18.7 ms | 1.00 |
| blue pass 1→2 mid-stand | **calamity+b1+b2** | 16.7 ms | 18.6 ms | 1.00 |
| blue pass 2→3 mid-stand | b2+b3 | 16.7 ms | 18.6 ms | 1.00 |
| golden pass 1→2 mid-stand | g1+g2 | 16.7 ms | 18.6 ms | 1.00 |
| golden pass 2→3 mid-stand | g2+g3 | 16.7 ms | 18.6 ms | 1.00 |
| calamity suffocated-mile | calamity+p1+b1 | 16.7 ms | 18.7 ms | 1.00 |

No streaming-margin change was needed: `BUILD_MARGIN 130` /
`HYSTERESIS 65` hold the gate even at the triple attaches, so
`RegionStreamer.ts` ships untouched.
