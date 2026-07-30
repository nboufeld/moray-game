# Fill plan — pale-passage-1 (The Bone Meadows)

Phase 1 planning document, written against the `bone-final` capture set
(worktree `pale1`, `visual-qa/20260729-1929_*_REGION-pale-passage-1-*_bone-final.png`),
`src/world/regions/pale1/**` and `docs/region-ledger/pale-passage-1.md`.
Governed by docs/FILL-DOCTRINE.md. The white half's emptiness is COMPOSED
restraint — this plan fills it with fine-grained texture density and layered
distance, never clutter; the coloured half (Blooming Shelf, Seed Grove) goes
genuinely lush by contrast.

## 1. Current-state audit

Per pose (all cites `20260729-1929_seed1_hi_REGION-pale-passage-1-<pose>_bone-final.png`):

- **ravine-descent** — FAILS the three-layer law. One slab and one sub-pixel
  skeleton mid-frame; foreground and both walls are unbroken fbm ground.
  The walls read warm tan, not chalk, and the channel floor carries zero
  cover state. Gradient-and-sand frame, the doctrine's named failure.
- **chalk-stairs** — one bone tree (bottom-left), one slab, bare walls.
  The "stacked plate" silhouette does not read: the benches are smooth
  banks; the strata paint bands are invisible at this range. No foreground
  interest right of the tree.
- **lip-reveal** — the far silhouette band (bone forest breaching the milk)
  is the region's best mark. But foreground is bare tan sand + one slab;
  middle ground empty. Layers 2–3 present, layer 1 absent.
- **bone-forest** — thickets layer into the fog well (good T3). Foreground:
  a ~15 m sweep of bare tan/violet ground, no gravel, no shards, no stars
  in frame. Tree feet meet the sand with contact shade only — no root
  litter, so they read placed, not grown.
- **bone-cathedral** — the cathedral reads as one more thicket with girth;
  its hummock is bare. Nothing between camera and subject (18 m of sand).
- **quiet-gallery** — the monuments read as smooth balloons: the furrow
  geometry and violet furrow bake do not survive to this distance/value.
  The pan reads warm beige, not `GALLERY_WHITE`. Two boulders, empty table.
  (Austerity is authored here — the fix is value and monument surface, not
  props.)
- **blush-arch** — arch and crown buds read; the ground "freckles" read as
  muddy pink smears (the two-scale freckle drawing lands as one soft
  stain); loose petals near the lens read as large pink polygons (petal
  card seen close, un-thinned). Left skeleton reads flat lilac.
- **gardener** — the shell reads as a pale balloon; sprigs read but legs
  vanish against the ground; the whole midground of its round is bare
  mauve with mud-rose smears. One brown tube skeleton crops left — good
  repoussoir instinct, needs company.
- **blooming-shelf** — the "young gardens at full colour" read as scattered
  twigs: branch capsules 1–3 m apart, one maroon-rose brain (still liver-
  leaning), no fans legible, wide empty channel through frame centre. The
  shoal is not in frame at the settle. Density is a third of what the
  story needs.
- **seed-grove** — the mother reads (rose pagoda, gold crown, light pool
  work). The bowl is the emptiness problem inverted: huge smooth rose-
  violet gradients with six visible sprigs. The nursery "double hedges"
  still do not read as rows — maybe 8 juveniles visible, unaligned to the
  eye.
- **mother-crown** — plates fill the frame as flat poster magenta; the
  underside carries no growth-line paint, so the region's hero close-up is
  its flattest surface.
- **white-lookback** — horizon story reads (snags → arch → blush). Petal
  current reads as ~12 pink flecks, not a river. Lower half of frame: bare
  mottled tan/mauve/rose ground, the widest accidental bare ground in the
  set.

**Global finding:** the near-field ground reads warm beige in every pose —
the chalk story lives only in the mid-distance fog band. `bakePalePaint`
wins at the vertex scale but the wash grain dominates within ~8 m, and no
T1/T2 vocabulary exists anywhere: the region has zero ground-cover
instances. Three-layer law fails in the foreground of 10 of 12 poses.

**Bare road stretches (from the layout tables in `PaleTerrain.ts` /
`PaleBones.ts`):**

- u 48–84 (ravine mouth): gate jambs only; walls and floor bare for 36 m.
- u 84–266 (the stairs run): 8 lone slabs + 3 small skeletons ≈ one object
  per 26 m, each a single mesh with nothing at its foot; the channel floor
  is bare its whole length; wall benches carry no scree.
- u 266–296 (lip → treeline): overlook slab, then nothing until the
  outriders at u 316/329.
- The forest aisle (`aisleAt`, u 296–470, ±5 m held clear): deliberately
  open — but its *edges* carry nothing below tree scale.
