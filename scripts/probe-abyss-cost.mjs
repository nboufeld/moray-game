/**
 * What the second biome costs, measured the way the kelp probe measures —
 * renderFrame() behind a one-pixel readPixels barrier, interleaved on/off
 * pairs, median of the paired differences — at three poses that mean three
 * different things:
 *
 *   A  the opening hero: in-bowl, facing away from the gate. This is the
 *      pose the +3 ms in-bowl budget is quoted against, and the biome's
 *      whole visible set should be frustum-culled out of it.
 *   I  in-bowl on the gate's doorstep, facing it: the worst in-bowl case,
 *      with the gate stacks, the flora and the den all in frustum.
 *   J  on the canyon floor: the biome's own home turf.
 *
 * What is toggled: every scene-graph node whose world position stands in the
 * canyon wedge past r = 30 — the flora group, the gate stacks, the fifth
 * den's dressing and mound, and the abyss moray itself. What cannot be
 * toggled is the seabed sheet, and deliberately so: the carve moved vertex
 * *positions*, not counts, so its cost is the same sheet's.
 *
 *   node scripts/probe-abyss-cost.mjs <tag>   (PROBE_SCALE=0.34 for the floor)
 */
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const tag = process.argv[2] ?? "current";
const scale = Number(process.env.PROBE_SCALE ?? 1);
const SAMPLES = 24;

const POSES = [
  { name: "A-opening-hero", position: [0, 2, 22], yaw: 0, pitch: 0 },
  { name: "I-abyss-gate", position: [15.8, 2.0, 16.0], yaw: -2.3609, pitch: -0.04 },
  { name: "J-canyon-floor", position: [25.3, -4.0, 28.4], yaw: -2.03, pitch: -0.13 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

const rows = [];
for (const pose of POSES) {
  const result = await page.evaluate(
    async ({ pose, samples, scale }) => {
      const game = window.__reef;
      const renderer = game.renderer;

      // Everything the biome hung in the scene, found by where it stands:
      // the wedge's azimuth is 0.7901 rad and nothing else lives past r=30
      // on it. Collected from both the reef group and the scene root (the
      // moray is Game's, not the reef's).
      const wedge = [];
      const collect = (list) => {
        for (const child of list) {
          const x = child.position.x;
          const z = child.position.z;
          const r = Math.hypot(x, z);
          if (r < 30) {
            continue;
          }
          const away = Math.abs(Math.atan2(z, x) - 0.7901019979873672);
          if (Math.min(away, Math.PI * 2 - away) < 0.35) {
            wedge.push(child);
          }
        }
      };
      collect(game.reef.group.children);
      collect(game.scene.children);
      const flora = game.reef.group.children.find((c) => c.name === "abyss-flora");
      if (flora && !wedge.includes(flora)) {
        wedge.push(flora);
      }

      // Pose after collection, pin after posing (Game.capture pins to 1).
      game.capture({ position: pose.position, yaw: pose.yaw, pitch: pose.pitch, settle: 1 });
      renderer.pinRenderScale(scale);

      const gl = renderer.renderer.getContext();
      const pixel = new Uint8Array(4);
      const draw = (visible) => {
        for (const node of wedge) {
          node.visible = visible;
        }
        const start = performance.now();
        game.renderFrame();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        return performance.now() - start;
      };

      draw(true);
      draw(false);
      const on = [];
      const off = [];
      for (let i = 0; i < samples; i++) {
        on.push(draw(true));
        off.push(draw(false));
      }
      for (const node of wedge) {
        node.visible = true;
      }

      const median = (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      };
      return {
        withBiome: median(on),
        without: median(off),
        paired: median(on.map((value, i) => value - off[i])),
        toggled: wedge.map((node) => node.name || node.type),
      };
    },
    { pose, samples: SAMPLES, scale },
  );
  rows.push({ pose: pose.name, ...result });
}

console.log(`abyss biome cost — ${tag} (scale ${scale})`);
console.log(`toggled: ${rows[0].toggled.join(", ")}`);
console.log("pose                frame(ms)   without(ms)   paired(ms)");
for (const row of rows) {
  console.log(
    `${row.pose.padEnd(18)} ${row.withBiome.toFixed(1).padStart(9)}   ${row.without
      .toFixed(1)
      .padStart(10)}   ${row.paired.toFixed(2).padStart(9)}`,
  );
}
console.log(execSync("uptime").toString().trim());

await browser.close();
