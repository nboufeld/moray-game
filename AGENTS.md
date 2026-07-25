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
- `src/creatures/morays/` — data-driven `MoraySpeciesConfig`, `MorayRegistry`, procedural `Moray`,
 and `MorayBody` (the skinned tube and dorsal fin its joint chain drives).
- `src/creatures/fish/` — `FishSchoolSystem` (instanced ambient fish).
- `src/discovery/` — `FocusScanner`, `DiscoverySystem`, `HintSystem` (all pure/testable).
- `src/rendering/` — fog + gradient backdrop, lighting, caustics, light shafts, particles,
  the `ColorGradeShader` used by the post chain, the `DiscoveryPulse` that drives its
  swell, and `ProceduralTexture` (the noise and map-building toolkit every surface is
  textured with).
- `src/audio/` — `AudioEngine` (context + master, armed by the first gesture), `synth.ts`
  (every voice, all synthesised), `BubbleScheduler` (pure), `ReefSoundscape` (the layers).
- `src/util/Random.ts` — seeded PRNG and the per-subsystem `SEEDS`.
- `src/sanctuary/` — `SanctuaryScene` (separate scene rendered when in sanctuary mode).
- `src/save/` — `SaveSystem` + `SaveMigration` (versioned localStorage).
- `src/ui/` — `Hud`, `Codex`, `SettingsPanel`, `SanctuaryOverlay`, `MorayPortrait`.
- `src/accessibility/` — comfort settings + Calm Mode preset.
- `tests/` — Vitest unit tests (pure gameplay logic, no WebGL).
- `tests-e2e/` — Playwright tests (render, codex, discovery, sanctuary, calm mode, save,
  comfort-panel keyboard access, the audio graph probe).

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
  frame cost. The shot set holds exactly one sanctuary frame and that camera moves, so for
  work in there use `node scripts/probe-sanctuary.mjs <tag>`: it walks the sweep in four
  steps and then samples frame time with the room open, at the same window size
  `measure-frames.mjs` uses so the two costs can be read side by side. The sanctuary
 *replaces* the reef render rather than adding to it, so that is the number it has to
 beat (it currently comes in under it). The animals get the same treatment from
 `node scripts/probe-moray.mjs <tag>`: shot C stands where the *game* asks the player to stand,
 which is far enough that a seam a body's width across is two pixels, so this walks up to all four
 heads instead — one pose per crevice, down the approach corridor `Reef` keeps clear for it. It
 plants a completed save first, because two seconds of a centred reticle is a discovery and the
 ceremony's plate covers the animal it is celebrating.
- **Render cost gotchas** (all of these were measured, not guessed): coral is flattened
  into a handful of instanced meshes because ~200 individual draw calls dominated the
  frame; grass and fish deliberately do not cast shadows; the light shafts are
  overdraw-bound, so their count matters far more than their triangle budget; and the
  caustics sheet must be built from `createSeabedGeometry` so it follows the same dunes
  as the sand it lies on.
- **A light shaft has to fade out before it reaches the sand.** The beams run down the
  sun ray, forty degrees off vertical, so a blade's *width* axis is tilted with it and
  the quad's plane meets the flat seabed along a diagonal that climbs a metre and a half
  from one side of the beam to the other. The depth test cuts the curtain along that
  diagonal, and whatever brightness the curtain still has there lands on the floor as a
  hard-edged bright wedge — which is what the "light pool with straight edges" in shots B
  and C actually was. The pool discs were innocent; confirm which is which by zeroing
  `poolOpacity` or `baseOpacity` before touching either. Ending the quad below the sand
  cannot fix it, and not for the reason `FOOT_DEPTH` gives: the plane's local +Y points
  *down* the ray, so the texture's bright end is the ground end and the beam is hottest
  exactly where it enters the sand. `bakeGroundFade` writes a fade against `seabedHeight`
  into each blade's vertex colours instead, which is the only reason the blades are
  tessellated. A blade caught edge-on is faded out the same way — by opacity, from the
  camera position `update` now takes — because a crossed quad seen along its plane still
  rasterises, as a bright hairline (it was crossing shot E).
- **A pool's rim fade lives in its vertex colours, not only in its map.** A pool is a
  wide, nearly horizontal disc viewed from close to the ground, which is the worst case
  for minification: the rim samples a mip coarse enough to average the falloff into a
  flat wash, and a flat wash out to the last triangle is a bright polygon with a hard
  outline. The map's own window (`POOL_TEXTURE_FADE_*`) covers the ordinary case;
  `POOL_RIM_FADE` is the part filtering cannot reach.
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
- **The moray is one skinned tube, not a stack.** `MorayBody` builds a single `SkinnedMesh` for
 the body and a second for the dorsal fin, both weighted to the same chain of joints — which are
 the very `Object3D` pivots the wave was always driven down, now `Bone`s. `Moray.update` is
 unchanged and does not know the difference; the smoothness is free, because a vertex straddling
 two joints interpolates between them where a rigid link could only hinge. Three things about it
 were paid for once: the tube's normals are **analytic**, because a tube's seam column exists
 twice and averaged normals give the two copies different values, which draws a bright line down
 the belly; the meshes carry an **explicit `boundingSphere`**, because three bounds a skinned mesh
 from whichever pose the bones happen to be in at the first render and then never again; and the
 fin has its **own material at roughness 0.9**, because at the accent's sheen a pale fin caught
 edge-on renders as a bright spike over the head — the comb of plates it replaced, wearing a
 different shape. Geometry is authored in *joint units* (`g`), so a fractional position along the
 body is also literally its skin weight. The head is not part of any of this: it hangs off
 `bodyRoot`, so `getHeadWorldPosition` is the root's own world position and no body change can
 move it.
