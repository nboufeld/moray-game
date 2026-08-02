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
   guard); wall-crossing's razor line was blue-2's Worldwall crest — a
   perfect level circle silhouettes as a rule; the wing-door "solid blue
   wall" was pure cobalt fog with a 0.2-opacity veil invisible against
   its own fog-followed ink (toggle-proven: hiding veil+hole+distant-reef
   changed nothing).

## Per-item verdicts (before → after)

_Format: proof frame · before file · after file · verdict._

(filled per capture round below)

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
- Headroom: blue-2 ledger ~640k free, blue-3 ~540k free — deltas above
  are noise against those.

## The loop log

Round 1 (this commit): class fixes landed, first recapture pending.
