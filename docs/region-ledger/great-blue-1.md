# great-blue-1 — THE DROP PLAINS

Slot `great-blue-1`, province The Great Blue, gateway wing `open-blue`
(azimuth 5.31). Disc centre ≈ (250.4, −367.9) — spoke u = 445 — radius 220;
approach tongues r 44/62 → the disc. Seed `SEEDS.regionBlue1` and `^`
substreams only.

*This ledger was reconstructed and closed by the rescue instance: the
region's first worker died silently mid-critique around round 3 and left
no ledger. Rounds 1–3 below are rebuilt from its commit messages, its
capture sets (`plains-r1` … `plains-r3fix`, all kept under `visual-qa/`)
and the fill-plan audit's findings; rounds 4–9 are the rescue's own.*

## Concept

The Open Blue wing was the lip of vertigo; this is the country past it:
the great blue steppe before the true abyss. The subject is space itself —
vastness composed, not emptiness neglected. A long glide descends out of
the wing while the last reef colour falls away; a seagrass prairie rolls
crest after crest out of the fog; lone megaliths each hold their hundred
metres of steppe; a permanent river of silver fish crosses the whole
region mid-water; the floor steps down a value at a time; and then it
simply ends — the World's Edge, the drop past −46, the Ferryman working
the void, and a painted deep beyond, composed like a Friedrich.

## Sub-biome map (spoke coordinates: u along azimuth 5.31, v lateral CCW)

| Sub-biome | Where | Floor |
|---|---|---|
| The Long Slope | u 48 → 300 along the tongue | −14 → −17 glide, dune shoulders at the flanks |
| The Seagrass Steppe | the disc's near two thirds | −17 ± 2.4 directional swells (λ ≈ 42 m, laid across travel) |
| The Standing Stones | megalith field across the steppe | steppe floor; each stone seated by a contact patch |
| The Terraces | s 26 → 96 (s = u − 445), \|v\| < ~150 | −17 → −21.3 → −25.6 → −29.9 in three shelves |
| The World's Edge / Under-Blue | s > ~104, \|v\| < ~95 | the drop past −30 to the deep floor at −46.5 |

Vertical range ≈ 34 m inside the diver's core (steppe swell crests ≈ −13
to the deep floor −46.5; the test holds range > 30 and lowest < −40).
The ceiling starts high over the glide (up to ~25 m of water column),
runs high over the steppe and closes to floor + 3 at the seal ring.

### The domain, and how it is sealed

