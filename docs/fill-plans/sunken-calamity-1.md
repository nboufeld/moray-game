# Fill plan — sunken-calamity-1 (The Sunken Calamity)

Phase 1 plan under `docs/FILL-DOCTRINE.md`, applied to the region built in
`src/world/regions/calamity1/` and judged from the TRUSTWORTHY verify set
(`visual-qa/20260729-2122_seed1_hi_REGION-sunken-calamity-1-<pose>_verify.png`,
cited by pose; the `calamity-final` set photographed the wrong build and is
ignored). The mood thesis governs every line here: **ruin-density and
wrong-regrowth — density without breaking grief.** The fill is more
*story*, not more *stuff*: the catastrophe says "ten thousand stones" and
the region currently shows about forty. Budgets against the doctrine's
raised caps: **≤ 160 draws / ≤ 450k tris** (currently 78 / 210.6k).

## 1. Current-state audit

Per pose, against the three-layer law:

| Pose (PNG) | FG | Mid | Dist | Verdict |
|---|---|---|---|---|
| sorrow-gate | ✗ bare banks | ~ 3 drums + 2 teeth | ~ terrace ghosts | The 490 m march opens on empty gold-green slopes. |
| first-dead | ✗ bare | ✓ the grey giant + one slab | ~ | The annunciation lands; its road is bare on both banks. |
| shock-rings | ~ rings faint underfoot | ✓ two bank teeth | ~ | Rings read only in the lowest quarter; troughs carry nothing. |
| the-gardener | ✗ right bank is 50 % of frame, bare | ✓ statue | ✓ cards | The saddest object in the march lies beside an untouched dune. |
| card-house | ✗ | ✓ 3 mossy slabs | ~ | Slabs lean well; the "house" is three cards, and the far bank is naked. |
| suffocated-mile | ✗ bare violet mile | ✗ amphorae read as pebbles | ~ | The Ghost Traps fail their read at pose range — too small, too few in frame. |
| wound-gate | ✗ 60 % of frame is one bare bank | ✓ overhead giant + arch | ✓ | The pinch composes; the ground under it is untouched. |
| the-reveal | ✗ bare crest shelf | ✓ causeway + ghost ranks | ✓ | The breath works at the fog line; nothing near the feet. |
| shatterfield | ✗ big bare foreground | ✓ slabs + ranks | ✓ | Twelve slabs where the story says pavement-country. |
| ghost-forest | ✗ floor is clean warm sand | ✓ raked giants | ✓ | A dead forest with a swept floor — no fallen straps, no ash litter. |
| the-wound | ~ watcher repoussoir | ✓ plume, gyre, terraces | ✓ | Passes best; the near ledge still bare. |
| cold-candle | ✓ worms, throats | ✓ plume + gyre | ✓ | The set's one fully doctrine-passing frame. |
| seep-gardens | ~ worm fountains | ✓ | ~ | Crowns finally spend red; ground between trunks bare, mats not reading in frame. |
| last-grove | ✗ hollow floor mostly empty | ~ scattered plants | ✓ | "Green defiance" reads as a thin plantation, not a kept grove. |
| the-shrine | ✓ pile + curator + green | ✓ trunk repoussoir | ✓ | The region's thesis frame — passes. |
| quiet-rim | ✗ ~70 % bare sand | ✓ two stacks | ✓ | Composed rest is allowed; 100 m of it is not. |

Cross-cutting finding: in the verify frames the near-field floor still
reads **warm beach-tan** under the grey-teal water (sorrow-gate,
ghost-forest, quiet-rim) despite the ledger's round-3 red cut. Do not
fight the wash a fourth time — *cover* it: T1 debris and ash-lap carpets
reduce bare wash area to composed rests only.

