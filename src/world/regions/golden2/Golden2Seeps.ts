import { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildMatRings } from "../kit/MatRings";
import { buildParticulateField, type ParticulateFieldBuild } from "../kit/ParticulateField";
import { G2_SEEDS } from "./Golden2Shared";
import { SEEP_POOLS, worldOf } from "./Golden2Terrain";

/**
 * THE SEEP TERRACES' waterworks: travertine rims banding each spring
 * pool (kit `matRings` — the banded-disc builder is kit; this pale
 * gold-to-green mineral palette is this region's own use), and the
 * springs' breath — one bubble column rising off every pool, the
 * gardens' quiet metronome. The flora around them lives in
 * `Golden2Cover`; the fry and stars in `Golden2Life`.
 */

const SEED = SEEDS.regionGolden2;

export interface SeepsBuild {
  readonly group: Group;
  update(timeSec: number): void;
}

export function buildSeeps(): SeepsBuild {
  const group = new Group();
  group.name = "carillon-seeps";
  const updaters: ((timeSec: number) => void)[] = [];

  // The travertine rims: three mineral bands from pale lip to
  // green-gold water's edge, draped to the composed ground.
  const rims = buildMatRings({
    seed: SEED ^ G2_SEEDS.seepRims,
    bands: [
      { color: 0xeadfbe, width: 0.9 },
      { color: 0xd8c896, width: 0.8 },
      { color: 0xa8b06a, width: 0.7 },
    ],
    ground: seabedHeight,
    anchors: SEEP_POOLS.map((pool) => {
      const { x, z } = worldOf(pool.u, pool.v);
      return { pos: [x, z] as [number, number], radius: pool.radius + 1.6 };
    }),
  });
  group.add(rims.group);

  // The springs' breath: a bubble column per pool, closed-form.
  const columns: ParticulateFieldBuild[] = SEEP_POOLS.map((pool, i) => {
    const { x, z } = worldOf(pool.u, pool.v);
    const floor = seabedHeight(x, z);
    return buildParticulateField({
      seed: SEED ^ (G2_SEEDS.seepBubbles + i * 17),
      tint: 0xdef0e6,
      count: 42,
      mode: "column",
      volume: { center: [x, floor + 3.2, z], size: [pool.radius * 0.9, 6, pool.radius * 0.9] },
      size: 0.3,
      opacity: 0.55,
    });
  });
  for (const column of columns) {
    group.add(column.group);
    updaters.push((t) => column.update(t));
  }

  return {
    group,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}
