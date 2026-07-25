/**
 * Frame cost at a FIXED internal resolution.
 *
 * measure-frames.mjs lets the adaptive scaler run, which is the right thing for
 * "what does a player get" but useless for "did this change cost more": the
 * scaler quantises to a handful of scales, so two builds with quite different
 * render cost can report the same frame time, or wildly different ones, purely
 * from which scale each settled on.
 *
 * capture() pins the scale to 1 and then re-presents the same frame every
 * vsync, so sampling rAF deltas during a hold measures the render chain alone,
 * at one resolution, with no simulation in the way.
 */
import { chromium } from "@playwright/test";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const label = process.argv[2] ?? "current";
const SAMPLE_MS = 6000;
const POSE = { position: [0, 2, 22], yaw: 0, pitch: 0, settle: 2 };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate((pose) => window.__reef.capture(pose), POSE);
await page.waitForTimeout(1500);

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
  const steady = deltas.slice(2).sort((a, b) => a - b);
  const at = (q) => steady[Math.min(steady.length - 1, Math.floor(steady.length * q))];
  return { frames: steady.length, medianMs: at(0.5), p95Ms: at(0.95) };
}, SAMPLE_MS);

console.info(
  `${label} (pinned scale 1): ${stats.frames} frames | median ${stats.medianMs.toFixed(1)}ms | ` +
    `p95 ${stats.p95Ms.toFixed(1)}ms`,
);

await browser.close();
