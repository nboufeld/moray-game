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
 `MorayBody` (the skinned tube and dorsal fin its joint chain drives) and `MorayOutline`
 (the contour hull, which the animals wear and nothing else does).
- `src/creatures/fish/` — `FishSchoolSystem` (instanced ambient fish).
- `src/discovery/` — `FocusScanner`, `DiscoverySystem`, `HintSystem` (all pure/testable).
- `src/rendering/` — fog + gradient backdrop, lighting, caustics, light shafts, particles,
 the `ColorGradeShader` used by the post chain (paper grain and watercolour pooling
 included), the `DiscoveryPulse` that drives its
 swell, `ProceduralTexture` (the noise and map-building toolkit every surface is
 textured with), `AssetLibrary` (the one door authored art comes in through) and
 `ImagePixels` (the only place an authored image is read back rather than uploaded).
- `public/assets/` — the only authored art in the project: four painted moray albedos,
 a sand and a rock wash, a grass blade strip, a caustic dapple sheet and the painted
 water column.
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
 The four additive light layers have `node scripts/probe-light.mjs <tag>`, and they need one:
 caustics, shafts, bubbles and motes are faint marks spread over a bright frame, and a
 screenshot cannot tell "too faint to see" from "not drawing at all" — both are sand. It
 renders each pose twice, once with the layer hidden, and reports what the difference
 actually is in parts of 255, plus how warm it is and how much of the frame it touches. It
 also walks the opening shot through simulated time, because two of those layers only exist
 in motion. The painted finish — grain, pooling, contour — has
 `node scripts/probe-paint.mjs <tag>`, which does the same trick and also *times* each
 layer directly rather than through rAF deltas; it is the only harness here fine enough
 to attribute a few milliseconds to one pass.
 The DOM has `node scripts/probe-ui.mjs <tag>`: the shot set opens the comfort panel in
 D and the sanctuary in E and never opens the codex, raises the discovery plate, fills
 the focus ring or shows the keyboard ring at all, so four of the six surfaces a UI
 change touches are in no canonical shot.
 `node scripts/frame-stats.mjs <before.png> <after.png>` does the other half:
 value statistics for two archived shots and the difference between them, which is how a
 claim like "held the frame mean to within one part in 255" gets made at all. Watch its
 tenth percentile — a veil of additive light shows up there first, because it lifts the
 darks and leaves the highlights alone.
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
  outline.   The map's own window (`POOL_TEXTURE_FADE_*`) covers the ordinary case;
  `POOL_RIM_FADE` is the part filtering cannot reach.
- **The light effects are painted marks now, not simulated ones** (WP-G4). Caustics are
  round dapples rather than a filament web, shafts are a few wide soft warm ribbons rather
  than eight narrow cool ones, motes twinkle, and bubbles rise from vents in the sand. The
  test for all four is the same: a photograph of a real reef is the wrong answer. Six
  things about it were paid for by measurement rather than judged:
  - **A dapple's warmth has to be over-mixed, because it lands on sand.** Sand is a warm
    surface, so its blue channel sits low and its red high, and sRGB's curve is steepest
    where a channel is darkest — add light in the proportion you want to see and blue
    moves further in the encoded frame than red does. A (1.0, 0.98, 0.88) dapple measured
    *neutral* to within half a part in 255 on the composited frame. Pulling blue to four
    fifths is what buys back the warmth. The same trap is waiting for anything additive
    laid on the seabed.
  - **The caustics' reach is measured from the world origin, and the opening camera is 22m
    out.** It ended at 14m while the pattern was filaments, which put the entire foreground
    of the game's first frame outside it — the largest surface in the shot, bare. The old
    argument for stopping early (scattered light cannot focus into filaments) died with the
    filaments: a soft round blob is exactly what scattered light leaves.
  - **Screen width is width over distance, and one canonical camera stands six metres from
    a beam.** Widening every shaft by the same three fifths gave the mid-depth traverse a
    curtain across 99% of its frame, its tenth percentile up eight parts and its red mean
    up twenty. That is the veil the (11, 15) beam was moved out for, arriving from the
    other direction. The three staged beams take the full widening; the beam at (5.5, 8.5)
    and the distant three do not.
  - **A warm additive costs more than its luminance says.** This water has very little red
    in it, so the same brightness of warm light is far more visible than of cool — which is
    the value key's own "read the red channel first" rule, seen from the light's side. The
    shafts' base opacity came down a third when their tint went warm, and that is most of
    what paid for the wider, flatter beams.
  - **The motes twinkle without a shader patch.** Under additive blending brightness and
    opacity are the same quantity, so the swell rides in a per-point colour attribute
    written by the CPU loop that was already moving them. `PointsMaterial` has one `size`
    for the whole cloud and patching `gl_PointSize` would mean string-matching a literal in
    three's points shader; a colour attribute is a documented path and costs one multiply
    per mote. The phases are drawn *after* every position so that adding them left the
    drift field bit-identical.
  - **Bubbles are the one thing here that is added rather than retuned, and their cost is
    their size.** `Bubbles` is a single `InstancedMesh` — one draw call, four dozen
    camera-facing quads wearing a shared ring sprite, a matrix per bubble rebuilt on the
    CPU. Measured at 2.6ms of a 281ms frame, and covering four tenths of one percent of
    the opening shot, which is what makes the count a free parameter and the radius an
    expensive one. Three things are deliberate: it fades at both ends of its climb by
    *scale* rather than opacity, so every instance can share one material; it is
    `fog: false` like the shafts, because fog on an additive surface brightens distance
    instead of closing it; and `frustumCulled` is false, because every instance moves every
    frame and a bounding sphere computed from the matrices is stale before it is read. The
    vents are authored, not scattered, and they stay out of the morays' approach corridors
    — a bubble cannot obstruct a sightline, but this game asks the player to hold still and
    look at a dark head, and a bright thread drifting over it is something to look past.
  - **The crevice mouths are violet-blue** (`caveInterior` in `Reef.ts`), not the near-black
    they were: the darkest thing in this world is a colour, and a hole punched in the reef
    is where the eye goes first. The zebra and the dragon were tuned to read against the
    black, so both were re-checked at `probe-moray.mjs` range afterwards — they read
    *better*, because violet is the complement of the dragon's orange, and the discovery
    spec is green. If a future skin does vanish into it, that is the skin's problem and not
    the detection code's.
