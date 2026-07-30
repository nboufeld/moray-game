# KIT-SPEC — the buildable specification for `src/world/regions/kit/`

The Phase 2 deliverable, reconciled from all eight fill plans. Package
split and consumers-per-piece live in MASTER.md §3/§5. Eighteen pieces,
two packages, zero Blender work (MASTER ruling R7). Signatures are
sketches — option NAMES and semantics are contractual, the exact
TypeScript shape is the builder's.

## 1. Shared conventions — `kit/KitTypes.ts` (Package A, day one)

```ts
/** What every builder returns. Budget numbers are HONEST — counted from
 *  the meshes actually created, asserted by the kit tests. */
export interface KitBuild {
  readonly group: Group;      // caller parents it; kit never touches a Scene
  readonly draws: number;     // draw calls this build adds
  readonly triangles: number; // triangles this build adds
  dispose(): void;            // releases ONLY what the build created
}

/** Region palettes are parameters, never baked in. Hexes are the sRGB
 *  colours a painter picked; builders convert as the bowl does. */
export interface KitPalette {
  readonly base: number;
  readonly tip?: number;      // tip/crest lift (TIP_GOLD-class accents)
  readonly shade?: number;    // crotch/root shade — a COLOUR, never black
  readonly accent?: number;
}

/** Density gate in [0,1] — regions pass their weight/recovery/biome
 *  functions; kit pieces never import terrain modules. */
export type GateFn = (x: number, z: number) => number;
/** World floor height — regions pass their own terrain sampler. */
export type GroundFn = (x: number, z: number) => number;

/** Where a piece scatters: a disc or a road. */
export type KitArea =
  | { center: [number, number]; radius: number }
  | { polyline: [number, number][]; width: number };

/** MASTER §4.1's random-sweep salt, one constant for every region:
 *  a sweep pose stream is `new Random(SEEDS.region<X> ^ KIT_SWEEP_SALT)`. */
export const KIT_SWEEP_SALT = 0x5a4d_5eed;
```

**The laws (every piece, no exceptions):**

1. **Kit pieces never touch seeds, registries, or shared systems.** Each
   builder takes `seed: number` and derives a PRIVATE `new Random(seed)`.
   It never reads `SEEDS`, never consumes from a caller's live `Random`
   (so adding a kit call can never re-roll existing region content),
   never imports `AssetLibrary` except where this spec says so
   (`dappleSheet`), never registers colliders, contacts, discovery
   targets or audio, and never touches `Scene`, `window` or `document`.
   Regions pass `SEEDS.region<X> ^ <fresh constant>` seeds, appended
   after all existing draws — the standing reroll fence is the CALLER's.
2. **One lit door.** Every lit surface via `createToonMaterial`; every
   additive mark is `MeshBasicMaterial` carrying the four-part light
   discipline (`fog: false`, baked ground fade in vertex colours, edge-on
   fade, camera-distance fade) where it applies; no castShadow /
   receiveShadow anywhere in the kit; nothing near the bloom threshold
   (per-piece glow/opacity caps below).
3. **Paint is authored, value-first.** Vertex colours carry the drawing:
   darkest thing is a colour; violets keep red above green; tips lift,
   roots shade; counter-shading is a marking, not a second model of the
   light. Vertex colours only darken relative to the instance/material
   colour (the GLB ceiling rule) so palettes stay the one hue source.
4. **Honest bounds.** Every `InstancedMesh` calls
   `computeBoundingSphere()` off its real matrices (the sill-stones
   trap); merged meshes segment wide arcs so conservative frustum tests
   can cull them (the abyss-curtain lesson). `frustumCulled = false`
   only where every instance moves every frame (shoals, darting movers)
   — and never inside a wing (MASTER R2).
5. **Determinism.** Same seed + same options ⇒ byte-identical buffers,
   in plain Node. All geometry from typed arrays / `DataTexture`s; all
   motion closed-form off simulated time (capture-safe).
6. **Budget shape per the doctrine tier table** (T1 huge counts, 1–3
   draws per kind; T2 hundreds, few draws; T4 instanced + shader
   motion). Each file's header carries its budget note; tests assert it.
7. **Fallback.** Every kit piece is fully procedural, so the noassets
   build renders it identically — that IS the fallback; each region's
   noassets set is the proof. The one asset-touching piece
   (`dappleSheet`) keeps its generated stand-in per `AssetLibrary`.

## 2. Package A — ground & flora builders

### 2.1 `carpetField` — `kit/CarpetField.ts`

