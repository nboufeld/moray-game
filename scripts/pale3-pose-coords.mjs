/**
 * Prints the world-space camera coordinates of named pale-passage-3
 * capture poses so the frame gate (`measure-frames.mjs`, which takes
 * `SHOT_AT=x,y,z,yaw`) can be pointed at authored poses exactly.
 *
 *   SHOT_URL=http://localhost:5211 node scripts/pale3-pose-coords.mjs daybreak blushfields
 */
import { chromium } from "@playwright/test";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const names = process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);
await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);

const poses = await page.evaluate(() => {
  const registry = window.__reefRegions;
  if (!registry) {
    throw new Error("window.__reefRegions missing — is main.ts exposing it?");
  }
  const def = registry.defs.find((candidate) => candidate.slotId === "pale-passage-3");
  if (!def) {
    throw new Error("No registered region for slot pale-passage-3");
  }
  return def.capturePoses;
});

for (const pose of poses) {
  if (names.length > 0 && !names.includes(pose.name)) {
    continue;
  }
  const [x, y, z] = pose.position;
  console.info(`${pose.name}: SHOT_AT=${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)},${pose.yaw.toFixed(4)}`);
}

await browser.close();
