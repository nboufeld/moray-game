# W11 — Flora: taller herbs, real bushes, sculpted corals

Worker W11 of the wave-8 push. The owner's asks this package answers,
verbatim: "I want some herbs to be higher and to have some kind of bushes"
and "some corals have very lazy 3D assets".

Owned files: `src/world/SeaGrass.ts`, `src/world/Seaweed.ts`,
`src/world/CoralShapes.ts`, `tools/blender/build_{tube,fan,branch}.py`,
`public/assets/models/coral-{tube,fan,branch}.glb`,
`tests/{seaGrass,seaweed,coralGarden}.test.ts`, this ledger.

## 1. Taller herbs (SeaGrass.ts)

- `BLADE_HEIGHT` 1.25 → **1.8**. The per-instance height draw is re-centred
  rather than stretched: `range(0.6, 1.45)` → `range(HEIGHT_LO, HEIGHT_HI)` =
  `range(0.34, 1.02)`, one draw either way, so **every blade position is
  bit-identical** and only heights move. Measured meadow envelope through the
  instance matrices: **0.45–1.84 m** (the 0.45 floor is the broad variant's
  0.74 multiplier; the fine turf runs 0.61–1.84) — knee-high to chest-high,
  spread 1.22 m against the old 1.06, mean within a centimetre of the old
  meadow's. The raise is carried by the top of the envelope and the tall
  variant, so the meadow reads lusher instead of walled.
- `FOREGROUND_CLUMPS` is `Reef`'s and untouched: at `heightScale` 2 its top
  end is 3.67 m now against 3.63 m before — the frame-crop contract holds at
  the same envelope. Sanctuary clumps (1.0–1.2) likewise unchanged in shape.
- **New TALL variant**: a second blade geometry — slimmer (0.17 against
  0.26), 2.3 m of arc standing ~2.06 m vertical, bowed in a gentle S (0.7 rad
  peak with the tip hooking back through vertical in the last quarter), twist
  0.75 — on a second `InstancedMesh` hung as a **child of `mesh`**, because
  both callers add only `mesh`. Grass draws: 2, inside its 1–2 budget.
- Mixed into the patches at ~15%: every patch blade draws one sibling
  decision from the tall stream (measured **147 siblings of 960 blades,
  15.3%**), planted at the meadow's own drawn position, through the same
  clearance ring (`CLEARANCE_SQ`), in the patch's own palette family. All new
  draws from `SEEDS.tallGrass` via `seed ^ SEEDS.tallGrass` — the file's own
  side-stream trick, so `SEEDS.grass`'s draw order is bit-untouched and the
  sanctuary room gets an independent tall stream for free. Sway idiom
  unchanged: shared `uSway`/`uWind` uniforms, the tip divisor is the only
  number that differs (`TALL_HEIGHT`).

## 2. Real bushes (Seaweed.ts)

New `seaweed-leafy` layer, third and last silhouette in the module:

- **Geometry**: 16 curved, cupped leaves in three rings (skirt 7, tier 5,
  heart 4) merged into one clump — 256 tris per clump, 16 tris per leaf.
  Cupped normals ride a centre column per leaf (a flat leaf catches one toon
  band; that is the "flat plastic" failure growing back at bush scale).
- **Budget**: 48 instances × 256 = **12,288 tris ≤ 18,000** ceiling. One
  added draw call: seaweed total 3, inside the ≤ 6 budget.
- **Sizes**: three bands (≈ half small, a third mid, a sixth large), measured
  through the matrices **0.50–1.19 m** against the brief's 0.5–1.2.
