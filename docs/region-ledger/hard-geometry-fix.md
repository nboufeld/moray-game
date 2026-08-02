# Hard-geometry purge — the critic's wave, card/polygon class

Worker ledger for punch items #1, #3, #7, #15, the C4 extras and stretch
#11 (docs/CRITIC-REPORT.md). Rule of the wave: every occurrence of hard
card geometry the camera catches — razor tops, stepped rectangle
corners, flat card bands, translucent panes — is one class, fixed as a
class. The no-reroll fence held throughout: every change is geometry
profile, vertex paint, alpha fade or added relief; no placement stream
was consumed differently (region determinism suite green after every
commit).

## The systemic diagnosis (what the class actually was)

Every proof frame traced to one of FOUR shared grammar defects, not to
sixteen local ones:

1. **Two-row opaque horizon strips.** calamity/pale-2/smoking-2/blue-1
   drew their painted distance as two-row `fog:false` curtains: pixel-hard
   razor top edge, `Math.max(1.2…1.4, …)` min-height clamps running the
   gap ends as floating slab ribbons (the pale-10 defect), and the 160 m
   far plane slicing opaque arcs into vertical edges. Blue-2 and golden-1
   had already evolved the cure (three rows, RGBA crest dissolve,
   camera-distance self-dissolve) — extracted into
   `src/world/regions/kit/HorizonCurtain.ts` and applied to every ring.
2. **DistantReef across the wing rims.** All four wing defects (#7
   moonlit "moon pool" cyan polygon, #15 wreck-meadow diagonal seam,
   DOOR-current-run ghost pyramid, ruins-terrace sky triangles) were ONE
   owner: the bowl's skyline rings standing 5–40 m past every Tier-B rim,
   unfogged, in bowl-teal, with hard tops and triangular peaks —
   toggle-proven per frame with scripts/diag-hide.mjs. Blanket partings
   over all fifteen wings would erase the bowl's whole skyline (the wing
   belt covers the full circle), so the fix is a camera-following parting:
   when the camera stands past r ≈ 19 (every wing interior and doorway
   stand, never the bowl's heart) the ring sector ahead of it eases open
   in-shader, and the painted backdrop — which wing moods already fade
   correctly — shows instead.
3. **The additive fog-add.** kit `DappleSheet` ran `fog: true` on an
   additive material, which ADDS the fog colour across the sheet's whole
   footprint — the golden oasis "water-volume edge" was the sheet's grid
   cut through that haze. Now `fog: false` (the kit's own light-column
   discipline) with a hand distance-dim.
4. **The Great Blue's wall was absent, not flat.** The wall-face razor
   band was blue-1's rim lip over BARE FOG (nothing paints the drop's
   near face); the arcs beside the camera were opaque blades (no near
   guard); the wing-door "solid blue wall" was pure cobalt fog with a
   0.2-opacity veil invisible against its own fog-followed ink
   (toggle-proven: hiding veil+hole+distant-reef changed nothing).
5. **The far-plane cut (wall-crossing's actual razor).** Round-2
   diagnosis: the wall-crossing "flat teal card band with stepped
   corner" was NOT the Worldwall crest (round 1 notched it; the line
   survived byte-identical). Raycast probes put every boundary hit on
   `deepsteps-ground-disc` at y ≈ −47 — the flat bowl floor — and the
   line sat exactly where that floor crosses the camera's 160 m far
   plane (sin⁻¹(47.7/160) ≈ the measured pitch). Plane∩plane is a
   razor-straight line; where the clip cuts the rising wall instead,
   it steps — the "stepped rectangle corner". Fog was already fully
   saturated there (0.0279 × 158 m ≫ 1; doubling density changed
   nothing, toggle-proven), so the step is FOG COLOUR against the
   painted BACKDROP GRADIENT — a mismatch no density can close. The
   class fix: `applyFarClipDissolve` in `rendering/ToonShading.ts`, a
   discard-based interleaved-gradient-noise screen-door across
   118→156 m of fog depth, applied in `createSandMaterial` — every
   region's ground sheet (the one surface vast enough to cross the
   clip in frame) now melts into the backdrop instead of being sliced
   by it. Opaque render path kept: no transparency, no sorting change.
   The same cut was calamity-08's straight two-tone division and part
   of the pale/smoking horizon steps.

## Per-item verdicts (before → after)

_Format: proof frame · before file · after file · verdict._

- **#1 wing-door** (`JOURNEY-great-blue-02`) ·
  `20260802-0629_…wing-door_before.png` →
  `20260802-0808_…wing-door_final2.png` · **FIXED.** The edge-to-edge
  cobalt wall is a framed passage: warm jambs, rust overhang, promise
  planes layering the blue beyond, the old opaque curtain now a near-
  dissolved veil (it stood 1.4 m from the lens filling the frame —
  raycast-proven).
- **#1 wall-face** (`JOURNEY-great-blue-07`) ·
  `…wall-face_before.png` → `…wall-face_final3.png` · **FIXED.** The
  razor teal band reads as painted cliff masses in fog — blue-violet
  curtain planes with broken crests and strata, the far floor melting
  into the backdrop through the clip dissolve instead of ending on a
  rule.
