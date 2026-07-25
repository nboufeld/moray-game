# moray-game — The Reef Between Seas

A calm 3D moray-eel diving and discovery game built with TypeScript, Vite and Three.js.
This repository contains the **vertical slice** from the design blueprint: a greybox
"Sunlit Coral Garden" reef with a supporting fish school, comfort-aware swimming, four
distinct discoverable morays recorded into the Codex, a versioned save system, a
comfort/accessibility settings panel with Calm Mode, and the Dream Sanctuary aquarium.

## Layout

- `src/app/` — `Game` wiring, fixed-timestep `GameLoop`, `RendererAdapter` (WebGL).
- `src/player/` — `DiveController` (pure physics), `CameraRig` (comfort options), `InputController`.
- `src/world/` — `Reef`, `Seabed` (shared dune height), `CoralField`, `SeaGrass`, `CollisionField`.
- `src/creatures/morays/` — data-driven `MoraySpeciesConfig`, `MorayRegistry`, procedural `Moray`.
- `src/creatures/fish/` — `FishSchoolSystem` (instanced ambient fish).
- `src/discovery/` — `FocusScanner`, `DiscoverySystem`, `HintSystem` (all pure/testable).
- `src/rendering/` — fog + gradient backdrop, lighting, caustics, light shafts, particles,
  the `ColorGradeShader` used by the post chain, and `ProceduralTexture` (the noise and
  map-building toolkit every surface is textured with).
- `src/util/Random.ts` — seeded PRNG and the per-subsystem `SEEDS`.
- `src/sanctuary/` — `SanctuaryScene` (separate scene rendered when in sanctuary mode).
- `src/save/` — `SaveSystem` + `SaveMigration` (versioned localStorage).
- `src/ui/` — `Hud`, `Codex`, `SettingsPanel`, `SanctuaryOverlay`.
- `src/accessibility/` — comfort settings + Calm Mode preset.
- `tests/` — Vitest unit tests (pure gameplay logic, no WebGL).
- `tests-e2e/` — Playwright tests (render, codex, discovery, sanctuary, calm mode, save,
  comfort-panel keyboard access).

## Commands

All standard commands live in `package.json` scripts: `dev`, `build`, `preview`,
`typecheck`, `lint`, `test`, `test:watch`, `test:e2e`, `shots`.

## Cursor Cloud specific instructions

- **Node**: the VM has Node 22 available; no version manager pinning is required. `npm`
  is provided via nvm's Node 22 install — both resolve to Node 22, so either works.
- **Running the app**: `npm run dev` serves on `http://localhost:5173` (host exposed).
  Use dev mode, not `npm run build`/`preview`, for development.
- **e2e tests need a browser**: run `npx playwright install chromium` once (the update
  script does this). `playwright.config.ts` starts/reuses the dev server on port 5173
  automatically via its `webServer` block — do not start a second dev server on 5173
  before running `npm run test:e2e` unless you want it reused.
- **e2e is slow and CPU-bound, by nature**: every spec boots a real WebGL scene that
  headless Chromium rasterises on the CPU, so the suite takes minutes, not seconds, and
  the worker count is capped in `playwright.config.ts`. Over-parallelising does not just
  slow it down — a starved render loop stops answering the test protocol, which surfaces
  as timeouts in specs that have nothing to do with the change. If the suite suddenly
  fails everywhere, check the machine's load average before suspecting the code.
- **Never time a swim by wall clock in a test**: the world only advances while the browser
  draws, so a fixed `waitForTimeout` covers wildly different distances on different
  machines. `swimToFirstDiscovery` waits on `__reef.divePosition` instead.
- **Renderer**: rendering goes through `RendererAdapter` (WebGLRenderer). Keep new
  render code behind that adapter; a WebGPU swap should touch only that file. It owns the
  post chain — `RenderPass` → `UnrealBloomPass` (quarter resolution) → `ColorGradeShader`
  → `OutputPass` — and swaps the pass's scene/camera per frame so the reef and the
  sanctuary share one composer.
- **Adaptive resolution**: the adapter measures frame time and shrinks the *internal*
  render targets (never the canvas) down to 0.34 when frames run long, restoring them
  when there is headroom. Without it this scene runs around 3fps on a machine with no
  hardware acceleration, which is exactly what headless Chromium falls back to. Call
  `pinRenderScale(1)` before any screenshot, which `Game.capture()` already does.
- **Everything procedural is seeded** (`src/util/Random.ts`). Do not reach for
  `Math.random()` in world generation: an unseeded reef is different on every load, and
  then no two screenshots can be compared and no visual change can be judged.
- **Visual QA**: `npm run dev`, then `npm run shots -- <change-tag>` writes the canonical
  shot set to `visual-qa/` (opening hero, mid-depth traverse, close moray, UI overlay,
  sanctuary portrait). `Game.capture()` stops the live loop, places the diver and advances
  the world by whole fixed steps, so a shot is reproducible frame for frame. Capture
  before *and* after a change and compare; `scripts/measure-frames.mjs` does the same for
  frame cost.
- **Render cost gotchas** (all of these were measured, not guessed): coral is flattened
  into a handful of instanced meshes because ~200 individual draw calls dominated the
  frame; grass and fish deliberately do not cast shadows; the light shafts are
  overdraw-bound, so their count matters far more than their triangle budget; and the
  caustics sheet must be built from `createSeabedGeometry` so it follows the same dunes
  as the sand it lies on.
