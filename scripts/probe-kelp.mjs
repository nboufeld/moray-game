/**
 * What the kelp forest costs, measured rather than guessed.
 *
 *   node scripts/probe-kelp.mjs <tag>
 *
 * `measure-frames.mjs` samples rAF deltas, so it can only report multiples of
 * 16.66ms — which is useless for a package whose whole budget is two of them.
 * This does what the AGENTS note says to do instead: it times `renderFrame()`
 * directly with a one-pixel `readPixels` after it as a barrier (`gl.finish`
 * returns as soon as the commands are queued, not when they are done), at a
 * pinned render scale so every sample is at one resolution.
 *
 * It isolates the layer the way `probe-light.mjs` isolates the additive ones:
 * each pose is timed twice, once with the two kelp meshes hidden, and the
 * difference is what the plant costs. Hiding rather than rebuilding is what
 * makes it an A/B on one page in one session, which is the only kind of frame
 * comparison this machine can be trusted for.
 */
import { chromium } from "@playwright/test";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const tag = process.argv[2] ?? "current";
/** The canonical viewpoints, at `measure-frames.mjs`'s window size. */
const POSES = [
  { name: "A-opening-hero", position: [0, 2, 22], yaw: 0, pitch: 0 },
  { name: "B-mid-depth-traverse", position: [10, 3, 12], yaw: 0.72, pitch: -0.1 },
  { name: "C-close-moray-detection", position: [0, 2, 8], yaw: 0, pitch: -0.09 },
  { name: "G-tidepool-close", position: [7.5, 1.3, 10.5], yaw: 0.5, pitch: -0.25 },
];
const SAMPLES = 24;

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
    async ({ pose, samples }) => {
      const game = window.__reef;
      const renderer = game.renderer;
      renderer.pinRenderScale(1);

      const kelp = game.reef.group.children.find((child) => child.name === "kelp");
      if (!kelp) {
        throw new Error("no kelp group in the reef");
      }

      // Place the diver and let the world settle by whole fixed steps, exactly
      // as `capture()` does, so the pose is the same one the shots hold.
      game.capture({ position: pose.position, yaw: pose.yaw, pitch: pose.pitch, settle: 1 });

      const gl = renderer.renderer.getContext();
      const pixel = new Uint8Array(4);
      const draw = (visible) => {
        kelp.visible = visible;
        const start = performance.now();
        game.renderFrame();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        return performance.now() - start;
      };

      // Interleaved, not one block then the other. This machine's load moves by
      // hundreds of milliseconds a frame while another agent is capturing, and
      // a run that times all the "with" frames before all the "without" ones
      // measures that drift and calls it the kelp — the first pass of this
      // probe reported the plant *saving* five milliseconds on one shot, which
      // is how the drift announced itself.
      draw(true);
      draw(false);

      const on = [];
      const off = [];
      for (let i = 0; i < samples; i++) {
        on.push(draw(true));
        off.push(draw(false));
      }
      kelp.visible = true;

      const median = (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      };
      const withKelp = median(on);
      const without = median(off);
      // Per-pair, which is the estimator that does not care about drift at all.
      const paired = median(on.map((value, i) => value - off[i]));

      let triangles = 0;
      let draws = 0;
      for (const mesh of kelp.children) {
        const index = mesh.geometry?.getIndex?.();
        if (index) {
          triangles += index.count / 3;
          draws++;
        }
      }

      return { withKelp, without, paired, triangles, draws };
    },
    { pose, samples: SAMPLES },
  );

  rows.push({ pose: pose.name, ...result });
}

console.log(`kelp cost — ${tag}`);
console.log("pose                      frame(ms)   without(ms)   medians(ms)   paired(ms)");
for (const row of rows) {
  console.log(
    `${row.pose.padEnd(24)}  ${row.withKelp.toFixed(1).padStart(8)}   ` +
      `${row.without.toFixed(1).padStart(10)}   ` +
      `${(row.withKelp - row.without).toFixed(2).padStart(10)}   ` +
      `${row.paired.toFixed(2).padStart(9)}`,
  );
}
const first = rows[0];
if (first) {
  console.log(`\n${first.draws} draw calls, ${first.triangles} triangles`);
}

await browser.close();
