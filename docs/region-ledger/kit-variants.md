# Kit Variants — critic punch #9 / C2 (and the #17 ruling)

Worker: KIT VARIANTS, branch `fix/kit-variants`. The critic's prescription,
verbatim: *"buy two more silhouettes per kit slot before buying anything
else."* Deployment law from the brief: **no re-roll** — every placement,
scale and rotation in the world stays byte-identical; only geometry
profiles swap.

## What the "double-lobe" actually is

The report's proof frames were re-shot before any change. The recognizable
"double-lobe potato" at `JOURNEY-golden-02` (Honey Gate jambs) and
`JOURNEY-calamity-09` (quiet-rim sentinels) is **not** the `BOULDER` lathe
profile — it is the two-segment `stackGeometry` idiom (a big ellipsoid
with a smaller one over it), which every province authors its
sentinels/jambs/teeth from. The "dark-shard tuft" that carries the smoking
and pale plains is the **`card`-profile carpet stubble** (one 4-tri bent
quad × 6,000), not the litter shards. Both diagnoses drove where the
silhouettes were bought.

## The deployment device (the no-reroll contract)

- **Rocks** (`src/world/RockShapes.ts`): every caller already passes a
  per-stone `seed` drawn from its own fenced stream. The variant index is
  a pure avalanche hash of that seed on a fresh XOR substream
  (`seed ^ 0x5eed_c2a6`, mulberry32 finalizer, **zero stream draws**),
  `% 3`. Placements are caller-side and untouched by construction;
  variant 0 is the original profile **byte-for-byte** (fixture-proven).
- **Carpets** (`src/world/regions/kit/CarpetField.ts`): an
  `InstancedMesh` carries one geometry, so siblings are baked as
  per-vertex position/normal **deltas** (`aKitFormB/C`, `aKitFormBN/CN`)
  on the base geometry and selected in the vertex shader by a
  per-instance `aKitForm` attribute — a pure hash of the call seed and
  the **instance index** (`seed ^ 0x0f0a_11ad`, again no stream draws).
  One draw, same triangle count, matrices byte-identical; the shared
  bounding sphere is inflated by the largest baked delta (honest bounds).

## New silhouettes per slot

| Slot | Original | Sibling 1 | Sibling 2 | Budget delta |
|---|---|---|---|---|
| boulder | friendly potato | split crag (concave collar, leaned head) | keeled stone (narrow crest, 0.32 r off-axis lean) | 0 tris, 0 draws |
| slab | overhung shelf | shelf-stack (two benched ledges, drifted) | prow (low wedge, gentler lean) | 0 tris, 0 draws |
| stack (sentinel idiom) | single-waist double lobe | collared spire (deep low collar, crown pinched 0.45) | cleft head (0.45-deep high notch, belly trim) | 0 tris, 0 draws |
| carpet `card` | bent quad | low hook (squat, bowed over) | kinked shard (snapped above ⅔) | 0 tris, 0 draws |
| carpet `tuft` (dark-shard slot) | crossed star | low fan (~70° sector, knee-high) | broken-tip cluster (three snapped shards) | 0 tris, 0 draws |
| carpet `blade` (blade-tuft slot) | crossed clump | arcing sheaf (one shared heading) | low splay (squat rosette, leader hooked past vertical) | 0 tris, 0 draws |

All lathe siblings stay inside the declared radius/height envelope (crag
≤ 1.0, shelf ≤ 1.02 like their originals; leans ≤ ⅓ radius), so caller
clearances, colliders and contact patches authored against the originals
keep their guarantees. Stack carvings are **multiplicative ≤ 1**
(shrink-only), preserving the `stackSpan` inside-the-measured-blocks
guarantee that colliders and `reefSightlines` rely on — asserted for all
three carvings in `tests/kitVariants.test.ts`.

Memory note (the only cost): formed carpet geometries carry 4 extra vec3
attributes (~45 verts × 48 B for a blade clump) plus one float per
instance; declared draws/tris are unchanged and `tests/kitGround.test.ts`
budget honesty stays green unmodified.

## Proof of no-reroll

`tests/kitVariants.test.ts` + `tests/fixtures/kitVariantPlacements.json`
(recorded against the pre-change tree at commit `4bcc723`, append-only):

1. Reference carpet builds (tuft/blade/card + shard litter): instance
   matrices byte-identical (FNV-1a×2 over the raw Float32 bytes).
2. Full region builds of golden-1 and calamity-1: every node transform
   and every InstancedMesh matrix buffer byte-identical, tree shape
   unchanged.
3. Rock sweeps (24 seeds × boulder/slab/stack): variant-0 picks reproduce
   the recorded geometry bytes exactly; sibling picks differ; both sets
   non-empty. Distribution over 240 seeds: every variant > 20%.
4. Per-instance forms: attribute matches the pure hash, every form > 20%
   of a 420-instance field, deltas real (> 0.15) and bounded (< 2),
   byte-deterministic across rebuilds.

