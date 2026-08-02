# W10 — fauna re-sculpt (crabs, ambient fish, starfish, urchins)

The owner's complaint this package answers: "some crabs, fish have very lazy
3D assets (some purely and very basic ugly geometric polyhedras)". Every
animal below kept its placement, count, behaviour, audio and scale story —
this was a re-sculpt, not a redesign.

## What changed, and why

### Crabs — procedural polyhedra → sculpted GLB, shrimp-style adoption

- New `tools/blender/creatures/build_crab.py` →
  `public/assets/models/creature-crab.glb`: a storybook shore crab — domed
  carapace with a scalloped rim (8 rounded anterolateral teeth), a D-shaped
  outline (clamped front margin, eased-in rear), legs in the shore crab's
  Z-fold with pale planted tips (four a side, shortening aft), two stalked
  eyes with full-dark beads, and one claw carried at 1.28× — the charm claw,
  the asymmetry that makes a drawn crab a character. Baked pose, **no
  joints** (legs animate by body bob in `Crabs.ts`, so articulation buys
  nothing a silhouette can show).
- `Crabs.ts` adopts it exactly the way `Shrimp.ts` does: `requestModel` swap
  onto the `InstancedMesh` geometry, procedural stand-in kept, owned/disposed
  bookkeeping untouched. `CRAB_SCALE = 1.0` — the GLB is authored at the
  *exact* size of the replaced procedural body (carapace 0.143 m across, feet
  at y = 0), so every instance matrix is **bit-identical**; instance scale
  0.8–1.3 gives the briefed 0.10–0.14 m carapace. HOMES, scuttle, startle,
  click audio: unchanged.
- Colour moved into the geometry: the GLB's `COLOR_0` is the authored warm
  terracotta over cream, and the fallback is repainted the linear equivalent
  of the old per-instance shell hexes (mean `0xb06e4e` through `Color`,
  keeping the old dark-eye / pale-claw / shaded-leg relative values). The
  per-instance tint is now a near-neutral warm multiplier — a GLB bringing
  its own terracotta must not have terracotta multiplied over it. The two
  draws per crab (`random.next()` then `random.range(0.85, 1.1)`) keep their
  order and ranges: the `SEEDS.crabs` stream is bit-identical.

### Ambient fish — 6×5 sphere + cone fork → one lofted fish (104 tris)