- **Texturing goes through `ProceduralTexture`**, which builds `DataTexture`s from typed
  arrays rather than painting canvases. That is deliberate: it needs no DOM, so maps work
  unchanged in the Node unit tests, and it is bit-identical across environments, which
  canvas rasterisation is not — and the whole screenshot loop depends on two runs of the
  same seed matching. Every generator tiles by wrapping its lattice on an integer period,
  so never "fix" a seam by stamping. Surface maps live next to their owner
  (`SandMaterial`, `RockMaterial`, `CoralField.coralSkin`, `SeaGrass.bladeTexture`,
  `MorayPattern`) and are cached per material or per species — they are built at
  construction, which the unit tests hit for every species.
- **Flat shading is kept on purpose.** Normal maps compose correctly with it, so the reef
  reads as textured facets — chiselled, not smoothly rendered CG. The fix for a surface
  that looks like a platonic solid is geometry (`weatherRock`), not smooth normals.
- **Rock UVs are box-projected at build time**, not triplanar. Triplanar would cost three
  fetches per map on the largest surfaces; box projection is one, and its seams land on
  facet edges where flat shading has already broken the normal.
- **The stage is authored for the canonical cameras.** `PINNACLES`,
  `FOREGROUND_SHOULDER` and `FOREGROUND_CLUMPS` in `src/world/Reef.ts`, and the coral
  `SITES` in `CoralField`, are placed for shots A and B — a gate of sea stacks either
  side of the snowflake crevice, a dark shoulder cropping the left edge, clustered
  bommies with bare sand between them. They are not a scatter, so re-rolling or evening
  them out undoes the composition. Every placement also stays out of the morays'
  approach corridors: south down x ≈ -6 to the dragon, the z ≈ 6 band to the ribbon and
  zebra, and the spawn line down x ≈ 0 to the snowflake. `tests/reefSightlines.test.ts`
  raycasts those corridors the way `Game.isObstructed` does and fails if anything new
  blocks a head — run it (it is in `npm run test`) before trusting a placement change.
- **`weatherRock` on a crevice mound must stay `inwardOnly`.** The mounds sit centimetres
  behind a moray's head and are raycast for line of sight, so a mound that can bulge
  outward can silently swallow the creature the game is about. Re-run the discovery spec
  after touching anything near a hiding spot.
- **No-DOM guards**: `UnderwaterFog`'s gradient still paints to a canvas and returns null
  when `document` is undefined. Anything else that paints to a canvas at construction
  needs the same — or better, build it as a `DataTexture` and avoid the problem.
- **Manual/scripted testing gotcha (discovery)**: the hero moray sits *nearly straight
  ahead of the spawn point, only slightly below center*, and its head deliberately peeks
  out in front of the coral mound (line of sight must be clear, or `DiscoverySystem`
  treats it as obstructed). To discover it, swim forward with `W` for ~1.5s from spawn
  (that coasts to a stop around 7.5m out, mid-way through the 1.2m–14m focus band), then
  hold still with the view centered for ~1.5s while the reticle ring fills. When
  driving the browser programmatically, do **not** use mouse-look or arrow keys — pointer
  lock jitter and tilting push the (roughly level) moray out of the focus cone. Just press
  `W`, then hold. Focus tuning lives in `DEFAULT_FOCUS_PARAMS` (`src/discovery/FocusScanner.ts`);
  spawn/crevice placement lives in `Game` and `Reef`.
- **Save persistence gotcha**: discoveries and comfort settings persist in `localStorage`
  (key `reef-between-seas.save.v1`), so on a returning profile the reef may already show
  discovered morays. Load `http://localhost:5173/?reset=1` to force a fresh dive when
  demoing or manually testing discovery. `Game` is constructed with `{ resetSave }` from
  that URL flag (see `src/main.ts`).
- **Keys**: `C` Codex, `H` hint, `V` toggle Dream Sanctuary, `O` toggle settings. The
  sanctuary is a separate scene/camera; while it is open the reef simulation is paused and
  the dive HUD is hidden. Opening the settings panel also pauses the reef simulation.
- **Input ownership gotcha**: the dive claims Space and the arrow keys, so
  `InputController` steps aside (no `preventDefault`, no key tracking) whenever the event
  target is a form control — otherwise the comfort panel's checkboxes and field-of-view
  slider cannot be operated from the keyboard. The `C`/`H`/`V`/`O` shortcuts stay global
  (so `O` always closes the panel) and ignore `event.repeat` so holding a key toggles once.
- **Sanctuary rebuild gotcha**: `SanctuaryScene.setSpecies` runs on every discovery and
  every time the sanctuary opens. It disposes the previous residents' geometries and
  materials; drop that and the GPU copies accumulate for the rest of the session. Reef and
  sanctuary morays are separate `Moray` instances with their own resources, so disposing
  sanctuary residents never touches the reef.
- **Finding the darker morays**: only the snowflake moray sits straight ahead of spawn. The
  ribbon (left), zebra (right) and dragon (deeper, forward-left) require turning and are
  intentionally harder to spot — the zebra/dragon heads are dark against their caves. Use
  the `H` hint ladder (it targets the nearest undiscovered moray). All four are verified
  discoverable; placement/facing live in `SPOT_PLACEMENTS` in `src/world/Reef.ts`.
- The Vite build prints a >500 kB chunk warning (Three.js in one bundle). This is expected
  and is not an error.
