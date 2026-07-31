/**
 * Temp helper (deleted before close): re-captures a SUBSET of the seeded
 * sweep poses by 1-based index — for frames a loaded machine timed out.
 * Pose stream identical to scripts/region-sweep.mjs (seeded, recurs).
 *
 *   SHOT_URL=... node scripts/pale-sweep-subset.mjs <tag> <index> [index...]
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { blockAssets, noAssets, waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const SLOT = "pale-passage-1";
const VIEWPORT = { width: 1600, height: 900 };
const POSES = 12;

const tag = process.argv[2];
const wanted = process.argv.slice(3).map((raw) => Number(raw));
if (!tag || wanted.length === 0) {
  console.error("usage: node scripts/pale-sweep-subset.mjs <tag> <index...>");
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
// 10 min: several worktree agents share the machine during the fill
// batch; a single load can stretch past the stock 3 minutes.
page.setDefaultNavigationTimeout(600_000);
page.setDefaultTimeout(600_000);
if (noAssets) {
  await blockAssets(page);
}

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);

const poses = await page.evaluate(
  async ([slot, count]) => {
    const [{ REGIONS }, { regionSlot, slotCenter }, { Random }, { KIT_SWEEP_SALT }] =
      await Promise.all([
        import("/src/world/regions/RegionRegistry.ts"),
        import("/src/world/regions/RegionSlots.ts"),
        import("/src/util/Random.ts"),
        import("/src/world/regions/kit/KitTypes.ts"),
      ]);
    const def = REGIONS.find((candidate) => candidate.slotId === slot);
    const slotDef = regionSlot(slot);
    const center = slotCenter(slotDef);
    let hash = 0x811c9dc5;
    for (let i = 0; i < slot.length; i++) {
      hash = Math.imul(hash ^ slot.charCodeAt(i), 0x01000193);
    }
    const random = new Random((hash >>> 0) ^ KIT_SWEEP_SALT);
    const drawn = [];
    let guard = 0;
    while (drawn.length < count && guard++ < 4000) {
      const x = center.x + random.signed(slotDef.radius);
      const z = center.z + random.signed(slotDef.radius);
      if (def.weight(x, z) < 0.5) {
        continue;
      }
      const floor = def.terrainTarget(x, z) + def.floorClearance + 1.2;
      const ceiling = def.ceiling(x, z) - 1.2;
      if (ceiling - floor < 1) {
        continue;
      }
      const y = floor + random.next() * Math.min(ceiling - floor, 6);
      drawn.push({
        position: [x, y, z],
        yaw: random.range(0, Math.PI * 2),
        pitch: -random.range(0.03, 0.22),
        settle: 2,
      });
    }
    return drawn;
  },
  [SLOT, POSES],
);

const prefix = stamp();
for (const index of wanted) {
  const pose = poses[index - 1];
  if (!pose) {
    console.error(`no sweep pose ${index}`);
    continue;
  }
  await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);
  await page.evaluate((slot) => window.__reef.forceRegion(slot), SLOT);
  await waitForAssets(page);
  await page.evaluate((p) => window.__reef.capture(p), pose);
  await page.waitForTimeout(250);
  const name = `SWEEP-${SLOT}-${String(index).padStart(2, "0")}`;
  const file = path.join(OUT_DIR, `${prefix}_${name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}
await browser.close();
