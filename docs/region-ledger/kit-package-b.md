# Kit Package B ledger — life, light & particulate builders

Phase 2, Package B (KIT-SPEC §3, MASTER §3). Eight pieces under
`src/world/regions/kit/`, demos in `KitDemosB.ts`, contracts in
`tests/kitLife.test.ts` (45 cases, green; full suite 613/613 green;
typecheck and `eslint src/world/regions/kit tests/kitLife.test.ts
--max-warnings 0` clean). Every piece has a `b-final` capture in
`visual-qa/kit/`; every moving piece has a `<piece>T1` twin one
simulated second later, and every T1 pair was byte-compared and differs.
The harness's declared-vs-rendered numbers reconcile exactly: at every
capture, renderer tris − declared tris = the stage's own baseline (4550,
or 4108 with the boulder culled), and renderer calls − declared draws =
the in-frustum stage meshes.

## Per-piece notes

### shoalRunner (`ShoalRunner.ts`) — built first with gateVeil
- **Budget**: 1 draw (+1 with glint). 104-tri sculpted community fish ×
  count; reference 40 fish + 20-glint thread = 2 draws / 4,160 tris.
- **Deviation, declared**: the spec sketch's "48-tri fish" predates the
  W-wave fish-body upgrade; the regions' own road shoals (the idiom this
  extracts) all use the 104-tri `createFishGeometry` loft, so the kit
  does too and declares the honest number.
- **The clocks**: ALL motion is a closed form of the wrapped loop phase
  (`timeSec × phaseSpeed mod 1`); braid/bob ride integer cycles-per-loop
  sines. Loop continuity (phase 0 = phase 1), time determinism (any dt
  path), and the split-route timetable (two same-seed runners agree at
  any `timeSec`) are all held by tests, byte-exact.
- **Bounds**: `frustumCulled = false` on the fish mesh only (law 4's
  sanctioned case); glint keeps culling under an authored route sphere;
  the fish mesh still computes an instance-aware sphere off real
  matrices.
- **Demo verdict** (r1–r2): r1 framed the loop's far leg — empty frame;
  r2 re-phased to the near leg: the ribbon crosses the whole frame with
  braid, banking and glint sparkles; the T1 capture shows clear travel.

### percherColony (`PercherColony.ts`)
- **Budget**: 1 draw per body kind. Star 80 tris, fry/blenny 104–112,
  shrimp 80; reference 12 seated stars = 960 tris.
- Seated bodies align to anchor normals and keep culling; hover and
  dart movers are closed-form (dart: rest → burst → rest → burst home on
  a seeded per-agent period) and opt out per law 4.
- **Demo verdict** (r1–r2): r1 buried the boulder-top stars (anchor under
  the crown) and hovered the fry too low; r2 seats stars on the crown
  and sand, fry circle at lantern height — motion visible in the T1 pair.

### glowColony (`GlowColony.ts`)
- **Budget**: 2 draws (instanced buds + one halo Points). 80-tri bud;
  reference 10 buds = 800 tris. Caps held by clamp AND test: emissive ≤
  0.36, halo opacity ≤ 0.28 — far under the bloom pass's 0.82.
- The W-O1 discipline baked in: `emissivemap_fragment` × vColor chunk
  (one program, `customProgramCacheKey`), halos hung just ABOVE the
  tips, radial sprite.
- **One earned change to the idiom**: the canyon's bottom-to-top tip
  gradient reads only from ground level — from above, a dome's visible
  cap is one y-band and the bud went flat (r2–r3 captures). The kit bud
  grades RADIALLY from the apex, so the tip reads as the light source
  from every camera. Body colour is the tint × a deep violet-leaning
  multiplier (red above green), because the glow only reads as light
  against a body clearly darker than it.
- **Demo verdict** (r1–r6): r1 buried in dunes (stage.ground lies — see
  flags); r2–r3 pale eggs under a half-dark stage; r4–r6 with the full
  dark-register shim and the radial gradient: a bed of small lanterns
  with halo pinpricks, captured dark per spec.

