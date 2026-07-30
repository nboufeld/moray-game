/** One-off: recapture a single authored pose. node scripts/__recap-pose.mjs <slot> <pose> <tag> */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const [slotId, poseName, tag] = process.argv.slice(2);

function stamp() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

await mkdir("visual-qa", { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })).newPage();
page.setDefaultNavigationTimeout(180_000);
page.setDefaultTimeout(180_000);

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
const pose = await page.evaluate(
  ([slot, name]) => {
    const def = window.__reefRegions.defs.find((d) => d.slotId === slot);
    return def.capturePoses.find((p) => p.name === name);
  },
  [slotId, poseName],
);
if (!pose) throw new Error(`pose ${poseName} not found on ${slotId}`);
await waitForAssets(page);
await page.evaluate((slot) => window.__reef.forceRegion(slot), slotId);
await waitForAssets(page);
await page.evaluate(
  (p) => window.__reef.capture({ position: [...p.position], yaw: p.yaw, pitch: p.pitch, settle: p.settle }),
  pose,
);
await page.waitForTimeout(2000);
const file = path.join("visual-qa", `${stamp()}_seed1_hi_REGION-${slotId}-${poseName}_${tag}.png`);
await page.screenshot({ path: file });
console.info(`captured ${file}`);
await browser.close();