Plus the standing gates: every region determinism / reroll-fence /
clearance / sightline suite. Two fence assertions needed a DECLARED
precision adjustment (`tests/regionGolden1.test.ts`,
`tests/regionSmoking1.test.ts`): they pin rock **geometry
boundingSphere centres**, a shape-coupled proxy for the stand position,
at sub-millimetre precision. A profile swap legitimately drifts a
centroid by millimetres-to-centimetres while the stand (the translate
inputs, byte-fixture-pinned) is unchanged — so those centre pins now
allow 5–50 cm, which still convicts any true reroll (stand jitter is
metres). Every InstancedMesh matrix pin in those suites stays at 1e-9.
All other region/wing/bowl suites pass unmodified: 72 files, 1142
tests.

## The three rounds

- **r1** (`visual-qa/kit/*_kitvar-r1.png`, world `*_kitvar-r1.png`):
  boulder/slab siblings + tuft/blade forms landed. Reads: variety real,
  but the split crag's symmetric collar read as two stacked buns (the
  lathe's notch runs all the way round — "snowman"); the rock line-up
  staging overlapped; the low-splay leader's hook was timid. World
  frames exposed the real finding: the cited gateposts/sentinels are
  stacks and hadn't moved — the punch's actual double-lobe lived there.
- **r2** (`*_kitvar-r2*.png`): stack carvings added (collared spire,
  cleft head); crag/shelf got leans (one cleaved stone, not two buns);
  splay leader lengthened and hooked earlier; line-up restaged with the
  sentinel row. Golden's two jambs split into two different monoliths
  (hash lands them on siblings 1 and 2). Quiet-rim moved but too subtly
  at fog distance — carvings judged too polite.
- **r3** (`*_kitvar-r3.png`): carvings cut deeper (collar 0.3 + crown
  pinch 0.45; cleft 0.45), and the card stubble gained its two forms
  (low hook, kinked shard) after the smoking roadside frame proved the
  "dark shard" spike parade is the card profile. Verdicts below.

## Before/after verdicts at the cited poses

- `JOURNEY-golden-02-wing-door` (punch #9 proof): **fixed.** Before: twin
  double-lobe jambs, identical to calamity's sentinels. After: left jamb
  a keeled monolith (collared spire), right a cleft-headed figure — two
  distinct stones, neither the potato. Frames:
  `20260802-0635_*_kitvar-before.png` → `20260802-0729_*_kitvar-r3.png`.
- `JOURNEY-calamity-09-sunken1-quiet-rim` (punch #9 proof): **fixed.**
  Before: four sentinels, one silhouette. After: the parade splits —
  original, collared spire, cleft head all present in one glance.
  `20260802-0638_*_kitvar-before.png` → `20260802-0728_*_kitvar-r3.png`.
- `CRITIC-smoking-marches-1-01-roadside-cross`: **improved.** The
  charcoal stubble now mixes straight cards, low hooks and kinked
  shards; the "identical dark-shard tufts" read is gone at pose range.
- `CRITIC-verdant-line-2-01/-04`, `CRITIC-pale-passage-1-01`:
  **variety deploys, frames still sparse.** The sprigs that ARE there
  now differ (sheaf/splay forms visible in the -04 foreground), but
  these stands are carried by pass-corridor emptiness (punch #2, network
  owner) and pale's dropped-prop disc (pale-1 owner) — not kit slots.

## Ownership rulings (ledgered per the brief)

- `src/world/RockShapes.ts` + `tests/rockShapes.test.ts` taken in scope:
  it is the shared rock kit (not a region or wing file), punch #9's
  named owner is "kit", and item 1 of the brief is impossible without
  it. No region or wing file was touched; `git diff --stat` holds to
  kit/kitdemo/RockShapes/tests/docs.
- **Punch #17 is OUT OF SCOPE for this worker, both halves.** Checked:
  the verdant-3 faceted canopy caps are built by
  `src/world/regions/verdant3/Verdant3Mesas.ts` (region-owned, its
  plateau-cap fans), and the hub kelp blade is `src/world/Kelp.ts` — the
  bowl's own forest module (bowl-owned, its own tests and probe
  harness), not a kit piece. Softening either from this seat would be an
  ownership violation; both need their owners (verdant-3 region worker,
  bowl/framework worker). Flagged to the orchestrator.

## Flags for the orchestrator

1. #17 needs re-assignment (see above) — the critic's "kit" owner column
   was a misdiagnosis on both cited surfaces.
2. The bowl/hub also consumes `boulderGeometry`/`slabGeometry`/
   `stackGeometry` (Reef pinnacles, hiding-spot-free placements), so the
   bowl's stones diversify too. `reefSightlines` and all bowl suites are
   green (stack carvings are shrink-only), but if the art seat wants the
   bowl's canonical postcards pinned exactly as they were, a follow-up
   could pin `SEEDS`-authored bowl stones to variant 0 — one-line per
   call site, region-owned.
3. The two calamity "extra leaning stones" (0x0f90/0x0f91) both hash to
   variant 0 — harmless here (the quiet-rim frame already mixes three
   reads), noted so nobody re-rolls seeds chasing them.
