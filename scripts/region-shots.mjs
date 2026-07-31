/**
 * R0 — captures a region's own canonical shot set, as authored in its
 * def's `capturePoses`. The region is forced through the streamer's QA
 * door before posing, so a capture never depends on swim distance.
 *
 *   node scripts/region-shots.mjs <slot-id> <change-tag>
 *
 * Requires a dev server (default http://localhost:5173; override with
 * SHOT_URL — region workers in worktrees run their own server on their
 * own port and pass it here). SHOT_NO_ASSETS=1 captures the fallback
 * build, the same contract as the canonical harness.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { blockAssets, noAssets, waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const SEED = "seed1";
const QUALITY = "hi";
const VIEWPORT = { width: 1600, height: 900 };
const NAV_TIMEOUT_MS = 180_000;

const slotId = process.argv[2];
const tag = process.argv[3];
if (!slotId || !tag) {
  console.error("usage: node scripts/region-shots.mjs <slot-id> <change-tag>");
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
page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
page.setDefaultTimeout(NAV_TIMEOUT_MS);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

if (noAssets) {
  console.info("SHOT_NO_ASSETS=1 — capturing the procedural fallback build");
  await blockAssets(page);
}

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);

// The poses live in the def; read them out of the running module graph so
// the script and the game cannot disagree about them.
const poses = await page.evaluate((slot) => {
  const registry = window.__reefRegions;
  if (!registry) {
    throw new Error("window.__reefRegions missing — is main.ts exposing it?");
  }
  const def = registry.defs.find((candidate) => candidate.slotId === slot);
  if (!def) {
    throw new Error(`No registered region for slot ${slot}`);
  }
  return def.capturePoses;
}, slotId);

const prefix = stamp();
for (const pose of poses) {
  await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);
  await page.evaluate((slot) => window.__reef.forceRegion(slot), slotId);
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
  // 900 ms, not 250: a pose that introduces still-uncompiled shader
  // programs can otherwise screenshot mid-compile as a flat-violet frame
  // (the Smoulder fill's documented race).
  await page.waitForTimeout(900);

  const file = path.join(
    OUT_DIR,
    `${prefix}_${SEED}_${QUALITY}_REGION-${slotId}-${pose.name}_${tag}.png`,
  );
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

await browser.close();