### particulateField (`ParticulateField.ts`)
- **Budget**: 1 draw, 0 triangles (cost is `count` sprites of overdraw).
  Reference 150; demo 170 column + 260 fall.
- Radial sprite mandatory; twinkle in the colour attribute (Particles'
  floor 0.45); column/fall cycles fade in AND out (the Bubbles lesson);
  drift wraps euclidean inside the volume, so bounds are an authored
  sphere and the points KEEP frustum culling (stricter than law 4 asks).
- Containment held by test at t = 0, 3.7 and 111.2.
- **Demo verdict** (r1–r3): r1 exposed the black stage (see flags); r2
  both modes read; r3 warmed and thickened the column so dust and snow
  separate. T1 pair differs.

### beamAndPool (`BeamAndPool.ts`)
- **Budget**: 2 draws (merged blades + merged pools), 320 tris/beam +
  336/pool; reference 2 beams + 2 default pools = 1,312 tris.
- All four fade disciplines: fog:false; ground fade baked against the
  caller's `ground`; edge-on and ~120 m range fades — moved into a
  vertex-shader patch (`aMarkCenter`/`aBladeNormal` attributes +
  `cameraPosition`) because ONE merged mesh cannot fade per-blade
  through `material.opacity` the way the regions' per-shaft meshes do.
  Zero per-frame CPU; nothing for reduced motion to reduce.
- Per-mark opacity is clamped to 0.3 and baked into vertex colours
  (material opacity stays 1), so the cap is a property of buffers a test
  reads. Pools default under every beam (a beam that brightens nothing
  is a decal); `pools: []` suppresses (the veil column uses it).
