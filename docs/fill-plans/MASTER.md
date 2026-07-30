# FILL MASTER PLAN — the reconciled program

Written by the coherence lead after reading all eight Phase 1 plans. This
document is the single work order for Phase 2 (the kit) and Phase 3 (the
reworks). Authority order, stated once: **FILL-DOCTRINE.md > this file >
REGIONS.md > the individual plans.** Where a plan and this file disagree,
this file rules; where this file is silent, the plan stands. The kit's
buildable specification is `docs/fill-plans/KIT-SPEC.md` (sibling file,
same authority).

## 1. The world's coherence contract

### 1.1 The gradient map (one journey, reconciled from eight handshakes)

Every province is one continuous palette journey: bowl → wing → vale →
region (→ pass → region). All handshakes below are ADOPTED as written in
the plans; conflicts between them were none — they interlock.

| Province | Wing register | Vale gradient (gate → region) | Region arc | Pass / forward promise |
|---|---|---|---|---|
| Verdant (kelp-cathedral) | paleStone jambs `0x8a8474`, cool VALE_TONES first 20 m | leaf-litter + saplings thickening; walls warm as green rises | Kelp Sea: bright spring green, light in wells, peaks at the Sunwell; **ends milky-bright and thinning** (Falling Edge) | Emerald Stair pass: 40 m palette lerp, milky-crest carpet samples verdant-1's Falling Edge multipliers (0.98/1.02/0.92) at u < 700, celadon by u 740. Terraces: older, mistier, worked jade (exclusive), two light peaks (Cistern, Mistfall), ends on the lit mesa-city promise (depth 3) |
| Smoking (vent-springs) | dark ground, amber pooled in mottle | gorge gravel starts at the seam at wing density, thickens over 20+ m | Smoulder: light comes from BELOW — warm, rising (embers, shimmer); milk-bright tops | province vocabulary = mat rings, shimmer, smoke-bush; siblings reuse kit litter/mats with shifted palette |
| Pale (ghost-reef) | bone → returning colour; near-gate stands COOLED (ruling R6) | the colour-return story told along the vale: bone rubble gaining colour patch by patch toward the region — then the **false spring** dies at the ravine mouth (u 48–68) and the hush earns its white | Bone Meadows: paper held to a lamp, white → blush → full colour at the Mother | — |
| Calamity (ruins-terrace) | gold, intact civilisation | debris rhythm every 25–40 m down the 490 m march; grey arrives as the mood descent already stages it | Sunken Calamity: cold, settling light (seep-glow, wisps, falling ash); the grove's one warm-green defiance | relic family drawn from the wing's own architectural vocabulary (same drum radius, same tile profile); blast-rake globally away from the WOUND across all future siblings |
| Golden (sandfall-dunes) | quiet tan [1.0, 0.9, 0.72] | first 30 m keep wing-register paint and thin fill, full honey by u ~90; wing gains a duneling bed + gold motes so the life gradient starts before the door | Hourglass Sea: honey over violet, gold dapple, the ring of falls; Gilded Shore frames the depth-2 pass azimuth | reserve golden-waste-2 pass at the shore stacks |
| Great-blue (open-blue) | composed emptiness; The Old Current + The Gentle Dark own the water | mood crossfade [0.6,0.72,0.95] → [0.6,0.55,1.08] hands over inside the seam tongue; verify no band at u 44–50 | Drop Plains: green prairie under high sun → violet Under-Blue (deep steps retinted violet, red above green — never cobalt) | the Under-Blue continues the mythics' register: one great shape is an event; nothing clutters below the lip, ever |

**Global constants, held everywhere**: the value key (darkest thing is a
colour; violets keep red above green; distance goes milky-bright; nothing
black); every lit surface through `createToonMaterial`; kit pieces
recoloured by region palette, never bespoke-hued; `TIP_GOLD 0xc9b45e`
shared across the whole Verdant province's leaf tips; one shoal-light per
province (silver-green verdant, gold golden, pearl-white pale, ember-dark
smoking, sparse grey calamity); the two dark-register glow families stay
distinct — **Smoulder light is warm and rising, Calamity light is cold
and settling** — and nothing else in the game may burn cold.

