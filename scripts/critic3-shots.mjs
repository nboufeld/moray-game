/**
 * Round-final critic captures: the critic's Round M evidence angles re-taken
 * against the Wave 7 merged tree, the sanctuary at both canonical settles,
 * and three angles nobody has ever framed.
 *
 *   node scripts/critic3-shots.mjs <tag>
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const VIEWPORT = { width: 1600, height: 900 };
const tag = process.argv[2] ?? "critic3";

const SAVE_KEY = "reef-between-seas.save.v1";
const ALL_SPECIES = ["snowflake-moray", "ribbon-moray", "zebra-moray", "dragon-moray", "abyss"];

const POSES = [
  // Re-takes of the Round M critic's own evidence angles.
  { name: "CR1-bowl-overview", pose: { position: [0, 12, 27], yaw: 0, pitch: -0.55, settle: 2 } },
  { name: "CR3-near-stand-up", pose: { position: [-4.5, 1.4, 14.5], yaw: 0.82, pitch: 0.55, settle: 2 } },
  { name: "CR4-canyon-cross", pose: { position: [28.9, -5.0, 29.1], yaw: -2.3609, pitch: -0.14, settle: 2 } },
  { name: "CR5-dish-object", pose: { position: [10, 3, 12], yaw: 0.72, pitch: -0.1, settle: 3 } },
  // The dish camera held at H's nine-second settle — the curiosity-lean case.
  { name: "CR5c-dish-long", pose: { position: [10, 3, 12], yaw: 0.72, pitch: -0.1, settle: 9 } },
  { name: "CR5b-zebra-direct", pose: { position: [10, 2.0, 9], yaw: -0.785, pitch: -0.05, settle: 3 } },
  { name: "NV4-canyon-lookback", pose: { position: [28.9, -4.4, 29.2], yaw: 0.7807, pitch: 0.12, settle: 2 } },
  // NEW, never framed: above the gate saddle, looking down the whole canyon.
  { name: "GV1-gate-overhead", pose: { position: [16, 7, 16], yaw: -2.356, pitch: -0.55, settle: 2 } },
  // NEW, never framed: from the canyon floor looking up at the curtain tops.
  { name: "GV2-canyon-zenith", pose: { position: [27.2, -6.3, 27.6], yaw: -2.36, pitch: 0.95, settle: 2 } },
  // NEW, never framed: kneeling in the spawn corridor by the western dressing bed.
  { name: "GV3-corridor-bed", pose: { position: [1.6, 1.15, 15.5], yaw: 1.25, pitch: -0.18, settle: 2 } },
  // Sanctuary at both canonical settles — the chimera check.
  { name: "SAN4-sanctuary", pose: { settle: 4 }, seedDiscoveries: true, openSanctuary: true },
  { name: "SAN8-sanctuary", pose: { settle: 8 }, seedDiscoveries: true, openSanctuary: true },
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
      if (shot.seedDiscoveries) {
        await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
        await page.waitForFunction(() => "__reef" in window);
        await page.evaluate(
          ([key, discovered]) =>
            window.localStorage.setItem(key, JSON.stringify({ version: 2, discovered, settings: {} })),
          [SAVE_KEY, ALL_SPECIES],
        );
        await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
      } else {
        await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
      }
      await page.waitForFunction(() => "__reef" in window);
      await waitForAssets(page);
      if (shot.openSanctuary) {
        await page.keyboard.press("KeyV");
      }
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
