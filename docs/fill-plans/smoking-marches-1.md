# Fill plan — smoking-marches-1 (The Smoulder Fields)

Phase 1 plan under `docs/FILL-DOCTRINE.md`, applied to the region built in
`src/world/regions/smoking1/` and judged from the `smoulder-final` capture
set in the smoking1 worktree (`visual-qa/20260729-1708_seed1_hi_REGION-
smoking-marches-1-<pose>_smoulder-final.png`, cited below by pose name).
The mood thesis stays: geothermal abundance — the fill is what a hot floor
FEEDS, never clutter. Budgets against the doctrine's raised caps:
**≤ 160 draws / ≤ 450k tris** (currently 59 / 171.5k — huge headroom).

## 1. Current-state audit

The landmarks pass; the space between them defaults to bare ground.
Per pose, against the three-layer law (foreground < 8 m / middle 8–40 m /
painted distance):

| Pose (PNG) | FG | Mid | Dist | Verdict |
|---|---|---|---|---|
| gorge-descent | ✗ bare sand | ✗ bare walls | ~ fog only | Worst frame in the set: gradient + sand. Nothing but two bubble wisps. |
| first-breath | ✗ bare | ✓ lone smoker + 2 frond dots | ~ | The reveal works; the 40 m around it are empty. |
| gorge-lip | ✗ bare tan slope | ~ one frond sprig | ✓ organ skyline | The region's big breath opens onto a bare shelf. |
| ash-flats | ✗ lower half bare | ✓ erratic, scout smoker, grass tufts | ✓ | "Quiet" reads as "unfinished": one boulder + ~8 tufts in 90 m. |
| colonnade | ✗ bare between columns | ✓ columns compose | ✓ | Great T3, zero T1/T2 — floor is untouched sand. |
| organ-steps | ✗ bare treads | ✓ pipe rank | ✓ | Skyline lands; benches carry no scree, no jointing litter. |
| spring-stair | ~ stair paint reads | ✗ bare mid | ✓ shafts | Pools read; the approach ground and rims carry no beads/mats in frame. |
| chimney-forest | ✗ bare floor, 2 fronds | ✓ layered smokers | ✓ | Cathedral with no floor: trunks rise from empty sand. |
| twin-kings | ✓ (looking up) | ✓ | ✓ | Passes — riders + motes + smoke. |
| caldera-rim | ✗ bare violet dunes | ✓ jellies, kiln ghost | ✓ haze | Bowl floor is bare from the rim; only the kiln breaches. |
| kiln-keeper | ~ kiln + keeper | ✓ jellies | ✓ | Centrepiece passes; the floor ring around the kiln is bare. |
| ember-shore | ✗ 100 m of bare shelf | ✓ two stacks | ✓ spire cards | The stacks frame emptiness. |

**Road walk** (from `SmokingTerrain.ts` / `SmokingRocks.ts` /
`SmokingFlora.ts` layout tables):

- **Gorge u 48–292 (~250 m)**: jambs u 55/57 → 7 boulders at u ≈ 84…252
  (one per ~28 m, each 1–2 m in an 8–17 m corridor) → First Breath u 158 →
  12 frond triples u 130–274 → slab u 262. The letter of the old 30 m rule,
  none of its spirit: the floor and *both walls* are 100 % bare; every
  "reveal" is a single small object. Bare stretches: u 48–84, 96–130 walls,
  and every metre of channel floor.
