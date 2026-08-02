# W6 — Four New Morays: Species, Personalities, Wing Dens, Sanctuary for Nine

The wave's whole cast of eels: four new moray species, each with a den in its
wing and a character of its own, and a sanctuary that grows from five lanes
to nine so every discovered moray has somewhere to swim. Everything reuses
the shared GLB head and the procedural body/pattern — no Blender work, no
new machinery anywhere: species are data (`MoraySpeciesConfig`), characters
are biases (`MorayPersonality`), dens are data (`WingDens`) on the FROZEN
wing geometry, and the lane change is constants read at `setSpecies`. The
frozen four bowl dens, the abyss den, the canyon, and every existing lane
are bit-identical.

## What shipped, and why

### The four species (`src/creatures/morays/MoraySpeciesConfig.ts`, appended only)

All four wear the procedural skin only — no `albedoAsset`, like the abyss,
because each is described the way `MorayPattern` already paints. Every body
is a colour, never a hole: the pale ones keep red above green (the value
key), the dark one is a warm charcoal, and the two "glow" species are bright
painted value, never emission.

| id | archetype (scales) | pattern | body / pattern / accent | who it is |
|---|---|---|---|---|
| `golden-dwarf-moray` | compact (0.75 / 0.70) | plain | gold `0xe9b83c` / cream `0xf6e8c8` / honey `0xd89a2b` | tiny and bright; the cream mottle stands in for the dwarf's pale belly |
| `frost-moray` | robust (1.10 / 1.30) | bands | ice-blue `0x9ec7e8` / glacial white `0xf0f6fa` / deep ice `0x6fa8d8` | broad, calm, banded like pack ice |
| `ember-moray` | standard (1.0 / 0.95) | speckle | warm charcoal `0x3e3230` / hot orange-gold `0xffa83c` / ember `0xe2702e` | a banked fire in the warm vents |
| `pearl-moray` | standard (1.0 / 0.75) | plain | pearl-white `0xf0e9e4` / rose-gold `0xe4bca6` / deep rose `0xd9a58f` | near-translucent, nasal appendages, ethereal |

### The four personalities (`src/creatures/morays/MorayPersonality.ts`, appended only)

Same rule as the shipped five: biases on W-L7's measured baselines, no new
mechanisms, `ripple`/`extendFlare` stay 0 (the flourish is the dancer's
alone — the personality test pins it). Headline numbers per character:

- **golden dwarf — playful-curious.** The fastest clock in the game: tucks
  0.55×, peeks 0.5×, extends 0.7×; curiosity windowed highest of any
  species (0.75–0.95); startle is a flinch (0.9× trigger) but the recovery
  is near the ribbon's (0.55× wary emerge). Bright quick sway (1.15×
  amplitude at 1.25× tempo), the most eager gaze after the dragon (1.3
  lookRate).
- **frost — calm.** Every hold long (tucks 1.7×, peeks 1.8×, extends 2.3×)
  on a clock closed a third toward its midpoint (clockSpread 0.6); startle
  means little (1.5× trigger) and happens slowly (2.5× tau — a heavy fold,
  not a bolt); the slowest gaze in the game (0.45 lookRate).
- **ember — shy.** Tucks second only to the hermit's (2.6×) with the
  briefest extends of any species (0.55×) — the glow is earned — but
  curiosity sits mid-high (0.35–0.6), which is what separates it from the
  abyss: this animal *wants* to come out.
- **pearl — gentle-ethereal.** Nothing at an extreme: holds a third again
  longer across the board, a slow dreamy clock (0.7 sway tempo), a startle
  that folds at 1.6× tau — the ethereal version of the hermit's 6× one.

Each has a distinct codexLine in the storybook voice (the test pins
uniqueness and length).

### The four dens (`src/world/wings/WingDens.ts`, filled)

All at r = 41 on the wing axis (inside the r ≤ 44 end-wall margin), |across|
≤ 0.025 of the corridor's ±0.06, heads 1.3–1.5 m over the carved floor,
facing back up the wing toward the gate with a few degrees of offset each so
the four are not the same pose four times:

| species | wing (azimuth) | across | headAbove | head world position | floor |
|---|---|---|---|---|---|
| golden-dwarf | nursery-shallows (1.71) | −0.02 | 1.3 | (−4.9, 2.79, 40.7) | +1.49 |
| frost | ice-grotto (5.67) | +0.025 | 1.5 | (34.1, −2.82, −22.7) | −4.32 |
| ember | vent-springs (2.79) | −0.025 | 1.4 | (−38.1, −5.08, 15.1) | −6.48 |
| pearl | ghost-reef (3.87) | +0.02 | 1.35 | (−30.0, −2.67, −27.9) | −4.02 |

