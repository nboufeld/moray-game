# Edges-and-shaders — the second critic wave, edge class

Worker ledger for CRITIC-REPORT-2 items **N1** (far-clip stipple band),
**N3 + #17** (kelp card / canopy read), **N4** (terrain-bake diagonal
creases), **N5** (golden wing-door white quads), **#7** (moonlit moon
pool, still short) and **#3** (horizon notch residual). Branch
`fix/edges`, worktree `worktrees/fx-edges`, port 5215 (curl-verified
200 before every run). The re-critic's framing held throughout: "where
the first report charged emptiness, this one charges edges" — every fix
below is shader, ink, bake or profile work; the no-reroll fence never
moved (kelp stalk hash `4264248344` green, tierb reroll sentinels green,
every determinism suite green after every commit).

Befores: the committed `docs/report-frames/` proofs, re-verified by
fresh captures on this tree before any fix (`visual-qa/*_edges-r1`,
which reproduce every charged artifact pixel-for-pixel except where
noted). Afters: `visual-qa/*_edges-r2` (+ later rounds where a fix
needed a second cut), captured with the same scripts at the same poses:
`journey-shots.mjs`, `critic-offroad.mjs`, `tierb-wing-shots.mjs`,
`capture-shots.mjs` (`Z-kelp-canopy` control).

## N1 SHOULD-FIX — the far-clip stipple band

**Diagnosis.** `applyFarClipDissolve` (rendering/ToonShading.ts) was a
binary screen-door: interleaved-gradient-noise threshold → whole-pixel
`discard` across 118→156 m. At the half-mixed middle of that band the
frame is a one-dot-per-pixel checkerboard of fog-coloured sheet against
backdrop — and no noise re-ordering can cure that, because a 50 % mix
of two DIFFERENT values at whole-pixel granularity is a visible pattern
by construction. That band sat across two top-twelve skies (afterglow
garden, daybreak) and printed the wall-face/crossing stipple lines.

**The cure's design (the stipple cure).** Sub-pixel coverage instead of
whole-pixel discard: `material.alphaToCoverage = true` on the shared
sand material, with the fade written to `gl_FragColor.a` after the fog
mix. The composer's render targets are 4× multisampled
(`RendererAdapter.MSAA_SAMPLES`), so alpha-to-coverage turns the same
fade into per-sample coverage masks — a half-dissolved pixel RESOLVES
to a true 50 % blend of sheet and backdrop: a grade, not a grid. The
four coverage levels would band across a 40 m melt, so one IGN jitter
of ±half a coverage step (±0.125) stays in the alpha — the old noise,
now hidden inside the hardware resolve instead of printed on the frame.
The opaque queue, render order and depth writes are untouched (coverage
is an opaque-path device — the whole reason the original chose discard),
and a hard `discard` remains at fade ≥ 0.995 so the sheet still ends
before the clip even on a non-multisampled target. Band window
unchanged (118→156 m); no geometry, no draws, one shader branch — the
same budget shape as the original.

**Verdicts (before → after):**

- `JOURNEY-golden-12-afterglow-garden` (`report-frames` + `edges-r1`
  reproduction → `edges-r3`): **fixed.** The before's dotted screen-door
  band across the mid-distance obelisks is gone entirely — the pillars
  now grade into the afterglow haze as continuous tone, no pattern at
  any distance ring, and the garden floor's far edge melts instead of
  pixel-sieving.
- `JOURNEY-pale-12-daybreak`: **fixed.** The mesas dissolve into the
  milky daybreak band with a clean gradient; the stipple field that sat
  across the mid frame is absent, and the far spires end in fog, not in
  a dot lattice.
- `CRITIC-golden-waste-3-01-roadside-cross`: **fixed.** The left mesa
  face — the frame where the band cut straight across a near-flat sheet
  — now fades smoothly into the dust haze; no checkerboard at the
  half-mix distance.