- **Lip → flats u 266–380**: scout smoker 308, erratic 322, 8 authored
  grass patches 300–346. Bare: u 266–300 (the reveal's own foreground),
  and everything v > 40 or v < −30.
- **Flats → colonnade/organ (u 380–424, v +40…+96)**: nothing authored on
  the approach; the basalt columns start where `basaltWeight > 0.3`.
- **Flats → springs (385, −72)**: nothing between v −20 and the stair.
- **Springs → chimney forest ((385,−72) → (512,−52), ~130 m)**: nothing.
- **Caldera rim → kiln**: bowl floor bare except the kiln and glow pools.
- **Ember shore u 555–650**: two stacks; ~100 m of bare shelf.

## 2. Journey map

**Spine** (the road a first dive walks): Warm Gate (u 55) → gorge channel
→ First Breath (158) → narrows → Overlook Lip (266) → Ash Erratic (322) →
fork at u ≈ 360.
**North loop**: flats → Broken Colonnade (393, +52) → Basalt Steps →
Organ Steps (424, +96) → down the east treads → caldera rim (472, +32) →
Old Kiln → out the rim's south gap → home via the flats.
**South loop**: flats → Spring Terraces (385, −72) → the mineral stair →
Chimney Forest (512, −52) → Twin Kings → Ember Shore (u 583) → rim pair →
back along v ≈ 0.
**Rest points** (composed bare ground, the doctrine's allowed stillness):
the lip's slab (sit, look out), the erratic's shadow, the spring head's
crown pool, the caldera floor's north quadrant, mid-shore between stacks.
**Reveal cadence** (target ≤ 40 m everywhere; new items ★):

- Gorge: jambs 55 → ★ember seep-stain + frond bank 78 → boulder 84 →
  ★wall vein-scar 105 (glowing crack in the west wall) → boulder+fronds
  130 → First Breath 158 → ★shimmer column 175 → boulder 196 → ★warm
  pool + mats 215 → pinch 232–258 (its own event) → slab + lip 262–266.
- Flats: ★mat ring 285 → scout 308 → erratic 322 → ★cinder-star field
  340 → fork cairn ★360 → grass swells thereafter.
- Springs road: ★frond bank 370,−40 → stair rims → ★geyser event at the
  Spring Head (timed bubble burst, T5).
- Forest road: ★mini-smoker pair 440,−60 → ★vent cluster 470,−58 →
  forest eaves 484 → Kings 508–516.
- Caldera: rim crags (exist) → ★ember cobble run down the inner wall →
  kiln → ★keeper-print seams (glow lines) radiating from the kiln.
- Shore: ★scoria cobble drifts every 30 m → stacks 594/598 → cards.

## 3. Zone density table

All five tiers per sub-biome. Instances are ranges to tune in capture
rounds; draws are additional unless marked (0) = joins an existing draw.

| Sub-biome | T1 ground cover | T2 understory | T3 verticals | T4 ambient life | T5 events |
|---|---|---|---|---|---|
| Gorge | black-cinder gravel runs 900–1400 inst (1); warm seep-stain mats ×6 (1) | frond banks 12→30 clusters (0); wall scoria cobbles 120–200 (1) | 2 mini-smokers u 175/215 (0); wall vein-scar fins ×3 (1) | gorge shoal 40–60 (1); motes (0) | shimmer column u 175 (1); vein-scar glow (0) |
| Ash Meadows | ash-ripple pebble drifts 800–1200 (0, shares gravel); mat rings ×4 (0) | grass 58→110 patches (0); smoke-bush 30–50 (1); sulfur tufts 60–90 (1) | scout + ★2 far snag-smokers (0) | cinder stars 24→50 (0); darting silt-hoppers 60 (1) | fork cairn glow (0); grass-swell god-glimmer ×1 (0) |
| Basalt Steps | column-foot scree 400–700 (1); joint litter (0) | fallen column segments 10–16 (0, join basalt draws); frond nooks (0) | columns ~150 (exist) | perch-fish on column tops 24–36 (1) | colonnade swim-through light blade ×1 (0, SHAFTS row) |
| Spring Terraces | thermophile mat rings ×10–14 tiers (1–2); sinter shard litter 300–500 (1) | rim beads (exist, ×1.5); frond banks ×4 (0) | Spring Head (exists) | vent shrimp sparkles 80–120 pts (1); stars near rims (0) | geyser burst at head (1); pool glimmer shafts (exist) |
| Chimney Forest | ember gravel + mat aprons at every foot (0/1) | vents 30→80 (0); fronds ×16→40 clusters (0); smoke-bush 20 (0) | smokers 20→30 incl. 6 saplings (0) | riders (exist); urchins 18→44 (0); vent shrimp (0) | glow pools (exist, +4 rows) |
| Caldera | ember cobble run + kiln-seam mats (1) | rim crag scatter +8 (0); low fume domes 12 (0, vents) | kiln (exists) | jellies (exist); keeper + ★2 hatchling satellites (1) | kiln breath shaft (exists); keeper-print glow seams (0, pools) |
| Ember Shore | scoria drifts 500–800 (0); shell-cinder windrows (0) | leaning stones +6 (0, rocks); dune grass 20 patches (0) | stacks (exist) + ★1 far spire | shore shoal drift-through 30 (0, gorge shoal path extends) | stack-framed card vista (exists) |

**Budget sum**: new draws ≈ 16–19 → **≈ 75–78 of 160**. New triangles:
gravel/scree/litter ≈ 55k, mats ≈ 10k, flora growth ≈ 30k, bushes/tufts
≈ 22k, mini-smokers/saplings ≈ 9k, life ≈ 12k, light marks ≈ 3k →
**≈ 312k of 450k** total. Verify with the region test's traversal the way
the ledger did; state overruns, never hide them.

## 4. Light plan (where the light lives in a dark register)

The mood table (`fog colorScale [3.2, 0.52, 0.36]`, sun 0.22) is three
measured rounds of work — **frozen**. One writer per channel: all new
light is *marks*, in `SmokingLight.ts`'s existing disciplines (fog:false,
baked ground fade, edge-on fade).

The region's inversion, stated once: here the light comes from **below**.
Three ladders:

1. **The ember ladder (the road is lit by the ground).** Grow `GLOWS`
   6 → ~14: add warm seep-stains down the gorge at u ≈ 78, 145, 215
   (small, 1.5–2.5 m, opacity ≤ 0.08 — the round-1 whiteout lesson), the
   fork cairn, two flats stains near the mat rings, the caldera's
   keeper-print seams. Every 25–35 m of road, something warm underfoot.
   All merged into the one existing ember-pools draw.
2. **The milk ladder (contrast above).** The value key's "distance goes
   milky-bright" is already carried by backdropFade 0.5 and the smoke
   columns; add nothing to the mood. Instead brighten the *tops*: smoke
   puffs already peak a third up; give the three distance-card spires a
   faint crown warm-up in their ink (0-draw vertex tweak) so every
   horizon carries one ember note.
3. **The event ladder (T5).** Keep the six SHAFTS; add: one shimmer
   column (new EXCLUSIVE prop — a tall additive card pair with a slow
   vertical scroll, reads as heat refraction) over the gorge's warm pool
   and one over the Twin Kings' saddle; the Spring Head geyser burst
   (timed bubble jet reusing the seep-bubble idiom from calamity/wing,
   90 s period, deterministic off ctx.time); the colonnade's aisle gets
   the existing lip-beam treatment (one SHAFTS row, opacity 0.08).

Checks: nothing above the bloom threshold; additive opacities stay under
the round-5 figures; `spring-stair` and `kiln-keeper` poses re-captured
first after any glow change (the two poses that whited out historically).

## 5. Life system plan

- **Shoal network (life as wayfinding)**: one new path-following ribbon
  (the thermal-riders idiom on a new closed line): 40–60 pale-ember
  tetras that run the gorge channel from the Warm Gate to the lip, pool
  over the fork cairn, and drift the ember shore before returning —
  i.e. the *spine road swims*. Deterministic loop, ~0.01 phase speed;
  1 instanced draw. The riders (84) keep the Kings' column; the two
  loops share the fork airspace for one crossing moment per cycle.
- **Small fauna per surface**: sand → cinder stars 24→50 + silt-hoppers
  (60 instanced dart-points low over the flats); rock/columns → perch
  fish 24–36 seated on column break-faces (static matrices, sway in
  shader); vents/springs → vent-shrimp sparkle swarms (80–120 additive
  points clustered on vent mouths); forest floor → urchins 18→44.
- **Drifters**: ember motes 600 (exist) — bias 80 of them into the gorge
  so the approach breathes too (currently thin below u 292).
- **Centrepiece + satellites**: the jelly procession (exists) is the
  centrepiece; give the Kiln Keeper two **hatchling satellites** — half-
  scale keeper bodies on short seam-loops at the kiln's north and east
  feet (reuse the keeper build at 0.5 scale; 1 draw each or instanced).
  Discovery target unchanged.
- **Preserved stillness**: the Ash Meadows' centre (u 330–360, v −20…+20
  minus the erratic) and the caldera's north floor quadrant stay
  fauna-free and glow-free on purpose — the region's rest bars. The
  saturation check is those two poses staying quiet.