### 1.2 The protected-stillness registry

Every named rest from all eight plans, in one list. **No future density,
light or life pass may fill these.** A random-pose frame that lands inside
one of these and reads bare is CORRECT. Additions require editing this
registry, not just a region file.

| Region | Protected rests |
|---|---|
| verdant-line-1 | Sunwell bowl interior (no fauna inside the ring); the narrows shadow passage u 190–250 (motes only, beam-free); the lip saddle crest; the shelf pocket (585, −40) |
| verdant-line-2 | Cistern bowl interior (the mirror is the rest; no fauna inside the ring); Fern Vault inner shadow; basin south pocket (1060, −30) |
| smoking-marches-1 | the lip's slab; the erratic's shadow; the Spring Head crown pool; the caldera's north floor quadrant; mid-shore between stacks; Ash Meadows centre u 330–360, v −20..+20 (minus the erratic) — fauna-free AND glow-free |
| sunken-calamity-1 | **the Suffocated Mile u 352–440** (the grief clause: no shoal, no darts, no crabs, ash snow at ~eighth density, no new glow; its only fill is four amphora clusters and one bubble thread); the Gardener's ten metres of road (object-free); the crest after the reveal; the grove's inner lawn; the shrine; mid-Quiet-Rim |
| pale-passage-1 | THE QUIET GALLERY (nothing moves but dust); the Ravine Hush u 130–210; the Mother's Pool (petals born above it, nothing swims through it); the saddle lip crest |
| great-blue-1 | THE UNDER-BLUE (Ferryman only; no shoal, no beams, no clutter below the lip); the mid-glide hush u 180–230 (channel kept clean, shoulders composed); the Fallen King hollow (stars and beam only); the Prow tip |
| golden-waste-1 | The Empty Quarter (full ripple T1 paint only, no T2/T4); The Drain's Eye (one shaft, the Keeper's circle the only motion) |
| world | traveller-shoal routes stay OFF every rest above (connective §5 saturation check) |

### 1.3 The reveal-cadence standard

