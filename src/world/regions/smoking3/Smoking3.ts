import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildSmoking3Distance } from "./Smoking3Distance";
import { buildSmoking3Flora } from "./Smoking3Flora";
import { buildSmoking3Ground } from "./Smoking3Ground";
import { buildSmoking3Lanterns } from "./Smoking3Lanterns";
import { buildSmoking3Life } from "./Smoking3Life";
import { buildSmoking3Light } from "./Smoking3Light";
import { WRIGHT_SPECIES_ID, buildSmoking3Wright } from "./Smoking3Wright";
import {
  CRADLE,
  RESTS,
  SMOKING3_SLOT,
  VENT,
  channelCenter,
  passGate,
  passHalfWidth,
  smoking3Ceiling,
  smoking3TerrainTarget,
  smoking3Weight,
  spokeOf,
  wickCenter,
  worldOf,
} from "./Smoking3Terrain";

/**
 * THE LANTERN VIGIL — region `smoking-marches-3`, province The Smoking
 * Marches: the far side of the Forge Combs' Night Door, and the end of
 * the province's road.
 *
 * The Smoulder Fields were the fire's doorstep; the Forge Combs its
 * workshop; this is what the fire was FOR. Past the Night Door the
 * darkness above finally arrives in full — the Marches' true night —
 * and in it the forge's work stands revealed: basalt-glass lantern
 * spires glowing amber from inside, ranked along one last ember seam
 * (the Last Wick) that crosses the whole country — past the Ember
 * Fens' pooled amber, under the Ash Veil's slow pale fall, around the
 * Cradle's kept garden — to the Morning Vent, the great chimney at the
 * world's end where the heat finally reaches the sky and the province
 * makes itself a dawn. The Lampwright, a small ember-carrying octopus,
 * tends the Choir's lanterns on its slow round. Nothing here is
 * hostile; everything is kept, warm and awake in the dark.
 *
 * Pure half in `Smoking3Terrain`; built half in the sibling modules.
 * Every stream is `SEEDS.regionSmoking3` or a `^` substream.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver the moment they reach
// weight = 0, so the domain's open edges are walled with spheres: a
// ring just inside the disc's rim (where the ceiling has already
// closed to 3.4 m), gated over the inbound pass corridor — whose
// flanks the shoulder rows seal, from the Night Door overlap down to
// the stair's foot (the verdant-3 pattern, third use). This is the
// spoke's terminus: the ring holds closed everywhere else.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  // The rim ring, gated only over the pass corridor's own width.
  const rimR = 206;
  const count = 94;
  const center = worldOf(1460, 0);
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = center.x + Math.cos(theta) * rimR;
    const z = center.z + Math.sin(theta) * rimR;
    const { u, v } = spokeOf(x, z);
    if (u < 1260 && Math.abs(v) < 27 && passGate(u, v) > 0.3) {
      continue;
    }
    const floor = smoking3TerrainTarget(x, z);
    seals.push(
      { center: new Vector3(x, floor + 1.5, z), radius: 9 },
      { center: new Vector3(x, floor + 8.5, z), radius: 7 },
    );
  }

  // The pass shoulders: rows down both flanks from the Night Door
  // overlap to the stair's foot, just inside the tongue's edge. The
  // mouth is narrow (the door), so the rows hold at ±11 until the
  // tongue widens.
  for (let u = 1136; u <= 1310; u += 13) {
    const hw = passHalfWidth(u);
    const edge = Math.max(hw - 3, 11);
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * edge);
      const floor = smoking3TerrainTarget(x, z);
      seals.push({ center: new Vector3(x, floor + 2, z), radius: 9 });
      seals.push({ center: new Vector3(x, floor + 8.5, z), radius: 8 });
    }
  }

  return seals;
}

// ─── The capture poses ───────────────────────────────────────────────────────

/** Camera yaw that looks from one point toward another (yaw 0 faces −z). */
function yawToward(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}

interface PoseSpec {
  readonly name: string;
  readonly u: number;
  readonly v: number;
  /** Metres above the composed ground at the pose's own feet. */
  readonly lift: number;
  readonly atU: number;
  readonly atV: number;
  readonly pitch: number;
  readonly settle?: number;
}