- Signature: `buildCarpetField({ seed, palette, area, gate, ground,
  count, profile? /* "card" 4-tri bent quad | "tuft" 8–16-tri crossed */,
  size? /* [min,max) m */, rake? /* {yaw, strength} comb */,
  swayAmp? /* 0 = static */ }): KitBuild`
- Draws **1 per call** (one `InstancedMesh`). The T1 answer for every
  region: moss/litter/silt/sward/shell/milky-crest/tread-moss/celadon/
  deck-joint carpets and grass/wire tufts are all palettes of this one
  piece. Rejection-samples against `gate` with draws consumed on
  rejection, so a density retune never shifts survivors.
- Paint: per-instance value jitter ±8%; tip toward `palette.tip`, root
  toward `shade`; card bend authored so the ramp rolls a band across it
  (the W-N2 cup lesson). Budget note: 3,000 cards ≈ 12k tris.
- Demo: three palettes side by side, one raked. Consumers: all seven
  regions, wings, vales.

### 2.2 `groundLitter` — `kit/GroundLitter.ts`

- Signature: `buildGroundLitter({ seed, palette, area, gate, ground,
  count, shapeSet? /* "gravel"|"shard"|"pebble"|"grit" | caller
  BufferGeometry[] */, size?, rake? /* {from:[x,z], strength, jitter} */,
  twoTone? }): KitBuild`
- Draws **1–2** (one instanced draw per tone family). Gravel/scree/shard
  runs, cinder and scoria drifts, pebble aprons; 6–24 tris per instance,
  lying ON `ground` with seeded tilt. The `rake` knob aligns instance
  yaw radially AWAY from a world point (calamity's blast alignment — its
  region test samples yaws and asserts alignment ± tolerance).
  `shapeSet` accepts caller geometry for exclusive shapes (pale-1's
  vertebra/branch ossuary fragments — MASTER R8).
- Paint: top-face value lift, underside shade colour.
- Demo: a polyline run crossing a disc field, raked vs unraked.
  Consumers: all seven regions, wings.

### 2.3 `screeApron` — `kit/ScreeApron.ts`

- Signature: `buildScreeApron({ seed, palette, ground, anchors
  /* {pos:[x,z], facing, spread}[] */, slabsPerAnchor }): KitBuild`
- Draws **1**. Flat slab family (8–14 tris) seated against a wall foot,
  tree foot or shelf lip, fanned downslope from each anchor — the
  "things grow FROM somewhere" fix (pale walls, blue terrace lips,
  smoking column feet). Ankle scenery by construction: never colliders.
- Paint: strata-banded value; edge chips darker-as-colour.
- Demo: three aprons on the demo wall's berm. Consumers: pale-1,
  blue-1, smoking-1, wings.

### 2.4 `matRings` — `kit/MatRings.ts`

- Signature: `buildMatRings({ seed, bands /* {color,width}[] centre→rim */,
  ground, anchors /* {pos:[x,z], radius}[] */, tiers? }): KitBuild`
- Draws **1** (merged rim-banded discs, ~24–40 tris each, draped to
  `ground`). The banded-disc BUILDER is kit; the tiered
  amber/rust/sinter palette is smoking-1's exclusive signature,
  white-felt/rust is calamity's (MASTER R8).
- Paint: bands in vertex colour with a soft outer fade to zero contrast
  (no hard rim — the pool-rim minification lesson).
- Demo: one 3-tier ring + one felt mat. Consumers: smoking-1, calamity-1.

### 2.5 `bushBank` — `kit/BushBank.ts`

- Signature: `buildBushBank({ seed, palette, area, gate, ground, count,
  lobes?, scale? }): KitBuild`
- Draws **1 per palette family**. The bowl `Seaweed` welded-lobe idiom
  rebuilt for regions (~140–180 tris per bush); spring/olive/wine/pale/
  smoke/gold families are palette parameters.
- Paint: lobe tops toward `tip`, inner crotches toward `shade`;
  per-instance hue jitter kept small (the confetti lesson — variety by
  value, not hue noise).
- Demo: two palettes, one bank of 12. Consumers: verdant-1, verdant-2,
  smoking-1, golden-1, calamity-1, vales.

### 2.6 `spongeCluster` — `kit/SpongeCluster.ts`

- Signature: `buildSpongeCluster({ seed, palette, ground, anchors,
  tubesPerAnchor?, height? }): KitBuild`
- Draws **1**. The W-N5 sponge profile verbatim: long, narrow, walls
  near parallel, trumpet only in the last sixth; 3–5 staggered tubes per
  holdfast, ~180 tris/tube.
