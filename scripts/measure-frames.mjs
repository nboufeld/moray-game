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

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const label = process.argv[2] ?? "current";
const SAMPLE_MS = 5000;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.waitForTimeout(1000);

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

console.info(
  `${label}: ${stats.frames} frames | median ${stats.medianMs.toFixed(1)}ms ` +
    `(${(1000 / stats.medianMs).toFixed(1)} fps) | p95 ${stats.p95Ms.toFixed(1)}ms`,
);

await browser.close();
