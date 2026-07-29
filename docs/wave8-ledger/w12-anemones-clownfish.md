# W12 — The anemone city and its clownfish trio

Owner complaint addressed: *"the clownfish are way too small and undiscernable,
the anemones they are hiding in are way too small."*

## What changed, and the numbers

**Anemones** (`src/creatures/fauna/AnemoneGarden.ts`, regrown from
`SEEDS.anemonesGrand`):

| | before | after |
|---|---|---|
| size draw | 0.75–1.3 | 1.8–3.0 |
| count | 10 | 13 |
| trunk | plain column, 0.11–0.20 m | fluted (7 ribs), waisted, oral-disc flare, 0.40–0.66 m |
| crown span | ~0.5–1.0 m | ~0.8–1.5 m (target was "around 0.9–1.4") |
| tentacles | one tier, 15–17/crown | two tiers: 9–10 long bulb-tipped + 13–15 short carpet (306 total) |
| families | rose, lavender, seafoam | rose-magenta `0xda8fa8`, sand-gold `0xd0975a`, sea-green `0x8fbf92` |
| draw calls | 3 (trunks, tentacles, fish) | 4 (trunks, long tier, carpet, fish) |

The bulb tips are the bubble-tip's beads — merged into the long tentacle's own
instanced geometry (an octahedron at the tip), **not** instanced apart, so a
bead inherits its stalk's exact sway phase; a separately instanced bead sways
to its own position's phase and drifts off the tip. Gotcha recorded:
`mergeGeometries` demands one indexing convention — `OctahedronGeometry` is
non-indexed, `CylinderGeometry` is indexed, and a failed merge falls back
*silently* to a bead-less tube. The tube is converted with `toNonIndexed()`
first, and the fauna test now asserts the beaded reach (`max|x| > 0.3` in
unit space; a bare tube ends at 0.16) so this class of bug fails loud.

