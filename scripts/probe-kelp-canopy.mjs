/**
 * W-N2's iteration instrument: the four views the canopy and meadow rework is
 * judged from, captured in one page session.
 *
 *   node scripts/probe-kelp-canopy.mjs <tag>
 *
 * The canonical set never looks up and never looks straight down, and those
 * are exactly the two reads the round critic failed the vegetation on — so
 * this walks the money shot (under the NW grove, up-sun), a side view of the
 * grove, the canonical tidepool pose for the meadow, and a high overhead for
 * the "sand platter" read. Writes tmp_<name>_<tag>.png into visual-qa/.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { blockAssets, noAssets, waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const tag = process.argv[2] ?? "current";

const POSES = [
  // The money shot: standing on the NW bench inside the grove, looking east
  // and up so the crowns hang between the lens and the sun at (17, 24, 13).
  { name: "Z-kelp-canopy", position: [-18.2, 1.8, 14.8], yaw: -1.45, pitch: 0.78, settle: 2 },
  // The grove seen from the reef floor ten metres east: the forest as a mass.
  { name: "Z2-grove-side", position: [-7, 2.5, 14.5], yaw: 1.45, pitch: 0.12, settle: 2 },
  // Canonical G: the meadow's close read lives here.
  { name: "G-tidepool-close", position: [7.5, 1.3, 10.5], yaw: 0.5, pitch: -0.25, settle: 3 },
  // The overview the critic called "thin sticks and whiskers on a sand
  // platter": high over the bowl, pitched hard down. Aimed east of the spawn
  // corridor — the first cut of this pose parked the reticle on the snowflake
  // and the discovery plate covered the frame it was judging.
  { name: "O-overhead", position: [8, 10.5, 14], yaw: 0.4, pitch: -0.95, settle: 2 },
];

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

if (noAssets) {
  console.info("SHOT_NO_ASSETS=1 — probing the procedural fallback build");
  await blockAssets(page);
}

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

for (const pose of POSES) {
  // One retry per pose: with sibling workers editing the tree, Vite can force
  // a full reload between the readiness wait and the capture call, which
  // lands as "execution context destroyed" or a missing `__reef`.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
      await page.waitForFunction(() => "__reef" in window);
      await waitForAssets(page);
      await page.evaluate(
        (p) =>
          window.__reef.capture({ position: p.position, yaw: p.yaw, pitch: p.pitch, settle: p.settle }),
        pose,
      );
      await page.waitForTimeout(250);
      const file = path.join(OUT_DIR, `tmp_${pose.name}_${tag}.png`);
      await page.screenshot({ path: file });
      console.info(`captured ${path.relative(process.cwd(), file)}`);
      break;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
      console.warn(`  retrying ${pose.name}: ${error.message.split("\n")[0]}`);
    }
  }
}

await browser.close();
