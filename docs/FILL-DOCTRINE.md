# The Fill Doctrine — density, light, and the journey

Written by the orchestrator after the owner's verdict on the first region
generation: *"incredibly beautiful parts, but mainly very empty… not empty
desolated spaces with tiny spots of wonders, but a coherent journey towards
different spots… it must be beautiful wherever you look, wherever you are,
even on a plain simple road."* This doctrine governs the fill program:
Phase 1 planning, Phase 2 asset creation, Phase 3 region rework. It
supplements docs/REGIONS.md; where they disagree, this wins.

## The verdict, owned

The first generation optimised for landmarks and let the space between
them default to bare ground. Part of that was budget fear (the old
≤120 draw / ≤250k tri caps), part was composing only for authored poses.
Both are corrected here.

## The law: beautiful wherever you look

1. **Three layers in every direction.** From any swimmable point, any
   gaze must contain foreground interest (< 8 m), a middle silhouette
   (8–40 m), and painted or built distance. If a random frame is gradient
   and sand, the region is not done. Test poses are not enough — Phase 3
   verifies with RANDOM-pose capture sweeps, not only authored ones.
2. **The road is a place.** Every route between landmarks is itself
   authored: wayside clusters, flora banks, ground-cover runs, life
   crossings, light events — a reveal or delight every 20–40 m (tightened
   from 30–60), including on "plain simple roads".
3. **The ground is never bare by accident.** Every square metre carries a
   deliberate cover state: carpet flora, rubble drift, ripple field,
   pavement, silt bloom — chosen, not defaulted. Bare sand is allowed
   only as a composed rest between dense passages, never as filler.
4. **Full of light.** These are sunlit dream-waters, not gloom: god-ray
   events, caustic dapple pools, glow accents, bright water moods. Dark
   registers (Lumen Garden, the Wound) earn their darkness by contrast
   and carry their own light sources. No desolate dimness.
5. **Systemic life, short of saturation.** Life is a SYSTEM, not decor:
   drifting particulates everywhere; shoal networks that travel the roads
   between places (life as wayfinding); small fauna on every surface type
   (perchers, burrowers, grazers); midwater drifters; one moving
   centrepiece per region plus satellites. Saturation check: stillness
   and silence remain findable — the game stays tender.

## Density tiers (each zone of each region declares all five)

| tier | what | typical budget shape |
|---|---|---|
| T1 ground cover | carpets, drifts, ripples, pebble runs | huge instance counts, 1–3 draws per kind |
| T2 understory | bushes, mid flora, rubble, props | hundreds of instances, few draws |
| T3 verticals | trees/columns/spires/curtains | dozens, silhouette-graded |
| T4 ambient life | drifters, shoals, small fauna | instanced + shader motion |
| T5 events | light events, landmark satellites, secrets | authored |

## Budgets (Phase 3, per region, measured honestly)

REVISED after the owner's verdict on the first fills ("half-cut grass —
no added value") and a real-hardware measurement (2026-07-30: 59.9 fps
vsync-locked, p95 17.3 ms, render scale 1.00 INSIDE the filled Kelp Sea
at 450k tris — identical to the empty bowl; the old caps were software-
renderer fear, not physics):

- ≤ **260 draw calls**, ≤ **1.35M triangles** attached per region.
- **The real gate is the measurement, not the cap**: every region rework
  ships a headed frame measure at its densest interior pose
  (`SHOT_HEADED=1 SHOT_REGION=<slot> SHOT_AT=x,y,z node
  scripts/measure-frames.mjs`) and must hold median ≤ 16.9 ms at scale
  1.00. A region under the caps that misses the gate fails; a region
  over a cap that holds the gate may ship with the overage recorded.
- **Quality before quantity**: the raised budget is licensed FIRST for
  richer per-instance geometry and paint (authored blade profiles, real
  silhouettes, the sun-through-leaf glow), SECOND for density. Three
  times more 4-triangle wedges is a regression, not a fill.
- Density still comes from INSTANCES, merged batches, and shader motion
  — never one-mesh-per-thing.

## Coherence rules (Phase 1's whole point)

- **One world, many rooms**: shared materials logic (toon ramps, value
  key, violet shadows), shared kit assets recolored per region palette,
  plus 2–4 region-EXCLUSIVE signatures each (the thing you only see
  there).
- **Transitions are gradients**: sub-biome and region borders blend over
  20+ m (density crossfade, palette lerp), never a hard line.
- **Journey grammar**: every region declares its spine road, side loops,
  rest points, and how its life system uses them.

## The kit (Phase 2's deliverable)

`src/world/regions/kit/` — parameterizable instanced builders shared by
all regions (palette/density/scale/seed knobs): ground-cover carpets,
bush and flora banks, rock families, coral drifts, curtain/canopy pieces,
particulate fields, shoal runners, small-fauna colonies, light-event
props; plus Blender hero assets where silhouettes demand sculpting. Every
kit piece ships with: authored vertex paint, a fallback, a per-piece
budget note, and a demo capture. Regions keep their exclusives in their
own directories.