- u 330–360 toward the gallery: two threshold slabs across 30 m.
- u 400–500 blush band between skeletons/arch/gardener: bud drifts only,
  and they read as stains, not drawing.
- Shelf → grove channel, (525,−48) → (558,38), ~95 m: effectively empty
  until the nursery starts 11 m from grove centre.

## 2. Journey map

**Spine** (the story road): wing seam u 48 → Ravine Gate (55) → Chalk
Stairs (84–255) → Saddle Lip (266) → outriders (316/329) → forest aisle →
Bone Cathedral spur (352,−34) → Blush skeletons (448/463) → Blush Arch
(456,−7) → Gardener's Round (492,26) → Blooming Shelf beds (518–545,−45…−62)
→ grove rim (540,28) → Mother-Coral (558,38).

**Reveal cadence, tightened to 20–40 m** (new stations marked ●):

| u (spine) | beat |
|---|---|
| 55 | Ravine Gate jambs (exists) |
| ● 72 | first bone-gravel run in the channel + wall plate ledge |
| 84–255 | stairs slabs (exist) — each gains a scree apron + a shard drift between pairs, so the gap between beats falls from 26 m to ~13 m |
| 118/172/226 | lone skeletons (exist) — each gains root litter + 1–2 perched bone stars |
| ● 145 | chalk dust bloom (drifting motes column) — the hush's one movement |
| ● 200 | strata ledge overhang (wall becomes architecture at the climb's start) |
| 261–266 | overlook slab + lip (exists) |
| ● 282 | descent shard-field: broken plates fanned downslope, pointing at the forest |
| 316/329 | outriders (exist) + gravel shadows at their feet |
| 352 | Cathedral (exists) + ● ossuary floor: a 10 m vertebra/branch litter carpet under its crown |
| ● 390 | aisle edge: first blush-veined gravel (recovery 0.1 rising) |
| 425 | ● life crossing: hush-fry shoal crosses the aisle (see §5) |
| 448/456/463 | blush skeletons + arch (exist), bud garlands added |
| 492 | Gardener (exists) + planted sprig trail behind its circuit |
| ● 508 | first full-colour bed on the road itself (pioneer cluster) |
| 518–545 | shelf beds (exist, densified 3×) |
| ● 548 | grove rim gate: two nursery hedge-ends frame the bowl entry |
| 558 | Mother-Coral (exists) |

**Side loops:** the Quiet Gallery loop (spine u 360 → pan (385,78) → rejoin
at 410 — threshold slabs become a marked path of paired plates every 15 m);
the Cathedral spur; the shelf garden circuit (three beds walked as a ring);
the white-lookback overlook on the grove rim (540,28).

**Rest points (composed bare ground, kept deliberately):** the Quiet
Gallery pan itself; the ravine hush u 130–210 channel floor (gravel runs
stop, dust bloom carries it); the saddle lip crest; the mother's light
pool. These are named stillness — everything else bare is accidental and
gets a cover state.

## 3. Zone density table

Budget: currently **59 draws / 233,235 tris** (ledger). Doctrine caps
**≤160 draws / ≤450k tris** → headroom ≈ +100 draws / +215k tris. Plan
spends ≈ +45 draws / +150k tris, leaving margin. Everything repeated is
instanced; new streams are fresh `SEED ^` substreams drawn *after* all
existing draws (reroll fence).

| zone | T1 ground cover | T2 understory | T3 verticals | T4 ambient life | T5 events |
|---|---|---|---|---|---|
| Chalk Ravine (u 48–292) | bone-gravel runs: 2,500–3,500 inst (1 draw, ~8 tris ea); chalk shard drifts 600–900 (1 draw) | wall plate-scree aprons 120–180 slabs (1 instanced draw); strata ledges ×3 merged (1 draw) | exists (jambs, stairs, skeletons) + 2 ledge overhangs | chalk dust bloom ×2 (1 Points draw); hush-fry shoal passes (shared draw §5) | gate framing, lip reveal (exist); dust column at u 145 |
| Bone Forest | ossuary litter: vertebrae/branch shards 3,000–4,000 (1–2 draws, 6–10 tris ea), gated to recovery < 0.3; existing white stars ×4 → 10 | root litter mounds at every tree foot (instanced with litter); low bone stumps 60–90 (1 draw) | exists (44 trees + cathedral) | perched bone brittle-stars 40–60 on trunks (1 draw); milk dust (exists) | cathedral ossuary floor; aisle life crossing |
| Quiet Gallery | NONE — composed stillness. Pan paint reworked toward true `GALLERY_WHITE` (see §7) | 2 threshold plate pairs per 15 m along the loop only | monuments (exist; surface rework §7) | milk column dust only | the avenue itself |
| First Blush (u 400–500) | blush gravel: bone gravel with pink/gold tips 1,500–2,200 (shares gravel draw, tinted); freckle bake redrawn (§7) | bud garlands on both skeletons + arch (exists, +rope clusters 8–12 merged) | exists | petal current (exists); bud-fly midges 60 (1 Points draw) | arch doorway; Gardener trail |
| Blooming Shelf | rose-gold turf tufts 1,800–2,600 (1 draw, kit grass card); gravel fades out | garden pieces ×3 current count: sites 30 → 55, pieces cap 6 → 9 (same 6 instanced draws); rubble at bed feet 300 (1 draw) | fan count forced ≥ 2 per bed; 3 tall staghorns as bed landmarks | darter shoal (exists, +escort split §5); grazing stars 22 → 40 | three authored beds (exist, densified); pioneer bed at u 508 |
| Seed Grove | bowl turf carpet 1,200–1,600 dense at rim, thinning to bare heart (the pool stays clean) | nursery rows: seats 10 → 16 per line, scale floor +20%, aligned jitter 0.35 → 0.2 | mother (exists; plate underside paint §7) | petal current birth + eddies; nursery midges | mother + pool (exist); rim gate hedges |

Tri arithmetic: gravel/litter ≈ 8k × 8 = 64k; turf/tufts ≈ 5.5k × 10 = 55k;
scree/stumps/ledges ≈ 15k; garden densification ≈ +25k; garlands/misc ≈ 8k.
**≈ +167k tris, +18–22 draws** → totals ≈ 400k / ~80 draws. Inside caps;
state honestly in the ledger with measured numbers.

## 4. Light plan — warm paper-light

The white half must read as *paper held to a lamp*, not dusk. Keep the
round-4 flat violet light, but:

- **Warm the milk's floor**: fog colorScale red 3.6 stays; add a low warm
  god-ray pair over the Chalk Stairs (u 150 & 210, opacity ≤ 0.08, the
  existing milk sprite warmed toward `BONE_WARM`) so the hush has light
  events, not gloom. Ravine walls catch a baked top-light band (strata
  paint value +0.06 on upward faces) — paper lit from above.
- **The gallery column stays the white half's one radiance**; widen its
  pool: a faint ground pool disc (existing pool builder, neutral white,
  opacity 0.12) so the column lands on something.
- **Blush band**: one new warm blade at the two budded skeletons (shared
  SHAFTS table entries), and the arch blade widened 2.6 → 3.4 — the
  doorway into colour should glow.
- **Grove**: exists and works (pool + falls). Add two petal-lit micro
  pools under the densest nursery rows (opacity 0.08) so the rows read at
  the seed-grove pose's 25 m.
- **Dapple**: no caustics sheets here (the milk argues with focused
  dapple); the paper-light reads through value, not marks. Preserve.

## 5. Life system plan

- **Shoal network (life as wayfinding):** one new **hush-fry** shoal
  (~40 inst, bone-pale `0xe8e6da`, value a breath above the milk, tiny) that
  travels a closed loop: ravine mouth → lip → forest aisle → gallery edge →
  back. It crosses the aisle at u 425 and the lip at 266 — meeting it
  head-on tells the diver the road. Deliberately colourless: the white
  half's life is quiet. The **blush darters** (exist) gain a 12-fish escort
  split that detaches to circle the Gardener each lap — connecting the two
  coloured landmarks.
- **Small fauna per surface:** bone trees — perched brittle-stars (T4
  above); chalk walls — limpet dots baked into scree tint (no draw);
  sand — floor stars thickened along recovery (26 → 50 total); gardens —
  grazing stars + bud-fly midges; grove — nursery midges. Every surface
  type owns one small liver.
- **Drifters:** milk dust (exists) + two chalk dust blooms (ravine u 145,
  gallery column) + petal stream (exists).
- **Centrepiece + satellites:** the **petal current** stays the region
  centrepiece; satellites: a petal eddy at the Blush Arch crown (20
  petals on a tight local loop through the doorway) and one at the grove
  rim gate. The **Gardener** is the second mover; give it a *sprig trail* —
  6 planted juveniles along its circuit's outer edge, its work made
  visible.
- **Preserved stillness zones (named, no life added):** THE QUIET GALLERY
  (monuments, milk column, nothing moves but dust); THE RAVINE HUSH
  (u 130–210); THE MOTHER'S POOL (the bowl heart under the crown — petals
  are born above it, nothing swims through it).

