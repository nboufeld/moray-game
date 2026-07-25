# The Reef Between Seas (moray-game)

A warm, dreamlike 3D diving game about exploring impossible reefs and discovering a
lovingly modeled collection of moray eels. There is no combat and no oxygen timer — the
challenge is quiet observation: read the reef, notice a peeking eye or a breathing jaw,
approach without startling the moray, focus on it, and add it to your illustrated Codex.

This repository is the **vertical slice** from the project blueprint. It proves the
complete emotional and technical loop rather than a fleet of assets:

- A **Sunlit Coral Garden** reef: dune-shaped seabed, coral in three silhouettes, swaying
  sea grass, drifting motes and an instanced **fish school**, under depth-graded fog,
  raking sunlight shafts and animated caustics.
- A post-processing chain (bloom, split-tone grade, vignette) behind an **adaptive
  resolution** scaler, so the reef still runs on hardware without a GPU.
- Comfortable **kinematic swimming** with configurable camera comfort (bob, roll, auto-level).
- **Four distinct hidden morays** — snowflake (_Echidna nebulosa_), ribbon
  (_Rhinomuraena quaesita_), zebra (_Gymnomuraena zebra_) and dragon (_Enchelycore pardalis_) —
  built procedurally from data-driven species configs (shared runtime, individual data).
- A **focus-based discovery** system, an escalating **nearest-target hint ladder**, and an
  illustrated **Codex**.
- The **Dream Sanctuary** (press `V`): a calm aquarium where discovered morays drift gently,
  each with a species card.
- A versioned **save system** that persists discoveries and comfort settings.
- A **Comfort & Accessibility** panel (press `O`) with a one-switch **Calm Mode** preset.

## Tech stack

TypeScript · Vite · Three.js (WebGL, behind a renderer adapter) · Vitest · Playwright.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

## Controls

- `W` `A` `S` `D` — swim, `Space` / `Shift` — ascend / descend
- Mouse (after clicking the canvas) or `←` `→` — look around
- Center the reticle on a moray and hold to focus and discover it
- `H` — hint · `C` — Codex · `V` — Dream Sanctuary · `O` — Comfort & Accessibility

Append `?reset=1` to the URL to start a completely fresh dive (clears the save).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check then production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm run test` | Vitest unit tests (pure gameplay logic) |
| `npm run test:e2e` | Playwright smoke, discovery and accessibility tests |
| `npm run shots -- <tag>` | Capture the art-direction shot set into `visual-qa/` |

The unit tests cover the pure gameplay logic (movement, focus/discovery, collisions,
registry, hint ladder, game loop, sanctuary resource lifetime). The Playwright tests boot
the real WebGL app and verify it renders, that the moray can be discovered and recorded
into the Codex, and that the Comfort & Accessibility panel is fully keyboard-operable.
Run `npx playwright install chromium` once before `npm run test:e2e`.
