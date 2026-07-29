# W5 — Ice Grotto, Sargassum Sky, Sandfall Dunes

Three complete environments, one identity (toon ramps, gouache values, nothing
near black), three emotions: hushed crystalline calm, dreamlike inversion,
meditation. All geometry is built in world space off the wing's own
pre-registered stream, every foot rides `seabedHeight`, every placement is
confined by `wedgeHalfAt`, and every moving thing becalms under
`reducedMotion`.

## What shipped, and why

### Ice Grotto (`ice-grotto`) — 5 draws, 8,148 tris, 10 contacts

- **Crystal spires** (`SEEDS.wingIceGrotto`): 23 spires in six clusters at
  r 38–47.5 flanking the corridor, the canyon ghost-kelp's staging. One
  authored lathe profile at six segments, exploded to face normals — the
  facets live in the geometry, so the material stays the project's one
  smooth toon ramp. Violet-at-the-base bake (rgb 0.52/0.50/0.78 — red above
  green, per the value key) under pale blue-white instance tints; faint cold
  emissive 0.10, far under the bloom floor.
- **Shards** (`^0x1ce5`): the gate dressing — four jamb groups at r 33–34,
  alternating sides, lane fully open — plus broken crystal at the clusters'
  feet.
- **Icicles** (`^0x1c1c`): 34 of the same crystal flipped point-down, hung
  from the grotto's 5.5 m roof and embedded 0.2 m into it, so the ceiling
  reads as grown through from above.
- **Frost rosettes** (`^0xf407`): 30 pressed-pale rosettes at the wall feet.
  The seaweed rosette idiom regrown locally — the first cut imported
  `seaweedRosetteGeometry` from `Seaweed.ts`, which another package broke
  mid-edit at 03:30 (mangled comment, esbuild failure); no wing's flora
  should build against a module it does not own during the wave, so the
  rosette is inlined and frost-specific (8 straps, broader, flatter).
- **Glitter** (`^0x9117`): 120 additive points, the only movement in the
  wing — twinkle rates 0.12–0.4 Hz (the bowl's motes run 0.5–1.4), quarter
  rate under reduced motion. Cold that reads as stillness, not hostility.
- **Corridor law, kept by construction and swept by test**: no vertex within
  0.06 rad of the axis for r 30–46 (W6's frost-moray den sits at r 41,
  across 0.025); a stricter 0.075 rad across the gate band (r 30.5–34), and
  the doorway is dressed but verified open.

### Sargassum Sky (`sargassum-sky`) — 3 draws, 4,298 tris, 0 contacts

- **The canopy** (`SEEDS.wingSargassumSky` + `^0xca09`): 130 broad
  amber-gold pads at y 8.0–9.5 plus 64 dangling strands, merged into one
  world-space geometry — the kelp W-N2 canopy-pad idiom hung overhead:
  per-pad outline (margin wave, cup, sag — no cloned silhouettes),
  `aPhase`/`aReach` sway in two lines of GLSL, the shared
  `injectLeafGlow`/`trackSunView` sun-through-the-leaf term with a timid
  amber backlit tint. The ceiling is the scene; looking up is the point of
  the wing.
- **Light patches** (`^0xda99`): seven soft amber pools drifting ±0.55 m on
  the sand — the abyss moon-pool idiom, instanced, one draw.
- **Tufts** (`^0x7af7`): 22 sparse straw tufts. The floor is deliberately
  unremarkable; a busy floor under a busy ceiling is two scenes fighting.
- **The turtle's volume is empty by construction and by test**: pads at
  y ≥ 8 (worst sag ≈ 0.93 m, sway ±0.05 → ≥ 7.0), strand tips clamped to
  y ≥ 6.3, everything else on the sand. Nothing enters r 38–46, y 4–6.
- Every element's across-window is sized from its own drawn footprint (pad
  semi-diagonal, strand curl, patch drift + sprite half-extent) — the one
  confinement failure the test caught (a 2.9 m pad at r 43.4) and the fix.

### Sandfall Dunes (`sandfall-dunes`) — 4 draws, 5,848 tris, 30 contacts

- **Ridge stones** (`SEEDS.wingSandfallDunes`): 30 smooth pale lathed stones
  along both wall feet, r 34–48.5, elongated along the radial — the reef's
  stones are roughed; dunes wear smooth, so there is no roughing pass at
  all. Warm cream vertex bake. One contact patch each.
- **Sandfall curtains** (`^0x5a1d` for placement, same seed for the baked
  fbm streaks): three falls at r ≈ 38/42/46, alternating walls — vertical
  ribbons flush to the dune lips whose side/lip/floor fades and vertical
  streaks are all baked into four-component vertex colours (UV-less, per
  the brief), warm cream, normal blending, fogged like the water they hang
  in. They never move; they are the stillness the streaks play against.