## 6. Asset needs

**(a) KIT** (shared `src/world/regions/kit/` builders, parameterised):
- ground-cover carpet builder (gravel/shard/turf-tuft cards; palette,
  density, gating callback) — needed by every region this round.
- scree/rubble apron builder (slab family seated against a wall or foot).
- percher colony builder (small instanced fauna seated on parent
  transforms).
- particulate column builder (the dust bloom; the canyon light-column
  disciplines baked in).

**(b) EXCLUSIVE signatures (2–4, the things you only see here):**
1. **Bone-shard ossuary carpet** — vertebra/branch-fragment gravel with the
   violet-crotch → paper-tip ramp; the white half's entire T1 voice.
2. **Chalk strata ledge** — the stacked-plate wall piece (ravine
   architecture; silhouette before paint).
3. **Blush garland** — a budding rope that climbs skeletons and the arch,
   pink/gold buds on a pale cord (replaces loose-box buds as the blush's
   drawing).
4. **Porcelain brittle-star** — the bone-white percher (white half) with a
   rose variant (shelf) — one geometry, two tints.

**(c) REUSE:** coral kit kinds + `recoveryTint` (gardens, nursery);
`RockShapes` slabs (scree, ledges); `starGeometry` (grazing stars);
milk-dust/pool/shaft sprites (PaleLight/PaleLife); fan texture; the
Gardener body.

