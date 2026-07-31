# Ledger — connective-2 (Phase 3, Batch 2)

The connective rework's second package: the full Tier A density/light
uplift of the three gateway wings whose provinces went dense in Batch 2 —
**kelp-cathedral** (verdant), **vent-springs** (smoking), **ghost-reef**
(pale) — including MASTER ruling **R6**, the ghost-reef side of the
"false spring" handshake with pale-passage-1. Lane per MASTER R3: wings,
gate-veils and seams only — no region directory, no def, no kit file is
touched.

Authority: FILL-DOCTRINE > MASTER (R2 ceilings, R6, R12 quality-first) >
connective-tissue.md §2's per-wing uplift table. Kit pieces consumed
(all demo-proved in the kit ledgers): `carpetField` (blade/frond — the
R12 quality profiles, not the card tier), `groundLitter` (with the R12
`grade` knob), `wallDrapeBank`, `percherColony` (seated only — R2 bans
`frustumCulled = false` in a wing), `glowColony`.

## Scope decisions, stated up front

- **Draw arithmetic.** R2's ≤ +10 draws / ≤ 35k tris Tier A ceiling is
  read as the wing's WHOLE Phase 3 uplift — Batch 1's gate veil (+5
  draws each, connective-1 ledger) counts against it. Each wing here
  gets **≤ +5 draws** of Batch 2 uplift. Measured numbers below.
- **No shoal legs.** The traveller-shoal network is Batch 3
  (connective-3, MASTER §4); no Batch 2 row calls for a wing-local
  shoal, and `shoalRunner`'s fish mesh needs `frustumCulled = false`,
  which R2 forbids inside a wing. Life here is seated colonies.
- **W1 god-shaft flag.** The kelp-cathedral god-shaft rectangles were
  repainted by the atelier (shaft sprite bell ^1.5 → ^2.6, lengthwise
  fades lengthened — comment in `KelpCathedralFlora.shaftSprite`).
  Batch 2 verifies the fix in captures rather than re-doing it; verdict
  in the rounds below.
- **Vent-springs wall strata.** The connective table's "wall strata
  paint" row landed earlier via the def's own `paint` slot (charcoal +
  amber mottle, atelier lane). Defs are read-only here; the Batch 2
  vent uplift is the ember polyp fringe + ground/wall density.
- **Sandfall fall-marks are OUT of scope** this batch (Batch 3 row).

## The R6 handshake (ghost-reef ↔ pale-passage-1 "false spring")

pale-passage-1 §8 flags it from the region side: the wing's recovery
ramp peaks at full colour exactly at the doorway (r 46.5) where the
region's ravine restarts at recovery 0 — full pastel slamming into
bone. pale-1's fill authors the region half (a dying trace of blush
gravel at u 48–68, hush by u 70); this package authors the wing half:
**the near-door stands are cooled** — the recovery envelope now peaks
around the den (r ≈ 44) and falls off toward the doorway, so the wing
hands the seam a *dying trace* of colour, exactly the register the
region-side beat picks up. Palette only; no stand moves (the reroll
fence and the W3 position pins hold). The pale-1 fill had not merged
at close (grep: no false-spring beat in `regions/pale1/**` on this
branch), so the handshake is honoured against its plan §8 numbers.

## Per-wing uplift (what was added, and on which streams)

Every piece rides a fresh `SEEDS.<wing> ^ <constant>` substream fed to a
kit-PRIVATE Random (KIT-SPEC law 1), appended after every existing draw,
under one named group `wing-uplift-conn2` mounted before the veil — so
connective-1's "last child is the veil" pin keeps holding and the wave-8
draw caps keep pinning the original flora.