**20–40 m everywhere** (doctrine rule 2, which tightened the old 30–60;
REGIONS.md's "~30–60 m" is superseded — see ruling R1). Applies to spine
roads, side loops, vales AND passes. A "reveal" is any of: an authored
cluster (T2+), a life crossing, a light event, a terrain reveal breaching
the fog. Registered rests (§1.2) are the ONLY exemption; their bareness is
composed, bounded, and listed. Transitions blend over 20+ m minimum
(sub-biome and region borders; the Emerald Stair pass lerp runs 40 m).

## 2. Rulings

Stated as decisions, not options. R-numbers are citable in ledgers.

- **R1 — budget caps.** The doctrine's **≤160 draws / ≤450k tris per
  attached region (vale included)** is canon; REGIONS.md's 120/250k is
  superseded (the doctrine says so itself). Same for cadence: 20–40 m,
  not 30–60. Updating REGIONS.md §7's budget text and its cadence figure
  is a Phase 3 checklist item (Batch 4), so the two documents stop
  disagreeing on paper.
- **R2 — wing budget ceilings.** The connective plan's numbers are canon:
  Tier A wings ≤ +10 draws / ≤ 35k tris; Tier B ≤ +6 draws / ≤ 20k tris;
  whole-program wing uplift ≤ +120 draws / ≤ 380k tris resident; no
  `frustumCulled = false` in a wing, no castShadow on smallwork, honest
  bounding spheres entirely inside the wedge past r = 27, `tests/wings.
  test.ts` gains a frustum-guard case per uplifted wing. In-wing frame
  allowance ~+15 ms SwiftShader-floor in the wing's own poses, overruns
  stated in the ledger.
- **R3 — vale budget and ownership.** A vale spends the **owning
  region's** budget and streams with it. Consequence for file ownership:
  **each region's Phase 3 rework package owns its own vale treatment**
  (per the connective plan's §3 table); the connective worker owns wings,
  gate-veils, the traveller-shoal wing legs (bowl budget) and the pass
  pattern — it does not edit region directories.
- **R4 — the verdant distance-ring-over-pass cut.** The jointly-flagged
  edit (verdant-1 §7.9 / verdant-2 §8) is **assigned to the verdant-1
  rework package**, as its FIRST item — it blocks the only two-region
  journey. verdant-2 verifies from `pass-threshold` and adds the
  foot-below-rampart / pass-gate assertions on its side. The gate is also
  legislated into the pass pattern (connective §4.4) for all future
  passes: distance rings part over the pass corridor on both sides.
- **R5 — the Drop Plains flat-violet frame corruption.** Step 1 of
  blue-1's rework, before any fill is judged: node-toggle probe, find the
  lit geometry shipping without a normal attribute, produce twelve
  healthy frames. If the in-flight worker's merge lands earlier, the fix
  may be taken as a hotfix at merge time — it blocks all visual QA.
- **R6 — the ghost-reef → Bone Meadows "false spring" handshake.**
  ADOPTED, both halves: pale-1 authors the false-spring beat (u 48–68, a
  dying trace of blush gravel and one budded jamb, hush by u 70) and the
  vale tells the colour-return story along its length (connective §3);
  the wing's near-gate stands are cooled as part of the **ghost-reef Tier
  A wing uplift**, scheduled in the same batch as pale-1 so the gradient
  lands as one design. Wing geometry stays frozen; palette only.
- **R7 — no Package C.** Read against the needs lists, no plan demands a
  Blender hero: every kit ask is procedural (DataTextures, lathes,
  instanced cards). The two texture asks (fall-streak marks, recolorable
  dapple) ship as procedural builders in Package B; `dappleSheet` may
  clone the painted caustic sheet through `AssetLibrary` with the
  generated dapple as its standing fallback. Region exclusives that later
  prove to need sculpting go through that region's own package under the
  standing atelier contracts — not through the kit.
- **R8 — exclusives vs kit.** Where a plan lists a *builder* as kit and
  its *palette/shape* as exclusive, the builder is kit and the signature
  use is exclusive: `matRings`' tiered amber/rust/sinter palette belongs
  to smoking-1 alone (calamity wears white-felt/rust); pale-1's
  vertebra/branch ossuary shapes are pale-exclusive custom geometry fed
  into the kit `groundLitter` (the kit accepts caller geometry; exclusive
  shapes live in region directories). Composition exclusives (megalith
  collar, crest bed) are region-owned recipes OF kit pieces, not kit.
- **R9 — in-flight regions.** golden-waste-1 and great-blue-1 rework LAST
  among regions (Batch 3): both plans were written against moving
  worktrees; their audits and §3 arithmetic must be re-based on the
  merged final trees, and blue-1 must publish the missing
  `docs/region-ledger/great-blue-1.md` before its rework closes.
- **R10 — stillness beats cadence.** Where the 20–40 m cadence and a
  registered rest collide (the Suffocated Mile is ~90 m; the Empty
  Quarter; the Under-Blue), the rest wins. That is the doctrine's own
  saturation check; the registry (§1.2) is the licence.
- **R11 — blue-1's moving cloud-dapple** is sanctioned as a
  prototype-first experiment with its stated fallback (breathing blades).
  It introduces a new mechanism (drifting multiplicative shadow quads);
  if it reads as a decal in captures, take the fallback without debate.

## 3. Phase 2 — kit work packages

Two parallel-safe packages (R7 killed the third). Full buildable specs,
conventions, per-piece budget shapes and test contracts are in
`KIT-SPEC.md`. Neither package touches `src/world/regions/<region>/`,
`src/world/wings/`, or `SEEDS` (the kit owns no seeds — ever).

**Package A — ground & flora builders.** Owns `src/world/regions/kit/`:
`KitTypes.ts` (the shared conventions file — created day one; B imports,
never edits), `KitPaint.ts` (wallStrataPaint), `CarpetField.ts`,
`GroundLitter.ts`, `ScreeApron.ts`, `MatRings.ts`, `BushBank.ts`,
`SpongeCluster.ts`, `WallDrape.ts`, `DriftDebris.ts`, `FarGrassCards.ts`;
`tests/kitGround.test.ts`; its demo registrations; plus the shared demo
harness `scripts/kit-demo.mjs` (created by A, extended — not edited — by
B via its own registration file).

**Package B — life, light & particulate builders.** Owns
`ShoalRunner.ts`, `PercherColony.ts`, `GlowColony.ts`,
`ParticulateField.ts`, `BeamAndPool.ts`, `DappleSheet.ts`, `GateVeil.ts`,
`FallStreak.ts`; `tests/kitLife.test.ts`; its demo registrations.
**Build `gateVeil` and `shoalRunner` first** — they gate Batch 1's
connective work.

**Demo-proof requirement (both packages, per piece):** every piece
registers a standalone demo scene; `node scripts/kit-demo.mjs <piece>
<tag>` renders it (flat seabed patch, standard toon rig, 1600×900) to
`visual-qa/kit/`. A piece with no demo capture in its package close may
not be consumed by any Phase 3 package. The capture is the review
artifact; the piece's determinism/budget tests are the merge gate.

## 4. Phase 3 — execution order

Batches of **max 3–4 concurrent packages**, worktree-isolated per the
standing wave discipline. A batch opens when the previous batch's
packages close (merge-verified).

- **Batch 1 — the province journey.** `verdant-line-1` (item 1: the R4
  distance-ring cut), `verdant-line-2`, `connective-1` (the six Tier A
  gate-veils + the open-blue hole repaint — worst seam, cheapest fix).
  Closes with the game's only two-region journey walkable and every
  gateway doorway a promise instead of a cut-out.
- **Batch 2 — the dark registers + their doors.** `smoking-marches-1`,
  `sunken-calamity-1`, `pale-passage-1`, `connective-2` (Tier A wing
  density/light uplift: kelp-cathedral, vent-springs, ghost-reef —
  including R6's near-gate cooling and W1's god-shaft flag). Ghost-reef
  rides beside pale-1 so the false-spring handshake lands as one
  gradient.
- **Batch 3 — the merged in-flight pair + the network.** `golden-waste-1`
  (rebase audit first, per R9), `great-blue-1` (R5 corruption fix first;
  write the missing ledger), `connective-3` (remaining Tier A uplift:
  sandfall-dunes + ruins-terrace; the traveller-shoal network, verdant
  route first, then golden/pale/smoking/calamity; verdant pass polish).
- **Batch 4 — closure.** Tier B side-room uplift (one T1 statement + wall
  paint + standing flags: sargassum horizon band, kraken GLB spot-check);
  REGIONS.md budget/cadence text update (R1); program-wide random-pose
  sweep re-run over every region against this file's registry; final
  archive tag.

### 4.1 The random-pose sweep standard (every rework must pass)

The doctrine's Phase 3 verifier, made concrete and uniform:

1. `scripts/region-shots.mjs` gains `--random <n>` (default **12**):
   poses drawn from the region's own stream `^` one fixed published
   constant (same constant for every region, chosen in Phase 2 and
   written into KIT-SPEC's conventions), sampled uniformly where
   `weight > 0.5`, y in [floor + 1.2, ceiling − 1], random yaw, pitch in
   [−0.15, +0.1] rad, 2 s settle. Seeded, so the sweep re-runs
   identically forever.
2. **Pass bar: ≥ 11 of 12 frames satisfy the three-layer law** (< 8 m
   foreground interest, 8–40 m silhouette, painted/built distance). Any
   failing frame must land inside a §1.2 registered rest — otherwise the
   region is not done, whatever its authored poses look like.
3. Alongside the sweep, each rework publishes in its ledger: measured
   draws/tris against 160/450k; the three-point interior frame probe;
   the full authored pose set at a final tag with a same-session control;
   and the noassets set (every kit piece is procedural, so this should
   cost nothing — verify, don't assume).

## 5. Asset-needs reconciliation table

Every kit ask from all eight plans, deduplicated under its canonical
name. "Absorbs" lists the plans' original names so their §6 sections stay
readable. Region EXCLUSIVES are not in this table (they stay in region
directories; see R8).

| Canonical piece (file) | Pkg | Absorbs | Consuming regions / systems |
|---|---|---|---|
| `carpetField` (CarpetField.ts) | A | ground-cover carpet builder (pale, blue, golden, connective), carpetField (v1, v2), wire-tuft bank (golden, connective), turf tufts (pale) | ALL seven regions (every T1 card/tuft family), Tier A/B wings, vales |
| `groundLitter` (GroundLitter.ts) | A | ground-litter scatterer (smoking, calamity — rake knob), pebbleRun (v1, v2), gravel/grit runs (pale, blue, golden) | all seven regions; wings (floor rubble); pale's ossuary shapes via custom geometry (R8) |
| `screeApron` (ScreeApron.ts) | A | scree/rubble apron builder (pale), shelf-lip scree tongues (blue), column-foot scree (smoking) | pale-1, blue-1, smoking-1, wings |
| `matRings` (MatRings.ts) | A | mat/carpet disc builder (smoking, calamity) | smoking-1 (thermophile palette — exclusive use), calamity-1 (white felt/rust), Wound felt runs |
| `bushBank` (BushBank.ts) | A | bushBank (v1, v2), bush bank (smoking), oasis cushion bushes (golden), wine/pale/dead-scrub bushes (calamity) | v1, v2, smoking-1, golden-1, calamity-1, vales |
| `spongeCluster` (SpongeCluster.ts) | A | spongeCluster (v1, v2 — W-N5 profile) | verdant-1, verdant-2 |
| `wallDrapeBank` (WallDrape.ts) | A | wall-drape flora bank (connective) | all Tier A/B wings, vale walls (smoking gorge, verdant vale) |
| `driftDebris` (DriftDebris.ts) | A | drift-debris scatterer (golden, connective — wrack/spars), relic scatter set (calamity — quern/bowl/tile/drum shape set), fallen-limb-class props where not exclusive | golden-1, calamity-1, wings (wreck-meadow), vales |
| `farGrassCards` (FarGrassCards.ts) | A | far-grass card builder (blue) | blue-1 (the tuning lever of its whole grass budget), golden dune distance, any future meadow region |
| `wallStrataPaint` (KitPaint.ts) | A | wall-strata paint helper (connective — canyonStrata generalised behind `WingDef.paint`) | vent-springs + all Tier A wing walls, vale walls |
| `shoalRunner` (ShoalRunner.ts) | B | shoalRunner (v1, v2), path-shoal runner (smoking, calamity), shoal-runner (golden), ShoalRunner (connective — split-route traveller network) | ALL seven regions' road shoals + the five province traveller routes |
| `percherColony` (PercherColony.ts) | B | smallColony (v1, v2), perch-fauna placer (smoking), percher colony (pale, blue), small-percher (golden) | all seven regions (perchers, fry, blennies, brittle-stars, whelk trios) |
| `glowColony` (GlowColony.ts) | B | glowColony (v1, v2 — W-O1 bud+halo discipline baked in) | verdant-1 (maze), verdant-2 (basin, jambs); dark registers where cold/warm tint fits their family rules (§1.1) |
| `particulateField` (ParticulateField.ts) | B | particulate column (pale — dust bloom), particulate field (blue — marine snow, grass seeds), sparkle-swarm points (smoking, calamity), particulate drift (connective gate-veils) | all seven regions, gate-veils, vales |
| `beamAndPool` (BeamAndPool.ts) | B | beamAndPool (v1; v2 adds first-class `slant`), light-event props: reveal beam (golden, connective) | all seven regions' shafts/blades/pools; wing light events |
| `dappleSheet` (DappleSheet.ts) | B | dapple sheet recolorable per region (golden) | golden-1 (honey), any bright region wanting dapple; NOT pale-1 (its plan forbids dapple — upheld) |
| `gateVeil` (GateVeil.ts) | B | gate-veil builder (connective — the highest-leverage piece) | all six Tier A doorways, Tier B later; palette-sourced from the region behind the door |
| `fallStreak` (FallStreak.ts) | B | soft fall/streak mark texture (connective) | sandfall-dunes wing, golden-1's Hourglass falls, verdant-2's Mistfall milk rework (its exclusive sheets consume this texture) |

Everything else in the plans' §6 lists is REUSE of existing region/bowl
code (counts, palettes, loop constants) and needs no kit entry.
