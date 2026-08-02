# Kit Package A — ground & flora builders (Phase 2)

The ten KIT-SPEC §2 pieces, built on branch `kit/package-a`. Files:
`src/world/regions/kit/{CarpetField, GroundLitter, ScreeApron, MatRings,
BushBank, SpongeCluster, WallDrape, DriftDebris, FarGrassCards,
KitPaint}.ts`, the internal helper `KitGroundShared.ts` (flag F4), the
demo registrations in `KitDemosA.ts`, and `tests/kitGround.test.ts`
(39 cases, green; full suite 607/607 green; typecheck and eslint clean).

Every piece has an `a-final` capture in `visual-qa/kit/` (untracked by
design — `visual-qa` is gitignored; regenerate with
`SHOT_URL=http://localhost:5190 node scripts/kit-demo.mjs all a-final`
against `npx vite --port 5190 --strictPort`). Iteration tags `a-r1` …
`a-r6` are kept beside them.

## Budget reconciliation (harness numbers, `a-final`)

The harness's rendered numbers exceed each build's declared numbers by a
CONSTANT stage bill — the sand patch, wall panel, boulder and background
(~4,550 triangles, 3–4 calls, less when a stage mesh is out of frustum).
Declared draws/triangles match the meshes actually built for all ten
pieces; the per-piece tests assert the same counts in Node.

| piece | declared (demo composite) | piece budget shape |
|---|---|---|
| carpetField | 1 draw per call; 4 tris/card, 12/tuft (demo: 3 calls + dressed sand = 4 draws / 17,712) | T1: 3,000 cards ≈ 12k tris |
| groundLitter | 1 draw per tone family (2 with `twoTone`); gravel/pebble 20 tris, shard/grit 8 | 600 stones ≈ 12k worst case |
| screeApron | 1 draw; 12 tris/slab | 3 anchors × 14 slabs = 504 tris |
| matRings | 1 draw, merged; (4·bands+1)·segments tris/disc — see flag F2 | 3-band mat ≈ 156 tris |
| bushBank | 1 draw per palette family; lobes·36 tris/bush (default 5 → 180) | bank of 60 ≈ 10.8k |
| spongeCluster | 1 draw; 180 tris/tube (the W-N5 lathe) | 6 anchors × 4 tubes ≈ 4.3k |
| wallDrapeBank | 2 draws (merged strands + merged pads); 20 tris/strand, 6/pad | 8 anchors ≈ 1.3k |
| driftDebris | 1 draw per family (merged); wrack 10, spars 10, planks 12, relics 48–80 | 40 wrack ≈ 400 tris |
| farGrassCards | 1 draw; exactly 4 tris/card | 10,000 cards = 40k tris — state wherever consumed |
| wallStrataPaint | 0 draws (a bake) | vertex-colour multiply only |

## Critique history (what each round paid for)

- **a-r1** — the stage rendered BLACK (flag F1); pieces floated in a void.
  Raked carpet stood with every face in the shade band; wrack curls stood
  on the sand like croquet hoops; mats were cut by sand-grid crests
  poking through a 0.04 m drape.
- **a-r2** — dressed stage in. Mats read as one airbrushed blob (one ring
  per band); bushes read as smooth boulders (crown mis-measured at 1.15,
  paint saturating early); scree read as loose scatter (runout bias ran
  outward); drape pads invisible.
- **a-r3/r4** — mat bands doubled to flat-interior rings + 0.1 m drape
  lift; bush fbm swell + per-lobe tones + crown 1.5 + smaller age bands;
  scree u² foot pile, chips confined to end faces; wrack flattened
  (curl ≤ 2.2 rad, y × 0.55); comb lean capped at 0.3·strength and the
  demo comb turned sun/camera-ward.
- **a-r5/r6** — drape pads found CULLED: the anchor frame's −x `side`
  axis winds the pad fan clockwise; pads are DoubleSide now (honest for
  curved walls) and the first pad sits at the holdfast so strands grow
  from something.
- **a-final** — all ten captured. Verdicts: carpetField, groundLitter,
  matRings, spongeCluster, wallDrapeBank, driftDebris, farGrassCards,
  wallStrataPaint read at demo quality; screeApron reads adequate ankle
  scenery (region anchors/spread control the composition); bushBank is
  the welded-lobe cushion idiom — it still leans mineral on bare demo
  sand and is expected to read as undergrowth among carpets/grass in
  region use (its lobe tones, swell and crown ramp are all in place).

## Flags

- **KIT-A-F1 — the harness stage renders black.** `createSandMaterial`
  and `createRockMaterial` declare `vertexColors: true`, but the stage's
  `createSeabedGeometryAt` sheet and `BoxGeometry` wall carry no colour
  attribute, so WebGL feeds the shader the zero default. The harness is
  not Package A's file (spec: created by A… but scaffolded by the
  orchestrator and listed DO-NOT-EDIT for this package), so every demo
  build dresses its own ground (and wall where needed) with the same
  materials over a filled colour attribute. Recommend a one-line scaffold
  fix; the dressed meshes are counted honestly in each demo's declared
  budget.
- **KIT-A-F2 — matRings triangle count exceeds the spec sketch** (~156 vs
  "~24–40" for a 3-band disc). Measured (a-r1/r2): one ring per band
  cannot hold a flat band interior — the mat reads as an airbrush blob.
  Two rings per band is the fewest that read as BANDS; a region wears a
  handful of mats, so the bill is tens of triangles, not thousands.
- **KIT-A-F3 — the relic tile has no wing constant to cite.** The
  ruins-terrace wing publishes drum geometry (barrel radius 0.42–0.47,
  fbm-jagged broken crown — restated verbatim in `drumFragment`) but no
  tile profile; `roofTile` is a cambered hand-scale rectangle in the same
  stone until the wing publishes one.
- **KIT-A-F4 — `KitGroundShared.ts`** is an internal Package A module
  (area samplers, the fixed-draw clumped rejection scatter, shade-ratio
  paint arithmetic, instancing/dispose assembly). It is not in MASTER's
  §3 file list; it exists so ten pieces do not carry ten copies of the
  same sampler. Nothing in it is public kit contract; B neither imports
  nor edits it.
- **KIT-A-F5 — `KitDemosA.ts` imports `Seabed`/`SandMaterial`/
  `RockMaterial`** for the F1 stage dressing only. Demo registrations are
  staging, not kit pieces; no BUILDER imports a terrain module (law 1
  holds — verified by grep and by the plain-Node tests).
- **Sway contract note:** `carpetField` and `wallDrapeBank` return
  `KitBuild & { update(timeSec) }` — closed-form off simulated time, the
  same shape Package B's moving pieces use; `update` moves no buffer
  (asserted by tests). Static when `swayAmp` is 0/omitted.

## Law compliance

Private seeds only (`new Random(seed)` + `^` sub-streams; no SEEDS, no
registries, no Scene/window/document — grep-clean); one lit door
(`createToonMaterial` everywhere; Package A ships no additive marks); no
castShadow/receiveShadow anywhere; authored value-first paint under the
GLB ceiling (instance/material colour owns the hue at the brightest
point, vertex colours only darken, shades are colours); instance-aware
mesh bounding spheres computed at build (the sill-stones trap — asserted
off-origin); merged pieces compute real spheres and stay anchored-local
(no wide arcs); byte-determinism in plain Node with fixed draws per
scatter attempt, so a `gate` retune never moves a survivor.