| Wing | T1 | T2 | T4 life | Light | Streams (`^`) |
|---|---|---|---|---|---|
| kelp-cathedral | blade turf ×240 (48-tri R12 profile, sun-through-leaf glow, sway) + frond turf ×110 down both nave flanks, aisle ≥ 1.78 m held | emerald drape bank, 8 holdfasts on the wedge walls | cushion-star colonies at 7 column feet (seated) | existing god shafts + pools verified (W1 flag; atelier's sprite repaint) | 0x2b1a, 0x2b2b, 0x2b3c, 0x2b4d |
| vent-springs | scoria drift ×520 (gravel, `grade` 0.55, charcoal over warm under-shade) | heat-cured drape bank, 8 holdfasts | — (budget spent on the polyps; bubbles remain the wing's motion) | **ember polyp fringe**: 10 glow-colony anchors along the chimney banks, warm-and-rising per the register rule, emissive 0.30 ≤ 0.36 cap | 0x2c1a, 0x2c2b, 0x2c3c |
| ghost-reef | ossuary bone rubble ×540 (violet under-shade) + blush frond turf ×90 gated to the recovery envelope (R6 cooling included — the ground's colour dies at the door beside the stands) | pale drape bank, 8 holdfasts | porcelain brittle-stars at 10 stand feet (seated) | none added — the milk argues with focused light; the veil's pearl column stays the wing's one radiance | 0x2d1a, 0x2d2b, 0x2d3c, 0x2d4d |

Corridor fences kept by construction: vent-springs — nothing under
r 34.4, everything ≥ 0.06 rad off the axis through r 30–46 (the den
law reads every vertex, drape strand reach budgeted into the anchor
window); ghost-reef — den approach ≥ 0.06 rad (T1 fenced at 0.085 rad);
kelp-cathedral — the aisle's 1.65 m heart (turf fenced at 1.78 m,
drape holdfasts ≥ 3.15 m so no strand hangs over the nave's heart).
Seated colonies only — no `frustumCulled = false`, no castShadow, no
new contacts (the W1 contact-count pin stays at 16).

## Test-collector amendments (stated, not hidden — connective-1's precedent)

- `tests/wingsW1Flora.test.ts` — `insideGateVeil` became
  `insidePhase3Uplift`, excluding `wing-uplift-conn2` beside the veil
  from `drawStats` ONLY; determinism, confinement and the aisle checks
  still read every uplift vertex and instance.
- `tests/wingsW2Flora.test.ts` — the budget case filters the uplift
  subtree (`insideConn2Uplift`); the den-corridor, wedge-confinement
  and determinism cases still read everything, uplift included — the
  corridor law is proved against the new content on every run.
- `tests/wingsW3Flora.test.ts` — the recovery test's far band moves
  from `r ≥ 44` to `44.9 ≤ r ≤ 45.6` with R6 cited in place: the old
  band's strongest members are exactly the stands R6 now cools, so the
  3× colour bar is asserted where the design PUTS the colour, and the
  cooled door handover is asserted in `tests/wingsConnective2.test.ts`.

## Critique rounds

Captures per round: `visual-qa/*_conn2-r{n}.png`, before set
`*_conn2-before.png`, final `*_conn2-final.png`. Port discipline held:
`npx vite --port 5200 --strictPort`, `SHOT_URL=http://localhost:5200`.

### before (looked at)

- **kelp-cathedral** — the columns and canopy frame beautifully and the
  Batch 1 veil ends the axis on a green promise, but the floor between
  the rows is bare tan with a scatter of dark moss dots, and the wedge
  walls read as naked dune slope. The wave-8 audit's "bare tan floor"
  stands. The god shafts read as SOFT vertical light — no hard-edged
  rectangles visible at the pose range; the atelier's sprite repaint
  appears to have landed (verify again at r1 range).
- **vent-springs** — bubble rings and amber chimneys carry the frame;
  the def's charcoal/amber paint reads on the floor mound, but the
  walls' lower bands are unbroken mauve and the floor band between the
  chimney banks carries zero cover state. No warm smallwork anywhere —
  the "amber held in the gloom" is all large-form.
- **ghost-reef** — the pearl arch composes; crystal clusters right.
  Mid-ground: an empty mauve-tan sweep between camera and arch (the
  audit's "still bare mid-ground"). Colour: pastel sprigs visible at
  the left wall stands well before the far end — the early-colour flag
  in the flesh; nothing on the ground tells the bone story.

### r1 (first uplift, looked at)

- **kelp-cathedral** — turf lands through the mid floor and the nave
  finally has a floor… but it reads as sparse near-BLACK stubble at
  pose range (the emerald mood takes a fifth of the light and the r1
  palette sat too deep), and the drape bank is invisible — its 1.1–2.5 m
  holdfasts hide behind the columns' own feet. The god shafts read soft
  (no rectangles): **the W1 flag is confirmed fixed by the atelier's
  sprite repaint** — verified at pose range, nothing to redo.
  → r2: palette a value step brighter, 380 blades, taller envelope;
  drapes lifted to 1.8–3.4 m with 1.8 m strands.
- **vent-springs** — the scoria drift reads as true cinder on the right
  flank and the ember polyps read as "amber held in the gloom" beside
  the chimneys; a rust drape strap shows bottom-left. Presence still
  thin for a fringe. → r2: 12 anchors × 5 buds, glow 0.33, scoria 640,
  drapes lifted.
- **ghost-reef** — the strongest first round: bone rubble textures the
  whole mid-ground, blush fronds appear exactly where the recovery
  lives, pale drapes read on the right wall, and the near-gate ground
  stays bone. → r2: modest density bump only (rubble 620, turf 110).
