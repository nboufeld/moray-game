/**
 * The random-pose sweep (MASTER.md §4.1) — the three-layer law's honest
 * verifier. Twelve SEEDED poses are drawn inside a region's domain
 * (rejection-sampled where weight > 0.5, y held between the region's own
 * floor and ceiling), so a rework is judged from positions nobody
 * composed for. ≥ 11/12 must satisfy the three-layer law by eye; any
 * miss must land inside a registered rest (MASTER's stillness registry).
 *
 *   node scripts/region-sweep.mjs <slot-id> <tag>
 *
 * Requires a dev server (default http://localhost:5173, override with
 * SHOT_URL). Pose stream: `Random(fnv1a(slotId) ^ KIT_SWEEP_SALT)` — the
 * slot id stands in for the region's private seed constant, which defs
 * deliberately do not export; the stream is equally stable and shared by
 * every future sweep of the same slot.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { blockAssets, noAssets, waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const VIEWPORT = { width: 1600, height: 900 };
const NAV_TIMEOUT_MS = 180_000;
const POSES = 12;

const slotId = process.argv[2];
const tag = process.argv[3];
if (!slotId || !tag) {
  console.error("usage: node scripts/region-sweep.mjs <slot-id> <tag>");
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
page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
page.setDefaultTimeout(NAV_TIMEOUT_MS);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

if (noAssets) {
  await blockAssets(page);
}

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);

// Draw the twelve poses inside the running module graph, so the sweep and
// the game cannot disagree about the domain.
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
    if (!def) {
      throw new Error(`No registered region for slot ${slot}`);
    }
    const slotDef = regionSlot(slot);
    const center = slotCenter(slotDef);

    // FNV-1a over the slot id: the stable stand-in for the private seed.
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
  [slotId, POSES],
);

if (poses.length < POSES) {
  console.error(`only drew ${poses.length}/${POSES} poses — domain too thin?`);
}

const prefix = stamp();
for (const [index, pose] of poses.entries()) {
  await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);
  await page.evaluate((slot) => window.__reef.forceRegion(slot), slotId);
  await waitForAssets(page);
  await page.evaluate((p) => window.__reef.capture(p), pose);
  // 900 ms: outwait first-use shader compilation (the flat-violet race).
  await page.waitForTimeout(900);

  const name = `SWEEP-${slotId}-${String(index + 1).padStart(2, "0")}`;
  const file = path.join(OUT_DIR, `${prefix}_${name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

await browser.close();
