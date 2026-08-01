import { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildMatRings } from "../kit/MatRings";
import { G3_SEEDS } from "./Golden3Shared";
import { PANS, worldOf } from "./Golden3Terrain";

/**
 * THE MIRROR PANS' salt rims: mineral bands from crusted pale lip to
 * the sky-toned floor edge (kit `matRings` — the banded-disc builder is
 * kit; this salt-glass palette is this region's own use). The pans'
 * floors are painted by the ground bake; their held "reflections" are
 * the licensed sky-pool lights in `Golden3Light`. THE STILL MIRROR's
 * rim is part of its registered licence — the rest's only dressing.
 */

const SEED = SEEDS.regionGolden3;

export interface PansBuild {
  readonly group: Group;
}

export function buildPans(): PansBuild {
  const group = new Group();
  group.name = "vesper-pans";

  const rims = buildMatRings({
    seed: SEED ^ G3_SEEDS.panRings,
    bands: [
      { color: 0xf2e8cc, width: 1.0 },
      { color: 0xdcd0a8, width: 0.9 },
      { color: 0xc2b494, width: 0.7 },
    ],
    ground: seabedHeight,
    anchors: PANS.map((pan) => {
      const { x, z } = worldOf(pan.u, pan.v);
      return { pos: [x, z] as [number, number], radius: pan.radius + 1.8 };
    }),
  });
  group.add(rims.group);

  return { group };
}
