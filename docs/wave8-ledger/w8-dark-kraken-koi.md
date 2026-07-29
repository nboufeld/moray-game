# Wave 8 ledger — W8: The Gentle Dark, Kraken Hatchling, Moon Koi

Three mythics, end to end: Blender GLB + runtime being + discovery target
each. Runtime in `src/creatures/mythics/{gentledark,kraken,moonkoi}/` with
the stubs' codex ids kept exactly (`myth-gentle-dark`,
`myth-kraken-hatchling`, `myth-moon-koi`); builds in
`tools/blender/creatures/build_{gentle_dark,kraken_hatchling,moon_koi}.py`;
tests in `tests/mythicsW8.test.ts`. Seeds: only `SEEDS.mythUmibozu` /
`SEEDS.mythKraken` / `SEEDS.mythMoonKoi` (+ `^` substreams for arm phases and
den dressing), all drawn before async; the GLB builds are fully analytic (no
RNG at all), so rebuilds are bit-identical. Every number below was measured
off the exported file with `node tools/blender/creatures/inspect_creature.mjs`.

## Asset contracts (CREATURES.md style)

### creature-gentle-dark.glb — the umibōzu hull

| | measured |
|---|---|
| verts / tris | 574 / **1144** (budget 2000) |
| bounds (m) | x ±3.574, y [−0.050, 9.760], z [−2.200, +2.200] |
| pivot | **base of the shoulders**; the hull rises along +Y, the face (and eyes) look along +Z. Nothing sits behind the face plane. |
| face | front surface at z ≈ **+2.06** at the brow; eye discs centred (±0.92, 6.90), radii (0.52, 0.58) |
| joints | none — the runtime's rise is the whole behaviour |
| UV | cylindrical wrap: u ∈ [0, 0.9615], v ∈ [0, 1] (no painting; documented for completeness) |
| COLOR_0 | deep blue-violet, **never black** (r min 0.0185, g min 0.0145, b min 0.0742) lifting one value step at the crown (r max 0.205-ish); two warm pale eye discs (r max 0.9047, the full sRGB 0.955 round trip) |

Above the neck the mass pours 0.35 m toward the water (baked); the runtime
hangs its soft-glow eye discs at (±0.92, 6.90, 2.06), 2 cm proud.

### creature-kraken-hatchling.glb — shy octopus child

| | measured |
|---|---|
| verts / tris | 1052 / **2000** (budget 4000) |
| bounds (m) | x ±0.937, y [−0.255, 0.528], z ±0.937 (arm tips span ≈ 1.87 m) |
| pivot | skirt centre; mantle rises along +Y, eyes look along +Z |
| WEIGHTS_0 | worst per-vertex sum **1.0000**; root 596 verts, each arm 73 |
| UV | mantle cylindrical u ∈ [0, 0.95]; arms u around, v along |
| COLOR_0 | **the PALE tint set** (blanched look): mean r 0.78 / g 0.55 / b 0.48; sucker columns cream; eyes dark beads (r min 0.0137). The runtime multiplies down to dusty rose when calm and eases to white on a startle — the authored colour *is* the startled colour. |

Joints (measured; bone rotates about its own local +Y):

| joint | origin (glTF) | local +Y (model space) | motion |
|---|---|---|---|
| `root` | (0, 0, 0) | (0, 1, 0) | carries mantle, eyes, fin-less verts |
| `arm0`..`arm7` | (0.16·cosθ, 0.020, −0.16·sinθ), θ = 22.5°+45°i | (sinθ, 0, cosθ) | +θ = arm tip curls **up** toward the mantle |
| (local +X) | | (−cosθ, 0, sinθ) | the export's own roll; the TS rig transcribes it exactly |

Weights ramp over each arm's first third, so a curl bends at the skirt.

### creature-moon-koi.glb — great pale koi spirit

| | measured |
|---|---|
| verts / tris | 691 / **1348** (budget 3500) |
| bounds (m) | x ±0.223, y [−0.196, 0.244], z [−2.050, +0.912] (body 1.8 m + 1.12 m ribbon) |
| pivot | mid-body; faces +Z, dorsal +Y |
| WEIGHTS_0 | worst per-vertex sum **1.0000**; spine0..4 160–181 verts each, ribbon0 137, ribbon1 77, root (fins) 88 |
| UV | body cylindrical u ∈ [0, 1], v ∈ [0, 1] nose→peduncle; ribbon u across, v along |
| COLOR_0 | silver-white (belly 0.97 → dorsal 0.90/0.92/0.95), rose-blush blotches (off-centre, fading down the flanks — a koi's hi is a map, not a band), deep-blue eye patches (b min 0.1195 is the darkest blue on the fish), ribbon silver with rose rim |

Joints (measured; all local +Y → (0, 1, 0), local +X → (1, 0, 0)):

| joint | origin (glTF z) | motion |
|---|---|---|
| `spine0`..`spine4` | 0.65 / 0.32 / 0 / −0.32 / −0.60 | `rotation.y` = lateral bend of the swim |
| `ribbon0`, `ribbon1` | −0.90 / −1.42 | the veil's trailing joints |

The runtime chains the bones (each parented to the previous), so a head bend
carries the distal body; at rest the composed origins equal the exported
ones, which is what keeps the default bind identity.

## Behaviour numbers

**The Gentle Dark** (`GentleDarkSystem`). Rise point r 54.5 on the Open
Blue's axis (az 5.31), outside the r 51 swim cap; base rides y −34 → −13.2.
Schedule off `SEEDS.mythUmibozu`: first appearance [90, 150] s, gaps
[180, 360] s (the 3–6 minute rarity); rise 28 s, regard 40 s, sink 32 s;
reduced motion slows the verticals ×1/0.55 and holds the regard ×1.6. Two
emissive-pale toon eye discs pulse softly, opacity tied to emergence.
Discovery target: while regarding, on the silhouette's nearest point (face
z +2.06 at eye height — a diver at the end wall stands 1.5–2 m from it, and
mid-wing 12.5 m, both inside the 14 m reach); otherwise parked at y −60.

