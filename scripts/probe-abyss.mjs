/**
 * Photographs the second biome (W-M3), the way `probe-moray.mjs` photographs
 * the heads: the canonical set holds exactly two canyon frames, and a change
 * to the gate, the carve, the mood or the flora needs more angles than that
 * to be judged. Poses I and J are the canonical pair; the rest walk the
 * descent — the doorway from the bowl, the saddle mid-gate, the shelf, and
 * the den close-up with the twilight behind it.
 *
 *   node scripts/probe-abyss.mjs <tag>
 *
 * Requires a dev server on http://localhost:5173 (override with SHOT_URL).
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const tag = process.argv[2] ?? "current";

// The gate axis (0.7901 rad): cos 0.703773, sin 0.710425. Poses stand on or
// near it; re-derive if the draw band in src/world/Abyss.ts moves.
const POSES = [
  { name: "AB1-gate-doorway", pose: { position: [15.8, 2.0, 16.0], yaw: -2.3609, pitch: -0.04, settle: 2 } },
  { name: "AB2-gate-saddle", pose: { position: [21.1, 1.0, 21.3], yaw: -2.3609, pitch: -0.06, settle: 2 } },
  { name: "AB3-shelf-descent", pose: { position: [25.3, -1.2, 25.6], yaw: -2.3609, pitch: -0.18, settle: 2 } },
  { name: "AB4-canyon-floor", pose: { position: [26.7, -4.0, 27.0], yaw: -2.3609, pitch: -0.14, settle: 2 } },
  { name: "AB5-den-close", pose: { position: [28.9, -5.0, 29.1], yaw: -2.3609, pitch: -0.14, settle: 2 } },
  { name: "AB6-look-back", pose: { position: [28.9, -4.4, 29.2], yaw: 0.7807, pitch: 0.12, settle: 2 } },
];

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

for (const shot of POSES) {
  await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);
  await page.evaluate((pose) => window.__reef.capture(pose), shot.pose);
  await page.waitForTimeout(250);
  const file = path.join(OUT_DIR, `tmp_${shot.name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

await browser.close();
