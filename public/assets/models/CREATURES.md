# Creature GLB manifest — Round L atelier

Five assets, all built headlessly by the scripts in `tools/blender/creatures/`
(Blender 4.5.12 LTS, deterministic — every displacement is seeded or
hash-based, so a rebuild is bit-identical). Every number below was **measured
off the exported file** with `node tools/blender/creatures/inspect_creature.mjs
<file.glb>`, not read back from the build scripts. Preview renders live in
`visual-qa/atelier/` (the `-mapped-` turtle pair shows the shell painting
sampled through the exported UVs).

## Conventions shared by all five

- **Axes**: glTF Y-up. Every creature faces **+Z**; **+Y is dorsal**;
  **+X is the animal's left** (facing +Z with +Y up). Authored in Blender
  facing −Y and exported with `export_yup`.
- **`COLOR_0` is linear, converted from authored sRGB bytes.** Measured: a
  vertex painted sRGB 0.799 arrives at **0.6038**, and 0.955 at 0.9047 —
  the true sRGB transfer, not a 2.2 power. Three's `GLTFLoader` passes
  `COLOR_0` through unconverted, so `material.vertexColors = true` shows the
  authored colour. (This is the opposite convention from the coral GLBs,
  which use `FLOAT_COLOR` passthrough and author in linear via
  `perceived()`; these are colours, those are multipliers.)
- **UV contracts are stated in glTF/three convention** (`v = 0` samples the
  top row of a `flipY: false` texture). The Blender exporter's bottom-left →
  top-left flip is compensated inside `creature_common.write_uvs`, and the
  bounds below are post-export measurements.
- **No materials travel** (`export_materials="NONE"`); the game applies its
  shared toon material. No normal/roughness/alpha maps anywhere.
- **Skins**: joints are real glTF skin joints (glTF has no named vertex
  groups). `WEIGHTS_0` sums to exactly 1.0 per vertex on every skinned asset
  (measured); unlisted vertices ride the `root` joint at the origin. A bone
  rotates about **its own local +Y**, which the tables below give in model
  space, measured from the exported node hierarchy.
- Nothing here casts a shadow decision, raycast contract or LOD; those are
  the integrator's.

---

## creature-shrimp.glb — cleaner shrimp

| | measured |
|---|---|
| verts / tris | 126 / **224** (budget 300) |
| bounds (m) | x ±0.0116, y [0.0030, 0.0188], z [−0.0272, 0.0530] |
| body length | 0.050 m nose→tail; antennae reach z = 0.053 |
| pivot | origin sits ~3 mm *below* the body, mid-length — plant it on a coral head and the animal hovers correctly |
| joints | none |
| UV | u ∈ [0, 0.5] mirrored around the body (0 belly, 0.5 spine); v ∈ [0, 1] nose→tail |
| COLOR_0 | pale shell (linear ≈ 0.90) with three deep-red bands and a red-tipped tail fan |

