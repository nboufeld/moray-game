# W1 ledger — Kelp Cathedral, Nursery Shallows, Lumen Garden (flora + mood/paint)

Worker W1, wave 8. Three wings' flora builders, their mood tables and wall
paint, one shared helper, one test suite. Nothing else touched.

## What was built, and why

### Wing 0 — Kelp Cathedral (`kelp-cathedral`, azimuth 1.35) — awe, hush

- **The nave**: 14 giant columns in two rows at seven radial stations
  (r 37 → 47.3) flanking a 6 m aisle down the axis, plus 2 younger sentinels
  on the gate's jamb slopes (r 31.4–32.6). Each column is the reef kelp's
  giant idiom stretched to the brief's 8–10.5 m (sentinels 5.4–6.8): lathed
  stipe (12 rings × 7 sides) on a two-harmonic S, 16–22 drooping straps
  spiralled 137° apart, an 8–12 ribbon crown, and 5–7 near-horizontal canopy
  pads — the vault overhead is a ceiling of leaf, not open water. Merged
  stalk mesh + merged leaf mesh (2 draws), the kelp forest's exact sway GLSL
  (reach 0.085, slower than the meadow), the SeaGrass translucency injection
  on the leaves, and a per-column contact patch.
- **Confinement by construction**: every column's lean points *along* the
  aisle (never across it), crowns droop hard (1.15–1.7) so horizontal reach
  pulls in as ribbons hang, straps shorten at the two gate-side stations
  (×0.8) and on the sentinels (×0.62), and sentinel straps are biased over
  the doorway (a green arch) rather than into the wall. The vertex sweep in
  the test holds every vertex to the wall angle + 0.02 rad.
- **God-light**: 4 additive crossed-blade shafts (r 38.6–46.9) on the
  canyon's light-column pattern — `fog: false`, baked ground fade against
  `seabedHeight`, per-frame edge-on fade on the worse of the two blade
  facings — warm-green (0.78/1.0/0.62), opacities 0.085–0.13, far under the
  bloom threshold. The two brightest land in merged additive pools on the
  floor (a beam that brightens nothing is a decal).
- **The floor**: 50–70 instanced moss pads (3–5 per column foot + 8 between
  the rows, folded out of the aisle's heart and off rim rock by construction)
  and 2–3 outward-lying fronds per column foot, merged into the leaf mesh.
- **Def**: mood keeps its sun (sun −0.18, hemi −0.26, ambient −0.08; emerald
  fog 0.60/0.90/0.68, +0.012 density). Paint: emerald cast on the low
  ground, moss staining 0.6–1.6 m up the wall feet, ±4 % mottle, identity at
  the wedge edge by the strata's own `smoothstep01(blend/0.35)` contract.

### Wing 1 — Nursery Shallows (`nursery-shallows`, azimuth 1.71) — tenderness, morning

- **Baby corals**: 12 broods (branch/boulder/polyp weighted 45/30/25), one
  pastel family per brood (rose/peach/cream/lilac), 5–9 members (8–14
  polyps), scales 0.2–0.45 of the garden's pieces (polyps 1.2–2.2 of their
  0.1 m sphere). Three InstancedMeshes in `coralSkin`'s own map+normal.
- **Grass tufts**: 24 tufts × 5–8 instanced bowed blades (0.25–0.55 m),
  SeaGrass-idiom sway (phase rides the instance matrix; one uniform per
  frame), morning greens a shade brighter than the reef meadow.
- **Gate jambs**: two small warm boulders at r 32.3–33.2 on the wedge's very
  edge — the only dressing near the gate.
