/**
 * Batch 4 standing-flag spot-check: "the kraken's fallback showing in
 * glass-cove" (connective plan §1's wave-8 flag). Boots the game, waits
 * for the asset library to settle, then asks the LIVE scene graph which
 * body the Kraken Hatchling is wearing — the cone-armed stand-in
 * (`kraken-fallback`) or the adopted GLB (`SkinnedMesh`) — and captures
 * a close den pose for the eye's own verdict.
 *
 *   node scripts/tierb-kraken-probe.mjs <tag>
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5210";
const OUT_DIR = path.resolve("visual-qa");
const AZIMUTH = 3.51; // glass-cove, den at r 40 on the axis

const tag = process.argv[2] ?? "tierb-kraken";
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultNavigationTimeout(240_000);
page.setDefaultTimeout(240_000);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

const verdict = await page.evaluate(() => {
  const game = window.__reef;
  const kraken = game.scene.getObjectByName("myth-kraken-hatchling");
  const body = kraken?.getObjectByName("kraken-hatchling-body");
  const kinds = [];
  body?.traverse((node) => kinds.push(`${node.type}:${node.name || "-"}`));
  return {
    assetsReady: game.assetsReady,
    systemPresent: Boolean(kraken),
    fallbackPresent: Boolean(body?.getObjectByName("kraken-fallback")),
    skinnedMeshPresent: Boolean(
      (() => {
        let found = false;
        body?.traverse((node) => {
          if (node.type === "SkinnedMesh") {
            found = true;
          }
        });
        return found;
      })(),
    ),
    bodyChildren: kinds,
  };
});
console.info(`[kraken-probe] ${JSON.stringify(verdict, null, 2)}`);

// The eye's own frame: stand 3.5 m off the den, looking at the mantle.
const r = 36.5;
const x = Math.cos(AZIMUTH) * r;
const z = Math.sin(AZIMUTH) * r;
const yaw = Math.atan2(-Math.cos(AZIMUTH), -Math.sin(AZIMUTH));
await page.evaluate(
  (pose) => window.__reef.capture(pose),
  { position: [x, -0.9, z], yaw, pitch: -0.28, settle: 4 },
);
await page.waitForTimeout(250);
const file = path.join(OUT_DIR, `KRAKEN-den_${tag}.png`);
await page.screenshot({ path: file });
console.info(`captured ${path.relative(process.cwd(), file)}`);

await browser.close();

if (!verdict.skinnedMeshPresent || verdict.fallbackPresent) {
  console.error("[kraken-probe] FLAG STANDS: fallback showing or GLB not adopted");
  process.exit(1);
}
console.info("[kraken-probe] GLB adopted, fallback retired — flag resolvable");
