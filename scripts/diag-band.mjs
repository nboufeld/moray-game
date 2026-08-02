/** Edges-fix: interrogate the horizon-fog-band's live render state. */
import { chromium } from "@playwright/test";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5215";
const pose = (process.argv[2] ?? "-150.9,-0.4,-735.1,0.908,0").split(",").map(Number);
const force = process.argv[3];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultNavigationTimeout(180_000);
await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);
if (force) {
  await page.evaluate((s) => window.__reef.forceRegion(s), force);
  await waitForAssets(page);
}
await page.evaluate(
  ([x, y, z, yaw, pitch]) =>
    window.__reef.capture({ position: [x, y, z], yaw, pitch, settle: 3 }),
  pose,
);
await page.waitForTimeout(600);

const report = await page.evaluate(async () => {
  const scene = window.__reef.scene;
  let band;
  scene.traverse((o) => {
    if (o.name === "horizon-fog-band") band = o;
  });
  if (!band) return { found: false };
  let fired = 0;
  const prev = band.onBeforeRender;
  band.onBeforeRender = (...a) => {
    fired++;
    prev?.(...a);
  };
  await new Promise((r) => setTimeout(r, 800));
  band.onBeforeRender = prev;
  const chain = [];
  for (let o = band; o; o = o.parent) {
    chain.push(`${o.name || o.type}:visible=${o.visible}`);
  }
  return {
    found: true,
    fired,
    chain,
    position: band.position.toArray().map((v) => +v.toFixed(1)),
    world: [...band.matrixWorld.elements.slice(12, 15)].map((v) => +v.toFixed(1)),
    opacity: band.material.opacity,
    color: `#${band.material.color.getHexString()}`,
    transparent: band.material.transparent,
    renderOrder: band.renderOrder,
    layers: band.layers.mask,
    cameraLayers: window.__reef.camera.layers.mask,
    cameraPos: window.__reef.camera.position.toArray().map((v) => +v.toFixed(1)),
  };
});
console.info(JSON.stringify(report, null, 1));
await browser.close();