Design notes: sized to render at ~10 px; the bands are transverse (not the
real animal's longitudinal stripe) because a 1 px stripe along a 10 px body
is invisible. Antennae are one-sided ribbons — at this scale their silhouette
is their width.

## creature-moray-head.glb — the hero

| | measured |
|---|---|
| verts / tris | 1481 / **2942** (budget 3500) |
| bounds (m) | x ±0.0828, y [−0.0989, 0.1020], z **[0.0000, 0.5560]** |
| pivot | **neck-ring centre**. Nothing sits behind z = 0; snout tip at z = 0.556 (0.55 m head + 6 mm chin/snout caps) |
| neck ring | **ellipse**, half-width 0.072 (x) × half-height 0.080 (y) — quote it as an ellipse, its girth is not a circle's |
| joints | `root` at origin; **`jaw`** at glTF **(0, 0, 0.231)**, local +Y → **(1, 0, 0)** (model +X), 365 vertices weighted |
| jaw motion | rest gape ≈ **11°** is *baked into the mesh* by the same weight field the skin carries. Rotating `jaw` about its local +Y by +θ opens further; **−11° closes the mouth** to shut. The hinge axis is model +X through (0, 0, 0.231). |
| UV | u ∈ [0, 0.5], v ∈ [0, 0.12] — measured exactly |
| COLOR_0 | dorsal #ded7c6 → belly #f2ecdf gradient; mouth lining dark warm; socket dish ×0.88 (the two documented occlusion exceptions) |

UV layout is the analytic form of `src/creatures/morays/MorayHeadUv.ts`:
`u = φ_m / 2π` (0 at the belly, 0.5 at the dorsal spine, **mirrored** across
the flanks — both flanks sample the same pixels), `v = 0.12 · s` with s = 0
at the snout, computed from the **pre-gape** parameters exactly as the game
projects from the rest pose. The nasal tubes and caps carry flank-band UVs.

**The neck cap is deletable.** The last ring is capped by a fan whose centre
sits at z = 0.008, inside whatever body tube the head is grafted onto; keep
it for a standalone prop, strip it when grafting.

### Contract ambiguities (flagged, not resolved)

1. **v-band height: 0.12 vs the game's 0.042–0.078.** The brief said
   `v ∈ [0, 0.12]`; the game's actual `neckV` is per-archetype
   (`MorayBodyGeometry.neckV`, 0.042–0.078). **0.12 is baked.** An
   integrator matching a live archetype must rescale v by `neckV / 0.12`
   (a linear scale on the v channel, safe because v is linear in s).
2. **Scale.** Built to brief: 0.55 m head, 0.144 × 0.160 m neck ellipse.
   The game's `standard` archetype head is ~0.86 m with neck radius 0.200
   (half-width 0.9r × half-height r). Conversion factors, pick ONE:
   - match the standard **neck girth**: scale × **2.49** (head becomes 1.37 m — oversized)
   - match the standard **head length**: scale × **1.56** (neck becomes 0.25 m girth — undersized)
   - other archetype neck-girth matches: ribbon × 1.45, compact × 2.76, robust × 3.55.
   The two disagree because the brief head is proportionally slimmer than
   the game's; the integrator has to choose which contract wins.
3. **Eye socket 24 mm vs the game's 108 mm eye bead.** The socket dish
   (s ≈ 0.44, φ ≈ 0.60π, i.e. just above the mouth line at mid-length) is
   built to the briefed ~24 mm. The game places a 108 mm-diameter eye bead
   at (±0.15, 0.115, 0.40) · headScale, which would swallow the socket.
   **Recommendation: shrink the bead ~4× for this head, or scale the whole
   head by ambiguity #2's factor first and re-judge.**
4. **Lining colour deviates from brief.** The briefed #6e5250 rendered as
   pale pink under any key; shipped lining is (0.36, 0.26, 0.25) sRGB —
   same hue, one value step darker — plus the ×0.82 occlusion.

## creature-turtle.glb — sea turtle

| | measured |
|---|---|
| verts / tris | 796 / **1552** (budget 4000) |
| bounds (m) | x ±1.020 (flipper tips), y [−0.106, 0.339], z [−0.860, 1.115] |
| carapace | **1.40 m** (z ∈ [−0.70, 0.70] + 2 cm caps), 1.02 m wide, 0.34 m high, hard flared rim with downturned skirt |
| pivot | **carapace centre**; the plastron bottoms out at y = −0.106, so sit it 0.11 m above the sand |
| UV | u ∈ [0.031, 0.980], v ∈ [0.035, 0.965] — one map: `public/assets/creatures/turtle-shell.png` |
| COLOR_0 | olive shell / cream marginal+plastron / sage skin, one dark eye vertex per cheek |

**UV plan (verified visually: `turtle-it2-mapped-*.png`):** the painting's
left two-thirds are the carapace oval, its right third a dotted skin field.
The carapace above the rim is planar-projected from above onto the oval
(centre (0.335, 0.50), radii (0.315, 0.465)) so the painted marginal ring
lands on the geometric rim; plastron, neck, flippers and tail project into
the dotted field (u ∈ [0.70, 0.98]). The split sits just *below* the rim so
marginals wrap over the edge and read from the side.

**If the map is applied, ignore `COLOR_0`** (`vertexColors: false`) — the
vertex colours approximate the same painting and multiplying the two
squares the value down.

### Joints (all measured from the export; local +Y = rotation axis)

| joint | origin (glTF) | local +Y (model space) | motion | verts |
|---|---|---|---|---|
| `head` | (0, 0.045, 0.660) | (1, 0, 0) | +θ about own Y = **nod down** | 81 |
| `flipperFL` | (+0.420, −0.020, 0.360) | (0, 0, 1) | +θ = tip **up** | 43 |
| `flipperFR` | (−0.420, −0.020, 0.360) | (0, 0, 1) | +θ = tip **down** (mirror) | 43 |
| `flipperBL` | (+0.330, −0.020, −0.420) | (0, 0, 1) | +θ = tip up | 43 |
| `flipperBR` | (−0.330, −0.020, −0.420) | (0, 0, 1) | +θ = tip down | 43 |

The flap axis is body-forward (+Z) on purpose: a swimming stroke is a roll
of the flipper about its own root line. Left and right are **not**
sign-corrected — drive FR/BR with negated angles for a symmetric stroke.
Weights ramp in over the first third of each limb, so a rotation bends at
the shoulder rather than shearing at the body wall.

## creature-jelly-bell.glb — jellyfish bell

| | measured |
|---|---|
| verts / tris | 602 / **1200** (budget 1200) |
| bounds (m) | x, z ±0.320, y [−0.155, 0.330] |
| pivot | centre of the margin opening plane (y = 0); apex at +0.33 |
| joints | none — the bloom drives drift, and a pulse is a scale animation |
| UV | planar from above, disc in [0.035, 0.965]² (no painting exists; documented for completeness) |
| COLOR_0 | apex pale lavender → margin rose-violet, scallop bays deeper, **inner shell a full step deeper** |

The bell is a closed thin shell (outer dome recurving under the margin,
inner dome rising back inside) so it reads from below. "Translucency" is
value: the interior is painted deeper, so wherever geometry shows interior
the colour deepens. Eight scallop lobes at exactly 5 columns each — the
column count is a multiple of the lobe count on purpose. Radially
symmetric; no facing direction.

## creature-den-mouth.glb — rock archway for a hiding spot

| | measured |
|---|---|
| verts / tris | 686 / **1320** (budget 2500) |
| bounds (m) | x [−1.545, 1.496], y [−0.060, 1.319], z [−0.580, 0.660] |
| doorway | ≈ **0.9 m wide × 0.7 m tall**, axis along **Z** (a moray inside looks out along +Z; the crown leans toward −Z, the reef side) |
| pivot | ground centre of the opening; everything below y = −0.04 is clipped flat so the feet can be sunk into any dune |
| joints | none |
| UV | parametric (arc-length, circumference) scaled to **one UV unit ≈ 2.3 m** — the reef rock wash's own tile spacing. **u runs to 1.94 and v to 1.14: the texture must be `RepeatWrapping`** (the wash already is). |
| COLOR_0 | near-neutral pale stone (mean ≈ 0.51 linear) with high-frequency value mottle |

Built to the reef's own rules, read from `Reef.ts`/AGENTS.md: all normals
arrive welded (every loft wraps, no duplicated seam columns); the colours
are a near-white **multiplier** so a rock-family or algae tint carries the
hue — do not fight it with a saturated tint *and* expect the painting's
colour to survive. The inner face of the arch shades toward the game's own
`caveInterior` violet-blue and keeps its channel ordering (measured minima
r 0.144 < g 0.185 < b 0.296), so the den deepens into the reef's darkness,
not into grey. If this piece guards an actual hiding spot, remember coral's
six-metre rule and the sightline test (`tests/reefSightlines.test.ts`) —
this mesh is scenery and will not fail a raycast for you.

---

## Rebuilding

```
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python tools/blender/creatures/build_<name>.py -- --tag <tag>
```

Each script exports its GLB and writes preview renders to
`visual-qa/atelier/`. Blender must run outside any sandbox (it dies in
Metal backend detection otherwise). Verify any change with the inspector
before trusting it; every claim in this file is reproducible from it.

---

## Wave 8 additions

Ten new assets landed with the wave-8 expansion, all built by the same
headless pipeline and held to the same contracts above (glTF Y-up, face +Z,
+X the animal's left, linear COLOR_0, no materials, real joints where
stated). Budgets are measured, not aspirational. **Full per-asset contracts
live in the builders' ledgers under `docs/wave8-ledger/`** (w7, w8, w9, w10,
w12 for creatures; w11 for the corals, which follow `coral_common`'s
FLOAT_COLOR/`perceived()` convention instead).

| asset | tris (budget) | joints | ledger |
|---|---|---|---|
| creature-serpent.glb | 2942→2782 (6000) | neck, spine1–5, tail | w7 |
| creature-crown-jelly.glb | 2400 (3000) | none | w7 |
| creature-kirin.glb | 2600 (4500) | neck, head, tail | w7 |
| creature-gentle-dark.glb | 1144 (2000) | none | w8 |
| creature-kraken-hatchling.glb | 2000 (4000) | root + arm0–7 | w8 |
| creature-moon-koi.glb | 1348 (3500) | root + spine0–4 + ribbon0–1 | w8 |
| creature-lantern-leviathan.glb | 3393 (6000) | fluke, pectL, pectR | w9 |
| creature-island-turtle.glb | 3172 (6000) | head + 4 flippers | w9 |
| creature-crab.glb | 736 (800) | none (baked pose) | w10 |
| creature-clownfish.glb | 684 (900) | none | w12 |
| coral-tube.glb | 1520 (2500) | — (unit footprint) | w11 |
| coral-fan.glb | 1200 (2200) | — (unit footprint) | w11 |
| coral-branch.glb | 625 (2600) | — (capsule frame, documented deviation) | w11 |
