# W7 — The Old Current, Crown Jelly Sovereign, Reef Kirin

Three mythics end to end: Blender GLBs (three iterations each, turntable
self-critique per round), runtime beings with procedural stand-ins,
discovery targets, canvas-painted codex plates, and `tests/mythicsW7.test.ts`.
All numbers below measured with `node tools/blender/creatures/inspect_creature.mjs`
on the shipped files, not read back from the build scripts.

## Asset contracts (CREATURES.md-style)

Shared conventions, unchanged from the existing five: glTF Y-up, face +Z,
+Y dorsal; `COLOR_0` is BYTE_COLOR written sRGB and arrives linear;
`WEIGHTS_0` sums to exactly 1.0 (measured); no materials travel.

### creature-serpent.glb — The Old Current (`myth-old-current`)

| | measured |
|---|---|
| verts / tris | 1446 / **2782** (budget 6000) |
| bounds (m) | x ±0.0839, y [−0.0521, 0.1093], z [−0.490, 0.532] |
| pivot | mid-body, slightly forward; head tip at z = 0.532 |
| scale | **authored 1 m, scaled ×9 at runtime** (`SERPENT_SCALE`) → 9.2 m nose→tail |
| UV | u ∈ [0, 0.52] (0 belly, 0.5 spine, mirrored), v ∈ [0, 1] snout→tail |
| COLOR_0 | sea-green flank (0.385, 0.615, 0.510 sRGB) → deeper spine; cream belly (0.905, 0.870, 0.700); deep violet dorsal fin (0.360, 0.265, 0.520 → 0.520, 0.400, 0.660 edge); soft painted saddles along the back; dark eye oval + mouth seam per cheek |

Joints (all local +Y → (0,1,0) model space: `rotation.y` yaws the
vertebra; runtime chains `spine1→tail` and hangs `neck` off the root so
the gaze turns the head without dragging the body):

| joint | origin (glTF) | covers |
|---|---|---|
| `neck` | (0, 0, 0.360) | head, 409 verts |
| `spine1`..`spine5` | z 0.220 → −0.300 | trunk, 326–312 verts each |
| `tail` | (0, −0.011, −0.400) | tail tip, 257 verts |

### creature-crown-jelly.glb — Crown Jelly Sovereign (`myth-crown-sovereign`)

| | measured |
|---|---|
| verts / tris | 1370 / **2400** (budget 3000) |
| bounds (m) | x, z ±1.1787 (bell Ø 2.24 m); y [−1.3151, 0.720] |
| pivot | margin opening plane (y = 0), apex +0.72, tendrils trail to −1.32 |
| joints | none — pulse is a scale animation (the jelly-bell idiom) |
| UV | planar from above, u, v ∈ [0.018, 0.982] |
| COLOR_0 | deep indigo bell (apex (0.295, 0.255, 0.545) → margin (0.360, 0.280, 0.600)), inner shell a full step deeper (0.185, 0.150, 0.405); **BRIGHT gold-rose coronet** band + 12 spikes (1.000, 0.735, 0.430 → tips (1.000, 0.820, 0.560)); apex rosette of 12 deeper petals; tendrils indigo → pale gold-rose tips (0.950, 0.720, 0.520) |
| glow key | wherever the painted colour runs warm, `COLOR_0.r − COLOR_0.b` > 0; the bell is b > r. The runtime material (`CROWN_GLOW_CHUNK` in `sovereign/CrownSovereign.ts`) adds emissive keyed on exactly that gap, peak < bloom's 0.82 threshold |

### creature-kirin.glb — Reef Kirin (`myth-reef-kirin`)

| | measured |
|---|---|
| verts / tris | 1356 / **2600** (budget 4500) |
| bounds (m) | x ±0.177, y [0.014, 1.702] (antler tips), z [−0.159, 0.373] |
| pivot | under the tail curl (y = 0); upright, faces +Z |
| UV | u ∈ [0, 0.9], v ∈ [0, 1] (tail→nose) |
| COLOR_0 | pale gold body (0.905, 0.800, 0.575), cream belly, deeper back (0.720, 0.600, 0.390); painted rings around the tail curl; moss mane (0.470, 0.545, 0.320 → 0.610, 0.670, 0.400); coral-rose antlers (0.935, 0.615, 0.510 → pale tips); rose muzzle; dark eye ovals |