## 6. Asset needs

- **(a) KIT** (shared builders, `src/world/regions/kit/`): ground-litter
  scatterer (gravel/scree/shard runs — one geometry family, palette +
  density knobs); mat/carpet disc builder (rim-banded, vertex-painted);
  bush bank (lobed, tip-tinted); path-shoal runner (extract the
  hand-rolled CatmullRom ribbon from `SmokingLife`/`CalamityLife` into a
  kit builder with path/count/palette knobs); sparkle-swarm points;
  perch-fauna placer (seat instances on named parent geometry).
- **(b) EXCLUSIVE** (2–4 signatures): **thermophile mat rings** (tiered
  amber/rust/sinter discs — the Yellowstone note nothing else may wear);
  **heat-shimmer column** (scrolling refraction card); **smoke-bush**
  (charcoal lobes, ember-tipped, vein-glow material); **keeper
  hatchlings** (the resident made a family).
- **(c) REUSE** (recoloured, never copied blind): bowl meadow blade
  (already re-cut as ash-grass — grow counts only); RockShapes lathes;
  seep-bubble jet (calamity's plume idiom for the geyser); cushion-star/
  urchin idioms (already repainted); DistantReef card discipline.

## 7. Rework checklist (ordered)

1. `src/world/regions/kit/` — land the kit builders above (Phase 2 gate;
   demo captures per piece).
2. `SmokingRocks.ts` — gorge wall boulders 7 → ~18 (keep alternation),
   flats cobble pairs, fallen column segments near the colonnade, +6
   shore stones, fork cairn. Colliders per stone as now.
3. New `SmokingCarpets.ts` — T1: cinder gravel runs, scoria/sinter
   litter, thermophile mat rings, seep-stain mats, column scree. All
   instanced/merged; contacts registered with `buildSmokingGround`.
4. `SmokingFlora.ts` — grass patches 58→110 (keep the 8 authored),
   fronds 230→~700 capacity with gorge/forest banks, add smoke-bush and
   sulfur tufts (new draws), silt-hopper points.
5. `SmokingChimneys.ts` — vents 30→80, 6 sapling smokers (existing
   archetypes, small scale), 2 gorge mini-smokers; smoke puff homes
   follow automatically (puffsPer stays 7 — watch overdraw).
6. `SmokingLife.ts` — gorge shoal loop, vent shrimp, perch fish, star/
   urchin growth, mote bias into the gorge.
7. `SmokingKeeper.ts` — hatchling satellites (0.5-scale, own seam loops,
   no discovery target).
8. `SmokingLight.ts` — GLOWS 6→14, shimmer columns, geyser event,
   colonnade blade; re-verify additive budgets at the two burn poses.
9. `Smoking1.ts` — wire new module(s); add 2 capture poses aimed at the
   former bare stretches (mid-gorge u 200 looking back; springs→forest
   road u 450,−60) so the fixes stay photographed.
10. `tests/regionSmoking1.test.ts` — raise budget caps to the doctrine's
    160/450k and re-measure honestly; add contracts: gravel/mats stay
    inside the domain, shoal path clears colliders and the channel
    ceiling, stillness bars stay empty (assert no instance inside the
    two rest rectangles), hatchlings never leave the caldera.
11. Phase-3 verification: full `region-shots` set + a RANDOM-pose sweep
    (doctrine §1 — seeded random swimmable points, three-layer check by
    eye), plus the noassets build.

## 8. Coherence notes

- **Vent-springs wing (gateway, azimuth 2.79)**: the wing is the warm
  doorway — its floor idiom (dark ground, amber pooled in mottle) is
  already quoted by `SmokingGround`; the gorge's new T1 gravel must
  start *at the seam* in the wing's own sparse density and thicken over
  20+ m (transitions are gradients). The gorge shoal's loop should nose
  into the last 10 m of the wing and turn back — the wing advertises
  the region's life without owning any.
- **Ruins-terrace wing / sunken-calamity sibling**: no shared border;
  shared *materials logic only* — both dark registers use ground-borne
  light (ember vs seep-glow). Keep the two shimmer/wisp props visually
  distinct: Smoulder shimmer is warm and vertical, Calamity wisps are
  cold and drifting (see that plan §6).
- **Future Smoking Marches siblings**: this region's exclusives (mat
  rings, shimmer, smoke-bush) are the *province* vocabulary — a sibling
  region (deeper caldera country, obsidian fields) should reuse the kit
  litter/mat builders with a shifted palette and claim its own 2–4
  exclusives; the smoker archetypes and vein-glow chunk live in
  `SmokingShared`/`SmokingChimneys` and can be lifted to a province
  shared module when the second region lands.
- Budget note for the streamer: doctrine caps are per *attached* region;
  the Smoulder + a wing may be co-attached at the seam — the gorge's
  new density is front-loaded toward u > 78 so the doorway band stays
  light.