- `JOURNEY-great-blue-07-wall-face`: **holds.** The wall sheets grade
  into the blue with no stipple line and no re-appearance of a hard
  boundary.
- `JOURNEY-great-blue-11-wall-crossing` (regression guard — must not
  return to the razor clip): **holds.** No straight-line clip anywhere
  in the crossing sky; the far wall is fully melted before the plane.

## N3 SHOULD-FIX + #17 REGRESSED — the kelp cards

**Honest diagnosis first.** Captured before touching anything: the
`edges-r1` calamity bowl frame reproduces the razor-edged olive card
exactly. The card is a giant's crown blade over the stand at
(0.5, −16) — placement bit-identical since W-N2 (streams frozen), so
the REGRESSION is not a merge artifact: it is the wings-polish
softening itself. That pass halved the cup fold (0.1225–0.18 →
0.07–0.105) to stop the V-crease straddling toon band boundaries — it
did stop the splits (its own before/after at `Z-kelp-canopy` was
honest), but a nearly-flat blade caught edge-on/backlit at a bearing
the softening never captured IS a flat card with razor margins. The
tell was bearing-dependent, not stream-dependent.

**Fix.** Profile changes in `shapeLeaf` (src/world/Kelp.ts), all drawn
from the per-leaf detail hash (zero stream draws), all inward-only in
the ground plane (lane fences hold by construction). Two cuts — the
first was captured, read, and found short, which is its own lesson:

1. **The cup comes back as curvature — but it must curve OUT OF the
   plane.** Depth restored to the W-N2 range (0.12–0.18) as a PARABOLA
   (no crease to park on a toon band boundary, the defect the halving
   chased). The r2 frames then showed the bowl card nearly unchanged:
   the first cut spent the parabola along the GROWTH axis only, which
   sweeps the margins back in-plane — a swept-back blade is still a
   PLANE, and seen flat from below it is still a card. The second cut
   applies the same parabola along the vertical too (the ruffle's own
   licence — nothing moves in the swept plane): a true cross-section
   curl, ~14–21° of normal turn across the width, so the underside
   grades across a toon band and the near margin rolls instead of
   shearing off.
2. **A spine twist with a FLOOR** (~10°–24° at the tip, zero at the
   root): a flat ribbon has exactly one bearing per surface at which
   its whole length is a razor edge; a twisted one has none. The r1
   cut drew the twist as a plain signed value — one leaf in six turned
   under 4°, and the bowl's sky-filling pad drew one of those. Flat is
   the one shape the term exists to forbid, so the magnitude now
   starts at ~10° and the draw only adds. Horizontal reach only ever
   shrinks (`across · cos θ`).

The frozen stalk hash, lane sweeps, canopy-mass floors and anemone
disc: `tests/kelp.test.ts` green, unmodified.

