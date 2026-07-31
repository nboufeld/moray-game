import type { Group } from "three";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildScreeApron, type ScreeAnchor } from "../kit/ScreeApron";
import { buildSpongeCluster } from "../kit/SpongeCluster";
import { buildWallDrapeBank, type DrapeAnchor } from "../kit/WallDrape";
import type { KitBuild } from "../kit/KitTypes";
import type { MesaCrown } from "./Verdant3Mesas";
import { MESAS, channelCenter, channelHalf, worldOf } from "./Verdant3Terrain";

/**
 * THE HANGING GARDENS of the Canopy Deep — the crowns' spill, all kit
 * consumption:
 *
 * - **Crown drapes** (kit `wallDrapeBank`): every mesa plateau wears a
 *   ring of long garden drapes falling from its crown lip — the
 *   hanging-garden silhouette the whole province promised. The hollow
 *   mesa's mouth wears its own short curtain: the secret is BEHIND the
 *   green.
 * - **Descent drapes**: the Boughfall's walls hang with growth where
 *   the crowns overhead thin the light.
 * - **Sponge clusters** (kit, the province's W-N5 profile): one violet
 *   court at the Twin's foot, one ochre stand by the Doorwarden.
 * - **Scree aprons** (kit): slid rock seated at every pillar's foot —
 *   the mesas grow FROM the ground, not out of a plane.
 *
 * Seeds are fresh `SEEDS.regionVerdant3 ^ 0x2axx/0x2bxx/0x2cxx`
 * substreams; the kit never touches the region's own streams.
 */

const SEED = SEEDS.regionVerdant3;

export interface Verdant3GardensBuild {
  readonly groups: Group[];
  readonly draws: number;
  readonly triangles: number;
  update(timeSec: number): void;
}

