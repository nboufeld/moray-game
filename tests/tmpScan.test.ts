import { InstancedMesh, Scene, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import "../src/world/Seabed";
import { BLUE_1 } from "../src/world/regions/blue1/Blue1";

describe("tmp scan", () => {
  it("scans instances", () => {
    const build = BLUE_1.build(new Scene());
    (build.group as Object3D).traverse((node) => {
      if (!(node instanceof InstancedMesh)) {
        return;
      }
      const a = node.instanceMatrix.array as Float32Array;
      let nan = 0;
      let maxScale = 0;
      let minY = Infinity;
      let maxY = -Infinity;
      const weird: string[] = [];
      for (let i = 0; i < node.count; i++) {
        const sx = Math.hypot(a[i * 16]!, a[i * 16 + 1]!, a[i * 16 + 2]!);
        const sy = Math.hypot(a[i * 16 + 4]!, a[i * 16 + 5]!, a[i * 16 + 6]!);
        const y = a[i * 16 + 13]!;
        for (let k = 0; k < 16; k++) {
          if (!Number.isFinite(a[i * 16 + k]!)) {
            nan++;
            break;
          }
        }
        maxScale = Math.max(maxScale, sx, sy);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        if ((sy > 3 || y > 2) && weird.length < 6 && sx > 0.01) {
          weird.push(`i=${i} sy=${sy.toFixed(2)} y=${y.toFixed(1)}`);
        }
      }
      console.info(
        `${node.name}: count=${node.count} nan=${nan} maxScale=${maxScale.toFixed(2)} y=[${minY.toFixed(1)}, ${maxY.toFixed(1)}] weird=${weird.join(" | ")}`,
      );
    });
    expect(true).toBe(true);
  });
});
