import { CatmullRomCurve3, InstancedMesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  TRAVELLER_ROUTES,
  TravellerShoals,
  travellerStations,
} from "../src/world/TravellerShoals";
import { seabedHeight } from "../src/world/Seabed";
import { wingById } from "../src/world/wings/WingRegistry";
import { angleBetween, wedgeHalfAt } from "../src/world/wings/WingGeometry";

/**
 * Connective-3 (MASTER Batch 3, connective plan §5) — the traveller-shoal
 * network's wing legs, held to the contracts they ride on:
 *
 * - **One route per province**, verdant first, species-tinted per MASTER
 *   §1.1's shoal-light row; the calamity file sparse and slow.
 * - **Seeded timetables**: every period drawn from the route's own
 *   substream inside the plan's 3–5 minute band (calamity's melancholy
 *   file may run to ~5¾), pairwise distinct so provinces never sync.
 * - **The shell bound + the protected-stillness registry** (MASTER
 *   §1.2's world row — this lane's own check): every point of every
 *   route stays inside the bowl-and-wing shell, hundreds of metres from
 *   every registered rest. The rests with registry/ledger coordinates
 *   are asserted numerically below; every remaining rest (the Quiet
 *   Gallery, the Under-Blue, the Sunwell bowl, the Mother's Pool, the
 *   smoking slab/erratic/crown-pool set…) lives deeper inside its
 *   region than the anchors listed, so the shell bound covers it a
 *   fortiori.
 * - **Time determinism** (the split-timetable contract): the same
 *   simulated second lands the same matrices on any dt path — two legs
 *   sharing a seed across a streaming boundary can never disagree.
 * - **Corridor sanity**: routes ride the wings' swim corridors — inside
 *   the wedge past the gate, clear of the ground, turned before the
 *   doorway sill (the region legs take over past it).
 */

/** Spoke → world: u along the province azimuth, v lateral CCW. */
function spokePoint(azimuth: number, u: number, v: number): [number, number] {
  return [
    Math.cos(azimuth) * u - Math.sin(azimuth) * v,
    Math.sin(azimuth) * u + Math.cos(azimuth) * v,
  ];
}

/**
 * The registry's rests, as world-space anchor points at their NEAREST
 * documented coordinate (MASTER §1.2 + the region ledgers). Where a rest
 * is a band, the anchor is the near end — the conservative case.
 */
const REST_ANCHORS: readonly { name: string; at: readonly [number, number] }[] = [
  // verdant-line-1 / -2 (azimuth 1.35)
  { name: "verdant narrows u190", at: spokePoint(1.35, 190, 0) },
  { name: "verdant shelf pocket", at: spokePoint(1.35, 585, -40) },
  { name: "verdant-2 cistern bowl", at: spokePoint(1.35, 880, 26) },
  { name: "verdant-2 basin pocket", at: spokePoint(1.35, 1060, -30) },
  // smoking-marches-1 (azimuth 2.79) — Ash Meadows centre band
  { name: "smoking ash meadows u330", at: spokePoint(2.79, 330, 0) },
  // pale-passage-1 (azimuth 3.87) — the Ravine Hush's near end, the
  // registry's nearest-to-origin rest anywhere.
  { name: "pale ravine hush u130", at: spokePoint(3.87, 130, 0) },
  // sunken-calamity-1 (azimuth 4.59)
  { name: "calamity gardener u253", at: spokePoint(4.59, 253, 0) },
  { name: "calamity suffocated mile u352", at: spokePoint(4.59, 352, 0) },
  { name: "calamity grove lawn", at: spokePoint(4.59, 774, -86) },
  { name: "calamity shrine", at: spokePoint(4.59, 771, -82) },
  // great-blue-1 (azimuth 5.31) — the mid-glide hush's near end
  { name: "blue mid-glide u180", at: spokePoint(5.31, 180, 0) },
  // golden-waste-1 (azimuth 6.39)
  { name: "golden drain's eye", at: spokePoint(6.39, 455, 30) },
  { name: "golden empty quarter (disc floor)", at: spokePoint(6.39, 300, 0) },
];

/** The routes' hard shell: braid + fish-lateral margin included. */
const SHELL_R_MAX = 49.4;
const BRAID_MARGIN = 1.0;

function routeCurve(stations: readonly (readonly [number, number, number])[]): CatmullRomCurve3 {
  return new CatmullRomCurve3(
    stations.map(([x, y, z]) => new Vector3(x, y, z)),
    true,
    "centripetal",
    0.5,
  );
}

