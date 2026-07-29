/**
 * What W-N5's corridor dressing costs, measured rather than guessed.
 *
 *   node scripts/probe-corridor.mjs <tag>
 *
 * `probe-flora.mjs`'s instrument pointed at the one layer this package adds:
 * the `corridor-dressing` group. Same method for the same reasons —
 * `renderFrame()` timed behind a one-pixel `readPixels` barrier at a pinned
 * render scale, the layer hidden and shown in interleaved pairs so machine
 * drift runs through both arms, and the median of the paired differences is
 * the number. It also counts the group's actual instances and triangles off
 * the live scene, because the budget is quoted in both. Read `uptime` beside
 * anything it prints. (The two appended grass tufts ride the meadow's own
 * mesh and cannot be isolated here; they are ~770 triangles by arithmetic.)
 */
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const tag = process.argv[2] ?? "current";
/** Pin scale: 1 for full resolution, 0.34 for the settled floor. */
const SCALE = Number(process.env.PROBE_SCALE ?? "1");
const POSES = [
  { name: "A-opening-hero", position: [0, 2, 22], yaw: 0, pitch: 0 },
  { name: "G-tidepool-close", position: [7.5, 1.3, 10.5], yaw: 0.5, pitch: -0.25 },
];
const SAMPLES = 16;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

console.log(`corridor dressing cost — ${tag} (pinned scale ${SCALE})`);
console.log(execSync("uptime").toString().trim());

const inventory = await page.evaluate(() => {
  const game = window.__reef;
  let node = null;
  game.reef.group.traverse((child) => {
    if (child.name === "corridor-dressing") {
      node = child;
    }
  });
  if (!node) {
    return "corridor-dressing group not found";
  }
  const rows = [];
  node.traverse((child) => {
    if (child.isInstancedMesh) {
      const index = child.geometry.getIndex();
      const per = (index ? index.count : child.geometry.attributes.position.count) / 3;
      rows.push(`  ${child.name}  n=${child.count}  tris/inst ${Math.round(per)}  total ${Math.round(per * child.count)}`);
    }
  });
  return rows.join("\n");
});
console.log(inventory);

for (const pose of POSES) {
  const paired = await page.evaluate(
    async ({ pose, samples, scale }) => {
      const game = window.__reef;
      const renderer = game.renderer;
      let node = null;
      game.reef.group.traverse((child) => {
        if (child.name === "corridor-dressing") {
          node = child;
        }
      });
      if (!node) {
        return NaN;
      }

      // Pin *after* posing: `capture()` pins the scale to 1 for its own
      // screenshot contract, and a pin made before it is silently undone.
      game.capture({ position: pose.position, yaw: pose.yaw, pitch: pose.pitch, settle: 1 });
      renderer.pinRenderScale(scale);

      const gl = renderer.renderer.getContext();
      const pixel = new Uint8Array(4);
      const draw = () => {
        const start = performance.now();
        game.renderFrame();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        return performance.now() - start;
      };

      node.visible = true;
      draw();
      node.visible = false;
      draw();
      const on = [];
      const off = [];
      for (let i = 0; i < samples; i++) {
        node.visible = true;
        on.push(draw());
        node.visible = false;
        off.push(draw());
      }
      node.visible = true;
      const deltas = on.map((value, i) => value - off[i]).sort((a, b) => a - b);
      return deltas[Math.floor(deltas.length / 2)];
    },
    { pose, samples: SAMPLES, scale: SCALE },
  );
  console.log(`  ${pose.name}: paired ${paired.toFixed(2)}ms`);
}
console.log(execSync("uptime").toString().trim());
await browser.close();