- **The frame is finished like a painting, and only the characters carry a line**
 (WP-G5). Three marks, and the split between them is the rule: a Ghibli background has
 no outline anywhere — rock, sand, coral and water are painted shapes meeting each other
 — and the characters drawn over it do. So the reef gets paper and pooled pigment, the
 morays get a contour, and the fish get neither (at their size a hull is sub-pixel).
 `node scripts/probe-paint.mjs <tag>` measures all three the way `probe-light.mjs`
 measures the additive layers, and it exists because none of them can be judged from a
 screenshot: two of them move the frame by one to three parts in 255.
 - **The paper is a sheet the picture is printed on, so it lives in screen space.** A
 256px seeded fbm `DataTexture` (`SEEDS.paperGrain`), sampled once at the very end of
 the grade as `0.97 + grain * 0.06`. Its repeat is set from the *composer's buffer*
 size in `RendererAdapter.applySize`, not from the canvas: the grade runs on the
 internal targets and the adaptive scaler moves them, so anything measured in canvas
 pixels swims when the scaler steps. The sheet is owned by the adapter rather than
 hung on `ColorGradeShader.uniforms`, because `ShaderPass` clones the uniforms it is
 handed and `cloneUniforms` clones textures with them — a map parked there is uploaded
 twice and the original orphaned.
 - **A swing of a percent and a half is not visible, and that is arithmetic rather than
 taste.** The grade multiplies *linear* light and the sRGB transfer flattens a
 proportional change by about half on the way out, so 1.5% lands as one part in 255 —
 under the frame's own dither, and the probe reports it as a range of -2..2 with a
 median of nothing. Three percent lands at two to three parts, which is a tooth you can
 find in the flat water of shot A and cannot find in the sand. Six is mottling.
 - **The pooling is a multiply by the water, which is what stops it reaching black.**
 Where a luma difference crosses `EDGE_LOW..EDGE_HIGH` the pixel is taken 6% down and
 a fifth of the way toward `uPoolTint` — the scene's own fog colour, scaled so its
 largest channel is 1 and read off `scene.fog` every frame in `render()`, so the reef
 and the sanctuary pool in their own water without `Game` plumbing a colour it already
 told the scene. A *mix* toward the fog colour would have lightened every dark pixel
 in the frame, because this fog sits above the reef's midtone; a multiply by a tint
 whose peak is 1 can only ever darken, and what it takes out is red. It runs before
 the rest of the grade, on the picture, so the shadow floor still catches it.
 - **Two taps, not four, and the thresholds are two thirds rather than half.** A
 full-frame texture fetch costs four to five milliseconds on the software rasteriser
 the capture harness runs on, so a symmetric cross was eighteen — more than everything
 else in this package together. Forward-differencing from the pixel already in hand
 halves the bill and moves the mark half a pixel, which on a soft darkening cannot be
 seen. Halving the thresholds to match over-fired, though: the steps in this frame are
 two or three pixels wide after the bloom, so a one-texel difference is more than half
 a two-texel one.
 - **The contour is an inverted hull, and it is the cheapest way to line a *skinned*
 character.** `MorayOutline.ts` builds it and `Moray` is the only caller. The skinned
 hulls share the surface's geometry, skeleton *and* bind matrix — they are not a copy
 of the pose, they are the pose, which is why the line follows the wave down the body
 for nothing. The head hulls cannot share: a head is built from squashed primitives
 (the brow is nearly twice as wide as it is deep) and a constant push along an
 object-space normal under a non-uniform scale is a line of two different widths, so
 those clone the geometry with the node's scale baked in and sit at unit scale. The
 push is a `begin_vertex` injection on a `MeshBasicMaterial`, in object space
 deliberately: `begin_vertex` runs before `skinning_vertex`, so the bones carry the
 offset with the vertex.
 - **Three things the hull must not do**, all of them one line each and all of them
 easy to lose: it must not cast a shadow (`Moray` switches shadows on for every mesh
 under its root, so the hulls are added *after* that traverse and set false), it must
 carry the surface's own `boundingSphere` (three bounds a skinned mesh from the first
 pose it draws and never again — a body in frame with its line culled is a body that
 lost its outline), and it must not go on the eyes. The catchlight is a bloom source
 wearing a sphere, and the one spark the discovery moment is built around is not
 something to draw a dark ring around.
 - **Nothing raycasts a moray**, so the hulls cannot intercept anything: `Game.isObstructed`
 tests `Reef.obstructionMeshes`, which is rock and mound only. That was checked rather
 than assumed, and it is why there is no `raycast = () => {}` here to explain.
 - **The ink is the species' own colour, mixed 60% toward a dark blue-violet, in sRGB.**
 The same reasoning as `softenAccent`: the palette was picked in the space a painter
 reads, and the same fraction in three's linear working space is a far deeper cut —
 mixed linearly the cream snowflake wears a line at four tenths of its own value,
 which is a smudge. One consequence is deliberate and worth knowing before it is
 reported as a bug: the zebra's line comes out *lighter* than its near-black body, and
 a dark species in a dark crevice has a contour you can barely see. A line is a value,
 and no value reads against itself. The thickness is 12mm in the animal's *local*
 space, so it thickens with the reef's 1.5× morays and thins with the sanctuary's,
 which is what a drawn contour does.
