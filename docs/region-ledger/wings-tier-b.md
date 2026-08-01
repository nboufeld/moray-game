# Ledger — wings-tier-b (Phase 3, Batch 4 "closure")

The fill program's Tier B side-room uplift, per MASTER §4 Batch 4 and the
connective plan §2's Tier B row: every non-gateway wing gets **one T1
ground statement** (a kit carpet/litter in the wing's own voice), **wall
paint** where its walls were bare (the `WingDef.paint` device), and a
**gate veil** where its doorway lacked one (KIT-SPEC §3.7's `gateVeil`,
inks sourced from the wing behind the door — a side room's doorway is
its rim gate, and from the bowl it should promise the room the way a
gateway's promises its province). Plus the two standing flags (sargassum
horizon band, kraken GLB spot-check) and the R1 REGIONS.md text update.

Lane per MASTER R3: wing directories and gate-veils only — no region
directory, no kit file is touched. Authority: FILL-DOCTRINE > MASTER
(R2 Tier B ceilings, R12 quality-first, §1.2 registry) >
connective-tissue.md §2.

## Scope decisions, stated up front

- **The ten wings.** `GATEWAY_WING_IDS` (RegionSlots) holds five wings:
  kelp-cathedral, vent-springs, ghost-reef, open-blue, sandfall-dunes.
  Everything else in the registry is Tier B — the nine side rooms
  (nursery-shallows, lumen-garden, wreck-meadow, moonlit-lagoon,
  glass-cove, current-run, mangrove-roots, ice-grotto, sargassum-sky)
  **plus ruins-terrace**, which is not in the gateway set (its region,
  sunken-calamity-1, is the sixteenth slot outside the five spokes) but
  was already uplifted AS a gateway by connective-1/-3: veil (+5),
  fallen-block litter T1, moss + frieze wall paint, all measured under
  R2's Tier A ceiling (+8 draws / +15.1k, conn3 ledger). Re-uplifting it
  under Tier B rules would double work already shipped, so ruins-terrace
  contributes **+0** to this batch and its numbers stay in the
  connective ledgers. Nine wings get new work.
- **The doorway veils.** Tier B veils mount at the GATE (doorR ≈ 31–32)
  through the standing `GateVeilMount`, facing the bowl, planes receding
  INTO the room — same machinery, same `^ 0x9a7e` salt on each wing's
  own stream (fresh for these nine wings; grep-proved). Where a resident
  owns a mid-wing volume the veil is sized around it BY CONSTRUCTION,
  not by test exemption: the moonlit gauze is two planes whose every
  vertex stays radially short of the koi circle (r < 36); the sargassum
  veil is hung narrow (w 1.6) so every plane stands before the turtle's
  r 38; the lumen veil (w 2.0 at doorR 31) stops short of the jelly's
  heart (r < 39). Asserted in `tests/wingsTierB.test.ts`.
- **Draw arithmetic.** R2 Tier B ceiling ≤ +6 draws / ≤ 20k tris per
  wing. A full veil is 5 draws (3 planes + column + motes) leaving 1
  for the T1 — so wings whose T1 wants a second draw trade a veil part
  for it: glass-cove drops the column (its water is the game's
  brightest; the glints are the light) for the grit's second pastel
  family; wreck-meadow drops the motes for the drift's bone family (r2).
  lumen-garden's veil is planes-only (the dark register earns its
  darkness) — 4 draws total.
- **Wall paint.** Two defs had NO paint at all — glass-cove and
  current-run — and get one: pastel tide-lines (seafoam wash + wandering
  rose line) and flow streaks (fbm sampled long-along/tight-across the
  axis, combed like the banners) respectively. Identity at the wedge
  edge per the standing contract; purity asserted in the tierb suite.
  The other seven side rooms already carry authored paint
  (wave-8/atelier); their walls are re-judged in the capture rounds
  rather than repainted on principle.
- **Seeds.** T1 pieces ride `SEEDS.<wing> ^ 0xb401..0xb409` (one fresh
  constant per wing, grep-clean) fed to kit-private Randoms; veils ride
  `SEEDS.<wing> ^ 0x9a7e` inside the mount. Everything is appended
  after every wave-8 draw — the reroll fence is structural, and
  `tests/wingsTierB.test.ts` pins it with pre-uplift sentinels printed
  at this branch's base (commit 50504b4).

