/**
 * Captures the canonical art-direction shot set.
 *
 * The reef is seeded and `Game.capture()` advances the world by whole fixed
 * steps, so each shot is reproducible frame for frame. That is what makes a
 * before/after comparison meaningful rather than a re-roll of the scene.
 *
 *   node scripts/capture-shots.mjs <change-tag>
 *
 * Requires a dev server on http://localhost:5173 (override with SHOT_URL).
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const SEED = "seed1";
const QUALITY = "hi";
const VIEWPORT = { width: 1600, height: 900 };
/**
 * Playwright's 30s default is not enough headroom here. The `load` event waits
 * for the module script, which builds the whole reef and compiles the post
 * chain against a software rasteriser; on a busy machine that alone runs close
 * to the default, and a capture that dies on the first navigation costs far
 * more than a generous ceiling ever will. Shot *content* does not depend on how
 * fast the machine is — `capture()` advances by whole fixed steps — so waiting
 * longer changes nothing except whether the run finishes.
 */
const NAV_TIMEOUT_MS = 120_000;

const SHOTS = [
  {
    name: "A-opening-hero",
    pose: { position: [0, 2, 22], yaw: 0, pitch: 0, settle: 2 },
  },
  {
    name: "B-mid-depth-traverse",
    pose: { position: [10, 3, 12], yaw: 0.72, pitch: -0.1, settle: 3 },
  },
  {
    name: "C-close-moray-detection",
    pose: { position: [0, 2, 8], yaw: 0, pitch: -0.09, settle: 1 },
  },
  {
    name: "D-ui-overlay-pause",
    pose: { position: [0, 2, 18], yaw: 0, pitch: -0.05, settle: 2 },
    openSettings: true,
  },
  {
    // The closest look the game ever gives at the hero creature.
    name: "E-sanctuary-portrait",
    pose: { settle: 4 },
    seedDiscoveries: true,
    openSanctuary: true,
  },
];

const SAVE_KEY = "reef-between-seas.save.v1";
const ALL_SPECIES = ["snowflake-moray", "ribbon-moray", "zebra-moray", "dragon-moray"];

function stamp() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/capture-shots.mjs <change-tag>");
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
page.setDefaultTimeout(NAV_TIMEOUT_MS);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

// Warm-up load: a cold dev server can re-optimize dependencies and reload the
// page mid-capture, which screenshots as a blank canvas.
await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);

const prefix = stamp();
for (const shot of SHOTS) {
  if (shot.seedDiscoveries) {
    // The sanctuary is empty until morays have been found, so plant a save.
    await page.evaluate(
      ([key, discovered]) =>
        window.localStorage.setItem(key, JSON.stringify({ version: 2, discovered, settings: {} })),
      [SAVE_KEY, ALL_SPECIES],
    );
    await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
  } else {
    // Reload per shot so the fixed-step advance always starts from a fresh world.
    await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  }
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);

  if (shot.openSettings) {
    await page.keyboard.press("KeyO");
  }
  if (shot.openSanctuary) {
    await page.keyboard.press("KeyV");
  }

  await page.evaluate((pose) => window.__reef.capture(pose), shot.pose);
  // Let the held frame reach the compositor before grabbing it.
  await page.waitForTimeout(250);

  const file = path.join(OUT_DIR, `${prefix}_${SEED}_${QUALITY}_${shot.name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

await browser.close();
