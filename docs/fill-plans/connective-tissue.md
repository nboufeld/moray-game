# Fill plan — connective tissue (bowl → wing → vale → region → pass → region)

Phase 1 planning per docs/FILL-DOCTRINE.md. The regions are becoming worlds;
the *journey between them* is still built to Wave 8's thinner standard, and it
is where the owner's "coherent journey towards different spots" lives or dies.
This plan audits the joints — the sixteen wings, the five vales, the region
borders and the one existing pass — and orders the uplift.

## 1. Honest audit of the journey

**The bowl** (always loaded, critic-scored 9/10) is not the problem — it is
the standard the joints fail against.

**The wings** (16 doorway-rooms, `src/world/wings/**`, latest captures
`visual-qa/*WING-*_wave8*.png` — no atelier-final set exists; wave8 is the
truth on disk):

- `WING-kelp-cathedral_wave8.png` — real trunks frame the frustum, but the
  floor is bare tan with a few dark dots, the walls are unpainted wedge, and
  the opened end wall reads as a **hard-edged flat cyan rectangle** — the
  streamed-region doorway showing as a cut-out. The worst seam in the game,
  on the most-travelled gateway.
- `WING-open-blue_wave8.png` — the descent hole is a flat poster-blue blob
  with a hard scalloped edge: no gradient, no rim light, no depth cue. The
  wing that sells *vertigo* currently sells a sticker.
- `WING-sandfall-dunes_wave8.png` — the falls read as blocky bloom smears
  (hard quad edges through the glow), the walls one olive value, floor
  rubble sparse. The idiom is right; the marks are unfinished.
- `WING-vent-springs_wave8.png` — the bubble rings and ember chimneys are
  the best wing marks; the walls behind them are one flat mauve (the
  canyon-before-W-N1 failure, again).
- `WING-ghost-reef_wave8-retake.png` — the pearl moray under its arch
  composes; crystal clusters exist; still bare mid-ground, and the known flag
  (returning-colour green arriving too early near the gate) stands.
- `WING-ruins-terrace_wave8.png` — two fine arches, one kirin-tail; the
  entire centre of frame is a bare wall. Plus the standing wave8 flags:
  sargassum's flat green horizon band, W1's hard-edged god shafts, the
  kraken's fallback showing in glass-cove.

