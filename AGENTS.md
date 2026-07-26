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
  swell, `ProceduralTexture` (the noise and map-building toolkit every surface is
  textured with) and `AssetLibrary` (the one door authored art comes in through).
- `public/assets/` — the only authored art in the project: four painted moray albedos.
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
- **Authored assets live in `public/assets/`, and there are exactly six of them.** Four
  animals and two surfaces, and every one of them is an albedo — that is the whole
  contract. `assets/creatures/moray-{snowflake,ribbon,zebra,dragon}-albedo.png` are
  painted body
  albedos, loaded by `src/rendering/AssetLibrary.ts` and swapped onto the moray body
  material in `Moray`'s constructor. Everything else on the animal stays generated: the
  swap replaces `map` only, because the wrinkles and the broken wet sheen live in
  `MorayPattern`'s normal and roughness maps and the painting has no channel for them.
  Which file a species wears is `albedoAsset` in `MoraySpeciesConfig`, so adding a
  species is still a data change.
  - **`assets/world/{sand,rock}-albedo.png` are the terrain tiles**, requested with
    `{ tile: true }` — mirrored repeat on both axes, which makes a generated image
    seamless by construction. Both are painted shadow-free, because the light has to
    move across the ripples and the strata, and both leave the procedural normal (and
    the sand's roughness) exactly where they were.
  - **A tile and a tint cannot both carry the colour.** The procedural maps are
    authored to sit *under* the material colour, so they are near white; a painted
    tile brings its own. Sand answers that by neutralising its tint to white on the
    swap. Rock cannot: `createRockMaterial` takes a colour per rock family and one of
    them is compositional — the `0x3a474a` foreground shoulder that crops shot A is
    only a shoulder while it is darker than the reef behind it. So rock *scales* its
    tint instead (`TINT_LIFT`), one multiply in linear space that gives back the
    luminance the map stopped supplying. Ratios between rocks survive a uniform scale,
    which is the entire point. Measure both means before changing either file — the
    canonical shots hold their frame mean to within one part in 255 across the swap.
  - **The rock tile's repeat is a physical scale, not a taste.** `boxProjectUvs` lays
    0.22 of a UV unit per metre, so `TILE_REPEAT = 2` is a tile every 2.3 m, and one
    repeat has to serve an eight-metre sea stack and a two-metre boulder because every
    rock in the reef shares one material. It was picked by rendering 1, 2 and 4 at
    three distances: 1 is a soft wash on anything you can swim up to, 4 averages back
    to flat at sea-stack range, 2 holds at both. The normal map stays at one tile per
    unit on purpose — its cracks are the rock's form, and colour finer than form is
    what stone actually looks like.
  - **The UV contract a moray skin is painted to.** `u` wraps the circumference — 0 the
    belly, 0.5 the spine, 1 the belly again — so the image's left and right edges are
    both pale underside and its centre column is the back. `v` runs the length, 0 at the
    snout and 1 at the tail tip, and the images are painted with the **head at the top
    row**. That last fact is why `flipY` is **false**: three's `TextureLoader` flips by
    default, which would sample the bottom row at `v = 0` and hang every eel's tail
    detail off its face. It was confirmed by rendering it both ways — with `flipY` left
    at its default the dragon's ocelli come out finest at the head and boldest at the
    tail tip, which is the painting inside out. Unflipped is also what the procedural
    maps do, since `DataTexture` does not flip either, so the two paths agree.
  - A map is stretched about three times harder along `v` than around `u` (the body is
    metres long and about a metre around), which is why the markings are painted roughly
    3:1 wide. That ratio is exact for the dragon and generous for the shorter, fatter
    snowflake, whose rosettes land a little banded — it is one image per species, not one
    per rig, so this is a compromise by construction.
  - **A missing file is not an error.** Loads never throw and never reject; a failure
    logs one `console.warn` and leaves the procedural skin exactly where it was, so the
    game still boots and still ships with no `public/` directory at all. The smoke spec
    asserts on `pageerror` only, which is what makes a warn the right channel.
  - **`whenAssetsSettled` gates the captures.** A texture that lands one frame after the
    shutter turns a fast machine and a slow one into two different pictures. `Game`
    exposes `assetsReady` on `window.__reef` and `scripts/wait-for-assets.mjs` polls it —
    with a ten second cap and a warning, since a shot of the fallback is still a valid
    shot — before `capture-shots`, `probe-moray` and `probe-sanctuary` pose. The same
    flag holds back `renderNextPortrait`: a codex plate is baked once into a data URL
    that nothing revisits, so taking it early would keep a procedural portrait of an
    animal that no longer looks like that for the rest of the session.
  - **Textures are owned by the library, not by the animals.** They are cached per path
    and handed to every reef moray, sanctuary resident and portrait alike, so nothing may
    dispose them per instance — the same rule the `MorayPattern` cache has, and the
    reason `disposeSubtree` releases geometries, materials and skeletons but not maps.
  - **The head wears a band at the front of the map, and mirrors it around.**
    The skull, snout, brow and upper jaw share `bodyMaterial`, and they used to
    wear it on the UVs their own primitives were born with — a sphere's `v` runs
    pole to pole, so between them they smeared the map's whole snout-to-tail
    length across twenty centimetres of head and rolled the counter-shading a
    quarter turn with it. `projectHeadUvs` (`MorayHeadUv.ts`) re-wraps them in
    the body's space instead, and `Moray` calls it once the head is assembled.
    `v` runs 0 at the frontmost point of the head to `MorayBodyGeometry.neckV`
    at the body root — the tube's own value there, 0.042 to 0.078 depending on
    the archetype — so the head reads as the head end of the map and agrees with
    the neck where they meet. The head is about three times longer than the
    slice it now wears, so its markings come out coarser than the body's; that
    is the trade, and it is the same one the maps already make along `v`.
  - **The head's `u` is mirrored, not wound**, and that is not a shortcut. It is
    the tube's own angle (0 belly, 0.5 spine) with the sign thrown away, so the
    two flanks are mirror images. A wound `u` has to jump from 1 back to 0 along
    a line running nose to neck, and a sphere poled along Y has no vertex column
    anywhere along that line — its own duplicated seam runs spine to belly
    instead — so the jump would land *inside* a quad and squeeze the entire map
    into a hand's width of garbage down the underside of every skull. Mirroring
    has no jump anywhere: `u` turns around at the belly and at the spine, which
    are the two lines a map painted to this contract is symmetric about. Three
    of the four are symmetric about `u = 0.5` to within about a sixth of their
    own contrast (measured off the images); the snowflake's are not, but its
    pattern is a scatter of rosettes and one arrangement of those reads as
    another.
  - **The lower jaw wears the skin too, on the belly side of that band.** It
    used to be a bespoke material at three-quarters of the body colour, which
    was a fair stand-in under a low-contrast procedural map and reads as a
    plastic bib under a painted one — it is the largest flat surface on the
    animal. It is projected in the same `projectHeadUvs` pass as the skull, in
    the `underside` list: it hangs below the tube's axis, so the angle already
    puts it at `u` 0 to about 0.18, the pale throat. The list exists for the
    hinge, which is fat enough to cross the axis — the crown of its rear ring
    scores `u = 0.5` while the same ridge at the front scores 0, so the map's
    whole belly-to-spine sweep ran along the jaw's top and an open mouth showed
    it. `FLANK_U` caps the wrap at the quarter turn. Adding the jaw did not move
    `noseZ` (the upper jaw is a centimetre longer), so the other four parts'
    UVs are unchanged to the bit — the render diff is jaw-only, which is how to
    check it after touching any head primitive.
  - **The nasal tubes are held below the accent colour.** They are the only
    unmapped skin left on the head, and an accent picked to be *found* across
    ten metres of water is, on a bare cone beside a painted face, the brightest
    flattest thing in frame. `softenAccent` keeps the hue — a ribbon's nostrils
    are yellow, that is the field mark — and takes saturation and value down,
    in sRGB, because three's `getHSL`/`setHSL` default to the linear working
    space where the same fraction is a far deeper cut.
  - Only texture coordinates are written. Positions and transforms are
    untouched, which is what keeps `getHeadWorldPosition` — and the focus cone,
    the sightline raycast and `tests/reefSightlines.test.ts` tuned against it —
    exact.
- **The value key is a painted one, and it is held in four places at once.** The target is
  a picture-book memory of shallow water, not a photograph of it: bright mid-key
  turquoise, shadows that are blue-violet, distance that goes *milky-bright* rather than
  dark, and nothing anywhere near black. It is spread across `UnderwaterFog` (the water's
  own colour), `Lighting` (the ratio between key and fill), `ColorGradeShader` (the floor
  and the split) and `RendererAdapter` (the curve), so any one of them changed on its own
  will fight the other three. Four things about it were paid for by measurement:
  - **The fog colour sits above the reef's midtone, not below it.** Distance loses
    contrast and local colour — it does not gain darkness. This is the one inversion the
    whole look rests on, and it is why the `UnderwaterFog` defaults are so light.
  - **Read the red channel first.** A turquoise mixed from pigment carries far more red
    than the same hue read off a photograph. Take red toward zero anywhere — in the fog
    colours, in the shadow tint, or by pushing `uSaturation` up on an already cyan frame —
    and the water turns an electric poster-paint cyan that no paint box contains. That
    failure looks like "too saturated" and is actually "one channel is missing".
  - **A hemisphere's sky colour lands on the whole seabed**, because the seabed faces up.
    So the cyan half of the hemisphere is not fill, it is floor paint, and a cast shadow
    on it is only that same cyan with the sun subtracted — an ordinary cool blue-green
    shadow, which is exactly what the pivot is trying to get away from. For a shadow to
    be *violet* the violet `AmbientLight` has to be the larger of the two, and its red has
    to sit above its green. Fill was moved from the hemisphere into the ambient to buy
    that, at constant total light, and `uShadowTint` holds red at 1.0 for the same reason:
    with red below green it quietly took the violet back out again.
  - **There is a floor and there is no toe.** `SHADOW_LIFT` in `ColorGradeShader` adds a
    blue-violet constant to whatever is darkest, so the darkest thing in the world is a
    colour rather than the absence of one. It replaced a toe that did the exact opposite.
    `uContrast` is deliberately *below* 1: a gouache painting has a shorter value range
    than a photograph, and above 1 the grade spends that range separating sunlit sand
    from water — the very split this look exists to close.
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
  the same curve and sRGB transfer the screen gets, on the CPU — currently a hand port of
  three's `NeutralToneMapping`, line for line off
  `tonemapping_pars_fragment.glsl.js`. Change the renderer's tone mapping and that port
  has to follow, or every codex plate is a different animal from the one in the water.
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
- **A fish's tail fork rides on a merge that can fail silently.**
 `createFishGeometry` merges an octahedron body with two cone blades, and
 `mergeGeometries` takes its indexing from the first geometry and then rejects
 every other one that disagrees. `PolyhedronGeometry` builds bare triangles with
 no index; `ConeGeometry` builds a vertex grid with one. So the merge returned
 null, the `?? body` fallback quietly handed back a bare diamond, and for a
 while every fish in the reef swam with no tail — behind a single console error
 and nothing the frame could tell you, because a diamond ten metres out still
 reads as a fish. The blades are `toNonIndexed()` now. Nothing is lost by it:
 the material is flat-shaded, so the vertices an index shares would have to be
 split for their face normals anyway. The counter-shading is read across the
 *body's* vertical extent and clamped, rather than re-read per part — a blade a
 centimetre and a half tall would otherwise run the whole dark-back-to-pale-belly
 ramp across itself and hang a belly-bright edge off the top of the tail.
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
