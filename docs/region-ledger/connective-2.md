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

(Filled in as rounds close — see the rounds and the close-out table.)

## Test-collector amendments (stated, not hidden — connective-1's precedent)

(Filled in with the exact edits when they land.)

## Critique rounds

Captures per round: `visual-qa/*_conn2-r{n}.png`, before set
`*_conn2-before.png`, final `*_conn2-final.png`. Port discipline held:
`npx vite --port 5200 --strictPort`, `SHOT_URL=http://localhost:5200`.

### before (looked at)

(Pending.)