- `forceSinglePass` on the additive DoubleSide material: three r180
  renders double-sided transparency twice; additive blending is
  commutative, so the second pass bought nothing and doubled the honest
  call count (caught by the harness's reconciliation at r1).
- **Demo verdict** (r1–r3 + r2g): r1 torch-flame heads with value-step
  banding (the regions' `(1-v)*5` head ramp is only right when tops are
  off-frame) — the kit sprite eases the head over the top third and
  floors the along-length ramp so the beam visibly reaches its pool; r3
  ribbons of light; r2g re-grounded the pools on the real dunes — both
  land warm.

### dappleSheet (`DappleSheet.ts`)
- **Budget**: 2 draws (near + far layer at 1.55× tile, 0.62 weight),
  reference ~900 tris. Opacity clamped to 0.3, default 0.2.
- THE one asset-touching piece: painted `world/caustic-dapple.png`
  through `AssetLibrary`, one clone per layer (clones share one Source —
  one upload; the library texture is never disposed), generated Voronoi
  dapple (the bowl's recipe, seeded) as the standing fallback — Node and
  noassets build identically by construction.
- **Deviation, declared**: the spec says "recoloured by tint at load
  into a memoised copy"; the recolour here is the material's `color` (a
  uniform multiply is texel-for-texel what a baked copy would be) —
  avoids a second GPU upload per tint and keeps one code path for
  painted and generated maps.
- The async swap re-winds the drift to the last simulated time — a
  fresh clone wears zero offset, and the r1 T1 pair shipped IDENTICAL
  until this was fixed (caught by byte-comparing the pair).
- **Demo verdict** (r1–r2): honey dapple over the dunes, denser patches
  and quiet stretches, rim reach at zero (held by test). T1 differs.

### gateVeil (`GateVeil.ts`) — built first with shoalRunner
- **Budget**: ≤ 5 draws (3 planes + 1 column + 1 Points), reference
  1,616 tris. Planes at the 0.2 cap, depthWrite off, fog:false with
  inks self-mixed toward `scene.fog` per frame (the DistantReef trick,
  so moods/weather/repaints reach the veil and it agrees with the real
  distance rings when the region streams in).
- Drooped seeded fbm skylines (low frequency — 36 columns alias a busy
  ridge into sawteeth, caught in the r6 isolated render); RGBA top AND
  side dissolves (the side dissolve came from r5: a plane whose vertical
  end-edge shows reads as a pane of glass); baked vertical value grade
  (the abyss poster-board lesson); one mesh per plane for honest culling.
- Composes `particulateField` (drift, biased through the door) and a
  poolless `beamAndPool` column — B-internal imports, per spec.
- **Demo verdict** (r1–r10, the piece that earned its rounds): r1–r6
  chased visibility — the lessons that landed in the piece: inks must
  stay near-full ink at the cap (mix table 0.05/0.24/0.48), the dissolve
  must start late (0.72) because the solid band is the whole reading,
  and the planes must STACK over the doorway (widths 1.15/1.45/1.85).
  r7–r9 chased a stale-module red herring; r10 restaged the demo clear
  of the wall's occlusion: a dark green silhouette with a drooped
  skyline standing in the doorway, the light column inside it, motes
  drifting through. Captured bright AND dark at `b-final` per the gate.

### fallStreak (`FallStreak.ts`)
- **Budget**: 1 draw (all sheets merged, one shared caller-owned
  DataTexture), 120 tris/sheet; reference 2 sheets = 240 tris. Opacity
  clamped to 0.2, fog:false, depthWrite off, additive.
- The texture: per-column centre/width/weight jitter, wandering and
  breathing on WRAPPING fbm (the scroll never meets a seam), clump
  streaks with a wide value swing (r1's lesson: low-contrast streams
  read as a stain on the wall). Sheets fade feet AND tops AND sides in
  RGBA vertex colours — no hard-topped bloom-block edge anywhere.
- `update(timeSec)` scrolls the texture closed-form (~0.66 m/s at the
  6 m tile); the two `b-final` captures a second apart visibly move and
  byte-differ (held by test on the offset too).
- **Demo verdict** (r1–r2): r1 read as a watermark; r2 sharpened the
  columns and clump contrast — soft falling veils against the wall.

## Critique history (cross-piece)

- r1 of every piece was captured against a black stage (flag 1 below) —
  those rounds are visibility rounds, not paint rounds.
- The additive pieces were each iterated at least twice against their
  captures; gateVeil took ten rounds, and its three structural fixes
  (late dissolve, side dissolve, plane stacking) are in the PIECE, not
  the demo, so every consumer inherits them.

## Flags

1. **Harness page: black stage (worked around, demo-only).** The page's
   ground and wall wear `createSandMaterial`/`createRockMaterial`
   (`vertexColors: true`) but their geometries carry no `color`
   attribute — an unbound attribute samples (0,0,0) and the stage
   rasterises black. Package B may not edit the page, so every B demo
   carries a one-shot `stageRepair()` probe (adds the missing white
   attributes on first render). Recommend the harness bake them (or the
   bowl's occlusion) into the stage itself.
2. **Harness page: the dark mood is a no-op (worked around).** The page
   writes `lighting.sun.intensity *= 0.15` and `backgroundIntensity =
   0.25` ONCE, but `Lighting.addTo` and `UnderwaterFog` chain per-frame
   `scene.onBeforeRender` hooks that rewrite both from base levels —
   the shipped dark captures were byte-identical to bright ones. B's
   dark demos chain `darkStageRepair()` after those hooks (sun 0.15×,
   hemisphere 0.35×, ambient 0.55× — darkens into colour, background
   and fog to 0.25×, re-asserted per frame). Recommend the page apply
   its mood through the same chained-hook channel.
3. **Harness stage: `stage.ground` returns 0 but the stage sand is the
   bowl's real dunes** — a piece grounded through the contract sampler
   sinks into the near dune (glowColony r1, beamAndPool's pools). B's
   demos sample `seabedHeight` directly; recommend the stage's ground
   fn do the same.
4. **Harness script: the doc comment promises two captures for
   `timeSec` pieces (`<piece>_<tag>-b.png`) but neither the page nor the
   script implements it.** B registers `<piece>T1` twin demos one
   simulated second later instead; the pairs are byte-compared in this
   package's workflow.
5. **KitTypes.ts needed no changes** — nothing blocked.
6. Spec-sketch deviations, both declared above with reasons: the
   104-tri shoal fish (honest number for the community loft) and the
   dappleSheet recolour via material colour on shared clones.