- Paint keyed off the lathe's own profile index — port `paintTube`, do
  not reinvent it: exterior ceiling 0.9 at the lip, throat leans red and
  deepens (living tissue over a dim interior).
- Demo: one ochre + one violet cluster. Consumers: verdant-1, verdant-2.

### 2.7 `wallDrapeBank` — `kit/WallDrape.ts`

- Signature: `buildWallDrapeBank({ seed, palette, anchors
  /* {pos:[x,y,z], normal}[] */, strandsPerAnchor?, length?,
  swayAmp? }): KitBuild`
- Draws **2** (strand mesh + encrusting-pad mesh, both merged
  world-space — the kelp lesson: jointed hanging growth merges, never
  instances). The answer to every wing audit's "bare walls": strands
  droop from wall anchors under an integrated arc (the W-N2 rise/droop
  discipline); pads are 6-tri encrusting discs flush to the wall. Sway
  rides the standing `aPhase`/`aReach` chunk.
- Paint: strand tips lift, pad centres shade.
- Demo: the demo wall panel wearing one bank. Consumers: all Tier A/B
  wings, smoking gorge walls, verdant vale walls.

### 2.8 `driftDebris` — `kit/DriftDebris.ts`

- Signature: `buildDriftDebris({ seed, palette, area, gate, ground,
  count, shapeSet /* "wrack"|"spars"|"planks"|"relics" | caller
  geometry */ }): KitBuild`
- Draws **1 per shape family**. Wrack curls (10–16 tris), spar lengths,
  plank slabs, and the story-neutral relic family — quern, bowl, tile,
  drum fragment as one merged lathe/prism set whose drum radius and tile
  profile are read from the ruins-terrace wing's constants (the calamity
  handshake: wreckage a player recognises). Never colliders.
- Paint: silvered top / shaded underside; relics take a moss-tint knob.
- Demo: a drift-line of wrack + a relic scatter. Consumers: golden-1,
  calamity-1, wreck-meadow wing, vales.

### 2.9 `farGrassCards` — `kit/FarGrassCards.ts`

- Signature: `buildFarGrassCards({ seed, palette, area, gate, ground,
  count /* 8k–12k regime */, size? }): KitBuild`
- Draws **1**. The 4-tri crossed-card distance tuft tier — the cheap far
  grass any meadow region needs and blue-1's whole grass-budget tuning
  lever. No sway (motion at distance is noise). Budget note: 10,000
  cards = 40k tris — state it wherever consumed.