- **Colour**: deep-green tones (darker than the meadow — bushes are the
  shadow mass of the undergrowth layer), warm undersides written into the
  vertex paint as a multiplier (root-warm 0.41 → crown 1.04, max 1.037; the
  module's existing accents run to 1.1). The per-instance colour still owns
  hue, with the same per-instance spread the cushions and fronds use.
- **Placement**: the module's own `scatter` over `CoralField.isClear`,
  unchanged — crevice rings, mound rings, corridors and the anemone disc all
  carry. Gentle sway (half the fronds' amplitude) plus the shared leaf-glow
  injection; `trackSunView` like its siblings.
- **Stream**: everything from `SEEDS.bushes` — geometry first, then
  placements. The lobed cushions and rosettes did not move a number, and
  `seaweedBushGeometry`/`seaweedRosetteGeometry` are bit-identical for
  `CorridorDressing`.

## 3. Coral GLB uplift (CoralShapes.ts + Blender)

`CORAL_MODELS` now names five kinds: `staghorn`, `brain`, **tube, fan,
branch**. The swap machinery in `CoralField` needed no edits. The procedural
kinds remain as fallbacks and the no-assets build stays healthy — the garden
tests build it in Node where no GLB ever loads.

### GLB contract, measured (`inspect_glb.mjs` + `GLTFLoader.parse` in Node)

| kind | tris | budget | frame (bounds) | COLOR_0 (ushort normalized) | passes |
|---|---|---|---|---|---|
| tube | 1520 | 2500 | y ∈ [0, 1], x/z centred | 0.099–0.832, warm throat | 2 |
| fan | 1200 | 2200 | y ∈ [0, 1], x ±0.56 | 0.873–1.000, neutral | 2 |
| branch | 625 | 2600 | y ∈ [−0.71, 0.71], x/z centred | 0.516–1.000, tips at clip | 3 |

All three: POSITION/NORMAL/TEXCOORD_0/COLOR_0 present, COLOR_0 only darkens,
no materials in the files, species hue stays with the instance colour.

- **tube** — 8 organ pipes out of one holdfast (varied heights 0.42–1.0,
  near-parallel walls, trumpet only in the last sixth, 7-lobe fluted lips,
  3% vertical "breathe" so no tube is a true lathe), throats folding down to
  a warm cone. The W-N5 rules carried over: no cream rim (exterior tops at
  perceived 0.92 = 0.832), the throat leans red as it deepens.
- **fan** — the one design constraint the brief's registration order creates:
  `CoralField` swaps **geometry only** and the fan's material (lace sheet,
  `alphaTest` 0.45) is pinned. So the GLB is **5 layered panels**, each
  mapping the whole lace sheet 0..1 exactly as the stand-in quad does (one
  mirrored, two UV-nudged): the lacy margin stays in alpha where it always
  was, and the geometry adds the one thing a quad cannot — parallax. Cupped
  (0.12–0.18 per layer), height-staggered 0.84–1.0, fanned ±0.23 rad.
- **branch** — an elegant antler frond (one stem, four long upcurved tines
  with mid-joint arcs, seeded wobble) replacing the bare capsule, distinct
  from the staghorn's fat thicket. Skin-tree idiom per the staghorn, then a
  deliberate `subsurf 0`: the subdivided hull collapse-floored at 2014 tris
  (measured twice — ratios 0.6 and 0.35 identical, the AGENTS note about
  decimate floors confirmed again), which is ~471k tris across the reef's
  ~234 finger instances. At 625 tris the arcs and forks — the sculpted part —
  survive at 146k; what is given up is cross-section roundness on tines a few
  centimetres thick, sub-pixel where fill heads stand.

### The branch could not take the unit footprint — stated plainly

Every modelled kind but one shares the unit footprint (1 m, foot at 0), and
the tests say so. The branch is the exception and the reason is frozen code:
`CoralField.addBranching` composes each finger around `CapsuleGeometry(0.16,
1.1)` — 1.42 tall, **centred** at the origin — and a GLB authored on a z = 0
foot would land 0.72 of its scale above where the capsule stood. Every finger
in the garden would float 0.3–0.9 m in **every** build, assets or not. So the
GLB and its rewritten stand-in are both authored in the capsule's frame
(y ∈ [−0.71, 0.71]), `CoralShapes`'s header states the exception, and
`coralGarden.test.ts` asserts the capsule frame explicitly rather than
borrowing the unit-footprint wording. Tube and fan took the unit footprint;
their stand-ins already had it.

The branch stand-in is also new: five welded prongs (150 tris) matching the
GLB's silhouette in its frame, and it now **carries vertex paint** — the
capsule had none, and `CoralField` builds the material's `vertexColors` from
the stand-in at construction, so without it the GLB's `COLOR_0` would never
have reached the shader. Tips at exactly 1.0, the multiplier ceiling.

## 4. Budgets and honest arithmetic

Draw calls: garden unchanged (same buckets, ≤ 14 ✓ — the swaps replace
geometry in place); grass 1 → 2 ✓ (budget 1–2); seaweed 2 → 3 ✓ (budget ≤ 6).
Clearances: meadow/tall blades keep the 4 m crevice rings (test reads it back
on both meshes); bushes go through `isClear`; nothing new within 6 m of any
crevice or den. Toon materials only.

Per-piece budgets all met (61% / 55% / 24% of stated). The instance-multipled
deltas are flagged rather than hidden, because the fill layer multiplies hard:
tube ≈ 62 instances × 1520 ≈ **94k** (stand-in ≈ 11k), fan ≈ 74 × 1200 ≈
**89k** (stand-in ≈ 3k), branch ≈ 234 × 625 ≈ **146k** (new stand-in ≈ 35k,
old capsule ≈ 15k). Net garden addition ≈ **+300k tris** in the assets build
(plus 12.3k bushes, 2.9k tall grass). Fine on hardware GL; on the SwiftShader
QA raster (≈0.5 ms/1k tris) it is the line item the orchestrator should weigh
at the post-merge perf pass — the branch's subsurf-0 choice already traded
cross-section roundness for 325k of it back.

## 5. Test restatements (what moved and why)

- `seaGrass.test.ts`: determinism now covers `mesh` and `tallMesh`; new
  honest-number pins — meadow envelope 0.44–1.9 m with spread > 1.2; tall
  share 10–20% (measured 15.3%), tall blade < 0.2 wide where the meadow blade
  clears 0.2, 6 rows, S-curve (reach peaks one row below the tip), tip ≥ 1.9,
  instance scaleY 0.82–1.13; clearance test reads both meshes. The blade-shape
  pins (0.2 / 0.015 / 0.995) were not touched and still pass.
- `seaweed.test.ts`: two draws → three; new pins for the bush layer —
  ≤ 18,000 tris (measured 12,288), sizes 0.49–1.21 m, paint ≤ 1.1.
- `coralGarden.test.ts`: `CORAL_MODELS` keys → the five modelled kinds;
  unit-footprint list gains `fan` (tube was already there); `branch` gets its
  own capsule-frame assertion; the only-darkens multiplier test gains
  `branch` (tube excluded — its exterior tops under 0.8 by design; fan
  excluded — no vertex paint, silhouette lives in alpha);
  `hidingSpots.length` 5 → **≥ 5** — the wave-8 scaffold appends wing dens
  and the count belongs to the moray-dens worker mid-wave; the clearance loop
  covers every den present either way.

## 6. Verification

- `npm run typecheck` — clean.
- `npx eslint src/world/SeaGrass.ts src/world/Seaweed.ts src/world/CoralShapes.ts --max-warnings 0` — clean.
- `npx vitest run tests/seaGrass.test.ts tests/seaweed.test.ts tests/coralGarden.test.ts tests/reefSightlines.test.ts` — **45/45 green**
  (6 + 7 + 20 + 12). Sightlines hold: taller grass keeps the same clearance
  rings and grass is not in `obstructionMeshes`.
- Full `npm test` (once, at the end): **481/484 passing at verification
  time**. The 3 failures are all in other workers' mid-flight packages and
  none touch this package's files: `tests/abyssBiome.test.ts` (canyon-floor
  den pin), `tests/wingDens.test.ts` ×2 (golden-dwarf mottle, frost-moray
  spec resolution). An identical run minutes earlier showed 8 failures
  including `tests/mythicsW7.test.ts`'s OldCurrent, which its owner fixed
  between runs — expected wave churn.
- Blender: each coral built and inspected at least twice (tube ×2, fan ×2,
  branch ×3 — second branch pass is the decimate-floor measurement above).

## Flags

1. **+300k tris** in the assets build — see §4. Orchestrator's call at the
   perf pass; the per-piece budgets in the brief are all met with headroom.
2. **Branch frame deviation** — the capsule frame instead of the unit
   footprint, forced by the frozen `addBranching`; stated in `CoralShapes`,
   asserted honestly in the tests, §3 above.
3. The fan GLB is deliberately **conservative**: it cannot out-sculpt the
   lace material it is pinned under, so it layers panels rather than growing
   real lattice. If the critic wants a true geometric lattice fan, that needs
   a `CoralField` material branch (not this package's file) — noted, not done.
