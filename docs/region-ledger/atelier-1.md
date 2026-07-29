# atelier-1 — THE TEXTURE ATELIER (paint-quality rework of wave 8)

Branch `rework/atelier-1`. Remit: paint only — nothing moves, nothing is
re-laid-out. The value rules enforced everywhere: three readable bands
minimum on any body; the darkest thing is a colour, never black; violets
keep red above green; highlights are painted values, not emissive; coral
vertex colour only ever darkens (≤ 1.0) and the species hue stays with the
instance colour.

Proof artefacts: turntables in `visual-qa/atelier/` (all thirteen GLBs),
wing captures in `visual-qa/` under tags `atelier-before`, `atelier-after1`,
`atelier-mid`, `atelier-after2` and `atelier-final`, canonical set under
`atelier-final`.

## Package 1 — creature GLBs (ten repaints, sRGB `BYTE_COLOR` convention)

Every creature: rebuilt, turntabled, read, repainted, re-verified with
`inspect_creature.mjs`. No budget grew; joints and UVs untouched throughout.
One deliberate geometry touch (gentle dark, noted below) and one defect fix
(branch coral, in the corals section).

| Creature | Rounds | Verdict |
|---|---|---|
| serpent | 2 | Was one green with faint saddles. Now: cream belly seated under the flank, saddles read at distance, warm edge-light along the flank/belly line, fins carry deep-bay-to-lit-crest values, eye gained a brow arc and a warmer snout. |
| crown-jelly | 2 | The coronet floated on an even bell. Now a cool violet halo above the crown and a deep violet seat below it — the lamp reads as *set into* the bell. Red stays above green in every violet. |
| kirin | 2 | Body bands were timid. Belly/flank/dorsal now three honest steps, tail rings read, mane and antlers carry root-to-tip value (deep roots, lit fronds/tips), eye softened with a brow crescent. |
| gentle-dark | 4 | The long one. Eyes were blotchy squares — paint alone could not fix a read that fell between columns, so `COLS` 26 → 32 (1144 → 1408 tris, budget 2000; the one geometry touch-up). Now: soft round pale eye discs with a violet halo, a neck shadow, a lighter face plane, three body values. |
| kraken-hatchling | 2 | Kept the pale-set contract. Dusty-rose crown deepened, skirt rim lightened to a real band, freckle mottle strengthened, pale spectacle rings around the eyes. |
| moon-koi | 2 | Silver was flat. Dorsal now violet-silver against a warm belly, the rose blush actually visible and carried down the flank, eye deepened, fins and ribbon gained root-to-edge gradients. |
| lantern-leviathan | 2 | Shadows warmed off near-black slate; a rorqual flank blaze added high on the slate (painted value, not emissive); eye and mouth warmed. |
| island-turtle | 2 | Shell seams deepened and amber fields brightened (three-value scute read); flippers counter-shaded with a root shadow and a lit trailing edge; marginal scutes given their own cells and seams. |
| crab | 3 | Player-adjacent. Dome now a clear three-value gradient with paired dorsal patches, mittens and eyes warmed. Patches took two pushes to survive the toon ramp — final round widened and deepened them. |
| clownfish | 6 | Player-adjacent, and the stubborn one. Counter-shaded the orange, cooled the white band shadows, dark-edged the fins — then four rounds on the eye alone: the round dot only reads when centred on a single vertex column inside the head band, above the mouth line. It does now. |

## Package 1 — coral GLBs (`FLOAT_COLOR` multipliers via `perceived()`, ≤ 1.0)

| Coral | Verdict |
|---|---|
| tube | Fluted lip was one value. Bays of the flute now dip a step darker, so the lip undulates in value as well as silhouette. Multipliers verified ≤ 1.0. |
| fan | Panels were near-flat 0.94. Root-to-tip gradient (0.82 base + edge term): darker toward the holdfast, lightest mid-blade. ≤ 1.0 held. |
| branch | Repaint took the root 0.74 → 0.66 for a three-value frond. **Then the turntable showed the truth: the shipped wave-8 GLB was 624 zero-area triangles out of 625** — the per-segment joint wobble tore every shared joint into two vertices, the Skin modifier collapsed every rootless island, and every garden fill finger has been rendering as a single spike. Fixed in `build_branch.py` (one wobble per joint, a root per island): 625 degenerate tris → 336 real ones, budget *down*, frame and ≤ 1.0 contract intact. Geometry fix, not paint — no paint can fix a face with no area. |

## Package 2 — wing flora paint (layout frozen; before/after `WING_ONLY` captures)

**Flagged reads, fixed:**