- **Authored assets live in `public/assets/`, and there are exactly nine of them.** Four
  animals, three surfaces, one light and one sky (WP-G6 added five and retired the two
  photographic terrain tiles). Every one of them is a colour image and none of them is a
  normal, roughness or alpha map — that is the whole contract, and it is what keeps the
  form procedural and the paint authored.
  `assets/creatures/moray-{snowflake,ribbon,zebra,dragon}-albedo.png` are
  painted body
  albedos, loaded by `src/rendering/AssetLibrary.ts` and swapped onto the moray body
  material in `Moray`'s constructor. Everything else on the animal stays generated: the
  swap replaces `map` only, because the wrinkles live in `MorayPattern`'s normal map and
  the painting has no channel for them. (There was a roughness map here too, for a wet
  animal's broken specular; ramp shading has no specular to break, so it is gone.)
  Which file a species wears is `albedoAsset` in `MoraySpeciesConfig`, so adding a
  species is still a data change.
  - **`assets/world/{sand,rock}-wash.png` are the terrain tiles**, requested with
    `{ tile: true }`. Both are painted shadow-free, because the light has to move
    across the ripples and the strata, and both leave the procedural normal exactly
    where it was.
  - **`tile` means plain repeat, and that is a measurement rather than a default.**
    It used to mirror, on the argument that a generated image never wraps perfectly.
    The argument was never tested, and the painted washes wrap to within about one
    part in 255 — the step across the join against the step between neighbouring
    columns inside the image, which is how to check any tile that arrives. What
    mirroring costs is not hypothetical: a mirror is invisible only on material with
    no direction in it, and a wash of ripples is nothing but direction, so every band
    turned around at the join and put a crease down the seabed at the tile's spacing.
    It was clearly visible in shot C at `SAND_WASH_REPEAT`.
  - **A tile and a tint cannot both carry the colour.** The procedural maps are
    authored to sit *under* the material colour, so they are near white; a painted
    tile brings its own. Sand answers that by neutralising its tint to white on the
    swap and levelling the *image* instead — the wash is painted at 0.77 in linear
    luminance against the 0.39 the seabed ships at, so `WASH_LEVEL` takes it back, and
    it is per-channel because the painting is a more saturated yellow than this water
    can carry (flat, the seabed came out sixteen parts short of blue and took the
    whole frame a dozen parts warm with it). Rock cannot neutralise:
    `createRockMaterial` takes a colour per rock family and one of them is
    compositional — the `0x3a474a` foreground shoulder that crops shot A is only a
    shoulder while it is darker than the reef behind it. So rock *scales* its tint
    instead (`TINT_LIFT`), one multiply in linear space that gives back the luminance
    the map stopped supplying; it went 2.85 → 2.07 when the tile went from a 0.27
    limestone photograph to a 0.386 gouache wash. Ratios between rocks survive a
    uniform scale, which is the entire point. Measure both means before changing
    either file — the canonical shots hold their frame mean to within three parts in
    255 across the whole package.
  - **The rock families needed no colour change and that is the point.** They were
    already all but neutral (`0x8b9184` is four parts of saturation), so the wash's
    grey-lavender-sage arrives as the stone's actual hue instead of being multiplied
    into the olive the old tile was. If a family is ever given a real colour again it
    will fight the painting, not tint it.
  - **The sand wash is laid at half the procedural rate** (`SAND_WASH_REPEAT` 7
    against `SAND_REPEAT` 14) and its contrast is opened 2.6× around its own mean at
    load, in `openWash`. Both are answers to the same fact: the normal map's ripples
    were tuned as *surface* and the wash's are the *drawing*. At 14 a painted ripple
    is 70cm across and gone into the mip chain by the middle distance; at 7 it is a
    metre and a half. And the file swings about 4% peak to trough, which on a surface
    sitting near 200 in the frame is two parts in 255 — under the dither, by the same
    arithmetic WP-G5's paper grain was sized with. The boost is mean-preserving, so
    the level above still means what it says.
  - **The rock tile's repeat is a physical scale, not a taste.** `boxProjectUvs` lays
    0.22 of a UV unit per metre, so `TILE_REPEAT = 2` is a tile every 2.3 m, and one
    repeat has to serve an eight-metre sea stack and a two-metre boulder because every
    rock in the reef shares one material. It was picked by rendering 1, 2 and 4 at
    three distances: 1 is a soft wash on anything you can swim up to, 4 averages back
    to flat at sea-stack range, 2 holds at both. The normal map stays at one tile per
    unit on purpose — its cracks are the rock's form, and colour finer than form is
    what stone actually looks like.
  - **`assets/world/backdrop.png` is the water column, and the fog is read off it.**
    It goes through `requestBackdrop`, which is the one place `flipY` keeps the
    loader's default: a panorama's `v` is altitude and three's `equirectUv` reads
    `v = 1` overhead, which is where the painting's surface is. On arrival
    `UnderwaterFog.adoptBackdrop` hangs it, disposes the gradient it replaces, turns
    it so its painted sun (`PAINTED_SUN_U`, measured as the brightest column of the
    top eighth) sits over the world's actual sun, and — the part that matters —
    samples a sixteen-row strip at the horizon and makes that the fog colour. Fog
    fades geometry toward `scene.fog.color` and the pixels behind it are the
    painting, so any difference between them is a band along the horizon; sampling
    makes the two one quantity, and the file can be repainted without anyone
    remembering to re-pick a number. Both sides live in the same linear render
    target, with the tone curve and the grade downstream of both, which is why an
    sRGB average set as a linear colour is the exact match. Measured on shot A the
    sand emerges out of the water by warming four parts over six rows, with green and
    blue continuous to within one.
  - **`BACKDROP_EXPOSURE` is the one number allowed between the painting and the
    world.** The panorama is painted half a stop above this reef's key — its horizon
    is #68dbd9, very nearly the hue the fog was already tuned to and much brighter —
    and hung as it comes it lifted the canonical shots twelve parts at the mean and
    eighteen at the p90, turning luminous turquoise into haze. It is applied to
    `scene.backgroundIntensity` *and* to the sampled horizon, so the agreement above
    survives it. At 0.64 the derived fog lands within a part of the `0x53b2bb` it
    replaces on every channel: the painter and WP-G1 agreed about the colour and
    differed only about the exposure.
  - **The sanctuary keeps its gradient**, and that is the one place the room does not
    follow the reef. Hanging the painting there was tried and measured across the
    sweep — same 83.3ms, slightly deeper water — but the fog comes off the same file,
    so the bay ends up in the reef's ocean exactly, and a shade of warmth was the only
    thing that ever said it was somewhere else. Compare `tmp_S-sanctuary-t*` under the
    `g6-gradient` and `g6-backdrop` tags.
  - **`assets/world/caustic-dapple.png` beat the generated dapples on both counts.**
    Measured through `probe-light.mjs` with nothing else changed, the painted sheet
    covers slightly *less* of the frame (23% against 25% in shot A) and hits two and a
    half times harder at the p90, 58 against 23 — it spends its light on a few big
    cores instead of spreading it — and it measures genuinely warm, R−B +6.2 against
    +0.5, which is the trap the generated one never escaped: sand is a warm surface,
    so adding warm light in the proportion you want to see comes out neutral in sRGB.
    A painting mixes it thicker. The layer opacity came down a third (0.26 → 0.17) to
    pay for it, because at the old figure the opening shot's median rose eleven parts
    — the seabed going pale. Both layers `clone()` the one loaded texture, sharing its
    `Source` and so its upload, because each needs its own drifting `offset`; nothing
    disposes a clone, since that would take the library's shared source with it.
  - **`assets/world/grass-blade.png` is unpacked, not alpha-tested.** It is painted as
    a tapering blade on black, and the obvious use — an alpha map — is the wrong one:
    the geometry is already a tapered curled blade, so a cut-out buys no silhouette,
    and a mostly-black image mipped down to the two pixels a distant blade covers
    averages to black and puts a dark meadow at the back of the frame. `fullBleed`
    stretches each row's painted span out to the full width instead, bottom row first
    because the strip is painted tip-up and a blade's `v` runs root to tip, and
    `levelToBlade` scales the result per channel onto the generated map's own mean.
    That second step is what keeps the per-instance palette working: the greens and
    their wide value spread are the meadow's variety, and a painting laid over them
    unlevelled is a stand of near-black weed.
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
  - **Three of them are read on the CPU as well as uploaded**, through
    `src/rendering/ImagePixels.ts`: the backdrop's horizon strip, the sand wash's
    contrast, the grass strip's unpack. It is inert without a `document`, like the
    library itself, and it never scales an image while reading it — a 1:1 `drawImage`
    plus `getImageData` is an exact copy of the decoded file, which is what keeps two
    runs of the same browser bit-identical. A transform always produces a *second*
    texture and every caller memoises it, because the source is shared by path and
    the copy is a second upload.
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
    What a *caller* owns is the procedural map it was constructed with, which is why
    `CausticsSystem` disposes its generated sheet on the swap and nothing disposes the
    painted one.
  - **The no-assets build is a shipping configuration, so look at it.** Every surface
    is covered by a file now, which means the procedural maps are only ever seen with
    `public/assets` missing — and a fallback nobody looks at drifts back toward the
    photographic frame this pivot left. `SHOT_NO_ASSETS=1 npm run shots -- <tag>`
    builds exactly that world by failing the requests at the network, so nothing on
    disk moves and there is no cleanup; `measure-frames.mjs` takes the same flag and
    it is the cheapest same-session baseline for what the paint costs. WP-G6 retuned
    all three fallbacks to match what the paintings actually land on: the sand's base
    is a pastel `0xd9c9a3` with every tone term halved, the rock map is half its old
    swing with the cracks and joints at half again (`rockTerms` splits `form` from
    `wash` for exactly that — a drawn rock has its breaks in the drawing, not in its
    local colour) and wears the wash's own grey-lavender-sage, and `MorayPattern`'s
    counter-shading runs 0.86–1.14 where it ran 0.72–1.22. That last one is the same
    mistake as a roughness map under a ramp: modelling the light on a cylinder on top
    of shading that already models the light on a cylinder, which gives the eel a dark
    back it never recovers from. Painted counter-shading is a *marking*.
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
- **The UI is a page from the same book, and it is all in `src/style.css`** (WP-G7).
  The panels were navy glass, which is the right answer over a photograph and the
  wrong one over gouache: a dark card is the only surface in frame the paint never
  reaches. They are cream paper now (#f7ecd7 at 92%, 14px corners, an ink-blue
  #2b3a55 body, a warm ink shadow instead of a black one), and the markup did not
  move — no class, no role, no string and no focus order changed, so the e2e specs
  that drive the comfort panel by keyboard and read the name plate never saw it.
  `node scripts/probe-ui.mjs <tag>` walks all six surfaces, because the canonical
  shot set holds only two UI frames and four of the things a restyle can break are
  in neither.
  - **The accent has to exist at two values, and that is arithmetic.** `--amber`
    (#ffca7a) measures 1.28:1 on cream — it was legible only because it used to sit
    on navy. So the bright amber stays for marks that go over the *water* (the
    reticle, the plate's rules, a filled key) and `--amber-ink` (#8c5210, 5.39:1)
    carries every warm *word*. Same hue, different value; the same split
    `softenAccent` makes on a moray's nostrils. `--sea-ink` (#0f5e5c, 6.18:1)
    replaces the turquoise on the same grounds. Measured against the paper:
    ink 9.75:1, `--ink-soft` 5.83:1, and 4.79:1 for the worst case in the file
    (amber ink on the shaded foot of the codex gradient). All of it clears AA, and
    the amber is never body text.
  - **The modal dim is teal, and the old one was quietly a navy.** Measured on the
    same patch of open water in shot D's pose, 72% of near-black left the reef 40 of
    its 100 parts of chroma *and put blue above green* where this water has green
    above blue. Deep teal at 46% leaves 75 and keeps the order. Nothing in this
    world reaches black, so nothing laid over it may either.
  - **The keyboard ring has to be authored.** Chrome's default focus ring is a dark
    blue halo tuned for a white page, and on cream it is the last thing in the UI
    still wearing the old palette. It is amber ink at 3px with a 2px offset, on
    `:focus-visible` only — what takes focus, and in what order, is untouched.
  - **The native controls are dressed, not replaced.** `color-scheme: light` and one
    `accent-color` put the comfort panel's checkboxes and sliders on paper in the
    amber family. Nothing there is a custom control: `appearance: none` on a range
    means owning a thumb, and that panel is the one part of this game an e2e spec
    drives entirely from the keyboard.
  - **The codex plate stays dark water on purpose.** It is an illustration mounted on
    the page rather than another panel, and its fill matches `MorayPortrait`'s own
    `BACKDROP` so the empty frame is the same colour as the picture that lands in it.
    The mat around it is paper.
  - **The reticle's radius is shared with the scanner.** `Hud.setFocus` computes the
    dash offset from r = 20, so the ring's weight and colour are free to move and its
    geometry is not.
  - **A stopped render loop stalls CSS animation time.** `capture()` holds a frame,
    and with no rAF running the document timeline advances at a fraction of wall
    clock — the discovery plate's rise took 1.2s of real time to reach 400ms of its
    own. Any harness that screenshots an animated overlay has to wait on the computed
    style rather than on a clock, which is what `probe-ui.mjs` does.
- **The value key is a painted one, and it is held in five places at once.** The target is
  a picture-book memory of shallow water, not a photograph of it: bright mid-key
  turquoise, shadows that are blue-violet, distance that goes *milky-bright* rather than
  dark, and nothing anywhere near black. It is spread across `UnderwaterFog` (the water's
  own colour), `Lighting` (the ratio between key and fill), `ToonShading` (how far apart
  the bands land and how dark a shadow may be), `ColorGradeShader` (the floor and the
  split) and `RendererAdapter` (the curve), so any one of them changed on its own
  will fight the other four. Four things about it were paid for by measurement:
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
- **Every lit surface in the project is a `MeshToonMaterial` reading one shared ramp.**
  `src/rendering/ToonShading.ts` owns the ramp and `createToonMaterial`, and nothing else
  may build a lit material — sand, rock, coral, grass, rubble, fish, moray skin, fins,
  nasal tubes and eyes all come out of that one door, in the reef and in the sanctuary
  alike. There is no roughness and no metalness anywhere any more: the moray's wet-sheen
  roughness map, the sand's damp variation and the fish's metalness and aimed sun glint
  were all deleted rather than turned down, because a specular response is the single
  loudest "photograph" tell in a frame. A painted highlight comes back later as pigment.
  The two things that are deliberately *not* toon are the eyes' catchlight spheres and
  every `MeshBasicMaterial` (shafts, caustics, cave-mouth stickers, motes): none of them
  is a shaded surface, they are emissive marks, and stepping them would only risk the one
  spark the discovery moment is built around. The bubbles joined that list in WP-G4 for the
  same reason.
  - **The ramp is authored against the normals this reef actually has.** Its lookup is
    `dot(n, l) * 0.5 + 0.5`, and with the sun 48° up, every up-facing plane in the scene
    piles up between 0.80 and 0.88 while everything facing away falls below 0.5, with
    almost nothing in between. So the two steps sit at 0.5 and **0.82** — the second
    *inside* that cluster, which is what separates a plane square to the sun from one
    merely turned toward it. A stop anywhere between 0.6 and 0.78 gives a boulder two
    values instead of three and it goes flat. Move the sun and this has to move with it.
  - **A shade band is a floor under the key, and it costs shadow colour.** The bottom
    band hands a surface facing *away* from the sun a quarter of the key it used to be
    denied, and that light is warm — so raising it dilutes WP-G1's violet shadows and
    lifts the frame's tenth percentile with it. 0.35 measured eight parts in 255 of lift
    across the canonical shots and took the violet out; 0.26 is where the shadow keeps
    its colour and is still a colour rather than a hole.
  - **A ramp also hands the whole key to anything in its top band**, rather than that
    plane's own cosine — the seabed used to take 75% of the sun and now takes all of it.
    So `Lighting`'s key is a *contrast* control here and a very sensitive brightness one:
    it went 1.5 → 1.75 → 1.6 during WP-G2, and the ambient came down 0.8 → 0.74 to pay
    for it, because anything more brightens the largest surface in frame faster than it
    opens the steps. The sanctuary tracks both.
  - **16 texels is one too few.** A `RAMP_SOFTNESS` of 0.08 falls inside a single texel
    gap at that size, so the texture declares a soft edge and `LinearFilter` reconstructs
    a cel one — measured, a 0.39 jump between neighbours at the terminator. 32 puts two
    and a half texels in the window. It costs 128 bytes.
  - **`flatShading` has to be assigned, not passed.** Three neither declares nor
    initialises it on `MeshToonMaterial`, so the constructor drops it — but the renderer
    reads it off the material generically and `getProgramCacheKeyBooleans` hashes it, so
    assignment works and caches correctly. `createToonMaterial` does it, behind a module
    augmentation of the three types. It assigns `false` and takes no option: since WP-G3
    nothing lit in this project is faceted, and the augmentation stays so the flag can be
    written at all rather than left as a property three never defines.
  - **Normal maps run at half strength** (`TOON_NORMAL_SCALE`). Under a BRDF a normal map
    modulates a gradient; under a ramp it modulates *where the step falls*, and at full
    strength the band boundary breaks into noise and the form stops reading.
- **Nothing in the reef is faceted any more, and turning the flag off was the small half
  of that.** Flat shading used to be deliberate — chiselled, not smoothly rendered CG —
  and chiselled is a photograph's rock. Two things had to change together, because the
  facets live in the *buffers* as much as in the materials: everything out of
  `PolyhedronGeometry` is non-indexed, so `computeVertexNormals` writes a face normal to
  every vertex and a smooth-shaded icosahedron is still a cut gem.
  `src/rendering/SmoothNormals.ts` welds normals by quantised position — 0.1mm, because
  the two copies of a shared edge are floats arrived at along different arithmetic paths
  — and touches no position and no index, which is what makes it safe on geometry the
  game raycasts. `weatherRock` calls it, and so do the coral boulder and the rubble
  pebble, which do not go through `weatherRock`.
  - **The order inside `weatherRock` is load-bearing**: displace, `computeVertexNormals`
    (flat), `boxProjectUvs`, *then* weld. Box projection picks its axis from the normal,
    so it needs all three corners of a triangle to agree; weld first and neighbouring
    corners choose different planes, which warps the map inside the triangle instead of
    at its edge.
  - **The crevices are exempt from the geometry half, by construction.** The four hiding
    spots' mounds and flanks pass `preserveProfile`, which keeps the old displacement
    field and therefore every vertex position they have ever had. They are placed to the
    centimetre against the discovery raycast, and a rounder mound is a gameplay change
    that no screenshot can distinguish from an art one. They take the smooth normals,
    which is the half the camera reads. If you ever do move them, `weatherRock` on a
    crevice mound must still stay `inwardOnly` (see below).
  - **A round rock is low-frequency and high-amplitude.** `ROUND_PERIOD` 3 at two
    octaves, and a third more displacement to pay for the fine octaves that are gone:
    the outline used to be nibbled everywhere by four scales of noise, and two octaves
    at the old amount is most of the way back to a marble.
- **Rock UVs are box-projected at build time**, not triplanar. Triplanar would cost three
  fetches per map on the largest surfaces; box projection is one. Flat shading used to
  break the normal along the same edges its seams land on and hide them; on a smooth
  boulder the seam is a visible change of grain direction where the wash swings axis.
  Measured across the canonical shots it is not worth a second texture fetch — the maps
  it lays are low-contrast noise, and noise has no direction to contradict.
- **The garden and the meadow are round for the same reason the rocks are.** Coral
  branches are `CapsuleGeometry` rather than cones — a spray of points is a sea urchin,
  and the extent is matched to the cone's (1.1 of trunk between two 0.16 caps against the
  cone's 1.5) precisely so every `addBranching` transform still plants its foot in the
  sand. Grass blades are 0.182 wide, two fifths up from a wire, and curl to `t*t*0.35`,
  which is the only reason the blade is tessellated; the palette is bright spring greens,
  because the old bottom end (0x2f7a58) was mixed against water that had a photograph's
  darkness in it and reads as a shadow against WP-G1's turquoise. Widening a blade costs
  nothing measurable — the instance count, the draw call and the vertex work are all
  unchanged — and it is the cheapest lushness in the project.
- **The seabed's marks all come out of one image now** (WP-G6). WP-G2 took the ripples
 out — a normal map cannot shade inside a toon band — and rounding the rocks, the coral
 and the grass around it left the bare sand plane as the one surface that read as a
 render. The answer was not geometry and not the ramp: it is `sand-wash.png`, laid at
 half the procedural rate and opened up. A flat plane sits in a single shading band from
 here to the fog line, so whatever is painted in that file is the entire drawing of the
 largest surface in the game; if the floor ever goes blank again, that is where to look.
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
 fin has its **own material**, which used to be about roughness — at the accent's sheen a pale
 fin caught edge-on rendered as a bright spike over the head — and since WP-G2 is only about
 carrying the accent colour, because there is no sheen left to hold down. Geometry is authored
 in *joint units* (`g`), so a fractional position along the
 body is also literally its skin weight. The head is not part of any of this: it hangs off
 `bodyRoot`, so `getHeadWorldPosition` is the root's own world position and no body change can
 move it.
- **The moray's rim light must stay directional**, and it survived the move to toon
  untouched — the toon fragment shader carries `normal_fragment_maps` in the same place
  and reaches `totalEmissiveRadiance` the same way, and emissive is the one channel a
  stepped light leaves alone. The same is true of the other three injections: the grass
  sway and the fish tail sway patch `begin_vertex`/`common`, the fish fog gain patches
  `fog_vertex`, and the coral's per-instance emissive tint patches `emissivemap_fragment`.
  All five chunks are shared between the standard and toon shaders. `RIM_LIGHT_CHUNK` in
  `Moray.ts` is
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
  sand, the two stacks, the coral, the grass, the shafts, the caustics, the motes and the
  bubbles are all built once in the constructor, and `tests/sanctuaryScene.test.ts` fails
  if a fixture stops surviving a rebuild. That test also constructs the scene in plain Node, so
  everything the room owns has to be DOM-free at construction — which is why
  `LightShafts`' canvas-painted beam texture returns null without a `document`, the same
  guard `UnderwaterFog` has.
- **The sanctuary is dressed from the reef's own generators**, with its own seeds
  (`SEEDS.sanctuary*`). `CoralField`, `LightShafts` and `Bubbles` take their
  sites/placements as an optional second and third constructor argument; the reef's
  authored ones are the defaults precisely so a second room cannot move them. Its shaft
  *widths* track the reef's, though its count does not: the beam map, its bell and its
  opacity are shared, so a room left at the old widths would be lit by the same softness at
  two thirds the breadth and read as a different ocean. Its two bubble vents are there for
  depth rather than atmosphere — the residents swim in open water nine metres out with
  nothing between them and the lens, and a thread rising behind them is the cheapest thing
  in the project that says how far back "behind" is.
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
 exactly the ask, and it is still the lever. The rest of that paragraph is history now:
 WP-G2 took the specular away entirely along with the BRDF, and the warning about matte
 cardboard did not come true because the ramp models a near fish in flat steps instead,
 which is what a storybook fish is.
- **The fish's "pink against turquoise" is a value failure, not a hue one.** Sampled off
 the composited frame the school measures blue above green above red — it is cool, it has
 always been cool, and no albedo tweak will make it look cooler. What the eye is doing is
 reading a small low-chroma *dark* shape on a large saturated cyan field as that field's
 complement. Two things move it and both are value: the body colour went up a quarter
 (and a cream one, tried and reverted, makes it far worse — the warm key lands it on
 salmon), and the counter-shading's back-to-belly range came down from 0.58 to 0.40,
 because 0.42 of the belly was authored against water that sat near a fifth of white and
 WP-G1's water does not. Measure before believing the frame here.
- **A fish's tail fork rides on a merge that can fail silently.**
 `createFishGeometry` merges a body with two cone blades, and `mergeGeometries`
 takes its indexing from the first geometry and then rejects every other one
 that disagrees. The body was an octahedron — `PolyhedronGeometry` builds bare
 triangles with no index — and `ConeGeometry` builds a vertex grid with one. So
 the merge returned null, the `?? body` fallback quietly handed back a bare
 diamond, and for a while every fish in the reef swam with no tail, behind a
 single console error and nothing the frame could tell you. The rule has not
 changed, only which side gives way: the body is a `SphereGeometry` since WP-G3
 and both sides are indexed grids that agree as built. Keeping the index is also
 where the round body is paid for — 42 vertices against 144 — and it is why the
 blades wear the cone's own smooth normals, which at sixteen centimetres on an
 animal that is never near the lens is not a visible thing. The counter-shading
 is read across the *body's* vertical extent and clamped, rather than re-read
 per part — a blade a centimetre and a half tall would otherwise run the whole
 dark-back-to-pale-belly ramp across itself and hang a belly-bright edge off the
 top of the tail. Its belly end is tilted a few percent warm and its back end a
 few percent cool, which is where the art plan's cream lives; on the albedo it
 is the cream body WP-G2 measured and threw out.
- **A school is 170 instances, so its triangle count is a frame cost and not a
 detail setting.** The body is `SphereGeometry(0.13, 6, 5)` and not the 8×6 it
 was drawn as: measured at the resolution the adaptive scaler settles on, the
 school costs 2.3ms as the old diamond, 3.0ms at 48 triangles and 5.5ms at 80,
 and the two spheres cannot be told apart at any size this animal is drawn.
 Also worth knowing before measuring anything: `measure-frames.mjs` samples rAF
 deltas, so it can only report **multiples of 16.66ms** — a 3ms regression and a
 16ms one look identical, and a change can appear to cost 16ms purely by
 straddling a tick. To attribute a cost, time `renderFrame()` directly with a
 one-pixel `readPixels` after it as a barrier (`gl.finish` returns as soon as
 the commands are queued), with `pinRenderScale` set so every sample is at one
 resolution.
- **A fish close to the lens is the whole ballgame.** Everything above is about values,
 and none of it matters if a shoal drifts through the diver: measured at the mid-depth
 traverse, the nearest six instances sat between 0.8m and 1.8m out and the closest
 spanned *thirty-one degrees of frame*. At that size the old octahedron was three grey
 facets and an outline — "paper scrap" in its purest form — and the round body is a
 featureless lozenge with no eye, no gill and no pattern, which is the same failure with
 softer edges. Distance is what the whole design of the animal assumes. `VIEWER_STANDOFF`
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