The shader-sway idiom is kept (phase from instance position, bend weighted to
the tip, simulated time) with one amendment: the displacement is normalised by
the instance's length-to-girth ratio (`length(instanceMatrix[1].xyz) /
length(instanceMatrix[0].xyz)`). The old iso-scaled instances had girth ≈
length, so the offset survived; the grand stalks are ~6× longer than thick and
an un-normalised offset scales with the 6 mm girth and vanishes.

**Placement — moved, measured, and why.** The brief's rule: grow the radius
(max 3.2) and shift the centre off the z ≈ 6 band so the southern edge never
crosses z = 7.0. What shipped: centre **(9.0, 10.2)**, plant radius **2.4**,
so the southern rim is **z = 7.8 — flush with the corridor box's own top
edge**, 0.8 m inside the brief's bound. The old centre would have put the rim
at z = 6.1 with metre-tall crowns across the ribbon/zebra approach. Placement
was scored against facts, not guesses, with a throwaway vitest probe (deleted
after use) over the live `CoralField.contacts` and the authored `Crabs` homes:

- nearest coral footprint edge: 2.15 m west (the tidepool cluster's plate
  stack at (5.24, 10.73), footprint 1.64 m);
- slab rock (7, 15) r1.9: 3.3 m north; boulder (15.5, 8.5): >4 m east;
- crab doorsteps (5.3, 10.6) and (10.2, 11.6) stand 3.7 m / 1.8 m away.

Four keep-out discs in `AnemoneGarden.ts` hold trunks off the plate stack
(2.35), the slab (2.9), and both doorsteps (1.0 each). The garden comes out
gently egg-shaped — full reach E/S, carved W/N — which reads as a garden that
grew around its neighbours. `tests/reefSightlines.test.ts` stays green
(12/12) and fauna aren't in `obstructionMeshes` regardless.

**Clownfish** (`src/creatures/fauna/Clownfish.ts`, regrown from
`SEEDS.clownfishGrand`):

| | before | after |
|---|---|---|
| rendered size | 1.5× ≈ 16.5 cm | 3.0× ≈ 33 cm (a ~30 cm presence) |
| count | pair | trio — two adults 3.0×, one juvenile 2.2× (a family, which reads at 8 m) |
| body | sphere + tail cylinder, 2 bands | sculpted GLB, 3 black-edged white bands, eye, 4 fins |
| weave | ±0.6/±0.16/±0.5 over ground+0.62 | ±1.5/±0.3/±1.2 over ground+1.15 (skims the crown tops) |
| refuge | crown top +0.04 | up the trunk, +0.10 into the carpet — visibly nestled |

Hide 3.2 / emerge 4.6 hysteresis and the dart/weave/emerge rates are
unchanged, as are the `FaunaAudio` hooks (this system fires none).

## GLB contract row — creature-clownfish.glb

Measured with `node tools/blender/creatures/inspect_creature.mjs
public/assets/models/creature-clownfish.glb` (build: `--tag wave8`):

- verts / tris: **368 / 684** (budget 900)
- bounds (m): x ±0.0211, y [−0.0156, 0.0605], z [−0.0558, 0.0562] — faces
  **+Z**, +Y dorsal; nose at z = 0.0562
- length: **0.112 m nose→tail-fan edge** — authored at the animal's true
  ~11 cm (the shrimp's true-50 mm convention); `Clownfish.ts`'s scale of 3.0
  owns the rendered ~33 cm. That is the scale contract, stated here per the
  brief.
- pivot: origin, mid-body — the instance matrix plants it where it swims
- joints: none (swims whole; yaw/pitch live in the instance matrix)
- UV: u ∈ [0, 0.5] mirrored belly→spine; v ∈ [0, 1] nose→tail
- COLOR_0: ushort-normalized VEC4; orange body (sRGB 0.93/0.42/0.12), three
  white bands (0.96/0.94/0.87) with thin black edgings (0.075/0.065/0.08),
  black eye dots inside the head band. r mean 0.694, min 0.007 (rims/eye),
  max 0.913 (white) — measured.

Adoption: `requestModel` onto the instanced mesh exactly as `Shrimp.ts` does —
banded procedural stand-in until the GLB lands and forever in the no-assets
build; the stand-in carries the same field marks (3 black-edged white bands +
eye dots in vertex colour, rows tuned so each plateau/rim lands cleanly) and
the fauna test counts its white/black/orange vertices.

**Turntables** (`visual-qa/atelier/`): `clownfish-wave8-it1..it3-*` then final
`clownfish-wave8-{front,side,top,quarter}.png`. Three builds, two refinement
passes: it1 bands read but face pointy, dorsal low, tail thin, mid-band rim
heavy → it2 blunter face, taller rounded dorsal, fuller fan, rims 0.020→0.016
→ it3 wider white plateaus, pectoral paddles swept back-down to read from the
side. Final: the three bands read at a glance in every view; eye sits in the
head band.

## Budgets and perf

Four draw calls, no shadows cast or received, movers (fish) unculled as
before. Instanced triangles: trunks ~1.8k, long tier ~4.0k, carpet ~2.9k,
fish ≤2.7k (GLB) or ~1.2k (stand-in) — **~11.5k with the GLB**, against the
garden's previous ~4.8k and W-L5's 10.4k for all five populations. Flagged
honestly rather than hidden: the garden is now the destination the wave
asked for; everything is instanced and the sway remains one uniform write.

## Seeds

All new draws come off `SEEDS.anemonesGrand` (garden) and
`SEEDS.clownfishGrand` (trio). Nothing draws `SEEDS.anemones`/`SEEDS.clownfish`
anymore; their draw order is untouched by construction.

## Cross-file touch, flagged

`tests/lifeSystems.test.ts` pins each population's seed; the `AnemoneGarden`
entry (and the `world` uniqueness array) still pointed at `SEEDS.anemones`.
Updated those **two lines** to `SEEDS.anemonesGrand` — the pinned-literal case
the brief anticipates, and the same update every re-seeded population owner
faces this wave. No other out-of-package edits.

## Verification

- `npm run typecheck`: my files clean (pre-existing failures in other workers'
  mid-flight mythics files — `OldCurrent.ts`, `CrownSovereign.ts` — not mine).
- `npx eslint src/creatures/fauna/AnemoneGarden.ts src/creatures/fauna/Clownfish.ts --max-warnings 0`: clean.
- `npx vitest run tests/fauna.test.ts tests/reefSightlines.test.ts`: **28/28**.
- Adjacent suites (`lifeSystems`, `coralGarden`, `kelp`, `seaweed`,
  `seaGrass`): **83/83** including the kelp test guarding the old reserved
  disc.
- Full `npm test` once at the end: **456 passed, 6 failed — none mine.** The
  failures sit in other workers' mid-flight packages: `abyssBiome`
  (hidingSpots now 9 vs pinned 5 — the wave-8 moray dens worker),
  `mythicsW9` ×3 (leviathan/elder stand-ins mid-build), `wingDens` ×2 (new
  species configs/dens mid-build). Every fauna, sightline, coral, kelp,
  seaweed, grass and life-system test is green.

## Flags for the orchestrator

1. **`CoralField.CLEARANCES` still reserves the old disc (7.5, 8.5) r2.6**,
   which the garden has vacated north-eastward — coral keeps a now-mostly-empty
   disc clear, and nothing formal protects the garden's new ground. Rim
   adjacency was measured safe against *current* coral placements (2.15 m
   clearance west); if the coral package re-rolls placement this wave, the W
   rim deserves one re-check at merge.
2. **Southern rim z = 7.8 = the corridor box's top edge exactly.** Trunks
   never enter the box; a splayed long tentacle can lean a hand's width past
   its origin (to ~z 7.4), which is inside the box's top 0.4 m. The sightline
   rays run at head height far above the ~1.05 m crown tops, the raycast never
   tested plants, and `tests/reefSightlines.test.ts` is green — but the letter
   of "nothing in the box" is met by trunks only, not by every leaning tip.
3. **Sand-gold family on pale sand** — the cream-family lesson was heeded
   (gold authored a full value step deeper, trunks taken down and warmed), but
   the garden itself was not turntable-rendered (procedural, no dev servers
   this wave); judge it in the merge captures.
4. Crab doorsteps stand a wander away from the rim; a crab may stroll the
   garden's edge, which is life rather than a bug — trunks are kept 1.0 m off
   both doorsteps so it never sleeps inside a column.
