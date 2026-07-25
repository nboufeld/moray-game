/**
 * Sanctuary-only visual and cost probe.
 *
 *   node scripts/probe-sanctuary.mjs <tag>
 *
 * The canonical shot set holds exactly one sanctuary frame, and the sanctuary's
 * camera sweeps: a composition that works at the moment shot E is taken can
 * still put an animal through the frame edge ten seconds later. This walks the
 * sweep in a few steps and writes each one, then samples frame time with the
 * room open — `measure-frames.mjs` measures the reef, and the sanctuary
 * replaces rather than adds to it, so its cost has to be read on its own.
 *
 * Requires a dev server on http://localhost:5173 (override with SHOT_URL).
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const VIEWPORT = { width: 1600, height: 900 };
/** What `measure-frames.mjs` uses, so the two costs can be read side by side. */
const MEASURE_VIEWPORT = { width: 1280, height: 720 };
const NAV_TIMEOUT_MS = 120_000;
const SAMPLE_MS = 5000;

const SAVE_KEY = "reef-between-seas.save.v1";
const ALL_SPECIES = ["snowflake-moray", "ribbon-moray", "zebra-moray", "dragon-moray"];

/**
 * Seconds into the visit. The first is the canonical shot E moment; the rest
 * are chosen to land on both ends of the camera's swing and its middle, which
 * evenly spaced samples do not — the swing is a sine, so it spends the first
 * half of its period entirely on one side.
 */
const PHASES = [4, 20, 40, 62];

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/probe-sanctuary.mjs <tag>");
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
page.setDefaultTimeout(NAV_TIMEOUT_MS);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

const open = async (page) => {
  await page.evaluate(
    ([key, discovered]) =>
      window.localStorage.setItem(key, JSON.stringify({ version: 2, discovered, settings: {} })),
    [SAVE_KEY, ALL_SPECIES],
  );
  await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);
  await page.keyboard.press("KeyV");
};

// Warm-up load: a cold dev server can re-optimize dependencies and reload the
// page mid-capture, which screenshots as a blank canvas.
await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);

for (const settle of PHASES) {
  await open(page);
  await page.evaluate((pose) => window.__reef.capture(pose), { settle });
  await page.waitForTimeout(250);
  const file = path.join(OUT_DIR, `tmp_S-sanctuary-t${settle}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

// The cost sample runs in its own, smaller window: frame time is dominated by
// fill rate here, so a number taken at the screenshot resolution cannot be
// compared with the reef's. The capture page has to go first — `capture()`
// leaves it re-presenting its held frame at full resolution forever, and two
// scenes drawing at once on a software rasteriser measures neither.
await context.close();
const measureContext = await browser.newContext({
  viewport: MEASURE_VIEWPORT,
  deviceScaleFactor: 1,
});
const measurePage = await measureContext.newPage();
measurePage.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
measurePage.setDefaultTimeout(NAV_TIMEOUT_MS);
await measurePage.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await measurePage.waitForFunction(() => "__reef" in window);
await open(measurePage);
await measurePage.waitForTimeout(1500);
const stats = await measurePage.evaluate(async (sampleMs) => {
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
  return { frames: steady.length, medianMs: at(0.5), p95Ms: at(0.95) };
}, SAMPLE_MS);

console.info(
  `sanctuary ${tag}: ${stats.frames} frames | median ${stats.medianMs.toFixed(1)}ms ` +
    `(${(1000 / stats.medianMs).toFixed(1)} fps) | p95 ${stats.p95Ms.toFixed(1)}ms`,
);

await browser.close();
