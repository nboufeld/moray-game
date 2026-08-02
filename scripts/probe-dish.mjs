/**
 * W-N5's iteration instrument for the critic's "white-rimmed maroon dish".
 *
 *   node scripts/probe-dish.mjs <tag>
 *
 * The dish crops into shot B's right edge and the critic attributed it to the
 * tube sponge; hiding the garden's buckets, the seaweed and the ground fauna
 * one at a time left it standing, so this sweeps every top-level scene node
 * instead — pose shot B once, hide one node per frame (the capture's held
 * frame re-presents on the next rAF), and screenshot the corner. Whichever
 * toggle removes the dish names the owner.
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
const POSE = { position: [10, 3, 12], yaw: 0.72, pitch: -0.1, settle: 3 };

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/probe-dish.mjs <tag>");
  process.exit(1);
}
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT });
page.setDefaultNavigationTimeout(120_000);
await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

const names = await page.evaluate((pose) => {
  const game = window.__reef;
  game.capture(pose);
  return game.scene.children.map(
    (child, i) => `${i}: ${child.name || child.type}${child.visible ? "" : " (hidden)"}`,
  );
}, POSE);
console.info(names.join("\n"));

const count = names.length;
for (let i = 0; i < count; i++) {
  await page.evaluate((index) => {
    const game = window.__reef;
    game.scene.children.forEach((child, j) => {
      child.visible = j !== index;
    });
  }, i);
  await page.waitForTimeout(200);
  const file = path.join(OUT_DIR, `tmp_dish-node${i}_${tag}.png`);
  await page.screenshot({ path: file, clip: { x: 1280, y: 400, width: 320, height: 320 } });
}
console.info(`captured ${count} corner crops as tmp_dish-node*_${tag}.png`);
await browser.close();
