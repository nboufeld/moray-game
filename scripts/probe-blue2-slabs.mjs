/**
 * THROWAWAY node-toggle probe (the Drop Plains' diagnostic idiom): the
 * round-1 weir-ford frame carried hard fog-flat slabs on its horizon
 * that no distance arithmetic could attribute. Loads the region, poses
 * the weir-ford camera, then screenshots with candidate node families
 * hidden one at a time. Deleted once the culprit is named in the
 * ledger.
 *
 *   SHOT_URL=http://localhost:5209 node scripts/probe-blue2-slabs.mjs
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5209";
const OUT = "visual-qa/probe";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
page.setDefaultNavigationTimeout(900_000);
page.setDefaultTimeout(900_000);
await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(() => window.__reef.forceRegion("great-blue-2"));

const pose = await page.evaluate(() => {
  const def = window.__reefRegions.defs.find((d) => d.slotId === "great-blue-2");
  return def.capturePoses.find((p) => p.name === "weir-ford");
});
await page.evaluate((p) => window.__reef.capture(p), pose);
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT}/slabs-all-on.png` });

const families = [
  ["deepsteps-distance", "my step rings"],
  ["blue1-horizon", "blue1 prairie rings"],
  ["blue1-deep-step", "blue1 deep arcs"],
  ["blue1-distance-monoliths", "blue1 monolith cards"],
  ["deepsteps-ground", "my ground sheets"],
];
for (const [prefix, label] of families) {
  const hidden = await page.evaluate((pre) => {
    const scene = window.__reef.scene;
    let count = 0;
    scene.traverse((node) => {
      if (node.name && node.name.startsWith(pre)) {
        node.visible = false;
        count++;
      }
    });
    return count;
  }, prefix);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/slabs-hide-${prefix}.png` });
  console.info(`hid ${hidden} nodes for ${label}`);
  await page.evaluate((pre) => {
    const scene = window.__reef.scene;
    scene.traverse((node) => {
      if (node.name && node.name.startsWith(pre)) {
        node.visible = true;
      }
    });
  }, prefix);
}
await browser.close();