## Per-wing uplift (the wing's own voice)

| Wing | T1 statement | Veil (inks near→far) | Light |
|---|---|---|---|
| nursery-shallows | shell-grit drift ×420 (`pebble`, cream over rosy underside — the broods' spent shell) | sand-rose 0x6a5240/0x94765a/0xc0a482 | sun-pale column 0.09 + shell-gold motes ×55 |
| lumen-garden | ink-violet frond carpet ×160 (48-tri R12 profile at frond 60, tips toward the beds' slate-cyan, NO light of its own) | indigo-violet 0x241a30/0x3a2c4c/0x554468, planes only | none — the garden's light belongs to its beds |
| wreck-meadow | rust-and-bone gravel drift ×340 twoTone, raked gently seaward, grade 0.7 (r2) | grey-teal 0x35403a/0x4c5852/0x6a746c | pale sea-light column 0.07 (motes traded for the bone family, r2) |
| moonlit-lagoon | moon-grass blade carpet ×220 (R12 blade profile, lavender-silver, sway 0.015 — barely above stillness), the moon pool kept bare | silver gauze, TWO planes 0x342e48/0x5c5880, w 1.85 — radially short of the koi circle | moon-pale column 0.08 + pale motes ×50 |
| glass-cove | glass grit ×560 twoTone (aqua + rose families — the drifts' smallest change) | pastel, LIGHTENS with depth 0x3a5450/0x5c7670/0x8c8a92 | glint motes ×60; no column (brightest water in the game) |
| current-run | combed turf ×360 (`tuft`, raked downstream with the banners, strength 0.75) | rushing teal 0x2c4844/0x40625c/0x5c807a | water-light column 0.07 + motes ×45 |
| mangrove-roots | seedling sprigs ×340 (small amber-olive cards between the knees) | umber-amber 0x46321c/0x66492a/0x8a6a42 | warm amber column 0.09 + motes ×50 |
| ice-grotto | hoarfrost splinter field ×380 (`shard`, pale-violet, corridor-fenced vertex-proof) | cool violet 0x363450/0x504e6e/0x74738e | frost column 0.07 + frost motes ×45 |
| sargassum-sky | fallen canopy litter ×150 (`card`, amber — DELIBERATELY the sparsest T1: the floor is a held breath) | amber-gold 0x453317/0x685026/0x92763c, hung narrow (w 1.6, planes before r 38) | gold column 0.09 + gold motes ×50 |
| ruins-terrace | — already shipped as Tier A (conn1/conn3): litter ×500 + moss + frieze + veil | (conn1's cold grey-violet) | (conn1's cold column — the game's one cold family) |

Corridor fences kept by construction (and re-asserted per wing in
`tests/wingsTierB.test.ts`): nursery den corridor 0.06 (held 0.075) and
its bare r 30–34 gate; the lumen heart 0.065 (held 0.075, r 39–45);
glass-cove's full 3 m clearing + 0.06 rad; the current channel 1.9 m
(held 2.2); the mangrove lane 0.05 + footprint and its bare r < 34.5
gate; the ice corridor 0.06 + footprint at the vertex level (the W5
collector reads instance-transformed vertices); the koi circle's 1.25 m
flora ceiling; the turtle volume r 38–46 y 4–6 empty INCLUDING the veil.
No `frustumCulled = false`, no castShadow, no new contacts, no new
per-frame hooks (kit sway and veil drift ride the standing
`WingFlora.update` forwarding on simulated seconds).

## Budgets, measured (`[tierb-budget]`, vitest prints them each run)

R2 Tier B ceiling ≤ +6 draws / ≤ 20k tris per wing, T1 + veil counted
from the meshes actually created:

| Wing | Uplift | R2 ceiling |
|---|---|---|
| nursery-shallows | +6 draws / +10,016 tris | ≤ +6 / ≤ 20k |
| lumen-garden | +4 / +10,896 | ≤ +6 / ≤ 20k |
| wreck-meadow | +6 / +8,416* | ≤ +6 / ≤ 20k |
| moonlit-lagoon | +5 / +11,744 | ≤ +6 / ≤ 20k |
| glass-cove | +6 / +5,776 | ≤ +6 / ≤ 20k |
| current-run | +6 / +5,936 | ≤ +6 / ≤ 20k |
| mangrove-roots | +6 / +2,976 | ≤ +6 / ≤ 20k |
| ice-grotto | +6 / +4,656 | ≤ +6 / ≤ 20k |
| sargassum-sky | +6 / +2,216 | ≤ +6 / ≤ 20k |
| ruins-terrace | +0 (Tier A numbers live in conn1/conn3) | — |

*wreck-meadow's r1 figure; r2 resized its stones (same counts, same
draws) — the final table below is the record.

**Program envelope arithmetic** (MASTER R2 ≤ +120 draws / ≤ 380k tris
whole-program): connective-1 (+31 / +10.3k) + connective-2 (+15 /
+68.9k) + connective-3 (+6 / +25.5k wings, +8 / +19.0k traveller legs)
= +60 / +123.7k before this batch; wings-tier-b adds **+51 draws /
+62.6k tris** → **program total +111 draws / +186.3k tris resident** —
inside the envelope with 9 draws and ~194k tris to spare. The test
prints and re-asserts this arithmetic every run.

## The standing flags

### Sargassum horizon band — RESOLVED (verified, not re-fixed)

`rg sargassum docs/` finds the flag stated in connective-tissue §1
("sargassum's flat green horizon band") and its fix already recorded in
atelier-1: the wing's fog `colorScale` blue channel was raised so the
fog-saturated sea surface at the look-up pose stops rendering as one
poster-green band. The CODE is the truth on disk: `SargassumSky.ts`
ships `colorScale: [1.08, 0.93, 0.7]` with the atelier's comment (blue
0.55 → 0.74; the atelier ledger's own text says 0.70 — the def's 0.74
and its rationale are what shipped). Batch 4's job was the VERIFICATION
the flag still lacked at Tier B close: the r1 look-up capture
(`WING-sargassum-sky_tierb-r1`) shows the far water as warm sea-glass
aqua-gold with the horizon keeping its depth — no flat band. Verdict:
the flag is closed by capture evidence; no code change was needed or
made to the mood table.

### Kraken GLB spot-check — RESOLVED (fallback retired, GLB adopted)

`rg kraken docs/` finds the flag in connective-tissue §1 ("the kraken's
fallback showing in glass-cove"); the GLB contract lives in
`docs/wave8-ledger/w8-dark-kraken-koi.md` and
`public/assets/models/CREATURES.md` (creature-kraken-hatchling.glb,
2000 tris, root + arm0–7 skin). The spot-check is
`scripts/tierb-kraken-probe.mjs`: boot on the dev server, wait for the
asset library to settle, then interrogate the LIVE scene graph.
Verdict, measured:

```
assetsReady: true, systemPresent: true,
fallbackPresent: false, skinnedMeshPresent: true,
bodyChildren: [Group, SkinnedMesh, Bone root, Bone arm0..arm7]
```

The GLB loads, `adoptModel` rebuilds the measured skeleton, and the
cone-armed stand-in is removed and disposed. The den capture
(`KRAKEN-den_tierb-r1.png`) shows the real octopus body (the discovery
banner fired in-frame). The wave-8 sighting was a capture taken either
under `SHOT_NO_ASSETS=1` or before the async load settled — the
no-assets build is SUPPOSED to show the fallback (that is the fallback
contract, KIT-SPEC law 7 restated for creatures). Nothing to fix in
code; the flag stands closed with the probe as its regression door
(exit 1 if the fallback ever shows under loaded assets again).

## REGIONS.md (MASTER R1, this batch's checklist item)

`docs/REGIONS.md` §"The non-negotiables" updated: item 2's reveal
cadence now reads **20–40 m** (was ~30–60 m) citing FILL-DOCTRINE
rule 2 + R1 + the §1.2 rest exemption; item 7's budget text now reads
**≤ 260 draws / ≤ 1.35M tris bound by the ≤ 16.9 ms headed-gate
measure at scale 1.00** (was ≤ ~120 / ≤ 250k), citing R1 and R12,
including R12's quality-first licence and the "gate beats cap" rule.
The two documents stop disagreeing on paper.

## Test-collector amendments (stated, not hidden — the standing precedent)

- `tests/wingsW1Flora.test.ts` — `insidePhase3Uplift` gains
  `wing-uplift-tierb` (budget case only; nursery + lumen). Determinism,
  confinement, corridor and heart checks still read every uplift vertex
  and instance — the lumen heart law is proved against the veil's own
  merged vertices on every run.
- `tests/wingsW2Flora.test.ts` — the budget filter gains
  `wing-uplift-tierb` + `wing-gate-veil` (wreck + moonlit have veils
  now; vent's Batch 1 veil moves out of the wave-8 count to its budget
  home in the connective suite). Wedge confinement, den corridor and
  the koi-circle law still read everything — the moonlit gauze passes
  the koi check BY GEOMETRY, not by exemption.
- `tests/wingsW5Flora.test.ts` — `insidePhase3Uplift` gains
  `wing-uplift-tierb` (budget case only; ice + sargassum). The ice
  corridor and turtle-volume checks read the T1 vertex-for-vertex (the
  veil was already excluded by connective-1's `insideGateVeil`, whose
  rationale this batch RE-EARNS by construction: both veils stand
  radially clear of the protected volumes, asserted in the tierb
  suite).
- `tests/wingsW3Flora.test.ts` / `wingsW4Flora.test.ts` — no amendment
  (their collectors read top-level children; the uplift is two nested
  Groups). Their laws are re-asserted against the new content in
  `tests/wingsTierB.test.ts` instead.

## Critique rounds

Captures: `visual-qa/*_tierb-before.png` (20 poses), `*_tierb-r{n}.png`.
Port discipline held: `npx vite --port 5210 --strictPort`, server
verified with `curl -sf` before every run; port 5209 never touched.

### before (all twenty looked at)

- The nine side rooms confirm the connective audit: composed hero marks
  (den arches, ribs, roots, spires, canopy) over floors that are bare
  tan outside each wing's one existing flora family, and every doorway
  from the bowl is a bare saddle — no veil, no light, no threshold
  voice anywhere.
- ruins-terrace (both poses) confirms its Tier A uplift stands: raked
  litter, moss, frieze, and the conn1 veil's cold recession in the
  doorway. Nothing for this batch to add.

### r1 (first uplift, all twenty looked at)

- **moonlit-lagoon (interior)** — the batch's first clear landing: the
  lavender-silver blade carpet reads as a continuous meadow floor
  among the stones and green tufts, the koi crossing above. DOOR: the
  notch shows a soft moon column with pale motes and the koi hovering
  beside it — threshold voice present, gauze planes faint. → r2: judge
  again with the raised pose; heights 3.4 → consider 4.2 if the gauze
  stays invisible.
- **mangrove-roots (interior)** — seedling gold lines both flank banks
  under the root columns; lane clean. DOOR: the best r1 doorway — the
  gate saddle frames the roots with a visible WARM glow and motes
  between them. The fort promises from outside.
- **ice-grotto (interior)** — hoarfrost dusts the shelf around the
  spire feet; subtle, correct for the hush. DOOR: pose fail, mine —
  the camera stares into the rim shoulder (y 1.2 at r 27 is below the
  shoulder line). → r2 raises every door stand.
- **glass-cove (interior)** — the kraken sits front and centre wearing
  the GLB body; the grit adds fine pastel speckle to the banks, subtle
  at pose range. DOOR: the doorway reads (pebble-flanked notch, bluish
  recession = the veil planes) but the camera stands IN the bowl's
  seagrass. → r2: grit size up a step ([0.03, 0.1]); raised stand.
- **nursery-shallows (interior)** — pose problem, not content: the den
  arch owns the canonical stand's whole frame (golden dwarf banner
  included); the shell drift is present but unreadable. → r2: across
  0.07, the ghost-reef precedent. DOOR: motes read faintly; veil
  planes hide behind the den arch. Judge at the raised stand.
- **lumen-garden (interior)** — pose problem: the wave8 stand looks
  LEVEL through midwater (the bulbs' scene), the floor at −10 never
  enters frame; the frond carpet is unjudgeable. → r2: pitch −0.32.
  DOOR: pose fail, mine — the stand is inside a bowl kelp stand.
- **wreck-meadow (interior)** — the rib cage and meadow compose, but
  the rust drift under-reads badly: 0.05–0.15 m stones in the wing's
  own rust-tinted haze vanish. → r2 (code): sizes [0.07, 0.2],
  grade 0.7, and a BONE second family (twoTone) so the field reads
  rust-and-bone; paid for by dropping the veil's motes. DOOR: pose
  fail, mine (rim shoulder).
- **current-run (interior)** — combed turf present at the banner feet,
  blends with the banners' own register (acceptable — the wing should
  read as one streaming gesture); channel open, rings tearing. DOOR:
  pose fail, mine (rim shoulder, dark banner clump in the lens).
- **sargassum-sky (interior, the look-up)** — canopy + the Island That
  Swims overhead; the horizon band flag verified closed (sea-glass
  aqua-gold, no poster band). The floor litter barely enters this
  frame BY DESIGN (the pose looks up). DOOR: pose fail, mine (bowl
  kelp blade in the lens) → r2 slides across 0.04.
- **ruins-terrace** — both poses healthy; the conn3 uplift + veil read
  exactly as its ledger recorded. No Tier B work.

### r2 orders (landed before the r2 captures)

1. Wreck drift: sizes up, grade 0.7, bone twoTone; veil motes → the
   bone family's draw (6 stays 6).
2. Glass grit: size [0.03, 0.1] — one step of presence. (Landed in r3
   — see below; the r2 run predated this edit.)
3. Every door stand raised above the rim shoulder (doorR 25.5, per-wing
   y sill+~3.5, down-pitch), nursery interior slides across 0.07,
   lumen interior pitches to −0.32, sargassum door slides across 0.04.

### r2 (all twenty looked at)

- **DOORWAYS SHIP at six wings.** glass-cove — the batch's best door:
  pastel pebble banks flank the notch, the veil's haze recession and
  glint motes fill it (the toybox promise). sargassum-sky — the gold
  column and motes in the doorway with the Island That Swims overhead.
  mangrove-roots — the warm amber veil glowing between the root
  columns. current-run — bubble rings streaming through the notch over
  a teal recession and pale column. ice-grotto — crystals frame the
  notch, spires in a violet haze behind, frost motes faint. nursery —
  warm motes and the sun-pale column against the den arch. All read as
  doors: veil, light, threshold voice.
- **nursery-shallows (interior, across 0.07)** — the pose fix lands the
  T1: cream-and-rose shell trails read across the terrace beside the
  tuft rows, the den arch now a repoussoir instead of the whole frame.
  DONE.
- **wreck-meadow (interior)** — better (the bone family gives the field
  grain) but STILL timid under the wing's own rust haze at the
  canonical stand. → r3: one more size step [0.09, 0.24].
- **moonlit-lagoon (door)** — the column reads; the two-plane gauze is
  nearly invisible against the bright bowl water. → r3: height 4.6,
  far ink lightened (0x6a6690), column 0.1. Width untouched — the koi
  circle stays clear by geometry.
- **lumen-garden (interior, pitch −0.32)** — still a midwater frame:
  at y −5.2 the −10 floor only grazes the frame foot; the fronds read
  as dark texture in the gloom. → r3: y −6.5, pitch −0.5. (door) —
  the saddle crest hides most of the veil; the sovereign hovers above
  the notch. → r3: veil base +1 m (sillLift −0.6), height 5.2.
- **ruins-terrace** — both poses healthy; nothing to add.

### r3 orders (landed before the r3 captures)

1. Glass grit [0.03, 0.1]; wreck gravel [0.09, 0.24].
2. Lumen veil sillLift −0.6, height 5.2; moonlit veil height 4.6, far
   ink 0x6a6690, column 0.1.
3. Lumen interior stand y −6.5, pitch −0.5.
