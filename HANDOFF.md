# Handoff — Moray Dive Hunt

Written 2026-07-29 by the orchestrating agent of the visual campaign, for the
next instance that picks this up. Read this first, then read `AGENTS.md`
end to end — that file is the project's real brain: every wave, decision,
budget, gotcha and triage lesson lives there. This note is only the
orientation layer on top of it.

## What this is, and where it stands

A first-person underwater exploration game (Three.js r0.180, Vite,
TypeScript): a diver explores a seeded reef bowl and a twilight canyon
beyond it, finds five moray species, and collects them into a Dream
Sanctuary. The owner's bar, verbatim: **"literally, near Studio Ghibli
graphics as a video game, not this slop."**

The visual campaign ran as critiqued waves (WP-G*, W-L*, W-M*, W-N*, W-O*)
and closed at **9/10** from an independent critic pass (journey: 6 → 8 → 9),
with the recommendation: stop visual work, invest in **gameplay depth**
next, since the dive loop today is find-five-morays plus ambience.

State at handoff, all verified on an idle machine:

- Unit **325/325**, typecheck + eslint clean repo-wide, e2e **20/20 with
  zero flakes** on the final quiet run.
- Canonical screenshot archive: **`visual-qa/*wave7-merged*`** (16 poses,
  A–J, R, S, W/X/Y, Z) — kept in this archive on purpose; it is the diff
  base for any future change. Full QA history was pruned for size.
- Real hardware: **60 fps vsync-locked at render scale 1.00**
  (`SHOT_HEADED=1 node scripts/measure-frames.mjs`). Every ms number in
  AGENTS.md is SwiftShader-relative (headless CPU raster) — never read
  them as absolute.
- **EVERYTHING SINCE THE `W-L1` COMMIT IS UNCOMMITTED.** The entire visual
  transformation sits in the working tree. The owner knows. Your sensible
  first action, with their blessing: commit it (one commit or split by
  wave using AGENTS.md's sections as the map).

## Setting up on a new machine

```bash
npm install
npx playwright install chromium
npm run dev        # game on http://localhost:5173
npm test           # unit (vitest)
npm run test:e2e   # e2e (playwright, starts its own server)
node scripts/capture-shots.mjs <tag>   # canonical 16-pose set
```

Blender 4.5 LTS is only needed to regenerate the hero GLBs
(`tools/blender/creatures/`); the exports are committed under
`public/assets/models/` with contracts in `CREATURES.md` there.

## How this project is worked on (the method that got it to 9)

1. **Critic → plan → waves.** An independent critic subagent judges the
   whole game against the bar and returns ranked packages; the orchestrator
   turns them into waves of 2–3 parallel workers with **disjoint file
   ownership** (contention on fog/lighting/Reef.ts is the classic hazard —
   sequence those). Workers were run as subagents on
   `claude-fable-5-thinking-high`, each with a self-contained brief:
   context, verbatim critique, tasks, ownership list, invariants, gates.
2. **Determinism is sacred.** All randomness flows from named streams in
   `src/util/Random.ts` (`SEEDS`). Reroll isolation: never disturb an
   existing stream's draw order; new features get new pre-registered seeds
   (orchestrator registers them before launching a wave, to avoid merge
   conflicts). Tests pin first/last-draw literals.
3. **Proof over vibes.** Every visual change ships with A/B probe captures
   (control tag + same-session self-noise bracket), a canonical re-capture
   under a new tag, and honest perf numbers. Capture-script gotcha: the
   tag is **positional** (`node scripts/capture-shots.mjs mytag`), not
   `--tag`.
4. **E2e under load lies.** The documented "starved-loop" flake families
   (audio specs, duck-watcher, comfort-panel) fail under machine load with
   healthy page snapshots. Recipe in AGENTS.md: load-gate the run, and
   re-run failures isolated before ever concluding regression. The
   volume-slider spec carries an explicit 120 s timeout for this reason.
5. **Shared-tree hazards.** Concurrent workers' HMR can poison each
   other's captures (a flat boot-template frame = reload and retake, not a
   code bug). After each wave, the orchestrator re-verified the merged
   tree idle: lint/typecheck/unit, fresh canonical archive, quiet e2e.
