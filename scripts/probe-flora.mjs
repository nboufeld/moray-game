/**
 * What W-L9's flora and distance cost, measured rather than guessed.
 *
 *   node scripts/probe-flora.mjs <tag>
 *
 * `probe-kelp.mjs`'s instrument pointed at the four layers this package owns:
 * the kelp forest, the sea-grass meadow, the seaweed accents and the distant
 * silhouette rings. Same method for the same reasons — `renderFrame()` timed
 * behind a one-pixel `readPixels` barrier at a pinned render scale, each layer
 * hidden and shown in interleaved pairs so machine drift runs through both
 * arms, and the median of the paired differences is the number. Read `uptime`
 * beside anything it prints.
 */
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const tag = process.argv[2] ?? "current";
/** Pin scale: 1 to compare against probe-kelp history, 0.34 for the settled floor. */
const SCALE = Number(process.env.PROBE_SCALE ?? "1");
const POSES = [
  { name: "A-opening-hero", position: [0, 2, 22], yaw: 0, pitch: 0 },
  { name: "B-mid-depth-traverse", position: [10, 3, 12], yaw: 0.72, pitch: -0.1 },
  { name: "G-tidepool-close", position: [7.5, 1.3, 10.5], yaw: 0.5, pitch: -0.25 },
];
const LAYERS = ["kelp", "sea-grass", "seaweed", "distant-reef"];
const SAMPLES = 16;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

console.log(`flora cost — ${tag} (pinned scale ${SCALE})`);
console.log(execSync("uptime").toString().trim());

for (const pose of POSES) {
  const result = await page.evaluate(
    async ({ pose, samples, layers, scale }) => {
      const game = window.__reef;
      const renderer = game.renderer;

      const nodes = new Map();
      game.reef.group.traverse((child) => {
        if (layers.includes(child.name)) {
          nodes.set(child.name, child);
        }
      });

      // Pin *after* posing: `capture()` pins the scale to 1 for its own
      // screenshot contract, and a pin made before it is silently undone —
      // which is how this probe's first floor run measured scale 1 twice.
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
      const median = (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      };

      const rows = [];
      for (const name of layers) {
        const node = nodes.get(name);
        if (!node) {
          rows.push({ name, paired: NaN });
          continue;
        }
        // Warm both arms before timing either.
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
        rows.push({ name, paired: median(on.map((value, i) => value - off[i])) });
      }
      return rows;
    },
    { pose, samples: SAMPLES, layers: LAYERS, scale: SCALE },
  );

  console.log(`\n${pose.name}`);
  for (const row of result) {
    console.log(`  ${row.name.padEnd(14)} paired ${row.paired.toFixed(2)} ms`);
  }
}

console.log(`\n${execSync("uptime").toString().trim()}`);
await browser.close();
