/**
 * Close looks at all four morays in their crevices.
 *
 *   node scripts/probe-moray.mjs <tag>
 *
 * Shot C frames the snowflake from six and a half metres, which is where the
 * game asks the player to stand — and far enough that a seam a body's width
 * across is two pixels. The animal is the subject of this game, so it also has
 * to survive being walked up to. Each pose here stands about four metres off a
 * head, on the open side its approach corridor comes from, so the body, the
 * neck join and the dorsal line all read at the size a still frame can judge.
 *
 * The other three are here because they are the ones that can go wrong quietly:
 * their bodies run back into a coral mound, and a silhouette change that clips
 * through one is invisible from the spawn line.
 *
 * Requires a dev server on http://localhost:5173 (override with SHOT_URL).
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const VIEWPORT = { width: 1600, height: 900 };
const NAV_TIMEOUT_MS = 120_000;

const SAVE_KEY = "reef-between-seas.save.v1";
const ALL_SPECIES = ["snowflake-moray", "ribbon-moray", "zebra-moray", "dragon-moray"];

/**
 * Each pose stands in its moray's approach corridor — the ones `Reef` keeps
 * clear of pinnacles and coral — looking straight down it at the head.
 */
const POSES = [
  { name: "M1-snowflake-close", pose: { position: [0, 1.75, 5.2], yaw: 0, pitch: -0.02, settle: 2 } },
  {
    name: "M2-snowflake-quarter",
    pose: { position: [2.8, 2.0, 5.4], yaw: 0.62, pitch: -0.07, settle: 2 },
  },
  {
    name: "M3-zebra-close",
    pose: { position: [8.6, 1.8, 6.0], yaw: -Math.PI / 2, pitch: -0.02, settle: 2 },
  },
  {
    name: "M4-dragon-close",
    pose: { position: [-6, 2.0, -4.6], yaw: 0, pitch: -0.04, settle: 2 },
  },
  {
    name: "M5-ribbon-close",
    pose: { position: [-8.6, 2.0, 6.0], yaw: Math.PI / 2, pitch: -0.02, settle: 2 },
  },
];

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/probe-moray.mjs <tag>");
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

for (const shot of POSES) {
  // Reload per pose so the fixed-step advance always starts from a fresh world,
  // and plant a completed save: two seconds of a centred reticle is a
  // discovery, and the ceremony's plate covers the animal it is celebrating.
  await page.evaluate(
    ([key, discovered]) =>
      window.localStorage.setItem(key, JSON.stringify({ version: 2, discovered, settings: {} })),
    [SAVE_KEY, ALL_SPECIES],
  );
  await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await page.evaluate((pose) => window.__reef.capture(pose), shot.pose);
  await page.waitForTimeout(250);

  const file = path.join(OUT_DIR, `tmp_${shot.name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

await browser.close();