**Verdant-3 canopy (the #17 co-charge).** The floor-up frame's "hard
dark polygon outlines" on the crown pads were diagnosed by crop: thin
BRIGHT hairlines along triangle edges — real cracks, not shading. In
`Verdant3Canopy.padGeometry` the rim droop multiplied by
`random.range(0.5, 0.8)` **per vertex**, and a torn icosphere is a
non-indexed soup: each copy of a shared edge vertex drew a different
fall, so the skirt tore along every edge and the bright backdrop shone
through the gaps. The droop jitter is now keyed on the vertex
direction (wrapping fbm of the same amplitude); the old draw is still
consumed so every pad placed after keeps its exact stand — the canopy
layout is byte-identical, only the tears close. `regionVerdant3`
budget/determinism green (zero draw/tri delta).

**Verdicts:**

- `JOURNEY-calamity-00-bowl` (→ `edges-r3`; the r2 cut was captured,
  read, and found short — see the two-cut note above): **fixed.** The
  sky-filling pad is no longer a uniform razor-margined card: the
  underside carries a visible toon gradient across its width, the near
  margin rolls into a dark rim instead of shearing off, and the thin
  green streak at frame right — formerly a zero-width razor line — is
  now a curved blade with readable width and its own band. The charged
  read ("razor-edged olive card") is gone.
- `CRITIC-verdant-line-3-03-floor-up`: **fixed.** The crown pads read
  as solid, watertight silhouettes — the bright hairline cracks along
  the skirt edges (the "hard dark polygon outlines" charge) are closed;
  no backdrop shines through any pad.
- `Z-kelp-canopy` control (the wings-polish verdict must hold):
  **holds.** No V-crease splits return; the blades read as cupped,
  twisted ribbons with vein gradients, and the canopy mass is intact.

## N4 NICE — terrain-bake diagonal creases

**Diagnosis.** Two manifestations, one bake-contract class. The class:
every ground sheet gets its normals from `computeVertexNormals`, which
has two defects at this scale — a boundary vertex averages only ITS OWN
sheet's faces, so abutting/overlapping tiles disagree along the shared
line (a world-axis seam reads diagonal against the spoke); and every
quad splits along the same diagonal, so strong carve curvature shades
as a diagonal fold (the lumen door slope's crease). Toggle-proven at
the verdant-2 mid-down stand: the diagonal survives hiding the pass
sheet and dies with the disc tiles — it lives in the sheets themselves.

**Class fix (contained).** `createSeabedGeometryAt` (src/world/
Seabed.ts) now derives normals ANALYTICALLY from `seabedHeight` by
central differences (0.5 m step): the height field is one continuous
world function, so the normal is identical whichever sheet asks —
sheet-edge seams and triangulation-direction shading vanish by
construction, for every region sheet, the bowl floor and the wing
carves at once. No bake-format change needed; no flag left open beyond
the verdicts below.

**Verdicts:**

- `CRITIC-verdant-line-2-02-mid-down`: **fixed.** The interior of the
  slope shades continuously under the light dapples — the diagonal
  shading crease that ran against the paint gradient is gone. (The one
  diagonal left in frame is the slope's own crest silhouette against
  open water — geometry, not shading, and not the charge.)
- `DOOR-lumen-garden` (right-slope crease): **fixed.** The door slope
  shades smoothly from crest to floor; the polygonal fold-line down the
  right slope is absent.

## N5 NICE — the white quads in golden's wing-door

**Diagnosis (node-toggle bisect, the long way).** The first bisect
convicted the WING's `sandfall-curtains` — falsely: a projection test
in the live page showed zero of that mesh's vertices in the door frame
(all three wing falls stand behind the camera), and the earlier
"exoneration" of the region's falls turned out to be a confounded
capture (a hide applied before a settle is lost if the streamer
rebuilds the region mid-capture). An isolated, repeated, animation-
controlled toggle pinned it: **golden-waste-1's
`hourglass-sandfall-curtains`** — specifically the five VALE falls,
which hang dead down the door's sightline at 55–130 m.

**The ink bug.** `alpha = min(fall.alpha, bell·envelope·streak·alpha)`:
wherever a bright streak column pushed the product past the cap, the
`min` flattened the bell and envelope into a constant-alpha plateau —
a hard-edged translucent rectangle, `fog: false`, cream-bright at a
hundred metres. Two-part fix in `GoldenFalls.buildCurtains`: the cap
now clamps the STREAK term only (`bell·envelope·min(1, streak)·alpha`),
so the edge gradients survive at every brightness; and the curtains
take the gate veils' self-mixed-ink discipline — the cream converges
85 % of the way to the live `scene.fog` colour across 30→100 m, so the
vale falls sink into the door's haze while terrace up-shots inside
30 m keep the full cream and the cross-chasm ring keeps a pale mark
(the round-5 "a bright mark pays its own way" ruling is kept where it
was earned and retired where it wasn't).

**Verdicts:**

- `JOURNEY-golden-02-wing-door`: **fixed.** Dead-centre of the door
  frame the vale falls now read as dim, hazy columns sunk into the
  door's blue-green haze — the faint white hard-edged quads are gone;
  what remains is soft streaking with no constant-alpha plateau
  borders.
- `JOURNEY-golden-04-oasis` (guard: the Hourglass ring's authored read
  must survive the fog-mix): **holds.** The oasis light column still
  stands bright over the ring; inside 30 m the cream is untouched by
  the mix, and the terrace read is unchanged.

## #7 IMPROVED-BUT-SHORT — the moonlit moon pool

**What the frame says is missing.** Two things. The pool of moonlight
itself does not read at the interior stand — a 2.3 m decal at 0.2
additive is sub-threshold under the night mood — so the "luminous
water" premise has no visible source. And the far crest against the
backdrop is one razor-straight full-width line: geometry frozen, value
step unbroken.

**Fix (src/world/wings/flora/MoonlitLagoonFlora.ts, inside the Tier B
uplift group).** The pool decal grows 2.3 → 3.4 m and lifts 0.2 → 0.34
(the moon-grass keep-clear gate still measures from `MOON_POOL.radius`,
so no blade re-places — the Tier B probe pins hold). And the rim takes
a **luminous brim**: one arc of soft additive silver hugging the crest
silhouette (crest sampled from the terrain per column), peak alpha on
the rim line, dissolved upward into the water band and downward into
the wall, with a direction-keyed swell so the brim breathes — light is
the night register's grass fringe. +1 draw, declared in
`POLISH_DRAW_ALLOWANCE` (the wings-polish precedent), program envelope
still gated; every vertex inside the wedge, far outside the koi band;
no stream consumed.

**Verdict:**

- `WING-moonlit-lagoon`: **fixed.** The crest is no longer one
  razor-straight full-width line: the luminous brim sits exactly on the
  rim, brightest at the silhouette and dissolved both ways, with soft
  light columns rising into the water band — the band above the crest
  now reads as the lagoon's own lit water, not as sky. The pool decal
  reads at the interior stand.

## #3 IMPROVED-BUT-SHORT — the horizon notch residual

**Diagnosis.** What still steps is not card geometry (the
HorizonCurtain class killed that): it is the class the hard-geometry
ledger flagged to the orchestrator — fog-vs-backdrop VALUE mismatch at
a flat horizon. At base mood fog and backdrop agree by construction
(`UnderwaterFog` samples the fog off the painting's horizon strip);
under any region/wing mood the fog is re-coloured (`colorScale`) while
the backdrop only dims (`backdropFade`), and a flat world's horizon
prints the difference as a straight line: calamity-08's shelf
division, pale-10's band edges, wall-crossing's two-tone.

**Class fix (framework).** `src/world/HorizonFogBand.ts`, mounted once
in `Reef.buildDistantReef`: a camera-following cylinder at 150 m whose
ink is copied from `scene.fog` every frame — alpha 1 far below eye,
dissolved to nothing ~4° above it. Below the horizon it paints fog
over fog (invisible by construction); above it, it eases the
backdrop's lowest degrees into the exact colour the fogged world ends
on, at every bearing, under every mood/weather/twilight (they all
write `scene.fog`). Self-limiting where wings clear the water: its
opacity is the fog's own saturation at 150 m, so a glass-water wing
thins the band with it. +1 draw, 384 tris, backdrop class (never in
`obstructionMeshes`/`colliders`).

**The two bugs the r2 frames caught (worth the ledger).** The r2
"afters" for this item were byte-identical to the befores — the band
was rendering ZERO pixels, proven by an on/off toggle diff and a
raycast that refused to hit it. Two independent causes, both now in
the module's comments so they cannot be re-made silently:

1. **Winding vs `BackSide`.** The ring triangulation's inner surface
   is its FRONT face; `side: BackSide` therefore culled every fragment
   of the only view the band has (from inside). Now `DoubleSide` —
   384 triangles cannot justify a culling footgun.
2. **`renderOrder −20` under the distance sheets.** The band writes no
   depth, and every `*Distance` wall and DistantReef ring (renderOrder
   −15…−3, standing at 170–215 m — spatially BEHIND the band) drew
   after it and overpainted the whole sky. Order now follows the
   geometry: backdrop sheets first, the band at −2 over them, near
   veils (≥ 0) over it in turn.

With the band live, the on/off toggle at the last-grove stand shows
the charge and the cure directly: off, the fogged shelf ends on a
razor two-tone against the backdrop; on, the same bearing is one
continuous grade through the horizon. Afters re-captured as
`edges-r3` (the r2 set is void for this item).

**Verdicts:**

- `JOURNEY-calamity-08-last-grove`: **fixed.** The shelf's far edge no
  longer prints a razor two-tone against the backdrop — the horizon is
  one continuous grade from fogged water up into the painting, at every
  bearing in frame.
- `JOURNEY-calamity-07-the-reveal`: **fixed.** The reveal's horizon
  band steps nowhere; the fogged floor eases into the backdrop through
  the band's grade, and the light shafts read over a continuous sky.
- `JOURNEY-pale-10-pass23-back`: **fixed.** The pale band edges that
  striped the horizon are dissolved into one soft milky gradient; the
  distant spires stand in it without a line under them.

## Budgets

- N1: zero geometry, one shader branch + alphaToCoverage state on the
  shared sand material (program cache key bumped).
- N3 kelp: leaf-interior vertex moves only; draws/tris unchanged.
- N3 verdant-3 pads: zero delta (same vertices, same draws — the tears
  close in place). Region still 101 draws / 1,344,208 tris.
- N4: zero delta (normals recomputed differently at bake).
- N5: zero geometry; one uniform + two shader lines on one material.
- #7: +1 draw / ~330 tris (brim glow), inside the Tier B envelope.
- #3: +1 draw / 384 tris (horizon band), bowl-level backdrop.

## Gates

- `npm run typecheck` — clean.
- `npx eslint . --max-warnings 0` — clean (one config line added:
  `setTimeout` joined the scripts' in-page globals whitelist, the same
  list that already carried `window`/`requestAnimationFrame`, for the
  band diagnostic's in-page wait).
- `npm test` — 73 files / 1161 tests, all green. The fence suites in
  particular: `kelp.test.ts` (stalk hash, holdfasts, lane clearances,
  anemone disc) unmodified and green; every wing/connective reroll
  fence green; every byte-identical determinism suite green; every
  region budget suite green at its old numbers (the verdant-3 pad fix
  is zero-delta by construction).

## Flags for the orchestrator

1. **Two flags CLOSED.** The hard-geometry ledger's open flag
   (fog-vs-backdrop mood mismatch at the horizon) is closed by the
   `HorizonFogBand` class fix, and wings-polish flag 2 (terrain shading
   creases) is closed by the analytic seabed normals — both are
   framework-level, every region and wing inherits them with no
   per-site work.
2. **N1's cure assumes a multisampled target.** Alpha-to-coverage
   resolves through the composer's 4× MSAA render targets
   (`RendererAdapter.MSAA_SAMPLES`). If a low-end path ever drops MSAA
   to 1×, the dissolve degrades to the retained hard discard at
   fade ≥ 0.995 — a cut at the very end of the band, where fog is
   already ~fully saturated, so it fails soft; but a quality tier that
   changes `MSAA_SAMPLES` should re-capture the N1 poses.
3. **Two diagnostic scripts kept** (`scripts/diag-what.mjs`,
   `scripts/diag-band.mjs`): scene-graph census + raycast at a pose,
   and a live render-state interrogation of a named mesh. Both earned
   their keep in this wave's bisects (the false conviction in N5, the
   two zero-pixel bugs in #3) and cost nothing at runtime.
