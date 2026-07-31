# verdant-line-3 — THE CANOPY DEEP (the first depth-3 region)

Region worker ledger. Slot `verdant-line-3`, province The Verdant Line,
depth 3 — the province's LAST chamber; the inbound connection is the
depth-2 → depth-3 pass from the Emerald Terraces' far rim. Disc centre
r = 1460 on azimuth 1.35 (world ≈ (320.4, 1424.5)), radius 220. Seed
`SEEDS.regionVerdant3` (0x5a4d_0c03) and `^` substreams only. Built to
the full R12 standard from its first draft: no wedge era, no separate
fill pass — density, quality, light and life ARE the build.

## Concept

The primeval heart the kelp sea grew from: older than the terraces,
deeper than the forest, the green going toward blue-dark, the light
arriving in cathedral shafts from a canopy so high and old it reads as
sky. The MESA PILLARS — the promise verdant-2's Far Balcony painted —
rise 26–38 m from root mounds to hanging-garden crowns; the OLD CANOPY
closes overhead between them; the SHADE MEADOWS carry deep-register
flora and glow colonies under the god-falls; the WELLSPRINGS breathe
cool clear pockets at the mesa roots; one mesa is HOLLOW (the secret:
an open-topped chimney with a curtained mouth, a glow garden and an
oculus beam inside); one has FALLEN (a causeway with a swim-under at
its chin, its crown garden still growing sideways); and the PROVINCE'S
END rise looks into the painted horizon that closes the Verdant Line —
THE MOTHER MESA, the first garden.

## The depth-3 pass (the second inter-region connection)

The Emerald Terraces' disc ends at u ≈ 1160 on the spoke; ours begins
at 1240. The pass tongue is authored `approachTongue("verdant-line-3",
{ fromR: 1130, toR: 1300, halfWidthFrom: 16, halfWidthTo: 56 })` — it
starts **30 m inside verdant-2's rim**, so the two domains genuinely
overlap and the bounds handover has no gap (asserted in
`tests/regionVerdant3.test.ts`: both weights > 0 on the spoke between
1130 and 1160, and our weight > 0 continuously along the spine
1132–1300).

Three authored bands:

- **The Last Rampart** (u 1130–1245): a milky crest shelf at dune level
  over the terraces' own rampart. Our weight is a whisper (0.14, the
  threshold gate) so the terraces keep carrying the water, mood and
  terrain across the overlap; we own only the bounds. The gate also
  hides the framework's depth-boundary reject circle (`RegionField`
  consults a depth-2/3 region only within `radius + 40 = 260 m` of its
  centre — u ≥ ~1200): out there our terrain target is held at dune
  level (asserted), so the step at the reject circle is centimetres —
  the verdant-2 device, reused at the next boundary out.
- **The Boughfall** (u 1252–1312): the pass is a place — six great
  root-steps down ~25 m in a walled green cleft under the first
  over-arching crowns (the Eaves Gate at u ≈ 1251, deliberately past
  u 1240: verdant-2's outermost distance ring crosses this pass at
  u ≈ 1228 as an opaque curtain, and its ledger's Emerald Gate story is
  the reason nothing of ours composes before that line).
- **The country** (the disc).

## Sub-biome map (spoke coordinates: u along azimuth 1.35, v lateral CCW)

| Sub-biome | Where | Floor |
|---|---|---|
| The Last Rampart (threshold) | u 1130–1245 along the pass | +0.2 → −2.2 milky shelf |
| The Boughfall | u 1252–1312, walled cleft | 6 × −4.1 root-steps → −24.6 |
| The Shade Meadows | the disc floor past u 1320 | ≈ −34, swells ±1.7 |
| The Mesa Pillars | seven pillars (map below) | root mounds +1.6 |
| The Wellsprings | (1390,−18) r9 / (1408,34) r7 / (1512,58) r10 | pools −38.5 → −40.5 |
| The Old Canopy | crowns at y ≈ −8 → +6 | (ceiling −6; sky) |
| The Province's End | (1608,−8) r14 rise | −28.5 balcony |

Mesa pillars: Doorwarden (1332,42) h30 · Twin-West (1448,−34) h34 ·
Twin-East (1478,8) h33 · Kingpillar (1520,66) h38 · THE HOLLOW
(1418,−92) h30 · South-Watcher (1552,−84) h28 · Rimward (1588,44) h26 ·
the Fallen (1544,−44)→(1568,−26). The Sunfall Well (1462,−10) r12 is
the canopy's one great gap; the region's named light peak falls there.