**Road walk** (from `CalamityTerrain.ts` / `CalamityRubble.ts` tables),
march u 48–530 (~490 m): drums u 62–88 → First Dead One 168 → 8 thrown
stones (radial pointers) → shock rings 200–320 (terrain bands + 12 bank
teeth alternating the whole march) → Gardener 252 → Card House 315–345
(5 slabs) → 14 amphorae 352–440 → Wound Gate 466 → causeway 498–570
(12 slabs). Arithmetic: ~55 authored objects over 490 m ≈ one per 9 m of
*spine* — but they are points in a 16–38 m wide corridor whose floor and
banks are 100 % bare; laterally the road fails everywhere. Bare
stretches: u 90–160 (nothing between drums and First Dead), 168–200,
every bank face the whole way, the crest shelf 470–498, the Ghost
Forest floor, the Wound's upper terraces, the grove hollow's floor, and
the Quiet Rim u 820–905.

## 2. Journey map

**Spine**: sorrow-gate (58) → First Dead One (168) → Shock Rings (250) →
Gardener (252) → Card House (330) → Suffocated Mile (352–440) → Wound
Gate (466) → the reveal crest (477) → Causeway → Great Slab (585) →
Ghost Forest aisle → the Wound's rim (646) → descent to the Cold Candle.
**Side loops**: (a) Seep Gardens loop — rim → gardens (752, +58) → back
along the crater lip; (b) Grove loop — Ghost Forest south eaves → over
the Grove Ridge saddle (742, −48; the ridge crossing is itself a reveal:
green light past a black dike) → Last Grove → shrine → Quiet Rim return;
(c) the Wound descent spiral (terrace by terrace, a vertical loop).
**Rest points** (grief needs rooms): the Gardener's road-shoulder, the
Suffocated Mile's centre (see §5 — still ON PURPOSE), the crest after
the reveal, the grove's inner lawn, the shrine, mid-Quiet-Rim.
**Reveal cadence** (≤ 40 m; ★ new): drums 62–88 → ★fallen lintel + shard
apron 108 → ★half-buried quern & bowls 130 → ★dead sapling pair 148 →
First Dead 168 → ★shell-hash windrow 190 → rings + ★ring-crest paint
bands 200–320 (with Gardener 252) → ★masonry pile 298 → Card House 330 →
★amphora clusters regrown at pot scale 352/375/400/425 (the Mile's only
marks) → gate teeth 445 → Wound Gate 466 → reveal 477 → causeway slabs +
★shard field throughout 498–570 → Great Slab 585 → ★fallen-strap litter
lanes the whole forest → Wound lip watchers 640 → terraces (each its own
reveal) → gardens/grove per loops → ★relic pair on the Quiet Rim 850.

## 3. Zone density table