- Paint: one value step down from the near palette so distance reads
  milky, never darker (the value key's inversion).
- Demo: a 60 m carpet receding into fog beside a near `carpetField`
  band, photographed at grazing angle. Consumers: blue-1, golden-1
  distance dunes, future meadow regions.

### 2.10 `wallStrataPaint` — `kit/KitPaint.ts`

- Signature: `applyWallStrata(geometry, { seed, bands /* {tint,height}[]
  */, blend? /* edge blend m, default 1.3 */, wander? /* fbm edge
  wander */, gate? /* 0 ⇒ bytes untouched */ }): void`
- Not a mesh — the canyonStrata bake generalised behind the existing
  `WingDef.paint` slot, so each wing's wall uplift is a TABLE, not a
  bake rewritten fifteen times. Preserves the strata disciplines:
  violet-leaning bands with red above green; edges wandered by one
  seeded fbm; blends ≥ the grid pitch (Nyquist honesty — no band finer
  than ~2 vertices); skip-when-gate-zero so untouched ground keeps byte
  identity.
- Demo: the demo wall panel, three bands. Consumers: vent-springs +
  every Tier A wing wall, vale walls.

## 3. Package B — life, light & particulate builders

### 3.1 `shoalRunner` — `kit/ShoalRunner.ts`

- Signature: `buildShoalRunner({ seed, route /* {stations:[x,y,z][],
  closed} */, count /* 20–90 */, fish /* {scale, color, emissive?,
  profile? "fusilier"|"tetra"|"fry"} */, phaseSpeed, braid? /* {lateral,
  vertical} */, glint? /* {count, size} additive Points thread */ }):
  KitBuild & { update(timeSec): void }`
- Draws **1** (+1 with glint). The one shoal system for every road:
  extracts the hand-rolled CatmullRom ribbon from `SmokingLife`/
  `CalamityLife`/`VerdantLife` into route DATA. Closed-form position
  from accumulated simulated time; segment-bounds culling;
  `frustumCulled = false` on the fish mesh only. Routes-as-data is what
  makes the connective traveller network possible: two runners sharing
  one seed across a streaming split (wing leg + region leg) agree on the
  timetable by construction. Budget: 48-tri fish × 60 ≈ 3k tris.
- Demo: a 40-fish loop crossing the demo patch with glint. Consumers:
  all seven regions' road shoals + the five province traveller routes.

### 3.2 `percherColony` — `kit/PercherColony.ts`

- Signature: `buildPercherColony({ seed, palette, anchors /* {pos,
  normal?}[] */, perAnchor, body? /* "star"|"fry"|"shrimp"|"blenny" |
  caller geometry */, motion? /* "seated"|"hover"|"dart" */ }):
  KitBuild & { update?(timeSec): void }`
- Draws **1 per body kind**. Small fauna seated on parent transforms:
  perch fish on column break-faces, bark-percher fry, brittle-stars,
  whelk trios at stone feet, moth-fry circling lanterns (hover), ledge
  crabs (dart — short seeded bursts, closed-form). Seated colonies keep
  frustum culling; movers opt out (law 4). 48–130 tris per body.
- Paint: the body's own bowl idiom, one value above its perch so it
  reads at pose range. Demo: seated stars on the demo boulder + one
  hover cluster. Consumers: all seven regions.

### 3.3 `glowColony` — `kit/GlowColony.ts`

- Signature: `buildGlowColony({ seed, tint, anchors, budsPerAnchor,
  glow? /* emissive, cap 0.36 */ }): KitBuild`
- Draws **2** (instanced buds + one halo `Points`). The W-O1 polyp
  discipline baked in as law: the bud tip-gradient shapes the light
  through the `emissivemap_fragment` vertex-colour chunk; halo points
  hang just ABOVE the tips (the depth-test lesson); radial-sprite
  points, never bare squares; halo opacity ≤ 0.28, emissive ≤ 0.36 —
  far under bloom.
- Tint obeys the register rule (MASTER §1.1): warm-rising in Smoulder
  country, cold-settling in Calamity country, free elsewhere. Demo: one
  colony under a dark demo mood. Consumers: verdant-1 maze, verdant-2
  basin/jambs.

### 3.4 `particulateField` — `kit/ParticulateField.ts`

- Signature: `buildParticulateField({ seed, tint, count, mode /*
  "drift"|"column"|"fall"|"swarm" */, volume /* {center, size} */,
  size?, opacity? /* ≤ 0.6 */, bias? /* {dir, speed} */ }):
  KitBuild & { update(timeSec): void }`
- Draws **1**. One additive `Points` system for dust blooms (column),
  marine snow (fall), seeds / ash / pollen / gold motes (drift), vent-
  and ghost-shrimp sparkles (swarm, anchored). Radial sprite mandatory
  (a bare point rasterises as a square). Closed-form motion, wrapped in
  the volume; per-point phase in a colour attribute (the motes' twinkle
  trick — no shader patch). Demo: column + fall side by side.
  Consumers: all seven regions, gate-veils, vales.

### 3.5 `beamAndPool` — `kit/BeamAndPool.ts`

- Signature: `buildBeamAndPool({ seed, tint, ground, beams /* {pos:[x,z],
  top, width, opacity, slant?}[] */, pools /* {pos, radius, opacity}[]
  */ }): KitBuild`
- Draws **2** (merged beam quads + merged pool discs). The shaft+dapple
  pair as one call with all four fade disciplines included (`fog:false`,
  ground fade baked against `ground`, edge-on fade, camera-distance fade
  dead by ~120 m — port the verdant implementation). `slant` is
  first-class (verdant-2's diagonal blades). A pool under every beam by
  default: a beam that brightens nothing is a decal. Opacity caps 0.3;
  a region's named light peaks may exceed ordinary marks only per its
  own plan's §4.
- Demo: vertical beam + slanted blade + pools under the demo mood.
  Consumers: all seven regions, wing light events, gate-veil columns.

### 3.6 `dappleSheet` — `kit/DappleSheet.ts`

- Signature: `buildDappleSheet({ seed, tint /* over-mix warmth — the
  sRGB-on-sand lesson */, ground, area, opacity?, tileMetres? }):
  KitBuild & { update(timeSec): void }`
- Draws **1–2** (two drifting clones of one texture, the bowl idiom).
  The caustic-dapple sheet recolorable per region. The ONE
  asset-touching piece: requests `caustic-dapple.png` through
  `AssetLibrary` (recoloured by tint at load into a memoised copy;
  never dispose the library texture), generated dapple as the standing
  fallback. Follows terrain via the region's `ground` sampler.
- Demo: honey dapple on the demo patch. Consumers: golden-1; explicitly
  NOT pale-1 (its milk forbids focused dapple — upheld).

### 3.7 `gateVeil` — `kit/GateVeil.ts`

- Signature: `buildGateVeil({ seed, doorway /* {pos, facing, width,
  height} */, palette /* 2–3 inks sourced from the REGION behind the
  door */, followFog? /* default true */, particulate? /* {tint, count}
  */, column? /* {tint, opacity} */ }): KitBuild & { update(timeSec) }`
- Draws **≤ 5** (≤ 3 silhouette planes + 1 column + 1 Points). The
  highest-leverage piece (connective §6.1): planes in the region's
  palette on the DistantReef hand-fog idiom — `fog:false`, inks
  self-mixed toward `scene.fog` so any mood/weather reaches them;
  drooped seeded skylines (never a straight top edge); alpha-dissolved
  tops; opacity ≤ 0.2; depth-write off; segmented for honest culling.
  When the region streams in behind it, the veil agrees with the real
  distance rings by construction (same palette source). Composes
  `particulateField` and a `beamAndPool` column internally (B-internal
  imports — legal).
- Demo: a veil in the demo doorway, captured from the wing side in two
  moods. Consumers: the six Tier A doorways first, Tier B later.

### 3.8 `fallStreak` — `kit/FallStreak.ts`

- Signatures: `buildFallStreakTexture({ seed, columns, softness }):
  DataTexture` and `buildFallSheets({ seed, texture, tint, sheets /*
  {pos, width, height, phase}[] */, opacity? /* ≤ 0.2 */ }):
  KitBuild & { update(timeSec): void }`
- Draws **1** (merged sheets) + one shared `DataTexture`. The soft
  fall/streak mark: overlapping tapered soft-edged columns with
  per-column width/phase jitter, alpha-faded tops AND feet, a slow
  vertical scroll — replaces every hard-topped bloom-block quad
  (sandfall wing's falls; golden-1's Hourglass falls; verdant-2's
  Mistfall milk rework consumes the texture builder, its sheet layout
  stays regional).
- Demo: one fall against the demo wall, two captures a second apart (it
  must visibly move). Consumers: sandfall-dunes wing, golden-1,
  verdant-2.

## 4. The demo harness — `scripts/kit-demo.mjs`

Created by Package A beside `KitTypes.ts`; A registers demos in
`kit/KitDemosA.ts`, B in `kit/KitDemosB.ts`; the harness imports both —
no shared file is edited twice. Each demo returns `{ build, camera,
mood? }` staged on a standard scene: a 40 m flat-ish seabed patch with
the sand wash, a demo wall panel, a demo boulder, the standing toon rig,
an optional dark mood for glow pieces. The harness pins render scale 1,
renders 1600×900 to `visual-qa/kit/<piece>_<tag>.png`, and prints the
build's declared draws/tris beside the renderer's `info.render` numbers
so a dishonest budget note is caught at capture time. **A piece with no
demo capture may not be consumed by Phase 3** (MASTER §3).

## 5. The kit test contracts

`tests/kitGround.test.ts` (A) and `tests/kitLife.test.ts` (B),
plain-Node Vitest. Per piece, four mandatory contracts:

1. **Determinism given a seed**: build twice with the same options —
   instance matrices / position buffers / vertex colours byte-equal;
   build with `seed ^ 1` — buffers differ (the stream is really used).
2. **Budget honesty**: the returned `draws` equals the group's actual
   mesh count; `triangles` matches the geometry sum; both inside the
   piece's published budget shape at a reference option set.
3. **No-window safety**: construction succeeds in plain Node (no DOM,
   no asset await needed to build — `dappleSheet` builds its generated
   fallback synchronously).
4. **Containment & bounds**: every instance passes the provided
   `gate`/`area` (proved, not assumed); every `InstancedMesh` bounding
   sphere is instance-aware (centre off-origin for off-origin
   scatters); `dispose()` releases owned resources and leaves the group
   empty and detached (the LifeSystem discipline).

Piece-specific additions: `groundLitter` rake-alignment sampling;
`glowColony` caps (emissive ≤ 0.36, halo ≤ 0.28); `beamAndPool` /
`gateVeil` / `fallStreak` additive discipline (fog:false, depthWrite
off, opacity caps); `shoalRunner` loop continuity (phase 0 = phase 1)
and time-determinism (same `timeSec` ⇒ same matrices on any dt path);
`wallStrataPaint` byte-identity where `gate` returns 0.

Kit tests are the merge gate for Phase 2. Region-side contracts (reroll
fences, clearances, stillness, measured caps) stay in each region's own
test file per its plan — the kit never asserts a region.