Joints: `neck` (0, 1.09, 0.08), local +Y → (0,1,0) = the deer-yaw;
`head` (0, 1.30, 0.17), local +Y → (1,0,0) = the nibble/nod pitch
(turtle's head idiom, same sign: +θ down); `tail` (0, 0.356, −0.036),
local +Y → (0,1,0) = curl sway. Runtime chains `head` under `neck`.
The chest keeps `root` weight (520 verts) so the grazer stays planted.

## Behaviour numbers

- **Old Current** (`serpent/OldCurrent.ts`): racetrack figure-eight on the
  Open Blue axis — centre r 43, y 5.5; tangential ±4.5 m, radial ±1.6 m,
  bob ±1.5 m at twice the eight's frequency so the arms cross at different
  heights; period 85 s; path provably inside r [41.4, 44.6], y [4, 7], and
  the wedge (tests hold r 38–48 / y 3–8 / wedge walls). Bank and a spine
  curvature feed (max ±0.28 rad/joint) baked from the path's turn rate, so
  the body fillets the lobes. Undulation 0.14 rad/joint at 0.32 Hz, 0.55
  rad lag. Gaze: diver < 12 m and < 1.2 m/s → neck yaw toward them,
  clamp ±0.5 rad. Discovery target rides the circuit 0.55 rad of phase
  ahead (where the head is), so it inherits every path bound. Nearest pass
  to the on-axis corridor ≈ 3 m « 12 m — discovery earnable.
- **Crown Sovereign** (`sovereign/CrownSovereign.ts`): home r 42 on the
  Lumen Garden axis; y = 3 ± 2 on a 44 s breath (y 1–5, tested); drift
  radius 1.2 m, period 64 s; pulse 0.13 Hz (squash 0.08 / stretch 0.13);
  trailing lean ∝ vertical velocity (≤ 0.12 rad) + 180 s precession;
  tendril sway on the stand-in. Discovery target on the bell (+0.25 y).
- **Reef Kirin** (`kirin/ReefKirin.ts`): 6 seeded waypoints, r ∈ [38.5,
  43.5], ±0.065 rad of the Ruins Terrace axis (inside the floor band);
  shuffle from `seed ^ 0x0dd`; idle table (4.5–9 s grazes, 2–5 nibbles at
  0.55–0.8 s) from `seed ^ 0x1d1e`. Travel 0.38 m/s, arrive radius 0.3 m;
  hover = seabed + 0.18 m + 0.04 m breath bob. Deer-attention: diver
  < 9.5 m and < 1.2 m/s → attention rises 0.8/s (falls 0.45/s); while
  attended the kirin stands, necks yaw (±0.6) toward the diver and holds
  the head at −0.14 rad; nibbles blend out. No flee, ever. Discovery
  target at the head (0, 1.42, 0.20).
- **reducedMotion**: serpent 0.55× pace and wave, 0.5× bank, 0.6× curl;
  sovereign 0.55× clocks, 0.5× pulse/lean; kirin 0.55× travel, damped
  bobs/sway. All graceful, nothing freezes.
- Seeds: only `SEEDS.mythSerpent` / `mythSovereign` / `mythKirin` (+ `^`
  substreams), all drawn in constructors before any `requestModel`.
- Fallbacks: chained-pivot serpent (same 7 pivots + same wave), lathe-bell
  sovereign with cone coronet + ribbon tendrils (same palette, so the
  crown lamp lights it too), stacked-primitive kirin on the measured
  pivots. The no-assets build is exercised by the tests.
- Portraits: 2D canvas plates (`shared/plate.ts` + per-being painters),
  null without a document; the codex keeps its frame either way.

## Verification

- `npm run typecheck` clean; `npx eslint src/creatures/mythics tools/blender --max-warnings 0` clean.
- `npx vitest run tests/mythicsW7.test.ts tests/wings.test.ts` — **27/27 green** (15 mine).
  Covers determinism (two builds, 240 frames, bit-equal targets),
  fallback-presence without `window`, serpent circuit bounds + wedge +
  corridor sweep, sovereign rise band + wedge, kirin corridor + attention
  (rises to > 0.9 for a calm near diver, falls < 0.05 when far; < 0.05 for
  a fast diver), budgets (constants + inspector-parsed GLB tris when built).
- Full `npm test` (once, at the end): **481 passed, 3 failed**, all three
  in other workers' in-flight files, none touching mine:
  - `tests/abyssBiome.test.ts` — "keeps the fifth hiding spot on the canyon
    floor" (moray/dens worker's domain).
  - `tests/wingDens.test.ts` — "paints every species' procedural skin" and
    "resolves every spec against its wing's carved floor" (frost-moray
    azimuth) — the wave-8 morays/dens worker's mid-flight change.

## Flags

- **Mid-flight, not mine**: the three full-suite failures above. Earlier in
  the wave `tests/fishDiversity.test.ts` also had an unused-import typecheck
  error (fixed by its owner while I worked). Nothing red is in W7's file
  list.
- Kirin waypoints were authored against the Ruins Terrace floor as it
  stands (`seabedHeight`); the wing's monuments are W-scenery's, still
  stubs — if their layout lands elsewhere than the corridor, the graze
  range is one constant block (`KIRIN_RANGE`).
- The sovereign's crown lamp is deliberately ~0.7 under the bloom pass's
  0.82 threshold: a lamp, never a light source. If the critic wants it
  brighter, raise the 0.55 in `CROWN_GLOW_CHUNK`, not the threshold.
- Serpent's GLB head can lead the root into the wedge's skirt at the
  tightest lobe by ~1 m of mesh (the target stays inside; verified the
  path, not the mesh). No collider there — the wing's walls begin past the
  wedge half-angle; flagged rather than hidden.
