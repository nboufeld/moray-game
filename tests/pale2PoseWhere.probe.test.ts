import "../src/world/Seabed";
import { expect, test } from "vitest";
import { PALE_2 } from "../src/world/regions/pale2/Pale2";

/**
 * Prints the authored capture poses in world coordinates — the
 * `SHOT_AT=x,y,z,yaw` values `scripts/measure-frames.mjs` wants for
 * the headed frame gate. A probe, not an assertion suite.
 */
test("prints the authored poses in world coordinates", () => {
  const lines = PALE_2.capturePoses.map(
    (pose) =>
      `${pose.name}: SHOT_AT=${pose.position.map((n) => n.toFixed(1)).join(",")},${pose.yaw.toFixed(3)}`,
  );
  console.info(lines.join("\n"));
  expect(lines.length).toBeGreaterThan(0);
});
