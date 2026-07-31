import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBeamAndPool } from "../kit/BeamAndPool";
import type { KitBuild } from "../kit/KitTypes";
import { HOLLOW, SUNFALL, WELLSPRINGS, worldOf } from "./Verdant3Terrain";

/**
 * THE CATHEDRAL SHAFTS — the Canopy Deep's light, all kit consumption
 * (`beamAndPool` carries the four-part additive discipline: fog:false,
 * ground fade, edge-on fade, camera-distance fade dead by ~120 m).
 *
 * The doctrine's rule 4, kept in the province's darkest room: the deep
 * register EARNS its dark by contrast — god-fall shafts drop through
 * every canopy gap, each with its pool of light on the floor, so no
 * vista is desolate dimness. The Sunfall (the Twin Court's great shaft)
 * is the region's named light peak; the Hollow Mesa's oculus beam is
 * the secret's own lamp (licensed in its rest's registration); the
 * Clearwater's shaft is its pool's only motion.
 */

const SEED = SEEDS.regionVerdant3;

export interface Verdant3LightBuild {
  readonly groups: Group[];
  readonly draws: number;
  readonly triangles: number;
}

export function buildVerdant3Light(): Verdant3LightBuild {
  const builds: KitBuild[] = [];

  const at = (u: number, v: number): readonly [number, number] => {
    const { x, z } = worldOf(u, v);
    return [x, z] as const;
  };

  // ─── The god-fall shafts ──────────────────────────────────────────────────
  builds.push(
    buildBeamAndPool({
      seed: SEED ^ 0x11f9,
      tint: 0xd6ecc4,
      ground: seabedHeight,
      beams: [
        // THE SUNFALL — the great shaft of the Twin Court's canopy gap.
        { pos: at(SUNFALL.u, SUNFALL.v), top: 8, width: 5.6, opacity: 0.3, slant: [0.09, 0.05] },
        // The Clearwater's shaft, falling into the Kingpillar's pool.
        {
          pos: at(WELLSPRINGS[2]!.u + 1, WELLSPRINGS[2]!.v - 1),
          top: 6,
          width: 3.6,
          opacity: 0.26,
          slant: [0.07, 0.04],
        },
        // The descent-foot reveal: the first blade the road meets.
        { pos: at(1319, -3), top: 4, width: 3.0, opacity: 0.24, slant: [0.11, 0.03] },
        // The Doorwarden's side-light.
        { pos: at(1339, 50), top: 5, width: 2.8, opacity: 0.22, slant: [0.08, 0.06] },
        // Meadow crossings — a lit event every 30–40 m of open floor.
        { pos: at(1424, 10), top: 4, width: 2.6, opacity: 0.2, slant: [0.1, 0.02] },
        { pos: at(1500, -52), top: 4, width: 2.6, opacity: 0.2, slant: [0.06, 0.08] },
        { pos: at(1444, 66), top: 4, width: 2.4, opacity: 0.18, slant: [0.08, 0.05] },
        // The Fallen Mesa's head, lit where the garden still grows.
        { pos: at(1570, -22), top: 4, width: 2.4, opacity: 0.2, slant: [0.07, 0.05] },
        // The Province's End: the last light before the painted country.
        { pos: at(WORLDS_END_U, WORLDS_END_V), top: 5, width: 3.2, opacity: 0.24, slant: [0.05, 0.09] },
      ],
    }),
  );

  // The Hollow Mesa's oculus beam: its own call so the secret's lamp
  // culls with its room.
  builds.push(
    buildBeamAndPool({
      seed: SEED ^ 0x11fa,
      tint: 0xd8e8c0,
      ground: seabedHeight,
      beams: [
        { pos: at(HOLLOW.u, HOLLOW.v), top: 0, width: 2.4, opacity: 0.28 },
      ],
    }),
  );

  // ─── The walk-line dapple pools ───────────────────────────────────────────
  // Pools alone (no beams): the road's own light events, one per
  // ~30–40 m from the threshold to the meadow walk.
  builds.push(
    buildBeamAndPool({
      seed: SEED ^ 0x11fb,
      tint: 0xd6ecc4,
      ground: seabedHeight,
      beams: [],
      pools: [
        { pos: at(1152, -2), radius: 3.0, opacity: 0.16 },
        { pos: at(1186, 3), radius: 2.8, opacity: 0.18 },
        { pos: at(1218, -3), radius: 2.8, opacity: 0.18 },
        { pos: at(1248, 1), radius: 2.6, opacity: 0.18 },
        { pos: at(1266, -2), radius: 2.6, opacity: 0.18 },
        // The meadow walk between the mesas.
        { pos: at(1372, 22), radius: 3.0, opacity: 0.16 },
        { pos: at(1462, 34), radius: 2.8, opacity: 0.16 },
        { pos: at(1534, 6), radius: 3.0, opacity: 0.16 },
        { pos: at(1560, 52), radius: 2.8, opacity: 0.16 },
      ],
    }),
  );

  let draws = 0;
  let triangles = 0;
  const groups: Group[] = [];
  for (const build of builds) {
    draws += build.draws;
    triangles += build.triangles;
    groups.push(build.group);
  }
  return { groups, draws, triangles };
}

const WORLDS_END_U = 1604;
const WORLDS_END_V = -6;