Weight is max-combined from `slotDisc` plus two `approachTongue`s: a seam
tongue (halfWidth 8.2 → 34, clearing the Mangrove Roots and Ice Grotto
wedges with margin at r = 44) and a wide slope tongue from r = 62
(20 → 40). Every open edge is walled inside the weight-1 core, where the
annex floor (`terrainTarget + clearance`) and the composed ground are the
same function — the honesty that matters most forty-six metres down: a
92-station rim ring at rc = 164 (gapped only over the corridor's spine),
four-level doorway stacks at the wing seam, three-level flank rows down
the glide, and gate posts where the ring's gap meets the corridor.

## Landmarks

1. **The Reef Gate** — paired stacks at the slope's mouth, the doorway out of the wing.
2. **The waymark stones** — spaced down the glide so something breaches the fog the whole way.
3. **The Gnomon** — the tallest stone in the province (13.2 m, pale) at (415, 58), the steppe's pivot.
4. **The Sisters** — two stones leaning into a near-arch at (468, −52)/(472, −57.5).
5. **The Wayline** — three stones in a row (455 → 526) aimed straight at the World's Edge; following the region's most obvious line is the tour's last act.
6. **The Shepherd** — alone on the north steppe (352, 118), the far fog's one landmark.
7. **The Fallen King** — a toppled megalith at (377, −104): stump, fallen crown on its own fall line, and the secret at its foot — a lit ring of cowries.
8. **The Terrace lips** — broken slab rows marking each shelf's step down.
9. **The Prow** — the jutting overlook slab at the World's Edge lip: the Friedrich stand, the Ferryman's anchor below.

The megalith spacing is the fog rhythm authored as geography: stones stand
40–70 m apart — a little under the fog's reach — so from any one of them
the next is a silhouette just breaching the haze.

## Life

**The Migration Line** — the moving centrepiece: 420 silver fish filling
one closed loop nose to tail (braid 1.4, scale 1.5–2.2, emissive 1.15)
with a 400-point glint thread riding the band, crossing the whole region
mid-water — across the steppe, between the stones, out over the World's
Edge (where the river dips toward the deep) and home along the far
prairie. **The Grey Pilgrim** — a lone ray gliding a slow seeded ellipse,
banking into its turns. Grass sprites (a hover-shoal by the Sisters, a
travelling wisp over the north swells); cobalt cushion stars and banded
whelk shells along the terrace lips; 400 pale motes, because empty water
needs something to measure itself against. And **the Ferryman**
(`the-ferryman`, *Mola traiectus*) — the findable resident: an ancient
giant sunfish patrolling the lip of the drop below the Prow, codex entry
in the def's pure half, discovery target on its anchor.

## Budgets (measured programmatically; tests/regionBlue1.test.ts holds the caps)

**64 draw calls, 218,815 triangles, 267 colliders** at build. Ground:
4 disc tiles (231 m, 104 segs) + 1 slope sheet (56 segs), trimmed to the
domain and rim-drooped; grass is merged area chunks with an instanced
near blade; everything repeated is instanced. Caps asserted at ≤ 120
draws / ≤ 250k triangles, with honest floors (> 20 / > 120k) so an empty
region passes no bar.

## Seeds

`SEEDS.regionBlue1` with `^` substreams per module: terrain fbm streams in
the pure half, stones 0x570e (+ per-stone shape seeds), steppe/grass, life
(line, pilgrim, sprites, floor fauna, motes), Ferryman, light, distance
0xd15b / 0xd200+ / 0xd300+ / 0x5a5a. The update phase spends no
randomness, so captures settle deterministically.

## Critique history (silhouette → value → colour → detail, per round)

### Round 1 (`plains-r1`, first instance) — bones right, register wrong
First buildable draft. Terrain/composition landed: glide, swells,
terraces, the drop. Found: GPU garbage on the indexed+instanced near
grass blade; grass value flat and the sward cut too soft; mood reading
as the bowl's own cyan at steppe depth; horizon rings too low (thin
water-lines, not swells); migration line sparse and dim; swells and
shoulders too shy. Three poses hidden by flat-violet frame corruption.

### Round 2 (`plains-r2`, first instance) — the register turns blue
Non-indexed near blade (the garbage was measured to the indexed instanced
path); grass value lift and a harder sward cut; bluer mood with eased
light takes; raised horizon rings; denser, brighter migration line with a
glint thread; stronger swells and shoulders. The corruption still hid
three poses.