| Sub-biome | T1 ground cover | T2 understory | T3 verticals | T4 ambient life | T5 events |
|---|---|---|---|---|---|
| Long Sorrow (march) | pavement-shard litter 1500–2200 inst (2); ash-lap drifts 400–700 (1) | relics: querns/bowls/tiles 24–36 (2); masonry piles ×5 (1); bank teeth 12→30 (0); dead scrub stubble 60–90 (1) | dead sapling snags ×6 along banks (0, forest chunks); drums/lintel (0/1) | pallid shoal re-routed down the march (0); silt darts (exist); ash snow (exist) | shock-ring crest bands (0, ground paint); Gardener moss-glimmer (0) |
| Suffocated Mile (u 352–440) | shard litter thins to sparse singles (0) | amphorae 14→22, scaled to pot-read, in 4 clusters (0) | — kept empty | **deliberately near-none** (see §5) | the violet pool itself; one bubble thread ×1 (0, seep idiom) |
| Shatterfield | shard litter densest 800–1200 (0); heaved-flag pavement patches ×8 (1) | slabs 12→20 (0); masonry ×4 (0); pioneer worm singles 10–16 (0, worm draw) | Great Slab (exists); ★2 tilted menhir slabs (0) | shoal crossing point (0); crabs 4 (0) | causeway light blades ×2 (exist) |
| Ghost Forest | fallen-strap straw lanes 600–900 (1–2), raked with the blast; ash-drift pads (0) | stumps 22 (exist); ★root-boss mounds 20–30 (1); scrub 20 (0) | 58 giants + 6 fallen (exist) | pallid shoal aisle leg (exists); ★ash-moth midwater specks 80 pts (1) | cathedral shaft (exists); ★one god-fall break over the aisle (0, SHAFTS row) |
| The Wound | terrace-lip sinter litter (0); ★felt runs down two terraces (0, mats) | thrown stones +8 on upper terraces (0); pioneer worms 20–30 down the wall (0) | Cold Candle + throats (exist) | gyre 64 (centrepiece, exists); crabs 18→36 (0) | plume (exists); ★terrace glow seams ×2 (0, pools idiom) |
| Seep Gardens | white felt mats 26→44, up to 6 m (0); rust apron paint (0) | worms ~150→260 (0); ★bone-coral knuckles 30–50 (1) | worm fountains (exist) | crabs (exist); ★ghost shrimp sparkle 60 pts (1) | ★cold-fire wisps ×5 over lesser seeps (1) |
| Grove Ridge + Last Grove | ★green meadow carpet 700–1100 blades (1); moss boulders paint (0) | grove plants 8→14 + juveniles 20 (0); ★fern rosettes 40–60 (1) | 17 m survivor (exists) | ★grove wrasse pair (1); snail dots on stipes 20 (0); gleam pile (exists) | green-gold fall (exists); ★pollen-mote drift 60 pts (0, ash-snow bias) |
| Quiet Rim | ash-lap drifts sparse (0); ★relic pair + shard whisper (0) | stacks (exist) +2 leaning stones (0) | — | shoal's return leg passes (0) | distance rings (exist) |

