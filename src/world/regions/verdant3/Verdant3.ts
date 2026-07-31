import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildVerdant3Canopy } from "./Verdant3Canopy";
import { buildVerdant3Colonies } from "./Verdant3Colonies";
import { buildVerdant3Cover } from "./Verdant3Cover";
import { buildVerdant3Distance } from "./Verdant3Distance";
import { ELDER_SPECIES_ID, buildElderleaf } from "./Verdant3Elder";
import { buildVerdant3Gardens } from "./Verdant3Gardens";
import { buildVerdant3Ground } from "./Verdant3Ground";
import { buildVerdant3Life } from "./Verdant3Life";
import { buildVerdant3Light } from "./Verdant3Light";
import { buildVerdant3Mesas } from "./Verdant3Mesas";
import {
  HOLLOW,
  MESAS,
  SUNFALL,
  VERDANT3_SLOT,
  WELLSPRINGS,
  WORLDS_END,
  channelCenter,
  passGate,
  passHalfWidth,
  spokeOf,
  verdant3Ceiling,
  verdant3TerrainTarget,
  verdant3Weight,
  worldOf,
} from "./Verdant3Terrain";

/**
 * THE CANOPY DEEP — region `verdant-line-3`, province The Verdant Line,
 * the game's first depth-3 region and the province's last chamber.
 *
 * The primeval heart the kelp sea grew from: older than the terraces,
 * deeper than the forest, the green going toward blue-dark and the
 * light arriving in cathedral shafts from a canopy so high and old it
 * reads as sky. The Mesa Pillars — the promise verdant-2's Far Balcony
 * painted — rise 26–38 m to hanging-garden crowns; the Old Canopy
 * closes overhead between them; the Shade Meadows carry deep-register
 * flora and glow colonies under the god-falls; the Wellsprings breathe
 * cool clear pockets at the mesa roots; one mesa is hollow (the
 * secret); one has fallen (the causeway); and the Province's End rise
 * looks into the painted horizon that closes the Verdant Line — the
 * Mother Mesa, the first garden.
 *
 * Pure half in `Verdant3Terrain`; built half in the sibling modules.
 * Every stream is `SEEDS.regionVerdant3` or a `^` substream.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver at weight = 0, so the open
// edges are walled: a rim ring of two-sphere stacks just inside the
// disc's edge (gated open over the pass corridor), and rows along the
// pass tongue's shoulders from the terraces' rim down to the
// Boughfall's foot. The threshold's mouth needs no seal of its own:
// behind it the Emerald Terraces' domain and walls take over — that is
// the handover working.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  const rimR = 198;
  const count = 92;
  const center = worldOf(1460, 0);
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = center.x + Math.cos(theta) * rimR;
    const z = center.z + Math.sin(theta) * rimR;
    const { u, v } = spokeOf(x, z);
    if (passGate(u, v) > 0.3) {
      continue;
    }
    const floor = verdant3TerrainTarget(x, z);
    seals.push(
      { center: new Vector3(x, floor + 1.5, z), radius: 9 },
      { center: new Vector3(x, floor + 8.5, z), radius: 7 },
    );
  }

  // The pass shoulders: rows down both flanks from the terraces' rim to
  // the Boughfall's foot, just inside the tongue's edge.
  for (let u = 1136; u <= 1298; u += 13) {
    const hw = passHalfWidth(u);
    const edge = Math.min(hw - 1.2, Math.max(hw - 4, 20.5));
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * edge);
      const floor = verdant3TerrainTarget(x, z);
      seals.push({ center: new Vector3(x, floor + 2, z), radius: 9 });
      seals.push({ center: new Vector3(x, floor + 9, z), radius: 8 });
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
  // From the terraces' side of the overlap, looking into the deep — the
  // pass pose the handover is judged by. (The terraces' own far
  // distance rings stand between here and the country: from this side
  // they ARE the promise; the gate composition lives past them.)
  { name: "pass-threshold", u: 1142, v: 0, lift: 1.6, atU: 1215, atV: 2, pitch: 0.0 },
  // The Eaves Gate: the jambs and the first over-arching crowns, past
  // the terraces' outermost ring (u ≈ 1228) so no curtain eats it.
  { name: "eaves-gate", u: 1234, v: 0, lift: 2.6, atU: 1254, atV: 0, pitch: -0.12 },
  // On the Boughfall itself, close and steep (the verdant-2 stair
  // lesson: from the flank the treads live beyond the fog's value-merge
  // distance — get ON the road, subject inside 30 m).
  { name: "boughfall", u: 1272, v: -4, lift: 3.6, atU: 1292, atV: 2, pitch: -0.3 },
  // The descent's foot: the Canopy Deep opening in one breath.
  { name: "deep-vista", u: 1322, v: -4, lift: 6.0, atU: 1380, atV: -10, pitch: -0.12 },
  // The Doorwarden: the first pillar portrait, crown and drapes.
  { name: "doorwarden", u: 1352, v: 20, lift: 4.0, atU: 1334, atV: 40, pitch: 0.18 },
  // The Twin Court with the Ray Wheel crossing (settle rides a chunk of
  // the circuit — the wheel's phase is wall-clock, not pose-stable).
  { name: "twin-court", u: 1428, v: -16, lift: 5.0, atU: 1462, atV: -12, pitch: 0.1, settle: 8 },
  // Inside the Sunfall Well's light.
  { name: "sunfall-well", u: 1452, v: -22, lift: 3.0, atU: 1462, atV: -8, pitch: 0.15, settle: 4 },
  // The Wellspring Terrace: bubble columns over the pale pools.
  { name: "wellsprings", u: 1378, v: -24, lift: 2.4, atU: 1392, atV: -16, pitch: -0.06, settle: 4 },
  // The Kingpillar from the meadow, the tallest crown in the province.
  { name: "kingpillar", u: 1500, v: 48, lift: 3.5, atU: 1520, atV: 64, pitch: 0.22 },
  // Inside the Hollow Mesa: the secret's shaft, glow garden and beam.
  { name: "hollow-mesa", u: 1416.5, v: -91, lift: 1.4, atU: HOLLOW.u + 1, atV: HOLLOW.v + 1, pitch: 0.3, settle: 6 },
  // Along the fallen causeway, the swim-under at its chin.
  { name: "fallen-causeway", u: 1536, v: -50, lift: 3.0, atU: 1560, atV: -30, pitch: 0.02 },
  // The Province's End: the painted horizon that closes the line.
  { name: "provinces-end", u: 1600, v: -12, lift: 2.6, atU: 1650, atV: 0, pitch: 0.08 },
  // ── The close set (2–4 m, the owner's judged distance) ──
  { name: "close-shade-floor", u: 1444, v: 30, lift: 1.4, atU: 1448, atV: 34, pitch: -0.5 },
  { name: "close-road-moss", u: 1218, v: 2, lift: 1.3, atU: 1222, atV: 3, pitch: -0.5 },
  { name: "close-garden-skirt", u: 1470, v: 16, lift: 1.4, atU: 1476, atV: 11, pitch: -0.42 },
  { name: "close-wellspring-rim", u: 1382, v: -12, lift: 1.3, atU: 1387, atV: -16, pitch: -0.4 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = verdant3TerrainTarget(x, z) + spec.lift;
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

export const VERDANT_3: RegionDef = {
  slotId: VERDANT3_SLOT.id,
  title: "The Canopy Deep",
  emotion: "the primeval heart — go under the old green, and be small",

  weight: verdant3Weight,
  terrainTarget: verdant3TerrainTarget,
  ceiling: verdant3Ceiling,
  floorClearance: 0.7,

  mood: {
    // The province arc's last note: the terraces' emerald thickened
    // toward blue-dark — red held at the value key's floor, blue up a
    // step so the deep reads OLD rather than merely dim. The density
    // gain closes vistas a step sooner than upstream; the cathedral
    // shafts (doctrine rule 4) carry the light the water gives up.
    fog: { colorScale: [0.62, 0.82, 0.68], densityGain: 0.005, backdropFade: 0.42 },
    light: { sun: 0.18, hemisphere: 0.14, ambient: 0.03 },
  },
  // The country lives 26–42 m down; the threshold sits at dune level,
  // so the mood eases off toward the terraces' brighter green on the
  // climb back out.
  moodSurface: 12,
  moodDescent: 11,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-verdant-line-3";

    const mesas = buildVerdant3Mesas();
    const canopy = buildVerdant3Canopy(mesas.crowns, mesas.fallenHead);
    const gardens = buildVerdant3Gardens(mesas.crowns, mesas.mouth);
    const cover = buildVerdant3Cover();
    const light = buildVerdant3Light();
    const colonies = buildVerdant3Colonies(mesas.crowns);
    const life = buildVerdant3Life();
    const elder = buildElderleaf(mesas.mouth);
    const distance = buildVerdant3Distance();
    const ground = buildVerdant3Ground([...mesas.contacts, ...canopy.contacts]);

    for (const mesh of [
      ...ground,
      ...mesas.meshes,
      ...canopy.meshes,
      ...gardens.groups,
      ...cover.groups,
      ...light.groups,
      ...colonies.groups,
      ...life.meshes,
      elder.mesh,
      ...distance.meshes,
    ]) {
      group.add(mesh);
    }

    const colliders = [...mesas.colliders, ...canopy.colliders, ...buildSeals()];

    return {
      group,
      colliders,
      targets: [elder.target],
      update(dt, ctx): void {
        life.update(dt, ctx.time, ctx.reducedMotion);
        elder.update(ctx.time, ctx.reducedMotion);
        // Kit motion is closed-form off simulated seconds (capture-
        // safe); reduced motion slows the clock the same way the
        // region's own systems do.
        const kitTime = ctx.time * (ctx.reducedMotion ? 0.45 : 1);
        gardens.update(kitTime);
        cover.update(kitTime);
        colonies.update(kitTime);
      },
    };
  },

  codexEntries: [
    {
      id: ELDER_SPECIES_ID,
      commonName: "Elderleaf",
      scientificName: "Phyllodraco primaevus",
      fact:
        "A leaf-dragon older than the canopy it hides beneath. Its vanes are " +
        "true leaves — the first garden the province ever grew, still growing " +
        "on the body that carried it here. Where the Elderleaf rests, the " +
        "kelp remembers being a forest.",
      codexLine: "The province's first garden still swims.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests.
export { buildSeals };
export { HOLLOW, MESAS, SUNFALL, WELLSPRINGS, WORLDS_END, channelCenter };