- **Corridor contract (den at r 40–43 on-axis, another worker's)**: every
  flora instance ≥ 0.06 rad off the axis for r 30–46 — sampling fence 0.068,
  per-instance re-clamp 0.065 — and nothing at all on the r 30–34 gate floor
  (flora starts at r 35; jambs stand at `wedgeHalf − 0.022`). The test
  sweeps every instance against both rules.
- **Def**: the one rig that *gives back* light (sun −0.14, hemi −0.10,
  ambient −0.06; fog 1.13/1.09/0.99, −0.012 density — brighter, warmer,
  clearer). Paint: golden lift over the terrace, faint rosy blush wander,
  ±3.5 % mottle, identity at the edge.

### Wing 2 — Lumen Garden (`lumen-garden`, azimuth 2.07) — deep-night wonder

- **Polyp beds**: 9 beds × 9–13 instanced squashed domes (icosahedron 0.13
  detail-1, y×0.62), baked bud gradient, emissive 0.86/0.86/0.91 cyan at
  0.42 intensity shaped by `vColor` (the canyon polyps' chunk) so the
  per-dome tint — cyan family, indigo every third bed — colours the light
  itself. One additive halo point per dome tip (hot core + soft skirt,
  opacity 0.3, `fog: false`).
- **Lantern kelp**: ~19–27 short strands (1.3–2.3 m) by the beds and along
  the wall bases, merged ribbon mesh with a faint 0.12 emissive floor (the
  ghost-kelp rule: toon surfaces under this mood render as black quills
  without it), and one glowing bulb per tip (emissive 0.5, `vColor`-shaped,
  per-bulb tint) carrying the strand's own sway phase at full reach — the
  light never drifts off its stem. Heart-side strands bow *away* from the
  jelly's water; wall-side strands bow into open water.
- **Mote constellations**: 240 slow additive points (cyan/indigo/pale-green,
  Particles idiom — per-point twinkle in the colour attribute, drift read
  off a base field, reduced motion slows to 0.3×), folding out of the
  heart's cylinder by construction.
- **The heart stays clear**: nothing solid within 0.065 rad of the axis for
  r 39–45 (sampling fence + per-instance re-clamp + outward leans); motes
  keep a 2.9 m lateral fence. The Crown Jelly Sovereign's water is empty.
- **Def**: the deepest night (sun −0.85, hemi −0.70, ambient −0.22; indigo
  fog 0.30/0.24/0.55, +0.034 density, backdropFade 0.7). Paint: cooled
  indigo ground with a faint cyan lift at the floor where the beds' light
  pools, red held above green throughout per the value key.

### Shared

- `src/world/wings/flora/W1FloraShared.ts` — wedge basis/sampling, the
  `clampInsideWedge` fold (a member planted over the wall angle stands on
  rim rock metres above its floor; found by test, fixed once for all three
  wings), the merged-mesh sway injection and attributes. Named for the
  worker prefix; documented here per the brief's helper-module rule.

## Key numbers

| wing | draws | triangles | contacts |
|---|---|---|---|
| kelp-cathedral | 8 | 21 152 | 16 |
| nursery-shallows | 4 | 7 630 | 14 |
| lumen-garden | 5 | 10 670 | 9 |

(Budgets ≤ 10 draws / ≤ 30 000 tris per wing, asserted in the suite.)

Seeds drawn (and only these): `SEEDS.wingKelpCathedral` (^ 0x1eaf straps,
^ 0xca09 crowns/pads, ^ 0x4d05 moss, ^ 0x5af7 shaft yaw; textures ^ 0x1e /
0x51 / 0x90; paint ^ 0x3a11), `SEEDS.wingNurseryShallows` (^ 0x9a1e
families, ^ 0x6a55 grass; texture ^ 0xb1; paint ^ 0x51c3 / 0x2f),
`SEEDS.wingLumenGarden` (^ 0x1a7e lantern, ^ 0x40e5 motes; paint ^ 0x77c1).
All randoms drawn synchronously up front; no async loads anywhere (all
textures procedural via `buildColorTexture`).

## Verification

- `npx eslint src/world/wings tests/wingsW1Flora.test.ts --max-warnings 0` — clean.
- `npm run typecheck` — clean for all W1 files (see flags for other workers').
- `npx vitest run tests/wings.test.ts tests/wingsW1Flora.test.ts tests/seabedRelief.test.ts tests/abyssBiome.test.ts`
  — 56/57; the one failure is **not mine** (flags).
- `tests/wingsW1Flora.test.ts` (22 tests): determinism (two builds →
  bit-identical matrices/vertices/points), per-wing draw/triangle budgets,
  confinement of every instance/point/contact (wall angle − 0.001) and every
  merged vertex (+ 0.02 rad), the cathedral's aisle fences, the nursery's
  0.06 rad corridor and open gate, the lumen heart's clearance, update()
  in both motion modes, bounded mote drift under reduced motion.
- Full `npm test`, run once at the end: **458/462 pass**; the 4 failures
  are all other workers' mid-flight files (flags).

## Flags (not mine to fix)

1. **`tests/abyssBiome.test.ts` — `reef.hidingSpots` length ≠ 5.** The
   scaffold's `Reef` calls `addHidingSpot(wingDenPlacement(spec))` per
   `WING_DENS` entry; the dens worker's in-flight `WingDens.ts` (modified,
   +12 lines at this writing) now registers dens into `hidingSpots`, so the
   length-5 literal trips. Owner: the dens worker (or orchestrator at
   merge). Two further failures in their suite: `tests/wingDens.test.ts`
   (golden-dwarf pattern mottle, frost-moray spec azimuth).
2. **`tests/mythicsW9.test.ts`** — the elder's gaze travel (W9's creature).
3. **Mid-flight typecheck noise seen during the wave**: `Seaweed.ts`
   (`leafyBushGeometry`, since fixed by its worker), `mythics/serpent/
   OldCurrent.ts`, `mythics/sovereign/CrownSovereign.ts`. None in W1 files.
4. **Design coordination note**: the nursery's golden-dwarf den (W-dens
   worker) and the lumen garden's Crown Jelly (W-mythics) both rise inside
   my cleared corridors — nursery r 30–46 ± 0.06 rad, lumen r 39–45 ± 0.065
   rad / motes 2.9 m. If their specs move, the fences live in one function
   each (`corridorFence`/`clampToCorridor`, `gardenFence`/`clampOffHeart`).
