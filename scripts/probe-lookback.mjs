/**
 * Photographs the canyon's outbound composition (W-O1), the way
 * `probe-abyss.mjs` photographs the descent: the canonical set holds one
 * look-back frame (R) and nothing closer, so a change to the polyps, the
 * gate glow, the shelf stones or the strata needs these angles to be
 * judged. LB-polyp-close stands two metres from the first W-M3 cluster;
 * the two mood poses re-photograph J's camera under pinned weather, which
 * is the check that the curtains and veil re-mix from the composed fog.
 *
 *   node scripts/probe-lookback.mjs <tag>
 *
 * Requires a dev server on http://localhost:5173 (override with SHOT_URL).
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const tag = process.argv[2] ?? "wo1-iter";

const POSES = [
  { name: "LB-look-back", pose: { position: [28.9, -4.4, 29.2], yaw: 0.7807, pitch: 0.12, settle: 2 } },
  // Two metres from the first polyp cluster at (29.27, -4.34, 26.11).
  { name: "LB-polyp-close", pose: { position: [31.5, -3.9, 27.6], yaw: 0.975, pitch: -0.24, settle: 2 } },
  // J's own pose under two moods: the curtains and the veil must re-mix
  // from the weather-scaled, mood-modulated fog (task 3's verification).
  {
    name: "LB-canyon-golden",
    pose: { position: [25.3, -4.0, 28.4], yaw: -2.03, pitch: -0.13, settle: 2 },
    setMood: "golden-afternoon",
  },
  {
    name: "LB-canyon-haze",
    pose: { position: [25.3, -4.0, 28.4], yaw: -2.03, pitch: -0.13, settle: 2 },
    setMood: "plankton-haze",
  },
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
  if (shot.setMood) {
    await page.evaluate((mood) => window.__reef.setMood(mood, 1), shot.setMood);
  }
  await page.evaluate((pose) => window.__reef.capture(pose), shot.pose);
  await page.waitForTimeout(250);
  const file = path.join(OUT_DIR, `tmp_${shot.name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

await browser.close();
