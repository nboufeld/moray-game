/**
 * INDEPENDENT CRITIC — the off-road pose set. Frames nobody authored:
 * between landmarks, at unglamorous bearings, mid-water looking straight
 * down, floor-level looking up. Four such stands per region, sixteen
 * regions, resolved in-page against each def's live terrainTarget /
 * ceiling so the script and the game cannot disagree about the ground.
 *
 *   node scripts/critic-offroad.mjs <tag>          # all sixteen regions
 *   REGION_ONLY=slot-id[,slot-id] node scripts/critic-offroad.mjs <tag>
 *
 * Requires a dev server (default http://localhost:5214, override with
 * SHOT_URL). Regions are forced (per-region QA idiom) — these judge
 * interiors, not seams; the journey chains judge the seams.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { blockAssets, noAssets, waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5214";
const OUT_DIR = path.resolve("visual-qa");
const VIEWPORT = { width: 1600, height: 900 };
const NAV_TIMEOUT_MS = Number(process.env.SHOT_NAV_TIMEOUT ?? 180_000);
const COMPILE_WAIT_MS = Number(process.env.SHOT_COMPILE_WAIT ?? 900);
const perLaunch = process.env.SHOT_PER_LAUNCH === "1";

const SLOTS = [
  "verdant-line-1",
  "verdant-line-2",
  "verdant-line-3",
  "smoking-marches-1",
  "smoking-marches-2",
  "smoking-marches-3",
  "pale-passage-1",
  "pale-passage-2",
  "pale-passage-3",
  "great-blue-1",
  "great-blue-2",
  "great-blue-3",
  "golden-waste-1",
  "golden-waste-2",
  "golden-waste-3",
  "sunken-calamity-1",
];

const only = (process.env.REGION_ONLY ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const slots = only.length > 0 ? SLOTS.filter((s) => only.includes(s)) : SLOTS;

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/critic-offroad.mjs <tag>");
  process.exit(1);
}

/**
 * The four critic stands, in slot coordinates (du = metres along the
 * spoke from the slot CENTRE, v = lateral CCW). Chosen to be nobody's
 * pose: off the spine, off the hearts, at bearings the plans never
 * composed for.
 *
 * lookDu/lookV aim the camera; "mid-down" and "floor-up" override pitch
 * hard. y = terrain floor + lift, clamped under the ceiling.
 */
const STANDS = [
  // Between landmarks on the near half, looking ACROSS the road, not
  // along it — the wayside at an unglamorous bearing.
  { name: "roadside-cross", du: -95, v: 55, lift: 2.2, lookDu: -80, lookV: -160, pitch: -0.06 },
  // Mid-water, looking steeply down at whatever the ground cover is.
  { name: "mid-down", du: 45, v: -60, lift: 20, lookDu: 46, lookV: -59, pitch: -1.25 },
  // Floor level, looking up through the verticals toward the light.
  { name: "floor-up", du: -25, v: 90, lift: 1.0, lookDu: -20, lookV: 60, pitch: 0.55 },
  // Deep half, off-spine, looking outward/tangential — the frame a lost
  // swimmer gets, no landmark in the brief.
  { name: "lost-bearing", du: 105, v: 115, lift: 2.4, lookDu: 190, lookV: 200, pitch: -0.03 },
];

function stamp() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

async function openPage() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  page.setDefaultTimeout(NAV_TIMEOUT_MS);
  page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));
  if (noAssets) {
    await blockAssets(page);
  }
  return { browser, page };
}

await mkdir(OUT_DIR, { recursive: true });
const prefix = stamp();
let { browser, page } = await openPage();

for (const slot of slots) {
  for (const [index, stand] of STANDS.entries()) {
    if (perLaunch) {
      await browser.close();
      ({ browser, page } = await openPage());
    }
    await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
    await page.waitForFunction(() => "__reef" in window);
    await waitForAssets(page);
    await page.evaluate((s) => window.__reef.forceRegion(s), slot);
    await waitForAssets(page);

    const pose = await page.evaluate(
      async ([slotId, s]) => {
        const [{ REGIONS }, { regionSlot }] = await Promise.all([
          import("/src/world/regions/RegionRegistry.ts"),
          import("/src/world/regions/RegionSlots.ts"),
        ]);
        const def = REGIONS.find((d) => d.slotId === slotId);
        if (!def) throw new Error(`no def for ${slotId}`);
        const slotDef = regionSlot(slotId);
        const ax = Math.cos(slotDef.azimuth);
        const az = Math.sin(slotDef.azimuth);
        const world = (du, v) => {
          const u = slotDef.centerR + du;
          return { x: u * ax - v * az, z: u * az + v * ax };
        };
        const p = world(s.du, s.v);
        const floor = def.terrainTarget(p.x, p.z) + def.floorClearance;
        const ceiling = def.ceiling(p.x, p.z);
        const y = Math.min(floor + s.lift, ceiling - 1.5);
        const look = world(s.lookDu, s.lookV);
        const yaw = Math.atan2(-(look.x - p.x), -(look.z - p.z));
        return { position: [p.x, Math.max(y, floor + 0.8), p.z], yaw, pitch: s.pitch, settle: 2 };
      },
      [slot, stand],
    );

    await page.evaluate((p) => window.__reef.capture(p), pose);
    await page.waitForTimeout(COMPILE_WAIT_MS);

    const name = `CRITIC-${slot}-${String(index + 1).padStart(2, "0")}-${stand.name}`;
    const file = path.join(OUT_DIR, `${prefix}_${name}_${tag}.png`);
    await page.screenshot({ path: file });
    console.info(`captured ${path.relative(process.cwd(), file)}`);
  }
}

await browser.close();