export function buildVerdant3Gardens(
  crowns: readonly MesaCrown[],
  mouth: { x: number; z: number; y: number; facing: number },
): Verdant3GardensBuild {
  const random = new Random(SEED ^ 0x2a00);
  const builds: KitBuild[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  // ─── The crown drapes ──────────────────────────────────────────────────────
  // Round 2: anchors dropped below the lip and strands shortened — the
  // r1 lengths let the kit's rise-and-droop arc read as ANTLERS from
  // below; a hanging garden is a fringe skirt, not a crown of spikes.
  for (const [index, crown] of crowns.entries()) {
    const anchors: DrapeAnchor[] = [];
    const count = 9;
    const lipR = crown.topR * 1.3;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + index * 0.7 + random.range(-0.15, 0.15);
      anchors.push({
        pos: [
          crown.x + Math.cos(a) * lipR,
          crown.topY - random.range(2.2, 3.6),
          crown.z + Math.sin(a) * lipR,
        ],
        normal: [Math.cos(a), 0, Math.sin(a)],
      });
    }
    const drapes = buildWallDrapeBank({
      seed: SEED ^ (0x2a01 + index * 7),
      palette: { base: 0x5ca06a, tip: 0xc9b45e, shade: 0x544672 },
      anchors,
      strandsPerAnchor: 6,
      length: random.range(2.6, 3.6),
      swayAmp: 0.5,
    });
    builds.push(drapes);
    updaters.push((t) => drapes.update(t));
  }

  // ─── The hollow mouth's curtain ───────────────────────────────────────────
  // A short dense veil over the doorway: parted by swimming, not by eye.
  {
    const across = mouth.facing + Math.PI / 2;
    const anchors: DrapeAnchor[] = [];
    for (const offset of [-1.6, -0.5, 0.6, 1.7]) {
      anchors.push({
        pos: [
          mouth.x + Math.cos(across) * offset - Math.cos(mouth.facing) * 1.2,
          mouth.y + 4.6,
          mouth.z + Math.sin(across) * offset - Math.sin(mouth.facing) * 1.2,
        ],
        normal: [Math.cos(mouth.facing), 0, Math.sin(mouth.facing)],
      });
    }
    const curtain = buildWallDrapeBank({
      seed: SEED ^ 0x2a41,
      palette: { base: 0x549a64, tip: 0x8cc27a, shade: 0x4a4468 },
      anchors,
      strandsPerAnchor: 7,
      length: 3.4,
      swayAmp: 0.6,
    });
    builds.push(curtain);
    updaters.push((t) => curtain.update(t));
  }

  // ─── The Boughfall's wall drapes ──────────────────────────────────────────
  for (const [index, [u, side]] of ([
    [1272, -1],
    [1294, 1],
  ] as const).entries()) {
    const anchors: DrapeAnchor[] = [];
    for (let i = 0; i < 5; i++) {
      const au = u + i * 3.4 + random.signed(1.2);
      const av = channelCenter(au) + side * (channelHalf(au) + 2.5);
      const { x, z } = worldOf(au, av);
      const inward = worldOf(au, av - side * 4);
      const dx = inward.x - x;
      const dz = inward.z - z;
      const len = Math.hypot(dx, dz) || 1;
      anchors.push({
        pos: [x, seabedHeight(x, z) + random.range(3.4, 5.2), z],
        normal: [dx / len, 0, dz / len],
      });
    }
    const drapes = buildWallDrapeBank({
      seed: SEED ^ (0x2a51 + index),
      palette: { base: 0x5ca06a, tip: 0x9ccb7d, shade: 0x544672 },
      anchors,
      strandsPerAnchor: 5,
      length: 2.3,
      swayAmp: 0.45,
    });
    builds.push(drapes);
    updaters.push((t) => drapes.update(t));
  }

  // ─── The sponge courts ─────────────────────────────────────────────────────
  const twin = MESAS[1]!;
  builds.push(
    buildSpongeCluster({
      seed: SEED ^ 0x2b01,
      palette: { base: 0x8a6a9a, tip: 0xb392c2, shade: 0x544672 },
      ground: seabedHeight,
      anchors: [
        { pos: anchorNear(twin.u, twin.v, 11, 0.6) },
        { pos: anchorNear(twin.u, twin.v, 13, 2.4) },
      ],
      tubesPerAnchor: 4,
      height: 1.25,
    }),
  );
  const door = MESAS[0]!;
  builds.push(
    buildSpongeCluster({
      seed: SEED ^ 0x2b02,
      palette: { base: 0xb08a4a, tip: 0xd8b070, shade: 0x6a5540 },
      ground: seabedHeight,
      anchors: [{ pos: anchorNear(door.u, door.v, 10, 4.2) }],
      tubesPerAnchor: 5,
      height: 1.1,
    }),
  );

  // ─── The scree aprons at the pillar feet ──────────────────────────────────
  const aprons: ScreeAnchor[] = [];
  for (const [index, mesa] of MESAS.entries()) {
    const a = index * 1.7 + 0.4;
    const { x, z } = worldOf(
      mesa.u + Math.cos(a) * (mesa.footR + 1.5),
      mesa.v + Math.sin(a) * (mesa.footR + 1.5),
    );
    aprons.push({ pos: [x, z], facing: Math.atan2(z - worldOf(mesa.u, mesa.v).z, x - worldOf(mesa.u, mesa.v).x), spread: 5.5 });
  }
  builds.push(
    buildScreeApron({
      seed: SEED ^ 0x2c01,
      palette: { base: 0x6f7d68, shade: 0x5a5270 },
      ground: seabedHeight,
      anchors: aprons,
      slabsPerAnchor: 8,
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

  return {
    groups,
    draws,
    triangles,
    update(timeSec: number): void {
      for (const updater of updaters) {
        updater(timeSec);
      }
    },
  };
}

/** A world [x, z] offset from a mesa foot by `reach` at bearing `a`. */
function anchorNear(u: number, v: number, reach: number, a: number): readonly [number, number] {
  const { x, z } = worldOf(u + Math.cos(a) * reach, v + Math.sin(a) * reach);
  return [x, z];
}