**Kraken Hatchling** (`KrakenHatchlingSystem`). Den at r 40 on the cove's
axis (az 3.51), anchor at `wingTarget(GLASS_COVE) + 0.34`; axis out of the
den tilted up 0.22. The `MorayPresence` machine itself with a shy-curious
style (wariness [0.55, 1], curiosity [0.45, 1], tucked/peeking holds ×0.65/
0.7, startle trigger ×0.85 = 2.72 m/s within 4.2 m), offsets scaled ×0.7.
Arms: curl targets tucked 0.95 / peeking 0.55 / extended 0.3 / startled 1.15
rad with per-arm phases (`SEEDS.mythKraken ^ 0xa235`), ease τ 0.45 (0.1
startled). Blanch: τ 0.15 to pale, 2.2 back; calm shimmer ±4.5% of tint.
Den dressing: 11 seeded glass pebbles (`^ 0xde1f`) banking the hollow with
the mouth sector open. Target on the mantle (local (0, 0.3, 0.08)).

**Moon Koi** (`MoonKoiSystem`). Pool r 40 on the lagoon's axis (az 3.15),
circle radius 4 m at y 2.5 (+0.08 bob), one revolution 25 s CCW from a
seeded starting phase. Constant circle bend 0.09 rad per spine joint (left,
toward the centre); swim wave 0.055 rad, 3.2 s period, 0.5 rad lag per
joint; ribbon joints ease toward the tail's angle at τ 0.9 (the trailing
delay) plus 0.1 rad sway. Diver drift: ≤ 0.5 m toward a calm diver
(< 1.1 m/s, < 12 m) or away from a fast one (> 3.2 m/s, < 10 m), τ 1.6.
Reduced motion: wave/sway/bob ×0.35, circle kept. Target on the brow
(z +0.72), updated per frame.

All three keep the visitors' transient-cost promise: procedural fallbacks
built at construction (readable primitives in the same palettes, driven by
the same rigs), GLBs adopted through `requestModel` with skeletons rebuilt
from the measured contracts; the no-assets build and the Node tests exercise
exactly these fallbacks. Optional canvas `portrait`s file the codex plates
(null off-DOM).

## Turntable self-critique (what the iterations changed)

- **Gentle Dark** (3 builds): it1's side view read hunched — a bulge
  symmetric about its own neck. it2 baked the 0.35 m forward pour and raised
  the eyes to 6.90 with bigger discs; the pour gave the silhouette its
  intent ("rising over the water"). it2's eyes were still smudges (COLOR_0
  max 0.62 vs the 0.90 contract): the ring distribution had a gap at the eye
  band. it3 added a density bump at z 6.9 — discs arrived full-strength.
- **Kraken Hatchling** (3 builds): it1's eyes were buried *inside* the
  mantle (bead centre at y −0.178, face surface at −0.19) and the arms
  splayed flat like a starfish. it2 moved the beads proud (−0.208) and
  larger (r 0.05), deepened the droop 0.38 → 0.50 and kicked the tips up
  0.10 → 0.16 — the sit became octopus. it3 accepted.
- **Moon Koi** (3 builds): it1's blush wrapped the flank in bands and the
  ribbon visibly detached below the peduncle; the eye barely painted. it2
  made the hi blotches (off-centre gaussians, flank falloff), rooted the
  ribbon at the peduncle line and enlarged the eye patch. it3 accepted.

## Verification

- `npm run typecheck`: my files clean. (Mid-flight I saw transient errors in
  other workers' files — `LumenGardenFlora.ts`, `tests/wingsW3Flora.test.ts`
  early on, later `mythics/serpent/OldCurrent.ts` and
  `mythics/sovereign/CrownSovereign.ts`. Not mine, left untouched; re-check
  at merge.)
- `npx eslint src/creatures/mythics --max-warnings 0`: clean.
- `npx vitest run tests/mythicsW8.test.ts tests/wings.test.ts`: **25/25
  green** (13 new: ids exact, Node fallback builds, gentle-dark schedule
  windows + parked/offered target + seeded determinism, kraken den placement
  + startle/blanch/recovery + presence caps + determinism, koi circle bounds
  inside the wedge + 25 s closure + drift toward/away + reduced-motion
  stillness; wings' 12 untouched and passing).
- Full `npx vitest run` (once, at the end): **444/450 green**. The 6
  failures are all other workers' mid-flight files — `tests/abyssBiome.test.ts`
  (1, fifth hiding spot), `tests/lifeSystems.test.ts` (1, anemone garden),
  `tests/wingDens.test.ts` (2), `tests/wingsW1Flora.test.ts` (2) — none in
  `tests/mythicsW8.test.ts` or anything I own.

## Flags

- The discovery focus band has a 1.2 m near dead-zone: at the risen face the
  diver discovers from 1.5 m out, so a diver pressed against the cap (r 51)
  is *just* inside the near limit and must ease off a stroke. Diegetic and
  intended, but worth knowing.
- Kraken and koi runtime rigs transcribe the measured joint bases by hand
  (the turtle's pattern). If a build script changes bone placement, the TS
  constants must be re-transcribed — the scripts say so in their headers.
- The kraken's pale-set / rose-tint trick relies on COLOR_0 staying the
  blanched palette; re-authoring the GLB darker would invert the blanch.
