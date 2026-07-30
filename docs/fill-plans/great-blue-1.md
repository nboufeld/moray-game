# Fill plan — great-blue-1 (The Drop Plains)

Phase 1 planning document, written against the region's **CURRENT in-flight
worktree state** (`/worktrees/blue1`, `src/world/regions/blue1/**`, capture
rounds `plains-r3c`/`plains-r3fix`). **No ledger exists yet** and the worker
is still iterating — counts and findings below may shift slightly when that
package closes; re-verify the audit against its final capture set before
Phase 3 starts. Governed by docs/FILL-DOCTRINE.md. The steppe's vastness is
COMPOSED restraint: the fill is swell rhythm, stone rhythm, life crossings
and layered distance — never clutter. The World's Edge stays empty on
purpose.

## 1. Current-state audit

**Blocking QA finding first:** the flat-violet frame corruption (the driver
bug `Blue1Ferryman.ts`/`Blue1Life.ts` document — a lit mesh drawn with no
normal attribute) still fires. `sisters-frame`, `terrace-stairs` and
`under-blue` are solid violet fields in **every** available round
(`20260729-1850/1831_*_plains-r3c`, `20260729-1716_*_plains-r3b`), and the
`plains-r3fix` run (20260729-2034) additionally corrupted `slope-reveal`,
`steppe-sea` and `migration-river`. Some lit geometry still ships without
normals (or loses them on an HMR path); find it by node-toggle probe.
Three of twelve poses have never been seen healthy.

Per pose (healthiest available frame cited):

- **slope-glide** (`20260729-2034_*_slope-glide_plains-r3fix`) — a clean
  empty road with two sub-pixel waymarks. Both shoulders are unbroken warm
  tan fbm; the channel floor bare for its whole visible length. Three-layer
  law fails: no foreground interest, no middle silhouette.
- **slope-reveal** (`20260729-1850_*_plains-r3c`) — grass wisps begin, but
  the "steppe opening" horizon is a **hard flat cobalt band** (the
  horizon-ring/deep-arc curtains reading as poster paper), and the prairie
  between is single scattered blades on tan sand.
- **steppe-sea** (`20260729-1850_*_plains-r3c`) — the named prairie pose is
  ~70% bare tan sand with isolated single blades. The sward ground tint
  does not read as green ground (same wash-mean trap pale1's ledger
  documents); no stone breaches the fog in-frame; swell relief reads only
  faintly. This is the doctrine's "gradient and sand" frame.
- **gnomon** (`20260729-2034_*_plains-r3fix`) — the frame that works: near
  grass has real presence, the monolith silhouette is good. But the stone
  reads dark muddy violet-brown (rock wash + algae bake under this mood),
  not `STONE_PALE`'s blue-grey, and its foot is bare — no collar, no life.
- **fallen-king** (`20260729-2034_*_plains-r3fix`) — stump and crown read
  as two violet boulders; the *toppled* story does not read (the crown
  slab looks like a second boulder). The gold star ring reads as orange
  dots (good); the beam is invisible at this settle; grass sparse; large
  empty midground.
- **sisters-frame** — corrupted in every round. Never verified.
- **migration-river** (`20260729-1850_*_plains-r3c`) — the centrepiece
  fails: the 300-fish river reads as ~10 mauve specks in empty water. The
  fish are too small/fogged at the pose's range, the braid too loose, and
  the glint thread invisible. The frame below is tan sand + sparse blades.
- **terrace-stairs** — corrupted in every round. Never verified.
- **the-prow** (`20260729-1850_*_plains-r3c`) — the camera is buried behind
  the prow slab (a violet dome fills frame centre); behind it the deep
  steps read as **flat electric-cobalt stripes with sawtooth triangle
  tops** — the Friedrich distance as paper cut-outs. Migration fish read
  as scattered specks. Both halves of the region's climax pose fail.
- **under-blue** (`20260729-1716_*_plains-r3b`) — same cobalt-stripe
  problem at full size: three hard-edged flat blue bands with teeth, no
  vertical gradient, hue far off the intended violet (`DEEP_INK` under
  this fog multiplies to saturated cobalt). The Under-Blue floor gradient
  below is decent.
