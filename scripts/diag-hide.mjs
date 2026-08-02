/**
 * Hard-geometry purge diagnostics: capture one pose, then re-capture with
 * named scene objects hidden, to attribute a flat-card read to its owner.
 *
 *   SHOT_URL=http://localhost:5215 node scripts/diag-hide.mjs \
 *     --pose x,y,z,yaw,pitch [--force slot-id] --hide name1,name2 --tag t1
 *
 * Each --hide group produces one screenshot with every object whose name
 * matches one of the comma-separated names (substring match, whole scene
 * graph) set invisible; `--hide none` captures the baseline. Repeat
 * --hide/--tag pairs for more variants in one session.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5215";
const OUT_DIR = path.resolve("visual-qa/diag");

const args = process.argv.slice(2);
function readAll(flag) {
  const values = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) {
      values.push(args[i + 1]);
    }
  }
  return values;
}
const poseArg = readAll("--pose")[0];
const slotPoseArg = readAll("--slotpose")[0];
const force = readAll("--force")[0];
const hides = readAll("--hide");
const tags = readAll("--tag");
if ((!poseArg && !slotPoseArg) || hides.length === 0 || hides.length !== tags.length) {
  console.error(
    "usage: node scripts/diag-hide.mjs (--pose x,y,z,yaw,pitch | --slotpose slot,du,v,lift,lookDu,lookV,pitch) [--force slot] --hide a,b --tag t ...",
  );
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));
await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);
if (force) {
  for (const slot of force.split(",").map((s) => s.trim()).filter(Boolean)) {
    await page.evaluate((s) => window.__reef.forceRegion(s), slot);
    await waitForAssets(page);
  }
}
let pose;
if (slotPoseArg) {
  const [slot, du, v, lift, lookDu, lookV, pitch] = slotPoseArg.split(",");
  pose = await page.evaluate(
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
      return { position: [p.x, Math.max(y, floor + 0.8), p.z], yaw, pitch: s.pitch };
    },
    [slot, { du: +du, v: +v, lift: +lift, lookDu: +lookDu, lookV: +lookV, pitch: +pitch }],
  );
  console.info(`resolved slot pose: ${pose.position.map((n) => n.toFixed(1)).join(",")} yaw ${pose.yaw.toFixed(3)}`);
} else {
  const [x, y, z, yaw, pitch] = poseArg.split(",").map(Number);
  pose = { position: [x, y, z], yaw, pitch };
}
await page.evaluate((p) => window.__reef.capture({ ...p, settle: 3 }), pose);
await waitForAssets(page);
await page.evaluate((p) => window.__reef.capture({ ...p, settle: 0.5 }), pose);
await page.waitForTimeout(900);

for (let i = 0; i < hides.length; i++) {
  const names = hides[i] === "none" ? [] : hides[i].split(",").map((s) => s.trim());
  const touched = await page.evaluate((needles) => {
    const scene = window.__reef.scene;
    const hidden = [];
    if (needles.includes("@background")) {
      window.__diagBackground = scene.backgroundIntensity;
      scene.backgroundIntensity = 0;
      hidden.push("@background");
    }
    scene.traverse((object) => {
      if (needles.some((needle) => needle !== "@background" && object.name.includes(needle))) {
        object.visible = false;
        hidden.push(object.name);
      }
    });
    return hidden;
  }, names);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const file = path.join(OUT_DIR, `diag-${tags[i]}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)} (hidden: ${touched.join(", ") || "nothing"})`);
  // Restore for the next variant.
  await page.evaluate(() => {
    if (window.__diagBackground !== undefined) {
      window.__reef.scene.backgroundIntensity = window.__diagBackground;
      window.__diagBackground = undefined;
    }
    window.__reef.scene.traverse((object) => {
      object.visible = true;
    });
  });
}

await browser.close();