- **#1 wall-crossing** (`JOURNEY-great-blue-11`) ·
  `…wall-crossing_before.png` → `…wall-crossing_final3.png` ·
  **FIXED** (round 2 — see diagnosis 5). The razor line and the
  stepped rectangle corner were the 160 m far plane slicing the bowl
  floor and wall; both now dissolve into the backdrop across a soft
  40 m grade. The round-1 crest notching stays (it breaks the true
  crest from nearer stands) but the clip was the defect.
- **#3 calamity reveal** (`JOURNEY-calamity-07`) ·
  `…the-reveal_before.png` → `…the-reveal_final3.png` · **FIXED.** The
  stepped paper rectangles under the ruin arcs are a soft graded band
  with a dissolved crest fringe.
- **#3 calamity last-grove** (`JOURNEY-calamity-08`) ·
  `…last-grove_before.png` → `…last-grove_final4.png` · **FIXED for
  the flagged class, residual flagged.** The fault-step rectangles are
  gone. A straight two-tone division remains at the shelf horizon:
  toggle-proven to be the pale fogged shelf's own horizon (a flat
  world's horizon is a straight line) against the backdrop painting's
  dark ash band — a VALUE mismatch, not card geometry. The ruin
  curtains that would occlude it stand at radius 246–286, beyond the
  160 m clip from every shelf stand, so no curtain can dress that
  line. Rim-band notching + the clip dissolve fringe soften it; the
  full cure is fog/backdrop value harmony at the horizon band — a
  mood-level change outside this worker's fence. FLAG for the
  orchestrator.
- **#3 pale-10** (`JOURNEY-pale-10`) · `…pass23-back_before.png` →
  `…pass23-back_final3.png` · **FIXED.** No floating slab ribbons; the
  reef ring ends dissolve, the crest is a fine grass fringe.
- **#3 smoking/others** — same ring class, converted with the kit
  (smoking-1/-2/-3, pale-1/-3, verdant-1/-2/-3, blue-1, calamity);
  smoking horizons verified via the region conversions' spot frames in
  the first capture round.
- **#7 moon pool** (`WING-moonlit-lagoon`) · `…WING-moonlit-lagoon_
  before.png` → `…_final.png` · **FIXED.** The flat saturated cyan
  polygon is gone; the pool rim is a soft earth crest, water graded in
  register (DistantReef follow-parting + soft ring grammar).
- **#15 wreck-meadow seam** (`WING-wreck-meadow`) · before → final ·
  **FIXED.** The straight diagonal splitting two blues overhead is
  gone; one graded teal opening framed by the wreck ribs.
- **C4 ruins-terrace sky** (`WING-ruins-terrace`) · before → final ·
  **FIXED.** No hard teal triangles; sky is a smooth grade.
- **C4 current-run ghost pyramid** (`DOOR-current-run`) · before →
  final · **FIXED.** Doorway shows a soft blue passage with shafts; no
  translucent pane.
- **C4 golden oasis edge** (`CRITIC-golden-waste-1-02-mid-down`) ·
  before → final · **FIXED.** The corner-to-corner water-volume edge
  is gone; the dapple dims with distance instead of fog-adding a hazy
  rectangle.
- **#11 gnomon + mooring** (`JOURNEY-great-blue-04`/`-08`) · before →
  final · **DONE.** `washCalm` desaturation reads as calm painted
  stone; the arch's texture noise is quieted.

## Budget deltas

- blue-1 painted distance: +2 draws (Far Wall face curtains), ≈ +1.8k
  tris; deep arcs/prairie rings same column counts, 3 rows instead of 2
  (≈ +1.6k tris total across 7 rings).
- open-blue wing: +2 draws (doorway promise planes), ≈ +440 tris, inside
  the dressing group (shallow child counters untouched).
- DistantReef: same 3 draws; ≈ +1.1k tris (third row).
- calamity/pale-2/smoking-2 rings: +1 row each ring, ≈ +1.3k tris per
  region; no new draws.
- blue-2: zero new geometry (sheet vertex edits only).
- calamity-1: zero new geometry (rim-band sheet notching only).
- far-clip dissolve: zero geometry, one shader branch on the shared
  sand material (every region ground); discard-based, opaque queue and
  depth writes unchanged.
- Headroom: blue-2 ledger ~640k free, blue-3 ~540k free — deltas above
  are noise against those.

## The loop log

Round 1: class fixes landed (kit curtains, DistantReef parting, dapple
fog-add, blue-1 wall paint, open-blue door, washCalm), first recapture
read.

Round 2: wall-crossing survived round 1 byte-identical → re-diagnosed
with hide/raycast/material toggles: the razor was the 160 m far plane
cutting the ground disc (diagnosis 5). `applyFarClipDissolve` landed on
the shared sand material; wall-crossing, wall-face, calamity-07 and
pale-10 recaptured clean. The wing-door curtain fix (near-dissolve on
`w4-openblue-curtain`) verified in `final2`. calamity-08's residual
two-tone horizon division traced to backdrop-vs-fog value mismatch at
the shelf horizon — softened (rim notching + dissolve fringe), fully
curable only at mood level; flagged.