- `FishGeometry.ts` rewritten: a single indexed loft — authored ring stations
  (pointed snout, gill fullness, arched shoulder, rear taper, caudal
  peduncle), the dorsal sail lofted out of the rings' top vertex (real
  surface, not a stuck-on sheet), a crescent tail ring whose lobes sweep back
  past a recessed web (a forked silhouette that is solid from every side),
  and two double-wound pectoral blades. **No `mergeGeometries` at all** — the
  silent-merge-failure class that once took every fish's tail cannot exist
  here. Counter-shading, the 0.78 back shade and the two 1.5 eye vertices are
  preserved (eye now deterministic on the head ring's lower cheeks, the
  position the sphere's nearest-vertex search approximated). A ±0.02 seeded
  paint jitter (`paintSeed` per species, `SEEDS.fishBodies ^ 0x0001..5`) keeps
  the shading from reading machine-perfect.
- Contracts preserved by construction: nose at +z, tail at −z (the swim
  shader's `tailward` reads untuned), `createFishGeometry(profile)` signature
  and `FishBodyProfile` export kept — `SanctuaryLife.ts` consumes
  `FUSILIER.body` unchanged and inherits the re-sculpt for free.
  `FishSchoolSystem.ts` untouched.
- `FishSpecies.ts` re-proportioned: fusilier keeps its envelope (the
  sanctuary's animal, tuned captures); needlefish elongated (length 3.4→3.6,
  lower sail); tang disc-ified via the flatten param (width 0.2→0.16, height
  1.5→1.65, sail ×1.5); wrasse fuller (width 0.55→0.62, taper 0.38→0.32,
  paddle-shallow fork). Behaviours, counts, bands, seeds, near caps: all
  unchanged.

### Starfish & urchins — polish (still procedural, instanced, same seeds)

- Starfish: 30 segments × 3 rings pancake → 40 × 5 sculpt (360 tris ≤ 400):
  the lobe exponent grows down the arm so arms **taper**; a cubic tip lift
  (the curl a living cushion star holds its arms at); a bumpy dorsal ridge
  per arm from three gaussians jittered once per build off
  `SEEDS.starfishGrand` (deterministic). Placement stream `SEEDS.starfish`
  untouched.
- Urchins: 20 spines → 40 (twenty read as a hedgehog's haircut), lengths
  0.045–0.105 off `SEEDS.urchinsGrand`, roots darkening into the shell
  (0.50,0.46,0.58) with **warm-violet tips** (1.08,0.92,1.16) against the
  plum instance tints. Placement stream `SEEDS.urchins` untouched.

## Numbers (measured, not asserted)

| animal | before (tris) | after (tris) | budget | notes |
|---|---|---|---|---|
| crab GLB ×7 | — | **736** | 800 | 414 verts; fallback stays ~230 |
| fish (per species) | 60 | **104** | 110 | 58 verts, all five identical |
| fish community ×152 | 9,120 | **15,808** | — | +6.7k ≈ +3.4 ms SwiftShader @0.5 ms/k |
| starfish ×13 | 150 | **360** | 400 | 201 verts |
| urchin ×8 | 176 | **320** | — | 383 verts |

### creature-crab.glb — contract row (measured with `inspect_creature.mjs`)

| | measured |
|---|---|
| verts / tris | 414 / **736** (budget 800) |
| bounds (m) | x ±0.1217 (leg tips), y [−0.0008, 0.0820], z [−0.0572, 0.1190] |
| carapace | 0.143 × 0.114 m, dome apex 0.082 — the replaced procedural body's exact envelope |
| pivot | ground centre; faces **+Z** (eyes/claws forward), feet at y ≈ 0 |
| joints | none (baked pose; legs ride the body bob) |
| UV | parametric per part; u ∈ [0, 1], v ∈ [0, 1.03] — no painting exists |
| COLOR_0 | terracotta shell (linear means r 0.457 / g 0.236 / b 0.150) over cream underside/skirt; dark eye beads (r min 0.010); pale feet and claw mittens (r max 0.791 ≈ sRGB 0.90) |
| adoption | `CRAB_SCALE = 1.0`; instance matrices bit-identical; tint near-neutral |

## Turntable notes (`visual-qa/atelier/crab-*`, fish via /tmp OBJ rig)

- **crab it1**: dome read as a pie; legs, claws and eyes all hidden under the
  shell. **it2**: clamped front margin (D-outline), rear eased in, claws
  raised to rim height and pushed forward, eyes taller/wider, fourth leg per
  side, wider leg splay. **it3**: scallops softened (3 columns/tooth was a
  star's points), eyes to full-dark bigger beads, mitten enlarged.
  **wave8 (final)**: claw tip blunted — the needle past the mitten read as a
  stinger from the side. All four atelier views re-read after every change.
- **fish it1** (grey OBJ turntables, silhouette-only): the crescent web's
  intermediate columns sat too high — the tail read as one solid sail — and
  the sail was invisible. Slimmed web columns (lobe·0.42→0.30), raised the
  sail peak (0.34→0.42), slimmed lobes per species. it2 views: a fish, not a
  lozenge — fork reads on every species, tang is a disc, needlefish a lance.
- **starfish/urchin** OBJ turntables: taper, curl and the ridge bumps read;
  the urchin is a shaggy pincushion with pale points.

## Verification

- `npm run typecheck` — clean.
- `npx eslint src/creatures/fauna src/creatures/fish --max-warnings 0` — clean.
- `npx vitest run tests/fauna.test.ts tests/fishDiversity.test.ts` — **39/39
  green** (fauna 21, fishDiversity 18). Restated contracts: fish tri budget
  ≤110 with a >90 sculpt floor, nose-forward/tail-past-nose silhouette,
  positive signed volume (winding), dorsal sail above the body tube,
  per-species proportion windows (lance/disc/fuller), bit-for-bit rebuild;
  starfish taper/curl/ridge bounds + determinism; urchin shag density,
  warm-violet-tip/dark-root paint + determinism; crab stand-in palette and
  near-neutral tints. The counter-shading cap contract is unchanged (≤1.05,
  exactly six 1.5 eye entries).
- Full `npm test` once at the end: 481/484 — the three failures are other
  workers' mid-flight files (`tests/wingDens.test.ts` den placement and
  moray-pattern markings, `tests/abyssBiome.test.ts` fifth hiding spot; the
  failing set churned between runs). Nothing I own is red; wings/seabed/reef
  bit-identity suites pass.

## Flags

1. **Perf, stated not hidden**: the fish community is +6.7k tris and the
   ground fauna +~7k (crab GLB worst case) against their W-L4/L5 ledgers —
   ≈ +4 ms arithmetic on SwiftShader, vsync-noise on hardware, inside the
   wave brief's budgets (110/fish, 800/crab, 400/starfish). Re-measurement is
   the orchestrator's post-merge probe pass.
2. `SEEDS.crabsGrand` went unused: the crab's sculpt is the GLB (a
   deterministic build) and every runtime stream had to stay bit-identical —
   there was no honest new draw to spend it on. `fishBodies` (as five
   `paintSeed` substreams), `starfishGrand`, `urchinsGrand` are spent as
   registered.
3. `tests/fauna.test.ts` anemone/clownfish describe blocks were another
   worker's live edits throughout (their band-count test went red and
   recovered mid-flight); untouched here.
4. Caught by my own new test: `Math.pow` on a hair-negative spine parameter
   wrote NaN vertex colours in `Urchins.shadeSpine` — clamped. The old linear
   code could never see it.
5. No dev servers, browsers or captures were run. Fish/starfish/urchin
   turntables used a throwaway OBJ rig in /tmp (deleted from the repo, never
   committed); crab turntables are the atelier's own `render_views`.
