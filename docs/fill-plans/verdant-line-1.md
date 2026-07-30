# Fill plan — verdant-line-1 (The Great Kelp Sea)

Phase 1 planning under `docs/FILL-DOCTRINE.md`. No code changes here; this
is the work order for Phase 2 (assets) and Phase 3 (rework). Coordinates
are the region's own spoke system (`u` along azimuth 1.35, `v` lateral
CCW; `worldOf(u, v)` in `VerdantTerrain.ts`).

**Budget position**: shipped at 65 draws / 248,711 tris against the old
120/250k caps. The doctrine's new ceiling is **160 draws / 450k tris**, so
this plan spends up to ~+50 draws and ~+170k tris. The roll-up below lands
at ≈ 112 draws / ≈ 415k tris.

## 1. Current-state audit

All citations are `visual-qa/20260729-1248_seed1_hi_REGION-verdant-line-1-<pose>_pilot-final.png`.

| Pose | Verdict against the three-layer law |
|---|---|
| `vale-descent` | **Fails.** Foreground (< 8 m) is bare olive floor edge to edge; the walls are two naked soft masses; one boulder + one ledge-kelp cluster carry the whole frame. No light event anywhere. |
| `vale-narrows` | **Worst frame in the province.** An enormous empty floor runs to the horizon; one boulder and one kelp cluster at left-mid; zero foreground interest; flat light. This is the owner's "plain simple road" verbatim. |
| `vale-reveal` | Distance composes (repoussoir giant, forest skyline, thin reveal beam) but the entire lower half is bare warm **beige** sand — the "green world" contradicts its own doorstep. The saddle has no lip garden, no ground cover. |
| `meadow-hills` | **Fails.** "Rolling Meadows" reads as desert: ~70 % of frame is bare tan swell; the meadow exists as a few blades in the bottom-left corner; the shimmer shoal is invisible at this settle. |
| `forest-eaves` | Treeline silhouette good; but a wide naked band of floor lies between camera and eaves, and the frame's own foreground is three grass blades bottom-right. Midwater empty. |
| `forest-aisle` | Trunk layering works; the forest **floor between trunks is naked brown** — no understory tier exists anywhere in the forest. Serpent visible top-left (good). |
| `elder-serpent` | Serpent ribbon reads as a dotted string (accepted backlight warmth); floor naked; leaf motes read as brown specks; no T2 anywhere among the trunks. |
| `canopy-up` | Crowns exist but the "ceiling" is mostly open sky — the canopy never closes. Grazers read as drifting debris flecks. |
| `canopy-breach` | Mostly empty turquoise; the canopy seen from above reads as a flat teal *terrain plane*, not a sea of crowns; only two crown tips break it. The breach moment has nothing to breach through. |
| `sunwell` | **Best frame.** Grass bowl, pool, leaning ring all read. Still: the band between near grass and ring giants is bare, and the great shaft is faint at 0.15 opacity. |
| `root-maze` | Mauve dune bowl with sparse ornaments (arch, hubs, wreck barely legible). The "tangle" has no tangle: midground is empty silt, the fallen giant reads as a thin worm, and the dark register carries **no light source of its own** — doctrine rule 4 fails here hardest. |
| `weaver-grotto` | Grotto + weaver compose; the entire foreground dune is one naked mauve sheet. (HUD shows the settle-discovery, documented.) |
| `falling-edge` | Closest to passing: stones, young kelp, turf, painted cards all present. Bare bands remain between the authored clumps; lateral shelf reaches are empty. |

**The roads, walked from the layout tables** (`VerdantKelp.ts`,
`VerdantRocks.ts`, `VerdantMeadow.ts`):

- **Vale spine u 48→285 (~200 m)**: 11 ledge-kelp clusters + 6 boulders,
  all at *wall feet*. The channel floor itself — where the diver actually
  swims — is authored bare for 200 m. No life crosses it (motes only), no
  light touches it except the lip beam at u 274. Bare stretches: u 48–72
  (nothing after the gate jambs), and the whole centre line throughout.
- **Lip → meadows u 285–320**: one young stand at u 296, two outriders.
  The saddle crest itself (u 260–285) is bare.