### Round 3 (`plains-r3`/`r3b`/`r3c`/`r3fix`, first instance) — the hunt
Chased the flat-violet corruption through retake sets; found the streamer
detached the force-attached region before a fresh-page pose could land
(spawn sits 236.7 m from the region's edge) — the isolated
detach-hysteresis commit. Died silently mid-critique. The fill-plan
audit later named what its last frames showed: the corruption itself, the
deep steps reading as cobalt paper, the migration line as "~10 specks".

### Round 4 (`plains-r4`, rescue) — twelve healthy frames
The corruption's own cause found and fixed before judging anything: the
Ferryman and the Grey Pilgrim shipped from position-only merges with NO
normal attribute (`smoothNormals` silently requires one), and a lit draw
with the normal array unbound corrupted whole frames on the capture
driver — normals given, regression test added asserting finite normals
on every lit mesh. With the streamer fix holding the region attached,
all twelve poses rendered healthy for the first time.

### Round 5 (`plains-r5`, rescue) — the void's distance gets authored
The audit's two named bugs worked: per-arc authored violet inks with no
fade-lerp (measured: the lerp toward a fog bluer than the backdrop
re-supplied the blue the ink cut — bands at blue 190 over water at 151);
a fourth palest arc; 160 columns with a broad drooping swell (64 columns
rendered per-column noise as sawtooth teeth); vertical foot-to-crown
gradients baked into every distance plane. A node-toggle probe proved the
"sawtooth teeth" over the void were the trimmed ground sheet's edge
standing above Under-Blue's eye line — the rim now pours down to −52 in
the edge sector. Prairie ring feet dropped below the steppe floor.
Migration line made to read: 420 fish, tighter braid, bigger scale,
brighter emissive, 400 glints. The Fallen King's crown laid on its own
fall line; sisters-frame shoots through the arch; the-prow steps off its
own slab; ferryman moves inside fog reach of the patrol.

### Rounds 6–7 (`plains-r6`/`r7`, rescue) — the poster paper was the fog
The remaining "hard flat cobalt band" measured to its source: the mood's
fog blue 1.08 held every fogged horizon 21 parts of blue above the
backdrop it dissolves into — the fog itself was the poster paper, not the
distance geometry (raycast probes proved the "slabs" and "stairs" were
fogged ground and the terraces' own fogged profile). Blue 0.86 lands the
fogged horizon on the painting to within capture noise (measured
(49,159,168) fog against (43,158,167) backdrop). The prairie sheet's trim
cut at rc 225 pours under the ring feet like the edge sector's rim;
`endEase` probes finely over 0.3 rad (three coarse probes had quantised
the ease into giant terraced slabs at the void poses' frame edges).

### Round 8 (`plains-r8`, rescue) — cool from every pose
The band is gone; slope-reveal reads as prairie horizon, the migration
line reads as a river of silver in the-prow. Raycasts caught the last
three defects: (1) the deep steps rendered as MAROON paper from
Terrace-Stairs — the round-5 inks held red twice as high as green, an
overcorrection that survives any fog; (2) the droop between its two rim
regimes switched at exactly |v| = 118 and the prairie rim standing at 214
beside the edge sector's fall at 166 silhouetted as a razor-edged wall in
Under-Blue's right frame; (3) the nearest curtain at 70 m still
compressed its grade to one value.

### Round 9 (`plains-r9`, rescue) — the distance holds from every pose
Deep-step inks re-derived as near-neutral violets (red a nose above
green, level with blue); the rim droop's regimes blend over |v| 118 → 140
so the rim ends in a rounded shoulder; the curtain grade deepened
(foot 0.36 → crown 1.22). Full-set review: the maroon paper is gone from
Terrace-Stairs (the steps read as cool painted planes under the migration
line's specks); Under-Blue composes as the Friedrich — gradient curtain,
ridge silhouettes at its foot, the warm deep floor below; the Ferryman
reads clearly in both its own pose and The-Prow; Steppe-Sea catches the
Grey Pilgrim banking over the swells. All twelve poses healthy; none
reads empty, flat, or unpainted. The loop closes at nine rounds.

### Finish — the Ferryman stops gambling
The first `plains-final` set caught the one nondeterminism left: the
Ferryman's pose showed no Ferryman. Its updater seeded `last = 0`, so the
first update jumped the patrol clock to the page's whole global time —
the phase belonged to the load history, and whether the mola stood in
frame was a coin flip per run. The clock now runs from the region's own
attach with an authored phase (measured: the circuit passes the Prow
anchor at t ≈ 48.75; the harness's shutter lands ≈ 18 s after attach;
phase 28 puts the animal arriving at the crossing). Verified with a
single-pose retake, then the full canonical sets recaptured.

Final review, all twelve `plains-final` frames looked at: the Ferryman
sits dead-centre at the reticle before the Prow; the-prow reads the
painted slab against the silver river; under-blue holds the r9 Friedrich
(gradient curtain, painted deep floor, the Grey Pilgrim crossing);
edge-lookback composes waymarks and megalith silhouettes against a
horizon with no cobalt stripe. The `plains-final-noassets` set confirms
the region is procedural-only — no authored-asset dependencies. Twelve
healthy frames in both sets; the ledger closes.

## Capture sets

`plains-r1` … `plains-r3fix` (first instance), `plains-r4` … `plains-r9`
(rescue), `plains-final` and `plains-final-noassets` (canonical closing
sets), all under `visual-qa/` as
`*_REGION-great-blue-1-<pose>_<tag>.png`. Poses: slope-glide,
slope-reveal, steppe-sea, gnomon, fallen-king, sisters-frame,
migration-river, terrace-stairs, the-prow, under-blue, ferryman,
edge-lookback.

## Flags

- Two deliberately isolated out-of-scope commits ride this branch for the
  orchestrator to reconcile at merge: the CoralField vColor `.rgb`
  swizzle (076732c, already cherry-picked to main) and the RegionStreamer
  detach hysteresis 45 → 65 (662504d — spawn sits 236.7 m from this
  region's edge, so the force-attached region detached before a capture
  pose could land). No further framework edits were made.
- The flat-violet frame corruption had TWO causes: the systemic ones
  diagnosed in the main tree (unguarded `vec4 vColor`; shader-compile
  capture race) and this region's own — lit meshes with no normal
  attribute (fixed in 0521367 with a regression test).
- The capture harness logs "authored assets unsettled after 10000ms" on
  every pose in this worktree; frames are healthy — the wait then
  proceeds and the settle covers compile.
- The Ferryman's patrol clock runs from the region's attach with an
  authored phase (28 s), so the canonical pose meets the animal at the
  Prow crossing deterministically; in live play the attach moment is
  arbitrary anyway, so the behaviour is unchanged in kind.
- The mood's fog blue 0.86 is measured against THIS backdrop fade (0.5);
  re-tuning either re-opens the cobalt-band question.

# Phase 3 fill rework (docs/fill-plans/great-blue-1.md, R12 standard)

Branch `rework/great-blue-1`. The plan was written against the stalled
first-instance draft and carries a re-sync flag (MASTER R9); the rework
opened with a re-audit of its checklist against the rescued final tree
and the `plains-final` captures.

## The re-audit (what the rescue already did)

Read against the plains-final set, DONE and not re-done here: step 1
(the flat-violet corruption — fixed in round 4 with the normals
regression test), step 2 (the deep-steps rework: per-arc violet inks,
fourth arc, 160 drooped columns, baked gradients — rounds 5–9; the
prairie horizon carries its gradient and no cobalt band remains), the
migration legibility package from §5 (420 fish at scale 1.5–2.2, braid
1.4, emissive 1.15, 400 glints at 0.4 — the-prow reads a river of
silver), the Fallen King re-stage, the-prow's camera re-stage, and the
Ferryman's deterministic attach-clock patrol. STILL OPEN and executed by
this rework: the whole fill (grass tiers, sward paint, collars, crest
beds, slope dressing, outriders, jacks, light additions, cloud-shadow
prototype, stillness tests, new poses, the R12-measured budgets).
`steppe-sea` in plains-final was still the audit's frame: ~70% bare tan,
single blades; `slope-glide` a clean empty road; the gnomon's stone
still muddy violet-brown with a bare foot.

The sweep stream was recomputed offline before building (the calamity
lesson: aim the fill where the region is actually seen): two of twelve
poses live in the Under-Blue rest (licensed bare); three stand on the
rim-facing flanks at |v| 100–135 (the MASTER field-note warning); one
looks back down the slope channel from the reveal's mouth.

## The reroll fence, restated

Every fill stream is `SEEDS.regionBlue1 ^ 0xf3xx`, appended after all
existing draws. The test pins (nine decimals) hold the first collider,
the Ferryman's posed attach position, and the first deep-arc column
byte-identical to the pre-fill build (`plains-final`, e1a519d). The
stone MATERIAL tints were lifted (the plan's step-5 value fix — geometry
streams untouched); the ground bake was re-authored (step 3 — paint is
not fenced, it is the work).

## Round 1 (`bl-fill-r1`) — what the fill is

- **Grass tiers** (~4× the prairie): near tier 7,500 kit QUALITY
  `"blade"` clumps (48-tri S-bends, sunGlow, sway) at 0.5–1.05 m; mid
  tier 9,000 `"tuft"`; far tier 10,000 4-tri cards with `nearFade` 14
  (10,000 cards = 40k tris, the kit's own budget note). The region's two
  signature tall-blade draws stay byte-untouched above them. Gates share
  one truth: `swardAt` + collar rings, off the drop, off the channel,
  thinning down the shelves, `restFree` everywhere.
- **The sward's absolute paint** (the pale1 lesson): the bake composes
  story colours and divides by the wash's linear mean; turf threshold
  dropped so green owns the prairie; crest/lee value split; terrace silt
  bands below each lip; the milky rim held.
- **Megalith collars**: one graded gravel apron draw over every stone
  foot, 40+ calf-stones + the (508,−30) overlook cairn in one instanced
  draw, whelk trios (fresh stream, the pilot's shell), stone-skirt
  blennies (kit percher), grass rings in the near-blade gate. The
  mid-glide hush's waymark (u ≈ 193) is deliberately excluded — the one
  stone whose bare foot IS the composition.
- **The slope**: shoulder gravel runs (twoTone, off the lane), the
  gate's warm last-reef bed (pebbles + five warm bushBank growths dying
  out by u ≈ 74), the outrider loop crossing the glide at u ≈ 150
  (30 kit fusiliers), waymark collars.
- **The Wayline grit line**, scree tongues down all three shelf lips,
  16 deep-star cushions, three grass-fry pod haunts (kit percher,
  hover), 46 drifting grass seeds downwind.
- **The Ferryman's two pilot jacks** riding its flank in the patrol's
  own frame (fresh stream; the mola's phase pinned unchanged).
- **Light**: Sisters + Wayline blades appended after the existing four
  shafts; the King's beam 0.13 → 0.16; the R11 cloud-shadow prototype.
- **Poses**: `wayline-walk`, `ferryman-crossing`, and four close poses
  (2–4 m): `close-steppe-sward`, `close-crest-bed`, `close-collar`,
  `close-slope-road`.

Measured after round 1: **90 draws / 853,315 tris / 267 colliders**
(caps updated honestly to 140 / 1.1M; R12 room 260 / 1.35M). All 20
region tests green (fence pins, rests-empty walk over every static fill
instance, grass-tier floors, jacks).

### Round-1 probe findings (before the full set was even captured)

The first partial capture run found three build-breaking reads, fixed
as round 1b before the canonical round-1 sets:

1. **The MultiplyBlending cloud sheets white-outed every prairie
   frame** — not "reads as a decal", worse: the whole steppe rendered
   as cream-white fog from every pose (node-toggle probe: hiding the
   two sheets restored the frame). Mechanism unresolved on this render
   chain; the prototype's second try is a plain fogged translucent
   shadow-violet sheet whose ALPHA carries the blotches (islands of
   shadow, nothing drawn between them). R11's verdict is judged from
   the round captures below.
2. **The outrider glint** rendered as one hot static white ribbon on
   the shoulder (a 160 m loop is too tight for a static additive
   thread). Dropped; the fish carry the crossing.
3. **The absolute stories were painted for neutral light**: the blue
   mood pushed the composed floor to grey-blue — measured (81,89,108)
   where turf was meant, blue above green. Stories warmed (the calamity
   ledger's lesson: fill palettes are for THIS region's light); the
   mid-tuft tip ink greened off the near-white silver that rendered
   12-tri tufts as pale wedges at arm's length    (the "half-cut grass"
   read, avoided by palette rather than paid in triangles); near blades
   7,500 so the quality profile owns the foreground.

### Round 1 (`bl-fill-r1`) — critique (18 authored + 12 sweep, all read)

**Sweep verdict: 9 pass (01, 02, 10 marginal) + 2 licensed rests (04,
06 — the Under-Blue, composed and correct) + ONE FAIL: pose 11
(u 543, v 84), the third shelf's lip country over the drop's south-east
shoulder — floor −29.4, dropWeight 0, NOT a rest. The round-1 grass cut
at −25.5 left the last shelf bald, the deep arcs filled two thirds of
the frame as smooth bands, and nothing owned the near metres.**

- Working sweep frames: 03 and 05 are the fill's proof — grass banks
  with whelks and far cards, collared silhouettes breaching the fog,
  beams and monolith cards layering the distance. 07's look-back down
  the road carries both shoulders' grass; 08 stacks the Shepherd, the
  beams and the horizon band; 12 reads gravel + grass + cards over the
  reveal's mouth.
- Marginals: 01's near layer is one lip slab + whelk specks (carried by
  the two migration threads and the painted deep); 02 and 10 catch the
  fogged terrace faces as smooth blue paper (the depth paint reading
  synthetic at range).
- Authored set: `gnomon` is the fill's frame — the prairie finally owns
  its floor at every depth of field. `slope-glide` gets its beat (the
  outrider school crossing the shoulder). `fallen-king` composes the
  hollow: grass rings it, the rest stays stars-and-beam. `the-prow` and
  `under-blue` hold their plains-final reads (the fence, visible).
  `terrace-stairs` carries grass + whelk trios + sentinel.
- FAILS/finds in the authored set: `edge-lookback`'s shelves went to
  MUD — the depth story at full lerp measured (62,74,112) where
  plains-final had (84,103,117); the depth dim + violet both eased in
  round 2. `close-steppe-sward`/`close-crest-bed` caught 4-tri far
  cards as legible pale wedges at 15–25 m (nearFade 14 too tight) and
  some blade tones landing steel-grey. `close-collar` reads apron +
  calf + ring, but the stone STILL renders muddy purple with rust
  mottle — (101,96,120) measured, red above green. `wayline-walk`
  framed only one stone of three (camera stood past the first);
  `ferryman-crossing` caught a huge flat grey RECTANGLE — a distant
  monolith card floating where the World's Edge sector's rim has
  fallen away (node-toggle probe: not the rings; the card bands'
  margin was authored for the prairie rim, not the gap's shoulders).
- The R11 cloud-shadow (second mechanism — fogged alpha sheets): no
  decal read in any frame; the shadows read as soft floor blotches.
  Drift verified in round 2 with a timed pair before the verdict.

**Round-2 orders**: lip country gets its floor (mid tier sparse to
−28.5, deep stars 16 → 30 biased to the last shelf, scree 4 → 6 tongues
per lip); depth paint paled and eased; nearFade 14 → 26; monolith cards
post-filtered off the gap (stream-identical collapse in place); stone
tint lift deepened toward the sky key; near blades 9,000 / looseShare
0.48; migration-river lifted to its band; wayline-walk re-staged behind
the first stone; ferryman-crossing swung off the card.

### Round 2 (`bl-fill-r2`) — critique (18 authored + 12 sweep, all read)

**Sweep verdict: 10 pass + 2 licensed rests (04, 06) + ONE FAIL, and it
is the same one — pose 11.** The round-2 orders answered the wrong
metres: the mid tier's −28.5 cut never reached the last shelf's floor
(−29 to −31 — the whisper was ordered for country the cut still
excluded), and the camera's near layer is the terrace FACE, a country no
gate dressed at all. 01 and 10 both graduated from marginal (grass +
whelks + scree slab + migration threads own their near metres now); 02
passes with the note that the fogged terrace faces still read smooth.

- Authored set: no hard fails. `gnomon` and `sisters-frame` are the
  fill's frames; `the-prow` is the set's best (the braid crossing over
  the whale, the pale slab's gold-lichen read); `wayline-walk` now walks
  the line (first stone repoussoir, second waymark + beam mid-frame,
  the grit line legible); `ferryman-crossing`'s grey rectangle is GONE
  (the gap post-filter, verified); `migration-river` reads as painted
  fish with glint bubbles, not specks. `slope-glide` caught the
  outrider school out of frame (a timed loop, load-dependent capture
  moment — one school misses as often as it makes it). `ferryman`
  caught the whale far out on its patrol (same mechanism, pre-existing
  pose, noted not failed).
- The stone read, MEASURED settled: the gnomon body means (98,111,142)
  — blue above green above red, no longer mud. What remains is the
  wash's own ochre patching, and `the-prow`/`close-collar` show that
  same patching reading as gold lichen on lavender — painterly,
  consistent, KEPT (a third lift would chalk the family out).
- `edge-lookback` improved but SHORT: shelves measured (63,79,117)
  against plains-final's (84,103,117) — the round-2 easing bought +2
  to +4. The depth story starts at −18.5, on the look-back rim's OWN
  floor; the onset is the problem, not the lerp.
- Close poses: painted plants, no legible cards anywhere (nearFade 26
  verified at 2–4 m). One persisting note: the near tier's LOOSE
  splayed blades carry the silver tip ink to a bleached grey-white at
  arm's length. `close-slope-road` is marginal — the road is rightly
  bare, but its shoulder reads as one lone boulder.
- **The R11 cloud-shadow VERDICT: the fallback mechanism (fogged
  translucent alpha sheets) passes.** No decal read in any of the 30
  round-2 frames; the shadows read as soft drifting floor blotches
  under the prairie's light. The first mechanism (MultiplyBlending)
  remains ruled out on this render chain (round-1b whiteout).

**Round-3 orders**: the terrace faces get their own gravel (a
slope-country litter pass over each step's fall and the last shelf's
lip belt — the country pose 11 actually stands in); the mid tier's cut
−28.5 → −31.5 so the whisper reaches the floor it was ordered for;
deep stars 30 → 42 with a third of the draws pulled to the south-east
shoulder; depth-paint onset −18.5 → −22.5 and eased again (the rim's
own floor stops wearing the deep's ink); the near tier's tip ink
greened (0xcfeadb → 0xb8e2c6 — wind-pale value, green hue); a second
outrider school in anti-phase (stations rotated by two, fresh stream)
so the glide's crossing cannot be missed by timing; a two-stone
shoulder seat + whelks by the close-slope-road pose (appended after
every real site, earlier draws unchanged).

### Round 3 / final (`bl-filled`) — critique (18 authored + 12 sweep + 18 noassets, all read)

**Sweep verdict: 10 pass + 2 licensed rests (04, 06 — the Under-Blue,
composed and correctly empty) = 12/12. Pose 11 — the fail of BOTH
prior rounds — passes: the last shelf's lip owns its near metres now
(tufts + whelk cones + two of the deep-violet stars on the floor the
−31.5 cut finally reaches), and the terrace face behind it carries its
own gravel where round 2's country had no gate at all.** The other
graduates hold: 01's migration braid rides over a littered floor and a
disc stone; 02 sets near blades against the arcs; 03/05/08/10/12 are
the fill's proof frames (grass banks, collared silhouettes, beams,
cards); 07's road look-back carries both shoulders; 09 stacks the
braid over waymark stones.

- Authored set, the round-3 orders answered one by one:
  `edge-lookback`'s rim floor finally reads as its OWN country — warm
  turf with tufts and whelk cones, the deep's ink held back to the
  drop (onset −22.5 verified; the remaining gap to plains-final's
  numbers is the mood region's red compression, not the paint — the
  old reference was measured under the pre-rescue bake and is retired
  as a target). `slope-glide` catches a school crossing the shoulder —
  the anti-phase second school means SOME school is in frame at any
  capture moment (the round-2 miss was timing, now unmissable).
  `close-steppe-sward`'s loose blades wear green tips, the bleached
  grey-white gone. `close-slope-road`'s shoulder is a seat now — two
  stones, whelk cones, gravel — a place, not a lone boulder.
- The rest of the authored set holds its round-2 reads: `gnomon`,
  `sisters-frame`, `the-prow` (still the set's best), `wayline-walk`,
  `ferryman-crossing` (no rectangle), `migration-river`,
  `fallen-king` (grass rings the hollow, the hollow stays
  stars-and-beam), `under-blue` and `terrace-stairs` unchanged.
- The noassets set: geometry-only frames verified — no GLB-dependent
  fill, all painted content present without assets.
- The R11 verdict stands as recorded in round 2: the fallback fogged
  translucent alpha sheets SHIP; MultiplyBlending stays ruled out on
  this render chain.

**Final measured budgets**: 92 draws / 1,029,519 tris at the gnomon
pose (caps 260 / 1.35 M — headroom kept deliberately; quality before
quantity). Headed frame gate at the densest pose (gnomon): median
16.7 ms at scale 1.00 — under the 16.9 ms gate. Stillness gates
(the Under-Blue, the mid-glide hush, the Fallen King hollow) tested
empty in `tests/regionBlue1.test.ts`; reroll fence pins (landmarks,
the Ferryman, the deep-step arcs) byte-identical throughout.

**Canonical capture roster** (`visual-qa/`, all looked at): authored +
close `20260801-0128_*_bl-filled` (18 poses — the twelve plains-final
poses, `wayline-walk`/`ferryman-crossing`, and the four close plants);
sweep `20260801-0246_SWEEP-*_bl-filled` (12); noassets
`20260801-0328_*_bl-filled-noassets` (18 — all painted fill present
without GLBs; only the Ferryman's asset absent from its pose, as
expected). Round history: `bl-fill-r1` (1533/1635/1707 authored +
1810 sweep), `bl-fill-r2` (1946 + 0055 recaptures + 2322 sweep).

**Gates at close**: typecheck clean; eslint zero warnings; the four
targeted suites 121/121; the full run 786/787 — the ONE failure is
`tests/regionSmoking1.test.ts` "keeps the fill's instances inside the
domain", the smoking-marches-1 lane's own containment spec, VERIFIED
pre-existing at this branch's base (fails identically at the commit
before the first fill commit; the connective-2 close-out had already
flagged the same lane at base 95c99d9). Not this region's file scope;
left for the smoulder lane.