const POSE_SPECS: readonly PoseSpec[] = [
  // From the Forge Combs' side of the overlap, under the Night Door,
  // looking into the last country — the pass pose the handover is
  // judged by. (Their rim seal ring still crosses this corridor at
  // u ≈ 1146 — the standing orchestrator flag; captures come through
  // the QA door, the same pre-merge state every depth pass shipped in.)
  { name: "night-threshold", u: 1140, v: 0, lift: 2.0, atU: 1215, atV: 2, pitch: 0.0 },
  // The reveal: standing on the first bench, the night country opening
  // below — the Watch Lantern's light the first thing the fog gives up
  // (R2: the r1 stand at the crest read only the far plain edge-on; the
  // reveal needs the descent IN frame and the lantern as its target).
  { name: "nightfall-stair", u: 1258, v: 1, lift: 3.4, atU: 1330, atV: -6, pitch: -0.04 },
  // The Watch Lantern: the first portrait, from the stair's foot.
  { name: "the-watch", u: 1312, v: 6, lift: 2.2, atU: 1330, atV: -6, pitch: 0.06 },
  // The Last Wick: the road drawn in one thread of heat, lanterns
  // either side, the shoal riding it.
  { name: "wick-road", u: 1348, v: wickCenter(1348) + 1.5, lift: 2.2, atU: 1395, atV: wickCenter(1395), pitch: 0.0 },
  // The Choir: three lanterns around the court the road crosses.
  { name: "the-choir", u: 1402, v: wickCenter(1402) - 2, lift: 2.6, atU: 1428, atV: 8, pitch: 0.08, settle: 4 },
  // The Evensong: the tallest lantern in the province, portrait range.
  { name: "evensong", u: 1470, v: 16, lift: 3.0, atU: 1494, atV: 34, pitch: 0.14 },
  // The Ember Fens: pooled amber, shimmer over the chain (R3: lower and
  // right on the pool cluster — the r2 stand read a flat plain because
  // the pools were 2 m sinks with dim halos; deepened + brightened, and
  // the stand now looks straight down the pool chain).
  { name: "ember-fens", u: 1400, v: -84, lift: 2.4, atU: 1432, atV: -102, pitch: -0.05, settle: 4 },
  // The Spilt Light: the fallen lantern, its glow pooled at the break
  // (R2: backed off — the r1 stand was 11 m from a 13 m shell and read
  // its wall as a torn hoop; the shell itself is also reworked).
  { name: "spilt-light", u: 1496, v: -80, lift: 2.8, atU: 1520, atV: -60, pitch: 0.02 },
  // The Ash Veil: the pale fall over the drifts — the tender register
  // (R2: the r1 stand sat 12 m from the veil-lantern and it filled half
  // the frame; stand past it, reading up the drift country).
  { name: "ash-veil", u: 1460, v: 68, lift: 2.8, atU: 1486, atV: 106, pitch: 0.0, settle: 4 },
  // The Cold Lantern: the rest read from outside its circle — the one
  // the fire never reached, alone in the ash.
  { name: "cold-lantern", u: 1418, v: 114, lift: 3.4, atU: RESTS.coldLantern.u, atV: RESTS.coldLantern.v, pitch: 0.02 },
  // The Cradle: the garden the fire keeps, read from its rim into the
  // bowl (R2: pitch down — the r1 frame skimmed the rim).
  { name: "the-cradle", u: 1532, v: 22, lift: 3.2, atU: CRADLE.u, atV: CRADLE.v + 2, pitch: -0.14, settle: 4 },
  // The Lampwright's court (the Forge Combs' whole determinism war,
  // inherited as law): the keeper ROOSTS by the wick and wakes when
  // the diver arrives, so six seconds of settle put it at EXACTLY
  // u ≈ 1440.8, v ≈ 15.0, ~2.9 m over the floor. The stand keeps the
  // animal's WHOLE round — roost included — at ≥ 14.8 m, past the
  // focus scanner's 14 m maxDistance, so the reticle can rest on it
  // without arming the discovery flash.
  { name: "lampwright", u: 1460, v: 0, lift: 2.8, atU: 1432, atV: 10, pitch: 0.0, settle: 6 },
  // The Morning Vent: the arrival — the road ending at the chimney,
  // the column rising, the dawn beyond.
  { name: "morning-vent", u: 1580, v: wickCenter(1580) + 1, lift: 2.6, atU: VENT.u, atV: VENT.v, pitch: 0.1, settle: 4 },
  // The Ember Dawn: from past the Vent, the province's final horizon —
  // the hills kneeling, the light rising beyond the rim.
  { name: "ember-dawn", u: 1600, v: 14, lift: 5.0, atU: 1660, atV: -14, pitch: 0.06 },
  // The close floors, at the owner's distance (R2: the r1 close-wick
  // buried the lens in the channel's own dark bank — a road-level
  // stand may not stare into the road's cut; read along it instead).
  { name: "close-wick", u: 1420, v: wickCenter(1420) + 2.5, lift: 1.7, atU: 1434, atV: wickCenter(1434), pitch: 0.22 },
  { name: "close-cradle", u: 1556, v: 36, lift: 1.6, atU: 1566, atV: 46, pitch: 0.26 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = smoking3TerrainTarget(x, z) + spec.lift;
    const at = worldOf(spec.atU, spec.atV);
    return {
      name: spec.name,
      position: [x, y, z] as const,
      yaw: yawToward(x, z, at.x, at.z),
      pitch: spec.pitch,
      settle: spec.settle ?? 2.5,
    };
  });
}