**The vales** (five exist: verdant, smoking, pale, calamity, golden — each a
~200 m approach; calamity's is 490 m). Verdant-line-1's own ledger says it
plainly: "the vale is 200 m of empty walls." Golden's r4
`saddle-reveal`/`saddle-descent` frames show the same: an authored channel
with falls every ~60 m and nothing between. The vales are the game's longest
roads and its emptiest.

**The seams**: (a) wing→vale doorways — mood tables crossfade but *content*
steps (wing marks stop dead at the end wall; nothing of the region shows
through until the streamer attaches it); (b) region rim borders — sealed by
collider rings and distance curtains, adequate; (c) the verdant2 ledger flags
its outermost distance ring crossing the pass as an opaque curtain — a pass
seam bug to fix and to legislate against for future passes.

## 2. Wing priorities: journey-critical vs side-rooms

**Tier A — gateway wings** (they gate provinces; every journey crosses them):
`kelp-cathedral` (verdant, two regions behind it — highest traffic),
`sandfall-dunes` (golden, region in flight), `vent-springs` (smoking),
`ghost-reef` (pale), `ruins-terrace` (calamity, longest march behind it),
`open-blue` (great-blue — no region yet, but the wing itself is the
showpiece failure).

Per-wing Tier A uplift (density + light):

| Wing | Uplift |
|---|---|
| kelp-cathedral | floor turf + fallen-frond litter (T1), sapling understory (T2), god-shaft fix (W1 flag), **gate-veil** on the end wall |
| sandfall-dunes | fall-mark repaint (soft streak texture, no bloom blocks), duneling bed + gold motes (foreshadows the Hourglass Sea), gate-veil |
| vent-springs | wall strata paint (the canyonStrata `paint` callback it already has a slot for), ember polyp fringe, gate-veil |
| ghost-reef | bone-rubble ground cover, colour-return gradient fixed to run gate→region (the standing flag), gate-veil |
| ruins-terrace | fallen-block litter + moss paint, one wall relief carving (cheap vertex paint), gate-veil |
| open-blue | the hole itself: baked radial gradient + rim-light ring + descending mote column — depth as paint, not as a blue disc |

**Tier B — side rooms** (visited, not crossed): lumen-garden, glass-cove,
moonlit-lagoon, ice-grotto, wreck-meadow, nursery-shallows, current-run,
mangrove-roots, sargassum-sky. Uplift = one T1 ground statement + wall paint
+ their standing flags (sargassum horizon band, kraken GLB spot-check).
Nothing more until Tier A and the vales are done.

## 3. Vale-by-vale fill treatments (each vale is a gradient)

Doctrine: transitions blend over 20+ m; a vale should *become* its region —
palette, ground cover and life all lerp along u. Vale fill spends the owning
region's budget (vales stream with their region).

| Vale | Treatment (gate → lip) |
|---|---|
| verdant (cathedral → Great Kelp Sea) | kelp saplings thickening to stands; leaf-litter T1 ramping; leaf-drift motes already reach the vale — add a traveller shoal and two wayside boulder-gardens; wall paint warms bare walls (the ledger's own critique) |
| smoking (vent-springs → smoking-marches-1) | ember polyps and bubble threads continuing from the wing, thinning as vent strata paint hands over to the marches' palette; one steam-veil light event mid-vale |
| pale (ghost-reef → pale-passage-1) | the colour-return story told *along the vale*: bone-white rubble at the gate gaining colour patch by patch toward the region — fixes the wing's early-green flag by making the gradient the design |
| calamity (ruins-terrace → sunken-calamity-1, 490 m) | the march needs rhythm more than density: debris fields, broken arch fragments and lone survivors' flora every 25–40 m, three light events, one stillness stretch — the longest road in the game must not be the barest |
| golden (sandfall-dunes → Hourglass Sea) | per docs/fill-plans/golden-waste-1.md §2 (Honey Gate → lip beat table) |

**Gate-veil** (the shared fix for every doorway): a layered dressing at each
opened end wall — 2–3 silhouette planes in the *region's* palette (the
DistantReef hand-fog idiom, so they read through any mood), a soft light
column, and a drift of the region's particulate blowing into the wing. It
stands in the wing (always loaded, small budget) and makes the doorway a
promise instead of a cut-out; when the region streams in behind it, the veil
planes agree with the real distance rings by construction (same palette
source).

## 4. Pass treatments

The one existing pass — verdant's **Emerald Stair** (Great Kelp Sea →
verdant-line-2, `Verdant2Terrain.ts`) — already states the pattern: the pass
is a *place* (threshold, stair, flanking walls), with its own capture pose
(`pass-threshold`). Adopt as the pass pattern for all future passes:

1. Threshold reveal pose at the owning region's rim; stair or channel as an
   authored landmark, not a corridor.
2. Palette lerp over the whole pass length (both regions' ground paint and
   mood tables blend; one writer — the deeper region owns the pass tongue).
3. Life handover: one shoal whose route crosses the pass in both directions
   (the network below), so the road is inhabited at the exact spot streaming
   swaps regions.
4. Distance rings **gated over the pass corridor** on both sides — fix the
   flagged verdant2 opaque-curtain bug and write the gate into the pattern.
5. Seals double-rowed like the vales; reveal rhythm 20–40 m holds inside the
   pass too.

Future passes to reserve: golden Gilded Shore → golden-waste-2; smoking and
pale depth-2 passes when those regions are authored.

## 5. The shoal network (life that travels the whole journey)

Doctrine T4 at world scale: **traveller shoals** that commute
bowl ↔ wing ↔ vale ↔ region on seeded timetables, so every road is
periodically alive and the shoals are wayfinding (follow the fish, find the
place).

- One kit system (`ShoalRunner`): an instanced ribbon following an authored
  polyline with phase spread; 1 draw, ~40–90 fish, frustum-culled by segment
  bounds. Routes are data.