- **The moray's rim light must stay directional.** `RIM_LIGHT_CHUNK` in `Moray.ts` is
  injected by `onBeforeCompile` and weights its fresnel by a fixed world direction. Drop
  that weighting for a plain facing term and the animal turns into a cool glowing blob:
  it is built from cylinders running away from the camera, and every side normal of a
  cylinder seen end-on is perpendicular to the view, so *everything* scores as
  silhouette. Turning the exponent up does not fix it — measured, it barely moves. The
  chunk also has to run before `<normal_fragment_maps>`: on the mapped normal the skin
  wrinkles scatter the rim into a haze over the whole body. It is a module constant on
  purpose, because three keys its program cache on `onBeforeCompile.toString()`.
- **Off-screen renders skip tone mapping.** Three sets `NoToneMapping` and linear output
  whenever the destination is a render target, so pixels read back from one are raw
  scene-linear and look milky if shown as-is. `RendererAdapter.captureToDataUrl` applies
  the same ACES curve and sRGB transfer the screen gets, on the CPU. Change the
  renderer's tone mapping and that port has to follow.
- **A codex portrait costs ~330ms** on the headless software rasteriser, and it is not
  fill-rate: rendering the same species again is just as slow, and quartering the pixels
  saves 14ms, while an empty scene through the identical path costs 7ms. So it is never
  called inline — `Game` queues portraits and `renderNextPortrait` draws at most one per
  frame, after the frame is presented, with `capture()` draining the queue up front so a
  screenshot does not depend on how many frames have drawn. Keep it off the discovery
  frame; the ceremony's plate and reticle are CSS, so they ride out the stall.
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
 every time the sanctuary opens. It disposes the previous residents' geometries, materials and
 skeletons — a skeleton owns a float texture of bone matrices that nothing else releases, and
 `disposeSubtree` is where that happens; drop any of it and the GPU copies accumulate for the rest
 of the session. Reef and
  sanctuary morays are separate `Moray` instances with their own resources, so disposing
  sanctuary residents never touches the reef. **The set is not part of that path**: the
  sand, the two stacks, the coral, the grass, the shafts, the caustics and the motes are
  all built once in the constructor, and `tests/sanctuaryScene.test.ts` fails if a fixture
  stops surviving a rebuild. That test also constructs the scene in plain Node, so
  everything the room owns has to be DOM-free at construction — which is why
  `LightShafts`' canvas-painted beam texture returns null without a `document`, the same
  guard `UnderwaterFog` has.
- **The sanctuary is dressed from the reef's own generators**, with its own seeds
  (`SEEDS.sanctuary*`). `CoralField` and `LightShafts` take their sites/placements as an
  optional second and third constructor argument; the reef's authored ones are the
  defaults precisely so a second room cannot move them.
- **Sanctuary lane gotcha**: residents swim a lemniscate, and a lemniscate's heading stops
  turning at the crossing, so an animal spends most of its loop at one of two headings —
  forty-five degrees either side of its lane's `turn`. Turn a lane far enough that one of
  those points at the camera and the animal parks end-on, where an eel is a lump with a
  face on it. Keep `turn` small and use a negative `speed` (the same eight, run backwards)
  when you want one heading away instead. `Moray.update` takes the lane's yaw rate as an
  optional `turnRate` and bends the body into the curve with it; it defaults to 0, so the
  reef's morays are untouched.
- **The sanctuary camera sweeps, it does not orbit.** A full circle has to be composed for
  from every azimuth, so nothing can stand near the frame edge without becoming a wall in
  the lens later. `SWEEP` is sixty degrees of arc and the stacks, bommies and grass are
  placed for it. `setSpecies` resets the sweep so the room always opens on its authored
  view — which is also what keeps shot E comparable between runs.
- **The fish always had fog; fog was never the problem.** `MeshStandardMaterial` respects
 `scene.fog` and the school always received it. It could not help, because fog only
 interpolates toward the water and a lit fish started an order of magnitude above it —
 measured off the composited frame, a shoal thirty metres out still put its brightest
 tenth near 143 against water at 36. Three things were actually holding it up: a base
 colour that was near white *before* the counter-shading multiplied it by a further 1.25
 (a gain hidden in a vertex buffer), a warm 2.1-intensity key that turns a near-white
 body cream — the "tan" in "tan paper scraps" — and metalness 0.15 at roughness 0.42,
 which on flat-shaded facets gave hard specular pinpoints that supplied every extreme
 pixel in the shots. The lever that fixes distance is `FOG_DISTANCE_GAIN`: one multiply
 on `vFogDepth` in the vertex shader. Because the fog is exponential in the *square* of
 depth, lengthening it is almost free near the lens and brutal far from it, which is
 exactly the ask. Do not take metalness to zero to chase the pinpoints — with no
 specular at all a fish near the lens is matte cardboard and loses the modelling that
 says which way it faces. Spread the lobe instead.
