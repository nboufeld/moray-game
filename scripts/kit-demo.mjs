/**
 * Captures kit-piece demos on the standard stage (KIT-SPEC §4).
 *
 *   node scripts/kit-demo.mjs <piece[,piece…]|all> <tag>
 *
 * Requires a dev server (default http://localhost:5173; override with
 * SHOT_URL — kit workers run their own server on their own port).
 * Writes visual-qa/kit/<piece>_<tag>.png and prints each build's declared
 * draws/triangles beside the renderer's own counters — a dishonest budget
 * note fails loudly here. Pieces with a `timeSec` (moving pieces) are
 * captured twice, one simulated second apart, as <piece>_<tag>-b.png.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa/kit");
const NAV_TIMEOUT_MS = 120_000;

const pieceArg = process.argv[2];
const tag = process.argv[3];
if (!pieceArg || !tag) {
  console.error("usage: node scripts/kit-demo.mjs <piece[,piece…]|all> <tag>");
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
page.setDefaultTimeout(NAV_TIMEOUT_MS);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

let pieces;
if (pieceArg === "all") {
  await page.goto(`${BASE_URL}/kit-demo.html?piece=__list__`, { waitUntil: "load" });
  pieces = await page.evaluate(async () => {
    const [a, b] = await Promise.all([
      import("/src/world/regions/kit/KitDemosA.ts"),
      import("/src/world/regions/kit/KitDemosB.ts"),
    ]);
    return [...Object.keys(a.KIT_DEMOS_A), ...Object.keys(b.KIT_DEMOS_B)];
  });
  if (pieces.length === 0) {
    console.error("no kit demos registered yet");
    process.exit(1);
  }
} else {
  pieces = pieceArg.split(",").map((piece) => piece.trim());
}

let failed = false;
for (const piece of pieces) {
  await page.goto(`${BASE_URL}/kit-demo.html?piece=${encodeURIComponent(piece)}`, {
    waitUntil: "load",
  });
  await page.waitForFunction(() => window.__kitDemoDone === true);
  const error = await page.evaluate(() => window.__kitDemoError ?? null);
  if (error) {
    console.error(`FAIL ${piece}: ${error}`);
    failed = true;
    continue;
  }
  const stats = await page.evaluate(() => window.__kitDemoStats);
  await page.waitForTimeout(200);
  const file = path.join(OUT_DIR, `${piece}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(
    `captured ${path.relative(process.cwd(), file)} — declared ${stats.declaredDraws} draws / ${stats.declaredTriangles} tris; renderer saw ${stats.renderedCalls} calls / ${stats.renderedTriangles} tris (stage included)`,
  );
}

await browser.close();
process.exit(failed ? 1 : 0);
