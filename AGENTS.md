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
- `src/creatures/life/` — `LifeSystem` (the interface every population comes in through),
 `LifeRegistry` (what `Game` holds instead of a field per animal) and `LifeScaffold`
 (a named, seeded, empty group: a module that is not built yet).
- `src/creatures/fauna/` — `Crabs`, `Starfish`, `Urchins`, `AnemoneGarden` (scaffolds).
- `src/creatures/visitors/` — `VisitorSchedule`, `Turtle`, `Ray`, `JellyBloom` (scaffolds).
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
 sanctuary portrait) plus Round L's four: `F-life-wide` and `H-visitor-arc` are A's and
 B's viewpoints held for six and nine seconds, because a visitor's pass and a bloom's
 drift are minute-scale and a two-second settle cannot see them; `G-tidepool-close` is
 down at 1.3m on the eastern shoulder, pitched at the sand, where the small fauna live
 and where no canonical shot has ever stood; `S-sanctuary-life` is E's pose later in the
 sweep. They were added once, in advance, so that the packages filling the reef with life
 never move the array — a shot set that changes mid-round is one that cannot be compared
 across it. `Game.capture()` stops the live loop, places the diver and advances
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
 `node scripts/image-stats.mjs <file> [--rows <top> <count>] [--grid <n>]` is the same
 idea one step upstream: it measures the *painting* rather than the frame, which is what
 every integration constant in `UnderwaterFog` and `RockMaterial` is derived against.
 `--rows` reports a horizontal strip on its own, the way the fog samples its horizon;
 `--grid` reports block means, which is how a wash's colour patches are told from its
 noise. When an asset is repainted, measure the old file out of git and the new one the
 same way — a constant re-derived from a true ratio takes a minute and a constant
 guessed at costs a package.
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
 - **The ink is the species' own colour, mixed 60% toward one of two inks, in sRGB.**
 The mix is in sRGB for the same reason as `softenAccent`: the palette was picked in
 the space a painter reads, and the same fraction in three's linear working space is a
 far deeper cut — mixed linearly the cream snowflake wears a line at four tenths of
 its own value, which is a smudge. The thickness is 12mm in the animal's *local*
 space, so it thickens with the reef's 1.5× morays and thins with the sanctuary's,
 which is what a drawn contour does.
 - **There are two inks because a line is a value and no value reads against
 itself.** One dark blue-violet was fine for the cream snowflake and quietly useless
 on the animals that need a contour most: mixing a near-black zebra 60% toward an ink
 *lighter than its own body* separated the line from the body by 0.045 of perceived
 value, against the snowflake's 0.43 — present in the buffer, invisible in the frame.
 So there is a warm cream (`HULL_HALO`) as well, and each species takes whichever ink
 stands furthest from it. That is deliberately not a threshold and deliberately not a
 blend: a threshold needs a number re-picked whenever a fifth species is added, and
 interpolating the ink by body luminance would hand a mid-valued animal a mid-valued
 line, which is the failure itself arrived at on purpose. As it lands the snowflake
 keeps the dark line and the other three take the halo — including the ribbon, which
 reads as a bright colour and is a mid-dark *value* (0.13 separation dark against 0.30
 haloed). `tests/morayOutline.test.ts` asserts every species clears 0.2, so a new
 palette cannot quietly lose a contour. Lining a dark subject light is also just what
 the reference does.
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
    the map stopped supplying. It is only ever the built texture's linear luminance
    over the tile's, so it moves with the file and nothing else: 2.85 for a 0.27
    limestone photograph, 2.07 for the first gouache wash at 0.3855, **2.14** for
    WP-G8's repaint at 0.3723. Ratios between rocks survive a uniform scale, which is
    the entire point. Measure both means before changing either file —
    `node scripts/image-stats.mjs <file>` reports exactly the linear luminance these
    are derived from, and the canonical shots hold their frame mean to within three
    parts in 255 across the whole package.
  - **The rock families needed no colour change and that is the point.** They were
    already all but neutral (`0x8b9184` is four parts of saturation), so the wash's
    colour arrives as the stone's actual hue instead of being multiplied into the
    olive the old tile was. If a family is ever given a real colour again it will
    fight the painting, not tint it. WP-G8's repaint is where that pays: it carries
    lavender, sage *and* ochre across a 40-part swing in red-minus-blue, around a mean
    24 parts warmer than the first wash's, and a near-neutral tint cannot argue with
    any of it. The assetless fallback's `WASH_HUE` tracks the file's mean, so a
    repaint that changes the stone's hue has to move that too.
  - **`TINT_FLOOR` lifts the bottom of the tint range into the family, and it is a
    floor rather than a brightening.** Two tints were written when this world was lit
    like a photograph, where a dark mass is how depth is built: the sanctuary's near
    stack rendered at 114 of luma against water at 189 and the reef's foreground
    shoulder at 80 against 175, and both read as slabs of a heavier world laid over
    this one. What the correction must not do is reorder the tints — the shoulder is
    only a repoussoir while it is darker than the reef behind it — so it takes 55% of
    a tint's distance below the floor out rather than clamping, and it scales in sRGB
    so hue and saturation are exactly preserved and only value moves. The shoulder
    goes 0.268 → 0.407 of perceived value, the sanctuary's stack 0.406 → 0.469, and
    the two families already above the floor are untouched to the bit.
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
    world**, and what it means depends on whether the painting is flat. It is applied
    to `scene.backgroundIntensity` *and* to the sampled horizon, so the agreement
    above survives it. It was 0.64 for the first panorama, which had almost no
    vertical range — that image was uniformly half a stop hot and 0.64 was pure
    brightness. WP-G8's repaint has range (whole-image p10/p50/p90 of 63/159/240, red
    running 64 at the horizon to 155 thirty degrees up), so the same multiply now
    decides how much of the range survives, and 0.64 spent it. **0.85** is where the
    derived fog's green lands exactly on the value the reef has always had, and it is
    what makes the upper third of shots A and B water with light coming down through
    it rather than a flat turquoise field.
  - **`RED_PEDESTAL` exists because three's neutral tone curve is a black-point crush
    aimed at whichever channel is smallest — which on this frame is always red.** The
    curve opens by subtracting `x - 6.25x²` where `x` is the minimum channel, and
    while red is small that is close to total: at 0.02 of linear light it removes
    seven eighths. The first panorama never got near it (horizon red 103); the repaint
    carries 71 and lands the water above the skyline *inside* the crush, which
    rendered as rgb(15, 175, 186) with 2.5% of shot A under 25 parts of red against
    0.06% before. That is the electric poster-paint cyan the value key warns about,
    arriving from a direction nobody was watching — not from the file's deep zone,
    which drops red to 1 and is never drawn (it lies below 34° of depression, where a
    camera two metres over the sand is looking at sand). The fix is the crush read
    backwards: an affine lift on the *image*, 0 → 28 and 255 untouched, largest
    exactly where the subtraction is. It is applied before anything reads the file, so
    the horizon strip is sampled from the lifted copy and the fog/painting agreement
    is untouched. 28 is where the band clears the `x < 0.08` knee; going higher stops
    correcting and starts warming every fogged surface in the reef, which is a
    decision about the water and belongs in the water's own colour.
  - **The copy is what gets hung, and the loaded file never reaches the GPU.**
    `liftRed` memoises one `CanvasTexture` and `textureFromPixels` carries everything
    across except `mapping` — set that, or three treats the panorama as a flat UV
    texture and the sky becomes one stretched pixel.
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
- **A table coral's plate is the one shape in the garden that can read as wreckage.**
  It is a wide flat disc, and seen edge-on from below with a lit rim above it and its
  underside baked down, it is a plank. `plateGeometry` used to bake that underside at
  0.55 on top of the shade band the ramp already gives it — the same double-modelling
  the fish and the morays were cured of — which took it to about a fifth of the plate's
  colour. In the sanctuary, lying a metre off pale sand in a bright room, the review
  called it the strake of a wrecked hull; it is the same shape in the left of shot B.
  `PLATE_UNDERSIDE` is halved to 0.28, which keeps the cue and lets the ramp do the
  darkening. A garden that has gone dark is worth checking here first.
- **The sanctuary is dressed from the reef's own generators**, with its own seeds
  (`SEEDS.sanctuary*`). `CoralField`, `LightShafts` and `Bubbles` take their
  sites/placements as an optional second and third constructor argument; the reef's
  authored ones are the defaults precisely so a second room cannot move them.
  `CoralField` takes a `ToneRange` the same way, and the sanctuary raises its floor
  (0.6 → 0.88): the bottom of the reef's range is a rust taken well down, which on a
  *branching* head is one dark colony among lighter ones and on a table is the plank
  above. The draw is one `random.range` whatever the bounds, so a room changing its
  tone leaves the whole garden's layout bit-identical. Its shaft
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
- **The fish's counter-shading was modelling the light a second time, upside down.**
 The range above came down again in WP-G8, to 0.22, and this is the reason rather than
 the value key. The key is overhead, so the ramp already hands the back the lit band
 and the underside the shade band — and a *dark back, pale belly* marking then darkens
 the lit side by 40% and leaves the shaded side at full. The two very nearly cancelled:
 back at 0.6 of the key against belly at 1.0 of a 0.26 shade band is one flat mid-mauve
 across the whole flank, which is one value, which is the "scattered confetti" read, and
 the vertex buffer was paying for it. This is the same correction `MorayPattern` took in
 WP-G6 and the coral plate's underside took in WP-G8: **under a ramp, counter-shading is
 a marking, not a second model of the light.** Shallower, the light does its own job and
 the fish has a pale top and a violet-shaded underside — two values that survive being
 six pixels tall. The window between them (`BELLY_TOP`/`BACK_FROM`) is placed where it
 is because the body is a five-segment sphere: six vertex rings, and the only edge worth
 having falls between the third and fourth, at the flank's midline.
