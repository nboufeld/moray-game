# Fill plan — golden-waste-1 (The Hourglass Sea)

Phase 1 planning per docs/FILL-DOCTRINE.md. **This plan is written against a
moving target**: the region is still in flight in `worktrees/golden1` (round 4
captures landed twice tonight, 0023 and 0241, and the worker's ledger closes at
"fixes for round 4"). Every audit claim below cites an r4 frame; the rework
checklist MUST be re-based on the worker's *final* state and final capture tag
before any Phase 3 edit is made. Nothing in the worktree may be touched until
the worker closes.

## 1. Current-state audit (r4 captures, visual-qa in the worktree)

The bones compose; the space between them defaults to bare ground — the
owner's verdict, frame by frame:

- `20260730-0241_..._saddle-reveal_hourglass-r4.png` — the lip's crescent
  skyline and a reveal-beam read; the foreground is ~70% of frame and is one
  uninterrupted gold-to-violet gradient with a single boulder at frame-left
  and three grass sprigs. No T1, no T2, nothing inside 8 m. This is the
  doctrine's failing random frame, taken at an *authored* pose.
- `20260730-0241_..._dune-ocean_hourglass-r4.png` — the slip-face shoal
  ribbon is alive and gold (good T4); the dune it surfs and every dune behind
  it is bare value-mush; no ripple grain, no drift lines, no lee-garden.
- `20260730-0241_..._hourglass-lip_hourglass-r4.png` — the region's best
  frame: bowl, benches, two visible fall veils, violet ledges, monolith
  skyline. Still: the near ground (bottom third) is bare, and only ~2 of the
  twelve falls read at this angle — the ring under-advertises itself.
- `20260730-0241_..._keeper-deep_hourglass-r4.png` — the Keeper reads
  (right mid-frame) but the chasm walls are a single smooth value from lip to
  floor; the terraces vanish at this range; the rim monolith picket still has
  a faint chimney read. The deep needs its own light marks, not more paint
  contrast alone.
- `20260730-0023_..._singing-flats_hourglass-r4.png` — monoliths and their
  skyline compose; painted shadows exist but read faint; the plain carries
  ~8 grass blades and nothing else. "Ripple-plain" is currently a caption,
  not a picture.
- `20260730-0023_..._oasis_hourglass-r4.png` — the region's densest frame
  and the only one near passing: palms, grass, green-gold water. Even here
  the mid-ground between palm and rim is flat, and there is one flora idiom
  (blade) at one scale.
- `20260730-0241_..._glass-reach_hourglass-r4.png` — fins + Fused Arch
  compose and the glint sparks read; the trench floor and the approach sand
  are bare; the fins spring from nothing (no shard aprons, no fracture
  ground).
- `20260730-0023_..._ray-crossing_hourglass-r4.png` — the caravan finally
  crosses in frame (wing-tips on the horizon, correct scale); the flat
  distance block at frame-right still reads mesa-flat (ring swell variance
  is on the r4 fix list — verify against final captures).

Summary: T3/T5 (verticals, events) are largely done and good; T4 exists in
three strong systems; **T1 and T2 are near-absent everywhere**, and the light
plan is concentrated in four spots with nothing on the roads. Budget headroom
is huge: r1 measured 46 draws / 131.7k tris against the doctrine's 160 / 450k.

## 2. Journey map (a reveal every 20–40 m)

Spine: wing doorway (u 48) → saddle → lip (u 268) → Dune Ocean spine (u 306)
→ Hourglass lip (u ~405) → flats fork. Side loops: Glass Reach (west), Oasis
Hollows (south-east), Singing Flats → ray circuit (north-east), Gilded Shore
(far east). Named beats, spaced 20–40 m along the swim path:

| u (spine) | Beat |
|---|---|
| 48–60 | Honey Gate jambs + gate-veil handshake (wing's falls visible behind) |
| ~80 | Vale Fall 1 + first duneling lee-garden (T2 debut) |
| ~105 | Boulder trio with pebble apron; ripple-shadow carpet begins |
| ~130 | Drift-line 1: wrack + shell run angled across the channel |
| ~146 | Vale Fall 2 + first crescent (existing pose) + traveller-shoal crossing |
| ~175 | Garden-eel outpost (a *taste* of the flats, 20 eels) |
| ~200 | Vale Fall 3 + glass glint far-tease (one spark over the wall) |
| ~230 | Overlook slab foreshadow; channel narrows; grass banks both shoulders |
| 252–268 | THE LIP: ranked crescents, reveal beam, ribbons smoking |
| 306+ | Dune Ocean rhythm: every crest/trough (~35 m wavelength) alternates a lee-garden trough / bare composed crest / drift-line trough — the road IS the rhythm |
| forks | each fork marked by life: eel colony toward flats, glint spark toward glass, palm silhouette toward oasis, fall-mist column toward Hourglass |

Rest points (doctrine's stillness check, named): **The Empty Quarter** — one
deliberately bare dune passage between Dune Ocean and Gilded Shore, composed
as rest (no T2/T4, full ripple T1 paint only); **The Drain's Eye** — the
Hourglass floor centre, still, one shaft of falling light, the Keeper's
circle the only motion.

## 3. Zone density table (five tiers per sub-biome)

Desert fill is rhythm and fine grain, not clutter: T1 carries vastness, T2 is
sparse-but-authored, T3 stays as built.

| Sub-biome | T1 ground cover | T2 understory | T3 verticals | T4 ambient life | T5 events |
|---|---|---|---|---|---|
| Dune Saddle | ripple-shadow paint + pebble runs (1.2k inst) | duneling tufts 400, wrack 80 | 3 vale falls, jambs (built) | motes, traveller shoal | lip reveal, 3 falls, glint tease |
| Dune Ocean | ripple carpet + crest shell-lines (3k inst) | lee-gardens 500 tufts, drift-lines 200 wrack | crescent ribbons (built) | slip-face shoal, veils | Empty Quarter (rest), crest smoke |
| Hourglass | terrace-tread pebble fringes (600) | terrace salt-lilies 220 | 12 falls, monolith rim (built) | Keeper + remora satellites | light column, fall ring, Drain's Eye |
| Glass Reach | shard-grit fields (1.5k), fracture paint | sand-rose clusters 60, shard aprons 300 | fins + arch (built) | glint sparks (built), shard shimmer | arch swim-through, spark bursts |
| Oasis Hollows | dense gold-grass rings (existing, +50%) | cushion bushes 120, fallen fronds 60 | 8 palms (built) | damsel cloud, eel fringe | oasis glimmers (built) |
| Singing Flats | RIPPLE FIELD proper (paint + 2k grit) | scattered singing stones 90 | 5 monoliths (built) | 7 eel colonies (~400), ray caravan | monolith shadow-play, eel wave |
| Gilded Shore | shelf pebble drift (800) | shore wrack 120, tufts 300 | 2 stacks (built) | shore eel outpost, drifters | stacked distance lines, pass-tease to depth 2 |

Budget arithmetic (additions over the r1-measured 46 draws / 131,662 tris):

| Layer | draws | tris |
|---|---|---|
| pebble/shell/grit carpets (3 kit kinds, instanced) | 3 | ~70k |
| duneling tuft banks (2 palettes) | 2 | ~55k |
| wrack + drift debris | 1 | ~20k |
| shard aprons + sand-roses (glass) | 2 | ~15k |
| terrace salt-lilies + oasis bushes | 2 | ~25k |
| eel colony expansion (150→~400) | 0 (same draw) | ~10k |
| satellites: remoras, damsel cloud, traveller shoal | 3 | ~8k |
| gold dapple sheet + 2 road light events | 3 | ~2k |
| distance ring variance + 1 far layer | 1 | ~3k |
| **Total planned** | **63 draws** | **~340k tris** |

Both under the caps (160 / 450k) with ~35% headroom for the worker's r4+
drift. `tests/regionGolden1.test.ts` cap assertions must be re-read after
rebase — the r4 rounds have been adding falls and boulders.

Grid honesty rule (the canyon's Nyquist lesson): the disc runs ~2.2 m/vertex,
so **no painted vertex-colour ripple finer than ~8 m wavelength**; the fine
ripple grain (0.3–1.5 m) must come from the sand wash texture and the T1 grit
instances, never from the sheet.

## 4. Light plan

- **Gold dapple**: the bowl's caustic-dapple idiom recolored honey
  (R−B over-mixed per the sRGB-on-sand lesson), laid over the saddle channel,
  oasis bowls and flats — the desert currently has *no* dapple and it is the
  cheapest "sunlit" signal in the project. One sheet, ~0 tris, 1–2 draws.
- **The Hourglass falling-light column** (built): keep; add 2–3 faint
  secondary blades between falls so the ring advertises at more azimuths, and
  a cool pool at the Drain's Eye so the column lands on something (the
  beam-that-brightens-nothing-is-a-decal rule).
- **Glass glints** (built): add slow phase drift so a standing diver sees the
  field breathe; one glint tease visible from the saddle (u ~200).
- **Monolith shadow-play**: the painted violet shadows get a companion — a
  warm rim-band on each monolith's sun side (vertex paint, free) so
  stone/shadow read as one lighting statement at capture distance.
- **Road light events**: one reveal-beam at the lip (built), one over the
  drift-line at u ~130, one over the shore stacks. All `fog: false`,
  ground-faded, edge-on-faded — the canyon column discipline, already used by
  `GoldenLight.ts`.
- Register check: no desolate dimness anywhere; the Hourglass deep earns its
  violet by the column + Keeper lantern + fall veils, not by absence.

## 5. Life system plan

- **Garden-eel fields** (exclusive, built): 4 colonies → 7 (flats core, oasis
  fringe, shore outpost, saddle outpost of ~20). The draw-back behaviour is
  the region's signature delight; keep the diver-distance read live. Add a
  slow colony-wide sway phase so a distant field ripples ("the flats sing").
- **Ray caravan + satellites**: the caravan (built, framed since r4) gains
  golden pilot-fish riding each ray's slipstream (one instanced draw, ~40
  fish) — satellites per doctrine. Its circuit passes the flats, the
  Hourglass lip and (new leg) skirts the Gilded Shore so three sub-biomes get
  centrepiece traffic.
- **Keeper + satellites**: two pale remoras trailing the Keeper's shell-glow;
  its patrol stays the discovery target.
- **Drifters everywhere**: shimmer motes (built) extend into the Hourglass
  and Glass Reach; sand veils (built) get one veil routed down the saddle so
  the road has weather.
- **Traveller shoal** (world system, see connective-tissue.md): a gold
  fusilier ribbon commuting Sandfall Dunes wing ↔ saddle ↔ first crescent on
  a seeded timetable — life as wayfinding on the region's road.
- **Stillness**: The Empty Quarter and The Drain's Eye stay life-quiet by
  authored exclusion, so the tenderness survives the fill.

## 6. Asset needs

- **KIT** (`src/world/regions/kit/`, shared, palette/density/seed knobs):
  ground-cover carpet (pebble/shell/grit), wire-tuft bank, drift-debris
  scatterer (wrack/spars), shoal-runner (path-following instanced ribbon),
  dapple sheet recolorable per region, small-percher colony (base for eels'
  non-exclusive cousins), light-event props (reveal beam, glint spark).
- **EXCLUSIVE (2–4, region signatures)**: garden-eel colony (built), sea-palm
  (built), glass fin/arch family (built) — already at three; the one new
  exclusive allowed: **sand-rose** (fused-glass rosette, T2 jewel of the
  Reach). Everything else must be kit or reuse.
- **REUSE**: bowl caustic dapple (recolored), Seaweed bush/rosette geometry
  (gold-recolored for oasis/shore), fish community geometry for satellites,
  DistantReef ring idiom (built as GoldenDistance).

## 7. Rework checklist (file-level; REBASE FIRST)

Flag: **rebase on the worker's final tree and final capture tag before any
edit** — r4 was still moving constants (fog 0.0085, ring variance, caravan
circuit) the night this plan was written.

1. `GoldenGround.ts` — T1 paint pass: crest shell-lines, fracture paint in
   the Reach, terrace-tread fringes; respect the ≥8 m vertex-paint floor.
2. New `GoldenCover.ts` — all instanced T1/T2 kit consumers (carpets, tufts,
   wrack, shard aprons, salt-lilies); rejection-sample against falls, poses,
   eel colonies and the two stillness zones; honest instance-aware bounding
   spheres (the sill-stones trap).
3. `GoldenLife.ts` — eel colony expansion, pilot-fish, remoras, traveller
   shoal hook; keep update() randomness-free.
4. `GoldenLight.ts` — gold dapple, secondary Hourglass blades, road events.
5. `GoldenRocks.ts` — monolith rim-band paint, singing-stone scatter (90).
6. `GoldenOasis.ts` / `GoldenGlass.ts` — bush/frond understory; sand-roses,
   shard aprons.
7. `GoldenDistance.ts` — verify r4 swell variance killed the mesa-flat read
   (`ray-crossing` frame-right); if not, one more harmonic.
8. `Golden1.ts` — wire GoldenCover; add 2 poses (Empty Quarter rest frame,
   drift-line road frame) — random-pose sweep is the Phase 3 verifier either
   way.
9. `tests/regionGolden1.test.ts` — extend: cover clearances (falls, poses,
   corridors), stillness-zone exclusion, budget caps at the new totals.

## 8. Coherence notes

- **Sandfall-dunes wing handshake**: the wing's mood is quiet tan
  ([1.0, 0.9, 0.72], density +0.009) against the region's honey
  ([3.6, 0.58, 0.26], 0.0085) — the doorway crossfade is the province's first
  gradient and must stay a gradient: the vale's first 30 m keep wing-register
  paint and thin fill, warming to full honey by u ~90. The wing's sandfall
  idiom already continues as the vale falls — good; the wing uplift
  (connective-tissue plan) adds a duneling bed and gold motes inside the wing
  so the *life* gradient starts before the doorway.
- **Golden-waste depth-2/3 future**: the Gilded Shore's far shelf is the
  natural pass site to `golden-waste-2`; keep the two shore stacks framing
  that azimuth and leave the shelf's rim seal gated the way the saddle's is.
  Kit knobs to reserve: palette lerp (honey → deeper violet-gold for depth
  2), eel colony + caravan as *province* life systems (the caravan could one
  day cross a pass — design its circuit data to be extendable).
- **One world, many rooms**: all fill materials come through
  `createToonMaterial` + the shared washes; violet shadows keep red above
  green; nothing black; kit pieces recolored by the region palette, never
  bespoke-hued.
