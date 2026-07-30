# Kit quality pass — ledger (MASTER R12)

Branch `kit/quality-pass`. The owner's verdict on the first fill, verbatim:
*"it still feels super underwhelmingly empty, or at least what's been added
is not so great — some kind of half-cut grass everywhere, doesn't seem like
an added value at all."* Diagnosis (R12): the T1/T2 pieces were specified
ultra-cheap (4-tri cards, 8–16-tri tufts) and read as crude wedges at
swimming distance. This pass re-authors the close-range pieces with the
bowl meadow's craft (`SeaGrass`: integrated S-bend arcs, cupped
cross-sections via the row-frame construction, lanceolate tip taper, the
sun-through-leaf glow, value-first paint), BACKWARD COMPATIBLE: same
exported signatures, new option values, old values byte-identical.

**The compat fence, measured before anything was written**: verdant-line-1
ships at ~449.9k triangles against its own 450k test ceiling — 88
triangles of headroom. So nothing that an existing consumer gets by
default may add a triangle; every richness knob is opt-in, and default
improvements are same-topology reshapes and paint only. One consequence
is declared honestly under `bushBank` below.

All captures under `visual-qa/kit/*_q-r<n>.png` / `*_q-final.png`,
1600×900, camera 2–4 m (the judged swimming distance), every one LOOKED at.

## carpetField — the heart of the pass

- **Before** (`carpetField_a-final.png`, and the owner's own frames in
  rw-verdant1 `*v1-filled*`): card/tuft patches read as popcorn wedges;
  at 2.5 m the "half-cut grass" verdict is exact.
- **New profiles** (old `"card"`/`"tuft"` untouched — far-field tier):
  - `"blade"` — a 48-tri clump: an S-bent leader (the tall-grass return
    bow — out, over, hooking back past vertical) plus two shorter
    out-leaning siblings; 3-column cross-section carrying a 0.45–0.5 cup,
    lanceolate taper, per-blade bow/twist/lean/tone from the clump's own
    sub-stream; near profiles take a wider value jitter (0.78–1.1) than
    the far ones' contractual ±8%.
  - `"frond"` — a 60-tri rosette: five cupped straps, three drooping past
    horizontal (1.55–2.0 rad), two young upright straps a value step
    down (the shaded heart), soft-point taper.
  - `sunGlow?: boolean` — the SeaGrass W-L9 two-note translucency, ported
    into `KitGroundShared` (cited copy; direct import is illegal — the
    kit may not pull in the bowl terrain module SeaGrass depends on).
  - `looseShare?: number` — the F-R2 knob, default 0.3 ≡ the old value.
- **Critique rounds**: q-r1 tulip-fat, one-hue-wash, S barely reads →
  slimmer blades, harder bows, wider near-profile value jitter; q-r2
  grassy, judged close; q-r3 at true 2.5 m — leader twist raised, young
  frond straps calmed. **Verdict at q-final: painted eelgrass, no wedges;
  passes the R12 still-frame test.**
- **Budget shape**: 1 draw; 4/12/48/60 tris per card/tuft/blade/frond
  (tests assert each). 800 blade clumps ≈ 38k tris.

## bushBank

- **Before**: welded spheres — "smooth boulders" (a-r1 through a-final).
- **After**: `fronds?: number` (12-tri broad cupped leaves in the W11
  three-ring recipe: out-leaning skirt, mid ring, near-upright hearts —
  with spine twist so no leaf presents edge-on), `accents?: number`
  (8-tri berry/bud knots clustered in twos and threes on the palette's
  `accent` ink — painted values, nothing glows), `looseShare` (default
  0.22 ≡ old). Default lobes keep exact topology (36 tris each) but weld
  with radial elongation + wider squash spread, the swell knock-out
  raised 0.3 → 0.36, per-lobe tones widened to 0.78–1.0, and the
  crotch drop deepened 0.34 → 0.44.
- **DECLARED DEVIATION**: the brief asked for a "richer default"; the
  88-triangle verdant-1 headroom pins the default triangle count, so the
  richer look ships as the opt-in `fronds`/`accents` values (the R12.3
  region re-pass is where consumers opt in). The default still improves
  free of charge (silhouette reshape + paint).
- **Rounds**: q-r1 boulders with wire hairs → leaves not straps; q-r2
  sparse thorns → W11 shell placement; q-r3 half-shelled → denser rings,
  roots sunk; q-r4 close; q-r5 leaf twist + skirt lean soft. **Verdict:
  spring palette reads as leafy bushes with berry knots; wine reads as
  thorn-scrub — right for its dead-scrub consumers.**
- **Budget shape**: 1 draw; `lobes×36 + fronds×12 + accents×8` tris per
  bush (test-asserted). Rich 7/14/7 bush = 476 tris.

## groundLitter

- **After**: `"split"` shape (20 tris — one flat cleave plane against a
  worn faceted back, normals left faceted); shards chip at the +x end
  (pinch + downward shear + chip tint) so raked runs read as broken
  edges; `grade?: number` size hierarchy — clump-heart stones grow to
  ~×1.9, loose fill shrinks, derived from `heart`, a value the scatter
  already drew (`grade: 0` is proved byte-identical). Gravel/pebble/grit
  counts and streams untouched.
- **Rounds**: q-r1 shards papery → thicker (y 0.55→0.74), shear halved;
  q-r2 accepted grade + split; q-r3 final polish. **Verdict: anchored
  piles with formed foreground stones, facet and tone variety.**