- **ferryman** (`20260729-1831_*_plains-r3c`) — the sunfish is not
  legible in its own pose: the frame is dominated by the flat cobalt
  deep-arc silhouette; the animal is lost against it or out of frame at
  the settle.
- **edge-lookback** (`20260729-1831_*_plains-r3c`) — monolith silhouettes
  over the horizon band read well; but the mid-frame is one flat cobalt
  stripe and the foreground a bare tan slope with a single whelk.

**Bare road stretches (from the layout tables):**

- Slope channel u 44–300 (256 m): 2 jambs + 6 half-buried waymarks (~one
  per 35 m, singles, nothing at their feet). The channel floor is authored
  as "a clean sand road" — as captured it is accidental bareness, not a
  composed rest: no cover state, no ripple field, no life crossing.
- Steppe between stones: megaliths hold 40–70 m spacing (correct rhythm)
  but the ground between carries only the sparse blade scatter — 1,600
  near + 4,200 far instances over ~120,000 m² is ~0.05 tufts/m²; the
  bowl's meadow runs ~20× denser over its area.
- Terrace shelves s 26–96: 12 lip slabs + ~20 whelks over three shelves
  ~90 m deep and 270 m wide; the shelf floors are bare.
- Under-Blue floor: bare by design — keep (the composed rest between the
  drop and the painted deep).

## 2. Journey map

**Spine:** wing seam u 48 → Reef Gate (55) → waymark glide (92–267) →
reveal at the mouth (~288) → wander line across the steppe: first swell
crest (~330) → Shepherd sightline (352,118, off-spine tease) → Gnomon
(415,58) → Wayline stones (455,10 → 492,6 → 526,2) → Prow (545,4) → the
drop → Under-Blue (absoluteY −38) → Ferryman's water.

**On the steppe the reveal engine is swell rhythm + stone rhythm + life
crossings**, not props: crests every ~42 m lift something new out of the
fog. The plan makes each crest *pay*:

