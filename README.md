# The Reef Between Seas (moray-game)

A warm, dreamlike 3D diving game about exploring impossible reefs and discovering a
lovingly modeled collection of moray eels. There is no combat and no oxygen timer — the
challenge is quiet observation: read the reef, notice a peeking eye or a breathing jaw,
approach without startling the moray, focus on it, and add it to your illustrated Codex.

This repository is the **Phase 1 prototype** from the project blueprint. It proves the
core loop with one polished mechanic rather than a fleet of assets:

- A greybox **Sunlit Coral Garden** reef with underwater fog, caustics and soft lighting.
- Comfortable **kinematic swimming** with configurable camera comfort (bob, roll, auto-level).
- One hidden **hero moray** (the snowflake moray, _Echidna nebulosa_), built procedurally
  from a data-driven species config.
- A **focus-based discovery** system, an escalating **hint ladder**, and an illustrated **Codex**.
- An **accessibility settings** scaffold including a one-switch **Calm Mode** preset.

## Tech stack

TypeScript · Vite · Three.js (WebGL, behind a renderer adapter) · Vitest · Playwright.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

## Controls

- `W` `A` `S` `D` — swim, `Space` / `Shift` — ascend / descend
- Mouse (after clicking the canvas) — look around
- Center the reticle on a moray and hold to focus and discover it
- `H` — request a hint · `C` — open/close the Codex

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check then production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm run test` | Vitest unit tests (pure gameplay logic) |
| `npm run test:e2e` | Playwright smoke + discovery tests |

The unit tests cover the pure gameplay logic (movement, focus/discovery, collisions,
registry, hint ladder, game loop). The Playwright tests boot the real WebGL app and
verify it renders and that the moray can be discovered and recorded into the Codex.
Run `npx playwright install chromium` once before `npm run test:e2e`.
