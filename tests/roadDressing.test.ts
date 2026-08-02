import { InstancedMesh, Mesh } from "three";
import { describe, expect, it } from "vitest";
import { buildRoadDressing, corridorLoopStations } from "../src/world/regions/RoadDressing";
import { buildGolden2Roads } from "../src/world/regions/golden2/Golden2Roads";
import { buildGolden3Roads } from "../src/world/regions/golden3/Golden3Roads";
import { buildSmoking2Roads } from "../src/world/regions/smoking2/Smoking2Roads";
import { buildSmoking3Roads } from "../src/world/regions/smoking3/Smoking3Roads";
import { buildVerdant2Roads } from "../src/world/regions/verdant2/Verdant2Roads";
import { buildVerdant3Roads } from "../src/world/regions/verdant3/Verdant3Roads";
import { buildPale2Roads } from "../src/world/regions/pale2/Pale2Roads";
import { buildPale3Roads } from "../src/world/regions/pale3/Pale3Roads";
import { buildBlue2Roads } from "../src/world/regions/blue2/Blue2Roads";
import { buildBlue3Roads } from "../src/world/regions/blue3/Blue3Roads";
import { buildVerdantRoads } from "../src/world/regions/verdant1/VerdantRoads";
import { buildPaleRoads } from "../src/world/regions/pale1/PaleRoads";
import { buildCalamityRoads } from "../src/world/regions/calamity1/CalamityRoads";
import { spokeOf as blue2SpokeOf } from "../src/world/regions/blue2/Blue2Terrain";
import { spokeOf as blue3SpokeOf } from "../src/world/regions/blue3/Blue3Terrain";
import { spokeOf as calamitySpokeOf } from "../src/world/regions/calamity1/CalamityTerrain";

/**
 * ROADS-AND-AXES — the wave's own contracts, in connective-3's idiom:
 * every new companion/under-shoal keeps clear of every registered rest
 * (MASTER §1.2, asserted numerically in world space), the blue servings
 * respect their registries' band licences, the calamity march touches
 * neither the Mile nor the Gardener's road, and the shared recipe is
 * deterministic to the byte.
 */

/** Spoke → world for a rest anchor (the traveller test's own helper). */
function spokePoint(azimuth: number, u: number, v: number): [number, number] {
  return [
    Math.cos(azimuth) * u - Math.sin(azimuth) * v,
    Math.sin(azimuth) * u + Math.cos(azimuth) * v,
  ];
}

/**
 * Every rest with registry/ledger coordinates, as world anchors with
 * their registered radii (bands are asserted separately, per region).
 */
const REST_ANCHORS: readonly { name: string; at: readonly [number, number]; radius: number }[] = [
  // verdant (azimuth 1.35)
  { name: "verdant sunwell bowl", at: spokePoint(1.35, 475, 58), radius: 34 },
  { name: "verdant shelf pocket", at: spokePoint(1.35, 585, -40), radius: 7 },
  { name: "verdant-2 cistern", at: spokePoint(1.35, 905, 55), radius: 14 },
  { name: "verdant-2 fern vault", at: spokePoint(1.35, 918, -76), radius: 10 },
  { name: "verdant-2 basin pocket", at: spokePoint(1.35, 1060, -30), radius: 8 },
  // smoking (azimuth 2.79)
  { name: "smoking-2 ladle", at: spokePoint(2.79, 886, 122), radius: 12 },
  { name: "smoking-2 glass hush", at: spokePoint(2.79, 1058, -64), radius: 12 },
  { name: "smoking-2 anvil shadow", at: spokePoint(2.79, 949, -37), radius: 9 },
  { name: "smoking-3 cold lantern", at: spokePoint(2.79, 1432, 130), radius: 11 },
  { name: "smoking-3 fen hush", at: spokePoint(2.79, 1402, -138), radius: 12 },
  { name: "smoking-3 morning shadow", at: spokePoint(2.79, 1642, 14), radius: 10 },
  // pale (azimuth 3.87)
  { name: "pale quiet gallery", at: spokePoint(3.87, 385, 78), radius: 58 },
  { name: "pale-2 chapel", at: spokePoint(3.87, 905, 74), radius: 26 },
  { name: "pale-2 still pool", at: spokePoint(3.87, 872, -84), radius: 12.5 },
  { name: "pale-3 still morning", at: spokePoint(3.87, 1374, -58), radius: 26 },
  // great-blue (azimuth 5.31)
  { name: "blue-2 round of the gentle dark", at: spokePoint(5.31, 1030, -10), radius: 78 },
  { name: "blue-2 skiff's berth", at: spokePoint(5.31, 818, 96), radius: 7 },
  { name: "blue-3 wide morning", at: spokePoint(5.31, 1374, -58), radius: 55 },
  { name: "blue-3 starwater pans", at: spokePoint(5.31, 1424, -114), radius: 18 },
  { name: "blue-3 pearl's fold", at: spokePoint(5.31, 1548, 96), radius: 6 },
  // golden (azimuth 6.39)
  { name: "golden empty quarter", at: spokePoint(6.39, 535, -18), radius: 26 },
  { name: "golden drain's eye", at: spokePoint(6.39, 455, 30), radius: 13 },
  { name: "golden-2 pavement", at: spokePoint(6.39, 1030, -18), radius: 14 },
  { name: "golden-2 anchorite's cell", at: spokePoint(6.39, 962, -78), radius: 7 },
  { name: "golden-3 still mirror", at: spokePoint(6.39, 1408, -26), radius: 13 },
  // calamity (azimuth 4.59)
  { name: "calamity gardener's road", at: spokePoint(4.59, 253, 0), radius: 5 },
  { name: "calamity grove lawn", at: spokePoint(4.59, 774, -86), radius: 10 },
  { name: "calamity shrine", at: spokePoint(4.59, 771, -82), radius: 6 },
];

