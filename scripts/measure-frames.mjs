/**
 * Samples frame times in a headless context so render-cost changes can be
 * compared with a number rather than a feeling.
 *
 *   node scripts/measure-frames.mjs [label]
 *
 * Headless Chromium rasterises on the CPU (SwiftShader), so these numbers are
 * far worse than any real GPU. They are useful as a relative measure between
 * two versions of the render chain, not as a target frame rate.
 */
import { chromium } from "@playwright/test";
import { blockAssets, noAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const label = process.argv[2] ?? "current";
const SAMPLE_MS = 5000;

// `SHOT_HEADED=1` opens a real window and rasterises on the actual GPU —
// the only way to get an absolute frame-rate answer rather than a relative
// SwiftShader comparison. Keep the window visible; occluded windows throttle.
const browser = await chromium.launch({ headless: !process.env.SHOT_HEADED });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// `SHOT_NO_ASSETS=1` measures the same scene built from procedural maps only,
// which is the cheapest same-session baseline there is for what the painted
// ones cost: nothing else about the build changes.
if (noAssets) {
  await blockAssets(page);
}
// The `load` event waits for the module script, which builds the whole reef and
// compiles the post chain against a software rasteriser. On a busy machine that
// alone runs close to Playwright's 30s default, and losing the run to a
// navigation timeout is far more expensive than waiting.
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.waitForTimeout(1000);

// R-budget probes: `SHOT_REGION=<slot-id>` forces a region and
// `SHOT_AT=x,y,z[,yaw]` holds a posed frame there (the capture door pins
// render scale to 1, so `settled scale` reads 1.00 by construction —
// frame times are the answer here).
if (process.env.SHOT_REGION) {
  await page.evaluate((slot) => window.__reef.forceRegion(slot), process.env.SHOT_REGION);
  await page.waitForTimeout(500);
}
if (process.env.SHOT_AT) {
  const [x, y, z, yaw = 0] = process.env.SHOT_AT.split(",").map(Number);
  await page.evaluate(
    (pose) => window.__reef.capture(pose),
    { position: [x, y, z], yaw, pitch: -0.08, settle: 2 },
  );
  await page.waitForTimeout(500);
}

const stats = await page.evaluate(async (sampleMs) => {
  const deltas = [];
  let previous = performance.now();
  const start = previous;

  await new Promise((resolve) => {
    const tick = (now) => {
      deltas.push(now - previous);
      previous = now;
      if (now - start < sampleMs) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });

  // Drop the first frame: it carries shader compilation, not steady state.
  const steady = deltas.slice(1).sort((a, b) => a - b);
  const at = (q) => steady[Math.min(steady.length - 1, Math.floor(steady.length * q))];
  return {
    frames: steady.length,
    medianMs: at(0.5),
    p95Ms: at(0.95),
  };
}, SAMPLE_MS);

// Where the adaptive scaler actually settled during the sample — the half of
// "what does a player get" the frame times alone cannot say (W-L8).
const settledScale = await page.evaluate(() => window.__reef.renderScale ?? null);

console.info(
  `${label}: ${stats.frames} frames | median ${stats.medianMs.toFixed(1)}ms ` +
    `(${(1000 / stats.medianMs).toFixed(1)} fps) | p95 ${stats.p95Ms.toFixed(1)}ms | ` +
    `settled scale ${settledScale === null ? "n/a" : settledScale.toFixed(2)}`,
);

await browser.close();