- One route per province, species-tinted: verdant green-silver (the current
  serpent's cousins), golden gold fusiliers, pale pearl-white, smoking
  ember-dark with warm bellies, calamity a sparse grey file (melancholy —
  fewer, slower).
- Route shape: bowl rim near the gateway wing → through the wing → down the
  vale → 50 m into the region, then back; period 3–5 min seeded per route so
  two provinces never sync. The bowl end makes the bowl's rim doorways feel
  breathed-through; the region end hands off to the region's own shoals.
- Ownership: the wing-side leg lives with the bowl scene (small, always
  loaded); the vale/region leg attaches with the region. The route is one
  polyline split at the streaming boundary; both halves share the seed so the
  timetable agrees.
- Saturation check: one route per province, never two shoals on a road at
  once, and the stillness zones (each region names its own) are off-route.

## 6. Prioritized order of work

1. **Gate-veils on the six Tier A doorways** (worst seam, cheapest fix, one
   kit piece reused six times) + the open-blue hole repaint.
2. **Kit pieces** (Phase 2 gate for everything else): ground-cover carpet,
   wire-tuft bank, drift-debris scatterer, wall-strata paint helper (the wing
   `paint` callback generalised), ShoalRunner, particulate field, light-event
   props.
3. **Vale treatments**, in traffic order: verdant (two regions behind it),
   golden (region closing now — coordinate with its Phase 3), pale, smoking,
   calamity.
4. **Tier A wing density/light uplift** (table in §2), including the three
   standing wave8 flags that fall inside them (W1 shafts, ghost-reef green,
   sandfall marks).
5. **Traveller shoal network**, one province at a time, verdant first.
6. **Verdant pass polish** (distance-ring gate bug, palette lerp audit) and
   the pass pattern written into the next region briefs.
7. **Tier B side-room uplift** last, flag-fixes first (sargassum band,
   kraken GLB).

## 7. Asset needs (kit pieces the wings/vales need)

- **Gate-veil builder** (silhouette planes + light column + particulate
  drift, palette-parameterized) — new, the highest-leverage piece.
- **Wall-drape flora bank** (hanging/encrusting growth for wedge walls —
  every wing audit above says "bare walls") — new.
- **Ground-cover carpet / wire-tuft bank / drift-debris scatterer** — shared
  with the golden plan (one implementation, two consumers).
- **ShoalRunner** — shared with every region's own shoals.
- **Wall-strata paint helper** — generalise `canyonStrata` behind the
  existing `WingDef.paint` slot so each wing's uplift is a table, not a bake
  rewritten fifteen times.
- **Soft fall/streak mark texture** (sandfall-dunes, and the Hourglass falls
  reuse it) — replaces the bloom-block quads.
- **Light-event props** (reveal beam, glint spark, steam veil) — shared.

## 8. Budget notes (wings are tighter than regions)

The wings share the bowl's always-loaded scene: the bowl runs vsync-locked at
scale 1 on real hardware (16.7 ms median, ledger) and ~160–180 ms at the 0.34
floor on the QA rasteriser — the wings' uplift must not move either number in
*bowl* poses, and the mechanism is frustum culling, not hope:

- **Per-wing uplift ceilings**: Tier A wings ≤ +10 draws / ≤ 35k tris; Tier B
  ≤ +6 draws / ≤ 20k tris. Whole-program wing uplift ≤ +120 draws / ≤ 380k
  tris resident — resident is memory, not frame cost, because:
- **Every uplift mesh carries an honest bounding sphere entirely inside its
  wedge past r = 27** (the abyss curtain lesson: wide arcs get segmented;
  instanced meshes call `computeBoundingSphere()` off real matrices — the
  sill-stones trap). `tests/wings.test.ts` gains a frustum guard case per
  uplifted wing against the canonical bowl frusta.
- **No `frustumCulled = false` in a wing, no castShadow on smallwork, no new
  per-frame update hooks** — wing sway rides the existing `WingFlora.update`
  forwarding.
- In-wing frame budget: a wing camera sees its wedge + the bowl rim; each
  Tier A wing may spend up to ~+15 ms SwiftShader-floor in its own poses
  (the canyon's precedent, W-N1: +7–8 over budget, documented) — state
  overruns in the ledger, never hide them.
- Gate-veils are additive transparents: ≤ 3 planes + 1 column each, opacity
  ≤ 0.2, `fog: false`, depth-write off — the canyon column discipline.
- Vale and pass fill is **region** budget (streams with the region, doctrine
  caps 160 draws / 450k tris per region including its vale).