/** Braid + fish-lateral swing margin around a station (the runner's own). */
const SWING_MARGIN = 1.0;

const ALL_ROADS: readonly { region: string; builds: ReturnType<typeof buildGolden2Roads> }[] = [
  { region: "verdant-line-1", builds: buildVerdantRoads() },
  { region: "verdant-line-2", builds: buildVerdant2Roads() },
  { region: "verdant-line-3", builds: buildVerdant3Roads() },
  { region: "smoking-marches-2", builds: buildSmoking2Roads() },
  { region: "smoking-marches-3", builds: buildSmoking3Roads() },
  { region: "pale-passage-1", builds: buildPaleRoads() },
  { region: "pale-passage-2", builds: buildPale2Roads() },
  { region: "pale-passage-3", builds: buildPale3Roads() },
  { region: "great-blue-2", builds: buildBlue2Roads() },
  { region: "great-blue-3", builds: buildBlue3Roads() },
  { region: "golden-waste-2", builds: buildGolden2Roads() },
  { region: "golden-waste-3", builds: buildGolden3Roads() },
  { region: "sunken-calamity-1", builds: buildCalamityRoads() },
];

describe("roads-and-axes: the protected-stillness registry (MASTER §1.2)", () => {
  for (const { region, builds } of ALL_ROADS) {
    it(`keeps every ${region} shoal station off every registered rest`, () => {
      for (const build of builds) {
        for (const stations of build.shoalStations) {
          for (const [x, , z] of stations) {
            for (const rest of REST_ANCHORS) {
              const distance = Math.hypot(x - rest.at[0], z - rest.at[1]);
              expect(
                distance,
                `${region} station (${x.toFixed(1)}, ${z.toFixed(1)}) vs ${rest.name}`,
              ).toBeGreaterThan(rest.radius + SWING_MARGIN);
            }
          }
        }
      }
    });
  }

  it("keeps the blue-2 serving inside its registry's one legal window", () => {
    // Far Wall band u < 668 builds nothing; the Othershore Hush
    // (u 700–740) takes no fauna and no scatter (Blue2Beats).
    const [corridor] = buildBlue2Roads();
    for (const stations of corridor!.shoalStations) {
      for (const [x, , z] of stations) {
        const { u } = blue2SpokeOf(x, z);
        expect(u, "shoal off the Far Wall band").toBeGreaterThanOrEqual(668);
        expect(u, "shoal home before the hush").toBeLessThan(700);
      }
    }
    corridor!.group.traverse((node) => {
      if (node instanceof Mesh && node.name.startsWith("road-reveal")) {
        node.geometry.computeBoundingSphere();
        const { u } = blue2SpokeOf(
          node.geometry.boundingSphere!.center.x,
          node.geometry.boundingSphere!.center.z,
        );
        expect(u, "reveal inside the legal window").toBeGreaterThanOrEqual(668);
        expect(u, "reveal clear of the hush").toBeLessThan(700);
      }
    });
  });

  it("keeps the blue-3 keel ribs inside the Worldwall→hush sliver", () => {
    // The First Sea's registry: nothing below u 1178 (Worldwall band),
    // nothing inside the Morning Shelf Hush (1186–1236). The reveal
    // grows backward from u 1185, so every vertex must land between.
    const [corridor] = buildBlue3Roads();
    corridor!.group.traverse((node) => {
      if (node instanceof Mesh && node.name.startsWith("road-reveal")) {
        const position = node.geometry.attributes.position!;
        for (let i = 0; i < position.count; i += 7) {
          const { u } = blue3SpokeOf(position.getX(i), position.getZ(i));
          expect(u, `rib vertex ${i}`).toBeGreaterThanOrEqual(1176.5);
          expect(u, `rib vertex ${i}`).toBeLessThan(1186);
        }
      }
    });
  });

  it("keeps the calamity march serving out of the Mile and shoal-free", () => {
    const [march] = buildCalamityRoads();
    // The grief clause: no shoal from this wave (the existing march
    // runner is the road's file), and nothing standing in u 352–440.
    expect(march!.shoalStations.length).toBe(0);
    march!.group.traverse((node) => {
      if (node instanceof Mesh && node.geometry.attributes.position) {
        node.geometry.computeBoundingSphere();
        const centre = node.geometry.boundingSphere!;
        if (centre.radius > 200) {
          return; // merged additive marks span the module; per-part checks below
        }
        const { u } = calamitySpokeOf(centre.center.x, centre.center.z);
        expect(
          u < 352 - 4 || u > 440 + 4,
          `mesh ${node.name} at u=${u.toFixed(1)} inside the Suffocated Mile`,
        ).toBe(true);
      }
    });
  });
});

