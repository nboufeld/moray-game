# W9 — Lantern Leviathan & The Island That Swims

The wave's two flagship mythics, end to end: Blender GLBs (three builds
each — one plus two critique refinements), runtime systems, discovery
targets, codex plates, tests. Every measured number below is off
`node tools/blender/creatures/inspect_creature.mjs`, not the build scripts.

## Asset contracts (CREATURES.md-style)

### creature-lantern-leviathan.glb — the Lantern Leviathan

| | measured |
|---|---|
| verts / tris | 1977 / **3393** (budget 6000) |
| bounds (m) | x ±2.6656 (fluke span 5.33), y [−1.838, 1.590], z [−7.020, 7.100] |
| body length | **14.12 m** nose→fluke-tip; pivot at mid-length, faces **+Z**, +Y dorsal, +X the animal's left |
| joints | `root` at origin; **`fluke`** at glTF (0, 0, −5.400), local +Y → **(1, 0, 0)** (model +X): `rotation.y` is the whale's vertical stroke, 307 verts; **`pectL`** at (0.950, −0.200, 2.590), local +Y → **(0, 0, 1)** (body-forward, the turtle idiom): `rotation.y` rolls the fin, 49 verts; **`pectR`** at (−0.950, −0.200, 2.590), same axes, mirror-drive with negated angle |
| WEIGHTS_0 | sums to exactly 1.0 on every vertex |
| UV | u ∈ [0, 0.98], v ∈ [0, 1] — parametric only (u mirrored around the flank: 0 belly, 0.5 spine; v rostrum→peduncle). No painting exists or is wanted |
| COLOR_0 | VEC4 ushort normalized; r [0.0137, 1.0] mean 0.355, g [0.0116, 0.694], b [0.0103, 0.645]. Deep slate-blue body (sRGB 0.235–0.545, **never black**), pale blue-cream ventral pleats (grooves rippled into the section AND painted), darker mouth seam, dark eye beads with pale brows, and **rows of warm gold lantern studs** (sRGB 0.93/0.66/0.24 with 1.0/0.85/0.50 hearts) — two flank lines per side plus the dorsal ridge, bright values that read as lights without emissive |

Built by `tools/blender/creatures/build_lantern_leviathan.py`; jitter from
one fixed `random.Random(0x1A273E0)`, so a rebuild is bit-identical.
Preview turntables: `visual-qa/atelier/lantern-leviathan-wave8{,-it2,-it3}-*.png`.

### creature-island-turtle.glb — The Island That Swims

| | measured |
|---|---|
| verts / tris | 1816 / **3172** (budget 6000) |
| bounds (m) | x ±3.150 (flipper tips), y [−0.341, 1.484], z [−2.740, 3.510] |
| carapace | **4.50 m** (z ∈ [−2.25, 2.25] + caps), 3.24 m wide, worn low dome; pivot at carapace centre; the plastron bottoms at y = −0.341 |
| joints | the visitor turtle's idiom, scaled: **`head`** at glTF (0, 0.150, 2.100), local +Y → **(1, 0, 0)**: `rotation.y` nods (local +Z → model +Y, so `rotation.z` yaws), 121 verts; **`flipperFL/FR`** at (±1.340, −0.060, 1.160) and **`flipperBL/BR`** at (±1.060, −0.060, −1.350), local +Y → **(0, 0, 1)**: `rotation.y` is the stroke's roll, 43 verts each; FR/BR drive negated |
| WEIGHTS_0 | sums to exactly 1.0 on every vertex |
| UV | u ∈ [0, 0.95], v ∈ [0, 1] — parametric only, documented for completeness |
| COLOR_0 | r [0.0152, 0.839] mean 0.426, g mean 0.313, b mean 0.139. Ancient **olive-and-amber** shell (amber vertebral ridge and long scute hearts over dark-seamed olive plates), worn cream marginals, ivory plastron; sage skin with throat wrinkles; the **garden authored in**: moss mats (flattened lifted patches, olive-edged so they sit IN the shell), coral-rose knobs with pale tips, golden sargassum tufts crowning the spine |

Built by `tools/blender/creatures/build_island_turtle.py`; scatter from one
fixed `random.Random(0x151A4D)`. Turntables:
`visual-qa/atelier/island-turtle-wave8{,-it2,-it3}-*.png`.

## Runtime behaviour

**LanternLeviathanSystem** (`src/creatures/mythics/leviathan/`) — a rare
crosser, self-contained in the `VisitorSchedule` idiom (the visitors'
director is a closed union of kinds, so no registration there):

- Schedule stream `SEEDS.mythLeviathan`; paths on the `^ 0x9a71` substream.
  All draws at construction, before any async. First pass 120–240 s in,
  then 240–420 s of empty water; `beginPass(secondsIn)` kept as the
  deterministic QA force-hook. Four pre-rolled arcs, cycled per pass.