## 7. Rework checklist (ordered, file-level)

1. `PaleGround.ts` — foreground chalk fix: raise near-field white (the
   1.16 ride → keyed up where `recovery < 0.15`), redraw blush freckles as
   two *separated* scales (stain + dot pass), pull `GALLERY_WHITE` further
   from the wash mean; verify with image-stats on the gallery pan pose.
2. `PaleBones.ts` — monument surface: deepen furrow cuts (0.09 → 0.14) and
   re-bake furrow violet at higher contrast; add strata-ledge pieces and
   scree aprons (new substreams after existing draws); ossuary litter +
   root litter instancing; bud garlands replace the loose crown-box spots.
3. `PaleBloom.ts` — shelf densification (sites 30 → 55, pieces cap 9, fans
   forced ≥ 2/bed); nursery rows 10 → 16 seats, tighter jitter, +20% scale
   floor; mother plate undersides get growth-line bake (rose-deep radial
   rings) for the mother-crown pose.
4. NEW `PaleCarpet.ts` — gravel/shard/turf T1 module (kit consumer), gated
   on `recovery` + biome weights; contact-free (no colliders, no contacts —
   ankle height).
5. `PaleLife.ts` — hush-fry loop, darter escort split, petal eddies, midges,
   star count up, dust blooms.
6. `PaleLight.ts` — stairs god-ray pair, arch blade widening, gallery
   ground pool, nursery micro-pools.
7. `Pale1.ts` — wire new module; add 2 capture poses (`ravine-hush` at
   u 150 looking at the dust column; `ossuary-floor` low at the cathedral
   foot) — append after existing poses so archives stay comparable.
8. Tests (`tests/regionPale1.test.ts`) — honest updates: raise the budget
   caps to the doctrine's 160/450k and assert the *measured* new totals;
   add reroll-fence pins (first/last existing tree spot, monument matrix,
   first bud) before adding streams; add carpet gating cases (no T1 inside
   the gallery weight > 0.4, none in the mother's pool disc, aisle centre
   ±2.5 m stays clear); density floors (≥ N gravel inside the ravine
   channel band, ≥ 2 fans per authored bed). Update the pose-count case.
9. Capture ritual — full set + RANDOM-pose sweep (Phase 3 gate), no-assets
   set (region is fully procedural; should be free), same-session control.

## 8. Coherence notes

- **Ghost-reef wing handshake:** the wing's own recovery ramp
  (`GhostReef.ts` `recoveryAt`) runs bone at its gate → colour by r 46.5 —
  i.e. the wing hands the diver *returning colour* exactly where the
  region's ravine restarts at recovery 0 (Wave 8 flagged this from the
  wing side). Plan: a **false-spring beat** at the ravine mouth — the first
  20 m (u 48–68) carries a dying trace of blush gravel and one budded
  jamb, fading into the hush by u 70. Story: colour tried to follow the
  diver in and failed; the hush earns its white. Wing geometry is frozen;
  its palette owner should also be asked to cool the near-gate stands
  (their flag, their call). Also: nothing new inside r 50 (wing carve) and
  nothing near the pearl moray's den corridor (`WingDens.ts`, ghost-reef
  r 41) — the seam tongue's first metres stay exactly as sealed.
- **Open-blue wing / mythics:** no shared border. Obligation is negative:
  the petal current, hush-fry and dust never leave `paleWeight > 0`, so
  nothing of this region can drift into the Open Blue's composed emptiness
  where The Old Current and The Gentle Dark keep their stage.
- **Kit coherence:** carpets, scree and perchers ship as kit pieces with
  this region's palettes as parameters — great-blue-1's plan consumes the
  same builders (grass cards, scree, percher) with its own tints.
- **Streamer QA flag** (ledger): `RegionStreamer.force()` pin is still a
  sanctioned framework touch; the new capture poses inherit it.