// ─── The def ─────────────────────────────────────────────────────────────────

export const SMOKING_3: RegionDef = {
  slotId: SMOKING3_SLOT.id,
  title: "The Lantern Vigil",
  emotion:
    "the far side of the Night Door — what the fire was for: lanterns kept " +
    "against the world's last night, and a morning of its own making",

  weight: smoking3Weight,
  terrainTarget: smoking3TerrainTarget,
  ceiling: smoking3Ceiling,
  floorClearance: 0.7,

  mood: {
    // The province's night: the same warm charcoal-amber family (red
    // held highest, blue taken hardest — the hook multiplies in linear
    // space), a register deeper than the Forge Combs because this is
    // the arc's darkness-above paid off. Density held at the Combs' own
    // gain (their r3 lesson: 0.011 crushed the mid ground; the lanterns
    // must keep a value of their own to ~90 m). R3: backdropFade to
    // 0.8 — the r2 sky was still bright teal DAY, and this region's
    // whole idea is the darkness-above finally arriving; the fade is
    // what darkens the water column overhead, and blue a step lower
    // deepens the fog toward true night without losing the warm rose.
    fog: { colorScale: [3.1, 0.46, 0.42], densityGain: 0.0088, backdropFade: 0.8 },
    light: { sun: 0.13, hemisphere: 0.23, ambient: 0.13 },
  },
  moodSurface: 20,
  moodDescent: 10,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-smoking-marches-3";

    const lanterns = buildSmoking3Lanterns();
    const wright = buildSmoking3Wright();
    const light = buildSmoking3Light();
    const distance = buildSmoking3Distance();
    const flora = buildSmoking3Flora(lanterns);
    const life = buildSmoking3Life(lanterns.perchTops);
    const ground = buildSmoking3Ground(lanterns.contacts);

    for (const child of [
      ...ground,
      ...lanterns.meshes,
      ...wright.meshes,
      ...light.meshes,
      ...light.groups,
      ...distance.meshes,
      ...flora.groups,
      ...life.groups,
    ]) {
      group.add(child);
    }

    const colliders = [...lanterns.colliders, ...buildSeals()];

    return {
      group,
      colliders,
      targets: [wright.target],
      update(_dt, ctx): void {
        wright.update(ctx.time, ctx.reducedMotion, ctx.diverPosition);
        // Kit motion is closed-form off simulated seconds (capture-safe);
        // reduced motion slows the clock the same way the region's own
        // systems do.
        const kitTime = ctx.time * (ctx.reducedMotion ? 0.45 : 1);
        flora.update(kitTime);
        life.update(kitTime);
        light.update(kitTime);
      },
    };
  },

  codexEntries: [
    {
      id: WRIGHT_SPECIES_ID,
      commonName: "Lampwright",
      scientificName: "Lucernopus vigil",
      fact:
        "A small night octopus that tends the lantern spires, carrying a " +
        "living ember cupped in the freckles of its mantle. It rides one " +
        "slow round of the Choir, arms trailing, pausing at each pane of " +
        "glass — where a lantern burns in the Marches' last dark, the " +
        "Lampwright has been, and will come again.",
      codexLine: "The keeper of the vigil, going its rounds.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// region's collision contract and the tests read them back.
export { buildSeals };

// Re-exported so the tests can assert the pass channel against the same
// arithmetic the seals and poses use.
export { channelCenter };