- **A fish close to the lens is the whole ballgame.** Everything above is about values,
 and none of it matters if a shoal drifts through the diver: measured at the mid-depth
 traverse, the nearest six instances sat between 0.8m and 1.8m out and the closest
 spanned *thirty-one degrees of frame*. At that size a flat-shaded octahedron is three
 grey facets and an outline, which is "paper scrap" in its purest form. `VIEWER_STANDOFF`
 bends a shoal's course around the diver, which is also what reef fish do. Its value is a
 balance, not a floor — it opens the band the school can be seen in and the fish fog
 closes it, so raising it empties the frame.
- **The school is judged in the upper frame, so it is easy to fly it out of shot.** The
 canonical cameras are pitched slightly *down*: their top edge is only about thirty
 degrees up, so a shoal cruising at nine metres and held at arm's length sits entirely
 above the frame. That failure looks exactly like "there are no fish" and is not — the
 school is right there. `scripts/probe-fish.mjs` counts what is actually inside the
 frustum and within fog range, which is the only way to tell the two apart.
- **One frame is not evidence about a school.** Where the shoals happen to be at second
 three says nothing about second forty, and a moving subject can look perfect in the
 canonical shot and be absent from every other moment. `probe-fish.mjs` walks shot B over
 time the way `probe-sanctuary.mjs` walks its sweep, and it isolates the fish by
 rendering each pose twice — once with the school hidden — so the difference is an exact
 per-pixel mask. Read its p90/p99, never its mean: most of a fish's pixels are its shadow
 side and its antialiased edge, and those average a real pop away to nothing.
- **Finding the darker morays**: only the snowflake moray sits straight ahead of spawn. The
  ribbon (left), zebra (right) and dragon (deeper, forward-left) require turning and are
  intentionally harder to spot — the zebra/dragon heads are dark against their caves. Use
  the `H` hint ladder (it targets the nearest undiscovered moray). All four are verified
  discoverable; placement/facing live in `SPOT_PLACEMENTS` in `src/world/Reef.ts`.
- **The soundscape is synthesised, like everything else here.** `src/audio/` holds the
  lifecycle (`AudioEngine`), the voices (`synth.ts` — ambience bed, bubble, FM chime,
  sanctuary pad), the timing of the one random layer (`BubbleScheduler`, pure and unit
  tested) and the orchestration (`ReefSoundscape`). There are no audio files and there is
  no reason to add any. `Game` drives it from state it already has: swim keys held,
  `onDiscovered`, sanctuary toggle, comfort panel open.
- **Nothing exists before the first gesture.** Browsers refuse to run a context that was
  not asked for, so `AudioEngine` holds two numbers until `start()`, and `start()` runs
  from `InputController.onFirstGesture` (canvas click or first keydown, whichever lands
  first). Every method is safe to call before that, which is what lets the game drive the
  soundscape without asking whether anyone is listening — and what lets `tests/audioEngine.test.ts`
  drive the whole thing in plain Node, where `window` does not exist. Keep it that way:
  no `AudioContext` and no `window` at module scope or in a constructor.
- **Sound cannot be reviewed from a screenshot**, so it reports on itself. `window.__reefAudio`
  is the soundscape (beside `__reef`), exposing bus levels, the bed's base cutoff and
  counters, which `tests-e2e/audio.spec.ts` asserts on; `probeRms` renders the same
  builders through an `OfflineAudioContext`. `node scripts/probe-audio.mjs <tag>` goes
  further and measures each layer — spectral tilt of the bed, the bell's decay ratio, the
  bubble's sweep, the size of the noise loop's seam — the way `measure-frames.mjs`
  measures a frame. Run it before and after a tuning change.
- **Audio gotchas that were paid for once already**: an exponential ramp cannot reach zero,
  so every envelope ends at `SILENT` rather than at 0. An LFO connected to an `AudioParam`
  *adds* to that param's automation, which is why the sanctuary can ramp the bed's cutoff
  while the drift keeps riding on top of it, and why `.value` reads the base and not what
  you would hear. The noise buffer's tail is crossfaded with material from just past its
  end, so shortening it or "cleaning up" that wrap puts a click in the loop every ten
  seconds. The chime's modulator has to decay faster than its carrier or the bell becomes
  an electric piano. And suspending the context at volume 0 must wait out the fade —
  suspending stops the clock the fade is riding on.
- The Vite build prints a >500 kB chunk warning (Three.js in one bundle). This is expected
  and is not an error.