- **The fish has an eye, and it is the only thing here allowed above the vertex-colour
 ceiling.** One vertex per cheek at 1.5, written after the counter-shading. The ceiling
 rule next door is about the *ramp* — a ramp peaking above 1 is a global brightening
 hidden in a buffer that makes the material colour a lie — and two vertices at the head
 are a highlight instead. It has to be above 1 because the canonical cameras sit *below*
 the shoals (they cruise at 4–7m, the diver's eye line is around 2), so the frame is
 mostly underside, and a mark at 1.0 there is exactly as bright as the belly beside it.
 It sits just *below* the midline for the same reason: on the upper cheek it merges into
 the pale dorsal band the ramp lights, and the animal gains a wider light edge instead
 of an eye. Be honest about what it looks like — at six segments around, one vertex owns
 an eighth of the surface, so it is a soft bright patch over the front of the body
 rather than a dot. That still does the job, which is to break the fore-and-aft symmetry
 of a lozenge: measured, it takes the school's p99 over the water it covers from +6 to
 +28 in shot C and +16 to +33 in shot B. A tighter eye means more segments, and the
 triangle-cost measurement for that is two notes down.
- **Density was the confetti, not the count.** WP-G8 cut the school 170 → 120 and halved
 the formation (`STATION_ACROSS`/`UP`/`ALONG`, and a `STATION_SPREAD` topping out at 1.1
 rather than 1.5) while leaving `SHOAL_COUNT` at thirteen. The old stations let a shoal
 stretch eight metres across and ten long, which at thirteen fish is one animal every
 three quarters of a metre — thirteen unrelated dots drifting the same way. Halved, a
 shoal is about three metres by four with nine fish in it and reads as one thing with a
 shape. Measured through `probe-fish.mjs`, the traverse frame went from 86 fish on an
 average second to 62, and still never fewer than four. The near-field cap went 0.55 →
 0.69 in the same pass, because the sentence it was written against — "a bare round body
 with no eye" — stopped being true.
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
- **A school is 120 instances, so its triangle count is a frame cost and not a
 detail setting.** The body is `SphereGeometry(0.13, 6, 5)` and not the 8×6 it
 was drawn as: measured at 170 instances, at the resolution the adaptive scaler
 settles on, the school cost 2.3ms as the old diamond, 3.0ms at 48 triangles and
 5.5ms at 80, and the two spheres cannot be told apart at any size this animal
 is drawn.
 Also worth knowing before measuring anything: `measure-frames.mjs` samples rAF
 deltas, so it can only report **multiples of 16.66ms** — a 3ms regression and a
 16ms one look identical, and a change can appear to cost 16ms purely by
 straddling a tick. To attribute a cost, time `renderFrame()` directly with a
 one-pixel `readPixels` after it as a barrier (`gl.finish` returns as soon as
 the commands are queued), with `pinRenderScale` set so every sample is at one
 resolution. `measure-frames.mjs` is also very sensitive to what else the machine
 is doing — the same build measured 183ms, 117ms and 100ms at load averages of 4.2,
 3.6 and 2.2. Read `uptime` beside the number or the number means nothing.
- **A probe can rot, and a rotted probe throws rather than lying.** `probe-fish.mjs`
 sampled a per-instance "glint" colour that the aimed sun sparkle wrote; WP-G2 deleted
 the sparkle with the BRDF, so `instanceColor` has been null ever since and the probe
 died on its own last measurement — which is why nobody had run it. It is gone, along
 with the roughness and metalness the report printed for a `MeshToonMaterial` that has
 neither. If a probe reports on something a package removed, delete the measurement
 rather than leaving it to fail.
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
- **Everything alive that is not a moray or a shoal comes in through `LifeSystem`**, and
 `Game` holds one `LifeRegistry` rather than a field per animal. That is the whole point
 of the interface: a package that adds a population constructs it in the registry's list
 and touches no other shared file. The context it is handed each frame is deliberately
 four values — where the diver is, how fast, whether motion is reduced, and simulated
 time — because anything that needs the camera, the renderer or the save is not a life
 system. The diver's position is *copied* into the context rather than aliased, and it is
 the diver's, not the lens's: what startles an animal is a body arriving, and the two
 part company the moment the rig lags or leads.
 - **The seeds are all registered before any of the animals exist** (`crabs`, `starfish`,
 `urchins`, `anemones`, `visitors`, `sandPuffs`, and `audioLife` for the grain in an
 event's noise). Same reason the sanctuary has its own: these are filled in one at a
 time, and a shared stream would re-roll every population already placed each time
 another arrived. The three visitors deliberately share `visitors` — who arrives and how
 they swim is one decision — and nothing else may share anything.
 - **A scaffold costs one scene-graph node and nothing else.** `LifeScaffold` is an empty
 `Group` with a name and a seed, and a subclass that grows real contents should stop
 extending it and implement the interface itself. `tests/lifeSystems.test.ts` drives
 every one of them through a minute of frames in plain Node and asserts the group comes
 back empty and detached after `dispose` — which is the same DOM-free rule the sanctuary
 is built under, and the only reason any of this can be unit tested at all.
- **The capture harness's own noise is not uniform across the shot set, and on two of the
 five it is several parts.** A shot is reproducible frame for frame *given the same
 starting state*, but `capture()` stops a loop that has already been running on real
 deltas since the page loaded, so anything mid-cycle when the shutter falls — the
 school's phase, a bubble's height, the sanctuary's residents — starts from wherever the
 machine's speed left it. Measured by capturing the unmodified tree twice in one evening:
 A and D held to a tenth of a part, C moved 3.0 of luma mean and E's p90 moved 7.7, and B
 swung 2.1 in one direction and 0.6 in the other across two sessions. So a "zero pixel
 change" claim cannot be made against an archived tag alone. Capture a **same-session
 control** from the tree without the change and diff against that: W-L1 measured +0.0 on
 A, C, D and E that way, against the +3.0 and +7.7 the control itself showed versus the
 archived baseline.
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
- **The reef's creatures share one bus and one trim.** `playEvent(name, gain)` on
 `ReefSoundscape` fires one of six synthesised one-shots — `crab-click`, `fish-flutter`,
 `turtle-glide`, `jelly-shimmer`, `sand-puff`, `moray-peek` — into an `eventBus` held at
 `EVENT_LEVEL`, with a smaller reverb send than a bubble gets, because these sounds are
 close and small and a crab in a cathedral is a crab somewhere else. Nothing here ducks
 the bed: a reef that stepped back for a tick would be announcing the tick. Three things
 are worth knowing before retuning any of it:
 - **Read the probe's peak column with the frequency beside it.** `probe-audio.mjs`
 renders each voice offline and prints peak, rms, length and where its energy sits.
 `moray-peek` measures as the largest peak of the six and is the quietest thing there:
 an eighty hertz tone needs some twenty-five decibels more amplitude than a mid one to
 be heard at the same level. Comparing peaks across voices at different pitches is the
 mistake the note in `LIFE_EVENTS` exists to stop.
 - **A detuned cluster's gain is per voice.** The jelly's three sines beat in and out of
 phase, so the cluster peaks at nearly three times the constant — it was mixed at 0.012
 "as the quietest voice" and measured the second loudest, at 2kHz, which is exactly
 where hearing is sharpest. 0.006 lands it where the comment always claimed it was.
 - **One noise buffer per context, three seconds long, played from a random offset.**
 The grainy voices can fire in bursts, so a buffer per tick would put a few thousand
 PRNG calls on whichever frame a crab moved. It is longer than the longest event plus
 the largest offset, so nothing reaches the seam and no crossfade is needed — unlike
 the ambience bed, which runs forever and does need one.
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
- **The coral garden is eight silhouettes in three sizes, and the split between them is
  the design** (W-L2). `CoralShapes.ts` is what a coral *is* — the geometry, the skins and
  the one painted sheet; `CoralField.ts` is where they stand. They were one file until the
  garden went from three shapes to eight, at which point the layout was buried in the
  middle of nine hundred lines of geometry. Two landmarks (`staghorn`, `brain`, modelled in
  Blender, 1.0–1.75 m), three mid pieces (`plateStack`, `tube`, `fan`, 0.3–1.6 m) and the
  old garden's three as fill (`branch`, `boulder`, `polyp`). Eleven draw calls for the lot.
  - **A garden with no landmark has no scale.** The old field was five bommies of one
    small size out of one palette, and at ten metres it read as ground cover with lumps
    in it — not because there was too little of it but because nothing in it was big
    enough to measure the rest against. The hierarchy is the whole package; the extra
    density is the cheap half.
  - **A landmark you cannot see is indistinguishable from a landmark that is too small.**
    Scattered anywhere inside its cluster, the tallest thicket in the reef landed behind
    its own cluster twice and behind a sea stack once. The first landmark of each cluster
    now stands *on* the authored site, because the site's coordinates are the composition;
    the rest scatter. `scripts/probe-coral.mjs` exists mostly for this — it counts what
    falls inside each canonical frustum per species and reports how many degrees of frame
    the biggest one covers, which is what "reads from fifteen metres" actually means.
  - **A colour family per cluster, with a fifth drawn from a neighbour's.** Six clusters
    sharing one palette average to the same dusty mid-tone at any distance, which is the
    confetti failure the fish school was cured of in WP-G8 arriving from the other side.
    Rose, ochre and violet, with drifts of small heads running between the clusters so
    the masses read as one reef rather than six objects placed on a floor.
  - **The tone floor came up from 0.6 to 0.68, and it is about area rather than value.**
    A finger of coral at the dark end of the range is one shaded colony among lighter
    ones. A metre-wide brain dome or a metre-and-a-half fan at that same value is a
    maroon slab, because it covers ten times the pixels. The same multiplier reads as
    depth on a small shape and as dirt on a big one.
  - **Nothing grows within six metres of a crevice or its mound, and nothing stands in an
    approach corridor.** This is the dangerous kind of constraint: coral is not in
    `Reef.obstructionMeshes`, so a thicket in a crevice mouth would never fail a sightline
    test — the raycast goes straight through it and the discovery still fires. What it
    costs is the player's ability to *see* the animal, and no check downstream notices.
    `isClear` states the rule and `tests/coralGarden.test.ts` reads it back against a real
    `Reef`'s `hidingSpots` rather than against this file's copy of the crevice positions.
    Two of the old five bommies were inside that ring and had to move.
  - **The ring emptied shot C, and the fix was a better composition than the one it
    broke.** Everything C's frame used to hold was inside six metres of the snowflake.
    Two small clusters just *outside* the ring, east and west, frame the mouth instead:
    the eye runs down an empty channel of sand between two masses of colour, straight to
    the animal. The western one is squeezed between the dragon's corridor and the
    ribbon-and-zebra band and gets no landmark rather than one that would be rejected.
  - **`feedingSites` is exported as a function as well as a property**, because the reef's
    `CoralField` is built inside `Reef` and thrown away — nothing holds a reference to it.
    `coralFeedingSites()` computes them from the authored sites, so the Wave-3 school can
    have them without a line in `Reef` and a line in `Game`.
  - **The sway winds its own clock, and that is a compromise rather than a design.**
    Nothing calls `CoralField.update`, for the same reason: no owner. So the swaying
    meshes advance the uniform from `onBeforeRender` off the wall clock, which keeps
    running while `capture()` holds a frame where everything on the fixed step stops. It
    is bounded — a fan's tip travels about six centimetres, below even the meadow's Calm
    Mode amplitude, which is also why there is no separate reduced-motion figure. The
    moment an owner does call `update`, the self-winding stops.
  - **The rose site's landmark stands in W-L3's arch portal, and it is not missing.**
    (-5.2, 11.6) was authored before the arch arrived at (-4.6, 10.6). Measured, nothing
    interpenetrates — 2.4 m to the nearest leg against a 0.72 m leg radius, a 1.64 m
    crown under a beam that starts at 3.2 — and shot A reads the tallest thicket in the
    reef *through* the arch, a frame inside the frame that is better than the bare sand
    it was composed against. What did change is the close views: the southern standing
    pose (`probe-coral.mjs`'s `landmark-staghorn`) now looks at W-L3's kelp first, so
    judge the piece from the north or from shot A's own crop before concluding the
    landmark is gone. Its instance transform is exact; check
    `InstancedMesh.instanceMatrix` before moving anything.
  - **The no-assets garden has now been looked at** (`wl2-e2-noassets`): nothing is
    broken. Stand-ins hold every site at the authored sizes, and the generated fan lace
    is thinner and wirier than the painted sheet but still reads as a fan. Left as is.
- **The two hero corals are built in Blender and committed as GLBs** (W-L2).
  `tools/blender/build_staghorn.py` and `build_brain.py`, both deterministic from a fixed
  seed, both a few seconds; `coral_common.py` holds the rig they share and
  `inspect_glb.mjs` reads a built file back without a browser. They are build artefacts in
  the same sense the painted PNGs are: committed, and rebuilt by running the script.
  - **Blender crashes in the sandbox.** It dies in Metal backend detection before Python
    runs — `supports_barycentric_whitelist`, a `strstr` on a device name that is not
    there. Run the build scripts outside any sandbox.
  - **Everything is authored one metre tall, foot on y = 0, centred on the y axis**, and
    the procedural stand-ins in `CoralShapes` match it to the millimetre. This is a
    contract, not a convention: a GLB arrives after the field is standing and is hung on
    an `InstancedMesh` whose matrices were written for the stand-in, so a disagreement
    about what one unit means is a garden that jumps when the file lands.
  - **`COLOR_0` is linear, and that was measured rather than assumed.** Blender stores
    `BYTE_COLOR` attributes in sRGB and converts on export; a `FLOAT_COLOR` attribute is
    already scene-referred and passes through untouched. Confirmed by writing
    `0.80 ** 2.2 = 0.6100` and reading `0.6121` back out of the accessor with
    `inspect_glb.mjs`. Three's `GLTFLoader` maps `COLOR_0` straight onto the `color`
    attribute with no colour-space conversion, so the chain is linear end to end — which
    is why `coral_common.perceived()` exists: author what the eye should see and let it
    take the 2.2 power, or a furrow written at 0.7 reads at 0.85.
  - **A vertex colour here only ever darkens.** The exporter writes a normalised integer
    accessor, so anything over 1.0 clips — a "highlight" at 1.14 lands exactly where 1.0
    does. The ridge crown *is* the top of the range and everything else is taken down from
    it, and the stand-ins keep the same ceiling so a piece does not change value when its
    model arrives. `tests/coralGarden.test.ts` asserts it.
  - **It is a multiplier, never a colour.** The species' hue is the per-instance
    `InstancedMesh` colour and the garden's whole variety lives in that spread; a GLB
    bringing its own terracotta multiplies against it and the field goes to mud. Same
    correction `levelToBlade` makes for the painted grass strip.
  - **A collapse decimate has a floor, and the triangle budget is spent before it.**
    Blender will not collapse below about half of a skinned hull however low the ratio is
    set — the edges it would have to take next are the ones holding the tubes open. Three
    full sprays floored at 4700 triangles against a 4000 budget, so the staghorn is one
    full spray with two shallower ones banked against it (which is what a thicket looks
    like anyway) and comes in at 2444. The brain is 3315.
  - **Neither the Skin modifier nor a bmesh rebuild leaves a UV layer behind**, whatever
    `export_texcoords` says, so `project_uvs` writes one. Cylindrical for anything that
    stands and spherical for a dome — a cylinder's `v` puts a dome's whole crown in the
    last sliver of the map, which smears the grain into vertical streaks exactly where a
    swimming diver looks straight down at it. The seam correction is not optional: `atan2`
    jumps from 1 to 0 along one meridian and a face straddling it runs the entire map
    backwards across itself, one triangle wide and very loud.
  - **The landmarks wear grain and nothing else.** Their structure is in their vertices
    and their occlusion is in their vertex colours, and map, vertex colour and instance
    colour all multiply — a boulder's corallite tone range on top of a furrow's bake takes
    it to a tenth of the colony's colour. Their `skinRecipe` runs 0.84–1.02 where a fill
    head's runs 0.35–1.0. Same double-modelling rule as everywhere else in this project.
  - **The brain's furrows are geometry, and that is the entire reason the piece exists
    next to `boulder`.** The boulder already wears a Voronoi corallite *map*, and a map
    cannot break a silhouette: mipped away at fifteen metres it is a lump. Too much warp
    at too high a period is the opposite failure and the one the numbers were retuned out
    of — the ridges close into separate cells and the dome becomes a pinecone. A maze
    coral's ridge runs a long way before it turns.
  - **The staghorn's branches are drawn thick on purpose.** A real staghorn's five
    centimetres is sub-pixel at the distance the canonical cameras stand, and it is the
    wrong reference anyway: this reef is three-metre boulders and eight-metre arches
    painted in broad strokes, and a coral at true girth beside them is a wire model.
- **`AssetLibrary.requestModel` is the texture contract, one asset class over** (W-L2).
  Async, cached per path, inert without a `window`, a failure is a `console.warn` and the
  caller keeps what it had, and it joins `assetsPending`/`whenAssetsSettled` so the shot
  harness waits for it. `fetchAsset` is the shared half — cache, queue, in-flight
  bookkeeping — and the loaders differ only in a `begin` callback, which is what keeps "a
  missing file leaves the caller exactly where it was" a property of one function.
  - **Only the geometry crosses over.** The loader builds a `MeshStandardMaterial` per
    primitive whether or not the GLB declared one, and nothing in this project renders one
    of those; `extractGeometry` disposes them and bakes the node's world matrix into the
    geometry rather than trusting it to be identity. It also calls `computeBoundingSphere`,
    because the loader only computes one lazily on first raycast and an `InstancedMesh`
    culls on it.
  - **The geometry is the library's, like the textures.** Cached per path and handed to
    the reef's garden and the sanctuary's alike, so no caller may dispose it — and the
    stand-in it replaces is `CoralShapes`', shared the same way, which is why the swap
    drops the old geometry rather than disposing it.
- **The sea fan is one painted sheet, cut out rather than blended** (W-L2).
  `assets/world/coral-fan.png` is a rose lace on black, 512², and three transforms turn it
  into a map. Each one is answering a specific failure and they are all one-off arithmetic
  at load, in `unpackFan`.
  - **Alpha from luminance**, because the painting has no alpha channel and its brightness
    *is* its coverage. `alphaTest` and no blending, which is the whole of the fan's frame
    cost: a transparent fan would leave the opaque queue, be sorted against every other
    fan on every camera move, write no depth, and still be wrong where two of them cross.
  - **Divide the colour back out of the coverage.** This is the halo. A pixel on the edge
    of a painted stroke is pigment composited over black, so it carries roughly
    colour × coverage; cut at `alphaTest` and every surviving edge pixel is a dark one,
    which draws a soot fringe around every branchlet and takes the whole piece a value
    down. Dividing by the coverage recovers the pigment and the fringe goes with it.
  - **Level it onto the generated sheet's alpha-weighted mean**, per channel — the grass
    strip's correction again. The painting brings a rose of its own and the instances are
    tinted rose, coral *and* violet; multiplied together the violets come out brown. The
    mean has to be alpha-weighted or the four fifths of the file that is black field drags
    it to nothing.
  - **The rows are written bottom-up.** The fan is painted root-down and the texture's `v`
    runs root to tip with `flipY` off, so output row 0 is the painting's last row. Same
    flip `fullBleed` does for the grass, for the same reason.
  - **A fan is the cheapest vertical mass in the garden** — forty triangles and one sheet
    — and the silhouette that reads soonest at range, which is why the scale went to 1.6 m
    there rather than into another modelled piece. It is also the fan count that is the
    tuning lever if the frame ever needs one back.
- **`node scripts/probe-coral.mjs <tag>` measures the garden**, the way `probe-fish.mjs`
  measures the school. Buckets and triangles off the live scene (not the source: the
  modelled species roughly double their bucket's triangles when they land), what falls
  inside each canonical frustum per species, and four standing views — one at three and a
  half metres from the tallest thicket, three at the gardens shot A, B and G are built
  around. The canonical set looks at this reef from ten to twenty metres, where every
  species reads as "some coral"; none of the tuning above could have been judged from it.
  - **Interleave the frame-cost samples, do not block them.** Eleven frames with the
    garden and then eleven without takes half a minute on this machine, and the load
    average moves further than the garden costs inside that window: measured back to back
    the coral came out at *minus* two hundred milliseconds, which was the other agent's
    build finishing. Alternating puts the same drift through both arms and the median of
    the paired differences is the number.
  - **It reports at two resolutions on purpose.** The round's budget is quoted against
    `measure-frames.mjs`, which measures a different picture — 1280×720 with the adaptive
    scaler free, settling at its 0.34 floor, about a thirteenth of the pixels this probe
    pins for its screenshots. Fill-bound work shrinks with that and draw calls do not, so
    one number alone either overstates the cost by an order of magnitude or hides where
    it goes.
  - **The closing numbers, and the ledger decision** (all at 1280×720 / scale 0.34,
    load ≤ 5, `uptime` read beside every figure). The finished garden is 38 ms of a
    ~149 ms frame; the perf pass that closed the package was real — 69 ms before it, and
    the polyp bucket that measured 53 ms at 258 shadow-casting instances measures 3.8 ms
    at 151 without. By arm: landmarks 11.4, fill 10.9, mid pieces 8.0, fans 1.6, the
    whole shadow pass ≈3.5. The garden it replaced measures **11.6 ms** (302 instances,
    10 draw calls) — taken from a scratch worktree at the round's base commit, same
    method, same machine, minutes apart — so the package's net cost is ≈ **+26 ms
    against a +3 ms allotment, and that is documented rather than chased**. The
    arithmetic: SwiftShader is vertex-bound at ≈0.5 ms per thousand triangles at this
    scale, so the old five-bommie field alone spent the allotment nearly four times
    over, and the allotment was priced for a layer, not for rebuilding the largest
    living surface in the reef. Both remaining levers together (every polyp, every
    shadow) buy back ~7 of the 26 and visibly cost the garden; on hardware that runs a
    vertex shader where it belongs, 58k triangles in eleven draw calls is nothing. What
    the number actually gates is fine: the whole-scene median at `measure-frames.mjs`
    conditions is 133 ms at load 2.8 with W-L3's kelp and arches in frame, the e2e suite
    passes 20/20 under it, and every capture pins its own scale. One more reason not to
    trim the polyps again: their count is drawn mid-stream in `addBoulder`, so changing
    it re-rolls every head placed after it — a tuning pass there invalidates the very
    captures it would be judged against.
- **The reef's stones are drawn profiles now, not displaced solids** (W-L3).
  `src/world/RockShapes.ts` holds four lathed archetypes — `boulderGeometry`,
  `slabGeometry`, `stackGeometry`, `archGeometry` — each an authored curve of seven or
  eight numbers, splined, revolved, and only then roughed. Noise has no intent: it can
  make a lumpier boulder and never a shelf or a standing stone, so the silhouette is the
  drawing and the noise is the tooth on it. `Reef.ts` places them from the `ROCKS` table,
  builds each pinnacle as one `stackGeometry`, makes the foreground shoulder a slab, and
  adds the one swim-through (`ARCH` + `buildArch`). The crevices are exempt by
  construction — `SPOT_PLACEMENTS` and `addHidingSpot` sit inside FROZEN comment fences
  and `RockShapes` is never called for them.
  - **`finish()` calls `weatherRock(geometry, seed, { amount: 0 })`, and that is the door
    to the surface contract, not a no-op.** Box-projected UVs at 0.22 of a unit per
    metre, welded smooth normals and the algae vertex tint all live in `weatherRock` and
    nowhere else; `amount: 0` skips only the radial displacement a lathe has already done
    its own way. Remove the call and every lathed rock renders *black* —
    `createRockMaterial` sets `vertexColors: true`, and a geometry with no color
    attribute multiplies by nothing.
  - **`roughLathe` scales the horizontal radius only.** `weatherRock`'s displacement is a
    scale along the radius from the origin, which is right on a blob and throws a
    nine-metre stack's crown metres up and down. Both of the lathe's terms taper by
    sin(πt) to nothing at the poles (a pole is one point wearing many vertices) and both
    sample by direction-and-height rather than per vertex, so the lathe's duplicated seam
    column displaces identically and the surface stays closed.
  - **`stackSpan` returns the widest single ellipsoid at each height, never the width of
    their union.** Two overlapping blocks span more between them than either reaches
    across, and a lathe told to match the union comes out ~40% too fat across the lean.
    Widest-only means the re-profiled spire fits *inside* the blocks it replaced in every
    direction — which is the property the verbatim-kept pinnacle colliders and
    `reachable()` in `tests/reefSightlines.test.ts` rely on, since they still evaluate
    the same samples. The topmost ring carries the lean axis forward from the ring below,
    because the ring that closes on nothing has no lean of its own to report and reading
    zero there throws a spike back across the axis.
- **The kelp forest is merged world-space geometry, deliberately not instanced**
  (`src/world/Kelp.ts`, W-L3). Thirteen authored clumps (`KELP_CLUMPS`, 3–6 stalks each)
  come to two draw calls — one merged mesh of stalks, one of leaves, 14128 triangles.
  A kelp plant is jointed: every leaf hangs off one height of one stalk with its own
  curve and phase, and instanced leaves would need the stalk's displacement threaded
  through per-instance attributes and rotated into each leaf's frame. Merged, the sway is
  two lines of shared GLSL reading per-vertex `aPhase`/`aReach` floats, and a leaf cannot
  come off its stalk because it is the same buffer. It is Reef-constructed like the
  grass, not a `LifeSystem`; `Reef.update` winds its sway. The injection uses the
  `attribute` keyword — three r180 still emits `#define attribute in` for WebGL2, a
  documented path.
  - **`castShadow` and `receiveShadow` are both false, and receive is the one that paid
    the budget.** Kelp lives in open water, above everything that could shade it, so a
    shadow-map sample per fragment on the largest new surface in the scene buys nothing.
    Dropping receive plus narrowing the leaf straps took the close shots from ~20ms of a
    full-resolution frame to ~9.
  - **The numbers, and how to get them again.** At 1280×720 with `pinRenderScale(1)` on
    SwiftShader (whole frame ≈480ms), the paired kelp cost is A 9.3, B 8.5, C 8.7,
    G 11.2 ms. The layer is fragment-bound, so it scales with render-scale *squared*:
    ≈1.7–2.2 ms at the adaptive scaler's floor, inside the +2 ms allotment but only
    just. If it ever has to come back down, the first lever (shadow receive) is already
    pulled; the second is clump count. `measure-frames.mjs` cannot see any of this —
    rAF deltas quantise to 16.66 ms — so use `node scripts/probe-kelp.mjs <tag>`, which
    times `renderFrame()` directly behind a one-pixel `readPixels` barrier, interleaves
    with/without every sample, and reports the median of the paired differences. Read
    only its `paired` column, and read `uptime` beside any number.
  - **Kelp is not in `obstructionMeshes` — no plant is — so a frond in front of a
    moray's head fails nothing and costs everything.** The raycast goes straight through
    it and the discovery still fires; what it blocks is the player's eye. The clumps are
    authored against the same clearances as the bommies, and the test below is what
    holds them.
- **`tests/kelp.test.ts` is RNG-fragile, and that is worth knowing before touching any
  kelp constant.** The whole forest grows from one `Random(SEEDS.kelp)` stream, so a
  change to leaf counts, ranges or draw order re-rolls every stalk placed after it and
  the clearance assertions are re-diced. The near stand at (-5.2, 13.2) has about 0.4m
  of margin — its radius 0.7 and scale 0.72 are what they are because one size larger
  failed a lane check by 0.018m. The clearance philosophy: six metres on clump centres
  from every crevice mouth; per-vertex checks against the approach lanes (lateral
  offsets −0.3/0/+0.3 at distances 3–13 m, segments shortened 1.6 m at the observer end,
  0.8 m of clearance); 2.2 m off the spawn sightline; and two metres from the anemone
  disc at (7.5, 8.5) that a later package plants. A legitimate tuning change that
  re-rolls the stream may need a placement nudged — that is the test doing its job, not
  the test being wrong.
- **The seabed's micro-relief is masked to exact zero where the game is placed**
  (`src/world/Seabed.ts`, W-L3). `seabedHeight` is now dunes plus an fbm relief a couple
  of metres across and a hand's depth — the octave three sines cannot supply. The mask
  is *exactly* 0 within 6 m of the four hiding spots and of the spawn corridor
  (x = 0, z ∈ [1.5, 24]), smoothstepping to 1 at 10 m, and the function early-returns
  the bare dunes when the mask is 0 — so "bit-identical where it matters" is something
  the code says rather than something floating point happens to agree with.
  `PROTECTED_SPOTS` is copied from `SPOT_PLACEMENTS`, not imported: `Reef` imports this
  module for every rock and blade it plants, and the guard in
  `tests/seabedRelief.test.ts` fails loudly against a table of literals if the crevices
  ever move (its corridor sweep starts at z = 1.5 deliberately — the snowflake's own
  mouth is at z = 1.5). The relief reaches the sanctuary too, since the room shares
  `seabedHeight`; shots E and S moved slightly with it and were not separately reviewed.
- **`unpackStrip(texture, levelTo)` in `SeaGrass.ts` is a layering wart, accepted.**
  It is `fullBleed` + `levelOnto` behind one export, and `Kelp.ts` consumes it for
  `kelp-leaf.png` — one plant module importing image plumbing from a sibling plant.
  The right home is next to `ImagePixels` in `src/rendering/`; it stayed put because two
  callers did not justify a third file, and the memo is here so a third caller knows to
  move it rather than deepen the import. While in there, `fullBleed`'s empty-row
  fallback was fixed: it used to copy "the row below", which at y = 0 is index −1, and
  `copyWithin` reads a negative start from the *end* of the buffer — every blade in the
  meadow wore the pale green of its own tip printed across its root. `nearestPainted`
  walks to the closest painted row instead. The pale collar still visible at blade roots
  in shot G is a different thing — toon banding on the lowest untwisted quad, present in
  the wl1-scaffold baseline, and left alone because the fix touches blade geometry the
  sanctuary shares.
- **The moray wears the sculpted head now, and the primitive head is its fallback**
  (W-L4b). `creature-moray-head.glb` comes in through `requestModel` in `Moray`'s
  constructor and `MorayGlbHead.ts` fits it: the swap retires the five primitives and
  their rigid hulls under one `primitiveHead` node, grafts a two-bone `SkinnedMesh` at
  the body root, and reseats the eye beads. Nothing arrives in Node and nothing arrives
  without the file, so `SHOT_NO_ASSETS=1` and every unit test still exercise the
  primitive path — the swap itself is tested against the *real* export, which
  `tests/morayHead.test.ts` parses with `GLTFLoader.parse` and grafts through
  `Moray.adoptSculptedHead`, the same seam the library delivers through. The manifest's
  ambiguities were resolved as follows, and each is one constant in `MorayGlbHead.ts`:
  - **Scale is neck-girth continuity, cross-section only.** The head is scaled so its
    0.080 m neck half-height lands exactly on `MorayBodyGeometry.neckRadius` (the file's
    0.072/0.080 ellipse is the tube's own 0.9 lateral squash, so one number fixes both
    axes; `tests/morayHead.test.ts` measures the two meshes and holds them within 2%).
    The *length* is trimmed to 0.8 along z (`GLB_LENGTH_TRIM`), which no other contract
    constrains — a z-scale cannot move the neck ellipse — and which the first probe
    round paid for: girth-matched at full length the zebra's face (3.55 × 0.556 m) filled
    half its own den arch and every head-on view read as a totem pole. At 0.8 the heads
    run 25–40% longer than the primitives they replace, which is a moray's long face
    without the boat.
  - **The v band is rescaled per archetype, on the head's side.** The file bakes
    v ∈ [0, 0.12]; the graft multiplies the channel by `neckV / 0.12` on its own clone,
    so head and tube agree where they meet and the cached geometry — shared by every
    animal, resident and portrait — is never written. Per-instance clones are also what
    lets the sanctuary's `disposeSubtree` release a resident's head without touching the
    library's copy.
  - **The eye bead is sized to the sculpted socket, after scaling.** 14 mm radius in
    model metres at the measured socket centre (±0.0525, 0.0221, 0.312 — the vertex
    nearest the sculpt's own EYE_S/EYE_PHI in UV space). The beads and catchlights are
    the constructor's own, re-seated and shrunk by node scale, so the catchlight's
    offset and bloom scale down with the ball and the discovery spark survives.
  - **`COLOR_0` is flattened to a mouth-lining multiplier.** Skin gradient and socket
    occlusion go to white — counter-shading under a ramp is a marking, and the painted
    albedo already carries the species' own — while everything darker than linear 0.30
    keeps its authored colour exactly. The first cut lifted dark colours in proportion
    to their own luminance and the mouth's floor ledge came out a third of the way to
    white: multiplied by a cream species map that read as a pale open maw, which
    head-on is the whole face. The head wears its own toon material (same map, same
    normal map, `vertexColors: true`) because the tube has no colour attribute to feed
    that define.
  - **The jaw is driven, and the sculpt's rest gape is leaned on, not repeated.** The
    file bakes ~11° of gape into the mesh; the bone adds `-0.08 + ventilation * 0.25 +
    lookBlend * 0.06` rad about its x, so rest swings ~7–11°, full attention reaches
    ~14°, and the mouth never shuts (−11° is closed; the floor here is ~6° still open).
    `lookBlend` is the one behaviour signal the animal has — the same blend that turns
    the head toward a close or curious diver — so mouth and gaze answer the same state.
    Both first guesses (0.35/0.14, no bias) rendered a reef of gaping maws; at rest 11°
    is already an open mouth.
  - **The outline is the body's own trick, one part later.** `addMorayOutline` returns
    its material and `addSkinnedHull` is exported, so the grafted head joins the same
    contour with the same geometry, skeleton and bind matrix — the line follows the jaw
    for free. The neck-cap fan is stripped (every triangle touching the centre vertex at
    (0, 0, 0.008)); the ribbon's and dragon's accent nasal cones re-grow from the
    sculpt's own nostril shells, sized to them rather than to the primitive snout.
- **The dens are dressed with `creature-den-mouth.glb`, and it is scenery by
  construction** (W-L4b, `dressDens` in `Reef.ts`, outside the FROZEN fences). The
  archway joins neither `obstructionMeshes` nor `colliders`, so every sightline raycast
  and collider the crevices were tuned against evaluates exactly what it did — the
  frozen mound, cave disc and flanks are all still there, and they are the whole of the
  dressing when the file is missing. It wears `rockMaterial` directly: the file's
  `COLOR_0` is a near-neutral multiplier authored to take a rock family's tint, and its
  UVs are authored at one unit per wash tile (~2.3 m), so the graft *halves* them —
  the shared wash texture carries `repeat = 2`, and composed they land the tile at the
  same spacing every other stone wears it. Poses (scale ~2.6, 0.75 m behind the head,
  seeded tilt/yaw/sink) are all drawn from `SEEDS.denDressing` *before* the async
  request, so the dressing is identical whatever the load order. Shot C now reads the
  snowflake through a doorway, which is a better composition than the bare slab gap it
  replaces.
- **What W-L4b costs, honestly.** The head is a replacement, not an addition: 2942 tris
  plus the same again for its hull, against ~2 000 for the primitive stack and its five
  rigid hulls — a net of roughly +3.7k tris per animal, four animals in the reef, at
  most one or two in any frustum. The dens add 4 × 1320 tris of shadow-casting rock.
  `scripts/probe-moray-cost.mjs` (the kelp probe's instrument pointed at these two
  layers, toggling `den-mouth` and `moray-glb-head` by name) was run twice, at 1-minute
  load averages of 15 and of 3-spiking-to-14, and neither run is a number to build on:
  the den's paired median swung 16→36 ms between runs of the same pose, and the head
  measured *more* in the pose where it is twenty metres away than in the one where it
  fills the doorway (22.3 vs 5.9 ms), which is drift wearing a number. What can be
  said: the figures are full-render-scale (1280×720 pinned), where a den arch fills a
  quarter of shot C's frame and fill dominates — at the adaptive scaler's 0.34 floor
  that fill shrinks with the square, so the den lands ≈2–3.5 ms in its worst pose and
  the head's honest net (gross minus the primitive stack it replaced) is low single
  digits. That brushes the +2 ms allotment in shot C and sits inside it elsewhere;
  the two levers, if a quiet measurement ever demands one, are the dens' `castShadow`
  and the den scale. Re-measure with the same probe on a machine under load 5 before
  believing any of it. The e2e suite: 18/20 with the two comfort-panel keyboard specs
  failing under that same contention and passing 6/6 in an isolated re-run — the
  documented starved-loop flake, not a regression.
- **The reef floor is inhabited now, and everything on it comes through `src/creatures/fauna/`**
  (W-L5). Five populations, seven draw calls, 10.4k instanced triangles, no shadows cast
  or received by any of them: seven crabs (one merged ~230-tri body, instanced), thirteen
  starfish (a five-lobed cushion dome, dusty orange/violet/rose), eight urchins (body plus
  twenty three-sided spines, deep violet-plum — the crevice-mouth rule again: the darkest
  thing on the sand is a colour), an anemone garden of ten crowns and 161 swaying
  tentacles with a pair of clownfish living in it, and five cleaner shrimp perched at five
  of the eight coral feeding sites. `FaunaSystem` replaces `LifeScaffold` for all of them,
  exactly as that class's header asks.
  - **Contents are built on `addTo`, not at construction, and that is a test contract
    rather than a style.** `tests/lifeSystems.test.ts` asserts every population's group is
    empty when constructed, and this package may not edit that file. The build is still
    deterministic from the seed taken at construction and runs exactly once; every
    behaviour clock is `ctx.time`, the simulated one, so `capture()` holds a scuttle
    mid-stride the way it holds everything else. (The anemones' sway is wound from it
    too — deliberately not the wall-clock compromise `CoralField` makes.)
  - **Disposal releases an owned list, not the subtree.** `disposeSubtree` on the shrimp
    would dispose the cached GLB geometry out from under `AssetLibrary` the first time a
    `Game` is torn down — the library's geometry is shared like its textures. Each system
    registers what it created (`own`/`ownInstanced`); the swapped-in GLB is never in the
    list, and the procedural stand-in it replaced still is, so teardown is exact either way.
  - **Clearances are imported, not copied.** `CoralField.isClear` is the whole contract —
    crevice rings, mounds, corridors, the reserved disc — and the fauna reads it from the
    file that owns it (the import is legal this way round; `CoralField` must never import
    back). A crab's burst is checked along the *path*, not just at the endpoint: two clear
    points near a boundary can span a chord that dips inside it, which is exactly how the
    first build walked a crab into the anemone disc. Homes are authored, and the one at
    (9.8, 10.9) was 5.85 m from the zebra — inside the ring by arithmetic, caught by
    `tests/fauna.test.ts` reading `isClear` back, which is that test earning its keep on
    day one.
  - **The anemone disc at (7.5, 8.5) is spent, as reserved.** Planting stays inside 2.1 m
    of the centre with 0.55 m trunk spacing. The disc's south edge dips into the z ≈ 6
    corridor band and that is fine *for this population*: those sightlines run at head
    height, a metre and a half above crowns that top out around 0.45 m — what the corridor
    rule protects is the view of a head, and nothing ankle-high can cross it. The crowns
    are rose, lavender and seafoam; the third family was cream first, and a cream anemone
    on cream sand is an anemone that is not there.
  - **The clownfish pair is the package's one requested delight, and its behaviour is the
    deliverable.** They weave a seeded lissajous over the crowns; a diver closing inside
    3.2 m of the garden sends both darting into the tentacles (each has its own crown,
    the two plumpest), and they re-emerge — at a quarter of the dart rate, wariness as a
    number — only once the diver stands past 4.6 m. Hysteresis, so the pair cannot
    flicker at the boundary; `tests/fauna.test.ts` drives all three acts. They render at
    1.5× life (~16 cm): 1.0 and 1.25 were both tried and both vanished into the garden's
    own colour at the 3–5 m the moment is watched from. The shrimp make the same trade
    louder — 2.75× their true 50 mm — and the GLB's transverse bands are why either
    reads at all.
  - **The crabs' clicks reach the mixer through `window.__reefAudio`, and that is a wart,
    stated.** `LifeContext` is deliberately four values and carries no audio, and this
    package's `Game.ts` budget was one appended registry line, so the soundscape could
    not be handed in. The window handle is the same object on the same event bus the
    audio probe reads; `FaunaAudio.ts` guards it (a no-op without a `window`, like the
    asset library) and is the file to delete if `LifeContext` ever grows an audio field.
    Clicks fire only at burst start, only with the diver inside 6.5 m, gain falling with
    distance, at most one per 0.4 s across the population.
  - **Movers opt out of frustum culling** (crabs, clownfish, shrimp) for the bubbles'
    reason: an `InstancedMesh` bounds itself from the first matrices it sees and a
    wanderer's bounds go stale. The static meshes — starfish, urchins, anemones — keep
    their culling.
  - **What it costs, honestly.** `node scripts/probe-fauna.mjs <tag>` is the kelp probe's
    instrument pointed at the five groups (interleaved pairs, `readPixels` barrier), plus
    close-up portraits computed from the live instance matrices — a guessed camera two
    metres from a seeded scatter stands inside a coral head as often as not; three of
    this probe's own first poses did. Measured at the 0.34 floor with 24 pairs: paired
    medians of 6.5 / 4.7 / 2.9 / 5.0 ms on A/B/C/G — but at load averages of 8–12.6,
    with three other workers capturing, and a −10 ms reading in the same session's
    scale-1 column to show what that load does to a median. Call it **3–7 ms against the
    +2 ms allotment, over, and documented rather than chased**: the tentacle mesh already
    took the one invisible cut (5×4 → 4×3 segments, a third off the package's largest
    buffer; 13.3k → 10.4k total), and every remaining lever — fewer tentacles, fewer
    stars, culling the movers — visibly costs the floor the package exists to fill.
    ~3.6k of the triangles draw in every frame because the movers skip culling, which at
    SwiftShader's ≈0.5 ms/k is most of the honest signal. On hardware, 10.4k triangles
    in seven draw calls is nothing. Canonical frame means held to within one part in 255
    of the archived `wl2-e2` baseline on A and G (`frame-stats.mjs`).
- **Tags**: `wl5-fauna-final` (canonical), `wl5-fauna-noassets` (fallback build — the
   shrimp's banded stand-in and everything else procedural, nothing broken), portrait
   sets `fauna-*_wl5-fauna4/5/6`. The e2e suite was not re-run by this package; nothing
   it drives (markup, keys, discovery geometry) was touched.
- **The visitors are real, and they find each other through a module-scope registry**
  (W-L6, `src/creatures/visitors/`). `Game` constructs `VisitorSchedule`, `Turtle`,
  `Ray` and `JellyBloom` as four *unwired siblings* in the `LifeRegistry` — the
  registry's design is that a package touches no shared file — so the wiring lives
  inside the package: an actor registers itself in `VisitorDirector` at construction,
  unregisters on dispose, and the schedule looks one up by kind when its clock fires.
  Audio reaches them the same way, through the `__reefAudio` handle `main.ts` already
  hangs on the window, read at call time and guarded — which is what keeps every one of
  these constructible in plain Node, where `tests/visitors.test.ts` drives two simulated
  hours of them.
  - **The cadence**: first arrival 75–120 s into a dive, then 150–260 s of empty water
    between visits, drawn from `SEEDS.visitors`. Never two at once is structural, not
    checked: the countdown simply does not run while anyone is on stage, and the gap is
    drawn when they leave. Weights are turtle 0.5 / bloom 0.3 / ray 0.2 — the turtle is
    the marquee, by explicit request. The first-arrival floor is also what keeps every
    canonical settle (2–9 s) visitor-free by construction, so F-life-wide stays
    comparable across packages.
  - **A crossing is a re-parent, never a rebuild.** Meshes are built once at
    construction and the animal's root is attached to the system's group only between
    `beginPass` and the exit, so an absent visitor costs one empty scene-graph node and
    one branch per frame — and `tests/lifeSystems.test.ts` stays true: a freshly built
    visitor has an empty group and a minute of updates with no schedule leaves it that
    way. Visitor `dispose` does **not** use `disposeSubtree`, deliberately: the turtle's
    and the bells' geometries are the `AssetLibrary`'s, and each class tracks what it
    actually owns.
  - **The QA door is `window.__reefVisitors.summon(kind, secondsIn)`**, hung by the
    schedule's constructor. `secondsIn` starts the pass part-way through, which is how
    a nine-second capture photographs the middle of a fifty-six-second crossing:
    `capture-shots.mjs` summons the turtle at 15.5 s for shot H, chosen by tracing the
    first arc's NDC position through H's camera (closest approach 8 m at pass-time
    ~25 s). Re-tune any `ARC_RANGES` and that lead has to be re-derived the same way —
    the arcs are pre-rolled at construction from `SEEDS.turtlePath`/`rayPath`/
    `jellyBloom` (paths deliberately apart from the schedule's stream), and each pass
    cycles to the next arc, so the *first* summon on a fresh page is always arc 0 and
    the shot is reproducible.
  - **`requestModel` delivers bare geometry, so the turtle's skeleton is rebuilt here.**
    The GLB's skin attributes ride along in `skinIndex`/`skinWeight`, but the joints do
    not survive `extractGeometry` — so `Turtle.adoptModel` builds `Bone`s at the
    measured origins and orientations in CREATURES.md's table (order is the skin's
    joint order; verified with `inspect_creature.mjs`, do not shuffle it) and binds at
    the documented rest pose, which makes the skinning exactly identity until a bone
    moves. FR/BR take negated angles — the export does not sign-correct left and right
    — and the skinned mesh carries an explicit `boundingSphere` with flap headroom, the
    same first-pose trap the morays document. The stroke is a 0.34 Hz front beat with
    the back pair lagging 0.9 rad, the head nodding 0.055 rad, and the whole animal at
    1.25× (a 1.75 m carapace: real greens reach 1.5 m, and at the eight metres the
    crossing passes the camera the extra quarter is presence, not caricature).
  - **The turtle's material walks a three-state ladder**: plain olive at construction
    (the primitive stand-in has no colour attribute, and `vertexColors: true` over a
    missing attribute renders *black* — `weatherRock`'s trap, creature-sized), vertex
    colours when the GLB lands, and `turtle-shell.png` with `vertexColors: false` when
    the painting lands — CREATURES.md's double-tint warning; the map always wins. The
    stand-in is squashed spheres with pivot groups standing exactly where the GLB's
    joints stand, so one `pose()` call drives either body and the no-assets build
    swims the same stroke.
  - **The ray is authored geometry** — a lens-sectioned diamond, two stitched sheets in
    one mesh (a `ray-topside.png`-mapped back over a pale belly, two geometry groups)
    with a `DoubleSide` tail ribbon, because the camera lives below it. Undulation is a
    `begin_vertex` injection like the grass sway: a travelling wave whose amplitude
    grows as `pow(reach, 1.6)`, plus a slower tail whip, driven by two uniforms shared
    across the three materials (the chunk is a module constant — three keys its program
    cache on `onBeforeCompile.toString()`). It flies the highest band (6.5–9 m) and its
    first arc passes nearly overhead of the H camera at 4.3 m.
  - **The bloom's bells split into leads and chorus, and that is the perf budget.** The
    GLB bell is 1200 triangles and the lathe stand-in 192, and SwiftShader is
    vertex-bound: nine modelled bells measured **5.5 ms** paired where the +2 ms
    allotment lives. Three leads wear `creature-jelly-bell.glb` and the rest keep the
    lathe (same lavender-to-rose-violet story in its vertex colours; it is also the
    whole bloom in the no-assets build), assigned by slot so nothing pops — the bloom
    crosses no closer than ~13 m to the canonical cameras, where the two are the same
    twenty pixels. The glow is `emissiveIntensity` 0.16 of violet, sized under the
    bloom pass's 0.82 threshold; the pulse is a scale animation (squash 0.10 / stretch
    0.14, per-bell phase) and the tentacles are four crossed tapered ribbons on one
    shared geometry, swayed by tilting the mesh — no shader.
  - **Measured cost** (`node scripts/probe-visitors.mjs <tag>`, H's pose, pinned scale 1
    at 1280×720, interleaved pairs, `uptime` printed by the probe; loads 2.5–4.3 with
    three other agents running): turtle **1.0–1.6 ms** (1552 tris, 1 draw), ray
    **0.1–0.5 ms** (394 tris, 3 draws), bloom **2.7 ms** after the split (5112 tris,
    18 draws), from 5.5 before it. The remainder over the allotment is documented
    rather than chased, on the coral ledger's argument: it is vertex- and
    draw-call-bound on the software rasteriser, transient (~40–105 s on stage every few
    minutes), and nothing on real hardware. The probe also screenshots each pose
    (`tmp_<kind>-probe_<tag>.png`), because the canonical set holds only the turtle's
    crossing.
  - **Sound**: `turtle-glide` re-fires every 2.8 s while the animal is within 20 m,
    gain falling with distance (the voice's own 0.7 s attack / 2 s decay does the
    swelling); `jelly-shimmer` every 4 s within 14 m of the cloud's edge. The ray is
    silent — no voice exists for it and inventing one was not this package's call.
  - **Tags**: `wl6-visitors-final` (canonical; H shows the summoned turtle mid-arc),
    `wl6-visitors-noassets` (stand-ins crossing the fallback reef, nothing broken).
    The e2e suite was not re-run: no markup, key, or discovery geometry moved, and the
    schedule's first arrival sits far outside every spec's runtime.
- **The fish are a community now, not a monoculture** (W-L4). Five species behind the
  same three methods the one-species school had — `Game` did not change a line, and
  `probe-fish.mjs` still works because `FishSchoolSystem.mesh` is still the big
  mid-water school. The shapes live in `FishGeometry.ts` (one profile-driven builder:
  every body is the same 42-vertex `SphereGeometry(0.13, 6, 5)` re-proportioned, so
  five species cost five draw calls and not five designs), the animals in
  `FishSpecies.ts` (a data table; appending a species is free, reordering one re-rolls
  every sub-seed below it), and the motion in `FishSchoolSystem.ts` (three behaviours:
  travelling shoals, anchored hover groups, authored patrol loops — an exhaustive
  switch, so a fourth behaviour is a compile error until it is handled).
  - **The community** (152 instances, 5 draw calls, 9120 triangles against the
    monoculture's 120/1/7200): **fusilier** — the old animal, silver-blue `0xdfeef2`,
    91 fish in the same thirteen shoals from the same `SEEDS.fish` stream, mid-water
    at 4–7.2 m; **needlefish** — `0xe2efdc`, needle-thin (0.3×0.35×3.4), twelve in
    four slow lances high at 7.5–8.8 m; **tang** — warm apricot `0xe8b273`, deep and
    laterally flat (0.2×1.5×1.15), sixteen circulating loosely over four coral
    gardens; **damsel** — lavender-violet `0x8d84c6`, tiny (scale 0.22–0.34), thirty
    quivering in tight clouds over five coral heads; **wrasse** — muted terracotta
    `0xc08a72`, heavy (0.55×0.75×2.5 at scale 1.25–1.5), three solitary animals on
    authored ellipses a hand above the sand. Depth stratification is the design:
    shoals mid-water, needles high, coral fish low, the wanderer on the floor, so
    every camera pitch finds life — `probe-fish-diversity.mjs` measures exactly that,
    and after one retune every canonical pose holds every species (tang and damsel at
    100%, wrasse 75–100%, needles 34–64%).
  - **The needlefish had to be retuned off the rim.** The first cut (8.2–9.6 m at
    1.15–1.55 m/s, three lances) measured 0% presence in shots A and G: fast shoals
    spend most of their loop out along the containment rim, beyond the 24 m the fog
    leaves visible, and a species that is never in frame is a species that does not
    exist. Slower (0.75–1.05) and a half-metre lower, in four lances, it crosses the
    bowl the cameras look through. The lesson generalises: a new species' band and
    speed have to be picked against where the *cameras* are, not where the water is.
  - **The second fish material is where the folded-literal pattern breaks**, and the
    old comment predicted it. Sway constants are baked into each species' shader as
    literals, but three keys its program cache on `onBeforeCompile.toString()` — the
    factory's *source*, identical for all five closures — so every species would
    silently wear the first one's program. `customProgramCacheKey` is pushed into the
    cache key beside the defines (checked in three r180's `getParameters`), so each
    material carries `fish-sway:<name>` there and five programs compile. The fog gain
    (1.6) stays shared: distance closes the same water over every animal in it.
  - **Counter-shading, the eye and the near-field cap are species-independent and
    stayed put.** The 0.78 back shade, the two-plateau window and the 1.5 eye are
    baked per geometry by the shared builder (a marking, not a second model of the
    light — the rule holds for a tang exactly as it held for the fusilier);
    `nearScaleCap` went per-species (0.69 for the shoalers, unlimited for the damsel,
    1.15 for the wrasse, which is the one fish designed to be approached).
  - **The coral species anchor on `coralFeedingSites()`**, which is what that export
    was made for — no line in `Reef`, no line in `Game`. The wrasse's three loops are
    authored against the crevice mouths and approach corridors (a fish is not in
    `obstructionMeshes`, so nothing downstream would notice a loop parked on a mouth);
    `tests/fishDiversity.test.ts` sweeps the loops against the four mouth literals and
    holds 4.5 m. Seeding: the fusilier keeps `SEEDS.fish` so the thirteen shoal tracks
    match every archived capture; each new species draws a sub-seed from
    `SEEDS.fishSpecies` in table order, so tuning one species' internal draws never
    re-rolls a sibling. All five meshes are `frustumCulled = false` on the bubbles'
    argument: every instance moves every frame.
  - **The ledger**: whole community ≈ **2.7 ms** paired at pinned scale 1 and
    ≈ **4.3 ms** at the 0.34 floor (pooled medians over four probe runs, 1280×720,
    loads 2–10 with three other agents live — single runs swung ±3 ms and one pose
    measured *negative*, which is the contention tell, so pool before believing). The
    replaced school, measured from a scratch worktree at the base commit with the same
    probe minutes apart: ≈ 2.0 / ≈ 3.5 ms. Net ≈ **+1 ms against a +2 ms allotment**,
    corroborated by arithmetic: +1920 triangles at SwiftShader's ≈0.5 ms per thousand.
    Tags: `wl4-v2` (canonical), `wl4-noassets` (nothing breaks; the community is
    fully procedural and consumes no authored assets).
  - **A probe that projects through the camera must render after every capture.**
    `Vector3.project` reads `camera.matrixWorldInverse`, and three only refreshes
    that during a render — which, inside a synchronous `page.evaluate`, never happens
    between captures on its own. Without one `game.renderFrame()` after each
    `game.capture(...)`, every pose after the first is counted through the *previous*
    pose's view matrix; it took this probe a wrasse at 0% in a frame its ellipse
    demonstrably sweeps, and sixteen tangs permanently inside a frustum half of them
  sat behind, to find that. It only ever looked right on pose A because the spawn
   pose *is* A. `probe-fish.mjs`'s own `onCamera` loop has the same latent staleness
   (its counting capture follows renders at a different pose); left unfixed there
   because that file belongs to the school's history — anything that reuses the
   pattern should take the fix with it.
- **The morays lead a den life now** (W-L7, `src/creatures/morays/MorayPresence.ts` +
  `src/rendering/SandPuffs.ts`). Each reef moray runs a slow presence cycle — tucked
  in the den shadow, peeking (the authored pose), extended a body-third out and
  scanning, eased retreats — plus a startle and a curiosity lean, all decided by a
  pure per-animal state machine `Moray` applies. Temperament (boldness / wariness /
  curiosity, dominant trait as label) and every ambient clock draw from
  `SEEDS.morayPresence` folded with a djb2 hash of the species id, so tuning one
  species can never re-roll a sibling — `fishSpecies`' sub-seed rule again.
  - **The whole design is fenced by other packages' guarantees, and the fences are
    three numbers.** Offsets run **−0.34 m** (tuck) to **+0.9 m** (extension plus
    curiosity lean, capped together) along the den axis, with the authored pose at
    exactly 0: the far cap keeps the head within the ~1.2 m den-mouth budget the
    sightline tests assume (`tests/reefSightlines.test.ts` raycasts the *authored*
    positions and cannot see runtime motion; what it protects is the live head, and
    the live head may not leave the corridor's view), and the tuck sits inside the
    0.6 m margin `Game.isObstructed` already forgives at the target end of its ray.
    A tuck also moves the head *away* along the corridor's own axis, which slightly
    improves the focus cone's angle — checked by arithmetic and by photographing the
    tucked head from the approach (`tmp_P2/P6-*_wl7-r2`), so a startled moray is
    still discoverable.
  - **The opening state is peeking at offset 0, held 110–150 s** — the visitors'
    first-arrival floor, one layer over. Every canonical settle (1–9 s, taken well
    under a minute into the page) and the whole discovery e2e swim are
    presence-quiescent by construction. Measured against a same-session control
    (`wl9-r2`, captured from the same tree seven minutes earlier): shot C's luma
    mean held to **+0.1**. The one deliberate exception: B, C and H stand 6.5–6.9 m
    from a den, inside the 2.2–7 m curiosity band, so they carry a small
    *deterministic* lean that is the package's visible change (sub-noise in C's 1 s
    settle; up to ~0.2 m of zebra in H's 9 s).
  - **Presence engages only after the root has held still for 2.5 s**, and that one
    gate is three guarantees: a sanctuary resident (re-posed along its lane every
    frame) never engages, a codex portrait (1 s settle) stays bit-identical, and
    `tests/morayHead.test.ts`'s head-position pin (2 s) holds to the bit. The offset
    is applied to `bodyRoot.position.z` — a rigid slide of head, bones and skinned
    meshes together, so the neck join cannot open, the hulls ride along, and the
    discovery target `Game` copies from `getHeadWorldPosition` tracks the real head
    with no `Game` change. Divided by root scale, so the machine's metres are world
    metres at any dressing size.
  - **The diver's motion reaches the morays over a published channel, and that is a
    stated wart in the `FaunaAudio` family.** `Moray.update` is handed a position
    and a flag, not the speed and not the reduced-motion setting, and this package
    may not widen `Game`'s wiring — so `SandPuffs.update` publishes
    `ctx.diverSpeed`/`ctx.reducedMotion` into module scope and `Moray` reads it back
    (`diverMotion()`). Using the dive controller's own velocity rather than a
    position difference is what makes the capture harness safe: `capture()`
    teleports the diver and *zeroes the velocity*, so a screenshot pose can never
    read as a charge. Startle is > 3.2 m/s inside 4.2 m (the e2e approach releases
    at z = 9 and speed decays ≈ 2.6 m/s per metre of coast, so the spec's own swim
    cannot trip it); re-emergence needs the hold *and* 2.5 s of sustained calm —
    the clownfish hysteresis — and comes back at 2.5× slower ease, wariness as a
    number. Reduced motion halves both travel and rate, the kelp convention.
  - **Sand puffs are instanced toon spheres that fade by scale**, the bubbles' trade:
    one opaque material, one draw call, no shadows, `frustumCulled` false, count
    tracks the live motes so an idle system draws zero instances. `requestSandPuff`
    is a module-scope door in the visitor-director pattern; morays kick it on
    startle (strength sized by how far out the body was) and on emergence, 0.45 m
    forward of the den anchor and 0.3 m down — the first cut spawned at the anchor,
    *behind* the emerged head, and rendered as nothing. Mote radii are 6–13 cm for
    the same reason: at 3.5–7.5 cm a whole burst measured invisible from the four
    metres the probe poses stand at. `sand-puff` audio fires from inside the system
    (diver within 9 m, ≥ 0.3 s apart); `moray-peek` fires from `Moray` on emergence
    within 18 m — both through the guarded `__reefAudio` handle (`MorayAudio.ts` is
    the file to delete when a real audio channel arrives).
  - **What it costs, honestly: nothing measurable at idle, and a bounded transient.**
    Steady state adds four pure-math machine updates and one zero-count instanced
    mesh. A worst-case burst is 72 motes × 60 tris ≈ 4.3k triangles ≈ **2 ms** by
    the ledger's ≈ 0.5 ms/k SwiftShader rule (an ordinary single puff is ~16 motes,
    ≈ 0.5 ms), alive for about two seconds. That bound is arithmetic on measured
    constants rather than a fresh paired probe, deliberately: the machine ran at
    1-minute loads of 7–10 with three other agents capturing all session, which is
    exactly the regime W-L4b's ledger documents as drift wearing a number.
  - **QA doors, because every state lives on a clock no capture reaches**:
    `window.__morayPresence[speciesId].force(state)` (hung on engage, so sanctuary
    residents can never shadow the reef's animals) and `window.__sandPuffs.puff(...)`.
    `node scripts/probe-moray-presence.mjs <tag>` photographs peek / tucked /
    extended / startled-with-silt at `probe-moray.mjs`'s own corridor poses. Tags:
    `wl7-r2` (states), `wl7-presence` / `wl7-presence-noassets` (canonical + fallback,
    nothing broken; the primitive-head path takes the same `bodyRoot` slide).
  - **A 60-second spec budget does not survive a load-10 machine, and that is the
    documented starved-loop failure, not a discovery regression.** The discovery
    spec timed out twice at loads 9–10; an instrumented rerun of the same swim at
    the same load discovered at z = 6.2 with the animal still `peeking` — the swim
    plus page load alone cost ~40 s of wall clock. On the first quiet minute (load
    4.2) the spec passed at **54.3 s of its 60**, with both smoke specs beside it;
    that margin is the machine's, not the code's. The rest of the suite was not
    re-run by this package, on W-L5/6's argument: no markup, key, focus geometry or
    schedule it drives was touched, and the peek audio's first possible event
    (110 s) sits outside every spec's runtime.
- **The bowl is an amphitheatre now, and the macro terrain lives inside
  `seabedHeight`** (W-L9, "Terrain & Flora Grandeur"). A rim ridge sweeps the
  seabed up beyond the swim box — rising from r = 26, cresting 33–37 at
  ~2.5–4.5 m (a four-harmonic seeded skyline, `SEEDS.bowlRim`), falling back to
  dune level by r = 45 so the sand sheet's far corners stay flat under the
  painted distance — plus two mid-field shelves (a 1.25 m terrace at (4, −19)
  that lifts the deep-south coral garden and a 1.05 m bench at (−19, 13) under
  the NW kelp stand) and a 0.5 m hollow at (13, 14) in shot A's right
  mid-ground. Everything is *inside* the one function, deliberately: coral,
  rocks, rubble, grass, kelp, dens, fauna homes and the wrasse's per-frame
  height all sample `seabedHeight`, so the whole world follows the terrain with
  no second path to drift against.
  - **The macro rides the same protection mask as the micro relief**, so every
    crevice ring, the spawn corridor and the frozen literal table are
    bit-identical *by construction* — `tests/seabedRelief.test.ts`'s first three
    cases did not change a character. The fourth became an envelope (delta
    bounded by 0.1 plus the authored feature heights at their authored places,
    from a table of literals copied into the test), and three new cases hold the
    rim's existence (>1.8 m mean at the crest ring), the features' presence, and
    "no mid-field feature climbs into the swim volume". The corridor's mask cuts
    a notch through the northern rim around x = 0 — behind the spawn camera, and
    structural, not a bug.
  - **The diver is kept off the ridge by colliders, not by hope.** The swim
    bounds are a ±30 box, so a diver at its corner reaches r = 42 where the rim
    is metres tall; `Reef.buildRimColliders` rings the crest's inner shoulder
    (24 spheres, r = 33.5, radius 6.5 — surfaces near r = 27 where the ridge is
    ankle height) and sinks dome spheres under both shelves so the body glides
    over them like a dune. Every `reefSightlines` sample lives within 14 m of a
    head, ten-plus metres clear of all of it; the suite passes untouched.
  - **The sanctuary shares `seabedHeight` and its floor is 60 m wide**, so the
    rim's foot and the shelf at (4, −19) are inside that plane. Checked on shots
    E and S against `wl6-visitors-final`: nothing reads — the room's fog, its
    own stacks and the sweep's framing keep the edges out of every frame. The
    origin neighbourhood (the set, the residents, the camera) is masked ground
    and did not move.
- **The painted distance is `src/world/DistantReef.ts`** (W-L9,
  `SEEDS.distantReef`): three silhouette rings at r = 52 / 64 / 78 — fbm
  skylines (periodic by construction: one turn is one lattice period) with a
  few seeded pinnacle spikes, ~1.5k triangles and three draw calls for the lot,
  pure geometry, no DOM, no assets, in neither `obstructionMeshes` nor
  `colliders`. The one idea worth stealing: **they carry `fog: false` and mix
  their own fog by hand.** `FogExp2` at 0.028 has all but closed by fifty
  metres, so a fogged mesh out there renders as invisibility with draw calls;
  instead each layer's colour is `scene.fog.color` taken down a violet-leaning
  step (red held above green's cut, per the value key) and lerped back toward
  the fog by its own distance (fades 0.42 / 0.6 / 0.76) — which is exactly how
  a background painter mixes a mountain from the sky. The tints re-derive from
  `scene.fog` in an `onBeforeRender` hook (the backdrop re-picks the fog colour
  when it lands), so the layers agree with any repaint for free. In the
  no-assets build they stand against the gradient and read *stronger*; nothing
  breaks.
- **The kelp is a forest with a canopy now, and its leaves draw from their own
  stream** (W-L9, still two draw calls, no shadows, same `aPhase`/`aReach`
  sway). Five authored giant stands (7.2–9.4 m, `giant: true` in `KELP_CLUMPS`,
  twelve stalk rings, 10–13 straps biased hard into the top third, crown straps
  drooping 1.7× so the head spreads) put verticals in the upper frame the
  package was bought for; regular stalks took a deeper two-harmonic S (the
  second harmonic rides the phase draw — no new stream traffic) and one more
  ring. The palette went a step deeper and calmer (`LEAF_TONES`) with the
  warmth moved into the tips: vertex colours lerp toward a golden-olive
  (`TIP_GOLD`, crowns take 0.55 of it), and the fragment shader gained a
  sun-backlight term — see below.
  - **The leaf/placement stream split is the RNG-fragility fix the kelp test's
    header always wanted**: leaves now draw from `seed ^ 0x1eaf_0001`, so a
    stalk costs a fixed five draws whatever hangs off it and retuning the
    canopy can never move a holdfast again. The split itself re-rolled the
    forest once — the re-diced near stand grazed a snowflake lane by 13 mm and
    stepped to (−5.45, 13.2) at radius 0.6, which is the lane test doing its
    job, exactly as W-L3 predicted. A new test case holds the canopy above
    7.5 m so a tune cannot quietly lose the giants.
  - **The sun-through-the-leaf glow is shared shader, exported from
    `SeaGrass`** (`injectLeafGlow` / `createSunViewUniform` / `trackSunView` —
    that module because Kelp already imports `unpackStrip` from it and the
    import may not run the other way). The term is
    `pow(max(dot(camera→fragment, sunView), 0), 4)` on top of the old
    view-facing translucency: a strap between the camera and the sun goes
    golden, gone looking down-sun. The sun's view-space direction is re-derived
    in `onBeforeRender` from `SUN_POSITION` and the camera — the CoralField
    self-winding compromise, because nothing owns an update call with a camera
    in it. The warm tints look timid on purpose: a warm additive in this water
    reads far louder than its luminance says (the value key's own rule).
- **The meadow bows and drifts** (W-L9): the blade is a true integrated arc now
  (bend angle grows toward the tip, strip integrated along it — `TIP_BOW`
  1.0 rad, still the original four segments after a fifth measured as pure
  vertex cost on eleven hundred instances), and each patch draws one of three
  palette families (spring / olive / seafoam) from a *side* stream
  (`seed ^ 0x9e37_79b9`, drawn-even-if-broad so a patch changing kind re-rolls
  nothing) — the meadow's layout is bit-identical to W-L8's and only the colour
  moved. Tip sun-glow via the shared injection, weighted by `vMapUv.y`.
- **The flora accents are `src/world/Seaweed.ts`** (W-L9, `SEEDS.seaweed`): 16
  lobed bushes (five welded squashed spheres, olive and wine — the
  crevice-mouth rule again, the darkest plant on the sand is a colour) and 16
  drooping frond rosettes (seven straps integrated past horizontal, grass-style
  instance-phase sway), two instanced draws, no shadows. Placement is rejection
  sampling against **`CoralField.isClear`, imported rather than copied** — the
  legal direction, and the whole clearance law (crevice rings, mounds,
  corridors, anemone disc) in one call. `tests/seaweed.test.ts` reads it back,
  holds determinism, the two-draw shape and disposal, and also guards
  `DistantReef` (everything beyond r = 46, no shadows, seed-stable skyline).
- **W-L9's ledger, honestly.** Instrument: `node scripts/probe-flora.mjs <tag>`
  (`PROBE_SCALE=0.34` for the settled floor) — the kelp probe's interleaved
  paired-difference method pointed at the four named layers (`kelp`,
  `sea-grass`, `seaweed`, `distant-reef`). One trap it paid for so nobody pays
  twice: **`Game.capture()` pins the render scale to 1 as part of its own
  contract, so a probe must pin *after* posing** — pinned before, this probe's
  first "floor" run measured scale 1 twice and called it the floor. Numbers
  (1280×720, pooled over two runs each, 1-minute loads 3–10 all session with
  another agent capturing; single layers measured negative in the worst
  windows, which is the contention tell — pool before believing): at the floor,
  gross paired medians land kelp ≈ 8–9 ms, grass ≈ 16–19, seaweed ≈ 2.5–4,
  distant ≈ 0.5–2. The *net* of this package — kelp's +~2.7k triangles over
  W-L3's 14.1k, the grass's shader-only delta (geometry and instance count
  unchanged), all of the seaweed and all of the distance — comes to
  ≈ **+5–6 ms against the +4 ms allotment, over by one to two, documented
  rather than chased** after the cheap cuts were already taken (grass back to
  four segments, bush lobes coarsened, stalk rings split regular/giant, bush
  and frond counts 22 → 16): every remaining lever — fewer giants, fewer
  bushes, a dropped far ring — visibly costs the composition the package
  exists for, and the layers are vertex-bound on SwiftShader, i.e. nothing on
  real hardware. Old-kelp floor figures in W-L3's note were arithmetic
  (fill ÷ 8.6), not measurements, so they undercount vertex cost — do not
  compute a net against them directly.
  - **Tags**: `wl9-final2` (canonical; `wl9-final` predates the last seaweed
    count trim by twelve instances), `wl9-r2-noassets` (fallback build —
    silhouette rings against the gradient, procedural kelp/grass/seaweed,
    nothing broken; the only geometry change since that capture is invisible
    tessellation trims). Before-sets: `wl4b-heads` / `wl6-visitors-final`.
  - **Tests**: full unit suite 226/226 (typecheck and eslint clean).
    `discovery.spec.ts` + `smoke.spec.ts` were run because this package moved
    the ground: discovery timed out once at load 9–12 and passed at 27.6 s on
    the next quiet minute — W-L7's starved-loop entry above, observed
    independently the same day. The rest of the e2e suite was not re-run: no
    markup, key, or focus geometry moved, and the ground under everything the
    specs drive is masked bit-identical.
- **The sanctuary has life in it now, and all of it is set dressing**
  (W-L8, `src/sanctuary/SanctuaryLife.ts`). A slow shoal of fourteen
  fusiliers rides a wide ellipse around the residents' lanes (centre
  (0, −2.5), 6.6 × 4.6 m, a lap every two minutes, cruising height 3.9 m so
  the ribbon crosses behind *and* in front of the eels), and three jelly
  bells drift high at ~5.1 m on slow closed-form lissajous wander, pulsing at
  0.2–0.32 Hz — deliberately under the reef bloom's 0.28–0.42, because the
  pulse is the room's heartbeat and a lullaby's is slow. Everything is a
  closed form of accumulated simulated time, so `capture()` holds it like
  everything else, and the whole system is built once in the scene's
  constructor and never touches the `setSpecies` path —
  `tests/sanctuaryScene.test.ts` now asserts that, plus seed-determinism of
  the poses and exact disposal.
  - **The animals are the reef's own, not new drawings.** The fish is
    `createFishGeometry(FISH_SPECIES[0].body)` — the fusilier read straight
    off the species table — and the bells are `buildFallbackBell` /
    `buildTentacles`, exported from `JellyBloom.ts` for exactly this. Two of
    the three bells wear `creature-jelly-bell.glb` through `requestModel`
    (leads-by-slot, the bloom's own pattern); the third keeps the lathe,
    which is also the whole set in the no-assets build.
  - **The fish material needs its own program cache key.** The sway patch is
    the reef's folded-literal closure pattern, and three hashes
    `onBeforeCompile.toString()` — which matches the reef's five fish
    closures exactly — so without `customProgramCacheKey =
    "fish-sway:sanctuary-fusilier"` the shoal silently wears whichever fish
    program compiled first. Its fog gain is 1.35 rather than the reef's 1.6:
    the room's fog is denser (0.042) and the ring runs nine to sixteen
    metres from the lens, where the full gain drowned the far arc entirely.
  - **Two seeds, not one** (`SEEDS.sanctuaryFish` / `sanctuaryJellies`): the
    shoal and the bells are tuned separately, and a count change in one must
    not re-roll the other out from under shots E and S.
  - **Disposal is exact because the owned lists close before the GLB swap.**
    `dispose()` releases what the constructor built — fish geometry, lathe,
    ribbons, three materials — and can never touch the library's bell
    geometry, because the owned lists were filled at construction and the
    swap arrives later. Same contract as every other `AssetLibrary` caller.
  - **There is deliberately no floor accent.** The clownfish is
    anemone-coupled by design ("a clownfish without an anemone is not a
    thing this reef has") and the room has no anemone garden; anything
    shrimp-sized on this sand would live at nine metres behind the species
    cards' strip of the frame. And the residents' jaw-breathing asked for by
    the brief was already free: ventilation runs unconditionally in
    `Moray.update`, reef and sanctuary alike.
  - **What it costs**: paired via `scripts/probe-sanctuary-life.mjs` (the
    kelp instrument pointed at the `sanctuary-life` group, room open,
    residents present): **1.3 ms** at the 0.34 floor, **1.7 ms** at scale 1,
    loads 3.4–4.5. The whole sanctuary frame measures 90.5 ms at the floor /
    330 ms at scale 1 against the reef's 156–177 / 398–541, so the room
    still replaces the reef for less than the reef costs, which is its
    standing budget. Shots E and S hold the archived `wl9-final2` means to
    a fraction of a part in 255 outside the pixels the life itself covers.
  - **Tags**: `wl8-final` (canonical), `wl8-final-noassets` (all-lathe
    bells, procedural everything, nothing broken), `wl8-life1` (the sweep
    walked with the life in, via `probe-sanctuary.mjs`).

## ROUND L GLOBAL LEDGER (W-L8)

The round's reference for what everything costs, measured in one sitting on
one machine and replacing the scattered per-package claims above for any
question of budget. Instrument: `node scripts/probe-global.mjs <tag>` — the
kelp probe's method (renderFrame behind a one-pixel `readPixels` barrier,
pinned scale, interleaved on/off pairs, median of paired differences)
pointed at every named system in one page session, so every row of a column
shares its session, its pose and its load. Two caveats it inherits: a
paired median under a few ms is inside the drift (`seaweed` and
`distant-reef` measured *negative* in two poses), and the machine here was
"quiet" only by this repo's standards — a desktop Chrome and a video
wallpaper idle at load 2–4 on this host, and the probe itself adds ~3. One
run per scale (tags `wl8-floor`, `wl8-scale1`), loads 2.4→8.0 and 5.3→9.2
across the ~3/~7 minutes each run took; ranges below span poses A/B/C/G.

| System (package) | paired @ 0.34 floor | paired @ scale 1 | allotment | decision |
| --- | --- | --- | --- | --- |
| coral garden (W-L2) | 32.0–37.9 ms | 45–71 ms | +3 ms | stands as documented: the round's one big line item (~22% of the floor frame); the two levers left (polyps, shadows) buy ~7 and visibly cost the garden |
| kelp forest (W-L3+L9 canopy) | 7.3–9.0 ms | 15.3–20.6 ms | +2 ms (L3) | stands; receive-shadow lever already pulled, next lever is clump count and it is visible |
| sea grass (pre-L, L9 shader) | 13.0–17.4 ms | 16.5–34.4 ms | baseline system | left alone: not a Round L addition, and thinning the meadow re-rolls its stream (RNG-fragile) for a cut nobody priced |
| seaweed accents (W-L9) | −0.5–3.8 ms | −1.2–9.9 ms | inside W-L9's +4 | noise-level at the floor; stands |
| distant reef (W-L9) | −0.9–4.0 ms | −1.8–5.8 ms | inside W-L9's +4 | noise-level at the floor; stands |
| fish community (W-L4) | 2.1–4.8 ms | 2.8–9.5 ms | +2 ms | in budget, confirmed |
| ground fauna (W-L5) | 2.7–6.8 ms | 0.2–10.3 ms | +2 ms | matches W-L5's 3–7 under contention; over, stands as documented |
| den dressing (W-L4b, gross) | 2.4–5.7 ms | 1.8–20.8 ms | +2 ms | castShadow lever finally measured: **1.1–1.2 ms** at the floor — too little to pay for losing the arch's grounding shadow in shot C; left |
| moray GLB heads (W-L4b, gross) | 4.5–7.6 ms | 9.0–14.4 ms | +2 ms | gross of the primitive stack they replaced; net low single digits per W-L4b; stands |
| visitors (W-L6) / presence (W-L7) | ~0 idle | ~0 idle | +2 / 0 | structural (absent visitor = one empty node; presence = pure math); transients as documented |
| sanctuary life (W-L8) | 1.3 ms | 1.7 ms | room < reef | in budget; room at 90.5/330 ms vs reef 156–177/398–541 |

- **The whole frame, and where the scaler sits.** At the 0.34 floor the four
  standing poses measure **A 157.8 / B 164.5 / C 155.8 / G 176.6 ms**; at
  scale 1, 398–541 ms. Live at spawn (`measure-frames.mjs`, which now also
  prints it): median **166.8 ms, p95 268.7, settled scale 0.34**, load 2.3.
  The scaler's shrink threshold is a 30 ms frame, and no pose gets within a
  factor of five of it even at the floor, so **0.34 is the settled scale in
  every pose on this QA environment** — read at spawn through the new
  `__reef.renderScale` door and true everywhere else by that arithmetic.
  Against the round's own baselines: mid-round (W-L2's ledger, W-L3 kelp in
  frame) was 133 ms at load 2.8; Round G's scaffold-era spawn median was
  83 ms. Round L roughly doubled the software-rasteriser frame, all of it
  documented above, none of it visible on hardware that runs a vertex
  shader where it belongs — SwiftShader's ≈0.5 ms per thousand triangles is
  the whole story of every overage in this table.
- **The balance decision, stated once**: no cuts. Every system re-measured
  within its documented figure on the quietest windows this host offers;
  every remaining lever either buys ~1 ms (den shadows, measured this
  round) or was already priced by its own package as visibly costing the
  composition it exists for. The density pass over the canonical nine
  (`wl8-final`) found no clutter and no dead zones worth a re-roll, and A/C
  held the `wl9-final2` archive to within a part in 255 — the reef half of
  this package is untouched by construction.
- **What e2e actually needs, measured**: a single page boots to a live HUD
  in **20 s** at load 3.3, so two parallel workers on a desktop already
  running a browser and a video wallpaper blow the 60 s spec budget on boot
  alone — three full-suite runs at ambient loads 3–8 failed 8–12 specs
  *with healthy page snapshots* (the starved-loop entry, at suite scale).
  Gated on a genuinely quiet minute (1-min < 3 **and** 5-min < 4) and run
  `--workers=1`, the suite is **20/20** (discovery 32.3 s, sanctuary V
  31.8 s, save round-trip 60 s of its doubled budget). Anyone re-running
  the suite on this host should gate and serialise the same way rather
  than reading a red 2-worker run as a regression.
- **Unit suite**: 229/229 with the new sanctuary-life cases (typecheck and
  eslint clean). New instruments this round leaves behind:
  `probe-global.mjs` (the whole ledger in one session),
  `probe-sanctuary-life.mjs`, the `__reef.renderScale` getter, and
  `measure-frames.mjs` printing the settled scale beside its medians.

## W-M2 — MORAY PERSONALITIES (Wave 5)

- **Personality is a species trait now, layered over W-L7's individuals**
  (`src/creatures/morays/MorayPersonality.ts`). A profile is a parameter set
  that *feeds* existing machinery, never new machinery: a `PresenceStyle`
  biases the W-L7 state machine (trait windows the seeded draws map into,
  hold-range multipliers, a startle-threshold scale, ease-rate scales, an
  extension-eagerness scale inside the hard cap) and a `MorayMotionStyle`
  multiplies terms `Moray.update` already animates (sway amplitude/tempo,
  scan widening, head-tracking rate and strength, ventilation tempo, the
  three sculpted-jaw gape terms). The neutral style is bit-identical to the
  unbiased machine — same PRNG stream, same arithmetic — and
  `tests/morayPersonality.test.ts` proves it draw for draw through a startle,
  which is what kept all sixteen W-L7 tests green unchanged.
- **The hard fences took no style, by construction.** `TUCK_OFFSET`,
  `MAX_EXTENSION`, `STARTLE_RADIUS`, the 110–150 s opening hold, the 2.5 s
  engage gate, the sanctuary non-engagement and the reduced-motion damping
  are not fields on `PresenceStyle` — a personality cannot reach them. The
  snowflake's hair trigger is a *speed* scale (3.2 → 2.4 m/s) with the radius
  untouched, because the radius is what protects the discovery e2e's swim
  (it coasts to a stop 7.5 m out, outside the 4.2 m ring at any speed).
- **The five characters, and where each lives in the numbers**: snowflake —
  the shy dreamer (tucks 2.2× long, wariness windowed 0.8–0.99, sulks 1.5×
  and re-emerges at 1.5× the wary slowdown; curiosity windowed high, and a
  `curiositySway` term makes the sway bloom as trust is won). zebra — the
  methodical patroller (`clockSpread` 0.15 closes every hold draw on its
  midpoint; startle threshold 1.6×, curiosity windowed 0.1–0.25: it barely
  reacts either way, and that is the character). dragon — the bold sovereign
  (boldness 0.85–0.98, extend chance 1.5× capped at 0.97, full reach,
  extended holds 2×, startle threshold 2.2× ≈ 7 m/s; lookRate 1.6 and
  lookGain 1.35 meet an approaching diver with a direct stare, gapeBias 0.7
  with attendGape 1.5 carries the widest jaw language). ribbon — the playful
  dancer (peeking/extended holds halved, wary emerge 0.45× — fastest back
  after a fright — 1.3× sway at 1.25× tempo, and the flourish below). abyss —
  the elusive hermit, keyed `"abyss"` for the concurrent W-M3 package (tucks
  3.2×, extends at 0.55× chance but 2.6× long — rare, calm, prolonged — and
  a startle that is a withdrawal, not a bolt: `startleTauScale` 6 folds it
  back over ~2.4 s of ease). The lookup tolerates species without profiles
  (neutral default) and profiles without species (dead data), and strips a
  `-moray` suffix, so neither concurrent worker could block the other; W-M3's
  species landed mid-package with id `"abyss"` and connected untouched.
- **The ribbon's ripple is the one new expression, and it is fenced like the
  presence cycle.** A 2.4 s travelling wave (5.2× the sway frequency) added
  to the joint loop, timed from `SEEDS.personality` folded with the species
  hash (`personalitySeed` — pre-registered, `Random.ts` untouched): first
  fire 155–215 s *after the presence engage gate*, past the opening hold's
  own 150 s ceiling, then every 30–75 s while the animal is showing; an
  animal in cover retries 8 s later. It runs only once presence has engaged,
  so a sanctuary resident never ripples (the lane re-poses the root every
  frame), and it halves under reduced motion — the kelp convention. The
  presence door grew a `ripple()` QA hook (species without the flourish
  ignore it: the envelope multiplies by `motion.ripple`, which is 0).
- **The codex speaks the personality** (`src/ui/Codex.ts`): one italic
  storybook sentence per card, `personalityFor(config.id).codexLine`, as a
  second `<p class="codex__personality">` under the fact — `.codex__entry p`
  already styles it, so `style.css`, the markup contract and the e2e text
  assertions did not move. A species without a profile wears the default's
  gentle line rather than a broken card.
- **QA**: `node scripts/probe-moray-personality.mjs <tag>` photographs the
  characters at `probe-moray.mjs`'s corridor poses — the dragon extended and
  staring (K1), the snowflake tucked half into the den shadow (K2), the
  ribbon extended mid-flourish through the `ripple()` hook at the envelope's
  1.2 s crest (K3), the zebra extended mid-patrol (K4). Tags: `wm2-r1`
  (first pass; the ribbon at "peeking" showed only a head, which is why K3
  forces "extended"), `wm2-r2` (canonical characters), `wm2-codex` (the six
  probe-ui surfaces; U4 shows the personality lines), `wm2-personality` /
  `wm2-personality-noassets` (canonical + fallback sets — the primitive-head
  path takes the same styling, nothing broken). Shots A and C hold the
  archived `wl8-final` means to +0.9 and +0.5 of luma — inside the
  documented capture noise, with the concurrent package's world changes in
  the same diff. Budget ~0 as priced: parameter work plus one conditional
  travelling-wave term in a loop that already runs.
- **Contention notes, honestly**: captures were taken with W-M3 editing the
  same tree (one canonical run aborted on a Vite full-reload mid-navigation
  and one carried a transient `Cannot read properties of undefined
  (reading 'add')` page error that a clean load could not reproduce — HMR
  swapping modules mid-session, not a code path either package ships). While
  W-M3's den landed before its species config, the page threw `Unknown moray
  species id: abyss` at boot — `MorayRegistry.require` doing its job; it
  cleared the moment their species appended. Unit suite at this package's
  close: 245 tests with the 15 new personality cases green and three
  failures owned by W-M3's in-flight work (`morayAsset` species count,
  `coralGarden` clearance against the fifth den, `seabedRelief` envelope) —
  re-run `npm run test` after their append lands.

## W-M3 — THE SECOND BIOME (Wave 5)

- **There is a world past the rim now, and one animal that lives only there.**
  `src/world/Abyss.ts` is the whole biome's arithmetic in one module — the
  seeded gate azimuth, the wedge, the carve profile, the mood function, the
  airspace, the den — so the terrain, the colliders, the weather and the
  animal agree about where "beyond" is by construction. The gate azimuth is
  drawn from `SEEDS.abyss` inside [0.78, 0.99] rad and lands at **0.7901 rad
  (45.3°, north-east)**; the band is that narrow because it is doing three
  jobs: every canonical camera looks south or south-west (so the in-bowl shot
  set cannot see the gate), the ±45 m seabed sheet only reaches r = 50 where
  it is diagonal (so the carve fits without touching the sheet's size or
  vertex grid), and the spawn corridor's own mask notch sits at 90°, out of
  reach. Anything derived from the azimuth in a script — capture poses, the
  cost probe's wedge filter — carries the literal and says to re-derive it if
  the band moves.
- **The carve is a blend toward an authored floor, gated like the protection
  mask.** `seabedHeight` gained one term: `canyonBlend` (exactly 0 outside
  r 29.5–50 and the ±0.32 rad wedge, by early return) lerps the bowl's own
  answer toward `canyonTarget` — a saddle through the notch at −2.2, one
  smooth shelf down over r 36–44, a twilight floor at −8.4 with its own
  hand-depth of seeded detail, rising back to dune level by r 50 so the sheet's
  far corners stay flat under the painted distance. Blending *toward* a target
  rather than adding is what makes the walls: at the wedge's angular edge the
  terrain is the rim's own, at the floor band it is the floor's, and the slope
  between them is the canyon's side. Everything standing on the ground kept
  its one-function contract for free — the rubble that scatters into the NE
  corner now lies *on the canyon floor* with zero code.
- **The bowl is bit-identical by construction, and the tests say it three
  ways.** `seabedRelief`'s FROZEN table, dense crevice sweeps and corridor
  sweep pass untouched; its envelope test grew a copied-literal canyon bound
  (azimuth, wedge, 9.5 m max drop) and two new cases pin the saddle depth, the
  floor's 6–10 m band, the shelf's monotone descent, and `canyonBlend === 0`
  just past every edge. `tests/abyssBiome.test.ts` holds the headline
  invariant: `abyssMood` returns exactly 0 over the whole bowl at every depth
  a diver or capture can occupy *and* above y = 0.45 at any radius — then
  drives the real fog and lighting hooks with cameras on both sides and
  asserts base values come back verbatim (`toBe`, not `toBeCloseTo`).
  Measured: A/C/D/F/G/H hold the archived `wl8-final` means within the
  documented capture noise (see the tags note below).
- **The mood is positional weather, and it hangs off `Scene.onBeforeRender`.**
  Three calls it at the top of `render()`, before render lists and background,
  with the camera the frame is drawn through — so fog colour, fog density,
  `backgroundIntensity` and the three light intensities are each written once
  per composed frame, consistently, with no probe mesh and no Game wiring.
  `onSceneRender` in `Abyss.ts` chains the slot; `UnderwaterFog.applyTo` and
  `Lighting.addTo` both register (the sanctuary constructs `UnderwaterFog`
  too, and its camera never leaves mood-zero space, so its hook is a no-op by
  the same arithmetic). At full mood the fog is base × (0.58, 0.31, 0.64) —
  green cut hardest, red held nearest, the value key's rule for violet-blue
  rather than electric — density +0.024, backdrop at 0.48 of its level, key
  down 72%, hemisphere 45%, ambient only 22% so the dark stays a colour.
  Reduced motion needs nothing: nothing animates, everything is positioned.
  Two free consequences: WP-G5's pooling reads `scene.fog` per frame, and
  `DistantReef.followFog` re-mixes its inks from it, so the whole painted
  distance turns violet with the water and turns back, unplumbed.
- **The diver descends below the box, and the box learned one new word.**
  `ReefBounds` grew an optional `annex` — contains/floor/ceiling/maxRadius —
  and `CollisionField.resolve` swaps its box clamp for the annex's while the
  point is inside it; absent, the path is byte-for-byte the old one. The reef
  supplies the wedge sector as the annex: floor = `seabedHeight + 0.7` (the
  carved ground itself), ceiling easing 12 → 5.5 m past the gate, radial cap
  at 51. Side containment is spheres, like everything: the rim ring keeps 23
  of its 24 (only the sphere dead in the notch is skipped — its neighbours at
  ±15° are what narrow the doorway to a ~4.3 m channel), two rows of wall
  spheres run down each wedge flank, and an end pair flanks the den's mound so
  the far curtains are never reached. The annex predicate is deliberately
  wider than the walls, so a sphere always turns the body before the zone
  changes hands. `tests/abyssBiome.test.ts` sweeps the whole NE annulus and
  asserts every collision-free point is inside the bowl box or the airspace,
  walks a waypoint path from the bowl down to the den approach, and pushes a
  too-deep column back above the carved ground.
- **The gate is two authored spires, and the first cut was a snowman.** The
  `GATE_STACKS` table in `Reef.ts` is authored in gate space (radians off the
  axis, so the whole gate turns with the seed) and went through the same
  lesson the bowl's pinnacles did, compressed: at this scale the bowl's
  segment ratios read as stacked boulders, and a doorpost wants stretches of
  1.6–2.1 with segments overlapped by more than half. They are ordinary reef
  stones in every contract — `stackGeometry`, `boulderMaterial`,
  `obstructionMeshes`, per-segment colliders, contact patches — named
  `abyss-gate-stack` for the cost probe. They stand outside every canonical
  frustum *and* outside the sun's ±24 m shadow box.
- **The fifth crevice is the old machinery pointed at new ground.**
  `abyssDenPlacement()` is appended after the FROZEN fences and fed through
  the same `addHidingSpot` — mound, cave mouth, flanks, sightline contract —
  with its head height riding the carved floor at construction, facing back up
  the shelf so the approach corridor *is* the canyon. `dressDens` poses the
  fifth arch from `Random(SEEDS.abyssDen)` after the four `denDressing` draws,
  so the frozen dens are dressed identically to the bit. `reefSightlines`
  gained two new cases (existing ones untouched): the generic visibility sweep
  re-run at canyon eye heights (floor +1.1/1.6/2.3), and a terrain-lip case
  that walks the descent sightline and asserts the ground never rises within
  0.15 m of it — because the seabed is not an obstruction mesh, and a terrace
  lip would hide the head from every raycast while hiding it from the player.
- **The abyssal moray is procedural on purpose.** Species id **"abyss"**
  (`Gymnothorax bathyphilus`), standard archetype at 1.2 length / 0.9 girth,
  dark violet-charcoal `0x37324e` (red above green: violet, not navy), pale
  moonlit speckle `0xdde6f4`, periwinkle accent, **no `albedoAsset`** — the
  procedural skin is the documented fallback path and a creature of the dark
  is the animal that makes it a first-class look. `MorayPattern` grew a
  fourth `PatternKind`, `"speckle"`: voronoi cell centres as small pale
  points, gated by low-frequency fbm into loose constellations (both terms
  span whole lattice periods across `u`, so the belly seam stays seam-free).
  The outline machinery hands it the cream halo ink and 0.43 of value
  separation with no changes; W-M2's `"abyss"` personality profile — the
  hermit — was already waiting for it, tolerant lookup and all. The objective
  count derives from the placements table (`discovery.totalCount` →
  `reef.hidingSpots`), so HUD, objective line and codex all went 4 → 5 with
  no UI edit; the one stale string is the hint ladder's "Four morays hide
  across the reef." in `Game.ts`, which this package did not own — flagged
  for the next `Game.ts` owner.
- **The count edits, each with its reason**: `morayAsset` registry size 4 → 5
  plus "abyss" in the id list (the species shipped); `coralGarden`
  hidingSpots 4 → 5 (the loop now also proves the garden clears the canyon
  spot); `smoke.spec` total-count "4" → "5" (derives from the placements
  table); `sanctuaryScene`'s assertions counted `MORAY_SPECIES.length` and
  needed nothing — but `SanctuaryScene.LANES` had four lanes and
  `LANES[index % LANES.length]` put a fifth resident *inside* the snowflake
  at the same phase, so a fifth lane was added (low, slow, deep, backwards,
  phase held off its height-neighbour). That one line is outside this
  package's ownership list and is called out deliberately: a fifth
  discoverable species that breaks the discovery reward is not shippable.
  Shots E and S changed accordingly (the fifth resident on the new lane) and
  `ALL_SPECIES` in `capture-shots.mjs` now seeds five.
- **The twilight life is sparse on purpose, and its far end is painted.**
  `src/world/AbyssFlora.ts` (`SEEDS.abyssFlora`): 24 ghost-kelp blades merged
  into one world-space mesh (pale blue-grey vertex colours, ≥ 3.2 m of
  lateral clearance off the approach axis, held by a test), six clusters of
  dim polyps (`IcosahedronGeometry(0.11, 1)` — at detail 0 they were violet
  hexagon confetti — emissive 0.3 of pale violet, total luminance ~0.1, far
  under the bloom pass's 0.82), 220 luminous motes (additive `Points` wearing
  a soft radial sprite, because a bare point rasterises as a *square*), and
  two silhouette curtains closing the wedge where the carve fades. The
  curtains are `DistantReef`'s trick with two hard-won differences: their ink
  *includes the whole twilight* (`fog × (0.48, 0.30, 0.70)` — a neutral ink
  mixed from the bowl's bright fog rendered the far end as a pale band, and
  the doorway has to be darker than the water around it), and they carry a
  baked vertical gradient in vertex colours (0.68 foot → 1.18 top), because a
  curtain seen from the canyon floor fills the whole upper frame and one flat
  value reads as poster board. Their tops droop and ripple (seeded fbm) so
  the only edge that ever shows is a skyline, and they span ±0.55 rad — far
  wider than the wedge — so their vertical ends stay buried behind the rim's
  flanks from every reachable angle.
- **The biome's in-bowl cost is frustum culling, measured rather than hoped.**
  The first cut had a sentinel mesh toggling the flora on camera distance and
  the arithmetic killed it: pose B stands eighteen metres from the gate mouth,
  nearly on the canyon's axis, so any predicate wide enough for the gate shot
  kept the layer live across half the canonical set. What actually protects
  the bowl: every flora mesh carries a static bounding sphere whose nearest
  reach is past r = 27 (a test holds this), no canonical frustum contains
  them, and the whole biome is ~5.6k triangles when something does.
  `node scripts/probe-abyss-cost.mjs <tag>` (the kelp instrument; toggles
  every wedge node past r = 30, which is the flora, the gate stacks, the den
  dressing, the mound-and-flanks and the moray itself) measured at 1280×720,
  1-minute loads 4.5–7 with another worker live: at the **0.34 floor** pose A
  is **−0.2 ms** paired — zero, the biome is culled — pose I (in-bowl, on the
  gate's doorstep facing it) **+11.1 ms**, pose J (canyon floor) **+9.7 ms**;
  at pinned scale 1, I **+26.2** and J **+23.1** ms, and A read **+8.9**,
  which contradicts what a culled object can cost and is the ledger's
  documented drift wearing a number (the same pose's floor reading and the
  bit-identical capture are the evidence that outranks it). The I/J figure is
  the biome's whole visible world *plus a fifth moray* — GLB head, hull and
  skinned tube are the single biggest slice — on a software rasteriser, in
  the one place the bowl's 38 ms coral garden is behind a ridge; on hardware
  it is nothing, per the standing SwiftShader arithmetic. In-bowl at the
  canonical poses the budget was +3 ms and the honest number is ~0.
- **Captures**: `I-abyss-gate` and `J-canyon-floor` joined the canonical set
  (poses derived from the drawn azimuth; the literals in `capture-shots.mjs`
  say so). Tags: `wm3-abyss` (canonical eleven), `wm3-abyss-final` (I and J
  re-taken after the curtain split below), `wm3-abyss2` (the same-session
  control: A/B/C self-noise measured at ±1.3–3.0 of luma mean, which
  brackets every in-bowl delta against the `wl8-final` archive — −0.5 to
  +3.0 with W-M2's animal styling in the same diff), `wm3-abyss-noassets`
  (the fallback build — primitive moray head, procedural skins,
  frozen-dressing den, nothing broken), iteration rounds `tmp_AB*_m3-r1..r7`
  via `node scripts/probe-abyss.mjs <tag>`, which walks the descent in six
  poses the way `probe-moray.mjs` walks the corridors. What the rounds paid
  for, so nobody pays twice: square points (r1 — a bare `Points` rasterises
  as squares; the motes wear a radial sprite now), curtains lighter than the
  water they stand in (r1–r2), snowman gateposts (r1–r2), a flat poster sky
  from the canyon floor (r4–r6, fixed by the curtain gradient), hexagon
  polyps (r4), and one structural lesson: a curtain arc wide enough to bury
  its ends carries a ~27 m bounding sphere that three's conservative frustum
  test refuses to cull, so each curtain ships as three segments sharing
  exact seam columns — `tests/abyssBiome.test.ts` rebuilds the five
  canonical frusta and asserts no flora sphere intersects any of them.
- **E2e: 20/20 on a genuinely quiet gated run.** Unit suite 262/262
  (typecheck, eslint clean; 17 new abyss cases plus the extended guards).
  The first full run under the ledger's gate came back 14/20 as the other
  Wave 5 workers pushed the 1-minute load to 7–9 mid-suite — six failures
  across the two documented starved-loop families (comfort-panel keyboard,
  audio), every one a 60 s canvas-click timeout over a healthy page
  snapshot. Re-run after the contention drained (gate 1-min < 3, 5-min < 4,
  `--workers=1`, load 3.7–4.5 babysat throughout): **20/20 in 8.9 min**,
  all six former failures among them. One triage lesson worth keeping: the
  discovery-chime spec's duck watcher failed twice under load with the duck
  *provably fired* (`duckFloor` 0.98–0.9995) — the bed sits below the 0.95
  assertion for ~1.5 s per discovery, but the watcher samples on rAF, and
  the ceremony's portrait bake plus a loaded machine can open a
  ~1.8-second frame gap exactly over that window. A near-unity `duckFloor`
  with chime and bubbles green is the starved loop, not a broken duck.
  (Also: `PLAYWRIGHT_BROWSERS_PATH` on this host points into a temp cache
  a reboot wipes — a whole file failing instantly with the "run npx
  playwright install" banner is missing browsers, not code.) Nothing in
  this package touches input, audio or the panel: the fifth moray sits
  44 m from spawn, outside every spec's geometry, and the mood hook is a
  dozen float ops per frame.

## W-M1 — THE SKY'S SLOW MOODS (Wave 5)

- **The reef has weather now, and it is the time-based sibling of W-M3's
  place-based twilight** (`src/rendering/WeatherMoods.ts`). Four authored
  moods: **bright noon** — the shipped look, identity by construction (every
  channel exactly 1, and that row *is* the contract); **golden afternoon** —
  key warmed and up 6%, shafts at 1.3× opacity wearing an amber tint, honey
  in the grade's highlight; **overcast drift** — key at 0.66 (under a ramp
  the key is the contrast control, so this one number is most of the
  flatness), fog *brighter* and greyer (red raised most — milky, the value
  key's own "distance goes milky-bright" turned into weather), shafts at
  0.22 and caustics at 0.35, because there is no focused light under a
  cloud; **plankton haze** — density 1.55×, green up rather than red down
  (the electric-cyan trap, avoided from the green side). All channels are
  *multipliers on base values*, colour tints multiply in linear (so they
  look timid in the table and are not), and no mood takes red down hard.
- **The schedule is a pure function of `SEEDS.weather`.** 150–210 s of noon
  from load — past the 110–150 s convention the visitors and the presence
  cycle set, with margin — then 30–60 s smoothstepped crossfades and
  120–240 s holds, the next mood drawn from the other three so the reef
  keeps returning to noon. Draws are consumed lazily in a fixed order
  (mood, fade length, hold length) off phase boundaries laid end to end
  from the *previous* boundary, never off the clock, so any dt pattern
  yields the same weather at the same minute — `tests/weatherMoods.test.ts`
  drives two instances on different frame deltas and holds them together.
  A single delta is clamped to 1 s, so a tab back from sleep resumes the
  weather instead of popping a whole mood onto the first visible frame.
- **The composition rule with `abyssMood` is one sentence and it is
  load-bearing: the weather scales the base, and the twilight modulates the
  scaled base.** The fog and lighting hooks compute a weather-scaled base
  (colour, density, backdrop level; rig intensities, key colour) and then
  run W-M3's own arithmetic on it — one application of each channel to one
  quantity, no second writer. At identity the weather branch is not entered
  and the expressions are W-M3's to the character; where a ×1 does ride an
  existing product (shaft and caustics opacity), x × 1 is exact in IEEE
  floats, which is the same exactness `Lighting`'s own `base × (1 − s×0)`
  already leans on. The unit tests hold identity with `toBe`, prove the
  composed canyon-floor values against the two systems' published tables,
  and prove attached-at-identity equals an unattached control to the bit
  for the shafts' and caustics' materials. `tests/abyssBiome.test.ts`
  passes untouched.
- **Participation is opt-in (`attachWeather`), and the sanctuary never
  attaches.** The room keeps its own noon — WP-G6's "not a different ocean,
  but not this one's sky" line, held — and since the grade pass is shared
  between the two scenes, `Game` strips the weather's grade tilt when the
  sanctuary opens and reapplies it on the first reef frame back.
- **The channels**: fog colour/density and backdrop level (`UnderwaterFog`),
  the rig's three intensities and the key's colour (`Lighting`), shaft and
  pool opacity and tint (`LightShafts` — the pools' warm white became the
  `POOL_COLOR` constant so tint and restore share one base), caustics
  opacity (`CausticsSystem`), and the grade's highlight tint and saturation
  through `RendererAdapter.setWeatherGrade` — a pass-through beside
  `setGradePulse`, and **the one edit outside this package's strict
  ownership list**, flagged deliberately: `ShaderPass` clones its uniforms,
  so the adapter is the only door to the live grade, and the setter
  multiplies the *shipped* uniform values (snapshotted at construction) so
  it can never compound on itself. Tints and grade values are written only
  while a mood is on and restored once on the way back to identity, so the
  default frame's materials and uniforms are the shipped objects untouched.
  The optional `ReefSoundscape` shift was deliberately not taken: the bed's
  cutoff is already the sanctuary crossfade's channel, an e2e spec asserts
  on it, and a weather you can hear should arrive through a real audio
  channel rather than another rider on the same `AudioParam`.
- **Determinism proof, at two levels.** State: the identity paths are
  asserted verbatim (`toBe`) by the new tests, and the grade uniforms are
  never written before a mood has been on. Pixels: canonical fourteen
  captured twice (`wm1-weather`, `wm1-weather2`, seven minutes apart) and
  diffed against the same-day archive — A −0.5, C −1.4, D −0.4, E −0.2,
  F −0.4, S −0.9 of luma mean against `wm3-abyss`/`wm3-abyss2`, and I/J
  hold `wm3-abyss-final` at **+0.0/−0.0 with every channel percentile at
  zero**. The three poses that moved more are the documented noisy ones,
  bracketed in-session: B read +2.9 against `wm3-abyss2` and the archive's
  *own* two runs differ by −3.0 on that pose (so against `wm3-abyss` it is
  ≈ −0.1); G read +5.4 with a same-session self-noise of −3.3; H read −4.5
  holding a summoned turtle mid-crossing with self-noise +1.2. Every delta
  sits inside its pose's own bracket.
- **What it costs** (`node scripts/probe-weather.mjs <tag>`, the kelp
  instrument with identity/mid-crossfade arms, 1280×720, loads 4–6): paired
  medians **+0.1/+0.3 ms at the 0.34 floor** (A/B poses) and +2.0/+2.7 ms
  at pinned scale 1 — the latter is half a percent of a 400 ms frame under
  contention, drift wearing a number by the standing rule, with the floor
  reading and the archive-zero I/J diffs as the evidence that outranks it.
  `WeatherMoods.update()` microbenches at ~0.4 µs holding and ~0.9 µs
  mid-fade, and at the default mood the per-frame work is one clamp, one
  add and a handful of identity branches — the ≤ +0.3 ms budget is met by
  orders of magnitude. Mid-crossfade the honest extra work is ~20 lerps,
  ~20 material/uniform writes and the weather branch of two hooks.
- **QA doors**: `window.__reef.setMood(name, blend)` pins the sky at
  `blend` of the way from noon into the named mood (1 = in full, 0.5 =
  mid-crossfade; unknown names warn and change nothing; `null` unpins and
  the schedule catches up by drawing the skipped phases in order, so a pin
  can never re-roll the weather after it). `__reef.weatherState` reports
  {mood, into, blend, time, pinned}. `Game.setMood` pushes the grade
  immediately, so a pinned mood needs no live frame before a capture.
- **Captures W/X/Y joined the canonical set** (appended after S, cameras
  reused from A, B and A): `W-golden-afternoon`, `X-overcast-drift`,
  `Y-plankton-haze`, each pinned through the QA door before posing. One
  lesson paid for once: **a haze is a property of distance** — exp² fog
  barely acts inside ten metres, so Y on G's ground-level camera read as
  noon (`tmp_Y-haze_wm1-r1`) and stands on A's open-water camera instead,
  at W's own settle so the two moods compare over an identical world state.
- **Reduced motion needs nothing here, and that is arithmetic, confirmed:**
  the fastest thing in the system is a 30 s crossfade — a fraction of a
  percent of lighting change per frame, far below the caustics drift Calm
  Mode already leaves running at quarter rate — and a crossfade is a
  lighting change, not a motion; nothing flickers at any speed the schedule
  can produce.
- **Tags**: `wm1-weather` (canonical fourteen), `wm1-weather2` (the
  same-session control), iteration rounds `tmp_*_wm1-r1/r2` (the r1 set
  holds the Y-on-G's-camera failure worth not repeating). Unit suite
  **276/276** (14 new weather cases; typecheck and eslint clean). Nothing
  in `src/world`, `src/creatures`, `src/ui` or any existing test moved.
- **E2e: 20/20 in 10.1 min on a gated single-worker run** (1-min 2.6 at
  start, 5-min never above 3.9, babysat throughout) — every spec runs its
  whole life inside the opening noon hold by construction, and none of
  them looks at a pixel, so the weather had nothing to break and broke
  nothing. The two capture-shots runs before it doubled as the harness
  regression check: fourteen shots, no page errors, both sessions.

## W-N3 — MORAY STAGECRAFT (Wave 6)

- **The peek is a pose now, not a placement** (`Moray.ts`). The round critic's
  top finding was the opening frame: the zebra at (13, 1.4, 6) read as "a pale
  banded cylinder hovering horizontally beside a rock, unanchored". The den
  peek arch answers it: a resting head-up tilt (`HEAD_PEEK_LIFT`, 0.32 rad —
  0.38 was tried and read as all chin in the head-on dens) over a per-joint
  pitch profile (`DEN_ARCH_PITCH`) that dives the body's first bend down into
  the den shadow and levels it inside — a question mark instead of a log.
  Worn by *den dwellers only*, behind the same 2.5 s stillness gate as the
  presence cycle, then eased in over 2 s and saturated at exactly 1, so a
  sanctuary resident (root re-posed every frame) never wears it, a codex
  portrait (1 s settle) is bit-identical, and every capture sees one pose.
  Three invariants, all proven in `tests/morayPresence.test.ts`: the head's
  *world position* holds to the bit (the lift is a rotation of the head node
  about its own origin, the arch is joint rotation behind it — sightlines,
  focus cone and `morayHead`'s pin all read what they read before); a driven
  animal carries no arch; the lift yields to the gaze (`× (1 − lookBlend)`),
  so a discovered or approached animal still aims its face at the diver —
  which is why the arch shows in shot A (nothing discovered, diver 22 m out)
  and quietly hands over in C/K1 (attended poses). The arch also relaxes 45%
  while extended-scanning: a body out of its den is swimming, not peeking.
- **The outline thins with distance, in the vertex shader**
  (`MorayOutline.ts`). The critic called the cream hulls at range "most of
  the sticker read": at shot A's 22 m an 18 mm halo line on a near-black
  animal is one to two pixels of maximum-contrast edging. The hull's push now
  attenuates by `smoothstep(OUTLINE_FADE_NEAR=10, OUTLINE_FADE_FAR=20)` of
  the *mesh origin's* camera distance, to `OUTLINE_FADE_FLOOR=0.15` of its
  width — deeply sub-pixel at range, so a far moray is a painted animal.
  Thinning rather than opacity is deliberate: a transparent hull leaves the
  opaque queue and needs sorting; a thinned hull falls inside its surface
  and the depth test retires it. The distance is the origin's, not the
  vertex's, because `begin_vertex` runs before skinning and a bind-space
  position means nothing in the world. Inside 10 m — the focus band's heart,
  every probe-moray pose, every portrait, the sanctuary's 7–11 m lanes —
  the line is full width (poses C/K1 confirmed against `wm2-r2`). The chunk
  stays a module constant (one program), and `tests/morayOutline.test.ts`
  pins the smoothstep, the floor's band and the ramp's start.
- **The zebra's mouth closes most of the way at rest** (`MorayPersonality`
  gapeBias 2.0, attendGape 0.35, curiousGape 0.3). K4's "flat dark
  rectangular cavity… a wooden shoe" was two things stacked: rest carried
  nearly the sculpt's full 11° gape, and K4's own staging (an attending,
  curious diver at arm's length) re-supplied every degree a rest fix would
  remove — so the attention terms came down with the bias. Rest now swings
  ~2–6°, attention peaks ~7.5°, and the mouth never shuts: −11° about the
  hinge is closed and `tests/morayHead.test.ts` pins the floor ≥ ~1.4° of
  daylight, plus the zebra's whole swing sitting under the snowflake's.
  Measured at K4's pose the gaping black wedge is a gentle slit
  (`tmp_K4-zebra-patrol_wm2-r2` vs `_wn3-r2`).
- **The ribbon's flourish is a spiral, and the vertical half carries it**
  (`EXTEND_FLARE` / `EXTEND_FLARE_LIFT` in `Moray.ts`, gated by
  `motion.extendFlare` — the dancer's alone, 0 on every other profile, held
  by a test). K3 read as "a small blue inflatable dinghy" because the pose is
  photographed straight down its own den axis and only ~1.5 m of body ever
  stands outside the den (`MAX_EXTENSION` is a sightline guarantee and takes
  no style) — so a yaw-only sweep foreshortens to nothing, which the first
  two cuts (0.16 then 0.27 rad per joint) proved at the pixel level: r1→r2
  differed by ±1 of luma. What works is turning the body broadside within
  two joints (0.45/0.55 rad) *and* arcing it up and back down, so the loop
  crosses the doorway face in front of the mound instead of marching
  straight back into the rock — verified numerically first with a joint
  world-position dump (the loop lives at x ≥ −13.3 against the mouth plane
  at −13, min tail height 0.79 m off the sand, and the tail's z 7.9–10.7
  sweep sits off every corridor band and inside the coral/kelp clearance
  rings). It runs only at `presence.scan` (extended, engaged), so the
  sanctuary and every driven animal are untouched.
- **The sanctuary's five lanes are properly authored now, and pitch is the
  lever that mattered** (`SANCTUARY_LANES` in `SanctuaryScene.ts`, exported;
  per-lane `rise` replaces the shared `LANE_RISE`). E/S read as "five nearly
  parallel horizontal sticks" because heading can only be staggered inside
  the ±0.35 rad the end-on trap allows — but an eel climbing at seventeen
  degrees and one gliding level are different lines whatever their yaw. The
  stagger rules are stated in the table's comment and read back by
  `tests/sanctuaryScene.test.ts`: heights ≥ 0.45 m apart, turns ≥ 0.1 rad
  apart inside ±0.35, phases ≥ 0.8 rad apart, both travel directions, rises
  0.35–0.65, tops under the jellies' 4.55 m floor and bottoms ≥ 0.4 m off
  the sand. W-M3's fifth lane note (bolted on with `LANES[i % 4]` history)
  is retired by the same table.
- **A jelly bell wears a fresnel rim now, and there is one bell skin in the
  project** (`createJellyBellMaterial()` in `JellyBloom.ts`, consumed by the
  bloom and by `SanctuaryLife` — that one-line import is W-N3's only edit
  outside its ownership list, taken because the alternative was writing the
  material recipe twice). "Flat purple buttons with zero translucency": real
  transmission is a shader this project does not buy, and the cheat is a
  view-fresnel emissive — wherever the shell turns from the view its edge
  lifts toward pale violet, which is where a translucent bell goes bright.
  Added to `totalEmissiveRadiance` before the emissive-map stage (rides
  independent of `emissiveIntensity`), peak channel ~0.5 against the bloom
  pass's 0.82 — a bell may glow and may never be a light source. Module
  constant chunk: reef bloom and sanctuary share one program.
- **What it costs: ~0, by arithmetic** (the ledger's own rule for sub-ms
  claims under contention). Per frame the whole package is ~15 extra adds
  and multiplies per moray joint loop, one vec4 transform + smoothstep per
  outline vertex, and one fresnel per bell fragment — no new draw calls, no
  new geometry, no new textures, nothing on the fixed-step schedule. The
  three workers shared this machine at 1-min loads 3–10 all session, which
  is exactly the regime the W-L4b ledger documents as drift wearing a
  number, so no paired probe was spent on it.
- **Tags**: `wn3-stagecraft` (canonical fifteen), `wn3-stagecraft2` (the
  same-session control), iteration rounds `tmp_*_wn3-r1..r4` (r1 A and K1
  photographed a mid-HMR broken world — three workers editing one tree; a
  void frame with the boot-template HUD is a sibling's save, reload and
  retake), evidence pairs `tmp_K3-ribbon-flourish_wm2-r2` vs `_wn3-r4` and
  `tmp_K4-zebra-patrol_wm2-r2` vs `_wn3-r2`. Self-noise between the two
  canonical runs ≤ 1.1 of luma mean on every pose; against the `wm1-weather`
  archive every pose holds within the documented capture noise except B
  (−6.7) and G (−10.0), which are the kelp/grass-dominated frames W-N2 was
  repainting in the same tree during the same session — not reachable by a
  pose change on animals covering under a percent of either frame. Unit
  suite **298/298** at close (typecheck and eslint clean; 22 new/extended
  cases across the four owned test files plus `morayOutline`). E2e:
  **20/20 in 13.0 min** on a gated single-worker run (gate opened at 1-min
  2.0); an earlier run went 17/20 with the load spiking to 9 mid-suite and
  its isolated rerun reproduced only the two documented starved-loop
  shapes — 60 s timeouts over healthy snapshots and the duck-watcher's
  near-unity `duckFloor` with "Added to the Codex" in the same snapshot.
  One wart flagged, not owned: once a species is discovered `Game` passes
  `curious=true` forever, so `lookBlend` pins at 1 and the completed-save
  reef holds every head permanently on the diver — pre-existing, and it is
  why the peek arch reads fully only on undiscovered animals.

## W-N2 — A KELP FOREST YOU CAN STAND UNDER (Wave 6)

- **The forest is leaf now, not armature.** The round critic's verdict on
  W-L9's kelp was verbatim "a charcoal wire armature with perhaps a dozen flat
  leaf straps... no canopy overhead", and the meadow's close blades "flat
  plastic straps with hard facet edges". Both halves live where they always
  did — `src/world/Kelp.ts` and `src/world/SeaGrass.ts` — and both were fixed
  by geometry, not by texture: the two painted strips are untouched and the
  no-assets build takes every change for free (checked, `tmp_*_wn2-noassets`).
- **The kelp: three times the straps, half again the width, and a crown on
  every stalk.** Base foliage went 5–7 → 14–19 straps per regular stalk and
  10–13 → 28–38 per giant, at width ratio 0.32–0.46 (from 0.26–0.36) and
  lengths to 2.3 m. Every stalk now finishes in a **crown cluster** — 4–6
  trailing ribbons on regulars, 12–16 on giants — and each giant additionally
  spreads 5–7 broad near-horizontal **canopy pads** at the very top: that ring
  is the ceiling an upward camera sees, and the thing between the lens and
  open water that the critic said did not exist. Totals: 45,364 triangles in
  the same two draw calls (W-L9 shipped ~16.8k).
- **Leaf droop is an integrated arc now, with a rise.** The old parabola slid
  a tip down while keeping full horizontal reach; `arcAlong` integrates the
  bend the way the meadow's bow does, and a new `rise` term tilts the root end
  *up* before the droop takes over. The rise is the package's one structural
  lesson, paid for in three iteration rounds (`tmp_Z2-grove-side_wn2-r1..r4`):
  straps that grow out sideways under a top-heavy crown read as a **palm
  tree**, whatever their count — a kelp blade sweeps up with its stalk and
  curls over. The giants' base-strap top bias also eased 0.5 → 0.62, because
  with the crown carrying the top on its own, a hard bias left nine metres of
  bare stipe under a ball. Rising also *shrinks* the horizontal envelope the
  lane tests police, so the sweep costs no clearance.
- **Every crown draw comes from `SEEDS.kelpCanopy`** (pre-registered for this
  package), never from the placement or leaf streams — W-L9's split, one layer
  over. The placement contract was proven, not assumed: with the clump table
  held at W-L9's literals, the new code reproduces the old stalk buffer's
  running hash **bit for bit** (5453 vertices, hash 408621269), so the only
  positional changes shipped are authored ones. Those are: the **NW grove**
  — three giant clumps appended around (-17, 15) so the stand at (-16, 14) is
  a place a diver can stand under the canopy — and the near stand stepping
  (-5.45 → -5.9, radius 0.6 → 0.55): its re-diced longer fronds grazed the
  snowflake fan by 0.26 m, the same test catching the same graze it caught in
  W-L3 and W-L9. `tests/kelp.test.ts` now freezes the new stalk buffer the way
  the seabed test freezes the crevice table (5768 vertices, hash 4264248344,
  first-stalk literals) and holds canopy floors: >2000 leaf vertices above 6 m
  forest-wide, >400 inside the grove, >25k leaf triangles.
- **The meadow blade is a leaf, not a strap**: 0.182 → 0.26 wide (broad
  variant down 1.5 → 1.25 so its absolute width stays under the 0.34 m the
  W-L9 note documents as a scale error), a lanceolate outline (widest a
  quarter up, soft point), a cross-section **cup** riding a centre column the
  blade did not use to have (PlaneGeometry 1×4 → 2×4, 10 → 15 vertices and
  8 → 16 triangles per instance — the meadow is the reef's largest vertex bill
  and this is +50% of it, taken knowingly), and a 0.55 rad root-to-tip twist
  so no blade is ever edge-on down its whole length. A flat card catches the
  toon ramp in one value across its width; the cup rolls the band across it,
  which is what "painted leaf" turns out to mean in this renderer. Geometry
  only: the meadow's layout, palette and streams are bit-identical
  (`tests/seaGrass.test.ts` is new and holds determinism, the cup, the twist
  and the clearances; note a `Vector2` clearance carries z in `.y`).
- **`Z-kelp-canopy` joined the canonical set** (appended after Y): standing in
  the NW grove at (-18.2, 1.8, 14.8), yaw -1.45, pitch **+0.78** — the first
  canonical camera that ever looked up, aimed east so the crowns hang between
  the lens and the sun at (17, 24, 13) and the W-L9 leaf-glow term finally has
  leaf area to work with. The critic's before is
  `20260727-2105_CR3-kelp-canopy-up_critic-verdict.png`; the after is
  `20260727-2214_seed1_hi_Z-kelp-canopy_wn2-kelp.png` — dense backlit ribbons
  with dappled water between them, where the before had two whips and sky.
  `scripts/probe-kelp-canopy.mjs` is the package's iteration instrument: Z
  plus a grove side view, canonical G, and a high overhead for the critic's
  "thin sticks on a sand platter" read (all four now pass a "would a painter
  call it a plant" look). Two traps it carries the answer to: its first
  overhead pose parked the reticle on the snowflake and the discovery plate
  covered the frame being judged — aim a high camera *off* the crevices — and
  it retries each pose once, because with three workers editing one tree,
  Vite full-reloads land mid-capture as "execution context destroyed".
- **Frame deltas against the `wm1-weather` archive** (frame-stats, luma mean):
  A −0.9, F −0.6 (inside the documented capture noise), B −3.0 (the mid-frame
  kelp stands carry real mass now), G **−11.2, deliberate** — the meadow
  covers bright sand with leaf, which is the package's entire purpose in that
  pose. Sibling changes (W-N1's canyon, W-N3's stagecraft — a moray head out
  of its den in A/F) ride the same diff, per this round's shared-tree reality.
- **What it costs, honestly: the machine never gave a clean number, and the
  arithmetic is the story.** Net new geometry is ≈ +28.6k kelp triangles and
  ≈ +8.8k meadow triangles (plus +50% meadow vertices), which at SwiftShader's
  ≈0.5 ms/k is ≈ **+19 ms** at any render scale (vertex-bound, so the floor
  does not shrink it). Three paired-probe sessions were spent trying to do
  better (`wn2-kelp`, `wn2-quiet`, `wn2-final` tags) at 1-min loads 2.8–19.7
  with both sibling workers on the machine; in every one at least one
  *untouched* control layer (seaweed, documented ≤4 ms; distant-reef, ≤4)
  measured 10–52 ms or negative double digits, which is the ledger's drift
  tell at a scale that swamps the signal, and both `measure-frames` runs
  reported "settled scale 1.00" over six ~1s frames — a sampling window too
  starved for the scaler to step. The least-poisoned row of the final session
  (pose G at the 0.34 floor, its seaweed control reading 3.7 ≈ truth): kelp
  gross **25.9 ms** against W-L9's documented 7.3–9.0, sea-grass gross
  **22.5 ms** against 13–17.4 — i.e. net ≈ +17 and ≈ +5–9, bracketing the
  arithmetic. The settled adaptive scale on this QA host was already the 0.34
  floor in every pose before this package (Round L ledger) and a vertex-bound
  addition cannot move a floor that fill-bound work set; pose Z renders at
  the same floor. The tiering lever the brief named (full crowns near,
  simpler far) exists in the data — crown and pad counts per clump — and was
  **not pulled**: on hardware that runs a vertex shader where it belongs, 45k
  triangles in two draw calls is nothing.
- **Gates at close**: typecheck and eslint clean, unit suite **298/298**
  (the two in-flight sibling breakages seen mid-session — W-N1's
  `canyonPaint` lint literal and W-N3's `morayPersonality` broadside case —
  were both fixed by their owners before this package closed). E2e: the
  gated full run opened at load 2.76 and the machine climbed back to 12.8
  mid-suite — **15/20 in 17.2 min**, all five failures the two documented
  starved-loop families (comfort-panel keyboard, audio). The gated isolated
  re-run of those two files (gate opened at 2.38, load rose to 9.6 mid-run):
  12/14, accessibility all green, two audio specs left — one of them the
  documented duck-watcher flake to the letter (duckFloor 0.957 against the
  0.95 assertion with the discovery *provably completed* in the page
  snapshot). A third run of the audio file alone on the strict gate
  (1-min 1.94, 5-min 2.91): **8/8 in 3.7 min**, both former failures passing
  with margin (45.8 s and 26.9 s of their 60). Union across the gated runs:
  every spec in the suite passed; every failure reproduced as a load
  artifact and cleared on a quieter minute — the ledger's standing verdict
  for this host, observed three more times. Nothing this package touches
  (geometry in two plant modules, one appended capture pose) is driven by
  any spec.

## W-N1 — CANYON IN PAINT (Wave 6)

- **The canyon has a light story, strata, plants and a skyline now.** The
  round critic named the second biome the largest gap to the "near Studio
  Ghibli" bar — J-canyon-floor's "flat indigo field with no gradient, no
  light direction, no particles worth the name", walls "a single flat
  mauve-brown value", ghost kelp that "reads as whiskers", and I-abyss-gate's
  doorway "meeting the sand in a dead-straight horizontal line". Every fix
  lives inside the canyon wedge; the bowl is bit-identical by the same
  early-return construction W-M3 built, and the mood hooks in
  `UnderwaterFog`/`Lighting` were not touched at all — W-M1's composition
  rule holds because this package never went near either writer.
- **The reroll fence, stated once**: everything W-M3 placed still draws from
  `SEEDS.abyssFlora`/`abyss`/`abyssDen` in exactly the order and count it
  always did, and everything new draws from `SEEDS.canyonPaint` streams.
  `tests/canyonPaint.test.ts` pins the first/last original motes, two polyp
  matrices and the first ghost-kelp root to literals read off the shipped
  W-M3 build — a retune that shifts a draw ahead of an existing element
  fails loudly.
- **The wall strata are baked into the seabed's vertex colours**
  (`canyonStrata`/`bakeCanyonStrata` in `Abyss.ts`): three violet-leaning
  elevation bands below the sand shoulder (tints down to 0.54/0.48/0.88 —
  red held above green per the value key, nothing near black), edges
  wandered by one seeded fbm field so no boundary is a ruled line, blended
  over 1.3 m so the 0.94 m grid cannot alias them. The whole deviation is
  scaled by `canyonBlend`, so at the wedge edges and everywhere in the bowl
  the multiplier is identity — and the bake *skips* every vertex where the
  carve is exactly zero, so the bowl's bytes are untouched by construction
  (a real-sheet before/after test holds it). Bands key on *carved* height
  read off the displaced geometry, not recomputed, so they land on the walls
  the mesh actually has. The one edit outside the strict ownership list is
  one line in `Reef.buildSeabed` calling the bake after `bakeSeabedOcclusion`
  — flagged deliberately; the sanctuary's own bake path is untouched.
- **The light story is `AbyssFlora`'s, deliberately not `LightShafts`'.** A
  wide "moon column" stands behind the den (so the dark head silhouettes
  against it on the approach — the Ghibli rim-light thesis pointed at the
  discovery moment) plus two lesser shafts on the shelf, all cool
  (0.72/0.82/1.0 baked into a `DataTexture`, so the canyon still constructs
  in plain Node), all static — nothing in the canyon animates, so reduced
  motion has nothing to reduce. Reusing the reef's shaft class would have
  meant warm-tinted maps and W-M1's weather writing `color` on beams it must
  restore to white; a self-contained additive quad set has no second writer
  to fight. The three disciplines carried over: `fog: false`, a ground fade
  baked against `seabedHeight` in vertex colours, and the edge-on fade — per
  frame in each blade's `onBeforeRender`, since nothing owns an update call
  into the module. A small cool pool lands under the moon column, because a
  beam that brightens nothing it points at is a decal (the bowl's own rule).
  Opacities top out at 0.17; nothing here can reach the bloom's 0.82.
- **The water-column gradient is one more arc behind the curtains**
  (`VEIL_ROWS`): rgb rows are multipliers on the live fog colour
  (`DistantReef`'s trick, so it follows every repaint, mood and weather for
  free) running deep violet at the foot to faintly milky at 15.5 m — and the
  *alpha* fades to zero at the top, so the panel dissolves into whatever sky
  the frame has instead of ending on an edge. RGBA vertex colours (a
  4-component color attribute) are exactly what that needs; `depthWrite`
  off, three segments for honest culling spheres, foot at −2 rather than the
  curtains' −13 because the ground at r = 51.5 is back at dune level and
  everything lower is behind the ridge from every reachable angle.
- **The curtains carry the gradient in six rows now, and its span is the
  lesson.** Two-row curtains made any gradient one linear ramp over sixteen
  metres; steepening it around the skyline read well from I and left the
  slice a *close* camera sees (the foot band, y −5..−2 from the den's
  doorstep) a flat plateau — which was AB5's whole "flat indigo field".
  `curtainShade` spans −10..+4 so every viewing range gets a grade, and the
  near curtain's ripple went 0.7 → 1.15 so the doorway's top edge is a
  skyline, not one more straight line.
- **The ghost kelp has leaves, and the stalk skeletons are frozen.** Each
  W-M3 plant keeps its exact eight `SEEDS.abyssFlora` draws; a crown of 6–8
  drooping leaf straps per plant comes off `SEEDS.canyonPaint` — ribbons
  narrow at the attachment, widest mid-strap, tapering to a point, arcing up
  then sagging below their root (the kelp forest's own crown-strap
  silhouette, rebuilt rather than imported: `Kelp.ts` is W-N2's this wave).
  A faint emissive floor (0.14 of pale blue) is what makes them *ghost*
  kelp — the mood takes most of the rig away down here and an unlit toon
  surface rendered the pale palette as near-black quills, which was the
  critic's exact complaint. The corridor fence is arithmetic, not luck: a
  strap whose root sits under 2.85 m of lateral clearance from the canyon
  axis is skipped (draws still consumed), and one that would swing inside
  3.0 m grows outward instead; the standing >2.6 m vertex guard passes.
- **The sparkle tripled along the approach**: +12 polyp clusters
  (42 → 126 instances) hugging the descent band and +440 motes (220 → 660,
  size 0.06 → 0.07, opacity 0.5 → 0.55), all on `canyonPaint` streams, new
  motes held ≥ 0.9 m off the corridor's axis so nothing twinkles over the
  dark head the descent asks the player to find.
- **The sill stones are why I's horizon finally breaks, and the measurement
  is the memo.** From shot I the visual horizon is the raised sill at
  r ≈ 30.2 (ground +1.7, ray slope −0.035): a stone at r = 33 needs 2.7 m of
  height to notch the line, on the crest half a metre does it. Two scattered
  cuts (r 31–36) vanished below the horizon they were placed to break before
  the ray-march said where the crest actually is. Nine dodecahedron stones
  (`buildSillStones`, called from the gate block, `SEEDS.canyonPaint`) sit
  at r 30.1–31.6, ≥ 1.7 m off the descent axis, strata-band colour
  (0xa195ac) so they silhouette against the deep band instead of matching
  the sand into one flat edge. Scenery by construction, like `dressDens`:
  in neither `obstructionMeshes` nor `colliders`, so every sightline and
  collider contract evaluates exactly what it did. The instanced mesh is
  parented at the sill's centre (the cost probe's wedge collector finds it)
  and carries an instance-aware bounding sphere — the geometry's own 0.34 m
  sphere at the node would cull them wrongly.
- **Invariant proofs**: unit suite green including all 17 W-M3 abyss cases,
  the seabedRelief FROZEN table, reefSightlines' canyon cases and
  weatherMoods verbatim-identity cases; 10 new canyonPaint cases pin the
  strata's null-outside-the-carve, the bowl-sheet byte-identity, the violet
  ordering of the bands, the reroll literals, the glow discipline
  (opacity ≤ 0.32, fog off) and the veil's dissolving top. The
  frustum-culling guard in `abyssBiome.test.ts` now covers the veil, columns
  and pool automatically — all world-space geometry with honest spheres,
  after the first cut hung the pool's local sphere at the origin and the
  guard caught it.
- **Pixels**: `wn1-canyon` (canonical fifteen — Z-kelp-canopy joined the set
  mid-wave, W-N2's) against the `wm1-weather` archive, bracketed by a
  same-session `wn1-canyon2` control: A −1.5, C −1.9, D −0.9, E +1.2,
  F −0.6, S −1.0, W −1.0, X −2.5, Y −0.2 of luma mean, self-noise ±1.3 —
  and B −5.6 / G −5.2 / H −3.3 carry W-N2's kelp-and-meadow rebuild and
  W-N3's den poses in the same diff, per this round's shared-tree reality
  (their sections say the same from the other side). I and J are this
  package's deliverable and *meant* to move: I holds its luma mean to −0.6
  while the composition inside it changes (the graded band lifts the deep
  red p10 +10), J moves +0.4 mean / +5.2 blue. The `wn1-canyon2` control's
  E frame caught a sibling's mid-HMR world ("hidden moray 0/1", empty
  scene) — the documented shared-tree hazard, not a regression; run 1's E
  matches the archive. Iteration rounds `tmp_AB*_wn1-r1..r4` hold the two
  lessons worth not repeating (stones below the measured horizon, the
  close-slice-flat curtain gradient). `wn1-canyon-noassets` is the fallback
  build: every mark this package adds is procedural (`DataTexture`s and
  vertex colours), so the no-assets canyon carries the whole light story.
- **What it costs, honestly.** Under wave contention (loads 10–17, both
  siblings capturing) the cost probe printed drift wearing numbers — pose A
  "paired +45 ms at scale 1" while its with-biome frame measured *faster*
  than without, which is the ledger's tell at full amplitude; those runs
  (`wn1-floor`/`wn1-scale1`) are recorded only as the warning. The gated
  re-run (`wn1-floor-quiet`/`wn1-scale1-quiet`, gate opened at 2.41/3.79,
  1-min back to 7.8 by its end as the wave resumed): **in-bowl pose A pairs
  at −3.2 ms at the floor and −17.4 at scale 1** — zero, the biome is
  culled, and the frustum guard test is the structural proof — and
  in-canyon the *whole biome* pairs **I +19.2 / J +17.0 ms at the 0.34
  floor** (+52.8/+57.2 at scale 1) against W-M3's +11.1/+9.7 (+26.2/+23.1).
  This package's net is therefore ≈ **+7–8 ms in-canyon at the floor
  against a +3 ms budget — over, and documented rather than chased** on the
  standing grounds: it is ~12k triangles of straps/polyps/stones plus four
  transparent arcs and seven additive quads that exist only past the gate
  (where the bowl's 38 ms coral garden is behind a ridge), the growth at
  scale 1 says the new cost is fill/overdraw and shrinks with the scaler's
  square, and every lever left — fewer motes, fewer polyps, a dropped shelf
  shaft — visibly costs exactly what the round critic asked this package to
  add. Nothing on real hardware, per the standing SwiftShader arithmetic.
- **Gates**: typecheck and eslint clean; unit suite green at this package's
  close (298 tests — 276 plus this package's 10 canyonPaint cases and the
  siblings' in-flight additions; the eslint `no-loss-of-precision` W-N2
  flagged was a 17-digit pin literal, trimmed the same hour). E2e on the
  gated single-worker recipe, twice: **18/20 both times** (13.7 and
  14.9 min; gates opened at 1-min 2.4 and the wave's captures resumed
  mid-suite both times, 1-min back to 6–12 before the audio specs run at
  the suite's tail). Every failure is `audio.spec.ts` — the ledger's
  documented starved-loop family — and the set churns between runs (107
  failed once and passed twice; 196 is the duck-watcher flake with its own
  standing triage note). The volume-slider spec (130), the only one to fail
  twice, **passes isolated on a quiet gate at 49.7 s of its budget**, which
  is the recipe's own verdict: machine, not code. Nothing in this package
  touches input, audio, markup or focus geometry, and the audio specs pose
  in the bowl, where this package's every mark is frustum-culled (measured
  −3.2 ms). Worth knowing for the next wave: this host never stayed under
  the gate for a full suite while three workers shared it — W-N2's honest
  +19 ms of vertex work also moved every rAF-sampled watcher closer to the
  starved edge, so expect this family to flake until the wave drains.
- **Files touched**: `Abyss.ts`, `AbyssFlora.ts` (both owned), `Reef.ts`
  (the gate block plus the one flagged `buildSeabed` line), and
  `tests/canyonPaint.test.ts`. `LightShafts.ts`, `DistantReef.ts`,
  `UnderwaterFog.ts` and `Lighting.ts` were in the ownership grant and
  deliberately not edited — the canyon's light needed none of them, and the
  fewer writers near the weather hooks the better.

## W-N4 — WEATHER THAT BEHAVES (Wave 6b)

- **The moods are visible now, and each one changes what the light marks are
  doing rather than only what they are multiplied by.** The round critic
  measured W-M1's tables at +3.5 parts of red for a whole golden afternoon —
  "W is nearly indistinguishable from A" — and the diagnosis stands as a rule:
  amplitudes tuned to sit inside the capture noise are amplitudes the player
  cannot see either. Every table in `WeatherMoods.ts` roughly doubled, and
  each mood gained a behavioural channel:
  - **overcast-drift hides the shafts, pools and dapples entirely** —
    `shaftOpacity: 0`, `caustics: 0`, not 0.22×/0.35×: there is no focused
    light under a cloud, and a fifth of a beam was still a beam. The
    consumers hide the materials outright at a gain of *exactly* zero
    (`material.visible`), so a full overcast also stops paying their
    overdraw; the crossfade fades opacity all the way down before the flip
    can happen, so nothing pops, and a unit case pins mid-crossfade as
    visible-with-opacity. The key drops to 0.44 (under a ramp the key is the
    contrast control — that one number is most of the flatness).
  - **golden-afternoon re-tints the marks amber** — and the caustic dapples
    now wear the mood's *shaft* tint (`CausticsSystem` reads
    `shaftRed/Green/Blue` since this package): a dapple is where a beam
    lands, so beam, pool and dapple are one light wearing one colour, and a
    golden hour cannot pour amber beams onto neutral dapples. Shafts at
    1.65×, dapples at 1.4×, blue down to 0.6 on the tint, honey in the fog
    and the grade.
  - **plankton-haze closes the distance** — density 2.2× swallows the
    mid-field into green-milk silhouette. The distant reef rings and the
    canyon curtains re-mix their inks from `scene.fog` on their own
    (`followFog`, W-L9/W-N1), so the whole painted distance follows with no
    second writer and no edit to `DistantReef`.
- **Measured the way the critic measured** (frame mean vs the same set's own
  noon camera, canonical frames): golden was red +3.7 / blue −7.7 and is red
  +4.5 / blue **−18.7** with the amber arriving at the highlights (red p90
  +16, p99 +19 — the marks, not a veil); haze was red −9.5 and is red
  **−23.2**, green +3.7, with luma p90 −10.7 (the distance going into the
  soup); overcast was luma −19.7 and is luma **−26.9**, red −37.8, with the
  light marks at hard zero. The guardrails held and are now *tests*: no mood
  takes `fogRed` below 0.9 (the shipped fog carries 83 parts of red; the tone
  curve's crush lives below ~28 — Y's darkest red decile measures 49),
  nothing approaches black (X's luma p10 is 93), and warmth arrives red-up.
- **`lerpChannels` was never exact at t = 1, and the old tables passed by
  luck.** `from + (to − from) × 1` is not `to` in floats — 1 + (0.44 − 1) is
  0.43999999999999995 — so a pinned mood handed back a table one ulp off and
  the composition tests' `toBe` caught it the moment a new value was unlucky.
  The endpoints are branches now (`copyChannels` at t ≤ 0 and t ≥ 1), which
  is what the function's own comment always claimed.
- **The vertical seam in open water was the backdrop's wrap join, and it was
  two defects stacked.** The hard line upper-right in A, F, W and Y (x ≈ 1087
  of 1600; the critic's ~x = 690 is the same column in a 1024-wide view) was
  diagnosed before it was touched: it is a colour *step* — red falls across
  it while green and blue rise, which no additive shaft can produce — and it
  stands at exactly the azimuth where the equirect u = 0/1 join lands once
  the panorama is turned to put its painted sun over the world's (−1.9912
  rad; project that through A's yaw-0 fov-70 camera and the answer is
  x = 1087, which is where the step measured). Measured off the file,
  `backdrop.png` simply does not wrap: its left and right edge columns
  disagree by **36 parts of red at the zenith** and six to ten parts of green
  and blue down the whole water column, against interior column steps under
  one part. Both halves of the fix live in `liftRed`'s memoised copy — the
  one place the panorama's pixels already pass through on the CPU:
  - **`sealWrap`** cross-fades the join closed: each row's low-frequency edge
    mismatch (4-column edge means, smoothed over 15 rows so grain cannot
    streak) is split between the two sides and faded out 48 columns in, so
    the edges meet at their mutual average and the join becomes a gradient
    over 8° of azimuth. The fog/backdrop agreement is untouched by
    construction — the two ramps shift the horizon strip by half a mismatch
    each in opposite directions, so its average cancels exactly.
  - **Mipmaps off on the lifted copy** (`generateMipmaps: false`,
    `LinearFilter`): the u derivative at the join spans the whole texture
    width, the rasteriser answers with the smallest mip, and that one screen
    column renders the panorama's global average — a residual line the pixel
    seal cannot reach (measured: a two-part red step that survived the seal
    and died with the mips). The panorama is magnified everywhere a camera
    can look (2048 columns over 360° is ~2.7 screen px per texel at fov 70),
    so the mips bought nothing.
  - **Localisation proof**: canonical A holds the `wave6a-merged` archive to
    −0.1 of luma mean with every channel mean at ±0.1, and the join window's
    green/blue step is gone; what remains at one column is a −1.1-part red
    brush gradient that the archive frame carries identically (it also
    carries twins at x = 1052 and 1104 — it is the painting, not the join).
- **The identity contract survives, bracketed the standard way.** Canonical
  fifteen (16 poses) under `wn4-weather`, control `wn4-weather2` eleven
  minutes later: noon poses hold the archive at A −0.1, B −0.1, C −0.2,
  D −0.1, E −0.5, F −0.6, G −0.1, I +0.4, **J +0.0**, Z +0.9 of luma mean;
  H reads +3.2 with the control's own +4.2 (the summoned turtle, the
  documented noisy pose) and S +1.0 against +1.6. The first run's D and E
  photographed a sibling's mid-HMR world (`buildCorridorDressing is not a
  function` — W-N5 editing the shared tree; the shot log says so) and were
  retaken at 0155 and deleted, on the "a void frame with a boot-template HUD
  is a sibling's save" rule from W-N3.
- **Reduced motion needs nothing new**: the behavioural channels ride the
  same 30–60 s crossfades as every other channel — a mood arriving is still
  a lighting change, not a motion — and the only discrete act in the system
  (the visibility flip) happens strictly at zero opacity.
- **What it costs** (`probe-weather.mjs`, loads 2.5–6.4): paired
  mid-crossfade **+0.6/+2.3 ms at scale 1**, +1.6/+0.6 ms at the 0.34 floor —
  inside W-M1's own published envelope — and `WeatherMoods.update()` at
  351 ns holding / 800 ns mid-fade. Identity cost is ~0 by construction (the
  identity arm *is* the default path). A full overcast is now the cheapest
  sky in the game: six beams, eight pools and two caustics sheets leave the
  render list entirely.
- **Tags**: `wn4-weather` (canonical sixteen; D/E retaken same-session),
  `wn4-weather2` (the control), iteration set `tmp_wn4/*_r1` (deleted with
  the scratch scripts; the canonical set holds the same tables). Gates at
  close: typecheck and eslint clean, unit suite **316/316** (the 4 new
  behavioural cases and the guardrail case included; mid-package the suite
  showed 5 `corridorDressing` failures from W-N5's in-flight exports, gone
  once their append landed), **e2e 20/20 in 9.4 min** on a gated
  single-worker run (gate opened at 1-min 1.78; the volume-slider spec
  passed at 47.9 s of its doubled budget). One flag not owned: W-N5's
  `tests/__wn5_scratch_where.test.ts` carries a `no-console` warning that
  fails `--max-warnings 0` — their scratch guard, the W-N2
  `__wn2_stalk_snapshot` pattern again.
- **Files touched**: `WeatherMoods.ts`, `LightShafts.ts`,
  `CausticsSystem.ts`, `UnderwaterFog.ts`, `tests/weatherMoods.test.ts`.
  `Lighting.ts`, `ColorGradeShader.ts`, `RendererAdapter.ts`,
  `DistantReef.ts` and `probe-weather.mjs` were in the grant and needed
  nothing — the amplitudes live in the tables, the haze reaches the distance
  through `scene.fog`, and the fewer writers the better.

## W-N5 — BOWL DRESSING TOUCH-UPS (Wave 6b)

- **The tube sponge is a sponge now, not cooperage.** The round critic's
  CR5-dish-object capture read the old tube as "a wooden barrel or picnic
  basket", and every part of that read had an author: a 0.11 → 0.31 flare
  (bought in W-L2 to separate the silhouette from the branching fingers), a
  vertex ramp that reached full cream *exactly at the rim* (the hoop), and a
  14-stave groove map at half the tone's whole swing (the staves). The W-N5
  profile is long and narrow — three heights to a mouth-width, walls near
  parallel, a soft trumpet only in the last sixth — because the silhouette
  separation the flare bought is carried by the *cluster* instead:
  `CoralField.addMid` already plants three to five barrels per holdfast at
  staggered heights, and narrow tubes make that read as a cluster of tubes
  rather than one lumpy urn. Topology is unchanged (11 profile points, 9
  segments, 180 tris/instance), so the fix is cost-zero, and no placement
  stream is touched — `coralGarden`'s determinism case is byte-for-byte.
  - **The paint is keyed off the lathe's own profile index** (`paintTube`):
    a lathe writes `uv.y = j / (points − 1)`, so inside and outside are
    exact rather than guessed from normals. The exterior's ceiling came
    down (perceived 0.9 at the lip, from 1.0 — no pale hoop on a dark
    vessel), and the throat leans hard into red and deepens as it goes
    down, so the mouth reads as living tissue over a dim interior. It
    multiplies the instance hue — a rose sponge glows rose-warm, a violet
    one plum — and stays under the models' 1.0 vertex-colour ceiling.
  - **The map's staves became felt**: finer channels (18 at 0.2 of the
    swing), grain carrying most of the surface, small pale ostia rims from
    a voronoi `f1` term where the flute shadows were. The old map's
    vertical shading term is gone with them — the foot-to-lip story lives
    in the vertex colours now, and a map's `v` runs down the *throat* too,
    where "deepest at the foot" was quietly brightening the mouth's floor.
  - Judged at `probe-coral.mjs`'s standing views (`tmp_coral-cluster-*_wn5-r1`):
    the ochre and maroon clusters read as organ-pipe sponge stands, no rim,
    no barrel. Shot G's mid-left "wrapped parcel" (an old squat tube seen
    from above) is gone from the same pose.
- **The critic's B/H "white-rimmed maroon dish" is not the sponge — it is
  the zebra moray**, proven, not argued: hiding the garden's buckets, the
  seaweed and every ground-fauna group one at a time left it standing, and
  hiding scene node 23 — the moray root at (13, 1.4, 6) — removed it
  (`scripts/probe-dish.mjs`, evidence `tmp_dish-node23_wn5-sweep.png`
  against `tmp_dish-node20` with the whole reef hidden and the dish still
  floating on open water). What the critic saw is the zebra's own body
  cropped by B/H's right frame edge: dark banded skin, the cream halo
  outline as the "white rim", the dorsal fin as the strap on top — a
  moray with its head out of frame. **Flagged, not owned**: this package
  may not touch `src/creatures/`, and the fix (if wanted) is staging, not
  coral — either the body's presence pose at B's settle or a composition
  call for whoever owns the morays next. The probe stays in `scripts/` as
  the instrument for any "what object is that pixel" question; its first
  three sweeps chasing plateStacks, tubes, seaweed, crabs, starfish,
  urchins and the wrasse are why nobody should dead-reckon a camera
  convention when a toggle can answer.
- **The spawn corridor's first ten metres are framed now**
  (`src/world/CorridorDressing.ts`, `SEEDS.corridorDressing`). The critic:
  A/F's centre "reads as emptiness rather than as a path" — the channel is
  deliberate, its *edges* were bare from z ≈ 12 to 21. Two authored beds
  now line it: small coral heads (boulder + polyps), sponge tube pairs,
  seaweed cushions and frond rosettes at undergrowth size (the bush and
  rosette geometry exported from `Seaweed.ts`, built with this module's
  own `Random` so the field's stream is untouched), plus two low grass
  tufts appended to `FOREGROUND_CLUMPS` per that list's own append-only
  note. Families follow the gardens each bed leads to — rose out of the
  shot-A mass, rose-and-ochre toward the tidepool.
  - **The lane stays a lane.** Every piece answers `CoralField.isClear`
    (imported, never copied) *and* the beds are authored a margin outside
    the corridor box, so the seeded jitter cannot walk a piece over the
    line; nothing joins `obstructionMeshes` or `colliders`, and
    `tests/corridorDressing.test.ts` reads all of it back (channel margin,
    z range, isClear, contact patches, determinism, five draws, no
    shadows, dispose). `reefSightlines` passes untouched.
  - **The sill stones' bounding-sphere trap, paid for again**: an
    `InstancedMesh` culled by its geometry's own metre sphere at the node
    origin vanishes whenever the world origin leaves the frustum, so
    `computeBoundingSphere()` runs once at build and the test asserts the
    sphere's centre is off-origin.
  - **What it costs, honestly** (`node scripts/probe-corridor.mjs`, the
    kelp instrument pointed at the one group, loads 2–3): 24 instances,
    2.25k triangles, 5 draws, plus ~770 grass triangles riding the
    meadow's existing draw. Paired medians **A +1.6 ms at the 0.34 floor**
    (+2.5 at scale 1), G +0.1 — against a **+0.5 ms allotment, over by
    about a millisecond, documented rather than chased**: the framing is
    the deliverable, the layer is vertex-bound (nothing on hardware, per
    the standing SwiftShader arithmetic), and the next cut visibly empties
    the very edges the critic called empty.
- **The brain and plate got their procedural retunes**, judged a modest
  win rather than a cure. The brain's map (its own recipe now, split from
  the staghorn's) adds a broad warm/cool mottle at the meander's own scale
  — period-3 fbm moving tone ±0.06 and tilting hue with it, the map being
  the one procedural surface that reaches the *live* brain (its geometry
  and furrow occlusion are the GLB's) — and `coralSkin` grew an optional
  per-channel `tint` to carry it. The plate's top face wears a radial
  growth gradient (centre 16% deeper and warm-shifted, margin at full —
  the tip-gradient rule, radially), and the map's old rim darkening came
  down 0.26 → 0.16 so the margin the vertices lighten is not cancelled by
  the texels. **If the round critic still calls them flat close up, the
  next step is the painted albedo, and the spec is**: one 512×512 sRGB
  colour strip per species, near-neutral around a 0.9 mean like every
  coral map (the instance colour owns the hue — a painting that brings its
  own terracotta takes the garden to mud, `levelToBlade`'s rule), the
  brain's painted as meandering valley shadow + ridge light tiling on
  integer periods (its UVs are `project_uvs`' spherical, ~1 tile per 15 cm),
  the plate's painted in polar rings-and-radial-branchlets about (0.5, 0.5)
  matching `skinRecipe`'s layout note, no alpha, no normal channel.
- **A discovered moray lets go of the diver now** (`src/app/MorayCuriosity.ts`
  + the `Game.simulate` wiring), closing the wart W-N3 flagged: `Game`
  passed `curious = discovered` forever, so `lookBlend` pinned at 1 and a
  completed save held every head permanently on the diver — the peek arch
  never showed again on any animal the player had met. Curiosity is a
  per-moray latch now: it engages when the diver genuinely attends —
  focus-scanner lock (one fixed step stale, since the scanner needs this
  step's head positions) or presence inside 8 m — and relaxes only after
  **18 s of sustained inattention**, far away *and* looking elsewhere the
  whole while, the timer resetting on any attended frame.
  - **The fences**: pre-discovery the latch always reports false, exactly
    as the old flag did, so the reticle fill, the ceremony trigger and
    every fresh-save capture are bit-identical (every canonical reef pose
    runs `?reset=1`, so the shot set cannot see this change — measured,
    below). A discovery fires on an attended frame by construction (the
    scanner is what fires it), so the ceremony always plays against a
    watching animal; the 8 m radius sits deliberately outside `Moray`'s
    own 6 m instinct so the two cannot flicker at a shared boundary; and
    nothing in `src/creatures/` moved — the latch only decides the boolean
    `Game` was already passing.
  - `tests/morayCuriosity.test.ts` pins all of it: never-before-discovery,
    relaxed-on-restore, engage by focus and by presence, hold through
    sub-window inattention, relax after the window, timer reset,
    re-engagement — and one integration case that drives a real dragon
    through attend-and-relax and watches the head yaw actually come back
    to its den pose, the thing the old pin made impossible.
  - Expected knock-on, stated: `probe-moray.mjs`-style completed-save
    poses now show a head *turning toward* the camera during the settle
    (lookBlend ≈ 0.95 after 1.5 s) rather than pre-pinned at 1 — the same
    pose to the eye, a hair less rotated in the buffer.
- **QA, measured against the `wave6a-merged` archive with a same-session
  control** (`wn5-dressing` vs `wn5-dressing2`, self-noise ±0.2 of luma
  mean everywhere — the quietest bracket any package this wave has had):
  the intended poses moved and nothing else did. A **−1.2** / F **−1.0**
  (the corridor edges trading bright sand for low colour, p10 −3), B
  **−0.1** (the sponge region is a few hundred pixels at that range), and
  C/D/E/G/H/I/J/S/Z all hold within **±0.4**. W **−11.0** / X +0.4 / Y
  **−4.3** carry W-N4's weather-amplitude package in the same shared
  tree — their section claims those numbers, and the zero self-noise here
  is what says both packages' deltas are deterministic code, not capture
  drift. `wn5-dressing-noassets` is the fallback build: the sponge fix and
  the corridor beds are fully procedural, nothing breaks.
- **Gates at close**: typecheck clean; eslint clean on everything this
  package owns (the only repo errors live in W-N4's untracked `tmp_wn4/`
  scratch probes — flagged, not owned; this package's own scratch tests
  were deleted before close, answering W-N4's flag about
  `__wn5_scratch_where`). Unit suite **315/315** (12 new: 5 corridor
  dressing, 7 curiosity). **E2e 20/20 in 9.7 min** on the gated
  single-worker recipe (gate opened at 1-min 2.31; discovery 27.5 s, save
  round-trip 51.2 s, volume-slider inside its doubled budget).
- **Tags**: `wn5-before` (same-session before), `wn5-r1` (iteration),
  `wn5-dressing` (canonical fifteen), `wn5-dressing2` (control),
  `wn5-dressing-noassets` (fallback), `tmp_dish-*_wn5-sweep` (the zebra
  identification), `tmp_coral-*_wn5-r1` (sponge/brain/plate close views).
  Files touched: `CoralShapes.ts` (`CoralField.ts` needed nothing — every
  placement stream is untouched by construction),
  `CorridorDressing.ts` (new), `Seaweed.ts` (two exports, additive),
  `Reef.ts` (dressing wiring + two grass clumps, gate block untouched),
  `Game.ts` + `MorayCuriosity.ts` (new), `Random.ts` untouched (seed was
  pre-registered), tests `corridorDressing` + `morayCuriosity` (new),
  probes `probe-corridor.mjs` + `probe-dish.mjs` (new).

## Wave 6a merge verification (orchestrator)

After W-N1/W-N2/W-N3 all closed, the merged tree was verified on a quiet,
idle machine (no sibling workers — the condition none of the three ever had):

- **typecheck + eslint clean, unit 298/298.**
- **E2e 19/20 in 7.1 min**, the one failure the volume-slider audio spec
  (130) timing out on `page.goto` — re-run isolated it passed at 47.3 s.
  Because that spec's healthy runtime is ~47–50 s against the default 60 s
  budget, it flaked on nearly every loaded run this wave; it now carries an
  explicit `test.setTimeout(120_000)` with a comment. This absorbs boot
  time only — the spec's own waits are all still bounded, so a real
  regression still fails; verified green at 46.2 s after the change.
- **Canonical archive `wave6a-merged`** (all 16 poses, including the first
  archive entry for W-N2's `Z-kelp-canopy`) is the reference for Wave 6b.
  A/G/Z inspected by eye: the zebra peek anchors, the grass cups, the
  canopy is a ceiling.
- Capture-script gotcha: the tag is a positional argument, not `--tag`;
  passing `--tag <name>` tags the files with the literal string `--tag`.

## Wave 6b merge verification (orchestrator)

After W-N4 (weather amplitude + backdrop seam) and W-N5 (bowl dressing +
curiosity relax) closed, the merged tree was verified idle:

- **typecheck + eslint clean** (both workers' scratch files were removed
  before close), **unit 315/315** — W-N4's mid-wave 316 included W-N5's
  since-deleted one-case scratch test; 315 is the merged truth.
- **E2e 19/20 in 7.6 min**, the one failure the duck-watcher spec (200) —
  the documented starved-loop flake — green isolated at 28.0 s.
- **Canonical archive `wave6b-merged`** (16 poses) is the round's closing
  reference and the diff base for whatever comes next.
- Standing flag for the next moray-staging owner (found by W-N5, proven by
  scene-node toggle): the "white-rimmed maroon dish" cropping into B/H's
  right edge is the **zebra moray's own body** at (13, 1.4, 6) cut by the
  frame edge — not the tube sponge. The fix is staging (pose, or camera
  margin), not geometry. (Closed by W-O2's survey yaw in Wave 7.)

## Wave 7 merge verification (orchestrator)

After W-O1 (canyon look-back), W-O2 (frame-edge staging) and W-O3
(close-range detail) closed, the merged tree was verified idle:

- **typecheck + eslint clean repo-wide** (all three workers' scratch files
  confirmed removed), **unit 325/325** — W-O2's mid-wave 326 was another
  shifting-tree count; its new cases (survey yaw, lateral lane stagger)
  are confirmed present in the merged suite.
- **E2e 20/20 in 7.5 min on a quiet run — zero flakes**, the first
  fully-clean full-suite pass since the wave machinery started sharing
  this host.
- **Canonical archive `wave7-merged`** (16 poses, now including W-O1's
  R-canyon-lookback) is the closing reference for the round.
- The two painted coral albedo strips (`coral-brain-wash.png`,
  `coral-plate-wash.png`, orchestrator-generated to W-N5's spec) live in
  `public/assets/world/` with originals in `asset-staging/`.

## Round close: the 9/10 verdict and real-hardware truth

- The critic's final pass scored the game **9/10** against the "near
  Studio Ghibli" bar (6 → 8 → 9 across the round). All three Wave 7 items
  passed; the damage sweep found nothing; its recommendation: **stop
  visual work — diminishing returns** — and spend the next effort on
  gameplay depth.
- **Real-GPU verification** (the critic's insurance item):
  `SHOT_HEADED=1 node scripts/measure-frames.mjs` (new opt-in headed mode)
  on this laptop's actual GPU: **300 frames, median 16.7 ms (59.9 fps,
  vsync-locked), p95 17.1 ms, settled scale 1.00** at the spawn pose.
  Every ms figure elsewhere in this ledger is SwiftShader-relative; on
  hardware the scaler never leaves full resolution. The in-canyon
  SwiftShader cost (~+20 ms) was not separately measured headed, but at
  ~10-30x SwiftShader-to-GPU ratios it is comfortably inside the vsync
  budget.

## W-O3 — CLOSE-RANGE DETAIL (Wave 7)

- **The brain and plate corals wear W-N5's painted albedos now**
  (`CORAL_WASHES` in `CoralShapes.ts`, wired in `CoralField.skinnedMaterial`).
  `world/coral-{brain,plate}-wash.png` arrive through `requestAlbedo` with
  `{ tile: true }` — the brain's GLB UVs are `project_uvs`' spherical at
  **8×4 tiles** around the dome, so both wraps must repeat — and the swap is
  the fan's contract one surface over: procedural until the file lands,
  procedural forever if it does not (`wo3-detail-noassets` shows nothing
  breaks), and **only `map` moves**. The procedural normal stays, because the
  strips are colour and nothing else — WP-G6's whole-asset contract.
  - **`unpackCoralWash` levels each strip per channel onto the generated
    skin's own mean** (`weightedMean`, exact here because a wash has no
    cut-out), memoised per kind since the two `CoralField`s share materials'
    sources. The strips are painted near-neutral (~0.9 mean by spec, the
    brain's measuring 222/213/206 sRGB), but "near" is a dozen parts warmer
    than the generated maps' 0.99/0.96 tint, and a dozen parts multiplied
    into every instance colour is a garden-wide hue shift nobody chose. What
    survives is the painting's *variation* — the meander, the growth rings —
    which is what the critic's "still fairly flat close up" was missing.
  - **Plain repeat, measured before trusted**: the brain strip's wrap join
    steps 4.1–5.3 parts per channel against 3.5–4.6 between interior columns
    — under one part of excess, invisible inside a texture whose own
    contrast is ten times that. No mirror needed; the sand wash's test,
    reapplied. The plate strip's join is at interior level exactly, and its
    polar layout (rings and branchlets about (0.5, 0.5), palest margin)
    lands on the cylinder cap's own UV disc so the vertex paint's growth
    gradient and the painting agree about which way the colony grew.
  - Evidence: `tmp_{brain,plate}-close_wo3-r1` (close-ups posed off the live
    instance matrices — `probe-coral.mjs`'s standing views judge the garden,
    not one head), against `tmp_coral-*_wo3-before`. The plate's top faces
    now carry radial branchlets crossed by rings with a pale margin; the
    brain a soft warm/cool mottle over its sculpted furrows. Subtle by
    design — the levelling keeps the garden's value, so the painting cannot
    arrive as a value change.
- **The kelp canopy's leaves are individuals now, and the jitter costs no
  stream traffic** (`Kelp.ts`). The lanceolate outline moved from the shared
  template into `shapeLeaf`, and every leaf draws its own margin serration,
  profile peak, vertical ruffle and cup depth from `leafDetailSeed` — an
  FNV-1a hash of the length/width/droop/rise values the streams *already
  produced*. Zero extra PRNG draws, so the placement contract holds to the
  bit: the frozen stalk buffer test (5768 vertices, hash 4264248344) passes
  untouched, and no clump moved.
  - **The jitter is fenced by one rule: nothing may land further out in the
    ground plane than the un-jittered leaf put it.** The margin wave only
    cuts inward, the profile jitter clamps under the baseline outline, the
    cup only deepens, and the ruffle is purely vertical — so the lane
    sweeps in `tests/kelp.test.ts` (horizontal by construction, margins
    thin: W-N2 re-stepped a stand for 0.26 m) can only get *safer*. That
    fence is why this package could reshape every leaf in the forest
    without owning a placement conversation.
  - **The fine template is nine rows, and who gets it took three
    photographed cuts** (`tmp_Z-kelp-canopy_wo3-r1..r4`): a margin can only
    undulate between the vertices it has, and pose Z's offenders are the
    crown ribbons *and the grove giants' own base straps* at arm's reach.
    Length alone (r1) missed the short near crowns; crown alone (r3) lost
    the giants' straps; both-everywhere (r2) fixed the pose at nearly twice
    the bill, most of it on mid-field straps nobody sees the edge of. The
    key is `crown || (giant && length > 1.4)`. Fine leaves also keep a real
    ruffle floor: a pad seen along its own plane shows the cup fold as its
    silhouette, and the vertical ruffle is the only term that can bend that
    line.
  - **The bill, honestly**: leaf mesh 36,340 → 48,116 triangles, **+11,776 ≈
    +5.9 ms** by the ledger's SwiftShader arithmetic (vertex-bound, so the
    0.34 floor does not shrink it; nothing on hardware). `probe-kelp.mjs`
    paired at loads 5–7.6 read 34–51 ms gross across A/B/C/G — drift
    wearing numbers by the standing rule; the arithmetic is the claim.
    Pose Z holds its archive mean to +1.7 with the one real trade in red
    p90 (−19): flat sunlit leaf area became undulating values, which is the
    painterly read the package was asked for.
- **The caustic dapples are larger, more varied, and no longer one lattice**
  (`CausticsSystem.ts`). `TILE_METRES` 5.5/8 → **7/11**, the far layer's
  painted clone turned 1.07 rad about the tile centre (`LAYER_SPIN` — two
  clones of one image, axis-aligned, are one grid at two scales from
  overhead), and the generated fallback's size wobble widened ±22% → ±38%
  (mean 1, so the sheet's energy is untouched). The critic's overhead pose
  read the dapples as "polka dots": from twelve metres up a sub-metre blob
  on a 5.5 m lattice is a dozen pixels on a legible grid.
  - **Energy conserved, measured same-session both ways**
    (`probe-light.mjs`, tags `wo3-caustics` new / `wo3-caustics-old`
    reverted-constants control): shot A coverage 10.7% → 10.4%, p90 36 → 40,
    R−B +6.9 → +6.2; shot B 18.8% → 20.7%, p90 within one part. Looking
    straight down (`S-sand-below`) the light spreads 39% → 55% of frame at a
    third the median delta — broader and softer, which was the ask. (The
    23%/58 figure in WP-G6's note is that era's whole stack, not a baseline
    for today's; the reverted-constants control is.)
  - **Pose G is the intended casualty**: −4.3 of luma mean against the
    archive (−6.7 on the same-session tmp pair, red p90 −18). Relaying the
    dapple field moves which cores land on which slice of sand, and G's
    foreground lost a couple; A/F held to +0.1/+0.7. The ground-level read
    stays crisp (`tmp_G-tidepool-close_wo3-final`), not mush.
  - **W-N4's weather contract is untouched by construction**: the retune is
    repeat/rotation/pattern only, `update()`'s gain, shaft-tint and
    visibility-flip paths did not move, and all of
    `tests/weatherMoods.test.ts` — including attached-vs-control exactness
    and the full-overcast hide — passes against the new constants. The
    sanctuary's sheets ride the same `TILE_METRES` (the W-L2 rule: shared
    light, shared scale); E/S held inside their self-noise brackets.
- **QA**: canonical seventeen under `wo3-detail`, control `wo3-detail2`
  eleven minutes later, `wo3-detail-noassets` for the fallback build. Against
  the `wave6b-merged` archive: A +0.1, C +0.1, D −0.3, F +0.7, I +0.6,
  J +0.1, W −0.2, X +0.1, Y +0.3 of luma mean; B +1.6 and E/S +1.0 inside
  their own self-noise brackets (B's control swung −4.6); Z +1.7 and G −4.3
  are the two intended deltas, justified above; H +4.0 carries the summoned
  turtle plus W-O2's live staging edits in the same shared tree. A new
  canonical pose `R-canyon-lookback` appeared mid-wave (W-O1's); it rides
  the sets and belongs to their section.
- **Gates at close**: typecheck clean; eslint clean on everything this
  package owns — the only repo errors live in W-O2's untracked `tmp_wo2/`
  scratch probes (the `tmp_wn4` pattern again, flagged, not owned). Unit
  suite **325/325 at this package's close** — 315 at the wave's open, plus
  this package's two wash-contract cases in `coralGarden.test.ts`, plus
  eight the siblings appended mid-session; the frozen kelp buffer, lane
  sweeps and all weather-caustics exactness cases pass unmodified. E2e, on
  the gated single-worker recipe, is the standing verdict observed again:
  the full run opened at 1-min 2.21 and the wave's captures drove the load
  to 11+ mid-suite — **14/20 in 20.8 min**, all six failures the two
  documented starved-loop families. The gated isolated re-run cleared five
  of the six (**14/15**); the last, the duck-watcher spec (200), failed
  twice more with the flake's exact signature (`duckFloor` 0.992 against
  the 0.95 assertion, chime and discovery green, loads 13–16 landing on
  the spec's one minute) and then **passed in 29.1 s** on the first strict-
  gated quiet minute (gate 1-min < 2; the wave6b verification's own number
  for this spec is 28.0 s). Union across gated runs: every spec passed;
  nothing this package touches — coral maps, kelp leaf vertices, dapple
  texture scale — is driven by any spec.
- **Shared-tree hazards paid this session**: probe-coral died mid-run three
  times on sibling HMR (`bakeBudGradient is not defined`,
  `buildShelfLipStones is not a function` — W-O1/W-O2 saving mid-capture);
  the standing-view screenshots were retaken with a scratch capturer and
  the paired frame-cost numbers from those runs were discarded as
  drift-wearing (half the buckets measured negative at loads 8–12).
- **Tags**: `wo3-before` (same-session before: kelp poses, CR1 overhead,
  coral standing views), `wo3-r1..r4` (iterations; r2 vs r3 is the
  fine-template key being found), `wo3-final` (kelp poses),
  `tmp_{brain,plate}-close_wo3-r1` (wash close-ups), `wo3-caustics` /
  `wo3-caustics-old` (the dapple A/B), `wo3-detail` / `wo3-detail2` /
  `wo3-detail-noassets` (canonical + control + fallback).

## W-O1 — THE LOOK BACK (Wave 7)

- **The canyon's outbound view is composed now.** The round critic's item
  one: looking back up the canyon from the den (its NV4 angle), the frame
  was "a mauve field with blue dot polyps" — ~80% one uninterrupted slope.
  The look-back now has what every other direction has, and all of it lives
  where W-N1's marks live (`Abyss.ts` strata, `AbyssFlora.ts`, the gate
  block in `Reef.ts`), behind the same fences: everything new draws from
  fresh `SEEDS.canyonPaint` substreams *after* every existing draw, the
  strata stay gated on `canyonBlend === 0`, and `tests/canyonPaint.test.ts`'
  reroll pins (first/last W-M3 motes, polyp matrices 0/41, the first frond
  root) pass byte-for-byte. `R-canyon-lookback` joined the canonical set
  (NV4's pose verbatim, appended after Z), because a direction that is
  fixed and never framed is a direction that regresses silently.
- **The composition, layer by layer, back to front**: the near floor stays
  bare on purpose — it is the descent corridor, and the empty channel *is*
  the way home (the W-L2 corridor rule) — flanked by the polyp lights; four
  standing stones at the shelf's near lip (r 38.4–40.2) hold the frame's
  edges; five taller ones on the upper lip (r 35–37.2) notch the horizon —
  placed against the AB6 camera's actual grazing ray (y ≈ −1 at r = 36),
  because W-N1's sill-stone lesson holds from this side too: two earlier
  radii vanished below the crest they were placed to break; four gate-side
  ghost kelp plants (r 32.4–35.6, own stream, heights capped at 1.7 − foot
  so no tip clears shot I's sill ray) rise as silhouettes into the doorway;
  and the doorway itself radiates — see the light story. Layered against
  the bright bowl water, the frame now recedes in four planes.
- **The light story is "the way home is made of light", in two marks.**
  The strata gained a *gate glow*: inside r = 39 the wall paint lifts
  toward a pale warm multiplier (full 0.7 of the way to (1.14, 1.08, 1.0)
  by r = 31.5), so the climb visibly brightens toward the bowl — baked
  where the strata already are, zero runtime cost, zero at the den wall
  where the strata tests sample. And `abyss-gate-glow` hangs in the notch:
  one additive quad (8.4 × 5.6 m at 0.16 opacity, a soft turquoise ellipse,
  green above blue) on the light columns' pattern — `fog: false`, no depth
  write, edge-on fade, never a writer on any fog or weather channel. It is
  **single-sided, facing down-canyon**, so from the bowl it is back-face
  culled and shot I's doorway is untouched to the pixel; its bounding
  sphere clears the wedge guard's r − radius > 27 with the quad pushed to
  r = 32.4 for exactly that reason.
- **The mauve field itself is painted now, not one value.** Three terms
  joined `canyonStrata`, all position-keyed so the bands' top-down value
  order survives (the luma-monotonicity case never moved): a within-band
  **mottle** (fbm, ±0.24 swing with darkening scaled 0.7 — the deep band
  sits near the value floor the tests hold — and a blue trade so bright
  patches lean rose and dark ones deeper violet); **sediment lines**
  (elevation-keyed ripples riding the band-edge wander so they undulate);
  and the gate glow above. One lesson worth keeping: **the seabed grid is
  the pitch's floor** — at 0.94 m per vertex a 1.6 m sediment sine is at
  Nyquist and bakes as mush, not lines (measured, `wo1-r4`); 3.2 m puts
  three and a half vertices in a cycle. Local 1 m steps measured 2–7% of
  multiplier after the fix, against ~1–3% before.
- **The polyps are living lights now, and the fix was two depth lessons.**
  The critic's "flat blue dots" was exact, and the first cut failed
  silently: a halo `Points` at the bud's own position loses its hot core
  to the bud's depth test and renders as a dim ring (`wo1-r3`) — the halo
  now hangs just *above* the tip. And a baked tip gradient in the bud's
  vertex colours did nothing at first, because down here the bud is nearly
  all emissive and **emissive ignores vertex colours** — the coral field's
  own `emissivemap_fragment` patch (`totalEmissiveRadiance *= vColor`, a
  module-constant chunk) is what lets the gradient shape the light itself.
  Glow intensity went 0.3 → 0.36 to hold the cluster's total under the new
  mean; every mark stays far under the bloom's 0.82 (halo peak ≈ 0.28 of
  opacity). Not one draw moved: the halo cloud is built from *recorded*
  bud transforms, and the instanced matrices are bit-identical
  (`tests/canyonPaint.test.ts` pins them; new cases pin the gradient, the
  halo-per-bud pairing and the lifted centres).
- **The weather already reached the curtains and the veil, and now it
  cannot go stale.** Task 3 needed no writer: `followFog` re-mixes both
  from `scene.fog`, which is the weather-scaled, mood-modulated compose —
  verified by pinning golden-afternoon and plankton-haze at J's pose
  (`tmp_LB-canyon-*_wo1-weather`): golden re-inks the far end warm, haze
  swallows it. What did change: the hook used to ride only the near
  curtain's middle segment and the veil's, so a mood crossfading while the
  camera framed only an outer segment kept a stale tint; every curtain and
  veil segment carries it now (it short-circuits on the fog's hex, so the
  riders cost one comparison per drawn segment). The weather module was
  not touched. One accepted gap, flagged: the gate glow's turquoise is a
  fixed tint, so under a full overcast the doorway's glare dims only by
  what the backdrop behind it loses — re-deriving "the bowl's water as
  seen from the canyon" would mean un-multiplying the mood from the live
  fog, and that arithmetic belongs to whoever owns a real channel for it.
- **Instruments and tags**: `scripts/probe-lookback.mjs` (the look-back, a
  polyp close-up two metres from the first W-M3 cluster, and J's pose under
  two pinned moods — four angles no canonical shot stands at) joins
  `probe-abyss.mjs`, whose AB6 *is* the critic's NV4. Tags: `wo1-lookback`
  (canonical sixteen, R's first archive entry), `wo1-lookback2` (the
  control — R reproduces at **+0.0 every channel**: nothing in that frame
  lives on a slow cycle), `wo1-lookback-noassets` (fallback), final angle
  set `tmp_AB*_wo1-final`, iteration rounds `tmp_*_wo1-r1..r6`, weather
  evidence `tmp_LB-canyon-*_wo1-weather`, before set `tmp_AB*_wo1-before`.
  Unit suite at close: 325/325 (typecheck clean; this package's five new
  cases included, siblings' in-flight additions landing beside them as the
  wave runs).
- **Invariant proofs**: unit suite green at close (`canyonPaint` 10 → 14
  cases, `abyssBiome` 13 → 14 — the shelf stones are scenery by
  construction: not in `obstructionMeshes`, ≥ 1.7 m lateral off the
  descent corridor's axis, honest instance-aware sphere past r = 27; note
  that sphere is *local* to the node, add `mesh.position` before reading
  it in world terms). The bowl frustum guard, `seabedRelief`'s FROZEN
  table and `reefSightlines` pass untouched. Canonical bowl poses hold
  the `wave6b-merged` archive at A +0.1, D −0.2, X +0.0 of luma mean
  (self-noise bracket `wo1-lookback2` ±1.5); **I +0.6 and J +0.4** are
  the two frames this package's marks are visible in, and the poses that
  moved more — G −5.7, H +3.5, C +2.0, E +1.4, S +2.1, B −1.3, W −1.4 —
  are all in W-O2's (creature/sanctuary staging) and W-O3's (coral skins,
  caustics, kelp) ownership areas, riding the shared tree exactly as
  every wave's sections document from the other side.
  `wo1-lookback-noassets` is the fallback build: every W-O1 mark is
  procedural (`DataTexture`s, vertex colours, seeded geometry), and the
  no-assets look-back carries the whole composition.
- **What it costs** (`probe-abyss-cost.mjs`, whose wedge collector finds
  the new stones and glow by position): by arithmetic, ≈ **+0.6k triangles,
  two draw calls and 126 points, in-canyon only** — ≈ +0.3 ms vertex-bound
  at SwiftShader's 0.5 ms/k plus the glow quad's small additive fill; the
  strata terms are bake-time and free. In-bowl the cost is structural zero:
  every new mark is inside the wedge past r = 27 (held by test), the glow
  quad is back-face culled from the bowl besides, and A/D/X diff at ±0.2.
  Two gated probe runs corroborate without beating the drift: both opened
  under 1-min 3 and spiked to 13–15 mid-probe (the wave never drains on
  this host), printing pose A — provably culled — at +20.9/+32.3 at the
  floor and −59 at scale 1, the ledger's drift tell at full amplitude. The
  cleaner second run pairs the **whole biome** at **I +20.4 / J +16.6 ms
  (0.34 floor)** against W-N1's published +19.2/+17.0 — a net of ≈ +1 ms
  where the composition lives, inside the drift, matching the arithmetic.
- **E2e**: full gated run opened at 1-min < 3 and the wave's captures
  resumed mid-suite (load back to 6–13) — **15/20 in 19.1 min**, all five
  failures the documented starved-loop families (accessibility
  sensitivity, three audio specs incl. the duck watcher, discovery
  timing). The gated isolated re-run of those three files: **15/15 in
  10.9 min**, every former failure among them (discovery 28.2 s, the
  volume slider at 1.4 m of its doubled budget). Union across runs: the
  whole suite passed; every failure reproduced as a load artifact —
  nothing this package touches (paint, scenery, additive marks, all
  culled where the specs pose) is driven by any spec.
- **Flags, not owned**: the repo-level `eslint . --max-warnings 0` fails
  on W-O2's `tmp_wo2/*.mjs` and W-O3's `scripts/tmp-wo3-wash-check.mjs`
  scratch probes (no-undef/no-unused-vars) — the W-N2/W-N5 scratch-file
  convention again; every file this package owns lints clean.

## W-O2 — FRAME-EDGE STAGING (Wave 7)

- **The "dish" was the zebra's own sculpted snout, and the fix is a resting
  survey yaw** (`DEN_FACE_YAW` in `Moray.ts`, zebra-only, 0.92 rad). W-N5's
  node toggle named the moray root; this package took it to the pixel: the
  den anchor (13, 1.4, 6) stands ~15° outside the right frustum edge of the
  canonical B/H/X camera ((10, 3, 12), yaw 0.72 — that edge plane crosses
  x ≈ 11.1 at the den's depth), and the GLB head reaches 2.1 m further west,
  so ~0.3 m of bare snout crossed back into frame: dark dorsal skin as the
  hull, the cream contour as the white rim, cropped mid-head. Verified by
  raycasting through the dish pixels (`moray-glb-head` at x 10.8–11.1) and
  by species toggle (`tmp_dish-hide-zebra_wo2-identity.png`). The brief's
  "reads as a creature" arm is geometrically unreachable — the eye sits 2 m
  outside the frustum and the anchor is FROZEN — so the shipped outcome is
  the other arm: the resting snout turns south, down the z ≈ 6 approach
  corridor, and out of that frame.
  - **Why 0.92 and not less**: 0.6 rad clears pose B alone; H's nine-second
    settle grows the curiosity lean (the B/H camera stands 6.9 m from the
    den, *inside* the 7 m curiosity band, so the head slides ~0.15 m back
    toward frame) and its full lookBlend carries the gaze quirk's −0.16 rad.
    0.78 still left a corner sliver in H; 0.92 clears B, H and X with
    margin (evidence pairs `tmp_dish-edge-{B,H,X}_wo2-{before,staging}`).
  - **The fences are W-N3's, inherited**: a rotation about the head node's
    own origin (head world position — sightline target, focus cone,
    `morayHead` pin — holds to the bit, asserted with `toBe`), gated by
    `archGain` (a driven sanctuary resident and a settling portrait never
    wear it), and deliberately **not** yielded to `lookBlend` — the canonical
    camera itself triggers the curiosity look, so a pose the gaze cancels is
    a pose the settle removes. The gaze offsets *from* the survey heading;
    for a western corridor diver the quirky gaze term (≈ −0.55) lands the
    attended face nearly back on the corridor axis, and `probe-moray.mjs`'s
    M3 pose confirms the close view reads as a creature at its den.
  - **Shot A improved rather than survived**: A's camera watches this den
    from the south-west, so the turned face now looks *toward* the lens —
    eye and brow visible where a pale side-on cylinder was
    (`tmp_A-zebra-anchor_wo2-{before,staging}`). W-N3's arch is untouched.
- **The sanctuary chimera was structural, not phase luck, and the lane fix
  is lateral.** The zebra and dragon lanes were near-concentric in plan view
  at a relative angular rate of 0.03 rad/s — once their beat aligned, the
  dragon's orange head rode screen-adjacent to the zebra's banded flank for
  ~30 s at a stretch (a bad alignment recurs for ~30% of every 3.5-minute
  relative lap), which is why the critic could verify it at both settles.
  Height stagger cannot prevent it: depth along the camera axis is what a
  chimera is *made* of. `SANCTUARY_LANES` now staggers the low trio in
  screen-x — zebra west and reversed, dragon east, hermit centre-deep — with
  phases re-drawn (snow 6.1, ribbon 3.3, zebra 4.7, dragon 0.9, abyss 2.4).
  Reversing the zebra also turns any residual dragon adjacency into two
  animals passing nose-to-tail, which no eye reads as one body. Measured
  with an offline screen-space body simulation (project both polylines
  through the sweeping camera; flag pairs under 70 px whose tangents run the
  *same* direction — anti-parallel passes and angled crossings are the
  praised depth-crossings and stay legal): the old table carried ~44 s of
  same-direction adjacency in the first 40 s of a visit, the new one under
  2 s of sub-second flickers. All W-N3 stagger rules still hold (heights,
  turns, phases ≥ 0.8 pairwise, both directions, rises, tops, bottoms) and
  the test grew a lateral case: dragon.x − zebra.x ≥ 4, opposite signs of
  speed, hermit ≥ 2 / ≥ 1.5 m off its neighbours.
  - **Determinism at the settle times, honestly**: E/S capture at
    `t_live + settle`, and `t_live` (KeyV → capture evaluate) measured
    13–19 s under this wave's load — seconds of drift, which is why a
    phase-only fix would have been a coin flip. The lateral separation is
    what makes the acceptance hold across the whole window; verified in the
    live scene at settle 4 and 8 (`tmp_sanctuary-s{4,8}_wo2-{before,staging}`
    plus the canonical E/S): five distinct animals, every head its own.
- **What it costs: zero by construction.** One `Record` lookup and one
  multiply-add per moray per frame in a loop that already runs; the lane
  change is constants read at `setSpecies`. No new draw calls, geometry,
  textures, or fixed-step work.
- **Invariant proofs**: `reefSightlines` untouched and green (the fix is
  rotation about a fixed origin; discoverability unchanged — the focus
  scanner tests distance and view angle to the head *position*, never its
  facing). `morayCuriosity` untouched and green. Unit suite green at close
  (this package: +3 cases — the survey yaw with the head pinned `toBe`, its
  absence on driven/settling animals and on the other four species, and the
  lanes' lateral stagger). Canonical fifteen vs the `wave6b-merged` archive,
  bracketed by a same-session control (`wo2-staging` vs `wo2-staging2`):
  every pose holds within ±1.6 of luma mean against self-noise up to ±3.4
  on the documented noisy poses; the intended changes are region-local and
  sub-mean by construction. W-O1's and W-O3's in-flight work rides the same
  diffs, per the wave's shared-tree reality.
- **Tags**: `wo2-staging` (canonical sixteen — including W-O1's new
  R-canyon-lookback; A retaken same-session after photographing W-O3's
  mid-HMR world with the kelp module half-saved, the W-N3 "void frame"
  rule), `wo2-staging2` (control), evidence sets `tmp_dish-edge-*`,
  `tmp_sanctuary-s*`, `tmp_A-zebra-anchor_*`, `tmp_dish-hide-zebra_*`,
  corridor set `tmp_M*_wo2-fix2`.
- **Gates**: typecheck and eslint clean (scratch probes deleted before
  close, answering W-O1's flag), unit **326/326** mid-wave (315 + this
  package's 3 + siblings' in-flight cases). E2e on the gated single-worker
  recipe: 15/20 with the 5-min load never under 4 (the two documented
  starved-loop families, nothing else); isolated gated re-run of both
  failing files **13/14** with accessibility 6/6; the last one standing was
  the duck-watcher (200), which failed with chime asserted green and
  duckFloor 0.97 — the standing triage note's fingerprint to the letter —
  and **passed at 27.6 s** on the session's one genuinely quiet minute.
  Union across gated runs: every spec green. Nothing this package touches
  (a zebra head rotation, sanctuary lane constants) is driven by any spec —
  the discovery swim targets the snowflake and the audio graph has no
  geometry in it.
- **Flag for the next staging owner**: the E/S composition still depends on
  `t_live`, so a future lane retune should reuse the screen-space
  same-direction-adjacency method above (sim the whole visit window, never
  a single instant) — the W-N3 stagger rules alone are provably not
  sufficient to prevent a chimera.

## Wave 8 — the Great Expansion (W8-0 scaffold + twelve parallel workers)

The owner's brief, verbatim in spirit: the world was far too small, too many
assets were lazy polyhedra, and the cast was too thin. Wave 8 shipped in one
twelve-worker parallel push over the W8-0 scaffold; this section is the
orchestrator's merge summary, and **each worker's full ledger lives in
`docs/wave8-ledger/*.md`** — read those before touching anything a worker
built. The design reference (frozen wing geometry, cast, invariants) is
`docs/WAVE8.md`.

- **The wings**: fifteen new environments radiating through the rim, the
  canyon's carve/mood/annex pattern generalised as data
  (`src/world/wings/`). Azimuth slots 1.35 + i×0.36 rad, carve 29.5→50,
  airspace to 51; geometry FROZEN, moods owner-tunable. Bowl and canyon
  bit-identity held by `tests/wings.test.ts` + the restated
  `seabedRelief`/`abyssBiome` contracts (the rim is mostly doorways now, so
  the crest assertion samples inter-gate midpoints). Seabed sheet 90→112 m.
- **The cast**: four wing morays (`golden-dwarf`, `frost`, `ember`,
  `pearl`) with dens at r=41 in their wings and sightline contracts in
  `tests/wingDens.test.ts`; sanctuary widened to nine probe-verified lanes
  (`scripts/probe-sanctuary-lanes.mjs` — the W-O2 sim re-created; the old
  script is lost, calibration is relative and documented in the header).
  Eight mythics (`src/creatures/mythics/`) — LifeSystems with discovery
  targets and codex cards, not sanctuary residents. Discovery total is 17.
- **The uplift**: crabs/fish/starfish/urchins re-sculpted (crab GLB 736
  tris; fish 104-tri loft), meadow raised to chest height with a tall
  variant, real bushes, tube/fan/branch corals graduated to GLBs, the
  anemone garden regrown grand at (9.0, 10.2) r2.4, clownfish at 3.0× as a
  banded GLB trio.
- **Movement**: swim-where-you-look (pitch-based forward in
  `DiveController`; Space/Shift still work, no longer required).
- **Gates at merge**: typecheck + eslint clean repo-wide, unit **484/484**,
  e2e **20/20** quiet (the reload spec now carries the volume-slider's
  120 s allowance — two boots of a tripled world outrun 60 s under
  SwiftShader). Canonical archive `visual-qa/*wave8-merged*`; the wings'
  own showcase set `visual-qa/*WING-*_wave8*` via
  `scripts/wave8-wing-shots.mjs` (16 poses + nine-resident sanctuary).
- **Known flags for the next wave** (owners' details in their ledgers):
  W1's god-shaft quads show hard edges from some cathedral angles; W3's
  ghost-reef near-gate stands carry returning-colour green earlier than the
  bone→colour story says (visible in the first showcase take); the
  sargassum horizon shows a flat green band from the look-up pose; taller
  meadow now crowds canonical cameras A/G's foregrounds; W11's branch GLB
  is capsule-framed (deviation documented) and the instanced garden gained
  ≈300k tris in the assets build — a perf pass should re-measure headed;
  the kraken showed its fallback in the first cove capture — GLB adoption
  worth a headed spot-check; `CoralField.CLEARANCES` still reserves the
  vacated anemone disc.

## Waves 9–11 — the streamed world, the two critics, the edges (orchestrator epilogue, 2026-08-02)

The world grew from one bowl to a **sixteen-region streamed map** — five
provinces of three regions chained down frozen spokes (RegionSlots), plus
the Sunken Calamity spur — every region built or reworked to the R12
standard (≤260 draws / ≤1.35M tris bound by the ≤16.9 ms headed gate,
three-layer law, ≥11/12 sweeps, no-assets survival). The journey:
Kelp Sea → Emerald Terraces → Canopy Deep; Smoulder → Forge Combs →
Lantern Vigil; Bone Meadows → Lantern Combs → Dayspring; Drop Plains →
Deep Steps → First Sea; Hourglass Sea → Carillon Waste → Vesper Strand;
and the Calamity. Every pass corridor is cut open from BOTH sides (the
R0.3–R0.10 reciprocal-cut idiom — grep those markers for the pattern),
wings are all uplifted (Tier A + Tier B), the traveller network runs, and
the fill program's kit carries per-instance silhouette variants with a
byte-exact placement fixture (tests/kitVariants.test.ts, prefix
semantics: recorded nodes frozen, appends legal, re-records only for
ledgered re-authoring).

Two independent critics then judged the whole against the owner's bar.
CRITIC-REPORT.md (verdict NOT YET: "jewels on a string of bare sand")
drove a six-branch remediation wave — hard-geometry purge (the great-blue
"wall" razor was the 160 m far-plane clip; cured by clip-dissolve, later
refined to alpha-to-coverage through the MSAA resolve), kit variants,
beat repairs, roads-and-axes (every corridor: one reveal, one companion
shoal, one light change; the mid-down axis authored world-wide; traveller
timetables fixed), wings polish, wave-close verification.
CRITIC-REPORT-2.md re-scored it (9 FIXED / 5 SHORT / 1 REGRESSED,
verdict "NOT YET but CLOSE — artifacts, not absences") and its edge list
was closed by the conviction wave (the wall's three anchoring events:
Fallen Colossus, Hornsgate, Worldwall Promise; veil rims to true zero;
the sand-normal-map seam truth) and the edges wave (stipple → sub-pixel
coverage; analytic seabed normals kill the crease class; HorizonFogBand;
the kelp blade finally a ribbon via fence-safe lateral spine sway).
Evidence frames are COMMITTED at docs/report-frames/ — never again lost
to a reclaimed worktree.

Load-bearing lessons this era: pipe nothing over `npm test` (a masked
exit code hid a real failure for a day); every cross-region visual claim
is verified at the cited pose on the INTEGRATED tree (cross-branch
stacking twice produced artifacts no branch had); silhouettes read
through their notches; vastness needs an anchoring shape; and the
protected-stillness registry (MASTER §1.2) held through every wave —
composed emptiness is content. Region ledgers live in
docs/region-ledger/*; the rulings in docs/fill-plans/MASTER.md bind all
future work. The next critic should be arguing about which twelve frames
to leave out.