**Budget sum**: new draws ≈ 15–18 → **≈ 93–96 of 160**. New triangles:
shard/straw/ash litter ≈ 70k (flat 6–10-tri instances), relics/masonry
≈ 25k, grove meadow + ferns ≈ 25k, worm/mat growth ≈ 15k, life ≈ 10k,
wisps/points ≈ 2k → **≈ 355–360k of 450k**. The ledger's ground-pitch
deviation (2.2–2.5 m/vertex) stands — density comes from instances, not
grid (doctrine's own budget shape).

## 4. Light plan (where the light lives in a dark register)

Mood table (grey-teal 0.66/0.75/0.82, gain 0.0035) is **frozen** — two
rounds bought it. The Calamity's darkness is earned by three contrasts,
each already seeded, each to be *committed*:

1. **The milk-white sky.** backdropFade 0.35 keeps the surface bright
   and moodSurface 14 makes climbing the kindness. Commit it: the Wound's
   open column (ceiling 28) is the one place the diver can rise INTO
   light — add a faint wide brightening card high over the crater (one
   additive quad at y ≈ +16, opacity ≤ 0.06) so looking up from the
   terraces always reads "the sky survived."
2. **Seep-glow (the ground's cold light).** The region's ember-inverse:
   everything that glows is cold and chemical. Grow the glow family:
   cold-fire wisps (EXCLUSIVE — small drifting additive flames,
   blue-white leaning violet, opacity ≤ 0.1) over the five lesser seeps;
   two terrace glow seams inside the Wound (pools idiom, cold tint);
   the plume and Candle throat (exist). Everything cold stays red-LOW
   but never red-zero (the electric-cyan trap).
3. **The grove's green defiance.** The one warm-green light in the
   region (SHAFTS warm row, exists) — extend it: the meadow carpet takes
   a leaf-glow-style tip lift only inside the shaft's footprint, so the
   grove's floor visibly *answers* its light. The shrine gleams stay the
   brightest small thing in the region.
4. **Road light events**: the Wound Gate blade, causeway blades, forest
   cathedral shaft (all exist) + one god-fall break mid-forest and the
   Gardener's moss-glimmer (a hand-sized pale value lift on the statue's
   up-facing moss — paint, not additive). The march otherwise stays the
   darkest road in the game, on purpose; its "light" is the shock-ring
   crest bands — pale sinter paint on the ring crests so the blast
   itself is drawn in value on the floor.

## 5. Life system plan

- **Shoal network**: re-route the pallid shoal (50 silver-ash survivors)
  onto the *spine*: enter at the sorrow-gate, run the march at bank
  height, **detour around the Suffocated Mile over the banks** (they
  will not swim the pool — story and stillness in one path choice),
  rejoin the channel at the Gate, thread the causeway and forest aisle,
  turn at the Wound lip, return via the Quiet Rim. Life as wayfinding:
  following the survivors walks the whole journey map.
- **Small fauna per surface**: sand/shards → white crabs 18→36 (seeps +
  shatterfield singles); dead stipes → snail dots (static instanced
  beads, 20); felt mats → ghost shrimp sparkles (60 additive points);
  wall/terraces → pioneer worm singles (regrowth creeping outward from
  the gardens — the wrong-regrowth story told spatially: densest at the
  seeps, single scouts reaching the causeway).
- **Drifters**: ash snow 700 (exists, region-wide) + ash-moth specks in
  the forest midwater; grove gets a 60-mote pollen bias (warm-white).
- **Centrepiece + satellites**: the crater gyre (64, exists) is the
  centrepiece; its satellites are the plume bubbles, crabs on the
  terraces, and the pioneer worm trail leading INTO the Wound. The
  Curator keeps the grove (resident, exists) — give her two ★hermit
  gleam-crabs hauling single shells toward the pile (tiny, slow,
  instanced pair) as satellites of the shrine.
- **Preserved stillness — the Suffocated Mile stays still ON PURPOSE.**
  This is the plan's explicit grief clause: no shoal, no darts, no
  crabs, ash snow thinned to ~an eighth density between u 352–440, no
  new glow marks. Its fill is four amphora clusters and one bubble
  thread. Anyone auditing "empty" frames later: suffocated-mile is
  *composed* rest — the doctrine's bare-sand allowance spent here, in
  one place, deliberately. Same clause, smaller: the Gardener's ten
  metres of road stay object-free so the statue lies alone.

## 6. Asset needs

- **(a) KIT**: ground-litter scatterer (shards/straw/ash-lap — shared
  with smoking-marches-1's gravel; palette + rake-direction knobs, the
  rake knob is what lets litter point away from the Wound); relic
  scatter set (quern, bowl, tile, drum fragment — one merged family,
  story-neutral shapes other ruins reuse); mat/carpet disc builder
  (shared; here in white felt + rust); path-shoal runner (shared kit
  extraction of the CatmullRom ribbon); sparkle-swarm points; meadow
  blade bank (the bowl blade as a kit builder with palette families).
- **(b) EXCLUSIVE** (2–4 signatures): **pavement-shard litter in blast
  alignment** (the ten-thousand-stones carpet, radially raked — the
  region's fingerprint); **ash-bloom** (pale grey-lavender ground
  flower that only opens within 25 m of seeps/grove — wrong-regrowth
  made visible); **cold-fire wisp** (drifting chemical flame, cold
  violet-white — nothing else in the game may burn cold); **hermit
  gleam-crabs** (the shrine's tiny pilgrims).
- **(c) REUSE**: dead-forest strap geometry (fallen-strap straw is the
  existing strap flattened to the floor); RockShapes slabs/stacks;
  seep-bubble jet (exists here, lending to the Smoulder's geyser);
  cushion star/urchin idioms (already bone-repainted); grove straps
  (pilot idiom, exists); DistantReef cards.

## 7. Rework checklist (ordered)

1. `src/world/regions/kit/` — litter scatterer with rake knob, relic
   family, mat builder, shoal runner, meadow bank (Phase 2 gate; demo
   captures per piece).
2. `CalamityRubble.ts` — teeth 12→30, slabs 12→20, masonry piles,
   relics, heaved-flag patches, menhir pair, lintel, Quiet Rim relic
   pair; amphorae 14→22 in four clusters at pot-read scale (audit: they
   read as pebbles at suffocated-mile's own pose — size against that
   camera, the round-3 lesson).
3. New `CalamityLitter.ts` — T1: pavement-shard carpets (march +
   shatterfield densities), ash-lap drifts, fallen-strap straw lanes
   (rake = away from WOUND), shock-ring crest band paint hook into
   `CalamityGround` contacts.
4. `CalamityForest.ts` — root-boss mounds, 6 bank snags up the march,
   grove plants 8→14 + 20 juveniles, fern rosettes, snail beads.
5. New grove meadow in `CalamityForest.ts` or `CalamityLitter.ts` —
   green blade carpet gated on `groveWeight`, tip-glow inside the warm
   shaft's footprint.
6. `CalamitySeeps.ts` — mats 26→44, worms ~150→260 + pioneer singles
   walking the Wound wall and causeway, bone-coral knuckles.
7. `CalamityLife.ts` — pallid shoal re-path (spine + Mile detour), ash
   snow density mask (Mile eighth-density), ash-moths, ghost shrimp,
   crabs 18→36, hermit gleam-crabs, pollen bias in the grove.
8. `CalamityLight.ts` — cold-fire wisps, terrace glow seams, forest
   god-fall row, crater sky card; verify additive sums at cold-candle
   and the-shrine poses first.
9. `Calamity1.ts` — wire new modules; add 2 poses over former bare
   stretches (mid-march u 120 looking down-road; grove lawn looking up
   the survivor). Update the Mile pose note to name the stillness
   clause.
10. `tests/regionCalamity1.test.ts` — caps to 160/450k measured; new
    contracts: litter stays inside domain and OFF the channel spine's
    swim line, rake orientation test (sample shard yaws, assert radial
    alignment away from WOUND ± tolerance), Mile stillness (no T4
    instance and ≤ threshold ash-snow bases in u 352–440), shoal path
    clears colliders/ceiling, grove meadow only where groveWeight > 0.
11. Phase-3 verification: full pose set + RANDOM-pose sweep + noassets
    build (all new marks procedural — keep it that way), and re-check
    the synchronous `build()` hitch (~2.1 s; litter adds bake time —
    if it crosses ~3 s, flag for the amortised-build candidate the
    ledger already names).

## 8. Coherence notes

- **Ruins-terrace wing (gateway, azimuth 4.59)**: the wing is the
  intact civilisation the Calamity is the ruin OF. Handshake: the
  relic family (quern/bowl/tile/drum) must be drawn from the wing's own
  architectural vocabulary — same drum radius, same tile profile — so a
  player who has seen the terrace recognises the wreckage. The shard
  litter starts at the seam at near-zero density and thickens over the
  first 30 m (gradient transitions); the wing keeps its gold water and
  the march's grey arrives exactly as the mood descent already stages it.
- **Vent-springs wing / smoking-marches sibling**: no border; shared
  logic only. Both dark registers carry ground-borne light — keep the
  registers distinct: Smoulder light is warm and rising (embers,
  shimmer), Calamity light is cold and settling (wisps, seep-glow,
  falling ash). The kit litter scatterer serves both with different
  palettes and the rake knob unique in use here.
- **Future province siblings**: the invented catastrophe is province
  lore — a second Calamity region (e.g. the drowned town proper) reuses
  the relic family and shard carpets at *higher* architectural order
  (walls, streets) and claims its own exclusives; the blast-rake
  direction must stay globally consistent (away from WOUND at (700,0)
  in this spoke frame) across any sibling that shows thrown material.
- **Grief coherence**: every density increase above was checked against
  the region's emotion line ("a ruin with a pulse") — debris reads as
  story, regrowth reads as wrong, and the two stillness clauses (§5)
  are the contrast that keeps it grief and not a junkyard. If a future
  pass finds the march "too full", thin T2 relics before touching the
  T1 carpets: bare wash is the failure mode, story-litter is not.