| station | beat |
|---|---|
| u 55 | Reef Gate (exists) — gains a last-reef bed: warm rubble + 3 coral pieces dying out by u 70 (the colour falling away behind, made literal) |
| ● u 92–267 | each waymark boulder becomes a waymark *cluster*: boulder + 2 calf-stones + gravel shadow + 1–2 whelks — one beat per 35 m with a foot |
| ● u 150 | slope life crossing: a silver thread of the migration's outriders crosses the glide high — the region's promise, shown early |
| ~288 | reveal (exists) — fixed by the horizon-band rework (§4/§7) so the prairie opens instead of a cobalt wall |
| ● crest at ~330 | first swell-crest bed: wind-combed grass run + pale gravel lee (crest/lee vocabulary, repeated on every spine crest) |
| 352,118 | Shepherd (exists) — pale so it reads at 60 m; the tease off-spine |
| ● 372,74 | north-swell sprite wisp (exists in code) anchored on the wander line so it is actually met |
| 396,−22 / 415,58 | single stone → Gnomon (exist) — every megalith gains a **collar**: gravel apron, 2–4 calf-stones, whelk cluster, one grass ring — a stone becomes a *place* |
| ● 434 | migration overhead crossing #2 (the river's loop passes the wander line here by table) |
| 455 → 492 → 526 | the Wayline (exists) — collars + a faint worn gravel line linking the three (the region's one drawn road) |
| ● 508,−30 | terrace-edge overlook cairn: small stack marking where the first shelf drops |
| 545,4 | Prow (exists) — pose re-staged (§7), flanking stones exist |
| drop | the pour: migration dip (exists in code, must read — §5) |
| −38 | Under-Blue: composed emptiness, Ferryman + deep steps only |

**Side loops:** the Fallen King hollow (382,−96 — stump re-staged so the
toppled crown reads; the gold ring + beam are already right); the Sisters
arch (468,−52) with the sprite haunt; the terrace stairs walked as three
descending rooms (each shelf gets one lip-slab cluster + scree tongue).

**Rest points (named, composed):** mid-glide hush (u 180–230, the road
kept clean — now *composed* by crest beds on both shoulders and nothing in
the channel); the Fallen King hollow; the Prow tip; THE UNDER-BLUE itself.

## 3. Zone density table

Budget: no measured baseline yet (in-flight; the worker must publish
draws/tris in its ledger). Estimated current ≈ 45–55 draws / ~180k tris.
Doctrine caps ≤160 draws / ≤450k. Plan adds ≈ +25 draws / +200k tris.

| zone | T1 ground cover | T2 understory | T3 verticals | T4 ambient life | T5 events |
|---|---|---|---|---|---|
| Long Slope (u 44–300) | shoulder gravel runs 1,200–1,800 (1 draw); channel floor: ripple-field paint state only (composed road — no instances in the lane) | waymark clusters: 12–18 calf-stones (1 instanced draw); last-reef bed at gate (4–6 coral kit pieces, shares kit draws) | jambs + waymarks (exist) | slope outrider thread (shares migration draw); motes (exist) | gate bed; u 150 crossing; reveal |
| Seagrass Steppe | **grass tiers**: near cupped blades 1,600 → 4,500–6,000 (16 tris, 1 draw); mid tufts 4,200 → 9,000–12,000 (12 tris, 1 draw); NEW far card tufts 8,000–12,000 (4 tris, 1 draw, kit builder) — prairie density ~4× | stone collars: gravel aprons + calf-stones 80–120 (1–2 draws); crest/lee beds on spine crests ×6 | megaliths (exist; value fix §7) | sprites (exist, re-anchored); grass-fry pods ×3 (~60 inst, 1 draw); whelks 20 → 45; stars 26 → 40 | Gnomon, Sisters, Wayline, Fallen King (exist, re-staged); crest beds |
| Terraces (s 26–96) | shelf-lip scree tongues 400–700 (1 draw); grass thinning per shelf (exists via floor gate) | lip slab clusters (12 → 24 slabs, same draw); silt-drift paint bands (bake) | 1 sentinel stone per shelf edge ×3 (existing megalith draw) | whelk trios along lips; a deep-water star variant 12–18 | each shelf lip = one authored step-reveal |
| World's Edge / Under-Blue | NONE on the void floor — composed | NONE | Prow (exists) | Ferryman + escort (§5); marine-snow motes 150 (extends existing Points) | the pour; the deep steps (reworked §4) |

Tri arithmetic: grass tiers ≈ 96k + 132k + 44k = 272k gross (−76k existing
grass replaced ⇒ net ≈ +196k); collars/scree/calves ≈ +12k; life ≈ +6k.
**Net ≈ +215k tris, +8–12 draws** → ≈ 395k / ~65 draws. Inside caps, but
grass is the whole budget: the far-card tier is the tuning lever; the
ledger must publish measured totals (SwiftShader is vertex-bound).

## 4. Light plan — moving cloud-dapple, god-rays, abyssal contrast

- **Moving cloud-dapple** (the steppe's signature): a caustics-style
  additive sheet is wrong here (17 m down, mood-dimmed) — instead drift two
  large soft **shadow fields** across the prairie: multiplicative darkening
  on two ground-hugging transparent quads (`DataTexture` sheets), value
  −6%, period ~90 s, reduced-motion halved. Cloud shadows crossing grass
  is the strongest "prairie wind" cue and costs 2 draws. Prototype first;
  if it reads as a decal, fall back to giving the three prairie blades a
  60 s opacity swell (light that breathes instead of shadows that move).
- **God-rays**: existing three prairie blades + Gnomon accent stay; add one
  blade at the Sisters (their pose has none) and one over the Wayline
  mid-stone. All stay ≤ 0.11 opacity — the high sun is the story.
- **The Edge's abyssal contrast**: keep the no-beams rule past the lip.
  The contrast must come from the **deep steps rework**: bake a vertical
  value gradient into the arcs' vertex colours (canyon-curtain lesson —
  foot 0.6 → crown 1.1), retint `DEEP_INK` toward violet (red above green;
  the current multiply lands electric cobalt under this fog — measure with
  image-stats and re-derive), soften the sawtooth (double arc columns
  64 → 160, halve `vary`, droop the tops with low-frequency fbm), and add
  a fourth, palest arc so the void ends in four planes. The Under-Blue
  gains **marine snow** (slow-falling pale motes) — light as particulate,
  not beams.
- **Fallen King beam** stays the one warm mark on the steppe (the secret's
  signature); nudge opacity 0.13 → 0.16 so it survives its own pose.

## 5. Life system plan

- **Shoal network (life as wayfinding):** the **Migration Line** is the
  road-map and must finally read: raise fish scale 1.15–1.7 → 1.5–2.2,
  tighten the braid (lateral 2.1 → 1.4), raise emissive intensity toward
  the pilot's measured "above the water's value at forty metres", and
  double the glint (220 → 400 points, size 0.28 → 0.4) so the band reads
  as a silver thread from anywhere on the steppe. Add the **slope
  outrider thread**: 30 instances on a small closed loop crossing the
  glide at u 150 (shares geometry/material — one extra draw max).
  Route check: the loop's station at (448,52) passes the migration-river
  pose closer (settle 6 s) — verify with a healthy capture.
- **Small fauna per surface:** grass — three **grass-fry pods** (hover
  shoals in the blade tops, one at each named grass haunt); sand — whelks
  45 (trios at stone feet and terrace lips), steppe stars 40; stone —
  **stone-skirt blennies**: 2–3 tiny perchers per megalith collar
  (kit percher builder, blue-grey); terraces — deep star variant.
- **Drifters:** motes (exist) + Under-Blue marine snow + grass seeds: a
  sparse warm-pale drift downwind of the crests (30–50 points, the wind
  made visible).
- **Centrepiece + satellites:** **the Ferryman**, with a pair of **pilot
  jacks** riding a metre off its flank (2 instances, same fish geometry)
  so the great coin has scale. Its patrol crosses the migration's dip once
  per circuit (true by the tables) — stage that crossing as the region's
  one scheduled spectacle, worth a capture pose. The **Grey Pilgrim**
  (exists) stays the steppe's wanderer; lift its band to cross two swell
  crests so it appears/disappears with the ground rhythm.
- **Preserved stillness zones (named, no life added):** THE UNDER-BLUE
  (Ferryman only — The Gentle Dark's register must stay reachable); the
  MID-GLIDE HUSH (u 180–230); the FALLEN KING HOLLOW (stars and beam,
  nothing swims through it).

## 6. Asset needs

**(a) KIT** (shared builders, same modules pale-passage-1's plan names):
- ground-cover carpet builder (gravel runs, scree tongues; parameterised
  palette/density/gating).
- far-grass card builder (the 4-tri crossed-card tuft tier — any region
  with meadows needs the cheap distance tier).
- percher colony builder (stone blennies here, brittle-stars there).
- particulate field builder (marine snow, grass seeds).

**(b) EXCLUSIVE signatures (2–4):**
1. **Megalith collar** — the authored stone-foot kit: gravel apron +
   calf-stones + grass ring + whelk trio as one seeded composition; the
   thing that makes each standing stone a destination.
2. **Wind-combed crest bed** — grass run + pale lee gravel authored to a
   swell crest; the steppe's repeatable "place" unit.
3. **Deep-step painted arcs v2** — the four-plane violet void distance
   (gradient-baked, drooped skylines); only this region has a World's Edge.
4. **Pilot jacks** — the Ferryman's two-fish escort (tiny, but it is the
   region's scale cue and exists nowhere else).

**(c) REUSE:** `createFishGeometry` (river, sprites, jacks);
`starGeometry`/whelk (exist); `RockShapes` boulder/slab/stack (collars,
calves, cairn); pale1's kit carpet/percher/particulate builders; the
canyon-curtain gradient discipline for the deep steps; `SeaGrass`
leaf-glow injection (already consumed).

## 7. Rework checklist (ordered, file-level — against the CURRENT worktree; re-sync when the in-flight package closes)

1. **Fix the flat-violet corruption first** (it blocks all visual QA):
   node-toggle probe over `sisters-frame`/`terrace-stairs`/`under-blue`;
   audit every lit geometry for a missing/late `normal` attribute
   (`rayGeometry`, `whelkGeometry`, mola fins are patched — something is
   not). No fill work is judgeable until twelve healthy frames exist.
2. `Blue1Distance.ts` — deep-steps rework (§4): vertex gradient, violet
   re-tint, 160 columns, drooped tops, fourth arc; prairie horizon rings
   get the same gradient treatment (the cobalt band in `slope-reveal`/
   `edge-lookback` is the set's loudest failure).
3. `Blue1Ground.ts` — sward legibility: adopt pale1's absolute-paint
   lesson (compose the turf colour and divide by the wash mean, instead of
   multiplier tints) so green ground finally reads green; strengthen
   crest/lee value split; terrace silt bands.
4. `Blue1Steppe.ts` — grass tiers (near 4,500–6,000 / mid 9,000–12,000 /
   NEW far cards 8,000–12,000); density keyed up along the wander line and
   crest beds; keep the channel floor clean. NOTE: count changes re-roll
   placement streams — freeze/re-pin any test literals honestly.
5. `Blue1Stones.ts` — megalith collars + calf-stones + Wayline gravel
   line + overlook cairn; Fallen King re-stage (crown slab thinner, 1.1 →
   0.7 height, half-sunk, aligned to a fall direction from the stump);
   gate's last-reef bed; stone value fix (megaliths take `STONE_PALE`-
   family tint lift — measure the rendered stone against the intended
   0x5e6f88 and re-derive the material tint under this mood).
6. `Blue1Life.ts` — migration legibility package (§5); outrider thread;
   grass-fry pods; whelks/stars up; marine snow; grass seeds; pilot jacks
   in `Blue1Ferryman.ts` (or beside it — they ride the same path object).
7. `Blue1Light.ts` — cloud-shadow prototype (or breathing blades
   fallback); Sisters + Wayline blades; Fallen King beam 0.16.
8. `Blue1.ts` — re-stage `the-prow` pose (camera 2 m left and 1 m up so
   the slab juts across the lower-right third instead of filling the
   frame); add poses `wayline-walk` (u 470,8 looking down the three
   stones) and `ferryman-crossing` (staged at the migration dip); append
   after existing poses.
9. Tests (`tests/regionBlue1.test.ts`) — honest updates: publish measured
   draws/tris against the doctrine caps (160/450k); reroll-fence pins for
   every existing table before adding streams; grass floors (≥ N instances
   inside the steppe-sea frustum band, 0 instances in the channel lane and
   past `dropWeight > 0.05`); collar clearances off the corridor; deep-arc
   colour-order case (red above green after `followFog` at the region's
   own fog).
10. Capture ritual — twelve healthy frames + the two new poses + a
    RANDOM-pose sweep; no-assets set; same-session control; **write the
    missing `docs/region-ledger/great-blue-1.md`** with the budget table.

## 8. Coherence notes

- **Open-blue wing handshake:** the wing (`OpenBlue.ts`) is "emptiness
  composed on purpose — nothing may clutter this wing", and **The Old
  Current patrols its middle water while The Gentle Dark rises past its
  far curtain**. Obligations: (1) nothing of this region crosses the seam —
  grass, collars, outrider thread and motes all live inside
  `blue1Weight > 0`, and the gate's last-reef bed stays past u 50 (outside
  the wing's carve); (2) the Under-Blue keeps the mythics' register — vast
  calm water where one great shape is an event — continued, not
  contradicted: no shoal, no beams, no clutter below the lip, ever; the
  Ferryman is this region's one great shape, rhyming with the wing's
  mythics without sharing their water. (3) The slope's mood crossfade
  (fog scale [0.6,0.55,1.08] vs the wing's [0.6,0.72,0.95]) hands over
  inside the seam tongue — verify no visible band at u 44–50 once the
  horizon rework lands.
- **Ghost-reef/pale handshake:** none (no shared border). Shared kit only.
- **Kit coherence:** consumes the same carpet/percher/particulate/far-card
  builders pale-passage-1's plan commissions; palettes differ
  (`STEPPE_TONES`/`STONE_BLUE` here, bone/blush there) — one world, many
  rooms.
- **In-flight caveat, restated:** this plan cites r3c/r3b frames where
  r3fix is corrupted; if the closing worker's final round changes grass
  counts, stone tables or distance layers, re-base §3's arithmetic on
  their ledger's measured numbers.
