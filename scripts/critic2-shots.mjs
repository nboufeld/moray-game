/**
 * Round M critic re-verdict captures: the Round L critic's own evidence angles
 * re-taken against the Wave 6 merged tree, plus angles nobody has framed.
 *
 *   node scripts/critic2-shots.mjs <tag>
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const VIEWPORT = { width: 1600, height: 900 };
const tag = process.argv[2] ?? "critic2";

const POSES = [
  // CR1: the bowl overview that scored the composition last round.
  { name: "CR1-bowl-overview", pose: { position: [0, 12, 27], yaw: 0, pitch: -0.55, settle: 2 } },
  // CR3 intent, original spot: under the near stand, looking up through it.
  { name: "CR3-near-stand-up", pose: { position: [-4.5, 1.4, 14.5], yaw: 0.82, pitch: 0.55, settle: 2 } },
  // CR4: the canyon cross-look from the den doorstep (probe-abyss AB5).
  { name: "CR4-canyon-cross", pose: { position: [28.9, -5.0, 29.1], yaw: -2.3609, pitch: -0.14, settle: 2 } },
  // CR5: the "dish" — B's camera, then a direct look at the zebra den itself.
  { name: "CR5-dish-object", pose: { position: [10, 3, 12], yaw: 0.72, pitch: -0.1, settle: 3 } },
  { name: "CR5b-zebra-direct", pose: { position: [10, 2.0, 9], yaw: -0.785, pitch: -0.05, settle: 3 } },
  // NEW: canyon floor under golden afternoon — W-N1's light vs W-N4's weather.
  {
    name: "NV1-canyon-golden",
    pose: { position: [25.3, -4.0, 28.4], yaw: -2.03, pitch: -0.13, settle: 2 },
    setMood: "golden-afternoon",
  },
  // NEW: overcast at ground level — do the extinguished dapples read down here?
  {
    name: "NV2-overcast-ground",
    pose: { position: [7.5, 1.3, 10.5], yaw: 0.5, pitch: -0.25, settle: 3 },
    setMood: "overcast-drift",
  },
  // NEW: never-framed azimuth — from the deep-south terrace looking north
  // across the whole bowl toward the spawn corridor.
  { name: "NV3-south-look-north", pose: { position: [4, 3.5, -14], yaw: 3.1, pitch: -0.05, settle: 2 } },
  // NEW: the canyon look-back — standing at the den looking back up the shelf
  // at the gate (probe-abyss AB6), the view a returning diver gets.
  { name: "NV4-canyon-lookback", pose: { position: [28.9, -4.4, 29.2], yaw: 0.7807, pitch: 0.12, settle: 2 } },
];

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

for (const shot of POSES) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
      await page.waitForFunction(() => "__reef" in window);
      await waitForAssets(page);
      if (shot.setMood) {
        await page.evaluate((mood) => window.__reef.setMood(mood, 1), shot.setMood);
      }
      await page.evaluate((pose) => window.__reef.capture(pose), shot.pose);
      await page.waitForTimeout(250);
      const file = path.join(OUT_DIR, `tmp_${shot.name}_${tag}.png`);
      await page.screenshot({ path: file });
      console.info(`captured ${path.relative(process.cwd(), file)}`);
      break;
    } catch (error) {
      if (attempt === 1) throw error;
      console.warn(`  retrying ${shot.name}: ${error.message.split("\n")[0]}`);
    }
  }
}

await browser.close();