- **Falling streaks** (`^0x57ea`): 108 elongated crossed quads in one
  InstancedMesh — the bubbles' billboard idiom inverted downward (lip →
  floor at 0.22–0.4 m/s, birth/fade envelopes, recycled, pre-spread so the
  first frame already hangs). Two crossed planes per streak because
  `WingFlora.update` is handed no camera — the abyss light columns'
  solution. Under `reducedMotion` the system freezes mid-fall and dims to
  opacity 0.15: the faint static veils the brief allows, and the test holds
  the freeze (matrices bit-identical) and the dim both ways.
- **Pebbles** (`^0x9ebb`): 44 warm pebbles at the stones' feet. The centre
  of the bowl is kept bare: this is the wing a player goes to think in.

### Defs (owned fields only — azimuth/carve/wedge/ceilings untouched)

- **Ice Grotto**: fog density 0.011, backdropFade 0.36, sun 0.14, ambient
  0.16 — pale and cold, never dark; the brightened fill keeps the low roof
  from reading as a cave. `paint`: frost dusting, strongest low
  (rgb ≤ 1.015/1.045/1.095), null under blend 0.02.
- **Sargassum Sky**: fog to [1.05, 0.93, 0.55], backdropFade 0.45 — golden
  gloom under the weed roof. `paint`: amber wash (1.055/1.022/0.955).
- **Sandfall Dunes**: fog density 0.009, backdropFade 0.34, ambient 0.06.
  `paint`: warm cream lift (1.045/1.018/0.97).
- All paints are pure, identity at the wedge edge (tested), and write only
  through the one `bakeWingPaint` channel.

## Budgets (measured, not guessed)

| wing | draws | tris | budget draws | budget tris | contacts |
|---|---|---|---|---|---|
| ice-grotto | 5 | 8,148 | ≤ 10 | ≤ 30k | 10 |
| sargassum-sky | 3 | 4,298 | ≤ 10 | ≤ 30k | 0 |
| sandfall-dunes | 4 | 5,848 | ≤ 10 | ≤ 30k | 30 |

No `castShadow` anywhere; no GLB/texture loads (all `DataTexture`
procedural, so the no-assets build and the Node tests get everything);
materials are `createToonMaterial` for every lit surface, `MeshBasicMaterial`
only for the additive/veil accents in the established idiom.

## Verification

- `npm run typecheck`: **my files clean.** The run also shows mid-flight
  errors in files owned by other workers (`AnemoneGarden.ts`,
  `Clownfish.ts`, `OldCurrent.ts`) — not mine, not touched.
- `npx eslint src/world/wings tests/wingsW5Flora.test.ts --max-warnings 0`:
  clean.
- `npx vitest run tests/wings.test.ts tests/wingsW5Flora.test.ts
  tests/seabedRelief.test.ts tests/abyssBiome.test.ts`: **47/48 green.**
  wings, wingsW5Flora (13 tests), seabedRelief all pass. The one failure is
  `abyssBiome.test.ts`'s `hidingSpots` length assertion (5 → 9): W6 landed
  the four wing dens mid-flight and owns that assertion. Unrelated to W5.
- Full `npm test`: not run — the shared tree is mid-flight (see typecheck
  note); the orchestrator's post-merge full-suite pass is the right moment.

## Flags for the orchestrator

1. **`Seaweed.ts` was broken mid-edit at ~03:30** (mangled doc comment,
   esbuild transform failure). It cost the W5 rosette its import — now
   inlined — but any other consumer of `Seaweed` was unbuildable in that
   window.
2. **`abyssBiome.test.ts` needs W6's `hidingSpots` assertion updated** to
   the post-dens count (5 bowl + 4 wing = 9).
3. **Mid-flight typecheck errors** in `AnemoneGarden.ts`, `Clownfish.ts`,
   `OldCurrent.ts` at 03:33 — presumably their owners are still landing.
4. **Ice-grotto flora at r < 35.5 is thin by design** (rosettes start at
   r 35, spires at 38): the wedge near the gate is too narrow to hold both
   the corridor fence and any real footprint, so the gate band carries only
   the jamb shards. If the critic wants more depth at the gate, the answer
   is taller jamb crystals, not looser fences.
5. **Sargassum pads near the gate sit near the axis** — their confinement
   window shrinks with r, so small-r pads clamp toward the centre. Overhead
   and out of every corridor, it reads as the canopy gathering over the
   doorway; noted in case the critic reads it as bunching.