function fishMatrices(shoals: TravellerShoals, routeIndex: number): number[] {
  const out: number[] = [];
  shoals.routes[routeIndex]!.build.group.traverse((node) => {
    if (node instanceof InstancedMesh) {
      out.push(...Array.from(node.instanceMatrix.array));
    }
  });
  return out;
}

describe("the traveller network's shape", () => {
  it("runs one route per province, verdant first", () => {
    expect(TRAVELLER_ROUTES.map((route) => route.id)).toEqual([
      "verdant",
      "golden",
      "pale",
      "smoking",
      "calamity",
    ]);
    const wings = new Set(TRAVELLER_ROUTES.map((route) => route.wingId));
    expect(wings.size).toBe(TRAVELLER_ROUTES.length);
  });

  it("keeps the calamity file sparse and slow (the melancholy row)", () => {
    const calamity = TRAVELLER_ROUTES.find((route) => route.id === "calamity")!;
    for (const other of TRAVELLER_ROUTES) {
      if (other.id === "calamity") {
        continue;
      }
      expect(calamity.count, "fewer").toBeLessThan(other.count * 0.5);
      expect(calamity.period[0], "slower").toBeGreaterThan(other.period[1]);
    }
    expect(calamity.glint, "no sparkle on the grey file").toBeUndefined();
  });

  it("draws every timetable inside the 3–5(¾) minute band, pairwise distinct", () => {
    const shoals = new TravellerShoals();
    const periods = shoals.routes.map((route) => 1 / route.phaseSpeed);
    for (const period of periods) {
      expect(period).toBeGreaterThanOrEqual(180);
      expect(period).toBeLessThanOrEqual(345);
    }
    for (let a = 0; a < periods.length; a++) {
      for (let b = a + 1; b < periods.length; b++) {
        expect(Math.abs(periods[a]! - periods[b]!), "provinces never sync").toBeGreaterThan(1);
      }
    }
  });
});

describe("the shell bound and the protected-stillness registry (§1.2 world row)", () => {
  for (const spec of TRAVELLER_ROUTES) {
    it(`keeps the ${spec.id} route inside the bowl-and-wing shell, off every rest`, () => {
      const def = wingById(spec.wingId);
      const curve = routeCurve(travellerStations(def, spec.lift));
      const at = new Vector3();
      for (let i = 0; i < 512; i++) {
        curve.getPointAt(i / 512, at);
        const r = Math.hypot(at.x, at.z);
        expect(r + BRAID_MARGIN, `sample ${i} shell`).toBeLessThan(SHELL_R_MAX);
        // The wing stretch rides the swim corridor: inside the wedge with
        // braid margin, clear of the carved ground.
        if (r > 31.5) {
          const away = angleBetween(Math.atan2(at.z, at.x), def.azimuth);
          expect(away + BRAID_MARGIN / r, `sample ${i} wedge`).toBeLessThan(
            wedgeHalfAt(def, r) + 0.002,
          );
        }
        expect(
          at.y - seabedHeight(at.x, at.z),
          `sample ${i} ground clearance at r=${r.toFixed(1)}`,
        ).toBeGreaterThan(1.1);
        for (const rest of REST_ANCHORS) {
          const distance = Math.hypot(at.x - rest.at[0], at.z - rest.at[1]);
          expect(distance, `sample ${i} vs ${rest.name}`).toBeGreaterThan(60);
        }
      }
    });
  }

  it("turns every route before the doorway sill — the region leg's country", () => {
    for (const spec of TRAVELLER_ROUTES) {
      const def = wingById(spec.wingId);
      for (const [x, , z] of travellerStations(def, spec.lift)) {
        expect(Math.hypot(x, z), spec.id).toBeLessThanOrEqual(47.2 + 1e-9);
      }
    }
  });
});

describe("determinism and the split-timetable contract", () => {
  it("builds byte-identically twice and poses time-deterministically", () => {
    const first = new TravellerShoals();
    const second = new TravellerShoals();
    // Different dt paths to the same simulated second land the same pose.
    first.update(0.4, false);
    first.update(0.8, false);
    second.update(1.2, false);
    for (let i = 0; i < TRAVELLER_ROUTES.length; i++) {
      expect(fishMatrices(second, i), TRAVELLER_ROUTES[i]!.id).toEqual(fishMatrices(first, i));
    }
  });

  it("gives every province its own ribbon (the streams are per-route)", () => {
    const shoals = new TravellerShoals();
    expect(fishMatrices(shoals, 0)).not.toEqual(fishMatrices(shoals, 1));
  });

  it("slows to the becalmed rate under reduced motion without throwing", () => {
    const shoals = new TravellerShoals();
    expect(() => {
      shoals.update(0.016, false);
      shoals.update(0.016, true);
      shoals.update(1.5, false);
    }).not.toThrow();
  });
});