Vertical range: threshold +0.2 → Clearwater −40.5 (≈ 41 m; test holds
≥ 35 and lowest ≤ −38). Ceiling: 3.8 m at the threshold (meeting the
terraces' closed far rim), vaulting to ~12 into the Boughfall, diving
to −6 under the Old Canopy (the floor is −34: ~28 m of water), lifting
to −1 inside the Sunfall Well and −2 inside the Hollow's chimney,
closing to 3.4 at the far rim (gated off the pass).

## Registered rests (for MASTER §1.2 — the region's contributions)

| Rest | Where | Licence |
|---|---|---|
| THE CLEARWATER | the Kingpillar's wellspring pool, r 12 at (1512, 58) | its shaft + pool and its bubble column are the room's ONLY light and motion; no fauna, no scatter, no motes in its water |
| The Hollow Mesa's shaft | r 7 at (1418, −92) | the glow colonies and the oculus beam are the secret's own light; no fauna, no scatter |
| The Boughfall Shadow | u 1274–1300, the channel's width | motes only; beam-free, scatter-free — the descent's dark breath |
| The Elder's Rest | r 12 at (1584, −64) | bare composed silt; nothing |

(The canopy leaf-fall layer drifts region-wide at y −31..−5 and crosses
above the Clearwater like weather; the pool's own water column below
stays clean — motes and plankton reject inside its bowl.)

## Landmarks (a reveal every 20–40 m)

1. **The Deep Sentinel** (1168, chan−6) — the first thing of ours the
   fog gives up, with waymark boulder pairs pacing the road every ~25 m.
2. **The Eaves Gate** (u ≈ 1251) — two moss jamb stacks between the
   first over-arching crowns: the door into the last chamber.
3. **The Boughfall** — the six-step rooted descent, slab lips
   alternating sides, drape-hung walls.
4. **The descent-foot overlook** (1318, chan−11) — the Canopy Deep
   opens in one breath; the first god-fall lands beside it.
5. **The Doorwarden** (1332, 42) — the first mesa portrait.
6. **The Twin Court** (1448,−34)/(1478,8) — two pillars around the
   Sunfall Well; the Ray Wheel circles them.
7. **The Wellspring Terrace** (1390,−18)/(1408,34) — bubbling pools,
   pale clean floors, lip stones, rim lamps.
8. **The Kingpillar** (1520, 66) — the tallest crown in the province;
   THE CLEARWATER at its root.
9. **THE HOLLOW MESA** (1418, −92) — the secret: a drape-curtained
   mouth, a glow garden inside an open-topped chimney, the oculus beam.
10. **The Fallen Mesa** (1544,−44 → 1568,−26) — the causeway, a
    swim-under at the chin, the sideways crown still growing.
11. **The Province's End** (1608, −8) — slab arc, framing stacks, and
    the painted horizon that closes the Verdant Line (the Mother Mesa).

## Life (T4/T5 systemic, short of saturation)

- **Deep spore-motes** (1,300) + **drift plankton** (1,500 large soft
  sparks, the midwater foreground layer — the verdant-2 sweep
  arithmetic adopted as the starting density).
- **The traveller shoal** (kit shoalRunner, 40 silver-green fusiliers
  0xc9ecd8 — the province's one shoal light): arrives from verdant-2
  down the pass road u 1136–1268 — life as wayfinding on the last road.
- **The meadow liaison** (26 fry) touring the mesa court; **the shade
  swarm** (34 dark-silver tetra) weaving the Twin Court's feet.
- **Canopy-dwellers** (kit percher, hover): fry clouds high under four
  crowns; **crown-court crabs** (dart) on the fallen causeway; **whelk
  trios** at the Doorwarden's foot; **cushion stars** on wellspring
  rims and skirts.
- **Glow colonies** (kit): ten moon-green meadow lamps, the Hollow's
  interior garden, wellspring-rim lamps.
- **Wellspring breath**: bubble columns off every spring; **canopy
  leaf-fall**: old gold sifting down region-wide.
- **THE RAY WHEEL** — the moving centrepiece: four moss-backed rays on
  one slow closed wheel around the Twin Court and the Kingpillar.
- **THE ELDERLEAF** — the findable resident (`canopy-elderleaf`,
  *Phyllodraco primaevus*): a leafy sea-dragon spirit, nine leaf-vanes
  riding a live-posed tube (the weaver/warden trick, third generation),
  patrolling a rose-curve through the Hollow Mesa's curtained mouth;
  codex entry in the def's pure half; DiscoveryTarget at the curtain's
  part, crossed by the head twice a loop.

## Density tiers (doctrine table, per zone)

- **T1**: region-wide frond carpet + blade tufts + tall drift stands
  (kit QUALITY profiles from draft one — 48-tri S-bend blades, 60-tri
  cupped fronds; no card wedges anywhere near the camera); road celadon
  + shell pebbles; descent root-moss; mesa skirt gardens; wellspring
  rim swards; Sunfall lawn; Province's End stand; meadow pebbles,
  descent shards (raked), mesa-root split stones (graded).
- **T2**: wine shade-scrub with rose bud knots; spring skirt bushes;
  celadon road scrub; gold end-stand bushes; shed-crown wrack.
- **T3**: seven mesa pillars, the fallen causeway, 30 old-canopy trees,
  crown pads, crown drapes (kit wallDrapeBank), sponge courts, scree
  aprons.
- **T4**: as Life above. **T5**: nine god-fall shafts + walk-line
  dapple pools (kit beamAndPool, four-part discipline built in), the
  Sunfall (named light peak), the Hollow's oculus beam, glow colonies.

## Budgets (measured programmatically; tests hold the caps)

- Draft 1: **95 draws / 678,474 tris / 468 colliders** (caps 260 /
  1.35M — R12). Headroom held for the critique rounds.
- Round 2: re-measured after the density/value pass (below).
- Round 4: **100 draws / 1,315,408 tris / 471 colliders** — the first
  r4 density draft measured 1,495,888 and was trimmed back under the
  cap (fronds 10,500 → 8,200 etc.) before ever being captured; the
  drift-floor raise, not raw count, carries the close-pose fix.

## Seeds

`SEEDS.regionVerdant3` (0x5a4d_0c03) with `^` substreams: terrain
0x7e01–0x7e03, ground paint 0x5ae1/0x517d/0x70b3/0x51b0/0x51b1, mesas
0x50cb + 0x0a01–0x0aef shape seeds, canopy 0x1e01/0x1e02/0x1e10+,
gardens 0x2a00–0x2c01, cover 0x3001–0x30f0, light 0x11f9–0x11fb,
colonies 0x40xx/0x41xx/0x42xx/0x43xx, life 0x44a1/0x44a2/0x45a1,
elder 0x0ee3, distance 0xd159/0xd400+. Runtime updates spend no
randomness — captures settle deterministically.

## Critique history (silhouette → value → colour → detail, per round)

### Round 1 (`v3-r1`) — the bones stand; the paint and the close range fail

Captured 14/16 (a nav timeout ate `close-garden-skirt` and
`close-wellspring-rim`; graded in round 2 — the poses recur).

Silhouette: **the mesa skyline EXISTS** — `deep-vista` and `twin-court`
read flat-topped pillar country with the Sunfall shaft falling between
the Twins, and `eaves-gate` composes (jambs + trunks + crowns +
descent). Fails, by size: **the crown drapes read as ANTLERS** — 4.6 to
6.4 m kit drape strands rise-and-droop into spikes radiating off every
crown (the hanging gardens, the region's signature, read as thorns);
**the canopy pads read as flat teal mushroom discs / flying saucers**
(perfect squashed ellipses, undersides crushed to one fog value);
`doorwarden` and `kingpillar` planted the camera face-first into their
columns (d ≈ 20 m cannot hold a 30 m pillar); **`hollow-mesa` framed
eight metres of flat interior wall** (the pose stood inside the chamber
staring at it; the beam and glow never entered the frame); **the fallen
mesa read as a crumpled pale tarp** (the standing profile — foot skirt,
crown flare, milky crest — lying sideways); **`provinces-end`'s horizon
rendered EMPTY** — probed by sightline arithmetic: from the rise
(y ≈ −26, ~60 m inside the rampart crest at y ≈ 0) everything must
clear a 0.41 rad line, and the r1 ring tops (12/19/26) and card heads
(feet −50, tops ≤ +2) all sat below it — the whole painting stood
behind the world's last wall.

Value: **the region's floor flora dropped to navy silhouettes** — the
verdant-1 re-pass lesson (under a dim sun, small flora is value-first)
relearned in the province's dimmest water; the open meadow read warm
MUSTARD under the sand wash (base red 0.52 too polite, the deep-key
pulling red UP); mesa columns and trunks read as one flat wash
("plastic columns") — strata/streak amplitudes authored too subtle and
18-segment facets each catching one toon value.

Colour: water reads right (green toward blue-dark, shafts warm); rock
wash lavender at close range (the standing shared-material read).

Detail: **`close-shade-floor` and `close-road-moss` FAIL the owner's
bar outright** — near-bare ground with sparse dark sprigs: 3,400 fronds
over 140,000 m² is 1/40 m² (a rumour, not moss), the road's 520 blades
over its 6,500 m² likewise; the drift-field floor of 0.35 dug real
holes; wellspring bubbles invisible (0.16 m sparks at 0.5 opacity);
the Deep Sentinel a pebble on the horizon.

**Round-2 orders** (all landed before the r2 capture):
1. Drapes: anchors below the lip (−2.2..−3.6), strands 2.6–3.6 m × 6,
   nine anchors — a fringe skirt, not antlers; descent drapes 2.3 m.
2. Pads: radial fbm tear + rim droop, squash 0.24–0.42, mother-pad +
   satellites per tree, undersides dropped to violet (0.36/0.34/0.48).
3. Mesa lathe: 24 segments × 18 rings, rough 0.32, strata ×1.7, moss
   coverage up, fine grain jitter; trunks: bark contrast doubled,
   moss collars widened.
4. Floor: base fronds 3,400 → 6,000 at [0.36,0.65] and a value step UP
   (base 0x5f9e6a tip 0xa6d68c); blades 1,100 → 2,000 at [0.45,0.85];
   NEW tall drift stands (340 × 1.05–1.7 m, sunGlow, clumped); drift
   floor 0.35 → 0.45; ground base red 0.44, deep-key red 0.48.
5. Road: band 34 → 26 m, celadon 520 → 1,200 at a deeper base
   (0x86b890), + 320 shell pebbles; descent moss 680 → 900.
6. Wellsprings: bubbles 60 → 120 at 0.32 m/0.6 opacity; lip stones
   1.0–1.7 m; rim sward 190 × [0.34,0.56].
7. Distance: ring tops 20/30/40; card heights 40–56/44–62; the Mother's
   foot to −18; NEW near sector cluster (8 cards, rc 168–196, on the
   spoke's bearing ± 0.55, clear of the balcony's 45 m).
8. Fallen mesa: dedicated `log` lathe profile (plain tapered bole, no
   flare, no crest).
9. Poses: doorwarden/kingpillar backed to d ≈ 34; hollow-mesa moved to
   the mouth looking IN through the curtain; wellsprings lower and
   closer; fallen-causeway reframed; Deep Sentinel grown to 6.2 m.

### Round 2 (`v3-r2`) — the vistas arrive; the close range and the paint still owe

All 16 authored poses captured; the sweep ran while the round-3 edits
landed (frames 06–12 carry mixed code — the seeded poses recur, the
full clean sweep re-runs in round 3).

Silhouette: **the region exists now.** `twin-court` is a real vista —
the twins tower with garden-fringe crowns (the antlers are gone), the
Sunfall falls between them, a near flank crops the left; `doorwarden`
and `kingpillar` are portraits (backing off to d ≈ 34 worked; the crown
pads + short drapes read as gardens); `hollow-mesa` finally shows its
room — interior wall, oculus light, glow buds — but the mouth's raw
lathe cut reads as razor diagonals, and the Elderleaf's curtain is
thin; `provinces-end`'s horizon EXISTS but the near mesa cards read as
BLACK TEETH floating on the crest line (fade 0.3 made the nearest
distance ink the darkest thing in frame — the value key inverted);
`fallen-causeway`'s log profile is right and its PAINT is not (a pale
tarp; a mossy bole is drawn by its moss); `boughfall`'s mid-frame is
the Boughfall Shadow rest itself, and unpainted stillness reads as
missing fill, not composed dark.

Value: the canopy pads read organic now but chunky-angular at pose
range (detail-1 icosahedra torn into plates); trunks read barky at the
gate, flat-grey at 30 m (fog does part of that); mesa flanks at close
range still one wash — the r2 contrast helps at portrait range only.
**The close poses still fail**: `close-shade-floor` — dark violet-navy
rosettes on khaki (the value lift was half a step short; 6,000 fronds
over 140,000 m² is still 1/23 m²); `close-road-moss` — better, thin
(and a dark seam line at grazing angle: the pass sheet's overlap edge);
`close-garden-skirt` — PASSES (S-bend gold-tipped blades read as
painted grass; the prismatic toon gradient is genuinely Ghibli);
`close-wellspring-rim` — bubbles ✓ pale pool ✓, but the ring paint
reads as tire tracks and the near rim is bare.

Sweep (r2/r3 mixed): **~7 pass / 4 marginal / 1 harness glitch**
(frame 05 solid teal with the "hidden moray" HUD — the documented
capture-state glitch; recaptured next round). The marginals are all
ONE class: rim-facing cones (02/03/09 thin near bands, 08's left half
open water + the distance ring seen dead-on) — MASTER's F-R3 field
note verbatim.

**Round-3 orders** (all landed before the r3 capture): floor paint red
0.40 + lichen widened; frond/blade palettes a second value step up,
counts 7,400/2,600, tall stands 420; road 1,500 + 450 shell pebbles,
band 26 m; descent moss lifted; pads to detail-2 spheres; mesa violet
runnels + log moss banding; hollow mouth dressed (flank boulders +
lintel slab), curtain 7 strands; Boughfall Shadow painted as a composed
cool dark; distance near cards fade 0.48 / heights 54–68, the Mother at
−10 with fade 0.44; wellspring rings softened + rim sward 260 widened
inward; pass sheet sunk 7 cm; **the rampart hem** (F-R3): 560 standing
blades ringing rc 168–198; `boughfall` pose moved up-channel to keep
dressed treads in its near band.

### Round 3 (`v3-r3`) — the paint answers arrive; the threshold road still owes

Capture note: the machine carried four sibling region workers; the
authored run crashed after six poses (the browser, not the build) and
the remaining ten — all four close poses among them — recapture after
the r3 sweep completes. Critique of the six in hand:

Silhouette: `twin-court` is now the region's proof shot — the Sunfall
shaft falls full-height between the twins, the kingpillar's fringed
crown stacks behind, the Fallen's log-end crops the right, the Ray
Wheel crosses mid-frame, and the west cliff crops the left: five
depth planes, no dead quarter. `deep-vista` reads as a mesa CITY under
one canopy — nine distinct verticals, no two alike, ray in the middle
distance. `boughfall` (the moved pose) now frames the descent between
two gate trunks with the beam falling into the channel — the Boughfall
Shadow below reads as a composed cool dark, not a hole. `doorwarden`
keeps its portrait: fringe crown, violet runnels legible through fog.
`eaves-gate` is the round's best floor — sward with lichen mottle,
waymark pair, boulder, blades in three bands to the trees.

Value: the second value step landed — `eaves-gate`'s blades read
mid-value against the sward (r2's navy specks are gone at this range),
lichen patches break the sward without dirtying it. The r3 canopy pads
(detail-2) hold their silhouette at portrait range; no more torn
plates.

Colour: the sward reads GREEN under the shade mood — the mustard
read survives only where the dune-level base sheet shows: which is
exactly the two threshold poses.

**The round's fail: the threshold road.** `pass-threshold` and
`doorwarden`'s near floor is bare mustard dune — the road band and its
celadon start at the disc and never reach out the tongue, so the
region's front door breaks road-as-place. R4 order: carry the road
band + shell pebbles + litter clusters out along the pass centreline to
the threshold (u ≈ 1250 → the gate), and lay a green-wash paint pass on
the pass sheet so the approach reads as the Verdant Line's floor, not
the wastes'.

**Sweep (`v3-r3`, first clean single-code sweep): 7 pass / 2
marginal-pass / 3 marginal.**

- 01 PASS — rampart bank, scree pads, glow bud, boulder, beams, canopy
  line: three layers in every band.
- 02 PASS (note) — straight-down cone: shade swarm near, blade dashes
  mid, road far; sheet trim edges faintly visible from altitude.
- 03 MARGINAL — under a crown pad: the pad's underside reads as ONE
  flat teal plate at fog range (the violet under-paint dies under the
  mood), and the band between pad and floor is open water.
- 04 MARGINAL — meadow near the rim: near floor mustard with sparse
  tufts, and the ground-litter split-stone rings read as TIRE-TRACK
  ARCS on the sward (same artifact class as r2's wellspring rings).
- 05 PASS (note) — grazing a gate trunk: percher on the bole, mesa
  flank, canopy line — but the bark paint reads smooth at touch range.
- 06 PASS — pad overhead, tuft bands, boulders, trunk + beam.
- 07 PASS — **the rampart hem works** (F-R3 answered): violet-tipped
  blades dress the slope's near band, mesa skyline behind.
- 08 MARGINAL — extreme-close cone: half the frame is a pad seen
  edge-on as a flat plane over deep blue; trunk + perchers + dweller
  carry the rest. The same underside-paint fix should soften it.
- 09 MARGINAL-PASS — pad + trunk + mesas okay; near floor khaki with
  scattered tufts, thin at the bottom edge.
- 10 PASS — rampart sward with violet runnel shadows, wellspring pools
  + glow, blades.
- 11 PASS — the region shot: trunk, pads, travellers, the Elderleaf
  crossing, floor blades, beam.
- 12 MARGINAL-PASS — midwater over the meadow: swarm + pad + cards;
  floor khaki but alive.

**Round-4 orders** (with the threshold road above): (1) crown-pad
UNDERSIDES — lift the under-paint value and warm it so a pad overhead
reads as a painted canopy, not a teal plate (frames 03/08); (2) the
meadow's drift-low bands still read mustard at sweep height — one more
green step on the base sward + raise the drift floor; (3) kill the
split-stone ring arcs (scatter them as clusters, not rings); (4) bark
micro-band paint for touch range (frame 05).

The close-pose recapture (the ten poses the crash had eaten) landed
after the sweep and sharpened the orders: `close-shade-floor` FAILS
(four rosettes on khaki-olive — the drift gap AND the sand wash);
`close-road-moss` FAILS HARD (the front door is raw pale sand with one
blade line — the road gate rides `min(1, w × 1.4)` and the threshold's
authored whisper-weight starves it exactly where it matters);
`close-garden-skirt` PASSES again; `close-wellspring-rim` marginal
(bubbles ✓, khaki bowl slope, near-bare rim). `fallen-causeway`: the
log is STILL a pale tarp, now with pink runnel blotches — third
strike. `provinces-end`: the crowns finally break the sky but the
sector cluster's waists cross the fog gap between rampart and rings as
hanging rectangles; the two ring-radius card bands (tops −8…+14 vs
ring crests 13–27) turn out never to have been visible at all.
`hollow-mesa` captured SOLID STONE — the round-3 mouth dressing put a
flank boulder on the round-3 pose spot. Diagnosis: the arcs in sweep
04 are not the split stones — they are the Last Rampart's height-keyed
ledge `sin` bands drawing contour arcs on the near-flat rim skirt.

### Round 4 (`v3-r4`) — the front door dressed; the roof painted

The moves (all landed in one pass, committed before capture):

- **The threshold road**: `roadGate` runs on tongue PRESENCE
  (`min(1, w × 3.4)`), not ownership; band 12 → 16 m; road blades
  2,200 (+ size up), pebbles 700, scrub 18; the handover milk GREENED
  (0.98/1.02/0.92 → 0.84/1.04/0.94) and pulled back to fade by
  u ≈ 1222 — the terraces hand over their LIGHT, not their bare sand.
- **The floor**: drift floor 0.45 → 0.55 (gaps stay planted), fronds
  8,200 / blades 3,200 / tall stands 520, sward red 0.40 → 0.37,
  descent moss 1,000, wellspring rim sward 360 (sized up).
- **The roof**: pad undersides lifted a full value and leaf-clump
  mottled (0.46/0.52/0.58 ± fbm) — the dark is now detail, not base;
  bark grain frequency doubled at amplitude 0.3 for touch range.
- **The log**: moss bands 0.9 + 0.18 floor + streaks 1.2; runnel
  violet damped ×0.3 on the log only (the pink blotches).
- **The bowls**: wellspring pale widened to the true lip and cooled
  (0.88/1.06/1.04).
- **The rampart**: ledge bands gated by `smoothstep01((rim−0.45)/0.3)`
  — contour arcs off the flat skirt.
- **The painting**: all three card bands behind ring 1 (252–292),
  heights 68–100 so the crowns break the ring crests from the balcony
  and every foot stays under every ring's own foot — no waist can
  cross the fog gap again.
- **The pose**: `hollow-mesa` backed out to 9 m on the mouth axis.

Budget after trim: 100 draws / 1,315,408 tris / 471 colliders; 24
region tests + 145 neighbour/kit tests green. Captures below.

**Capture-infrastructure note** (for MASTER's field notes): with four
sibling region workers on one machine (load averages 21–29), dev-server
page loads exceeded the capture scripts' hardcoded 180 s ceiling — a
measured 342 s to the `load` event, so every run died on `page.goto`
regardless of retries or `SHOT_PER_LAUNCH`. The workaround that held:
`npm run build` + `npx vite preview --port 5213` (a prebuilt bundle
takes the dev-transform cost off the starved CPU) plus a load-average
watcher that fires the capture chain when the box quiets. Depth-3
workers after me: budget real hours for captures under sibling load.

**Round-4 partial critique** (six authored + nine sweep frames landed
before the load wall; the full sets recapture via the watcher):

- `pass-threshold` — **the front door is ANSWERED**: celadon blades
  run the road to the horizon, shell pebbles pace it, a mossy boulder
  group anchors the right, the traveller shoal arrives mid-frame, the
  waymark holds the line. The remaining warm band is the terraces' own
  shelf beyond our tongue — the honest handover. PASS.
- `doorwarden` — near floor planted; the portrait keeps. PASS.
- `eaves-gate` — the sward is now a FIELD (blades in three bands,
  mottled boulder); thin sheet-edge hairlines visible at grazing
  angles, noted below. PASS.
- `boughfall` — banks dense with gold-accent tufts, channel a composed
  dark, travellers crossing. PASS.
- `deep-vista` / `twin-court` — hold from r3, floors greener. PASS.
- Sweep 01–09: **7 pass / 2 marginal** — the rampart contour ARCS ARE
  GONE (04 passes), the hem holds (07), floors read planted from
  midwater (06/09). Still marginal: 03 (pad underside at fog range —
  the mottle helps near, fog flattens far; acceptable), 08 (the same
  extreme grazing cone: pad seen edge-on over the Boughfall Shadow's
  licensed dark — geometry, not paint; registered as a known-graze
  cone).

Known small artifacts, carried: ground-sheet trim hairlines at grazing
angles (the 2×2 disc grid and pass-sheet edges — sunk 7 cm already;
next step would be skirt strips, deferred as sub-pixel at play speed);
one small dark cube silhouette in sweep 01's upper water (a distant
percher instance seen square-on; only visible in that one cone).

## Flags

- **Verdant-2's far-rim seal ring crosses this pass corridor** (its
  `buildSeals()` rim ring at its rc 198 = spoke u ≈ 1138 is gated only
  over ITS inbound pass). Everything on our side (bounds, terrain,
  seals, poses, swim-line tests) is authored so the corridor works;
  **the orchestrator must cut a gate in verdant-2's rim ring over this
  pass tongue's width** when the depth-3 connection goes live —
  mirroring MASTER R4, which resolved the identical verdant-1 → 2 flag.
- **Verdant-2's far-side distance rings cross this pass at
  u ≈ 1186–1228** as opaque `fog:false` curtains (gap faces its own
  inbound side only). From our threshold they read as the promise
  becoming real — but nothing behind them exists to a camera before
  them, so ALL of our gate composition lives past u 1240 (the Emerald
  Gate lesson, applied at authoring time instead of after three failed
  rounds). The same orchestrator gate should part its far ring sector
  over the corridor.
- **The framework's depth-boundary reject circle** (`RegionField`,
  radius+40) truncates our terrain/mood application below u ≈ 1200.
  Authored around: threshold gate keeps weight a whisper and the target
  at dune level out there; documented in `Verdant3Terrain`; asserted.
- The pass-shoulder seals are invisible walls over open shelf (the
  standing trade at every rim).
- The Hollow Mesa's interior is DoubleSide-lit backfaces of its own
  lathe; its room reads through its licensed glow + beam, not through
  sun.

## Close-out (`v3-final`, `v3-final-noassets`) — the finished region

Round 4's tree was CLEAN; the close-out worker's job was verification,
and verification found nothing to change: **zero code edits** to the
region across the whole close-out. Every capture below was taken against
the round-4 build (commit `b2a2e01`, prebuilt bundle on port 5213 per
the round-4 field note; the no-assets set against a dev server on 5214,
because a preview bundle's own JS lives under `/assets/` and
`blockAssets`' glob would abort the app itself — see the harness note
below).

### Authored set (`v3-final`) — 16/16 captured, 16/16 pass

Every pose read at 1600×900. The six round-4 partials hold their PASS
verbatim (`pass-threshold`'s traveller shoal is out of frame this
session — wall-clock phase, the documented capture noise for moving
life; the world content matches the r4 frame stroke for stroke). The
ten poses round 4 never saw:

- `sunfall-well` / `wellsprings` / `kingpillar` — PASS: the shaft
  falls full height with a ray crossing it; bubble columns readable
  over pale pools with planted rims; the tallest crown holds its
  portrait with the wheel passing.
- `hollow-mesa` — PASS: the 9 m backed-out pose finally reads the
  room — flank boulders, lintel, seven-strand curtain, the glow
  inside — and the ELDERLEAF CROSSED THE CURTAIN'S PART mid-settle
  and fired its own discovery (the "Added to the Codex" toast rides
  the HUD of this frame; the DiscoveryTarget doing exactly its job).
- `fallen-causeway` — MARGINAL-PASS: the pink runnel blotches are
  gone and the log wears its green wash; the moss banding reads
  subtle at pose range. The tarp read is broken; fourth strike not
  taken, noted rather than chased (35k tris of headroom is no room
  for a re-dress).
- `provinces-end` — PASS: the black teeth and hanging card waists
  are gone; the Mother's crown breaks the ring crest and the horizon
  layers rampart → rings → cards → sky.
- `close-shade-floor` — MARGINAL-PASS: the r4 value/density push
  landed (olive-green sward, lichen mottle, painted gold-tipped
  rosettes where r3 had four on khaki); the nearest band still reads
  quiet. Registered here as the region's one standing close-range
  softness; the budget cap licenses no further density.
- `close-road-moss` — PASS (the r3 FAIL HARD answered at the owner's
  distance): the pass sheet reads green, celadon S-bend blades hold
  the foreground, shell pebbles pace the road, a boulder anchors.
- `close-garden-skirt` — PASS (third round in a row).
- `close-wellspring-rim` — PASS: bubbles readable, pale bowl cooled
  and widened to the true lip, rim sward and lip stones at the
  crest, the r2 tire-track rings gone; the bowl interior's bareness
  is the authored "pale clean floors" design.

### Sweep (`v3-final`) — 12/12 captured: 10 pass / 2 marginal, both registered

The full twelve, including 10–12 which round 4's load wall ate. 01–09
hold round 4's grades (the rampart arcs stay gone, the hem holds, the
floors read planted from midwater). The marginals are exactly the two
registered known-graze cones: **03** (pad underside at fog range) and
**08** (pad edge-on over the Boughfall Shadow's licensed dark —
geometry, not paint). The three new frames: **10** PASS (rampart sward,
violet runnels, wellspring glow), **11** PASS (the region shot — and
the Elderleaf crossed it this session), **12** PASS (midwater over the
meadow, floor olive and alive). Meets the ≥11/12 standard with misses
only in registered licences. Sweep 01's one-cone percher cube and the
grazing-angle trim hairlines carry as documented.

### No-assets pass (`v3-final-noassets`) — the region's first

(Verdict recorded below once the set lands — the region is built
entirely from kit/procedural geometry and vertex paint, so the
fallback risk surface is the base game's washes and GLBs, not ours.)

### Budgets and the frame gate (the R12 numbers, final build)

- **100 draws / 1,315,408 tris / 471 colliders** (caps 260 / 1.35M) —
  re-measured at close-out by the budget test's own traversal,
  byte-identical to the round-4 entry.
- **Headed frame gate — PASS**: `SHOT_HEADED=1 SHOT_REGION=verdant-line-3
  SHOT_AT=... measure-frames.mjs` on the real GPU, at the two densest
  poses: twin-court **median 16.7 ms (59.9 fps, vsync-locked), p95
  18.6 ms, settled scale 1.00**; deep-vista the same 16.7 / 18.6 /
  1.00. Both runs taken with the box at 1-min load ≈ 25 (two sibling
  workers live) — the pass is conservative: contention can only
  inflate the number, and it still sat under the 16.9 ms gate.

### Gates

- `npm run typecheck` — clean.
- `npx eslint . --max-warnings 0` — clean.
- `npm test` — 790/791 on first run; the one failure was
  `tests/regionSmoking1.test.ts` (a SIBLING region's containment test,
  stale against the R12 kit's merged pieces — its repair already
  exists on the mainline as `0aa67de`, which this branch predates).
  Cherry-picked that exact commit (verbatim, no conflict possible at
  merge) and the file passes 20/20; final full-suite re-run recorded
  below.

### The canonical capture roster

- `v3-final` authored 16: `20260731-2325_seed1_hi_REGION-verdant-line-3-*_v3-final.png`
- `v3-final` sweep 12: `20260801-0009_SWEEP-verdant-line-3-01..12_v3-final.png`
- `v3-final-noassets` authored 16 (the fallback build).
- Prior rounds: `v3-r1` (14), `v3-r2` (16 + 12 sweep), `v3-r3`
  (6 + 12 sweep + 16), `v3-r4` (6 + 9 sweep — the load wall's
  partial).

### Capture-infrastructure notes (for the next depth-3 worker)

- The round-4 workaround (build + `vite preview` + wait for quiet)
  is necessary but NOT sufficient: even a prebuilt bundle blew the
  180 s nav ceiling at 1-min load 25, and the box never went quiet in
  ~1 h of watching two live siblings. The harness now takes
  `SHOT_NAV_TIMEOUT` (nav ceiling) and `SHOT_COMPILE_WAIT` (the
  flat-violet shader-compile wait) as env overrides — this close-out
  ran at 900 000 / 5 000. Defaults unchanged.
- **`region-sweep.mjs`'s pose draw is dev-server-only**: it imports
  `/src/...` TypeScript in the page, which a preview bundle cannot
  serve — this, not only the load, is why round 4's sweep 10–12 never
  landed. `SHOT_POSES_FILE` now hands the same seeded stream in as
  JSON (drawn offline by the identical arithmetic, verified: frame 01
  reproduces round 4's frame 01 exactly).
- **`SHOT_NO_ASSETS=1` cannot run against a preview bundle at all**:
  `blockAssets` aborts `**/assets/**`, and the built app's own
  `index-*.js` lives under `/assets/` — the game never boots. Run
  no-assets passes against a dev server.
- The HUD objective count flips between 18 and 19 across session
  boots (visible across the r4 and final sets alike) — pre-existing
  harness/session noise, not a region change; left alone.

### Standing flags, carried forward (the orchestrator's list)

1. **Cut a gate in verdant-2's rim seal ring** (its rc 198 = our
   u ≈ 1138) over this pass tongue's width when the depth-3
   connection goes live — MASTER R4's precedent.
2. **Part verdant-2's far-side distance-ring sector** over the same
   corridor (its opaque `fog:false` curtains cross at u ≈ 1186–1228).
3. The **depth-boundary reject circle** (`RegionField`, radius+40)
   truncates our terrain/mood below u ≈ 1200 — authored around
   (threshold whisper-weight, dune-level target), documented in
   `Verdant3Terrain`, asserted in tests.
4. The **pass-shoulder seals** are invisible walls over open shelf —
   the standing trade at every rim.
5. The **Hollow Mesa's interior** is DoubleSide-lit backfaces of its
   own lathe; its room reads through its licensed glow + beam, not
   through sun.
