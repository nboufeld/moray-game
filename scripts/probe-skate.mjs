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
    visible: skate.visible,
    camera: p.position,
    yaw: p.yaw,
    pitch: p.pitch,
  };
}, pose);

// Let the hold loop render a few frames so the camera matrices are the
// held frame's own, then project the skate through the live camera.
await page.waitForTimeout(1200);
const screen = await page.evaluate((centroid) => {
  const camera = window.__reef.camera;
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  const v = camera.position.clone();
  v.set(centroid[0], centroid[1], centroid[2]);
  v.project(camera);
  const world = camera.position.clone();
  world.setFromMatrixPosition(camera.matrixWorld);
  // What encloses the lens? March six axis rays and report first hits.
  const scene = window.__reef.scene;
  const hits = [];
  const dir = camera.position.clone();
  for (const [dx, dy, dz] of [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ]) {
    dir.set(dx, dy, dz);
    const ray = window.__reef.raycaster;
    ray.set(world, dir);
    ray.near = 0;
    ray.far = 60;
    const found = ray.intersectObjects(scene.children, true)[0];
    hits.push(
      found ? `${dx},${dy},${dz}: ${found.object.name || found.object.type} @${found.distance.toFixed(1)}` : `${dx},${dy},${dz}: -`,
    );
  }
  return {
    ndcX: v.x,
    ndcY: v.y,
    ndcZ: v.z,
    cameraWorld: [world.x, world.y, world.z],
    hits,
  };
}, result.skate);
result.screen = screen;

console.info(JSON.stringify(result));
// The held frame itself, for reading the composition without a full set.
await page.waitForTimeout(1200);
await page.screenshot({ path: "visual-qa/probe-ember-skate.png" });
await browser.close();
