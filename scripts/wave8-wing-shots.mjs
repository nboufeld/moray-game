/**
 * Captures one interior pose per Wave-8 wing, plus the nine-resident
 * sanctuary — the expansion's own showcase set, separate from the canonical
 * sixteen so the diff base stays comparable.
 *
 *   node scripts/wave8-wing-shots.mjs <change-tag>
 *
 * Requires a dev server on http://localhost:5173 (override with SHOT_URL).
 * Every camera stands at r = 36.5 on its wing's axis, a couple of metres
 * over the local carved floor (values derived from the FROZEN carve tables
 * in docs/WAVE8.md), looking outward into the wing.
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

/**
 * [id, azimuth, cameraY, pitch, settle, across?] — y sits ~2.3 m over the
 * r-40 floor; `across` (radians) slides the camera off the axis while the
 * gaze keeps following the wing, for wings whose axis stand crowds the lens.
 */
const WING_POSES = [
  ["kelp-cathedral", 1.35, -1.6, 0.1, 4],
  ["nursery-shallows", 1.71, 3.4, -0.18, 4],
  // Posed past the shelf drop on purpose: the night arrives with depth, the
  // way the canyon's twilight does, and at the gate it has barely begun.
  ["lumen-garden", 2.07, -5.2, -0.06, 5, 0, 42],
  ["wreck-meadow", 2.43, -2.2, -0.12, 4],
  ["vent-springs", 2.79, -3.2, -0.1, 4],
  ["moonlit-lagoon", 3.15, -0.6, -0.1, 5],
  ["glass-cove", 3.51, -0.3, -0.22, 4],
  ["ghost-reef", 3.87, -1.0, -0.14, 4, 0.06],
  ["current-run", 4.23, -1.2, -0.1, 4],
  ["ruins-terrace", 4.59, -2.2, -0.08, 4],
  ["mangrove-roots", 4.95, 0.6, -0.05, 4],
  ["open-blue", 5.31, -3.6, -0.24, 8],
  ["ice-grotto", 5.67, -1.6, -0.05, 4],
  ["sargassum-sky", 6.03, -0.8, 0.55, 6],
  ["sandfall-dunes", 6.39, -1.7, -0.08, 4],
];

const CAMERA_R = 36.5;

const SAVE_KEY = "reef-between-seas.save.v1";
const ALL_MORAYS = [
  "snowflake-moray",
  "ribbon-moray",
  "zebra-moray",
  "dragon-moray",
  "abyss",
  "golden-dwarf-moray",
  "frost-moray",
  "ember-moray",
  "pearl-moray",
];

function stamp() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/wave8-wing-shots.mjs <change-tag>");
  process.exit(1);
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

const prefix = stamp();

async function shoot(name, pose) {
  await page.evaluate((p) => window.__reef.capture(p), pose);
  await page.waitForTimeout(250);
  const file = path.join(OUT_DIR, `${prefix}_${SEED}_${QUALITY}_${name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

// `WING_ONLY=id,id` narrows a run to specific wings (diagnostics/retakes).
const only = process.env.WING_ONLY?.split(",").map((s) => s.trim());
const poses = only ? WING_POSES.filter(([id]) => only.includes(id)) : WING_POSES;

for (const [id, azimuth, y, pitch, settle, across = 0, r = CAMERA_R] of poses) {
  await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);

  const camAzimuth = azimuth + across;
  const x = Math.cos(camAzimuth) * r;
  const z = Math.sin(camAzimuth) * r;
  const yaw = Math.atan2(-Math.cos(azimuth), -Math.sin(azimuth));
  await shoot(`WING-${id}`, { position: [x, y, z], yaw, pitch, settle });
}

if (only) {
  await browser.close();
  process.exit(0);
}

// The nine-resident sanctuary: every moray species discovered.
await page.evaluate(
  ([key, discovered]) =>
    window.localStorage.setItem(key, JSON.stringify({ version: 2, discovered, settings: {} })),
  [SAVE_KEY, ALL_MORAYS],
);
await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);
await page.keyboard.press("KeyV");
await shoot("SANCTUARY-nine", { settle: 6 });

await browser.close();