- **kelp-cathedral** — god-shaft quads showed hard edges. The sprite's bell
  exponent 1.5 → 2.6 and the along-shaft fade extended, so the shafts now
  dissolve instead of ending. *Note:* the hard-edged teal slab behind them is
  the `abyss-curtain`/`verdant-distance` cards from `regions/**` — identified
  by raycast, out of scope this pass, flagged below.
- **ghost-reef** — near-gate recovery stands carried saturated green where
  the bone→colour story says white. The def's sand `lift` made bone-neutral
  (red first) so fog + flora greens stop stacking, and the `RECOVERY` green
  taken well toward the milk (0xabd9a4 → 0xb6d8ac). First attempt
  over-desaturated the whole palette and `tests/wingsW3Flora.test.ts`
  rightly failed its recovery-ratio pin (far spread must triple the gate's)
  — the pink and gold got their chroma back (0xf4bfcc, 0xefc890) at depth
  0.85, the test passes honestly, and the after-shot shows bone at the gate
  with colour returning, minus the green scream.
- **sargassum-sky** — flat green horizon band in the look-up pose was the
  sea surface under the wing's fog `colorScale`. Blue channel 0.55 → 0.70:
  the band now reads sea-glass aqua-gold and belongs to the bowl.

**General tint pass (from the full 15-wing `atelier-mid` review):**

- **current-run** — banners read two values. Banner texture ramp rebuilt as
  three bands (0.36 root, mid body, late-blooming tip). After-shot: dark
  roots, mid bodies, bright tips.
- **wreck-meadow** — ribs read one flat crimson: the crown of every hoop
  clamped to the palette's light end. Added a circumferential face term
  (lit outward/top face, wet dark under-arch) and unclamped the ranges.
  After-shot: timber reads round.
- **mangrove-roots** — crown multipliers warmed, foot cooled (red first).
  Honest verdict: the improvement is subtle at the canonical grazing pose —
  the columns are backlit against bright water and mostly fog; the gloom is
  also the wing's design. Left there deliberately.
- **Left alone, already good:** glass-cove (pastel glass reads charming),
  ice-grotto (violet-white spires, mottled arch), ruins-terrace (verdigris
  mottle), moonlit-lagoon (pale-tipped grass, lavender stones),
  nursery-shallows, lumen-garden (sparse violet gloom is the point),
  open-blue (the flat blue shape mid-frame is terrain/distance, `regions/`),
  vent-springs (three charcoal strata + one hot amber note; the orange fog
  read is the wing's strangeness), sandfall-dunes (cream cascades over
  lavender stone).

## Package 3 — fauna paint

- **Clownfish stand-in** (`fauna/Clownfish.ts`) — was flat orange with a
  `0x141118` near-black. Counter-shaded the orange (back `0xff8438` →
  belly `0xffb066`) and warmed the black to plum `0x2a191e` (red above
  green) — the sculpted GLB's field marks either door.
- **Left alone, already good:** anemone garden (vertex-gradient tentacles,
  warmed trunks, deeper carpet ring), starfish (ochre/violet/rose triad),
  urchins (dark violets, never black), crabs stand-in (dark eyes, pale
  claws, shaded legs), shrimp (ivory with bands).
- **Fish species palettes** (`FishSpecies.ts`) — read and deliberately left.
  Each colour is already argued in place (value-first legibility, red kept
  in everything), and per-species band work is impossible without touching
  `FishGeometry.ts` (counter-shading lives there; `FishBodyProfile` exposes
  no palette fields), which is off-limits. Flagged, not smuggled.

## Tests

- No test file was modified. One test failed mid-pass and was honoured
  rather than edited: `tests/wingsW3Flora.test.ts`'s recovery-ratio pin
  caught the first Ghost Reef palette as over-desaturated (see above) —
  the paint moved, not the pin.
- `npx tsc --noEmit` clean; `npx eslint src --max-warnings 0` clean.
- `npx vitest run tests/wings.test.ts tests/fauna.test.ts
  tests/fishDiversity.test.ts tests/coralGarden.test.ts` — 71/71 green
  (run again after the branch-coral geometry fix).
- Full `npm test`: **46 files, 505/505 green.**

## Flags for the orchestrator

1. **`regions/**` distance cards** — the Kelp Cathedral's teal slab
   (`abyss-curtain`/`verdant-distance`) shows hard edges behind the wing,
   and Sandfall Dunes has a matching hard sky seam top-right of its
   canonical pose. Same family of fix, outside this pass's file list.
2. **Branch coral was invisible since wave 8** — worth a regression check
   anywhere else the Skin modifier + per-segment jitter pattern was copied.
3. **Fish band work** wants a `FishGeometry.ts` change (palette fields on
   `FishBodyProfile`) if the owner still wants per-species bands.
