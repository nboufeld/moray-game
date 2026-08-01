/**
 * Batch 4 (wings-tier-b): captures the ten Tier B side rooms — one interior
 * pose (the wave-8 canonical stand, values copied from
 * scripts/wave8-wing-shots.mjs so befores/afters stay comparable) and one
 * doorway pose per wing (standing in the bowl just outside the gate,
 * looking down the wing's axis through the doorway — the threshold voice).
 *
 *   node scripts/tierb-wing-shots.mjs <change-tag>
 *
 * Requires a dev server (default http://localhost:5210 — this package's
 * port; override with SHOT_URL). `WING_ONLY=id,id` narrows a run;
 * `POSE_ONLY=interior|door` narrows the pose set.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { blockAssets, noAssets, waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5210";
const OUT_DIR = path.resolve("visual-qa");
const SEED = "seed1";
const QUALITY = "hi";
const VIEWPORT = { width: 1600, height: 900 };
const NAV_TIMEOUT_MS = 240_000;

/**
 * [id, azimuth, interiorY, interiorPitch, settle, across?, r?, doorY?,
 * doorPitch?, doorAcross?] — interior stands verbatim from
 * wave8-wing-shots.mjs (r1 exceptions noted); door stands tuned in r2:
 * the r1 set proved a camera at rim height stares into the rim shoulder,
 * so every door stand now rides above the shoulder looking down into the
 * notch, and slides off-axis where a bowl kelp stand crowds the lens.
 */
const WING_POSES = [
  // r2: across 0.07 — the axis stand is the den arch's own lens.
  ["nursery-shallows", 1.71, 3.4, -0.18, 4, 0.07, 36.5, 2.6, -0.12, 0],
  // r2: pitch −0.32; r3: y −6.5, pitch −0.5 — the wave8 stand looks
  // level and the floor at −10 never enters the frame; the garden's T1
  // is judged on its floor.
  ["lumen-garden", 2.07, -6.5, -0.5, 5, 0, 42, 2.8, -0.3, 0],
  ["wreck-meadow", 2.43, -2.2, -0.12, 4, 0, 36.5, 3.0, -0.2, 0],
  ["moonlit-lagoon", 3.15, -0.6, -0.1, 5, 0, 36.5, 1.4, -0.06, 0],
  ["glass-cove", 3.51, -0.3, -0.22, 4, 0, 36.5, 3.0, -0.2, 0],
  ["current-run", 4.23, -1.2, -0.1, 4, 0, 36.5, 3.2, -0.22, 0],
  ["ruins-terrace", 4.59, -2.2, -0.08, 4, 0, 36.5, 3.6, -0.24, 0],
  ["mangrove-roots", 4.95, 0.6, -0.05, 4, 0, 36.5, 2.6, -0.14, 0],
  ["ice-grotto", 5.67, -1.6, -0.05, 4, 0, 36.5, 3.6, -0.26, 0],
  ["sargassum-sky", 6.03, -0.8, 0.55, 6, 0, 36.5, 3.4, -0.2, 0.04],
];

/** The doorway stand: in the bowl, just outside the gate's shoulder. */
const DOOR_R = 25.5;

function stamp() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/tierb-wing-shots.mjs <change-tag>");
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

const prefix = stamp();

async function shoot(name, pose) {
  await page.evaluate((p) => window.__reef.capture(p), pose);
  await page.waitForTimeout(250);
  const file = path.join(OUT_DIR, `${prefix}_${SEED}_${QUALITY}_${name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

const only = process.env.WING_ONLY?.split(",").map((s) => s.trim());
const poses = only ? WING_POSES.filter(([id]) => only.includes(id)) : WING_POSES;
const poseOnly = process.env.POSE_ONLY;

for (const [
  id,
  azimuth,
  y,
  pitch,
  settle,
  across = 0,
  r = 36.5,
  doorY = 2.6,
  doorPitch = -0.14,
  doorAcross = 0,
] of poses) {
  await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);

  const yaw = Math.atan2(-Math.cos(azimuth), -Math.sin(azimuth));
  if (poseOnly !== "door") {
    const camAzimuth = azimuth + across;
    const x = Math.cos(camAzimuth) * r;
    const z = Math.sin(camAzimuth) * r;
    await shoot(`WING-${id}`, { position: [x, y, z], yaw, pitch, settle });
  }
  if (poseOnly !== "interior") {
    const camAzimuth = azimuth + doorAcross;
    const x = Math.cos(camAzimuth) * DOOR_R;
    const z = Math.sin(camAzimuth) * DOOR_R;
    await shoot(`DOOR-${id}`, { position: [x, doorY, z], yaw, pitch: doorPitch, settle });
  }
}

await browser.close();