The reef machinery (scaffold-wired) resolves each against `seabedHeight`,
builds the crevice mounds, and dresses the dens off `SEEDS.wingDens` in
array order — the five existing dens draw first and stay bit-identical.
`SEEDS.morayWave8` was pre-registered for me; nothing in this package needs
it — presence uses `presenceSeed(speciesId)` and expression timing
`personalitySeed(speciesId)`, both automatic per species.

### The sanctuary grows to nine lanes (`src/sanctuary/SanctuaryScene.ts`)

Lanes 0–4 are bit-identical to the pre-wave table. The W-N3 all-pairs
stagger rules top out arithmetically at seven lanes (9 × 0.8 rad > 2π for
phases; 9 × 0.1 > the ±0.35 turn band; 9 × 0.45 m > the water column), so
the thresholds are unchanged but scoped to the axis that actually forms a
chimera pair, and the test reads the scopes back:

- **height (≥0.45) and turn (≥0.1) hold within a lateral half** (west x ≤
  0.6 / east above it) — two animals metres apart on screen cannot read as
  one body at any shared height. West: snowflake, ribbon, zebra, golden
  dwarf. East: dragon, abyss, frost, ember, pearl.
- **the phase rule (≥0.8 circular) holds within a direction of travel** —
  opposite-parametrised lanes only ever meet anti-parallel. Reversed:
  {snowflake 6.1, zebra 4.7, pearl 3.55, abyss 2.4}; forward: {dragon 0.9,
  frost 1.75, ribbon 3.3, golden dwarf 4.4, ember 5.6}.

New lanes (all inside the frame at both sweep ends, tops under the jellies'
4.55 m floor, bottoms off the sand):

| lane | species | x, y, z | r | speed | turn | rise | character as path |
|---|---|---|---|---|---|---|---|
| 5 | golden dwarf | −4.1, 2.05, 1.0 | 1.25 | +0.28 | −0.21 | 0.35 | quick bright west water |
| 6 | frost | 4.0, 3.55, −3.6 | 1.4 | +0.18 | −0.06 | 0.30 | slowest, near-level, deep far-east |
| 7 | ember | 3.4, 1.7, 0.5 | 1.4 | +0.22 | +0.20 | 0.50 | warm east shallows |
| 8 | pearl | 1.2, 4.15, −2.0 | 1.6 | −0.16 | −0.17 | 0.35 | the room's high ceiling, reversed |

## The adjacency sim (W-O2 re-created as `scripts/probe-sanctuary-lanes.mjs`)

W-O2's own script did not survive (the wave's scratch-file convention), so
the probe is a re-creation of the documented recipe — sim the whole visit,
never a single instant: the real `SanctuaryScene` with all residents, 90 s
at 30 Hz covering the camera's whole swing, every resident's root and body
polyline projected through the sweeping camera to the canonical 1600×900
frame, pairs flagged while their roots are under 70 px *and* their travel
runs the same direction (anti-parallel passes and angled crossings stay
legal, per the recipe). Run: `npx vite-node scripts/probe-sanctuary-lanes.mjs`.

**Calibration honesty**: on this instrument the shipped five-lane table —
the table the critic accepted — measures 2.47 s in the first 40 s with a
2.20 s worst run (the zebra×dragon flicker W-O2 documented), not W-O2's
"<2 s" (their instrument's number). The gate is therefore relative, both
tables measured in one run: candidate total40 ≤ shipped + 1.5 s AND
candidate worst run ≤ shipped + 0.5 s.

**Result: PASS.**

| table | same-direction adjacency 0–40 s | 0–90 s | worst run |
|---|---|---|---|
| shipped five lanes (calibration) | 2.47 s | 7.43 s | 2.20 s |
| wave-8 nine lanes | 3.00 s | 9.37 s | 2.20 s |

The nine-lane excess over the shipped table is a single pair — abyss × ember,
0.53 s of sub-2 s flickers (worst 1.40 s) — inside the shipped table's own
accepted shape; every other new pair measures 0.00 s in the capture window.

**What the probe taught, stated for the next lane owner**: the ±30° sweep
aligns any near lane with any far lane *on the same side of the room* at
some azimuth (a 6.5 m z-gap projected to 13 px at az −0.15 in a measured
case), so plan-view z-separation is not separation at all — and the
lemniscate's x extremes anti-correlate with its height extremes (a lane's
far tip is also a height extreme), which can be used as well as feared. No
pair in this table relies on z alone: each keeps a metre-plus of height or
metres of x between its beats. Tuning was done against the instrument
(~8 candidate tables measured; two coordinate-descent/random searches used
and discarded for geometry micro-tuning).

