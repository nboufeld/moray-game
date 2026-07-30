import { CatmullRomCurve3, Vector3 } from "three";
import { describe, it } from "vitest";
import { seabedHeight } from "../src/world/Seabed";
import {
  CALDERA,
  smokingTerrainTarget,
  worldOf,
} from "../src/world/regions/smoking1/SmokingTerrain";

describe("jelly path proximity", () => {
  it("prints distances", () => {
    const kiln = worldOf(CALDERA.u, CALDERA.v);
    const kilnY = seabedHeight(kiln.x, kiln.z);
    const west = worldOf(CALDERA.u - 26, CALDERA.v + 18);
    const east = worldOf(CALDERA.u + 24, CALDERA.v - 12);
    const points: Vector3[] = [
      new Vector3(kiln.x, kilnY + 4, kiln.z),
      new Vector3(kiln.x + 3, kilnY + 12, kiln.z + 2),
      new Vector3(kiln.x - 2, kilnY + 20, kiln.z + 5),
      new Vector3(west.x, kilnY + 26, west.z),
      new Vector3(west.x - 8, kilnY + 18, west.z + 4),
      new Vector3(west.x - 4, kilnY + 8, west.z - 6),
      new Vector3(east.x, kilnY + 5, east.z),
      new Vector3(east.x - 8, kilnY + 2.5, east.z + 4),
    ];
    const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

    const candidates: [string, number, number, number][] = [
      ["current", 498, 46, 2.0],
      ["lift-3.2", 498, 46, 3.2],
      ["u496-v42", 496, 42, 2.0],
      ["u494-v40", 494, 40, 2.2],
      ["u500-v40", 500, 40, 2.0],
      ["u492-v48", 492, 48, 2.2],
      ["u495-v52", 495, 52, 2.0],
    ];
    const at = new Vector3();
    for (const [name, u, v, lift] of candidates) {
      const { x, z } = worldOf(u, v);
      const y = smokingTerrainTarget(x, z) + lift;
      const cam = new Vector3(x, y, z);
      let nearest = Infinity;
      for (let i = 0; i <= 600; i++) {
        path.getPointAt(i / 600, at);
        nearest = Math.min(nearest, at.distanceTo(cam));
      }
      console.log(name, "nearest path distance", nearest.toFixed(2));
    }
  });
});