- **Budget shape**: unchanged — 1 draw per tone family, 8–20 tris per
  stone ("split" 20).

## screeApron

- **After**: re-authored from one shared box to THREE slab families
  (worn strata slab / split wedge / thin flake, all 12 tris, corners
  weathered by position-keyed fbm so faces stay welded) baked into ONE
  merged world-space draw (the driftDebris idiom — instancing carries
  one geometry, and silhouette variety was the complaint). Foot-stacking:
  near the anchor slabs lift onto each other and tumble harder, easing
  to flat lone slabs at the toe; the toe favours blockier families while
  flakes pile at the foot (the size-graded scatter, at the fan's grain).
  Strata tones widened to 1.1/0.92/0.74.
- **Rounds**: q-r1 scattered paper → piles + thicker flakes; q-r2 planks
  at the toe → width floor raised, stack lift eased; q-r3 accepted.
  **Verdict: reads as slid rock piles seated against the wall foot.**
- **Budget shape**: 1 draw (merged Mesh now, not instanced — bounds on
  the geometry); still 12 tris per slab, 2×9 slabs = 216 tris asserted.
- No region consumes screeApron yet, so the shape change lands free.

## farGrassCards

- Geometry UNTOUCHED (far-field piece; it reads well where it belongs).
- `nearFade?: number` — a vertex-shader-only guard: cards within
  `nearFade` metres of the camera scale to nothing about their own root,
  regrown by 1.4×; no transparency, no sorting, buffers proved
  byte-identical. Unset ⇒ pre-R12 behaviour.
- **Rounds**: q-r1 in-field proof (8 m card-free foreground, blades own
  it); q-r2 grazing angle — cards grow in as low turf first, no 4-tri
  silhouettes near the lens; q-r3 judged pose. **Verdict: the piece can
  no longer sit in the foreground.**

## spongeCluster (judged crude at arm's length — improved)

- q-r1 at 2.3 m: clean lathe read as terracotta pipe. Fix: exterior
  vertices breathe ±8.5% on a tileable fbm keyed to angle-and-height
  (seam welded by the wrap; throat left a clean bore). Same topology —
  the W-N5 180-tri budget and the ported paint hold, test-asserted.
- **Verdict after 3 rounds: living waists and rim wobble; tubes no
  longer extruded.**

## percherColony (star body re-authored)

- q-r1/r2 at 2 m: the displaced icosahedron star rendered as a green
  pentagon blob — ~10 vertices per ring cannot carry five arm valleys.
  Re-authored as a polar dome: 20 spokes × 3 rings over a centre cap,
  radius modulated by the five-lobe profile, arm tips curling off the
  perch. **100 tris — inside the spec's 48–130 body band** (was 80);
  reference-set total 1200 stays exactly at the published cap.
- **Verdict at q-final: unmistakable five-armed cushion stars.**
- Flag: the `shrimp` body (~0.1 m) is sub-legible beyond ~1 m — it is
  ankle dressing (whelk trios at stone feet) and was left as is.

## Compat proof

- Old option values keep their placement streams and triangle counts by
  construction; the new tests PROVE byte-identity for every knob's
  opt-out: default ≡ `looseShare: 0.3` (carpet) / `0.22` (bush),
  `sunGlow` and `nearFade` move no buffer, `grade: 0` ≡ ungraded,
  `fronds: 0, accents: 0` ≡ the pre-R12 bush stream.
- Full suite: **54 files / 711 tests green**, including verdant-line-1's
  450k budget ceiling (88-tri headroom preserved), the pilot reroll
  fence, and its carpet byte-determinism.
- Deliberate look-only changes to existing consumers (no count/stream
  change): bush lobe reshape + deeper crotch, sponge wall undulation,
  litter shard chip, star body. These are R12.2's licence ("per-instance
  quality first") applied where it costs nothing.

## Gates

- `npm run typecheck` clean.
- `npx eslint src/world/regions/kit tests/kitGround.test.ts
  tests/kitLife.test.ts --max-warnings 0` clean.
- `npx vitest run tests/kitGround.test.ts tests/kitLife.test.ts`:
  92 tests green.
- `npm test`: 711/711 green (the compat gate).

## Capture index (all LOOKED at)

- carpetFieldBladeClose: q-r1..r3 + q-final
- carpetFieldFrondClose: q-r1..r3 + q-final
- bushBankClose: q-r1..r5 + q-final
- groundLitterClose: q-r1..r3 + q-final
- screeApronClose: q-r1..r3 + q-final
- farGrassCardsNear: q-r1..r3 + q-final
- spongeClusterClose: q-r1..r3 + q-final
- percherColonyClose: q-r1..r4 + q-final

(`visual-qa/` is gitignored, as with every prior package; the PNGs live
in the worktree.)

## Flags for the orchestrator

- KitTypes.ts did not block this pass; untouched.
- The bushBank "richer default" deviation above: richness is opt-in until
  the R12.3 region re-pass raises verdant-1's asserted ceiling.
- F-R2 `looseShare` also landed on `bushBank` (the field note named both
  pieces); `carpetField` and `bushBank` both expose it.
- The demo stage flags from the package-A/B ledgers (black stage sand /
  wall, overwritten dark mood) still stand; the q-* demos reuse the
  existing dressed-stage workarounds.