## Verification (all Node, no servers)

- `npm run typecheck` — clean (the tree's mid-flight errors from other
  workers resolved by their owners by the time of the final run).
- `npx eslint src/creatures/morays src/world/wings/WingDens.ts src/sanctuary
  tests/wingDens.test.ts tests/sanctuaryScene.test.ts tests/morayAsset.test.ts
  --max-warnings 0` — clean.
- Targeted battery, **85/85 green**: `tests/wingDens.test.ts` (13, new),
  `tests/reefSightlines.test.ts`, `tests/morayPersonality.test.ts`,
  `tests/morayPresence.test.ts`, `tests/morayAsset.test.ts`,
  `tests/wings.test.ts`, `tests/sanctuaryScene.test.ts`.
- Bit-identity: `tests/abyssBiome.test.ts` and `tests/seabedRelief.test.ts`
  green (23/23); the frozen four dens and the abyss den untouched to the bit.
- New `tests/wingDens.test.ts`: per-den sightlines mirroring the abyss-den
  pattern (floor-relative eye heights down each wing's corridor) — **every
  den measures 32/32 sampled viewpoints clear (1.000)**, terrain walks clear;
  den placement read back against the specs (r, wrapped azimuth — the ice
  grotto's 5.67 rad sits against `atan2`'s ±π boundary — head height); config
  pins (archetype, scales, pattern, no albedo); value key (red above green on
  the pale and dark bodies); procedural skins paint (markings present per
  pattern kind — the plain species are checked by residual from the shade
  ramp, since their mottle never reaches its own colour by design).

## Files touched

Mine: `src/creatures/morays/MoraySpeciesConfig.ts` (append),
`src/creatures/morays/MorayPersonality.ts` (append + header note),
`src/world/wings/WingDens.ts` (fill), `src/sanctuary/SanctuaryScene.ts`
(`SANCTUARY_LANES` table and its header comment only),
`tests/wingDens.test.ts` (new), `scripts/probe-sanctuary-lanes.mjs` (new),
`docs/wave8-ledger/w6-morays.md` (this).

Count pins the wave invalidates, updated with a comment: `tests/morayAsset.test.ts`
(registry 5 → 9 and the id list), `tests/abyssBiome.test.ts` (hiding spots
5 → 9 — the abyss den's own assertions untouched and passing),
`tests/sanctuaryScene.test.ts` (the stagger case re-scoped for nine lanes as
above; the W-O2 lateral case untouched, indices 2/3/4 unchanged).

## Flags

- **Other workers' mid-flight breakage, not mine**: `Seaweed.ts`
  (`leafyBushGeometry` undefined, plus typecheck errors in `Seaweed.ts`,
  `LumenGardenFlora.ts`, `wingsW3Flora.test.ts`) blocked every
  Reef-constructing suite ~03:27–04:15; resolved by their owners. My suites
  were re-run after and are green.
- **The sanctuary probe's gate is relative by design** (see the calibration
  note above): if a future capture shows a chimera this table misses, distrust
  the instrument before the table — the shipped five-lane table itself reads
  2.47 s on it. The probe also reports two diagnostics (full-body
  near-parallel, head-to-flank) that count many legal crossings and are
  deliberately not gated.
- **The ember's sanctuary flicker** (abyss × ember, 0.53 s in 40 s) is the
  one measured excess over the shipped table; it is a same-side near/far
  pair whose y-bands graze by construction, accepted because the shape is a
  flicker (1.4 s worst) rather than a lock — noted here so the critic can
  judge it on screen rather than by surprise.
- **The pearl swims the sanctuary's ceiling** (y 4.15), not its ghost-reef
  depths: the room's low bands are full, and the near-white animal reads
  beautifully against the bright water. Its *personality* (den behaviour) is
  unaffected.
- No dev servers, no captures, no e2e run by this worker, per wave
  discipline; one full `npm test` at close (reported to the orchestrator
  separately).
