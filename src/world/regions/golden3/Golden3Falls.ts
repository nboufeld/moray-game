import { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildFallSheets, buildFallStreakTexture, type FallSheetSpec } from "../kit/FallStreak";
import { G3_SEEDS } from "./Golden3Shared";
import { GOLDEN3_SLOT, POURS, combeChannelCenter, combeChannelHalf, combeDrop, worldOf } from "./Golden3Terrain";

/**
 * THE SANDFALLS — the province's opening motif returned at its close:
 * the sandfall-dunes wing poured the desert in; the Sandfall Combe
 * pours it out. One soft golden fall-sheet stands over each of the
 * three pour lips, scrolling slowly (kit `fallStreak` — alpha-faded
 * tops AND feet, never a bloom block), so the descent into the evening
 * country reads as swimming down through falling light.
 */

const SEED = SEEDS.regionGolden3;

export interface FallsBuild {
  readonly group: Group;
  update(timeSec: number): void;
}

export function buildFalls(): FallsBuild {
  const group = new Group();
  group.name = "vesper-sandfalls";

  const texture = buildFallStreakTexture({
    seed: SEED ^ G3_SEEDS.fallTexture,
    columns: 6,
    softness: 0.6,
  });

  // Each sheet faces back up the road (outward normal toward −u), so
  // the descending diver sees the fall square-on.
  const facing = Math.atan2(-Math.cos(GOLDEN3_SLOT.azimuth), -Math.sin(GOLDEN3_SLOT.azimuth));

  const sheets: FallSheetSpec[] = POURS.map((pour, i) => {
    const lipU = pour.u + 2.5;
    const vc = combeChannelCenter(lipU);
    const { x, z } = worldOf(lipU, vc);
    const foot = seabedHeight(x, z);
    const drop = combeDrop(pour.u + 8).level - combeDrop(pour.u - 2).level;
    return {
      pos: [x, foot - 0.4, z] as const,
      width: combeChannelHalf(lipU) * 1.5,
      height: Math.abs(drop) + 4.5,
      phase: i * 0.37,
      facing,
    };
  });

  const falls = buildFallSheets({
    seed: SEED ^ G3_SEEDS.fallSheets,
    texture,
    tint: 0xf2d492,
    sheets,
    opacity: 0.16,
  });
  group.add(falls.group);

  return {
    group,
    update(timeSec: number): void {
      falls.update(timeSec);
    },
  };
}
