# W3 ledger — Sea-Glass Cove, Ghost Reef, Current Run

Worker W3, wave 8. Three complete wing environments, one identity (the
painted toon reef), three emotions: playfulness, sorrow-to-recovery,
exhilaration.

## What was built

### Wing 6 — Sea-Glass Cove (`glass-cove`, az 3.51, floor −2.6) — playfulness

- **Glass pebble drifts** (2 draws, one shared material): the rubble idiom
  banked into drifts — 300 smooth-welded dodecahedra + 145 spheres in
  pastel aquas, seafoam, pinks and amber (weighted 32/30/20/18), per-instance
  value sparkle ×0.86–1.14 with a 12% "gem" minority at ×1.3. Tumbled glass
  is frosted, so the toon material carries a faint emissive (0.12, far under
  the bloom pass's 0.82) multiplied by the instance colour in-shader — each
  pebble glows its own pastel, the abyss polyps' chunk verbatim.
- **The grand drift** banks around the hatchling's den site: two lobes at
  r 38.2–40.8 and 40.8–42.2, largest and brightest glass, one lobe each side
  of the axis. Corridor: every mark in the wing keeps ≥ 3.0 m lateral off
  axis through r 30–46 (measured min 3.06 m, min 0.071 rad) — stricter than
  the 0.06 rad brief. Boulders fence with their own girth (3.1 + 0.62·scale).
- **Five glossy-pale boulders** (1 draw): the coral boulder geometry + skin,
  near-white with a whisper of the drift palette, ContactPatch ×5.
- **46 glints** (1 draw, Points): star sprites over the drifts, slow sharp
  twinkle (0.4–0.9 rad/s, cubed sine), becalmed to quarter-rate and 65%
  brightness under reduced motion via `update`.
- **Mood tables** tuned: clearest water of the three (densityGain −0.009),
  sun and fill lifted, backdrop nearly intact — the toybox lid.

### Wing 7 — Ghost Reef (`ghost-reef`, az 3.87, floor −4.2) — sorrow → recovery

- **Bleached coral stands** (6 draws): the garden's own kinds — staghorn,
  brain, plateStack, tube, branch, fan — 57 pieces in 17 stands strung along
  the live band. Two stands are staghorn-anchored by force (the dice drew
  zero on the first pass; the branching crown is the bleached reef's
  narrator and cannot be absent).
- **The story is spatial**: instance tints lerp bone → pastel (pink/gold/
  green) over r 41 → 46.5. Two bones (warm 0xefe9dc, cool 0xe8e8e2) so the
  bleaching reads as a field, recovery capped at 85% — soft, not a carnival.
  The seabed `paint` walks the same ramp (pale cool lift at the gate, warmth
  returning), and the staghorn/fan sway amplitude is computed *in the vertex
  shader* from each instance's world radius on the same ramp — dead-still at
  the gate, breathing at the far end, one draw call, never out of sync.
- **Corridor**: every stand ≥ 0.078 rad off axis through r 30–46 (measured
  min 0.078 rad / 2.77 m); gate corridor open — the two gate stands are
  single pieces on the sill's shoulders.
- **Mood tables** tuned milky: densityGain +0.016, colorScale [1.05, 1.13,
  1.11] (bright aqua haze, red held per the value key), backdropFade 0.42
  (the far end dissolves), sun −12% with fills brightened — grief lit flat.
- ContactPatch ×12 (staghorns, brains, plate stacks).

### Wing 8 — Current Run (`current-run`, az 4.23, floor −5.2) — exhilaration

- **Grass banners** (1 draw): 12 lines, 153 blades, each blade's bow baked
  at 1.3 rad (the meadow's integrated arc pushed to a streaming lean) and
  every instance yawed onto the wing axis — the whole stand lies over
  downstream. Sway shader amplitude scales with world radius (0.10 → 0.32):
  the run gets wilder the further you ride it.
- **Bubble streams** (1 draw): 4 lines × 16 rings tearing down-channel at
  2.4–3.8 m/s (10× the reef's vent bubbles), hugging 1.9–3.1 m over the
  dropping floor, scale-enveloped at both ends. Camera facing grabbed in
  `onBeforeRender` (the `trackSunView` compromise). Third-speed under
  reduced motion — the same shared clock becalms banners and streams.
- **14 streamlined stones** (1 draw): smooth ellipsoids aligned to the flow
  (yaw jitter ±0.12), pale blue-grey, ContactPatch ×14.
- Channel centre kept open: all floor pieces ≥ 1.9 m off axis (measured).
- **Mood tables** tuned rushing-clear: densityGain −0.012, backdropFade
  0.08 — speed needs a far end you can see.

## Numbers (measured, Node)

| wing | draws | tris | instances | contacts | corridor min |
|---|---|---|---|---|---|
| glass-cove | 4 | 16 240 | 445 | 5 | 3.06 m / 0.071 rad |
| ghost-reef | 6 | 10 204 | 57 | 12 | 2.77 m / 0.078 rad |
| current-run | 3 | 4 228 | 220 | 14 | (no den; centre ≥ 1.9 m) |

Budgets: ≤ 10 draws, ≤ 30 000 tris per wing — all comfortably inside.

Seeds: only `SEEDS.wingGlassCove` / `wingGhostReef` / `wingCurrentRun`
(+ `^` substreams per layer), every draw synchronous at build; nothing
loads. Determinism is tested by double-build comparison of every instance
matrix, instance colour and point buffer.

## Verification

- `npm run typecheck` — W3 files clean.
- `npx eslint <w3 files> --max-warnings 0` — clean.
- `npx vitest run tests/wingsW3Flora.test.ts` — **23/23 green** (determinism,
  wedge confinement, blend > 0.5 in the live band, feet on seabed, budgets,
  both corridor clearances, grand-drift placement around r 38–42, the
  ghost-reef bone→colour story, the channel's open centre).
- `npx vitest run tests/wings.test.ts tests/seabedRelief.test.ts` — green.
- `tests/abyssBiome.test.ts` — **fails, not ours**: "keeps the fifth hiding
  spot" expects 5 hiding spots, gets 9 (4 frozen + canyon + the scaffold's
  4 pre-wired `WING_DENS`). The dens are the dens worker's / orchestrator's
  territory (`WingDens.ts`); my flora touches nothing in `Reef`.
- Full `npm test` (run once): 329/333 tests green. Failing files all belong
  to other mid-flight territories: `coralGarden`, `corridorDressing`,
  `reefSightlines`, `seaweed` (asset uplift), `wingDens`, `abyssBiome`
  (dens), `wingsW5Flora` (W5), `w11-probe` (W11), `fauna`/`lifeSystems`
  (anemone–clownfish uplift). During my session `Seaweed.ts` was transiently
  broken (`leafyBushGeometry` undefined) and was fixed by its owner mid-run.
  None of these import or depend on W3 files.

## Flags

- **Placement rule discovered**: the live floor band (blend > 0.5 ∧ corridor
  fence) is a *narrow ribbon* — 0.11 m wide at r 34 widening to ~2.2 m at
  r 46 for a 3 m fence. Cluster-style placement (spreads in x/z) cannot fit
  it. All W3 pieces therefore place *individually*: each draws its own radius
  and its own lateral inside the analytic window (`floorWindowHalf` in
  `W3FloraKit.ts`), so the corridor and blend contracts hold by construction
  and are asserted piece-by-piece in `tests/wingsW3Flora.test.ts`. Other
  wing owners planting near their gates with metre-scale cluster spreads
  will hit the same arithmetic.
- **Linear-space tints**: instance colours land in linear working space;
  channel spreads of authored sRGB tints widen (the warm bone measures
  0.155, not 0.074). The recovery test's thresholds are written in the
  measured space.
- **`createToonMaterial` has no `alphaTest` option** — the ghost fan sets
  `material.alphaTest = FAN_ALPHA_TEST` after creation (CoralField's own
  pattern).
- No cast shadows anywhere in the three floras (smallwork rule); grounding
  is ContactPatch + the seabed bake.