- Arc (`LeviathanArc`): azimuth sweep behind the wings from past the
  Sandfall (6.39 + 0.16–0.30) to past the Open Blue (5.31 − 0.18–0.32),
  radius 54–60 with ONE deliberate dip clamped to **r ≥ 52.5** landing
  exactly on the Open Blue axis, y clamped to **6.2–9.8**, 0.95 m/s →
  ~90 s crossings. Measured per arc: min distance to the end-wall anchor
  (r 50, on-axis, y 8) ≈ 2.5–5.5 m (test asserts ≤ 13; head point ≤ 14 —
  the scanner's own reach).
- Fluke beat 0.09 Hz / 0.13 rad, pectorals trailing 1.1 rad; bank ≤ 0.1 rad;
  reducedMotion halves all of it. Target rides the head crown (0, 0.9, 5.6);
  parked at **y −60** between crossings. The pass advances the frame it
  begins on — no origin-standing tick.

**IslandElderSystem** (`src/creatures/mythics/elder/`) — a resident, always
on stage (the transient-cost promise is the leviathan's; this one IS the
place):

- Circuit (`ElderCircuit`) from `SEEDS.mythElder`, drawn at construction: a
  closed integer-harmonic loop around the Sargassum axis (6.03), radius
  38.3–45.7, azimuth ±0.097 rad (wedge walls ±0.149 there), y 4.3–5.7,
  0.32 m/s → **~70 s** circuits (test asserts 55–85).
- Stroke 0.15 Hz (front 0.30 / back 0.16 rad, back lagging 0.9); nod 0.04.
- The gaze: within 13 m and diver speed < 0.6 m/s, the head turns toward
  the diver — rate-limited 0.55 rad/s (halved under reducedMotion), yaw
  clamped ±0.7, pitch ±0.35, slow release back to centre. Target on the
  head crown (0, 0.42, 2.85), driven per frame.
- Skeleton rebuilt from the measured table above (`SkinnedBody.ts`, shared
  with the leviathan, factoring `Turtle.ts`'s proven adoption idiom).

Both: procedural fallback stand-ins in the authored palette (pivot groups
exactly where the GLB joints stand, so one stroke drives either body),
`createToonMaterial` only, `vertexColors` flipped on only when the GLB
lands (the missing-attribute-renders-black trap), shared-geometry-safe
disposal, canvas-painted codex `portrait` plates (null in Node).

## Verification

- `npm run typecheck` — clean for every W9 file.
- `npx eslint src/creatures/mythics --max-warnings 0` — clean.
- `npx vitest run tests/mythicsW9.test.ts tests/wings.test.ts` — **24/24
  green**: determinism (frame-for-frame, both beings), fallback-without-window
  health + toon-only materials, leviathan schedule windows + body bounds
  (r ≥ 52, y 6–10 every frame of 25 simulated minutes), per-arc bounds and
  nearest-pass geometry, elder circuit wedge/y/radius bounds, target parking
  and riding, gaze non-jump.
- Full `npm test` once at the end: 459/462 passing. The failures are all in
  other workers' mid-flight files, none W9's: `tests/wingDens.test.ts` (2),
  and flapping between runs `tests/mythicsW7.test.ts` (4) /
  `tests/abyssBiome.test.ts` (1). `npm run typecheck` likewise reports 3
  errors in `serpent/OldCurrent.ts` and `sovereign/CrownSovereign.ts` —
  W7's files, noted here per wave discipline.

## Turntable self-critique (what the iterations fixed)

- **Leviathan it1 → it2:** dorsal fin invisible (raised 0.52→0.74, swept);
  fluke had no centre notch (carved the trailing root edge — the strongest
  whale cue there is); lantern studs read white, not lit (deepened to
  0.93/0.66/0.24 gold with hot hearts, enlarged ~30%); eye invisible
  (widened to a deliberate bead + pale brow); pectorals stubby (2.05→2.6 m).
- **Leviathan it2 → it3:** notch too deep (0.46→0.34, swallowtail → whale);
  pectorals angled too steeply down to read as wings (drop 0.72→0.55);
  lanterns still washing out under the atelier key (deepened once more —
  in-game the ramp holds the hue).
- **Elder it1 → it2:** moss mats were rings tilted OUT of the dome (frame
  bug — they read as dark holes; rebuilt on the true tangent frame);
  garden invisible (mats 9→12, knobs 15→22 and larger, tufts taller and
  golden-tipped); moss darker than the shell it sits on (lightened);
  vertebral ridge banding like a barcode (softened seam contrast).
- **Elder it2 → it3:** scute hearts were polka dots (long elliptical
  hearts + dark plate seams on the vertebrals' own grid — reads as worn
  plates now); knobs still pips (0.08–0.14 → 0.10–0.16 m radius).

## Flags

- None for W9. Budgets land at 3393/6000 and 3172/6000; the headroom is
  deliberate — these two are seen huge and close, and smooth rings beat
  spent triangles.
- The leviathan shares no stream with anything; its `^ 0x9a71` substream
  is its only `^` use.
- The elder imports `SkinnedBody.ts` from `../leviathan/` (both W9-owned);
  no shared file was touched.
