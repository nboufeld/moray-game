# Ledger — connective-1 (Phase 3, Batch 1)

The connective rework's first package: gate veils on all six Tier A
gateway doorways (the program's worst seam — "flat cyan cut-outs"), the
Open Blue's poster-blue hole repainted as depth, and whatever Tier A
quick wins fit the ceilings without starting Batch 2. Lane per MASTER
R3: wings, gate-veils and seams only — no region directory is touched.

Authority: FILL-DOCTRINE > MASTER (R2 wing ceilings, R3 ownership) >
connective-tissue.md. Kit piece: `src/world/regions/kit/GateVeil.ts`
(Package B, demo-proved `gateVeil_b-final.png` / `gateVeilDark_b-final.png`).

## The mount

One shared placement idiom, `src/world/wings/flora/GateVeilMount.ts`:
doorway on the wing's own azimuth at r ≈ 48.6 (vent-springs 48.9 — see
its row), sill on `seabedHeight`, facing back down the axis so the
planes recede INTO the province. Seed = the wing's own stream `^ 0x9a7e`
fed to the kit's private Random — the fence is structural: nothing
existing can re-roll, and `tests/wingsConnective1.test.ts` pins it with
pre-veil sentinels (commit b53da4f values).

## Per-doorway palette rationale (inks near → far)

| Doorway | Province promise | Inks | Column | Motes |
|---|---|---|---|---|
| kelp-cathedral | Great Kelp Sea's bright spring green | 0x123526 / 0x22553c / 0x3e7a58 (the kit demo's proven verdant register) | leaf-lit 0xe4f0c0 @ 0.10 | pollen 0xdce8a8 ×90 |
| vent-springs | Smoulder: light from BELOW, warm and rising | 0x2c1c14 / 0x513226 / 0x7a5138 (charcoal-rust → umber, distance family 0x8a6a58's kin) | amber 0xffc27a @ 0.11 | ember 0xffb680 ×70 |
| ghost-reef | Bone Meadows: white → blush ("paper held to a lamp") | 0x778b88 / 0x9aa9a5 / 0xb9a9b2 — the one veil that LIGHTENS with depth; far ink leans rose-violet (INK_BLOOM's kin) | pearl 0xeef4ee @ 0.09 | pearl 0xf2f4ee ×80 |
| ruins-terrace | Sunken Calamity: cold, settling | 0x2f2b38 / 0x4a4656 / 0x635f70 (grey-violet, red held over green) | cold 0xaebccc @ 0.08 — the game's ONE cold light family (§1.1), correct here | ash 0xb8bcc4 ×60 |
| open-blue | Drop Plains: green prairie → violet Under-Blue, never cobalt | 0x1e4038 / 0x3a3656 / 0x565078 | none — the Old Current owns this water; the hole's rim carries the light | none in the veil; the hole's snow column instead |
| sandfall-dunes | Hourglass Sea: honey over violet | 0x4a3a2e / 0x74583a / 0xa08252 | gold dapple 0xffe0a0 @ 0.10 | gold 0xffe0a0 ×80 — the golden plan's "gold motes before the door" started early |

## The Open Blue hole repaint (its plan row: "depth as paint")

Three custom marks inside `wing-gate-hole` (OpenBlueFlora, `^ 0x9a7f/0x9a80`):
baked radial gradient (violet-over-green inks 0x232040 → 0x3c3760,
normal blend, alpha ≤ 0.52, fbm-wobbled dissolve so no ellipse reads),
a rim-light band peaking just inside the terrain edge and sun-heavy on
its top arc (additive, ≤ 0.14), and a marine-snow fall column sinking
through the opening (kit particulateField, mode "fall", ×90).

## Budgets, measured (`[conn1-budget]`, vitest prints them each run)

| Wing | Uplift | R2 ceiling | Wing total after |
|---|---|---|---|
| kelp-cathedral | +5 draws / +1,616 tris | ≤ +10 / ≤ 35k | 13 draws / 22.8k tris |
| vent-springs | +5 / +1,616 | ≤ +10 / ≤ 35k | 10 / 9.6k |
| ghost-reef | +5 / +1,616 | ≤ +10 / ≤ 35k | 11 / 14.2k |
| open-blue | +6 / +2,288 | ≤ +10 / ≤ 35k | 11 / 4.8k |
| sandfall-dunes | +5 / +1,616 | ≤ +10 / ≤ 35k | 9 / 7.5k |
| ruins-terrace | +5 / +1,616 | ≤ +10 / ≤ 35k | 9 / 8.2k |

Whole-batch uplift: +31 draws / +10.3k tris resident — well under the
program's +120 / +380k envelope even before Batches 2–3 claim theirs.
No `frustumCulled = false`, no castShadow, every sphere past r 27 and
inside the wing's cone (the frustum-guard suite holds it).

## Test-collector amendments (stated, not hidden)

Two wave-8 test files were amended surgically, rulings cited in place:

- `tests/wingsW1Flora.test.ts` — `drawStats` excludes the veil subtree:
  the 10-draw cap pins the ORIGINAL kelp-cathedral flora (8 draws); the
  veil's +5 is R2 uplift budget, measured in the connective suite.
  Determinism and confinement still read the veil.
- `tests/wingsW5Flora.test.ts` — `collectVertices` excludes the veil
  subtree: veil planes recede past the carve's radial envelope by
  design (the promise stands BEHIND the door); the wave-8 envelope law
  was written before doorways opened. Everything wave-8 built is still
  read vertex for vertex.

W2/W3/W4 needed no amendment: W3/W4 collect top-level children only
(the veil is one nested Group), and the vent-springs doorway was sized
(r 48.9, width 4.6) so its mote volume stays wholly past r 46 — the den
corridor law keeps reading every vertex it always read.

## Critique rounds

### r1 (first placement)
- Captures: `visual-qa/*_conn1-r1.png` (before set: `*_conn1-before.png`).
- (critique below, per round)

## Flags

- **Pre-existing shader failure on this branch (not connective's):**
  the bowl boot logs `THREE.WebGLProgram: Shader Error — MeshToonMaterial
  ... 'assign': cannot convert vec4 → vec3` at the patched line
  `totalEmissiveRadiance *= vColor;`. Some toon material carrying the
  emissive-by-vertex-colour patch is being rendered with an RGBA colour
  geometry (vColor becomes vec4). All wing-flora pairings grep clean
  (RGB); the candidates are region-side (smoking1's veinGlow family) or
  a kit piece paired at render time. Needs a node-toggle probe in the
  owning lane; it predates this package's first commit.
- **Capture flakiness under batch load:** the QA machine runs three
  sibling worktrees' capture rigs concurrently (load avg 9–17); page
  boot takes 70–155 s against the script's hard 180 s budget, so runs
  fail sporadically at `waitForFunction`. Retried until green rather
  than touching the capture scripts (not this lane's files).
- The `SEEDS.wingGates` stream (0x5a4d_0911, "gate dressing shared
  machinery") is registered but unused in src; the veils deliberately
  ride each wing's own stream per the batch contract instead.
