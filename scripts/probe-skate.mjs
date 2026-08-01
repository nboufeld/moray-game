/**
 * R5 probe — where is the Ember Skate when the ember-skate pose's frame
 * is held? Mirrors region-shots.mjs launch-for-launch (same viewport,
 * same timeouts, same waits, same capture call), then reads the skate
 * sheet's world-space centroid out of the held frame. Run several times
 * to see the phase spread across launches.
 */
import { chromium } from "@playwright/test";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const SLOT = "smoking-marches-2";
const NAV_TIMEOUT_MS = Number(process.env.SHOT_NAV_TIMEOUT ?? 180_000);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
page.setDefaultTimeout(NAV_TIMEOUT_MS);

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);
await page.evaluate((slot) => window.__reef.forceRegion(slot), SLOT);
await waitForAssets(page);

const pose = await page.evaluate((slot) => {
  const def = window.__reefRegions.defs.find((d) => d.slotId === slot);
  return def.capturePoses.find((p) => p.name === "ember-skate");
}, SLOT);

const result = await page.evaluate((p) => {
  window.__reef.capture({
    position: [...p.position],
    yaw: p.yaw,
    pitch: p.pitch,
    settle: p.settle,
  });
  const scene = window.__reef.scene;
  let skate;
  scene.traverse((o) => {
    if (o.name === "forge-ember-skate") skate = o;
  });
  if (!skate) return { error: "no skate mesh" };
  const attr = skate.geometry.attributes.position;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < attr.count; i++) {
    x += attr.getX(i);
    y += attr.getY(i);
    z += attr.getZ(i);
  }
  return {
    skate: [x / attr.count, y / attr.count, z / attr.count],
    camera: p.position,
    yaw: p.yaw,
    pitch: p.pitch,
  };
}, pose);

console.info(JSON.stringify(result));
await browser.close();
