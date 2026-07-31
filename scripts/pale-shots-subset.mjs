/**
 * Temp helper (deleted before close): captures a SUBSET of the region's
 * authored poses by name — for retrying poses a crashed browser missed.
 *
 *   SHOT_URL=... node scripts/pale-shots-subset.mjs <tag> <pose> [pose...]
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { blockAssets, noAssets, waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const SLOT = "pale-passage-1";
const VIEWPORT = { width: 1600, height: 900 };

const tag = process.argv[2];
const names = process.argv.slice(3);
if (!tag || names.length === 0) {
  console.error("usage: node scripts/pale-shots-subset.mjs <tag> <pose...>");
  process.exit(1);
}

function stamp() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
// 10 min: the fill batch runs several worktree agents at once and the
// shared GPU/CPU can stretch a single load past the stock 3 minutes.
page.setDefaultNavigationTimeout(600_000);
page.setDefaultTimeout(600_000);
if (noAssets) {
  await blockAssets(page);
}

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
const poses = await page.evaluate((slot) => {
  const def = window.__reefRegions.defs.find((candidate) => candidate.slotId === slot);
  return def.capturePoses;
}, SLOT);

const prefix = stamp();
for (const name of names) {
  const pose = poses.find((candidate) => candidate.name === name);
  if (!pose) {
    console.error(`no pose ${name}`);
    continue;
  }
  await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);
  await page.evaluate((slot) => window.__reef.forceRegion(slot), SLOT);
  await waitForAssets(page);
  await page.evaluate(
    (p) =>
      window.__reef.capture({
        position: [...p.position],
        yaw: p.yaw,
        pitch: p.pitch,
        settle: p.settle,
      }),
    pose,
  );
  await page.waitForTimeout(250);
  const file = path.join(OUT_DIR, `${prefix}_seed1_hi_REGION-${SLOT}-${pose.name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}
await browser.close();