6. **The ledger is append-only memory.** Every worker appends its section
   to AGENTS.md: what, why, numbers, flags. Flagged-not-owned items are
   how cross-wave bugs got caught (the "picnic-basket dish" that turned
   out to be the zebra's snout took three waves and a scene-node toggle to
   pin down — the story is in there and it is instructive).

## Load-bearing design contracts (do not break casually)

- **Bowl bit-identity**: `abyssMood(camera)` is exactly zero in the bowl;
  `tests/abyssBiome.test.ts` asserts base fog/lighting verbatim (`toBe`).
- **Weather composition**: "weather scales the base, twilight modulates
  the scaled base" — one writer per channel. Default mood ("bright noon")
  is exact identity. Sanctuary never attaches weather.
- **Sightline caps** (`tests/reefSightlines.test.ts`): moray
  discoverability is a gameplay contract; staging fixes must keep head
  positions bit-exact (see W-O2's survey-yaw pattern).
- **Sanctuary lanes**: stagger rules alone are provably insufficient —
  re-run the screen-space adjacency simulation (AGENTS.md W-O2) after any
  lane retune.
- **Asset fallbacks**: every authored texture/GLB loads via
  `AssetLibrary` with a procedural fallback; the no-assets build must stay
  healthy (workers verify with `SHOT_NO_ASSETS=1` / `-noassets` capture sets).

## What's next (owner's decision pending at handoff)

1. **Gameplay depth** — the critic's recommendation. Nothing designed yet;
   candidate directions discussed: photo/journal mechanics, creature
   relationships, progression beyond the five discoveries. Ask the owner.
2. **Committing the work** — see above.
3. Small flagged leftovers, none urgent: the gate glow's turquoise is a
   fixed tint (could track live bowl-water color — needs a real channel
   owner); brain/plate painted albedos shipped but were judged "the modest
   third" of W-O3 — a future close-up pass could push them.

Keep the critic honest, keep the ledger current, and keep the seeds
frozen. Good diving.

---

## Wave 8 addendum (2026-07-29)

The owner chose scope over rest: Wave 8 shipped fifteen new wing biomes
through the rim, four wing morays, eight mythic creatures, the great asset
uplift (crabs, fish, corals, meadow, bushes, anemones, clownfish), and
swim-where-you-look movement — one scaffold commit plus twelve parallel
workers, merged and verified (unit 484/484, e2e 20/20 quiet). Read the
Wave 8 section at the end of AGENTS.md, then `docs/WAVE8.md` (design,
frozen geometry) and `docs/wave8-ledger/*.md` (per-worker ledgers) before
touching anything the wave built. Showcase captures:
`visual-qa/*WING-*_wave8*`; canonical diff base moves to
`visual-qa/*wave8-merged*`. The open flags list at the end of AGENTS.md is
the next polish wave's starting brief; an independent critic pass over the
new wings has not run yet and should be the next visual step.

---

## Waves 9–11 addendum (2026-08-02)

The Great Expansion is built and twice-critiqued: sixteen streamed regions
(five provinces × three depths + the Sunken Calamity), all corridors open
both ways, all wings uplifted, the traveller network live, and two
independent critic passes driven to "NOT YET but CLOSE — the distance is
now measurable in artifacts, not absences," with that artifact list then
closed by the conviction and edges waves. Full state: the Waves 9–11
epilogue at the end of AGENTS.md, the rulings in docs/fill-plans/MASTER.md,
per-region ledgers in docs/region-ledger/, and the two critiques
(docs/CRITIC-REPORT.md, docs/CRITIC-REPORT-2.md) with committed evidence
frames in docs/report-frames/. Canonical capture entry points:
scripts/journey-shots.mjs (six spoke chains), scripts/region-shots.mjs +
region-sweep.mjs (per region), scripts/critic-offroad.mjs (the off-road
battery). The full suite is 73 files / 1161 tests; every merge in these
waves ran typecheck + eslint --max-warnings 0 + the UNPIPED full suite.
Next visual step: a third critic pass — the last one said it should be
arguing about which twelve frames to leave out.
