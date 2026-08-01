import { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBeamAndPool } from "../kit/BeamAndPool";
import { buildDappleSheet } from "../kit/DappleSheet";
import { buildParticulateField } from "../kit/ParticulateField";
import type { KitArea } from "../kit/KitTypes";
import { SPINE_ROAD } from "./Golden3Beats";
import { G3_SEEDS } from "./Golden3Shared";
import {
  DOOR,
  GARDEN,
  PANS,
  POURS,
  WELL,
  combeChannelCenter,
  worldOf,
} from "./Golden3Terrain";

/**
 * The light of the Vesper Strand — the day's last, spent where the
 * composition needs it (doctrine rule 4). Every beam in this region is
 * SLANTED: the sun is low in its own door, and the light arrives on an
 * angle nothing else in the province uses.
 *
 * - **The gold dapple** (the province's signature, its last hour):
 *   honey caustic sheets over the spine road and the garden, at the
 *   whisper opacities the province earned.
 * - **THE LAST LIGHT** — the region's named light peak, and the
 *   Pilgrim's Threshold's one licensed mark: a great low-slanted beam
 *   falling THROUGH the Sun's Door onto the swept circle, with its
 *   warm pool. The door advertises itself as a column of lit water
 *   long before the arch resolves.
 * - **The pour shafts** — two slanted blades into the Sandfall Combe,
 *   lighting the falls' water.
 * - **THE WELL BLADE** — one thin amber blade falling into the Night
 *   Well: the last light reaching the first dark.
 * - **The sky-pools** — the Mirror Pans' held reflections: one bright
 *   pool per pan lying ON the mineral floor. THE STILL MIRROR's pool
 *   is its licensed light — a touch brighter, because the rest IS the
 *   reflection.
 * - **The garden glints** — a breathing sparkle swarm over the candle
 *   field.
 *
 * All additive marks ride the kit's four-part discipline (fog:false,
 * ground fade, edge-on fade, camera-distance fade); updates are
 * closed-form off simulated time.
 */

const SEED = SEEDS.regionGolden3;

export interface Golden3LightBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

export function buildGolden3Light(): Golden3LightBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  // ── The gold dapple ──────────────────────────────────────────────────────
  const roadDapple: KitArea = (() => {
    const polyline: [number, number][] = [];
    for (const [u, v] of SPINE_ROAD) {
      const { x, z } = worldOf(u, v);
      polyline.push([x, z]);
    }
    return { polyline, width: 18 };
  })();
  const gardenAt = worldOf(GARDEN.u, GARDEN.v);
  for (const [seed, area, opacity] of [
    [G3_SEEDS.dappleRoad, roadDapple, 0.07],
    [G3_SEEDS.dappleGarden, { center: [gardenAt.x, gardenAt.z], radius: 36 }, 0.09],
  ] as const) {
    const dapple = buildDappleSheet({
      seed: SEED ^ seed,
      tint: 0xffc86e,
      ground: seabedHeight,
      area: area as KitArea,
      opacity,
      tileMetres: 12,
    });
    groups.push(dapple.group);
    updaters.push((timeSec) => dapple.update(timeSec));
  }

  // ── THE LAST LIGHT ───────────────────────────────────────────────────────
  // The named peak: the low sun striking through the Sun's Door onto
  // the Pilgrim's Threshold. The strongest slant in the game — this is
  // the only region whose light lies down.
  const threshold = worldOf(DOOR.u - 4, DOOR.v);
  const thresholdY = seabedHeight(threshold.x, threshold.z);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ G3_SEEDS.lastLight,
      tint: 0xffdf9c,
      ground: seabedHeight,
      beams: [
        {
          pos: [threshold.x, threshold.z],
          top: thresholdY + 20,
          width: 6.5,
          opacity: 0.16,
          slant: [-0.2, 0.06],
        },
      ],
      pools: [
        {
          pos: [threshold.x, threshold.z],
          radius: 7,
          opacity: 0.2,
        },
      ],
    }).group,
  );

  // ── The pour shafts ──────────────────────────────────────────────────────
  const pourBeams = POURS.slice(0, 2).map((pour, i) => {
    const { x, z } = worldOf(pour.u + 5, combeChannelCenter(pour.u) + (i === 0 ? 2 : -2));
    return {
      pos: [x, z] as const,
      top: seabedHeight(x, z) + 12 + i * 2,
      width: 2.6 + i * 0.5,
      opacity: 0.12,
      slant: [-0.12, 0.06] as const,
    };
  });
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ G3_SEEDS.roadBeams,
      tint: 0xffd98c,
      ground: seabedHeight,
      beams: pourBeams,
    }).group,
  );

  // ── THE WELL BLADE ───────────────────────────────────────────────────────
  const wellAt = worldOf(WELL.u + 1, WELL.v - 1);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ G3_SEEDS.wellBlade,
      tint: 0xffd287,
      ground: seabedHeight,
      beams: [
        {
          pos: [wellAt.x, wellAt.z],
          top: seabedHeight(wellAt.x, wellAt.z) + 22,
          width: 2.2,
          opacity: 0.13,
          slant: [-0.14, 0.05],
        },
      ],
    }).group,
  );

  // ── The sky-pools ────────────────────────────────────────────────────────
  // The pans' held reflections: light lying ON the ground — the one
  // place in the game the "pool" is the subject and not the beam's
  // consequence. The Still Mirror's is the rest's licensed light.
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ G3_SEEDS.panPools,
      tint: 0xffe8b4,
      ground: seabedHeight,
      beams: [],
      pools: PANS.map((pan) => {
        const { x, z } = worldOf(pan.u, pan.v);
        return {
          pos: [x, z] as const,
          radius: pan.radius * 0.72,
          opacity: pan.rest ? 0.24 : 0.16,
        };
      }),
    }).group,
  );

  // ── The garden glints ────────────────────────────────────────────────────
  const glints = buildParticulateField({
    seed: SEED ^ G3_SEEDS.gardenGlints,
    tint: 0xffedc2,
    count: 90,
    mode: "swarm",
    volume: {
      center: [gardenAt.x, seabedHeight(gardenAt.x, gardenAt.z) + 2.4, gardenAt.z],
      size: [66, 6, 66],
    },
    size: 0.15,
    opacity: 0.5,
  });
  groups.push(glints.group);
  updaters.push((timeSec) => glints.update(timeSec));

  return {
    groups,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}