- **Meadows u 292–400**: 42 grass patches and 9 young stands over
  ~110 × 160 m ≈ one patch per 400 m². `meadow-hills` shows the result.
  Bare stretches: v < −40 and v > +40 almost everywhere; u 330–370 midline.
- **The aisle u 300–480** (the authored swim line `aisleAt(u)`): kept clear
  of trunks *and of everything else* — the region's main road has no
  wayside authored at all.
- **Forest floor**: no T2 tier exists. Trunk bases have no holdfast
  skirts, no bushes, no rubble. Bare stretches: everywhere between trunks.
- **Forest → maze (u 450–480, v −30..−60)**: no transition dressing;
  the moss floor just becomes mauve.
- **Maze quarter (r 62)**: 9 stones, 11 root hubs, 2 arches, wreck, fallen
  giant, 18 urchins over ~12,000 m². Sparse; gully floors bare.
- **Maze → falling edge (u 540–560)**: nothing.
- **Rim laterals**: the shelf's east/west reaches (|v| > 60 at u > 560)
  are bare to the collider wall (the ledger's own flag).

**Light audit**: 5 shafts + 1 pool for a 440 m disc. The vale has one
beam; the maze, grotto, wreck and canopy have none. **Life audit**: no
shoal travels the roads (the serpent tours the forest only); no
small-fauna colonies per surface type; the vale is lifeless.

## 2. Journey map

**Spine road** (the tour, ~700 m): cathedral door (u 48) → vale channel →
narrows (u 196) → lip reveal (u 268) → meadow crossing on the aisle →
forest eaves (u ~372) → aisle to the Elder (430, −22) → Sunwell (475, 58)
→ Green Gates → Root Maze / grotto (496, −96) → back up to the Falling
Edge (u 578) → the pass to the Terraces (u 620+, v ±14 gate).

**Side loops**: (a) meadow erratic loop — aisle → erratic (318, 32) →
shimmer ellipse → rejoin at the eaves; (b) canopy loop — Elder → breach at
+15 → over the Sunwell ring → descend the great shaft; (c) wreck loop —
Green Gate 1 → wreck (489, −94) → fallen giant → grotto.

**Rest points (stillness preserved on purpose)**: the Sunwell floor (no
new fauna inside the ring — it stays the held breath), the lip saddle
crest after the reveal, and the mirror-calm shelf pocket at (585, −40).

**Every 20–40 m the diver should see** — vale: alternate ledge-garden
(kelp + new understory + urchin colony) / boulder-with-carpet / light
event (see §4), so each ~30 m segment has one of each class; meadows: a
swell crest carries either a grass drift + stars, a young stand + shoal
crossing, or the erratic; forest aisle: trunk-base holdfast skirts every
trunk, a bush bank or fallen limb every 25 m, a beam or dapple pool every
40 m, serpent crossing twice per tour; maze: a root hub, arch, wreck rib
or glow colony every 20 m (it is the dense quarter); falling edge: a
stand/stone/turf triple every 35 m thinning outward — the decrescendo.

**Province arc**: Kelp Sea = bright, alive, spring-keyed, light falling
in wells; Terraces = older, mistier, worked stone, light in long
diagonals. This region should end bright-and-thinning (Falling Edge
milkiness) so verdant-2's thicker green reads as a change of age, not a
palette swap.

## 3. Zone density table

Instance counts are per zone; draws are counted once per new mesh in the
roll-up (instanced kits are shared region-wide). Tri estimates use:
carpet card 4 tris, pebble 24, turf blade 16, bush 160, sponge/polyp 60,
holdfast skirt 220, fish 48, star 80, urchin ~130.

| Zone | T1 ground cover | T2 understory | T3 verticals | T4 ambient life | T5 events |
|---|---|---|---|---|---|
| Long Vale | moss-carpet cards 2,600 + pebble runs 700 down the channel line; silt ripples via existing wash (0 tris) | ledge gardens grown to 16 clusters: +40 bushes, +30 sponges at wall feet | ledge kelp doubled (22 clusters, existing young grower) | vale runner shoal (45) commuting the full channel; 8 urchin colonies of 4; motes kept | 3 new wall-notch beams (u 110/165/230) + 2 dapple pools; gate-jamb glow moss |
| Lip & Meadows | sward carpet cards 3,400 on swell crests; grass patches 42 → 70 (+1,050 blades) | 60 meadow bushes + 24 pebble drifts; erratic gets a skirt of 12 stones | young stands 9 → 15; outriders keep | shimmer kept; new drifter jellies (8); star colonies 26 → 44; meadow crab colony (12) | erratic dapple pool; 1 beam at (330, 18); shoal-crossing event over the aisle |
| High Forest | litter carpets 2,800 cards (two warm tones) between trunks | **holdfast skirts on all 29 giants** (root knuckle kit); 70 forest bushes; 26 fallen-limb props | 6 new mid kelp (9–13 m) filling eave gaps at u 360–400 | grazers kept; bark-percher colonies (10 × 5 fry); serpent kept | 2 more aisle beams (u 385/460) + 3 dapple pools on the aisle; canopy-gap god-ray pair over the Elder |
| Sunwell | pale grass kept ×1.3 (700 blades); ring-rim carpet 600 cards | 8 low bushes *outside* the ring only | ring giants keep | stars kept; **no new fauna inside the bowl** (rest point) | great shaft opacity ↑ + 2 satellite beams; pool radius 9 → 11 (the light peak) |
| Root Maze | silt-bloom carpets 1,800 (violet family) on gully floors; rubble runs 500 pebbles | root hubs 11 → 20; wreck debris field (24 planks/pebbles); 40 wine bushes | 4 dead spar trunks (bare stipes, silhouette-graded) | urchins 18 → 34; **glow-polyp colonies 14 × 8** (the maze's own light); brooding shoal (30, slow, low) | wreck glow moss + grotto lantern pair; 1 dusk beam through the arch at Green Gate 1 |
| Falling Edge | milky turf kept ×1.5; shell-scatter carpet 900 cards | 20 pale bushes among the stones | thinning stands kept + 3 mid kelp | drifting leaf cards kept; 1 far shoal (20) circling the leaning pair | rim-crest dressing (12 low crest stones) so the wall has a visual excuse; 1 pale beam between the leaning stacks |

**Roll-up**: new instanced meshes ≈ 22 draws (4 carpet families, pebbles,
2 bush palettes, sponges, skirts, limbs, spars, debris, glow polyps,
2 shoals, jellies, crabs, perchers, crest stones, + spares); new light
meshes ≈ 12 draws; grown existing meshes ≈ 0 new draws. Total ≈ 65 + 34 =
**≈ 99–112 draws**. New tris ≈ 165k (carpets ~46k, skirts ~6.4k, bushes
~27k, limbs/spars/debris ~18k, shoals/colonies ~12k, grass/turf growth
~30k, glow/lights ~4k, misc ~20k) → **≈ 415k total. Fits.**

## 4. Light plan

The region's light narrative: *wells of falling light in a green sea*,
peaking at the Sunwell.

- **Vale**: three wall-notch beams (u 110, 165, 230 — alternating sides,
  where the ledge gardens sit) + dapple pools under beams 1 and 3. The
  narrows (u 190–250) stays beam-free on purpose: the pinch is a shadow
  passage so the lip reveal lands brighter.
- **Meadows**: one beam at (330, 18) near the erratic + its pool; the
  swells otherwise carry light by ground value, not marks.
- **Forest**: aisle beams at u 385 and 460 (with the existing 398/442
  this gives one per ~40 m of aisle) + 3 floor dapple pools; a paired
  god-ray through the Elder's crown gap aimed so `canopy-up` finally has
  visible falling light.
- **Sunwell — the peak**: great shaft opacity 0.15 → 0.22, pool 9 → 11 m
  with brighter core, two satellite beams; everything else within 40 m
  stays markless so the peak is a peak.
- **Maze — the earned dark**: no sun beams except the single dusk beam
  through Green Gate 1's arch; the darkness carries its own light via
  glow-polyp colonies, wreck glow moss, and the grotto lantern pair
  (canyon polyp discipline: emissive ≤ 0.36, far under bloom).
- **Falling Edge**: one pale wide beam between the leaning stacks; the
  milky ground paint does the rest.
- All new beams follow the four-part discipline (`fog:false`, baked
  ground fade, edge-on fade, camera-distance fade dead by ~120 m) already
  implemented in `VerdantLight.ts`.

## 5. Life system plan

- **Shoal network (life as wayfinding)**: a new *vale runner* shoal (45)
  commutes the full channel u 60–280 on a closed loop, so the approach
  road always has a guide; the *meadow shimmer* keeps its ellipse but the
  ellipse is re-centred to cross the aisle twice; a *brooding shoal* (30)
  drifts low through the maze gullies; a small far shoal (20) circles the
  Falling Edge pair. With the serpent, every road segment is crossed by
  moving life at fog rhythm.
- **Small fauna per surface type**: sand/moss → crab colony (meadows) and
  star colonies (grown to 44); trunk surfaces → bark-percher fry clusters
  (10 trunks); gully rock → urchins (34) + glow polyps; wreck wood →
  debris-field shrimps if budget allows (cut first).
- **Drifters**: 8 slow jellies over the meadows at 6–9 m (violet-rose —
  the one warm accent the mid-water gets).
- **Centrepiece + satellites**: the current serpent stays the
  centrepiece; its satellites are the grazer cloud (kept) and the new
  Elder god-ray pair so the circling reads lit. The Weaver stays the
  findable.
- **Stillness preserved**: the Sunwell bowl (no fauna inside the ring),
  the narrows' shadow passage (motes only), and the shelf pocket at
  (585, −40). These are composed rests, stated here so density passes
  don't fill them.

## 6. Asset needs

**(a) KIT — shared parameterizable builders** (`src/world/regions/kit/`):

1. `carpetField` — instanced ground-cover cards (4-tri bent quads);
   knobs: palette (moss / litter / silt-violet / sward / shell), density
   map callback, size range, seed. Every region's T1 answer.
2. `pebbleRun` — instanced pebbles/rubble along a polyline; knobs: count,
   size range, two-tone palette, scatter width.
3. `bushBank` — 5-lobe welded bush (the bowl `Seaweed` idiom re-built for
   regions); knobs: lobe count, palette (spring / olive / wine / pale),
   scale, seed.
4. `spongeCluster` — 3–5 narrow tubes per holdfast (W-N5 profile); knobs:
   palette, height, cluster count.
5. `glowColony` — emissive polyp buds + lifted halo points (W-O1
   discipline baked in); knobs: tint, bud count, glow level.
6. `shoalRunner` — closed-loop instanced shoal (generalise
   `VerdantLife.buildShoal`/`buildSerpent`); knobs: path stations, count,
   fish profile, colour, emissive, span.
7. `smallColony` — perch/hover micro-fauna cluster (fry, shrimp);
   knobs: surface anchor list, count per anchor, colour.
8. `beamAndPool` — the shaft+dapple pair as one call (all four fade
   disciplines included); knobs: width, top, opacity, slant, pool radius.

**(b) EXCLUSIVE — this region only**:

1. **Holdfast skirt** — a root-knuckle collar sized to giant stipe feet
   (grips the ground, 220 tris), palette matched to `HOLDFAST_TINT`; the
   single biggest fix for the naked forest floor.
2. **Fallen limb** — a curved dead-strap prop (bark + silvered top) for
   forest litter; 3 size variants.
3. **Dead spar** — bare charcoal-olive stipe with stub crown for the
   maze (silhouette vertical for the dark quarter).
4. **Canopy pad card** — a broad crown-top card used *above* the canopy
   so `canopy-breach` reads a sea of crowns from above (cheap, unlit,
   vertex-painted).

**(c) REUSE — denser deployment / repaint of existing code**:

- `growPlant` young/mid kelp: vale ledges 11 → 22 clusters, meadows
  9 → 15 stands, eaves +6 mids (no new code).
- `VerdantMeadow` grass: patches 42 → 70; Sunwell ×1.3; Falling Edge ×1.5
  (capacity constant already parameterised).
- Star/urchin builders: counts up, plus a rose-violet star family for
  the maze.
- `SHAFTS` table: +8 entries; pool builder reused for 6 new dapple pools.
- Root hub generator: 11 → 20 hubs; also reused for wreck debris anchors.
- The serpent/shoal builder for the three new shoals.

## 7. Rework checklist (ordered)

1. `tests/regionVerdant1.test.ts` — raise budget caps honestly to the
   doctrine's 160 draws / 450k tris *first* (and keep the lower-bound
   assertions; raise the floor to ~90 draws / 300k when the fill lands).
2. `src/world/regions/kit/` — build the kit pieces (§6a) with demo
   captures; new seeds only from `SEEDS.regionVerdant1 ^` fresh
   substreams appended after all existing draws (reroll fence — pin the
   first/last existing draws in the test the way `canyonPaint` does).
3. `VerdantGround.ts` — carpets don't replace paint: deepen the sward
   contrast band (the beige lip read in `vale-reveal`), and add a
   channel-floor moss track down the vale centreline (the road itself
   must be green, not just its walls).
4. `VerdantKelp.ts` — holdfast skirts at every giant foot (contact
   patches already exist); +6 eave mids; canopy pads: raise per-giant pad
   count 6–8 → 9–12 and add the above-canopy pad cards so breach/up poses
   close the ceiling.
5. `VerdantRocks.ts` — maze: hubs to 20, debris field at the wreck, dead
   spars, rim-crest stones at the Falling Edge (scenery only — not in
   colliders, the sightline rule).
6. `VerdantMeadow.ts` — patch/count growth per §3; new shell-scatter
   family on the edge.
7. `VerdantLife.ts` — three new shoals, jellies, crabs, perchers, star
   growth, urchin growth, glow-colony placement (maze).
8. `VerdantLight.ts` — `SHAFTS` +8, pools +6, Sunwell peak boost, maze
   glow accents (§4).
9. `VerdantDistance.ts` — **cut the far-pole gap**: the outermost ring
   crosses the depth-2 pass at u ≈ 691–733 as an opaque curtain
   (verdant-2's ledger flag, proven by probe). Add a second gap at
   `gapAt = VERDANT_SLOT.azimuth` (mirroring `GAP_HALF` logic) and keep
   trunk cards out of that sector. This is the one *blocking* item for
   the province journey.
10. Capture `region-shots verdant-line-1 fill-r1`, critique against §1
    pose by pose (each listed failure must name its fix visible in
    frame), iterate ≥ 2 more rounds, then `fill-final` + noassets set.
11. Tests to update honestly: budget caps (item 1), mesh-name inventory
    assertions if any new names land, and add: carpet-determinism pin,
    far-gap-exists assertion on the distance rings, vale-runner path
    clearance vs colliders.

## 8. Coherence notes

- **Cathedral wing handshake (u < 48)**: the vale's gate jambs are
  `paleStone (0x8a8474)`; keep the wing's own wall palette on the first
  20 m of ledge gardens (VALE_TONES already cooler) so the door reads as
  one place. The new vale-runner shoal should *start* its loop visible
  from the wing's end wall — life leads the diver in.
- **The pass to verdant-2 (u 620–738)**: verdant-1's rim ring already
  gates over |v| < 14 (R0.2); the distance-ring cut (item 9) completes
  it. The Falling Edge's milky ground paint and thinning stands are the
  handover gradient into the Threshold's milky crest — keep both fades
  ≥ 20 m (doctrine transition rule). The last thing this region shows on
  the spine is the leaning pair framing verdant-2's silhouette cards.
- **Sibling palette handshake**: this region's tips are golden-olive
  (`TIP_GOLD 0xc9b45e`); verdant-2's are the same constant family — keep
  shared TIP_GOLD, diverge on body greens (spring vs viridian) so the
  province reads as one flora aging, not two.
- **Depth 3 someday**: the Falling Edge's painted distance beyond the
  pass sector stays *forest* skyline; do not paint terrace silhouettes
  here — the terrace promise belongs to verdant-2's own distance, and a
  double promise cheapens both.
- **Kit reuse across the province**: carpetField, bushBank, glowColony,
  shoalRunner, beamAndPool are shared with verdant-2's plan (see its §6);
  palettes differ, code does not.