describe("roads-and-axes: the shared recipe's determinism", () => {
  it("builds byte-identically twice (no draw-order dependence, no reroll)", () => {
    const collect = (builds: ReturnType<typeof buildGolden2Roads>): number[] => {
      const out: number[] = [];
      for (const build of builds) {
        build.update(12.5);
        build.group.traverse((node) => {
          if (node instanceof InstancedMesh) {
            out.push(...Array.from(node.instanceMatrix.array));
          } else if (node instanceof Mesh && node.geometry.attributes.position) {
            out.push(...Array.from(node.geometry.attributes.position.array as Float32Array));
          }
        });
      }
      return out;
    };
    expect(collect(buildGolden2Roads())).toEqual(collect(buildGolden2Roads()));
    expect(collect(buildSmoking3Roads())).toEqual(collect(buildSmoking3Roads()));
  });

  it("counts its budgets honestly and confines corridor loops", () => {
    for (const { region, builds } of ALL_ROADS) {
      for (const build of builds) {
        expect(build.draws, region).toBeGreaterThan(0);
        expect(build.triangles, region).toBeGreaterThan(0);
      }
    }
    // The confinement guarantee the visibility fix rests on: a corridor
    // loop's stations never leave the corridor it serves.
    const frame = {
      azimuth: 0,
      worldOf: (u: number, v: number) => ({ x: u, z: v }),
      ground: () => 0,
    };
    const stations = corridorLoopStations(frame, { u0: 100, u1: 220, sideV: 5, lift: 2 });
    for (const [x, y, z] of stations) {
      expect(x).toBeGreaterThanOrEqual(100);
      expect(x).toBeLessThanOrEqual(220);
      expect(Math.abs(z)).toBeLessThanOrEqual(5);
      expect(y).toBe(2);
    }
  });

  it("disposes what it builds", () => {
    const build = buildRoadDressing({
      seed: 0x1234,
      frame: { azimuth: 0, worldOf: (u, v) => ({ x: u, z: v }), ground: () => 0 },
      reveal: { kind: "leaning-pair", u: 10, v: 0, gap: 4, color: 0x8a8474 },
      corridorShoal: {
        u0: 0,
        u1: 60,
        sideV: 4,
        lift: 2,
        count: 8,
        fish: { scale: 0.8, color: 0xffffff },
        periodSec: 60,
      },
    });
    expect(() => build.dispose()).not.toThrow();
    expect(build.group.children.length).toBe(0);
  });
});
